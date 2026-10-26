import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { UrbiColunaTabela, UrbiVersoAPI } from '@urbiverso/sdk';
import { chamarApi, chamarFetch, chip, dataHora, filtrosDaUrl, filtrosNaUrl, formularioEnviar, opcoes, opcoesChip, ROTULO_PAPEL } from '../apoio.js';

declare const urbiVerso: UrbiVersoAPI;

interface Contato {
  id: number;
  nome: string;
  telefone: string | null;
  email: string | null;
  papeis: string;
  temperatura: string | null;
  origem_canal: string | null;
  proximo_passo: string | null;
  proximo_passo_em: string | null;
}

// Clientes: todos os contatos da conta, com busca e filtros na URL (spec 11: "estado de filtro na
// URL"), cadastro rápido, importação e exportação.
@customElement('pc-tela-clientes')
export class PcTelaClientes extends LitElement {
  @state() private contatos: Contato[] = [];
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
      const r = await chamarApi(`/contatos?${this.filtros}`);
      if (geracao !== this.geracao) return;
      this.contatos = r.dados;
      this.total = r.total;
    } catch (e) {
      if (geracao === this.geracao) this.falha = (e as Error).message;
    } finally {
      if (geracao === this.geracao) this.carregando = false;
    }
  }

  private filtrar(mudancas: Record<string, string>) {
    filtrosNaUrl(this.filtros, mudancas, ['pagina']);
    void this.carregar();
  }

  private async novo() {
    const r = await formularioEnviar(
      'Novo contato',
      [
        { nome: 'nome', tipo: 'texto', rotulo: 'Nome', obrigatorio: true },
        { nome: 'telefone', tipo: 'texto', rotulo: 'Telefone (WhatsApp)', placeholder: '(61) 99999-9999' },
        { nome: 'email', tipo: 'texto', rotulo: 'E-mail' },
        { nome: 'papeis', tipo: 'selecao', rotulo: 'Papel', opcoes: opcoes(ROTULO_PAPEL), valor: 'comprador' },
        {
          nome: 'origem_canal',
          tipo: 'selecao',
          rotulo: 'Como chegou',
          valor: 'indicacao',
          opcoes: [
            { valor: 'indicacao', rotulo: 'Indicação' }, { valor: 'whatsapp', rotulo: 'WhatsApp' },
            { valor: 'instagram', rotulo: 'Instagram' }, { valor: 'portal', rotulo: 'Portal imobiliário' },
            { valor: 'placa', rotulo: 'Placa' }, { valor: 'evento', rotulo: 'Evento' }, { valor: 'outro', rotulo: 'Outro' },
          ],
        },
        { nome: 'origem_campanha', tipo: 'texto', rotulo: 'Campanha ou detalhe (opcional)' },
      ],
      'POST',
      '/contatos',
    );
    if (r?.id) urbiVerso.navegarSub(`/clientes/${r.id}`);
  }

  private async exportar() {
    try {
      const r = await chamarFetch('/contatos/exportar');
      if (!r.ok) throw new Error('A exportação falhou.');
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = 'contatos.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      await urbiVerso.alertar({ titulo: 'Não foi possível exportar', mensagem: (e as Error).message, tipo: 'erro' });
    }
  }

  private colunas(): UrbiColunaTabela[] {
    return [
      { id: 'nome', label: 'Nome' },
      { id: 'telefone', label: 'Telefone', valor: (l) => (l as Contato).telefone ?? (l as Contato).email ?? '—' },
      { id: 'papeis', label: 'Papel', valor: (l) => (l as Contato).papeis.split(',').map((p) => ROTULO_PAPEL[p] ?? p).join(', ') },
      {
        id: 'temperatura',
        label: 'Temperatura',
        render: (l) =>
          (l as Contato).temperatura ? html`${chip('temperatura', (l as Contato).temperatura)}` : html`<urbi-prosa papel="fraco" inline>sem classificação</urbi-prosa>`,
      },
      {
        id: 'proximo',
        label: 'Próximo passo',
        valor: (l) => {
          const c = l as Contato;
          return c.proximo_passo ? `${c.proximo_passo}${c.proximo_passo_em ? ` · ${dataHora(c.proximo_passo_em)}` : ''}` : '—';
        },
      },
    ];
  }

  render() {
    const papel = this.filtros.get('papel') ?? '';
    const temperatura = this.filtros.get('temperatura') ?? '';
    const parado = this.filtros.get('parado_dias') ?? '';
    return html`<urbi-stack>
      <urbi-linha quebrar>
        <urbi-input expandir icone="fa-solid fa-magnifying-glass" placeholder="Buscar por nome, telefone ou e-mail"
          valor=${this.filtros.get('busca') ?? ''} @urbi:input-change=${(e: CustomEvent) => this.filtrar({ busca: e.detail.valor })}></urbi-input>
        <urbi-botao icone="fa-solid fa-user-plus" @click=${() => this.novo()}>Novo contato</urbi-botao>
        <urbi-botao variante="secundario" icone="fa-solid fa-file-import" href=${urbiVerso.href('/clientes/importar')}>Importar</urbi-botao>
        <urbi-botao variante="secundario" icone="fa-solid fa-file-export" @click=${() => this.exportar()}>Exportar</urbi-botao>
      </urbi-linha>
      <urbi-linha quebrar>
        <urbi-select label="Papel" valor=${papel} placeholder="Todos" .opcoes=${opcoes(ROTULO_PAPEL)}
          @urbi:select-change=${(e: CustomEvent) => this.filtrar({ papel: e.detail.valor })}></urbi-select>
        <urbi-select label="Temperatura" valor=${temperatura} placeholder="Todas"
          .opcoes=${opcoesChip('temperatura')}
          @urbi:select-change=${(e: CustomEvent) => this.filtrar({ temperatura: e.detail.valor })}></urbi-select>
        <urbi-select label="Sem contato há" valor=${parado} placeholder="Qualquer tempo"
          .opcoes=${[{ valor: '7', rotulo: '7 dias' }, { valor: '15', rotulo: '15 dias' }, { valor: '30', rotulo: '30 dias' }, { valor: '90', rotulo: '90 dias' }]}
          @urbi:select-change=${(e: CustomEvent) => this.filtrar({ parado_dias: e.detail.valor })}></urbi-select>
      </urbi-linha>
      ${this.falha
        ? html`<urbi-banner variante="erro">
            ${this.falha}
            <urbi-botao slot="acao" pequeno variante="secundario" @click=${() => this.carregar()}>Tentar de novo</urbi-botao>
          </urbi-banner>`
        : html`<urbi-tabela responsivo="multiline" clicavel .colunas=${this.colunas()} .linhas=${this.contatos} ?carregando=${this.carregando}
              mensagem-vazio=${this.filtros.toString() ? 'Nenhum contato com estes filtros.' : 'Nenhum contato ainda. Cadastre o primeiro ou importe uma planilha.'}
              @urbi:tabela-click=${(e: CustomEvent) => urbiVerso.navegarSub(`/clientes/${(e.detail.linha as Contato).id}`)}></urbi-tabela>
            ${this.total > this.contatos.length
              ? html`<urbi-prosa papel="dica">Mostrando ${this.contatos.length} de ${this.total}. Refine a busca para achar os demais.</urbi-prosa>`
              : ''}`}
    </urbi-stack>`;
  }
}
