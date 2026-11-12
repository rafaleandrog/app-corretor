import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Request, Response } from 'express';
import { rotas, rotasPublicas } from '../backend/rotas';
import { assincrono } from '../backend/acesso';
import { validarEtapas } from '../comum/crm';
import { validarAutorizacao } from '../comum/imoveis';
import { BancoFalso, comServidor, type Ator } from './apoio';

// Correções do QA de 12/11: issues #232, #233 e #234 e as observações da revisão do #235.

const UNICOS = { contatos: ['telefone'], imoveis: ['codigo'], visitas: ['atividade_id'], etapas_funil: ['pipeline+nome'], origens: ['canal+campanha'], vitrine_publica: ['tipo+chave'], selecao_itens: ['selecao_id+imovel_id'], playbook_funil: ['etapa_id+temperatura'] };
const arquivos = { url: async (arquivo: number) => `/arquivo/${arquivo}` };
const A: Ator = { usuario: 1, conta: 100, papeis: ['corretor'], extras: { arquivos } };
const VISITANTE: Ator = { usuario: 0, conta: null, papeis: [], extras: { arquivos } };
const HOJE = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
const dia = (delta: number) => new Date(Date.now() + delta * 86400e3).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
type Chamar = (m: string, c: string, b?: unknown) => Promise<{ status: number; corpo: any }>;

test('revisão #235: rede de segurança 22xxx vira 422; outro erro segue para o tratador', async () => {
  const chamar = async (code: string) => {
    let status = 0;
    let corpo: any = null;
    let seguiu: unknown = null;
    const res = { status: (s: number) => ((status = s), res), json: (c: unknown) => ((corpo = c), res) } as unknown as Response;
    await new Promise<void>((ok) => {
      assincrono(async () => {
        throw Object.assign(new Error('pg'), { code });
      })({} as Request, { ...res, status: (s: number) => ((status = s), ok(), res) } as unknown as Response, (e) => ((seguiu = e), ok()));
    });
    return { status, corpo, seguiu };
  };
  for (const code of ['22003', '22007', '22008', '22021', '22P02']) assert.equal((await chamar(code)).status, 422, code);
  const outro = await chamar('XX000');
  assert.ok(outro.seguiu, 'erro desconhecido não vira 422');
});

test('revisão #235: rota pública com byte nulo na query responde 404; id de etapa só número ou dígitos', async () => {
  const banco = new BancoFalso(UNICOS);
  await comServidor(rotasPublicas, VISITANTE, banco, {}, async (chamar) => {
    const r = await chamar('GET', '/vitrine/pagina?c=%00');
    assert.deepEqual([r.status, r.corpo.codigo], [404, 'NAO_ENCONTRADO']);
    assert.equal((await chamar('GET', '/vitrine/imovel?c=x&i=%00')).status, 404);
  });
  const base = [
    { nome: 'Novo', tipo: 'aberta', probabilidade: 0.1 },
    { nome: 'Ganho', tipo: 'ganha', probabilidade: 1 },
    { nome: 'Perdido', tipo: 'perdida', probabilidade: 0 },
  ];
  for (const id of [true, '1e2', [5], 1.5, '-1']) assert.equal(validarEtapas('compra', [{ ...base[0], id }, base[1], base[2]]).ok, false, JSON.stringify(id));
  for (const id of [7, '7']) {
    const v = validarEtapas('compra', [{ ...base[0], id }, base[1], base[2]]);
    assert.ok(v.ok && v.dados[0].id === 7, JSON.stringify(id));
  }
});

test('#233: nota longa inteira, contato sempre com meio de contato, importado com temperatura', async () => {
  const banco = new BancoFalso(UNICOS);
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    const c = (await chamar('POST', '/contatos', { nome: 'qa-nota', telefone: '61990001001' })).corpo;
    const longa = 'x'.repeat(1000);
    assert.equal((await chamar('POST', `/contatos/${c.id}/notas`, { texto: longa })).status, 201);
    const nota = banco.linhas('linha_do_tempo').find((l) => l.tipo === 'contato.nota')!;
    assert.equal(nota.dados.texto, longa, 'texto inteiro guardado');
    assert.ok(nota.resumo.length <= 300 && nota.resumo.endsWith('…'));
    assert.equal((await chamar('POST', `/contatos/${c.id}/notas`, { texto: 'y'.repeat(5001) })).status, 422);

    // Edição não deixa sem telefone e sem e-mail; mexer só no nome continua valendo.
    assert.equal((await chamar('PATCH', `/contatos/${c.id}`, { telefone: '', email: '' })).status, 422);
    assert.equal((await chamar('PATCH', `/contatos/${c.id}`, { email: 'qa@exemplo.com' })).status, 200);
    assert.equal((await chamar('PATCH', `/contatos/${c.id}`, { telefone: '' })).status, 200, 'fica o e-mail');
    assert.equal((await chamar('PATCH', `/contatos/${c.id}`, { nome: 'qa-nota 2' })).status, 200);

    // Importado sem temperatura ganha a da regra.
    const r = await chamar('POST', '/contatos/importar', { linhas: [{ nome: 'qa-imp', telefone: '61990001002' }], modo: 'pular' });
    assert.equal(r.corpo.criados, 1);
    const importado = banco.linhas('contatos').find((x) => x.nome === 'qa-imp')!;
    assert.ok(importado.temperatura, 'temperatura gravada');
    assert.equal(importado.temperatura_autor, 'regra');
  });
});

test('#233: funil e visita recusam ou tratam o que antes era ignorado; playbook por temperatura', async () => {
  const banco = new BancoFalso(UNICOS);
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    await chamar('POST', '/funil/preparar', {});
    const c = (await chamar('POST', '/contatos', { nome: 'qa-funil', telefone: '61990001003' })).corpo;
    assert.equal((await chamar('POST', '/negocios', { contato_id: c.id, pipeline: 'xyz' })).status, 422);
    const n = (await chamar('POST', '/negocios', { contato_id: c.id })).corpo;
    assert.equal((await chamar('PATCH', `/negocios/${n.id}`, { etapa_id: 2147483648 })).status, 422);
    assert.equal((await chamar('PATCH', `/negocios/${n.id}`, { etapa_id: 'abc' })).status, 422);

    // Visita sem imóvel: o retorno vai à linha do tempo e a visita fica feita.
    const v = (await chamar('POST', '/atividades', { tipo: 'visita', contato_id: c.id, titulo: 'qa-visita', quando: new Date(Date.now() + 86400e3).toISOString() })).corpo;
    const fb = await chamar('POST', `/visitas/${v.id}/feedback`, { nota: 4, texto: 'gostou' });
    assert.equal(fb.status, 200, JSON.stringify(fb.corpo));
    assert.equal(fb.corpo.sem_imovel, true);
    assert.equal(banco.linhas('atividades').find((a) => a.id === v.id)!.status, 'feita');
    assert.ok(banco.linhas('linha_do_tempo').some((l) => l.tipo === 'visita.feedback' && /gostou/.test(l.resumo)));

    // Etapa nova: uma abordagem não tira a etapa da lista enquanto faltar temperatura.
    const etapas = (await chamar('GET', '/funil/etapas?pipeline=compra')).corpo.etapas;
    const salvo = await chamar('PUT', '/funil/etapas/compra', { etapas: [...etapas.filter((e: any) => e.tipo === 'aberta'), { nome: 'qa-etapa', tipo: 'aberta', probabilidade: 0.3 }, ...etapas.filter((e: any) => e.tipo !== 'aberta')] });
    assert.equal(salvo.status, 200, JSON.stringify(salvo.corpo));
    const nova = salvo.corpo.etapas.find((e: any) => e.nome === 'qa-etapa');
    const r = await chamar('POST', '/funil/playbook', { etapa_id: nova.id, temperatura: 'morno', abordagem: 'qa', canal_sugerido: 'whatsapp', prazo_horas: 24 });
    assert.equal(r.status, 201, JSON.stringify(r.corpo));
    const pb = (await chamar('GET', '/funil/playbook')).corpo;
    const ainda = pb.etapas_sem_abordagem.find((e: any) => e.id === nova.id);
    assert.ok(ainda, 'etapa segue oferecida');
    assert.deepEqual([...ainda.temperaturas_faltando].sort(), ['frio', 'quente']);
  });
});

test('#233: autorização com ano fora de 1900–2100 e preço acima do teto dizem o porquê', () => {
  const base = { proprietario_id: 1, comissao_pct: 5, preco_autorizado: 900000, inicio: '2026-01-01', fim: '2027-01-01' };
  for (const [campo, valor] of [['inicio', '0001-01-01'], ['fim', '9999-12-31']] as const) {
    const v = validarAutorizacao({ ...base, [campo]: valor });
    assert.equal(v.ok, false, valor);
  }
  const caro = validarAutorizacao({ ...base, preco_autorizado: 30000000 });
  assert.ok(!caro.ok && caro.erros.some((e) => /Preço autorizado inválido/.test(e)));
  const vazio = validarAutorizacao({ ...base, preco_autorizado: '' });
  assert.ok(!vazio.ok && vazio.erros.includes('Informe o preço autorizado.'));
});

async function imovelAnunciado(chamar: Chamar) {
  const im = (await chamar('POST', '/imoveis', { tipo: 'apartamento', cidade: 'Brasília', bairro: 'Noroeste', titulo: 'qa-sel', endereco_publico: 'bairro' })).corpo;
  await chamar('PATCH', `/imoveis/${im.id}`, { preco: 990000 });
  const dono = (await chamar('POST', '/contatos', { nome: 'qa-dono', telefone: '61990001004' })).corpo;
  const aut = (await chamar('POST', '/autorizacoes', { imovel_id: im.id, proprietario_id: dono.id, inicio: HOJE, fim: dia(60), comissao_pct: '5', preco_autorizado: '990.000' })).corpo;
  await chamar('POST', `/imoveis/${im.id}/midias`, { upload_id: 801, tipo: 'foto' });
  const doc = (await chamar('POST', `/imoveis/${im.id}/midias`, { upload_id: 802, tipo: 'documento' })).corpo;
  await chamar('PATCH', `/autorizacoes/${aut.id}`, { documento_midia_id: doc.id, situacao: 'assinada' });
  await chamar('PATCH', `/imoveis/${im.id}`, { situacao: 'ativo' });
  return im;
}

test('#234: item da seleção cuja autorização venceu sem edição sai da leitura pública', async () => {
  const banco = new BancoFalso(UNICOS);
  let n = 0;
  const ingressos = new Map<string, any>();
  const shell = {
    gerarIngressoWh: async ({ webhook, contexto }: { webhook: string; contexto: any }) => {
      const token = `wh_${webhook}_${++n}x`;
      ingressos.set(token, { webhook, contexto });
      return { url: `https://c.exemplo/api/wh/portal_corretor/${token}`, token, ingresso_id: n, expira_em: null };
    },
    inspecionarIngressoWh: async ({ token }: { token: string }) => ({ ingresso_id: 1, contexto: ingressos.get(token).contexto, expira_em: null, contador_usos: 0 }),
    revogarIngressoWh: async () => ({ revogado: true }),
  };
  let token = '';
  await comServidor(rotas, A, banco, shell, async (chamar) => {
    const im = await imovelAnunciado(chamar);
    const cliente = (await chamar('POST', '/contatos', { nome: 'qa-cliente', telefone: '61990001005' })).corpo;
    const r = await chamar('POST', '/selecoes', { contato_id: cliente.id, imovel_ids: [im.id] });
    assert.equal(r.status, 201, JSON.stringify(r.corpo));
    token = new URL(r.corpo.link).searchParams.get('t')!;
  });
  const linha = banco.linhas('vitrine_publica').find((l) => l.tipo === 'selecao')!;
  assert.equal(linha.dados.itens[0].vigente_ate, dia(60), 'prazo gravado no item');
  await comServidor(rotasPublicas, VISITANTE, banco, shell, async (chamar) => {
    const antes = (await chamar('GET', `/vitrine/selecao?t=${token}`)).corpo.selecao;
    assert.equal(antes.itens.length, 1);
    assert.ok(!('vigente_ate' in antes.itens[0]), 'o prazo não vai ao visitante');
    linha.dados.itens[0].vigente_ate = dia(-1); // a autorização venceu ontem, ninguém editou nada
    assert.equal((await chamar('GET', `/vitrine/selecao?t=${token}`)).corpo.selecao.itens.length, 0);
  });
});

test('#232: "Publiquei por fora" recusa peça em rascunho', async () => {
  const banco = new BancoFalso(UNICOS);
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    const im = (await chamar('POST', '/imoveis', { tipo: 'apartamento', cidade: 'Brasília', titulo: 'qa-peca' })).corpo;
    const pedido = await chamar('POST', '/estudio/pedido', { imovel_id: im.id, objetivo: 'novo_imovel', formatos: ['post_1x1'] });
    assert.equal(pedido.status, 201, JSON.stringify(pedido.corpo));
    const peca = pedido.corpo.pecas[0];
    const r = await chamar('POST', `/estudio/pecas/${peca.id}/publicada-fora`, {});
    assert.deepEqual([r.status, r.corpo.codigo], [409, 'ESTADO_INVALIDO']);
    assert.equal(banco.linhas('pecas').find((p) => p.id === peca.id)!.estado, 'rascunho');
  });
});
