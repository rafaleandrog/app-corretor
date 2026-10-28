import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criar } from '../frontend/criar';
import { pedidoDeCriar } from '../frontend/visual';

// Menu Criar: o pedido `?criar=<tipo>` chega à tela de destino só pelo que o SDK documenta
// (`href()` + pushState + popstate), inclusive quando o destino é a sub-rota em que já se está.

/** Navegador mínimo: `pushState` troca a URL; `popstate` acorda quem escuta a rota. */
function navegador(endereco: string) {
  const url = new URL(endereco, 'https://instancia.exemplo');
  const ouvintes: (() => void)[] = [];
  const empilhou: string[] = [];
  const g = globalThis as Record<string, unknown>;
  g.PopStateEvent = class { constructor(public type: string) {} };
  g.window = {
    location: url,
    dispatchEvent: (e: { type: string }) => (e.type === 'popstate' && ouvintes.forEach((f) => f()), true),
  };
  const mudar = (nova: string) => {
    const n = new URL(nova, url);
    url.pathname = n.pathname;
    url.search = n.search;
  };
  g.history = {
    state: null,
    pushState: (_e: unknown, _t: string, nova: string) => (empilhou.push(nova), mudar(nova)),
    replaceState: (_e: unknown, _t: string, nova: string) => mudar(nova),
  };
  g.urbiVerso = {
    subRota: () => url.pathname.replace(/^\/portal_corretor/, '') || '/',
    href: (sub: string) => `/portal_corretor${sub.startsWith('/') ? sub : `/${sub}`}`,
    // O doc só garante a sub-rota (path): a query não é prometida.
    navegarSub: (sub: string) => (empilhou.push(`/portal_corretor${sub.split('?')[0]}`), mudar(`/portal_corretor${sub.split('?')[0]}`), ouvintes.forEach((f) => f())),
    escutarRota: (cb: (s: string) => void) => (ouvintes.push(() => cb((g.urbiVerso as any).subRota())), () => {}),
  };
  return { url, empilhou };
}

test('Criar leva ?criar=<tipo> ao destino, acorda o escutarRota e a tela lê o pedido', () => {
  for (const [opcao, rota, tipo] of [['cliente', '/clientes', 'cliente'], ['imovel', '/imoveis', 'imovel'], ['post', '/estudio', 'post']] as const) {
    const { url, empilhou } = navegador('/portal_corretor/hoje');
    const subs: string[] = [];
    (globalThis as any).urbiVerso.escutarRota((s: string) => subs.push(s));
    criar(opcao);
    assert.deepEqual(empilhou, [`/portal_corretor${rota}?criar=${tipo}`]);
    assert.deepEqual(subs, [rota]);
    assert.equal(pedidoDeCriar('outro'), false);
    assert.equal(pedidoDeCriar(tipo), true);
    assert.equal(url.search, '', 'o pedido é consumido da URL');
    assert.equal(pedidoDeCriar(tipo), false);
  }
});

test('Criar a partir da própria tela de destino ainda acorda a rota e entrega o pedido', () => {
  const { url } = navegador('/portal_corretor/clientes');
  let acordou = 0;
  (globalThis as any).urbiVerso.escutarRota(() => acordou++);
  criar('cliente');
  assert.equal(acordou, 1);
  assert.equal(url.pathname, '/portal_corretor/clientes');
  assert.equal(pedidoDeCriar('cliente'), true);
});
