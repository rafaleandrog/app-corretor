import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { UrbiColunaTabela, UrbiVersoAPI } from '@urbiverso/sdk';
import { chamarApi, filtrosNaUrl, reais, ROTULO_MOTIVO_PERDA } from '../apoio.js';

declare const urbiVerso: UrbiVersoAPI;

type Linha = Record<string, any>;

const CANAL: Record<string, string> = {
  pagina: 'Minha Página', whatsapp: 'WhatsApp', instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok', youtube: 'YouTube',
  portal: 'Portal', indicacao: 'Indicação', rede: 'Rede', incorporadora: 'Incorporadora', placa: 'Placa', evento: 'Evento',
  importacao: 'Importação', outro: 'Outro', nao_informada: 'Não informada',
};
const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)}%`);

/** Variação em relação ao período anterior, como texto curto. */
function variacao(atual: number | null, anterior: number | null, ehTaxa = false): string {
  if (atual === null || anterior === null) return '';
  const d = atual - anterior;
  if (d === 0) return 'igual ao período anterior';
  const s = d > 0 ? '+' : '−';
  return ehTaxa ? `${s}${Math.round(Math.abs(d) * 100)} pontos` : `${s}${Math.abs(d).toLocaleString('pt-BR')} vs. anterior`;
}

// Desempenho (spec 11.2): leads e conversão entre etapas da coorte do período, ganhos, ciclo, VGV,
// captações, motivos de perda, conversão por origem e previsão ponderada, comparados ao período
// anterior. O que ainda não tem fonte (WhatsApp, conteúdo, metas) aparece explicado, não zerado.
@customElement('pc-tela-desempenho')
export class PcTelaDesempenho extends LitElement {
  @state() private dados: Linha | null = null;
  @state() private falha: string | null = null;
  @state() private dias = Number(new URLSearchParams(window.location.search).get('dias')) || 30;
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
    filtrosNaUrl(new URLSearchParams(), { dias });
    void this.carregar();
  }

  private kpi(rotulo: string, valor: string | number, detalhe = '') {
    return html`<urbi-stack>
      <urbi-kpi rotulo=${rotulo} .valor=${valor} formato=${typeof valor === 'number' ? 'numero' : 'texto'}></urbi-kpi>
      ${detalhe ? html`<urbi-prosa papel="fraco">${detalhe}</urbi-prosa>` : ''}
    </urbi-stack>`;
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
    const colOrigem: UrbiColunaTabela[] = [
      { id: 'canal', label: 'Origem', valor: (l) => CANAL[(l as Linha).canal] ?? (l as Linha).canal },
      { id: 'leads', label: 'Leads', alinhamento: 'direita' },
      { id: 'ganhos', label: 'Ganhos', alinhamento: 'direita' },
      { id: 'taxa', label: 'Conversão', alinhamento: 'direita', valor: (l) => pct((l as Linha).leads ? (l as Linha).ganhos / (l as Linha).leads : null) },
    ];
    return html`<urbi-stack>
      <urbi-linha quebrar>
        <urbi-select label="Período" valor=${String(this.dias)}
          .opcoes=${[{ valor: '7', rotulo: 'Últimos 7 dias' }, { valor: '30', rotulo: 'Últimos 30 dias' }, { valor: '90', rotulo: 'Últimos 90 dias' }, { valor: '365', rotulo: 'Últimos 12 meses' }]}
          @urbi:select-change=${(e: CustomEvent) => this.mudarPeriodo(Number(e.detail.valor))}></urbi-select>
      </urbi-linha>
      <urbi-card titulo="Funil de compra" icone="fa-solid fa-filter">
        <urbi-prosa papel="secundario">Negócios de compra abertos no período e até onde chegaram. Comparação com os ${this.dias} dias anteriores.</urbi-prosa>
        <urbi-grid min="140px">
          ${this.kpi('Leads', a.leads, variacao(a.leads, b.leads))}
          ${this.kpi('Lead → atendimento', pct(a.lead_atendimento), variacao(a.lead_atendimento, b.lead_atendimento, true))}
          ${this.kpi('Lead → visita', pct(a.lead_visita), variacao(a.lead_visita, b.lead_visita, true))}
          ${this.kpi('Visita → proposta', pct(a.visita_proposta), variacao(a.visita_proposta, b.visita_proposta, true))}
          ${this.kpi('Proposta → ganho', pct(a.proposta_ganho), variacao(a.proposta_ganho, b.proposta_ganho, true))}
          ${this.kpi('Conversão total', pct(a.conversao_total), variacao(a.conversao_total, b.conversao_total, true))}
        </urbi-grid>
      </urbi-card>
      <urbi-card titulo="Resultados" icone="fa-solid fa-trophy">
        <urbi-grid min="140px">
          ${this.kpi('Vendas', a.ganhos, variacao(a.ganhos, b.ganhos))}
          ${this.kpi('VGV', a.vgv_c === null ? '—' : reais(a.vgv_c))}
          ${this.kpi('Ciclo médio', a.ciclo_medio_dias === null ? '—' : `${a.ciclo_medio_dias} dias`)}
          ${this.kpi('Visitas feitas', a.visitas, variacao(a.visitas, b.visitas))}
          ${this.kpi('Captações', a.captacoes, variacao(a.captacoes, b.captacoes))}
          ${this.kpi('Comissão prevista', previsao.valor_c === null ? '—' : reais(previsao.valor_c),
            previsao.sem_dados ? `${previsao.sem_dados} negócio(s) sem valor ou comissão ficaram de fora` : 'Ponderada pela chance de cada etapa')}
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
        Tempo de primeiro atendimento e números do atendimento automático chegam com o WhatsApp; conteúdo publicado, com o Estúdio;
        custo por lead, comissão recebida e metas, em versões seguintes.
      </urbi-prosa>
    </urbi-stack>`;
  }
}
