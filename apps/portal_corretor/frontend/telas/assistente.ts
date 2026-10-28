import { html, type TemplateResult } from 'lit';
import type { UrbiVersoAPI } from '@urbiverso/sdk';
import { chamarApi, enviar, mensagemDeErro } from '../apoio';
import { contatoDoEndereco } from '../enderecos';
import { estadoTela } from '../estados';

declare const urbiVerso: UrbiVersoAPI;

// Assistente do Corretor (bloco 9, spec 10.2). Abre na coluna de contexto, à direita, de qualquer
// tela (D-109, revê D-76): esquerda e centro ficam, e fechar devolve o contexto da tela. Sai do menu e
// vira botão do trilho; `/assistente` é apelido que abre Hoje com ele aberto. A conversa e o "aberto"
// ficam em memória, fora do componente: sobrevivem à troca de tela enquanto o app está aberto.

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
  /** Tela em que o corretor está: vai como "tela atual" para puxar o artigo dela. */
  telaAnterior: '/',
  /** Painel aberto na coluna de contexto. */
  aberto: false,
  /** Contato da ficha aberta (a ficha avisa ao carregar): o Assistente abre já sobre ele. */
  foco: null as { id: number; nome: string } | null,
  /** Slot `assistente` liberado (`GET /assistente/ia`); `null` enquanto a sonda não voltou. */
  ia: null as boolean | null,
  pensando: false,
  seq: 0,
  /** Redesenho do app (o `requestUpdate` do componente raiz), registrado por `aoMudarAssistente`. */
  atualizar: () => {},
};

/** O app avisa a tela em que o corretor está; `/assistente` é Hoje. */
export function lembrarTela(sub: string) {
  conversa.telaAnterior = sub === '/assistente' ? '/' : sub;
}

/** A ficha avisa o contato em foco, para o Assistente aberto nela já falar dele. */
export function lembrarContato(contato: { id: number; nome: string }) {
  conversa.foco = contato;
}

/** Contato da ficha aberta agora, se a ficha já avisou quem é. */
export function contatoEmFoco(): { id: number; nome: string } | null {
  const id = contatoDoEndereco(conversa.telaAnterior);
  return id !== null && conversa.foco?.id === id ? conversa.foco : null;
}

export const assistenteAberto = () => conversa.aberto;

/**
 * Sonda sem custo do slot, a cada abertura de `abrirAssistente`: uma falha passageira não fica presa, a próxima
 * abertura sonda de novo. Trocar de conta com o painel aberto não sonda de novo. Só a resposta mais recente vale.
 */
let sondaSeq = 0;
function sondarIa() {
  const minha = ++sondaSeq;
  chamarApi('/assistente/ia').then(
    (r) => minha === sondaSeq && ((conversa.ia = !!r?.assistente), conversa.atualizar()),
    () => minha === sondaSeq && ((conversa.ia = false), conversa.atualizar()),
  );
}

/** Abre na coluna de contexto, levando o contato da ficha aberta quando não há outro escolhido. */
export function abrirAssistente() {
  conversa.contato ??= contatoEmFoco();
  conversa.aberto = true;
  sondarIa();
  conversa.atualizar();
}

export function fecharAssistente() {
  conversa.aberto = false;
  conversa.atualizar();
}

export const alternarAssistente = () => (conversa.aberto ? fecharAssistente() : abrirAssistente());

/** Abre o Assistente sobre um contato (ficha do contato: "perguntar ao Assistente sobre este cliente"). */
export function abrirAssistenteSobre(contato: { id: number; nome: string }) {
  conversa.contato = contato;
  abrirAssistente();
}

/** Redesenho do app quando a conversa muda (o `requestUpdate` do componente raiz). */
export function aoMudarAssistente(atualizar: () => void) {
  conversa.atualizar = atualizar;
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
 * O painel da coluna de contexto (P05) em duas peças: `topo` (título com fechar, aviso de IA
 * indisponível, contato em foco, ação proposta) e `chat`, com `expandir`. O chat tem de ser filho
 * DIRETO do painel (ui-componentes-conteudo.md § Layout do chat): num hospedeiro ele perde o fill no
 * celular. Por isso a moldura põe o `topo` num hospedeiro (dono do respiro) e o chat solto no slot.
 */
export function painelAssistente(): { topo: TemplateResult; chat: TemplateResult } {
  const { proposta, irPara, contato } = conversa;
  const topo = html`
    <urbi-linha justificar="entre">
      <urbi-prosa papel="secao">Assistente</urbi-prosa>
      <urbi-botao variante="texto" pequeno icone="fa-solid fa-xmark" @click=${() => fecharAssistente()}>Fechar</urbi-botao>
    </urbi-linha>
    ${conversa.ia === false ? estadoTela('ia_indisponivel', { mensagem: 'IA indisponível agora: respondo com os artigos da ajuda do app.' }) : ''}
    ${contato
      ? html`<urbi-linha quebrar>
          <urbi-badge>Sobre: ${contato.nome}</urbi-badge>
          <urbi-botao variante="texto" pequeno @click=${() => ((conversa.contato = null), conversa.atualizar())}>Tirar</urbi-botao>
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
  `;
  const chat = html`<urbi-chat
      slot="direita"
      expandir
      .itens=${conversa.mensagens}
      .usuarioAtualId=${meuId()}
      markdown
      audio
      chave-audio="portal_corretor:assistente"
      placeholder=${conversa.pensando ? 'Pensando…' : 'Pergunte sobre o app, um cliente ou peça um lembrete'}
      .aoEnviar=${(d: { texto: string }) => perguntar(d.texto)}
    ></urbi-chat>`;
  return { topo, chat };
}
