// Regras puras de imóveis, autorizações, empreendimentos e visitas (bloco 3). Sem I/O.
import type { Resultado } from './conta';
import { reaisParaCentavos } from './crm';

export const TIPOS_IMOVEL = ['casa', 'apartamento', 'lote', 'sala', 'loja', 'galpao', 'rural', 'outro'] as const;
export const SITUACOES_IMOVEL = ['rascunho', 'captacao', 'ativo', 'reservado', 'vendido', 'suspenso', 'encerrado'] as const;
export const TIPOS_MIDIA = ['foto', 'video', 'planta', 'tour', 'documento'] as const;
export const SITUACOES_AUTORIZACAO = ['rascunho', 'enviada', 'assinada', 'vencida', 'revogada'] as const;
export const TIPOS_EMPREENDIMENTO = ['loteamento', 'vertical', 'horizontal'] as const;
export const FASES_EMPREENDIMENTO = ['lancamento', 'obras', 'pronto'] as const;
export const TIPOS_MATERIAL = ['planta', 'tabela', 'memorial', 'book', 'outro'] as const;
export const AMBIENTES = ['fachada', 'sala', 'cozinha', 'quarto', 'banheiro', 'varanda', 'area_lazer', 'vista', 'garagem', 'planta', 'outro'] as const;

/** Situações que exigem autorização de venda vigente: anúncio só dentro dela (spec 6.3). */
export const SITUACOES_ANUNCIADAS = ['ativo', 'reservado'];
/** Tipos em que quartos e banheiros não contam para a qualidade. */
const SEM_COMODOS = ['lote', 'galpao', 'rural', 'sala', 'loja'];

const texto = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const opcional = (v: unknown, limite: number): string | null => texto(v).slice(0, limite) || null;
const umDe = (v: unknown, lista: readonly string[]) => (typeof v === 'string' && lista.includes(v) ? v : null);

/** Número que chega como 120, "120", "120,5" ou "1.200,50". */
export function numero(v: unknown): number | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
  const t = String(v).trim();
  if (!/\d/.test(t)) return NaN;
  const n = Number(t.replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}

export interface DadosImovel {
  codigo?: string;
  titulo: string | null;
  tipo: string;
  finalidade: string;
  preco_c: number | null;
  condominio_c: number | null;
  iptu_anual_c: number | null;
  area_util_m2: number | null;
  area_total_m2: number | null;
  quartos: number | null;
  suites: number | null;
  banheiros: number | null;
  vagas: number | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  endereco: Record<string, string> | null;
  endereco_publico: string;
  caracteristicas: string | null;
  descricao: string | null;
}

/**
 * Imóvel novo ou editado. Em edição (`parcial`), só os campos presentes entram. Dinheiro chega em
 * reais e sai em centavos; situação, publicação, proprietário e empreendimento têm regra própria
 * na rota (dependem de outras linhas) e não passam por aqui.
 */
export function validarImovel(corpo: Record<string, unknown>, parcial = false): Resultado<Partial<DadosImovel>> {
  const erros: string[] = [];
  const tem = (c: string) => !parcial || c in corpo;
  const d: Partial<DadosImovel> = {};
  if ('codigo' in corpo && texto(corpo.codigo)) {
    d.codigo = texto(corpo.codigo).toUpperCase().slice(0, 20);
    if (!/^[A-Z0-9][A-Z0-9-]*$/.test(d.codigo)) erros.push('Código: use letras, números e hífen.');
  }
  if (tem('titulo')) d.titulo = opcional(corpo.titulo, 120);
  if (tem('tipo')) {
    const t = umDe(corpo.tipo, TIPOS_IMOVEL);
    if (!t) erros.push('Escolha o tipo do imóvel.');
    else d.tipo = t;
  }
  if (tem('finalidade')) {
    const f = corpo.finalidade === undefined || corpo.finalidade === '' ? 'venda' : umDe(corpo.finalidade, ['venda', 'venda_e_locacao']);
    if (!f) erros.push('Finalidade inválida.');
    else d.finalidade = f;
  }
  for (const [campo, rotulo] of [['preco', 'Preço'], ['condominio', 'Condomínio'], ['iptu_anual', 'IPTU anual']] as const) {
    if (!(campo in corpo)) continue;
    const c = reaisParaCentavos(corpo[campo]);
    if (Number.isNaN(c)) erros.push(`${rotulo} inválido.`);
    else d[`${campo}_c`] = c ?? null;
  }
  for (const [campo, rotulo] of [['area_util_m2', 'Área útil'], ['area_total_m2', 'Área total']] as const) {
    if (!(campo in corpo)) continue;
    const n = numero(corpo[campo]);
    if (Number.isNaN(n) || (n !== null && n !== undefined && (n < 0 || n > 99_999_999))) erros.push(`${rotulo} inválida.`);
    else d[campo] = n === null || n === undefined ? null : Math.round(n * 100) / 100;
  }
  for (const campo of ['quartos', 'suites', 'banheiros', 'vagas'] as const) {
    if (!(campo in corpo)) continue;
    const n = numero(corpo[campo]);
    if (Number.isNaN(n) || (n !== null && n !== undefined && (!Number.isInteger(n) || n < 0 || n > 99))) erros.push(`${campo}: número inteiro de 0 a 99.`);
    else d[campo] = n ?? null;
  }
  if (tem('bairro')) d.bairro = opcional(corpo.bairro, 80);
  if (tem('cidade')) d.cidade = opcional(corpo.cidade, 80);
  if (tem('uf')) {
    d.uf = texto(corpo.uf).toUpperCase() || null;
    if (d.uf && !/^[A-Z]{2}$/.test(d.uf)) erros.push('UF: duas letras.');
  }
  if ('endereco' in corpo) {
    const e = (corpo.endereco ?? {}) as Record<string, unknown>;
    const limpo: Record<string, string> = {};
    for (const k of ['logradouro', 'numero', 'complemento', 'cep']) {
      const v = opcional(e[k], 120);
      if (v) limpo[k] = v;
    }
    d.endereco = Object.keys(limpo).length ? limpo : null;
  }
  if (tem('endereco_publico')) {
    const ep = corpo.endereco_publico === undefined || corpo.endereco_publico === '' ? 'bairro' : umDe(corpo.endereco_publico, ['completo', 'bairro', 'regiao']);
    if (!ep) erros.push('Endereço público inválido.');
    else d.endereco_publico = ep;
  }
  if ('caracteristicas' in corpo) {
    const lista = Array.isArray(corpo.caracteristicas) ? corpo.caracteristicas : texto(corpo.caracteristicas).split(/[,;\n]/);
    const itens = [...new Set(lista.map((x) => texto(x).slice(0, 60)).filter(Boolean))].slice(0, 40);
    d.caracteristicas = itens.length ? itens.join(', ') : null;
  }
  if ('descricao' in corpo) d.descricao = typeof corpo.descricao === 'string' ? corpo.descricao.trim().slice(0, 8000) || null : null;
  if (!parcial && !d.cidade) erros.push('Informe a cidade.');
  if (erros.length) return { ok: false, erros };
  return { ok: true, dados: d };
}

export interface Autorizacao {
  situacao: string;
  inicio: string;
  fim: string;
  documento_midia_id: number | null;
}

/** Situação mostrada: a assinada cujo fim já passou aparece como vencida (calculada na leitura). */
export function situacaoAutorizacao(a: Autorizacao, hoje: string): string {
  return a.situacao === 'assinada' && a.fim < hoje ? 'vencida' : a.situacao;
}

/** Vigente: assinada, com documento anexado e com hoje dentro de início e fim. */
export function autorizacaoVigente(a: Autorizacao, hoje: string): boolean {
  return a.situacao === 'assinada' && !!a.documento_midia_id && a.inicio <= hoje && hoje <= a.fim;
}

export function validarAutorizacao(corpo: Record<string, unknown>, parcial = false): Resultado<Record<string, unknown>> {
  const erros: string[] = [];
  const tem = (c: string) => !parcial || c in corpo;
  const d: Record<string, unknown> = {};
  const data = (c: string, rotulo: string) => {
    const t = texto(corpo[c]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t) || Number.isNaN(new Date(`${t}T12:00:00Z`).getTime())) erros.push(`${rotulo}: data inválida.`);
    else d[c] = t;
  };
  if (tem('inicio')) data('inicio', 'Início');
  if (tem('fim')) data('fim', 'Fim');
  if (d.inicio && d.fim && (d.fim as string) < (d.inicio as string)) erros.push('O fim vem depois do início.');
  if (tem('comissao_pct')) {
    const n = numero(corpo.comissao_pct);
    if (n === null || n === undefined || Number.isNaN(n) || n < 0 || n > 100) erros.push('Comissão: de 0 a 100%.');
    else d.comissao_pct = Math.round(n * 100) / 100;
  }
  if (tem('preco_autorizado')) {
    const c = reaisParaCentavos(corpo.preco_autorizado);
    if (c === null || c === undefined || Number.isNaN(c)) erros.push('Informe o preço autorizado.');
    else d.preco_autorizado_c = c;
  }
  for (const b of ['exclusiva', 'permite_parceria', 'permite_placa', 'permite_portais']) {
    if (b in corpo) d[b] = corpo[b] === true || corpo[b] === 'true';
  }
  if ('situacao' in corpo) {
    const s = umDe(corpo.situacao, ['rascunho', 'enviada', 'assinada', 'revogada']);
    if (!s) erros.push('Situação da autorização inválida.');
    else d.situacao = s;
  }
  if (erros.length) return { ok: false, erros };
  return { ok: true, dados: d };
}

export function validarEmpreendimento(corpo: Record<string, unknown>, parcial = false): Resultado<Record<string, unknown>> {
  const erros: string[] = [];
  const tem = (c: string) => !parcial || c in corpo;
  const d: Record<string, unknown> = {};
  if (tem('nome')) {
    d.nome = texto(corpo.nome).slice(0, 120);
    if (!d.nome) erros.push('Informe o nome do empreendimento.');
  }
  if (tem('tipo')) {
    const t = corpo.tipo === undefined || corpo.tipo === '' ? 'vertical' : umDe(corpo.tipo, TIPOS_EMPREENDIMENTO);
    if (!t) erros.push('Tipo de empreendimento inválido.');
    else d.tipo = t;
  }
  if (tem('fase')) {
    const f = corpo.fase === undefined || corpo.fase === '' ? 'lancamento' : umDe(corpo.fase, FASES_EMPREENDIMENTO);
    if (!f) erros.push('Fase inválida.');
    else d.fase = f;
  }
  for (const [c, lim] of [['construtora', 120], ['cidade', 80], ['regiao', 80], ['endereco', 300]] as const) if (tem(c)) d[c] = opcional(corpo[c], lim);
  for (const c of ['descricao', 'tipologias']) if (c in corpo) d[c] = typeof corpo[c] === 'string' ? (corpo[c] as string).trim() || null : null;
  for (const c of ['preco_min', 'preco_max']) {
    if (!(c in corpo)) continue;
    const v = reaisParaCentavos(corpo[c]);
    if (Number.isNaN(v)) erros.push('Faixa de preço inválida.');
    else d[`${c}_c`] = v ?? null;
  }
  if (typeof d.preco_min_c === 'number' && typeof d.preco_max_c === 'number' && d.preco_max_c < d.preco_min_c) erros.push('O preço máximo vem depois do mínimo.');
  if (erros.length) return { ok: false, erros };
  return { ok: true, dados: d };
}

export interface Qualidade {
  nota: number;
  faltas: string[];
}

/**
 * Qualidade do anúncio, 0 a 100 (spec 6.12). Derivada, nunca gravada. `faltas` diz o que falta,
 * na ordem do peso, para a ficha mostrar "o que falta".
 */
export function qualidadeAnuncio(
  im: Partial<DadosImovel> & { tipo?: string },
  extras: { fotosPublicas: number; autorizacaoVigente: boolean; creci: boolean },
): Qualidade {
  const itens: [boolean, number, string][] = [
    [extras.fotosPublicas >= 8, 25, `Pelo menos 8 fotos públicas (tem ${extras.fotosPublicas})`],
    [(im.descricao ?? '').length >= 400, 15, 'Descrição com pelo menos 400 caracteres'],
    [typeof im.preco_c === 'number' && im.preco_c > 0, 15, 'Preço informado'],
    [
      (im.area_util_m2 ?? im.area_total_m2 ?? null) !== null &&
        (SEM_COMODOS.includes(im.tipo ?? '') || (im.quartos !== null && im.quartos !== undefined && im.banheiros !== null && im.banheiros !== undefined)),
      10,
      'Área e cômodos (quartos e banheiros)',
    ],
    [!!im.bairro && !!im.cidade, 10, 'Localização (bairro e cidade)'],
    [extras.autorizacaoVigente, 15, 'Autorização de venda assinada e vigente'],
    [extras.creci, 10, 'CRECI preenchido em Conta e marca'],
  ];
  return {
    nota: itens.reduce((s, [ok, peso]) => s + (ok ? peso : 0), 0),
    faltas: itens.filter(([ok]) => !ok).sort((a, b) => b[1] - a[1]).map(([, , f]) => f),
  };
}

/** Ordem de apresentação das fotos: capa primeiro, depois ambientes na sequência de uma visita. */
const SEQUENCIA_AMBIENTES: string[] = ['fachada', 'sala', 'varanda', 'cozinha', 'quarto', 'banheiro', 'area_lazer', 'vista', 'garagem', 'outro', 'planta'];
const CAPAS = ['fachada', 'sala', 'vista', 'area_lazer', 'varanda'];

export interface MidiaOrdenavel {
  id: number;
  tipo: string;
  ordem: number;
  ia_ambiente: string | null;
  ia_nota: number | null;
}

/**
 * Sugere a ordem das mídias a partir da leitura das fotos: a melhor foto de um ambiente de capa
 * vai primeiro; as outras fotos seguem a sequência de uma visita e, dentro do ambiente, a nota;
 * fotos sem leitura mantêm a ordem atual depois das lidas; vídeo, planta, tour e documento no fim.
 */
export function sugerirOrdem(midias: MidiaOrdenavel[]): number[] {
  const fotos = midias.filter((m) => m.tipo === 'foto');
  const lidas = fotos.filter((m) => m.ia_ambiente);
  const semLeitura = fotos.filter((m) => !m.ia_ambiente).sort((a, b) => a.ordem - b.ordem);
  const nota = (m: MidiaOrdenavel) => m.ia_nota ?? 0;
  const capa = [...lidas].filter((m) => CAPAS.includes(m.ia_ambiente!)).sort((a, b) => nota(b) - nota(a) || a.ordem - b.ordem)[0];
  const pos = (m: MidiaOrdenavel) => {
    const i = SEQUENCIA_AMBIENTES.indexOf(m.ia_ambiente!);
    return i < 0 ? SEQUENCIA_AMBIENTES.length : i;
  };
  const resto = lidas.filter((m) => m !== capa).sort((a, b) => pos(a) - pos(b) || nota(b) - nota(a) || a.ordem - b.ordem);
  const outras = midias.filter((m) => m.tipo !== 'foto').sort((a, b) => a.ordem - b.ordem);
  return [...(capa ? [capa] : []), ...resto, ...semLeitura, ...outras].map((m) => m.id);
}

/** Próximo código automático `IM-0001` a partir dos códigos existentes. */
export function proximoCodigo(existentes: string[]): string {
  const maior = existentes.reduce((m, c) => {
    const r = /^IM-(\d+)$/.exec(c);
    return r ? Math.max(m, Number(r[1])) : m;
  }, 0);
  return `IM-${String(maior + 1).padStart(4, '0')}`;
}

/** Schema da leitura de uma foto pela IA (slot `fotos`). */
export const SCHEMA_FOTO = {
  type: 'object',
  properties: {
    ambiente: { type: 'string', enum: [...AMBIENTES], default: 'outro' },
    nota: { type: 'integer', minimum: 0, maximum: 10, default: 5 },
    legenda: { type: 'string', default: '' },
  },
};

export const INSTRUCAO_FOTO =
  'Você analisa uma foto de anúncio de imóvel no Brasil. Diga qual ambiente aparece (ambiente), dê uma nota de 0 a 10 ' +
  'para usar a foto no anúncio (luz, nitidez, enquadramento, ambiente arrumado; pessoas, placas ou dados pessoais visíveis baixam a nota) ' +
  'e escreva uma legenda curta e factual em português, sem exageros (até 100 caracteres).';

/** Schema da descrição gerada (slot `conteudo`). */
export const SCHEMA_DESCRICAO = {
  type: 'object',
  properties: {
    titulo: { type: 'string', default: '' },
    descricao: { type: 'string', default: '' },
    destaques: { type: 'array', items: { type: 'string' }, default: [] },
  },
};

export const INSTRUCAO_DESCRICAO =
  'Você escreve descrições de anúncio de imóvel para um corretor no Brasil, em português do Brasil. Use só os dados informados: ' +
  'não invente metragem, cômodos, itens, vizinhança nem valores. Não cite endereço além do bairro e da cidade, nem nome do proprietário. ' +
  'Sem linguagem discriminatória e sem promessas (como "valorização garantida"). Tom claro e acolhedor. ' +
  'titulo: até 70 caracteres. descricao: de 500 a 1200 caracteres, em parágrafos curtos. destaques: de 3 a 6 itens curtos.';

/** Dados que vão para a IA: só o que pode aparecer num anúncio (nunca proprietário, endereço completo nem comissão). */
export function contextoDescricao(im: Record<string, unknown>, ambientes: string[]): string {
  const linhas = [
    `Tipo: ${im.tipo}`,
    `Finalidade: ${im.finalidade === 'venda_e_locacao' ? 'venda e locação' : 'venda'}`,
    im.titulo ? `Título atual: ${im.titulo}` : null,
    `Localização: ${[im.bairro, im.cidade, im.uf].filter(Boolean).join(', ')}`,
    im.area_util_m2 ? `Área útil: ${im.area_util_m2} m²` : null,
    im.area_total_m2 ? `Área total: ${im.area_total_m2} m²` : null,
    im.quartos !== null && im.quartos !== undefined ? `Quartos: ${im.quartos}` : null,
    im.suites !== null && im.suites !== undefined ? `Suítes: ${im.suites}` : null,
    im.banheiros !== null && im.banheiros !== undefined ? `Banheiros: ${im.banheiros}` : null,
    im.vagas !== null && im.vagas !== undefined ? `Vagas: ${im.vagas}` : null,
    im.caracteristicas ? `Características: ${im.caracteristicas}` : null,
    ambientes.length ? `Ambientes vistos nas fotos: ${[...new Set(ambientes)].join(', ')}` : null,
    im.descricao ? `Descrição atual do corretor (aproveite as informações): ${String(im.descricao).slice(0, 3000)}` : null,
  ];
  return linhas.filter(Boolean).join('\n');
}

/** Não gerar descrição para imóvel sem tipo e área (spec 10.7). */
export function podeGerarDescricao(im: Record<string, unknown>): string | null {
  if (!im.tipo) return 'Informe o tipo do imóvel antes de pedir a descrição.';
  if (im.area_util_m2 == null && im.area_total_m2 == null) return 'Informe a área antes de pedir a descrição.';
  return null;
}
