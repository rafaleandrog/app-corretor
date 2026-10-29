// Regras puras das telas da negociação (P15, P16, M8; item D3): filtros da lista, rótulos, a diferença
// "última oferta × pedido", a validação ao vivo do mandato e o texto do bloqueio que o backend devolve.
// Sem lit nem `urbiVerso`: o teste confere cada regra sem montar a tela. Os valores sigilosos (recuo,
// alvo, BATNA) nunca passam por aqui: só a rota do mandato os entrega, e só ao clicar em "mostrar".

import { AUTONOMIAS, ENCERRADOS, ESTADOS_NEGOCIACAO, PASSO_MAX_PADRAO, RODADAS_MAX_PADRAO, type EstadoNegociacao } from './negociacao';
import { DESCRICAO_GARANTIA, GARANTIAS, type Garantia } from './negociador';

/** Estados em andamento (tudo menos ganha e perdida). */
export const ABERTOS = ESTADOS_NEGOCIACAO.filter((e) => !(ENCERRADOS as readonly string[]).includes(e));

/**
 * Filtros da lista de Negociações (spec 11.1 P15): cada um vira a consulta de `GET /negociacoes`.
 * "Todas" é tudo em andamento; as encerradas ficam no filtro próprio.
 */
export const FILTROS_NEGOCIACOES = [
  { id: 'todas', rotulo: 'Todas', consulta: { estado: ABERTOS.join(',') } },
  { id: 'voce', rotulo: 'Aguardando você', consulta: { estado: 'aguardando_corretor' } },
  { id: 'negociador', rotulo: 'Negociador', consulta: { estado: ['ativa', 'aguardando_cliente', 'pausada'].join(','), conduzida_por: 'ia' } },
  { id: 'cliente', rotulo: 'Cliente', consulta: { estado: 'aguardando_cliente' } },
  { id: 'proprietario', rotulo: 'Proprietário', consulta: { estado: 'aguardando_proprietario' } },
  { id: 'encerradas', rotulo: 'Encerradas', consulta: { estado: ENCERRADOS.join(',') } },
] as const;
export type FiltroNegociacoes = (typeof FILTROS_NEGOCIACOES)[number]['id'];

/** O filtro da URL (`?filtro=`), ou "Todas" quando ausente ou desconhecido. */
export function filtroNegociacoes(valor: string | null | undefined): (typeof FILTROS_NEGOCIACOES)[number] {
  return FILTROS_NEGOCIACOES.find((f) => f.id === valor) ?? FILTROS_NEGOCIACOES[0];
}

export const ROTULO_ESTADO_NEGOCIACAO: Record<EstadoNegociacao, { rotulo: string; cor: string }> = {
  ativa: { rotulo: 'Em andamento', cor: 'info' },
  aguardando_cliente: { rotulo: 'Aguardando cliente', cor: 'padrao' },
  aguardando_corretor: { rotulo: 'Aguardando você', cor: 'alerta' },
  aguardando_proprietario: { rotulo: 'Aguardando proprietário', cor: 'variante_2' },
  pausada: { rotulo: 'Pausada', cor: 'padrao' },
  ganha: { rotulo: 'Ganha', cor: 'sucesso' },
  perdida: { rotulo: 'Perdida', cor: 'erro' },
};

export const ROTULO_AUTONOMIA: Record<(typeof AUTONOMIAS)[number], string> = {
  sugere: 'só sugere',
  pergunta_antes: 'pergunta antes',
  faz_sozinho: 'faz sozinho',
};

export const ROTULO_DIRECAO: Record<string, string> = { comprador: 'Cliente', vendedor: 'Vendedor', proprietario: 'Proprietário' };
export const ROTULO_AUTOR: Record<string, string> = {
  cliente: 'Cliente',
  corretor: 'Você',
  negociador_ia: 'Negociador IA',
  negociador_humano: 'Negociador',
  proprietario: 'Proprietário',
};
export const ROTULO_CANAL: Record<string, string> = { registro: 'Registro', portal: 'Portal', wa_me: 'Fazer agora', whatsapp: 'WhatsApp' };

/** Quem conduz, como no chip do cabeçalho: "Negociador IA · pergunta antes" ou "Você". */
export function quemConduz(conduzida_por: string | null | undefined, autonomia?: string | null): string {
  if (conduzida_por === 'ia') return autonomia && autonomia in ROTULO_AUTONOMIA ? `Negociador IA · ${ROTULO_AUTONOMIA[autonomia as keyof typeof ROTULO_AUTONOMIA]}` : 'Negociador IA';
  if (conduzida_por === 'humano') return 'Negociador';
  return 'Você';
}

/**
 * Diferença da última oferta para o preço pedido, como na lista do P15: "−9%". Sem um dos dois, nada.
 * Arredonda para o inteiro mais próximo; oferta igual ao pedido é "0%".
 */
export function diferencaDoPedido(oferta_c: number | null | undefined, pedido_c: number | null | undefined): string | null {
  if (!oferta_c || !pedido_c) return null;
  const pct = Math.round(((oferta_c - pedido_c) / pedido_c) * 100);
  if (pct === 0) return '0%';
  return `${pct > 0 ? '+' : '−'}${Math.abs(pct)}%`;
}

/** "Rodada 3 de 4": a rodada atual e o máximo do mandato (sem mandato, só a rodada). */
export function rotuloRodada(rodadas: number | null | undefined, maximo: number | null | undefined): string {
  const r = Math.max(1, Number(rodadas) || 0);
  return maximo ? `Rodada ${r} de ${maximo}` : `Rodada ${r}`;
}

/**
 * Valor em reais digitado ("1.380.000", "1380000", "R$ 1.380.000,50") para centavos. Vazio ou
 * inválido: `null`. Aceita vírgula decimal (pt-BR) e pontos de milhar.
 */
export function centavosDeReais(texto: unknown): number | null {
  if (typeof texto === 'number') return Number.isFinite(texto) && texto > 0 ? Math.round(texto * 100) : null;
  if (typeof texto !== 'string') return null;
  const limpo = texto.replace(/R\$|\s/gi, '');
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$/.test(limpo)) return null;
  const [inteiro, frac = ''] = limpo.replace(/\./g, '').split(',');
  const c = Number(inteiro) * 100 + Number(frac.padEnd(2, '0'));
  return c > 0 && Number.isSafeInteger(c) ? c : null;
}

/** Centavos para o campo de texto do formulário ("1.380.000" ou "1.380.000,50"). */
export function reaisDoCampo(c: number | null | undefined): string {
  if (!c) return '';
  const inteiro = Math.floor(c / 100).toLocaleString('pt-BR');
  const frac = c % 100;
  return frac ? `${inteiro},${String(frac).padStart(2, '0')}` : inteiro;
}

/**
 * Validação ao vivo do bloco Valores do mandato (P16): "✓ recuo ≤ alvo ≤ pedido". A mesma regra do
 * backend (`validarMandato`), dita antes de salvar; o backend continua sendo quem recusa.
 */
export function conferirValores(v: { pedido_c: number | null; alvo_c: number | null; recuo_c: number | null }): { ok: boolean; texto: string } {
  if (!v.pedido_c || !v.alvo_c || !v.recuo_c) return { ok: false, texto: 'Preencha o pedido, o alvo e o recuo.' };
  if (v.recuo_c > v.alvo_c) return { ok: false, texto: 'O ponto de recuo não pode ficar acima do alvo.' };
  if (v.alvo_c > v.pedido_c) return { ok: false, texto: 'O alvo não pode ficar acima do preço pedido.' };
  return { ok: true, texto: '✓ recuo ≤ alvo ≤ pedido' };
}

export interface FormularioMandato {
  pedido: string;
  alvo: string;
  recuo: string;
  batna: string;
  concessoes: { item: string; limite: string; contrapartida: string }[];
  /** Passo máximo em porcentagem do intervalo restante (40 = 40%). */
  passo_pct: string;
  rodadas: string;
  validade: string;
  autonomia: string;
  autorizacao: { tipo: 'mensagem' | 'anexo'; data: string; arquivo_id: number | null } | null;
}

/** Formulário vazio, com os padrões de 10.9.2 e o preço do anúncio no pedido. */
export function mandatoEmBranco(preco_c: number | null | undefined, hoje: string): FormularioMandato {
  const d = new Date(`${hoje}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 30);
  return {
    pedido: reaisDoCampo(preco_c),
    alvo: '',
    recuo: '',
    batna: '',
    concessoes: [],
    passo_pct: String(Math.round(PASSO_MAX_PADRAO * 100)),
    rodadas: String(RODADAS_MAX_PADRAO),
    validade: d.toISOString().slice(0, 10),
    autonomia: 'pergunta_antes',
    autorizacao: null,
  };
}

/** O formulário a partir da versão vigente (a da rota do mandato, com os valores sigilosos). */
export function mandatoParaFormulario(m: Record<string, any>): FormularioMandato {
  return {
    pedido: reaisDoCampo(m.preco_pedido_c),
    alvo: reaisDoCampo(m.alvo_c),
    recuo: reaisDoCampo(m.recuo_c),
    batna: m.batna_vendedor ?? '',
    concessoes: Array.isArray(m.concessoes) ? m.concessoes.map((c: any) => ({ item: c.item ?? '', limite: c.limite ?? '', contrapartida: c.contrapartida ?? '' })) : [],
    passo_pct: String(Math.round(Number(m.passo_max_pct ?? PASSO_MAX_PADRAO) * 100)),
    rodadas: String(m.rodadas_max ?? RODADAS_MAX_PADRAO),
    validade: String(m.validade ?? '').slice(0, 10),
    autonomia: m.autonomia ?? 'pergunta_antes',
    autorizacao: m.autorizacao_proprietario
      ? { tipo: m.autorizacao_proprietario.tipo, data: m.autorizacao_proprietario.data, arquivo_id: m.autorizacao_proprietario.arquivo_id ?? null }
      : null,
  };
}

/** O corpo do `PUT /negociacoes/:id/mandato` (centavos e fração), do jeito que `validarMandato` lê. */
export function corpoDoMandato(f: FormularioMandato): Record<string, unknown> {
  const passo = Number(String(f.passo_pct).replace(',', '.'));
  const rodadas = Number(f.rodadas);
  return {
    preco_pedido_c: centavosDeReais(f.pedido),
    alvo_c: centavosDeReais(f.alvo),
    recuo_c: centavosDeReais(f.recuo),
    batna_vendedor: f.batna.trim() || null,
    // Linha toda em branco é linha que o corretor abriu e não usou: não vai.
    concessoes: f.concessoes.filter((c) => c.item.trim() || c.contrapartida.trim() || c.limite.trim()),
    passo_max_pct: Number.isFinite(passo) && f.passo_pct.trim() ? passo / 100 : null,
    rodadas_max: Number.isFinite(rodadas) && f.rodadas.trim() ? rodadas : null,
    validade: f.validade,
    autonomia: f.autonomia,
    autorizacao_proprietario: f.autorizacao ? { tipo: f.autorizacao.tipo, data: f.autorizacao.data, arquivo_id: f.autorizacao.tipo === 'anexo' ? f.autorizacao.arquivo_id : null } : null,
  };
}

/** Rótulo curto de cada garantia na linha de validações do cartão de sugestão ("✓ acima do recuo"). */
export const GARANTIA_CURTA: Record<Garantia, string> = {
  piso: 'acima do recuo',
  passo: 'passo menor',
  rodadas: 'dentro das rodadas',
  concessoes: 'concessões do mandato',
  sigilo: 'sem revelar o sigilo',
  validade: 'mandato vigente',
  canal: 'canal disponível',
};

/** A linha de validações do cartão: "✓ acima do recuo · ✓ passo menor · ✗ …". */
export function linhaDeValidacoes(verificacoes: { garantia?: string; ok: boolean }[] | null | undefined): string {
  return (verificacoes ?? [])
    .filter((v) => v.garantia && v.garantia in GARANTIA_CURTA)
    .map((v) => `${v.ok ? '✓' : '✗'} ${GARANTIA_CURTA[v.garantia as Garantia]}`)
    .join(' · ');
}

// Os códigos que a garantia de validade usa além de MANDATO_VENCIDO (`comum/negociador.ts`): sem mandato
// e "faz sozinho" sem a autorização do proprietário. Na tela viram a frase da garantia, nunca o código.
const GARANTIA_DO_CODIGO = new Map<string, Garantia>([
  ...Object.entries(GARANTIAS).map(([g, c]) => [c as string, g as Garantia] as const),
  ['MANDATO_AUSENTE', 'validade'],
  ['AUTORIZACAO_PROPRIETARIO_AUSENTE', 'validade'],
]);

/**
 * O texto do 422 `MOVIMENTO_BLOQUEADO` (Enviar ou Editar uma sugestão): a mensagem do backend e, por
 * linha, o que cada garantia diz. O detalhe vem como "CODIGO: detalhe"; o código vira a frase da
 * garantia (sem número nenhum: o backend não devolve o recuo nem nesse erro).
 */
export function textoDoBloqueio(e: { message?: string; codigo?: string; detalhes?: string[] }): string {
  const linhas = (e.detalhes ?? []).map((d) => {
    const [codigo, ...resto] = d.split(':');
    const g = GARANTIA_DO_CODIGO.get(codigo.trim());
    const detalhe = resto.join(':').trim();
    return g ? `✗ ${detalhe || DESCRICAO_GARANTIA[g]}` : `✗ ${d}`;
  });
  return [e.message ?? 'Esta contraproposta não pode sair como está.', ...linhas].join('\n');
}

/** Por que a sugestão pendente não pode sair como está (Enviar, Fazer agora, Usar sugestão). */
export type TravaDaSugestao = 'reprovada' | 'sem_movimento' | 'anterior';

export const TEXTO_TRAVA_SUGESTAO: Record<TravaDaSugestao, string> = {
  reprovada: 'Alguma regra do mandato reprovou esta sugestão: ela não sai como está. Edite ou descarte.',
  sem_movimento: 'Esta sugestão não traz contraproposta nem mensagem para enviar. Edite ou descarte.',
  anterior: 'Esta sugestão é anterior à última oferta do cliente. Peça outra ao Negociador.',
};

/**
 * Se a sugestão pendente pode sair como está (P15, cartão e Próximo movimento). Trava quando alguma
 * verificação reprovou ou há `bloqueado_por`, quando o movimento não é contraproposta nem tem mensagem,
 * e quando ela foi feita antes da última oferta do cliente (a oferta nova pede outra sugestão). Editar e
 * Descartar continuam: o backend revalida o que o corretor editar.
 */
export function travaDaSugestao(
  sug: { verificacoes?: { ok: boolean }[] | null; bloqueado_por?: unknown; resposta?: { movimento?: string; mensagem?: string | null } | null; criado_em?: string | null } | null | undefined,
  propostas: { direcao?: string; criado_em?: string | null }[] | null | undefined,
): TravaDaSugestao | null {
  if (!sug) return null;
  const ultima = [...(propostas ?? [])].reverse().find((p) => p.direcao === 'comprador');
  const feita = sug.criado_em ? Date.parse(sug.criado_em) : NaN;
  const oferta = ultima?.criado_em ? Date.parse(ultima.criado_em) : NaN;
  if (Number.isFinite(feita) && Number.isFinite(oferta) && feita < oferta) return 'anterior';
  const bloqueio = Array.isArray(sug.bloqueado_por) ? sug.bloqueado_por.length > 0 : !!sug.bloqueado_por;
  if (bloqueio || (sug.verificacoes ?? []).some((v) => !v.ok)) return 'reprovada';
  const r = sug.resposta ?? {};
  if (r.movimento !== 'contraproposta' && !String(r.mensagem ?? '').trim()) return 'sem_movimento';
  return null;
}

/**
 * Onde a "Nova proposta" (Criar, ficha) grava a oferta do cliente: na negociação em andamento do mesmo
 * cliente e imóvel; senão, num negócio aberto do cliente para esse imóvel (ou sem imóvel) que ainda não
 * esteja em negociação, criando a negociação; senão, num negócio novo (a tela o abre antes). Puro.
 */
export function destinoDaProposta(
  imovelId: number,
  negocios: { id: number; imovel_id?: number | null; etapa_tipo?: string | null }[],
  abertas: { id: number; negocio_id: number; imovel_id: number }[],
): { negociacao_id: number } | { negocio_id: number } | { criar_negocio: true } {
  const mesma = abertas.find((n) => Number(n.imovel_id) === imovelId);
  if (mesma) return { negociacao_id: mesma.id };
  const ocupados = new Set(abertas.map((n) => Number(n.negocio_id)));
  const livres = negocios.filter((n) => n.etapa_tipo === 'aberta' && !ocupados.has(Number(n.id)));
  const negocio = livres.find((n) => Number(n.imovel_id) === imovelId) ?? livres.find((n) => !n.imovel_id);
  return negocio ? { negocio_id: negocio.id } : { criar_negocio: true };
}
