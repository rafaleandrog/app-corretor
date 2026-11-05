import '@urbiverso/sdk/express';
import { Router } from 'express';
import type { HelperDados } from '@urbiverso/sdk';
import { periodos } from '../comum/numeros';
import { calcularKpisNegociacao, DECISOES_ENVIADAS, type NegociacaoNum } from '../comum/numeros-negociacao';
import { iso } from '../comum/funil';
import { assincrono, guardarCorretor } from './acesso';

// Relatório Negociação de Números (D6, spec 11.1 P10 e 11.2). Só o corretor da conta (o negociador
// humano recebe 403, como no resto de Números), só agregados, lidos pelo `req.dados` (segregado pela
// conta). O mandato é lido aqui só para o preço pedido e o recuo, que entram na conta e não saem.
export const numerosNegociacaoRotas: Router = Router();
guardarCorretor(numerosNegociacaoRotas, ['/numeros/negociacao']);

/** Mandatos por id, em lotes (o filtro por lista de ids tem teto de linhas por chamada). */
async function mandatosPorId(dados: HelperDados, ids: number[]) {
  const mapa = new Map<number, { preco_pedido_c: number | null; recuo_c: number | null }>();
  for (let i = 0; i < ids.length; i += 100) {
    const lote = ids.slice(i, i + 100);
    const linhas = await dados.varrerTudo('mandatos_negociacao', { filtros: { id: lote.join(',') }, maximo: lote.length });
    for (const m of linhas) mapa.set(Number(m.id), { preco_pedido_c: m.preco_pedido_c ?? null, recuo_c: m.recuo_c ?? null });
  }
  return mapa;
}

numerosNegociacaoRotas.get(
  '/numeros/negociacao',
  assincrono(async (req, res) => {
    const dias = [7, 30, 90, 365].includes(Number(req.query.dias)) ? Number(req.query.dias) : 30;
    const dados = req.dados!;
    const p = periodos(dias);
    const desde = p.anterior.de;
    const [negociacoes, propostas, objecoes, execucoes] = await Promise.all([
      dados.varrerTudo('negociacoes', { filtros: { estado: 'ganha,perdida', 'encerrada_em[gte]': desde }, maximo: 20000 }),
      dados.varrerTudo('propostas', { filtros: { direcao: 'comprador', 'criado_em[gte]': desde }, maximo: 50000 }),
      dados.varrerTudo('objecoes_detectadas', { filtros: { 'em[gte]': desde }, maximo: 50000 }),
      dados.varrerTudo('negociador_execucoes', { filtros: { decisao: DECISOES_ENVIADAS.join(','), 'decidida_em[gte]': desde }, maximo: 50000 }),
    ]);
    const ids = [...new Set(negociacoes.filter((n) => n.estado === 'ganha' && n.mandato_id).map((n) => Number(n.mandato_id)))];
    const mandatos = await mandatosPorId(dados, ids);
    const linhas: NegociacaoNum[] = negociacoes.map((n) => {
      const m = n.mandato_id ? mandatos.get(Number(n.mandato_id)) : undefined;
      return {
        estado: n.estado,
        encerrada_em: n.encerrada_em ?? null,
        valor_final_c: n.valor_final_c ?? null,
        rodadas: n.rodadas ?? null,
        teto_estimado_comprador_c: n.teto_estimado_comprador_c ?? null,
        preco_pedido_c: m?.preco_pedido_c ?? null,
        recuo_c: m?.recuo_c ?? null,
      };
    });
    const entrada = {
      negociacoes: linhas,
      propostas: propostas.map((x) => ({ direcao: x.direcao, criado_em: iso(x.criado_em) })),
      objecoes: objecoes.map((x) => ({ categoria: x.categoria, em: iso(x.em) })),
      execucoes: execucoes.map((x) => ({ decisao: x.decisao, aprovada_sem_edicao: x.aprovada_sem_edicao ?? null, decidida_em: iso(x.decidida_em) })),
    };
    res.json({
      dias,
      periodo: p.atual,
      atual: calcularKpisNegociacao(entrada, p.atual.de, p.atual.ate),
      anterior: calcularKpisNegociacao(entrada, p.anterior.de, p.anterior.ate),
    });
  }),
);
