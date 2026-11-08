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
  { id: 'imovel', rotulo: 'Cadastrar o primeiro imóvel', rota: '/imoveis/novo' },
  { id: 'pagina', rotulo: 'Publicar a Página', rota: '/pagina' },
];

/** O que já está pronto na conta; cada campo responde a um passo. */
export type EstadoConta = Record<IdPasso, boolean>;

export function primeirosPassos(estado: EstadoConta): PassoInicial[] {
  return PASSOS_INICIAIS.map((p) => ({ ...p, feito: !!estado[p.id] }));
}

/**
 * Ação de cada cartão da fila (princípio 14, spec 11.1 P01): **um** botão principal, no máximo um
 * secundário visível (como "Falar com Ana", que abre a conversa do contato) e o resto no "Mais", onde
 * "Agora não" (adiar) entra em todo cartão de contato. A tela liga cada nome ao que ele faz.
 */
export type AcaoFila = 'fazer_agora' | 'abrir' | 'fiz' | 'visita_feita' | 'falar' | 'responder' | 'registrar_proposta' | 'revisar' | 'abrir_imovel';

export const ACOES_FILA: Record<TipoFila, { principal: AcaoFila; secundaria: AcaoFila | null; mais: AcaoFila[] }> = {
  quente_sem_resposta: { principal: 'fazer_agora', secundaria: 'falar', mais: [] },
  abordagem_vencida: { principal: 'fazer_agora', secundaria: 'falar', mais: ['fiz'] },
  visita: { principal: 'abrir', secundaria: 'falar', mais: ['visita_feita'] },
  proposta_recebida: { principal: 'responder', secundaria: 'registrar_proposta', mais: [] },
  proximo_passo: { principal: 'abrir', secundaria: 'falar', mais: [] },
  peca_aguardando: { principal: 'revisar', secundaria: null, mais: [] },
  prazo_autorizacao: { principal: 'abrir_imovel', secundaria: null, mais: [] },
};

/** Chip de MOTIVO do cartão da fila: diz por que o item está aqui, nunca repete a temperatura (issue #175). */
export const MOTIVO_NA_FILA: Record<TipoFila, string> = {
  quente_sem_resposta: 'Sem resposta',
  abordagem_vencida: 'Abordagem atrasada',
  visita: 'Visita',
  proposta_recebida: 'Proposta recebida',
  proximo_passo: 'Retorno vencido',
  peca_aguardando: 'Peça aguardando',
  prazo_autorizacao: 'Autorização vencendo',
};

/** O chip da visita diz o dia ("Visita hoje", "Visita amanhã"); os demais, o rótulo fixo. */
export function motivoDoItem(i: { tipo: TipoFila; quando?: string | null }, agora = new Date()): string {
  if (i.tipo !== 'visita' || !i.quando) return MOTIVO_NA_FILA[i.tipo];
  const dia = new Date(i.quando);
  return dia.toDateString() === agora.toDateString() ? 'Visita hoje' : dia.toDateString() === new Date(agora.getTime() + 86400e3).toDateString() ? 'Visita amanhã' : 'Visita';
}

/** Cartões que aparecem antes do "Mais N para depois". */
export const FILA_VISIVEL = 8;

/** Um item da fila como a rota o devolve (o que a dica lê). */
export interface ItemDaFila {
  tipo: TipoFila;
  contato_id: number | null;
  contato_nome: string;
  texto: string;
  peca_id?: number | null;
}

/** A ação que a dica propõe, no formato que `validarAcao` (comum/assistente) confere. */
export interface AcaoDaDica {
  tipo: 'criar_atividade' | 'agendar_peca';
  tipo_atividade?: 'tarefa' | 'ligacao' | 'mensagem' | 'retorno';
  titulo?: string;
  quando: string;
  contato_id?: number;
  peca_id?: number;
}

/**
 * Dica do Assistente (P01, direita): uma sugestão concreta a partir do que a tela já tem e, quando há
 * algo a fazer, UMA ação proposta (criar um lembrete, agendar a peça), que a rota valida por
 * `validarAcao` e a tela executa só depois da confirmação do corretor. Sem ação, o botão abre o
 * Assistente com a pergunta pronta.
 */
/**
 * Instante (ISO) de `hora`:00 do dia `deslocamentoDias` depois de hoje, NO FUSO da conta (e não no do
 * processo: o backend roda em UTC). Sem biblioteca: lê o deslocamento do fuso pelo `Intl` naquele dia e
 * confere de novo no instante achado (troca de horário de verão no meio do caminho).
 */
export function horaLocalNoFuso(agora: Date, fuso: string, deslocamentoDias: number, hora: number): string {
  const hoje = agora.toLocaleDateString('sv-SE', { timeZone: fuso });
  const [a, m, d] = hoje.split('-').map(Number);
  const alvo = new Date(Date.UTC(a, m - 1, d + deslocamentoDias, hora));
  // Diferença do relógio do fuso para o UTC no instante dado (ex.: -3 h em Brasília).
  const desvio = (t: Date) => {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: fuso, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(t).map((x) => [x.type, x.value]));
    return Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second)) - Math.floor(t.getTime() / 1000) * 1000;
  };
  let instante = new Date(alvo.getTime() - desvio(alvo));
  const ajuste = desvio(instante);
  if (alvo.getTime() - ajuste !== instante.getTime()) instante = new Date(alvo.getTime() - ajuste);
  return instante.toISOString();
}

export function dicaDoAssistente(fila: ItemDaFila[] | { tipo: TipoFila }[], passos: PassoInicial[], agora = new Date(), fuso = 'America/Sao_Paulo'): { texto: string; acao: AcaoDaDica | null } {
  const itens = fila as ItemDaFila[];
  const daqui = (horas: number) => new Date(agora.getTime() + horas * 3600e3).toISOString();
  const quentes = itens.filter((i) => i.tipo === 'quente_sem_resposta');
  if (quentes.length) {
    const q = quentes[0];
    const acao: AcaoDaDica | null = q.contato_id ? { tipo: 'criar_atividade', tipo_atividade: 'ligacao', titulo: `Responder ${q.contato_nome}`.slice(0, 120), quando: daqui(1), contato_id: q.contato_id } : null;
    return {
      texto: quentes.length === 1
        ? `${q.contato_nome} está quente e sem resposta. Posso criar um lembrete para responder em 1 hora.`
        : `${quentes.length} clientes quentes estão sem resposta. Comece por ${q.contato_nome}: posso criar um lembrete para daqui a 1 hora.`,
      acao,
    };
  }
  const atrasadas = itens.filter((i) => i.tipo === 'abordagem_vencida');
  if (atrasadas.length) {
    const a = atrasadas[0];
    const acao: AcaoDaDica | null = a.contato_id ? { tipo: 'criar_atividade', tipo_atividade: 'retorno', titulo: `Retomar ${a.contato_nome}`.slice(0, 120), quando: daqui(2), contato_id: a.contato_id } : null;
    return { texto: `Há ${atrasadas.length === 1 ? 'uma abordagem atrasada' : `${atrasadas.length} abordagens atrasadas`}. Posso criar um retorno para ${a.contato_nome} daqui a 2 horas.`, acao };
  }
  const peca = itens.find((i) => i.tipo === 'peca_aguardando' && i.peca_id);
  if (peca) {
    // Amanhã às 18 h no fuso da conta (horário em que os contatos chegam mais), em ISO: a rota valida a
    // janela de 5 min a 90 dias e escreve o resumo no mesmo fuso. O título da peça vem em `contato_nome`
    // (o item da peça não tem contato); `texto` é o motivo ("Aprovada em … e sem data para publicar").
    return { texto: `A peça "${peca.contato_nome}" está aprovada e sem data. Posso agendar para amanhã às 18 h.`, acao: { tipo: 'agendar_peca', peca_id: peca.peca_id!, quando: horaLocalNoFuso(agora, fuso, 1, 18) } };
  }
  const falta = passos.find((p) => !p.feito);
  if (falta) return { texto: `Próximo passo para deixar a conta pronta: ${falta.rotulo.toLowerCase()}. O Assistente explica como.`, acao: null };
  return { texto: 'Nada urgente agora. Pergunte ao Assistente quais clientes vale a pena retomar esta semana.', acao: null };
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
