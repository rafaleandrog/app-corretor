import '@urbiverso/sdk/express';
import { Router, type Request } from 'express';
import type { ContextoListener, HelperDados } from '@urbiverso/sdk';
import { CANAIS_ABORDAGEM, iso, ordenarFila, taxasDePassagem, TEMPERATURAS, ultimoSinal, type TipoFila } from '../comum/funil';
import { assincrono, erro, guardarCorretor, id, primeiro } from './acesso';
import { etapasDaConta, registrar } from './crm';
import { payloadDaMensagem, registrarMensagem } from './conversas';
import { limiteParado } from '../comum/crm';
import { etapasPorId, playbookDaConta, proximaAbordagem, reclassificar } from './inteligencia';
import { numerosDaSemana } from './numeros';
import { contaDoRequest, paginaDaConta } from './vitrine';
import { dicaDoAssistente, primeirosPassos } from '../comum/hoje';
import { validarAcao } from '../comum/assistente';
import { encerrada } from './negociacao';
import type { NegocioNum } from '../comum/numeros';
import { semSigilo } from '../comum/negociacao';

// Funil (bloco 4): quadro por etapa, playbook de abordagens, fila do dia do Início e a rotina que
// esfria quem ficou sem contato. Tudo segregado por conta pelo `req.dados`.
export const funilRotas: Router = Router();
guardarCorretor(funilRotas, ['/funil', '/inicio', '/abordagens']);

type Linha = Record<string, any>;
const DIA = 86400e3;
const agora = () => new Date().toISOString();
const ROTULO_CANAL: Record<string, string> = { whatsapp: 'WhatsApp', ligacao: 'ligação', email: 'e-mail', visita: 'visita' };

/** Início e fim do dia no fuso da conta, como instantes ISO. */
function limitesDoDia(fuso: string, deslocamentoDias = 0) {
  const ref = new Date(Date.now() + deslocamentoDias * DIA);
  const dia = ref.toLocaleDateString('sv-SE', { timeZone: fuso });
  // Diferença entre o fuso e UTC naquele dia (ex.: -180 min em Brasília).
  const meioDia = new Date(`${dia}T12:00:00Z`);
  const local = new Date(meioDia.toLocaleString('en-US', { timeZone: fuso }));
  const offset = local.getTime() - new Date(meioDia.toLocaleString('en-US', { timeZone: 'UTC' })).getTime();
  const inicio = new Date(new Date(`${dia}T00:00:00Z`).getTime() - offset);
  return { dia, inicio: inicio.toISOString(), fim: new Date(inicio.getTime() + DIA).toISOString() };
}

// ---------- Quadro ----------

funilRotas.get(
  '/funil/quadro',
  assincrono(async (req, res) => {
    const pipeline = req.query.pipeline === 'venda_captacao' ? 'venda_captacao' : 'compra';
    const dados = req.dados!;
    await etapasDaConta(dados); // semeia na primeira vez
    const etapas = await etapasPorId(dados);
    const daqui = [...etapas.values()].filter((e) => e.pipeline === pipeline && e.ativa).sort((a, b) => a.ordem - b.ordem);
    // Os dois funis: as contagens da coluna da esquerda (P03) contam os negócios abertos de cada um.
    // Contagem pelo `total` do listar (uma linha lida), sem varrer: não cria teto novo para a rota.
    const aberto = (n: Linha) => etapas.get(n.etapa_id)?.tipo === 'aberta';
    const idsAbertas = [...etapas.values()].filter((e) => e.tipo === 'aberta').map((e) => e.id);
    const abertosDo = async (p: string) => {
      if (!idsAbertas.length) return 0; // filtro vazio seria descartado e contaria tudo
      return (await dados.listar('negocios', { filtros: { pipeline: p, etapa_id: idsAbertas.join(',') }, por_pagina: 1 })).total;
    };
    const [compra, venda_captacao] = await Promise.all([abertosDo('compra'), abertosDo('venda_captacao')]);
    const funis = { compra, venda_captacao };
    // Só o funil escolhido é varrido, com o teto de 5000 por funil.
    const doFunil = await dados.varrerTudo('negocios', { filtros: { pipeline }, maximo: 5000 });
    // Ganhos e perdidos saem do quadro depois de 30 dias; abertos ficam sempre.
    const corte = new Date(Date.now() - 30 * DIA).toISOString();
    const visiveis = doFunil.filter((n) => {
      const e = etapas.get(n.etapa_id);
      if (!e || n.pipeline !== pipeline) return false;
      return e.tipo === 'aberta' || (iso(n.etapa_desde) ?? '') >= corte;
    });
    const contatos = visiveis.length
      ? await dados.varrerTudo('contatos', { filtros: { id: [...new Set(visiveis.map((n) => n.contato_id))].join(',') }, maximo: 5000 })
      : [];
    const porContato = new Map(contatos.map((c) => [c.id, c]));
    const playbook = await playbookDaConta(dados, etapas);
    // Último sinal de cada cliente do quadro (P03): o item mais recente da linha do tempo e o último
    // clique num envio. Uma leitura por tabela, pelo `listar` (teto obedecido, sem lançar), da mais recente
    // para a mais antiga: a primeira linha de cada contato é a que vale.
    const idsContatos = [...porContato.keys()];
    const [linhas, enviosAbertos] = idsContatos.length
      ? await Promise.all([
          dados.listar('linha_do_tempo', { filtros: { contato_id: idsContatos.join(',') }, ordenar: 'ocorrido_em', ordem: 'desc', por_pagina: 1000 }),
          dados.listar('envios', { filtros: { contato_id: idsContatos.join(','), 'primeiro_clique_em[nulo]': 'false' }, ordenar: 'primeiro_clique_em', ordem: 'desc', por_pagina: 1000 }),
        ])
      : [{ dados: [] as Linha[] }, { dados: [] as Linha[] }];
    const ultimaLinha = new Map<number, Linha>();
    for (const l of linhas.dados as Linha[]) if (!ultimaLinha.has(Number(l.contato_id))) ultimaLinha.set(Number(l.contato_id), l);
    const ultimoEnvio = new Map<number, Linha>();
    for (const e of enviosAbertos.dados as Linha[]) if (!ultimoEnvio.has(Number(e.contato_id))) ultimoEnvio.set(Number(e.contato_id), e);
    // Contagem por temperatura: clientes (uma vez cada) com negócio aberto neste funil, antes dos filtros.
    const temperaturas = { quente: 0, morno: 0, frio: 0 };
    for (const cid of new Set(visiveis.filter(aberto).map((n) => n.contato_id))) {
      const t = porContato.get(cid)?.temperatura as keyof typeof temperaturas | undefined;
      if (t && t in temperaturas) temperaturas[t]++;
    }
    // Taxa de passagem entre etapas vizinhas, sobre os negócios do quadro (sem os filtros).
    const passagem = taxasDePassagem(daqui as { id: number; nome: string; tipo: string; marco?: string | null }[], visiveis.map((n) => ({ ...n, pipeline }) as unknown as NegocioNum));
    // Filtros: temperatura, "parado há" e os dos filtros prontos (os mesmos parâmetros de GET /contatos).
    const temperatura = typeof req.query.temperatura === 'string' && (TEMPERATURAS as readonly string[]).includes(req.query.temperatura) ? req.query.temperatura : null;
    const parado = limiteParado(req.query.parado_dias);
    const desde = iso(req.query['criado_em[gte]']);
    const retorno = iso(req.query['proximo_passo_em[lt]']);
    const cartoes = visiveis
      .filter((n) => {
        const c = porContato.get(n.contato_id) ?? {};
        return (!desde || (iso(c.criado_em) ?? '') >= desde) && (!retorno || (!!iso(c.proximo_passo_em) && iso(c.proximo_passo_em)! < retorno));
      })
      .map((n) => {
        const c = porContato.get(n.contato_id) ?? {};
        const abordagem = etapas.get(n.etapa_id)?.tipo === 'aberta' ? proximaAbordagem(c, [n], etapas, playbook) : null;
        return {
          id: n.id,
          etapa_id: n.etapa_id,
          titulo: n.titulo,
          valor_estimado_c: n.valor_estimado_c ?? null,
          contato_id: n.contato_id,
          contato_nome: c.nome ?? n.contato_nome ?? '',
          temperatura: c.temperatura ?? null,
          temperatura_motivo: c.temperatura_motivo ?? null,
          ultimo_contato_em: c.ultimo_contato_em ?? null,
          etapa_desde: n.etapa_desde ?? null,
          abordagem_vencida: !!abordagem?.vencida,
          abordagem: abordagem?.abordagem ?? null,
          ultimo_sinal: ultimoSinal(ultimaLinha.get(Number(n.contato_id)), ultimoEnvio.get(Number(n.contato_id))),
        };
      })
      .filter((k) => (!temperatura || k.temperatura === temperatura) && (!parado || (iso(k.ultimo_contato_em) ?? '') < parado));
    res.json({ pipeline, etapas: daqui, negocios: cartoes, funis, temperaturas, passagem });
  }),
);

// ---------- Playbook (Ajustes › Funil e abordagens) ----------

funilRotas.get(
  '/funil/playbook',
  assincrono(async (req, res) => {
    const dados = req.dados!;
    await etapasDaConta(dados);
    const etapas = await etapasPorId(dados);
    const playbook = await playbookDaConta(dados, etapas);
    const linhas = playbook
      .map((p) => ({ ...p, etapa_nome: etapas.get(p.etapa_id)?.nome ?? '', pipeline: etapas.get(p.etapa_id)?.pipeline, ordem: etapas.get(p.etapa_id)?.ordem ?? 0, ativa: !!etapas.get(p.etapa_id)?.ativa }))
      .filter((p) => p.ativa)
      .sort((a, b) => a.ordem - b.ordem || TEMPERATURAS.indexOf((b as Linha).temperatura) - TEMPERATURAS.indexOf((a as Linha).temperatura));
    // Etapas em andamento sem abordagem (criadas pelo corretor): a tela oferece cadastrar.
    const semAbordagem = [...etapas.values()].filter((e) => e.ativa && e.tipo === 'aberta' && !playbook.some((p) => p.etapa_id === e.id));
    res.json({ abordagens: linhas, etapas_sem_abordagem: semAbordagem });
  }),
);

function validarAbordagem(corpo: Record<string, unknown>) {
  const erros: string[] = [];
  const abordagem = typeof corpo.abordagem === 'string' ? corpo.abordagem.trim().slice(0, 300) : '';
  if (!abordagem) erros.push('Descreva a abordagem.');
  const canal = (CANAIS_ABORDAGEM as readonly string[]).includes(corpo.canal_sugerido as string) ? (corpo.canal_sugerido as string) : null;
  if (!canal) erros.push('Canal inválido.');
  const prazo = Number(corpo.prazo_horas);
  if (!Number.isInteger(prazo) || prazo < 1 || prazo > 720) erros.push('Prazo: de 1 a 720 horas.');
  return { erros, dados: { abordagem, canal_sugerido: canal, prazo_horas: prazo } };
}

funilRotas.put(
  '/funil/playbook/:id',
  assincrono(async (req, res) => {
    const pid = id(req.params.id);
    const dados = req.dados!;
    if (!pid || !(await dados.buscar('playbook_funil', pid))) return erro(res, 404, 'NAO_ENCONTRADO', 'Abordagem não encontrada.');
    const v = validarAbordagem(req.body ?? {});
    if (v.erros.length) return erro(res, 422, 'DADOS_INVALIDOS', 'Confira a abordagem.', v.erros);
    res.json(await dados.atualizar('playbook_funil', pid, v.dados));
  }),
);

funilRotas.post(
  '/funil/playbook',
  assincrono(async (req, res) => {
    const dados = req.dados!;
    const eid = id(req.body?.etapa_id);
    const etapa = eid ? await dados.buscar('etapas_funil', eid) : null;
    if (!etapa || etapa.tipo !== 'aberta') return erro(res, 422, 'DADOS_INVALIDOS', 'Escolha uma etapa em andamento.');
    const temperatura = (TEMPERATURAS as readonly string[]).includes(req.body?.temperatura) ? req.body.temperatura : null;
    if (!temperatura) return erro(res, 422, 'DADOS_INVALIDOS', 'Temperatura inválida.');
    const v = validarAbordagem(req.body ?? {});
    if (v.erros.length) return erro(res, 422, 'DADOS_INVALIDOS', 'Confira a abordagem.', v.erros);
    try {
      res.status(201).json(await dados.criar('playbook_funil', { ...v.dados, etapa_id: eid, temperatura }));
    } catch (e) {
      if ((e as { code?: string })?.code === '23505') return erro(res, 409, 'JA_EXISTE', 'Já existe abordagem para esta etapa e temperatura.');
      throw e;
    }
  }),
);

// ---------- Abordagem do contato: fazer agora ou pular ----------

funilRotas.post(
  '/abordagens/:contato/feita',
  assincrono(async (req, res) => {
    const cid = id(req.params.contato);
    const dados = req.dados!;
    const contato = cid ? await dados.buscar('contatos', cid) : null;
    if (!contato) return erro(res, 404, 'NAO_ENCONTRADO', 'Contato não encontrado.');
    const texto = typeof req.body?.texto === 'string' ? req.body.texto.trim().slice(0, 1000) : '';
    // "Fazer agora" da ficha manda o canal; uma linha só na linha do tempo (não passa por /envios).
    const canal = (CANAIS_ABORDAGEM as readonly string[]).includes(req.body?.canal) ? (req.body.canal as string) : null;
    await registrar(dados, req, {
      tipo: 'abordagem.feita', alvo_tipo: 'contato', alvo_id: cid!, contato_id: cid!,
      resumo: `Abordagem${canal ? ` por ${ROTULO_CANAL[canal]}` : ''}: ${texto || 'feita'}`,
      ...(canal ? { dados: { canal } } : {}),
    });
    // Com texto e canal, a abordagem entra na conversa do cliente (P02, D-116) como mensagem de saída.
    if (texto && canal) {
      const r = await registrarMensagem(dados, { contato_id: cid!, direcao: 'saida', autor_tipo: 'humano', autor_id: req.contexto!.usuario.id, canal: canal === 'whatsapp' ? 'wa_me' : 'registro', tipo: 'texto', conteudo: texto });
      try {
        await req.eventos?.publicar('mensagem_enviada', payloadDaMensagem(r));
      } catch (e) {
        console.warn('[portal_corretor] evento mensagem_enviada não publicado:', (e as Error).message);
      }
    }
    await dados.atualizar('contatos', cid!, { ultimo_contato_em: agora(), abordagem_adiada_em: null });
    await reclassificar(dados, cid!);
    res.status(201).json({ ok: true });
  }),
);

funilRotas.post(
  '/abordagens/:contato/adiar',
  assincrono(async (req, res) => {
    const cid = id(req.params.contato);
    const dados = req.dados!;
    if (!cid || !(await dados.buscar('contatos', cid))) return erro(res, 404, 'NAO_ENCONTRADO', 'Contato não encontrado.');
    // Pular: o prazo da abordagem recomeça a contar de agora.
    await dados.atualizar('contatos', cid, { abordagem_adiada_em: agora() });
    res.json({ ok: true });
  }),
);

// ---------- Início: fila do dia ----------

export interface ItemFila {
  tipo: TipoFila;
  /** Nulo nos itens sem cliente (peça aguardando, autorização a vencer). */
  contato_id: number | null;
  contato_nome: string;
  temperatura: string | null;
  quando: string | null;
  texto: string;
  atividade_id?: number;
  negociacao_id?: number;
  peca_id?: number;
  imovel_id?: number;
}

/** Fila do dia da Inteligência do Funil (spec 11.1): um item por contato, no motivo mais urgente. */
export async function filaDoDia(dados: HelperDados, fuso: string): Promise<ItemFila[]> {
  const ag = agora();
  const hoje = limitesDoDia(fuso);
  const amanha = limitesDoDia(fuso, 1);
  await etapasDaConta(dados);
  const etapas = await etapasPorId(dados);
  const [quentes, negocios, visitas, passos, playbook] = await Promise.all([
    dados.listar('contatos', { filtros: { temperatura: 'quente', 'ultimo_contato_em[lt]': new Date(Date.now() - DIA).toISOString() }, ordenar: 'ultimo_contato_em', ordem: 'asc', por_pagina: 50 }),
    dados.varrerTudo('negocios', { maximo: 5000 }),
    dados.listar('atividades', { filtros: { tipo: 'visita', status: 'pendente', 'quando[gte]': hoje.inicio, 'quando[lt]': amanha.fim }, ordenar: 'quando', ordem: 'asc', por_pagina: 100 }),
    dados.listar('contatos', { filtros: { 'proximo_passo_em[lt]': ag }, ordenar: 'proximo_passo_em', ordem: 'asc', por_pagina: 50 }),
    playbookDaConta(dados, etapas),
  ]);
  const abertos = negocios.filter((n) => etapas.get(n.etapa_id)?.tipo === 'aberta');
  // Contatos dos negócios abertos e das visitas, numa leitura (nome e temperatura vêm daqui).
  const idsContato = [...new Set([...abertos.map((n) => n.contato_id), ...visitas.dados.map((v) => v.contato_id).filter(Boolean)])];
  const contatos = idsContato.length ? await dados.varrerTudo('contatos', { filtros: { id: idsContato.join(',') }, maximo: 5000 }) : [];
  const itens: ItemFila[] = [];
  for (const c of quentes.dados) {
    itens.push({ tipo: 'quente_sem_resposta', contato_id: c.id, contato_nome: c.nome, temperatura: c.temperatura, quando: c.ultimo_contato_em, texto: c.temperatura_motivo ?? 'Quente e sem contato há mais de um dia' });
  }
  const porId = new Map(contatos.map((c) => [c.id, c]));
  for (const c of contatos) {
    const a = proximaAbordagem(c, abertos.filter((n) => n.contato_id === c.id), etapas, playbook);
    if (a?.vencida) itens.push({ tipo: 'abordagem_vencida', contato_id: c.id, contato_nome: c.nome, temperatura: c.temperatura ?? null, quando: a.vence_em, texto: a.abordagem });
  }
  for (const v of visitas.dados) {
    if (!v.contato_id) continue;
    itens.push({
      tipo: 'visita', contato_id: v.contato_id, contato_nome: porId.get(v.contato_id)?.nome ?? v.contato_nome ?? '', temperatura: porId.get(v.contato_id)?.temperatura ?? null, quando: v.quando,
      texto: `${(iso(v.quando) ?? '') < hoje.fim ? 'Hoje' : 'Amanhã'}: ${v.titulo}${v.local ? ` · ${v.local}` : ''}`, atividade_id: v.id,
    });
  }
  for (const c of passos.dados) {
    itens.push({ tipo: 'proximo_passo', contato_id: c.id, contato_nome: c.nome, temperatura: c.temperatura ?? null, quando: c.proximo_passo_em, texto: c.proximo_passo ?? 'Próximo passo combinado' });
  }
  itens.push(...(await propostasRecebidas(dados, porId)), ...(await pecasAguardando(dados, fuso)), ...(await autorizacoesVencendo(dados, fuso)));
  // "Agora não" (`POST /abordagens/:contato/adiar`) tira o contato da fila pelo resto do dia, no fuso da
  // conta, em todo motivo com contato; amanhã ele volta. "Fiz" (`/feita`) zera a marca. Peça e
  // autorização não têm contato e não são afetadas.
  const adiados = new Set(
    (await dados.varrerTudo('contatos', { filtros: { 'abordagem_adiada_em[gte]': hoje.inicio, 'abordagem_adiada_em[lt]': hoje.fim }, maximo: 5000 })).map((c) => Number(c.id)),
  );
  // Um contato aparece uma vez, no motivo mais urgente; os itens sem cliente (peça, autorização) ficam todos.
  const vistos = new Set<number>();
  const fila = ordenarFila(itens.filter((i) => i.contato_id === null || !adiados.has(Number(i.contato_id)))).filter((i) => (i.contato_id === null ? true : vistos.has(i.contato_id) ? false : (vistos.add(i.contato_id), true)));
  return fila;
}

/**
 * Propostas do comprador esperando resposta (P01): a última proposta da negociação é do comprador e
 * ainda não foi respondida nem aceita. A negociação que já espera o corretor (`aguardando_corretor`)
 * está em "Precisa de você", não aqui; a pausada, encerrada ou com o acordo no proprietário, nem lá.
 */
async function propostasRecebidas(dados: HelperDados, contatos: Map<number, Linha>): Promise<ItemFila[]> {
  const r = await dados.listar('negociacoes', { filtros: { estado: 'ativa,aguardando_cliente' }, ordenar: 'atualizado_em', ordem: 'desc', por_pagina: 50 });
  const vivas = (r.dados as Linha[]).filter((n) => !encerrada(n));
  if (!vivas.length) return [];
  const propostas = await dados.listar('propostas', { filtros: { negociacao_id: vivas.map((n) => n.id).join(',') }, ordenar: 'id', ordem: 'desc', por_pagina: 1000 });
  const ultima = new Map<number, Linha>();
  for (const p of propostas.dados as Linha[]) if (!ultima.has(Number(p.negociacao_id))) ultima.set(Number(p.negociacao_id), p);
  const faltam = vivas.map((n) => n.contato_id).filter((cid) => cid && !contatos.has(Number(cid)));
  if (faltam.length) for (const c of await dados.varrerTudo('contatos', { filtros: { id: [...new Set(faltam)].join(',') }, maximo: 100 })) contatos.set(Number(c.id), c);
  const itens: ItemFila[] = [];
  for (const n of vivas) {
    const p = ultima.get(Number(n.id));
    if (!p || p.direcao !== 'comprador' || !['registrada', 'enviada'].includes(String(p.estado))) continue;
    const c = contatos.get(Number(n.contato_id));
    itens.push({
      tipo: 'proposta_recebida', contato_id: n.contato_id ?? null, contato_nome: c?.nome ?? 'Cliente', temperatura: c?.temperatura ?? null, quando: iso(p.criado_em),
      texto: `Ofereceu ${reaisPt(Number(p.valor_c))}${n.codigo ? ` (${n.codigo})` : ''}: responda ou registre a contraproposta`, negociacao_id: Number(n.id),
    });
  }
  return itens;
}

const reaisPt = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

/** Peças do Estúdio aprovadas e ainda sem agendamento (P01): aprovar sem agendar é o que mais some da vista. */
async function pecasAguardando(dados: HelperDados, fuso: string): Promise<ItemFila[]> {
  const r = await dados.listar('pecas', { filtros: { estado: 'aprovada', 'agendada_para[nulo]': 'true' }, ordenar: 'aprovada_em', ordem: 'asc', por_pagina: 20 });
  return (r.dados as Linha[]).map((p) => ({
    tipo: 'peca_aguardando', contato_id: null, contato_nome: String(p.titulo ?? `Peça ${p.id}`), temperatura: null, quando: iso(p.aprovada_em),
    texto: `Aprovada${p.aprovada_em ? ` em ${new Date(iso(p.aprovada_em)!).toLocaleDateString('pt-BR', { timeZone: fuso })}` : ''} e sem data para publicar`, peca_id: Number(p.id), imovel_id: p.imovel_id ? Number(p.imovel_id) : undefined,
  }));
}

/**
 * Autorizações de venda assinadas que vencem nos próximos 30 dias, o 30º incluído (P01): a mesma largura
 * de janela da rotina `autorizacao_vencendo` (`fim` de hoje até antes de hoje + 31). A rotina conta os
 * dias em `America/Sao_Paulo` fixo e a fila no fuso da conta; numa conta de outro fuso, perto da
 * meia-noite, as duas janelas podem diferir de um dia.
 */
async function autorizacoesVencendo(dados: HelperDados, fuso: string): Promise<ItemFila[]> {
  const hoje = new Date().toLocaleDateString('sv-SE', { timeZone: fuso });
  const limite = new Date(Date.now() + 31 * DIA).toLocaleDateString('sv-SE', { timeZone: fuso });
  const r = await dados.listar('autorizacoes_venda', { filtros: { situacao: 'assinada', 'fim[gte]': hoje, 'fim[lt]': limite }, ordenar: 'fim', ordem: 'asc', por_pagina: 20 });
  if (!r.dados.length) return [];
  const imoveis = await dados.varrerTudo('imoveis', { filtros: { id: [...new Set((r.dados as Linha[]).map((a) => a.imovel_id))].join(',') }, maximo: 100 });
  const codigo = new Map(imoveis.map((i) => [Number(i.id), String(i.codigo)]));
  return (r.dados as Linha[]).map((a) => {
    const fim = String(a.fim instanceof Date ? a.fim.toISOString() : a.fim).slice(0, 10);
    return {
      tipo: 'prazo_autorizacao', contato_id: null, contato_nome: `${codigo.get(Number(a.imovel_id)) ?? 'Imóvel'} · autorização AV-${a.id}`, temperatura: null, quando: `${fim}T12:00:00.000Z`,
      texto: `A autorização de venda vence em ${fim.split('-').reverse().join('/')}: renove com o proprietário`, imovel_id: Number(a.imovel_id),
    };
  });
}

/**
 * "Precisa de você" (P01): negociações que pararam esperando o corretor. Só o que a tela mostra sai
 * daqui, e ainda por `semSigilo` (recuo, alvo e BATNA nunca chegam a Hoje).
 */
async function passagens(dados: HelperDados) {
  const r = await dados.listar('negociacoes', { filtros: { estado: 'aguardando_corretor' }, ordenar: 'atualizado_em', ordem: 'asc', por_pagina: 20 });
  const ids = [...new Set(r.dados.map((n) => n.contato_id).filter(Boolean))];
  const [contatos, conversas, propostas] = await Promise.all([
    ids.length ? dados.varrerTudo('contatos', { filtros: { id: ids.join(',') }, maximo: 100 }) : [],
    // A conversa do cliente que o Negociador atende: Assumir abre a P02 já assumida (spec 11.1 P01).
    ids.length ? dados.varrerTudo('conversas', { filtros: { contato_id: ids.join(','), atendido_por: 'agente' }, maximo: 100 }) : [],
    r.dados.length ? dados.listar('propostas', { filtros: { negociacao_id: r.dados.map((n) => n.id).join(',') }, ordenar: 'id', ordem: 'desc', por_pagina: 500 }) : { dados: [] as Linha[] },
  ]);
  const nome = new Map(contatos.map((c) => [c.id, c.nome]));
  const conversa = new Map(conversas.map((c) => [Number(c.contato_id), Number(c.id)]));
  const ultima = new Map<number, Linha>();
  for (const p of propostas.dados as Linha[]) if (!ultima.has(Number(p.negociacao_id))) ultima.set(Number(p.negociacao_id), p);
  return semSigilo(
    r.dados.map((n) => {
      const p = ultima.get(Number(n.id));
      const motivo = n.conduzida_por === 'ia'
        ? `O Negociador passou a você${p?.direcao === 'comprador' ? `: oferta de ${reaisPt(Number(p.valor_c))}` : ''}`
        : p?.direcao === 'comprador' ? `Oferta de ${reaisPt(Number(p.valor_c))} esperando a sua resposta` : 'A negociação espera a sua decisão';
      return {
        negociacao_id: n.id,
        codigo: n.codigo ?? null,
        contato_id: n.contato_id ?? null,
        contato_nome: (n.contato_id && nome.get(n.contato_id)) || 'Cliente',
        conversa_id: (n.contato_id && conversa.get(Number(n.contato_id))) || null,
        motivo,
      };
    }),
  );
}

/** Agenda de hoje (P01, direita): atividades pendentes do dia, na ordem do horário. */
async function agendaDeHoje(dados: HelperDados, fuso: string) {
  const hoje = limitesDoDia(fuso);
  const r = await dados.listar('atividades', {
    filtros: { status: 'pendente', 'quando[gte]': hoje.inicio, 'quando[lt]': hoje.fim },
    ordenar: 'quando',
    ordem: 'asc',
    por_pagina: 20,
  });
  return r.dados.map((a) => ({ id: a.id, tipo: a.tipo, titulo: a.titulo, quando: a.quando, contato_id: a.contato_id ?? null, contato_nome: a.contato_nome ?? null }));
}

/**
 * Primeiros passos e CRECI (P01, esquerda), da conta de escrita e do próprio usuário — a mesma regra
 * do editor da página e do Estúdio. O CRECI não é passo (D-93): volta só `sem_creci`, para o aviso.
 */
async function estadoDaConta(req: Request) {
  const dados = req.dados!;
  const conta = contaDoRequest(req);
  const [perfil, eu, instagram, imoveis, pagina] = await Promise.all([
    primeiro(dados, 'perfil_conta', { chave: 'conta', conta_id: conta }),
    primeiro(dados, 'perfis_corretor', { usuario_id: req.contexto!.usuario.id, conta_id: conta }),
    primeiro(dados, 'canais_sociais', { conta_id: conta, rede: 'instagram', 'desconectado_em[nulo]': 'true' }),
    dados.listar('imoveis', { filtros: { conta_id: conta }, por_pagina: 1 }),
    paginaDaConta(dados, conta),
  ]);
  return {
    perfil,
    primeiros_passos: primeirosPassos({
      conta: !!perfil?.nome,
      telefone: !!eu?.telefone,
      instagram: !!instagram,
      imovel: imoveis.total > 0,
      pagina: !!pagina?.publicada_em,
    }),
    sem_creci: !eu?.creci && !perfil?.creci_juridico,
  };
}

funilRotas.get(
  '/inicio',
  assincrono(async (req: Request, res) => {
    const dados = req.dados!;
    const fuso = req.contexto?.fuso || 'America/Sao_Paulo';
    const [fila, conta, precisa, agenda_hoje] = await Promise.all([filaDoDia(dados, fuso), estadoDaConta(req), passagens(dados), agendaDeHoje(dados, fuso)]);
    // A faixa da semana é complementar: se o cálculo falhar, a fila do dia continua de pé.
    const semana = await numerosDaSemana(dados).catch(() => null);
    // A demonstração só se oferece em conta de teste ainda sem nenhum contato.
    const demo_disponivel = !!conta.perfil?.demo && !(await dados.listar('contatos', { por_pagina: 1 })).total;
    res.json({
      fila,
      total: fila.length,
      passagens: precisa,
      agenda_hoje,
      primeiros_passos: conta.primeiros_passos,
      sem_creci: conta.sem_creci,
      semana,
      demo_disponivel,
      dica: dicaValidada(fila, conta.primeiros_passos, fuso),
    });
  }),
);

/**
 * Dica do Assistente com a ação já conferida (P01): a regra pura propõe; `validarAcao` (a mesma do
 * Assistente) só deixa passar contato da fila, peça aprovada e horário dentro da janela, e escreve o
 * resumo que o corretor confirma. A tela executa a ação confirmada pela rota de sempre.
 */
function dicaValidada(fila: ItemFila[], passos: ReturnType<typeof primeirosPassos>, fuso: string) {
  const agora = new Date();
  const { texto, acao } = dicaDoAssistente(fila, passos, agora, fuso);
  const contatos = new Map<number, string>(fila.filter((i) => i.contato_id).map((i) => [i.contato_id!, i.contato_nome]));
  const pecas = new Map<number, { titulo: string; estado: string }>(fila.filter((i) => i.peca_id).map((i) => [i.peca_id!, { titulo: i.contato_nome, estado: 'aprovada' }]));
  return { texto, acao: acao ? validarAcao(acao, { contatos, pecas, agora, fuso }) : null };
}

// ---------- Rotina diária ----------

/**
 * Esfria quem ficou mais de 7 dias sem contato (10.4). Idempotente: só grava quando a temperatura
 * muda. Em SISTEMA a leitura enxerga todas as contas; a escrita vai por conta (`comConta`).
 */
export async function reclassificarContatos(ctx: ContextoListener) {
  if (!ctx.dados?.comConta) return { ok: true, resultado: { resumo: 'sem dados' } };
  const limite = new Date(Date.now() - 7 * DIA).toISOString();
  const candidatos = await ctx.dados.varrerTudo('contatos', { filtros: { temperatura: 'quente,morno', 'ultimo_contato_em[lt]': limite }, maximo: 50000 });
  // Só contas ativas, enumeradas pelo ctx (comConta valida e recusa a inativa); uma conta que falha
  // não impede as outras, e a falha aparece no resultado.
  const ativas = new Set((ctx.contas ? await ctx.contas.listarAtivas() : []).map((c) => c.id));
  const porConta = new Map<number, number[]>();
  for (const c of candidatos) if (ativas.has(c.conta_id)) porConta.set(c.conta_id, [...(porConta.get(c.conta_id) ?? []), c.id]);
  let trocados = 0;
  const falhas: string[] = [];
  for (const [conta, ids] of porConta) {
    try {
      await ctx.dados.comConta(conta, async (trx) => {
        for (const cid of ids) {
          const antes = await trx.buscar('contatos', cid);
          const nova = await reclassificar(trx, cid);
          if (nova && antes?.temperatura !== (await trx.buscar('contatos', cid))?.temperatura) trocados++;
        }
      });
    } catch (e) {
      falhas.push(`conta ${conta}: ${(e as Error).message}`);
    }
  }
  return {
    ok: falhas.length === 0,
    resultado: { resumo: `${trocados} contato(s) esfriaram${falhas.length ? `; ${falhas.length} conta(s) com falha` : ''}`, analisados: candidatos.length, trocados, falhas },
    ...(falhas.length ? { erro: falhas.join('; ') } : {}),
  };
}
