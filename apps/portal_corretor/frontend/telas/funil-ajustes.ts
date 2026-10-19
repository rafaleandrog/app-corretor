import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { UrbiColunaTabela, UrbiVersoAPI } from '@urbiverso/sdk';
import { enviar, mensagemDeErro } from '../apoio.js';

declare const urbiVerso: UrbiVersoAPI;

interface Etapa {
  id?: number;
  pipeline: string;
  nome: string;
  tipo: 'aberta' | 'ganha' | 'perdida';
  probabilidade: number;
  ativa?: boolean;
}

const PIPELINES = [
  { id: 'compra', titulo: 'Compra (cliente comprador)' },
  { id: 'venda_captacao', titulo: 'Venda e captação (proprietário)' },
];
const TIPO: Record<Etapa['tipo'], string> = { aberta: 'Em andamento', ganha: 'Ganho', perdida: 'Perdido' };

// Ajustes › Funil: as etapas de cada funil, na ordem, com a probabilidade usada na previsão.
// Editar é em rascunho local; "Salvar" manda a lista inteira e o backend valida as regras.
@customElement('pc-tela-funil-ajustes')
export class PcTelaFunilAjustes extends LitElement {
  @state() private rascunho: Record<string, Etapa[]> = {};
  @state() private salvando: string | null = null;
  @state() private falha: string | null = null;

  connectedCallback() {
    super.connectedCallback();
    void this.carregar();
  }

  private async carregar() {
    this.falha = null;
    try {
      const r = await urbiVerso.api('/funil/etapas');
      const ativas = (r.etapas as Etapa[]).filter((e) => e.ativa !== false);
      this.rascunho = Object.fromEntries(PIPELINES.map((p) => [p.id, ativas.filter((e) => e.pipeline === p.id)]));
    } catch (e) {
      this.falha = (e as Error).message;
    }
  }

  private alterar(pipeline: string, lista: Etapa[]) {
    this.rascunho = { ...this.rascunho, [pipeline]: lista };
  }

  private mover(pipeline: string, i: number, delta: number) {
    const lista = [...this.rascunho[pipeline]];
    const j = i + delta;
    if (j < 0 || j >= lista.length) return;
    [lista[i], lista[j]] = [lista[j], lista[i]];
    this.alterar(pipeline, lista);
  }

  private async editar(pipeline: string, i: number | null) {
    const atual = i === null ? null : this.rascunho[pipeline][i];
    const v = await urbiVerso.formulario({
      titulo: atual ? 'Editar etapa' : 'Nova etapa',
      campos: [
        { nome: 'nome', tipo: 'texto', rotulo: 'Nome', obrigatorio: true, valor: atual?.nome ?? '' },
        { nome: 'tipo', tipo: 'selecao', rotulo: 'Tipo', valor: atual?.tipo ?? 'aberta', opcoes: Object.entries(TIPO).map(([valor, rotulo]) => ({ valor, rotulo })) },
        { nome: 'probabilidade', tipo: 'numero', rotulo: 'Chance de fechar (%)', min: 0, max: 100, valor: Math.round((atual?.probabilidade ?? 0.1) * 100) },
      ],
    });
    if (!v) return;
    const etapa: Etapa = { ...atual, pipeline, nome: String(v.nome), tipo: v.tipo as Etapa['tipo'], probabilidade: Number(v.probabilidade ?? 0) / 100 };
    const lista = [...this.rascunho[pipeline]];
    // Etapa nova entra antes das finais (ganho/perdido), que ficam no fim do funil.
    const fim = lista.findIndex((e) => e.tipo !== 'aberta');
    if (i === null) lista.splice(fim < 0 ? lista.length : fim, 0, etapa);
    else lista[i] = etapa;
    this.alterar(pipeline, lista);
  }

  private async salvar(pipeline: string) {
    this.salvando = pipeline;
    try {
      await enviar('PUT', `/funil/etapas/${pipeline}`, { etapas: this.rascunho[pipeline] });
      urbiVerso.notificar('Funil salvo.', 'sucesso');
      await this.carregar();
    } catch (e) {
      await urbiVerso.alertar({ titulo: 'Não foi possível salvar', mensagem: mensagemDeErro(e), tipo: 'erro' });
    } finally {
      this.salvando = null;
    }
  }

  private colunas(pipeline: string): UrbiColunaTabela[] {
    const lista = this.rascunho[pipeline];
    return [
      { id: 'nome', label: 'Etapa' },
      { id: 'tipo', label: 'Tipo', valor: (l) => TIPO[(l as Etapa).tipo] },
      { id: 'probabilidade', label: 'Chance', alinhamento: 'direita', valor: (l) => `${Math.round((l as Etapa).probabilidade * 100)}%` },
      {
        id: 'acoes',
        label: '',
        semRotuloMobile: true,
        render: (l) => {
          const i = lista.indexOf(l as Etapa);
          return html`<urbi-linha>
            <urbi-botao variante="fantasma" pequeno icone="fa-solid fa-arrow-up" ariaLabel="Subir" ?desabilitado=${i === 0} @click=${() => this.mover(pipeline, i, -1)}></urbi-botao>
            <urbi-botao variante="fantasma" pequeno icone="fa-solid fa-arrow-down" ariaLabel="Descer" ?desabilitado=${i === lista.length - 1} @click=${() => this.mover(pipeline, i, 1)}></urbi-botao>
            <urbi-botao variante="fantasma" pequeno icone="fa-solid fa-pen" ariaLabel="Editar" @click=${() => this.editar(pipeline, i)}></urbi-botao>
            <urbi-botao variante="fantasma" pequeno icone="fa-solid fa-xmark" ariaLabel="Tirar do funil" @click=${() => this.alterar(pipeline, lista.filter((_, k) => k !== i))}></urbi-botao>
          </urbi-linha>`;
        },
      },
    ];
  }

  render() {
    if (this.falha) {
      return html`<urbi-banner variante="erro">
        ${this.falha}
        <urbi-botao slot="acao" pequeno variante="secundario" @click=${() => this.carregar()}>Tentar de novo</urbi-botao>
      </urbi-banner>`;
    }
    if (!Object.keys(this.rascunho).length) return html`<urbi-loading></urbi-loading>`;
    return html`<urbi-stack>
      <urbi-prosa papel="secundario">Etapa tirada do funil não some dos negócios que estão nela: fica inativa e deixa de aparecer para os novos.</urbi-prosa>
      ${PIPELINES.map(
        (p) => html`<urbi-card titulo=${p.titulo} icone="fa-solid fa-filter">
          <urbi-tabela responsivo="multiline" .colunas=${this.colunas(p.id)} .linhas=${this.rascunho[p.id]}></urbi-tabela>
          <urbi-linha justificar="entre" quebrar>
            <urbi-botao variante="secundario" pequeno icone="fa-solid fa-plus" @click=${() => this.editar(p.id, null)}>Nova etapa</urbi-botao>
            <urbi-botao pequeno ?carregando=${this.salvando === p.id} @click=${() => this.salvar(p.id)}>Salvar este funil</urbi-botao>
          </urbi-linha>
        </urbi-card>`,
      )}
    </urbi-stack>`;
  }
}
