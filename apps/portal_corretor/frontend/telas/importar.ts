import { LitElement, html, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';
import type { UrbiColunaTabela, UrbiVersoAPI } from '@urbiverso/sdk';
import { csvDasRejeitadas, dividirEmLotes, LIMITE_LINHAS_IMPORTACAO, lerCsv, mapearPorModelo, MODELOS_IMPORTACAO, somarRelatorios, sugerirMapeamento, type RelatorioImportacao } from '../../comum/csv.js';
import { ehVcard, lerVcard } from '../../comum/vcard.js';
import { ehContaTrocada, enviar, escolhaUnica, mensagemDeErro } from '../apoio.js';
import { cabecalhoColuna, moldura } from '../moldura.js';

declare const urbiVerso: UrbiVersoAPI;

const CAMPOS: { id: string; rotulo: string }[] = [
  { id: 'nome', rotulo: 'Nome' },
  { id: 'telefone', rotulo: 'Telefone' },
  { id: 'email', rotulo: 'E-mail' },
  { id: 'papeis', rotulo: 'Papel' },
  { id: 'observacoes', rotulo: 'Observações' },
];
const LIMITE = LIMITE_LINHAS_IMPORTACAO;
const LINHAS_PREVIA = 10;
/** Fontes da coluna da esquerda (P14): planilha e vCard funcionam; outro CRM direto é da fase 2. */
export const FONTES = [
  { id: 'csv', rotulo: 'Planilha ou CSV', detalhe: 'Excel, Google Planilhas', icone: 'fa-solid fa-file-csv', fase2: false },
  { id: 'vcard', rotulo: 'Contatos do celular', detalhe: 'arquivo vCard (.vcf)', icone: 'fa-solid fa-address-book', fase2: false },
  { id: 'crm', rotulo: 'Outro CRM, direto', detalhe: 'Kenlo, Jetimob, Imobzi · fase 2', icone: 'fa-solid fa-plug', fase2: true },
] as const;
type Fonte = 'csv' | 'vcard';
const ORIGENS = [...MODELOS_IMPORTACAO.map((m) => ({ valor: m.id, rotulo: m.rotulo })), { valor: 'outra', rotulo: 'Outra' }];
/** Regra para o contato que já existe (mesmo telefone ou e-mail), como a rota a recebe. */
export const REPETIDOS = [
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

type Relatorio = RelatorioImportacao;

// Estado da importação, dividido pelas três colunas (P14): a esquerda escolhe a fonte, o centro lê o
// arquivo e mostra a prévia, a direita escolhe a regra dos repetidos. Toda escrita redesenha as três.
// Recomeça a cada entrada na tela (`aoAbrirImportar`).
const estado = {
  fonte: 'csv' as Fonte,
  arquivo: null as string | null,
  /** Lotes enviados / total, durante a importação (#40). */
  progresso: null as { feitos: number; total: number } | null,
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
  mudar({ fonte: 'csv', arquivo: null, cabecalho: [], linhas: [], mapa: {}, origem: 'outra', modo: 'pular', enviando: false, progresso: null, relatorio: null, previa: null });
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

// Esquerda (P14): de onde vêm os contatos. Planilha e vCard funcionam (o vCard vira as mesmas linhas da
// planilha no navegador); "Outro CRM, direto" é da fase 2, à vista e desligado, com o caminho de hoje.
@customElement('pc-importar-fontes')
export class PcImportarFontes extends ColunaImportar {
  private escolher(id: string) {
    if (id !== 'csv' && id !== 'vcard') return;
    if (id === estado.fonte) return;
    geracaoPrevia++;
    mudar({ fonte: id, arquivo: null, cabecalho: [], linhas: [], mapa: {}, previa: null, relatorio: null });
  }

  render() {
    return html`<urbi-stack>
      <urbi-linha quebrar>
        <urbi-botao variante="texto" icone="fa-solid fa-arrow-left" href=${urbiVerso.href('/clientes')}>Clientes</urbi-botao>
      </urbi-linha>
      ${cabecalhoColuna('Importar contatos')}
      <urbi-prosa papel="fraco">Seus contatos ficam só na sua conta.</urbi-prosa>
      <urbi-prosa papel="secao">De onde vêm</urbi-prosa>
      <urbi-lista clicavel separador .itens=${FONTES} .itemAtivo=${(f: (typeof FONTES)[number]) => f.id === estado.fonte}
        .indicador=${(f: (typeof FONTES)[number]) => (f.id === estado.fonte ? 'var(--cor-primaria)' : '')}
        .render_item=${(f: (typeof FONTES)[number]) => html`<urbi-linha alinhar="centro">
          <urbi-icone classe=${f.icone}></urbi-icone>
          <urbi-stack>
            <urbi-prosa>${f.rotulo}</urbi-prosa>
            <urbi-prosa papel="fraco">${f.detalhe}</urbi-prosa>
          </urbi-stack>
        </urbi-linha>`}
        @urbi:lista-click=${(e: CustomEvent) => this.escolher(String(e.detail.item?.id))}></urbi-lista>
      <urbi-prosa papel="dica">Outro CRM, por enquanto: exporte os clientes em CSV, escolha Planilha e diga de qual CRM ela veio, para o app sugerir as colunas.</urbi-prosa>
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
    if (texto.includes('\uFFFD')) texto = new TextDecoder('windows-1252').decode(bytes);
    // vCard (contatos do celular): vira as mesmas linhas da planilha, com o cabeçalho do vCard.
    const vcard = estado.fonte === 'vcard' || ehVcard(f.name, texto);
    const tudo = vcard ? lerVcard(texto) : lerCsv(texto);
    if (tudo.length < 2) {
      const mensagem = vcard ? 'O arquivo não tem nenhum contato com nome ou telefone.' : 'A planilha precisa de um cabeçalho e ao menos uma linha.';
      await urbiVerso.alertar({ titulo: 'Arquivo vazio', mensagem, tipo: 'alerta' });
      return;
    }
    mudar({
      fonte: vcard ? 'vcard' : 'csv',
      arquivo: f.name,
      cabecalho: tudo[0],
      linhas: tudo.slice(1),
      mapa: vcard ? sugerirMapeamento(tudo[0]) : mapearPorModelo(tudo[0], estado.origem),
      previa: null,
    });
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

  /** Linhas que viram contato: as que têm nome na coluna escolhida (as outras a rota recusa). */
  private importaveis() {
    const i = estado.mapa.nome;
    if (i === null || i === undefined) return 0;
    return estado.linhas.filter((l) => (l[i] ?? '').trim()).length;
  }

  /**
   * Importa em lotes (#40): cada lote cabe no teto de corpo do shell, sai com o número da sua primeira
   * linha na planilha (o relatório volta com a linha certa) e os relatórios somam. Um lote que falha
   * para a importação: o que já entrou fica, e o aviso diz até onde foi.
   */
  private async importar() {
    if (estado.mapa.nome === null || estado.mapa.nome === undefined) {
      await urbiVerso.alertar({ titulo: 'Falta a coluna do nome', mensagem: 'Escolha qual coluna da planilha tem o nome do contato.', tipo: 'alerta' });
      return;
    }
    if (estado.linhas.length > LIMITE) {
      await urbiVerso.alertar({ titulo: 'Arquivo grande demais', mensagem: `Importe no máximo ${LIMITE} linhas por vez. Divida o arquivo.`, tipo: 'alerta' });
      return;
    }
    const v = visita;
    const lotes = dividirEmLotes(convertidas());
    const feitos: Relatorio[] = [];
    mudar({ enviando: true, progresso: { feitos: 0, total: lotes.length } });
    try {
      for (const lote of lotes) {
        const r = await enviar('POST', '/contatos/importar', { linhas: lote.linhas, modo: estado.modo, arquivo: estado.arquivo, primeira_linha: lote.inicio + 2 });
        if (v !== visita) return;
        feitos.push(r);
        mudar({ progresso: { feitos: feitos.length, total: lotes.length } });
      }
      mudar({ relatorio: somarRelatorios(feitos) });
    } catch (e) {
      // Conta trocada com a importação em voo (guarda do envio): o erro, ou o relatório, é da conta
      // anterior e não aparece na nova, esteja o usuário nesta tela ou em outra.
      if (ehContaTrocada(e)) return;
      if (v !== visita) return;
      if (feitos.length) mudar({ relatorio: somarRelatorios(feitos) });
      const parte = feitos.length ? ` As linhas até a ${lotes[feitos.length].inicio + 1} já foram importadas (veja o relatório); importe de novo a partir da linha ${lotes[feitos.length].inicio + 2}.` : '';
      await urbiVerso.alertar({ titulo: 'A importação parou', mensagem: `${mensagemDeErro(e)}${parte}`, tipo: 'erro' });
    } finally {
      // A visita nova já começou com `enviando: false`; só a desta visita desliga o próprio botão.
      if (v === visita) mudar({ enviando: false, progresso: null });
    }
  }

  /** Baixar relatório (12.1): CSV das linhas rejeitadas, com o motivo e as células originais. */
  private baixarRelatorio() {
    const r = estado.relatorio;
    if (!r) return;
    const url = URL.createObjectURL(new Blob([csvDasRejeitadas(r.rejeitados, estado.cabecalho, estado.linhas)], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `importacao-rejeitadas-${(estado.arquivo ?? 'contatos').replace(/\.[^.]+$/, '')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
    const vcard = estado.fonte === 'vcard';
    const n = this.importaveis();
    const lotes = estado.arquivo ? dividirEmLotes(convertidas()).length : 0;
    return html`<urbi-stack>
      <urbi-prosa papel="secundario">
        ${vcard
          ? 'Exporte os contatos do celular como vCard (.vcf): no iPhone, em iCloud › Contatos › Exportar vCard; no Android, em Contatos › Exportar. O arquivo é lido aqui no navegador.'
          : 'Planilha em CSV (no Excel: Salvar como › CSV), com cabeçalho.'}
        Até ${LIMITE} linhas por vez; o app envia em partes, sem limite de colunas.
      </urbi-prosa>
      ${vcard
        ? nothing
        : html`<urbi-select label="De onde vem a planilha?" valor=${estado.origem} .opcoes=${ORIGENS}
            @urbi:select-change=${(e: CustomEvent) => this.escolherOrigem(e.detail.valor || 'outra')}></urbi-select>`}
      <urbi-seletor-arquivo drop label=${vcard ? 'Arquivo vCard' : 'Arquivo da planilha'} accept=${vcard ? '.vcf,text/vcard,text/x-vcard' : '.csv,text/csv'}
        dica=${vcard ? 'Arquivo .vcf exportado do celular' : 'Arquivo CSV com cabeçalho'} @urbi:seletor-arquivo-change=${(e: CustomEvent) => this.escolher(e)}></urbi-seletor-arquivo>
      ${estado.arquivo
        ? html`<urbi-prosa>${estado.arquivo} · ${estado.linhas.length} ${estado.linhas.length === 1 ? (vcard ? 'contato' : 'linha') : vcard ? 'contatos' : 'linhas'}</urbi-prosa>
            <urbi-card titulo="Colunas" icone="fa-solid fa-table-columns">
              <urbi-prosa papel="dica">${vcard ? 'O app ligou os campos do vCard aos campos do app. Confira.' : 'O app ligou as colunas da sua planilha aos campos do app, pelo CRM de origem e pelos nomes do cabeçalho. Confira e troque o que precisar.'}</urbi-prosa>
              <urbi-grid min="160px">
                ${CAMPOS.map(
                  (c) => html`<urbi-select label=${c.rotulo} placeholder="Não importar" .opcoes=${colunasArquivo}
                    valor=${estado.mapa[c.id] === null || estado.mapa[c.id] === undefined ? '' : String(estado.mapa[c.id])}
                    @urbi:select-change=${(e: CustomEvent) => this.mapear(c.id, e.detail.valor)}></urbi-select>`,
                )}
              </urbi-grid>
            </urbi-card>
            <urbi-card titulo="Prévia (${Math.min(LINHAS_PREVIA, estado.linhas.length)} primeiras de ${estado.linhas.length})" icone="fa-solid fa-eye">
              <urbi-tabela responsivo="multiline" .colunas=${this.colunasPrevia()} .linhas=${this.linhasPrevia()}></urbi-tabela>
            </urbi-card>
            ${estado.linhas.length > LIMITE
              ? html`<urbi-banner variante="alerta">O arquivo tem ${estado.linhas.length} linhas e o limite é ${LIMITE} por vez: divida o arquivo.</urbi-banner>`
              : nothing}
            ${estado.progresso
              ? html`<urbi-prosa papel="secundario">Enviando a parte ${Math.min(estado.progresso.feitos + 1, estado.progresso.total)} de ${estado.progresso.total}…</urbi-prosa>`
              : nothing}
            <urbi-linha justificar="fim" quebrar>
              <urbi-botao variante="secundario" ?desabilitado=${estado.enviando} @click=${() => aoAbrirImportar()}>Cancelar</urbi-botao>
              <urbi-botao icone="fa-solid fa-file-import" ?desabilitado=${!n || estado.linhas.length > LIMITE} ?carregando=${estado.enviando} @click=${() => this.importar()}>
                Importar ${n} ${n === 1 ? 'contato' : 'contatos'}
              </urbi-botao>
            </urbi-linha>
            ${lotes > 1 ? html`<urbi-prosa papel="fraco">Vai em ${lotes} partes, uma depois da outra, por causa do tamanho máximo de cada envio.</urbi-prosa>` : nothing}`
        : nothing}
      ${relatorio
        ? html`<urbi-card titulo="Relatório da importação" icone="fa-solid fa-clipboard-check">
            <urbi-stack>
              <urbi-banner variante=${relatorio.rejeitados.length ? 'alerta' : 'sucesso'}>
                ${relatorio.criados} criados · ${relatorio.unidos} unidos a contatos existentes · ${relatorio.pulados} pulados ·
                ${relatorio.rejeitados.length} rejeitados
              </urbi-banner>
              ${relatorio.rejeitados.length
                ? html`<urbi-tabela responsivo="multiline" .colunas=${[{ id: 'linha', label: 'Linha' }, { id: 'motivo', label: 'Motivo' }]}
                      .linhas=${relatorio.rejeitados}></urbi-tabela>
                    <urbi-linha><urbi-botao variante="secundario" icone="fa-solid fa-file-csv" @click=${() => this.baixarRelatorio()}>Baixar relatório</urbi-botao></urbi-linha>`
                : nothing}
            </urbi-stack>
          </urbi-card>`
        : nothing}
    </urbi-stack>`;
  }
}

// Direita (P14): a regra para o contato que já existe (escolha única com explicação: os "rádios" da
// referência) e a regra de consentimento (spec 12.1).
@customElement('pc-importar-regras')
export class PcImportarRegras extends ColunaImportar {
  render() {
    const atual = REPETIDOS.find((r) => r.id === estado.modo) ?? REPETIDOS[0];
    return html`<urbi-stack>
      <urbi-prosa papel="secao">Se o contato já existir</urbi-prosa>
      <urbi-prosa papel="fraco">Mesmo telefone ou, sem telefone, mesmo e-mail.</urbi-prosa>
      <urbi-stack>
        ${escolhaUnica(REPETIDOS, atual.id, (id) => {
          mudar({ modo: id });
          void preverLinhas();
        }, { selo: 'escolhido', desabilitado: estado.enviando, nome: 'Se o contato já existir' })}
      </urbi-stack>
      <urbi-card titulo="Depois de importar" icone="fa-solid fa-user-shield">
        <urbi-prosa papel="secundario">
          Contatos importados entram sem consentimento registrado. Confirme com cada cliente antes de mandar mensagens e
          registre o consentimento na ficha dele quando ele autorizar.
        </urbi-prosa>
      </urbi-card>
    </urbi-stack>`;
  }
}
