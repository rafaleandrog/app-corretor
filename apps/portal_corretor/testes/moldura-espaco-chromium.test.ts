import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

// Espaço do centro na moldura: o quadro do Funil (e a ficha de Clientes, Negociações e Imóveis sem
// nada escolhido) ficava espremido entre duas laterais fixas, a da direita só com uma dica ou vazia.
// Agora a direita sem conteúdo começa recolhida (o trilho fino do `urbi-3-colunas`) e, no Funil, os
// filtros ficam numa coluna estreita. Mede o centro em 1280, 1440 e 1920 px, com a moldura de verdade
// (`moldura()`) e substitutos dos primitivos só com a geometria dos docs do bundle
// (ui-componentes-layout.md § urbi-3-colunas: laterais nas larguras dadas, trilho de 34 px quando
// colapsada). O respiro (24 px) e o trilho do inbox (64 px) são modelo, como em moldura-largura.
// Sem Playwright instalado, pula.

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
  urbi-inbox { flex: 1; display: grid; grid-template-columns: 64px minmax(0, 1fr); min-height: 0; }
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

test('moldura: a direita sem conteúdo recolhe e o quadro do Funil ganha a largura', async (t) => {
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
      const antes = await medir(largura, 'funilAntes');
      const funil = await medir(largura, 'funil');
      assert.equal(funil.esquerda, 280, `${largura}px: filtros do Funil na coluna estreita`);
      assert.ok(funil.recolhida && funil.direita === 34, `${largura}px: sem cartão escolhido, a direita é só o trilho (${funil.direita})`);
      // 80 px da lista + 306 px da direita voltam para o quadro.
      assert.equal(funil.centro - antes.centro, 80 + 340 - 34, `${largura}px: o quadro ganha a largura das laterais`);
      // Em 1280 px o quadro passa de ~470 px para mais de 850 px.
      if (largura === 1280) assert.ok(antes.centro < 500 && funil.centro > 850, `1280px: ${antes.centro} → ${funil.centro}`);

      const comCliente = await medir(largura, 'funilComCliente');
      assert.ok(!comCliente.recolhida && comCliente.direita === 340, `${largura}px: com o cartão escolhido, o cliente abre à direita`);

      const vazio = await medir(largura, 'semContexto');
      assert.ok(vazio.recolhida && vazio.direita === 34, `${largura}px: contexto vazio (nothing) não ocupa 340 px`);
    }
  } finally {
    await navegador.close();
  }
});
