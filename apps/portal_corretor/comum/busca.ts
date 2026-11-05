// Busca global (spec 11.7, item B10): regras puras, as mesmas no backend (`GET /busca`) e na tela.

/** Menos que isso devolve 422: um termo de uma letra traria a carteira inteira. */
export const BUSCA_MIN = 2;
/** Mais que isso devolve 422: o maior campo buscado (nome, e-mail) tem 200, e ninguém digita tanto. */
export const BUSCA_MAX = 100;
/** Resultados por tipo (clientes, imóveis, negociações). */
export const POR_TIPO = 5;

/**
 * O texto digitado sem o espaço das pontas e com no máximo BUSCA_MAX unidades (a mesma conta de
 * `length` que a rota faz), sem deixar metade de um par substituto no fim: um emoji cortado ao meio
 * faz o `encodeURIComponent` lançar. Quando o corte cai no meio do par, o emoji inteiro sai.
 */
export function cortarTermo(q: string): string {
  const t = q.trim();
  if (t.length <= BUSCA_MAX) return t;
  let fim = BUSCA_MAX;
  const ultimo = t.charCodeAt(fim - 1);
  if (ultimo >= 0xd800 && ultimo <= 0xdbff) fim -= 1;
  return t.slice(0, fim);
}

/**
 * O termo que vai ao banco, ou `null` quando ele ficaria curto demais (o chamador responde 422 BUSCA_CURTA).
 * `termo` é o que foi digitado, sem o espaço das pontas: vai para nome, e-mail, código, bairro e título
 * (o código do corretor pode ser "101-2"). `telefone` só vem quando o texto é só dígitos e sinais de
 * telefone ("(61) 99999-0000", "+55 61"): a forma em dígitos, que vai SÓ para a coluna de telefone, gravado
 * como `+5561999990000` (spec 6.2); nesse caso a busca de clientes é só no telefone.
 * Invariante: o que efetivamente vai ao banco nunca tem menos de BUSCA_MIN caracteres.
 */
export function normalizarTermo(q: string): { termo: string; telefone: string | null } | null {
  const termo = q.trim();
  if (termo.length < BUSCA_MIN) return null;
  if (/^[\d\s()+.-]+$/.test(termo)) {
    const digitos = termo.replace(/\D/g, '');
    if (digitos.length < BUSCA_MIN) return null;
    return { termo, telefone: digitos };
  }
  return { termo, telefone: null };
}
