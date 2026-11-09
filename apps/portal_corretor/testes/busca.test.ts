import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rotas } from '../backend/rotas';
import { BUSCA_MAX, cortarTermo, normalizarTermo } from '../comum/busca';
import { CAMPOS_SIGILOSOS } from '../comum/negociacao';
import { atalhoDe, focoEmCampo, opcoesDaBusca, vizinho } from '../frontend/atalhos';
import { BancoFalso, comServidor, type Ator } from './apoio';

// Busca global e atalhos (spec 11.7 e 11.0.6, item B10). A rota responde só pela conta ativa, com uma
// lista fechada de campos (nada do mandato), e os atalhos não agem com o foco num campo de texto.

const A: Ator = { usuario: 1, conta: 100, papeis: ['corretor'] };
const B: Ator = { usuario: 2, conta: 200, papeis: ['corretor'] };
const NEGOCIADOR: Ator = { usuario: 3, conta: 100, papeis: ['negociador'] };
const EQUIPE: Ator = { usuario: 9, conta: null, papeis: ['operacao'] };
/** Admin que atende as duas contas, com a A ativa (`X-Conta`). */
const ADMIN_A: Ator = { usuario: 8, conta: 100, contas: [100, 200], papeis: [], nivel: 'admin' };

async function semear(banco: BancoFalso) {
  const a = banco.dados(100);
  const ana = await a.criar('contatos', { nome: 'Ana Zimmermann', telefone: '+5561999990001', email: 'ana@exemplo.com', papeis: 'comprador' });
  await a.criar('contatos', { nome: 'Zélia Anonimizada', anonimizado_em: new Date().toISOString(), papeis: 'comprador' });
  const casa = await a.criar('imoveis', { codigo: 'IM-0001', titulo: 'Casa no Lago Zimbro', bairro: 'Lago Sul', situacao: 'ativo' });
  const neg = await a.criar('negociacoes', {
    codigo: 'NG-0007',
    contato_id: ana.id,
    imovel_id: casa.id,
    estado: 'ativa',
    conduzida_por: 'ia',
    teto_estimado_comprador_c: 90_000_000,
    batna_estimada_comprador: 'outro imóvel',
    recuo_c: 80_000_000,
    alvo_c: 85_000_000,
    batna_vendedor: 'alugar',
  });
  const b = banco.dados(200);
  await b.criar('contatos', { nome: 'Bruno Bexiga', telefone: '+5511988887777', email: 'bruno@b.com', papeis: 'comprador' });
  await b.criar('imoveis', { codigo: 'IM-0001', titulo: 'Apto Bexiga', bairro: 'Bela Vista', situacao: 'ativo' });
  return { ana, casa, neg };
}

test('busca acha cliente, imóvel e negociação da conta, até 5 por tipo, sem nada do mandato', async () => {
  const banco = new BancoFalso();
  const { ana, casa, neg } = await semear(banco);
  for (let i = 0; i < 7; i++) await banco.dados(100).criar('contatos', { nome: `Zimbro ${i}`, papeis: 'comprador' });
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    const r = await chamar('GET', '/busca?q=zim');
    assert.equal(r.status, 200);
    assert.equal(r.corpo.clientes.length, 5, 'até 5 clientes');
    assert.ok(r.corpo.clientes.some((c: any) => c.id === ana.id));
    assert.deepEqual(r.corpo.imoveis.map((i: any) => i.id), [casa.id]);
    // A negociação vem pelo cliente e pelo imóvel que casaram, uma vez só.
    assert.deepEqual(r.corpo.negociacoes.map((n: any) => n.id), [neg.id]);
    const n = r.corpo.negociacoes[0];
    assert.deepEqual(Object.keys(n).sort(), ['codigo', 'contato_id', 'contato_nome', 'estado', 'id', 'imovel_codigo', 'imovel_id', 'imovel_titulo']);
    assert.equal(n.contato_nome, 'Ana Zimmermann');
    assert.equal(n.imovel_titulo, 'Casa no Lago Zimbro');
    // Nenhum valor sai: nem o sigiloso do mandato, nem estimativa, nem os números gravados.
    const texto = JSON.stringify(r.corpo);
    for (const campo of [...CAMPOS_SIGILOSOS, 'teto_estimado_comprador_c', 'batna_estimada_comprador']) assert.ok(!texto.includes(campo), campo);
    for (const valor of ['80000000', '85000000', '90000000', 'alugar', 'outro imóvel']) assert.ok(!texto.includes(valor), valor);

    // Pelo código da negociação, pelo bairro e pelo telefone digitado com máscara.
    assert.deepEqual((await chamar('GET', '/busca?q=NG-0007')).corpo.negociacoes.map((x: any) => x.id), [neg.id]);
    assert.deepEqual((await chamar('GET', '/busca?q=lago%20sul')).corpo.imoveis.map((x: any) => x.id), [casa.id]);
    assert.deepEqual((await chamar('GET', `/busca?q=${encodeURIComponent('(61) 99999-0001')}`)).corpo.clientes.map((x: any) => x.id), [ana.id]);
    assert.deepEqual((await chamar('GET', '/busca?q=ana%40exemplo')).corpo.clientes.map((x: any) => x.id), [ana.id]);
    // Contato anonimizado (LGPD) não volta.
    assert.equal((await chamar('GET', '/busca?q=Zélia')).corpo.clientes.length, 0);
  });
});

test('isolamento A × B: B buscando um termo que só existe em A não recebe nada', async () => {
  const banco = new BancoFalso();
  await semear(banco);
  await comServidor(rotas, B, banco, {}, async (chamar) => {
    for (const q of ['Zimmermann', 'Zimbro', 'NG-0007', 'Lago', '99999-0001', 'ana@exemplo']) {
      const r = await chamar('GET', `/busca?q=${encodeURIComponent(q)}`);
      assert.equal(r.status, 200, q);
      assert.deepEqual([r.corpo.clientes, r.corpo.imoveis, r.corpo.negociacoes], [[], [], []], q);
    }
    // O mesmo código existe nas duas contas: B vê só o dele.
    const r = await chamar('GET', '/busca?q=IM-0001');
    assert.deepEqual(r.corpo.imoveis.map((i: any) => i.titulo), ['Apto Bexiga']);
  });
  // E A não vê o que é de B.
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    const r = await chamar('GET', '/busca?q=Bexiga');
    assert.deepEqual([r.corpo.clientes, r.corpo.imoveis, r.corpo.negociacoes], [[], [], []]);
  });
  // Quem atende várias contas busca só na ativa.
  await comServidor(rotas, ADMIN_A, banco, {}, async (chamar) => {
    const r = await chamar('GET', '/busca?q=Bexiga');
    assert.equal(r.status, 200);
    assert.deepEqual([r.corpo.clientes, r.corpo.imoveis, r.corpo.negociacoes], [[], [], []]);
    assert.equal((await chamar('GET', '/busca?q=Zimmermann')).corpo.clientes.length, 1);
  });
});

test('q curto ou longo devolve 422; só o corretor busca', async () => {
  const banco = new BancoFalso();
  await semear(banco);
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    for (const q of ['', 'a', '%20a%20']) {
      const r = await chamar('GET', `/busca?q=${q}`);
      assert.equal(r.status, 422, `q=${q}`);
      assert.equal(r.corpo.codigo, 'BUSCA_CURTA');
    }
    assert.equal((await chamar('GET', '/busca')).status, 422);
    assert.equal((await chamar('GET', '/busca?q=ab&q=cd')).status, 422, 'q repetido não é texto');
    const longa = await chamar('GET', `/busca?q=${'x'.repeat(101)}`);
    assert.equal(longa.status, 422);
    assert.equal(longa.corpo.codigo, 'BUSCA_LONGA');
    assert.equal((await chamar('GET', `/busca?q=${'x'.repeat(100)}`)).status, 200);
  });
  await comServidor(rotas, NEGOCIADOR, banco, {}, async (chamar) => {
    assert.equal((await chamar('GET', '/busca?q=Ana')).status, 403, 'o negociador não busca na carteira');
  });
  await comServidor(rotas, EQUIPE, banco, {}, async (chamar) => {
    assert.equal((await chamar('GET', '/busca?q=Ana')).status, 403);
  });
});

test('telefone com máscara vira dígitos só para o telefone; o resto busca como foi digitado', () => {
  assert.deepEqual(normalizarTermo('(61) 99999-0001'), { termo: '(61) 99999-0001', telefone: '61999990001' });
  assert.deepEqual(normalizarTermo('+55 61'), { termo: '+55 61', telefone: '5561' });
  assert.deepEqual(normalizarTermo('101-2'), { termo: '101-2', telefone: '1012' });
  assert.deepEqual(normalizarTermo('IM-0001'), { termo: 'IM-0001', telefone: null });
  assert.deepEqual(normalizarTermo(' Ana '), { termo: 'Ana', telefone: null });
  assert.deepEqual(normalizarTermo('+ab'), { termo: '+ab', telefone: null });
  // Termo efetivo curto: null (422), em qualquer forma.
  for (const q of ['', 'a', '+5', '(1', '1 ', '1-', '--', ' + ']) assert.equal(normalizarTermo(q), null, JSON.stringify(q));
});

test('q que só fica curto depois de normalizar ("+5") devolve 422 BUSCA_CURTA; código "101-2" é achado', async () => {
  const banco = new BancoFalso();
  await semear(banco);
  await banco.dados(100).criar('imoveis', { codigo: '101-2', titulo: 'Sala comercial', bairro: 'Asa Norte', situacao: 'ativo' });
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    for (const q of ['+5', '(1', '1-']) {
      const r = await chamar('GET', `/busca?q=${encodeURIComponent(q)}`);
      assert.equal(r.status, 422, q);
      assert.equal(r.corpo.codigo, 'BUSCA_CURTA', q);
    }
    const r = await chamar('GET', `/busca?q=${encodeURIComponent('101-2')}`);
    assert.equal(r.status, 200);
    assert.deepEqual(r.corpo.imoveis.map((i: any) => i.codigo), ['101-2']);
  });
});

test('cortarTermo: corta em BUSCA_MAX sem deixar metade de emoji (o encodeURIComponent não lança)', () => {
  assert.equal(cortarTermo('  Ana  '), 'Ana');
  assert.equal(cortarTermo('x'.repeat(150)), 'x'.repeat(BUSCA_MAX));
  // O 100º caractere é a primeira metade de um emoji: o emoji inteiro sai.
  const meio = 'x'.repeat(BUSCA_MAX - 1) + '😀' + 'y';
  const cortado = cortarTermo(meio);
  assert.equal(cortado, 'x'.repeat(BUSCA_MAX - 1));
  assert.doesNotThrow(() => encodeURIComponent(cortado));
  // Emoji que cabe inteiro fica.
  const inteiro = 'x'.repeat(BUSCA_MAX - 2) + '😀' + 'y';
  assert.equal(cortarTermo(inteiro), 'x'.repeat(BUSCA_MAX - 2) + '😀');
  assert.ok(cortarTermo(inteiro).length <= BUSCA_MAX);
  // Bordas (issue #157): exatamente no limite, um a mais, dois emojis cruzando o limite, alto solto no fim.
  assert.equal(cortarTermo('x'.repeat(BUSCA_MAX)), 'x'.repeat(BUSCA_MAX));
  assert.equal(cortarTermo('x'.repeat(BUSCA_MAX + 1)), 'x'.repeat(BUSCA_MAX));
  const dois = 'x'.repeat(BUSCA_MAX - 3) + '😀😀';
  assert.equal(cortarTermo(dois), 'x'.repeat(BUSCA_MAX - 3) + '😀');
  assert.doesNotThrow(() => encodeURIComponent(cortarTermo(dois)));
  const solto = 'Ana' + '\uD83D';
  assert.equal(cortarTermo(solto), 'Ana');
  assert.doesNotThrow(() => encodeURIComponent(cortarTermo(solto)));
  assert.equal(cortarTermo('   '), '');
});

test('negociação: achada só pelo cliente, só pelo imóvel, e com cliente anonimizado sem o nome', async () => {
  const banco = new BancoFalso();
  const a = banco.dados(100);
  const carla = await a.criar('contatos', { nome: 'Carla Quaresma', papeis: 'comprador' });
  const sala = await a.criar('imoveis', { codigo: 'IM-0100', titulo: 'Sala Tijuco', bairro: 'Asa Norte', situacao: 'ativo' });
  const outro = await a.criar('imoveis', { codigo: 'IM-0101', titulo: 'Loja Centro', bairro: 'Centro', situacao: 'ativo' });
  const davi = await a.criar('contatos', { nome: 'Davi Ribeiro', papeis: 'comprador' });
  const anon = await a.criar('contatos', { nome: 'Zélia Anonimizada', anonimizado_em: new Date().toISOString(), papeis: 'comprador' });
  const pelaCliente = await a.criar('negociacoes', { codigo: 'NG-0100', contato_id: carla.id, imovel_id: outro.id, estado: 'ativa' });
  const peloImovel = await a.criar('negociacoes', { codigo: 'NG-0101', contato_id: davi.id, imovel_id: sala.id, estado: 'ativa' });
  const anonima = await a.criar('negociacoes', { codigo: 'NG-0102', contato_id: anon.id, imovel_id: outro.id, estado: 'ativa' });
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    // "Quaresma" casa só o cliente: vem a negociação dele, não a do imóvel.
    const porCliente = await chamar('GET', '/busca?q=Quaresma');
    assert.deepEqual(porCliente.corpo.imoveis, []);
    assert.deepEqual(porCliente.corpo.negociacoes.map((n: any) => n.id), [pelaCliente.id]);
    // "Tijuco" casa só o imóvel: vem a negociação dele, não a do cliente.
    const porImovel = await chamar('GET', '/busca?q=Tijuco');
    assert.deepEqual(porImovel.corpo.clientes, []);
    assert.deepEqual(porImovel.corpo.negociacoes.map((n: any) => n.id), [peloImovel.id]);
    assert.equal(porImovel.corpo.negociacoes[0].contato_nome, 'Davi Ribeiro');
    // Pelo código, a negociação do cliente anonimizado volta sem o nome dele.
    const r = await chamar('GET', '/busca?q=NG-0102');
    assert.deepEqual(r.corpo.negociacoes.map((n: any) => n.id), [anonima.id]);
    assert.equal(r.corpo.negociacoes[0].contato_nome, null);
    assert.ok(!JSON.stringify(r.corpo).includes('Zélia'));
  });
});

// ---------- Atalhos ----------

const el = (tagName: string, attrs: Record<string, string> = {}, extra: Record<string, unknown> = {}) => ({
  tagName,
  getAttribute: (n: string) => attrs[n] ?? null,
  ...extra,
});
const FORA = [el('DIV'), el('BODY'), el('HTML')];

test('atalhos: cada tecla fora de campo de texto, e nenhuma dentro de input', () => {
  assert.equal(atalhoDe({ key: '/' }, FORA), 'buscar');
  assert.equal(atalhoDe({ key: 'c' }, FORA), 'criar');
  assert.equal(atalhoDe({ key: 'C' }, FORA), 'criar');
  assert.equal(atalhoDe({ key: 'a' }, FORA), 'assistente');
  assert.equal(atalhoDe({ key: 'j' }, FORA), 'proximo');
  assert.equal(atalhoDe({ key: 'k' }, FORA), 'anterior');
  assert.equal(atalhoDe({ key: 'e' }, FORA), 'editar');
  assert.equal(atalhoDe({ key: 'x' }, FORA), null);
  assert.equal(atalhoDe({ key: 'Enter' }, FORA), null);
  // Com modificador, é do navegador ou do sistema.
  for (const mod of ['ctrlKey', 'metaKey', 'altKey', 'isComposing', 'defaultPrevented']) assert.equal(atalhoDe({ key: 'c', [mod]: true }, FORA), null, mod);

  // Dentro de qualquer campo de texto, nenhum dispara: o elemento focado vem primeiro no caminho.
  const campos = [
    el('INPUT', { type: 'text' }),
    el('INPUT', { type: 'checkbox' }),
    el('TEXTAREA'),
    el('SELECT'),
    el('DIV', {}, { isContentEditable: true }),
    el('DIV', { role: 'textbox' }),
    el('DIV', { role: 'combobox' }),
    el('URBI-INPUT'),
    el('URBI-TEXTAREA'),
    el('URBI-REDATOR'),
    el('URBI-CHAT'),
    el('URBI-MODAL'),
    el('URBI-FORMULARIO'),
  ];
  for (const campo of campos) {
    assert.equal(focoEmCampo([campo, ...FORA]), true, campo.tagName);
    for (const key of ['/', 'c', 'a', 'j', 'k', 'e']) assert.equal(atalhoDe({ key }, [campo, ...FORA]), null, `${key} em ${campo.tagName}`);
  }
  // Campo dentro de shadow root: o caminho composto tem o input e, depois, o host.
  assert.equal(atalhoDe({ key: 'j' }, [el('INPUT'), el('DIV'), el('PC-TELA-CLIENTES'), ...FORA]), null);
  // Botão e item de lista não são campo de texto.
  assert.equal(atalhoDe({ key: 'j' }, [el('BUTTON'), el('DIV', { role: 'button' }), ...FORA]), 'proximo');
  // Nós sem tag (o shadow root, a janela) são pulados.
  assert.equal(focoEmCampo([{}, null, undefined, ...FORA]), false);
});

test('J/K: próximo e anterior, sem item vai à ponta, na ponta fica', () => {
  assert.equal(vizinho([4, 7, 9], 7, 1), 9);
  assert.equal(vizinho([4, 7, 9], 7, -1), 4);
  assert.equal(vizinho([4, 7, 9], null, 1), 4);
  assert.equal(vizinho([4, 7, 9], null, -1), 9);
  assert.equal(vizinho([4, 7, 9], 99, 1), 4, 'item fora da lista (filtro mudou): recomeça');
  assert.equal(vizinho([4, 7, 9], 9, 1), null);
  assert.equal(vizinho([4, 7, 9], 4, -1), null);
  assert.equal(vizinho([], null, 1), null);
});

test('opções da busca: tipo à frente, na ordem clientes, imóveis, negociações', () => {
  const op = opcoesDaBusca({
    clientes: [
      { id: 1, nome: 'Ana', telefone: '+5561999990001', email: null },
      { id: 4, nome: 'Bia', telefone: null, email: 'bia@ex.com' },
    ],
    imoveis: [{ id: 2, codigo: 'IM-0001', titulo: null, bairro: 'Lago Sul' }],
    negociacoes: [{ id: 3, codigo: 'NG-0007', contato_nome: null, imovel_codigo: 'IM-0001', imovel_titulo: null }],
  });
  assert.deepEqual(op.map((o) => o.rotulo), ['Cliente · Ana · (61) 99999-0001', 'Cliente · Bia · bia@ex.com', 'Imóvel · IM-0001 · Lago Sul', 'Negociação · NG-0007 · IM-0001']);
  assert.deepEqual(op.map((o) => o.destino), [{ tipo: 'cliente', id: 1 }, { tipo: 'cliente', id: 4 }, { tipo: 'imovel', id: 2 }, { tipo: 'negociacao', id: 3 }]);
  assert.deepEqual(opcoesDaBusca(null), []);
});
