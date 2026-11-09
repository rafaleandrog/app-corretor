// Ajustes no Padrão B (B8, spec 11.1 P11–P13): as seções do menu da esquerda e o endereço de cada uma.
// Puro, sem DOM: o frontend monta a tela e os testes conferem os apelidos.

/**
 * Seções na ordem da spec 11.1 (P11): Mensageiro · Negociador · Conexões · Conta e marca · Funil e
 * abordagens · Horário de atendimento · Privacidade. Plano e créditos não entra (D-87). O Mensageiro
 * ocupa o lugar sem configuração nenhuma: chega com o WhatsApp.
 */
export const ABAS_AJUSTES = [
  { id: 'mensageiro', label: 'Mensageiro', icone: 'fa-solid fa-comments' },
  { id: 'negociador', label: 'Negociador', icone: 'fa-solid fa-scale-balanced' },
  { id: 'conexoes', label: 'Conexões', icone: 'fa-solid fa-plug' },
  { id: 'conta', label: 'Conta e marca', icone: 'fa-solid fa-id-badge' },
  { id: 'funil', label: 'Funil e abordagens', icone: 'fa-solid fa-filter' },
  { id: 'atendimento', label: 'Horário de atendimento', icone: 'fa-solid fa-clock' },
  { id: 'privacidade', label: 'Privacidade', icone: 'fa-solid fa-user-shield' },
] as const;

export type AbaAjustes = (typeof ABAS_AJUSTES)[number]['id'];

/** A seção que abre quando o endereço não diz qual. */
export const ABA_PADRAO: AbaAjustes = 'conta';

/** Apelidos de seção: a Marca virou parte de Conta e marca (P13). */
const APELIDOS: Record<string, AbaAjustes> = { marca: 'conta' };

const IDS = new Set<string>(ABAS_AJUSTES.map((a) => a.id));
export const ehAbaAjustes = (id: string | null | undefined): id is AbaAjustes => !!id && IDS.has(id);

/** Seção de um id (`?aba=` ou `/ajustes/<id>`), com os apelidos; desconhecido: `null`. */
const secao = (id: string | null | undefined): AbaAjustes | null => (ehAbaAjustes(id) ? id : (id && APELIDOS[id]) || null);

/**
 * Seção que um endereço abre. O SDK não redireciona, então os endereços antigos continuam vivos como
 * apelidos: `/conta` abre Conta e marca, `/ajustes/<seção>` abre a seção (`/ajustes/marca` abre Conta e
 * marca), e `/ajustes/conexoes` segue sendo o retorno do Instagram cadastrado na Meta. Em `/ajustes`,
 * vale `?aba=`; sem ela, ou com uma desconhecida, Conta e marca.
 */
export function abaDoEndereco(sub: string, busca = ''): AbaAjustes | null {
  if (sub === '/conta') return 'conta';
  const m = sub.match(/^\/ajustes(?:\/([a-z_]+))?$/);
  if (!m) return null;
  if (m[1]) return secao(m[1]);
  return secao(new URLSearchParams(busca).get('aba')) ?? ABA_PADRAO;
}

/** O que o menu de Ajustes sabe da conta para a linha de estado de cada seção (P12, diagnóstico 3.10). */
export interface EstadoAjustes {
  negociador?: { ligado: boolean; estilo: string; conduz_padrao: string } | null;
  /** `indisponivel`: a instância não tem as credenciais da Meta (#30). */
  instagram?: 'conectado' | 'atencao' | 'desconectado' | 'indisponivel' | null;
  configuracoes?: { validade_selecao_dias: number; dias_cliente_parado: number } | null;
}

const ROTULO_ESTILO: Record<string, string> = { cooperativo: 'cooperativo', firme: 'firme', consultivo: 'consultivo' };

/**
 * A linha de baixo de cada item do menu de Ajustes ("ligado · texto" na referência). Com o estado da
 * conta lido, diz o que está valendo; sem ele (ainda carregando, ou a leitura falhou), o que a seção tem.
 */
export function linhaDeEstado(id: AbaAjustes, e: EstadoAjustes = {}): string {
  switch (id) {
    case 'mensageiro':
      return 'chega com o WhatsApp';
    case 'negociador':
      return e.negociador
        ? `${e.negociador.ligado ? 'ligado' : 'pausado'} · ${e.negociador.conduz_padrao === 'humano' ? 'uma pessoa' : 'IA'} · ${ROTULO_ESTILO[e.negociador.estilo] ?? e.negociador.estilo}`
        : 'propostas e contrapropostas';
    case 'conexoes':
      return e.instagram === 'conectado'
        ? 'Instagram conectado'
        : e.instagram === 'atencao'
          ? 'Instagram precisa de atenção'
          : e.instagram === 'indisponivel'
            ? 'Instagram e WhatsApp indisponíveis'
            : e.instagram === 'desconectado'
              ? 'nada conectado'
              : 'Instagram e WhatsApp';
    case 'conta':
      return 'perfil, CRECI, marca';
    case 'funil':
      return 'etapas e mensagens prontas';
    case 'atendimento':
      return e.configuracoes
        ? `parado em ${e.configuracoes.dias_cliente_parado} dias · seleção vale ${e.configuracoes.validade_selecao_dias}`
        : 'prazos do atendimento';
    case 'privacidade':
      return 'consentimentos e exportação';
  }
}
