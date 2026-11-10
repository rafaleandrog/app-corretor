import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { destinoDoNegociador, negociacoesCanonica, MENU, MENU_NEGOCIADOR, resolverEndereco, type ChaveTela } from '../frontend/enderecos';
import { irPara } from '../frontend/atalhos';

// Menu do app pelo shell (D-114, que revê D-113 e o #166): o `nav` do manifesto traz as telas do
// corretor na ordem de 11.0.1, mais Equipe da plataforma › Corretores; a app não desenha trilho. Cada
// tela abre pelo endereço direto, e os registros pela busca.

const manifesto = JSON.parse(readFileSync(resolve(process.cwd(), 'manifesto.json'), 'utf8'));

const OITO: [string, string, ChaveTela][] = [
  ['Hoje', '/', 'hoje'],
  ['Conversas', '/conversas', 'conversas'],
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

test('menu do app (nav, D-114): as oito telas do corretor na ordem de 11.0.1 e Equipe da plataforma › Corretores', () => {
  const folhas = manifesto.nav.filter((n: { rota?: string }) => n.rota).map((n: { titulo: string; rota: string }) => [n.titulo, n.rota]);
  assert.deepEqual(folhas, OITO.map(([t, r]) => [t, r]));
  assert.deepEqual(rotasDoNav(manifesto.nav), [...OITO.map(([, r]) => r), '/corretores']);
  // O `MENU` da app (busca, Criar, celular) é o mesmo do `nav`; o negociador humano vê só Hoje e Negociações.
  assert.deepEqual(MENU.map((m) => [m.titulo, m.rota]), OITO.map(([t, r]) => [t, r]));
  assert.deepEqual(MENU_NEGOCIADOR.map((m) => m.rota), ['/negociacoes']);
  // D-125: qualquer outra rota leva às Negociações; a notificação leva à mesma negociação.
  assert.equal(destinoDoNegociador('/negociacoes', '?item=3'), null);
  assert.equal(destinoDoNegociador('/', ''), '/negociacoes');
  assert.equal(destinoDoNegociador('/imoveis', '?item=9'), '/negociacoes');
  assert.equal(destinoDoNegociador('/clientes', '?visao=negociacoes&item=47'), '/negociacoes?item=47');
  assert.equal(destinoDoNegociador('/clientes', '?item=47'), '/negociacoes');
  assert.equal(destinoDoNegociador('/assistente', ''), '/negociacoes');
  // Nenhum item do nav aponta para uma tela que não existe.
  for (const rota of rotasDoNav(manifesto.nav)) assert.ok(resolverEndereco(rota).chave, `${rota} abre uma tela`);
});

test('cada tela do menu abre por endereço direto', () => {
  for (const [, rota, chave] of OITO) assert.equal(resolverEndereco(rota).chave, chave, rota);
  // Com barra no fim também (link colado à mão).
  for (const [, rota, chave] of OITO.slice(1)) assert.equal(resolverEndereco(`${rota}/`).chave, chave, `${rota}/`);
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
  assert.ok(![...MENU, ...MENU_NEGOCIADOR].some((m) => m.rota === '/corretores'));
});

test('P15 (D-96): /negociacoes do corretor vira Clientes › Negociações, com o item válido; outros caminhos ficam', () => {
  assert.equal(negociacoesCanonica('/negociacoes', ''), '?visao=negociacoes');
  assert.equal(negociacoesCanonica('/negociacoes', '?item=5'), '?visao=negociacoes&item=5');
  assert.equal(negociacoesCanonica('/negociacoes', '?item=abc'), '?visao=negociacoes');
  assert.equal(negociacoesCanonica('/negociacoes', '?item=0'), '?visao=negociacoes');
  assert.equal(negociacoesCanonica('/clientes', '?visao=negociacoes'), null);
  assert.equal(negociacoesCanonica('/negociacoes/9', ''), null);
});
