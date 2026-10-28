import '@urbiverso/sdk/express';
import { Router } from 'express';
import { MARCO_PADRAO } from '../comum/funil';
import { proximoCodigo } from '../comum/imoveis';
import { proximoCodigoNegociacao } from '../comum/negociacao';
import { assincrono, erro, guardarCorretor, primeiro } from './acesso';
import { etapasDaConta } from './crm';
import { reclassificar } from './inteligencia';

// Dados de demonstração (spec 12.2; guia das telas, specs/telas_padrao_b.md §5): só nas contas de
// teste "(demo)" e só quando a conta ainda não tem contato. O corretor de teste gera pelo Hoje; o
// responsável é ele mesmo (a semente do boot não tem usuário para isso). A conta "principal" (a de
// menor id entre as de teste, marcada no boot) recebe o conjunto do guia; as outras, o conjunto
// menor do segundo corretor, para o roteiro de isolamento (spec 4.5). Os números esperados estão em
// docs/desempenho.md.
export const demoRotas: Router = Router();
guardarCorretor(demoRotas, ['/demo']);

type Canal = 'instagram' | 'whatsapp' | 'pagina' | 'indicacao' | 'portal' | 'placa';

interface Pessoa {
  nome: string;
  telefone: string;
  canal: Canal;
  etapa: string;
  valor: number;
  /** Dias desde o último contato (a temperatura sai da regra, não é gravada à mão). */
  ultimo_contato_dias: number;
  /** Chave do imóvel do conjunto que o negócio trata. */
  imovel?: string;
  observacoes?: string;
}

interface Imovel {
  chave: string;
  titulo: string;
  tipo: 'casa' | 'apartamento' | 'lote';
  situacao: 'ativo' | 'rascunho';
  bairro: string;
  preco: number;
  area?: number;
  quartos?: number;
  banheiros?: number;
  vagas?: number;
  descricao?: string;
}

interface Conjunto {
  creci: string;
  pessoas: Pessoa[];
  imoveis: Imovel[];
}

const DESCRICAO_CASA =
  'Casa térrea de 4 quartos, sendo 2 suítes, num lote arborizado do Jardim Botânico. Sala ampla com pé-direito duplo integrada à varanda gourmet, ' +
  'cozinha planejada com ilha, escritório e área de serviço independente. Piscina aquecida, jardim com irrigação automática e quatro vagas cobertas. ' +
  'Condomínio fechado com portaria 24 horas, a dez minutos do Lago Sul e perto de escolas e do comércio da região. Documentação em dia, pronta para financiamento.';

/** O conjunto do guia (§5): os KPIs dele são conferidos à mão em docs/desempenho.md. */
export const CONJUNTO_PRINCIPAL: Conjunto = {
  creci: 'DF-12345-F', // fictício
  imoveis: [
    { chave: 'casa', titulo: 'Casa 4 quartos · Jardim Botânico', tipo: 'casa', situacao: 'ativo', bairro: 'Jardim Botânico', preco: 1450000, area: 320, quartos: 4, banheiros: 4, vagas: 4, descricao: DESCRICAO_CASA },
    { chave: 'apto', titulo: 'Apartamento 3 quartos · Sudoeste', tipo: 'apartamento', situacao: 'ativo', bairro: 'Sudoeste', preco: 980000, area: 112, quartos: 3, banheiros: 2, vagas: 2, descricao: 'Apartamento nascente, reformado, perto do Parque da Cidade.' },
    { chave: 'lote', titulo: 'Lote 450 m² · Reserva do Colorado Q1-03', tipo: 'lote', situacao: 'ativo', bairro: 'Reserva do Colorado', preco: 395000, area: 450 },
    { chave: 'cobertura', titulo: 'Cobertura 3 quartos · Noroeste', tipo: 'apartamento', situacao: 'rascunho', bairro: 'Noroeste', preco: 2100000 },
  ],
  pessoas: [
    { nome: 'Ana Ribeiro', telefone: '+5561990000101', canal: 'instagram', etapa: 'Proposta', valor: 1450000, ultimo_contato_dias: 1, imovel: 'casa', observacoes: 'Veio do anúncio do Instagram. Procura casa de 4 quartos até R$ 1,5 mi; financiamento aprovado.' },
    { nome: 'Juliana Prado', telefone: '+5561990000102', canal: 'portal', etapa: 'Proposta', valor: 920000, ultimo_contato_dias: 1, imovel: 'apto', observacoes: 'Fez proposta de R$ 920 mil no apartamento do Sudoeste.' },
    { nome: 'Carlos Menezes', telefone: '+5561990000103', canal: 'pagina', etapa: 'Qualificado', valor: 800000, ultimo_contato_dias: 2 },
    { nome: 'Fernanda Souza', telefone: '+5561990000104', canal: 'indicacao', etapa: 'Novo', valor: 400000, ultimo_contato_dias: 0.2, observacoes: 'Quer lote.' },
    { nome: 'Roberto Lima', telefone: '+5561990000105', canal: 'whatsapp', etapa: 'Em atendimento', valor: 600000, ultimo_contato_dias: 9 },
    { nome: 'Marcos Teixeira', telefone: '+5561990000106', canal: 'placa', etapa: 'Visitou', valor: 395000, ultimo_contato_dias: 12, imovel: 'lote' },
  ],
};

/** O conjunto menor do segundo corretor (roteiro de isolamento, spec 4.5). */
export const CONJUNTO_ISOLAMENTO: Conjunto = {
  creci: 'DF-54321-F', // fictício
  imoveis: [
    { chave: 'apto', titulo: 'Apartamento 2 quartos · Águas Claras', tipo: 'apartamento', situacao: 'ativo', bairro: 'Águas Claras', preco: 520000, area: 65, quartos: 2, banheiros: 2, vagas: 1 },
  ],
  pessoas: [
    { nome: 'Bruno Costa', telefone: '+5561990000201', canal: 'whatsapp', etapa: 'Em atendimento', valor: 520000, ultimo_contato_dias: 2, imovel: 'apto' },
    { nome: 'Lívia Rocha', telefone: '+5561990000202', canal: 'indicacao', etapa: 'Novo', valor: 450000, ultimo_contato_dias: 0.2 },
  ],
};

const COMISSAO = 0.05;

/** Próximo sábado às 10 h de Brasília (UTC−3, sem horário de verão): a visita da Ana. */
export function proximoSabado10h(agora: Date): string {
  const base = Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate(), 13);
  let falta = (6 - new Date(base).getUTCDay() + 7) % 7;
  if (falta === 0 && base <= agora.getTime()) falta = 7;
  return new Date(base + falta * 86400e3).toISOString();
}

demoRotas.post(
  '/demo/semear',
  assincrono(async (req, res) => {
    const dados = req.dados!;
    const perfil = await primeiro(dados, 'perfil_conta', { chave: 'conta' });
    if (!perfil?.demo) return erro(res, 403, 'SO_DEMO', 'Dados de demonstração só existem nas contas de teste.');
    const algum = await dados.listar('contatos', { por_pagina: 1 });
    if (algum.total) return erro(res, 409, 'JA_TEM_DADOS', 'Esta conta já tem contatos: a demonstração só entra numa conta vazia.');
    const principal = perfil.demo_conjunto !== 'isolamento';
    const conjunto = principal ? CONJUNTO_PRINCIPAL : CONJUNTO_ISOLAMENTO;
    const eu = req.contexto!.usuario.id;
    const etapas = await etapasDaConta(dados);
    const etapa = (nome: string) => etapas.find((e) => e.pipeline === 'compra' && e.nome === nome);
    const faltando = conjunto.pessoas.find((p) => !etapa(p.etapa));
    if (faltando) return erro(res, 422, 'ETAPAS_ALTERADAS', `A etapa "${faltando.etapa}" não existe: restaure as etapas padrão em Ajustes › Funil.`);
    // Origens e códigos de imóvel e de negociação já existentes são reaproveitados ou pulados (são únicos na conta).
    const [origensExistentes, imoveisExistentes, negociacoesExistentes] = await Promise.all([
      dados.varrerTudo('origens', { maximo: 5000 }),
      dados.listar('imoveis', { filtros: { 'codigo[busca]': 'IM-' }, ordenar: 'id', ordem: 'desc', por_pagina: 200 }),
      dados.listar('negociacoes', { filtros: { 'codigo[busca]': 'NG-' }, ordenar: 'id', ordem: 'desc', por_pagina: 200 }),
    ]);
    const codigos = imoveisExistentes.dados.map((i) => String(i.codigo));
    const agora = new Date();
    const quando = (dias: number) => new Date(agora.getTime() + dias * 86400e3).toISOString();
    const criados: number[] = [];
    try {
      await dados.transaction(async (trx) => {
        const origens = new Map<string, number>();
        for (const canal of [...new Set(conjunto.pessoas.map((p) => p.canal))]) {
          const existente = origensExistentes.find((o) => o.canal === canal && !o.campanha);
          origens.set(canal, existente ? existente.id : (await trx.criar('origens', { canal, campanha: null })).id);
        }
        const imoveis = new Map<string, number>();
        for (const im of conjunto.imoveis) {
          const codigo = proximoCodigo(codigos);
          codigos.push(codigo);
          const linha = await trx.criar('imoveis', {
            codigo, titulo: im.titulo, tipo: im.tipo, finalidade: 'venda', situacao: im.situacao, cidade: 'Brasília', bairro: im.bairro, uf: 'DF',
            preco_c: im.preco * 100, area_util_m2: im.area ?? null, quartos: im.quartos ?? null, banheiros: im.banheiros ?? null, vagas: im.vagas ?? null,
            descricao: im.descricao ?? null, endereco_publico: 'bairro', publicado_pagina: false, compartilhado_rede: 'nao',
          });
          imoveis.set(im.chave, linha.id);
        }
        const negocioDe = new Map<string, { contato: number; negocio: number }>();
        for (const p of conjunto.pessoas) {
          const e = etapa(p.etapa)!;
          const c = await trx.criar('contatos', {
            nome: p.nome, telefone: p.telefone, papeis: 'comprador', responsavel_id: eu, origem_id: origens.get(p.canal),
            ultimo_contato_em: quando(-p.ultimo_contato_dias), observacoes: p.observacoes ?? null,
          });
          criados.push(c.id);
          const n = await trx.criar('negocios', {
            contato_id: c.id, titulo: `Compra — ${p.nome}`, pipeline: 'compra', etapa_id: e.id, etapa_desde: quando(-p.ultimo_contato_dias),
            valor_estimado_c: p.valor * 100, comissao_pct: COMISSAO, responsavel_id: eu, origem_id: origens.get(p.canal),
            marco_max: e.marco ?? MARCO_PADRAO[e.nome] ?? null, imovel_id: p.imovel ? imoveis.get(p.imovel) : null,
          });
          negocioDe.set(p.nome, { contato: c.id, negocio: n.id });
        }
        if (!principal) return;
        // A visita da Ana (sábado, 10 h) e a do Marcos ao lote, feita há 12 dias (nota 3).
        const ana = negocioDe.get('Ana Ribeiro')!;
        const marcos = negocioDe.get('Marcos Teixeira')!;
        const marcada = await trx.criar('atividades', { tipo: 'visita', titulo: 'Visita à casa do Jardim Botânico', contato_id: ana.contato, negocio_id: ana.negocio, responsavel_id: eu, quando: proximoSabado10h(agora), status: 'pendente' });
        await trx.criar('visitas', { atividade_id: marcada.id, imovel_id: imoveis.get('casa') });
        const feita = await trx.criar('atividades', { tipo: 'visita', titulo: 'Visita ao lote da Reserva do Colorado', contato_id: marcos.contato, negocio_id: marcos.negocio, responsavel_id: eu, quando: quando(-12), status: 'feita' });
        await trx.criar('visitas', { atividade_id: feita.id, imovel_id: imoveis.get('lote'), feedback_nota: 3, feedback_texto: 'Gostou do lote; achou a rua de acesso estreita', compartilhar_com_proprietario: true, feedback_em: quando(-12) });
        // A negociação do P15: o vendedor pediu 1,45 mi; a Ana ofereceu 1,32; o vendedor foi a 1,40;
        // ela repetiu 1,32. Mandato: alvo 1,40, recuo 1,36 (sigiloso), 4 rodadas, pergunta antes.
        const negociacao = await trx.criar('negociacoes', {
          codigo: proximoCodigoNegociacao(negociacoesExistentes.dados.map((n) => String(n.codigo))),
          negocio_id: ana.negocio, imovel_id: imoveis.get('casa'), contato_id: ana.contato, estado: 'ativa', conduzida_por: 'ia', rodadas: 2,
          teto_estimado_comprador_c: 139000000, fonte_estimativa: 'Financiamento aprovado e entrada informada pela cliente',
        });
        const mandato = await trx.criar('mandatos_negociacao', {
          negociacao_id: negociacao.id, versao: 1, preco_pedido_c: 145000000, alvo_c: 140000000, recuo_c: 136000000,
          batna_vendedor: 'Outra família visitou a casa e pode fazer proposta nas próximas semanas.',
          concessoes: [
            { item: 'prazo de entrega de 60 dias', limite: 'até 60 dias', contrapartida: 'entrada de 30%' },
            { item: 'móveis planejados da cozinha', limite: 'só os da cozinha', contrapartida: 'fechamento em 7 dias' },
          ],
          passo_max_pct: 0.4, rodadas_max: 4, validade: new Date(agora.getTime() + 5 * 86400e3).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }), autonomia: 'pergunta_antes', autorizacao_proprietario: null, alterado_por_id: eu,
        });
        await trx.atualizar('negociacoes', negociacao.id, { mandato_id: mandato.id });
        const escada: [number, 'vendedor' | 'comprador', number, string][] = [
          [1, 'vendedor', 145000000, 'corretor'],
          [1, 'comprador', 132000000, 'cliente'],
          [1, 'vendedor', 140000000, 'corretor'],
          [2, 'comprador', 132000000, 'cliente'],
        ];
        for (const [rodada, direcao, valor_c, autor_tipo] of escada) {
          await trx.criar('propostas', { negociacao_id: negociacao.id, rodada, direcao, autor_tipo, autor_usuario_id: autor_tipo === 'corretor' ? eu : null, valor_c, canal: 'registro' });
        }
        await trx.criar('objecoes_detectadas', { negociacao_id: negociacao.id, contato_id: ana.contato, categoria: 'preco', trecho: '1,40 está acima do que planejamos… consigo 1,32?', detectada_por: 'ia', em: quando(-1) });
      });
    } catch (err) {
      // Dois cliques ao mesmo tempo (ou um telefone de demonstração já usado): nada fica gravado.
      if ((err as { code?: string })?.code === '23505') return erro(res, 409, 'JA_TEM_DADOS', 'Esta conta já tem dados que conflitam com a demonstração.');
      throw err;
    }
    // O CRECI fictício só entra se o corretor ainda não tem perfil; nada depende dele (D-93), então
    // uma falha aqui não desfaz a demonstração. A temperatura também é extra: a rotina diária recalcula.
    const meuPerfil = await primeiro(dados, 'perfis_corretor', { usuario_id: eu });
    if (!meuPerfil) await dados.criar('perfis_corretor', { usuario_id: eu, creci: conjunto.creci }).catch(() => null);
    for (const cid of criados) await reclassificar(dados, cid).catch(() => null);
    res.status(201).json({ contatos: criados.length, negocios: conjunto.pessoas.length, imoveis: conjunto.imoveis.length, negociacoes: principal ? 1 : 0 });
  }),
);
