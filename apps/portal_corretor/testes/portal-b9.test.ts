import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rotas, rotasPublicas } from '../backend/rotas';
import { limparLimites } from '../backend/publico';
import { abaDoEndereco, abasDoPortal, chipDeVisita, destinoDoProximoPasso, estadoDoErro, imoveisDoPortal, iniciais, proximaVisita, reacaoDada, recadosDasSelecoes } from '../comum/portal-cliente';
import { BancoFalso, comServidor, type Ator } from './apoio';

// Bloco B9 (#98): Portal do Cliente e página pública no formato dos mockups M4, M5 e M6, sempre
// por token. As regras da tela são puras (comum/portal-cliente.ts); o payload público não leva
// telefone, e-mail nem documento de terceiros; token revogado vira "link expirado".

const UNICOS = { contatos: ['telefone'], imoveis: ['codigo'], visitas: ['atividade_id'], etapas_funil: ['pipeline+nome'], origens: ['canal+campanha'], vitrine_publica: ['tipo+chave'], selecao_itens: ['selecao_id+imovel_id'], paginas_corretor: ['chave'], marca_conta: ['chave'], perfis_corretor: ['usuario_id'] };
const arquivos = { url: async (arquivo: number) => `/arquivo/${arquivo}` };
const A: Ator = { usuario: 1, conta: 100, papeis: ['corretor'], extras: { arquivos } };
const VISITANTE: Ator = { usuario: 0, conta: null, papeis: [], extras: { arquivos } };
const HOJE = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
const dia = (delta: number) => new Date(Date.now() + delta * 86400e3).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
type Chamar = (m: string, c: string, b?: unknown) => Promise<{ status: number; corpo: any }>;

function shellFalso() {
  const ingressos = new Map<string, { id: number; webhook: string; contexto: any; ativo: boolean }>();
  let n = 0;
  return {
    gerarIngressoWh: async ({ webhook, contexto }: { webhook: string; contexto: any }) => {
      n++;
      const token = `wh_${webhook}_${n}x`;
      ingressos.set(token, { id: n, webhook, contexto, ativo: true });
      return { url: `https://corretor.exemplo/api/wh/portal_corretor/${token}`, token, ingresso_id: n, expira_em: null };
    },
    inspecionarIngressoWh: async ({ webhook, token }: { webhook: string; token: string }) => {
      const i = ingressos.get(token);
      if (!i || i.webhook !== webhook || !i.ativo) throw Object.assign(new Error('inválido'), { codigo: 'WH_INGRESSO_INVALIDO' });
      return { ingresso_id: i.id, contexto: i.contexto, expira_em: null, contador_usos: 0 };
    },
    revogarIngressoWh: async ({ ingresso_id }: { ingresso_id: number }) => {
      for (const i of ingressos.values()) if (i.id === ingresso_id) i.ativo = false;
      return { revogado: true };
    },
  };
}

/** Imóvel anunciado na página, com foto pública (801), documento interno (802) e o telefone do dono. */
async function imovelAnunciado(chamar: Chamar, titulo: string, telefoneDono: string) {
  const im = (await chamar('POST', '/imoveis', { tipo: 'casa', cidade: 'Brasília', bairro: 'Jardim Botânico', titulo, endereco: 'Rua Secreta 12', endereco_publico: 'bairro' })).corpo;
  await chamar('PATCH', `/imoveis/${im.id}`, { preco: 1450000, quartos: 4 });
  const dono = (await chamar('POST', '/contatos', { nome: 'Dona Vera Proprietária', telefone: telefoneDono, email: 'vera@exemplo.com' })).corpo;
  const aut = (await chamar('POST', '/autorizacoes', { imovel_id: im.id, proprietario_id: dono.id, inicio: HOJE, fim: dia(60), comissao_pct: '5', preco_autorizado: '1.450.000' })).corpo;
  await chamar('POST', `/imoveis/${im.id}/midias`, { upload_id: 801, tipo: 'foto', legenda: 'Fachada' });
  const doc = (await chamar('POST', `/imoveis/${im.id}/midias`, { upload_id: 802, tipo: 'documento' })).corpo;
  await chamar('PATCH', `/autorizacoes/${aut.id}`, { documento_midia_id: doc.id, situacao: 'assinada' });
  await chamar('PATCH', `/imoveis/${im.id}`, { situacao: 'ativo', publicado_pagina: true });
  return im;
}

const tokenDe = (link: string) => new URL(link).searchParams.get('t')!;

test('regras puras do portal: abas com contagem, [Ver], aba do endereço, chip de visita, reação dada, iniciais', () => {
  const agora = Date.parse('2026-10-28T12:00:00Z');
  const casa = { codigo: 'IM-1', reacao: 'gostei' };
  const apto = { codigo: 'IM-2', reacao: null };
  const portal = {
    // O mesmo imóvel em duas seleções conta uma vez.
    selecoes: [{ itens: [casa, apto] }, { itens: [{ codigo: 'IM-1' }] }],
    agenda: [
      { ref: 1, quando: '2026-10-31T13:00:00Z', imovel: { codigo: 'IM-1' } },
      { ref: 2, quando: '2026-10-27T13:00:00Z', imovel: { codigo: 'IM-2' } },
    ],
  };
  assert.deepEqual(
    abasDoPortal(portal, agora).map((a) => [a.id, a.n]),
    [['conversa', null], ['imoveis', 2], ['agenda', 1], ['arquivos', 0]],
    'Conversa · Imóveis n · Agenda n · Arquivos n; Propostas fica para o D5',
  );
  assert.deepEqual(imoveisDoPortal(portal.selecoes).map((x) => x.imovel.codigo), ['IM-1', 'IM-2']);
  assert.equal(destinoDoProximoPasso(portal, agora), 'agenda');
  const duas = [
    { titulo: 'Para morar', mensagem: 'Veja estes', itens: [{ codigo: 'IM-1' }] },
    { titulo: 'Plano B', mensagem: 'E estes', itens: [{ codigo: 'IM-1' }] },
  ];
  assert.deepEqual(recadosDasSelecoes(duas).map((r) => [r.titulo, r.mensagem, r.imoveis]), [['Para morar', 'Veja estes', 1], ['Plano B', 'E estes', 1]], 'as duas mensagens chegam, mesmo com imóvel repetido');
  const t0 = Date.parse('2026-10-28T12:00:00Z');
  assert.equal(proximaVisita([{ quando: '2026-10-29T10:00:00Z' }, { quando: '2026-10-28T11:30:00Z' }], t0), '2026-10-28T11:30:00Z', 'visita há 30 min ainda conta, como na aba Agenda');
  assert.equal(proximaVisita([{ quando: '2026-10-28T10:30:00Z' }], t0), null);
  assert.equal(destinoDoProximoPasso({ ...portal, agenda: [] }, agora), 'imoveis');
  assert.deepEqual(['#imoveis', '#agenda', '#arquivos', '#propostas', '#outra', ''].map(abaDoEndereco), ['imoveis', 'agenda', 'arquivos', 'propostas', 'conversa', 'conversa']);
  assert.match(chipDeVisita('IM-1', portal.agenda, agora, 'America/Sao_Paulo')!, /^Visita sáb/);
  assert.equal(chipDeVisita('IM-2', portal.agenda, agora), null, 'visita que já passou não vira chip');
  assert.deepEqual([reacaoDada('gostei'), reacaoDada('nao_gostei'), reacaoDada(null)], ['Gostei', 'Não gostei', 'Sem reação']);
  assert.deepEqual([iniciais('Rafael Gualberto'), iniciais('Ana'), iniciais('  '), iniciais(null)], ['RG', 'AN', '', '']);
});

test('token revogado, vencido ou trocado mostra "link expirado"; queda de rede pede outra tentativa', () => {
  assert.equal(estadoDoErro({ status: 404 }), 'expirado');
  assert.equal(estadoDoErro({ codigo: 'NAO_ENCONTRADO' }), 'expirado');
  assert.equal(estadoDoErro({ status: 500 }), 'falha');
  assert.equal(estadoDoErro(new TypeError('Failed to fetch')), 'falha');
  assert.equal(estadoDoErro(null), 'falha');
});

test('payload público do portal e da página: sem telefone, e-mail ou documento de terceiros; foto do corretor como URL; revogado dá 404', async () => {
  limparLimites();
  const banco = new BancoFalso(UNICOS);
  const shell = shellFalso();
  let link = '';
  let clienteId = 0;
  let codigo = '';
  await comServidor(rotas, A, banco, shell, async (chamar) => {
    // Foto do corretor na marca: vai à capa da página (M6) e ao topo do portal.
    assert.equal((await chamar('POST', '/estudio/marca/arquivos', { tipo: 'foto', upload_id: 950 })).status, 200);
    const im = await imovelAnunciado(chamar, 'Casa 4 quartos', '61955550001');
    codigo = im.codigo;
    const cliente = (await chamar('POST', '/contatos', { nome: 'Ana Ribeiro', telefone: '61966660002', email: 'ana@exemplo.com' })).corpo;
    clienteId = cliente.id;
    link = (await chamar('POST', `/contatos/${cliente.id}/portal`)).corpo.link;
    await chamar('POST', '/selecoes', { contato_id: cliente.id, titulo: 'Casas no JB', imovel_ids: [im.id] });
    await chamar('POST', '/atividades', { tipo: 'visita', titulo: 'Visita interna da Ana', contato_id: cliente.id, imovel_id: im.id, quando: new Date(Date.now() + 2 * 86400e3).toISOString() });
    const p = (await chamar('GET', '/pagina')).corpo.pagina;
    assert.equal((await chamar('PUT', '/pagina', { ...p, endereco: 'rafael', nome_exibicao: 'Rafael Gualberto' })).status, 200);
    assert.equal((await chamar('POST', '/pagina/publicar')).status, 200);
  });

  // Na vitrine e nas respostas públicas: nada do cliente, do dono nem do documento.
  const proibidos = ['Ana Ribeiro', '61966660002', 'ana@exemplo.com', 'Vera', '61955550001', 'vera@', 'Rua Secreta', '/arquivo/802', 'Visita interna'];
  const semTerceiros = (rotulo: string, x: unknown) => {
    const texto = JSON.stringify(x);
    for (const p of proibidos) assert.ok(!texto.includes(p), `${rotulo} sem ${p}`);
  };
  semTerceiros('vitrine', banco.linhas('vitrine_publica'));
  const linhaPagina = banco.linhas('vitrine_publica').find((l) => l.tipo === 'pagina')!;
  assert.equal(linhaPagina.dados.foto, 950, 'a vitrine guarda o arquivo da foto do corretor');

  await comServidor(rotasPublicas, VISITANTE, banco, shell, async (chamar) => {
    const portal = await chamar('GET', `/vitrine/portal?t=${tokenDe(link)}`);
    assert.equal(portal.status, 200);
    semTerceiros('portal', portal.corpo);
    assert.equal(portal.corpo.portal.corretor.foto_url, '/arquivo/950');
    assert.equal(portal.corpo.portal.corretor.foto, undefined, 'id do arquivo não sai');
    assert.equal(portal.corpo.portal.selecoes[0].itens[0].codigo, codigo);
    assert.equal(portal.corpo.portal.agenda[0].imovel.codigo, codigo, 'a agenda liga a visita ao imóvel (chip "Visita")');

    const pagina = await chamar('GET', '/vitrine/pagina?c=rafael');
    assert.equal(pagina.status, 200);
    semTerceiros('página', pagina.corpo);
    assert.equal(pagina.corpo.pagina.foto_url, '/arquivo/950');
    assert.equal(pagina.corpo.pagina.foto, undefined, 'id do arquivo não sai');
    assert.equal(pagina.corpo.pagina.creci, null, 'sem CRECI no perfil, a capa não mostra CRECI (D-93)');
    assert.equal(pagina.corpo.pagina.blocos.find((b: any) => b.tipo === 'destaques').titulo, 'Imóveis em destaque');
    const ficha = await chamar('GET', `/vitrine/imovel?c=rafael&i=${codigo}`);
    semTerceiros('ficha', ficha.corpo);
    assert.equal(ficha.corpo.pagina.foto_url, '/arquivo/950');
  });

  // Corretor revoga o link: a rota pública responde 404, que a tela mostra como "link expirado".
  await comServidor(rotas, A, banco, shell, async (chamar) => {
    assert.equal((await chamar('PATCH', `/contatos/${clienteId}/portal/revogar`)).status, 200);
  });
  await comServidor(rotasPublicas, VISITANTE, banco, shell, async (chamar) => {
    const r = await chamar('GET', `/vitrine/portal?t=${tokenDe(link)}`);
    assert.equal(r.status, 404);
    assert.equal(estadoDoErro({ status: r.status, codigo: r.corpo.codigo }), 'expirado');
  });
});
