import '@urbiverso/sdk/express';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { HelperDados } from '@urbiverso/sdk';

// Papéis do manifesto. `corretor` e `negociador` são externos (bloco `roles_externos`), `operacao` é
// da equipe (bloco `roles`). Permissão sempre por `rolesApp`, nunca por tipo de usuário (CLAUDE.md).
export type Papel = 'corretor' | 'operacao' | 'negociador';

export function erro(res: Response, status: number, codigo: string, mensagem: string, detalhes?: string[]) {
  return res.status(status).json({ erro: true, codigo, mensagem, ...(detalhes ? { detalhes } : {}) });
}

/**
 * Barra a rota para quem não tem nenhum dos papéis. O gate método→nível do shell já rodou antes.
 * `nivelApp: 'admin'` vale por todos os papéis: o SDK não entrega os papéis ao admin (e o papel
 * externo `corretor` nem pode ser atribuído a quem é da equipe), então sem isso o admin não
 * alcançaria nenhuma tela para configurar e acompanhar o app.
 */
export function exigirPapel(...papeis: Papel[]): RequestHandler {
  return (req, res, next) => {
    const tem =
      req.contexto?.nivelApp === 'admin' || req.contexto?.rolesApp?.some((p) => (papeis as string[]).includes(p));
    if (!tem) return erro(res, 403, 'SEM_PAPEL', 'Você não tem o papel necessário para esta área do app.');
    next();
  };
}

/** Vale pelo corretor da conta: o papel `corretor` ou o admin do app (que vale por todos os papéis). */
export const ehCorretor = (req: Request) => req.contexto?.nivelApp === 'admin' || !!req.contexto?.rolesApp?.includes('corretor');

/**
 * Negociador humano (D7, spec 11.6): tem o papel `negociador` e não vale pelo corretor. Vê só as
 * negociações atribuídas a ele, lê o mandato completo delas (spec 14, "Mandato: ler"), não o muda e
 * nunca aceita o acordo final.
 */
export const soNegociador = (req: Request) => !ehCorretor(req) && !!req.contexto?.rolesApp?.includes('negociador');

/**
 * Sem conta para trabalhar: `negar`, ou `escopado` com o conjunto vazio, que é o estado legítimo de
 * quem é da equipe e não atende nenhuma conta (contas.md § Todo usuário externo tem uma conta). Aí a
 * leitura volta vazia e a escrita cai em `CONTA_NAO_INFORMADA`: a tela explica em vez disso.
 */
export function semConta(req: Request) {
  const c = req.contexto;
  return c?.resolucao === 'negar' || (c?.resolucao === 'escopado' && Array.isArray(c.contas) && c.contas.length === 0);
}

export const MENSAGEM_VARIAS_CONTAS =
  'Você atende mais de uma conta: escolha a conta no seletor do alto da tela (ou envie o cabeçalho X-Conta).';

export const MENSAGEM_SEM_CONTA =
  'Seu usuário não está associado a nenhuma conta. Para usar o app como corretor, associe-se a uma conta em Admin › Acesso › Contas (ou peça a quem cuida das contas da plataforma).';

/**
 * Guardas da área do corretor num router montado na raiz: papel `corretor` e conta resolvida.
 * Valem só nos prefixos dados, para não alcançar as rotas dos outros routers.
 */
export function guardarCorretor(router: { use: (caminho: string[], h: RequestHandler) => unknown }, prefixos: string[]) {
  router.use(prefixos, exigirPapel('corretor'));
  router.use(prefixos, (req, res, next) => (semConta(req) ? erro(res, 409, 'SEM_CONTA', MENSAGEM_SEM_CONTA) : next()));
}

/**
 * Guardas da negociação (D7, spec 11.6 e 14), num router montado na raiz:
 * - `/negociacoes*` e `/negociador/*`: papel `corretor` ou `negociador`, e conta resolvida;
 * - `/negociador/*` é do corretor (ajustes, simulador, números, convites e atribuições), salvo a sonda
 *   da IA (`/negociador/ia`), que a tela do negociador também usa;
 * - `/negociacoes/:id*`: o negociador só passa na negociação atribuída a ele (atribuição ativa com o
 *   `usuario_id` dele). Fora da atribuição, "não encontrado" (404), como a de outra conta.
 * A lista (`GET /negociacoes`) filtra pelas atribuições na própria rota.
 */
export function guardarNegociacao(router: {
  use: (caminho: string | string[], h: RequestHandler) => unknown;
}) {
  const prefixos = ['/negociacoes', '/negociador'];
  router.use(prefixos, exigirPapel('corretor', 'negociador'));
  router.use(prefixos, (req, res, next) => (semConta(req) ? erro(res, 409, 'SEM_CONTA', MENSAGEM_SEM_CONTA) : next()));
  router.use('/negociador', (req, res, next) =>
    req.path === '/ia' || ehCorretor(req) ? next() : erro(res, 403, 'SEM_PAPEL', 'Esta área é do corretor da conta.'),
  );
  router.use('/negociacoes/:id', (req, res, next) => {
    if (!soNegociador(req)) return next();
    const nid = Number(req.params.id);
    const usuario = req.contexto?.usuario.id;
    // Os dois routers da negociação montam esta guarda: a segunda passagem não relê.
    const conferida = (req as Request & { negociacaoAtribuida?: number }).negociacaoAtribuida;
    if (conferida !== undefined && conferida === nid) return next();
    if (!Number.isInteger(nid) || nid <= 0 || !usuario) return erro(res, 404, 'NAO_ENCONTRADO', 'Negociação não encontrada.');
    atribuicaoAtiva(req.dados!, nid, usuario).then(
      (a) => {
        if (!a) return erro(res, 404, 'NAO_ENCONTRADO', 'Negociação não encontrada.');
        (req as Request & { negociacaoAtribuida?: number }).negociacaoAtribuida = nid;
        next();
      },
      (e) => next(e),
    );
  });
}

/** A atribuição ativa da negociação a este usuário, ou `null`. Sob segregação, só a da conta. */
export async function atribuicaoAtiva(dados: HelperDados, negociacaoId: number, usuarioId: number) {
  const linhas = await dados.varrerTudo('atribuicoes_negociacao', { filtros: { negociacao_id: negociacaoId, usuario_id: usuarioId, ativa: true }, maximo: 10 });
  return linhas[0] ?? null;
}

/** Ids das negociações atribuídas (ativas) ao usuário, na conta. */
export async function negociacoesAtribuidas(dados: HelperDados, usuarioId: number): Promise<number[]> {
  const linhas = await dados.varrerTudo('atribuicoes_negociacao', { filtros: { usuario_id: usuarioId, ativa: true }, maximo: 2000 });
  return [...new Set(linhas.map((l) => Number(l.negociacao_id)))];
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
        // Quem atende várias contas precisa declarar a ativa (`X-Conta`); a tela faz isso pelo seletor.
        // Só diz "várias contas" quando é o caso: com nenhuma, explica isso (o shell usa o mesmo código).
        if (falha.codigo === 'CONTA_NAO_INFORMADA') {
          if (semConta(req)) return erro(res, 409, 'SEM_CONTA', MENSAGEM_SEM_CONTA);
          return erro(res, 400, falha.codigo, MENSAGEM_VARIAS_CONTAS);
        }
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
