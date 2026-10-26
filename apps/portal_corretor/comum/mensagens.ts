// Objetivos da mensagem sugerida (ficha do contato): além da abordagem do playbook, o corretor
// escolhe em um toque o que a mensagem deve fazer. Sem IA, sai o modelo do objetivo.

export const OBJETIVOS_MENSAGEM = {
  apresentacao: 'Apresentação',
  retorno: 'Retorno',
  ainda_procurando: 'Ainda procurando?',
  nutrir: 'Manter contato',
} as const;

export type ObjetivoMensagem = keyof typeof OBJETIVOS_MENSAGEM;

export const ehObjetivo = (v: unknown): v is ObjetivoMensagem => typeof v === 'string' && Object.hasOwn(OBJETIVOS_MENSAGEM, v);

/** O que a IA deve cumprir em cada objetivo (vai no contexto, no lugar da abordagem do playbook). */
export const DESCRICAO_OBJETIVO: Record<ObjetivoMensagem, string> = {
  apresentacao: 'Primeira mensagem: o corretor se apresenta e pergunta o que o cliente procura.',
  retorno: 'Retomar a conversa desde o último contato e propor o próximo passo.',
  ainda_procurando: 'Perguntar, sem pressão, se o cliente ainda procura imóvel.',
  nutrir: 'Manter o relacionamento: lembrar que está à disposição e oferecer avisar das novidades.',
};

export const primeiroNome = (nome: unknown) => String(nome ?? '').trim().split(/\s+/)[0]?.slice(0, 40) ?? '';

/** Modelo sem IA de cada objetivo: o corretor sempre tem um ponto de partida para ajustar. */
export function modeloMensagem(objetivo: ObjetivoMensagem, cliente: string, corretor: string): string {
  const oi = `${cliente ? `Olá, ${cliente}!` : 'Olá!'}${corretor ? ` Aqui é ${corretor}.` : ''}`;
  switch (objetivo) {
    case 'apresentacao':
      return `${oi} Sou corretor de imóveis e vou cuidar do seu atendimento. Me conta o que você procura: tipo de imóvel, região e faixa de valor?`;
    case 'retorno':
      return `${oi} Passando para retomar a nossa conversa. Qual o melhor dia e horário para falarmos sobre os próximos passos?`;
    case 'ainda_procurando':
      return `${oi} Você ainda está procurando imóvel? Se os planos mudaram, tudo bem, é só me avisar. Se ainda estiver, posso separar novidades para você?`;
    case 'nutrir':
      return `${oi} Lembrei de você e passei para dizer que sigo à disposição para o que precisar sobre imóveis. Quer que eu te avise das novidades na sua região?`;
  }
}
