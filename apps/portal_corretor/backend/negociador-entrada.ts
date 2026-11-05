import '@urbiverso/sdk/express';
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
export const ehEtapaProposta = (etapa: Linha | null | undefined) =>
  !!etapa && etapa.pipeline === 'compra' && (etapa.marco ?? MARCO_PADRAO[etapa.nome] ?? null) === 'proposta';

/**
 * Gatilho `etapa_proposta`, na rota que muda a etapa do negócio. Com a caixa marcada, o Negociador
 * ligado, o negócio de compra com imóvel e sem negociação em andamento, a negociação nasce. Devolve o
 * que a tela precisa para avisar o corretor (código e quem conduz), ou `null`. Nunca derruba a mudança
 * de etapa: falha aqui fica no log e o corretor abre a negociação à mão, como antes.
 */
export async function entrarPelaEtapaProposta(req: Request, negocio: Linha, etapa: Linha | null) {
  try {
    if (!ehEtapaProposta(etapa) || negocio.pipeline !== 'compra' || !negocio.imovel_id) return null;
    const dados = req.dados!;
    const config = await configDaConta(dados);
    if (!gatilhoLigado(config, 'etapa_proposta')) return null;
    const conducao = await conducaoNova(req.shell, contaDoRequest(req), config);
    const r = await criarNegociacao(dados, { negocio, imovelId: Number(negocio.imovel_id), conducao, atribuidaPor: req.contexto?.usuario.id ?? null, tentativas: 5 });
    if (!('negociacao' in r)) return null;
    await depoisDeCriar(req, r.negociacao);
    await tarefaDoCorretor(dados, undefined, Number(negocio.contato_id), negocio.responsavel_id, tituloMandato(r.negociacao.codigo));
    return { negociacao_id: Number(r.negociacao.id), codigo: String(r.negociacao.codigo), conduzida_por: String(r.negociacao.conduzida_por) };
  } catch (e) {
    console.warn(`[portal_corretor] Negociador não entrou pela etapa Proposta (negócio ${negocio.id}): ${(e as Error).message}`);
    return null;
  }
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

/**
 * O motor roda sobre a mensagem com fala de preço? Só com o Negociador IA conduzindo, mandato vigente e
 * sem execução da mesma mensagem nos últimos minutos (evento entregue de novo). Lido dentro da transação.
 */
export async function motorNaMensagem(trx: HelperDados, conta: number, negociacao: Linha, mensagem: string): Promise<boolean> {
  if (negociacao.conduzida_por !== 'ia' || encerrada(negociacao)) return false;
  if (negociacao.estado === 'aguardando_proprietario' || negociacao.estado === 'pausada') return false;
  const mandato = await mandatoVigente(trx, negociacao);
  const hoje = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  if (!mandato || String(mandato.validade).slice(0, 10) < hoje) return false;
  const desde = Date.now() - JANELA_REPETIDA_MS;
  const recentes = await trx.varrerTudo('negociador_execucoes', { filtros: { conta_id: conta, negociacao_id: Number(negociacao.id) }, ordenar: 'id', ordem: 'desc', maximo: 20 });
  return !recentes.some((e) => e.mensagem_cliente === mensagem && new Date(e.criado_em).getTime() >= desde);
}

/** Roda o motor sobre a mensagem do cliente, depois do commit (a chamada de IA fica fora da transação). */
export async function rodarMotorNaMensagem(ctx: ContextoListener, conta: number, negociacaoId: number, responsavel: number | null, mensagem: string) {
  try {
    await executarMotor(await meioDoListener(ctx, conta, responsavel), negociacaoId, { mensagem_cliente: mensagem, canal: 'portal' });
  } catch (e) {
    console.warn(`[portal_corretor] Negociador não rodou na mensagem do portal (negociação ${negociacaoId}): ${(e as Error).message}`);
  }
}
