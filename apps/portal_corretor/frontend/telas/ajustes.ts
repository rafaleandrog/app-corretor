import { LitElement, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { keyed } from 'lit/directives/keyed.js';
import type { UrbiVersoAPI } from '@urbiverso/sdk';
import { ABAS_AJUSTES, ABA_PADRAO, abaDoEndereco, ehAbaAjustes, type AbaAjustes } from '../../comum/ajustes';
import { avisoCreci, chamarApi, chamarFetch } from '../apoio.js';
import { estadoTela } from '../estados.js';
import { moldura } from '../moldura.js';
import { abrirAssistente } from './assistente.js';
import './conta.js';
import './marca.js';
import './conexoes.js';
import './funil-ajustes.js';

declare const urbiVerso: UrbiVersoAPI;

/** `/conta/` e `/conta` são o mesmo endereço. */
const subAtual = () => urbiVerso.subRota().replace(/(.)\/+$/, '$1') || '/';

/** A seção do endereço que está na barra agora (apelido no caminho ou `?aba=`). */
export const abaAtual = (): AbaAjustes => abaDoEndereco(subAtual(), window.location.search) ?? ABA_PADRAO;

/** Ajuda curta da coluna da direita, por seção (spec 11.1 P11–P13: "por que conectar aqui"). */
const AJUDA: Record<AbaAjustes, { titulo: string; texto: string }> = {
  mensageiro: {
    titulo: 'O que é o Mensageiro',
    texto: 'O assistente que vai atender os seus clientes no WhatsApp, com as regras que você definir. Ele chega quando a conexão com o WhatsApp existir.',
  },
  negociador: {
    titulo: 'O que é o Negociador',
    texto: 'O assistente que conduz propostas e contrapropostas dentro do mandato de cada negociação. Os ajustes dele (quando entra, estilo, instruções) chegam numa versão seguinte; o mandato de cada negociação já fica em Clientes › Negociações.',
  },
  conexoes: {
    titulo: 'Por que conectar aqui',
    texto: 'Com o Instagram conectado, o Estúdio publica e agenda os posts por você. A conexão é da sua conta: ninguém de outra conta usa nem vê, e você pode desconectar quando quiser.',
  },
  conta: {
    titulo: 'Para que servem estes dados',
    texto: 'O seu nome, o telefone e a marca aparecem na sua página, nas seleções, no portal do cliente e nas artes do Estúdio. O CRECI é opcional: com ele, os anúncios o mostram.',
  },
  funil: {
    titulo: 'Funil e abordagens',
    texto: 'As etapas do seu funil e a abordagem sugerida para cada etapa e temperatura. É daqui que saem a fila do dia e a mensagem sugerida na ficha do cliente.',
  },
  atendimento: {
    titulo: 'Horário de atendimento',
    texto: 'Os prazos que o app usa para dizer quando um cliente está parado, quanto tempo vale uma seleção enviada e quando lembrar de uma visita.',
  },
  privacidade: {
    titulo: 'Seus dados e os dos clientes',
    texto: 'Os dados dos seus clientes são só da sua conta. O portal do cliente não mostra nome, telefone nem e-mail, e nenhum outro corretor vê nada do que é seu.',
  },
};

function conteudo(aba: AbaAjustes) {
  switch (aba) {
    case 'mensageiro':
      return estadoTela('vazio', {
        icone: 'fa-solid fa-lock',
        mensagem: 'O Mensageiro chega com a conexão do WhatsApp',
        submensagem: 'Ainda não há nada para configurar aqui. Quando o WhatsApp estiver disponível, esta seção traz o que ele faz sozinho e o que pergunta antes.',
      });
    case 'negociador':
      return estadoTela('vazio', {
        icone: 'fa-solid fa-scale-balanced',
        mensagem: 'Em breve',
        submensagem: 'Os ajustes do Negociador chegam numa versão seguinte. Até lá, ele usa os padrões, e o mandato de cada negociação fica em Clientes › Negociações.',
      });
    case 'conexoes':
      return html`<pc-tela-conexoes></pc-tela-conexoes>`;
    case 'conta':
      return html`<urbi-stack><pc-tela-conta parte="conta"></pc-tela-conta><pc-tela-marca></pc-tela-marca></urbi-stack>`;
    case 'funil':
      return html`<pc-tela-funil-ajustes></pc-tela-funil-ajustes>`;
    case 'atendimento':
      return html`<pc-tela-conta parte="atendimento"></pc-tela-conta>`;
    case 'privacidade':
      return html`<pc-ajustes-privacidade></pc-ajustes-privacidade>`;
  }
}

/**
 * Ajustes na moldura do Padrão B (B8, spec 11.1 P11–P13): as seções viram o menu da esquerda, o
 * conteúdo da seção fica no centro e a ajuda curta, a caixa do Assistente e (em Conta e marca) o aviso
 * do CRECI à direita. A seção fica em `?aba=` por `replaceState` (refletir estado não é navegar: sem
 * popstate, overview.md) e `atualizar` redesenha o app; os apelidos antigos (`/conta`, `/ajustes/<seção>`,
 * `?aba=marca`) continuam abrindo a seção certa, e `/ajustes/conexoes` segue sendo o retorno do Instagram.
 * Só a seção aberta é montada: cada uma carrega o que é dela ao aparecer.
 */
export function renderAjustes(atualizar: () => void) {
  const aba = abaAtual();
  const escolher = (id: string) => {
    if (!ehAbaAjustes(id) || id === aba) return;
    window.history.replaceState(window.history.state, '', `${urbiVerso.href('/ajustes')}?aba=${id}`);
    atualizar();
  };
  const lista = html`<urbi-stack>
    <urbi-prosa papel="titulo">Ajustes</urbi-prosa>
    <urbi-lista clicavel separador .itens=${ABAS_AJUSTES}
      .itemAtivo=${(s: (typeof ABAS_AJUSTES)[number]) => s.id === aba}
      .indicador=${(s: (typeof ABAS_AJUSTES)[number]) => (s.id === aba ? 'var(--cor-primaria)' : '')}
      .render_item=${(s: (typeof ABAS_AJUSTES)[number]) => html`<urbi-linha><urbi-icone classe=${s.icone}></urbi-icone><urbi-prosa>${s.label}</urbi-prosa></urbi-linha>`}
      @urbi:lista-click=${(e: CustomEvent) => escolher(String(e.detail.item?.id))}></urbi-lista>
  </urbi-stack>`;
  const ajuda = AJUDA[aba];
  const contexto = html`<urbi-stack>
    <urbi-card titulo=${ajuda.titulo} icone="fa-solid fa-circle-info"><urbi-prosa papel="secundario">${ajuda.texto}</urbi-prosa></urbi-card>
    ${aba === 'conta' ? html`<pc-ajustes-aviso-creci></pc-ajustes-aviso-creci>` : nothing}
    <urbi-card titulo="Assistente" icone="fa-solid fa-comments">
      <urbi-prosa papel="secundario">Ficou com dúvida sobre esta seção? Pergunte ao Assistente: ele conhece a ajuda do app.</urbi-prosa>
      <urbi-linha><urbi-botao pequeno variante="secundario" icone="fa-solid fa-comments" @click=${() => abrirAssistente()}>Perguntar ao Assistente</urbi-botao></urbi-linha>
    </urbi-card>
  </urbi-stack>`;
  // Trocar de seção recria o centro: nada da anterior fica na tela.
  return moldura(
    { menu: '/ajustes', lista, centro: keyed(aba, conteudo(aba)), contexto, rotulos: { lista: 'Seções', centro: 'Ajustes', contexto: 'Ajuda' } },
    atualizar,
  );
}

/** Aviso do CRECI (D-93, C1) na direita de Conta e marca: só quando nem o seu nem o jurídico existem. */
@customElement('pc-ajustes-aviso-creci')
export class PcAjustesAvisoCreci extends LitElement {
  @state() private semCreci = false;

  connectedCallback() {
    super.connectedCallback();
    void chamarApi('/conta').then(
      (c) => (this.semCreci = !c?.meu_perfil?.creci && !c?.perfil?.creci_juridico),
      // Sem a conta, nada a avisar: o centro mostra a falha.
      () => (this.semCreci = false),
    );
  }

  render() {
    return this.semCreci ? avisoCreci() : nothing;
  }
}

/**
 * Privacidade (P11): o que já existe, com os atalhos. O consentimento é de cada cliente (na ficha) e a
 * exportação é a planilha dos contatos da conta (`GET /contatos/exportar`).
 */
@customElement('pc-ajustes-privacidade')
export class PcAjustesPrivacidade extends LitElement {
  @state() private exportando = false;

  private async exportar() {
    this.exportando = true;
    try {
      const r = await chamarFetch('/contatos/exportar');
      if (!r.ok) throw new Error('A exportação falhou.');
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = 'contatos.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      await urbiVerso.alertar({ titulo: 'Não foi possível exportar', mensagem: (e as Error).message, tipo: 'erro' });
    } finally {
      this.exportando = false;
    }
  }

  render() {
    return html`<urbi-stack>
      <urbi-card titulo="Consentimento dos clientes" icone="fa-solid fa-handshake-simple">
        <urbi-prosa papel="secundario">Cada cliente diz se aceita receber mensagens suas e do atendimento automático. Você registra ou revoga isso na ficha dele, no cartão Cadastro (aba Resumo).</urbi-prosa>
        <urbi-linha><urbi-botao pequeno variante="secundario" icone="fa-solid fa-address-book" href=${urbiVerso.href('/clientes')}>Abrir Clientes</urbi-botao></urbi-linha>
      </urbi-card>
      <urbi-card titulo="Exportar os seus contatos" icone="fa-solid fa-file-export">
        <urbi-prosa papel="secundario">Baixa a planilha com os contatos da sua conta. Para tirar um contato da lista, use Remover na ficha dele: o histórico fica guardado.</urbi-prosa>
        <urbi-linha><urbi-botao pequeno variante="secundario" icone="fa-solid fa-file-export" ?carregando=${this.exportando} @click=${() => void this.exportar()}>Exportar contatos</urbi-botao></urbi-linha>
      </urbi-card>
    </urbi-stack>`;
  }
}
