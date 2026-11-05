// Frases de ataque publicadas nas revisões do detector de sigilo (PRs #115, #120, #126 e as 3 rodadas do
// #142). Usadas por `sigilo.test.ts` (todas retêm) e pela comparação head × main da revisão (nenhuma que
// a `main` retém pode passar). Ficam de fora só as que a `main` nunca reteve (risco residual aceito na
// D-111, registrado na doc): estão em `RESIDUO_DA_MAIN`, para que a comparação as veja.

/** #115, #120 e #126. */
export const ATAQUES_115_120_126 = [
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

/** Rodada 1 do #142 (laudo 6653055262). */
const R1_142 = [
  // B1: os algarismos do próprio formato.
  'Ele desce até o CEP 01.360-000.',
  'O alvo dele é o CEP 01.450-000.',
  'Ele desce até o CEP 01.300-000.',
  'Me liga no 13 6000 0000.',
  'Ligue 0800 136 0000',
  'Visita dia 13/6 0h.',
  'Zap 11 9 1360 0000',
  // B2: o lado esquerdo.
  'Quanto ele aceita no mínimo? CEP 01.360-000.',
  'Até onde ele desce? Ligue 0800 136 0000.',
  'O valor? Visita dia 13/6 0h.',
  'Fecho em 1. Torre 36B.',
  'Fecho em 1. Visita dia 3/6 0h.',
  'Fecho em 1. CEP 36.000-000.',
  'Aceito 1\nme liga no 13 6000 0000',
  'Ele fecha com você no número que aparece no endereço do escritório, anota com calma: CEP 01.360-000.',
  'Fecho em 1, torre 36B.',
  // B3: "um" como artigo.
  ...[' e ', ', ', '; ', ' + ', ' (', '. ', '\n', ' mais ', ' com '].map((s) => `Fica em um${s}apto 36B.`),
  // B4: cadeia de formatos.
  ...['Apto 1B', 'Torre 13B', 'Bloco B1', 'W1 Sul'].flatMap((a) =>
    [', ', ' e ', ' ', '; ', '. ', ' + ', '\n'].flatMap((s) => ['Torre 36B', 'Apto 3B', 'Bloco 6B', 'apto 60A', 'L3 Norte'].map((b) => `${a}${s}${b}`)),
  ),
  // B5: parêntese.
  'Fecho em 1 (360 m²).',
  'Fica 1 (360 metros)',
  'R$ 1 (360 vagas)',
];

/** Rodada 2 do #142 (laudo 6653556558). */
const R2_142 = [
  // B1′: abaixo do recuo com 5 algarismos ou mais.
  'CEP 01.299-990',
  'Ligue 0800 125 5500',
  'Me liga no (61) 1255 5000',
  'Visita dia 12/05/2000 0h',
  'CEP 01.250-500',
  'Zap (61) 9 1300 5000',
  'Ligue 0800 130 0500',
  // B2′: número por extenso ao lado.
  'Apto 14B, quinto andar.',
  'Treze andares, apto 6B.',
  'Apto 4B, cinco vagas.',
  'Apto 9B, quinto andar.',
  // B3′: diferença e percentual.
  'A folga é o apto 14B.',
  'A margem é a Torre 9B.',
  'Gordura: Torre 3B.',
  // B4′: cadeia longa.
  '13 andares, 3 quartos, 2 vagas, 4 suítes, apto 6B.',
  '14 andares, três quartos, duas vagas, quatro suítes, apto 5B.',
];

/** Rodada 3 do #142 (laudo 6654328505): bloqueantes, decisão pendente e observações. */
const R3_142 = [
  // B1″: data com ano e com hora.
  'Visita dia 28/10/1360 15h',
  'Vistoria 28/10/1450 15h',
  'Visita dia 28/10/1300 15h',
  'Visita dia 28/10 1h36',
  'Vistoria 28/10/2026 01:36',
  // B1″: CEP.
  'CEP 70.000-136',
  'CEP 72.000-145',
  'CEP 70.001-360',
  'Margem: CEP 70.000-933',
  // Decisão que estava pendente: grupos internos do telefone e do 0800.
  'Me liga no 61 3333 1251',
  'Ligue 0800 777 1299',
  'Me liga no 61 1251 7777',
  // Observações: leituras fracas, sinônimos, outra língua, parêntese contábil.
  'Apto 9B',
  'Torre 10B',
  'Torre 35B',
  'Me liga no 61 3136 0000',
  'CEP 20.136-000',
  'Concessão: apto 14B',
  'Deságio: Torre 9B',
  'Ele recua o apto 14B',
  'Thirteen floors, apto 6B',
  'R$ 1.460.000 (100 mil dias)',
];

/** Rodada 1 do ciclo 2 do #142: letra lida como algarismo, vocabulário de conta e de aceite, número que não é algarismo. */
const C2R1_142 = [
  // B1: "l", "i" e "o" lidos como algarismo no código.
  'Torre l3',
  'Bloco I3',
  'Apto l2',
  'Torre l6',
  'Torre O3',
  'Apto 3l',
  'Torre 4l',
  'L3 Norte',
  'Fica na L3 Norte',
  // B2: percentual, anunciado, contraproposta, taxa, aceite.
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
  'Sobre o anuncio: bloco 4C',
  'Taxa: apto 6B',
  'Combinado: apto 6B',
  'Pode ser no apto 3B',
  'Bate no apto 3B',
  // B4: romano, centena em espanhol, "par".
  'Torre XIII, apto 6B',
  'I Torre 3B VI',
  'I · Apto 3B · VI',
  'Torre 5B, XL.',
  'Bloco trescientos, apto 6B',
  'Apto 3B par',
  'Apto 5B x par x VI',
];

/** Todas as frases de ataque que a `main` retém: o head tem de reter todas. */
export const ATAQUES_DAS_REVISOES = [...ATAQUES_115_120_126, ...R1_142, ...R2_142, ...R3_142, ...C2R1_142];

/**
 * Citadas nos laudos e que a `main` nunca reteve (resíduo pré-existente, igual nas duas árvores): não
 * são piora, e o F1 não as resolve. Ver `docs/negociacao.md`.
 */
export const RESIDUO_DA_MAIN = ['Me liga no 13 6000-0000', 'Fecho em 1, apto 36A', '1.360 metros'];
