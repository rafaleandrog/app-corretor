import { test } from 'node:test';
import assert from 'node:assert/strict';
import manifesto from '../manifesto.json';
import { rotas } from '../backend/rotas';
import { semearObjecoes } from '../backend/semente';
import {
  CAMPOS_SIGILOSOS,
  PLAYBOOK_OBJECOES_PADRAO,
  passoMaximo_c,
  proximoCodigoNegociacao,
  rodadaDaProposta,
  semSigilo,
  validarMandato,
} from '../comum/negociacao';
import { BancoFalso, comServidor, type Ator } from './apoio';

// Negociação (D1, issue #100): isolamento A × B em toda rota nova, sigilo do mandato (recuo, alvo e
// BATNA do vendedor só em GET /negociacoes/:id/mandato), validações e semente do Apêndice D.

const UNICOS = { negociacoes: ['codigo'], mandatos_negociacao: ['negociacao_id+versao'], playbook_objecoes: ['categoria+origem'], config_negociador: ['chave'] };

// Valores sigilosos fáceis de achar em qualquer texto que saia (JSON, CSV, evento).
const RECUO = 87_654_321;
const ALVO = 91_234_567;
const BATNA = 'Proposta-secreta-de-outro-comprador';
const MANDATO = {
  preco_pedido_c: 95_000_000,
  alvo_c: ALVO,
  recuo_c: RECUO,
  batna_vendedor: BATNA,
  concessoes: [{ item: 'prazo de entrega de 90 dias', limite: '90 dias', contrapartida: 'entrada maior' }],
  validade: '2026-12-31',
  autonomia: 'pergunta_antes',
};

function eventosFalsos() {
  const publicados: { tipo: string; payload: Record<string, unknown> }[] = [];
  return { publicados, publicar: async (tipo: string, payload: Record<string, unknown>) => (publicados.push({ tipo, payload }), { id: publicados.length }) };
}

/** Negócio e imóvel de uma conta, gravados direto no banco falso. */
async function base(banco: BancoFalso, conta: number) {
  const d = banco.dados(conta);
  const contato = await d.criar('contatos', { nome: `Cliente ${conta}`, telefone: `+55619${conta}0000` });
  const negocio = await d.criar('negocios', { contato_id: contato.id, titulo: 'Compra apto', pipeline: 'compra', etapa_id: 1, responsavel_id: 1 });
  const imovel = await d.criar('imoveis', { codigo: 'IM-0001', titulo: 'Apto Asa Sul', preco_c: 95_000_000 });
  return { contato, negocio, imovel };
}

const ator = (usuario: number, conta: number, ev: ReturnType<typeof eventosFalsos>): Ator => ({ usuario, conta, papeis: ['corretor'], extras: { eventos: ev } });

/** Nenhum valor sigiloso no texto (JSON de resposta, CSV, payload de evento). */
function semValorSigiloso(texto: string, onde: string) {
  assert.ok(!texto.includes(String(RECUO)), `${onde}: recuo vazou`);
  assert.ok(!texto.includes(String(ALVO)), `${onde}: alvo vazou`);
  assert.ok(!texto.includes(BATNA), `${onde}: BATNA vazou`);
  for (const campo of CAMPOS_SIGILOSOS) assert.ok(!texto.includes(`"${campo}"`), `${onde}: campo ${campo} presente`);
}

test('semSigilo tira recuo, alvo e BATNA em qualquer nível, sem mexer no resto', () => {
  const entrada = {
    id: 1,
    recuo_c: 1,
    mandato: { preco_pedido_c: 10, alvo_c: 2, batna_vendedor: 'x', concessoes: [{ item: 'a', recuo_c: 3 }] },
    lista: [{ alvo_c: 4, valor_c: 5 }],
    quando: new Date(0),
    nada: null,
  };
  const limpo = semSigilo(entrada);
  assert.deepEqual(limpo, { id: 1, mandato: { preco_pedido_c: 10, concessoes: [{ item: 'a' }] }, lista: [{ valor_c: 5 }], quando: new Date(0), nada: null });
  assert.equal(entrada.recuo_c, 1, 'não altera o original');
  assert.equal(semSigilo(null), null);
  assert.equal(semSigilo('texto'), 'texto');
});

test('mandato: recuo ≤ alvo ≤ pedido, passo e rodadas, faz sozinho exige autorização', () => {
  assert.equal(validarMandato(MANDATO).ok, true);
  const recuoAlto = validarMandato({ ...MANDATO, recuo_c: ALVO + 1 });
  assert.ok(!recuoAlto.ok && recuoAlto.codigo === 'RECUO_ACIMA_DO_ALVO');
  const alvoAlto = validarMandato({ ...MANDATO, alvo_c: MANDATO.preco_pedido_c + 1 });
  assert.ok(!alvoAlto.ok && alvoAlto.codigo === 'MANDATO_INVALIDO' && alvoAlto.motivo === 'alvo_acima_do_pedido');
  for (const passo of [0, -0.1, 1.5, 'x']) assert.equal(validarMandato({ ...MANDATO, passo_max_pct: passo }).ok, false, `passo ${passo}`);
  assert.equal(validarMandato({ ...MANDATO, passo_max_pct: 1 }).ok, true);
  assert.equal(validarMandato({ ...MANDATO, rodadas_max: 0 }).ok, false);
  const padrao = validarMandato(MANDATO);
  assert.ok(padrao.ok && padrao.dados.passo_max_pct === 0.4 && padrao.dados.rodadas_max === 4, 'padrões 0,40 e 4');
  const semContrapartida = validarMandato({ ...MANDATO, concessoes: [{ item: 'prazo' }] });
  assert.ok(!semContrapartida.ok && semContrapartida.codigo === 'MANDATO_INVALIDO');
  const sozinho = validarMandato({ ...MANDATO, autonomia: 'faz_sozinho' });
  assert.ok(!sozinho.ok && sozinho.codigo === 'AUTORIZACAO_PROPRIETARIO_AUSENTE');
  const autorizado = validarMandato({ ...MANDATO, autonomia: 'faz_sozinho', autorizacao_proprietario: { tipo: 'mensagem', data: '2026-10-27' } });
  assert.ok(autorizado.ok && autorizado.dados.autorizacao_proprietario?.arquivo_id === null);
  assert.equal(validarMandato({ ...MANDATO, autonomia: 'faz_sozinho', autorizacao_proprietario: { tipo: 'anexo', data: '2026-10-27' } }).ok, false, 'anexo sem arquivo');
});

test('código NG-nnnn, rodada calculada e passo máximo sobre o intervalo restante', () => {
  assert.equal(proximoCodigoNegociacao([]), 'NG-0001');
  assert.equal(proximoCodigoNegociacao(['NG-0009', 'NG-0002', 'X-1']), 'NG-0010');
  assert.equal(rodadaDaProposta([], 'vendedor'), 1);
  assert.equal(rodadaDaProposta([], 'comprador'), 1);
  assert.equal(rodadaDaProposta(['comprador'], 'vendedor'), 1);
  assert.equal(rodadaDaProposta(['comprador', 'vendedor'], 'comprador'), 2);
  assert.equal(rodadaDaProposta(['vendedor', 'comprador', 'vendedor', 'comprador'], 'proprietario'), 2);
  assert.equal(passoMaximo_c(100_000, 80_000, 0.4), 8_000);
  assert.equal(passoMaximo_c(92_000, 80_000, 0.4), 4_800);
  assert.equal(passoMaximo_c(80_000, 80_000, 0.4), 0);
});

test('fluxo do corretor: cria, mandato com versão, propostas com rodada; o sigilo só sai na rota do mandato', async () => {
  const banco = new BancoFalso(UNICOS);
  const ev = eventosFalsos();
  const { negocio, imovel, contato } = await base(banco, 100);
  await comServidor(rotas, ator(1, 100, ev), banco, {}, async (chamar) => {
    const criada = await chamar('POST', '/negociacoes', { negocio_id: negocio.id, imovel_id: imovel.id });
    assert.equal(criada.status, 201, JSON.stringify(criada.corpo));
    assert.equal(criada.corpo.codigo, 'NG-0001');
    assert.equal(criada.corpo.contato_id, contato.id);
    assert.equal(criada.corpo.conduzida_por, 'ia', 'padrão: Negociador IA (D-94)');
    const nid = criada.corpo.id;
    assert.equal((await chamar('POST', '/negociacoes', { negocio_id: negocio.id, imovel_id: imovel.id })).status, 409, 'uma em andamento por negócio');

    const m1 = await chamar('PUT', `/negociacoes/${nid}/mandato`, MANDATO);
    assert.equal(m1.status, 200, JSON.stringify(m1.corpo));
    assert.equal(m1.corpo.versao, 1);
    assert.equal(m1.corpo.recuo_c, RECUO);
    const m2 = await chamar('PUT', `/negociacoes/${nid}/mandato`, { ...MANDATO, rodadas_max: 3 });
    assert.equal(m2.corpo.versao, 2, 'a versão sobe a cada alteração');

    const mandato = await chamar('GET', `/negociacoes/${nid}/mandato`);
    assert.equal(mandato.status, 200);
    assert.equal(mandato.corpo.vigente.id, m2.corpo.id);
    assert.equal(mandato.corpo.vigente.recuo_c, RECUO, 'o corretor vê o recuo na rota do mandato');
    assert.equal(mandato.corpo.vigente.batna_vendedor, BATNA);
    assert.equal(mandato.corpo.vigente.passo_max_pct, 0.4);
    assert.deepEqual(mandato.corpo.versoes.map((v: any) => v.versao), [2, 1], 'histórico das versões');

    const oferta = await chamar('POST', `/negociacoes/${nid}/propostas`, { direcao: 'comprador', valor_c: 85_000_000, condicoes: 'entrada de 30%' });
    assert.equal(oferta.status, 201, JSON.stringify(oferta.corpo));
    assert.deepEqual([oferta.corpo.rodada, oferta.corpo.autor_tipo, oferta.corpo.canal], [1, 'cliente', 'registro']);
    const contra = await chamar('POST', `/negociacoes/${nid}/propostas`, { direcao: 'vendedor', valor_c: 93_000_000, concessao: 'prazo de entrega de 90 dias', contrapartida: 'entrada maior' });
    assert.deepEqual([contra.corpo.rodada, contra.corpo.autor_tipo], [1, 'corretor']);
    const segunda = await chamar('POST', `/negociacoes/${nid}/propostas`, { direcao: 'comprador', valor_c: 88_000_000 });
    assert.equal(segunda.corpo.rodada, 2);
    assert.equal((await chamar('POST', `/negociacoes/${nid}/propostas`, { direcao: 'vendedor', valor_c: 90_000_000, canal: 'portal' })).status, 422, 'envio pelo portal chega no D2');
    assert.equal((await chamar('POST', `/negociacoes/${nid}/propostas`, { direcao: 'x', valor_c: 1 })).status, 422);
    assert.equal((await chamar('GET', `/negociacoes/${nid}/propostas`)).corpo.dados.length, 3);

    const detalhe = await chamar('GET', `/negociacoes/${nid}`);
    assert.equal(detalhe.status, 200);
    assert.equal(detalhe.corpo.rodadas, 2, 'rodadas materializadas');
    assert.equal(detalhe.corpo.mandato.preco_pedido_c, MANDATO.preco_pedido_c, 'o resumo do mandato vem sem sigilo');
    assert.equal(detalhe.corpo.propostas.length, 3);
    semValorSigiloso(JSON.stringify(detalhe.corpo), 'GET /negociacoes/:id');

    const lista = await chamar('GET', '/negociacoes?estado=ativa');
    assert.equal(lista.corpo.dados.length, 1);
    assert.equal(lista.corpo.dados[0].ultima_oferta_c, 88_000_000);
    assert.equal(lista.corpo.dados[0].preco_pedido_c, MANDATO.preco_pedido_c);
    semValorSigiloso(JSON.stringify(lista.corpo), 'GET /negociacoes');
    semValorSigiloso(JSON.stringify((await chamar('GET', `/negociacoes/${nid}/propostas`)).corpo), 'GET /negociacoes/:id/propostas');

    // Encerrar pede valor final (ganha) ou motivo (perdida); encerrada não aceita mais nada.
    assert.equal((await chamar('PATCH', `/negociacoes/${nid}`, { estado: 'ganha' })).status, 422);
    assert.equal((await chamar('PATCH', `/negociacoes/${nid}`, { conduzida_por: 'humano' })).status, 422, 'negociador humano chega no D7');
    const ganha = await chamar('PATCH', `/negociacoes/${nid}`, { estado: 'ganha', valor_final_c: 90_000_000 });
    assert.equal(ganha.status, 200, JSON.stringify(ganha.corpo));
    assert.ok(ganha.corpo.encerrada_em);
    assert.equal((await chamar('PATCH', `/negociacoes/${nid}`, { estado: 'ativa' })).status, 409);
    assert.equal((await chamar('PUT', `/negociacoes/${nid}/mandato`, MANDATO)).status, 409);
    assert.equal((await chamar('POST', `/negociacoes/${nid}/propostas`, { direcao: 'comprador', valor_c: 1 })).status, 409);
    // Encerrada, o negócio pode abrir outra negociação.
    assert.equal((await chamar('POST', '/negociacoes', { negocio_id: negocio.id, imovel_id: imovel.id })).corpo.codigo, 'NG-0002');
  });

  // Eventos: os declarados, com exatamente os campos do manifesto, e nenhum valor do mandato.
  const tipos = ev.publicados.map((e) => e.tipo);
  assert.deepEqual(tipos, [
    'negociacao_iniciada',
    'mandato_alterado',
    'mandato_alterado',
    'proposta_recebida',
    'proposta_registrada',
    'proposta_recebida',
    'negociacao_encerrada',
    'negociacao_iniciada',
  ]);
  const eventos = manifesto.eventos as Record<string, { campos: string[] }>;
  for (const e of ev.publicados) {
    assert.deepEqual(Object.keys(e.payload).sort(), [...eventos[e.tipo].campos].sort(), `campos de ${e.tipo}`);
    for (const v of Object.values(e.payload)) assert.equal(typeof v, 'number', `${e.tipo}: payload só com ids`);
  }
  semValorSigiloso(JSON.stringify(ev.publicados), 'eventos publicados');
});

test('mandato inválido devolve 422 com o código e o motivo; nada é gravado', async () => {
  const banco = new BancoFalso(UNICOS);
  const ev = eventosFalsos();
  const { negocio, imovel } = await base(banco, 100);
  await comServidor(rotas, ator(1, 100, ev), banco, {}, async (chamar) => {
    const nid = (await chamar('POST', '/negociacoes', { negocio_id: negocio.id, imovel_id: imovel.id })).corpo.id;
    const recuo = await chamar('PUT', `/negociacoes/${nid}/mandato`, { ...MANDATO, recuo_c: ALVO + 1 });
    assert.equal(recuo.status, 422);
    assert.equal(recuo.corpo.codigo, 'RECUO_ACIMA_DO_ALVO');
    const alvo = await chamar('PUT', `/negociacoes/${nid}/mandato`, { ...MANDATO, alvo_c: MANDATO.preco_pedido_c + 1 });
    assert.equal(alvo.status, 422);
    assert.deepEqual([alvo.corpo.codigo, alvo.corpo.motivo], ['MANDATO_INVALIDO', 'alvo_acima_do_pedido']);
    const sozinho = await chamar('PUT', `/negociacoes/${nid}/mandato`, { ...MANDATO, autonomia: 'faz_sozinho' });
    assert.equal(sozinho.status, 422);
    assert.equal(sozinho.corpo.codigo, 'AUTORIZACAO_PROPRIETARIO_AUSENTE');
    const passo = await chamar('PUT', `/negociacoes/${nid}/mandato`, { ...MANDATO, passo_max_pct: 2, rodadas_max: 0 });
    assert.equal(passo.status, 422);
    assert.equal(passo.corpo.detalhes.length, 2);
    const ok = await chamar('PUT', `/negociacoes/${nid}/mandato`, { ...MANDATO, autonomia: 'faz_sozinho', autorizacao_proprietario: { tipo: 'mensagem', data: '2026-10-27' } });
    assert.equal(ok.status, 200, 'com a autorização, faz sozinho é aceito');
  });
  assert.equal(banco.linhas('mandatos_negociacao').length, 1);
  assert.deepEqual(ev.publicados.filter((e) => e.tipo === 'mandato_alterado').length, 1, 'só o mandato válido publica');
});

test('isolamento A × B: lista, detalhe, mandato e propostas de outra conta respondem 404', async () => {
  const banco = new BancoFalso(UNICOS);
  const ev = eventosFalsos();
  const a = await base(banco, 100);
  const b = await base(banco, 200);
  let nid = 0;
  await comServidor(rotas, ator(1, 100, ev), banco, {}, async (chamar) => {
    nid = (await chamar('POST', '/negociacoes', { negocio_id: a.negocio.id, imovel_id: a.imovel.id })).corpo.id;
    await chamar('PUT', `/negociacoes/${nid}/mandato`, MANDATO);
    await chamar('POST', `/negociacoes/${nid}/propostas`, { direcao: 'comprador', valor_c: 85_000_000 });
    await chamar('PUT', '/negociador/config', { estilo: 'firme' });
    await chamar('PUT', '/negociador/objecoes', { categoria: 'preco', pergunta_exploracao: 'P?', resposta_base: 'R da conta A', proximo_passo: 'N' });
  });
  const antes = JSON.stringify([...banco.tabelas]);
  await comServidor(rotas, ator(2, 200, ev), banco, {}, async (chamar) => {
    assert.equal((await chamar('GET', '/negociacoes')).corpo.dados.length, 0, 'lista de B vazia');
    assert.equal((await chamar('GET', `/negociacoes/${nid}`)).status, 404);
    assert.equal((await chamar('PATCH', `/negociacoes/${nid}`, { estado: 'pausada' })).status, 404);
    assert.equal((await chamar('GET', `/negociacoes/${nid}/mandato`)).status, 404);
    assert.equal((await chamar('PUT', `/negociacoes/${nid}/mandato`, MANDATO)).status, 404);
    assert.equal((await chamar('GET', `/negociacoes/${nid}/propostas`)).status, 404);
    assert.equal((await chamar('POST', `/negociacoes/${nid}/propostas`, { direcao: 'comprador', valor_c: 1 })).status, 404);
    // Negócio ou imóvel de A não servem para B abrir negociação.
    assert.equal((await chamar('POST', '/negociacoes', { negocio_id: a.negocio.id, imovel_id: b.imovel.id })).status, 404);
    assert.equal((await chamar('POST', '/negociacoes', { negocio_id: b.negocio.id, imovel_id: a.imovel.id })).status, 404);
    // Config e playbook de B são os padrões, não os de A.
    const cfg = (await chamar('GET', '/negociador/config')).corpo;
    assert.equal(cfg.estilo, 'cooperativo');
    assert.equal(cfg.padrao, true);
    const preco = (await chamar('GET', '/negociador/objecoes')).corpo.dados.find((o: any) => o.categoria === 'preco');
    assert.equal(preco.minha, null);
  });
  assert.equal(JSON.stringify([...banco.tabelas]), antes, 'B não gravou nada');
  // Papel: sem `corretor`, nenhuma rota de negociação abre.
  const semPapel: Ator = { usuario: 7, conta: 100, papeis: [] };
  await comServidor(rotas, semPapel, banco, {}, async (chamar) => {
    for (const [m, c] of [['GET', '/negociacoes'], ['GET', `/negociacoes/${nid}/mandato`], ['GET', '/negociador/config'], ['GET', '/negociador/objecoes']]) {
      assert.equal((await chamar(m, c)).status, 403, `${m} ${c}`);
    }
  });
});

test('o mandato não aparece nas exportações nem no portal do contato', async () => {
  const banco = new BancoFalso(UNICOS);
  const ev = eventosFalsos();
  const { negocio, imovel, contato } = await base(banco, 100);
  await comServidor(rotas, ator(1, 100, ev), banco, {}, async (chamar) => {
    const nid = (await chamar('POST', '/negociacoes', { negocio_id: negocio.id, imovel_id: imovel.id })).corpo.id;
    await chamar('PUT', `/negociacoes/${nid}/mandato`, MANDATO);
    const csv = await chamar('GET', '/contatos/exportar');
    assert.equal(csv.status, 200);
    assert.ok(typeof csv.corpo === 'string' && csv.corpo.includes('Cliente 100'), 'o CSV saiu com o contato');
    semValorSigiloso(csv.corpo, 'exportação CSV de contatos');
    const ficha = await chamar('GET', `/contatos/${contato.id}`);
    assert.equal(ficha.status, 200);
    semValorSigiloso(JSON.stringify(ficha.corpo), 'ficha do contato');
  });
});

test('config do Negociador: GET não grava; PUT valida, cria na primeira escrita e sobe a versão', async () => {
  const banco = new BancoFalso(UNICOS);
  const ev = eventosFalsos();
  await comServidor(rotas, ator(1, 100, ev), banco, {}, async (chamar) => {
    const padrao = await chamar('GET', '/negociador/config');
    assert.equal(padrao.status, 200);
    assert.deepEqual([padrao.corpo.conduz_padrao, padrao.corpo.estilo, padrao.corpo.ligado, padrao.corpo.versao], ['ia', 'cooperativo', true, 0]);
    assert.equal(banco.linhas('config_negociador').length, 0, 'GET não grava (armadilha do #32)');
    assert.equal((await chamar('PUT', '/negociador/config', { instrucoes_corretor: 'x'.repeat(4001) })).status, 422);
    assert.equal((await chamar('PUT', '/negociador/config', { estilo: 'agressivo' })).status, 422);
    assert.equal((await chamar('PUT', '/negociador/config', { gatilhos: { inventado: true } })).status, 422);
    assert.equal((await chamar('PUT', '/negociador/config', { conduz_padrao: 'humano' })).status, 422, 'sem negociador humano escolhido');
    const v1 = await chamar('PUT', '/negociador/config', { estilo: 'consultivo', instrucoes_corretor: 'Seja breve.', gatilhos: { reacao_preco: false } });
    assert.equal(v1.status, 200, JSON.stringify(v1.corpo));
    assert.deepEqual([v1.corpo.estilo, v1.corpo.versao, v1.corpo.padrao, v1.corpo.conduz_padrao], ['consultivo', 1, false, 'ia']);
    assert.deepEqual(v1.corpo.gatilhos, { etapa_proposta: true, pedido_desconto: true, reacao_preco: false, oferta_registrada: true });
    const v2 = await chamar('PUT', '/negociador/config', { ligado: false });
    assert.deepEqual([v2.corpo.ligado, v2.corpo.estilo, v2.corpo.versao], [false, 'consultivo', 2]);
  });
  assert.equal(banco.linhas('config_negociador').length, 1);
});

test('Negociador desligado: a negociação nova é conduzida pelo corretor', async () => {
  const banco = new BancoFalso(UNICOS);
  const ev = eventosFalsos();
  const { negocio, imovel } = await base(banco, 100);
  await comServidor(rotas, ator(1, 100, ev), banco, {}, async (chamar) => {
    await chamar('PUT', '/negociador/config', { ligado: false });
    assert.equal((await chamar('POST', '/negociacoes', { negocio_id: negocio.id, imovel_id: imovel.id })).corpo.conduzida_por, 'corretor');
  });
});

test('semente do Apêndice D: 10 categorias por conta, idempotente, sem tocar a resposta do corretor', async () => {
  const banco = new BancoFalso(UNICOS);
  const contas = [{ id: 100, nome: 'Conta A' }, { id: 200, nome: 'Conta B (demo)' }];
  assert.equal(await semearObjecoes(banco.ctxSistema(contas)), 20);
  const porConta = (c: number) => banco.linhas('playbook_objecoes').filter((l) => l.conta_id === c && l.origem === 'padrao');
  assert.equal(porConta(100).length, 10);
  assert.equal(porConta(200).length, 10);
  assert.deepEqual(porConta(100).map((l) => l.categoria).sort(), PLAYBOOK_OBJECOES_PADRAO.map((p) => p.categoria).sort());
  const foto = JSON.stringify(banco.linhas('playbook_objecoes'));
  assert.equal(await semearObjecoes(banco.ctxSistema(contas)), 0, 'segunda rodada não cria nada');
  assert.equal(JSON.stringify(banco.linhas('playbook_objecoes')), foto, 'as mesmas 10 linhas por conta');

  // O corretor edita a resposta (linha própria) e volta ao padrão; a semente não mexe em nada disso.
  const ev = eventosFalsos();
  await comServidor(rotas, ator(1, 100, ev), banco, {}, async (chamar) => {
    const lista = (await chamar('GET', '/negociador/objecoes')).corpo.dados;
    assert.equal(lista.length, 10);
    assert.ok(lista.every((o: any) => o.usando === 'padrao'));
    assert.equal((await chamar('PUT', '/negociador/objecoes', { categoria: 'preco', resposta_base: '' })).status, 422);
    assert.equal((await chamar('PUT', '/negociador/objecoes', { categoria: 'inventada', usar_padrao: true })).status, 422);
    const minha = await chamar('PUT', '/negociador/objecoes', { categoria: 'preco', pergunta_exploracao: 'Quanto pensou?', resposta_base: 'R$/m² da quadra.', proximo_passo: 'Pedir a proposta.' });
    assert.equal(minha.status, 200, JSON.stringify(minha.corpo));
    assert.equal(minha.corpo.usando, 'corretor');
    assert.equal(minha.corpo.minha.resposta_base, 'R$/m² da quadra.');
    assert.equal(minha.corpo.padrao.resposta_base, PLAYBOOK_OBJECOES_PADRAO[0].resposta_base);
    await semearObjecoes(banco.ctxSistema(contas));
    const editada = await chamar('PUT', '/negociador/objecoes', { categoria: 'preco', pergunta_exploracao: 'P2', resposta_base: 'R2', proximo_passo: 'N2' });
    assert.equal(editada.corpo.minha.resposta_base, 'R2', 'edita a mesma linha');
    const volta = await chamar('PUT', '/negociador/objecoes', { categoria: 'preco', usar_padrao: true });
    assert.equal(volta.corpo.usando, 'padrao');
    assert.equal(volta.corpo.minha, null);
  });
  assert.equal(porConta(100).length, 10, 'padrões intactos');
  assert.equal(banco.linhas('playbook_objecoes').filter((l) => l.origem === 'corretor' && !l.removido_em).length, 0);
});

test('conta nova (sem semente ainda): a rota devolve o padrão da constante sem gravar', async () => {
  const banco = new BancoFalso(UNICOS);
  const ev = eventosFalsos();
  await comServidor(rotas, ator(1, 100, ev), banco, {}, async (chamar) => {
    const lista = (await chamar('GET', '/negociador/objecoes')).corpo.dados;
    assert.equal(lista.length, 10);
    assert.equal(lista[1].padrao.pergunta_exploracao, PLAYBOOK_OBJECOES_PADRAO[1].pergunta_exploracao);
  });
  assert.equal(banco.linhas('playbook_objecoes').length, 0);
});
