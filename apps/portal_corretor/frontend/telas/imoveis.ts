import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { keyed } from 'lit/directives/keyed.js';
import type { UrbiVersoAPI } from '@urbiverso/sdk';
import { ABAS_IMOVEIS, APELIDOS_IMOVEIS } from '../../comum/imoveis';
import { reaisCurto } from '../../comum/estudio';
import {
  abaDaUrl,
  abaNaUrl,
  avisoCreci,
  chamarApi,
  chip,
  corQualidade,
  enviar,
  filtrosDaUrl,
  filtrosNaUrl,
  gesto,
  itemDaUrl,
  itemNaUrl,
  mensagemDeErro,
  pedidoDeCriar,
  ROTULO_TIPO_IMOVEL,
  SITUACAO_IMOVEL,
  type ImovelCartao,
  type OpcoesAba,
} from '../apoio.js';
import { estadoDaFalha, estadoTela } from '../estados.js';
import { cabecalhoColuna, moldura } from '../moldura.js';
import { irParaComQuery } from '../criar.js';
import { contextoEmpreendimento } from './empreendimentos.js';
import './empreendimentos.js';
import { EVENTO_EMPREENDIMENTO_MUDOU } from './ficha-empreendimento.js';
import { EVENTO_IMOVEL_MUDOU, EVENTO_RESOLVER_FALTA } from './ficha-imovel.js';
import './ficha-empreendimento.js';
import { registrarLista, soltarLista } from '../atalhos.js';
import './mandato.js';

declare const urbiVerso: UrbiVersoAPI;

type Linha = Record<string, any>;

// Imóveis no Padrão B (spec 11.1 P06, D-84): moldura com a lista à esquerda (abas Carteira e
// Empreendimentos, busca e chips), a ficha no centro e o contexto à direita. O item escolhido fica em
// `?item=` (spec 11.0.2); `/imoveis/:id` e `/empreendimentos/:id` abrem a mesma moldura com ele.
// A aba fica em `?aba=` (Carteira é a ausência dela) e `/empreendimentos` é apelido da aba.
const ABAS = [...ABAS_IMOVEIS];
const OPCOES_ABA: OpcoesAba = { apelidos: APELIDOS_IMOVEIS, rota: '/imoveis' };

/** A aba do endereço que está na barra agora. */
export const abaImoveis = () => abaDaUrl(ABAS.map((a) => a.id), OPCOES_ABA);

/** Chips da carteira (P06): uma situação de cada vez; "Todos" tira o filtro. */
export const CHIPS_SITUACAO = [
  { valor: '', rotulo: 'Todas' },
  { valor: 'ativo', rotulo: 'Ativos' },
  { valor: 'rascunho', rotulo: 'Rascunhos' },
  { valor: 'vendido', rotulo: 'Vendidos' },
] as const;

/** Visibilidade (P06): "Todas" primeiro (D-122), depois quem está na página e quem não está. */
export const CHIPS_VISIBILIDADE = [
  { valor: '', rotulo: 'Todas' },
  { valor: 'true', rotulo: 'Públicos' },
  { valor: 'false', rotulo: 'Privados' },
] as const;

/** Item escolhido: o do caminho (`/imoveis/7`) vale mais que o `?item=`. */
const escolhido = (param?: number) => param ?? (Number(itemDaUrl()) || null);

/**
 * Escolher na lista: na moldura de `/imoveis` só troca o `?item=` (sem recarregar a lista); vindo do
 * caminho com id (`/imoveis/7`), vai para `/imoveis?item=` — mesma tela, endereço da spec.
 */
function escolher(id: number, aba: string, param: number | undefined, atualizar: () => void) {
  if (param) return irParaComQuery(`/imoveis?${aba === 'empreendimentos' ? 'aba=empreendimentos&' : ''}item=${id}`);
  itemNaUrl(id);
  atualizar();
}

/** Trocar de aba tira o item da anterior; vindo de `/imoveis/7`, volta para `/imoveis` na aba escolhida. */
function trocarAba(id: string, param: number | undefined, atualizar: () => void) {
  if (!ABAS.some((a) => a.id === id)) return;
  if (param) return irParaComQuery(id === 'carteira' ? '/imoveis' : '/imoveis?aba=empreendimentos');
  filtrosNaUrl(filtrosDaUrl(), {}, ['item']);
  abaNaUrl(id === 'carteira' ? '' : id, OPCOES_ABA);
  atualizar();
}

/**
 * A tela de Imóveis na moldura. `rota` vem do caminho: `/imoveis/:id` (imovel) ou
 * `/empreendimentos/:id` (empreendimento) abrem com o item já escolhido.
 */
export function renderImoveis(atualizar: () => void, rota: { imovel?: number; empreendimento?: number } = {}) {
  const aba = rota.empreendimento ? 'empreendimentos' : rota.imovel ? 'carteira' : abaImoveis();
  const param = aba === 'empreendimentos' ? rota.empreendimento : rota.imovel;
  const item = escolhido(param);
  const aoEscolher = (id: number) => escolher(id, aba, param, atualizar);
  const lista = html`<pc-lista-imoveis .aba=${aba} .selecionado=${item} .aoEscolher=${aoEscolher}
    .aoTrocarAba=${(id: string) => trocarAba(id, param, atualizar)}></pc-lista-imoveis>`;
  if (aba === 'empreendimentos') {
    return moldura(
      {
        menu: '/imoveis',
        lista,
        centro: item
          ? keyed(`e${item}`, html`<pc-tela-ficha-empreendimento .empreendimentoId=${item}></pc-tela-ficha-empreendimento>`)
          : estadoTela('vazio', { icone: 'fa-solid fa-city', mensagem: 'Escolha um empreendimento na lista', submensagem: 'A ficha abre aqui, com os materiais e as unidades da carteira.' }),
        contexto: item ? contextoEmpreendimento() : nothing,
        rotulos: { lista: 'Empreendimentos', centro: 'Ficha', contexto: 'Contexto' },
        painel: item ? 'centro' : 'esquerda',
      },
      atualizar,
    );
  }
  return moldura(
    {
      menu: '/imoveis',
      lista,
      centro: item
        ? keyed(`i${item}`, html`<pc-tela-ficha-imovel .imovelId=${item}></pc-tela-ficha-imovel>`)
        : estadoTela('vazio', { icone: 'fa-solid fa-house', mensagem: 'Escolha um imóvel na lista', submensagem: 'A ficha abre aqui: fotos, dados, descrição e autorização.' }),
      contexto: item ? keyed(`c${item}`, html`<pc-contexto-imovel .imovelId=${item}></pc-contexto-imovel>`) : nothing,
      rotulos: { lista: 'Carteira', centro: 'Ficha', contexto: 'Contexto' },
      painel: item ? 'centro' : 'esquerda',
    },
    atualizar,
  );
}

interface Imovel extends ImovelCartao {
  qualidade: { nota: number; faltas: string[] };
}

// Coluna da esquerda: título e [Novo], abas com o total de cada uma, busca, chips de situação e a
// lista com miniatura (capa pelo `urbi-avatar`: exceção nomeada D-65 até o pedido ao shell 7). A busca
// e a situação vão na URL; o item escolhido aparece marcado.
@customElement('pc-lista-imoveis')
export class PcListaImoveis extends LitElement {
  @property({ attribute: false }) aba = 'carteira';
  @property({ attribute: false }) selecionado: number | null = null;
  @property({ attribute: false }) aoEscolher: (id: number) => void = () => {};
  @property({ attribute: false }) aoTrocarAba: (id: string) => void = () => {};
  @state() private imoveis: Imovel[] = [];
  @state() private total = 0;
  @state() private totalEmpreendimentos: number | null = null;
  @state() private carregando = true;
  @state() private falha: unknown = null;
  private filtros = filtrosDaUrl();
  private geracao = 0;
  /** Sobe quando a ficha muda um empreendimento: a lista da aba é recriada e relê (ver `keyed`). */
  @state() private versaoEmpreendimentos = 0;
  // A ficha está na mesma tela e este elemento é reaproveitado: ela avisa por evento que salvou ou
  // removeu, e a lista relê para refletir nota, capa, situação ou o item que saiu.
  private aoImovelMudar = () => void this.carregar();
  private aoEmpreendimentoMudar = () => {
    this.versaoEmpreendimentos++;
    void this.carregar();
  };

  connectedCallback() {
    super.connectedCallback();
    void this.carregar();
    window.addEventListener(EVENTO_IMOVEL_MUDOU, this.aoImovelMudar);
    window.addEventListener(EVENTO_EMPREENDIMENTO_MUDOU, this.aoEmpreendimentoMudar);
    // Endereço antigo do Criar (`?criar=imovel`): leva ao Novo imóvel em 4 passos.
    if (pedidoDeCriar('imovel')) this.novo();
    // J/K (11.0.6): próximo e anterior na carteira.
    registrarLista(this, {
      ids: () => (this.aba === 'carteira' ? this.imoveis.map((i) => i.id) : []),
      atual: () => this.selecionado,
      escolher: (id) => this.aoEscolher(id),
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    soltarLista(this);
    window.removeEventListener(EVENTO_IMOVEL_MUDOU, this.aoImovelMudar);
    window.removeEventListener(EVENTO_EMPREENDIMENTO_MUDOU, this.aoEmpreendimentoMudar);
  }

  /** Só a busca e a situação vão ao backend: a aba é da tela. */
  private consulta() {
    const q = new URLSearchParams();
    for (const k of ['busca', 'situacao']) if (this.filtros.get(k)) q.set(k, this.filtros.get(k)!);
    const vis = this.filtros.get('visibilidade');
    if (vis === 'true' || vis === 'false') q.set('publicado_pagina', vis);
    return q;
  }

  private async carregar() {
    const geracao = ++this.geracao;
    this.carregando = true;
    this.falha = null;
    // A carga é da conta de agora: trocada no meio, a resposta (ou a falha) dela não vai para a tela.
    const g = gesto();
    try {
      const [r, e] = await g.esperar(Promise.all([
        chamarApi(`/imoveis?${this.consulta()}`),
        chamarApi('/empreendimentos').then((x) => x.total ?? x.dados?.length ?? 0, () => null),
      ]));
      if (geracao !== this.geracao) return;
      this.imoveis = r.dados;
      this.total = r.total;
      this.totalEmpreendimentos = e;
    } catch (e) {
      if (g.encerrado(e)) return;
      if (geracao === this.geracao) this.falha = e;
    } finally {
      if (geracao === this.geracao) this.carregando = false;
    }
  }

  private filtrar(mudancas: Record<string, string>) {
    this.filtros = filtrosDaUrl();
    filtrosNaUrl(this.filtros, mudancas);
    this.filtros = filtrosDaUrl();
    void this.carregar();
  }

  /** Novo imóvel em 4 passos (P07, M3): tela própria, `/imoveis/novo`. */
  private novo() {
    urbiVerso.navegarSub('/imoveis/novo');
  }

  private item(i: Imovel) {
    const s = SITUACAO_IMOVEL[i.situacao] ?? { rotulo: i.situacao, cor: 'padrao' };
    // Título curto na primeira linha; bairro (ou cidade) e preço embaixo, como a referência P06. O código
    // fica no `title`. Tudo `truncar`: nada rola para o lado na coluna de 360 (#180).
    const local = i.bairro || i.cidade || '';
    return html`<urbi-linha title=${i.codigo}>
      <urbi-avatar nome=${i.codigo} foto=${i.capa_url ?? ''} icone=${i.capa_url ? '' : 'fa-solid fa-image'} tamanho="48"></urbi-avatar>
      <urbi-stack>
        <urbi-prosa truncar>${i.titulo ?? ROTULO_TIPO_IMOVEL[i.tipo] ?? i.tipo}</urbi-prosa>
        <urbi-prosa papel="fraco" truncar>${[local, i.preco_c ? reaisCurto(i.preco_c) : 'Sob consulta'].filter(Boolean).join(' · ')}</urbi-prosa>
        <urbi-linha quebrar>
          <urbi-badge cor=${s.cor}>${s.rotulo}</urbi-badge>
          <urbi-badge cor=${corQualidade(i.qualidade.nota)} title="Qualidade do anúncio">${i.qualidade.nota}</urbi-badge>
        </urbi-linha>
      </urbi-stack>
    </urbi-linha>`;
  }

  private carteira() {
    if (this.falha && !this.imoveis.length) return estadoDaFalha(this.falha, () => this.carregar());
    if (this.carregando && !this.imoveis.length) return estadoTela('carregando');
    if (!this.imoveis.length) {
      return this.consulta().toString()
        ? estadoTela('vazio', { icone: 'fa-solid fa-magnifying-glass', mensagem: 'Nenhum imóvel com estes filtros', submensagem: 'Mude a busca ou a situação.' })
        : estadoTela('vazio', {
            icone: 'fa-solid fa-house',
            mensagem: 'Nenhum imóvel ainda',
            submensagem: 'Leva poucos minutos: tipo, cidade e as fotos.',
            acao: { rotulo: 'Cadastrar o primeiro imóvel', icone: 'fa-solid fa-plus', aoEscolher: () => this.novo() },
          });
    }
    return html`<urbi-lista separador clicavel .itens=${this.imoveis} .itemAtivo=${(i: Imovel) => i.id === this.selecionado}
        .render_item=${(i: Imovel) => this.item(i)}
        @urbi:lista-click=${(e: CustomEvent) => this.aoEscolher((e.detail.item as Imovel).id)}></urbi-lista>
      ${this.total > this.imoveis.length
        ? html`<urbi-prosa papel="dica">Mostrando ${this.imoveis.length} de ${this.total}. Refine a busca para achar os demais.</urbi-prosa>`
        : nothing}`;
  }

  render() {
    const situacao = this.filtros.get('situacao') ?? '';
    const visibilidade = this.filtros.get('visibilidade') ?? '';
    const abas = ABAS.map((a) => ({
      ...a,
      label: `${a.label}${a.id === 'carteira' ? (this.carregando && !this.imoveis.length ? '' : ` (${this.total})`) : this.totalEmpreendimentos === null ? '' : ` (${this.totalEmpreendimentos})`}`,
    }));
    // Cabeçalho comum da moldura (D-128): título, Novo e Assistente, botões de 34 px.
    return html`<urbi-stack>
      ${cabecalhoColuna('Imóveis', this.aba === 'carteira' ? html`<urbi-botao icone="fa-solid fa-plus" @click=${() => this.novo()}>Novo</urbi-botao>` : nothing)}
      <urbi-abas .abas=${abas} ativa=${this.aba} @urbi:aba-selecionar=${(e: CustomEvent) => e.detail?.id !== this.aba && this.aoTrocarAba(e.detail?.id)}>
        <urbi-hospedeiro slot=${this.aba}>
          ${this.aba === 'empreendimentos'
            ? keyed(this.versaoEmpreendimentos, html`<pc-lista-empreendimentos .selecionado=${this.selecionado} .aoEscolher=${this.aoEscolher}></pc-lista-empreendimentos>`)
            : html`<urbi-stack>
                <urbi-input label="Buscar imóvel" icone="fa-solid fa-magnifying-glass" placeholder="Código, título, bairro ou cidade"
                  valor=${this.filtros.get('busca') ?? ''} @urbi:input-change=${(e: CustomEvent) => this.filtrar({ busca: e.detail.valor })}></urbi-input>
                <urbi-chips-atalho .opcoes=${CHIPS_SITUACAO.map((c) => ({ id: c.valor || 'todas', rotulo: c.rotulo }))} ativo=${situacao || 'todas'}
                  @urbi:chip-atalho:click=${(e: CustomEvent) => this.filtrar({ situacao: e.detail.id === 'todas' ? '' : e.detail.id })}></urbi-chips-atalho>
                <urbi-chips-atalho .opcoes=${CHIPS_VISIBILIDADE.map((c) => ({ id: c.valor || 'todas', rotulo: c.rotulo }))} ativo=${visibilidade || 'todas'}
                  @urbi:chip-atalho:click=${(e: CustomEvent) => this.filtrar({ visibilidade: e.detail.id === 'todas' ? '' : e.detail.id })}></urbi-chips-atalho>
                ${this.carteira()}
              </urbi-stack>`}
        </urbi-hospedeiro>
      </urbi-abas>
    </urbi-stack>`;
  }
}

interface Contexto {
  qualidade: { nota: number; faltas: string[] };
  sem_creci: boolean;
  numeros: { visitas: number; enviados: number; cliques: number; negocios: number };
  anunciavel: boolean;
  combinam: { id: number; nome: string; temperatura: string | null; motivos: string[] }[];
}

// Coluna da direita do imóvel (P06): qualidade com nota e o que falta, os números dos últimos 30 dias
// e os clientes que combinam. A barra de qualidade é lacuna (spec 11.9): a nota vai em `urbi-badge`
// colorido (≥ 80 `sucesso`, 60–79 `alerta` âmbar, < 60 `erro` vermelho) com `urbi-bolinhas` de 0 a 10 — exceção nomeada.
@customElement('pc-contexto-imovel')
export class PcContextoImovel extends LitElement {
  @property({ type: Number }) imovelId = 0;
  @state() private dados: Contexto | null = null;
  @state() private falha: unknown = null;
  private geracao = 0;
  private aoMudar = (e: Event) => {
    const d = (e as CustomEvent).detail;
    // Imóvel removido não existe mais: não refaz a leitura de /contexto (daria "não encontrado").
    if (d?.id === this.imovelId && !d.removido) void this.carregar();
  };

  connectedCallback() {
    super.connectedCallback();
    void this.carregar();
    void this.lerMandato();
    window.addEventListener(EVENTO_IMOVEL_MUDOU, this.aoMudar);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener(EVENTO_IMOVEL_MUDOU, this.aoMudar);
  }

  private async carregar() {
    const geracao = ++this.geracao;
    this.falha = null;
    const g = gesto();
    try {
      const r = await g.esperar(chamarApi(`/imoveis/${this.imovelId}/contexto`));
      if (geracao === this.geracao) this.dados = r;
    } catch (e) {
      if (g.encerrado(e)) return;
      if (geracao === this.geracao) this.falha = e;
    }
  }

  @state() private enviando: number | null = null;
  @state() private enviados = new Set<number>();
  /** A negociação em andamento deste imóvel e o mandato vigente dela (P06: o Mandato resumido). */
  @state() private negociacao: { id: number; conduzida_por: string; negociador_usuario_id: number | null; mandato: Record<string, any> | null } | null = null;
  @state() private recuoAberto = false;
  @state() private editandoMandato = false;

  /** Lê a negociação em andamento do imóvel e o mandato dela; sem negociação, o cartão não aparece. */
  private async lerMandato() {
    const g = gesto();
    try {
      const r = await g.esperar(chamarApi(`/negociacoes?imovel_id=${this.imovelId}&estado=ativa,aguardando_corretor,aguardando_cliente,aguardando_proprietario,pausada&por_pagina=1`));
      const n = r?.dados?.[0];
      if (!n) return void (this.negociacao = null);
      const m = await g.esperar(chamarApi(`/negociacoes/${n.id}/mandato`));
      this.negociacao = { id: Number(n.id), conduzida_por: n.conduzida_por, negociador_usuario_id: n.negociador_usuario_id ?? null, mandato: m?.vigente ?? null };
    } catch (e) {
      if (g.encerrado(e)) return;
      this.negociacao = null; // o resumo é bônus: sem ele, a coluna segue
    }
  }

  /**
   * Mandato resumido (P06): preço pedido, alvo e o recuo mascarado ("•••• mostrar"), com Definir (ou
   * Editar) mandato, que abre o P16. Só com uma negociação em andamento deste imóvel.
   */
  private cartaoMandato() {
    const n = this.negociacao;
    if (!n) return nothing;
    const m = n.mandato;
    return html`<urbi-card titulo="Mandato" icone="fa-solid fa-file-shield">
      ${m
        ? html`<urbi-stack>
            <urbi-prosa>Preço pedido ${reaisCurto(m.preco_pedido_c)}</urbi-prosa>
            <urbi-prosa>Alvo ${reaisCurto(m.alvo_c)}</urbi-prosa>
            <urbi-linha>
              <urbi-prosa>Recuo ${this.recuoAberto ? reaisCurto(m.recuo_c) : '••••'}</urbi-prosa>
              <urbi-botao variante="texto" @click=${() => (this.recuoAberto = !this.recuoAberto)}>${this.recuoAberto ? 'esconder' : 'mostrar'}</urbi-botao>
            </urbi-linha>
          </urbi-stack>`
        : html`<urbi-prosa papel="dica">Há uma negociação deste imóvel sem mandato: sem ele, o Negociador não age.</urbi-prosa>`}
      <urbi-botao variante=${m ? 'secundario' : 'primario'} icone=${m ? 'fa-solid fa-pen' : 'fa-solid fa-plus'} @click=${() => (this.editandoMandato = true)}>${m ? 'Editar mandato' : 'Definir mandato'}</urbi-botao>
      ${this.editandoMandato
        ? html`<pc-mandato-modal .negociacaoId=${n.id} .imovelId=${this.imovelId} .atual=${m} .conduzidaPor=${n.conduzida_por} .negociadorId=${Number(n.negociador_usuario_id) || 0}
            .aoFechar=${(salvou: boolean) => {
              this.editandoMandato = false;
              if (salvou) void this.lerMandato();
            }}></pc-mandato-modal>`
        : nothing}
    </urbi-card>`;
  }

  /**
   * "Enviar" (P06): envia o imóvel de verdade (`POST /envios`), sem sair da tela. A rota registra o
   * envio, a mensagem na conversa do cliente (com o cartão do imóvel) e o link rastreado.
   */
  private async enviar(c: Contexto['combinam'][number]) {
    if (this.enviando) return;
    const g = gesto();
    this.enviando = c.id;
    try {
      await g.esperar(enviar('POST', '/envios', { contato_id: c.id, imovel_id: this.imovelId, tipo: 'imovel', canal: 'whatsapp' }));
      this.enviados = new Set([...this.enviados, c.id]);
      urbiVerso.notificar(`Imóvel enviado a ${c.nome}. A mensagem pronta está na conversa dele.`, 'sucesso');
      window.dispatchEvent(new CustomEvent(EVENTO_IMOVEL_MUDOU, { detail: { id: this.imovelId } }));
    } catch (e) {
      if (g.encerrado(e)) return;
      await urbiVerso.alertar({ titulo: 'Não foi possível enviar', mensagem: mensagemDeErro(e), tipo: 'erro' });
    } finally {
      this.enviando = null;
    }
  }

  private resolver(falta: string) {
    window.dispatchEvent(new CustomEvent(EVENTO_RESOLVER_FALTA, { detail: { id: this.imovelId, falta } }));
  }

  render() {
    if (this.falha && !this.dados) return estadoDaFalha(this.falha, () => this.carregar());
    if (!this.dados) return estadoTela('carregando');
    const { qualidade, numeros, combinam, anunciavel } = this.dados;
    return html`<urbi-stack>
      <urbi-card titulo="Qualidade do anúncio" icone="fa-solid fa-list-check">
        <urbi-stack>
          <urbi-linha>
            <urbi-badge cor=${corQualidade(qualidade.nota)}>${qualidade.nota} de 100</urbi-badge>
            <urbi-bolinhas valor=${Math.round(qualidade.nota / 10)} maximo="10" .glow=${false}></urbi-bolinhas>
          </urbi-linha>
          ${qualidade.faltas.length
            ? html`<urbi-lista separador clicavel .itens=${qualidade.faltas}
                .render_item=${(f: string) => html`<urbi-linha justificar="entre">
                  <urbi-prosa>${f}</urbi-prosa>
                  <urbi-icone classe="fa-solid fa-chevron-right"></urbi-icone>
                </urbi-linha>`}
                @urbi:lista-click=${(e: CustomEvent) => this.resolver(e.detail.item as string)}></urbi-lista>`
            : html`<urbi-prosa papel="sucesso">Nada falta no anúncio.</urbi-prosa>`}
          ${this.dados.sem_creci ? avisoCreci() : nothing}
        </urbi-stack>
      </urbi-card>
      <urbi-card titulo="Últimos 30 dias" icone="fa-solid fa-chart-simple">
        <!-- Uma coluna de KPIs: a grade de 2 colunas cortava rótulo e cartão nos 340 px (issue 180). -->
        <urbi-stack>
          <urbi-kpi rotulo="Visitas" .valor=${numeros.visitas}></urbi-kpi>
          <urbi-kpi rotulo="Enviado a" .valor=${numeros.enviados}></urbi-kpi>
          <urbi-kpi rotulo="Cliques nos envios" .valor=${numeros.cliques}></urbi-kpi>
          <urbi-kpi rotulo="Negócios ligados" .valor=${numeros.negocios}></urbi-kpi>
        </urbi-stack>
      </urbi-card>
      <urbi-card titulo="Clientes que combinam" icone="fa-solid fa-user-check">
        ${combinam.length && !anunciavel
          ? html`<urbi-prosa papel="dica">Para enviar este imóvel, ele precisa estar ativo ou reservado, com autorização de venda assinada e vigente.</urbi-prosa>`
          : ''}
        ${combinam.length
          ? html`<urbi-lista separador .itens=${combinam} .render_item=${(c: Contexto['combinam'][number]) => html`<urbi-linha justificar="entre">
              <urbi-stack>
                <urbi-linha>
                  <urbi-prosa>${c.nome}</urbi-prosa>
                  ${chip('temperatura', c.temperatura)}
                </urbi-linha>
                <urbi-prosa papel="fraco">Combina em ${c.motivos.join(', ')}</urbi-prosa>
              </urbi-stack>
              ${anunciavel
                ? html`<urbi-botao variante="secundario" icone="fa-solid fa-paper-plane" ?carregando=${this.enviando === c.id}
                    ?desabilitado=${this.enviados.has(c.id)} @click=${() => this.enviar(c)}>${this.enviados.has(c.id) ? 'Enviado' : 'Enviar'}</urbi-botao>`
                : ''}
            </urbi-linha>`}></urbi-lista>`
          : html`<urbi-prosa papel="dica">Nenhum comprador com perfil de busca que combine (tipo, região, preço, quartos, vagas ou área).</urbi-prosa>`}
      </urbi-card>
      ${this.cartaoMandato()}
    </urbi-stack>`;
  }
}
