import { html, nothing } from 'lit';
import type { UrbiVersoAPI } from '@urbiverso/sdk';
import { abaDaUrl, abaNaUrl, avisoCreci, chamarApi, chip, contaDeTrabalho, dataHora, enviar, gesto, lerPreparandoFunil, mensagemDeErro, noCelular, noGesto, reais, type OpcoesAba } from '../apoio.js';
import { ABAS_INICIO, APELIDOS_INICIO, type TipoFila } from '../../comum/funil';
import { ACOES_FILA, cargaVazia, entrarEmHoje, FILA_VISIVEL, iniciarCarga, marcarEntrada, mostrarTudo, motivoDoItem, precisaCarregar, receberCarga, telaDeHoje, type AcaoFila, type PassoInicial } from '../../comum/hoje';
import { DICA_IA_INDISPONIVEL, estadoDaFalha, estadoTela } from '../estados.js';
import { cabecalhoColuna, moldura } from '../moldura.js';
import { abrirCriar } from '../atalhos.js';
import { irParaComQuery } from '../criar.js';
import { abrirAssistente, abrirAssistenteCom, assistenteAberto } from './assistente.js';
import { abrirNegociacao, novaProposta } from './negociacoes.js';
import { abrirConversaDoContato } from './conversas.js';
import './agenda.js';

declare const urbiVerso: UrbiVersoAPI;

interface ItemFila {
  tipo: TipoFila;
  contato_id: number | null;
  contato_nome: string;
  temperatura: string | null;
  quando: string | null;
  texto: string;
  atividade_id?: number;
  negociacao_id?: number;
  peca_id?: number;
  imovel_id?: number;
}

interface Passagem {
  negociacao_id: number;
  codigo: string | null;
  contato_id: number | null;
  contato_nome: string;
  conversa_id?: number | null;
  motivo: string;
}

interface Compromisso {
  id: number;
  tipo: string;
  titulo: string;
  quando: string;
  contato_nome: string | null;
}

interface AcaoDica {
  tipo: string;
  resumo: string;
  rota: string;
  corpo: Record<string, unknown>;
}

interface DadosHoje {
  fila: ItemFila[];
  passagens: Passagem[];
  agenda_hoje: Compromisso[];
  primeiros_passos: PassoInicial[];
  sem_creci: boolean;
  semana: Record<string, number | null> | null;
  demo_disponivel: boolean;
  dica?: { texto: string; acao: AcaoDica | null } | null;
}

const ABAS = ABAS_INICIO.map((a) => a.id);
// `/agenda` é apelido da Agenda (D-82); escolher a visão leva a barra para `/`.
const OPCOES_ABA: OpcoesAba = { apelidos: APELIDOS_INICIO, rota: '/' };

/** A visão do endereço que está na barra agora: a fila do dia (`hoje`) ou a agenda de 14 dias. */
export const abaInicio = () => abaDaUrl(ABAS, OPCOES_ABA);

// Hoje (spec 11.1 P01, 11.5 M1) na moldura do Padrão B. Esquerda: o cabeçalho do dia com as abas Hoje ·
// Agenda (D-82), "Precisa de você" (só as passagens, com Assumir) e os Primeiros passos. Centro: a fila
// do dia em cartões de ação, na ordem de `filaDoDia`, ou a agenda de 14 dias. Direita: a agenda de
// hoje, a semana em 4 números e a Dica do Assistente, com a ação proposta. No celular (M1), sem as abas
// das colunas: a linha de atalhos do dia, "Precisa de você", a fila em linhas compactas e, embaixo, o
// contexto, numa só rolagem (`renderHoje`). Os dados vêm de uma chamada só (`GET /inicio`) e ficam fora do
// componente, como os da moldura: as três colunas leem o mesmo estado, e o app pede o redesenho.
const estado = {
  /** Dados, falha e carga de UMA conta (comum/hoje.ts); só se desenha o que é da conta ativa. */
  carga: cargaVazia<DadosHoje>(),
  /** Slot de IA liberado (`GET /assistente/ia`); `null` enquanto a sonda não voltou. */
  ia: null as boolean | null,
  gerandoDemo: false,
  /** Assumir em voo (o id da negociação), para o botão não ser clicado duas vezes. */
  assumindo: null as number | null,
  /** A ação da Dica em voo. */
  fazendoDica: false,
  /** "Fiz", "Visita feita" ou "Agora não" em voo (a chave do botão), para o registro não sair duas vezes. */
  registrando: null as string | null,
};

/** O app avisa que o corretor entrou em Hoje (ou trocou de conta): os dados são relidos. */
export function aoAbrirHoje() {
  trocarDeConta();
  estado.carga = marcarEntrada(estado.carga);
}

/** Conta diferente da dona dos dados: zera tudo (e a sonda de IA) e deixa a recarga pendente, antes de qualquer desenho. */
function trocarDeConta() {
  const antes = estado.carga;
  estado.carga = entrarEmHoje(antes, contaDeTrabalho());
  if (estado.carga !== antes) estado.ia = null;
}

async function carregar(atualizar: () => void) {
  trocarDeConta();
  estado.carga = iniciarCarga(estado.carga);
  atualizar();
  const geracao = estado.carga.geracao;
  // A carga é da conta de agora: trocada no meio, a resposta (ou a falha) não é gravada como desta.
  const g = gesto();
  try {
    const [dados, ia] = await g.esperar(Promise.all([lerPreparandoFunil('/inicio'), chamarApi('/assistente/ia').then((r) => !!r?.assistente, () => false)]));
    const antes = estado.carga;
    estado.carga = receberCarga(antes, geracao, { dados });
    if (estado.carga !== antes) estado.ia = ia;
  } catch (e) {
    if (!g.encerrado(e)) estado.carga = receberCarga(estado.carga, geracao, { falha: e });
  } finally {
    atualizar();
  }
}

/**
 * "Fiz", "Visita feita" e "Agora não": envio → aviso → recarga, num gesto da conta em que o cartão foi
 * clicado. Trocada a conta com o envio em voo, termina em silêncio (nem aviso, nem alerta, nem recarga de lá).
 * Com um registro em voo, outro clique não envia de novo (como o Assumir e a Dica).
 */
function registrar(chave: string, caminho: () => Promise<unknown>, atualizar: () => void, aviso = 'Registrado.') {
  return noGesto(async (g) => {
    if (estado.registrando !== null || !g.vivo()) return;
    estado.registrando = chave;
    atualizar();
    try {
      try {
        await g.esperar(caminho());
      } catch (e) {
        if (g.encerrado(e)) throw e;
        await g.esperar(urbiVerso.alertar({ titulo: 'Não foi possível registrar', mensagem: mensagemDeErro(e), tipo: 'erro' }));
        return;
      }
      urbiVerso.notificar(aviso, 'sucesso');
      await carregar(atualizar);
    } finally {
      estado.registrando = null;
      atualizar();
    }
  });
}

/** Gerar a demonstração: o mesmo gesto calado se a conta muda com o POST em voo. */
async function gerarDemo(atualizar: () => void) {
  const g = gesto();
  if (!g.vivo()) return;
  estado.gerandoDemo = true;
  atualizar();
  try {
    await g.esperar(enviar('POST', '/demo/semear', {}));
    urbiVerso.notificar('Dados de demonstração criados.', 'sucesso');
    await carregar(atualizar);
  } catch (e) {
    if (!g.encerrado(e)) await urbiVerso.alertar({ titulo: 'Não foi possível gerar', mensagem: mensagemDeErro(e), tipo: 'alerta' });
  } finally {
    // O "gerando" é da tela, não da conta: volta ao normal mesmo com a conta trocada (senão o botão fica preso).
    estado.gerandoDemo = false;
    atualizar();
  }
}

function mudarVisao(id: string, atualizar: () => void) {
  if (!ABAS.includes(id as (typeof ABAS)[number])) return;
  abaNaUrl(id === 'hoje' ? '' : id, OPCOES_ABA);
  atualizar();
}

/**
 * Assumir uma passagem (spec 11.1 P01): `POST /negociacoes/:id/assumir` e a negociação abre já assumida
 * (P15); quando o Negociador atende a conversa do cliente, `POST /conversas/:id/assumir` e abre a P02.
 * Conta trocada no meio: nada é aberto na outra.
 */
function assumir(p: Passagem, atualizar: () => void) {
  return noGesto(async (g) => {
    if (estado.assumindo !== null || !g.vivo()) return;
    estado.assumindo = p.negociacao_id;
    atualizar();
    try {
      await g.esperar(enviar('POST', `/negociacoes/${p.negociacao_id}/assumir`));
      if (p.conversa_id) {
        await g.esperar(enviar('POST', `/conversas/${p.conversa_id}/assumir`));
        urbiVerso.notificar('Você assumiu a conversa e a negociação.', 'sucesso');
        irParaComQuery(`/conversas?item=${p.conversa_id}`);
      } else {
        urbiVerso.notificar('Você assumiu a negociação.', 'sucesso');
        abrirNegociacao(p.negociacao_id);
      }
    } catch (e) {
      if (g.encerrado(e)) throw e;
      await g.esperar(urbiVerso.alertar({ titulo: 'Não foi possível assumir', mensagem: mensagemDeErro(e), tipo: 'erro' }));
    } finally {
      estado.assumindo = null;
      atualizar();
    }
  });
}

/** Registrar proposta (cartão "Proposta recebida"): o fluxo de Nova proposta com o cliente já escolhido, e abre a negociação (P15). */
function registrarProposta(i: ItemFila) {
  return noGesto(async (g) => {
    const n = await g.esperar(novaProposta(i.contato_id ? { id: i.contato_id, nome: i.contato_nome } : null));
    if (n) abrirNegociacao(n);
  });
}

/** A Dica com ação: confirma (`urbiVerso.confirmar`) e executa pela rota de sempre (a mesma do Assistente). */
function fazerDica(acao: AcaoDica, atualizar: () => void) {
  return noGesto(async (g) => {
    if (estado.fazendoDica) return;
    const ok = await g.esperar(urbiVerso.confirmar({ titulo: 'Posso fazer isto?', mensagem: acao.resumo, rotuloConfirmar: 'Confirmar', rotuloCancelar: 'Agora não' }));
    if (!ok) return;
    estado.fazendoDica = true;
    atualizar();
    try {
      await g.esperar(enviar('POST', acao.rota, acao.corpo));
      urbiVerso.notificar('Feito.', 'sucesso');
      await carregar(atualizar);
    } catch (e) {
      if (g.encerrado(e)) throw e;
      await g.esperar(urbiVerso.alertar({ titulo: 'Não deu para fazer', mensagem: mensagemDeErro(e), tipo: 'erro' }));
    } finally {
      estado.fazendoDica = false;
      atualizar();
    }
  });
}

interface Botao {
  rotulo: string;
  icone?: string;
  perigo?: boolean;
  /** Link para sub-rota da app. */
  sub?: string;
  aoEscolher?: () => void;
  /** O registro deste botão está em voo. */
  carregando?: boolean;
}

const primeiroNome = (nome: string) => nome.split(' ')[0] || nome;

/** Cada nome de `ACOES_FILA` ligado ao que ele faz (spec 11.1 P01). */
function acaoDe(nome: AcaoFila, i: ItemFila, atualizar: () => void): Botao {
  const ficha = `/clientes/${i.contato_id}`;
  switch (nome) {
    // Fazer agora leva à ficha já com a mensagem sugerida (`?sugerir=1`); o WhatsApp abre de lá, no clique do corretor.
    case 'fazer_agora':
      return { rotulo: 'Fazer agora', icone: 'fa-solid fa-paper-plane', sub: `${ficha}?sugerir=1` };
    case 'fiz': {
      const chave = `fiz:${i.contato_id}`;
      return { rotulo: 'Fiz', icone: 'fa-solid fa-check', carregando: estado.registrando === chave, aoEscolher: () => registrar(chave, () => enviar('POST', `/abordagens/${i.contato_id}/feita`, { texto: i.texto }), atualizar) };
    }
    case 'visita_feita': {
      const chave = `visita:${i.atividade_id}`;
      return { rotulo: 'Visita feita', icone: 'fa-solid fa-check', carregando: estado.registrando === chave, aoEscolher: () => registrar(chave, () => enviar('PATCH', `/atividades/${i.atividade_id}`, { status: 'feita' }), atualizar) };
    }
    // "Falar com Ana": a conversa do contato (P02).
    case 'falar':
      return { rotulo: `Falar com ${primeiroNome(i.contato_nome)}`, icone: 'fa-regular fa-comments', aoEscolher: () => void abrirConversaDoContato(i.contato_id!) };
    case 'responder':
      return { rotulo: 'Responder', icone: 'fa-solid fa-reply', aoEscolher: () => abrirNegociacao(i.negociacao_id!) };
    case 'registrar_proposta':
      return { rotulo: 'Registrar proposta', icone: 'fa-solid fa-hand-holding-dollar', aoEscolher: () => void registrarProposta(i) };
    // Revisar abre o Estúdio na peça (P08, `?item=`).
    case 'revisar':
      return { rotulo: 'Revisar', icone: 'fa-solid fa-wand-magic-sparkles', sub: `/estudio?item=${i.peca_id}` };
    // Abrir o imóvel na autorização (P06, `?secao=autorizacao`, o mesmo destino do evento `autorizacao_vencendo`).
    case 'abrir_imovel':
      return { rotulo: 'Abrir', icone: 'fa-solid fa-file-signature', sub: `/imoveis?item=${i.imovel_id}&secao=autorizacao` };
    default:
      return { rotulo: 'Abrir', icone: 'fa-solid fa-user', sub: ficha };
  }
}

/** "Agora não" (no "Mais" de todo cartão de contato): adia a abordagem, `POST /abordagens/:contato/adiar`. */
const agoraNao = (i: ItemFila, atualizar: () => void): Botao => ({
  rotulo: 'Agora não',
  icone: 'fa-solid fa-clock-rotate-left',
  aoEscolher: () => registrar(`adiar:${i.contato_id}`, () => enviar('POST', `/abordagens/${i.contato_id}/adiar`, {}), atualizar, 'Deixado para depois.'),
});

const botao = (b: Botao, variante?: string) =>
  b.sub
    ? html`<urbi-botao variante=${variante ?? nothing} icone=${b.icone ?? nothing} href=${urbiVerso.href(b.sub)}>${b.rotulo}</urbi-botao>`
    : html`<urbi-botao variante=${variante ?? nothing} icone=${b.icone ?? nothing} ?carregando=${!!b.carregando} @click=${() => b.aoEscolher?.()}>${b.rotulo}</urbi-botao>`;

/** As ações do cartão (princípio 14): um principal, um secundário visível e o resto no "Mais" (com "Agora não"). */
function acoesDoItem(i: ItemFila, atualizar: () => void) {
  const regra = ACOES_FILA[i.tipo];
  // "Visita feita" precisa da atividade; "Falar com" precisa do contato.
  const cabe = (a: AcaoFila) => (a === 'visita_feita' ? !!i.atividade_id : a === 'falar' || a === 'fiz' ? !!i.contato_id : true);
  const secundaria = regra.secundaria && cabe(regra.secundaria) ? acaoDe(regra.secundaria, i, atualizar) : null;
  const mais = [...regra.mais.filter(cabe).map((a) => acaoDe(a, i, atualizar)), ...(i.contato_id ? [agoraNao(i, atualizar)] : [])];
  return html`<urbi-linha quebrar>
    ${botao(acaoDe(regra.principal, i, atualizar))}
    ${secundaria ? botao(secundaria, 'secundario') : nothing}
    ${mais.length
      ? html`<urbi-dropdown flutuante>
          <urbi-botao slot="trigger" variante="secundario" icone="fa-solid fa-ellipsis" ariaLabel="Mais" title="Mais"></urbi-botao>
          <div slot="menu">
            ${mais.map((a) => html`<urbi-dropdown-item icone=${a.icone ?? nothing} ?perigo=${!!a.perigo} @urbi:dropdown-select=${() => (a.sub ? urbiVerso.navegarSub(a.sub) : a.aoEscolher?.())}>${a.rotulo}</urbi-dropdown-item>`)}
          </div>
        </urbi-dropdown>`
      : nothing}
  </urbi-linha>`;
}

const COR_MOTIVO: Partial<Record<TipoFila, string>> = { quente_sem_resposta: 'erro', abordagem_vencida: 'alerta', proposta_recebida: 'sucesso', prazo_autorizacao: 'alerta' };

/** Cartão de ação (telas_padrao_b.md §3): chip de motivo, temperatura, nome, uma frase e as ações. */
function cartao(i: ItemFila, atualizar: () => void) {
  const quando = i.quando && i.tipo !== 'quente_sem_resposta' && i.tipo !== 'visita' && i.tipo !== 'prazo_autorizacao' ? ` · ${dataHora(i.quando)}` : '';
  return html`<urbi-card>
    <urbi-linha alinhar="inicio">
      <urbi-avatar nome=${i.contato_nome} tamanho="40" icone=${i.contato_id ? '' : i.tipo === 'peca_aguardando' ? 'fa-solid fa-wand-magic-sparkles' : 'fa-solid fa-file-signature'}></urbi-avatar>
      <urbi-stack expandir>
        <urbi-linha quebrar>
          <urbi-badge cor=${COR_MOTIVO[i.tipo] ?? 'info'}>${motivoDoItem(i)}</urbi-badge>
          ${chip('temperatura', i.temperatura)}
        </urbi-linha>
        <urbi-prosa>${i.contato_nome}</urbi-prosa>
        <urbi-prosa papel="secundario">${i.texto}${quando}</urbi-prosa>
        ${acoesDoItem(i, atualizar)}
      </urbi-stack>
    </urbi-linha>
  </urbi-card>`;
}

/** Cartão compacto do celular (M1): uma linha de ~48 px com avatar, nome, motivo e o botão principal. */
function cartaoCompacto(i: ItemFila, atualizar: () => void) {
  const regra = ACOES_FILA[i.tipo];
  return html`<urbi-linha justificar="entre">
    <urbi-avatar nome=${i.contato_nome} tamanho="36"></urbi-avatar>
    <urbi-stack expandir>
      <urbi-prosa truncar>${i.contato_nome}</urbi-prosa>
      <urbi-prosa papel="secundario" truncar>${motivoDoItem(i)} · ${i.texto}</urbi-prosa>
    </urbi-stack>
    ${botao(acaoDe(regra.principal, i, atualizar))}
  </urbi-linha>`;
}

function hojeExtenso(): string {
  const d = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  return d.charAt(0).toUpperCase() + d.slice(1);
}

/** A linha de atalhos do dia do celular (M1, spec 11.5): Conversas · Criar · Imóveis · Assistente. */
function atalhosDoDia() {
  return html`<urbi-linha quebrar>
    <urbi-botao variante="secundario" icone="fa-regular fa-comments" href=${urbiVerso.href('/conversas')}>Conversas</urbi-botao>
    <urbi-botao variante="secundario" icone="fa-solid fa-plus" @click=${() => void abrirCriar()}>Criar</urbi-botao>
    <urbi-botao variante="secundario" icone="fa-solid fa-building" href=${urbiVerso.href('/imoveis')}>Imóveis</urbi-botao>
    <urbi-botao variante="secundario" icone="fa-solid fa-wand-magic-sparkles" @click=${() => abrirAssistente()}>Assistente</urbi-botao>
  </urbi-linha>`;
}

/** "Precisa de você" (P01): só as passagens do Negociador (e do Mensageiro, quando existir), com Assumir. */
function precisaDeVoce(d: DadosHoje, atualizar: () => void) {
  return html`<urbi-prosa papel="secao">Precisa de você · ${d.passagens.length}</urbi-prosa>
    ${d.passagens.length
      ? html`<urbi-lista separador .itens=${d.passagens} .render_item=${(p: Passagem) => html`<urbi-linha justificar="entre">
            <urbi-avatar nome=${p.contato_nome} tamanho="36"></urbi-avatar>
            <urbi-stack expandir>
              <urbi-prosa truncar>${p.contato_nome}${p.codigo ? ` · ${p.codigo}` : ''}</urbi-prosa>
              <urbi-prosa papel="secundario" truncar>${p.motivo}</urbi-prosa>
            </urbi-stack>
            <urbi-botao icone="fa-solid fa-hand" ?carregando=${estado.assumindo === p.negociacao_id} ?desabilitado=${estado.assumindo !== null && estado.assumindo !== p.negociacao_id}
              @click=${() => void assumir(p, atualizar)}>Assumir</urbi-botao>
          </urbi-linha>`}></urbi-lista>`
      : html`<urbi-prosa papel="dica">Nenhuma negociação passada a você agora. Os clientes quentes sem resposta estão na fila.</urbi-prosa>`}`;
}

function esquerda(d: DadosHoje, atualizar: () => void, celular: boolean) {
  const feitos = d.primeiros_passos.filter((p) => p.feito).length;
  const total = d.primeiros_passos.length;
  const aba = abaInicio();
  return html`<urbi-stack>
    ${celular ? atalhosDoDia() : nothing}
    <urbi-stack>
      ${cabecalhoColuna('Hoje')}
      <urbi-chips-atalho .opcoes=${ABAS_INICIO.map((a) => ({ id: a.id, rotulo: a.label }))} ativo=${aba}
        @urbi:chip-atalho:click=${(e: CustomEvent) => mudarVisao(e.detail.id, atualizar)}></urbi-chips-atalho>
      <urbi-prosa papel="fraco">${hojeExtenso()} · Mensageiro: ainda não disponível</urbi-prosa>
    </urbi-stack>
    ${precisaDeVoce(d, atualizar)}
    ${celular ? filaCompacta(d, atualizar) : nothing}
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
                  <urbi-botao variante="secundario" href=${urbiVerso.href(p.rota)}>Fazer</urbi-botao>
                </urbi-linha>`}></urbi-lista>`
      : nothing}
    ${d.sem_creci ? avisoCreci() : nothing}
    ${d.demo_disponivel
      ? html`<urbi-banner variante="info">
          Esta é uma conta de teste. Quer ver o app com dados? Gera 10 clientes, negócios em várias etapas, 2 imóveis e visitas.
          <urbi-botao slot="acao" ?carregando=${estado.gerandoDemo} @click=${() => gerarDemo(atualizar)}>Gerar dados de demonstração</urbi-botao>
        </urbi-banner>`
      : nothing}
  </urbi-stack>`;
}

/** A fila no celular (M1): logo abaixo de "Precisa de você", compacta, numa só rolagem. */
function filaCompacta(d: DadosHoje, atualizar: () => void) {
  const visiveis = estado.carga.verTudo ? d.fila : d.fila.slice(0, FILA_VISIVEL);
  const resto = d.fila.length - visiveis.length;
  return html`<urbi-prosa papel="secao">Fila do dia · ${d.fila.length}</urbi-prosa>
    ${d.fila.length
      ? html`<urbi-lista separador .itens=${visiveis} .render_item=${(i: ItemFila) => cartaoCompacto(i, atualizar)}></urbi-lista>`
      : html`<urbi-prosa papel="dica">Nada urgente agora.</urbi-prosa>`}
    ${resto > 0 ? html`<urbi-botao variante="secundario" bloco @click=${() => ((estado.carga = mostrarTudo(estado.carga)), atualizar())}>Mais ${resto} para depois</urbi-botao>` : nothing}`;
}

function centro(d: DadosHoje, atualizar: () => void) {
  const faixaIa = estado.ia === false ? estadoTela('ia_indisponivel') : nothing;
  if (abaInicio() === 'agenda') {
    return html`<urbi-stack>
      ${faixaIa}
      <urbi-linha justificar="entre">
        <urbi-prosa papel="secao">Agenda dos próximos 14 dias</urbi-prosa>
        <urbi-botao variante="secundario" icone="fa-solid fa-list-check" @click=${() => mudarVisao('hoje', atualizar)}>Voltar para a fila</urbi-botao>
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
        submensagem: 'Quentes sem resposta, abordagens atrasadas, visitas de hoje e amanhã, propostas recebidas, retornos vencidos, peças aprovadas sem data e autorizações a vencer aparecem aqui.',
        acao: { rotulo: 'Cadastrar um cliente', icone: 'fa-solid fa-user-plus', aoEscolher: () => urbiVerso.navegarSub('/clientes?criar=cliente') },
      })}
    </urbi-stack>`;
  }
  const visiveis = estado.carga.verTudo ? d.fila : d.fila.slice(0, FILA_VISIVEL);
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
          <urbi-botao variante="secundario" @click=${() => ((estado.carga = mostrarTudo(estado.carga)), atualizar())}>Mais ${resto} para depois</urbi-botao>
        </urbi-linha>`
      : nothing}
  </urbi-stack>`;
}

const hora = (q: string) => new Date(q).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

const ROTULO_ACAO_DICA: Record<string, string> = { criar_atividade: 'Criar o lembrete', agendar_peca: 'Agendar a peça' };

function direita(d: DadosHoje, atualizar: () => void) {
  const s = d.semana;
  const dica = d.dica ?? { texto: 'Pergunte ao Assistente quais clientes vale a pena retomar esta semana.', acao: null };
  const semIa = estado.ia === false;
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
          <urbi-botao variante="secundario" icone="fa-solid fa-calendar-week" @click=${() => mudarVisao('agenda', atualizar)}>Ver agenda</urbi-botao>
        </urbi-linha>
      </urbi-stack>
    </urbi-card>
    ${s
      ? html`<urbi-card titulo="Sua semana" icone="fa-solid fa-chart-simple">
          <urbi-stack>
            <!-- 140px é o piso do urbi-kpi no contrato; a grade decide quantos cabem por linha (na coluna de 340 px, um). -->
            <urbi-grid min="140px">
              <urbi-kpi rotulo="Contatos novos" .valor=${s.novos_contatos ?? 0}></urbi-kpi>
              <urbi-kpi rotulo="Leads" .valor=${s.leads ?? 0}></urbi-kpi>
              <urbi-kpi rotulo="Visitas feitas" .valor=${s.visitas ?? 0}></urbi-kpi>
            </urbi-grid>
            <!-- Valor em reais na linha inteira do cartão: numa célula da grade ele quebrava ou rolava (issue 164). -->
            <urbi-kpi rotulo="Comissão prevista" formato="texto" .valor=${s.previsao_c === null || s.previsao_c === undefined ? '—' : reais(s.previsao_c)}></urbi-kpi>
          </urbi-stack>
        </urbi-card>`
      : nothing}
    <urbi-card titulo="Dica do Assistente" icone="fa-solid fa-wand-magic-sparkles">
      <urbi-stack>
        <urbi-prosa>${dica.texto}</urbi-prosa>
        <!-- Com ação, o botão dela (confirma e executa, P01); sem ação, a dica vira pergunta ao Assistente. -->
        <urbi-linha quebrar>
          ${dica.acao
            ? html`<urbi-botao icone="fa-solid fa-check" ?carregando=${estado.fazendoDica} @click=${() => void fazerDica(dica.acao!, atualizar)}>${ROTULO_ACAO_DICA[dica.acao.tipo] ?? 'Fazer isto'}</urbi-botao>`
            : html`<urbi-botao icone="fa-solid fa-comments" ?desabilitado=${semIa} title=${semIa ? DICA_IA_INDISPONIVEL : nothing}
                @click=${() => abrirAssistenteCom(dica.texto)}>Perguntar ao Assistente</urbi-botao>`}
        </urbi-linha>
        ${semIa && !dica.acao ? html`<urbi-prosa papel="fraco">${DICA_IA_INDISPONIVEL}.</urbi-prosa>` : nothing}
      </urbi-stack>
    </urbi-card>
  </urbi-stack>`;
}

/** Hoje na moldura: esquerda · centro · direita (no celular, M1: uma rolagem com "Precisa de você", a fila e o contexto embaixo). */
export function renderHoje(atualizar: () => void) {
  trocarDeConta();
  if (precisaCarregar(estado.carga)) void carregar(atualizar);
  // Entrada na mesma conta mantém os dados na tela enquanto relê (sem piscar); a falha da releitura vale mais que eles.
  const d = telaDeHoje(estado.carga) === 'dados' ? estado.carga.dados : null;
  const rotulos = { lista: 'Hoje', centro: 'Fila', contexto: 'Agenda' };
  if (!d) {
    const conteudo = telaDeHoje(estado.carga) === 'falha' ? estadoDaFalha(estado.carga.falha, () => carregar(atualizar)) : estadoTela('carregando');
    return moldura({ menu: '/', centro: conteudo }, atualizar);
  }
  const celular = noCelular();
  // M1 no celular (#190): uma rolagem só, sem a barra de abas do `urbi-3-colunas` (Hoje · Fila · Agenda,
  // 37 px que a referência não tem, e a aba "Fila" mostrava a Agenda quando ela estava escolhida). Só foco e
  // contexto, no `urbi-2x1`, que no celular empilha: atalhos, "Precisa de você" e a fila (ou a Agenda), e
  // embaixo a agenda de hoje, a semana e a Dica (11.0.3, "contexto abaixo"). Com o Assistente aberto, volta
  // às três colunas, que o mostram na aba dele (no `urbi-2x1` ele ficaria lá embaixo, fora da vista).
  if (celular && !assistenteAberto()) {
    return moldura({ menu: '/', centro: abaInicio() === 'agenda' ? centro(d, atualizar) : esquerda(d, atualizar, true), contexto: direita(d, atualizar) }, atualizar);
  }
  return moldura(
    { menu: '/', lista: esquerda(d, atualizar, celular), centro: centro(d, atualizar), contexto: direita(d, atualizar), rotulos, painel: celular ? 'esquerda' : 'centro' },
    atualizar,
  );
}
