import type { CampoFormulario, UrbiVersoAPI } from '@urbiverso/sdk';

declare const urbiVerso: UrbiVersoAPI;

// Apoio comum das telas: chamada com corpo JSON, mensagem de erro com os detalhes da validação e
// formatação de data e dinheiro em pt-BR. Chip, cartão de imóvel, estado na URL e "mais" moram em
// `visual.ts` e saem daqui também.
export * from './visual.js';

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

// A troca da conta única pelo shell chega por este evento; a do seletor passa por `escolherConta`.
// Assim a época avança mesmo sem nenhum gesto conferindo no meio da troca.
if (typeof window !== 'undefined') window.addEventListener?.('urbi:contexto-app', () => void observarConta());

/** A conta mudou no meio do gesto: a continuação para aqui, em silêncio. */
export class ContaTrocada extends Error {
  constructor() {
    super('conta_trocada');
    this.name = 'ContaTrocada';
  }
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

/** `urbiVerso.api` com a conta ativa declarada. Use em toda rota autenticada do app. */
export const chamarApi = (rota: string, opcoes?: RequestInit) => urbiVerso.api(rota, comConta(opcoes));
export const chamarFetch = (rota: string, opcoes?: RequestInit) => urbiVerso.fetch(rota, comConta(opcoes));

export async function enviar(metodo: 'POST' | 'PUT' | 'PATCH', rota: string, corpo?: unknown) {
  return chamarApi(rota, {
    method: metodo,
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
    headers: { 'Content-Type': 'application/json' },
  });
}

export function mensagemDeErro(e: unknown): string {
  const falha = e as Error & { detalhes?: string[]; codigo?: string };
  // DUPLICATA traz o id do contato existente em `detalhes`: não é texto para o usuário.
  if (falha.codigo === 'DUPLICATA') return falha.message;
  return falha.detalhes?.length ? falha.detalhes.join('\n') : falha.message;
}

/**
 * Abre o formulário, envia e avisa. Devolve a resposta, ou `null` se cancelou, falhou ou a conta mudou
 * no meio (aí em silêncio).
 */
export async function formularioEnviar(
  titulo: string,
  campos: CampoFormulario[],
  metodo: 'POST' | 'PUT' | 'PATCH',
  rota: string,
  ajustar: (v: Record<string, unknown>) => unknown = (v) => v,
  opcoes: { mensagem?: string; rotuloConfirmar?: string; gesto?: Gesto } = {},
) {
  // O gesto de quem chamou (que pode ter esperado antes de abrir o formulário), ou um novo.
  const { gesto: doChamador, ...doFormulario } = opcoes;
  const g = doChamador ?? gesto();
  try {
    if (!g.vivo()) return null;
    const valores = await g.esperar(urbiVerso.formulario({ titulo, campos, ...doFormulario }));
    if (!valores) return null;
    const r = await g.esperar(enviar(metodo, rota, ajustar(valores)));
    urbiVerso.notificar('Salvo.', 'sucesso');
    return r ?? {};
  } catch (e) {
    // Conta trocada com o formulário aberto ou o envio em voo: nada é gravado nem avisado na outra.
    if (g.encerrado(e)) return null;
    await urbiVerso.alertar({ titulo: 'Não foi possível salvar', mensagem: mensagemDeErro(e), tipo: 'erro' });
    return null;
  }
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
