// Busca global (spec 11.7, item B10): regras puras, as mesmas no backend (`GET /busca`) e na tela.

/** Menos que isso devolve 422: um termo de uma letra traria a carteira inteira. */
export const BUSCA_MIN = 2;
/** Mais que isso devolve 422: o maior campo buscado (nome, e-mail) tem 200, e ninguém digita tanto. */
export const BUSCA_MAX = 100;
/** Resultados por tipo (clientes, imóveis, negociações). */
export const POR_TIPO = 5;

/**
 * O termo que vai ao banco. Um termo só de dígitos e sinais de telefone ("(61) 99999-0000", "+55 61")
 * busca só no telefone, pelos dígitos, porque o telefone é gravado como `+5561999990000` (spec 6.2).
 * O resto busca como foi digitado (nome, e-mail, código, bairro, título).
 */
export function normalizarTermo(q: string): { termo: string; telefone: boolean } {
  const limpo = q.trim();
  if (/^[\d\s()+.-]+$/.test(limpo)) {
    const digitos = limpo.replace(/\D/g, '');
    if (digitos.length >= BUSCA_MIN) return { termo: digitos, telefone: true };
  }
  return { termo: limpo.replace(/^\+/, ''), telefone: false };
}
