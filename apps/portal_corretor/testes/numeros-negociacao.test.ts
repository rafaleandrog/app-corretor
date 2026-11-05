import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rotas } from '../backend/rotas';
import { calcularKpisNegociacao, rotuloObjecao, type NegociacaoNum } from '../comum/numeros-negociacao';
import { BancoFalso, comServidor, type Ator } from './apoio';

// Relatório Negociação de Números (D6, spec 11.2): cada KPI contra a conta feita à mão, isolamento
// A × B, só o corretor, e nenhum valor sigiloso (recuo, alvo, BATNA, teto estimado) na resposta.
const A: Ator = { usuario: 1, conta: 100, papeis: ['corretor'] };
const B: Ator = { usuario: 2, conta: 200, papeis: ['corretor'] };
const DIA = 86400e3;
const ha = (dias: number) => new Date(Date.now() - dias * DIA).toISOString();

test('regras puras: os 7 KPIs de negociação batem com a conta à mão', () => {
  const de = '2026-10-01T00:00:00.000Z';
  const ate = '2026-11-01T00:00:00.000Z';
  const base: NegociacaoNum = { estado: 'ganha', encerrada_em: '2026-10-10T00:00:00.000Z', valor_final_c: null, rodadas: 0, teto_estimado_comprador_c: null, preco_pedido_c: null, recuo_c: null };
  const k = calcularKpisNegociacao(
    {
      negociacoes: [
        // pedido 1.000, final 900 → 10%; recuo 850 ≤ 900 ≤ teto 950 → dentro da ZOPA; 3 rodadas.
        { ...base, valor_final_c: 900, rodadas: 3, preco_pedido_c: 1000, recuo_c: 850, teto_estimado_comprador_c: 950 },
        // pedido 1.000, final 800 → 20%; abaixo do recuo → fora; 5 rodadas.
        { ...base, valor_final_c: 800, rodadas: 5, preco_pedido_c: 1000, recuo_c: 850, teto_estimado_comprador_c: 900 },
        // acima do teto → fora; vendeu acima do pedido → desconto −5%; 1 rodada.
        { ...base, valor_final_c: 1050, rodadas: 1, preco_pedido_c: 1000, recuo_c: 850, teto_estimado_comprador_c: 1000 },
        // sem mandato nem teto: fica fora do desconto e da ZOPA, conta nas rodadas (2).
        { ...base, valor_final_c: 500, rodadas: 2 },
        { ...base, estado: 'perdida' },
        { ...base, estado: 'ativa', encerrada_em: null },
        { ...base, encerrada_em: '2026-09-30T23:59:59.000Z', valor_final_c: 1, rodadas: 40 },
      ],
      propostas: [
        { direcao: 'comprador', criado_em: '2026-10-02T00:00:00.000Z' },
        { direcao: 'comprador', criado_em: new Date('2026-10-31T23:59:59.000Z') },
        { direcao: 'vendedor', criado_em: '2026-10-02T00:00:00.000Z' },
        { direcao: 'proprietario', criado_em: '2026-10-02T00:00:00.000Z' },
        { direcao: 'comprador', criado_em: '2026-11-01T00:00:00.000Z' },
      ],
      objecoes: [
        { categoria: 'prazo', em: '2026-10-03T00:00:00.000Z' },
        { categoria: 'preco', em: '2026-10-03T00:00:00.000Z' },
        { categoria: 'preco', em: '2026-10-04T00:00:00.000Z' },
        { categoria: 'financiamento', em: '2026-10-05T00:00:00.000Z' },
        { categoria: 'preco', em: '2026-09-01T00:00:00.000Z' },
      ],
      execucoes: [
        { decisao: 'aprovada', aprovada_sem_edicao: true, decidida_em: '2026-10-05T00:00:00.000Z' },
        { decisao: 'aprovada', aprovada_sem_edicao: true, decidida_em: '2026-10-06T00:00:00.000Z' },
        { decisao: 'editada', aprovada_sem_edicao: false, decidida_em: '2026-10-07T00:00:00.000Z' },
        { decisao: 'descartada', aprovada_sem_edicao: null, decidida_em: '2026-10-07T00:00:00.000Z' },
        { decisao: 'automatica', aprovada_sem_edicao: true, decidida_em: '2026-10-07T00:00:00.000Z' },
        { decisao: 'pendente', aprovada_sem_edicao: null, decidida_em: null },
      ],
    },
    de,
    ate,
  );
  assert.equal(k.propostas_recebidas, 2, 'só do comprador, dentro do período');
  assert.deepEqual([k.encerradas, k.ganhas, k.taxa_acordo], [5, 4, 0.8]);
  assert.equal(k.desconto_medio, 0.083, '(10% + 20% − 5%) / 3');
  assert.equal(k.rodadas_medias, 2.8, '(3 + 5 + 1 + 2) / 4 = 2,75 → 2,8');
  assert.deepEqual([k.dentro_zopa, k.zopa_sem_estimativa], [0.333, 1], '1 das 3 com estimativa');
  assert.deepEqual(k.objecoes, [{ categoria: 'preco', quantidade: 2 }, { categoria: 'financiamento', quantidade: 1 }, { categoria: 'prazo', quantidade: 1 }]);
  assert.deepEqual([k.sugestoes_enviadas, k.sugestoes_sem_edicao, k.taxa_sem_edicao], [3, 2, 0.667], 'aprovadas e editadas; automática e descartada fora');

  // Sem dado: contagens zeradas e taxas nulas (a tela troca por frase).
  const v = calcularKpisNegociacao({ negociacoes: [], propostas: [], objecoes: [], execucoes: [] }, de, ate);
  assert.deepEqual(
    [v.propostas_recebidas, v.taxa_acordo, v.desconto_medio, v.rodadas_medias, v.dentro_zopa, v.objecoes.length, v.taxa_sem_edicao],
    [0, null, null, null, null, 0, null],
  );
  assert.equal(rotuloObjecao('decisao_compartilhada'), 'Decisão compartilhada');
  assert.equal(rotuloObjecao('outra'), 'Outra');
});

/** Grava direto no banco falso uma conta com negociações, mandatos, propostas, objeções e execuções. */
function semearConta(banco: BancoFalso, conta: number, base: number, lin: {
  negociacoes: Record<string, unknown>[];
  mandatos: Record<string, unknown>[];
  propostas: Record<string, unknown>[];
  objecoes: Record<string, unknown>[];
  execucoes: Record<string, unknown>[];
}) {
  const por = (tabela: string, linhas: Record<string, unknown>[]) =>
    linhas.forEach((l, i) => banco.linhas(tabela).push({ id: base + i, conta_id: conta, criado_em: ha(0), ...l } as any));
  por('negociacoes', lin.negociacoes);
  por('mandatos_negociacao', lin.mandatos);
  por('propostas', lin.propostas);
  por('objecoes_detectadas', lin.objecoes);
  por('negociador_execucoes', lin.execucoes);
}

test('GET /numeros/negociacao: KPIs à mão, isolamento A × B, só corretor e sem valor sigiloso', async () => {
  const banco = new BancoFalso();
  // Conta A. Mandatos 1000 (pedido 1.234.500,00; recuo 1.111.100,00) e 1001 (pedido 777.700,00; recuo 711.100,00).
  semearConta(banco, 100, 1000, {
    mandatos: [
      { preco_pedido_c: 123450000, recuo_c: 111110000, alvo_c: 119990000, batna_vendedor: 'BATNA-SECRETA-A', versao: 1 },
      { preco_pedido_c: 77770000, recuo_c: 71110000, alvo_c: 75550000, batna_vendedor: 'BATNA-SECRETA-A2', versao: 1 },
    ],
    negociacoes: [],
    propostas: [],
    objecoes: [],
    execucoes: [],
  });
  semearConta(banco, 100, 2000, {
    mandatos: [],
    negociacoes: [
      // Período atual (30 dias):
      // ganha: 1.234.500 → 1.172.775 = 5%; recuo 1.111.100 ≤ final ≤ teto 1.199.900 → dentro; 4 rodadas.
      { estado: 'ganha', encerrada_em: ha(5), valor_final_c: 117277500, rodadas: 4, mandato_id: 1000, teto_estimado_comprador_c: 119990000, batna_estimada_comprador: 'BATNA-COMPRADOR-A' },
      // ganha: 777.700 → 699.930 = 10%; abaixo do recuo 711.100 → fora; 2 rodadas.
      { estado: 'ganha', encerrada_em: ha(6), valor_final_c: 69993000, rodadas: 2, mandato_id: 1001, teto_estimado_comprador_c: 74440000 },
      // ganha sem mandato e sem teto: só nas rodadas (3).
      { estado: 'ganha', encerrada_em: ha(7), valor_final_c: 40000000, rodadas: 3 },
      { estado: 'perdida', encerrada_em: ha(3), motivo_perda: 'preco', rodadas: 1 },
      { estado: 'ativa', rodadas: 2, mandato_id: 1000 },
      // Período anterior: uma ganha, 1.234.500 → 1.234.500 = 0%; 1 rodada; sem teto.
      { estado: 'ganha', encerrada_em: ha(40), valor_final_c: 123450000, rodadas: 1, mandato_id: 1000 },
      // Fora dos dois períodos.
      { estado: 'perdida', encerrada_em: ha(100), motivo_perda: 'outro', rodadas: 9 },
    ],
    propostas: [
      { negociacao_id: 2000, rodada: 1, direcao: 'comprador', autor_tipo: 'cliente', valor_c: 110000000, criado_em: ha(2) },
      { negociacao_id: 2000, rodada: 2, direcao: 'comprador', autor_tipo: 'cliente', valor_c: 115000000, criado_em: ha(10) },
      { negociacao_id: 2000, rodada: 1, direcao: 'vendedor', autor_tipo: 'corretor', valor_c: 120000000, criado_em: ha(2) },
      { negociacao_id: 2005, rodada: 1, direcao: 'comprador', autor_tipo: 'cliente', valor_c: 120000000, criado_em: ha(40) },
      { negociacao_id: 2006, rodada: 1, direcao: 'comprador', autor_tipo: 'cliente', valor_c: 1, criado_em: ha(100) },
    ],
    objecoes: [
      { negociacao_id: 2000, contato_id: 1, categoria: 'preco', detectada_por: 'ia', em: ha(1) },
      { negociacao_id: 2001, contato_id: 1, categoria: 'preco', detectada_por: 'ia', em: ha(2) },
      { negociacao_id: 2001, contato_id: 1, categoria: 'prazo', detectada_por: 'humano', em: ha(3) },
      { negociacao_id: 2005, contato_id: 1, categoria: 'pensar', detectada_por: 'ia', em: ha(50) },
    ],
    execucoes: [
      { negociacao_id: 2000, decisao: 'aprovada', aprovada_sem_edicao: true, decidida_em: ha(1) },
      { negociacao_id: 2000, decisao: 'aprovada', aprovada_sem_edicao: true, decidida_em: ha(2) },
      { negociacao_id: 2001, decisao: 'editada', aprovada_sem_edicao: false, decidida_em: ha(3) },
      { negociacao_id: 2001, decisao: 'pendente', aprovada_sem_edicao: null },
      { negociacao_id: 2001, decisao: 'descartada', decidida_em: ha(1) },
      { negociacao_id: 2001, decisao: 'automatica', aprovada_sem_edicao: true, decidida_em: ha(1) },
      { negociacao_id: 2005, decisao: 'aprovada', aprovada_sem_edicao: true, decidida_em: ha(45) },
    ],
  });
  // Conta B: números grandes e redondos que denunciariam um vazamento na soma de A.
  semearConta(banco, 200, 5000, {
    mandatos: [{ preco_pedido_c: 999900000, recuo_c: 900000000, alvo_c: 950000000, batna_vendedor: 'BATNA-SECRETA-B', versao: 1 }],
    negociacoes: [],
    propostas: [],
    objecoes: [],
    execucoes: [],
  });
  semearConta(banco, 200, 6000, {
    mandatos: [],
    negociacoes: [
      { estado: 'ganha', encerrada_em: ha(2), valor_final_c: 500000000, rodadas: 20, mandato_id: 5000, teto_estimado_comprador_c: 999900000 },
      { estado: 'ganha', encerrada_em: ha(2), valor_final_c: 1, rodadas: 20, mandato_id: 1000 }, // mandato de A: não alcança
    ],
    propostas: [{ negociacao_id: 6000, rodada: 1, direcao: 'comprador', autor_tipo: 'cliente', valor_c: 1, criado_em: ha(1) }],
    objecoes: [{ negociacao_id: 6000, contato_id: 9, categoria: 'documentacao', detectada_por: 'ia', em: ha(1) }],
    execucoes: [{ negociacao_id: 6000, decisao: 'editada', aprovada_sem_edicao: false, decidida_em: ha(1) }],
  });

  await comServidor(rotas, A, banco, {}, async (chamar) => {
    const r = await chamar('GET', '/numeros/negociacao?dias=30');
    assert.equal(r.status, 200);
    const a = r.corpo.atual;
    assert.equal(a.propostas_recebidas, 2);
    assert.deepEqual([a.encerradas, a.ganhas, a.taxa_acordo], [4, 3, 0.75]);
    assert.equal(a.desconto_medio, 0.075, '(5% + 10%) / 2');
    assert.equal(a.rodadas_medias, 3, '(4 + 2 + 3) / 3');
    assert.deepEqual([a.dentro_zopa, a.zopa_sem_estimativa], [0.5, 1]);
    assert.deepEqual(a.objecoes, [{ categoria: 'preco', quantidade: 2 }, { categoria: 'prazo', quantidade: 1 }]);
    assert.deepEqual([a.sugestoes_enviadas, a.sugestoes_sem_edicao, a.taxa_sem_edicao], [3, 2, 0.667]);
    const b = r.corpo.anterior;
    assert.deepEqual(
      [b.propostas_recebidas, b.encerradas, b.taxa_acordo, b.desconto_medio, b.rodadas_medias, b.dentro_zopa, b.zopa_sem_estimativa, b.sugestoes_enviadas],
      [1, 1, 1, 0, 1, null, 1, 1],
    );
    assert.deepEqual(b.objecoes, [{ categoria: 'pensar', quantidade: 1 }]);
    // Sigilo: nenhum valor do mandato nem a estimativa do comprador, nem por nome nem por valor.
    const texto = JSON.stringify(r.corpo);
    for (const proibido of ['recuo', 'alvo', 'batna', 'teto_estimado', 'preco_pedido', 'valor_final', 'BATNA', '111110000', '119990000', '71110000', '75550000', '74440000', '123450000', '117277500']) {
      assert.ok(!texto.includes(proibido), `não pode aparecer: ${proibido}`);
    }
    // Período padrão (30) quando o valor é desconhecido.
    assert.equal((await chamar('GET', '/numeros/negociacao?dias=13')).corpo.dias, 30);
    const ano = (await chamar('GET', '/numeros/negociacao?dias=365')).corpo.atual;
    assert.deepEqual([ano.encerradas, ano.propostas_recebidas], [6, 4]);
  });

  // B só vê o que é de B; o mandato de A, apontado por uma negociação de B, não é alcançado.
  await comServidor(rotas, B, banco, {}, async (chamar) => {
    const r = await chamar('GET', '/numeros/negociacao?dias=30');
    assert.equal(r.status, 200);
    const a = r.corpo.atual;
    assert.deepEqual([a.propostas_recebidas, a.encerradas, a.ganhas, a.taxa_acordo], [1, 2, 2, 1]);
    assert.equal(a.desconto_medio, 0.5, 'só o mandato de B (999.900 → 500.000 ≈ 50%); o de A não entra');
    assert.deepEqual([a.dentro_zopa, a.zopa_sem_estimativa], [0, 1]);
    assert.deepEqual(a.objecoes, [{ categoria: 'documentacao', quantidade: 1 }]);
    assert.deepEqual([a.sugestoes_enviadas, a.sugestoes_sem_edicao], [1, 0]);
    assert.ok(!JSON.stringify(r.corpo).includes('BATNA'));
  });

  // Conta sem nada: contagens zeradas e taxas nulas.
  await comServidor(rotas, { usuario: 3, conta: 300, papeis: ['corretor'] }, banco, {}, async (chamar) => {
    const a = (await chamar('GET', '/numeros/negociacao')).corpo.atual;
    assert.deepEqual([a.propostas_recebidas, a.taxa_acordo, a.desconto_medio, a.rodadas_medias, a.dentro_zopa, a.taxa_sem_edicao], [0, null, null, null, null, null]);
  });

  // Só o corretor: o negociador humano da conta, a equipe e quem não tem papel recebem 403.
  for (const ator of [
    { usuario: 4, conta: 100, papeis: ['negociador'] },
    { usuario: 9, conta: null, papeis: ['operacao'] },
    { usuario: 7, conta: 100, papeis: [] },
    { usuario: 8, conta: 100, papeis: ['cliente'] },
  ] as Ator[]) {
    await comServidor(rotas, ator, banco, {}, async (chamar) => {
      assert.equal((await chamar('GET', '/numeros/negociacao')).status, 403, `papel ${ator.papeis.join(',') || 'nenhum'}`);
    });
  }
});
