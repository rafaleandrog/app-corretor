import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { UrbiVersoAPI } from '@urbiverso/sdk';
import { acoesComMais, chamarApi, enviar, mensagemDeErro, ROTULO_TIPO_ATIVIDADE, type Acao } from '../apoio.js';

declare const urbiVerso: UrbiVersoAPI;

type Atividade = Record<string, any>;

// Agenda de 14 dias (visão do centro de Hoje, aberta por "Ver agenda"; D-82): o que está pendente nos próximos 14 dias, agrupado por dia, mais o
// que ficou atrasado. Lista por dia em vez de calendário: o catálogo de UI ainda não tem calendário (spec 11.5).
@customElement('pc-tela-agenda')
export class PcTelaAgenda extends LitElement {
  @state() private atividades: Atividade[] | null = null;
  @state() private falha: string | null = null;
  @state() private total = 0;

  connectedCallback() {
    super.connectedCallback();
    void this.carregar();
  }

  private async carregar() {
    this.falha = null;
    const ate = new Date(Date.now() + 14 * 86400e3);
    try {
      const r = await chamarApi(`/atividades?status=pendente&ate=${encodeURIComponent(ate.toISOString())}`);
      this.atividades = r.dados;
      this.total = r.total ?? r.dados.length;
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

  /** Um botão por item (princípio 14): Feito; cliente, não compareceu e cancelar no "Mais". */
  private acoes(a: Atividade) {
    const mais: Acao[] = [];
    if (a.contato_id) mais.push({ rotulo: 'Abrir cliente', icone: 'fa-solid fa-user', sub: `/clientes/${a.contato_id}` });
    if (a.tipo === 'visita') mais.push({ rotulo: 'Não veio', icone: 'fa-solid fa-user-xmark', aoEscolher: () => this.mudar(a, 'nao_compareceu') });
    mais.push({ rotulo: 'Cancelar', icone: 'fa-solid fa-xmark', perigo: true, aoEscolher: () => this.mudar(a, 'cancelada') });
    return acoesComMais({ rotulo: 'Feito', icone: 'fa-solid fa-check', aoEscolher: () => this.mudar(a, 'feita') }, mais);
  }

  private item(a: Atividade) {
    return html`<urbi-linha justificar="entre" quebrar>
      <urbi-stack>
        <urbi-prosa>${new Date(a.quando).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · ${ROTULO_TIPO_ATIVIDADE[a.tipo]}: ${a.titulo}</urbi-prosa>
        <urbi-prosa papel="secundario">${a.contato_nome ?? 'sem cliente'}${a.local ? ` · ${a.local}` : ''}</urbi-prosa>
      </urbi-stack>
      ${this.acoes(a)}
    </urbi-linha>`;
  }

  render() {
    const banner = this.falha
      ? html`<urbi-banner variante="erro">
          ${this.falha}
          <urbi-botao slot="acao" pequeno variante="secundario" @click=${() => this.carregar()}>Tentar de novo</urbi-botao>
        </urbi-banner>`
      : '';
    // Falha ao recarregar mantém a lista que já estava na tela.
    if (this.falha && !this.atividades) return banner;
    if (!this.atividades) return html`<urbi-loading></urbi-loading>`;
    if (!this.atividades.length) {
      const vazio = html`<urbi-stack>
        <urbi-estado-vazio icone="fa-solid fa-calendar-check" mensagem="Nada pendente nos próximos 14 dias"
          submensagem="Agende ligações, visitas e reuniões pela ficha de cada cliente."></urbi-estado-vazio>
        <urbi-linha justificar="centro">
          <urbi-botao variante="secundario" icone="fa-solid fa-users" href=${urbiVerso.href('/clientes')}>Abrir Clientes</urbi-botao>
        </urbi-linha>
      </urbi-stack>`;
      return this.falha ? html`<urbi-stack>${banner}${vazio}</urbi-stack>` : vazio;
    }
    const grupos = new Map<string, Atividade[]>();
    for (const a of this.atividades) grupos.set(this.dia(a.quando), [...(grupos.get(this.dia(a.quando)) ?? []), a]);
    return html`<urbi-stack>
      ${banner}
      ${this.total > this.atividades.length
        ? html`<urbi-banner variante="alerta">Mostrando ${this.atividades.length} de ${this.total} pendências. Conclua ou cancele as atrasadas para ver as demais.</urbi-banner>`
        : ''}
      ${[...grupos].map(
        ([dia, itens]) => html`<urbi-card titulo=${dia} icone=${dia === 'Atrasadas' ? 'fa-solid fa-triangle-exclamation' : 'fa-solid fa-calendar-day'}>
          <urbi-lista separador .itens=${itens} .render_item=${(a: Atividade) => this.item(a)}></urbi-lista>
        </urbi-card>`,
      )}
    </urbi-stack>`;
  }
}
