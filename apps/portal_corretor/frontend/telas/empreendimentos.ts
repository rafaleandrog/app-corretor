import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { UrbiColunaTabela, UrbiVersoAPI } from '@urbiverso/sdk';
import { formularioEnviar, reais } from '../apoio.js';

declare const urbiVerso: UrbiVersoAPI;

type Linha = Record<string, any>;

export const FASE: Record<string, string> = { lancamento: 'Lançamento', obras: 'Em obras', pronto: 'Pronto' };
export const TIPO_EMPREENDIMENTO: Record<string, string> = { vertical: 'Prédio', horizontal: 'Condomínio de casas', loteamento: 'Loteamento' };
export const faixa = (e: Linha) =>
  e.preco_min_c || e.preco_max_c ? [e.preco_min_c ? reais(e.preco_min_c) : null, e.preco_max_c ? reais(e.preco_max_c) : null].filter(Boolean).join(' a ') : '—';

// Imóveis › Empreendimentos: lançamentos que o próprio corretor cadastra (nome, construtora, fase,
// tipologias, faixa de preço) e os materiais que pode enviar ao cliente.
@customElement('pc-tela-empreendimentos')
export class PcTelaEmpreendimentos extends LitElement {
  @state() private lista: Linha[] | null = null;
  @state() private falha: string | null = null;
  @state() private busca = '';

  connectedCallback() {
    super.connectedCallback();
    void this.carregar();
  }

  private async carregar() {
    this.falha = null;
    try {
      this.lista = (await urbiVerso.api(`/empreendimentos${this.busca ? `?busca=${encodeURIComponent(this.busca)}` : ''}`)).dados;
    } catch (e) {
      this.falha = (e as Error).message;
    }
  }

  private async novo() {
    const r = await formularioEnviar(
      'Novo empreendimento',
      [
        { nome: 'nome', tipo: 'texto', rotulo: 'Nome', obrigatorio: true },
        { nome: 'construtora', tipo: 'texto', rotulo: 'Construtora ou incorporadora' },
        { nome: 'tipo', tipo: 'selecao', rotulo: 'Tipo', valor: 'vertical', opcoes: Object.entries(TIPO_EMPREENDIMENTO).map(([valor, rotulo]) => ({ valor, rotulo })) },
        { nome: 'fase', tipo: 'selecao', rotulo: 'Fase', valor: 'lancamento', opcoes: Object.entries(FASE).map(([valor, rotulo]) => ({ valor, rotulo })) },
        { nome: 'cidade', tipo: 'texto', rotulo: 'Cidade' },
        { nome: 'regiao', tipo: 'texto', rotulo: 'Bairro ou região' },
      ],
      'POST',
      '/empreendimentos',
    );
    if (r?.id) urbiVerso.navegarSub(`/empreendimentos/${r.id}`);
  }

  private colunas(): UrbiColunaTabela[] {
    return [
      { id: 'nome', label: 'Empreendimento' },
      { id: 'construtora', label: 'Construtora', valor: (l) => (l as Linha).construtora ?? '—' },
      { id: 'local', label: 'Local', valor: (l) => [(l as Linha).regiao, (l as Linha).cidade].filter(Boolean).join(', ') || '—' },
      { id: 'fase', label: 'Fase', render: (l) => html`<urbi-badge cor="info">${FASE[(l as Linha).fase] ?? (l as Linha).fase}</urbi-badge>` },
      { id: 'faixa', label: 'Preços', valor: (l) => faixa(l as Linha) },
    ];
  }

  render() {
    return html`<urbi-stack>
      <urbi-linha quebrar>
        <urbi-input expandir icone="fa-solid fa-magnifying-glass" placeholder="Buscar por nome, construtora ou cidade" valor=${this.busca}
          @urbi:input-change=${(e: CustomEvent) => {
            this.busca = e.detail.valor;
            void this.carregar();
          }}></urbi-input>
        <urbi-botao icone="fa-solid fa-plus" @click=${() => this.novo()}>Novo empreendimento</urbi-botao>
      </urbi-linha>
      ${this.falha
        ? html`<urbi-banner variante="erro">
            ${this.falha}
            <urbi-botao slot="acao" pequeno variante="secundario" @click=${() => this.carregar()}>Tentar de novo</urbi-botao>
          </urbi-banner>`
        : html`<urbi-tabela responsivo="multiline" clicavel .colunas=${this.colunas()} .linhas=${this.lista ?? []} ?carregando=${!this.lista}
            mensagem-vazio="Nenhum empreendimento. Cadastre os lançamentos que você vende."
            @urbi:tabela-click=${(e: CustomEvent) => urbiVerso.navegarSub(`/empreendimentos/${(e.detail.linha as Linha).id}`)}></urbi-tabela>`}
    </urbi-stack>`;
  }
}
