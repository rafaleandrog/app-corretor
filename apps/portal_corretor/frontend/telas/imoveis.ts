import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { UrbiColunaTabela, UrbiVersoAPI } from '@urbiverso/sdk';
import { chamarApi, corQualidade, filtrosDaUrl, filtrosNaUrl, formularioEnviar, opcoes, reais, ROTULO_TIPO_IMOVEL, SITUACAO_IMOVEL } from '../apoio.js';

declare const urbiVerso: UrbiVersoAPI;

interface Imovel {
  id: number;
  codigo: string;
  titulo: string | null;
  tipo: string;
  situacao: string;
  bairro: string | null;
  cidade: string | null;
  preco_c: number | null;
  publicavel: boolean;
  capa_url: string | null;
  qualidade: { nota: number; faltas: string[] };
}

// Imóveis › Minha carteira: lista com capa, situação e qualidade; busca e situação na URL.
// Cadastro rápido: só o essencial aqui, e as fotos logo em seguida na ficha.
@customElement('pc-tela-imoveis')
export class PcTelaImoveis extends LitElement {
  @state() private imoveis: Imovel[] = [];
  @state() private total = 0;
  @state() private carregando = true;
  @state() private falha: string | null = null;
  private filtros = filtrosDaUrl();
  private geracao = 0;

  connectedCallback() {
    super.connectedCallback();
    void this.carregar();
  }

  private async carregar() {
    const geracao = ++this.geracao;
    this.carregando = true;
    this.falha = null;
    try {
      const r = await chamarApi(`/imoveis?${this.filtros}`);
      if (geracao !== this.geracao) return;
      this.imoveis = r.dados;
      this.total = r.total;
    } catch (e) {
      if (geracao === this.geracao) this.falha = (e as Error).message;
    } finally {
      if (geracao === this.geracao) this.carregando = false;
    }
  }

  private filtrar(mudancas: Record<string, string>) {
    filtrosNaUrl(this.filtros, mudancas);
    void this.carregar();
  }

  private async novo() {
    const r = await formularioEnviar(
      'Novo imóvel',
      [
        { nome: 'tipo', tipo: 'selecao', rotulo: 'Tipo', obrigatorio: true, opcoes: opcoes(ROTULO_TIPO_IMOVEL), valor: 'apartamento' },
        { nome: 'titulo', tipo: 'texto', rotulo: 'Título (opcional)', placeholder: 'Ex.: Apartamento 3 quartos com vista' },
        { nome: 'bairro', tipo: 'texto', rotulo: 'Bairro' },
        { nome: 'cidade', tipo: 'texto', rotulo: 'Cidade', obrigatorio: true },
        { nome: 'uf', tipo: 'texto', rotulo: 'UF', placeholder: 'DF' },
        { nome: 'codigo', tipo: 'texto', rotulo: 'Seu código (opcional)', placeholder: 'Em branco: IM-0001, IM-0002…' },
      ],
      'POST',
      '/imoveis',
      undefined,
      { mensagem: 'Depois de criar, você já envia as fotos.', rotuloConfirmar: 'Criar e enviar fotos' },
    );
    if (r?.id) urbiVerso.navegarSub(`/imoveis/${r.id}`);
  }

  private colunas(): UrbiColunaTabela[] {
    return [
      {
        id: 'capa',
        label: '',
        semRotuloMobile: true,
        // Miniatura pelo urbi-avatar (exceção nomeada até haver primitivo de galeria — spec 11.5).
        render: (l) => html`<urbi-avatar nome=${(l as Imovel).codigo} foto=${(l as Imovel).capa_url ?? ''} icone=${(l as Imovel).capa_url ? '' : 'fa-solid fa-image'} tamanho="48"></urbi-avatar>`,
      },
      {
        id: 'codigo',
        label: 'Imóvel',
        valor: (l) => {
          const i = l as Imovel;
          return `${i.codigo} · ${i.titulo ?? ROTULO_TIPO_IMOVEL[i.tipo] ?? i.tipo}`;
        },
      },
      { id: 'local', label: 'Local', valor: (l) => [(l as Imovel).bairro, (l as Imovel).cidade].filter(Boolean).join(', ') || '—' },
      { id: 'preco', label: 'Preço', alinhamento: 'direita', valor: (l) => ((l as Imovel).preco_c ? reais((l as Imovel).preco_c) : 'sob consulta') },
      {
        id: 'situacao',
        label: 'Situação',
        render: (l) => {
          const i = l as Imovel;
          const s = SITUACAO_IMOVEL[i.situacao] ?? { rotulo: i.situacao, cor: 'padrao' };
          return html`<urbi-linha quebrar>
            <urbi-badge cor=${s.cor}>${s.rotulo}</urbi-badge>
            ${i.publicavel ? html`<urbi-badge cor="sucesso">Na página</urbi-badge>` : ''}
          </urbi-linha>`;
        },
      },
      {
        id: 'qualidade',
        label: 'Qualidade',
        render: (l) => html`<urbi-badge cor=${corQualidade((l as Imovel).qualidade.nota)}>${(l as Imovel).qualidade.nota}</urbi-badge>`,
      },
    ];
  }

  render() {
    return html`<urbi-stack>
      <urbi-linha quebrar>
        <urbi-input expandir icone="fa-solid fa-magnifying-glass" placeholder="Buscar por código, título, bairro ou cidade"
          valor=${this.filtros.get('busca') ?? ''} @urbi:input-change=${(e: CustomEvent) => this.filtrar({ busca: e.detail.valor })}></urbi-input>
        <urbi-select label="Situação" valor=${this.filtros.get('situacao') ?? ''} placeholder="Todas"
          .opcoes=${Object.entries(SITUACAO_IMOVEL).map(([valor, s]) => ({ valor, rotulo: s.rotulo }))}
          @urbi:select-change=${(e: CustomEvent) => this.filtrar({ situacao: e.detail.valor })}></urbi-select>
        <urbi-botao icone="fa-solid fa-plus" @click=${() => this.novo()}>Novo imóvel</urbi-botao>
      </urbi-linha>
      ${this.falha
        ? html`<urbi-banner variante="erro">
            ${this.falha}
            <urbi-botao slot="acao" pequeno variante="secundario" @click=${() => this.carregar()}>Tentar de novo</urbi-botao>
          </urbi-banner>`
        : html`<urbi-tabela responsivo="multiline" clicavel .colunas=${this.colunas()} .linhas=${this.imoveis} ?carregando=${this.carregando}
              mensagem-vazio=${this.filtros.toString() ? 'Nenhum imóvel com estes filtros.' : 'Nenhum imóvel ainda. Cadastre o primeiro: leva poucos minutos.'}
              @urbi:tabela-click=${(e: CustomEvent) => urbiVerso.navegarSub(`/imoveis/${(e.detail.linha as Imovel).id}`)}></urbi-tabela>
            ${this.total > this.imoveis.length
              ? html`<urbi-prosa papel="dica">Mostrando ${this.imoveis.length} de ${this.total}. Refine a busca para achar os demais.</urbi-prosa>`
              : ''}`}
    </urbi-stack>`;
  }
}
