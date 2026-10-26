import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizarTelefone, validarConfiguracoes, validarMeuPerfil, validarPerfilConta } from '../comum/conta';
import { ehContaDemo, semear } from '../backend/semente';
import { BancoFalso } from './apoio';

test('CRECI e telefone são normalizados e validados', () => {
  const ok = validarMeuPerfil({ creci: ' df-12345-f ', telefone: '(61) 99999-0000' });
  assert.deepEqual(ok, { ok: true, dados: { creci: 'DF-12345-F', telefone: '+5561999990000' } });
  assert.equal(normalizarTelefone('+1 415 555 0100'), '+14155550100');
  assert.equal(normalizarTelefone('5561999990000'), '+5561999990000');
  const ruim = validarMeuPerfil({ creci: '12345', telefone: '12' });
  assert.equal(ruim.ok, false);
  assert.equal(validarMeuPerfil({}).ok, true);
});

test('perfil da conta exige nome e tipo conhecido', () => {
  assert.equal(validarPerfilConta({ nome: '  ' }).ok, false);
  assert.equal(validarPerfilConta({ nome: 'A', tipo: 'banco' }).ok, false);
  const r = validarPerfilConta({ nome: ' Marina ' });
  assert.ok(r.ok && r.dados.nome === 'Marina' && r.dados.tipo === 'corretor_autonomo');
});

test('configurações respeitam as faixas do schema', () => {
  const base = { prazo_primeiro_atendimento_min: 5, dias_cliente_parado: 7, validade_selecao_dias: 14 };
  assert.equal(validarConfiguracoes(base).ok, true);
  assert.equal(validarConfiguracoes({ ...base, prazo_primeiro_atendimento_min: 0 }).ok, false);
  assert.equal(validarConfiguracoes({ ...base, validade_selecao_dias: 2.5 }).ok, false);
  // Sem aprovação por janela (D-86): o modo antigo, se vier de tela em cache, é ignorado e não é gravado.
  const antigo = validarConfiguracoes({ ...base, modo_aprovacao_conteudo: 'janela', janela_aprovacao_horas: 12 });
  assert.ok(antigo.ok && !('modo_aprovacao_conteudo' in antigo.dados) && !('janela_aprovacao_horas' in antigo.dados));
  assert.equal(validarConfiguracoes({ ...base, dias_cliente_parado: '10' }).ok, true);
});

test('semente só toca contas "(demo)" e é idempotente', async () => {
  const banco = new BancoFalso({ perfil_conta: ['chave'], configuracoes_conta: ['chave'] });
  const contas = [
    { id: 1, nome: 'Marina (demo)' },
    { id: 2, nome: 'Corretor real' },
  ];
  assert.equal(ehContaDemo('Marina (Demo) '), true);
  assert.equal(await semear(banco.ctxSistema(contas)), 1);
  await semear(banco.ctxSistema(contas));
  assert.equal(banco.linhas('perfil_conta').length, 1);
  assert.equal(banco.linhas('perfil_conta')[0].nome, 'Marina');
  assert.equal(banco.linhas('perfil_conta')[0].conta_id, 1);
  assert.equal(banco.linhas('configuracoes_conta').length, 1);
});
