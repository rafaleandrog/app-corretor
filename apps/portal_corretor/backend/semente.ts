import type { AoIniciarApp, ContextoListener } from '@urbiverso/sdk';
import { CONFIGURACOES_PADRAO } from '../comum/conta';

// Semente de demonstração (spec 12.2), idempotente: roda a cada boot e só cria o que falta.
// Alcança apenas as contas cujo nome termina em "(demo)" — as contas de teste da equipe, criadas à
// mão na instância (migração e hook não criam conta nem usuário). O critério é o nome: a equipe não
// deve usar o sufixo em conta de corretor real, e a semente só cria o que falta (nunca sobrescreve).
export const SUFIXO_DEMO = '(demo)';

export function ehContaDemo(nome: string): boolean {
  return nome.trim().toLowerCase().endsWith(SUFIXO_DEMO);
}

export async function semear(ctx: ContextoListener): Promise<number> {
  if (!ctx.dados?.comConta || !ctx.contas) return 0;
  const contas = (await ctx.contas.listarAtivas()).filter((c) => ehContaDemo(c.nome));
  const falhas: string[] = [];
  for (const conta of contas) {
    // Uma conta com problema não impede as outras; a falha volta ao shell no fim (iniciar_falhou).
    try {
      await semearConta(ctx, conta);
    } catch (e) {
      falhas.push(`${conta.nome}: ${(e as Error).message}`);
    }
  }
  if (falhas.length) throw new Error(`Semente incompleta — ${falhas.join('; ')}`);
  return contas.length;
}

async function semearConta(ctx: ContextoListener, conta: { id: number; nome: string }) {
  await ctx.dados!.comConta!(conta.id, async (trx) => {
    // Em contexto SISTEMA a leitura enxerga todas as contas: filtrar `conta_id` é obrigatório.
    const temPerfil = await trx.existe('perfil_conta', { conta_id: conta.id, chave: 'conta' });
    if (!temPerfil) {
      await trx.criar('perfil_conta', {
        chave: 'conta',
        tipo: 'corretor_autonomo',
        nome: conta.nome.trim().slice(0, -SUFIXO_DEMO.length).trim() || conta.nome,
      });
    }
    const temConfig = await trx.existe('configuracoes_conta', { conta_id: conta.id, chave: 'conta' });
    if (!temConfig) await trx.criar('configuracoes_conta', { chave: 'conta', ...CONFIGURACOES_PADRAO });
  });
}

export const aoIniciar: AoIniciarApp = async (ctx) => {
  await semear(ctx);
};
