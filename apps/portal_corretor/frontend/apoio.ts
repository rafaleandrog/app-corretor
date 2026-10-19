import type { CampoFormulario, UrbiVersoAPI } from '@urbiverso/sdk';

declare const urbiVerso: UrbiVersoAPI;

// Apoio comum das telas: chamada com corpo JSON, mensagem de erro com os detalhes da validação e
// formatação de data e dinheiro em pt-BR.

export async function enviar(metodo: 'POST' | 'PUT' | 'PATCH', rota: string, corpo?: unknown) {
  return urbiVerso.api(rota, {
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

/** `datetime-local`/texto do formulário para ISO; o formulário não tem campo de data e hora. */
export function juntarDataHora(dia: unknown, hora: unknown): string | null {
  if (typeof dia !== 'string' || !dia) return null;
  const h = typeof hora === 'string' && /^\d{1,2}:\d{2}$/.test(hora.trim()) ? hora.trim() : '09:00';
  const d = new Date(`${dia}T${h.padStart(5, '0')}:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export const ROTULO_PAPEL: Record<string, string> = {
  comprador: 'Comprador',
  proprietario: 'Proprietário',
  investidor: 'Investidor',
  parceiro: 'Parceiro',
  fornecedor: 'Fornecedor',
};
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
