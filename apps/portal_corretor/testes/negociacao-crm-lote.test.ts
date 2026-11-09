import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rotas } from '../backend/rotas';
import { ETAPAS_PADRAO } from '../comum/crm';
import { BancoFalso, comServidor, type Ator } from './apoio';

const UNICOS = { contatos: ['telefone'], etapas_funil: ['pipeline+nome'], origens: ['canal+campanha'], config_negociador: ['chave'] };
const A: Ator = { usuario: 1, conta: 100, papeis: ['corretor'] };

test('PUT /negociador/config: sem alteração efetiva nada é gravado nem publicado', async () => {
  const eventos: { tipo: string }[] = [];
  const barramento = { publicar: async (tipo: string) => (eventos.push({ tipo }), { id: 1 }) };
  const banco = new BancoFalso(UNICOS);
  await comServidor(rotas, { ...A, extras: { eventos: barramento } }, banco, {}, async (chamar) => {
    assert.equal((await chamar('PUT', '/negociador/config', {})).status, 200);
    assert.equal((await chamar('PUT', '/negociador/config', { estilo: 'cooperativo', gatilhos: { reacao_preco: true } })).status, 200);
    assert.equal(eventos.length, 0, 'iguais ao padrão: nada publicado');
    const g = await chamar('PUT', '/negociador/config', { estilo: 'firme' });
    assert.equal(g.status, 200);
    assert.equal(g.corpo.versao, 1);
    const igual = await chamar('PUT', '/negociador/config', { estilo: 'firme' });
    assert.equal(igual.corpo.versao, 1, 'versão não sobe');
    const gat = await chamar('PUT', '/negociador/config', { gatilhos: { reacao_preco: false } });
    assert.equal(gat.corpo.versao, 2, 'gatilho mudado grava');
    assert.equal((await chamar('PUT', '/negociador/config', { gatilhos: { reacao_preco: false } })).corpo.versao, 2);
  });
  assert.equal(eventos.filter((e) => e.tipo === 'negociador_config_alterada').length, 2);
});

test('PUT /funil/etapas direto numa conta sem etapas: os dois funis ficam com as etapas padrão', async () => {
  const banco = new BancoFalso(UNICOS);
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    const r = await chamar('PUT', '/funil/etapas/compra', { etapas: ETAPAS_PADRAO.filter((e) => e.pipeline === 'compra') });
    assert.equal(r.status, 200, JSON.stringify(r.corpo));
    for (const p of ['compra', 'venda_captacao']) {
      const e = (await chamar('GET', `/funil/etapas?pipeline=${p}`)).corpo.etapas;
      assert.ok(e.length > 0, `${p} sem etapas`);
      assert.ok(e.some((x: any) => x.marco), `${p} com marco`);
    }
  });
});
