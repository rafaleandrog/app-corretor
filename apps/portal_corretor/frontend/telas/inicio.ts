import { LitElement, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { UrbiVersoAPI } from '@urbiverso/sdk';
import { abaDaUrl, abaNaUrl, acoesComMais, chamarApi, chip, dataHora, enviar, mensagemDeErro, reais, type Acao, type OpcoesAba } from '../apoio.js';
import { ABAS_INICIO, APELIDOS_INICIO } from '../../comum/funil';
import './agenda.js';

declare const urbiVerso: UrbiVersoAPI;

interface ItemFila {
  tipo: 'quente_sem_resposta' | 'abordagem_vencida' | 'visita' | 'proximo_passo';
  contato_id: number;
  contato_nome: string;
  temperatura: string | null;
  quando: string | null;
  texto: string;
  atividade_id?: number;
}

// Grupos da aba Hoje, na ordem da spec 11.1 (é também a ordem em que `GET /inicio` devolve a fila).
// Passagens do Mensageiro e peças aguardando aprovação entram aqui quando existirem.
const GRUPOS: { tipo: ItemFila['tipo']; rotulo: string; icone: string }[] = [
  { tipo: 'quente_sem_resposta', rotulo: 'Quentes sem resposta', icone: 'fa-solid fa-fire' },
  { tipo: 'abordagem_vencida', rotulo: 'Abordagens atrasadas', icone: 'fa-solid fa-clock' },
  { tipo: 'visita', rotulo: 'Visitas de hoje e amanhã', icone: 'fa-solid fa-door-open' },
  { tipo: 'proximo_passo', rotulo: 'Próximos passos vencidos', icone: 'fa-solid fa-forward' },
];

const ABAS = [...ABAS_INICIO];
// `/agenda` é apelido da aba Agenda (D-82); escolher uma aba leva a barra para `/`.
const OPCOES_ABA: OpcoesAba = { apelidos: APELIDOS_INICIO, rota: '/' };

/** A aba do endereço que está na barra agora. */
export const abaInicio = () => abaDaUrl(ABAS.map((a) => a.id), OPCOES_ABA);

// Início (spec 11.1, D-82): a faixa da semana sobre duas abas. Hoje é a fila do dia agrupada por
// motivo, cada item com um botão só; Agenda é a lista de 14 dias, montada só quando aberta (ela
// carrega os próprios dados). Guia o primeiro passo enquanto a conta não está completa.
@customElement('pc-tela-inicio')
export class PcTelaInicio extends LitElement {
  @state() private pendente: string[] | null = null;
  @state() private fila: ItemFila[] | null = null;
  @state() private falha: string | null = null;
  @state() private semana: Record<string, number | null> | null = null;
  @state() private demo = false;
  @state() private gerando = false;
  @state() private aba = abaInicio();

  connectedCallback() {
    super.connectedCallback();
    void this.carregar();
  }

  private async carregar() {
    this.falha = null;
    try {
      const [conta, inicio] = await Promise.all([chamarApi('/conta'), chamarApi('/inicio')]);
      const falta: string[] = [];
      if (!conta.perfil) falta.push('o nome da conta');
      if (!conta.meu_perfil?.creci) falta.push('o seu CRECI');
      if (!conta.meu_perfil?.telefone) falta.push('o seu telefone');
      this.pendente = falta;
      this.fila = inicio.fila;
      this.semana = inicio.semana ?? null;
      this.demo = !!inicio.demo_disponivel;
    } catch (e) {
      this.falha = (e as Error).message;
    }
  }

  private escolherAba(id: string) {
    if (!ABAS.some((a) => a.id === id) || id === this.aba) return;
    abaNaUrl(id === 'hoje' ? '' : id, OPCOES_ABA);
    this.aba = id;
  }

  private async registrar(caminho: () => Promise<unknown>) {
    try {
      await caminho();
      urbiVerso.notificar('Registrado.', 'sucesso');
      await this.carregar();
    } catch (e) {
      await urbiVerso.alertar({ titulo: 'Não foi possível registrar', mensagem: mensagemDeErro(e), tipo: 'erro' });
    }
  }

  private async gerarDemo() {
    this.gerando = true;
    try {
      await enviar('POST', '/demo/semear', {});
      urbiVerso.notificar('Dados de demonstração criados.', 'sucesso');
      await this.carregar();
    } catch (e) {
      await urbiVerso.alertar({ titulo: 'Não foi possível gerar', mensagem: mensagemDeErro(e), tipo: 'alerta' });
    } finally {
      this.gerando = false;
    }
  }

  /** Um botão por item (princípio 14); o resto no "Mais". */
  private acoes(i: ItemFila) {
    const ficha = `/clientes/${i.contato_id}`;
    const abrir: Acao = { rotulo: 'Abrir', icone: 'fa-solid fa-user', sub: ficha };
    // Fazer agora leva à ficha já com a mensagem sugerida (`?sugerir=1`); o WhatsApp abre de lá, no clique do corretor.
    const fazerAgora: Acao = { rotulo: 'Fazer agora', icone: 'fa-solid fa-paper-plane', sub: `${ficha}?sugerir=1` };
    switch (i.tipo) {
      case 'quente_sem_resposta':
        return acoesComMais(fazerAgora, []);
      case 'abordagem_vencida':
        return acoesComMais(fazerAgora, [
          { rotulo: 'Fiz', icone: 'fa-solid fa-check', aoEscolher: () => this.registrar(() => enviar('POST', `/abordagens/${i.contato_id}/feita`, { texto: i.texto })) },
        ]);
      case 'visita':
        return acoesComMais(
          abrir,
          i.atividade_id
            ? [{ rotulo: 'Visita feita', icone: 'fa-solid fa-check', aoEscolher: () => this.registrar(() => enviar('PATCH', `/atividades/${i.atividade_id}`, { status: 'feita' })) }]
            : [],
        );
      default:
        return acoesComMais(abrir, []);
    }
  }

  private item(i: ItemFila) {
    const quando = i.quando && i.tipo !== 'quente_sem_resposta' && i.tipo !== 'visita' ? ` · ${dataHora(i.quando)}` : '';
    return html`<urbi-linha justificar="entre" quebrar>
      <urbi-stack>
        <urbi-linha quebrar>
          <urbi-prosa>${i.contato_nome}</urbi-prosa>
          ${chip('temperatura', i.temperatura)}
        </urbi-linha>
        <urbi-prosa papel="secundario">${i.texto}${quando}</urbi-prosa>
      </urbi-stack>
      ${this.acoes(i)}
    </urbi-linha>`;
  }

  private hoje(fila: ItemFila[]) {
    if (!fila.length) {
      return html`<urbi-stack>
        <urbi-estado-vazio icone="fa-solid fa-mug-hot" mensagem="Nada urgente agora"
          submensagem="Quentes sem resposta, abordagens atrasadas, visitas de hoje e amanhã e próximos passos vencidos aparecem aqui."></urbi-estado-vazio>
        <urbi-linha justificar="centro">
          <urbi-botao variante="secundario" icone="fa-solid fa-calendar-day" @click=${() => this.escolherAba('agenda')}>Ver a agenda</urbi-botao>
        </urbi-linha>
      </urbi-stack>`;
    }
    return html`<urbi-stack>
      ${GRUPOS.map((g) => {
        const itens = fila.filter((i) => i.tipo === g.tipo);
        return itens.length
          ? html`<urbi-card titulo=${`${g.rotulo} (${itens.length})`} icone=${g.icone}>
              <urbi-lista separador .itens=${itens} .render_item=${(i: ItemFila) => this.item(i)}></urbi-lista>
            </urbi-card>`
          : nothing;
      })}
    </urbi-stack>`;
  }

  render() {
    if (this.falha && !this.fila) {
      return html`<urbi-banner variante="erro">
        Não foi possível carregar o Início: ${this.falha}
        <urbi-botao slot="acao" pequeno variante="secundario" @click=${() => this.carregar()}>Tentar de novo</urbi-botao>
      </urbi-banner>`;
    }
    if (!this.pendente || !this.fila) return html`<urbi-loading></urbi-loading>`;
    return html`<urbi-stack>
      ${this.pendente.length
        ? html`<urbi-banner variante="info">
            Para começar, complete ${this.pendente.join(', ')} em Ajustes › Conta.
            <urbi-botao slot="acao" pequeno href=${urbiVerso.href('/ajustes')}>Completar agora</urbi-botao>
          </urbi-banner>`
        : nothing}
      ${this.demo
        ? html`<urbi-banner variante="info">
            Esta é uma conta de teste. Quer ver o app com dados? Gera 10 clientes, negócios em várias etapas, 2 imóveis e visitas.
            <urbi-botao slot="acao" pequeno ?carregando=${this.gerando} @click=${() => this.gerarDemo()}>Gerar dados de demonstração</urbi-botao>
          </urbi-banner>`
        : nothing}
      ${this.semana
        ? html`<urbi-grid min="140px">
            <urbi-kpi rotulo="Contatos novos (7 dias)" .valor=${this.semana.novos_contatos ?? 0}></urbi-kpi>
            <urbi-kpi rotulo="Leads (7 dias)" .valor=${this.semana.leads ?? 0}></urbi-kpi>
            <urbi-kpi rotulo="Visitas feitas (7 dias)" .valor=${this.semana.visitas ?? 0}></urbi-kpi>
            <urbi-kpi rotulo="Comissão prevista" formato="texto" .valor=${this.semana.previsao_c === null ? '—' : reais(this.semana.previsao_c)}></urbi-kpi>
          </urbi-grid>`
        : nothing}
      <urbi-abas formato-desktop="botoes" .abas=${ABAS} ativa=${this.aba} @urbi:aba-selecionar=${(e: CustomEvent) => this.escolherAba(e.detail?.id)}>
        <urbi-hospedeiro slot=${this.aba}>
          ${this.aba === 'agenda' ? html`<pc-tela-agenda></pc-tela-agenda>` : this.hoje(this.fila)}
        </urbi-hospedeiro>
      </urbi-abas>
    </urbi-stack>`;
  }
}
