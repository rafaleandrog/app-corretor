import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { UrbiColunaTabela, UrbiVersoAPI } from '@urbiverso/sdk';
import { CONFIGURACOES_PADRAO } from '../../comum/conta';
import { DIAS_NOVOS, FILTROS_PRONTOS, parametrosDoPronto, type FiltroPronto } from '../../comum/crm';
import {
  abaDaUrl,
  abaNaUrl,
  chamarApi,
  chamarFetch,
  chip,
  dataHora,
  filtrosDaUrl,
  filtrosNaUrl,
  formularioEnviar,
  opcoesChip,
  opcoesPapelNaTela,
  pedidoDeCriar,
  ROTULO_PAPEL,
  type OpcoesAba,
} from '../apoio.js';
import './clientes-quadro.js';

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

// Clientes em duas visões (D-83, spec 11.1): Lista e Quadro (o antigo Funil). A visão fica em
// `?visao=` (Lista é a ausência dela) e `/funil` é apelido que abre o Quadro.
const VISOES = [
  { id: 'lista', label: 'Lista', icone: 'fa-solid fa-list' },
  { id: 'quadro', label: 'Quadro', icone: 'fa-solid fa-table-columns' },
];
const OPCOES_VISAO: OpcoesAba = { chave: 'visao', apelidos: { '/funil': 'quadro' }, rota: '/clientes' };

/** A visão do endereço que está na barra agora. */
export const visaoAtual = () => abaDaUrl(VISOES.map((v) => v.id), OPCOES_VISAO);

/**
 * O `urbi-abas` vai direto no body da página (como Ajustes), para o quadro preencher e rolar por
 * dentro; `atualizar` redesenha o app. Só a visão aberta é montada e carrega o que é dela.
 */
export function renderClientes(atualizar: () => void) {
  const visao = visaoAtual();
  const selecionar = (e: CustomEvent) => {
    const id = e.detail?.id;
    if (!VISOES.some((v) => v.id === id) || id === visao) return;
    abaNaUrl(id === 'lista' ? '' : id, OPCOES_VISAO);
    atualizar();
  };
  return html`<urbi-abas formato-desktop="botoes" .abas=${VISOES} ativa=${visao} @urbi:aba-selecionar=${selecionar}>
    <urbi-hospedeiro slot=${visao}>
      ${visao === 'quadro' ? html`<pc-clientes-quadro></pc-clientes-quadro>` : html`<pc-tela-clientes></pc-tela-clientes>`}
    </urbi-hospedeiro>
  </urbi-abas>`;
}

const ROTULO_PRONTO: Record<FiltroPronto, string> = {
  novos: 'Novos',
  sem_contato: 'Sem contato',
  quentes: 'Quentes',
  retorno_vencido: 'Retorno vencido',
};

const ehPronto = (v: string | null): v is FiltroPronto => (FILTROS_PRONTOS as readonly string[]).includes(v ?? '');

// Clientes › Lista: todos os contatos da conta, com busca, filtros prontos e filtros na URL (spec
// 11: "estado de filtro na URL"), cadastro rápido, importação e exportação.
@customElement('pc-tela-clientes')
export class PcTelaClientes extends LitElement {
  @state() private contatos: Contato[] = [];
  @state() private total = 0;
  @state() private carregando = true;
  @state() private falha: string | null = null;
  /** O N de "Sem contato" é o de Ajustes › Atendimento; sem resposta, o padrão. */
  @state() private diasParado = CONFIGURACOES_PADRAO.dias_cliente_parado;
  private filtros = filtrosDaUrl();
  private geracao = 0;

  connectedCallback() {
    super.connectedCallback();
    void this.iniciar();
    // "Novo cliente" do menu Criar.
    if (pedidoDeCriar('cliente')) void this.novo();
  }

  private async iniciar() {
    try {
      const conta = await chamarApi('/conta');
      this.diasParado = conta?.configuracoes?.dias_cliente_parado ?? this.diasParado;
    } catch {
      // A lista não depende da configuração: segue com o padrão.
    }
    await this.carregar();
  }

  /** Os filtros da Lista viram a consulta; o filtro pronto entra por cima (spec 15.8). */
  private consulta() {
    const q = new URLSearchParams();
    for (const k of ['busca', 'papel', 'temperatura', 'origem', 'pagina']) if (this.filtros.get(k)) q.set(k, this.filtros.get(k)!);
    const pronto = this.filtros.get('pronto');
    for (const [k, v] of Object.entries(parametrosDoPronto(ehPronto(pronto) ? pronto : null, this.diasParado))) q.set(k, v);
    return q;
  }

  private async carregar() {
    const geracao = ++this.geracao;
    this.carregando = true;
    this.falha = null;
    try {
      const r = await chamarApi(`/contatos?${this.consulta()}`);
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
    // "Quentes" e o filtro de temperatura dizem a mesma coisa: escolher um tira o outro.
    const extra: string[] = [];
    if ('temperatura' in mudancas && this.filtros.get('pronto') === 'quentes') extra.push('pronto');
    if (mudancas.pronto === 'quentes') extra.push('temperatura');
    filtrosNaUrl(this.filtros, mudancas, ['pagina', ...extra]);
    void this.carregar();
  }

  private async novo() {
    const r = await formularioEnviar(
      'Novo contato',
      [
        { nome: 'nome', tipo: 'texto', rotulo: 'Nome', obrigatorio: true },
        { nome: 'telefone', tipo: 'texto', rotulo: 'Telefone (WhatsApp)', placeholder: '(61) 99999-9999' },
        { nome: 'email', tipo: 'texto', rotulo: 'E-mail' },
        { nome: 'papeis', tipo: 'selecao', rotulo: 'Papel', opcoes: opcoesPapelNaTela(), valor: 'comprador' },
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
      // Investidor, parceiro e fornecedor não se escolhem na tela, mas aparecem se o contato já os tiver.
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

  private explicacaoDoPronto(pronto: FiltroPronto) {
    switch (pronto) {
      case 'novos':
        return `Cadastrados nos últimos ${DIAS_NOVOS} dias.`;
      case 'sem_contato':
        return `Sem contato há mais de ${this.diasParado} dias (o prazo se ajusta em Ajustes › Atendimento).`;
      case 'quentes':
        return 'Contatos quentes.';
      case 'retorno_vencido':
        return 'O próximo passo combinado já passou da data.';
    }
  }

  render() {
    const papel = this.filtros.get('papel') ?? '';
    const temperatura = this.filtros.get('temperatura') ?? '';
    const origem = this.filtros.get('origem') ?? '';
    const pronto = this.filtros.get('pronto');
    const ativo = ehPronto(pronto) ? pronto : null;
    return html`<urbi-stack>
      <urbi-linha quebrar>
        <urbi-input expandir icone="fa-solid fa-magnifying-glass" placeholder="Buscar por nome, telefone ou e-mail"
          valor=${this.filtros.get('busca') ?? ''} @urbi:input-change=${(e: CustomEvent) => this.filtrar({ busca: e.detail.valor })}></urbi-input>
        <urbi-botao icone="fa-solid fa-user-plus" @click=${() => this.novo()}>Novo contato</urbi-botao>
        <urbi-botao variante="secundario" icone="fa-solid fa-file-import" href=${urbiVerso.href('/clientes/importar')}>Importar</urbi-botao>
        <urbi-botao variante="secundario" icone="fa-solid fa-file-export" @click=${() => this.exportar()}>Exportar</urbi-botao>
      </urbi-linha>
      <urbi-chips-atalho
        .opcoes=${[{ id: 'todos', rotulo: 'Todos' }, ...FILTROS_PRONTOS.map((id) => ({ id, rotulo: ROTULO_PRONTO[id] }))]}
        ativo=${ativo ?? 'todos'}
        @urbi:chip-atalho:click=${(e: CustomEvent) => this.filtrar({ pronto: e.detail.id === 'todos' ? '' : e.detail.id })}></urbi-chips-atalho>
      ${ativo ? html`<urbi-prosa papel="dica">${this.explicacaoDoPronto(ativo)}</urbi-prosa>` : ''}
      <urbi-linha quebrar>
        <urbi-select label="Papel" valor=${papel} placeholder="Todos" .opcoes=${opcoesPapelNaTela()}
          @urbi:select-change=${(e: CustomEvent) => this.filtrar({ papel: e.detail.valor })}></urbi-select>
        <urbi-select label="Temperatura" valor=${ativo === 'quentes' ? 'quente' : temperatura} placeholder="Todas"
          .opcoes=${opcoesChip('temperatura')}
          @urbi:select-change=${(e: CustomEvent) => this.filtrar({ temperatura: e.detail.valor })}></urbi-select>
        <urbi-select label="Origem" valor=${origem} placeholder="Todas" .opcoes=${opcoesChip('origem')}
          @urbi:select-change=${(e: CustomEvent) => this.filtrar({ origem: e.detail.valor })}></urbi-select>
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
