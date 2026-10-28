import { AVISO_CRECI } from './conta';

// Estúdio de Conteúdo (bloco 8a, spec 9.4, 10.5, D-74). Puro: formatos, objetivos, a validação da
// marca, os textos padrão (quando a IA não está disponível), o pedido à IA, a instrução para outra ferramenta
// e as checagens antes de aprovar. A plataforma não gera imagem (10.6): a arte é montada por modelo.

export const FORMATOS = ['post_1x1', 'post_4x5', 'carrossel', 'story'] as const;
export type Formato = (typeof FORMATOS)[number];
export const ROTULO_FORMATO: Record<Formato, string> = { post_1x1: 'Post quadrado', post_4x5: 'Post retrato', carrossel: 'Carrossel', story: 'Story' };
/** Tamanho em pixels de cada formato (padrão do Instagram). */
export const TAMANHO: Record<Formato, { largura: number; altura: number }> = {
  post_1x1: { largura: 1080, altura: 1080 },
  post_4x5: { largura: 1080, altura: 1350 },
  carrossel: { largura: 1080, altura: 1350 },
  story: { largura: 1080, altura: 1920 },
};
export const MAX_SLIDES = 5;

export const OBJETIVOS = ['novo_imovel', 'baixou_preco', 'vendido', 'visita_aberta', 'destaque'] as const;
export type Objetivo = (typeof OBJETIVOS)[number];
export const ROTULO_OBJETIVO: Record<Objetivo, string> = {
  novo_imovel: 'Novo imóvel',
  baixou_preco: 'Baixou o preço',
  vendido: 'Vendido',
  visita_aberta: 'Visita aberta',
  destaque: 'Destaque',
};
/** Selo que a arte mostra no canto, por objetivo. */
export const SELO: Record<Objetivo, string | null> = { novo_imovel: 'NOVIDADE', baixou_preco: 'BAIXOU O PREÇO', vendido: 'VENDIDO', visita_aberta: 'VISITA ABERTA', destaque: null };

export const ESTILOS = ['moderno', 'classico', 'minimalista'] as const;
export const ESTADOS_PECA = ['rascunho', 'aprovada', 'agendada', 'publicando', 'publicada', 'rejeitada', 'erro'] as const;

type Resultado<T> = { ok: true; dados: T } | { ok: false; erros: string[] };
const HEX = /^#[0-9a-fA-F]{6}$/;

export interface DadosMarca {
  cor_primaria: string;
  cor_secundaria: string;
  estilo: string;
  assinatura: string | null;
}

/** A marca até o corretor salvar a dele (os mesmos padrões de `marca_conta` no schema). */
export const MARCA_PADRAO = { cor_primaria: '#0b5394', cor_secundaria: '#f2b705', estilo: 'moderno' } as const;

export function validarMarca(corpo: Record<string, unknown>): Resultado<DadosMarca> {
  const erros: string[] = [];
  const cor = (v: unknown, nome: string) => {
    const t = typeof v === 'string' ? v.trim() : '';
    if (!HEX.test(t)) erros.push(`${nome}: use uma cor no formato #RRGGBB.`);
    return t.toLowerCase();
  };
  const primaria = cor(corpo.cor_primaria, 'Cor principal');
  const secundaria = cor(corpo.cor_secundaria, 'Cor de apoio');
  const estilo = (ESTILOS as readonly string[]).includes(corpo.estilo as string) ? (corpo.estilo as string) : null;
  if (!estilo) erros.push('Escolha um estilo.');
  const assinatura = typeof corpo.assinatura === 'string' ? corpo.assinatura.trim().slice(0, 60) || null : null;
  if (erros.length) return { ok: false, erros };
  return { ok: true, dados: { cor_primaria: primaria, cor_secundaria: secundaria, estilo: estilo!, assinatura } };
}

/** Só o que pode aparecer num anúncio: nunca proprietário, comissão nem endereço além da preferência. */
export interface ImovelArte {
  codigo: string;
  titulo: string | null;
  tipo: string;
  preco_c: number | null;
  bairro: string | null;
  cidade: string | null;
  quartos: number | null;
  suites: number | null;
  vagas: number | null;
  area_m2: number | null;
  caracteristicas: string[];
}

export function imovelParaArte(im: Record<string, any>): ImovelArte {
  const nivel = im.endereco_publico ?? 'bairro';
  return {
    codigo: im.codigo,
    titulo: im.titulo ?? null,
    tipo: im.tipo,
    preco_c: im.preco_c ?? null,
    bairro: nivel === 'regiao' ? null : (im.bairro ?? null),
    cidade: im.cidade ?? null,
    quartos: im.quartos ?? null,
    suites: im.suites ?? null,
    vagas: im.vagas ?? null,
    area_m2: im.area_util_m2 ?? im.area_total_m2 ?? null,
    caracteristicas: Array.isArray(im.caracteristicas) ? im.caracteristicas.map(String).slice(0, 12) : [],
  };
}

export const reaisCurto = (c: number | null | undefined) => (c ? (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) : null);
const ROTULO_TIPO: Record<string, string> = { apartamento: 'Apartamento', casa: 'Casa', lote: 'Lote', sala: 'Sala', loja: 'Loja', galpao: 'Galpão', rural: 'Imóvel rural', outro: 'Imóvel' };

export interface TextosPeca {
  titulo: string;
  chamada: string;
  destaques: string[];
  legenda: string;
  hashtags: string[];
}

const hashtag = (s: string) => `#${s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]/g, '').toLowerCase()}`;

/** Textos montados sem IA (a IA indisponível não para o Estúdio). */
export function textosPadrao(im: ImovelArte | null, objetivo: Objetivo, creci: string | null): TextosPeca {
  const tipo = im ? (ROTULO_TIPO[im.tipo] ?? 'Imóvel') : 'Imóveis';
  const onde = im ? [im.bairro, im.cidade].filter(Boolean).join(', ') : '';
  const destaques = im
    ? [im.area_m2 ? `${im.area_m2} m²` : null, im.quartos ? `${im.quartos} quarto${im.quartos > 1 ? 's' : ''}` : null, im.suites ? `${im.suites} suíte${im.suites > 1 ? 's' : ''}` : null, im.vagas ? `${im.vagas} vaga${im.vagas > 1 ? 's' : ''}` : null]
        .filter((x): x is string => !!x)
        .slice(0, 4)
    : [];
  const chamadas: Record<Objetivo, string> = {
    novo_imovel: 'Acabou de chegar. Agende sua visita.',
    baixou_preco: 'Preço novo. Vale conhecer agora.',
    vendido: 'Mais uma família realizada.',
    visita_aberta: 'Venha conhecer: visita aberta.',
    destaque: 'Fale comigo e agende sua visita.',
  };
  const titulo = (im?.titulo || `${tipo}${onde ? ` em ${onde}` : ''}`).slice(0, 70);
  const preco = im ? reaisCurto(im.preco_c) : null;
  const legenda = [
    `${SELO[objetivo] ? `${SELO[objetivo]}: ` : ''}${titulo}.`,
    destaques.length ? destaques.join(' · ') + '.' : null,
    preco && objetivo !== 'vendido' ? `Valor: ${preco}.` : null,
    chamadas[objetivo],
    creci ? `CRECI ${creci}` : null,
  ]
    .filter(Boolean)
    .join('\n');
  const tags = ['imoveis', 'corretordeimoveis', im?.bairro, im?.cidade, im ? (ROTULO_TIPO[im.tipo] ?? '') : ''].filter((x): x is string => !!x).map(hashtag);
  return { titulo, chamada: chamadas[objetivo], destaques, legenda, hashtags: [...new Set(tags)].slice(0, 8) };
}

export const SCHEMA_PECA = {
  type: 'object',
  properties: {
    titulo: { type: 'string', default: '' },
    chamada: { type: 'string', default: '' },
    destaques: { type: 'array', items: { type: 'string' }, default: [] },
    legenda: { type: 'string', default: '' },
    hashtags: { type: 'array', items: { type: 'string' }, default: [] },
  },
};

export const INSTRUCAO_PECA =
  'Você escreve textos para uma peça de Instagram de um corretor de imóveis no Brasil, em português do Brasil. ' +
  'Use só os dados informados: não invente metragem, cômodos, itens, vizinhança, preço nem condições. ' +
  'Nunca cite endereço além do bairro e da cidade, proprietário, comissão ou dado de cliente. Sem linguagem discriminatória e sem promessas ' +
  '(como "valorização garantida"). Siga o pedido do corretor no tom. titulo: até 60 caracteres. chamada: até 80 caracteres. ' +
  'destaques: de 2 a 4 itens curtos (até 24 caracteres cada). legenda: de 300 a 900 caracteres, em parágrafos curtos, terminando com um convite para conversar. ' +
  'hashtags: de 4 a 8, sem o símbolo #, locais quando houver bairro ou cidade.';

/** O que a IA recebe: o pedido e só os dados públicos do imóvel. */
export function contextoPeca(pedido: string, im: ImovelArte | null, objetivo: Objetivo, formato: Formato): string {
  return [
    `Pedido do corretor: ${pedido.slice(0, 1000) || '(sem pedido, use o objetivo)'}`,
    `Objetivo da peça: ${ROTULO_OBJETIVO[objetivo]}`,
    `Formato: ${ROTULO_FORMATO[formato]}`,
    im ? `Imóvel: ${ROTULO_TIPO[im.tipo] ?? 'Imóvel'}${im.titulo ? ` — ${im.titulo}` : ''}` : 'Peça institucional, sem imóvel.',
    im ? `Localização: ${[im.bairro, im.cidade].filter(Boolean).join(', ') || 'não informada'}` : null,
    im?.preco_c && objetivo !== 'vendido' ? `Preço: ${reaisCurto(im.preco_c)}` : null,
    im?.area_m2 ? `Área: ${im.area_m2} m²` : null,
    im?.quartos ? `Quartos: ${im.quartos}${im.suites ? ` (${im.suites} suíte${im.suites > 1 ? 's' : ''})` : ''}` : null,
    im?.vagas ? `Vagas: ${im.vagas}` : null,
    im?.caracteristicas.length ? `Diferenciais: ${im.caracteristicas.join(', ')}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

/** Resposta da IA validada pelo app: corta, limpa e completa com o padrão o que vier vazio. */
export function textosDaIa(bruto: Record<string, unknown>, padrao: TextosPeca): TextosPeca {
  const t = (v: unknown, limite: number) => (typeof v === 'string' ? v.trim().slice(0, limite) : '');
  const lista = (v: unknown, n: number, limite: number) => (Array.isArray(v) ? v.map((x) => t(x, limite)).filter(Boolean).slice(0, n) : []);
  const destaques = lista(bruto.destaques, 4, 24);
  const hashtags = lista(bruto.hashtags, 8, 40).map((h) => hashtag(h.replace(/^#/, ''))).filter((h) => h.length > 1);
  return {
    titulo: t(bruto.titulo, 60) || padrao.titulo,
    chamada: t(bruto.chamada, 80) || padrao.chamada,
    destaques: destaques.length ? destaques : padrao.destaques,
    legenda: t(bruto.legenda, 2000) || padrao.legenda,
    hashtags: hashtags.length ? [...new Set(hashtags)] : padrao.hashtags,
  };
}

export interface MarcaPeca {
  nome: string;
  creci: string | null;
  cor_primaria: string;
  cor_secundaria: string;
  estilo: string;
  assinatura: string | null;
}

export const FERRAMENTAS = ['canva', 'claude_design', 'outra'] as const;
export type Ferramenta = (typeof FERRAMENTAS)[number];
/** Máximo de referências do corretor guardadas na marca (e listadas numa instrução). */
export const MAX_REFERENCIAS = 6;

/**
 * Onde a instrução vai e o link para abrir a ferramenta. O app não se conecta a nenhuma (D-74, D-86):
 * a escolha muda só o texto. Claude Design e "outra" não têm link: o corretor abre a ferramenta dele.
 */
export const FERRAMENTA: Record<Ferramenta, { rotulo: string; onde: string; abrir: string | null }> = {
  canva: { rotulo: 'Canva', onde: 'Cole no "O que vamos criar hoje?" do Canva IA.', abrir: 'https://www.canva.com/ai' },
  claude_design: { rotulo: 'Claude Design', onde: 'Cole como pedido no Claude Design e anexe as imagens na mesma mensagem.', abrir: null },
  outra: { rotulo: 'Outra ferramenta', onde: 'Cole na ferramenta de design que você usa (com IA ou não).', abrir: null },
};

export const ferramentaValida = (v: unknown): Ferramenta => ((FERRAMENTAS as readonly string[]).includes(v as string) ? (v as Ferramenta) : 'canva');

/**
 * Descrição da arte (D-74, D-86, D-89, D-90, D-91): o texto que o corretor cola no Canva IA (ou em
 * outra ferramenta), em blocos fixos (o que é, texto da arte, fotos, slides, visual, referências, o
 * que não fazer). Mista: as instruções vão em inglês, que as ferramentas de IA seguem com mais
 * precisão, e o texto que aparece na arte vai em português do Brasil, entre aspas, para não ser
 * traduzido. As fotos e o logo vão anexados à parte; as referências entram por link.
 */
export function promptFerramenta(
  ferramenta: Ferramenta,
  p: { formato: Formato; objetivo: Objetivo; textos: TextosPeca; fotos: number; referencias?: string[]; logo?: boolean },
  marca: MarcaPeca,
  im: ImovelArte | null,
): string {
  const tam = TAMANHO[p.formato];
  const refs = p.referencias ?? [];
  const slides = Math.min(Math.max(p.fotos, 2), MAX_SLIDES);
  const peca = p.formato === 'carrossel' ? `Instagram carousel with ${slides} slides` : p.formato === 'story' ? 'Instagram story' : 'Instagram post';
  const preco = im?.preco_c && p.objetivo !== 'vendido' ? reaisCurto(im.preco_c) : null;
  const local = im ? [im.bairro, im.cidade].filter(Boolean).join(', ') : '';
  const rodape = [marca.nome, marca.creci ? `CRECI ${marca.creci}` : null, marca.assinatura].filter(Boolean).join(' · ');
  const item = (rotulo: string, valor: string | null | undefined) => (valor ? `- ${rotulo}: "${valor}"` : null);
  const linhas: (string | null)[] = [
    `${peca}, ${tam.largura} x ${tam.altura} px, for a real estate agent in Brazil.`,
    '',
    'TEXT ON THE ART (keep exactly as written, in Brazilian Portuguese; do not translate and do not add other text):',
    item('Badge', SELO[p.objetivo]),
    item('Title', p.textos.titulo),
    item('Highlights', p.textos.destaques.join(' · ')),
    item('Price', preco),
    item('Location', local),
    item('Call to action', p.textos.chamada),
    item('Footer', rodape),
    '',
    'PHOTOS:',
    !p.fotos
      ? '- There is no photo of the property: use a background with the brand colors and simple shapes, with no photo that looks like the property.'
      : p.formato === 'carrossel'
        ? `- Use the ${p.fotos} attached photos of the property, one per slide, in the order sent.`
        : p.fotos === 1
          ? '- Use the attached photo of the property as the main image.'
          : `- Use the first of the ${p.fotos} attached photos as the main image; the others only as support, if they fit.`,
    p.fotos ? '- Do not alter the photos: no furniture, rooms, views or finishes the property does not have.' : null,
  ];
  if (p.formato === 'carrossel') {
    linhas.push('', 'SLIDES:', '1. Cover: main photo, badge, title, price and location.');
    for (let i = 2; i < slides; i++) linhas.push(`${i}. One photo with one highlight in large type.`);
    linhas.push(`${slides}. Closing: call to action and footer in focus, with the logo.`);
  }
  linhas.push(
    '',
    'VISUAL:',
    `- ${ROTULO_ESTILO_EN[marca.estilo] ?? marca.estilo} style. Primary color ${marca.cor_primaria}, accent color ${marca.cor_secundaria}.`,
    '- Large title, easy to read on a phone; highlight the price; at most two fonts.',
    p.logo ? '- Place the attached logo in the bottom corner, without distortion.' : null,
    p.formato === 'story' ? "- Keep about 250 px free at the top and bottom (Instagram's button area)." : null,
    ferramenta === 'canva' ? null : `- Deliver the final art as JPG or PNG, exactly ${tam.largura} x ${tam.altura} px${p.formato === 'carrossel' ? ', one image per slide' : ''}.`,
  );
  if (refs.length) linhas.push('', 'STYLE REFERENCES (inspiration for composition and mood; do not copy their text, photos or brands):', ...refs.map((u, i) => `${i + 1}. ${u}`));
  linhas.push('', 'DO NOT:', '- Full address, third-party phone numbers, owner names or promises of appreciation.', '- Any text other than the one listed above.');
  return linhas.filter((l) => l !== null).join('\n');
}

const ROTULO_ESTILO_EN: Record<string, string> = { moderno: 'Modern', classico: 'Classic', minimalista: 'Minimalist' };

/** Limite da legenda no Instagram, contando as hashtags (mesmo separador da publicação). */
export const LIMITE_LEGENDA = 2200;

export const AVISO_CRECI_NAO_COUBE = 'O CRECI não coube na legenda (limite de 2.200 caracteres do Instagram): confira se ele está na arte.';

/** Legenda e hashtags como vão ao Instagram: legenda, linha em branco, hashtags. */
export function textoPublicado(legenda: string | null, hashtags: string | null): string {
  return [legenda ?? '', hashtags ?? ''].filter(Boolean).join('\n\n');
}

/**
 * CRECI na legenda (10.5), só se couber (D-93): a arte pode vir sem ele, então a legenda o leva
 * quando há espaço. Se não couber no limite, a legenda fica como está e volta um aviso, nunca uma
 * pendência. Legenda que já cita o CRECI não ganha outro.
 */
export function legendaComCreci(legenda: string | null, hashtags: string | null, creci: string | null): { legenda: string; aviso: string | null } {
  const atual = legenda ?? '';
  if (!creci || atual.includes(creci)) return { legenda: atual, aviso: null };
  const com = [atual, `CRECI ${creci}`].filter(Boolean).join('\n\n');
  if (textoPublicado(com, hashtags).length > LIMITE_LEGENDA) return { legenda: atual, aviso: AVISO_CRECI_NAO_COUBE };
  return { legenda: com, aviso: null };
}

export interface Checagem {
  ok: boolean;
  pendencias: string[];
  /** Lembretes que não impedem aprovar nem publicar (D-89, D-93: o CRECI nunca trava nada). */
  avisos: string[];
}

/**
 * Checagens antes de aprovar (10.5): autorização vigente, arte pronta, legenda dentro do limite do
 * canal. O CRECI sem cadastro vira aviso, nunca pendência (D-89, D-93).
 */
export function checarPeca(p: { formato: string; legenda: string | null; hashtags: string | null; arquivos: number; objetivo: string }, ctx: { creci: string | null; imovel: boolean; autorizacaoVigente: boolean }): Checagem {
  const pendencias: string[] = [];
  const avisos: string[] = [];
  if (!ctx.creci) avisos.push(AVISO_CRECI);
  if (ctx.imovel && p.objetivo !== 'vendido' && !ctx.autorizacaoVigente) pendencias.push('O imóvel precisa de autorização de venda vigente para ser anunciado.');
  if (!p.arquivos) pendencias.push('Envie a arte feita no Canva (ou em outra ferramenta) antes de aprovar.');
  if (p.formato === 'carrossel' && p.arquivos === 1) pendencias.push('O carrossel precisa de pelo menos 2 imagens.');
  if (textoPublicado(p.legenda, p.hashtags).length > LIMITE_LEGENDA) pendencias.push('A legenda passa de 2.200 caracteres (limite do Instagram).');
  if ((p.hashtags ?? '').split(/\s+/).filter((h) => h.startsWith('#')).length > 30) pendencias.push('Mais de 30 hashtags (limite do Instagram).');
  return { ok: !pendencias.length, pendencias, avisos };
}
