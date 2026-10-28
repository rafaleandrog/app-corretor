import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ABAS_AJUSTES, abaDoEndereco } from '../comum/ajustes';
import { TELAS_APP, telaBase } from '../comum/assistente';
import { MENU } from '../frontend/enderecos';

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

test('Ajustes: cinco abas na ordem, `?aba=` em /ajustes e Conta quando não há aba', () => {
  assert.deepEqual(ABAS_AJUSTES.map((a) => a.id), ['conta', 'marca', 'conexoes', 'funil', 'atendimento']);
  assert.equal(abaDoEndereco('/ajustes'), 'conta');
  assert.equal(abaDoEndereco('/ajustes', '?aba=conexoes'), 'conexoes');
  assert.equal(abaDoEndereco('/ajustes', '?aba=marca&x=1'), 'marca');
  assert.equal(abaDoEndereco('/ajustes', '?aba=inexistente'), 'conta');
  assert.equal(abaDoEndereco('/clientes', '?aba=marca'), null);
});

test('endereços antigos abrem Ajustes na aba certa; o retorno do Instagram segue em Conexões', () => {
  assert.equal(abaDoEndereco('/conta'), 'conta');
  assert.equal(abaDoEndereco('/ajustes/funil'), 'funil');
  assert.equal(abaDoEndereco('/ajustes/atendimento'), 'atendimento');
  // A Meta devolve em /ajustes/conexoes?code=&state= (URI cadastrada no app da Meta).
  assert.equal(abaDoEndereco('/ajustes/conexoes', '?code=abc&state=def'), 'conexoes');
  assert.equal(abaDoEndereco('/ajustes/conexoes', '?error=access_denied'), 'conexoes');
  assert.equal(abaDoEndereco('/ajustes/outra'), null);
});

test('Assistente conhece Ajustes e as abas; cada `/ajustes/<aba>` é uma aba de verdade', () => {
  assert.equal(TELAS_APP['/conta'], undefined, 'o apelido não é sugerido');
  assert.equal(TELAS_APP['/ajustes'].nome, 'Ajustes');
  for (const sub of Object.keys(TELAS_APP).filter((s) => s.startsWith('/ajustes/'))) assert.notEqual(abaDoEndereco(sub), null, sub);
  for (const a of ABAS_AJUSTES) assert.ok(TELAS_APP[`/ajustes/${a.id}`], a.id);
  assert.equal(telaBase('/conta'), '/ajustes/conta');
});
