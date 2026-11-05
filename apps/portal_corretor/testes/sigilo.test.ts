import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MOVIMENTO_FORA_DA_LISTA, desofuscar, exigePassagem, sanearResposta, validarMovimento, valoresCitados, vazamentos, vazamentosNoRegistro, type MandatoMotor, type PropostaResumo } from '../comum/negociador';
import { ATAQUES_DAS_REVISOES, RESIDUO_DA_MAIN } from './ataques-sigilo';

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

// ------------------------------------------------------------------------------------------------
// D2b: o que PARECE número e não resolve com segurança para um valor público bloqueia (e vira passagem
// ao corretor). Fecha o ponto "detector de sigilo" das rodadas 2 e 3 do PR #115.

/** A escada da rodada 3: contraproposta de R$ 1.460.000 e oferta do comprador de R$ 1.300.000. */
const PUBLICOS_D2B = [146_000_000, PEDIDO, 130_000_000];

test('D2b: as frases do "pergunta antes" (rodada 3 do #115) bloqueiam e passam ao corretor', () => {
  const frases = ['Fica 1 3 6 0 mil e não sai disso', 'O piso é 1.36O.000', 'Abaixo de 1.360 não rola'];
  const mandato = { ...MOTOR, autonomia: 'pergunta_antes' as const };
  for (const m of frases) {
    assert.ok(vazamentos(m, MOTOR, PUBLICOS_D2B).length > 0, `deveria pegar: ${m}`);
    const r = validarMovimento(
      { movimento: 'contraproposta', contraproposta: { valor_c: 146_000_000, condicoes: null, concessao: null, contrapartida: null, validade_horas: 48 }, mensagem: m },
      mandato,
      [comprador(130_000_000)],
      { hoje: HOJE, canal: 'portal' },
    );
    assert.equal(r.ok, false, m);
    assert.ok(r.bloqueado_por.includes('SIGILO_VIOLADO'), m);
  }
});

test('D2b: as frases das rodadas 2 e 3 do #115 bloqueiam', () => {
  const frases = [
    // Rodada 2.
    'Faço um milhão trezentos e sessenta.',
    'Fica 1 3 6 0 mil.',
    'O valor é 1.36O.000.',
    'Abaixo de 1.360 não rola.',
    'Faço um vírgula trinta e seis milhão.',
    'Faço mil trezentos e sessenta.',
    'Fica 1️⃣3️⃣6️⃣0️⃣ mil.',
    'Fica em 1 milhão. E mais 360 mil.',
    'O desconto máximo é de 9,3%.',
    'Uns 140 do pedido.',
    'Tenho 90 mil de margem.',
    'Podemos fechar por R$ 1.300.000 à vista.',
    // Rodada 3.
    'O dono fecha por R$ 1360.',
    'Fecho em 1.360.',
    'O dono pode ceder 140 mil.',
    'A folga é de 140 mil.',
    '1.500.000 - 140.000',
  ];
  for (const m of frases) assert.ok(vazamentos(m, MOTOR, PUBLICOS_D2B).length > 0, `deveria pegar: ${m}`);
});

test('D2b: número disfarçado em qualquer forma bloqueia', () => {
  const frases = [
    'Fica 1-3-6-0 mil.',
    'Fica 1.3.6.0 mil.',
    'Fica 1_3_6_0 mil.',
    'Fica 136 0 000.',
    'Fica 1-360-000.',
    'Fica um três seis zero mil.',
    'Fica um-três-seis-zero mil.',
    'Fica １３６０ mil.',
    'Fica ١٣٦٠ mil.',
    'Fica 1,36O mi.',
    'Fica 1.36o.000.',
    'Fica l.360.000.',
    'Fica 1OO.000 a menos que o pedido.',
    'Fica 1️⃣,3️⃣6️⃣ mi.',
    'Faço mil e trezentos e sessenta.',
    'O vendedor não sai de 1.360.',
    'Abaixo de 1.450 ele não topa.',
  ];
  for (const m of frases) assert.ok(vazamentos(m, MOTOR, PUBLICOS_D2B).length > 0, `deveria pegar: ${m}`);
});

test('D2b: o disfarçado que resolve para um valor público passa; o vocabulário normal também', () => {
  for (const m of ['Posso levar 1 4 6 0 mil.', 'Fica 1.46O.000.', 'O pedido é 1-500-000.']) assert.deepEqual(vazamentos(m, MOTOR, PUBLICOS_D2B), [], m);
  // As normais de antes, contra a escada delas (contraproposta de 1,46 mi e oferta de 1,4 mi).
  for (const m of [...NORMAIS, ...NORMAIS_2]) assert.deepEqual(vazamentos(m, MOTOR, PERMITIDOS), [], m);
  const normais = [
    'O apartamento fica no 5º andar.',
    'O 1º piso tem a sala e a cozinha.',
    'Me liga no (61) 99999-9999.',
    'Visita dia 28/10 às 10h?',
    'Tem 2-3 vagas, dependendo do carro.',
    'O condomínio de R$ 1.360 inclui água e gás.',
    'O IPTU sai por R$ 1.450 por ano.',
    'A obra terminou em 2019 e a reforma em 2024.',
    'São três quartos e duas vagas.',
    'Posso levar R$ 1.460.000, R$ 40 mil abaixo do pedido.',
    'Sua oferta de R$ 1.300.000 foi recebida; levo R$ 1.460.000 ao vendedor.',
  ];
  for (const m of normais) assert.deepEqual(vazamentos(m, MOTOR, PUBLICOS_D2B), [], m);
});

// ------------------------------------------------------------------------------------------------
// Rodada 1 da revisão do PR #120: preço falado, conta escrita, percentual com base citada, aceite
// abaixo do recuo e "2 mil" que não é 2 milhões. A escada: contraproposta de R$ 1.460.000 e ofertas do
// comprador de R$ 1.300.000 e R$ 1.400.000.

const PUBLICOS_120 = [146_000_000, PEDIDO, 130_000_000, 140_000_000];
const pega = (frases: string[]) => {
  for (const m of frases) assert.ok(vazamentos(m, MOTOR, PUBLICOS_120).length > 0, `deveria pegar: ${m}`);
};
const passa = (frases: string[]) => {
  for (const m of frases) assert.deepEqual(vazamentos(m, MOTOR, PUBLICOS_120), [], m);
};

test('#120 achado 1: preço falado "1 e 360" e "treze sessenta" é lido em milhões e milhares', () => {
  pega(['Fecha em 1 e 360, sem problema.', 'O vendedor fecha em 1 e 450.', 'Dá pra fazer um e trezentos e sessenta.', 'Treze sessenta mil e fechamos.', 'Fica em 1 e 360 mil.']);
  passa(['São 3 quartos e 2 vagas.', 'O imóvel tem 1 vaga e 120 m².', 'Entrega entre 2 e 3 dias.', 'Posso levar 1 e 460.', 'Quatorze sessenta e fechamos.']);
});

test('#120 achado 2: conta escrita confere o resultado com a base citada', () => {
  pega([
    'R$ 1.460.000 − R$ 100.000 é onde a gente chega.',
    'R$ 1.460.000 - R$ 100.000 é onde a gente chega.',
    'R$ 1.300.000 + 60.000 e fechamos.',
    'Sua oferta de R$ 1.400.000 menos 40 mil resolve.',
    '1.500.000 - 140.000',
    'R$ 1.400.000 menos 3% resolve.',
  ]);
  passa(['Posso levar R$ 1.460.000, R$ 40 mil abaixo do pedido.', '1.500.000 - 40.000', 'R$ 1.500.000 menos 2,67% dá a proposta.']);
});

test('#120 achado 3: percentual com a base citada usa essa base; sem base, pedido e contraproposta', () => {
  pega(['Podemos ir até 3% abaixo dos R$ 1.400.000 que você ofereceu.', 'Dá 3% sobre os R$ 1.400.000 de desconto.']);
  passa(['Dá 3% de desconto.', 'Um desconto de 2,67% sobre o pedido.', 'A entrada de 30% já ajuda.', 'A entrada de 30% do valor pode vir do FGTS.', 'Fica 2,67% abaixo dos R$ 1.500.000.']);
});

test('#120 achado 4: aceite ou oferta abaixo do recuo bloqueia; o relato da oferta passa', () => {
  pega(['Fechamos pela sua oferta de R$ 1.300.000.', 'Combinado: 1.300.000.', 'Aceitamos a sua primeira proposta de 1,3 milhão.', 'Podemos fechar por R$ 1.300.000.', 'Pode ser 1,3 mi.']);
  passa(['Recebi sua proposta de R$ 1.300.000.', 'Sua oferta de R$ 1.300.000 foi recebida; levo R$ 1.460.000 ao vendedor.']);
  // Fora da contraproposta também: o sigilo varre a mensagem de qualquer movimento.
  const v = validarMovimento({ movimento: 'responder_objecao', contraproposta: null, mensagem: 'Fechamos pela sua oferta de R$ 1.300.000.' }, MOTOR, [comprador(130_000_000)], { hoje: HOJE, canal: 'portal' });
  assert.equal(v.ok, false);
  assert.ok(v.bloqueado_por.includes('SIGILO_VIOLADO'));
});

test('#120 achado 5: "2 mil" não vira 2 milhões; por extenso continua lido em milhares', () => {
  passa(['Condomínio de R$ 2 mil.', 'Taxa de 2 mil.', 'São 2 mil de condomínio e 400 de IPTU.']);
  pega(['Faço mil trezentos e sessenta.', 'Faço um mil trezentos e sessenta.']);
});

test('#120 achado 6: desofuscar desfaz emoji de número e dígitos de outros alfabetos', () => {
  assert.deepEqual(desofuscar('Fica 1\uFE0F\u20E33\uFE0F\u20E36\uFE0F\u20E30\uFE0F\u20E3 mil.'), { texto: 'fica 1360 mil.', forte: true });
  assert.deepEqual(desofuscar('Fica 1\u20E3.'), { texto: 'fica 1.', forte: true });
  assert.equal(desofuscar('Nota \u{1F51F}').forte, true);
  assert.deepEqual(desofuscar('Fica \uFF11\uFF13\uFF16\uFF10 mil.'), { texto: 'fica 1360 mil.', forte: true });
  assert.equal(desofuscar('O apartamento fica no 5º andar, 120 m².').forte, false);
  assert.equal(desofuscar('Posso levar R$ 1.460.000.').forte, false);
});

test('#120: as normais continuam passando contra a escada nova', () => {
  for (const m of [...NORMAIS, ...NORMAIS_2]) assert.deepEqual(vazamentos(m, MOTOR, PUBLICOS_120), [], m);
  for (const m of ['Criado em 2026-10-28T10:42:17.123Z.', 'Visita dia 28/10 às 10h?', 'Me liga no (61) 99999-9999.', 'Visita às doze trinta?']) assert.deepEqual(vazamentos(m, MOTOR, PUBLICOS_120), [], m);
});

// ------------------------------------------------------------------------------------------------
// Rodada 2 da revisão do PR #120: o detector deixava formatos escapar porque era uma lista de formas
// reconhecidas. Agora o sentido é o inverso: o que parece número e não tem leitura padrão retém. Mesma
// escada de PUBLICOS_120.

const DISFARCE = 'escreve número de forma disfarçada';
const ACEITE_ABAIXO = 'aceita ou oferece na mensagem valor abaixo do recuo';
const achadosDe = (m: string) => vazamentos(m, MOTOR, PUBLICOS_120);
const comAchado = (casos: [string, string][]) => {
  for (const [m, achado] of casos) assert.ok(achadosDe(m).includes(achado), `${m} → ${achado} (veio ${JSON.stringify(achadosDe(m))})`);
};

test('#120 r2 I1: o que parece número e não tem leitura padrão retém', () => {
  comAchado([
    ['Dá pra fazer 1 ponto 36 milhão.', DISFARCE],
    ['Fica em 1\n360 mil.', DISFARCE],
    ['1/3/6/0 mil', DISFARCE],
    ['1|3|6|0 mil', DISFARCE],
    ['1•3•6•0 mil', DISFARCE],
    ['Fica em 1:360:000.', DISFARCE],
    ['Fecha em 1.3.6.0.000.', DISFARCE],
    ['Fica em ❶❸❻⓪ mil.', DISFARCE],
    ['Fica em ❶❸❻⓪ mil.', 'cita o recuo'],
    ['um, três, seis, zero mil', DISFARCE],
    ['Um três meia zero.', DISFARCE],
    // A conta: o operando sem escala herda a escala do outro lado.
    ['Ele faria 1.460 - 100 mil.', 'dá pista do recuo por conta com um valor público'],
    ['Ele faria 1,46 - 0,1 mi.', 'dá pista do recuo por conta com um valor público'],
  ]);
  // Um número público em outro ponto do texto não absolve o trecho disfarçado.
  comAchado([['O pedido é R$ 1.500.000, e fica 1/3/6/0 mil.', DISFARCE]]);
  passa([
    'Me liga no (61) 99999-9999.',
    'Visita dia 28/10 às 10h?',
    'Visita às 10h30.',
    'O 1º piso tem a sala.',
    'Fica no 5º andar.',
    'São 120 m² de área útil.',
    'São 3 quartos e 2 vagas.',
    'Tem 2-3 vagas.',
    'Tem 1, 2 ou 3 vagas, conforme a unidade.',
    'Valor: R$ 1.460.000\n90 dias de entrega.',
    'Criado em 2026-10-29T13:43:35.953Z.',
    'Visita às 10 e meia?',
    // O trecho disfarçado que resolve para valor público passa, ao lado de outros números normais.
    'Posso levar 1 4 6 0 mil, com 3 quartos e 2 vagas.',
  ]);
  for (const m of [...NORMAIS, ...NORMAIS_2]) assert.deepEqual(achadosDe(m), [], m);
  assert.deepEqual(desofuscar('Fica ❶❸❻⓪ mil.'), { texto: 'fica 1360 mil.', forte: true });
});

test('#120 r2 I2: aceite ou oferta olham as palavras em volta do valor, não a frase', () => {
  comAchado(
    ['1.300.000? Fechado.', 'R$ 1.300.000! Topamos.', 'Pode ser 1,3 sim.', '1,3 tá ótimo pra nós.', 'Negócio fechado em um vírgula três.', 'Sim para os 1.300.000 que você ofereceu.'].map((m) => [m, ACEITE_ABAIXO]),
  );
  passa([
    'Recebi sua proposta de R$ 1.300.000. Vou conversar com o vendedor.',
    'Sua oferta de R$ 1.300.000 foi recebida; levo R$ 1.460.000 ao vendedor.',
    'Sua oferta de R$ 1.300.000 fica registrada.',
    'Ok, Ana. Recebi sua proposta de R$ 1.300.000.',
    'Recebi sua proposta de R$ 1.300.000. Fico no aguardo.',
    'Topamos R$ 1.460.000 e não R$ 1.300.000.',
  ]);
});

test('#120 r2 I3: percentual "acima de" uma base soma o percentual a ela', () => {
  comAchado([
    ['O ideal dele está 4,6% acima dos 1.300.000.', 'dá pista do recuo por percentual de um valor público'],
    ['O ideal dele está 11,5% acima dos 1.300.000.', 'dá pista do alvo por percentual de um valor público'],
  ]);
  passa(['Dá 3% de desconto.', 'Um desconto de 2,67% sobre o pedido.']);
});

test('#120 r2 I4: diferença com a base dita por palavra usa essa base', () => {
  comAchado([['Dá para chegar a 100 mil abaixo da nossa contraproposta.', 'dá pista do recuo pela diferença de um valor público']]);
  passa(['Posso levar R$ 1.460.000, R$ 40 mil abaixo do pedido.']);
});

test('#120 r2 I5: texto longo de números é conferido em tempo linear', () => {
  const formas = ['1 ', '1360000 ', 'um mil ', '1% ', '1,3 sim ', 'a1 ', '1.'];
  for (const f of formas) {
    const texto = f.repeat(Math.ceil(40_000 / f.length)).slice(0, 40_000);
    let melhor = Infinity;
    for (let k = 0; k < 2; k++) {
      const t0 = performance.now();
      vazamentos(texto, MOTOR, PUBLICOS_120);
      melhor = Math.min(melhor, performance.now() - t0);
    }
    // Folga para a máquina lenta do CI: o que o teste pega é o crescimento quadrático, não o tempo absoluto.
    assert.ok(melhor < 1000, `${JSON.stringify(f)} × 40 mil caracteres levou ${melhor.toFixed(0)} ms`);
  }
});

// ------------------------------------------------------------------------------------------------
// F1 (#133), opção (b) da revisão do #142 (decisão da coordenação, vetável pelo dono): só se libera
// formato SEM grupo numérico livre, que não tem onde carregar um valor — o eixo de Brasília ("W3 Sul"), o
// código de unidade com no máximo 2 algarismos e uma letra ("Apto 2B", "Torre B2") e a data sem ano e sem
// hora ("28/10", que já era leitura padrão). Telefone, CEP, data com ano e data com hora ficam retidos
// (D2b; a data com ano passava na `main` e passou a reter): cada grupo de algarismos deles é um canal livre. Mesma escada de PUBLICOS_120
// (contraproposta 1,46 mi; ofertas 1,3 mi e 1,4 mi; recuo 1,36 mi; alvo 1,45 mi) e, sem a oferta de
// 1,3 mi, PERMITIDOS. "Ele desce até o CEP 01.300-000." só é exigida na escada sem a oferta de 1,3 mi: com ela
// é a oferta pública e a `main` também a deixa passar.

const pegaSemOferta = (frases: string[]) => {
  for (const m of frases) assert.ok(vazamentos(m, MOTOR, PERMITIDOS).length > 0, `deveria pegar: ${m}`);
};

test('F1 (1): toda frase de ataque das revisões (#115, #120, #126 e rodadas 1 a 3 do #142) retém', () => {
  // Contra a escada sem a oferta de 1,3 mi, todas. Com ela, todas menos a que só repete a oferta pública
  // ("Ele desce até o CEP 01.300-000." = 1,3 mi), que a `main` também deixa passar nessa escada.
  pegaSemOferta(ATAQUES_DAS_REVISOES);
  pega(ATAQUES_DAS_REVISOES.filter((f) => f !== 'Ele desce até o CEP 01.300-000.'));
  // Piora zero: o resíduo dos laudos que a `main` nunca reteve fica igual (não é efeito do F1).
  for (const f of RESIDUO_DA_MAIN) assert.deepEqual(achadosDe(f), [], f);
});

// Imóvel de R$ 900 mil (alvo 870 mil, recuo 820 mil): "1,2 mi", "1,3 mi" e "1,12 mi" não revelam nada dele.
const MOTOR_BAIXO: MandatoMotor = { ...MOTOR, preco_pedido_c: 90_000_000, alvo_c: 87_000_000, recuo_c: 82_000_000 };
const PUBLICOS_BAIXO = [88_000_000, 90_000_000];

test('F1 (2): "W3 Sul", "Apto 2B" e "Visita dia 28/10" (sem ano e sem hora) passam', () => {
  // Na escada de 1,5 mi (recuo 1,36 mi), "W3", "2B", "B2", "C2" e "L2" se leem também 1,3 mi, 1,2 mi e 1,12 mi
  // (milhão subentendido; "L" é 1), abaixo do recuo: retêm. "Apto 4B" (B = 6: 46 = 1,46 mi, a 1% do alvo) e
  // "Torre B5" (B = 8: 85 = 850 mil, abaixo do recuo) também. Passam os que não revelam nada nessa escada.
  passa([
    'W4 Sul',
    'Moro na W4 Sul.',
    'Moro na W5 Sul, por favor.',
    'Apto 4C',
    'Apto 4C, de frente.',
    'O apartamento é o Apto 4C.',
    'Torre C5.',
    'Bloco C6, perto do metrô.',
    'Apto 60B.',
    'Visita dia 28/10',
    'Visita dia 28/10?',
    'Podemos marcar a visita dia 28/10?',
  ]);
  pega(['W3 Sul', 'Fica na L2 Norte.', 'Apto 2B', 'Torre B2.', 'Bloco C2, perto do metrô.', 'Apto 4B', 'Torre B5.']);
  // Num imóvel em que 1,2 mi e 1,3 mi não revelam nada, os mesmos passam ("Torre B2" não: B = 8 dá 82 = 820
  // mil, o recuo desse imóvel).
  for (const m of ['W3 Sul', 'Moro na W3 Sul.', 'Fica na L2 Norte.', 'Moro na W3 Sul, por favor.', 'Apto 2B', 'Apto 2B, de frente.', 'O apartamento é o Apto 2B.', 'Torre C2.', 'Bloco C2, perto do metrô.'])
    assert.deepEqual(vazamentos(m, MOTOR_BAIXO, PUBLICOS_BAIXO), [], m);
  assert.ok(vazamentos('Torre B2.', MOTOR_BAIXO, PUBLICOS_BAIXO).length > 0);
  // As normais de antes continuam passando.
  for (const m of [...NORMAIS, ...NORMAIS_2]) assert.deepEqual(achadosDe(m), [], m);
});

test('F1 (3): telefone, CEP, data com ano e data com hora ficam retidos (decisão: opção (b))', () => {
  // Decisão de desenho (coordenação, vetável pelo dono): cada grupo de algarismos deles pode carregar um
  // valor ("CEP 70.000-136", "Visita dia 28/10/1360 15h", "Me liga no 61 3333 1251"), e conferir grupo a
  // grupo não convergiu em 3 rodadas. Retêm (telefone, CEP e data com hora já na `main`; a data com ano passou a reter); a mensagem vai ao corretor e nada vaza.
  pega([
    'Me liga no 61 99999 1234.',
    'Me liga no (61) 99999 1234.',
    'Meu WhatsApp é (61) 99876 5432.',
    'Telefone fixo (61) 3333 4444.',
    'Ligue 0800 345 6789.',
    'O CEP é 70.000-000.',
    'O CEP é 70070-120.',
    'CEP 70.070-120, Brasília.',
    'Vistoria 28/10/2026, combinado?',
    'Visita dia 28/10/2026.',
    'Visita dia 28/10 15h?',
    'Visita 28/10 15h30?',
    'Vistoria 28/10/2026 9h, combinado?',
  ]);
  // O parêntese depois do preço também não é liberado: o número dentro dele é um grupo livre
  // ("R$ 1.460.000 (100 mil dias)").
  pega(['Posso levar R$ 1.460.000 (2 vagas).', 'Posso levar R$ 1.460.000 (3 quartos e 2 vagas).']);
});

test('F1: formato liberado seguido ou precedido de número retém, qualquer que seja o separador', () => {
  // A data sem ano e sem hora ("28/10") é leitura padrão desde a D2b e fica como na `main`.
  const formatos = ['W1 Sul', 'W3 Sul', 'L1 Norte', 'Torre B2', 'Torre 1B', 'Apto 2B', 'Apto 13B', 'Bloco B1, 3º andar'];
  const separadores = ['', ' ', ' e ', ', ', ' + ', '; ', ' (', ') ', '. ', '.\n', ' - ', '/', ':', ' mais ', '. E mais ', ' com ', '\n', ' = ', ' ou '];
  const valores = ['300 mil', '360 mil', '360.000', '360', '36 mil', '0 mil', 'mil', '1,36 mi', 'trezentos e sessenta mil', '60 mil', '3 6 0 mil', 'milhão'];
  const passaram: string[] = [];
  for (const f of formatos)
    for (const s of separadores)
      for (const v of valores) {
        // Colado sem separador a um formato que termina em letra, vira outra palavra ("andarmil"), não número.
        if (!s && /\p{L}$/u.test(f)) continue;
        if (!achadosDe(f + s + v).length) passaram.push(f + s + v);
        if (!achadosDe(`Fica 1${s}${f}`).length) passaram.push(`Fica 1${s}${f}`);
      }
  assert.deepEqual(passaram, []);
});

test('F1: o formato só passa sozinho, sem palavra de preço e sem algarismos que revelem valor', () => {
  // Outro número na mensagem, em qualquer forma ou língua.
  pega([
    'Apto 2B, 3 quartos e 2 vagas.',
    'O apartamento é o Apto 2B, na Torre B2.',
    'Torre B2, 3º andar.',
    'Apto 2B, um quarto e uma vaga.',
    'Moro na W3 Sul 704.',
    'Torre B2 704.',
    'Moro na W3 Sul. 360 mil.',
    'Tenho 4. Torre 3B.',
    'Thirteen floors, apto 6B.',
    'Trece pisos, apto 6B.',
  ]);
  // Palavra de preço ou aceite em qualquer lugar da mensagem.
  pega(['Quanto ele aceita? Torre B2.', 'Qual o seu valor? Apto 2B.', 'Fecho em apto 2B.']);
  // Código com 3 algarismos ou mais, com duas letras, ou sem palavra de endereço.
  pega(['Fecho em apto 360B.', 'Torre B360.', 'Torre BB2.', 'Fica 1B.']);
  // Os algarismos do código revelam valor em alguma leitura: recuo ou alvo (com o "1" de milhão
  // subentendido), abaixo do recuo em qualquer escala, diferença ou percentual com palavra de margem.
  pega(['Torre 36B.', 'Apto 45B.', 'Apto 1B.', 'Moro na W1 Sul.', 'Apto 7B.', 'Apto 9B.', 'Torre 10B.', 'Torre 13B.', 'Torre 35B.', 'Apto 14B.', 'Gordura: Torre 3B.', 'A folga é o apto 14B.']);
  // O que não revela continua passando ("Torre 3B." = 1,3 mi, abaixo do recuo, passou a reter: ver o milhão
  // subentendido abaixo).
  passa(['Apto 5B.', 'Torre 5B.', 'Torre 50B.', 'Moro na W4 Sul.']);
});

// Rodada 1 do ciclo 2 do #142.
test('F1 (B1): letra que o detector lê como algarismo ("l", "i", "o") entra na conferência do código', () => {
  pega(['Torre l3', 'Bloco I3', 'Apto l2', 'Torre l6', 'Torre O3', 'Apto 3l', 'Torre 4l', 'L3 Norte', 'Fica na L3 Norte']);
  pegaSemOferta(['Torre l3', 'Bloco I3', 'Apto l2', 'Torre l6', 'Torre O3', 'Apto 3l', 'Torre 4l', 'L3 Norte', 'Fica na L3 Norte']);
});

test('F1 (B2): vocabulário de percentual, de anunciado, de contraproposta e de aceite impede a liberação', () => {
  const frases = [
    'Percentual: apto 3B',
    'Percentual: apto 4B',
    'Porcentagem do anunciado: torre 3B',
    'Do anunciado: apto 5B',
    'Porcentagem sobre a contraproposta: torre 6B',
    'Torre 6B \uFF05 da contraproposta',
    'Torre 3B off',
    'Torre 4B percent',
    'Contraproposta: torre 6B',
    'Contraoferta: apto 3B',
    'Contra-proposta: torre 6B',
    'Contraofertas: apto 6B',
    'Sobre o anuncio: bloco 4C',
    'Percentuais: apto 6B',
    'Taxa: apto 6B',
    'Taxas: apto 6B',
    'Combinado: apto 6B',
    'Combinamos o apto 6B',
    'Pode ser no apto 3B',
    'Podemos ser o apto 6B',
    'Bate no apto 3B',
    'Batemos no apto 6B',
  ];
  pega(frases);
  pegaSemOferta(frases);
});

test('F1 (B3): o milhão subentendido lê os algarismos como decimal de K milhões, com os zeros da esquerda', () => {
  const caso = (frases: string[], m: Partial<MandatoMotor>, perm: number[]) => {
    for (const f of frases) assert.ok(vazamentos(f, { ...MOTOR, ...m }, perm).length > 0, `deveria pegar: ${f} em ${JSON.stringify(m)}`);
  };
  // Recuo 1,40 mi: "4" = 1,4 mi.
  caso(['Torre 4B.', 'Apto 4B.', 'Torre B4.'], { recuo_c: 140_000_000, alvo_c: 147_000_000 }, [146_000_000, 150_000_000]);
  // Recuo 1,05 mi: "05" = 1,05 mi (o zero da esquerda conta).
  caso(['Torre 05B.'], { preco_pedido_c: 120_000_000, recuo_c: 105_000_000, alvo_c: 110_000_000 }, [120_000_000, 115_000_000]);
  // Recuo 2,36 mi: "3" = 2,3 mi, abaixo dele.
  caso(['Apto 3B.'], { preco_pedido_c: 250_000_000, recuo_c: 236_000_000, alvo_c: 245_000_000 }, [250_000_000, 246_000_000]);
  // Na escada de 1,5 mi: "3" = 1,3 mi, abaixo do recuo.
  pega(['Torre 3B.', 'Apto 2B', 'W3 Sul']);
});

test('F1 (B4): algarismo romano, centena em espanhol e "par" contam como outro número', () => {
  const frases = ['Torre XIII, apto 6B', 'I Torre 3B VI', 'I · Apto 3B · VI', 'Torre 5B, XL.', 'Bloco trescientos, apto 6B', 'Bloco doscientas, apto 6B', 'Apto 3B par', 'Apto 6B, pares', 'Apto 6B, dupla', 'Apto 5B x par x VI'];
  pega(frases);
  pegaSemOferta(frases);
});

test('F1: os formatos liberados continuam lineares', () => {
  const formas = ['Apto 2B, ', 'W3 Sul 2 vagas ', 'um apto 3B ', '1 ', 'treze ', 'quinto andar ', 'Torre B2 '];
  for (const f of formas) {
    const texto = f.repeat(Math.ceil(80_000 / f.length)).slice(0, 80_000);
    let melhor = Infinity;
    for (let k = 0; k < 2; k++) {
      const t0 = performance.now();
      vazamentos(texto, MOTOR, PUBLICOS_120);
      melhor = Math.min(melhor, performance.now() - t0);
    }
    assert.ok(melhor < 2000, `${JSON.stringify(f)} × 80 mil caracteres levou ${melhor.toFixed(0)} ms`);
  }
});

// Rodada 2 do ciclo 2 do #142.
test('F1 (R2-B1): marcação ou conexão ("_", "‿", "＿", zero-width) não esconde palavra nem cola algo ao código', () => {
  const frases = [
    '_Menos_ apto 5B.',
    '_Gap_: apto 5B.',
    '_Meta_: apto 4B.',
    'Torre 6B _off_.',
    '_Ate_ apto 4B.',
    'Apto 4B_six',
    'Apto 5B_',
    'Apto 5B\u200B',
    'Me\u200Bnos apto 5B.',
    'Apto 4B\u200Bsix',
    'Apto 4B\u2040six',
    'Apto 4B\uFF3Fsix',
    '_W4 Sul',
    '*Apto 5C*',
  ];
  pega(frases);
  pegaSemOferta(frases);
  // Sem a marcação, as mesmas formas passam (a retenção vem dela).
  passa(['Apto 5C', 'W4 Sul', 'Apto 5B.']);
});

test('F1 (R2-B2): toda letra que pode ser algarismo é conferida com todos os algarismos que ela pode ser', () => {
  // Escada de 1,5 mi: E = 3 ("E6" = 36 = 1,36 mi, o recuo), A = 4 ("A5" = 45 = 1,45 mi, o alvo), B = 8 ("B4"
  // = 84 = 840 mil), G = 9 ("G5" = 95 = 950 mil), B = 6 ("4B" = 46 = 1,46 mi, a 1% do alvo).
  const frases = ['Torre E6', 'Apto A5', 'Apto A4', 'Apto E5', 'Bloco B4', 'Torre G5', 'Apto 4B', 'Torre B5.'];
  pega(frases);
  pegaSemOferta(frases);
  // S = 5 ("S4" = 54), Z = 2 ("4Z" = 42), T = 7 ("3T" = 37), Q = 9 ("Q4" = 94), G = 6 ("G6" = 66): num mandato
  // em que essa leitura é o recuo, retém; a letra lida só como letra ("4", "3", "6") não revelaria.
  const caso = (f: string, recuo: number) => {
    const m = { ...MOTOR, preco_pedido_c: recuo + 10_000_000, alvo_c: recuo + 5_000_000, recuo_c: recuo };
    assert.ok(vazamentos(f, m, [recuo + 10_000_000]).length > 0, `deveria pegar: ${f} com recuo ${recuo}`);
  };
  caso('Torre S4', 154_000_000);
  caso('Torre 4Z', 142_000_000);
  caso('Apto 3T', 137_000_000);
  caso('Torre Q4', 194_000_000);
  caso('Torre G6', 166_000_000);
  // "l", "i" e "o" seguem não sendo letra de código ("Apto 3l" = 31): retêm em qualquer mandato.
  for (const f of ['Apto 3l', 'Torre 4i', 'Torre O3']) assert.ok(vazamentos(f, MOTOR_BAIXO, PUBLICOS_BAIXO).length > 0, f);
  // "W" não se lê como algarismo: "W4 Sul" segue passando. "C" também não: "Apto 4C" passa.
  passa(['W4 Sul', 'Apto 4C', 'Apto 5B.']);
});

test('F1 (R2-B3): "par", ordinal e centena em espanhol e inglês contam como outro número', () => {
  const frases = [
    'Apto 4B par',
    'Par de torres, apto 6B',
    'Apto 6B tercero',
    'Bloco quinientos, apto 6B',
    'Apto 6B primero',
    'Apto 6B cuarto',
    'Apto 6B septimo',
    'Apto 6B octavo',
    'Apto 6B noveno',
    'Bloco seiscientos, apto 6B',
    'Apto 6B, a pair',
    'Apto 6B dozen',
  ];
  pega(frases);
  pegaSemOferta(frases);
});

test('F1 (R2-B4): vocabulário de preço, conta, aceite e entrada da main, e em inglês e espanhol, impede a liberação', () => {
  const frases = [
    'Torre 4B pc',
    'Apto 4B pp',
    'Apto 4B bps',
    'Economia: apto 5B.',
    'Less: apto 5B.',
    'Below: apto 4B.',
    'Minus apto 5B.',
    'Rebaja: apto 5B.',
    'Recua apto 5B.',
    'Delta: apto 5B.',
    'Price: apto 4B.',
    'Precio: apto 4B.',
    'Deal: apto 5B.',
    'Comissão: apto 5B.',
    'Sinal: apto 5B.',
    'Entrada: apto 5B.',
    'Ficamos no apto 5B.',
    'De acordo: apto 5B.',
    'Apto 5B-',
    'Torre 5B+',
  ];
  pega(frases);
  pegaSemOferta(frases);
});

test('F1 (R2-B4): o "％" de largura cheia, sozinho, conta como o "%"', () => {
  // Sem "contraproposta" nem outra palavra de preço: só o "％" faz "6C" ser lido como percentual (6% abaixo
  // da contraproposta de 1,46 mi = 1,372 mi, a 1% do recuo).
  assert.ok(vazamentos('Torre 6C \uFF05', MOTOR, PUBLICOS_120).length > 0);
  assert.ok(vazamentos('Torre 6C \uFF05', MOTOR, PERMITIDOS).length > 0);
  // Sem ele, a mesma frase passa.
  assert.deepEqual(vazamentos('Torre 6C', MOTOR, PUBLICOS_120), []);
  assert.deepEqual(vazamentos('Torre 6C', MOTOR, PERMITIDOS), []);
});

// ------------------------------------------------------------------------------------------------
// Critério de equivalência (decisão do dono, 05/11/2026, depois da rodada 3 da revisão do #142): uma
// frase que passa com o código liberado ("bloco C6") só é piora se a gêmea com algarismo comum ("bloco 6")
// retém. A gêmea não tem formato liberado, então o head a lê como a `main` (conferido head × main nas 17
// classes abaixo, nas duas escadas). Uma classe por achado da rodada 3: se a forma disfarçada passa, a
// gêmea com algarismo passa também — é o risco residual que já existia na `main`, documentado em
// docs/negociacao.md. O teste falha se alguém fechar só um dos dois lados: aí a equivalência precisa ser
// refeita (fechar a gêmea pede fechar o disfarce também).

const RESIDUO_EQUIVALENTE: [disfarce: string, gemea: string][] = [
  // Ordinal ou número por extenso em outra língua (ponto "único número", 3ª passagem).
  ['Thirteenth story, bloco C6.', 'Thirteenth story, bloco 6.'],
  ['Fourteenth story, torre C5.', 'Fourteenth story, torre 5.'],
  ['Decimotercera planta, bloco C6.', 'Decimotercera planta, bloco 6.'],
  ['Cero, bloco C6.', 'Cero, bloco 6.'],
  // Símbolo que lembra número (\p{So}, não \p{N}).
  ['⚀⚂ Bloco C6.', '⚀⚂ Bloco 6.'],
  // Palavra de conta abreviada ou com erro de grafia (ponto "vocabulário", 3ª passagem).
  ['dsct: Apto 5B.', 'dsct: Apto 5.'],
  ['men. Apto 5B', 'men. Apto 5'],
  ['menoz: Apto 5B', 'menoz: Apto 5'],
  ['Dif.: apto 5B.', 'Dif.: apto 5.'],
  ['bxa: Apto 5B', 'bxa: Apto 5'],
  // Palavra de conta soletrada com separador.
  ['g a p: Apto 5B', 'g a p: Apto 5'],
  ['o-f-f: Torre 6C', 'o-f-f: Torre 6'],
  // Caractere invisível que parte a palavra (U+3164) e caractere de tag astral colado (obs. 1).
  ['Meㅤnos apto 5B.', 'Meㅤnos apto 5.'],
  ['Apto 5B\u{E0036}', 'Apto 5\u{E0036}'],
  // Traço longo ou hífen seguido de pontuação colado ao código.
  ['Apto 5B—', 'Apto 5—'],
  ['Apto 5B-.', 'Apto 5-.'],
  // "D" lido como 0 (obs. 2).
  ['Torre D5', 'Torre 5'],
];

test('equivalência (05/11): cada classe da rodada 3 tem o mesmo resultado na forma disfarçada e na gêmea com algarismo', () => {
  for (const publicos of [PUBLICOS_120, PERMITIDOS]) {
    for (const [disfarce, gemea] of RESIDUO_EQUIVALENTE) {
      const retemDisfarce = vazamentos(disfarce, MOTOR, publicos).length > 0;
      const retemGemea = vazamentos(gemea, MOTOR, publicos).length > 0;
      assert.equal(retemDisfarce, retemGemea, `${JSON.stringify(disfarce)} × ${JSON.stringify(gemea)}`);
      // O critério em si: gêmea retida obriga o disfarce a reter (só isso seria bloqueante).
      if (retemGemea) assert.ok(retemDisfarce, `piora bloqueante: ${JSON.stringify(disfarce)}`);
    }
  }
});

test('equivalência (05/11): "Commission", prometido no comentário e na doc, impede a liberação', () => {
  // Fechamento da rodada 3: o disfarce retém. A gêmea "Commission: apto 5." passa na `main` e segue
  // passando (resíduo da `main`, número curto fora do contexto de preço): reter a mais não viola o critério.
  for (const publicos of [PUBLICOS_120, PERMITIDOS]) {
    for (const f of ['Commission: apto 5B.', 'Commissions: torre 6C.']) assert.ok(vazamentos(f, MOTOR, publicos).length > 0, f);
  }
});

// Revisão do #142 (B1): a liberação confere a própria gêmea. "Fica no bloco 50" retém (o número depois de
// "fica" ou de "por" é lido como diferença de um valor público: 50 mil é a distância do pedido ao alvo), então
// "Fica no bloco C50" tem de reter — por construção, sem lista de palavras: o código só passa se a mensagem
// com o código trocado por cada leitura dele em algarismos passa na análise comum.
const PARES_GEMEOS: [disfarce: string, gemea: string][] = [
  ['Fica no bloco C50', 'Fica no bloco 50'],
  ['Fica no bloco C38', 'Fica no bloco 38'],
  ['Visita amanhã. Fica no bloco C50', 'Visita amanhã. Fica no bloco 50'],
  ['Fico no bloco D55', 'Fico no bloco 55'],
  ['Por favor, apto K43', 'Por favor, apto 43'],
  // "S" lido como 5: a gêmea é "bloco 55" (e "bloco 5").
  ['Fica no bloco S5', 'Fica no bloco 55'],
];

test('equivalência (B1): gêmea retida obriga o disfarce a reter, nas duas escadas', () => {
  for (const publicos of [PUBLICOS_120, PERMITIDOS]) {
    for (const [disfarce, gemea] of PARES_GEMEOS) {
      assert.ok(vazamentos(gemea, MOTOR, publicos).length > 0, `gêmea deveria reter: ${gemea}`);
      assert.ok(vazamentos(disfarce, MOTOR, publicos).length > 0, `deveria pegar: ${disfarce}`);
    }
  }
  // Com a oferta de 1,3 mi na escada, "sala 66" retém (66 mil leva ao recuo), e "sala K66" também.
  assert.ok(vazamentos('por gentileza sala 66', MOTOR, PUBLICOS_120).length > 0);
  assert.ok(vazamentos('por gentileza sala K66', MOTOR, PUBLICOS_120).length > 0);
});

// As leituras do código em algarismos, como o detector as faz: cada letra some ou vira cada algarismo
// que ela pode ser (a tabela de `leiturasDoCodigo`).
const LETRA_ALGARISMO: Record<string, string[]> = { a: ['4'], b: ['8', '6'], e: ['3'], g: ['6', '9'], i: ['1'], l: ['1'], o: ['0'], q: ['9'], s: ['5'], t: ['7'], z: ['2'] };
const gemeasDoCodigo = (codigo: string): string[] => {
  let r = [''];
  for (const ch of codigo.toLowerCase()) {
    const op = /\d/.test(ch) ? [ch] : ['', ...(LETRA_ALGARISMO[ch] ?? [])];
    r = r.flatMap((x) => op.map((y) => x + y));
  }
  return [...new Set(r)].filter(Boolean);
};

test('equivalência (B1): propriedade — para todo prefixo, palavra de endereço e código de 1 a 99, gêmea retida ⇒ disfarce retido', () => {
  // Prefixos que a `main` lê como contexto de preço ("fica", "por" e o resto de `CONTEXTO_DE_PRECO`, até 2
  // palavras antes do número) e os de lugar e cortesia que a liberação não vê como preço.
  const prefixos = ['', 'Fica no ', 'Fico no ', 'Fica na ', 'Por favor, ', 'por gentileza ', 'Visita amanhã. Fica no ', 'Moro no ', 'faço no ', 'sai no ', 'chego no ', 'por ', 'mais ', 'menos o ', 'acima do ', 'abaixo do ', 'posso no ', 'consigo no ', 'rola no ', 'levo no ', 'reduz no ', 'cede o '];
  const palavras = ['apto', 'bloco', 'torre', 'sala', 'casa'];
  // Letras que ficam só letra e letras que o detector também lê como algarismo ("s" 5, "b" 8 ou 6, "e" 3).
  // Depois do número, fora as que fazem dele uma leitura padrão, que não é formato liberado ("6A" e "6O"
  // ordinal, "6D" dias, "6S" segundos, "6X" vezes, "6H" horário, "6M" milhões, "6K" mil): essas têm a
  // própria propriedade, no teste do #147 abaixo.
  const letrasAntes = ['c', 'd', 'k', 's', 'b', 'e', 'h'];
  const letrasDepois = ['c', 'f', 'j', 'n', 'b', 'e', 'p'];
  const escadas: [MandatoMotor, number[]][] = [[MOTOR, PUBLICOS_120], [MOTOR, PERMITIDOS], [MOTOR_BAIXO, PUBLICOS_BAIXO]];
  let k = 0;
  let conferidas = 0;
  for (const [mandato, publicos] of escadas)
    for (const p of prefixos)
      for (const w of palavras)
        for (let n = 1; n <= 99; n++) {
          const i = k++;
          for (const codigo of [`${letrasAntes[i % 7]}${n}`, `${n}${letrasDepois[i % 7]}`].map((c) => c.toUpperCase())) {
            const retida = gemeasDoCodigo(codigo).some((g) => vazamentos(`${p}${w} ${g}`, mandato, publicos).length > 0);
            if (!retida) continue;
            conferidas++;
            const disfarce = `${p}${w} ${codigo}`;
            assert.ok(vazamentos(disfarce, mandato, publicos).length > 0, `gêmea retida e disfarce passou: ${disfarce}`);
          }
        }
  assert.ok(conferidas > 0);
});

test('obs. b: data com ano de dois algarismos ("28/10/26") não é leitura padrão e retém', () => {
  for (const publicos of [PUBLICOS_120, PERMITIDOS]) {
    for (const f of ['Visita dia 28/10/26.', 'Vistoria 28/10/26, combinado?']) assert.ok(vazamentos(f, MOTOR, publicos).length > 0, f);
  }
  assert.ok(vazamentos('Visita dia 28/10/26.', MOTOR_BAIXO, PUBLICOS_BAIXO).length > 0);
});

test('F1: data com a hora depois de vírgula passa, como na main', () => {
  assert.deepEqual(vazamentos('Visita dia 28/10, 15h.', MOTOR, PUBLICOS_120), []);
  assert.deepEqual(vazamentos('Visita dia 28/10, 15h.', MOTOR, PERMITIDOS), []);
});

// ------------------------------------------------------------------------------------------------
// #147 (sobra do F1): o código de unidade que a leitura padrão consome ("6A" e "6O" ordinal, "6S" segundos,
// "6D" dias, "6X" vezes, "6H" horário, "6M" milhões, "6K" mil) passava sem conferência nenhuma, na `main` e
// no head, e a gêmea com algarismo podia reter ("Fica no apto 64", com "a" = 4: 64 mil leva ao recuo).
// Agora ele confere a gêmea: gêmea retida, o código retém; gêmea que passa, ele passa, como antes.

const PARES_147: [disfarce: string, gemeas: string[]][] = [
  ['Fica no apto 6A', ['Fica no apto 6', 'Fica no apto 64']],
  ['Fica no apto 6S', ['Fica no apto 6', 'Fica no apto 65']],
  ['Fica no apto 24M', ['Fica no apto 24']],
  ['Fica no apto 6A/24M', ['Fica no apto 6/24M', 'Fica no apto 64/24M']],
  ['Por favor, apto 43A', ['Por favor, apto 43', 'Por favor, apto 434']],
  ['Fecho em 1, apto 36A', ['Fecho em 1, apto 36', 'Fecho em 1, apto 364']],
  ['Apto 6A', ['Apto 6', 'Apto 64']],
  ['Torre 6O', ['Torre 6', 'Torre 60']],
];

test('#147: código lido como ordinal, segundos ou milhões tem o mesmo resultado que a gêmea, nas três escadas', () => {
  const escadas: [MandatoMotor, number[]][] = [[MOTOR, PUBLICOS_120], [MOTOR, PERMITIDOS], [MOTOR_BAIXO, PUBLICOS_BAIXO]];
  for (const [mandato, publicos] of escadas) {
    for (const [disfarce, gemeas] of PARES_147) {
      const retemGemea = gemeas.some((g) => vazamentos(g, mandato, publicos).length > 0);
      assert.equal(vazamentos(disfarce, mandato, publicos).length > 0, retemGemea, `${JSON.stringify(disfarce)} × ${JSON.stringify(gemeas)}`);
    }
  }
  // Os casos da issue, na escada de 1,5 mi: a gêmea retém, o disfarce também.
  for (const publicos of [PUBLICOS_120, PERMITIDOS]) {
    for (const f of ['Fica no apto 6A', 'Fica no apto 6A/24M', 'Por favor, apto 43A']) assert.ok(vazamentos(f, MOTOR, publicos).length > 0, f);
  }
  assert.ok(vazamentos('Fica no apto 6S', MOTOR, PUBLICOS_120).length > 0);
});

test('#147: frases comuns seguem passando (ordinal de andar, data sem ano, eixo e código que já passavam)', () => {
  for (const f of ['O apartamento fica no 5º piso, de frente para o parque.', 'Fica no 6º andar.', 'Apto 6A', 'Apto 2A', 'Visita dia 28/10', 'Torre 6C']) {
    assert.deepEqual(vazamentos(f, MOTOR, PUBLICOS_120), [], f);
  }
  // "Torre B2" retém nessa escada também na `main` (B = 8: 82 = 820 mil, o recuo); código com a letra antes
  // não é leitura padrão e não muda com o #147.
  for (const f of ['W3 Sul', 'Apto 2B', 'Visita dia 28/10', 'Apto 2A', 'Apto 6A']) {
    assert.deepEqual(vazamentos(f, MOTOR_BAIXO, PUBLICOS_BAIXO), [], f);
  }
});

test('#147: propriedade — código lido pela leitura padrão, gêmea retida ⇒ disfarce retido', () => {
  const prefixos = ['', 'Fica no ', 'Fico no ', 'Por favor, ', 'Visita amanhã. Fica no ', 'menos o ', 'por ', 'Fecho em 1, ', 'A folga é o '];
  const palavras = ['apto', 'bloco', 'torre', 'sala'];
  const letras = ['a', 'o', 's', 'd', 'x', 'h', 'm', 'k', 'km', 'min'];
  const escadas: [MandatoMotor, number[]][] = [[MOTOR, PUBLICOS_120], [MOTOR, PERMITIDOS], [MOTOR_BAIXO, PUBLICOS_BAIXO]];
  let conferidas = 0;
  for (const [mandato, publicos] of escadas)
    for (const p of prefixos)
      for (const w of palavras)
        for (let n = 1; n <= 99; n++)
          for (const l of letras) {
            const codigo = `${n}${l}`;
            const retida = gemeasDoCodigo(codigo).some((g) => vazamentos(`${p}${w} ${g}`, mandato, publicos).length > 0);
            if (!retida) continue;
            conferidas++;
            const disfarce = `${p}${w} ${codigo.toUpperCase()}`;
            assert.ok(vazamentos(disfarce, mandato, publicos).length > 0, `gêmea retida e disfarce passou: ${disfarce}`);
          }
  assert.ok(conferidas > 0);
});

test('#147: do quinto código lido em diante, retém sem conferir a gêmea (reter a mais)', () => {
  // Imóvel de 900 mil: nenhuma gêmea dos quatro revela nada, e a mensagem passa, como na `main`.
  const quatro = 'Sala 6A, sala 7A, sala 8A, sala 9A';
  assert.deepEqual(vazamentos(quatro, MOTOR_BAIXO, PUBLICOS_BAIXO), []);
  // O quinto código lido não confere a gêmea: retém (a `main` deixaria passar). Mantém o custo linear.
  assert.ok(vazamentos(`${quatro}, sala 6A`, MOTOR_BAIXO, PUBLICOS_BAIXO).length > 0);
});

test('#147: a conferência da gêmea é linear no tamanho da mensagem', () => {
  // Um código liberável no fim de um texto longo sem número (a liberação lê a gêmea inteira), muitos códigos
  // liberáveis, muitos códigos lidos pela leitura padrão ("Fica no apto 6A") e o caso que passa.
  const formas = ['Casa ampla e arejada, ', 'Apto 6A ', 'Fica no apto 6A ', 'Torre 6C ', 'sala 7S, '];
  for (const f of formas) {
    for (const sufixo of ['', ' Torre 6C', ' Fica no apto 6A']) {
      const texto = f.repeat(Math.ceil(80_000 / f.length)).slice(0, 80_000) + sufixo;
      let melhor = Infinity;
      for (let k = 0; k < 2; k++) {
        const t0 = performance.now();
        vazamentos(texto, MOTOR, PUBLICOS_120);
        melhor = Math.min(melhor, performance.now() - t0);
      }
      assert.ok(melhor < 2000, `${JSON.stringify(f)} × 80 mil caracteres + ${JSON.stringify(sufixo)} levou ${melhor.toFixed(0)} ms`);
    }
  }
  // A forma longa com um só código passa pela gêmea (e passa: "Torre 6C" não revela nada nessa escada).
  const longa = 'Casa ampla e arejada, '.repeat(3_700) + 'Torre 6C';
  assert.deepEqual(vazamentos(longa, MOTOR, PUBLICOS_120), []);
});
