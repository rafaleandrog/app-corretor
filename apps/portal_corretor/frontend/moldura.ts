import { html, nothing, type TemplateResult } from 'lit';
import { soNegociador } from './apoio.js';
import { alternarAssistente, assistenteAberto, painelAssistente } from './telas/assistente.js';

// Moldura do Padrão B na página do shell (spec 11.0.1 a 11.0.3, D-114; `specs/layout/README.md` v2):
//
//   urbi-shell-page (index.ts, modo dashboard)   barra e cabeçalho do shell, com o Criar; o menu é o
//                                                `nav` do manifesto — a app NÃO desenha trilho próprio
//     urbi-3-colunas                             lista (360 px fixos) · foco (flexível) · contexto (340 px
//                                                fixos); abas no celular; `urbi-2x1` quando a tela tem
//                                                só foco e contexto
//
// O botão Assistente fica no fim do cabeçalho da coluna esquerda de toda tela (`botaoAssistenteColuna`,
// D-114); aberto, o Assistente ocupa a coluna de contexto (D-109). Só primitivos, sem CSS estrutural:
// as larguras são atributos do `urbi-3-colunas`, e os tamanhos (botão 34 px, campo 36 px, raio 12) são
// os dos primitivos (D-115).

export interface OpcoesMoldura {
  /** Item do menu ativo (a rota do `MENU`); hoje só identifica a tela para o estado do celular. */
  menu: string;
  /** Coluna esquerda, "o que existe". Sem ela, só foco e contexto. */
  lista?: unknown;
  /** Centro, "o que estou fazendo". */
  centro: unknown;
  /**
   * O `centro` já vem com `slot="centro"` em cada filho e a moldura não o embrulha num `urbi-hospedeiro`.
   * Para o par lista de mensagens + compositor: o fill só se mantém no filho DIRETO do container com
   * altura (ui-componentes-conteudo.md § Onde pôr o par feed + redator). Só vale com `lista`
   * (`urbi-3-colunas`); no `urbi-2x1` o centro segue embrulhado.
   */
  centroSolto?: boolean;
  /** Direita, "o que eu preciso saber para decidir". O Assistente aberto ocupa o lugar dela. */
  contexto?: unknown;
  /** Rótulos das abas do celular. */
  rotulos?: { lista?: string; centro?: string; contexto?: string };
  /** Coluna aberta no celular (padrão: o centro). Clientes sem cliente escolhido abre na lista. */
  painel?: 'esquerda' | 'centro' | 'direita';
}

/** Larguras da moldura v2 (`specs/layout/README.md` § 3): lista e contexto fixos, o centro fica com o resto. */
export const LARGURAS = { lista: '360px', contexto: '340px', assistente: '380px' } as const;

/**
 * O botão Assistente do cabeçalho da coluna esquerda (D-114): 34 × 34 (o `urbi-botao` sem `pequeno`, que
 * tem 25 px; README v2 § 3), só ícone, fundo da IA quando aberto. A tela o põe no fim da linha do título. O negociador humano (D7) não tem Assistente.
 */
export function botaoAssistenteColuna(): TemplateResult | typeof nothing {
  if (soNegociador()) return nothing;
  const aberto = assistenteAberto();
  return html`<urbi-botao variante=${aberto ? 'primario' : 'secundario'} icone="fa-solid fa-wand-magic-sparkles"
    ariaLabel=${aberto ? 'Fechar o Assistente' : 'Abrir o Assistente'} title="Assistente (A)" @click=${() => alternarAssistente()}></urbi-botao>`;
}

/**
 * Cabeçalho da coluna esquerda: o título à esquerda e, à direita, as ações da tela e o Assistente
 * (referência P02: "Conversas · [Nova] [✦]"). Toda tela da moldura usa isto na primeira linha da lista.
 */
export function cabecalhoColuna(titulo: unknown, acoes?: unknown): TemplateResult {
  return html`<urbi-linha justificar="entre" alinhar="centro">
    <urbi-prosa papel="titulo">${titulo}</urbi-prosa>
    <urbi-linha>${acoes ?? nothing}${botaoAssistenteColuna()}</urbi-linha>
  </urbi-linha>`;
}

/** Coluna com respiro, que enche e rola por dentro (o `urbi-hospedeiro` é o dono do respiro). */
const coluna = (slot: string, conteudo: unknown) => html`<urbi-hospedeiro slot=${slot} expandir>${conteudo}</urbi-hospedeiro>`;

/**
 * Coluna da direita com o Assistente aberto: o chat é filho direto do painel, com `expandir`, para
 * manter o fill no celular (ui-componentes-conteudo.md § Layout do chat). No `urbi-2x1` o topo vai na
 * zona fixa `direita-topo` (ui-componentes-layout.md § urbi-2x1); o `urbi-3-colunas` não tem zona de
 * topo, então o topo é irmão de altura natural do chat no slot (a coluna é `.slot-wrapper`: o filho
 * `[expandir]` enche o que sobra, ui.md política de slot).
 */
function direitaAssistente(slotTopo: 'direita-topo' | 'direita') {
  const { topo, chat } = painelAssistente();
  return html`<urbi-hospedeiro slot=${slotTopo}>${topo}</urbi-hospedeiro>${chat}`;
}

/** A direita sem nada escolhido: a coluna existe (D-114) e diz o que a preenche. */
const contextoVazio = () => html`<urbi-estado-vazio expandir icone="fa-regular fa-hand-pointer" mensagem="Escolha um item" submensagem="O contexto dele aparece aqui."></urbi-estado-vazio>`;

function colunas(op: OpcoesMoldura): TemplateResult {
  const aberto = assistenteAberto() && !soNegociador();
  const r = op.rotulos ?? {};
  if (op.lista === undefined) {
    return html`<urbi-2x1>
      ${coluna('esquerda', op.centro)}
      ${aberto ? direitaAssistente('direita-topo') : op.contexto === undefined ? nothing : coluna('direita', op.contexto)}
    </urbi-2x1>`;
  }
  const contexto = op.contexto === undefined || op.contexto === nothing ? contextoVazio() : op.contexto;
  return html`<urbi-3-colunas
    largura-esquerda=${LARGURAS.lista} largura-direita=${aberto ? LARGURAS.assistente : LARGURAS.contexto}
    label-esquerda=${r.lista ?? 'Lista'} label-centro=${r.centro ?? 'Foco'} label-direita=${aberto ? 'Assistente' : (r.contexto ?? 'Contexto')}
    painel-ativo=${aberto ? 'direita' : (op.painel ?? 'centro')}>
    ${coluna('esquerda', op.lista)}
    ${op.centroSolto ? op.centro : coluna('centro', op.centro)}
    ${aberto ? direitaAssistente('direita') : coluna('direita', contexto)}
  </urbi-3-colunas>`;
}

/** A moldura de uma tela do corretor. `atualizar` redesenha o app (Assistente, celular). */
export function moldura(op: OpcoesMoldura, _atualizar: () => void): TemplateResult {
  return colunas(op);
}

/**
 * Tela que ainda não está na moldura: o Assistente aberto divide a página com ela, foco à esquerda e
 * Assistente à direita. Fechado, a tela segue como sempre foi.
 */
export function comAssistente(tela: unknown): unknown {
  if (!assistenteAberto() || soNegociador()) return tela;
  return html`<urbi-2x1>${coluna('esquerda', tela)}${direitaAssistente('direita-topo')}</urbi-2x1>`;
}
