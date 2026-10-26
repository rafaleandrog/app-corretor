import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { UrbiColunaTabela, UrbiVersoAPI } from '@urbiverso/sdk';
import { chamarApi, filtrosDaUrl, filtrosNaUrl, reais, ROTULO_MOTIVO_PERDA, ROTULO_ORIGEM } from '../apoio.js';

declare const urbiVerso: UrbiVersoAPI;

type Linha = Record<string, any>;

const PERIODOS = [
  { valor: '7', rotulo: 'Últimos 7 dias', anterior: 'nos 7 dias anteriores' },
  { valor: '30', rotulo: 'Últimos 30 dias', anterior: 'nos 30 dias anteriores' },
  { valor: '90', rotulo: 'Últimos 90 dias', anterior: 'nos 90 dias anteriores' },
  { valor: '365', rotulo: 'Últimos 12 meses', anterior: 'nos 12 meses anteriores' },
];
const canal = (c: string) => ROTULO_ORIGEM[c] ?? (c === 'nao_informada' ? 'Não informada' : c);
const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)}%`);

/** Comparação com o período anterior, em texto curto ("+3 que nos 30 dias anteriores"). */
function variacao(dias: number, atual: number | null, anterior: number | null, ehTaxa = false): string {
  if (atual === null || anterior === null) return '';
  const quando = PERIODOS.find((p) => p.valor === String(dias))?.anterior ?? 'nos dias anteriores';
  const d = atual - anterior;
  if (d === 0) return `igual ${quando.replace(/^nos?/, 'aos')}`;
  const s = d > 0 ? '+' : '−';
  return ehTaxa ? `${s}${Math.round(Math.abs(d) * 100)} pontos que ${quando}` : `${s}${Math.abs(d).toLocaleString('pt-BR')} que ${quando}`;
}

// Desempenho (spec 11.1 e 11.2): quatro números acima da dobra (leads, conversão total, vendas,
// comissão prevista); abaixo, o funil da coorte, os demais resultados, por origem e motivos de
// perda, com a comparação ao período anterior em texto pequeno. O período fica em `?dias=`.
// O que ainda não tem fonte (WhatsApp, conteúdo, metas) aparece explicado, não zerado.
@customElement('pc-tela-desempenho')
export class PcTelaDesempenho extends LitElement {
  @state() private dados: Linha | null = null;
  @state() private falha: string | null = null;
  @state() private dias = PERIODOS.some((p) => p.valor === filtrosDaUrl().get('dias')) ? Number(filtrosDaUrl().get('dias')) : 30;
  private geracao = 0;

  connectedCallback() {
    super.connectedCallback();
    void this.carregar();
  }

  private async carregar() {
    const geracao = ++this.geracao;
    this.falha = null;
    try {
      const r = await chamarApi(`/numeros?dias=${this.dias}`);
      if (geracao === this.geracao) this.dados = r;
    } catch (e) {
      if (geracao === this.geracao) this.falha = (e as Error).message;
    }
  }

  private mudarPeriodo(dias: number) {
    this.dias = dias;
    filtrosNaUrl(filtrosDaUrl(), { dias });
    void this.carregar();
  }

  private kpi(rotulo: string, valor: string | number, detalhe = '') {
    return html`<urbi-stack>
      <urbi-kpi rotulo=${rotulo} .valor=${valor} formato=${typeof valor === 'number' ? 'numero' : 'texto'}></urbi-kpi>
      ${detalhe ? html`<urbi-prosa papel="fraco">${detalhe}</urbi-prosa>` : ''}
    </urbi-stack>`;
  }

  /** Linha do funil: etapa, taxa e a comparação em texto pequeno. */
  private passo(rotulo: string, atual: number | null, anterior: number | null) {
    return html`<urbi-linha justificar="entre" quebrar>
      <urbi-stack>
        <urbi-prosa>${rotulo}</urbi-prosa>
        ${variacao(this.dias, atual, anterior, true) ? html`<urbi-prosa papel="fraco">${variacao(this.dias, atual, anterior, true)}</urbi-prosa>` : ''}
      </urbi-stack>
      <urbi-badge>${pct(atual)}</urbi-badge>
    </urbi-linha>`;
  }

  render() {
    if (this.falha && !this.dados) {
      return html`<urbi-banner variante="erro">
        ${this.falha}
        <urbi-botao slot="acao" pequeno variante="secundario" @click=${() => this.carregar()}>Tentar de novo</urbi-botao>
      </urbi-banner>`;
    }
    if (!this.dados) return html`<urbi-loading></urbi-loading>`;
    const a = this.dados.atual;
    const b = this.dados.anterior;
    const previsao = this.dados.previsao;
    const v = (atual: number | null, anterior: number | null, ehTaxa = false) => variacao(this.dias, atual, anterior, ehTaxa);
    const colOrigem: UrbiColunaTabela[] = [
      { id: 'canal', label: 'Origem', valor: (l) => canal((l as Linha).canal) },
      { id: 'leads', label: 'Leads', alinhamento: 'direita' },
      { id: 'ganhos', label: 'Ganhos', alinhamento: 'direita' },
      { id: 'taxa', label: 'Conversão', alinhamento: 'direita', valor: (l) => pct((l as Linha).leads ? (l as Linha).ganhos / (l as Linha).leads : null) },
    ];
    return html`<urbi-stack>
      <urbi-linha quebrar>
        <urbi-select label="Período" valor=${String(this.dias)}
          .opcoes=${PERIODOS.map(({ valor, rotulo }) => ({ valor, rotulo }))}
          @urbi:select-change=${(e: CustomEvent) => this.mudarPeriodo(Number(e.detail.valor))}></urbi-select>
      </urbi-linha>
      <urbi-grid min="140px">
        ${this.kpi('Leads', a.leads, v(a.leads, b.leads))}
        ${this.kpi('Conversão total', pct(a.conversao_total), v(a.conversao_total, b.conversao_total, true))}
        ${this.kpi('Vendas', a.ganhos, v(a.ganhos, b.ganhos))}
        ${this.kpi('Comissão prevista', previsao.valor_c === null ? '—' : reais(previsao.valor_c),
          previsao.sem_dados ? `${previsao.sem_dados} negócio(s) sem valor ou comissão ficaram de fora` : 'Ponderada pela chance de cada etapa')}
      </urbi-grid>
      <urbi-card titulo="Funil de compra" icone="fa-solid fa-filter">
        <urbi-prosa papel="secundario">Negócios de compra abertos no período e até onde chegaram.</urbi-prosa>
        <urbi-lista separador .itens=${[
          ['Lead → atendimento', a.lead_atendimento, b.lead_atendimento],
          ['Lead → visita', a.lead_visita, b.lead_visita],
          ['Visita → proposta', a.visita_proposta, b.visita_proposta],
          ['Proposta → ganho', a.proposta_ganho, b.proposta_ganho],
        ]} .render_item=${([rotulo, atual, anterior]: [string, number | null, number | null]) => this.passo(rotulo, atual, anterior)}></urbi-lista>
      </urbi-card>
      <urbi-card titulo="Resultados" icone="fa-solid fa-trophy">
        <urbi-grid min="140px">
          ${this.kpi('VGV', a.vgv_c === null ? '—' : reais(a.vgv_c))}
          ${this.kpi('Ciclo médio', a.ciclo_medio_dias === null ? '—' : `${a.ciclo_medio_dias} dias`)}
          ${this.kpi('Visitas feitas', a.visitas, v(a.visitas, b.visitas))}
          ${this.kpi('Captações', a.captacoes, v(a.captacoes, b.captacoes))}
        </urbi-grid>
      </urbi-card>
      <urbi-card titulo="Por origem" icone="fa-solid fa-signs-post">
        ${a.por_origem.length
          ? html`<urbi-tabela responsivo="multiline" .colunas=${colOrigem} .linhas=${a.por_origem}></urbi-tabela>`
          : html`<urbi-prosa papel="dica">Nenhum lead no período.</urbi-prosa>`}
      </urbi-card>
      <urbi-card titulo="Motivos de perda" icone="fa-solid fa-circle-xmark">
        ${a.motivos_perda.length
          ? html`<urbi-lista separador .itens=${a.motivos_perda} .render_item=${(m: Linha) => html`<urbi-linha justificar="entre">
                <urbi-prosa>${ROTULO_MOTIVO_PERDA[m.motivo] ?? m.motivo}</urbi-prosa><urbi-badge>${m.quantidade}</urbi-badge>
              </urbi-linha>`}></urbi-lista>`
          : html`<urbi-prosa papel="dica">Nenhuma perda no período.</urbi-prosa>`}
      </urbi-card>
      <urbi-prosa papel="dica">
        Tempo de primeiro atendimento e números do atendimento automático (o Mensageiro) chegam com o WhatsApp; conteúdo publicado,
        com o Estúdio; custo por lead, comissão recebida e metas, em versões seguintes.
      </urbi-prosa>
    </urbi-stack>`;
  }
}
