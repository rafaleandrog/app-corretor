import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { UrbiVersoAPI } from '@urbiverso/sdk';
import { data, dataHora, enviar, mensagemDeErro } from '../apoio';

declare const urbiVerso: UrbiVersoAPI;

interface Conexoes {
  instagram: { usuario: string | null; tipo_conta: string | null; conectado_em: string; token_expira_em: string | null; ultimo_erro: string | null } | null;
  disponivel: boolean;
  retorno: string;
}

const CHAVE_ESTADO = 'pc-instagram-state';

// Ajustes › Conexões (bloco 8b, spec 9.2): conectar o Instagram pelo login do próprio Instagram.
// A volta da Meta chega nesta tela com `?code=&state=`; o `state` gerado aqui confere a origem.
@customElement('pc-tela-conexoes')
export class PcTelaConexoes extends LitElement {
  @state() private dados: Conexoes | null = null;
  @state() private falha: string | null = null;
  @state() private ocupado = false;

  connectedCallback() {
    super.connectedCallback();
    void this.iniciar();
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
      window.history.replaceState(null, '', window.location.pathname);
      if (q.get('error')) {
        await urbiVerso.alertar({ titulo: 'Conexão cancelada', mensagem: 'O Instagram não autorizou a conexão. Tente de novo quando quiser.', tipo: 'alerta' });
      } else if (!esperado || esperado !== q.get('state')) {
        await urbiVerso.alertar({ titulo: 'Conexão não confirmada', mensagem: 'O retorno do Instagram não corresponde ao pedido feito nesta aba. Clique em "Conectar Instagram" de novo.', tipo: 'erro' });
      } else {
        this.ocupado = true;
        try {
          const r = await enviar('POST', '/conexoes/instagram/retorno', { code });
          urbiVerso.notificar(`Instagram conectado${r.usuario ? `: @${r.usuario}` : ''}.`, 'sucesso');
          if (r.aviso) await urbiVerso.alertar({ titulo: 'Atenção', mensagem: r.aviso, tipo: 'alerta' });
        } catch (e) {
          await urbiVerso.alertar({ titulo: 'Não foi possível conectar', mensagem: mensagemDeErro(e), tipo: 'erro' });
        } finally {
          this.ocupado = false;
        }
      }
    }
    await this.carregar();
  }

  private async carregar() {
    this.falha = null;
    try {
      this.dados = await urbiVerso.api('/conexoes');
    } catch (e) {
      this.falha = (e as Error).message;
    }
  }

  private async conectar() {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    const estado = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    try {
      sessionStorage.setItem(CHAVE_ESTADO, estado);
    } catch {
      await urbiVerso.alertar({ titulo: 'Navegador sem armazenamento', mensagem: 'Saia da navegação privada para conectar o Instagram.', tipo: 'alerta' });
      return;
    }
    try {
      const r = await enviar('POST', '/conexoes/instagram/iniciar', { state: estado });
      window.location.href = r.url;
    } catch (e) {
      await urbiVerso.alertar({ titulo: 'Não foi possível conectar', mensagem: mensagemDeErro(e), tipo: 'erro' });
    }
  }

  private async desconectar() {
    const ok = await urbiVerso.confirmar({ titulo: 'Desconectar o Instagram', mensagem: 'Publicações agendadas deixam de sair até você conectar de novo.', rotuloConfirmar: 'Desconectar', perigo: true });
    if (!ok) return;
    try {
      await enviar('POST', '/conexoes/instagram/desconectar');
      urbiVerso.notificar('Instagram desconectado.', 'sucesso');
      await this.carregar();
    } catch (e) {
      await urbiVerso.alertar({ titulo: 'Não foi possível desconectar', mensagem: mensagemDeErro(e), tipo: 'erro' });
    }
  }

  private async copiarRetorno() {
    try {
      await navigator.clipboard.writeText(this.dados!.retorno);
      urbiVerso.notificar('Endereço copiado.', 'sucesso');
    } catch {
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
        <urbi-prosa papel="secundario">Chega numa próxima versão (depende de ajustes da plataforma).</urbi-prosa>
      </urbi-card>
    </urbi-stack>`;
  }
}
