import type { HelperDados } from '@urbiverso/sdk';
import { classificar, deveTrocar, MARCO_PADRAO, PLAYBOOK_PADRAO, venceEm, type Classificacao, type Temperatura } from '../comum/funil';

// Inteligência do Funil por regras (bloco 4): reclassifica a temperatura a cada sinal e aponta a
// próxima abordagem pelo playbook da conta. Só lê por id ou com filtro explícito, para servir
// também à rotina diária (contexto SISTEMA, que enxerga todas as contas).

type Linha = Record<string, any>;
const DIA = 86400e3;

/** Etapas por id, com o marco preenchido pelo nome quando a conta foi semeada antes dele. */
export async function etapasPorId(dados: HelperDados, filtroConta: Record<string, unknown> = {}): Promise<Map<number, Linha>> {
  const r = await dados.listar('etapas_funil', { filtros: filtroConta, por_pagina: 500 });
  const mapa = new Map<number, Linha>();
  for (const e of r.dados) mapa.set(e.id, { ...e, marco: e.marco ?? MARCO_PADRAO[e.nome] ?? null });
  return mapa;
}

/** Junta os sinais do contato e aplica as regras (spec 10.4). */
export async function sinaisDoContato(dados: HelperDados, contato: Linha, agora = new Date()) {
  const iso = agora.toISOString();
  const [negocios, visitasAtiv] = await Promise.all([
    dados.listar('negocios', { filtros: { contato_id: contato.id }, por_pagina: 100 }),
    dados.listar('atividades', { filtros: { contato_id: contato.id, tipo: 'visita' }, ordenar: 'quando', ordem: 'desc', por_pagina: 100 }),
  ]);
  const etapas = await etapasPorId(dados, negocios.dados.length ? { id: negocios.dados.map((n) => n.etapa_id).join(',') } : { id: '0' });
  const maisRecente = (datas: (string | null | undefined)[]) => datas.filter(Boolean).sort().pop() ?? null;
  const emPropostaLista = negocios.dados.filter((n) => {
    const e = etapas.get(n.etapa_id);
    return e?.tipo === 'aberta' && ['proposta', 'documentacao'].includes(e.marco);
  });
  const ate = new Date(agora.getTime() + 14 * DIA).toISOString();
  const marcadas = visitasAtiv.dados.filter((a) => a.status === 'pendente' && a.quando >= iso && a.quando <= ate);
  let notaVisita: number | null = null;
  let notaVisitaEm: string | null = null;
  if (visitasAtiv.dados.length) {
    const desde = new Date(agora.getTime() - 14 * DIA).toISOString();
    const vs = await dados.listar('visitas', { filtros: { atividade_id: visitasAtiv.dados.map((a) => a.id).join(','), 'feedback_em[gte]': desde }, por_pagina: 100 });
    // A maior nota dos últimos 14 dias, com a data do retorno que a trouxe.
    for (const v of vs.dados) {
      if (v.feedback_nota && v.feedback_nota >= (notaVisita ?? 0)) {
        notaVisita = v.feedback_nota;
        notaVisitaEm = v.feedback_em ?? null;
      }
    }
  }
  return {
    agora: iso,
    ultimo_contato_em: contato.ultimo_contato_em ?? null,
    visita_marcada: marcadas.length > 0,
    nota_visita: notaVisita,
    em_proposta: emPropostaLista.length > 0,
    proposta_desde: maisRecente(emPropostaLista.map((n) => n.etapa_desde)),
    visita_marcada_em: maisRecente(marcadas.map((a) => a.criado_em)),
    nota_visita_em: notaVisitaEm,
  };
}

/**
 * Recalcula a temperatura e grava quando muda (com o histórico em `classificacoes`). A escolha do
 * corretor vale até surgir um sinal forte (10.4). Devolve a classificação calculada.
 */
export async function reclassificar(dados: HelperDados, contatoId: number, agora = new Date()): Promise<Classificacao | null> {
  const contato = await dados.buscar('contatos', contatoId);
  if (!contato) return null;
  const sinais = await sinaisDoContato(dados, contato, agora);
  const nova = classificar(sinais);
  const em = agora.toISOString();
  if (deveTrocar({ temperatura: contato.temperatura, autor: contato.temperatura_autor, em: contato.temperatura_em }, nova)) {
    await dados.atualizar('contatos', contatoId, { temperatura: nova.temperatura, temperatura_motivo: nova.motivo, temperatura_autor: 'regra', temperatura_em: em });
    await dados.criar('classificacoes', { contato_id: contatoId, temperatura: nova.temperatura, motivo: nova.motivo, sinais, autor: 'regra', em });
  } else if (contato.temperatura === nova.temperatura && contato.temperatura_autor !== 'corretor' && contato.temperatura_motivo !== nova.motivo) {
    // Mesma temperatura, motivo mais atual: só o texto, sem linha de histórico.
    await dados.atualizar('contatos', contatoId, { temperatura_motivo: nova.motivo, temperatura_autor: 'regra' });
  }
  return nova;
}

/** Marca a temperatura escolhida pelo corretor, com histórico. */
export async function classificarManual(dados: HelperDados, contatoId: number, temperatura: Temperatura | null, motivo: string | null) {
  const em = new Date().toISOString();
  if (!temperatura) {
    await dados.atualizar('contatos', contatoId, { temperatura: null, temperatura_motivo: null, temperatura_autor: null, temperatura_em: em });
    return;
  }
  const texto = (motivo ?? '').trim().slice(0, 200) || 'Marcado pelo corretor'; // vazio vira o texto padrão
  await dados.atualizar('contatos', contatoId, { temperatura, temperatura_motivo: texto, temperatura_autor: 'corretor', temperatura_em: em });
  await dados.criar('classificacoes', { contato_id: contatoId, temperatura, motivo: texto, sinais: null, autor: 'corretor', em });
}

/** Playbook da conta por (etapa, temperatura); semeia o padrão na primeira leitura (spec 6.15). */
export async function playbookDaConta(dados: HelperDados, etapas: Map<number, Linha>): Promise<Linha[]> {
  let r = await dados.listar('playbook_funil', { por_pagina: 1000 });
  if (!r.dados.length) {
    for (const e of etapas.values()) {
      if (!e.ativa || e.tipo !== 'aberta' || !e.marco) continue;
      for (const a of PLAYBOOK_PADRAO.filter((x) => x.marco === e.marco)) {
        try {
          await dados.criar('playbook_funil', { etapa_id: e.id, temperatura: a.temperatura, abordagem: a.abordagem, canal_sugerido: a.canal_sugerido, prazo_horas: a.prazo_horas });
        } catch (err) {
          if ((err as { code?: string })?.code !== '23505') throw err; // outra requisição semeou junto
        }
      }
    }
    r = await dados.listar('playbook_funil', { por_pagina: 1000 });
  }
  return r.dados;
}

export interface ProximaAbordagem {
  negocio_id: number;
  etapa_nome: string;
  temperatura: string;
  abordagem: string;
  canal_sugerido: string;
  prazo_horas: number;
  vence_em: string | null;
  vencida: boolean;
}

/**
 * Próxima abordagem do contato: o negócio aberto mais recente e a temperatura (sem temperatura,
 * morno) apontam a linha do playbook. Vence a partir do mais recente entre entrar na etapa, o
 * último contato e o adiamento.
 */
export function proximaAbordagem(contato: Linha, negocios: Linha[], etapas: Map<number, Linha>, playbook: Linha[], agora = new Date()): ProximaAbordagem | null {
  const abertos = negocios
    .filter((n) => etapas.get(n.etapa_id)?.tipo === 'aberta' && !n.removido_em)
    .sort((a, b) => String(b.etapa_desde ?? b.criado_em ?? '').localeCompare(String(a.etapa_desde ?? a.criado_em ?? '')));
  const negocio = abertos[0];
  if (!negocio) return null;
  const temperatura = contato.temperatura ?? 'morno';
  const linha = playbook.find((p) => p.etapa_id === negocio.etapa_id && p.temperatura === temperatura);
  if (!linha) return null;
  const vence = venceEm(linha.prazo_horas, [negocio.etapa_desde, contato.ultimo_contato_em, contato.abordagem_adiada_em]);
  return {
    negocio_id: negocio.id,
    etapa_nome: etapas.get(negocio.etapa_id)?.nome ?? '',
    temperatura,
    abordagem: linha.abordagem,
    canal_sugerido: linha.canal_sugerido,
    prazo_horas: linha.prazo_horas,
    vence_em: vence,
    vencida: !!vence && vence < agora.toISOString(),
  };
}
