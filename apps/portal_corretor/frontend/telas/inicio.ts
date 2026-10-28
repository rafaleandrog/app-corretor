import { html, nothing } from 'lit';
import type { UrbiVersoAPI } from '@urbiverso/sdk';
import { abaDaUrl, abaNaUrl, acoesComMais, avisoCreci, chamarApi, chip, dataHora, enviar, mensagemDeErro, reais, type Acao, type OpcoesAba } from '../apoio.js';
import { ABAS_INICIO, APELIDOS_INICIO, type TipoFila } from '../../comum/funil';
import { ACOES_FILA, dicaDoAssistente, FILA_VISIVEL, TIPO_NA_FILA, type AcaoFila, type PassoInicial } from '../../comum/hoje';
import { DICA_IA_INDISPONIVEL, estadoDaFalha, estadoTela } from '../estados.js';
import { moldura } from '../moldura.js';
import { abrirAssistente } from './assistente.js';
import './agenda.js';

declare const urbiVerso: UrbiVersoAPI;

interface ItemFila {
  tipo: TipoFila;
  contato_id: number;
  contato_nome: string;
  temperatura: string | null;
  quando: string | null;
  texto: string;
  atividade_id?: number;
}

interface Passagem {
  negociacao_id: number;
  codigo: string | null;
  contato_id: number | null;
  contato_nome: string;
  motivo: string;
}

interface Compromisso {
  id: number;
  tipo: string;
  titulo: string;
  quando: string;
  contato_nome: string | null;
}

interface DadosHoje {
  fila: ItemFila[];
  passagens: Passagem[];
  agenda_hoje: Compromisso[];
  primeiros_passos: PassoInicial[];
  sem_creci: boolean;
  semana: Record<string, number | null> | null;
  demo_disponivel: boolean;
}

const ABAS = ABAS_INICIO.map((a) => a.id);
// `/agenda` é apelido da Agenda (D-82); escolher a visão leva a barra para `/`.
const OPCOES_ABA: OpcoesAba = { apelidos: APELIDOS_INICIO, rota: '/' };

/** A visão do endereço que está na barra agora: a fila do dia (`hoje`) ou a agenda de 14 dias. */
export const abaInicio = () => abaDaUrl(ABAS, OPCOES_ABA);

// Hoje (spec 11.1 P01, 11.5 M1) na moldura do Padrão B. Esquerda: o cabeçalho do dia, "Precisa de
// você" e os Primeiros passos. Centro: a fila do dia em cartões de ação, na ordem de `filaDoDia`, ou a
// agenda de 14 dias ("Ver agenda"). Direita: a agenda de hoje, a semana em 4 números e a Dica do
// Assistente. Os dados vêm de uma chamada só (`GET /inicio`) e ficam fora do componente, como os da
// moldura: as três colunas leem o mesmo estado, e o app pede o redesenho.
const estado = {
  dados: null as DadosHoje | null,
  falha: null as unknown,
  /** Slot de IA liberado (`GET /assistente/ia`); `null` enquanto a sonda não voltou. */
  ia: null as boolean | null,
  carregando: false,
  /** Marcado a cada entrada na tela (e na troca de conta): o próximo desenho recarrega. */
  vencido: true,
  verTudo: false,
  gerandoDemo: false,
  geracao: 0,
};

/** O app avisa que o corretor entrou em Hoje (ou trocou de conta): os dados são relidos. */
export function aoAbrirHoje() {
  estado.vencido = true;
  estado.verTudo = false;
}

async function carregar(atualizar: () => void) {
  const geracao = ++estado.geracao;
  estado.carregando = true;
  estado.vencido = false;
  estado.falha = null;
  try {
    const [dados, ia] = await Promise.all([chamarApi('/inicio'), chamarApi('/assistente/ia').then((r) => !!r?.assistente, () => false)]);
    if (geracao !== estado.geracao) return;
    estado.dados = dados;
    estado.ia = ia;
  } catch (e) {
    if (geracao === estado.geracao) estado.falha = e;
  } finally {
    if (geracao === estado.geracao) estado.carregando = false;
    atualizar();
  }
}

async function registrar(caminho: () => Promise<unknown>, atualizar: () => void) {
  try {
    await caminho();
    urbiVerso.notificar('Registrado.', 'sucesso');
    await carregar(atualizar);
  } catch (e) {
    await urbiVerso.alertar({ titulo: 'Não foi possível registrar', mensagem: mensagemDeErro(e), tipo: 'erro' });
  }
}

async function gerarDemo(atualizar: () => void) {
  estado.gerandoDemo = true;
  atualizar();
  try {
    await enviar('POST', '/demo/semear', {});
    urbiVerso.notificar('Dados de demonstração criados.', 'sucesso');
    await carregar(atualizar);
  } catch (e) {
    await urbiVerso.alertar({ titulo: 'Não foi possível gerar', mensagem: mensagemDeErro(e), tipo: 'alerta' });
  } finally {
    estado.gerandoDemo = false;
    atualizar();
  }
}

function mudarVisao(id: string, atualizar: () => void) {
  if (!ABAS.includes(id as (typeof ABAS)[number])) return;
  abaNaUrl(id === 'hoje' ? '' : id, OPCOES_ABA);
  atualizar();
}

/** Cada nome de `ACOES_FILA` ligado ao que ele faz; um principal e no máximo um no "Mais". */
function acaoDe(nome: AcaoFila, i: ItemFila, atualizar: () => void): Acao {
  const ficha = `/clientes/${i.contato_id}`;
  switch (nome) {
    // Fazer agora leva à ficha já com a mensagem sugerida (`?sugerir=1`); o WhatsApp abre de lá, no clique do corretor.
    case 'fazer_agora':
      return { rotulo: 'Fazer agora', icone: 'fa-solid fa-paper-plane', sub: `${ficha}?sugerir=1` };
    case 'fiz':
      return { rotulo: 'Fiz', icone: 'fa-solid fa-check', aoEscolher: () => registrar(() => enviar('POST', `/abordagens/${i.contato_id}/feita`, { texto: i.texto }), atualizar) };
    case 'visita_feita':
      return {
        rotulo: 'Visita feita',
        icone: 'fa-solid fa-check',
        aoEscolher: () => registrar(() => enviar('PATCH', `/atividades/${i.atividade_id}`, { status: 'feita' }), atualizar),
      };
    default:
      return { rotulo: 'Abrir', icone: 'fa-solid fa-user', sub: ficha };
  }
}

function acoesDoItem(i: ItemFila, atualizar: () => void) {
  const regra = ACOES_FILA[i.tipo];
  // "Visita feita" precisa da atividade; sem ela, o cartão fica só com o principal.
  const secundaria = regra.secundaria && (regra.secundaria !== 'visita_feita' || i.atividade_id) ? [acaoDe(regra.secundaria, i, atualizar)] : [];
  return acoesComMais(acaoDe(regra.principal, i, atualizar), secundaria);
}

/** Cartão de ação (telas_padrao_b.md §3): chip de tipo, título, uma frase e as ações. */
function cartao(i: ItemFila, atualizar: () => void) {
  const quando = i.quando && i.tipo !== 'quente_sem_resposta' && i.tipo !== 'visita' ? ` · ${dataHora(i.quando)}` : '';
  return html`<urbi-card>
    <urbi-stack>
      <urbi-linha quebrar>
        <urbi-badge cor=${i.tipo === 'quente_sem_resposta' ? 'perigo' : i.tipo === 'abordagem_vencida' ? 'alerta' : 'info'}>${TIPO_NA_FILA[i.tipo]}</urbi-badge>
        ${chip('temperatura', i.temperatura)}
      </urbi-linha>
      <urbi-prosa>${i.contato_nome}</urbi-prosa>
      <urbi-prosa papel="secundario">${i.texto}${quando}</urbi-prosa>
      ${acoesDoItem(i, atualizar)}
    </urbi-stack>
  </urbi-card>`;
}

function hojeExtenso(): string {
  const d = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  return d.charAt(0).toUpperCase() + d.slice(1);
}

function esquerda(d: DadosHoje, atualizar: () => void) {
  const quentes = d.fila.filter((i) => i.tipo === 'quente_sem_resposta');
  const precisa = d.passagens.length + quentes.length;
  const feitos = d.primeiros_passos.filter((p) => p.feito).length;
  const total = d.primeiros_passos.length;
  return html`<urbi-stack>
    <urbi-stack>
      <urbi-prosa papel="titulo">Hoje</urbi-prosa>
      <urbi-prosa papel="fraco">${hojeExtenso()} · Mensageiro: ainda não disponível</urbi-prosa>
    </urbi-stack>
    <urbi-prosa papel="secao">Precisa de você · ${precisa}</urbi-prosa>
    ${precisa
      ? html`<urbi-lista separador .itens=${[...d.passagens.map((p) => ({ p })), ...quentes.map((q) => ({ q }))]}
          .render_item=${(x: { p?: Passagem; q?: ItemFila }) =>
            x.p
              ? html`<urbi-linha justificar="entre">
                  <urbi-stack>
                    <urbi-prosa>${x.p.contato_nome}${x.p.codigo ? ` · ${x.p.codigo}` : ''}</urbi-prosa>
                    <urbi-prosa papel="secundario">${x.p.motivo}</urbi-prosa>
                  </urbi-stack>
                  ${x.p.contato_id
                    ? html`<urbi-botao pequeno icone="fa-solid fa-handshake" href=${urbiVerso.href(`/clientes/${x.p.contato_id}`)}>Abrir</urbi-botao>`
                    : nothing}
                </urbi-linha>`
              : html`<urbi-linha justificar="entre">
                  <urbi-stack>
                    <urbi-prosa>${x.q!.contato_nome}</urbi-prosa>
                    <urbi-prosa papel="secundario">${x.q!.texto}</urbi-prosa>
                  </urbi-stack>
                  <urbi-botao pequeno icone="fa-solid fa-user" href=${urbiVerso.href(`/clientes/${x.q!.contato_id}`)}>Abrir</urbi-botao>
                </urbi-linha>`}></urbi-lista>`
      : html`<urbi-prosa papel="dica">Nenhuma negociação ou cliente quente esperando você agora.</urbi-prosa>`}
    ${feitos < total
      ? html`<urbi-prosa papel="secao">Primeiros passos · ${feitos} de ${total}</urbi-prosa>
          <urbi-bolinhas .estados=${d.primeiros_passos.map((p) => (p.feito ? 'sucesso' : 'vazio'))}></urbi-bolinhas>
          <urbi-lista separador .itens=${d.primeiros_passos} .render_item=${(p: PassoInicial) =>
            p.feito
              ? html`<urbi-linha>
                  <urbi-badge cor="sucesso">Feito</urbi-badge>
                  <urbi-prosa papel="fraco">${p.rotulo}</urbi-prosa>
                </urbi-linha>`
              : html`<urbi-linha justificar="entre">
                  <urbi-prosa>${p.rotulo}</urbi-prosa>
                  <urbi-botao pequeno variante="secundario" href=${urbiVerso.href(p.rota)}>Fazer</urbi-botao>
                </urbi-linha>`}></urbi-lista>`
      : nothing}
    ${d.sem_creci ? avisoCreci() : nothing}
    ${d.demo_disponivel
      ? html`<urbi-banner variante="info">
          Esta é uma conta de teste. Quer ver o app com dados? Gera 10 clientes, negócios em várias etapas, 2 imóveis e visitas.
          <urbi-botao slot="acao" pequeno ?carregando=${estado.gerandoDemo} @click=${() => gerarDemo(atualizar)}>Gerar dados de demonstração</urbi-botao>
        </urbi-banner>`
      : nothing}
  </urbi-stack>`;
}

function centro(d: DadosHoje, atualizar: () => void) {
  const faixaIa = estado.ia === false ? estadoTela('ia_indisponivel') : nothing;
  if (abaInicio() === 'agenda') {
    return html`<urbi-stack>
      ${faixaIa}
      <urbi-linha justificar="entre">
        <urbi-prosa papel="secao">Agenda dos próximos 14 dias</urbi-prosa>
        <urbi-botao pequeno variante="secundario" icone="fa-solid fa-list-check" @click=${() => mudarVisao('hoje', atualizar)}>Voltar para a fila</urbi-botao>
      </urbi-linha>
      <pc-tela-agenda></pc-tela-agenda>
    </urbi-stack>`;
  }
  if (!d.fila.length) {
    // Conta nova (ou dia tranquilo): diz o que aparece aqui e oferece o primeiro passo útil.
    return html`<urbi-stack>
      ${faixaIa}
      ${estadoTela('vazio', {
        icone: 'fa-solid fa-mug-hot',
        mensagem: 'Nada urgente agora',
        submensagem: 'Quentes sem resposta, abordagens atrasadas, visitas de hoje e amanhã e próximos passos vencidos aparecem aqui.',
        acao: { rotulo: 'Cadastrar um cliente', icone: 'fa-solid fa-user-plus', aoEscolher: () => urbiVerso.navegarSub('/clientes?criar=cliente') },
      })}
    </urbi-stack>`;
  }
  const visiveis = estado.verTudo ? d.fila : d.fila.slice(0, FILA_VISIVEL);
  const resto = d.fila.length - visiveis.length;
  return html`<urbi-stack>
    ${faixaIa}
    <urbi-linha justificar="entre">
      <urbi-prosa papel="secao">Fila do dia · ${d.fila.length}</urbi-prosa>
      <urbi-prosa papel="fraco">Na ordem do mais urgente</urbi-prosa>
    </urbi-linha>
    ${visiveis.map((i) => cartao(i, atualizar))}
    ${resto > 0
      ? html`<urbi-linha justificar="centro">
          <urbi-botao variante="secundario" @click=${() => ((estado.verTudo = true), atualizar())}>Mais ${resto} para depois</urbi-botao>
        </urbi-linha>`
      : nothing}
  </urbi-stack>`;
}

const hora = (q: string) => new Date(q).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

function direita(d: DadosHoje, atualizar: () => void) {
  const s = d.semana;
  const dica = dicaDoAssistente(d.fila, d.primeiros_passos);
  return html`<urbi-stack>
    <urbi-card titulo="Agenda de hoje" icone="fa-solid fa-calendar-day">
      <urbi-stack>
        ${d.agenda_hoje.length
          ? html`<urbi-lista separador .itens=${d.agenda_hoje} .render_item=${(a: Compromisso) => html`<urbi-stack>
              <urbi-prosa>${hora(a.quando)} · ${a.titulo}</urbi-prosa>
              ${a.contato_nome ? html`<urbi-prosa papel="fraco">${a.contato_nome}</urbi-prosa>` : nothing}
            </urbi-stack>`}></urbi-lista>`
          : html`<urbi-prosa papel="dica">Nada marcado para hoje.</urbi-prosa>`}
        <urbi-linha>
          <urbi-botao pequeno variante="secundario" icone="fa-solid fa-calendar-week" @click=${() => mudarVisao('agenda', atualizar)}>Ver agenda</urbi-botao>
        </urbi-linha>
      </urbi-stack>
    </urbi-card>
    ${s
      ? html`<urbi-card titulo="Sua semana" icone="fa-solid fa-chart-simple">
          <urbi-grid min="120px">
            <urbi-kpi rotulo="Contatos novos" .valor=${s.novos_contatos ?? 0}></urbi-kpi>
            <urbi-kpi rotulo="Leads" .valor=${s.leads ?? 0}></urbi-kpi>
            <urbi-kpi rotulo="Visitas feitas" .valor=${s.visitas ?? 0}></urbi-kpi>
            <urbi-kpi rotulo="Comissão prevista" formato="texto" .valor=${s.previsao_c === null || s.previsao_c === undefined ? '—' : reais(s.previsao_c)}></urbi-kpi>
          </urbi-grid>
        </urbi-card>`
      : nothing}
    <urbi-card titulo="Dica do Assistente" icone="fa-solid fa-wand-magic-sparkles">
      <urbi-stack>
        <urbi-prosa>${dica}</urbi-prosa>
        <urbi-linha>
          <urbi-botao pequeno icone="fa-solid fa-comments" ?desabilitado=${estado.ia === false} title=${estado.ia === false ? DICA_IA_INDISPONIVEL : nothing}
            @click=${() => abrirAssistente()}>Perguntar ao Assistente</urbi-botao>
        </urbi-linha>
        ${estado.ia === false ? html`<urbi-prosa papel="fraco">${DICA_IA_INDISPONIVEL}</urbi-prosa>` : nothing}
      </urbi-stack>
    </urbi-card>
  </urbi-stack>`;
}

/** Hoje na moldura: trilho · esquerda · centro · direita (abas no celular, M1). */
export function renderHoje(atualizar: () => void) {
  if (estado.vencido && !estado.carregando) void carregar(atualizar);
  const d = estado.dados;
  const rotulos = { lista: 'Hoje', centro: 'Fila', contexto: 'Agenda' };
  if (!d) {
    const conteudo = estado.falha ? estadoDaFalha(estado.falha, () => carregar(atualizar)) : estadoTela('carregando');
    return moldura({ menu: '/', centro: conteudo }, atualizar);
  }
  return moldura({ menu: '/', lista: esquerda(d, atualizar), centro: centro(d, atualizar), contexto: direita(d, atualizar), rotulos }, atualizar);
}
