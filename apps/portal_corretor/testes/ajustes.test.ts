import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ABAS_AJUSTES, ABAS_AJUSTES_IDS, OPCOES_ABA_AJUSTES } from '../comum/ajustes';
import { TELAS_APP, telaBase } from '../comum/assistente';
import { MENU, resolverEndereco } from '../frontend/enderecos';
import { abaDaUrl, abaNaUrl } from '../frontend/visual';

// Navegador mínimo: a URL da app é `/portal_corretor/<sub>` e o `replaceState` só troca o endereço.
function navegador(endereco: string) {
  const url = new URL(endereco, 'https://instancia.exemplo');
  const g = globalThis as Record<string, unknown>;
  g.window = { location: url };
  g.history = {
    state: null,
    replaceState(_e: unknown, _t: string, nova: string) {
      const n = new URL(nova, url);
      url.pathname = n.pathname;
      url.search = n.search;
    },
  };
  g.urbiVerso = {
    subRota: () => url.pathname.replace(/^\/portal_corretor/, '') || '/',
    href: (sub: string) => `/portal_corretor${sub.startsWith('/') ? sub : `/${sub}`}`,
  };
  return url;
}
// Seção que o endereço abre, pelo mesmo helper de aba da URL das outras telas.
const abaDoEndereco = (endereco: string): string | null => {
  navegador(`/portal_corretor${endereco}`);
  return abaDaUrl(ABAS_AJUSTES_IDS, OPCOES_ABA_AJUSTES);
};

test('menu do corretor com os nomes do Padrão B (D-103), com Conversas (D-116); o `nav` em menu.test.ts', () => {
  assert.deepEqual(
    MENU.map((i) => [i.titulo, i.rota]),
    [
      ['Hoje', '/'],
      ['Conversas', '/conversas'],
      ['Clientes', '/clientes'],
      ['Imóveis', '/imoveis'],
      ['Estúdio', '/estudio'],
      ['Página', '/pagina'],
      ['Números', '/numeros'],
      ['Ajustes', '/ajustes'],
    ],
  );
});

test('Ajustes (B8): sete seções na ordem de 11.1, `?aba=` em /ajustes e Conta e marca quando não há seção', () => {
  assert.deepEqual(ABAS_AJUSTES.map((a) => a.id), ['mensageiro', 'negociador', 'conexoes', 'conta', 'funil', 'atendimento', 'privacidade']);
  assert.deepEqual(ABAS_AJUSTES.map((a) => a.label), ['Mensageiro', 'Negociador', 'Conexões', 'Conta e marca', 'Funil e abordagens', 'Horário de atendimento', 'Privacidade']);
  assert.ok(!ABAS_AJUSTES.some((a) => /plano|cr[eé]dito/i.test(a.label)), 'Plano e créditos não entra (D-87)');
  assert.equal(abaDoEndereco('/ajustes'), 'conta');
  assert.equal(abaDoEndereco('/ajustes?aba=conexoes'), 'conexoes');
  assert.equal(abaDoEndereco('/ajustes?aba=privacidade'), 'privacidade');
  // A Marca virou parte de Conta e marca: o `?aba=marca` de antes abre a seção nova.
  assert.equal(abaDoEndereco('/ajustes?aba=marca&x=1'), 'conta');
  assert.equal(abaDoEndereco('/ajustes?aba=inexistente'), 'conta');
});

test('endereços antigos abrem Ajustes na seção certa; o retorno do Instagram segue em Conexões', () => {
  assert.equal(abaDoEndereco('/conta'), 'conta');
  assert.equal(abaDoEndereco('/ajustes/marca'), 'conta', 'o atalho "Sua marca" do Estúdio');
  assert.equal(abaDoEndereco('/ajustes/funil'), 'funil');
  assert.equal(abaDoEndereco('/ajustes/atendimento'), 'atendimento');
  assert.equal(abaDoEndereco('/ajustes/mensageiro'), 'mensageiro');
  assert.equal(abaDoEndereco('/ajustes/negociador'), 'negociador');
  // A Meta devolve em /ajustes/conexoes?code=&state= (URI cadastrada no app da Meta).
  assert.equal(abaDoEndereco('/ajustes/conexoes?code=abc&state=def'), 'conexoes');
  assert.equal(abaDoEndereco('/ajustes/conexoes?error=access_denied'), 'conexoes');
  // Barra final: o mock de `subRota` não a remove (o SDK não promete), então quem trata é `abaDaUrl`.
  assert.equal(abaDoEndereco('/conta/'), 'conta');
  assert.equal(abaDoEndereco('/ajustes/conexoes/'), 'conexoes');
  assert.equal(abaDoEndereco('/ajustes/conexoes/?code=abc'), 'conexoes');
  assert.equal(abaDoEndereco('/ajustes/outra'), 'conta', 'desconhecido cai em Conta e marca');
  // Cada endereço de seção resolve para a tela Ajustes.
  for (const a of ABAS_AJUSTES) assert.equal(resolverEndereco(`/ajustes/${a.id}`).chave, 'ajustes', a.id);
  assert.equal(resolverEndereco('/ajustes/marca').chave, 'ajustes');
});

test('Assistente conhece Ajustes e as abas; cada `/ajustes/<aba>` é uma aba de verdade', () => {
  assert.equal(TELAS_APP['/conta'], undefined, 'o apelido não é sugerido');
  assert.equal(TELAS_APP['/ajustes'].nome, 'Ajustes');
  for (const sub of Object.keys(TELAS_APP).filter((s) => s.startsWith('/ajustes/'))) assert.equal(abaDoEndereco(sub), sub === '/ajustes/marca' ? 'conta' : sub.slice('/ajustes/'.length), sub);
  for (const a of ABAS_AJUSTES) assert.ok(TELAS_APP[`/ajustes/${a.id}`], a.id);
  assert.equal(telaBase('/conta'), '/ajustes/conta');
});

test('abaNaUrl em Ajustes grava sobre /ajustes, também a partir de um apelido (sem /ajustes/conexoes?aba=marca)', () => {
  let url = navegador('/portal_corretor/conta');
  abaNaUrl('privacidade', OPCOES_ABA_AJUSTES);
  assert.equal(`${url.pathname}${url.search}`, '/portal_corretor/ajustes?aba=privacidade');
  assert.equal(abaDaUrl(ABAS_AJUSTES_IDS, OPCOES_ABA_AJUSTES), 'privacidade');
  url = navegador('/portal_corretor/ajustes/conexoes');
  abaNaUrl('marca', OPCOES_ABA_AJUSTES);
  assert.equal(`${url.pathname}${url.search}`, '/portal_corretor/ajustes?aba=marca');
  assert.equal(abaDaUrl(ABAS_AJUSTES_IDS, OPCOES_ABA_AJUSTES), 'conta');
  url = navegador('/portal_corretor/ajustes?aba=funil');
  abaNaUrl('atendimento', OPCOES_ABA_AJUSTES);
  assert.equal(`${url.pathname}${url.search}`, '/portal_corretor/ajustes?aba=atendimento');
});
