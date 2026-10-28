import { html, nothing, type TemplateResult } from 'lit';
import type { UrbiAtalhoTrilho, UrbiVersoAPI } from '@urbiverso/sdk';
import { MENU } from './enderecos.js';
import { alternarAssistente, assistenteAberto, painelAssistente } from './telas/assistente.js';

declare const urbiVerso: UrbiVersoAPI;

// Moldura do Padrão B (spec 11.0.1 a 11.0.3, 11.9): trilho · lista · foco · contexto, montada só com
// primitivos e sem CSS estrutural (ui-componentes-layout.md):
//
//   urbi-inbox                         raiz; sidebar sem largura, só o trilho à esquerda
//     urbi-trilho-atalhos              slot="sidebar-trilho": o menu e o Assistente
//     urbi-3-colunas (slot="detalhe")  lista · foco · contexto, redimensionáveis e colapsáveis,
//                                      abas no celular; `urbi-2x1` quando a tela tem só foco e contexto
//
// É função, não elemento: o `urbi-inbox` vai direto no body do `urbi-shell-page` e auto-declara o
// fill e o scroll por dentro. Um elemento próprio em volta precisaria estender `UrbiPainelBase` para
// manter esse contrato no celular, e a app não importa valor de `@urbiverso/ui` (KIT.md).
//
// Trilho: o externo (o corretor) não abre o menu de navegação da app na topbar reduzida (gap
// documentado em permissoes.md § Usuário externo), e a app não sabe o tipo de quem está vendo. Então
// o trilho mostra os itens do menu, sempre, mais o Assistente; quem também vê o menu do shell o tem
// duas vezes até o gap fechar. O Criar fica no cabeçalho da página (`menuCriar`): o trilho só emite
// clique, não ancora o `urbi-dropdown`.

export interface OpcoesMoldura {
  /** Item do menu ativo no trilho (a rota do `MENU`). */
  menu: string;
  /** Coluna esquerda, "o que existe". Sem ela, só foco e contexto. */
  lista?: unknown;
  /** Centro, "o que estou fazendo". */
  centro: unknown;
  /** Direita, "o que eu preciso saber para decidir". O Assistente aberto ocupa o lugar dela. */
  contexto?: unknown;
  /** Rótulos das abas do celular. */
  rotulos?: { lista?: string; centro?: string; contexto?: string };
  /** Coluna aberta no celular (padrão: o centro). Clientes sem cliente escolhido abre na lista. */
  painel?: 'esquerda' | 'centro' | 'direita';
}

/** No celular o inbox mostra um painel por vez: o trilho ("Menu") ou as colunas. */
const estado = { menuNoCelular: false, ultimoMenu: null as string | null };

/** Itens do trilho: o menu do corretor (D-103) e o Assistente (D-109). */
export function itensDoTrilho(menu: string): UrbiAtalhoTrilho[] {
  return [
    ...MENU.map((m) => ({ id: m.rota, icone: m.icone, rotulo: m.titulo, ativo: !assistenteAberto() && m.rota === menu })),
    { id: 'assistente', icone: 'fa-solid fa-comments', rotulo: 'Assistente', ativo: assistenteAberto() },
  ];
}

function aoAtalho(e: CustomEvent, atualizar: () => void) {
  const id = String(e.detail?.id ?? '');
  estado.menuNoCelular = false;
  if (id === 'assistente') alternarAssistente();
  else if (id) urbiVerso.navegarSub(id);
  atualizar();
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

function colunas(op: OpcoesMoldura): TemplateResult {
  const aberto = assistenteAberto();
  const r = op.rotulos ?? {};
  if (op.lista === undefined) {
    return html`<urbi-2x1 slot="detalhe">
      ${coluna('esquerda', op.centro)}
      ${aberto ? direitaAssistente('direita-topo') : op.contexto === undefined ? nothing : coluna('direita', op.contexto)}
    </urbi-2x1>`;
  }
  // Larguras do guia (telas_padrao_b.md §2): lista 340–380, contexto 300–360, Assistente 380–440.
  // Sem contexto (o Funil de Clientes), a direita fica recolhida e o centro ganha a largura.
  return html`<urbi-3-colunas slot="detalhe" redimensionavel colapsavel-esquerda colapsavel-direita
    ?colapsada-direita=${!aberto && op.contexto === undefined}
    largura-esquerda="360px" largura-direita=${aberto ? '400px' : '320px'}
    largura-min-esquerda="260px" largura-max-esquerda="40%" largura-min-direita="280px" largura-max-direita="45%"
    label-esquerda=${r.lista ?? 'Lista'} label-centro=${r.centro ?? 'Foco'} label-direita=${aberto ? 'Assistente' : (r.contexto ?? 'Contexto')}
    painel-ativo=${aberto ? 'direita' : (op.painel ?? 'centro')}>
    ${coluna('esquerda', op.lista)}
    ${coluna('centro', op.centro)}
    ${aberto ? direitaAssistente('direita') : coluna('direita', op.contexto ?? nothing)}
  </urbi-3-colunas>`;
}

/** A moldura de uma tela do corretor. `atualizar` redesenha o app (trilho, Assistente, celular). */
export function moldura(op: OpcoesMoldura, atualizar: () => void): TemplateResult {
  // Tela diferente da última desenhada (Criar, link, botão do navegador): o celular volta às colunas.
  if (estado.ultimoMenu !== op.menu) estado.menuNoCelular = false;
  estado.ultimoMenu = op.menu;
  return html`<urbi-inbox largura-sidebar="0px" largura-min-sidebar="0px" sem-redimensionar texto-voltar="Menu"
    ?detalhe-visivel=${!estado.menuNoCelular}
    @urbi:inbox-voltar=${() => ((estado.menuNoCelular = true), atualizar())}>
    <urbi-trilho-atalhos slot="sidebar-trilho" rotulo="Menu do Portal do Corretor" .itens=${itensDoTrilho(op.menu)}
      @urbi:atalho-click=${(e: CustomEvent) => aoAtalho(e, atualizar)}></urbi-trilho-atalhos>
    ${colunas(op)}
  </urbi-inbox>`;
}

/**
 * Tela que ainda não está na moldura (migram nos itens B2 a B9): o Assistente aberto divide a página
 * com ela, foco à esquerda e Assistente à direita. Fechado, a tela segue como sempre foi.
 */
export function comAssistente(tela: unknown): unknown {
  if (!assistenteAberto()) return tela;
  return html`<urbi-2x1>${coluna('esquerda', tela)}${direitaAssistente('direita-topo')}</urbi-2x1>`;
}
