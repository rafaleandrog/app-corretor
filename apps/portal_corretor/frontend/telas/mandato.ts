import { LitElement, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { UrbiVersoAPI } from '@urbiverso/sdk';
import { corpoDoFormularioMandato, errosDoFormularioMandato as errosDoFormulario, type FormularioMandato } from '../../comum/negociacao';
import { chamarApi, data, enviar, mensagemDeErro } from '../apoio.js';

declare const urbiVerso: UrbiVersoAPI;

type Linha = Record<string, any>;

const reaisDe = (c: number | null | undefined) => (c ? (c / 100).toLocaleString('pt-BR') : '');
const hojeMais = (dias: number) => new Date(Date.now() + dias * 86400e3).toLocaleDateString('sv-SE');

/** O formulário a partir do mandato vigente, ou com os padrões (preço pedido do anúncio, 40%, 4 rodadas, 30 dias). */
export function formularioDe(atual: Linha | null, precoAnuncio_c: number | null): FormularioMandato {
  return {
    pedido: reaisDe(atual?.preco_pedido_c ?? precoAnuncio_c),
    alvo: reaisDe(atual?.alvo_c),
    recuo: reaisDe(atual?.recuo_c),
    batna: atual?.batna_vendedor ?? '',
    concessoes: ((atual?.concessoes ?? []) as Linha[]).map((c) => ({ item: c.item ?? '', limite: c.limite ?? '', contrapartida: c.contrapartida ?? '' })),
    passo_pct: String(Math.round(Number(atual?.passo_max_pct ?? 0.4) * 100)),
    rodadas: String(atual?.rodadas_max ?? 4),
    validade: atual?.validade ?? hojeMais(30),
    autonomia: atual?.autonomia ?? 'pergunta_antes',
    autorizacao: atual?.autorizacao_proprietario ?? null,
  };
}

// Mandato de negociação (P16), num `urbi-modal` (a gaveta do mockup é lacuna, pedido ao shell 10). Quatro
// blocos: valores, concessões, prazo e autonomia. O formulário confere enquanto se digita, pela mesma
// `validarMandato` da rota (recuo ≤ alvo ≤ pedido, faz sozinho só com a autorização), e a rota confere de
// novo ao salvar. Cada gravação é uma versão nova do mandato. "Quem negocia" troca na hora, pelas rotas
// /assumir e /devolver (um atendente por vez), à parte do salvar.
@customElement('pc-mandato-modal')
export class PcMandatoModal extends LitElement {
  @property({ type: Number }) negociacaoId = 0;
  @property({ type: Number }) imovelId = 0;
  @property({ attribute: false }) atual: Linha | null = null;
  /** Quem conduz agora (`ia`, `corretor` ou `humano`), lido do detalhe da negociação. */
  @property() conduzidaPor = 'ia';
  @property({ attribute: false }) aoFechar: (salvou: boolean) => void = () => {};
  @state() private f: FormularioMandato | null = null;
  @state() private salvando = false;
  @state() private conduz = 'ia';
  @state() private trocando = false;
  /** Documentos do imóvel (mídias tipo documento): a autorização por anexo escolhe um deles. */
  @state() private documentos: Linha[] | null = null;
  // Trocou quem negocia: fechar sem salvar ainda relê a negociação.
  private conduziu = false;

  connectedCallback() {
    super.connectedCallback();
    this.conduz = this.conduzidaPor;
    this.f = formularioDe(this.atual, null);
    void chamarApi(`/imoveis/${this.imovelId}`).then(
      (r) => {
        this.documentos = ((r?.midias ?? []) as Linha[]).filter((m) => m.tipo === 'documento');
        // Sem mandato: o preço pedido vem do anúncio.
        if (!this.atual && this.f && !this.f.pedido) this.f = { ...this.f, pedido: reaisDe(r?.imovel?.preco_c) };
      },
      () => (this.documentos = []),
    );
  }

  private fechar(salvou: boolean) {
    this.aoFechar(salvou || this.conduziu);
  }

  /** Negociador IA ou você: /devolver ou /assumir. Devolver exige o Negociador ligado nos ajustes. */
  private async trocarQuemNegocia(para: string) {
    if (para === this.conduz || this.trocando) return;
    const antes = this.conduz;
    this.conduz = para;
    this.trocando = true;
    try {
      await enviar('POST', `/negociacoes/${this.negociacaoId}/${para === 'corretor' ? 'assumir' : 'devolver'}`, {});
      this.conduziu = true;
      urbiVerso.notificar(para === 'corretor' ? 'Você passou a negociar.' : 'O Negociador IA passou a negociar.', 'sucesso');
    } catch (e) {
      this.conduz = antes;
      const desligado = (e as { codigo?: string }).codigo === 'NEGOCIADOR_DESLIGADO';
      await urbiVerso.alertar({
        titulo: desligado ? 'O Negociador está desligado' : 'Não foi possível trocar quem negocia',
        mensagem: desligado ? 'Ligue o Negociador nos ajustes dele para devolver a negociação a ele. Até lá, você negocia.' : mensagemDeErro(e),
        tipo: desligado ? 'alerta' : 'erro',
      });
    } finally {
      this.trocando = false;
    }
  }

  private mudar(m: Partial<FormularioMandato>) {
    this.f = { ...this.f!, ...m };
  }

  private concessao(i: number, campo: 'item' | 'limite' | 'contrapartida', valor: string) {
    this.mudar({ concessoes: this.f!.concessoes.map((c, j) => (j === i ? { ...c, [campo]: valor } : c)) });
  }

  private async registrarAutorizacao() {
    const v = await urbiVerso.formulario({
      titulo: 'Autorização do proprietário',
      mensagem: 'Registre a data em que o proprietário autorizou, por mensagem, o Negociador a fazer sozinho dentro desta faixa.',
      campos: [{ nome: 'data', tipo: 'data', rotulo: 'Autorizado em', obrigatorio: true, valor: new Date().toLocaleDateString('sv-SE') }],
      rotuloConfirmar: 'Registrar',
    });
    if (v?.data) this.mudar({ autorizacao: { tipo: 'mensagem', arquivo_id: null, data: String(v.data) } });
  }

  /** Anexo: um documento já anexado ao imóvel (`arquivo_id` = id da mídia); a rota confere que é dele. */
  private async anexarDocumento() {
    const docs = this.documentos ?? [];
    if (!docs.length) {
      await urbiVerso.alertar({
        titulo: 'Nenhum documento no imóvel',
        mensagem: 'O documento entra pela ficha do imóvel: Imóveis › ficha › Fotos e arquivos, como documento. Depois volte aqui e anexe.',
        tipo: 'alerta',
      });
      return;
    }
    const v = await urbiVerso.formulario({
      titulo: 'Autorização do proprietário',
      mensagem: 'Escolha o documento em que o proprietário autoriza o Negociador a fazer sozinho dentro desta faixa.',
      campos: [
        { nome: 'arquivo_id', tipo: 'selecao', rotulo: 'Documento', obrigatorio: true, valor: String(docs[0].id), opcoes: docs.map((d) => ({ valor: String(d.id), rotulo: this.nomeDoDocumento(d) })) },
        { nome: 'data', tipo: 'data', rotulo: 'Autorizado em', obrigatorio: true, valor: new Date().toLocaleDateString('sv-SE') },
      ],
      rotuloConfirmar: 'Anexar',
    });
    if (v?.arquivo_id && v.data) this.mudar({ autorizacao: { tipo: 'anexo', arquivo_id: Number(v.arquivo_id), data: String(v.data) } });
  }

  private nomeDoDocumento(d: Linha | undefined) {
    return d?.legenda || (d ? `documento ${d.id}` : 'documento do imóvel');
  }

  private textoDaAutorizacao(a: NonNullable<FormularioMandato['autorizacao']>) {
    const quando = data(`${a.data}T12:00:00`);
    if (a.tipo === 'mensagem') return `Autorização do proprietário registrada por mensagem em ${quando}.`;
    const doc = (this.documentos ?? []).find((d) => Number(d.id) === Number(a.arquivo_id));
    return `Autorizado por documento ${this.nomeDoDocumento(doc)} em ${quando}.`;
  }

  private async salvar() {
    if (errosDoFormulario(this.f!).length) return;
    this.salvando = true;
    try {
      await enviar('PUT', `/negociacoes/${this.negociacaoId}/mandato`, corpoDoFormularioMandato(this.f!));
      urbiVerso.notificar('Mandato salvo.', 'sucesso');
      this.aoFechar(true);
    } catch (e) {
      await urbiVerso.alertar({ titulo: 'O mandato não foi salvo', mensagem: mensagemDeErro(e), tipo: 'erro' });
    } finally {
      this.salvando = false;
    }
  }

  render() {
    const f = this.f;
    if (!f) return '';
    const erros = errosDoFormulario(f);
    const versao = this.atual?.versao ? ` · versão ${Number(this.atual.versao) + 1}` : '';
    const autonomias = [
      { valor: 'sugere', rotulo: 'Só sugere' },
      { valor: 'pergunta_antes', rotulo: 'Pergunta antes' },
      // Faz sozinho só aparece com a autorização do proprietário registrada (D-99).
      ...(f.autorizacao ? [{ valor: 'faz_sozinho', rotulo: 'Faz sozinho dentro da faixa' }] : []),
    ];
    return html`<urbi-modal title=${`Mandato de negociação${versao}`} maxWidth="760px" @urbi-modal:close=${() => this.fechar(false)}>
      <urbi-stack>
        <urbi-card titulo="1 · Valores" icone="fa-solid fa-sack-dollar">
          <urbi-linha quebrar>
            <urbi-input label="Preço pedido (R$)" valor=${f.pedido} @urbi:input-change=${(e: CustomEvent) => this.mudar({ pedido: e.detail.valor })}></urbi-input>
            <urbi-input label="Alvo (R$)" valor=${f.alvo} @urbi:input-change=${(e: CustomEvent) => this.mudar({ alvo: e.detail.valor })}></urbi-input>
            <urbi-input label="Ponto de recuo (R$)" valor=${f.recuo} @urbi:input-change=${(e: CustomEvent) => this.mudar({ recuo: e.detail.valor })}></urbi-input>
          </urbi-linha>
          <urbi-banner variante="alerta">O ponto de recuo e a BATNA são sigilosos: o cliente nunca os vê, e o Negociador nunca os revela.</urbi-banner>
          <urbi-textarea label="BATNA do vendedor (o que ele faz se não houver acordo)" rows="2" valor=${f.batna}
            placeholder="Ex.: manter anunciado 60 dias; proposta de R$ 1,35 mi de outro comprador"
            @urbi:input-change=${(e: CustomEvent) => this.mudar({ batna: e.detail.valor })}></urbi-textarea>
          <urbi-prosa papel="fraco">O ponto de recuo fica abaixo ou igual ao alvo, e o alvo abaixo ou igual ao preço pedido.</urbi-prosa>
        </urbi-card>
        <urbi-card titulo="2 · Concessões e contrapartidas" icone="fa-solid fa-right-left">
          ${f.concessoes.map(
            (c, i) => html`<urbi-linha quebrar alinhar="fim">
              <urbi-input label="Concessão" valor=${c.item} placeholder="prazo de entrega de 90 dias" @urbi:input-change=${(e: CustomEvent) => this.concessao(i, 'item', e.detail.valor)}></urbi-input>
              <urbi-input label="Até onde" valor=${c.limite} placeholder="até 90 dias" @urbi:input-change=${(e: CustomEvent) => this.concessao(i, 'limite', e.detail.valor)}></urbi-input>
              <urbi-input label="Em troca de" valor=${c.contrapartida} placeholder="entrada maior" @urbi:input-change=${(e: CustomEvent) => this.concessao(i, 'contrapartida', e.detail.valor)}></urbi-input>
              <urbi-botao pequeno variante="texto" icone="fa-solid fa-trash" ariaLabel="Tirar concessão"
                @click=${() => this.mudar({ concessoes: f.concessoes.filter((_, j) => j !== i) })}></urbi-botao>
            </urbi-linha>`,
          )}
          <urbi-botao pequeno variante="secundario" icone="fa-solid fa-plus"
            @click=${() => this.mudar({ concessoes: [...f.concessoes, { item: '', limite: '', contrapartida: '' }] })}>Adicionar concessão</urbi-botao>
          <urbi-linha quebrar>
            <urbi-input label="Passo máximo por rodada (%)" tipo="number" valor=${f.passo_pct} @urbi:input-change=${(e: CustomEvent) => this.mudar({ passo_pct: e.detail.valor })}></urbi-input>
            <urbi-input label="Rodadas no máximo" tipo="number" valor=${f.rodadas} @urbi:input-change=${(e: CustomEvent) => this.mudar({ rodadas: e.detail.valor })}></urbi-input>
          </urbi-linha>
          <urbi-prosa papel="fraco">O passo é a parte do que ainda falta até o recuo que se pode ceder numa rodada (40% é o padrão); cada concessão pede algo em troca.</urbi-prosa>
        </urbi-card>
        <urbi-card titulo="3 · Prazo" icone="fa-solid fa-calendar">
          <urbi-input-data label="Mandato válido até" valor=${f.validade} @urbi:input-data-change=${(e: CustomEvent) => this.mudar({ validade: e.detail.valor })}></urbi-input-data>
          <urbi-prosa papel="fraco">Depois dessa data o Negociador não age e passa a negociação a você.</urbi-prosa>
        </urbi-card>
        <urbi-card titulo="4 · Quem negocia e autonomia" icone="fa-solid fa-robot">
          ${this.conduz === 'humano'
            ? html`<urbi-prosa>Quem negocia: o negociador da sua equipe.</urbi-prosa>`
            : html`<urbi-select label="Quem negocia" valor=${this.conduz} ?desabilitado=${this.trocando}
                .opcoes=${[{ valor: 'ia', rotulo: 'Negociador IA' }, { valor: 'corretor', rotulo: 'Você (corretor)' }]}
                @urbi:select-change=${(e: CustomEvent) => void this.trocarQuemNegocia(e.detail.valor)}></urbi-select>`}
          <urbi-prosa papel="fraco">Uma pessoa da sua equipe como negociador só existe em contas com vários usuários. Trocar aqui vale na hora, sem salvar.</urbi-prosa>
          <urbi-select label="O Negociador" valor=${f.autonomia} .opcoes=${autonomias}
            @urbi:select-change=${(e: CustomEvent) => this.mudar({ autonomia: e.detail.valor })}></urbi-select>
          ${f.autorizacao
            ? html`<urbi-linha quebrar>
                <urbi-prosa>${this.textoDaAutorizacao(f.autorizacao)}</urbi-prosa>
                <urbi-botao pequeno variante="texto" @click=${() => this.mudar({ autorizacao: null, autonomia: f.autonomia === 'faz_sozinho' ? 'pergunta_antes' : f.autonomia })}>Tirar</urbi-botao>
              </urbi-linha>`
            : html`<urbi-prosa papel="fraco">"Faz sozinho" aparece quando a autorização do proprietário estiver registrada.</urbi-prosa>
                <urbi-linha quebrar>
                  <urbi-botao pequeno variante="secundario" icone="fa-solid fa-paperclip" ?desabilitado=${this.documentos === null} @click=${() => void this.anexarDocumento()}>Anexar documento</urbi-botao>
                  <urbi-botao pequeno variante="secundario" icone="fa-solid fa-message" @click=${() => void this.registrarAutorizacao()}>Registrar por mensagem</urbi-botao>
                </urbi-linha>`}
        </urbi-card>
        ${erros.length ? html`<urbi-banner variante="erro">${erros.join(' ')}</urbi-banner>` : ''}
        <urbi-linha justificar="fim" quebrar>
          <urbi-botao variante="texto" @click=${() => this.fechar(false)}>Cancelar</urbi-botao>
          <urbi-botao icone="fa-solid fa-check" ?desabilitado=${erros.length > 0} ?carregando=${this.salvando} @click=${() => void this.salvar()}>Salvar mandato</urbi-botao>
        </urbi-linha>
      </urbi-stack>
    </urbi-modal>`;
  }
}
