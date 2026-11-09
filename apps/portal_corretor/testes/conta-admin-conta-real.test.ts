import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contaRotas } from '../backend/conta';
import { BancoFalso, comServidor } from './apoio';

// #33: a decisão "conta de demonstração?" olha só o perfil_conta da conta ativa, não o conjunto visível.
function banco(ordem: 'real-primeiro' | 'demo-primeiro') {
  const b = new BancoFalso();
  const real = { conta_id: 1, chave: 'conta', nome: 'Imobiliária Real', demo: false };
  const demo = { conta_id: 2, chave: 'conta', nome: 'Marina (demo)', demo: true };
  for (const l of ordem === 'real-primeiro' ? [real, demo] : [demo, real]) b.linhas('perfil_conta').push({ id: b.linhas('perfil_conta').length + 1, ...l } as any);
  return b;
}
const admin = (conta: number) => ({ usuario: 9, conta, contas: [1, 2], papeis: [], nivel: 'admin' });

for (const ordem of ['real-primeiro', 'demo-primeiro'] as const) {
  test(`admin com contas real e demo (${ordem}): conta ativa real bloqueia`, async () => {
    const b = banco(ordem);
    await comServidor(contaRotas, admin(1), b, {}, async (chamar) => {
      const g = await chamar('GET', '/');
      assert.equal(g.corpo.admin_em_conta_real, true);
      assert.equal(g.corpo.perfil.nome, 'Imobiliária Real');
      const r = await chamar('PUT', '/meu-perfil', { creci: 'DF-1-F' });
      assert.equal(r.status, 403);
      assert.equal(r.corpo.codigo ?? r.corpo.erro?.codigo, 'SO_O_CORRETOR');
      assert.equal(b.linhas('perfis_corretor').length, 0);
    });
  });
  test(`admin com contas real e demo (${ordem}): conta ativa demo permite`, async () => {
    const b = banco(ordem);
    await comServidor(contaRotas, admin(2), b, {}, async (chamar) => {
      const g = await chamar('GET', '/');
      assert.equal(g.corpo.admin_em_conta_real, false);
      assert.equal(g.corpo.perfil.nome, 'Marina (demo)');
      const r = await chamar('PUT', '/meu-perfil', { creci: 'DF-1-F' });
      assert.equal(r.status, 200);
      assert.equal(b.linhas('perfis_corretor').length, 1);
      assert.equal(b.linhas('perfis_corretor')[0].conta_id, 2);
    });
  });
}
