import { LitElement, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { UrbiVersoAPI } from '@urbiverso/sdk';
import type { Bloco } from '../../comum/pagina';
import { linkWhatsapp } from '../../comum/pagina';
import { ROTULO_TIPO_IMOVEL } from '../apoio';
import { estiloPublico } from './estilo';

declare const urbiVerso: UrbiVersoAPI;

interface PaginaPublica {
  endereco: string;
  nome: string;
  creci: string | null;
  telefone: string | null;
  cor: string;
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

// Minha Página (`/portal_corretor/p?c=<endereço>`) e ficha pública do imóvel (`…&i=<código>`).
// Página pública: lê só a vitrine (rota GET anônima) e envia o formulário ao webhook da conta.
@customElement('pc-pagina-publica')
export class PcPaginaPublica extends LitElement {
  static styles = estiloPublico;

  @state() private pagina: PaginaPublica | null = null;
  @state() private imoveis: Cartao[] = [];
  @state() private imovel: Record<string, any> | null = null;
  @state() private estado: 'carregando' | 'pronto' | 'nao_encontrada' | 'falha' = 'carregando';
  @state() private enviando = false;
  @state() private resposta: { ok: boolean; texto: string } | null = null;
  @state() private foto: string | null = null;

  private readonly params = new URLSearchParams(window.location.search);

  connectedCallback() {
    super.connectedCallback();
    void this.carregar();
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

  private async abrirFoto(url: string) {
    this.foto = url;
    await this.updateComplete;
    this.renderRoot.querySelector<HTMLButtonElement>('.tela-cheia button')?.focus();
  }

  private fecharFoto() {
    this.foto = null;
  }

  private bloco(tipo: Bloco['tipo']) {
    return this.pagina?.blocos.find((b) => b.tipo === tipo);
  }

  private urlImovel(codigo: string) {
    return `/portal_corretor/p?c=${encodeURIComponent(this.pagina!.endereco)}&i=${encodeURIComponent(codigo)}`;
  }

  private async enviar(ev: Event) {
    ev.preventDefault();
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
    if (!this.pagina?.url_formulario) return nothing;
    return html`<section>
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
          <div><button class="botao" type="submit" ?disabled=${this.enviando}>${this.enviando ? 'Enviando…' : 'Enviar'}</button></div>
        </form>
      </div>
    </section>`;
  }

  private cartao(i: Cartao) {
    return html`<a class="cartao" href=${this.urlImovel(i.codigo)}>
      ${i.capa ? html`<img src=${i.capa} alt=${i.titulo ?? ''} loading="lazy" />` : html`<div class="sem-foto"></div>`}
      <div class="corpo">
        <div class="preco">${reais(i.preco_c)}</div>
        <div>${i.titulo ?? ROTULO_TIPO_IMOVEL[i.tipo] ?? i.tipo}</div>
        <div class="suave">${local(i)}</div>
        <div class="icones">
          ${i.quartos ? html`<span>${i.quartos} quarto${i.quartos > 1 ? 's' : ''}</span>` : nothing}
          ${i.area_util_m2 ? html`<span>${i.area_util_m2} m²</span>` : nothing}
          ${i.vagas ? html`<span>${i.vagas} vaga${i.vagas > 1 ? 's' : ''}</span>` : nothing}
          ${i.situacao === 'reservado' ? html`<span>Reservado</span>` : nothing}
        </div>
      </div>
    </a>`;
  }

  private topo(chamada?: string | null) {
    const p = this.pagina!;
    const contato = this.bloco('contato');
    const instagram = contato?.instagram && /^[A-Za-z0-9._]{1,30}$/.test(contato.instagram) ? contato.instagram : null;
    const zap = contato?.whatsapp !== false ? linkWhatsapp(p.telefone, this.imovel ? `Olá! Vi o imóvel ${this.imovel.codigo} na sua página.` : 'Olá! Vi sua página e quero falar sobre imóveis.') : null;
    return html`<header class="topo">
      <div class="conteudo">
        <h1>${p.nome}</h1>
        <p>Corretor de imóveis${p.creci ? ` · CRECI ${p.creci}` : ''}</p>
        ${chamada ? html`<p class="texto">${chamada}</p>` : nothing}
        <div class="acoes">
          ${zap ? html`<a class="botao verde" href=${zap} target="_blank" rel="noopener">Falar no WhatsApp</a>` : nothing}
          ${instagram ? html`<a class="botao claro" href="https://instagram.com/${encodeURIComponent(instagram)}" target="_blank" rel="noopener">@${instagram}</a>` : nothing}
        </div>
      </div>
    </header>`;
  }

  private renderPagina() {
    const blocos = this.pagina!.blocos;
    const apresentacao = this.bloco('apresentacao');
    return html`
      ${this.topo(apresentacao ? [apresentacao.titulo, apresentacao.texto].filter(Boolean).join('\n') : null)}
      <div class="conteudo">
        ${blocos.map((b) => {
          if (b.tipo === 'destaques') {
            const lista = (b.codigos ?? []).map((c) => this.imoveis.find((i) => i.codigo === c)).filter((i): i is Cartao => !!i);
            return lista.length ? html`<section><h2>${b.titulo || 'Destaques'}</h2><div class="grade">${lista.map((i) => this.cartao(i))}</div></section>` : nothing;
          }
          if (b.tipo === 'imoveis') {
            return html`<section>
              <h2>${b.titulo || 'Imóveis'}</h2>
              ${this.imoveis.length ? html`<div class="grade">${this.imoveis.map((i) => this.cartao(i))}</div>` : html`<p class="suave">Novos imóveis em breve.</p>`}
            </section>`;
          }
          if (b.tipo === 'sobre' && b.texto) return html`<section><h2>${b.titulo || 'Sobre mim'}</h2><div class="caixa texto">${b.texto}</div></section>`;
          if (b.tipo === 'bairros' && b.lista?.length) {
            return html`<section><h2>${b.titulo || 'Onde eu atendo'}</h2><ul class="etiquetas">${b.lista.map((x) => html`<li>${x}</li>`)}</ul></section>`;
          }
          if (b.tipo === 'formulario') return this.formulario(b.titulo || 'Fale comigo');
          return nothing;
        })}
      </div>
    `;
  }

  private renderImovel() {
    const im = this.imovel!;
    const caracteristicas: string[] = im.caracteristicas ?? [];
    const detalhes = [
      im.area_util_m2 ? `${im.area_util_m2} m² úteis` : null,
      im.area_total_m2 ? `${im.area_total_m2} m² de área total` : null,
      im.quartos ? `${im.quartos} quarto${im.quartos > 1 ? 's' : ''}` : null,
      im.suites ? `${im.suites} suíte${im.suites > 1 ? 's' : ''}` : null,
      im.banheiros ? `${im.banheiros} banheiro${im.banheiros > 1 ? 's' : ''}` : null,
      im.vagas ? `${im.vagas} vaga${im.vagas > 1 ? 's' : ''}` : null,
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
                  @click=${() => this.abrirFoto(f.url)} @keydown=${(e: KeyboardEvent) => (e.key === 'Enter' || e.key === ' ') && this.abrirFoto(f.url)} />`,
            )}</div>`
          : nothing}
        <section>
          <div class="suave">${im.codigo} · ${ROTULO_TIPO_IMOVEL[im.tipo] ?? im.tipo}${im.situacao === 'reservado' ? ' · Reservado' : ''}</div>
          <h2>${im.titulo ?? ROTULO_TIPO_IMOVEL[im.tipo] ?? 'Imóvel'}</h2>
          <div class="preco">${reais(im.preco_c)}</div>
          <div class="suave">${[im.endereco, local(im), im.uf].filter(Boolean).join(' · ')}</div>
          ${detalhes.length ? html`<div class="icones">${detalhes.map((d) => html`<span>${d}</span>`)}</div>` : nothing}
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
    return this.imovel ? this.renderImovel() : this.renderPagina();
  }
}
