import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { UrbiVersoAPI } from '@urbiverso/sdk';
import './diagnostico.js';
import './telas/inicio.js';
import './telas/conta.js';
import './telas/corretores.js';

declare const urbiVerso: UrbiVersoAPI;

interface Tela {
  titulo: string;
  papel: 'corretor' | 'operacao';
  render: () => unknown;
}

// Uma entrada por rota do `nav`. A tela só abre para quem tem o papel; o backend barra de novo.
const TELAS: Record<string, Tela> = {
  '/': { titulo: 'Início', papel: 'corretor', render: () => html`<pc-tela-inicio></pc-tela-inicio>` },
  '/conta': { titulo: 'Conta e marca', papel: 'corretor', render: () => html`<pc-tela-conta></pc-tela-conta>` },
  '/corretores': { titulo: 'Corretores', papel: 'operacao', render: () => html`<pc-tela-corretores></pc-tela-corretores>` },
};

// Tag fixa pela plataforma: `app-` + appId com hífens.
@customElement('app-portal-corretor')
export class AppPortalCorretor extends LitElement {
  @state() private sub = urbiVerso.subRota();
  @state() private carregado = false;
  @state() private papeis: string[] = [];
  private cancelarRota?: () => void;
  // Contexto chega assíncrono: até `carregado`, roles vazias são falta de resposta, não de acesso.
  private aoMudarContexto = () => {
    const ctx = urbiVerso.contexto();
    this.carregado = ctx.carregado ?? false;
    this.papeis = ctx.roles ?? [];
  };

  // Réplica local do contrato `:host` de tela raiz (ui.md § Cadeia de altura). App plugável não
  // importa `estiloPagina` de @urbiverso/ui; layout, respiro e tipografia ficam nos primitivos.
  static styles = css`
    :host { display: flex; flex-direction: column; height: 100%; min-height: 0; overflow: hidden; }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.cancelarRota = urbiVerso.escutarRota((sub) => {
      this.sub = sub;
    });
    this.aoMudarContexto();
    window.addEventListener('urbi:contexto-app', this.aoMudarContexto);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.cancelarRota?.();
    window.removeEventListener('urbi:contexto-app', this.aoMudarContexto);
  }

  private conteudo(tela: Tela | undefined) {
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
    return tela.render();
  }

  render() {
    // A equipe da plataforma não tem carteira: no Início ela cai direto na lista de corretores.
    const soEquipe = !this.papeis.includes('corretor') && this.papeis.includes('operacao');
    const tela = this.sub === '/' && soEquipe ? TELAS['/corretores'] : TELAS[this.sub];
    return html`<urbi-shell-page titulo=${tela?.titulo ?? 'Portal do Corretor'}>${this.conteudo(tela)}</urbi-shell-page>`;
  }
}
