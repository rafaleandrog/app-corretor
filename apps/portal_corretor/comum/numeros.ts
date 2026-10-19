// Números do corretor (bloco 4b, spec 11.2). Puro: recebe as linhas já lidas e devolve os KPIs.
// Coorte = negócios criados no período. "Chegou a uma etapa" usa o marco mais avançado que o
// negócio alcançou (`negocios.marco_max`), nunca o nome da etapa.
import { iso } from './funil';

/** Sequência dos marcos em cada funil: "chegou a X" = alcançou X ou algum marco depois dele. */
export const SEQUENCIA_MARCOS: Record<string, string[]> = {
  compra: ['novo', 'atendimento', 'qualificado', 'visita', 'visitou', 'proposta', 'documentacao'],
  venda_captacao: ['contato', 'avaliacao', 'autorizacao', 'anunciado', 'proposta'],
};

/** O marco mais avançado entre o atual e o novo, na sequência do funil. */
export function marcoMaisAvancado(pipeline: string, atual: string | null | undefined, novo: string | null | undefined): string | null {
  const seq = SEQUENCIA_MARCOS[pipeline] ?? [];
  const ia = atual ? seq.indexOf(atual) : -1;
  const ib = novo ? seq.indexOf(novo) : -1;
  if (ia < 0 && ib < 0) return atual ?? novo ?? null;
  return ib > ia ? novo! : atual!;
}

export interface NegocioNum {
  pipeline: string;
  criado_em: unknown;
  ganho_em: unknown;
  perdido_em: unknown;
  marco_max: string | null;
  motivo_perda: string | null;
  valor_estimado_c: number | null;
  comissao_pct: number | string | null;
  origem_canal?: string | null;
  /** Probabilidade da etapa atual (0–1) e se ela está em andamento. */
  probabilidade?: number | string | null;
  aberto?: boolean;
}

const dentro = (v: unknown, de: string, ate: string) => {
  const t = iso(v);
  return !!t && t >= de && t < ate;
};
const taxa = (a: number, b: number) => (b === 0 ? null : Math.round((a / b) * 1000) / 1000);

export function chegou(n: NegocioNum, marco: string): boolean {
  if (n.ganho_em) return true; // ganho passou por todas
  const seq = SEQUENCIA_MARCOS[n.pipeline] ?? [];
  const alvo = seq.indexOf(marco);
  const max = n.marco_max ? seq.indexOf(n.marco_max) : -1;
  return alvo >= 0 && max >= alvo;
}

export interface Kpis {
  leads: number;
  lead_atendimento: number | null;
  lead_visita: number | null;
  visita_proposta: number | null;
  proposta_ganho: number | null;
  conversao_total: number | null;
  ganhos: number;
  ciclo_medio_dias: number | null;
  vgv_c: number | null;
  captacoes: number;
  motivos_perda: { motivo: string; quantidade: number }[];
  por_origem: { canal: string; leads: number; ganhos: number }[];
}

/** KPIs de um período [de, ate) (spec 11.2). */
export function calcularKpis(negocios: NegocioNum[], de: string, ate: string): Kpis {
  const compra = negocios.filter((n) => n.pipeline === 'compra');
  const coorte = compra.filter((n) => dentro(n.criado_em, de, ate));
  const leads = coorte.length;
  const nAtend = coorte.filter((n) => chegou(n, 'atendimento')).length;
  const nVisitou = coorte.filter((n) => chegou(n, 'visitou')).length;
  const nProposta = coorte.filter((n) => chegou(n, 'proposta')).length;
  const ganhosCoorte = coorte.filter((n) => n.ganho_em).length;
  // Ganhos e perdas pelo momento em que aconteceram (não pela coorte).
  const ganhosPeriodo = compra.filter((n) => dentro(n.ganho_em, de, ate));
  const ciclos = ganhosPeriodo
    .map((n) => (new Date(iso(n.ganho_em)!).getTime() - new Date(iso(n.criado_em)!).getTime()) / 86400e3)
    .filter((d) => Number.isFinite(d) && d >= 0);
  const perdidos = compra.filter((n) => dentro(n.perdido_em, de, ate));
  const motivos = new Map<string, number>();
  for (const n of perdidos) motivos.set(n.motivo_perda ?? 'sem_motivo', (motivos.get(n.motivo_perda ?? 'sem_motivo') ?? 0) + 1);
  const origens = new Map<string, { leads: number; ganhos: number }>();
  for (const n of coorte) {
    const c = n.origem_canal ?? 'nao_informada';
    const o = origens.get(c) ?? { leads: 0, ganhos: 0 };
    o.leads++;
    if (n.ganho_em) o.ganhos++;
    origens.set(c, o);
  }
  const vendas = negocios.filter((n) => n.pipeline === 'venda_captacao' && dentro(n.criado_em, de, ate));
  return {
    leads,
    lead_atendimento: taxa(nAtend, leads),
    lead_visita: taxa(nVisitou, leads),
    visita_proposta: taxa(nProposta, nVisitou),
    proposta_ganho: taxa(ganhosCoorte, nProposta),
    conversao_total: taxa(ganhosCoorte, leads),
    ganhos: ganhosPeriodo.length,
    ciclo_medio_dias: ciclos.length ? Math.round((ciclos.reduce((a, b) => a + b, 0) / ciclos.length) * 10) / 10 : null,
    // VGV: só faz sentido havendo negócios; sem nenhum, `null` (spec 11.2).
    vgv_c: negocios.length ? ganhosPeriodo.reduce((s, n) => s + (n.valor_estimado_c ?? 0), 0) : null,
    captacoes: vendas.filter((n) => chegou(n, 'autorizacao')).length,
    motivos_perda: [...motivos].map(([motivo, quantidade]) => ({ motivo, quantidade })).sort((a, b) => b.quantidade - a.quantidade),
    por_origem: [...origens].map(([canal, o]) => ({ canal, ...o })).sort((a, b) => b.leads - a.leads),
  };
}

/**
 * Comissão prevista ponderada (6.12): Σ valor × comissão × probabilidade da etapa dos negócios em
 * andamento. Negócio sem valor ou sem comissão fica de fora e é contado à parte.
 */
export function previsaoPonderada(negocios: NegocioNum[]): { valor_c: number | null; sem_dados: number } {
  const abertos = negocios.filter((n) => n.aberto);
  if (!abertos.length) return { valor_c: null, sem_dados: 0 };
  let total = 0;
  let semDados = 0;
  for (const n of abertos) {
    const pct = n.comissao_pct === null || n.comissao_pct === undefined ? null : Number(n.comissao_pct);
    if (!n.valor_estimado_c || pct === null || Number.isNaN(pct)) {
      semDados++;
      continue;
    }
    total += n.valor_estimado_c * pct * Number(n.probabilidade ?? 0);
  }
  return { valor_c: Math.round(total), sem_dados: semDados };
}

/** Período [de, ate) terminando agora, e o anterior de mesmo tamanho, para comparar. */
export function periodos(dias: number, agora = new Date()) {
  const ate = agora.toISOString();
  const de = new Date(agora.getTime() - dias * 86400e3).toISOString();
  const deAnterior = new Date(agora.getTime() - 2 * dias * 86400e3).toISOString();
  return { atual: { de, ate }, anterior: { de: deAnterior, ate: de } };
}
