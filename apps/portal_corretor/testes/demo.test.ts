import { test } from 'node:test';
import assert from 'node:assert/strict';
import schema from '../schema.json';
import { rotas } from '../backend/rotas';
import { semear } from '../backend/semente';
import { proximoSabado10h } from '../backend/demo';
import { passoMaximo_c, validarMandato } from '../comum/negociacao';
import { zopa } from '../comum/negociador';
import { BancoFalso, comServidor, type Ator, type Unico } from './apoio';

// Semente de demonstração do Padrão B (E1, issue #107): o conjunto do guia (specs/telas_padrao_b.md
// §5) na conta principal, o conjunto menor do segundo corretor na outra, sem CRECI nada quebra.

const EM_ANDAMENTO = (schema.tabelas.negociacoes.unicos as unknown[]).find((u) => !Array.isArray(u)) as Exclude<Unico, string>;
const UNICOS: Record<string, Unico[]> = {
  contatos: ['telefone'], etapas_funil: ['pipeline+nome'], playbook_funil: ['etapa_id+temperatura'], imoveis: ['codigo'], visitas: ['atividade_id'],
  origens: ['canal+campanha'], negociacoes: [EM_ANDAMENTO, 'codigo'], mandatos_negociacao: ['negociacao_id+versao'], perfis_corretor: ['usuario_id'],
};
const A: Ator = { usuario: 1, conta: 100, papeis: ['corretor'] };
const B: Ator = { usuario: 2, conta: 200, papeis: ['corretor'] };

async function duasContasDemo() {
  const banco = new BancoFalso(UNICOS);
  // A ordem da lista não importa: a principal é a de menor id.
  await semear(banco.ctxSistema([{ id: 200, nome: 'Segundo Corretor (demo)' }, { id: 100, nome: 'Rafael Gualberto (demo)' }]));
  return banco;
}

test('boot marca a conta principal (menor id) e a de isolamento; a marca não muda depois', async () => {
  const banco = await duasContasDemo();
  const conjunto = (conta: number) => banco.linhas('perfil_conta').find((p) => p.conta_id === conta)!.demo_conjunto;
  assert.equal(conjunto(100), 'principal');
  assert.equal(conjunto(200), 'isolamento');
  // Uma conta de teste de id menor que aparece depois não rouba o conjunto de quem já tem.
  await semear(banco.ctxSistema([{ id: 50, nome: 'Nova (demo)' }, { id: 100, nome: 'Rafael Gualberto (demo)' }, { id: 200, nome: 'Segundo Corretor (demo)' }]));
  assert.equal(conjunto(100), 'principal');
  assert.equal(conjunto(200), 'isolamento');
  assert.equal(conjunto(50), 'principal');
});

test('conjunto do guia: clientes, temperaturas, imóveis, visita de sábado e a negociação do P15', async () => {
  const banco = await duasContasDemo();
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    const g = await chamar('POST', '/demo/semear', {});
    assert.equal(g.status, 201);
    assert.deepEqual(g.corpo, { contatos: 6, negocios: 6, imoveis: 4, negociacoes: 1 });
    // Idempotente: a segunda vez não grava nada.
    assert.equal((await chamar('POST', '/demo/semear', {})).status, 409);
    const contatos = banco.linhas('contatos').filter((c) => c.conta_id === 100);
    assert.equal(contatos.length, 6);
    assert.equal(banco.linhas('negocios').filter((n) => n.conta_id === 100).length, 6);
    assert.equal(banco.linhas('negociacoes').filter((n) => n.conta_id === 100).length, 1);
    // As temperaturas saem da regra (não são gravadas à mão) e batem com o guia.
    const temperatura = Object.fromEntries(contatos.map((c) => [c.nome, c.temperatura]));
    assert.deepEqual(temperatura, {
      'Ana Ribeiro': 'quente', 'Juliana Prado': 'quente', 'Carlos Menezes': 'morno',
      'Fernanda Souza': 'morno', 'Roberto Lima': 'frio', 'Marcos Teixeira': 'frio',
    });
    assert.match(contatos.find((c) => c.nome === 'Roberto Lima')!.temperatura_motivo, /há 9 dias/);
    const origem = (nome: string) => banco.linhas('origens').find((o) => o.id === contatos.find((c) => c.nome === nome)!.origem_id)!.canal;
    assert.deepEqual(['Ana Ribeiro', 'Carlos Menezes', 'Fernanda Souza'].map(origem), ['instagram', 'pagina', 'indicacao']);
    // Imóveis: a nota de qualidade é a do cálculo real (sem fotos na semente; documentado em docs/desempenho.md).
    const lista = (await chamar('GET', '/imoveis?por_pagina=50')).corpo;
    const nota = Object.fromEntries(lista.dados.map((i: any) => [i.titulo, [i.preco_c, i.situacao, i.qualidade?.nota]]));
    assert.deepEqual(nota, {
      'Casa 4 quartos · Jardim Botânico': [145000000, 'ativo', 55],
      'Apartamento 3 quartos · Sudoeste': [98000000, 'ativo', 35],
      'Lote 450 m² · Reserva do Colorado Q1-03': [39500000, 'ativo', 35],
      'Cobertura 3 quartos · Noroeste': [210000000, 'rascunho', 25],
    });
    // A visita da Ana é no sábado, 10 h de Brasília.
    const visita = banco.linhas('atividades').find((a) => a.conta_id === 100 && a.status === 'pendente')!;
    const quando = new Date(visita.quando);
    assert.equal(quando.getUTCDay(), 6);
    assert.equal(quando.getUTCHours(), 13);
    // Negociação do P15: lista com última oferta × pedido (−9%), escada e mandato.
    const negs = (await chamar('GET', '/negociacoes')).corpo.dados;
    assert.equal(negs.length, 1);
    const n = negs[0];
    const anaId = contatos.find((c) => c.nome === 'Ana Ribeiro')!.id;
    assert.equal(n.contato_id, anaId);
    assert.deepEqual([n.estado, n.conduzida_por, n.rodadas, n.ultima_oferta_c, n.preco_pedido_c], ['ativa', 'ia', 2, 132000000, 145000000]);
    assert.equal(Math.round((n.ultima_oferta_c / n.preco_pedido_c - 1) * 100), -9);
    assert.ok(!('recuo_c' in n) && !JSON.stringify(n).includes('136000000'), 'a lista não leva o recuo');
    const detalhe = (await chamar('GET', `/negociacoes/${n.id}`)).corpo;
    const propostas = detalhe.propostas;
    assert.deepEqual(propostas.map((p: any) => [p.rodada, p.direcao, p.valor_c]), [
      [1, 'vendedor', 145000000], [1, 'comprador', 132000000], [1, 'vendedor', 140000000], [2, 'comprador', 132000000],
    ]);
    const mandato = (await chamar('GET', `/negociacoes/${n.id}/mandato`)).corpo;
    const m = mandato.vigente;
    assert.deepEqual([m.preco_pedido_c, m.alvo_c, m.recuo_c, m.rodadas_max, m.autonomia], [145000000, 140000000, 136000000, 4, 'pergunta_antes']);
    // O mandato da semente passa na mesma validação da tela.
    assert.equal(validarMandato({ ...m }).ok, true);
    // KPIs da negociação, à mão: ZOPA de 1,36 mi (recuo) a 1,39 mi (teto estimado); concessão do
    // vendedor até aqui 50 mil; a próxima cabe em 40% de (1,40 − 1,36) = 16 mil.
    assert.deepEqual(zopa(m, banco.linhas('negociacoes').find((x) => x.id === n.id)!.teto_estimado_comprador_c), { existe: true, de_c: 136000000, ate_c: 139000000 });
    const posicaoVendedor = propostas.filter((p: any) => p.direcao === 'vendedor').at(-1).valor_c;
    assert.equal(passoMaximo_c(posicaoVendedor, m.recuo_c, Number(m.passo_max_pct)), 1600000);
    assert.equal(banco.linhas('objecoes_detectadas').filter((o) => o.negociacao_id === n.id)[0].categoria, 'preco');
    // CRECI fictício no perfil do corretor.
    assert.equal(banco.linhas('perfis_corretor').find((p) => p.usuario_id === 1)!.creci, 'DF-12345-F');
  });
});

test('segundo corretor: conjunto próprio e menor; nada de um aparece para o outro', async () => {
  const banco = await duasContasDemo();
  await comServidor(rotas, A, banco, {}, async (chamar) => assert.equal((await chamar('POST', '/demo/semear', {})).status, 201));
  const negA = banco.linhas('negociacoes').find((n) => n.conta_id === 100)!.id;
  const anaA = banco.linhas('contatos').find((c) => c.nome === 'Ana Ribeiro')!.id;
  await comServidor(rotas, B, banco, {}, async (chamar) => {
    const g = await chamar('POST', '/demo/semear', {});
    assert.equal(g.status, 201);
    assert.deepEqual(g.corpo, { contatos: 2, negocios: 2, imoveis: 1, negociacoes: 0 });
    const nomes = (await chamar('GET', '/contatos?por_pagina=50')).corpo.dados.map((c: any) => c.nome).sort();
    assert.deepEqual(nomes, ['Bruno Costa', 'Lívia Rocha']);
    assert.equal((await chamar('GET', '/negociacoes')).corpo.dados.length, 0);
    assert.equal((await chamar('GET', `/negociacoes/${negA}`)).status, 404);
    assert.equal((await chamar('GET', `/negociacoes/${negA}/mandato`)).status, 404);
    assert.equal((await chamar('GET', `/contatos/${anaA}`)).status, 404);
    const imoveis = (await chamar('GET', '/imoveis')).corpo;
    assert.deepEqual(imoveis.dados.map((i: any) => i.titulo), ['Apartamento 2 quartos · Águas Claras']);
    assert.equal((await chamar('GET', '/numeros?dias=30')).corpo.atual.leads, 2);
  });
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    const nomes = (await chamar('GET', '/contatos?por_pagina=50')).corpo.dados.map((c: any) => c.nome);
    assert.ok(!nomes.includes('Bruno Costa') && nomes.length === 6);
  });
});

test('sem CRECI: a semente não sobrescreve o perfil e tudo funciona (D-93)', async () => {
  const banco = await duasContasDemo();
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    assert.equal((await chamar('PUT', '/conta/meu-perfil', { creci: '', telefone: '' })).status, 200);
    assert.equal((await chamar('POST', '/demo/semear', {})).status, 201);
    assert.equal(banco.linhas('perfis_corretor').find((p) => p.usuario_id === 1)!.creci ?? null, null, 'o perfil sem CRECI fica sem CRECI');
    const nid = banco.linhas('negociacoes').find((n) => n.conta_id === 100)!.id;
    for (const rota of ['/inicio', '/contatos', '/imoveis', '/negociacoes', `/negociacoes/${nid}`, `/negociacoes/${nid}/mandato`, '/numeros?dias=30']) {
      assert.equal((await chamar('GET', rota)).status, 200, rota);
    }
    // Registrar uma proposta também não pede CRECI.
    assert.equal((await chamar('POST', `/negociacoes/${nid}/propostas`, { direcao: 'comprador', valor_c: 133000000 })).status, 201);
  });
});

test('proximoSabado10h: hoje é sábado antes das 10 h, depois das 10 h e um dia qualquer', () => {
  assert.equal(proximoSabado10h(new Date('2026-10-31T12:00:00.000Z')), '2026-10-31T13:00:00.000Z');
  assert.equal(proximoSabado10h(new Date('2026-10-31T14:00:00.000Z')), '2026-11-07T13:00:00.000Z');
  assert.equal(proximoSabado10h(new Date('2026-10-28T09:00:00.000Z')), '2026-10-31T13:00:00.000Z');
});
