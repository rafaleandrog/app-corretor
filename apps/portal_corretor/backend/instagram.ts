import '@urbiverso/sdk/express';
import { Router, type Request } from 'express';
import type { ContextoListener, HelperDados, ParametroHelper } from '@urbiverso/sdk';
import { checarPeca } from '../comum/estudio';
import { autorizacaoVigente, type Autorizacao } from '../comum/imoveis';
import { assincrono, erro, guardarCorretor, primeiro } from './acesso';
import { contaDoRequest } from './vitrine';

// Instagram (bloco 8b, spec 9.2): conexão pelo login do Instagram (Instagram API com login do
// Instagram), publicar agora, agendar no app (`req.eventos.agendar`) e marcar o que foi publicado
// por fora. Chamadas externas por `fetch()`; o app da Meta em parâmetros (`meta_app_secret` é
// `secret`); o token de cada conta em coluna `segredo`, lido só por `revelar` na hora de usar.

type Linha = Record<string, any>;
const GRAPH = 'https://graph.instagram.com/v21.0';
const ESCOPOS = 'instagram_business_basic,instagram_business_content_publish';
const DIA = 86400e3;

/** Porta de saída para a Meta; os testes trocam por um falso (o `fetch` global serve ao servidor de teste). */
export const http = { fetch: (url: string, init?: RequestInit) => fetch(url, init) };

export class ErroInstagram extends Error {
  constructor(mensagem: string, readonly codigo: string) {
    super(mensagem);
  }
}

async function chamar(url: string, init?: RequestInit): Promise<Linha> {
  let r: Response;
  try {
    r = await http.fetch(url, init);
  } catch {
    throw new ErroInstagram('O Instagram não respondeu agora. Tente de novo em instantes.', 'INSTAGRAM_FORA');
  }
  const corpo = (await r.json().catch(() => ({}))) as Linha;
  if (!r.ok || corpo.error) {
    const msg = String(corpo.error?.message ?? corpo.error_message ?? `HTTP ${r.status}`).slice(0, 200);
    throw new ErroInstagram(`O Instagram recusou: ${msg}`, corpo.error?.code === 190 ? 'TOKEN_INVALIDO' : 'INSTAGRAM_RECUSOU');
  }
  return corpo;
}

const form = (dados: Record<string, string>) => ({ method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(dados).toString() });

async function appMeta(parametros: ParametroHelper | undefined): Promise<{ id: string; segredo: string } | null> {
  if (!parametros) return null;
  const [id, segredo] = await Promise.all([parametros.obter<string>('meta_app_id'), parametros.obter<string>('meta_app_secret')]);
  return id && segredo ? { id: String(id), segredo: String(segredo) } : null;
}

/** Endereço de retorno do login do Instagram: a tela de Conexões do app (sub-rota com `?code=`). */
const retorno = (shell: { urlApp(sub: string): string }) => shell.urlApp('/ajustes/conexoes');

/** Conexão ativa da conta (sem o token: ele só sai por `revelar`). */
async function conexao(dados: HelperDados, conta: number): Promise<Linha | null> {
  return (await dados.varrerTudo('canais_sociais', { filtros: { conta_id: conta, rede: 'instagram', 'desconectado_em[nulo]': 'true' }, maximo: 1 }))[0] ?? null;
}

// ---------- Publicação ----------

/** URL pública e absoluta de cada imagem da peça (a Meta baixa a imagem pela URL). */
async function urlsDaPeca(dados: HelperDados, arquivos: { url(id: number, ttl: number): Promise<string> } | undefined, shell: { urlApp(sub: string): string }, conta: number, pecaId: number): Promise<string[]> {
  const lista = await dados.varrerTudo('peca_arquivos', { filtros: { conta_id: conta, peca_id: pecaId }, ordenar: 'ordem', ordem: 'asc', maximo: 10 });
  if (!arquivos) return [];
  const origem = new URL(shell.urlApp('/')).origin;
  return Promise.all(lista.map(async (a) => {
    const u = await arquivos.url(a.arquivo, 2 * 3600);
    return u.startsWith('http') ? u : `${origem}${u}`;
  }));
}

/** Espera o contêiner ficar pronto (publicar antes do processamento falha, 9.2). */
async function aguardarConteiner(id: string, token: string) {
  for (let i = 0; i < 10; i++) {
    const r = await chamar(`${GRAPH}/${id}?fields=status_code&access_token=${encodeURIComponent(token)}`);
    if (r.status_code === 'FINISHED') return;
    if (r.status_code === 'ERROR' || r.status_code === 'EXPIRED') throw new ErroInstagram('O Instagram não conseguiu processar a imagem.', 'INSTAGRAM_RECUSOU');
    await new Promise((ok) => setTimeout(ok, publicar.esperaMs));
  }
  throw new ErroInstagram('O Instagram ainda está processando a imagem. Tente publicar de novo em alguns minutos.', 'INSTAGRAM_LENTO');
}

/** Cria o(s) contêiner(es) e publica (9.2): post, carrossel (um contêiner por item) ou story. */
export async function publicar(p: { formato: string; legenda: string }, urls: string[], igUser: string, token: string): Promise<{ id: string; permalink: string | null }> {
  if (!urls.length) throw new ErroInstagram('A peça não tem arte.', 'SEM_ARTE');
  const t = encodeURIComponent(token);
  let criacao: string;
  if (p.formato === 'carrossel' && urls.length > 1) {
    const filhos: string[] = [];
    for (const u of urls) filhos.push((await chamar(`${GRAPH}/${igUser}/media`, form({ image_url: u, is_carousel_item: 'true', access_token: token }))).id);
    for (const f of filhos) await aguardarConteiner(f, token);
    criacao = (await chamar(`${GRAPH}/${igUser}/media`, form({ media_type: 'CAROUSEL', children: filhos.join(','), caption: p.legenda, access_token: token }))).id;
  } else if (p.formato === 'story') {
    criacao = (await chamar(`${GRAPH}/${igUser}/media`, form({ image_url: urls[0], media_type: 'STORIES', access_token: token }))).id;
  } else {
    criacao = (await chamar(`${GRAPH}/${igUser}/media`, form({ image_url: urls[0], caption: p.legenda, access_token: token }))).id;
  }
  await aguardarConteiner(criacao, token);
  const publicada = await chamar(`${GRAPH}/${igUser}/media_publish`, form({ creation_id: criacao, access_token: token }));
  const link = await chamar(`${GRAPH}/${publicada.id}?fields=permalink&access_token=${t}`).catch(() => ({}) as Linha);
  return { id: String(publicada.id), permalink: (link as Linha).permalink ?? null };
}
publicar.esperaMs = 3000;

interface Ambiente {
  dados: HelperDados;
  arquivos?: { url(id: number, ttl: number): Promise<string> };
  shell: { urlApp(sub: string): string };
}

/** Legenda com o CRECI (10.5: CRECI na peça ou na legenda), acrescentado se faltar. */
function legendaComCreci(p: Linha, creci: string | null): string {
  const legenda = String(p.legenda ?? '');
  return creci && !legenda.includes(creci) ? [legenda, `CRECI ${creci}`].filter(Boolean).join('\n\n') : legenda;
}

async function creciDaConta(dados: HelperDados, conta: number, usuario: number | null): Promise<string | null> {
  const perfis = await dados.varrerTudo('perfis_corretor', { filtros: { conta_id: conta }, maximo: 50 });
  const eu = perfis.find((x) => x.usuario_id === usuario && x.creci) ?? perfis.find((x) => x.creci);
  const contaLinha = (await dados.varrerTudo('perfil_conta', { filtros: { conta_id: conta, chave: 'conta' }, maximo: 1 }))[0];
  return eu?.creci ?? contaLinha?.creci_juridico ?? null;
}

/**
 * Confere e publica uma peça da conta: as checagens da aprovação de novo (o mundo pode ter mudado
 * desde então), a conexão e o token. Grava publicada ou erro; devolve a peça.
 */
export async function publicarPeca(amb: Ambiente, conta: number, pecaId: number, usuario: number | null): Promise<Linha> {
  const { dados } = amb;
  const p = (await dados.varrerTudo('pecas', { filtros: { conta_id: conta, id: pecaId }, maximo: 1 }))[0];
  if (!p) throw new ErroInstagram('Peça não encontrada.', 'NAO_ENCONTRADO');
  const falhar = async (mensagem: string) => {
    await dados.atualizar('pecas', p.id, { estado: 'erro', erro: mensagem.slice(0, 300), agendamento_id: null });
    return { ...p, estado: 'erro', erro: mensagem };
  };
  const urls = await urlsDaPeca(dados, amb.arquivos, amb.shell, conta, p.id);
  const creci = await creciDaConta(dados, conta, usuario);
  let vigente = false;
  if (p.imovel_id) {
    const auts = await dados.varrerTudo('autorizacoes_venda', { filtros: { conta_id: conta, imovel_id: p.imovel_id }, maximo: 200 });
    const hoje = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
    vigente = auts.some((a) => autorizacaoVigente(a as Autorizacao, hoje));
  }
  // A checagem roda sobre o texto que vai ser publicado, já com o CRECI: nada é cortado depois.
  const legenda = legendaComCreci(p, creci);
  const checagem = checarPeca({ formato: p.formato, objetivo: p.objetivo, legenda: legenda || null, hashtags: p.hashtags ?? null, arquivos: urls.length }, { creci, imovel: !!p.imovel_id, autorizacaoVigente: vigente });
  if (!checagem.ok) return falhar(`Não publicada: ${checagem.pendencias.join(' ')}`);
  const canal = await conexao(dados, conta);
  if (!canal) return falhar('Não publicada: o Instagram não está conectado (Ajustes › Conexões).');
  const token = await dados.revelar('canais_sociais', canal.id, 'token');
  if (!token) return falhar('Não publicada: reconecte o Instagram (Ajustes › Conexões).');
  try {
    const r = await publicar({ formato: p.formato, legenda: [legenda, p.hashtags ?? ''].filter(Boolean).join('\n\n') }, urls, canal.conta_externa_id, token);
    const agora = new Date().toISOString();
    await dados.atualizar('pecas', p.id, { estado: 'publicada', publicada_em: agora, publicacao_id: r.id, permalink: r.permalink, publicada_por: 'api', erro: null, agendamento_id: null });
    return { ...p, estado: 'publicada', publicada_em: agora, permalink: r.permalink };
  } catch (e) {
    if (!(e instanceof ErroInstagram)) throw e;
    if (e.codigo === 'TOKEN_INVALIDO') await dados.atualizar('canais_sociais', canal.id, { ultimo_erro: 'Acesso vencido ou revogado: reconecte.' });
    return falhar(e.message);
  }
}

// ---------- Rotas do corretor ----------

export const instagramRotas: Router = Router();
guardarCorretor(instagramRotas, ['/conexoes', '/estudio/pecas']);

instagramRotas.get(
  '/conexoes',
  assincrono(async (req, res) => {
    const conta = contaDoRequest(req);
    const app = await appMeta(req.parametros);
    const c = await conexao(req.dados!, conta);
    res.json({
      instagram: c ? { usuario: c.usuario, tipo_conta: c.tipo_conta, conectado_em: c.conectado_em, token_expira_em: c.token_expira_em, ultimo_erro: c.ultimo_erro ?? null } : null,
      disponivel: !!app,
      // Endereço para cadastrar no app da Meta como "URI de redirecionamento".
      retorno: retorno(req.shell!),
    });
  }),
);

/** Começo do login do Instagram: o navegador vai para a Meta com o `state` que a tela gerou e guardou. */
instagramRotas.post(
  '/conexoes/instagram/iniciar',
  assincrono(async (req, res) => {
    const app = await appMeta(req.parametros);
    if (!app) return erro(res, 503, 'INSTAGRAM_NAO_CONFIGURADO', 'A conexão com o Instagram ainda não foi configurada pela equipe da plataforma.');
    const state = typeof req.body?.state === 'string' && /^[A-Za-z0-9_-]{16,80}$/.test(req.body.state) ? req.body.state : null;
    if (!state) return erro(res, 422, 'DADOS_INVALIDOS', 'Estado de segurança inválido.');
    const u = new URL('https://www.instagram.com/oauth/authorize');
    u.searchParams.set('client_id', app.id);
    u.searchParams.set('redirect_uri', retorno(req.shell!));
    u.searchParams.set('response_type', 'code');
    u.searchParams.set('scope', ESCOPOS);
    u.searchParams.set('state', state);
    res.json({ url: u.toString() });
  }),
);

/** Volta do login: troca o código pelo token de longa duração e confere o tipo de conta. */
instagramRotas.post(
  '/conexoes/instagram/retorno',
  assincrono(async (req, res) => {
    const app = await appMeta(req.parametros);
    if (!app) return erro(res, 503, 'INSTAGRAM_NAO_CONFIGURADO', 'A conexão com o Instagram ainda não foi configurada pela equipe da plataforma.');
    const code = typeof req.body?.code === 'string' ? req.body.code.replace(/#_$/, '').trim() : '';
    if (!code || code.length > 2000) return erro(res, 422, 'DADOS_INVALIDOS', 'Código de retorno inválido.');
    const dados = req.dados!;
    const conta = contaDoRequest(req);
    try {
      const curto = await chamar('https://api.instagram.com/oauth/access_token', form({ client_id: app.id, client_secret: app.segredo, grant_type: 'authorization_code', redirect_uri: retorno(req.shell!), code }));
      const longo = await chamar(`https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${encodeURIComponent(app.segredo)}&access_token=${encodeURIComponent(curto.access_token)}`);
      const eu = await chamar(`${GRAPH}/me?fields=user_id,username,account_type&access_token=${encodeURIComponent(longo.access_token)}`);
      const tipo = String(eu.account_type ?? '').toUpperCase();
      if (tipo && !['BUSINESS', 'MEDIA_CREATOR', 'CREATOR'].includes(tipo)) {
        return erro(res, 422, 'CONTA_PESSOAL', 'Esta é uma conta pessoal. No Instagram, mude para conta profissional (Comercial, para publicar stories) e conecte de novo.');
      }
      const agora = new Date().toISOString();
      const anterior = await conexao(dados, conta);
      if (anterior) await dados.atualizar('canais_sociais', anterior.id, { desconectado_em: agora, token: null });
      await dados.criar('canais_sociais', {
        rede: 'instagram', conta_externa_id: String(eu.user_id ?? eu.id ?? curto.user_id), usuario: eu.username ?? null, tipo_conta: tipo || null,
        token: longo.access_token, token_expira_em: new Date(Date.now() + Number(longo.expires_in ?? 60 * 86400) * 1000).toISOString(),
        conectado_em: agora, conectado_por_id: req.contexto!.usuario.id,
      });
      res.json({ ok: true, usuario: eu.username ?? null, tipo_conta: tipo || null, aviso: tipo === 'BUSINESS' ? null : 'Stories pela API pedem conta Comercial: posts e carrosséis funcionam.' });
    } catch (e) {
      if (e instanceof ErroInstagram) return erro(res, 502, e.codigo, e.message);
      throw e;
    }
  }),
);

instagramRotas.post(
  '/conexoes/instagram/desconectar',
  assincrono(async (req, res) => {
    const dados = req.dados!;
    const c = await conexao(dados, contaDoRequest(req));
    if (c) await dados.atualizar('canais_sociais', c.id, { desconectado_em: new Date().toISOString(), token: null });
    res.json({ ok: true });
  }),
);

async function pecaDaConta(req: Request) {
  const pid = Number(req.params.id);
  if (!Number.isInteger(pid) || pid <= 0) return null;
  const p = await req.dados!.buscar('pecas', pid);
  return p && Number(p.conta_id) === contaDoRequest(req) ? p : null;
}

/** Publicar agora: só peça aprovada; a resposta diz se publicou ou o que impediu. */
instagramRotas.post(
  '/estudio/pecas/:id/publicar',
  assincrono(async (req, res) => {
    const p = await pecaDaConta(req);
    if (!p) return erro(res, 404, 'NAO_ENCONTRADO', 'Peça não encontrada.');
    if (p.estado !== 'aprovada' && p.estado !== 'erro') return erro(res, 409, 'ESTADO_INVALIDO', 'Aprove a peça antes de publicar.');
    if (p.estado === 'erro' && !p.aprovada_em) return erro(res, 409, 'ESTADO_INVALIDO', 'Aprove a peça antes de publicar.');
    const r = await publicarPeca({ dados: req.dados!, arquivos: req.arquivos, shell: req.shell! }, contaDoRequest(req), p.id, req.contexto!.usuario.id);
    if (r.estado !== 'publicada') return erro(res, 422, 'NAO_PUBLICADA', r.erro ?? 'Não foi possível publicar.');
    res.json(r);
  }),
);

/**
 * Agendar no app (9.2): na hora marcada o evento `publicacao_programada` dispara e o listener
 * publica. Aprovação manual: só peça aprovada. Por janela (configuração da conta): o rascunho também
 * agenda e é aprovado na hora se passar nas checagens, a menos que o corretor rejeite antes.
 */
instagramRotas.post(
  '/estudio/pecas/:id/agendar',
  assincrono(async (req, res) => {
    const dados = req.dados!;
    const p = await pecaDaConta(req);
    if (!p) return erro(res, 404, 'NAO_ENCONTRADO', 'Peça não encontrada.');
    const config = await primeiro(dados, 'configuracoes_conta', { chave: 'conta' });
    const janela = config?.modo_aprovacao_conteudo === 'janela';
    if (!(p.estado === 'aprovada' || (janela && p.estado === 'rascunho'))) {
      return erro(res, 409, 'ESTADO_INVALIDO', janela ? 'Só rascunho ou peça aprovada é agendada.' : 'Aprove a peça antes de agendar.');
    }
    const quando = typeof req.body?.quando === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(req.body.quando) ? new Date(req.body.quando) : null;
    if (!quando || Number.isNaN(quando.getTime())) return erro(res, 422, 'DADOS_INVALIDOS', 'Escolha o dia e a hora.');
    if (quando.getTime() < Date.now() + 5 * 60_000) return erro(res, 422, 'DADOS_INVALIDOS', 'Agende com pelo menos 5 minutos de antecedência.');
    if (quando.getTime() > Date.now() + 90 * DIA) return erro(res, 422, 'DADOS_INVALIDOS', 'Agende para os próximos 90 dias.');
    if (!(await conexao(dados, contaDoRequest(req)))) {
      return erro(res, 409, 'INSTAGRAM_DESCONECTADO', 'Conecte o Instagram (Ajustes › Conexões) para agendar no app. Sem conexão, baixe a arte e agende no Instagram.');
    }
    const r = await req.eventos!.agendar('publicacao_programada', { peca_id: p.id }, { em: quando });
    await dados.atualizar('pecas', p.id, { estado: 'agendada', agendada_para: quando.toISOString(), agendamento_id: Number(r.id), erro: null });
    res.json(await dados.buscar('pecas', p.id));
  }),
);

instagramRotas.post(
  '/estudio/pecas/:id/cancelar-agendamento',
  assincrono(async (req, res) => {
    const dados = req.dados!;
    const p = await pecaDaConta(req);
    if (!p) return erro(res, 404, 'NAO_ENCONTRADO', 'Peça não encontrada.');
    if (p.estado !== 'agendada') return erro(res, 409, 'ESTADO_INVALIDO', 'A peça não está agendada.');
    if (p.agendamento_id) await req.eventos!.cancelarAgendamento(p.agendamento_id).catch(() => undefined); // já disparado: o listener confere o estado
    res.json(await dados.atualizar('pecas', p.id, { estado: p.aprovada_em ? 'aprovada' : 'rascunho', agendada_para: null, agendamento_id: null }));
  }),
);

/** Publicou por fora (Instagram ou Business Suite): o corretor registra, com o link se quiser. */
instagramRotas.post(
  '/estudio/pecas/:id/publicada-fora',
  assincrono(async (req, res) => {
    const dados = req.dados!;
    const p = await pecaDaConta(req);
    if (!p) return erro(res, 404, 'NAO_ENCONTRADO', 'Peça não encontrada.');
    if (p.estado === 'publicada') return erro(res, 409, 'ESTADO_INVALIDO', 'A peça já está publicada.');
    const link = typeof req.body?.link === 'string' ? req.body.link.trim() : '';
    if (link && !/^https:\/\/(www\.)?instagram\.com\//.test(link)) return erro(res, 422, 'DADOS_INVALIDOS', 'Cole o link do post do Instagram (https://www.instagram.com/…).');
    if (p.agendamento_id) await req.eventos!.cancelarAgendamento(p.agendamento_id).catch(() => undefined);
    res.json(await dados.atualizar('pecas', p.id, { estado: 'publicada', publicada_em: new Date().toISOString(), permalink: link.slice(0, 300) || null, publicada_por: 'fora', agendamento_id: null, erro: null }));
  }),
);

// ---------- Listener e rotina ----------

interface EventoConta {
  payload: Record<string, any>;
  conta_id?: number | null;
}

/** Hora de publicar uma peça agendada; peça cancelada, rejeitada ou já publicada é ignorada (idempotente). */
export async function aoPublicacaoProgramada(evento: EventoConta, ctx: ContextoListener) {
  const conta = evento.conta_id;
  if (!conta || !ctx.dados?.comConta) return;
  await ctx.dados.comConta(conta, async (trx) => {
    const p = (await trx.varrerTudo('pecas', { filtros: { conta_id: conta, id: evento.payload.peca_id }, maximo: 1 }))[0];
    if (!p || p.estado !== 'agendada') return;
    // Aprovação por janela: chegou a hora sem rejeição, vale como aprovada (as checagens rodam no publicar).
    if (!p.aprovada_em) await trx.atualizar('pecas', p.id, { aprovada_em: new Date().toISOString() });
    await publicarPeca({ dados: trx, arquivos: ctx.arquivos, shell: ctx.shell }, conta, p.id, null);
  });
}

/** Renova os tokens que vencem em até 10 dias (o de longa duração vale 60 e renova enquanto válido). */
export async function renovarTokensInstagram(ctx: ContextoListener) {
  if (!ctx.dados?.comConta) return { ok: true, resultado: { resumo: 'sem dados' } };
  const limite = new Date(Date.now() + 10 * DIA).toISOString();
  const canais = await ctx.dados.varrerTudo('canais_sociais', { filtros: { rede: 'instagram', 'desconectado_em[nulo]': 'true', 'token_expira_em[lt]': limite }, maximo: 5000 });
  const ativas = new Set((ctx.contas ? await ctx.contas.listarAtivas() : []).map((c) => c.id));
  let renovados = 0;
  const falhas: string[] = [];
  for (const c of canais) {
    if (!ativas.has(c.conta_id)) continue;
    try {
      await ctx.dados.comConta(c.conta_id, async (trx) => {
        const token = await trx.revelar('canais_sociais', c.id, 'token');
        if (!token) return;
        try {
          const r = await chamar(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(token)}`);
          await trx.atualizar('canais_sociais', c.id, { token: r.access_token, token_expira_em: new Date(Date.now() + Number(r.expires_in ?? 60 * 86400) * 1000).toISOString(), ultimo_erro: null });
          renovados++;
        } catch (e) {
          if (!(e instanceof ErroInstagram)) throw e;
          await trx.atualizar('canais_sociais', c.id, { ultimo_erro: 'Não foi possível renovar o acesso: reconecte o Instagram.' });
          falhas.push(`conta ${c.conta_id}: ${e.message}`);
        }
      });
    } catch (e) {
      falhas.push(`conta ${c.conta_id}: ${(e as Error).message}`);
    }
  }
  const resumo = `${renovados} conexão(ões) renovada(s)${falhas.length ? `, ${falhas.length} com falha` : ''}`;
  return falhas.length ? { ok: false, resultado: { resumo }, erro: falhas.join('; ').slice(0, 1000) } : { ok: true, resultado: { resumo } };
}

