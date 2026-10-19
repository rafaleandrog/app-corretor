import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { UrbiVersoAPI } from '@urbiverso/sdk';

declare const urbiVerso: UrbiVersoAPI;

// Início do corretor. Por enquanto só guia o primeiro passo (completar a conta); a fila do dia,
// os números e os atalhos chegam no bloco 4.
@customElement('pc-tela-inicio')
export class PcTelaInicio extends LitElement {
  @state() private pendente: string[] | null = null;
  @state() private falha: string | null = null;

  connectedCallback() {
    super.connectedCallback();
    void this.carregar();
  }

  private async carregar() {
    this.falha = null;
    this.pendente = null;
    try {
      const r = await urbiVerso.api('/conta');
      const falta: string[] = [];
      if (!r.perfil) falta.push('o nome da conta');
      if (!r.meu_perfil?.creci) falta.push('o seu CRECI');
      if (!r.meu_perfil?.telefone) falta.push('o seu telefone');
      this.pendente = falta;
    } catch (e) {
      this.falha = (e as Error).message;
    }
  }

  render() {
    if (this.falha) {
      return html`<urbi-banner variante="erro">
        Não foi possível carregar o Início: ${this.falha}
        <urbi-botao slot="acao" pequeno variante="secundario" @click=${() => this.carregar()}>Tentar de novo</urbi-botao>
      </urbi-banner>`;
    }
    if (!this.pendente) return html`<urbi-loading></urbi-loading>`;
    if (this.pendente.length) {
      return html`<urbi-banner variante="info">
        Para começar, complete ${this.pendente.join(', ')} em Conta e marca.
        <urbi-botao slot="acao" pequeno href=${urbiVerso.href('/conta')}>Completar agora</urbi-botao>
      </urbi-banner>`;
    }
    return html`<urbi-estado-vazio icone="fa-solid fa-house" mensagem="Sua conta está pronta"
      submensagem="A fila do dia, os números e os atalhos chegam nas próximas versões."></urbi-estado-vazio>`;
  }
}
