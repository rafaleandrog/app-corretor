import '@urbiverso/sdk/express';
import type { Request } from 'express';
import type { HelperDados } from '@urbiverso/sdk';
import { autorizacaoVigente, SITUACOES_ANUNCIADAS, type Autorizacao } from '../comum/imoveis';
import { imovelPublico, TEMAS, type Bloco } from '../comum/pagina';
import { primeiro } from './acesso';

// Vitrine pública (D-55): a única tabela fora da segregação. Guarda só o que o corretor publicou e
// nenhum dado pessoal; é mantida aqui a cada publicação e lida pelas rotas públicas, que não
// enxergam tabela segregada. Por não ter RLS, toda leitura e escrita filtra a conta explicitamente.

type Linha = Record<string, any>;

/** Conta de escrita do request; a vitrine não tem carimbo automático. */
export function contaDoRequest(req: Request): number {
  const conta = req.contexto?.contaEscrita;
  if (!conta) throw Object.assign(new Error('Escolha a conta.'), { codigo: 'CONTA_NAO_INFORMADA', status: 400 });
  return conta;
}

const hojeEm = (fuso?: string) => new Date().toLocaleDateString('sv-SE', { timeZone: fuso || 'America/Sao_Paulo' });
const chaveImovel = (conta: number, imovelId: number) => `${conta}:${imovelId}`;

/** Linhas da vitrine desta conta (sempre com o filtro da conta). */
async function linhasDaConta(dados: HelperDados, conta: number, tipo: string, extra: Record<string, unknown> = {}) {
  return dados.varrerTudo('vitrine_publica', { filtros: { conta, tipo, ...extra }, maximo: 5000 });
}

async function gravar(dados: HelperDados, conta: number, tipo: string, chave: string, codigo: string | null, conteudo: unknown) {
  const agora = new Date().toISOString();
  const atual = (await linhasDaConta(dados, conta, tipo, { chave }))[0];
  if (atual) return dados.atualizar('vitrine_publica', atual.id, { dados: conteudo, codigo, publicado_em: agora });
  return dados.criar('vitrine_publica', { conta, tipo, chave, codigo, dados: conteudo, publicado_em: agora });
}

/** A página publicada da conta (ou `null`): sem página no ar, nada de imóvel vai para a vitrine. */
export async function paginaPublicada(dados: HelperDados) {
  const p = await primeiro(dados, 'paginas_corretor', { chave: 'conta' });
  return p?.publicada_em ? p : null;
}

/** Publicável: marcado para a página, anunciado e com autorização vigente (bloco 3). */
export function publicavel(im: Linha, autorizacoes: Linha[], dia: string): boolean {
  return !!im.publicado_pagina && SITUACOES_ANUNCIADAS.includes(im.situacao) && autorizacoes.some((a) => autorizacaoVigente(a as Autorizacao, dia));
}

/** Último dia da autorização vigente mais longa: a rota pública esconde o anúncio depois dele. */
export function vigenteAte(autorizacoes: Linha[], dia: string): string | null {
  const fins = autorizacoes.filter((a) => autorizacaoVigente(a as Autorizacao, dia)).map((a) => String(a.fim ?? '')).filter(Boolean).sort();
  return fins.pop() ?? null;
}

/**
 * Põe ou tira um imóvel da vitrine conforme o estado atual. Chamada depois de toda mudança que
 * afeta o anúncio (dados, fotos, autorização, remoção). Idempotente.
 */
export async function sincronizarImovel(req: Request, imovelId: number): Promise<void> {
  const dados = req.dados!;
  const conta = contaDoRequest(req);
  const chave = chaveImovel(conta, imovelId);
  const pagina = await paginaPublicada(dados);
  const im = await dados.buscar('imoveis', imovelId);
  let entra = false;
  let midias: Linha[] = [];
  let autorizacoes: Linha[] = [];
  if (pagina && im) {
    const [m, a] = await Promise.all([
      dados.varrerTudo('imovel_midias', { filtros: { imovel_id: imovelId }, maximo: 200 }),
      dados.varrerTudo('autorizacoes_venda', { filtros: { imovel_id: imovelId }, maximo: 200 }),
    ]);
    midias = m;
    autorizacoes = a;
    entra = publicavel(im, a, hojeEm(req.contexto?.fuso));
  }
  if (entra) {
    await gravar(dados, conta, 'imovel', chave, im!.codigo, { ...imovelPublico(im!, midias), vigente_ate: vigenteAte(autorizacoes, hojeEm(req.contexto?.fuso)) });
  } else {
    for (const l of await linhasDaConta(dados, conta, 'imovel', { chave })) await dados.deletar('vitrine_publica', l.id);
  }
}

/** Mesma coisa, sem derrubar a rota que já gravou a mudança principal: a página atualiza na próxima publicação. */
export async function tentarSincronizar(req: Request, imovelId: number): Promise<void> {
  try {
    await sincronizarImovel(req, imovelId);
  } catch (e) {
    console.warn(`[portal_corretor] vitrine: imóvel ${imovelId} não sincronizado: ${(e as Error).message}`);
  }
}

/** Dados públicos da página: só o que o corretor escreveu e o contato profissional dele. */
export async function conteudoPagina(req: Request, pagina: Linha) {
  const dados = req.dados!;
  const [eu, conta] = await Promise.all([
    primeiro(dados, 'perfis_corretor', { usuario_id: req.contexto!.usuario.id }),
    primeiro(dados, 'perfil_conta', { chave: 'conta' }),
  ]);
  return {
    endereco: pagina.endereco,
    nome: pagina.nome_exibicao,
    creci: eu?.creci ?? conta?.creci_juridico ?? null,
    telefone: eu?.telefone ?? null,
    cor: TEMAS[pagina.tema]?.cor ?? TEMAS.oceano.cor,
    blocos: (pagina.blocos as Bloco[]).filter((b) => b.ativo),
    url_formulario: pagina.url_formulario ?? null,
  };
}

/**
 * Reconstrói a vitrine inteira da conta: a página e todos os imóveis publicáveis; o que deixou de
 * ser publicável sai. Usada ao publicar e no "Atualizar agora".
 */
export async function sincronizarTudo(req: Request): Promise<{ imoveis: number }> {
  const dados = req.dados!;
  const conta = contaDoRequest(req);
  const pagina = await paginaPublicada(dados);
  if (!pagina) {
    await despublicarTudo(dados, conta);
    return { imoveis: 0 };
  }
  // Endereço mudou: a linha antiga da página sai.
  for (const l of await linhasDaConta(dados, conta, 'pagina')) if (l.chave !== pagina.endereco) await dados.deletar('vitrine_publica', l.id);
  await gravar(dados, conta, 'pagina', pagina.endereco, null, await conteudoPagina(req, pagina));
  const imoveis = await dados.varrerTudo('imoveis', { filtros: { publicado_pagina: true }, maximo: 5000 });
  const ids = imoveis.map((i) => i.id).join(',');
  const [midias, autorizacoes] = imoveis.length
    ? await Promise.all([
        dados.varrerTudo('imovel_midias', { filtros: { imovel_id: ids }, maximo: 50000 }),
        dados.varrerTudo('autorizacoes_venda', { filtros: { imovel_id: ids }, maximo: 20000 }),
      ])
    : [[], []];
  const dia = hojeEm(req.contexto?.fuso);
  const ficam = new Set<string>();
  for (const im of imoveis) {
    const dele = autorizacoes.filter((a) => a.imovel_id === im.id);
    if (!publicavel(im, dele, dia)) continue;
    const chave = chaveImovel(conta, im.id);
    ficam.add(chave);
    await gravar(dados, conta, 'imovel', chave, im.codigo, { ...imovelPublico(im, midias.filter((m) => m.imovel_id === im.id)), vigente_ate: vigenteAte(dele, dia) });
  }
  for (const l of await linhasDaConta(dados, conta, 'imovel')) if (!ficam.has(l.chave)) await dados.deletar('vitrine_publica', l.id);
  return { imoveis: ficam.size };
}

/** Tira a página e os imóveis da conta da vitrine (os links ficam, e passam a dizer "indisponível"). */
export async function despublicarTudo(dados: HelperDados, conta: number) {
  for (const tipo of ['pagina', 'imovel']) for (const l of await linhasDaConta(dados, conta, tipo)) await dados.deletar('vitrine_publica', l.id);
}

/** Origem pública da instância, tirada da URL absoluta do ingresso (vazia se a instância não tem URL pública). */
export function origemPublica(urlIngresso: string | null | undefined): string {
  try {
    return urlIngresso ? new URL(urlIngresso).origin : '';
  } catch {
    return '';
  }
}

/**
 * Link rastreado (D-68) para um imóvel enviado: só quando a página está no ar e o imóvel está na
 * vitrine. Devolve a URL completa ou `null`.
 */
export async function criarLink(req: Request, codigoLink: string, imovelId: number): Promise<string | null> {
  const dados = req.dados!;
  const conta = contaDoRequest(req);
  const pagina = await paginaPublicada(dados);
  if (!pagina?.url_clique) return null;
  const naVitrine = (await linhasDaConta(dados, conta, 'imovel', { chave: chaveImovel(conta, imovelId) }))[0];
  if (!naVitrine) return null;
  await gravar(dados, conta, 'link', codigoLink, naVitrine.codigo, { imovel_chave: naVitrine.chave, url_clique: pagina.url_clique });
  return `${origemPublica(pagina.url_clique)}/portal_corretor/l?c=${encodeURIComponent(codigoLink)}`;
}
