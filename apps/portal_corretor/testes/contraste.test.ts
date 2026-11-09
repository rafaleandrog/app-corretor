import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Issue #176: o texto de apoio das telas tem de ficar a 4,5:1 ou mais contra o fundo (guia do Padrão B, § 1).
// Medido na homologação (shell 0.56.37, `specs/prints/issue-176/`): `urbi-prosa papel="fraco"` pinta
// `--cor-texto-fraco` (meta, placeholder, desabilitado: ui.md § Tokens) e fica em 3,04 a 3,10:1 no tema
// claro e 3,70 a 3,78:1 no escuro; `papel="dica"` tem o mesmo tamanho (0,75rem) com `--cor-texto-sec` e
// fica em 4,60 a 4,74:1 (claro) e 4,97 a 5,18:1 (escuro). Nenhum texto das telas é desabilitado, então
// nenhuma usa `fraco`. Lê o código-fonte de `frontend/`.

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? arquivos(p) : p.endsWith('.ts') ? [p] : [];
  });
}

test('nenhuma tela usa o papel "fraco" do urbi-prosa (abaixo de 4,5:1 nos temas claro e escuro)', () => {
  const achados: string[] = [];
  for (const p of arquivos('frontend')) {
    const texto = readFileSync(p, 'utf8');
    // Literal no atributo (papel="fraco") e valor de expressão (papel=${x ? 'fraco' : …}).
    for (const m of texto.matchAll(/papel=(?:"fraco"|'fraco'|\$\{[^}]*['"`]fraco['"`][^}]*\})/g)) {
      achados.push(`${p}:${texto.slice(0, m.index).split('\n').length}`);
    }
  }
  assert.deepEqual(achados, [], 'troque por papel="dica" (mesmo tamanho, --cor-texto-sec)');
});
