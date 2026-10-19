import { LitElement, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { UrbiVersoAPI } from '@urbiverso/sdk';
import { enviar, formularioEnviar, mensagemDeErro, reais, SITUACAO_IMOVEL, subirArquivo } from '../apoio.js';
import { FASE, faixa, TIPO_EMPREENDIMENTO } from './empreendimentos.js';

declare const urbiVerso: UrbiVersoAPI;

type Linha = Record<string, any>;

const TIPO_MATERIAL: Record<string, string> = { planta: 'Planta', tabela: 'Tabela de preços', memorial: 'Memorial descritivo', book: 'Book', outro: 'Outro' };

// Ficha do empreendimento: dados, materiais (planta, tabela, memorial) e as unidades da carteira
// ligadas a ele. Materiais "para o cliente" poderão ir pelo atendimento automático.
@customElement('pc-tela-ficha-empreendimento')
export class PcTelaFichaEmpreendimento extends LitElement {
  @property({ type: Number }) empreendimentoId = 0;
  @state() private ficha: { empreendimento: Linha; materiais: Linha[]; imoveis: Linha[] } | null = null;
  @state() private falha: string | null = null;
  @state() private enviando = false;

  connectedCallback() {
    super.connectedCallback();
    void this.carregar();
  }

  private async carregar() {
    this.falha = null;
    try {
      this.ficha = await urbiVerso.api(`/empreendimentos/${this.empreendimentoId}`);
    } catch (e) {
      this.falha = (e as Error).message;
    }
  }

  private editar() {
    const e = this.ficha!.empreendimento;
    void formularioEnviar(
      'Dados do empreendimento',
      [
        { nome: 'nome', tipo: 'texto', rotulo: 'Nome', obrigatorio: true, valor: e.nome },
        { nome: 'construtora', tipo: 'texto', rotulo: 'Construtora ou incorporadora', valor: e.construtora ?? '' },
        { nome: 'tipo', tipo: 'selecao', rotulo: 'Tipo', valor: e.tipo, opcoes: Object.entries(TIPO_EMPREENDIMENTO).map(([valor, rotulo]) => ({ valor, rotulo })) },
        { nome: 'fase', tipo: 'selecao', rotulo: 'Fase', valor: e.fase, opcoes: Object.entries(FASE).map(([valor, rotulo]) => ({ valor, rotulo })) },
        { nome: 'endereco', tipo: 'texto', rotulo: 'Endereço', valor: e.endereco ?? '' },
        { nome: 'regiao', tipo: 'texto', rotulo: 'Bairro ou região', valor: e.regiao ?? '' },
        { nome: 'cidade', tipo: 'texto', rotulo: 'Cidade', valor: e.cidade ?? '' },
        { nome: 'preco_min', tipo: 'numero', rotulo: 'Preço a partir de (R$)', valor: e.preco_min_c ? e.preco_min_c / 100 : null, min: 0 },
        { nome: 'preco_max', tipo: 'numero', rotulo: 'Preço até (R$)', valor: e.preco_max_c ? e.preco_max_c / 100 : null, min: 0 },
        { nome: 'tipologias', tipo: 'texto_longo', rotulo: 'Tipologias', valor: e.tipologias ?? '', placeholder: 'Ex.: 2 quartos 58 m², 3 quartos 78 m², cobertura 140 m²' },
        { nome: 'descricao', tipo: 'texto_longo', rotulo: 'Descrição', valor: e.descricao ?? '' },
      ],
      'PATCH',
      `/empreendimentos/${this.empreendimentoId}`,
    ).then((r) => (r ? this.carregar() : undefined));
  }

  private async enviarMaterial(ev: CustomEvent) {
    const f = ev.detail.arquivo as File | null;
    if (!f || this.enviando) return;
    const v = await urbiVerso.formulario({
      titulo: 'Material',
      campos: [
        { nome: 'titulo', tipo: 'texto', rotulo: 'Título', obrigatorio: true, valor: f.name.replace(/\.[^.]+$/, '') },
        { nome: 'tipo', tipo: 'selecao', rotulo: 'Tipo', valor: 'outro', opcoes: Object.entries(TIPO_MATERIAL).map(([valor, rotulo]) => ({ valor, rotulo })) },
        { nome: 'publico', tipo: 'booleano', rotulo: 'Pode ser enviado ao cliente', valor: true },
      ],
    });
    if (!v) return;
    this.enviando = true;
    try {
      const upload_id = await subirArquivo('empreendimento_materiais', 'arquivo', f);
      await enviar('POST', `/empreendimentos/${this.empreendimentoId}/materiais`, { ...v, upload_id });
      urbiVerso.notificar('Material enviado.', 'sucesso');
      await this.carregar();
    } catch (e) {
      await urbiVerso.alertar({ titulo: 'Não foi possível enviar', mensagem: mensagemDeErro(e), tipo: 'erro' });
    } finally {
      this.enviando = false;
    }
  }

  private async removerMaterial(m: Linha) {
    const ok = await urbiVerso.confirmar({ titulo: 'Apagar material', mensagem: `"${m.titulo}" é apagado de vez.`, rotuloConfirmar: 'Apagar', perigo: true });
    if (!ok) return;
    try {
      await enviar('PATCH', `/empreendimentos/${this.empreendimentoId}/materiais/${m.id}/remover`, {});
      await this.carregar();
    } catch (e) {
      await urbiVerso.alertar({ titulo: 'Não foi possível apagar', mensagem: mensagemDeErro(e), tipo: 'erro' });
    }
  }

  private async remover() {
    const ok = await urbiVerso.confirmar({ titulo: 'Remover empreendimento', mensagem: 'Ele sai da sua lista.', rotuloConfirmar: 'Remover', perigo: true });
    if (!ok) return;
    try {
      await enviar('PATCH', `/empreendimentos/${this.empreendimentoId}/remover`, {});
      urbiVerso.navegarSub('/empreendimentos');
    } catch (e) {
      await urbiVerso.alertar({ titulo: 'Não foi possível remover', mensagem: mensagemDeErro(e), tipo: 'erro' });
    }
  }

  render() {
    const banner = this.falha
      ? html`<urbi-banner variante="erro">
          ${this.falha}
          <urbi-botao slot="acao" pequeno variante="secundario" @click=${() => this.carregar()}>Tentar de novo</urbi-botao>
        </urbi-banner>`
      : '';
    if (this.falha && !this.ficha) return banner;
    if (!this.ficha) return html`<urbi-loading></urbi-loading>`;
    const { empreendimento: e, materiais, imoveis } = this.ficha;
    return html`<urbi-stack>
      ${banner}
      <urbi-linha justificar="entre" quebrar>
        <urbi-botao variante="texto" icone="fa-solid fa-arrow-left" href=${urbiVerso.href('/empreendimentos')}>Empreendimentos</urbi-botao>
        <urbi-botao variante="perigo" pequeno icone="fa-solid fa-trash" @click=${() => this.remover()}>Remover</urbi-botao>
      </urbi-linha>
      <urbi-card titulo=${e.nome} icone="fa-solid fa-city">
        <span slot="acoes"><urbi-botao variante="fantasma" pequeno icone="fa-solid fa-pen" ariaLabel="Editar" @click=${() => this.editar()}></urbi-botao></span>
        <urbi-linha quebrar>
          <urbi-badge cor="info">${FASE[e.fase] ?? e.fase}</urbi-badge>
          <urbi-badge>${TIPO_EMPREENDIMENTO[e.tipo] ?? e.tipo}</urbi-badge>
        </urbi-linha>
        <urbi-prosa>${e.construtora ?? 'Construtora não informada'} · ${faixa(e)}</urbi-prosa>
        <urbi-prosa papel="secundario">${[e.endereco, e.regiao, e.cidade].filter(Boolean).join(', ') || 'Local não informado'}</urbi-prosa>
        ${e.tipologias ? html`<urbi-prosa pre>${e.tipologias}</urbi-prosa>` : ''}
        ${e.descricao ? html`<urbi-prosa papel="dica" pre>${e.descricao}</urbi-prosa>` : ''}
      </urbi-card>
      <urbi-card titulo="Materiais" icone="fa-solid fa-folder-open">
        <urbi-seletor-arquivo accept="application/pdf,image/jpeg,image/png,image/webp" ?desabilitado=${this.enviando} texto="Enviar material"
          @urbi:seletor-arquivo-change=${(ev: CustomEvent) => this.enviarMaterial(ev)}></urbi-seletor-arquivo>
        ${materiais.length
          ? html`<urbi-lista separador .itens=${materiais} .render_item=${(m: Linha) => html`<urbi-linha justificar="entre" quebrar>
                <urbi-prosa>${m.titulo} · ${TIPO_MATERIAL[m.tipo] ?? m.tipo}${m.publico ? '' : ' · só para você'}</urbi-prosa>
                <urbi-linha>
                  <urbi-visualizador-arquivo pequeno url=${m.url ?? ''} nome=${m.titulo} rotulo="Ver"></urbi-visualizador-arquivo>
                  <urbi-botao variante="fantasma" pequeno icone="fa-solid fa-trash" ariaLabel="Apagar" @click=${() => this.removerMaterial(m)}></urbi-botao>
                </urbi-linha>
              </urbi-linha>`}></urbi-lista>`
          : html`<urbi-prosa papel="dica">Envie a planta, a tabela de preços e o memorial descritivo.</urbi-prosa>`}
      </urbi-card>
      <urbi-card titulo="Unidades na sua carteira" icone="fa-solid fa-house">
        ${imoveis.length
          ? html`<urbi-lista separador .itens=${imoveis} .render_item=${(i: Linha) => html`<urbi-linha justificar="entre" quebrar>
                <urbi-prosa>${i.codigo} · ${i.titulo ?? ''} · ${i.preco_c ? reais(i.preco_c) : 'sob consulta'}</urbi-prosa>
                <urbi-linha>
                  <urbi-badge cor=${SITUACAO_IMOVEL[i.situacao]?.cor ?? 'padrao'}>${SITUACAO_IMOVEL[i.situacao]?.rotulo ?? i.situacao}</urbi-badge>
                  <urbi-botao variante="texto" pequeno href=${urbiVerso.href(`/imoveis/${i.id}`)}>Abrir</urbi-botao>
                </urbi-linha>
              </urbi-linha>`}></urbi-lista>`
          : html`<urbi-prosa papel="dica">Para ligar uma unidade, abra o imóvel e escolha este empreendimento nos dados.</urbi-prosa>`}
      </urbi-card>
    </urbi-stack>`;
  }
}
