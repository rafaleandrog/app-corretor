// Hoje no Padrão B (spec 11.1 P01, 11.5 M1): regras puras da tela, sem lit nem `urbiVerso`, para o
// teste conferir sem montar a app. A rota `GET /inicio` monta os dados; a tela só desenha.

import type { TipoFila } from './funil';

/** Um passo do "Primeiros passos": o que falta para a conta ficar pronta. */
export interface PassoInicial {
  id: IdPasso;
  rotulo: string;
  /** Sub-rota do app que resolve o passo. */
  rota: string;
  feito: boolean;
}

export type IdPasso = 'conta' | 'telefone' | 'instagram' | 'imovel' | 'pagina';

/**
 * Os 5 primeiros passos, na ordem em que aparecem. O CRECI não está aqui (D-93): é opcional e tem só
 * o aviso discreto. O WhatsApp e o Mensageiro entram quando existirem (spec 11.1 P01), no lugar dos
 * dois passos de conta.
 */
export const PASSOS_INICIAIS: { id: IdPasso; rotulo: string; rota: string }[] = [
  { id: 'conta', rotulo: 'Dar nome à conta', rota: '/ajustes/conta' },
  { id: 'telefone', rotulo: 'Informar o seu telefone', rota: '/ajustes/conta' },
  { id: 'instagram', rotulo: 'Conectar o Instagram', rota: '/ajustes/conexoes' },
  { id: 'imovel', rotulo: 'Cadastrar o primeiro imóvel', rota: '/imoveis?criar=imovel' },
  { id: 'pagina', rotulo: 'Publicar a Página', rota: '/pagina' },
];

/** O que já está pronto na conta; cada campo responde a um passo. */
export type EstadoConta = Record<IdPasso, boolean>;

export function primeirosPassos(estado: EstadoConta): PassoInicial[] {
  return PASSOS_INICIAIS.map((p) => ({ ...p, feito: !!estado[p.id] }));
}

/**
 * Ação de cada cartão da fila (princípio 14): **um** botão principal e no máximo um secundário, no
 * "Mais". A tela liga cada nome ao que ele faz.
 */
export type AcaoFila = 'fazer_agora' | 'abrir' | 'fiz' | 'visita_feita';

export const ACOES_FILA: Record<TipoFila, { principal: AcaoFila; secundaria: AcaoFila | null }> = {
  quente_sem_resposta: { principal: 'fazer_agora', secundaria: null },
  abordagem_vencida: { principal: 'fazer_agora', secundaria: 'fiz' },
  visita: { principal: 'abrir', secundaria: 'visita_feita' },
  proximo_passo: { principal: 'abrir', secundaria: null },
};

/** Chip de tipo do cartão da fila. */
export const TIPO_NA_FILA: Record<TipoFila, string> = {
  quente_sem_resposta: 'Quente',
  abordagem_vencida: 'Atrasada',
  visita: 'Visita',
  proximo_passo: 'Próximo passo',
};

/** Cartões que aparecem antes do "Mais N para depois". */
export const FILA_VISIVEL = 8;

/**
 * Dica do Assistente (P01, direita): uma sugestão concreta a partir do que a tela já tem. O botão
 * abre o Assistente; nada é executado sem o corretor pedir.
 */
export function dicaDoAssistente(fila: { tipo: TipoFila }[], passos: PassoInicial[]): string {
  const quentes = fila.filter((i) => i.tipo === 'quente_sem_resposta').length;
  if (quentes) {
    return quentes === 1
      ? 'Um cliente quente está sem resposta. Peça ao Assistente uma mensagem para retomar a conversa.'
      : `${quentes} clientes quentes estão sem resposta. Peça ao Assistente uma mensagem para cada um.`;
  }
  const atrasadas = fila.filter((i) => i.tipo === 'abordagem_vencida').length;
  if (atrasadas) return `Há ${atrasadas === 1 ? 'uma abordagem atrasada' : `${atrasadas} abordagens atrasadas`}. Pergunte ao Assistente por onde começar.`;
  const falta = passos.find((p) => !p.feito);
  if (falta) return `Próximo passo para deixar a conta pronta: ${falta.rotulo.toLowerCase()}. O Assistente explica como.`;
  return 'Nada urgente agora. Pergunte ao Assistente quais clientes vale a pena retomar esta semana.';
}

// ---------- Carga de Hoje: de qual conta são os dados que a tela pode desenhar ----------

/**
 * Os dados de Hoje vivem fora do componente e valem para UMA conta. `conta` é a dona do que está aqui
 * (e da carga em voo); `geracao` numera as cargas, para a resposta atrasada de outra conta cair fora.
 */
export interface CargaHoje<T> {
  conta: number | null | undefined;
  dados: T | null;
  falha: unknown;
  geracao: number;
  carregando: boolean;
}

export const cargaVazia = <T>(): CargaHoje<T> => ({ conta: undefined, dados: null, falha: null, geracao: 0, carregando: false });

/**
 * O corretor entrou em Hoje com `contaAtual`. Entrada na mesma conta mantém tudo (sem piscar); conta
 * diferente descarta dados, falha e carga em voo: nada da conta anterior chega a ser desenhado.
 */
export function entrarEmHoje<T>(c: CargaHoje<T>, contaAtual: number | null): CargaHoje<T> {
  if (c.conta === contaAtual) return c;
  return { conta: contaAtual, dados: null, falha: null, geracao: c.geracao + 1, carregando: false };
}

export const iniciarCarga = <T>(c: CargaHoje<T>): CargaHoje<T> => ({ ...c, geracao: c.geracao + 1, carregando: true, falha: null });

/** Resposta (ou falha) da carga `geracao`: só vale se ainda é a carga corrente. A falha derruba os dados velhos. */
export function receberCarga<T>(c: CargaHoje<T>, geracao: number, r: { dados: T } | { falha: unknown }): CargaHoje<T> {
  if (geracao !== c.geracao) return c;
  return 'dados' in r ? { ...c, dados: r.dados, falha: null, carregando: false } : { ...c, dados: null, falha: r.falha, carregando: false };
}

/** O que desenhar: a falha tem precedência; sem dados da conta ativa, "carregando". */
export function telaDeHoje<T>(c: CargaHoje<T>): 'dados' | 'falha' | 'carregando' {
  if (c.falha) return 'falha';
  return c.dados ? 'dados' : 'carregando';
}
