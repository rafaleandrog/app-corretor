import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { UrbiVersoAPI } from '@urbiverso/sdk';
import type { Bloco } from '../../comum/pagina';
import { linkWhatsapp } from '../../comum/pagina';
import { iniciais } from '../../comum/portal-cliente';
import { enderecoEmTexto } from '../../comum/imoveis';
import { ROTULO_TIPO_IMOVEL } from '../apoio';
import { estiloPublico } from './estilo';
import { iconesImovel } from './icones';

declare const urbiVerso: UrbiVersoAPI;

interface PaginaPublica {
  endereco: string;
  nome: string;
  creci: string | null;
  telefone: string | null;
  cor: string;
  /** Foto do corretor (Ajustes › Conta e marca), já como URL assinada; página publicada antes do B9 não tem. */
  foto_url?: string | null;
  blocos: Bloco[];
  url_formulario: string | null;
}
interface Cartao {
  codigo: string;
  titulo: string | null;
  tipo: string;
  situacao: string;
  preco_c: number | null;
  bairro: string | null;
  cidade: string | null;
  quartos: number | null;
  area_util_m2: number | null;
  vagas: number | null;
  capa: string | null;
}

const reais = (c: number | null | undefined) => (c ? (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) : 'Preço sob consulta');
const local = (i: { bairro?: string | null; cidade?: string | null }) => [i.bairro, i.cidade].filter(Boolean).join(', ');

const estiloPagina = css`
  /* Capa compacta (M6, #181): avatar de 64 px, nome, a linha do CRECI e o WhatsApp, centrados (~213 px). */
  header.topo { padding: 24px 18px; text-align: center; }
  header.topo .conteudo { padding: 0; }
  header.topo h1 { font-size: 20px; line-height: 27px; margin: 8px 0 0; }
  header.topo p.linha { margin: 0; font-size: 13px; line-height: 18px; opacity: 0.9; }
  header.topo .foto-corretor { width: 64px; height: 64px; border-radius: 50%; object-fit: cover; display: block; margin: 0 auto; background: var(--foto-vazia); border: 2px solid var(--papel); }
  header.topo .iniciais { width: 64px; height: 64px; border-radius: 50%; margin: 0 auto; display: flex; align-items: center; justify-content: center; background: var(--papel); color: var(--acento); font-weight: 700; font-size: 23px; }
  header.topo .acoes { justify-content: center; margin-top: 14px; }
  header.topo .acoes .botao { min-height: 34px; padding: 0 20px; border-radius: 12px; font-weight: 700; }
  .conteudo > section:first-child { margin-top: 16px; }
  section { margin-top: 20px; }
  h2 { font-size: 16px; line-height: 22px; margin: 0 0 12px; }
  .grade { grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; align-items: stretch; }
  /* Cartão do imóvel (M6): foto de 130 px, título, a linha de dados e, embaixo, preço à esquerda e
     "Quero saber mais" à direita. Coluna flexível: o botão fica alinhado entre cartões no computador. */
  .cartao { display: flex; flex-direction: column; }
  .cartao .ver { display: block; color: inherit; text-decoration: none; }
  .cartao img, .cartao .sem-foto { aspect-ratio: auto; height: 130px; }
  .cartao .corpo { padding: 10px 12px 0; }
  .cartao .titulo { font-size: 16px; line-height: 22px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .cartao .dados { font-size: 13px; line-height: 18px; color: var(--suave); }
  .cartao .rodape { margin-top: auto; display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 6px 12px 10px; }
  .cartao .rodape .preco { font-size: 16px; }
  .cartao .rodape .botao { min-height: 34px; padding: 0 12px; border-radius: 10px; font-size: 13px; font-weight: 700; white-space: nowrap; }
  :host([previa]) { min-height: 0; }
  .destacado { outline: 3px solid var(--acento); outline-offset: 6px; border-radius: 8px; }
  @media (min-width: 720px) {
    header.topo h1 { font-size: 24px; line-height: 32px; }
  }
`;
/**
 * Prévia no editor da Página (P09): os dados já montados pela rota autenticada `GET /pagina/previa` e o
 * bloco selecionado, que ganha contorno. Na prévia nada sai da tela: links não navegam e o formulário
 * não envia. Sem `previa`, o componente é a página pública de sempre.
 */
export interface PreviaPagina {
  pagina: PaginaPublica;
  imoveis: Cartao[];
  destacar?: Bloco['tipo'] | null;
}

// Minha Página (`/portal_corretor/p?c=<endereço>`) e ficha pública do imóvel (`…&i=<código>`), no
// formato do mockup M6 desde o B9: capa com foto, nome, CRECI só se houver (D-93) e WhatsApp;
// imóveis em destaque com "Quero saber mais"; a cor da marca do corretor (D-85).
// Página pública: lê só a vitrine (rota GET anônima) e envia o formulário ao webhook da conta.
@customElement('pc-pagina-publica')
export class PcPaginaPublica extends LitElement {
  static styles = [estiloPublico, estiloPagina];

  @state() private pagina: PaginaPublica | null = null;
  @state() private imoveis: Cartao[] = [];
  @state() private imovel: Record<string, any> | null = null;
  @state() private estado: 'carregando' | 'pronto' | 'nao_encontrada' | 'falha' = 'carregando';
  @state() private enviando = false;
  @state() private resposta: { ok: boolean; texto: string } | null = null;
  @state() private foto: string | null = null;

  /** Modo prévia (editor da Página); sem ele, a página pública lida pela query. */
  @property({ attribute: false }) previa: PreviaPagina | null = null;

  private readonly params = new URLSearchParams(window.location.search);

  connectedCallback() {
    super.connectedCallback();
    if (this.previa) this.aplicarPrevia();
    else void this.carregar();
  }

  willUpdate(mudou: Map<string, unknown>) {
    if (mudou.has('previa') && this.previa) this.aplicarPrevia();
  }

  private aplicarPrevia() {
    const p = this.previa!;
    this.pagina = p.pagina;
    this.imoveis = p.imoveis;
    this.imovel = null;
    this.toggleAttribute('previa', true);
    if (/^#[0-9a-fA-F]{6}$/.test(p.pagina.cor)) this.style.setProperty('--acento', p.pagina.cor);
    else this.style.removeProperty('--acento');
    this.estado = 'pronto';
  }

  /** Classe do bloco selecionado na prévia. */
  private destaque(...tipos: Bloco['tipo'][]) {
    return this.previa?.destacar && tipos.includes(this.previa.destacar) ? 'destacado' : '';
  }

  /** Na prévia, nenhum link sai da tela do editor. */
  private segurarLinks(e: Event) {
    if (e.composedPath().some((n) => n instanceof HTMLAnchorElement)) e.preventDefault();
  }

  private async carregar() {
    const c = this.params.get('c') ?? '';
    const i = this.params.get('i');
    if (!c) {
      this.estado = 'nao_encontrada';
      return;
    }
    try {
      if (i) {
        const r = await urbiVerso.api(`/pub/portal_corretor/vitrine/imovel?c=${encodeURIComponent(c)}&i=${encodeURIComponent(i)}`, { anonimo: true });
        this.pagina = r.pagina;
        this.imovel = r.imovel;
        document.title = `${r.imovel.titulo ?? ROTULO_TIPO_IMOVEL[r.imovel.tipo] ?? 'Imóvel'} · ${r.pagina.nome}`;
      } else {
        const r = await urbiVerso.api(`/pub/portal_corretor/vitrine/pagina?c=${encodeURIComponent(c)}`, { anonimo: true });
        this.pagina = r.pagina;
        this.imoveis = r.imoveis;
        document.title = `${r.pagina.nome} · Corretor de imóveis`;
      }
      // A cor é dado da página: só hexadecimal entra no estilo.
      if (/^#[0-9a-fA-F]{6}$/.test(this.pagina!.cor)) this.style.setProperty('--acento', this.pagina!.cor);
      this.estado = 'pronto';
    } catch (e) {
      this.estado = (e as { status?: number; codigo?: string }).status === 404 || (e as { codigo?: string }).codigo === 'NAO_ENCONTRADO' ? 'nao_encontrada' : 'falha';
    }
  }

  private origemFoco: HTMLElement | null = null;

  private async abrirFoto(url: string, origem: HTMLElement) {
    this.origemFoco = origem;
    this.foto = url;
    await this.updateComplete;
    this.renderRoot.querySelector<HTMLButtonElement>('.tela-cheia button')?.focus();
  }

  private fecharFoto() {
    this.foto = null;
    // O foco volta para a foto que abriu a tela cheia.
    this.origemFoco?.focus();
  }

  private bloco(tipo: Bloco['tipo']) {
    return this.pagina?.blocos.find((b) => b.tipo === tipo);
  }

  private urlImovel(codigo: string) {
    return `/portal_corretor/p?c=${encodeURIComponent(this.pagina!.endereco)}&i=${encodeURIComponent(codigo)}`;
  }

  private async enviar(ev: Event) {
    ev.preventDefault();
    if (this.previa) return;
    const form = ev.target as HTMLFormElement;
    const campos = new FormData(form);
    const corpo: Record<string, unknown> = { consentimento: campos.get('consentimento') === 'sim' };
    // Campo vazio não vai: o webhook valida o tipo e recusa `null`.
    for (const k of ['nome', 'telefone', 'email', 'mensagem', 'site']) {
      const v = String(campos.get(k) ?? '').trim();
      if (v) corpo[k] = v;
    }
    if (this.imovel) corpo.imovel_codigo = this.imovel.codigo;
    this.enviando = true;
    this.resposta = null;
    try {
      const r = await fetch(this.pagina!.url_formulario!, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
      const dados = await r.json().catch(() => ({}));
      if (r.ok) {
        this.resposta = { ok: true, texto: 'Recebido! O corretor vai falar com você em breve.' };
        form.reset();
      } else {
        const detalhes = Array.isArray(dados.detalhes) ? dados.detalhes.join(' ') : '';
        this.resposta = { ok: false, texto: detalhes || dados.mensagem || 'Não foi possível enviar agora. Tente de novo em instantes.' };
      }
    } catch {
      this.resposta = { ok: false, texto: 'Sem conexão. Tente de novo em instantes.' };
    } finally {
      this.enviando = false;
    }
  }

  private formulario(titulo: string) {
    if (!this.pagina || (!this.pagina.url_formulario && !this.previa)) return nothing;
    return html`<section class=${this.destaque('formulario')}>
      <h2>${titulo}</h2>
      <div class="caixa">
        <form @submit=${(e: Event) => this.enviar(e)}>
          <label>Nome <input name="nome" required maxlength="120" autocomplete="name" /></label>
          <label>WhatsApp ou telefone <input name="telefone" inputmode="tel" autocomplete="tel" maxlength="20" placeholder="(61) 99999-9999" /></label>
          <label>E-mail <input name="email" type="email" autocomplete="email" maxlength="200" /></label>
          <label>Mensagem <textarea name="mensagem" maxlength="1000">${this.imovel ? `Tenho interesse no imóvel ${this.imovel.codigo}.` : ''}</textarea></label>
          <label class="escondido" aria-hidden="true">Site <input name="site" tabindex="-1" autocomplete="off" /></label>
          <label class="marcar"><input type="checkbox" name="consentimento" value="sim" required /> Autorizo ${this.pagina.nome} a entrar em contato comigo sobre imóveis.</label>
          ${this.resposta ? html`<div class="aviso ${this.resposta.ok ? '' : 'erro'}" role=${this.resposta.ok ? 'status' : 'alert'}>${this.resposta.texto}</div>` : nothing}
          <div><button class="botao" type="submit" ?disabled=${this.enviando || !!this.previa}>${this.enviando ? 'Enviando…' : 'Enviar'}</button></div>
          ${this.previa ? html`<p class="suave">Na prévia o formulário não envia.</p>` : nothing}
        </form>
      </div>
    </section>`;
  }

  /** "Quero saber mais" (M6): abre o WhatsApp do corretor citando o imóvel; sem WhatsApp, a ficha. */
  private querSaberMais(i: Cartao) {
    const contato = this.bloco('contato');
    const zap = contato?.whatsapp !== false ? linkWhatsapp(this.pagina!.telefone, `Olá! Quero saber mais sobre o imóvel ${i.codigo}${i.titulo ? ` (${i.titulo})` : ''}.`) : null;
    return zap
      ? html`<a class="botao" href=${zap} target="_blank" rel="noopener">Quero saber mais</a>`
      : html`<a class="botao" href=${this.urlImovel(i.codigo)}>Quero saber mais</a>`;
  }

  /** "320 m² · 4 qts · 3 vagas" (M6); o bairro entra só se o título ainda não o cita. */
  private dadosDoCartao(i: Cartao) {
    const titulo = i.titulo ?? '';
    return [
      i.area_util_m2 ? `${i.area_util_m2} m²` : null,
      i.quartos ? `${i.quartos} qt${i.quartos > 1 ? 's' : ''}` : null,
      i.vagas ? `${i.vagas} vaga${i.vagas > 1 ? 's' : ''}` : null,
      i.bairro && !titulo.includes(i.bairro) ? i.bairro : null,
      i.situacao === 'reservado' ? 'Reservado' : null,
    ].filter(Boolean).join(' · ');
  }

  private cartao(i: Cartao) {
    const titulo = i.titulo ?? ROTULO_TIPO_IMOVEL[i.tipo] ?? i.tipo;
    return html`<article class="cartao">
      <a class="ver" href=${this.urlImovel(i.codigo)}>
        ${i.capa ? html`<img src=${i.capa} alt=${titulo} loading="lazy" />` : html`<div class="sem-foto"></div>`}
        <div class="corpo">
          <div class="titulo" title=${titulo}>${titulo}</div>
          <div class="dados">${this.dadosDoCartao(i) || local(i)}</div>
        </div>
      </a>
      <div class="rodape"><span class="preco">${reais(i.preco_c)}</span>${this.querSaberMais(i)}</div>
    </article>`;
  }

  /** Capa (M6): só avatar, nome, a linha do CRECI (quando houver, D-93) e Falar no WhatsApp. */
  private topo() {
    const p = this.pagina!;
    const contato = this.bloco('contato');
    const zap = contato?.whatsapp !== false ? linkWhatsapp(p.telefone, this.imovel ? `Olá! Vi o imóvel ${this.imovel.codigo} na sua página.` : 'Olá! Vi sua página e quero falar sobre imóveis.') : null;
    return html`<header class="topo ${this.destaque('contato')}">
      <div class="conteudo">
        ${p.foto_url ? html`<img class="foto-corretor" src=${p.foto_url} alt=${`Foto de ${p.nome}`} />` : html`<span class="iniciais" aria-hidden="true">${iniciais(p.nome)}</span>`}
        <h1>${p.nome}</h1>
        <p class="linha">Corretor de imóveis${p.creci ? ` · CRECI ${p.creci}` : ''}</p>
        ${zap ? html`<div class="acoes"><a class="botao claro" href=${zap} target="_blank" rel="noopener">Falar no WhatsApp</a></div>` : nothing}
      </div>
    </header>`;
  }

  /** Instagram (bloco "WhatsApp e Instagram"): fora da capa, no fim da página. */
  private instagram() {
    const ig = this.bloco('contato')?.instagram;
    if (!ig || !/^[A-Za-z0-9._]{1,30}$/.test(ig)) return nothing;
    return html`<section class=${this.destaque('contato')}><a class="botao claro" href="https://instagram.com/${encodeURIComponent(ig)}" target="_blank" rel="noopener">@${ig} no Instagram</a></section>`;
  }

  private renderPagina() {
    const blocos = this.pagina!.blocos;
    // Destaques não se repetem em "Imóveis à venda" (#181): a lista geral mostra só os outros.
    const destaques = blocos.find((b) => b.tipo === 'destaques');
    const emDestaque = new Set(destaques ? (destaques.codigos ?? []).filter((c) => this.imoveis.some((i) => i.codigo === c)) : []);
    const demais = this.imoveis.filter((i) => !emDestaque.has(i.codigo));
    return html`
      ${this.topo()}
      <div class="conteudo">
        ${blocos.map((b) => {
          // Apresentação: o primeiro bloco abaixo da capa (M6), e não mais dentro dela.
          if (b.tipo === 'apresentacao') {
            const texto = [b.titulo, b.texto].filter(Boolean);
            return texto.length
              ? html`<section class=${this.destaque('apresentacao')}>${b.titulo ? html`<h2>${b.titulo}</h2>` : nothing}${b.texto ? html`<p class="texto suave">${b.texto}</p>` : nothing}</section>`
              : nothing;
          }
          if (b.tipo === 'destaques') {
            const lista = [...emDestaque].map((c) => this.imoveis.find((i) => i.codigo === c)!);
            return lista.length ? html`<section class=${this.destaque('destaques')}><h2>${b.titulo || 'Imóveis em destaque'}</h2><div class="grade">${lista.map((i) => this.cartao(i))}</div></section>` : nothing;
          }
          if (b.tipo === 'imoveis') {
            if (!demais.length && emDestaque.size) return nothing;
            return html`<section class=${this.destaque('imoveis')}>
              <h2>${b.titulo || 'Imóveis'}</h2>
              ${demais.length ? html`<div class="grade">${demais.map((i) => this.cartao(i))}</div>` : html`<p class="suave">Novos imóveis em breve.</p>`}
            </section>`;
          }
          if (b.tipo === 'sobre' && b.texto) return html`<section class=${this.destaque('sobre')}><h2>${b.titulo || 'Sobre mim'}</h2><div class="caixa texto">${b.texto}</div></section>`;
          if (b.tipo === 'bairros' && b.lista?.length) {
            return html`<section class=${this.destaque('bairros')}><h2>${b.titulo || 'Onde eu atendo'}</h2><ul class="etiquetas">${b.lista.map((x) => html`<li>${x}</li>`)}</ul></section>`;
          }
          if (b.tipo === 'formulario') return this.formulario(b.titulo || 'Fale comigo');
          if (b.tipo === 'contato') return this.instagram();
          return nothing;
        })}
      </div>
    `;
  }

  private renderImovel() {
    const im = this.imovel!;
    const caracteristicas: string[] = im.caracteristicas ?? [];
    // Quartos, área e vagas vão com ícone; o resto, em texto logo abaixo.
    const detalhes = [
      im.area_util_m2 && im.area_total_m2 ? `${im.area_total_m2} m² de área total` : null,
      im.suites ? `${im.suites} suíte${im.suites > 1 ? 's' : ''}` : null,
      im.banheiros ? `${im.banheiros} banheiro${im.banheiros > 1 ? 's' : ''}` : null,
    ].filter(Boolean);
    const custos = [im.condominio_c ? `Condomínio ${reais(im.condominio_c)}` : null, im.iptu_anual_c ? `IPTU ${reais(im.iptu_anual_c)}/ano` : null].filter(Boolean);
    return html`
      ${this.topo()}
      <div class="conteudo">
        <p><a href="/portal_corretor/p?c=${encodeURIComponent(this.pagina!.endereco)}">← Todos os imóveis</a></p>
        ${im.fotos?.length
          ? html`<div class="galeria">${im.fotos.map(
              (f: { url: string; legenda: string | null }, n: number) =>
                html`<img src=${f.url} alt=${f.legenda ?? `Foto ${n + 1} do imóvel`} loading="lazy" role="button" tabindex="0"
                  @click=${(e: Event) => this.abrirFoto(f.url, e.currentTarget as HTMLElement)} @keydown=${(e: KeyboardEvent) => {
                    if (e.key !== 'Enter' && e.key !== ' ') return;
                    e.preventDefault();
                    this.abrirFoto(f.url, e.currentTarget as HTMLElement);
                  }} />`,
            )}</div>`
          : nothing}
        <section>
          <div class="suave">${im.codigo} · ${ROTULO_TIPO_IMOVEL[im.tipo] ?? im.tipo}${im.situacao === 'reservado' ? ' · Reservado' : ''}</div>
          <h2>${im.titulo ?? ROTULO_TIPO_IMOVEL[im.tipo] ?? 'Imóvel'}</h2>
          <div class="preco">${reais(im.preco_c)}</div>
          <div class="suave">${[enderecoEmTexto(im.endereco), local(im), im.uf].filter(Boolean).join(' · ')}</div>
          ${iconesImovel(im)}
          ${detalhes.length ? html`<div class="suave">${detalhes.join(' · ')}</div>` : nothing}
          ${custos.length ? html`<div class="suave">${custos.join(' · ')}</div>` : nothing}
        </section>
        ${im.descricao ? html`<section><div class="caixa texto">${im.descricao}</div></section>` : nothing}
        ${caracteristicas.length ? html`<section><h2>Características</h2><ul class="etiquetas">${caracteristicas.map((c) => html`<li>${c}</li>`)}</ul></section>` : nothing}
        ${this.formulario('Quero saber mais')}
      </div>
      ${this.foto
        ? html`<div class="tela-cheia" role="dialog" aria-modal="true" aria-label="Foto em tela cheia" @click=${() => this.fecharFoto()} @keydown=${(e: KeyboardEvent) => e.key === 'Escape' && this.fecharFoto()}>
            <img src=${this.foto} alt="Foto do imóvel em tela cheia" />
            <button class="botao claro" type="button" @click=${() => this.fecharFoto()}>Fechar</button>
          </div>`
        : nothing}
    `;
  }

  render() {
    if (this.estado === 'carregando') return html`<div class="centro suave">Carregando…</div>`;
    if (this.estado === 'nao_encontrada') {
      return html`<div class="centro"><h2>Página não encontrada</h2><p class="suave">O endereço pode ter mudado ou o imóvel não está mais anunciado.</p></div>`;
    }
    if (this.estado === 'falha') {
      return html`<div class="centro"><h2>Não foi possível abrir agora</h2><p><button class="botao" @click=${() => { this.estado = 'carregando'; void this.carregar(); }}>Tentar de novo</button></p></div>`;
    }
    if (this.previa) return html`<div @click=${(e: Event) => this.segurarLinks(e)}>${this.renderPagina()}</div>`;
    return this.imovel ? this.renderImovel() : this.renderPagina();
  }
}
