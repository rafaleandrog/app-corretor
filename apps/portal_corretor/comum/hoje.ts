// Hoje no Padrão B (spec 11.1 P01, 11.5 M1): regras puras da tela, sem lit nem `urbiVerso`, para o
// teste conferir sem montar a app. A rota `GET /inicio` monta os dados; a tela só desenha.

import type { TipoFila } from './funil';

/** Um passo do "Primeiros passos": o que falta para a conta ficar pronta. */
export interface PassoInicial {
  id: IdPasso;
  rotulo: string;
  /** Sub-rota do app que resolve o passo. */
  rota: string;
  feito: boolean;
}

export type IdPasso = 'conta' | 'telefone' | 'instagram' | 'imovel' | 'pagina';

/**
 * Os 5 primeiros passos, na ordem em que aparecem. O CRECI não está aqui (D-93): é opcional e tem só
 * o aviso discreto. O WhatsApp e o Mensageiro entram quando existirem (spec 11.1 P01), no lugar dos
 * dois passos de conta.
 */
export const PASSOS_INICIAIS: { id: IdPasso; rotulo: string; rota: string }[] = [
  { id: 'conta', rotulo: 'Dar nome à conta', rota: '/ajustes/conta' },
  { id: 'telefone', rotulo: 'Informar o seu telefone', rota: '/ajustes/conta' },
  { id: 'instagram', rotulo: 'Conectar o Instagram', rota: '/ajustes/conexoes' },
  { id: 'imovel', rotulo: 'Cadastrar o primeiro imóvel', rota: '/imoveis?criar=imovel' },
  { id: 'pagina', rotulo: 'Publicar a Página', rota: '/pagina' },
];

/** O que já está pronto na conta; cada campo responde a um passo. */
export type EstadoConta = Record<IdPasso, boolean>;

export function primeirosPassos(estado: EstadoConta): PassoInicial[] {
  return PASSOS_INICIAIS.map((p) => ({ ...p, feito: !!estado[p.id] }));
}

/**
 * Ação de cada cartão da fila (princípio 14): **um** botão principal e no máximo um secundário, no
 * "Mais". A tela liga cada nome ao que ele faz.
 */
export type AcaoFila = 'fazer_agora' | 'abrir' | 'fiz' | 'visita_feita';

export const ACOES_FILA: Record<TipoFila, { principal: AcaoFila; secundaria: AcaoFila | null }> = {
  quente_sem_resposta: { principal: 'fazer_agora', secundaria: null },
  abordagem_vencida: { principal: 'fazer_agora', secundaria: 'fiz' },
  visita: { principal: 'abrir', secundaria: 'visita_feita' },
  proximo_passo: { principal: 'abrir', secundaria: null },
};

/** Chip de tipo do cartão da fila. */
export const TIPO_NA_FILA: Record<TipoFila, string> = {
  quente_sem_resposta: 'Quente',
  abordagem_vencida: 'Atrasada',
  visita: 'Visita',
  proximo_passo: 'Próximo passo',
};

/** Cartões que aparecem antes do "Mais N para depois". */
export const FILA_VISIVEL = 8;

/**
 * Dica do Assistente (P01, direita): uma sugestão concreta a partir do que a tela já tem. O botão
 * abre o Assistente; nada é executado sem o corretor pedir.
 */
export function dicaDoAssistente(fila: { tipo: TipoFila }[], passos: PassoInicial[]): string {
  const quentes = fila.filter((i) => i.tipo === 'quente_sem_resposta').length;
  if (quentes) {
    return quentes === 1
      ? 'Um cliente quente está sem resposta. Peça ao Assistente uma mensagem para retomar a conversa.'
      : `${quentes} clientes quentes estão sem resposta. Peça ao Assistente uma mensagem para cada um.`;
  }
  const atrasadas = fila.filter((i) => i.tipo === 'abordagem_vencida').length;
  if (atrasadas) return `Há ${atrasadas === 1 ? 'uma abordagem atrasada' : `${atrasadas} abordagens atrasadas`}. Pergunte ao Assistente por onde começar.`;
  const falta = passos.find((p) => !p.feito);
  if (falta) return `Próximo passo para deixar a conta pronta: ${falta.rotulo.toLowerCase()}. O Assistente explica como.`;
  return 'Nada urgente agora. Pergunte ao Assistente quais clientes vale a pena retomar esta semana.';
}
