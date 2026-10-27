import { LitElement, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { CampoFormulario, UrbiVersoAPI } from '@urbiverso/sdk';
import { chamarApi, data, enviar, mensagemDeErro } from '../apoio';

declare const urbiVerso: UrbiVersoAPI;

type Linha = Record<string, any>;
const ROTULO_REACAO: Record<string, string> = { gostei: 'gostou', nao_gostei: 'não gostou', quero_visitar: 'quer visitar' };
const COR_REACAO: Record<string, string> = { gostei: 'sucesso', nao_gostei: 'erro', quero_visitar: 'info' };
const MAX_ITENS = 12;

/** Link completo: sem URL pública configurada na instância, o backend devolve o caminho. */
const completo = (link: string) => (link.startsWith('/') ? `${window.location.origin}${link}` : link);

// Na ficha do cliente (bloco 5b): seleções enviadas com as reações, o link do portal do cliente e,
// desde o bloco 9, "o que falta do cliente" (pendências que ele marca como feitas no portal).
// Dispara `mudou` para a ficha recarregar o histórico de envios e a linha do tempo.
@customElement('pc-selecoes-cliente')
export class PcSelecoesCliente extends LitElement {
  @property({ type: Number }) contatoId = 0;
  @property() nome = '';
  @state() private selecoes: Linha[] = [];
  @state() private portal: { ativo: boolean; link: string | null } | null = null;
  @state() private tarefas: Linha[] = [];
  @state() private falha: string | null = null;
  @state() private ocupado = false;

  connectedCallback() {
    super.connectedCallback();
    void this.carregar();
  }

  // A ficha pode reaproveitar o elemento ao trocar de cliente: recarrega com o novo.
  updated(mudou: Map<string, unknown>) {
    if (mudou.has('contatoId') && mudou.get('contatoId') !== undefined) void this.carregar();
  }

  private pedido = 0;

  private async carregar() {
    this.falha = null;
    // Troca rápida de cliente: só a resposta do último pedido vale.
    const meu = ++this.pedido;
    try {
      const [s, p, t] = await Promise.all([
        chamarApi(`/selecoes?contato_id=${this.contatoId}`),
        chamarApi(`/contatos/${this.contatoId}/portal`),
        chamarApi(`/contatos/${this.contatoId}/tarefas-cliente`),
      ]);
      if (meu !== this.pedido) return;
      this.selecoes = s.dados;
      this.portal = p;
      this.tarefas = t.dados;
    } catch (e) {
      if (meu === this.pedido) this.falha = (e as Error).message;
    }
  }

  private mudou() {
    this.dispatchEvent(new CustomEvent('mudou', { bubbles: true, composed: true }));
  }

  /** Copia a mensagem pronta; sem permissão de área de transferência, mostra para copiar à mão. */
  private async copiar(texto: string, sucesso: string) {
    try {
      await navigator.clipboard.writeText(texto);
      urbiVerso.notificar(sucesso, 'sucesso');
    } catch {
      await urbiVerso.alertar({ titulo: 'Mensagem pronta para colar', mensagem: texto, tipo: 'sucesso' });
    }
  }

  private primeiroNome() {
    return this.nome.split(' ')[0] || '';
  }

  private async nova() {
    let anunciaveis: Linha[] = [];
    try {
      // Só ativos e reservados, todas as páginas (a lista vem de 50 em 50).
      for (const situacao of ['ativo', 'reservado']) {
        for (let pagina = 1; pagina <= 20; pagina++) {
          const r = await chamarApi(`/imoveis?situacao=${situacao}&pagina=${pagina}`);
          anunciaveis.push(...(r.dados ?? []).filter((i: Linha) => i.autorizacao_vigente));
          if (pagina >= (r.paginas ?? 1)) break;
        }
      }
    } catch (e) {
      await urbiVerso.alertar({ titulo: 'Não foi possível carregar os imóveis', mensagem: mensagemDeErro(e), tipo: 'erro' });
      return;
    }
    if (!anunciaveis.length) {
      await urbiVerso.alertar({ titulo: 'Nenhum imóvel para enviar', mensagem: 'Só vão na seleção imóveis ativos ou reservados, com autorização de venda vigente.', tipo: 'alerta' });
      return;
    }
    const campos: CampoFormulario[] = [
      { nome: 'titulo', tipo: 'texto', rotulo: 'Título', obrigatorio: true, valor: 'Imóveis para você' },
      { nome: 'mensagem', tipo: 'texto_longo', rotulo: 'Mensagem (opcional)', placeholder: 'Separei estes imóveis pelo que conversamos.' },
      ...anunciaveis.map((i): CampoFormulario => ({ nome: `im_${i.id}`, tipo: 'booleano', rotulo: `${i.codigo} · ${i.titulo ?? i.tipo}${i.bairro ? ` · ${i.bairro}` : ''}` })),
    ];
    const v = await urbiVerso.formulario({ titulo: 'Nova seleção', campos, mensagem: `Escolha até ${MAX_ITENS} imóveis. O cliente abre pelo link, sem login, e diz o que achou de cada um.`, rotuloConfirmar: 'Criar e enviar' });
    if (!v) return;
    const ids = Object.entries(v).filter(([k, x]) => k.startsWith('im_') && x === true).map(([k]) => Number(k.slice(3)));
    if (!ids.length || ids.length > MAX_ITENS) {
      await urbiVerso.alertar({ titulo: 'Confira os imóveis', mensagem: `Escolha de 1 a ${MAX_ITENS} imóveis.`, tipo: 'alerta' });
      return;
    }
    this.ocupado = true;
    try {
      const r = await enviar('POST', '/selecoes', { contato_id: this.contatoId, titulo: v.titulo, mensagem: v.mensagem, imovel_ids: ids });
      await this.carregar();
      this.mudou();
      await this.copiar(this.mensagemSelecao(r.link, ids.length), 'Seleção criada. A mensagem com o link foi copiada: é só colar no WhatsApp.');
    } catch (e) {
      await urbiVerso.alertar({ titulo: 'Não foi possível criar', mensagem: mensagemDeErro(e), tipo: 'erro' });
    } finally {
      this.ocupado = false;
    }
  }

  private mensagemSelecao(link: string, n: number) {
    return `Olá, ${this.primeiroNome()}! Separei ${n} imóve${n > 1 ? 'is' : 'l'} para você. Abra e me diga o que achou de cada um: ${completo(link)}`;
  }

  private async revogar(s: Linha) {
    const ok = await urbiVerso.confirmar({ titulo: 'Revogar seleção', mensagem: 'O link deixa de abrir e o cliente não consegue mais reagir.', rotuloConfirmar: 'Revogar', perigo: true });
    if (!ok) return;
    try {
      await enviar('PATCH', `/selecoes/${s.id}/revogar`);
      urbiVerso.notificar('Seleção revogada.', 'sucesso');
      await this.carregar();
    } catch (e) {
      await urbiVerso.alertar({ titulo: 'Não foi possível revogar', mensagem: mensagemDeErro(e), tipo: 'erro' });
    }
  }

  private async gerarPortal() {
    this.ocupado = true;
    try {
      const r = await enviar('POST', `/contatos/${this.contatoId}/portal`);
      await this.carregar();
      if (r.novo) this.mudou();
      await this.copiar(
        `Olá, ${this.primeiroNome()}! Este é o seu portal: os imóveis que separei para você, as visitas marcadas e um espaço para falar comigo. ${completo(r.link)}`,
        'Link do portal copiado: é só colar no WhatsApp.',
      );
    } catch (e) {
      await urbiVerso.alertar({ titulo: 'Não foi possível gerar', mensagem: mensagemDeErro(e), tipo: 'erro' });
    } finally {
      this.ocupado = false;
    }
  }

  private async revogarPortal() {
    const ok = await urbiVerso.confirmar({ titulo: 'Revogar o portal', mensagem: 'O link atual deixa de abrir. Você pode gerar um novo depois.', rotuloConfirmar: 'Revogar', perigo: true });
    if (!ok) return;
    try {
      await enviar('PATCH', `/contatos/${this.contatoId}/portal/revogar`);
      urbiVerso.notificar('Portal revogado.', 'sucesso');
      await this.carregar();
    } catch (e) {
      await urbiVerso.alertar({ titulo: 'Não foi possível revogar', mensagem: mensagemDeErro(e), tipo: 'erro' });
    }
  }

  private async novaTarefa() {
    const v = await urbiVerso.formulario({
      titulo: 'Pedir ao cliente',
      mensagem: 'Aparece no portal em "O que falta de você". Quando o cliente marcar como feito, você vê aqui e na linha do tempo.',
      campos: [{ nome: 'texto', tipo: 'texto', rotulo: 'O que falta', obrigatorio: true, placeholder: 'Ex.: enviar a documentação' }],
      rotuloConfirmar: 'Pedir',
    });
    if (!v) return;
    try {
      await enviar('POST', `/contatos/${this.contatoId}/tarefas-cliente`, { texto: v.texto });
      await this.carregar();
      this.mudou();
    } catch (e) {
      await urbiVerso.alertar({ titulo: 'Não foi possível pedir', mensagem: mensagemDeErro(e), tipo: 'erro' });
    }
  }

  private async removerTarefa(t: Linha) {
    const ok = await urbiVerso.confirmar({ titulo: 'Remover pendência', mensagem: `"${t.texto}" sai do portal do cliente.`, rotuloConfirmar: 'Remover', perigo: true });
    if (!ok) return;
    try {
      await enviar('PATCH', `/tarefas-cliente/${t.id}/remover`);
      await this.carregar();
    } catch (e) {
      await urbiVerso.alertar({ titulo: 'Não foi possível remover', mensagem: mensagemDeErro(e), tipo: 'erro' });
    }
  }

  private selecao(s: Linha) {
    const situacao = s.revogada_em ? { cor: 'padrao', rotulo: 'revogada' } : s.valida ? { cor: 'sucesso', rotulo: `vale até ${data(s.expira_em)}` } : { cor: 'alerta', rotulo: 'vencida' };
    return html`<urbi-stack>
      <urbi-linha quebrar>
        <urbi-prosa>${s.titulo}</urbi-prosa>
        <urbi-badge cor=${situacao.cor}>${situacao.rotulo}</urbi-badge>
        ${s.valida && s.link
          ? html`<urbi-botao variante="fantasma" pequeno icone="fa-solid fa-copy" ariaLabel="Copiar mensagem com o link" title="Copiar mensagem com o link" @click=${() => this.copiar(this.mensagemSelecao(s.link, s.itens.length), 'Mensagem copiada.')}></urbi-botao>
              <urbi-botao variante="fantasma" pequeno icone="fa-solid fa-ban" ariaLabel="Revogar seleção" title="Revogar" @click=${() => this.revogar(s)}></urbi-botao>`
          : ''}
      </urbi-linha>
      <urbi-prosa papel="fraco">Enviada em ${data(s.enviada_em)}</urbi-prosa>
      <urbi-linha quebrar>
        ${s.itens.map((i: Linha) => html`<urbi-badge cor=${i.reacao ? COR_REACAO[i.reacao] : 'padrao'}>${i.imovel_codigo ?? `#${i.imovel_id}`}${i.reacao ? ` · ${ROTULO_REACAO[i.reacao]}` : ''}</urbi-badge>`)}
      </urbi-linha>
    </urbi-stack>`;
  }

  private abertas() {
    return this.tarefas.filter((t) => !t.feita_em);
  }

  render() {
    if (this.falha) {
      return html`<urbi-card titulo="Seleções e portal" icone="fa-solid fa-heart"><urbi-banner variante="erro">${this.falha}<urbi-botao slot="acao" pequeno variante="secundario" @click=${() => this.carregar()}>Tentar de novo</urbi-botao></urbi-banner></urbi-card>`;
    }
    return html`<urbi-card titulo="Seleções e portal" icone="fa-solid fa-heart">
      <span slot="acoes"><urbi-botao variante="fantasma" pequeno icone="fa-solid fa-plus" ariaLabel="Nova seleção" title="Nova seleção" ?carregando=${this.ocupado} @click=${() => this.nova()}></urbi-botao></span>
      ${this.selecoes.length
        ? this.selecoes.map((s) => this.selecao(s))
        : html`<urbi-prosa papel="dica">Monte uma seleção de imóveis (+): o cliente abre pelo link, sem login, e diz se gostou, não gostou ou quer visitar.</urbi-prosa>`}
      <urbi-linha quebrar>
        <urbi-prosa>Portal do cliente:</urbi-prosa>
        ${this.portal?.ativo
          ? html`<urbi-badge cor="sucesso">ativo</urbi-badge>
              <urbi-botao pequeno variante="secundario" icone="fa-solid fa-copy" ?carregando=${this.ocupado} @click=${() => this.gerarPortal()}>Copiar link</urbi-botao>
              <urbi-botao pequeno variante="texto" @click=${() => this.revogarPortal()}>Revogar</urbi-botao>`
          : html`<urbi-botao pequeno variante="secundario" icone="fa-solid fa-link" ?carregando=${this.ocupado} @click=${() => this.gerarPortal()}>Gerar link do portal</urbi-botao>`}
      </urbi-linha>
      ${this.abertas().length ? html`<urbi-prosa papel="alerta">${this.abertas().length} pendência(s) do cliente: veja em "O que falta do cliente", abaixo.</urbi-prosa>` : ''}
      <div slot="detalhe"><urbi-stack>
      <urbi-prosa papel="dica">O portal mostra ao cliente o próximo passo que você escreveu para ele, as seleções válidas, as visitas marcadas, o que falta dele e um espaço para ele mandar mensagem ou pedir para remarcar.</urbi-prosa>
      <urbi-linha justificar="entre" quebrar>
        <urbi-prosa>O que falta do cliente:</urbi-prosa>
        <urbi-botao pequeno variante="secundario" icone="fa-solid fa-list-check" @click=${() => this.novaTarefa()}>Pedir ao cliente</urbi-botao>
      </urbi-linha>
      ${this.tarefas.length
        ? html`<urbi-lista separador .itens=${this.tarefas} .render_item=${(t: Linha) => html`<urbi-linha justificar="entre" quebrar>
              <urbi-prosa>${t.texto}</urbi-prosa>
              <urbi-linha>
                ${t.feita_em ? html`<urbi-badge cor="sucesso">feito em ${data(t.feita_em)}</urbi-badge>` : html`<urbi-badge cor="alerta">pendente</urbi-badge>`}
                <urbi-botao variante="fantasma" pequeno icone="fa-solid fa-trash" ariaLabel="Remover pendência" title="Remover" @click=${() => this.removerTarefa(t)}></urbi-botao>
              </urbi-linha>
            </urbi-linha>`}></urbi-lista>`
        : html`<urbi-prosa papel="fraco">Nada pedido. Ex.: "confirmar a visita", "enviar a documentação".</urbi-prosa>`}
      </urbi-stack></div>
    </urbi-card>`;
  }
}
