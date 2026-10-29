import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import type { UrbiColunaTabela, UrbiVersoAPI } from '@urbiverso/sdk';
import { lerCsv, mapearPorModelo, MODELOS_IMPORTACAO } from '../../comum/csv.js';
import { enviar, mensagemDeErro } from '../apoio.js';
import { moldura } from '../moldura.js';

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
const LINHAS_PREVIA = 10;
const ORIGENS = [...MODELOS_IMPORTACAO.map((m) => ({ valor: m.id, rotulo: m.rotulo })), { valor: 'outra', rotulo: 'Outra' }];
/** Regra para o contato que já existe (mesmo telefone ou e-mail), como a rota a recebe. */
const REPETIDOS = [
  { id: 'pular', rotulo: 'Pular', explicacao: 'O contato que já existe fica como está.' },
  { id: 'atualizar_vazios', rotulo: 'Completar', explicacao: 'Preenche só os campos que estão vazios no contato que já existe.' },
  { id: 'sobrescrever', rotulo: 'Substituir', explicacao: 'Os dados da planilha substituem os do contato que já existe.' },
];
/** O que acontece com cada linha, como a prévia da rota devolve (`simular`). */
const ACAO: Record<string, string> = {
  nova: 'Novo contato',
  pulada: 'Já existe: fica como está',
  completada: 'Já existe: completa os vazios',
  substituida: 'Já existe: substituído',
  ignorada: 'Ignorada',
};

interface Relatorio {
  criados: number;
  unidos: number;
  pulados: number;
  rejeitados: { linha: number; motivo: string }[];
}

// Estado da importação, dividido pelas três colunas (P14): a esquerda escolhe a fonte, o centro lê o
// arquivo e mostra a prévia, a direita escolhe a regra dos repetidos. Toda escrita redesenha as três.
// Recomeça a cada entrada na tela (`aoAbrirImportar`).
const estado = {
  arquivo: null as string | null,
  cabecalho: [] as string[],
  linhas: [] as string[][],
  mapa: {} as Record<string, number | null>,
  origem: 'outra',
  modo: 'pular',
  enviando: false,
  relatorio: null as Relatorio | null,
  previa: null as { linha: number; acao: string; motivo: string | null }[] | null,
};
const ouvintes = new Set<() => void>();
let geracaoPrevia = 0;
// Cada entrada na tela é uma visita nova: resposta que chega depois dela (prévia ou importação) é da anterior.
let visita = 0;

function mudar(m: Partial<typeof estado>) {
  Object.assign(estado, m);
  ouvintes.forEach((f) => f());
}

export function aoAbrirImportar() {
  visita++;
  geracaoPrevia++; // a prévia em andamento não vale mais
  mudar({ arquivo: null, cabecalho: [], linhas: [], mapa: {}, origem: 'outra', modo: 'pular', enviando: false, relatorio: null, previa: null });
}

function convertidas(linhas = estado.linhas) {
  return linhas.map((l) =>
    Object.fromEntries(CAMPOS.map((c) => [c.id, estado.mapa[c.id] === null || estado.mapa[c.id] === undefined ? undefined : (l[estado.mapa[c.id]!] ?? '').trim()])),
  );
}

/**
 * Prévia do que acontece em cada uma das primeiras linhas, pela própria rota (`simular`): a mesma
 * validação e a mesma busca de repetidos da importação, sem gravar. Sem a coluna do nome, nada a prever.
 */
async function preverLinhas() {
  const g = ++geracaoPrevia;
  if (!estado.arquivo || estado.mapa.nome === null || estado.mapa.nome === undefined) return mudar({ previa: null });
  try {
    const r = await enviar('POST', '/contatos/importar', { linhas: convertidas(estado.linhas.slice(0, LINHAS_PREVIA)), modo: estado.modo, simular: true });
    if (g === geracaoPrevia) mudar({ previa: r.previa });
  } catch {
    // A prévia é ajuda: se falhar, a tabela mostra as linhas sem a coluna do que acontece.
    if (g === geracaoPrevia) mudar({ previa: null });
  }
}

/** Base das três colunas: redesenha quando o estado muda. */
class ColunaImportar extends LitElement {
  private soltar?: () => void;
  connectedCallback() {
    super.connectedCallback();
    const f = () => this.requestUpdate();
    ouvintes.add(f);
    this.soltar = () => ouvintes.delete(f);
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    this.soltar?.();
  }
}

/** Importar na moldura do Padrão B (P14). */
export function renderImportar(atualizar: () => void) {
  return moldura(
    {
      menu: '/clientes',
      lista: html`<pc-importar-fontes></pc-importar-fontes>`,
      centro: html`<pc-tela-importar></pc-tela-importar>`,
      contexto: html`<pc-importar-regras></pc-importar-regras>`,
      rotulos: { lista: 'Fontes', centro: 'Importar', contexto: 'Regras' },
      painel: 'centro',
    },
    atualizar,
  );
}

// Esquerda (P14): de onde vêm os contatos. Só a planilha existe hoje; as outras fontes aparecem como
// "em breve", sem ação.
@customElement('pc-importar-fontes')
export class PcImportarFontes extends ColunaImportar {
  render() {
    const fontes = [
      { id: 'csv', rotulo: 'Planilha (CSV)', icone: 'fa-solid fa-file-csv', breve: false },
      { id: 'vcard', rotulo: 'Contatos do celular (vCard)', icone: 'fa-solid fa-address-book', breve: true },
      { id: 'crm', rotulo: 'Outro CRM, direto', icone: 'fa-solid fa-plug', breve: true },
    ];
    return html`<urbi-stack>
      <urbi-linha quebrar>
        <urbi-botao variante="texto" icone="fa-solid fa-arrow-left" href=${urbiVerso.href('/clientes')}>Clientes</urbi-botao>
      </urbi-linha>
      <urbi-prosa papel="titulo">Importar</urbi-prosa>
      <urbi-lista separador .itens=${fontes}
        .itemAtivo=${(f: { id: string }) => f.id === 'csv'}
        .indicador=${(f: { id: string }) => (f.id === 'csv' ? 'var(--cor-primaria)' : '')}
        .render_item=${(f: (typeof fontes)[number]) => html`<urbi-linha justificar="entre" quebrar>
          <urbi-prosa><urbi-icone classe=${f.icone}></urbi-icone> ${f.rotulo}</urbi-prosa>
          ${f.breve ? html`<urbi-badge>Em breve</urbi-badge>` : ''}
        </urbi-linha>`}></urbi-lista>
      <urbi-prosa papel="dica">Planilha de outro CRM: exporte em CSV e escolha o CRM em "De onde vem a planilha?" para o app sugerir as colunas.</urbi-prosa>
    </urbi-stack>`;
  }
}

// Centro (P14, spec 12.1): o arquivo é lido no navegador, o corretor confere o mapeamento das colunas e a
// prévia do que acontece com cada uma das primeiras linhas; o backend valida tudo de novo ao importar.
@customElement('pc-tela-importar')
export class PcTelaImportar extends ColunaImportar {
  private async escolher(e: CustomEvent) {
    const f = e.detail.arquivo as File | null;
    const v = visita;
    mudar({ relatorio: null });
    if (!f) return mudar({ arquivo: null, previa: null });
    const bytes = new Uint8Array(await f.arrayBuffer());
    if (v !== visita) return;
    // UTF-8 primeiro; se houver caractere inválido, o arquivo veio do Excel antigo em Latin-1.
    let texto = new TextDecoder('utf-8').decode(bytes);
    if (texto.includes('�')) texto = new TextDecoder('windows-1252').decode(bytes);
    const tudo = lerCsv(texto);
    if (tudo.length < 2) {
      await urbiVerso.alertar({ titulo: 'Arquivo vazio', mensagem: 'A planilha precisa de um cabeçalho e ao menos uma linha.', tipo: 'alerta' });
      return;
    }
    mudar({ arquivo: f.name, cabecalho: tudo[0], linhas: tudo.slice(1), mapa: mapearPorModelo(tudo[0], estado.origem), previa: null });
    void preverLinhas();
  }

  private escolherOrigem(valor: string) {
    mudar({ origem: valor });
    if (estado.arquivo) {
      mudar({ mapa: mapearPorModelo(estado.cabecalho, valor) });
      void preverLinhas();
    }
  }

  private mapear(campo: string, valor: string) {
    mudar({ mapa: { ...estado.mapa, [campo]: valor === '' ? null : Number(valor) } });
    void preverLinhas();
  }

  private corpo() {
    return { linhas: convertidas(), modo: estado.modo, arquivo: estado.arquivo };
  }

  /** Tamanho do envio em kB, como o shell o mede (bytes do JSON). */
  private tamanhoKb() {
    return Math.ceil(new TextEncoder().encode(JSON.stringify(this.corpo())).length / 1024);
  }

  private async importar() {
    if (estado.mapa.nome === null || estado.mapa.nome === undefined) {
      await urbiVerso.alertar({ titulo: 'Falta a coluna do nome', mensagem: 'Escolha qual coluna da planilha tem o nome do contato.', tipo: 'alerta' });
      return;
    }
    if (estado.linhas.length > LIMITE) {
      await urbiVerso.alertar({ titulo: 'Planilha grande demais', mensagem: `Importe no máximo ${LIMITE} linhas por vez. Divida o arquivo.`, tipo: 'alerta' });
      return;
    }
    const v = visita;
    mudar({ enviando: true });
    try {
      const relatorio = await enviar('POST', '/contatos/importar', this.corpo());
      if (v === visita) mudar({ relatorio });
    } catch (e) {
      if (v === visita) await urbiVerso.alertar({ titulo: 'A importação falhou', mensagem: mensagemDeErro(e), tipo: 'erro' });
    } finally {
      // A visita nova já começou com `enviando: false`; só a desta visita desliga o próprio botão.
      if (v === visita) mudar({ enviando: false });
    }
  }

  private colunasPrevia(): UrbiColunaTabela[] {
    const mapeadas = CAMPOS.filter((c) => estado.mapa[c.id] !== null && estado.mapa[c.id] !== undefined).map((c) => ({ id: c.id, label: c.rotulo }));
    return [...(estado.previa ? [{ id: 'acontece', label: 'O que acontece' }] : []), ...mapeadas];
  }

  private linhasPrevia() {
    const linhas = convertidas(estado.linhas.slice(0, LINHAS_PREVIA));
    if (!estado.previa) return linhas;
    return linhas.map((l, i) => {
      const p = estado.previa![i];
      return { ...l, acontece: p ? `${ACAO[p.acao] ?? p.acao}${p.motivo ? `: ${p.motivo}` : ''}` : '' };
    });
  }

  render() {
    const colunasArquivo = estado.cabecalho.map((c, i) => ({ valor: String(i), rotulo: c || `Coluna ${i + 1}` }));
    const relatorio = estado.relatorio;
    return html`<urbi-stack>
      <urbi-prosa papel="secundario">
        Planilha em CSV (no Excel: Salvar como › CSV), com cabeçalho. Cada importação envia até ${TETO_CORPO_KB} kB: com nome,
        telefone, e-mail e observação, isso dá algumas centenas de linhas.
      </urbi-prosa>
      <urbi-select label="De onde vem a planilha?" valor=${estado.origem} .opcoes=${ORIGENS}
        @urbi:select-change=${(e: CustomEvent) => this.escolherOrigem(e.detail.valor || 'outra')}></urbi-select>
      <urbi-seletor-arquivo drop accept=".csv,text/csv" dica="Arquivo CSV com cabeçalho" @urbi:seletor-arquivo-change=${(e: CustomEvent) => this.escolher(e)}></urbi-seletor-arquivo>
      ${estado.arquivo
        ? html`<urbi-prosa>${estado.arquivo} · ${estado.linhas.length} ${estado.linhas.length === 1 ? 'linha' : 'linhas'}</urbi-prosa>
            <urbi-card titulo="Colunas" icone="fa-solid fa-table-columns">
              <urbi-prosa papel="dica">Sugerimos as colunas pelo CRM de origem e pelos nomes do cabeçalho. Confira e troque o que precisar.</urbi-prosa>
              <urbi-linha quebrar>
                ${CAMPOS.map(
                  (c) => html`<urbi-select label=${c.rotulo} placeholder="Não importar" .opcoes=${colunasArquivo}
                    valor=${estado.mapa[c.id] === null || estado.mapa[c.id] === undefined ? '' : String(estado.mapa[c.id])}
                    @urbi:select-change=${(e: CustomEvent) => this.mapear(c.id, e.detail.valor)}></urbi-select>`,
                )}
              </urbi-linha>
            </urbi-card>
            <urbi-card titulo="Prévia (${Math.min(LINHAS_PREVIA, estado.linhas.length)} primeiras linhas de ${estado.linhas.length})" icone="fa-solid fa-eye">
              <urbi-tabela responsivo="multiline" .colunas=${this.colunasPrevia()} .linhas=${this.linhasPrevia()}></urbi-tabela>
            </urbi-card>
            ${this.tamanhoKb() > TETO_CORPO_KB
              ? html`<urbi-banner variante="alerta">
                  Este envio tem ${this.tamanhoKb()} kB e o limite é ${TETO_CORPO_KB} kB: a importação vai ser recusada. Divida a planilha
                  em arquivos menores ou deixe de importar colunas longas, como observações.
                </urbi-banner>`
              : ''}
            <urbi-linha quebrar>
              <urbi-botao icone="fa-solid fa-file-import" ?carregando=${estado.enviando} @click=${() => this.importar()}>Importar ${estado.linhas.length} contatos</urbi-botao>
            </urbi-linha>`
        : ''}
      ${relatorio
        ? html`<urbi-banner variante=${relatorio.rejeitados.length ? 'alerta' : 'sucesso'}>
              ${relatorio.criados} criados · ${relatorio.unidos} unidos a contatos existentes · ${relatorio.pulados} pulados ·
              ${relatorio.rejeitados.length} rejeitados
            </urbi-banner>
            ${relatorio.rejeitados.length
              ? html`<urbi-tabela responsivo="multiline" .colunas=${[{ id: 'linha', label: 'Linha' }, { id: 'motivo', label: 'Motivo' }]}
                  .linhas=${relatorio.rejeitados}></urbi-tabela>`
              : ''}`
        : ''}
    </urbi-stack>`;
  }
}

// Direita (P14): a regra para o contato que já existe e a regra de consentimento (spec 12.1).
@customElement('pc-importar-regras')
export class PcImportarRegras extends ColunaImportar {
  render() {
    const atual = REPETIDOS.find((r) => r.id === estado.modo) ?? REPETIDOS[0];
    return html`<urbi-stack>
      <urbi-card titulo="Se o contato já existir" icone="fa-solid fa-clone">
        <urbi-prosa papel="secundario">Mesmo telefone ou, sem telefone, mesmo e-mail.</urbi-prosa>
        <urbi-chips-atalho .opcoes=${REPETIDOS.map((r) => ({ id: r.id, rotulo: r.rotulo }))} ativo=${atual.id}
          @urbi:chip-atalho:click=${(e: CustomEvent) => {
            mudar({ modo: e.detail.id });
            void preverLinhas();
          }}></urbi-chips-atalho>
        <urbi-prosa papel="dica">${atual.explicacao}</urbi-prosa>
      </urbi-card>
      <urbi-card titulo="Consentimento" icone="fa-solid fa-user-shield">
        <urbi-prosa papel="secundario">
          Contatos importados entram sem consentimento registrado: o atendimento automático só poderá falar com eles por
          mensagem-modelo aprovada. Registre o consentimento na ficha de cada cliente quando ele autorizar.
        </urbi-prosa>
      </urbi-card>
    </urbi-stack>`;
  }
}
