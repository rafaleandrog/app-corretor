import { LitElement, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { UrbiVersoAPI } from '@urbiverso/sdk';
import { CONFIGURACOES_PADRAO } from '../../comum/conta';
import { FILTROS_PRONTOS, parametrosDoPronto, type FiltroPronto } from '../../comum/crm';
import { chamarApi, chip, enviar, filtrosDaUrl, filtrosNaUrl, mensagemDeErro, opcoes, opcoesParado, reais, ROTULO_MOTIVO_PERDA } from '../apoio.js';

declare const urbiVerso: UrbiVersoAPI;

type Linha = Record<string, any>;

const ROTULO_PRONTO: Record<FiltroPronto, string> = { novos: 'Novos', sem_contato: 'Sem contato', quentes: 'Quentes', retorno_vencido: 'Retorno vencido' };
const ehPronto = (v: string | null): v is FiltroPronto => (FILTROS_PRONTOS as readonly string[]).includes(v ?? '');
const NOME_FUNIL: Record<string, string> = { compra: 'Compra', venda_captacao: 'Captação' };
/** A regra da temperatura em uma linha (spec 10.4; `classificar` em comum/funil.ts). */
const DEFINICAO_TEMPERATURA = 'Quente: proposta, visita marcada ou gostou da visita. Morno: conversou nos últimos 7 dias. Frio: mais de 7 dias sem contato.';

// O que o quadro devolveu por último: a coluna da esquerda mostra as contagens dele (funis e
// temperaturas) sem pedir o quadro de novo.
let resumo: { funis: Record<string, number>; temperaturas: Record<string, number> } | null = null;
const ouvintes = new Set<() => void>();
function publicarResumo(r: typeof resumo) {
  resumo = r;
  ouvintes.forEach((f) => f());
}

// O N de "Sem contato" é o de Ajustes › Atendimento, da conta ativa (sem resposta, o padrão).
const lerDiasParado = (): Promise<number> =>
  chamarApi('/conta').then(
    (c) => c?.configuracoes?.dias_cliente_parado ?? CONFIGURACOES_PADRAO.dias_cliente_parado,
    () => CONFIGURACOES_PADRAO.dias_cliente_parado,
  );

/** Os filtros do Funil no endereço, numa chave estável: a tela recria o quadro quando ela muda. */
export const chaveDoQuadro = () => {
  const f = filtrosDaUrl();
  return ['pipeline', 'temperatura', 'parado_dias', 'pronto'].map((k) => f.get(k) ?? '').join('|');
};

/** Contato do cartão escolhido no Funil (`?item=<contato_id>`). */
export const contatoDoFunil = (): number | null => {
  const item = filtrosDaUrl().get('item') ?? '';
  return /^\d+$/.test(item) ? Number(item) : null;
};

// Esquerda do Funil (P03): os funis com a contagem de abertos, os filtros prontos (no lugar das
// listas salvas, que a D-83 tirou do MVP), a contagem por temperatura e o "sem contato há". Cada
// escolha vai para o endereço e redesenha a tela, que recria o quadro com os filtros novos.
@customElement('pc-clientes-funil-filtros')
export class PcClientesFunilFiltros extends LitElement {
  @property({ attribute: false }) aoMudar: () => void = () => {};
  private soltar?: () => void;

  connectedCallback() {
    super.connectedCallback();
    const f = () => this.requestUpdate();
    ouvintes.add(f);
    this.soltar = () => ouvintes.delete(f);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.soltar?.();
  }

  private filtrar(mudancas: Record<string, string>) {
    const atual = filtrosDaUrl();
    // "Quentes" (pronto) e a temperatura quente dizem a mesma coisa: escolher um tira o outro, como na Lista.
    const extra: string[] = [];
    if ('temperatura' in mudancas && atual.get('pronto') === 'quentes') extra.push('pronto');
    if (mudancas.pronto === 'quentes') extra.push('temperatura');
    // Trocar filtro tira o cartão escolhido: ele pode nem estar no quadro novo.
    filtrosNaUrl(atual, mudancas, ['item', ...extra]);
    this.aoMudar();
  }

  render() {
    const f = filtrosDaUrl();
    const pipeline = f.get('pipeline') ?? 'compra';
    const pronto = f.get('pronto');
    const temperatura = f.get('temperatura') ?? '';
    const n = (o: Record<string, number> | undefined, k: string) => (o && k in o ? ` (${o[k]})` : '');
    return html`<urbi-stack>
      <urbi-prosa papel="secundario">Funis</urbi-prosa>
      <urbi-chips-atalho .opcoes=${Object.entries(NOME_FUNIL).map(([id, rotulo]) => ({ id, rotulo: `${rotulo}${n(resumo?.funis, id)}` }))} ativo=${pipeline}
        @urbi:chip-atalho:click=${(e: CustomEvent) => this.filtrar({ pipeline: e.detail.id === 'compra' ? '' : e.detail.id })}></urbi-chips-atalho>
      <urbi-prosa papel="secundario">Filtros prontos</urbi-prosa>
      <urbi-chips-atalho
        .opcoes=${[{ id: 'todos', rotulo: 'Todos' }, ...FILTROS_PRONTOS.map((id) => ({ id, rotulo: ROTULO_PRONTO[id] }))]}
        ativo=${ehPronto(pronto) ? pronto : 'todos'}
        @urbi:chip-atalho:click=${(e: CustomEvent) => this.filtrar({ pronto: e.detail.id === 'todos' ? '' : e.detail.id })}></urbi-chips-atalho>
      <urbi-prosa papel="secundario">Por temperatura</urbi-prosa>
      <urbi-chips-atalho
        .opcoes=${[
          { id: 'todas', rotulo: 'Todas' },
          { id: 'quente', rotulo: `Quentes${n(resumo?.temperaturas, 'quente')}` },
          { id: 'morno', rotulo: `Mornos${n(resumo?.temperaturas, 'morno')}` },
          { id: 'frio', rotulo: `Frios${n(resumo?.temperaturas, 'frio')}` },
        ]}
        ativo=${pronto === 'quentes' ? 'quente' : temperatura || 'todas'}
        @urbi:chip-atalho:click=${(e: CustomEvent) => this.filtrar({ temperatura: e.detail.id === 'todas' ? '' : e.detail.id })}></urbi-chips-atalho>
      <urbi-prosa papel="fraco">${DEFINICAO_TEMPERATURA}</urbi-prosa>
      <urbi-select label="Sem contato há" valor=${f.get('parado_dias') ?? ''} placeholder="Qualquer tempo" .opcoes=${opcoesParado()}
        @urbi:select-change=${(e: CustomEvent) => this.filtrar({ parado_dias: e.detail.valor })}></urbi-select>
    </urbi-stack>`;
  }
}

// Centro do Funil (P03): o cabeçalho com o funil, o total aberto e as taxas de passagem entre as
// etapas; abaixo, o quadro por etapa (arrastar muda a etapa; Perdido pede o motivo). Clicar num
// cartão escolhe o cliente (`?item=`), que abre à direita. Os filtros vêm do endereço.
@customElement('pc-clientes-quadro')
export class PcClientesQuadro extends LitElement {
  @state() private quadro: { etapas: Linha[]; negocios: Linha[]; passagem: Linha[] } | null = null;
  @state() private falha: string | null = null;
  private geracao = 0;

  connectedCallback() {
    super.connectedCallback();
    void this.carregar();
  }

  private async carregar() {
    const geracao = ++this.geracao;
    this.falha = null;
    try {
      // Só os filtros do quadro: a URL é dividida com a Lista. O filtro pronto vira os mesmos parâmetros da Lista.
      const f = filtrosDaUrl();
      const q = new URLSearchParams();
      for (const k of ['pipeline', 'temperatura', 'parado_dias']) if (f.get(k)) q.set(k, f.get(k)!);
      const pronto = f.get('pronto');
      if (ehPronto(pronto)) for (const [k, v] of Object.entries(parametrosDoPronto(pronto, await lerDiasParado()))) q.set(k, v);
      const r = await chamarApi(`/funil/quadro?${q}`);
      if (geracao !== this.geracao) return;
      this.quadro = r;
      publicarResumo({ funis: r.funis, temperaturas: r.temperaturas });
    } catch (e) {
      if (geracao === this.geracao) this.falha = (e as Error).message;
    }
  }

  private async mover(e: CustomEvent) {
    const { item, listaDestino } = e.detail as { item: Linha; listaDestino: string };
    const etapa = this.quadro!.etapas.find((x) => String(x.id) === String(listaDestino));
    if (!etapa) return;
    let motivo: string | undefined;
    if (etapa.tipo === 'perdida') {
      const v = await urbiVerso.formulario({
        titulo: 'Por que perdeu?',
        campos: [{ nome: 'motivo', tipo: 'selecao', rotulo: 'Motivo', obrigatorio: true, opcoes: opcoes(ROTULO_MOTIVO_PERDA) }],
        rotuloConfirmar: 'Marcar como perdido',
      });
      if (!v) return void this.carregar(); // sem motivo nada é gravado: o cartão volta para onde estava
      motivo = String(v.motivo);
    }
    try {
      await enviar('PATCH', `/negocios/${item.id}`, { etapa_id: etapa.id, motivo_perda: motivo });
    } catch (err) {
      await urbiVerso.alertar({ titulo: 'Não foi possível mover', mensagem: mensagemDeErro(err), tipo: 'erro' });
    }
    await this.carregar();
  }

  private cartao(n: Linha) {
    return html`<urbi-stack>
      <urbi-prosa>${n.contato_nome}</urbi-prosa>
      <urbi-prosa papel="secundario">${n.titulo}${n.valor_estimado_c ? ` · ${reais(n.valor_estimado_c)}` : ''}</urbi-prosa>
      <urbi-linha quebrar>
        ${chip('temperatura', n.temperatura, n.temperatura_motivo)}
        ${n.abordagem_vencida ? html`<urbi-badge cor="alerta">Abordagem atrasada</urbi-badge>` : ''}
      </urbi-linha>
    </urbi-stack>`;
  }

  /** Endereço do cartão: o Funil com os mesmos filtros e o cliente escolhido. */
  private hrefDo(n: Linha) {
    const q = filtrosDaUrl();
    q.set('visao', 'funil');
    q.set('item', String(n.contato_id));
    return urbiVerso.href(`/clientes?${q}`);
  }

  /** As taxas entre etapas vizinhas, em uma linha: "Novo → Em atendimento 86%". */
  private taxas() {
    const nome = new Map(this.quadro!.etapas.map((e) => [e.id, e.nome]));
    const com = (this.quadro!.passagem ?? []).filter((p) => p.taxa !== null);
    if (!com.length) return '';
    return html`<urbi-linha quebrar>
      ${com.map((p) => html`<urbi-badge title=${`${p.passaram} de ${p.chegaram} negócios`}>${nome.get(p.de_etapa_id)} → ${nome.get(p.para_etapa_id)} ${Math.round(p.taxa * 100)}%</urbi-badge>`)}
    </urbi-linha>`;
  }

  render() {
    if (this.falha && !this.quadro) {
      return html`<urbi-banner variante="erro">
        ${this.falha}
        <urbi-botao slot="acao" pequeno variante="secundario" @click=${() => this.carregar()}>Tentar de novo</urbi-botao>
      </urbi-banner>`;
    }
    if (!this.quadro) return html`<urbi-loading></urbi-loading>`;
    const f = filtrosDaUrl();
    const pipeline = f.get('pipeline') === 'venda_captacao' ? 'venda_captacao' : 'compra';
    const abertos = this.quadro.negocios.filter((n) => this.quadro!.etapas.find((e) => e.id === n.etapa_id)?.tipo === 'aberta').length;
    const listas = this.quadro.etapas.map((e) => ({ id: String(e.id), label: e.nome }));
    const itens = this.quadro.negocios.map((n) => ({ ...n, id: String(n.id), lista: String(n.etapa_id), label: n.contato_nome, variante: n.abordagem_vencida ? 'alerta' : '' }));
    const filtrado = ['temperatura', 'parado_dias', 'pronto'].some((k) => f.get(k));
    return html`<urbi-stack>
      ${this.falha ? html`<urbi-banner variante="erro">${this.falha}</urbi-banner>` : ''}
      <urbi-linha justificar="entre" quebrar>
        <urbi-prosa papel="titulo">Funil de ${NOME_FUNIL[pipeline].toLowerCase()} (${abertos} ${abertos === 1 ? 'aberto' : 'abertos'})</urbi-prosa>
      </urbi-linha>
      ${this.taxas()}
      ${itens.length
        ? html`<urbi-kanban .listas=${listas} .itens=${itens} .render_item=${(n: Linha) => this.cartao(n)}
            .href_item=${(n: Linha) => this.hrefDo(n)}
            @urbi:kanban-mover=${(e: CustomEvent) => this.mover(e)}></urbi-kanban>`
        : html`<urbi-estado-vazio icone="fa-solid fa-filter" mensagem=${filtrado ? 'Nenhum negócio com estes filtros' : 'Nenhum negócio neste funil'}
            submensagem="Abra negócios pela ficha de cada cliente."></urbi-estado-vazio>`}
    </urbi-stack>`;
  }
}
