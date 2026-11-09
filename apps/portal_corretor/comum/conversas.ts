// Conversas (spec 11.1 P02, D-116): o que a lista, o centro e o contexto da tela calculam a partir das
// linhas de `conversas` e `mensagens`. Puro, sem lit nem `urbiVerso`: o backend e a tela usam o mesmo.

export const FILTROS_CONVERSA = ['minha_vez', 'mensageiro', 'negociador', 'aguardando', 'nao_lidas', 'arquivadas'] as const;
export type FiltroConversa = (typeof FILTROS_CONVERSA)[number];

export const ROTULO_FILTRO: Record<FiltroConversa, string> = {
  minha_vez: 'Minha vez',
  mensageiro: 'Mensageiro',
  negociador: 'Negociador',
  aguardando: 'Aguardando',
  nao_lidas: 'Não lidas',
  arquivadas: 'Arquivadas',
};

/** Canais por onde uma mensagem entra ou sai no piloto; `whatsapp` chega com o bloco 6 (D-59, D-78). */
export const CANAIS_MENSAGEM = ['portal', 'registro', 'wa_me', 'whatsapp', 'sistema'] as const;
export type CanalMensagem = (typeof CANAIS_MENSAGEM)[number];

export const TIPOS_MENSAGEM = ['texto', 'imovel', 'selecao', 'arquivo', 'localizacao', 'link_portal', 'sistema'] as const;
export type TipoMensagem = (typeof TIPOS_MENSAGEM)[number];

export const ROTULO_CANAL_MENSAGEM: Record<CanalMensagem, string> = {
  portal: 'pelo portal',
  registro: 'registrada',
  wa_me: 'pelo WhatsApp do celular',
  whatsapp: 'pelo WhatsApp',
  sistema: '',
};

/** Resumo de uma linha para a lista ("última mensagem"), sem dado sigiloso: só o que o cliente também vê. */
export function resumoDaMensagem(m: { tipo?: string | null; conteudo?: string | null; dados?: unknown }): string {
  const d = (m.dados ?? {}) as Record<string, unknown>;
  switch (m.tipo) {
    case 'imovel':
      return `Imóvel enviado: ${String(d.titulo ?? d.codigo ?? '')}`.trim();
    case 'selecao':
      return `Seleção enviada${d.titulo ? `: ${String(d.titulo)}` : ''}`;
    case 'arquivo':
      return `Arquivo enviado${d.nome ? `: ${String(d.nome)}` : ''}`;
    case 'localizacao':
      return `Localização enviada${d.titulo ? `: ${String(d.titulo)}` : ''}`;
    case 'link_portal':
      return 'Link do portal enviado';
    case 'sistema':
      return String(m.conteudo ?? '');
    default:
      return String(m.conteudo ?? '').replace(/\s+/g, ' ').trim().slice(0, 300);
  }
}

export interface ConversaResumida {
  estado?: string | null;
  atendido_por?: string | null;
  agente?: string | null;
  nao_lidas?: number | null;
  arquivada_em?: unknown;
  ultimo_tipo?: string | null;
}

/** A conversa entra no filtro da lista? (`null` = todas as não arquivadas.) */
export function passaNoFiltro(c: ConversaResumida, filtro: FiltroConversa | null): boolean {
  const arquivada = !!c.arquivada_em;
  if (filtro === 'arquivadas') return arquivada;
  if (arquivada) return false;
  const naoLidas = Number(c.nao_lidas ?? 0) > 0;
  switch (filtro) {
    case null:
      return true;
    case 'minha_vez':
      return c.estado === 'aguardando_corretor' || (c.atendido_por !== 'agente' && naoLidas);
    case 'mensageiro':
      return c.atendido_por === 'agente' && c.agente === 'mensageiro';
    case 'negociador':
      return c.atendido_por === 'agente' && c.agente === 'negociador';
    case 'aguardando':
      return c.estado === 'aguardando_cliente';
    case 'nao_lidas':
      return naoLidas;
  }
}

/** Contadores dos chips de filtro, sobre as conversas da conta. */
export function contarFiltros(conversas: ConversaResumida[]): Record<FiltroConversa, number> {
  const r = Object.fromEntries(FILTROS_CONVERSA.map((f) => [f, 0])) as Record<FiltroConversa, number>;
  for (const c of conversas) for (const f of FILTROS_CONVERSA) if (passaNoFiltro(c, f)) r[f]++;
  return r;
}

/** Chip de status da conversa (um só, o mais importante), como a referência P02 mostra na lista. */
export function chipDeStatus(c: ConversaResumida): { rotulo: string; cor: 'padrao' | 'sucesso' | 'alerta' | 'info' | 'erro' } | null {
  if (c.atendido_por === 'agente') return { rotulo: c.agente === 'negociador' ? 'Negociador atendendo' : 'Mensageiro atendendo', cor: 'info' };
  if (c.estado === 'aguardando_corretor') return { rotulo: 'Sua vez', cor: 'alerta' };
  switch (c.ultimo_tipo) {
    case 'imovel':
      return { rotulo: 'Imóvel enviado', cor: 'padrao' };
    case 'selecao':
      return { rotulo: 'Seleção enviada', cor: 'padrao' };
    case 'link_portal':
      return { rotulo: 'Portal enviado', cor: 'padrao' };
  }
  if (c.estado === 'aguardando_cliente') return { rotulo: 'Aguardando cliente', cor: 'padrao' };
  if (c.estado === 'encerrada') return { rotulo: 'Encerrada', cor: 'padrao' };
  return null;
}

/** Chip de origem do contato (canal da origem), como na referência ("Anúncio Instagram", "Minha Página"). */
export const ROTULO_ORIGEM_CHIP: Record<string, string> = {
  instagram: 'Anúncio Instagram',
  facebook: 'Anúncio Facebook',
  pagina: 'Minha Página',
  portal: 'Portal',
  whatsapp: 'WhatsApp',
  indicacao: 'Indicação',
  rede: 'Rede',
  placa: 'Placa',
  tiktok: 'TikTok',
  youtube: 'YouTube',
};

/** Texto de "quem atende" no cabeçalho do centro. */
export function quemAtende(c: ConversaResumida, nomeCorretor: string): string {
  if (c.atendido_por === 'agente') return c.agente === 'negociador' ? 'Negociador IA atendendo' : 'Mensageiro atendendo';
  return `${nomeCorretor} assumiu`;
}

/** "há 12 min", "ontem", "há 9 dias": a hora relativa da lista. */
export function haQuanto(iso: string | Date | null | undefined, agora = Date.now()): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const min = Math.max(0, Math.round((agora - t) / 60_000));
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  if (d === 1) return 'ontem';
  return `há ${d} dias`;
}

/** Um horário livre para a visita (P02 › Agendar visita): o instante ISO e o rótulo que o corretor lê. */
export interface HorarioLivre {
  iso: string;
  rotulo: string;
}

/**
 * Horários livres dos próximos dias para marcar uma visita (D-127): de hora em hora, das 9 h às 18 h,
 * nos `dias` seguintes, tirando os que batem com as atividades pendentes do corretor (uma hora de
 * folga para cada lado de cada atividade). Puro: a tela lê `GET /atividades?status=pendente` e passa.
 */
export function horariosLivres(ocupados: { quando?: string | Date | null }[], agora = new Date(), dias = 5): HorarioLivre[] {
  const livres: HorarioLivre[] = [];
  const marcados = ocupados.map((a) => (a.quando ? new Date(a.quando).getTime() : NaN)).filter((t) => !Number.isNaN(t));
  const HORA = 3600e3;
  const minimo = agora.getTime() + HORA; // nada para "daqui a pouco"
  for (let d = 0; d <= dias; d++) {
    const dia = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + d);
    if (dia.getDay() === 0) continue; // domingo
    for (let h = 9; h <= 18; h++) {
      const t = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), h, 0, 0, 0);
      if (t.getTime() < minimo) continue;
      if (marcados.some((m) => Math.abs(m - t.getTime()) < HORA)) continue;
      const quando = d === 0 ? 'Hoje' : d === 1 ? 'Amanhã' : t.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
      livres.push({ iso: t.toISOString(), rotulo: `${quando} · ${String(h).padStart(2, '0')}:00` });
    }
  }
  return livres;
}

/** Texto da confirmação da visita que vai ao cliente (pelo WhatsApp do celular) e fica na conversa. */
export function mensagemDaVisita(nomeContato: string, quando: string | Date, imovel: { codigo?: string | null; titulo?: string | null; bairro?: string | null } | null): string {
  const d = new Date(quando);
  const dia = d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const onde = imovel ? ` ao ${imovel.titulo ?? imovel.codigo ?? 'imóvel'}${imovel.bairro ? ` (${imovel.bairro})` : ''}` : '';
  return `${nomeContato.split(' ')[0]}, visita marcada${onde}: ${dia}, às ${hora}. Qualquer imprevisto, me avise por aqui.`;
}
