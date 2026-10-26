import '@urbiverso/sdk/express';
import { Router, type Request, type Response } from 'express';
import { createHash } from 'node:crypto';
import type { ContextoListener, HelperDados } from '@urbiverso/sdk';
import { ETAPAS_PADRAO } from '../comum/crm';
import { iso, MARCO_PADRAO } from '../comum/funil';
import { validarLead } from '../comum/pagina';
import { reclassificar } from './inteligencia';
import { publicarSelecao, selecaoValida, sincronizarPortal } from './portal';
import { aoPublicacaoProgramada } from './instagram';
import { aoLembreteVisita } from './lembretes';

// Superfícies públicas do bloco 5 (paginas-publicas.md, wh.md, D-55):
// - rotas GET anônimas que leem só a vitrine pública (a página, a ficha do imóvel, o link);
// - webhooks recorrentes por conta (formulário de contato e clique no link), que só validam,
//   publicam um evento segregado com a conta do ingresso e respondem — o `req.dados` do handler
//   de wh não serve em app segregada (contas.md § Modo de conexão);
// - listeners que gravam na conta do evento, por `comConta` (contexto SISTEMA).

type Linha = Record<string, any>;
const TTL_FOTO = 6 * 3600;

export const rotasPublicas: Router = Router();

async function vitrine(dados: HelperDados, filtros: Record<string, unknown>) {
  const r = await dados.listar('vitrine_publica', { filtros, por_pagina: 1 });
  return r.dados[0] ?? null;
}

async function urlFoto(req: Request, arquivo: number | undefined): Promise<string | null> {
  if (!arquivo || !req.arquivos) return null;
  try {
    return await req.arquivos.url(arquivo, TTL_FOTO);
  } catch {
    return null; // foto que saiu não derruba a página
  }
}

/** Autorização vencida desde a última publicação: o anúncio some sozinho (data civil, fuso de Brasília). */
const hoje = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
const noPrazo = (l: Linha | null) => !!l && (!l.dados?.vigente_ate || String(l.dados.vigente_ate) >= hoje());

const texto = (v: unknown, limite: number) => (typeof v === 'string' ? v.trim().slice(0, limite) : '');
const naoEncontrado = (res: Response) => res.status(404).json({ erro: true, codigo: 'NAO_ENCONTRADO', mensagem: 'Página não encontrada.' });

/** Página do corretor com os cartões dos imóveis publicados. */
rotasPublicas.get('/vitrine/pagina', async (req, res, next) => {
  try {
    const endereco = texto(req.query.c, 40).toLowerCase();
    const pagina = endereco ? await vitrine(req.dados!, { tipo: 'pagina', chave: endereco }) : null;
    if (!pagina) return naoEncontrado(res);
    const imoveis = await req.dados!.varrerTudo('vitrine_publica', { filtros: { tipo: 'imovel', conta: pagina.conta }, ordenar: 'publicado_em', ordem: 'desc', maximo: 2000 });
    const cartoes = await Promise.all(
      imoveis.filter(noPrazo).map(async (l) => {
        const im = l.dados as Linha;
        return {
          codigo: im.codigo, titulo: im.titulo, tipo: im.tipo, situacao: im.situacao, preco_c: im.preco_c,
          bairro: im.bairro, cidade: im.cidade, quartos: im.quartos, area_util_m2: im.area_util_m2 ?? im.area_total_m2, vagas: im.vagas,
          capa: await urlFoto(req, im.fotos?.[0]?.arquivo),
        };
      }),
    );
    res.json({ pagina: pagina.dados, imoveis: cartoes });
  } catch (e) {
    next(e);
  }
});

/** Ficha pública de um imóvel da página. */
rotasPublicas.get('/vitrine/imovel', async (req, res, next) => {
  try {
    const endereco = texto(req.query.c, 40).toLowerCase();
    const codigo = texto(req.query.i, 30);
    const pagina = endereco && codigo ? await vitrine(req.dados!, { tipo: 'pagina', chave: endereco }) : null;
    const linha = pagina ? await vitrine(req.dados!, { tipo: 'imovel', conta: pagina.conta, codigo }) : null;
    if (!pagina || !noPrazo(linha)) return naoEncontrado(res);
    const { vigente_ate: _prazo, ...im } = linha!.dados as Linha;
    const fotos = await Promise.all((im.fotos ?? []).map(async (f: Linha) => ({ url: await urlFoto(req, f.arquivo), legenda: f.legenda ?? null })));
    res.json({ pagina: pagina.dados, imovel: { ...im, fotos: fotos.filter((f) => f.url) } });
  } catch (e) {
    next(e);
  }
});

/**
 * Link rastreado: para onde vai e onde contar o clique (a contagem entra pelo wh `clique_link`).
 * O endereço de contagem é o da página no ar agora; sem página no ar, nada a contar.
 */
rotasPublicas.get('/vitrine/link', async (req, res, next) => {
  try {
    const codigo = texto(req.query.c, 24);
    const link = codigo ? await vitrine(req.dados!, { tipo: 'link', chave: codigo }) : null;
    if (!link) return naoEncontrado(res);
    const imovel = link.dados?.imovel_chave ? await vitrine(req.dados!, { tipo: 'imovel', conta: link.conta, chave: link.dados.imovel_chave }) : null;
    const pagina = await vitrine(req.dados!, { tipo: 'pagina', conta: link.conta });
    res.json({
      destino: imovel && noPrazo(imovel) && pagina ? `/portal_corretor/p?c=${encodeURIComponent(pagina.chave)}&i=${encodeURIComponent(imovel.codigo)}` : null,
      url_clique: pagina?.dados?.url_clique ?? null,
    });
  } catch (e) {
    next(e);
  }
});

// ---------- Seleção e Portal do Cliente (bloco 5b): o token do ingresso é a credencial ----------

const FORMATO_TOKEN = /^wh_[A-Za-z0-9_]{8,80}$/;

/** Contexto do ingresso pelo token, sem consumir (wh.md § Inspecionar); token inválido, vencido ou revogado → `null`. */
async function contextoDoToken(req: Request, webhook: string, token: string): Promise<Linha | null> {
  if (!FORMATO_TOKEN.test(token)) return null;
  try {
    const r = await req.shell!.inspecionarIngressoWh({ webhook, token });
    return r.contexto ?? null;
  } catch (e) {
    // Qualquer recusa do framework de webhooks (token inválido, webhook desligado ou fora do
    // manifesto, parâmetro fora da forma) é "não encontrado" para o visitante.
    if (String((e as { codigo?: string })?.codigo ?? '').startsWith('WH_')) return null;
    throw e;
  }
}

const idDe = (v: unknown) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

/** Topo da seleção e do portal: a foto do corretor sai como URL assinada, nunca como id de arquivo. */
async function corretorPublico(req: Request, c: Linha | null | undefined) {
  if (!c) return null;
  const { foto, ...resto } = c;
  return { ...resto, foto_url: await urlFoto(req, foto ?? undefined) };
}

/** Seleção com as URLs das fotos (assinadas na hora); vencida ou fora da vitrine → `null`. */
async function selecaoPublica(req: Request, conta: number, selecaoId: number) {
  const linha = await vitrine(req.dados!, { tipo: 'selecao', conta, chave: `${conta}:${selecaoId}` });
  if (!linha) return null;
  const s = linha.dados as Linha;
  if (s.expira_em && String(s.expira_em) <= new Date().toISOString()) return null;
  const itens = await Promise.all(
    (s.itens ?? []).map(async (i: Linha) => ({
      ...i,
      fotos: (await Promise.all((i.fotos ?? []).map(async (f: Linha) => ({ url: await urlFoto(req, f.arquivo), legenda: f.legenda ?? null })))).filter((f) => f.url),
    })),
  );
  return { id: selecaoId, ...s, corretor: await corretorPublico(req, s.corretor), itens };
}

rotasPublicas.get('/vitrine/selecao', async (req, res, next) => {
  try {
    const ctx = await contextoDoToken(req, 'reacao_selecao', texto(req.query.t, 90));
    const conta = idDe(ctx?.conta_id);
    const selecaoId = idDe(ctx?.selecao_id);
    const selecao = conta && selecaoId ? await selecaoPublica(req, conta, selecaoId) : null;
    if (!selecao) return res.status(404).json({ erro: true, codigo: 'NAO_ENCONTRADO', mensagem: 'Seleção expirada ou indisponível.' });
    res.json({ selecao });
  } catch (e) {
    next(e);
  }
});

rotasPublicas.get('/vitrine/portal', async (req, res, next) => {
  try {
    const ctx = await contextoDoToken(req, 'acao_cliente', texto(req.query.t, 90));
    const conta = idDe(ctx?.conta_id);
    const contatoId = idDe(ctx?.contato_id);
    const portal = conta && contatoId ? await vitrine(req.dados!, { tipo: 'portal', conta, chave: `${conta}:${contatoId}` }) : null;
    if (!portal) return res.status(404).json({ erro: true, codigo: 'NAO_ENCONTRADO', mensagem: 'Portal indisponível.' });
    const p = portal.dados as Linha;
    const selecoes = (await Promise.all((p.selecoes ?? []).map((sid: number) => selecaoPublica(req, conta!, sid)))).filter(Boolean);
    res.json({
      portal: {
        corretor: await corretorPublico(req, p.corretor), url_acoes: p.url_acoes, proximo_passo: p.proximo_passo ?? null,
        agenda: p.agenda ?? [], tarefas: p.tarefas ?? [], jornada: p.jornada ?? null, selecoes,
      },
    });
  } catch (e) {
    next(e);
  }
});

// ---------- Webhooks ----------

/** Limite por origem em memória (7.3: 3 envios por minuto por IP). Só o hash do IP, nunca gravado. */
const janelas = new Map<string, number[]>();
export function dentroDoLimite(chave: string, maximo: number, agora = Date.now()): boolean {
  const recentes = (janelas.get(chave) ?? []).filter((t) => agora - t < 60_000);
  if (recentes.length >= maximo) {
    janelas.set(chave, recentes);
    return false;
  }
  recentes.push(agora);
  janelas.set(chave, recentes);
  if (janelas.size > 5000) for (const [k, v] of janelas) if (!v.some((t) => agora - t < 60_000)) janelas.delete(k);
  return true;
}
export function limparLimites() {
  janelas.clear();
}

/**
 * Origem do envio: `req.ip` (o primeiro X-Forwarded-For é do cliente e se falsifica). Se o shell não
 * declarar o proxy confiável, `req.ip` é o do balanceador e o limite passa a valer por conta —
 * confirmação pedida em specs/pedidos_ao_shell.md.
 */
function origem(req: Request): string {
  return createHash('sha256').update(req.ip || 'desconhecido').digest('hex').slice(0, 16);
}

const REACOES = ['gostei', 'nao_gostei', 'quero_visitar'];
const ROTULO_REACAO: Record<string, string> = { gostei: 'Gostou do', nao_gostei: 'Não gostou do', quero_visitar: 'Quer visitar o' };

const contaDoIngresso = (req: Request) => {
  const c = Number((req.wh?.contexto as Linha | null)?.conta_id);
  return Number.isInteger(c) && c > 0 ? c : null;
};

export const webhooks = {
  /** Formulário da página e da ficha (7.3): honeypot `site`, limite por IP, consentimento obrigatório. */
  formulario_lead: async (req: Request, res: Response) => {
    const conta = contaDoIngresso(req);
    if (!conta) return res.status(404).json({ erro: true, codigo: 'NAO_ENCONTRADO', mensagem: 'Formulário indisponível.' });
    const corpo = (req.body ?? {}) as Record<string, unknown>;
    // Robô preencheu o campo escondido: responde como sucesso e não faz nada.
    if (typeof corpo.site === 'string' && corpo.site.trim()) return res.json({ ok: true });
    if (!dentroDoLimite(`lead:${conta}:${origem(req)}`, 3)) {
      return res.status(429).json({ erro: true, codigo: 'MUITAS_TENTATIVAS', mensagem: 'Muitos envios seguidos. Espere um minuto e tente de novo.' });
    }
    const v = validarLead(corpo);
    if (!v.ok) return res.status(422).json({ erro: true, codigo: 'DADOS_INVALIDOS', mensagem: 'Confira o formulário.', detalhes: v.erros });
    await req.eventos!.publicar(
      'lead_recebido',
      { ...v.dados, origem: v.dados.imovel_codigo ? 'ficha_imovel' : 'pagina', responsavel_id: req.wh?.criado_por ?? null },
      { conta_id: conta },
    );
    res.json({ ok: true });
  },

  /** Reação a um imóvel da seleção (7.3): token válido e imóvel da seleção (o listener confere). */
  reacao_selecao: async (req: Request, res: Response) => {
    const ctx = req.wh?.contexto as Linha | null;
    const conta = contaDoIngresso(req);
    const selecaoId = idDe(ctx?.selecao_id);
    const corpo = (req.body ?? {}) as Linha;
    const codigo = texto(corpo.imovel_codigo, 30);
    const reacao = REACOES.includes(corpo.reacao) ? (corpo.reacao as string) : null;
    if (!conta || !selecaoId || !codigo || !reacao) return res.status(422).json({ erro: true, codigo: 'DADOS_INVALIDOS', mensagem: 'Reação inválida.' });
    if (!dentroDoLimite(`reacao:${conta}:${selecaoId}:${origem(req)}`, 30)) {
      return res.status(429).json({ erro: true, codigo: 'MUITAS_TENTATIVAS', mensagem: 'Muitas reações seguidas. Espere um minuto.' });
    }
    await req.eventos!.publicar('reacao_recebida', { selecao_id: selecaoId, imovel_codigo: codigo, reacao, comentario: texto(corpo.comentario, 300) || null }, { conta_id: conta });
    res.json({ ok: true });
  },

  /**
   * Ação do cliente no portal: mensagem ao corretor, pedido de remarcar uma visita ou pendência
   * marcada como feita (bloco 9). Se a pendência é deste cliente, quem confere é o listener.
   */
  acao_cliente: async (req: Request, res: Response) => {
    const ctx = req.wh?.contexto as Linha | null;
    const conta = contaDoIngresso(req);
    const contatoId = idDe(ctx?.contato_id);
    const corpo = (req.body ?? {}) as Linha;
    const tipo = ['mensagem', 'remarcar', 'tarefa_feita'].includes(corpo.tipo) ? (corpo.tipo as string) : null;
    const mensagem = tipo === 'tarefa_feita' ? null : texto(corpo.texto, 1000) || null;
    const visita = tipo === 'remarcar' ? idDe(corpo.visita) : null;
    const tarefa = tipo === 'tarefa_feita' ? idDe(corpo.tarefa) : null;
    if (!conta || !contatoId || !tipo || (tipo === 'mensagem' && !mensagem) || (tipo === 'remarcar' && !visita) || (tipo === 'tarefa_feita' && !tarefa)) {
      return res.status(422).json({ erro: true, codigo: 'DADOS_INVALIDOS', mensagem: tipo === 'mensagem' ? 'Escreva a mensagem.' : 'Pedido inválido.' });
    }
    if (!dentroDoLimite(`acao:${conta}:${contatoId}:${origem(req)}`, 5)) {
      return res.status(429).json({ erro: true, codigo: 'MUITAS_TENTATIVAS', mensagem: 'Muitos envios seguidos. Espere um minuto.' });
    }
    await req.eventos!.publicar('acao_cliente_recebida', { contato_id: contatoId, tipo, texto: mensagem, visita, tarefa }, { conta_id: conta });
    res.json({ ok: true });
  },

  /** Clique no link rastreado: só conta, sem dado do visitante. */
  clique_link: async (req: Request, res: Response) => {
    const conta = contaDoIngresso(req);
    const codigo = texto((req.body as Linha | undefined)?.codigo, 24);
    if (!conta || !codigo) return res.status(422).json({ erro: true, codigo: 'DADOS_INVALIDOS', mensagem: 'Link inválido.' });
    if (dentroDoLimite(`clique:${conta}:${origem(req)}`, 30)) await req.eventos!.publicar('link_clicado', { codigo }, { conta_id: conta });
    res.json({ ok: true });
  },
};

// ---------- Listeners ----------

interface EventoConta {
  id?: number;
  payload: Record<string, any>;
  conta_id?: number | null;
}

/**
 * Roda o bloco na conta e, se outro lead criou a mesma linha ao mesmo tempo (único: origem ou
 * telefone), roda de novo numa transação nova — na segunda vez a linha já existe e é reaproveitada.
 */
async function comContaRepetindo(ctx: ContextoListener, conta: number, fn: (trx: HelperDados) => Promise<void>) {
  try {
    await ctx.dados!.comConta!(conta, fn);
  } catch (e) {
    if ((e as { code?: string })?.code !== '23505') throw e;
    await ctx.dados!.comConta!(conta, fn);
  }
}

/** Quem responde pelo lead: quem gerou o ingresso (publicou a página), ou o primeiro corretor ativo da conta. */
async function responsavel(dados: HelperDados, conta: number, sugerido: unknown): Promise<number | null> {
  const perfis = await dados.varrerTudo('perfis_corretor', { filtros: { conta_id: conta }, maximo: 200 });
  const ativos = perfis.filter((p) => p.ativo !== false);
  const s = Number(sugerido);
  if (ativos.some((p) => p.usuario_id === s)) return s;
  return ativos[0]?.usuario_id ?? (Number.isInteger(s) && s > 0 ? s : null);
}

/**
 * Lead da página (7.3): cria ou une o contato pelo telefone (ou e-mail), abre negócio "Novo" se
 * ele não tem negócio de compra em andamento, registra o consentimento e a linha do tempo.
 * Em SISTEMA a leitura enxerga todas as contas: toda leitura filtra a conta do evento.
 */
export async function aoReceberLead(evento: EventoConta, ctx: ContextoListener) {
  const conta = evento.conta_id;
  if (!conta || !ctx.dados?.comConta) return;
  const p = evento.payload;
  await comContaRepetindo(ctx, conta, async (trx) => {
    const agora = new Date().toISOString();
    // Mesmo telefone; sem contato com o telefone, o mesmo e-mail.
    const procurar = async () =>
      (p.telefone ? (await trx.varrerTudo('contatos', { filtros: { conta_id: conta, telefone: p.telefone }, maximo: 1 }))[0] : undefined) ??
      (p.email ? (await trx.varrerTudo('contatos', { filtros: { conta_id: conta, email: p.email }, maximo: 1 }))[0] : undefined);
    let contato: Linha | null = (await procurar()) ?? null;
    // Mesmo envio repetido em poucos minutos (duplo clique, reenvio): não duplica nada.
    if (contato) {
      const recentes = await trx.varrerTudo('linha_do_tempo', { filtros: { conta_id: conta, contato_id: contato.id, tipo: 'lead.recebido' }, maximo: 50 });
      const limite = new Date(Date.now() - 5 * 60_000).toISOString();
      if (recentes.some((l) => (iso(l.ocorrido_em) ?? '') >= limite && (l.dados as Linha | null)?.mensagem === (p.mensagem ?? null))) return;
    }
    const dono = await responsavel(trx, conta, p.responsavel_id);
    if (!dono) throw new Error('conta sem corretor ativo para receber o lead');
    const origemPagina = async () => (await trx.varrerTudo('origens', { filtros: { conta_id: conta, canal: 'pagina' }, maximo: 50 })).find((o) => !o.campanha);
    const origem = (await origemPagina()) ?? (await trx.criar('origens', { canal: 'pagina', campanha: null }));
    if (!contato) {
      contato = await trx.criar('contatos', {
        nome: p.nome, telefone: p.telefone ?? null, email: p.email ?? null, papeis: 'comprador',
        responsavel_id: dono, origem_id: origem.id, ultimo_contato_em: agora, consentimento_em: agora,
      });
    } else {
      await trx.atualizar('contatos', contato.id, { ultimo_contato_em: agora, consentimento_em: agora, ...(contato.email || !p.email ? {} : { email: p.email }) });
    }
    await trx.criar('consentimentos', { contato_id: contato.id, texto_versao: 'formulario-v1', canal: 'pagina', registrado_por_id: null, aceito_em: agora });
    // Imóvel citado (ficha pública): liga o negócio a ele, se ainda for da conta.
    const imovel = p.imovel_codigo ? (await trx.varrerTudo('imoveis', { filtros: { conta_id: conta, codigo: p.imovel_codigo }, maximo: 1 }))[0] : null;
    const negocios = await trx.varrerTudo('negocios', { filtros: { conta_id: conta, contato_id: contato.id, pipeline: 'compra' }, maximo: 100 });
    let etapas = await trx.varrerTudo('etapas_funil', { filtros: { conta_id: conta, pipeline: 'compra' }, maximo: 200 });
    // Conta que nunca abriu o funil: semeia as etapas padrão, como a primeira leitura do app faria.
    if (!etapas.length) {
      for (const e of ETAPAS_PADRAO) await trx.criar('etapas_funil', { ...e, ativa: true, marco: MARCO_PADRAO[e.nome] ?? null });
      etapas = await trx.varrerTudo('etapas_funil', { filtros: { conta_id: conta, pipeline: 'compra' }, maximo: 200 });
    }
    const abertas = new Set(etapas.filter((e) => e.tipo === 'aberta').map((e) => e.id));
    let negocioId: number | null = negocios.find((n) => abertas.has(n.etapa_id))?.id ?? null;
    const novo = etapas.filter((e) => e.tipo === 'aberta' && e.ativa !== false).sort((a, b) => a.ordem - b.ordem)[0];
    if (!negocioId && novo) {
      const n = await trx.criar('negocios', {
        contato_id: contato.id, titulo: `Compra — ${p.nome}`.slice(0, 200), pipeline: 'compra', etapa_id: novo.id, etapa_desde: agora,
        responsavel_id: dono, origem_id: origem.id, imovel_id: imovel?.id ?? null, marco_max: novo.marco ?? MARCO_PADRAO[novo.nome] ?? null,
      });
      negocioId = n.id;
    }
    const onde = imovel ? `pela ficha do ${imovel.codigo}` : 'pela sua página';
    await trx.criar('linha_do_tempo', {
      tipo: 'lead.recebido', alvo_tipo: 'contato', alvo_id: contato.id, contato_id: contato.id, autor_id: null, autor_papel: 'sistema',
      resumo: `Pediu contato ${onde}${p.mensagem ? `: ${String(p.mensagem).slice(0, 200)}` : ''}`.slice(0, 300),
      dados: { origem: p.origem, imovel_codigo: p.imovel_codigo ?? null, mensagem: p.mensagem ?? null, negocio_id: negocioId }, ocorrido_em: agora,
    });
    await reclassificar(trx, contato.id);
  });
}

/** Clique no link: soma no envio da conta e registra o primeiro na linha do tempo. */
export async function aoClicarLink(evento: EventoConta, ctx: ContextoListener) {
  const conta = evento.conta_id;
  if (!conta || !ctx.dados?.comConta) return;
  const codigo = String(evento.payload.codigo ?? '');
  await ctx.dados.comConta(conta, async (trx) => {
    const envio = (await trx.varrerTudo('envios', { filtros: { conta_id: conta, link_rastreado: codigo }, maximo: 1 }))[0];
    if (!envio) return;
    const agora = new Date().toISOString();
    const primeiro = !envio.primeiro_clique_em;
    await trx.atualizar('envios', envio.id, { cliques: (envio.cliques ?? 0) + 1, ...(primeiro ? { primeiro_clique_em: agora } : {}) });
    if (primeiro) {
      await trx.criar('linha_do_tempo', {
        tipo: 'envio.aberto', alvo_tipo: 'contato', alvo_id: envio.contato_id, contato_id: envio.contato_id, autor_id: null, autor_papel: 'sistema',
        resumo: `Abriu o link que você mandou${envio.imovel_codigo ? ` (${envio.imovel_codigo})` : ''}`, dados: { envio_id: envio.id }, ocorrido_em: agora,
      });
    }
  });
}

/** Tarefa para o corretor, sem repetir uma igual que ainda está pendente. */
async function tarefa(trx: HelperDados, conta: number, contato: Linha, titulo: string) {
  const curto = titulo.slice(0, 200);
  const pendentes = await trx.varrerTudo('atividades', { filtros: { conta_id: conta, contato_id: contato.id, tipo: 'tarefa', status: 'pendente' }, maximo: 200 });
  if (pendentes.some((a) => a.titulo === curto)) return;
  await trx.criar('atividades', { tipo: 'tarefa', titulo: curto, contato_id: contato.id, responsavel_id: contato.responsavel_id, quando: new Date().toISOString(), status: 'pendente', criada_por_agente: false });
}

/** Linha do tempo do sistema; a mesma linha nos últimos 5 minutos (evento entregue de novo) não se repete. */
async function linhaDoTempo(trx: HelperDados, contatoId: number, tipo: string, resumo: string, dados: unknown, conta?: number) {
  if (conta) {
    const limite = new Date(Date.now() - 5 * 60_000).toISOString();
    const recentes = await trx.varrerTudo('linha_do_tempo', { filtros: { conta_id: conta, contato_id: contatoId, tipo, 'ocorrido_em[gte]': limite }, maximo: 50 });
    if (recentes.some((l) => l.resumo === resumo.slice(0, 300) && (iso(l.ocorrido_em) ?? '') >= limite)) return;
  }
  await trx.criar('linha_do_tempo', {
    tipo, alvo_tipo: 'contato', alvo_id: contatoId, contato_id: contatoId, autor_id: null, autor_papel: 'sistema',
    resumo: resumo.slice(0, 300), dados, ocorrido_em: new Date().toISOString(),
  });
}

/** Reação do cliente: grava no item, avisa na linha do tempo, "quero visitar" vira tarefa. */
export async function aoReceberReacao(evento: EventoConta, ctx: ContextoListener) {
  const conta = evento.conta_id;
  if (!conta || !ctx.dados?.comConta) return;
  const p = evento.payload;
  await comContaRepetindo(ctx, conta, async (trx) => {
    const selecao = (await trx.varrerTudo('selecoes', { filtros: { conta_id: conta, id: p.selecao_id }, maximo: 1 }))[0];
    if (!selecao || !selecaoValida(selecao)) return;
    const imovel = (await trx.varrerTudo('imoveis', { filtros: { conta_id: conta, codigo: p.imovel_codigo }, maximo: 1 }))[0];
    const item = imovel ? (await trx.varrerTudo('selecao_itens', { filtros: { conta_id: conta, selecao_id: selecao.id, imovel_id: imovel.id }, maximo: 1 }))[0] : null;
    if (!item) return; // imóvel que não é desta seleção
    const contato = (await trx.varrerTudo('contatos', { filtros: { conta_id: conta, id: selecao.contato_id }, maximo: 1 }))[0];
    if (!contato) return;
    const agora = new Date().toISOString();
    if (item.reacao !== p.reacao || (p.comentario && p.comentario !== item.comentario)) {
      await trx.atualizar('selecao_itens', item.id, { reacao: p.reacao, reacao_em: agora, ...(p.comentario ? { comentario: p.comentario } : {}) });
      await linhaDoTempo(trx, contato.id, 'selecao.reacao', `${ROTULO_REACAO[p.reacao]} ${imovel.codigo}${p.comentario ? `: ${p.comentario}` : ''} (seleção "${selecao.titulo}")`, { selecao_id: selecao.id, imovel_codigo: imovel.codigo, reacao: p.reacao });
    }
    if (p.reacao === 'quero_visitar') await tarefa(trx, conta, contato, `Marcar visita: ${imovel.codigo}${imovel.titulo ? ` · ${imovel.titulo}` : ''}`);
    await trx.atualizar('contatos', contato.id, { ultimo_contato_em: agora });
    await reclassificar(trx, contato.id);
    await publicarSelecao(trx, conta, selecao);
    await sincronizarPortal(trx, conta, contato.id);
  });
}

/**
 * Pendência marcada como feita pelo cliente: grava `feita_em`, registra na linha do tempo e
 * ressincroniza o portal (o item sai). Pendência de outro cliente, removida ou já feita: nada muda.
 */
async function tarefaFeita(trx: HelperDados, conta: number, contato: Linha, tarefaId: unknown) {
  const tid = idDe(tarefaId);
  if (!tid) return false;
  const t = (await trx.varrerTudo('tarefas_cliente', { filtros: { conta_id: conta, id: tid, contato_id: contato.id }, maximo: 1 }))[0];
  if (!t || t.feita_em) return false;
  await trx.atualizar('tarefas_cliente', t.id, { feita_em: new Date().toISOString() });
  await linhaDoTempo(trx, contato.id, 'portal.tarefa_feita', `Marcou como feito no portal: ${t.texto}`, { tarefa_id: t.id }, conta);
  return true;
}

/** Mensagem, pedido de remarcar ou pendência feita vindo do portal: linha do tempo (e tarefa para o corretor). */
export async function aoReceberAcaoCliente(evento: EventoConta, ctx: ContextoListener) {
  const conta = evento.conta_id;
  if (!conta || !ctx.dados?.comConta) return;
  const p = evento.payload;
  await comContaRepetindo(ctx, conta, async (trx) => {
    const contato = (await trx.varrerTudo('contatos', { filtros: { conta_id: conta, id: p.contato_id }, maximo: 1 }))[0];
    if (!contato) return;
    if (p.tipo === 'tarefa_feita') {
      if (!(await tarefaFeita(trx, conta, contato, p.tarefa))) return;
      await trx.atualizar('contatos', contato.id, { ultimo_contato_em: new Date().toISOString() });
      await reclassificar(trx, contato.id);
      await sincronizarPortal(trx, conta, contato.id);
      return;
    }
    if (p.tipo === 'mensagem') {
      await linhaDoTempo(trx, contato.id, 'portal.mensagem', `Mensagem pelo portal: ${String(p.texto ?? '').slice(0, 250)}`, { texto: p.texto }, conta);
      await tarefa(trx, conta, contato, 'Responder a mensagem do portal');
    } else {
      const visita = (await trx.varrerTudo('atividades', { filtros: { conta_id: conta, id: p.visita, contato_id: contato.id, tipo: 'visita' }, maximo: 1 }))[0];
      if (!visita) return; // visita que não é deste cliente
      const quando = iso(visita.quando);
      const dia = quando ? new Date(quando).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }) : '';
      await linhaDoTempo(trx, contato.id, 'portal.remarcar', `Pediu para remarcar a visita de ${dia}${p.texto ? `: ${String(p.texto).slice(0, 200)}` : ''}`, { atividade_id: visita.id, texto: p.texto ?? null }, conta);
      await tarefa(trx, conta, contato, `Remarcar visita: ${visita.titulo}`);
    }
    await trx.atualizar('contatos', contato.id, { ultimo_contato_em: new Date().toISOString() });
    await reclassificar(trx, contato.id);
  });
}

export const reagir = {
  lead_recebido: aoReceberLead,
  link_clicado: aoClicarLink,
  reacao_recebida: aoReceberReacao,
  acao_cliente_recebida: aoReceberAcaoCliente,
  publicacao_programada: aoPublicacaoProgramada,
  lembrete_visita: aoLembreteVisita,
};
