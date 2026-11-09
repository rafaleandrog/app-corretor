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

test('Rótulos (#192): todo primitivo de campo montado em frontend/ leva o atributo que dá o nome', () => {
  const faltam: string[] = [];
  let vistos = 0;
  for (const { p, texto } of FONTES) {
    for (const m of texto.matchAll(/<(urbi-[a-z-]+)(?=[\s>])/g)) {
      const tag = m[1];
      const attr = PRIMITIVOS[tag];
      if (!attr) continue;
      vistos++;
      // A abertura vai até a tag de fechamento (os templates fecham cada primitivo); o atributo vem antes do conteúdo.
      const fim = texto.indexOf(`</${tag}>`, m.index);
      const abertura = texto.slice(m.index, fim < 0 ? m.index + 600 : fim);
      // `urbi-botao-alternar`/`urbi-toggle` com texto no slot já têm nome (o aria-label é obrigatório só no só-ícone).
      const textoNoSlot = attr === 'aria' && abertura.slice(abertura.lastIndexOf('>') + 1).trim() !== '';
      if (!ATRIBUTO[attr].test(abertura) && !textoNoSlot) faltam.push(`${p}:${linha(texto, m.index!)} ${tag} sem ${attr}`);
    }
    // Campo nativo (páginas públicas, CSS próprio): dentro de <label> ou com aria-label.
    for (const m of texto.matchAll(/<(input|select|textarea)(?=[\s>])/g)) {
      const l = texto.split('\n')[linha(texto, m.index!) - 1];
      if (/type="hidden"/.test(l)) continue;
      vistos++;
      if (!/<label[\s>]/.test(l) && !/aria-label(ledby)?=/.test(l)) faltam.push(`${p}:${linha(texto, m.index!)} <${m[1]}> sem <label> nem aria-label`);
    }
  }
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
