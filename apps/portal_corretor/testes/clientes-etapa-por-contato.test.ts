import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rotas } from '../backend/rotas';
import { BancoFalso, comServidor, type Ator } from './apoio';

// Issue #248: a etapa do negócio aberto de cada contato da lista de Clientes não pode depender de uma página
// única de negócios. Um contato com muitos negócios não pode esconder o aberto de outro.
const UNICOS = { contatos: ['telefone'], etapas_funil: ['pipeline+nome'], playbook_funil: ['etapa_id+temperatura'], visitas: ['atividade_id'] };
const A: Ator = { usuario: 1, conta: 100, papeis: ['corretor'] };
const depois = (horas: number) => new Date(Date.now() + horas * 3600e3).toISOString();
const mais = (base: string, ms: number) => new Date(Date.parse(base) + ms).toISOString();

async function cenario(chamar: any, banco: BancoFalso) {
  const criar = async (nome: string, tel: string) => (await chamar('POST', '/contatos', { nome, telefone: tel })).corpo.id as number;
  const x = await criar('Xavier', '61955550001');
  const y = await criar('Yara', '61955550002');
  const z = await criar('Zeca', '61955550003');
  // Semeia o funil (o primeiro negócio cria as etapas).
  await chamar('POST', '/negocios', { contato_id: y, titulo: 'Negócio Yara' });
  const d = banco.dados(100);
  const etapas = (await d.varrerTudo('etapas_funil', {})) as any[];
  const aberta = etapas.filter((e) => e.tipo === 'aberta');
  const ganha = etapas.find((e) => e.tipo === 'ganha');
  const perdida = etapas.find((e) => e.tipo === 'perdida');
  assert.ok(aberta.length >= 2 && ganha && perdida, 'etapas semeadas');
  return { x, y, z, d, aberta, ganha, perdida };
}

test('Clientes: o aberto de um contato não some atrás de 501 negócios fechados de outro', async () => {
  const banco = new BancoFalso(UNICOS);
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    const { x, y, d, ganha } = await cenario(chamar, banco);
    const base = depois(100);
    for (let i = 0; i < 501; i++) await d.criar('negocios', { contato_id: x, titulo: `Fechado ${i}`, pipeline: 'compra', etapa_id: ganha.id, etapa_desde: mais(base, i), ganho_em: mais(base, i) });
    const r = (await chamar('GET', '/contatos')).corpo;
    const cx = r.dados.find((c: any) => c.id === x);
    const cy = r.dados.find((c: any) => c.id === y);
    assert.equal(cx.etapa_nome, null);
    assert.ok(cy.etapa_nome, 'Yara mostra a etapa do negócio aberto');
  });
});

test('Clientes: com vários negócios abertos no mesmo contato vale o de etapa_desde mais recente', async () => {
  const banco = new BancoFalso(UNICOS);
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    const { z, d, aberta } = await cenario(chamar, banco);
    await d.criar('negocios', { contato_id: z, titulo: 'Antigo', pipeline: 'compra', etapa_id: aberta[0].id, etapa_desde: depois(-48) });
    await d.criar('negocios', { contato_id: z, titulo: 'Recente', pipeline: 'compra', etapa_id: aberta[1].id, etapa_desde: depois(-1) });
    const r = (await chamar('GET', '/contatos')).corpo;
    assert.equal(r.dados.find((c: any) => c.id === z).etapa_nome, aberta[1].nome);
  });
});

test('Clientes: contato só com negócios ganhos ou perdidos fica sem etapa', async () => {
  const banco = new BancoFalso(UNICOS);
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    const { z, d, ganha, perdida } = await cenario(chamar, banco);
    await d.criar('negocios', { contato_id: z, titulo: 'Ganho', pipeline: 'compra', etapa_id: ganha.id, etapa_desde: depois(-3), ganho_em: depois(-3) });
    await d.criar('negocios', { contato_id: z, titulo: 'Perdido', pipeline: 'compra', etapa_id: perdida.id, etapa_desde: depois(-2), perdido_em: depois(-2), motivo_perda: 'preco' });
    const r = (await chamar('GET', '/contatos')).corpo;
    assert.equal(r.dados.find((c: any) => c.id === z).etapa_nome, null);
  });
});
