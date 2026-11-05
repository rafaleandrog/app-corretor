import '@urbiverso/sdk/express';
import { Router } from 'express';
import type { HelperDados } from '@urbiverso/sdk';
import { assincrono, erro, guardarCorretor } from './acesso';
import { semSigilo } from '../comum/negociacao';
import { normalizarTermo, BUSCA_MAX, BUSCA_MIN, POR_TIPO } from '../comum/busca';

// Busca global (spec 11.7, item B10): clientes, imóveis e negociações da conta ativa, até 5 de cada.
// Só `req.dados`, montado depois do `escopoDeConta` (rotas.ts): quem atende várias contas busca só na
// ativa, e o RLS isola as demais. Área do corretor (`guardarCorretor`): o negociador humano não busca
// na carteira, que não é dele. A resposta é uma lista FECHADA de campos por tipo, nunca a linha
// inteira: da negociação não sai nenhum valor (nem o sigiloso do mandato, nem estimativas), e o
// `semSigilo()` passa por cima de tudo como segunda trava.

export const buscaRotas: Router = Router();
guardarCorretor(buscaRotas, ['/busca']);

type Linha = Record<string, any>;

/** Ids de quem casou com o termo, para achar as negociações deles (mais que os 5 que aparecem). */
const ALCANCE_NEGOCIACAO = 50;

const clienteDe = (c: Linha) => ({ id: Number(c.id), nome: String(c.nome ?? ''), telefone: c.telefone ?? null, email: c.email ?? null });
const imovelDe = (i: Linha) => ({
  id: Number(i.id),
  codigo: String(i.codigo ?? ''),
  titulo: i.titulo ?? null,
  bairro: i.bairro ?? null,
  situacao: i.situacao ?? null,
});

/** Instante como texto ISO, para ordenar (`datahora` chega como `Date`). */
const quando = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v ?? ''));

async function porIds(dados: HelperDados, tabela: string, ids: number[]): Promise<Linha[]> {
  if (!ids.length) return [];
  return dados.varrerTudo(tabela, { filtros: { id: ids.join(',') }, maximo: ids.length });
}

buscaRotas.get(
  '/busca',
  assincrono(async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (q.length < BUSCA_MIN) return erro(res, 422, 'BUSCA_CURTA', `Digite pelo menos ${BUSCA_MIN} letras para buscar.`);
    if (q.length > BUSCA_MAX) return erro(res, 422, 'BUSCA_LONGA', `A busca aceita até ${BUSCA_MAX} caracteres.`);
    const dados = req.dados!;
    const { termo, telefone } = normalizarTermo(q);

    // Clientes: nome, telefone e e-mail; anonimizado (LGPD) não volta. Imóveis: título, código e bairro.
    const [contatos, imoveis, porCodigo] = await Promise.all([
      dados.listar('contatos', {
        filtros: { 'anonimizado_em[nulo]': 'true' },
        busca_ou: { colunas: telefone ? ['telefone'] : ['nome', 'email', 'telefone'], termo },
        ordenar: 'nome',
        ordem: 'asc',
        por_pagina: ALCANCE_NEGOCIACAO,
      }),
      dados.listar('imoveis', { busca_ou: { colunas: ['titulo', 'codigo', 'bairro'], termo }, ordenar: 'atualizado_em', ordem: 'desc', por_pagina: ALCANCE_NEGOCIACAO }),
      dados.listar('negociacoes', { busca_ou: { colunas: ['codigo'], termo }, ordenar: 'atualizado_em', ordem: 'desc', por_pagina: POR_TIPO }),
    ]);

    // Negociações: pelo código, ou do cliente ou do imóvel que casou.
    const idsContato = contatos.dados.map((c) => Number(c.id));
    const idsImovel = imoveis.dados.map((i) => Number(i.id));
    const [doContato, doImovel] = await Promise.all([
      idsContato.length
        ? dados.listar('negociacoes', { filtros: { contato_id: idsContato.join(',') }, ordenar: 'atualizado_em', ordem: 'desc', por_pagina: POR_TIPO })
        : { dados: [] as Linha[] },
      idsImovel.length
        ? dados.listar('negociacoes', { filtros: { imovel_id: idsImovel.join(',') }, ordenar: 'atualizado_em', ordem: 'desc', por_pagina: POR_TIPO })
        : { dados: [] as Linha[] },
    ]);
    const vistas = new Map<number, Linha>();
    for (const n of [...porCodigo.dados, ...doContato.dados, ...doImovel.dados]) if (!vistas.has(Number(n.id))) vistas.set(Number(n.id), n);
    const negociacoes = [...vistas.values()]
      .sort((a, b) => quando(b.atualizado_em).localeCompare(quando(a.atualizado_em)))
      .slice(0, POR_TIPO);

    // Nome do cliente e título do imóvel de cada negociação (os que não vieram na busca, por id).
    const nomes = new Map(contatos.dados.map((c) => [Number(c.id), c]));
    const titulos = new Map(imoveis.dados.map((i) => [Number(i.id), i]));
    const faltaContato = [...new Set(negociacoes.map((n) => Number(n.contato_id)).filter((id) => id && !nomes.has(id)))];
    const faltaImovel = [...new Set(negociacoes.map((n) => Number(n.imovel_id)).filter((id) => id && !titulos.has(id)))];
    const [maisContatos, maisImoveis] = await Promise.all([porIds(dados, 'contatos', faltaContato), porIds(dados, 'imoveis', faltaImovel)]);
    for (const c of maisContatos) nomes.set(Number(c.id), c);
    for (const i of maisImoveis) titulos.set(Number(i.id), i);

    res.json(
      semSigilo({
        q,
        clientes: contatos.dados.slice(0, POR_TIPO).map(clienteDe),
        imoveis: imoveis.dados.slice(0, POR_TIPO).map(imovelDe),
        negociacoes: negociacoes.map((n) => {
          const c = nomes.get(Number(n.contato_id));
          const i = titulos.get(Number(n.imovel_id));
          return {
            id: Number(n.id),
            codigo: String(n.codigo ?? ''),
            estado: n.estado ?? null,
            contato_id: n.contato_id ? Number(n.contato_id) : null,
            contato_nome: c && !c.anonimizado_em ? String(c.nome ?? '') : null,
            imovel_id: n.imovel_id ? Number(n.imovel_id) : null,
            imovel_codigo: i ? String(i.codigo ?? '') : null,
            imovel_titulo: i ? (i.titulo ?? null) : null,
          };
        }),
      }),
    );
  }),
);
