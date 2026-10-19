import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { UrbiVersoAPI } from '@urbiverso/sdk';
import { enviar, mensagemDeErro } from '../apoio';

declare const urbiVerso: UrbiVersoAPI;

// Assistente do Corretor (bloco 9, spec 10.2): tela própria no menu, com o chat ocupando a tela
// (D-76: o botão flutuante pediria CSS estrutural, que o contrato de UI proíbe). A conversa fica em
// memória enquanto o app está aberto: sair e voltar à tela não a perde.

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
  /** O que vai no histórico para a IA (sem o rodapé de artigos). */
  bruto: string;
}

const ASSISTENTE = -1;
// Documentação da app, servida pela plataforma (ver URL_DOCS em comum/assistente.ts; o comum traz
// a base de ajuda inteira, que não precisa ir para o navegador).
const URL_DOCS = '/portal_corretor/docs';

/** Estado da conversa, fora do componente: sobrevive à troca de tela. */
const conversa = {
  mensagens: [] as Mensagem[],
  proposta: null as Proposta | null,
  irPara: null as { sub: string; nome: string } | null,
  contato: null as { id: number; nome: string } | null,
  /** Última tela do app antes do Assistente: vai como "tela atual" para puxar o artigo dela. */
  telaAnterior: '/',
  seq: 0,
};

/** O app avisa a tela em que o corretor está (fora do Assistente). */
export function lembrarTela(sub: string) {
  if (sub !== '/assistente') conversa.telaAnterior = sub;
}

/** Abre o Assistente sobre um contato (ficha do contato: "perguntar ao Assistente sobre este cliente"). */
export function abrirAssistenteSobre(contato: { id: number; nome: string }) {
  conversa.contato = contato;
  urbiVerso.navegarSub('/assistente');
}

@customElement('pc-tela-assistente')
export class PcTelaAssistente extends LitElement {
  @state() private versao = 0;
  @state() private pensando = false;

  // Réplica local do contrato `:host` de tela (ui.md § Cadeia de altura): o chat, filho direto,
  // preenche a altura com `expandir`; nenhum CSS de layout além disso.
  static styles = css`
    :host { display: flex; flex-direction: column; height: 100%; min-height: 0; overflow: hidden; }
  `;

  private atualizar() {
    this.versao++;
  }

  private meuId() {
    return urbiVerso.usuario()?.id ?? 0;
  }

  private anotar(autorId: number, texto: string, bruto = texto) {
    conversa.mensagens = [
      ...conversa.mensagens,
      { id: ++conversa.seq, autorId, autorNome: autorId === ASSISTENTE ? 'Assistente' : (urbiVerso.usuario()?.nome ?? 'Você'), texto, bruto, criadoEm: new Date().toISOString() },
    ];
    this.atualizar();
  }

  /** `aoEnviar` do chat: o composer fica travado até a resposta, então nada se perde. */
  private async perguntar(pergunta: string) {
    const p = pergunta.trim();
    if (!p) return;
    const historico = conversa.mensagens.slice(-6).map((m) => ({ autor: m.autorId === ASSISTENTE ? 'assistente' : 'eu', texto: m.bruto }));
    this.anotar(this.meuId(), p);
    this.pensando = true;
    conversa.proposta = null;
    conversa.irPara = null;
    try {
      const r = (await enviar('POST', '/assistente/perguntar', {
        pergunta: p,
        tela: conversa.telaAnterior,
        historico,
        ...(conversa.contato ? { contato_id: conversa.contato.id } : {}),
      })) as Resposta;
      const fontes = r.artigos.length
        ? `\n\n**Na ajuda:** ${r.artigos.map((a) => (a.secao && a.secao !== a.titulo ? `${a.titulo} › ${a.secao}` : a.titulo)).join(' · ')} — [abrir a documentação](${URL_DOCS})`
        : '';
      this.anotar(ASSISTENTE, `${r.resposta}${fontes}`, r.resposta);
      conversa.proposta = r.acao;
      conversa.irPara = r.tela && r.tela.sub !== '/assistente' ? r.tela : null;
    } catch (e) {
      this.anotar(ASSISTENTE, `Não consegui responder: ${mensagemDeErro(e)}`);
    } finally {
      this.pensando = false;
      this.atualizar();
    }
  }

  private async confirmar() {
    const p = conversa.proposta;
    if (!p) return;
    conversa.proposta = null;
    this.atualizar();
    try {
      await enviar('POST', p.rota, p.corpo);
      this.anotar(ASSISTENTE, `Feito: ${p.resumo}`);
      urbiVerso.notificar('Feito.', 'sucesso');
    } catch (e) {
      this.anotar(ASSISTENTE, `Não deu para fazer: ${mensagemDeErro(e)}`);
    }
  }

  private recusar() {
    conversa.proposta = null;
    this.anotar(ASSISTENTE, 'Combinado, não fiz nada.');
  }

  private limparContato() {
    conversa.contato = null;
    this.atualizar();
  }

  render() {
    const { proposta, irPara, contato } = conversa;
    return html`
      ${contato
        ? html`<urbi-linha quebrar>
            <urbi-badge>Sobre: ${contato.nome}</urbi-badge>
            <urbi-botao variante="texto" pequeno @click=${() => this.limparContato()}>Tirar</urbi-botao>
          </urbi-linha>`
        : ''}
      ${proposta
        ? html`<urbi-card titulo="Posso fazer isto?" icone="fa-solid fa-circle-question">
            <urbi-prosa>${proposta.resumo}</urbi-prosa>
            <urbi-linha>
              <urbi-botao icone="fa-solid fa-check" @click=${() => this.confirmar()}>Confirmar</urbi-botao>
              <urbi-botao variante="secundario" @click=${() => this.recusar()}>Agora não</urbi-botao>
            </urbi-linha>
          </urbi-card>`
        : ''}
      ${irPara
        ? html`<urbi-linha><urbi-botao variante="secundario" pequeno icone="fa-solid fa-arrow-right" href=${urbiVerso.href(irPara.sub)}>Abrir ${irPara.nome}</urbi-botao></urbi-linha>`
        : ''}
      <urbi-chat
        expandir
        .itens=${conversa.mensagens}
        .usuarioAtualId=${this.meuId()}
        markdown
        audio
        chave-audio="portal_corretor:assistente"
        placeholder=${this.pensando ? 'Pensando…' : 'Pergunte sobre o app, um cliente ou peça um lembrete'}
        .aoEnviar=${(d: { texto: string }) => this.perguntar(d.texto)}
      ></urbi-chat>
    `;
  }
}
