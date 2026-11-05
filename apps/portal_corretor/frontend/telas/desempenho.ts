import { html, nothing } from 'lit';
import type { UrbiColunaTabela, UrbiVersoAPI } from '@urbiverso/sdk';
import { CANAIS } from '../../comum/crm';
import { gerarCsv } from '../../comum/csv';
import { linhasCsvNumeros, type RespostaNumeros } from '../../comum/numeros';
import { rotuloObjecao } from '../../comum/numeros-negociacao';
import { chamarApi, contaDeTrabalho, filtrosDaUrl, filtrosNaUrl, reais, ROTULO_MOTIVO_PERDA, ROTULO_ORIGEM } from '../apoio.js';
import { estadoDaFalha, estadoTela } from '../estados.js';
import { moldura } from '../moldura.js';
import { abrirAssistente } from './assistente.js';

declare const urbiVerso: UrbiVersoAPI;

type Linha = Record<string, any>;

// Números (P10, spec 11.1 e 11.2; `/desempenho` é apelido, D-103) na moldura do Padrão B:
// - esquerda: os relatórios (Resumo · Funil e conversão · Origem dos contatos · Tempo de resposta ·
//   Conteúdo · Negociação (D6, `GET /numeros/negociacao`); Mensageiro "em breve", até o bloco 7;
//   Créditos não entram, D-87);
// - centro: o relatório aberto, com o título e os chips de período, Comparar e origem;
// - direita: "O que melhorar" com [Ver os N clientes] (abre Clientes filtrado), as melhores origens
//   e [Exportar CSV].
// Os dados vivem no módulo (centro e direita leem a mesma resposta de `GET /numeros`); `aoAbrirNumeros`
// relê a cada entrada e na troca de conta. Na URL: `?relatorio=` (o antigo `?item=` ainda vale),
// `?dias=`, `?origem=` e `?comparar=0`.

const PERIODOS = [
  { valor: '7', rotulo: '7 dias', anterior: 'nos 7 dias anteriores' },
  { valor: '30', rotulo: '30 dias', anterior: 'nos 30 dias anteriores' },
  { valor: '90', rotulo: '90 dias', anterior: 'nos 90 dias anteriores' },
  { valor: '365', rotulo: '12 meses', anterior: 'nos 12 meses anteriores' },
];

export const RELATORIOS = [
  { id: 'resumo', titulo: 'Resumo', descricao: 'os números que importam', emBreve: false },
  { id: 'funil', titulo: 'Funil e conversão', descricao: 'onde os clientes param', emBreve: false },
  { id: 'origem', titulo: 'Origem dos contatos', descricao: 'de onde vêm e até onde chegam', emBreve: false },
  { id: 'tempo', titulo: 'Tempo de resposta', descricao: 'você e o Mensageiro', emBreve: false },
  { id: 'conteudo', titulo: 'Conteúdo', descricao: 'peças publicadas pelo Estúdio', emBreve: false },
  { id: 'mensageiro', titulo: 'Mensageiro', descricao: 'em breve, com o WhatsApp', emBreve: true },
  { id: 'negociacao', titulo: 'Negociação', descricao: 'propostas, acordos e o Negociador', emBreve: false },
] as const;
type Relatorio = (typeof RELATORIOS)[number];

const canal = (c: string) => ROTULO_ORIGEM[c] ?? (c === 'nao_informada' ? 'Não informada' : c);
const motivo = (m: string) => ROTULO_MOTIVO_PERDA[m] ?? (m === 'sem_motivo' ? 'Sem motivo' : m);
const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)}%`);

const estado = {
  dados: null as Linha | null,
  falha: null as unknown,
  geracao: 0,
  conta: null as number | null,
  // Relatório Negociação (D6): lido à parte, só quando ele está aberto, pelo período da URL.
  negociacao: null as Linha | null,
  falhaNegociacao: null as unknown,
  chaveNegociacao: '',
  geracaoNegociacao: 0,
};
let redesenhar: () => void = () => {};

function lerFiltros() {
  const f = filtrosDaUrl();
  const dias = PERIODOS.some((p) => p.valor === f.get('dias')) ? Number(f.get('dias')) : 30;
  const origem = (CANAIS as readonly string[]).includes(f.get('origem') ?? '') ? f.get('origem')! : '';
  const id = f.get('relatorio') ?? f.get('item');
  const relatorio = RELATORIOS.find((r) => r.id === id) ?? RELATORIOS[0];
  return { dias, origem, comparar: f.get('comparar') !== '0', relatorio };
}

/** Cada entrada em Números (e cada troca de conta) relê os números do período da URL. */
export function aoAbrirNumeros() {
  if (estado.conta !== contaDeTrabalho()) {
    estado.dados = null;
    estado.negociacao = null;
    estado.falhaNegociacao = null;
    // Uma leitura de Negociação em voo é da conta anterior: a resposta dela não pode mais ser gravada.
    estado.geracaoNegociacao++;
  }
  estado.chaveNegociacao = '';
  estado.conta = contaDeTrabalho();
  void carregar();
}

/** Lê o relatório Negociação quando ele está aberto e o período (ou a conta) mudou desde a última leitura. */
async function carregarNegociacao() {
  const { dias, relatorio } = lerFiltros();
  const chave = `${contaDeTrabalho()}:${dias}`;
  if (relatorio.id !== 'negociacao' || chave === estado.chaveNegociacao) return;
  estado.chaveNegociacao = chave;
  const geracao = ++estado.geracaoNegociacao;
  estado.falhaNegociacao = null;
  redesenhar();
  try {
    const r = await chamarApi(`/numeros/negociacao?dias=${dias}`);
    if (geracao === estado.geracaoNegociacao) estado.negociacao = r;
  } catch (e) {
    if (geracao === estado.geracaoNegociacao) {
      estado.falhaNegociacao = e;
      estado.chaveNegociacao = '';
    }
  }
  redesenhar();
}

async function carregar() {
  void carregarNegociacao();
  const geracao = ++estado.geracao;
  const { dias, origem } = lerFiltros();
  estado.falha = null;
  redesenhar();
  try {
    const r = await chamarApi(`/numeros?dias=${dias}${origem ? `&origem=${encodeURIComponent(origem)}` : ''}`);
    if (geracao === estado.geracao) estado.dados = r;
  } catch (e) {
    if (geracao === estado.geracao) estado.falha = e;
  }
  redesenhar();
}

function mudar(mudancas: Record<string, string | number | null>, recarregar = true) {
  filtrosNaUrl(filtrosDaUrl(), mudancas, 'relatorio' in mudancas ? ['item'] : []);
  if (recarregar) void carregar();
  else {
    void carregarNegociacao();
    redesenhar();
  }
}

/** Comparação com o período anterior, em texto curto ("+3 que nos 30 dias anteriores"). */
function variacao(dias: number, atual: number | null, anterior: number | null, ehTaxa = false): string {
  if (atual === null || anterior === null || !lerFiltros().comparar) return '';
  const quando = PERIODOS.find((p) => p.valor === String(dias))?.anterior ?? 'nos dias anteriores';
  const d = atual - anterior;
  if (d === 0) return `igual ${quando.replace(/^nos?/, 'aos')}`;
  const s = d > 0 ? '+' : '−';
  return ehTaxa ? `${s}${Math.round(Math.abs(d) * 100)} pontos que ${quando}` : `${s}${Math.abs(d).toLocaleString('pt-BR')} que ${quando}`;
}

function kpi(rotulo: string, valor: string | number, detalhe = '') {
  return html`<urbi-stack>
    <urbi-kpi rotulo=${rotulo} .valor=${valor} formato=${typeof valor === 'number' ? 'numero' : 'texto'}></urbi-kpi>
    ${detalhe ? html`<urbi-prosa papel="fraco">${detalhe}</urbi-prosa>` : nothing}
  </urbi-stack>`;
}

/** Séries do gráfico: o período e, com Comparar ligado, o anterior ao lado. */
function series(atual: number[], anterior: number[]) {
  return lerFiltros().comparar
    ? [{ rotulo: 'Este período', valores: atual }, { rotulo: 'Período anterior', valores: anterior }]
    : [{ rotulo: 'Este período', valores: atual }];
}

// ── Centro: cabeçalho e relatórios ───────────────────────────────────────────

function cabecalho(rel: Relatorio) {
  const { dias, origem, comparar } = lerFiltros();
  const d = estado.dados;
  const canais = ((d?.origens_disponiveis ?? []) as string[]).filter((c) => (CANAIS as readonly string[]).includes(c));
  if (origem && !canais.includes(origem)) canais.push(origem);
  return html`<urbi-stack>
    <urbi-prosa papel="titulo">${rel.titulo}</urbi-prosa>
    <urbi-linha quebrar>
      <urbi-chips-atalho .opcoes=${PERIODOS.map((p) => ({ id: p.valor, rotulo: p.rotulo }))} ativo=${String(dias)}
        @urbi:chip-atalho:click=${(e: CustomEvent) => mudar({ dias: e.detail.id })}></urbi-chips-atalho>
      <urbi-botao-alternar icone="fa-solid fa-code-compare" .ligado=${comparar}
        @urbi:botao-alternar-change=${(e: CustomEvent<boolean>) => mudar({ comparar: e.detail ? null : '0' }, false)}>Comparar</urbi-botao-alternar>
      ${rel.id === 'negociacao'
        ? nothing
        : html`<urbi-select label="Origem" valor=${origem}
            .opcoes=${[{ valor: '', rotulo: 'Todas as origens' }, ...canais.map((c) => ({ valor: c, rotulo: canal(c) }))]}
            @urbi:select-change=${(e: CustomEvent) => mudar({ origem: e.detail.valor || null })}></urbi-select>`}
    </urbi-linha>
  </urbi-stack>`;
}

function relatorioResumo(d: Linha) {
  const a = d.atual;
  const b = d.anterior;
  const v = (x: number | null, y: number | null, t = false) => variacao(d.dias, x, y, t);
  const serie = d.serie_leads as { categorias: string[]; atual: number[]; anterior: number[] };
  return html`<urbi-grid min="140px">
      ${kpi('Leads', a.leads, v(a.leads, b.leads))}
      ${kpi('Conversão total', pct(a.conversao_total), v(a.conversao_total, b.conversao_total, true))}
      ${kpi('Vendas', a.ganhos, v(a.ganhos, b.ganhos))}
      ${kpi('Comissão prevista', d.previsao.valor_c === null ? '—' : reais(d.previsao.valor_c),
        d.previsao.sem_dados ? `${d.previsao.sem_dados} negócio(s) sem valor ou comissão ficaram de fora` : 'Ponderada pela chance de cada etapa')}
    </urbi-grid>
    <urbi-card titulo="Resultados" icone="fa-solid fa-trophy">
      <urbi-grid min="140px">
        ${kpi('VGV', a.vgv_c === null ? '—' : reais(a.vgv_c))}
        ${kpi('Ciclo médio', a.ciclo_medio_dias === null ? '—' : `${a.ciclo_medio_dias} dias`)}
        ${kpi('Visitas feitas', a.visitas ?? '—', a.visitas === null ? 'sem origem: só com Todas as origens' : v(a.visitas, b.visitas))}
        ${kpi('Captações', a.captacoes, v(a.captacoes, b.captacoes))}
      </urbi-grid>
    </urbi-card>
    <urbi-card titulo="Leads ao longo do período" icone="fa-solid fa-chart-line">
      <urbi-grafico-linha altura="220px" marcadores legenda="sempre" .categorias=${serie.categorias} .series=${series(serie.atual, serie.anterior)}></urbi-grafico-linha>
    </urbi-card>`;
}

const ETAPAS = ['Contatos', 'Em atendimento', 'Visitaram', 'Proposta', 'Ganhos'];
const contagens = (e: Linha) => [e.leads, e.atendimento, e.visitou, e.proposta, e.ganhos];

function relatorioFunil(d: Linha) {
  const a = d.atual;
  const b = d.anterior;
  const v = (x: number | null, y: number | null, t = false) => variacao(d.dias, x, y, t);
  const h = d.por_hora as { horas: number[]; fora: number; inicio: number; fim: number };
  const horas = h.horas.map((_, i) => `${i}h`);
  const passo = (rotulo: string, atual: number | null, anterior: number | null) => html`<urbi-linha justificar="entre" quebrar>
    <urbi-stack>
      <urbi-prosa>${rotulo}</urbi-prosa>
      ${v(atual, anterior, true) ? html`<urbi-prosa papel="fraco">${v(atual, anterior, true)}</urbi-prosa>` : nothing}
    </urbi-stack>
    <urbi-badge>${pct(atual)}</urbi-badge>
  </urbi-linha>`;
  return html`<urbi-grid min="140px">
      ${kpi('Contatos', a.leads, v(a.leads, b.leads))}
      ${kpi('Contato → visita', pct(a.lead_visita), v(a.lead_visita, b.lead_visita, true) || 'da turma do período')}
      ${kpi('Visita → proposta', pct(a.visita_proposta), v(a.visita_proposta, b.visita_proposta, true))}
      ${kpi('Ganhos', a.ganhos, a.vgv_c ? `${reais(a.vgv_c)} em vendas` : v(a.ganhos, b.ganhos))}
    </urbi-grid>
    <urbi-card titulo="Até onde os contatos chegaram" icone="fa-solid fa-chart-simple">
      <urbi-stack>
        <urbi-prosa papel="secundario">Negócios de compra abertos no período e a etapa mais avançada a que chegaram. ${a.clientes_unicos} cliente(s) único(s).</urbi-prosa>
        ${a.leads
          ? html`<urbi-grafico-colunas altura="220px" legenda="auto" .categorias=${ETAPAS} .series=${series(contagens(a.etapas), contagens(b.etapas))}></urbi-grafico-colunas>`
          : html`<urbi-estado-vazio icone="fa-solid fa-filter" mensagem="Nenhum lead no período" submensagem="Os negócios de compra que você abrir aparecem aqui, etapa por etapa."></urbi-estado-vazio>`}
      </urbi-stack>
      <div slot="detalhe">
        <urbi-lista separador .itens=${[
          ['Lead → atendimento', a.lead_atendimento, b.lead_atendimento],
          ['Lead → visita', a.lead_visita, b.lead_visita],
          ['Visita → proposta', a.visita_proposta, b.visita_proposta],
          ['Proposta → ganho', a.proposta_ganho, b.proposta_ganho],
          ['Conversão total', a.conversao_total, b.conversao_total],
        ]} .render_item=${([r, x, y]: [string, number | null, number | null]) => passo(r, x, y)}></urbi-lista>
      </div>
    </urbi-card>
    <urbi-card titulo="Contatos por horário" icone="fa-solid fa-clock">
      <urbi-stack>
        <urbi-prosa papel="secundario">
          Hora em que cada lead chegou. Em destaque, fora do horário comercial (antes das ${h.inicio}h ou a partir das ${h.fim}h):
          ${h.fora} de ${a.leads} no período.
        </urbi-prosa>
        <urbi-grafico-colunas altura="200px" empilhado legenda="sempre" .categorias=${horas}
          .series=${[
            { rotulo: `No horário (${h.inicio}h–${h.fim}h)`, valores: h.horas.map((n, i) => (i >= h.inicio && i < h.fim ? n : 0)) },
            { rotulo: 'Fora do horário', valores: h.horas.map((n, i) => (i < h.inicio || i >= h.fim ? n : 0)) },
          ]}></urbi-grafico-colunas>
      </urbi-stack>
    </urbi-card>
    <urbi-card titulo="Por que perdemos" icone="fa-solid fa-circle-xmark">
      ${a.motivos_perda.length
        ? html`<urbi-grafico-colunas altura="200px" .categorias=${a.motivos_perda.map((m: Linha) => motivo(m.motivo))}
            .series=${[{ rotulo: 'Perdas', valores: a.motivos_perda.map((m: Linha) => m.quantidade) }]}></urbi-grafico-colunas>`
        : html`<urbi-prosa papel="dica">Nenhuma perda no período.</urbi-prosa>`}
    </urbi-card>`;
}

function relatorioOrigem(d: Linha) {
  const origens = d.atual.por_origem as Linha[];
  if (!origens.length) return estadoTela('vazio', { icone: 'fa-solid fa-share-nodes', mensagem: 'Nenhum lead no período', submensagem: 'Os contatos aparecem aqui pelo canal por onde chegaram.' });
  const col: UrbiColunaTabela[] = [
    { id: 'canal', label: 'Origem', valor: (l) => canal((l as Linha).canal) },
    { id: 'leads', label: 'Leads', alinhamento: 'direita' },
    { id: 'visitaram', label: 'Visitaram', alinhamento: 'direita' },
    { id: 'abertos', label: 'Em andamento', alinhamento: 'direita' },
    { id: 'ganhos', label: 'Ganhos', alinhamento: 'direita' },
    { id: 'perdidos', label: 'Perdidos', alinhamento: 'direita' },
    { id: 'taxa', label: 'Conversão', alinhamento: 'direita', valor: (l) => pct((l as Linha).leads ? (l as Linha).ganhos / (l as Linha).leads : null) },
  ];
  return html`<urbi-grid min="320px">
      <urbi-card expandir titulo="Leads por canal" icone="fa-solid fa-chart-pie">
        <urbi-grafico-pizza altura="260px" .categorias=${origens.map((o) => canal(o.canal))} .series=${[{ rotulo: 'Leads', valores: origens.map((o) => o.leads) }]}></urbi-grafico-pizza>
      </urbi-card>
      <urbi-card expandir titulo="Situação por canal" icone="fa-solid fa-share-nodes">
        <urbi-grafico-colunas altura="260px" empilhado legenda="sempre" .categorias=${origens.map((o) => canal(o.canal))}
          .series=${[
            { rotulo: 'Ganhos', valores: origens.map((o) => o.ganhos) },
            { rotulo: 'Em andamento', valores: origens.map((o) => o.abertos) },
            { rotulo: 'Perdidos', valores: origens.map((o) => o.perdidos) },
          ]}></urbi-grafico-colunas>
      </urbi-card>
    </urbi-grid>
    <urbi-card titulo="Por canal" icone="fa-solid fa-table">
      <urbi-tabela responsivo="multiline" .colunas=${col} .linhas=${origens}></urbi-tabela>
    </urbi-card>`;
}

function relatorioConteudo(d: Linha) {
  const c = d.conteudo ?? { publicadas: 0, publicadas_anterior: 0 };
  const insta = (d.atual.por_origem as Linha[]).find((o) => o.canal === 'instagram');
  const instaAntes = (d.anterior.por_origem as Linha[]).find((o) => o.canal === 'instagram');
  return html`<urbi-grid min="160px">
      ${kpi('Peças publicadas', c.publicadas, variacao(d.dias, c.publicadas, c.publicadas_anterior))}
      ${kpi('Leads do Instagram', insta?.leads ?? 0, variacao(d.dias, insta?.leads ?? 0, instaAntes?.leads ?? 0))}
    </urbi-grid>
    <urbi-card titulo="O que ainda não aparece" icone="fa-solid fa-circle-info">
      <urbi-prosa papel="secundario">
        Alcance, cliques e leads de cada peça precisam das métricas do Instagram por publicação, que o app ainda não lê.
        Por enquanto, os leads que chegam pelo Instagram contam pela origem do contato.
      </urbi-prosa>
      <urbi-linha><urbi-botao variante="secundario" pequeno href=${urbiVerso.href('/estudio')}>Abrir o Estúdio</urbi-botao></urbi-linha>
    </urbi-card>`;
}

function relatorioSemFonte(rel: Relatorio) {
  const textos: Record<string, [string, string]> = {
    tempo: ['O tempo de resposta chega com o WhatsApp', 'Quanto você (e o Mensageiro) leva para responder um contato depende das conversas pelo WhatsApp, que ainda não estão disponíveis.'],
    mensageiro: ['Em breve: o relatório do Mensageiro', 'Atendimentos do Mensageiro e quantos viraram visita aparecem aqui quando ele chegar, com o WhatsApp.'],
  };
  const [mensagem, submensagem] = textos[rel.id] ?? ['Em breve', ''];
  return estadoTela('vazio', { icone: rel.emBreve ? 'fa-solid fa-hourglass-half' : 'fa-solid fa-stopwatch', mensagem, submensagem });
}

// ── Relatório Negociação (D6, spec 11.2) ─────────────────────────────────────
// Só agregados da conta. Sem dado, uma frase no lugar do número (convenção §1), nunca zero.

const media = (v: number | null, casas = 1) => (v === null ? null : v.toLocaleString('pt-BR', { maximumFractionDigits: casas }));

function kpiOuFrase(rotulo: string, valor: string | null, frase: string, detalhe = '') {
  return valor === null
    ? html`<urbi-stack>
        <urbi-prosa papel="secundario">${rotulo}</urbi-prosa>
        <urbi-prosa papel="dica">${frase}</urbi-prosa>
      </urbi-stack>`
    : kpi(rotulo, valor, detalhe);
}

function relatorioNegociacao(n: Linha) {
  const a = n.atual as Linha;
  const b = n.anterior as Linha;
  const v = (x: number | null, y: number | null, t = false) => variacao(n.dias, x, y, t);
  const objecoes = a.objecoes as { categoria: string; quantidade: number }[];
  const com = (base: string, x: number | null, y: number | null, t = false) => {
    const c = v(x, y, t);
    return c ? (base ? `${base} · ${c}` : c) : base;
  };
  // Período anterior alinhado às categorias exibidas (as do atual); categoria ausente no anterior conta 0 objeções.
  const objecoesAntes = (b.objecoes as { categoria: string; quantidade: number }[]) ?? [];
  const desconto = a.desconto_medio === null ? null : `${(Math.round(a.desconto_medio * 1000) / 10).toLocaleString('pt-BR')}%`;
  return html`<urbi-grid min="160px">
      ${kpiOuFrase('Propostas recebidas', a.propostas_recebidas ? a.propostas_recebidas.toLocaleString('pt-BR') : null, 'Nenhuma proposta no período',
        v(a.propostas_recebidas, b.propostas_recebidas))}
      ${kpiOuFrase('Taxa de acordo', a.taxa_acordo === null ? null : pct(a.taxa_acordo), 'Nenhuma negociação encerrada no período',
        `${a.ganhas} de ${a.encerradas} encerradas${v(a.taxa_acordo, b.taxa_acordo, true) ? ` · ${v(a.taxa_acordo, b.taxa_acordo, true)}` : ''}`)}
      ${kpiOuFrase('Desconto médio', desconto, 'Nenhum acordo com preço pedido no período',
        com('Sobre o preço pedido, nos acordos', a.desconto_medio, b.desconto_medio, true))}
      ${kpiOuFrase('Rodadas até o acordo', media(a.rodadas_medias), 'Nenhum acordo no período',
        com('Média nos acordos do período', a.rodadas_medias, b.rodadas_medias))}
    </urbi-grid>
    <urbi-card titulo="Acordos e o Negociador" icone="fa-solid fa-handshake">
      <urbi-grid min="160px">
        ${kpiOuFrase('Acordos dentro da ZOPA', a.dentro_zopa === null ? null : pct(a.dentro_zopa),
          a.ganhas ? 'Nenhum acordo com o teto do comprador estimado' : 'Nenhum acordo no período',
          com(a.zopa_sem_estimativa ? `${a.zopa_sem_estimativa} acordo(s) sem recuo, teto estimado do comprador ou valor final ficaram de fora` : 'Entre o seu recuo e o teto estimado do comprador',
            a.dentro_zopa, b.dentro_zopa, true))}
        ${kpiOuFrase('Sugestões aprovadas sem edição', a.taxa_sem_edicao === null ? null : pct(a.taxa_sem_edicao), 'Nenhuma sugestão do Negociador enviada no período',
          com(`${a.sugestoes_sem_edicao} de ${a.sugestoes_enviadas} enviadas`, a.taxa_sem_edicao, b.taxa_sem_edicao, true))}
      </urbi-grid>
    </urbi-card>
    <urbi-card titulo="Objeções mais frequentes" icone="fa-solid fa-comment-dots">
      ${objecoes.length
        ? html`<urbi-grafico-colunas altura="220px" legenda="auto" .categorias=${objecoes.map((o) => rotuloObjecao(o.categoria))}
            .series=${series(objecoes.map((o) => o.quantidade), objecoes.map((o) => objecoesAntes.find((x) => x.categoria === o.categoria)?.quantidade ?? 0))}></urbi-grafico-colunas>`
        : html`<urbi-prosa papel="dica">Nenhuma objeção registrada no período.</urbi-prosa>`}
    </urbi-card>
    <urbi-prosa papel="fraco">Só números somados da conta: nenhum valor do mandato aparece aqui. O filtro de origem não vale neste relatório.</urbi-prosa>`;
}

function centroNegociacao() {
  const n = estado.negociacao;
  if (!n || n.dias !== lerFiltros().dias) {
    return estado.falhaNegociacao
      ? estadoDaFalha(estado.falhaNegociacao, () => void carregarNegociacao())
      : estadoTela('carregando', { mensagem: 'Carregando a negociação…' });
  }
  return relatorioNegociacao(n);
}

function centro(rel: Relatorio) {
  const d = estado.dados;
  let corpo: unknown;
  if (rel.id === 'negociacao') corpo = centroNegociacao();
  else if (rel.emBreve || rel.id === 'tempo') corpo = relatorioSemFonte(rel);
  else if (!d) corpo = estado.falha ? estadoDaFalha(estado.falha, () => void carregar()) : estadoTela('carregando', { mensagem: 'Carregando os números…' });
  else if (rel.id === 'funil') corpo = relatorioFunil(d);
  else if (rel.id === 'origem') corpo = relatorioOrigem(d);
  else if (rel.id === 'conteudo') corpo = relatorioConteudo(d);
  else corpo = relatorioResumo(d);
  return html`<urbi-stack>
    ${cabecalho(rel)}
    ${estado.falha && d ? estadoTela('erro', { mensagem: 'Não foi possível atualizar os números.', aoTentar: () => void carregar() }) : nothing}
    ${corpo}
  </urbi-stack>`;
}

// ── Esquerda e direita ───────────────────────────────────────────────────────

function lista(rel: Relatorio) {
  return html`<urbi-stack>
    <urbi-stack>
      <urbi-prosa papel="titulo">Números</urbi-prosa>
      <urbi-prosa papel="secundario">${PERIODOS.find((p) => p.valor === String(lerFiltros().dias))?.rotulo === '12 meses' ? 'Últimos 12 meses' : `Últimos ${lerFiltros().dias} dias`}</urbi-prosa>
    </urbi-stack>
    <urbi-lista clicavel separador .itens=${RELATORIOS} .itemAtivo=${(r: Relatorio) => r.id === rel.id}
      .render_item=${(r: Relatorio) => html`<urbi-linha justificar="entre">
        <urbi-stack>
          <urbi-prosa>${r.titulo}</urbi-prosa>
          <urbi-prosa papel="fraco">${r.descricao}</urbi-prosa>
        </urbi-stack>
        ${r.emBreve ? html`<urbi-badge>em breve</urbi-badge>` : nothing}
      </urbi-linha>`}
      @urbi:lista-click=${(e: CustomEvent) => mudar({ relatorio: (e.detail.item as Relatorio).id }, false)}></urbi-lista>
  </urbi-stack>`;
}

/** [Ver os N clientes]: Clientes com quem foi perdido pelo motivo, desde o início do período (e da origem filtrada). */
function verClientes(m: Linha) {
  const q = new URLSearchParams({ perdido_motivo: m.motivo, perdido_desde: m.perdido_desde });
  const { origem } = lerFiltros();
  if (origem) q.set('perdido_origem', origem);
  urbiVerso.navegarSub(`/clientes?${q}`);
}

function exportarCsv() {
  const d = estado.dados;
  if (!d) return;
  const { cabecalho: cab, linhas } = linhasCsvNumeros(d as RespostaNumeros, canal, motivo);
  const url = URL.createObjectURL(new Blob([gerarCsv(cab, linhas)], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `numeros-${d.dias}-dias.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function contexto() {
  const d = estado.dados;
  if (!d) return nothing;
  const m = d.o_que_melhorar as Linha;
  const melhores = d.melhores_origens as Linha[];
  return html`<urbi-stack>
    <urbi-card titulo="O que melhorar" icone="fa-solid fa-lightbulb">
      <urbi-stack>
        <urbi-prosa>${m.texto}</urbi-prosa>
        ${m.motivo && m.clientes
          ? html`<urbi-linha><urbi-botao pequeno icone="fa-solid fa-users" @click=${() => verClientes(m)}>Ver os ${m.clientes} ${m.clientes === 1 ? 'cliente' : 'clientes'}</urbi-botao></urbi-linha>`
          : nothing}
        <urbi-prosa papel="fraco">Leitura feita com os números do período, sem IA.</urbi-prosa>
      </urbi-stack>
    </urbi-card>
    <urbi-card titulo="Melhores origens" icone="fa-solid fa-ranking-star">
      ${melhores.length
        ? html`<urbi-lista separador .itens=${melhores} .render_item=${(o: Linha) => html`<urbi-linha justificar="entre">
            <urbi-prosa>${canal(o.canal)}</urbi-prosa>
            <urbi-prosa papel="secundario">${o.visitaram} ${o.visitaram === 1 ? 'visita' : 'visitas'} · ${o.leads} ${o.leads === 1 ? 'lead' : 'leads'}</urbi-prosa>
          </urbi-linha>`}></urbi-lista>`
        : html`<urbi-prosa papel="dica">Nenhum lead no período.</urbi-prosa>`}
    </urbi-card>
    <urbi-linha quebrar>
      <urbi-botao variante="secundario" icone="fa-solid fa-file-csv" @click=${() => exportarCsv()}>Exportar CSV</urbi-botao>
      <urbi-botao variante="fantasma" icone="fa-solid fa-comments" @click=${() => abrirAssistente()}>Perguntar ao Assistente</urbi-botao>
    </urbi-linha>
  </urbi-stack>`;
}

export function renderNumeros(atualizar: () => void) {
  redesenhar = atualizar;
  const { relatorio } = lerFiltros();
  return moldura(
    { menu: '/numeros', lista: lista(relatorio), centro: centro(relatorio), contexto: contexto(), rotulos: { lista: 'Relatórios', centro: relatorio.titulo, contexto: 'O que melhorar' } },
    atualizar,
  );
}
