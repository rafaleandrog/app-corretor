import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { build } from 'esbuild';

// Largura da moldura no desktop (#164). Hoje de verdade (renderHoje, com dados) dentro de um
// `urbi-shell-page`, no Chromium, em 1280, 1440, 1920 e 390 px.
//
// Os primitivos `urbi-*` são da instância e não vêm no SDK, então aqui eles são SUBSTITUTOS com a
// geometria que os docs do bundle descrevem: `urbi-shell-page` centraliza o corpo em 1200 px e
// `dashboard` tira o teto (ui-componentes-layout.md § urbi-shell-page); `urbi-3-colunas` com as
// laterais nas larguras dadas e o centro com o resto, abas abaixo de 900 px; `urbi-grid` com a fórmula
// documentada; filho `[expandir]` da `urbi-linha` com `flex: 1; min-width: 0`. O que não está
// documentado (respiro de 24/16 px, trilho de 64 px, corpo do KPI) é modelo. O teste mede o que a app
// decide (prop da página, larguras das colunas, onde cada coisa vai), não o pixel da instância.
// Sem Playwright instalado, pula.

function playwright(): any {
  try {
    return createRequire(import.meta.url)('playwright');
  } catch {
    return null;
  }
}

const HORA = 3600e3;
const agora = Date.now();
const DADOS = {
  fila: [
    { tipo: 'quente_sem_resposta', contato_id: 1, contato_nome: 'Ana Beatriz Figueiredo', temperatura: 'quente', quando: null, texto: 'Perguntou pelo apartamento de 3 quartos no Sudoeste' },
    { tipo: 'abordagem_vencida', contato_id: 2, contato_nome: 'Carlos Eduardo Monteiro', temperatura: 'morno', quando: new Date(agora - 2 * HORA).toISOString(), texto: 'Segunda abordagem do funil' },
    { tipo: 'visita', contato_id: 3, contato_nome: 'Daniela Prado', temperatura: 'quente', quando: new Date(agora + 3 * HORA).toISOString(), texto: 'Visita ao IM-0042', atividade_id: 9 },
  ],
  passagens: [
    { negociacao_id: 7, codigo: 'NG-0007', contato_id: 4, contato_nome: 'Eduardo Albuquerque Siqueira', motivo: 'O comprador pediu para falar com o corretor sobre a contraproposta do proprietário' },
  ],
  agenda_hoje: [{ id: 1, tipo: 'visita', titulo: 'Visita com Daniela Prado ao apartamento do Sudoeste', quando: new Date(agora + 3 * HORA).toISOString(), contato_nome: 'Daniela Prado' }],
  primeiros_passos: [
    { id: 'conta', rotulo: 'Complete os dados da sua conta', rota: '/ajustes', feito: true },
    { id: 'telefone', rotulo: 'Cadastre o telefone de atendimento', rota: '/ajustes', feito: false },
    { id: 'instagram', rotulo: 'Conecte o Instagram', rota: '/ajustes', feito: false },
    { id: 'imovel', rotulo: 'Cadastre o primeiro imóvel', rota: '/imoveis', feito: true },
    { id: 'pagina', rotulo: 'Publique a sua página', rota: '/pagina', feito: false },
  ],
  sem_creci: false,
  semana: { novos_contatos: 14, leads: 9, visitas: 6, previsao_c: 99811500 },
  demo_disponivel: false,
};

const ENTRADA = `
import { html, render } from 'lit';
import { renderHoje } from './frontend/telas/inicio';

// Substitutos dos primitivos: só geometria, nenhum comportamento.
const css = document.createElement('style');
css.textContent = \`
  html, body { margin: 0; height: 100%; font: 14px/1.4 sans-serif; }
  #raiz { height: 100%; display: flex; flex-direction: column; }
  urbi-shell-page { flex: 1; min-height: 0; display: flex; flex-direction: column; }
  urbi-shell-page > .pc-container { flex: 1; min-height: 0; display: flex; flex-direction: column; box-sizing: border-box;
    padding: 24px; width: 100%; max-width: 1200px; margin: 0 auto; }
  urbi-shell-page[dashboard] > .pc-container { max-width: none; }
  urbi-shell-page .pc-corpo { flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: auto; }
  urbi-shell-page .pc-corpo > [expandir], urbi-shell-page .pc-corpo > urbi-inbox { flex: 1 1 0%; min-height: 0; }
  urbi-inbox { display: grid; grid-template-columns: 64px minmax(0, 1fr); min-height: 0; }
  urbi-trilho-atalhos { display: block; }
  urbi-3-colunas { display: grid; grid-template-columns: var(--e) minmax(0, 1fr) var(--d); min-height: 0; min-width: 0; }
  urbi-3-colunas > * { min-width: 0; min-height: 0; }
  urbi-hospedeiro { display: flex; flex-direction: column; gap: 12px; padding: 16px; overflow: auto; box-sizing: border-box; min-width: 0; }
  urbi-stack { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
  urbi-linha { display: flex; align-items: center; gap: 8px; min-width: 0; }
  urbi-linha[justificar="entre"] { justify-content: space-between; }
  urbi-linha[quebrar] { flex-wrap: wrap; }
  urbi-linha > [expandir] { flex: 1; min-width: 0; }
  urbi-card { display: block; border: 1px solid #ccc; padding: 16px; overflow: auto; min-width: 0; }
  urbi-card > .pc-titulo { font-weight: 600; margin-bottom: 8px; }
  urbi-grid { display: grid; gap: 12px; grid-template-columns: repeat(auto-fill, minmax(min(var(--urbi-grid-min, 240px), 100%), 1fr)); }
  /* Piso documentado do urbi-kpi: 140px de largura externa (border-box) no desktop; em <=900px a pílula compacta não tem piso. */
  urbi-kpi { display: block; box-sizing: border-box; min-width: 140px; padding: 8px 12px; border: 1px solid #ccc; overflow: hidden; }
  @media (max-width: 900px) { urbi-kpi { min-width: 0; padding: 4px 8px; } }
  urbi-kpi > .pc-rotulo { display: block; font-size: 12px; }
  urbi-kpi > .pc-valor { display: block; font-size: 24px; font-weight: 700; white-space: nowrap; }
  urbi-botao { display: inline-flex; white-space: nowrap; overflow: hidden; padding: 4px 10px; border: 1px solid #999; }
  urbi-prosa { display: block; overflow-wrap: break-word; }
  urbi-prosa[papel="titulo"] { font-size: 22px; }
  urbi-badge { display: inline-block; white-space: nowrap; }
  urbi-lista, urbi-bolinhas, urbi-estado-vazio, urbi-banner, urbi-loading { display: block; }
  @media (max-width: 900px) {
    urbi-shell-page > .pc-container { padding: 16px; }
    urbi-inbox { grid-template-columns: minmax(0, 1fr); }
    urbi-trilho-atalhos { display: none; }
    urbi-3-colunas { grid-template-columns: minmax(0, 1fr); }
    urbi-3-colunas > [slot]:not([data-ativo]) { display: none; }
  }
\`;
document.head.append(css);

class Pagina extends HTMLElement {
  connectedCallback() {
    if (this.querySelector(':scope > .pc-container')) return;
    const c = document.createElement('div'); c.className = 'pc-container';
    const corpo = document.createElement('div'); corpo.className = 'pc-corpo';
    corpo.append(...this.childNodes); c.append(corpo); this.append(c);
  }
}
class TresColunas extends HTMLElement {
  static observedAttributes = ['largura-esquerda', 'largura-direita', 'colapsada-direita', 'painel-ativo'];
  attributeChangedCallback() { this.aplicar(); }
  connectedCallback() { this.aplicar(); queueMicrotask(() => this.aplicar()); }
  aplicar() {
    this.style.setProperty('--e', this.getAttribute('largura-esquerda') ?? '220px');
    this.style.setProperty('--d', this.hasAttribute('colapsada-direita') ? '0px' : (this.getAttribute('largura-direita') ?? '280px'));
    const ativo = this.getAttribute('painel-ativo') ?? 'centro';
    for (const f of this.children) f.toggleAttribute('data-ativo', f.getAttribute('slot') === ativo);
  }
}
const comProps = (desenho) => class extends HTMLElement {
  _p = {};
  connectedCallback() { this.desenhar(); }
  desenhar() { if (this.isConnected) render(desenho(this), this); }
  static props(...nomes) {
    for (const n of nomes) Object.defineProperty(this.prototype, n, { get() { return this._p[n]; }, set(v) { this._p[n] = v; this.desenhar(); } });
    return this;
  }
};
const Lista = comProps((el) => html\`\${(el._p.itens ?? []).map((i) => el._p.render_item?.(i))}\`).props('itens', 'render_item');
const Kpi = comProps((el) => html\`<span class="pc-rotulo">\${el.getAttribute('rotulo')}</span><span class="pc-valor">\${el._p.valor}</span>\`).props('valor');
class Card extends HTMLElement {
  connectedCallback() {
    if (this.querySelector(':scope > .pc-titulo') || !this.getAttribute('titulo')) return;
    const t = document.createElement('div'); t.className = 'pc-titulo'; t.textContent = this.getAttribute('titulo'); this.prepend(t);
  }
}
class Grid extends HTMLElement {
  connectedCallback() { this.style.setProperty('--urbi-grid-min', this.getAttribute('min') ?? '240px'); }
}
customElements.define('urbi-shell-page', Pagina);
customElements.define('urbi-3-colunas', TresColunas);
customElements.define('urbi-lista', Lista);
customElements.define('urbi-kpi', Kpi);
customElements.define('urbi-card', Card);
customElements.define('urbi-grid', Grid);

window.urbiVerso = {
  subRota: () => '/',
  href: (s) => '/portal_corretor' + s,
  navegarSub: () => {},
  usuario: () => ({ id: 1, nome: 'Marina' }),
  contexto: () => ({ conta: { resolucao: 'escopado', contas: [{ id: 100, nome: 'A' }], contaEscrita: 100 } }),
  notificar: () => {},
  alertar: async () => {},
  api: async (rota) => {
    const [caminho] = rota.split('?');
    if (caminho === '/inicio') return ${JSON.stringify(DADOS)};
    if (caminho === '/assistente/ia') return { assistente: true };
    return {};
  },
};

const raiz = document.getElementById('raiz');
window.desenhar = (dashboard) => {
  const pintar = () => render(html\`<urbi-shell-page titulo="Hoje" ?dashboard=\${dashboard}>\${renderHoje(pintar)}</urbi-shell-page>\`, raiz);
  pintar();
};
// Mede: largura da moldura contra a área do app (#raiz), colunas, e todo contêiner que rola na horizontal.
window.medir = () => {
  const area = raiz.getBoundingClientRect().width;
  const inbox = document.querySelector('urbi-inbox').getBoundingClientRect().width;
  const colunas = [...document.querySelectorAll('urbi-3-colunas > [slot]')].map((c) => [c.getAttribute('slot'), Math.round(c.getBoundingClientRect().width)]);
  const nome = (e) => e.localName + (e.getAttribute('slot') ? '[' + e.getAttribute('slot') + ']' : '') + (e.getAttribute('titulo') ? '«' + e.getAttribute('titulo') + '»' : '')
    + (e.localName === 'urbi-botao' || e.localName === 'urbi-kpi' ? '«' + e.textContent.trim().replace(/\\s+/g, ' ') + '»' : '');
  const transbordam = [...document.querySelectorAll('urbi-3-colunas *')]
    .filter((e) => e.clientWidth > 0 && e.scrollWidth > e.clientWidth + 1)
    .map(nome);
  // KPI com o valor em mais de uma linha, ou mais largo que a própria caixa: "quebrado"/cortado.
  const kpisQuebrados = [...document.querySelectorAll('urbi-kpi .pc-valor')]
    .filter((v) => v.getClientRects().length > 1 || v.scrollWidth > v.parentElement.clientWidth + 1)
    .map((v) => v.parentElement.getAttribute('rotulo'));
  const caixas = [...document.querySelectorAll('urbi-3-colunas *')].filter((e) => e.getClientRects().length)
    .map((e) => { const r = e.getBoundingClientRect(); return [e.localName, Math.round(r.x), Math.round(r.width)].join(':'); });
  const linhasDaSemana = new Set([...document.querySelectorAll('urbi-grid > urbi-kpi')].map((k) => Math.round(k.getBoundingClientRect().top))).size;
  return { area, inbox, fracao: inbox / area, colunas, transbordam, kpisQuebrados, caixas, linhasDaSemana };
};
`;

const DESKTOP = [1280, 1440, 1920];

test('moldura no desktop: usa a área do app, centro cresce, nada rola na horizontal em Hoje (#164)', async (t) => {
  const pw = playwright();
  if (!pw) return t.skip('Playwright não instalado neste ambiente');
  const pacote = await build({
    stdin: { contents: ENTRADA, resolveDir: process.cwd(), loader: 'ts' },
    bundle: true, write: false, format: 'iife', target: 'es2022', tsconfig: 'tsconfig.json', logLevel: 'silent',
  });
  const navegador = await pw.chromium.launch();
  try {
    // `PC_PRINTS_DIR=<pasta>` grava os prints de 1920 px (deviceScaleFactor 2) para o PR; sem ele, nada.
    const prints = process.env.PC_PRINTS_DIR;
    const abrir = async (largura: number, dashboard: boolean, direita?: string) => {
      const pagina = await navegador.newPage({ viewport: { width: largura, height: 900 }, deviceScaleFactor: prints ? 2 : 1 });
      await pagina.setContent('<!doctype html><html><body><div id="raiz"></div></body></html>');
      await pagina.addScriptTag({ content: pacote.outputFiles[0].text });
      await pagina.evaluate((d: boolean) => (window as any).desenhar(d), dashboard);
      await pagina.waitForFunction(() => document.querySelector('urbi-kpi[rotulo="Comissão prevista"]'));
      // A lateral arrastada até o mínimo (o atributo é o que o arrasto muda no primitivo real).
      if (direita) await pagina.evaluate((d: string) => document.querySelector('urbi-3-colunas')!.setAttribute('largura-direita', d), direita);
      await pagina.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      const m = await pagina.evaluate(() => (window as any).medir());
      if (prints && largura === 1920) await pagina.screenshot({ path: `${prints}/hoje-1920-${dashboard ? 'sem-teto' : 'com-teto'}.png` });
      await pagina.close();
      return m;
    };

    // A página das telas de moldura vai sem teto (como o app raiz decide, conferido abaixo).
    for (const largura of DESKTOP) {
      const m = await abrir(largura, true);
      assert.ok(m.fracao >= 0.9, `${largura}px: moldura com ${Math.round(m.fracao * 100)}% da área do app`);
      assert.deepEqual(m.transbordam, [], `${largura}px: contêiner com rolagem horizontal`);
      assert.deepEqual(m.kpisQuebrados, [], `${largura}px: KPI quebrado ou cortado`);
      const col = Object.fromEntries(m.colunas);
      assert.equal(col.direita, 340, `${largura}px: a lateral fica na largura de partida`);
      assert.ok(col.centro > col.esquerda && col.centro > col.direita, `${largura}px: o centro é a coluna mais larga (${JSON.stringify(col)})`);
    }

    // A lateral no mínimo do arrasto (300 px): os cartões da direita continuam sem cortar nem rolar.
    const minimo = await abrir(1280, true, '300px');
    assert.equal(Object.fromEntries(minimo.colunas).direita, 300);
    assert.deepEqual(minimo.transbordam, [], 'lateral em 300px: contêiner com rolagem horizontal');
    assert.deepEqual(minimo.kpisQuebrados, [], 'lateral em 300px: KPI quebrado ou cortado');
    // Com o `min` de 140px do contrato, a grade decide: a lateral não comporta dois pisos lado a lado (uma linha por contador).
    assert.equal(minimo.linhasDaSemana, 3, 'lateral em 300px: a grade põe um contador por linha');

    // Na lateral de partida (340 px) o miolo do cartão (~274 px) também não comporta dois pisos de 140px mais a folga.
    const partida = await abrir(1280, true);
    assert.equal(partida.linhasDaSemana, 3, 'lateral em 340px: a grade põe um contador por linha');

    // O defeito relatado, reproduzido: com o teto de 1200 px, em 1920 a moldura fica com ~60% da área.
    const antes = await abrir(1920, false);
    assert.ok(antes.fracao < 0.7, `com teto, ${Math.round(antes.fracao * 100)}%`);

    // Celular: `dashboard` não muda nada abaixo do teto (390 < 1200); sem rolagem horizontal nem corte.
    const celSem = await abrir(390, false);
    const celCom = await abrir(390, true);
    assert.deepEqual(celCom.caixas, celSem.caixas, '390px: a página igual com e sem dashboard');
    assert.deepEqual(celCom.transbordam, [], '390px: contêiner com rolagem horizontal');
    assert.deepEqual(celCom.kpisQuebrados, [], '390px: KPI quebrado ou cortado');
  } finally {
    await navegador.close();
  }
});

test('o app raiz tira o teto da página só quando a moldura está na tela (#164)', () => {
  const index = readFileSync(resolve(process.cwd(), 'frontend/index.ts'), 'utf8');
  assert.match(index, /<urbi-shell-page titulo=\$\{[^}]+\} \?dashboard=\$\{this\.naMoldura\(tela\)\}>/);
  // Moldura, e não o carregando, a falta de papel ou de conta (que vêm no lugar dela).
  assert.match(index, /naMoldura = \(tela: Tela \| undefined\) => !!tela\?\.moldura && this\.carregado && this\.liberada\(tela\) && !this\.faltaConta\(tela\);/);
  // Toda tela do corretor está na moldura (Hoje, Clientes, Imóveis, Estúdio, Página, Números, Ajustes,
  // Negociações e as de dentro delas). Lê cada entrada de TELAS, inclusive as de várias linhas.
  const bloco = index.slice(index.indexOf('const TELAS'), index.indexOf('\n};', index.indexOf('const TELAS')));
  const entradas = bloco.split(/\n  (?=\w+: \{)/).slice(1).map((e) => [e.slice(0, e.indexOf(':')), e] as const);
  assert.ok(entradas.length >= 14, `${entradas.length} telas lidas`);
  for (const [chave, corpo] of entradas) {
    if (!/papel: 'corretor'/.test(corpo)) continue;
    assert.match(corpo, /moldura: true/, `${chave} na moldura`);
  }
});
