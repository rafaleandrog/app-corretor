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

export function escolherConta(id: number) {
  try {
    localStorage.setItem(CHAVE_CONTA, String(id));
  } catch {
    /* só não lembra da escolha */
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

/** Abre o formulário, envia e avisa. Devolve a resposta, ou `null` se cancelou ou falhou. */
export async function formularioEnviar(
  titulo: string,
  campos: CampoFormulario[],
  metodo: 'POST' | 'PUT' | 'PATCH',
  rota: string,
  ajustar: (v: Record<string, unknown>) => unknown = (v) => v,
  opcoes: { mensagem?: string; rotuloConfirmar?: string } = {},
) {
  const valores = await urbiVerso.formulario({ titulo, campos, ...opcoes });
  if (!valores) return null;
  try {
    const r = await enviar(metodo, rota, ajustar(valores));
    urbiVerso.notificar('Salvo.', 'sucesso');
    return r ?? {};
  } catch (e) {
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
export const ROTULO_MOTIVO_PERDA: Record<string, string> = {
  preco: 'Preço',
  localizacao: 'Localização',
  financiamento: 'Financiamento',
  desistiu: 'Desistiu',
  comprou_com_outro: 'Comprou com outro corretor',
  sem_resposta: 'Sem resposta',
  outro: 'Outro',
};
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
