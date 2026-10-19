import '@urbiverso/sdk/express';
import { Router } from 'express';
import { MARCO_PADRAO } from '../comum/funil';
import { proximoCodigo } from '../comum/imoveis';
import { assincrono, erro, guardarCorretor, primeiro } from './acesso';
import { etapasDaConta } from './crm';
import { reclassificar } from './inteligencia';

// Dados de demonstração (spec 12.2, bloco 4b): só nas contas de teste "(demo)" e só quando a conta
// ainda não tem contato. O corretor de teste gera pelo Início; o responsável é ele mesmo (a semente
// do boot não tem usuário para isso). Os números esperados estão em docs/desempenho.md.
export const demoRotas: Router = Router();
guardarCorretor(demoRotas, ['/demo']);

interface Pessoa {
  nome: string;
  telefone: string;
  canal: string;
  pipeline: 'compra' | 'venda_captacao';
  etapa: string;
  valor: number;
  comissao: number | null;
  marco_max?: string;
  perda?: string;
}

/** O conjunto fixo: os KPIs dele são conferidos à mão (docs/desempenho.md). */
export const PESSOAS: Pessoa[] = [
  { nome: 'Ana Demo', telefone: '+5561990000001', canal: 'instagram', pipeline: 'compra', etapa: 'Novo', valor: 300000, comissao: 0.05 },
  { nome: 'Bruno Demo', telefone: '+5561990000002', canal: 'whatsapp', pipeline: 'compra', etapa: 'Em atendimento', valor: 500000, comissao: 0.05 },
  { nome: 'Carla Demo', telefone: '+5561990000003', canal: 'indicacao', pipeline: 'compra', etapa: 'Qualificado', valor: 400000, comissao: 0.05 },
  { nome: 'Diego Demo', telefone: '+5561990000004', canal: 'portal', pipeline: 'compra', etapa: 'Visitou', valor: 700000, comissao: 0.05 },
  { nome: 'Elisa Demo', telefone: '+5561990000005', canal: 'indicacao', pipeline: 'compra', etapa: 'Proposta', valor: 900000, comissao: 0.05 },
  { nome: 'Fábio Demo', telefone: '+5561990000006', canal: 'indicacao', pipeline: 'compra', etapa: 'Ganho', valor: 650000, comissao: 0.05, marco_max: 'documentacao' },
  { nome: 'Gabi Demo', telefone: '+5561990000007', canal: 'instagram', pipeline: 'compra', etapa: 'Ganho', valor: 420000, comissao: 0.05, marco_max: 'proposta' },
  { nome: 'Hugo Demo', telefone: '+5561990000008', canal: 'portal', pipeline: 'compra', etapa: 'Perdido', valor: 350000, comissao: 0.05, marco_max: 'visitou', perda: 'preco' },
  { nome: 'Iara Demo', telefone: '+5561990000009', canal: 'indicacao', pipeline: 'venda_captacao', etapa: 'Autorização assinada', valor: 1200000, comissao: 0.05 },
  { nome: 'João Demo', telefone: '+5561990000010', canal: 'placa', pipeline: 'venda_captacao', etapa: 'Avaliação', valor: 800000, comissao: 0.05 },
];

demoRotas.post(
  '/demo/semear',
  assincrono(async (req, res) => {
    const dados = req.dados!;
    const perfil = await primeiro(dados, 'perfil_conta', { chave: 'conta' });
    if (!perfil?.demo) return erro(res, 403, 'SO_DEMO', 'Dados de demonstração só existem nas contas de teste.');
    const algum = await dados.listar('contatos', { por_pagina: 1 });
    if (algum.total) return erro(res, 409, 'JA_TEM_DADOS', 'Esta conta já tem contatos: a demonstração só entra numa conta vazia.');
    const eu = req.contexto!.usuario.id;
    const etapas = await etapasDaConta(dados);
    const etapa = (pipeline: string, nome: string) => etapas.find((e) => e.pipeline === pipeline && e.nome === nome);
    const faltando = PESSOAS.find((p) => !etapa(p.pipeline, p.etapa));
    if (faltando) return erro(res, 422, 'ETAPAS_ALTERADAS', `A etapa "${faltando.etapa}" não existe: restaure as etapas padrão em Ajustes › Funil.`);
    // Origens e códigos de imóvel já existentes são reaproveitados ou pulados (são únicos na conta).
    const [origensExistentes, imoveisExistentes] = await Promise.all([
      dados.varrerTudo('origens', { maximo: 5000 }),
      dados.listar('imoveis', { filtros: { 'codigo[busca]': 'IM-' }, ordenar: 'id', ordem: 'desc', por_pagina: 200 }),
    ]);
    const codigos = imoveisExistentes.dados.map((i) => String(i.codigo));
    const codigoCasa = proximoCodigo(codigos);
    const codigoApto = proximoCodigo([...codigos, codigoCasa]);
    const agora = Date.now();
    const quando = (dias: number) => new Date(agora + dias * 86400e3).toISOString();
    const criados: number[] = [];
    try {
      await dados.transaction(async (trx) => {
        const origens = new Map<string, number>();
        for (const canal of [...new Set(PESSOAS.map((p) => p.canal))]) {
          const existente = origensExistentes.find((o) => o.canal === canal && !o.campanha);
          origens.set(canal, existente ? existente.id : (await trx.criar('origens', { canal, campanha: null })).id);
        }
        const casa = await trx.criar('imoveis', { codigo: codigoCasa, titulo: 'Casa térrea com jardim', tipo: 'casa', finalidade: 'venda', situacao: 'captacao', cidade: 'Brasília', bairro: 'Lago Sul', uf: 'DF', preco_c: 180000000, area_total_m2: 800, quartos: 4, banheiros: 3, endereco_publico: 'bairro', publicado_pagina: false, compartilhado_rede: 'nao' });
        const apto = await trx.criar('imoveis', { codigo: codigoApto, titulo: 'Apartamento 3 quartos', tipo: 'apartamento', finalidade: 'venda', situacao: 'rascunho', cidade: 'Brasília', bairro: 'Asa Sul', uf: 'DF', preco_c: 95000000, area_util_m2: 110, quartos: 3, banheiros: 2, endereco_publico: 'bairro', publicado_pagina: false, compartilhado_rede: 'nao' });
        for (const p of PESSOAS) {
          const e = etapa(p.pipeline, p.etapa)!;
          const c = await trx.criar('contatos', {
            nome: p.nome, telefone: p.telefone, papeis: p.pipeline === 'compra' ? 'comprador' : 'proprietario',
            responsavel_id: eu, origem_id: origens.get(p.canal), ultimo_contato_em: quando(-1),
          });
          criados.push(c.id);
          await trx.criar('negocios', {
            contato_id: c.id, titulo: `${p.pipeline === 'compra' ? 'Compra' : 'Venda'} — ${p.nome}`, pipeline: p.pipeline,
            etapa_id: e.id, etapa_desde: quando(-1), valor_estimado_c: p.valor * 100, comissao_pct: p.comissao,
            responsavel_id: eu, origem_id: origens.get(p.canal), marco_max: p.marco_max ?? e.marco ?? MARCO_PADRAO[e.nome] ?? null,
            ganho_em: e.tipo === 'ganha' ? quando(0) : null, perdido_em: e.tipo === 'perdida' ? quando(0) : null,
            motivo_perda: p.perda ?? null, imovel_id: p.nome.startsWith('Diego') ? apto.id : p.nome.startsWith('Iara') ? casa.id : null,
          });
        }
        // Uma visita feita com retorno e uma marcada para amanhã.
        const diego = criados[3];
        const carla = criados[2];
        const feita = await trx.criar('atividades', { tipo: 'visita', titulo: 'Visita ao apartamento da Asa Sul', contato_id: diego, responsavel_id: eu, quando: quando(-2), status: 'feita' });
        await trx.criar('visitas', { atividade_id: feita.id, imovel_id: apto.id, feedback_nota: 4, feedback_texto: 'Gostou da planta; achou o condomínio alto', compartilhar_com_proprietario: true, feedback_em: quando(-2) });
        const marcada = await trx.criar('atividades', { tipo: 'visita', titulo: 'Visita à casa do Lago Sul', contato_id: carla, responsavel_id: eu, quando: quando(1), status: 'pendente' });
        await trx.criar('visitas', { atividade_id: marcada.id, imovel_id: casa.id });
      });
    } catch (err) {
      // Dois cliques ao mesmo tempo (ou um telefone de demonstração já usado): nada fica gravado.
      if ((err as { code?: string })?.code === '23505') return erro(res, 409, 'JA_TEM_DADOS', 'Esta conta já tem dados que conflitam com a demonstração.');
      throw err;
    }
    // A temperatura é um extra: se falhar, a rotina diária recalcula; a demonstração já está gravada.
    for (const cid of criados) await reclassificar(dados, cid).catch(() => null);
    res.status(201).json({ contatos: criados.length, negocios: PESSOAS.length, imoveis: 2 });
  }),
);
