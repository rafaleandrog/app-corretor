import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ABAS_AJUSTES, abaDoEndereco } from '../comum/ajustes';
import { TELAS_APP, telaBase } from '../comum/assistente';
import { MENU, resolverEndereco } from '../frontend/enderecos';

const manifesto = JSON.parse(readFileSync(resolve(process.cwd(), 'manifesto.json'), 'utf8'));

test('menu do corretor com os nomes do Padrão B (D-103), sem o Assistente; Equipe da plataforma continua', () => {
  const nav = manifesto.nav as { titulo: string; rota?: string; icone?: string; itens?: { rota: string }[] }[];
  assert.deepEqual(
    nav.slice(0, 7).map((i) => [i.titulo, i.rota]),
    [
      ['Hoje', '/'],
      ['Clientes', '/clientes'],
      ['Imóveis', '/imoveis'],
      ['Estúdio', '/estudio'],
      ['Página', '/pagina'],
      ['Números', '/numeros'],
      ['Ajustes', '/ajustes'],
    ],
  );
  // O trilho da moldura usa o mesmo menu, com os mesmos ícones.
  assert.deepEqual(nav.slice(0, 7), MENU);
  assert.equal(nav.length, 8);
  assert.equal(nav[7].titulo, 'Equipe da plataforma');
  assert.deepEqual(nav[7].itens?.map((i) => i.rota), ['/corretores']);
});

test('Ajustes (B8): sete seções na ordem de 11.1, `?aba=` em /ajustes e Conta e marca quando não há seção', () => {
  assert.deepEqual(ABAS_AJUSTES.map((a) => a.id), ['mensageiro', 'negociador', 'conexoes', 'conta', 'funil', 'atendimento', 'privacidade']);
  assert.deepEqual(ABAS_AJUSTES.map((a) => a.label), ['Mensageiro', 'Negociador', 'Conexões', 'Conta e marca', 'Funil e abordagens', 'Horário de atendimento', 'Privacidade']);
  assert.ok(!ABAS_AJUSTES.some((a) => /plano|cr[eé]dito/i.test(a.label)), 'Plano e créditos não entra (D-87)');
  assert.equal(abaDoEndereco('/ajustes'), 'conta');
  assert.equal(abaDoEndereco('/ajustes', '?aba=conexoes'), 'conexoes');
  assert.equal(abaDoEndereco('/ajustes', '?aba=privacidade'), 'privacidade');
  // A Marca virou parte de Conta e marca: o `?aba=marca` de antes abre a seção nova.
  assert.equal(abaDoEndereco('/ajustes', '?aba=marca&x=1'), 'conta');
  assert.equal(abaDoEndereco('/ajustes', '?aba=inexistente'), 'conta');
  assert.equal(abaDoEndereco('/clientes', '?aba=marca'), null);
});

test('endereços antigos abrem Ajustes na seção certa; o retorno do Instagram segue em Conexões', () => {
  assert.equal(abaDoEndereco('/conta'), 'conta');
  assert.equal(abaDoEndereco('/ajustes/marca'), 'conta', 'o atalho "Sua marca" do Estúdio');
  assert.equal(abaDoEndereco('/ajustes/funil'), 'funil');
  assert.equal(abaDoEndereco('/ajustes/atendimento'), 'atendimento');
  assert.equal(abaDoEndereco('/ajustes/mensageiro'), 'mensageiro');
  assert.equal(abaDoEndereco('/ajustes/negociador'), 'negociador');
  // A Meta devolve em /ajustes/conexoes?code=&state= (URI cadastrada no app da Meta).
  assert.equal(abaDoEndereco('/ajustes/conexoes', '?code=abc&state=def'), 'conexoes');
  assert.equal(abaDoEndereco('/ajustes/conexoes', '?error=access_denied'), 'conexoes');
  assert.equal(abaDoEndereco('/ajustes/outra'), null);
  // Cada endereço de seção resolve para a tela Ajustes.
  for (const a of ABAS_AJUSTES) assert.equal(resolverEndereco(`/ajustes/${a.id}`).chave, 'ajustes', a.id);
  assert.equal(resolverEndereco('/ajustes/marca').chave, 'ajustes');
});

test('Assistente conhece Ajustes e as abas; cada `/ajustes/<aba>` é uma aba de verdade', () => {
  assert.equal(TELAS_APP['/conta'], undefined, 'o apelido não é sugerido');
  assert.equal(TELAS_APP['/ajustes'].nome, 'Ajustes');
  for (const sub of Object.keys(TELAS_APP).filter((s) => s.startsWith('/ajustes/'))) assert.notEqual(abaDoEndereco(sub), null, sub);
  for (const a of ABAS_AJUSTES) assert.ok(TELAS_APP[`/ajustes/${a.id}`], a.id);
  assert.equal(telaBase('/conta'), '/ajustes/conta');
});
