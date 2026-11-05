import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rotas } from '../backend/rotas';
import { semear } from '../backend/semente';
import { lerCsv, gerarCsv } from '../comum/csv';
import { calcularKpis, foraDoHorario, horaNoFuso, leadsPorHora, linhasCsvNumeros, melhoresOrigens, oQueMelhorar, type NegocioNum } from '../comum/numeros';
import { BancoFalso, comServidor, type Ator } from './apoio';

// P10 (B7): contatos por horário, "O que melhorar", melhores origens, filtro de origem, Conteúdo,
// Exportar CSV e o filtro "Ver os N clientes" de Clientes, com isolamento entre corretores.

const UNICOS = { contatos: ['telefone'], etapas_funil: ['pipeline+nome'], playbook_funil: ['etapa_id+temperatura'], imoveis: ['codigo'], visitas: ['atividade_id'], origens: ['canal+campanha'] };
const A: Ator = { usuario: 1, conta: 100, papeis: ['corretor'] };
const B: Ator = { usuario: 2, conta: 200, papeis: ['corretor'] };
const base = { pipeline: 'compra', ganho_em: null, perdido_em: null, motivo_perda: null, valor_estimado_c: null, comissao_pct: null };

test('regras puras do P10: hora no fuso, fora do horário, melhores origens e a leitura "O que melhorar"', () => {
  assert.equal(horaNoFuso('2026-10-05T12:30:00.000Z'), 9, 'Brasília é UTC−3');
  assert.equal(horaNoFuso('2026-10-05T12:30:00.000Z', 'Fuso/Invalido'), 9, 'fuso inválido cai em Brasília');
  assert.equal(horaNoFuso('2026-10-05T12:30:00.000Z', 'UTC'), 12);
  assert.deepEqual([7, 8, 18, 19, 23].map(foraDoHorario), [true, false, false, true, true]);
  const de = '2026-10-01T00:00:00.000Z';
  const ate = '2026-11-01T00:00:00.000Z';
  const negocios: NegocioNum[] = [
    { ...base, criado_em: '2026-10-05T02:00:00.000Z', marco_max: 'novo', origem_canal: 'instagram', contato_id: 1 }, // 23h
    { ...base, criado_em: '2026-10-06T13:00:00.000Z', marco_max: 'visitou', origem_canal: 'pagina', contato_id: 2 }, // 10h
    { ...base, criado_em: '2026-10-07T14:00:00.000Z', marco_max: 'visitou', origem_canal: 'pagina', contato_id: 3, perdido_em: '2026-10-20T00:00:00.000Z', motivo_perda: 'sem_resposta' }, // 11h
    { ...base, criado_em: '2026-10-08T10:00:00.000Z', marco_max: 'novo', origem_canal: 'instagram', contato_id: 3, perdido_em: '2026-10-21T00:00:00.000Z', motivo_perda: 'sem_resposta' }, // 7h
    { ...base, criado_em: '2026-10-09T15:00:00.000Z', marco_max: 'proposta', origem_canal: 'indicacao', contato_id: 4, perdido_em: '2026-10-22T00:00:00.000Z', motivo_perda: 'preco' }, // 12h
    { ...base, criado_em: '2026-09-01T15:00:00.000Z', marco_max: 'novo', contato_id: 9 }, // fora do período
    { ...base, pipeline: 'venda_captacao', criado_em: '2026-10-09T15:00:00.000Z', marco_max: 'contato' },
  ];
  const h = leadsPorHora(negocios, de, ate);
  assert.equal(h.horas.reduce((a, b) => a + b, 0), 5, 'só os leads de compra do período');
  assert.deepEqual([h.horas[23], h.horas[10], h.horas[11], h.horas[7], h.horas[12]], [1, 1, 1, 1, 1]);
  assert.equal(h.fora, 2, '23h e 7h');
  assert.deepEqual([h.inicio, h.fim], [8, 19]);

  const k = calcularKpis(negocios, de, ate);
  assert.deepEqual(melhoresOrigens(k.por_origem).map((o) => [o.canal, o.visitaram, o.leads]), [['pagina', 2, 2], ['indicacao', 1, 1], ['instagram', 0, 2]]);
  const m = oQueMelhorar(negocios, k, de, ate, (x) => (x === 'sem_resposta' ? 'Sem resposta' : x));
  assert.equal(m.motivo, 'sem_resposta', 'o motivo mais comum');
  assert.equal(m.clientes, 1, 'dois negócios perdidos do mesmo cliente contam um cliente');
  // Taxas da turma: lead→visita 3/5 = 60%, visita→proposta 1/3 = 33%, proposta→ganho 0/1 = 0%.
  assert.match(m.texto, /60% dos contatos chegam à visita, mas só 0% das propostas viram venda/);
  assert.match(m.texto, /"Sem resposta" \(2 negócios\)/);
  // Perdas sem motivo em maior número: a frase diz "informado", e negócio sem cliente não entra no N.
  const semMotivo: NegocioNum[] = [
    ...Array.from({ length: 8 }, (_, i) => ({ ...base, criado_em: '2026-10-05T13:00:00.000Z', marco_max: 'novo', contato_id: 20 + i, perdido_em: '2026-10-20T00:00:00.000Z', motivo_perda: 'sem_motivo' }) as NegocioNum),
    { ...base, criado_em: '2026-10-05T13:00:00.000Z', marco_max: 'novo', contato_id: 30, perdido_em: '2026-10-20T00:00:00.000Z', motivo_perda: 'preco' },
    { ...base, criado_em: '2026-10-05T13:00:00.000Z', marco_max: 'novo', contato_id: null, perdido_em: '2026-10-20T00:00:00.000Z', motivo_perda: 'preco' },
  ];
  const m2 = oQueMelhorar(semMotivo, calcularKpis(semMotivo, de, ate), de, ate, (x) => (x === 'preco' ? 'Preço' : x));
  assert.equal(m2.motivo, 'preco');
  assert.match(m2.texto, /O motivo de perda informado mais comum foi "Preço" \(2 negócios\)/);
  assert.equal(m2.clientes, 1, 'o negócio sem cliente não aparece na lista, então não conta');
  assert.deepEqual(oQueMelhorar([], calcularKpis([], de, ate), de, ate), {
    texto: 'Nenhum lead no período. Quando os contatos chegarem, a leitura mostra onde eles param no funil.',
    motivo: null,
    clientes: 0,
  });
});

test('CSV de Números: só agregados, uma linha por indicador, e abre de volta no leitor', () => {
  const de = '2026-10-01T00:00:00.000Z';
  const ate = '2026-11-01T00:00:00.000Z';
  const negocios: NegocioNum[] = [
    { ...base, criado_em: '2026-10-05T13:00:00.000Z', marco_max: 'visitou', origem_canal: 'pagina', contato_id: 1 },
    { ...base, criado_em: '2026-10-06T13:00:00.000Z', marco_max: 'novo', origem_canal: 'pagina', contato_id: 2, perdido_em: '2026-10-07T00:00:00.000Z', motivo_perda: 'preco' },
  ];
  const k = calcularKpis(negocios, de, ate);
  const r = {
    dias: 30,
    origem: null,
    periodo: { de, ate },
    atual: { ...k, visitas: 1, conversao_total: 0.125 },
    anterior: { ...calcularKpis([], de, ate), visitas: 0 },
    previsao: { valor_c: null, sem_dados: 0 },
    por_hora: leadsPorHora(negocios, de, ate),
    conteudo: { publicadas: 3, publicadas_anterior: 1 },
  };
  const { cabecalho, linhas } = linhasCsvNumeros(r, (c) => (c === 'pagina' ? 'Minha página' : c), (m) => (m === 'preco' ? 'Preço' : m));
  const tabela = lerCsv(gerarCsv(cabecalho, linhas));
  assert.deepEqual(tabela[0], ['Indicador', 'Este período', 'Período anterior']);
  const linha = (nome: string) => tabela.find((l) => l[0] === nome);
  assert.deepEqual(linha('Leads'), ['Leads', '2', '0']);
  assert.deepEqual(linha('Lead → visita'), ['Lead → visita', '50%', '']);
  assert.equal(linha('Conversão total')?.[1], '12,5%', 'taxa decimal com vírgula, como o VGV');
  assert.deepEqual(linha('Leads de Minha página'), ['Leads de Minha página', '2', '0']);
  assert.deepEqual(linha('Perdidos por Preço'), ['Perdidos por Preço', '1', '0']);
  assert.deepEqual(linha('Peças publicadas'), ['Peças publicadas', '3', '1']);
  assert.deepEqual(linha('Leads das 10h'), ['Leads das 10h', '2', '']);
  assert.ok(!tabela.flat().some((c) => /telefone|@/.test(c)), 'nenhum dado de cliente');
});

test('GET /numeros (P10): horário, melhores origens, O que melhorar, origem, Conteúdo e isolamento A × B', async () => {
  const banco = new BancoFalso(UNICOS);
  await semear(banco.ctxSistema([{ id: 100, nome: 'Corretora Teste (demo)' }]));
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    assert.equal((await chamar('POST', '/demo/semear', {})).status, 201);
    const n = (await chamar('GET', '/numeros?dias=30')).corpo;
    // Os KPIs da demonstração continuam os da conferência manual (docs/desempenho.md).
    assert.deepEqual([n.atual.leads, n.atual.lead_visita, n.atual.visita_proposta, n.atual.conversao_total], [6, 0.5, 0.667, 0]);
    assert.equal(n.origem, null);
    assert.equal(n.por_hora.horas.length, 24);
    assert.equal(n.por_hora.horas.reduce((a: number, b: number) => a + b, 0), 6, 'cada lead numa hora');
    assert.equal(n.melhores_origens.length, 4);
    assert.ok(n.melhores_origens.every((o: any, i: number, l: any[]) => i === 0 || l[i - 1].visitaram >= o.visitaram), 'ordenadas por visitas');
    assert.equal(n.o_que_melhorar.motivo, null, 'a demonstração não tem perdas');
    assert.match(n.o_que_melhorar.texto, /chegam à visita|viram proposta|viram venda/);
    assert.equal(typeof n.o_que_melhorar.perdido_desde, 'string');
    assert.deepEqual(n.conteudo, { publicadas: 0, publicadas_anterior: 0 });
    assert.ok(n.origens_disponiveis.includes('instagram'));
    // Filtro de origem: só os negócios do canal; visitas (sem origem) ficam nulas.
    const so = (await chamar('GET', '/numeros?dias=30&origem=instagram')).corpo;
    assert.equal(so.origem, 'instagram');
    assert.equal(so.atual.leads, 1);
    assert.deepEqual(so.atual.por_origem.map((o: any) => o.canal), ['instagram']);
    assert.equal(so.atual.visitas, null);
    assert.ok(so.origens_disponiveis.length > 1, 'as opções do filtro continuam todas');
    // Canal fora do catálogo é ignorado.
    assert.equal((await chamar('GET', '/numeros?dias=30&origem=xpto')).corpo.atual.leads, 6);

    // Uma perda com motivo vira a ação "Ver os N clientes", e o filtro de Clientes acha quem perdeu.
    const c = (await chamar('POST', '/contatos', { nome: 'Perdido Silva', telefone: '61977776666', origem_canal: 'portal' })).corpo;
    const neg = (await chamar('POST', '/negocios', { contato_id: c.id })).corpo;
    const perdida = (await chamar('GET', '/funil/etapas?pipeline=compra')).corpo.etapas.find((e: any) => e.tipo === 'perdida');
    assert.equal((await chamar('PATCH', `/negocios/${neg.id}`, { etapa_id: perdida.id, motivo_perda: 'sem_resposta' })).status, 200);
    const n2 = (await chamar('GET', '/numeros?dias=30')).corpo;
    assert.equal(n2.o_que_melhorar.motivo, 'sem_resposta');
    assert.equal(n2.o_que_melhorar.clientes, 1);
    assert.match(n2.o_que_melhorar.texto, /"Sem resposta" \(1 negócio\)/);
    const q = new URLSearchParams({ perdido_motivo: 'sem_resposta', perdido_desde: n2.o_que_melhorar.perdido_desde });
    const lista = (await chamar('GET', `/contatos?${q}`)).corpo;
    assert.deepEqual(lista.dados.map((x: any) => x.nome), ['Perdido Silva']);
    assert.equal((await chamar('GET', `/contatos?${q}&perdido_origem=instagram`)).corpo.total, 0, 'com a origem de Números');
    assert.equal((await chamar('GET', '/contatos?perdido_motivo=preco')).corpo.total, 0, 'outro motivo, ninguém');
    assert.ok((await chamar('GET', '/contatos?perdido_motivo=xpto')).corpo.total > 1, 'motivo fora do catálogo é ignorado');
  });
  // B não vê nada de A: números zerados e o filtro de perdidos vazio.
  await comServidor(rotas, B, banco, {}, async (chamar) => {
    const n = (await chamar('GET', '/numeros?dias=30')).corpo;
    assert.equal(n.atual.leads, 0);
    assert.equal(n.por_hora.horas.reduce((a: number, b: number) => a + b, 0), 0);
    assert.deepEqual(n.melhores_origens, []);
    assert.deepEqual(n.origens_disponiveis, []);
    assert.equal(n.o_que_melhorar.motivo, null);
    assert.equal((await chamar('GET', '/contatos?perdido_motivo=sem_resposta')).corpo.total, 0);
  });
});

test('GET /numeros e o filtro de perdidos pedem o papel corretor', async () => {
  const banco = new BancoFalso(UNICOS);
  await comServidor(rotas, { usuario: 9, conta: 100, papeis: ['cliente'] }, banco, {}, async (chamar) => {
    assert.equal((await chamar('GET', '/numeros?dias=30')).status, 403);
    assert.equal((await chamar('GET', '/contatos?perdido_motivo=sem_resposta')).status, 403);
  });
});

test('apelidos de Página e Números: /minha-pagina e /desempenho', async () => {
  const { resolverEndereco } = await import('../frontend/enderecos');
  assert.equal(resolverEndereco('/minha-pagina').chave, 'pagina');
  assert.equal(resolverEndereco('/desempenho').chave, 'numeros');
});
