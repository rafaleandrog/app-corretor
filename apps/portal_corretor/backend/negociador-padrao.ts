import '@urbiverso/sdk/express';
import type { Request } from 'express';
import type { ConviteApp } from '@urbiverso/sdk';
import { avisoDeAtribuicao, conducaoPadrao, type ConfigEntrada, type Conducao } from '../comum/negociador-gatilhos';

// Negociador padrão da conta e aviso ao negociador humano (issue #135, F3; spec 11.6, D-94, D-108).
// Arquivo-folha: não importa as rotas da negociação, para elas e os listeners o usarem sem ciclo.

type Shell = Request['shell'];
type Notificacoes = Request['notificacoes'];

/** Convites desta conta para negociador (os de admitir em conta existente; o de criar a conta do corretor fica de fora). */
export async function convitesDaConta(shell: NonNullable<Shell>, conta: number, status?: ConviteApp['status']) {
  const r = await shell.externos.listarConvites({ contaAlvo: conta, limite: 200, ...(status ? { status } : {}) });
  return r.convites.filter((c) => c.intencao === 'admitir_existente');
}

/**
 * Quem pode receber negociações nesta conta: quem aceitou o convite da conta (o shell devolve a conta
 * no convite resgatado) e já tem o papel `negociador` no app. Sem o papel, aparece com o aviso.
 */
export async function negociadoresDaConta(shell: NonNullable<Shell>, conta: number) {
  const [resgatados, comPapel] = await Promise.all([convitesDaConta(shell, conta, 'resgatado'), shell.listarUsuariosPorRole('negociador')]);
  const papel = new Set(comPapel.map(Number));
  const vistos = new Map<number, { usuario_id: number; email: string; tem_papel: boolean }>();
  for (const c of resgatados) {
    const uid = Number(c.usuarioId);
    if (!uid || (c.contaId ?? c.contaAlvo) !== conta || vistos.has(uid)) continue;
    vistos.set(uid, { usuario_id: uid, email: c.credencial, tem_papel: papel.has(uid) });
  }
  return [...vistos.values()];
}

/** O shell sabe responder quem são os negociadores da conta? (rota com `req.shell`; o listener pode não ter os convites.) */
export const shellConfereNegociadores = (shell: Shell | null | undefined): shell is NonNullable<Shell> =>
  !!shell && typeof shell.externos?.listarConvites === 'function' && typeof shell.listarUsuariosPorRole === 'function';

/**
 * Quem conduz a negociação nova desta conta (D-94). Com o padrão `humano`, a pessoa só recebe se ainda
 * é negociador desta conta com o papel: quando o shell confere e ela saiu (ou a conferência falha), a
 * negociação nasce com o Negociador IA, o padrão. Sem como conferir (listener sem os convites), vale a
 * pessoa gravada, que foi conferida ao ser escolhida em Ajustes › Negociador; a guarda da negociação
 * (`guardarNegociacao`) continua barrando quem perdeu o papel.
 */
export async function conducaoNova(shell: Shell | null | undefined, conta: number, config: ConfigEntrada): Promise<Conducao> {
  const c = conducaoPadrao(config);
  if (c.conduzida_por !== 'humano' || !shellConfereNegociadores(shell)) return c;
  try {
    const pessoa = (await negociadoresDaConta(shell, conta)).find((n) => n.usuario_id === c.negociador_usuario_id);
    if (pessoa?.tem_papel) return c;
  } catch (e) {
    console.warn(`[portal_corretor] negociador padrão não conferido: ${(e as Error).message}`);
  }
  return { conduzida_por: 'ia', negociador_usuario_id: null };
}

/**
 * Aviso direto ao negociador humano que recebeu a negociação (notificação direta, `req.notificacoes` ou
 * `ctx.notificacoes`): um evento segregado chegaria a todos os membros da conta. O texto leva só o
 * código da negociação, nenhum dado do cliente. Melhor esforço: a atribuição já foi gravada.
 */
export async function avisarNegociador(notificacoes: Notificacoes | null | undefined, usuarioId: number, negociacao: { id?: unknown; codigo?: unknown }) {
  if (!notificacoes || typeof notificacoes.notificar !== 'function') return;
  try {
    const r = await notificacoes.notificar(usuarioId, avisoDeAtribuicao(negociacao.codigo as string | null), {
      // `rota` é opção aceita na notificação direta (barramento.md); a forma relativa ao slug é a do app (ROTA_AGENDA). O shell monta `/portal_corretor/negociacoes?item=<id>`,
      // o endereço do negociador humano (Clientes não abre para ele).
      rota: `negociacoes?item=${Number(negociacao.id)}`,
      payload: { negociacao_id: Number(negociacao.id) },
    });
    if (r && r.ok === false) console.warn(`[portal_corretor] aviso ao negociador ${usuarioId} não entregue: ${r.erro ?? 'sem motivo'}`);
  } catch (e) {
    console.warn(`[portal_corretor] aviso ao negociador ${usuarioId} não enviado: ${(e as Error).message}`);
  }
}
