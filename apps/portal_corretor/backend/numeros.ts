import '@urbiverso/sdk/express';
import { Router } from 'express';
import type { HelperDados } from '@urbiverso/sdk';
import { iso, MARCO_PADRAO } from '../comum/funil';
import { calcularKpis, periodos, previsaoPonderada, type NegocioNum } from '../comum/numeros';
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
    const negocios = await negociosParaNumeros(dados);
    const p = periodos(dias);
    const visitas = await dados.varrerTudo('atividades', { filtros: { tipo: 'visita', status: 'feita', 'quando[gte]': p.anterior.de, 'quando[lt]': p.atual.ate }, maximo: 50000 });
    const contaVisitas = (de: string, ate: string) => visitas.filter((a) => {
      const q = iso(a.quando);
      return !!q && q >= de && q < ate;
    }).length;
    res.json({
      dias,
      periodo: p.atual,
      atual: { ...calcularKpis(negocios, p.atual.de, p.atual.ate), visitas: contaVisitas(p.atual.de, p.atual.ate) },
      anterior: { ...calcularKpis(negocios, p.anterior.de, p.anterior.ate), visitas: contaVisitas(p.anterior.de, p.anterior.ate) },
      previsao: previsaoPonderada(negocios),
      // Ainda sem fonte nesta versão (chegam com o WhatsApp, o Estúdio e as metas): a tela explica.
      indisponiveis: ['tempo_primeiro_atendimento', 'custo_por_lead', 'comissao_recebida', 'conteudo', 'agentes', 'metas'],
    });
  }),
);

/** Faixa da semana do Início (11.1, D-68): novos contatos, leads, visitas feitas e comissão prevista. */
export async function numerosDaSemana(dados: HelperDados) {
  const de = new Date(Date.now() - 7 * DIA).toISOString();
  const [contatos, visitas, negocios] = await Promise.all([
    dados.listar('contatos', { filtros: { 'criado_em[gte]': de }, por_pagina: 1 }),
    dados.listar('atividades', { filtros: { tipo: 'visita', status: 'feita', 'quando[gte]': de }, por_pagina: 1 }),
    negociosParaNumeros(dados),
  ]);
  return {
    novos_contatos: contatos.total,
    visitas: visitas.total,
    leads: negocios.filter((n) => n.pipeline === 'compra' && (iso(n.criado_em) ?? '') >= de).length,
    previsao_c: previsaoPonderada(negocios).valor_c,
  };
}
