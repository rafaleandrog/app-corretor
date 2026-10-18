import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { UrbiVersoAPI } from '@urbiverso/sdk';

declare const urbiVerso: UrbiVersoAPI;

// Página pública de diagnóstico do bloco 0 (sai no bloco 5). Responde, na instância, se a página
// declarada em `/p` abre também em `/p/<algo>` e em `/p?c=<algo>`, e se a rota pública aceita o mesmo.
// Página pública não usa tokens de tema: visual fixo.
@customElement('portal-corretor-diagnostico')
export class PortalCorretorDiagnostico extends LitElement {
  @state() private resposta = 'consultando…';

  static styles = css`
    :host { display: block; max-width: 40rem; margin: 2rem auto; padding: 0 1rem;
      font-family: system-ui, sans-serif; }
    code { word-break: break-all; }
  `;

  async connectedCallback() {
    super.connectedCallback();
    const resto = window.location.pathname.replace(/^\/portal_corretor\/p/, '');
    try {
      const r = await urbiVerso.api(`/pub/portal_corretor/diagnostico${resto}${window.location.search}`, { anonimo: true });
      this.resposta = JSON.stringify(r);
    } catch (e) {
      this.resposta = `falhou: ${(e as Error).message}`;
    }
  }

  render() {
    return html`
      <h1>Portal do Corretor — diagnóstico</h1>
      <p>Página aberta em <code>${window.location.pathname}${window.location.search}</code>.</p>
      <p>Rota pública respondeu: <code>${this.resposta}</code></p>
    `;
  }
}
