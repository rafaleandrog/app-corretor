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
