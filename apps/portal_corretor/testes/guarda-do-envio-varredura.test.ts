import { test } from 'node:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import assert from 'node:assert/strict';

// Varredura do guarda único do envio (issue #144). O guarda mora em `frontend/apoio.ts`: `chamarApi`,
// `chamarFetch` e `enviar` rejeitam com `ContaTrocada` quando a conta de trabalho mudou com o pedido em
// voo. Ele só protege quem passa por ele, e a rejeição só é silenciosa se quem trata o erro a deixar
// passar. Esta varredura falha se alguma tela:
//   1. chamar `urbiVerso.api`, `urbiVerso.fetch` ou `fetch` direto (fora do guarda);
//   2. tratar um erro (`catch (e) { ... }`, `.catch(...)`, o 2º argumento de `.then`) sem deixar
//      `ContaTrocada` passar em silêncio: o tratador precisa citar `ehContaTrocada`, `seNaoContaTrocada`,
//      `encerrado(` (o `Gesto`, que engole `ContaTrocada`) ou o encerramento do Estúdio, ou só relançar,
//      ou ser um valor constante que não avisa nem mexe em estado (`() => null`, `() => false`...).
// As páginas públicas (`frontend/publico/`) ficam fora: são anônimas, sem conta nem `X-Conta`.

const RAIZ = resolve(process.cwd(), 'frontend');

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return n === 'publico' ? [] : arquivos(p);
    return n.endsWith('.ts') && !n.endsWith('.d.ts') ? [p] : [];
  });
}

/** O código sem comentários e com o conteúdo das strings apagado (as posições não mudam). */
function semComentariosNemStrings(src: string): string {
  const out = src.split('');
  let i = 0;
  const apagar = (a: number, b: number) => {
    for (let k = a; k < b; k++) if (out[k] !== '\n') out[k] = ' ';
  };
  // Pilha de templates: dentro de `${ ... }` volta a ser código; conta as chaves para achar o fim.
  const pilha: number[] = [];
  while (i < src.length) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') {
      const f = src.indexOf('\n', i);
      const fim = f < 0 ? src.length : f;
      apagar(i, fim);
      i = fim;
    } else if (c === '/' && src[i + 1] === '*') {
      const fim = src.indexOf('*/', i + 2) + 2;
      apagar(i, fim);
      i = fim;
    } else if (c === "'" || c === '"') {
      let j = i + 1;
      while (j < src.length && src[j] !== c) j += src[j] === '\\' ? 2 : 1;
      apagar(i + 1, j);
      i = j + 1;
    } else if (c === '`' || (c === '}' && pilha.length && pilha[pilha.length - 1] === 0)) {
      if (c === '}') pilha.pop();
      // Lê o trecho literal do template até o fim ou até `${`.
      let j = i + 1;
      while (j < src.length && src[j] !== '`' && !(src[j] === '$' && src[j + 1] === '{')) j += src[j] === '\\' ? 2 : 1;
      apagar(i + 1, j);
      if (src[j] === '$') {
        pilha.push(0);
        i = j + 2;
      } else i = j + 1;
    } else {
      if (pilha.length && c === '{') pilha[pilha.length - 1]++;
      if (pilha.length && c === '}') pilha[pilha.length - 1]--;
      i++;
    }
  }
  return out.join('');
}

/** Índice do fechamento que casa com a abertura em `ini` (`(`, `{` ou `[`). */
function fechar(src: string, ini: number): number {
  const par: Record<string, string> = { '(': ')', '{': '}', '[': ']' };
  const pilha = [par[src[ini]]];
  for (let i = ini + 1; i < src.length; i++) {
    const c = src[i];
    if (par[c]) pilha.push(par[c]);
    else if (c === pilha[pilha.length - 1]) {
      pilha.pop();
      if (!pilha.length) return i;
    }
  }
  return src.length;
}

/** Índice da abertura `{` que casa com o fechamento `}` em `fim`. */
function abrir(src: string, fim: number): number {
  let prof = 0;
  for (let i = fim; i >= 0; i--) {
    if (src[i] === '}') prof++;
    else if (src[i] === '{' && --prof === 0) return i;
  }
  return 0;
}

/** Divide os argumentos de uma chamada no nível de cima. */
function argumentos(src: string, abre: number): string[] {
  const fim = fechar(src, abre);
  const args: string[] = [];
  let ini = abre + 1;
  let prof = 0;
  for (let i = abre + 1; i < fim; i++) {
    const c = src[i];
    if ('([{'.includes(c)) prof++;
    else if (')]}'.includes(c)) prof--;
    else if (c === ',' && prof === 0) {
      args.push(src.slice(ini, i));
      ini = i + 1;
    }
  }
  args.push(src.slice(ini, fim));
  return args.map((a) => a.trim()).filter(Boolean);
}

const GUARDA = /\behContaTrocada\(|\bseNaoContaTrocada\(|\.encerrado\(|\bnew ContaTrocada\(|\bInstanciaEncerrada\b|\bsilencioso\(/;
// Tratador que só arruma o que é dele (fechar uma janela) e relança: quem chamou decide.
const SO_RELANCA = (corpo: string, v: string) =>
  new RegExp(`(^|;|\\})\\s*throw ${v};?$`).test(corpo) && !/alertar\(|notificar\(|[^=!<>]=[^=>]/.test(corpo);
// Tratador que não avisa nem mexe em nada: só devolve um valor constante.
const CONSTANTE = /^\(\s*\)\s*=>\s*(\(\s*)?(undefined|null|false|true|-?\d+|\[\]|\{\s*\}|\{\s*dados\s*:\s*\[\]\s*\}|void 0)(\s*\))?$/;

interface Achado {
  arquivo: string;
  linha: number;
  motivo: string;
}

function linhaDe(src: string, i: number) {
  return src.slice(0, i).split('\n').length;
}

function varrer(arquivo: string): Achado[] {
  const cru = readFileSync(arquivo, 'utf8');
  const src = semComentariosNemStrings(cru);
  const nome = relative(process.cwd(), arquivo);
  const achados: Achado[] = [];
  const achar = (i: number, motivo: string) => achados.push({ arquivo: nome, linha: linhaDe(src, i), motivo });

  if (!arquivo.endsWith(join('frontend', 'apoio.ts'))) {
    for (const m of src.matchAll(/urbiVerso\s*\.\s*(api|fetch)\s*\(|(?<![\w.$])fetch\s*\(/g)) {
      achar(m.index!, `chamada direta (${m[0].trim()}): use chamarApi/chamarFetch/enviar de apoio.ts`);
    }
  }

  // catch (e) { ... }
  for (const m of src.matchAll(/\bcatch\s*\(\s*(\w+)\s*\)\s*\{/g)) {
    const abre = m.index! + m[0].length - 1;
    const corpo = src.slice(abre + 1, fechar(src, abre)).trim();
    const v = m[1];
    if (GUARDA.test(corpo)) continue;
    if (SO_RELANCA(corpo, v)) continue;
    achar(m.index!, `catch (${v}) sem deixar ContaTrocada passar: ${corpo.slice(0, 80).replace(/\s+/g, ' ')}`);
  }
  // catch { ... } sem variável, num try que fala com o app: não pode avisar nem marcar falha (a falha
  // pode ser só `ContaTrocada`). O try que não fala com o app (área de transferência, armazenamento) fica livre.
  for (const m of src.matchAll(/\bcatch\s*\{/g)) {
    const abre = m.index! + m[0].length - 1;
    const corpo = src.slice(abre + 1, fechar(src, abre));
    const fimTry = src.lastIndexOf('}', m.index!);
    const tentativa = src.slice(abrir(src, fimTry), fimTry);
    if (!/chamarApi\(|chamarFetch\(|enviar\(|subirArquivo\(|lerDiasParado\(/.test(tentativa)) continue;
    if (/alertar\(|notificar\(|navegar|irPara|falha\s*=|erro\s*=/.test(corpo) && !GUARDA.test(corpo)) {
      achar(m.index!, `catch sem variável que avisa ou marca falha: ${corpo.trim().slice(0, 80).replace(/\s+/g, ' ')}`);
    }
  }
  // .catch(handler)
  for (const m of src.matchAll(/\.catch\s*\(/g)) {
    const abre = m.index! + m[0].length - 1;
    const [h = ''] = argumentos(src, abre);
    if (GUARDA.test(h) || CONSTANTE.test(h)) continue;
    achar(m.index!, `.catch sem deixar ContaTrocada passar: ${h.slice(0, 80).replace(/\s+/g, ' ')}`);
  }
  // .then(ok, falha)
  for (const m of src.matchAll(/\.then\s*\(/g)) {
    const abre = m.index! + m[0].length - 1;
    const args = argumentos(src, abre);
    if (args.length < 2) continue;
    const h = args[1];
    if (GUARDA.test(h) || CONSTANTE.test(h)) continue;
    achar(m.index!, `2º argumento de .then sem deixar ContaTrocada passar: ${h.slice(0, 80).replace(/\s+/g, ' ')}`);
  }
  return achados;
}

test('varredura: nenhuma tela chama urbiVerso.api/fetch direto, e todo tratador de erro deixa ContaTrocada passar em silêncio', () => {
  const todos = arquivos(RAIZ).flatMap(varrer);
  assert.deepEqual(
    todos.map((a) => `${a.arquivo}:${a.linha} ${a.motivo}`),
    [],
  );
});

test('a varredura pega o que deve pegar', () => {
  const amostra = semComentariosNemStrings(`
    // urbiVerso.api('/em-comentario') não conta
    const s = 'fetch(';
    try { await chamarApi('/x'); } catch (e) { urbiVerso.alertar({ mensagem: \`\${e}\` }); }
    chamarApi('/y').catch((e) => (estado.falha = e));
    chamarApi('/z').then((r) => r, () => (estado.ia = false));
  `);
  assert.ok(!/urbiVerso\s*\.\s*api/.test(amostra), 'comentário apagado');
  assert.ok(!/fetch\(/.test(amostra), 'string apagada');
  const fechaCatch = amostra.indexOf('{', amostra.indexOf('catch'));
  assert.match(amostra.slice(fechaCatch, fechar(amostra, fechaCatch) + 1), /alertar/);
  const doCatch = amostra.indexOf('(', amostra.indexOf('.catch'));
  assert.equal(argumentos(amostra, doCatch).length, 1);
  const doThen = amostra.indexOf('(', amostra.indexOf('.then'));
  assert.equal(argumentos(amostra, doThen)[1], '() => (estado.ia = false)');
  assert.ok(CONSTANTE.test('() => null') && CONSTANTE.test('() => ({ dados: [] })') && !CONSTANTE.test('() => (this.ia = false)'));
});
