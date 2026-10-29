// Ajustes › Negociador (P17, item D4): os rótulos da tela. Puro, sem DOM. As regras fixas mostradas vêm
// de `REGRAS_FIXAS` (comum/negociador.ts), a mesma constante que monta o prompt do motor.

import { ESTILOS, GATILHOS } from './negociacao';

/** Os 4 gatilhos de 10.9.4, como o corretor os lê ("Quando entra"). */
export const ROTULO_GATILHO: Record<(typeof GATILHOS)[number], string> = {
  etapa_proposta: 'O negócio chega à etapa Proposta',
  pedido_desconto: 'O cliente pede desconto ou fala de preço',
  reacao_preco: 'O cliente reage "conversar sobre o preço"',
  oferta_registrada: 'Uma oferta é registrada ou feita no portal',
};

/** Os 3 estilos, cada um com uma frase de exemplo (P17, item 3). */
export const ESTILO_NEGOCIADOR: Record<(typeof ESTILOS)[number], { rotulo: string; exemplo: string }> = {
  cooperativo: {
    rotulo: 'Cooperativo',
    exemplo: '"Entendo, Ana. Se a entrega em 60 dias ajudar, consigo levar ao proprietário R$ 1.380.000 com entrada de 30%."',
  },
  firme: {
    rotulo: 'Firme',
    exemplo: '"Ana, o valor está alinhado com os vizinhos. Para mexer nele, preciso de uma entrada maior."',
  },
  consultivo: {
    rotulo: 'Consultivo',
    exemplo: '"Ana, o m² aqui está abaixo dos comparáveis do bairro. Posso te mostrar a conta antes de falarmos de valor?"',
  },
};

/** Custo por rodada: sem tabela de créditos no MVP (D-87). */
export const CUSTO_POR_RODADA = 'Incluído no plano';

/** A pergunta que já vem no simulador (P17, 7 · Testar). */
export const PERGUNTA_TESTE = 'Qual o mínimo que o dono aceita?';

/** "1.234 de 4.000" no contador das instruções. */
export const contadorInstrucoes = (texto: string, limite: number) =>
  `${texto.trim().length.toLocaleString('pt-BR')} de ${limite.toLocaleString('pt-BR')}`;

/** Primeiro dia do mês (AAAA-MM-01) no fuso dado: o começo dos "números do mês". */
export function inicioDoMes(fuso: string, agora = new Date()): string {
  return `${agora.toLocaleDateString('sv-SE', { timeZone: fuso }).slice(0, 7)}-01`;
}
