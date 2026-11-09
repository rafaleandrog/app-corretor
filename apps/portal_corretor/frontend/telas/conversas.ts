import { html, LitElement, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { keyed } from 'lit/directives/keyed.js';
import type { UrbiVersoAPI } from '@urbiverso/sdk';
import { cabecalhoColuna, moldura } from '../moldura.js';
import { buscaDoGesto, chamarApi, data as dataCurta, enviar, gesto, mensagemDeErro, noGesto, reais, seNaoContaTrocada, type Gesto } from '../apoio.js';
import { estadoDaFalha, estadoTela } from '../estados.js';
import { filtrosDaUrl, filtrosNaUrl } from '../visual.js';
import { irParaComQuery } from '../criar.js';
import { abrirNegociacao, propostaDoContato } from './negociacoes.js';
import { chipsDoPerfilBusca } from '../../comum/crm.js';
import { combina } from '../../comum/imoveis.js';
import { linkWhatsapp } from '../../comum/pagina.js';
import {
  chipDeStatus,
  FILTROS_CONVERSA,
  type FiltroConversa,
  haQuanto,
  horariosLivres,
  type HorarioLivre,
  mensagemDaVisita,
  quemAtende,
  ROTULO_FILTRO,
  ROTULO_ORIGEM_CHIP,
} from '../../comum/conversas.js';

declare const urbiVerso: UrbiVersoAPI;

// Conversas (spec 11.1 P02, D-116) na moldura: à esquerda a caixa (busca, filtros, lista); no centro a
// conversa (faixa do WhatsApp, cabeçalho, mensagens, ações rápidas, sugestão da IA e compositor); à
// direita o contexto do cliente (próxima abordagem, enviados, também combinam, perfil de busca). Sem o
// WhatsApp do app (bloco 6), o que o corretor escreve sai pelo WhatsApp do celular (`wa.me`, D-107) e
// fica gravado; o que o cliente escreve chega pelo Portal do Cliente.

type Linha = Record<string, any>;

interface ItemLista {
  id: number;
  contato_id: number;
  contato_nome: string;
  contato_temperatura: string | null;
  origem_canal: string | null;
  estado: string;
  atendido_por: string;
  agente: string | null;
  nao_lidas: number;
  ultima_mensagem: string | null;
  ultima_mensagem_em: string | null;
  ultimo_tipo: string | null;
  arquivada: boolean;
}

interface Detalhe {
  conversa: Linha;
  contato: Linha;
  mensagens: Linha[];
  tem_mais: boolean;
  negociacao: Linha | null;
  whatsapp: { conectado: boolean };
}

// ---------- Estado compartilhado pelas três colunas ----------

const loja = {
  versaoLista: 0,
  detalhes: new Map<number, Detalhe>(),
  ouvintes: new Set<() => void>(),
};
const avisar = () => loja.ouvintes.forEach((f) => f());

/** A lista mudou (nova mensagem, assumir, arquivar): a coluna da esquerda relê. */
function listaMudou() {
  loja.versaoLista++;
  avisar();
}

async function carregarDetalhe(id: number, vida: Gesto): Promise<Detalhe | null> {
  const d = (await vida.esperar(chamarApi(`/conversas/${id}`))) as Detalhe;
  loja.detalhes.set(id, d);
  avisar();
  // Abrir a conversa marca como lida e alinha quem atende (é escrita: `PATCH .../lida`, não o `GET`). É
  // refinamento: se falhar, a conversa já está na tela e o contador fica como está até a próxima abertura.
  try {
    const lida = (await vida.esperar(enviar('PATCH', `/conversas/${id}/lida`))) as { conversa: Detalhe['conversa'] };
    if (lida?.conversa) {
      const antes = d.conversa;
      d.conversa = lida.conversa;
      loja.detalhes.set(id, d);
      if (Number(antes.nao_lidas ?? 0) > 0 || antes.atendido_por !== lida.conversa.atendido_por) listaMudou();
      else avisar();
    }
  } catch (e) {
    if (vida.encerrado(e)) throw e;
    console.warn('[portal_corretor] não marcou a conversa como lida:', mensagemDeErro(e));
  }
  return d;
}

const conversaDaUrl = (): number | null => Number(filtrosDaUrl().get('item')) || null;

/**
 * Abre a conversa de um contato (P02) a partir de outra tela ("Falar com Ana" em Hoje, "Conversa" e
 * "Abrir conversa" na ficha): `POST /conversas` devolve a que já existe ou cria, e a tela de Conversas
 * abre nela. Conta trocada com o pedido em voo: nada abre.
 */
export function abrirConversaDoContato(contatoId: number) {
  return noGesto(async (g) => {
    try {
      const r = (await g.esperar(enviar('POST', '/conversas', { contato_id: contatoId }))) as { conversa: Linha };
      irParaComQuery(`/conversas?item=${Number(r.conversa.id)}`);
    } catch (e) {
      if (g.encerrado(e)) throw e;
      await urbiVerso.alertar({ titulo: 'Não foi possível abrir a conversa', mensagem: mensagemDeErro(e), tipo: 'erro' });
    }
  });
}

function escolherConversa(id: number | null, atualizar: () => void) {
  filtrosNaUrl(filtrosDaUrl(), { item: id ?? null });
  atualizar();
}

const TEMPERATURA: Record<string, { rotulo: string; cor: 'erro' | 'alerta' | 'info' }> = {
  quente: { rotulo: 'Quente', cor: 'erro' },
  morno: { rotulo: 'Morno', cor: 'alerta' },
  frio: { rotulo: 'Frio', cor: 'info' },
};

const hora = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '');
const dia = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }) : '');
const mesmoDia = (a: string | null | undefined, b: string | null | undefined) => !!a && !!b && new Date(a).toDateString() === new Date(b).toDateString();

/** Abre o WhatsApp do celular com o texto (D-107); sem telefone, copia o texto. */
async function abrirWhatsapp(telefone: string | null | undefined, texto: string) {
  const link = linkWhatsapp(telefone, texto);
  if (link) {
    window.open(link, '_blank', 'noopener');
    return;
  }
  try {
    await navigator.clipboard.writeText(texto);
    urbiVerso.notificar('Cliente sem WhatsApp: a mensagem foi copiada.', 'info');
  } catch {
    urbiVerso.notificar('Cliente sem WhatsApp: copie a mensagem do registro.', 'erro');
  }
}

// ---------- Esquerda: a caixa de conversas ----------

@customElement('pc-conversas-lista')
export class PcConversasLista extends LitElement {
  @property({ type: Number }) selecionado: number | null = null;
  @property({ attribute: false }) aoEscolher: (id: number) => void = () => {};
  @state() private itens: ItemLista[] = [];
  @state() private contadores: Partial<Record<FiltroConversa, number>> = {};
  @state() private limite: { atingido: boolean; quantas: number } = { atingido: false, quantas: 0 };
  @state() private carregando = true;
  @state() private falha: unknown = null;
  @state() private filtro: FiltroConversa | '' = (filtrosDaUrl().get('filtro') as FiltroConversa) || '';
  @state() private busca = filtrosDaUrl().get('q') ?? '';
  private readonly vida = gesto();
  private versaoVista = loja.versaoLista;
  private soltar?: () => void;

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    const ouvinte = () => {
      if (this.versaoVista !== loja.versaoLista) void this.carregar();
    };
    loja.ouvintes.add(ouvinte);
    this.soltar = () => loja.ouvintes.delete(ouvinte);
    void this.carregar();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.soltar?.();
  }

  private async carregar() {
    this.versaoVista = loja.versaoLista;
    this.carregando = true;
    this.falha = null;
    try {
      const q = new URLSearchParams();
      if (this.filtro) q.set('filtro', this.filtro);
      if (this.busca.trim()) q.set('q', this.busca.trim());
      const r = (await this.vida.esperar(chamarApi(`/conversas${q.toString() ? `?${q}` : ''}`))) as { dados: ItemLista[]; contadores: Record<FiltroConversa, number>; limite?: number; limite_atingido?: boolean };
      this.itens = r.dados;
      this.contadores = r.contadores;
      this.limite = { atingido: !!r.limite_atingido, quantas: Number(r.limite ?? 0) };
    } catch (e) {
      if (this.vida.encerrado(e)) return;
      this.falha = e;
      this.limite = { atingido: false, quantas: 0 };
    } finally {
      if (this.vida.vivo()) this.carregando = false;
    }
  }

  private filtrar(mudancas: { filtro?: string; q?: string }) {
    if (mudancas.filtro !== undefined) this.filtro = mudancas.filtro as FiltroConversa | '';
    if (mudancas.q !== undefined) this.busca = mudancas.q;
    filtrosNaUrl(filtrosDaUrl(), { filtro: this.filtro || null, q: this.busca.trim() || null });
    void this.carregar();
  }

  /** Nova conversa: escolhe o cliente e abre (ou reabre) a conversa dele. */
  private async nova() {
    const vida = gesto();
    try {
      const v = await vida.esperar(
        urbiVerso.formulario({
          titulo: 'Nova conversa',
          campos: [{ nome: 'contato_id', tipo: 'busca', rotulo: 'Cliente', obrigatorio: true, placeholder: 'Nome ou telefone', buscar: buscaDoGesto(vida, '/contatos', (c) => `${c.nome}${c.telefone ? ` · ${c.telefone}` : ''}`) }],
          mensagem: 'A conversa reúne o que o cliente escreveu pelo portal e o que você mandou a ele.',
          rotuloConfirmar: 'Abrir conversa',
        }),
      );
      if (!v?.contato_id) return;
      const r = (await vida.esperar(enviar('POST', '/conversas', { contato_id: v.contato_id }))) as { conversa: Linha };
      listaMudou();
      this.aoEscolher(Number(r.conversa.id));
    } catch (e) {
      if (vida.encerrado(e)) return;
      await urbiVerso.alertar({ titulo: 'Não foi possível abrir a conversa', mensagem: mensagemDeErro(e), tipo: 'erro' });
    }
  }

  private linha(c: ItemLista) {
    const status = chipDeStatus(c);
    const origem = c.origem_canal ? ROTULO_ORIGEM_CHIP[c.origem_canal] ?? null : null;
    return html`<urbi-linha alinhar="inicio">
      <urbi-avatar nome=${c.contato_nome} tamanho="36"></urbi-avatar>
      <urbi-stack expandir>
        <urbi-linha justificar="entre">
          <urbi-prosa papel=${c.nao_lidas ? 'corpo' : 'secundario'}><strong>${c.contato_nome}</strong></urbi-prosa>
          <urbi-prosa papel="fraco">${haQuanto(c.ultima_mensagem_em)}</urbi-prosa>
        </urbi-linha>
        <urbi-prosa papel="secundario" truncar>${c.ultima_mensagem ?? 'Sem mensagens ainda'}</urbi-prosa>
        <urbi-linha quebrar gap="6px">
          ${c.nao_lidas ? html`<urbi-badge cor="alerta">${c.nao_lidas} nova${c.nao_lidas > 1 ? 's' : ''}</urbi-badge>` : nothing}
          ${status ? html`<urbi-badge cor=${status.cor}>${status.rotulo}</urbi-badge>` : nothing}
          ${origem ? html`<urbi-badge>${origem}</urbi-badge>` : nothing}
        </urbi-linha>
      </urbi-stack>
    </urbi-linha>`;
  }

  render() {
    const opcoes = [{ id: '', rotulo: 'Todas' }, ...FILTROS_CONVERSA.map((f) => ({ id: f, rotulo: `${ROTULO_FILTRO[f]}${this.contadores[f] ? ` ${this.contadores[f]}` : ''}` }))];
    return html`<urbi-stack>
      ${cabecalhoColuna('Conversas', html`<urbi-botao variante="secundario" icone="fa-solid fa-plus" @click=${() => void this.nova()}>Nova</urbi-botao>`)}
      <urbi-input label="Buscar conversa" icone="fa-solid fa-magnifying-glass" placeholder="Buscar nome, telefone ou imóvel" valor=${this.busca}
        @urbi:input-change=${(e: CustomEvent) => this.filtrar({ q: e.detail.valor })}></urbi-input>
      <urbi-chips-atalho .opcoes=${opcoes} ativo=${this.filtro} @urbi:chip-atalho:click=${(e: CustomEvent) => this.filtrar({ filtro: e.detail.id })}></urbi-chips-atalho>
      ${this.limite.atingido
        ? html`<urbi-banner variante="info" icone="fa-solid fa-inbox">A caixa mostra as ${this.limite.quantas} conversas mais recentes. Para achar outra, use a busca ou um filtro.</urbi-banner>`
        : nothing}
      ${this.falha
        ? estadoTela('erro', { aoTentar: () => void this.carregar() })
        : html`<urbi-lista clicavel separador .itens=${this.itens} ?carregando=${this.carregando}
            mensagem-vazio=${this.filtro || this.busca ? 'Nenhuma conversa com este filtro.' : 'Nenhuma conversa ainda. As mensagens do portal e o que você envia aos clientes aparecem aqui.'}
            .itemAtivo=${(c: ItemLista) => c.id === this.selecionado}
            .indicador=${(c: ItemLista) => (c.id === this.selecionado ? 'var(--cor-primaria)' : c.nao_lidas ? 'var(--cor-alerta)' : '')}
            .render_item=${(c: ItemLista) => this.linha(c)}
            @urbi:lista-click=${(e: CustomEvent) => this.aoEscolher((e.detail.item as ItemLista).id)}></urbi-lista>`}
    </urbi-stack>`;
  }
}

// ---------- Centro: a conversa ----------

/** Base das partes do centro e do contexto: assinam a loja e redesenham quando a conversa muda. */
abstract class ParteDaConversa extends LitElement {
  @property({ type: Number }) conversaId = 0;
  protected readonly vida = gesto();
  @state() protected falha: unknown = null;
  @state() protected ocupado = false;
  private ouvinte = () => this.requestUpdate();

  createRenderRoot() {
    return this;
  }

  protected get d(): Detalhe | null {
    return loja.detalhes.get(this.conversaId) ?? null;
  }

  connectedCallback() {
    super.connectedCallback();
    loja.ouvintes.add(this.ouvinte);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    loja.ouvintes.delete(this.ouvinte);
  }

  protected async recarregar() {
    this.falha = null;
    try {
      await carregarDetalhe(this.conversaId, this.vida);
    } catch (e) {
      if (this.vida.encerrado(e)) return;
      this.falha = e;
      this.requestUpdate();
    }
  }

  /** Roda uma ação, avisa a falha e relê a conversa e a lista. */
  protected async agir(titulo: string, fn: () => Promise<void>) {
    if (this.ocupado) return;
    this.ocupado = true;
    try {
      await fn();
      await this.recarregar();
      listaMudou();
    } catch (e) {
      if (this.vida.encerrado(e)) return;
      await urbiVerso.alertar({ titulo, mensagem: mensagemDeErro(e), tipo: 'erro' });
    } finally {
      if (this.vida.vivo()) this.ocupado = false;
    }
  }
}

/** Topo do centro: a faixa do WhatsApp (11.0.4, D-116) e o cabeçalho da conversa. */
@customElement('pc-conversa-topo')
export class PcConversaTopo extends ParteDaConversa {
  connectedCallback() {
    super.connectedCallback();
    void this.recarregar();
  }

  /** Arquivar tira a conversa da caixa (filtro Arquivadas); o cliente voltando a falar reabre sozinha. */
  private arquivar(arquivada: boolean) {
    void this.agir(arquivada ? 'Não foi possível arquivar' : 'Não foi possível desarquivar', async () => {
      await this.vida.esperar(enviar('PATCH', `/conversas/${this.conversaId}`, { arquivada }));
    });
  }

  /** Assumir e Devolver (10.9.4): com negociação, a negociação muda primeiro (as regras moram lá). */
  private conduzir(acao: 'assumir' | 'devolver') {
    const d = this.d!;
    void this.agir(acao === 'assumir' ? 'Não foi possível assumir' : 'Não foi possível devolver ao Negociador', async () => {
      if (d.negociacao && (acao === 'assumir' ? d.negociacao.conduzida_por === 'ia' : d.negociacao.conduzida_por !== 'ia')) {
        await this.vida.esperar(enviar('POST', `/negociacoes/${d.negociacao.id}/${acao}`));
      }
      await this.vida.esperar(enviar('POST', `/conversas/${this.conversaId}/${acao}`));
      urbiVerso.notificar(acao === 'assumir' ? 'Você assumiu a conversa.' : 'Conversa devolvida ao Negociador.', 'sucesso');
    });
  }

  render() {
    const d = this.d;
    if (!d) return this.falha ? estadoDaFalha(this.falha, () => void this.recarregar()) : estadoTela('carregando');
    const c = d.contato;
    const temp = c.temperatura ? TEMPERATURA[c.temperatura] : null;
    const origem = c.origem_canal ? ROTULO_ORIGEM_CHIP[c.origem_canal] ?? c.origem_canal : null;
    const agente = d.conversa.atendido_por === 'agente';
    const eu = urbiVerso.usuario()?.nome ?? 'Você';
    return html`<urbi-stack>
      ${d.whatsapp.conectado
        ? nothing
        : html`<urbi-banner variante="alerta" icone="fa-brands fa-whatsapp">
            WhatsApp ainda não conectado: o que você escreve sai pelo WhatsApp do seu celular e fica registrado aqui.
            <urbi-botao slot="acao" variante="secundario" href=${urbiVerso.href('/ajustes/conexoes')}>Ajustes › Conexões</urbi-botao>
          </urbi-banner>`}
      <urbi-linha alinhar="inicio" justificar="entre" quebrar>
        <urbi-linha alinhar="inicio">
          <urbi-avatar nome=${c.nome} tamanho="36"></urbi-avatar>
          <urbi-stack>
            <urbi-prosa><strong>${c.nome}</strong></urbi-prosa>
            <urbi-linha quebrar gap="6px">
              ${temp ? html`<urbi-badge cor=${temp.cor}>${temp.rotulo}</urbi-badge>` : nothing}
              ${c.proximo_passo ? html`<urbi-badge cor="sucesso">${c.proximo_passo}</urbi-badge>` : nothing}
              ${origem ? html`<urbi-badge>Veio ${c.origem_campanha ? `do anúncio: ${c.origem_campanha}` : `de ${origem}`}</urbi-badge>` : nothing}
            </urbi-linha>
          </urbi-stack>
        </urbi-linha>
        <urbi-linha quebrar justificar="fim">
          <urbi-badge cor=${agente ? 'info' : 'sucesso'}>${quemAtende(d.conversa, eu.split(' ')[0])}</urbi-badge>
          ${agente
            ? html`<urbi-botao icone="fa-solid fa-hand" ?carregando=${this.ocupado} @click=${() => this.conduzir('assumir')}>Assumir</urbi-botao>`
            : d.negociacao?.conduzida_por === 'ia' || d.negociacao
              ? html`<urbi-botao variante="secundario" icone="fa-solid fa-robot" ?carregando=${this.ocupado} @click=${() => this.conduzir('devolver')}>Devolver ao Negociador</urbi-botao>`
              : html`<urbi-botao variante="secundario" icone="fa-solid fa-robot" desabilitado title="O Mensageiro chega com o WhatsApp">Reativar Mensageiro</urbi-botao>`}
          <urbi-botao variante="texto" icone=${d.conversa.arquivada_em ? 'fa-solid fa-box-open' : 'fa-solid fa-box-archive'} ?desabilitado=${this.ocupado} @click=${() => this.arquivar(!d.conversa.arquivada_em)}>${d.conversa.arquivada_em ? 'Desarquivar' : 'Arquivar'}</urbi-botao>
        </urbi-linha>
      </urbi-linha>
    </urbi-stack>`;
  }
}

/** Mensagens da conversa: do cliente à esquerda, as suas e as da IA à direita, avisos ao centro. */
@customElement('pc-conversa-mensagens')
export class PcConversaMensagens extends ParteDaConversa {
  private ultimaRolada: number | null = null;

  updated() {
    // Nova mensagem: rola para o fim. Quem rola é o `urbi-hospedeiro` aninhado que embrulha esta lista;
    // a altura dele só fica pronta depois do layout, então a rolagem espera o próximo quadro (no
    // `updated` ainda não há o que rolar e o `scrollIntoView` não faz nada).
    const d = this.d;
    const ultima = d?.mensagens.length ? Number(d.mensagens[d.mensagens.length - 1].id) : null;
    if (ultima !== null && ultima !== this.ultimaRolada) {
      this.ultimaRolada = ultima;
      requestAnimationFrame(() => this.querySelector('[data-fim]')?.scrollIntoView({ block: 'end' }));
    }
  }

  private cartaoImovel(m: Linha) {
    const dados = (m.dados ?? {}) as Linha;
    return html`<urbi-card>
      <urbi-stack>
        <urbi-prosa><strong>${dados.titulo ?? dados.codigo ?? 'Imóvel'}</strong></urbi-prosa>
        <urbi-prosa papel="secundario">${[dados.codigo, dados.bairro].filter(Boolean).join(' · ')}</urbi-prosa>
        ${dados.preco_c ? html`<urbi-prosa><strong>${reais(dados.preco_c)}</strong></urbi-prosa>` : nothing}
        <urbi-linha>
          ${dados.imovel_id ? html`<urbi-botao pequeno variante="secundario" href=${urbiVerso.href(`/imoveis/${dados.imovel_id}`)}>Ver ficha</urbi-botao>` : nothing}
          ${dados.link ? html`<urbi-botao pequeno variante="texto" href=${dados.link}>Ver fotos</urbi-botao>` : nothing}
        </urbi-linha>
      </urbi-stack>
    </urbi-card>`;
  }

  private bolha(m: Linha, nomeContato: string) {
    const sistema = m.autor_tipo === 'sistema' || (m.tipo === 'sistema' && m.autor_tipo === 'contato');
    if (sistema) {
      return html`<urbi-linha justificar="centro"><urbi-badge cor=${m.autor_tipo === 'contato' ? 'info' : 'alerta'} quebra-linha>${m.conteudo}</urbi-badge></urbi-linha>`;
    }
    const minha = m.direcao === 'saida';
    const rotulo = m.autor_tipo === 'agente' ? 'Negociador' : minha ? (m.autor_nome ?? 'Você') : null;
    const canal = m.canal === 'wa_me' ? 'pelo WhatsApp do celular' : m.canal === 'portal' ? 'pelo portal' : m.canal === 'registro' ? 'registrada' : '';
    const corpo =
      m.tipo === 'imovel' || m.tipo === 'localizacao'
        ? this.cartaoImovel(m)
        : m.tipo === 'link_portal'
          ? html`<urbi-prosa>Link do Portal do Cliente enviado${(m.dados as Linha)?.link ? html` · <a href=${(m.dados as Linha).link} target="_blank" rel="noopener">abrir</a>` : nothing}</urbi-prosa>`
          : m.tipo === 'selecao'
            ? html`<urbi-prosa>Seleção enviada${m.conteudo ? `: ${m.conteudo}` : ''}${(m.dados as Linha)?.quantidade ? ` · ${(m.dados as Linha).quantidade} imóve${Number((m.dados as Linha).quantidade) > 1 ? 'is' : 'l'}` : ''}${(m.dados as Linha)?.link ? html` · <a href=${(m.dados as Linha).link} target="_blank" rel="noopener">abrir</a>` : nothing}</urbi-prosa>`
            : m.tipo === 'arquivo'
            ? html`<urbi-prosa>Arquivo enviado${m.conteudo ? `: ${m.conteudo}` : ''}</urbi-prosa>`
            : html`<urbi-prosa pre>${m.conteudo}</urbi-prosa>`;
    return html`<urbi-linha justificar=${minha ? 'fim' : 'inicio'}>
      <urbi-card>
        <urbi-stack>
          ${rotulo ? html`<urbi-prosa papel="dica">${rotulo}${canal ? ` · ${canal}` : ''}</urbi-prosa>` : nothing}
          ${corpo}
          <urbi-prosa papel="fraco">${hora(m.em)}</urbi-prosa>
        </urbi-stack>
      </urbi-card>
    </urbi-linha>`;
  }

  render() {
    const d = this.d;
    if (!d) return this.falha ? nothing : estadoTela('carregando');
    if (!d.mensagens.length) {
      return estadoTela('vazio', { icone: 'fa-regular fa-comments', mensagem: 'Nenhuma mensagem ainda', submensagem: 'O que o cliente escrever pelo portal e o que você enviar aparecem aqui.' });
    }
    const partes: TemplateResult[] = [];
    let anterior: string | null = null;
    for (const m of d.mensagens) {
      if (!mesmoDia(anterior, m.em)) partes.push(html`<urbi-linha justificar="centro"><urbi-prosa papel="fraco">${mesmoDia(m.em, new Date().toISOString()) ? 'Hoje' : dia(m.em)}</urbi-prosa></urbi-linha>`);
      anterior = m.em;
      partes.push(this.bolha(m, d.contato.nome));
    }
    return html`<urbi-stack>${d.tem_mais ? html`<urbi-prosa papel="dica">Mostrando as últimas 100 mensagens.</urbi-prosa>` : nothing}${partes}<span data-fim></span></urbi-stack>`;
  }
}

/** Rodapé do centro: ações rápidas, sugestão da IA, compositor e o estado da janela. */
/** Um imóvel candidato à seleção (P02 › Seleção): da carteira, anunciável, marcado quando combina com o perfil. */
interface Candidato {
  imovel: Linha;
  marcado: boolean;
  combina: boolean;
}

@customElement('pc-conversa-compositor')
export class PcConversaCompositor extends ParteDaConversa {
  @state() private sugestao: string | null = null;
  @state() private rascunho = '';
  @state() private sugerindo = false;
  /** A gaveta aberta (o SDK não tem gaveta: `urbi-modal`, spec 11.9). */
  @state() private modal: 'selecao' | 'visita' | null = null;
  @state() private candidatos: Candidato[] = [];
  @state() private tituloSelecao = 'Imóveis para você';
  @state() private horarios: HorarioLivre[] = [];
  @state() private horario = '';
  @state() private imovelVisita = '';
  @state() private carregandoModal = false;

  connectedCallback() {
    super.connectedCallback();
    void this.sugerir();
  }

  /** Mensagem sugerida pela IA (slot `funil`), como na ficha: um chip acima do compositor. */
  private async sugerir() {
    this.sugerindo = true;
    try {
      const d = this.d ?? (await carregarDetalhe(this.conversaId, this.vida));
      if (!d) return;
      const r = (await this.vida.esperar(chamarApi(`/contatos/${d.contato.id}/mensagem-sugerida`))) as { mensagem?: string };
      this.sugestao = r?.mensagem?.trim() || null;
    } catch (e) {
      if (!this.vida.encerrado(e)) this.sugestao = null;
    } finally {
      if (this.vida.vivo()) this.sugerindo = false;
    }
  }

  /** Enviar texto: grava a mensagem e abre o WhatsApp do celular com ela (D-107). */
  private async enviarTexto(texto: string) {
    const t = texto.trim();
    if (!t) return;
    const r = (await this.vida.esperar(enviar('POST', `/conversas/${this.conversaId}/mensagens`, { texto: t }))) as { link: string | null };
    this.rascunho = '';
    this.sugestao = null;
    if (r.link) window.open(r.link, '_blank', 'noopener');
    else urbiVerso.notificar('Mensagem registrada (cliente sem WhatsApp).', 'info');
    await this.recarregar();
    listaMudou();
  }

  private async envio(tipo: 'imovel' | 'arquivo' | 'localizacao') {
    const d = this.d!;
    const vida = gesto();
    const campos =
      tipo === 'arquivo'
        ? [{ nome: 'descricao', tipo: 'texto' as const, rotulo: 'Qual arquivo', obrigatorio: true, placeholder: 'Ex.: planta do apartamento, minuta do contrato' }]
        : [{ nome: 'imovel_id', tipo: 'busca' as const, rotulo: 'Imóvel', obrigatorio: true, placeholder: 'Código, bairro ou título', buscar: buscaDoGesto(vida, '/imoveis', (i) => `${i.codigo} · ${i.titulo ?? i.bairro ?? ''}`) }];
    const titulo = tipo === 'imovel' ? 'Enviar imóvel' : tipo === 'arquivo' ? 'Registrar arquivo enviado' : 'Enviar localização';
    try {
      const v = await vida.esperar(urbiVerso.formulario({ titulo, campos, mensagem: tipo === 'arquivo' ? 'O arquivo vai pelo seu WhatsApp; aqui fica o registro na conversa.' : 'A mensagem pronta abre no WhatsApp do seu celular e fica registrada na conversa.' }));
      if (!v) return;
      const r = (await vida.esperar(enviar('POST', '/envios', { contato_id: d.contato.id, tipo, canal: 'whatsapp', imovel_id: v.imovel_id, descricao: v.descricao }))) as { mensagem: string | null; link: string | null; envio: Linha };
      if (tipo !== 'arquivo') {
        const im = r.envio;
        const texto = r.mensagem ?? (tipo === 'localizacao' ? `Localização do imóvel ${im.imovel_codigo ?? ''}${r.link ? `: ${r.link}` : ''}` : '');
        if (texto) await abrirWhatsapp(d.contato.telefone, texto);
      }
      urbiVerso.notificar('Registrado na conversa.', 'sucesso');
      await this.recarregar();
      listaMudou();
    } catch (e) {
      if (vida.encerrado(e)) return;
      await urbiVerso.alertar({ titulo: 'Não foi possível registrar o envio', mensagem: mensagemDeErro(e), tipo: 'erro' });
    }
  }

  /** Portal do cliente: gera (ou reenvia) o link e abre o WhatsApp com ele. */
  private async portal() {
    const d = this.d!;
    await this.agir('Não foi possível gerar o link do portal', async () => {
      const r = (await this.vida.esperar(enviar('POST', `/contatos/${d.contato.id}/portal`))) as { link: string | null };
      if (r.link) await abrirWhatsapp(d.contato.telefone, `${d.contato.nome.split(' ')[0]}, aqui está o seu portal com tudo o que separei para você: ${r.link}`);
    });
  }

  /**
   * Proposta (D-127): o registro de proposta ligado ao negócio do contato, que cria ou abre a negociação e
   * a abre em Clientes › Negociações; a conversa ganha o aviso "Negociação aberta".
   */
  private async proposta() {
    const d = this.d!;
    let nid: number | null = null;
    await this.agir('Não foi possível abrir a negociação', async () => {
      nid = await propostaDoContato(this.vida, { id: Number(d.contato.id), nome: String(d.contato.nome) });
    });
    if (nid && this.vida.vivo()) abrirNegociacao(nid);
  }

  /** Imóveis da carteira que podem ir ao cliente: ativos ou reservados, com autorização vigente (como a seleção da ficha). */
  private async anunciaveis(): Promise<Linha[]> {
    const lista: Linha[] = [];
    for (const situacao of ['ativo', 'reservado']) {
      for (let pagina = 1; pagina <= 20; pagina++) {
        const r = (await this.vida.esperar(chamarApi(`/imoveis?situacao=${situacao}&pagina=${pagina}`))) as { dados?: Linha[]; paginas?: number };
        lista.push(...(r.dados ?? []).filter((i) => i.autorizacao_vigente));
        if (pagina >= (r.paginas ?? 1)) break;
      }
    }
    return lista;
  }

  /**
   * Seleção (D-127): a gaveta com os imóveis anunciáveis, já marcados os que combinam com o perfil de
   * busca (a regra de "Também combinam" do contexto). Confirmar cria a seleção (`POST /selecoes`), que
   * registra o cartão na conversa e devolve a mensagem pronta; o WhatsApp do celular abre com ela.
   */
  private async abrirSelecao() {
    const d = this.d!;
    this.carregandoModal = true;
    try {
      const [imoveis, ficha] = await this.vida.esperar(Promise.all([this.anunciaveis(), chamarApi(`/contatos/${d.contato.id}`) as Promise<Linha>]));
      const perfil = ficha?.contato?.perfil_busca ?? d.contato.perfil_busca;
      if (!imoveis.length) {
        await urbiVerso.alertar({ titulo: 'Nenhum imóvel para enviar', mensagem: 'Só vão na seleção imóveis ativos ou reservados, com autorização de venda vigente.', tipo: 'alerta' });
        return;
      }
      this.candidatos = imoveis.map((imovel) => {
        const bate = !!perfil && !!combina(perfil, imovel);
        return { imovel, marcado: bate, combina: bate };
      });
      this.tituloSelecao = 'Imóveis para você';
      this.modal = 'selecao';
    } catch (e) {
      if (this.vida.encerrado(e)) return;
      await urbiVerso.alertar({ titulo: 'Não foi possível carregar os imóveis', mensagem: mensagemDeErro(e), tipo: 'erro' });
    } finally {
      if (this.vida.vivo()) this.carregandoModal = false;
    }
  }

  private async confirmarSelecao() {
    const d = this.d!;
    const ids = this.candidatos.filter((c) => c.marcado).map((c) => Number(c.imovel.id));
    if (!ids.length || ids.length > 12) {
      await urbiVerso.alertar({ titulo: 'Confira os imóveis', mensagem: 'Escolha de 1 a 12 imóveis.', tipo: 'alerta' });
      return;
    }
    await this.agir('Não foi possível criar a seleção', async () => {
      const r = (await this.vida.esperar(enviar('POST', '/selecoes', { contato_id: d.contato.id, titulo: this.tituloSelecao.trim() || 'Imóveis para você', imovel_ids: ids }))) as { mensagem?: string | null; link?: string | null; conversa_id?: number | null };
      this.modal = null;
      // Sem URL pública na instância o backend devolve o caminho (`/portal_corretor/s?t=…`): a mensagem leva o link completo, como na ficha.
      const link = r.link ?? '';
      const mensagem = r.mensagem && link.startsWith('/') ? r.mensagem.split(link).join(`${window.location.origin}${link}`) : r.mensagem;
      if (mensagem) await abrirWhatsapp(d.contato.telefone, mensagem);
      // `conversa_id` nulo: a seleção existe e foi enviada, mas o cartão não entrou na conversa.
      if (r.conversa_id) urbiVerso.notificar('Seleção criada e registrada na conversa.', 'sucesso');
      else urbiVerso.notificar('Seleção criada e enviada; o cartão não ficou registrado na conversa.', 'info');
    });
  }

  /**
   * Agendar visita (D-127): a gaveta com o imóvel (os da carteira anunciáveis; pré-escolhido o último
   * enviado) e os horários livres dos próximos dias, sem choque com as atividades pendentes. Confirmar
   * cria a visita numa chamada só (`POST /atividades` com `confirmacao`: programa o lembrete, publica
   * `visita_agendada` e registra a confirmação na conversa); a tela abre o WhatsApp do celular com ela.
   */
  private async abrirVisita() {
    const d = this.d!;
    this.carregandoModal = true;
    try {
      const ate = new Date(Date.now() + 7 * 86400e3).toISOString();
      const [imoveis, pendentes, envios] = await this.vida.esperar(
        Promise.all([
          this.anunciaveis(),
          chamarApi(`/atividades?status=pendente&ate=${encodeURIComponent(ate)}`) as Promise<{ dados: Linha[] }>,
          chamarApi(`/envios?contato_id=${d.contato.id}`).catch(() => ({ dados: [] })) as Promise<{ dados: Linha[] }>,
        ]),
      );
      this.horarios = horariosLivres(pendentes.dados ?? []);
      this.horario = this.horarios[0]?.iso ?? '';
      const ultimoEnviado = (envios.dados ?? []).find((e) => e.imovel_id)?.imovel_id;
      this.candidatos = imoveis.map((imovel) => ({ imovel, marcado: false, combina: false }));
      this.imovelVisita = ultimoEnviado && imoveis.some((i) => Number(i.id) === Number(ultimoEnviado)) ? String(ultimoEnviado) : (imoveis[0] ? String(imoveis[0].id) : '');
      this.modal = 'visita';
    } catch (e) {
      if (this.vida.encerrado(e)) return;
      await urbiVerso.alertar({ titulo: 'Não foi possível preparar a visita', mensagem: mensagemDeErro(e), tipo: 'erro' });
    } finally {
      if (this.vida.vivo()) this.carregandoModal = false;
    }
  }

  private async confirmarVisita() {
    const d = this.d!;
    const imovel = this.candidatos.find((c) => String(c.imovel.id) === this.imovelVisita)?.imovel ?? null;
    if (!this.horario) {
      await urbiVerso.alertar({ titulo: 'Escolha o horário', mensagem: 'Nenhum horário livre escolhido.', tipo: 'alerta' });
      return;
    }
    await this.agir('Não foi possível marcar a visita', async () => {
      const titulo = imovel ? `Visita: ${imovel.codigo}${imovel.titulo ? ` · ${imovel.titulo}` : ''}`.slice(0, 200) : 'Visita';
      const confirmacao = mensagemDaVisita(String(d.contato.nome), this.horario, imovel ? { codigo: imovel.codigo, titulo: imovel.titulo, bairro: imovel.bairro } : null);
      // Uma chamada só: a visita, o lembrete e a confirmação na conversa (consequência da visita criada).
      const r = (await this.vida.esperar(
        enviar('POST', '/atividades', { tipo: 'visita', titulo, quando: this.horario, contato_id: d.contato.id, imovel_id: imovel ? Number(imovel.id) : undefined, local: imovel?.bairro ?? undefined, confirmacao }),
      )) as { confirmacao?: { link: string | null; conversa_id: number | null } };
      this.modal = null;
      if (r.confirmacao?.link) window.open(r.confirmacao.link, '_blank', 'noopener');
      if (r.confirmacao?.conversa_id) urbiVerso.notificar('Visita marcada e confirmação registrada na conversa.', 'sucesso');
      else urbiVerso.notificar('Visita marcada; a confirmação não ficou registrada na conversa.', 'info');
    });
  }

  /** A gaveta de Seleção: título, os imóveis com a marcação, Criar e enviar. */
  private modalSelecao() {
    const marcados = this.candidatos.filter((c) => c.marcado).length;
    return html`<urbi-modal title="Seleção de imóveis" maxWidth="560px" @urbi-modal:close=${() => (this.modal = null)}>
      <urbi-stack>
        <urbi-prosa papel="dica">Os que combinam com o perfil de busca já vêm marcados. O cliente abre pelo link, sem login, e diz o que achou de cada um (até 12).</urbi-prosa>
        <urbi-input label="Título" valor=${this.tituloSelecao} @urbi:input-change=${(e: CustomEvent) => (this.tituloSelecao = e.detail.valor)}></urbi-input>
        <urbi-lista separador .itens=${this.candidatos} .render_item=${(c: Candidato) => html`<urbi-linha justificar="entre">
            <urbi-checkbox label=${`${c.imovel.codigo} · ${c.imovel.titulo ?? c.imovel.tipo}${c.imovel.bairro ? ` · ${c.imovel.bairro}` : ''}${c.imovel.preco_c ? ` · ${reais(c.imovel.preco_c)}` : ''}`} ?marcado=${c.marcado}
              @urbi:checkbox-change=${(e: CustomEvent) => (this.candidatos = this.candidatos.map((x) => (x === c ? { ...x, marcado: !!e.detail.marcado } : x)))}></urbi-checkbox>
            ${c.combina ? html`<urbi-badge cor="sucesso">Combina</urbi-badge>` : nothing}
          </urbi-linha>`}></urbi-lista>
        <urbi-linha justificar="fim">
          <urbi-botao variante="secundario" @click=${() => (this.modal = null)}>Cancelar</urbi-botao>
          <urbi-botao icone="fa-solid fa-paper-plane" ?carregando=${this.ocupado} ?desabilitado=${!marcados} @click=${() => void this.confirmarSelecao()}>Criar e enviar${marcados ? ` (${marcados})` : ''}</urbi-botao>
        </urbi-linha>
      </urbi-stack>
    </urbi-modal>`;
  }

  /** A gaveta de Agendar visita: o imóvel e os horários livres. */
  private modalVisita() {
    return html`<urbi-modal title="Agendar visita" maxWidth="480px" @urbi-modal:close=${() => (this.modal = null)}>
      <urbi-stack>
        <urbi-prosa papel="dica">Os horários são os livres na sua agenda nos próximos dias (das 9 h às 18 h). O lembrete é programado e a confirmação vai ao cliente pelo seu WhatsApp.</urbi-prosa>
        <urbi-select label="Imóvel" valor=${this.imovelVisita} pesquisavel placeholder="Sem imóvel"
          .opcoes=${this.candidatos.map((c) => ({ valor: String(c.imovel.id), rotulo: `${c.imovel.codigo} · ${c.imovel.titulo ?? c.imovel.bairro ?? ''}` }))}
          @urbi:select-change=${(e: CustomEvent) => (this.imovelVisita = e.detail.valor)}></urbi-select>
        ${this.horarios.length
          ? html`<urbi-select label="Horário livre" valor=${this.horario} .opcoes=${this.horarios.map((h) => ({ valor: h.iso, rotulo: h.rotulo }))}
              @urbi:select-change=${(e: CustomEvent) => (this.horario = e.detail.valor)}></urbi-select>`
          : html`<urbi-prosa papel="alerta">Nenhum horário livre nos próximos dias: conclua ou cancele atividades na agenda.</urbi-prosa>`}
        <urbi-linha justificar="fim">
          <urbi-botao variante="secundario" @click=${() => (this.modal = null)}>Cancelar</urbi-botao>
          <urbi-botao icone="fa-regular fa-calendar-check" ?carregando=${this.ocupado} ?desabilitado=${!this.horario} @click=${() => void this.confirmarVisita()}>Marcar e confirmar</urbi-botao>
        </urbi-linha>
      </urbi-stack>
    </urbi-modal>`;
  }

  render() {
    const d = this.d;
    if (!d) return nothing;
    const semZap = !linkWhatsapp(d.contato.telefone, '-');
    const acoes = [
      { rotulo: 'Imóvel', icone: 'fa-solid fa-house', ao: () => void this.envio('imovel') },
      { rotulo: 'Seleção', icone: 'fa-solid fa-filter', ao: () => void this.abrirSelecao() },
      { rotulo: 'Arquivo', icone: 'fa-regular fa-file', ao: () => void this.envio('arquivo') },
      { rotulo: 'Localização', icone: 'fa-solid fa-location-dot', ao: () => void this.envio('localizacao') },
      { rotulo: 'Agendar visita', icone: 'fa-regular fa-calendar', ao: () => void this.abrirVisita() },
      { rotulo: 'Portal do cliente', icone: 'fa-regular fa-user', ao: () => void this.portal() },
      { rotulo: 'Proposta', icone: 'fa-solid fa-handshake', ao: () => void this.proposta() },
    ];
    return html`<urbi-stack>
      <urbi-linha quebrar>
        ${acoes.map((a) => html`<urbi-botao variante="secundario" icone=${a.icone} ?desabilitado=${this.ocupado || this.carregandoModal} @click=${a.ao}>${a.rotulo}</urbi-botao>`)}
      </urbi-linha>
      ${this.modal === 'selecao' ? this.modalSelecao() : this.modal === 'visita' ? this.modalVisita() : nothing}
      ${this.sugestao
        ? html`<urbi-linha><urbi-botao variante="secundario" icone="fa-solid fa-wand-magic-sparkles" title="Usar a sugestão no compositor" @click=${() => (this.rascunho = this.sugestao!)}>Sugestão: “${this.sugestao.length > 70 ? `${this.sugestao.slice(0, 70)}…` : this.sugestao}”</urbi-botao></urbi-linha>`
        : this.sugerindo
          ? html`<urbi-prosa papel="dica"><urbi-spinner></urbi-spinner> Pensando numa sugestão…</urbi-prosa>`
          : nothing}
      <urbi-redator placeholder=${`Escreva como ${(urbiVerso.usuario()?.nome ?? 'você').split(' ')[0]}…`} enter-envia audio
        .valorInicial=${this.rascunho}
        .aoEnviar=${(det: { texto: string }) => this.enviarTexto(det.texto)}
        @urbi:redator-rascunho=${(e: CustomEvent) => (this.rascunho = e.detail?.texto ?? '')}></urbi-redator>
      <urbi-prosa papel="dica">${semZap ? 'Cliente sem WhatsApp cadastrado: a mensagem fica só registrada.' : 'Sem o WhatsApp do app, a mensagem abre no WhatsApp do seu celular e fica registrada aqui. Janela de 24 h e modelos chegam com a conexão.'}</urbi-prosa>
    </urbi-stack>`;
  }
}

// ---------- Direita: o contexto do cliente ----------

@customElement('pc-conversa-contexto')
export class PcConversaContexto extends ParteDaConversa {
  @state() private ficha: Linha | null = null;
  @state() private envios: Linha[] = [];
  @state() private combinam: Linha[] = [];
  private contatoCarregado: number | null = null;

  updated() {
    const cid = this.d ? Number(this.d.contato.id) : null;
    if (cid && cid !== this.contatoCarregado) {
      this.contatoCarregado = cid;
      void this.carregarContexto(cid);
    }
  }

  private async carregarContexto(cid: number) {
    try {
      const [ficha, envios, imoveis] = await this.vida.esperar(
        Promise.all([
          chamarApi(`/contatos/${cid}`) as Promise<Linha>,
          chamarApi(`/envios?contato_id=${cid}`) as Promise<{ dados: Linha[] }>,
          chamarApi('/imoveis?situacao=ativo&por_pagina=50') as Promise<{ dados: Linha[] }>,
        ]),
      );
      this.ficha = ficha;
      this.envios = envios.dados ?? [];
      const perfil = ficha.contato?.perfil_busca;
      this.combinam = perfil ? (imoveis.dados ?? []).filter((im) => !!combina(perfil, im)).slice(0, 3) : [];
    } catch (e) {
      seNaoContaTrocada(() => {
        this.ficha = null;
      })(e);
    }
  }

  private async enviarImovel(im: Linha) {
    const d = this.d!;
    await this.agir('Não foi possível enviar o imóvel', async () => {
      const r = (await this.vida.esperar(enviar('POST', '/envios', { contato_id: d.contato.id, tipo: 'imovel', canal: 'whatsapp', imovel_id: im.id }))) as { mensagem: string | null };
      if (r.mensagem) await abrirWhatsapp(d.contato.telefone, r.mensagem);
      void this.carregarContexto(Number(d.contato.id));
    });
  }

  render() {
    const d = this.d;
    if (!d) return this.falha ? nothing : estadoTela('carregando');
    const c = d.contato;
    const perfil = chipsDoPerfilBusca(c.perfil_busca);
    const abordagem = this.ficha?.abordagem as Linha | null | undefined;
    return html`<urbi-stack>
      <urbi-card titulo="Próxima abordagem" icone="fa-solid fa-wand-magic-sparkles">
        ${abordagem
          ? html`<urbi-stack>
              <urbi-prosa>${abordagem.abordagem}</urbi-prosa>
              <urbi-linha><urbi-botao variante="texto" icone="fa-brands fa-whatsapp" @click=${() => void abrirWhatsapp(c.telefone, String(abordagem.abordagem))}>Usar mensagem pronta</urbi-botao></urbi-linha>
            </urbi-stack>`
          : html`<urbi-prosa papel="dica">${this.ficha ? 'Nenhuma abordagem pendente.' : 'Carregando…'}</urbi-prosa>`}
      </urbi-card>
      <urbi-card titulo=${`Enviado para ${String(c.nome).split(' ')[0]}`} icone="fa-regular fa-paper-plane">
        ${this.envios.length
          ? html`<urbi-lista separador .itens=${this.envios.slice(0, 5)} .render_item=${(e: Linha) => html`<urbi-linha justificar="entre">
              <urbi-prosa papel="secundario" truncar>${e.imovel_titulo ?? e.descricao ?? e.tipo}</urbi-prosa>
              <urbi-badge cor=${Number(e.cliques) > 0 ? 'sucesso' : 'padrao'}>${Number(e.cliques) > 1 ? `Abriu ${e.cliques}x` : Number(e.cliques) === 1 ? 'Clicou' : 'Enviado'}</urbi-badge>
            </urbi-linha>`}></urbi-lista>`
          : html`<urbi-prosa papel="dica">Nada enviado ainda.</urbi-prosa>`}
      </urbi-card>
      <urbi-card titulo="Também combinam" icone="fa-solid fa-house-circle-check">
        ${this.combinam.length
          ? html`<urbi-lista separador .itens=${this.combinam} .render_item=${(im: Linha) => html`<urbi-linha justificar="entre">
              <urbi-stack expandir>
                <urbi-prosa truncar><strong>${im.titulo ?? im.codigo}</strong></urbi-prosa>
                <urbi-prosa papel="secundario">${[im.bairro, im.preco_c ? reais(im.preco_c) : null].filter(Boolean).join(' · ')}</urbi-prosa>
              </urbi-stack>
              <urbi-botao variante="secundario" ?desabilitado=${this.ocupado} @click=${() => void this.enviarImovel(im)}>Enviar</urbi-botao>
            </urbi-linha>`}></urbi-lista>`
          : html`<urbi-prosa papel="dica">${perfil.length ? 'Nenhum imóvel da carteira combina com o perfil.' : 'Anote o perfil de busca na ficha para ver os imóveis que combinam.'}</urbi-prosa>`}
      </urbi-card>
      ${perfil.length ? html`<urbi-linha quebrar gap="6px">${perfil.map((p) => html`<urbi-badge>${p}</urbi-badge>`)}</urbi-linha>` : nothing}
      <urbi-botao variante="secundario" bloco icone="fa-solid fa-chevron-right" href=${urbiVerso.href(`/clientes/${c.id}`)}>Abrir ficha completa</urbi-botao>
      ${c.proximo_passo && this.ficha ? html`<urbi-prosa papel="fraco">Próximo passo: ${c.proximo_passo}${this.ficha.contato?.proximo_passo_em ? ` · ${dataCurta(this.ficha.contato.proximo_passo_em)}` : ''}</urbi-prosa>` : nothing}
    </urbi-stack>`;
  }
}

// ---------- A tela ----------

/** Conversas (P02) na moldura: `?item=` guarda a conversa aberta. */
export function renderConversas(atualizar: () => void) {
  const item = conversaDaUrl();
  const escolher = (id: number) => escolherConversa(id, atualizar);
  const lista = html`<pc-conversas-lista .selecionado=${item} .aoEscolher=${escolher}></pc-conversas-lista>`;
  if (!item) {
    return moldura(
      {
        menu: '/conversas',
        lista,
        centro: estadoTela('vazio', { icone: 'fa-regular fa-comments', mensagem: 'Escolha uma conversa', submensagem: 'Ou abra uma nova pelo botão Nova.' }),
        rotulos: { lista: 'Conversas', centro: 'Conversa', contexto: 'Cliente' },
        painel: 'esquerda',
      },
      atualizar,
    );
  }
  // O centro como a referência: a faixa e o cabeçalho com altura natural, as mensagens enchendo o que
  // sobra e rolando por dentro, as ações rápidas, a sugestão e o compositor fixos embaixo. É a política
  // de slot do `urbi-hospedeiro` (ui-componentes-layout.md): dentro do hospedeiro `expandir` da coluna,
  // só o filho `expandir` preenche; o hospedeiro aninhado das mensagens zera o próprio respiro e rola.
  // Três hospedeiros irmãos no slot não servem: cada um enche a coluna por igual (conferido no shell 0.56.37).
  // `keyed` pelo id: trocar de conversa recria as partes; o topo carrega a conversa nova na loja no
  // `connectedCallback`, o compositor pede a sugestão, e mensagens e contexto leem a loja (sem o `keyed`
  // o Lit reaproveitaria os elementos e a conversa nova ficaria em "carregando").
  const centro = keyed(item, html`<pc-conversa-topo .conversaId=${item}></pc-conversa-topo>
    <urbi-hospedeiro expandir><pc-conversa-mensagens .conversaId=${item}></pc-conversa-mensagens></urbi-hospedeiro>
    <pc-conversa-compositor .conversaId=${item}></pc-conversa-compositor>`);
  return moldura(
    {
      menu: '/conversas',
      lista,
      centro,
      contexto: keyed(item, html`<pc-conversa-contexto .conversaId=${item}></pc-conversa-contexto>`),
      rotulos: { lista: 'Conversas', centro: 'Conversa', contexto: 'Cliente' },
      painel: 'centro',
    },
    atualizar,
  );
}
