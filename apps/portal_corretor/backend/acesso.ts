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
      const falha = e as { codigo?: string; status?: number; message?: string; code?: string };
      // ErroProvisionamento (convites) traz `codigo` e, pela doc, `status` (contas.md § Superfície);
      // o tipo do SDK só declara `codigo`, então sem `status` a recusa vira 400 sem perder o código.
      if (typeof falha?.codigo === 'string') {
        const status = typeof falha.status === 'number' ? falha.status : 400;
        return erro(res, status, falha.codigo, falha.message ?? 'Não foi possível concluir.');
      }
      // Violação de CHECK (`formato`/`intervalo` do schema) chega crua do banco.
      if (falha?.code === '23514') return erro(res, 422, 'DADOS_INVALIDOS', 'Um dos valores está fora do formato aceito.');
      next(e);
    });
  };
}

/** Primeira linha que casa com o filtro, ou `null`. Sob segregação o RLS já restringe à conta. */
export async function primeiro(dados: HelperDados, tabela: string, filtros: Record<string, unknown>) {
  const r = await dados.listar(tabela, { filtros, por_pagina: 1 });
  return r.dados[0] ?? null;
}

/**
 * Grava a única linha que casa com `filtros` (ex.: a linha da conta, o perfil do usuário): atualiza
 * se existe, cria se não. Não usa `criarOuAtualizar` porque, em tabela segregada, o único declarado
 * vira composto com a conta e o SDK não documenta o alvo do upsert nesse caso. A corrida de duas
 * criações simultâneas cai no único (23505) e vira atualização da linha que venceu.
 */
export async function salvarUnico(
  dados: HelperDados,
  tabela: string,
  filtros: Record<string, unknown>,
  valores: Record<string, unknown>,
): Promise<Record<string, any>> {
  const atual = await primeiro(dados, tabela, filtros);
  if (atual) return (await dados.atualizar(tabela, atual.id, valores)) ?? atual;
  try {
    return await dados.criar(tabela, { ...filtros, ...valores });
  } catch (e) {
    if ((e as { code?: string })?.code !== '23505') throw e;
    const vencedora = await primeiro(dados, tabela, filtros);
    if (!vencedora) throw e;
    return (await dados.atualizar(tabela, vencedora.id, valores)) ?? vencedora;
  }
}
