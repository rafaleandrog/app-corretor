import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rotas } from '../backend/rotas';
import { semear } from '../backend/semente';
import { calcularKpis, chegou, marcoMaisAvancado, previsaoPonderada } from '../comum/numeros';
import { BancoFalso, comServidor, type Ator } from './apoio';

const UNICOS = { contatos: ['telefone'], etapas_funil: ['pipeline+nome'], playbook_funil: ['etapa_id+temperatura'], imoveis: ['codigo'], visitas: ['atividade_id'], origens: ['canal+campanha'] };
const A: Ator = { usuario: 1, conta: 100, papeis: ['corretor'] };
const B: Ator = { usuario: 2, conta: 200, papeis: ['corretor'] };

test('regras puras: marco alcançado, KPIs do período e previsão ponderada', () => {
  assert.equal(marcoMaisAvancado('compra', 'visitou', 'atendimento'), 'visitou', 'recuar não apaga o alcançado');
  assert.equal(marcoMaisAvancado('compra', 'visitou', 'proposta'), 'proposta');
  assert.equal(marcoMaisAvancado('compra', null, 'novo'), 'novo');
  const base = { pipeline: 'compra', ganho_em: null, perdido_em: null, motivo_perda: null, valor_estimado_c: null, comissao_pct: null };
  assert.equal(chegou({ ...base, criado_em: '', marco_max: 'proposta' }, 'visitou'), true);
  assert.equal(chegou({ ...base, criado_em: '', marco_max: 'atendimento' }, 'visitou'), false);
  assert.equal(chegou({ ...base, criado_em: '', marco_max: null, ganho_em: 'x' }, 'proposta'), true, 'ganho passou por tudo');
  const de = '2026-10-01T00:00:00.000Z';
  const ate = '2026-11-01T00:00:00.000Z';
  const k = calcularKpis(
    [
      { ...base, criado_em: '2026-10-05T00:00:00.000Z', marco_max: 'novo' },
      { ...base, criado_em: new Date('2026-10-06T00:00:00.000Z'), marco_max: 'visitou', origem_canal: 'portal' },
      { ...base, criado_em: '2026-10-07T00:00:00.000Z', marco_max: 'proposta', ganho_em: '2026-10-17T00:00:00.000Z', valor_estimado_c: 1000, origem_canal: 'portal' },
      { ...base, criado_em: '2026-09-01T00:00:00.000Z', marco_max: 'visitou', perdido_em: '2026-10-10T00:00:00.000Z', motivo_perda: 'preco' },
    ],
    de,
    ate,
  );
  assert.deepEqual([k.leads, k.lead_visita, k.visita_proposta, k.proposta_ganho, k.conversao_total, k.ganhos, k.ciclo_medio_dias, k.vgv_c], [3, 0.667, 0.5, 1, 0.333, 1, 10, 1000]);
  assert.deepEqual(k.motivos_perda, [{ motivo: 'preco', quantidade: 1 }]);
  assert.deepEqual(k.por_origem[0], { canal: 'portal', leads: 2, ganhos: 1 });
  assert.equal(calcularKpis([], de, ate).lead_visita, null, 'sem leads, taxa nula');
  assert.equal(calcularKpis([], de, ate).vgv_c, null);
  assert.deepEqual(previsaoPonderada([
    { ...base, criado_em: '', marco_max: null, aberto: true, valor_estimado_c: 100000, comissao_pct: '0.05', probabilidade: '0.5' },
    { ...base, criado_em: '', marco_max: null, aberto: true, valor_estimado_c: 100000, comissao_pct: null, probabilidade: 0.5 },
    { ...base, criado_em: '', marco_max: null, aberto: false, valor_estimado_c: 999, comissao_pct: 1, probabilidade: 1 },
  ]), { valor_c: 2500, sem_dados: 1 });
  assert.deepEqual(previsaoPonderada([]), { valor_c: null, sem_dados: 0 });
});

test('semente marca a conta de teste; demonstração gera o conjunto e os números batem com a conferência manual', async () => {
  const banco = new BancoFalso(UNICOS);
  // Conta demo pela semente do boot.
  await semear(banco.ctxSistema([{ id: 100, nome: 'Corretora Teste (demo)' }]));
  assert.equal(banco.linhas('perfil_conta')[0].demo, true);
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    const g = await chamar('POST', '/demo/semear', {});
    assert.equal(g.status, 201);
    assert.equal((await chamar('POST', '/demo/semear', {})).status, 409, 'só numa conta vazia');
    const n = (await chamar('GET', '/numeros?dias=30')).corpo;
    // Conferência manual em docs/desempenho.md.
    assert.deepEqual(
      [n.atual.leads, n.atual.lead_atendimento, n.atual.lead_visita, n.atual.visita_proposta, n.atual.proposta_ganho, n.atual.conversao_total, n.atual.ganhos, n.atual.vgv_c, n.atual.captacoes, n.atual.visitas],
      [8, 0.875, 0.625, 0.6, 0.667, 0.25, 2, 107000000, 1, 1],
    );
    assert.deepEqual(n.atual.motivos_perda, [{ motivo: 'preco', quantidade: 1 }]);
    assert.deepEqual(n.atual.por_origem.find((o: any) => o.canal === 'indicacao'), { canal: 'indicacao', leads: 3, ganhos: 1 });
    assert.deepEqual(n.previsao, { valor_c: 8625000, sem_dados: 0 });
    assert.equal(n.anterior.leads, 0);
    const inicio = (await chamar('GET', '/inicio')).corpo;
    assert.deepEqual([inicio.semana.novos_contatos, inicio.semana.leads, inicio.semana.previsao_c], [10, 8, 8625000]);
    // Carla tem visita marcada amanhã: quente pela regra.
    assert.equal(banco.linhas('contatos').find((c) => c.nome === 'Carla Demo')!.temperatura, 'quente');
  });
  // Conta que não é de teste não gera.
  await comServidor(rotas, B, banco, {}, async (chamar) => {
    assert.equal((await chamar('POST', '/demo/semear', {})).status, 403);
  });
});

test('envio registrado entra no histórico, conta como contato e traz o texto pronto', async () => {
  const banco = new BancoFalso(UNICOS);
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    const c = (await chamar('POST', '/contatos', { nome: 'Rita Souza', telefone: '61988881111' })).corpo;
    const im = (await chamar('POST', '/imoveis', { tipo: 'apartamento', cidade: 'Brasília', bairro: 'Sudoeste', titulo: 'Apto 2 quartos' })).corpo;
    await chamar('PATCH', `/imoveis/${im.id}`, { preco: 720000 });
    banco.linhas('contatos')[0].ultimo_contato_em = '2020-01-01T00:00:00.000Z';
    assert.equal((await chamar('POST', '/envios', { contato_id: c.id, tipo: 'imovel' })).status, 422, 'imóvel obrigatório');
    const r = await chamar('POST', '/envios', { contato_id: c.id, tipo: 'imovel', imovel_id: im.id, canal: 'whatsapp' });
    assert.equal(r.status, 201);
    assert.match(r.corpo.mensagem, /Olá, Rita! .*Apto 2 quartos em Sudoeste, Brasília, R\$\s?720\.000,00/);
    assert.ok(r.corpo.envio.link_rastreado);
    assert.ok(banco.linhas('contatos')[0].ultimo_contato_em > '2026-01-01');
    assert.equal((await chamar('GET', `/envios?contato_id=${c.id}`)).corpo.total, 1);
    assert.equal((await chamar('GET', `/envios?imovel_id=${im.id}`)).corpo.total, 1);
    assert.ok(banco.linhas('linha_do_tempo').some((l) => l.tipo === 'envio.registrado'));
  });
  await comServidor(rotas, B, banco, {}, async (chamar) => {
    assert.equal((await chamar('GET', '/envios')).corpo.total, 0);
    assert.equal((await chamar('POST', '/envios', { contato_id: banco.linhas('contatos')[0].id, tipo: 'mensagem' })).status, 422);
    assert.equal((await chamar('GET', '/numeros')).corpo.atual.leads, 0);
  });
  await comServidor(rotas, { usuario: 9, conta: null, papeis: ['operacao'] }, banco, {}, async (chamar) => {
    assert.equal((await chamar('GET', '/numeros')).status, 403);
    assert.equal((await chamar('POST', '/envios', {})).status, 403);
    assert.equal((await chamar('POST', '/demo/semear', {})).status, 403);
  });
});

test('negócio guarda o marco mais avançado e a comissão em fração', async () => {
  const banco = new BancoFalso(UNICOS);
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    const c = (await chamar('POST', '/contatos', { nome: 'Saulo', telefone: '61977771111' })).corpo;
    assert.equal((await chamar('POST', '/negocios', { contato_id: c.id, comissao: 150 })).status, 422);
    const n = (await chamar('POST', '/negocios', { contato_id: c.id, comissao: '6,5' })).corpo;
    assert.deepEqual([n.marco_max, Number(n.comissao_pct)], ['novo', 0.065]);
    const etapas = (await chamar('GET', '/funil/etapas?pipeline=compra')).corpo.etapas;
    const visitou = etapas.find((e: any) => e.nome === 'Visitou');
    const atendimento = etapas.find((e: any) => e.nome === 'Em atendimento');
    await chamar('PATCH', `/negocios/${n.id}`, { etapa_id: visitou.id });
    await chamar('PATCH', `/negocios/${n.id}`, { etapa_id: atendimento.id });
    assert.equal(banco.linhas('negocios')[0].marco_max, 'visitou');
  });
});
