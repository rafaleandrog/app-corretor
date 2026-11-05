import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { UrbiVersoAPI } from '@urbiverso/sdk';
import { chamarApi, data, dataHora, enviar, filtrosNaUrl, gesto, mensagemDeErro } from '../apoio';

declare const urbiVerso: UrbiVersoAPI;

interface Conexoes {
  instagram: { usuario: string | null; tipo_conta: string | null; conectado_em: string; token_expira_em: string | null; ultimo_erro: string | null } | null;
  disponivel: boolean;
  retorno: string;
}

const CHAVE_ESTADO = 'pc-instagram-state';

// Ajustes › Conexões (P12; bloco 8b, spec 9.2): o Instagram com o estado real, conectado pelo login do
// próprio Instagram; o WhatsApp "ainda não disponível" e a Agenda "fase 6", sem nada para configurar.
// A volta da Meta chega nesta tela com `?code=&state=`; o `state` gerado aqui confere a origem.
@customElement('pc-tela-conexoes')
export class PcTelaConexoes extends LitElement {
  @state() private dados: Conexoes | null = null;
  @state() private falha: string | null = null;
  @state() private ocupado = false;
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
      this.falha = (e as Error).message;
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
      await this.carregar();
    } catch (e) {
      if (this.vida.encerrado(e)) return;
      await urbiVerso.alertar({ titulo: 'Não foi possível desconectar', mensagem: mensagemDeErro(e), tipo: 'erro' });
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

  render() {
    if (this.falha) return html`<urbi-banner variante="erro">${this.falha}<urbi-botao slot="acao" pequeno variante="secundario" @click=${() => this.carregar()}>Tentar de novo</urbi-botao></urbi-banner>`;
    if (!this.dados) return html`<urbi-loading></urbi-loading>`;
    const ig = this.dados.instagram;
    return html`<urbi-stack>
      <urbi-card titulo="Instagram" icone="fa-brands fa-instagram">
        ${ig
          ? html`<urbi-linha quebrar>
                <urbi-badge cor=${ig.ultimo_erro ? 'alerta' : 'sucesso'}>${ig.ultimo_erro ? 'precisa de atenção' : 'conectado'}</urbi-badge>
                <urbi-prosa>${ig.usuario ? `@${ig.usuario}` : 'Conta conectada'}</urbi-prosa>
                <urbi-prosa papel="secundario">${ig.tipo_conta === 'BUSINESS' ? 'conta comercial' : 'conta de criador'} · desde ${dataHora(ig.conectado_em)}${ig.token_expira_em ? ` · acesso renovado até ${data(ig.token_expira_em)}` : ''}</urbi-prosa>
              </urbi-linha>
              ${ig.ultimo_erro ? html`<urbi-banner variante="alerta">${ig.ultimo_erro}</urbi-banner>` : ''}
              ${ig.tipo_conta !== 'BUSINESS' ? html`<urbi-prosa papel="dica">Stories pela API pedem conta Comercial. Posts e carrosséis funcionam.</urbi-prosa>` : ''}
              <urbi-linha quebrar>
                <urbi-botao pequeno variante="secundario" icone="fa-solid fa-rotate" ?carregando=${this.ocupado} @click=${() => this.conectar()}>Reconectar</urbi-botao>
                <urbi-botao pequeno variante="fantasma" @click=${() => this.desconectar()}>Desconectar</urbi-botao>
              </urbi-linha>`
          : this.dados.disponivel
            ? html`<urbi-prosa>Conecte a sua conta profissional do Instagram para publicar e agendar pelo Estúdio. O login é feito no próprio Instagram.</urbi-prosa>
                <urbi-botao icone="fa-brands fa-instagram" ?carregando=${this.ocupado} @click=${() => this.conectar()}>Conectar Instagram</urbi-botao>`
            : html`<urbi-banner variante="info">A conexão com o Instagram ainda não foi configurada pela equipe da plataforma. Enquanto isso, baixe as artes no Estúdio e publique pelo Instagram.</urbi-banner>
                <urbi-prosa papel="secundario">Para a equipe, endereço de retorno a cadastrar no app da Meta: ${this.dados.retorno}</urbi-prosa>
                <urbi-botao pequeno variante="fantasma" icone="fa-solid fa-copy" @click=${() => this.copiarRetorno()}>Copiar endereço</urbi-botao>`}
      </urbi-card>
      <urbi-card titulo="WhatsApp" icone="fa-brands fa-whatsapp">
        <urbi-linha quebrar><urbi-badge>ainda não disponível</urbi-badge></urbi-linha>
        <urbi-prosa papel="secundario">A conexão com o WhatsApp chega numa próxima versão (depende de ajustes da plataforma). Até lá, o Fazer agora abre o WhatsApp do seu celular com a mensagem pronta.</urbi-prosa>
      </urbi-card>
      <urbi-card titulo="Agenda" icone="fa-solid fa-calendar-days">
        <urbi-linha quebrar><urbi-badge>fase 6</urbi-badge></urbi-linha>
        <urbi-prosa papel="secundario">A sincronização com uma agenda externa está prevista para a fase 6. Por enquanto, as visitas ficam na agenda do app, em Hoje.</urbi-prosa>
      </urbi-card>
    </urbi-stack>`;
  }
}
