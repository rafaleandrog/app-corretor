// Minha Página, ficha pública e formulário de contato (bloco 5, spec 6.15, 7.2, 7.3, 11.3).
// Puro: validação da página, o que de um imóvel pode ir a público e a validação do formulário.
import { emailValido, normalizarTelefone, telefoneValido } from './conta';

export const TIPOS_BLOCO = ['apresentacao', 'destaques', 'imoveis', 'sobre', 'bairros', 'formulario', 'contato'] as const;
export type TipoBloco = (typeof TIPOS_BLOCO)[number];

/**
 * As cinco cores que a Minha Página oferecia antes da marca única (D-85). Ficam só para a migração
 * 002 levar a cor antiga para `marca_conta`; a cor pública agora é a da marca.
 */
export const TEMAS: Record<string, { rotulo: string; cor: string }> = {
  oceano: { rotulo: 'Oceano', cor: '#0b5394' },
  mata: { rotulo: 'Mata', cor: '#1e6b52' },
  grafite: { rotulo: 'Grafite', cor: '#33373d' },
  terracota: { rotulo: 'Terracota', cor: '#9c4a26' },
  vinho: { rotulo: 'Vinho', cor: '#7b2333' },
};

export interface Bloco {
  tipo: TipoBloco;
  ativo: boolean;
  titulo?: string | null;
  texto?: string | null;
  codigos?: string[];
  lista?: string[];
  whatsapp?: boolean;
  instagram?: string | null;
}

export const ROTULO_BLOCO: Record<TipoBloco, string> = {
  apresentacao: 'Apresentação',
  destaques: 'Imóveis em destaque',
  imoveis: 'Todos os imóveis',
  sobre: 'Sobre mim',
  bairros: 'Bairros que atendo',
  formulario: 'Formulário de contato',
  contato: 'WhatsApp e Instagram',
};

export function blocosPadrao(): Bloco[] {
  return [
    { tipo: 'apresentacao', ativo: true, titulo: 'Encontre o imóvel certo comigo', texto: null },
    { tipo: 'destaques', ativo: true, titulo: 'Destaques', codigos: [] },
    { tipo: 'imoveis', ativo: true, titulo: 'Imóveis à venda' },
    { tipo: 'sobre', ativo: false, titulo: 'Sobre mim', texto: null },
    { tipo: 'bairros', ativo: false, titulo: 'Onde eu atendo', lista: [] },
    { tipo: 'formulario', ativo: true, titulo: 'Fale comigo' },
    { tipo: 'contato', ativo: true, whatsapp: true, instagram: null },
  ];
}

/** Endereço da página (`?c=<endereco>`): minúsculas, números e hífen. */
export const FORMATO_ENDERECO = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;

/** Sugestão de endereço a partir do nome: "João da Silva" → "joao-da-silva". */
export function sugerirEndereco(nome: string): string {
  const base = nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
  return base.length >= 3 ? base : `corretor-${base || 'novo'}`.slice(0, 40);
}

type Resultado<T> = { ok: true; dados: T } | { ok: false; erros: string[] };

const textoCurto = (v: unknown, limite: number) => (typeof v === 'string' ? v.trim().slice(0, limite) || null : null);

export interface DadosPagina {
  endereco: string;
  nome_exibicao: string;
  blocos: Bloco[];
}

/** Página editada pelo corretor. Os blocos chegam na ordem em que aparecem; tipo repetido ou desconhecido é recusado. */
export function validarPagina(corpo: Record<string, unknown>): Resultado<DadosPagina> {
  const erros: string[] = [];
  const endereco = typeof corpo.endereco === 'string' ? corpo.endereco.trim().toLowerCase() : '';
  if (!FORMATO_ENDERECO.test(endereco)) erros.push('Endereço: de 3 a 40 letras minúsculas, números ou hífen, sem começar nem terminar com hífen.');
  // A cor deixou de ser da página (D-85): `tema` que ainda chegue é ignorado; a coluna fica no schema.
  const nome = textoCurto(corpo.nome_exibicao, 120);
  if (!nome) erros.push('Informe o nome que aparece na página.');
  const lista = Array.isArray(corpo.blocos) ? corpo.blocos : null;
  if (!lista) erros.push('Blocos da página inválidos.');
  const blocos: Bloco[] = [];
  const vistos = new Set<string>();
  for (const b of lista ?? []) {
    const bruto = (b ?? {}) as Record<string, unknown>;
    const tipo = bruto.tipo as TipoBloco;
    if (!(TIPOS_BLOCO as readonly string[]).includes(tipo) || vistos.has(tipo)) {
      erros.push('Bloco repetido ou desconhecido.');
      continue;
    }
    vistos.add(tipo);
    const bloco: Bloco = { tipo, ativo: bruto.ativo !== false };
    if (tipo !== 'contato') bloco.titulo = textoCurto(bruto.titulo, 80);
    if (tipo === 'apresentacao' || tipo === 'sobre') bloco.texto = textoCurto(bruto.texto, 1500);
    if (tipo === 'destaques') {
      bloco.codigos = (Array.isArray(bruto.codigos) ? bruto.codigos : []).filter((c): c is string => typeof c === 'string').map((c) => c.trim()).filter(Boolean).slice(0, 6);
    }
    if (tipo === 'bairros') {
      bloco.lista = (Array.isArray(bruto.lista) ? bruto.lista : []).filter((c): c is string => typeof c === 'string').map((c) => c.trim().slice(0, 60)).filter(Boolean).slice(0, 20);
    }
    if (tipo === 'contato') {
      bloco.whatsapp = bruto.whatsapp !== false;
      const ig = typeof bruto.instagram === 'string' ? bruto.instagram.trim().replace(/^@/, '') : '';
      if (ig && !/^[A-Za-z0-9._]{1,30}$/.test(ig)) erros.push('Instagram: use só o nome de usuário, sem o endereço.');
      bloco.instagram = ig || null;
    }
    blocos.push(bloco);
  }
  // Bloco que faltou entra desligado, no fim: a página sempre tem os sete.
  for (const p of blocosPadrao()) if (!vistos.has(p.tipo)) blocos.push({ ...p, ativo: false });
  if (erros.length) return { ok: false, erros };
  return { ok: true, dados: { endereco, nome_exibicao: nome!, blocos } };
}

export interface FotoPublica {
  arquivo: number;
  legenda: string | null;
}

/**
 * O que de um imóvel vai para a vitrine pública: só dado de anúncio. Nunca proprietário, comissão,
 * autorização nem endereço além do que o corretor liberou em `endereco_publico`.
 */
export function imovelPublico(im: Record<string, any>, midias: Record<string, any>[]) {
  const fotos: FotoPublica[] = midias
    .filter((m) => m.tipo === 'foto' && m.publica && m.arquivo)
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
    .slice(0, 30)
    .map((m) => ({ arquivo: Number(m.arquivo), legenda: m.legenda ?? null }));
  const nivel = im.endereco_publico ?? 'bairro';
  return {
    codigo: im.codigo,
    titulo: im.titulo ?? null,
    tipo: im.tipo,
    finalidade: im.finalidade,
    situacao: im.situacao,
    preco_c: im.preco_c ?? null,
    condominio_c: im.condominio_c ?? null,
    iptu_anual_c: im.iptu_anual_c ?? null,
    area_util_m2: im.area_util_m2 ?? null,
    area_total_m2: im.area_total_m2 ?? null,
    quartos: im.quartos ?? null,
    suites: im.suites ?? null,
    banheiros: im.banheiros ?? null,
    vagas: im.vagas ?? null,
    // "região" mostra só a cidade; "bairro", bairro e cidade; "completo", também o endereço.
    bairro: nivel === 'regiao' ? null : (im.bairro ?? null),
    cidade: im.cidade ?? null,
    uf: im.uf ?? null,
    endereco: nivel === 'completo' ? (im.endereco ?? null) : null,
    caracteristicas: Array.isArray(im.caracteristicas) ? im.caracteristicas.map(String).slice(0, 40) : [],
    descricao: typeof im.descricao === 'string' ? im.descricao.slice(0, 8000) : null,
    fotos,
  };
}

export interface Lead {
  nome: string;
  telefone: string | null;
  email: string | null;
  mensagem: string | null;
  imovel_codigo: string | null;
}

/** Formulário de contato da página (7.3): consentimento obrigatório, telefone ou e-mail. */
export function validarLead(corpo: Record<string, unknown>): Resultado<Lead> {
  const erros: string[] = [];
  const nome = textoCurto(corpo.nome, 120);
  if (!nome || nome.length < 2) erros.push('Informe seu nome.');
  const telefone = typeof corpo.telefone === 'string' && corpo.telefone.trim() ? normalizarTelefone(corpo.telefone) : null;
  if (telefone && !telefoneValido(telefone)) erros.push('Telefone inválido. Use DDD e número.');
  const email = typeof corpo.email === 'string' ? corpo.email.trim().toLowerCase().slice(0, 200) || null : null;
  if (email && !emailValido(email)) erros.push('E-mail inválido.');
  if (!telefone && !email) erros.push('Informe telefone ou e-mail para o corretor responder.');
  if (corpo.consentimento !== true) erros.push('É preciso autorizar o contato.');
  const codigo = textoCurto(corpo.imovel_codigo, 30);
  if (erros.length) return { ok: false, erros };
  return { ok: true, dados: { nome: nome!, telefone, email, mensagem: textoCurto(corpo.mensagem, 1000), imovel_codigo: codigo } };
}

/** Link de WhatsApp para o telefone do corretor, já com o texto. */
export function linkWhatsapp(telefone: string | null | undefined, texto: string): string | null {
  const digitos = String(telefone ?? '').replace(/\D/g, '');
  if (digitos.length < 10) return null;
  return `https://wa.me/${digitos}?text=${encodeURIComponent(texto)}`;
}
