import { LitElement, html, nothing, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { UrbiVersoAPI } from '@urbiverso/sdk';
import { linkWhatsapp } from '../../comum/pagina';
import { linkComoChegar, linkRoteiro, lugarNoMapa, quantoFalta, roteiroPorDia, type VisitaDoPortal } from '../../comum/roteiro';
import { ROTULO_TIPO_IMOVEL } from '../apoio';
import { estiloPublico } from './estilo';
import { iconesImovel } from './icones';
import { css } from 'lit';

declare const urbiVerso: UrbiVersoAPI;

// Seleção (`/portal_corretor/s?t=<token>`) e Portal do Cliente (`/portal_corretor/c?t=<token>`),
// bloco 5b, no modelo Compass One desde o bloco 9: uma página só, curada pelo corretor, com o
// próximo passo e as datas no topo, cartões de foto dominante, o que falta do cliente e a jornada.
// Página pública: lê a vitrine pela rota anônima e manda reações e pedidos ao webhook.

type Linha = Record<string, any>;
const reais = (c: number | null | undefined) => (c ? (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) : 'Preço sob consulta');
const local = (i: Linha) => [i.bairro, i.cidade].filter(Boolean).join(', ');
const REACOES = [
  { valor: 'gostei', rotulo: '♥ Gostei' },
  { valor: 'nao_gostei', rotulo: '✕ Não gostei' },
  { valor: 'quero_visitar', rotulo: 'Quero visitar' },
];
const diaHora = (q: string) => new Date(q).toLocaleString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' });
const hora = (q: string) => new Date(q).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const diaCurto = (q: string) => new Date(q).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
const token = () => new URLSearchParams(window.location.search).get('t') ?? '';
const naoExiste = (e: unknown) => (e as { status?: number }).status === 404 || (e as { codigo?: string }).codigo === 'NAO_ENCONTRADO';
const cor = (c: unknown) => (typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c) ? c : null);

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
  .topo .quem { display: flex; align-items: center; gap: 14px; }
  .topo .foto-corretor { width: 64px; height: 64px; border-radius: 50%; object-fit: cover; flex: none; background: var(--foto-vazia); }
  .topo .passo { margin-top: 16px; padding: 12px 14px; border-radius: 12px; background: var(--papel); color: var(--texto); }
  .topo .passo small { display: block; color: var(--suave); font-size: 0.85rem; }
  .topo .passo strong { font-size: 1.15rem; }
  .datas { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-top: 20px; }
  .datas div { background: var(--papel); border: 1px solid var(--linha); border-left: 4px solid var(--acento); border-radius: 12px; padding: 10px 14px; }
  .datas small { display: block; color: var(--suave); font-size: 0.85rem; }
  .datas strong { font-size: 1.05rem; }
  .reacoes { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-top: 14px; }
  .reacoes button { min-height: 52px; padding: 8px 6px; border-radius: 12px; border: 1px solid var(--borda-campo); background: var(--papel); color: var(--texto); font: inherit; font-weight: 600; cursor: pointer; }
  .reacoes button[aria-pressed='true'] { background: var(--acento); border-color: var(--acento); color: var(--papel); }
  .item { background: var(--papel); border: 1px solid var(--linha); border-radius: 16px; overflow: hidden; margin-bottom: 20px; }
  .item .corpo { padding: 14px 16px 16px; }
  .item .preco { font-size: 1.45rem; }
  .item .galeria { border-radius: 0; gap: 0; }
  .item .galeria img { border-radius: 0; flex-basis: 100%; }
  .item .lugar { font-weight: 600; }
  .sem-foto { aspect-ratio: 4 / 3; background: var(--foto-vazia); }
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
  @media (min-width: 720px) {
    .item .galeria img { aspect-ratio: 16 / 10; }
  }
`;

/** Estado de envio por imóvel: um envio por vez e o aviso ao lado do próprio imóvel. */
export interface EstadoReacoes {
  enviando: Set<string>;
  avisos: Map<string, { ok: boolean; texto: string }>;
}

/** Cartão de um imóvel da seleção, com galeria e os botões de reação. */
function itemSelecao(i: Linha, reagir: ((codigo: string, reacao: string) => void) | null, estado: EstadoReacoes): TemplateResult {
  const aviso = estado.avisos.get(i.codigo);
  return html`<article class="item">
    ${i.fotos?.length
      ? html`<div class="galeria">${i.fotos.map((f: Linha, n: number) => html`<img src=${f.url} alt=${f.legenda ?? `Foto ${n + 1} de ${i.titulo ?? i.codigo}`} loading="lazy" />`)}</div>`
      : html`<div class="sem-foto"></div>`}
    <div class="corpo">
      <div class="preco">${reais(i.preco_c)}</div>
      ${local(i) ? html`<div class="lugar">${local(i)}</div>` : nothing}
      <div class="suave">${i.titulo ?? ROTULO_TIPO_IMOVEL[i.tipo] ?? i.tipo}</div>
      ${iconesImovel(i)}
      ${i.descricao ? html`<details><summary class="suave">Ver descrição</summary><p class="texto">${i.descricao}</p></details>` : nothing}
      ${reagir
        ? html`<div class="reacoes" role="group" aria-label=${`O que você achou de ${i.titulo ?? i.codigo}?`}>
            ${REACOES.map(
              (r) => html`<button type="button" aria-pressed=${i.reacao === r.valor ? 'true' : 'false'} ?disabled=${estado.enviando.has(i.codigo)} @click=${() => reagir(i.codigo, r.valor)}>${r.rotulo}</button>`,
            )}
          </div>
          ${aviso ? html`<div class="aviso aviso-item ${aviso.ok ? '' : 'erro'}" role=${aviso.ok ? 'status' : 'alert'}>${aviso.texto}</div>` : nothing}`
        : nothing}
    </div>
  </article>`;
}

/** Datas-chave do topo: a próxima visita e até quando a seleção vale (a que vence primeiro). */
function datasChave(proximaVisita: string | null, valeAte: string | null): TemplateResult | typeof nothing {
  if (!proximaVisita && !valeAte) return nothing;
  return html`<div class="datas">
    ${proximaVisita ? html`<div><small>Próxima visita</small><strong>${diaHora(proximaVisita)}</strong><small class="falta">${quantoFalta(proximaVisita)}</small></div>` : nothing}
    ${valeAte ? html`<div><small>Seleção vale até</small><strong>${diaCurto(valeAte)}</strong></div>` : nothing}
  </div>`;
}

function topo(corretor: Linha | null, texto: string, proximoPasso: string | null = null): TemplateResult {
  const zap = corretor ? linkWhatsapp(corretor.telefone, texto) : null;
  return html`<header class="topo">
    <div class="conteudo">
      <div class="quem">
        ${corretor?.foto_url ? html`<img class="foto-corretor" src=${corretor.foto_url} alt=${`Foto de ${corretor.nome ?? 'seu corretor'}`} />` : nothing}
        <div>
          <h1>${corretor?.nome ?? 'Seu corretor'}</h1>
          <p>Corretor de imóveis${corretor?.creci ? ` · CRECI ${corretor.creci}` : ''}</p>
        </div>
      </div>
      ${proximoPasso ? html`<div class="passo"><small>Próximo passo</small><strong>${proximoPasso}</strong></div>` : nothing}
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

@customElement('pc-selecao-publica')
export class PcSelecaoPublica extends LitElement {
  static styles = [estiloPublico, estiloSelecao];

  @state() private selecao: Linha | null = null;
  @state() private estado: 'carregando' | 'pronto' | 'indisponivel' | 'falha' = 'carregando';
  private reacoes: EstadoReacoes = { enviando: new Set(), avisos: new Map() };

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
      this.estado = naoExiste(e) ? 'indisponivel' : 'falha';
    }
  }

  render() {
    if (this.estado === 'carregando') return html`<div class="centro suave">Carregando…</div>`;
    if (this.estado === 'indisponivel') return html`<div class="centro"><h2>Seleção expirada ou indisponível</h2><p class="suave">Peça uma nova ao corretor que enviou o link.</p></div>`;
    if (this.estado === 'falha') return html`<div class="centro"><h2>Não foi possível abrir agora</h2><p><button class="botao" @click=${() => { this.estado = 'carregando'; void this.carregar(); }}>Tentar de novo</button></p></div>`;
    const s = this.selecao!;
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
            ? s.itens.map((i: Linha) => itemSelecao(i, (codigo, reacao) => enviarReacao(s, codigo, reacao, this.reacoes, () => this.requestUpdate()), this.reacoes))
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
  @state() private estado: 'carregando' | 'pronto' | 'indisponivel' | 'falha' = 'carregando';
  @state() private aviso: { ok: boolean; texto: string } | null = null;
  @state() private remarcando: number | null = null;
  @state() private enviando = false;
  /** Onde mostrar o aviso: perto do formulário que enviou. */
  @state() private avisoEm: string | null = null;
  private reacoes: EstadoReacoes = { enviando: new Set(), avisos: new Map() };

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
      document.title = `Seu portal · ${r.portal.corretor?.nome ?? 'Seu corretor'}`;
      this.estado = 'pronto';
    } catch (e) {
      this.estado = naoExiste(e) ? 'indisponivel' : 'falha';
    }
  }

  @state() private marcando: number | null = null;

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

  render() {
    if (this.estado === 'carregando') return html`<div class="centro suave">Carregando…</div>`;
    if (this.estado === 'indisponivel') return html`<div class="centro"><h2>Portal indisponível</h2><p class="suave">O link pode ter sido trocado. Peça um novo ao seu corretor.</p></div>`;
    if (this.estado === 'falha') return html`<div class="centro"><h2>Não foi possível abrir agora</h2><p><button class="botao" @click=${() => { this.estado = 'carregando'; void this.carregar(); }}>Tentar de novo</button></p></div>`;
    const p = this.portal!;
    const j = p.jornada;
    const tarefas: Linha[] = p.tarefas ?? [];
    const valeAte = (p.selecoes as Linha[]).map((s) => s.expira_em).filter(Boolean).sort()[0] ?? null;
    return html`
      ${topo(p.corretor, 'Olá! Estou no meu portal e queria falar com você.', p.proximo_passo ?? null)}
      <div class="conteudo">
        ${datasChave((p.agenda as Linha[]).find((v) => v.quando && Date.parse(v.quando) >= Date.now())?.quando ?? null, valeAte)}
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
        <section>
          <h2>Suas visitas</h2>
          ${p.agenda.length ? this.agenda(p.agenda) : html`<p class="suave">Nenhuma visita marcada.</p>`}
        </section>
        <section>
          <h2>Imóveis para você</h2>
          ${p.selecoes.length
            ? p.selecoes.map(
                (s: Linha) => html`<h3>${s.titulo}</h3>
                  ${s.mensagem ? html`<p class="texto">${s.mensagem}</p>` : nothing}
                  ${s.itens.map((i: Linha) => itemSelecao(i, (codigo, reacao) => enviarReacao(s, codigo, reacao, this.reacoes, () => this.requestUpdate()), this.reacoes))}`,
              )
            : html`<p class="suave">Quando o corretor separar imóveis para você, eles aparecem aqui.</p>`}
        </section>
        <section>
          <h2>Fale com o corretor</h2>
          <div class="caixa">
            <form @submit=${(e: Event) => this.acao(e, { tipo: 'mensagem' })}>
              <label>Mensagem<textarea name="texto" required maxlength="1000"></textarea></label>
              ${this.avisoEm === 'mensagem' && this.aviso ? html`<div class="aviso ${this.aviso.ok ? '' : 'erro'}" role=${this.aviso.ok ? 'status' : 'alert'}>${this.aviso.texto}</div>` : nothing}
              <div><button class="botao" type="submit" ?disabled=${this.enviando}>Enviar</button></div>
            </form>
          </div>
        </section>
        ${j ? html`<section><h2>Sua jornada</h2>${this.jornada(j)}</section>` : nothing}
      </div>
    `;
  }
}
