import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rotas } from '../backend/rotas';
import { funilPrecisaPreparo, playbookDaConta, prepararFunil } from '../backend/inteligencia';
import { BancoFalso, comServidor, type Ator } from './apoio';

const UNICOS = { etapas_funil: ['pipeline+nome'], playbook_funil: ['etapa_id+temperatura'] };
// Quem atende duas contas lê o conjunto (leitura global no banco falso); `conta` é a ativa (X-Conta).
const doisContas = (conta: number): Ator => ({ usuario: 1, conta, contas: [100, 200], papeis: ['corretor'] });
const de = (banco: BancoFalso, tabela: string, conta: number) => banco.linhas(tabela).filter((l) => l.conta_id === conta);

test('POST /funil/preparar semeia a conta ativa mesmo com etapas de outra conta visíveis', async () => {
  const banco = new BancoFalso(UNICOS);
  await prepararFunil(banco.dados(100, true), { conta_id: 100 }); // conta A já semeada
  assert.ok(de(banco, 'etapas_funil', 100).length && de(banco, 'playbook_funil', 100).length);
  assert.equal(de(banco, 'etapas_funil', 200).length, 0);
  await comServidor(rotas, doisContas(200), banco, {}, async (chamar) => {
    assert.equal((await chamar('POST', '/funil/preparar', {})).status, 200);
  });
  const etapasB = de(banco, 'etapas_funil', 200);
  assert.equal(etapasB.length, de(banco, 'etapas_funil', 100).length, 'B recebeu as etapas, apesar das de A');
  assert.ok(de(banco, 'playbook_funil', 200).length, 'B recebeu o playbook, apesar do de A');
  const idsB = new Set(etapasB.map((e) => e.id));
  assert.ok(de(banco, 'playbook_funil', 200).every((p) => idsB.has(p.etapa_id)), 'abordagens de B apontam etapas de B');
});

test('prepararFunil sem filtro continua valendo para quem já tem a conta escopada', async () => {
  const banco = new BancoFalso(UNICOS);
  await prepararFunil(banco.dados(100));
  await prepararFunil(banco.dados(100)); // idempotente
  const etapas = de(banco, 'etapas_funil', 100).length;
  assert.ok(etapas && de(banco, 'playbook_funil', 100).length);
  assert.equal(etapas, de(banco, 'etapas_funil', 100).length);
});

test('GET /inicio avisa `preparar` em conta sem playbook e não grava; depois do preparo, não avisa', async () => {
  const banco = new BancoFalso(UNICOS);
  const ator: Ator = { usuario: 1, conta: 100, papeis: ['corretor'] };
  await comServidor(rotas, ator, banco, {}, async (chamar) => {
    const antes = await chamar('GET', '/inicio');
    assert.equal(antes.status, 200);
    assert.equal(antes.corpo.preparar, true);
    assert.equal(banco.linhas('etapas_funil').length + banco.linhas('playbook_funil').length, 0, 'GET não grava');
    await chamar('POST', '/funil/preparar', {});
    assert.equal((await chamar('GET', '/inicio')).corpo.preparar, false);
  });
});

test('playbookDaConta e funilPrecisaPreparo respeitam o filtro da conta', async () => {
  const banco = new BancoFalso(UNICOS);
  await prepararFunil(banco.dados(100, true), { conta_id: 100 });
  const global = banco.dados(200, true);
  assert.ok((await playbookDaConta(global)).length, 'sem filtro, o SISTEMA enxerga as contas todas');
  assert.equal((await playbookDaConta(global, undefined, { conta_id: 200 })).length, 0);
  assert.equal(await funilPrecisaPreparo(global, { conta_id: 200 }), true);
  assert.equal(await funilPrecisaPreparo(global, { conta_id: 100 }), false);
});
