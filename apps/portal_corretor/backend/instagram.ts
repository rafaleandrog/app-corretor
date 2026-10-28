import '@urbiverso/sdk/express';
import { Router, type Request } from 'express';
import type { ContextoListener, HelperDados, ParametroHelper } from '@urbiverso/sdk';
import { checarPeca, legendaComCreci } from '../comum/estudio';
import { autorizacaoVigente, type Autorizacao } from '../comum/imoveis';
import { iso } from '../comum/funil';
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
    // Limite por chamada: a publicação inteira precisa acabar bem antes dos 15 min do "destravar".
    r = await http.fetch(url, { ...init, signal: AbortSignal.timeout(publicar.limiteChamadaMs) });
  } catch {
    throw new ErroInstagram('O Instagram não respondeu a tempo. Confira no Instagram antes de tentar de novo.', 'INSTAGRAM_FORA');
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
async function aguardarConteiner(id: string, token: string, prazo: number) {
  for (let i = 0; i < 10 && Date.now() < prazo; i++) {
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
  const prazo = Date.now() + publicar.prazoTotalMs;
  let criacao: string;
  if (p.formato === 'carrossel' && urls.length > 1) {
    const filhos: string[] = [];
    for (const u of urls) filhos.push((await chamar(`${GRAPH}/${igUser}/media`, form({ image_url: u, is_carousel_item: 'true', access_token: token }))).id);
    for (const f of filhos) await aguardarConteiner(f, token, prazo);
    criacao = (await chamar(`${GRAPH}/${igUser}/media`, form({ media_type: 'CAROUSEL', children: filhos.join(','), caption: p.legenda, access_token: token }))).id;
  } else if (p.formato === 'story') {
    criacao = (await chamar(`${GRAPH}/${igUser}/media`, form({ image_url: urls[0], media_type: 'STORIES', access_token: token }))).id;
  } else {
    criacao = (await chamar(`${GRAPH}/${igUser}/media`, form({ image_url: urls[0], caption: p.legenda, access_token: token }))).id;
  }
  await aguardarConteiner(criacao, token, prazo);
  const publicada = await chamar(`${GRAPH}/${igUser}/media_publish`, form({ creation_id: criacao, access_token: token }));
  const link = await chamar(`${GRAPH}/${publicada.id}?fields=permalink&access_token=${t}`).catch(() => ({}) as Linha);
  return { id: String(publicada.id), permalink: (link as Linha).permalink ?? null };
}
publicar.esperaMs = 3000;
publicar.limiteChamadaMs = 30_000;
/** Prazo para os contêineres ficarem prontos: bem abaixo dos 15 min do "destravar". */
publicar.prazoTotalMs = 6 * 60_000;

/** Abre uma unidade de escrita: `req.dados` direto na rota; `comConta` curto no listener. */
type Abrir = <T>(fn: (dados: HelperDados) => Promise<T>) => Promise<T>;

interface Ambiente {
  abrir: Abrir;
  arquivos?: { url(id: number, ttl: number): Promise<string> };
  shell: { urlApp(sub: string): string };
}

async function creciDaConta(dados: HelperDados, conta: number, usuario: number | null): Promise<string | null> {
  const perfis = await dados.varrerTudo('perfis_corretor', { filtros: { conta_id: conta }, maximo: 50 });
  const eu = perfis.find((x) => x.usuario_id === usuario && x.creci) ?? perfis.find((x) => x.creci);
  const contaLinha = (await dados.varrerTudo('perfil_conta', { filtros: { conta_id: conta, chave: 'conta' }, maximo: 1 }))[0];
  return eu?.creci ?? contaLinha?.creci_juridico ?? null;
}

/** De onde a publicação parte: a escrita condicionada só reserva a peça se ela ainda está assim. */
interface Origem {
  estado: 'aprovada' | 'erro' | 'agendada';
  /** Agendamento que disparou (listener): outro agendamento da mesma peça não publica por este. */
  agendamento_id?: number | null;
}

/**
 * Publica uma peça da conta, em três passos para não segurar transação durante a Meta:
 * 1. reserva a peça (`publicando`) por escrita condicionada ao estado de origem — duas abas, o
 *    agendamento e o "publicar agora" não publicam duas vezes — e refaz as checagens da aprovação;
 * 2. chama a Meta, fora de qualquer transação;
 * 3. grava publicada ou erro.
 * Devolve a peça, ou `null` se ela não estava mais no estado de origem.
 */
export async function publicarPeca(amb: Ambiente, conta: number, pecaId: number, usuario: number | null, origem: Origem): Promise<Linha | null> {
  const falha = (mensagem: string) => ({ estado: 'erro', erro: mensagem.slice(0, 300), agendamento_id: null, agendada_para: null });
  const prep = await amb.abrir(async (dados) => {
    // A conta já está no endereçamento da escrita (RLS na rota, `comConta` no listener).
    const guarda: Record<string, unknown> = { estado: origem.estado };
    if (origem.agendamento_id) guarda.agendamento_id = origem.agendamento_id;
    const p = await dados.atualizarSe('pecas', pecaId, { estado: 'publicando', erro: null }, guarda);
    if (!p) return null;
    const recusar = async (mensagem: string) => ({ fim: await dados.atualizar('pecas', p.id, falha(mensagem)) });
    // Só peça aprovada publica: nada é aprovado na hora da publicação (D-86).
    if (!p.aprovada_em) return recusar('Não publicada: a peça não está aprovada. Aprove e publique.');
    const urls = await urlsDaPeca(dados, amb.arquivos, amb.shell, conta, p.id);
    const creci = await creciDaConta(dados, conta, usuario);
    let vigente = false;
    if (p.imovel_id) {
      const auts = await dados.varrerTudo('autorizacoes_venda', { filtros: { conta_id: conta, imovel_id: p.imovel_id }, maximo: 200 });
      const hoje = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
      vigente = auts.some((a) => autorizacaoVigente(a as Autorizacao, hoje));
    }
    // CRECI na legenda (10.5) só se couber no limite (D-93): se não couber, sai sem ele, nunca
    // recusa. A checagem roda sobre o texto que vai ser publicado: nada é cortado depois.
    const { legenda } = legendaComCreci(p.legenda ?? null, p.hashtags ?? null, creci);
    const checagem = checarPeca({ formato: p.formato, objetivo: p.objetivo, legenda: legenda || null, hashtags: p.hashtags ?? null, arquivos: urls.length }, { creci, imovel: !!p.imovel_id, autorizacaoVigente: vigente });
    if (!checagem.ok) return recusar(`Não publicada: ${checagem.pendencias.join(' ')}`);
    const canal = await conexao(dados, conta);
    if (!canal) return recusar('Não publicada: o Instagram não está conectado (Ajustes › Conexões).');
    const token = await dados.revelar('canais_sociais', canal.id, 'token');
    if (!token) return recusar('Não publicada: reconecte o Instagram (Ajustes › Conexões).');
    return { p, canal, token, urls, texto: [legenda, p.hashtags ?? ''].filter(Boolean).join('\n\n') };
  });
  if (!prep) return null;
  if ('fim' in prep) return prep.fim;
  const { p, canal, token, urls, texto } = prep;
  let resultado: Record<string, unknown>;
  let tokenInvalido = false;
  try {
    const r = await publicar({ formato: p.formato, legenda: texto }, urls, canal.conta_externa_id, token);
    const agora = new Date().toISOString();
    resultado = {
      estado: 'publicada', publicada_em: agora, publicacao_id: r.id, permalink: r.permalink, publicada_por: 'api', erro: null, agendamento_id: null,
    };
  } catch (e) {
    if (!(e instanceof ErroInstagram)) {
      // Falha nossa (rede, bug): a peça não fica presa em "publicando".
      await amb.abrir((dados) => dados.atualizarSe('pecas', p.id, falha('Não foi possível publicar agora. Confira no Instagram antes de tentar de novo.'), { estado: 'publicando' }));
      throw e;
    }
    tokenInvalido = e.codigo === 'TOKEN_INVALIDO';
    resultado = falha(e.message);
  }
  return amb.abrir(async (dados) => {
    if (tokenInvalido) await dados.atualizar('canais_sociais', canal.id, { ultimo_erro: 'Acesso vencido ou revogado: reconecte.' });
    // Condicionada: se o corretor marcou "Publiquei por fora" (ou destravou) no meio, a marca dele fica.
    return (await dados.atualizarSe('pecas', p.id, resultado, { estado: 'publicando' })) ?? (await dados.buscar('pecas', p.id));
  });
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
      // Sem tipo não dá para saber se é profissional: recusa, como a conta pessoal.
      if (!['BUSINESS', 'MEDIA_CREATOR', 'CREATOR'].includes(tipo)) {
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
    // Peça com erro volta a publicar só se ainda está aprovada (editar a devolve para rascunho).
    if (!(p.estado === 'aprovada' || (p.estado === 'erro' && p.aprovada_em))) return erro(res, 409, 'ESTADO_INVALIDO', 'Aprove a peça antes de publicar.');
    const dados = req.dados!;
    // Cada fase numa transação: falha depois da reserva a desfaz, e a peça não fica presa em "publicando".
    const r = await publicarPeca({ abrir: (fn) => dados.transaction(fn), arquivos: req.arquivos, shell: req.shell! }, contaDoRequest(req), p.id, req.contexto!.usuario.id, { estado: p.estado });
    if (!r) return erro(res, 409, 'PECA_MUDOU', 'A peça mudou ou já está sendo publicada. Atualize a tela.');
    if (r.estado !== 'publicada') return erro(res, 422, 'NAO_PUBLICADA', r.erro ?? 'Não foi possível publicar.');
    res.json(r);
  }),
);

/**
 * Agendar no app (9.2): na hora marcada o evento `publicacao_programada` dispara e o listener
 * publica. Só peça aprovada é agendada (D-86).
 */
instagramRotas.post(
  '/estudio/pecas/:id/agendar',
  assincrono(async (req, res) => {
    const dados = req.dados!;
    const p = await pecaDaConta(req);
    if (!p) return erro(res, 404, 'NAO_ENCONTRADO', 'Peça não encontrada.');
    if (!(p.estado === 'aprovada' || (p.estado === 'erro' && p.aprovada_em))) {
      return erro(res, 409, 'ESTADO_INVALIDO', 'Aprove a peça antes de agendar.');
    }
    const quando = typeof req.body?.quando === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(req.body.quando) ? new Date(req.body.quando) : null;
    if (!quando || Number.isNaN(quando.getTime())) return erro(res, 422, 'DADOS_INVALIDOS', 'Escolha o dia e a hora.');
    if (quando.getTime() < Date.now() + 5 * 60_000) return erro(res, 422, 'DADOS_INVALIDOS', 'Agende com pelo menos 5 minutos de antecedência.');
    if (quando.getTime() > Date.now() + 90 * DIA) return erro(res, 422, 'DADOS_INVALIDOS', 'Agende para os próximos 90 dias.');
    if (!(await conexao(dados, contaDoRequest(req)))) {
      return erro(res, 409, 'INSTAGRAM_DESCONECTADO', 'Conecte o Instagram (Ajustes › Conexões) para agendar no app. Sem conexão, baixe a arte e agende no Instagram.');
    }
    const r = await req.eventos!.agendar('publicacao_programada', { peca_id: p.id, agendada_para: quando.toISOString() }, { em: quando });
    // Grava só se a peça não mudou desde a leitura (outra aba publicou ou agendou): senão desfaz o agendamento.
    const gravada = await dados.atualizarSe('pecas', p.id, { estado: 'agendada', agendada_para: quando.toISOString(), agendamento_id: Number(r.id), erro: null }, { estado: p.estado });
    if (!gravada) {
      await req.eventos!.cancelarAgendamento(Number(r.id)).catch(() => undefined);
      return erro(res, 409, 'PECA_MUDOU', 'A peça mudou enquanto você agendava. Atualize a tela.');
    }
    res.json(gravada);
  }),
);

instagramRotas.post(
  '/estudio/pecas/:id/cancelar-agendamento',
  assincrono(async (req, res) => {
    const dados = req.dados!;
    const p = await pecaDaConta(req);
    if (!p) return erro(res, 404, 'NAO_ENCONTRADO', 'Peça não encontrada.');
    if (p.estado !== 'agendada') return erro(res, 409, 'ESTADO_INVALIDO', 'A peça não está agendada.');
    // Primeiro a peça (condicionada: se o listener já a reservou, a publicação segue e o cancelar recusa);
    // depois o agendamento. Se cancelar o evento falhar, o listener o ignora: o agendamento_id não bate mais.
    const voltou = await dados.atualizarSe('pecas', p.id, { estado: p.aprovada_em ? 'aprovada' : 'rascunho', agendada_para: null, agendamento_id: null }, { estado: 'agendada', ...(p.agendamento_id ? { agendamento_id: p.agendamento_id } : {}) });
    if (!voltou) return erro(res, 409, 'PECA_MUDOU', 'A peça já está sendo publicada. Atualize a tela.');
    if (p.agendamento_id) await req.eventos!.cancelarAgendamento(p.agendamento_id).catch(() => undefined);
    res.json(voltou);
  }),
);

/** Tempo sem resposta para a peça "publicando" poder ser destravada (a publicação leva até uns 3 min). */
export const DESTRAVAR_APOS_MS = 15 * 60_000;

/**
 * Saída honesta para a publicação interrompida (processo reiniciou durante a Meta): depois de 15 min
 * em "publicando", a peça vai para erro, aprovada, com o aviso de conferir no Instagram.
 */
instagramRotas.post(
  '/estudio/pecas/:id/destravar',
  assincrono(async (req, res) => {
    const dados = req.dados!;
    const p = await pecaDaConta(req);
    if (!p) return erro(res, 404, 'NAO_ENCONTRADO', 'Peça não encontrada.');
    if (p.estado !== 'publicando') return erro(res, 409, 'ESTADO_INVALIDO', 'A peça não está em publicação.');
    const desde = new Date(Date.now() - DESTRAVAR_APOS_MS).toISOString();
    const r = await dados.atualizarSe('pecas', p.id, { estado: 'erro', erro: 'A publicação foi interrompida. Confira no Instagram: se o post saiu, use "Publiquei por fora"; se não, publique de novo.' }, { estado: 'publicando', 'atualizado_em[lt]': desde });
    if (!r) return erro(res, 409, 'AINDA_PUBLICANDO', 'A publicação ainda pode estar em andamento. Espere alguns minutos e atualize a tela.');
    res.json(r);
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
    const marcada = await dados.atualizarSe('pecas', p.id, { estado: 'publicada', publicada_em: new Date().toISOString(), permalink: link.slice(0, 300) || null, publicada_por: 'fora', agendamento_id: null, erro: null }, { estado: p.estado });
    if (!marcada) return erro(res, 409, 'PECA_MUDOU', 'A peça mudou. Atualize a tela.');
    if (p.agendamento_id) await req.eventos!.cancelarAgendamento(p.agendamento_id).catch(() => undefined);
    res.json(marcada);
  }),
);

// ---------- Listener e rotina ----------

interface EventoConta {
  payload: Record<string, any>;
  conta_id?: number | null;
}

/** Atraso máximo para publicar um agendamento (o barramento entrega o atrasado quando volta do ar). */
export const ATRASO_MAXIMO_MS = 6 * 3600_000;

/**
 * Hora de publicar uma peça agendada. Idempotente: publica só se a peça ainda está agendada por
 * este mesmo agendamento (`agendada_para` do evento = o da peça; reserva condicionada ao
 * `agendamento_id`). Reentrega, cancelamento e reagendamento não publicam de novo.
 */
export async function aoPublicacaoProgramada(evento: EventoConta, ctx: ContextoListener) {
  const conta = evento.conta_id ? Number(evento.conta_id) : null;
  const comConta = ctx.dados?.comConta;
  if (!conta || !comConta) return;
  const pecaId = Number(evento.payload.peca_id);
  const p = await comConta(conta, async (trx) => (await trx.varrerTudo('pecas', { filtros: { conta_id: conta, id: pecaId }, maximo: 1 }))[0]);
  if (!p || p.estado !== 'agendada' || !p.agendamento_id) return;
  const marcada = iso(p.agendada_para);
  if (!marcada || marcada !== evento.payload.agendada_para) return;
  if (Date.now() - new Date(marcada).getTime() > ATRASO_MAXIMO_MS) {
    await comConta(conta, (trx) => trx.atualizarSe('pecas', p.id, { estado: 'erro', erro: 'Não publicada na hora marcada (o sistema estava fora do ar). Publique agora ou agende de novo.', agendamento_id: null, agendada_para: null }, { estado: 'agendada', agendamento_id: p.agendamento_id }));
    return;
  }
  await publicarPeca({ abrir: (fn) => comConta(conta, fn), arquivos: ctx.arquivos, shell: ctx.shell }, conta, p.id, null, { estado: 'agendada', agendamento_id: Number(p.agendamento_id) });
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
    // BIGINT pode chegar como texto: compara e aponta a conta como número.
    const conta = Number(c.conta_id);
    if (!ativas.has(conta)) continue;
    // Vencido não renova mais: avisa uma vez e espera o corretor reconectar, sem falhar a rotina todo dia.
    if (c.token_expira_em && new Date(c.token_expira_em as string).getTime() < Date.now()) {
      if (!c.ultimo_erro) {
        await ctx.dados.comConta(conta, (trx) => trx.atualizar('canais_sociais', c.id, { ultimo_erro: 'O acesso venceu: reconecte o Instagram.' })).catch((e: Error) => falhas.push(`conta ${conta}: ${e.message}`));
      }
      continue;
    }
    try {
      await ctx.dados.comConta(conta, async (trx) => {
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

