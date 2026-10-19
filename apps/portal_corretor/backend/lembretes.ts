import '@urbiverso/sdk/express';
import type { Request } from 'express';
import type { ContextoListener } from '@urbiverso/sdk';
import { CONFIGURACOES_PADRAO } from '../comum/conta';
import { iso } from '../comum/funil';
import { primeiro } from './acesso';

// Lembrete de visita para o corretor (bloco 10, spec 15.1 item 4): notificação na plataforma
// algumas horas antes de cada visita pendente. O lembrete ao cliente vem com o WhatsApp (blocos 6 e 7).

type Linha = Record<string, any>;

/**
 * Agenda o lembrete de uma visita, se ela está pendente e ainda dá tempo. Não guarda o id do
 * agendamento: o listener confere a visita na hora (remarcada, feita, removida ou já lembrada
 * não notifica), então remarcar só agenda outro. Falha aqui não impede de salvar a visita.
 */
export async function programarLembreteVisita(req: Request, atividade: Linha | null): Promise<void> {
  if (!atividade || atividade.tipo !== 'visita' || atividade.status !== 'pendente' || atividade.removido_em || !req.eventos) return;
  const quando = iso(atividade.quando);
  if (!quando) return;
  try {
    const config = await primeiro(req.dados!, 'configuracoes_conta', { chave: 'conta' });
    const horas = Number(config?.lembrete_visita_horas ?? CONFIGURACOES_PADRAO.lembrete_visita_horas);
    if (!horas) return;
    const em = new Date(new Date(quando).getTime() - horas * 3600_000);
    if (em.getTime() <= Date.now() + 60_000) return;
    await req.eventos.agendar('lembrete_visita', { atividade_id: atividade.id, quando }, { em });
  } catch (e) {
    console.warn(`[portal_corretor] lembrete da visita ${atividade.id} não agendado: ${(e as Error).message}`);
  }
}

/** Folga entre a hora do disparo e a do lembrete (atraso de entrega do agendamento). */
export const TOLERANCIA_MS = 30 * 60_000;

interface EventoConta {
  payload: Record<string, any>;
  conta_id?: number | string | null;
}

/** Hora do lembrete: notifica o responsável se a visita continua a mesma, pendente e sem lembrete. */
export async function aoLembreteVisita(evento: EventoConta, ctx: ContextoListener) {
  const conta = evento.conta_id ? Number(evento.conta_id) : null;
  if (!conta || !ctx.dados?.comConta) return;
  const quando = String(evento.payload.quando ?? '');
  const visita = await ctx.dados.comConta(conta, async (trx): Promise<Linha | null> => {
    const a = (await trx.varrerTudo('atividades', { filtros: { conta_id: conta, id: Number(evento.payload.atividade_id) }, maximo: 1 }))[0];
    if (!a || a.removido_em || a.tipo !== 'visita' || a.status !== 'pendente') return null;
    if (iso(a.quando) !== quando || iso(a.lembrete_enviado_para) === quando) return null;
    // Visita que já passou (disparo atrasado) não é lembrada.
    if (Date.now() >= Date.parse(quando)) return null;
    // O prazo vale na hora: desligado (0) ou trocado depois do agendamento, este disparo não notifica.
    const config = (await trx.varrerTudo('configuracoes_conta', { filtros: { conta_id: conta, chave: 'conta' }, maximo: 1 }))[0];
    const horas = Number(config?.lembrete_visita_horas ?? CONFIGURACOES_PADRAO.lembrete_visita_horas);
    if (!horas || Math.abs(Date.now() - (Date.parse(quando) - horas * 3600_000)) > TOLERANCIA_MS) return null;
    // Gravação condicionada: dois disparos ao mesmo tempo não notificam duas vezes.
    const guarda = a.lembrete_enviado_para ? { lembrete_enviado_para: iso(a.lembrete_enviado_para) } : { 'lembrete_enviado_para[nulo]': 'true' };
    if (!(await trx.atualizarSe('atividades', a.id, { lembrete_enviado_para: quando }, guarda))) return null;
    const contato = a.contato_id ? (await trx.varrerTudo('contatos', { filtros: { conta_id: conta, id: a.contato_id }, maximo: 1 }))[0] : null;
    return { ...a, contato_nome: contato && !contato.anonimizado_em ? contato.nome : null };
  });
  if (!visita || !ctx.notificacoes) return;
  const hora = new Date(quando).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const partes = [`Lembrete de visita: ${visita.titulo}`, hora, visita.contato_nome, visita.local].filter(Boolean);
  await ctx.notificacoes.notificar(Number(visita.responsavel_id), partes.join(' · ').slice(0, 300), { rota: 'agenda' });
}
