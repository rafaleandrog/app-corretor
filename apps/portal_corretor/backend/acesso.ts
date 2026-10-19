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

/**
 * Guardas da área do corretor num router montado na raiz: papel `corretor` e conta resolvida.
 * Valem só nos prefixos dados, para não alcançar as rotas dos outros routers.
 */
export function guardarCorretor(router: { use: (caminho: string[], h: RequestHandler) => unknown }, prefixos: string[]) {
  router.use(prefixos, exigirPapel('corretor'));
  router.use(prefixos, (req, res, next) => {
    if (req.contexto?.resolucao === 'negar') {
      return erro(res, 409, 'SEM_CONTA', 'Seu usuário não está associado a nenhuma conta. Fale com a equipe da plataforma.');
    }
    next();
  });
}

/** Express 4 não captura promessa rejeitada: todo handler assíncrono passa por aqui. */
export function assincrono(fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch((e: unknown) => {
      const falha = e as { codigo?: string; status?: number; message?: string; code?: string };
      // Erro com `codigo` + `status` (provisionamento, eixo de conta) já diz o HTTP certo. O tipo do
      // SDK só declara `codigo` no ErroProvisionamento: para essas famílias, sem `status`, vira 400
      // sem perder o código. Outro `codigo` sem `status` é erro de programação e segue como 500.
      if (typeof falha?.codigo === 'string') {
        if (typeof falha.status === 'number') {
          return erro(res, falha.status, falha.codigo, falha.message ?? 'Não foi possível concluir.');
        }
        if (/^(PROVISIONA|CONVITE|PLANO|DESPROVISIONA|EMAIL_SISTEMA)_/.test(falha.codigo)) {
          return erro(res, 400, falha.codigo, falha.message ?? 'Não foi possível concluir.');
        }
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
  // `atualizar` devolve `null` quando a linha sumiu entre a leitura e a escrita: aí nada foi
  // gravado, e responder com a linha antiga mentiria (banco-de-dados.md § Não encontrado).
  const atualizarOuFalhar = async (id: number) => {
    const linha = await dados.atualizar(tabela, id, valores);
    if (!linha) throw new Error(`${tabela} ${id}: a linha sumiu durante a gravação`);
    return linha;
  };
  const atual = await primeiro(dados, tabela, filtros);
  if (atual) return atualizarOuFalhar(atual.id);
  try {
    return await dados.criar(tabela, { ...filtros, ...valores });
  } catch (e) {
    if ((e as { code?: string })?.code !== '23505') throw e;
    const vencedora = await primeiro(dados, tabela, filtros);
    if (!vencedora) throw e;
    return atualizarOuFalhar(vencedora.id);
  }
}
