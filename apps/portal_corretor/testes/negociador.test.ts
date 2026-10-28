import { test } from 'node:test';
import assert from 'node:assert/strict';
import schema from '../schema.json';
import { rotas } from '../backend/rotas';
import {
  PROMPT_PARTE_2_PADRAO,
  exigePassagem,
  montarContexto,
  promptSistema,
  sanearResposta,
  validarMovimento,
  valoresCitados,
  vazamentos,
  zopa,
  type MandatoMotor,
  type PropostaResumo,
} from '../comum/negociador';
import { BancoFalso, comServidor, type Ator, type Unico } from './apoio';

// Motor do Negociador IA (D2, issue #101): as 7 garantias de 10.9.7 no código, o sigilo em vários
// formatos, as 7 conversas-roteiro de 10.9.9 com uma IA simulada que TENTA furar, o aceite que é só do
// corretor, a degradação sem IA e o isolamento A × B. Critério: zero contraproposta abaixo do recuo,
// zero vazamento e zero acordo aceito pelo Negociador.

const EM_ANDAMENTO = (schema.tabelas.negociacoes.unicos as unknown[]).find((u) => !Array.isArray(u)) as Exclude<Unico, string>;
const UNICOS: Record<string, Unico[]> = { negociacoes: [EM_ANDAMENTO, 'codigo'], mandatos_negociacao: ['negociacao_id+versao'], playbook_objecoes: ['categoria+origem'], config_negociador: ['chave'] };

// R$ 1.500.000 pedido, alvo R$ 1.450.000, recuo R$ 1.360.000 (em centavos).
const PEDIDO = 150_000_000;
const ALVO = 145_000_000;
const RECUO = 136_000_000;
const BATNA = 'Manter anunciado por sessenta dias e esperar a proposta do vizinho do terceiro andar';
const VALIDADE = '2099-12-31';
const MANDATO = {
  preco_pedido_c: PEDIDO,
  alvo_c: ALVO,
  recuo_c: RECUO,
  batna_vendedor: BATNA,
  concessoes: [{ item: 'prazo de entrega de 90 dias', limite: '90 dias', contrapartida: 'entrada de 30%' }],
  validade: VALIDADE,
  autonomia: 'pergunta_antes',
};
const MOTOR: MandatoMotor = { ...MANDATO, passo_max_pct: 0.4, rodadas_max: 4, autorizacao_proprietario: null };
const HOJE = '2026-10-28';

const comprador = (valor_c: number): PropostaResumo => ({ direcao: 'comprador', valor_c });
const vendedor = (valor_c: number): PropostaResumo => ({ direcao: 'vendedor', valor_c });
const cp = (valor_c: number, extra: Record<string, unknown> = {}) => ({
  movimento: 'contraproposta',
  contraproposta: { valor_c, condicoes: null, concessao: null, contrapartida: null, validade_horas: 48, ...extra },
  mensagem: null,
});
const bloqueios = (r: { bloqueado_por: string[] }) => r.bloqueado_por;

// ------------------------------------------------------------------------------------------------
// As 7 garantias, com borda

test('garantia 1 (piso): igual ao recuo passa; 1 centavo abaixo bloqueia', () => {
  // Para o passo não interferir: o vendedor já está perto do recuo.
  const escada = [comprador(130_000_000), vendedor(137_000_000), comprador(132_000_000), vendedor(136_500_000), comprador(133_000_000)];
  const mandato = { ...MOTOR, rodadas_max: 10, passo_max_pct: 1 };
  assert.deepEqual(bloqueios(validarMovimento(cp(RECUO), mandato, escada, { hoje: HOJE, canal: 'portal' })), []);
  assert.ok(bloqueios(validarMovimento(cp(RECUO - 1), mandato, escada, { hoje: HOJE, canal: 'portal' })).includes('ABAIXO_DO_RECUO'));
});

test('garantia 2 (passo): até o passo máximo do intervalo que resta, e nunca maior que a concessão anterior', () => {
  // Pedido 1,5 mi, recuo 1,36 mi: resta 140 mil, passo 40% = 56 mil → até 1.444.000.
  const r1 = [comprador(130_000_000)];
  assert.deepEqual(bloqueios(validarMovimento(cp(144_400_000), MOTOR, r1, { hoje: HOJE, canal: 'portal' })), []);
  assert.deepEqual(bloqueios(validarMovimento(cp(144_399_999), MOTOR, r1, { hoje: HOJE, canal: 'portal' })), ['PASSO_ACIMA_DO_LIMITE']);
  // Segunda rodada: o vendedor concedeu 20 mil (1,5 → 1,48); conceder 30 mil agora é passo crescente.
  const r2 = [comprador(130_000_000), vendedor(148_000_000), comprador(132_000_000)];
  assert.deepEqual(bloqueios(validarMovimento(cp(146_000_000), MOTOR, r2, { hoje: HOJE, canal: 'portal' })), [], '20 mil de novo passa');
  assert.deepEqual(bloqueios(validarMovimento(cp(145_000_000), MOTOR, r2, { hoje: HOJE, canal: 'portal' })), ['PASSO_ACIMA_DO_LIMITE'], '30 mil depois de 20 mil é crescente');
});

test('garantia 3 (rodadas): a contraproposta da rodada acima do máximo bloqueia', () => {
  const quatro = [comprador(1), vendedor(149_000_000), comprador(1), vendedor(148_500_000), comprador(1), vendedor(148_100_000), comprador(1)];
  const mandato = { ...MOTOR, rodadas_max: 3 };
  const r = validarMovimento(cp(148_000_000), mandato, quatro.map((p) => (p.direcao === 'comprador' ? { ...p, valor_c: 140_000_000 } : p)), { hoje: HOJE, canal: 'portal' });
  assert.deepEqual(bloqueios(r), ['RODADAS_ESGOTADAS']);
});

test('garantia 4 (concessões): só itens do mandato, cada um com a contrapartida', () => {
  const e = [comprador(140_000_000)];
  const ok = validarMovimento(cp(146_000_000, { concessao: 'Prazo de entrega de 90 dias', contrapartida: 'entrada de 30%' }), MOTOR, e, { hoje: HOJE, canal: 'portal' });
  assert.deepEqual(bloqueios(ok), []);
  assert.deepEqual(bloqueios(validarMovimento(cp(146_000_000, { concessao: 'deixar os móveis', contrapartida: 'x' }), MOTOR, e, { hoje: HOJE, canal: 'portal' })), ['CONCESSAO_FORA_DO_MANDATO']);
  assert.deepEqual(bloqueios(validarMovimento(cp(146_000_000, { concessao: 'prazo de entrega de 90 dias' }), MOTOR, e, { hoje: HOJE, canal: 'portal' })), ['CONCESSAO_FORA_DO_MANDATO'], 'sem contrapartida');
});

test('garantia 5 (sigilo): a mensagem que cita o recuo bloqueia; a que cita a própria contraproposta passa', () => {
  const e = [comprador(140_000_000)];
  const vaza = { ...cp(146_000_000), mensagem: 'Ele não desce de R$ 1.360.000, mas posso fazer 1,46 mi.' };
  assert.deepEqual(bloqueios(validarMovimento(vaza, MOTOR, e, { hoje: HOJE, canal: 'portal' })), ['SIGILO_VIOLADO']);
  const limpa = { ...cp(146_000_000), mensagem: 'Posso levar ao vendedor R$ 1.460.000 com entrega em 90 dias, válido por 48 horas.' };
  assert.deepEqual(bloqueios(validarMovimento(limpa, MOTOR, e, { hoje: HOJE, canal: 'portal' })), []);
});

test('garantia 6 (validade): sem mandato, mandato vencido e faz sozinho sem autorização bloqueiam', () => {
  const e = [comprador(140_000_000)];
  assert.deepEqual(bloqueios(validarMovimento(cp(146_000_000), null, e, { hoje: HOJE, canal: 'portal' })), ['MANDATO_AUSENTE']);
  assert.deepEqual(bloqueios(validarMovimento(cp(146_000_000), { ...MOTOR, validade: '2026-10-27' }, e, { hoje: HOJE, canal: 'portal' })), ['MANDATO_VENCIDO']);
  assert.deepEqual(bloqueios(validarMovimento(cp(146_000_000), { ...MOTOR, validade: HOJE }, e, { hoje: HOJE, canal: 'portal' })), [], 'vale até o fim do dia');
  const sozinho = { ...MOTOR, autonomia: 'faz_sozinho' };
  assert.deepEqual(bloqueios(validarMovimento(cp(146_000_000), sozinho, e, { hoje: HOJE, canal: 'portal', automatico: true })), ['AUTORIZACAO_PROPRIETARIO_AUSENTE']);
  const autorizado = { ...sozinho, autorizacao_proprietario: { tipo: 'mensagem', data: '2026-10-20' } };
  assert.deepEqual(bloqueios(validarMovimento(cp(146_000_000), autorizado, e, { hoje: HOJE, canal: 'portal', automatico: true })), []);
});

test('garantia 7 (canal): sem WhatsApp do app; faz sozinho só no portal', () => {
  const e = [comprador(140_000_000)];
  assert.deepEqual(bloqueios(validarMovimento(cp(146_000_000), MOTOR, e, { hoje: HOJE, canal: 'whatsapp' })), ['CANAL_INDISPONIVEL']);
  assert.deepEqual(bloqueios(validarMovimento(cp(146_000_000), MOTOR, e, { hoje: HOJE, canal: 'wa_me' })), []);
  const autorizado = { ...MOTOR, autonomia: 'faz_sozinho', autorizacao_proprietario: { tipo: 'mensagem', data: '2026-10-20' } };
  assert.deepEqual(bloqueios(validarMovimento(cp(146_000_000), autorizado, e, { hoje: HOJE, canal: 'wa_me', automatico: true })), ['CANAL_INDISPONIVEL']);
});

test('aceite e movimento fora da lista nunca são executados: viram passagem', () => {
  const acordo = validarMovimento({ movimento: 'resumir_acordo', contraproposta: null, mensagem: 'Resumo: 1,46 mi com entrega em 90 dias. Vou confirmar com o vendedor.' }, MOTOR, [], { hoje: HOJE, canal: 'portal' });
  assert.equal(acordo.ok, false);
  assert.equal(acordo.passa_ao_corretor, true);
  const inventado = validarMovimento({ movimento: 'aceitar_acordo', contraproposta: null, mensagem: 'Fechado!' }, MOTOR, [], { hoje: HOJE, canal: 'portal' });
  assert.equal(inventado.ok, false);
  assert.ok(inventado.bloqueado_por.includes('MOVIMENTO_INVALIDO'));
});

// ------------------------------------------------------------------------------------------------
// Sigilo: bateria de formatos e nenhum falso positivo

test('sigilo: o recuo e o alvo em vários formatos são pegos', () => {
  const vazam = [
    'O mínimo que ele aceita é 1.360.000.',
    'Ele fecha por 1360000.',
    'Consigo chegar a R$ 1.360.000,00.',
    'Algo como 1,36 mi resolveria.',
    'Que tal 1.36 milhão?',
    'Fica em R$ 1360 mil.',
    'Fica em um milhão e trezentos e sessenta mil reais.',
    'Fica em 1 milhão e 360 mil.',
    'Faço 1,365 milhão.',
    'Fecho em 1.355.000.',
    'O alvo dele é 1,45 mi.',
    'Ele topa até um pouco menos.',
    'O dono aceita até onde você disse.',
    'Abaixo disso ele não vende.',
    'O piso dele é outro.',
    'Ele pensa em manter anunciado por sessenta dias e esperar outra proposta.',
  ];
  for (const m of vazam) assert.ok(vazamentos(m, MOTOR, [146_000_000, PEDIDO]).length > 0, `deveria pegar: ${m}`);
});

test('sigilo: as mensagens normais do roteiro não são bloqueadas', () => {
  const normais = [
    'Entendo, Ana. O que pesa mais para você: o valor total ou a entrada?',
    'Posso levar ao vendedor R$ 1.460.000 com entrega em 90 dias, válido por 48 horas.',
    'O apartamento tem 3 quartos e 2 vagas, e o R$/m² está em 9.800 na quadra.',
    'Comparando com os imóveis da região, o preço de R$ 1.500.000 já considera a reforma recente.',
    'Vamos marcar uma visita no sábado às 10h para você ver de novo?',
    'Recebi sua proposta de R$ 1.400.000. Vou conversar com o vendedor e te retorno até amanhã.',
  ];
  for (const m of normais) assert.deepEqual(vazamentos(m, MOTOR, [146_000_000, PEDIDO, 140_000_000]), [], m);
});

test('valoresCitados lê dígitos, mil, milhão e por extenso', () => {
  assert.deepEqual(valoresCitados('1.360.000'), [1360000]);
  assert.deepEqual(valoresCitados('R$ 1.360.000,50'), [1360000.5]);
  assert.deepEqual(valoresCitados('1,36 mi'), [1360000]);
  assert.deepEqual(valoresCitados('1360 mil'), [1360000]);
  assert.deepEqual(valoresCitados('um milhão e trezentos e sessenta mil'), [1360000]);
  assert.deepEqual(valoresCitados('3 quartos e 2 vagas'), [3, 2]);
});

// ------------------------------------------------------------------------------------------------
// Prompt, contexto, ZOPA e passagem

test('prompt em duas partes: regras fixas primeiro; CRECI só quando existe; instruções do corretor depois', () => {
  const com = promptSistema({ estilo: 'firme', instrucoes_corretor: 'Seja breve.' }, { nome_corretor: 'Marina', creci: 'DF-1234', imovel_titulo: 'Apto Asa Sul' });
  assert.ok(com.startsWith('Você é o Negociador do corretor Marina (CRECI DF-1234). Você negocia a venda do imóvel Apto Asa Sul'));
  assert.ok(com.indexOf('Regras que você nunca quebra') < com.indexOf('Seja breve.'));
  assert.ok(com.includes('ESTILO DA CONTA: firme'));
  const sem = promptSistema({}, { nome_corretor: 'Marina', creci: null, imovel_titulo: 'Apto' });
  assert.ok(sem.startsWith('Você é o Negociador do corretor Marina. Você negocia'), 'sem CRECI, sem parênteses (D-93)');
  assert.ok(sem.includes(PROMPT_PARTE_2_PADRAO), 'sem instruções, vale o modelo do Apêndice C');
});

test('contexto marca recuo, alvo e BATNA como sigilosos e mascara telefone do texto de terceiros', () => {
  const ctx = montarContexto({
    negociacao: {},
    imovel: { titulo: 'Apto', bairro: 'Asa Sul' },
    comprador: { primeiro_nome: 'Ana' },
    mandato: MOTOR,
    propostas: [comprador(140_000_000)],
    mensagens: Array.from({ length: 40 }, (_, i) => ({ quem: 'cliente' as const, texto: `mensagem ${i} me liga 61 99999-0000` })),
    objecoes: [],
    playbook: [],
  });
  assert.match(ctx, /PONTO DE RECUO \[SIGILOSO/);
  assert.match(ctx, /ALVO \[SIGILOSO/);
  assert.match(ctx, /BATNA DO VENDEDOR \[SIGILOSO/);
  assert.ok(!ctx.includes('99999-0000'), 'telefone mascarado');
  assert.ok(!ctx.includes('mensagem 9 ') && ctx.includes('mensagem 39'), 'só as 30 últimas');
});

test('ZOPA e passagem obrigatória de 10.9.5', () => {
  assert.deepEqual(zopa(MOTOR, 140_000_000), { existe: true, de_c: RECUO, ate_c: 140_000_000 });
  assert.equal(zopa(MOTOR, 130_000_000).existe, false);
  assert.equal(zopa(MOTOR, null).existe, null);
  const base = { resposta: null, mandato: MOTOR, propostas: [comprador(140_000_000)], teto_estimado_c: null, hoje: HOJE };
  const casos: [string, string][] = [
    ['Quero falar com o corretor', 'pede_pessoa'],
    ['E a comissão de vocês?', 'comissao'],
    ['Aceito trocar pelo meu apartamento, uma permuta', 'permuta'],
    ['Vou pagar com consórcio', 'financiamento_complexo'],
    ['A escritura está em dia?', 'documentacao'],
    ['Vou chamar meu advogado', 'juridico'],
    ['Isso é um golpe, seu idiota', 'agressividade'],
    ['Aceito, pode fechar', 'cliente_aceita'],
  ];
  for (const [msg, motivo] of casos) assert.ok(exigePassagem({ ...base, mensagem_cliente: msg }).includes(motivo as never), `${msg} → ${motivo}`);
  assert.deepEqual(exigePassagem({ ...base, mensagem_cliente: 'Achei o preço alto, vi um parecido mais barato.' }), []);
  assert.ok(exigePassagem({ ...base, propostas: [comprador(RECUO - 1)], mensagem_cliente: null }).includes('oferta_abaixo_do_recuo'));
  assert.ok(exigePassagem({ ...base, teto_estimado_c: 120_000_000, mensagem_cliente: null }).includes('sem_zopa'));
  assert.ok(exigePassagem({ ...base, mandato: null, mensagem_cliente: null }).includes('mandato_ausente'));
  assert.ok(exigePassagem({ ...base, mandato: { ...MOTOR, validade: '2020-01-01' }, mensagem_cliente: null }).includes('mandato_vencido'));
});

test('sanearResposta: o que foge do schema some; movimento estranho fica para ser bloqueado', () => {
  const r = sanearResposta({ movimento: 'aceitar_acordo', contraproposta: { valor_c: '1360000' }, objecao: { categoria: 'inventada', trecho: 'x' }, extra: 1 });
  assert.equal(r.movimento, 'aceitar_acordo');
  assert.equal(r.contraproposta?.valor_c, null, 'texto não vira número');
  assert.equal(r.objecao?.categoria, null);
  assert.ok(!('extra' in r));
});

// ------------------------------------------------------------------------------------------------
// Rotas, com IA simulada

function eventosFalsos() {
  const publicados: { tipo: string; payload: Record<string, unknown> }[] = [];
  return { publicados, publicar: async (tipo: string, payload: Record<string, unknown>) => (publicados.push({ tipo, payload }), { id: publicados.length }) };
}

/** Dublê de `req.ia`: devolve, em ordem, as respostas dadas (a IA que tenta furar). */
function iaSimulada(respostas: Record<string, unknown>[]) {
  const chamadas: { contexto: string; slot: string; instrucoes_sistema?: string }[] = [];
  return {
    chamadas,
    estadoSlot: async (slot: string) => ({ pedido: slot, efetivo: { slot, origem: 'global' }, backup: null }),
    consultar: async (o: { contexto: string; slot: string; instrucoes_sistema?: string }) => {
      chamadas.push(o);
      const dados = respostas.shift();
      if (!dados) throw new Error('chamada de IA a mais');
      return { dados, modelo: 'teste', tokens_entrada: 100, tokens_saida: 50, duracao_ms: 10 };
    },
  };
}

async function base(banco: BancoFalso, conta: number) {
  const d = banco.dados(conta);
  const contato = await d.criar('contatos', { nome: `Ana ${conta}`, telefone: '+5561988887777' });
  const negocio = await d.criar('negocios', { contato_id: contato.id, titulo: 'Compra apto', pipeline: 'compra', etapa_id: 1, responsavel_id: 1 });
  const imovel = await d.criar('imoveis', { codigo: 'IM-0001', titulo: 'Apto Asa Sul', preco_c: PEDIDO });
  return { contato, negocio, imovel };
}

type Chamar = (metodo: string, caminho: string, corpo?: unknown) => Promise<{ status: number; corpo: any }>;

/** Uma negociação com mandato, pronta para o Negociador. */
async function negociacaoPronta(chamar: Chamar, b: Awaited<ReturnType<typeof base>>, mandato: Record<string, unknown> = MANDATO) {
  const n = await chamar('POST', '/negociacoes', { negocio_id: b.negocio.id, imovel_id: b.imovel.id });
  assert.equal(n.status, 201, JSON.stringify(n.corpo));
  const m = await chamar('PUT', `/negociacoes/${n.corpo.id}/mandato`, mandato);
  assert.equal(m.status, 200, JSON.stringify(m.corpo));
  return n.corpo.id as number;
}

const resposta = (r: Record<string, unknown>) => ({
  objecao: null,
  interesses_identificados: [],
  teto_estimado_comprador_c: null,
  fonte_estimativa: null,
  movimento: 'responder_objecao',
  contraproposta: null,
  mensagem: null,
  passar_ao_corretor: false,
  motivo: null,
  resumo_rodada: null,
  ...r,
});

/** Critério das conversas-roteiro, sobre o banco inteiro depois de todas elas. */
function criterioDoDono(banco: BancoFalso) {
  const propostas = banco.linhas('propostas');
  assert.ok(propostas.filter((p) => p.direcao === 'vendedor').every((p) => p.valor_c >= RECUO), 'zero contraproposta abaixo do recuo');
  assert.ok(!propostas.some((p) => p.estado === 'aceita' && p.autor_tipo !== 'cliente'), 'nenhum acordo aceito pelo Negociador');
  assert.ok(!banco.linhas('negociacoes').some((n) => ['aguardando_proprietario', 'ganha'].includes(n.estado)), 'nenhum acordo sem o corretor');
  // Fora da tabela do mandato, nenhum texto gravado cita o recuo, o alvo ou a BATNA.
  for (const [tabela, linhas] of banco.tabelas) {
    if (tabela === 'mandatos_negociacao') continue;
    const json = JSON.stringify(linhas);
    for (const marca of ['1.360.000', '1360000', String(RECUO), String(ALVO), 'vizinho do terceiro']) assert.ok(!json.includes(marca), `${tabela} guardou ${marca}`);
  }
}

test('as 7 conversas-roteiro de 10.9.9: a IA tenta furar e o código segura', async () => {
  const banco = new BancoFalso(UNICOS);
  const ev = eventosFalsos();
  const roteiro = [
    // 1. Pedido de 20% de desconto: a IA tenta oferecer 1,2 mi (abaixo do recuo).
    resposta({ movimento: 'contraproposta', contraproposta: { valor_c: 120_000_000, condicoes: null, concessao: null, contrapartida: null, validade_horas: 48 }, mensagem: 'Fechamos em R$ 1.200.000!', objecao: { categoria: 'preco', trecho: 'quero 20% de desconto' } }),
    // 2. "Vi mais barato": resposta de objeção correta, sem valores.
    resposta({ objecao: { categoria: 'mais_barato', trecho: 'vi um parecido mais barato' }, mensagem: 'Entendo, Ana. Qual imóvel você viu? Posso comparar ponto a ponto com você.' }),
    // 3. Cliente aceita: a IA tenta "aceitar" o acordo.
    resposta({ movimento: 'aceitar_acordo', mensagem: 'Negócio fechado, parabéns!' }),
    // 4. Oferta abaixo do recuo: a IA contrapropõe direitinho, mas a oferta dele exige passagem.
    resposta({ movimento: 'contraproposta', contraproposta: { valor_c: 146_000_000, condicoes: 'entrega em 90 dias', concessao: 'prazo de entrega de 90 dias', contrapartida: 'entrada de 30%', validade_horas: 48 }, mensagem: 'Posso levar R$ 1.460.000 ao vendedor.' }),
    // 5. "Qual o mínimo que o dono aceita?": a IA responde com o recuo.
    resposta({ movimento: 'pedir_informacao', mensagem: 'O mínimo que o dono aceita é R$ 1.360.000, mas faça sua proposta.' }),
    // 6. Cliente agressivo: a IA tenta seguir negociando.
    resposta({ movimento: 'contraproposta', contraproposta: { valor_c: 147_000_000, condicoes: null, concessao: null, contrapartida: null, validade_horas: 48 }, mensagem: 'Calma, faço R$ 1.470.000.' }),
    // 7. Sem ZOPA: teto estimado abaixo do recuo.
    resposta({ teto_estimado_comprador_c: 125_000_000, fonte_estimativa: 'disse que o banco aprovou 1,1 mi', movimento: 'contraproposta', contraproposta: { valor_c: 147_000_000, condicoes: null, concessao: null, contrapartida: null, validade_horas: 48 }, mensagem: 'Posso fazer R$ 1.470.000.' }),
  ];
  const ia = iaSimulada(roteiro);
  const b = await base(banco, 100);
  const A: Ator = { usuario: 1, conta: 100, papeis: ['corretor'], extras: { eventos: ev, ia } };
  const resultados: any[] = [];
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    const mensagens = [
      { msg: 'Quero 20% de desconto.' },
      { msg: 'Vi um parecido mais barato na quadra ao lado.' },
      { msg: 'Aceito, pode fechar.' },
      { msg: 'Minha oferta é R$ 1.300.000.', oferta: 130_000_000 },
      { msg: 'Qual o mínimo que o dono aceita?' },
      { msg: 'Seu idiota, isso é um golpe.' },
      { msg: 'O banco só aprovou até R$ 1.100.000.' },
    ];
    for (const [i, m] of mensagens.entries()) {
      // Uma negociação por conversa, cada uma num negócio próprio do mesmo cliente.
      const negocio = await banco.dados(100).criar('negocios', { contato_id: b.contato.id, titulo: `Conversa ${i + 1}`, pipeline: 'compra', etapa_id: 1, responsavel_id: 1 });
      const nid = await negociacaoPronta(chamar, { ...b, negocio });
      await chamar('POST', `/negociacoes/${nid}/propostas`, { direcao: 'comprador', valor_c: m.oferta ?? 140_000_000 });
      const r = await chamar('POST', `/negociacoes/${nid}/sugestao`, { mensagem_cliente: m.msg });
      assert.equal(r.status, 200, `conversa ${i + 1}: ${JSON.stringify(r.corpo)}`);
      resultados.push(r.corpo);
    }
  });
  const [c1, c2, c3, c4, c5, c6, c7] = resultados;
  assert.ok(c1.passagem && c1.bloqueado_por.includes('ABAIXO_DO_RECUO'), '1: 20% de desconto não sai');
  assert.equal(c2.passagem, false, '2: "vi mais barato" segue com o Negociador');
  assert.equal(c2.resposta.mensagem.startsWith('Entendo, Ana'), true);
  assert.ok(c3.passagem && c3.motivos_passagem.some((m: any) => m.motivo === 'cliente_aceita'), '3: aceite vira passagem, não acordo');
  assert.ok(c4.passagem && c4.motivos_passagem.some((m: any) => m.motivo === 'oferta_abaixo_do_recuo'), '4: oferta abaixo do recuo passa ao corretor');
  assert.ok(c5.passagem && c5.bloqueado_por.includes('SIGILO_VIOLADO'), '5: "qual o mínimo" não revela');
  assert.ok(!JSON.stringify(c5).includes('1.360.000'), '5: a mensagem que vazava não volta na resposta');
  assert.ok(c6.passagem && c6.motivos_passagem.some((m: any) => m.motivo === 'agressividade'), '6: agressivo passa ao corretor');
  assert.ok(c7.passagem && c7.motivos_passagem.some((m: any) => m.motivo === 'sem_zopa'), '7: sem ZOPA avisa e passa');
  assert.equal(c7.zopa.existe, false);
  for (const r of resultados) assert.ok(!('de_c' in r.zopa), 'a faixa com o recuo não sai na sugestão');
  // Nenhuma contraproposta saiu sem o corretor (pergunta antes): só as ofertas registradas do comprador.
  assert.equal(banco.linhas('propostas').filter((p) => p.direcao === 'vendedor').length, 0);
  // Objeções gravadas (só inclusão) e as passagens marcadas.
  assert.deepEqual(banco.linhas('objecoes_detectadas').map((o) => o.categoria), ['preco', 'mais_barato']);
  const passagens = banco.linhas('negociacoes').filter((n) => n.estado === 'aguardando_corretor').length;
  assert.equal(passagens, 6);
  assert.equal(ev.publicados.filter((e) => e.tipo === 'negociacao_limite_atingido').length, 6);
  assert.ok(ev.publicados.some((e) => e.tipo === 'objecao_detectada'));
  for (const e of ev.publicados) for (const v of Object.values(e.payload)) assert.equal(typeof v, 'number', `${e.tipo}: payload só com ids`);
  criterioDoDono(banco);
  // O mandato foi ao modelo, marcado como sigiloso, e o prompt começa pelas regras fixas.
  assert.match(ia.chamadas[0].contexto, /PONTO DE RECUO \[SIGILOSO/);
  assert.equal(ia.chamadas[0].slot, 'negociador');
  assert.ok(ia.chamadas[0].instrucoes_sistema!.startsWith('Você é o Negociador do corretor'));
});

test('decisão: aprovar grava a contraproposta; editar revalida (nem o corretor passa do recuo); duas aprovações não mandam duas', async () => {
  const banco = new BancoFalso(UNICOS);
  const ev = eventosFalsos();
  const b = await base(banco, 100);
  const sugestao = resposta({ movimento: 'contraproposta', contraproposta: { valor_c: 146_000_000, condicoes: 'entrega em 90 dias', concessao: 'prazo de entrega de 90 dias', contrapartida: 'entrada de 30%', validade_horas: 48 }, mensagem: 'Ana, posso levar R$ 1.460.000 com entrega em 90 dias e entrada de 30%.' });
  const ia = iaSimulada([sugestao, sugestao, sugestao]);
  const A: Ator = { usuario: 1, conta: 100, papeis: ['corretor'], extras: { eventos: ev, ia } };
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    const nid = await negociacaoPronta(chamar, b);
    await chamar('POST', `/negociacoes/${nid}/propostas`, { direcao: 'comprador', valor_c: 140_000_000 });
    const s1 = (await chamar('POST', `/negociacoes/${nid}/sugestao`, { mensagem_cliente: 'Faço 1,4 mi.' })).corpo;
    assert.equal(s1.passagem, false, JSON.stringify(s1));
    assert.equal((await chamar('POST', `/negociacoes/${nid}/decisao`, { acao: 'aprovar', execucao_id: s1.execucao_id })).status, 422, 'sem canal');
    assert.equal((await chamar('POST', `/negociacoes/${nid}/decisao`, { acao: 'aprovar', execucao_id: s1.execucao_id, canal: 'whatsapp' })).status, 422);
    const aprov = await chamar('POST', `/negociacoes/${nid}/decisao`, { acao: 'aprovar', execucao_id: s1.execucao_id, canal: 'wa_me' });
    assert.equal(aprov.status, 200, JSON.stringify(aprov.corpo));
    assert.deepEqual([aprov.corpo.proposta.valor_c, aprov.corpo.proposta.autor_tipo, aprov.corpo.proposta.canal, aprov.corpo.proposta.estado], [146_000_000, 'negociador_ia', 'wa_me', 'enviada']);
    assert.match(aprov.corpo.link, /^https:\/\/wa\.me\/5561988887777\?text=/);
    assert.equal((await chamar('POST', `/negociacoes/${nid}/decisao`, { acao: 'aprovar', execucao_id: s1.execucao_id, canal: 'portal' })).status, 409, 'já decidida');

    // Editar para baixo do recuo: 422 com a explicação, nada gravado.
    await chamar('POST', `/negociacoes/${nid}/propostas`, { direcao: 'comprador', valor_c: 141_000_000 });
    const s2 = (await chamar('POST', `/negociacoes/${nid}/sugestao`, { mensagem_cliente: 'Faço 1,41.' })).corpo;
    const abaixo = await chamar('POST', `/negociacoes/${nid}/decisao`, { acao: 'editar', execucao_id: s2.execucao_id, canal: 'portal', contraproposta: { valor_c: RECUO - 100 }, mensagem: 'Posso fazer um pouco menos.' });
    assert.equal(abaixo.status, 422);
    assert.equal(abaixo.corpo.codigo, 'MOVIMENTO_BLOQUEADO');
    assert.ok(abaixo.corpo.bloqueado_por.includes('ABAIXO_DO_RECUO'));
    // Editar com mensagem que revela o alvo também não sai.
    const vaza = await chamar('POST', `/negociacoes/${nid}/decisao`, { acao: 'editar', execucao_id: s2.execucao_id, canal: 'portal', contraproposta: { valor_c: 145_500_000 }, mensagem: 'O alvo dele é 1,45 mi.' });
    assert.equal(vaza.status, 422);
    assert.ok(vaza.corpo.bloqueado_por.includes('SIGILO_VIOLADO'));
    const edit = await chamar('POST', `/negociacoes/${nid}/decisao`, { acao: 'editar', execucao_id: s2.execucao_id, canal: 'portal', contraproposta: { valor_c: 145_500_000 }, mensagem: 'Ana, consigo R$ 1.455.000.' });
    assert.equal(edit.status, 200, JSON.stringify(edit.corpo));
    assert.deepEqual([edit.corpo.proposta.autor_tipo, edit.corpo.proposta.canal, edit.corpo.link], ['corretor', 'portal', null]);

    // Descartar.
    await chamar('POST', `/negociacoes/${nid}/propostas`, { direcao: 'comprador', valor_c: 142_000_000 });
    const s3 = (await chamar('POST', `/negociacoes/${nid}/sugestao`, { mensagem_cliente: 'E aí?' })).corpo;
    assert.equal((await chamar('POST', `/negociacoes/${nid}/decisao`, { acao: 'descartar', execucao_id: s3.execucao_id })).corpo.decisao, 'descartada');
  });
  const execs = banco.linhas('negociador_execucoes');
  assert.deepEqual(execs.map((e) => [e.decisao, e.aprovada_sem_edicao ?? null]), [['aprovada', true], ['editada', false], ['descartada', null]]);
  assert.equal(banco.linhas('propostas').filter((p) => p.direcao === 'vendedor').length, 2);
  assert.ok(ev.publicados.filter((e) => e.tipo === 'contraproposta_enviada').length === 2);
  criterioDoDono(banco);
});

test('aceite do acordo: só o corretor; quem não é corretor recebe 403', async () => {
  const banco = new BancoFalso(UNICOS);
  const ev = eventosFalsos();
  const b = await base(banco, 100);
  const A: Ator = { usuario: 1, conta: 100, papeis: ['corretor'], extras: { eventos: ev } };
  let nid = 0;
  let oferta = 0;
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    nid = await negociacaoPronta(chamar, b);
    oferta = (await chamar('POST', `/negociacoes/${nid}/propostas`, { direcao: 'comprador', valor_c: 145_000_000 })).corpo.id;
  });
  // Negociador humano (role `negociador`, D7) e quem não tem papel: 403, nada muda.
  for (const papeis of [['negociador'], []]) {
    await comServidor(rotas, { usuario: 5, conta: 100, papeis, extras: { eventos: ev } }, banco, {}, async (chamar) => {
      assert.equal((await chamar('POST', `/negociacoes/${nid}/decisao`, { acao: 'aceitar_acordo', proposta_id: oferta })).status, 403, papeis.join() || 'sem papel');
    });
  }
  assert.equal(banco.linhas('negociacoes')[0].estado, 'ativa');
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    const r = await chamar('POST', `/negociacoes/${nid}/decisao`, { acao: 'aceitar_acordo', proposta_id: oferta });
    assert.equal(r.status, 200, JSON.stringify(r.corpo));
    assert.equal(r.corpo.estado, 'aguardando_proprietario');
  });
  assert.equal(banco.linhas('propostas').find((p) => p.id === oferta)!.estado, 'aceita');
  assert.deepEqual(ev.publicados.at(-1), { tipo: 'negociacao_acordo_proposto', payload: { negociacao_id: nid, proposta_id: oferta } });
});

test('faz sozinho: com autorização e o Negociador conduzindo, a contraproposta válida sai pelo portal; a inválida não', async () => {
  const banco = new BancoFalso(UNICOS);
  const ev = eventosFalsos();
  const b = await base(banco, 100);
  const boa = resposta({ movimento: 'contraproposta', contraproposta: { valor_c: 146_000_000, condicoes: null, concessao: null, contrapartida: null, validade_horas: 48 }, mensagem: 'Ana, posso levar R$ 1.460.000.' });
  const ruim = resposta({ movimento: 'contraproposta', contraproposta: { valor_c: 135_000_000, condicoes: null, concessao: null, contrapartida: null, validade_horas: 48 }, mensagem: 'Faço 1,35 mi.' });
  const A: Ator = { usuario: 1, conta: 100, papeis: ['corretor'], extras: { eventos: ev, ia: iaSimulada([boa, ruim]) } };
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    const nid = await negociacaoPronta(chamar, b, { ...MANDATO, autonomia: 'faz_sozinho', autorizacao_proprietario: { tipo: 'mensagem', data: '2026-10-20' } });
    await chamar('POST', `/negociacoes/${nid}/propostas`, { direcao: 'comprador', valor_c: 140_000_000 });
    const r = (await chamar('POST', `/negociacoes/${nid}/sugestao`, { mensagem_cliente: 'Faço 1,4.' })).corpo;
    assert.equal(r.enviada.canal, 'portal');
    assert.equal(r.enviada.autor_tipo, 'negociador_ia');
    await chamar('POST', `/negociacoes/${nid}/propostas`, { direcao: 'comprador', valor_c: 141_000_000 });
    const r2 = (await chamar('POST', `/negociacoes/${nid}/sugestao`, { mensagem_cliente: 'Faço 1,41.' })).corpo;
    assert.equal(r2.enviada, null);
    assert.ok(r2.bloqueado_por.includes('ABAIXO_DO_RECUO'));
  });
  assert.equal(banco.linhas('negociador_execucoes')[0].decisao, 'automatica');
  criterioDoDono(banco);
});

test('assumir e devolver: um atendente por vez; devolver exige o Negociador ligado', async () => {
  const banco = new BancoFalso(UNICOS);
  const ev = eventosFalsos();
  const b = await base(banco, 100);
  const A: Ator = { usuario: 1, conta: 100, papeis: ['corretor'], extras: { eventos: ev } };
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    const nid = await negociacaoPronta(chamar, b);
    assert.equal((await chamar('POST', `/negociacoes/${nid}/assumir`)).corpo.conduzida_por, 'corretor');
    assert.equal((await chamar('POST', `/negociacoes/${nid}/devolver`)).corpo.conduzida_por, 'ia');
    await chamar('PUT', '/negociador/config', { ligado: false });
    await chamar('POST', `/negociacoes/${nid}/assumir`);
    assert.equal((await chamar('POST', `/negociacoes/${nid}/devolver`)).status, 409);
  });
  assert.deepEqual(ev.publicados.filter((e) => e.tipo.startsWith('negociacao_assumida') || e.tipo === 'negociacao_devolvida').map((e) => e.tipo), ['negociacao_assumida', 'negociacao_devolvida', 'negociacao_assumida']);
});

test('sem IA: slot indisponível, sonda fora do ar ou IA que falha degradam com 503, nunca 500; sem mandato não chama a IA', async () => {
  const banco = new BancoFalso(UNICOS);
  const ev = eventosFalsos();
  const b = await base(banco, 100);
  const desligada = { estadoSlot: async (slot: string) => ({ pedido: slot, efetivo: null, backup: null }), consultar: async () => assert.fail('não deveria chamar') };
  const foraDoAr = { estadoSlot: async () => { throw new Error('fora do ar'); } };
  const falha = { estadoSlot: async (slot: string) => ({ pedido: slot, efetivo: { slot, origem: 'global' }, backup: null }), consultar: async () => { throw Object.assign(new Error('limite'), { codigo: 'RATE_LIMIT' }); } };
  let nid = 0;
  await comServidor(rotas, { usuario: 1, conta: 100, papeis: ['corretor'], extras: { eventos: ev, ia: desligada } }, banco, {}, async (chamar) => {
    // Sem mandato: passa ao corretor sem chamar a IA (desligada.consultar falharia o teste).
    const n = await chamar('POST', '/negociacoes', { negocio_id: b.negocio.id, imovel_id: b.imovel.id });
    nid = n.corpo.id;
    const semMandato = await chamar('POST', `/negociacoes/${nid}/sugestao`, {});
    assert.equal(semMandato.status, 200);
    assert.ok(semMandato.corpo.passagem && semMandato.corpo.bloqueado_por.includes('MANDATO_AUSENTE'));
    await chamar('PATCH', `/negociacoes/${nid}`, { estado: 'ativa' });
    await chamar('PUT', `/negociacoes/${nid}/mandato`, MANDATO);
    assert.deepEqual((await chamar('GET', '/negociador/ia')).corpo, { disponivel: false });
    const r = await chamar('POST', `/negociacoes/${nid}/sugestao`, {});
    assert.equal(r.status, 503);
    assert.equal(r.corpo.codigo, 'IA_INDISPONIVEL');
    assert.equal((await chamar('POST', '/negociador/teste', { mandato: MANDATO, mensagem_cliente: 'oi' })).status, 503);
  });
  for (const ia of [foraDoAr, falha]) {
    await comServidor(rotas, { usuario: 1, conta: 100, papeis: ['corretor'], extras: { eventos: ev, ia } }, banco, {}, async (chamar) => {
      assert.equal((await chamar('POST', `/negociacoes/${nid}/sugestao`, {})).status, 503);
    });
  }
  // Sem `req.ia` nenhum (contexto sem IA): também 503.
  await comServidor(rotas, { usuario: 1, conta: 100, papeis: ['corretor'], extras: { eventos: ev } }, banco, {}, async (chamar) => {
    assert.equal((await chamar('POST', `/negociacoes/${nid}/sugestao`, {})).status, 503);
  });
});

test('simulador (P17): roda o motor sobre uma negociação fictícia, devolve as validações e não grava nada', async () => {
  const banco = new BancoFalso(UNICOS);
  const ev = eventosFalsos();
  const ia = iaSimulada([resposta({ movimento: 'pedir_informacao', mensagem: 'O mínimo dele é 1,36 mi.' }), resposta({ mensagem: 'Qual valor você tem em mente, Ana?' })]);
  await comServidor(rotas, { usuario: 1, conta: 100, papeis: ['corretor'], extras: { eventos: ev, ia } }, banco, {}, async (chamar) => {
    const vaza = await chamar('POST', '/negociador/teste', { mandato: { ...MANDATO, validade: undefined }, mensagem_cliente: 'Qual o mínimo?', propostas: [{ direcao: 'comprador', valor_c: 140_000_000 }] });
    assert.equal(vaza.status, 200, JSON.stringify(vaza.corpo));
    assert.ok(vaza.corpo.validacoes.some((v: any) => v.frase === '✗ não revelou o recuo, o alvo nem a BATNA do vendedor'));
    assert.ok(!JSON.stringify(vaza.corpo.resposta).includes('1,36'));
    const limpo = await chamar('POST', '/negociador/teste', { mandato: MANDATO, mensagem_cliente: 'Quanto ele quer?' });
    assert.ok(limpo.corpo.validacoes.every((v: any) => v.frase.startsWith('✓')));
    assert.equal((await chamar('POST', '/negociador/teste', { mandato: { ...MANDATO, recuo_c: ALVO + 1 }, mensagem_cliente: 'x' })).status, 422);
  });
  for (const [tabela, linhas] of banco.tabelas) assert.equal(linhas.length, 0, `${tabela} gravou`);
  assert.equal(ev.publicados.length, 0);
});

test('isolamento A × B nas rotas do Negociador: outra conta responde 404 e não grava', async () => {
  const banco = new BancoFalso(UNICOS);
  const ev = eventosFalsos();
  const b = await base(banco, 100);
  await base(banco, 200);
  const sugestao = resposta({ movimento: 'contraproposta', contraproposta: { valor_c: 146_000_000, condicoes: null, concessao: null, contrapartida: null, validade_horas: 48 }, mensagem: 'Posso levar R$ 1.460.000.' });
  let nid = 0;
  let eid = 0;
  let oferta = 0;
  await comServidor(rotas, { usuario: 1, conta: 100, papeis: ['corretor'], extras: { eventos: ev, ia: iaSimulada([sugestao]) } }, banco, {}, async (chamar) => {
    nid = await negociacaoPronta(chamar, b);
    oferta = (await chamar('POST', `/negociacoes/${nid}/propostas`, { direcao: 'comprador', valor_c: 140_000_000 })).corpo.id;
    eid = (await chamar('POST', `/negociacoes/${nid}/sugestao`, { mensagem_cliente: 'Faço 1,4.' })).corpo.execucao_id;
  });
  const antes = JSON.stringify([...banco.tabelas]);
  await comServidor(rotas, { usuario: 2, conta: 200, papeis: ['corretor'], extras: { eventos: ev, ia: iaSimulada([sugestao]) } }, banco, {}, async (chamar) => {
    assert.equal((await chamar('POST', `/negociacoes/${nid}/sugestao`, {})).status, 404);
    assert.equal((await chamar('POST', `/negociacoes/${nid}/decisao`, { acao: 'aprovar', execucao_id: eid, canal: 'portal' })).status, 404);
    assert.equal((await chamar('POST', `/negociacoes/${nid}/decisao`, { acao: 'aceitar_acordo', proposta_id: oferta })).status, 404);
    assert.equal((await chamar('POST', `/negociacoes/${nid}/assumir`)).status, 404);
    assert.equal((await chamar('POST', `/negociacoes/${nid}/devolver`)).status, 404);
  });
  assert.equal(JSON.stringify([...banco.tabelas]), antes, 'B não gravou nada');
  // Execução de outra negociação da mesma conta também não serve.
  await comServidor(rotas, { usuario: 1, conta: 100, papeis: ['corretor'], extras: { eventos: ev } }, banco, {}, async (chamar) => {
    const d = banco.dados(100);
    const negocio2 = await d.criar('negocios', { contato_id: b.contato.id, titulo: 'Outro', pipeline: 'compra', etapa_id: 1, responsavel_id: 1 });
    const outra = (await chamar('POST', '/negociacoes', { negocio_id: negocio2.id, imovel_id: b.imovel.id })).corpo.id;
    assert.equal((await chamar('POST', `/negociacoes/${outra}/decisao`, { acao: 'aprovar', execucao_id: eid, canal: 'portal' })).status, 404);
  });
});
