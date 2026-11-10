import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { keyed } from 'lit/directives/keyed.js';
import type { UrbiVersoAPI } from '@urbiverso/sdk';
import { aoAbrirHoje, renderHoje } from './telas/inicio.js';
import './telas/corretores.js';
import { renderClientes, renderNegociacoes } from './telas/clientes.js';
import { renderConversas } from './telas/conversas.js';
import { renderHojeNegociador } from './telas/negociacoes.js';
import { aoAbrirImportar, renderImportar } from './telas/importar.js';
import { renderImoveis } from './telas/imoveis.js';
import { renderNovoImovel } from './telas/novo-imovel.js';
import { aoAbrirNumeros, renderNumeros } from './telas/desempenho.js';
import { aoAbrirPagina, renderPagina } from './telas/pagina.js';
import './telas/previa-pagina.js';
import { renderEstudio } from './telas/estudio.js';
import { aoAbrirAjustes, renderAjustes } from './telas/ajustes.js';
import { abrirAssistente, aoMudarAssistente, contaDoAssistente, lembrarTela } from './telas/assistente.js';
import { destinoDoNegociador, fichaCanonica, negociacoesCanonica, normalizar, resolverEndereco, type ChaveTela } from './enderecos.js';
import { comAssistente } from './moldura.js';
import { botaoAssistente, menuCriar } from './criar.js';
import { instalarAtalhos } from './atalhos.js';
import { contaDeTrabalho, contasDoUsuario, ehContextoDoApp, escolherConta, semConta, soNegociador } from './apoio.js';
import './publico/pagina-publica.js';
import './publico/link.js';
import './publico/selecao.js';

declare const urbiVerso: UrbiVersoAPI;

type Papel = 'corretor' | 'operacao' | 'negociador';

interface Tela {
  titulo: string;
  papel: Papel;
  /** Outros papéis que também abrem a tela (o negociador humano em Hoje e Negociações, D7). */
  tambem?: Papel[];
  /**
   * `app` é o componente raiz: telas montadas direto no body da página pedem redesenho a ele. `chave` lê a
   * chave VIGENTE do `keyed` de `conteudo` (endereço, conta e visita): a tela com estado de instância (o
   * Estúdio) guarda a de quando nasceu e, quando ela muda, sabe que já não é a tela da página.
   */
  render: (param?: string, app?: LitElement, chave?: () => string) => unknown;
  /** A tela já vem na moldura do Padrão B (lista, foco, contexto): o Assistente abre dentro dela. */
  moldura?: boolean;
  /** Tela que guarda os dados fora do componente: a cada entrada (e troca de conta) eles são relidos. */
  aoAbrir?: () => void;
}

// Uma entrada por tela; os endereços (com os apelidos antigos) estão em `enderecos.ts`. A tela só
// abre para quem tem o papel; o backend barra de novo.
const TELAS: Record<ChaveTela, Tela> = {
  // O negociador humano (D7, spec 11.6) tem o seu Hoje: as negociações atribuídas a ele.
  hoje: { titulo: 'Hoje', papel: 'corretor', moldura: true, aoAbrir: aoAbrirHoje, tambem: ['negociador'],
    render: (_p, app) => (soNegociador() ? renderHojeNegociador(() => app?.requestUpdate()) : renderHoje(() => app?.requestUpdate())) },
  negociacoes: { titulo: 'Negociações', papel: 'corretor', tambem: ['negociador'], moldura: true, render: (_p, app) => renderNegociacoes(() => app?.requestUpdate()) },
  // Conversas (P02, D-116): a caixa de conversas do corretor; o item fica em `?item=`.
  conversas: { titulo: 'Conversas', papel: 'corretor', moldura: true, render: (_p, app) => renderConversas(() => app?.requestUpdate()) },
  clientes: { titulo: 'Clientes', papel: 'corretor', moldura: true, render: (_p, app) => renderClientes(() => app?.requestUpdate()) },
  importar: { titulo: 'Importar contatos', papel: 'corretor', moldura: true, aoAbrir: aoAbrirImportar, render: (_p, app) => renderImportar(() => app?.requestUpdate()) },
  // `/clientes/:id` é apelido: `chegar` troca o endereço por `/clientes?item=:id` antes de desenhar.
  cliente: { titulo: 'Clientes', papel: 'corretor', moldura: true, render: (_p, app) => renderClientes(() => app?.requestUpdate()) },
  imoveis: { titulo: 'Imóveis', papel: 'corretor', moldura: true, render: (_p, app) => renderImoveis(() => app?.requestUpdate()) },
  // Novo imóvel em 4 passos (P07, M3), na moldura: passos à esquerda, o passo no centro, a qualidade à direita.
  novo_imovel: { titulo: 'Novo imóvel', papel: 'corretor', moldura: true, render: (_p, app) => renderNovoImovel(() => app?.requestUpdate()) },
  // A ficha abre na moldura de Imóveis, com o item já escolhido (P06).
  imovel: { titulo: 'Imóveis', papel: 'corretor', moldura: true, render: (id, app) => renderImoveis(() => app?.requestUpdate(), { imovel: Number(id) || undefined }) },
  empreendimento: {
    titulo: 'Imóveis',
    papel: 'corretor',
    moldura: true,
    render: (id, app) => renderImoveis(() => app?.requestUpdate(), { empreendimento: Number(id) || undefined }),
  },
  // O Estúdio guarda o estado na instância da tela (estudio.ts): a chave de `conteudo` (endereço, conta e
  // visita) recria a instância na troca de conta, na navegação e na volta ao Estúdio. Sem `aoAbrir`.
  estudio: { titulo: 'Estúdio', papel: 'corretor', moldura: true, render: (_p, app, chave) => renderEstudio(() => app?.requestUpdate(), chave) },
  pagina: { titulo: 'Página', papel: 'corretor', moldura: true, aoAbrir: aoAbrirPagina, render: (_p, app) => renderPagina(() => app?.requestUpdate()) },
  numeros: { titulo: 'Números', papel: 'corretor', moldura: true, aoAbrir: aoAbrirNumeros, render: (_p, app) => renderNumeros(() => app?.requestUpdate()) },
  ajustes: { titulo: 'Ajustes', papel: 'corretor', moldura: true, aoAbrir: aoAbrirAjustes, render: (_p, app) => renderAjustes(() => app?.requestUpdate()) },
  corretores: { titulo: 'Corretores', papel: 'operacao', render: () => html`<pc-tela-corretores></pc-tela-corretores>` },
};

/**
 * Sem conta (#33): as telas do corretor trabalham dentro de uma conta. Para avaliar o app, a conta certa é
 * uma de demonstração, para não deixar perfil nem dados de teste na conta de um corretor real.
 */
export const MENSAGEM_SEM_CONTA_TELA =
  'As telas do corretor trabalham sempre dentro de uma conta, e nada é gravado sem ela. Para avaliar o app, associe seu usuário a uma conta de demonstração (nome terminado em “(demo)”) em Admin › Acesso › Contas, ou peça a quem cuida das contas da plataforma, e recarregue a página. Evite usar a conta de um corretor real: o que você salvar fica nela.';

// Tag fixa pela plataforma: `app-` + appId com hífens.
@customElement('app-portal-corretor')
export class AppPortalCorretor extends LitElement {
  @state() private sub = normalizar(urbiVerso.subRota());
  /** Cada navegação conta: voltar ao mesmo endereço (um pedido do Criar) recria a tela. */
  @state() private visita = 0;
  @state() private carregado = false;
  @state() private papeis: string[] = [];
  @state() private contas: { id: number; nome: string }[] = [];
  @state() private conta: number | null = null;
  @state() private semConta = false;
  private cancelarRota?: () => void;
  private desligarAtalhos?: () => void;
  // Contexto chega assíncrono: até `carregado`, roles vazias são falta de resposta, não de acesso.
  private aoMudarContexto = () => {
    const ctx = urbiVerso.contexto();
    const eraCarregado = this.carregado;
    this.carregado = ctx.carregado ?? false;
    // Admin do app vale por todos os papéis (o SDK não os entrega a ele): precisa ver e configurar tudo.
    this.papeis = ctx.nivel === 'admin' ? ['corretor', 'operacao'] : (ctx.roles ?? []);
    this.contas = contasDoUsuario();
    this.semConta = semConta();
    this.mudarConta();
    // O endereço foi decidido sem os papéis (negociador × corretor): decide de novo com os reais.
    if (this.carregado && !eraCarregado) this.chegar(normalizar(urbiVerso.subRota()));
  };

  // Só o contexto DESTE app (`detail.appId`): o de outra app, ou o de fora de app, não troca a conta daqui.
  private aoEventoContexto = (e: Event) => {
    if (ehContextoDoApp(e)) this.aoMudarContexto();
  };

  // Quem atende várias contas escolhe em qual está; a tela é recriada para recarregar daquela conta.
  private aoEscolherConta = (e: CustomEvent) => {
    escolherConta(Number(e.detail.valor));
    this.mudarConta();
  };

  /**
   * A conta de trabalho (`contaDeTrabalho`: a do seletor ou a conta única de escrita) é parte da chave da
   * tela. Mudou (o seletor, ou o contexto: o operador de conta única que tem a conta trocada, a conta que
   * sumiu): a tela é recriada pela chave nova, a que guarda dados fora do componente os relê (`aoAbrir`)
   * e a conversa do Assistente recomeça. Nada da conta anterior fica na página.
   */
  private mudarConta() {
    const conta = contaDeTrabalho();
    contaDoAssistente(conta);
    if (conta === this.conta) return;
    this.conta = conta;
    this.avisarTela(this.sub);
  }

  /** A tela do endereço que guarda dados fora do componente os relê (`aoAbrir`). */
  private avisarTela(sub: string) {
    const chave = resolverEndereco(sub).chave;
    if (chave) TELAS[chave].aoAbrir?.();
  }

  private seletorDeConta() {
    if (this.contas.length < 2) return nothing;
    return html`<urbi-select label="Conta" valor=${String(this.conta ?? '')}
      .opcoes=${this.contas.map((c) => ({ valor: String(c.id), rotulo: c.nome }))}
      @urbi:select-change=${this.aoEscolherConta}></urbi-select>`;
  }

  // Réplica local do contrato `:host` de tela raiz (ui.md § Cadeia de altura). App plugável não
  // importa `estiloPagina` de @urbiverso/ui; layout, respiro e tipografia ficam nos primitivos.
  static styles = css`
    :host { display: flex; flex-direction: column; height: 100%; min-height: 0; overflow: hidden; }
  `;

  connectedCallback() {
    super.connectedCallback();
    aoMudarAssistente(() => this.requestUpdate());
    this.chegar(normalizar(urbiVerso.subRota()));
    this.cancelarRota = urbiVerso.escutarRota((sub) => {
      this.visita++;
      this.chegar(normalizar(sub));
    });
    this.aoMudarContexto();
    window.addEventListener('urbi:contexto-app', this.aoEventoContexto);
    // Atalhos de teclado (11.0.6, B10): busca, Criar e Assistente só na área do corretor, com conta.
    this.desligarAtalhos = instalarAtalhos(() => this.papeis.includes('corretor') && !this.semConta && !soNegociador());
  }

  /** O Assistente responde pela tela em que o corretor está; `/assistente` abre Hoje com ele aberto. */
  private chegar(sub: string) {
    // Ficha pelo caminho antigo (`/clientes/7`): vira o cliente selecionado na Lista (P04), sem empilhar histórico.
    const ficha = fichaCanonica(sub, window.location.search);
    if (ficha) {
      history.replaceState(history.state, '', `${urbiVerso.href('/clientes')}${ficha}`);
      sub = '/clientes';
    }
    // Negociador humano (D7, D-125): a app abre direto nas Negociações atribuídas a ele, e qualquer outra
    // rota (Hoje, a área do corretor, `/assistente`) redireciona para lá, levando o `item` da notificação.
    if (soNegociador()) {
      const destino = destinoDoNegociador(sub, window.location.search);
      if (destino) {
        history.replaceState(history.state, '', `${urbiVerso.href('/negociacoes')}${destino.slice('/negociacoes'.length)}`);
        sub = '/negociacoes';
      }
    } else if (urbiVerso.contexto?.().carregado) {
      // P15 (D-96): para o corretor, `/negociacoes` é a visão Negociações de Clientes. Só com o contexto
      // carregado: antes, os papéis vêm vazios e o negociador humano seria confundido com corretor.
      const neg = negociacoesCanonica(sub, window.location.search);
      if (neg) {
        history.replaceState(history.state, '', `${urbiVerso.href('/clientes')}${neg}`);
        sub = '/clientes';
      }
    }
    this.sub = sub;
    this.avisarTela(sub);
    lembrarTela(sub);
    if (sub === '/assistente' && !soNegociador()) abrirAssistente();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.cancelarRota?.();
    this.desligarAtalhos?.();
    window.removeEventListener('urbi:contexto-app', this.aoEventoContexto);
  }

  private conteudo(tela: Tela | undefined, param?: string) {
    if (!this.carregado) return html`<urbi-loading></urbi-loading>`;
    if (!tela) {
      // O endereço recebido fica visível de propósito: é o diagnóstico do retorno de redirecionamento
      // (P-36, roteiro R.6). A query não volta por subRota() (overview.md). O menu do app não tem as
      // telas do corretor (D-113) e o externo nem o abre: o caminho é o início do app, que tem o menu no `nav` do shell.
      return html`<urbi-estado-vazio expandir icone="fa-solid fa-compass" mensagem="Página não encontrada"
        submensagem="Endereço recebido: ${this.sub}${window.location.search}. Abra o início do app (${urbiVerso.href('/')}) e escolha a tela no menu do app, no nome do app na barra do shell."></urbi-estado-vazio>`;
    }
    if (!this.liberada(tela)) {
      const quem = tela.papel === 'corretor' ? 'corretor' : 'equipe da plataforma (operacao)';
      return html`<urbi-estado-vazio expandir icone="fa-solid fa-lock" mensagem="Esta área não está liberada para você"
        submensagem="Ela é do papel ${quem}. Peça ao administrador do app para atribuir o papel em Configurações › Usuários."></urbi-estado-vazio>`;
    }
    // Sem conta não há carteira para mostrar: explica o que fazer em vez de cada tela dar erro.
    if (this.faltaConta(tela)) {
      return html`<urbi-estado-vazio expandir icone="fa-solid fa-building-user" mensagem="Você ainda não está em nenhuma conta"
        submensagem=${MENSAGEM_SEM_CONTA_TELA}></urbi-estado-vazio>`;
    }
    // `keyed` pelo endereço e pela navegação: trocar de cliente recria a tela em vez de reaproveitar o estado.
    const conteudo = keyed(this.chaveDaTela(), tela.render(param, this, this.chaveDaTela));
    // Telas fora da moldura (migram nos itens B2 a B9) dividem a página com o Assistente quando ele abre.
    return tela.papel === 'corretor' && !tela.moldura ? comAssistente(conteudo) : conteudo;
  }

  private liberada = (tela: Tela) => [tela.papel, ...(tela.tambem ?? [])].some((p) => this.papeis.includes(p));
  private faltaConta = (tela: Tela) => tela.papel !== 'operacao' && this.semConta;

  /**
   * A página mostra a moldura de fato (e não o carregando, a falta de papel ou de conta, que `conteudo`
   * desenha no lugar). Só aí ela vai sem o teto de 1200 px do `urbi-shell-page` (prop `dashboard`,
   * ui-componentes-layout.md), para as colunas usarem a área do app inteira (#164); o respiro continua
   * o do `.container` da página. Estados de página inteira e telas fora da moldura seguem com o teto.
   */
  private naMoldura = (tela: Tela | undefined) => !!tela?.moldura && this.carregado && this.liberada(tela) && !this.faltaConta(tela);

  /**
   * A chave da tela (`sub|conta|visita`): trocar de endereço, de conta (a de trabalho, inclusive a conta
   * única de escrita) ou navegar de novo recria a tela (`keyed`). O estado é da instância que nasceu com
   * a chave; a continuação assíncrona de uma instância antiga é descartada pelo guarda do envio
   * (`chamarApi` rejeita com `ContaTrocada`, apoio.ts) e, antes de enviar, pelo gesto da conta.
   */
  private chaveDaTela = () => `${this.sub}|${this.conta}|${this.visita}`;

  /** Criar em toda tela do corretor; o Assistente no cabeçalho só nas telas ainda fora da moldura (a moldura o põe na coluna esquerda). */
  private acoes(tela: Tela | undefined) {
    if (!tela || tela.papel !== 'corretor' || !this.papeis.includes('corretor') || this.semConta) return nothing;
    return html`${menuCriar()}${tela.moldura ? nothing : botaoAssistente()}`;
  }

  render() {
    // A equipe da plataforma não tem carteira: em Hoje ela cai direto na lista de corretores.
    const soEquipe = !this.papeis.includes('corretor') && this.papeis.includes('operacao');
    const { chave, param } = this.sub === '/' && soEquipe ? { chave: 'corretores' as const, param: undefined } : resolverEndereco(this.sub);
    const tela = chave ? TELAS[chave] : undefined;
    return html`<urbi-shell-page titulo=${tela?.titulo ?? 'Portal do Corretor'} ?dashboard=${this.naMoldura(tela)}>${this.acoes(tela)}${this.seletorDeConta()}${this.conteudo(tela, param)}</urbi-shell-page>`;
  }
}
