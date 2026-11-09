import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

// Agenda no celular (390 × 844): título e linha de cliente longos terminam em reticências em vez de serem
// cortados. O corte vem do primitivo `urbi-prosa` (atributo `truncar`) dentro de um `urbi-stack expandir`,
// o mesmo padrão de Imóveis (#180). Os primitivos `urbi-*` não têm registro no Chromium dos testes, então o
// teste confere o que a tela entrega a eles (atributos e texto inteiro no `title`) e que a página não rola
// para o lado; o `text-overflow` em si é do primitivo e se confere na conferência visual. Sem Playwright, pula.

function playwright(): any {
  try {
    return createRequire(import.meta.url)('playwright');
  } catch {
    return null;
  }
}

const ORIGEM = 'https://app.exemplo';
const LONGO = 'Visita ao apartamento de cobertura duplex com vista para o lago e três vagas de garagem cobertas no Lago Sul';

const ENTRADA = `
import { render } from 'lit';
import './frontend/telas/agenda';
window.urbiVerso = { href: (s) => s, api: async () => ({ dados: [], total: 0 }), alertar: async () => {}, contexto: () => ({ conta: { resolucao: 'escopado', contas: [{ id: 1, nome: 'A' }], contaEscrita: 1 } }) };
const el = document.createElement('pc-tela-agenda');
const a = { id: 1, tipo: 'visita', titulo: ${JSON.stringify(LONGO)}, quando: '2026-11-10T14:00:00Z', contato_nome: 'Maria Aparecida de Albuquerque e Souza Pereira', imovel_codigo: 'AP-0042', local: 'Quadra 12 conjunto 4 casa 7, Lago Sul, Brasília' };
document.getElementById('raiz').appendChild(el);
render(el.item(a), document.getElementById('lista'));
`;

test('Agenda no celular: título longo usa truncar (reticências) e não estoura a página', async (t) => {
  const pw = playwright();
  if (!pw) return t.skip('Playwright não instalado neste ambiente');
  const pacote = await build({
    stdin: { contents: ENTRADA, resolveDir: process.cwd(), loader: 'ts' },
    bundle: true, write: false, format: 'iife', target: 'es2022', tsconfig: 'tsconfig.json', logLevel: 'silent',
  });
  const html = `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0"><div id="raiz"></div><div id="lista" style="width:358px"></div><script>${pacote.outputFiles[0].text}</script></body></html>`;
  const navegador = await pw.chromium.launch();
  try {
    const pagina = await navegador.newPage({ viewport: { width: 390, height: 844 } });
    await pagina.route(`${ORIGEM}/**`, (r: any) => r.fulfill({ contentType: 'text/html', body: html }));
    await pagina.goto(`${ORIGEM}/`);
    const r = await pagina.evaluate(() => {
      const prosas = [...document.querySelectorAll('#lista urbi-prosa')];
      const stack = document.querySelector('#lista urbi-stack');
      return {
        truncar: prosas.map((p) => p.hasAttribute('truncar')),
        titulos: prosas.map((p) => p.getAttribute('title')),
        textos: prosas.map((p) => p.textContent?.trim()),
        expandir: stack?.hasAttribute('expandir'),
        estouro: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      };
    });
    assert.equal(r.truncar.length, 2);
    assert.deepEqual(r.truncar, [true, true], 'as duas linhas truncam com reticências');
    assert.equal(r.expandir, true, 'o stack expande para a prosa poder encolher ao lado do botão');
    assert.match(r.titulos[0] ?? '', /Lago Sul$/, 'o título inteiro fica no title');
    assert.equal(r.titulos[0], r.textos[0]);
    assert.equal(r.titulos[1], r.textos[1]);
    assert.equal(r.estouro, false, 'a página não rola para o lado em 390 px');
  } finally {
    await navegador.close();
  }
});
