import type { Request } from 'express';
import type { ContextoListener } from '@urbiverso/sdk';

// Publicação dos eventos do catálogo (spec 13.1, D-118). O evento é aviso, nunca a gravação: uma falha
// ao publicar (tipo recusado, barramento fora) vai para o log e a rota segue. Só ids e rótulos fechados
// no payload (o teste `eventos-sem-dado-pessoal` confere); quem precisa do resto lê no banco.

type Payload = Record<string, unknown>;

/** Numa rota: a conta vem do request (conta ativa / `X-Conta`), como o barramento pede. */
export async function publicarEvento(req: Request, tipo: string, payload: Payload): Promise<void> {
  try {
    await req.eventos?.publicar(tipo, payload);
  } catch (e) {
    console.warn(`[portal_corretor] evento ${tipo} não publicado:`, (e as Error).message);
  }
}

/**
 * Em contexto sem usuário (listener, rotina): a conta é obrigatória e explícita (barramento.md). Devolve
 * se o evento saiu, para quem precisa condicionar uma marca a isso (a rotina das autorizações).
 */
export async function publicarDoSistema(ctx: Pick<ContextoListener, 'eventos'>, conta: number, tipo: string, payload: Payload): Promise<boolean> {
  try {
    await ctx.eventos?.publicar(tipo, payload, { conta_id: conta });
    return true;
  } catch (e) {
    console.warn(`[portal_corretor] evento ${tipo} não publicado (conta ${conta}):`, (e as Error).message);
    return false;
  }
}
