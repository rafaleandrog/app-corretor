import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { PreviaPagina } from '../publico/pagina-publica.js';
import '../publico/pagina-publica.js';

// Prévia da Página no editor (P09, centro). Exceção de UI nomeada (spec 11.9): a prévia é a própria
// página pública (`pc-pagina-publica`, com o CSS próprio das páginas públicas), e no modo Celular ela
// fica numa largura de celular (300 px, P09), centralizada, com borda e cantos arredondados. Nenhum primitivo `urbi-*` limita a largura
// de um conteúdo nem mostra uma página com estilo próprio (`urbi-hospedeiro` dá respiro, empilha e rola, sem largura nem estilo próprio, e
// `urbi-moldura` só aceita um pinner). Cores e raio vêm dos tokens do tema.
@customElement('pc-previa-pagina')
export class PcPreviaPagina extends LitElement {
  @property({ attribute: false }) previa: PreviaPagina | null = null;
  @property({ reflect: true }) dispositivo: 'celular' | 'computador' = 'celular';

  static styles = css`
    :host { display: block; }
    .tela {
      margin: 0 auto;
      border: 1px solid var(--cor-borda);
      border-radius: var(--raio-lg);
      overflow: hidden;
    }
    :host([dispositivo='celular']) .tela { max-width: 300px; }
  `;

  render() {
    return html`<div class="tela" role="region" aria-label=${this.dispositivo === 'celular' ? 'Prévia da página no celular' : 'Prévia da página no computador'}>
      <pc-pagina-publica .previa=${this.previa}></pc-pagina-publica>
    </div>`;
  }
}
