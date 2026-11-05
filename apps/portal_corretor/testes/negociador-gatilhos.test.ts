import { test } from 'node:test';
import assert from 'node:assert/strict';
import schema from '../schema.json';
import { rotas, reagir, webhooks } from '../backend/rotas';
import { limparLimites } from '../backend/publico';
import { avisoDeAtribuicao, avisoDeEntrada, conducaoPadrao, falaDePreco, gatilhoLigado } from '../comum/negociador-gatilhos';
import { BancoFalso, comServidor, type Ator, type Unico } from './apoio';

// F3 (issue #135): os gatilhos que faltavam para o Negociador entrar (etapa Proposta, pedido de desconto
// numa mensagem do portal, reação "Conversar sobre o preço"), o aviso direto ao negociador humano quando
// recebe uma negociação (notificação direta, nunca evento segregado) e o negociador padrão da conta
// (`conduz_padrao` + `negociador_padrao_id`; a IA é o padrão, D-94). Nada pede CRECI (D-93); o aceite
// final continua só do corretor; as garantias de 10.9.7 valem para o negociador humano (D-112).
// Isolamento A × B em cada caminho novo.

const EM_ANDAMENTO = (schema.tabelas.negociacoes.unicos as unknown[]).find((u) => !Array.isArray(u)) as Exclude<Unico, string>;
const UNICOS: Record<string, Unico[]> = {
  negociacoes: [EM_ANDAMENTO, 'codigo'],
  mandatos_negociacao: ['negociacao_id+versao'],
  playbook_objecoes: ['categoria+origem'],
  config_negociador: ['chave'],
  vitrine_publica: ['tipo+chave'],
};

const PEDIDO = 150_000_000;
const RECUO = 136_654_321;
const MANDATO = {
  preco_pedido_c: PEDIDO,
  alvo_c: 145_123_456,
  recuo_c: RECUO,
  batna_vendedor: 'Manter-anunciado-e-esperar-o-vizinho',
  concessoes: [{ item: 'prazo de entrega de 90 dias', limite: '90 dias', contrapartida: 'entrada de 30%' }],
  validade: '2099-12-31',
  autonomia: 'pergunta_antes',
};

type Chamar = (metodo: string, caminho: string, corpo?: unknown) => Promise<{ status: number; corpo: any }>;

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

const respostaObjecao = {
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
};

/**
 * Dublê de `req.shell`: negociadores 5 (conta 100, com papel), 7 (conta 100, sem papel) e 6 (conta 200,
 * com papel). `papeis` muda quem tem o papel (para o caso da pessoa que perdeu o papel); `semAcesso`,
 * quem tem o papel gravado mas o nível efetivo `nenhuma` no app (perdeu o acesso).
 */
function shellFalso(papeis = [5, 6], semAcesso: number[] = []) {
  const convites = [
    { id: 2, intencao: 'admitir_existente', credencial: 'neg5@a.com', status: 'resgatado', usuarioId: 5, contaId: 100, contaAlvo: 100 },
    { id: 3, intencao: 'admitir_existente', credencial: 'neg7@a.com', status: 'resgatado', usuarioId: 7, contaId: 100, contaAlvo: 100 },
    { id: 4, intencao: 'admitir_existente', credencial: 'neg6@b.com', status: 'resgatado', usuarioId: 6, contaId: 200, contaAlvo: 200 },
  ];
  return {
    listarUsuariosPorRole: async (role: string) => (role === 'negociador' ? papeis : []),
    nivelEfetivoUsuario: async (uid: number) => (semAcesso.includes(uid) ? 'nenhuma' : 'escrita'),
    externos: {
      convidar: async () => ({ conviteId: 99, vigenteAte: new Date('2099-01-01') }),
      listarConvites: async (o: { contaAlvo?: number; status?: string } = {}) => {
        const lista = convites
          .filter((c) => o.contaAlvo === undefined || (c.contaAlvo ?? c.contaId) === o.contaAlvo)
          .filter((c) => !o.status || c.status === o.status)
          .map((c) => ({ ...c, appId: 'portal_corretor', vigenteAte: new Date('2099-01-01'), criadoEm: new Date('2026-10-01') }));
        return { convites: lista, total: lista.length, limite: 200, deslocamento: 0 };
      },
      revogarConvite: async ({ conviteId }: { conviteId: number }) => ({ conviteId }),
    },
  };
}

const corretor = (usuario: number, conta: number, extras: Record<string, unknown> = {}): Ator => ({ usuario, conta, papeis: ['corretor'], extras });
const negociador = (usuario: number, conta: number, extras: Record<string, unknown> = {}): Ator => ({ usuario, conta, papeis: ['negociador'], extras });

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

const ctxListener = (banco: BancoFalso, extras: Record<string, unknown> = {}) => ({ ...banco.ctxSistema([{ id: 100, nome: 'A' }, { id: 200, nome: 'B' }]), ...extras });

// --- Regras puras -------------------------------------------------------------------------------------

test('quem conduz a nova: IA por padrão (D-94), a pessoa só com o padrão humano, ninguém com o Negociador desligado', () => {
  const g = {};
  assert.deepEqual(conducaoPadrao({ ligado: true, conduz_padrao: 'ia', negociador_padrao_id: null, gatilhos: g }), { conduzida_por: 'ia', negociador_usuario_id: null });
  assert.deepEqual(conducaoPadrao({ ligado: true, conduz_padrao: 'humano', negociador_padrao_id: 5, gatilhos: g }), { conduzida_por: 'humano', negociador_usuario_id: 5 });
  assert.deepEqual(conducaoPadrao({ ligado: true, conduz_padrao: 'humano', negociador_padrao_id: null, gatilhos: g }), { conduzida_por: 'ia', negociador_usuario_id: null });
  assert.deepEqual(conducaoPadrao({ ligado: false, conduz_padrao: 'humano', negociador_padrao_id: 5, gatilhos: g }), { conduzida_por: 'corretor', negociador_usuario_id: null });
  assert.equal(gatilhoLigado({ ligado: true, conduz_padrao: 'ia', negociador_padrao_id: null, gatilhos: {} }, 'etapa_proposta'), true, 'marcado por padrão');
  assert.equal(gatilhoLigado({ ligado: true, conduz_padrao: 'ia', negociador_padrao_id: null, gatilhos: { etapa_proposta: false } }, 'etapa_proposta'), false);
  assert.equal(gatilhoLigado({ ligado: false, conduz_padrao: 'ia', negociador_padrao_id: null, gatilhos: {} }, 'reacao_preco'), false);
});

test('fala de preço: pede desconto ou fala de preço; o prefixo que o portal põe não conta', () => {
  for (const sim of [
    'Tem desconto à vista?',
    'Achei caro, dá para baixar o preço?',
    'Qual o menor valor que ele aceita?',
    'Sobre o imóvel IM-1 (Apto): é negociável?',
    'Faz por 1,3?',
    'Quanto fica com a vaga?',
    'PREÇO muito alto',
  ]) assert.equal(falaDePreco(sim), true, sim);
  for (const nao of [
    'Sobre a negociação do imóvel Apto Asa Sul: posso visitar no sábado?',
    'Sobre o imóvel IM-1 (Apto com valorização): tem vaga coberta?',
    'Obrigado pelo envio!',
    '',
    null,
  ]) assert.equal(falaDePreco(nao as string), false, String(nao));
});

test('os avisos não levam dado pessoal nem valor', () => {
  assert.equal(avisoDeAtribuicao('NG-0003'), 'Você recebeu a negociação NG-0003 no Portal do Corretor. Abra em Negociações para ver o mandato e conduzir.');
  assert.match(avisoDeEntrada({ codigo: 'NG-0004', conduzida_por: 'ia' })!, /NG-0004.*Negociador IA/);
  assert.equal(avisoDeEntrada(null), null);
});

// --- Gatilho etapa Proposta ---------------------------------------------------------------------------

test('etapa Proposta: o negócio chega lá e a negociação nasce com a IA, uma vez só, só na própria conta', async () => {
  const banco = new BancoFalso(UNICOS);
  const ev = eventosFalsos();
  const a = await base(banco, 100);
  const b = await base(banco, 200);
  await comServidor(rotas, corretor(1, 100, { eventos: ev }), banco, shellFalso(), async (chamar) => {
    // B não move o negócio de A (404) e nada nasce em lugar nenhum.
    const r = await chamar('PATCH', `/negocios/${a.negocio.id}`, { etapa_id: a.proposta.id });
    assert.equal(r.status, 200, JSON.stringify(r.corpo));
    assert.equal(r.corpo.negociador_entrou.conduzida_por, 'ia');
    assert.match(r.corpo.negociador_entrou.codigo, /^NG-/);
    const ns = banco.linhas('negociacoes');
    assert.equal(ns.length, 1);
    assert.deepEqual([ns[0].conta_id, ns[0].negocio_id, ns[0].imovel_id, ns[0].conduzida_por], [100, a.negocio.id, a.imovel.id, 'ia']);
    assert.ok(banco.linhas('atividades').some((t) => t.conta_id === 100 && /defina o mandato/.test(t.titulo)), 'tarefa do mandato');
    assert.deepEqual(ev.publicados.find((p) => p.tipo === 'negociacao_iniciada')?.payload, { negociacao_id: ns[0].id, negocio_id: a.negocio.id });
    // Voltar e chegar de novo: a negociação em andamento não duplica.
    await chamar('PATCH', `/negocios/${a.negocio.id}`, { etapa_id: a.visitou.id });
    const de_novo = await chamar('PATCH', `/negocios/${a.negocio.id}`, { etapa_id: a.proposta.id });
    assert.equal(de_novo.corpo.negociador_entrou, undefined);
    assert.equal(banco.linhas('negociacoes').length, 1);
    // O negócio da conta B não existe para A.
    assert.equal((await chamar('PATCH', `/negocios/${b.negocio.id}`, { etapa_id: a.proposta.id })).status, 404);
  });
  await comServidor(rotas, corretor(2, 200), banco, shellFalso(), async (chamar) => {
    assert.equal((await chamar('PATCH', `/negocios/${a.negocio.id}`, { etapa_id: b.proposta.id })).status, 404, 'B não move o negócio de A');
    const r = await chamar('PATCH', `/negocios/${b.negocio.id}`, { etapa_id: b.proposta.id });
    assert.equal(r.corpo.negociador_entrou.conduzida_por, 'ia');
  });
  assert.deepEqual(banco.linhas('negociacoes').map((n) => n.conta_id).sort(), [100, 200]);
});

test('etapa Proposta: nada entra com a caixa desmarcada, com o Negociador desligado ou sem imóvel no negócio', async () => {
  for (const caso of ['gatilho', 'desligado', 'sem_imovel'] as const) {
    const banco = new BancoFalso(UNICOS);
    const a = await base(banco, 100, { imovel: caso !== 'sem_imovel' });
    await comServidor(rotas, corretor(1, 100), banco, shellFalso(), async (chamar) => {
      if (caso === 'gatilho') assert.equal((await chamar('PUT', '/negociador/config', { gatilhos: { etapa_proposta: false } })).status, 200);
      if (caso === 'desligado') assert.equal((await chamar('PUT', '/negociador/config', { ligado: false })).status, 200);
      const r = await chamar('PATCH', `/negocios/${a.negocio.id}`, { etapa_id: a.proposta.id });
      assert.equal(r.status, 200);
      assert.equal(r.corpo.negociador_entrou, undefined, caso);
    });
    assert.equal(banco.linhas('negociacoes').length, 0, caso);
  }
});

// --- Negociador padrão e aviso ------------------------------------------------------------------------

test('negociador padrão: só quem aceitou o convite desta conta e tem o papel; humano sem pessoa é recusado; sem shell, 503', async () => {
  const banco = new BancoFalso(UNICOS);
  await comServidor(rotas, corretor(1, 100), banco, shellFalso(), async (chamar) => {
    const semPessoa = await chamar('PUT', '/negociador/config', { conduz_padrao: 'humano' });
    assert.equal(semPessoa.status, 422);
    assert.match(semPessoa.corpo.detalhes.join(' '), /negociador humano/);
    assert.deepEqual((await chamar('PUT', '/negociador/config', { negociador_padrao_id: 7 })).corpo.codigo, 'NEGOCIADOR_SEM_PAPEL');
    assert.deepEqual((await chamar('PUT', '/negociador/config', { negociador_padrao_id: 6 })).corpo.codigo, 'NEGOCIADOR_NAO_ENCONTRADO', 'o negociador de B');
    assert.equal((await chamar('PUT', '/negociador/config', { negociador_padrao_id: 'x' })).status, 422);
    const ok = await chamar('PUT', '/negociador/config', { negociador_padrao_id: 5, conduz_padrao: 'humano' });
    assert.equal(ok.status, 200, JSON.stringify(ok.corpo));
    assert.deepEqual([ok.corpo.conduz_padrao, ok.corpo.negociador_padrao_id], ['humano', 5]);
    assert.ok(!JSON.stringify(ok.corpo).toLowerCase().includes('creci'), 'nada de CRECI (D-93)');
    // Tirar a pessoa volta à IA (D-94).
    const fora = await chamar('PUT', '/negociador/config', { negociador_padrao_id: null });
    assert.deepEqual([fora.corpo.conduz_padrao, fora.corpo.negociador_padrao_id], ['ia', null]);
  });
  await comServidor(rotas, corretor(1, 100), banco, {}, async (chamar) => {
    assert.deepEqual((await chamar('PUT', '/negociador/config', { negociador_padrao_id: 5 })).corpo.codigo, 'CONVITE_INDISPONIVEL');
  });
  // O negociador não mexe na configuração da conta.
  await comServidor(rotas, negociador(5, 100), banco, shellFalso(), async (chamar) => {
    assert.equal((await chamar('PUT', '/negociador/config', { negociador_padrao_id: 5, conduz_padrao: 'humano' })).status, 403);
  });
});

test('negociador padrão: a negociação nova nasce atribuída e a pessoa recebe o aviso direto, sem dado do cliente; B não é afetado', async () => {
  const banco = new BancoFalso(UNICOS);
  const ev = eventosFalsos();
  const avisos = notificacoesFalsas();
  const a = await base(banco, 100);
  const b = await base(banco, 200);
  let nid = 0;
  await comServidor(rotas, corretor(1, 100, { eventos: ev, notificacoes: avisos }), banco, shellFalso(), async (chamar) => {
    assert.equal((await chamar('PUT', '/negociador/config', { negociador_padrao_id: 5, conduz_padrao: 'humano' })).status, 200);
    const n = await chamar('POST', '/negociacoes', { negocio_id: a.negocio.id, imovel_id: a.imovel.id });
    assert.equal(n.status, 201, JSON.stringify(n.corpo));
    nid = n.corpo.id;
    assert.deepEqual([n.corpo.conduzida_por, n.corpo.negociador_usuario_id], ['humano', 5]);
    const atrib = banco.linhas('atribuicoes_negociacao');
    assert.deepEqual(atrib.map((x) => [x.conta_id, x.negociacao_id, x.usuario_id, x.ativa, x.atribuida_por]), [[100, nid, 5, true, 1]]);
    assert.equal(avisos.enviadas.length, 1);
    assert.equal(avisos.enviadas[0].usuario, 5);
    assert.equal(avisos.enviadas[0].mensagem, avisoDeAtribuicao(n.corpo.codigo));
    // Sub-rota relativa ao slug (barramento.md): o endereço `/negociacoes`, que o negociador abre.
    assert.equal(avisos.enviadas[0].opts.rota, `negociacoes?item=${nid}`);
    const texto = JSON.stringify(avisos.enviadas);
    for (const proibido of ['Ana', 'Secreta', '7777', String(PEDIDO)]) assert.ok(!texto.includes(proibido), `aviso sem ${proibido}`);
    // Nenhum evento leva o negociador nem dado do cliente: só os ids da negociação e do negócio.
    for (const p of ev.publicados) assert.ok(!('usuario_id' in p.payload) && !('negociador_usuario_id' in p.payload), p.tipo);
    // Pedido explícito do corretor vence o padrão (e não avisa ninguém).
    await chamar('PATCH', `/negociacoes/${nid}`, { estado: 'perdida', motivo_perda: 'desistiu' });
    const minha = await chamar('POST', '/negociacoes', { negocio_id: a.negocio.id, imovel_id: a.imovel.id, conduzida_por: 'corretor' });
    assert.deepEqual([minha.corpo.conduzida_por, minha.corpo.negociador_usuario_id ?? null], ['corretor', null]);
    assert.equal(avisos.enviadas.length, 1);
  });
  // A pessoa abre a negociação atribuída.
  await comServidor(rotas, negociador(5, 100), banco, shellFalso(), async (chamar) => {
    assert.equal((await chamar('GET', `/negociacoes/${nid}`)).status, 200);
  });
  // O padrão de A não vale em B.
  await comServidor(rotas, corretor(2, 200, { notificacoes: avisos }), banco, shellFalso(), async (chamar) => {
    const n = await chamar('POST', '/negociacoes', { negocio_id: b.negocio.id, imovel_id: b.imovel.id });
    assert.deepEqual([n.corpo.conduzida_por, n.corpo.negociador_usuario_id ?? null], ['ia', null]);
    assert.equal((await chamar('GET', `/negociacoes/${nid}`)).status, 404, 'B não vê a negociação de A');
  });
  assert.equal(avisos.enviadas.length, 1);
});

test('negociação com negociador humano: atribuição que falha não deixa a negociação gravada; a nova tentativa cria as duas', async () => {
  const banco = new BancoFalso(UNICOS);
  const a = await base(banco, 100);
  // A criação da atribuição falha uma vez (banco fora do ar no meio): o par é desfeito inteiro.
  let falhar = true;
  const original = banco.dados.bind(banco);
  banco.dados = (conta: number | null, global = false) => {
    const h = original(conta, global);
    const criar = h.criar;
    h.criar = async (tabela: string, d: Record<string, unknown>) => {
      if (tabela === 'atribuicoes_negociacao' && falhar) {
        falhar = false;
        throw new Error('fora do ar');
      }
      return criar(tabela, d);
    };
    return h;
  };
  const avisos = notificacoesFalsas();
  await comServidor(rotas, corretor(1, 100, { notificacoes: avisos }), banco, shellFalso(), async (chamar) => {
    assert.equal((await chamar('PUT', '/negociador/config', { negociador_padrao_id: 5, conduz_padrao: 'humano' })).status, 200);
    const n = await chamar('POST', '/negociacoes', { negocio_id: a.negocio.id, imovel_id: a.imovel.id });
    assert.ok(n.status >= 500, `a rota responde erro (${n.status})`);
    assert.equal(banco.linhas('negociacoes').length, 0, 'nenhuma negociação sem a atribuição');
    assert.equal(banco.linhas('atribuicoes_negociacao').length, 0);
    assert.equal(avisos.enviadas.length, 0);
    const outra = await chamar('POST', '/negociacoes', { negocio_id: a.negocio.id, imovel_id: a.imovel.id });
    assert.equal(outra.status, 201, JSON.stringify(outra.corpo));
    assert.deepEqual(banco.linhas('negociacoes').map((x) => [x.id, x.negociador_usuario_id]), [[outra.corpo.id, 5]]);
    assert.deepEqual(banco.linhas('atribuicoes_negociacao').map((x) => [x.negociacao_id, x.usuario_id, x.ativa]), [[outra.corpo.id, 5, true]]);
  });
});

test('negociador padrão que perdeu o papel: a nova nasce com a IA, sem atribuição nem aviso', async () => {
  const banco = new BancoFalso(UNICOS);
  const avisos = notificacoesFalsas();
  const a = await base(banco, 100);
  await comServidor(rotas, corretor(1, 100), banco, shellFalso(), async (chamar) => {
    assert.equal((await chamar('PUT', '/negociador/config', { negociador_padrao_id: 5, conduz_padrao: 'humano' })).status, 200);
  });
  await comServidor(rotas, corretor(1, 100, { notificacoes: avisos }), banco, shellFalso([6]), async (chamar) => {
    const n = await chamar('POST', '/negociacoes', { negocio_id: a.negocio.id, imovel_id: a.imovel.id });
    assert.deepEqual([n.corpo.conduzida_por, n.corpo.negociador_usuario_id ?? null], ['ia', null]);
  });
  assert.equal(banco.linhas('atribuicoes_negociacao').length, 0);
  assert.equal(avisos.enviadas.length, 0);
});

test('atribuir: a pessoa recebe o aviso direto uma vez; repetir a mesma atribuição não avisa de novo', async () => {
  const banco = new BancoFalso(UNICOS);
  const avisos = notificacoesFalsas();
  const a = await base(banco, 100);
  await comServidor(rotas, corretor(1, 100, { notificacoes: avisos }), banco, shellFalso(), async (chamar) => {
    const n = await chamar('POST', '/negociacoes', { negocio_id: a.negocio.id, imovel_id: a.imovel.id });
    assert.equal(n.corpo.conduzida_por, 'ia');
    assert.equal(avisos.enviadas.length, 0);
    assert.equal((await chamar('POST', '/negociador/atribuicoes', { negociacao_id: n.corpo.id, usuario_id: 5 })).status, 201);
    assert.equal((await chamar('POST', '/negociador/atribuicoes', { negociacao_id: n.corpo.id, usuario_id: 5 })).status, 200);
    assert.deepEqual(avisos.enviadas.map((x) => [x.usuario, x.mensagem]), [[5, avisoDeAtribuicao(n.corpo.codigo)]]);
  });
});

test('aviso que falha não derruba a criação nem a atribuição', async () => {
  const banco = new BancoFalso(UNICOS);
  const a = await base(banco, 100);
  const quebrado = { notificar: async () => { throw new Error('fora do ar'); }, notificarAdmins: async () => {} };
  await comServidor(rotas, corretor(1, 100, { notificacoes: quebrado }), banco, shellFalso(), async (chamar) => {
    assert.equal((await chamar('PUT', '/negociador/config', { negociador_padrao_id: 5, conduz_padrao: 'humano' })).status, 200);
    const n = await chamar('POST', '/negociacoes', { negocio_id: a.negocio.id, imovel_id: a.imovel.id });
    assert.equal(n.status, 201);
  });
});

test('D-112: o negociador padrão conduz dentro do mandato — abaixo do recuo é bloqueado; o aceite final é só do corretor', async () => {
  const banco = new BancoFalso(UNICOS);
  const a = await base(banco, 100);
  let nid = 0;
  await comServidor(rotas, corretor(1, 100), banco, shellFalso(), async (chamar) => {
    await chamar('PUT', '/negociador/config', { negociador_padrao_id: 5, conduz_padrao: 'humano' });
    nid = (await chamar('POST', '/negociacoes', { negocio_id: a.negocio.id, imovel_id: a.imovel.id })).corpo.id;
    assert.equal((await chamar('PUT', `/negociacoes/${nid}/mandato`, MANDATO)).status, 200);
  });
  await comServidor(rotas, negociador(5, 100), banco, shellFalso(), async (chamar) => {
    const oferta = await chamar('POST', `/negociacoes/${nid}/propostas`, { direcao: 'comprador', valor_c: 130_000_000 });
    assert.equal(oferta.status, 201, JSON.stringify(oferta.corpo));
    const baixo = await chamar('POST', `/negociacoes/${nid}/propostas`, { direcao: 'vendedor', valor_c: RECUO - 100 });
    assert.deepEqual([baixo.status, baixo.corpo.codigo], [422, 'MOVIMENTO_BLOQUEADO']);
    assert.ok(baixo.corpo.bloqueado_por.includes('ABAIXO_DO_RECUO'));
    const aceite = await chamar('POST', `/negociacoes/${nid}/decisao`, { acao: 'aceitar_acordo', proposta_id: oferta.corpo.id });
    assert.equal(aceite.status, 403);
    assert.equal(aceite.corpo.codigo, 'SO_O_CORRETOR');
  });
});

// --- Gatilhos do cliente (listener) -------------------------------------------------------------------

/** Seleção válida com o imóvel da base, para a reação. */
async function selecaoDe(banco: BancoFalso, conta: number, b: Awaited<ReturnType<typeof base>>) {
  const d = banco.dados(conta);
  const selecao = await d.criar('selecoes', { contato_id: b.contato.id, titulo: 'Para você', expira_em: new Date(Date.now() + 86400e3).toISOString() });
  await d.criar('selecao_itens', { selecao_id: selecao.id, imovel_id: b.imovel.id, ordem: 0 });
  return selecao;
}

test('reação "Conversar sobre o preço": vira tarefa e o Negociador entra no negócio daquele imóvel; repetida, não duplica; de outra conta, nada', async () => {
  const banco = new BancoFalso(UNICOS);
  const ev = eventosFalsos();
  const avisos = notificacoesFalsas();
  const a = await base(banco, 100);
  const b = await base(banco, 200);
  const sa = await selecaoDe(banco, 100, a);
  const ctx = ctxListener(banco, { eventos: ev, notificacoes: avisos });
  const reacao = { selecao_id: sa.id, imovel_codigo: a.imovel.codigo, reacao: 'conversar_preco', comentario: null };
  // Entregue na conta errada (B): a seleção não é de B, nada acontece.
  await reagir.reacao_recebida({ payload: reacao, conta_id: 200 }, ctx);
  assert.equal(banco.linhas('negociacoes').length, 0);
  await reagir.reacao_recebida({ payload: reacao, conta_id: 100 }, ctx);
  await reagir.reacao_recebida({ payload: reacao, conta_id: 100 }, ctx);
  const ns = banco.linhas('negociacoes');
  assert.deepEqual(ns.map((n) => [n.conta_id, n.negocio_id, n.conduzida_por]), [[100, a.negocio.id, 'ia']]);
  assert.equal(banco.linhas('selecao_itens').find((i) => i.selecao_id === sa.id)!.reacao, 'conversar_preco');
  const tarefas = banco.linhas('atividades').filter((t) => t.conta_id === 100).map((t) => t.titulo);
  assert.equal(tarefas.filter((t) => t.startsWith('Conversar sobre o preço: IM-100')).length, 1);
  assert.equal(tarefas.filter((t) => /defina o mandato/.test(t)).length, 1);
  assert.equal(ev.publicados.filter((p) => p.tipo === 'negociacao_iniciada').length, 1);
  assert.equal(ev.publicados[0].opcoes.conta_id, 100);
  assert.equal(banco.linhas('atividades').filter((t) => t.conta_id === 200).length, 0, 'nada em B');
  assert.ok(b.negocio.id);
});

test('reação: com o gatilho desmarcado só a tarefa; com o padrão humano a negociação nasce atribuída e a pessoa é avisada', async () => {
  const banco = new BancoFalso(UNICOS);
  const a = await base(banco, 100);
  const sa = await selecaoDe(banco, 100, a);
  const reacao = { selecao_id: sa.id, imovel_codigo: a.imovel.codigo, reacao: 'conversar_preco', comentario: null };
  await comServidor(rotas, corretor(1, 100), banco, shellFalso(), async (chamar) => {
    assert.equal((await chamar('PUT', '/negociador/config', { gatilhos: { reacao_preco: false } })).status, 200);
  });
  await reagir.reacao_recebida({ payload: reacao, conta_id: 100 }, ctxListener(banco, { eventos: eventosFalsos() }));
  assert.equal(banco.linhas('negociacoes').length, 0);
  assert.ok(banco.linhas('atividades').some((t) => t.titulo.startsWith('Conversar sobre o preço')));

  await comServidor(rotas, corretor(1, 100), banco, shellFalso(), async (chamar) => {
    assert.equal((await chamar('PUT', '/negociador/config', { gatilhos: { reacao_preco: true }, negociador_padrao_id: 5, conduz_padrao: 'humano' })).status, 200);
  });
  const avisos = notificacoesFalsas();
  await reagir.reacao_recebida({ payload: { ...reacao, comentario: 'De novo' }, conta_id: 100 }, ctxListener(banco, { eventos: eventosFalsos(), notificacoes: avisos }));
  const n = banco.linhas('negociacoes');
  assert.deepEqual(n.map((x) => [x.conduzida_por, x.negociador_usuario_id]), [['humano', 5]]);
  assert.deepEqual(banco.linhas('atribuicoes_negociacao').map((x) => [x.usuario_id, x.ativa]), [[5, true]]);
  assert.deepEqual(avisos.enviadas.map((x) => x.usuario), [5]);
});

/** O webhook do portal (mensagem) e a entrega ao listener na conta do ingresso. */
async function mensagemDoPortal(ctx: any, contexto: Record<string, unknown>, corpo: Record<string, unknown>) {
  const publicados: { tipo: string; payload: any; opcoes: any }[] = [];
  const res: any = { status: () => res, json: () => res };
  const req: any = { body: corpo, headers: {}, ip: `10.8.${Math.floor(Math.random() * 200)}.1`, wh: { webhook: 'acao_cliente', modo: 'recorrente', ingresso_id: 1, contexto, contador_usos: 0, criado_por: 1 }, eventos: { publicar: async (tipo: string, payload: any, opcoes: any) => publicados.push({ tipo, payload, opcoes }) } };
  await webhooks.acao_cliente(req, res);
  for (const p of publicados) await reagir.acao_cliente_recebida({ payload: p.payload, conta_id: p.opcoes.conta_id }, ctx);
  return publicados;
}

test('pedido de desconto no portal: o Negociador IA prepara a resposta com o mandato; sem fala de preço, só a tarefa; mesma mensagem, uma rodada', async () => {
  limparLimites();
  const banco = new BancoFalso(UNICOS);
  const a = await base(banco, 100);
  await banco.dados(100).criar('acessos_cliente', { contato_id: a.contato.id, revogado_em: null });
  let nid = 0;
  await comServidor(rotas, corretor(1, 100), banco, shellFalso(), async (chamar: Chamar) => {
    nid = (await chamar('POST', '/negociacoes', { negocio_id: a.negocio.id, imovel_id: a.imovel.id })).corpo.id;
    assert.equal((await chamar('PUT', `/negociacoes/${nid}/mandato`, MANDATO)).status, 200);
  });
  const ia = iaSimulada([respostaObjecao]);
  const ctx = ctxListener(banco, { eventos: eventosFalsos(), ia });
  const contexto = { conta_id: 100, contato_id: a.contato.id };
  // Sem fala de preço: a tarefa de sempre, sem motor.
  await mensagemDoPortal(ctx, contexto, { tipo: 'mensagem', negociacao: nid, texto: 'Sobre a negociação do imóvel Apto: posso visitar sábado?' });
  assert.equal(ia.chamadas.length, 0);
  const texto = 'Sobre a negociação do imóvel Apto: tem desconto à vista?';
  const pub = await mensagemDoPortal(ctx, contexto, { tipo: 'mensagem', negociacao: nid, texto });
  assert.equal(pub[0].payload.negociacao, nid, 'a mensagem da seção leva o id da negociação');
  assert.equal(ia.chamadas.length, 1, 'o motor rodou sobre a mensagem');
  const ex = banco.linhas('negociador_execucoes');
  assert.deepEqual(ex.map((e) => [e.conta_id, e.negociacao_id, e.mensagem_cliente, e.decisao]), [[100, nid, texto, 'pendente']]);
  // Entregue de novo (mesmo evento): nenhuma rodada a mais.
  await reagir.acao_cliente_recebida({ payload: pub[0].payload, conta_id: 100 }, ctx);
  assert.equal(ia.chamadas.length, 1);
  assert.ok(banco.linhas('atividades').some((t) => t.titulo === 'Responder a mensagem do portal'), 'a mensagem continua do corretor');
});

test('pedido de desconto: a negociação indicada de outro cliente ou de outra conta é ignorada; conduzida por pessoa, o motor não roda', async () => {
  limparLimites();
  const banco = new BancoFalso(UNICOS);
  const a = await base(banco, 100);
  const b = await base(banco, 200);
  let nidA = 0;
  let nidB = 0;
  await comServidor(rotas, corretor(1, 100), banco, shellFalso(), async (chamar) => {
    nidA = (await chamar('POST', '/negociacoes', { negocio_id: a.negocio.id, imovel_id: a.imovel.id })).corpo.id;
    await chamar('PUT', `/negociacoes/${nidA}/mandato`, MANDATO);
  });
  await comServidor(rotas, corretor(2, 200), banco, shellFalso(), async (chamar) => {
    nidB = (await chamar('POST', '/negociacoes', { negocio_id: b.negocio.id, imovel_id: b.imovel.id })).corpo.id;
    await chamar('PUT', `/negociacoes/${nidB}/mandato`, MANDATO);
  });
  const ia = iaSimulada([]);
  const ctx = ctxListener(banco, { eventos: eventosFalsos(), ia });
  // O cliente de B indica a negociação de A: nada roda em A.
  await mensagemDoPortal(ctx, { conta_id: 200, contato_id: b.contato.id }, { tipo: 'mensagem', negociacao: nidA, texto: 'Tem desconto?' });
  // O cliente de A, entregue com a conta de B: o contato não é de B.
  await mensagemDoPortal(ctx, { conta_id: 200, contato_id: a.contato.id }, { tipo: 'mensagem', negociacao: nidA, texto: 'Tem desconto?' });
  assert.equal(ia.chamadas.length, 0);
  assert.equal(banco.linhas('negociador_execucoes').length, 0);
  // Conduzida por pessoa: o Negociador IA não fala por ela.
  await comServidor(rotas, corretor(1, 100), banco, shellFalso(), async (chamar) => {
    assert.equal((await chamar('POST', '/negociador/atribuicoes', { negociacao_id: nidA, usuario_id: 5 })).status, 201);
  });
  await mensagemDoPortal(ctx, { conta_id: 100, contato_id: a.contato.id }, { tipo: 'mensagem', negociacao: nidA, texto: 'Tem desconto?' });
  assert.equal(ia.chamadas.length, 0);
});

test('pedido de desconto sem negociação: abre a do único negócio de compra com imóvel; o motor espera o mandato', async () => {
  limparLimites();
  const banco = new BancoFalso(UNICOS);
  const a = await base(banco, 100);
  const ia = iaSimulada([]);
  const ctx = ctxListener(banco, { eventos: eventosFalsos(), ia });
  await mensagemDoPortal(ctx, { conta_id: 100, contato_id: a.contato.id }, { tipo: 'mensagem', texto: 'Sobre o imóvel IM-100 (Apto): aceita proposta?' });
  assert.deepEqual(banco.linhas('negociacoes').map((n) => [n.conta_id, n.negocio_id, n.conduzida_por]), [[100, a.negocio.id, 'ia']]);
  assert.ok(banco.linhas('atividades').some((t) => /defina o mandato/.test(t.titulo)));
  assert.equal(ia.chamadas.length, 0, 'sem mandato o Negociador não age');
});
