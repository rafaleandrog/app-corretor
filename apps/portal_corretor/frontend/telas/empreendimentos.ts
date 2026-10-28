import { LitElement, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { UrbiVersoAPI } from '@urbiverso/sdk';
import { chamarApi, formularioEnviar, reais } from '../apoio.js';
import { estadoDaFalha, estadoTela } from '../estados.js';

declare const urbiVerso: UrbiVersoAPI;

type Linha = Record<string, any>;

export const FASE: Record<string, string> = { lancamento: 'Lançamento', obras: 'Em obras', pronto: 'Pronto' };
export const TIPO_EMPREENDIMENTO: Record<string, string> = { vertical: 'Prédio', horizontal: 'Condomínio de casas', loteamento: 'Loteamento' };
export const faixa = (e: Linha) =>
  e.preco_min_c || e.preco_max_c ? [e.preco_min_c ? reais(e.preco_min_c) : null, e.preco_max_c ? reais(e.preco_max_c) : null].filter(Boolean).join(' a ') : '—';

// Imóveis › Empreendimentos na moldura (P06): a lista à esquerda (busca e [Novo]), a ficha no centro
// (`pc-tela-ficha-empreendimento`) e o contexto à direita. Lançamentos que o próprio corretor cadastra
// (nome, construtora, fase, tipologias, faixa de preço) e os materiais que pode enviar ao cliente.
@customElement('pc-lista-empreendimentos')
export class PcListaEmpreendimentos extends LitElement {
  @property({ attribute: false }) selecionado: number | null = null;
  @property({ attribute: false }) aoEscolher: (id: number) => void = () => {};
  @state() private lista: Linha[] | null = null;
  @state() private falha: unknown = null;
  @state() private busca = '';
  private geracao = 0;

  connectedCallback() {
    super.connectedCallback();
    void this.carregar();
  }

  private async carregar() {
    const geracao = ++this.geracao;
    this.falha = null;
    try {
      const r = await chamarApi(`/empreendimentos${this.busca ? `?busca=${encodeURIComponent(this.busca)}` : ''}`);
      if (geracao === this.geracao) this.lista = r.dados; // resposta velha não sobrescreve a nova
    } catch (e) {
      if (geracao === this.geracao) this.falha = e;
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
    if (r?.id) {
      await this.carregar();
      this.aoEscolher(r.id);
    }
  }

  private conteudo() {
    if (this.falha && !this.lista) return estadoDaFalha(this.falha, () => this.carregar());
    if (!this.lista) return estadoTela('carregando');
    if (!this.lista.length) {
      return this.busca
        ? estadoTela('vazio', { icone: 'fa-solid fa-magnifying-glass', mensagem: 'Nenhum empreendimento com esta busca' })
        : estadoTela('vazio', {
            icone: 'fa-solid fa-city',
            mensagem: 'Nenhum empreendimento ainda',
            submensagem: 'Cadastre os lançamentos que você vende.',
            acao: { rotulo: 'Cadastrar empreendimento', icone: 'fa-solid fa-plus', aoEscolher: () => void this.novo() },
          });
    }
    return html`<urbi-lista separador clicavel .itens=${this.lista} .itemAtivo=${(e: Linha) => e.id === this.selecionado}
      .render_item=${(e: Linha) => html`<urbi-stack>
        <urbi-prosa truncar>${e.nome}</urbi-prosa>
        <urbi-prosa papel="fraco" truncar>${[e.construtora, [e.regiao, e.cidade].filter(Boolean).join(', ')].filter(Boolean).join(' · ') || '—'}</urbi-prosa>
        <urbi-linha quebrar>
          <urbi-badge cor="info">${FASE[e.fase] ?? e.fase}</urbi-badge>
          <urbi-prosa papel="fraco" inline>${faixa(e)}</urbi-prosa>
        </urbi-linha>
      </urbi-stack>`}
      @urbi:lista-click=${(ev: CustomEvent) => this.aoEscolher((ev.detail.item as Linha).id)}></urbi-lista>`;
  }

  render() {
    return html`<urbi-stack>
      <urbi-linha>
        <urbi-input expandir icone="fa-solid fa-magnifying-glass" placeholder="Nome, construtora ou cidade" valor=${this.busca}
          @urbi:input-change=${(e: CustomEvent) => {
            this.busca = e.detail.valor;
            void this.carregar();
          }}></urbi-input>
        <urbi-botao pequeno icone="fa-solid fa-plus" @click=${() => this.novo()}>Novo</urbi-botao>
      </urbi-linha>
      ${this.conteudo()}
    </urbi-stack>`;
  }
}

/**
 * Coluna da direita do empreendimento: o que se faz com ele a partir daqui. A ficha (centro) já traz
 * dados, materiais e unidades; aqui ficam os atalhos para vender: unidades na carteira e conteúdo.
 */
export function contextoEmpreendimento() {
  return html`<urbi-card titulo="Para vender este empreendimento" icone="fa-solid fa-bullhorn">
    <urbi-stack>
      <urbi-prosa papel="secundario">Ligue as unidades da carteira a ele (na ficha de cada imóvel, Editar dados) e envie os materiais ao cliente pela ficha dele.</urbi-prosa>
      <urbi-linha quebrar>
        <urbi-botao pequeno variante="secundario" icone="fa-solid fa-wand-magic-sparkles" href=${urbiVerso.href('/estudio')}>Criar conteúdo</urbi-botao>
      </urbi-linha>
    </urbi-stack>
  </urbi-card>`;
}
