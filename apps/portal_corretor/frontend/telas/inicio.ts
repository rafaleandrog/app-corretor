import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { UrbiVersoAPI } from '@urbiverso/sdk';

declare const urbiVerso: UrbiVersoAPI;

// Início do corretor. Por enquanto só guia o primeiro passo (completar a conta); a fila do dia,
// os números e os atalhos chegam no bloco 4.
@customElement('pc-tela-inicio')
export class PcTelaInicio extends LitElement {
  @state() private pendente: string[] | null = null;
  @state() private falhou = false;

  async connectedCallback() {
    super.connectedCallback();
    try {
      const r = await urbiVerso.api('/conta');
      const falta: string[] = [];
      if (!r.perfil) falta.push('o nome da conta');
      if (!r.meu_perfil?.creci) falta.push('o seu CRECI');
      if (!r.meu_perfil?.telefone) falta.push('o seu telefone');
      this.pendente = falta;
    } catch {
      this.falhou = true;
    }
  }

  render() {
    if (this.falhou) {
      return html`<urbi-estado-vazio expandir icone="fa-solid fa-triangle-exclamation" mensagem="Não foi possível carregar o Início"
        submensagem="Recarregue a página. Se continuar, avise pelo botão de ajuda."></urbi-estado-vazio>`;
    }
    if (!this.pendente) return html`<urbi-loading></urbi-loading>`;
    if (this.pendente.length) {
      return html`<urbi-stack>
        <urbi-banner variante="info">
          Para começar, complete ${this.pendente.join(', ')}. O CRECI aparece em todo anúncio e é exigido para publicar.
          <urbi-botao slot="acao" pequeno href=${urbiVerso.href('/conta')}>Completar agora</urbi-botao>
        </urbi-banner>
      </urbi-stack>`;
    }
    return html`<urbi-estado-vazio expandir icone="fa-solid fa-house" mensagem="Sua conta está pronta"
      submensagem="A fila do dia, os números e os atalhos chegam nas próximas versões."></urbi-estado-vazio>`;
  }
}
