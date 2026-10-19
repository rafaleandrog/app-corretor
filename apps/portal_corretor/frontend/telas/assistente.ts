import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { UrbiVersoAPI } from '@urbiverso/sdk';
import { enviar, mensagemDeErro } from '../apoio';

declare const urbiVerso: UrbiVersoAPI;

// Assistente do Corretor (bloco 9, spec 10.2): botão fixo em todas as telas do corretor, chat com
// a IA da app (ou busca na ajuda, sem IA) e proposta de ação que só roda no "Confirmar".

interface Proposta {
  tipo: string;
  resumo: string;
  rota: string;
  corpo: Record<string, unknown>;
}
interface Resposta {
  resposta: string;
  artigos: { id: string; titulo: string; secao: string }[];
  tela: { sub: string; nome: string } | null;
  acao: Proposta | null;
  sem_ia: boolean;
}
interface Mensagem {
  id: number;
  autorId: number;
  autorNome: string;
  texto: string;
  criadoEm: string;
}

/** Evento que abre o Assistente já sobre um contato (ficha do contato, funil). */
export const ABRIR_ASSISTENTE = 'pc:assistente';
export interface AbrirAssistente {
  contato_id?: number;
  contato_nome?: string;
  pergunta?: string;
}

const ASSISTENTE = -1;
// Documentação da app, servida pela plataforma (ver URL_DOCS em comum/assistente.ts; o comum traz
// a base de ajuda inteira, que não precisa ir para o navegador).
const URL_DOCS = '/portal_corretor/docs';

@customElement('pc-assistente')
export class PcAssistente extends LitElement {
  /** Subrota atual: vai como "tela atual" para a resposta puxar o artigo dela. */
  @property() tela = '/';
  @state() private aberto = false;
  @state() private mensagens: Mensagem[] = [];
  @state() private pensando = false;
  @state() private proposta: Proposta | null = null;
  @state() private irPara: { sub: string; nome: string } | null = null;
  @state() private contato: { id: number; nome: string } | null = null;
  private seq = 0;

  static styles = css`
    .flutuante { position: fixed; right: var(--espaco-lg, 24px); bottom: var(--espaco-lg, 24px); z-index: 20; }
    .corpo { display: flex; flex-direction: column; gap: var(--espaco-sm, 8px); height: min(70vh, 640px); }
    .chat { flex: 1; min-height: 0; display: flex; flex-direction: column; }
  `;

  private aoAbrir = (e: Event) => {
    const d = ((e as CustomEvent<AbrirAssistente>).detail ?? {}) as AbrirAssistente;
    if (d.contato_id) this.contato = { id: d.contato_id, nome: d.contato_nome ?? `Contato ${d.contato_id}` };
    this.aberto = true;
    if (d.pergunta) void this.perguntar(d.pergunta);
  };

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener(ABRIR_ASSISTENTE, this.aoAbrir);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener(ABRIR_ASSISTENTE, this.aoAbrir);
  }

  private meuId() {
    return urbiVerso.usuario()?.id ?? 0;
  }

  private anotar(autorId: number, texto: string) {
    this.mensagens = [
      ...this.mensagens,
      { id: ++this.seq, autorId, autorNome: autorId === ASSISTENTE ? 'Assistente' : (urbiVerso.usuario()?.nome ?? 'Você'), texto, criadoEm: new Date().toISOString() },
    ];
  }

  private async perguntar(pergunta: string) {
    const p = pergunta.trim();
    if (!p || this.pensando) return;
    const historico = this.mensagens.slice(-6).map((m) => ({ autor: m.autorId === ASSISTENTE ? 'assistente' : 'eu', texto: m.texto }));
    this.anotar(this.meuId(), p);
    this.pensando = true;
    this.proposta = null;
    this.irPara = null;
    try {
      const r = (await enviar('POST', '/assistente/perguntar', { pergunta: p, tela: this.tela, historico, ...(this.contato ? { contato_id: this.contato.id } : {}) })) as Resposta;
      const fontes = r.artigos.length
        ? `\n\n**Na ajuda:** ${r.artigos.map((a) => (a.secao && a.secao !== a.titulo ? `${a.titulo} › ${a.secao}` : a.titulo)).join(' · ')} — [abrir a documentação](${window.location.origin}${URL_DOCS})`
        : '';
      this.anotar(ASSISTENTE, `${r.resposta}${fontes}`);
      this.proposta = r.acao;
      this.irPara = r.tela && r.tela.sub !== this.tela ? r.tela : null;
    } catch (e) {
      this.anotar(ASSISTENTE, `Não consegui responder: ${mensagemDeErro(e)}`);
    } finally {
      this.pensando = false;
    }
  }

  private async confirmar() {
    const p = this.proposta;
    if (!p) return;
    this.proposta = null;
    try {
      await enviar('POST', p.rota, p.corpo);
      this.anotar(ASSISTENTE, `Feito: ${p.resumo}`);
      urbiVerso.notificar('Feito.', 'sucesso');
    } catch (e) {
      this.anotar(ASSISTENTE, `Não deu para fazer: ${mensagemDeErro(e)}`);
    }
  }

  private recusar() {
    this.proposta = null;
    this.anotar(ASSISTENTE, 'Combinado, não fiz nada.');
  }

  private abrirTela(sub: string) {
    this.aberto = false;
    urbiVerso.navegarSub(sub);
  }

  render() {
    return html`
      ${this.aberto ? '' : html`<div class="flutuante"><urbi-botao icone="fa-solid fa-comments" @click=${() => (this.aberto = true)}>Assistente</urbi-botao></div>`}
      ${this.aberto
        ? html`<urbi-modal title="Assistente do Corretor" maxWidth="640px" @urbi-modal:close=${() => (this.aberto = false)}>
            <div class="corpo">
              ${this.contato
                ? html`<urbi-linha>
                    <urbi-badge>Sobre: ${this.contato.nome}</urbi-badge>
                    <urbi-botao variante="texto" pequeno @click=${() => (this.contato = null)}>Tirar</urbi-botao>
                  </urbi-linha>`
                : ''}
              <div class="chat">
                <urbi-chat
                  .itens=${this.mensagens}
                  .usuarioAtualId=${this.meuId()}
                  markdown
                  linkificar-urls
                  audio
                  chave-audio="portal_corretor:assistente"
                  placeholder=${this.pensando ? 'Pensando…' : 'Pergunte sobre o app, um cliente ou peça um lembrete'}
                  @urbi:chat-enviar=${(e: CustomEvent<{ texto: string }>) => this.perguntar(e.detail.texto)}
                ></urbi-chat>
              </div>
              ${this.pensando ? html`<urbi-loading></urbi-loading>` : ''}
              ${this.proposta
                ? html`<urbi-card titulo="Posso fazer isto?">
                    <urbi-prosa>${this.proposta.resumo}</urbi-prosa>
                    <urbi-linha>
                      <urbi-botao icone="fa-solid fa-check" @click=${() => this.confirmar()}>Confirmar</urbi-botao>
                      <urbi-botao variante="secundario" @click=${() => this.recusar()}>Agora não</urbi-botao>
                    </urbi-linha>
                  </urbi-card>`
                : ''}
              ${this.irPara
                ? html`<urbi-linha><urbi-botao variante="secundario" pequeno icone="fa-solid fa-arrow-right" @click=${() => this.abrirTela(this.irPara!.sub)}>Abrir ${this.irPara.nome}</urbi-botao></urbi-linha>`
                : ''}
            </div>
          </urbi-modal>`
        : ''}
    `;
  }
}
