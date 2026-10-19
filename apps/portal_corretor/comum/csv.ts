// CSV da importação e da exportação (spec 12.1 e 7.4). Puro: o navegador lê o arquivo e manda as
// linhas já separadas; o backend gera o CSV da exportação. Separador `;` (Excel pt-BR) na saída;
// na entrada aceita `;` ou `,`, detectado pela primeira linha.

/** Separa o texto em linhas de células, respeitando aspas ("a;b" e aspas dobradas ""). */
export function lerCsv(texto: string): string[][] {
  const limpo = texto.replace(/^﻿/, '');
  const primeira = limpo.split(/\r?\n/, 1)[0] ?? '';
  const sep = (primeira.match(/;/g)?.length ?? 0) >= (primeira.match(/,/g)?.length ?? 0) ? ';' : ',';
  const linhas: string[][] = [];
  let linha: string[] = [];
  let celula = '';
  let aspas = false;
  for (let i = 0; i < limpo.length; i++) {
    const c = limpo[i];
    if (aspas) {
      if (c === '"' && limpo[i + 1] === '"') {
        celula += '"';
        i++;
      } else if (c === '"') aspas = false;
      else celula += c;
    } else if (c === '"') aspas = true;
    else if (c === sep) {
      linha.push(celula);
      celula = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && limpo[i + 1] === '\n') i++;
      linha.push(celula);
      if (linha.some((x) => x.trim())) linhas.push(linha);
      linha = [];
      celula = '';
    } else celula += c;
  }
  linha.push(celula);
  if (linha.some((x) => x.trim())) linhas.push(linha);
  return linhas;
}

/**
 * Célula da saída: aspas quando precisa; fórmula neutralizada para o Excel não executar. `+` e `-`
 * só contam como fórmula quando o resto não é número (telefone `+55…` e valor negativo passam).
 */
function celula(v: unknown): string {
  let s = v === null || v === undefined ? '' : String(v);
  const formula = /^[=@\t\r]/.test(s) || (/^[+\-]/.test(s) && !/^[+\-][0-9\s().,-]+$/.test(s));
  if (formula) s = `'${s}`;
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function gerarCsv(cabecalho: string[], linhas: unknown[][]): string {
  return '﻿' + [cabecalho, ...linhas].map((l) => l.map(celula).join(';')).join('\r\n') + '\r\n';
}

/** Sugere a coluna do arquivo para cada campo, pelo nome do cabeçalho. */
export function sugerirMapeamento(cabecalho: string[]): Record<string, number | null> {
  const sem = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const achar = (...nomes: string[]) => {
    const i = cabecalho.findIndex((c) => nomes.some((n) => sem(c).includes(n)));
    return i >= 0 ? i : null;
  };
  return {
    nome: achar('nome', 'cliente'),
    telefone: achar('telefone', 'celular', 'whatsapp', 'fone'),
    email: achar('email', 'e-mail'),
    papeis: achar('papel', 'tipo', 'perfil'),
    observacoes: achar('obs', 'nota'),
  };
}
