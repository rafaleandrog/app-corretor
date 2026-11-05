import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rotas } from '../backend/rotas';
import { BancoFalso, comServidor, type Ator } from './apoio';

/**
 * Trava de edição simultânea (#143) nas PATCH de autorizações e de mídias do imóvel, pelo mesmo
 * caminho do F2 (#134): a rota relê a linha travada dentro da transação e recusa (409) se ela mudou
 * desde a leitura. Aqui a corrida é de verdade: a primeira PATCH pega a trava e PARA; só então a
 * segunda começa (lê a linha ainda intocada) e fica na fila da trava. Sem a trava, a segunda passaria
 * no meio e sobrescreveria a primeira sem ter lido o que ela gravou.
 */

const UNICOS = { contatos: ['telefone'], imoveis: ['codigo'], empreendimentos: ['nome'], visitas: ['atividade_id'], etapas_funil: ['pipeline+nome'] };
const arquivos = { url: async (arquivo: number) => `/arquivo/${arquivo}` };
const A: Ator = { usuario: 1, conta: 100, papeis: ['corretor'], extras: { arquivos } };
const B: Ator = { usuario: 2, conta: 200, papeis: ['corretor'], extras: { arquivos } };
const HOJE = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
const dia = (delta: number) => new Date(Date.now() + delta * 86400e3).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });

type Chamar = (metodo: string, caminho: string, corpo?: unknown) => Promise<{ status: number; corpo: any }>;

/** Monta, na conta A, um imóvel com uma foto e uma autorização em rascunho. */
async function base(chamar: Chamar) {
  const imovel = (await chamar('POST', '/imoveis', { tipo: 'casa', cidade: 'Brasília' })).corpo.id as number;
  const midia = (await chamar('POST', `/imoveis/${imovel}/midias`, { upload_id: 5 })).corpo.id as number;
  const dono = (await chamar('POST', '/contatos', { nome: 'Dono A', telefone: '61944443333' })).corpo.id as number;
  const aut = (await chamar('POST', '/autorizacoes', { imovel_id: imovel, proprietario_id: dono, inicio: HOJE, fim: dia(30), comissao_pct: 5, preco_autorizado: 1 })).corpo.id as number;
  return { imovel, midia, aut };
}

/**
 * Duas PATCH no mesmo registro: `primeira` trava a linha `tabela:id` e espera até `segunda` estar na
 * fila dessa trava. Devolve as duas respostas e se a segunda de fato esperou.
 */
async function corrida(banco: BancoFalso, tabela: string, rid: number, primeira: () => Promise<any>, segunda: () => Promise<any>) {
  const chave = `${tabela}:${rid}`;
  let abrir!: () => void;
  const portao = new Promise<void>((ok) => (abrir = ok));
  let segundaTerminou = false;
  let esperou = false;
  banco.pausaNaTransacao = async (ponto) => {
    if (ponto !== `${tabela}:travada`) return;
    banco.pausaNaTransacao = null;
    abrir();
    while (!segundaTerminou && banco.esperando(chave) === 0) await new Promise((ok) => setTimeout(ok, 1));
    esperou = banco.esperando(chave) > 0;
  };
  const [a, b] = await Promise.all([
    // Se a primeira nunca chega à pausa (sem a trava, não há o que segurar), o portão abre ao fim dela.
    primeira().finally(() => ((banco.pausaNaTransacao = null), abrir())),
    portao.then(segunda).finally(() => (segundaTerminou = true)),
  ]);
  return { a, b, esperou };
}

test('trava (#143): duas edições simultâneas da autorização — a segunda espera, vê a mudança e responde 409', async () => {
  const banco = new BancoFalso(UNICOS);
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    const { aut } = await base(chamar);
    const r = await corrida(
      banco,
      'autorizacoes_venda',
      aut,
      () => chamar('PATCH', `/autorizacoes/${aut}`, { comissao_pct: 6 }),
      () => chamar('PATCH', `/autorizacoes/${aut}`, { comissao_pct: 4 }),
    );
    assert.ok(r.esperou, 'a segunda PATCH esperou a trava da autorização');
    assert.equal(r.a.status, 200, JSON.stringify(r.a.corpo));
    assert.deepEqual([r.b.status, r.b.corpo.codigo], [409, 'AUTORIZACAO_ALTERADA'], JSON.stringify(r.b.corpo));
    assert.equal(Number(banco.linhas('autorizacoes_venda').find((x) => x.id === aut)!.comissao_pct), 6, 'a segunda não sobrescreveu a primeira');
    // Reaberta (lendo de novo), a edição seguinte passa: a trava não recusa o que é sequencial.
    assert.equal((await chamar('PATCH', `/autorizacoes/${aut}`, { comissao_pct: 4 })).status, 200);
    assert.equal((await chamar('PATCH', `/autorizacoes/${aut}`, { comissao_pct: 5 })).status, 200);
    assert.equal(Number(banco.linhas('autorizacoes_venda').find((x) => x.id === aut)!.comissao_pct), 5);
  });
});

test('trava (#143): a autorização com documento trava também a mídia; o documento segue interno', async () => {
  const banco = new BancoFalso(UNICOS);
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    const { aut, midia, imovel } = await base(chamar);
    await chamar('PATCH', `/imoveis/${imovel}/midias/${midia}`, { publica: true });
    const r = await corrida(
      banco,
      'autorizacoes_venda',
      aut,
      () => chamar('PATCH', `/autorizacoes/${aut}`, { documento_midia_id: midia, situacao: 'assinada' }),
      () => chamar('PATCH', `/autorizacoes/${aut}`, { situacao: 'revogada' }),
    );
    assert.ok(r.esperou);
    assert.equal(r.a.status, 200, JSON.stringify(r.a.corpo));
    assert.deepEqual([r.b.status, r.b.corpo.codigo], [409, 'AUTORIZACAO_ALTERADA']);
    const salva = banco.linhas('autorizacoes_venda').find((x) => x.id === aut)!;
    assert.equal(salva.situacao, 'assinada');
    const doc = banco.linhas('imovel_midias').find((x) => x.id === midia)!;
    assert.deepEqual([doc.tipo, doc.publica], ['documento', false]);
  });
});

test('trava (#143): duas edições simultâneas da mídia (tipo e pública) — a segunda espera, vê a mudança e responde 409', async () => {
  const banco = new BancoFalso(UNICOS);
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    const { imovel, midia } = await base(chamar);
    const r = await corrida(
      banco,
      'imovel_midias',
      midia,
      () => chamar('PATCH', `/imoveis/${imovel}/midias/${midia}`, { tipo: 'planta', publica: true }),
      () => chamar('PATCH', `/imoveis/${imovel}/midias/${midia}`, { publica: false }),
    );
    assert.ok(r.esperou, 'a segunda PATCH esperou a trava da mídia');
    assert.equal(r.a.status, 200, JSON.stringify(r.a.corpo));
    assert.deepEqual([r.b.status, r.b.corpo.codigo], [409, 'MIDIA_ALTERADA'], JSON.stringify(r.b.corpo));
    const salva = banco.linhas('imovel_midias').find((x) => x.id === midia)!;
    assert.deepEqual([salva.tipo, salva.publica], ['planta', true], 'a segunda não sobrescreveu a primeira');
    // Sequencial, passa.
    assert.equal((await chamar('PATCH', `/imoveis/${imovel}/midias/${midia}`, { publica: false })).status, 200);
    assert.equal((await chamar('PATCH', `/imoveis/${imovel}/midias/${midia}`, { tipo: 'foto' })).status, 200);
  });
});

test('trava (#143): mídia virando documento de autorização enquanto alguém a deixa pública — fica interna', async () => {
  const banco = new BancoFalso(UNICOS);
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    const { imovel, midia, aut } = await base(chamar);
    // A autorização trava a mídia primeiro (ordem: autorização, depois mídia); a PATCH da mídia espera.
    const r = await corrida(
      banco,
      'imovel_midias',
      midia,
      () => chamar('PATCH', `/autorizacoes/${aut}`, { documento_midia_id: midia }),
      () => chamar('PATCH', `/imoveis/${imovel}/midias/${midia}`, { publica: true }),
    );
    assert.ok(r.esperou);
    assert.equal(r.a.status, 200, JSON.stringify(r.a.corpo));
    assert.equal(r.b.status, 409, JSON.stringify(r.b.corpo));
    const doc = banco.linhas('imovel_midias').find((x) => x.id === midia)!;
    assert.deepEqual([doc.tipo, doc.publica], ['documento', false]);
  });
});

test('trava (#143), isolamento A × B: as duas PATCH com ids de outra conta respondem 404 e nada muda', async () => {
  const banco = new BancoFalso(UNICOS);
  const a = await comServidor(rotas, A, banco, {}, (chamar) => base(chamar));
  const antes = JSON.stringify(banco.linhas('imovel_midias').find((x) => x.id === a.midia));
  await comServidor(rotas, B, banco, {}, async (chamar) => {
    assert.equal((await chamar('PATCH', `/autorizacoes/${a.aut}`, { comissao_pct: 9 })).status, 404);
    assert.equal((await chamar('PATCH', `/imoveis/${a.imovel}/midias/${a.midia}`, { publica: false })).status, 404);
    // B com o próprio imóvel e a mídia do A no caminho: também 404.
    const meu = (await chamar('POST', '/imoveis', { tipo: 'sala', cidade: 'Brasília' })).corpo.id;
    assert.equal((await chamar('PATCH', `/imoveis/${meu}/midias/${a.midia}`, { tipo: 'planta' })).status, 404);
  });
  assert.equal(Number(banco.linhas('autorizacoes_venda').find((x) => x.id === a.aut)!.comissao_pct), 5);
  assert.equal(JSON.stringify(banco.linhas('imovel_midias').find((x) => x.id === a.midia)), antes, 'a mídia do A não mudou');
});
