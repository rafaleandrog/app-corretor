// Negociação (spec 6.16, 10.9): vocabulário, validação do mandato, sigilo e o playbook padrão de
// objeções (Apêndice D). Sem dependência de backend: o motor do Negociador (D2) e as telas (D3, D4)
// usam as mesmas regras.

export const ESTADOS_NEGOCIACAO = ['ativa', 'aguardando_cliente', 'aguardando_corretor', 'aguardando_proprietario', 'ganha', 'perdida', 'pausada'] as const;
export type EstadoNegociacao = (typeof ESTADOS_NEGOCIACAO)[number];
export const ENCERRADOS: readonly EstadoNegociacao[] = ['ganha', 'perdida'];
export const MOTIVOS_PERDA = ['preco', 'localizacao', 'financiamento', 'desistiu', 'comprou_com_outro', 'sem_resposta', 'outro'] as const;
export const AUTONOMIAS = ['sugere', 'pergunta_antes', 'faz_sozinho'] as const;
export const ESTILOS = ['cooperativo', 'firme', 'consultivo'] as const;
export const DIRECOES = ['comprador', 'vendedor', 'proprietario'] as const;
export type Direcao = (typeof DIRECOES)[number];
/** Canais de uma proposta (D-107, O12): `whatsapp` fica reservado à API do WhatsApp (P-31/P-32). */
export const CANAIS_PROPOSTA = ['registro', 'portal', 'wa_me', 'whatsapp'] as const;
export const GATILHOS = ['etapa_proposta', 'pedido_desconto', 'reacao_preco', 'oferta_registrada'] as const;
export const LIMITE_INSTRUCOES = 4000;

export const PASSO_MAX_PADRAO = 0.4;
export const RODADAS_MAX_PADRAO = 4;

/**
 * Campos do mandato que só saem em `GET /negociacoes/:id/mandato` para o corretor da conta. Nenhuma
 * outra rota, evento ou exportação os carrega: tudo o que sai passa por `semSigilo()`.
 */
export const CAMPOS_SIGILOSOS = ['recuo_c', 'alvo_c', 'batna_vendedor'] as const;

/** Cópia profunda sem os campos sigilosos, em qualquer nível (objeto aninhado ou lista). */
export function semSigilo<T>(valor: T): T {
  if (Array.isArray(valor)) return valor.map((v) => semSigilo(v)) as T;
  if (valor && typeof valor === 'object' && !(valor instanceof Date)) {
    const limpo: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(valor as Record<string, unknown>)) {
      if ((CAMPOS_SIGILOSOS as readonly string[]).includes(k)) continue;
      limpo[k] = semSigilo(v);
    }
    return limpo as T;
  }
  return valor;
}

/** Próximo código `NG-nnnn` a partir dos que já existem na conta. */
export function proximoCodigoNegociacao(existentes: string[]): string {
  const maior = existentes.reduce((m, c) => {
    const r = /^NG-(\d+)$/.exec(c);
    return r ? Math.max(m, Number(r[1])) : m;
  }, 0);
  return `NG-${String(maior + 1).padStart(4, '0')}`;
}

/**
 * Rodada de uma proposta nova. Cada oferta do comprador abre uma rodada; a resposta do vendedor ou
 * do proprietário fica na rodada aberta. A primeira proposta, de quem for, é a rodada 1.
 */
export function rodadaDaProposta(direcoesAnteriores: Direcao[], direcao: Direcao): number {
  const doComprador = direcoesAnteriores.filter((d) => d === 'comprador').length + (direcao === 'comprador' ? 1 : 0);
  return Math.max(1, doComprador);
}

/**
 * Passo máximo de concessão de preço numa rodada (O6): `passo_max_pct` do intervalo que ainda resta
 * entre a posição atual do vendedor e o ponto de recuo. Na primeira rodada, a posição atual é o
 * preço pedido; depois, a última contraproposta do vendedor. Com o padrão 0,40, pedido de 1.000 e
 * recuo de 800, a primeira concessão vai a no máximo 80 (até 920); a seguinte, a 48 (até 872).
 * Como o intervalo encolhe, o passo diminui a cada rodada (10.9.6, conceder cada vez menos).
 */
export function passoMaximo_c(posicaoVendedor_c: number, recuo_c: number, passo_max_pct: number): number {
  return Math.max(0, Math.floor((posicaoVendedor_c - recuo_c) * passo_max_pct));
}

export interface Concessao {
  item: string;
  limite: string;
  contrapartida: string;
}

export interface AutorizacaoProprietario {
  tipo: 'anexo' | 'mensagem';
  arquivo_id: number | null;
  data: string;
}

export interface MandatoValido {
  preco_pedido_c: number;
  alvo_c: number;
  recuo_c: number;
  batna_vendedor: string | null;
  concessoes: Concessao[];
  passo_max_pct: number;
  rodadas_max: number;
  validade: string;
  autonomia: (typeof AUTONOMIAS)[number];
  autorizacao_proprietario: AutorizacaoProprietario | null;
}

/** Recusa do mandato: `codigo` e `motivo` vão à tela (13.2). */
export interface RecusaMandato {
  ok: false;
  status: 422;
  codigo: 'MANDATO_INVALIDO' | 'RECUO_ACIMA_DO_ALVO' | 'AUTORIZACAO_PROPRIETARIO_AUSENTE';
  motivo: string;
  mensagem: string;
  detalhes?: string[];
}

const centavos = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v > 0 ? v : null);
const texto = (v: unknown, limite: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, limite) : null);
const dataValida = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));

/** Valida o corpo do PUT do mandato (P16): recuo ≤ alvo ≤ pedido, passo, rodadas e autonomia. */
export function validarMandato(corpo: Record<string, unknown>): { ok: true; dados: MandatoValido } | RecusaMandato {
  const erros: string[] = [];
  const preco_pedido_c = centavos(corpo.preco_pedido_c);
  const alvo_c = centavos(corpo.alvo_c);
  const recuo_c = centavos(corpo.recuo_c);
  if (preco_pedido_c === null) erros.push('preco_pedido_c: informe o preço pedido, em centavos.');
  if (alvo_c === null) erros.push('alvo_c: informe o alvo, em centavos.');
  if (recuo_c === null) erros.push('recuo_c: informe o ponto de recuo, em centavos.');
  const passo_max_pct = corpo.passo_max_pct === undefined || corpo.passo_max_pct === null ? PASSO_MAX_PADRAO : Number(corpo.passo_max_pct);
  if (!Number.isFinite(passo_max_pct) || passo_max_pct <= 0 || passo_max_pct > 1) erros.push('passo_max_pct: use uma fração maior que 0 e até 1 (0,40 = 40%).');
  const rodadas_max = corpo.rodadas_max === undefined || corpo.rodadas_max === null ? RODADAS_MAX_PADRAO : Number(corpo.rodadas_max);
  if (!Number.isInteger(rodadas_max) || rodadas_max < 1 || rodadas_max > 50) erros.push('rodadas_max: use um número inteiro de 1 a 50.');
  if (!dataValida(corpo.validade)) erros.push('validade: informe a data no formato AAAA-MM-DD.');
  const autonomia = corpo.autonomia === undefined ? 'pergunta_antes' : corpo.autonomia;
  if (!(AUTONOMIAS as readonly unknown[]).includes(autonomia)) erros.push('autonomia: use sugere, pergunta_antes ou faz_sozinho.');
  if (corpo.batna_vendedor !== undefined && corpo.batna_vendedor !== null && typeof corpo.batna_vendedor !== 'string') erros.push('batna_vendedor: use texto.');
  if (typeof corpo.batna_vendedor === 'string' && corpo.batna_vendedor.trim().length > 1000) erros.push('batna_vendedor: até 1.000 caracteres.');

  const concessoes: Concessao[] = [];
  const brutas = corpo.concessoes === undefined || corpo.concessoes === null ? [] : corpo.concessoes;
  if (!Array.isArray(brutas) || brutas.length > 20) erros.push('concessoes: use uma lista de até 20 itens.');
  else
    brutas.forEach((c, i) => {
      const o = (c && typeof c === 'object' ? c : {}) as Record<string, unknown>;
      const item = texto(o.item, 100);
      const contrapartida = texto(o.contrapartida, 200);
      // Toda concessão tem contrapartida (10.9.6): sem ela, o item não entra no mandato.
      if (!item || !contrapartida) erros.push(`concessoes[${i}]: cada concessão precisa do item e da contrapartida.`);
      else concessoes.push({ item, limite: texto(o.limite, 200) ?? '', contrapartida });
    });

  let autorizacao_proprietario: AutorizacaoProprietario | null = null;
  if (corpo.autorizacao_proprietario !== undefined && corpo.autorizacao_proprietario !== null) {
    const a = (typeof corpo.autorizacao_proprietario === 'object' ? corpo.autorizacao_proprietario : {}) as Record<string, unknown>;
    const arquivo_id = Number.isInteger(a.arquivo_id) && (a.arquivo_id as number) > 0 ? (a.arquivo_id as number) : null;
    if (a.tipo !== 'anexo' && a.tipo !== 'mensagem') erros.push('autorizacao_proprietario.tipo: use anexo ou mensagem.');
    else if (a.tipo === 'anexo' && arquivo_id === null) erros.push('autorizacao_proprietario.arquivo_id: o anexo precisa do arquivo.');
    else if (!dataValida(a.data)) erros.push('autorizacao_proprietario.data: informe a data no formato AAAA-MM-DD.');
    else autorizacao_proprietario = { tipo: a.tipo, arquivo_id: a.tipo === 'anexo' ? arquivo_id : null, data: a.data };
  }

  if (erros.length) return { ok: false, status: 422, codigo: 'MANDATO_INVALIDO', motivo: 'campos_invalidos', mensagem: 'Confira o mandato.', detalhes: erros };
  if (recuo_c! > alvo_c!) {
    return { ok: false, status: 422, codigo: 'RECUO_ACIMA_DO_ALVO', motivo: 'recuo_acima_do_alvo', mensagem: 'O ponto de recuo não pode ficar acima do alvo.' };
  }
  if (alvo_c! > preco_pedido_c!) {
    return { ok: false, status: 422, codigo: 'MANDATO_INVALIDO', motivo: 'alvo_acima_do_pedido', mensagem: 'O alvo não pode ficar acima do preço pedido.' };
  }
  if (autonomia === 'faz_sozinho' && !autorizacao_proprietario) {
    return {
      ok: false,
      status: 422,
      codigo: 'AUTORIZACAO_PROPRIETARIO_AUSENTE',
      motivo: 'faz_sozinho_sem_autorizacao',
      mensagem: 'Para o Negociador fazer sozinho, registre a autorização do proprietário (anexo ou mensagem com a data).',
    };
  }
  return {
    ok: true,
    dados: {
      preco_pedido_c: preco_pedido_c!,
      alvo_c: alvo_c!,
      recuo_c: recuo_c!,
      batna_vendedor: texto(corpo.batna_vendedor, 1000),
      concessoes,
      passo_max_pct,
      rodadas_max,
      validade: corpo.validade as string,
      autonomia: autonomia as MandatoValido['autonomia'],
      autorizacao_proprietario,
    },
  };
}

/** Padrões do Negociador da conta (6.16), devolvidos enquanto a conta não salvou os seus. */
export const CONFIG_NEGOCIADOR_PADRAO = {
  ligado: true,
  conduz_padrao: 'ia' as const,
  negociador_padrao_id: null,
  gatilhos: Object.fromEntries(GATILHOS.map((g) => [g, true])) as Record<(typeof GATILHOS)[number], boolean>,
  estilo: 'cooperativo' as const,
  instrucoes_corretor: null,
  assinatura_humana: null,
  // 0 = a conta ainda não salvou: a primeira gravação vira a versão 1.
  versao: 0,
};

export const CATEGORIAS_OBJECAO = [
  'preco',
  'pensar',
  'mais_barato',
  'localizacao',
  'estado_imovel',
  'financiamento',
  'decisao_compartilhada',
  'prazo',
  'custos_fixos',
  'documentacao',
] as const;
export type CategoriaObjecao = (typeof CATEGORIAS_OBJECAO)[number];

export interface ObjecaoPadrao {
  categoria: CategoriaObjecao;
  titulo: string;
  fala_cliente: string;
  pergunta_exploracao: string;
  resposta_base: string;
  proximo_passo: string;
}

/** Apêndice D da spec, semeado em `playbook_objecoes` (origem `padrao`) em cada conta. */
export const PLAYBOOK_OBJECOES_PADRAO: ObjecaoPadrao[] = [
  {
    categoria: 'preco',
    titulo: 'Preço',
    fala_cliente: 'Está caro.',
    pergunta_exploracao: 'Comparando com o quê? O que você esperava pagar?',
    resposta_base: 'Comparáveis da região e R$/m²; diferenciais que justificam o valor.',
    proximo_passo: 'Pedir a proposta dele; oferecer condição (prazo, itens) antes de preço.',
  },
  {
    categoria: 'pensar',
    titulo: 'Pensar',
    fala_cliente: 'Vou pensar.',
    pergunta_exploracao: 'Claro. O que ainda falta para você decidir?',
    resposta_base: 'Resumir o que ele disse que gostou; esclarecer a dúvida real.',
    proximo_passo: 'Compromisso pequeno: nova visita, simulação ou conversa em data marcada.',
  },
  {
    categoria: 'mais_barato',
    titulo: 'Mais barato',
    fala_cliente: 'Vi um parecido mais barato.',
    pergunta_exploracao: 'Qual? Posso comparar com você.',
    resposta_base: 'Comparar ponto a ponto (área, estado, localização, custos fixos).',
    proximo_passo: 'Se a comparação for justa, levar ao vendedor; nunca desmerecer o outro imóvel.',
  },
  {
    categoria: 'localizacao',
    titulo: 'Localização',
    fala_cliente: 'É longe do meu trabalho.',
    pergunta_exploracao: 'Quanto tempo de deslocamento seria aceitável?',
    resposta_base: 'Tempos reais, acessos, serviços do bairro.',
    proximo_passo: 'Mostrar alternativa da carteira se a objeção for decisiva.',
  },
  {
    categoria: 'estado_imovel',
    titulo: 'Estado do imóvel',
    fala_cliente: 'Vai precisar de reforma.',
    pergunta_exploracao: 'O que você mudaria primeiro?',
    resposta_base: 'Estimativa de custo e o que está em bom estado.',
    proximo_passo: 'Concessão com contrapartida (ex.: abatimento parcial ↔ fechar rápido).',
  },
  {
    categoria: 'financiamento',
    titulo: 'Financiamento',
    fala_cliente: 'Não sei se o banco aprova.',
    pergunta_exploracao: 'Você já fez alguma simulação?',
    resposta_base: 'Explicar o caminho; sem prometer aprovação.',
    proximo_passo: 'Simulação e indicação de correspondente; seguir quando houver carta de crédito.',
  },
  {
    categoria: 'decisao_compartilhada',
    titulo: 'Decisão compartilhada',
    fala_cliente: 'Preciso falar com minha esposa.',
    pergunta_exploracao: 'O que ela vai querer saber?',
    resposta_base: 'Preparar o resumo do imóvel e das condições para os dois.',
    proximo_passo: 'Visita conjunta ou ligação com os dois.',
  },
  {
    categoria: 'prazo',
    titulo: 'Prazo',
    fala_cliente: 'Só posso mudar em seis meses.',
    pergunta_exploracao: 'O que acontece em seis meses?',
    resposta_base: 'Mostrar se o vendedor tem flexibilidade de entrega.',
    proximo_passo: 'Concessão de prazo ↔ entrada maior ou preço mais próximo do alvo.',
  },
  {
    categoria: 'custos_fixos',
    titulo: 'Custos fixos',
    fala_cliente: 'O condomínio é alto.',
    pergunta_exploracao: 'O que pesa no seu orçamento mensal?',
    resposta_base: 'O que o condomínio inclui; comparação com a região.',
    proximo_passo: 'Considerar no valor total da proposta.',
  },
  {
    categoria: 'documentacao',
    titulo: 'Documentação',
    fala_cliente: 'Tem alguma pendência?',
    pergunta_exploracao: 'O que você gostaria de ver?',
    resposta_base: 'Lista de documentos disponíveis.',
    proximo_passo: 'Passar ao corretor para detalhes jurídicos.',
  },
];
