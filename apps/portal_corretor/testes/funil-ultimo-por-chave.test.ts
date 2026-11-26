import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rotas } from '../backend/rotas';
import { BancoFalso, comServidor, type Ator } from './apoio';

// Issue #244: a linha mais recente de CADA chave não pode depender de uma página única com teto.
// Uma chave com muitas linhas recentes não pode esconder a única linha de outra.
const UNICOS = { contatos: ['telefone'], etapas_funil: ['pipeline+nome'], playbook_funil: ['etapa_id+temperatura'], visitas: ['atividade_id'] };
const A: Ator = { usuario: 1, conta: 100, papeis: ['corretor'] };
const depois = (horas: number) => new Date(Date.now() + horas * 3600e3).toISOString();
const mais = (base: string, ms: number) => new Date(Date.parse(base) + ms).toISOString();

async function doisClientes(chamar: any) {
  const ids: number[] = [];
  let tel = 61955550000;
  for (const nome of ['Xavier', 'Yara']) {
    const c = (await chamar('POST', '/contatos', { nome, telefone: String(tel++) })).corpo;
    ids.push(c.id);
    await chamar('POST', '/negocios', { contato_id: c.id, titulo: `Negócio ${nome}` });
  }
  return ids;
}

test('quadro: o último sinal da linha do tempo de um cliente com poucas linhas não some atrás de 1001 de outro', async () => {
  const banco = new BancoFalso(UNICOS);
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    const [x, y] = await doisClientes(chamar);
    const d = banco.dados(100);
    const base = depois(100);
    for (let i = 0; i < 1001; i++) await d.criar('linha_do_tempo', { contato_id: x, tipo: 'nota', resumo: `Xavier ${i}`, ocorrido_em: mais(base, i) });
    await d.criar('linha_do_tempo', { contato_id: y, tipo: 'nota', resumo: 'Sinal da Yara', ocorrido_em: depois(1) });
    const q = (await chamar('GET', '/funil/quadro?pipeline=compra')).corpo;
    const cx = q.negocios.find((n: any) => n.contato_id === x);
    const cy = q.negocios.find((n: any) => n.contato_id === y);
    assert.equal(cx.ultimo_sinal.texto, 'Xavier 1000');
    assert.ok(cy.ultimo_sinal, 'Yara tem sinal');
    assert.equal(cy.ultimo_sinal.texto, 'Sinal da Yara');
  });
});

test('quadro: o último clique de um cliente com um envio não some atrás de 1001 cliques de outro', async () => {
  const banco = new BancoFalso(UNICOS);
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    const [x, y] = await doisClientes(chamar);
    const d = banco.dados(100);
    const base = depois(100);
    for (let i = 0; i < 1001; i++) await d.criar('envios', { contato_id: x, tipo: 'imovel', descricao: 'Casa do X', cliques: 1, primeiro_clique_em: mais(base, i) });
    await d.criar('envios', { contato_id: y, tipo: 'imovel', descricao: 'Casa da Yara', cliques: 2, primeiro_clique_em: depois(2) });
    const q = (await chamar('GET', '/funil/quadro?pipeline=compra')).corpo;
    const cy = q.negocios.find((n: any) => n.contato_id === y);
    assert.ok(cy.ultimo_sinal, 'Yara tem sinal do clique');
    assert.equal(cy.ultimo_sinal.texto, 'Abriu Casa da Yara 2x');
  });
});

async function duasNegociacoes(banco: BancoFalso, estado: string) {
  const d = banco.dados(100);
  const n2 = await d.criar('negociacoes', { codigo: 'NG-0002', contato_id: (await d.criar('contatos', { nome: 'Dois', papeis: 'comprador' })).id, estado, conduzida_por: 'corretor' });
  const n1 = await d.criar('negociacoes', { codigo: 'NG-0001', contato_id: (await d.criar('contatos', { nome: 'Um', papeis: 'comprador' })).id, estado, conduzida_por: 'corretor' });
  return { d, n1, n2 };
}

test('Hoje: a proposta do comprador de uma negociação não some atrás de 1001 propostas de outra', async () => {
  const banco = new BancoFalso(UNICOS);
  const { d, n1, n2 } = await duasNegociacoes(banco, 'ativa');
  // N2: a última (e única) proposta é do comprador, com id menor que as de N1.
  await d.criar('propostas', { negociacao_id: n2.id, direcao: 'comprador', estado: 'registrada', valor_c: 123_000_000 });
  for (let i = 0; i < 1001; i++) await d.criar('propostas', { negociacao_id: n1.id, direcao: 'corretor', estado: 'enviada', valor_c: 150_000_000 });
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    const r = await chamar('GET', '/inicio');
    assert.equal(r.status, 200);
    const recebidas = r.corpo.fila.filter((i: any) => i.tipo === 'proposta_recebida');
    assert.deepEqual(recebidas.map((i: any) => i.negociacao_id), [n2.id]);
    assert.match(recebidas[0].texto, /Ofereceu/);
  });
});

test('"Precisa de você": a oferta do comprador de uma negociação não some atrás de 501 propostas de outra', async () => {
  const banco = new BancoFalso(UNICOS);
  const { d, n1, n2 } = await duasNegociacoes(banco, 'aguardando_corretor');
  await d.criar('propostas', { negociacao_id: n2.id, direcao: 'comprador', estado: 'registrada', valor_c: 123_000_000 });
  for (let i = 0; i < 501; i++) await d.criar('propostas', { negociacao_id: n1.id, direcao: 'corretor', estado: 'enviada', valor_c: 150_000_000 });
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    const r = await chamar('GET', '/inicio');
    assert.equal(r.status, 200);
    const p2 = r.corpo.passagens.find((p: any) => p.negociacao_id === n2.id);
    assert.ok(p2, 'N2 aparece em Precisa de você');
    assert.match(p2.motivo, /Oferta de .*1\.230\.000/);
    const p1 = r.corpo.passagens.find((p: any) => p.negociacao_id === n1.id);
    assert.equal(p1.motivo, 'A negociação espera a sua decisão');
  });
});
