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
  /** Cliente do negócio: conta os clientes únicos da coorte. */
  contato_id?: number | null;
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

/** Quantos negócios da coorte chegaram a cada etapa do funil de compra (contagens, não taxas). */
export interface EtapasFunil {
  leads: number;
  atendimento: number;
  visitou: number;
  proposta: number;
  ganhos: number;
}

/** Leads de um canal e a situação deles hoje: ganhos, em andamento ou perdidos. */
export interface Origem {
  canal: string;
  leads: number;
  /** Dos leads do canal, quantos chegaram a "Visitou" ou além (as "Melhores origens" de P10). */
  visitaram: number;
  ganhos: number;
  abertos: number;
  perdidos: number;
}

export interface Kpis {
  leads: number;
  clientes_unicos: number;
  etapas: EtapasFunil;
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
  por_origem: Origem[];
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
  const origens = new Map<string, Origem>();
  for (const n of coorte) {
    const c = n.origem_canal ?? 'nao_informada';
    const o = origens.get(c) ?? { canal: c, leads: 0, visitaram: 0, ganhos: 0, abertos: 0, perdidos: 0 };
    o.leads++;
    if (chegou(n, 'visitou')) o.visitaram++;
    if (n.ganho_em) o.ganhos++;
    else if (n.perdido_em) o.perdidos++;
    else o.abertos++;
    origens.set(c, o);
  }
  const clientes = new Set(coorte.map((n, i) => n.contato_id ?? `sem-${i}`));
  const vendas = negocios.filter((n) => n.pipeline === 'venda_captacao' && dentro(n.criado_em, de, ate));
  return {
    leads,
    clientes_unicos: clientes.size,
    etapas: { leads, atendimento: nAtend, visitou: nVisitou, proposta: nProposta, ganhos: ganhosCoorte },
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
    por_origem: [...origens.values()].sort((a, b) => b.leads - a.leads),
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

/** Quantos intervalos cada período mostra no gráfico de leads: dia a dia até 30 dias, semana e mês acima. */
const INTERVALOS: Record<number, number> = { 7: 7, 30: 30, 90: 13, 365: 12 };

/**
 * Leads (negócios de compra criados) por intervalo do período e do anterior, alinhados pela posição:
 * o 1º intervalo do atual se compara ao 1º do anterior. O rótulo é o início de cada intervalo do atual.
 */
export function serieDeLeads(negocios: NegocioNum[], dias: number, agora = new Date()) {
  const n = INTERVALOS[dias] ?? Math.min(dias, 30);
  const passo = (dias * 86400e3) / n;
  const fim = agora.getTime();
  const inicio = fim - dias * 86400e3;
  const atual = new Array<number>(n).fill(0);
  const anterior = new Array<number>(n).fill(0);
  for (const neg of negocios) {
    if (neg.pipeline !== 'compra') continue;
    const t = iso(neg.criado_em);
    if (!t) continue;
    const ms = new Date(t).getTime();
    if (ms >= inicio && ms < fim) atual[Math.min(n - 1, Math.floor((ms - inicio) / passo))]++;
    else if (ms >= inicio - dias * 86400e3 && ms < inicio) anterior[Math.min(n - 1, Math.floor((ms - inicio + dias * 86400e3) / passo))]++;
  }
  const rotulo = (d: Date) =>
    dias >= 365
      ? d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit', timeZone: 'America/Sao_Paulo' }).replace(' de ', '/').replace('.', '')
      : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' });
  const categorias = atual.map((_, i) => rotulo(new Date(inicio + i * passo)));
  return { categorias, atual, anterior };
}

/**
 * Horário comercial usado em "Contatos por horário" (P10): das 8h às 19h, no fuso da conta. O app ainda
 * não tem horário de atendimento configurável (Ajustes › Horário de atendimento guarda só prazos):
 * quando tiver, este padrão dá lugar ao do corretor.
 */
export const HORARIO_COMERCIAL = { inicio: 8, fim: 19 } as const;
export const foraDoHorario = (hora: number) => hora < HORARIO_COMERCIAL.inicio || hora >= HORARIO_COMERCIAL.fim;

/** Hora (0–23) de um instante no fuso dado; fuso inválido cai no de Brasília. */
export function horaNoFuso(instante: string, fuso?: string | null): number {
  const d = new Date(instante);
  const ler = (tz: string) => Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: tz }).format(d));
  try {
    return ler(fuso || 'America/Sao_Paulo');
  } catch {
    return ler('America/Sao_Paulo');
  }
}

/** Leads (negócios de compra criados em [de, ate)) por hora do dia, e quantos chegaram fora do horário comercial. */
export function leadsPorHora(negocios: NegocioNum[], de: string, ate: string, fuso?: string | null) {
  const horas = new Array<number>(24).fill(0);
  for (const n of negocios) {
    if (n.pipeline !== 'compra' || !dentro(n.criado_em, de, ate)) continue;
    horas[horaNoFuso(iso(n.criado_em)!, fuso)]++;
  }
  const fora = horas.reduce((s, v, h) => s + (foraDoHorario(h) ? v : 0), 0);
  return { horas, fora, inicio: HORARIO_COMERCIAL.inicio, fim: HORARIO_COMERCIAL.fim };
}

/** "Melhores origens" (P10): os canais cujos leads mais chegaram à visita; empate, mais leads. */
export function melhoresOrigens(origens: Origem[], quantas = 4): Origem[] {
  return [...origens].filter((o) => o.leads > 0).sort((a, b) => b.visitaram - a.visitaram || b.leads - a.leads).slice(0, quantas);
}

export interface Melhoria {
  /** A leitura, em uma ou duas frases, só com números do período. */
  texto: string;
  /** O maior motivo de perda do período, que vira o filtro de "Ver os N clientes". */
  motivo: string | null;
  /** Clientes distintos perdidos por esse motivo no período (o N do botão). */
  clientes: number;
}

const pctTexto = (v: number) => `${Math.round(v * 100)}%`;

/**
 * "O que melhorar" (P10): leitura feita pelo código a partir dos números do período, sem IA (o mapa
 * 11.8 não dá slot ao P10, e uma leitura calculada nunca inventa número). Aponta o passo do funil que
 * mais perde e o motivo de perda mais comum, com os clientes perdidos por ele.
 */
export function oQueMelhorar(negocios: NegocioNum[], k: Kpis, de: string, ate: string, rotuloMotivo: (m: string) => string = (m) => m): Melhoria {
  if (!k.leads) {
    return { texto: 'Nenhum lead no período. Quando os contatos chegarem, a leitura mostra onde eles param no funil.', motivo: null, clientes: 0 };
  }
  const passos: [string, number | null][] = [
    ['dos contatos chegam à visita', k.lead_visita],
    ['das visitas viram proposta', k.visita_proposta],
    ['das propostas viram venda', k.proposta_ganho],
  ];
  const medidos = passos.filter((p): p is [string, number] => p[1] !== null);
  const frases: string[] = [];
  if (medidos.length) {
    const pior = medidos.reduce((a, b) => (b[1] < a[1] ? b : a));
    const melhor = medidos.reduce((a, b) => (b[1] > a[1] ? b : a));
    frases.push(
      melhor === pior
        ? `Só ${pctTexto(pior[1])} ${pior[0]}.`
        : `${pctTexto(melhor[1])} ${melhor[0]}, mas só ${pctTexto(pior[1])} ${pior[0]}: é aí que mais se perde.`,
    );
  }
  const motivo = k.motivos_perda.find((m) => m.motivo !== 'sem_motivo')?.motivo ?? null;
  let clientes = 0;
  if (motivo) {
    // N conta só negócio com cliente: é a mesma regra da lista que [Ver os N clientes] abre.
    const ids = new Set(
      negocios.filter((n) => n.pipeline === 'compra' && n.motivo_perda === motivo && dentro(n.perdido_em, de, ate) && n.contato_id).map((n) => n.contato_id),
    );
    clientes = ids.size;
    const qtd = k.motivos_perda.find((m) => m.motivo === motivo)!.quantidade;
    // "Informado": as perdas sem motivo ficam fora da escolha e podem ser mais numerosas.
    frases.push(`O motivo de perda informado mais comum foi "${rotuloMotivo(motivo)}" (${qtd} ${qtd === 1 ? 'negócio' : 'negócios'}): vale retomar esses clientes.`);
  }
  if (!frases.length) frases.push('Ainda há poucos dados no período para apontar onde se perde mais.');
  return { texto: frases.join(' '), motivo, clientes };
}

/** Resposta de `GET /numeros` no que o CSV usa. */
export interface RespostaNumeros {
  dias: number;
  origem: string | null;
  periodo: { de: string; ate: string };
  atual: Kpis & { visitas: number | null };
  anterior: Kpis & { visitas: number | null };
  previsao: { valor_c: number | null; sem_dados: number };
  por_hora: { horas: number[]; fora: number };
  conteudo?: { publicadas: number; publicadas_anterior: number };
}

/**
 * [Exportar CSV] de Números (P10): uma linha por indicador, com o período e o anterior, mais as
 * origens, os motivos de perda e os leads por hora. Só agregados da conta, nunca dado de cliente.
 */
export function linhasCsvNumeros(r: RespostaNumeros, rotuloCanal: (c: string) => string, rotuloMotivo: (m: string) => string): { cabecalho: string[]; linhas: unknown[][] } {
  const a = r.atual;
  const b = r.anterior;
  const taxa = (v: number | null) => (v === null ? '' : `${(Math.round(v * 1000) / 10).toString().replace('.', ',')}%`);
  const reais = (c: number | null) => (c === null ? '' : (c / 100).toFixed(2).replace('.', ','));
  const linhas: unknown[][] = [
    ['Período', `Últimos ${r.dias} dias`, `${r.dias} dias anteriores`],
    ['Origem', r.origem ? rotuloCanal(r.origem) : 'Todas', ''],
    ['Leads', a.leads, b.leads],
    ['Clientes únicos', a.clientes_unicos, b.clientes_unicos],
    ['Chegaram a Em atendimento', a.etapas.atendimento, b.etapas.atendimento],
    ['Chegaram a Visitou', a.etapas.visitou, b.etapas.visitou],
    ['Chegaram a Proposta', a.etapas.proposta, b.etapas.proposta],
    ['Ganhos da turma', a.etapas.ganhos, b.etapas.ganhos],
    ['Lead → atendimento', taxa(a.lead_atendimento), taxa(b.lead_atendimento)],
    ['Lead → visita', taxa(a.lead_visita), taxa(b.lead_visita)],
    ['Visita → proposta', taxa(a.visita_proposta), taxa(b.visita_proposta)],
    ['Proposta → ganho', taxa(a.proposta_ganho), taxa(b.proposta_ganho)],
    ['Conversão total', taxa(a.conversao_total), taxa(b.conversao_total)],
    ['Vendas no período', a.ganhos, b.ganhos],
    ['VGV (R$)', reais(a.vgv_c), reais(b.vgv_c)],
    ['Ciclo médio (dias)', a.ciclo_medio_dias ?? '', b.ciclo_medio_dias ?? ''],
    ['Visitas feitas', a.visitas ?? '', b.visitas ?? ''],
    ['Captações', a.captacoes, b.captacoes],
    ['Comissão prevista hoje (R$)', reais(r.previsao.valor_c), ''],
    ['Leads fora do horário comercial', r.por_hora.fora, ''],
  ];
  if (r.conteudo) linhas.push(['Peças publicadas', r.conteudo.publicadas, r.conteudo.publicadas_anterior]);
  for (const o of a.por_origem) linhas.push([`Leads de ${rotuloCanal(o.canal)}`, o.leads, b.por_origem.find((x) => x.canal === o.canal)?.leads ?? 0]);
  for (const m of a.motivos_perda) linhas.push([`Perdidos por ${rotuloMotivo(m.motivo)}`, m.quantidade, b.motivos_perda.find((x) => x.motivo === m.motivo)?.quantidade ?? 0]);
  r.por_hora.horas.forEach((n, h) => linhas.push([`Leads das ${h}h`, n, '']));
  return { cabecalho: ['Indicador', 'Este período', 'Período anterior'], linhas };
}
