import { html, nothing, type TemplateResult } from 'lit';
import type { UrbiVersoAPI } from '@urbiverso/sdk';
import { CANAIS, OPCOES_PARADO_DIAS, PAPEIS, PAPEIS_NA_TELA, TEMPERATURAS } from '../comum/crm';
import { corQualidade, reais, ROTULO_TIPO_IMOVEL, SITUACAO_IMOVEL } from './apoio.js';

declare const urbiVerso: UrbiVersoAPI;

// Fundação visual (spec 2.6 princípio 14, 2.7, 11.5): o chip, o cartão de imóvel, o estado na URL
// e o padrão "uma ação principal + mais" que as telas compartilham, para nenhuma desenhar o seu.
// Reexportado por `apoio.ts`; as telas importam de lá.

type Cor = 'padrao' | 'sucesso' | 'erro' | 'alerta' | 'info';

export const TEMPERATURA: Record<(typeof TEMPERATURAS)[number], { rotulo: string; cor: Cor }> = {
  frio: { rotulo: 'Frio', cor: 'info' },
  morno: { rotulo: 'Morno', cor: 'alerta' },
  quente: { rotulo: 'Quente', cor: 'erro' },
};

export const ROTULO_PAPEL: Record<string, string> = {
  comprador: 'Comprador',
  proprietario: 'Proprietário',
  investidor: 'Investidor',
  parceiro: 'Parceiro',
  fornecedor: 'Fornecedor',
};

export const ROTULO_ORIGEM: Record<string, string> = {
  pagina: 'Minha página',
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  portal: 'Portal imobiliário',
  indicacao: 'Indicação',
  rede: 'Rede',
  incorporadora: 'Incorporadora',
  placa: 'Placa',
  evento: 'Evento',
  importacao: 'Importação',
  outro: 'Outro',
};

const COR_ETAPA: Record<string, Cor> = { aberta: 'info', ganha: 'sucesso', perdida: 'padrao' };

export type TipoChip = 'temperatura' | 'papel' | 'origem' | 'etapa';

/**
 * Rótulo e cor de um chip. Etapa é linha do banco (o nome é do corretor), então vem como
 * `{ nome, tipo }`; os demais são o valor gravado. Valor desconhecido sai cru, em `padrao`.
 */
export function rotuloChip(tipo: TipoChip, valor: string | { nome: string; tipo: string }): { rotulo: string; cor: Cor } {
  if (typeof valor !== 'string') return { rotulo: valor.nome, cor: COR_ETAPA[valor.tipo] ?? 'padrao' };
  if (tipo === 'temperatura') return TEMPERATURA[valor as keyof typeof TEMPERATURA] ?? { rotulo: valor, cor: 'padrao' };
  const rotulos = tipo === 'papel' ? ROTULO_PAPEL : tipo === 'origem' ? ROTULO_ORIGEM : {};
  return { rotulo: rotulos[valor] ?? valor, cor: 'padrao' };
}

/** Opções de `urbi-select` na ordem do catálogo. Etapa não tem catálogo fixo. */
export function opcoesChip(tipo: Exclude<TipoChip, 'etapa'>): { valor: string; rotulo: string }[] {
  const valores: readonly string[] = tipo === 'temperatura' ? TEMPERATURAS : tipo === 'papel' ? PAPEIS : CANAIS;
  return valores.map((valor) => ({ valor, rotulo: rotuloChip(tipo, valor).rotulo }));
}

/** Papéis do filtro e do cadastro: só comprador e proprietário (spec 15.9, S11). */
export const opcoesPapelNaTela = () => PAPEIS_NA_TELA.map((valor) => ({ valor, rotulo: ROTULO_PAPEL[valor] }));

/** "Sem contato há N dias", iguais na Lista e no Quadro de Clientes. */
export const opcoesParado = () => OPCOES_PARADO_DIAS.map((d) => ({ valor: String(d), rotulo: `${d} dias` }));

/** Chip (`urbi-badge`) de temperatura, papel, origem ou etapa; `motivo` vai no `title`. Sem valor, nada. */
export function chip(tipo: TipoChip, valor: string | { nome: string; tipo: string } | null | undefined, motivo?: string | null) {
  if (!valor) return nothing;
  const { rotulo, cor } = rotuloChip(tipo, valor);
  // Texto que a app não controla (nome da etapa, valor fora do catálogo) pede `quebra-linha` (ui-componentes-conteudo, badge).
  const livre = typeof valor !== 'string' || rotulo === valor;
  return html`<urbi-badge cor=${cor} title=${motivo ?? nothing} ?quebra-linha=${livre}>${rotulo}</urbi-badge>`;
}

// Estado na URL (overview.md § Navegação SPA): a sub-rota vem de `href(subRota())`, a query é da
// tela. `replaceState` para filtro não empilhar uma entrada de histórico a cada tecla.

/** Aplica as mudanças: valor vazio tira a chave; `tirar` limpa chaves que a mudança invalida (a página, por exemplo). */
export function aplicarFiltros(filtros: URLSearchParams, mudancas: Record<string, string | number | null | undefined>, tirar: string[] = []) {
  for (const [k, v] of Object.entries(mudancas)) {
    if (v === null || v === undefined || v === '') filtros.delete(k);
    else filtros.set(k, String(v));
  }
  for (const k of tirar) filtros.delete(k);
  return filtros;
}

/** Endereço da sub-rota atual (ou de `rota`) com a query dada. */
export function urlComFiltros(filtros: URLSearchParams, rota = urbiVerso.subRota()) {
  const qs = filtros.toString();
  return `${urbiVerso.href(rota)}${qs ? `?${qs}` : ''}`;
}

/** Filtros da URL atual, para a tela guardar e passar a `filtrosNaUrl`. */
export const filtrosDaUrl = () => new URLSearchParams(window.location.search);

/** Aplica as mudanças em `filtros` e as reflete na URL sem empilhar histórico. */
export function filtrosNaUrl(filtros: URLSearchParams, mudancas: Record<string, string | number | null | undefined> = {}, tirar: string[] = []) {
  aplicarFiltros(filtros, mudancas, tirar);
  history.replaceState(history.state, '', urlComFiltros(filtros));
  return filtros;
}

export interface OpcoesAba {
  /** Parâmetro da query que guarda a aba (padrão `aba`; Clientes usa `visao`). */
  chave?: string;
  /** Caminho antigo → aba que ele abre (`/funil` → `quadro`), quando a query não diz. */
  apelidos?: Record<string, string>;
  /** Rota canônica da tela: gravar a aba num apelido leva a barra para ela. */
  rota?: string;
}

/** Sub-rota atual sem a barra final (`/funil/` e `/funil` são o mesmo endereço). */
const subAtual = () => urbiVerso.subRota().replace(/(.)\/+$/, '$1') || '/';

/** Aba do `urbi-abas` lida da query, depois do apelido do caminho; fora da lista, a primeira (pedido ao shell 8). */
export function abaDaUrl(abas: string[], { chave = 'aba', apelidos = {} }: OpcoesAba = {}) {
  const aba = filtrosDaUrl().get(chave) ?? apelidos[subAtual()] ?? '';
  return abas.includes(aba) ? aba : abas[0];
}

/** Reflete a aba escolhida na query (vazia tira a chave), mantendo os demais parâmetros. */
export function abaNaUrl(aba: string, { chave = 'aba', rota }: OpcoesAba = {}) {
  const filtros = aplicarFiltros(filtrosDaUrl(), { [chave]: aba });
  history.replaceState(history.state, '', urlComFiltros(filtros, rota));
  return filtros;
}

// Cartão de imóvel nas telas autenticadas: `urbi-card` + `urbi-avatar` grande como capa. Exceção
// nomeada D-65 até o shell oferecer cartão com capa (pedidos ao shell, item 7).

export interface ImovelCartao {
  id: number;
  codigo: string;
  titulo: string | null;
  tipo: string;
  situacao: string;
  bairro: string | null;
  cidade: string | null;
  preco_c: number | null;
  capa_url: string | null;
  quartos?: number | null;
  area_util_m2?: number | null;
  area_total_m2?: number | null;
  vagas?: number | null;
  publicavel?: boolean;
  qualidade?: { nota: number };
}

export function cartaoImovel(i: ImovelCartao, aoAbrir?: (i: ImovelCartao) => void): TemplateResult {
  const s = SITUACAO_IMOVEL[i.situacao] ?? { rotulo: i.situacao, cor: 'padrao' };
  const area = i.area_util_m2 ?? i.area_total_m2;
  const local = [i.bairro, i.cidade].filter(Boolean).join(', ');
  const numeros = [
    i.quartos ? { icone: 'fa-solid fa-bed', texto: `${i.quartos} ${i.quartos === 1 ? 'quarto' : 'quartos'}` } : null,
    area ? { icone: 'fa-solid fa-ruler-combined', texto: `${area} m²` } : null,
    i.vagas ? { icone: 'fa-solid fa-car', texto: `${i.vagas} ${i.vagas === 1 ? 'vaga' : 'vagas'}` } : null,
  ].filter((n): n is { icone: string; texto: string } => n !== null);
  return html`<urbi-card expandir ?clicavel=${!!aoAbrir} titulo=${`${i.codigo} · ${i.titulo ?? ROTULO_TIPO_IMOVEL[i.tipo] ?? i.tipo}`}
    @urbi:card-click=${() => aoAbrir?.(i)}>
    <urbi-stack>
      <urbi-avatar nome=${i.codigo} foto=${i.capa_url ?? ''} icone=${i.capa_url ? '' : 'fa-solid fa-image'} tamanho="160"></urbi-avatar>
      <urbi-prosa papel="secao">${i.preco_c ? reais(i.preco_c) : 'sob consulta'}</urbi-prosa>
      ${local ? html`<urbi-prosa papel="secundario">${local}</urbi-prosa>` : nothing}
      ${numeros.length
        ? html`<urbi-linha quebrar>${numeros.map((n) => html`<urbi-icone classe=${n.icone}></urbi-icone><urbi-prosa inline>${n.texto}</urbi-prosa>`)}</urbi-linha>`
        : nothing}
      <urbi-linha quebrar>
        <urbi-badge cor=${s.cor}>${s.rotulo}</urbi-badge>
        ${i.publicavel ? html`<urbi-badge cor="sucesso">Na página</urbi-badge>` : nothing}
        ${i.qualidade ? html`<urbi-badge cor=${corQualidade(i.qualidade.nota)} title="Qualidade do anúncio">${i.qualidade.nota}</urbi-badge>` : nothing}
      </urbi-linha>
    </urbi-stack>
  </urbi-card>`;
}

// Uma ação principal + "mais" (princípio 14): o botão do que se faz quase sempre, e o resto num
// `urbi-dropdown`. Cada item ouve o próprio `urbi:dropdown-select`.

export interface Acao {
  rotulo: string;
  icone?: string;
  perigo?: boolean;
  /** Link para sub-rota da app (só na ação principal). */
  sub?: string;
  aoEscolher?: () => void;
}

export function acoesComMais(principal: Acao, secundarias: Acao[]): TemplateResult {
  const botao = principal.sub
    ? html`<urbi-botao icone=${principal.icone ?? nothing} href=${urbiVerso.href(principal.sub)}>${principal.rotulo}</urbi-botao>`
    : html`<urbi-botao icone=${principal.icone ?? nothing} @click=${() => principal.aoEscolher?.()}>${principal.rotulo}</urbi-botao>`;
  return html`<urbi-linha>
    ${botao}
    ${secundarias.length
      ? html`<urbi-dropdown flutuante>
          <urbi-botao slot="trigger" variante="secundario" icone="fa-solid fa-ellipsis">Mais</urbi-botao>
          <div slot="menu">
            ${secundarias.map(
              (a) => html`<urbi-dropdown-item icone=${a.icone ?? nothing} ?perigo=${!!a.perigo}
                @urbi:dropdown-select=${() => (a.sub ? urbiVerso.navegarSub(a.sub) : a.aoEscolher?.())}>${a.rotulo}</urbi-dropdown-item>`,
            )}
          </div>
        </urbi-dropdown>`
      : nothing}
  </urbi-linha>`;
}
