import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rotas, reagir } from '../backend/rotas';
import { validarConfiguracoes, CONFIGURACOES_PADRAO } from '../comum/conta';
import { BancoFalso, comServidor, type Ator } from './apoio';

function eventosFalsos() {
  const agendados: { tipo: string; payload: any; em: Date }[] = [];
  return { agendados, agendar: async (tipo: string, payload: any, o: { em: Date }) => (agendados.push({ tipo, payload, em: o.em }), { id: agendados.length }), cancelarAgendamento: async () => true };
}

test('configuração do lembrete: padrão 24 h, 0 desliga, fora da faixa recusa', () => {
  assert.equal(CONFIGURACOES_PADRAO.lembrete_visita_horas, 24);
  const base = { ...CONFIGURACOES_PADRAO } as Record<string, unknown>;
  const { lembrete_visita_horas: _, ...semCampo } = base;
  const antigo = validarConfiguracoes(semCampo);
  assert.ok(antigo.ok && antigo.dados.lembrete_visita_horas === 24, 'corpo sem o campo vale o padrão');
  const desligado = validarConfiguracoes({ ...base, lembrete_visita_horas: 0 });
  assert.ok(desligado.ok && desligado.dados.lembrete_visita_horas === 0);
  assert.equal(validarConfiguracoes({ ...base, lembrete_visita_horas: 500 }).ok, false);
});

test('lembrete de visita: agenda antes da visita, notifica o responsável uma vez e ignora remarcada, feita e outra conta', async () => {
  const banco = new BancoFalso({ contatos: ['telefone'] });
  const ev = eventosFalsos();
  const A: Ator = { usuario: 1, conta: 100, papeis: ['corretor'], extras: { eventos: ev } };
  const quando = new Date(Date.now() + 3 * 86400e3).toISOString();
  const novaHora = new Date(Date.now() + 4 * 86400e3).toISOString();
  let visitaId = 0;
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    const c = (await chamar('POST', '/contatos', { nome: 'Ana', telefone: '61988887777' })).corpo;
    const v = await chamar('POST', '/atividades', { tipo: 'visita', titulo: 'Visita casa do Lago', quando, contato_id: c.id, local: 'Lago Sul' });
    assert.equal(v.status, 201, JSON.stringify(v.corpo));
    visitaId = v.corpo.id;
    assert.equal(ev.agendados.length, 1);
    assert.deepEqual(ev.agendados[0].payload, { atividade_id: visitaId, quando });
    assert.equal(ev.agendados[0].em.getTime(), Date.parse(quando) - 24 * 3600e3);
    // Tarefa não ganha lembrete; visita em menos de 24 h também não (já passou a hora do lembrete).
    await chamar('POST', '/atividades', { tipo: 'tarefa', titulo: 'Mandar proposta', quando });
    await chamar('POST', '/atividades', { tipo: 'visita', titulo: 'Visita hoje', quando: new Date(Date.now() + 3600e3).toISOString() });
    assert.equal(ev.agendados.length, 1);
    // Remarcar agenda o lembrete da nova hora.
    await chamar('PATCH', `/atividades/${visitaId}`, { quando: novaHora });
    assert.equal(ev.agendados.length, 2);
  });
  const notificacoes: { usuario: number; mensagem: string; rota?: string }[] = [];
  const ctx = { ...banco.ctxSistema([{ id: 100, nome: 'A' }, { id: 200, nome: 'B' }]), notificacoes: { notificar: async (usuario: number, mensagem: string, o?: { rota?: string }) => (notificacoes.push({ usuario, mensagem, rota: o?.rota }), { ok: true }) } };
  // O lembrete da hora velha não notifica; o da conta errada também não.
  await reagir.lembrete_visita({ payload: ev.agendados[0].payload, conta_id: 100 }, ctx as any);
  await reagir.lembrete_visita({ payload: ev.agendados[1].payload, conta_id: 200 }, ctx as any);
  assert.equal(notificacoes.length, 0);
  // Fora da hora do lembrete (24 h antes da visita, com folga de 30 min) não notifica.
  await reagir.lembrete_visita({ payload: ev.agendados[1].payload, conta_id: 100 }, ctx as any);
  assert.equal(notificacoes.length, 0, 'disparo fora da hora do prazo');
  // Na hora: a visita passa a ser daqui a 24 h (como se o tempo tivesse andado até o lembrete).
  const linha = banco.linhas('atividades').find((x) => x.id === visitaId)!;
  const naHora = new Date(Date.now() + 24 * 3600e3 + 60e3).toISOString();
  linha.quando = naHora;
  ev.agendados[1].payload = { atividade_id: visitaId, quando: naHora };
  await reagir.lembrete_visita({ payload: ev.agendados[1].payload, conta_id: '100' }, ctx as any);
  assert.equal(notificacoes.length, 1);
  assert.equal(notificacoes[0].usuario, 1);
  assert.equal(notificacoes[0].rota, '?aba=agenda', 'Início na aba Agenda (D-82)');
  assert.match(notificacoes[0].mensagem, /^Lembrete de visita: Visita casa do Lago · .* · Ana · Lago Sul$/);
  // Reentrega (at-least-once) não notifica de novo.
  await reagir.lembrete_visita({ payload: ev.agendados[1].payload, conta_id: 100 }, ctx as any);
  assert.equal(notificacoes.length, 1);
  // Lembrete desligado depois de agendado: o disparo não notifica.
  const outra = new Date(Date.now() + 24 * 3600e3 + 120e3).toISOString();
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    await chamar('PATCH', `/atividades/${visitaId}`, { quando: outra });
    await chamar('PUT', '/conta/configuracoes', { ...CONFIGURACOES_PADRAO, lembrete_visita_horas: 0 });
  });
  await reagir.lembrete_visita({ payload: { atividade_id: visitaId, quando: outra }, conta_id: 100 }, ctx as any);
  assert.equal(notificacoes.length, 1, '0 desliga também o que já estava agendado');
  // Visita feita antes do lembrete: nada (mesmo com o lembrete religado).
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    await chamar('PUT', '/conta/configuracoes', { ...CONFIGURACOES_PADRAO, lembrete_visita_horas: 24 });
    await chamar('PATCH', `/atividades/${visitaId}`, { status: 'feita' });
  });
  await reagir.lembrete_visita({ payload: { atividade_id: visitaId, quando: outra }, conta_id: 100 }, ctx as any);
  assert.equal(notificacoes.length, 1);
  // Visita que já passou (disparo atrasado): nada.
  linha.status = 'pendente';
  linha.quando = new Date(Date.now() - 3600e3).toISOString();
  await reagir.lembrete_visita({ payload: { atividade_id: visitaId, quando: linha.quando }, conta_id: 100 }, ctx as any);
  assert.equal(notificacoes.length, 1);
});

test('lembrete: PATCH sem mudar a hora não reagenda; PUT sem o campo mantém o valor gravado', async () => {
  const banco = new BancoFalso({ configuracoes_conta: ['chave'] });
  const ev = eventosFalsos();
  const A: Ator = { usuario: 1, conta: 100, papeis: ['corretor'], extras: { eventos: ev } };
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    const quando = new Date(Date.now() + 3 * 86400e3).toISOString();
    const v = (await chamar('POST', '/atividades', { tipo: 'visita', titulo: 'Visita', quando })).corpo;
    await chamar('PATCH', `/atividades/${v.id}`, { quando, titulo: 'Visita 2' });
    await chamar('PATCH', `/atividades/${v.id}`, { status: 'pendente' });
    assert.equal(ev.agendados.length, 1, 'mesma hora e mesmo status não reagendam');
    await chamar('PUT', '/conta/configuracoes', { ...CONFIGURACOES_PADRAO, lembrete_visita_horas: 0 });
    const { lembrete_visita_horas: _, ...antigo } = { ...CONFIGURACOES_PADRAO } as Record<string, unknown>;
    await chamar('PUT', '/conta/configuracoes', antigo);
    assert.equal((await chamar('GET', '/conta')).corpo.configuracoes.lembrete_visita_horas, 0);
  });
});

test('lembrete desligado (0) não agenda', async () => {
  const banco = new BancoFalso({ configuracoes_conta: ['chave'] });
  const ev = eventosFalsos();
  const A: Ator = { usuario: 1, conta: 100, papeis: ['corretor'], extras: { eventos: ev } };
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    const r = await chamar('PUT', '/conta/configuracoes', { ...CONFIGURACOES_PADRAO, lembrete_visita_horas: 0 });
    assert.equal(r.status, 200, JSON.stringify(r.corpo));
    await chamar('POST', '/atividades', { tipo: 'visita', titulo: 'Visita', quando: new Date(Date.now() + 3 * 86400e3).toISOString() });
    assert.equal(ev.agendados.length, 0);
  });
});
