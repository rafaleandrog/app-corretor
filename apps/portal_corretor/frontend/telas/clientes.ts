import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { keyed } from 'lit/directives/keyed.js';
import type { CampoFormulario, UrbiVersoAPI } from '@urbiverso/sdk';
import { CONFIGURACOES_PADRAO } from '../../comum/conta';
import { DIAS_NOVOS, FILTROS_PRONTOS, formatarTelefone, parametrosDoPronto, type FiltroPronto } from '../../comum/crm';
import {
  abaDaUrl,
  abaNaUrl,
  chamarApi,
  chip,
  dataHora,
  duplicataDeContato,
  enviar,
  filtrosDaUrl,
  filtrosNaUrl,
  formularioQueSalva,
  gesto,
  itemNaUrl,
  mensagemDeErro,
  opcoesChip,
  opcoesPapelNaTela,
  pedidoDeCriar,
  ROTULO_MOTIVO_PERDA,
  ROTULO_ORIGEM,
  ROTULO_PAPEL,
  soNegociador,
  type Gesto,
  type OpcoesAba,
} from '../apoio.js';
import { buscaDaVisao, contatoDoItem } from '../enderecos.js';
import { estadoTela } from '../estados.js';
import { cabecalhoColuna, moldura } from '../moldura.js';
import { chaveDoQuadro, contatoDoFunil } from './clientes-quadro.js';
import { novaProposta } from './negociacoes.js';
import './ficha-contato.js';
import { registrarLista, soltarLista } from '../atalhos.js';

/** Parâmetros do filtro "Ver os N clientes" de Números (P10), repassados a `GET /contatos`. */
const FILTRO_PERDIDOS = ['perdido_motivo', 'perdido_desde', 'perdido_origem'];

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
  etapa_nome?: string | null;
}

// Clientes em três visões (D-83, D-96, spec 11.1 P03/P04/P15): Lista, Funil (o quadro por etapa) e
// Negociações. A visão fica em `?visao=` (Lista é a ausência dela; o Funil é `?visao=funil`) e `/funil` é
// apelido que abre o Funil, assim como o `?visao=quadro` de antes.
const VISOES = [
  { id: 'funil', rotulo: 'Funil' },
  { id: 'lista', rotulo: 'Lista' },
  { id: 'negociacoes', rotulo: 'Negociações' },
];
const OPCOES_VISAO: OpcoesAba = { chave: 'visao', apelidos: { '/funil': 'funil' }, rota: '/clientes' };

/** A visão do endereço que está na barra agora: sem ela, a Lista (`quadro`, o nome antigo do Funil, abre o Funil). */
export const visaoAtual = () => (filtrosDaUrl().get('visao') === 'quadro' ? 'funil' : abaDaUrl(['lista', 'funil', 'negociacoes'], OPCOES_VISAO));

/**
 * Cliente selecionado na Lista (`?item=<id>`, spec 11.0.2); só ids numéricos abrem a ficha, e só quando a
 * visão do endereço é a Lista (`contatoDoItem`): `?visao=negociacoes&item=<negociacao>` abre a negociação.
 */
export const clienteDaUrl = (): number | null => contatoDoItem(window.location.search);

/**
 * Chave da coluna da direita do Funil: muda com o contato e a cada chegada com `?sugerir=1` (tocar de novo
 * no cartão atrasado do cliente já aberto). A coluna é recriada, a ficha nova lê e tira o `sugerir` do
 * endereço e sugere a mensagem para ESTE cliente; redesenhar sem `sugerir` mantém a chave e a visita.
 */
let direitaDoFunil = { item: 0, visita: 0 };
const chaveDaDireita = (item: number) => {
  if (item !== direitaDoFunil.item || filtrosDaUrl().get('sugerir') === '1') direitaDoFunil = { item, visita: direitaDoFunil.visita + 1 };
  return direitaDoFunil.visita;
};

/**
 * Clientes na moldura do Padrão B (P04, D-106): a lista à esquerda, a ficha do cliente selecionado no
 * centro (cabeçalho e abas) e, à direita, perfil de busca, portal e privacidade. Na visão Funil (P03),
 * os filtros ficam à esquerda, o quadro no centro e o cliente do cartão escolhido à direita.
 * `atualizar` redesenha o app: escolher um cliente só troca o `?item=` e redesenha, sem navegar (a
 * lista fica onde estava).
 */
export function renderClientes(atualizar: () => void) {
  const visao = visaoAtual();
  const id = visao === 'lista' ? clienteDaUrl() : null;
  const trocarVisao = (v: string) => {
    if (!VISOES.some((x) => x.id === v)) return;
    // O `item` só segue para a Lista se já era contato nela (`buscaDaVisao`): o de negociação ou do Funil sai.
    const mantemItem = new URLSearchParams(buscaDaVisao(window.location.search, visao, v)).has('item');
    // O `?sugerir=1` é da chegada ao cliente aberto: nunca segue para outra visão (nem a outro cliente).
    filtrosNaUrl(filtrosDaUrl(), {}, ['sugerir']);
    abaNaUrl(v === 'lista' ? '' : v, OPCOES_VISAO);
    if (!mantemItem) itemNaUrl(null);
    atualizar();
  };
  const escolher = (contato: number | null) => {
    // Escolher na visão Funil (ou criar um contato) leva à Lista, onde a ficha mora; uma `visao` desconhecida também sai.
    // O `?sugerir=1` era do cliente anterior: a ficha do escolhido não pede a IA sozinha.
    filtrosNaUrl(filtrosDaUrl(), {}, ['sugerir']);
    if (filtrosDaUrl().has('visao') || visao !== 'lista') abaNaUrl('', OPCOES_VISAO);
    itemNaUrl(contato);
    atualizar();
  };
  const novo = () => void novoContato(escolher).then((r) => r?.id && escolher(r.id));
  if (visao === 'negociacoes') {
    const topo = html`${topoClientes(visao, trocarVisao, novo)}`;
    return molduraNegociacoes(atualizar, topo, '/clientes');
  }
  if (visao === 'funil') {
    // P03: os filtros do Funil à esquerda, o quadro no centro (recriado quando os filtros mudam, com
    // `expandir` para encher a altura, #180) e o cliente do cartão escolhido à direita.
    const item = contatoDoFunil();
    const esquerda = html`<urbi-stack>
      ${topoClientes(visao, trocarVisao, novo)}
      <pc-clientes-funil-filtros .aoMudar=${atualizar}></pc-clientes-funil-filtros>
    </urbi-stack>`;
    const centro = keyed(chaveDoQuadro(), html`<pc-clientes-quadro expandir></pc-clientes-quadro>`);
    const contexto = item
      ? keyed(chaveDaDireita(item), html`<pc-ficha-contato-funil .contatoId=${item}></pc-ficha-contato-funil>`)
      : html`<urbi-prosa papel="dica">Clique num cartão para ver o cliente aqui: por que está quente ou frio, a próxima abordagem e o que ele abriu.</urbi-prosa>`;
    return moldura(
      { menu: '/clientes', lista: esquerda, centro, contexto, rotulos: { lista: 'Filtros', centro: 'Funil', contexto: 'Cliente' }, painel: item ? 'direita' : 'centro' },
      atualizar,
    );
  }
  const lista = html`<pc-tela-clientes .visao=${visao} .selecionado=${id} .aoEscolher=${escolher} .aoTrocarVisao=${trocarVisao}></pc-tela-clientes>`;
  // Trocar de cliente recria as duas colunas da ficha (`keyed`): nada do anterior fica na tela.
  const centro = id
    ? keyed(id, html`<pc-ficha-contato-foco .contatoId=${id}></pc-ficha-contato-foco>`)
    : estadoTela('vazio', {
        icone: 'fa-solid fa-address-book',
        mensagem: 'Escolha um cliente',
        submensagem: 'A ficha abre aqui: linha do tempo, próximo passo, o que foi enviado e os negócios.',
      });
  const contexto = id
    ? keyed(id, html`<pc-ficha-contato-contexto .contatoId=${id}></pc-ficha-contato-contexto>`)
    : html`<urbi-prosa papel="dica">Com um cliente aberto, aqui ficam o perfil de busca, o portal do cliente e a privacidade.</urbi-prosa>`;
  return moldura(
    { menu: '/clientes', lista, centro, contexto, rotulos: { lista: 'Clientes', centro: 'Ficha', contexto: 'Portal' }, painel: id ? 'centro' : 'esquerda' },
    atualizar,
  );
}

/**
 * P15 (M8 no celular): a lista à esquerda, a negociação escolhida (`?item=<negociacao>`) no centro e o
 * mandato à direita. Em Clientes › Negociações e no endereço `/negociacoes`, que é o menu do negociador
 * humano (D7): para ele, sem "Nova proposta" (abrir negociação é do corretor) e só as atribuídas.
 */
function molduraNegociacoes(atualizar: () => void, topo: unknown, menu: string) {
  const item = Number(filtrosDaUrl().get('item')) || null;
  const escolherNegociacao = (n: number) => {
    itemNaUrl(n);
    atualizar();
  };
  const esquerda = html`<urbi-stack>
    ${topo}
    ${soNegociador()
      ? nothing
      : html`<urbi-botao icone="fa-solid fa-file-signature" @click=${() => void novaProposta().then((n) => n && escolherNegociacao(n))}>Nova proposta</urbi-botao>`}
    <pc-negociacoes-lista atalhos .selecionado=${item} .aoEscolher=${escolherNegociacao}></pc-negociacoes-lista>
  </urbi-stack>`;
  const centro = item
    ? keyed(item, html`<pc-negociacao-foco .negociacaoId=${item}></pc-negociacao-foco>`)
    : estadoTela('vazio', { icone: 'fa-solid fa-handshake', mensagem: 'Escolha uma negociação', submensagem: 'A faixa, a escada de propostas e a sugestão do Negociador abrem aqui.' });
  const contexto = item
    ? keyed(item, html`<pc-negociacao-contexto .negociacaoId=${item}></pc-negociacao-contexto>`)
    : html`<urbi-prosa papel="dica">Com uma negociação aberta, aqui ficam o mandato, a leitura do comprador e o próximo movimento.</urbi-prosa>`;
  return moldura(
    { menu, lista: esquerda, centro, contexto, rotulos: { lista: 'Negociações', centro: 'Negociação', contexto: 'Mandato' }, painel: item ? 'centro' : 'esquerda' },
    atualizar,
  );
}

/** O endereço `/negociacoes` (menu do negociador humano, D7): só a visão Negociações, sem o resto de Clientes. */
export function renderNegociacoes(atualizar: () => void) {
  const topo = cabecalhoColuna(soNegociador() ? 'Negociações atribuídas a você' : 'Negociações');
  return molduraNegociacoes(atualizar, topo, soNegociador() ? '/negociacoes' : '/clientes');
}

const OPCOES_ORIGEM_NOVO = [
  { valor: 'indicacao', rotulo: 'Indicação' }, { valor: 'whatsapp', rotulo: 'WhatsApp' },
  { valor: 'instagram', rotulo: 'Instagram' }, { valor: 'portal', rotulo: 'Portal imobiliário' },
  { valor: 'placa', rotulo: 'Placa' }, { valor: 'evento', rotulo: 'Evento' }, { valor: 'outro', rotulo: 'Outro' },
];

/** Os campos do novo contato, com os valores já digitados (o formulário reabre com eles quando o servidor recusa). */
function camposDoContato(v: Record<string, unknown>): CampoFormulario[] {
  const texto = (k: string) => (typeof v[k] === 'string' ? (v[k] as string) : '');
  return [
    { nome: 'nome', tipo: 'texto', rotulo: 'Nome', obrigatorio: true, valor: texto('nome') },
    { nome: 'telefone', tipo: 'texto', rotulo: 'Telefone (WhatsApp)', placeholder: '(61) 99999-9999', valor: texto('telefone') },
    { nome: 'email', tipo: 'texto', rotulo: 'E-mail', valor: texto('email') },
    { nome: 'papeis', tipo: 'selecao', rotulo: 'Papel', opcoes: opcoesPapelNaTela(), valor: texto('papeis') || 'comprador' },
    { nome: 'origem_canal', tipo: 'selecao', rotulo: 'Como chegou', valor: texto('origem_canal') || 'indicacao', opcoes: OPCOES_ORIGEM_NOVO },
    { nome: 'origem_campanha', tipo: 'texto', rotulo: 'Campanha ou detalhe (opcional)', valor: texto('origem_campanha') },
  ];
}

/**
 * Novo cliente (#182 item 8: o mesmo nome do menu Criar; o mesmo formulário na Lista e no Funil); devolve o criado ou nada. O digitado não se
 * perde (issue #187): quando o servidor recusa, o formulário reabre com os valores e a mensagem; na
 * duplicata de telefone, **Abrir <nome>** abre o contato que já tem o número. (O `urbiVerso.formulario`
 * fecha ao confirmar e não mostra erro por campo: a mensagem vai no topo do diálogo.)
 */
function novoContato(abrir: (id: number) => void): Promise<Record<string, any> | null> {
  return formularioQueSalva({
    titulo: 'Novo cliente',
    campos: camposDoContato,
    rotuloConfirmar: 'Salvar',
    salvar: (v) => enviar('POST', '/contatos', v),
    duplicata: duplicataDeContato(abrir),
  });
}

/** Topo da coluna esquerda de Clientes (P03 e P04, D-128): o cabeçalho comum com Importar e Novo, e as visões. */
function topoClientes(visao: string, aoTrocarVisao: (v: string) => void, aoNovo: () => void) {
  return html`${cabecalhoColuna(
      'Clientes',
      html`<urbi-botao variante="secundario" icone="fa-solid fa-file-import" href=${urbiVerso.href('/clientes/importar')}>Importar</urbi-botao>
        <urbi-botao icone="fa-solid fa-user-plus" @click=${aoNovo}>Novo</urbi-botao>`,
    )}
    <urbi-chips-atalho .opcoes=${VISOES} ativo=${visao} @urbi:chip-atalho:click=${(e: CustomEvent) => aoTrocarVisao(e.detail.id)}></urbi-chips-atalho>`;
}

const ROTULO_PRONTO: Record<FiltroPronto, string> = {
  novos: 'Novos',
  sem_contato: 'Sem contato',
  quentes: 'Quentes',
  retorno_vencido: 'Retorno vencido',
};

/** Filtro de papel da lista (P04: Todas · Compradores · Proprietários). */
const PAPEL_NO_PLURAL: Record<string, string> = { comprador: 'Compradores', proprietario: 'Proprietários' };

const ehPronto = (v: string | null): v is FiltroPronto => (FILTROS_PRONTOS as readonly string[]).includes(v ?? '');

// Coluna esquerda de Clientes (P04): o cabeçalho comum com Importar e Novo, as visões, a busca, os chips
// de papel e os filtros prontos (com "Todas" primeiro, D-122), o botão Filtros (temperatura e origem, com
// o contador) e a lista com etapa, origem e temperatura, 50 de cada vez com "Mostrar mais". Os filtros
// ficam na URL (spec 11: "estado de filtro na URL"), junto com o `?item=` do cliente aberto. Escolher um
// cliente chama `aoEscolher`, que troca a ficha.
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
  /** O N de "Sem contato" é o de Ajustes › Horário de atendimento; sem resposta, o padrão. */
  @state() private diasParado = CONFIGURACOES_PADRAO.dias_cliente_parado;
  private filtros = filtrosDaUrl();
  private geracao = 0;
  /** A conta em que a lista nasceu (a troca a recria): continuação depois da troca termina em silêncio (issue #144). */
  private readonly vida = gesto();

  connectedCallback() {
    super.connectedCallback();
    void this.iniciar();
    // "Novo cliente" do menu Criar.
    if (pedidoDeCriar('cliente')) void this.novo();
    // J/K (11.0.6): próximo e anterior na Lista, abrindo a ficha como o clique.
    registrarLista(this, {
      ids: () => (this.visao === 'lista' ? this.contatos.map((c) => c.id) : []),
      atual: () => this.selecionado,
      escolher: (id) => this.aoEscolher(id),
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    soltarLista(this);
  }

  private async iniciar() {
    try {
      const conta = await this.vida.esperar(chamarApi('/conta'));
      this.diasParado = conta?.configuracoes?.dias_cliente_parado ?? this.diasParado;
    } catch {
      // A lista não depende da configuração: segue com o padrão.
    }
    if (this.vida.vivo()) await this.carregar();
  }

  /** Os filtros da Lista viram a consulta; o filtro pronto entra por cima (spec 15.8). */
  private consulta(pagina: number) {
    const q = new URLSearchParams();
    for (const k of ['busca', 'papel', 'temperatura', 'origem', ...FILTRO_PERDIDOS]) if (this.filtros.get(k)) q.set(k, this.filtros.get(k)!);
    if (pagina > 1) q.set('pagina', String(pagina));
    const pronto = this.filtros.get('pronto');
    for (const [k, v] of Object.entries(parametrosDoPronto(ehPronto(pronto) ? pronto : null, this.diasParado))) q.set(k, v);
    return q;
  }

  /** A página carregada por último (a lista acumula as páginas de "Mostrar mais"). */
  private pagina = 1;

  private async carregar(pagina = 1) {
    const geracao = ++this.geracao;
    this.carregando = true;
    this.falha = null;
    try {
      const r = await this.vida.esperar(chamarApi(`/contatos?${this.consulta(pagina)}`));
      if (geracao !== this.geracao) return;
      this.contatos = pagina > 1 ? [...this.contatos, ...r.dados] : r.dados;
      this.total = r.total;
      this.pagina = pagina;
    } catch (e) {
      if (this.vida.encerrado(e)) return;
      if (geracao === this.geracao) this.falha = mensagemDeErro(e);
    } finally {
      if (geracao === this.geracao && this.vida.vivo()) this.carregando = false;
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
    const r = await novoContato((id) => this.aoEscolher(id));
    if (!r?.id) return;
    await this.carregar();
    // Conta trocada durante a releitura: o contato criado é de A, não vira o `?item=` da conta nova.
    if (this.vida.vivo()) this.aoEscolher(r.id);
  }

  /** Filtros (issue #172): temperatura e origem num diálogo, para a coluna caber a lista; o botão mostra quantos estão ligados. */
  private filtrosAvancados() {
    return this.calado(async (g) => {
      const v = await g.esperar(urbiVerso.formulario({
        titulo: 'Filtros',
        mensagem: 'Temperatura e origem combinam com a busca, o papel e o filtro pronto.',
        rotuloConfirmar: 'Aplicar',
        campos: [
          { nome: 'temperatura', tipo: 'selecao', rotulo: 'Temperatura', placeholder: 'Todas', valor: this.filtros.get('pronto') === 'quentes' ? 'quente' : (this.filtros.get('temperatura') ?? null), opcoes: opcoesChip('temperatura') },
          { nome: 'origem', tipo: 'selecao', rotulo: 'Origem', placeholder: 'Todas', valor: this.filtros.get('origem') ?? null, opcoes: opcoesChip('origem') },
        ],
      }));
      if (!v) return;
      this.filtrar({ temperatura: v.temperatura ? String(v.temperatura) : '', origem: v.origem ? String(v.origem) : '' });
    });
  }

  private async calado(fn: (g: Gesto) => Promise<unknown>) {
    const g = gesto();
    try {
      await fn(g);
    } catch (e) {
      if (!g.encerrado(e)) throw e;
    }
  }

  /** Uma linha da lista: nome e temperatura; embaixo, a etapa, a origem e o próximo passo ou o telefone formatado. */
  private linha(c: Contato) {
    const telefone = formatarTelefone(c.telefone);
    const embaixo = c.proximo_passo
      ? `${c.proximo_passo}${c.proximo_passo_em ? ` · ${dataHora(c.proximo_passo_em)}` : ''}`
      : [telefone || c.email, c.papeis.split(',').map((p) => ROTULO_PAPEL[p] ?? p).join(', ')].filter(Boolean).join(' · ');
    return html`<urbi-linha alinhar="inicio">
      <urbi-avatar nome=${c.nome} tamanho="36"></urbi-avatar>
      <urbi-stack expandir>
        <urbi-linha justificar="entre">
          <urbi-prosa truncar>${c.nome}</urbi-prosa>
          ${c.temperatura ? chip('temperatura', c.temperatura) : nothing}
        </urbi-linha>
        <urbi-linha quebrar>
          ${c.etapa_nome ? html`<urbi-badge quebra-linha>${c.etapa_nome}</urbi-badge>` : nothing}
          ${c.origem_canal ? chip('origem', c.origem_canal) : nothing}
          <urbi-prosa papel="fraco" inline>${embaixo || '—'}</urbi-prosa>
        </urbi-linha>
      </urbi-stack>
    </urbi-linha>`;
  }

  /** Filtro que vem de Números › O que melhorar ("Ver os N clientes"): visível e removível. */
  private filtroPerdidos() {
    const m = this.filtros.get('perdido_motivo');
    if (!m) return '';
    const desde = this.filtros.get('perdido_desde');
    const origem = this.filtros.get('perdido_origem');
    const quando = desde && !Number.isNaN(new Date(desde).getTime()) ? ` desde ${new Date(desde).toLocaleDateString('pt-BR')}` : '';
    return html`<urbi-banner variante="info">
      Perdidos por "${ROTULO_MOTIVO_PERDA[m] ?? m}"${quando}${origem ? `, vindos de ${ROTULO_ORIGEM[origem] ?? origem}` : ''} (de Números).
      <urbi-botao slot="acao" variante="secundario" @click=${() => this.filtrar(Object.fromEntries(FILTRO_PERDIDOS.map((k) => [k, ''])))}>Tirar o filtro</urbi-botao>
    </urbi-banner>`;
  }

  private explicacaoDoPronto(pronto: FiltroPronto) {
    switch (pronto) {
      case 'novos':
        return `Cadastrados nos últimos ${DIAS_NOVOS} dias.`;
      case 'sem_contato':
        return `Sem contato há mais de ${this.diasParado} dias (o prazo se ajusta em Ajustes › Horário de atendimento).`;
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
    const ligados = [temperatura, origem].filter(Boolean).length;
    const restam = this.total - this.contatos.length;
    return html`<urbi-stack>
      ${topoClientes(this.visao, this.aoTrocarVisao, () => void this.novo())}
      <urbi-input label="Buscar cliente" icone="fa-solid fa-magnifying-glass" placeholder="Buscar nome ou telefone"
        valor=${this.filtros.get('busca') ?? ''} @urbi:input-change=${(e: CustomEvent) => this.filtrar({ busca: e.detail.valor })}></urbi-input>
      <urbi-chips-atalho
        .opcoes=${[{ id: 'todas', rotulo: 'Todas' }, ...opcoesPapelNaTela().map((o) => ({ id: o.valor, rotulo: PAPEL_NO_PLURAL[o.valor] ?? o.rotulo }))]}
        ativo=${papel || 'todas'}
        @urbi:chip-atalho:click=${(e: CustomEvent) => this.filtrar({ papel: e.detail.id === 'todas' ? '' : e.detail.id })}></urbi-chips-atalho>
      <urbi-linha quebrar>
        <urbi-chips-atalho
          .opcoes=${[{ id: 'todas', rotulo: 'Todas' }, ...FILTROS_PRONTOS.map((id) => ({ id, rotulo: ROTULO_PRONTO[id] }))]}
          ativo=${ativo ?? 'todas'}
          @urbi:chip-atalho:click=${(e: CustomEvent) => this.filtrar({ pronto: e.detail.id === 'todas' ? '' : e.detail.id })}></urbi-chips-atalho>
        <urbi-botao variante=${ligados ? 'primario' : 'secundario'} icone="fa-solid fa-sliders" @click=${() => void this.filtrosAvancados()}>Filtros${ligados ? ` (${ligados})` : ''}</urbi-botao>
      </urbi-linha>
      ${ativo ? html`<urbi-prosa papel="dica">${this.explicacaoDoPronto(ativo)}</urbi-prosa>` : ''}
      ${this.filtroPerdidos()}
      ${this.falha
        ? estadoTela('erro', { aoTentar: () => void this.carregar() })
        : html`<urbi-lista clicavel separador .itens=${this.contatos} ?carregando=${this.carregando && this.pagina === 1}
              mensagem-vazio=${this.filtros.toString().replace(/(^|&)(item|visao|secao)=[^&]*/g, '') ? 'Nenhum contato com estes filtros.' : 'Nenhum contato ainda. Cadastre o primeiro (Novo) ou importe uma planilha.'}
              .itemAtivo=${(c: Contato) => c.id === this.selecionado}
              .indicador=${(c: Contato) => (c.id === this.selecionado ? 'var(--cor-primaria)' : '')}
              .render_item=${(c: Contato) => this.linha(c)}
              @urbi:lista-click=${(e: CustomEvent) => this.aoEscolher((e.detail.item as Contato).id)}></urbi-lista>
            ${restam > 0
              ? html`<urbi-botao variante="secundario" bloco ?carregando=${this.carregando} @click=${() => void this.carregar(this.pagina + 1)}>Mostrar mais (${restam})</urbi-botao>`
              : ''}`}
    </urbi-stack>`;
  }
}
