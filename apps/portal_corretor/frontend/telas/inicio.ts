import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { UrbiVersoAPI } from '@urbiverso/sdk';
import { dataHora, enviar, mensagemDeErro } from '../apoio.js';

declare const urbiVerso: UrbiVersoAPI;

interface ItemFila {
  tipo: 'quente_sem_resposta' | 'abordagem_vencida' | 'visita' | 'proximo_passo';
  contato_id: number;
  contato_nome: string;
  temperatura: string | null;
  quando: string | null;
  texto: string;
}

const TIPO: Record<ItemFila['tipo'], { rotulo: string; cor: string; icone: string }> = {
  quente_sem_resposta: { rotulo: 'Quente sem resposta', cor: 'erro', icone: 'fa-solid fa-fire' },
  abordagem_vencida: { rotulo: 'Abordagem atrasada', cor: 'alerta', icone: 'fa-solid fa-clock' },
  visita: { rotulo: 'Visita', cor: 'info', icone: 'fa-solid fa-door-open' },
  proximo_passo: { rotulo: 'Próximo passo vencido', cor: 'alerta', icone: 'fa-solid fa-forward' },
};

// Início: o que precisa do corretor agora (fila do dia, spec 10.4 e 11.1), na ordem de urgência,
// com os atalhos do dia. Guia o primeiro passo enquanto a conta não está completa.
@customElement('pc-tela-inicio')
export class PcTelaInicio extends LitElement {
  @state() private pendente: string[] | null = null;
  @state() private fila: ItemFila[] | null = null;
  @state() private falha: string | null = null;

  connectedCallback() {
    super.connectedCallback();
    void this.carregar();
  }

  private async carregar() {
    this.falha = null;
    try {
      const [conta, inicio] = await Promise.all([urbiVerso.api('/conta'), urbiVerso.api('/inicio')]);
      const falta: string[] = [];
      if (!conta.perfil) falta.push('o nome da conta');
      if (!conta.meu_perfil?.creci) falta.push('o seu CRECI');
      if (!conta.meu_perfil?.telefone) falta.push('o seu telefone');
      this.pendente = falta;
      this.fila = inicio.fila;
    } catch (e) {
      this.falha = (e as Error).message;
    }
  }

  private async feita(i: ItemFila) {
    try {
      await enviar('POST', `/abordagens/${i.contato_id}/feita`, { texto: i.texto });
      urbiVerso.notificar('Registrado.', 'sucesso');
      await this.carregar();
    } catch (e) {
      await urbiVerso.alertar({ titulo: 'Não foi possível registrar', mensagem: mensagemDeErro(e), tipo: 'erro' });
    }
  }

  private item(i: ItemFila) {
    const t = TIPO[i.tipo];
    return html`<urbi-linha justificar="entre" quebrar>
      <urbi-stack>
        <urbi-linha quebrar>
          <urbi-badge cor=${t.cor}>${t.rotulo}</urbi-badge>
          <urbi-prosa>${i.contato_nome}</urbi-prosa>
        </urbi-linha>
        <urbi-prosa papel="secundario">${i.texto}${i.quando && i.tipo !== 'quente_sem_resposta' ? ` · ${dataHora(i.quando)}` : ''}</urbi-prosa>
      </urbi-stack>
      <urbi-linha>
        ${i.tipo === 'abordagem_vencida' ? html`<urbi-botao variante="texto" pequeno @click=${() => this.feita(i)}>Fiz</urbi-botao>` : ''}
        <urbi-botao variante="secundario" pequeno href=${urbiVerso.href(`/clientes/${i.contato_id}`)}>Abrir</urbi-botao>
      </urbi-linha>
    </urbi-linha>`;
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
            Para começar, complete ${this.pendente.join(', ')} em Conta e marca.
            <urbi-botao slot="acao" pequeno href=${urbiVerso.href('/conta')}>Completar agora</urbi-botao>
          </urbi-banner>`
        : ''}
      <urbi-linha quebrar>
        <urbi-botao pequeno icone="fa-solid fa-user-plus" href=${urbiVerso.href('/clientes')}>Clientes</urbi-botao>
        <urbi-botao pequeno variante="secundario" icone="fa-solid fa-filter" href=${urbiVerso.href('/funil')}>Funil</urbi-botao>
        <urbi-botao pequeno variante="secundario" icone="fa-solid fa-plus" href=${urbiVerso.href('/imoveis')}>Imóveis</urbi-botao>
        <urbi-botao pequeno variante="secundario" icone="fa-solid fa-calendar-day" href=${urbiVerso.href('/agenda')}>Agenda</urbi-botao>
      </urbi-linha>
      <urbi-card titulo="Para hoje" icone="fa-solid fa-list-check">
        ${this.fila.length
          ? html`<urbi-lista separador .itens=${this.fila} .render_item=${(i: ItemFila) => this.item(i)}></urbi-lista>`
          : html`<urbi-estado-vazio icone="fa-solid fa-mug-hot" mensagem="Nada urgente agora"
              submensagem="Quentes sem resposta, abordagens atrasadas, visitas de hoje e amanhã e próximos passos vencidos aparecem aqui."></urbi-estado-vazio>`}
      </urbi-card>
    </urbi-stack>`;
  }
}
