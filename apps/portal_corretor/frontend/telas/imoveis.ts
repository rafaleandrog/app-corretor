import { LitElement, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { UrbiVersoAPI } from '@urbiverso/sdk';
import { ABAS_IMOVEIS, APELIDOS_IMOVEIS } from '../../comum/imoveis';
import {
  abaDaUrl,
  abaNaUrl,
  cartaoImovel,
  chamarApi,
  filtrosDaUrl,
  filtrosNaUrl,
  formularioEnviar,
  opcoes,
  ROTULO_TIPO_IMOVEL,
  SITUACAO_IMOVEL,
  type ImovelCartao,
  type OpcoesAba,
} from '../apoio.js';
import './empreendimentos.js';

declare const urbiVerso: UrbiVersoAPI;

// Imóveis em duas abas (D-84, spec 11.1): Carteira e Empreendimentos. A aba fica em `?aba=`
// (Carteira é a ausência dela) e `/empreendimentos` é apelido que abre a aba Empreendimentos.
const ABAS = [...ABAS_IMOVEIS];
const OPCOES_ABA: OpcoesAba = { apelidos: APELIDOS_IMOVEIS, rota: '/imoveis' };

/** A aba do endereço que está na barra agora. */
export const abaImoveis = () => abaDaUrl(ABAS.map((a) => a.id), OPCOES_ABA);

/** O `urbi-abas` vai direto no body da página (como Clientes); só a aba aberta é montada e carrega o que é dela. */
export function renderImoveis(atualizar: () => void) {
  const aba = abaImoveis();
  const selecionar = (e: CustomEvent) => {
    const id = e.detail?.id;
    if (!ABAS.some((a) => a.id === id) || id === aba) return;
    abaNaUrl(id === 'carteira' ? '' : id, OPCOES_ABA);
    atualizar();
  };
  return html`<urbi-abas formato-desktop="botoes" .abas=${ABAS} ativa=${aba} @urbi:aba-selecionar=${selecionar}>
    <urbi-hospedeiro slot=${aba}>
      ${aba === 'empreendimentos' ? html`<pc-tela-empreendimentos></pc-tela-empreendimentos>` : html`<pc-tela-imoveis></pc-tela-imoveis>`}
    </urbi-hospedeiro>
  </urbi-abas>`;
}

interface Imovel extends ImovelCartao {
  qualidade: { nota: number; faltas: string[] };
}

// Imóveis › Carteira: cartões com capa, preço, local, cômodos, situação e qualidade; busca e
// situação na URL. Cadastro rápido: só o essencial aqui, e as fotos logo em seguida na ficha.
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

  /** Só a busca e a situação vão ao backend: a aba é da tela. */
  private consulta() {
    const q = new URLSearchParams();
    for (const k of ['busca', 'situacao']) if (this.filtros.get(k)) q.set(k, this.filtros.get(k)!);
    return q;
  }

  private async carregar() {
    const geracao = ++this.geracao;
    this.carregando = true;
    this.falha = null;
    try {
      const r = await chamarApi(`/imoveis?${this.consulta()}`);
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

  private grade() {
    if (this.carregando && !this.imoveis.length) return html`<urbi-loading></urbi-loading>`;
    if (!this.imoveis.length) {
      return this.consulta().toString()
        ? html`<urbi-estado-vazio icone="fa-solid fa-magnifying-glass" mensagem="Nenhum imóvel com estes filtros"
            submensagem="Mude a busca ou a situação."></urbi-estado-vazio>`
        : html`<urbi-estado-vazio icone="fa-solid fa-house" mensagem="Cadastre o primeiro imóvel"
            submensagem="Leva poucos minutos: tipo, cidade e as fotos. Use Novo imóvel, aqui em cima."></urbi-estado-vazio>`;
    }
    // Cartão com capa pelo `urbi-avatar` grande: exceção nomeada D-65 até o pedido ao shell 7.
    return html`<urbi-grid min="280px">
        ${this.imoveis.map((i) => cartaoImovel(i, () => urbiVerso.navegarSub(`/imoveis/${i.id}`)))}
      </urbi-grid>
      ${this.total > this.imoveis.length
        ? html`<urbi-prosa papel="dica">Mostrando ${this.imoveis.length} de ${this.total}. Refine a busca para achar os demais.</urbi-prosa>`
        : nothing}`;
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
        : this.grade()}
    </urbi-stack>`;
  }
}
