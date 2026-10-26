import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rotas, reagir, rotinas } from '../backend/rotas';
import { http, publicar } from '../backend/instagram';
import { BancoFalso, comServidor, type Ator } from './apoio';

const UNICOS = { contatos: ['telefone'], imoveis: ['codigo'], perfis_corretor: ['usuario_id'] };
const HOJE = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
const dia = (delta: number) => new Date(Date.now() + delta * 86400e3).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
const arquivos = { url: async (id: number) => `/api/arquivos/${id}?token=x` };
const parametros = { obter: async (slug: string) => ({ meta_app_id: '123456', meta_app_secret: 'segredo-do-app' } as Record<string, string>)[slug] ?? null };
const semParametros = { obter: async () => null };
const shell = { urlApp: (sub: string) => `https://corretor.exemplo/portal_corretor${sub}` };
publicar.esperaMs = 0;

/** Instagram falso: grava as chamadas e responde como a Graph API. */
function metaFalsa(tipoConta = 'BUSINESS') {
  const chamadas: { url: string; corpo: string }[] = [];
  let seq = 0;
  http.fetch = async (url: string, init?: RequestInit) => {
    const corpo = typeof init?.body === 'string' ? init.body : '';
    chamadas.push({ url, corpo });
    const ok = (dados: unknown) => new Response(JSON.stringify(dados), { status: 200, headers: { 'Content-Type': 'application/json' } });
    if (url.startsWith('https://api.instagram.com/oauth/access_token')) return ok({ access_token: 'curto', user_id: 999 });
    if (url.includes('grant_type=ig_exchange_token')) return ok({ access_token: 'longo-1', expires_in: 5184000 });
    if (url.includes('grant_type=ig_refresh_token')) return ok({ access_token: 'longo-2', expires_in: 5184000 });
    if (url.includes('/me?')) return ok({ user_id: '17841400000000001', username: 'joao.corretor', account_type: tipoConta });
    if (url.endsWith('/media')) return ok({ id: `c${++seq}` });
    if (url.includes('fields=status_code')) return ok({ status_code: 'FINISHED' });
    if (url.endsWith('/media_publish')) return ok({ id: 'm1' });
    if (url.includes('fields=permalink')) return ok({ permalink: 'https://www.instagram.com/p/abc/' });
    return new Response(JSON.stringify({ error: { message: 'inesperado', code: 1 } }), { status: 400 });
  };
  return chamadas;
}

function eventosFalsos() {
  const agendados: { tipo: string; payload: any; em: Date }[] = [];
  const cancelados: number[] = [];
  return { agendados, cancelados, agendar: async (tipo: string, payload: any, o: { em: Date }) => (agendados.push({ tipo, payload, em: o.em }), { id: agendados.length }), cancelarAgendamento: async (id: number) => (cancelados.push(id), true) };
}

type Chamar = (m: string, c: string, b?: unknown) => Promise<{ status: number; corpo: any }>;

/** Peça aprovada, com imóvel anunciado, CRECI e arte. */
async function pecaAprovada(chamar: Chamar, formato = 'post_1x1', telefone = '61977770001') {
  const im = (await chamar('POST', '/imoveis', { tipo: 'casa', cidade: 'Brasília', bairro: 'Lago Sul', titulo: 'Casa' })).corpo;
  await chamar('PATCH', `/imoveis/${im.id}`, { preco: 2500000 });
  const dono = (await chamar('POST', '/contatos', { nome: 'Dona', telefone })).corpo;
  const aut = (await chamar('POST', '/autorizacoes', { imovel_id: im.id, proprietario_id: dono.id, inicio: HOJE, fim: dia(60), comissao_pct: '5', preco_autorizado: '2.500.000' })).corpo;
  await chamar('POST', `/imoveis/${im.id}/midias`, { upload_id: 1, tipo: 'foto' });
  const doc = (await chamar('POST', `/imoveis/${im.id}/midias`, { upload_id: 2, tipo: 'documento' })).corpo;
  await chamar('PATCH', `/autorizacoes/${aut.id}`, { documento_midia_id: doc.id, situacao: 'assinada' });
  await chamar('PATCH', `/imoveis/${im.id}`, { situacao: 'ativo' });
  await chamar('PUT', '/conta/meu-perfil', { creci: 'DF-12345-F', telefone: '61999990000' });
  const p = (await chamar('POST', '/estudio/pedido', { imovel_id: im.id, objetivo: 'novo_imovel', formatos: [formato] })).corpo.pecas[0];
  await chamar('PUT', `/estudio/pecas/${p.id}/arquivos`, { upload_ids: formato === 'carrossel' ? [11, 12, 13] : [11], motor: 'canva_ia' });
  const ok = await chamar('POST', `/estudio/pecas/${p.id}/aprovar`);
  assert.equal(ok.status, 200, JSON.stringify(ok.corpo));
  return p;
}

const ator = (conta: number, extras: Record<string, unknown> = {}): Ator => ({ usuario: conta / 100, conta, papeis: ['corretor'], extras: { arquivos, parametros, ...extras } });

test('conexão: sem app da Meta configurado, avisa; com ele, troca o código e guarda o token só como segredo', async () => {
  const banco = new BancoFalso(UNICOS);
  const chamadas = metaFalsa();
  await comServidor(rotas, { ...ator(100), extras: { arquivos, parametros: semParametros } }, banco, shell, async (chamar) => {
    assert.equal((await chamar('GET', '/conexoes')).corpo.disponivel, false);
    assert.equal((await chamar('POST', '/conexoes/instagram/iniciar', { state: 'a'.repeat(32) })).status, 503);
  });
  await comServidor(rotas, ator(100), banco, shell, async (chamar) => {
    const c = (await chamar('GET', '/conexoes')).corpo;
    assert.deepEqual([c.disponivel, c.instagram, c.retorno], [true, null, 'https://corretor.exemplo/portal_corretor/ajustes/conexoes']);
    assert.equal((await chamar('POST', '/conexoes/instagram/iniciar', { state: 'curto' })).status, 422);
    const ini = (await chamar('POST', '/conexoes/instagram/iniciar', { state: 'b'.repeat(32) })).corpo;
    const u = new URL(ini.url);
    assert.equal(u.origin + u.pathname, 'https://www.instagram.com/oauth/authorize');
    assert.equal(u.searchParams.get('redirect_uri'), 'https://corretor.exemplo/portal_corretor/ajustes/conexoes');
    assert.equal(u.searchParams.get('state'), 'b'.repeat(32));
    assert.match(u.searchParams.get('scope')!, /instagram_business_content_publish/);
    const r = await chamar('POST', '/conexoes/instagram/retorno', { code: 'codigo-da-meta#_' });
    assert.equal(r.status, 200, JSON.stringify(r.corpo));
    assert.equal(r.corpo.usuario, 'joao.corretor');
    assert.ok(chamadas[0].corpo.includes('code=codigo-da-meta') && !chamadas[0].corpo.includes('%23_'), 'o "#_" do retorno sai do código');
    const depois = (await chamar('GET', '/conexoes')).corpo;
    assert.equal(depois.instagram.usuario, 'joao.corretor');
    assert.ok(!JSON.stringify(depois).includes('longo-1'), 'o token nunca volta para a tela');
  });
  const canal = banco.linhas('canais_sociais')[0];
  assert.equal(canal.token, 'longo-1');
  assert.equal(canal.conta_externa_id, '17841400000000001');
  // Conta pessoal é recusada com a explicação.
  metaFalsa('PERSONAL');
  await comServidor(rotas, ator(200), banco, shell, async (chamar) => {
    assert.equal((await chamar('POST', '/conexoes/instagram/retorno', { code: 'x' })).corpo.codigo, 'CONTA_PESSOAL');
    assert.equal((await chamar('GET', '/conexoes')).corpo.instagram, null, 'a conexão de A não aparece para B');
  });
});

test('publicar agora: só peça aprovada, com Instagram conectado; legenda com CRECI; carrossel e story', async () => {
  const banco = new BancoFalso(UNICOS);
  const chamadas = metaFalsa();
  await comServidor(rotas, ator(100), banco, shell, async (chamar) => {
    const post = await pecaAprovada(chamar);
    // Sem conexão: não publica e diz por quê.
    const semConexao = await chamar('POST', `/estudio/pecas/${post.id}/publicar`);
    assert.equal(semConexao.corpo.codigo, 'NAO_PUBLICADA');
    assert.match(semConexao.corpo.mensagem, /não está conectado/);
    assert.equal(banco.linhas('pecas').find((p) => p.id === post.id)!.estado, 'erro');
    await chamar('POST', '/conexoes/instagram/retorno', { code: 'x' });
    const ok = await chamar('POST', `/estudio/pecas/${post.id}/publicar`);
    assert.equal(ok.status, 200, JSON.stringify(ok.corpo));
    const salva = banco.linhas('pecas').find((p) => p.id === post.id)!;
    assert.deepEqual([salva.estado, salva.publicacao_id, salva.permalink, salva.publicada_por], ['publicada', 'm1', 'https://www.instagram.com/p/abc/', 'api']);
    const criacao = chamadas.find((c) => c.url.endsWith('/17841400000000001/media'))!;
    const corpo = new URLSearchParams(criacao.corpo);
    assert.equal(corpo.get('image_url'), 'https://corretor.exemplo/api/arquivos/11?token=x', 'URL absoluta para a Meta baixar');
    assert.match(corpo.get('caption')!, /CRECI DF-12345-F/);
    assert.equal(corpo.get('access_token'), 'longo-1');
    assert.equal((await chamar('POST', `/estudio/pecas/${post.id}/publicar`)).status, 409, 'já publicada');
    // Carrossel: um contêiner por imagem e o principal.
    const car = await pecaAprovada(chamar, 'carrossel', '61977770002');
    const antes = chamadas.length;
    assert.equal((await chamar('POST', `/estudio/pecas/${car.id}/publicar`)).status, 200);
    const novas = chamadas.slice(antes).filter((c) => c.url.endsWith('/media')).map((c) => new URLSearchParams(c.corpo));
    assert.equal(novas.filter((c) => c.get('is_carousel_item') === 'true').length, 3);
    assert.equal(novas.find((c) => c.get('media_type') === 'CAROUSEL')!.get('children'), 'c2,c3,c4');
    // Story: sem legenda (o Instagram não usa).
    const story = await pecaAprovada(chamar, 'story', '61977770003');
    const antesStory = chamadas.length;
    await chamar('POST', `/estudio/pecas/${story.id}/publicar`);
    const s = new URLSearchParams(chamadas.slice(antesStory).find((c) => c.url.endsWith('/media'))!.corpo);
    assert.deepEqual([s.get('media_type'), s.get('caption')], ['STORIES', null]);
  });
});

test('agendar: aprovação manual exige aprovada; janela agenda o rascunho; o listener publica na conta certa', async () => {
  const banco = new BancoFalso(UNICOS);
  metaFalsa();
  const ev = eventosFalsos();
  let pecaId = 0;
  await comServidor(rotas, ator(100, { eventos: ev }), banco, shell, async (chamar) => {
    const p = await pecaAprovada(chamar);
    pecaId = p.id;
    const quando = new Date(Date.now() + 2 * 3600e3).toISOString();
    assert.equal((await chamar('POST', `/estudio/pecas/${p.id}/agendar`, { quando })).corpo.codigo, 'INSTAGRAM_DESCONECTADO');
    await chamar('POST', '/conexoes/instagram/retorno', { code: 'x' });
    assert.equal((await chamar('POST', `/estudio/pecas/${p.id}/agendar`, { quando: new Date(Date.now() + 60e3).toISOString() })).status, 422, 'menos de 5 minutos');
    const ag = await chamar('POST', `/estudio/pecas/${p.id}/agendar`, { quando });
    assert.equal(ag.status, 200, JSON.stringify(ag.corpo));
    assert.equal(ev.agendados[0].tipo, 'publicacao_programada');
    assert.deepEqual(ev.agendados[0].payload, { peca_id: p.id, agendada_para: quando });
    assert.equal(ev.agendados[0].em.toISOString(), quando);
    assert.equal(banco.linhas('pecas').find((x) => x.id === p.id)!.estado, 'agendada');
    assert.equal((await chamar('PATCH', `/estudio/pecas/${p.id}`, { titulo: 'x' })).status, 409, 'agendada não muda');
    // Cancelar volta para aprovada; agendar de novo.
    await chamar('POST', `/estudio/pecas/${p.id}/cancelar-agendamento`);
    assert.deepEqual([banco.linhas('pecas').find((x) => x.id === p.id)!.estado, ev.cancelados], ['aprovada', [1]]);
    await chamar('POST', `/estudio/pecas/${p.id}/agendar`, { quando: new Date(Date.parse(quando) - 3600e3).toISOString() });
    // Rascunho não agenda na aprovação manual.
    const rascunho = (await chamar('POST', '/estudio/pedido', { pedido: 'institucional', formatos: ['post_1x1'] })).corpo.pecas[0];
    assert.equal((await chamar('POST', `/estudio/pecas/${rascunho.id}/agendar`, { quando })).corpo.codigo, 'ESTADO_INVALIDO');
  });
  const ctx = { ...banco.ctxSistema([{ id: 100, nome: 'A' }, { id: 200, nome: 'B' }]), arquivos, shell };
  const atual = ev.agendados[1].payload;
  // Evento da conta errada: nada acontece.
  await reagir.publicacao_programada({ payload: atual, conta_id: 200 }, ctx as any);
  assert.equal(banco.linhas('pecas').find((x) => x.id === pecaId)!.estado, 'agendada');
  // Evento do agendamento cancelado (o cancelar pode ter falhado): não publica pelo agendamento novo.
  await reagir.publicacao_programada({ payload: ev.agendados[0].payload, conta_id: 100 }, ctx as any);
  assert.equal(banco.linhas('pecas').find((x) => x.id === pecaId)!.estado, 'agendada', 'agendamento antigo não publica');
  await reagir.publicacao_programada({ payload: { ...atual, agendada_para: new Date(Date.now() + 9e6).toISOString() }, conta_id: 100 }, ctx as any);
  assert.equal(banco.linhas('pecas').find((x) => x.id === pecaId)!.estado, 'agendada', 'outro horário não publica');
  await reagir.publicacao_programada({ payload: atual, conta_id: 100 }, ctx as any);
  assert.equal(banco.linhas('pecas').find((x) => x.id === pecaId)!.estado, 'publicada');
  // Entrega repetida (at-least-once): já publicada, ignora.
  await reagir.publicacao_programada({ payload: atual, conta_id: 100 }, ctx as any);
  assert.equal(banco.linhas('pecas').find((x) => x.id === pecaId)!.publicacao_id, 'm1');

  // Aprovação por janela: o rascunho com arte agenda e é aprovado na hora.
  banco.linhas('configuracoes_conta').push({ id: 9999, conta_id: 100, chave: 'conta', modo_aprovacao_conteudo: 'janela', janela_aprovacao_horas: 24 } as any);
  let janelaId = 0;
  await comServidor(rotas, ator(100, { eventos: ev }), banco, shell, async (chamar) => {
    const r = (await chamar('POST', '/estudio/pedido', { pedido: 'institucional', formatos: ['post_1x1'] })).corpo.pecas[0];
    janelaId = r.id;
    await chamar('PUT', `/estudio/pecas/${r.id}/arquivos`, { upload_ids: [21] });
    const ag = await chamar('POST', `/estudio/pecas/${r.id}/agendar`, { quando: new Date(Date.now() + 3600e3).toISOString() });
    assert.equal(ag.status, 200, JSON.stringify(ag.corpo));
  });
  await reagir.publicacao_programada({ payload: ev.agendados[ev.agendados.length - 1].payload, conta_id: 100 }, ctx as any);
  const j = banco.linhas('pecas').find((x) => x.id === janelaId)!;
  assert.equal(j.estado, 'publicada');
  assert.ok(j.aprovada_em, 'aprovada pela janela');

  // Outra conta não publica nem agenda a peça de A.
  await comServidor(rotas, ator(200, { eventos: ev }), banco, shell, async (chamar) => {
    assert.equal((await chamar('POST', `/estudio/pecas/${janelaId}/publicar`)).status, 404);
    assert.equal((await chamar('POST', `/estudio/pecas/${janelaId}/agendar`, { quando: new Date(Date.now() + 3600e3).toISOString() })).status, 404);
    assert.equal((await chamar('POST', `/estudio/pecas/${janelaId}/publicada-fora`, {})).status, 404);
  });
});

test('publiquei por fora e renovação dos tokens', async () => {
  const banco = new BancoFalso(UNICOS);
  metaFalsa();
  await comServidor(rotas, ator(100), banco, shell, async (chamar) => {
    const p = await pecaAprovada(chamar);
    assert.equal((await chamar('POST', `/estudio/pecas/${p.id}/publicada-fora`, { link: 'https://exemplo.com/x' })).status, 422);
    const r = await chamar('POST', `/estudio/pecas/${p.id}/publicada-fora`, { link: 'https://www.instagram.com/p/xyz/' });
    assert.deepEqual([r.corpo.estado, r.corpo.publicada_por, r.corpo.permalink], ['publicada', 'fora', 'https://www.instagram.com/p/xyz/']);
    await chamar('POST', '/conexoes/instagram/retorno', { code: 'x' });
  });
  // Token perto de vencer: a rotina renova.
  const canal = banco.linhas('canais_sociais')[0];
  canal.token_expira_em = new Date(Date.now() + 3 * 86400e3).toISOString();
  const r = await rotinas.renovar_tokens_instagram(banco.ctxSistema([{ id: 100, nome: 'A' }]) as any);
  assert.equal(r.ok, true);
  assert.equal(banco.linhas('canais_sociais')[0].token, 'longo-2');
  assert.ok(String(banco.linhas('canais_sociais')[0].token_expira_em) > new Date(Date.now() + 50 * 86400e3).toISOString());
});

test('revisão: peça editada pede nova aprovação, story do Canva sai pela API, publicar duas vezes não duplica', async () => {
  const banco = new BancoFalso(UNICOS);
  const chamadas = metaFalsa();
  const ev = eventosFalsos();
  await comServidor(rotas, ator(100, { eventos: ev }), banco, shell, async (chamar) => {
    const p = await pecaAprovada(chamar);
    // Sem conexão: a publicação falha e a peça fica com erro, ainda aprovada.
    assert.equal((await chamar('POST', `/estudio/pecas/${p.id}/publicar`)).corpo.codigo, 'NAO_PUBLICADA');
    // Editar a peça com erro a devolve para rascunho: o texto novo não vai ao ar sem aprovação.
    await chamar('PATCH', `/estudio/pecas/${p.id}`, { legenda: 'TEXTO NUNCA APROVADO' });
    const editada = banco.linhas('pecas').find((x) => x.id === p.id)!;
    assert.deepEqual([editada.estado, editada.aprovada_em], ['rascunho', null]);
    await chamar('POST', '/conexoes/instagram/retorno', { code: 'x' });
    assert.equal((await chamar('POST', `/estudio/pecas/${p.id}/publicar`)).corpo.codigo, 'ESTADO_INVALIDO');

    // Story com arte do Canva (D-79): a arte vem sempre de lá, e o app publica pela API.
    const story = await pecaAprovada(chamar, 'story', '61977770002');
    await chamar('PUT', `/estudio/pecas/${story.id}/arquivos`, { upload_ids: [31], motor: 'canva_ia' });
    await chamar('POST', `/estudio/pecas/${story.id}/aprovar`);
    const st = await chamar('POST', `/estudio/pecas/${story.id}/publicar`);
    assert.equal(st.status, 200, JSON.stringify(st.corpo));
    assert.equal(st.corpo.estado, 'publicada');
    assert.equal(chamadas.filter((c) => c.url.endsWith('/media_publish')).length, 1);

    // Duas abas publicam ao mesmo tempo: uma publica, a outra recebe "a peça mudou".
    const dupla = await pecaAprovada(chamar, 'post_1x1', '61977770003');
    const [a, b] = await Promise.all([chamar('POST', `/estudio/pecas/${dupla.id}/publicar`), chamar('POST', `/estudio/pecas/${dupla.id}/publicar`)]);
    assert.deepEqual([a.status, b.status].sort(), [200, 409]);
    assert.equal(chamadas.filter((c) => c.url.endsWith('/media_publish')).length, 2);
    // Peça em publicação ou publicada não agenda nem cancela.
    assert.equal((await chamar('POST', `/estudio/pecas/${dupla.id}/agendar`, { quando: new Date(Date.now() + 3600e3).toISOString() })).status, 409);

    // Agendamento entregue com atraso grande (sistema fora do ar): vira erro, não publica tarde.
    const tarde = await pecaAprovada(chamar, 'post_1x1', '61977770004');
    await chamar('POST', `/estudio/pecas/${tarde.id}/agendar`, { quando: new Date(Date.now() + 3600e3).toISOString() });
    const linha = banco.linhas('pecas').find((x) => x.id === tarde.id)!;
    const velho = new Date(Date.now() - 7 * 3600e3).toISOString();
    linha.agendada_para = velho;
    const ctx = { ...banco.ctxSistema([{ id: 100, nome: 'A' }]), arquivos, shell };
    await reagir.publicacao_programada({ payload: { peca_id: tarde.id, agendada_para: velho }, conta_id: 100 }, ctx as any);
    assert.equal(linha.estado, 'erro');
    assert.match(linha.erro, /hora marcada/);
  });
});

test('revisão: janela desligada não aprova sozinha; rotina aceita conta como texto e não insiste em token vencido', async () => {
  const banco = new BancoFalso(UNICOS);
  metaFalsa();
  const ev = eventosFalsos();
  banco.linhas('configuracoes_conta').push({ id: 9999, conta_id: 100, chave: 'conta', modo_aprovacao_conteudo: 'janela', janela_aprovacao_horas: 24 } as any);
  let id = 0;
  await comServidor(rotas, ator(100, { eventos: ev }), banco, shell, async (chamar) => {
    await pecaAprovada(chamar);
    await chamar('POST', '/conexoes/instagram/retorno', { code: 'x' });
    const r = (await chamar('POST', '/estudio/pedido', { pedido: 'institucional', formatos: ['post_1x1'] })).corpo.pecas[0];
    id = r.id;
    await chamar('PUT', `/estudio/pecas/${r.id}/arquivos`, { upload_ids: [21] });
    assert.equal((await chamar('POST', `/estudio/pecas/${r.id}/agendar`, { quando: new Date(Date.now() + 3600e3).toISOString() })).status, 200);
  });
  // O corretor voltou para a aprovação manual antes da hora: o rascunho não sai.
  banco.linhas('configuracoes_conta').find((c) => c.id === 9999)!.modo_aprovacao_conteudo = 'manual';
  const ctx = { ...banco.ctxSistema([{ id: 100, nome: 'A' }]), arquivos, shell };
  await reagir.publicacao_programada({ payload: ev.agendados[ev.agendados.length - 1].payload, conta_id: 100 }, ctx as any);
  const p = banco.linhas('pecas').find((x) => x.id === id)!;
  assert.deepEqual([p.estado, p.aprovada_em ?? null], ['erro', null]);

  // conta_id como texto (BIGINT): a rotina renova mesmo assim.
  const canal = banco.linhas('canais_sociais')[0];
  canal.conta_id = '100' as any;
  canal.token_expira_em = new Date(Date.now() + 3 * 86400e3).toISOString();
  assert.match((await rotinas.renovar_tokens_instagram(banco.ctxSistema([{ id: 100, nome: 'A' }]) as any)).resultado.resumo, /^1 conexão/);
  // Vencido: avisa e não falha a rotina.
  canal.conta_id = 100 as any;
  canal.token_expira_em = new Date(Date.now() - 86400e3).toISOString();
  const r = await rotinas.renovar_tokens_instagram(banco.ctxSistema([{ id: 100, nome: 'A' }]) as any);
  assert.equal(r.ok, true);
  assert.match(String(banco.linhas('canais_sociais')[0].ultimo_erro), /venceu/);
});

test('revisão 2: falha depois da reserva desfaz; destravar só depois de 15 min; resultado não apaga "publiquei por fora"', async () => {
  const banco = new BancoFalso(UNICOS);
  const chamadas = metaFalsa();
  const arquivoSumiu = { url: async () => { throw new Error('arquivo sumiu'); } };
  let pid = 0;
  await comServidor(rotas, ator(100), banco, shell, async (chamar) => {
    const p = await pecaAprovada(chamar);
    pid = p.id;
    await chamar('POST', '/conexoes/instagram/retorno', { code: 'x' });
  });
  // Erro inesperado depois da reserva: a transação desfaz e a peça continua aprovada.
  await comServidor(rotas, ator(100, { arquivos: arquivoSumiu }), banco, shell, async (chamar) => {
    // Erro sem código vira o 500 do Express (HTML): basta não ter respondido 200.
    const r = await chamar('POST', `/estudio/pecas/${pid}/publicar`).catch(() => null);
    assert.notEqual(r?.status, 200);
  });
  const linha = banco.linhas('pecas').find((x) => x.id === pid)!;
  assert.equal(linha.estado, 'aprovada', 'não fica presa em publicando');
  await comServidor(rotas, ator(100), banco, shell, async (chamar) => {
    // Publicação interrompida (processo caiu durante a Meta): destravar espera 15 min.
    linha.estado = 'publicando';
    linha.atualizado_em = new Date().toISOString();
    assert.equal((await chamar('POST', `/estudio/pecas/${pid}/destravar`)).corpo.codigo, 'AINDA_PUBLICANDO');
    linha.atualizado_em = new Date(Date.now() - 20 * 60e3).toISOString();
    const d = await chamar('POST', `/estudio/pecas/${pid}/destravar`);
    assert.deepEqual([d.status, d.corpo.estado, !!d.corpo.aprovada_em], [200, 'erro', true]);
    assert.match(d.corpo.erro, /Confira no Instagram/);
    // O corretor marca "Publiquei por fora" enquanto a Meta responde: o resultado não sobrescreve.
    const original = http.fetch;
    http.fetch = async (url: string, init?: RequestInit) => {
      if (url.endsWith('/media_publish')) Object.assign(linha, { estado: 'publicada', publicada_por: 'fora' });
      return original(url, init);
    };
    const r = await chamar('POST', `/estudio/pecas/${pid}/publicar`);
    http.fetch = original;
    assert.equal(r.status, 200);
    assert.deepEqual([linha.estado, linha.publicada_por], ['publicada', 'fora']);
    assert.equal(chamadas.filter((c) => c.url.endsWith('/media_publish')).length, 1);
  });
});

test('revisão 2: peça da janela que falhou nas checagens pode ser aprovada de novo', async () => {
  const banco = new BancoFalso(UNICOS);
  metaFalsa();
  await comServidor(rotas, ator(100), banco, shell, async (chamar) => {
    const p = await pecaAprovada(chamar);
    Object.assign(banco.linhas('pecas').find((x) => x.id === p.id)!, { estado: 'erro', aprovada_em: null, erro: 'Não publicada: autorização vencida.' });
    const ok = await chamar('POST', `/estudio/pecas/${p.id}/aprovar`);
    assert.deepEqual([ok.status, ok.corpo.estado], [200, 'aprovada']);
  });
});
