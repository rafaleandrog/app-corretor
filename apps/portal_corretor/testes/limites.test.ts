import { test } from 'node:test';
import { readFileSync } from 'node:fs';
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

test('#39: o teto é o mesmo no conversor, no schema e na recusa de rota (máximo aceito, máximo+1 recusado)', () => {
  const colunas = JSON.parse(readFileSync(new URL('../schema.json', import.meta.url), 'utf8'));
  const todas = Object.values(colunas.tabelas ?? colunas.entidades ?? colunas) as any[];
  const achadas: string[] = [];
  const varrer = (o: any) => {
    if (!o || typeof o !== 'object') return;
    for (const [k, v] of Object.entries<any>(o)) {
      if (k.endsWith('_c') && v?.tipo === 'inteiro') {
        achadas.push(k);
        assert.equal(v.intervalo?.max, CENTAVOS_MAXIMO, k);
      } else varrer(v);
    }
  };
  varrer(todas);
  for (const c of ['preco_c', 'condominio_c', 'iptu_anual_c', 'valor_estimado_c', 'preco_autorizado_c']) assert.ok(achadas.includes(c), c);
  assert.equal(reaisParaCentavos(21_474_836.47), CENTAVOS_MAXIMO);
  assert.ok(Number.isNaN(reaisParaCentavos(21_474_836.48)));
  assert.ok(Number.isNaN(reaisParaCentavos(Number.NaN)));
});

test('#39: PATCH de imóvel e de negócio, e autorização com proprietário válido, recusam valor absurdo com 422', async () => {
  await comServidor(rotas, A, new BancoFalso(UNICOS), {}, async (chamar) => {
    const im = await chamar('POST', '/imoveis', { tipo: 'casa', cidade: 'Brasília', preco: '21.474.836,47' });
    assert.equal(im.status, 201);
    for (const campo of ['preco', 'condominio', 'iptu_anual']) {
      const r = await chamar('PATCH', `/imoveis/${im.corpo.id}`, { [campo]: '21.474.836,48' });
      assert.equal(r.status, 422, campo);
    }
    const c = (await chamar('POST', '/contatos', { nome: 'Ana', telefone: '61999990000' })).corpo;
    const n = await chamar('POST', '/negocios', { contato_id: c.id, titulo: 'Compra', valor_estimado: '21.474.836,47' });
    assert.equal(n.status, 201);
    const p = await chamar('PATCH', `/negocios/${n.corpo.id}`, { valor_estimado: '99999999999999999999999' });
    assert.equal(p.status, 422);
    const dia = (d: number) => new Date(Date.now() + d * 86400e3).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
    const dono = (await chamar('POST', '/contatos', { nome: 'Dono', telefone: '61988880000' })).corpo;
    const base = { imovel_id: im.corpo.id, proprietario_id: dono.id, inicio: dia(0), fim: dia(60), comissao_pct: '5' };
    for (const v of ['99999999999999999999999', 1e30]) {
      const r = await chamar('POST', '/autorizacoes', { ...base, preco_autorizado: v });
      assert.equal(r.status, 422, String(v));
    }
    assert.equal((await chamar('POST', '/autorizacoes', { ...base, preco_autorizado: '21.474.836,47' })).status, 201);
  });
});
