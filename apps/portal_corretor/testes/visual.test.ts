import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nothing } from 'lit';
import { CANAIS, PAPEIS, TEMPERATURAS } from '../comum/crm';
import { abaDaUrl, abaNaUrl, aplicarFiltros, filtrosDaUrl, filtrosNaUrl, chip, opcoesChip, ROTULO_ORIGEM, ROTULO_PAPEL, rotuloChip } from '../frontend/visual';

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

test('abaDaUrl/abaNaUrl: outra chave, apelido de caminho e gravação na rota canônica', () => {
  const opcoes = { chave: 'visao', apelidos: { '/funil': 'quadro' }, rota: '/clientes' };
  navegador('/portal_corretor/clientes');
  assert.equal(abaDaUrl(['lista', 'quadro'], opcoes), 'lista');
  navegador('/portal_corretor/clientes?visao=quadro');
  assert.equal(abaDaUrl(['lista', 'quadro'], opcoes), 'quadro');
  const { url } = navegador('/portal_corretor/funil/?temperatura=quente');
  assert.equal(abaDaUrl(['lista', 'quadro'], opcoes), 'quadro', 'o apelido abre o quadro');
  // Trocar de visão num apelido leva a barra para a rota canônica e mantém os filtros.
  abaNaUrl('', opcoes);
  assert.equal(`${url.pathname}${url.search}`, '/portal_corretor/clientes?temperatura=quente');
  assert.equal(abaDaUrl(['lista', 'quadro'], opcoes), 'lista');
  abaNaUrl('quadro', opcoes);
  assert.equal(url.search, '?temperatura=quente&visao=quadro');
  // Sem opções, o comportamento de antes: `?aba=` na sub-rota atual.
  navegador('/portal_corretor/imoveis');
  abaNaUrl('empreendimentos');
  assert.equal(abaDaUrl(['carteira', 'empreendimentos']), 'empreendimentos');
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

test('chip: etapa aberta/perdida, sem valor, title do motivo e quebra-linha só no texto livre', () => {
  assert.equal(rotuloChip('etapa', { nome: 'Em contato', tipo: 'aberta' }).cor, 'info');
  assert.equal(rotuloChip('etapa', { nome: 'Perdido', tipo: 'perdida' }).cor, 'padrao');
  // Sem valor, nada (o `nothing` do lit).
  for (const v of [null, undefined, '']) assert.equal(chip('temperatura', v), nothing);
  // O TemplateResult expõe os valores na ordem dos atributos: cor, title, ?quebra-linha, rótulo.
  const val = (r: unknown) => (r as { values: unknown[] }).values;
  assert.deepEqual(val(chip('temperatura', 'quente', 'motivo X')), ['erro', 'motivo X', false, 'Quente']);
  assert.equal(val(chip('temperatura', 'quente'))[1], nothing);
  assert.equal(val(chip('temperatura', 'quente', null))[1], nothing);
  // Rótulo do catálogo não quebra; nome de etapa (dado do corretor) e valor desconhecido, sim.
  assert.equal(val(chip('temperatura', 'frio'))[2], false);
  assert.equal(val(chip('papel', 'comprador'))[2], false);
  assert.equal(val(chip('etapa', { nome: 'Visita marcada', tipo: 'aberta' }))[2], true);
  assert.equal(val(chip('origem', 'canal_novo'))[2], true);
});
