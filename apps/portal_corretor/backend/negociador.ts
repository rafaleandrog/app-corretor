import '@urbiverso/sdk/express';
import type { HelperDados } from '@urbiverso/sdk';
import { Router, type Request, type Response } from 'express';
import { respostaSegura } from '../comum/assistente';
import { semSigilo, validarMandato } from '../comum/negociacao';
import {
  CANAIS_ENVIO,
  DESCRICAO_PASSAGEM,
  MAX_MENSAGENS_CONTEXTO,
  SCHEMA_RESPOSTA,
  exigePassagem,
  itemDoMandato,
  mensagemDoEnvioAutomatico,
  montarContexto,
  promptSistema,
  sanearResposta,
  validarMovimento,
  vazamentos,
  vazamentosNoRegistro,
  zopa,
  type MandatoMotor,
  type MensagemNegociacao,
  type MotivoPassagem,
  type PropostaResumo,
  type RespostaNegociador,
} from '../comum/negociador';
import { linkWhatsapp } from '../comum/pagina';
import { assincrono, ehCorretor, erro, guardarNegociacao, primeiro, soNegociador } from './acesso';
import {
  MENSAGEM_ENCERRADA,
  NAO_ENCONTRADA,
  configDaConta,
  encerrada,
  gravarPropostaTravada,
  id,
  mandatoVigente,
  objecoesDaConta,
  paraMotor,
  paraResumo,
  portalDa,
  publicar,
  sugestaoSuperada,
  texto,
  ultimaPropostaId,
} from './negociacao';
import { contaDoRequest } from './vitrine';

// Motor do Negociador IA (bloco D2; spec 10.9.4 a 10.9.9). Uma chamada `req.ia.consultar` com o
// schema de 10.9.8 no slot `negociador` (base `poder`); o app valida a resposta com as 7 garantias de
// 10.9.7 (`comum/negociador.ts`) e só então mostra (pergunta antes), envia (faz sozinho, no portal) ou
// passa ao corretor. As regras do dono valem aqui, no código: nada sai abaixo do recuo, nada que revele
// recuo, alvo ou BATNA, e o aceite do acordo é só do corretor (D-98). Sem WhatsApp do app (D-107).
// O negociador humano (D7) usa a sugestão, a decisão (aprovar, editar, descartar), assumir e devolver
// nas negociações atribuídas a ele, com as mesmas validações; o aceite do acordo segue só do corretor.
export const negociadorRotas = Router();
guardarNegociacao(negociadorRotas);

type Linha = Record<string, any>;

const SLOT = 'negociador';
const MENSAGEM_IA_INDISPONIVEL = 'IA indisponível agora: a negociação segue com você.';
const MENSAGEM_RETIDA = '[mensagem retida: revelava informação sigilosa do vendedor]';
const MENSAGEM_ACORDO = 'O acordo já foi aceito e espera a decisão do proprietário: o Negociador não age mais nesta negociação.';

/** Acordo aceito pelo corretor, à espera do proprietário (D-15): o motor não envia nem muda o estado. */
const ACORDO_PROPOSTO = 'aguardando_proprietario';
/** Negociação em que o motor não age: encerrada ou com o acordo já com o proprietário. */
const foraDoMotor = (n: Linha) => encerrada(n) || n.estado === ACORDO_PROPOSTO;

/**
 * O que, se mudar entre a leitura e a trava, tira o "faz sozinho": o mandato vigente, o estado e quem
 * conduz a negociação, e cada proposta com o seu estado (uma proposta nova, um aceite do acordo, uma
 * recusa ou expiração). Mudou: nada sai sozinho; a sugestão fica para o corretor, que revalida ao aprovar.
 */
const impressaoDe = (n: Linha, propostas: Linha[]) =>
  [n.mandato_id ?? 0, n.estado, n.conduzida_por, propostas.map((p) => `${p.id}:${p.estado}`).join(',')].join('|');

/** `estadoSlot` sem custo; falha da sonda conta como indisponível, salvo slot fora do manifesto (bug). */
async function slotDisponivel(ia: Request['ia'] | null | undefined): Promise<boolean> {
  if (!ia) return false;
  try {
    return !!(await ia.estadoSlot(SLOT)).efetivo;
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

// Só a indisponibilidade da conta ou do provedor passa sozinha (ia.md, failsafe de backup). Erro de
// configuração, de entrada ou de resposta (MODELO_INVALIDO, CHAVE_INVALIDA, JANELA_EXCEDIDA,
// ENTRADA_MUITO_GRANDE, RESPOSTA_TRUNCADA, RESPOSTA_INVALIDA…) se repete igual: não manda tentar de novo.
const FALHAS_PASSAGEIRAS = ['QUOTA_EXCEDIDA', 'RATE_LIMIT', 'TIMEOUT', 'ERRO_PROVEDOR'];

/** O 503 da IA que falhou: "tente de novo" só quando passar sozinho; nunca 500. */
function respostaFalhaDeIa(res: Response, e: unknown, complemento: string) {
  const codigo = String((e as { codigo?: string })?.codigo ?? '');
  const mensagem = FALHAS_PASSAGEIRAS.includes(codigo)
    ? `A IA não respondeu agora. Tente de novo em instantes${complemento}.`
    : `A IA do Negociador não está conseguindo responder (${codigo}): avise o suporte da plataforma${complemento}.`;
  return res.status(503).json({ erro: true, codigo: 'IA_INDISPONIVEL', motivo: codigo, mensagem });
}

const hoje = (req: Request) => new Date().toLocaleDateString('sv-SE', { timeZone: req.contexto?.fuso || 'America/Sao_Paulo' });

/** As mensagens da negociação, da mais antiga à mais nova: o que o cliente disse e o que saiu. */
function mensagensDe(execucoes: Linha[]): MensagemNegociacao[] {
  const msgs: MensagemNegociacao[] = [];
  for (const e of execucoes) {
    if (e.mensagem_cliente) msgs.push({ quem: 'cliente', texto: e.mensagem_cliente, quando: e.criado_em ?? null });
    if (e.mensagem_enviada) msgs.push({ quem: 'negociador', texto: e.mensagem_enviada, quando: e.decidida_em ?? null });
  }
  return msgs.slice(-MAX_MENSAGENS_CONTEXTO);
}

/**
 * O que o motor precisa ler da negociação: mandato, propostas, mensagens, objeções, playbook e quem é.
 * A conta vai explícita em toda leitura que não é por id da própria negociação: no listener (SISTEMA)
 * a leitura enxerga todas as contas (contas.md), e a config e o playbook são "a linha da conta".
 */
async function carregar(dados: HelperDados, negociacao: Linha, conta: number, usuarioId: number | null) {
  const nid = Number(negociacao.id);
  const [mandato, propostas, execucoes, objecoes, playbook, config, imovel, contato, perfil] = await Promise.all([
    mandatoVigente(dados, negociacao),
    dados.varrerTudo('propostas', { filtros: { negociacao_id: nid }, ordenar: 'id', ordem: 'asc', maximo: 500 }),
    dados.listar('negociador_execucoes', { filtros: { negociacao_id: nid }, ordenar: 'id', ordem: 'desc', por_pagina: MAX_MENSAGENS_CONTEXTO }),
    dados.varrerTudo('objecoes_detectadas', { filtros: { negociacao_id: nid }, ordenar: 'id', ordem: 'asc', maximo: 500 }),
    objecoesDaConta(dados, conta),
    configDaConta(dados, conta),
    dados.buscar('imoveis', Number(negociacao.imovel_id)),
    dados.buscar('contatos', Number(negociacao.contato_id)),
    usuarioId ? primeiro(dados, 'perfis_corretor', { usuario_id: usuarioId, conta_id: conta }) : null,
  ]);
  return {
    mandato: paraMotor(mandato),
    propostas: propostas.map(paraResumo),
    impressao: impressaoDe(negociacao, propostas),
    mensagens: mensagensDe([...execucoes.dados].reverse()),
    objecoes: objecoes.map((o) => ({ categoria: String(o.categoria), trecho: o.trecho ?? null })),
    playbook: playbook.map((o) => ({ categoria: o.categoria, ...(o.minha ?? o.padrao) })),
    config,
    imovel,
    contato,
    creci: (perfil?.creci as string | null | undefined) ?? null,
    // As propostas que foram ao modelo: o marco de "superada" é o que a IA viu, não o lido sob a trava.
    propostas_ate: ultimaPropostaId(propostas),
  };
}

/** Valores públicos que um texto pode citar sem vazar: a contraproposta, o preço pedido e as propostas. */
const permitidosDe = (mandato: MandatoMotor, propostas: PropostaResumo[], valor_c?: number | null) => [valor_c ?? 0, mandato.preco_pedido_c, ...propostas.map((p) => p.valor_c)];

/** Os vazamentos de um texto contra cada mandato dado (o lido antes e o lido sob a trava, se diferem). */
const vazaEm = (texto: string | null | undefined, mandatos: MandatoMotor[], permitidos: number[]) => mandatos.flatMap((m) => vazamentos(texto, m, permitidos));

/**
 * A resposta que pode ser guardada e mostrada: TODO campo de texto livre do modelo (mensagem,
 * condições, concessão, contrapartida, fonte da estimativa, resumo, motivo, interesses e o trecho da
 * objeção) que revele recuo, alvo ou BATNA é retido, nunca gravado nem devolvido. `vazados` diz quais.
 */
function respostaGuardavel(resposta: RespostaNegociador, mandatos: MandatoMotor[], permitidos: number[]): { guardada: RespostaNegociador; vazados: string[] } {
  const vazados: string[] = [];
  const reter = (campo: string, texto: string | null) => {
    if (!texto || !vazaEm(texto, mandatos, permitidos).length) return texto;
    vazados.push(campo);
    return MENSAGEM_RETIDA;
  };
  // Os campos só de registro (fonte, resumo, motivo, interesses) pela varredura do motor.
  const doRegistro = new Set(mandatos.flatMap((m) => vazamentosNoRegistro(resposta, m, permitidos).map((v) => v.campo)));
  const registro = (campo: 'fonte_estimativa' | 'resumo_rodada' | 'motivo') => {
    if (!doRegistro.has(campo)) return resposta[campo];
    vazados.push(campo);
    return MENSAGEM_RETIDA;
  };
  const cp = resposta.contraproposta;
  const guardada: RespostaNegociador = {
    ...resposta,
    objecao: resposta.objecao ? { ...resposta.objecao, trecho: reter('objecao.trecho', resposta.objecao.trecho) } : null,
    interesses_identificados: doRegistro.has('interesses_identificados')
      ? resposta.interesses_identificados.map((i, n) => reter(`interesses_identificados.${n}`, i) as string)
      : resposta.interesses_identificados,
    fonte_estimativa: registro('fonte_estimativa'),
    contraproposta: cp
      ? { ...cp, condicoes: reter('condicoes', cp.condicoes), concessao: reter('concessao', cp.concessao), contrapartida: reter('contrapartida', cp.contrapartida) }
      : null,
    mensagem: reter('mensagem', resposta.mensagem),
    motivo: registro('motivo'),
    resumo_rodada: registro('resumo_rodada'),
  };
  return { guardada, vazados };
}

/** Mandato e propostas lidos com a negociação já travada (dentro da transação). */
async function estadoTravado(trx: Parameters<typeof gravarPropostaTravada>[0], viva: Linha) {
  const [mandato, propostas] = await Promise.all([
    mandatoVigente(trx, viva),
    trx.varrerTudo('propostas', { filtros: { negociacao_id: Number(viva.id) }, ordenar: 'id', ordem: 'asc', maximo: 500 }),
  ]);
  return { mandato: paraMotor(mandato), propostas: propostas.map(paraResumo), impressao: impressaoDe(viva, propostas), linhas: propostas };
}

/**
 * Única escrita de `estado` do motor, com a negociação já travada nesta transação: nunca sobre acordo
 * proposto nem encerrada (quem chama recusa antes), e só sobre o estado lido sob a trava. Falhar aqui é
 * bug, e lançar desfaz a transação inteira.
 */
async function gravarEstado(trx: Parameters<typeof gravarPropostaTravada>[0], viva: Linha, estado: 'aguardando_corretor' | 'aguardando_cliente') {
  if (foraDoMotor(viva)) throw new Error(`negociação ${viva.id} em ${viva.estado}: o motor não muda o estado`);
  const salva = await trx.atualizarSe('negociacoes', Number(viva.id), { estado }, { estado: viva.estado });
  if (!salva) throw new Error(`negociação ${viva.id} mudou de estado sob a própria trava`);
}

type RecusaMotor = 'nao_encontrada' | 'encerrada' | 'acordo';

/** Por que o motor não age nesta negociação (encerrada ou acordo proposto), ou null se ele age. */
const recusaDe = (viva: Linha): RecusaMotor | null => (encerrada(viva) ? 'encerrada' : viva.estado === ACORDO_PROPOSTO ? 'acordo' : null);

function responderRecusa(res: Response, recusa: RecusaMotor) {
  if (recusa === 'nao_encontrada') return erro(res, 404, 'NAO_ENCONTRADO', NAO_ENCONTRADA);
  if (recusa === 'encerrada') return erro(res, 409, 'NEGOCIACAO_ENCERRADA', MENSAGEM_ENCERRADA);
  return erro(res, 409, 'ACORDO_PROPOSTO', MENSAGEM_ACORDO);
}

/** Texto retido não sai: a aprovação manda o campo vazio (o corretor edita, se quiser). */
const semRetido = (t: string | null) => (t === MENSAGEM_RETIDA ? null : t);

const descreverPassagem = (motivos: MotivoPassagem[]) => motivos.map((m) => ({ motivo: m, descricao: DESCRICAO_PASSAGEM[m] }));

/** Sonda sem custo: a tela mostra "Pedir sugestão" só com o slot resolvendo (senão, "IA indisponível agora"). */
negociadorRotas.get(
  '/negociador/ia',
  assincrono(async (req, res) => {
    res.json({ disponivel: await slotDisponivel(req.ia) });
  }),
);

/**
 * Por onde o motor lê, grava, consulta a IA e avisa: a rota (`req`) ou o listener do portal (`ctx`,
 * SISTEMA, com a escrita endereçada por `comConta`). A leitura inicial passa por `emLeitura` (na rota,
 * sem transação, como sempre foi); o que decide e grava, por `emTransacao`, com a negociação travada.
 */
export interface MeioMotor {
  conta: number;
  emLeitura<T>(fn: (dados: HelperDados) => Promise<T>): Promise<T>;
  emTransacao<T>(fn: (trx: HelperDados) => Promise<T>): Promise<T>;
  ia: NonNullable<Request['ia']> | null | undefined;
  /** Hoje no fuso da conta, `AAAA-MM-DD`. */
  hoje: string;
  /** Quem assina no prompt (o corretor da rota, ou o responsável pela negociação no listener). */
  usuario: { id: number | null; nome: string };
  publicar(tipo: string, payload: Record<string, number | null>): Promise<void>;
}

export type ResultadoMotor =
  | { recusa: RecusaMotor }
  | { ia_indisponivel: true }
  | { falha_ia: unknown }
  | {
      execucao: Linha;
      ia: boolean;
      guardada: RespostaNegociador | null;
      validacao: ReturnType<typeof validarMovimento>;
      motivos: MotivoPassagem[];
      passagem: boolean;
      proposta: Linha | null;
      mensagem_enviada: string | null;
      zopa: ReturnType<typeof zopa>;
    };

/**
 * O próximo movimento do Negociador dentro do mandato (10.9.4 a 10.9.7): consulta a IA fora de
 * transação, confere tudo de novo com a negociação travada e só então grava a sugestão, envia (faz
 * sozinho, no portal) ou passa ao corretor. A conta da negociação é conferida em toda leitura.
 */
export async function executarMotor(meio: MeioMotor, nid: number, entrada: { mensagem_cliente: string | null; canal: string }): Promise<ResultadoMotor> {
  const { mensagem_cliente, canal } = entrada;
  const dia = meio.hoje;
  const lido = await meio.emLeitura(async (dados) => {
    const negociacao = await dados.buscar('negociacoes', nid);
    if (!negociacao || Number(negociacao.conta_id) !== meio.conta) return null;
    return { negociacao, ctx: await carregar(dados, negociacao, meio.conta, meio.usuario.id) };
  });
  if (!lido) return { recusa: 'nao_encontrada' };
  const { negociacao, ctx } = lido;
  const recusaAntes = recusaDe(negociacao);
  if (recusaAntes) return { recusa: recusaAntes };

  // Sem mandato vigente o Negociador não age (10.9.5): passa ao corretor sem gastar chamada de IA.
  // A chamada de IA fica FORA da transação (não segura a trava da negociação esperando o modelo).
  let resposta: RespostaNegociador | null = null;
  let uso: { tokens_entrada?: number; tokens_saida?: number; duracao_ms?: number } = {};
  if (ctx.mandato && ctx.mandato.validade >= dia) {
    if (!(await slotDisponivel(meio.ia))) return { ia_indisponivel: true };
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
      nome_corretor: meio.usuario.nome,
      creci: ctx.creci,
      imovel_titulo: ctx.imovel?.titulo ?? ctx.imovel?.codigo ?? '',
    });
    try {
      const r = await meio.ia!.consultar({ contexto, schema: SCHEMA_RESPOSTA, slot: SLOT, instrucoes_sistema });
      resposta = sanearResposta(r.dados);
      uso = { tokens_entrada: r.tokens_entrada, tokens_saida: r.tokens_saida, duracao_ms: r.duracao_ms };
    } catch (e) {
      if (!falhaDeIa(e)) throw e;
      return { falha_ia: e };
    }
    if (resposta.mensagem) resposta.mensagem = respostaSegura(resposta.mensagem);
  }
  const movimento = resposta ?? { movimento: 'passar_ao_corretor', contraproposta: null, mensagem: null, passar_ao_corretor: true };

  // Tudo o que decide se algo sai (as 7 garantias, a passagem, o "faz sozinho") é conferido de novo
  // com a negociação TRAVADA, contra o mandato, as propostas e quem conduz lidos sob a trava
  // (banco-de-dados.md, Trava de linha). Duas sugestões ao mesmo tempo se enfileiram aqui; o
  // /assumir, o PUT do mandato e o registro de proposta gravam na mesma linha e esperam (ou são esperados).
  const resultado = await meio.emTransacao(async (trx) => {
    const viva = await trx.buscar('negociacoes', nid, { travar: true });
    // Encerrada ou com o acordo aceito no meio (o corretor aceitou enquanto a IA pensava): nada se
    // grava, e o `aguardando_proprietario` não é rebaixado.
    if (!viva) return { recusa: 'nao_encontrada' as const };
    const recusa = recusaDe(viva);
    if (recusa) return { recusa };
    const agora = await estadoTravado(trx, viva);
    const automatico = agora.mandato?.autonomia === 'faz_sozinho' && viva.conduzida_por === 'ia';
    const validacao = validarMovimento(movimento, agora.mandato, agora.propostas, { hoje: dia, canal, automatico });
    const teto_c = resposta?.teto_estimado_comprador_c ?? viva.teto_estimado_comprador_c;
    const motivos = exigePassagem({ resposta: movimento, mensagem_cliente, mandato: agora.mandato, propostas: agora.propostas, teto_estimado_c: teto_c, hoje: dia });
    const passagem = validacao.bloqueado_por.length > 0 || validacao.passa_ao_corretor || motivos.length > 0;
    // O mundo mudou enquanto a IA pensava (outro mandato, outro estado, outra proposta ou o estado de
    // uma proposta): nada sai sozinho; a sugestão fica pendente para o corretor, que revalida ao aprovar.
    const mudou = agora.impressao !== ctx.impressao;
    const cp = resposta?.movimento === 'contraproposta' ? resposta.contraproposta : null;
    // O que sai sozinho é só o que o código monta com campos estruturados (decisão do dono): o valor,
    // a concessão e a contrapartida como estão no mandato e a validade. O texto do modelo, não.
    const item = cp?.concessao && agora.mandato ? itemDoMandato(cp.concessao, agora.mandato.concessoes) : null;
    const textoAutomatico = cp?.valor_c
      ? mensagemDoEnvioAutomatico({ valor_c: cp.valor_c, item, validade_horas: cp.validade_horas, primeiro_nome: String(ctx.contato?.nome ?? '').split(/\s+/)[0] })
      : null;
    // Segunda trava: se o próprio texto montado citasse algo sigiloso (o corretor escreveu o recuo no
    // item do mandato), ele não sai sozinho.
    const textoLimpo = !!textoAutomatico && !!agora.mandato && vazamentos(textoAutomatico, agora.mandato, permitidosDe(agora.mandato, agora.propostas, cp?.valor_c)).length === 0;
    const enviaSozinho = !passagem && !mudou && automatico && canal === 'portal' && !!cp?.valor_c && textoLimpo;
    // Sigilo do que se grava e se devolve: contra o mandato lido antes (o que a IA viu) e o de agora.
    const mandatos = [ctx.mandato, agora.mandato].filter((m): m is MandatoMotor => !!m);
    const permitidos = agora.mandato ? permitidosDe(agora.mandato, agora.propostas, cp?.valor_c) : [];
    const guardavel = resposta ? respostaGuardavel(resposta, mandatos, permitidos) : null;
    const guardada = guardavel?.guardada ?? null;

    // A objeção detectada é só inclusão (O5).
    let objecao: Linha | null = null;
    if (guardada?.objecao?.categoria && ctx.contato) {
      objecao = await trx.criar('objecoes_detectadas', {
        negociacao_id: nid,
        contato_id: Number(viva.contato_id),
        categoria: guardada.objecao.categoria,
        trecho: semRetido(guardada.objecao.trecho) ?? (mensagem_cliente ? mensagem_cliente.slice(0, 500) : null),
        detectada_por: 'ia',
        tratada: guardada.movimento === 'responder_objecao' && !passagem,
        em: new Date(),
      });
    }
    if (guardada?.teto_estimado_comprador_c) {
      await trx.atualizar('negociacoes', nid, { teto_estimado_comprador_c: guardada.teto_estimado_comprador_c, fonte_estimativa: guardada.fonte_estimativa });
    }
    if (passagem) await gravarEstado(trx, viva, 'aguardando_corretor');

    // Faz sozinho, dentro do mandato e no portal: a contraproposta sai sem o corretor (10.9.3).
    let proposta: Linha | null = null;
    if (enviaSozinho) {
      const r = await gravarPropostaTravada(trx, nid, {
        direcao: 'vendedor',
        autor_tipo: 'negociador_ia',
        autor_usuario_id: null,
        valor_c: cp!.valor_c!,
        // Sem texto do modelo na proposta que o cliente vê: as condições ficam de fora, e a concessão e
        // a contrapartida são as do mandato.
        condicoes: null,
        concessao: item?.item ?? null,
        contrapartida: item?.contrapartida ?? null,
        validade_ate: cp!.validade_horas ? new Date(Date.now() + cp!.validade_horas * 3600e3) : null,
        canal: 'portal',
        estado: 'enviada',
      });
      // A trava já é nossa: recusa aqui é bug, e lançar desfaz tudo.
      if ('recusa' in r) throw new Error(`negociação ${nid} recusou a proposta sob a própria trava`);
      proposta = r.proposta;
      await gravarEstado(trx, viva, 'aguardando_cliente');
    }
    const execucao = await trx.criar('negociador_execucoes', {
      negociacao_id: nid,
      mensagem_cliente,
      // `propostas_ate`: a última proposta (de qualquer lado) que a IA viu (lida antes da chamada; marco de "superada").
      entrada: { canal, automatico, mudou, mandato_versao: agora.mandato ? (viva.mandato_id ?? null) : null, rodadas: Number(viva.rodadas ?? 0), propostas_ate: ctx.propostas_ate },
      saida: guardada,
      // O que foi retido por sigilo deixa rastro: só o nome do campo, nunca o conteúdo.
      validacoes: { verificacoes: validacao.verificacoes, passagem: motivos, retidos: guardavel?.vazados ?? [] },
      bloqueado_por: validacao.bloqueado_por.length ? validacao.bloqueado_por.join(',').slice(0, 300) : null,
      tokens_entrada: uso.tokens_entrada ?? null,
      tokens_saida: uso.tokens_saida ?? null,
      duracao_ms: uso.duracao_ms ?? null,
      decisao: passagem ? 'passagem' : proposta ? 'automatica' : 'pendente',
      ...(proposta ? { proposta_id: proposta.id, mensagem_enviada: textoAutomatico, decidida_em: new Date() } : {}),
    });
    const pendenteComContraproposta = !passagem && !proposta && guardada?.movimento === 'contraproposta' && !!guardada.contraproposta?.valor_c;
    return { execucao, objecao, proposta, mensagem_enviada: proposta ? textoAutomatico : null, validacao, motivos, passagem, guardada, pendenteComContraproposta, zopa: zopa(agora.mandato, teto_c) };
  });
  if ('recusa' in resultado && resultado.recusa) return { recusa: resultado.recusa };
  const r = resultado as Exclude<typeof resultado, { recusa: unknown }>;

  if (r.objecao) await meio.publicar('objecao_detectada', { negociacao_id: nid, objecao_id: r.objecao.id });
  if (r.passagem) await meio.publicar('negociacao_limite_atingido', { negociacao_id: nid });
  else if (r.proposta) await meio.publicar('contraproposta_enviada', { negociacao_id: nid, proposta_id: r.proposta.id });
  // "Espera a sua aprovação": só quando há uma contraproposta pendente (manifesto, contraproposta_sugerida).
  else if (r.pendenteComContraproposta) await meio.publicar('contraproposta_sugerida', { negociacao_id: nid, execucao_id: r.execucao.id });
  return {
    execucao: r.execucao,
    ia: !!resposta,
    guardada: r.guardada,
    validacao: r.validacao,
    motivos: r.motivos,
    passagem: r.passagem,
    proposta: r.proposta,
    mensagem_enviada: r.mensagem_enviada,
    zopa: r.zopa,
  };
}

/** O meio da rota: o `req` do corretor, com a conta ativa. */
function meioDaRota(req: Request): MeioMotor {
  const dados = req.dados!;
  return {
    conta: contaDoRequest(req),
    emLeitura: (fn) => fn(dados),
    emTransacao: (fn) => dados.transaction(fn),
    ia: req.ia,
    hoje: hoje(req),
    usuario: { id: req.contexto?.usuario.id ?? null, nome: req.contexto?.usuario.nome ?? '' },
    publicar: (tipo, payload) => publicar(req, tipo, payload),
  };
}

// Pedir sugestão (P15, M8): o próximo movimento do Negociador dentro do mandato.
negociadorRotas.post(
  '/negociacoes/:id/sugestao',
  assincrono(async (req, res) => {
    const dados = req.dados!;
    const nid = id(req.params.id);
    const negociacao = nid ? await dados.buscar('negociacoes', nid) : null;
    if (!negociacao) return erro(res, 404, 'NAO_ENCONTRADO', NAO_ENCONTRADA);
    if (foraDoMotor(negociacao)) return responderRecusa(res, recusaDe(negociacao)!);
    const b = (req.body ?? {}) as Record<string, unknown>;
    if (b.mensagem_cliente !== undefined && b.mensagem_cliente !== null && typeof b.mensagem_cliente !== 'string') {
      return erro(res, 422, 'DADOS_INVALIDOS', 'mensagem_cliente: use texto.');
    }
    if (b.canal !== undefined && !(CANAIS_ENVIO as readonly unknown[]).includes(b.canal)) {
      return erro(res, 422, 'CANAL_INDISPONIVEL', 'Canal: use portal ou wa_me (Fazer agora). O WhatsApp do app ainda não existe.');
    }
    const r = await executarMotor(meioDaRota(req), nid!, { mensagem_cliente: texto(b.mensagem_cliente, 1000), canal: (b.canal as string | undefined) ?? 'portal' });
    if ('recusa' in r) return responderRecusa(res, r.recusa);
    if ('ia_indisponivel' in r) return erro(res, 503, 'IA_INDISPONIVEL', MENSAGEM_IA_INDISPONIVEL);
    if ('falha_ia' in r) return respostaFalhaDeIa(res, r.falha_ia, '; a negociação segue com você');
    if (r.proposta || r.passagem) await portalDa(req, negociacao);

    res.json(
      semSigilo({
        execucao_id: r.execucao.id,
        ia: r.ia,
        resposta: r.guardada,
        validacoes: r.validacao.verificacoes,
        bloqueado_por: r.validacao.bloqueado_por,
        passagem: r.passagem,
        motivos_passagem: descreverPassagem(r.motivos),
        // Só se existe: as pontas da faixa (o recuo) ficam na rota do mandato.
        zopa: { existe: r.zopa.existe },
        enviada: r.proposta,
        // O texto que o cliente recebe no envio automático: montado pelo código, sem texto do modelo.
        mensagem_enviada: r.mensagem_enviada,
      }),
    );
  }),
);

const ACOES = ['aprovar', 'editar', 'descartar', 'aceitar_acordo'] as const;
/** Proposta que já não se aceita. */
const ESTADOS_PROPOSTA_FECHADA = ['aceita', 'recusada', 'substituida', 'expirada'] as const;

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
        if (!viva || encerrada(viva)) return 'encerrada' as const;
        // Um acordo por vez: com um já levado ao proprietário, outro não se aceita.
        if (viva.estado === ACORDO_PROPOSTO) return 'acordo' as const;
        // Relida sob a trava: só a proposta viva do comprador se aceita, e uma vez só (o segundo
        // clique encontra `aceita` e não republica o evento).
        const atual = await trx.buscar('propostas', pid!);
        if (!atual || (ESTADOS_PROPOSTA_FECHADA as readonly string[]).includes(atual.estado)) return 'indisponivel' as const;
        if (atual.validade_ate && new Date(atual.validade_ate).getTime() < Date.now()) return 'vencida' as const;
        await trx.atualizar('propostas', pid!, { estado: 'aceita' });
        // O fechamento depende da decisão do proprietário (D-15): a negociação vai a ele.
        await trx.atualizar('negociacoes', nid!, { estado: 'aguardando_proprietario' });
        return 'aceita' as const;
      });
      if (feito === 'encerrada') return erro(res, 409, 'NEGOCIACAO_ENCERRADA', MENSAGEM_ENCERRADA);
      if (feito === 'acordo') return responderRecusa(res, 'acordo');
      if (feito === 'indisponivel') return erro(res, 409, 'PROPOSTA_INDISPONIVEL', 'Esta proposta já foi aceita, recusada, substituída ou expirou.');
      if (feito === 'vencida') return erro(res, 409, 'PROPOSTA_VENCIDA', 'A validade desta proposta já passou: peça ao comprador que a renove.');
      await publicar(req, 'negociacao_acordo_proposto', { negociacao_id: nid!, proposta_id: pid! });
      await portalDa(req, negociacao);
      return res.json({ ok: true, estado: 'aguardando_proprietario', proposta_id: pid });
    }

    const eid = id(b.execucao_id);
    const execucao = eid ? await dados.buscar('negociador_execucoes', eid) : null;
    if (!execucao || Number(execucao.negociacao_id) !== nid) return erro(res, 404, 'NAO_ENCONTRADO', 'Sugestão não encontrada.');
    if (execucao.decisao !== 'pendente') return erro(res, 409, 'SUGESTAO_JA_DECIDIDA', 'Esta sugestão já foi decidida ou passada a você.');
    // Com o acordo aceito, nenhuma sugestão antiga sai (descartar continua valendo, para limpar a fila).
    if (b.acao !== 'descartar' && negociacao.estado === ACORDO_PROPOSTO) return responderRecusa(res, 'acordo');

    if (b.acao === 'descartar') {
      const salva = await dados.atualizarSe('negociador_execucoes', eid!, { decisao: 'descartada', decidida_em: new Date() }, { decisao: 'pendente' });
      if (!salva) return erro(res, 409, 'SUGESTAO_JA_DECIDIDA', 'Esta sugestão já foi decidida.');
      return res.json({ ok: true, decisao: 'descartada' });
    }

    if (!(CANAIS_ENVIO as readonly unknown[]).includes(b.canal)) {
      return erro(res, 422, 'CANAL_INDISPONIVEL', 'Escolha o canal: portal ou wa_me (Fazer agora). O WhatsApp do app ainda não existe.');
    }
    const canal = b.canal as string;
    // Fazer agora sem WhatsApp do cliente: recusa antes de qualquer escrita (nada gravado, a sugestão
    // continua pendente). O teste é o mesmo do link (`linkWhatsapp`): aprovar e devolver link nulo gravaria
    // uma rodada que não chega ao cliente.
    const contato = negociacao.contato_id ? await dados.buscar('contatos', Number(negociacao.contato_id)) : null;
    if (canal === 'wa_me' && !linkWhatsapp(contato?.telefone, '-')) {
      return erro(res, 422, 'SEM_WHATSAPP', 'O cliente não tem um telefone de WhatsApp válido no cadastro. Envie pelo portal ou corrija o telefone do contato.');
    }
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
        // O texto do modelo é só rascunho (D-111): sem mensagem do corretor, sai a montada pelo código.
        mensagem: b.mensagem !== undefined ? texto(b.mensagem, 1000) : null,
      };
    }
    // Mensagem vazia ou só espaços equivale a "não escreveu" (`texto` dá null): sai a montada pelo código.
    const escreveu = b.acao === 'editar' && movimento.mensagem !== null;
    const edContraproposta = b.acao === 'editar' && b.contraproposta !== undefined && b.contraproposta !== null;
    // Editar sem mudar nada (sem texto e sem contraproposta) é aprovar: o registro é o de aprovação.
    const editada = escreveu || edContraproposta;
    // D-111: ao cliente só sai texto que o código monta (valor, item e contrapartida do mandato,
    // validade) ou que o corretor escreveu ao editar. A mensagem e as condições do modelo são rascunho.
    movimento = {
      ...movimento,
      mensagem: escreveu ? semRetido(movimento.mensagem) : null,
      contraproposta: movimento.contraproposta
        ? {
            ...movimento.contraproposta,
            condicoes: edContraproposta ? semRetido(movimento.contraproposta.condicoes) : null,
            concessao: semRetido(movimento.contraproposta.concessao),
            contrapartida: edContraproposta ? semRetido(movimento.contraproposta.contrapartida) : null,
          }
        : null,
    };
    const temContraproposta = movimento.movimento === 'contraproposta' && !!movimento.contraproposta?.valor_c;
    // Resposta só em texto não tem o que montar: sai só o que o corretor escrever (editar).
    if (!temContraproposta && !movimento.mensagem) {
      return erro(res, 422, 'ESCREVA_A_MENSAGEM', 'Esta sugestão é só texto, e o texto do Negociador é um rascunho: edite e envie a mensagem com as suas palavras, ou descarte.');
    }
    const dia = hoje(req);
    // Desfecho tipado como união discriminada: só a recusa `bloqueado` carrega a validação.
    type Desfecho =
      | { recusa: RecusaMotor | 'decidida' | 'superada' }
      | { recusa: 'bloqueado'; validacao: ReturnType<typeof validarMovimento> }
      | { proposta: Linha | null };
    const resultado = await dados.transaction(async (trx): Promise<Desfecho> => {
      // Trava a negociação ANTES de qualquer escrita: encerrada não reabre, e a revalidação usa o
      // mandato e as propostas lidos sob a trava (uma aprovação anterior já conta no passo e na rodada).
      const viva = await trx.buscar('negociacoes', nid!, { travar: true });
      // Encerrada, ou o corretor aceitou o acordo entre a leitura e a trava: a sugestão antiga não sai.
      if (!viva) return { recusa: 'nao_encontrada' as const };
      const recusa = recusaDe(viva);
      if (recusa) return { recusa };
      const agora = await estadoTravado(trx, viva);
      // Sob a trava: sugestão com execução mais nova ou qualquer proposta depois dela não sai (o
      // detalhe já não a mostra). Descartar, mais acima, continua valendo.
      const maisNova = (await trx.listar('negociador_execucoes', { filtros: { negociacao_id: nid }, ordenar: 'id', ordem: 'desc', por_pagina: 1 })).dados[0];
      if (sugestaoSuperada(execucao, Number(maisNova?.id ?? 0), agora.linhas)) return { recusa: 'superada' as const };
      // O item do mandato (lido sob a trava) dá a concessão e a contrapartida que saem, como na D-110.
      if (temContraproposta && !edContraproposta) {
        const cp0 = movimento.contraproposta!;
        const item = cp0.concessao && agora.mandato ? itemDoMandato(cp0.concessao, agora.mandato.concessoes) : null;
        movimento = { ...movimento, contraproposta: { ...cp0, concessao: item?.item ?? cp0.concessao, contrapartida: item?.contrapartida ?? null } };
      }
      if (temContraproposta && !escreveu) {
        const cp0 = movimento.contraproposta!;
        const item = cp0.concessao && cp0.contrapartida ? { item: cp0.concessao, limite: '', contrapartida: cp0.contrapartida } : null;
        movimento = {
          ...movimento,
          mensagem: mensagemDoEnvioAutomatico({ valor_c: cp0.valor_c!, item, validade_horas: cp0.validade_horas, primeiro_nome: String(contato?.nome ?? '').split(/\s+/)[0] }),
        };
      }
      // Revalida no código o que de fato sai: a edição do corretor também não passa do recuo nem
      // revela o sigilo, e o texto montado passa pela mesma trava (10.9.7).
      const validacao = validarMovimento(movimento, agora.mandato, agora.propostas, { hoje: dia, canal, automatico: false });
      if (!validacao.ok) return { recusa: 'bloqueado' as const, validacao };
      // Reserva a sugestão antes de gravar: dois cliques em "aprovar" não mandam duas propostas.
      const reservada = await trx.atualizarSe('negociador_execucoes', eid!, { decisao: editada ? 'editada' : 'aprovada' }, { decisao: 'pendente' });
      if (!reservada) return { recusa: 'decidida' as const };
      let proposta: Linha | null = null;
      if (temContraproposta) {
        const cp = movimento.contraproposta!;
        const r = await gravarPropostaTravada(trx, nid!, {
          direcao: 'vendedor',
          autor_tipo: editada ? (soNegociador(req) ? 'negociador_humano' : 'corretor') : 'negociador_ia',
          autor_usuario_id: req.contexto?.usuario.id ?? null,
          valor_c: cp.valor_c!,
          condicoes: cp.condicoes,
          concessao: cp.concessao,
          contrapartida: cp.contrapartida,
          validade_ate: cp.validade_horas ? new Date(Date.now() + cp.validade_horas * 3600e3) : null,
          canal,
          estado: 'enviada',
        });
        // A trava já é nossa: recusa aqui é bug, e lançar desfaz a reserva junto.
        if ('recusa' in r) throw new Error(`negociação ${nid} recusou a proposta sob a própria trava`);
        proposta = r.proposta;
      }
      await trx.atualizar('negociador_execucoes', eid!, {
        aprovada_sem_edicao: !editada,
        proposta_id: proposta?.id ?? null,
        mensagem_enviada: movimento.mensagem,
        decidida_em: new Date(),
      });
      await gravarEstado(trx, viva, 'aguardando_cliente');
      return { proposta };
    });
    if ('recusa' in resultado) {
      if (resultado.recusa === 'decidida') return erro(res, 409, 'SUGESTAO_JA_DECIDIDA', 'Esta sugestão já foi decidida.');
      if (resultado.recusa === 'superada') return erro(res, 409, 'SUGESTAO_SUPERADA', 'Há uma sugestão ou proposta mais nova: peça outra sugestão.');
      if (resultado.recusa !== 'bloqueado') return responderRecusa(res, resultado.recusa);
      const { validacao } = resultado;
      return res.status(422).json({
        erro: true,
        codigo: 'MOVIMENTO_BLOQUEADO',
        mensagem: validacao.passa_ao_corretor && !validacao.bloqueado_por.length ? 'Este movimento não se envia: é passagem ao corretor.' : 'Esta contraproposta não pode sair como está.',
        bloqueado_por: validacao.bloqueado_por,
        detalhes: validacao.verificacoes.filter((v) => !v.ok).map((v) => `${v.codigo}: ${v.detalhe}`),
      });
    }
    if (resultado.proposta) await publicar(req, 'contraproposta_enviada', { negociacao_id: nid!, proposta_id: resultado.proposta.id });
    await portalDa(req, negociacao);

    // Fazer agora: o texto pronto e o wa.me do cliente; o envio é do celular do corretor (D-107).
    const cp = movimento.contraproposta;
    const textoPronto = movimento.mensagem ?? (cp?.valor_c ? mensagemDoEnvioAutomatico({ valor_c: cp.valor_c, item: null, validade_horas: cp.validade_horas }) : '');
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

// Um atendente por vez (10.9.4): o corretor assume ou devolve ao Negociador IA. O negociador humano
// (D7) assume como `humano` e devolve ao Negociador IA, só na negociação atribuída a ele (a guarda dá 404
// nas outras) e só enquanto ela não está com o corretor: o que o corretor tomou para si, só o corretor
// devolve (403 `SO_O_CORRETOR`). A escrita é condicionada a quem conduzia na leitura (409 se mudou).
for (const [rota, paraCorretor, evento] of [
  ['assumir', 'corretor', 'negociacao_assumida'],
  ['devolver', 'ia', 'negociacao_devolvida'],
] as const) {
  negociadorRotas.post(
    `/negociacoes/:id/${rota}`,
    assincrono(async (req, res) => {
      const para = paraCorretor === 'corretor' && soNegociador(req) ? 'humano' : paraCorretor;
      const dados = req.dados!;
      const nid = id(req.params.id);
      const negociacao = nid ? await dados.buscar('negociacoes', nid) : null;
      if (!negociacao) return erro(res, 404, 'NAO_ENCONTRADO', NAO_ENCONTRADA);
      if (encerrada(negociacao)) return erro(res, 409, 'NEGOCIACAO_ENCERRADA', MENSAGEM_ENCERRADA);
      if (soNegociador(req) && negociacao.conduzida_por === 'corretor') {
        return erro(res, 403, 'SO_O_CORRETOR', 'O corretor assumiu esta negociação: só ele a devolve.');
      }
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
    if (!(await slotDisponivel(req.ia))) return erro(res, 503, 'IA_INDISPONIVEL', MENSAGEM_IA_INDISPONIVEL);
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
      return respostaFalhaDeIa(res, e, '');
    }
    if (resposta.mensagem) resposta.mensagem = respostaSegura(resposta.mensagem);
    const validacao = validarMovimento(resposta, mandato, propostas, { hoje: dia, canal: 'portal', automatico: false });
    const teto = resposta.teto_estimado_comprador_c ?? (Number.isInteger(b.teto_estimado_c) ? (b.teto_estimado_c as number) : null);
    const motivos = exigePassagem({ resposta, mensagem_cliente, mandato, propostas, teto_estimado_c: teto, hoje: dia });
    // Aqui os valores são do próprio teste (digitados pelo corretor): a faixa volta inteira.
    res.json({
      resposta: respostaGuardavel(resposta, [mandato], permitidosDe(mandato, propostas, resposta.contraproposta?.valor_c)).guardada,
      validacoes: validacao.verificacoes.map((x) => ({ ...x, marca: x.ok ? '✓' : '✗', frase: `${x.ok ? '✓' : '✗'} ${x.descricao}` })),
      bloqueado_por: validacao.bloqueado_por,
      passagem: validacao.bloqueado_por.length > 0 || validacao.passa_ao_corretor || motivos.length > 0,
      motivos_passagem: descreverPassagem(motivos),
      zopa: zopa(mandato, teto),
    });
  }),
);

