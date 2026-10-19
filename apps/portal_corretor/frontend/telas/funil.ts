import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { UrbiVersoAPI } from '@urbiverso/sdk';
import { enviar, mensagemDeErro, opcoes, reais, ROTULO_MOTIVO_PERDA } from '../apoio.js';

declare const urbiVerso: UrbiVersoAPI;

type Linha = Record<string, any>;

const TEMPERATURA: Record<string, { cor: string; rotulo: string }> = {
  frio: { cor: 'info', rotulo: 'Frio' },
  morno: { cor: 'alerta', rotulo: 'Morno' },
  quente: { cor: 'erro', rotulo: 'Quente' },
};

// Funil: quadro por etapa (arrastar move; perdido pede motivo), com a temperatura de cada contato
// e o alerta de abordagem atrasada. Filtros de funil, temperatura e "parado há" ficam na URL.
@customElement('pc-tela-funil')
export class PcTelaFunil extends LitElement {
  @state() private quadro: { etapas: Linha[]; negocios: Linha[] } | null = null;
  @state() private falha: string | null = null;
  private filtros = new URLSearchParams(window.location.search);
  private geracao = 0;

  connectedCallback() {
    super.connectedCallback();
    void this.carregar();
  }

  private async carregar() {
    const geracao = ++this.geracao;
    this.falha = null;
    try {
      const r = await urbiVerso.api(`/funil/quadro?${this.filtros}`);
      if (geracao === this.geracao) this.quadro = r;
    } catch (e) {
      if (geracao === this.geracao) this.falha = (e as Error).message;
    }
  }

  private filtrar(mudancas: Record<string, string>) {
    for (const [k, v] of Object.entries(mudancas)) {
      if (v) this.filtros.set(k, v);
      else this.filtros.delete(k);
    }
    const qs = this.filtros.toString();
    history.replaceState(history.state, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`);
    void this.carregar();
  }

  private async mover(e: CustomEvent) {
    const { item, listaDestino } = e.detail as { item: Linha; listaDestino: string };
    const etapa = this.quadro!.etapas.find((x) => String(x.id) === String(listaDestino));
    if (!etapa) return;
    let motivo: string | undefined;
    if (etapa.tipo === 'perdida') {
      const v = await urbiVerso.formulario({
        titulo: 'Por que perdeu?',
        campos: [{ nome: 'motivo', tipo: 'selecao', rotulo: 'Motivo', obrigatorio: true, opcoes: opcoes(ROTULO_MOTIVO_PERDA) }],
        rotuloConfirmar: 'Marcar como perdido',
      });
      if (!v) return void this.carregar(); // devolve o cartão para onde estava
      motivo = String(v.motivo);
    }
    try {
      await enviar('PATCH', `/negocios/${item.id}`, { etapa_id: etapa.id, motivo_perda: motivo });
    } catch (err) {
      await urbiVerso.alertar({ titulo: 'Não foi possível mover', mensagem: mensagemDeErro(err), tipo: 'erro' });
    }
    await this.carregar();
  }

  private cartao(n: Linha) {
    const t = TEMPERATURA[n.temperatura ?? ''];
    return html`<urbi-stack>
      <urbi-prosa>${n.contato_nome}</urbi-prosa>
      <urbi-prosa papel="secundario">${n.titulo}${n.valor_estimado_c ? ` · ${reais(n.valor_estimado_c)}` : ''}</urbi-prosa>
      <urbi-linha quebrar>
        ${t ? html`<urbi-badge cor=${t.cor} title=${n.temperatura_motivo ?? ''}>${t.rotulo}</urbi-badge>` : ''}
        ${n.abordagem_vencida ? html`<urbi-badge cor="alerta">Abordagem atrasada</urbi-badge>` : ''}
      </urbi-linha>
    </urbi-stack>`;
  }

  render() {
    const pipeline = this.filtros.get('pipeline') ?? 'compra';
    const filtros = html`<urbi-linha quebrar>
      <urbi-select label="Funil" valor=${pipeline}
        .opcoes=${[{ valor: 'compra', rotulo: 'Compra' }, { valor: 'venda_captacao', rotulo: 'Venda e captação' }]}
        @urbi:select-change=${(e: CustomEvent) => this.filtrar({ pipeline: e.detail.valor === 'compra' ? '' : e.detail.valor })}></urbi-select>
      <urbi-select label="Temperatura" valor=${this.filtros.get('temperatura') ?? ''} placeholder="Todas"
        .opcoes=${Object.entries(TEMPERATURA).map(([valor, t]) => ({ valor, rotulo: t.rotulo }))}
        @urbi:select-change=${(e: CustomEvent) => this.filtrar({ temperatura: e.detail.valor })}></urbi-select>
      <urbi-select label="Sem contato há" valor=${this.filtros.get('parado_dias') ?? ''} placeholder="Qualquer tempo"
        .opcoes=${[{ valor: '3', rotulo: '3 dias' }, { valor: '7', rotulo: '7 dias' }, { valor: '15', rotulo: '15 dias' }, { valor: '30', rotulo: '30 dias' }]}
        @urbi:select-change=${(e: CustomEvent) => this.filtrar({ parado_dias: e.detail.valor })}></urbi-select>
    </urbi-linha>`;
    if (this.falha && !this.quadro) {
      return html`<urbi-stack>${filtros}<urbi-banner variante="erro">
          ${this.falha}
          <urbi-botao slot="acao" pequeno variante="secundario" @click=${() => this.carregar()}>Tentar de novo</urbi-botao>
        </urbi-banner></urbi-stack>`;
    }
    if (!this.quadro) return html`<urbi-loading></urbi-loading>`;
    const listas = this.quadro.etapas.map((e) => ({ id: String(e.id), label: e.nome }));
    const itens = this.quadro.negocios.map((n) => ({ ...n, id: String(n.id), lista: String(n.etapa_id), label: n.contato_nome, variante: n.abordagem_vencida ? 'alerta' : '' }));
    return html`<urbi-stack>
      ${filtros}
      ${this.falha ? html`<urbi-banner variante="erro">${this.falha}</urbi-banner>` : ''}
      ${itens.length
        ? html`<urbi-kanban .listas=${listas} .itens=${itens} .render_item=${(n: Linha) => this.cartao(n)}
            .href_item=${(n: Linha) => urbiVerso.href(`/clientes/${n.contato_id}`)}
            @urbi:kanban-mover=${(e: CustomEvent) => this.mover(e)}></urbi-kanban>`
        : html`<urbi-estado-vazio icone="fa-solid fa-filter" mensagem=${this.filtros.get('temperatura') || this.filtros.get('parado_dias') ? 'Nenhum negócio com estes filtros' : 'Nenhum negócio neste funil'}
            submensagem="Abra negócios pela ficha de cada cliente."></urbi-estado-vazio>`}
    </urbi-stack>`;
  }
}
