import { LitElement, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { UrbiVersoAPI } from '@urbiverso/sdk';
import { chamarApi, data, dataHora, enviar, filtrosNaUrl, gesto, mensagemDeErro } from '../apoio';

declare const urbiVerso: UrbiVersoAPI;

interface Conexoes {
  /** Já houve conexão nesta conta: o botão diz "Reconectar" (#182, item 5). */
  ja_conectou?: boolean;
  instagram: { usuario: string | null; tipo_conta: string | null; conectado_em: string; token_expira_em: string | null; ultimo_erro: string | null } | null;
  disponivel: boolean;
  retorno: string;
}

const CHAVE_ESTADO = 'pc-instagram-state';

// Ajustes › Conexões (P12; bloco 8b, spec 9.2): o Instagram com o estado real, conectado pelo login do
// próprio Instagram (Conectar · Conectado com o tipo de conta e o que pode publicar · Testar publicação ·
// Desconectar); sem as credenciais da Meta na instância (#30), o cartão fica à vista, desligado e com o
// porquê. O WhatsApp mostra os 3 passos da conexão, desligados até o bloco 6 (D-119, D-78), e a Agenda
// a fase 6. A volta da Meta chega nesta tela com `?code=&state=`; o `state` gerado aqui confere a origem.

/** Os 3 passos da conexão do WhatsApp (spec 11.1 P12), à vista e desligados até o bloco 6 (D-119, D-78). */
export const PASSOS_WHATSAPP = [
  { titulo: 'Entrar com a sua conta da Meta', texto: 'A mesma que você usa no Instagram ou no Facebook.' },
  { titulo: 'Digitar o número que você já usa no WhatsApp Business', texto: 'Você continua usando o WhatsApp no celular; as conversas aparecem aqui também.' },
  { titulo: 'Confirmar no celular', texto: 'Abra o WhatsApp Business no celular e leia o código que vai aparecer.' },
] as const;

/** O que cada tipo de conta publica pelo app (stories pela API pedem conta Comercial). */
export const PODE_PUBLICAR = (tipo: string | null) =>
  tipo === 'BUSINESS' ? 'conta Comercial · pode publicar posts, carrosséis e stories' : 'conta de Criador · pode publicar posts e carrosséis (stories pedem conta Comercial)';
@customElement('pc-tela-conexoes')
export class PcTelaConexoes extends LitElement {
  @state() private dados: Conexoes | null = null;
  @state() private falha: string | null = null;
  @state() private ocupado = false;
  @state() private testando = false;
  /** Resultado do último "Testar publicação" nesta visita. */
  @state() private teste: { ok: boolean; texto: string } | null = null;
  /**
   * A conta em que a tela nasceu (a troca de conta a recria). Toda continuação passa por `vida.esperar`:
   * trocada a conta em qualquer await (confirmação aberta, envio em voo), o gesto termina em silêncio,
   * sem envio na conta nova (desconectar não leva id: sairia com o `X-Conta` dela), estado, aviso nem navegação.
   */
  private readonly vida = gesto();

  connectedCallback() {
    super.connectedCallback();
    void this.iniciar().catch((e) => {
      if (!this.vida.encerrado(e)) throw e;
    });
  }

  private async iniciar() {
    const q = new URLSearchParams(window.location.search);
    const code = q.get('code');
    if (code || q.get('error')) {
      let esperado: string | null = null;
      try {
        esperado = sessionStorage.getItem(CHAVE_ESTADO);
        sessionStorage.removeItem(CHAVE_ESTADO);
      } catch {
        esperado = null;
      }
      // Tira o código da barra de endereço (não fica no histórico nem é reaproveitado).
      filtrosNaUrl(new URLSearchParams());
      if (q.get('error')) {
        await this.vida.esperar(urbiVerso.alertar({ titulo: 'Conexão cancelada', mensagem: 'O Instagram não autorizou a conexão. Tente de novo quando quiser.', tipo: 'alerta' }));
      } else if (!esperado || esperado !== q.get('state')) {
        await this.vida.esperar(urbiVerso.alertar({ titulo: 'Conexão não confirmada', mensagem: 'O retorno do Instagram não corresponde ao pedido feito nesta aba. Clique em "Conectar Instagram" de novo.', tipo: 'erro' }));
      } else if (this.vida.vivo()) {
        this.ocupado = true;
        try {
          const r = await this.vida.esperar(enviar('POST', '/conexoes/instagram/retorno', { code }));
          urbiVerso.notificar(`Instagram conectado${r.usuario ? `: @${r.usuario}` : ''}.`, 'sucesso');
          if (r.aviso) await this.vida.esperar(urbiVerso.alertar({ titulo: 'Atenção', mensagem: r.aviso, tipo: 'alerta' }));
        } catch (e) {
          if (this.vida.encerrado(e)) return;
          await this.vida.esperar(urbiVerso.alertar({ titulo: 'Não foi possível conectar', mensagem: mensagemDeErro(e), tipo: 'erro' }));
        } finally {
          this.ocupado = false;
        }
      }
    }
    if (this.vida.vivo()) await this.carregar();
  }

  private async carregar() {
    this.falha = null;
    try {
      this.dados = await this.vida.esperar(chamarApi('/conexoes'));
    } catch (e) {
      if (this.vida.encerrado(e)) return;
      this.falha = mensagemDeErro(e);
    }
  }

  private async conectar() {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    const estado = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    if (!this.vida.vivo()) return;
    try {
      sessionStorage.setItem(CHAVE_ESTADO, estado);
    } catch {
      await urbiVerso.alertar({ titulo: 'Navegador sem armazenamento', mensagem: 'Saia da navegação privada para conectar o Instagram.', tipo: 'alerta' });
      return;
    }
    try {
      const r = await this.vida.esperar(enviar('POST', '/conexoes/instagram/iniciar', { state: estado }));
      window.location.href = r.url;
    } catch (e) {
      if (this.vida.encerrado(e)) return;
      await urbiVerso.alertar({ titulo: 'Não foi possível conectar', mensagem: mensagemDeErro(e), tipo: 'erro' });
    }
  }

  private async desconectar() {
    try {
      const ok = await this.vida.esperar(urbiVerso.confirmar({ titulo: 'Desconectar o Instagram', mensagem: 'Publicações agendadas deixam de sair até você conectar de novo.', rotuloConfirmar: 'Desconectar', perigo: true }));
      if (!ok) return;
      await this.vida.esperar(enviar('POST', '/conexoes/instagram/desconectar'));
      urbiVerso.notificar('Instagram desconectado.', 'sucesso');
      this.teste = null;
      window.dispatchEvent(new CustomEvent('pc-ajustes-mudou'));
      await this.carregar();
    } catch (e) {
      if (this.vida.encerrado(e)) return;
      await urbiVerso.alertar({ titulo: 'Não foi possível desconectar', mensagem: mensagemDeErro(e), tipo: 'erro' });
    }
  }

  /** Testar publicação: confere a conexão sem publicar nada (`POST /conexoes/instagram/testar`). */
  private async testar() {
    if (this.testando || !this.vida.vivo()) return;
    this.testando = true;
    this.teste = null;
    try {
      const r = await this.vida.esperar(enviar('POST', '/conexoes/instagram/testar'));
      const cota = r.usadas_24h !== null && r.limite_24h ? ` Nas últimas 24 horas, ${r.usadas_24h} de ${r.limite_24h} publicações permitidas.` : '';
      this.teste = { ok: true, texto: `Tudo certo: o app consegue publicar em @${r.usuario ?? 'sua conta'}. Nada foi publicado no teste.${cota}` };
      // O teste que dá certo limpa o `ultimo_erro` no backend: o cartão e o menu de Ajustes releem.
      window.dispatchEvent(new CustomEvent('pc-ajustes-mudou'));
      await this.carregar();
    } catch (e) {
      if (this.vida.encerrado(e)) return;
      this.teste = { ok: false, texto: mensagemDeErro(e) };
      // O teste que falha pode gravar `ultimo_erro` (ex.: TOKEN_INVALIDO): o menu de Ajustes relê, como em `desconectar`.
      window.dispatchEvent(new CustomEvent('pc-ajustes-mudou'));
      await this.carregar();
    } finally {
      this.testando = false;
    }
  }

  private async copiarRetorno() {
    try {
      await this.vida.esperar(navigator.clipboard.writeText(this.dados!.retorno));
      urbiVerso.notificar('Endereço copiado.', 'sucesso');
    } catch (e) {
      if (this.vida.encerrado(e)) return;
      urbiVerso.notificar('Não deu para copiar: selecione o endereço e copie à mão.', 'erro');
    }
  }

  private cartaoInstagram() {
    const d = this.dados!;
    const ig = d.instagram;
    if (!d.disponivel) {
      // #30: a instância ainda não tem as credenciais da Meta. O cartão fica à vista, com o botão desligado e o porquê.
      return html`<urbi-card titulo="Instagram" icone="fa-brands fa-instagram">
        <urbi-stack>
          <urbi-linha quebrar><urbi-badge>indisponível nesta instalação</urbi-badge></urbi-linha>
          <urbi-prosa papel="secundario">A conexão com o Instagram ainda não foi configurada pela equipe da plataforma. Enquanto isso, baixe as artes no Estúdio e publique pelo Instagram.</urbi-prosa>
          <urbi-linha><urbi-botao icone="fa-brands fa-instagram" desabilitado title="Indisponível até a equipe configurar a conexão com a Meta">Conectar Instagram</urbi-botao></urbi-linha>
          <urbi-prosa papel="fraco">Para a equipe, endereço de retorno a cadastrar no app da Meta: ${d.retorno}</urbi-prosa>
          <urbi-linha><urbi-botao variante="fantasma" icone="fa-solid fa-copy" @click=${() => this.copiarRetorno()}>Copiar endereço</urbi-botao></urbi-linha>
        </urbi-stack>
      </urbi-card>`;
    }
    if (!ig) {
      return html`<urbi-card titulo="Instagram" icone="fa-brands fa-instagram">
        <urbi-stack>
          <urbi-prosa>Conecte a sua conta profissional do Instagram para publicar e agendar pelo Estúdio. O login é feito no próprio Instagram.</urbi-prosa>
          <urbi-linha><urbi-botao icone="fa-brands fa-instagram" ?carregando=${this.ocupado} @click=${() => this.conectar()}>${d.ja_conectou ? 'Reconectar Instagram' : 'Conectar Instagram'}</urbi-botao></urbi-linha>
        </urbi-stack>
      </urbi-card>`;
    }
    return html`<urbi-card titulo="Instagram" icone="fa-brands fa-instagram">
      <urbi-stack>
        <urbi-linha quebrar alinhar="centro">
          <urbi-badge cor=${ig.ultimo_erro ? 'alerta' : 'sucesso'}>${ig.ultimo_erro ? 'Precisa de atenção' : 'Conectado'}</urbi-badge>
          <urbi-prosa>${ig.usuario ? `@${ig.usuario}` : 'Conta conectada'} · ${PODE_PUBLICAR(ig.tipo_conta)}.</urbi-prosa>
        </urbi-linha>
        <urbi-prosa papel="fraco">Desde ${dataHora(ig.conectado_em)}${ig.token_expira_em ? ` · acesso renovado até ${data(ig.token_expira_em)}` : ''}</urbi-prosa>
        ${ig.ultimo_erro ? html`<urbi-banner variante="alerta">${ig.ultimo_erro}</urbi-banner>` : nothing}
        ${this.teste ? html`<urbi-banner variante=${this.teste.ok ? 'sucesso' : 'erro'}>${this.teste.texto}</urbi-banner>` : nothing}
        <urbi-linha quebrar>
          ${ig.ultimo_erro
            ? html`<urbi-botao icone="fa-solid fa-rotate" ?carregando=${this.ocupado} @click=${() => this.conectar()}>Reconectar</urbi-botao>`
            : html`<urbi-botao variante="secundario" icone="fa-solid fa-vial" ?carregando=${this.testando} @click=${() => void this.testar()}>Testar publicação</urbi-botao>`}
          <urbi-botao variante="fantasma" @click=${() => this.desconectar()}>Desconectar</urbi-botao>
        </urbi-linha>
      </urbi-stack>
    </urbi-card>`;
  }

  render() {
    if (this.falha) return html`<urbi-banner variante="erro">${this.falha}<urbi-botao slot="acao" variante="secundario" @click=${() => this.carregar()}>Tentar de novo</urbi-botao></urbi-banner>`;
    if (!this.dados) return html`<urbi-loading></urbi-loading>`;
    return html`<urbi-stack>
      <urbi-card titulo="WhatsApp" icone="fa-brands fa-whatsapp">
        <urbi-stack>
          <urbi-linha quebrar><urbi-badge>chega numa próxima versão</urbi-badge></urbi-linha>
          <urbi-prosa papel="secundario">A conexão com o WhatsApp depende de ajustes da plataforma. Quando chegar, ela leva três passos. Até lá, o Fazer agora abre o WhatsApp do seu celular com a mensagem pronta.</urbi-prosa>
          <urbi-stack>
            ${PASSOS_WHATSAPP.map(
              (p, i) => html`<urbi-linha alinhar="inicio">
                <urbi-badge>${i + 1}</urbi-badge>
                <urbi-stack>
                  <urbi-prosa>${p.titulo}</urbi-prosa>
                  <urbi-prosa papel="fraco">${p.texto}</urbi-prosa>
                </urbi-stack>
              </urbi-linha>`,
            )}
          </urbi-stack>
          <urbi-linha><urbi-botao icone="fa-brands fa-whatsapp" desabilitado title="Indisponível até a conexão com o WhatsApp chegar">Conectar WhatsApp</urbi-botao></urbi-linha>
        </urbi-stack>
      </urbi-card>
      ${this.cartaoInstagram()}
      <urbi-card titulo="Agenda" icone="fa-solid fa-calendar-days">
        <urbi-stack>
          <urbi-linha quebrar><urbi-badge>opcional · fase 6</urbi-badge></urbi-linha>
          <urbi-prosa papel="secundario">A sincronização com uma agenda externa está prevista para a fase 6. Por enquanto, as visitas ficam na agenda do app, em Hoje.</urbi-prosa>
          <urbi-linha><urbi-botao variante="secundario" icone="fa-solid fa-calendar-days" desabilitado title="Indisponível até a fase 6">Conectar agenda</urbi-botao></urbi-linha>
        </urbi-stack>
      </urbi-card>
    </urbi-stack>`;
  }
}
