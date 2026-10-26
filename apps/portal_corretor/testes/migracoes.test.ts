import { test } from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error migração é JS puro (o runner do shell a importa), sem declaração de tipos.
import semJanela from '../migracoes/001_sem_aprovacao_por_janela.js';
import { BancoFalso } from './apoio';

/**
 * O contexto da migração (upgrade-e-migracoes.md): roda pelo role de migração, então lê e grava em
 * todas as contas. A leitura é a do SISTEMA do banco falso; a escrita vai direto à linha pelo id.
 */
function contextoMigracao(banco: BancoFalso) {
  const cancelados: number[] = [];
  const avisos: string[] = [];
  const leitura = banco.ctxSistema([]).dados;
  const dados = {
    varrerTudo: leitura.varrerTudo,
    async atualizar(tabela: string, id: number, d: Record<string, unknown>) {
      const alvo = banco.linhas(tabela).find((l) => l.id === id);
      return alvo ? Object.assign(alvo, d) : null;
    },
  };
  const eventos = { cancelarAgendamento: async (id: number) => (cancelados.push(id), true) };
  const relato = { avisar: (m: string) => avisos.push(m), erro: (m: string) => avisos.push(m) };
  return { ctx: { dados, eventos, relato }, cancelados, avisos };
}

test('migração 001: rascunho agendado pela janela volta a rascunho, conta "janela" vira "manual"; segunda execução não muda nada', async () => {
  const banco = new BancoFalso();
  const agora = new Date(Date.now() + 3600e3).toISOString();
  banco.linhas('pecas').push(
    { id: 1, conta_id: 100, estado: 'agendada', aprovada_em: null, agendada_para: agora, agendamento_id: 11 },
    { id: 2, conta_id: 100, estado: 'agendada', aprovada_em: '2026-10-20T10:00:00Z', agendada_para: agora, agendamento_id: 12 },
    { id: 3, conta_id: 200, estado: 'agendada', aprovada_em: null, agendada_para: agora, agendamento_id: 13 },
    { id: 4, conta_id: 200, estado: 'rascunho', aprovada_em: null },
  );
  banco.linhas('configuracoes_conta').push(
    { id: 1, conta_id: 100, chave: 'conta', modo_aprovacao_conteudo: 'janela', janela_aprovacao_horas: 24 },
    { id: 2, conta_id: 200, chave: 'conta', modo_aprovacao_conteudo: 'manual', janela_aprovacao_horas: 24 },
  );
  const m = contextoMigracao(banco);
  await semJanela(m.ctx);
  const peca = (id: number) => banco.linhas('pecas').find((p) => p.id === id)!;
  // Sem aprovação, nas duas contas: volta a rascunho, sem agendamento, e o evento é cancelado.
  for (const id of [1, 3]) assert.deepEqual([peca(id).estado, peca(id).agendada_para, peca(id).agendamento_id], ['rascunho', null, null]);
  assert.deepEqual(m.cancelados, [11, 13]);
  // Aprovada continua agendada; o rascunho comum não muda.
  assert.deepEqual([peca(2).estado, peca(2).agendamento_id], ['agendada', 12]);
  assert.equal(peca(4).estado, 'rascunho');
  assert.deepEqual(banco.linhas('configuracoes_conta').map((c) => c.modo_aprovacao_conteudo), ['manual', 'manual']);
  assert.equal(m.avisos.length, 1);

  // Segunda execução (retry do boot): nada a fazer.
  const antes = JSON.stringify([...banco.tabelas]);
  const m2 = contextoMigracao(banco);
  await semJanela(m2.ctx);
  assert.equal(JSON.stringify([...banco.tabelas]), antes);
  assert.deepEqual([m2.cancelados, m2.avisos], [[], []]);
});

test('migração 001: sem cancelarAgendamento no contexto, a peça volta a rascunho mesmo assim', async () => {
  const banco = new BancoFalso();
  banco.linhas('pecas').push({ id: 1, conta_id: 100, estado: 'agendada', aprovada_em: null, agendada_para: new Date().toISOString(), agendamento_id: 11 });
  const m = contextoMigracao(banco);
  await semJanela({ ...m.ctx, eventos: {} });
  assert.deepEqual([banco.linhas('pecas')[0].estado, banco.linhas('pecas')[0].agendamento_id], ['rascunho', null]);
});
