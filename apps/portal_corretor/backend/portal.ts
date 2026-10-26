import type { HelperDados } from '@urbiverso/sdk';
import { iso } from '../comum/funil';
import { autorizacaoVigente, SITUACOES_ANUNCIADAS, type Autorizacao } from '../comum/imoveis';
import { MARCA_PADRAO } from '../comum/estudio';
import { imovelPublico } from '../comum/pagina';

// Seleções e Portal do Cliente na vitrine pública (bloco 5b, D-56, D-73). O cliente abre por link com
// o token do ingresso `wh`; a rota pública só lê a vitrine. Estas funções servem à rota do corretor
// (helper do request) e aos listeners (SISTEMA, que lê todas as contas): toda leitura filtra a conta.

type Linha = Record<string, any>;

export interface Corretor {
  nome: string;
  creci: string | null;
  telefone: string | null;
  cor: string;
  /** Arquivo da foto do corretor (`marca_arquivos`); a rota pública troca por uma URL assinada. */
  foto: number | null;
}

/**
 * O que da marca vai a público (D-85): a cor principal e a foto do corretor. Lida sempre com o
 * filtro da conta: os listeners rodam como SISTEMA e enxergam todas as contas.
 */
export async function marcaPublica(dados: HelperDados, conta: number): Promise<{ cor: string; foto: number | null }> {
  const [marca, foto] = await Promise.all([
    umaLinha(dados, 'marca_conta', { conta_id: conta, chave: 'conta' }),
    umaLinha(dados, 'marca_arquivos', { conta_id: conta, tipo: 'foto' }),
  ]);
  return { cor: marca?.cor_primaria ?? MARCA_PADRAO.cor_primaria, foto: foto?.arquivo ? Number(foto.arquivo) : null };
}

/** O topo de uma seleção ou portal com a marca atual da conta; `null` continua `null`. */
async function comMarca(dados: HelperDados, conta: number, topo: Corretor | null | undefined): Promise<Corretor | null> {
  return topo ? { ...topo, ...(await marcaPublica(dados, conta)) } : null;
}

const chave = (conta: number, id: number) => `${conta}:${id}`;

async function umaLinha(dados: HelperDados, tabela: string, filtros: Record<string, unknown>): Promise<Linha | null> {
  return (await dados.varrerTudo(tabela, { filtros, maximo: 1 }))[0] ?? null;
}

async function gravarVitrine(dados: HelperDados, conta: number, tipo: string, id: number, conteudo: unknown) {
  const agora = new Date().toISOString();
  const atual = await umaLinha(dados, 'vitrine_publica', { conta, tipo, chave: chave(conta, id) });
  if (atual) return dados.atualizar('vitrine_publica', atual.id, { dados: conteudo, publicado_em: agora });
  return dados.criar('vitrine_publica', { conta, tipo, chave: chave(conta, id), codigo: null, dados: conteudo, publicado_em: agora });
}

export async function apagarVitrine(dados: HelperDados, conta: number, tipo: string, id: number) {
  const atual = await umaLinha(dados, 'vitrine_publica', { conta, tipo, chave: chave(conta, id) });
  if (atual) await dados.deletar('vitrine_publica', atual.id);
}

export async function lerVitrine(dados: HelperDados, conta: number, tipo: string, id: number) {
  return umaLinha(dados, 'vitrine_publica', { conta, tipo, chave: chave(conta, id) });
}

/** Quem aparece no topo da seleção e do portal: o nome da página (se houver), o perfil do corretor e a marca da conta. */
export async function corretorDaConta(dados: HelperDados, conta: number, usuarioId: number, nomeUsuario: string): Promise<Corretor> {
  const [pagina, perfil, contaLinha, marca] = await Promise.all([
    umaLinha(dados, 'paginas_corretor', { conta_id: conta, chave: 'conta' }),
    umaLinha(dados, 'perfis_corretor', { conta_id: conta, usuario_id: usuarioId }),
    umaLinha(dados, 'perfil_conta', { conta_id: conta, chave: 'conta' }),
    marcaPublica(dados, conta),
  ]);
  return {
    nome: pagina?.nome_exibicao || nomeUsuario || contaLinha?.nome || 'Seu corretor',
    creci: perfil?.creci ?? contaLinha?.creci_juridico ?? null,
    telefone: perfil?.telefone ?? null,
    ...marca,
  };
}

const hojeSp = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });

/**
 * Seleção na vitrine, refeita a partir das tabelas (fonte da verdade): o anúncio atual de cada
 * imóvel, só com dado público, e a reação gravada. Imóvel que deixou de ser anunciável (vendido,
 * retirado, autorização vencida, removido) sai. `corretor` ausente (listener) mantém o topo publicado.
 * Seleção revogada ou vencida sai da vitrine.
 */
export async function publicarSelecao(dados: HelperDados, conta: number, selecao: Linha, corretor?: Corretor) {
  if (!selecaoValida(selecao)) {
    await apagarVitrine(dados, conta, 'selecao', selecao.id);
    return;
  }
  const itens = await dados.varrerTudo('selecao_itens', { filtros: { conta_id: conta, selecao_id: selecao.id }, ordenar: 'ordem', ordem: 'asc', maximo: 50 });
  const ids = itens.map((i) => i.imovel_id).join(',');
  const [imoveis, midias, autorizacoes] = itens.length
    ? await Promise.all([
        dados.varrerTudo('imoveis', { filtros: { conta_id: conta, id: ids }, maximo: 50 }),
        dados.varrerTudo('imovel_midias', { filtros: { conta_id: conta, imovel_id: ids }, maximo: 2000 }),
        dados.varrerTudo('autorizacoes_venda', { filtros: { conta_id: conta, imovel_id: ids }, maximo: 500 }),
      ])
    : [[], [], []];
  const dia = hojeSp();
  const anunciavel = (im: Linha) => SITUACOES_ANUNCIADAS.includes(im.situacao) && autorizacoes.some((a) => a.imovel_id === im.id && autorizacaoVigente(a as Autorizacao, dia));
  const porId = new Map(imoveis.filter(anunciavel).map((i) => [i.id, i]));
  const atual = corretor ? null : await lerVitrine(dados, conta, 'selecao', selecao.id);
  await gravarVitrine(dados, conta, 'selecao', selecao.id, {
    titulo: selecao.titulo,
    mensagem: selecao.mensagem ?? null,
    enviada_em: iso(selecao.enviada_em),
    expira_em: iso(selecao.expira_em),
    url_reacao: selecao.url_reacao ?? null,
    // A marca é sempre a atual da conta, mesmo quando o resto do topo é o já publicado.
    corretor: await comMarca(dados, conta, corretor ?? (atual?.dados as Linha | undefined)?.corretor),
    itens: itens
      .filter((i) => porId.has(i.imovel_id))
      .map((i) => ({ ...imovelPublico(porId.get(i.imovel_id)!, midias.filter((m) => m.imovel_id === i.imovel_id)), reacao: i.reacao ?? null })),
  });
}

/** Imóvel mudou (anúncio, fotos, autorização, remoção): as seleções válidas que o têm acompanham. */
export async function atualizarSelecoesDoImovel(dados: HelperDados, conta: number, imovelId: number) {
  const itens = await dados.varrerTudo('selecao_itens', { filtros: { conta_id: conta, imovel_id: imovelId }, maximo: 500 });
  if (!itens.length) return;
  const selecoes = await dados.varrerTudo('selecoes', { filtros: { conta_id: conta, id: [...new Set(itens.map((i) => i.selecao_id))].join(','), 'revogada_em[nulo]': 'true' }, maximo: 500 });
  for (const s of selecoes) await publicarSelecao(dados, conta, s);
}

/** Retira da vitrine as seleções vencidas da conta (a rota pública já as esconde; aqui é limpeza). */
export async function limparSelecoesVencidas(dados: HelperDados, conta: number) {
  const agora = new Date().toISOString();
  const linhas = await dados.varrerTudo('vitrine_publica', { filtros: { conta, tipo: 'selecao' }, maximo: 5000 });
  for (const l of linhas) if (l.dados?.expira_em && String(l.dados.expira_em) <= agora) await dados.deletar('vitrine_publica', l.id);
}

interface RevogadorWh {
  revogarIngressoWh(o: { webhook: string; ingresso_id: number }): Promise<unknown>;
}

/** Revoga um ingresso; o que já não existe não impede o resto. */
export async function revogarIngresso(shell: RevogadorWh, webhook: string, ingresso: number) {
  try {
    await shell.revogarIngressoWh({ webhook, ingresso_id: ingresso });
  } catch (e) {
    const codigo = (e as { codigo?: string })?.codigo;
    if (codigo !== 'WH_INGRESSO_NAO_ENCONTRADO' && codigo !== 'WH_NAO_ENCONTRADO') throw e;
  }
}

/**
 * Cliente removido: o portal e as seleções dele param de abrir (ingressos revogados e vitrine
 * apagada). Sem isso o link seguiria vivo e já não haveria ficha para revogá-lo.
 */
export async function encerrarAcessosDoCliente(dados: HelperDados, shell: RevogadorWh, conta: number, contatoId: number) {
  const agora = new Date().toISOString();
  const acessos = await dados.varrerTudo('acessos_cliente', { filtros: { conta_id: conta, contato_id: contatoId, 'revogado_em[nulo]': 'true' }, maximo: 20 });
  for (const a of acessos) {
    if (a.ingresso_id) await revogarIngresso(shell, 'acao_cliente', a.ingresso_id);
    await dados.atualizar('acessos_cliente', a.id, { revogado_em: agora });
  }
  const selecoes = await dados.varrerTudo('selecoes', { filtros: { conta_id: conta, contato_id: contatoId, 'revogada_em[nulo]': 'true' }, maximo: 500 });
  for (const s of selecoes) {
    if (s.ingresso_id) await revogarIngresso(shell, 'reacao_selecao', s.ingresso_id);
    await dados.atualizar('selecoes', s.id, { revogada_em: agora });
    await apagarVitrine(dados, conta, 'selecao', s.id);
  }
  await apagarVitrine(dados, conta, 'portal', contatoId);
}

/** Seleção que o cliente ainda pode abrir: enviada, não revogada, dentro da validade. */
export function selecaoValida(s: Linha, agora = new Date().toISOString()): boolean {
  const expira = iso(s.expira_em);
  return !s.revogada_em && (!expira || expira > agora);
}

/**
 * Portal do Cliente (11.3, comprador): as seleções válidas, a agenda de visitas, a jornada e o topo
 * com o corretor. Nada de nome, telefone ou e-mail do cliente (D-73). Sem acesso ativo, a linha sai.
 * `corretor` ausente (listener) mantém o topo já publicado.
 */
export async function sincronizarPortal(dados: HelperDados, conta: number, contatoId: number, corretor?: Corretor): Promise<void> {
  const acesso = await umaLinha(dados, 'acessos_cliente', { conta_id: conta, contato_id: contatoId, 'revogado_em[nulo]': 'true' });
  if (!acesso) {
    await apagarVitrine(dados, conta, 'portal', contatoId);
    return;
  }
  const atual = await lerVitrine(dados, conta, 'portal', contatoId);
  const topo = await comMarca(dados, conta, corretor ?? (atual?.dados as Linha | undefined)?.corretor);
  const [contato, selecoes, atividades] = await Promise.all([
    umaLinha(dados, 'contatos', { conta_id: conta, id: contatoId }),
    dados.varrerTudo('selecoes', { filtros: { conta_id: conta, contato_id: contatoId }, ordenar: 'enviada_em', ordem: 'desc', maximo: 200 }),
    dados.varrerTudo('atividades', { filtros: { conta_id: conta, contato_id: contatoId, tipo: 'visita' }, ordenar: 'quando', ordem: 'asc', maximo: 500 }),
  ]);
  if (!contato) {
    await apagarVitrine(dados, conta, 'portal', contatoId);
    return;
  }
  const agora = new Date().toISOString();
  const validas = selecoes.filter((s) => selecaoValida(s, agora));
  const visitas = atividades.length
    ? await dados.varrerTudo('visitas', { filtros: { conta_id: conta, atividade_id: atividades.map((a) => a.id).join(',') }, maximo: 500 })
    : [];
  const imovelDe = new Map(visitas.map((v) => [v.atividade_id, v.imovel_id]));
  const imoveisIds = [...new Set(visitas.map((v) => v.imovel_id))];
  const imoveis = imoveisIds.length ? await dados.varrerTudo('imoveis', { filtros: { conta_id: conta, id: imoveisIds.join(',') }, maximo: 500 }) : [];
  const imovel = new Map(imoveis.map((i) => [i.id, i]));
  const ontem = new Date(Date.now() - 86400e3).toISOString();
  const agenda = atividades
    .filter((a) => a.status === 'pendente' && (iso(a.quando) ?? '') >= ontem)
    .slice(0, 20)
    .map((a) => {
      const im = imovel.get(imovelDe.get(a.id));
      return {
        ref: a.id,
        quando: iso(a.quando),
        // Do imóvel, só o que pode aparecer num anúncio (o endereço segue `endereco_publico`).
        imovel: im ? { codigo: im.codigo, titulo: im.titulo ?? null, bairro: im.endereco_publico === 'regiao' ? null : (im.bairro ?? null), cidade: im.cidade ?? null, endereco: im.endereco_publico === 'completo' ? (im.endereco ?? null) : null } : null,
      };
    });
  // "Imóveis recebidos" conta tudo o que foi enviado e não revogado, inclusive em seleções vencidas.
  const enviadas = selecoes.filter((s) => !s.revogada_em);
  const itens = enviadas.length ? await dados.varrerTudo('selecao_itens', { filtros: { conta_id: conta, selecao_id: enviadas.map((s) => s.id).join(',') }, maximo: 5000 }) : [];
  await gravarVitrine(dados, conta, 'portal', contatoId, {
    corretor: topo,
    url_acoes: acesso.url_acoes ?? null,
    selecoes: validas.map((s) => s.id),
    agenda,
    jornada: {
      desde: (iso(contato.criado_em) ?? agora).slice(0, 10),
      imoveis_recebidos: new Set(itens.map((i) => i.imovel_id)).size,
      visitas_feitas: atividades.filter((a) => a.status === 'feita').length,
    },
  });
}

/** Para rotas que mudam a agenda ou as seleções: o portal acompanha sem derrubar a rota. */
export async function tentarPortal(dados: HelperDados, conta: number | undefined, contatoId: number | null | undefined, corretor?: Corretor) {
  if (!conta || !contatoId) return;
  try {
    await sincronizarPortal(dados, conta, contatoId, corretor);
  } catch (e) {
    console.warn(`[portal_corretor] portal do cliente ${contatoId}: não sincronizado: ${(e as Error).message}`);
  }
}

/** Id do registro pela chave da vitrine (`<conta>:<id>`), só se a chave for desta conta. */
const idDaChave = (conta: number, c: unknown) => {
  const [dona, id] = String(c ?? '').split(':').map(Number);
  return dona === conta && Number.isInteger(id) && id > 0 ? id : null;
};

/**
 * Marca salva (D-85): as seleções e os portais que estão na vitrine são republicados com a cor e a
 * foto novas. O resto do topo (nome, CRECI, telefone de quem enviou) continua o já publicado.
 */
export async function aplicarMarcaNaVitrine(dados: HelperDados, conta: number): Promise<void> {
  const [selecoesNaVitrine, portais] = await Promise.all([
    dados.varrerTudo('vitrine_publica', { filtros: { conta, tipo: 'selecao' }, maximo: 5000 }),
    dados.varrerTudo('vitrine_publica', { filtros: { conta, tipo: 'portal' }, maximo: 5000 }),
  ]);
  const ids = selecoesNaVitrine.map((l) => idDaChave(conta, l.chave)).filter((id): id is number => !!id);
  const selecoes = ids.length ? await dados.varrerTudo('selecoes', { filtros: { conta_id: conta, id: ids.join(',') }, maximo: 5000 }) : [];
  for (const s of selecoes) await publicarSelecao(dados, conta, s);
  for (const l of portais) {
    const contatoId = idDaChave(conta, l.chave);
    if (contatoId) await sincronizarPortal(dados, conta, contatoId);
  }
}
