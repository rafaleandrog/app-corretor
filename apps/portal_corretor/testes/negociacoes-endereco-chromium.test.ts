import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

// P15 (D-96): para o corretor, `/negociacoes` é apelido de Clientes › Negociações
// (`/clientes?visao=negociacoes&item=<id>`), com o título "Clientes", "Nova proposta" na linha do título
// e o alternador Funil · Lista · Negociações. O negociador humano (D-125) continua em `/negociacoes`.

function playwright(): any {
  try {
    return createRequire(import.meta.url)('playwright');
  } catch {
    return null;
  }
}

const ORIGEM = 'https://app.exemplo';

const ENTRADA = `
let aoMudarRota = null;
window.urbiVerso = {
  subRota: () => location.pathname.replace(/^\\/portal_corretor/, '') || '/',
  href: (s) => '/portal_corretor' + s,
  escutarRota: (cb) => ((aoMudarRota = cb), () => (aoMudarRota = null)),
  navegarSub: (s) => { history.pushState(null, '', '/portal_corretor' + s); aoMudarRota?.(s.split('?')[0]); },
  usuario: () => ({ id: 1, nome: 'Marina' }),
  contexto: () => ({ carregado: window.CARREGADO ?? true, nivel: window.NIVEL ?? 'usuario', roles: window.ROLES, conta: { resolucao: 'escopado', contas: [{ id: 100, nome: 'Conta 100' }], contaEscrita: 100 } }),
  notificar: () => {},
  alertar: async () => {},
  confirmar: async () => true,
  formulario: async () => null,
  api: async (rota) => (rota.split('?')[0] === '/negociacoes' ? { dados: [{ id: 1, contato_nome: 'Ana', imovel_titulo: 'Casa', estado: 'ativa', conduzida_por: 'ia', ultima_oferta_c: 1, preco_pedido_c: 2 }], total: 1 } : { dados: [], total: 0 }),
  fetch: async () => new Response('{}'),
};
import './frontend/index';
const app = document.createElement('app-portal-corretor');
document.getElementById('raiz').append(app);
window.app = app;
window.achar = (sel, n = app.shadowRoot) => n.querySelector(sel) ?? [...n.querySelectorAll('*')].map((e) => e.shadowRoot && window.achar(sel, e.shadowRoot)).find(Boolean) ?? null;
window.textos = () => {
  const partes = [];
  const andar = (n) => {
    if (n.nodeType === 3) partes.push(n.textContent.trim());
    if (n.shadowRoot) andar(n.shadowRoot);
    for (const f of n.childNodes) andar(f);
  };
  andar(app);
  return partes.filter(Boolean);
};
`;

async function abrir(pw: any, endereco: string, roles: string[], nivel = 'usuario', depois?: string[]) {
  const pacote = await build({
    stdin: { contents: ENTRADA, resolveDir: process.cwd(), loader: 'ts' },
    bundle: true,
    write: false,
    format: 'iife',
    target: 'es2022',
    tsconfig: 'tsconfig.json',
    logLevel: 'silent',
  });
  const html = `<!doctype html><html><head><meta charset="utf-8"></head><body><div id="raiz"></div><script>${pacote.outputFiles[0].text}</script></body></html>`;
  const navegador = await pw.chromium.launch();
  const pagina = await navegador.newPage({ viewport: { width: 1440, height: 900 } });
  await pagina.route(`${ORIGEM}/**`, (r: any) => r.fulfill({ contentType: 'text/html', body: html }));
  await pagina.addInitScript(([r, n, tardio]: [string[], string, boolean]) => {
    (window as any).ROLES = r;
    (window as any).NIVEL = n;
    (window as any).CARREGADO = !tardio;
  }, [roles, nivel, !!depois]);
  await pagina.goto(`${ORIGEM}/portal_corretor${endereco}`);
  await pagina.waitForTimeout(300);
  if (depois) {
    // Carregamento tardio, como o SDK: o contexto chega depois com os papéis reais.
    await pagina.evaluate((r: string[]) => {
      const w = window as any;
      w.ROLES = r;
      w.CARREGADO = true;
      window.dispatchEvent(new CustomEvent('urbi:contexto-app', { detail: { ...w.urbiVerso.contexto(), appId: 'portal_corretor' } }));
    }, depois);
    await pagina.waitForTimeout(300);
  }
  const estado = await pagina.evaluate(() => ({
    caminho: location.pathname + location.search,
    textos: (window as any).textos() as string[],
    alternador: (() => {
      // O alternador de visões é o chips-atalho com a opção `funil` (a lista de negociações tem chips próprios).
      const w = window as any;
      const todos = (n: any): any[] => [...n.querySelectorAll('*')].flatMap((e: any) => [e, ...(e.shadowRoot ? todos(e.shadowRoot) : [])]);
      return todos(w.app.shadowRoot).some((e: any) => e.localName === 'urbi-chips-atalho' && (e.opcoes ?? []).some((o: any) => o.id === 'funil'));
    })(),
  }));
  await navegador.close();
  return estado;
}

for (const [nome, roles, nivel] of [
  ['corretor', ['corretor'], 'usuario'],
  ['corretor e negociador', ['corretor', 'negociador'], 'usuario'],
  ['admin', ['negociador'], 'admin'],
] as const) {
  test(`P15 (${nome}): /negociacoes?item=1 termina em Clientes › Negociações com título Clientes e alternador`, async (t) => {
    const pw = playwright();
    if (!pw) return t.skip('Playwright não instalado neste ambiente');
    const e = await abrir(pw, '/negociacoes?item=1', [...roles], nivel);
    assert.equal(e.caminho, '/portal_corretor/clientes?visao=negociacoes&item=1');
    assert.ok(e.textos.includes('Clientes'), 'título Clientes');
    assert.ok(e.textos.includes('Nova proposta'), 'Nova proposta na linha do título');
    assert.ok(!e.textos.includes('Importar') && !e.textos.includes('Novo'), 'sem Importar nem Novo na visão Negociações');
    assert.equal(e.alternador, true, 'alternador Funil · Lista · Negociações');
  });
}

test('P15: o negociador humano (só o papel negociador) continua em /negociacoes, sem alternador nem Nova proposta', async (t) => {
  const pw = playwright();
  if (!pw) return t.skip('Playwright não instalado neste ambiente');
  const e = await abrir(pw, '/negociacoes?item=1', ['negociador']);
  assert.equal(e.caminho, '/portal_corretor/negociacoes?item=1');
  assert.ok(e.textos.includes('Negociações atribuídas a você'));
  assert.ok(!e.textos.includes('Nova proposta'));
  assert.equal(e.alternador, false);
});

test('P15, contexto tardio (carregado:false, roles:[]): o negociador humano termina em /negociacoes e o corretor em Clientes', async (t) => {
  const pw = playwright();
  if (!pw) return t.skip('Playwright não instalado neste ambiente');
  const neg = await abrir(pw, '/negociacoes?item=1', [], 'usuario', ['negociador']);
  assert.equal(neg.caminho, '/portal_corretor/negociacoes?item=1');
  assert.ok(neg.textos.includes('Negociações atribuídas a você'));
  assert.equal(neg.alternador, false);
  const cor = await abrir(pw, '/negociacoes?item=1', [], 'usuario', ['corretor']);
  assert.equal(cor.caminho, '/portal_corretor/clientes?visao=negociacoes&item=1');
  assert.ok(cor.textos.includes('Nova proposta'));
  assert.equal(cor.alternador, true);
});
