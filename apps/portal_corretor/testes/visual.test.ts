import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CANAIS, PAPEIS, TEMPERATURAS } from '../comum/crm';
import { abaDaUrl, aplicarFiltros, filtrosDaUrl, filtrosNaUrl, opcoesChip, ROTULO_ORIGEM, ROTULO_PAPEL, rotuloChip } from '../frontend/visual';

// Navegador mínimo: a URL da app é `/portal_corretor/<sub>` e o `replaceState` só troca o endereço.
function navegador(endereco: string) {
  const url = new URL(endereco, 'https://instancia.exemplo');
  const chamadas: { estado: unknown; url: string }[] = [];
  const g = globalThis as Record<string, unknown>;
  g.window = { location: url };
  g.history = {
    state: { shell: 1 },
    replaceState(estado: unknown, _t: string, nova: string) {
      chamadas.push({ estado, url: nova });
      const n = new URL(nova, url);
      url.pathname = n.pathname;
      url.search = n.search;
    },
  };
  g.urbiVerso = {
    subRota: () => url.pathname.replace(/^\/portal_corretor/, '') || '/',
    href: (sub: string) => `/portal_corretor${sub.startsWith('/') ? sub : `/${sub}`}`,
  };
  return { url, chamadas };
}

test('filtrosNaUrl: ida e volta pela URL, sem empilhar histórico e mantendo o estado do shell', () => {
  const { url, chamadas } = navegador('/portal_corretor/clientes?busca=ana&pagina=3');
  const filtros = filtrosDaUrl();
  assert.equal(filtros.get('busca'), 'ana');
  filtrosNaUrl(filtros, { temperatura: 'quente', busca: '' }, ['pagina']);
  assert.equal(`${url.pathname}${url.search}`, '/portal_corretor/clientes?temperatura=quente');
  assert.deepEqual(chamadas[0].estado, { shell: 1 });
  // A volta: quem abre o link lê os mesmos filtros.
  assert.equal(filtrosDaUrl().get('temperatura'), 'quente');
  assert.equal(filtrosDaUrl().get('busca'), null);
  filtrosNaUrl(filtros, { temperatura: null });
  assert.equal(`${url.pathname}${url.search}`, '/portal_corretor/clientes', 'sem filtro, sem "?"');
  filtrosNaUrl(new URLSearchParams(), { dias: 90 });
  assert.equal(url.search, '?dias=90');
});

test('aplicarFiltros: vazio, null e undefined tiram a chave; número vira texto', () => {
  const f = aplicarFiltros(new URLSearchParams('a=1&b=2&c=3&pagina=2'), { a: '', b: null, c: undefined, d: 7 }, ['pagina']);
  assert.equal(f.toString(), 'd=7');
});

test('abaDaUrl: lê ?aba=, cai na primeira fora da lista', () => {
  navegador('/portal_corretor/imoveis?aba=empreendimentos');
  assert.equal(abaDaUrl(['carteira', 'empreendimentos']), 'empreendimentos');
  navegador('/portal_corretor/imoveis?aba=outra');
  assert.equal(abaDaUrl(['carteira', 'empreendimentos']), 'carteira');
});

test('chip: um rótulo e uma cor por valor', () => {
  assert.deepEqual(rotuloChip('temperatura', 'frio'), { rotulo: 'Frio', cor: 'info' });
  assert.deepEqual(rotuloChip('temperatura', 'morno'), { rotulo: 'Morno', cor: 'alerta' });
  assert.deepEqual(rotuloChip('temperatura', 'quente'), { rotulo: 'Quente', cor: 'erro' });
  assert.deepEqual(rotuloChip('papel', 'proprietario'), { rotulo: 'Proprietário', cor: 'padrao' });
  assert.deepEqual(rotuloChip('origem', 'portal'), { rotulo: 'Portal imobiliário', cor: 'padrao' });
  assert.deepEqual(rotuloChip('etapa', { nome: 'Ganho', tipo: 'ganha' }), { rotulo: 'Ganho', cor: 'sucesso' });
  assert.deepEqual(rotuloChip('origem', 'desconhecida'), { rotulo: 'desconhecida', cor: 'padrao' }, 'valor novo sai cru');
  // Todo valor do catálogo tem rótulo, e as opções seguem a ordem dele.
  for (const p of PAPEIS) assert.ok(ROTULO_PAPEL[p], p);
  for (const c of CANAIS) assert.ok(ROTULO_ORIGEM[c], c);
  assert.deepEqual(opcoesChip('temperatura').map((o) => o.valor), [...TEMPERATURAS]);
  assert.deepEqual(opcoesChip('temperatura').map((o) => o.rotulo), ['Frio', 'Morno', 'Quente']);
});
