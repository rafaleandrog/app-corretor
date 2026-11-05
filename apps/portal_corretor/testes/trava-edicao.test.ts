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

// --- Sobras da revisão do #152 (issue #157) -------------------------------------------------------------

test('trava (#157): PATCH vazia da mídia repara o documento público legado (fica interno)', async () => {
  const banco = new BancoFalso(UNICOS);
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    const { imovel, midia } = await base(chamar);
    // Documento que ficou público antes da regra: só por fora da rota se chega a este estado.
    await banco.dados(100).atualizar('imovel_midias', midia, { tipo: 'documento', publica: true });
    const r = await chamar('PATCH', `/imoveis/${imovel}/midias/${midia}`, {});
    assert.equal(r.status, 200, JSON.stringify(r.corpo));
    assert.deepEqual([r.corpo.tipo, r.corpo.publica], ['documento', false]);
    const doc = banco.linhas('imovel_midias').find((x) => x.id === midia)!;
    assert.deepEqual([doc.tipo, doc.publica], ['documento', false]);
    // A legenda (ou qualquer outro campo) também repara, e a PATCH vazia de uma foto não mexe em nada.
    await banco.dados(100).atualizar('imovel_midias', midia, { publica: true });
    assert.equal((await chamar('PATCH', `/imoveis/${imovel}/midias/${midia}`, { legenda: 'Matrícula' })).corpo.publica, false);
    const foto = (await chamar('POST', `/imoveis/${imovel}/midias`, { upload_id: 6 })).corpo;
    const antes = JSON.stringify(banco.linhas('imovel_midias').find((x) => x.id === foto.id));
    assert.equal((await chamar('PATCH', `/imoveis/${imovel}/midias/${foto.id}`, {})).status, 200);
    assert.equal(JSON.stringify(banco.linhas('imovel_midias').find((x) => x.id === foto.id)), antes);
  });
});

test('trava (#157): a comparação é por campo — chave a mais da leitura, ordem das chaves e data como Date não dão 409', async () => {
  const banco = new BancoFalso(UNICOS);
  const { relerSemMudanca } = await import('../backend/imoveis');
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    const { midia } = await base(chamar);
    const linha = banco.linhas('imovel_midias').find((x) => x.id === midia)!;
    // Como a rota a leria com um `campos_incluir` (chave a mais), as chaves em outra ordem e a data como Date.
    const lida: Record<string, unknown> = { imovel_titulo: 'Casa', ...Object.fromEntries(Object.entries(linha).reverse()) };
    lida.atualizado_em = new Date(String(linha.atualizado_em));
    const viva = await banco.dados(100).transaction((trx: any) => relerSemMudanca(trx, 'imovel_midias', lida));
    assert.equal(typeof viva, 'object', 'não é "mudou"');
    // Uma coluna gravada que difere, sim.
    const mudou = await banco.dados(100).transaction((trx: any) => relerSemMudanca(trx, 'imovel_midias', { ...lida, legenda: 'outra' }));
    assert.equal(mudou, 'mudou');
  });
});

test('trava (#157): a mídia apagada enquanto a PATCH esperava a trava responde 404 (não 409 nem 500)', async () => {
  const banco = new BancoFalso(UNICOS);
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    const { imovel, midia } = await base(chamar);
    const r = await corrida(
      banco,
      'imovel_midias',
      midia,
      () => chamar('PATCH', `/imoveis/${imovel}/midias/${midia}/remover`, {}),
      () => chamar('PATCH', `/imoveis/${imovel}/midias/${midia}`, { legenda: 'Sala' }),
    );
    assert.ok(r.esperou);
    assert.equal(r.a.status, 200, JSON.stringify(r.a.corpo));
    assert.deepEqual([r.b.status, r.b.corpo.codigo], [404, 'NAO_ENCONTRADO'], JSON.stringify(r.b.corpo));
    assert.equal(banco.linhas('imovel_midias').some((x) => x.id === midia), false);
  });
});

test('trava (#157): a autorização apagada entre a leitura e a trava responde 404', async () => {
  const banco = new BancoFalso(UNICOS);
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    const { aut } = await base(chamar);
    const travar = (banco as any).travar.bind(banco);
    (banco as any).travar = async (chave: string, minhas: Set<string>) => {
      if (chave === `autorizacoes_venda:${aut}`) await banco.dados(100).deletar('autorizacoes_venda', aut);
      return travar(chave, minhas);
    };
    const r = await chamar('PATCH', `/autorizacoes/${aut}`, { comissao_pct: 7 });
    assert.deepEqual([r.status, r.corpo.codigo], [404, 'NAO_ENCONTRADO'], JSON.stringify(r.corpo));
  });
});

test('trava (#157), A × B: documento_midia_id de outra conta é recusado (422) e a mídia de B não muda', async () => {
  const banco = new BancoFalso(UNICOS);
  const b = await comServidor(rotas, B, banco, {}, async (chamar) => {
    const imovel = (await chamar('POST', '/imoveis', { tipo: 'sala', cidade: 'Brasília' })).corpo.id as number;
    const midia = (await chamar('POST', `/imoveis/${imovel}/midias`, { upload_id: 9 })).corpo.id as number;
    return { imovel, midia };
  });
  const antes = JSON.stringify(banco.linhas('imovel_midias').find((x) => x.id === b.midia));
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    const { aut } = await base(chamar);
    const r = await chamar('PATCH', `/autorizacoes/${aut}`, { documento_midia_id: b.midia, situacao: 'assinada' });
    assert.deepEqual([r.status, r.corpo.codigo], [422, 'DADOS_INVALIDOS'], JSON.stringify(r.corpo));
    const salva = banco.linhas('autorizacoes_venda').find((x) => x.id === aut)!;
    assert.deepEqual([salva.documento_midia_id ?? null, salva.situacao], [null, 'rascunho']);
  });
  assert.equal(JSON.stringify(banco.linhas('imovel_midias').find((x) => x.id === b.midia)), antes, 'a mídia de B não virou documento');
});
