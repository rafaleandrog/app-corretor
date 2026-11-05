import { test } from 'node:test';
import assert from 'node:assert/strict';
import schema from '../schema.json';
import { rotas, reagir, webhooks } from '../backend/rotas';
import { limparLimites } from '../backend/publico';
import { criarNegociacao } from '../backend/negociacao';
import { proximoCodigoNegociacao } from '../comum/negociacao';
import { BancoFalso, comServidor, type Ator, type Unico } from './apoio';

// Sobras da revisão do F3 (issue #149): robustez dos gatilhos do Negociador. Atomicidade do que nasce
// com a negociação pela etapa Proposta; nível efetivo do negociador padrão; corrida na criação sem
// depender do `code` 23505 que a `transaction()` não promete; dedupe da mensagem sob entregas
// simultâneas; negócio que já nasce na Proposta; e os testes que faltavam ("faz sozinho" a partir de
// mensagem, outro cliente da mesma conta, listener com shell, falha que não desfaz a etapa).
// Isolamento A × B e as garantias de 10.9.7 conferidas em cada caminho.

const EM_ANDAMENTO = (schema.tabelas.negociacoes.unicos as unknown[]).find((u) => !Array.isArray(u)) as Exclude<Unico, string>;
const UNICOS: Record<string, Unico[]> = {
  negociacoes: [EM_ANDAMENTO, 'codigo'],
  mandatos_negociacao: ['negociacao_id+versao'],
  playbook_objecoes: ['categoria+origem'],
  config_negociador: ['chave'],
  vitrine_publica: ['tipo+chave'],
};

const PEDIDO = 150_000_000;
const ALVO = 145_123_456;
const RECUO = 136_654_321;
const BATNA = 'Manter-anunciado-e-esperar-o-vizinho';
const MANDATO = {
  preco_pedido_c: PEDIDO,
  alvo_c: ALVO,
  recuo_c: RECUO,
  batna_vendedor: BATNA,
  concessoes: [{ item: 'prazo de entrega de 90 dias', limite: '90 dias', contrapartida: 'entrada de 30%' }],
  validade: '2099-12-31',
  autonomia: 'pergunta_antes',
};
const SOZINHO = { ...MANDATO, autonomia: 'faz_sozinho', autorizacao_proprietario: { tipo: 'mensagem', data: '2026-10-20' } };

function eventosFalsos() {
  const publicados: { tipo: string; payload: Record<string, unknown>; opcoes?: any }[] = [];
  return { publicados, publicar: async (tipo: string, payload: Record<string, unknown>, opcoes?: any) => (publicados.push({ tipo, payload, opcoes }), { id: publicados.length }) };
}

function notificacoesFalsas() {
  const enviadas: { usuario: number; mensagem: string; opts?: any }[] = [];
  return { enviadas, notificar: async (usuario: number, mensagem: string, opts?: any) => (enviadas.push({ usuario, mensagem, opts }), { ok: true }), notificarAdmins: async () => {} };
}

function iaSimulada(respostas: Record<string, unknown>[]) {
  const chamadas: any[] = [];
  return {
    chamadas,
    estadoSlot: async (slot: string) => ({ pedido: slot, efetivo: { slot, origem: 'global' }, backup: null }),
    consultar: async (o: unknown) => {
      chamadas.push(o);
      const dados = respostas.shift();
      if (!dados) throw new Error('chamada de IA a mais');
      return { dados, modelo: 'teste', tokens_entrada: 1, tokens_saida: 1, duracao_ms: 1 };
    },
  };
}

const resposta = (extra: Record<string, unknown>) => ({
  objecao: { categoria: 'preco', trecho: 'desconto' },
  interesses_identificados: [],
  teto_estimado_comprador_c: null,
  fonte_estimativa: null,
  movimento: 'responder_objecao',
  contraproposta: null,
  mensagem: 'O que pesa mais para você: o valor total, a entrada ou o prazo?',
  passar_ao_corretor: false,
  motivo: null,
  resumo_rodada: null,
  ...extra,
});
const contraproposta = (valor_c: number, mensagem: string) =>
  resposta({ movimento: 'contraproposta', contraproposta: { valor_c, condicoes: null, concessao: null, contrapartida: null, validade_horas: 48 }, mensagem });

/** Dublê de `req.shell`/`ctx.shell`: 5 e 7 aceitaram o convite da conta 100, 6 o da 200. */
function shellFalso(o: { papeis?: number[]; semAcesso?: number[]; nivelQueFalha?: boolean } = {}) {
  const papeis = o.papeis ?? [5, 6];
  const convites = [
    { id: 2, intencao: 'admitir_existente', credencial: 'neg5@a.com', status: 'resgatado', usuarioId: 5, contaId: 100, contaAlvo: 100 },
    { id: 3, intencao: 'admitir_existente', credencial: 'neg7@a.com', status: 'resgatado', usuarioId: 7, contaId: 100, contaAlvo: 100 },
    { id: 4, intencao: 'admitir_existente', credencial: 'neg6@b.com', status: 'resgatado', usuarioId: 6, contaId: 200, contaAlvo: 200 },
  ];
  return {
    listarUsuariosPorRole: async (role: string) => (role === 'negociador' ? papeis : []),
    nivelEfetivoUsuario: async (uid: number) => {
      if (o.nivelQueFalha) throw new Error('shell fora do ar');
      return (o.semAcesso ?? []).includes(uid) ? 'nenhuma' : 'escrita';
    },
    externos: {
      convidar: async () => ({ conviteId: 99, vigenteAte: new Date('2099-01-01') }),
      listarConvites: async (f: { contaAlvo?: number; status?: string } = {}) => {
        const lista = convites
          .filter((c) => f.contaAlvo === undefined || (c.contaAlvo ?? c.contaId) === f.contaAlvo)
          .filter((c) => !f.status || c.status === f.status)
          .map((c) => ({ ...c, appId: 'portal_corretor', vigenteAte: new Date('2099-01-01'), criadoEm: new Date('2026-10-01') }));
        return { convites: lista, total: lista.length, limite: 200, deslocamento: 0 };
      },
      revogarConvite: async ({ conviteId }: { conviteId: number }) => ({ conviteId }),
    },
  };
}

/** O mesmo shell sem os convites (o listener pode não tê-los): só o papel e o nível efetivo. */
const semConvites = (s: ReturnType<typeof shellFalso>) => ({ listarUsuariosPorRole: s.listarUsuariosPorRole, nivelEfetivoUsuario: s.nivelEfetivoUsuario });

const corretor = (usuario: number, conta: number, extras: Record<string, unknown> = {}): Ator => ({ usuario, conta, papeis: ['corretor'], extras });

/** Uma conta com as etapas do funil de compra, um cliente, um imóvel e um negócio na etapa Visitou. */
async function base(banco: BancoFalso, conta: number, o: { imovel?: boolean } = {}) {
  const d = banco.dados(conta);
  const visitou = await d.criar('etapas_funil', { pipeline: 'compra', nome: 'Visitou', tipo: 'aberta', ordem: 4, ativa: true, marco: 'visitou', probabilidade: 0.5 });
  const proposta = await d.criar('etapas_funil', { pipeline: 'compra', nome: 'Proposta', tipo: 'aberta', ordem: 5, ativa: true, marco: 'proposta', probabilidade: 0.7 });
  const contato = await d.criar('contatos', { nome: `Ana Secreta ${conta}`, telefone: `+55619${conta}77777`, responsavel_id: 1 });
  const imovel = await d.criar('imoveis', { codigo: `IM-${conta}`, titulo: 'Apto Asa Sul', preco_c: PEDIDO });
  const negocio = await d.criar('negocios', {
    contato_id: contato.id, titulo: 'Compra apto', pipeline: 'compra', etapa_id: visitou.id, responsavel_id: 1, imovel_id: o.imovel === false ? null : imovel.id,
  });
  return { visitou, proposta, contato, imovel, negocio };
}

async function selecaoDe(banco: BancoFalso, conta: number, b: Awaited<ReturnType<typeof base>>) {
  const d = banco.dados(conta);
  const selecao = await d.criar('selecoes', { contato_id: b.contato.id, titulo: 'Para você', expira_em: new Date(Date.now() + 86400e3).toISOString() });
  await d.criar('selecao_itens', { selecao_id: selecao.id, imovel_id: b.imovel.id, ordem: 0 });
  return selecao;
}

const ctxListener = (banco: BancoFalso, extras: Record<string, unknown> = {}) => ({ ...banco.ctxSistema([{ id: 100, nome: 'A' }, { id: 200, nome: 'B' }]), ...extras });

/** O webhook do portal (mensagem); devolve o que ele publicou, sem entregar ao listener. */
async function publicarMensagem(contexto: Record<string, unknown>, corpo: Record<string, unknown>) {
  const publicados: { tipo: string; payload: any; opcoes: any }[] = [];
  const res: any = { status: () => res, json: () => res };
  const req: any = { body: corpo, headers: {}, ip: `10.9.${Math.floor(Math.random() * 200)}.1`, wh: { webhook: 'acao_cliente', modo: 'recorrente', ingresso_id: 1, contexto, contador_usos: 0, criado_por: 1 }, eventos: { publicar: async (tipo: string, payload: any, opcoes: any) => publicados.push({ tipo, payload, opcoes }) } };
  await webhooks.acao_cliente(req, res);
  return publicados;
}

async function mensagemDoPortal(ctx: any, contexto: Record<string, unknown>, corpo: Record<string, unknown>) {
  const publicados = await publicarMensagem(contexto, corpo);
  for (const p of publicados) await reagir.acao_cliente_recebida({ payload: p.payload, conta_id: p.opcoes.conta_id }, ctx);
  return publicados;
}

/** Nada do mandato sigiloso (recuo, alvo, BATNA) num texto que sai ao cliente ou ao barramento. */
function semSigiloso(texto: string, onde: string) {
  for (const v of [String(RECUO), String(ALVO), '1.366.543', '1.451.234', BATNA]) assert.ok(!texto.includes(v), `${onde} sem ${v}`);
}

// --- Atomicidade e falhas do gatilho da etapa Proposta ------------------------------------------------

test('etapa Proposta: falha ao abrir a negociação não desfaz a mudança de etapa nem deixa nada pela metade', async () => {
  for (const onde of ['negociacoes', 'atividades'] as const) {
    const banco = new BancoFalso(UNICOS);
    const a = await base(banco, 100);
    const original = banco.dados.bind(banco);
    banco.dados = (conta: number | null, global = false) => {
      const h = original(conta, global);
      const criar = h.criar;
      h.criar = async (tabela: string, d: Record<string, unknown>) => {
        if (tabela === onde && (tabela === 'negociacoes' || /defina o mandato/.test(String(d.titulo)))) throw new Error('fora do ar');
        return criar(tabela, d);
      };
      return h;
    };
    await comServidor(rotas, corretor(1, 100), banco, shellFalso(), async (chamar) => {
      const r = await chamar('PATCH', `/negocios/${a.negocio.id}`, { etapa_id: a.proposta.id });
      assert.equal(r.status, 200, `${onde}: ${JSON.stringify(r.corpo)}`);
      assert.equal(r.corpo.etapa_id, a.proposta.id, `${onde}: a etapa mudou`);
      assert.equal(r.corpo.negociador_entrou, undefined, onde);
    });
    assert.equal(banco.linhas('negocios').find((n) => n.id === a.negocio.id)!.etapa_id, a.proposta.id, `${onde}: gravada`);
    // A tarefa do mandato e a negociação nascem juntas ou nenhuma nasce.
    assert.equal(banco.linhas('negociacoes').length, 0, `${onde}: nenhuma negociação sem a tarefa do mandato`);
    assert.equal(banco.linhas('atividades').filter((t) => /defina o mandato/.test(t.titulo)).length, 0, onde);
  }
});

test('etapa Proposta: falha depois do commit (evento, aviso) não esconde a negociação aberta da tela', async () => {
  const banco = new BancoFalso(UNICOS);
  const a = await base(banco, 100);
  const quebrados = {
    eventos: { publicar: async () => { throw new Error('barramento fora'); } },
    notificacoes: { notificar: async () => { throw new Error('inbox fora'); }, notificarAdmins: async () => {} },
  };
  await comServidor(rotas, corretor(1, 100, quebrados), banco, shellFalso(), async (chamar) => {
    assert.equal((await chamar('PUT', '/negociador/config', { negociador_padrao_id: 5, conduz_padrao: 'humano' })).status, 200);
    const r = await chamar('PATCH', `/negocios/${a.negocio.id}`, { etapa_id: a.proposta.id });
    assert.equal(r.status, 200);
    assert.deepEqual([r.corpo.negociador_entrou?.conduzida_por, typeof r.corpo.negociador_entrou?.codigo], ['humano', 'string']);
  });
  assert.equal(banco.linhas('negociacoes').length, 1);
  assert.equal(banco.linhas('atribuicoes_negociacao').length, 1);
  assert.equal(banco.linhas('atividades').filter((t) => /defina o mandato/.test(t.titulo)).length, 1, 'a tarefa do mandato nasceu junto');
});

test('negócio que já nasce na etapa Proposta: o gatilho vale como na mudança de etapa; sem imóvel ou de outra conta, nada', async () => {
  const banco = new BancoFalso(UNICOS);
  const ev = eventosFalsos();
  const a = await base(banco, 100);
  const b = await base(banco, 200);
  // O funil de A começa na Proposta (a etapa anterior foi desativada em Ajustes › Funil).
  banco.linhas('etapas_funil').find((e) => e.id === a.visitou.id)!.ativa = false;
  await comServidor(rotas, corretor(1, 100, { eventos: ev }), banco, shellFalso(), async (chamar) => {
    const semImovel = await chamar('POST', '/negocios', { contato_id: a.contato.id, pipeline: 'compra' });
    assert.equal(semImovel.status, 201, JSON.stringify(semImovel.corpo));
    assert.equal(semImovel.corpo.negociador_entrou, undefined);
    const r = await chamar('POST', '/negocios', { contato_id: a.contato.id, pipeline: 'compra', imovel_id: a.imovel.id });
    assert.equal(r.status, 201, JSON.stringify(r.corpo));
    assert.equal(r.corpo.etapa_id, a.proposta.id);
    assert.equal(r.corpo.negociador_entrou.conduzida_por, 'ia');
    const ns = banco.linhas('negociacoes');
    assert.deepEqual(ns.map((n) => [n.conta_id, n.negocio_id, n.imovel_id]), [[100, r.corpo.id, a.imovel.id]]);
    assert.equal(r.corpo.negociador_entrou.negociacao_id, ns[0].id);
    assert.deepEqual(ev.publicados.find((p) => p.tipo === 'negociacao_iniciada')?.payload, { negociacao_id: ns[0].id, negocio_id: r.corpo.id });
    // O imóvel de B não é de A: 422, nada nasce.
    assert.equal((await chamar('POST', '/negocios', { contato_id: a.contato.id, pipeline: 'compra', imovel_id: b.imovel.id })).status, 422);
  });
  // B tem o funil completo: o negócio novo nasce em Visitou e o Negociador não entra.
  await comServidor(rotas, corretor(2, 200), banco, shellFalso(), async (chamar) => {
    const r = await chamar('POST', '/negocios', { contato_id: b.contato.id, pipeline: 'compra', imovel_id: b.imovel.id });
    assert.deepEqual([r.corpo.etapa_id, r.corpo.negociador_entrou], [b.visitou.id, undefined]);
  });
  assert.deepEqual(banco.linhas('negociacoes').map((n) => n.conta_id), [100]);
});

// --- Corrida na criação, sem depender do `code` do erro ----------------------------------------------

/**
 * `req.dados` da conta 100 cuja `transaction()` desfaz e repassa o erro SEM o `code` (o contrato só
 * promete o ROLLBACK), e que deixa `antesDeGravar` agir na primeira leitura dos códigos, entre a
 * conferência e a escrita: é ali que a outra tela grava ao mesmo tempo.
 */
function dadosEmCorrida(banco: BancoFalso, antesDeGravar: (d: any, codigos: string[]) => Promise<void>) {
  const d = banco.dados(100);
  const listar = d.listar;
  let primeira = true;
  d.listar = async (tabela: string, op: any = {}) => {
    const r = await listar(tabela, op);
    if (primeira && tabela === 'negociacoes' && op.filtros?.['codigo[busca]']) {
      primeira = false;
      await antesDeGravar(banco.dados(100), r.dados.map((n: any) => n.codigo));
    }
    return r;
  };
  const transaction = d.transaction;
  d.transaction = async (fn: (trx: any) => Promise<unknown>) => {
    try {
      return await transaction(fn);
    } catch (e) {
      throw new Error(`falhou: ${(e as Error).message}`);
    }
  };
  return d;
}

test('corrida: outra tela abre a negociação do mesmo negócio entre a conferência e a escrita; o erro sem code vira "existente"', async () => {
  const banco = new BancoFalso(UNICOS);
  const a = await base(banco, 100);
  const outra = { id: 0 };
  const dados = dadosEmCorrida(banco, async (d, codigos) => {
    outra.id = (await d.criar('negociacoes', { codigo: proximoCodigoNegociacao(codigos), negocio_id: a.negocio.id, imovel_id: a.imovel.id, contato_id: a.contato.id, estado: 'ativa', conduzida_por: 'ia', rodadas: 0 })).id;
  });
  const r = await criarNegociacao(dados, { negocio: a.negocio, imovelId: a.imovel.id, conducao: { conduzida_por: 'humano', negociador_usuario_id: 5 }, atribuidaPor: 1, tentativas: 5 });
  assert.ok('existente' in r, JSON.stringify(r));
  assert.equal(r.existente.id, outra.id);
  assert.equal(banco.linhas('negociacoes').length, 1);
  assert.equal(banco.linhas('atribuicoes_negociacao').length, 0, 'a atribuição da que perdeu a corrida foi desfeita');
});

test('corrida: o código tomado por outra negociação ao mesmo tempo faz tentar o próximo; falha de outra natureza sobe', async () => {
  const banco = new BancoFalso(UNICOS);
  const a = await base(banco, 100);
  const outroNegocio = await banco.dados(100).criar('negocios', { contato_id: a.contato.id, titulo: 'Outro', pipeline: 'compra', etapa_id: a.visitou.id, responsavel_id: 1, imovel_id: a.imovel.id });
  const dados = dadosEmCorrida(banco, async (d, codigos) => {
    await d.criar('negociacoes', { codigo: proximoCodigoNegociacao(codigos), negocio_id: outroNegocio.id, imovel_id: a.imovel.id, contato_id: a.contato.id, estado: 'ativa', conduzida_por: 'ia', rodadas: 0 });
  });
  const r = await criarNegociacao(dados, { negocio: a.negocio, imovelId: a.imovel.id, conducao: { conduzida_por: 'humano', negociador_usuario_id: 5 }, atribuidaPor: 1, tentativas: 5 });
  assert.ok('negociacao' in r, JSON.stringify(r));
  assert.deepEqual(banco.linhas('negociacoes').map((n) => n.codigo).sort(), ['NG-0001', 'NG-0002']);
  assert.deepEqual(banco.linhas('atribuicoes_negociacao').map((x) => x.negociacao_id), [r.negociacao.id]);

  // Uma falha que não é de único (a atribuição não grava) não vira "existente" nem repete: sobe, sem nada gravado.
  const banco2 = new BancoFalso(UNICOS);
  const b = await base(banco2, 100);
  const d2 = dadosEmCorrida(banco2, async () => {});
  const criar = d2.criar;
  d2.criar = async (tabela: string, v: Record<string, unknown>) => {
    if (tabela === 'atribuicoes_negociacao') throw new Error('fora do ar');
    return criar(tabela, v);
  };
  await assert.rejects(criarNegociacao(d2, { negocio: b.negocio, imovelId: b.imovel.id, conducao: { conduzida_por: 'humano', negociador_usuario_id: 5 }, atribuidaPor: 1, tentativas: 5 }), /fora do ar/);
  assert.equal(banco2.linhas('negociacoes').length, 0);
});

test('corrida pela rota: duas telas abrem a negociação do mesmo negócio ao mesmo tempo; uma nasce, a outra recebe 409', async () => {
  const banco = new BancoFalso(UNICOS);
  const a = await base(banco, 100);
  await comServidor(rotas, corretor(1, 100), banco, shellFalso(), async (chamar) => {
    assert.equal((await chamar('PUT', '/negociador/config', { negociador_padrao_id: 5, conduz_padrao: 'humano' })).status, 200);
    const [r1, r2] = await Promise.all([
      chamar('POST', '/negociacoes', { negocio_id: a.negocio.id, imovel_id: a.imovel.id }),
      chamar('POST', '/negociacoes', { negocio_id: a.negocio.id, imovel_id: a.imovel.id }),
    ]);
    assert.deepEqual([r1.status, r2.status].sort(), [201, 409], JSON.stringify([r1.corpo, r2.corpo]));
  });
  assert.equal(banco.linhas('negociacoes').length, 1);
  assert.deepEqual(banco.linhas('atribuicoes_negociacao').map((x) => x.negociacao_id), [banco.linhas('negociacoes')[0].id]);
});

// --- Nível efetivo do negociador padrão ----------------------------------------------------------------

test('negociador padrão sem acesso ao app (nível "nenhuma") ou sem como conferir o nível: não é escolhido nem recebe', async () => {
  const banco = new BancoFalso(UNICOS);
  const avisos = notificacoesFalsas();
  const a = await base(banco, 100);
  await comServidor(rotas, corretor(1, 100), banco, shellFalso({ semAcesso: [5] }), async (chamar) => {
    const lista = await chamar('GET', '/negociador/negociadores');
    assert.equal(lista.corpo.dados.find((n: any) => n.usuario_id === 5).tem_papel, false, 'aparece como "falta o papel"');
    assert.equal((await chamar('PUT', '/negociador/config', { negociador_padrao_id: 5 })).corpo.codigo, 'NEGOCIADOR_SEM_PAPEL');
    assert.equal((await chamar('POST', '/negociador/atribuicoes', { negociacao_id: 999, usuario_id: 5 })).status, 404);
  });
  await comServidor(rotas, corretor(1, 100), banco, shellFalso({ nivelQueFalha: true }), async (chamar) => {
    assert.equal((await chamar('PUT', '/negociador/config', { negociador_padrao_id: 5 })).corpo.codigo, 'NEGOCIADOR_SEM_PAPEL', 'conferência que falha: não');
  });
  await comServidor(rotas, corretor(1, 100), banco, shellFalso(), async (chamar) => {
    assert.equal((await chamar('PUT', '/negociador/config', { negociador_padrao_id: 5, conduz_padrao: 'humano' })).status, 200);
  });
  // Depois de escolhida, perde o acesso: a negociação nova nasce com a IA, sem atribuição nem aviso.
  await comServidor(rotas, corretor(1, 100, { notificacoes: avisos }), banco, shellFalso({ semAcesso: [5] }), async (chamar) => {
    const n = await chamar('POST', '/negociacoes', { negocio_id: a.negocio.id, imovel_id: a.imovel.id });
    assert.deepEqual([n.status, n.corpo.conduzida_por, n.corpo.negociador_usuario_id ?? null], [201, 'ia', null]);
  });
  assert.equal(banco.linhas('atribuicoes_negociacao').length, 0);
  assert.equal(avisos.enviadas.length, 0);
});

test('listener com shell: o padrão humano é conferido no gatilho do cliente (com papel e acesso → a pessoa; sem papel ou sem acesso → a IA)', async () => {
  for (const caso of [
    { nome: 'pronto', shell: shellFalso(), esperado: ['humano', 5], avisos: [5] },
    { nome: 'sem papel', shell: shellFalso({ papeis: [6] }), esperado: ['ia', null], avisos: [] },
    { nome: 'sem acesso', shell: shellFalso({ semAcesso: [5] }), esperado: ['ia', null], avisos: [] },
    // Sem os convites (issue #157): o papel e o nível efetivo ainda valem; sem como conferir o nível, a IA.
    { nome: 'sem convites, pronto', shell: semConvites(shellFalso()), esperado: ['humano', 5], avisos: [5] },
    { nome: 'sem convites, sem acesso', shell: semConvites(shellFalso({ semAcesso: [5] })), esperado: ['ia', null], avisos: [] },
    { nome: 'sem convites, sem papel', shell: semConvites(shellFalso({ papeis: [6] })), esperado: ['ia', null], avisos: [] },
    { nome: 'sem convites, nível que falha', shell: semConvites(shellFalso({ nivelQueFalha: true })), esperado: ['ia', null], avisos: [] },
    { nome: 'sem o helper de nível', shell: { listarUsuariosPorRole: shellFalso().listarUsuariosPorRole }, esperado: ['ia', null], avisos: [] },
    { nome: 'sem shell', shell: undefined, esperado: ['ia', null], avisos: [] },
  ]) {
    const banco = new BancoFalso(UNICOS);
    const a = await base(banco, 100);
    await base(banco, 200);
    const sa = await selecaoDe(banco, 100, a);
    await comServidor(rotas, corretor(1, 100), banco, shellFalso(), async (chamar) => {
      assert.equal((await chamar('PUT', '/negociador/config', { negociador_padrao_id: 5, conduz_padrao: 'humano' })).status, 200);
    });
    const avisos = notificacoesFalsas();
    const ctx = ctxListener(banco, { eventos: eventosFalsos(), notificacoes: avisos, shell: caso.shell });
    await reagir.reacao_recebida({ payload: { selecao_id: sa.id, imovel_codigo: a.imovel.codigo, reacao: 'conversar_preco', comentario: null }, conta_id: 100 }, ctx);
    const ns = banco.linhas('negociacoes');
    assert.deepEqual(ns.map((n) => [n.conta_id, n.conduzida_por, n.negociador_usuario_id ?? null]), [[100, ...caso.esperado]], caso.nome);
    assert.equal(banco.linhas('atribuicoes_negociacao').length, caso.esperado[0] === 'humano' ? 1 : 0, caso.nome);
    assert.deepEqual(avisos.enviadas.map((x) => x.usuario), caso.avisos, caso.nome);
  }
});

// --- Mensagem do portal ----------------------------------------------------------------------------------

test('mensagem entregue duas vezes ao mesmo tempo: o motor roda uma vez só', async () => {
  limparLimites();
  const banco = new BancoFalso(UNICOS);
  const a = await base(banco, 100);
  await banco.dados(100).criar('acessos_cliente', { contato_id: a.contato.id, revogado_em: null });
  let nid = 0;
  await comServidor(rotas, corretor(1, 100), banco, shellFalso(), async (chamar) => {
    nid = (await chamar('POST', '/negociacoes', { negocio_id: a.negocio.id, imovel_id: a.imovel.id })).corpo.id;
    assert.equal((await chamar('PUT', `/negociacoes/${nid}/mandato`, MANDATO)).status, 200);
  });
  const ia = iaSimulada([resposta({}), resposta({})]);
  const ctx = ctxListener(banco, { eventos: eventosFalsos(), ia });
  const [p] = await publicarMensagem({ conta_id: 100, contato_id: a.contato.id }, { tipo: 'mensagem', negociacao: nid, texto: 'Tem desconto à vista?' });
  await Promise.all([1, 2, 3].map(() => reagir.acao_cliente_recebida({ payload: p.payload, conta_id: 100 }, ctx)));
  assert.equal(ia.chamadas.length, 1, 'uma chamada de IA');
  assert.equal(banco.linhas('negociador_execucoes').length, 1);
  // A marca é o hash da mensagem, nunca o texto.
  const n = banco.linhas('negociacoes').find((x) => x.id === nid)!;
  assert.match(String(n.motor_mensagem_hash), /^[0-9a-f]{64}$/);
  assert.ok(!JSON.stringify(n).includes('desconto à vista'));
  // Outra mensagem com fala de preço roda de novo.
  await reagir.acao_cliente_recebida({ payload: { ...p.payload, texto: 'Achei caro, faz por menos?' }, conta_id: 100 }, ctx);
  assert.equal(ia.chamadas.length, 2);
  // A marca é interna: nenhuma rota da negociação a devolve (issue #157).
  assert.ok(banco.linhas('negociacoes').find((x) => x.id === nid)!.motor_mensagem_hash);
  await comServidor(rotas, corretor(1, 100), banco, shellFalso(), async (chamar) => {
    const respostas = [
      await chamar('GET', '/negociacoes'),
      await chamar('GET', `/negociacoes/${nid}`),
      await chamar('PATCH', `/negociacoes/${nid}`, { fonte_estimativa: 'conversa' }),
      await chamar('POST', `/negociacoes/${nid}/assumir`, {}),
      await chamar('GET', `/busca?q=NG-`),
    ];
    for (const r of respostas) {
      assert.ok(r.status < 300, `${r.status} ${JSON.stringify(r.corpo)}`);
      assert.ok(!JSON.stringify(r.corpo).includes('motor_mensagem'), JSON.stringify(r.corpo));
    }
  });
});

test('IA falha na mensagem com fala de preço: a marca é desfeita e a mesma mensagem, entregue de novo, roda (issue #157)', async () => {
  for (const caso of ['falha', 'erro_qualquer'] as const) {
    limparLimites();
    const banco = new BancoFalso(UNICOS);
    const a = await base(banco, 100);
    await banco.dados(100).criar('acessos_cliente', { contato_id: a.contato.id, revogado_em: null });
    let nid = 0;
    await comServidor(rotas, corretor(1, 100), banco, shellFalso(), async (chamar) => {
      nid = (await chamar('POST', '/negociacoes', { negocio_id: a.negocio.id, imovel_id: a.imovel.id })).corpo.id;
      assert.equal((await chamar('PUT', `/negociacoes/${nid}/mandato`, MANDATO)).status, 200);
    });
    let falhar = true;
    const ia = iaSimulada([resposta({})]);
    const consultar = ia.consultar;
    ia.consultar = async (o: unknown) => {
      if (falhar) {
        ia.chamadas.push(o);
        throw caso === 'falha' ? Object.assign(new Error('modelo fora do ar'), { codigo: 'IA_INDISPONIVEL' }) : new Error('erro inesperado');
      }
      return consultar(o);
    };
    const ctx = ctxListener(banco, { eventos: eventosFalsos(), ia });
    const [p] = await publicarMensagem({ conta_id: 100, contato_id: a.contato.id }, { tipo: 'mensagem', negociacao: nid, texto: 'Tem desconto à vista?' });
    await reagir.acao_cliente_recebida({ payload: p.payload, conta_id: 100 }, ctx);
    assert.equal(ia.chamadas.length, 1, caso);
    assert.equal(banco.linhas('negociador_execucoes').length, 0, `${caso}: nada decidido`);
    const n = banco.linhas('negociacoes').find((x) => x.id === nid)!;
    assert.equal(n.motor_mensagem_hash ?? null, null, `${caso}: marca desfeita`);
    // Entregue de novo (dentro dos 10 min), agora com a IA de volta: o motor roda e decide.
    falhar = false;
    await reagir.acao_cliente_recebida({ payload: p.payload, conta_id: 100 }, ctx);
    assert.equal(ia.chamadas.length, 2, caso);
    assert.equal(banco.linhas('negociador_execucoes').length, 1, caso);
    // E uma terceira entrega da mesma mensagem não roda: a marca agora fica.
    await reagir.acao_cliente_recebida({ payload: p.payload, conta_id: 100 }, ctx);
    assert.equal(ia.chamadas.length, 2, `${caso}: idempotente depois de decidir`);
  }
});

test('A × B na marca da mensagem: a mesma frase nas duas contas roda nas duas; a falha em B desfaz só a marca de B (issue #157)', async () => {
  limparLimites();
  const banco = new BancoFalso(UNICOS);
  const nids: Record<number, number> = {};
  const contatos: Record<number, number> = {};
  for (const [conta, usuario] of [[100, 1], [200, 2]] as const) {
    const b = await base(banco, conta);
    contatos[conta] = b.contato.id;
    await banco.dados(conta).criar('acessos_cliente', { contato_id: b.contato.id, revogado_em: null });
    await comServidor(rotas, corretor(usuario, conta), banco, shellFalso(), async (chamar) => {
      nids[conta] = (await chamar('POST', '/negociacoes', { negocio_id: b.negocio.id, imovel_id: b.imovel.id })).corpo.id;
      assert.equal((await chamar('PUT', `/negociacoes/${nids[conta]}/mandato`, MANDATO)).status, 200);
    });
  }
  // A IA responde à primeira chamada (A) e falha na segunda (B).
  const ia = iaSimulada([resposta({})]);
  const consultar = ia.consultar;
  ia.consultar = async (o: any) => {
    if (ia.chamadas.length >= 1) {
      ia.chamadas.push(o);
      throw Object.assign(new Error('fora do ar'), { codigo: 'IA_INDISPONIVEL' });
    }
    return consultar(o);
  };
  const ctx = ctxListener(banco, { eventos: eventosFalsos(), ia });
  const texto = 'Tem desconto à vista?';
  const [pa] = await publicarMensagem({ conta_id: 100, contato_id: contatos[100] }, { tipo: 'mensagem', negociacao: nids[100], texto });
  const [pb] = await publicarMensagem({ conta_id: 200, contato_id: contatos[200] }, { tipo: 'mensagem', negociacao: nids[200], texto });
  await reagir.acao_cliente_recebida({ payload: pa.payload, conta_id: 100 }, ctx);
  await reagir.acao_cliente_recebida({ payload: pb.payload, conta_id: 200 }, ctx);
  assert.equal(ia.chamadas.length, 2, 'a mesma frase roda nas duas contas');
  const marca = (conta: number) => banco.linhas('negociacoes').find((n) => n.id === nids[conta])!.motor_mensagem_hash ?? null;
  assert.match(String(marca(100)), /^[0-9a-f]{64}$/, 'A decidiu: a marca fica');
  assert.equal(marca(200), null, 'B falhou: só a marca de B sai');
  assert.deepEqual(banco.linhas('negociador_execucoes').map((e) => e.conta_id), [100]);
  // A entrega repetida em A não roda; a de B, com a IA de volta, roda — e nada cruza de conta.
  const ia2 = iaSimulada([resposta({})]);
  const ctx2 = ctxListener(banco, { eventos: eventosFalsos(), ia: ia2 });
  await reagir.acao_cliente_recebida({ payload: pa.payload, conta_id: 100 }, ctx2);
  assert.equal(ia2.chamadas.length, 0, 'A: idempotente');
  await reagir.acao_cliente_recebida({ payload: pb.payload, conta_id: 200 }, ctx2);
  assert.equal(ia2.chamadas.length, 1, 'B: roda de novo');
  assert.deepEqual(banco.linhas('negociador_execucoes').map((e) => [e.conta_id, e.negociacao_id]), [[100, nids[100]], [200, nids[200]]]);
  // A entrega de B indicando a negociação de A (conta trocada no payload) não mexe na marca de A.
  const antes = marca(100);
  await reagir.acao_cliente_recebida({ payload: { ...pb.payload, texto: 'Outra frase de preço, faz desconto?' }, conta_id: 100 }, ctx2);
  assert.equal(marca(100), antes);
});

test('"faz sozinho" a partir da mensagem: a contraproposta dentro do mandato sai pelo portal; abaixo do recuo, nada sai; o acordo final nunca', async () => {
  limparLimites();
  const banco = new BancoFalso(UNICOS);
  const ev = eventosFalsos();
  const a = await base(banco, 100);
  await banco.dados(100).criar('acessos_cliente', { contato_id: a.contato.id, revogado_em: null });
  let nid = 0;
  await comServidor(rotas, corretor(1, 100), banco, shellFalso(), async (chamar) => {
    nid = (await chamar('POST', '/negociacoes', { negocio_id: a.negocio.id, imovel_id: a.imovel.id })).corpo.id;
    assert.equal((await chamar('PUT', `/negociacoes/${nid}/mandato`, SOZINHO)).status, 200);
    assert.equal((await chamar('POST', `/negociacoes/${nid}/propostas`, { direcao: 'comprador', valor_c: 140_000_000 })).status, 201);
  });
  const ia = iaSimulada([contraproposta(146_000_000, 'Ana, posso levar R$ 1.460.000.'), contraproposta(135_000_000, 'Faço R$ 1.350.000, o mínimo é 1.366.543.')]);
  const ctx = ctxListener(banco, { eventos: ev, ia });
  const contexto = { conta_id: 100, contato_id: a.contato.id };
  await mensagemDoPortal(ctx, contexto, { tipo: 'mensagem', negociacao: nid, texto: 'Tem desconto à vista?' });
  assert.equal(ia.chamadas.length, 1);
  const vendedor = () => banco.linhas('propostas').filter((p) => p.negociacao_id === nid && p.direcao === 'vendedor');
  assert.deepEqual(vendedor().map((p) => [p.valor_c, p.autor_tipo, p.canal, p.estado]), [[146_000_000, 'negociador_ia', 'portal', 'enviada']]);
  const ex = banco.linhas('negociador_execucoes');
  assert.deepEqual(ex.map((e) => e.decisao), ['automatica']);
  semSigiloso(String(ex[0].mensagem_enviada), 'a mensagem enviada sozinha');
  assert.equal(banco.linhas('negociacoes').find((n) => n.id === nid)!.estado, 'aguardando_cliente');

  // Abaixo do recuo: bloqueado, nada sai, e a conversa passa ao corretor.
  await mensagemDoPortal(ctx, contexto, { tipo: 'mensagem', negociacao: nid, texto: 'Achei caro, faz por menos?' });
  assert.equal(ia.chamadas.length, 2);
  assert.equal(vendedor().length, 1, 'nada abaixo do recuo sai');
  const ultima = banco.linhas('negociador_execucoes').at(-1)!;
  assert.equal(ultima.decisao, 'passagem');
  assert.match(String(ultima.bloqueado_por), /ABAIXO_DO_RECUO/);
  semSigiloso(JSON.stringify(ultima.saida ?? {}), 'a saída guardada');
  // O acordo final nunca é do Negociador: nada aceito, nada levado ao proprietário.
  const n = banco.linhas('negociacoes').find((x) => x.id === nid)!;
  assert.ok(!['ganha', 'aguardando_proprietario'].includes(n.estado), n.estado);
  assert.ok(!banco.linhas('propostas').some((p) => p.estado === 'aceita'));
  semSigiloso(JSON.stringify(ev.publicados), 'os eventos');
  for (const p of ev.publicados) for (const v of Object.values(p.payload)) assert.ok(v === null || typeof v === 'number', `${p.tipo}: só ids`);
});

test('"faz sozinho" pela rota /sugestao: a contraproposta dentro do mandato sai pelo portal, de verdade; eventos só com ids (issue #157)', async () => {
  limparLimites();
  const banco = new BancoFalso(UNICOS);
  const ev = eventosFalsos();
  const a = await base(banco, 100);
  await banco.dados(100).criar('acessos_cliente', { contato_id: a.contato.id, revogado_em: null });
  const ia = iaSimulada([contraproposta(146_000_000, 'Ana Secreta, posso levar R$ 1.460.000.'), contraproposta(135_000_000, 'Faço R$ 1.350.000.')]);
  await comServidor(rotas, corretor(1, 100, { eventos: ev, ia }), banco, shellFalso(), async (chamar) => {
    const nid = (await chamar('POST', '/negociacoes', { negocio_id: a.negocio.id, imovel_id: a.imovel.id })).corpo.id;
    assert.equal((await chamar('PUT', `/negociacoes/${nid}/mandato`, SOZINHO)).status, 200);
    assert.equal((await chamar('POST', `/negociacoes/${nid}/propostas`, { direcao: 'comprador', valor_c: 140_000_000 })).status, 201);
    const r = await chamar('POST', `/negociacoes/${nid}/sugestao`, { mensagem_cliente: 'Tem desconto à vista? Meu telefone é +5561910077777', canal: 'portal' });
    assert.equal(r.status, 200, JSON.stringify(r.corpo));
    // Executou: a proposta do vendedor existe, enviada pelo portal, pelo Negociador IA.
    assert.ok(r.corpo.enviada, 'a resposta traz a proposta enviada');
    const vendedor = banco.linhas('propostas').filter((p) => p.negociacao_id === nid && p.direcao === 'vendedor');
    assert.deepEqual(vendedor.map((p) => [p.valor_c, p.autor_tipo, p.canal, p.estado]), [[146_000_000, 'negociador_ia', 'portal', 'enviada']]);
    assert.deepEqual(banco.linhas('negociador_execucoes').map((e) => e.decisao), ['automatica']);
    // O texto que saiu é o montado pelo código (sem o texto do modelo nem o nome que ele escreveu).
    assert.ok(r.corpo.mensagem_enviada && !String(r.corpo.mensagem_enviada).includes('Secreta'), r.corpo.mensagem_enviada);
    semSigiloso(JSON.stringify(r.corpo), 'a resposta da rota');
    assert.equal(banco.linhas('negociacoes').find((n) => n.id === nid)!.estado, 'aguardando_cliente');
    // Abaixo do recuo, pela mesma rota: nada sai.
    const b = await chamar('POST', `/negociacoes/${nid}/sugestao`, { mensagem_cliente: 'Faz por menos?', canal: 'portal' });
    assert.equal(b.status, 200);
    assert.equal(b.corpo.enviada ?? null, null);
    assert.equal(banco.linhas('propostas').filter((p) => p.negociacao_id === nid && p.direcao === 'vendedor').length, 1);
  });
  assert.ok(ev.publicados.some((p) => p.tipo === 'contraproposta_enviada'), 'contraproposta_enviada publicada');
  semSigiloso(JSON.stringify(ev.publicados), 'os eventos');
  for (const p of ev.publicados) {
    assert.ok(!JSON.stringify(p.payload).includes('Secreta') && !JSON.stringify(p.payload).includes('5561910077777'), `${p.tipo}: sem dado pessoal`);
  }
});

test('pedido de desconto: outro cliente da MESMA conta indicando a negociação do primeiro é ignorado', async () => {
  limparLimites();
  const banco = new BancoFalso(UNICOS);
  const a = await base(banco, 100);
  const a2 = await banco.dados(100).criar('contatos', { nome: 'Bruno Outro', telefone: '+5561988880000', responsavel_id: 1 });
  await banco.dados(100).criar('acessos_cliente', { contato_id: a2.id, revogado_em: null });
  let nid = 0;
  await comServidor(rotas, corretor(1, 100), banco, shellFalso(), async (chamar) => {
    nid = (await chamar('POST', '/negociacoes', { negocio_id: a.negocio.id, imovel_id: a.imovel.id })).corpo.id;
    assert.equal((await chamar('PUT', `/negociacoes/${nid}/mandato`, MANDATO)).status, 200);
  });
  const ia = iaSimulada([]);
  const ctx = ctxListener(banco, { eventos: eventosFalsos(), ia });
  await mensagemDoPortal(ctx, { conta_id: 100, contato_id: a2.id }, { tipo: 'mensagem', negociacao: nid, texto: 'Tem desconto?' });
  assert.equal(ia.chamadas.length, 0, 'o motor não roda na negociação de outro cliente');
  assert.equal(banco.linhas('negociador_execucoes').length, 0);
  assert.deepEqual(banco.linhas('negociacoes').map((n) => n.contato_id), [a.contato.id], 'nada nasce para o segundo cliente');
  assert.equal(banco.linhas('negociacoes')[0].motor_mensagem_hash ?? null, null, 'nem a marca da mensagem');
  // A mensagem continua com o corretor, na ficha do segundo cliente.
  assert.ok(banco.linhas('atividades').some((t) => t.contato_id === a2.id && t.titulo === 'Responder a mensagem do portal'));
});
