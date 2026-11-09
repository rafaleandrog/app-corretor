import type { CampoFormulario, UrbiVersoAPI } from '@urbiverso/sdk';

declare const urbiVerso: UrbiVersoAPI;

// Apoio comum das telas: chamada com corpo JSON, mensagem de erro com os detalhes da validação e
// formatação de data e dinheiro em pt-BR. Chip, cartão de imóvel, estado na URL e "mais" moram em
// `visual.ts` e saem daqui também.
export * from './visual.js';
import { CODIGOS_DO_APP, fraseDoErro } from './estados';

// Conta ativa de escrita. Quem tem várias contas (o admin do app, por exemplo) precisa dizer em qual
// grava: o shell só aceita escrita em tabela segregada com `X-Conta` (contas.md § Escrita com N
// contas). Com uma conta só, o shell resolve sozinho e nenhum cabeçalho é enviado.
const CHAVE_CONTA = 'portal_corretor:conta';

export function contasDoUsuario(): { id: number; nome: string }[] {
  const c = urbiVerso.contexto().conta;
  return c && c.contaEscrita === undefined ? c.contas : [];
}

/**
 * Sem conta para trabalhar: `negar`, ou `escopado` com o conjunto vazio (quem é da equipe e não
 * atende nenhuma conta, como o admin recém-chegado). O backend responde `SEM_CONTA` nesse caso.
 */
export function semConta(): boolean {
  const c = urbiVerso.contexto().conta;
  if (!c) return false;
  return c.resolucao === 'negar' || (c.resolucao === 'escopado' && !c.contas.length && c.contaEscrita === undefined);
}

/**
 * Negociador humano (D7): tem o papel `negociador` e não vale pelo corretor (nem papel `corretor`, nem
 * admin do app). As telas mostram só as negociações atribuídas e escondem as ações do corretor; quem
 * barra de verdade é o backend.
 */
export function soNegociador(): boolean {
  const c = urbiVerso.contexto?.();
  const papeis = (c?.roles ?? []) as string[];
  return c?.nivel !== 'admin' && papeis.includes('negociador') && !papeis.includes('corretor');
}

/** Conta escolhida no seletor, se ainda for uma das do usuário; senão a primeira da lista. */
export function contaAtiva(): number | null {
  const contas = contasDoUsuario();
  if (!contas.length) return null;
  let salva = 0;
  try {
    salva = Number(localStorage.getItem(CHAVE_CONTA));
  } catch {
    /* sem armazenamento: vale a primeira */
  }
  return contas.find((c) => c.id === salva)?.id ?? contas[0].id;
}

/**
 * A conta em que as telas trabalham: a escolhida no seletor (quem atende várias contas) ou a conta única
 * de escrita (`contaEscrita`: com uma conta só, o shell resolve sozinho e `contaAtiva()` é nula, porque
 * não há seletor nem `X-Conta`). É a IDENTIDADE da conta para o estado das telas (a chave `sub|conta` do
 * app, o dono dos dados guardados fora do componente): o operador de conta única que tem a conta trocada
 * muda `contaEscrita`, e só por ela a troca aparece. O `X-Conta` continua saindo de `contaAtiva()`.
 * O SDK não tem evento nem leitura de "conta ativa" (pedido ao shell em specs/pedidos_ao_shell.md): ela
 * é lida do contexto, que avisa por `urbi:contexto-app`.
 */
export function contaDeTrabalho(): number | null {
  return contaAtiva() ?? urbiVerso.contexto?.()?.conta?.contaEscrita ?? null;
}

export function escolherConta(id: number) {
  observarConta();
  try {
    localStorage.setItem(CHAVE_CONTA, String(id));
  } catch {
    /* só não lembra da escolha */
  }
  observarConta();
}

// ---------- Gesto: continuação assíncrona de conta antiga termina em silêncio (issue #144) ----------
//
// Um GESTO é o que o usuário dispara de uma vez (um clique que abre diálogo, uma carga auxiliar, um laço
// de envios, uma cadeia de awaits). Ele pertence à conta de trabalho em que começou. Se, em qualquer
// await, a conta passou a ser outra (o seletor, ou a conta única trocada pelo shell), o gesto termina em
// SILÊNCIO: não envia nova escrita, não grava estado nem tela, não avisa (sucesso ou erro) e não navega.
// É o padrão do Estúdio (`esperar`/`vivo`, estudio.ts), sem a instância: a vida do gesto é a ÉPOCA da
// conta, que avança a cada troca observada. Por época, e não só pelo id da conta, uma ida e volta A → B
// → A no meio do gesto também o encerra.
//
// Quem descarta a RESPOSTA (ou o erro) de um pedido é o guarda único do envio (`chamarApi`, abaixo): ele
// vale para toda tela, esteja ela aberta ou não. O gesto cobre o que vem ANTES de um envio e não passa por
// ele: o diálogo aberto em A que só responde em B, a leitura de arquivo, a confirmação.

let epocaDaConta = 0;
let contaVista: number | null | undefined;

/** Lê a conta de trabalho; mudou desde a última leitura, a época avança. Devolve a época vigente. */
function observarConta(): number {
  let conta: number | null = null;
  try {
    conta = contaDeTrabalho();
  } catch {
    /* sem contexto (fora do shell): conta nenhuma */
  }
  if (contaVista !== undefined && conta !== contaVista) epocaDaConta++;
  contaVista = conta;
  return epocaDaConta;
}

/** O appId deste app: o `urbi:contexto-app` de outra app (ou de fora de app, `appId: null`) não é nosso. */
export const APP_ID = 'portal_corretor';

/** O evento `urbi:contexto-app` é do contexto deste app (`detail.appId`, autenticacao.md). */
export function ehContextoDoApp(e: Event): boolean {
  return (e as CustomEvent<{ appId?: string | null } | null>).detail?.appId === APP_ID;
}

// A troca da conta única pelo shell chega por este evento; a do seletor passa por `escolherConta`.
// Assim a época avança mesmo sem nenhum gesto conferindo no meio da troca.
if (typeof window !== 'undefined') {
  window.addEventListener?.('urbi:contexto-app', (e) => {
    if (ehContextoDoApp(e)) observarConta();
  });
  // Rede de segurança do guarda do envio: uma continuação que não tratou `ContaTrocada` (um `void
  // promessa` sem `.catch`) não vira "erro não tratado" no console. As outras rejeições seguem como são.
  window.addEventListener?.('unhandledrejection', (e) => {
    if (ehContaTrocada(e.reason)) e.preventDefault();
  });
}

/** A conta mudou no meio do gesto ou com o pedido em voo: a continuação para aqui, em silêncio. */
export class ContaTrocada extends Error {
  constructor() {
    super('conta_trocada');
    this.name = 'ContaTrocada';
  }
}

/** O erro é a conta trocada (do guarda do envio ou de um gesto): não é falha para mostrar. */
export function ehContaTrocada(e: unknown): e is ContaTrocada {
  return e instanceof ContaTrocada;
}

/**
 * O tratador comum dos erros de continuação: `ContaTrocada` some em silêncio (sem alerta, aviso, toast,
 * estado de erro nem efeito colateral) e qualquer outro erro vai para `tratar`. Serve em `.catch(...)` e
 * em `catch (e) { return seNaoContaTrocada(tratar)(e); }`.
 */
export function seNaoContaTrocada<R>(tratar: (e: unknown) => R): (e: unknown) => R | undefined {
  return (e) => (ehContaTrocada(e) ? undefined : tratar(e));
}

export interface Gesto {
  /** A conta de trabalho ainda é a do início do gesto (nenhuma troca desde então). */
  vivo(): boolean;
  /** Espera `passo` e devolve o resultado (ou o erro) só se o gesto segue vivo; senão lança `ContaTrocada`. */
  esperar<T>(passo: T | PromiseLike<T>): Promise<T>;
  /** O erro é do gesto encerrado (ou o gesto já não vive): não vira aviso na tela. */
  encerrado(e: unknown): boolean;
}

/** Começa um gesto na conta de trabalho de agora. */
export function gesto(): Gesto {
  const minha = observarConta();
  const vivo = () => observarConta() === minha;
  return {
    vivo,
    async esperar<T>(passo: T | PromiseLike<T>): Promise<T> {
      let r: T;
      try {
        r = await passo;
      } catch (e) {
        if (!vivo()) throw new ContaTrocada();
        throw e;
      }
      if (!vivo()) throw new ContaTrocada();
      return r;
    },
    encerrado: (e) => e instanceof ContaTrocada || !vivo(),
  };
}

/** Roda `fn` num gesto novo. Conta trocada no meio: termina em silêncio e devolve `undefined`. */
export async function noGesto<T>(fn: (g: Gesto) => Promise<T>): Promise<T | undefined> {
  const g = gesto();
  try {
    return await fn(g);
  } catch (e) {
    if (g.encerrado(e)) return undefined;
    throw e;
  }
}

function comConta(opcoes: RequestInit = {}): RequestInit {
  const conta = contaAtiva();
  if (conta === null) return opcoes;
  return { ...opcoes, headers: { ...Object.fromEntries(new Headers(opcoes.headers).entries()), 'X-Conta': String(conta) } };
}

/**
 * O GUARDA ÚNICO DO ENVIO (issue #144). Todo pedido do app sai daqui e guarda a época da conta de trabalho
 * do momento do envio. Na volta, com resposta ou com erro, se a conta mudou (o seletor, a conta única
 * trocada pelo shell, ou uma ida e volta A → B → A), a promessa rejeita com `ContaTrocada`: nunca entrega
 * o dado da conta antiga, nem o erro dela, a quem continua. Quem trata erro deixa `ContaTrocada` passar em
 * silêncio (`ehContaTrocada`, `seNaoContaTrocada`, `Gesto.encerrado`).
 */
async function guardado<T>(pedido: () => Promise<T>): Promise<T> {
  const epoca = observarConta();
  let r: T;
  try {
    r = await pedido();
  } catch (e) {
    if (observarConta() !== epoca) throw new ContaTrocada();
    throw e;
  }
  if (observarConta() !== epoca) throw new ContaTrocada();
  return r;
}

/** `urbiVerso.api` com a conta ativa declarada e o guarda do envio. Use em toda rota autenticada do app. */
export const chamarApi = (rota: string, opcoes?: RequestInit) => guardado(() => urbiVerso.api(rota, comConta(opcoes)));
export const chamarFetch = (rota: string, opcoes?: RequestInit) => guardado(() => urbiVerso.fetch(rota, comConta(opcoes)));

/**
 * A busca de um campo `busca` de diálogo, presa ao gesto que abriu o diálogo (issue #157). Com a conta
 * trocada enquanto o diálogo está aberto, ela não lista mais nada (nem consulta a conta nova); a resposta
 * que chega depois da troca também vira lista vazia. Assim o diálogo aberto em A nunca mostra dados de B.
 */
export function buscaDoGesto(g: Gesto, rota: string, rotulo: (l: Record<string, any>) => string) {
  return async (termo: string, signal: AbortSignal): Promise<{ valor: number; rotulo: string }[]> => {
    if (!g.vivo()) return [];
    try {
      const r = await g.esperar(chamarApi(`${rota}?busca=${encodeURIComponent(termo)}`, { signal }));
      return (r?.dados ?? []).map((l: Record<string, any>) => ({ valor: Number(l.id), rotulo: rotulo(l) }));
    } catch (e) {
      if (g.encerrado(e)) return [];
      throw e;
    }
  };
}

export async function enviar(metodo: 'POST' | 'PUT' | 'PATCH', rota: string, corpo?: unknown) {
  return chamarApi(rota, {
    method: metodo,
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Leitura do funil (quadro, etapas, playbook) que prepara a conta nova (issue #32): os GET não gravam, e
 * respondem `preparar: true` quando a conta ainda não tem etapas ou abordagens. Aí a tela pede a escrita
 * (`POST /funil/preparar`, idempotente) e lê de novo, uma vez. Se a preparação falhar, fica a leitura.
 */
export async function lerPreparandoFunil(rota: string): Promise<any> {
  const r = await chamarApi(rota);
  if (!r?.preparar) return r;
  try {
    await enviar('POST', '/funil/preparar');
  } catch (e) {
    if (ehContaTrocada(e)) throw e;
    console.error('[portal_corretor]', e);
    return r;
  }
  return chamarApi(rota);
}

/** A frase do erro para a tela: nunca a mensagem crua da plataforma (#177, `fraseDoErro` em `estados.ts`). */
export function mensagemDeErro(e: unknown): string {
  return fraseDoErro(e);
}

// ---------- Formulário que salva sem perder o digitado (issue #187) ----------
//
// O `urbiVerso.formulario` só coleta e fecha ao confirmar; a gravação é da app, depois do `await`. Quando o
// servidor recusa (422 DADOS_INVALIDOS, 409 DUPLICATA, outro código de domínio, ou a rede/5xx), o SDK
// documenta o caminho: a app avisa e reabre o formulário com os valores que recebeu
// (ui-componentes-conteudo.md, "Fora do formulário"). É o que este laço faz, para toda tela: reabre com os
// mesmos valores e a frase do erro (`fraseDoErro`) no `mensagem`, até salvar ou o corretor cancelar. A conta
// trocada (o gesto encerrado) termina em silêncio. O erro por campo dentro do diálogo é pedido ao shell
// (specs/pedidos_ao_shell.md, pedido 30).

/** O id do registro que já existe, quando a recusa é `DUPLICATA` com o id em `detalhes[0]`. */
export function idDaDuplicata(e: unknown): number | null {
  const falha = (e ?? {}) as { codigo?: string; detalhes?: unknown[] };
  const id = falha.codigo === 'DUPLICATA' ? Number(falha.detalhes?.[0]) : NaN;
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** A mensagem do formulário reaberto: o erro primeiro e, embaixo, a explicação que o formulário já tinha. */
export function mensagemDaRecusa(e: unknown, original?: string): string {
  const erro = `Não foi possível salvar: ${fraseDoErro(e)} Confira e tente de novo.`;
  return original ? `${erro}\n\n${original}` : erro;
}

/**
 * Os campos com os valores que o corretor digitou (a chave que veio na resposta). No `busca`, o texto do
 * valor escolhido vem do que a própria busca mostrou (`rotulos`), para o campo não reabrir com `#<id>`.
 */
export function camposComValores(campos: CampoFormulario[], valores: Record<string, unknown>, rotulos: Map<string, Map<number, string>> = new Map()): CampoFormulario[] {
  return campos.map((c) => {
    if (!(c.nome in valores)) return c;
    const valor = valores[c.nome];
    if (c.tipo === 'busca') {
      const n = typeof valor === 'number' ? valor : null;
      const rotuloValor = n === null ? undefined : rotulos.get(c.nome)?.get(n) ?? (n === c.valor ? c.rotuloValor : undefined);
      return { ...c, valor: n, rotuloValor };
    }
    return { ...c, valor } as CampoFormulario;
  });
}

/** O `buscar` de cada campo `busca` guarda o texto das opções que mostrou (para reabrir com ele). */
function lembrandoRotulos(campos: CampoFormulario[], rotulos: Map<string, Map<number, string>>): CampoFormulario[] {
  return campos.map((c) => {
    if (c.tipo !== 'busca') return c;
    const buscar = c.buscar;
    return {
      ...c,
      buscar: async (termo: string, sinal: AbortSignal) => {
        const r = await buscar(termo, sinal);
        const m = rotulos.get(c.nome) ?? new Map<number, string>();
        for (const o of r ?? []) m.set(o.valor, o.rotulo);
        rotulos.set(c.nome, m);
        return r;
      },
    };
  });
}

export interface OpcoesFormularioQueSalva<R> {
  titulo: string;
  /** Os campos; como função, recebe o digitado (vazio na primeira vez) e monta os campos com ele. */
  campos: CampoFormulario[] | ((valores: Record<string, unknown>) => CampoFormulario[]);
  /** Grava. Rejeitou (inclusive validação local com `throw new Error('frase')`): o formulário reabre. */
  salvar: (valores: Record<string, any>) => Promise<R> | R;
  mensagem?: string;
  rotuloConfirmar?: string;
  /** O gesto de quem chamou (que pode ter esperado antes de abrir), ou um novo. */
  gesto?: Gesto;
  /** Aviso do sucesso (padrão "Salvo."); `null`: quem chamou avisa. */
  aviso?: string | null;
  /** Na `DUPLICATA` com o id do existente: oferece abri-lo ("Abrir <nome>") em vez de corrigir. */
  duplicata?: { titulo: string; pergunta: string; abrir: (id: number) => void };
}

/**
 * Abre o formulário, salva e, se o servidor recusar, REABRE com o digitado e a frase do erro, até salvar ou
 * o corretor cancelar. Devolve o que `salvar` devolveu (ou `{}`), ou `null` se cancelou, abriu o existente
 * da duplicata, o diálogo quebrou (com alerta) ou a conta mudou no meio (em silêncio). Nunca rejeita.
 */
export async function formularioQueSalva<R = any>(o: OpcoesFormularioQueSalva<R>): Promise<R | null> {
  const g = o.gesto ?? gesto();
  if (!g.vivo()) return null;
  const rotulos = new Map<string, Map<number, string>>();
  let valores: Record<string, unknown> = {};
  let mensagem = o.mensagem;
  let reaberto = false;
  for (;;) {
    const base = typeof o.campos === 'function' ? o.campos(valores) : o.campos;
    const campos = lembrandoRotulos(reaberto ? camposComValores(base, valores, rotulos) : base, rotulos);
    let v: Awaited<ReturnType<UrbiVersoAPI['formulario']>>;
    // O diálogo tem o próprio aviso: a falha dele não é "não foi possível salvar" (nada foi enviado), e não
    // volta como rejeição para quem chamou (`void formularioEnviar(...).then(...)` ficaria com rejeição solta).
    try {
      v = await g.esperar(urbiVerso.formulario({ titulo: o.titulo, campos, mensagem, ...(o.rotuloConfirmar ? { rotuloConfirmar: o.rotuloConfirmar } : {}) }));
    } catch (e) {
      if (g.encerrado(e)) return null;
      await urbiVerso.alertar({ titulo: 'Não foi possível abrir o formulário', mensagem: mensagemDeErro(e), tipo: 'erro' });
      return null;
    }
    if (!v) return null;
    valores = v;
    reaberto = true;
    let r: R | undefined;
    try {
      r = await g.esperar((async () => o.salvar(v))());
    } catch (e) {
      // Conta trocada com o envio em voo: nada é avisado nem reaberto na outra.
      if (g.encerrado(e)) return null;
      const existente = o.duplicata ? idDaDuplicata(e) : null;
      if (existente && o.duplicata) {
        const texto = e instanceof Error ? e.message : '';
        const nome = /telefone: (.+)\.$/.exec(texto)?.[1] ?? 'o cadastro';
        let abrir = false;
        try {
          abrir = await g.esperar(urbiVerso.confirmar({ titulo: o.duplicata.titulo, mensagem: `${texto} ${o.duplicata.pergunta}`, rotuloConfirmar: `Abrir ${nome}`, rotuloCancelar: 'Corrigir' }));
        } catch (erroDoDialogo) {
          if (g.encerrado(erroDoDialogo)) return null;
        }
        if (abrir) {
          o.duplicata.abrir(existente);
          return null;
        }
      }
      mensagem = mensagemDaRecusa(e, o.mensagem);
      continue;
    }
    // Fora do try: o que corre depois de gravar não pode reabrir o formulário (o reenvio duplicaria).
    if (o.aviso !== null) urbiVerso.notificar(o.aviso ?? 'Salvo.', 'sucesso');
    return (r ?? {}) as R;
  }
}

/**
 * A falha pode ter vindo DEPOIS de o servidor gravar (#187, dívida do #207): rede caída, 5xx sem código do
 * app (o 500 de um evento publicado depois do commit, o 502/504 do caminho). Reenviar um POST que não é
 * idempotente duplicaria. A recusa do app (4xx, ou 5xx com o código dele, como `IA_INDISPONIVEL`) e o
 * `Error` da própria tela não são ambíguos: nada foi gravado. Conta trocada também não (termina em silêncio).
 */
export function falhaAmbigua(e: unknown): boolean {
  if (ehContaTrocada(e)) return false;
  const f = (e ?? {}) as { status?: unknown; codigo?: unknown; name?: unknown };
  if (typeof f.status === 'number') return f.status === 0 || (f.status >= 500 && !(typeof f.codigo === 'string' && CODIGOS_DO_APP.has(f.codigo)));
  return f.name === 'TypeError' || !(e instanceof Error);
}

/** Telefone de outro contato (`409 DUPLICATA` com o id dele): **Abrir <nome>** ou corrigir (#187). */
export const duplicataDeContato = (abrir: (id: number) => void): NonNullable<OpcoesFormularioQueSalva<unknown>['duplicata']> => ({
  titulo: 'Telefone já cadastrado',
  pergunta: 'Abrir a ficha dele ou corrigir o cadastro?',
  abrir,
});

/**
 * Abre o formulário, envia e avisa; recusado, reabre com o digitado e o erro (`formularioQueSalva`).
 * Devolve a resposta, ou `null` se cancelou, o diálogo quebrou (com alerta) ou a conta mudou no meio (aí em
 * silêncio). Nunca rejeita.
 */
export async function formularioEnviar(
  titulo: string,
  campos: CampoFormulario[],
  metodo: 'POST' | 'PUT' | 'PATCH',
  rota: string,
  ajustar: (v: Record<string, unknown>) => unknown = (v) => v,
  opcoes: { mensagem?: string; rotuloConfirmar?: string; gesto?: Gesto; duplicata?: OpcoesFormularioQueSalva<unknown>['duplicata'] } = {},
): Promise<any> {
  return formularioQueSalva({ titulo, campos, ...opcoes, salvar: (v) => enviar(metodo, rota, ajustar(v)) });
}

export const dataHora = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
export const data = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—');
export const reais = (centavos: number | null | undefined) =>
  centavos === null || centavos === undefined ? '—' : (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * Dia (campo data) e hora (texto "HH:MM") para ISO; o formulário não tem campo de data e hora.
 * Sem dia: null. Sem hora: 09:00. Hora fora do padrão devolve o texto cru, que o backend recusa
 * com mensagem, em vez de salvar sem data calado.
 */
export function juntarDataHora(dia: unknown, hora: unknown): string | null {
  if (typeof dia !== 'string' || !dia) return null;
  const bruta = typeof hora === 'string' ? hora.trim() : '';
  const m = /^(\d{1,2})[:h](\d{2})?$/.exec(bruta);
  if (bruta && (!m || Number(m[1]) > 23 || Number(m[2] ?? 0) > 59)) return `${dia} ${bruta}`;
  const h = m ? `${m[1].padStart(2, '0')}:${m[2] ?? '00'}` : '09:00';
  const d = new Date(`${dia}T${h}:00`);
  return Number.isNaN(d.getTime()) ? `${dia} ${bruta}` : d.toISOString();
}

export const ROTULO_TIPO_ATIVIDADE: Record<string, string> = {
  tarefa: 'Tarefa',
  ligacao: 'Ligação',
  mensagem: 'Mensagem',
  visita: 'Visita',
  reuniao: 'Reunião',
  retorno: 'Retorno',
};
export { ROTULO_MOTIVO_PERDA } from '../comum/crm';
export const opcoes = (rotulos: Record<string, string>) => Object.entries(rotulos).map(([valor, rotulo]) => ({ valor, rotulo }));

/**
 * Passo 1 do upload (arquivos.md): manda o arquivo para o staging da coluna e devolve o
 * `upload_id`, que vale 10 minutos. O passo 2 é a rota do app que grava a linha com ele.
 */
export async function subirArquivo(tabela: string, coluna: string, arquivo: File): Promise<number> {
  const form = new FormData();
  form.append('arquivo', arquivo);
  const r = await chamarApi(`/dados/portal_corretor/${tabela}/__upload?coluna=${coluna}`, { method: 'POST', body: form });
  return r.upload_id;
}

export const ROTULO_TIPO_IMOVEL: Record<string, string> = {
  casa: 'Casa',
  apartamento: 'Apartamento',
  lote: 'Lote ou terreno',
  sala: 'Sala comercial',
  loja: 'Loja',
  galpao: 'Galpão',
  rural: 'Rural',
  outro: 'Outro',
};
export const SITUACAO_IMOVEL: Record<string, { rotulo: string; cor: string }> = {
  rascunho: { rotulo: 'Rascunho', cor: 'padrao' },
  captacao: { rotulo: 'Em captação', cor: 'info' },
  ativo: { rotulo: 'Ativo', cor: 'sucesso' },
  reservado: { rotulo: 'Reservado', cor: 'alerta' },
  vendido: { rotulo: 'Vendido', cor: 'info' },
  suspenso: { rotulo: 'Suspenso', cor: 'alerta' },
  encerrado: { rotulo: 'Encerrado', cor: 'padrao' },
};
export const ROTULO_TIPO_MIDIA: Record<string, string> = { foto: 'Foto', video: 'Vídeo', planta: 'Planta', tour: 'Tour', documento: 'Documento' };
export const ROTULO_AMBIENTE: Record<string, string> = {
  fachada: 'Fachada', sala: 'Sala', cozinha: 'Cozinha', quarto: 'Quarto', banheiro: 'Banheiro', varanda: 'Varanda',
  area_lazer: 'Área de lazer', vista: 'Vista', garagem: 'Garagem', planta: 'Planta', outro: 'Outro',
};
/** Cor do `urbi-badge` da nota de qualidade (0–100): ≥ 80 `sucesso` (verde), 60–79 `alerta` (âmbar), < 60 `erro` (vermelho). */
export const corQualidade = (nota: number) => (nota >= 80 ? 'sucesso' : nota >= 60 ? 'alerta' : 'erro');
