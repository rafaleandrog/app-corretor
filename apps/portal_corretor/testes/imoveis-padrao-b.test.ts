import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { rotas } from '../backend/rotas';
import { combina } from '../comum/imoveis';
import { resolverEndereco } from '../frontend/enderecos';
import { BancoFalso, comServidor, type Ator } from './apoio';

// Imóveis no Padrão B (B5, issue #94, parte 1: P06): carteira em lista na moldura, ficha no centro,
// contexto à direita (qualidade, números de 30 dias, clientes que combinam) e o isolamento entre contas.

const UNICOS = { contatos: ['telefone'], imoveis: ['codigo'], empreendimentos: ['nome'], visitas: ['atividade_id'], etapas_funil: ['pipeline+nome'] };
const A: Ator = { usuario: 1, conta: 100, papeis: ['corretor'] };
const B: Ator = { usuario: 2, conta: 200, papeis: ['corretor'] };
const raiz = (f: string) => readFileSync(resolve(process.cwd(), f), 'utf8');

test('combina: cada critério do perfil precisa bater; perfil vazio não combina', () => {
  const casa = { tipo: 'casa', bairro: 'Lago Sul', cidade: 'Brasília', preco_c: 200_000_000, quartos: 4, vagas: 2, area_util_m2: 300 };
  assert.equal(combina(null, casa), null);
  assert.equal(combina({}, casa), null, 'sem nenhum critério');
  assert.equal(combina([], casa), null);
  assert.deepEqual(combina({ tipos: ['casa', 'apartamento'], regioes: ['lago sul'] }, casa), ['tipo', 'região']);
  assert.equal(combina({ tipos: ['apartamento'] }, casa), null);
  assert.deepEqual(combina({ regioes: 'Brasília', preco_min_c: 100_000_000, preco_max_c: 250_000_000 }, casa), ['região', 'preço']);
  assert.equal(combina({ preco_max_c: 150_000_000 }, casa), null, 'acima do teto');
  assert.equal(combina({ preco_min_c: 1 }, { ...casa, preco_c: null }), null, 'sem preço não entra em faixa');
  assert.deepEqual(combina({ quartos: 3, vagas: 2, area_min_m2: '250' }, casa), ['quartos', 'vagas', 'área']);
  assert.equal(combina({ quartos: 5 }, casa), null);
  assert.deepEqual(combina({ area_min_m2: 200 }, { ...casa, area_util_m2: null, area_total_m2: 400 }), ['área'], 'área total na falta da útil');
});

test('Imóveis, a ficha e o empreendimento abrem na moldura de Imóveis, com o item escolhido', () => {
  const indice = raiz('frontend/index.ts');
  assert.match(indice, /imoveis: \{ titulo: 'Imóveis', papel: 'corretor', moldura: true/);
  assert.match(indice, /imovel: \{ titulo: 'Imóveis', papel: 'corretor', moldura: true, render: \(id, app\) => renderImoveis\(\(\) => app\?\.requestUpdate\(\), \{ imovel: Number\(id\)/);
  assert.match(indice, /render: \(id, app\) => renderImoveis\(\(\) => app\?\.requestUpdate\(\), \{ empreendimento: Number\(id\)/);
  assert.deepEqual(resolverEndereco('/imoveis/7'), { chave: 'imovel', param: '7' });
  const tela = raiz('frontend/telas/imoveis.ts');
  // Lista com miniatura, chips de situação e a ficha no centro; a grade de cartões saiu da carteira.
  assert.match(tela, /<urbi-avatar nome=\$\{i\.codigo\}[^>]*tamanho="48"/);
  assert.doesNotMatch(tela, /cartaoImovel/);
  assert.match(tela, /<pc-tela-ficha-imovel \.imovelId=\$\{item\}>/);
  assert.match(tela, /<pc-contexto-imovel \.imovelId=\$\{item\}>/);
  // A ficha não carrega mais "o que falta": ele está à direita.
  assert.doesNotMatch(raiz('frontend/telas/ficha-imovel.ts'), /O que falta no anúncio/);
});

test('GET /imoveis/:id/contexto: qualidade, números de 30 dias e os compradores que combinam', async () => {
  const banco = new BancoFalso(UNICOS);
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    const im = (await chamar('POST', '/imoveis', { tipo: 'casa', cidade: 'Brasília', bairro: 'Lago Sul', quartos: 4, preco_c: 200_000_000 })).corpo;
    const ana = (await chamar('POST', '/contatos', { nome: 'Ana', telefone: '61911110001' })).corpo;
    const bia = (await chamar('POST', '/contatos', { nome: 'Bia', telefone: '61911110002' })).corpo;
    const caio = (await chamar('POST', '/contatos', { nome: 'Caio', telefone: '61911110003', papeis: ['proprietario'] })).corpo;
    const linha = (id: number) => banco.linhas('contatos').find((c) => c.id === id)!;
    linha(ana.id).perfil_busca = { tipos: ['casa'], regioes: ['Lago Sul'], quartos: 3 };
    linha(bia.id).perfil_busca = { tipos: ['apartamento'] };
    // Proprietário com o mesmo perfil não é comprador: fica de fora.
    linha(caio.id).perfil_busca = { tipos: ['casa'] };
    banco.linhas('envios').push({ id: 50, conta_id: 100, imovel_id: im.id, contato_id: ana.id, enviado_em: new Date().toISOString(), cliques: 3 });
    const r = await chamar('GET', `/imoveis/${im.id}/contexto`);
    assert.equal(r.status, 200);
    assert.ok(r.corpo.qualidade.nota >= 0 && Array.isArray(r.corpo.qualidade.faltas));
    assert.equal(r.corpo.sem_creci, true);
    assert.deepEqual(r.corpo.numeros, { visitas: 0, enviados: 1, cliques: 3, negocios: 0 });
    assert.deepEqual(r.corpo.combinam, [{ id: ana.id, nome: 'Ana', temperatura: linha(ana.id).temperatura ?? null, motivos: ['tipo', 'região', 'quartos'] }]);
  });
});

test('isolamento: B não abre o imóvel de A pela URL, nem o contexto, e não vê os clientes de A', async () => {
  const banco = new BancoFalso(UNICOS);
  let imA = 0;
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    imA = (await chamar('POST', '/imoveis', { tipo: 'casa', cidade: 'Brasília' })).corpo.id;
    const ana = (await chamar('POST', '/contatos', { nome: 'Ana', telefone: '61911110001' })).corpo;
    banco.linhas('contatos').find((c) => c.id === ana.id)!.perfil_busca = { tipos: ['casa'] };
  });
  await comServidor(rotas, B, banco, {}, async (chamar) => {
    assert.equal((await chamar('GET', `/imoveis/${imA}`)).status, 404);
    assert.equal((await chamar('GET', `/imoveis/${imA}/contexto`)).status, 404);
    const meu = (await chamar('POST', '/imoveis', { tipo: 'casa', cidade: 'Brasília' })).corpo;
    assert.deepEqual((await chamar('GET', `/imoveis/${meu.id}/contexto`)).corpo.combinam, [], 'a Ana é de A');
  });
});
