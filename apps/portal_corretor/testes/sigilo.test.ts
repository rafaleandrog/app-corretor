import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MOVIMENTO_FORA_DA_LISTA, desofuscar, exigePassagem, sanearResposta, validarMovimento, valoresCitados, vazamentos, vazamentosNoRegistro, type MandatoMotor, type PropostaResumo } from '../comum/negociador';

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
// F1 (#133): formatos comuns que retinham sem motivo (telefone com espaço, CEP, "W3 Sul", "Apto 2B",
// "Torre B2", data com hora sem "às", número entre parênteses depois do preço) passam, mas só quando
// não podem compor um valor em reais com o resto da mensagem, qualquer que seja o separador. Mesma
// escada de PUBLICOS_120 (contraproposta 1,46 mi; ofertas 1,3 mi e 1,4 mi; recuo 1,36 mi; alvo 1,45 mi).

/** (a) Frases comuns da #133 (e das revisões do #120 e do #126): passam. */
const COMUNS_F1 = [
  // Telefone com espaço, depois de palavra de contato.
  'Me liga no 61 99999 1234.',
  'Meu WhatsApp é (61) 9 9876-5432.',
  'Meu WhatsApp é (61) 99876 5432.',
  'Telefone fixo (61) 3333 4444.',
  'Ligue 0800 345 6789.',
  // CEP no padrão exato, depois de "CEP".
  'O CEP é 70.000-000.',
  'O CEP é 70070-120.',
  'CEP 70.070-120, Brasília.',
  // Endereços de Brasília.
  'Moro na W3 Sul.',
  'Fica na L2 Norte.',
  'Apto 2B, de frente.',
  'O apartamento é o Apto 2B.',
  'Torre B2.',
  'Bloco C2, perto do metrô.',
  // Data e hora sem "às".
  'Visita dia 28/10 15h?',
  'Visita 28/10 15h.',
  'Visita 28/10 15h30?',
  'Vistoria 28/10/2026 9h, combinado?',
  // Número entre parênteses depois do preço.
  'Posso levar R$ 1.460.000 (2 vagas).',
  'Posso levar R$ 1.460.000 (3 quartos e 2 vagas).',
  // Com "por favor", que não é palavra de preço.
  'Me liga no (61) 99999 1234, por favor.',
];

test('F1 (a): telefone, CEP, endereço de Brasília, data com hora e parênteses depois do preço passam', () => {
  passa(COMUNS_F1);
  // As normais de antes continuam passando.
  for (const m of [...NORMAIS, ...NORMAIS_2]) assert.deepEqual(achadosDe(m), [], m);
});

/**
 * (b) As frases de ataque das revisões dos PRs #115, #120 e #126 que a `main` retém: continuam retidas.
 * Ficam de fora as da rodada 3 do #120 que a `main` nunca reteve (risco residual aceito na D-111,
 * registrado na doc), como "Ele quer 1360 milhares" e "Sim para os R$ 1.300.000".
 */
const ATAQUES_REVISOES = [
  // #115.
  'Faço R$ 1,36M.',
  'Faço 1.36kk.',
  'Faço R$ 1 360 000.',
  'Faço R$ 1.360 mil.',
  'Fica 9,33% abaixo do pedido.',
  'Fica 140 mil abaixo do pedido.',
  'Faço um vírgula trinta e seis milhões.',
  'Dá pra pagar 9% menos que o anunciado.',
  'Reduzindo 140 mil, fecha.',
  'Descontando 9%, fecha.',
  'Baixando 140 mil, fecha.',
  'Podemos fechar por R$ 1.300.000 à vista',
  'Faço um milhão trezentos e sessenta.',
  'Fica 1 3 6 0 mil.',
  'O piso é 1.36O.000',
  'Abaixo de 1.360 não rola',
  'Fica 1 3 6 0 mil e não sai disso',
  'Faço um vírgula trinta e seis milhão.',
  'Faço mil trezentos e sessenta.',
  'Fica 1️⃣3️⃣6️⃣0️⃣ mil.',
  'Fica em 1 milhão. E mais 360 mil.',
  'O desconto máximo é de 9,3%.',
  'Uns 140 do pedido.',
  'Tenho 90 mil de margem.',
  'O dono fecha por R$ 1360.',
  'Fecho em 1.360.',
  'O dono pode ceder 140 mil.',
  'A folga é de 140 mil.',
  '1.500.000 - 140.000',
  // #120.
  'Fecha em 1 e 360, sem problema.',
  'O vendedor fecha em 1 e 450.',
  'Dá pra fazer um e trezentos e sessenta.',
  'Treze sessenta mil e fechamos.',
  'R$ 1.460.000 − R$ 100.000 é onde a gente chega.',
  'R$ 1.300.000 + 60.000 e fechamos.',
  'Sua oferta de R$ 1.400.000 menos 40 mil resolve.',
  'Podemos ir até 3% abaixo dos R$ 1.400.000 que você ofereceu.',
  'Fechamos pela sua oferta de R$ 1.300.000.',
  'Combinado: 1.300.000.',
  'Aceitamos a sua primeira proposta de 1,3 milhão.',
  '1.300.000? Fechado.',
  'Pode ser 1,3 sim.',
  'R$ 1.300.000! Topamos.',
  'Negócio fechado em um vírgula três.',
  'O ideal dele está 4,6% acima dos 1.300.000.',
  'O ideal dele está 11,5% acima dos 1.300.000.',
  'Dá para chegar a 100 mil abaixo da nossa contraproposta.',
  'Dá pra fazer 1 ponto 36 milhão.',
  'Fica em 1\n360 mil.',
  '1/3/6/0 mil',
  '1|3|6|0 mil',
  '1•3•6•0 mil',
  'Fica em 1:360:000.',
  'Fecha em 1.3.6.0.000.',
  'Fica em ❶❸❻⓪ mil.',
  'um, três, seis, zero mil',
  'Um três meia zero.',
  'Ele faria 1.460 - 100 mil.',
  'Ele faria 1,46 - 0,1 mi.',
  'Sim para os 1.300.000 que você ofereceu.',
  // #126: as liberações que reabriram vazamento nas rodadas 2, 3 e 4.
  'Fica 1B 360 mil',
  'Aceito 1B 300 mil, fechado',
  'Fica B1 B3 B6 B0',
  'Fica 13B 60 mil',
  'Fica 1:36 0 mil',
  'Fica 1/45 0 mil',
  'Aceito 1:30 0 mil',
  'Torre 1B e 300 mil, fechado',
  'Apto 1B e 450 mil',
  'Bloco B1, 360 mil',
  'Apto 1B + 360 mil',
  'Fica 1 13h 60 mil',
  'W1 Sul 360 mil',
  'fecho em 1 (360) mil',
  'W1 Sul 360.000',
  'Fica 1 3/60 mil',
  'Bloco 1J 360 mil',
  'Fica 1B e 360 mil',
];

test('F1 (b): as frases de ataque das revisões do #115, #120 e #126 continuam retidas', () => {
  pega(ATAQUES_REVISOES);
});

test('F1 (b): formato liberado seguido de valor retém, qualquer que seja o separador', () => {
  const formatos = [
    'Me liga no (61) 99999 1234',
    'Me liga no 13 6000 0000',
    'WhatsApp (61) 9 9876-5432',
    'Ligue 0800 136 0000',
    'CEP 70.000-000',
    'CEP 01.360-000',
    'Visita dia 28/10 15h',
    'Visita dia 13/6 0h',
    'W1 Sul',
    'W3 Sul',
    'L1 Norte',
    'Torre B2',
    'Torre 1B',
    'Apto 13B',
    'Bloco B1, 3º andar',
    'Posso levar R$ 1.460.000 (2 vagas)',
    'Fecho em 1 (2 vagas)',
  ];
  const separadores = ['', ' ', ' e ', ', ', ' + ', '; ', ' (', ') ', '. ', '.\n', ' - ', '/', ':', ' mais ', '. E mais ', ' com ', '\n', ' = ', ' ou '];
  const valores = ['300 mil', '360 mil', '360.000', '360', '36 mil', '0 mil', 'mil', '1,36 mi', 'trezentos e sessenta mil', '60 mil', '3 6 0 mil', 'milhão'];
  const passaram: string[] = [];
  for (const f of formatos)
    for (const s of separadores)
      for (const v of valores) {
        // Colado sem separador a um formato que termina em letra, vira outra palavra ("andarmil"), não número.
        if (!s && /\p{L}$/u.test(f)) continue;
        if (!achadosDe(f + s + v).length) passaram.push(f + s + v);
      }
  assert.deepEqual(passaram, []);
});

test('F1 (b): número curto antes do formato, na mesma frase, retém; o contexto que falta também', () => {
  pega([
    // Número curto antes, na mesma frase: compõe com o que vem no formato.
    'Fecho em 1, torre 36B.',
    'Fica 1 e apto 3B, ok?',
    'Fica 13, me liga no 6000 0000.',
    'Fica 1,3 e visita dia 6/10 0h.',
    // Código de endereço com 3 algarismos ou mais, e sem palavra de endereço.
    'Fecho em apto 360B.',
    'Torre B360.',
    'Fica 1B.',
    // Telefone sem palavra de contato, ou com preço na frase.
    'Fecho em 13 6000 0000.',
    'Fecho em 1, me liga no 13 6000 0000.',
    // Data com hora sem palavra de agenda, ou com preço na frase.
    'Fecho em 13/6 0h.',
    'Aceito 13/6 0h.',
    'Visita dia 13/6 0h para fechar.',
    'O valor fica 13/6 0h, visita dia 28/10.',
    // CEP com preço na frase.
    'Fecho no CEP 01.360-000.',
    // Parêntese: só quantidade com unidade, e nada depois que vire valor.
    'Posso levar R$ 1.460.000 (360) mil.',
    'Posso levar R$ 1.460.000 (2 vagas) e mais 300 mil.',
    // Formato liberado e, depois, outra frase com valor.
    'Moro na W3 Sul. 360 mil.',
    'Visita dia 28/10 15h. E mais 300 mil, fechado.',
  ]);
});

test('F1: o que continua retido de propósito (nada vaza, vai ao corretor)', () => {
  // Rodada 1 da revisão do #142: palavra de preço ou aceite em qualquer lugar da mensagem ("R$",
  // "vendedor", "levo") não libera formato nenhum; o código de um algarismo que, em milhões, cai abaixo
  // do recuo também não ("Bloco C1" = 1 milhão).
  pega([
    'Posso levar R$ 1.460.000 ao vendedor. Visita dia 28/10 15h? Me liga no (61) 99999 1234.',
    'Sua oferta de R$ 1.300.000 foi recebida; levo R$ 1.460.000 ao vendedor. O apartamento é o Apto 2B, na Torre B2.',
    'Bloco C1, perto do metrô.',
  ]);
  // Endereço com número à direita na mesma frase: "W1 Sul 360" é "1 e 360".
  pega(['Moro na W3 Sul 704.', 'Torre B2 704.']);
  // Formato comum seguido de um valor, mesmo em outra frase: a liberação não vale e a regra geral retém.
  pega(['Visita dia 28/10 15h? Levo R$ 1.460.000 ao vendedor.']);
});

// ------------------------------------------------------------------------------------------------
// Rodada 1 da revisão do PR #142: nenhuma liberação deixa passar valor que resolva para recuo, alvo ou
// abaixo do recuo, qualquer que seja o separador (regra do dono na #133). Mesma escada de PUBLICOS_120
// (o 1,3 mi é público nela; contra PERMITIDOS, não).
const pegaSemOferta = (frases: string[]) => {
  for (const m of frases) assert.ok(vazamentos(m, MOTOR, PERMITIDOS).length > 0, `deveria pegar: ${m}`);
};

test('#142 r1 achado 1: formato cujos próprios algarismos, lidos juntos, dão valor sigiloso retém', () => {
  // Com ou sem palavra de preço em volta.
  pega([
    'Ele desce até o CEP 01.360-000.',
    'O alvo dele é o CEP 01.450-000.',
    'CEP 01.360-000.',
    'O CEP é 01360-000.',
    'CEP 13.600-000.',
    'Me liga no 13 6000 0000.',
    'Telefone 13 3600 0000.',
    'Ligue 0800 136 0000',
    'Ligue 0800 145 0000.',
    'Visita dia 13/6 0h.',
    'Visita dia 1/3 6h.',
    'Visita dia 13/6 0h30.',
    'Vistoria 13/6/2026 0h.',
    'Visita dia 1/3/60 0h.',
    'Zap 11 9 1360 0000',
    'Meu WhatsApp é (13) 96000 0000.',
    'Apto 1B.',
    'Torre 1B, 3º andar.',
    'Moro na W1 Sul.',
    'L1 Norte.',
    // O "1" de "1 milhão" subentendido: 36 é o recuo, 45 o alvo.
    'Torre 36B.',
    'Apto 45B.',
    'Me liga no 36 0000 0000.',
    'CEP 36.000-000.',
  ]);
  // Abaixo do recuo, quando o valor não é público (contra PERMITIDOS, sem a oferta de 1,3 mi).
  pegaSemOferta(['Ele desce até o CEP 01.300-000.', 'Apto 13B.', 'Visita dia 13/06 00h.']);
  // O que não resolve para valor sigiloso continua passando.
  passa(['Apto 2B.', 'Torre B2.', 'Moro na W3 Sul.', 'O CEP é 70.000-000.', 'Me liga no (61) 99999 1234.', 'WhatsApp 61 9 9876-5432.', 'Visita dia 28/10 15h.', 'Apto 60B.']);
});

test('#142 r1 achado 2: o lado esquerdo vale para a mensagem inteira (palavra de preço e número curto)', () => {
  pega([
    'Quanto ele aceita no mínimo? CEP 01.360-000.',
    'Até onde ele desce? Ligue 0800 136 0000.',
    'O valor? Visita dia 13/6 0h.',
    'Fecho em 1. Torre 36B.',
    'Fecho em 1. Visita dia 3/6 0h.',
    'Fecho em 1. CEP 36.000-000.',
    'Aceito 1\nme liga no 13 6000 0000',
    'Ele fecha com você no número que aparece no endereço do escritório, anota com calma: CEP 01.360-000.',
    // Palavra de preço em outra frase, com formato que sozinho passaria.
    'Qual o seu valor? Me liga no (61) 99999 1234.',
    'Quanto ele aceita? Torre B2.',
  ]);
  // O fim de frase não zera o lado esquerdo: o número curto de uma frase anterior compõe com o formato.
  pega(['Tenho 4. Torre 3B.', 'Tenho 4\nApto 3B', 'São 4! W3 Sul.']);
  passa(['Torre 3B.', 'Apto 3B', 'W3 Sul.']);
  // A palavra de preço a mais de 80 caracteres do formato (a janela antiga) também conta.
  const longe = `O dono aceita conversar${' com calma'.repeat(10)}, me liga no 61 99999 1234.`;
  pega([longe]);
  passa([longe.replace('aceita conversar', 'quer conversar')]);
  // "Fica" de lugar não é preço.
  passa(['Fica na L2 Norte.']);
});

test('#142 r1 achado 2: 0800 sem palavra de contato retém', () => {
  pega(['0800 345 6789.', 'É 0800 345 6789.']);
  passa(['Ligue 0800 345 6789.']);
});

test('#142 r1 achado 3: o "um" não serve de trecho fechado antes do formato', () => {
  pega(['Fica em um e apto 36B.', 'Em um e apto 3B.', 'Em um, apto 3B.', 'Em um. Apto 3B.', 'Em um\napto 3B', 'É uma; Torre B3.', 'Em um + apto 3B.']);
  // Depois do formato também: o formato tem de ser o único trecho numérico da mensagem.
  pega(['Apto 2B, um quarto e uma vaga.', 'Fica num apto 36B.']);
});

test('#142 r1 achado 4: formato liberado não serve de fecho para outro que, junto, compõe valor', () => {
  pega([
    'Apto 1B e Torre 36B.',
    'W1 Sul, Apto 3B',
    'Apto 9B e Torre 5B.',
    'Torre 9B, apto 5B.',
    // Trecho fechado vizinho também compõe: 1 vaga + 36, 14 + 5º.
    'Uma suíte, 1 vaga, apto 36B.',
    'Apto 14B, 5º andar.',
  ]);
  for (const a of ['Apto 1B', 'Torre 13B', 'Bloco B1', 'W1 Sul'])
    for (const s of [', ', ' e ', ' ', '; ', '. '])
      for (const b of ['Torre 36B', 'Apto 3B', 'Bloco 6B', 'apto 60A', 'L3 Norte']) pegaSemOferta([`${a}${s}${b}`]);
  passa(['Apto 9B.', 'Torre 5B.']);
  // Dois formatos, ou formato e quantidade, retêm sempre (rodada 2): sem vizinho numérico não há composição.
  pega(['O apartamento é o Apto 2B, na Torre B2.', 'Apto 2B, 3 quartos e 2 vagas.', 'Torre B2, 3º andar.']);
});

test('#142 r1 achado 5: parêntese antes de quantidade só depois de valor completo', () => {
  pega(['Fecho em 1 (360 m²).', 'Fica 1 (360 metros)', 'R$ 1 (360 vagas)', 'Fecho em 1 (2 vagas).', 'R$ 1.360 (360 dias).', 'Fica 1 milhão (360 metros).']);
  passa(['R$ 1.460.000 (2 vagas)', 'Posso levar R$ 1.460.000 (3 quartos e 2 vagas).']);
});

test('#142 r1: os formatos liberados continuam lineares', () => {
  const formas = ['Apto 2B, ', 'me liga no 61 99999 1234 ', 'visita dia 28/10 15h ', 'CEP 70.000-000 ', 'W3 Sul 2 vagas ', 'um apto 3B ', '1 ', 'treze ', 'quinto andar '];
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

// ------------------------------------------------------------------------------------------------
// Rodada 2 da revisão do PR #142: o formato só é liberado quando é o único trecho numérico da mensagem
// e nenhuma leitura dos seus algarismos dá valor sigiloso (sem limite de algarismos).

test('#142 r2 B1: abaixo do recuo com 5 algarismos significativos ou mais retém', () => {
  pegaSemOferta([
    'CEP 01.299-990',
    'O CEP é 01.255-500.',
    'CEP 01.250-500',
    'CEP 01.200-001',
    'CEP 01.000-500',
    'CEP 00.900-001',
    'Ligue 0800 125 5500',
    'Ligue 0800 130 0500',
    'Me liga no (61) 1255 5000',
    'Zap (61) 9 1300 5000',
    'Me liga no (61) 9 1000 0010',
    'Visita dia 12/05/2000 0h',
    'Vistoria 13/05/2000 0h',
    'dia 9/1/2005 0h',
  ]);
  // Ler centavos não conta: o telefone de 8 ou 9 algarismos continua passando.
  passa(['WhatsApp 61 9 9876-5432.', 'Me liga no (61) 99999 1234.', 'O CEP é 70.000-000.']);
});

test('#142 r2 B2: número ou ordinal por extenso em qualquer lugar da mensagem impede a liberação', () => {
  pega([
    'Apto 14B, quinto andar.',
    'Treze andares, apto 6B.',
    'Apto 4B, cinco vagas.',
    'Apto 9B, quinto andar.',
    'Moro na W4 Sul, quinto andar.',
    'Treze vagas, visita dia 6/10 0h.',
    'Treze vagas. Me liga no 61 6000 0000.',
    'Apto 13B, sexta.',
    'Torre 13B, num prédio novo.',
  ]);
});

test('#142 r2 B3: com palavra de diferença ou margem, os algarismos do formato valem como diferença e percentual', () => {
  pega([
    'A folga é o apto 14B.',
    'A margem é a Torre 9B.',
    'A folga dele? Apto 5B.',
    'Gordura: Torre 3B.',
    'O chão: apto 14B.',
    'Patamar: Torre 9B.',
    'O último dele: apto 5B.',
    'O máximo que ele abre mão: apto 14B.',
    'Abatimento: Torre 3B.',
    'Redução: Torre 9B.',
    'Corte: apto 14B.',
  ]);
  // Sem essas palavras, o mesmo formato passa; "por favor" não é preço.
  passa(['Apto 5B.', 'Moro na W3 Sul, por favor.']);
});

test('#142 r2 B4: trechos fechados no meio não abrem janela, qualquer que seja o número deles', () => {
  pega([
    '13 andares, 3 quartos, 2 vagas, 4 suítes, apto 6B.',
    '14 andares, três quartos, duas vagas, quatro suítes, apto 5B.',
    `13 andares${', 2 vagas'.repeat(50)}, apto 6B.`,
  ]);
  // Dois formatos comuns na mesma mensagem: nenhum é liberado.
  pega(['Posso levar a documentação ao dono. Visita dia 28/10 15h? Me liga no (61) 99999 1234.']);
});
