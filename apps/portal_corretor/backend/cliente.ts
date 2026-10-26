import '@urbiverso/sdk/express';
import { Router, type Request } from 'express';
import { assincrono, erro, guardarCorretor, primeiro } from './acesso';
import { registrar } from './crm';
import { reclassificar } from './inteligencia';
import { apagarVitrine, corretorDaConta, limparSelecoesVencidas, publicarSelecao, revogarIngresso, selecaoValida, sincronizarPortal, tentarPortal } from './portal';
import { contaDoRequest, origemPublica, publicavel } from './vitrine';

// Seleções com reação e Portal do Cliente (bloco 5b, spec 11.3, D-56): o corretor monta e envia; o
// cliente abre por link com o token do ingresso `wh` (sem login) e reage pelo mesmo endereço.
export const clienteRotas: Router = Router();
guardarCorretor(clienteRotas, ['/selecoes', '/contatos', '/tarefas-cliente']);

const MAX_ITENS = 12;
const id = (v: unknown) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};
const eu = (req: Request) => req.contexto!.usuario.id;
const hoje = (req: Request) => new Date().toLocaleDateString('sv-SE', { timeZone: req.contexto?.fuso || 'America/Sao_Paulo' });
const texto = (v: unknown, limite: number) => (typeof v === 'string' ? v.trim().slice(0, limite) || null : null);

async function corretor(req: Request) {
  return corretorDaConta(req.dados!, contaDoRequest(req), eu(req), req.contexto!.usuario.nome);
}

/** Contato da conta de escrita (quem é membro de várias contas lê todas; aqui vale só a que escreve). */
async function contatoOu404(req: Request, bruto: unknown) {
  const cid = id(bruto);
  const c = cid ? await req.dados!.buscar('contatos', cid) : null;
  return c && Number(c.conta_id) === contaDoRequest(req) ? c : null;
}

// ---------- Seleções ----------

clienteRotas.get(
  '/selecoes',
  assincrono(async (req, res) => {
    const dados = req.dados!;
    const cid = id(req.query.contato_id);
    const conta = contaDoRequest(req);
    const r = await dados.listar('selecoes', { filtros: { conta_id: conta, ...(cid ? { contato_id: cid } : {}) }, ordenar: 'enviada_em', ordem: 'desc', por_pagina: 100 });
    const itens = r.dados.length ? await dados.varrerTudo('selecao_itens', { filtros: { selecao_id: r.dados.map((s) => s.id).join(',') }, ordenar: 'ordem', ordem: 'asc', maximo: 2000 }) : [];
    res.json({
      ...r,
      dados: r.dados.map((s) => ({ ...s, valida: selecaoValida(s), itens: itens.filter((i) => i.selecao_id === s.id) })),
    });
  }),
);

/** Cria e envia: guarda os imóveis, gera o link (ingresso com validade) e publica o retrato na vitrine. */
clienteRotas.post(
  '/selecoes',
  assincrono(async (req, res) => {
    const dados = req.dados!;
    const contato = await contatoOu404(req, req.body?.contato_id);
    if (!contato) return erro(res, 422, 'DADOS_INVALIDOS', 'Escolha o cliente.');
    const titulo = texto(req.body?.titulo, 120) ?? 'Imóveis para você';
    const mensagem = texto(req.body?.mensagem, 1000);
    const ids = [...new Set((Array.isArray(req.body?.imovel_ids) ? req.body.imovel_ids : []).map(id).filter((x: number | null): x is number => !!x))] as number[];
    if (!ids.length || ids.length > MAX_ITENS) return erro(res, 422, 'DADOS_INVALIDOS', `Escolha de 1 a ${MAX_ITENS} imóveis.`);
    const contaId = contaDoRequest(req);
    const imoveis = await dados.varrerTudo('imoveis', { filtros: { id: ids.join(','), conta_id: contaId }, maximo: MAX_ITENS });
    const autorizacoes = imoveis.length ? await dados.varrerTudo('autorizacoes_venda', { filtros: { imovel_id: ids.join(','), conta_id: contaId }, maximo: 500 }) : [];
    const dia = hoje(req);
    // Só imóvel anunciado e com autorização vigente vai ao cliente (como a página, sem exigir estar nela).
    const fora = ids.filter((i) => {
      const im = imoveis.find((x) => x.id === i);
      return !im || !publicavel({ ...im, publicado_pagina: true }, autorizacoes.filter((a) => a.imovel_id === i), dia);
    });
    if (fora.length) return erro(res, 422, 'IMOVEL_NAO_ANUNCIAVEL', 'Só vão na seleção imóveis ativos ou reservados, com autorização de venda vigente.');
    const config = await primeiro(dados, 'configuracoes_conta', { chave: 'conta' });
    const dias = Number(config?.validade_selecao_dias) || 14;
    const expira = new Date(Date.now() + dias * 86400e3);
    const agora = new Date().toISOString();
    const conta = contaDoRequest(req);
    const selecao = await dados.transaction(async (trx) => {
      const s = await trx.criar('selecoes', { contato_id: contato.id, titulo, mensagem, enviada_em: agora, expira_em: expira.toISOString(), criada_por_id: eu(req) });
      for (const [ordem, imovelId] of ids.entries()) await trx.criar('selecao_itens', { selecao_id: s.id, imovel_id: imovelId, ordem });
      return s;
    });
    // Ingresso, link e vitrine depois da transação: se algo falhar aqui, a seleção pela metade é
    // desfeita (sem link ela não teria como ser revogada pela ficha) e o ingresso, revogado.
    let ingresso: number | null = null;
    let salva: Record<string, any> | null;
    let link: string;
    try {
      const g = await req.shell!.gerarIngressoWh({ webhook: 'reacao_selecao', contexto: { conta_id: conta, selecao_id: selecao.id }, expira_em: expira });
      ingresso = g.ingresso_id;
      link = `${origemPublica(g.url)}/portal_corretor/s?t=${g.token}`;
      salva = await dados.atualizar('selecoes', selecao.id, { ingresso_id: g.ingresso_id, url_reacao: g.url, link });
      await publicarSelecao(dados, conta, salva!, await corretor(req));
    } catch (e) {
      // Cada passo da limpeza tenta por si: um shell instável não deixa a vitrine viva.
      const passo = async (nome: string, fn: () => Promise<unknown>) => {
        try {
          await fn();
        } catch (limpeza) {
          console.warn(`[portal_corretor] seleção ${selecao.id}: ${nome} não concluído depois da falha: ${(limpeza as Error).message}`);
        }
      };
      if (ingresso) await passo('revogar o ingresso', () => revogarIngresso(req.shell!, 'reacao_selecao', ingresso!));
      await passo('apagar da vitrine', () => apagarVitrine(dados, conta, 'selecao', selecao.id));
      await passo('apagar a seleção', async () => {
        for (const i of await dados.varrerTudo('selecao_itens', { filtros: { selecao_id: selecao.id }, maximo: 50 })) await dados.deletar('selecao_itens', i.id);
        await dados.deletar('selecoes', selecao.id);
      });
      throw e;
    }
    await dados.criar('envios', { contato_id: contato.id, tipo: 'selecao', canal: 'whatsapp', autor_tipo: 'humano', descricao: `${titulo} (${ids.length} imóveis)`.slice(0, 300), enviado_em: agora, cliques: 0 });
    await registrar(dados, req, { tipo: 'selecao.enviada', alvo_tipo: 'contato', alvo_id: contato.id, contato_id: contato.id, resumo: `Seleção enviada: ${titulo} (${ids.length} imóveis)`, dados: { selecao_id: selecao.id } });
    await dados.atualizar('contatos', contato.id, { ultimo_contato_em: agora });
    await reclassificar(dados, contato.id);
    await tentarPortal(dados, conta, contato.id, await corretor(req));
    // Arrumação: a seleção já está no ar, então uma falha aqui não vira erro para o corretor.
    await limparSelecoesVencidas(dados, conta).catch((e) => console.warn(`[portal_corretor] limpeza de seleções vencidas: ${(e as Error).message}`));
    res.status(201).json({ selecao: salva, link });
  }),
);

clienteRotas.patch(
  '/selecoes/:id/revogar',
  assincrono(async (req, res) => {
    const dados = req.dados!;
    const sid = id(req.params.id);
    const lida = sid ? await dados.buscar('selecoes', sid) : null;
    const s = lida && Number(lida.conta_id) === contaDoRequest(req) ? lida : null;
    if (!s) return erro(res, 404, 'NAO_ENCONTRADO', 'Seleção não encontrada.');
    if (!s.revogada_em) {
      if (s.ingresso_id) await revogarIngresso(req.shell!, 'reacao_selecao', s.ingresso_id);
      await dados.atualizar('selecoes', s.id, { revogada_em: new Date().toISOString() });
    }
    const conta = contaDoRequest(req);
    await apagarVitrine(dados, conta, 'selecao', s.id);
    await tentarPortal(dados, conta, s.contato_id);
    res.json({ id: s.id, revogada: true });
  }),
);

// ---------- Portal do Cliente ----------

async function acessoAtivo(req: Request, contatoId: number) {
  return primeiro(req.dados!, 'acessos_cliente', { contato_id: contatoId, 'revogado_em[nulo]': 'true' });
}

clienteRotas.get(
  '/contatos/:id/portal',
  assincrono(async (req, res) => {
    const contato = await contatoOu404(req, req.params.id);
    if (!contato) return erro(res, 404, 'NAO_ENCONTRADO', 'Contato não encontrado.');
    const a = await acessoAtivo(req, contato.id);
    res.json({ ativo: !!a, link: a?.link ?? null, criado_em: a?.criado_em ?? null });
  }),
);

/** Gera (ou devolve) o link do portal do cliente: um por cliente, sem validade, revogável. */
clienteRotas.post(
  '/contatos/:id/portal',
  assincrono(async (req, res) => {
    const dados = req.dados!;
    const contato = await contatoOu404(req, req.params.id);
    if (!contato) return erro(res, 404, 'NAO_ENCONTRADO', 'Contato não encontrado.');
    const conta = contaDoRequest(req);
    const existente = await acessoAtivo(req, contato.id);
    if (existente) {
      await sincronizarPortal(dados, conta, contato.id, await corretor(req));
      return res.json({ ativo: true, link: existente.link, novo: false });
    }
    const g = await req.shell!.gerarIngressoWh({ webhook: 'acao_cliente', contexto: { conta_id: conta, contato_id: contato.id } });
    const link = `${origemPublica(g.url)}/portal_corretor/c?t=${g.token}`;
    try {
      await dados.criar('acessos_cliente', { contato_id: contato.id, perfil: 'comprador', ingresso_id: g.ingresso_id, url_acoes: g.url, link, criado_por_id: eu(req) });
    } catch (e) {
      // Dois cliques ao mesmo tempo: fica o link que entrou primeiro, e este ingresso é revogado.
      if ((e as { code?: string })?.code !== '23505') throw e;
      await revogarIngresso(req.shell!, 'acao_cliente', g.ingresso_id);
      const venceu = await acessoAtivo(req, contato.id);
      return res.json({ ativo: true, link: venceu?.link ?? null, novo: false });
    }
    await sincronizarPortal(dados, conta, contato.id, await corretor(req));
    await dados.criar('envios', { contato_id: contato.id, tipo: 'link_portal', canal: 'whatsapp', autor_tipo: 'humano', descricao: 'Link do portal do cliente', enviado_em: new Date().toISOString(), cliques: 0 });
    await registrar(dados, req, { tipo: 'portal.criado', alvo_tipo: 'contato', alvo_id: contato.id, contato_id: contato.id, resumo: 'Link do portal do cliente gerado' });
    res.status(201).json({ ativo: true, link, novo: true });
  }),
);

clienteRotas.patch(
  '/contatos/:id/portal/revogar',
  assincrono(async (req, res) => {
    const dados = req.dados!;
    const contato = await contatoOu404(req, req.params.id);
    if (!contato) return erro(res, 404, 'NAO_ENCONTRADO', 'Contato não encontrado.');
    const a = await acessoAtivo(req, contato.id);
    if (a) {
      if (a.ingresso_id) await revogarIngresso(req.shell!, 'acao_cliente', a.ingresso_id);
      await dados.atualizar('acessos_cliente', a.id, { revogado_em: new Date().toISOString() });
      await registrar(dados, req, { tipo: 'portal.revogado', alvo_tipo: 'contato', alvo_id: contato.id, contato_id: contato.id, resumo: 'Link do portal do cliente revogado' });
    }
    await apagarVitrine(dados, contaDoRequest(req), 'portal', contato.id);
    res.json({ ativo: false });
  }),
);

// ---------- O que falta do cliente (bloco 9) ----------
// Pendências que o corretor pede ao cliente ("enviar a documentação"); o portal lista as abertas e
// o cliente marca "feito" pelo webhook `acao_cliente` (tipo `tarefa_feita`).

const MAX_TAREFAS_ABERTAS = 20;

clienteRotas.get(
  '/contatos/:id/tarefas-cliente',
  assincrono(async (req, res) => {
    const contato = await contatoOu404(req, req.params.id);
    if (!contato) return erro(res, 404, 'NAO_ENCONTRADO', 'Contato não encontrado.');
    const r = await req.dados!.listar('tarefas_cliente', { filtros: { conta_id: contaDoRequest(req), contato_id: contato.id }, ordenar: 'criado_em', ordem: 'desc', por_pagina: 100 });
    res.json({ dados: r.dados });
  }),
);

clienteRotas.post(
  '/contatos/:id/tarefas-cliente',
  assincrono(async (req, res) => {
    const dados = req.dados!;
    const contato = await contatoOu404(req, req.params.id);
    if (!contato) return erro(res, 404, 'NAO_ENCONTRADO', 'Contato não encontrado.');
    const t = texto(req.body?.texto, 200);
    if (!t) return erro(res, 422, 'DADOS_INVALIDOS', 'Escreva o que falta do cliente.');
    const conta = contaDoRequest(req);
    const abertas = await dados.varrerTudo('tarefas_cliente', { filtros: { conta_id: conta, contato_id: contato.id, 'feita_em[nulo]': 'true' }, maximo: MAX_TAREFAS_ABERTAS + 1 });
    if (abertas.length >= MAX_TAREFAS_ABERTAS) return erro(res, 422, 'LIMITE', `O cliente já tem ${MAX_TAREFAS_ABERTAS} pendências abertas. Remova alguma antes.`);
    const tarefa = await dados.criar('tarefas_cliente', { contato_id: contato.id, texto: t, criada_por_id: eu(req) });
    await registrar(dados, req, { tipo: 'portal.tarefa_pedida', alvo_tipo: 'contato', alvo_id: contato.id, contato_id: contato.id, resumo: `Pediu ao cliente: ${t}` });
    await tentarPortal(dados, conta, contato.id, await corretor(req));
    res.status(201).json(tarefa);
  }),
);

clienteRotas.patch(
  '/tarefas-cliente/:id/remover',
  assincrono(async (req, res) => {
    const dados = req.dados!;
    const tid = id(req.params.id);
    const lida = tid ? await dados.buscar('tarefas_cliente', tid) : null;
    const conta = contaDoRequest(req);
    if (!lida || Number(lida.conta_id) !== conta) return erro(res, 404, 'NAO_ENCONTRADO', 'Pendência não encontrada.');
    await dados.remover('tarefas_cliente', lida.id, eu(req));
    await tentarPortal(dados, conta, lida.contato_id);
    res.json({ id: lida.id, removido: true });
  }),
);
