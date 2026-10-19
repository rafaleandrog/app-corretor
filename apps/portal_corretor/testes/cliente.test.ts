import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rotas, rotasPublicas, webhooks, reagir } from '../backend/rotas';
import { limparLimites } from '../backend/publico';
import { BancoFalso, comServidor, type Ator } from './apoio';

const UNICOS = { contatos: ['telefone'], imoveis: ['codigo'], visitas: ['atividade_id'], etapas_funil: ['pipeline+nome'], origens: ['canal+campanha'], vitrine_publica: ['tipo+chave'], selecao_itens: ['selecao_id+imovel_id'] };
const arquivos = { url: async (arquivo: number) => `/arquivo/${arquivo}` };
const A: Ator = { usuario: 1, conta: 100, papeis: ['corretor'], extras: { arquivos } };
const B: Ator = { usuario: 2, conta: 200, papeis: ['corretor'], extras: { arquivos } };
const VISITANTE: Ator = { usuario: 0, conta: null, papeis: [], extras: { arquivos } };
const HOJE = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
const dia = (delta: number) => new Date(Date.now() + delta * 86400e3).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });

/** Shell falso com ingressos de verdade: token → contexto, revogação e expiração. */
function shellFalso() {
  const ingressos = new Map<string, { id: number; webhook: string; contexto: any; ativo: boolean; expira_em: string | null }>();
  let n = 0;
  return {
    ingressos,
    gerarIngressoWh: async ({ webhook, contexto, expira_em }: { webhook: string; contexto: any; expira_em?: Date }) => {
      n++;
      const token = `wh_${webhook}_${n}x`;
      ingressos.set(token, { id: n, webhook, contexto, ativo: true, expira_em: expira_em ? expira_em.toISOString() : null });
      return { url: `https://corretor.exemplo/api/wh/portal_corretor/${token}`, token, ingresso_id: n, expira_em: expira_em ? expira_em.toISOString() : null };
    },
    inspecionarIngressoWh: async ({ webhook, token }: { webhook: string; token: string }) => {
      const i = ingressos.get(token);
      if (!i || i.webhook !== webhook || !i.ativo || (i.expira_em && i.expira_em < new Date().toISOString())) throw Object.assign(new Error('inválido'), { codigo: 'WH_INGRESSO_INVALIDO' });
      return { ingresso_id: i.id, contexto: i.contexto, expira_em: i.expira_em, contador_usos: 0 };
    },
    revogarIngressoWh: async ({ ingresso_id }: { ingresso_id: number }) => {
      for (const i of ingressos.values()) if (i.id === ingresso_id) i.ativo = false;
      return { revogado: true };
    },
  };
}

type Chamar = (m: string, c: string, b?: unknown) => Promise<{ status: number; corpo: any }>;

async function imovelAnunciado(chamar: Chamar, titulo: string, telefoneDono: string) {
  const im = (await chamar('POST', '/imoveis', { tipo: 'apartamento', cidade: 'Brasília', bairro: 'Noroeste', titulo, endereco: 'SQNW 111 Bloco C', endereco_publico: 'bairro' })).corpo;
  await chamar('PATCH', `/imoveis/${im.id}`, { preco: 990000, quartos: 3 });
  const dono = (await chamar('POST', '/contatos', { nome: 'Dono Proprietário', telefone: telefoneDono })).corpo;
  const aut = (await chamar('POST', '/autorizacoes', { imovel_id: im.id, proprietario_id: dono.id, inicio: HOJE, fim: dia(60), comissao_pct: '5', preco_autorizado: '990.000' })).corpo;
  await chamar('POST', `/imoveis/${im.id}/midias`, { upload_id: 701, tipo: 'foto', legenda: 'Varanda' });
  const doc = (await chamar('POST', `/imoveis/${im.id}/midias`, { upload_id: 702, tipo: 'documento' })).corpo;
  await chamar('PATCH', `/autorizacoes/${aut.id}`, { documento_midia_id: doc.id, situacao: 'assinada' });
  await chamar('PATCH', `/imoveis/${im.id}`, { situacao: 'ativo' });
  return im;
}

function resposta() {
  const r: { status: number; corpo: any; res: any } = { status: 200, corpo: null, res: null };
  r.res = {
    status(s: number) {
      r.status = s;
      return r.res;
    },
    json(c: unknown) {
      r.corpo = c;
      return r.res;
    },
  };
  return r;
}

async function chamarWebhook(nome: keyof typeof webhooks, contexto: any, corpo: unknown, ip = '10.1.0.1') {
  const publicados: { tipo: string; payload: any; opcoes: any }[] = [];
  const r = resposta();
  const req: any = { body: corpo, headers: {}, ip, wh: { webhook: nome, modo: 'recorrente', ingresso_id: 1, contexto, contador_usos: 0, criado_por: 1 }, eventos: { publicar: async (tipo: string, payload: any, opcoes: any) => publicados.push({ tipo, payload, opcoes }) } };
  await webhooks[nome](req, r.res);
  return { ...r, publicados };
}

const tokenDe = (link: string) => new URL(link).searchParams.get('t')!;

test('seleção: só imóvel anunciável, link com validade, vitrine sem dado pessoal, reação vira tarefa', async () => {
  limparLimites();
  const banco = new BancoFalso(UNICOS);
  const shell = shellFalso();
  let link = '';
  let selecaoId = 0;
  let codigo = '';
  let clienteId = 0;
  await comServidor(rotas, A, banco, shell, async (chamar) => {
    const im = await imovelAnunciado(chamar, 'Apto no Noroeste', '61933330001');
    codigo = im.codigo;
    const rascunho = (await chamar('POST', '/imoveis', { tipo: 'casa', cidade: 'Brasília', titulo: 'Rascunho' })).corpo;
    const cliente = (await chamar('POST', '/contatos', { nome: 'Paula Compradora', telefone: '61944440001', email: 'paula@exemplo.com' })).corpo;
    clienteId = cliente.id;
    assert.equal((await chamar('POST', '/selecoes', { contato_id: cliente.id, imovel_ids: [im.id, rascunho.id] })).corpo.codigo, 'IMOVEL_NAO_ANUNCIAVEL');
    assert.equal((await chamar('POST', '/selecoes', { contato_id: cliente.id, imovel_ids: [] })).status, 422);
    const r = await chamar('POST', '/selecoes', { contato_id: cliente.id, titulo: 'Casas no Noroeste', mensagem: 'Pelo que conversamos', imovel_ids: [im.id] });
    assert.equal(r.status, 201, JSON.stringify(r.corpo));
    link = r.corpo.link;
    selecaoId = r.corpo.selecao.id;
    assert.match(link, /^https:\/\/corretor\.exemplo\/portal_corretor\/s\?t=wh_reacao_selecao_/);
    // Validade da conta (padrão 14 dias) vai no ingresso.
    const ingresso = shell.ingressos.get(tokenDe(link))!;
    assert.ok(ingresso.expira_em && ingresso.expira_em > new Date(Date.now() + 13 * 86400e3).toISOString());
    assert.deepEqual(ingresso.contexto, { conta_id: 100, selecao_id: selecaoId });
    const lista = (await chamar('GET', `/selecoes?contato_id=${cliente.id}`)).corpo;
    assert.equal(lista.dados[0].itens.length, 1);
    assert.equal(lista.dados[0].valida, true);
  });
  assert.ok(banco.linhas('envios').some((e) => e.tipo === 'selecao' && e.contato_id === clienteId));
  assert.ok(banco.linhas('linha_do_tempo').some((l) => l.tipo === 'selecao.enviada'));
  const vitrine = JSON.stringify(banco.linhas('vitrine_publica'));
  for (const proibido of ['Paula', '61944440001', 'paula@', 'Dono', 'SQNW', 'comissao']) assert.ok(!vitrine.includes(proibido), `vitrine sem ${proibido}`);

  // O cliente abre pelo token; token inválido não abre.
  await comServidor(rotasPublicas, VISITANTE, banco, shell, async (chamar) => {
    const s = await chamar('GET', `/vitrine/selecao?t=${tokenDe(link)}`);
    assert.equal(s.status, 200);
    assert.equal(s.corpo.selecao.titulo, 'Casas no Noroeste');
    assert.deepEqual(s.corpo.selecao.itens[0].fotos, [{ url: '/arquivo/701', legenda: 'Varanda' }]);
    assert.equal(s.corpo.selecao.itens[0].reacao, null);
    assert.equal((await chamar('GET', '/vitrine/selecao?t=wh_inventado_123x')).status, 404);
    assert.equal((await chamar('GET', '/vitrine/selecao?t=<script>')).status, 404);
  });

  // Reação: o webhook valida e publica com a conta do ingresso; o listener grava.
  const contexto = { conta_id: 100, selecao_id: selecaoId };
  assert.equal((await chamarWebhook('reacao_selecao', contexto, { imovel_codigo: codigo, reacao: 'talvez' })).status, 422);
  const ok = await chamarWebhook('reacao_selecao', contexto, { imovel_codigo: codigo, reacao: 'quero_visitar', conta_id: 200 });
  assert.deepEqual(ok.publicados.map((p) => [p.tipo, p.opcoes.conta_id, p.payload.reacao]), [['reacao_recebida', 100, 'quero_visitar']]);
  const ctx = banco.ctxSistema([{ id: 100, nome: 'A' }, { id: 200, nome: 'B' }]);
  await reagir.reacao_recebida({ payload: ok.publicados[0].payload, conta_id: 100 }, ctx);
  await reagir.reacao_recebida({ payload: ok.publicados[0].payload, conta_id: 100 }, ctx);
  const item = banco.linhas('selecao_itens').find((i) => i.selecao_id === selecaoId)!;
  assert.equal(item.reacao, 'quero_visitar');
  const tarefas = banco.linhas('atividades').filter((a) => a.tipo === 'tarefa' && a.contato_id === clienteId);
  assert.equal(tarefas.length, 1, 'quero visitar vira uma tarefa, sem repetir');
  assert.match(tarefas[0].titulo, /^Marcar visita: IM-/);
  assert.equal(banco.linhas('linha_do_tempo').filter((l) => l.tipo === 'selecao.reacao').length, 1, 'reação repetida não duplica a linha do tempo');
  assert.equal(banco.linhas('vitrine_publica').find((l) => l.tipo === 'selecao')!.dados.itens[0].reacao, 'quero_visitar');
  // Mesmo evento endereçado a outra conta: a seleção não é dela, nada muda.
  await reagir.reacao_recebida({ payload: { ...ok.publicados[0].payload, reacao: 'nao_gostei' }, conta_id: 200 }, ctx);
  assert.equal(banco.linhas('selecao_itens').find((i) => i.selecao_id === selecaoId)!.reacao, 'quero_visitar');
  // Imóvel que não é da seleção: ignorado.
  await reagir.reacao_recebida({ payload: { ...ok.publicados[0].payload, imovel_codigo: 'IM-9999' }, conta_id: 100 }, ctx);

  // Outra conta não revoga nem lista a seleção de A.
  await comServidor(rotas, B, banco, shell, async (chamar) => {
    assert.equal((await chamar('PATCH', `/selecoes/${selecaoId}/revogar`)).status, 404);
    assert.equal((await chamar('GET', '/selecoes')).corpo.total, 0);
    assert.equal((await chamar('POST', '/selecoes', { contato_id: clienteId, imovel_ids: [1] })).corpo.codigo, 'DADOS_INVALIDOS', 'cliente de outra conta');
  });

  // Revogar: o link deixa de abrir e a vitrine sai.
  await comServidor(rotas, A, banco, shell, async (chamar) => {
    assert.equal((await chamar('PATCH', `/selecoes/${selecaoId}/revogar`)).status, 200);
  });
  assert.equal(shell.ingressos.get(tokenDe(link))!.ativo, false);
  assert.equal(banco.linhas('vitrine_publica').filter((l) => l.tipo === 'selecao').length, 0);
  await comServidor(rotasPublicas, VISITANTE, banco, shell, async (chamar) => {
    assert.equal((await chamar('GET', `/vitrine/selecao?t=${tokenDe(link)}`)).status, 404);
  });
});

test('seleção vencida não abre, mesmo com a vitrine ainda lá', async () => {
  const banco = new BancoFalso(UNICOS);
  const shell = shellFalso();
  let link = '';
  await comServidor(rotas, A, banco, shell, async (chamar) => {
    const im = await imovelAnunciado(chamar, 'Apto', '61933330002');
    const cliente = (await chamar('POST', '/contatos', { nome: 'Caio', telefone: '61944440002' })).corpo;
    link = (await chamar('POST', '/selecoes', { contato_id: cliente.id, imovel_ids: [im.id] })).corpo.link;
  });
  banco.linhas('vitrine_publica').find((l) => l.tipo === 'selecao')!.dados.expira_em = new Date(Date.now() - 1000).toISOString();
  await comServidor(rotasPublicas, VISITANTE, banco, shell, async (chamar) => {
    assert.equal((await chamar('GET', `/vitrine/selecao?t=${tokenDe(link)}`)).status, 404);
  });
});

test('portal do cliente: um link por cliente, agenda e seleções, ações viram tarefa; revogado não abre', async () => {
  limparLimites();
  const banco = new BancoFalso(UNICOS);
  const shell = shellFalso();
  let link = '';
  let clienteId = 0;
  let visitaId = 0;
  let outraVisita = 0;
  await comServidor(rotas, A, banco, shell, async (chamar) => {
    const im = await imovelAnunciado(chamar, 'Casa com quintal', '61933330003');
    const cliente = (await chamar('POST', '/contatos', { nome: 'Lia Souza', telefone: '61944440003', email: 'lia@exemplo.com' })).corpo;
    const outro = (await chamar('POST', '/contatos', { nome: 'Outro Cliente', telefone: '61944440004' })).corpo;
    clienteId = cliente.id;
    assert.deepEqual((await chamar('GET', `/contatos/${cliente.id}/portal`)).corpo.ativo, false);
    const p = await chamar('POST', `/contatos/${cliente.id}/portal`);
    assert.equal(p.status, 201);
    link = p.corpo.link;
    assert.match(link, /\/portal_corretor\/c\?t=wh_acao_cliente_/);
    const de_novo = await chamar('POST', `/contatos/${cliente.id}/portal`);
    assert.deepEqual([de_novo.corpo.link, de_novo.corpo.novo], [link, false], 'um link por cliente');
    await chamar('POST', '/selecoes', { contato_id: cliente.id, titulo: 'Casas', imovel_ids: [im.id] });
    const amanha = new Date(Date.now() + 86400e3).toISOString();
    visitaId = (await chamar('POST', '/atividades', { tipo: 'visita', titulo: 'Visita à casa', contato_id: cliente.id, imovel_id: im.id, quando: amanha })).corpo.id;
    outraVisita = (await chamar('POST', '/atividades', { tipo: 'visita', titulo: 'Visita do outro', contato_id: outro.id, imovel_id: im.id, quando: amanha })).corpo.id;
  });
  const portal = banco.linhas('vitrine_publica').find((l) => l.tipo === 'portal')!;
  const texto = JSON.stringify(portal);
  for (const proibido of ['Lia', '61944440003', 'lia@', 'SQNW', 'Outro Cliente']) assert.ok(!texto.includes(proibido), `portal sem ${proibido}`);
  assert.equal(portal.dados.agenda.length, 1, 'só as visitas deste cliente');
  assert.equal(portal.dados.agenda[0].imovel.bairro, 'Noroeste');
  assert.equal(portal.dados.agenda[0].imovel.endereco, null);

  await comServidor(rotasPublicas, VISITANTE, banco, shell, async (chamar) => {
    const r = await chamar('GET', `/vitrine/portal?t=${tokenDe(link)}`);
    assert.equal(r.status, 200);
    assert.equal(r.corpo.portal.selecoes.length, 1);
    assert.equal(r.corpo.portal.selecoes[0].itens[0].fotos[0].url, '/arquivo/701');
    assert.equal(r.corpo.portal.agenda[0].ref, visitaId);
    assert.equal(r.corpo.portal.jornada.imoveis_recebidos, 1);
    // Token de seleção não abre o portal, e vice-versa.
    assert.equal((await chamar('GET', `/vitrine/selecao?t=${tokenDe(link)}`)).status, 404);
  });

  // Ações do portal: mensagem e pedido de remarcar.
  const contexto = { conta_id: 100, contato_id: clienteId };
  assert.equal((await chamarWebhook('acao_cliente', contexto, { tipo: 'mensagem' })).status, 422, 'mensagem vazia');
  const msg = await chamarWebhook('acao_cliente', contexto, { tipo: 'mensagem', texto: 'Posso levar minha mãe?' });
  assert.deepEqual([msg.publicados[0].tipo, msg.publicados[0].opcoes.conta_id], ['acao_cliente_recebida', 100]);
  const ctx = banco.ctxSistema([{ id: 100, nome: 'A' }, { id: 200, nome: 'B' }]);
  await reagir.acao_cliente_recebida({ payload: msg.publicados[0].payload, conta_id: 100 }, ctx);
  // Remarcar a visita de outro cliente: ignorado.
  const alheia = await chamarWebhook('acao_cliente', contexto, { tipo: 'remarcar', visita: outraVisita });
  await reagir.acao_cliente_recebida({ payload: alheia.publicados[0].payload, conta_id: 100 }, ctx);
  const remarcar = await chamarWebhook('acao_cliente', contexto, { tipo: 'remarcar', visita: visitaId, texto: 'Prefiro sábado' });
  await reagir.acao_cliente_recebida({ payload: remarcar.publicados[0].payload, conta_id: 100 }, ctx);
  const tarefas = banco.linhas('atividades').filter((a) => a.tipo === 'tarefa' && a.contato_id === clienteId).map((a) => a.titulo).sort();
  assert.deepEqual(tarefas, ['Remarcar visita: Visita à casa', 'Responder a mensagem do portal']);
  assert.ok(banco.linhas('linha_do_tempo').some((l) => l.tipo === 'portal.remarcar' && l.resumo.includes('Prefiro sábado')));
  // Limite por origem: 5 ações por minuto.
  for (let i = 0; i < 2; i++) await chamarWebhook('acao_cliente', contexto, { tipo: 'mensagem', texto: `oi ${i}` });
  assert.equal((await chamarWebhook('acao_cliente', contexto, { tipo: 'mensagem', texto: 'excesso' })).status, 429);

  // Outra conta não vê nem revoga o portal de A.
  await comServidor(rotas, B, banco, shell, async (chamar) => {
    assert.equal((await chamar('GET', `/contatos/${clienteId}/portal`)).status, 404);
    assert.equal((await chamar('PATCH', `/contatos/${clienteId}/portal/revogar`)).status, 404);
  });
  await comServidor(rotas, A, banco, shell, async (chamar) => {
    assert.equal((await chamar('PATCH', `/contatos/${clienteId}/portal/revogar`)).status, 200);
    assert.equal((await chamar('GET', `/contatos/${clienteId}/portal`)).corpo.ativo, false);
  });
  assert.equal(banco.linhas('vitrine_publica').filter((l) => l.tipo === 'portal').length, 0);
  await comServidor(rotasPublicas, VISITANTE, banco, shell, async (chamar) => {
    assert.equal((await chamar('GET', `/vitrine/portal?t=${tokenDe(link)}`)).status, 404);
  });
});

test('cliente removido: portal e seleções param de abrir; imóvel vendido sai da seleção', async () => {
  const banco = new BancoFalso(UNICOS);
  const shell = shellFalso();
  let linkSelecao = '';
  let linkPortal = '';
  let imovelId = 0;
  let outroImovel = 0;
  await comServidor(rotas, A, banco, shell, async (chamar) => {
    const im = await imovelAnunciado(chamar, 'Apto 1', '61933330010');
    const im2 = await imovelAnunciado(chamar, 'Apto 2', '61933330011');
    imovelId = im.id;
    outroImovel = im2.id;
    const cliente = (await chamar('POST', '/contatos', { nome: 'Rafa Cliente', telefone: '61944440010' })).corpo;
    linkSelecao = (await chamar('POST', '/selecoes', { contato_id: cliente.id, imovel_ids: [im.id, im2.id] })).corpo.link;
    linkPortal = (await chamar('POST', `/contatos/${cliente.id}/portal`)).corpo.link;
    // Imóvel vendido: sai da seleção na hora; o outro continua.
    await chamar('PATCH', `/imoveis/${im.id}`, { situacao: 'vendido' });
    const linha = banco.linhas('vitrine_publica').find((l) => l.tipo === 'selecao')!;
    assert.deepEqual(linha.dados.itens.map((i: any) => i.titulo), ['Apto 2']);
    // Mudou o preço do outro: a seleção acompanha.
    await chamar('PATCH', `/imoveis/${im2.id}`, { preco: 1000000 });
    assert.equal(banco.linhas('vitrine_publica').find((l) => l.tipo === 'selecao')!.dados.itens[0].preco_c, 100000000);
    assert.equal((await chamar('PATCH', `/contatos/${cliente.id}/remover`)).status, 200);
  });
  assert.ok(!shell.ingressos.get(tokenDe(linkSelecao))!.ativo && !shell.ingressos.get(tokenDe(linkPortal))!.ativo, 'ingressos revogados');
  assert.equal(banco.linhas('vitrine_publica').filter((l) => l.tipo === 'selecao' || l.tipo === 'portal').length, 0);
  assert.ok(banco.linhas('acessos_cliente').every((a) => a.revogado_em) && banco.linhas('selecoes').every((x) => x.revogada_em));
  await comServidor(rotasPublicas, VISITANTE, banco, shell, async (chamar) => {
    assert.equal((await chamar('GET', `/vitrine/selecao?t=${tokenDe(linkSelecao)}`)).status, 404);
    assert.equal((await chamar('GET', `/vitrine/portal?t=${tokenDe(linkPortal)}`)).status, 404);
  });
  assert.ok(imovelId && outroImovel);
});

test('portal e reações com duas contas populadas: nada cruza; troca de reação; ingresso vencido não abre', async () => {
  limparLimites();
  const banco = new BancoFalso(UNICOS);
  const shell = shellFalso();
  const dados: Record<number, { cliente: number; visita: number; selecao: number; link: string; portal: string; codigo: string }> = {} as any;
  for (const [ator, tel] of [[A, '6195555000'], [B, '6196666000']] as const) {
    await comServidor(rotas, ator, banco, shell, async (chamar) => {
      const im = await imovelAnunciado(chamar, `Casa da conta ${ator.conta}`, `${tel}1`);
      const cliente = (await chamar('POST', '/contatos', { nome: `Cliente ${ator.conta}`, telefone: `${tel}2` })).corpo;
      const sel = (await chamar('POST', '/selecoes', { contato_id: cliente.id, imovel_ids: [im.id] })).corpo;
      const visita = (await chamar('POST', '/atividades', { tipo: 'visita', titulo: `Visita ${ator.conta}`, contato_id: cliente.id, imovel_id: im.id, quando: new Date(Date.now() + 86400e3).toISOString() })).corpo;
      const portal = (await chamar('POST', `/contatos/${cliente.id}/portal`)).corpo.link;
      dados[ator.conta!] = { cliente: cliente.id, visita: visita.id, selecao: sel.selecao.id, link: sel.link, portal, codigo: im.codigo };
    });
  }
  // O mesmo código de imóvel nas duas contas (é por conta) não confunde nada.
  assert.equal(dados[100].codigo, dados[200].codigo);
  await comServidor(rotasPublicas, VISITANTE, banco, shell, async (chamar) => {
    const pa = (await chamar('GET', `/vitrine/portal?t=${tokenDe(dados[100].portal)}`)).corpo.portal;
    assert.deepEqual(pa.agenda.map((v: any) => v.ref), [dados[100].visita]);
    assert.deepEqual(pa.selecoes.map((x: any) => x.itens[0].titulo), ['Casa da conta 100']);
    // Token de seleção não abre portal.
    assert.equal((await chamar('GET', `/vitrine/portal?t=${tokenDe(dados[100].link)}`)).status, 404);
  });
  const ctx = banco.ctxSistema([{ id: 100, nome: 'A' }, { id: 200, nome: 'B' }]);
  const reacao = (r: string) => ({ payload: { selecao_id: dados[100].selecao, imovel_codigo: dados[100].codigo, reacao: r, comentario: null }, conta_id: 100 });
  await reagir.reacao_recebida(reacao('gostei'), ctx);
  await reagir.reacao_recebida(reacao('nao_gostei'), ctx);
  const itens = banco.linhas('selecao_itens');
  assert.equal(itens.find((i) => i.selecao_id === dados[100].selecao)!.reacao, 'nao_gostei', 'a última reação vale');
  assert.equal(itens.find((i) => i.selecao_id === dados[200].selecao)!.reacao, undefined, 'a seleção de B não foi tocada');
  const vitrineA = banco.linhas('vitrine_publica').find((l) => l.tipo === 'selecao' && l.conta === 100)!;
  assert.equal(vitrineA.dados.itens[0].reacao, 'nao_gostei');
  // Cancelar a visita tira do portal.
  await comServidor(rotas, A, banco, shell, async (chamar) => {
    await chamar('PATCH', `/atividades/${dados[100].visita}`, { status: 'cancelada' });
  });
  assert.equal(banco.linhas('vitrine_publica').find((l) => l.tipo === 'portal' && l.conta === 100)!.dados.agenda.length, 0);
  assert.equal(banco.linhas('vitrine_publica').find((l) => l.tipo === 'portal' && l.conta === 200)!.dados.agenda.length, 1, 'o portal de B segue igual');
  // Seleção revogada: reação que chegue depois é ignorada.
  await comServidor(rotas, A, banco, shell, async (chamar) => {
    await chamar('PATCH', `/selecoes/${dados[100].selecao}/revogar`);
  });
  await reagir.reacao_recebida(reacao('gostei'), ctx);
  assert.equal(banco.linhas('selecao_itens').find((i) => i.selecao_id === dados[100].selecao)!.reacao, 'nao_gostei');
  // Ingresso vencido no shell: a seleção de B não abre.
  shell.ingressos.get(tokenDe(dados[200].link))!.expira_em = new Date(Date.now() - 1000).toISOString();
  await comServidor(rotasPublicas, VISITANTE, banco, shell, async (chamar) => {
    assert.equal((await chamar('GET', `/vitrine/selecao?t=${tokenDe(dados[200].link)}`)).status, 404);
  });
});

