// Conferência visual (specs/layout/README.md § 6), passo 1: captura as telas da app NA INSTÂNCIA,
// nos viewports do contrato (1440 de largura no computador; 390 × 844 no celular), e extrai as
// caixas e estilos dos elementos pelo DOM (atravessando shadow roots), no mesmo formato dos
// `specs/layout/<tela>.layout.json`.
//
// Como entra sem senha: a tela do shell só reconhece sessão por cookie, mas a API aceita o token
// Bearer. O script injeta o token em todas as chamadas e responde ele mesmo à única rota que exige
// cookie (`/api/shell/auth/eu-sistema`) com o corpo da rota equivalente que aceita token
// (`/api/shell/auth/identidade`). Nada é gravado na instância.
//
// Uso (na raiz do repositório, com URBIVERSO_INSTANCIAS no ambiente):
//   node apps/portal_corretor/scripts/conferencia-visual/capturar.mjs <nome da instância> <pasta de saída> [P01,M4,...]
// Contrato v2 (specs/layout/README.md): no computador, a imagem e as medidas são só da ÁREA DA APP (a moldura
// de três colunas dentro da página do shell, 1289 px em viewport de 1440), com x e y a partir do canto dela.
// Playwright: usa o pré-instalado do ambiente (require.resolve), sem instalar nada.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = await import(require.resolve('playwright').replace(/index\.js$/, 'index.mjs'));

const [nome, saida, filtro] = process.argv.slice(2);
if (!nome || !saida) { console.error('uso: capturar.mjs <instância> <pasta de saída> [telas separadas por vírgula]'); process.exit(2); }
const inst = JSON.parse(process.env.URBIVERSO_INSTANCIAS ?? '[]').find((x) => x.nome === nome);
if (!inst) { console.error(`instância "${nome}" não está em URBIVERSO_INSTANCIAS`); process.exit(2); }
// CONTA=<id> escolhe a conta de trabalho para quem atende várias (X-Conta nas chamadas e a escolha da tela).
const CONTA = process.env.CONTA ? Number(process.env.CONTA) : null;
const H = { Authorization: `Bearer ${inst.token}`, ...(CONTA ? { 'X-Conta': String(CONTA) } : {}) };
mkdirSync(saida, { recursive: true });

// Dados de apoio, só leitura: um cliente com link do portal ativo e um imóvel da carteira.
async function apoio(ctx) {
  const api = async (p) => (await ctx.request.get(inst.url + '/api/portal_corretor' + p)).json();
  const contatos = (await api('/contatos?por_pagina=50')).dados ?? [];
  let cliente = contatos[0]?.id ?? null, portal = null;
  for (const c of contatos) {
    const r = await api(`/contatos/${c.id}/portal`);
    if (r?.ativo && r.link) { cliente = c.id; portal = r.link; break; }
  }
  const imovel = (await api('/imoveis?por_pagina=1')).dados?.[0]?.id ?? null;
  const pagina = (await api('/pagina')).pagina?.endereco ?? null;
  const conversa = (await api('/conversas').catch(() => ({ dados: [] }))).dados?.[0]?.id ?? null;
  return { cliente, portal, imovel, pagina, conversa };
}

const EXTRAIR = `(() => {
  const LAND = new Set(['NAV','MAIN','SECTION','ASIDE','HEADER','H1','H2','H3','BUTTON','INPUT','TEXTAREA','SELECT']);
  const nos = []; let id = 0;
  const visitar = (el, parent) => {
    if (!(el instanceof Element)) return;
    const tag = el.tagName, r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    const vis = r.width >= 8 && r.height >= 8 && cs.visibility !== 'hidden' && cs.display !== 'none';
    let meu = parent;
    if (vis) {
      const texto = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(' ').trim();
      const label = el.getAttribute('aria-label') || el.getAttribute('titulo') || el.getAttribute('label') || '';
      if (tag.includes('-') || LAND.has(tag) || texto || label) {
        meu = ++id;
        nos.push({ id: meu, parent, tag: tag.toLowerCase(), label, text: texto.slice(0, 60),
          box: { x: Math.round(r.x + scrollX), y: Math.round(r.y + scrollY), w: Math.round(r.width), h: Math.round(r.height) },
          style: { display: cs.display, direction: cs.flexDirection, gap: cs.gap, padding: cs.padding, radius: cs.borderRadius, font: cs.fontSize + '/' + cs.fontWeight, bg: cs.backgroundColor } });
      }
    }
    if (el.shadowRoot) for (const c of el.shadowRoot.children) visitar(c, meu);
    for (const c of el.children) visitar(c, meu);
  };
  visitar(document.body, 0);
  return nos;
})()`;

const browser = await chromium.launch();
async function contexto(vp) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, extraHTTPHeaders: H, ...(vp.width < 500 ? { isMobile: true, hasTouch: true } : {}) });
  const id = await (await ctx.request.get(inst.url + '/api/shell/auth/identidade')).json();
  const eu = { ...id, email: 'conferencia@exemplo.invalid', origem: 'local', tem_senha: true, email_verificado_em: new Date().toISOString() };
  delete eu.credencial;
  await ctx.route(/\/api\/shell\/auth\/(eu-sistema|eu)$/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(eu) }));
  await ctx.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, (r) => r.abort()); // a fonte do tema vem de fora; sem rede, cai na fonte do sistema
  if (CONTA) await ctx.addInitScript((c) => { try { localStorage.setItem('portal_corretor:conta', String(c)); } catch {} }, CONTA);
  return ctx;
}
const ctx0 = await contexto({ width: 1440, height: 1000 });
const a = await apoio(ctx0);
await ctx0.close();

const TELAS = [
  ['P01-Hoje', 'desk', '/portal_corretor/'],
  ['P02-Conversas', 'desk', a.conversa && `/portal_corretor/conversas?item=${a.conversa}`],
  ['P03-Funil', 'desk', '/portal_corretor/clientes?visao=funil'],
  ['P04-Cliente', 'desk', a.cliente && `/portal_corretor/clientes?item=${a.cliente}`],
  ['P05-Assistente', 'desk', '/portal_corretor/assistente'],
  ['P06-Imoveis', 'desk', a.imovel && `/portal_corretor/imoveis?item=${a.imovel}`],
  ['P07-Novo-imovel', 'desk', '/portal_corretor/imoveis/novo'],
  ['P08-Estudio', 'desk', '/portal_corretor/estudio'],
  ['P09-Pagina', 'desk', '/portal_corretor/pagina'],
  ['P10-Numeros', 'desk', '/portal_corretor/numeros'],
  ['P12-Conexoes', 'desk', '/portal_corretor/ajustes/conexoes'],
  ['P13-Conta', 'desk', '/portal_corretor/ajustes/conta'],
  ['P14-Importar', 'desk', '/portal_corretor/clientes/importar'],
  ['P15-Negociacoes', 'desk', '/portal_corretor/negociacoes'],
  ['P17-Negociador', 'desk', '/portal_corretor/ajustes/negociador'],
  ['M1-Hoje', 'cel', '/portal_corretor/'],
  ['M3-Novo-imovel', 'cel', '/portal_corretor/imoveis/novo'],
  ['M4-Portal', 'cel', a.portal],
  ['M5-Portal-imoveis', 'cel', a.portal, 'aba-imoveis'],
  ['M6-Pagina-publica', 'cel', a.pagina && `/portal_corretor/p?c=${a.pagina}`],
  ['M8-Aprovar-negociacao', 'cel', '/portal_corretor/negociacoes'],
];
const querTela = filtro ? new Set(filtro.split(',').map((s) => s.trim())) : null;
const resumo = [];
for (const [tela, modo, caminho, extra] of TELAS) {
  if (querTela && ![...querTela].some((q) => tela.startsWith(q))) continue;
  if (!caminho) { resumo.push(`${tela}: pulada (sem dado de apoio na conta)`); continue; }
  const vp = modo === 'desk' ? { width: 1440, height: 1000 } : { width: 390, height: 844 };
  const ctx = await contexto(vp);
  const page = await ctx.newPage();
  const erros = [];
  page.on('response', (r) => { if (r.url().includes('/api/') && r.status() >= 400) erros.push(`${r.status()} ${r.url().replace(inst.url, '').replace(/t=wh_[a-f0-9]+/, 't=<chave>').slice(0, 90)}`); });
  page.on('pageerror', (e) => erros.push('JS: ' + e.message.slice(0, 120)));
  try {
    await page.goto(caminho.startsWith('http') ? caminho : inst.url + caminho, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(2500);
    if (extra === 'aba-imoveis') {
      const aba = page.getByRole('tab', { name: /Im[óo]veis/ }).or(page.getByText(/^Im[óo]veis/)).first();
      if (await aba.count()) { await aba.click(); await page.waitForTimeout(1500); } else erros.push('aba Imóveis não encontrada');
    }
    // A área da app (v2): a moldura de colunas; sem ela (página pública, celular), a página inteira.
    const area = modo === 'desk' ? await page.evaluate(() => {
      const achar = (raiz) => {
        for (const el of raiz.querySelectorAll('*')) {
          if (el.localName === 'urbi-3-colunas' || el.localName === 'urbi-2x1') { const r = el.getBoundingClientRect(); return { x: r.x + scrollX, y: r.y + scrollY, w: r.width, h: Math.max(r.height, el.scrollHeight) }; }
          if (el.shadowRoot) { const r = achar(el.shadowRoot); if (r) return r; }
        }
        return null;
      };
      return achar(document);
    }) : null;
    if (area) await page.screenshot({ path: join(saida, `${tela}.png`), fullPage: true, clip: { x: Math.round(area.x), y: Math.round(area.y), width: Math.round(area.w), height: Math.round(area.h) } });
    else await page.screenshot({ path: join(saida, `${tela}.png`), fullPage: true });
    let nos = await page.evaluate(EXTRAIR);
    if (area) nos = nos.map((n) => ({ ...n, box: { ...n.box, x: n.box.x - Math.round(area.x), y: n.box.y - Math.round(area.y) } }));
    const altura = area ? Math.round(area.h) : await page.evaluate(() => document.documentElement.scrollHeight);
    writeFileSync(join(saida, `${tela}.app.json`), JSON.stringify({ tela, viewport: { largura: area ? Math.round(area.w) : vp.width, altura_conteudo: altura }, area, url: caminho.replace(inst.url, '').replace(/t=wh_[a-f0-9]+/, 't=<chave>'), nos }));
    resumo.push(`${tela}: ok (${nos.length} nós, altura ${altura})${erros.length ? ' | ' + erros.join('; ') : ''}`);
  } catch (e) { resumo.push(`${tela}: FALHOU ${e.message.slice(0, 160)}`); }
  await ctx.close();
}
await browser.close();
console.log(resumo.join('\n'));
