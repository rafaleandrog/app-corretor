// Gera comum/ajuda-gerada.ts a partir de docs/*.md: a base de ajuda do Assistente (D-58).
// A app não lê os próprios docs em execução; o texto vai no bundle. Rode `pnpm ajuda` depois de
// mudar um doc. O teste `assistente.test.ts` reprova se o arquivo gerado estiver desatualizado.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Uma seção por `## `; o trecho antes da primeira vira a seção de abertura do artigo. */
export function gerarArtigos(dir) {
  const artigos = [];
  for (const arquivo of readdirSync(dir).filter((f) => f.endsWith('.md')).sort()) {
    const slug = arquivo.replace(/\.md$/, '').toLowerCase();
    let texto = readFileSync(join(dir, arquivo), 'utf8').replace(/\r\n/g, '\n');
    const fm = texto.match(/^---\n([\s\S]*?)\n---\n/);
    const titulo = fm?.[1].match(/^titulo:\s*(.+)$/m)?.[1].trim() ?? slug;
    if (fm) texto = texto.slice(fm[0].length);
    let secao = titulo;
    let corpo = [];
    const fechar = () => {
      const t = corpo.join('\n').replace(/^# .*$/m, '').trim();
      if (t) artigos.push({ slug, titulo, secao, texto: t });
      corpo = [];
    };
    for (const linha of texto.split('\n')) {
      const h = linha.match(/^##\s+(.+)$/);
      if (h) {
        fechar();
        secao = h[1].trim();
      } else corpo.push(linha);
    }
    fechar();
  }
  return artigos;
}

export function conteudoGerado(dir) {
  return (
    '// Gerado por scripts/gerar-ajuda.mjs a partir de docs/. Não edite: rode `pnpm ajuda`.\n' +
    'export interface ArtigoAjuda { slug: string; titulo: string; secao: string; texto: string }\n' +
    `export const ARTIGOS: ArtigoAjuda[] = ${JSON.stringify(gerarArtigos(dir), null, 1)};\n`
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  writeFileSync(join(raiz, 'comum/ajuda-gerada.ts'), conteudoGerado(join(raiz, 'docs')));
  console.log('comum/ajuda-gerada.ts atualizado');
}
