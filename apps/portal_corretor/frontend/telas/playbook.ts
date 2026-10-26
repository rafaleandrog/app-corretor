import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { UrbiColunaTabela, UrbiVersoAPI } from '@urbiverso/sdk';
import { chamarApi, formularioEnviar, opcoesChip, rotuloChip } from '../apoio.js';

declare const urbiVerso: UrbiVersoAPI;

type Linha = Record<string, any>;

const temperatura = (t: string) => rotuloChip('temperatura', t).rotulo;
const CANAL: Record<string, string> = { whatsapp: 'WhatsApp', ligacao: 'Ligação', email: 'E-mail', visita: 'Visita' };
const opcoesDe = (m: Record<string, string>) => Object.entries(m).map(([valor, rotulo]) => ({ valor, rotulo }));

// Abordagens do funil (playbook, spec 6.15): para cada etapa em andamento e temperatura, o que
// fazer e em quanto tempo. É o que aparece como "próxima abordagem" e alimenta a fila do dia.
@customElement('pc-playbook')
export class PcPlaybook extends LitElement {
  @state() private dados: { abordagens: Linha[]; etapas_sem_abordagem: Linha[] } | null = null;
  @state() private falha: string | null = null;

  connectedCallback() {
    super.connectedCallback();
    void this.carregar();
  }

  private async carregar() {
    this.falha = null;
    try {
      this.dados = await chamarApi('/funil/playbook');
    } catch (e) {
      this.falha = (e as Error).message;
    }
  }

  private campos(a?: Linha) {
    return [
      { nome: 'abordagem', tipo: 'texto_longo' as const, rotulo: 'O que fazer', obrigatorio: true, valor: a?.abordagem ?? '' },
      { nome: 'canal_sugerido', tipo: 'selecao' as const, rotulo: 'Por onde', valor: a?.canal_sugerido ?? 'whatsapp', opcoes: opcoesDe(CANAL) },
      { nome: 'prazo_horas', tipo: 'numero' as const, rotulo: 'Prazo (horas) para virar atrasada', valor: a?.prazo_horas ?? 24, min: 1, max: 720 },
    ];
  }

  private editar(a: Linha) {
    void formularioEnviar(`${a.etapa_nome} · ${temperatura(a.temperatura)}`, this.campos(a), 'PUT', `/funil/playbook/${a.id}`).then((r) => (r ? this.carregar() : undefined));
  }

  private nova() {
    const etapas = this.dados!.etapas_sem_abordagem;
    void formularioEnviar(
      'Nova abordagem',
      [
        { nome: 'etapa_id', tipo: 'selecao', rotulo: 'Etapa', obrigatorio: true, opcoes: etapas.map((e) => ({ valor: String(e.id), rotulo: e.nome })) },
        { nome: 'temperatura', tipo: 'selecao', rotulo: 'Temperatura', valor: 'morno', opcoes: opcoesChip('temperatura').reverse() },
        ...this.campos(),
      ],
      'POST',
      '/funil/playbook',
      (v) => ({ ...v, etapa_id: Number(v.etapa_id) }),
    ).then((r) => (r ? this.carregar() : undefined));
  }

  private colunas(): UrbiColunaTabela[] {
    return [
      { id: 'etapa', label: 'Etapa', valor: (l) => `${(l as Linha).etapa_nome}` },
      { id: 'temperatura', label: 'Temperatura', valor: (l) => ((l as Linha).temperatura ? temperatura((l as Linha).temperatura) : '') },
      { id: 'abordagem', label: 'Abordagem' },
      { id: 'canal', label: 'Por onde', valor: (l) => CANAL[(l as Linha).canal_sugerido] ?? '' },
      { id: 'prazo', label: 'Prazo', alinhamento: 'direita', valor: (l) => `${(l as Linha).prazo_horas} h` },
    ];
  }

  render() {
    if (this.falha) {
      return html`<urbi-banner variante="erro">
        ${this.falha}
        <urbi-botao slot="acao" pequeno variante="secundario" @click=${() => this.carregar()}>Tentar de novo</urbi-botao>
      </urbi-banner>`;
    }
    if (!this.dados) return html`<urbi-loading></urbi-loading>`;
    return html`<urbi-card titulo="Abordagens por etapa e temperatura" icone="fa-solid fa-route">
      ${this.dados.etapas_sem_abordagem.length
        ? html`<span slot="acoes"><urbi-botao variante="texto" pequeno icone="fa-solid fa-plus" @click=${() => this.nova()}>Nova abordagem</urbi-botao></span>`
        : ''}
      <urbi-prosa papel="secundario">Toque numa linha para editar. A abordagem vira atrasada depois do prazo, contado da entrada na etapa ou do último contato.</urbi-prosa>
      <urbi-tabela responsivo="multiline" clicavel .colunas=${this.colunas()} .linhas=${this.dados.abordagens}
        @urbi:tabela-click=${(e: CustomEvent) => this.editar(e.detail.linha as Linha)}></urbi-tabela>
    </urbi-card>`;
  }
}
