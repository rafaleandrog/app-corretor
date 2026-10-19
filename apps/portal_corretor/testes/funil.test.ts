import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rotas, rotinas } from '../backend/rotas';
import { classificar, deveTrocar, ordenarFila, venceEm } from '../comum/funil';
import { BancoFalso, comServidor, type Ator } from './apoio';

const UNICOS = { contatos: ['telefone'], etapas_funil: ['pipeline+nome'], playbook_funil: ['etapa_id+temperatura'], visitas: ['atividade_id'] };
const A: Ator = { usuario: 1, conta: 100, papeis: ['corretor'] };
const B: Ator = { usuario: 2, conta: 200, papeis: ['corretor'] };
const DIA = 86400e3;
const antes = (dias: number) => new Date(Date.now() - dias * DIA).toISOString();
const depois = (horas: number) => new Date(Date.now() + horas * 3600e3).toISOString();

test('regras puras: temperatura com motivo, sinal forte, vencimento e ordem da fila', () => {
  const base = { agora: '2026-10-20T12:00:00.000Z', ultimo_contato_em: '2026-10-19T12:00:00.000Z', visita_marcada: false, nota_visita: null, em_proposta: false };
  assert.equal(classificar(base).temperatura, 'morno');
  assert.match(classificar({ ...base, ultimo_contato_em: '2026-10-10T11:00:00.000Z' }).motivo, /Sem contato há 10 dias/);
  assert.equal(classificar({ ...base, ultimo_contato_em: null }).temperatura, 'frio');
  assert.deepEqual(classificar({ ...base, visita_marcada: true, visita_marcada_em: '2026-10-19T09:00:00.000Z' }), {
    temperatura: 'quente', motivo: 'Tem visita marcada', forte: true, forte_desde: '2026-10-19T09:00:00.000Z',
  });
  assert.equal(classificar({ ...base, nota_visita: 5 }).temperatura, 'quente');
  assert.equal(classificar({ ...base, em_proposta: true, ultimo_contato_em: '2026-09-01T00:00:00.000Z' }).temperatura, 'quente');
  // A escolha do corretor só cai com sinal forte.
  assert.equal(deveTrocar({ temperatura: 'quente', autor: 'corretor' }, { temperatura: 'frio', motivo: '', forte: false }), false);
  const forte = { temperatura: 'quente' as const, motivo: '', forte: true, forte_desde: '2026-10-19T10:00:00.000Z' };
  assert.equal(deveTrocar({ temperatura: 'frio', autor: 'corretor', em: '2026-10-19T09:00:00.000Z' }, forte), true, 'sinal depois da escolha');
  assert.equal(deveTrocar({ temperatura: 'frio', autor: 'corretor', em: '2026-10-19T11:00:00.000Z' }, forte), false, 'sinal anterior à escolha');
  assert.equal(deveTrocar({ temperatura: 'frio', autor: 'corretor', em: '2026-10-19T11:00:00.000Z' }, { ...forte, forte_desde: null }), false, 'sinal sem data não derruba');
  assert.equal(deveTrocar({ temperatura: 'morno', autor: 'regra' }, { temperatura: 'frio', motivo: '', forte: false }), true);
  assert.equal(venceEm(4, ['2026-01-01T00:00:00.000Z', null, '2026-01-02T00:00:00.000Z']), '2026-01-02T04:00:00.000Z');
  assert.equal(venceEm(4, [null, undefined]), null);
  const fila = ordenarFila([
    { tipo: 'proximo_passo' as const, quando: 'a' }, { tipo: 'visita' as const, quando: 'b' },
    { tipo: 'quente_sem_resposta' as const, quando: 'c' }, { tipo: 'abordagem_vencida' as const, quando: 'd' },
  ]);
  assert.deepEqual(fila.map((i) => i.tipo), ['quente_sem_resposta', 'abordagem_vencida', 'visita', 'proximo_passo']);
});

test('temperatura muda com os sinais e guarda o histórico; a do corretor vale até sinal forte', async () => {
  const banco = new BancoFalso(UNICOS);
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    const c = (await chamar('POST', '/contatos', { nome: 'Ana', telefone: '61911110001' })).corpo;
    assert.equal(c.temperatura, 'morno');
    assert.equal(c.temperatura_autor, 'regra');
    // Corretor marca frio; uma nota (sinal fraco) não muda.
    const manual = await chamar('PATCH', `/contatos/${c.id}`, { temperatura: 'frio', temperatura_motivo: 'Disse que é para o ano que vem' });
    assert.deepEqual([manual.corpo.temperatura, manual.corpo.temperatura_autor, manual.corpo.temperatura_motivo], ['frio', 'corretor', 'Disse que é para o ano que vem']);
    await chamar('POST', `/contatos/${c.id}/notas`, { texto: 'Falei com ela' });
    assert.equal(banco.linhas('contatos')[0].temperatura, 'frio');
    // Visita marcada é sinal forte: vira quente pela regra.
    await chamar('POST', '/atividades', { tipo: 'visita', titulo: 'Visita', quando: depois(48), contato_id: c.id });
    const linha = banco.linhas('contatos')[0];
    assert.deepEqual([linha.temperatura, linha.temperatura_autor, linha.temperatura_motivo], ['quente', 'regra', 'Tem visita marcada']);
    // Histórico com as três mudanças (a ordem por data pode empatar no mesmo milissegundo).
    const ficha = (await chamar('GET', `/contatos/${c.id}`)).corpo;
    assert.deepEqual(ficha.classificacoes.map((x: any) => `${x.autor}:${x.temperatura}`).sort(), ['corretor:frio', 'regra:morno', 'regra:quente']);
    // Agora o corretor escolhe frio com a visita já marcada: a próxima nota não desfaz a escolha.
    await new Promise((r) => setTimeout(r, 5));
    await chamar('PATCH', `/contatos/${c.id}`, { temperatura: 'frio', temperatura_motivo: 'Visita só de curiosidade' });
    await chamar('POST', `/contatos/${c.id}/notas`, { texto: 'Conversamos de novo' });
    assert.deepEqual([banco.linhas('contatos')[0].temperatura, banco.linhas('contatos')[0].temperatura_autor], ['frio', 'corretor']);
    // Confirmar a temperatura da regra com um motivo também fixa a escolha.
    const d = (await chamar('POST', '/contatos', { nome: 'Davi', telefone: '61911110010' })).corpo;
    const confirmado = await chamar('PATCH', `/contatos/${d.id}`, { temperatura: 'morno', temperatura_motivo: 'Quer só em março' });
    assert.deepEqual([confirmado.corpo.temperatura_autor, confirmado.corpo.temperatura_motivo], ['corretor', 'Quer só em março']);
  });
});

test('playbook semeado aponta a próxima abordagem; fazer agora e pular reiniciam o prazo', async () => {
  const banco = new BancoFalso(UNICOS);
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    const c = (await chamar('POST', '/contatos', { nome: 'Beto', telefone: '61911110002' })).corpo;
    const n = (await chamar('POST', '/negocios', { contato_id: c.id })).corpo;
    let ficha = (await chamar('GET', `/contatos/${c.id}`)).corpo;
    assert.equal(ficha.abordagem.negocio_id, n.id);
    assert.equal(ficha.abordagem.etapa_nome, 'Novo');
    assert.match(ficha.abordagem.abordagem, /Apresentar-se/);
    assert.equal(ficha.abordagem.vencida, false);
    // Envelhece: entrou na etapa e falou há 3 dias → abordagem de 4 h vencida e na fila.
    banco.linhas('negocios')[0].etapa_desde = antes(3);
    banco.linhas('contatos')[0].ultimo_contato_em = antes(3);
    ficha = (await chamar('GET', `/contatos/${c.id}`)).corpo;
    assert.equal(ficha.abordagem.vencida, true);
    let inicio = (await chamar('GET', '/inicio')).corpo;
    assert.deepEqual(inicio.fila.map((i: any) => i.tipo), ['abordagem_vencida']);
    assert.equal((await chamar('POST', `/abordagens/${c.id}/adiar`)).status, 200);
    assert.equal((await chamar('GET', `/contatos/${c.id}`)).corpo.abordagem.vencida, false);
    assert.equal((await chamar('POST', `/abordagens/${c.id}/feita`, { texto: 'Mandei 3 imóveis' })).status, 201);
    assert.ok(banco.linhas('linha_do_tempo').some((l) => l.resumo === 'Abordagem: Mandei 3 imóveis'));
    inicio = (await chamar('GET', '/inicio')).corpo;
    assert.equal(inicio.total, 0);
    // Ajuste do playbook pela conta.
    const pb = (await chamar('GET', '/funil/playbook')).corpo;
    assert.ok(pb.abordagens.length >= 30);
    const alvo = pb.abordagens[0];
    assert.equal((await chamar('PUT', `/funil/playbook/${alvo.id}`, { abordagem: '', canal_sugerido: 'pombo', prazo_horas: 0 })).status, 422);
    assert.equal((await chamar('PUT', `/funil/playbook/${alvo.id}`, { abordagem: 'Ligar já', canal_sugerido: 'ligacao', prazo_horas: 2 })).corpo.prazo_horas, 2);
  });
});

test('fila do dia: quentes sem resposta, visitas de hoje e amanhã, próximos passos vencidos', async () => {
  const banco = new BancoFalso(UNICOS);
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    const quente = (await chamar('POST', '/contatos', { nome: 'Quente', telefone: '61911110003' })).corpo;
    await chamar('PATCH', `/contatos/${quente.id}`, { temperatura: 'quente' });
    banco.linhas('contatos').find((l) => l.id === quente.id)!.ultimo_contato_em = antes(2);
    const visita = (await chamar('POST', '/contatos', { nome: 'Visita', telefone: '61911110004' })).corpo;
    await chamar('POST', '/atividades', { tipo: 'visita', titulo: 'Casa no Lago', quando: depois(3), contato_id: visita.id });
    await chamar('POST', '/atividades', { tipo: 'visita', titulo: 'Longe', quando: depois(24 * 5), contato_id: visita.id });
    const passo = (await chamar('POST', '/contatos', { nome: 'Passo', telefone: '61911110005' })).corpo;
    await chamar('PATCH', `/contatos/${passo.id}`, { proximo_passo: 'Ligar', proximo_passo_em: antes(0.1) });
    const inicio = (await chamar('GET', '/inicio')).corpo;
    assert.deepEqual(inicio.fila.map((i: any) => [i.tipo, i.contato_nome]), [
      ['quente_sem_resposta', 'Quente'],
      ['visita', 'Visita'],
      ['proximo_passo', 'Passo'],
    ]);
  });
});

test('quadro por etapa com temperatura e alerta; filtros de temperatura e parado', async () => {
  const banco = new BancoFalso(UNICOS);
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    const c = (await chamar('POST', '/contatos', { nome: 'Caio', telefone: '61911110006' })).corpo;
    await chamar('POST', '/negocios', { contato_id: c.id, titulo: 'Apto Asa Sul' });
    const q = (await chamar('GET', '/funil/quadro?pipeline=compra')).corpo;
    assert.equal(q.etapas.length, 9);
    assert.equal(q.negocios.length, 1);
    assert.equal(q.negocios[0].etapa_id, q.etapas[0].id);
    assert.equal(q.negocios[0].temperatura, 'morno');
    assert.equal((await chamar('GET', '/funil/quadro?temperatura=quente')).corpo.negocios.length, 0);
    assert.equal((await chamar('GET', '/funil/quadro?parado_dias=7')).corpo.negocios.length, 0);
    assert.equal((await chamar('GET', '/funil/quadro?pipeline=venda_captacao')).corpo.etapas.length, 7);
  });
});

test('rotina diária esfria quem ficou 7 dias sem contato, só uma vez e por conta', async () => {
  const banco = new BancoFalso(UNICOS);
  for (const ator of [A, B]) {
    await comServidor(rotas, ator, banco, {}, async (chamar) => {
      await chamar('POST', '/contatos', { nome: `Parado ${ator.conta}`, telefone: `619222200${ator.usuario}` });
      await chamar('POST', '/contatos', { nome: `Ativo ${ator.conta}`, telefone: `619333300${ator.usuario}` });
    });
  }
  for (const l of banco.linhas('contatos').filter((l) => l.nome.startsWith('Parado'))) l.ultimo_contato_em = antes(9);
  const ctx = banco.ctxSistema([{ id: 100, nome: 'A' }, { id: 200, nome: 'B' }]);
  const r1 = await rotinas.reclassificar_contatos(ctx);
  assert.equal(r1.resultado.trocados, 2);
  assert.deepEqual(banco.linhas('contatos').map((l) => `${l.nome}:${l.temperatura}`).sort(), ['Ativo 100:morno', 'Ativo 200:morno', 'Parado 100:frio', 'Parado 200:frio']);
  const r2 = await rotinas.reclassificar_contatos(ctx);
  assert.equal(r2.resultado.trocados, 0, 'idempotente');
  assert.equal(banco.linhas('classificacoes').filter((c) => c.temperatura === 'frio').length, 2);
  // Conta que não está entre as ativas fica de fora; a que lança não derruba as outras.
  for (const l of banco.linhas('contatos').filter((l) => l.nome.startsWith('Ativo'))) {
    l.ultimo_contato_em = antes(9);
  }
  const soA = banco.ctxSistema([{ id: 100, nome: 'A' }]);
  const r3 = await rotinas.reclassificar_contatos(soA);
  assert.equal(r3.resultado.trocados, 1);
  assert.equal(banco.linhas('contatos').find((l) => l.nome === 'Ativo 200')!.temperatura, 'morno');
  banco.linhas('contatos').find((l) => l.nome === 'Ativo 100')!.temperatura = 'morno'; // candidato na conta que vai falhar
  const quebrada = banco.ctxSistema([{ id: 100, nome: 'A' }, { id: 200, nome: 'B' }]);
  const comConta = quebrada.dados.comConta;
  quebrada.dados.comConta = (id: number, fn: any) => (id === 100 ? Promise.reject(new Error('conta inativa')) : comConta(id, fn));
  const r4 = await rotinas.reclassificar_contatos(quebrada);
  assert.equal(r4.ok, false);
  assert.equal(r4.resultado.trocados, 1, 'a conta B foi processada');
  assert.match(r4.erro, /conta 100/);
});

test('isolamento do funil: B não vê quadro, fila nem playbook de A, e não age nos contatos de A', async () => {
  const banco = new BancoFalso(UNICOS);
  let contatoA = 0;
  let playbookA = 0;
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    contatoA = (await chamar('POST', '/contatos', { nome: 'De A', telefone: '61911110009' })).corpo.id;
    await chamar('POST', '/negocios', { contato_id: contatoA });
    playbookA = (await chamar('GET', '/funil/playbook')).corpo.abordagens[0].id;
  });
  await comServidor(rotas, B, banco, {}, async (chamar) => {
    assert.equal((await chamar('GET', '/funil/quadro')).corpo.negocios.length, 0);
    assert.equal((await chamar('GET', '/inicio')).corpo.total, 0);
    assert.ok(!(await chamar('GET', '/funil/playbook')).corpo.abordagens.some((p: any) => p.id === playbookA));
    assert.equal((await chamar('PUT', `/funil/playbook/${playbookA}`, { abordagem: 'x', canal_sugerido: 'whatsapp', prazo_horas: 1 })).status, 404);
    assert.equal((await chamar('POST', `/abordagens/${contatoA}/feita`, {})).status, 404);
    assert.equal((await chamar('POST', `/abordagens/${contatoA}/adiar`)).status, 404);
  });
  await comServidor(rotas, { usuario: 9, conta: null, papeis: ['operacao'] }, banco, {}, async (chamar) => {
    assert.equal((await chamar('GET', '/inicio')).status, 403);
    assert.equal((await chamar('GET', '/funil/quadro')).status, 403);
  });
});
