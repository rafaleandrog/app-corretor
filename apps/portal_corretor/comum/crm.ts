// Regras puras do CRM (bloco 2): contato, negócio, atividade e etapas do funil. Sem I/O.
import { emailValido, normalizarTelefone, telefoneValido, type Resultado } from './conta';

export const PAPEIS = ['comprador', 'proprietario', 'investidor', 'parceiro', 'fornecedor'] as const;
export const CANAIS = [
  'pagina', 'whatsapp', 'instagram', 'facebook', 'tiktok', 'youtube', 'portal', 'indicacao',
  'rede', 'incorporadora', 'placa', 'evento', 'importacao', 'outro',
] as const;
export const PIPELINES = ['compra', 'venda_captacao'] as const;
export const TEMPERATURAS = ['frio', 'morno', 'quente'] as const;
export const TIPOS_ATIVIDADE = ['tarefa', 'ligacao', 'mensagem', 'visita', 'reuniao', 'retorno'] as const;
export const STATUS_ATIVIDADE = ['pendente', 'feita', 'cancelada', 'nao_compareceu'] as const;
export const MOTIVOS_PERDA = ['preco', 'localizacao', 'financiamento', 'desistiu', 'comprou_com_outro', 'sem_resposta', 'outro'] as const;

/** Papéis que a tela oferece no filtro e no cadastro (spec 15.9, S11); os outros ficam no dado. */
export const PAPEIS_NA_TELA = ['comprador', 'proprietario'] as const;

/** "Sem contato há" — as mesmas opções na Lista e no Quadro de Clientes. */
export const OPCOES_PARADO_DIAS = [3, 7, 15, 30, 90] as const;

/** Filtros prontos da Lista de Clientes (spec 15.8, D-83): um ativo por vez. */
export const FILTROS_PRONTOS = ['novos', 'sem_contato', 'quentes', 'retorno_vencido'] as const;
export type FiltroPronto = (typeof FILTROS_PRONTOS)[number];

/** "Novos" são os cadastrados nestes últimos dias. */
export const DIAS_NOVOS = 7;

/** `parado_dias` da URL vira o instante de corte de `ultimo_contato_em`; fora de 1..3650, sem filtro. */
export function limiteParado(v: unknown, agora = Date.now()): string | null {
  const dias = Number(v);
  return Number.isInteger(dias) && dias > 0 && dias <= 3650 ? new Date(agora - dias * 86400e3).toISOString() : null;
}

/** Instante de um filtro de data da URL (`criado_em[gte]`, `proximo_passo_em[lt]`); inválido, sem filtro. */
export function instanteDaUrl(v: unknown): string | null {
  if (typeof v !== 'string' || !v.trim()) return null;
  const t = new Date(v.trim());
  return Number.isNaN(t.getTime()) ? null : t.toISOString();
}

/**
 * Parâmetros de `GET /contatos` para um filtro pronto. `quentes` vira a temperatura; `sem_contato`
 * usa o N de Ajustes › Atendimento (`dias_cliente_parado`).
 */
export function parametrosDoPronto(pronto: string | null, diasParado: number, agora = Date.now()): Record<string, string> {
  switch (pronto) {
    case 'novos':
      return { 'criado_em[gte]': new Date(agora - DIAS_NOVOS * 86400e3).toISOString() };
    case 'sem_contato':
      return { parado_dias: String(diasParado) };
    case 'quentes':
      return { temperatura: 'quente' };
    case 'retorno_vencido':
      return { 'proximo_passo_em[lt]': new Date(agora).toISOString() };
    default:
      return {};
  }
}

export type Pipeline = (typeof PIPELINES)[number];

export interface Etapa {
  pipeline: Pipeline;
  nome: string;
  ordem: number;
  tipo: 'aberta' | 'ganha' | 'perdida';
  probabilidade: number;
}

// Semente das etapas por pipeline (spec 6.2).
export const ETAPAS_PADRAO: Etapa[] = [
  ...(
    [
      ['Novo', 'aberta', 0.05], ['Em atendimento', 'aberta', 0.1], ['Qualificado', 'aberta', 0.2],
      ['Visita agendada', 'aberta', 0.35], ['Visitou', 'aberta', 0.5], ['Proposta', 'aberta', 0.7],
      ['Documentação', 'aberta', 0.9], ['Ganho', 'ganha', 1], ['Perdido', 'perdida', 0],
    ] as const
  ).map(([nome, tipo, probabilidade], ordem) => ({ pipeline: 'compra' as const, nome, tipo, probabilidade, ordem })),
  ...(
    [
      ['Contato', 'aberta', 0.05], ['Avaliação', 'aberta', 0.15], ['Autorização assinada', 'aberta', 0.4],
      ['Anunciado', 'aberta', 0.5], ['Proposta recebida', 'aberta', 0.75], ['Vendido', 'ganha', 1], ['Encerrado', 'perdida', 0],
    ] as const
  ).map(([nome, tipo, probabilidade], ordem) => ({ pipeline: 'venda_captacao' as const, nome, tipo, probabilidade, ordem })),
];

const texto = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const opcional = (v: unknown, limite: number): string | null => texto(v).slice(0, limite) || null;

/** Papéis aceitam lista ou texto separado por vírgula; saem únicos, na ordem do catálogo. */
export function normalizarPapeis(v: unknown): string[] {
  const brutos = Array.isArray(v) ? v : typeof v === 'string' ? v.split(/[,;]/) : [];
  const sem = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
  const pedidos = new Set(brutos.map((p) => sem(String(p))));
  return PAPEIS.filter((p) => pedidos.has(p));
}

export interface DadosContato {
  nome: string;
  telefone: string | null;
  email: string | null;
  papeis: string;
  observacoes: string | null;
  temperatura: string | null;
  proximo_passo: string | null;
  proximo_passo_em: string | null;
}

function dataHora(v: unknown, campo: string, erros: string[]): string | null {
  const t = texto(v);
  if (!t) return null;
  // Só data e hora ISO (com dia e hora): o parser solto do Date aceitaria "7pm" em UTC.
  const d = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(t) ? new Date(t) : new Date(NaN);
  if (Number.isNaN(d.getTime())) {
    erros.push(`${campo}: data e hora inválidas.`);
    return null;
  }
  return d.toISOString();
}

/**
 * Contato novo ou editado. Em edição (`parcial`), só os campos presentes no corpo entram — o resto
 * não é tocado. Telefone sai em E.164 e é a chave de duplicidade na conta.
 */
export function validarContato(corpo: Record<string, unknown>, parcial = false): Resultado<Partial<DadosContato>> {
  const erros: string[] = [];
  for (const c of ['nome', 'telefone', 'email', 'observacoes', 'temperatura', 'proximo_passo', 'proximo_passo_em']) {
    const v = corpo[c];
    if (v !== undefined && v !== null && typeof v !== 'string') erros.push(`O campo ${c} deve ser texto.`);
  }
  const tem = (c: string) => !parcial || c in corpo;
  const dados: Partial<DadosContato> = {};
  if (tem('nome')) {
    dados.nome = texto(corpo.nome).slice(0, 200);
    if (!dados.nome) erros.push('Informe o nome.');
  }
  if (tem('telefone')) {
    dados.telefone = normalizarTelefone(corpo.telefone);
    if (dados.telefone && !telefoneValido(dados.telefone)) erros.push('Telefone inválido. Use DDD e número.');
  }
  if (tem('email')) {
    dados.email = texto(corpo.email).toLowerCase() || null;
    if (dados.email && (!emailValido(dados.email) || dados.email.length > 200)) erros.push('E-mail inválido.');
  }
  if (tem('papeis')) {
    // Contato novo sem papel informado é comprador, como o padrão do schema.
    const papeis = !parcial && (corpo.papeis === undefined || corpo.papeis === null || corpo.papeis === '') ? ['comprador'] : normalizarPapeis(corpo.papeis);
    if (!papeis.length) erros.push('Escolha ao menos um papel (comprador, proprietário, investidor, parceiro ou fornecedor).');
    dados.papeis = papeis.join(',');
  }
  if ('temperatura' in corpo) {
    // Classificação manual do corretor; o motivo e a sugestão automática chegam com o funil (bloco 4).
    dados.temperatura = texto(corpo.temperatura) || null;
    if (dados.temperatura && !(TEMPERATURAS as readonly string[]).includes(dados.temperatura)) erros.push('Temperatura inválida (frio, morno ou quente).');
  }
  if (tem('observacoes')) dados.observacoes = typeof corpo.observacoes === 'string' ? corpo.observacoes.trim() || null : null;
  if (tem('proximo_passo')) dados.proximo_passo = opcional(corpo.proximo_passo, 300);
  if (tem('proximo_passo_em')) dados.proximo_passo_em = dataHora(corpo.proximo_passo_em, 'Próximo passo', erros);
  if (!parcial && !dados.telefone && !dados.email) erros.push('Informe telefone ou e-mail para poder falar com o contato.');
  if (erros.length) return { ok: false, erros };
  return { ok: true, dados };
}

export function validarAtividade(corpo: Record<string, unknown>, parcial = false): Resultado<Record<string, unknown>> {
  const erros: string[] = [];
  const tem = (c: string) => !parcial || c in corpo;
  const d: Record<string, unknown> = {};
  if (tem('tipo')) {
    d.tipo = texto(corpo.tipo) || 'tarefa';
    if (!(TIPOS_ATIVIDADE as readonly string[]).includes(d.tipo as string)) erros.push('Tipo de atividade inválido.');
  }
  if (tem('titulo')) {
    d.titulo = texto(corpo.titulo).slice(0, 200);
    if (!d.titulo) erros.push('Informe o que é a atividade.');
  }
  if (tem('quando')) {
    d.quando = dataHora(corpo.quando, 'Quando', erros);
    if (!d.quando && !erros.length) erros.push('Informe quando.');
  }
  if (tem('local')) d.local = opcional(corpo.local, 300);
  if ('status' in corpo) {
    d.status = texto(corpo.status);
    if (!(STATUS_ATIVIDADE as readonly string[]).includes(d.status as string)) erros.push('Situação inválida.');
  }
  if ('resultado' in corpo) d.resultado = typeof corpo.resultado === 'string' ? corpo.resultado.trim() || null : null;
  if (erros.length) return { ok: false, erros };
  return { ok: true, dados: d };
}

/** Dinheiro chega em reais (número ou "1.234,56") e sai em centavos inteiros (spec: sempre centavos). */
export function reaisParaCentavos(v: unknown): number | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  if (typeof v === 'string' && !/\d/.test(v)) return NaN;
  const n =
    typeof v === 'number'
      ? v
      : Number(String(v).replace(/[R$\s]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : NaN;
}

/**
 * Configuração de etapas de um pipeline: ao menos uma aberta, exatamente uma ganha e uma perdida,
 * nomes únicos, probabilidade entre 0 e 1. A ordem segue a posição na lista.
 */
export function validarEtapas(pipeline: Pipeline, lista: unknown): Resultado<(Etapa & { id?: number })[]> {
  const erros: string[] = [];
  if (!Array.isArray(lista) || !lista.length) return { ok: false, erros: ['Envie a lista de etapas.'] };
  const nomes = new Set<string>();
  const etapas = lista.map((bruta, ordem) => {
    const e = (bruta ?? {}) as Record<string, unknown>;
    const nome = texto(e.nome).slice(0, 60);
    const tipo = texto(e.tipo) as Etapa['tipo'];
    const probabilidade = Number(e.probabilidade);
    if (!nome) erros.push(`Etapa ${ordem + 1}: informe o nome.`);
    if (nomes.has(nome.toLowerCase())) erros.push(`Etapa "${nome}" repetida.`);
    nomes.add(nome.toLowerCase());
    if (!['aberta', 'ganha', 'perdida'].includes(tipo)) erros.push(`Etapa "${nome}": tipo inválido.`);
    if (!(probabilidade >= 0 && probabilidade <= 1)) erros.push(`Etapa "${nome}": probabilidade entre 0 e 1 (0 a 100%).`);
    const id = Number.isInteger(e.id) ? (e.id as number) : undefined;
    return { id, pipeline, nome, tipo, ordem, probabilidade: Math.round(probabilidade * 100) / 100 };
  });
  const conta = (t: string) => etapas.filter((e) => e.tipo === t).length;
  if (conta('aberta') < 1) erros.push('Deixe ao menos uma etapa em andamento.');
  if (conta('ganha') !== 1) erros.push('Tenha exatamente uma etapa de negócio ganho.');
  if (conta('perdida') !== 1) erros.push('Tenha exatamente uma etapa de negócio perdido.');
  const primeiraFinal = etapas.findIndex((e) => e.tipo !== 'aberta');
  if (primeiraFinal >= 0 && etapas.slice(primeiraFinal).some((e) => e.tipo === 'aberta')) {
    erros.push('As etapas de ganho e de perda ficam no fim do funil, depois das etapas em andamento.');
  }
  if (erros.length) return { ok: false, erros };
  return { ok: true, dados: etapas };
}
