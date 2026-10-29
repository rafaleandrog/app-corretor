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
// novo ao salvar. Cada gravação é uma versão nova do mandato.
@customElement('pc-mandato-modal')
export class PcMandatoModal extends LitElement {
  @property({ type: Number }) negociacaoId = 0;
  @property({ type: Number }) imovelId = 0;
  @property({ attribute: false }) atual: Linha | null = null;
  @property({ attribute: false }) aoFechar: (salvou: boolean) => void = () => {};
  @state() private f: FormularioMandato | null = null;
  @state() private salvando = false;

  connectedCallback() {
    super.connectedCallback();
    if (this.atual) this.f = formularioDe(this.atual, null);
    else {
      // Sem mandato: o preço pedido vem do anúncio.
      this.f = formularioDe(null, null);
      void chamarApi(`/imoveis/${this.imovelId}`).then(
        (r) => this.f && !this.f.pedido && (this.f = { ...this.f, pedido: reaisDe(r?.imovel?.preco_c) }),
        () => undefined,
      );
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
    return html`<urbi-modal title=${`Mandato de negociação${versao}`} maxWidth="760px" @urbi-modal:close=${() => this.aoFechar(false)}>
      <urbi-stack>
        <urbi-card titulo="1 · Valores" icone="fa-solid fa-sack-dollar">
          <urbi-linha quebrar>
            <urbi-input label="Preço pedido (R$)" valor=${f.pedido} @urbi:input-change=${(e: CustomEvent) => this.mudar({ pedido: e.detail.valor })}></urbi-input>
            <urbi-input label="Alvo (R$)" valor=${f.alvo} @urbi:input-change=${(e: CustomEvent) => this.mudar({ alvo: e.detail.valor })}></urbi-input>
            <urbi-input label="Ponto de recuo (R$)" tipo="password" revelavel valor=${f.recuo} @urbi:input-change=${(e: CustomEvent) => this.mudar({ recuo: e.detail.valor })}></urbi-input>
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
        <urbi-card titulo="4 · Autonomia" icone="fa-solid fa-robot">
          <urbi-select label="O Negociador" valor=${f.autonomia} .opcoes=${autonomias}
            @urbi:select-change=${(e: CustomEvent) => this.mudar({ autonomia: e.detail.valor })}></urbi-select>
          ${f.autorizacao
            ? html`<urbi-linha quebrar>
                <urbi-prosa>Autorização do proprietário registrada por mensagem em ${data(`${f.autorizacao.data}T12:00:00`)}.</urbi-prosa>
                <urbi-botao pequeno variante="texto" @click=${() => this.mudar({ autorizacao: null, autonomia: f.autonomia === 'faz_sozinho' ? 'pergunta_antes' : f.autonomia })}>Tirar</urbi-botao>
              </urbi-linha>`
            : html`<urbi-prosa papel="fraco">"Faz sozinho" aparece quando a autorização do proprietário estiver registrada.</urbi-prosa>
                <urbi-botao pequeno variante="secundario" icone="fa-solid fa-message" @click=${() => void this.registrarAutorizacao()}>Registrar por mensagem</urbi-botao>`}
        </urbi-card>
        ${erros.length ? html`<urbi-banner variante="erro">${erros.join(' ')}</urbi-banner>` : ''}
        <urbi-linha justificar="fim" quebrar>
          <urbi-botao variante="texto" @click=${() => this.aoFechar(false)}>Cancelar</urbi-botao>
          <urbi-botao icone="fa-solid fa-check" ?desabilitado=${erros.length > 0} ?carregando=${this.salvando} @click=${() => void this.salvar()}>Salvar mandato</urbi-botao>
        </urbi-linha>
      </urbi-stack>
    </urbi-modal>`;
  }
}
