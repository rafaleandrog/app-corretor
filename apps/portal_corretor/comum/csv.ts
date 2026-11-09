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

/**
 * Modelos de "De onde vem a planilha?" (spec 15.8, migração assistida): para cada campo, os
 * cabeçalhos exatos que o sistema de origem escreve, comparados sem acento nem caixa. Só entra
 * modelo conferido com uma exportação real do sistema; Kenlo, Jetimob e Imobzi esperam um arquivo
 * de exemplo de cada um.
 */
export interface ModeloImportacao {
  id: string;
  rotulo: string;
  campos: Partial<Record<'nome' | 'telefone' | 'email' | 'papeis' | 'observacoes', string[]>>;
}

export const MODELOS_IMPORTACAO: ModeloImportacao[] = [
  {
    id: 'simples',
    rotulo: 'Planilha simples (nome, telefone, e-mail)',
    campos: { nome: ['nome'], telefone: ['telefone'], email: ['e-mail', 'email'] },
  },
];

/**
 * Mapeamento inicial da importação. Sem modelo (ou modelo desconhecido), é o `sugerirMapeamento`.
 * Com modelo, o cabeçalho exato do modelo vence; o campo que o arquivo não traz com o nome do
 * modelo fica com a sugestão. Só pré-preenche: o corretor confere e muda na tela.
 */
export function mapearPorModelo(cabecalho: string[], modeloId: string | null): Record<string, number | null> {
  const mapa = sugerirMapeamento(cabecalho);
  const modelo = MODELOS_IMPORTACAO.find((m) => m.id === modeloId);
  if (!modelo) return mapa;
  const sem = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
  const normalizado = cabecalho.map(sem);
  for (const [campo, nomes] of Object.entries(modelo.campos)) {
    const i = normalizado.findIndex((c) => nomes!.some((n) => sem(n) === c));
    if (i >= 0) mapa[campo] = i;
  }
  return mapa;
}

// ---------- Importação em lotes (#40) ----------
//
// O shell recusa corpo acima de 100 kB (`413 CORPO_MUITO_GRANDE`, overview.md do SDK; a unidade, 1000 ou
// 1024 bytes, e a forma de medir não estão definidas lá). A tela divide a importação em lotes de até 400
// linhas e de até ~80 kB estimados pelo JSON de cada linha (margem para o resto do corpo), envia um por vez
// e soma os relatórios. Assim as 2000 linhas por vez cabem, com qualquer número de colunas.

export const LOTE_IMPORTACAO = { linhas: 400, bytes: 80_000 } as const;
/** Linhas por importação (a tela recusa acima disso antes de enviar; a rota, por lote). */
export const LIMITE_LINHAS_IMPORTACAO = 2000;

/** Divide as linhas em lotes que cabem no corpo; `inicio` é o índice da primeira linha do lote. */
export function dividirEmLotes<T>(linhas: T[], { linhas: maxLinhas, bytes: maxBytes }: { linhas: number; bytes: number } = LOTE_IMPORTACAO): { inicio: number; linhas: T[] }[] {
  const enc = new TextEncoder();
  const lotes: { inicio: number; linhas: T[] }[] = [];
  let atual: T[] = [];
  let inicio = 0;
  let bytes = 0;
  linhas.forEach((l, i) => {
    const tamanho = enc.encode(JSON.stringify(l)).length + 1;
    if (atual.length && (atual.length >= maxLinhas || bytes + tamanho > maxBytes)) {
      lotes.push({ inicio, linhas: atual });
      atual = [];
      bytes = 0;
      inicio = i;
    }
    atual.push(l);
    bytes += tamanho;
  });
  if (atual.length) lotes.push({ inicio, linhas: atual });
  return lotes;
}

export interface RelatorioImportacao {
  criados: number;
  unidos: number;
  pulados: number;
  rejeitados: { linha: number; motivo: string }[];
}

export function somarRelatorios(relatorios: RelatorioImportacao[]): RelatorioImportacao {
  return relatorios.reduce(
    (t, r) => ({ criados: t.criados + r.criados, unidos: t.unidos + r.unidos, pulados: t.pulados + r.pulados, rejeitados: [...t.rejeitados, ...r.rejeitados] }),
    { criados: 0, unidos: 0, pulados: 0, rejeitados: [] } as RelatorioImportacao,
  );
}

/**
 * "Baixar relatório" (P14, 12.1): as linhas rejeitadas com o número da linha na planilha, o motivo e as
 * células originais, para o corretor corrigir e importar de novo. `linhas` são as do arquivo, sem o
 * cabeçalho (a linha 2 da planilha é `linhas[0]`).
 */
export function csvDasRejeitadas(rejeitados: { linha: number; motivo: string }[], cabecalho: string[], linhas: string[][]): string {
  return gerarCsv(
    ['Linha', 'Motivo', ...cabecalho],
    rejeitados.map((r) => [r.linha, r.motivo, ...(linhas[r.linha - 2] ?? [])]),
  );
}
