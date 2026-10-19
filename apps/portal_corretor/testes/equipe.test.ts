import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rotas } from '../backend/rotas';
import { BancoFalso, comServidor, type Ator } from './apoio';

const EQUIPE: Ator = { usuario: 9, conta: null, papeis: ['operacao'] };

function shellFalso() {
  const chamadas: unknown[] = [];
  return {
    chamadas,
    externos: {
      convidar: async (op: unknown) => {
        chamadas.push(op);
        return { conviteId: 42, vigenteAte: new Date('2026-11-01T00:00:00Z') };
      },
      listarConvites: async () => ({
        convites: [{ id: 42, credencial: 'a@b.com', contaNome: 'Ana Imóveis', status: 'emitido', vigenteAte: new Date(), criadoEm: new Date(), usuarioId: null }],
        total: 1,
      }),
      revogarConvite: async ({ conviteId }: { conviteId: number }) => ({ conviteId }),
    },
  };
}

test('convite cria conta nova com o nome informado e normaliza o e-mail', async () => {
  const shell = shellFalso();
  await comServidor(rotas, EQUIPE, new BancoFalso(), shell, async (chamar) => {
    const r = await chamar('POST', '/equipe/convites', { email: '  Ana@B.com ', conta: ' Ana Imóveis ' });
    assert.equal(r.status, 201);
    assert.equal(r.corpo.id, 42);
  });
  assert.deepEqual(shell.chamadas, [{ email: 'ana@b.com', contaNome: 'Ana Imóveis' }]);
});

test('convite com e-mail inválido ou sem conta é recusado antes de chamar o shell', async () => {
  const shell = shellFalso();
  await comServidor(rotas, EQUIPE, new BancoFalso(), shell, async (chamar) => {
    const r = await chamar('POST', '/equipe/convites', { email: 'sem-arroba', conta: '' });
    assert.equal(r.status, 422);
    assert.equal(r.corpo.detalhes.length, 2);
  });
  assert.equal(shell.chamadas.length, 0);
});

test('erro do provisionamento chega com o código e o status do shell', async () => {
  const shell = shellFalso();
  shell.externos.convidar = async () => {
    throw Object.assign(new Error('Já há convite pendente para este e-mail.'), { codigo: 'CONVITE_JA_PENDENTE', status: 409 });
  };
  await comServidor(rotas, EQUIPE, new BancoFalso(), shell, async (chamar) => {
    const r = await chamar('POST', '/equipe/convites', { email: 'a@b.com', conta: 'A' });
    assert.equal(r.status, 409);
    assert.equal(r.corpo.codigo, 'CONVITE_JA_PENDENTE');
  });
});

test('lista e revoga convites', async () => {
  await comServidor(rotas, EQUIPE, new BancoFalso(), shellFalso(), async (chamar) => {
    const lista = await chamar('GET', '/equipe/convites');
    assert.equal(lista.corpo.convites[0].email, 'a@b.com');
    assert.equal(lista.corpo.convites[0].conta, 'Ana Imóveis');
    assert.equal((await chamar('POST', '/equipe/convites/42/revogar')).status, 200);
    assert.equal((await chamar('POST', '/equipe/convites/abc/revogar')).status, 404);
  });
});
