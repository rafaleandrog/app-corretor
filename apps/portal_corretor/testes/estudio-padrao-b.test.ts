import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rotas } from '../backend/rotas';
import { ESTADOS_PECA } from '../comum/estudio';
import { acaoPrincipal, agruparPedidos, CRIAR_RAPIDO, estaSemana, JANELA_PEDIDO_MS, pedidoEscolhido, pedidosNaEtapa, proximoPasso, resumoPedido, tituloPedido, type PecaTela } from '../comum/estudio-pedidos';
import { BancoFalso, comServidor, type Ator } from './apoio';

// Estúdio no Padrão B (B6, issue #95; spec 11.1 P08, D-105): a lógica da tela sem DOM — pedidos
// reconstruídos das peças, a escolha da URL, UMA ação principal por estado, Esta semana — e a lista de
// peças com a sonda de IA e o imóvel, presa à conta.

const T0 = Date.parse('2026-11-05T12:00:00Z');
const em = (ms: number) => new Date(T0 + ms).toISOString();
const peca = (id: number, extra: Partial<PecaTela> = {}): PecaTela => ({ id, pedido: 'Post da casa', imovel_id: 5, objetivo: 'novo_imovel', formato: 'post_1x1', estado: 'rascunho', criado_em: em(id * 1000), arquivos: [], ...extra });

test('pedidos: as peças de um envio formam um pedido; texto, imóvel, objetivo ou tempo diferentes separam', () => {
  const pecas = [
    peca(1),
    peca(2, { formato: 'story' }),
    peca(3, { formato: 'carrossel' }),
    peca(4, { pedido: 'Outro pedido' }),
    peca(5, { pedido: 'Outro pedido', imovel_id: 6 }),
    peca(6, { pedido: 'Outro pedido', imovel_id: 6, objetivo: 'vendido' }),
    peca(7, { pedido: 'Outro pedido', imovel_id: 6, objetivo: 'vendido', criado_em: em(6000 + JANELA_PEDIDO_MS + 1) }),
  ];
  // A ordem de chegada não importa: a API devolve da mais nova para a mais antiga.
  const pedidos = agruparPedidos([...pecas].reverse());
  assert.deepEqual(pedidos.map((x) => x.pecas.map((p) => p.id)), [[7], [6], [5], [4], [1, 2, 3]], 'mais recente primeiro; peças em ordem de criação');
  assert.equal(pedidos[4].id, 1, 'o id do pedido é o da primeira peça');
  assert.equal(pedidos[4].texto, 'Post da casa');
  assert.deepEqual(agruparPedidos([]), []);
});

test('pedidos: ?item= vale mais que ?pedido=; id que não existe é "não encontrado"', () => {
  const pedidos = agruparPedidos([peca(1), peca(2), peca(3, { pedido: 'B' })]);
  assert.equal(pedidoEscolhido(pedidos, {}).pedido, null);
  assert.equal(pedidoEscolhido(pedidos, { pedido: '1' }).pedido?.id, 1);
  const item = pedidoEscolhido(pedidos, { pedido: '3', item: '2' });
  assert.deepEqual([item.pedido?.id, item.peca, item.naoEncontrado], [1, 2, false]);
  assert.equal(pedidoEscolhido(pedidos, { pedido: '2' }).naoEncontrado, true, 'pedido é o id da primeira peça, não de qualquer uma');
  assert.equal(pedidoEscolhido(pedidos, { item: '99' }).naoEncontrado, true);
  assert.equal(pedidoEscolhido(pedidos, { pedido: 'abc' }).naoEncontrado, false, 'lixo na URL é "nada escolhido"');
});

test('uma ação principal por estado (D-86): falta a arte → enviar; rascunho → aprovar; aprovada → publicar; erro → tentar', () => {
  const comArte = { arquivos: [{ url: '/a' }] };
  const esperado: Record<string, string> = {
    rascunho: 'aprovar',
    rejeitada: 'aprovar',
    aprovada: 'publicar',
    agendada: 'cancelar_agendamento',
    publicando: 'destravar',
    publicada: 'copiar_legenda',
    erro: 'aprovar', // erro sem aprovação: sobra de versões antigas
  };
  for (const e of ESTADOS_PECA) {
    assert.equal(acaoPrincipal(peca(1, { estado: e, ...comArte })), esperado[e], e);
  }
  assert.equal(acaoPrincipal(peca(1, { estado: 'erro', aprovada_em: em(0), ...comArte })), 'tentar_de_novo');
  assert.equal(acaoPrincipal(peca(1, { estado: 'publicada', permalink: 'https://instagram.com/p/x', ...comArte })), 'ver_no_instagram');
  // Sem arte: o principal é o envio, em qualquer estado que ainda não saiu.
  for (const e of ['rascunho', 'rejeitada', 'aprovada', 'erro']) assert.equal(acaoPrincipal(peca(1, { estado: e })), 'enviar_arte', e);
  assert.equal(acaoPrincipal(peca(1, { estado: 'publicada', permalink: 'x' })), 'ver_no_instagram', 'publicada antiga sem arte não volta a pedir arte');
  assert.match(proximoPasso(peca(1))!, /Canva IA/);
  assert.equal(proximoPasso(peca(1, { estado: 'agendada', ...comArte })), null);
});

test('Criar rápido: 4 atalhos (2×2), todos com objetivo válido; Lançamento é o pacote', () => {
  assert.deepEqual(CRIAR_RAPIDO.map((a) => a.rotulo), ['Lançamento', 'Baixou o preço', 'Vendido', 'Visita aberta']);
  assert.equal(CRIAR_RAPIDO[0].formatos, null, 'Lançamento vai por /estudio/pacote');
  assert.ok(CRIAR_RAPIDO.slice(1).every((a) => a.formatos && a.formatos.length));
});

test('Esta semana: agendadas dos próximos 7 dias e publicadas dos últimos 7, por data; etapas filtram pedidos', () => {
  const dia = 86400e3;
  const pecas = [
    peca(1, { estado: 'agendada', agendada_para: em(3 * dia) }),
    peca(2, { estado: 'agendada', agendada_para: em(1 * dia) }),
    peca(3, { estado: 'agendada', agendada_para: em(9 * dia) }),
    peca(4, { estado: 'publicada', publicada_em: em(-2 * dia) }),
    peca(5, { estado: 'publicada', publicada_em: em(-10 * dia) }),
    peca(6, { estado: 'rascunho' }),
  ];
  const s = estaSemana(pecas, T0);
  assert.deepEqual(s.agendadas.map((p) => p.id), [2, 1]);
  assert.deepEqual(s.publicadas.map((p) => p.id), [4]);
  const pedidos = agruparPedidos(pecas.map((p, i) => ({ ...p, pedido: `p${i}` })));
  assert.equal(pedidosNaEtapa(pedidos, 'agendadas').length, 3);
  assert.equal(pedidosNaEtapa(pedidos, 'arte').length, 1);
  assert.equal(pedidosNaEtapa(pedidos, 'qualquer').length, 6, 'etapa desconhecida é "Todas"');
  assert.equal(resumoPedido(agruparPedidos([peca(1), peca(2, { estado: 'agendada', arquivos: [1] })])[0]), '2 peças · 1 sem arte · 1 agendada');
  assert.equal(tituloPedido(agruparPedidos([peca(1)])[0], 'IM-0001'), 'Novo imóvel · IM-0001');
});

const UNICOS = { contatos: ['telefone'], imoveis: ['codigo'], marca_conta: ['chave'], marca_arquivos: ['tipo'], perfis_corretor: ['usuario_id'] };
const arquivos = { url: async (arquivo: number) => `/arquivo/${arquivo}` };
const iaLigada = {
  estadoSlot: async (slot: string) => ({ pedido: slot, efetivo: { slot, origem: 'global' }, backup: null }),
  consultar: async () => ({ dados: {} }),
};
const iaDesligada = { estadoSlot: async (slot: string) => ({ pedido: slot, efetivo: null, backup: null }) };
const A: Ator = { usuario: 1, conta: 100, papeis: ['corretor'], extras: { arquivos, ia: iaDesligada } };
const AcomIA: Ator = { ...A, extras: { arquivos, ia: iaLigada } };
const B: Ator = { usuario: 2, conta: 200, papeis: ['corretor'], extras: { arquivos, ia: iaLigada } };

test('GET /estudio/pecas: sonda de IA (slot conteudo), código do imóvel e nada de outra conta', async () => {
  const banco = new BancoFalso(UNICOS);
  let imovelId = 0;
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    const im = (await chamar('POST', '/imoveis', { tipo: 'casa', cidade: 'Brasília', bairro: 'Lago Sul', titulo: 'Casa com jardim' })).corpo;
    imovelId = im.id;
    assert.equal((await chamar('POST', '/estudio/pedido', { pedido: 'Post', imovel_id: im.id, objetivo: 'novo_imovel', formatos: ['post_1x1', 'story'] })).status, 201);
    const r = (await chamar('GET', '/estudio/pecas')).corpo;
    assert.equal(r.ia, false, 'slot sem efetivo: IA indisponível');
    assert.equal(r.dados.length, 2);
    assert.ok(r.dados.every((p: any) => p.imovel_codigo === im.codigo && p.imovel_titulo === 'Casa com jardim'));
    // As duas peças do envio formam um pedido só na tela.
    assert.equal(agruparPedidos(r.dados).length, 1);
  });
  await comServidor(rotas, AcomIA, banco, {}, async (chamar) => {
    assert.equal((await chamar('GET', '/estudio/pecas')).corpo.ia, true);
  });
  // Isolamento (spec 4.5): o corretor B não vê as peças nem o imóvel de A, nem por id.
  await comServidor(rotas, B, banco, {}, async (chamar) => {
    const r = (await chamar('GET', '/estudio/pecas')).corpo;
    assert.equal(r.dados.length, 0);
    assert.equal((await chamar('GET', `/estudio/pecas?imovel_id=${imovelId}`)).corpo.dados.length, 0);
    const ids = banco.linhas('pecas').map((p) => p.id);
    assert.equal(ids.length, 2);
    for (const id of ids) assert.equal((await chamar('GET', `/estudio/pecas/${id}`)).status, 404);
  });
});
