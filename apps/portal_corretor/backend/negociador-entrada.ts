import '@urbiverso/sdk/express';
import { createHash } from 'node:crypto';
import type { Request } from 'express';
import type { ContextoListener, HelperDados } from '@urbiverso/sdk';
import { MARCO_PADRAO } from '../comum/funil';
import { gatilhoLigado, type Gatilho } from '../comum/negociador-gatilhos';
import { semSigilo } from '../comum/negociacao';
import { conducaoNova, avisarNegociador } from './negociador-padrao';
import { configDaConta, criarNegociacao, depoisDeCriar, encerrada, mandatoVigente } from './negociacao';
import { executarMotor, type MeioMotor } from './negociador';
import { contaDoRequest } from './vitrine';

// Quando o Negociador entra (spec 10.9.4; issue #135, F3). Além da oferta registrada ou feita no portal
// (que já existia), três gatilhos, cada um com a sua caixa em Ajustes › Negociador:
// - `etapa_proposta`: o negócio de compra chega à etapa Proposta (rota do negócio);
// - `pedido_desconto`: o cliente pede desconto ou fala de preço numa mensagem do portal (listener);
// - `reacao_preco`: o cliente reage "Conversar sobre o preço" na seleção ou no portal (listener).
// "Entrar" é: a negociação do negócio passa a existir, conduzida por quem a conta escolheu (D-94, o
// Negociador IA; ou a pessoa padrão, já atribuída e avisada). Na mensagem com fala de preço, o motor do
// D2 roda sobre ela, com as mesmas 7 garantias, se o Negociador IA conduz e há mandato vigente. Nada aqui
// fecha acordo nem mexe no mandato: o aceite final continua só do corretor (D-98).

type Linha = Record<string, any>;

/** Tarefa para o corretor, sem repetir uma igual que ainda está pendente (mesma regra do `publico.ts`). */
async function tarefaDoCorretor(dados: HelperDados, conta: number | undefined, contatoId: number, responsavel: unknown, titulo: string) {
  const curto = titulo.slice(0, 200);
  const pendentes = await dados.varrerTudo('atividades', { filtros: { ...(conta ? { conta_id: conta } : {}), contato_id: contatoId, tipo: 'tarefa', status: 'pendente' }, maximo: 200 });
  if (pendentes.some((a) => a.titulo === curto)) return;
  await dados.criar('atividades', { tipo: 'tarefa', titulo: curto, contato_id: contatoId, responsavel_id: responsavel ?? null, quando: new Date().toISOString(), status: 'pendente', criada_por_agente: false });
}

const tituloMandato = (codigo: unknown) => `O Negociador entrou na ${codigo ?? 'negociação'}: defina o mandato`;

/** A etapa é a "Proposta" do funil de compra (pelo marco; etapa sem marco, pelo nome padrão). */
const ehEtapaProposta = (etapa: Linha | null | undefined) =>
  !!etapa && etapa.pipeline === 'compra' && (etapa.marco ?? MARCO_PADRAO[etapa.nome] ?? null) === 'proposta';

/**
 * Gatilho `etapa_proposta`, nas rotas que põem o negócio numa etapa: a mudança de etapa e a criação
 * (o funil cuja primeira etapa em andamento é a Proposta). Com a caixa marcada, o Negociador ligado, o
 * negócio de compra com imóvel e sem negociação em andamento, a negociação nasce. Devolve o que a tela
 * precisa para avisar o corretor (código e quem conduz), ou `null`. Nunca derruba a gravação do
 * negócio: falha aqui fica no log e o corretor abre a negociação à mão, como antes.
 *
 * A negociação, a atribuição (padrão humano) e a tarefa do mandato nascem juntas, numa transação, ou
 * nenhuma nasce. O que vem depois do commit (evento, portal, aviso direto) é melhor esforço e não
 * esconde da tela a negociação que já existe.
 */
export async function entrarPelaEtapaProposta(req: Request, negocio: Linha, etapa: Linha | null) {
  let criada: Linha;
  try {
    if (!ehEtapaProposta(etapa) || negocio.pipeline !== 'compra' || !negocio.imovel_id) return null;
    const dados = req.dados!;
    const config = await configDaConta(dados);
    if (!gatilhoLigado(config, 'etapa_proposta')) return null;
    const conducao = await conducaoNova(req.shell, contaDoRequest(req), config);
    const r = await criarNegociacao(dados, {
      negocio,
      imovelId: Number(negocio.imovel_id),
      conducao,
      atribuidaPor: req.contexto?.usuario.id ?? null,
      tentativas: 5,
      aoGravar: (h, n) => tarefaDoCorretor(h, undefined, Number(negocio.contato_id), negocio.responsavel_id, tituloMandato(n.codigo)),
    });
    if (!('negociacao' in r)) return null;
    criada = r.negociacao;
  } catch (e) {
    console.warn(`[portal_corretor] Negociador não entrou pela etapa Proposta (negócio ${negocio.id}): ${(e as Error).message}`);
    return null;
  }
  try {
    await depoisDeCriar(req, criada);
  } catch (e) {
    console.warn(`[portal_corretor] depois de abrir a negociação ${criada.id}: ${(e as Error).message}`);
  }
  return { negociacao_id: Number(criada.id), codigo: String(criada.codigo), conduzida_por: String(criada.conduzida_por) };
}

/** O que o listener faz depois do commit, quando o Negociador entrou numa negociação. */
export interface Entrada {
  negociacao: Linha;
  nova: boolean;
}

/**
 * Gatilhos do cliente (`reacao_preco`, `pedido_desconto`), dentro da transação do listener (SISTEMA, com
 * a conta filtrada em toda leitura). Acha a negociação em que o Negociador entra: a indicada (só se é
 * deste cliente, nesta conta, em andamento), ou a única em andamento do cliente (do imóvel, quando há
 * um); sem nenhuma, abre a do único negócio de compra em aberto do cliente com aquele imóvel (ou com
 * imóvel, quando a mensagem não cita um). Ambíguo, nada: o corretor recebe a tarefa de sempre.
 */
export async function entrarPeloCliente(
  trx: HelperDados,
  ctx: ContextoListener,
  conta: number,
  o: { gatilho: Gatilho; contato: Linha; imovelId?: number | null; negociacaoId?: number | null },
): Promise<Entrada | null> {
  const config = await configDaConta(trx, conta);
  if (!gatilhoLigado(config, o.gatilho)) return null;
  const contatoId = Number(o.contato.id);
  const abertas = (await trx.varrerTudo('negociacoes', { filtros: { conta_id: conta, contato_id: contatoId }, maximo: 200 })).filter((n) => !encerrada(n));
  if (o.negociacaoId) {
    const indicada = abertas.find((n) => Number(n.id) === Number(o.negociacaoId));
    return indicada ? { negociacao: indicada, nova: false } : null;
  }
  const doImovel = o.imovelId ? abertas.filter((n) => Number(n.imovel_id) === Number(o.imovelId)) : abertas;
  if (doImovel.length === 1) return { negociacao: doImovel[0], nova: false };
  if (doImovel.length > 1) return null;
  // Nenhuma em andamento: o negócio de compra em aberto do cliente, com imóvel (o daquela reação).
  const [negocios, etapas] = await Promise.all([
    trx.varrerTudo('negocios', { filtros: { conta_id: conta, contato_id: contatoId, pipeline: 'compra' }, maximo: 100 }),
    trx.varrerTudo('etapas_funil', { filtros: { conta_id: conta, pipeline: 'compra' }, maximo: 200 }),
  ]);
  const abertasEtapas = new Set(etapas.filter((e) => e.tipo === 'aberta').map((e) => Number(e.id)));
  const candidatos = negocios.filter(
    (n) => abertasEtapas.has(Number(n.etapa_id)) && n.imovel_id && (!o.imovelId || Number(n.imovel_id) === Number(o.imovelId)),
  );
  if (candidatos.length !== 1) return null;
  const negocio = candidatos[0];
  const conducao = await conducaoNova(ctx.shell as Request['shell'], conta, config);
  // `tentativas: 1`: dentro do `comConta` a violação de único sobe e o listener repete o bloco inteiro.
  const r = await criarNegociacao(trx, { negocio, imovelId: Number(negocio.imovel_id), conducao, atribuidaPor: null, conta, tentativas: 1 });
  if ('existente' in r) return { negociacao: r.existente, nova: false };
  if (!('negociacao' in r)) return null;
  await tarefaDoCorretor(trx, conta, contatoId, o.contato.responsavel_id ?? negocio.responsavel_id, tituloMandato(r.negociacao.codigo));
  return { negociacao: r.negociacao, nova: true };
}

/** Evento (só ids) e aviso ao negociador humano da negociação aberta no listener, depois do commit. */
export async function depoisDeEntrarNoListener(ctx: ContextoListener, conta: number, entrada: Entrada | null) {
  if (!entrada?.nova) return;
  const n = entrada.negociacao;
  try {
    await ctx.eventos.publicar('negociacao_iniciada', semSigilo({ negociacao_id: Number(n.id), negocio_id: Number(n.negocio_id) }), { conta_id: conta });
  } catch (e) {
    console.warn(`[portal_corretor] evento negociacao_iniciada não publicado: ${(e as Error).message}`);
  }
  if (n.conduzida_por === 'humano' && n.negociador_usuario_id) await avisarNegociador(ctx.notificacoes as Request['notificacoes'], Number(n.negociador_usuario_id), n);
}

/** O meio do motor no listener (SISTEMA): a escrita na conta, por `comConta`, e o evento com a conta. */
export async function meioDoListener(ctx: ContextoListener, conta: number, responsavel: number | null): Promise<MeioMotor> {
  // Quem assina no prompt: o nome da página do corretor, ou o da conta (sem usuário no listener).
  const [pagina, perfilConta] = await Promise.all([
    ctx.dados!.varrerTudo('paginas_corretor', { filtros: { conta_id: conta, chave: 'conta' }, maximo: 1 }),
    ctx.dados!.varrerTudo('perfil_conta', { filtros: { conta_id: conta, chave: 'conta' }, maximo: 1 }),
  ]);
  const nome = String(pagina[0]?.nome_exibicao || perfilConta[0]?.nome || '');
  return {
    conta,
    emLeitura: (fn) => ctx.dados!.comConta!(conta, fn),
    emTransacao: (fn) => ctx.dados!.comConta!(conta, fn),
    ia: ctx.ia,
    hoje: new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }),
    usuario: { id: responsavel, nome },
    publicar: async (tipo, payload) => {
      try {
        await ctx.eventos.publicar(tipo, semSigilo(payload), { conta_id: conta });
      } catch (e) {
        console.warn(`[portal_corretor] evento ${tipo} não publicado: ${(e as Error).message}`);
      }
    },
  };
}

/** Janela em que a mesma mensagem, entregue de novo, não faz o motor rodar outra vez. */
const JANELA_REPETIDA_MS = 10 * 60_000;

/** A marca da mensagem na negociação: o hash do texto, nunca o texto (que já está na linha do tempo). */
const marcaDaMensagem = (mensagem: string) => createHash('sha256').update(mensagem).digest('hex');

/**
 * O motor roda sobre a mensagem com fala de preço? Só com o Negociador IA conduzindo, mandato vigente e
 * sem a mesma mensagem nos últimos minutos (evento entregue de novo). Dentro da transação do listener,
 * com a negociação TRAVADA: quem decide rodar grava a marca da mensagem na própria negociação antes do
 * commit, e uma entrega simultânea da mesma mensagem espera a trava e lê a marca já gravada. A execução
 * do motor só é gravada depois do commit, por isso ela sozinha não bastava como guarda (ela continua
 * valendo para a mensagem que já rodou antes da marca existir).
 */
export async function motorNaMensagem(trx: HelperDados, conta: number, negociacao: Linha, mensagem: string): Promise<boolean> {
  const viva = await trx.buscar('negociacoes', Number(negociacao.id), { travar: true });
  if (!viva || Number(viva.conta_id ?? conta) !== conta) return false;
  if (viva.conduzida_por !== 'ia' || encerrada(viva)) return false;
  if (viva.estado === 'aguardando_proprietario' || viva.estado === 'pausada') return false;
  const mandato = await mandatoVigente(trx, viva);
  const hoje = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  if (!mandato || String(mandato.validade).slice(0, 10) < hoje) return false;
  const desde = Date.now() - JANELA_REPETIDA_MS;
  const marca = marcaDaMensagem(mensagem);
  if (viva.motor_mensagem_hash === marca && viva.motor_mensagem_em && new Date(viva.motor_mensagem_em).getTime() >= desde) return false;
  const recentes = await trx.varrerTudo('negociador_execucoes', { filtros: { conta_id: conta, negociacao_id: Number(viva.id) }, ordenar: 'id', ordem: 'desc', maximo: 20 });
  if (recentes.some((e) => e.mensagem_cliente === mensagem && new Date(e.criado_em).getTime() >= desde)) return false;
  await trx.atualizar('negociacoes', Number(viva.id), { motor_mensagem_hash: marca, motor_mensagem_em: new Date().toISOString() });
  return true;
}

/**
 * Roda o motor sobre a mensagem do cliente, depois do commit (a chamada de IA fica fora da transação).
 * Se o motor não chegou a decidir (IA indisponível, falha da IA ou erro), a marca gravada por
 * `motorNaMensagem` é desfeita: a mesma mensagem entregue de novo nos próximos minutos roda outra vez,
 * em vez de ficar sem resposta até a janela passar. Só desfaz a marca DESTA mensagem: se outra
 * mensagem já a trocou, nada muda.
 */
export async function rodarMotorNaMensagem(ctx: ContextoListener, conta: number, negociacaoId: number, responsavel: number | null, mensagem: string) {
  let decidiu = false;
  try {
    const r = await executarMotor(await meioDoListener(ctx, conta, responsavel), negociacaoId, { mensagem_cliente: mensagem, canal: 'portal' });
    decidiu = !('falha_ia' in r) && !('ia_indisponivel' in r);
    if (!decidiu) console.warn(`[portal_corretor] Negociador sem IA na mensagem do portal (negociação ${negociacaoId}); a marca foi desfeita`);
  } catch (e) {
    console.warn(`[portal_corretor] Negociador não rodou na mensagem do portal (negociação ${negociacaoId}): ${(e as Error).message}`);
  }
  if (!decidiu) await desfazerMarca(ctx, conta, negociacaoId, mensagem);
}

/** Tira a marca da mensagem da negociação, sob a trava, só se ela ainda é a desta mensagem. */
async function desfazerMarca(ctx: ContextoListener, conta: number, negociacaoId: number, mensagem: string) {
  try {
    await ctx.dados!.comConta!(conta, async (trx) => {
      const viva = await trx.buscar('negociacoes', negociacaoId, { travar: true });
      if (!viva || Number(viva.conta_id ?? conta) !== conta || viva.motor_mensagem_hash !== marcaDaMensagem(mensagem)) return;
      await trx.atualizar('negociacoes', negociacaoId, { motor_mensagem_hash: null, motor_mensagem_em: null });
    });
  } catch (e) {
    console.warn(`[portal_corretor] marca da mensagem não desfeita (negociação ${negociacaoId}): ${(e as Error).message}`);
  }
}
