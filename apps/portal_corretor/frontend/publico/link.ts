import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { UrbiVersoAPI } from '@urbiverso/sdk';
import { estiloPublico } from './estilo';

declare const urbiVerso: UrbiVersoAPI;

// Link rastreado (`/portal_corretor/l?c=<código>`, D-68): conta o clique pelo webhook da conta e leva
// à ficha pública do imóvel. Um clique por aba (sessionStorage), sem dado do visitante.
@customElement('pc-link-rastreado')
export class PcLinkRastreado extends LitElement {
  static styles = estiloPublico;

  @state() private indisponivel = false;

  connectedCallback() {
    super.connectedCallback();
    void this.seguir();
  }

  private jaContou(codigo: string): boolean {
    try {
      const chave = `pc-link-${codigo}`;
      if (sessionStorage.getItem(chave)) return true;
      sessionStorage.setItem(chave, '1');
    } catch {
      // Sem armazenamento (navegação privada): conta mesmo assim.
    }
    return false;
  }

  private async seguir() {
    const codigo = new URLSearchParams(window.location.search).get('c') ?? '';
    let r: { destino: string | null; url_clique: string | null } | null = null;
    try {
      r = codigo ? await urbiVerso.api(`/pub/portal_corretor/vitrine/link?c=${encodeURIComponent(codigo)}`, { anonimo: true }) : null;
    } catch {
      r = null;
    }
    if (r?.url_clique && !this.jaContou(codigo)) {
      // `keepalive` deixa o envio terminar mesmo com a troca de página logo em seguida.
      await Promise.race([
        fetch(r.url_clique, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ codigo }), keepalive: true }).catch(() => null),
        new Promise((ok) => setTimeout(ok, 800)),
      ]);
    }
    if (r?.destino) window.location.replace(r.destino);
    else this.indisponivel = true;
  }

  render() {
    return this.indisponivel
      ? html`<div class="centro"><h2>Imóvel indisponível</h2><p class="suave">Este imóvel não está mais anunciado. Fale com o corretor que enviou o link.</p></div>`
      : html`<div class="centro suave">Abrindo o imóvel…</div>`;
  }
}
