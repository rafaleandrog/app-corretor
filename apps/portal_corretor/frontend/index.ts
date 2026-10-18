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

  static styles = css`
    :host { display: block; padding: var(--espaco-4, 1rem); color: var(--cor-texto); }
    .diagnostico { text-align: center; color: var(--cor-texto-fraco); }
  `;

  async connectedCallback() {
    super.connectedCallback();
    try {
      this.status = await urbiVerso.api('/status');
    } catch {
      this.erro = true;
    }
  }

  render() {
    if (this.erro) {
      return html`<urbi-estado-vazio icone="fa-solid fa-triangle-exclamation"
        mensagem="Não foi possível falar com o servidor do app"
        submensagem="Recarregue a página. Se continuar, avise a equipe pelo botão de ajuda."></urbi-estado-vazio>`;
    }
    if (!this.status) {
      return html`<urbi-loading></urbi-loading>`;
    }
    return html`<urbi-estado-vazio icone="fa-solid fa-house"
      mensagem="${this.status.nome} em construção"
      submensagem="Versão ${this.status.versao}. As telas chegam nos próximos blocos do plano."></urbi-estado-vazio>
      <!-- Diagnóstico do bloco 0 (P-36): mostra a sub-rota e a query com que a tela foi aberta. -->
      <p class="diagnostico">Endereço desta tela: ${window.location.pathname}${window.location.search}</p>`;
  }
}
