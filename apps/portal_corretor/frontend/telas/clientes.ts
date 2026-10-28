import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { keyed } from 'lit/directives/keyed.js';
import type { UrbiVersoAPI } from '@urbiverso/sdk';
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
  itemDaUrl,
  itemNaUrl,
  opcoesChip,
  opcoesPapelNaTela,
  pedidoDeCriar,
  ROTULO_PAPEL,
  type OpcoesAba,
} from '../apoio.js';
import { estadoTela } from '../estados.js';
import { moldura } from '../moldura.js';
import './clientes-quadro.js';
import './ficha-contato.js';

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

// Clientes em duas visões (D-83, spec 11.1 P03/P04): Lista e Funil (o quadro por etapa). A visão fica em
// `?visao=` (Lista é a ausência dela) e `/funil` é apelido que abre o Funil. A visão Negociações entra
// aqui com o item D3 do arco (#102).
const VISOES = [
  { id: 'lista', rotulo: 'Lista' },
  { id: 'quadro', rotulo: 'Funil' },
];
const OPCOES_VISAO: OpcoesAba = { chave: 'visao', apelidos: { '/funil': 'quadro' }, rota: '/clientes' };

/** A visão do endereço que está na barra agora. */
export const visaoAtual = () => abaDaUrl(VISOES.map((v) => v.id), OPCOES_VISAO);

/** Cliente selecionado na Lista (`?item=<id>`, spec 11.0.2); só ids numéricos abrem a ficha. */
export function clienteDaUrl(): number | null {
  const item = itemDaUrl();
  return item && /^\d+$/.test(item) ? Number(item) : null;
}

/**
 * Clientes na moldura do Padrão B (P04, D-106): a lista à esquerda, a ficha do cliente selecionado no
 * centro (cabeçalho e abas) e, à direita, perfil de busca, portal e privacidade. Na visão Funil, o
 * quadro ocupa o centro e a direita recolhe. `atualizar` redesenha o app: escolher um cliente só troca o
 * `?item=` e redesenha, sem navegar (a lista fica onde estava).
 */
export function renderClientes(atualizar: () => void) {
  const visao = visaoAtual();
  const id = visao === 'lista' ? clienteDaUrl() : null;
  const trocarVisao = (v: string) => {
    if (!VISOES.some((x) => x.id === v) || v === visao) return;
    abaNaUrl(v === 'lista' ? '' : v, OPCOES_VISAO);
    atualizar();
  };
  const escolher = (contato: number | null) => {
    // Escolher na visão Funil (ou criar um contato) leva à Lista, onde a ficha mora.
    if (visao !== 'lista') abaNaUrl('', OPCOES_VISAO);
    itemNaUrl(contato);
    atualizar();
  };
  const lista = html`<pc-tela-clientes .visao=${visao} .selecionado=${id} .aoEscolher=${escolher} .aoTrocarVisao=${trocarVisao}></pc-tela-clientes>`;
  if (visao === 'quadro') {
    return moldura({ menu: '/clientes', lista, centro: html`<pc-clientes-quadro></pc-clientes-quadro>`, rotulos: { lista: 'Clientes', centro: 'Funil' } }, atualizar);
  }
  // Trocar de cliente recria as duas colunas da ficha (`keyed`): nada do anterior fica na tela.
  const centro = id
    ? keyed(id, html`<pc-ficha-contato-foco .contatoId=${id}></pc-ficha-contato-foco>`)
    : estadoTela('vazio', {
        icone: 'fa-solid fa-address-book',
        mensagem: 'Escolha um cliente',
        submensagem: 'A ficha abre aqui: próximo passo, linha do tempo, o que foi enviado e os negócios.',
      });
  const contexto = id
    ? keyed(id, html`<pc-ficha-contato-contexto .contatoId=${id}></pc-ficha-contato-contexto>`)
    : html`<urbi-prosa papel="dica">Com um cliente aberto, aqui ficam o perfil de busca, o portal do cliente e a privacidade.</urbi-prosa>`;
  return moldura(
    { menu: '/clientes', lista, centro, contexto, rotulos: { lista: 'Clientes', centro: 'Ficha', contexto: 'Portal' }, painel: id ? 'centro' : 'esquerda' },
    atualizar,
  );
}

const ROTULO_PRONTO: Record<FiltroPronto, string> = {
  novos: 'Novos',
  sem_contato: 'Sem contato',
  quentes: 'Quentes',
  retorno_vencido: 'Retorno vencido',
};

/** Filtro de papel da lista (P04: Todos · Compradores · Proprietários). */
const PAPEL_NO_PLURAL: Record<string, string> = { comprador: 'Compradores', proprietario: 'Proprietários' };

const ehPronto = (v: string | null): v is FiltroPronto => (FILTROS_PRONTOS as readonly string[]).includes(v ?? '');

// Coluna esquerda de Clientes (P04): título com Importar e Novo, as visões, a busca, os filtros prontos
// e o papel, e a lista com a temperatura. Os filtros ficam na URL (spec 11: "estado de filtro na URL"),
// junto com o `?item=` do cliente aberto. Escolher um cliente chama `aoEscolher`, que troca a ficha.
@customElement('pc-tela-clientes')
export class PcTelaClientes extends LitElement {
  @property() visao = 'lista';
  @property({ attribute: false }) selecionado: number | null = null;
  @property({ attribute: false }) aoEscolher: (id: number | null) => void = () => {};
  @property({ attribute: false }) aoTrocarVisao: (visao: string) => void = () => {};
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
    // Relê a URL: o cliente aberto (`?item=`) e a visão mudam por fora deste componente.
    this.filtros = filtrosDaUrl();
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
    if (!r?.id) return;
    await this.carregar();
    this.aoEscolher(r.id);
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

  /** Uma linha da lista: nome e temperatura; embaixo, o próximo passo ou o contato e a origem. */
  private linha(c: Contato) {
    const embaixo = c.proximo_passo
      ? `${c.proximo_passo}${c.proximo_passo_em ? ` · ${dataHora(c.proximo_passo_em)}` : ''}`
      : [c.telefone ?? c.email, c.papeis.split(',').map((p) => ROTULO_PAPEL[p] ?? p).join(', ')].filter(Boolean).join(' · ');
    return html`<urbi-stack>
      <urbi-linha justificar="entre" quebrar>
        <urbi-prosa>${c.nome}</urbi-prosa>
        ${c.temperatura ? chip('temperatura', c.temperatura) : nothing}
      </urbi-linha>
      <urbi-linha quebrar>
        ${c.origem_canal ? chip('origem', c.origem_canal) : nothing}
        <urbi-prosa papel="fraco" inline>${embaixo || '—'}</urbi-prosa>
      </urbi-linha>
    </urbi-stack>`;
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
      <urbi-linha justificar="entre" quebrar>
        <urbi-prosa papel="titulo">Clientes</urbi-prosa>
        <urbi-linha>
          <urbi-botao pequeno variante="secundario" icone="fa-solid fa-file-import" href=${urbiVerso.href('/clientes/importar')}>Importar</urbi-botao>
          <urbi-botao pequeno icone="fa-solid fa-user-plus" @click=${() => this.novo()}>Novo</urbi-botao>
          <urbi-botao pequeno variante="fantasma" icone="fa-solid fa-file-export" ariaLabel="Exportar contatos" title="Exportar contatos" @click=${() => this.exportar()}></urbi-botao>
        </urbi-linha>
      </urbi-linha>
      <urbi-chips-atalho .opcoes=${VISOES} ativo=${this.visao} @urbi:chip-atalho:click=${(e: CustomEvent) => this.aoTrocarVisao(e.detail.id)}></urbi-chips-atalho>
      <urbi-input icone="fa-solid fa-magnifying-glass" placeholder="Nome, telefone ou e-mail"
        valor=${this.filtros.get('busca') ?? ''} @urbi:input-change=${(e: CustomEvent) => this.filtrar({ busca: e.detail.valor })}></urbi-input>
      <urbi-chips-atalho
        .opcoes=${[{ id: 'todos', rotulo: 'Todos' }, ...FILTROS_PRONTOS.map((id) => ({ id, rotulo: ROTULO_PRONTO[id] }))]}
        ativo=${ativo ?? 'todos'}
        @urbi:chip-atalho:click=${(e: CustomEvent) => this.filtrar({ pronto: e.detail.id === 'todos' ? '' : e.detail.id })}></urbi-chips-atalho>
      <urbi-chips-atalho
        .opcoes=${[{ id: 'todos', rotulo: 'Todos' }, ...opcoesPapelNaTela().map((o) => ({ id: o.valor, rotulo: PAPEL_NO_PLURAL[o.valor] ?? o.rotulo }))]}
        ativo=${papel || 'todos'}
        @urbi:chip-atalho:click=${(e: CustomEvent) => this.filtrar({ papel: e.detail.id === 'todos' ? '' : e.detail.id })}></urbi-chips-atalho>
      ${ativo ? html`<urbi-prosa papel="dica">${this.explicacaoDoPronto(ativo)}</urbi-prosa>` : ''}
      <urbi-linha quebrar>
        <urbi-select label="Temperatura" valor=${ativo === 'quentes' ? 'quente' : temperatura} placeholder="Todas"
          .opcoes=${opcoesChip('temperatura')}
          @urbi:select-change=${(e: CustomEvent) => this.filtrar({ temperatura: e.detail.valor })}></urbi-select>
        <urbi-select label="Origem" valor=${origem} placeholder="Todas" .opcoes=${opcoesChip('origem')}
          @urbi:select-change=${(e: CustomEvent) => this.filtrar({ origem: e.detail.valor })}></urbi-select>
      </urbi-linha>
      ${this.falha
        ? estadoTela('erro', { aoTentar: () => void this.carregar() })
        : html`<urbi-lista clicavel separador .itens=${this.contatos} ?carregando=${this.carregando}
              mensagem-vazio=${this.filtros.toString().replace(/(^|&)(item|visao|secao)=[^&]*/g, '') ? 'Nenhum contato com estes filtros.' : 'Nenhum contato ainda. Cadastre o primeiro (Novo) ou importe uma planilha.'}
              .itemAtivo=${(c: Contato) => c.id === this.selecionado}
              .indicador=${(c: Contato) => (c.id === this.selecionado ? 'var(--cor-primaria)' : '')}
              .render_item=${(c: Contato) => this.linha(c)}
              @urbi:lista-click=${(e: CustomEvent) => this.aoEscolher((e.detail.item as Contato).id)}></urbi-lista>
            ${this.total > this.contatos.length
              ? html`<urbi-prosa papel="dica">Mostrando ${this.contatos.length} de ${this.total}. Refine a busca para achar os demais.</urbi-prosa>`
              : ''}`}
    </urbi-stack>`;
  }
}
