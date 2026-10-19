// Regras puras do bloco 1 (conta, perfil do corretor, configurações). Sem I/O: o backend as usa
// antes de gravar e os testes as exercitam direto. Espelham os `formato`/`intervalo`/`opcoes` do
// schema.json, para a rota responder com mensagem legível em vez do erro cru do banco.

export type Resultado<T> = { ok: true; dados: T } | { ok: false; erros: string[] };

export const TIPOS_CONTA = ['corretor_autonomo', 'imobiliaria', 'incorporadora'] as const;
export const MODOS_APROVACAO = ['manual', 'janela'] as const;

export interface PerfilConta {
  tipo: (typeof TIPOS_CONTA)[number];
  nome: string;
  documento: string | null;
  creci_juridico: string | null;
}

export interface MeuPerfil {
  creci: string | null;
  telefone: string | null;
}

export interface Configuracoes {
  prazo_primeiro_atendimento_min: number;
  dias_cliente_parado: number;
  validade_selecao_dias: number;
  modo_aprovacao_conteudo: (typeof MODOS_APROVACAO)[number];
  janela_aprovacao_horas: number;
  /** Horas antes da visita para lembrar o corretor; 0 desliga. */
  lembrete_visita_horas: number;
}

export const CONFIGURACOES_PADRAO: Configuracoes = {
  prazo_primeiro_atendimento_min: 5,
  dias_cliente_parado: 7,
  validade_selecao_dias: 14,
  modo_aprovacao_conteudo: 'manual',
  janela_aprovacao_horas: 24,
  lembrete_visita_horas: 24,
};

const texto = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const opcional = (v: unknown): string | null => texto(v) || null;

/** Campo de texto mandado com outro tipo (número, objeto) é erro, não "vazio" — senão apagaria o dado. */
function exigirTexto(corpo: Record<string, unknown>, campos: string[], erros: string[]) {
  for (const c of campos) {
    const v = corpo[c];
    if (v !== undefined && v !== null && typeof v !== 'string') erros.push(`O campo ${c} deve ser texto.`);
  }
}

/** CRECI no formato `UF-nnnnn-F` (pessoa física) ou `-J` (jurídica). Aceita minúsculas e espaços. */
export function normalizarCreci(v: unknown): string | null {
  const bruto = texto(v).toUpperCase().replace(/\s+/g, '');
  return bruto || null;
}

export function creciValido(creci: string): boolean {
  return /^[A-Z]{2}-[0-9]{1,6}-[FJ]$/.test(creci);
}

/**
 * Telefone em E.164. Número sem `+` é tratado como brasileiro (DDI 55). Devolve `null` para vazio
 * e o texto normalizado (que pode ser inválido) para o resto — quem decide é `telefoneValido`.
 */
export function normalizarTelefone(v: unknown): string | null {
  const bruto = texto(v);
  if (!bruto) return null;
  if (bruto.startsWith('+')) return `+${bruto.replace(/[^0-9]/g, '')}`;
  // Zero de tronco antes do DDD ("061…") é hábito comum no Brasil e não faz parte do número.
  const digitos = bruto.replace(/[^0-9]/g, '').replace(/^0+/, '');
  return digitos.startsWith('55') && digitos.length >= 12 ? `+${digitos}` : `+55${digitos}`;
}

/** E.164; no Brasil (+55), DDD sem zero e 8 ou 9 dígitos depois dele (10 ou 11 no total). */
export function telefoneValido(tel: string): boolean {
  if (tel.startsWith('+55')) return /^\+55[1-9][1-9][0-9]{8,9}$/.test(tel);
  return /^\+[1-9][0-9]{7,14}$/.test(tel);
}

export function validarPerfilConta(corpo: Record<string, unknown>): Resultado<PerfilConta> {
  const erros: string[] = [];
  exigirTexto(corpo, ['nome', 'tipo', 'documento', 'creci_juridico'], erros);
  const nome = texto(corpo.nome);
  if (!nome) erros.push('Informe o nome da conta.');
  if (nome.length > 200) erros.push('O nome da conta tem no máximo 200 caracteres.');
  const tipo = texto(corpo.tipo) || 'corretor_autonomo';
  if (!(TIPOS_CONTA as readonly string[]).includes(tipo)) erros.push('Tipo de conta inválido.');
  const documento = opcional(corpo.documento);
  if (documento && documento.length > 20) erros.push('O documento tem no máximo 20 caracteres.');
  const creci_juridico = normalizarCreci(corpo.creci_juridico);
  if (creci_juridico && creci_juridico.length > 20) erros.push('O CRECI jurídico tem no máximo 20 caracteres.');
  if (erros.length) return { ok: false, erros };
  return { ok: true, dados: { tipo: tipo as PerfilConta['tipo'], nome, documento, creci_juridico } };
}

export function validarMeuPerfil(corpo: Record<string, unknown>): Resultado<MeuPerfil> {
  const erros: string[] = [];
  exigirTexto(corpo, ['creci', 'telefone'], erros);
  const creci = normalizarCreci(corpo.creci);
  if (creci && !creciValido(creci)) erros.push('CRECI no formato UF-número-F (ex.: DF-12345-F) ou -J para pessoa jurídica.');
  const telefone = normalizarTelefone(corpo.telefone);
  if (telefone && !telefoneValido(telefone)) erros.push('Telefone inválido. Use DDD e número, ex.: (61) 99999-9999.');
  if (erros.length) return { ok: false, erros };
  return { ok: true, dados: { creci, telefone } };
}

function inteiroEntre(v: unknown, min: number, max: number): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

export function validarConfiguracoes(corpo: Record<string, unknown>): Resultado<Configuracoes> {
  const erros: string[] = [];
  const faixa = (campo: keyof Configuracoes, min: number, max: number, rotulo: string): number => {
    const n = inteiroEntre(corpo[campo], min, max);
    if (n === null) erros.push(`${rotulo}: um número inteiro de ${min} a ${max}.`);
    return n ?? 0;
  };
  const dados: Configuracoes = {
    prazo_primeiro_atendimento_min: faixa('prazo_primeiro_atendimento_min', 1, 1440, 'Prazo de primeiro atendimento (minutos)'),
    dias_cliente_parado: faixa('dias_cliente_parado', 1, 365, 'Dias para considerar o cliente parado'),
    validade_selecao_dias: faixa('validade_selecao_dias', 1, 365, 'Validade da seleção (dias)'),
    modo_aprovacao_conteudo: texto(corpo.modo_aprovacao_conteudo) as Configuracoes['modo_aprovacao_conteudo'],
    janela_aprovacao_horas: faixa('janela_aprovacao_horas', 1, 168, 'Janela de aprovação (horas)'),
    // Sem o campo (e sem valor gravado, que a rota completa antes), vale o padrão.
    lembrete_visita_horas: corpo.lembrete_visita_horas === undefined ? CONFIGURACOES_PADRAO.lembrete_visita_horas : faixa('lembrete_visita_horas', 0, 168, 'Lembrete de visita (horas antes; 0 desliga)'),
  };
  if (!(MODOS_APROVACAO as readonly string[]).includes(dados.modo_aprovacao_conteudo)) {
    erros.push('Modo de aprovação de conteúdo: manual ou por janela.');
  }
  if (erros.length) return { ok: false, erros };
  return { ok: true, dados };
}

/** E-mail simples: o shell revalida no convite; aqui só barra o erro de digitação óbvio. */
export function emailValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
