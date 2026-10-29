import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { keyed } from 'lit/directives/keyed.js';
import type { UrbiVersoAPI } from '@urbiverso/sdk';
import { aoAbrirHoje, renderHoje } from './telas/inicio.js';
import './telas/corretores.js';
import { renderClientes } from './telas/clientes.js';
import { aoAbrirImportar, renderImportar } from './telas/importar.js';
import { renderImoveis } from './telas/imoveis.js';
import { renderNumeros } from './telas/desempenho.js';
import './telas/pagina.js';
import './telas/estudio.js';
import { renderAjustes } from './telas/ajustes.js';
import { abrirAssistente, aoMudarAssistente, lembrarTela } from './telas/assistente.js';
import { fichaCanonica, normalizar, resolverEndereco, type ChaveTela } from './enderecos.js';
import { comAssistente } from './moldura.js';
import { botaoAssistente, menuCriar } from './criar.js';
import { contaAtiva, contasDoUsuario, escolherConta, semConta } from './apoio.js';
import './publico/pagina-publica.js';
import './publico/link.js';
import './publico/selecao.js';

declare const urbiVerso: UrbiVersoAPI;

interface Tela {
  titulo: string;
  papel: 'corretor' | 'operacao';
  /** `app` é o componente raiz: telas montadas direto no body da página pedem redesenho a ele. */
  render: (param?: string, app?: LitElement) => unknown;
  /** A tela já vem na moldura do Padrão B (trilho, lista, foco, contexto): o Assistente abre dentro dela. */
  moldura?: boolean;
  /** Tela que guarda os dados fora do componente: a cada entrada (e troca de conta) eles são relidos. */
  aoAbrir?: () => void;
}

// Uma entrada por tela; os endereços (com os apelidos antigos) estão em `enderecos.ts`. A tela só
// abre para quem tem o papel; o backend barra de novo.
const TELAS: Record<ChaveTela, Tela> = {
  hoje: { titulo: 'Hoje', papel: 'corretor', moldura: true, aoAbrir: aoAbrirHoje, render: (_p, app) => renderHoje(() => app?.requestUpdate()) },
  clientes: { titulo: 'Clientes', papel: 'corretor', moldura: true, render: (_p, app) => renderClientes(() => app?.requestUpdate()) },
  importar: { titulo: 'Importar contatos', papel: 'corretor', moldura: true, aoAbrir: aoAbrirImportar, render: (_p, app) => renderImportar(() => app?.requestUpdate()) },
  // `/clientes/:id` é apelido: `chegar` troca o endereço por `/clientes?item=:id` antes de desenhar.
  cliente: { titulo: 'Clientes', papel: 'corretor', moldura: true, render: (_p, app) => renderClientes(() => app?.requestUpdate()) },
  imoveis: { titulo: 'Imóveis', papel: 'corretor', moldura: true, render: (_p, app) => renderImoveis(() => app?.requestUpdate()) },
  // A ficha abre na moldura de Imóveis, com o item já escolhido (P06).
  imovel: { titulo: 'Imóveis', papel: 'corretor', moldura: true, render: (id, app) => renderImoveis(() => app?.requestUpdate(), { imovel: Number(id) || undefined }) },
  empreendimento: {
    titulo: 'Imóveis',
    papel: 'corretor',
    moldura: true,
    render: (id, app) => renderImoveis(() => app?.requestUpdate(), { empreendimento: Number(id) || undefined }),
  },
  estudio: { titulo: 'Estúdio', papel: 'corretor', render: () => html`<pc-tela-estudio></pc-tela-estudio>` },
  pagina: { titulo: 'Página', papel: 'corretor', render: () => html`<pc-tela-pagina></pc-tela-pagina>` },
  numeros: { titulo: 'Números', papel: 'corretor', moldura: true, render: (_p, app) => renderNumeros(() => app?.requestUpdate()) },
  ajustes: { titulo: 'Ajustes', papel: 'corretor', moldura: true, render: (_p, app) => renderAjustes(() => app?.requestUpdate()) },
  corretores: { titulo: 'Corretores', papel: 'operacao', render: () => html`<pc-tela-corretores></pc-tela-corretores>` },
};

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
  // Contexto chega assíncrono: até `carregado`, roles vazias são falta de resposta, não de acesso.
  private aoMudarContexto = () => {
    const ctx = urbiVerso.contexto();
    this.carregado = ctx.carregado ?? false;
    // Admin do app vale por todos os papéis (o SDK não os entrega a ele): precisa ver e configurar tudo.
    this.papeis = ctx.nivel === 'admin' ? ['corretor', 'operacao'] : (ctx.roles ?? []);
    this.contas = contasDoUsuario();
    this.conta = contaAtiva();
    this.semConta = semConta();
  };

  // Quem atende várias contas escolhe em qual está; a tela é recriada para recarregar daquela conta.
  private aoEscolherConta = (e: CustomEvent) => {
    escolherConta(Number(e.detail.valor));
    this.conta = contaAtiva();
    this.avisarTela(this.sub);
  };

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
    window.addEventListener('urbi:contexto-app', this.aoMudarContexto);
  }

  /** O Assistente responde pela tela em que o corretor está; `/assistente` abre Hoje com ele aberto. */
  private chegar(sub: string) {
    // Ficha pelo caminho antigo (`/clientes/7`): vira o cliente selecionado na Lista (P04), sem empilhar histórico.
    const ficha = fichaCanonica(sub, window.location.search);
    if (ficha) {
      history.replaceState(history.state, '', `${urbiVerso.href('/clientes')}${ficha}`);
      sub = '/clientes';
    }
    this.sub = sub;
    this.avisarTela(sub);
    lembrarTela(sub);
    if (sub === '/assistente') abrirAssistente();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.cancelarRota?.();
    window.removeEventListener('urbi:contexto-app', this.aoMudarContexto);
  }

  private conteudo(tela: Tela | undefined, param?: string) {
    if (!this.carregado) return html`<urbi-loading></urbi-loading>`;
    if (!tela) {
      // O endereço recebido fica visível de propósito: é o diagnóstico do retorno de redirecionamento
      // (P-36, roteiro R.6). A query não volta por subRota() (overview.md).
      return html`<urbi-estado-vazio expandir icone="fa-solid fa-compass" mensagem="Página não encontrada"
        submensagem="Endereço recebido: ${this.sub}${window.location.search}. Use o menu do app para escolher uma tela."></urbi-estado-vazio>`;
    }
    if (!this.papeis.includes(tela.papel)) {
      const quem = tela.papel === 'corretor' ? 'corretor' : 'equipe da plataforma (operacao)';
      return html`<urbi-estado-vazio expandir icone="fa-solid fa-lock" mensagem="Esta área não está liberada para você"
        submensagem="Ela é do papel ${quem}. Peça ao administrador do app para atribuir o papel em Configurações › Usuários."></urbi-estado-vazio>`;
    }
    // Sem conta não há carteira para mostrar: explica o que fazer em vez de cada tela dar erro.
    if (tela.papel === 'corretor' && this.semConta) {
      return html`<urbi-estado-vazio expandir icone="fa-solid fa-building-user" mensagem="Você ainda não está em nenhuma conta"
        submensagem="As telas do corretor trabalham sempre dentro de uma conta. Associe seu usuário a uma conta em Admin › Acesso › Contas (ou peça a quem cuida das contas da plataforma) e recarregue a página."></urbi-estado-vazio>`;
    }
    // `keyed` pelo endereço e pela navegação: trocar de cliente recria a tela em vez de reaproveitar o estado.
    const conteudo = keyed(`${this.sub}|${this.conta}|${this.visita}`, tela.render(param, this));
    // Telas fora da moldura (migram nos itens B2 a B9) dividem a página com o Assistente quando ele abre.
    return tela.papel === 'corretor' && !tela.moldura ? comAssistente(conteudo) : conteudo;
  }

  /** Criar em toda tela do corretor; o Assistente no cabeçalho só onde ainda não há trilho. */
  private acoes(tela: Tela | undefined) {
    if (!tela || tela.papel !== 'corretor' || !this.papeis.includes('corretor') || this.semConta) return nothing;
    return html`${menuCriar()}${tela.moldura ? nothing : botaoAssistente()}`;
  }

  render() {
    // A equipe da plataforma não tem carteira: em Hoje ela cai direto na lista de corretores.
    const soEquipe = !this.papeis.includes('corretor') && this.papeis.includes('operacao');
    const { chave, param } = this.sub === '/' && soEquipe ? { chave: 'corretores' as const, param: undefined } : resolverEndereco(this.sub);
    const tela = chave ? TELAS[chave] : undefined;
    return html`<urbi-shell-page titulo=${tela?.titulo ?? 'Portal do Corretor'}>${this.acoes(tela)}${this.seletorDeConta()}${this.conteudo(tela, param)}</urbi-shell-page>`;
  }
}
