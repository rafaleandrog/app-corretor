import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MOVIMENTO_FORA_DA_LISTA, exigePassagem, sanearResposta, validarMovimento, valoresCitados, vazamentos, vazamentosNoRegistro, type MandatoMotor, type PropostaResumo } from '../comum/negociador';

// Sigilo do Negociador (10.9.7, garantia 5), revisão do PR #115: recuo, alvo e BATNA não saem em
// nenhum formato nem por pista derivada do preço pedido, em nenhum texto que chega ao cliente ou fica
// guardado; e o vocabulário normal de imóvel não retém mensagem.

// R$ 1.500.000 pedido, alvo R$ 1.450.000, recuo R$ 1.360.000 (em centavos).
const PEDIDO = 150_000_000;
const ALVO = 145_000_000;
const RECUO = 136_000_000;
const MOTOR: MandatoMotor = {
  preco_pedido_c: PEDIDO,
  alvo_c: ALVO,
  recuo_c: RECUO,
  batna_vendedor: 'Manter anunciado por sessenta dias e esperar a proposta do vizinho do terceiro andar',
  concessoes: [{ item: 'prazo de entrega de 90 dias', limite: '90 dias', contrapartida: 'entrada de 30%' }],
  passo_max_pct: 0.4,
  rodadas_max: 4,
  validade: '2099-12-31',
  autonomia: 'pergunta_antes',
  autorizacao_proprietario: null,
};
const HOJE = '2026-10-28';
const PERMITIDOS = [146_000_000, PEDIDO, 140_000_000];
const comprador = (valor_c: number): PropostaResumo => ({ direcao: 'comprador', valor_c });

const NORMAIS = [
  // As 6 do roteiro (testes/negociador.test.ts).
  'Entendo, Ana. O que pesa mais para você: o valor total ou a entrada?',
  'Posso levar ao vendedor R$ 1.460.000 com entrega em 90 dias, válido por 48 horas.',
  'O apartamento tem 3 quartos e 2 vagas, e o R$/m² está em 9.800 na quadra.',
  'Comparando com os imóveis da região, o preço de R$ 1.500.000 já considera a reforma recente.',
  'Vamos marcar uma visita no sábado às 10h para você ver de novo?',
  'Recebi sua proposta de R$ 1.400.000. Vou conversar com o vendedor e te retorno até amanhã.',
  // Vocabulário de imóvel (achado 4).
  'O piso é de porcelanato em todos os cômodos.',
  'O apartamento fica no 5º piso, de frente para o parque.',
  'É um condomínio fechado, com portaria 24 horas.',
  'Vi que o seu processo de financiamento foi aprovado, ótimo.',
  'Você procura no mínimo 3 quartos, certo? Este tem 4.',
  'O imóvel tem 2 suítes, 1 vaga e 120 m² de área útil.',
  'A entrada de 10% já ajuda; o restante pode ser financiado.',
];

test('achado 1: recuo e alvo em M, kk, k, milhar com espaço e "mil" com ponto são pegos', () => {
  const vazam = [
    'Faço R$ 1,36M.',
    'Faço 1,36 M.',
    'Faço 1.36kk.',
    'Faço 1,36 kk.',
    'Faço R$ 1 360 000.',
    'Faço 1 360 000,00.',
    'Faço R$ 1.360 mil.',
    'Faço 1360k.',
    'O alvo é R$ 1,45M.',
    'Chego a 1 450 000.',
    'Fica em 1.450 mil.',
  ];
  for (const m of vazam) assert.ok(vazamentos(m, MOTOR, [146_000_000, PEDIDO]).length > 0, `deveria pegar: ${m}`);
  assert.deepEqual(valoresCitados('R$ 1,36M'), [1360000]);
  assert.deepEqual(valoresCitados('1.36kk'), [1360000]);
  assert.deepEqual(valoresCitados('R$ 1 360 000'), [1360000]);
  assert.deepEqual(valoresCitados('1 360 000,00'), [1360000]);
  assert.deepEqual(valoresCitados('R$ 1.360 mil'), [1360000]);
  assert.deepEqual(valoresCitados('1360k'), [1360000]);
  assert.deepEqual(valoresCitados('3 quartos e 2 vagas'), [3, 2]);
  assert.deepEqual(valoresCitados('2 suítes, 1 vaga'), [2, 1]);
  assert.deepEqual(valoresCitados('120 m² e 2 vagas'), [120, 2], 'm² não é milhão');
});

test('achado 2: validarMovimento varre mensagem, condições, concessão e contrapartida', () => {
  const e = [comprador(140_000_000)];
  const base = { valor_c: 146_000_000, condicoes: null, concessao: null, contrapartida: null, validade_horas: 48 };
  const sigilo = (contraproposta: typeof base | Record<string, unknown>, mensagem: string | null = 'Posso levar R$ 1.460.000.') =>
    validarMovimento({ movimento: 'contraproposta', contraproposta: { ...base, ...contraproposta } as typeof base, mensagem }, MOTOR, e, { hoje: HOJE, canal: 'portal' }).bloqueado_por;
  assert.deepEqual(sigilo({}, 'Faço 1,36M.'), ['SIGILO_VIOLADO'], 'mensagem');
  assert.deepEqual(sigilo({ condicoes: 'à vista; abaixo disso ele não vende' }), ['SIGILO_VIOLADO'], 'condições');
  // A concessão casa com o item do mandato ("inclui"), mas o texto a mais vaza: pego pelo sigilo.
  assert.deepEqual(sigilo({ concessao: 'prazo de entrega de 90 dias; nosso mínimo é 1.360.000', contrapartida: 'entrada de 30%' }), ['SIGILO_VIOLADO'], 'concessão');
  assert.deepEqual(sigilo({ concessao: 'prazo de entrega de 90 dias', contrapartida: 'entrada de 30%, e o alvo é 1,45 mi' }), ['SIGILO_VIOLADO'], 'contrapartida');
  assert.deepEqual(sigilo({ concessao: 'prazo de entrega de 90 dias', contrapartida: 'entrada de 30%' }), [], 'o normal passa');
  // Os textos que o motor só guarda: vazamentosNoRegistro.
  const reg = vazamentosNoRegistro(
    { fonte_estimativa: 'disse que o banco aprovou 600 mil', resumo_rodada: 'Ofereci 1,46 mi; o recuo dele é 1,36M', motivo: null, interesses_identificados: ['prazo', 'piso dele é 1.360 mil'] },
    MOTOR,
    PERMITIDOS,
  );
  assert.deepEqual(reg.map((r) => r.campo), ['resumo_rodada', 'interesses_identificados']);
  assert.deepEqual(vazamentosNoRegistro({ fonte_estimativa: 'disse que o banco aprovou 600 mil', resumo_rodada: 'Comprador quer prazo.', motivo: 'pediu permuta', interesses_identificados: ['prazo'] }, MOTOR, PERMITIDOS), []);
  // Rodada 2: valor na faixa de preço fora dos públicos é retido do lado seguro, mesmo sendo do comprador.
  assert.deepEqual(vazamentosNoRegistro({ fonte_estimativa: 'disse que o banco aprovou 1,1 mi' }, MOTOR, PERMITIDOS).map((r) => r.campo), ['fonte_estimativa']);
});

test('achado 3: percentual e diferença sobre o pedido que levam ao recuo ou ao alvo vazam', () => {
  const vazam = [
    'Fica 9,33% abaixo do pedido.',
    'Consigo um desconto de 9%.',
    'Dá para chegar a 3,33% de desconto.',
    'Fica 140 mil abaixo do pedido.',
    'São R$ 140.000 a menos.',
    'Posso baixar 50 mil.',
    'Um desconto de cento e quarenta mil.',
  ];
  for (const m of vazam) assert.ok(vazamentos(m, MOTOR, [146_000_000, PEDIDO]).length > 0, `deveria pegar: ${m}`);
  // Levando ao valor da própria contraproposta (R$ 1.460.000 = 2,67% abaixo), é permitido.
  const permitidas = ['São R$ 40 mil abaixo do pedido.', 'Um desconto de 2,67% sobre o pedido.', 'Dá 3% de desconto.', 'Um desconto de R$ 40.000.'];
  for (const m of permitidas) assert.deepEqual(vazamentos(m, MOTOR, [146_000_000, PEDIDO]), [], m);
  // Sem o preço pedido no mandato, a pista derivada não é checada (mas o valor direto continua).
  const { preco_pedido_c: _p, ...semPedido } = MOTOR;
  assert.deepEqual(vazamentos('Consigo um desconto de 9%.', semPedido, []), []);
});

test('achado 3: BATNA curta é checada sem disparar em "proposta" ou "comprador" isolados', () => {
  const curta = { ...MOTOR, batna_vendedor: 'outro comprador' };
  for (const m of ['Ele tem outro comprador interessado.', 'Há outros compradores olhando o imóvel.', 'Existe outro possível comprador.'])
    assert.ok(vazamentos(m, curta, PERMITIDOS).includes('cita a BATNA do vendedor'), m);
  for (const m of ['Recebi a proposta do comprador.', 'O comprador quer visitar de novo.', 'Pode fazer outra proposta?', ...NORMAIS])
    assert.deepEqual(vazamentos(m, curta, PERMITIDOS), [], m);
  const uma = { ...MOTOR, batna_vendedor: 'alugar' };
  assert.ok(vazamentos('Se não vender, o proprietário vai alugar.', uma, PERMITIDOS).length > 0);
  assert.deepEqual(vazamentos('Dá para alugar fácil na região, se você quiser investir.', uma, PERMITIDOS), []);
});

test('achado 4: vocabulário de imóvel não retém; frases de limite e de passagem continuam pegas', () => {
  for (const m of NORMAIS) assert.deepEqual(vazamentos(m, MOTOR, PERMITIDOS), [], m);
  const limite = ['O mínimo que ele aceita é outro.', 'O piso dele é outro.', 'Abaixo disso ele não vende.', 'O dono aceita até onde você disse.', 'Ele topa um pouco menos.', 'Qual o mínimo?'];
  for (const m of limite) assert.ok(vazamentos(m, MOTOR, PERMITIDOS).length > 0, `deveria pegar: ${m}`);
  const base = { resposta: null, mandato: MOTOR, propostas: [comprador(140_000_000)], teto_estimado_c: null, hoje: HOJE };
  for (const m of NORMAIS) assert.deepEqual(exigePassagem({ ...base, mensagem_cliente: m }), [], m);
  const casos: [string, string][] = [
    ['Aceito, pode fechar', 'cliente_aceita'],
    ['Fechou!', 'cliente_aceita'],
    ['Fechado, pode mandar o contrato.', 'cliente_aceita'],
    ['Vou processar vocês', 'juridico'],
    ['Vou falar com meu advogado', 'juridico'],
  ];
  for (const [m, motivo] of casos) assert.ok(exigePassagem({ ...base, mensagem_cliente: m }).includes(motivo as never), `${m} → ${motivo}`);
});

test('achado 5: valoresCitados não vira bilhão e lê "mil e quinhentos"', () => {
  const v = valoresCitados('R$ 1.300.000 e vinte mil');
  assert.ok(v.every((x) => x < 1e9), `sem bilhão: ${v}`);
  assert.deepEqual(v, [1320000]);
  assert.deepEqual(valoresCitados('mil e quinhentos'), [1500]);
  assert.deepEqual(valoresCitados('1.300.000 e 1.400.000'), [1300000, 1400000]);
  assert.deepEqual(valoresCitados('1 milhão e 360 mil'), [1360000]);
  assert.deepEqual(valoresCitados('um milhão e trezentos e sessenta mil'), [1360000]);
  assert.deepEqual(valoresCitados('1,365 milhão'), [1365000]);
  assert.deepEqual(valoresCitados('1,5 mil'), [1500]);
});

// ------------------------------------------------------------------------------------------------
// Rodada 2 da revisão do PR #115: lista de proibidos não fecha. Na faixa de preço do imóvel (de metade
// do recuo a 1,5 vez o pedido) só passam valores públicos; o resto é bloqueio, mesmo longe do recuo.

/** Normais da rodada 2: nenhuma delas pode ser retida. */
const NORMAIS_2 = [
  'A entrada de 30% já ajuda.',
  'A entrada de 30% do valor pode vir do FGTS.',
  'Dá para financiar 80% do valor.',
  'O m² está em R$ 9.800 o m² na quadra.',
  'O condomínio de R$ 1.200 inclui água.',
  'O IPTU de R$ 4.500 por ano é baixo.',
  'São 3 quartos e 2 vagas.',
  'A proposta vale por 48 horas.',
  'Posso levar R$ 1.460.000 ao vendedor.',
  'Comparando, o preço de R$ 1.500.000 já considera a reforma.',
  'O terreno tem 10 m de frente.',
  'O pé-direito é de 2,80 m.',
  'Tem 2,80 m de pé-direito.',
  'O condomínio aceita até dois pets.',
  'O banco aceita até 30 anos de prazo.',
  'O mínimo exigido pelo banco é 20% de entrada.',
  'Abaixo disso o banco não avalia.',
  'Você quer pelo menos 2 vagas, certo?',
  'Ao menos 3 quartos, combinado.',
  'O condomínio é baixo, R$ 1.200.',
  'A entrada de R$ 450 mil já ajuda.',
  'O prédio foi reformado em 2024.',
  'Prazo de entrega de 90 dias; entrada de 30%.',
  'Comparando, o m² aqui está 5% abaixo da média do bairro.',
  'Posso tirar 2 dias do prazo de entrega.',
  'Reduzindo o prazo para 30 dias, fica bom?',
  'Um desconto de 2,67% sobre o pedido.',
  'Dá 3% de desconto.',
  'Visita às 10h30 de sábado?',
];

test('rodada 2 (achado 1): o que a revisão achou escapando agora é pego', () => {
  const recuo150 = { ...MOTOR, preco_pedido_c: 170_000_000, alvo_c: 160_000_000, recuo_c: 150_000_000 };
  const recuo120 = { ...MOTOR, preco_pedido_c: 140_000_000, alvo_c: 130_000_000, recuo_c: 120_000_000 };
  const casos: [string, Pick<MandatoMotor, 'recuo_c' | 'alvo_c' | 'batna_vendedor' | 'preco_pedido_c'>][] = [
    ['Podemos chegar num milhão e meio.', recuo150],
    ['Fica em um milhão e duzentos.', recuo120],
    ['Faço um vírgula trinta e seis milhões.', MOTOR],
    ['Dá pra pagar 9% menos que o anunciado.', MOTOR],
    ['Reduzindo 140 mil, fecha.', MOTOR],
    ['Descontando 9%, fecha.', MOTOR],
    ['Baixando 140 mil, fecha.', MOTOR],
    ['Baixando 140, fecha.', MOTOR],
    ['Tirando 9% dá.', MOTOR],
    ['Cortando 140 mil.', MOTOR],
    ['Abatendo 140 mil.', MOTOR],
    ['Fecho 9 por cento abaixo do pedido.', MOTOR],
    ['Chego a 91% do pedido.', MOTOR],
    ['Fica 9% do anunciado.', MOTOR],
    ['Faço 1,36.', MOTOR],
    ['Faço 1,36 e entrega em 90 dias.', MOTOR],
    ['Faço um milhão e trezentos e sessenta.', MOTOR],
    ['Faço R$ 1,36M.', MOTOR],
    ['Faço 1,36 m.', MOTOR],
  ];
  for (const [m, mandato] of casos) {
    const permitidos = [mandato.preco_pedido_c!, mandato.preco_pedido_c! - 4_000_000];
    assert.ok(vazamentos(m, mandato, permitidos).length > 0, `deveria pegar: ${m}`);
  }
  assert.deepEqual(valoresCitados('um milhão e meio'), [1500000]);
  assert.deepEqual(valoresCitados('1 milhão e meio'), [1500000]);
  assert.deepEqual(valoresCitados('meio milhão'), [500000]);
  assert.deepEqual(valoresCitados('um milhão e duzentos'), [1200000]);
  assert.deepEqual(valoresCitados('um vírgula trinta e seis milhões'), [1360000]);
  assert.deepEqual(valoresCitados('um milhão e trezentos e sessenta'), [1360000]);
});

test('rodada 2 (achado 1): falha do lado seguro — leitura imperfeita na faixa de preço vira bloqueio', () => {
  // Nenhum destes está a ±1% do recuo ou do alvo, mas todos estão na faixa e não são públicos.
  for (const m of ['Faço 1.000.200.', 'Fica em 1,2 mi.', 'Faço 1.300.000.', 'Um parecido saiu por 1,7 mi.', 'Fica em 700 mil.', 'Faço 2,2 milhões.'])
    assert.ok(vazamentos(m, MOTOR, PERMITIDOS).length > 0, `deveria reter: ${m}`);
  // Os públicos (±0,1%) passam: a contraproposta, o pedido e as propostas trocadas.
  for (const m of ['Posso levar R$ 1.460.000.', 'O pedido é 1,5 mi.', 'Sua proposta de 1,4 mi foi recebida.', 'Faço 1,46.'])
    assert.deepEqual(vazamentos(m, MOTOR, PERMITIDOS), [], m);
  // Abaixo de metade do recuo ou acima de 1,5 vez o pedido, fora da faixa: não é preço do imóvel.
  for (const m of ['A entrada de R$ 450 mil já ajuda.', 'O prédio vale uns 30 milhões.']) assert.deepEqual(vazamentos(m, MOTOR, PERMITIDOS), [], m);
  // O pedido do mandato é sempre permitido, mesmo sem vir na lista.
  assert.deepEqual(vazamentos('O preço é R$ 1.500.000.', MOTOR, []), []);
  // Redução que leva a valor fora da faixa (60% de desconto = 600 mil) não diz nada do recuo.
  assert.deepEqual(vazamentos('Nem com 60% de desconto.', MOTOR, PERMITIDOS), []);
});

test('rodada 2 (achado 1): frases normais continuam passando, no motor e na passagem', () => {
  for (const m of [...NORMAIS, ...NORMAIS_2]) assert.deepEqual(vazamentos(m, MOTOR, PERMITIDOS), [], m);
  assert.deepEqual(valoresCitados('terreno com 10 m de frente'), [10], '10 m de frente não é 10 milhões');
  assert.deepEqual(valoresCitados('pé-direito de 2,80 m'), [2.8]);
  assert.deepEqual(valoresCitados('R$ 1,36M'), [1360000]);
  assert.deepEqual(valoresCitados('1,36 m'), [1360000], 'decimal com "m" solto é milhão');
  assert.deepEqual(valoresCitados('R$ 2 m'), [2000000], '"R$" antes faz do "m" milhão');
});

test('rodada 2 (achado 2): movimento fora da lista vira código fixo e continua bloqueado', () => {
  const r = sanearResposta({ movimento: 'aceitar_acordo; o recuo é 1,36M', mensagem: 'Fechado!' });
  assert.equal(r.movimento, MOVIMENTO_FORA_DA_LISTA);
  assert.ok(!JSON.stringify(r).includes('1,36M'), 'o texto livre do movimento não é guardado');
  assert.equal(sanearResposta({ movimento: 42 }).movimento, MOVIMENTO_FORA_DA_LISTA);
  assert.equal(sanearResposta({}).movimento, 'passar_ao_corretor');
  assert.equal(sanearResposta({ movimento: 'contraproposta' }).movimento, 'contraproposta');
  const v = validarMovimento({ movimento: r.movimento, contraproposta: null, mensagem: r.mensagem }, MOTOR, [], { hoje: HOJE, canal: 'portal' });
  assert.equal(v.ok, false);
  assert.equal(v.passa_ao_corretor, true);
  assert.ok(v.bloqueado_por.includes('MOVIMENTO_INVALIDO'));
});

test('rodada 2 (achado 3): frase de limite exige o vendedor como sujeito', () => {
  const pegam = [
    'O dono aceita até onde você disse.',
    'Ele topa um pouco menos.',
    'O mínimo que ele aceita é outro.',
    'Abaixo disso ele não vende.',
    'Abaixo disso, o proprietário não vende.',
    'O piso dele é outro.',
    'O limite do vendedor é outro.',
    'Nosso mínimo é outro.',
    'A vendedora fecharia por menos.',
    'Qual o mínimo?',
  ];
  for (const m of pegam) assert.ok(vazamentos(m, MOTOR, PERMITIDOS).includes('fala em mínimo, piso ou limite do vendedor'), `deveria pegar: ${m}`);
  const passam = ['O condomínio aceita até dois pets.', 'O banco aceita até 30 anos.', 'O mínimo exigido pelo banco é 20%.', 'Abaixo disso o banco não avalia.', 'O mínimo que o banco pede é a entrada.'];
  for (const m of passam) assert.deepEqual(vazamentos(m, MOTOR, PERMITIDOS), [], m);
});
