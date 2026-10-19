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

  @state() private estado: 'abrindo' | 'indisponivel' | 'falha' = 'abrindo';

  connectedCallback() {
    super.connectedCallback();
    void this.seguir();
  }

  private jaContou(codigo: string): boolean {
    try {
      return !!sessionStorage.getItem(`pc-link-${codigo}`);
    } catch {
      return false; // sem armazenamento (navegação privada): conta mesmo assim
    }
  }

  private marcarContado(codigo: string) {
    try {
      sessionStorage.setItem(`pc-link-${codigo}`, '1');
    } catch {
      // sem armazenamento: nada a guardar
    }
  }

  private async seguir() {
    const codigo = new URLSearchParams(window.location.search).get('c') ?? '';
    let r: { destino: string | null; url_clique: string | null } | null = null;
    try {
      r = codigo ? await urbiVerso.api(`/pub/portal_corretor/vitrine/link?c=${encodeURIComponent(codigo)}`, { anonimo: true }) : null;
    } catch (e) {
      // Link que não existe é "indisponível"; queda de rede pede outra tentativa.
      const naoExiste = (e as { status?: number }).status === 404 || (e as { codigo?: string }).codigo === 'NAO_ENCONTRADO';
      this.estado = naoExiste ? 'indisponivel' : 'falha';
      return;
    }
    if (r?.url_clique && !this.jaContou(codigo)) {
      // `keepalive` deixa o envio terminar mesmo com a troca de página logo em seguida; só marca
      // como contado quando o webhook confirmou.
      await Promise.race([
        fetch(r.url_clique, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ codigo }), keepalive: true })
          .then((resp) => resp.ok && this.marcarContado(codigo))
          .catch(() => null),
        new Promise((ok) => setTimeout(ok, 800)),
      ]);
    }
    // Só caminho deste site: o destino nunca leva para fora.
    if (r?.destino && r.destino.startsWith('/') && !r.destino.startsWith('//')) window.location.replace(r.destino);
    else this.estado = 'indisponivel';
  }

  render() {
    if (this.estado === 'indisponivel') {
      return html`<div class="centro"><h2>Imóvel indisponível</h2><p class="suave">Este imóvel não está mais anunciado. Fale com o corretor que enviou o link.</p></div>`;
    }
    if (this.estado === 'falha') {
      return html`<div class="centro"><h2>Não foi possível abrir agora</h2><p><button class="botao" @click=${() => { this.estado = 'abrindo'; void this.seguir(); }}>Tentar de novo</button></p></div>`;
    }
    return html`<div class="centro suave">Abrindo o imóvel…</div>`;
  }
}
