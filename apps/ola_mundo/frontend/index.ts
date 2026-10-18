import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { UrbiVersoAPI } from '@urbiverso/sdk';

// O shell injeta este objeto na página. Só declaramos o tipo.
declare const urbiVerso: UrbiVersoAPI;

// A tag NÃO é livre: é `app-` seguido do appId com hífens no lugar dos
// sublinhados. O nome da classe é livre — use o appId em PascalCase.
@customElement('app-ola-mundo')
export class AppOlaMundo extends LitElement {
  @state() private mensagem = 'Carregando...';

  static styles = css`
    :host { display: block; padding: var(--espaco-4, 1rem); color: var(--cor-texto); }
  `;

  async connectedCallback() {
    super.connectedCallback();
    // Caminho relativo ao app. O shell acrescenta o prefixo sozinho.
    const resposta = await urbiVerso.api('/ola');
    this.mensagem = resposta.mensagem;
  }

  render() {
    return html`
      <h1>${this.mensagem}</h1>
      <p>Seu primeiro app no urbiverso está no ar.</p>
    `;
  }
}
