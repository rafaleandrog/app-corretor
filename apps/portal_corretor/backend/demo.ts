import '@urbiverso/sdk/express';
import { Router, type Request } from 'express';
import { MARCO_PADRAO } from '../comum/funil';
import { autorizacaoVigente, proximoCodigo, type Autorizacao } from '../comum/imoveis';
import { proximoCodigoNegociacao } from '../comum/negociacao';
import { blocosPadrao, sugerirEndereco, type Bloco } from '../comum/pagina';
import { assincrono, erro, guardarCorretor, primeiro } from './acesso';
import { etapasDaConta } from './crm';
import { CORES_AMBIENTE, documentoDeExemplo, fotoDeExemplo } from './demo-arquivos';
import { registrarMensagem } from './conversas';
import { reclassificar } from './inteligencia';
import { enderecoLivre, publicarPagina } from './pagina';
import { corretorDaConta, publicarSelecao, sincronizarPortal } from './portal';
import { contaDoRequest, origemPublica, paginaDaConta, publicavel, sincronizarTudo } from './vitrine';

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
  /** Fotos de exemplo (#189): 8 ou mais somam os 30 pontos de fotos da qualidade. */
  fotos?: number;
  /** Autorização de venda assinada, com o documento anexado (#189), e o nome do proprietário. */
  autorizacao?: { exclusiva: boolean; proprietario: string };
  /** Marcado para a Minha Página. */
  pagina?: boolean;
}

/** Peça do Estúdio da demonstração (sem Instagram, sem evento): nenhum estado de publicação. */
interface PecaDemo {
  titulo: string;
  /** Chave do imóvel do conjunto. */
  imovel?: string;
  formato: 'post_1x1' | 'post_4x5' | 'carrossel' | 'story';
  objetivo: 'novo_imovel' | 'baixou_preco' | 'visita_aberta' | 'destaque';
  chamada: string;
  destaques: string[];
  legenda: string;
  hashtags: string;
  /** Com arte (PNG de exemplo): só criada quando `req.arquivos` existe. `aprovada` pede arte. */
  arte?: boolean;
  estado: 'rascunho' | 'aprovada';
}

interface Conjunto {
  creci: string;
  /** WhatsApp fictício do corretor: é dele que sai o "Falar no WhatsApp" da página pública. */
  telefone: string;
  pessoas: Pessoa[];
  imoveis: Imovel[];
  /** A seleção e o portal do cliente (M4, M5): para quem e com quais imóveis. */
  selecao?: { para: string; titulo: string; imoveis: string[] };
  /** A conversa de exemplo do cliente (a aba Conversa do portal, M4). */
  conversa?: { com: string; mensagens: { direcao: 'entrada' | 'saida'; texto: string; horas: number }[] };
  /** Apresentação da Minha Página e os imóveis em destaque (chaves). */
  pagina?: { apresentacao: string; destaques: string[] };
  /** Peças do Estúdio (só entram se a conta não tem nenhuma). */
  estudio?: PecaDemo[];
}

const DESCRICAO_CASA =
  'Casa térrea de 4 quartos, sendo 2 suítes, num lote arborizado do Jardim Botânico. Sala ampla com pé-direito duplo integrada à varanda gourmet, ' +
  'cozinha planejada com ilha, escritório e área de serviço independente. Piscina aquecida, jardim com irrigação automática e quatro vagas cobertas. ' +
  'Condomínio fechado com portaria 24 horas, a dez minutos do Lago Sul e perto de escolas e do comércio da região. Documentação em dia, pronta para financiamento.';

const DESCRICAO_LOTE =
  'Lote plano de 450 m² na Reserva do Colorado, quadra 1, de esquina e com frente para a área verde do condomínio. ' +
  'Escritura registrada, IPTU em dia e infraestrutura completa: asfalto, rede de água, esgoto, energia e iluminação pública. ' +
  'Condomínio fechado com portaria 24 horas, clube com piscina e quadras, a cinco minutos do Sobradinho e com acesso rápido à DF-150. ' +
  'Projeto de casa térrea aprovado de exemplo à disposição de quem visitar.';

/** O conjunto do guia (§5): os KPIs dele são conferidos à mão em docs/desempenho.md. */
export const CONJUNTO_PRINCIPAL: Conjunto = {
  creci: 'DF-12345-F', // fictício
  telefone: '+5561990000100', // fictício
  imoveis: [
    // Qualidade (a do cálculo real, de 5 em 5): casa 100, apartamento 80 (descrição curta), lote 70
    // (3 fotos) e cobertura 35 (rascunho sem fotos, descrição nem autorização). O guia diz 92 · 78 · 64 · 41.
    { chave: 'casa', titulo: 'Casa 4 quartos · Jardim Botânico', tipo: 'casa', situacao: 'ativo', bairro: 'Jardim Botânico', preco: 1450000, area: 320, quartos: 4, banheiros: 4, vagas: 4, descricao: DESCRICAO_CASA, fotos: 12, autorizacao: { exclusiva: true, proprietario: 'Helena Duarte' }, pagina: true },
    { chave: 'apto', titulo: 'Apartamento 3 quartos · Sudoeste', tipo: 'apartamento', situacao: 'ativo', bairro: 'Sudoeste', preco: 980000, area: 112, quartos: 3, banheiros: 2, vagas: 2, descricao: 'Apartamento nascente, reformado, perto do Parque da Cidade.', fotos: 8, autorizacao: { exclusiva: false, proprietario: 'Sérgio Mattos' }, pagina: true },
    { chave: 'lote', titulo: 'Lote 450 m² · Reserva do Colorado Q1-03', tipo: 'lote', situacao: 'ativo', bairro: 'Reserva do Colorado', preco: 395000, area: 450, descricao: DESCRICAO_LOTE, fotos: 3, autorizacao: { exclusiva: false, proprietario: 'Wagner Lopes' }, pagina: true },
    { chave: 'cobertura', titulo: 'Cobertura 3 quartos · Noroeste', tipo: 'apartamento', situacao: 'rascunho', bairro: 'Noroeste', preco: 2100000, area: 180, quartos: 3, banheiros: 3, vagas: 3 },
  ],
  selecao: { para: 'Ana Ribeiro', titulo: 'Casas e apartamentos para você', imoveis: ['casa', 'apto', 'lote'] },
  conversa: {
    com: 'Ana Ribeiro',
    mensagens: [
      { direcao: 'entrada', texto: 'Oi, Rafael! Vi a casa do Jardim Botânico no Instagram. Ainda está disponível?', horas: -50 },
      { direcao: 'saida', texto: 'Oi, Ana! Está sim. Separei mais duas opções no seu perfil; te mando o link para você ver com calma.', horas: -49 },
      { direcao: 'entrada', texto: 'Perfeito. Dá para visitar no sábado de manhã?', horas: -26 },
      { direcao: 'saida', texto: 'Combinado: sábado às 10 h na casa. Te espero lá!', horas: -25 },
    ],
  },
  pagina: {
    apresentacao: 'Corretor em Brasília, focado em casas e apartamentos no Jardim Botânico, Sudoeste e Reserva do Colorado. Atendo do primeiro contato à escritura.',
    destaques: ['casa', 'apto'],
  },
  estudio: [
    { titulo: 'Lançamento · Casa Jardim Botânico', imovel: 'casa', formato: 'post_1x1', objetivo: 'novo_imovel', chamada: 'Acabou de chegar. Agende sua visita.', destaques: ['320 m²', '4 quartos', '4 vagas'], legenda: 'Novo no Jardim Botânico: casa de 4 quartos, 320 m², piscina e quatro vagas.\nChame no WhatsApp e agende sua visita.\nCRECI DF-12345-F', hashtags: '#casadosonhos #jardimbotanico #imoveisbrasilia', estado: 'rascunho' },
    { titulo: 'Carrossel · Apartamento Sudoeste', imovel: 'apto', formato: 'carrossel', objetivo: 'destaque', chamada: 'Fale comigo e agende sua visita.', destaques: ['112 m²', '3 quartos', '2 vagas'], legenda: 'Apartamento reformado no Sudoeste, perto do Parque da Cidade.\nDeslize para ver os detalhes.\nCRECI DF-12345-F', hashtags: '#sudoeste #apartamento #imoveisbrasilia', estado: 'rascunho' },
    { titulo: 'Story · Lote Reserva do Colorado', imovel: 'lote', formato: 'story', objetivo: 'visita_aberta', chamada: 'Venha conhecer: visita aberta.', destaques: ['450 m²', 'Esquina'], legenda: 'Lote de esquina de 450 m² na Reserva do Colorado.\nVisita neste fim de semana.\nCRECI DF-12345-F', hashtags: '#lote #reservadocolorado', arte: true, estado: 'rascunho' },
    { titulo: 'Post · Casa com piscina', imovel: 'casa', formato: 'post_4x5', objetivo: 'destaque', chamada: 'Fale comigo e agende sua visita.', destaques: ['Piscina', 'Condomínio fechado'], legenda: 'Casa com piscina aquecida e jardim em condomínio fechado.\nAgende sua visita.\nCRECI DF-12345-F', hashtags: '#casacompiscina #jardimbotanico', arte: true, estado: 'aprovada' },
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
  telefone: '+5561990000200', // fictício
  imoveis: [
    { chave: 'apto', titulo: 'Apartamento 2 quartos · Águas Claras', tipo: 'apartamento', situacao: 'ativo', bairro: 'Águas Claras', preco: 520000, area: 65, quartos: 2, banheiros: 2, vagas: 1, fotos: 2, autorizacao: { exclusiva: false, proprietario: 'Otávio Reis' }, pagina: true },
  ],
  pessoas: [
    { nome: 'Bruno Costa', telefone: '+5561990000201', canal: 'whatsapp', etapa: 'Em atendimento', valor: 520000, ultimo_contato_dias: 2, imovel: 'apto' },
    { nome: 'Lívia Rocha', telefone: '+5561990000202', canal: 'indicacao', etapa: 'Novo', valor: 450000, ultimo_contato_dias: 0.2 },
  ],
};

const COMISSAO = 0.05;

/** A escada do P15 (guia §4): comprador 1,30 mi → Negociador 1,40 mi → comprador 1,32 mi. */
export const ESCADA = [
  { rodada: 1, direcao: 'comprador', autor_tipo: 'cliente', valor_c: 130000000, canal: 'registro', estado: 'registrada' },
  { rodada: 1, direcao: 'vendedor', autor_tipo: 'negociador_ia', valor_c: 140000000, canal: 'portal', estado: 'enviada' },
  { rodada: 2, direcao: 'comprador', autor_tipo: 'cliente', valor_c: 132000000, canal: 'portal', estado: 'registrada' },
] as const;

/** A escada que a semente gravava até a 0.1.49 (#189); a completude troca por `ESCADA` se a achar igual. */
const ESCADA_ANTIGA: [number, string, number][] = [
  [1, 'vendedor', 145000000],
  [1, 'comprador', 132000000],
  [1, 'vendedor', 140000000],
  [2, 'comprador', 132000000],
];

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
    const principal = perfil.demo_conjunto !== 'isolamento';
    const conjunto = principal ? CONJUNTO_PRINCIPAL : CONJUNTO_ISOLAMENTO;
    const algum = await dados.listar('contatos', { filtros: { conta_id: contaDoRequest(req) }, por_pagina: 1 });
    if (algum.total) {
      // Conta que já gerou (ou que tem dados): a semente só completa o que falta da demonstração do
      // guia (#189) e nunca reescreve o que já existe. Nada a completar: recusa, como antes.
      const { feito, avisos } = await completarDemo(req, conjunto);
      // Aviso (ex.: página não publicada) não conta como completado: sem mais nada feito, segue o 409.
      if (!feito.length) return erro(res, 409, 'JA_TEM_DADOS', `Esta conta já tem contatos: a demonstração só entra numa conta vazia.${avisos.length ? ` (${avisos.join('; ')})` : ''}`);
      return res.json({ completado: feito, avisos });
    }
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
    const imoveisNovos: number[] = [];
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
          imoveisNovos.push(Number(linha.id));
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
        // A negociação do P15 (guia, #189): o anúncio pede 1,45 mi; a Ana ofereceu 1,30; o Negociador
        // respondeu 1,40 (enviada pelo portal); ela subiu a 1,32. Mandato: alvo 1,40, recuo 1,36
        // (sigiloso), 4 rodadas, pergunta antes.
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
        for (const p of ESCADA) await trx.criar('propostas', { negociacao_id: negociacao.id, ...p });
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
    if (!meuPerfil) await dados.criar('perfis_corretor', { usuario_id: eu, creci: conjunto.creci, telefone: conjunto.telefone }).catch(() => null);
    for (const cid of criados) await reclassificar(dados, cid).catch(() => null);
    const { feito: completado, avisos } = await completarDemo(req, conjunto, new Set(imoveisNovos));
    res.status(201).json({ contatos: criados.length, negocios: conjunto.pessoas.length, imoveis: conjunto.imoveis.length, negociacoes: principal ? 1 : 0, completado, avisos });
  }),
);

type Linha = Record<string, any>;
const hojeEm = (req: Request) => new Date().toLocaleDateString('sv-SE', { timeZone: req.contexto?.fuso || 'America/Sao_Paulo' });
const diaMais = (dia: string, dias: number) => new Date(Date.parse(`${dia}T12:00:00Z`) + dias * 86400e3).toISOString().slice(0, 10);

/** Sobe um arquivo gerado para a coluna `arquivo` de `imovel_midias` e grava a mídia. */
async function novaMidia(req: Request, imovelId: number, m: { tipo: 'foto' | 'documento'; nome: string; mime: string; buffer: Buffer; ordem: number; legenda: string | null; publica: boolean }) {
  const up = await req.arquivos!.enviar({ tabela: 'imovel_midias', coluna: 'arquivo', nome: m.nome, mime: m.mime, buffer: m.buffer });
  return req.dados!.criar('imovel_midias', { imovel_id: imovelId, arquivo: up.upload_id, tipo: m.tipo, ordem: m.ordem, legenda: m.legenda, publica: m.publica });
}

const AMBIENTES_FOTO = ['Fachada', 'Sala', 'Cozinha', 'Suíte', 'Varanda', 'Área de lazer', 'Quarto', 'Banheiro', 'Jardim', 'Garagem', 'Vista', 'Piscina'];

/**
 * Completa a demonstração do guia (#189) numa conta de teste, sem reescrever nada que já exista:
 * dados vazios dos imóveis do conjunto, fotos de exemplo (só em imóvel sem foto), autorização de
 * venda assinada com documento (só em imóvel sem autorização vigente), marca para a Minha Página, a
 * página (o endereço de uma página já salva fica como está) publicada, a conversa, a seleção e o
 * portal do cliente do guia (só se ele ainda não tem) e a escada do P15 no lugar da antiga. Devolve
 * `feito` (vazio quando não havia nada a completar) e `avisos` (falhas que não mudaram nada, como a
 * página não publicada: informadas ao usuário, mas não contam como completado). `novos` são os ids dos
 * imóveis criados nesta mesma chamada: só neles a semente liga `publicado_pagina`, porque "desligado"
 * é escolha válida do corretor e a semente nunca religa. Cada passo depende de `req.arquivos` e
 * `req.shell`; sem eles (contexto de teste sem os helpers), o passo é pulado.
 */
export async function completarDemo(req: Request, conjunto: Conjunto, novos: Set<number> = new Set()): Promise<{ feito: string[]; avisos: string[] }> {
  const dados = req.dados!;
  const conta = contaDoRequest(req);
  const eu = req.contexto!.usuario.id;
  const feito: string[] = [];
  const avisos: string[] = [];
  const dia = hojeEm(req);
  const todos = await dados.varrerTudo('imoveis', { filtros: { conta_id: conta }, maximo: 5000 });
  const imovelDe = new Map<string, Linha>();
  for (const im of conjunto.imoveis) {
    const achado = todos.find((x) => x.titulo === im.titulo);
    if (achado) imovelDe.set(im.chave, achado);
  }
  const contatos = await dados.varrerTudo('contatos', { filtros: { conta_id: conta }, maximo: 5000 });
  const contatoPorNome = (nome: string) => contatos.find((c) => c.nome === nome) ?? null;

  for (const im of conjunto.imoveis) {
    const linha = imovelDe.get(im.chave);
    if (!linha) continue;
    // Dados que faltam (só os vazios: o que o corretor editou fica).
    const vazio: Linha = {};
    const quer: Linha = { descricao: im.descricao, area_util_m2: im.area, quartos: im.quartos, banheiros: im.banheiros, vagas: im.vagas };
    for (const [c, v] of Object.entries(quer)) if (v !== undefined && (linha[c] === null || linha[c] === undefined || linha[c] === '')) vazio[c] = v;
    if (im.pagina && !linha.publicado_pagina && novos.has(Number(linha.id))) vazio.publicado_pagina = true;
    if (Object.keys(vazio).length) {
      Object.assign(linha, await dados.atualizar('imoveis', linha.id, vazio));
      feito.push(`${im.titulo}: dados`);
    }
    const midias = await dados.varrerTudo('imovel_midias', { filtros: { conta_id: conta, imovel_id: linha.id }, maximo: 500 });
    if (im.fotos && typeof req.arquivos?.enviar === 'function' && !midias.some((m) => m.tipo === 'foto')) {
      for (let i = 0; i < im.fotos; i++) {
        const [topo, base] = CORES_AMBIENTE[i % CORES_AMBIENTE.length];
        const legenda = AMBIENTES_FOTO[i % AMBIENTES_FOTO.length];
        await novaMidia(req, linha.id, { tipo: 'foto', nome: `exemplo-${i + 1}.png`, mime: 'image/png', buffer: fotoDeExemplo(topo, base), ordem: i, legenda, publica: true });
      }
      feito.push(`${im.titulo}: ${im.fotos} fotos`);
    }
    if (im.autorizacao && typeof req.arquivos?.enviar === 'function') {
      const auts = await dados.varrerTudo('autorizacoes_venda', { filtros: { conta_id: conta, imovel_id: linha.id }, maximo: 200 });
      if (!auts.some((a) => autorizacaoVigente(a as Autorizacao, dia))) {
        let dono = contatoPorNome(im.autorizacao.proprietario);
        if (!dono) {
          dono = await dados.criar('contatos', { nome: im.autorizacao.proprietario, papeis: 'proprietario', responsavel_id: eu, observacoes: 'Proprietário (dados de demonstração).' });
          contatos.push(dono);
        }
        const inicio = diaMais(dia, -30);
        const fim = diaMais(dia, 150);
        const doc = await novaMidia(req, linha.id, {
          tipo: 'documento', nome: 'autorizacao-de-venda.pdf', mime: 'application/pdf', ordem: 9000, legenda: 'Autorização de venda assinada', publica: false,
          buffer: documentoDeExemplo([
            'Autorizacao de venda (exemplo de demonstracao)',
            `Imovel: ${linha.codigo} - ${im.titulo}`,
            `Proprietario: ${im.autorizacao.proprietario}`,
            `Preco autorizado: R$ ${im.preco.toLocaleString('pt-BR')}`,
            `Vigencia: ${inicio} a ${fim}${im.autorizacao.exclusiva ? ' - exclusiva' : ''}`,
            'Comissao: 5%',
            'Documento ficticio, gerado para demonstracao do Portal do Corretor.',
          ]),
        });
        await dados.criar('autorizacoes_venda', {
          imovel_id: linha.id, proprietario_id: dono.id, exclusiva: im.autorizacao.exclusiva, inicio, fim, comissao_pct: 5, preco_autorizado_c: im.preco * 100,
          permite_parceria: false, permite_placa: true, permite_portais: true, documento_midia_id: doc.id, situacao: 'assinada',
        });
        if (!linha.proprietario_id) await dados.atualizar('imoveis', linha.id, { proprietario_id: dono.id });
        feito.push(`${im.titulo}: autorização assinada`);
      }
    }
  }

  // WhatsApp do corretor (a capa da página pública só mostra "Falar no WhatsApp" com ele): só se o
  // perfil não tem telefone; o que o corretor digitou fica.
  if (conjunto.telefone) {
    const perfil = await primeiro(dados, 'perfis_corretor', { usuario_id: eu });
    if (!perfil) {
      await dados.criar('perfis_corretor', { usuario_id: eu, creci: conjunto.creci, telefone: conjunto.telefone });
      feito.push('WhatsApp do corretor: perfil criado');
    } else if (!perfil.telefone) {
      await dados.atualizar('perfis_corretor', perfil.id, { telefone: conjunto.telefone });
      feito.push('WhatsApp do corretor: preenchido');
    }
  }

  // Estúdio: um conjunto pequeno de peças, só em conta sem nenhuma. Nada de Instagram nem de evento:
  // ficam em rascunho (falta a arte, ou arte para aprovar) e aprovada (pronta). As com arte dependem de `req.arquivos`.
  if (conjunto.estudio && !(await dados.listar('pecas', { filtros: { conta_id: conta }, por_pagina: 1 })).total) {
    let criadas = 0;
    for (const [i, d] of conjunto.estudio.entries()) {
      if (d.arte && typeof req.arquivos?.enviar !== 'function') continue;
      const peca = await dados.criar('pecas', {
        imovel_id: d.imovel ? imovelDe.get(d.imovel)?.id ?? null : null, formato: d.formato, objetivo: d.objetivo, titulo: d.titulo, chamada: d.chamada,
        destaques: d.destaques, legenda: d.legenda, hashtags: d.hashtags, motor: 'canva_ia', estado: d.estado, gerada_por_ia: false,
        ...(d.estado === 'aprovada' ? { aprovada_em: new Date().toISOString(), aprovada_por_id: eu } : {}),
      });
      if (d.arte) {
        const [topo, base] = CORES_AMBIENTE[(i + 3) % CORES_AMBIENTE.length];
        const up = await req.arquivos!.enviar({ tabela: 'peca_arquivos', coluna: 'arquivo', nome: `arte-${i + 1}.png`, mime: 'image/png', buffer: fotoDeExemplo(topo, base) });
        await dados.criar('peca_arquivos', { peca_id: peca.id, arquivo: up.upload_id, ordem: 0 });
      }
      criadas++;
    }
    if (criadas) feito.push(`Estúdio: ${criadas} peças`);
  }

  // Minha Página: criada se não existe (endereço livre pelo nome); a já salva fica como está (endereço,
  // blocos), e só ganha a publicação, se ainda não está no ar.
  const temShell = typeof req.shell?.gerarIngressoWh === 'function';
  if (temShell) {
    let pagina = await paginaDaConta(dados, conta);
    if (!pagina) {
      const nome = req.contexto!.usuario.nome || 'Corretor';
      const blocos = blocosPadrao().map((b) => {
        if (b.tipo === 'apresentacao' && conjunto.pagina) return { ...b, texto: conjunto.pagina.apresentacao };
        return b;
      });
      pagina = await dados.criar('paginas_corretor', { chave: 'conta', endereco: await enderecoLivre(req, sugerirEndereco(nome)), nome_exibicao: nome, blocos });
      feito.push(`página criada (${pagina.endereco})`);
    }
    // Imóveis em destaque: só se o bloco está ligado e vazio (o que o corretor escolheu fica), com os
    // da demonstração que a vitrine de fato mostra (marcados, anunciados e com autorização vigente).
    const blocosPagina = (Array.isArray(pagina.blocos) ? pagina.blocos : []) as Bloco[];
    const vaga = blocosPagina.find((b) => b.tipo === 'destaques');
    if (conjunto.pagina && vaga && vaga.ativo !== false && !(vaga.codigos ?? []).length) {
      const codigos: string[] = [];
      for (const k of conjunto.pagina.destaques) {
        const im = imovelDe.get(k);
        if (!im) continue;
        const auts = await dados.varrerTudo('autorizacoes_venda', { filtros: { conta_id: conta, imovel_id: im.id }, maximo: 200 });
        if (publicavel(im, auts, dia)) codigos.push(String(im.codigo));
      }
      if (codigos.length) {
        pagina = (await dados.atualizar('paginas_corretor', pagina.id, { blocos: blocosPagina.map((b) => (b === vaga ? { ...b, codigos } : b)) })) ?? pagina;
        feito.push(`destaques da página: ${codigos.join(', ')}`);
      }
    }
    if (!pagina.publicada_em) {
      const r = await publicarPagina(req);
      if (r.ok) feito.push(`página publicada (${pagina.endereco})`);
      else avisos.push(`página não publicada: ${r.mensagem}`);
    } else if (feito.some((f) => f.includes(':'))) {
      // Já no ar: a vitrine acompanha os imóveis que acabaram de virar publicáveis.
      await sincronizarTudo(req);
    }
  }

  // A conversa de exemplo do cliente (antes da seleção e do portal, que entram nela como cartões).
  const corretor = await corretorDaConta(dados, conta, eu, req.contexto!.usuario.nome);
  if (conjunto.conversa) {
    const c = contatoPorNome(conjunto.conversa.com);
    if (c && !(await dados.listar('mensagens', { filtros: { conta_id: conta, contato_id: c.id }, por_pagina: 1 })).total) {
      for (const m of conjunto.conversa.mensagens) {
        await registrarMensagem(dados, {
          contato_id: Number(c.id), direcao: m.direcao, autor_tipo: m.direcao === 'entrada' ? 'contato' : 'humano', autor_id: m.direcao === 'saida' ? eu : null,
          canal: 'registro', tipo: 'texto', conteudo: m.texto, em: new Date(Date.now() + m.horas * 3600e3).toISOString(),
        });
      }
      feito.push(`conversa de ${c.nome}`);
    }
  }

  // Seleção e portal do cliente do guia (M4, M5): só se ele ainda não tem.
  if (conjunto.selecao && temShell) {
    const c = contatoPorNome(conjunto.selecao.para);
    if (c) {
      const tem = await dados.listar('selecoes', { filtros: { conta_id: conta, contato_id: c.id }, por_pagina: 1 });
      const ids: number[] = [];
      if (!tem.total) {
        for (const k of conjunto.selecao.imoveis) {
          const im = imovelDe.get(k);
          if (!im) continue;
          const auts = await dados.varrerTudo('autorizacoes_venda', { filtros: { conta_id: conta, imovel_id: im.id }, maximo: 200 });
          if (publicavel({ ...im, publicado_pagina: true }, auts, dia)) ids.push(Number(im.id));
        }
      }
      if (ids.length) {
        const config = await primeiro(dados, 'configuracoes_conta', { chave: 'conta', conta_id: conta });
        const expira = new Date(Date.now() + (Number(config?.validade_selecao_dias) || 14) * 86400e3);
        const agora = new Date().toISOString();
        const s = await dados.criar('selecoes', { contato_id: c.id, titulo: conjunto.selecao.titulo, mensagem: null, enviada_em: agora, expira_em: expira.toISOString(), criada_por_id: eu });
        for (const [ordem, imovelId] of ids.entries()) await dados.criar('selecao_itens', { selecao_id: s.id, imovel_id: imovelId, ordem });
        const g = await req.shell!.gerarIngressoWh({ webhook: 'reacao_selecao', contexto: { conta_id: conta, selecao_id: s.id }, expira_em: expira });
        const link = `${origemPublica(g.url)}/portal_corretor/s?t=${g.token}`;
        const salva = await dados.atualizar('selecoes', s.id, { ingresso_id: g.ingresso_id, url_reacao: g.url, link });
        await publicarSelecao(dados, conta, salva!, corretor);
        await dados.criar('envios', { contato_id: c.id, tipo: 'selecao', canal: 'whatsapp', autor_tipo: 'humano', descricao: `${conjunto.selecao.titulo} (${ids.length} imóveis)`, enviado_em: agora, cliques: 0 });
        await registrarMensagem(dados, {
          contato_id: Number(c.id), direcao: 'saida', autor_tipo: 'humano', autor_id: eu, canal: 'registro', tipo: 'selecao', conteudo: conjunto.selecao.titulo,
          dados: { selecao_id: Number(s.id), titulo: conjunto.selecao.titulo, quantidade: ids.length, link },
        });
        feito.push(`seleção para ${c.nome} (${ids.length} imóveis)`);
      }
      const acesso = await dados.listar('acessos_cliente', { filtros: { conta_id: conta, contato_id: c.id, 'revogado_em[nulo]': 'true' }, por_pagina: 1 });
      if (!acesso.total) {
        const g = await req.shell!.gerarIngressoWh({ webhook: 'acao_cliente', contexto: { conta_id: conta, contato_id: c.id } });
        const link = `${origemPublica(g.url)}/portal_corretor/c?t=${g.token}`;
        await dados.criar('acessos_cliente', { contato_id: c.id, perfil: 'comprador', ingresso_id: g.ingresso_id, url_acoes: g.url, link, criado_por_id: eu });
        await dados.criar('envios', { contato_id: c.id, tipo: 'link_portal', canal: 'whatsapp', autor_tipo: 'humano', descricao: 'Link do portal do cliente', enviado_em: new Date().toISOString(), cliques: 0 });
        await registrarMensagem(dados, { contato_id: Number(c.id), direcao: 'saida', autor_tipo: 'humano', autor_id: eu, canal: 'registro', tipo: 'link_portal', dados: { link } });
        feito.push(`portal de ${c.nome}`);
      }
    }
  }

  // A escada antiga (até a 0.1.49) vira a do guia, só se estiver exatamente como a semente gravou.
  const negociacoes = await dados.varrerTudo('negociacoes', { filtros: { conta_id: conta }, maximo: 50 });
  for (const n of negociacoes) {
    const props = (await dados.varrerTudo('propostas', { filtros: { conta_id: conta, negociacao_id: n.id }, maximo: 50 })).sort((a, b) => Number(a.id) - Number(b.id));
    const igual =
      props.length === ESCADA_ANTIGA.length &&
      props.every((p, i) => Number(p.rodada) === ESCADA_ANTIGA[i][0] && p.direcao === ESCADA_ANTIGA[i][1] && Number(p.valor_c) === ESCADA_ANTIGA[i][2] && p.canal === 'registro');
    if (!igual) continue;
    for (const [i, p] of ESCADA.entries()) await dados.atualizar('propostas', props[i].id, { ...p, autor_usuario_id: null });
    await dados.deletar('propostas', props[3].id);
    feito.push(`escada da negociação ${n.codigo}`);
  }

  // O portal acompanha (agenda, seleção, propostas).
  if (conjunto.selecao) {
    const c = contatoPorNome(conjunto.selecao.para);
    if (c && feito.length) await sincronizarPortal(dados, conta, Number(c.id), corretor);
  }
  return { feito, avisos };
}
