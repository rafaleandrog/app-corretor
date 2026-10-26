import '@urbiverso/sdk/express';
import { Router, type Request } from 'express';
import type { ContextoListener, HelperDados } from '@urbiverso/sdk';
import { CANAIS_ABORDAGEM, iso, ordenarFila, TEMPERATURAS, type TipoFila } from '../comum/funil';
import { assincrono, erro, guardarCorretor, primeiro } from './acesso';
import { etapasDaConta, registrar } from './crm';
import { limiteParado } from '../comum/crm';
import { etapasPorId, playbookDaConta, proximaAbordagem, reclassificar } from './inteligencia';
import { numerosDaSemana } from './numeros';

// Funil (bloco 4): quadro por etapa, playbook de abordagens, fila do dia do Início e a rotina que
// esfria quem ficou sem contato. Tudo segregado por conta pelo `req.dados`.
export const funilRotas: Router = Router();
guardarCorretor(funilRotas, ['/funil', '/inicio', '/abordagens']);

type Linha = Record<string, any>;
const DIA = 86400e3;
const id = (v: unknown) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};
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
    const negocios = await dados.varrerTudo('negocios', { filtros: { pipeline }, maximo: 5000 });
    // Ganhos e perdidos saem do quadro depois de 30 dias; abertos ficam sempre.
    const corte = new Date(Date.now() - 30 * DIA).toISOString();
    const visiveis = negocios.filter((n) => {
      const e = etapas.get(n.etapa_id);
      if (!e) return false;
      return e.tipo === 'aberta' || (iso(n.etapa_desde) ?? '') >= corte;
    });
    const contatos = visiveis.length
      ? await dados.varrerTudo('contatos', { filtros: { id: [...new Set(visiveis.map((n) => n.contato_id))].join(',') }, maximo: 5000 })
      : [];
    const porContato = new Map(contatos.map((c) => [c.id, c]));
    const playbook = await playbookDaConta(dados, etapas);
    const temperatura = typeof req.query.temperatura === 'string' && (TEMPERATURAS as readonly string[]).includes(req.query.temperatura) ? req.query.temperatura : null;
    const parado = limiteParado(req.query.parado_dias);
    const cartoes = visiveis
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
        };
      })
      .filter((k) => (!temperatura || k.temperatura === temperatura) && (!parado || (iso(k.ultimo_contato_em) ?? '') < parado));
    res.json({ pipeline, etapas: daqui, negocios: cartoes });
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
  contato_id: number;
  contato_nome: string;
  temperatura: string | null;
  quando: string | null;
  texto: string;
  atividade_id?: number;
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
  // Um contato aparece uma vez, no motivo mais urgente.
  const vistos = new Set<number>();
  const fila = ordenarFila(itens).filter((i) => (vistos.has(i.contato_id) ? false : (vistos.add(i.contato_id), true)));
  return fila;
}

funilRotas.get(
  '/inicio',
  assincrono(async (req: Request, res) => {
    const dados = req.dados!;
    const fuso = req.contexto?.fuso || 'America/Sao_Paulo';
    const fila = await filaDoDia(dados, fuso);
    // A faixa da semana é complementar: se o cálculo falhar, a fila do dia continua de pé.
    const semana = await numerosDaSemana(dados).catch(() => null);
    // A demonstração só se oferece em conta de teste ainda sem nenhum contato.
    const perfil = await primeiro(dados, 'perfil_conta', { chave: 'conta' });
    const demo_disponivel = !!perfil?.demo && !(await dados.listar('contatos', { por_pagina: 1 })).total;
    res.json({ fila, total: fila.length, semana, demo_disponivel });
  }),
);

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
