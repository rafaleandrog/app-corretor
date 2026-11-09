// Contatos do celular (P14, spec 12.1): o arquivo vCard (.vcf) exportado pelo celular vira, no navegador,
// as mesmas linhas da planilha (cabeçalho + células), e segue pelo mesmo mapeamento, prévia e importação.
// Puro, sem DOM: os testes o exercitam direto. Lê vCard 2.1, 3.0 e 4.0: linhas dobradas, parâmetros
// (`TEL;TYPE=CELL:`), escapes (`\n`, `\,`, `\;`) e o QUOTED-PRINTABLE do vCard 2.1 dos Android antigos.

/** Cabeçalho que o vCard produz; os nomes casam com a sugestão de mapeamento da planilha. */
export const CABECALHO_VCARD = ['Nome', 'Telefone', 'E-mail', 'Observações'] as const;

interface Propriedade {
  nome: string;
  params: Record<string, string>;
  valor: string;
}

/** Junta as linhas dobradas (a continuação começa com espaço ou tab) e a "soft line break" do QP (`=` no fim). */
function desdobrar(texto: string): string[] {
  const brutas = texto.replace(/^﻿/, '').split(/\r\n|\r|\n/);
  const linhas: string[] = [];
  for (const l of brutas) {
    const anterior = linhas.length ? linhas[linhas.length - 1] : null;
    // O soft break do QP vem antes da dobra comum: `Jo=C3=` + ` =A3o` vira `Jo=C3=A3o` (a whitespace de continuação cai).
    if (anterior !== null && /QUOTED-PRINTABLE/i.test(anterior.split(':', 1)[0]) && anterior.endsWith('=')) linhas[linhas.length - 1] = anterior.slice(0, -1) + (/^[ \t]/.test(l) ? l.slice(1) : l);
    else if (anterior !== null && /^[ \t]/.test(l)) linhas[linhas.length - 1] = anterior + l.slice(1);
    else linhas.push(l);
  }
  return linhas;
}

function decodificarQp(v: string, charset: string): string {
  const bytes: number[] = [];
  for (let i = 0; i < v.length; i++) {
    if (v[i] === '=' && /^[0-9A-Fa-f]{2}$/.test(v.slice(i + 1, i + 3))) {
      bytes.push(parseInt(v.slice(i + 1, i + 3), 16));
      i += 2;
    } else bytes.push(v.charCodeAt(i) & 0xff);
  }
  try {
    return new TextDecoder(/^(utf-?8)?$/i.test(charset) ? 'utf-8' : charset).decode(new Uint8Array(bytes));
  } catch {
    return new TextDecoder('utf-8').decode(new Uint8Array(bytes));
  }
}

const desescapar = (v: string) => v.replace(/\\n/gi, '\n').replace(/\\([,;\\:])/g, '$1');

function propriedade(linha: string): Propriedade | null {
  const doisPontos = linha.indexOf(':');
  if (doisPontos <= 0) return null;
  const [nomeBruto, ...params] = linha.slice(0, doisPontos).split(';');
  // `item1.TEL` (iPhone): o grupo antes do ponto não importa.
  const nome = nomeBruto.replace(/^.*\./, '').toUpperCase();
  const p: Record<string, string> = {};
  for (const par of params) {
    const [k, v] = par.split('=');
    // vCard 2.1 aceita o tipo sem `TYPE=` (`TEL;CELL:`).
    if (v === undefined) p.TYPE = [p.TYPE, k].filter(Boolean).join(',').toUpperCase();
    else p[k.toUpperCase()] = k.toUpperCase() === 'TYPE' ? [p.TYPE, v].filter(Boolean).join(',').toUpperCase() : v;
  }
  let valor = linha.slice(doisPontos + 1);
  if ((p.ENCODING ?? '').toUpperCase() === 'QUOTED-PRINTABLE') valor = decodificarQp(valor, p.CHARSET ?? 'utf-8');
  return { nome, params: p, valor };
}

/** Telefone preferido do cartão: o celular, depois o marcado como preferido, depois o primeiro. */
function telefoneDe(tels: Propriedade[]): string {
  const tipo = (t: Propriedade) => (t.params.TYPE ?? '').replace(/"/g, '');
  const escolhido = tels.find((t) => /CELL/.test(tipo(t))) ?? tels.find((t) => /PREF/.test(tipo(t)) || t.params.PREF) ?? tels[0];
  return escolhido ? escolhido.valor.replace(/^tel:/i, '').trim() : '';
}

/**
 * Lê o .vcf e devolve as linhas no formato da planilha: `[cabeçalho, ...cartões]`. Cartão sem nome e
 * sem telefone é descartado; o nome vem de FN ou, sem ele, de N (nome e sobrenome).
 */
export function lerVcard(texto: string): string[][] {
  const linhas = desdobrar(texto);
  const cartoes: Propriedade[][] = [];
  let atual: Propriedade[] | null = null;
  for (const l of linhas) {
    if (/^BEGIN:VCARD$/i.test(l.trim())) atual = [];
    else if (/^END:VCARD$/i.test(l.trim())) {
      if (atual) cartoes.push(atual);
      atual = null;
    } else if (atual) {
      const p = propriedade(l);
      if (p) atual.push(p);
    }
  }
  const saida: string[][] = [[...CABECALHO_VCARD]];
  for (const c of cartoes) {
    const um = (nome: string) => c.find((p) => p.nome === nome);
    const fn = desescapar(um('FN')?.valor ?? '').trim();
    const n = um('N')?.valor.split(';').map((x) => desescapar(x).trim()) ?? [];
    const nome = fn || [n[1], n[2], n[0]].filter(Boolean).join(' ').trim();
    const telefone = telefoneDe(c.filter((p) => p.nome === 'TEL'));
    const email = desescapar(um('EMAIL')?.valor ?? '').trim();
    const nota = desescapar(um('NOTE')?.valor ?? '').replace(/\s+/g, ' ').trim();
    if (!nome && !telefone) continue;
    saida.push([nome, telefone, email, nota]);
  }
  return saida;
}

/** O arquivo parece vCard (pelo nome ou pelo conteúdo). */
export const ehVcard = (nomeArquivo: string, texto: string) => /\.vcf$/i.test(nomeArquivo) || /^﻿?BEGIN:VCARD/i.test(texto.trimStart());
