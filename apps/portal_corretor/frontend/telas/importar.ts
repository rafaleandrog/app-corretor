import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { UrbiColunaTabela, UrbiVersoAPI } from '@urbiverso/sdk';
import { lerCsv, mapearPorModelo, MODELOS_IMPORTACAO } from '../../comum/csv.js';
import { enviar, mensagemDeErro } from '../apoio.js';

declare const urbiVerso: UrbiVersoAPI;

const CAMPOS: { id: string; rotulo: string }[] = [
  { id: 'nome', rotulo: 'Nome' },
  { id: 'telefone', rotulo: 'Telefone' },
  { id: 'email', rotulo: 'E-mail' },
  { id: 'papeis', rotulo: 'Papel' },
  { id: 'observacoes', rotulo: 'Observações' },
];
const LIMITE = 2000;
// Teto de corpo do shell (`413 CORPO_MUITO_GRANDE`, SDK apps-em-repo-proprio): o envio é um POST só.
const TETO_CORPO_KB = 100;
const ORIGENS = [...MODELOS_IMPORTACAO.map((m) => ({ valor: m.id, rotulo: m.rotulo })), { valor: 'outra', rotulo: 'Outra' }];

interface Relatorio {
  criados: number;
  unidos: number;
  pulados: number;
  rejeitados: { linha: number; motivo: string }[];
}

// Clientes › Importar (spec 12.1): o arquivo é lido no navegador, o corretor confere o mapeamento
// das colunas nas 10 primeiras linhas e escolhe o que fazer com duplicatas; o backend valida tudo.
@customElement('pc-tela-importar')
export class PcTelaImportar extends LitElement {
  @state() private arquivo: string | null = null;
  @state() private cabecalho: string[] = [];
  @state() private linhas: string[][] = [];
  @state() private mapa: Record<string, number | null> = {};
  @state() private origem = 'outra';
  @state() private modo = 'pular';
  @state() private enviando = false;
  @state() private relatorio: Relatorio | null = null;

  private async escolher(e: CustomEvent) {
    const f = e.detail.arquivo as File | null;
    this.relatorio = null;
    if (!f) {
      this.arquivo = null;
      return;
    }
    const bytes = new Uint8Array(await f.arrayBuffer());
    // UTF-8 primeiro; se houver caractere inválido, o arquivo veio do Excel antigo em Latin-1.
    let texto = new TextDecoder('utf-8').decode(bytes);
    if (texto.includes('�')) texto = new TextDecoder('windows-1252').decode(bytes);
    const tudo = lerCsv(texto);
    if (tudo.length < 2) {
      await urbiVerso.alertar({ titulo: 'Arquivo vazio', mensagem: 'A planilha precisa de um cabeçalho e ao menos uma linha.', tipo: 'alerta' });
      return;
    }
    this.arquivo = f.name;
    this.cabecalho = tudo[0];
    this.linhas = tudo.slice(1);
    this.mapa = mapearPorModelo(this.cabecalho, this.origem);
  }

  private escolherOrigem(valor: string) {
    this.origem = valor;
    if (this.arquivo) this.mapa = mapearPorModelo(this.cabecalho, valor);
  }

  private corpo() {
    return { linhas: this.convertidas(), modo: this.modo, arquivo: this.arquivo };
  }

  /** Tamanho do envio em kB, como o shell o mede (bytes do JSON). */
  private tamanhoKb() {
    return Math.ceil(new TextEncoder().encode(JSON.stringify(this.corpo())).length / 1024);
  }

  private convertidas() {
    return this.linhas.map((l) =>
      Object.fromEntries(CAMPOS.map((c) => [c.id, this.mapa[c.id] === null || this.mapa[c.id] === undefined ? undefined : (l[this.mapa[c.id]!] ?? '').trim()])),
    );
  }

  private async importar() {
    if (this.mapa.nome === null || this.mapa.nome === undefined) {
      await urbiVerso.alertar({ titulo: 'Falta a coluna do nome', mensagem: 'Escolha qual coluna da planilha tem o nome do contato.', tipo: 'alerta' });
      return;
    }
    if (this.linhas.length > LIMITE) {
      await urbiVerso.alertar({ titulo: 'Planilha grande demais', mensagem: `Importe no máximo ${LIMITE} linhas por vez. Divida o arquivo.`, tipo: 'alerta' });
      return;
    }
    this.enviando = true;
    try {
      this.relatorio = await enviar('POST', '/contatos/importar', this.corpo());
    } catch (e) {
      await urbiVerso.alertar({ titulo: 'A importação falhou', mensagem: mensagemDeErro(e), tipo: 'erro' });
    } finally {
      this.enviando = false;
    }
  }

  private previa(): UrbiColunaTabela[] {
    return CAMPOS.filter((c) => this.mapa[c.id] !== null && this.mapa[c.id] !== undefined).map((c) => ({ id: c.id, label: c.rotulo }));
  }

  render() {
    const colunasArquivo = this.cabecalho.map((c, i) => ({ valor: String(i), rotulo: c || `Coluna ${i + 1}` }));
    return html`<urbi-stack>
      <urbi-linha quebrar>
        <urbi-botao variante="texto" icone="fa-solid fa-arrow-left" href=${urbiVerso.href('/clientes')}>Clientes</urbi-botao>
      </urbi-linha>
      <urbi-prosa papel="secundario">
        Planilha em CSV (no Excel: Salvar como › CSV), com cabeçalho. Contatos importados entram sem consentimento: o atendimento
        automático só poderá falar com eles por mensagem-modelo aprovada. Cada importação envia até ${TETO_CORPO_KB} kB:
        com nome, telefone, e-mail e observação, isso dá algumas centenas de linhas.
      </urbi-prosa>
      <urbi-select label="De onde vem a planilha?" valor=${this.origem} .opcoes=${ORIGENS}
        @urbi:select-change=${(e: CustomEvent) => this.escolherOrigem(e.detail.valor || 'outra')}></urbi-select>
      <urbi-seletor-arquivo drop accept=".csv,text/csv" dica="Arquivo CSV com cabeçalho" @urbi:seletor-arquivo-change=${(e: CustomEvent) => this.escolher(e)}></urbi-seletor-arquivo>
      ${this.arquivo
        ? html`<urbi-card titulo="Colunas" icone="fa-solid fa-table-columns">
              <urbi-linha quebrar>
                ${CAMPOS.map(
                  (c) => html`<urbi-select label=${c.rotulo} placeholder="Não importar" .opcoes=${colunasArquivo}
                    valor=${this.mapa[c.id] === null || this.mapa[c.id] === undefined ? '' : String(this.mapa[c.id])}
                    @urbi:select-change=${(e: CustomEvent) => (this.mapa = { ...this.mapa, [c.id]: e.detail.valor === '' ? null : Number(e.detail.valor) })}></urbi-select>`,
                )}
              </urbi-linha>
            </urbi-card>
            <urbi-card titulo="Prévia (10 primeiras linhas de ${this.linhas.length})" icone="fa-solid fa-eye">
              <urbi-tabela responsivo="multiline" .colunas=${this.previa()} .linhas=${this.convertidas().slice(0, 10)}></urbi-tabela>
            </urbi-card>
            ${this.tamanhoKb() > TETO_CORPO_KB
              ? html`<urbi-banner variante="alerta">
                  Este envio tem ${this.tamanhoKb()} kB e o limite é ${TETO_CORPO_KB} kB: a importação vai ser recusada. Divida a planilha
                  em arquivos menores ou deixe de importar colunas longas, como observações.
                </urbi-banner>`
              : ''}
            <urbi-linha quebrar alinhar="fim">
              <urbi-select label="Se o contato já existir (mesmo telefone ou e-mail)" valor=${this.modo}
                .opcoes=${[{ valor: 'pular', rotulo: 'Pular' }, { valor: 'atualizar_vazios', rotulo: 'Completar só os campos vazios' }, { valor: 'sobrescrever', rotulo: 'Sobrescrever com a planilha' }]}
                @urbi:select-change=${(e: CustomEvent) => (this.modo = e.detail.valor)}></urbi-select>
              <urbi-botao icone="fa-solid fa-file-import" ?carregando=${this.enviando} @click=${() => this.importar()}>Importar ${this.linhas.length} linhas</urbi-botao>
            </urbi-linha>`
        : ''}
      ${this.relatorio
        ? html`<urbi-banner variante=${this.relatorio.rejeitados.length ? 'alerta' : 'sucesso'}>
              ${this.relatorio.criados} criados · ${this.relatorio.unidos} unidos a contatos existentes · ${this.relatorio.pulados} pulados ·
              ${this.relatorio.rejeitados.length} rejeitados
            </urbi-banner>
            ${this.relatorio.rejeitados.length
              ? html`<urbi-tabela responsivo="multiline" .colunas=${[{ id: 'linha', label: 'Linha' }, { id: 'motivo', label: 'Motivo' }]}
                  .linhas=${this.relatorio.rejeitados}></urbi-tabela>`
              : ''}`
        : ''}
    </urbi-stack>`;
  }
}
