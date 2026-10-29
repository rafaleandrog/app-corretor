import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import schema from '../schema.json';
import { rotas } from '../backend/rotas';
import {
  centavosDeReais,
  conferirValores,
  corpoDoMandato,
  destinoDaProposta,
  diferencaDoPedido,
  filtroNegociacoes,
  FILTROS_NEGOCIACOES,
  linhaDeValidacoes,
  mandatoEmBranco,
  mandatoParaFormulario,
  quemConduz,
  reaisDoCampo,
  rotuloRodada,
  textoDoBloqueio,
} from '../comum/negociacao-tela';
import { validarMandato } from '../comum/negociacao';
import { BancoFalso, comServidor, type Ator, type Unico } from './apoio';

// Telas da negociação (D3, issue #102): P15 (Clientes › Negociações), P16 (mandato em `urbi-modal`), a
// aba Negociação da ficha e o M8 pela moldura. O que se confere aqui: as regras puras da tela, o que as
// rotas entregam a ela (nada sigiloso fora da rota do mandato), a recusa do mandato com recuo acima do
// alvo, o 422 de uma sugestão editada abaixo do recuo virando texto na tela, e o isolamento A × B.

const EM_ANDAMENTO = (schema.tabelas.negociacoes.unicos as unknown[]).find((u) => !Array.isArray(u)) as Exclude<Unico, string>;
const UNICOS: Record<string, Unico[]> = { negociacoes: [EM_ANDAMENTO, 'codigo'], mandatos_negociacao: ['negociacao_id+versao'], playbook_objecoes: ['categoria+origem'], config_negociador: ['chave'] };
const raiz = (f: string) => readFileSync(resolve(process.cwd(), f), 'utf8');

const PEDIDO = 150_000_000;
const ALVO = 145_000_000;
const RECUO = 136_000_000;
const BATNA = 'Manter anunciado por sessenta dias e esperar a proposta do vizinho do terceiro andar';
const MANDATO = {
  preco_pedido_c: PEDIDO,
  alvo_c: ALVO,
  recuo_c: RECUO,
  batna_vendedor: BATNA,
  concessoes: [{ item: 'prazo de entrega de 90 dias', limite: '90 dias', contrapartida: 'entrada de 30%' }],
  validade: '2099-12-31',
  autonomia: 'pergunta_antes',
};

function iaSimulada(respostas: Record<string, unknown>[]) {
  return {
    estadoSlot: async (slot: string) => ({ pedido: slot, efetivo: { slot, origem: 'global' }, backup: null }),
    consultar: async () => {
      const dados = respostas.shift();
      if (!dados) throw new Error('chamada de IA a mais');
      return { dados, modelo: 'teste', tokens_entrada: 1, tokens_saida: 1, duracao_ms: 1 };
    },
  };
}
const eventos = () => ({ publicar: async () => ({ id: 1 }) });

const sugestao = {
  objecao: { categoria: 'preco', trecho: 'Está caro' },
  interesses_identificados: ['entrega rápida'],
  teto_estimado_comprador_c: 139_000_000,
  fonte_estimativa: 'disse que tem 1,39 aprovado no banco',
  movimento: 'contraproposta',
  contraproposta: { valor_c: 146_000_000, condicoes: 'entrega em 90 dias', concessao: 'prazo de entrega de 90 dias', contrapartida: 'entrada de 30%', validade_horas: 48 },
  mensagem: 'Ana, consigo R$ 1.460.000 com entrega em 90 dias e entrada de 30%.',
  passar_ao_corretor: false,
  motivo: null,
  resumo_rodada: 'Cliente pediu 1,40; sugerida 1,46 com prazo.',
};

async function base(banco: BancoFalso, conta: number) {
  const d = banco.dados(conta);
  const contato = await d.criar('contatos', { nome: `Ana ${conta}`, telefone: '+5561988887777', email: `ana${conta}@exemplo.com` });
  const negocio = await d.criar('negocios', { contato_id: contato.id, titulo: 'Compra', pipeline: 'compra', etapa_id: 1, responsavel_id: 1 });
  const imovel = await d.criar('imoveis', { codigo: `IM-${conta}`, titulo: 'Casa 4 quartos', bairro: 'Jardim Botânico', preco_c: PEDIDO });
  return { contato, negocio, imovel };
}

/** Nenhum valor nem nome de campo sigiloso no JSON. */
function semSigilo(rotulo: string, corpo: unknown) {
  const json = JSON.stringify(corpo);
  for (const marca of [String(RECUO), String(ALVO), 'vizinho do terceiro', '"recuo_c"', '"alvo_c"', '"batna_vendedor"']) assert.ok(!json.includes(marca), `${rotulo} trouxe ${marca}`);
}

// ------------------------------------------------------------------------------------------------
// Regras puras da tela

test('lista de Negociações: filtros da URL, diferença do pedido, rodada e quem conduz', () => {
  assert.deepEqual(FILTROS_NEGOCIACOES.map((f) => f.rotulo), ['Todas', 'Aguardando você', 'Negociador', 'Cliente', 'Proprietário', 'Encerradas']);
  assert.equal(filtroNegociacoes(null).id, 'todas');
  assert.equal(filtroNegociacoes('xyz').id, 'todas', 'filtro desconhecido cai em Todas');
  assert.deepEqual(filtroNegociacoes('voce').consulta, { estado: 'aguardando_corretor' });
  assert.deepEqual(filtroNegociacoes('negociador').consulta, { estado: 'ativa,aguardando_cliente,pausada', conduzida_por: 'ia' });
  assert.ok(!filtroNegociacoes('todas').consulta.estado.split(',').some((e) => e === 'ganha' || e === 'perdida'), 'Todas são as em andamento');
  assert.deepEqual(filtroNegociacoes('encerradas').consulta, { estado: 'ganha,perdida' });
  // "R$ 1,32 mi · −9%" (mockup P15): 1.320.000 contra 1.450.000.
  assert.equal(diferencaDoPedido(132_000_000, 145_000_000), '−9%');
  assert.equal(diferencaDoPedido(145_000_000, 145_000_000), '0%');
  assert.equal(diferencaDoPedido(150_000_000, 145_000_000), '+3%');
  assert.equal(diferencaDoPedido(null, 145_000_000), null);
  assert.equal(diferencaDoPedido(132_000_000, null), null, 'sem mandato não há pedido para comparar');
  assert.equal(rotuloRodada(3, 4), 'Rodada 3 de 4');
  assert.equal(rotuloRodada(0, null), 'Rodada 1');
  assert.equal(quemConduz('ia', 'pergunta_antes'), 'Negociador IA · pergunta antes');
  assert.equal(quemConduz('ia'), 'Negociador IA');
  assert.equal(quemConduz('corretor', 'faz_sozinho'), 'Você');
});

test('valor digitado em reais vira centavos; o campo volta a mostrar em reais', () => {
  for (const [texto, c] of [['1.380.000', 138_000_000], ['1380000', 138_000_000], ['R$ 1.380.000,50', 138_000_050], ['920 mil', null], ['', null], ['-5', null], ['1.38', null], ['0', null]] as const) {
    assert.equal(centavosDeReais(texto), c, texto);
  }
  assert.equal(reaisDoCampo(138_000_000), '1.380.000');
  assert.equal(reaisDoCampo(138_000_050), '1.380.000,50');
  assert.equal(reaisDoCampo(null), '');
});

test('mandato (P16): a validação ao vivo recusa recuo > alvo e alvo > pedido, como o backend', () => {
  assert.deepEqual(conferirValores({ pedido_c: PEDIDO, alvo_c: ALVO, recuo_c: RECUO }), { ok: true, texto: '✓ recuo ≤ alvo ≤ pedido' });
  assert.equal(conferirValores({ pedido_c: PEDIDO, alvo_c: ALVO, recuo_c: ALVO + 1 }).ok, false);
  assert.match(conferirValores({ pedido_c: PEDIDO, alvo_c: ALVO, recuo_c: ALVO + 1 }).texto, /recuo não pode ficar acima do alvo/);
  assert.match(conferirValores({ pedido_c: PEDIDO, alvo_c: PEDIDO + 1, recuo_c: RECUO }).texto, /alvo não pode ficar acima do preço pedido/);
  assert.equal(conferirValores({ pedido_c: PEDIDO, alvo_c: null, recuo_c: RECUO }).ok, false);
  // O formulário vira o corpo do PUT que o backend aceita (ida e volta), com o passo em fração.
  const f = mandatoParaFormulario({ ...MANDATO, passo_max_pct: 0.4, rodadas_max: 4, autorizacao_proprietario: null });
  assert.deepEqual([f.pedido, f.alvo, f.recuo, f.passo_pct, f.rodadas], ['1.500.000', '1.450.000', '1.360.000', '40', '4']);
  const corpo = corpoDoMandato({ ...f, concessoes: [...f.concessoes, { item: '', limite: '', contrapartida: '' }] });
  assert.equal((corpo.concessoes as unknown[]).length, 1, 'a linha em branco não vai');
  const v = validarMandato(corpo);
  assert.ok(v.ok, JSON.stringify(v));
  assert.deepEqual([v.ok && v.dados.recuo_c, v.ok && v.dados.passo_max_pct], [RECUO, 0.4]);
  // Recuo acima do alvo no formulário: o backend recusa com o mesmo motivo.
  const ruim = validarMandato(corpoDoMandato({ ...f, recuo: '1.460.000' }));
  assert.equal(!ruim.ok && ruim.codigo, 'RECUO_ACIMA_DO_ALVO');
  // Mandato novo: o pedido vem do anúncio, os padrões de 10.9.2 e 30 dias de validade.
  const novo = mandatoEmBranco(PEDIDO, '2026-10-29');
  assert.deepEqual([novo.pedido, novo.alvo, novo.recuo, novo.passo_pct, novo.rodadas, novo.validade, novo.autonomia], ['1.500.000', '', '', '40', '4', '2026-11-28', 'pergunta_antes']);
});

test('cartão de sugestão: a linha de validações; o 422 do bloqueio vira texto sem número nenhum', () => {
  assert.equal(
    linhaDeValidacoes([{ garantia: 'piso', ok: true }, { garantia: 'passo', ok: true }, { garantia: 'sigilo', ok: false }, { garantia: 'outra', ok: true }]),
    '✓ acima do recuo · ✓ passo menor · ✗ sem revelar o sigilo',
  );
  assert.equal(linhaDeValidacoes(null), '');
  const texto = textoDoBloqueio({ message: 'Esta contraproposta não pode sair como está.', codigo: 'MOVIMENTO_BLOQUEADO', detalhes: ['ABAIXO_DO_RECUO: valor abaixo do ponto de recuo', 'XYZ: outra coisa'] });
  assert.equal(texto, 'Esta contraproposta não pode sair como está.\n✗ valor abaixo do ponto de recuo\n✗ XYZ: outra coisa');
  assert.match(textoDoBloqueio({ detalhes: ['PASSO_ACIMA_DO_LIMITE'] }), /✗ concedeu dentro do passo máximo/);
});

test('Nova proposta: a negociação do mesmo imóvel, senão um negócio livre, senão um negócio novo', () => {
  const negocios = [
    { id: 1, imovel_id: 10, etapa_tipo: 'aberta' },
    { id: 2, imovel_id: null, etapa_tipo: 'aberta' },
    { id: 3, imovel_id: 20, etapa_tipo: 'ganho' },
  ];
  assert.deepEqual(destinoDaProposta(10, negocios, [{ id: 7, negocio_id: 1, imovel_id: 10 }]), { negociacao_id: 7 });
  assert.deepEqual(destinoDaProposta(10, negocios, []), { negocio_id: 1 }, 'o negócio do mesmo imóvel');
  assert.deepEqual(destinoDaProposta(30, negocios, []), { negocio_id: 2 }, 'o negócio sem imóvel');
  // O negócio sem imóvel já negocia outro: um negócio novo (uma negociação em andamento por negócio).
  assert.deepEqual(destinoDaProposta(30, negocios, [{ id: 8, negocio_id: 2, imovel_id: 40 }]), { criar_negocio: true });
  assert.deepEqual(destinoDaProposta(20, negocios, []), { negocio_id: 2 }, 'negócio ganho não recebe proposta');
  assert.deepEqual(destinoDaProposta(10, [], []), { criar_negocio: true });
});

// ------------------------------------------------------------------------------------------------
// O que as rotas entregam à tela

test('P15: lista e negociação sem nada sigiloso; o mandato completo só na rota própria', async () => {
  const banco = new BancoFalso(UNICOS);
  const b = await base(banco, 100);
  const A: Ator = { usuario: 1, conta: 100, papeis: ['corretor'], extras: { eventos: eventos(), ia: iaSimulada([sugestao]) } };
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    const n = (await chamar('POST', '/negociacoes', { negocio_id: b.negocio.id, imovel_id: b.imovel.id })).corpo;
    assert.equal((await chamar('PUT', `/negociacoes/${n.id}/mandato`, MANDATO)).status, 200);
    await chamar('POST', `/negociacoes/${n.id}/propostas`, { direcao: 'comprador', valor_c: 140_000_000, condicoes: 'financiamento aprovado' });
    const s = await chamar('POST', `/negociacoes/${n.id}/sugestao`, { mensagem_cliente: 'Está caro. Faço 1,40.' });
    assert.equal(s.status, 200, JSON.stringify(s.corpo));

    // Lista (esquerda): cliente, imóvel, última oferta × pedido; nenhum valor sigiloso.
    const lista = await chamar('GET', '/negociacoes?estado=ativa,aguardando_cliente,aguardando_corretor,aguardando_proprietario,pausada');
    assert.equal(lista.status, 200);
    const linha = lista.corpo.dados[0];
    assert.deepEqual([linha.contato_nome, linha.imovel_codigo, linha.imovel_titulo, linha.ultima_oferta_c, linha.preco_pedido_c], ['Ana 100', 'IM-100', 'Casa 4 quartos', 140_000_000, PEDIDO]);
    semSigilo('GET /negociacoes', lista.corpo);
    assert.equal((await chamar('GET', '/negociacoes?conduzida_por=ia')).corpo.dados.length, 1);
    assert.equal((await chamar('GET', '/negociacoes?conduzida_por=corretor')).corpo.dados.length, 0);

    // Negociação (centro e direita): a sugestão pendente, a leitura do comprador e a ZOPA só como "existe".
    const det = await chamar('GET', `/negociacoes/${n.id}`);
    assert.equal(det.status, 200);
    semSigilo('GET /negociacoes/:id', det.corpo);
    assert.deepEqual(det.corpo.contato, { id: b.contato.id, nome: 'Ana 100' }, 'sem telefone nem e-mail: a tela não precisa');
    assert.deepEqual(det.corpo.imovel, { id: b.imovel.id, codigo: 'IM-100', titulo: 'Casa 4 quartos', bairro: 'Jardim Botânico', preco_c: PEDIDO });
    assert.equal(det.corpo.sugestao.execucao_id, s.corpo.execucao_id);
    assert.equal(det.corpo.sugestao.resposta.contraproposta.valor_c, 146_000_000);
    assert.equal(det.corpo.sugestao.mensagem_cliente, 'Está caro. Faço 1,40.');
    assert.equal(det.corpo.sugestao.verificacoes.length, 7);
    assert.deepEqual(det.corpo.zopa, { existe: true }, 'teto 1,39 acima do recuo: a faixa existe, sem as pontas');
    assert.equal(det.corpo.teto_estimado_comprador_c, 139_000_000);
    assert.deepEqual(det.corpo.objecoes.map((o: any) => o.categoria), ['preco']);
    assert.equal(det.corpo.mandato.preco_pedido_c, PEDIDO);

    // Só a rota do mandato traz recuo, alvo e BATNA.
    const m = await chamar('GET', `/negociacoes/${n.id}/mandato`);
    assert.deepEqual([m.corpo.vigente.recuo_c, m.corpo.vigente.alvo_c, m.corpo.vigente.batna_vendedor], [RECUO, ALVO, BATNA]);

    // Decidida a sugestão, ela sai do cartão.
    await chamar('POST', `/negociacoes/${n.id}/decisao`, { acao: 'descartar', execucao_id: s.corpo.execucao_id });
    assert.equal((await chamar('GET', `/negociacoes/${n.id}`)).corpo.sugestao, null);
  });
});

test('P16 e o cartão: mandato com recuo acima do alvo é recusado; sugestão editada abaixo do recuo dá 422 com o texto da garantia', async () => {
  const banco = new BancoFalso(UNICOS);
  const b = await base(banco, 100);
  const A: Ator = { usuario: 1, conta: 100, papeis: ['corretor'], extras: { eventos: eventos(), ia: iaSimulada([sugestao]) } };
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    const n = (await chamar('POST', '/negociacoes', { negocio_id: b.negocio.id, imovel_id: b.imovel.id })).corpo;
    const ruim = await chamar('PUT', `/negociacoes/${n.id}/mandato`, { ...MANDATO, recuo_c: ALVO + 1 });
    assert.equal(ruim.status, 422);
    assert.equal(ruim.corpo.codigo, 'RECUO_ACIMA_DO_ALVO');
    assert.equal(banco.linhas('mandatos_negociacao').length, 0, 'nada gravado');
    assert.equal((await chamar('PUT', `/negociacoes/${n.id}/mandato`, MANDATO)).status, 200);
    await chamar('POST', `/negociacoes/${n.id}/propostas`, { direcao: 'comprador', valor_c: 140_000_000 });
    const s = (await chamar('POST', `/negociacoes/${n.id}/sugestao`, { mensagem_cliente: 'Faço 1,40.' })).corpo;
    // O que a tela manda no Editar (`editarSugestao`): o valor digitado abaixo do recuo.
    const abaixo = await chamar('POST', `/negociacoes/${n.id}/decisao`, {
      acao: 'editar',
      execucao_id: s.execucao_id,
      canal: 'portal',
      contraproposta: { valor_c: centavosDeReais('1.350.000'), condicoes: null, concessao: null, contrapartida: null, validade_horas: 48 },
      mensagem: 'Ana, consigo fazer um pouco menos.',
    });
    assert.equal(abaixo.status, 422);
    assert.equal(abaixo.corpo.codigo, 'MOVIMENTO_BLOQUEADO');
    // O alerta da tela: a frase da garantia, sem o recuo (nem o backend o devolve nesse erro).
    const alerta = textoDoBloqueio({ message: abaixo.corpo.mensagem, codigo: abaixo.corpo.codigo, detalhes: abaixo.corpo.detalhes });
    assert.match(alerta, /✗ valor abaixo do ponto de recuo/);
    assert.ok(!alerta.includes('1.360') && !alerta.includes(String(RECUO)) && !JSON.stringify(abaixo.corpo).includes(String(RECUO)));
    assert.equal(banco.linhas('propostas').filter((p) => p.direcao === 'vendedor').length, 0, 'nada enviado');
  });
});

test('isolamento A × B nas telas da negociação: lista, negociação e mandato de outra conta não aparecem', async () => {
  const banco = new BancoFalso(UNICOS);
  const b = await base(banco, 100);
  await base(banco, 200);
  const A: Ator = { usuario: 1, conta: 100, papeis: ['corretor'], extras: { eventos: eventos() } };
  const B: Ator = { usuario: 2, conta: 200, papeis: ['corretor'], extras: { eventos: eventos() } };
  let nid = 0;
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    nid = (await chamar('POST', '/negociacoes', { negocio_id: b.negocio.id, imovel_id: b.imovel.id })).corpo.id;
    await chamar('PUT', `/negociacoes/${nid}/mandato`, MANDATO);
  });
  await comServidor(rotas, B, banco, {}, async (chamar) => {
    assert.deepEqual((await chamar('GET', '/negociacoes')).corpo.dados, []);
    assert.equal((await chamar('GET', `/negociacoes?contato_id=${b.contato.id}`)).corpo.dados.length, 0, 'aba Negociação da ficha');
    for (const rota of [`/negociacoes/${nid}`, `/negociacoes/${nid}/mandato`]) assert.equal((await chamar('GET', rota)).status, 404, rota);
    assert.equal((await chamar('PUT', `/negociacoes/${nid}/mandato`, MANDATO)).status, 404);
  });
});

// ------------------------------------------------------------------------------------------------
// A tela no código

test('a tela busca o mandato só na rota própria, só ao clicar em mostrar, e nada sigiloso vai ao console', () => {
  const telas = ['frontend/telas/negociacoes.ts', 'frontend/telas/mandato.ts'].map((f) => [f, raiz(f)] as const);
  for (const [f, fonte] of telas) {
    assert.doesNotMatch(fonte, /console\.\w+\(/, `${f}: sem console`);
    // Toda chamada que traz o mandato completo é a rota `/mandato`.
    for (const m of fonte.matchAll(/chamarApi\(`([^`]+)`\)/g)) if (/mandato/.test(m[1])) assert.match(m[1], /^\/negociacoes\/\$\{this\.(id|negociacaoId)\}\/mandato$/, f);
  }
  const p15 = telas[0][1];
  // Na P15, o mandato completo só é lido em `mostrarSigilo` (o botão "mostrar"), e o recuo só sai de `sigilo`.
  const leituras = [...p15.matchAll(/\/mandato`/g)].length;
  assert.equal(leituras, 1, 'uma leitura só do mandato na P15');
  assert.match(p15, /async mostrarSigilo\(\) \{[\s\S]*?chamarApi\(`\/negociacoes\/\$\{this\.id\}\/mandato`\)/);
  for (const m of p15.matchAll(/(\w+(?:\.\w+)*)\.(recuo_c|alvo_c|batna_vendedor)\b/g)) assert.match(m[1], /^(s|sigilo|this\.s\.sigilo)$/, `${m[0]} vem do mandato revelado`);
  // A faixa ZOPA é exceção nomeada (lacuna 11.9, pedido 13) e o mandato abre em urbi-modal (gaveta é lacuna).
  assert.match(p15, /Exceção nomeada \(spec 11\.9, pedido ao shell 13\)/);
  assert.match(telas[1][1], /<urbi-modal /);
  // Aceite final só pelo corretor, com confirmação.
  assert.match(p15, /urbiVerso\.confirmar\(\{[\s\S]*?acao: 'aceitar_acordo'/);
});

test('M8 e Hoje: "Precisa de você" abre a negociação na visão Negociações (o endereço das notificações)', () => {
  assert.match(raiz('frontend/telas/inicio.ts'), /\?visao=negociacoes&item=\$\{x\.p\.negociacao_id\}/);
  assert.match(raiz('manifesto.json'), /"rota": "clientes\?visao=negociacoes&item=\{negociacao_id\}"/);
  assert.match(raiz('frontend/telas/clientes.ts'), /\{ id: 'negociacoes', rotulo: 'Negociações' \}/);
});
