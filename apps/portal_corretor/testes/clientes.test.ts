import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { rotas } from '../backend/rotas';
import { chipsDoPerfilBusca } from '../comum/crm';
import { contatoDoEndereco, contatoDoItem, fichaCanonica, resolverEndereco } from '../frontend/enderecos';
import { BancoFalso, comServidor, type Ator } from './apoio';

// Clientes no Padrão B (B3, issue #92): a ficha mora na Lista (`/clientes?item=<id>`), o caminho antigo
// `/clientes/<id>` é apelido, o perfil de busca vira chips, e o corretor B não abre a ficha de A pela URL.
// A tela no DOM de verdade está em `clientes-chromium.test.ts`.

const UNICOS = { contatos: ['telefone'], etapas_funil: ['pipeline+nome'], playbook_funil: ['etapa_id+temperatura'], visitas: ['atividade_id'] };
const A: Ator = { usuario: 1, conta: 100, papeis: ['corretor'] };
const B: Ator = { usuario: 2, conta: 200, papeis: ['corretor'] };
const raiz = (f: string) => readFileSync(resolve(process.cwd(), f), 'utf8');

test('a ficha é o item da Lista: /clientes/:id vira /clientes?item=:id, mantendo o resto da query', () => {
  assert.equal(fichaCanonica('/clientes/7'), '?item=7');
  assert.equal(fichaCanonica('/clientes/7/', '?sugerir=1'), '?sugerir=1&item=7', 'o "Fazer agora" de Hoje e do Funil chega à ficha');
  assert.equal(fichaCanonica('/clientes/7', '?visao=quadro&busca=ana'), '?busca=ana&item=7', 'a ficha mora na Lista');
  assert.equal(fichaCanonica('/clientes'), null);
  assert.equal(fichaCanonica('/clientes/importar'), null);
  assert.equal(fichaCanonica('/imoveis/7'), null);
  // O apelido continua resolvendo para Clientes (fallback, caso a troca de endereço não tenha rodado).
  assert.equal(resolverEndereco('/clientes').chave, 'clientes');
  assert.equal(resolverEndereco('/clientes/12').chave, 'cliente');
  // O contato em foco (Assistente, Criar) vem do `?item=` da Lista ou do caminho antigo.
  assert.equal(contatoDoEndereco('/clientes', '?item=7&secao=negocios'), 7);
  assert.equal(contatoDoEndereco('/clientes', '?item=abc'), null);
  assert.equal(contatoDoEndereco('/clientes'), null);
  assert.equal(contatoDoEndereco('/imoveis', '?item=7'), null, 'o item de outra tela não é contato');
  assert.equal(contatoDoEndereco('/clientes/9'), 9);
});

test('Clientes entra na moldura do Padrão B e o app troca o endereço antigo ao chegar', () => {
  const indice = raiz('frontend/index.ts');
  assert.match(indice, /clientes: \{ titulo: 'Clientes', papel: 'corretor', moldura: true/);
  assert.match(indice, /fichaCanonica\(sub, window\.location\.search\)/);
  const tela = raiz('frontend/telas/clientes.ts');
  assert.match(tela, /moldura\(\s*\{ menu: '\/clientes', lista, centro, contexto/);
  // A ficha nas abas da P04; a Negociação entra com o D3.
  assert.match(raiz('frontend/telas/ficha-contato.ts'), /\{ id: 'resumo', label: 'Resumo' \},\s*\{ id: 'linha', label: 'Linha do tempo' \},\s*\{ id: 'enviados', label: 'Enviados' \},\s*\{ id: 'negocios', label: 'Negócios' \},/);
});

test('perfil de busca em chips curtos, tolerante ao que não reconhece', () => {
  assert.deepEqual(
    chipsDoPerfilBusca({ finalidade: 'moradia', tipos: ['apartamento', 'casa'], regioes: 'Sudoeste, Noroeste', preco_min_c: 50000000, preco_max_c: 120000000, quartos: 3, vagas: 1, area_min_m2: 80 }),
    ['Moradia', 'Apartamento', 'Casa', 'Sudoeste', 'Noroeste', 'R$ 500 mil a R$ 1,2 mi', '3+ quartos', '1+ vaga', '80 m² ou mais'],
  );
  assert.deepEqual(chipsDoPerfilBusca({ preco_max_c: 90000000 }), ['até R$ 900 mil']);
  for (const lixo of [null, undefined, 'texto', 7, [1, 2], { quartos: -1, tipos: 5, preco_max_c: 'muito' }]) assert.deepEqual(chipsDoPerfilBusca(lixo), [], String(lixo));
});

test('isolamento: o corretor B não abre a ficha de A pela URL, nem o portal, as seleções ou o histórico', async () => {
  const banco = new BancoFalso(UNICOS);
  let id = 0;
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    id = (await chamar('POST', '/contatos', { nome: 'Ana Ribeiro', telefone: '61988887777', email: 'ana@exemplo.com' })).corpo.id;
    assert.equal((await chamar('GET', `/contatos/${id}`)).status, 200, 'A abre a própria ficha');
  });
  await comServidor(rotas, B, banco, {}, async (chamar) => {
    for (const rota of [`/contatos/${id}`, `/contatos/${id}/portal`, `/contatos/${id}/tarefas-cliente`]) {
      const r = await chamar('GET', rota);
      assert.equal(r.status, 404, rota);
      assert.doesNotMatch(JSON.stringify(r.corpo), /Ana|61988887777|ana@/, `${rota} não vaza nada de A`);
    }
    // A sonda de IA da ficha só diz se os slots estão liberados na instância: nenhum dado do contato.
    assert.deepEqual(Object.keys((await chamar('GET', `/contatos/${id}/ia`)).corpo).sort(), ['mensagem', 'resumo']);
    // Listas filtradas pelo id de A voltam vazias (o RLS só devolve a conta de B).
    for (const rota of [`/selecoes?contato_id=${id}`, `/envios?contato_id=${id}`]) {
      const r = await chamar('GET', rota);
      assert.deepEqual(r.corpo.dados ?? [], [], rota);
    }
    assert.equal((await chamar('GET', '/contatos')).corpo.total, 0, 'a lista de B não tem a Ana');
    assert.equal((await chamar('PATCH', `/contatos/${id}/remover`, {})).status, 404, 'nem remove');
  });
});

test('?item= só é contato na visão Lista: a notificação de negociação não abre ficha de outro cliente', () => {
  assert.equal(contatoDoEndereco('/clientes', '?item=7'), 7);
  assert.equal(contatoDoEndereco('/clientes', '?visao=lista&item=7'), 7);
  assert.equal(contatoDoEndereco('/clientes', '?visao=negociacoes&item=7'), null);
  assert.equal(contatoDoEndereco('/clientes', '?visao=quadro&item=7'), null);
  assert.equal(contatoDoEndereco('/clientes', '?visao=xyz&item=7'), null, 'visão desconhecida não é Lista');
  assert.equal(contatoDoEndereco('/clientes/7', ''), 7, 'o apelido antigo continua');
  assert.equal(contatoDoEndereco('/clientes/7', '?sugerir=1'), 7);
  // O endereço do manifesto (`clientes?visao=negociacoes&item={negociacao_id}`), na função que a tela usa.
  assert.equal(contatoDoItem('?visao=negociacoes&item=55'), null);
  assert.equal(contatoDoItem('?item=55'), 55);
});
