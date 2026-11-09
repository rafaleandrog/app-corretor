import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Issue #192, varredura de todas as telas (o teste de Chromium abre só as do #192): todo campo que o app
// monta leva o nome pelo atributo documentado do primitivo (ui-componentes-conteudo.md § Formulários), e
// todo campo do `urbiVerso.formulario` leva `rotulo` (o diálogo é do shell; ligar o rótulo ao campo é o
// pedido 29a). Lê o código-fonte de `frontend/`.

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? arquivos(p) : p.endsWith('.ts') ? [p] : [];
  });
}

const FONTES = arquivos('frontend').map((p) => ({ p, texto: readFileSync(p, 'utf8') }));
const linha = (texto: string, i: number) => texto.slice(0, i).split('\n').length;

/** Atributo que dá o nome a cada primitivo de campo. */
// O valor não pode ser um literal vazio (`label=""`, `label=''`): atributo presente e sem texto não dá nome.
const ATRIBUTO: Record<string, RegExp> = {
  label: /(^|\s)\.?label=(?!""|'')/,
  rotulo: /(^|\s)\.?rotulo=(?!""|'')/,
  aria: /(^|\s)(aria-label=|\.ariaLabel=)(?!""|'')/,
};

/** O campo do `formulario` (objeto de primeiro nível) tem `rotulo` com valor; literal vazio ('', "", ``) não vale. */
const rotuloOk = (obj: string) => /\brotulo\s*:\s*[^\s,}]/.test(obj) && !/\brotulo\s*:\s*(''|""|``)\s*(,|}|$)/.test(obj);
const PRIMITIVOS: Record<string, keyof typeof ATRIBUTO> = {
  'urbi-input': 'label',
  'urbi-input-numero': 'label',
  'urbi-input-data': 'label',
  'urbi-input-data-hora': 'label',
  'urbi-input-segredo': 'label',
  'urbi-textarea': 'label',
  'urbi-select': 'label',
  'urbi-select-usuarios': 'label',
  'urbi-checkbox': 'label',
  'urbi-seletor-arquivo': 'label',
  'urbi-editor-markdown': 'label',
  'urbi-slider': 'label',
  'urbi-seletor-objeto': 'rotulo',
  'urbi-toggle': 'aria',
  'urbi-botao-alternar': 'aria',
};

/**
 * Primitivos que o SDK não deixa nomear (pedido 29a): `urbi-redator` e `urbi-chat` (o composer é o redator por
 * dentro) só têm `placeholder`; nenhuma prop de nome (ui-componentes-conteudo.md § urbi-redator e § urbi-chat;
 * dist/index.d.ts, classe UrbiRedator). Não dá para exigir rótulo deles: ficam nesta lista explícita, são
 * contados (mínimo abaixo) e, enquanto o SDK não ganhar a prop, a exigência é ao menos `placeholder` com valor.
 */
const SEM_NOME_NO_SDK: Record<string, number> = { 'urbi-redator': 3, 'urbi-chat': 1 };

/** Tag `urbi-*` que parece campo/entrada: precisa estar em PRIMITIVOS ou em SEM_NOME_NO_SDK, senão o teste falha. */
const PARECE_CAMPO = /^urbi-(.*(input|select|textarea|redator|chat|busca|seletor|checkbox|toggle|slider|alternar|data|hora|numero|editor))/;

/** Fim da abertura de uma tag nativa: o primeiro `>` fora de `${...}`. */
function fimDaTag(texto: string, i: number): number {
  let d = 0;
  for (let k = i; k < texto.length; k++) {
    if (texto[k] === '$' && texto[k + 1] === '{') d++;
    else if (texto[k] === '}' && d > 0) d--;
    else if (texto[k] === '>' && d === 0) return k;
  }
  return texto.length;
}

const VALOR_ATTR = (nome: string) => new RegExp(`(?:^|\\s)${nome}=("[^"]*"|'[^']*'|\\$\\{(?:[^{}]|\\{[^{}]*\\})*\\})`);

/**
 * Campo nativo (páginas públicas, CSS próprio): nomeado por `aria-label`/`aria-labelledby` com valor, ou por
 * `id` com `<label for="mesmo-id">` no mesmo arquivo, ou por estar DENTRO de um `<label>…</label>` que o envolve.
 * `texto` é o arquivo; `i` é o índice do `<input|select|textarea`.
 */
function campoNativoNomeado(texto: string, i: number): boolean {
  const abertura = texto.slice(i, fimDaTag(texto, i));
  if (/(?:^|\s)aria-label(?:ledby)?=(?!""|'')\S/.test(abertura)) return true;
  const id = VALOR_ATTR('id').exec(abertura)?.[1];
  if (id && id !== '""' && id !== "''") {
    const bruto = id.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');
    if (new RegExp(`<label\\b[^>]*\\sfor=${bruto}`).test(texto)) return true;
  }
  const antes = texto.slice(Math.max(0, i - 800), i);
  const ini = antes.lastIndexOf('<label');
  if (ini >= 0 && antes.lastIndexOf('</label>') < ini && texto.indexOf('</label>', i) >= 0) {
    // O <label> aberto tem de fechar antes de outro <label> abrir (um só rótulo envolvente).
    const fecha = texto.indexOf('</label>', i);
    const proximoAbre = texto.indexOf('<label', i);
    return proximoAbre < 0 || proximoAbre > fecha;
  }
  return false;
}

/** Exceções nomeadas: campo nativo que de verdade não tem nome (arquivo:trecho -> motivo). Vazio quando todos passam. */
const EXCECOES_NATIVAS: Record<string, string> = {};

test('Rótulos (#192): todo primitivo de campo montado em frontend/ leva o atributo que dá o nome', () => {
  const faltam: string[] = [];
  const semNome: Record<string, number> = {};
  let vistos = 0;
  for (const { p, texto } of FONTES) {
    for (const m of texto.matchAll(/<(urbi-[a-z0-9-]+)(?=[\s>])/g)) {
      const tag = m[1];
      const onde = `${p}:${linha(texto, m.index!)}`;
      const attr = PRIMITIVOS[tag];
      if (SEM_NOME_NO_SDK[tag] !== undefined) {
        // Sem prop de nome no SDK: contado, e ao menos o placeholder com valor.
        semNome[tag] = (semNome[tag] ?? 0) + 1;
        const ab = texto.slice(m.index!, fimDaTag(texto, m.index!));
        if (!/(?:^|\s)placeholder=(?!""|'')\S/.test(ab)) faltam.push(`${onde} ${tag} (sem nome possível no SDK) nem placeholder`);
        continue;
      }
      if (!attr) {
        if (PARECE_CAMPO.test(tag)) faltam.push(`${onde} ${tag} parece campo mas não está classificado (PRIMITIVOS ou SEM_NOME_NO_SDK)`);
        continue;
      }
      vistos++;
      // A abertura vai até a tag de fechamento (os templates fecham cada primitivo); o atributo vem antes do conteúdo.
      const fim = texto.indexOf(`</${tag}>`, m.index);
      const abertura = texto.slice(m.index, fim < 0 ? m.index! + 600 : fim);
      // `urbi-botao-alternar`/`urbi-toggle` com texto no slot já têm nome (o aria-label é obrigatório só no só-ícone).
      const textoNoSlot = attr === 'aria' && abertura.slice(abertura.lastIndexOf('>') + 1).trim() !== '';
      if (!ATRIBUTO[attr].test(abertura) && !textoNoSlot) faltam.push(`${onde} ${tag} sem ${attr}`);
    }
    // Campo nativo (páginas públicas, CSS próprio): associação real ao nome.
    for (const m of texto.matchAll(/<(input|select|textarea)(?=[\s>])/g)) {
      const l = texto.split('\n')[linha(texto, m.index!) - 1];
      if (/type="hidden"/.test(l)) continue;
      vistos++;
      const onde = `${p}:${linha(texto, m.index!)}`;
      if (!campoNativoNomeado(texto, m.index!) && !EXCECOES_NATIVAS[onde]) faltam.push(`${onde} <${m[1]}> sem aria-label, label for=id nem <label> envolvente`);
    }
  }
  for (const [tag, n] of Object.entries(SEM_NOME_NO_SDK)) assert.ok((semNome[tag] ?? 0) >= n, `esperava >= ${n} <${tag}>, achou ${semNome[tag] ?? 0}`);
  assert.ok(vistos > 60, `varredura achou só ${vistos} campos`);
  assert.deepEqual(faltam, []);
});

/** O objeto literal em volta de `i`, só com o texto do primeiro nível (o de dentro de `opcoes` some). */
function objetoEmVolta(texto: string, i: number): string | null {
  let d = 0;
  let ini = -1;
  for (let k = i; k >= 0; k--) {
    if (texto[k] === '}') d++;
    else if (texto[k] === '{') {
      if (d === 0) {
        ini = k;
        break;
      }
      d--;
    }
  }
  if (ini < 0) return null;
  let saida = '';
  d = 0;
  for (let k = ini; k < texto.length; k++) {
    const c = texto[k];
    if (c === '{' || c === '[' || c === '(') d++;
    if (d === 1) saida += c;
    if (c === '}' || c === ']' || c === ')') {
      d--;
      if (d === 0) return saida;
    }
  }
  return null;
}

test('Rótulos (#192): todo campo do urbiVerso.formulario montado pelo app tem rotulo', () => {
  const faltam: string[] = [];
  let vistos = 0;
  for (const { p, texto } of FONTES) {
    for (const m of texto.matchAll(/\btipo:\s*'(texto|texto_longo|numero|data|booleano|selecao|busca)'/g)) {
      const obj = objetoEmVolta(texto, m.index!);
      // Campo do formulário tem `nome` (a chave da resposta); objeto sem `nome` é outra coisa (evento, balão).
      if (!obj || !/\bnome\s*:/.test(obj)) continue;
      vistos++;
      if (!rotuloOk(obj)) faltam.push(`${p}:${linha(texto, m.index!)} campo '${m[1]}' sem rotulo`);
    }
  }
  assert.ok(vistos > 100, `varredura achou só ${vistos} campos de formulário`);
  assert.deepEqual(faltam, []);
});

test('Rótulos (#192): a checagem recusa rótulo vazio e aceita rótulo dinâmico', () => {
  // Campos do formulario
  for (const vazio of [`{ nome: 'a', tipo: 'texto', rotulo: '' }`, `{ nome: 'a', tipo: 'texto', rotulo: "", obrigatorio: true }`, `{ nome: 'a', tipo: 'texto', rotulo: \`\` }`, `{ nome: 'a', tipo: 'texto' }`])
    assert.equal(rotuloOk(vazio), false, vazio);
  for (const bom of [`{ nome: 'a', tipo: 'texto', rotulo: 'Nome' }`, `{ nome: 'a', tipo: 'texto', rotulo: titulo }`, `{ nome: 'a', tipo: 'texto', rotulo: c.nome ?? 'x', valor: 1 }`, `{ nome: 'a', tipo: 'texto', rotulo: \`Cor ${'$'}{n}\` }`])
    assert.equal(rotuloOk(bom), true, bom);
  // Atributos dos primitivos
  for (const vazio of ['<urbi-input label="" valor="x">', "<urbi-input label=''>", '<urbi-input .label="">', '<urbi-toggle aria-label="">', '<urbi-input placeholder="a">'])
    assert.equal(ATRIBUTO[vazio.includes('toggle') ? 'aria' : 'label'].test(vazio), false, vazio);
  for (const bom of ['<urbi-input label="Nome">', '<urbi-input label=${expressao}>', '<urbi-input .label=${expressao}>', '<urbi-toggle aria-label=${x}>'])
    assert.equal(ATRIBUTO[bom.includes('toggle') ? 'aria' : 'label'].test(bom), true, bom);
});

test('Rótulos (#192): a classificação recusa tag de campo nova e a associação nativa só vale com ligação real', () => {
  for (const t of ['urbi-input-hora', 'urbi-busca', 'urbi-redator-novo', 'urbi-seletor-cor', 'urbi-chat-x']) assert.equal(PARECE_CAMPO.test(t), true, t);
  for (const t of ['urbi-botao', 'urbi-card', 'urbi-grafico-colunas', 'urbi-visualizador-arquivo']) assert.equal(PARECE_CAMPO.test(t), false, t);
  for (const t of Object.keys(PRIMITIVOS).concat(Object.keys(SEM_NOME_NO_SDK))) assert.equal(PARECE_CAMPO.test(t), true, t);
  // Avalia o ÚLTIMO campo nativo do texto.
  const ok = (t: string) => campoNativoNomeado(t, Math.max(t.lastIndexOf('<input'), t.lastIndexOf('<select'), t.lastIndexOf('<textarea')));
  // Falham: sem nome, label vizinho que não envolve, for com id diferente, aria vazio, label já fechado.
  for (const ruim of ['<div><input name="a" placeholder="x" /></div>', '<label>Nome</label><input name="a" />', '<label for="b">Nome</label><input id="a" name="a" />', '<input aria-label="" name="a" />', '<label>Nome <input name="a" /></label><input name="b" />'])
    assert.equal(ok(ruim), false, ruim);
  // Passam: aria-label (também dinâmico), label for=id (também dinâmico), campo dentro do label.
  for (const bom of ['<input aria-label="Nome" />', '<input aria-label=${x} />', '<input aria-labelledby="t" />', '<label for="a">Nome</label><input id="a" />', '<label for=${`v-${n}`}>Nome</label><input id=${`v-${n}`} />', '<label>Nome <input name="a" /></label>', '<label>Nome<textarea name="a"></textarea></label>'])
    assert.equal(ok(bom), true, bom);
});
