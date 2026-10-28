import { LitElement, html, nothing, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { UrbiVersoAPI } from '@urbiverso/sdk';
import { linkWhatsapp } from '../../comum/pagina';
import {
  abaDoEndereco,
  abasDoPortal,
  centavosDoValor,
  propostaAceitavel,
  type NegociacaoPublica,
  type PropostaPublica,
  type SituacaoNegociacao,
  chipDeVisita,
  destinoDoProximoPasso,
  estadoDoErro,
  imoveisDoPortal,
  proximaVisita,
  recadosDasSelecoes,
  iniciais,
  reacaoDada,
  type AbaPortal,
} from '../../comum/portal-cliente';
import { linkComoChegar, linkRoteiro, lugarNoMapa, quantoFalta, roteiroPorDia, type VisitaDoPortal } from '../../comum/roteiro';
import { ROTULO_TIPO_IMOVEL } from '../apoio';
import { estiloPublico } from './estilo';
import { iconesImovel } from './icones';
import { css } from 'lit';

declare const urbiVerso: UrbiVersoAPI;

// Seleção (`/portal_corretor/s?t=<token>`) e Portal do Cliente (`/portal_corretor/c?t=<token>`),
// bloco 5b, no modelo Compass One desde o bloco 9 e no formato dos mockups M4 e M5 desde o B9:
// topo "Meu atendimento" com o próximo passo e abas Conversa · Imóveis · Agenda · Arquivos, e Propostas
// (D5, M5b) quando há negociação: ver as rodadas, aceitar a condição do vendedor ou fazer nova oferta.
// Página pública: lê a vitrine pela rota anônima e manda reações e pedidos ao webhook.

type Linha = Record<string, any>;
const reais = (c: number | null | undefined) => (c ? (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) : 'Preço sob consulta');
const local = (i: Linha) => [i.bairro, i.cidade].filter(Boolean).join(', ');
const nomeImovel = (i: Linha) => i.titulo ?? ROTULO_TIPO_IMOVEL[i.tipo] ?? i.tipo ?? i.codigo;
const REACOES = [
  { valor: 'gostei', rotulo: '♥ Gostei' },
  { valor: 'nao_gostei', rotulo: '✕ Não gostei' },
  { valor: 'quero_visitar', rotulo: 'Quero visitar' },
];
const diaHora = (q: string) => new Date(q).toLocaleString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' });
const hora = (q: string) => new Date(q).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const diaCurto = (q: string) => new Date(q).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
const token = () => new URLSearchParams(window.location.search).get('t') ?? '';
const cor = (c: unknown) => (typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c) ? c : null);
const SITUACAO_TEXTO: Record<SituacaoNegociacao, string> = {
  sua_vez: 'Sua vez de responder',
  com_o_corretor: 'Com o corretor',
  com_o_proprietario: 'Aguardando a decisão do proprietário',
  fechada: 'Negócio fechado',
  encerrada: 'Encerrada',
  pausada: 'Pausada',
};
const ESTADO_PROPOSTA: Partial<Record<PropostaPublica['estado'], string>> = {
  aceita: 'aceita',
  recusada: 'recusada',
  substituida: 'substituída',
  expirada: 'expirada',
};
const primeiroNome = (nome: string | null | undefined) => String(nome ?? '').trim().split(/\s+/)[0] || 'o corretor';

async function postar(url: string, corpo: unknown): Promise<{ ok: boolean; mensagem?: string }> {
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
    if (r.ok) return { ok: true };
    const d = await r.json().catch(() => ({}));
    return { ok: false, mensagem: d.mensagem || (r.status === 404 ? 'Este link expirou. Peça um novo ao corretor.' : 'Não foi possível enviar agora.') };
  } catch {
    return { ok: false, mensagem: 'Sem conexão. Tente de novo.' };
  }
}

const estiloSelecao = css`
  .topo .rotulo { margin: 0 0 12px; font-size: 0.85rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; opacity: 0.85; }
  .topo .quem { display: flex; align-items: center; gap: 14px; }
  .topo .foto-corretor { width: 64px; height: 64px; border-radius: 50%; object-fit: cover; flex: none; background: var(--foto-vazia); }
  .topo .iniciais { width: 64px; height: 64px; border-radius: 50%; flex: none; display: flex; align-items: center; justify-content: center; background: var(--papel); color: var(--acento); font-weight: 700; font-size: 1.3rem; }
  .topo .passo { margin-top: 16px; padding: 12px 14px; border-radius: 12px; background: var(--papel); color: var(--texto); display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .topo .passo small { display: block; color: var(--suave); font-size: 0.85rem; }
  .topo .passo strong { font-size: 1.15rem; }
  .topo .passo .botao { flex: none; min-height: 44px; padding: 8px 16px; }
  .abas { position: sticky; top: 0; z-index: 2; display: flex; gap: 0; overflow-x: auto; background: var(--papel); border-bottom: 1px solid var(--linha); padding: 0 8px; }
  .abas button { flex: none; min-height: 48px; padding: 10px 9px; border: 0; border-bottom: 3px solid transparent; background: none; color: var(--suave); font: inherit; font-weight: 600; cursor: pointer; }
  .abas button[aria-selected='true'] { color: var(--acento); border-bottom-color: var(--acento); }
  .abas .n { display: inline-block; min-width: 22px; margin-left: 6px; padding: 0 6px; border-radius: 999px; background: var(--fundo); color: var(--texto); font-size: 0.82rem; text-align: center; }
  .datas { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-top: 20px; }
  .datas div { background: var(--papel); border: 1px solid var(--linha); border-left: 4px solid var(--acento); border-radius: 12px; padding: 10px 14px; }
  .datas small { display: block; color: var(--suave); font-size: 0.85rem; }
  .datas strong { font-size: 1.05rem; }
  .reacoes { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-top: 14px; }
  .reacoes button { min-height: 48px; padding: 8px 6px; border-radius: 12px; border: 1px solid var(--borda-campo); background: var(--papel); color: var(--texto); font: inherit; font-weight: 600; cursor: pointer; }
  .reacoes button[aria-pressed='true'] { background: var(--acento); border-color: var(--acento); color: var(--papel); }
  .item { background: var(--papel); border: 1px solid var(--linha); border-radius: 16px; overflow: hidden; margin-bottom: 20px; }
  .item .corpo { padding: 14px 16px 16px; }
  .item .preco { font-size: 1.45rem; }
  .item .galeria { border-radius: 0; gap: 0; }
  .item .galeria img { border-radius: 0; flex-basis: 100%; }
  .item .lugar { font-weight: 600; }
  .item .cabeca { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; }
  .chip { display: inline-block; padding: 2px 10px; border-radius: 999px; background: var(--ok-fundo); color: var(--ok-texto); font-size: 0.85rem; font-weight: 600; }
  .sem-foto { aspect-ratio: 4 / 3; background: var(--foto-vazia); }
  .outros { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
  .outros button { width: 100%; display: grid; grid-template-columns: 72px 1fr auto; gap: 12px; align-items: center; text-align: left; padding: 8px; border-radius: 12px; border: 1px solid var(--linha); background: var(--papel); color: var(--texto); font: inherit; cursor: pointer; }
  .outros img, .outros .miniatura { width: 72px; height: 56px; border-radius: 8px; object-fit: cover; background: var(--foto-vazia); }
  .outros strong { display: block; }
  .outros .reacao { font-size: 0.85rem; color: var(--suave); }
  .agenda li { list-style: none; background: var(--papel); border: 1px solid var(--linha); border-radius: 12px; padding: 12px 14px; margin-bottom: 10px; }
  .agenda { padding: 0; margin: 0; }
  .agenda li.parada { display: grid; grid-template-columns: 32px 1fr; column-gap: 12px; }
  .agenda li.parada > * { grid-column: 2; }
  .agenda li.parada .numero { grid-column: 1; grid-row: 1 / span 3; width: 32px; height: 32px; border-radius: 50%; background: var(--acento); color: var(--papel); font-weight: 700; display: flex; align-items: center; justify-content: center; }
  .dia-roteiro { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 4px 12px; margin: 18px 0 8px; }
  .dia-roteiro h3 { margin: 0; font-size: 1.05rem; }
  .datas small.falta { display: inline; margin-left: 6px; color: var(--acento); font-weight: 600; }
  .pendencias { padding: 0; margin: 0; }
  .pendencias li { list-style: none; display: flex; align-items: center; justify-content: space-between; gap: 12px; background: var(--papel); border: 1px solid var(--linha); border-radius: 12px; padding: 10px 14px; margin-bottom: 10px; }
  .jornada { list-style: none; margin: 0; padding: 0 0 0 22px; border-left: 2px solid var(--linha); }
  .jornada li { position: relative; padding: 0 0 18px; }
  .jornada li::before { content: ''; position: absolute; left: -29px; top: 6px; width: 12px; height: 12px; border-radius: 50%; background: var(--acento); border: 2px solid var(--fundo); }
  .jornada li.inicio::before { background: var(--papel); border-color: var(--acento); }
  .aviso-item { margin-top: 8px; font-size: 0.92rem; }
  .negociacao { background: var(--papel); border: 1px solid var(--linha); border-radius: 16px; padding: 14px 16px 16px; margin-bottom: 20px; }
  .negociacao h3 { margin: 0; font-size: 1.05rem; }
  .situacao { display: inline-block; margin-top: 6px; padding: 2px 10px; border-radius: 999px; background: var(--fundo); color: var(--texto); font-size: 0.85rem; font-weight: 600; }
  .situacao.sua_vez { background: var(--ok-fundo); color: var(--ok-texto); }
  .rodadas { list-style: none; margin: 14px 0 0; padding: 0 0 0 22px; border-left: 2px solid var(--linha); }
  .rodadas li { position: relative; padding: 0 0 14px; }
  .rodadas li::before { content: ''; position: absolute; left: -29px; top: 6px; width: 12px; height: 12px; border-radius: 50%; background: var(--papel); border: 2px solid var(--acento); }
  .rodadas li.vendedor::before { background: var(--acento); }
  .rodadas .valor { font-weight: 700; font-size: 1.1rem; }
  .confirmar { margin-top: 12px; padding: 12px 14px; border-radius: 12px; background: var(--fundo); }
  @media (min-width: 720px) {
    .item .galeria img { aspect-ratio: 16 / 10; }
    .reacoes { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  }
`;

/** Estado de envio por imóvel: um envio por vez, o comentário aberto e o aviso ao lado do próprio imóvel. */
export interface EstadoReacoes {
  enviando: Set<string>;
  avisos: Map<string, { ok: boolean; texto: string }>;
  comentando: string | null;
}

interface OpcoesItem {
  reagir: ((codigo: string, reacao: string) => void) | null;
  comentar: ((codigo: string, texto: string) => void) | null;
  abrirComentario: (codigo: string | null) => void;
  chip?: string | null;
}

/** Cartão de um imóvel, com galeria, os botões de reação e "Comentar" (M5). */
function itemSelecao(i: Linha, estado: EstadoReacoes, o: OpcoesItem): TemplateResult {
  const aviso = estado.avisos.get(i.codigo);
  const ocupado = estado.enviando.has(i.codigo);
  return html`<article class="item">
    ${i.fotos?.length
      ? html`<div class="galeria">${i.fotos.map((f: Linha, n: number) => html`<img src=${f.url} alt=${f.legenda ?? `Foto ${n + 1} de ${i.fotos.length}: ${nomeImovel(i)}`} loading="lazy" />`)}</div>`
      : html`<div class="sem-foto"></div>`}
    <div class="corpo">
      <div class="cabeca">
        <div class="preco">${reais(i.preco_c)}</div>
        ${o.chip ? html`<span class="chip">${o.chip}</span>` : nothing}
      </div>
      ${local(i) ? html`<div class="lugar">${local(i)}</div>` : nothing}
      <div class="suave">${nomeImovel(i)}${i.fotos?.length > 1 ? ` · ${i.fotos.length} fotos` : ''}</div>
      ${iconesImovel(i)}
      ${i.descricao ? html`<details><summary class="suave">Ver descrição</summary><p class="texto">${i.descricao}</p></details>` : nothing}
      ${o.reagir
        ? html`<div class="reacoes" role="group" aria-label=${`O que você achou de ${nomeImovel(i)}?`}>
            ${REACOES.map(
              (r) => html`<button type="button" aria-pressed=${i.reacao === r.valor ? 'true' : 'false'} ?disabled=${ocupado} @click=${() => o.reagir!(i.codigo, r.valor)}>${r.rotulo}</button>`,
            )}
            ${o.comentar
              ? html`<button type="button" aria-expanded=${estado.comentando === i.codigo ? 'true' : 'false'} ?disabled=${ocupado} @click=${() => o.abrirComentario(estado.comentando === i.codigo ? null : i.codigo)}>Comentar</button>`
              : nothing}
          </div>
          ${o.comentar && estado.comentando === i.codigo
            ? html`<form
                @submit=${(e: Event) => {
                  e.preventDefault();
                  const t = String(new FormData(e.target as HTMLFormElement).get('comentario') ?? '').trim();
                  if (t) o.comentar!(i.codigo, t);
                }}
              >
                <label>Seu comentário sobre este imóvel<textarea name="comentario" required maxlength="300"></textarea></label>
                <div><button class="botao" type="submit" ?disabled=${ocupado}>${ocupado ? 'Enviando…' : 'Enviar comentário'}</button></div>
              </form>`
            : nothing}
          ${aviso ? html`<div class="aviso aviso-item ${aviso.ok ? '' : 'erro'}" role=${aviso.ok ? 'status' : 'alert'}>${aviso.texto}</div>` : nothing}`
        : nothing}
    </div>
  </article>`;
}

/** Datas-chave: a próxima visita e até quando a seleção vale (a que vence primeiro). */
function datasChave(proximaVisita: string | null, valeAte: string | null): TemplateResult | typeof nothing {
  if (!proximaVisita && !valeAte) return nothing;
  return html`<div class="datas">
    ${proximaVisita ? html`<div><small>Próxima visita</small><strong>${diaHora(proximaVisita)}</strong><small class="falta">${quantoFalta(proximaVisita)}</small></div>` : nothing}
    ${valeAte ? html`<div><small>Seleção vale até</small><strong>${diaCurto(valeAte)}</strong></div>` : nothing}
  </div>`;
}

/** Topo do corretor: foto (ou iniciais), nome, CRECI só se existir (D-93), WhatsApp e o próximo passo. */
function topo(corretor: Linha | null, texto: string, extra: { rotulo?: string; proximoPasso?: string | null; ver?: () => void } = {}): TemplateResult {
  const zap = corretor ? linkWhatsapp(corretor.telefone, texto) : null;
  const nome = corretor?.nome ?? 'Seu corretor';
  return html`<header class="topo">
    <div class="conteudo">
      ${extra.rotulo ? html`<p class="rotulo">${extra.rotulo}</p>` : nothing}
      <div class="quem">
        ${corretor?.foto_url
          ? html`<img class="foto-corretor" src=${corretor.foto_url} alt=${`Foto de ${nome}`} />`
          : html`<span class="iniciais" aria-hidden="true">${iniciais(nome)}</span>`}
        <div>
          <h1>${nome}</h1>
          <p>Corretor de imóveis${corretor?.creci ? ` · CRECI ${corretor.creci}` : ''}</p>
        </div>
      </div>
      ${extra.proximoPasso
        ? html`<div class="passo">
            <div><small>Próximo passo</small><strong>${extra.proximoPasso}</strong></div>
            ${extra.ver ? html`<button class="botao" type="button" @click=${extra.ver}>Ver</button>` : nothing}
          </div>`
        : nothing}
      ${zap ? html`<div class="acoes"><a class="botao verde" href=${zap} target="_blank" rel="noopener">Falar no WhatsApp</a></div>` : nothing}
    </div>
  </header>`;
}

/**
 * Reação com resposta imediata na tela; um envio por imóvel de cada vez (os botões dele ficam
 * desligados até a resposta). Se o envio falha, volta ao que era e avisa ao lado do imóvel.
 */
async function enviarReacao(selecao: Linha, codigo: string, reacao: string, estado: EstadoReacoes, atualizar: () => void) {
  const item = selecao.itens.find((i: Linha) => i.codigo === codigo);
  if (!item || !selecao.url_reacao || estado.enviando.has(codigo)) return;
  const antes = item.reacao;
  item.reacao = reacao;
  estado.enviando.add(codigo);
  estado.avisos.delete(codigo);
  atualizar();
  const r = await postar(selecao.url_reacao, { imovel_codigo: codigo, reacao });
  estado.enviando.delete(codigo);
  if (!r.ok) {
    item.reacao = antes;
    estado.avisos.set(codigo, { ok: false, texto: r.mensagem ?? 'Não foi possível enviar.' });
  } else if (reacao === 'quero_visitar') {
    estado.avisos.set(codigo, { ok: true, texto: 'Pedido de visita enviado. O corretor vai combinar o horário com você.' });
  }
  atualizar();
}

/**
 * "Comentar" (M5): vai pelo mesmo `reacao_selecao`, junto com a reação já dada. Sem reação ainda,
 * no portal vira mensagem ao corretor (`acao_cliente`) citando o imóvel; na seleção avulsa, pede
 * antes o Gostei ou o Não gostei.
 */
async function enviarComentario(selecao: Linha, codigo: string, texto: string, urlAcoes: string | null, estado: EstadoReacoes, atualizar: () => void) {
  const item = selecao.itens.find((i: Linha) => i.codigo === codigo);
  if (!item || estado.enviando.has(codigo)) return;
  let r: { ok: boolean; mensagem?: string };
  estado.avisos.delete(codigo);
  if (item.reacao && selecao.url_reacao) {
    estado.enviando.add(codigo);
    atualizar();
    r = await postar(selecao.url_reacao, { imovel_codigo: codigo, reacao: item.reacao, comentario: texto });
  } else if (urlAcoes) {
    estado.enviando.add(codigo);
    atualizar();
    r = await postar(urlAcoes, { tipo: 'mensagem', texto: `Sobre o imóvel ${codigo} (${nomeImovel(item)}): ${texto}` });
  } else {
    estado.avisos.set(codigo, { ok: false, texto: 'Diga antes se gostou ou não deste imóvel.' });
    atualizar();
    return;
  }
  estado.enviando.delete(codigo);
  if (r.ok) {
    estado.comentando = null;
    estado.avisos.set(codigo, { ok: true, texto: 'Comentário enviado ao corretor.' });
  } else estado.avisos.set(codigo, { ok: false, texto: r.mensagem ?? 'Não foi possível enviar.' });
  atualizar();
}

/** "Link expirado" (token revogado, vencido ou trocado) e "tente de novo" (rede). */
function telaDeErro(estado: 'expirado' | 'falha', oQue: string, tentar: () => void): TemplateResult {
  if (estado === 'expirado') {
    return html`<div class="centro" role="alert"><h2>Link expirado</h2><p class="suave">${oQue} não está mais disponível por este link. Peça um novo ao corretor que enviou.</p></div>`;
  }
  return html`<div class="centro"><h2>Não foi possível abrir agora</h2><p><button class="botao" @click=${tentar}>Tentar de novo</button></p></div>`;
}

@customElement('pc-selecao-publica')
export class PcSelecaoPublica extends LitElement {
  static styles = [estiloPublico, estiloSelecao];

  @state() private selecao: Linha | null = null;
  @state() private estado: 'carregando' | 'pronto' | 'expirado' | 'falha' = 'carregando';
  private reacoes: EstadoReacoes = { enviando: new Set(), avisos: new Map(), comentando: null };

  connectedCallback() {
    super.connectedCallback();
    void this.carregar();
  }

  private async carregar() {
    try {
      const r = await urbiVerso.api(`/pub/portal_corretor/vitrine/selecao?t=${encodeURIComponent(token())}`, { anonimo: true });
      this.selecao = r.selecao;
      const c = cor(r.selecao.corretor?.cor);
      if (c) this.style.setProperty('--acento', c);
      document.title = `${r.selecao.titulo} · ${r.selecao.corretor?.nome ?? 'Seu corretor'}`;
      this.estado = 'pronto';
    } catch (e) {
      this.estado = estadoDoErro(e);
    }
  }

  render() {
    if (this.estado === 'carregando') return html`<div class="centro suave">Carregando…</div>`;
    if (this.estado !== 'pronto') return telaDeErro(this.estado, 'Esta seleção', () => { this.estado = 'carregando'; void this.carregar(); });
    const s = this.selecao!;
    const atualizar = () => this.requestUpdate();
    return html`
      ${topo(s.corretor, `Olá! Vi a seleção "${s.titulo}".`)}
      <div class="conteudo">
        ${datasChave(null, s.expira_em ?? null)}
        <section>
          <h2>${s.titulo}</h2>
          ${s.mensagem ? html`<p class="texto">${s.mensagem}</p>` : nothing}
          <p class="suave">Diga o que achou de cada imóvel: o corretor recebe na hora.</p>
        </section>
        <section>
          ${s.itens.length
            ? s.itens.map((i: Linha) =>
                itemSelecao(i, this.reacoes, {
                  reagir: (codigo, reacao) => enviarReacao(s, codigo, reacao, this.reacoes, atualizar),
                  comentar: (codigo, texto) => enviarComentario(s, codigo, texto, null, this.reacoes, atualizar),
                  abrirComentario: (codigo) => { this.reacoes.comentando = codigo; atualizar(); },
                }),
              )
            : html`<p class="suave">Os imóveis desta seleção não estão mais anunciados. Fale com o corretor.</p>`}
        </section>
      </div>
    `;
  }
}

@customElement('pc-portal-cliente')
export class PcPortalCliente extends LitElement {
  static styles = [estiloPublico, estiloSelecao];

  @state() private portal: Linha | null = null;
  @state() private estado: 'carregando' | 'pronto' | 'expirado' | 'falha' = 'carregando';
  @state() private aba: AbaPortal = abaDoEndereco(window.location.hash);
  /** Imóvel em destaque na aba Imóveis; `null` é o primeiro da lista. */
  @state() private destaque: string | null = null;
  @state() private aviso: { ok: boolean; texto: string } | null = null;
  @state() private remarcando: number | null = null;
  @state() private enviando = false;
  @state() private marcando: number | null = null;
  /** Proposta do vendedor cujo aceite espera a confirmação (o toque duplo evita aceite por engano). */
  @state() private confirmandoAceite: number | null = null;
  /** Negociação com o formulário de nova oferta aberto. */
  @state() private ofertando: number | null = null;
  /** Onde mostrar o aviso: perto do formulário que enviou. */
  @state() private avisoEm: string | null = null;
  private reacoes: EstadoReacoes = { enviando: new Set(), avisos: new Map(), comentando: null };

  connectedCallback() {
    super.connectedCallback();
    void this.carregar();
  }

  private async carregar() {
    try {
      const r = await urbiVerso.api(`/pub/portal_corretor/vitrine/portal?t=${encodeURIComponent(token())}`, { anonimo: true });
      this.portal = r.portal;
      const c = cor(r.portal.corretor?.cor);
      if (c) this.style.setProperty('--acento', c);
      document.title = `Meu atendimento · ${r.portal.corretor?.nome ?? 'Seu corretor'}`;
      this.estado = 'pronto';
    } catch (e) {
      this.estado = estadoDoErro(e);
    }
  }

  /** Troca de aba e guarda no endereço (`#imoveis`), sem perder o token da busca. */
  private irPara(aba: AbaPortal) {
    this.aba = aba;
    try {
      history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${aba}`);
    } catch {
      // sem histórico (pré-visualização): só a aba muda
    }
    // No celular as abas rolam de lado: a escolhida fica à vista.
    void this.updateComplete.then(() => this.renderRoot.querySelector<HTMLElement>(`#guia-${aba}`)?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }));
  }

  updated(mudou: Map<string, unknown>) {
    // Aberto direto numa aba (`#propostas`): ela aparece à vista assim que as abas existem.
    if (mudou.has('estado') && this.estado === 'pronto' && this.aba !== 'conversa') {
      this.renderRoot.querySelector<HTMLElement>(`#guia-${this.aba}`)?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    }
  }

  /** Setas, Home e End trocam de aba, como pede o padrão de abas acessíveis. */
  private teclaNasAbas(e: KeyboardEvent, ids: AbaPortal[]) {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const i = ids.indexOf(this.aba);
    const prox = e.key === 'Home' ? ids[0] : e.key === 'End' ? ids[ids.length - 1] : ids[(i + (e.key === 'ArrowRight' ? 1 : ids.length - 1)) % ids.length];
    this.irPara(prox);
    void this.updateComplete.then(() => this.renderRoot.querySelector<HTMLButtonElement>(`#guia-${prox}`)?.focus());
  }

  /** O cliente marca uma pendência como feita: sai da lista na hora; se falhar, volta com o aviso. */
  private async feito(t: Linha) {
    if (this.marcando) return;
    this.marcando = t.ref;
    const r = await postar(this.portal!.url_acoes, { tipo: 'tarefa_feita', tarefa: t.ref });
    this.marcando = null;
    this.avisoEm = 'tarefas';
    if (r.ok) {
      this.portal = { ...this.portal, tarefas: this.portal!.tarefas.filter((x: Linha) => x.ref !== t.ref) };
      this.aviso = { ok: true, texto: 'Pronto! O corretor foi avisado.' };
    } else this.aviso = { ok: false, texto: r.mensagem ?? 'Não foi possível enviar.' };
  }

  private async acao(ev: Event, corpo: Record<string, unknown>) {
    ev.preventDefault();
    const form = ev.target as HTMLFormElement;
    const texto = String(new FormData(form).get('texto') ?? '').trim();
    if (corpo.tipo === 'mensagem' && !texto) return;
    this.enviando = true;
    const r = await postar(this.portal!.url_acoes, { ...corpo, ...(texto ? { texto } : {}) });
    this.enviando = false;
    this.avisoEm = corpo.tipo === 'remarcar' ? `visita-${corpo.visita}` : 'mensagem';
    this.aviso = r.ok ? { ok: true, texto: corpo.tipo === 'remarcar' ? 'Pedido enviado. O corretor vai propor outro horário.' : 'Mensagem enviada ao corretor.' } : { ok: false, texto: r.mensagem ?? 'Não foi possível enviar.' };
    if (r.ok) {
      form.reset();
      this.remarcando = null;
    }
  }

  /** Arquivo de calendário da visita (abre no calendário do celular). */
  private calendario(v: Linha): string {
    const inicio = new Date(v.quando);
    const fim = new Date(inicio.getTime() + 3600e3);
    const f = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const titulo = `Visita: ${v.imovel?.titulo ?? v.imovel?.codigo ?? 'imóvel'}`.replace(/[,;\n]/g, ' ');
    const lugar = [v.imovel?.endereco, v.imovel?.bairro, v.imovel?.cidade].filter(Boolean).join(' - ').replace(/[,;\n]/g, ' ');
    // Horários em UTC (sufixo Z): o calendário do celular converte para o fuso dele.
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Portal do Corretor//PT', 'BEGIN:VEVENT', `UID:visita-${v.ref}@portal-corretor`, `DTSTAMP:${f(new Date())}`, `DTSTART:${f(inicio)}`, `DTEND:${f(fim)}`, `SUMMARY:${titulo}`, lugar ? `LOCATION:${lugar}` : '', 'END:VEVENT', 'END:VCALENDAR'].filter(Boolean).join('\r\n') + '\r\n';
    return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
  }

  /** Uma visita do roteiro; com mais de uma no dia, ganha o número da parada. */
  private visita(v: Linha, numero: number | null) {
    const chegar = linkComoChegar(v.imovel);
    const lugar = lugarNoMapa(v.imovel);
    return html`<li class=${numero ? 'parada' : ''}>
      ${numero ? html`<span class="numero" aria-label=${`Parada ${numero}`}>${numero}</span>` : nothing}
      <strong>${numero ? hora(v.quando) : diaHora(v.quando)}</strong>
      <div>${v.imovel?.titulo ?? v.imovel?.codigo ?? 'Visita'}</div>
      <div class="suave">${[v.imovel?.endereco, v.imovel?.bairro, v.imovel?.cidade].filter(Boolean).join(' · ')}</div>
      <div class="acoes">
        ${chegar ? html`<a class="botao claro" href=${chegar} target="_blank" rel="noopener">${lugar?.exato ? 'Como chegar' : 'Ver o bairro no mapa'}</a>` : nothing}
        <a class="botao claro" href=${this.calendario(v)} download="visita.ics">Adicionar ao calendário</a>
        <button class="botao claro" type="button" @click=${() => (this.remarcando = this.remarcando === v.ref ? null : v.ref)}>Pedir para remarcar</button>
      </div>
      ${this.avisoEm === `visita-${v.ref}` && this.aviso ? html`<div class="aviso aviso-item ${this.aviso.ok ? '' : 'erro'}" role=${this.aviso.ok ? 'status' : 'alert'}>${this.aviso.texto}</div>` : nothing}
      ${this.remarcando === v.ref
        ? html`<form @submit=${(e: Event) => this.acao(e, { tipo: 'remarcar', visita: v.ref })}>
            <label>Qual horário fica melhor? (opcional)<textarea name="texto" maxlength="1000"></textarea></label>
            <div><button class="botao" type="submit" ?disabled=${this.enviando}>Enviar pedido</button></div>
          </form>`
        : nothing}
    </li>`;
  }

  /** Visitas por dia: um dia com várias vira roteiro numerado, com o trajeto todo no mapa. */
  private agenda(agenda: VisitaDoPortal[]) {
    return roteiroPorDia(agenda).map(({ dia, visitas }) => {
      const varias = visitas.length > 1;
      const mapa = varias ? linkRoteiro(visitas) : null;
      return html`${varias
          ? html`<div class="dia-roteiro">
              <h3>Roteiro de ${new Date(`${dia}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })} · ${visitas.length} visitas</h3>
              ${mapa ? html`<a href=${mapa} target="_blank" rel="noopener">Ver o roteiro no mapa</a>` : nothing}
            </div>`
          : nothing}
        <ul class="agenda">${visitas.map((v, i) => this.visita(v, varias ? i + 1 : null))}</ul>`;
    });
  }

  /** Linha do tempo vertical; portal publicado antes do bloco 9 (sem `eventos`) mostra o começo e as contagens. */
  private jornada(j: Linha) {
    const eventos: Linha[] = j.eventos ?? [
      ...(j.visitas_feitas ? [{ tipo: 'visita', quando: null, texto: `${j.visitas_feitas} visita${j.visitas_feitas > 1 ? 's' : ''} feita${j.visitas_feitas > 1 ? 's' : ''}` }] : []),
      ...(j.imoveis_recebidos ? [{ tipo: 'selecao', quando: null, texto: `${j.imoveis_recebidos} imóve${j.imoveis_recebidos > 1 ? 'is' : 'l'} recebido${j.imoveis_recebidos > 1 ? 's' : ''}` }] : []),
      { tipo: 'inicio', quando: `${j.desde}T12:00:00.000Z`, texto: 'Começamos a busca' },
    ];
    return html`<ol class="jornada">
      ${eventos.map(
        (e) => html`<li class=${e.tipo}>
          <div>${e.texto}</div>
          ${e.quando ? html`<div class="suave">${new Date(e.quando).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</div>` : nothing}
        </li>`,
      )}
    </ol>`;
  }

  /**
   * Conversa (M4): o histórico que o portal já tem (a jornada) e o campo "Escreva para <corretor>"
   * pelo `acao_cliente`. As respostas do corretor chegam pelo WhatsApp: o portal não guarda as
   * mensagens trocadas (D-73, sem texto do cliente na vitrine).
   */
  private abaConversa(p: Linha) {
    const nome = primeiroNome(p.corretor?.nome);
    const zap = p.corretor ? linkWhatsapp(p.corretor.telefone, 'Olá! Estou no meu portal e queria falar com você.') : null;
    const valeAte = (p.selecoes as Linha[]).map((s) => s.expira_em).filter(Boolean).sort()[0] ?? null;
    return html`
      ${datasChave(proximaVisita(p.agenda ?? []), valeAte)}
      ${p.jornada ? html`<section><h2>Histórico</h2>${this.jornada(p.jornada)}</section>` : nothing}
      <section>
        <h2>Escreva para ${nome}</h2>
        ${p.url_acoes
          ? html`<div class="caixa">
              <form @submit=${(e: Event) => this.acao(e, { tipo: 'mensagem' })}>
                <label>Mensagem para ${nome}<textarea name="texto" required maxlength="1000"></textarea></label>
                ${this.avisoEm === 'mensagem' && this.aviso ? html`<div class="aviso ${this.aviso.ok ? '' : 'erro'}" role=${this.aviso.ok ? 'status' : 'alert'}>${this.aviso.texto}</div>` : nothing}
                <div><button class="botao" type="submit" ?disabled=${this.enviando}>Enviar</button></div>
              </form>
            </div>
            <p class="suave">${nome} responde pelo WhatsApp.</p>`
          : nothing}
        ${zap ? html`<div class="acoes"><a class="botao verde" href=${zap} target="_blank" rel="noopener">Conversar no WhatsApp</a></div>` : nothing}
      </section>
    `;
  }

  /** Imóveis (M5): o destaque com galeria e reações, os outros com a reação dada e "O que falta de você". */
  private abaImoveis(p: Linha) {
    const lista = imoveisDoPortal(p.selecoes ?? []);
    const tarefas: Linha[] = p.tarefas ?? [];
    const atual = lista.find((x) => x.imovel.codigo === this.destaque) ?? lista[0];
    const atualizar = () => this.requestUpdate();
    const recados = recadosDasSelecoes(p.selecoes ?? []);
    return html`
      ${recados.length
        ? html`<section>
            <h2>${recados.length > 1 ? 'Suas seleções' : 'Sua seleção'}</h2>
            ${recados.map((r) => html`${r.titulo ? html`<h3>${r.titulo}</h3>` : nothing}${r.mensagem ? html`<p class="texto">${r.mensagem}</p>` : nothing}`)}
          </section>`
        : nothing}
      ${atual
        ? html`<section>
            <p class="suave">${primeiroNome(p.corretor?.nome)} escolheu para você${atual.selecao.titulo ? html` · da seleção <strong>${atual.selecao.titulo}</strong>` : nothing}${atual.imovel.fotos?.length > 1 ? ' · deslize as fotos' : ''}</p>
            ${itemSelecao(atual.imovel, this.reacoes, {
              reagir: (codigo, reacao) => enviarReacao(atual.selecao, codigo, reacao, this.reacoes, atualizar),
              comentar: (codigo, texto) => enviarComentario(atual.selecao, codigo, texto, p.url_acoes ?? null, this.reacoes, atualizar),
              abrirComentario: (codigo) => { this.reacoes.comentando = codigo; atualizar(); },
              chip: chipDeVisita(atual.imovel.codigo, p.agenda ?? []),
            })}
          </section>`
        : html`<section><p class="suave">Quando o corretor separar imóveis para você, eles aparecem aqui.</p></section>`}
      ${lista.length > 1
        ? html`<section>
            <h2>Outros imóveis</h2>
            <ul class="outros">
              ${lista
                .filter((x) => x !== atual)
                .map(
                  ({ imovel: i }) => html`<li>
                    <button type="button" @click=${() => { this.destaque = i.codigo; this.reacoes.comentando = null; }}>
                      ${i.fotos?.[0]?.url ? html`<img src=${i.fotos[0].url} alt="" loading="lazy" />` : html`<span class="miniatura"></span>`}
                      <span><strong>${nomeImovel(i)}</strong><span class="suave">${[i.bairro, reais(i.preco_c)].filter(Boolean).join(' · ')}</span></span>
                      <span class="reacao">${reacaoDada(i.reacao)}</span>
                    </button>
                  </li>`,
                )}
            </ul>
          </section>`
        : nothing}
      ${tarefas.length || this.avisoEm === 'tarefas'
        ? html`<section>
            <h2>O que falta de você</h2>
            ${tarefas.length
              ? html`<ul class="pendencias">
                  ${tarefas.map(
                    (t) => html`<li>
                      <span>${t.texto}</span>
                      <button class="botao" type="button" ?disabled=${this.marcando !== null} aria-label=${`Feito: ${t.texto}`} @click=${() => this.feito(t)}>${this.marcando === t.ref ? 'Enviando…' : 'Feito'}</button>
                    </li>`,
                  )}
                </ul>`
              : html`<p class="suave">Nada pendente agora.</p>`}
            ${this.avisoEm === 'tarefas' && this.aviso ? html`<div class="aviso aviso-item ${this.aviso.ok ? '' : 'erro'}" role=${this.aviso.ok ? 'status' : 'alert'}>${this.aviso.texto}</div>` : nothing}
          </section>`
        : nothing}
    `;
  }

  private abaAgenda(p: Linha) {
    return html`<section>
      <h2>Suas visitas</h2>
      ${p.agenda.length ? this.agenda(p.agenda) : html`<p class="suave">Nenhuma visita marcada.</p>`}
    </section>`;
  }

  /** Oferta ou aceite: vai ao webhook do portal; o corretor (ou o Negociador) responde por aqui. */
  private async proposta(negociacao: number, corpo: Record<string, unknown>, ok: string) {
    this.enviando = true;
    const r = await postar(this.portal!.url_acoes, { ...corpo, negociacao });
    this.enviando = false;
    this.avisoEm = `negociacao-${negociacao}`;
    this.aviso = r.ok ? { ok: true, texto: ok } : { ok: false, texto: r.mensagem ?? 'Não foi possível enviar.' };
    if (r.ok) {
      this.confirmandoAceite = null;
      this.ofertando = null;
      // A resposta entra no portal quando o corretor (ou o Negociador) a registra: relê em seguida.
      setTimeout(() => void this.carregar(), 2500);
    }
  }

  private ofertar(ev: Event, n: NegociacaoPublica) {
    ev.preventDefault();
    const valor = centavosDoValor(String(new FormData(ev.target as HTMLFormElement).get('valor') ?? ''));
    if (!valor) {
      this.avisoEm = `negociacao-${n.ref}`;
      this.aviso = { ok: false, texto: 'Escreva o valor em reais, por exemplo 1.380.000.' };
      return;
    }
    void this.proposta(n.ref, { tipo: 'proposta_nova', valor_c: valor }, `Oferta de ${reais(valor)} enviada. ${primeiroNome(this.portal!.corretor?.nome)} responde por aqui.`);
  }

  private rodada(p: PropostaPublica) {
    const quem = p.quem === 'voce' ? 'Sua oferta' : 'Proposta do vendedor';
    const extras = [p.condicoes, p.concessao ? `Inclui: ${p.concessao}` : null, p.contrapartida ? `Em troca de: ${p.contrapartida}` : null].filter(Boolean);
    return html`<li class=${p.quem}>
      <div class="suave">${quem}${p.quando ? ` · ${diaCurto(p.quando)}` : ''}${ESTADO_PROPOSTA[p.estado] ? ` · ${ESTADO_PROPOSTA[p.estado]}` : ''}</div>
      <div class="valor">${reais(p.valor_c)}</div>
      ${extras.length ? html`<div class="texto">${extras.join('\n')}</div>` : nothing}
      ${p.quem === 'vendedor' && p.validade_ate ? html`<div class="suave">Vale até ${diaHora(p.validade_ate)}</div>` : nothing}
    </li>`;
  }

  /** Propostas (M5b): cada negociação com as rodadas, o aceite da condição e a nova oferta. Nunca o mandato. */
  private abaPropostas(p: Linha) {
    const negociacoes: NegociacaoPublica[] = p.negociacoes ?? [];
    if (!negociacoes.length) return html`<section><p class="suave">Quando houver uma negociação, as propostas aparecem aqui.</p></section>`;
    return html`<section>
      <h2>Propostas</h2>
      <p class="suave">Aceitar uma condição não fecha o negócio: ${primeiroNome(p.corretor?.nome)} confirma com você e com o proprietário.</p>
      ${negociacoes.map((n) => {
        const aceitavel = propostaAceitavel(n);
        const nome = n.imovel ? (n.imovel.titulo ?? n.imovel.codigo ?? 'Imóvel') : 'Imóvel';
        return html`<article class="negociacao">
          <h3>${nome}</h3>
          ${n.imovel && (n.imovel.bairro || n.imovel.cidade) ? html`<div class="suave">${[n.imovel.bairro, n.imovel.cidade].filter(Boolean).join(', ')}</div>` : nothing}
          <span class="situacao ${n.situacao}">${SITUACAO_TEXTO[n.situacao]}</span>
          ${n.propostas.length ? html`<ol class="rodadas">${n.propostas.map((x) => this.rodada(x))}</ol>` : html`<p class="suave">Nenhuma proposta ainda.</p>`}
          ${n.pode_agir
            ? html`<div class="acoes">
                ${aceitavel ? html`<button class="botao" type="button" ?disabled=${this.enviando} @click=${() => (this.confirmandoAceite = aceitavel.ref)}>Aceitar condição</button>` : nothing}
                <button class="botao claro" type="button" ?disabled=${this.enviando} @click=${() => (this.ofertando = this.ofertando === n.ref ? null : n.ref)}>Nova oferta</button>
              </div>`
            : nothing}
          ${aceitavel && this.confirmandoAceite === aceitavel.ref
            ? html`<div class="confirmar" role="group" aria-label="Confirmar aceite">
                <p>Aceitar ${reais(aceitavel.valor_c)}? ${primeiroNome(p.corretor?.nome)} recebe o seu aceite e confirma com o proprietário.</p>
                <div class="acoes">
                  <button class="botao" type="button" ?disabled=${this.enviando} @click=${() => this.proposta(n.ref, { tipo: 'proposta_aceite', proposta: aceitavel.ref }, 'Aceite enviado. O corretor vai confirmar com você e com o proprietário.')}>Confirmar aceite</button>
                  <button class="botao claro" type="button" @click=${() => (this.confirmandoAceite = null)}>Cancelar</button>
                </div>
              </div>`
            : nothing}
          ${this.ofertando === n.ref
            ? html`<form @submit=${(e: Event) => this.ofertar(e, n)}>
                <label>Sua oferta (R$)<input name="valor" inputmode="decimal" autocomplete="off" required placeholder="1.380.000" /></label>
                <div><button class="botao" type="submit" ?disabled=${this.enviando}>${this.enviando ? 'Enviando…' : 'Enviar oferta'}</button></div>
              </form>`
            : nothing}
          ${this.avisoEm === `negociacao-${n.ref}` && this.aviso ? html`<div class="aviso aviso-item ${this.aviso.ok ? '' : 'erro'}" role=${this.aviso.ok ? 'status' : 'alert'}>${this.aviso.texto}</div>` : nothing}
        </article>`;
      })}
    </section>`;
  }

  /** Arquivos ainda não têm fonte no app (D-73): a aba diz onde os documentos chegam. */
  private abaArquivos(p: Linha) {
    return html`<section>
      <h2>Arquivos</h2>
      <p class="suave">Nenhum arquivo por aqui ainda. Por enquanto, ${primeiroNome(p.corretor?.nome)} envia documentos e contratos pelo WhatsApp.</p>
    </section>`;
  }

  render() {
    if (this.estado === 'carregando') return html`<div class="centro suave">Carregando…</div>`;
    if (this.estado !== 'pronto') return telaDeErro(this.estado, 'Seu portal', () => { this.estado = 'carregando'; void this.carregar(); });
    const p = this.portal!;
    const abas = abasDoPortal(p);
    const ids = abas.map((a) => a.id);
    return html`
      ${topo(p.corretor, 'Olá! Estou no meu portal e queria falar com você.', {
        rotulo: 'Meu atendimento',
        proximoPasso: p.proximo_passo ?? null,
        ver: () => this.irPara(destinoDoProximoPasso(p)),
      })}
      <nav class="abas" role="tablist" aria-label="Seu atendimento" @keydown=${(e: KeyboardEvent) => this.teclaNasAbas(e, ids)}>
        ${abas.map(
          (a) => html`<button type="button" role="tab" id=${`guia-${a.id}`} aria-controls="painel" aria-selected=${this.aba === a.id ? 'true' : 'false'} tabindex=${this.aba === a.id ? '0' : '-1'} @click=${() => this.irPara(a.id)}>
            ${a.rotulo}${a.n !== null ? html`<span class="n">${a.n}</span>` : nothing}
          </button>`,
        )}
      </nav>
      <div class="conteudo" id="painel" role="tabpanel" tabindex="0" aria-labelledby=${`guia-${this.aba}`}>
        ${this.aba === 'imoveis'
          ? this.abaImoveis(p)
          : this.aba === 'agenda'
            ? this.abaAgenda(p)
            : this.aba === 'propostas' && ids.includes('propostas')
              ? this.abaPropostas(p)
              : this.aba === 'arquivos'
                ? this.abaArquivos(p)
                : this.abaConversa(p)}
      </div>
    `;
  }
}
