import { html } from 'lit';
import type { UrbiVersoAPI } from '@urbiverso/sdk';
import { enviar, mensagemDeErro } from '../apoio';

declare const urbiVerso: UrbiVersoAPI;

// Assistente do Corretor (bloco 9, spec 10.2): tela própria no menu (D-76: o botão flutuante pediria
// CSS estrutural, que o contrato de UI proíbe). O conteúdo vai direto no body do `urbi-shell-page`,
// sem elemento intermediário, para o `urbi-chat [expandir]` preencher a tela também no celular
// (layout do `urbi-chat`). A conversa fica em memória enquanto o app está aberto.

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
/** Link absoluto: o markdown abre numa aba; link interno sem protocolo viraria evento sem ouvinte. */
const linkDocs = () => `${window.location.origin}${URL_DOCS}`;

/** Estado da conversa, fora do componente: sobrevive à troca de tela. */
const conversa = {
  mensagens: [] as Mensagem[],
  proposta: null as Proposta | null,
  irPara: null as { sub: string; nome: string } | null,
  contato: null as { id: number; nome: string } | null,
  /** Última tela do app antes do Assistente: vai como "tela atual" para puxar o artigo dela. */
  telaAnterior: '/',
  pensando: false,
  seq: 0,
  /** Redesenho do app (o `requestUpdate` do componente raiz), passado a cada render. */
  atualizar: () => {},
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

const meuId = () => urbiVerso.usuario()?.id ?? 0;

function anotar(autorId: number, texto: string, bruto = texto) {
  conversa.mensagens = [
    ...conversa.mensagens,
    { id: ++conversa.seq, autorId, autorNome: autorId === ASSISTENTE ? 'Assistente' : (urbiVerso.usuario()?.nome ?? 'Você'), texto, bruto, criadoEm: new Date().toISOString() },
  ];
  conversa.atualizar();
}

/** `aoEnviar` do chat: o composer fica travado até a resposta; outra pergunta em curso é recusada. */
async function perguntar(pergunta: string) {
  const p = pergunta.trim();
  if (!p) return;
  if (conversa.pensando) throw new Error('Aguarde a resposta anterior.');
  const historico = conversa.mensagens.slice(-6).map((m) => ({ autor: m.autorId === ASSISTENTE ? 'assistente' : 'eu', texto: m.bruto }));
  anotar(meuId(), p);
  conversa.pensando = true;
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
      ? `\n\n**Na ajuda:** ${r.artigos.map((a) => (a.secao && a.secao !== a.titulo ? `${a.titulo} › ${a.secao}` : a.titulo)).join(' · ')} — [abrir a documentação](${linkDocs()})`
      : '';
    conversa.proposta = r.acao;
    conversa.irPara = r.tela && r.tela.sub !== '/assistente' ? r.tela : null;
    anotar(ASSISTENTE, `${r.resposta}${fontes}`, r.resposta);
  } catch (e) {
    anotar(ASSISTENTE, `Não consegui responder: ${mensagemDeErro(e)}`);
  } finally {
    conversa.pensando = false;
    conversa.atualizar();
  }
}

async function confirmar() {
  const p = conversa.proposta;
  if (!p) return;
  conversa.proposta = null;
  conversa.atualizar();
  try {
    await enviar('POST', p.rota, p.corpo);
    anotar(ASSISTENTE, `Feito: ${p.resumo}`);
    urbiVerso.notificar('Feito.', 'sucesso');
  } catch (e) {
    anotar(ASSISTENTE, `Não deu para fazer: ${mensagemDeErro(e)}`);
  }
}

function recusar() {
  conversa.proposta = null;
  anotar(ASSISTENTE, 'Combinado, não fiz nada.');
}

/**
 * Conteúdo da tela, como irmãos de fluxo no body da página; o chat por último, com `expandir`.
 * `atualizar` redesenha o app quando a conversa muda.
 */
export function renderAssistente(atualizar: () => void) {
  conversa.atualizar = atualizar;
  const { proposta, irPara, contato } = conversa;
  return html`
    ${contato
      ? html`<urbi-linha quebrar>
          <urbi-badge>Sobre: ${contato.nome}</urbi-badge>
          <urbi-botao variante="texto" pequeno @click=${() => ((conversa.contato = null), atualizar())}>Tirar</urbi-botao>
        </urbi-linha>`
      : ''}
    ${proposta
      ? html`<urbi-card titulo="Posso fazer isto?" icone="fa-solid fa-circle-question">
          <urbi-prosa>${proposta.resumo}</urbi-prosa>
          <urbi-linha>
            <urbi-botao icone="fa-solid fa-check" @click=${() => confirmar()}>Confirmar</urbi-botao>
            <urbi-botao variante="secundario" @click=${() => recusar()}>Agora não</urbi-botao>
          </urbi-linha>
        </urbi-card>`
      : ''}
    ${irPara
      ? html`<urbi-linha><urbi-botao variante="secundario" pequeno icone="fa-solid fa-arrow-right" href=${urbiVerso.href(irPara.sub)}>Abrir ${irPara.nome}</urbi-botao></urbi-linha>`
      : ''}
    <urbi-chat
      expandir
      .itens=${conversa.mensagens}
      .usuarioAtualId=${meuId()}
      markdown
      audio
      chave-audio="portal_corretor:assistente"
      placeholder=${conversa.pensando ? 'Pensando…' : 'Pergunte sobre o app, um cliente ou peça um lembrete'}
      .aoEnviar=${(d: { texto: string }) => perguntar(d.texto)}
    ></urbi-chat>
  `;
}
