import { LitElement, html, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { UrbiVersoAPI } from '@urbiverso/sdk';
import { PLAYBOOK_OBJECOES_PADRAO } from '../../comum/negociacao';
import {
  ABERTOS,
  centavosDeReais,
  destinoDaProposta,
  diferencaDoPedido,
  filtroNegociacoes,
  FILTROS_NEGOCIACOES,
  linhaDeValidacoes,
  quemConduz,
  reaisDoCampo,
  ROTULO_AUTONOMIA,
  ROTULO_AUTOR,
  ROTULO_CANAL,
  ROTULO_DIRECAO,
  ROTULO_ESTADO_NEGOCIACAO,
  rotuloRodada,
  TEXTO_TRAVA_SUGESTAO,
  textoDoBloqueio,
  travaDaSugestao,
} from '../../comum/negociacao-tela';
import { acoesComMais, chamarApi, contaAtiva, data, dataHora, enviar, filtrosDaUrl, filtrosNaUrl, mensagemDeErro, opcoes, reais, ROTULO_MOTIVO_PERDA } from '../apoio.js';
import { DICA_IA_INDISPONIVEL, estadoDaFalha, estadoTela } from '../estados.js';
import { irParaComQuery } from '../criar.js';
import { contatoEmFoco } from './assistente.js';
import './mandato.js';

declare const urbiVerso: UrbiVersoAPI;

// Clientes › Negociações (P15, spec 11.1; M8 no celular; issue #102). À esquerda, a lista com os
// filtros (Aguardando você · Negociador · Cliente · Proprietário · Encerradas); no centro, a negociação
// escolhida (`?item=<negociacao>`): cabeçalho com Assumir, a faixa da negociação, a escada de propostas,
// a última fala do cliente, o cartão "Negociador sugere" e o aceite; à direita, o mandato em resumo, a
// leitura do comprador e o próximo movimento. Sigilo (regra do dono): recuo, alvo e BATNA do vendedor só
// chegam pela rota do mandato e só quando o corretor clica em "mostrar"; nada disso vai ao console.
//
// Exceção nomeada (spec 11.9, pedido ao shell 13): a **faixa ZOPA** não tem primitivo no SDK 100. Até
// lá, os valores vão em `urbi-kpi` (oferta, recuo mascarado, teto, alvo mascarado, pedido) e a ZOPA em
// texto. O cartão de sugestão é `urbi-card` (a borda lilás do mockup não tem token: vai o ícone de IA).

type Linha = Record<string, any>;

const MASCARA = '••••';
/** "R$ 1,32 mi" na lista: curto, como no mockup. */
const curto = (c: number | null | undefined) => {
  if (!c) return '—';
  const r = c / 100;
  return r >= 1_000_000 ? `R$ ${(r / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} mi` : r >= 1000 ? `R$ ${Math.round(r / 1000).toLocaleString('pt-BR')} mil` : reais(c);
};
/** Tempo desde a última mudança ("hoje", "há 3 dias"). */
const haQuanto = (iso: string | null | undefined) => {
  if (!iso) return '';
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86400e3);
  return dias <= 0 ? 'hoje' : dias === 1 ? 'ontem' : `há ${dias} dias`;
};
const ROTULO_OBJECAO = Object.fromEntries(PLAYBOOK_OBJECOES_PADRAO.map((o) => [o.categoria, o.titulo])) as Record<string, string>;

/** Endereço da negociação: a visão Negociações de Clientes com o item (o mesmo das notificações). */
export const enderecoDaNegociacao = (id: number) => `/clientes?visao=negociacoes&item=${id}`;
/** O mesmo endereço para `href` (o `urbiVerso.href` monta o path; a query vai depois). */
export const hrefDaNegociacao = (id: number) => `${urbiVerso.href('/clientes')}?visao=negociacoes&item=${id}`;

// ---------------------------------------------------------------------------------------------------
// Nova proposta (Criar, ficha do cliente, Funil): a oferta do cliente para um imóvel. Grava na
// negociação em andamento desse cliente e imóvel ou abre uma (com um negócio novo, se preciso).

const buscar = (rota: string, rotulo: (l: Linha) => string) => async (termo: string, signal: AbortSignal) => {
  const r = await chamarApi(`${rota}?busca=${encodeURIComponent(termo)}`, { signal });
  return (r?.dados ?? []).map((l: Linha) => ({ valor: Number(l.id), rotulo: rotulo(l) }));
};

/** Abre o formulário e grava a oferta. Devolve o id da negociação, ou `null` se cancelou ou falhou. */
export async function novaProposta(contato: { id: number; nome: string } | null = contatoEmFoco()): Promise<number | null> {
  const v = await urbiVerso.formulario({
    titulo: 'Nova proposta',
    mensagem: 'A oferta do cliente para um imóvel. Se ainda não houver negociação, ela começa aqui.',
    campos: [
      { nome: 'contato_id', tipo: 'busca', rotulo: 'Cliente', obrigatorio: true, valor: contato?.id ?? null, rotuloValor: contato?.nome, placeholder: 'Nome ou telefone', buscar: buscar('/contatos', (c) => c.nome) },
      { nome: 'imovel_id', tipo: 'busca', rotulo: 'Imóvel', obrigatorio: true, placeholder: 'Código, bairro ou título', buscar: buscar('/imoveis', (i) => `${i.codigo} · ${i.titulo ?? i.bairro ?? ''}`) },
      { nome: 'valor', tipo: 'texto', rotulo: 'Valor oferecido (R$)', placeholder: '1.320.000', obrigatorio: true },
      { nome: 'condicoes', tipo: 'texto_longo', rotulo: 'Condições (opcional)', placeholder: 'Entrada, prazo, financiamento…' },
    ],
    rotuloConfirmar: 'Registrar',
  });
  if (!v) return null;
  const valor_c = centavosDeReais(v.valor);
  if (!valor_c) {
    await urbiVerso.alertar({ titulo: 'Valor inválido', mensagem: 'Escreva o valor em reais, por exemplo 1.320.000.', tipo: 'erro' });
    return null;
  }
  const cid = Number(v.contato_id);
  const iid = Number(v.imovel_id);
  try {
    const [ficha, abertas] = await Promise.all([
      chamarApi(`/contatos/${cid}`),
      chamarApi(`/negociacoes?contato_id=${cid}&estado=${ABERTOS.join(',')}&por_pagina=100`),
    ]);
    const destino = destinoDaProposta(iid, ficha.negocios ?? [], abertas.dados ?? []);
    let nid = 'negociacao_id' in destino ? destino.negociacao_id : null;
    if (!nid) {
      const negocio_id = 'negocio_id' in destino ? destino.negocio_id : (await enviar('POST', '/negocios', { contato_id: cid, imovel_id: iid, pipeline: 'compra' })).id;
      nid = (await enviar('POST', '/negociacoes', { negocio_id, imovel_id: iid })).id;
    }
    await enviar('POST', `/negociacoes/${nid}/propostas`, { direcao: 'comprador', valor_c, condicoes: v.condicoes || null });
    urbiVerso.notificar('Proposta registrada.', 'sucesso');
    return nid;
  } catch (e) {
    await urbiVerso.alertar({ titulo: 'Não foi possível registrar a proposta', mensagem: mensagemDeErro(e), tipo: 'erro' });
    return null;
  }
}

// ---------------------------------------------------------------------------------------------------
// Coluna esquerda: a lista.

@customElement('pc-negociacoes-lista')
export class PcNegociacoesLista extends LitElement {
  /** Topo comum de Clientes (título, ação e as visões), desenhado por `clientes.ts`. */
  @property({ attribute: false }) topo: unknown = nothing;
  @property({ attribute: false }) selecionado: number | null = null;
  @property({ attribute: false }) aoEscolher: (id: number) => void = () => {};
  @state() private itens: Linha[] = [];
  @state() private carregando = true;
  @state() private falha: unknown = null;
  private geracao = 0;

  connectedCallback() {
    super.connectedCallback();
    void this.carregar();
  }

  private async carregar() {
    const geracao = ++this.geracao;
    this.carregando = true;
    this.falha = null;
    const q = new URLSearchParams({ ...filtroNegociacoes(filtrosDaUrl().get('filtro')).consulta, por_pagina: '100' });
    try {
      const r = await chamarApi(`/negociacoes?${q}`);
      if (geracao === this.geracao) this.itens = r.dados ?? [];
    } catch (e) {
      if (geracao === this.geracao) this.falha = e;
    } finally {
      if (geracao === this.geracao) this.carregando = false;
    }
  }

  private filtrar(id: string) {
    filtrosNaUrl(filtrosDaUrl(), { filtro: id === 'todas' ? '' : id });
    void this.carregar();
  }

  private linha(n: Linha) {
    const estado = ROTULO_ESTADO_NEGOCIACAO[n.estado as keyof typeof ROTULO_ESTADO_NEGOCIACAO];
    const dif = diferencaDoPedido(n.ultima_oferta_c, n.preco_pedido_c);
    return html`<urbi-stack>
      <urbi-linha justificar="entre" quebrar>
        <urbi-prosa>${n.contato_nome ?? 'Cliente'}</urbi-prosa>
        ${estado ? html`<urbi-badge cor=${estado.cor}>${estado.rotulo}</urbi-badge>` : nothing}
      </urbi-linha>
      <urbi-prosa papel="secundario">${[n.imovel_codigo, n.imovel_titulo].filter(Boolean).join(' · ') || n.codigo}</urbi-prosa>
      <urbi-prosa papel="fraco">${[n.ultima_oferta_c ? `${curto(n.ultima_oferta_c)}${dif ? ` · ${dif}` : ''}` : 'Sem oferta', quemConduz(n.conduzida_por), haQuanto(n.atualizado_em)].filter(Boolean).join(' · ')}</urbi-prosa>
    </urbi-stack>`;
  }

  render() {
    const filtro = filtroNegociacoes(filtrosDaUrl().get('filtro'));
    return html`<urbi-stack>
      ${this.topo}
      <urbi-chips-atalho .opcoes=${FILTROS_NEGOCIACOES.map((f) => ({ id: f.id, rotulo: f.rotulo }))} ativo=${filtro.id}
        @urbi:chip-atalho:click=${(e: CustomEvent) => this.filtrar(e.detail.id)}></urbi-chips-atalho>
      ${this.falha
        ? estadoTela('erro', { aoTentar: () => void this.carregar() })
        : html`<urbi-lista clicavel separador .itens=${this.itens} ?carregando=${this.carregando}
            mensagem-vazio=${filtro.id === 'todas' ? 'Nenhuma negociação em andamento. Registre a oferta de um cliente em Nova proposta.' : 'Nenhuma negociação neste filtro.'}
            .itemAtivo=${(n: Linha) => n.id === this.selecionado}
            .indicador=${(n: Linha) => (n.id === this.selecionado ? 'var(--cor-primaria)' : '')}
            .render_item=${(n: Linha) => this.linha(n)}
            @urbi:lista-click=${(e: CustomEvent) => this.aoEscolher(Number((e.detail.item as Linha).id))}></urbi-lista>`}
    </urbi-stack>`;
  }
}

// ---------------------------------------------------------------------------------------------------
// A negociação escolhida: um estado só, lido pelas duas colunas (centro e direita).

interface EstadoNegociacao {
  n: Linha | null;
  falha: unknown;
  /** Mandato completo (recuo, alvo, BATNA): só depois do "mostrar", e só nesta visita. */
  sigilo: Linha | null;
  revelando: boolean;
  /** Sonda do slot do Negociador (sem custo). `null` = ainda não respondeu. */
  ia: boolean | null;
  ocupado: string | null;
  mandatoAberto: boolean;
}

export class NegociacaoAberta {
  private ouvintes = new Set<() => void>();
  readonly s: EstadoNegociacao;
  private sondada = false;

  constructor(readonly id: number, private aoMudarLista: () => void) {
    const avisar = () => this.ouvintes.forEach((f) => f());
    const inicial: EstadoNegociacao = { n: null, falha: null, sigilo: null, revelando: false, ia: null, ocupado: null, mandatoAberto: false };
    this.s = new Proxy(inicial, {
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

  entrar() {
    void this.carregar();
    if (this.sondada) return;
    this.sondada = true;
    void chamarApi('/negociador/ia').then(
      (r) => (this.s.ia = !!r?.disponivel),
      () => (this.s.ia = false),
    );
  }

  async carregar() {
    this.s.falha = null;
    try {
      this.s.n = await chamarApi(`/negociacoes/${this.id}`);
    } catch (e) {
      this.s.falha = e;
    }
  }

  /** Revela recuo, alvo e BATNA (P15: "•••• mostrar"). Lido na rota do mandato, só agora. */
  async mostrarSigilo() {
    if (this.s.sigilo) {
      this.s.sigilo = null;
      return;
    }
    this.s.revelando = true;
    try {
      const r = await chamarApi(`/negociacoes/${this.id}/mandato`);
      this.s.sigilo = r.vigente ?? null;
    } catch (e) {
      await urbiVerso.alertar({ titulo: 'Não foi possível mostrar', mensagem: mensagemDeErro(e), tipo: 'erro' });
    } finally {
      this.s.revelando = false;
    }
  }

  /** Executa uma ação, avisa o erro (o 422 do bloqueio com o texto de cada garantia) e relê. */
  private async agir(rotulo: string, titulo: string, fn: () => Promise<unknown>) {
    if (this.s.ocupado) return;
    this.s.ocupado = rotulo;
    try {
      await fn();
    } catch (e) {
      const erro = e as Error & { codigo?: string; detalhes?: string[] };
      const mensagem = erro.codigo === 'MOVIMENTO_BLOQUEADO' ? textoDoBloqueio(erro) : mensagemDeErro(e);
      await urbiVerso.alertar({ titulo, mensagem, tipo: 'erro' });
    } finally {
      this.s.ocupado = null;
      await this.carregar();
      this.aoMudarLista();
    }
  }

  // --- Comandos (spec 11.1 P15) -------------------------------------------------------------------

  async pedirSugestao() {
    const v = await urbiVerso.formulario({
      titulo: 'Pedir sugestão ao Negociador',
      mensagem: 'Ele prepara o próximo movimento dentro do mandato. Cole o que o cliente disse, se houver.',
      campos: [{ nome: 'mensagem_cliente', tipo: 'texto_longo', rotulo: 'O que o cliente disse (opcional)', placeholder: '"1,40 está acima do que posso. Consigo 1,32?"' }],
      rotuloConfirmar: 'Pedir sugestão',
    });
    if (!v) return;
    await this.agir('sugestao', 'Não foi possível pedir a sugestão', async () => {
      const r = await enviar('POST', `/negociacoes/${this.id}/sugestao`, { mensagem_cliente: v.mensagem_cliente || null, canal: 'portal' });
      if (r?.enviada) urbiVerso.notificar('O Negociador respondeu pelo portal, dentro do mandato.', 'sucesso');
      else if (r?.passagem) {
        const motivos = (r.motivos_passagem ?? []).map((m: Linha) => `• ${m.descricao}`).join('\n');
        await urbiVerso.alertar({ titulo: 'A negociação passou a você', mensagem: `O Negociador não age sozinho aqui.${motivos ? `\n${motivos}` : ''}`, tipo: 'alerta' });
      }
    });
  }

  /** A sugestão pendente pode sair como está? (`null` = pode; senão, o motivo da trava.) */
  trava() {
    return travaDaSugestao(this.s.n?.sugestao, this.s.n?.propostas);
  }

  /**
   * Fazer agora (D-107), depois de gravada a rodada: abre o wa.me no celular do corretor. Sem link (cliente
   * sem telefone) ou com o pop-up barrado, mostra o texto pronto e o link para ele copiar: nunca diz "o
   * WhatsApp que abriu" sem ter aberto. `noopener` não vai em `window.open` (com ele, a volta é sempre
   * `null`); a aba aberta perde o `opener` logo depois.
   */
  private async entregarFazerAgora(r: Linha | null) {
    const aba = r?.link ? window.open(String(r.link), '_blank') : null;
    if (aba) {
      aba.opener = null;
      urbiVerso.notificar('Rodada gravada. Envie pelo WhatsApp que abriu.', 'sucesso');
      return;
    }
    const partes = [r?.texto ? String(r.texto) : '', r?.link ? `Link do WhatsApp do cliente:\n${r.link}` : 'O WhatsApp do cliente não abriu: envie o texto pelo seu celular.'];
    await urbiVerso.alertar({ titulo: 'Rodada gravada: copie e envie', mensagem: partes.filter(Boolean).join('\n\n'), tipo: 'info' });
  }

  /** Enviar (portal) ou Fazer agora (wa.me no celular do corretor, D-107): a sugestão como está. */
  async enviarSugestao(canal: 'portal' | 'wa_me') {
    const sug = this.s.n?.sugestao;
    if (!sug || this.trava()) return;
    await this.agir(canal === 'wa_me' ? 'fazer_agora' : 'enviar', 'Esta contraproposta não saiu', async () => {
      const r = await enviar('POST', `/negociacoes/${this.id}/decisao`, { acao: 'aprovar', execucao_id: sug.execucao_id, canal });
      if (canal === 'wa_me') await this.entregarFazerAgora(r);
      else urbiVerso.notificar('Enviada pelo portal do cliente.', 'sucesso');
    });
  }

  /** Editar: o corretor muda valor, condições ou texto. O backend revalida as 7 garantias (422 se furar). */
  async editarSugestao() {
    const sug = this.s.n?.sugestao;
    if (!sug) return;
    // Sugestão sem contraproposta (só mensagem): o valor é opcional; vazio, sai só a mensagem.
    const temContraproposta = sug.resposta?.movimento === 'contraproposta';
    const cp = sug.resposta?.contraproposta ?? {};
    const v = await urbiVerso.formulario({
      titulo: 'Editar a contraproposta',
      mensagem: 'O valor passa pelas mesmas regras do mandato: nunca abaixo do recuo, dentro do passo e das rodadas.',
      campos: [
        { nome: 'valor', tipo: 'texto', rotulo: temContraproposta ? 'Valor (R$)' : 'Valor (R$, opcional)', valor: reaisDoCampo(cp.valor_c), obrigatorio: temContraproposta },
        { nome: 'condicoes', tipo: 'texto_longo', rotulo: 'Condições', valor: cp.condicoes ?? '' },
        { nome: 'concessao', tipo: 'texto', rotulo: 'Concessão (do mandato)', valor: cp.concessao ?? '' },
        { nome: 'contrapartida', tipo: 'texto', rotulo: 'Contrapartida', valor: cp.contrapartida ?? '' },
        { nome: 'mensagem', tipo: 'texto_longo', rotulo: 'Mensagem ao cliente', valor: sug.resposta?.mensagem ?? '' },
        { nome: 'canal', tipo: 'selecao', rotulo: 'Enviar por', valor: 'portal', opcoes: [{ valor: 'portal', rotulo: 'Portal do cliente' }, { valor: 'wa_me', rotulo: 'Fazer agora (WhatsApp do seu celular)' }] },
      ],
      rotuloConfirmar: 'Enviar',
    });
    if (!v) return;
    const semValor = !temContraproposta && !String(v.valor ?? '').trim();
    const valor_c = semValor ? null : centavosDeReais(v.valor);
    if (!semValor && !valor_c) {
      await urbiVerso.alertar({ titulo: 'Valor inválido', mensagem: 'Escreva o valor em reais, por exemplo 1.380.000.', tipo: 'erro' });
      return;
    }
    await this.agir('editar', 'Esta contraproposta não saiu', async () => {
      const r = await enviar('POST', `/negociacoes/${this.id}/decisao`, {
        acao: 'editar',
        execucao_id: sug.execucao_id,
        canal: v.canal,
        ...(valor_c
          ? { contraproposta: { valor_c, condicoes: v.condicoes || null, concessao: v.concessao || null, contrapartida: v.contrapartida || null, validade_horas: cp.validade_horas ?? 48 } }
          : {}),
        mensagem: v.mensagem || null,
      });
      if (v.canal === 'wa_me') await this.entregarFazerAgora(r);
      else urbiVerso.notificar(valor_c ? 'Contraproposta enviada.' : 'Mensagem enviada.', 'sucesso');
    });
  }

  async descartarSugestao() {
    const sug = this.s.n?.sugestao;
    if (!sug) return;
    await this.agir('descartar', 'Não foi possível descartar', () => enviar('POST', `/negociacoes/${this.id}/decisao`, { acao: 'descartar', execucao_id: sug.execucao_id }));
  }

  /** O aceite final é só do corretor (D-98), com confirmação: o acordo vai ao proprietário. */
  async aceitar(proposta: Linha) {
    const ok = await urbiVerso.confirmar({
      titulo: `Aceitar a oferta de ${reais(proposta.valor_c)}?`,
      mensagem: 'O acordo vai ao proprietário e a negociação fica aguardando a decisão dele. O fechamento você registra depois, em Encerrar.',
      rotuloConfirmar: 'Aceitar e passar ao proprietário',
    });
    if (!ok) return;
    await this.agir('aceitar', 'Não foi possível aceitar', () => enviar('POST', `/negociacoes/${this.id}/decisao`, { acao: 'aceitar_acordo', proposta_id: proposta.id }));
  }

  async conduzir(para: 'corretor' | 'ia') {
    await this.agir('conduzir', para === 'corretor' ? 'Não foi possível assumir' : 'Não foi possível devolver', () => enviar('POST', `/negociacoes/${this.id}/${para === 'corretor' ? 'assumir' : 'devolver'}`));
  }

  async registrar(direcao: 'comprador' | 'proprietario') {
    const v = await urbiVerso.formulario({
      titulo: direcao === 'comprador' ? 'Registrar oferta do cliente' : 'Registrar resposta do proprietário',
      mensagem: direcao === 'comprador' ? 'A oferta que o cliente fez fora do portal (ligação, visita, mensagem). Abre uma rodada nova.' : 'O valor que o proprietário aceita ou propõe. Fica só no registro: o cliente não vê.',
      campos: [
        { nome: 'valor', tipo: 'texto', rotulo: 'Valor (R$)', obrigatorio: true, placeholder: '1.320.000' },
        { nome: 'condicoes', tipo: 'texto_longo', rotulo: 'Condições (opcional)' },
      ],
      rotuloConfirmar: 'Registrar',
    });
    if (!v) return;
    const valor_c = centavosDeReais(v.valor);
    if (!valor_c) {
      await urbiVerso.alertar({ titulo: 'Valor inválido', mensagem: 'Escreva o valor em reais, por exemplo 1.320.000.', tipo: 'erro' });
      return;
    }
    await this.agir('registrar', 'Não foi possível registrar', () => enviar('POST', `/negociacoes/${this.id}/propostas`, { direcao, valor_c, condicoes: v.condicoes || null }));
  }

  async encerrar(como: 'ganha' | 'perdida') {
    const v =
      como === 'ganha'
        ? await urbiVerso.formulario({ titulo: 'Encerrar como ganha', campos: [{ nome: 'valor', tipo: 'texto', rotulo: 'Valor final (R$)', obrigatorio: true }], rotuloConfirmar: 'Encerrar' })
        : await urbiVerso.formulario({ titulo: 'Encerrar como perdida', campos: [{ nome: 'motivo', tipo: 'selecao', rotulo: 'Motivo', obrigatorio: true, opcoes: opcoes(ROTULO_MOTIVO_PERDA) }], rotuloConfirmar: 'Encerrar' });
    if (!v) return;
    const corpo = como === 'ganha' ? { estado: 'ganha', valor_final_c: centavosDeReais(v.valor) } : { estado: 'perdida', motivo_perda: v.motivo };
    if (como === 'ganha' && !corpo.valor_final_c) {
      await urbiVerso.alertar({ titulo: 'Valor inválido', mensagem: 'Escreva o valor em reais, por exemplo 1.380.000.', tipo: 'erro' });
      return;
    }
    await this.agir('encerrar', 'Não foi possível encerrar', () => enviar('PATCH', `/negociacoes/${this.id}`, corpo));
  }

  // --- Leitura ------------------------------------------------------------------------------------

  /** A última oferta do comprador que ainda se aceita (não aceita, recusada, substituída nem vencida). */
  ofertaAceitavel(): Linha | null {
    const n = this.s.n;
    if (!n || n.estado === 'aguardando_proprietario' || n.estado === 'ganha' || n.estado === 'perdida') return null;
    const ultima = [...(n.propostas ?? [])].reverse().find((p: Linha) => p.direcao === 'comprador');
    if (!ultima || ['aceita', 'recusada', 'substituida', 'expirada'].includes(ultima.estado)) return null;
    if (ultima.validade_ate && new Date(ultima.validade_ate).getTime() < Date.now()) return null;
    return ultima;
  }

  private valorSigiloso(campo: 'recuo_c' | 'alvo_c'): string {
    const s = this.s.sigilo;
    return s ? reais(Number(s[campo])) : MASCARA;
  }

  private botaoMostrar() {
    const rotulo = this.s.sigilo ? 'Ocultar recuo, alvo e BATNA' : 'Mostrar recuo, alvo e BATNA';
    return html`<urbi-botao pequeno variante="fantasma" icone=${this.s.sigilo ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'} ariaLabel=${rotulo} title=${rotulo}
      ?carregando=${this.s.revelando} @click=${() => void this.mostrarSigilo()}></urbi-botao>`;
  }

  // --- Centro (P15 e M8) ----------------------------------------------------------------------------

  renderCentro(): TemplateResult {
    const { n, falha } = this.s;
    if (!n) return falha ? estadoDaFalha(falha, () => void this.carregar()) : estadoTela('carregando');
    const encerradaN = n.estado === 'ganha' || n.estado === 'perdida';
    const m = n.mandato as Linha | null;
    const estado = ROTULO_ESTADO_NEGOCIACAO[n.estado as keyof typeof ROTULO_ESTADO_NEGOCIACAO];
    const vencido = m && String(m.validade) < new Date().toLocaleDateString('sv-SE');
    const titulo = [n.contato?.nome ?? 'Cliente', n.imovel?.titulo ?? n.imovel?.codigo].filter(Boolean).join(' · ');
    const conduz = encerradaN
      ? nothing
      : n.conduzida_por === 'ia'
        ? html`<urbi-botao pequeno variante="secundario" icone="fa-solid fa-hand" ?carregando=${this.s.ocupado === 'conduzir'} @click=${() => void this.conduzir('corretor')}>Assumir</urbi-botao>`
        : html`<urbi-botao pequeno variante="secundario" icone="fa-solid fa-wand-magic-sparkles" ?carregando=${this.s.ocupado === 'conduzir'} @click=${() => void this.conduzir('ia')}>Devolver ao Negociador</urbi-botao>`;
    const falhaAviso = falha ? estadoTela('erro', { mensagem: 'Não foi possível atualizar a negociação.', aoTentar: () => void this.carregar() }) : nothing;
    return html`<urbi-stack>
      ${falhaAviso}
      <urbi-linha justificar="entre" quebrar>
        <urbi-stack>
          <urbi-prosa papel="titulo">${titulo}</urbi-prosa>
          <urbi-prosa papel="fraco">${n.codigo}${n.imovel?.bairro ? ` · ${n.imovel.bairro}` : ''}</urbi-prosa>
        </urbi-stack>
        ${conduz}
      </urbi-linha>
      <urbi-linha quebrar>
        <urbi-badge cor="info">${rotuloRodada(n.rodadas, m?.rodadas_max)}</urbi-badge>
        <urbi-badge cor="variante_3">${quemConduz(n.conduzida_por, m?.autonomia)}</urbi-badge>
        ${m
          ? html`<urbi-badge cor=${vencido ? 'erro' : 'sucesso'}>${vencido ? `Mandato vencido em ${data(m.validade + 'T12:00:00')}` : `Mandato válido até ${data(m.validade + 'T12:00:00')}`}</urbi-badge>`
          : html`<urbi-badge cor="alerta">Sem mandato</urbi-badge>`}
        ${estado ? html`<urbi-badge cor=${estado.cor}>${estado.rotulo}</urbi-badge>` : nothing}
      </urbi-linha>
      ${this.faixa()}
      ${this.escada()}
      ${this.ultimaFala()}
      ${this.cartaoSugestao()}
      ${encerradaN ? nothing : this.acoesDoCentro()}
    </urbi-stack>`;
  }

  /**
   * Faixa da negociação (exceção nomeada: lacuna 11.9, pedido 13). Os cinco valores em `urbi-kpi`; o recuo
   * e o alvo mascarados até "mostrar"; a ZOPA estimada (do recuo ao teto) em texto, pelo `zopa.existe`
   * que a rota já devolve sem as pontas.
   */
  private faixa() {
    const n = this.s.n!;
    const m = n.mandato as Linha | null;
    const ultima = [...(n.propostas ?? [])].reverse().find((p: Linha) => p.direcao === 'comprador');
    const teto = n.teto_estimado_comprador_c ? Number(n.teto_estimado_comprador_c) : null;
    const existe = n.zopa?.existe;
    const zopaTexto =
      !m ? 'Sem mandato: defina os valores para ver a faixa.' : existe === true ? `ZOPA estimada: do seu recuo até o teto estimado do comprador (${curto(teto)}).` : existe === false ? 'Sem ZOPA estimada: o teto estimado do comprador fica abaixo do seu recuo.' : 'Teto do comprador ainda não estimado: a ZOPA aparece quando o Negociador estimar.';
    return html`<urbi-card titulo="Faixa da negociação" icone="fa-solid fa-ruler-horizontal">
      <span slot="acoes">${m ? this.botaoMostrar() : nothing}</span>
      <urbi-grid min="140px">
        <urbi-kpi rotulo="Última oferta" formato="texto" .valor=${ultima ? curto(ultima.valor_c) : '—'}></urbi-kpi>
        <urbi-kpi rotulo="Recuo" formato="texto" .valor=${m ? this.valorSigiloso('recuo_c') : '—'}></urbi-kpi>
        <urbi-kpi rotulo="Teto estimado" formato="texto" .valor=${teto ? curto(teto) : '—'}></urbi-kpi>
        <urbi-kpi rotulo="Alvo" formato="texto" .valor=${m ? this.valorSigiloso('alvo_c') : '—'}></urbi-kpi>
        <urbi-kpi rotulo="Pedido" formato="texto" .valor=${m ? curto(m.preco_pedido_c) : curto(n.imovel?.preco_c)}></urbi-kpi>
      </urbi-grid>
      <urbi-prosa papel=${existe === false ? 'alerta' : existe === true ? 'sucesso' : 'dica'}>${zopaTexto}</urbi-prosa>
      ${m ? html`<urbi-prosa papel="fraco">Recuo e alvo são sigilosos: só você vê, e só ao clicar em mostrar.</urbi-prosa>` : nothing}
    </urbi-card>`;
  }

  /** Última fala do cliente: o que ele disse na última sugestão pedida ou a última oferta com as condições. */
  private ultimaFala() {
    const n = this.s.n!;
    const ultima = [...(n.propostas ?? [])].reverse().find((p: Linha) => p.direcao === 'comprador');
    const fala = n.sugestao?.mensagem_cliente;
    if (!ultima && !fala) return nothing;
    const objecoes = (n.objecoes ?? []).filter((o: Linha) => !o.tratada).slice(-2);
    return html`<urbi-card titulo=${ultima ? `Última oferta ${reais(ultima.valor_c)}` : 'Última fala do cliente'} icone="fa-solid fa-comment">
      ${fala ? html`<urbi-prosa>“${fala}”</urbi-prosa>` : nothing}
      ${ultima?.condicoes ? html`<urbi-prosa papel="secundario">${ultima.condicoes}</urbi-prosa>` : nothing}
      ${objecoes.length ? html`<urbi-linha quebrar>${objecoes.map((o: Linha) => html`<urbi-badge cor="alerta">Objeção: ${ROTULO_OBJECAO[o.categoria] ?? o.categoria}</urbi-badge>`)}</urbi-linha>` : nothing}
    </urbi-card>`;
  }

  /** Cartão "Negociador sugere · rodada n" (pergunta antes / só sugere): Enviar · Fazer agora · Editar · Descartar. */
  private cartaoSugestao() {
    const n = this.s.n!;
    const sug = n.sugestao as Linha | null;
    if (!sug || n.estado === 'ganha' || n.estado === 'perdida') return nothing;
    const r = sug.resposta ?? {};
    const cp = r.movimento === 'contraproposta' ? r.contraproposta : null;
    const validacoes = linhaDeValidacoes(sug.verificacoes);
    const tudoOk = (sug.verificacoes ?? []).every((v: Linha) => v.ok);
    const acordo = n.estado === 'aguardando_proprietario';
    const trava = this.trava();
    const ocupado = !!this.s.ocupado;
    return html`<urbi-card titulo=${`Negociador sugere · rodada ${Math.max(1, Number(n.rodadas) || 1)}`} icone="fa-solid fa-wand-magic-sparkles">
      ${cp?.valor_c
        ? html`<urbi-prosa papel="secao">${reais(cp.valor_c)}${cp.concessao ? ` · concede ${cp.concessao}` : ''}${cp.contrapartida ? ` ↔ ${cp.contrapartida}` : ''}</urbi-prosa>`
        : nothing}
      ${r.mensagem ? html`<urbi-prosa pre>${r.mensagem}</urbi-prosa>` : nothing}
      ${validacoes ? html`<urbi-prosa papel=${tudoOk ? 'sucesso' : 'alerta'}>${validacoes}</urbi-prosa>` : nothing}
      ${acordo
        ? html`<urbi-prosa papel="dica">O acordo está com o proprietário: esta sugestão não sai mais. Descarte para limpar.</urbi-prosa>
            <urbi-linha><urbi-botao pequeno variante="texto" @click=${() => void this.descartarSugestao()}>Descartar</urbi-botao></urbi-linha>`
        : html`${trava ? html`<urbi-prosa papel="alerta">${TEXTO_TRAVA_SUGESTAO[trava]}</urbi-prosa>` : nothing}
          <urbi-linha quebrar>
            ${trava === 'anterior'
              ? html`<urbi-botao pequeno icone="fa-solid fa-wand-magic-sparkles" ?desabilitado=${this.s.ia === false || !n.mandato} ?carregando=${this.s.ocupado === 'sugestao'} @click=${() => void this.pedirSugestao()}>Pedir sugestão</urbi-botao>`
              : nothing}
            <urbi-botao pequeno icone="fa-solid fa-paper-plane" ?desabilitado=${!!trava} ?carregando=${this.s.ocupado === 'enviar'} @click=${() => void this.enviarSugestao('portal')}>Enviar</urbi-botao>
            <urbi-botao pequeno variante="secundario" icone="fa-brands fa-whatsapp" ?desabilitado=${!!trava || ocupado} ?carregando=${this.s.ocupado === 'fazer_agora'} @click=${() => void this.enviarSugestao('wa_me')}>Fazer agora</urbi-botao>
            <urbi-botao pequeno variante="secundario" icone="fa-solid fa-pen" ?carregando=${this.s.ocupado === 'editar'} @click=${() => void this.editarSugestao()}>Editar</urbi-botao>
            <urbi-botao pequeno variante="texto" @click=${() => void this.descartarSugestao()}>Descartar</urbi-botao>
          </urbi-linha>`}
    </urbi-card>`;
  }

  /** Escada de propostas (`urbi-tabela`): rodada, quem, valor, condições, concessão, contrapartida, canal, quando. */
  private escada() {
    const propostas = (this.s.n!.propostas ?? []) as Linha[];
    const colunas = [
      { id: 'rodada', label: 'Rodada', largura: '72px', valor: (p: Linha) => String(p.rodada) },
      { id: 'quem', label: 'Quem', valor: (p: Linha) => ROTULO_AUTOR[p.autor_tipo] ?? ROTULO_DIRECAO[p.direcao] ?? p.direcao },
      { id: 'valor', label: 'Valor', alinhamento: 'direita' as const, valor: (p: Linha) => reais(p.valor_c) },
      { id: 'condicoes', label: 'Condições', valor: (p: Linha) => p.condicoes ?? '—', colapsarMobile: true },
      { id: 'concessao', label: 'Concessão', valor: (p: Linha) => p.concessao ?? '—' },
      { id: 'contrapartida', label: 'Contrapartida', valor: (p: Linha) => p.contrapartida ?? '—' },
      { id: 'canal', label: 'Canal', valor: (p: Linha) => ROTULO_CANAL[p.canal] ?? p.canal },
      { id: 'quando', label: 'Quando', valor: (p: Linha) => dataHora(p.criado_em) },
    ];
    return html`<urbi-card titulo="Escada de propostas" icone="fa-solid fa-stairs">
      <urbi-tabela responsivo="multiline" .colunas=${colunas} .linhas=${propostas} mensagem-vazio="Nenhuma proposta ainda. Registre a oferta do cliente."></urbi-tabela>
    </urbi-card>`;
  }

  /** Registrar oferta é a ação principal; o aceite (separado, com confirmação) e o resto vão no "Mais". */
  private acoesDoCentro() {
    const oferta = this.ofertaAceitavel();
    return html`<urbi-linha justificar="entre" quebrar>
      ${acoesComMais({ rotulo: 'Registrar oferta do cliente', icone: 'fa-solid fa-hand-holding-dollar', aoEscolher: () => void this.registrar('comprador') }, [
        { rotulo: 'Registrar resposta do proprietário', icone: 'fa-solid fa-house-user', aoEscolher: () => void this.registrar('proprietario') },
        { rotulo: 'Encerrar como ganha', icone: 'fa-solid fa-trophy', aoEscolher: () => void this.encerrar('ganha') },
        { rotulo: 'Encerrar como perdida', icone: 'fa-solid fa-xmark', perigo: true, aoEscolher: () => void this.encerrar('perdida') },
      ])}
      ${oferta
        ? html`<urbi-botao variante="sucesso" icone="fa-solid fa-handshake" ?carregando=${this.s.ocupado === 'aceitar'} @click=${() => void this.aceitar(oferta)}>Aceitar oferta de ${curto(oferta.valor_c)}</urbi-botao>`
        : nothing}
    </urbi-linha>`;
  }

  // --- Direita: mandato, leitura do comprador e próximo movimento ------------------------------------

  renderContexto(): TemplateResult {
    const { n } = this.s;
    if (!n) return html`<urbi-prosa papel="dica">O mandato, a leitura do comprador e o próximo movimento aparecem aqui.</urbi-prosa>`;
    return html`<urbi-stack>${this.cartaoMandato()}${this.cartaoLeitura()}${this.cartaoProximo()}
      ${this.s.mandatoAberto
        ? html`<pc-mandato .negociacaoId=${this.id} cliente=${n.contato?.nome ?? ''} .precoAnuncio_c=${n.imovel?.preco_c ?? null} .imovelId=${n.imovel?.id ?? null}
            conduzidaPor=${n.conduzida_por} .aoFechar=${(salvo: boolean) => this.fecharMandato(salvo)}></pc-mandato>`
        : nothing}</urbi-stack>`;
  }

  private fecharMandato(salvo: boolean) {
    this.s.mandatoAberto = false;
    if (!salvo) return;
    // O que estava revelado era a versão anterior: some com o mandato novo.
    this.s.sigilo = null;
    void this.carregar();
    this.aoMudarLista();
  }

  private cartaoMandato() {
    const n = this.s.n!;
    const m = n.mandato as Linha | null;
    const encerradaN = n.estado === 'ganha' || n.estado === 'perdida';
    const editar = encerradaN
      ? nothing
      : html`<urbi-linha><urbi-botao pequeno variante="secundario" icone="fa-solid fa-pen" @click=${() => (this.s.mandatoAberto = true)}>${m ? 'Editar mandato' : 'Definir mandato'}</urbi-botao></urbi-linha>`;
    if (!m) {
      return html`<urbi-card titulo="Mandato" icone="fa-solid fa-file-contract">
        <urbi-prosa papel="dica">Sem mandato, o Negociador não age: defina o pedido, o alvo, o recuo e as concessões.</urbi-prosa>
        ${editar}
      </urbi-card>`;
    }
    const s = this.s.sigilo;
    const linha = (rotulo: string, valor: unknown) => html`<urbi-linha justificar="entre"><urbi-prosa papel="secundario" inline>${rotulo}</urbi-prosa><urbi-prosa inline>${valor}</urbi-prosa></urbi-linha>`;
    return html`<urbi-card titulo="Mandato" icone="fa-solid fa-file-contract">
      <span slot="acoes">${this.botaoMostrar()}</span>
      ${linha('Pedido', reais(m.preco_pedido_c))}
      ${linha('Alvo', s ? reais(s.alvo_c) : MASCARA)}
      ${linha('Recuo', s ? reais(s.recuo_c) : MASCARA)}
      ${linha('BATNA do vendedor', s ? (s.batna_vendedor ?? '—') : MASCARA)}
      ${(m.concessoes ?? []).length
        ? html`<urbi-prosa papel="secao">Concessões</urbi-prosa>
            ${(m.concessoes as Linha[]).map((c) => html`<urbi-prosa papel="secundario">${c.item}${c.limite ? ` (até ${c.limite})` : ''} ↔ ${c.contrapartida}</urbi-prosa>`)}`
        : html`<urbi-prosa papel="fraco">Sem concessões no mandato.</urbi-prosa>`}
      ${linha('Passo máximo', `${Math.round(Number(m.passo_max_pct) * 100)}% do que resta`)}
      ${linha('Rodadas', String(m.rodadas_max))}
      ${linha('Validade', data(m.validade + 'T12:00:00'))}
      ${linha('Autonomia', ROTULO_AUTONOMIA[m.autonomia as keyof typeof ROTULO_AUTONOMIA] ?? m.autonomia)}
      ${editar}
    </urbi-card>`;
  }

  private cartaoLeitura() {
    const n = this.s.n!;
    const objecoes = (n.objecoes ?? []) as Linha[];
    const interesses: string[] = n.sugestao?.resposta?.interesses_identificados ?? [];
    const teto = n.teto_estimado_comprador_c ? Number(n.teto_estimado_comprador_c) : null;
    const nada = !objecoes.length && !interesses.length && !teto && !n.batna_estimada_comprador;
    return html`<urbi-card titulo="Leitura do comprador" icone="fa-solid fa-binoculars">
      ${nada ? html`<urbi-prosa papel="dica">Ainda sem leitura. O Negociador anota objeções, interesses e o teto estimado a cada sugestão.</urbi-prosa>` : nothing}
      ${objecoes.length || interesses.length
        ? html`<urbi-linha quebrar>
            ${[...new Set(objecoes.map((o) => o.categoria))].map((c) => html`<urbi-badge cor="alerta">Objeção: ${ROTULO_OBJECAO[c] ?? c}</urbi-badge>`)}
            ${interesses.map((i) => html`<urbi-badge cor="info" quebra-linha>${i}</urbi-badge>`)}
          </urbi-linha>`
        : nothing}
      ${teto ? html`<urbi-prosa>Teto estimado ~${curto(teto)}${n.fonte_estimativa ? ` · ${n.fonte_estimativa}` : ''}</urbi-prosa>` : nothing}
      ${n.batna_estimada_comprador ? html`<urbi-prosa papel="secundario">Alternativa do comprador: ${n.batna_estimada_comprador}</urbi-prosa>` : nothing}
    </urbi-card>`;
  }

  private cartaoProximo() {
    const n = this.s.n!;
    if (n.estado === 'ganha' || n.estado === 'perdida') return nothing;
    const sug = n.sugestao as Linha | null;
    const cp = sug?.resposta?.movimento === 'contraproposta' ? sug.resposta.contraproposta : null;
    const oferta = this.ofertaAceitavel();
    const semIa = this.s.ia === false;
    const trava = this.trava();
    const pedir = html`<urbi-botao pequeno icone="fa-solid fa-wand-magic-sparkles" ?desabilitado=${semIa || !n.mandato || n.estado === 'aguardando_proprietario'} ?carregando=${this.s.ocupado === 'sugestao'}
      @click=${() => void this.pedirSugestao()}>Pedir sugestão</urbi-botao>`;
    return html`<urbi-card titulo="Próximo movimento (IA)" icone="fa-solid fa-lightbulb">
      ${cp?.valor_c
        ? html`<urbi-prosa>${reais(cp.valor_c)}${cp.concessao ? ` + ${cp.concessao}` : ''}${cp.contrapartida ? ` ↔ ${cp.contrapartida}` : ''}</urbi-prosa>`
        : sug
          ? html`<urbi-prosa papel="secundario">${sug.resposta?.resumo_rodada ?? 'O Negociador preparou uma resposta sem contraproposta.'}</urbi-prosa>`
          : html`<urbi-prosa papel="dica">${semIa ? `${DICA_IA_INDISPONIVEL}: a negociação segue com você.` : n.mandato ? 'Peça ao Negociador o próximo movimento dentro do mandato.' : 'Defina o mandato para o Negociador sugerir.'}</urbi-prosa>`}
      ${sug && trava && n.estado !== 'aguardando_proprietario' ? html`<urbi-prosa papel="alerta">${TEXTO_TRAVA_SUGESTAO[trava]}</urbi-prosa>` : nothing}
      <urbi-linha quebrar>
        ${sug && n.estado !== 'aguardando_proprietario' && trava !== 'anterior'
          ? html`<urbi-botao pequeno icone="fa-solid fa-check" ?desabilitado=${!!trava} @click=${() => void this.enviarSugestao('portal')}>Usar sugestão</urbi-botao>`
          : pedir}
        ${oferta ? html`<urbi-botao pequeno variante="secundario" icone="fa-solid fa-house-user" @click=${() => void this.aceitar(oferta)}>Passar ao proprietário</urbi-botao>` : nothing}
      </urbi-linha>
    </urbi-card>`;
  }
}

/** A negociação aberta: uma por vez, da conta ativa (como a ficha do cliente). */
let aberta: { conta: number | null; neg: NegociacaoAberta } | null = null;

export function negociacaoDe(id: number, aoMudarLista: () => void = () => {}): NegociacaoAberta {
  const conta = contaAtiva();
  if (!aberta || aberta.conta !== conta || aberta.neg.id !== id || !aberta.neg.emUso) aberta = { conta, neg: new NegociacaoAberta(id, aoMudarLista) };
  return aberta.neg;
}

abstract class ColunaDaNegociacao extends LitElement {
  @property({ type: Number }) negociacaoId = 0;
  @property({ attribute: false }) aoMudarLista: () => void = () => {};
  protected neg: NegociacaoAberta | null = null;
  private soltar?: () => void;

  connectedCallback() {
    super.connectedCallback();
    this.neg = negociacaoDe(this.negociacaoId, () => this.aoMudarLista());
    this.soltar = this.neg.ouvir(() => this.requestUpdate());
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.soltar?.();
  }
}

@customElement('pc-negociacao-foco')
export class PcNegociacaoFoco extends ColunaDaNegociacao {
  connectedCallback() {
    super.connectedCallback();
    this.neg!.entrar();
  }

  render() {
    return this.neg?.renderCentro() ?? nothing;
  }
}

@customElement('pc-negociacao-contexto')
export class PcNegociacaoContexto extends ColunaDaNegociacao {
  render() {
    return this.neg?.renderContexto() ?? nothing;
  }
}

// ---------------------------------------------------------------------------------------------------
// Aba Negociação da ficha do cliente (P04): o resumo de cada negociação e o caminho para a P15.

@customElement('pc-negociacoes-do-cliente')
export class PcNegociacoesDoCliente extends LitElement {
  @property({ type: Number }) contatoId = 0;
  @property() nome = '';
  @state() private itens: Linha[] | null = null;
  @state() private falha: unknown = null;

  connectedCallback() {
    super.connectedCallback();
    void this.carregar();
  }

  private async carregar() {
    this.falha = null;
    try {
      this.itens = (await chamarApi(`/negociacoes?contato_id=${this.contatoId}&por_pagina=100`)).dados ?? [];
    } catch (e) {
      this.falha = e;
    }
  }

  private async nova() {
    const nid = await novaProposta({ id: this.contatoId, nome: this.nome });
    if (nid) irParaComQuery(enderecoDaNegociacao(nid));
  }

  render() {
    const itens = this.itens;
    return html`<urbi-card titulo="Negociação" icone="fa-solid fa-scale-balanced">
      <span slot="acoes"><urbi-botao pequeno variante="fantasma" icone="fa-solid fa-plus" ariaLabel="Nova proposta" title="Nova proposta" @click=${() => void this.nova()}></urbi-botao></span>
      ${this.falha
        ? estadoTela('erro', { aoTentar: () => void this.carregar() })
        : itens === null
          ? estadoTela('carregando')
          : itens.length
            ? html`<urbi-lista separador .itens=${itens} .render_item=${(n: Linha) => {
                const estado = ROTULO_ESTADO_NEGOCIACAO[n.estado as keyof typeof ROTULO_ESTADO_NEGOCIACAO];
                const dif = diferencaDoPedido(n.ultima_oferta_c, n.preco_pedido_c);
                return html`<urbi-linha justificar="entre" quebrar>
                  <urbi-stack>
                    <urbi-prosa>${[n.imovel_codigo, n.imovel_titulo].filter(Boolean).join(' · ') || n.codigo}</urbi-prosa>
                    <urbi-linha quebrar>
                      ${estado ? html`<urbi-badge cor=${estado.cor}>${estado.rotulo}</urbi-badge>` : nothing}
                      <urbi-prosa papel="fraco" inline>${rotuloRodada(n.rodadas, null)} · ${n.ultima_oferta_c ? `${curto(n.ultima_oferta_c)}${dif ? ` (${dif})` : ''}` : 'sem oferta'} · ${quemConduz(n.conduzida_por)}</urbi-prosa>
                    </urbi-linha>
                  </urbi-stack>
                  <urbi-botao pequeno variante="secundario" href=${hrefDaNegociacao(n.id)}>Abrir</urbi-botao>
                </urbi-linha>`;
              }}></urbi-lista>`
            : html`<urbi-prosa papel="dica">Nenhuma negociação. Quando o cliente fizer uma oferta, registre em Nova proposta (+).</urbi-prosa>`}
    </urbi-card>`;
  }
}
