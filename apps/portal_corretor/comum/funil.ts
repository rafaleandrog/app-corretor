// Inteligência do Funil por regras (bloco 4, spec 10.4): temperatura com motivo, próxima abordagem
// pelo playbook e a fila do dia. Puro: as rotas juntam os sinais e gravam.
import { chegou, type NegocioNum } from './numeros';

export const TEMPERATURAS = ['frio', 'morno', 'quente'] as const;
export type Temperatura = (typeof TEMPERATURAS)[number];
/** Abas do Início (D-82): a fila do dia e a lista de 14 dias. */
export const ABAS_INICIO = [
  { id: 'hoje', label: 'Hoje', icone: 'fa-solid fa-list-check' },
  { id: 'agenda', label: 'Agenda', icone: 'fa-solid fa-calendar-day' },
] as const;
/** Caminho antigo → aba do Início: `/agenda` virou a aba Agenda. */
export const APELIDOS_INICIO: Record<string, string> = { '/agenda': 'agenda' };
/** Sub-rota do Início na aba Agenda, destino das notificações de visita (manifesto e `notificar`). */
export const ROTA_AGENDA = '?aba=agenda';
export const CANAIS_ABORDAGEM = ['whatsapp', 'ligacao', 'email', 'visita'] as const;

/**
 * Marcos do funil: as etapas que os números (11.2) e o playbook reconhecem, qualquer que seja o
 * nome que o corretor der. Etapa nova criada pelo corretor não tem marco.
 */
export const MARCOS = ['novo', 'atendimento', 'qualificado', 'visita', 'visitou', 'proposta', 'documentacao', 'contato', 'avaliacao', 'autorizacao', 'anunciado'] as const;

/** Marco das etapas da semente, pelo nome (para contas semeadas antes do marco existir). */
export const MARCO_PADRAO: Record<string, string> = {
  Novo: 'novo',
  'Em atendimento': 'atendimento',
  Qualificado: 'qualificado',
  'Visita agendada': 'visita',
  Visitou: 'visitou',
  Proposta: 'proposta',
  Documentação: 'documentacao',
  Contato: 'contato',
  Avaliação: 'avaliacao',
  'Autorização assinada': 'autorizacao',
  Anunciado: 'anunciado',
  'Proposta recebida': 'proposta',
};

export interface Abordagem {
  marco: string;
  temperatura: Temperatura;
  abordagem: string;
  canal_sugerido: (typeof CANAIS_ABORDAGEM)[number];
  prazo_horas: number;
}

const p = (marco: string, temperatura: Temperatura, abordagem: string, canal_sugerido: Abordagem['canal_sugerido'], prazo_horas: number): Abordagem => ({
  marco, temperatura, abordagem, canal_sugerido, prazo_horas,
});

/** Playbook semeado (10.4): o par (marco da etapa, temperatura) aponta a abordagem e o prazo. */
export const PLAYBOOK_PADRAO: Abordagem[] = [
  p('novo', 'quente', 'Responder agora e perguntar o que ele procura (bairro, quartos, faixa de preço)', 'whatsapp', 1),
  p('novo', 'morno', 'Apresentar-se e perguntar o que ele procura', 'whatsapp', 4),
  p('novo', 'frio', 'Mandar uma mensagem curta oferecendo ajuda e um imóvel em destaque', 'whatsapp', 24),
  p('atendimento', 'quente', 'Mandar 3 imóveis compatíveis e oferecer 2 horários de visita', 'whatsapp', 4),
  p('atendimento', 'morno', 'Mandar 3 imóveis compatíveis e perguntar qual chamou mais atenção', 'whatsapp', 24),
  p('atendimento', 'frio', 'Ligar para entender se a busca continua e o que mudou', 'ligacao', 72),
  p('qualificado', 'quente', 'Propor visita aos 2 imóveis que ele mais gostou', 'whatsapp', 4),
  p('qualificado', 'morno', 'Mandar uma seleção nova com o que ele pediu e perguntar a opinião', 'whatsapp', 48),
  p('qualificado', 'frio', 'Perguntar se o perfil de busca mudou e mandar uma novidade', 'whatsapp', 96),
  p('visita', 'quente', 'Confirmar a visita na véspera e mandar a localização', 'whatsapp', 24),
  p('visita', 'morno', 'Confirmar a visita e lembrar o horário', 'whatsapp', 24),
  p('visita', 'frio', 'Ligar para confirmar ou remarcar a visita', 'ligacao', 24),
  p('visitou', 'quente', 'Perguntar o que achou e conversar sobre proposta', 'ligacao', 12),
  p('visitou', 'morno', 'Pedir o retorno da visita e oferecer opções parecidas', 'whatsapp', 24),
  p('visitou', 'frio', 'Mandar 2 alternativas que resolvam o que ele não gostou', 'whatsapp', 72),
  p('proposta', 'quente', 'Acompanhar a resposta do proprietário e dar notícia ao cliente', 'ligacao', 12),
  p('proposta', 'morno', 'Dar notícia da proposta e alinhar a próxima rodada', 'whatsapp', 24),
  p('proposta', 'frio', 'Ligar para entender se a proposta continua de pé', 'ligacao', 48),
  p('documentacao', 'quente', 'Conferir a lista de documentos que falta e o prazo do banco', 'whatsapp', 24),
  p('documentacao', 'morno', 'Lembrar os documentos pendentes', 'whatsapp', 48),
  p('documentacao', 'frio', 'Ligar para destravar a documentação', 'ligacao', 48),
  p('contato', 'quente', 'Marcar a avaliação do imóvel', 'ligacao', 12),
  p('contato', 'morno', 'Explicar como você trabalha e propor a avaliação', 'whatsapp', 48),
  p('contato', 'frio', 'Mandar um caso de venda parecido e oferecer a avaliação', 'whatsapp', 96),
  p('avaliacao', 'quente', 'Apresentar o preço sugerido e a autorização para assinar', 'visita', 24),
  p('avaliacao', 'morno', 'Mandar a análise de preço com os comparáveis', 'whatsapp', 48),
  p('avaliacao', 'frio', 'Ligar para retomar a conversa sobre o preço', 'ligacao', 96),
  p('autorizacao', 'quente', 'Agendar as fotos e publicar o anúncio', 'whatsapp', 24),
  p('autorizacao', 'morno', 'Mandar o plano de divulgação', 'whatsapp', 48),
  p('autorizacao', 'frio', 'Ligar para alinhar a divulgação', 'ligacao', 72),
  p('anunciado', 'quente', 'Mandar ao proprietário o resumo da semana (visitas e retornos)', 'whatsapp', 72),
  p('anunciado', 'morno', 'Mandar ao proprietário o resumo da semana', 'whatsapp', 168),
  p('anunciado', 'frio', 'Conversar sobre ajuste de preço com os retornos das visitas', 'ligacao', 168),
];

export interface Sinais {
  agora: string;
  ultimo_contato_em: string | null;
  /** Visita pendente nos próximos 14 dias. */
  visita_marcada: boolean;
  /** Maior nota de retorno de visita nos últimos 14 dias (1–5). */
  nota_visita: number | null;
  /** Algum negócio aberto em etapa de proposta ou documentação. */
  em_proposta: boolean;
  /** Quando cada sinal forte surgiu: decide se ele é posterior à escolha do corretor. */
  proposta_desde?: string | null;
  visita_marcada_em?: string | null;
  nota_visita_em?: string | null;
}

export interface Classificacao {
  temperatura: Temperatura;
  motivo: string;
  /** Sinal forte: vence a escolha manual do corretor feita antes dele (10.4). */
  forte: boolean;
  /** Quando o sinal forte surgiu (null se não é forte ou se a data não é conhecida). */
  forte_desde?: string | null;
}

/**
 * Instante em ISO, venha como `Date` (colunas `datahora` lidas pelo `req.dados`, banco-de-dados.md)
 * ou como texto. Comparar `Date` com texto dá sempre falso: toda comparação de instante passa aqui.
 */
export function iso(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

const dias = (de: string, ate: string) => (new Date(ate).getTime() - new Date(de).getTime()) / 86400e3;

/** Regras explícitas da temperatura, com o motivo em uma frase (10.4). */
export function classificar(s: Sinais): Classificacao {
  if (s.em_proposta) return { temperatura: 'quente', motivo: 'Tem negócio em proposta ou documentação', forte: true, forte_desde: s.proposta_desde ?? null };
  if (s.visita_marcada) return { temperatura: 'quente', motivo: 'Tem visita marcada', forte: true, forte_desde: s.visita_marcada_em ?? null };
  if (s.nota_visita !== null && s.nota_visita >= 4) return { temperatura: 'quente', motivo: `Gostou da visita (nota ${s.nota_visita})`, forte: true, forte_desde: s.nota_visita_em ?? null };
  if (!s.ultimo_contato_em) return { temperatura: 'frio', motivo: 'Nenhum contato registrado', forte: false };
  const parado = dias(s.ultimo_contato_em, s.agora);
  if (parado > 7) return { temperatura: 'frio', motivo: `Sem contato há ${Math.floor(parado)} dias`, forte: false };
  if (s.nota_visita !== null && s.nota_visita <= 2) return { temperatura: 'morno', motivo: `Não gostou da visita (nota ${s.nota_visita})`, forte: true, forte_desde: s.nota_visita_em ?? null };
  return { temperatura: 'morno', motivo: parado < 1 ? 'Conversou hoje, sem visita marcada' : `Conversou há ${Math.ceil(parado)} dia(s), sem visita marcada`, forte: false };
}

/**
 * Decide se a regra troca a temperatura atual. A escolha do corretor vale até surgir um sinal forte
 * **depois** dela (evento, não estado: a visita marcada antes da escolha não a desfaz); sem escolha
 * manual, vale a regra.
 */
export function deveTrocar(atual: { temperatura: string | null; autor: string | null; em?: unknown }, nova: Classificacao): boolean {
  if (atual.temperatura === nova.temperatura) return false;
  if (atual.autor === 'corretor') {
    const sinal = iso(nova.forte_desde);
    const escolha = iso(atual.em);
    return nova.forte && !!sinal && (!escolha || sinal > escolha);
  }
  return true;
}

/** Quando a abordagem vira atrasada: a partir do mais recente entre a entrada na etapa, o último contato e o adiamento. */
export function venceEm(prazoHoras: number, referencias: (string | null | undefined)[]): string | null {
  const base = referencias.filter(Boolean).map((r) => new Date(r!).getTime()).filter((t) => !Number.isNaN(t));
  if (!base.length) return null;
  return new Date(Math.max(...base) + prazoHoras * 3600e3).toISOString();
}

export type TipoFila = 'quente_sem_resposta' | 'abordagem_vencida' | 'visita' | 'proximo_passo';

/** Ordem da fila do dia (10.4): quentes sem resposta, abordagens vencidas, visitas, próximos passos. */
export const ORDEM_FILA: TipoFila[] = ['quente_sem_resposta', 'abordagem_vencida', 'visita', 'proximo_passo'];

export function ordenarFila<T extends { tipo: TipoFila; quando: unknown }>(itens: T[]): T[] {
  return [...itens].sort((a, b) => ORDEM_FILA.indexOf(a.tipo) - ORDEM_FILA.indexOf(b.tipo) || (iso(a.quando) ?? '').localeCompare(iso(b.quando) ?? ''));
}

/** Canal sugerido pelo playbook → tipo da atividade ("Virar tarefa" na ficha). */
export const TIPO_DO_CANAL: Record<string, 'mensagem' | 'ligacao' | 'visita' | 'tarefa'> = {
  whatsapp: 'mensagem',
  mensagem: 'mensagem',
  ligacao: 'ligacao',
  visita: 'visita',
  email: 'tarefa',
};

/**
 * Corpo de POST /atividades a partir da próxima abordagem: o tipo pelo canal, `quando` pelo prazo
 * do playbook (o vencimento; se já passou, o prazo contado de agora), ligada ao contato e ao negócio.
 */
export function tarefaDaAbordagem(
  a: { abordagem: string; canal_sugerido: string; prazo_horas: number; vence_em: string | null; negocio_id: number },
  contatoId: number,
  agora = new Date(),
) {
  const vence = iso(a.vence_em);
  const quando = vence && vence > agora.toISOString() ? vence : new Date(agora.getTime() + Math.max(1, a.prazo_horas) * 3600e3).toISOString();
  return { tipo: TIPO_DO_CANAL[a.canal_sugerido] ?? 'tarefa', titulo: a.abordagem.slice(0, 200), quando, contato_id: contatoId, negocio_id: a.negocio_id };
}

export interface PassagemEtapa {
  de_etapa_id: number;
  para_etapa_id: number;
  /** Negócios que chegaram à etapa de origem (ou além). */
  chegaram: number;
  /** Desses, quantos chegaram à etapa seguinte (ou além). */
  passaram: number;
  /** `passaram / chegaram`, com 3 casas; `null` sem negócio na origem ou com etapa sem marco. */
  taxa: number | null;
}

/**
 * Taxa de passagem entre etapas abertas vizinhas do quadro (P03): dos negócios que chegaram a uma
 * etapa, quantos chegaram à seguinte. "Chegou" é o de Números (`chegou`): o marco mais avançado
 * alcançado, então quem recuou ou foi perdido depois conta até onde foi, e o ganho passou por todas.
 * Etapa criada pelo corretor, sem marco, não tem taxa.
 */
export function taxasDePassagem(
  etapas: { id: number; nome: string; tipo: string; marco?: string | null }[],
  negocios: NegocioNum[],
): PassagemEtapa[] {
  const abertas = etapas.filter((e) => e.tipo === 'aberta');
  const marco = (e: { nome: string; marco?: string | null }) => e.marco ?? MARCO_PADRAO[e.nome] ?? null;
  return abertas.slice(1).map((para, i) => {
    const de = abertas[i];
    const [ma, mb] = [marco(de), marco(para)];
    const chegaram = ma ? negocios.filter((n) => chegou(n, ma)).length : 0;
    const passaram = ma && mb ? negocios.filter((n) => chegou(n, ma) && chegou(n, mb)).length : 0;
    return { de_etapa_id: de.id, para_etapa_id: para.id, chegaram, passaram, taxa: ma && mb && chegaram ? Math.round((passaram / chegaram) * 1000) / 1000 : null };
  });
}
