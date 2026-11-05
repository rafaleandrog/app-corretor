// Quando o Negociador entra (spec 10.9.4; issue #135, F3) e quem conduz a negociação nova (D-94). Puro,
// sem banco: o backend (`backend/negociador-entrada.ts`) lê a configuração e chama estas regras.

import type { GATILHOS } from './negociacao';

export type Gatilho = (typeof GATILHOS)[number];

export interface ConfigEntrada {
  ligado: boolean;
  conduz_padrao: string;
  negociador_padrao_id: number | null;
  gatilhos: Partial<Record<Gatilho, boolean>>;
}

export interface Conducao {
  conduzida_por: 'ia' | 'humano' | 'corretor';
  /** O negociador humano que já nasce atribuído (só com `conduzida_por: humano`). */
  negociador_usuario_id: number | null;
}

/**
 * Quem conduz a negociação nova. O Negociador IA é o padrão (D-94). Com o Negociador desligado, nada
 * entra sozinho: quem conduz é o corretor (também quando o padrão da conta é uma pessoa). Com o padrão
 * `humano` e a pessoa escolhida, a negociação nasce atribuída a ela.
 */
export function conducaoPadrao(config: ConfigEntrada): Conducao {
  if (!config.ligado) return { conduzida_por: 'corretor', negociador_usuario_id: null };
  const pessoa = Number(config.negociador_padrao_id);
  if (config.conduz_padrao === 'humano' && Number.isInteger(pessoa) && pessoa > 0) return { conduzida_por: 'humano', negociador_usuario_id: pessoa };
  return { conduzida_por: 'ia', negociador_usuario_id: null };
}

/** O gatilho vale: Negociador ligado e a caixa marcada em Ajustes › Negociador (marcada por padrão). */
export const gatilhoLigado = (config: ConfigEntrada, gatilho: Gatilho) => config.ligado && config.gatilhos[gatilho] !== false;

/** Minúsculas e sem acento, para as palavras abaixo valerem com e sem "ç" e "ã". */
const normalizar = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/**
 * O prefixo que o próprio portal põe na mensagem ("Sobre a negociação do imóvel X: ", "Sobre o imóvel
 * IM-1 (Apto): "). Ele não é fala do cliente: a palavra "negociação" dele não pode disparar nada.
 */
const PREFIXO_DO_PORTAL = /^sobre (?:a negociacao do imovel|o imovel) [^:]{0,200}:\s*/;

/**
 * Palavras de quem pede desconto ou fala de preço (10.9.4: "cliente pede desconto ou fala de preço").
 * Lista curta e explícita: o que ela não pega fica com o corretor, como antes (a mensagem sempre vira
 * tarefa para ele). Quando o Mensageiro existir, ele passa ao Negociador com o motivo
 * `negociacao_preco` e esta lista deixa de ser o único sinal.
 */
const FALA_DE_PRECO =
  /\b(?:descontos?|abatimentos?|abat(?:e|er|endo)|reducao|mais barat[oa]|(?:muito|ta|esta|achei|meio|bem) car[oa]|car[oa] demais|precos?|valor(?:es)?|quanto (?:custa|sai|fica)|negoci(?:ar|avel|amos)|contrapropostas?|propostas?|ofertas?|faz(?:em)? por|fecha(?:m)? por|aceita(?:m|ria|riam)? menos)\b/;

/** O cliente pede desconto ou fala de preço nesta mensagem do portal? */
export function falaDePreco(mensagem: string | null | undefined): boolean {
  if (typeof mensagem !== 'string' || !mensagem.trim()) return false;
  const fala = normalizar(mensagem.trim()).replace(PREFIXO_DO_PORTAL, '');
  return FALA_DE_PRECO.test(fala);
}

/** Texto do aviso ao negociador humano. Só o código da negociação: nenhum nome, telefone ou valor. */
export const avisoDeAtribuicao = (codigo: string | null | undefined) =>
  `Você recebeu a negociação ${codigo ?? 'nova'} no Portal do Corretor. Abra em Negociações para ver o mandato e conduzir.`;

/** O aviso da tela quando o negócio chega à Proposta e a negociação nasce (resposta `negociador_entrou`). */
export function avisoDeEntrada(e: { codigo?: string; conduzida_por?: string } | null | undefined): string | null {
  if (!e?.codigo) return null;
  // Só nasce pelo gatilho com o Negociador ligado: quem conduz é a IA ou a pessoa padrão, nunca o corretor.
  const quem = e.conduzida_por === 'humano' ? 'o negociador humano da conta' : 'o Negociador IA';
  return `A negociação ${e.codigo} foi aberta e quem conduz é ${quem}. Defina o mandato em Negociações para ele agir.`;
}
