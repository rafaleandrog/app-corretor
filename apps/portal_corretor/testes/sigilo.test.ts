import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exigePassagem, validarMovimento, valoresCitados, vazamentos, vazamentosNoRegistro, type MandatoMotor, type PropostaResumo } from '../comum/negociador';

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
    { fonte_estimativa: 'disse que o banco aprovou 1,1 mi', resumo_rodada: 'Ofereci 1,46 mi; o recuo dele é 1,36M', motivo: null, interesses_identificados: ['prazo', 'piso dele é 1.360 mil'] },
    MOTOR,
    PERMITIDOS,
  );
  assert.deepEqual(reg.map((r) => r.campo), ['resumo_rodada', 'interesses_identificados']);
  assert.deepEqual(vazamentosNoRegistro({ fonte_estimativa: 'disse que o banco aprovou 1,1 mi', resumo_rodada: 'Comprador quer prazo.', motivo: 'pediu permuta', interesses_identificados: ['prazo'] }, MOTOR, PERMITIDOS), []);
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
