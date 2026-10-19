import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { UrbiVersoAPI } from '@urbiverso/sdk';
import './diagnostico.js';

declare const urbiVerso: UrbiVersoAPI;

interface Status {
  nome: string;
  versao: string;
}

// Tag fixa pela plataforma: `app-` + appId com hífens.
@customElement('app-portal-corretor')
export class AppPortalCorretor extends LitElement {
  @state() private status: Status | null = null;
  @state() private erro = false;

  // Réplica local do contrato `:host` de tela raiz (ui.md § Cadeia de altura). App plugável não
  // importa `estiloPagina` de @urbiverso/ui; layout, respiro e tipografia ficam nos primitivos.
  static styles = css`
    :host { display: flex; flex-direction: column; height: 100%; min-height: 0; overflow: hidden; }
  `;

  async connectedCallback() {
    super.connectedCallback();
    try {
      this.status = await urbiVerso.api('/status');
    } catch {
      this.erro = true;
    }
  }

  private conteudo() {
    if (this.erro) {
      return html`<urbi-estado-vazio expandir icone="fa-solid fa-triangle-exclamation"
        mensagem="Não foi possível falar com o servidor do app"
        submensagem="Recarregue a página. Se continuar, avise a equipe pelo botão de ajuda."></urbi-estado-vazio>`;
    }
    if (!this.status) {
      return html`<urbi-loading></urbi-loading>`;
    }
    return html`
      <urbi-estado-vazio expandir icone="fa-solid fa-house"
        mensagem="${this.status.nome} em construção"
        submensagem="Versão ${this.status.versao}. As telas chegam nos próximos blocos do plano."></urbi-estado-vazio>
      <!-- Diagnóstico do bloco 0 (P-36, sai quando a conexão com a Meta existir): sub-rota e query
           com que a tela foi aberta. A query não volta por subRota() (overview.md). -->
      <urbi-prosa papel="dica">Endereço desta tela: ${urbiVerso.subRota()}${window.location.search}</urbi-prosa>`;
  }

  render() {
    return html`<urbi-shell-page titulo="Portal do Corretor">${this.conteudo()}</urbi-shell-page>`;
  }
}
