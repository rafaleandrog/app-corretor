import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Issue #176: o texto de apoio das telas tem de ficar a 4,5:1 ou mais contra o fundo (guia do Padrão B, § 1).
// Medido no shell 0.56.37 (`specs/prints/issue-176/`; não é contrato do SDK): `urbi-prosa papel="fraco"`
// (`--cor-texto-fraco`, que o SDK documenta como meta/placeholder/disabled) mede abaixo de 4,5:1: 3,04 a
// 3,10 no claro (2,89 no Funil) e 3,70 a 3,78 no escuro. O app trocou para `papel="dica"` (mesmo tamanho,
// `--cor-texto-sec`), que no mesmo shell mede 4,60 ou melhor no claro em 10 das 11 telas medidas (exceção:
// Funil, 4,24 sobre o cartão `variante-alerta`). O SDK não documenta cor nem contraste do `dica`.
// Este teste proíbe o `fraco` enquanto o token do shell estiver abaixo de 4,5:1 (medido no shell 0.56.37):
// se o shell subir o token, o teste deve ser revisto. Lê o código-fonte de `frontend/`.

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? arquivos(p) : p.endsWith('.ts') ? [p] : [];
  });
}

// Literal no atributo (papel="fraco") e valor de expressão (papel=${x ? 'fraco' : …}), com espaços em volta do `=`.
const PAPEL_FRACO = /papel\s*=\s*(?:"fraco"|'fraco'|\$\{[^}]*['"`]fraco['"`][^}]*\})/g;

test('nenhuma tela usa o papel "fraco" do urbi-prosa (abaixo de 4,5:1 nos temas claro e escuro)', () => {
  const achados: string[] = [];
  for (const p of arquivos('frontend')) {
    const texto = readFileSync(p, 'utf8');
    for (const m of texto.matchAll(PAPEL_FRACO)) {
      achados.push(`${p}:${texto.slice(0, m.index).split('\n').length}`);
    }
  }
  assert.deepEqual(achados, [], 'troque por papel="dica" (mesmo tamanho, --cor-texto-sec); o fraco mede abaixo de 4,5:1 no shell 0.56.37 (revise este teste se o shell subir o token)');
});

test('a regex do fraco pega as formas com espaço em volta do "=" e deixa o "dica" passar', () => {
  const casos: [string, number][] = [
    ['<urbi-prosa papel="fraco">x</urbi-prosa>', 1],
    ['<urbi-prosa papel = "fraco">x</urbi-prosa>', 1],
    ['<urbi-prosa papel= "fraco">x</urbi-prosa>', 1],
    ['<urbi-prosa papel ="fraco">x</urbi-prosa>', 1],
    ["<urbi-prosa papel = 'fraco'>x</urbi-prosa>", 1],
    ["<urbi-prosa papel=${a ? 'fraco' : 'dica'}>x</urbi-prosa>", 1],
    ["<urbi-prosa papel = ${a ? 'fraco' : 'dica'}>x</urbi-prosa>", 1],
    ["<urbi-prosa papel= ${ a ? `fraco` : 'dica' }>x</urbi-prosa>", 1],
    ['<urbi-prosa papel="dica">x</urbi-prosa>', 0],
    ['<urbi-prosa papel = "dica">x</urbi-prosa>', 0],
    ["<urbi-prosa papel=${a ? 'dica' : 'secundario'}>x</urbi-prosa>", 0],
  ];
  for (const [texto, esperado] of casos) assert.equal([...texto.matchAll(PAPEL_FRACO)].length, esperado, texto);
});
