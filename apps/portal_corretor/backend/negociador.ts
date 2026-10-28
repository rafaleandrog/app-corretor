import '@urbiverso/sdk/express';
import { Router, type Request } from 'express';
import { respostaSegura } from '../comum/assistente';
import { semSigilo, validarMandato, type Concessao, type Direcao } from '../comum/negociacao';
import {
  CANAIS_ENVIO,
  DESCRICAO_PASSAGEM,
  MAX_MENSAGENS_CONTEXTO,
  SCHEMA_RESPOSTA,
  exigePassagem,
  montarContexto,
  promptSistema,
  sanearResposta,
  validarMovimento,
  zopa,
  type MandatoMotor,
  type MensagemNegociacao,
  type MotivoPassagem,
  type PropostaResumo,
  type RespostaNegociador,
  type ResultadoValidacao,
} from '../comum/negociador';
import { linkWhatsapp } from '../comum/pagina';
import { assincrono, erro, guardarCorretor, primeiro } from './acesso';
import {
  MENSAGEM_ENCERRADA,
  NAO_ENCONTRADA,
  configDaConta,
  encerrada,
  gravarPropostaTravada,
  id,
  mandatoVigente,
  objecoesDaConta,
  publicar,
  texto,
} from './negociacao';

// Motor do Negociador IA (bloco D2; spec 10.9.4 a 10.9.9). Uma chamada `req.ia.consultar` com o
// schema de 10.9.8 no slot `negociador` (base `poder`); o app valida a resposta com as 7 garantias de
// 10.9.7 (`comum/negociador.ts`) e só então mostra (pergunta antes), envia (faz sozinho, no portal) ou
// passa ao corretor. As regras do dono valem aqui, no código: nada sai abaixo do recuo, nada que revele
// recuo, alvo ou BATNA, e o aceite do acordo é só do corretor (D-98). Sem WhatsApp do app (D-107).
export const negociadorRotas = Router();
guardarCorretor(negociadorRotas, ['/negociacoes', '/negociador']);

type Linha = Record<string, any>;

const SLOT = 'negociador';
const MENSAGEM_IA_INDISPONIVEL = 'IA indisponível agora: a negociação segue com você.';
const MENSAGEM_RETIDA = '[mensagem retida: revelava informação sigilosa do vendedor]';

/** `estadoSlot` sem custo; falha da sonda conta como indisponível, salvo slot fora do manifesto (bug). */
async function slotDisponivel(req: Request): Promise<boolean> {
  if (!req.ia) return false;
  try {
    return !!(await req.ia.estadoSlot(SLOT)).efetivo;
  } catch (e) {
    if ((e as { codigo?: string })?.codigo === 'SLOT_INVALIDO') throw e;
    return false;
  }
}

/** Erro de IA "na hora" (limite, provedor fora, resposta inválida) degrada; sem código ou slot inválido é bug. */
const falhaDeIa = (e: unknown) => {
  const codigo = (e as { codigo?: string })?.codigo;
  return !!codigo && codigo !== 'SLOT_INVALIDO';
};

const hoje = (req: Request) => new Date().toLocaleDateString('sv-SE', { timeZone: req.contexto?.fuso || 'America/Sao_Paulo' });

/** Quem pode aceitar o acordo final: só o papel `corretor` (ou o admin do app, que vale por todos). */
const ehCorretor = (req: Request) => req.contexto?.nivelApp === 'admin' || !!req.contexto?.rolesApp?.includes('corretor');

function paraMotor(m: Linha | null): MandatoMotor | null {
  if (!m) return null;
  return {
    preco_pedido_c: Number(m.preco_pedido_c),
    alvo_c: Number(m.alvo_c),
    recuo_c: Number(m.recuo_c),
    batna_vendedor: m.batna_vendedor ?? null,
    concessoes: Array.isArray(m.concessoes) ? (m.concessoes as Concessao[]) : [],
    passo_max_pct: Number(m.passo_max_pct),
    rodadas_max: Number(m.rodadas_max),
    // `data` pode chegar como texto `AAAA-MM-DD` ou como Date: compara sempre o texto.
    validade: m.validade instanceof Date ? m.validade.toISOString().slice(0, 10) : String(m.validade).slice(0, 10),
    autonomia: m.autonomia,
    autorizacao_proprietario: m.autorizacao_proprietario ?? null,
  };
}

const paraResumo = (p: Linha): PropostaResumo => ({
  direcao: p.direcao as Direcao,
  valor_c: Number(p.valor_c),
  rodada: p.rodada ?? null,
  condicoes: p.condicoes ?? null,
  concessao: typeof p.concessao === 'string' ? p.concessao : null,
  contrapartida: typeof p.contrapartida === 'string' ? p.contrapartida : null,
  canal: p.canal ?? null,
  estado: p.estado ?? null,
});

/** As mensagens da negociação, da mais antiga à mais nova: o que o cliente disse e o que saiu. */
function mensagensDe(execucoes: Linha[]): MensagemNegociacao[] {
  const msgs: MensagemNegociacao[] = [];
  for (const e of execucoes) {
    if (e.mensagem_cliente) msgs.push({ quem: 'cliente', texto: e.mensagem_cliente, quando: e.criado_em ?? null });
    if (e.mensagem_enviada) msgs.push({ quem: 'negociador', texto: e.mensagem_enviada, quando: e.decidida_em ?? null });
  }
  return msgs.slice(-MAX_MENSAGENS_CONTEXTO);
}

/** O que o motor precisa ler da negociação: mandato, propostas, mensagens, objeções, playbook e quem é. */
async function carregar(req: Request, negociacao: Linha) {
  const dados = req.dados!;
  const nid = Number(negociacao.id);
  const [mandato, propostas, execucoes, objecoes, playbook, config, imovel, contato, perfil] = await Promise.all([
    mandatoVigente(dados, negociacao),
    dados.varrerTudo('propostas', { filtros: { negociacao_id: nid }, ordenar: 'id', ordem: 'asc', maximo: 500 }),
    dados.listar('negociador_execucoes', { filtros: { negociacao_id: nid }, ordenar: 'id', ordem: 'desc', por_pagina: MAX_MENSAGENS_CONTEXTO }),
    dados.varrerTudo('objecoes_detectadas', { filtros: { negociacao_id: nid }, ordenar: 'id', ordem: 'asc', maximo: 500 }),
    objecoesDaConta(dados),
    configDaConta(dados),
    dados.buscar('imoveis', Number(negociacao.imovel_id)),
    dados.buscar('contatos', Number(negociacao.contato_id)),
    req.contexto?.usuario.id ? primeiro(dados, 'perfis_corretor', { usuario_id: req.contexto.usuario.id }) : null,
  ]);
  return {
    mandato: paraMotor(mandato),
    propostas: propostas.map(paraResumo),
    mensagens: mensagensDe([...execucoes.dados].reverse()),
    objecoes: objecoes.map((o) => ({ categoria: String(o.categoria), trecho: o.trecho ?? null })),
    playbook: playbook.map((o) => ({ categoria: o.categoria, ...(o.minha ?? o.padrao) })),
    config,
    imovel,
    contato,
    creci: (perfil?.creci as string | null | undefined) ?? null,
  };
}

/** A resposta que pode ser guardada e mostrada: mensagem que vaza sigilo é retida, nunca devolvida. */
function respostaGuardavel(resposta: RespostaNegociador, validacao: ResultadoValidacao): RespostaNegociador {
  const vazou = validacao.verificacoes.some((v) => v.garantia === 'sigilo' && !v.ok);
  if (!vazou) return resposta;
  return {
    ...resposta,
    mensagem: resposta.mensagem ? MENSAGEM_RETIDA : null,
    contraproposta: resposta.contraproposta ? { ...resposta.contraproposta, condicoes: resposta.contraproposta.condicoes ? MENSAGEM_RETIDA : null } : null,
  };
}

const descreverPassagem = (motivos: MotivoPassagem[]) => motivos.map((m) => ({ motivo: m, descricao: DESCRICAO_PASSAGEM[m] }));

/** Sonda sem custo: a tela mostra "Pedir sugestão" só com o slot resolvendo (senão, "IA indisponível agora"). */
negociadorRotas.get(
  '/negociador/ia',
  assincrono(async (req, res) => {
    res.json({ disponivel: await slotDisponivel(req) });
  }),
);

// Pedir sugestão (P15, M8): o próximo movimento do Negociador dentro do mandato.
negociadorRotas.post(
  '/negociacoes/:id/sugestao',
  assincrono(async (req, res) => {
    const dados = req.dados!;
    const nid = id(req.params.id);
    const negociacao = nid ? await dados.buscar('negociacoes', nid) : null;
    if (!negociacao) return erro(res, 404, 'NAO_ENCONTRADO', NAO_ENCONTRADA);
    if (encerrada(negociacao)) return erro(res, 409, 'NEGOCIACAO_ENCERRADA', MENSAGEM_ENCERRADA);
    const b = (req.body ?? {}) as Record<string, unknown>;
    if (b.mensagem_cliente !== undefined && b.mensagem_cliente !== null && typeof b.mensagem_cliente !== 'string') {
      return erro(res, 422, 'DADOS_INVALIDOS', 'mensagem_cliente: use texto.');
    }
    if (b.canal !== undefined && !(CANAIS_ENVIO as readonly unknown[]).includes(b.canal)) {
      return erro(res, 422, 'CANAL_INDISPONIVEL', 'Canal: use portal ou wa_me (Fazer agora). O WhatsApp do app ainda não existe.');
    }
    const mensagem_cliente = texto(b.mensagem_cliente, 1000);
    const ctx = await carregar(req, negociacao);
    const dia = hoje(req);
    // "Faz sozinho" só quando o Negociador IA conduz, e só no portal (D-107).
    const automatico = ctx.mandato?.autonomia === 'faz_sozinho' && negociacao.conduzida_por === 'ia';
    const canal = (b.canal as string | undefined) ?? 'portal';

    // Sem mandato vigente o Negociador não age (10.9.5): passa ao corretor sem gastar chamada de IA.
    let resposta: RespostaNegociador | null = null;
    let uso: { tokens_entrada?: number; tokens_saida?: number; duracao_ms?: number } = {};
    if (ctx.mandato && ctx.mandato.validade >= dia) {
      if (!(await slotDisponivel(req))) return erro(res, 503, 'IA_INDISPONIVEL', MENSAGEM_IA_INDISPONIVEL);
      const contexto = montarContexto({
        negociacao,
        imovel: ctx.imovel,
        comprador: ctx.contato ? { primeiro_nome: String(ctx.contato.nome ?? '').split(/\s+/)[0] } : null,
        mandato: ctx.mandato,
        propostas: ctx.propostas,
        mensagens: [...ctx.mensagens, ...(mensagem_cliente ? [{ quem: 'cliente' as const, texto: mensagem_cliente }] : [])],
        objecoes: ctx.objecoes,
        playbook: ctx.playbook,
      });
      const instrucoes_sistema = promptSistema(ctx.config, {
        nome_corretor: req.contexto?.usuario.nome ?? '',
        creci: ctx.creci,
        imovel_titulo: ctx.imovel?.titulo ?? ctx.imovel?.codigo ?? '',
      });
      try {
        const r = await req.ia!.consultar({ contexto, schema: SCHEMA_RESPOSTA, slot: SLOT, instrucoes_sistema });
        resposta = sanearResposta(r.dados);
        uso = { tokens_entrada: r.tokens_entrada, tokens_saida: r.tokens_saida, duracao_ms: r.duracao_ms };
      } catch (e) {
        if (!falhaDeIa(e)) throw e;
        return erro(res, 503, 'IA_INDISPONIVEL', 'A IA não respondeu agora. Tente de novo em instantes; a negociação segue com você.');
      }
      if (resposta.mensagem) resposta.mensagem = respostaSegura(resposta.mensagem);
    }

    const movimento = resposta ?? { movimento: 'passar_ao_corretor', contraproposta: null, mensagem: null, passar_ao_corretor: true };
    const validacao = validarMovimento(movimento, ctx.mandato, ctx.propostas, { hoje: dia, canal, automatico });
    const motivos = exigePassagem({
      resposta: movimento,
      mensagem_cliente,
      mandato: ctx.mandato,
      propostas: ctx.propostas,
      teto_estimado_c: resposta?.teto_estimado_comprador_c ?? negociacao.teto_estimado_comprador_c,
      hoje: dia,
    });
    const passagem = validacao.bloqueado_por.length > 0 || validacao.passa_ao_corretor || motivos.length > 0;
    const guardada = resposta ? respostaGuardavel(resposta, validacao) : null;
    const enviaSozinho = !passagem && automatico && canal === 'portal' && resposta?.movimento === 'contraproposta' && !!resposta.contraproposta?.valor_c;

    const resultado = await dados.transaction(async (trx) => {
      // A objeção detectada é só inclusão (O5).
      let objecao: Linha | null = null;
      if (resposta?.objecao?.categoria && ctx.contato) {
        objecao = await trx.criar('objecoes_detectadas', {
          negociacao_id: nid,
          contato_id: Number(negociacao.contato_id),
          categoria: resposta.objecao.categoria,
          trecho: resposta.objecao.trecho ?? (mensagem_cliente ? mensagem_cliente.slice(0, 500) : null),
          detectada_por: 'ia',
          tratada: resposta.movimento === 'responder_objecao' && !passagem,
          em: new Date(),
        });
      }
      const execucao = await trx.criar('negociador_execucoes', {
        negociacao_id: nid,
        mensagem_cliente,
        entrada: { canal, automatico, mandato_versao: ctx.mandato ? (negociacao.mandato_id ?? null) : null, rodadas: Number(negociacao.rodadas ?? 0) },
        saida: guardada,
        validacoes: { verificacoes: validacao.verificacoes, passagem: motivos },
        bloqueado_por: validacao.bloqueado_por.length ? validacao.bloqueado_por.join(',').slice(0, 300) : null,
        tokens_entrada: uso.tokens_entrada ?? null,
        tokens_saida: uso.tokens_saida ?? null,
        duracao_ms: uso.duracao_ms ?? null,
        decisao: passagem ? 'passagem' : 'pendente',
      });
      const mudancas: Record<string, unknown> = {};
      if (resposta?.teto_estimado_comprador_c) {
        mudancas.teto_estimado_comprador_c = resposta.teto_estimado_comprador_c;
        mudancas.fonte_estimativa = resposta.fonte_estimativa;
      }
      if (passagem) mudancas.estado = 'aguardando_corretor';
      if (Object.keys(mudancas).length) {
        const atual = await trx.buscar('negociacoes', nid!, { travar: true });
        if (atual && !encerrada(atual)) await trx.atualizar('negociacoes', nid!, mudancas);
      }
      // Faz sozinho, dentro do mandato e no portal: a contraproposta sai sem o corretor (10.9.3).
      let proposta: Linha | null = null;
      if (enviaSozinho) {
        const cp = resposta!.contraproposta!;
        const r = await gravarPropostaTravada(trx, nid!, {
          direcao: 'vendedor',
          autor_tipo: 'negociador_ia',
          autor_usuario_id: null,
          valor_c: cp.valor_c!,
          condicoes: cp.condicoes,
          concessao: cp.concessao,
          contrapartida: cp.contrapartida,
          validade_ate: cp.validade_horas ? new Date(Date.now() + cp.validade_horas * 3600e3) : null,
          canal: 'portal',
          estado: 'enviada',
        });
        if ('proposta' in r) {
          proposta = r.proposta;
          await trx.atualizar('negociacoes', nid!, { estado: 'aguardando_cliente' });
          await trx.atualizar('negociador_execucoes', execucao.id, {
            decisao: 'automatica',
            proposta_id: proposta.id,
            mensagem_enviada: resposta!.mensagem,
            decidida_em: new Date(),
          });
        }
      }
      return { execucao, objecao, proposta };
    });

    if (resultado.objecao) await publicar(req, 'objecao_detectada', { negociacao_id: nid!, objecao_id: resultado.objecao.id });
    if (passagem) await publicar(req, 'negociacao_limite_atingido', { negociacao_id: nid! });
    else if (resultado.proposta) await publicar(req, 'contraproposta_enviada', { negociacao_id: nid!, proposta_id: resultado.proposta.id });
    else await publicar(req, 'contraproposta_sugerida', { negociacao_id: nid!, execucao_id: resultado.execucao.id });

    const z = zopa(ctx.mandato, resposta?.teto_estimado_comprador_c ?? negociacao.teto_estimado_comprador_c);
    res.json(
      semSigilo({
        execucao_id: resultado.execucao.id,
        ia: !!resposta,
        resposta: guardada,
        validacoes: validacao.verificacoes,
        bloqueado_por: validacao.bloqueado_por,
        passagem,
        motivos_passagem: descreverPassagem(motivos),
        // Só se existe: as pontas da faixa (o recuo) ficam na rota do mandato.
        zopa: { existe: z.existe },
        enviada: resultado.proposta,
      }),
    );
  }),
);

const ACOES = ['aprovar', 'editar', 'descartar', 'aceitar_acordo'] as const;

// A decisão do corretor sobre a sugestão (aprovar, editar, descartar) e o aceite do acordo, que é só dele.
negociadorRotas.post(
  '/negociacoes/:id/decisao',
  assincrono(async (req, res) => {
    const dados = req.dados!;
    const nid = id(req.params.id);
    const negociacao = nid ? await dados.buscar('negociacoes', nid) : null;
    if (!negociacao) return erro(res, 404, 'NAO_ENCONTRADO', NAO_ENCONTRADA);
    if (encerrada(negociacao)) return erro(res, 409, 'NEGOCIACAO_ENCERRADA', MENSAGEM_ENCERRADA);
    const b = (req.body ?? {}) as Record<string, unknown>;
    if (!(ACOES as readonly unknown[]).includes(b.acao)) return erro(res, 422, 'DADOS_INVALIDOS', 'acao: use aprovar, editar, descartar ou aceitar_acordo.');

    if (b.acao === 'aceitar_acordo') {
      // O aceite final é sempre do corretor (D-98): nem o Negociador IA nem o negociador humano.
      if (!ehCorretor(req)) return erro(res, 403, 'SO_O_CORRETOR', 'Só o corretor aceita o acordo final.');
      const pid = id(b.proposta_id);
      const proposta = pid ? await dados.buscar('propostas', pid) : null;
      if (!proposta || Number(proposta.negociacao_id) !== nid) return erro(res, 404, 'NAO_ENCONTRADO', 'Proposta não encontrada.');
      if (proposta.direcao !== 'comprador') return erro(res, 422, 'DADOS_INVALIDOS', 'O acordo aceita uma proposta do comprador.');
      const feito = await dados.transaction(async (trx) => {
        const viva = await trx.buscar('negociacoes', nid!, { travar: true });
        if (!viva || encerrada(viva)) return false;
        await trx.atualizar('propostas', pid!, { estado: 'aceita' });
        // O fechamento depende da decisão do proprietário (D-15): a negociação vai a ele.
        await trx.atualizar('negociacoes', nid!, { estado: 'aguardando_proprietario' });
        return true;
      });
      if (!feito) return erro(res, 409, 'NEGOCIACAO_ENCERRADA', MENSAGEM_ENCERRADA);
      await publicar(req, 'negociacao_acordo_proposto', { negociacao_id: nid!, proposta_id: pid! });
      return res.json({ ok: true, estado: 'aguardando_proprietario', proposta_id: pid });
    }

    const eid = id(b.execucao_id);
    const execucao = eid ? await dados.buscar('negociador_execucoes', eid) : null;
    if (!execucao || Number(execucao.negociacao_id) !== nid) return erro(res, 404, 'NAO_ENCONTRADO', 'Sugestão não encontrada.');
    if (execucao.decisao !== 'pendente') return erro(res, 409, 'SUGESTAO_JA_DECIDIDA', 'Esta sugestão já foi decidida ou passada a você.');

    if (b.acao === 'descartar') {
      const salva = await dados.atualizarSe('negociador_execucoes', eid!, { decisao: 'descartada', decidida_em: new Date() }, { decisao: 'pendente' });
      if (!salva) return erro(res, 409, 'SUGESTAO_JA_DECIDIDA', 'Esta sugestão já foi decidida.');
      return res.json({ ok: true, decisao: 'descartada' });
    }

    if (!(CANAIS_ENVIO as readonly unknown[]).includes(b.canal)) {
      return erro(res, 422, 'CANAL_INDISPONIVEL', 'Escolha o canal: portal ou wa_me (Fazer agora). O WhatsApp do app ainda não existe.');
    }
    const canal = b.canal as string;
    const sugerida = sanearResposta(execucao.saida ?? {});
    let movimento: RespostaNegociador = sugerida;
    if (b.acao === 'editar') {
      const ed = (b.contraproposta && typeof b.contraproposta === 'object' ? b.contraproposta : null) as Record<string, unknown> | null;
      if (b.contraproposta !== undefined && b.contraproposta !== null && !ed) return erro(res, 422, 'DADOS_INVALIDOS', 'contraproposta: use um objeto.');
      if (ed && !(Number.isInteger(ed.valor_c) && (ed.valor_c as number) > 0)) return erro(res, 422, 'DADOS_INVALIDOS', 'contraproposta.valor_c: informe o valor em centavos.');
      movimento = {
        ...sugerida,
        movimento: ed ? 'contraproposta' : sugerida.movimento,
        contraproposta: ed
          ? {
              valor_c: ed.valor_c as number,
              condicoes: texto(ed.condicoes, 500),
              concessao: texto(ed.concessao, 200),
              contrapartida: texto(ed.contrapartida, 200),
              validade_horas: Number.isInteger(ed.validade_horas) && (ed.validade_horas as number) > 0 ? (ed.validade_horas as number) : null,
            }
          : sugerida.contraproposta,
        mensagem: b.mensagem !== undefined ? texto(b.mensagem, 1000) : sugerida.mensagem,
      };
    }
    if (movimento.mensagem === MENSAGEM_RETIDA) movimento = { ...movimento, mensagem: null };
    const temContraproposta = movimento.movimento === 'contraproposta' && !!movimento.contraproposta?.valor_c;
    if (!temContraproposta && !movimento.mensagem) return erro(res, 422, 'NADA_A_ENVIAR', 'A sugestão não tem contraproposta nem mensagem para enviar. Edite ou descarte.');

    // Revalida no código: a edição do corretor também não passa do recuo nem revela o sigilo (10.9.7).
    const ctx = await carregar(req, negociacao);
    const validacao = validarMovimento(movimento, ctx.mandato, ctx.propostas, { hoje: hoje(req), canal, automatico: false });
    if (!validacao.ok) {
      const falhas = validacao.verificacoes.filter((v) => !v.ok).map((v) => `${v.codigo}: ${v.detalhe}`);
      return res.status(422).json({
        erro: true,
        codigo: 'MOVIMENTO_BLOQUEADO',
        mensagem: validacao.passa_ao_corretor && !validacao.bloqueado_por.length ? 'Este movimento não se envia: é passagem ao corretor.' : 'Esta contraproposta não pode sair como está.',
        bloqueado_por: validacao.bloqueado_por,
        detalhes: falhas,
      });
    }

    const editada = b.acao === 'editar';
    const resultado = await dados.transaction(async (trx) => {
      // Reserva a sugestão antes de gravar: dois cliques em "aprovar" não mandam duas propostas.
      const reservada = await trx.atualizarSe('negociador_execucoes', eid!, { decisao: editada ? 'editada' : 'aprovada' }, { decisao: 'pendente' });
      if (!reservada) return { recusa: 'decidida' as const };
      let proposta: Linha | null = null;
      if (temContraproposta) {
        const cp = movimento.contraproposta!;
        const r = await gravarPropostaTravada(trx, nid!, {
          direcao: 'vendedor',
          autor_tipo: editada ? 'corretor' : 'negociador_ia',
          autor_usuario_id: req.contexto?.usuario.id ?? null,
          valor_c: cp.valor_c!,
          condicoes: cp.condicoes,
          concessao: cp.concessao,
          contrapartida: cp.contrapartida,
          validade_ate: cp.validade_horas ? new Date(Date.now() + cp.validade_horas * 3600e3) : null,
          canal,
          estado: 'enviada',
        });
        // Encerrada no meio: lança para desfazer a reserva da sugestão junto.
        if ('recusa' in r) throw Object.assign(new Error('negociação encerrada'), { codigo: 'NEGOCIACAO_ENCERRADA', status: 409 });
        proposta = r.proposta;
      }
      await trx.atualizar('negociador_execucoes', eid!, {
        aprovada_sem_edicao: !editada,
        proposta_id: proposta?.id ?? null,
        mensagem_enviada: movimento.mensagem,
        decidida_em: new Date(),
      });
      await trx.atualizar('negociacoes', nid!, { estado: 'aguardando_cliente' });
      return { proposta };
    });
    if ('recusa' in resultado) return erro(res, 409, 'SUGESTAO_JA_DECIDIDA', 'Esta sugestão já foi decidida.');
    if (resultado.proposta) await publicar(req, 'contraproposta_enviada', { negociacao_id: nid!, proposta_id: resultado.proposta.id });

    // Fazer agora: o texto pronto e o wa.me do cliente; o envio é do celular do corretor (D-107).
    const cp = movimento.contraproposta;
    const textoPronto =
      movimento.mensagem ??
      (cp?.valor_c ? `Proposta: R$ ${(cp.valor_c / 100).toLocaleString('pt-BR')}${cp.condicoes ? `, ${cp.condicoes}` : ''}.` : '');
    const contato = await dados.buscar('contatos', Number(negociacao.contato_id));
    res.json(
      semSigilo({
        ok: true,
        decisao: editada ? 'editada' : 'aprovada',
        canal,
        proposta: resultado.proposta,
        texto: textoPronto,
        link: canal === 'wa_me' ? linkWhatsapp(contato?.telefone, textoPronto) : null,
      }),
    );
  }),
);

// Um atendente por vez (10.9.4): o corretor assume ou devolve ao Negociador IA.
for (const [rota, para, evento] of [
  ['assumir', 'corretor', 'negociacao_assumida'],
  ['devolver', 'ia', 'negociacao_devolvida'],
] as const) {
  negociadorRotas.post(
    `/negociacoes/:id/${rota}`,
    assincrono(async (req, res) => {
      const dados = req.dados!;
      const nid = id(req.params.id);
      const negociacao = nid ? await dados.buscar('negociacoes', nid) : null;
      if (!negociacao) return erro(res, 404, 'NAO_ENCONTRADO', NAO_ENCONTRADA);
      if (encerrada(negociacao)) return erro(res, 409, 'NEGOCIACAO_ENCERRADA', MENSAGEM_ENCERRADA);
      if (negociacao.conduzida_por === para) return res.json(semSigilo(negociacao));
      if (para === 'ia' && !(await configDaConta(dados)).ligado) {
        return erro(res, 409, 'NEGOCIADOR_DESLIGADO', 'O Negociador está desligado nos ajustes: ligue-o para devolver a negociação a ele.');
      }
      const salva = await dados.atualizarSe('negociacoes', nid!, { conduzida_por: para }, { conduzida_por: negociacao.conduzida_por, estado: negociacao.estado });
      if (!salva) return erro(res, 409, 'NEGOCIACAO_ALTERADA', 'A negociação mudou enquanto você editava. Abra de novo.');
      await publicar(req, evento, { negociacao_id: nid! });
      res.json(semSigilo(salva));
    }),
  );
}

// Simulador do P17: o motor sobre uma negociação fictícia, sem gravar nada.
negociadorRotas.post(
  '/negociador/teste',
  assincrono(async (req, res) => {
    const dados = req.dados!;
    const b = (req.body ?? {}) as Record<string, unknown>;
    const dia = hoje(req);
    const corpoMandato = (b.mandato && typeof b.mandato === 'object' ? b.mandato : {}) as Record<string, unknown>;
    const validade = corpoMandato.validade ?? new Date(Date.now() + 30 * 86400e3).toISOString().slice(0, 10);
    const v = validarMandato({ ...corpoMandato, validade });
    if (!v.ok) return res.status(v.status).json({ erro: true, codigo: v.codigo, motivo: v.motivo, mensagem: v.mensagem, ...(v.detalhes ? { detalhes: v.detalhes } : {}) });
    const mandato: MandatoMotor = { ...v.dados };
    const brutas = Array.isArray(b.propostas) ? b.propostas.slice(0, 20) : [];
    const propostas: PropostaResumo[] = [];
    for (const p of brutas) {
      const o = (p && typeof p === 'object' ? p : {}) as Record<string, unknown>;
      if ((o.direcao === 'comprador' || o.direcao === 'vendedor') && Number.isInteger(o.valor_c) && (o.valor_c as number) > 0) {
        propostas.push({ direcao: o.direcao, valor_c: o.valor_c as number, condicoes: texto(o.condicoes, 300) });
      }
    }
    propostas.forEach((p, i) => (p.rodada = Math.max(1, propostas.slice(0, i + 1).filter((x) => x.direcao === 'comprador').length)));
    const mensagem_cliente = texto(b.mensagem_cliente, 1000);
    if (!mensagem_cliente) return erro(res, 422, 'DADOS_INVALIDOS', 'Escreva a mensagem do comprador para testar.');
    if (!(await slotDisponivel(req))) return erro(res, 503, 'IA_INDISPONIVEL', MENSAGEM_IA_INDISPONIVEL);
    const config = await configDaConta(dados);
    let resposta: RespostaNegociador;
    try {
      const r = await req.ia!.consultar({
        contexto: montarContexto({
          negociacao: { codigo: 'TESTE', teto_estimado_comprador_c: Number.isInteger(b.teto_estimado_c) ? (b.teto_estimado_c as number) : null },
          imovel: { titulo: 'Imóvel de teste' },
          comprador: { primeiro_nome: 'Cliente' },
          mandato,
          propostas,
          mensagens: [{ quem: 'cliente', texto: mensagem_cliente }],
          objecoes: [],
          playbook: (await objecoesDaConta(dados)).map((o) => ({ categoria: o.categoria, ...(o.minha ?? o.padrao) })),
        }),
        schema: SCHEMA_RESPOSTA,
        slot: SLOT,
        instrucoes_sistema: promptSistema(config, { nome_corretor: req.contexto?.usuario.nome ?? '', creci: null, imovel_titulo: 'Imóvel de teste' }),
      });
      resposta = sanearResposta(r.dados);
    } catch (e) {
      if (!falhaDeIa(e)) throw e;
      return erro(res, 503, 'IA_INDISPONIVEL', 'A IA não respondeu agora. Tente de novo em instantes.');
    }
    if (resposta.mensagem) resposta.mensagem = respostaSegura(resposta.mensagem);
    const validacao = validarMovimento(resposta, mandato, propostas, { hoje: dia, canal: 'portal', automatico: false });
    const teto = resposta.teto_estimado_comprador_c ?? (Number.isInteger(b.teto_estimado_c) ? (b.teto_estimado_c as number) : null);
    const motivos = exigePassagem({ resposta, mensagem_cliente, mandato, propostas, teto_estimado_c: teto, hoje: dia });
    // Aqui os valores são do próprio teste (digitados pelo corretor): a faixa volta inteira.
    res.json({
      resposta: respostaGuardavel(resposta, validacao),
      validacoes: validacao.verificacoes.map((x) => ({ ...x, marca: x.ok ? '✓' : '✗', frase: `${x.ok ? '✓' : '✗'} ${x.descricao}` })),
      bloqueado_por: validacao.bloqueado_por,
      passagem: validacao.bloqueado_por.length > 0 || validacao.passa_ao_corretor || motivos.length > 0,
      motivos_passagem: descreverPassagem(motivos),
      zopa: zopa(mandato, teto),
    });
  }),
);

