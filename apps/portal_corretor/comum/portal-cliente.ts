import { CENTAVOS_MAXIMO } from './crm';
// Portal do Cliente no formato dos mockups M4 e M5 (bloco B9, spec 11.3): abas, próximo passo,
// imóvel em destaque e estado do link. Puro: recebe o portal já lido da vitrine (só dado público)
// e devolve o que a página pública desenha.

type Linha = Record<string, any>;

export type AbaPortal = 'conversa' | 'imoveis' | 'agenda' | 'propostas' | 'arquivos';

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

/** Uma seleção como o cliente a lê: o título e a mensagem que o corretor escreveu, e quantos imóveis ela traz. */
export interface RecadoDeSelecao {
  titulo: string;
  mensagem: string | null;
  imoveis: number;
}

/** Todas as seleções válidas, na ordem recebida, sem perder nenhuma (mesmo a que só repete imóveis de outra). */
export function recadosDasSelecoes(selecoes: Linha[]): RecadoDeSelecao[] {
  return selecoes
    .filter((s) => s.titulo || s.mensagem)
    .map((s) => ({ titulo: String(s.titulo ?? ''), mensagem: s.mensagem ? String(s.mensagem) : null, imoveis: (s.itens ?? []).length }));
}

/** Visitas ainda por acontecer (até 1 h atrás, para a visita em andamento não sumir). */
export function visitasFuturas(agenda: Linha[], agora = Date.now()): Linha[] {
  return agenda.filter((v) => v.quando && Date.parse(v.quando) >= agora - 3600e3);
}

/** Próxima visita: a mais cedo entre as que ainda vão acontecer (mesmo critério de `visitasFuturas`). */
export function proximaVisita(agenda: Linha[], agora = Date.now()): string | null {
  const q = visitasFuturas(agenda, agora).map((v) => String(v.quando)).sort((a, b) => Date.parse(a) - Date.parse(b));
  return q[0] ?? null;
}

/**
 * Conversa · Imóveis n · Agenda n · Propostas n (M4, #191): no máximo quatro abas, para caberem em 390 px.
 * Cada número conta os itens da aba: imóveis, visitas por vir e negociações (não só as que esperam o
 * cliente, que fariam "Propostas 0" com uma negociação aberta). Propostas só aparece com negociação; sem
 * ela, a quarta aba é Arquivos, que ainda não tem fonte no app (D-73) e explica onde os documentos chegam.
 */
export function abasDoPortal(p: Linha, agora = Date.now()): Aba[] {
  const negociacoes: NegociacaoPublica[] = p.negociacoes ?? [];
  return [
    { id: 'conversa', rotulo: 'Conversa', n: null },
    { id: 'imoveis', rotulo: 'Imóveis', n: imoveisDoPortal(p.selecoes ?? []).length },
    { id: 'agenda', rotulo: 'Agenda', n: visitasFuturas(p.agenda ?? [], agora).length },
    negociacoes.length ? { id: 'propostas' as const, rotulo: 'Propostas', n: negociacoes.length } : { id: 'arquivos' as const, rotulo: 'Arquivos', n: 0 },
  ];
}

/** [Ver] do próximo passo: a agenda quando há visita marcada; senão, os imóveis. */
export function destinoDoProximoPasso(p: Linha, agora = Date.now()): AbaPortal {
  return visitasFuturas(p.agenda ?? [], agora).length ? 'agenda' : 'imoveis';
}

/**
 * Faixa "Próximo passo · Ver" (M4, #191), na ordem: o texto que o corretor escreveu para o cliente; a
 * proposta do vendedor esperando a resposta dele; a próxima visita; a seleção que vence em até 3 dias;
 * os imóveis ainda sem reação. `null` quando não há nada a fazer.
 */
export function proximoPassoDoPortal(p: Linha, agora = Date.now(), fuso?: string): { texto: string; aba: AbaPortal } | null {
  const tz = fuso ? { timeZone: fuso } : {};
  if (p.proximo_passo) return { texto: String(p.proximo_passo), aba: destinoDoProximoPasso(p, agora) };
  const negociacoes: NegociacaoPublica[] = p.negociacoes ?? [];
  if (negociacoes.some((n) => propostaAceitavel(n, agora))) return { texto: 'Proposta do vendedor aguardando sua resposta', aba: 'propostas' };
  const visita = proximaVisita(p.agenda ?? [], agora);
  if (visita) {
    const d = new Date(visita);
    const dia = d.toLocaleDateString('pt-BR', { weekday: 'long', ...tz });
    const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', ...tz }).replace(':00', ' h').replace(/^0/, '');
    return { texto: `Visita ${dia.replace('-feira', '')} às ${hora}`, aba: 'agenda' };
  }
  const vence = (p.selecoes ?? []).map((s: Linha) => s.expira_em).filter(Boolean).map((x: string) => Date.parse(x)).filter((t: number) => t > agora).sort((a: number, b: number) => a - b)[0];
  if (vence && vence - agora <= 3 * 86400e3) {
    return { texto: `Sua seleção vale até ${new Date(vence).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', ...tz })}`, aba: 'imoveis' };
  }
  const semReacao = imoveisDoPortal(p.selecoes ?? []).filter((x) => !x.imovel.reacao).length;
  if (semReacao) return { texto: `${semReacao} imóve${semReacao > 1 ? 'is' : 'l'} esperando sua opinião`, aba: 'imoveis' };
  return null;
}

/** Aba pedida no endereço (`#imoveis`); desconhecida volta para a Conversa. */
export function abaDoEndereco(hash: string): AbaPortal {
  const a = hash.replace(/^#/, '');
  return a === 'imoveis' || a === 'agenda' || a === 'propostas' || a === 'arquivos' ? a : 'conversa';
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
  conversar_preco: 'Conversar sobre o preço',
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

// ---------------------------------------------------------------------------------------------------
// Propostas no portal (D5, M5b): o que da negociação vai à vitrine. Lista PERMITIDA de campos — nunca
// uma lista de proibidos: campo novo numa tabela não chega ao cliente sem alguém pô-lo aqui. O mandato
// (recuo, alvo, BATNA), o teto estimado do comprador, a fonte da estimativa e quem conduz nunca saem.

/** Como o cliente vê o momento da negociação. */
export type SituacaoNegociacao = 'sua_vez' | 'com_o_corretor' | 'com_o_proprietario' | 'fechada' | 'encerrada' | 'pausada';

/** Uma proposta como o cliente a lê: a dele (`voce`) ou a do vendedor. */
export interface PropostaPublica {
  ref: number;
  rodada: number | null;
  quem: 'voce' | 'vendedor';
  valor_c: number;
  /** Só na do vendedor: o que ele escreveu para o cliente (passou pela trava de sigilo ao sair). */
  condicoes: string | null;
  concessao: string | null;
  contrapartida: string | null;
  validade_ate: string | null;
  estado: 'enviada' | 'aceita' | 'recusada' | 'substituida' | 'expirada';
  quando: string | null;
}

export interface NegociacaoPublica {
  ref: number;
  imovel: { codigo: string | null; titulo: string | null; bairro: string | null; cidade: string | null } | null;
  situacao: SituacaoNegociacao;
  /** O cliente pode fazer oferta ou aceitar uma condição (negociação em andamento, sem acordo pendente). */
  pode_agir: boolean;
  propostas: PropostaPublica[];
  /** Preço anunciado do imóvel (público): a tela confere a oferta antes de enviar (#194). */
  preco_pedido_c?: number | null;
}

/** Piso absoluto de uma oferta do portal (#194): R$ 10 mil. */
export const OFERTA_MINIMA_C = 1_000_000;

/**
 * Oferta plausível (#194): ao menos R$ 10 mil e ao menos metade do preço pedido. Abaixo disso é
 * quase sempre erro de digitação ("1.350" querendo dizer R$ 1,35 mi): não vira rodada.
 */
export function ofertaPlausivel(valor_c: number, preco_pedido_c: number | null | undefined): boolean {
  if (!(valor_c >= OFERTA_MINIMA_C)) return false;
  return !(preco_pedido_c && preco_pedido_c > 0) || valor_c * 2 >= preco_pedido_c;
}

/**
 * O valor que o cliente provavelmente quis dizer (#194): multiplica por mil até chegar perto do preço
 * pedido ("1.350" → R$ 1.350.000). `null` se não há preço ou nenhuma escala serve.
 */
export function ofertaProvavel(valor_c: number, preco_pedido_c: number | null | undefined): number | null {
  if (!preco_pedido_c || !(valor_c > 0)) return null;
  // Nunca sugere acima do teto das colunas (o webhook recusaria a própria sugestão).
  for (let v = valor_c * 1000; v <= preco_pedido_c * 2 && v <= CENTAVOS_MAXIMO; v *= 1000) if (ofertaPlausivel(v, preco_pedido_c)) return v;
  return null;
}

const SITUACAO: Record<string, SituacaoNegociacao> = {
  ativa: 'com_o_corretor',
  aguardando_corretor: 'com_o_corretor',
  aguardando_cliente: 'sua_vez',
  aguardando_proprietario: 'com_o_proprietario',
  ganha: 'fechada',
  perdida: 'encerrada',
  pausada: 'pausada',
};
const AGE = ['ativa', 'aguardando_corretor', 'aguardando_cliente'];
const ESTADOS_PUBLICOS = ['enviada', 'aceita', 'recusada', 'substituida', 'expirada'] as const;

const isoOuNulo = (v: unknown) => (v instanceof Date ? v.toISOString() : typeof v === 'string' && v ? v : null);
const textoOuNulo = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

/**
 * Uma proposta como vai ao portal, ou `null` se ela não sai: do proprietário nunca; do vendedor só a
 * que foi ENVIADA ao cliente (portal ou Fazer agora) — o registro interno do corretor (`registrada`)
 * fica de fora; do comprador, as dele, só com valor, rodada e estado (as anotações do corretor sobre a
 * oferta, não).
 */
export function propostaPublica(p: Linha): PropostaPublica | null {
  const valor_c = Number(p.valor_c);
  if (!Number.isInteger(valor_c) || valor_c <= 0) return null;
  const base = { ref: Number(p.id), rodada: p.rodada == null ? null : Number(p.rodada), valor_c, quando: isoOuNulo(p.criado_em) };
  if (p.direcao === 'comprador') {
    const estado = (ESTADOS_PUBLICOS as readonly string[]).includes(p.estado) ? p.estado : 'enviada';
    return { ...base, quem: 'voce', condicoes: null, concessao: null, contrapartida: null, validade_ate: null, estado };
  }
  if (p.direcao !== 'vendedor' || p.estado === 'registrada' || !(ESTADOS_PUBLICOS as readonly string[]).includes(p.estado)) return null;
  return {
    ...base,
    quem: 'vendedor',
    condicoes: textoOuNulo(p.condicoes, 500),
    concessao: textoOuNulo(p.concessao, 200),
    contrapartida: textoOuNulo(p.contrapartida, 200),
    validade_ate: isoOuNulo(p.validade_ate),
    estado: p.estado,
  };
}

/** A negociação como vai ao portal: só o momento, o imóvel do jeito do anúncio e as propostas que saem. */
export function negociacaoPublica(n: Linha, propostas: Linha[], imovel: NegociacaoPublica['imovel'], preco_pedido_c: number | null = null): NegociacaoPublica {
  return {
    ref: Number(n.id),
    preco_pedido_c: preco_pedido_c && preco_pedido_c > 0 ? preco_pedido_c : null,
    imovel: imovel ? { codigo: imovel.codigo ?? null, titulo: imovel.titulo ?? null, bairro: imovel.bairro ?? null, cidade: imovel.cidade ?? null } : null,
    situacao: SITUACAO[n.estado] ?? 'com_o_corretor',
    pode_agir: AGE.includes(n.estado),
    propostas: propostas
      .filter((p) => Number(p.negociacao_id) === Number(n.id))
      .sort((a, b) => Number(a.id) - Number(b.id))
      .map(propostaPublica)
      .filter((p): p is PropostaPublica => !!p),
  };
}

/**
 * A proposta do vendedor que o cliente pode aceitar agora: a última da negociação, enviada, dentro da
 * validade, sem oferta do cliente depois dela, com a negociação em andamento. `null` se não há.
 */
export function propostaAceitavel(n: Pick<NegociacaoPublica, 'pode_agir' | 'propostas'>, agora = Date.now()): PropostaPublica | null {
  if (!n.pode_agir) return null;
  const ultima = n.propostas[n.propostas.length - 1];
  if (!ultima || ultima.quem !== 'vendedor' || ultima.estado !== 'enviada') return null;
  if (ultima.validade_ate && Date.parse(ultima.validade_ate) < agora) return null;
  return ultima;
}

/** Valor em reais digitado pelo cliente ("1.450.000", "1450000,00", "R$ 1.450.000") em centavos; `null` se não lê. */
export function centavosDoValor(texto: string): number | null {
  const t = String(texto ?? '').replace(/R\$|\s/gi, '');
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$/.test(t)) return null;
  const [inteiro, frac = ''] = t.replace(/\./g, '').split(',');
  const c = Number(inteiro) * 100 + Number(frac.padEnd(2, '0'));
  return Number.isSafeInteger(c) && c > 0 ? c : null;
}
