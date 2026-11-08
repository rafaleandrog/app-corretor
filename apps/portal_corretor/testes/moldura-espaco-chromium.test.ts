import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

// Espaço do centro na moldura v2 (D-114, specs/layout/README.md § 3): as laterais são fixas (lista 360 px,
// contexto 340 px) em toda tela, com ou sem item escolhido, e o centro fica com o resto. `listaEstreita` e
// `recolherContexto`, que as telas ainda passam, não mudam nada. Mede em 1280, 1440 e 1920 px, com a moldura
// de verdade (`moldura()`) e substitutos dos primitivos só com a geometria dos docs do bundle. O respiro
// (24 px) é modelo, como em moldura-largura. Sem Playwright instalado, pula.

function playwright(): any {
  try {
    return createRequire(import.meta.url)('playwright');
  } catch {
    return null;
  }
}

const ENTRADA = `
import { html, nothing, render } from 'lit';
import { moldura } from './frontend/moldura';

const css = document.createElement('style');
css.textContent = \`
  html, body { margin: 0; height: 100%; font: 14px/1.4 sans-serif; }
  #raiz { height: 100%; display: flex; flex-direction: column; padding: 24px; box-sizing: border-box; }
  urbi-3-colunas { display: grid; grid-template-columns: var(--e) minmax(0, 1fr) var(--d); min-height: 0; min-width: 0; }
  urbi-3-colunas > * { min-width: 0; min-height: 0; overflow: hidden; }
  urbi-hospedeiro { display: block; padding: 16px; box-sizing: border-box; }
\`;
document.head.append(css);

const TRILHO = '34px';
class TresColunas extends HTMLElement {
  static observedAttributes = ['largura-esquerda', 'largura-direita', 'colapsada-direita', 'colapsada-esquerda'];
  attributeChangedCallback() { this.aplicar(); }
  connectedCallback() { this.aplicar(); }
  aplicar() {
    const lado = (l, padrao) => (this.hasAttribute('colapsavel-' + l) && this.hasAttribute('colapsada-' + l) ? TRILHO : (this.getAttribute('largura-' + l) ?? padrao));
    this.style.setProperty('--e', lado('esquerda', '220px'));
    this.style.setProperty('--d', lado('direita', '280px'));
  }
}
customElements.define('urbi-3-colunas', TresColunas);

window.urbiVerso = {
  subRota: () => '/',
  href: (s) => '/portal_corretor' + s,
  navegarSub: () => {},
  usuario: () => ({ id: 1, nome: 'Marina' }),
  contexto: () => ({ conta: { resolucao: 'escopado', contas: [{ id: 100, nome: 'A' }], contaEscrita: 100 } }),
};

const CASOS = {
  // O Funil antes: filtros em 360 px e a dica do cliente aberta em 340 px.
  funilAntes: { menu: '/clientes', lista: html\`filtros\`, centro: html\`quadro\`, contexto: html\`dica\` },
  funil: { menu: '/clientes', lista: html\`filtros\`, centro: html\`quadro\`, contexto: html\`dica\`, listaEstreita: true, recolherContexto: true },
  funilComCliente: { menu: '/clientes', lista: html\`filtros\`, centro: html\`quadro\`, contexto: html\`cliente\`, listaEstreita: true, recolherContexto: false },
  semContexto: { menu: '/imoveis', lista: html\`lista\`, centro: html\`vazio\`, contexto: nothing },
};
window.desenhar = (caso) => {
  const pintar = () => render(moldura(CASOS[caso], pintar), document.getElementById('raiz'));
  pintar();
  const c = document.querySelector('urbi-3-colunas');
  const largura = (slot) => Math.round(c.querySelector(':scope > [slot="' + slot + '"]').getBoundingClientRect().width);
  return { esquerda: largura('esquerda'), centro: largura('centro'), direita: largura('direita'), recolhida: c.hasAttribute('colapsada-direita') };
};
`;

test('moldura v2: laterais fixas de 360 e 340 px em toda tela; o centro fica com o resto', async (t) => {
  const pw = playwright();
  if (!pw) return t.skip('Playwright não instalado neste ambiente');
  const pacote = await build({
    stdin: { contents: ENTRADA, resolveDir: process.cwd(), loader: 'ts' },
    bundle: true, write: false, format: 'iife', target: 'es2022', tsconfig: 'tsconfig.json', logLevel: 'silent',
  });
  const navegador = await pw.chromium.launch();
  try {
    const medir = async (largura: number, caso: string) => {
      const pagina = await navegador.newPage({ viewport: { width: largura, height: 900 } });
      await pagina.setContent('<!doctype html><html><body><div id="raiz"></div></body></html>');
      await pagina.addScriptTag({ content: pacote.outputFiles[0].text });
      const m = await pagina.evaluate((c: string) => (window as any).desenhar(c), caso);
      await pagina.close();
      return m;
    };
    for (const largura of [1280, 1440, 1920]) {
      for (const caso of ['funilAntes', 'funil', 'funilComCliente', 'semContexto']) {
        const m = await medir(largura, caso);
        assert.equal(m.esquerda, 360, `${largura}px ${caso}: lista com 360 px`);
        assert.equal(m.direita, 340, `${largura}px ${caso}: contexto com 340 px`);
        assert.equal(m.recolhida, false, `${largura}px ${caso}: nada recolhe`);
        // O centro é o que sobra da área do app (a página tem 24 px de respiro de cada lado).
        assert.equal(m.centro, largura - 48 - 360 - 340, `${largura}px ${caso}: o centro fica com o resto`);
      }
    }
  } finally {
    await navegador.close();
  }
});
