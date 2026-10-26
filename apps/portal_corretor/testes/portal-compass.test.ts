import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rotas, rotasPublicas, webhooks, reagir } from '../backend/rotas';
import { limparLimites } from '../backend/publico';
import { BancoFalso, comServidor, type Ator } from './apoio';

// Bloco 9 (#59): Portal do Cliente no modelo Compass One — próximo passo para o cliente, datas-chave,
// "o que falta de você" (tarefas_cliente + webhook acao_cliente tipo tarefa_feita) e jornada em eventos.

const UNICOS = { contatos: ['telefone'], imoveis: ['codigo'], visitas: ['atividade_id'], etapas_funil: ['pipeline+nome'], origens: ['canal+campanha'], vitrine_publica: ['tipo+chave'], selecao_itens: ['selecao_id+imovel_id'] };
const arquivos = { url: async (arquivo: number) => `/arquivo/${arquivo}` };
const A: Ator = { usuario: 1, conta: 100, papeis: ['corretor'], extras: { arquivos } };
const B: Ator = { usuario: 2, conta: 200, papeis: ['corretor'], extras: { arquivos } };
const VISITANTE: Ator = { usuario: 0, conta: null, papeis: [], extras: { arquivos } };
const HOJE = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
const dia = (delta: number) => new Date(Date.now() + delta * 86400e3).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });

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
      if (!i || i.webhook !== webhook || !i.ativo) throw Object.assign(new Error('inválido'), { codigo: 'WH_INGRESSO_INVALIDO' });
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
  await chamar('PATCH', `/imoveis/${im.id}`, { preco: 990000, quartos: 3, vagas: 2 });
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

async function chamarWebhook(contexto: any, corpo: unknown, ip = '10.9.0.1') {
  const publicados: { tipo: string; payload: any; opcoes: any }[] = [];
  const r = resposta();
  const req: any = { body: corpo, headers: {}, ip, wh: { webhook: 'acao_cliente', modo: 'recorrente', ingresso_id: 1, contexto, contador_usos: 0, criado_por: 1 }, eventos: { publicar: async (tipo: string, payload: any, opcoes: any) => publicados.push({ tipo, payload, opcoes }) } };
  await webhooks.acao_cliente(req, r.res);
  return { ...r, publicados };
}

const tokenDe = (link: string) => new URL(link).searchParams.get('t')!;
const portalDe = (banco: BancoFalso, conta: number) => banco.linhas('vitrine_publica').find((l) => l.tipo === 'portal' && l.conta === conta)!;

test('próximo passo para o cliente: só ele vai ao portal, e só quando preenchido; o interno nunca sai', async () => {
  const banco = new BancoFalso(UNICOS);
  const shell = shellFalso();
  let link = '';
  let clienteId = 0;
  await comServidor(rotas, A, banco, shell, async (chamar) => {
    const cliente = (await chamar('POST', '/contatos', { nome: 'Nina Compradora', telefone: '61944449001', email: 'nina@exemplo.com' })).corpo;
    clienteId = cliente.id;
    link = (await chamar('POST', `/contatos/${cliente.id}/portal`)).corpo.link;
    await chamar('PATCH', `/contatos/${cliente.id}`, { proximo_passo: 'Ligar para negociar desconto escondido', proximo_passo_em: new Date(Date.now() + 86400e3).toISOString() });
  });
  assert.equal('proximo_passo' in portalDe(banco, 100).dados, false, 'vazio não vai à vitrine');
  await comServidor(rotas, A, banco, shell, async (chamar) => {
    const r = await chamar('PATCH', `/contatos/${clienteId}`, { proximo_passo_cliente: 'Visita sábado às 10h' });
    assert.equal(r.status, 200, JSON.stringify(r.corpo));
    assert.equal(r.corpo.proximo_passo_cliente, 'Visita sábado às 10h');
  });
  const texto = JSON.stringify(portalDe(banco, 100));
  assert.equal(portalDe(banco, 100).dados.proximo_passo, 'Visita sábado às 10h');
  for (const proibido of ['desconto escondido', 'Nina', '61944449001', 'nina@']) assert.ok(!texto.includes(proibido), `portal sem ${proibido}`);
  assert.ok(banco.linhas('linha_do_tempo').some((l) => l.tipo === 'contato.proximo_passo_cliente'));
  await comServidor(rotasPublicas, VISITANTE, banco, shell, async (chamar) => {
    assert.equal((await chamar('GET', `/vitrine/portal?t=${tokenDe(link)}`)).corpo.portal.proximo_passo, 'Visita sábado às 10h');
  });
  // Apagar o texto tira do portal.
  await comServidor(rotas, A, banco, shell, async (chamar) => {
    await chamar('PATCH', `/contatos/${clienteId}`, { proximo_passo_cliente: '' });
  });
  assert.equal('proximo_passo' in portalDe(banco, 100).dados, false);
});

test('o que falta do cliente: corretor pede, portal lista, cliente marca feito pelo webhook; nada cruza contas', async () => {
  limparLimites();
  const banco = new BancoFalso(UNICOS);
  const shell = shellFalso();
  const d: Record<number, { cliente: number; link: string; tarefa: number }> = {};
  for (const [ator, tel] of [[A, '6197777000'], [B, '6198888000']] as const) {
    await comServidor(rotas, ator, banco, shell, async (chamar) => {
      const cliente = (await chamar('POST', '/contatos', { nome: `Cliente ${ator.conta}`, telefone: `${tel}1` })).corpo;
      const link = (await chamar('POST', `/contatos/${cliente.id}/portal`)).corpo.link;
      assert.equal((await chamar('POST', `/contatos/${cliente.id}/tarefas-cliente`, { texto: '   ' })).status, 422);
      const t = await chamar('POST', `/contatos/${cliente.id}/tarefas-cliente`, { texto: `Enviar a documentação ${ator.conta}` });
      assert.equal(t.status, 201, JSON.stringify(t.corpo));
      d[ator.conta!] = { cliente: cliente.id, link, tarefa: t.corpo.id };
    });
  }
  assert.ok(banco.linhas('linha_do_tempo').some((l) => l.tipo === 'portal.tarefa_pedida' && l.contato_id === d[100].cliente));
  assert.deepEqual(portalDe(banco, 100).dados.tarefas, [{ ref: d[100].tarefa, texto: 'Enviar a documentação 100' }]);

  // Isolamento das rotas: B não lista, não cria e não remove nada de A.
  await comServidor(rotas, B, banco, shell, async (chamar) => {
    assert.equal((await chamar('GET', `/contatos/${d[100].cliente}/tarefas-cliente`)).status, 404);
    assert.equal((await chamar('POST', `/contatos/${d[100].cliente}/tarefas-cliente`, { texto: 'invasão' })).status, 404);
    assert.equal((await chamar('PATCH', `/tarefas-cliente/${d[100].tarefa}/remover`)).status, 404);
    assert.deepEqual((await chamar('GET', `/contatos/${d[200].cliente}/tarefas-cliente`)).corpo.dados.map((t: any) => t.id), [d[200].tarefa]);
  });
  // Sem papel de corretor, a rota recusa.
  await comServidor(rotas, { usuario: 7, conta: 100, papeis: [] }, banco, shell, async (chamar) => {
    assert.equal((await chamar('GET', `/contatos/${d[100].cliente}/tarefas-cliente`)).status, 403);
  });

  // O portal público mostra a pendência.
  await comServidor(rotasPublicas, VISITANTE, banco, shell, async (chamar) => {
    const p = (await chamar('GET', `/vitrine/portal?t=${tokenDe(d[100].link)}`)).corpo.portal;
    assert.deepEqual(p.tarefas, [{ ref: d[100].tarefa, texto: 'Enviar a documentação 100' }]);
  });

  // Webhook: tarefa obrigatória; a conta vem do ingresso, nunca do corpo.
  const ctxA = { conta_id: 100, contato_id: d[100].cliente };
  assert.equal((await chamarWebhook(ctxA, { tipo: 'tarefa_feita' })).status, 422, 'sem tarefa');
  assert.equal((await chamarWebhook(ctxA, { tipo: 'tarefa_feita', tarefa: 'abc' })).status, 422);
  assert.equal((await chamarWebhook(null, { tipo: 'tarefa_feita', tarefa: d[100].tarefa })).status, 422, 'sem ingresso válido');
  const ok = await chamarWebhook(ctxA, { tipo: 'tarefa_feita', tarefa: d[100].tarefa, conta_id: 200, texto: 'ignorado' });
  assert.equal(ok.status, 200);
  assert.deepEqual([ok.publicados[0].tipo, ok.publicados[0].opcoes.conta_id, ok.publicados[0].payload.tarefa, ok.publicados[0].payload.texto], ['acao_cliente_recebida', 100, d[100].tarefa, null]);

  const ctx = banco.ctxSistema([{ id: 100, nome: 'A' }, { id: 200, nome: 'B' }]);
  // Tarefa de outra conta (o cliente de A tenta marcar a de B): ignorada.
  const alheia = await chamarWebhook(ctxA, { tipo: 'tarefa_feita', tarefa: d[200].tarefa });
  await reagir.acao_cliente_recebida({ payload: alheia.publicados[0].payload, conta_id: 100 }, ctx);
  assert.equal(banco.linhas('tarefas_cliente').find((t) => t.id === d[200].tarefa)!.feita_em, undefined);
  // A de verdade: feita, na linha do tempo, sai do portal; o evento repetido não duplica nada.
  await reagir.acao_cliente_recebida({ payload: ok.publicados[0].payload, conta_id: 100 }, ctx);
  await reagir.acao_cliente_recebida({ payload: ok.publicados[0].payload, conta_id: 100 }, ctx);
  assert.ok(banco.linhas('tarefas_cliente').find((t) => t.id === d[100].tarefa)!.feita_em);
  assert.equal(banco.linhas('linha_do_tempo').filter((l) => l.tipo === 'portal.tarefa_feita').length, 1);
  assert.deepEqual(portalDe(banco, 100).dados.tarefas, []);
  assert.ok(portalDe(banco, 100).dados.jornada.eventos.some((e: any) => e.tipo === 'tarefa' && e.texto === 'Feito: Enviar a documentação 100'));
  assert.equal(portalDe(banco, 200).dados.tarefas.length, 1, 'o portal de B segue igual');
  // Evento endereçado à conta errada não toca a tarefa de B.
  await reagir.acao_cliente_recebida({ payload: { ...alheia.publicados[0].payload, contato_id: d[100].cliente }, conta_id: 200 }, ctx);
  assert.equal(banco.linhas('tarefas_cliente').find((t) => t.id === d[200].tarefa)!.feita_em, undefined);

  // Na ficha, o corretor vê a feita; remover (soft delete) tira da lista e do portal.
  await comServidor(rotas, A, banco, shell, async (chamar) => {
    const lista = (await chamar('GET', `/contatos/${d[100].cliente}/tarefas-cliente`)).corpo.dados;
    assert.ok(lista[0].feita_em);
    const nova = (await chamar('POST', `/contatos/${d[100].cliente}/tarefas-cliente`, { texto: 'Confirmar a visita' })).corpo;
    assert.equal(portalDe(banco, 100).dados.tarefas.length, 1);
    assert.equal((await chamar('PATCH', `/tarefas-cliente/${nova.id}/remover`)).status, 200);
    assert.equal((await chamar('PATCH', `/tarefas-cliente/${nova.id}/remover`)).status, 404, 'removida não existe mais');
    assert.equal(portalDe(banco, 100).dados.tarefas.length, 0);
    assert.ok(banco.linhas('tarefas_cliente').find((t) => t.id === nova.id)!.removido_em, 'soft delete');
  });

  // Limite por origem: o mesmo de hoje, 5 ações por minuto por cliente.
  limparLimites();
  for (let i = 0; i < 5; i++) assert.equal((await chamarWebhook(ctxA, { tipo: 'tarefa_feita', tarefa: d[100].tarefa }, '10.9.9.9')).status, 200);
  assert.equal((await chamarWebhook(ctxA, { tipo: 'tarefa_feita', tarefa: d[100].tarefa }, '10.9.9.9')).status, 429);
});

test('jornada vira eventos (começo, seleção recebida, visita feita) sem dado interno; datas-chave no portal', async () => {
  const banco = new BancoFalso(UNICOS);
  const shell = shellFalso();
  let link = '';
  await comServidor(rotas, A, banco, shell, async (chamar) => {
    const im = await imovelAnunciado(chamar, 'Apto com varanda', '61933339001');
    const cliente = (await chamar('POST', '/contatos', { nome: 'Teo Cliente', telefone: '61944449002' })).corpo;
    link = (await chamar('POST', `/contatos/${cliente.id}/portal`)).corpo.link;
    await chamar('POST', '/selecoes', { contato_id: cliente.id, titulo: 'Aptos no Noroeste', imovel_ids: [im.id] });
    const ontem = new Date(Date.now() - 3600e3).toISOString();
    const feita = (await chamar('POST', '/atividades', { tipo: 'visita', titulo: 'Visita interna com nota sigilosa', contato_id: cliente.id, imovel_id: im.id, quando: ontem })).corpo;
    await chamar('PATCH', `/atividades/${feita.id}`, { status: 'feita' });
    await chamar('POST', '/atividades', { tipo: 'visita', titulo: 'Próxima', contato_id: cliente.id, imovel_id: im.id, quando: new Date(Date.now() + 2 * 86400e3).toISOString() });
  });
  const p = portalDe(banco, 100).dados;
  const tipos = p.jornada.eventos.map((e: any) => e.tipo);
  assert.deepEqual([...tipos].sort(), ['inicio', 'selecao', 'visita']);
  assert.equal(tipos[tipos.length - 1], 'inicio', 'o começo fica embaixo (mais recente primeiro)');
  assert.ok(p.jornada.eventos.some((e: any) => e.texto === 'Recebeu 1 imóvel: Aptos no Noroeste'));
  assert.ok(p.jornada.eventos.some((e: any) => e.texto === 'Visitou Apto com varanda, Noroeste'));
  assert.ok(!JSON.stringify(p).includes('sigilosa'), 'título interno da visita não vai');
  assert.equal(p.jornada.visitas_feitas, 1);
  await comServidor(rotasPublicas, VISITANTE, banco, shell, async (chamar) => {
    const r = (await chamar('GET', `/vitrine/portal?t=${tokenDe(link)}`)).corpo.portal;
    // As datas-chave saem da agenda (próxima visita) e da validade das seleções.
    assert.equal(r.agenda.length, 1);
    assert.ok(r.agenda[0].quando > new Date().toISOString());
    assert.ok(r.selecoes[0].expira_em);
    assert.equal(r.selecoes[0].itens[0].vagas, 2);
    assert.deepEqual(r.tarefas, []);
  });
});
