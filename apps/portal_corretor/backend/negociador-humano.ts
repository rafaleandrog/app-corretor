import '@urbiverso/sdk/express';
import { Router, type Request, type Response } from 'express';
import type { ConviteApp } from '@urbiverso/sdk';
import { emailValido } from '../comum/conta';
import { semSigilo } from '../comum/negociacao';
import { assincrono, erro, guardarCorretor } from './acesso';
import { encerrada, id, NAO_ENCONTRADA } from './negociacao';
import { contaDoRequest } from './vitrine';

// Negociador humano (bloco D7; spec 11.6, 14, D-94, D-108). O corretor convida, para a PRÓPRIA conta,
// uma pessoa que conduz negociações (o papel externo `corretor` é o `provisiona_externos.papel_externo`
// do manifesto: self-service só na conta dele, contas.md). O convite pede só o e-mail, sem CRECI (D-94).
// Depois do aceite, o administrador do app atribui o papel `negociador` em Configurações › Usuários (o
// SDK não deixa a app atribuir papel). Aí o corretor atribui negociações a ele (`atribuicoes_negociacao`).
// Tudo aqui é do corretor; a guarda da negociação (`guardarNegociacao`) já barra o negociador em
// `/negociador/*`, e a `guardarCorretor` abaixo repete a trava para estas rotas.
export const negociadorHumanoRotas = Router();
guardarCorretor(negociadorHumanoRotas, ['/negociador/convites', '/negociador/negociadores', '/negociador/atribuicoes']);

type Linha = Record<string, any>;

const MENSAGEM_SEM_SHELL = 'O convite de negociador não está disponível nesta instância agora. Tente mais tarde ou fale com o suporte da plataforma.';

/**
 * Os códigos de erro do provisionamento por app (contas.md § Códigos de erro), na língua do corretor.
 * O HTTP vem de `e.status` (o SDK o dá, direto da tabela); sem ele, o desta tabela.
 */
export const ERROS_CONVITE: Record<string, { status: number; mensagem: string }> = {
  CONVITE_MULTI_USUARIO_BLOQUEADO: {
    status: 409,
    mensagem: 'O negociador humano não está disponível nesta instância: a política "permite contas multi-usuário" está desligada. O Negociador IA continua funcionando; para convidar uma pessoa, peça ao administrador da instância para ligar a política.',
  },
  PROVISIONA_NAO_DECLARADA: { status: 403, mensagem: 'Esta versão do app não pode convidar pessoas. Fale com o suporte da plataforma.' },
  PROVISIONA_NAO_LIBERADA: {
    status: 403,
    mensagem: 'O administrador da instância ainda não liberou convites deste app para contas existentes (Admin › Instaláveis › Apps › Portal do Corretor: provisionamento ligado e "admitir em conta existente").',
  },
  PROVISIONA_SEM_PAPEL: { status: 403, mensagem: 'Só o corretor da conta convida um negociador.' },
  PROVISIONA_CONTA_ALHEIA: { status: 403, mensagem: 'O convite só pode ser para a sua própria conta.' },
  CONVITE_IDENTIDADE_INTERNA: { status: 409, mensagem: 'Este e-mail é de alguém da equipe da plataforma: ele não pode ser convidado como negociador.' },
  CONVITE_CONTA_DIVERGENTE: { status: 409, mensagem: 'Esta pessoa já usa a plataforma por outra conta. Um usuário externo pertence a uma conta só: convide outro e-mail.' },
  CONVITE_JA_PENDENTE: { status: 409, mensagem: 'Já existe um convite pendente para este e-mail. Espere o aceite ou revogue o convite e convide de novo.' },
  PLANO_ASSENTOS_ESGOTADOS: { status: 409, mensagem: 'O plano da sua conta não tem mais lugares para pessoas. Libere um lugar ou fale com a plataforma sobre o plano.' },
  CONVITE_CONTA_INATIVA: { status: 409, mensagem: 'A sua conta está inativa: não é possível convidar agora.' },
  CONVITE_CONTA_NAO_ENCONTRADA: { status: 404, mensagem: 'A conta do convite não foi encontrada.' },
  CONVITE_DADOS_INVALIDOS: { status: 400, mensagem: 'Confira o e-mail do convite.' },
  CONVITE_NAO_ENCONTRADO: { status: 404, mensagem: 'Convite não encontrado.' },
  EMAIL_SISTEMA_INDISPONIVEL: { status: 422, mensagem: 'O e-mail da plataforma está desligado nesta instância: o convite não pode ser enviado. Fale com o administrador da instância.' },
};

/** Traduz o `ErroProvisionamento` (ou relança o que não é dele). */
function responderErroConvite(res: Response, e: unknown) {
  const falha = e as { codigo?: string; status?: number; message?: string };
  const conhecido = typeof falha?.codigo === 'string' ? ERROS_CONVITE[falha.codigo] : undefined;
  if (!conhecido) throw e;
  return erro(res, typeof falha.status === 'number' ? falha.status : conhecido.status, falha.codigo!, conhecido.mensagem);
}

/** O helper de convites do shell, ou `null` (sem `req.shell` a rota responde 503, nunca 500). */
function externosDe(req: Request) {
  return req.shell?.externos ?? null;
}

/** Convites desta conta para negociador (os de admitir em conta existente; o de criar a conta do corretor fica de fora). */
async function convitesDaConta(req: Request, conta: number, status?: ConviteApp['status']) {
  const r = await req.shell!.externos.listarConvites({ contaAlvo: conta, limite: 200, ...(status ? { status } : {}) });
  return r.convites.filter((c) => c.intencao === 'admitir_existente');
}

/**
 * Quem pode receber negociações nesta conta: quem aceitou o convite da conta (o shell devolve a conta
 * no convite resgatado) e já tem o papel `negociador` no app. Sem o papel, aparece com o aviso.
 */
async function negociadoresDaConta(req: Request, conta: number) {
  const [resgatados, comPapel] = await Promise.all([convitesDaConta(req, conta, 'resgatado'), req.shell!.listarUsuariosPorRole('negociador')]);
  const papel = new Set(comPapel.map(Number));
  const vistos = new Map<number, { usuario_id: number; email: string; tem_papel: boolean }>();
  for (const c of resgatados) {
    const uid = Number(c.usuarioId);
    if (!uid || (c.contaId ?? c.contaAlvo) !== conta || vistos.has(uid)) continue;
    vistos.set(uid, { usuario_id: uid, email: c.credencial, tem_papel: papel.has(uid) });
  }
  return [...vistos.values()];
}

const paraTela = (c: ConviteApp) => ({ id: c.id, email: c.credencial, status: c.status, vigente_ate: c.vigenteAte, criado_em: c.criadoEm, usuario_id: c.usuarioId });

// --- Convites ---------------------------------------------------------------------------------------

negociadorHumanoRotas.get(
  '/negociador/convites',
  assincrono(async (req, res) => {
    if (!externosDe(req)) return erro(res, 503, 'CONVITE_INDISPONIVEL', MENSAGEM_SEM_SHELL);
    const conta = contaDoRequest(req);
    try {
      const convites = await convitesDaConta(req, conta);
      res.json({ convites: convites.map(paraTela) });
    } catch (e) {
      return responderErroConvite(res, e);
    }
  }),
);

// Convidar negociador: só o e-mail. Nenhum campo de CRECI (D-94): o que vier além do e-mail é ignorado.
negociadorHumanoRotas.post(
  '/negociador/convites',
  assincrono(async (req, res) => {
    const externos = externosDe(req);
    if (!externos) return erro(res, 503, 'CONVITE_INDISPONIVEL', MENSAGEM_SEM_SHELL);
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!emailValido(email)) return erro(res, 422, 'DADOS_INVALIDOS', 'Informe um e-mail válido.', ['email: informe um e-mail válido.']);
    const contaId = contaDoRequest(req);
    try {
      const r = await externos.convidar({ email, contaId });
      res.status(201).json({ id: r.conviteId, vigente_ate: r.vigenteAte });
    } catch (e) {
      // O convite existe e vale; só a entrega do e-mail falhou (contas.md): repetir daria CONVITE_JA_PENDENTE.
      if ((e as { codigo?: string })?.codigo === 'CONVITE_EMAIL_FALHOU') {
        return res.status(202).json({ aviso: 'O convite foi criado, mas o e-mail não saiu. Ele aparece na lista; peça à pessoa para conferir a caixa de spam ou revogue e convide de novo.' });
      }
      return responderErroConvite(res, e);
    }
  }),
);

negociadorHumanoRotas.post(
  '/negociador/convites/:id/revogar',
  assincrono(async (req, res) => {
    if (!externosDe(req)) return erro(res, 503, 'CONVITE_INDISPONIVEL', MENSAGEM_SEM_SHELL);
    const conviteId = id(req.params.id);
    if (!conviteId) return erro(res, 404, 'NAO_ENCONTRADO', 'Convite não encontrado.');
    const conta = contaDoRequest(req);
    try {
      // Só o convite desta conta: o de outra conta é "não encontrado", nunca revogado.
      const daConta = await convitesDaConta(req, conta);
      if (!daConta.some((c) => c.id === conviteId)) return erro(res, 404, 'NAO_ENCONTRADO', 'Convite não encontrado.');
      await req.shell!.externos.revogarConvite({ conviteId });
      res.json({ id: conviteId, status: 'revogado' });
    } catch (e) {
      return responderErroConvite(res, e);
    }
  }),
);

// --- Negociadores e atribuições ---------------------------------------------------------------------

negociadorHumanoRotas.get(
  '/negociador/negociadores',
  assincrono(async (req, res) => {
    if (!externosDe(req)) return erro(res, 503, 'CONVITE_INDISPONIVEL', MENSAGEM_SEM_SHELL);
    try {
      res.json({ dados: await negociadoresDaConta(req, contaDoRequest(req)) });
    } catch (e) {
      return responderErroConvite(res, e);
    }
  }),
);

negociadorHumanoRotas.get(
  '/negociador/atribuicoes',
  assincrono(async (req, res) => {
    const filtros: Record<string, unknown> = {};
    const nid = id(req.query.negociacao_id);
    if (nid) filtros.negociacao_id = nid;
    if (req.query.ativa === 'true' || req.query.ativa === 'false') filtros.ativa = req.query.ativa === 'true';
    const linhas = await req.dados!.varrerTudo('atribuicoes_negociacao', { filtros, ordenar: 'id', ordem: 'desc', maximo: 500 });
    res.json({ dados: semSigilo(linhas) });
  }),
);

// Atribuir: a negociação passa a ser conduzida pela pessoa (`humano`). Uma atribuição ativa por vez;
// a anterior, de outra pessoa, é desativada no mesmo ato. A negociação é da conta (de outra, 404).
negociadorHumanoRotas.post(
  '/negociador/atribuicoes',
  assincrono(async (req, res) => {
    const dados = req.dados!;
    const nid = id(req.body?.negociacao_id);
    const uid = id(req.body?.usuario_id);
    if (!nid || !uid) return erro(res, 422, 'DADOS_INVALIDOS', 'Informe a negociação e o negociador.');
    const negociacao = await dados.buscar('negociacoes', nid);
    if (!negociacao) return erro(res, 404, 'NAO_ENCONTRADO', NAO_ENCONTRADA);
    if (encerrada(negociacao)) return erro(res, 409, 'NEGOCIACAO_ENCERRADA', 'Esta negociação já foi encerrada.');
    if (!externosDe(req)) return erro(res, 503, 'CONVITE_INDISPONIVEL', MENSAGEM_SEM_SHELL);
    let pessoa: { usuario_id: number; tem_papel: boolean } | undefined;
    try {
      pessoa = (await negociadoresDaConta(req, contaDoRequest(req))).find((n) => n.usuario_id === uid);
    } catch (e) {
      return responderErroConvite(res, e);
    }
    // Só quem aceitou o convite DESTA conta: o negociador de outra conta é "não encontrado".
    if (!pessoa) return erro(res, 404, 'NEGOCIADOR_NAO_ENCONTRADO', 'Negociador não encontrado nesta conta. Convide a pessoa em Ajustes › Negociador.');
    if (!pessoa.tem_papel) {
      return erro(res, 409, 'NEGOCIADOR_SEM_PAPEL', 'Esta pessoa aceitou o convite, mas ainda não tem o papel negociador. Peça ao administrador do app para atribuí-lo em Configurações › Usuários.');
    }
    const resultado = await dados.transaction(async (trx) => {
      // Trava a negociação: duas atribuições ao mesmo tempo não deixam duas ativas.
      const viva = await trx.buscar('negociacoes', nid, { travar: true });
      if (!viva) return { recusa: 404 as const };
      if (encerrada(viva)) return { recusa: 409 as const };
      const ativas = await trx.varrerTudo('atribuicoes_negociacao', { filtros: { negociacao_id: nid, ativa: true }, maximo: 50 });
      const mesma = ativas.find((a: Linha) => Number(a.usuario_id) === uid);
      for (const a of ativas) if (a !== mesma) await trx.atualizar('atribuicoes_negociacao', Number(a.id), { ativa: false });
      const atribuicao = mesma ?? (await trx.criar('atribuicoes_negociacao', { negociacao_id: nid, usuario_id: uid, atribuida_por: req.contexto?.usuario.id ?? null, ativa: true }));
      await trx.atualizar('negociacoes', nid, { negociador_usuario_id: uid, conduzida_por: 'humano' });
      return { atribuicao, nova: !mesma };
    });
    if ('recusa' in resultado) {
      return resultado.recusa === 404 ? erro(res, 404, 'NAO_ENCONTRADO', NAO_ENCONTRADA) : erro(res, 409, 'NEGOCIACAO_ENCERRADA', 'Esta negociação já foi encerrada.');
    }
    res.status(resultado.nova ? 201 : 200).json(semSigilo(resultado.atribuicao));
  }),
);

// Retirar: `{ ativa: false }`. A negociação volta ao corretor se a pessoa a conduzia.
negociadorHumanoRotas.patch(
  '/negociador/atribuicoes/:id',
  assincrono(async (req, res) => {
    const dados = req.dados!;
    const aid = id(req.params.id);
    const atual = aid ? await dados.buscar('atribuicoes_negociacao', aid) : null;
    if (!atual) return erro(res, 404, 'NAO_ENCONTRADO', 'Atribuição não encontrada.');
    if (req.body?.ativa !== false) return erro(res, 422, 'DADOS_INVALIDOS', 'Para retirar a negociação do negociador, envie { "ativa": false }. Para atribuir de novo, use a atribuição nova.');
    const resultado = await dados.transaction(async (trx) => {
      const viva = await trx.buscar('negociacoes', Number(atual.negociacao_id), { travar: true });
      const salva = await trx.atualizarSe('atribuicoes_negociacao', aid!, { ativa: false }, { ativa: true });
      if (!salva) return (await trx.buscar('atribuicoes_negociacao', aid!)) as Linha;
      if (viva && Number(viva.negociador_usuario_id) === Number(atual.usuario_id)) {
        await trx.atualizar('negociacoes', Number(viva.id), {
          negociador_usuario_id: null,
          ...(viva.conduzida_por === 'humano' && !encerrada(viva) ? { conduzida_por: 'corretor' } : {}),
        });
      }
      return salva;
    });
    res.json(semSigilo(resultado));
  }),
);
