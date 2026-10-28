// Portal do Cliente no formato dos mockups M4 e M5 (bloco B9, spec 11.3): abas, próximo passo,
// imóvel em destaque e estado do link. Puro: recebe o portal já lido da vitrine (só dado público)
// e devolve o que a página pública desenha.

type Linha = Record<string, any>;

export type AbaPortal = 'conversa' | 'imoveis' | 'agenda' | 'arquivos';

export interface Aba {
  id: AbaPortal;
  rotulo: string;
  /** Quantidade ao lado do rótulo; `null` não mostra número. */
  n: number | null;
}

/** Imóveis do portal sem repetição: o mesmo imóvel em duas seleções aparece uma vez (a mais recente). */
export function imoveisDoPortal(selecoes: Linha[]): { imovel: Linha; selecao: Linha }[] {
  const vistos = new Set<string>();
  const lista: { imovel: Linha; selecao: Linha }[] = [];
  for (const s of selecoes) {
    for (const i of s.itens ?? []) {
      if (vistos.has(i.codigo)) continue;
      vistos.add(i.codigo);
      lista.push({ imovel: i, selecao: s });
    }
  }
  return lista;
}

/** Visitas ainda por acontecer (até 1 h atrás, para a visita em andamento não sumir). */
export function visitasFuturas(agenda: Linha[], agora = Date.now()): Linha[] {
  return agenda.filter((v) => v.quando && Date.parse(v.quando) >= agora - 3600e3);
}

/**
 * Conversa · Imóveis n · Agenda n · Arquivos n. Propostas fica para o D5. Arquivos ainda não têm
 * fonte no app (D-73): a aba existe, com zero, e explica onde os documentos chegam.
 */
export function abasDoPortal(p: Linha, agora = Date.now()): Aba[] {
  return [
    { id: 'conversa', rotulo: 'Conversa', n: null },
    { id: 'imoveis', rotulo: 'Imóveis', n: imoveisDoPortal(p.selecoes ?? []).length },
    { id: 'agenda', rotulo: 'Agenda', n: visitasFuturas(p.agenda ?? [], agora).length },
    { id: 'arquivos', rotulo: 'Arquivos', n: 0 },
  ];
}

/** [Ver] do próximo passo: a agenda quando há visita marcada; senão, os imóveis. */
export function destinoDoProximoPasso(p: Linha, agora = Date.now()): AbaPortal {
  return visitasFuturas(p.agenda ?? [], agora).length ? 'agenda' : 'imoveis';
}

/** Aba pedida no endereço (`#imoveis`); desconhecida volta para a Conversa. */
export function abaDoEndereco(hash: string): AbaPortal {
  const a = hash.replace(/^#/, '');
  return a === 'imoveis' || a === 'agenda' || a === 'arquivos' ? a : 'conversa';
}

/** Chip "Visita sáb." do imóvel em destaque: a próxima visita marcada a ele, se houver. */
export function chipDeVisita(codigo: string, agenda: Linha[], agora = Date.now(), fuso?: string): string | null {
  const v = visitasFuturas(agenda, agora)
    .filter((x) => x.imovel?.codigo === codigo)
    .sort((a, b) => Date.parse(a.quando) - Date.parse(b.quando))[0];
  if (!v) return null;
  const d = new Date(v.quando);
  const semana = d.toLocaleDateString('pt-BR', { weekday: 'short', ...(fuso ? { timeZone: fuso } : {}) });
  return `Visita ${semana}`;
}

export const ROTULO_REACAO_CLIENTE: Record<string, string> = {
  gostei: 'Gostei',
  nao_gostei: 'Não gostei',
  quero_visitar: 'Quero visitar',
};

/** Reação dada, como aparece na lista "outros imóveis". */
export const reacaoDada = (r: string | null | undefined) => (r && ROTULO_REACAO_CLIENTE[r]) || 'Sem reação';

/** Iniciais do corretor para a capa sem foto ("Rafael Gualberto" → "RG"). */
export function iniciais(nome: string | null | undefined): string {
  const partes = String(nome ?? '').trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return '';
  return (partes.length > 1 ? partes[0][0] + partes[partes.length - 1][0] : partes[0].slice(0, 2)).toUpperCase();
}

/**
 * Estado da página quando a leitura falha: token revogado, vencido ou trocado responde 404 e vira
 * "link expirado"; o resto (rede, servidor) pede outra tentativa.
 */
export function estadoDoErro(e: unknown): 'expirado' | 'falha' {
  const x = e as { status?: number; codigo?: string } | null;
  return x?.status === 404 || x?.codigo === 'NAO_ENCONTRADO' ? 'expirado' : 'falha';
}
