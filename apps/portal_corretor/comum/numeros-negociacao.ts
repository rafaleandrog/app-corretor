// Relatório Negociação de Números (D6, spec 11.1 P10 e 11.2, "KPIs de negociação"). Puro: recebe as
// linhas já lidas e devolve só agregados da conta. Nenhum valor do mandato (recuo, alvo, BATNA) nem a
// estimativa do comprador sai daqui: eles entram só na comparação de "dentro da ZOPA", que vira uma
// contagem. Nada por negociação é devolvido.
import { iso } from './funil';
import { PLAYBOOK_OBJECOES_PADRAO } from './negociacao';

/** Negociação no formato do cálculo. `preco_pedido_c` e `recuo_c` vêm do mandato vigente. */
export interface NegociacaoNum {
  estado: string;
  encerrada_em: unknown;
  valor_final_c: number | null;
  rodadas: number | null;
  teto_estimado_comprador_c: number | null;
  preco_pedido_c: number | null;
  recuo_c: number | null;
}

export interface PropostaNum {
  direcao: string;
  criado_em: unknown;
}

export interface ObjecaoNum {
  categoria: string;
  em: unknown;
}

export interface ExecucaoNum {
  decisao: string;
  aprovada_sem_edicao: boolean | null;
  decidida_em: unknown;
}

export interface KpisNegociacao {
  /** 1. Propostas do comprador registradas no período. */
  propostas_recebidas: number;
  /** Negociações encerradas no período (ganhas + perdidas) e quantas foram ganhas. */
  encerradas: number;
  ganhas: number;
  /** 2. Ganhas / encerradas; `null` sem encerradas. */
  taxa_acordo: number | null;
  /** 3. Média de (pedido − final) / pedido nas ganhas com preço pedido; `null` sem nenhuma. */
  desconto_medio: number | null;
  /** 4. Média de rodadas das ganhas; `null` sem ganhas. */
  rodadas_medias: number | null;
  /** 5. Ganhas com valor final entre o recuo e o teto estimado / ganhas com os dois; `null` sem nenhuma. */
  dentro_zopa: number | null;
  /** Ganhas que não entram na conta da ZOPA (sem teto estimado ou sem mandato). */
  zopa_sem_estimativa: number;
  /** 6. Objeções detectadas no período, por categoria, da mais frequente para a menos. */
  objecoes: { categoria: string; quantidade: number }[];
  /** 7. Sugestões enviadas (aprovadas ou editadas) decididas no período e quantas sem edição. */
  sugestoes_enviadas: number;
  sugestoes_sem_edicao: number;
  taxa_sem_edicao: number | null;
}

const dentro = (v: unknown, de: string, ate: string) => {
  const t = iso(v);
  return !!t && t >= de && t < ate;
};
const taxa = (a: number, b: number) => (b === 0 ? null : Math.round((a / b) * 1000) / 1000);
const media = (xs: number[], casas: number) => {
  if (!xs.length) return null;
  const f = 10 ** casas;
  return Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * f) / f;
};
const num = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null);

/** Decisões que mandaram a sugestão ao cliente: o denominador de "aprovadas sem edição". */
export const DECISOES_ENVIADAS = ['aprovada', 'editada'] as const;

/** Os 7 KPIs de negociação num período [de, ate) (spec 11.2). */
export function calcularKpisNegociacao(
  entrada: { negociacoes: NegociacaoNum[]; propostas: PropostaNum[]; objecoes: ObjecaoNum[]; execucoes: ExecucaoNum[] },
  de: string,
  ate: string,
): KpisNegociacao {
  const propostas = entrada.propostas.filter((p) => p.direcao === 'comprador' && dentro(p.criado_em, de, ate)).length;
  const encerradas = entrada.negociacoes.filter((n) => (n.estado === 'ganha' || n.estado === 'perdida') && dentro(n.encerrada_em, de, ate));
  const ganhas = encerradas.filter((n) => n.estado === 'ganha');

  const descontos: number[] = [];
  for (const n of ganhas) {
    const pedido = num(n.preco_pedido_c);
    const final = num(n.valor_final_c);
    if (pedido && pedido > 0 && final !== null) descontos.push((pedido - final) / pedido);
  }

  let naZopa = 0;
  let comEstimativa = 0;
  for (const n of ganhas) {
    const recuo = num(n.recuo_c);
    const teto = num(n.teto_estimado_comprador_c);
    const final = num(n.valor_final_c);
    if (recuo === null || teto === null || final === null) continue;
    comEstimativa++;
    if (final >= recuo && final <= teto) naZopa++;
  }

  const porCategoria = new Map<string, number>();
  for (const o of entrada.objecoes) {
    if (!dentro(o.em, de, ate)) continue;
    porCategoria.set(o.categoria, (porCategoria.get(o.categoria) ?? 0) + 1);
  }

  const enviadas = entrada.execucoes.filter((e) => (DECISOES_ENVIADAS as readonly string[]).includes(e.decisao) && dentro(e.decidida_em, de, ate));
  const semEdicao = enviadas.filter((e) => e.aprovada_sem_edicao === true).length;

  return {
    propostas_recebidas: propostas,
    encerradas: encerradas.length,
    ganhas: ganhas.length,
    taxa_acordo: taxa(ganhas.length, encerradas.length),
    desconto_medio: media(descontos, 3),
    rodadas_medias: media(ganhas.map((n) => num(n.rodadas) ?? 0), 1),
    dentro_zopa: taxa(naZopa, comEstimativa),
    zopa_sem_estimativa: ganhas.length - comEstimativa,
    objecoes: [...porCategoria]
      .map(([categoria, quantidade]) => ({ categoria, quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade || a.categoria.localeCompare(b.categoria)),
    sugestoes_enviadas: enviadas.length,
    sugestoes_sem_edicao: semEdicao,
    taxa_sem_edicao: taxa(semEdicao, enviadas.length),
  };
}

/** Rótulo de cada categoria de objeção: o título do Apêndice D (o mesmo do playbook padrão). */
export function rotuloObjecao(categoria: string): string {
  if (categoria === 'outra') return 'Outra';
  return PLAYBOOK_OBJECOES_PADRAO.find((o) => o.categoria === categoria)?.titulo ?? categoria;
}
