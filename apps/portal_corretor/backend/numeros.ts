import '@urbiverso/sdk/express';
import { Router } from 'express';
import type { HelperDados } from '@urbiverso/sdk';
import { iso, MARCO_PADRAO } from '../comum/funil';
import { calcularKpis, chegou, leadsPorHora, melhoresOrigens, oQueMelhorar, periodos, previsaoPonderada, serieDeLeads, type NegocioNum } from '../comum/numeros';
import { CANAIS, ROTULO_MOTIVO_PERDA } from '../comum/crm';
import { assincrono, guardarCorretor } from './acesso';
import { etapasPorId } from './inteligencia';

// Números do corretor (bloco 4b, spec 11.2): KPIs do período com comparação ao período anterior
// e a faixa da semana do Início. Só agregados da própria conta, lidos pelo `req.dados`.
export const numerosRotas: Router = Router();
guardarCorretor(numerosRotas, ['/numeros']);

const DIA = 86400e3;

/** Negócios da conta no formato do cálculo, com a origem e a etapa atual resolvidas. */
export async function negociosParaNumeros(dados: HelperDados): Promise<NegocioNum[]> {
  const [negocios, etapas, origens] = await Promise.all([
    dados.varrerTudo('negocios', { maximo: 20000 }),
    etapasPorId(dados),
    dados.varrerTudo('origens', { maximo: 5000 }),
  ]);
  const canal = new Map(origens.map((o) => [o.id, o.canal]));
  return negocios.map((n) => {
    const e = etapas.get(n.etapa_id);
    return {
      pipeline: n.pipeline,
      criado_em: n.criado_em,
      ganho_em: n.ganho_em ?? null,
      perdido_em: n.perdido_em ?? null,
      // Negócio anterior ao marco_max: o marco da etapa atual é o mínimo que ele alcançou.
      marco_max: n.marco_max ?? (e ? (e.marco ?? MARCO_PADRAO[e.nome] ?? null) : null),
      motivo_perda: n.motivo_perda ?? null,
      valor_estimado_c: n.valor_estimado_c ?? null,
      comissao_pct: n.comissao_pct ?? null,
      contato_id: n.contato_id ?? null,
      origem_canal: n.origem_id ? (canal.get(n.origem_id) ?? null) : null,
      probabilidade: e?.probabilidade ?? 0,
      aberto: e?.tipo === 'aberta',
    };
  });
}

numerosRotas.get(
  '/numeros',
  assincrono(async (req, res) => {
    const dias = [7, 30, 90, 365].includes(Number(req.query.dias)) ? Number(req.query.dias) : 30;
    const dados = req.dados!;
    const todos = await negociosParaNumeros(dados);
    // Filtro "Todas as origens" (P10): um canal do catálogo restringe os negócios; fora dele, ignorado.
    const canal = typeof req.query.origem === 'string' && (CANAIS as readonly string[]).includes(req.query.origem) ? req.query.origem : null;
    const negocios = canal ? todos.filter((n) => n.origem_canal === canal) : todos;
    const p = periodos(dias);
    const [visitas, pecas] = await Promise.all([
      dados.varrerTudo('atividades', { filtros: { tipo: 'visita', status: 'feita', 'quando[gte]': p.anterior.de, 'quando[lt]': p.atual.ate }, maximo: 50000 }),
      dados.varrerTudo('pecas', { filtros: { estado: 'publicada', 'publicada_em[gte]': p.anterior.de, 'publicada_em[lt]': p.atual.ate }, maximo: 20000 }),
    ]);
    const conta = (linhas: Record<string, any>[], coluna: string, de: string, ate: string) => linhas.filter((a) => {
      const q = iso(a[coluna]);
      return !!q && q >= de && q < ate;
    }).length;
    const atual = calcularKpis(negocios, p.atual.de, p.atual.ate);
    const anterior = calcularKpis(negocios, p.anterior.de, p.anterior.ate);
    const melhoria = oQueMelhorar(negocios, atual, p.atual.de, p.atual.ate, (m) => ROTULO_MOTIVO_PERDA[m] ?? m);
    res.json({
      dias,
      origem: canal,
      // Canais que tiveram leads nos dois períodos, para o filtro de origem (sempre de todos os negócios).
      origens_disponiveis: [...new Set(todos.filter((n) => n.pipeline === 'compra' && (iso(n.criado_em) ?? '') >= p.anterior.de).map((n) => n.origem_canal ?? 'nao_informada'))],
      periodo: p.atual,
      // Visitas feitas não têm origem: com filtro de canal, ficam de fora (null) em vez de contar todas.
      atual: { ...atual, visitas: canal ? null : conta(visitas, 'quando', p.atual.de, p.atual.ate) },
      anterior: { ...anterior, visitas: canal ? null : conta(visitas, 'quando', p.anterior.de, p.anterior.ate) },
      previsao: previsaoPonderada(negocios),
      serie_leads: serieDeLeads(negocios, dias),
      por_hora: leadsPorHora(negocios, p.atual.de, p.atual.ate, req.contexto?.fuso),
      melhores_origens: melhoresOrigens(atual.por_origem),
      // "Ver os N clientes" abre Clientes com os perdidos por este motivo desde o início do período.
      o_que_melhorar: { ...melhoria, perdido_desde: p.atual.de },
      // Peças do Estúdio publicadas (relatório Conteúdo); alcance e leads por peça ainda não têm fonte.
      conteudo: { publicadas: conta(pecas, 'publicada_em', p.atual.de, p.atual.ate), publicadas_anterior: conta(pecas, 'publicada_em', p.anterior.de, p.anterior.ate) },
      // Ainda sem fonte nesta versão (chegam com o WhatsApp, o Estúdio e as metas): a tela explica.
      indisponiveis: ['tempo_primeiro_atendimento', 'custo_por_lead', 'comissao_recebida', 'conteudo_alcance', 'agentes', 'metas'],
    });
  }),
);

/**
 * Faixa da semana do Início (11.1, D-68): novos contatos, leads, quantos deles chegaram ao atendimento,
 * visitas feitas e comissão prevista.
 */
export async function numerosDaSemana(dados: HelperDados) {
  const de = new Date(Date.now() - 7 * DIA).toISOString();
  const [contatos, visitas, negocios] = await Promise.all([
    dados.listar('contatos', { filtros: { 'criado_em[gte]': de }, por_pagina: 1 }),
    dados.listar('atividades', { filtros: { tipo: 'visita', status: 'feita', 'quando[gte]': de }, por_pagina: 1 }),
    negociosParaNumeros(dados),
  ]);
  const leads = negocios.filter((n) => n.pipeline === 'compra' && (iso(n.criado_em) ?? '') >= de);
  return {
    novos_contatos: contatos.total,
    visitas: visitas.total,
    leads: leads.length,
    atendidos: leads.filter((n) => chegou(n, 'atendimento')).length,
    previsao_c: previsaoPonderada(negocios).valor_c,
  };
}
