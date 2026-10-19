import '@urbiverso/sdk/express';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { HelperDados } from '@urbiverso/sdk';

// Papéis do manifesto. `corretor` é externo (bloco `roles_externos`), `operacao` é da equipe
// (bloco `roles`). Permissão sempre por `rolesApp`, nunca por tipo de usuário (CLAUDE.md).
export type Papel = 'corretor' | 'operacao';

export function erro(res: Response, status: number, codigo: string, mensagem: string, detalhes?: string[]) {
  return res.status(status).json({ erro: true, codigo, mensagem, ...(detalhes ? { detalhes } : {}) });
}

/** Barra a rota para quem não tem nenhum dos papéis. O gate método→nível do shell já rodou antes. */
export function exigirPapel(...papeis: Papel[]): RequestHandler {
  return (req, res, next) => {
    const tem = req.contexto?.rolesApp?.some((p) => (papeis as string[]).includes(p));
    if (!tem) return erro(res, 403, 'SEM_PAPEL', 'Você não tem o papel necessário para esta área do app.');
    next();
  };
}

/** Express 4 não captura promessa rejeitada: todo handler assíncrono passa por aqui. */
export function assincrono(fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch((e: unknown) => {
      const falha = e as { codigo?: string; status?: number; message?: string };
      // ErroProvisionamento (convites) traz `codigo` e `status` prontos; o resto é falha interna.
      if (falha?.codigo && typeof falha.status === 'number') {
        return erro(res, falha.status, falha.codigo, falha.message ?? 'Não foi possível concluir.');
      }
      next(e);
    });
  };
}

/** Primeira linha que casa com o filtro, ou `null`. Sob segregação o RLS já restringe à conta. */
export async function primeiro(dados: HelperDados, tabela: string, filtros: Record<string, unknown>) {
  const r = await dados.listar(tabela, { filtros, por_pagina: 1 });
  return r.dados[0] ?? null;
}
