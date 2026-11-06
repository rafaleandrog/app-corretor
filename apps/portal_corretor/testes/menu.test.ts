import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MENU, MENU_NEGOCIADOR, resolverEndereco, type ChaveTela } from '../frontend/enderecos';
import { itensDoTrilho, moldura } from '../frontend/moldura';
import { irPara } from '../frontend/atalhos';

// Menu do app no cabeçalho do shell (D-113, #166): o `nav` do manifesto não repete as sete telas do
// trilho. Cada uma continua abrindo pelo trilho, pelo endereço direto e (as que têm registro) pela
// busca; a equipe da plataforma continua chegando a Corretores, que só tem o menu como caminho.

const manifesto = JSON.parse(readFileSync(resolve(process.cwd(), 'manifesto.json'), 'utf8'));

const SETE: [string, string, ChaveTela][] = [
  ['Hoje', '/', 'hoje'],
  ['Clientes', '/clientes', 'clientes'],
  ['Imóveis', '/imoveis', 'imoveis'],
  ['Estúdio', '/estudio', 'estudio'],
  ['Página', '/pagina', 'pagina'],
  ['Números', '/numeros', 'numeros'],
  ['Ajustes', '/ajustes', 'ajustes'],
];

/** Rotas de toda folha do `nav`, com as dos grupos. */
function rotasDoNav(itens: { rota?: string; itens?: { rota?: string }[] }[]): string[] {
  return itens.flatMap((i) => [...(i.rota ? [i.rota] : []), ...rotasDoNav(i.itens ?? [])]);
}

// Navegador mínimo: a URL da app é `/portal_corretor/<sub>`; `navegarSub` e `pushState` mudam o endereço.
function navegador(roles: string[] = ['corretor']) {
  const url = new URL('/portal_corretor/', 'https://instancia.exemplo');
  const g = globalThis as Record<string, unknown>;
  const ir = (nova: string) => {
    const n = new URL(nova, url);
    url.pathname = n.pathname;
    url.search = n.search;
  };
  g.window = { location: url, dispatchEvent: () => true };
  g.PopStateEvent = class {
    constructor(public type: string) {}
  };
  g.history = { state: null, pushState: (_e: unknown, _t: string, nova: string) => ir(nova), replaceState: (_e: unknown, _t: string, nova: string) => ir(nova) };
  g.localStorage = undefined;
  g.urbiVerso = {
    subRota: () => url.pathname.replace(/^\/portal_corretor/, '') || '/',
    href: (sub: string) => `/portal_corretor${sub.startsWith('/') ? sub : `/${sub}`}`,
    navegarSub: (sub: string) => ir(`/portal_corretor${sub}`),
    usuario: () => ({ id: 1, nome: 'Marina' }),
    contexto: () => ({ contaEscrita: 100, roles, nivel: 'escrita' }),
    api: async () => ({}),
  };
  const sub = () => (g.urbiVerso as { subRota: () => string }).subRota();
  return { url, sub };
}

/** O handler de `@urbi:atalho-click` do trilho, achado dentro do template da moldura. */
function cliqueDoTrilho(v: unknown): ((e: CustomEvent) => void) | undefined {
  const t = v as { strings?: readonly string[]; values?: unknown[] };
  if (Array.isArray(v)) return v.map(cliqueDoTrilho).find(Boolean);
  if (!t || !t.strings || !t.values) return undefined;
  for (let i = 0; i < t.values.length; i++) {
    if (/@urbi:atalho-click=$/.test(t.strings[i]) && typeof t.values[i] === 'function') return t.values[i] as (e: CustomEvent) => void;
    const dentro = cliqueDoTrilho(t.values[i]);
    if (dentro) return dentro;
  }
  return undefined;
}

test('menu do app (nav): nenhuma das sete telas do trilho; só Equipe da plataforma › Corretores', () => {
  const rotas = rotasDoNav(manifesto.nav);
  for (const [, rota] of SETE) assert.ok(!rotas.includes(rota), `${rota} fora do menu do app`);
  assert.deepEqual(rotas, ['/corretores']);
  // O trilho do corretor é o menu das sete, e o do negociador humano também fica fora do `nav`.
  assert.deepEqual(MENU.map((m) => m.rota), SETE.map(([, r]) => r));
  for (const m of MENU_NEGOCIADOR) assert.ok(!rotas.includes(m.rota));
});

test('cada tela do trilho abre por endereço direto', () => {
  for (const [, rota, chave] of SETE) assert.equal(resolverEndereco(rota).chave, chave, rota);
  // Com barra no fim também (link colado à mão).
  for (const [, rota, chave] of SETE.slice(1)) assert.equal(resolverEndereco(`${rota}/`).chave, chave, `${rota}/`);
});

test('cada tela do trilho abre pelo clique no trilho, de qualquer tela', () => {
  const { sub } = navegador();
  for (const [titulo, rota, chave] of SETE) {
    // Começa de uma tela diferente da de destino.
    const de = rota === '/numeros' ? '/clientes' : '/numeros';
    const itens = itensDoTrilho(de);
    const item = itens.find((i) => i.rotulo === titulo);
    assert.ok(item, `${titulo} está no trilho`);
    assert.equal(item.id, rota);
    const clique = cliqueDoTrilho(moldura({ menu: de, centro: 'x' }, () => {}));
    assert.ok(clique, 'o trilho tem o handler de clique');
    clique({ detail: { id: item.id } } as CustomEvent);
    assert.equal(sub(), rota, `${titulo}: o clique leva a ${rota}`);
    assert.equal(resolverEndereco(sub()).chave, chave, `${titulo}: ${rota} abre a tela`);
  }
});

// A busca leva a registros, não a telas: cada resultado abre na tela dele. O diálogo (`abrirBusca`) é do
// formulário do SDK; aqui vale o destino que ele chama, `irPara` (o diálogo aberto pela tecla `/` está em
// troca-de-conta-quadro-chromium.test.ts).
test('destino da busca: o cliente abre em Clientes, o imóvel em Imóveis e a negociação em Clientes › Negociações', () => {
  const { url, sub } = navegador();
  irPara({ tipo: 'cliente', id: 7 });
  assert.equal(resolverEndereco(sub()).chave, 'clientes');
  assert.equal(url.search, '?item=7');
  irPara({ tipo: 'imovel', id: 9 });
  assert.deepEqual(resolverEndereco(sub()), { chave: 'imovel', param: '9' });
  irPara({ tipo: 'negociacao', id: 3 });
  assert.equal(resolverEndereco(sub()).chave, 'clientes');
  assert.equal(url.search, '?visao=negociacoes&item=3');
});

test('a equipe da plataforma continua chegando a Corretores pelo menu do app', () => {
  const grupo = manifesto.nav.find((n: { titulo: string }) => n.titulo === 'Equipe da plataforma');
  assert.ok(grupo, 'grupo Equipe da plataforma no menu');
  assert.deepEqual(grupo.itens, [{ titulo: 'Corretores', rota: '/corretores' }]);
  assert.equal(resolverEndereco('/corretores').chave, 'corretores');
  // Corretores não está em nenhum trilho (nem é tela da moldura): para quem tem corretor e operacao,
  // a raiz abre Hoje (index.ts) e o menu do app é o único caminho até ela. Por isso ela fica no `nav`.
  assert.ok(![...MENU, ...MENU_NEGOCIADOR].some((m) => m.rota === '/corretores'));
});
