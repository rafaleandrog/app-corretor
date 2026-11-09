import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rotas } from '../backend/rotas';
import { id } from '../backend/acesso';
import { CENTAVOS_MAXIMO, reaisParaCentavos } from '../comum/crm';
import { BancoFalso, comServidor, type Ator } from './apoio';

const UNICOS = { contatos: ['telefone'], imoveis: ['codigo'], empreendimentos: ['nome'], etapas_funil: ['pipeline+nome'] };
const A: Ator = { usuario: 1, conta: 100, papeis: ['corretor'] };
const ENORME = '99999999999999999999';

test('#38: id() único aceita só inteiro positivo que cabe na coluna', () => {
  assert.equal(id('12'), 12);
  assert.equal(id(2_147_483_647), 2_147_483_647);
  for (const v of [ENORME, 2_147_483_648, 1e20, 0, -1, 'abc', '', null, undefined, true, 1.5]) assert.equal(id(v), null, String(v));
});

test('#38: id enorme na URL ou no corpo responde 404/422, nunca 500', async () => {
  await comServidor(rotas, A, new BancoFalso(UNICOS), {}, async (chamar) => {
    for (const caminho of [`/contatos/${ENORME}`, `/imoveis/${ENORME}`, `/empreendimentos/${ENORME}`, `/estudio/pecas/${ENORME}`, `/negociacoes/${ENORME}`]) {
      assert.equal((await chamar('GET', caminho)).status, 404, caminho);
    }
    assert.equal((await chamar('PATCH', `/atividades/${ENORME}`, { status: 'feita' })).status, 404);
    const neg = await chamar('POST', '/negocios', { contato_id: Number(ENORME), titulo: 'X' });
    assert.ok([404, 422].includes(neg.status), String(neg.status));
  });
});

test('#39: valor acima do que a coluna guarda vira NaN (422), valor legítimo passa', () => {
  assert.equal(reaisParaCentavos('21.474.836,47'), CENTAVOS_MAXIMO);
  assert.equal(reaisParaCentavos('1.450.000'), 145_000_000);
  assert.equal(reaisParaCentavos('120,5'), 12_050);
  for (const v of ['99999999999999999999999', 1e30, '21.474.836,48']) assert.ok(Number.isNaN(reaisParaCentavos(v)), String(v));
});

test('#39: preço, condomínio, IPTU e valor do negócio absurdos respondem 422', async () => {
  await comServidor(rotas, A, new BancoFalso(UNICOS), {}, async (chamar) => {
    const base = { tipo: 'casa', cidade: 'Brasília' };
    for (const campo of ['preco', 'condominio', 'iptu_anual']) {
      for (const v of ['99999999999999999999999', 1e30]) {
        const r = await chamar('POST', '/imoveis', { ...base, [campo]: v });
        assert.equal(r.status, 422, `${campo}=${v}`);
      }
    }
    const c = await chamar('POST', '/contatos', { nome: 'Ana', telefone: '61999990000' });
    const n = await chamar('POST', '/negocios', { contato_id: c.corpo.id, titulo: 'Compra', valor_estimado: '99999999999999999999999' });
    assert.equal(n.status, 422);
  });
});
