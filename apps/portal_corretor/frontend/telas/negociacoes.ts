import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { UrbiVersoAPI } from '@urbiverso/sdk';
import { PLAYBOOK_OBJECOES_PADRAO } from '../../comum/negociacao';
import { reaisParaCentavos } from '../../comum/crm';
import { chamarApi, contaAtiva, data, dataHora, enviar, filtrosDaUrl, filtrosNaUrl, mensagemDeErro, reais } from '../apoio.js';
import { estadoDaFalha, estadoTela } from '../estados.js';
import './mandato.js';

declare const urbiVerso: UrbiVersoAPI;

type Linha = Record<string, any>;

// Clientes › Negociações (P15, M8): a lista das negociações à esquerda, a negociação escolhida no centro
// (faixa, escada de propostas, a última fala do cliente e a sugestão do Negociador) e, à direita, o
// mandato, a leitura do comprador e o próximo movimento. O sigilo do mandato (recuo, alvo e BATNA do
// vendedor) só vem da rota própria (`GET /negociacoes/:id/mandato`, só do corretor) e aparece
// mascarado ("•••• mostrar"); a lista e o detalhe nunca o trazem (`semSigilo` no backend).

export const ROTULO_ESTADO: Record<string, string> = {
  ativa: 'Em andamento',
  aguardando_corretor: 'Aguardando você',
  aguardando_cliente: 'Aguardando cliente',
  aguardando_proprietario: 'Aguardando proprietário',
  pausada: 'Pausada',
  ganha: 'Ganha',
  perdida: 'Perdida',
};
const COR_ESTADO: Record<string, string> = { aguardando_corretor: 'alerta', ganha: 'sucesso', perdida: 'erro' };
const QUEM_CONDUZ: Record<string, string> = { ia: 'Negociador IA', humano: 'Negociador', corretor: 'Você' };
const AUTONOMIA: Record<string, string> = { sugere: 'só sugere', pergunta_antes: 'pergunta antes', faz_sozinho: 'faz sozinho' };
const CANAL: Record<string, string> = { registro: 'Registro', portal: 'Portal', wa_me: 'Fazer agora', whatsapp: 'WhatsApp' };
const OBJECAO = Object.fromEntries(PLAYBOOK_OBJECOES_PADRAO.map((o) => [o.categoria, o.titulo]));

/** Filtros da lista (P15): `?neg=` no endereço; sem ele, as em andamento. */
const FILTROS = [
  { id: 'andamento', rotulo: 'Em andamento', estados: 'ativa,aguardando_corretor,aguardando_cliente,aguardando_proprietario,pausada' },
  { id: 'voce', rotulo: 'Aguardando você', estados: 'aguardando_corretor' },
  { id: 'negociador', rotulo: 'Negociador', estados: 'ativa' },
  { id: 'cliente', rotulo: 'Cliente', estados: 'aguardando_cliente' },
  { id: 'proprietario', rotulo: 'Proprietário', estados: 'aguardando_proprietario' },
  { id: 'encerradas', rotulo: 'Encerradas', estados: 'ganha,perdida' },
];

/** "−9%": a última oferta do comprador contra o preço pedido do mandato. */
export function diferencaDoPedido(oferta_c: number | null | undefined, pedido_c: number | null | undefined): string | null {
  if (!oferta_c || !pedido_c) return null;
  const pct = Math.round((oferta_c / pedido_c - 1) * 100);
  return `${pct > 0 ? '+' : pct < 0 ? '−' : ''}${Math.abs(pct)}%`;
}

/** Quem fez cada proposta da escada, como o corretor lê. */
function quem(p: Linha): string {
  if (p.direcao === 'comprador') return 'Comprador';
  if (p.direcao === 'proprietario') return 'Proprietário';
  return p.autor_tipo === 'negociador_ia' ? 'Negociador IA' : p.autor_tipo === 'negociador_humano' ? 'Negociador' : 'Você (vendedor)';
}

const centavosDigitados = (v: unknown): number | null => {
  const c = reaisParaCentavos(v);
  return typeof c === 'number' && Number.isFinite(c) && c > 0 ? c : null;
};

// ---------------------------------------------------------------------------------------------------
// Estado da negociação aberta: o centro e a direita leem o MESMO estado (como a ficha do cliente).

class NegociacaoAberta {
  private ouvintes = new Set<() => void>();
  readonly s: { detalhe: Linha | null; mandato: Linha | null; falha: unknown; ia: boolean | null; ocupado: boolean };
  private geracao = 0;

  constructor(readonly id: number) {
    const avisar = () => this.ouvintes.forEach((f) => f());
    this.s = new Proxy({ detalhe: null, mandato: null, falha: null, ia: null, ocupado: false } as NegociacaoAberta['s'], {
      set(alvo, chave, valor) {
        (alvo as unknown as Record<string | symbol, unknown>)[chave] = valor;
        avisar();
        return true;
      },
    });
  }

  get emUso() {
    return this.ouvintes.size > 0;
  }

  ouvir(fn: () => void) {
    this.ouvintes.add(fn);
    return () => this.ouvintes.delete(fn);
  }

  /** Lê a negociação e o mandato (rota própria, com o sigilo) e, na primeira vez, sonda a IA. */
  async carregar() {
    const g = ++this.geracao;
    this.s.falha = null;
    if (this.s.ia === null) void chamarApi('/negociador/ia').then((r) => (this.s.ia = !!r?.disponivel), () => (this.s.ia = false));
    try {
      const [detalhe, mandato] = await Promise.all([chamarApi(`/negociacoes/${this.id}`), chamarApi(`/negociacoes/${this.id}/mandato`)]);
      if (g !== this.geracao || !this.emUso) return;
      this.s.detalhe = detalhe;
      this.s.mandato = mandato?.vigente ?? null;
    } catch (e) {
      if (g === this.geracao) this.s.falha = e;
    }
  }

  /** Uma ação que grava: avisa o erro (o 422 das garantias diz o que barrou) e relê. */
  async agir(titulo: string, fn: () => Promise<unknown>): Promise<boolean> {
    if (this.s.ocupado) return false;
    this.s.ocupado = true;
    try {
      await fn();
      return true;
    } catch (e) {
      // ESCREVA_A_MENSAGEM (D-111): o texto da rota diz o que fazer; vai como está.
      const mensagem = (e as { codigo?: string })?.codigo === 'ESCREVA_A_MENSAGEM' ? (e as Error).message : mensagemDeErro(e);
      await urbiVerso.alertar({ titulo, mensagem, tipo: 'erro' });
      return false;
    } finally {
      this.s.ocupado = false;
      await this.carregar();
    }
  }

  ultimaOferta(): Linha | null {
    const ofertas = (this.s.detalhe?.propostas ?? []).filter((p: Linha) => p.direcao === 'comprador');
    return ofertas[ofertas.length - 1] ?? null;
  }

  async pedirSugestao() {
    const v = await urbiVerso.formulario({
      titulo: 'Pedir sugestão ao Negociador',
      mensagem: 'Cole o que o cliente disse por último, se houver. O Negociador sugere o próximo movimento dentro do mandato; nada é enviado sem a sua aprovação, salvo em "faz sozinho".',
      campos: [{ nome: 'mensagem_cliente', tipo: 'texto_longo', rotulo: 'O que o cliente disse (opcional)' }],
      rotuloConfirmar: 'Pedir sugestão',
    });
    if (!v) return;
    await this.agir('Não foi possível pedir a sugestão', async () => {
      const r = await enviar('POST', `/negociacoes/${this.id}/sugestao`, { mensagem_cliente: v.mensagem_cliente ? String(v.mensagem_cliente) : null, canal: 'portal' });
      if (r?.passagem) urbiVerso.notificar(`A negociação passou a você: ${(r.motivos_passagem ?? []).map((m: Linha) => m.descricao).join('; ') || 'o Negociador pediu.'}`, 'info');
      else if (r?.enviada) urbiVerso.notificar('O Negociador enviou a contraproposta pelo portal.', 'sucesso');
    });
  }

  /** A sugestão traz contraproposta? Só ela se aprova; a só em texto o corretor revisa e envia (D-111). */
  temContraproposta(): boolean {
    return !!this.s.detalhe?.sugestao?.resposta?.contraproposta?.valor_c;
  }

  /** Enviar (portal) ou Fazer agora (WhatsApp do celular) a contraproposta sugerida, com a mensagem montada. */
  async aprovar(canal: 'portal' | 'wa_me') {
    const sugestao = this.s.detalhe?.sugestao;
    if (!sugestao) return;
    // Só texto não se aprova (a rota responde ESCREVA_A_MENSAGEM): vai para a revisão do texto.
    if (!this.temContraproposta()) return this.editar();
    // A janela abre no próprio clique (senão o navegador a bloqueia) e recebe o link quando ele chega.
    const janela = canal === 'wa_me' ? window.open('', '_blank') : null;
    const ok = await this.agir('Não foi possível enviar', async () => {
      let r: any;
      try {
        r = await enviar('POST', `/negociacoes/${this.id}/decisao`, { acao: 'aprovar', execucao_id: sugestao.execucao_id, canal });
      } catch (e) {
        janela?.close(); // fecha antes de o alerta de erro aparecer
        throw e;
      }
      if (canal === 'wa_me') {
        if (r?.link && janela) janela.location.href = r.link;
        else {
          // Aba barrada pelo navegador: o texto e o link vão para o corretor copiar e abrir à mão.
          janela?.close();
          await urbiVerso.alertar({ titulo: 'Mensagem pronta', mensagem: [r?.texto ?? '', r?.link ? `Abra no WhatsApp: ${r.link}` : ''].filter(Boolean).join('\n\n'), tipo: 'info' });
        }
      } else urbiVerso.notificar('Contraproposta enviada pelo portal do cliente.', 'sucesso');
    });
    if (!ok) janela?.close();
  }

  /**
   * Editar (D-111). Só texto: o rascunho vem no campo, a mensagem é obrigatória e sai como do corretor.
   * Contraproposta: o valor vem preenchido e só vai se mudar (sem as condições, a concessão e a
   * contrapartida do modelo); a mensagem começa vazia e, em branco, sai a montada pelo app.
   */
  async editar() {
    const sugestao = this.s.detalhe?.sugestao;
    if (!sugestao) return;
    const rascunho = String(sugestao.resposta?.mensagem ?? '');
    if (!this.temContraproposta()) {
      const v = await urbiVerso.formulario({
        titulo: 'Revisar e enviar',
        mensagem: 'O texto do Negociador é só um rascunho: revise e envie com as suas palavras. O app confere de novo que nada revele o sigilo.',
        campos: [{ nome: 'mensagem', tipo: 'texto_longo', rotulo: 'Mensagem ao cliente', valor: rascunho, obrigatorio: true }],
        rotuloConfirmar: 'Enviar pelo portal',
      });
      const mensagem = v ? String(v.mensagem ?? '').trim() : '';
      if (!mensagem) return;
      await this.agir('A mensagem não foi enviada', async () => {
        await enviar('POST', `/negociacoes/${this.id}/decisao`, { acao: 'editar', execucao_id: sugestao.execucao_id, canal: 'portal', mensagem });
        urbiVerso.notificar('Mensagem enviada pelo portal do cliente.', 'sucesso');
      });
      return;
    }
    const cp = sugestao.resposta.contraproposta;
    const v = await urbiVerso.formulario({
      titulo: 'Editar a sugestão',
      mensagem: `O app confere de novo as regras do mandato: abaixo do recuo, passo maior que o permitido ou texto que revele o sigilo não são enviados.${rascunho ? `\n\nRascunho do Negociador (só referência): ${rascunho}` : ''}`,
      campos: [
        { nome: 'valor', tipo: 'texto', rotulo: 'Valor da contraproposta (R$)', valor: (cp.valor_c / 100).toLocaleString('pt-BR') },
        { nome: 'mensagem', tipo: 'texto_longo', rotulo: 'Mensagem ao cliente (opcional)', valor: '', placeholder: 'Em branco, sai a mensagem montada pelo app.' },
      ],
      rotuloConfirmar: 'Enviar pelo portal',
    });
    if (!v) return;
    const digitado = String(v.valor ?? '').trim();
    const valor_c = digitado ? centavosDigitados(digitado) : cp.valor_c;
    if (!valor_c) return void urbiVerso.alertar({ titulo: 'Valor inválido', mensagem: 'Digite o valor em reais, por exemplo 1.380.000.', tipo: 'alerta' });
    const mensagem = String(v.mensagem ?? '').trim();
    await this.agir('A contraproposta não foi enviada', async () => {
      await enviar('POST', `/negociacoes/${this.id}/decisao`, {
        acao: 'editar', execucao_id: sugestao.execucao_id, canal: 'portal',
        ...(valor_c !== cp.valor_c ? { contraproposta: { valor_c, validade_horas: cp.validade_horas ?? null } } : {}),
        ...(mensagem ? { mensagem } : {}),
      });
      urbiVerso.notificar('Contraproposta enviada pelo portal do cliente.', 'sucesso');
    });
  }

  async descartar() {
    const sugestao = this.s.detalhe?.sugestao;
    if (!sugestao) return;
    await this.agir('Não foi possível descartar', () => enviar('POST', `/negociacoes/${this.id}/decisao`, { acao: 'descartar', execucao_id: sugestao.execucao_id }));
  }

  async registrarOferta() {
    const v = await urbiVerso.formulario({
      titulo: 'Registrar oferta do cliente',
      campos: [
        { nome: 'valor', tipo: 'texto', rotulo: 'Valor oferecido (R$)', placeholder: '1.320.000', obrigatorio: true },
        { nome: 'condicoes', tipo: 'texto', rotulo: 'Condições (opcional)' },
      ],
      rotuloConfirmar: 'Registrar',
    });
    if (!v) return;
    const valor_c = centavosDigitados(v.valor);
    if (!valor_c) return void urbiVerso.alertar({ titulo: 'Valor inválido', mensagem: 'Digite o valor em reais, por exemplo 1.320.000.', tipo: 'alerta' });
    await this.agir('Não foi possível registrar a oferta', () =>
      enviar('POST', `/negociacoes/${this.id}/propostas`, { direcao: 'comprador', valor_c, condicoes: v.condicoes ? String(v.condicoes) : null }),
    );
  }

  async conduzir(acao: 'assumir' | 'devolver') {
    await this.agir(acao === 'assumir' ? 'Não foi possível assumir' : 'Não foi possível devolver', () => enviar('POST', `/negociacoes/${this.id}/${acao}`, {}));
  }

  /** Aceite final (só o corretor): a última oferta do comprador vai ao proprietário. */
  async passarAoProprietario() {
    const oferta = this.ultimaOferta();
    if (!oferta) return;
    const ok = await urbiVerso.confirmar({
      titulo: 'Passar ao proprietário',
      mensagem: `A oferta de ${reais(oferta.valor_c)} vai ao proprietário para decisão. Daqui em diante nada é enviado ao cliente até a decisão dele.`,
      rotuloConfirmar: 'Passar ao proprietário',
    });
    if (!ok) return;
    await this.agir('Não foi possível passar ao proprietário', () => enviar('POST', `/negociacoes/${this.id}/decisao`, { acao: 'aceitar_acordo', proposta_id: oferta.id }));
  }
}

let aberta: { conta: number | null; n: NegociacaoAberta } | null = null;

/** A negociação aberta: uma por vez, da conta ativa; uma visita nova relê do zero. */
export function negociacaoDe(id: number): NegociacaoAberta {
  const conta = contaAtiva();
  if (!aberta || aberta.conta !== conta || aberta.n.id !== id || !aberta.n.emUso) aberta = { conta, n: new NegociacaoAberta(id) };
  return aberta.n;
}

abstract class ColunaDaNegociacao extends LitElement {
  @property({ type: Number }) negociacaoId = 0;
  protected n: NegociacaoAberta | null = null;
  private soltar?: () => void;

  connectedCallback() {
    super.connectedCallback();
    this.n = negociacaoDe(this.negociacaoId);
    this.soltar = this.n.ouvir(() => this.requestUpdate());
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.soltar?.();
  }
}

// ---------------------------------------------------------------------------------------------------
// Esquerda: a lista, com os filtros de 11.1 (P15).

@customElement('pc-negociacoes-lista')
export class PcNegociacoesLista extends LitElement {
  @property({ attribute: false }) selecionado: number | null = null;
  @property({ attribute: false }) aoEscolher: (id: number) => void = () => {};
  @state() private linhas: Linha[] = [];
  @state() private carregando = true;
  @state() private falha: string | null = null;
  private geracao = 0;

  connectedCallback() {
    super.connectedCallback();
    void this.carregar();
  }

  private filtro() {
    const id = filtrosDaUrl().get('neg');
    return FILTROS.find((f) => f.id === id) ?? FILTROS[0];
  }

  private async carregar() {
    const g = ++this.geracao;
    this.carregando = true;
    this.falha = null;
    try {
      const f = this.filtro();
      const r = await chamarApi(`/negociacoes?estado=${f.estados}&por_pagina=100`);
      if (g !== this.geracao) return;
      // "Negociador": em andamento com o Negociador conduzindo (a rota filtra só o estado).
      this.linhas = f.id === 'negociador' ? r.dados.filter((n: Linha) => n.conduzida_por !== 'corretor') : r.dados;
    } catch (e) {
      if (g === this.geracao) this.falha = (e as Error).message;
    } finally {
      if (g === this.geracao) this.carregando = false;
    }
  }

  private filtrar(id: string) {
    filtrosNaUrl(filtrosDaUrl(), { neg: id === 'andamento' ? '' : id });
    void this.carregar();
  }

  private linha(n: Linha) {
    const dif = diferencaDoPedido(n.ultima_oferta_c, n.preco_pedido_c);
    return html`<urbi-stack>
      <urbi-linha justificar="entre" quebrar>
        <urbi-prosa>${n.contato_nome}</urbi-prosa>
        <urbi-badge cor=${COR_ESTADO[n.estado] ?? ''}>${ROTULO_ESTADO[n.estado] ?? n.estado}</urbi-badge>
      </urbi-linha>
      <urbi-prosa papel="secundario">${n.imovel_titulo ?? n.imovel_codigo ?? ''}${n.ultima_oferta_c ? ` · última oferta ${reais(n.ultima_oferta_c)}${dif ? ` · ${dif}` : ''}` : ' · sem oferta'}</urbi-prosa>
      <urbi-prosa papel="fraco">${QUEM_CONDUZ[n.conduzida_por] ?? n.conduzida_por}${n.ultima_oferta_em ? ` · última oferta em ${dataHora(n.ultima_oferta_em)}` : ''}</urbi-prosa>
    </urbi-stack>`;
  }

  render() {
    return html`<urbi-stack>
      <urbi-chips-atalho .opcoes=${FILTROS.map((f) => ({ id: f.id, rotulo: f.rotulo }))} ativo=${this.filtro().id}
        @urbi:chip-atalho:click=${(e: CustomEvent) => this.filtrar(e.detail.id)}></urbi-chips-atalho>
      ${this.falha
        ? estadoTela('erro', { aoTentar: () => void this.carregar() })
        : html`<urbi-lista clicavel separador .itens=${this.linhas} ?carregando=${this.carregando}
            mensagem-vazio="Nenhuma negociação aqui. Comece por Criar › Nova proposta."
            .itemAtivo=${(n: Linha) => n.id === this.selecionado}
            .indicador=${(n: Linha) => (n.id === this.selecionado ? 'var(--cor-primaria)' : '')}
            .render_item=${(n: Linha) => this.linha(n)}
            @urbi:lista-click=${(e: CustomEvent) => this.aoEscolher((e.detail.item as Linha).id)}></urbi-lista>`}
    </urbi-stack>`;
  }
}

// ---------------------------------------------------------------------------------------------------
// Centro: cabeçalho, faixa, a sugestão do Negociador (ou Pedir sugestão), escada e última fala (P15; no celular, M8).

/**
 * Faixa da negociação (D-102). Lacuna nomeada em 11.9 (pedido ao shell 13): até o primitivo existir,
 * é montada com primitivos — as marcas em ordem de valor, como badges, e a ZOPA estimada numa linha. O
 * recuo aparece mascarado ("••••"); a tela é só do corretor.
 */
export function marcasDaFaixa(p: { oferta_c?: number | null; recuo_c?: number | null; teto_c?: number | null; alvo_c?: number | null; pedido_c?: number | null }) {
  const marcas = [
    { id: 'oferta', rotulo: 'Oferta do comprador', valor: p.oferta_c, texto: reais(p.oferta_c) },
    { id: 'recuo', rotulo: 'Ponto de recuo', valor: p.recuo_c, texto: '•••• (sigiloso)' },
    { id: 'teto', rotulo: 'Teto estimado do comprador', valor: p.teto_c, texto: `~${reais(p.teto_c)}` },
    { id: 'alvo', rotulo: 'Alvo', valor: p.alvo_c, texto: reais(p.alvo_c) },
    { id: 'pedido', rotulo: 'Preço pedido', valor: p.pedido_c, texto: reais(p.pedido_c) },
  ].filter((m) => typeof m.valor === 'number' && m.valor > 0);
  marcas.sort((a, b) => (a.valor as number) - (b.valor as number));
  const zopa = p.recuo_c && p.teto_c ? (p.teto_c >= p.recuo_c ? 'existe' : 'nao') : 'sem_dados';
  return { marcas: marcas.map(({ id, rotulo, texto }) => ({ id, rotulo, texto })), zopa };
}

@customElement('pc-negociacao-foco')
export class PcNegociacaoFoco extends ColunaDaNegociacao {
  connectedCallback() {
    super.connectedCallback();
    void this.n!.carregar();
  }

  private faixa(d: Linha, m: Linha | null) {
    const oferta = this.n!.ultimaOferta();
    const { marcas, zopa } = marcasDaFaixa({ oferta_c: oferta?.valor_c, recuo_c: m?.recuo_c, teto_c: d.teto_estimado_comprador_c, alvo_c: m?.alvo_c, pedido_c: m?.preco_pedido_c });
    return html`<urbi-card titulo="Faixa da negociação" icone="fa-solid fa-ruler-horizontal">
      <urbi-linha quebrar>
        ${marcas.map((x) => html`<urbi-badge cor=${x.id === 'oferta' && m && oferta && oferta.valor_c < m.recuo_c ? 'erro' : ''}>${x.rotulo}: ${x.texto}</urbi-badge>`)}
      </urbi-linha>
      ${zopa === 'existe'
        ? html`<urbi-prosa papel="secundario"><urbi-badge cor="sucesso">ZOPA estimada</urbi-badge> entre o seu ponto de recuo e ~${reais(d.teto_estimado_comprador_c)} (o teto estimado do comprador).</urbi-prosa>`
        : zopa === 'nao'
          ? html`<urbi-prosa papel="secundario"><urbi-badge cor="erro">Sem ZOPA</urbi-badge> o teto estimado do comprador está abaixo do seu ponto de recuo.</urbi-prosa>`
          : html`<urbi-prosa papel="fraco">A ZOPA aparece com o mandato e o teto estimado do comprador.</urbi-prosa>`}
    </urbi-card>`;
  }

  private escada(d: Linha) {
    const linhas = (d.propostas ?? []).map((p: Linha) => ({
      rodada: p.rodada,
      quem: quem(p),
      valor: reais(p.valor_c),
      condicoes: p.condicoes ?? '—',
      concessao: p.concessao ?? '—',
      contrapartida: p.contrapartida ?? '—',
      canal: CANAL[p.canal] ?? p.canal,
      quando: dataHora(p.criado_em),
    }));
    return html`<urbi-card titulo="Escada de propostas" icone="fa-solid fa-stairs">
      ${linhas.length
        ? html`<urbi-tabela responsivo="multiline" .linhas=${linhas} .colunas=${[
            { id: 'rodada', label: 'Rodada' }, { id: 'quem', label: 'Quem' }, { id: 'valor', label: 'Valor' }, { id: 'condicoes', label: 'Condições' },
            { id: 'concessao', label: 'Concessão' }, { id: 'contrapartida', label: 'Contrapartida' }, { id: 'canal', label: 'Canal' }, { id: 'quando', label: 'Quando' },
          ]}></urbi-tabela>`
        : html`<urbi-prosa papel="dica">Nenhuma proposta ainda. Registre a oferta do cliente para começar.</urbi-prosa>`}
      <urbi-linha>
        <urbi-botao pequeno variante="secundario" icone="fa-solid fa-plus" ?desabilitado=${this.n!.s.ocupado} @click=${() => void this.n!.registrarOferta()}>Registrar oferta do cliente</urbi-botao>
      </urbi-linha>
    </urbi-card>`;
  }

  private sugestao(d: Linha) {
    const s = d.sugestao;
    if (!s) {
      const ia = this.n!.s.ia;
      return html`<urbi-linha quebrar>
        <urbi-botao icone="fa-solid fa-wand-magic-sparkles" ?desabilitado=${ia === false || this.n!.s.ocupado} ?carregando=${this.n!.s.ocupado}
          title=${ia === false ? 'IA indisponível agora' : nothing} @click=${() => void this.n!.pedirSugestao()}>Pedir sugestão</urbi-botao>
        ${ia === false ? html`<urbi-prosa papel="fraco">IA indisponível agora: registre as propostas à mão; o mandato continua valendo.</urbi-prosa>` : ''}
      </urbi-linha>`;
    }
    const r = s.resposta ?? {};
    const cp = r.contraproposta;
    const bloqueada = !!s.bloqueado_por;
    return html`<urbi-card titulo=${`Negociador sugere · rodada ${Number(d.rodadas ?? 0) + 1}`} icone="fa-solid fa-wand-magic-sparkles">
      ${cp?.valor_c
        ? html`<urbi-prosa><strong>${reais(cp.valor_c)}</strong>${cp.condicoes ? ` · ${cp.condicoes}` : ''}${cp.concessao ? ` · ${cp.concessao} ↔ ${cp.contrapartida ?? ''}` : ''}</urbi-prosa>`
        : ''}
      ${r.mensagem ? html`<urbi-prosa papel="fraco">Rascunho do Negociador (não sai como está):</urbi-prosa><urbi-prosa pre>${r.mensagem}</urbi-prosa>` : ''}
      <urbi-prosa papel="fraco">${(s.validacoes ?? []).map((v: Linha) => `${v.ok ? 'ok' : 'falhou'}: ${v.descricao}`).join(' · ')}</urbi-prosa>
      ${bloqueada ? html`<urbi-banner variante="alerta">Bloqueada pelas regras do mandato: edite antes de enviar, ou descarte.</urbi-banner>` : ''}
      <urbi-linha quebrar>
        ${cp?.valor_c
          ? html`<urbi-botao pequeno icone="fa-solid fa-paper-plane" ?desabilitado=${bloqueada || this.n!.s.ocupado} @click=${() => void this.n!.aprovar('portal')}>Enviar</urbi-botao>
              <urbi-botao pequeno variante="secundario" icone="fa-brands fa-whatsapp" ?desabilitado=${bloqueada || this.n!.s.ocupado} @click=${() => void this.n!.aprovar('wa_me')}>Fazer agora</urbi-botao>
              <urbi-botao pequeno variante="secundario" icone="fa-solid fa-pen" ?desabilitado=${this.n!.s.ocupado} @click=${() => void this.n!.editar()}>Editar</urbi-botao>`
          : html`<urbi-botao pequeno icone="fa-solid fa-pen" ?desabilitado=${this.n!.s.ocupado} @click=${() => void this.n!.editar()}>Revisar e enviar</urbi-botao>`}
        <urbi-botao pequeno variante="texto" ?desabilitado=${this.n!.s.ocupado} @click=${() => void this.n!.descartar()}>Descartar</urbi-botao>
      </urbi-linha>
    </urbi-card>`;
  }

  render() {
    const { detalhe: d, mandato: m, falha } = this.n!.s;
    if (!d) return falha ? estadoDaFalha(falha, () => void this.n!.carregar()) : estadoTela('carregando');
    const resumo = d.mandato as Linha | null;
    const encerrada = d.estado === 'ganha' || d.estado === 'perdida';
    return html`<urbi-stack>
      <urbi-linha justificar="entre" quebrar>
        <urbi-prosa papel="titulo">${d.contato_nome} · ${d.imovel_titulo ?? d.imovel_codigo ?? ''}</urbi-prosa>
        ${encerrada
          ? ''
          : d.conduzida_por === 'corretor'
            ? html`<urbi-botao pequeno variante="secundario" icone="fa-solid fa-robot" ?desabilitado=${this.n!.s.ocupado} @click=${() => void this.n!.conduzir('devolver')}>Devolver ao Negociador</urbi-botao>`
            : html`<urbi-botao pequeno variante="secundario" icone="fa-solid fa-hand" ?desabilitado=${this.n!.s.ocupado} @click=${() => void this.n!.conduzir('assumir')}>Assumir</urbi-botao>`}
      </urbi-linha>
      <urbi-linha quebrar>
        <urbi-badge cor=${COR_ESTADO[d.estado] ?? ''}>${ROTULO_ESTADO[d.estado] ?? d.estado}</urbi-badge>
        <urbi-badge>Rodada ${d.rodadas ?? 0}${resumo?.rodadas_max ? ` de ${resumo.rodadas_max}` : ''}</urbi-badge>
        <urbi-badge>${QUEM_CONDUZ[d.conduzida_por] ?? d.conduzida_por}${resumo?.autonomia && d.conduzida_por !== 'corretor' ? ` · ${AUTONOMIA[resumo.autonomia]}` : ''}</urbi-badge>
        ${resumo?.validade
          ? html`<urbi-badge>Mandato válido até ${data(`${resumo.validade}T12:00:00`)}</urbi-badge>`
          : html`<urbi-badge cor="alerta">Sem mandato</urbi-badge>`}
      </urbi-linha>
      ${this.faixa(d, m)}
      ${encerrada ? '' : this.sugestao(d)}
      ${this.escada(d)}
      ${d.ultima_fala ? html`<urbi-card titulo="Última fala do cliente" icone="fa-solid fa-comment"><urbi-prosa pre>${d.ultima_fala.texto}</urbi-prosa><urbi-prosa papel="fraco">${dataHora(d.ultima_fala.em)}</urbi-prosa></urbi-card>` : ''}
    </urbi-stack>`;
  }
}

// ---------------------------------------------------------------------------------------------------
// Direita: mandato (sigilo mascarado), leitura do comprador e o próximo movimento.

@customElement('pc-negociacao-contexto')
export class PcNegociacaoContexto extends ColunaDaNegociacao {
  @state() private mostrar: { recuo: boolean; batna: boolean } = { recuo: false, batna: false };
  @state() private editando = false;

  private sigilo(chave: 'recuo' | 'batna', texto: string) {
    return this.mostrar[chave]
      ? html`${texto} <urbi-botao pequeno variante="texto" @click=${() => (this.mostrar = { ...this.mostrar, [chave]: false })}>esconder</urbi-botao>`
      : html`<strong>••••</strong> <urbi-botao pequeno variante="texto" @click=${() => (this.mostrar = { ...this.mostrar, [chave]: true })}>mostrar</urbi-botao>`;
  }

  private cartaoMandato(m: Linha | null) {
    if (!m) {
      return html`<urbi-card titulo="Mandato" icone="fa-solid fa-file-shield">
        <urbi-prosa papel="dica">Sem mandato, o Negociador não age: ele só passa a negociação a você. Defina até onde ele pode ir.</urbi-prosa>
        <urbi-botao pequeno icone="fa-solid fa-plus" @click=${() => (this.editando = true)}>Definir mandato</urbi-botao>
      </urbi-card>`;
    }
    const concessoes = (m.concessoes ?? []) as Linha[];
    return html`<urbi-card titulo="Mandato" icone="fa-solid fa-file-shield">
      <urbi-prosa>Pedido ${reais(m.preco_pedido_c)}</urbi-prosa>
      <urbi-prosa>Alvo ${reais(m.alvo_c)}</urbi-prosa>
      <urbi-prosa>Recuo ${this.sigilo('recuo', reais(m.recuo_c))}</urbi-prosa>
      ${m.batna_vendedor ? html`<urbi-prosa>BATNA do vendedor ${this.sigilo('batna', m.batna_vendedor)}</urbi-prosa>` : ''}
      <urbi-prosa papel="secundario">${concessoes.length ? `Concessões: ${concessoes.map((c) => `${c.item} ↔ ${c.contrapartida}`).join('; ')}` : 'Sem concessões além do preço.'}</urbi-prosa>
      <urbi-prosa papel="fraco">Até ${m.rodadas_max} rodadas · passo de até ${Math.round(Number(m.passo_max_pct) * 100)}% · ${AUTONOMIA[m.autonomia] ?? m.autonomia} · válido até ${data(`${m.validade}T12:00:00`)}</urbi-prosa>
      <urbi-prosa papel="fraco">Recuo e BATNA são sigilosos: o cliente nunca os vê.</urbi-prosa>
      <urbi-botao pequeno variante="secundario" icone="fa-solid fa-pen" @click=${() => (this.editando = true)}>Editar mandato</urbi-botao>
    </urbi-card>`;
  }

  private cartaoLeitura(d: Linha) {
    const objecoes = [...new Set(((d.objecoes ?? []) as Linha[]).map((o) => o.categoria))];
    const interesses = (d.sugestao?.resposta?.interesses_identificados ?? []) as string[];
    return html`<urbi-card titulo="Leitura do comprador" icone="fa-solid fa-user-magnifying-glass">
      ${objecoes.length || interesses.length
        ? html`<urbi-linha quebrar>
            ${objecoes.map((c) => html`<urbi-badge cor="alerta">Objeção: ${(OBJECAO[c] ?? c).toLowerCase()}</urbi-badge>`)}
            ${interesses.map((i) => html`<urbi-badge>Interesse: ${i}</urbi-badge>`)}
          </urbi-linha>`
        : ''}
      ${d.teto_estimado_comprador_c
        ? html`<urbi-prosa>Teto estimado ~${reais(d.teto_estimado_comprador_c)}${d.fonte_estimativa ? ` · fonte: ${d.fonte_estimativa}` : ''}</urbi-prosa>`
        : html`<urbi-prosa papel="dica">Sem teto estimado ainda: o Negociador estima a cada sugestão.</urbi-prosa>`}
      ${d.batna_estimada_comprador ? html`<urbi-prosa papel="secundario">Alternativa do comprador: ${d.batna_estimada_comprador}</urbi-prosa>` : ''}
    </urbi-card>`;
  }

  private cartaoProximo(d: Linha) {
    const cp = d.sugestao?.resposta?.contraproposta;
    const oferta = this.n!.ultimaOferta();
    const podePassar = !!oferta && !['aguardando_proprietario', 'ganha', 'perdida'].includes(d.estado);
    return html`<urbi-card titulo="Próximo movimento" icone="fa-solid fa-forward">
      ${cp?.valor_c
        ? html`<urbi-prosa>Contraproposta de ${reais(cp.valor_c)}${cp.condicoes ? `, ${cp.condicoes}` : ''}${cp.concessao ? `, com ${cp.concessao} pedindo ${cp.contrapartida ?? 'contrapartida'}` : ''}.</urbi-prosa>
            <urbi-botao pequeno ?desabilitado=${!!d.sugestao.bloqueado_por || this.n!.s.ocupado} @click=${() => void this.n!.aprovar('portal')}>Usar sugestão</urbi-botao>`
        : html`<urbi-prosa papel="dica">${d.estado === 'aguardando_proprietario' ? 'O acordo está com o proprietário.' : 'Peça uma sugestão ao Negociador no centro, ou registre a oferta do cliente.'}</urbi-prosa>`}
      ${podePassar
        ? html`<urbi-botao pequeno variante="secundario" icone="fa-solid fa-handshake" ?desabilitado=${this.n!.s.ocupado} @click=${() => void this.n!.passarAoProprietario()}>Passar ao proprietário</urbi-botao>
            <urbi-prosa papel="fraco">Aceitar a oferta de ${reais(oferta!.valor_c)} é sempre seu: o Negociador nunca fecha o acordo.</urbi-prosa>`
        : ''}
    </urbi-card>`;
  }

  render() {
    const { detalhe: d, mandato: m } = this.n!.s;
    if (!d) return this.n!.s.falha ? '' : estadoTela('carregando');
    return html`<urbi-stack>
      ${this.cartaoMandato(m)}
      ${this.cartaoLeitura(d)}
      ${this.cartaoProximo(d)}
      ${this.editando
        ? html`<pc-mandato-modal .negociacaoId=${d.id} .imovelId=${d.imovel_id} .atual=${m} .conduzidaPor=${d.conduzida_por}
            .aoFechar=${(salvou: boolean) => {
              this.editando = false;
              if (salvou) void this.n!.carregar();
            }}></pc-mandato-modal>`
        : ''}
    </urbi-stack>`;
  }
}

// ---------------------------------------------------------------------------------------------------
// Criar › Nova proposta: cliente, imóvel e a oferta, que cai sempre numa negociação DO IMÓVEL escolhido.
// Depois abre a negociação (P15).

const buscar = (rota: string, rotulo: (l: Linha) => string) => async (termo: string, signal: AbortSignal) => {
  const r = await chamarApi(`${rota}?busca=${encodeURIComponent(termo)}`, { signal });
  return (r?.dados ?? []).map((l: Linha) => ({ valor: Number(l.id), rotulo: rotulo(l) }));
};

export async function novaProposta(foco?: { id: number; nome: string } | null): Promise<number | null> {
  const v = await urbiVerso.formulario({
    titulo: 'Nova proposta',
    mensagem: 'Registre a oferta do cliente. A negociação abre em Clientes › Negociações, onde você define o mandato.',
    campos: [
      { nome: 'contato_id', tipo: 'busca', rotulo: 'Cliente', obrigatorio: true, valor: foco?.id ?? null, rotuloValor: foco?.nome, placeholder: 'Nome ou telefone', buscar: buscar('/contatos', (c) => c.nome) },
      { nome: 'imovel_id', tipo: 'busca', rotulo: 'Imóvel', obrigatorio: true, placeholder: 'Código, bairro ou título', buscar: buscar('/imoveis', (i) => `${i.codigo} · ${i.titulo ?? i.bairro ?? ''}`) },
      { nome: 'valor', tipo: 'texto', rotulo: 'Valor oferecido (R$)', placeholder: '1.320.000', obrigatorio: true },
      { nome: 'condicoes', tipo: 'texto', rotulo: 'Condições (opcional)' },
    ],
    rotuloConfirmar: 'Registrar proposta',
  } as Parameters<UrbiVersoAPI['formulario']>[0]);
  if (!v) return null;
  const valor_c = centavosDigitados(v.valor);
  if (!valor_c) {
    await urbiVerso.alertar({ titulo: 'Valor inválido', mensagem: 'Digite o valor em reais, por exemplo 1.320.000.', tipo: 'alerta' });
    return null;
  }
  const contato = Number(v.contato_id);
  const imovel = Number(v.imovel_id);
  try {
    // Conduta (uma negociação em andamento por negócio, 6.16): 1) o cliente já negocia ESTE imóvel →
    // a oferta entra nela; 2) senão, um negócio aberto de compra do cliente sobre este imóvel (ou sem
    // imóvel) e sem negociação em andamento recebe a negociação nova; 3) senão, abre um negócio próprio
    // para o imóvel. Negócio que já negocia OUTRO imóvel nunca recebe a oferta (não grava no imóvel errado).
    const emAndamento: Linha[] = (await chamarApi(`/negociacoes?contato_id=${contato}&estado=${FILTROS[0].estados}&por_pagina=100`))?.dados ?? [];
    let negociacao = emAndamento.find((n) => Number(n.imovel_id) === imovel) ?? null;
    if (!negociacao) {
      const ocupados = new Set(emAndamento.map((n) => Number(n.negocio_id)));
      const negocios: Linha[] = (await chamarApi(`/contatos/${contato}`))?.negocios ?? [];
      const livre = (n: Linha) => n.etapa_tipo === 'aberta' && n.pipeline === 'compra' && !ocupados.has(Number(n.id));
      const aberto = negocios.find((n) => livre(n) && Number(n.imovel_id) === imovel) ?? negocios.find((n) => livre(n) && !n.imovel_id);
      const negocio = aberto ?? (await enviar('POST', '/negocios', { contato_id: contato, imovel_id: imovel }));
      negociacao = await enviar('POST', '/negociacoes', { negocio_id: negocio.id, imovel_id: imovel });
      if (!aberto) urbiVerso.notificar('Aberto um negócio novo do cliente para este imóvel.', 'info');
    }
    await enviar('POST', `/negociacoes/${negociacao!.id}/propostas`, { direcao: 'comprador', valor_c, condicoes: v.condicoes ? String(v.condicoes) : null });
    urbiVerso.notificar('Proposta registrada.', 'sucesso');
    return Number(negociacao!.id);
  } catch (e) {
    await urbiVerso.alertar({ titulo: 'Não foi possível registrar a proposta', mensagem: mensagemDeErro(e), tipo: 'erro' });
    return null;
  }
}

/**
 * Abre a negociação em Clientes › Negociações (P15), pela navegação da SPA, como o Criar faz. Com query,
 * o caminho é o de overview.md (pushState + PopStateEvent, o mesmo que o navegarSub faz por dentro):
 * o navegarSub só documenta o path.
 */
export function abrirNegociacao(id: number) {
  history.pushState(history.state, '', `${urbiVerso.href('/clientes')}?visao=negociacoes&item=${id}`);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

// Aba Negociação da ficha do cliente (P04): as negociações dele, com o atalho para a P15.
@customElement('pc-negociacoes-do-cliente')
export class PcNegociacoesDoCliente extends LitElement {
  @property({ type: Number }) contatoId = 0;
  @property() nome = '';
  @state() private linhas: Linha[] | null = null;
  @state() private falha = false;

  connectedCallback() {
    super.connectedCallback();
    chamarApi(`/negociacoes?contato_id=${this.contatoId}&por_pagina=50`).then(
      (r) => (this.linhas = r?.dados ?? []),
      () => (this.falha = true),
    );
  }

  render() {
    if (this.falha) return estadoTela('erro', { mensagem: 'Não foi possível ler as negociações.' });
    if (!this.linhas) return estadoTela('carregando');
    return html`<urbi-card titulo="Negociação" icone="fa-solid fa-handshake">
      ${this.linhas.length
        ? html`<urbi-lista clicavel separador .itens=${this.linhas}
            .render_item=${(n: Linha) => {
              const dif = diferencaDoPedido(n.ultima_oferta_c, n.preco_pedido_c);
              return html`<urbi-linha justificar="entre" quebrar>
                <urbi-prosa>${n.imovel_titulo ?? n.imovel_codigo ?? n.codigo}${n.ultima_oferta_c ? ` · ${reais(n.ultima_oferta_c)}${dif ? ` · ${dif}` : ''}` : ''}</urbi-prosa>
                <urbi-badge cor=${COR_ESTADO[n.estado] ?? ''}>${ROTULO_ESTADO[n.estado] ?? n.estado}</urbi-badge>
              </urbi-linha>`;
            }}
            @urbi:lista-click=${(e: CustomEvent) => abrirNegociacao((e.detail.item as Linha).id)}></urbi-lista>`
        : html`<urbi-prosa papel="dica">Nenhuma negociação com ${this.nome || 'este cliente'}. Quando ele fizer uma oferta, registre em Nova proposta.</urbi-prosa>`}
      <urbi-linha>
        <urbi-botao pequeno variante="secundario" icone="fa-solid fa-plus"
          @click=${() => void novaProposta({ id: this.contatoId, nome: this.nome }).then((n) => n && abrirNegociacao(n))}>Nova proposta</urbi-botao>
      </urbi-linha>
    </urbi-card>`;
  }
}
