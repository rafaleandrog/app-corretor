import type { HelperDados } from '@urbiverso/sdk';
import { fusoValido } from '../comum/assistente';
import { iso } from '../comum/funil';
import { autorizacaoVigente, SITUACOES_ANUNCIADAS, type Autorizacao } from '../comum/imoveis';
import { MARCA_PADRAO } from '../comum/estudio';
import { imovelPublico } from '../comum/pagina';
import { negociacaoPublica } from '../comum/portal-cliente';

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
    // O nome profissional do perfil (P13) vem antes do nome do usuário da plataforma.
    nome: pagina?.nome_exibicao || perfil?.nome_profissional || nomeUsuario || contaLinha?.nome || 'Seu corretor',
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
 * Portal do Cliente (11.3, comprador; bloco 9, modelo Compass One): o topo com o corretor e o
 * próximo passo escrito para o cliente, as seleções válidas, a agenda de visitas, as pendências do
 * cliente e a jornada. Nada de nome, telefone ou e-mail do cliente (D-73). Sem acesso ativo, a linha sai.
 * `corretor` ausente (listener) mantém o topo já publicado.
 */
export async function sincronizarPortal(dados: HelperDados, conta: number, contatoId: number, corretor?: Corretor, fuso?: string): Promise<void> {
  const acesso = await umaLinha(dados, 'acessos_cliente', { conta_id: conta, contato_id: contatoId, 'revogado_em[nulo]': 'true' });
  if (!acesso) {
    await apagarVitrine(dados, conta, 'portal', contatoId);
    return;
  }
  const atual = await lerVitrine(dados, conta, 'portal', contatoId);
  const topo = await comMarca(dados, conta, corretor ?? (atual?.dados as Linha | undefined)?.corretor);
  const [contato, selecoes, atividades, tarefas, negociacoes] = await Promise.all([
    umaLinha(dados, 'contatos', { conta_id: conta, id: contatoId }),
    dados.varrerTudo('selecoes', { filtros: { conta_id: conta, contato_id: contatoId }, ordenar: 'enviada_em', ordem: 'desc', maximo: 200 }),
    dados.varrerTudo('atividades', { filtros: { conta_id: conta, contato_id: contatoId, tipo: 'visita' }, ordenar: 'quando', ordem: 'asc', maximo: 500 }),
    // Abertas (para a lista do portal) e as feitas mais recentes (para a jornada), cada uma com o seu filtro
    // na consulta (#80): as feitas antigas não enchem o teto nem derrubam a montagem do portal.
    Promise.all([
      dados.varrerTudo('tarefas_cliente', { filtros: { conta_id: conta, contato_id: contatoId, 'feita_em[nulo]': 'true' }, ordenar: 'criado_em', ordem: 'asc', maximo: 200 }),
      dados.listar('tarefas_cliente', { filtros: { conta_id: conta, contato_id: contatoId, 'feita_em[nulo]': 'false' }, ordenar: 'feita_em', ordem: 'desc', por_pagina: 50 }),
    ]).then(([abertas, feitas]) => [...abertas, ...feitas.dados]),
    dados.varrerTudo('negociacoes', { filtros: { conta_id: conta, contato_id: contatoId }, ordenar: 'id', ordem: 'asc', maximo: 50 }),
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
  // Propostas (D5, M5b): a negociação perdida sai do portal; as outras, com o que a lista permitida deixa.
  const abertas = negociacoes.filter((n) => n.estado !== 'perdida');
  const propostas = abertas.length
    ? await dados.varrerTudo('propostas', { filtros: { conta_id: conta, negociacao_id: abertas.map((n) => n.id).join(',') }, ordenar: 'id', ordem: 'asc', maximo: 2000 })
    : [];
  const imoveisIds = [...new Set([...visitas.map((v) => v.imovel_id), ...abertas.map((n) => n.imovel_id)].filter(Boolean))];
  const imoveis = imoveisIds.length ? await dados.varrerTudo('imoveis', { filtros: { conta_id: conta, id: imoveisIds.join(',') }, maximo: 500 }) : [];
  const imovel = new Map(imoveis.map((i) => [i.id, i]));
  // Do imóvel, só o que pode aparecer num anúncio (o endereço segue `endereco_publico`).
  const imovelPublicoDe = (im: Linha | undefined) =>
    im ? { codigo: im.codigo, titulo: im.titulo ?? null, bairro: im.endereco_publico === 'regiao' ? null : (im.bairro ?? null), cidade: im.cidade ?? null, endereco: im.endereco_publico === 'completo' ? (im.endereco ?? null) : null } : null;
  const ontem = new Date(Date.now() - 86400e3).toISOString();
  const agenda = atividades
    .filter((a) => a.status === 'pendente' && (iso(a.quando) ?? '') >= ontem)
    .slice(0, 20)
    .map((a) => ({ ref: a.id, quando: iso(a.quando), imovel: imovelPublicoDe(imovel.get(imovelDe.get(a.id))) }));
  // "Imóveis recebidos" conta tudo o que foi enviado e não revogado, inclusive em seleções vencidas.
  const enviadas = selecoes.filter((s) => !s.revogada_em);
  const itens = enviadas.length ? await dados.varrerTudo('selecao_itens', { filtros: { conta_id: conta, selecao_id: enviadas.map((s) => s.id).join(',') }, maximo: 5000 }) : [];
  const desde = (iso(contato.criado_em) ?? agora).slice(0, 10);
  const feitas = atividades.filter((a) => a.status === 'feita');
  await gravarVitrine(dados, conta, 'portal', contatoId, {
    corretor: topo,
    // Fuso da conta: a página pública roda no navegador do cliente (outro fuso possível), então a hora da
    // visita é formatada neste. Sem `fuso` (listener), mantém o já publicado; sem nenhum, Brasília.
    fuso: fusoValido(fuso ?? (atual?.dados as Linha | undefined)?.fuso),
    url_acoes: acesso.url_acoes ?? null,
    // Só o texto escrito para o cliente, e só quando preenchido: o `proximo_passo` interno nunca sai (D-55).
    ...(contato.proximo_passo_cliente ? { proximo_passo: contato.proximo_passo_cliente } : {}),
    selecoes: validas.map((s) => s.id),
    agenda,
    // "O que falta de você": as pendências que o corretor pediu; a feita sai na sincronização seguinte.
    tarefas: tarefas.filter((t) => !t.feita_em).map((t) => ({ ref: t.id, texto: t.texto })),
    // Nunca o mandato, o teto estimado nem quem conduz: só o que `negociacaoPublica` permite.
    negociacoes: abertas.map((n) => negociacaoPublica(n, propostas, imovelPublicoDe(imovel.get(n.imovel_id)), Number(imovel.get(n.imovel_id)?.preco_c) || null)),
    // A conversa com o corretor (M4, #191): as mensagens que o cliente pode ver.
    conversa: await conversaDoPortal(dados, conta, contatoId),
    jornada: {
      desde,
      imoveis_recebidos: new Set(itens.map((i) => i.imovel_id)).size,
      visitas_feitas: feitas.length,
      eventos: eventosDaJornada(desde, enviadas, itens, feitas, imovelDe, imovel, tarefas, imovelPublicoDe),
    },
  });
}

/** Quantas mensagens da conversa o portal mostra (as mais recentes). */
export const MENSAGENS_NO_PORTAL = 40;

/**
 * Canais em que a mensagem foi de fato escrita entre o cliente e o corretor: o portal, o WhatsApp do
 * app e o WhatsApp do celular do corretor (`wa_me`, aberto com o texto pronto). `registro` fica de
 * fora: é o que o corretor anotou sem o app entregar (cliente sem WhatsApp, "só registrar", abordagem
 * por ligação, visita ou e-mail, envio presencial), e `sistema` são os avisos internos.
 */
const CANAIS_ESCRITOS = new Set(['portal', 'whatsapp', 'wa_me']);

/** Marca, em `mensagens.dados.aviso`, do recado interno ao corretor gravado como entrada do cliente (#194). */
export const MARCA_AVISO_OFERTA = 'oferta_implausivel';

/**
 * O recado da oferta implausível (#194) sem a marca: o texto que o webhook do portal publica como
 * mensagem (`publico.ts`, "Pelo portal, o cliente tentou ofertar …"), e as linhas gravadas antes da marca.
 */
const TEXTO_AVISO_OFERTA = /^Pelo portal, o cliente tentou ofertar .+; a oferta não foi registrada \(valor fora do esperado\)\.$/s;

/** A mensagem é um aviso interno ao corretor, ainda que gravada como entrada do cliente? */
export const ehAvisoInterno = (m: Linha) =>
  ((m.dados ?? {}) as Linha).aviso === MARCA_AVISO_OFERTA || (m.direcao === 'entrada' && TEXTO_AVISO_OFERTA.test(String(m.conteudo ?? '')));

/**
 * A mensagem veio do "Registrar envio" (`envios.ts`)? Lá o corretor anota o que mandou pelo próprio
 * WhatsApp, e o `conteudo` (o "Detalhe") é essa anotação, não o texto que chegou ao cliente. Marcada
 * por `dados.envio_id`; as gravadas antes da marca, pela forma do cartão do envio (a chave `link` em
 * `dados`, presente mesmo nula), que nenhuma outra saída do corretor de texto, arquivo, localização ou
 * imóvel leva.
 */
export const veioDeEnvio = (m: Linha) => {
  const d = (m.dados ?? {}) as Linha;
  if (m.direcao !== 'saida' || m.autor_tipo !== 'humano') return false;
  return d.envio_id != null || (m.tipo !== 'selecao' && m.tipo !== 'link_portal' && 'link' in d);
};

/** A mensagem pode aparecer no chat do portal (D-132)? */
const visivelNoPortal = (m: Linha) =>
  ((m.direcao === 'entrada' && m.autor_tipo === 'contato') || (m.direcao === 'saida' && m.autor_tipo !== 'sistema')) &&
  CANAIS_ESCRITOS.has(String(m.canal)) &&
  m.status !== 'falhou' &&
  m.tipo !== 'sistema' &&
  m.tipo !== 'link_portal' &&
  !ehAvisoInterno(m) &&
  // Do envio registrado só o cartão do imóvel foi ao cliente; o resto é anotação (arquivo, localização, mensagem, simulação).
  (!veioDeEnvio(m) || m.tipo === 'imovel');

/** Linhas lidas por página ao montar o chat: a primeira quase sempre basta. */
const LEITURA_DO_PORTAL = MENSAGENS_NO_PORTAL * 3;

/**
 * A conversa do cliente no portal (M4, #191; exceção da vitrine decidida na D-132): só o que o cliente
 * escreveu e o que lhe foi entregue por escrito. Entra a mensagem que é:
 * - de entrada com autor `contato`, ou de saída (corretor, Negociador ou atendimento automático);
 * - por um canal escrito (`portal`, `whatsapp`, `wa_me`): o `registro` é anotação do corretor, não entrega;
 * - sem falha de envio (`status` diferente de `falhou`);
 * - não é aviso: nem `tipo`/`autor_tipo` `sistema`, nem o recado interno da oferta implausível
 *   (`ehAvisoInterno`), nem o próprio link do portal (`link_portal`);
 * - não é anotação do "Registrar envio" (`veioDeEnvio`): dele só entra o cartão do imóvel.
 * Das que passam, as 40 mais recentes, da mais antiga para a mais nova: lê em páginas, da mais nova para
 * a mais antiga, e para quando junta 40 ou a conversa acaba (o canal já vai no filtro do banco). Cartão
 * nunca leva texto livre: o de imóvel só código, título, bairro e preço (nem o link rastreado nem o id
 * interno do imóvel), o da seleção só título e quantidade; o `conteudo` gravado com eles fica na P02.
 */
export async function conversaDoPortal(dados: HelperDados, conta: number, contatoId: number) {
  const vistas = new Set<number>();
  const visiveis: Linha[] = [];
  for (let pagina = 1; visiveis.length < MENSAGENS_NO_PORTAL; pagina++) {
    const r = await dados.listar('mensagens', {
      filtros: { conta_id: conta, contato_id: contatoId, canal: [...CANAIS_ESCRITOS].join(',') },
      ordenar: 'em', ordem: 'desc', pagina, por_pagina: LEITURA_DO_PORTAL,
    });
    for (const m of r.dados) {
      // Mensagem nova entre duas páginas empurra a anterior para a página seguinte: não conta duas vezes.
      if (vistas.has(Number(m.id))) continue;
      vistas.add(Number(m.id));
      if (visivelNoPortal(m)) visiveis.push(m);
    }
    if (r.dados.length < LEITURA_DO_PORTAL) break;
  }
  return visiveis
    .sort((a, b) => String(iso(b.em)).localeCompare(String(iso(a.em))))
    .slice(0, MENSAGENS_NO_PORTAL)
    .reverse()
    .map((m) => {
      const d = (m.dados ?? {}) as Linha;
      const base = { ref: Number(m.id), de: m.direcao === 'entrada' ? 'voce' : 'corretor', tipo: m.tipo as string, em: iso(m.em) };
      if (m.tipo === 'imovel') return { ...base, texto: null, imovel: { codigo: d.codigo ?? null, titulo: d.titulo ?? null, bairro: d.bairro ?? null, preco_c: d.preco_c ?? null } };
      if (m.tipo === 'selecao') return { ...base, texto: null, selecao: { titulo: d.titulo ?? m.conteudo ?? null, quantidade: Number(d.quantidade) || null } };
      return { ...base, texto: m.conteudo ?? null };
    });
}

export interface EventoJornada {
  tipo: 'inicio' | 'selecao' | 'visita' | 'tarefa';
  quando: string;
  texto: string;
}

/**
 * "Sua jornada" como linha do tempo (bloco 9): o começo, cada seleção recebida, cada visita feita e
 * cada pendência resolvida, da mais recente para a mais antiga. Só o que o corretor publicou: título
 * da seleção, imóvel do jeito do anúncio e o texto da pendência. Nunca o título interno da visita.
 */
function eventosDaJornada(
  desde: string,
  selecoes: Linha[],
  itens: Linha[],
  visitas: Linha[],
  imovelDe: Map<unknown, unknown>,
  imovel: Map<unknown, Linha>,
  tarefas: Linha[],
  publico: (im: Linha | undefined) => { titulo: string | null; codigo: string; bairro: string | null } | null,
): EventoJornada[] {
  const eventos: EventoJornada[] = [{ tipo: 'inicio', quando: `${desde}T12:00:00.000Z`, texto: 'Começamos a busca' }];
  for (const s of selecoes) {
    const n = new Set(itens.filter((i) => i.selecao_id === s.id).map((i) => i.imovel_id)).size;
    const quando = iso(s.enviada_em);
    if (quando && n) eventos.push({ tipo: 'selecao', quando, texto: `Recebeu ${n} imóve${n > 1 ? 'is' : 'l'}: ${s.titulo}` });
  }
  for (const a of visitas) {
    const im = publico(imovel.get(imovelDe.get(a.id)));
    const quando = iso(a.quando);
    if (quando) eventos.push({ tipo: 'visita', quando, texto: `Visitou ${im ? (im.titulo ?? im.codigo) + (im.bairro ? `, ${im.bairro}` : '') : 'um imóvel'}` });
  }
  for (const t of tarefas) {
    const quando = iso(t.feita_em);
    if (quando) eventos.push({ tipo: 'tarefa', quando, texto: `Feito: ${t.texto}` });
  }
  // O começo fica sempre embaixo: marcado ao meio-dia do dia de início, ele passaria à frente do que
  // aconteceu de manhã nesse mesmo dia.
  const [inicio, ...resto] = eventos;
  return [...resto.sort((a, b) => b.quando.localeCompare(a.quando)).slice(0, 49), inicio];
}

/** Erro vindo do PostgreSQL: traz o SQLSTATE (5 caracteres) em `code`, como o `23505` do único. */
const ehErroDoBanco = (e: unknown) => /^[0-9A-Z]{5}$/.test(String((e as { code?: unknown })?.code ?? ''));

/**
 * Para rotas que mudam a agenda ou as seleções: o portal acompanha sem derrubar a rota. Na rota cada
 * comando é a sua própria transação, então a falha fica no log e o resto segue.
 *
 * `emTransacao` (o listener, dentro do `comConta`): erro do banco NÃO é engolido. O PostgreSQL aborta a
 * transação inteira no primeiro comando que falha, e o SDK não abre SAVEPOINT para a app
 * (banco-de-dados.md: "não dá para abrir um BEGIN aninhado"); engolido, o comando seguinte do listener
 * quebraria com outro erro ("transação abortada") e o bloco seria desfeito do mesmo jeito, só que com a
 * causa escondida. Então ele sobe, o `comConta` desfaz tudo e a causa real aparece. Erro que não é do
 * banco (não aborta a transação) continua só no log.
 */
export async function tentarPortal(
  dados: HelperDados,
  conta: number | undefined,
  contatoId: number | null | undefined,
  corretor?: Corretor,
  opcoes: { emTransacao?: boolean; fuso?: string } = {},
) {
  if (!conta || !contatoId) return;
  try {
    await sincronizarPortal(dados, conta, contatoId, corretor, opcoes.fuso);
  } catch (e) {
    if (opcoes.emTransacao && ehErroDoBanco(e)) throw e;
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
