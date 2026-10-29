import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { UrbiVersoAPI } from '@urbiverso/sdk';
import { AUTONOMIAS } from '../../comum/negociacao';
import { conferirValores, corpoDoMandato, mandatoEmBranco, mandatoParaFormulario, ROTULO_AUTONOMIA, type FormularioMandato } from '../../comum/negociacao-tela';
import { chamarApi, enviar, mensagemDeErro, subirArquivo } from '../apoio.js';
import { estadoDaFalha, estadoTela } from '../estados.js';

declare const urbiVerso: UrbiVersoAPI;

// Mandato de negociação (P16, spec 11.1; issue #102): até onde o Negociador pode ir. Abre em
// `urbi-modal`, no lugar da gaveta do mockup (lacuna do SDK 100, pedido ao shell 10; exceção
// registrada no A1). O seletor "Só sugere · Pergunta antes · Faz sozinho" é `urbi-select` até haver
// o seletor de três posições (lacuna 11.9, pedido 12); como o `urbi-select` não tem opção desabilitada,
// "Faz sozinho" só aparece com a autorização do proprietário registrada. Os valores sigilosos (recuo, alvo, BATNA)
// chegam só da rota do mandato, ficam neste formulário e nunca vão ao console.

const hojeLocal = () => new Date().toLocaleDateString('sv-SE');
const OPCOES_AUTONOMIA = AUTONOMIAS.map((a) => ({ valor: a, rotulo: ROTULO_AUTONOMIA[a][0].toUpperCase() + ROTULO_AUTONOMIA[a].slice(1) }));

@customElement('pc-mandato')
export class PcMandato extends LitElement {
  @property({ type: Number }) negociacaoId = 0;
  /** Nome do cliente e preço do anúncio (o pedido do mandato novo nasce com ele). */
  @property() cliente = '';
  @property({ attribute: false }) precoAnuncio_c: number | null = null;
  @property() conduzidaPor = 'ia';
  /** Imóvel da negociação: o documento da autorização vai para os arquivos dele (nunca público). */
  @property({ attribute: false }) imovelId: number | null = null;
  @property({ attribute: false }) aoFechar: (salvo: boolean) => void = () => {};
  @state() private f: FormularioMandato | null = null;
  @state() private versao = 0;
  @state() private falha: unknown = null;
  @state() private salvando = false;
  @state() private anexando = false;
  @state() private quem = 'ia';
  @state() private erro: string | null = null;

  connectedCallback() {
    super.connectedCallback();
    this.quem = this.conduzidaPor === 'corretor' ? 'corretor' : 'ia';
    void this.carregar();
  }

  private async carregar() {
    this.falha = null;
    try {
      const r = await chamarApi(`/negociacoes/${this.negociacaoId}/mandato`);
      this.versao = Number(r.vigente?.versao ?? 0);
      this.f = r.vigente ? mandatoParaFormulario(r.vigente) : mandatoEmBranco(this.precoAnuncio_c, hojeLocal());
    } catch (e) {
      this.falha = e;
    }
  }

  /** Muda um campo do formulário (cópia nova: o Lit redesenha). */
  private mudar(mudancas: Partial<FormularioMandato>) {
    this.f = { ...this.f!, ...mudancas };
    this.erro = null;
  }

  private mudarConcessao(i: number, campo: 'item' | 'limite' | 'contrapartida', valor: string) {
    const concessoes = this.f!.concessoes.map((c, j) => (j === i ? { ...c, [campo]: valor } : c));
    this.mudar({ concessoes });
  }

  /** Anexar documento: o PDF ou a foto da autorização vai como documento do imóvel (nunca público). */
  private async anexar(e: CustomEvent, imovelId: number | null) {
    const arquivo: File | null = e.detail?.arquivo ?? null;
    if (!arquivo || !imovelId) return;
    this.anexando = true;
    try {
      const upload_id = await subirArquivo('imovel_midias', 'arquivo', arquivo);
      const midia = await enviar('POST', `/imoveis/${imovelId}/midias`, { upload_id, tipo: 'documento', legenda: `Autorização do proprietário · ${this.cliente}`.slice(0, 200) });
      this.mudar({ autorizacao: { tipo: 'anexo', data: hojeLocal(), arquivo_id: Number(midia.id) } });
    } catch (falha) {
      await urbiVerso.alertar({ titulo: 'Não foi possível anexar', mensagem: mensagemDeErro(falha), tipo: 'erro' });
    } finally {
      this.anexando = false;
    }
  }

  private async salvar() {
    const f = this.f!;
    const valores = conferirValores({ pedido_c: corpoDoMandato(f).preco_pedido_c as number | null, alvo_c: corpoDoMandato(f).alvo_c as number | null, recuo_c: corpoDoMandato(f).recuo_c as number | null });
    if (!valores.ok) {
      this.erro = valores.texto;
      return;
    }
    if (f.autonomia === 'faz_sozinho' && !f.autorizacao) {
      this.erro = 'Para o Negociador fazer sozinho, registre a autorização do proprietário.';
      return;
    }
    this.salvando = true;
    try {
      await enviar('PUT', `/negociacoes/${this.negociacaoId}/mandato`, corpoDoMandato(f));
    } catch (e) {
      this.erro = mensagemDeErro(e);
      this.salvando = false;
      return;
    }
    // Quem negocia mora na negociação, não no mandato: só muda se o corretor trocou. O mandato já está
    // salvo; se a troca falhar (ex.: o Negociador desligado nos ajustes), avisa e fecha assim mesmo.
    const antes = this.conduzidaPor === 'corretor' ? 'corretor' : 'ia';
    if (this.quem !== antes) {
      try {
        await enviar('POST', `/negociacoes/${this.negociacaoId}/${this.quem === 'corretor' ? 'assumir' : 'devolver'}`);
      } catch (e) {
        await urbiVerso.alertar({ titulo: 'Mandato salvo, mas quem negocia não mudou', mensagem: mensagemDeErro(e), tipo: 'alerta' });
      }
    }
    urbiVerso.notificar('Mandato salvo.', 'sucesso');
    this.salvando = false;
    this.aoFechar(true);
  }

  private campoReais(rotulo: string, valor: string, mudar: (v: string) => void, dica: string) {
    return html`<urbi-stack>
      <urbi-input label=${rotulo} valor=${valor} placeholder="1.400.000" @urbi:input-change=${(e: CustomEvent) => mudar(String(e.detail.valor ?? ''))}></urbi-input>
      <urbi-prosa papel="dica">${dica}</urbi-prosa>
    </urbi-stack>`;
  }

  private blocos() {
    const f = this.f!;
    const corpo = corpoDoMandato(f);
    const valores = conferirValores({ pedido_c: corpo.preco_pedido_c as number | null, alvo_c: corpo.alvo_c as number | null, recuo_c: corpo.recuo_c as number | null });
    const autorizacao = f.autorizacao;
    return html`<urbi-stack>
      <urbi-card titulo="1 · Valores" icone="fa-solid fa-scale-balanced">
        <urbi-grid min="200px">
          ${this.campoReais('Preço pedido (R$)', f.pedido, (v) => this.mudar({ pedido: v }), 'Vem do anúncio; é o que o cliente já conhece.')}
          ${this.campoReais('Alvo (R$)', f.alvo, (v) => this.mudar({ alvo: v }), 'O valor que o proprietário quer alcançar.')}
          ${this.campoReais('Ponto de recuo (R$)', f.recuo, (v) => this.mudar({ recuo: v }), 'O mínimo aceito. O Negociador nunca oferece abaixo.')}
        </urbi-grid>
        <urbi-banner variante="erro" icone="fa-solid fa-lock">Recuo, alvo e BATNA são sigilosos: o cliente nunca vê.</urbi-banner>
        <urbi-textarea label="BATNA do vendedor" rows="2" valor=${f.batna} placeholder="Ex.: manter anunciado por 60 dias; proposta de R$ 1,35 mi de outro comprador"
          @urbi:input-change=${(e: CustomEvent) => this.mudar({ batna: String(e.detail.valor ?? '') })}></urbi-textarea>
        <urbi-prosa papel=${valores.ok ? 'sucesso' : 'alerta'}>${valores.texto}</urbi-prosa>
      </urbi-card>
      <urbi-card titulo="2 · Concessões e contrapartidas" icone="fa-solid fa-right-left">
        <urbi-prosa papel="dica">Cada concessão tem o que pedir em troca (ex.: prazo de entrega de 90 dias ↔ entrada maior).</urbi-prosa>
        ${f.concessoes.map(
          (c, i) => html`<urbi-linha quebrar>
            <urbi-input label="Concessão" valor=${c.item} placeholder="Prazo de entrega" @urbi:input-change=${(e: CustomEvent) => this.mudarConcessao(i, 'item', String(e.detail.valor ?? ''))}></urbi-input>
            <urbi-input label="Até" valor=${c.limite} placeholder="90 dias" @urbi:input-change=${(e: CustomEvent) => this.mudarConcessao(i, 'limite', String(e.detail.valor ?? ''))}></urbi-input>
            <urbi-input label="↔ Contrapartida" valor=${c.contrapartida} placeholder="Entrada de 30%" @urbi:input-change=${(e: CustomEvent) => this.mudarConcessao(i, 'contrapartida', String(e.detail.valor ?? ''))}></urbi-input>
            <urbi-botao pequeno variante="fantasma" icone="fa-solid fa-trash" ariaLabel="Tirar esta concessão" title="Tirar esta concessão"
              @click=${() => this.mudar({ concessoes: f.concessoes.filter((_, j) => j !== i) })}></urbi-botao>
          </urbi-linha>`,
        )}
        <urbi-linha><urbi-botao pequeno variante="secundario" icone="fa-solid fa-plus" @click=${() => this.mudar({ concessoes: [...f.concessoes, { item: '', limite: '', contrapartida: '' }] })}>Adicionar concessão</urbi-botao></urbi-linha>
        <urbi-grid min="200px">
          <urbi-stack>
            <urbi-input label="Passo máximo por rodada (%)" tipo="number" valor=${f.passo_pct} @urbi:input-change=${(e: CustomEvent) => this.mudar({ passo_pct: String(e.detail.valor ?? '') })}></urbi-input>
            <urbi-prosa papel="dica">Do intervalo que ainda resta até o recuo (padrão 40%).</urbi-prosa>
          </urbi-stack>
          <urbi-stack>
            <urbi-input label="Máximo de rodadas" tipo="number" valor=${f.rodadas} @urbi:input-change=${(e: CustomEvent) => this.mudar({ rodadas: String(e.detail.valor ?? '') })}></urbi-input>
            <urbi-prosa papel="dica">Depois disso, a negociação passa a você (padrão 4).</urbi-prosa>
          </urbi-stack>
        </urbi-grid>
      </urbi-card>
      <urbi-card titulo="3 · Prazo e validade" icone="fa-solid fa-calendar-check">
        <urbi-input-data label="Mandato válido até" valor=${f.validade} @urbi:input-data-change=${(e: CustomEvent) => this.mudar({ validade: String(e.detail.valor ?? '') })}></urbi-input-data>
        <urbi-prosa papel="dica">Vencido, o Negociador não age e a negociação passa a você. Cada contraproposta vale 48 horas.</urbi-prosa>
      </urbi-card>
      <urbi-card titulo="4 · Quem negocia e autonomia" icone="fa-solid fa-user-gear">
        <urbi-grid min="200px">
          <urbi-select label="Quem negocia" valor=${this.quem} .opcoes=${[{ valor: 'ia', rotulo: 'Negociador IA' }, { valor: 'corretor', rotulo: 'Você' }]}
            @urbi:select-change=${(e: CustomEvent) => ((this.quem = String(e.detail.valor)), (this.erro = null))}></urbi-select>
          <urbi-select label="Autonomia do Negociador" valor=${f.autonomia} .opcoes=${OPCOES_AUTONOMIA.filter((o) => o.valor !== 'faz_sozinho' || autorizacao || f.autonomia === 'faz_sozinho')}
            @urbi:select-change=${(e: CustomEvent) => this.mudar({ autonomia: String(e.detail.valor) })}></urbi-select>
        </urbi-grid>
        <urbi-prosa papel="dica">Só sugere: você decide tudo. Pergunta antes: ele prepara e você aprova. Faz sozinho: responde pelo portal dentro do mandato, com a autorização do proprietário${autorizacao ? '' : ' (“Faz sozinho” exige a autorização registrada abaixo)'}.</urbi-prosa>
        <urbi-prosa papel="secao">Autorização do proprietário</urbi-prosa>
        ${autorizacao
          ? html`<urbi-linha justificar="entre" quebrar>
              <urbi-prosa>${autorizacao.tipo === 'anexo' ? 'Documento anexado' : 'Autorizado por mensagem'} em ${autorizacao.data.split('-').reverse().join('/')}</urbi-prosa>
              <urbi-botao pequeno variante="texto" @click=${() => this.mudar({ autorizacao: null, autonomia: f.autonomia === 'faz_sozinho' ? 'pergunta_antes' : f.autonomia })}>Tirar</urbi-botao>
            </urbi-linha>`
          : html`<urbi-linha quebrar>
              <urbi-seletor-arquivo texto="Anexar documento" icone="fa-solid fa-paperclip" accept="application/pdf,image/jpeg,image/png" ?desabilitado=${this.anexando || !this.imovelId}
                @urbi:seletor-arquivo-change=${(e: CustomEvent) => void this.anexar(e, this.imovelId)}></urbi-seletor-arquivo>
              <urbi-botao pequeno variante="secundario" icone="fa-solid fa-message" @click=${() => void this.porMensagem()}>Registrar por mensagem</urbi-botao>
            </urbi-linha>
            <urbi-prosa papel="dica">Obrigatória para o "faz sozinho". O documento fica nos arquivos do imóvel, fora do anúncio.</urbi-prosa>`}
      </urbi-card>
    </urbi-stack>`;
  }

  /** Registrar por mensagem: a data em que o proprietário autorizou por escrito. */
  private async porMensagem() {
    const v = await urbiVerso.formulario({
      titulo: 'Autorização por mensagem',
      mensagem: 'O proprietário autorizou por mensagem (WhatsApp, e-mail). Informe o dia.',
      campos: [{ nome: 'data', tipo: 'data', rotulo: 'Autorizado em', obrigatorio: true, valor: hojeLocal() }],
      rotuloConfirmar: 'Registrar',
    });
    if (v?.data) this.mudar({ autorizacao: { tipo: 'mensagem', data: String(v.data), arquivo_id: null } });
  }

  render() {
    const titulo = `Mandato de negociação${this.cliente ? ` · ${this.cliente}` : ''}${this.versao ? ` · versão ${this.versao}` : ''}`;
    return html`<urbi-modal title=${titulo} maxWidth="760px" .closeOnBackdrop=${false} @urbi-modal:close=${() => this.aoFechar(false)}>
      ${this.falha
        ? estadoDaFalha(this.falha, () => void this.carregar())
        : !this.f
          ? estadoTela('carregando')
          : html`<urbi-stack>
              ${this.blocos()}
              ${this.erro ? html`<urbi-banner variante="erro">${this.erro}</urbi-banner>` : nothing}
              <urbi-linha justificar="fim">
                <urbi-botao variante="secundario" @click=${() => this.aoFechar(false)}>Cancelar</urbi-botao>
                <urbi-botao icone="fa-solid fa-check" ?carregando=${this.salvando} @click=${() => void this.salvar()}>Salvar mandato</urbi-botao>
              </urbi-linha>
            </urbi-stack>`}
    </urbi-modal>`;
  }
}
