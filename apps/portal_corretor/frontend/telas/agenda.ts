import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { UrbiVersoAPI } from '@urbiverso/sdk';
import { enviar, mensagemDeErro, ROTULO_TIPO_ATIVIDADE } from '../apoio.js';

declare const urbiVerso: UrbiVersoAPI;

type Atividade = Record<string, any>;

// Agenda: o que está pendente nos próximos 14 dias, agrupado por dia, mais o que ficou atrasado.
// Lista por dia em vez de calendário: o catálogo de UI ainda não tem calendário (spec 11.5).
@customElement('pc-tela-agenda')
export class PcTelaAgenda extends LitElement {
  @state() private atividades: Atividade[] | null = null;
  @state() private falha: string | null = null;

  connectedCallback() {
    super.connectedCallback();
    void this.carregar();
  }

  private async carregar() {
    this.falha = null;
    const ate = new Date(Date.now() + 14 * 86400e3);
    try {
      const r = await urbiVerso.api(`/atividades?status=pendente&ate=${encodeURIComponent(ate.toISOString())}`);
      this.atividades = r.dados;
    } catch (e) {
      this.falha = (e as Error).message;
    }
  }

  private async mudar(a: Atividade, status: 'feita' | 'cancelada' | 'nao_compareceu') {
    try {
      await enviar('PATCH', `/atividades/${a.id}`, { status });
      await this.carregar();
    } catch (e) {
      await urbiVerso.alertar({ titulo: 'Não foi possível atualizar', mensagem: mensagemDeErro(e), tipo: 'erro' });
    }
  }

  private dia(iso: string) {
    const d = new Date(iso);
    const hoje = new Date();
    const amanha = new Date(Date.now() + 86400e3);
    const mesmo = (x: Date, y: Date) => x.toDateString() === y.toDateString();
    if (d < new Date(hoje.toDateString())) return 'Atrasadas';
    if (mesmo(d, hoje)) return 'Hoje';
    if (mesmo(d, amanha)) return 'Amanhã';
    return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' });
  }

  private item(a: Atividade) {
    return html`<urbi-linha justificar="entre" quebrar>
      <urbi-stack>
        <urbi-prosa>${new Date(a.quando).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · ${ROTULO_TIPO_ATIVIDADE[a.tipo]}: ${a.titulo}</urbi-prosa>
        <urbi-prosa papel="secundario">${a.contato_nome ?? 'sem cliente'}${a.local ? ` · ${a.local}` : ''}</urbi-prosa>
      </urbi-stack>
      <urbi-linha>
        ${a.contato_id ? html`<urbi-botao variante="texto" pequeno href=${urbiVerso.href(`/clientes/${a.contato_id}`)}>Cliente</urbi-botao>` : ''}
        <urbi-botao variante="texto" pequeno @click=${() => this.mudar(a, 'feita')}>Feito</urbi-botao>
        ${a.tipo === 'visita' ? html`<urbi-botao variante="texto" pequeno @click=${() => this.mudar(a, 'nao_compareceu')}>Não veio</urbi-botao>` : ''}
        <urbi-botao variante="texto" pequeno @click=${() => this.mudar(a, 'cancelada')}>Cancelar</urbi-botao>
      </urbi-linha>
    </urbi-linha>`;
  }

  render() {
    if (this.falha) {
      return html`<urbi-banner variante="erro">
        ${this.falha}
        <urbi-botao slot="acao" pequeno variante="secundario" @click=${() => this.carregar()}>Tentar de novo</urbi-botao>
      </urbi-banner>`;
    }
    if (!this.atividades) return html`<urbi-loading></urbi-loading>`;
    if (!this.atividades.length) {
      return html`<urbi-estado-vazio icone="fa-solid fa-calendar-check" mensagem="Nada pendente nos próximos 14 dias"
        submensagem="Agende ligações, visitas e reuniões pela ficha de cada cliente."></urbi-estado-vazio>`;
    }
    const grupos = new Map<string, Atividade[]>();
    for (const a of this.atividades) grupos.set(this.dia(a.quando), [...(grupos.get(this.dia(a.quando)) ?? []), a]);
    return html`<urbi-stack>
      ${[...grupos].map(
        ([dia, itens]) => html`<urbi-card titulo=${dia} icone=${dia === 'Atrasadas' ? 'fa-solid fa-triangle-exclamation' : 'fa-solid fa-calendar-day'}>
          <urbi-lista separador .itens=${itens} .render_item=${(a: Atividade) => this.item(a)}></urbi-lista>
        </urbi-card>`,
      )}
    </urbi-stack>`;
  }
}
