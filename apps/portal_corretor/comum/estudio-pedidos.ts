import { ROTULO_OBJETIVO, type Formato, type Objetivo } from './estudio';

// Estúdio no Padrão B (spec 11.1 P08, D-105; item B6 do arco #87): a lógica da tela que não depende
// do navegador, para os testes a travarem sem DOM. O comportamento das peças é o de D-89 a D-91: a arte
// é feita fora do app (Canva IA ou outra ferramenta) e enviada na peça; sem aprovação por janela (D-86),
// sem preenchimento automático do Canva e sem créditos (D-87).

/** O que a tela usa de uma peça (o resto passa direto). */
export interface PecaTela {
  id: number;
  pedido?: string | null;
  imovel_id?: number | null;
  objetivo: string;
  formato: string;
  estado: string;
  criado_em: string;
  aprovada_em?: string | null;
  agendada_para?: string | null;
  publicada_em?: string | null;
  permalink?: string | null;
  arquivos?: unknown[];
  [k: string]: unknown;
}

/**
 * Um pedido ao Estúdio: as peças que saíram de um mesmo envio (um `POST /estudio/pedido` ou
 * `/estudio/pacote` cria uma peça por formato, em sequência). O banco não guarda o envio; a tela o
 * reconstrói pelas peças (D-B6-1, no PR): mesmo texto de pedido, mesmo imóvel, mesmo objetivo, cada
 * peça criada em até `JANELA_PEDIDO_MS` da ANTERIOR do pedido (o pacote cria as peças em série, uma
 * chamada de IA cada: com IA lenta o pacote inteiro passa de 2 min e continua um pedido só) e em ids
 * seguidos: uma peça de outro envio no meio fecha o pedido (`agruparPedidos` só estende o último). O id
 * do pedido é o da primeira peça.
 */
export interface Pedido<P extends PecaTela = PecaTela> {
  id: number;
  texto: string | null;
  imovel_id: number | null;
  objetivo: string;
  criado_em: string;
  /** Em ordem de criação (a primeira é a de menor id). */
  pecas: P[];
}

export const JANELA_PEDIDO_MS = 2 * 60e3;

const mesmoEnvio = (a: PecaTela, b: PecaTela) =>
  (a.pedido ?? null) === (b.pedido ?? null) &&
  (a.imovel_id ?? null) === (b.imovel_id ?? null) &&
  a.objetivo === b.objetivo &&
  Math.abs(new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime()) <= JANELA_PEDIDO_MS;

/** As peças agrupadas por pedido, o mais recente primeiro. */
export function agruparPedidos<P extends PecaTela>(pecas: P[]): Pedido<P>[] {
  const ordem = [...pecas].sort((a, b) => a.id - b.id);
  const pedidos: Pedido<P>[] = [];
  let atual: Pedido<P> | null = null;
  for (const p of ordem) {
    // Só o último pedido aberto recebe a peça (ids seguidos), e a janela conta da peça anterior dele.
    if (atual && mesmoEnvio(atual.pecas[atual.pecas.length - 1], p)) atual.pecas.push(p);
    else {
      atual = { id: p.id, texto: p.pedido ?? null, imovel_id: p.imovel_id ?? null, objetivo: p.objetivo, criado_em: p.criado_em, pecas: [p] };
      pedidos.push(atual);
    }
  }
  return pedidos.reverse();
}

/** Escolha da URL: `?item=` (uma peça) vale mais que `?pedido=`; nada escolhido, `null`. */
export function pedidoEscolhido<P extends PecaTela>(pedidos: Pedido<P>[], q: { pedido?: string | null; item?: string | null }): { pedido: Pedido<P> | null; peca: number | null; naoEncontrado: boolean } {
  const item = Number(q.item) || null;
  if (item) {
    const pedido = pedidos.find((x) => x.pecas.some((p) => p.id === item)) ?? null;
    return { pedido, peca: pedido ? item : null, naoEncontrado: !pedido };
  }
  const id = Number(q.pedido) || null;
  if (!id) return { pedido: null, peca: null, naoEncontrado: false };
  const pedido = pedidos.find((x) => x.id === id) ?? null;
  return { pedido, peca: null, naoEncontrado: !pedido };
}

// ---------- Etapas (D-90) ----------

export const TRAVADA = ['agendada', 'publicando', 'publicada'];
export const semArte = (p: PecaTela) => !(p.arquivos ?? []).length;
/** Pode ir para "Aprovar": rascunho, de volta a rascunho, ou erro sem aprovação (sobra de versões antigas). */
export const aprovavel = (p: PecaTela) => p.estado === 'rascunho' || p.estado === 'rejeitada' || (p.estado === 'erro' && !p.aprovada_em);

/** Listas por etapa (D-90): cada peça cai na etapa em que está; peça com erro de publicação fica em "Prontas". */
export const ETAPAS: { id: string; rotulo: string; cor: string; casa: (p: PecaTela) => boolean }[] = [
  { id: 'todas', rotulo: 'Todas', cor: 'info', casa: () => true },
  { id: 'arte', rotulo: 'Falta a arte', cor: 'alerta', casa: (p) => semArte(p) && !TRAVADA.includes(p.estado) },
  { id: 'aprovar', rotulo: 'Para aprovar', cor: 'info', casa: (p) => !semArte(p) && aprovavel(p) },
  { id: 'prontas', rotulo: 'Prontas para publicar', cor: 'sucesso', casa: (p) => p.estado === 'aprovada' || (p.estado === 'erro' && !!p.aprovada_em) },
  { id: 'agendadas', rotulo: 'Agendadas', cor: 'info', casa: (p) => p.estado === 'agendada' || p.estado === 'publicando' },
  { id: 'publicadas', rotulo: 'Publicadas', cor: 'sucesso', casa: (p) => p.estado === 'publicada' },
];

export const etapaValida = (id: string | null | undefined) => ETAPAS.find((e) => e.id === id) ?? ETAPAS[0];

/** Pedidos com ao menos uma peça na etapa. */
export const pedidosNaEtapa = <P extends PecaTela>(pedidos: Pedido<P>[], etapa: string) => {
  const e = etapaValida(etapa);
  return pedidos.filter((x) => x.pecas.some(e.casa));
};

// ---------- Uma ação principal por estado (D-86, spec 2.6 princípio 14) ----------

export type AcaoPrincipal = 'enviar_arte' | 'aprovar' | 'publicar' | 'tentar_de_novo' | 'cancelar_agendamento' | 'destravar' | 'ver_no_instagram' | 'copiar_legenda';

/**
 * A ÚNICA ação principal da peça, pelo estado (spec 11.1 P08): falta a arte → Enviar a arte; rascunho →
 * Aprovar; aprovada → Publicar (agora, agendar ou baixar); erro → Tentar de novo. O resto vai para o "Mais".
 */
export function acaoPrincipal(p: PecaTela): AcaoPrincipal {
  const travada = TRAVADA.includes(p.estado);
  if (semArte(p) && !travada) return 'enviar_arte';
  if (aprovavel(p)) return 'aprovar';
  if (p.estado === 'aprovada') return 'publicar';
  if (p.estado === 'erro') return 'tentar_de_novo';
  if (p.estado === 'agendada') return 'cancelar_agendamento';
  if (p.estado === 'publicando') return 'destravar';
  if (p.permalink) return 'ver_no_instagram';
  return 'copiar_legenda'; // publicada por fora sem link
}

/** O próximo passo escrito na peça (D-90). */
export function proximoPasso(p: PecaTela, ferramenta = 'Canva IA'): string | null {
  switch (acaoPrincipal(p)) {
    case 'enviar_arte':
      return `Próximo passo: copie a descrição, gere a arte no ${ferramenta} e envie aqui.`;
    case 'aprovar':
      return 'Próximo passo: confira a arte e aprove.';
    case 'publicar':
      return 'Próximo passo: publique agora, agende ou baixe para publicar você.';
    case 'tentar_de_novo':
      return 'Próximo passo: resolva o motivo e tente de novo.';
    default:
      return null;
  }
}

// ---------- Criar rápido (2×2) ----------

/**
 * Os quatro atalhos do "Criar rápido" (mockup P08), todos de um imóvel. Lançamento é o Pacote de
 * lançamento (`/estudio/pacote`: post, carrossel e story); os outros são um pedido (`/estudio/pedido`)
 * com o objetivo e os formatos já escolhidos.
 */
export const CRIAR_RAPIDO: { id: string; rotulo: string; icone: string; objetivo: Objetivo; formatos: Formato[] | null; resumo: string }[] = [
  { id: 'lancamento', rotulo: 'Lançamento', icone: 'fa-solid fa-box-open', objetivo: 'novo_imovel', formatos: null, resumo: 'post, carrossel e story' },
  { id: 'baixou_preco', rotulo: 'Baixou o preço', icone: 'fa-solid fa-tag', objetivo: 'baixou_preco', formatos: ['post_1x1', 'story'], resumo: 'post e story' },
  { id: 'vendido', rotulo: 'Vendido', icone: 'fa-solid fa-handshake', objetivo: 'vendido', formatos: ['post_1x1'], resumo: 'post' },
  { id: 'visita_aberta', rotulo: 'Visita aberta', icone: 'fa-solid fa-door-open', objetivo: 'visita_aberta', formatos: ['story'], resumo: 'story' },
];

// ---------- Esta semana ----------

const DIA = 86400e3;

/** Coluna da direita: as agendadas dos próximos 7 dias e as publicadas dos últimos 7, por data. */
export function estaSemana<P extends PecaTela>(pecas: P[], agora = Date.now()): { agendadas: P[]; publicadas: P[] } {
  const t = (s: string | null | undefined) => (s ? new Date(s).getTime() : NaN);
  const agendadas = pecas
    .filter((p) => (p.estado === 'agendada' || p.estado === 'publicando') && t(p.agendada_para) >= agora - DIA && t(p.agendada_para) <= agora + 7 * DIA)
    .sort((a, b) => t(a.agendada_para) - t(b.agendada_para));
  const publicadas = pecas
    .filter((p) => p.estado === 'publicada' && t(p.publicada_em) >= agora - 7 * DIA && t(p.publicada_em) <= agora + DIA)
    .sort((a, b) => t(b.publicada_em) - t(a.publicada_em));
  return { agendadas, publicadas };
}

/** Título do pedido na lista: o objetivo e o imóvel, ou o começo do texto pedido. */
export function tituloPedido(x: Pedido, codigoImovel?: string | null): string {
  const objetivo = ROTULO_OBJETIVO[x.objetivo as Objetivo] ?? x.objetivo;
  if (codigoImovel) return `${objetivo} · ${codigoImovel}`;
  const t = (x.texto ?? '').trim();
  return t ? (t.length > 60 ? `${t.slice(0, 57)}…` : t) : objetivo;
}

/** "3 peças · 1 agendada": o resumo do pedido na lista. */
export function resumoPedido(x: Pedido): string {
  const n = x.pecas.length;
  const partes = [`${n} ${n === 1 ? 'peça' : 'peças'}`];
  const contar = (casa: (p: PecaTela) => boolean, s: string, pl: string) => {
    const k = x.pecas.filter(casa).length;
    if (k) partes.push(`${k} ${k === 1 ? s : pl}`);
  };
  contar(ETAPAS[1].casa, 'sem arte', 'sem arte');
  contar(ETAPAS[2].casa, 'para aprovar', 'para aprovar');
  contar(ETAPAS[3].casa, 'pronta', 'prontas');
  contar(ETAPAS[4].casa, 'agendada', 'agendadas');
  contar(ETAPAS[5].casa, 'publicada', 'publicadas');
  return partes.join(' · ');
}
