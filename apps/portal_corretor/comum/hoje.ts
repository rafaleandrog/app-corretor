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
 * `resultado` diz explicitamente o que a última carga entregou (a tela não deduz pelo valor);
 * `pendente` é a necessidade de recarga (entrada nova ou conta nova) e `verTudo` é do que se vê dela.
 */
export interface CargaHoje<T> {
  conta: number | null | undefined;
  dados: T | null;
  falha: unknown;
  resultado: 'nenhum' | 'dados' | 'falha';
  geracao: number;
  carregando: boolean;
  pendente: boolean;
  verTudo: boolean;
}

export const cargaVazia = <T>(): CargaHoje<T> => ({ conta: undefined, dados: null, falha: null, resultado: 'nenhum', geracao: 0, carregando: false, pendente: true, verTudo: false });

/**
 * A conta ativa é `contaAtual`. Mesma conta mantém tudo (sem piscar); conta diferente, venha de onde vier
 * (entrada, troca no seletor, outra aba), descarta dados, falha e carga em voo, zera o "ver tudo" e
 * marca a recarga como pendente: nada da conta anterior chega a ser desenhado e a nova carga é pedida.
 */
export function entrarEmHoje<T>(c: CargaHoje<T>, contaAtual: number | null): CargaHoje<T> {
  if (c.conta === contaAtual) return c;
  return { conta: contaAtual, dados: null, falha: null, resultado: 'nenhum', geracao: c.geracao + 1, carregando: false, pendente: true, verTudo: false };
}

/** Nova entrada na tela, na mesma conta: os dados seguem na tela e são relidos; o "ver tudo" recomeça fechado. */
export const marcarEntrada = <T>(c: CargaHoje<T>): CargaHoje<T> => ({ ...c, pendente: true, verTudo: false });

/** A tela deve pedir uma carga agora: há recarga pendente e nenhuma em voo (sem isso, render→carga→render não termina). */
export const precisaCarregar = <T>(c: CargaHoje<T>): boolean => c.pendente && !c.carregando;

/** Começa uma carga: a falha anterior sai (vira "carregando"); os dados da mesma conta seguem na tela até a resposta. */
export const iniciarCarga = <T>(c: CargaHoje<T>): CargaHoje<T> => ({ ...c, geracao: c.geracao + 1, carregando: true, pendente: false, falha: null, resultado: c.resultado === 'falha' ? 'nenhum' : c.resultado });

export const mostrarTudo = <T>(c: CargaHoje<T>): CargaHoje<T> => ({ ...c, verTudo: true });

/**
 * Resposta (ou falha) da carga `geracao`: só vale se ainda é a carga corrente. A falha derruba os dados
 * velhos. Resposta sem dados (nulo) é falha: nunca um "dados" que a tela não tem o que desenhar.
 */
export function receberCarga<T>(c: CargaHoje<T>, geracao: number, r: { dados: T } | { falha: unknown }): CargaHoje<T> {
  if (geracao !== c.geracao) return c;
  if ('dados' in r && r.dados != null) return { ...c, dados: r.dados, falha: null, resultado: 'dados', carregando: false };
  const falha = 'dados' in r ? new Error('Resposta vazia') : r.falha;
  return { ...c, dados: null, falha, resultado: 'falha', carregando: false };
}

/** O que desenhar, pelo resultado explícito: a falha vale mais que dados velhos; sem resultado da conta ativa, "carregando". */
export function telaDeHoje<T>(c: CargaHoje<T>): 'dados' | 'falha' | 'carregando' {
  if (c.resultado === 'falha') return 'falha';
  return c.resultado === 'dados' && c.dados != null ? 'dados' : 'carregando';
}
