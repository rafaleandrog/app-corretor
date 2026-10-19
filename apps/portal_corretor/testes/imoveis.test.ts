import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rotas } from '../backend/rotas';
import {
  autorizacaoVigente,
  contextoDescricao,
  podeGerarDescricao,
  proximoCodigo,
  qualidadeAnuncio,
  situacaoAutorizacao,
  sugerirOrdem,
  validarImovel,
} from '../comum/imoveis';
import { BancoFalso, comServidor, type Ator } from './apoio';

const UNICOS = { contatos: ['telefone'], imoveis: ['codigo'], empreendimentos: ['nome'], visitas: ['atividade_id'], etapas_funil: ['pipeline+nome'] };
const arquivos = { url: async (arquivo: number) => `/arquivo/${arquivo}` };
const iaLigada = (resposta: Record<string, unknown> = {}, captura: { contexto?: string } = {}) => ({
  estadoSlot: async (slot: string) => ({ pedido: slot, efetivo: { slot, origem: 'global' }, backup: null }),
  extrairConteudo: async () => ({ conteudo: { ambiente: 'fachada', nota: 9, legenda: 'Fachada com jardim' } }),
  consultar: async (o: { contexto: string }) => {
    captura.contexto = o.contexto;
    return { dados: { titulo: 'Casa com jardim', descricao: 'x'.repeat(600), destaques: ['Jardim'], ...resposta } };
  },
});
const iaDesligada = { estadoSlot: async (slot: string) => ({ pedido: slot, efetivo: null, backup: null }) };
const A: Ator = { usuario: 1, conta: 100, papeis: ['corretor'], extras: { arquivos, ia: iaLigada() } };
const B: Ator = { usuario: 2, conta: 200, papeis: ['corretor'], extras: { arquivos } };
const HOJE = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
const dia = (delta: number) => new Date(Date.now() + delta * 86400e3).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });

test('regras puras: código, valores, qualidade, autorização, ordem e descrição', () => {
  assert.equal(proximoCodigo([]), 'IM-0001');
  assert.equal(proximoCodigo(['IM-0009', 'X-3', 'IM-0002']), 'IM-0010');
  const v = validarImovel({ tipo: 'casa', cidade: 'Brasília', preco: '850.000,00', area_util_m2: '120,5', quartos: '3', caracteristicas: 'piscina, churrasqueira, piscina' });
  assert.ok(v.ok);
  if (v.ok) {
    assert.equal(v.dados.preco_c, 85000000);
    assert.equal(v.dados.area_util_m2, 120.5);
    assert.equal(v.dados.quartos, 3);
    assert.equal(v.dados.caracteristicas, 'piscina, churrasqueira');
  }
  assert.equal(validarImovel({ tipo: 'nave', cidade: 'x' }).ok, false);
  assert.equal(validarImovel({ tipo: 'casa' }).ok, false, 'cidade é obrigatória no cadastro');
  assert.equal(validarImovel({ quartos: 2.5 }, true).ok, false);

  const completo = { tipo: 'apartamento', descricao: 'd'.repeat(400), preco_c: 1, area_util_m2: 80, quartos: 2, banheiros: 1, bairro: 'Asa Sul', cidade: 'Brasília' };
  assert.deepEqual(qualidadeAnuncio(completo, { fotosPublicas: 8, autorizacaoVigente: true, creci: true }), { nota: 100, faltas: [] });
  const q = qualidadeAnuncio({ ...completo, quartos: null }, { fotosPublicas: 3, autorizacaoVigente: false, creci: true });
  assert.equal(q.nota, 100 - 25 - 10 - 15);
  assert.equal(q.faltas[0], 'Pelo menos 8 fotos públicas (tem 3)');
  // Lote não precisa de quartos.
  assert.equal(qualidadeAnuncio({ ...completo, tipo: 'lote', quartos: null, banheiros: null }, { fotosPublicas: 8, autorizacaoVigente: true, creci: true }).nota, 100);

  const aut = { situacao: 'assinada', inicio: '2026-01-01', fim: '2026-06-30', documento_midia_id: 5 };
  assert.equal(autorizacaoVigente(aut, '2026-03-01'), true);
  assert.equal(autorizacaoVigente({ ...aut, documento_midia_id: null }, '2026-03-01'), false);
  assert.equal(autorizacaoVigente(aut, '2026-07-01'), false);
  assert.equal(situacaoAutorizacao(aut, '2026-07-01'), 'vencida');
  assert.equal(situacaoAutorizacao(aut, '2026-06-30'), 'assinada');

  const m = (id: number, tipo: string, ordem: number, amb: string | null, nota: number | null) => ({ id, tipo, ordem, ia_ambiente: amb, ia_nota: nota });
  assert.deepEqual(
    sugerirOrdem([m(1, 'foto', 0, 'quarto', 9), m(2, 'foto', 1, 'fachada', 6), m(3, 'foto', 2, 'sala', 8), m(4, 'documento', 3, null, null), m(5, 'foto', 4, null, null), m(6, 'foto', 5, 'quarto', 4)]),
    [3, 2, 1, 6, 5, 4],
  );

  assert.match(podeGerarDescricao({ tipo: 'casa', area_util_m2: null, area_total_m2: null }) ?? '', /área/);
  assert.equal(podeGerarDescricao({ tipo: 'casa', area_util_m2: 90 }), null);
  const ctx = contextoDescricao({ tipo: 'casa', bairro: 'Lago Sul', cidade: 'Brasília', endereco: { logradouro: 'SHIS QI 9' }, proprietario_nome: 'Fulano', area_util_m2: 300 }, ['fachada']);
  assert.ok(ctx.includes('Lago Sul') && !ctx.includes('SHIS') && !ctx.includes('Fulano'));
});

test('cadastro: código automático, código próprio único, proprietário ganha o papel', async () => {
  const banco = new BancoFalso(UNICOS);
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    const um = await chamar('POST', '/imoveis', { tipo: 'casa', cidade: 'Brasília', bairro: 'Lago Sul' });
    assert.equal(um.status, 201);
    assert.equal(um.corpo.codigo, 'IM-0001');
    assert.equal(um.corpo.situacao, 'rascunho');
    assert.equal((await chamar('POST', '/imoveis', { tipo: 'apartamento', cidade: 'Brasília' })).corpo.codigo, 'IM-0002');
    assert.equal((await chamar('POST', '/imoveis', { tipo: 'lote', cidade: 'Brasília', codigo: 'lt-7' })).corpo.codigo, 'LT-7');
    assert.equal((await chamar('POST', '/imoveis', { tipo: 'lote', cidade: 'Brasília', codigo: 'LT-7' })).status, 409);
    const dono = (await chamar('POST', '/contatos', { nome: 'Dona Rosa', telefone: '61988887777' })).corpo;
    assert.equal((await chamar('PATCH', `/imoveis/${um.corpo.id}`, { proprietario_id: dono.id, preco: '1.200.000' })).status, 200);
    assert.equal(banco.linhas('contatos')[0].papeis, 'comprador,proprietario');
    assert.equal(banco.linhas('imoveis')[0].preco_c, 120000000);
    const lista = await chamar('GET', '/imoveis?busca=lago');
    assert.equal(lista.corpo.total, 1);
    assert.equal(lista.corpo.dados[0].qualidade.nota, 10 + 15, 'localização + preço');
  });
});

test('anúncio só com autorização assinada, com documento e vigente', async () => {
  const banco = new BancoFalso(UNICOS);
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    const im = (await chamar('POST', '/imoveis', { tipo: 'casa', cidade: 'Brasília' })).corpo;
    const dono = (await chamar('POST', '/contatos', { nome: 'Seu Zé', telefone: '61977776666' })).corpo;
    assert.equal((await chamar('PATCH', `/imoveis/${im.id}`, { publicado_pagina: true })).corpo.codigo, 'SEM_AUTORIZACAO');
    assert.equal((await chamar('PATCH', `/imoveis/${im.id}`, { situacao: 'ativo' })).status, 409);
    assert.equal((await chamar('POST', '/autorizacoes', { imovel_id: im.id, inicio: HOJE, fim: dia(90), comissao_pct: 5, preco_autorizado: 900000 })).status, 422, 'sem proprietário');
    const aut = await chamar('POST', '/autorizacoes', { imovel_id: im.id, proprietario_id: dono.id, inicio: HOJE, fim: dia(90), comissao_pct: '5', preco_autorizado: '900.000', exclusiva: true });
    assert.equal(aut.status, 201);
    assert.equal(aut.corpo.situacao, 'rascunho');
    assert.equal((await chamar('PATCH', `/autorizacoes/${aut.corpo.id}`, { situacao: 'assinada' })).corpo.codigo, 'DOCUMENTO_OBRIGATORIO');
    const doc = (await chamar('POST', `/imoveis/${im.id}/midias`, { upload_id: 77, tipo: 'foto' })).corpo;
    assert.equal(doc.url, '/arquivo/77');
    const assinada = await chamar('PATCH', `/autorizacoes/${aut.corpo.id}`, { documento_midia_id: doc.id, situacao: 'assinada' });
    assert.equal(assinada.status, 200);
    const midia = banco.linhas('imovel_midias')[0];
    assert.deepEqual([midia.tipo, midia.publica], ['documento', false], 'documento nunca fica público');
    assert.equal((await chamar('PATCH', `/imoveis/${im.id}`, { situacao: 'ativo', publicado_pagina: true })).status, 200);
    let ficha = (await chamar('GET', `/imoveis/${im.id}`)).corpo;
    assert.equal(ficha.publicavel, true);
    assert.equal(ficha.autorizacoes[0].vigente, true);
    assert.equal(banco.linhas('imoveis')[0].proprietario_id, dono.id, 'a autorização preenche o proprietário');
    assert.equal((await chamar('PATCH', `/imoveis/${im.id}/midias/${doc.id}/remover`)).status, 409, 'documento de autorização assinada');
    // Vencida: continua assinada no banco, aparece vencida e o anúncio deixa de ser publicável.
    banco.linhas('autorizacoes_venda')[0].fim = dia(-1);
    banco.linhas('autorizacoes_venda')[0].inicio = dia(-100);
    ficha = (await chamar('GET', `/imoveis/${im.id}`)).corpo;
    assert.equal(ficha.autorizacoes[0].situacao_efetiva, 'vencida');
    assert.equal(ficha.publicavel, false);
    assert.equal((await chamar('PATCH', `/autorizacoes/${aut.corpo.id}`, { inicio: dia(10), fim: dia(5) })).status, 422);
  });
});

test('mídias: ordem, ordem sugerida pela leitura da IA, legenda e remoção', async () => {
  const banco = new BancoFalso(UNICOS);
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    const im = (await chamar('POST', '/imoveis', { tipo: 'casa', cidade: 'Brasília' })).corpo;
    const ids: number[] = [];
    for (const u of [11, 12, 13]) ids.push((await chamar('POST', `/imoveis/${im.id}/midias`, { upload_id: u })).corpo.id);
    assert.deepEqual(banco.linhas('imovel_midias').map((m) => m.ordem), [0, 1, 2]);
    assert.equal((await chamar('POST', `/imoveis/${im.id}/midias`, {})).status, 422);
    assert.equal((await chamar('PUT', `/imoveis/${im.id}/midias/ordem`, { ids: [ids[0], ids[1]] })).status, 422, 'todas, uma vez cada');
    assert.equal((await chamar('PUT', `/imoveis/${im.id}/midias/ordem`, { ids: [ids[2], ids[0], ids[1]] })).status, 200);
    assert.deepEqual(banco.linhas('imovel_midias').map((m) => m.ordem), [1, 2, 0]);
    // Leitura da foto: preenche ambiente, nota e a legenda vazia — nunca troca a do corretor.
    await chamar('PATCH', `/imoveis/${im.id}/midias/${ids[1]}`, { legenda: 'Minha legenda' });
    const lida = await chamar('POST', `/imoveis/${im.id}/midias/${ids[1]}/analisar`);
    assert.equal(lida.corpo.ia_ambiente, 'fachada');
    assert.equal(lida.corpo.legenda, 'Minha legenda');
    assert.equal((await chamar('POST', `/imoveis/${im.id}/midias/${ids[0]}/analisar`)).corpo.legenda, 'Fachada com jardim');
    banco.linhas('imovel_midias')[0].ia_nota = 3;
    const sugerida = await chamar('POST', `/imoveis/${im.id}/midias/ordem-sugerida`);
    assert.deepEqual(sugerida.corpo.ids, [ids[1], ids[0], ids[2]]);
    assert.equal((await chamar('PATCH', `/imoveis/${im.id}/midias/${ids[2]}/remover`)).status, 200);
    assert.equal(banco.linhas('imovel_midias').length, 2);
    const ficha = (await chamar('GET', `/imoveis/${im.id}`)).corpo;
    assert.equal(ficha.fotos_publicas, 2);
    assert.deepEqual(ficha.midias.map((m: any) => m.url), ['/arquivo/12', '/arquivo/11']);
  });
});

test('IA: descrição só com tipo e área, sem dados do proprietário; indisponível vira 503', async () => {
  const banco = new BancoFalso(UNICOS);
  const captura: { contexto?: string } = {};
  const comIa: Ator = { ...A, extras: { arquivos, ia: iaLigada({}, captura) } };
  let imId = 0;
  await comServidor(rotas, comIa, banco, {}, async (chamar) => {
    const dono = (await chamar('POST', '/contatos', { nome: 'Proprietária Secreta', telefone: '61966665555' })).corpo;
    imId = (await chamar('POST', '/imoveis', { tipo: 'casa', cidade: 'Brasília', bairro: 'Park Way' })).corpo.id;
    await chamar('PATCH', `/imoveis/${imId}`, { proprietario_id: dono.id });
    assert.equal((await chamar('POST', `/imoveis/${imId}/descricao`)).corpo.codigo, 'DADOS_INSUFICIENTES');
    await chamar('PATCH', `/imoveis/${imId}`, { area_total_m2: 2500, endereco: { logradouro: 'Quadra 26 conjunto 3' } });
    const r = await chamar('POST', `/imoveis/${imId}/descricao`);
    assert.equal(r.status, 200);
    assert.equal(r.corpo.titulo, 'Casa com jardim');
    assert.equal(banco.linhas('imoveis')[0].descricao ?? null, null, 'sugestão não grava');
    assert.ok(captura.contexto!.includes('Park Way'));
    assert.ok(!captura.contexto!.includes('Secreta') && !captura.contexto!.includes('Quadra 26'));
    assert.deepEqual((await chamar('GET', '/imoveis/ia')).corpo, { fotos: true, conteudo: true });
  });
  await comServidor(rotas, { ...A, extras: { arquivos, ia: iaDesligada } }, banco, {}, async (chamar) => {
    assert.equal((await chamar('POST', `/imoveis/${imId}/descricao`)).status, 503);
    assert.deepEqual((await chamar('GET', '/imoveis/ia')).corpo, { fotos: false, conteudo: false });
  });
  await comServidor(rotas, { ...A, extras: { arquivos } }, banco, {}, async (chamar) => {
    assert.equal((await chamar('GET', '/imoveis/ia')).corpo.fotos, false, 'sem req.ia');
  });
});

test('empreendimentos: cadastro, materiais, imóveis ligados e remoção protegida', async () => {
  const banco = new BancoFalso(UNICOS);
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    const e = await chamar('POST', '/empreendimentos', { nome: 'Residencial Ipê', construtora: 'Alfa', fase: 'obras', preco_min: '450.000', preco_max: '780.000' });
    assert.equal(e.status, 201);
    assert.equal(e.corpo.preco_min_c, 45000000);
    assert.equal((await chamar('POST', '/empreendimentos', { nome: 'Residencial Ipê' })).status, 409);
    assert.equal((await chamar('POST', '/empreendimentos', { nome: 'X', preco_min: 10, preco_max: 5 })).status, 422);
    const mat = await chamar('POST', `/empreendimentos/${e.corpo.id}/materiais`, { upload_id: 90, titulo: 'Tabela de preços', tipo: 'tabela' });
    assert.equal(mat.status, 201);
    const im = (await chamar('POST', '/imoveis', { tipo: 'apartamento', cidade: 'Brasília' })).corpo;
    assert.equal((await chamar('PATCH', `/imoveis/${im.id}`, { empreendimento_id: e.corpo.id })).status, 200);
    const ficha = (await chamar('GET', `/empreendimentos/${e.corpo.id}`)).corpo;
    assert.equal(ficha.materiais[0].url, '/arquivo/90');
    assert.equal(ficha.imoveis.length, 1);
    assert.equal((await chamar('PATCH', `/empreendimentos/${e.corpo.id}/remover`)).status, 409);
    await chamar('PATCH', `/imoveis/${im.id}`, { empreendimento_id: null });
    assert.equal((await chamar('PATCH', `/empreendimentos/${e.corpo.id}/materiais/${mat.corpo.id}/remover`)).status, 200);
    assert.equal((await chamar('PATCH', `/empreendimentos/${e.corpo.id}/remover`)).status, 200);
    assert.equal((await chamar('GET', '/empreendimentos')).corpo.total, 0);
  });
});

test('visita a um imóvel: agenda, retorno do cliente e aparece nas duas fichas', async () => {
  const banco = new BancoFalso(UNICOS);
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    const im = (await chamar('POST', '/imoveis', { tipo: 'casa', cidade: 'Brasília' })).corpo;
    const c = (await chamar('POST', '/contatos', { nome: 'Comprador Bia', telefone: '61955554444' })).corpo;
    const neg = await chamar('POST', '/negocios', { contato_id: c.id, imovel_id: im.id });
    assert.equal(neg.corpo.imovel_id, im.id);
    const a = await chamar('POST', '/atividades', { tipo: 'visita', titulo: 'Visita à casa', quando: '2026-11-03T14:00:00.000Z', contato_id: c.id, imovel_id: im.id });
    assert.equal(a.status, 201);
    assert.equal(banco.linhas('visitas').length, 1);
    assert.equal((await chamar('POST', `/visitas/${a.corpo.id}/feedback`, {})).status, 422);
    assert.equal((await chamar('POST', `/visitas/${a.corpo.id}/feedback`, { nota: 7 })).status, 422);
    const fb = await chamar('POST', `/visitas/${a.corpo.id}/feedback`, { nota: 4, texto: 'Gostou do quintal, achou a cozinha pequena', compartilhar: false });
    assert.equal(fb.status, 200);
    assert.equal(fb.corpo.compartilhar_com_proprietario, false);
    assert.equal(banco.linhas('atividades')[0].status, 'feita');
    const fichaContato = (await chamar('GET', `/contatos/${c.id}`)).corpo;
    assert.equal(fichaContato.visitas[0].feedback_nota, 4);
    const fichaImovel = (await chamar('GET', `/imoveis/${im.id}`)).corpo;
    assert.equal(fichaImovel.visitas[0].contato_id, c.id);
    assert.equal(fichaImovel.negocios.length, 1);
    // Tarefa comum não vira visita, mesmo com imovel_id.
    await chamar('POST', '/atividades', { tipo: 'ligacao', titulo: 'Ligar', quando: '2026-11-04T14:00:00.000Z', contato_id: c.id, imovel_id: im.id });
    assert.equal(banco.linhas('visitas').length, 1);
  });
});

test('isolamento dos imóveis: o corretor B não vê, não edita e não vincula nada do A', async () => {
  const banco = new BancoFalso(UNICOS);
  const a: Record<string, number> = {};
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    a.imovel = (await chamar('POST', '/imoveis', { tipo: 'casa', cidade: 'Brasília' })).corpo.id;
    a.midia = (await chamar('POST', `/imoveis/${a.imovel}/midias`, { upload_id: 5 })).corpo.id;
    a.dono = (await chamar('POST', '/contatos', { nome: 'Dono A', telefone: '61944443333' })).corpo.id;
    a.aut = (await chamar('POST', '/autorizacoes', { imovel_id: a.imovel, proprietario_id: a.dono, inicio: HOJE, fim: dia(30), comissao_pct: 5, preco_autorizado: 1 })).corpo.id;
    a.emp = (await chamar('POST', '/empreendimentos', { nome: 'Do A' })).corpo.id;
  });
  await comServidor(rotas, B, banco, {}, async (chamar) => {
    assert.equal((await chamar('GET', '/imoveis')).corpo.total, 0);
    assert.equal((await chamar('GET', `/imoveis/${a.imovel}`)).status, 404);
    assert.equal((await chamar('PATCH', `/imoveis/${a.imovel}`, { titulo: 'x' })).status, 404);
    assert.equal((await chamar('PATCH', `/imoveis/${a.imovel}/remover`)).status, 404);
    assert.equal((await chamar('POST', `/imoveis/${a.imovel}/midias`, { upload_id: 6 })).status, 404);
    assert.equal((await chamar('PATCH', `/imoveis/${a.imovel}/midias/${a.midia}/remover`)).status, 404);
    assert.equal((await chamar('POST', `/imoveis/${a.imovel}/descricao`)).status, 404);
    assert.equal((await chamar('PATCH', `/autorizacoes/${a.aut}`, { situacao: 'revogada' })).status, 404);
    assert.equal((await chamar('POST', '/autorizacoes', { imovel_id: a.imovel, inicio: HOJE, fim: dia(1), comissao_pct: 1, preco_autorizado: 1 })).status, 422);
    assert.equal((await chamar('GET', `/empreendimentos/${a.emp}`)).status, 404);
    assert.equal((await chamar('GET', '/empreendimentos')).corpo.total, 0);
    // Vínculos com IDs do A no corpo.
    const meu = (await chamar('POST', '/imoveis', { tipo: 'sala', cidade: 'Brasília' })).corpo.id;
    assert.equal((await chamar('PATCH', `/imoveis/${meu}`, { proprietario_id: a.dono })).status, 422);
    assert.equal((await chamar('PATCH', `/imoveis/${meu}`, { empreendimento_id: a.emp })).status, 422);
    const minhaAut = (await chamar('POST', '/autorizacoes', { imovel_id: meu, proprietario_id: (await chamar('POST', '/contatos', { nome: 'Dono B', telefone: '61933332222' })).corpo.id, inicio: HOJE, fim: dia(1), comissao_pct: 1, preco_autorizado: 1 })).corpo.id;
    assert.equal((await chamar('PATCH', `/autorizacoes/${minhaAut}`, { documento_midia_id: a.midia })).status, 422);
    const c = (await chamar('POST', '/contatos', { nome: 'Cliente B', telefone: '61922221111' })).corpo.id;
    assert.equal((await chamar('POST', '/negocios', { contato_id: c, imovel_id: a.imovel })).status, 422);
    assert.equal((await chamar('POST', '/atividades', { tipo: 'visita', titulo: 'x', quando: '2026-11-01T10:00:00Z', contato_id: c, imovel_id: a.imovel })).status, 422);
    assert.equal(banco.linhas('imoveis').find((i) => i.id === meu)!.codigo, 'IM-0001', 'código conta por conta');
  });
  assert.equal(banco.linhas('autorizacoes_venda').find((x) => x.id === a.aut)!.situacao, 'rascunho');
  assert.equal(banco.linhas('imoveis').find((x) => x.id === a.imovel)!.removido_em ?? null, null);
});

test('equipe da plataforma não alcança imóveis', async () => {
  await comServidor(rotas, { usuario: 9, conta: null, papeis: ['operacao'] }, new BancoFalso(UNICOS), {}, async (chamar) => {
    assert.equal((await chamar('GET', '/imoveis')).status, 403);
    assert.equal((await chamar('POST', '/empreendimentos', { nome: 'x' })).status, 403);
    assert.equal((await chamar('PATCH', '/autorizacoes/1', {})).status, 403);
  });
});
