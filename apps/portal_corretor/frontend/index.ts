import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { keyed } from 'lit/directives/keyed.js';
import type { UrbiVersoAPI } from '@urbiverso/sdk';
import './telas/inicio.js';
import './telas/corretores.js';
import { renderClientes } from './telas/clientes.js';
import './telas/ficha-contato.js';
import './telas/importar.js';
import { renderImoveis } from './telas/imoveis.js';
import './telas/ficha-imovel.js';
import './telas/ficha-empreendimento.js';
import './telas/desempenho.js';
import './telas/pagina.js';
import './telas/estudio.js';
import { renderAjustes } from './telas/ajustes.js';
import { lembrarTela, renderAssistente } from './telas/assistente.js';
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
}

const AJUSTES: Tela = { titulo: 'Ajustes', papel: 'corretor', render: (_p, app) => renderAjustes(() => app?.requestUpdate()) };
const CLIENTES: Tela = { titulo: 'Clientes', papel: 'corretor', render: (_p, app) => renderClientes(() => app?.requestUpdate()) };
const IMOVEIS: Tela = { titulo: 'Imóveis', papel: 'corretor', render: (_p, app) => renderImoveis(() => app?.requestUpdate()) };

// Uma entrada por rota. A tela só abre para quem tem o papel; o backend barra de novo.
const INICIO: Tela = { titulo: 'Início', papel: 'corretor', render: () => html`<pc-tela-inicio></pc-tela-inicio>` };

const TELAS: Record<string, Tela> = {
  '/': INICIO,
  // Apelido: a Agenda virou a aba Agenda do Início (D-82).
  '/agenda': INICIO,
  '/clientes': CLIENTES,
  // Apelido: o Funil virou a visão Quadro de Clientes (D-83).
  '/funil': CLIENTES,
  '/clientes/importar': { titulo: 'Importar contatos', papel: 'corretor', render: () => html`<pc-tela-importar></pc-tela-importar>` },
  '/clientes/:id': { titulo: 'Cliente', papel: 'corretor', render: (id) => html`<pc-tela-ficha-contato .contatoId=${Number(id)}></pc-tela-ficha-contato>` },
  '/imoveis': IMOVEIS,
  '/imoveis/:id': { titulo: 'Imóvel', papel: 'corretor', render: (id) => html`<pc-tela-ficha-imovel .imovelId=${Number(id)}></pc-tela-ficha-imovel>` },
  // Apelido: Empreendimentos virou a aba Empreendimentos de Imóveis (D-84).
  '/empreendimentos': IMOVEIS,
  '/empreendimentos/:id': {
    titulo: 'Empreendimento',
    papel: 'corretor',
    render: (id) => html`<pc-tela-ficha-empreendimento .empreendimentoId=${Number(id)}></pc-tela-ficha-empreendimento>`,
  },
  '/desempenho': { titulo: 'Desempenho', papel: 'corretor', render: () => html`<pc-tela-desempenho></pc-tela-desempenho>` },
  '/pagina': { titulo: 'Minha página', papel: 'corretor', render: () => html`<pc-tela-pagina></pc-tela-pagina>` },
  '/estudio': { titulo: 'Estúdio', papel: 'corretor', render: () => html`<pc-tela-estudio></pc-tela-estudio>` },
  '/assistente': { titulo: 'Assistente', papel: 'corretor', render: (_p, app) => renderAssistente(() => app?.requestUpdate()) },
  '/ajustes': AJUSTES,
  // Apelidos: o SDK não redireciona, então os endereços antigos abrem Ajustes na aba certa.
  // `/ajustes/conexoes` é também o retorno do Instagram cadastrado na Meta (`?code=&state=`).
  '/conta': AJUSTES,
  '/ajustes/conta': AJUSTES,
  '/ajustes/marca': AJUSTES,
  '/ajustes/conexoes': AJUSTES,
  '/ajustes/funil': AJUSTES,
  '/ajustes/atendimento': AJUSTES,
  '/corretores': { titulo: 'Corretores', papel: 'operacao', render: () => html`<pc-tela-corretores></pc-tela-corretores>` },
};

/** Rota exata primeiro; depois as de parâmetro numérico (`/clientes/:id`, `/imoveis/:id`…). */
function resolver(sub: string): { tela?: Tela; param?: string } {
  if (TELAS[sub]) return { tela: TELAS[sub] };
  const m = sub.match(/^\/(clientes|imoveis|empreendimentos)\/(\d+)$/);
  return m ? { tela: TELAS[`/${m[1]}/:id`], param: m[2] } : {};
}

/** `/conta/` e `/conta` são a mesma tela; a raiz continua `/`. */
const normalizar = (sub: string) => (sub.length > 1 ? sub.replace(/\/+$/, '') : sub) || '/';

// Tag fixa pela plataforma: `app-` + appId com hífens.
@customElement('app-portal-corretor')
export class AppPortalCorretor extends LitElement {
  @state() private sub = normalizar(urbiVerso.subRota());
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
  };

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
    lembrarTela(this.sub);
    this.cancelarRota = urbiVerso.escutarRota((sub) => {
      this.sub = normalizar(sub);
      // O Assistente responde pela tela em que o corretor estava antes de abri-lo.
      lembrarTela(this.sub);
    });
    this.aoMudarContexto();
    window.addEventListener('urbi:contexto-app', this.aoMudarContexto);
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
    // `keyed` pelo endereço: trocar de cliente recria a tela em vez de reaproveitar o estado.
    return keyed(`${this.sub}|${this.conta}`, tela.render(param, this));
  }

  render() {
    // A equipe da plataforma não tem carteira: no Início ela cai direto na lista de corretores.
    const soEquipe = !this.papeis.includes('corretor') && this.papeis.includes('operacao');
    const { tela, param } = this.sub === '/' && soEquipe ? { tela: TELAS['/corretores'], param: undefined } : resolver(this.sub);
    return html`<urbi-shell-page titulo=${tela?.titulo ?? 'Portal do Corretor'}>${this.seletorDeConta()}${this.conteudo(tela, param)}</urbi-shell-page>`;
  }
}
