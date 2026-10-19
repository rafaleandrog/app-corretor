import type { AoIniciarApp, ContextoListener } from '@urbiverso/sdk';
import { CONFIGURACOES_PADRAO } from '../comum/conta';

// Semente de demonstração (spec 12.2), idempotente: roda a cada boot e só cria o que falta.
// Alcança apenas as contas cujo nome termina em "(demo)" — as contas de teste da equipe, criadas à
// mão na instância (migração e hook não criam conta nem usuário). Nunca toca conta de corretor real.
export const SUFIXO_DEMO = '(demo)';

export function ehContaDemo(nome: string): boolean {
  return nome.trim().toLowerCase().endsWith(SUFIXO_DEMO);
}

export async function semear(ctx: ContextoListener): Promise<number> {
  if (!ctx.dados?.comConta || !ctx.contas) return 0;
  const contas = (await ctx.contas.listarAtivas()).filter((c) => ehContaDemo(c.nome));
  for (const conta of contas) {
    await ctx.dados.comConta(conta.id, async (trx) => {
      // Em contexto SISTEMA a leitura enxerga todas as contas: filtrar `conta_id` é obrigatório.
      const temPerfil = await trx.existe('perfil_conta', { conta_id: conta.id, chave: 'conta' });
      if (!temPerfil) {
        await trx.criar('perfil_conta', {
          chave: 'conta',
          tipo: 'corretor_autonomo',
          nome: conta.nome.slice(0, -SUFIXO_DEMO.length).trim() || conta.nome,
        });
      }
      const temConfig = await trx.existe('configuracoes_conta', { conta_id: conta.id, chave: 'conta' });
      if (!temConfig) await trx.criar('configuracoes_conta', { chave: 'conta', ...CONFIGURACOES_PADRAO });
    });
  }
  return contas.length;
}

export const aoIniciar: AoIniciarApp = async (ctx) => {
  await semear(ctx);
};
