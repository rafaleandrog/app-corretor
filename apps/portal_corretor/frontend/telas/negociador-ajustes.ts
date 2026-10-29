import { LitElement, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { UrbiVersoAPI } from '@urbiverso/sdk';
import { ESTILOS, LIMITE_INSTRUCOES } from '../../comum/negociacao';
import { PROMPT_PARTE_2_PADRAO, REGRAS_FIXAS } from '../../comum/negociador';
import { contadorInstrucoes, CUSTO_POR_RODADA, ESTILO_NEGOCIADOR, GATILHOS_EM_USO, PERGUNTA_TESTE, ROTULO_GATILHO } from '../../comum/negociador-ajustes';
import { reaisParaCentavos } from '../../comum/crm';
import { chamarApi, enviar, mensagemDeErro, reais } from '../apoio.js';
import { estadoDaFalha, estadoTela } from '../estados.js';

declare const urbiVerso: UrbiVersoAPI;

// Ajustes › Negociador (P17, spec 11.1; item D4): como o Negociador trata propostas e contrapropostas.
// No centro, numa grade, 1 Quando entra · 2 Quem negocia · 3 Estilo · 4 Regras fixas (só exibidas,
// da MESMA constante que monta o prompt do motor) · 5 Suas instruções · 6 Respostas a objeções. À
// direita, 7 Testar (o simulador de `/negociador/teste`, que não grava nada) e os números do mês. Os
// dados são os de `/negociador/config` e `/negociador/objecoes` (D1); o convite de um negociador
// humano chega com o D7 e, até lá, não aparece.

type Linha = Record<string, any>;

interface Config {
  ligado: boolean;
  conduz_padrao: string;
  gatilhos: Record<string, boolean>;
  estilo: string;
  instrucoes_corretor: string | null;
}

@customElement('pc-ajustes-negociador')
export class PcAjustesNegociador extends LitElement {
  @state() private config: Config | null = null;
  @state() private objecoes: Linha[] = [];
  @state() private falha: unknown = null;
  @state() private instrucoes = '';
  @state() private salvando = false;

  connectedCallback() {
    super.connectedCallback();
    void this.carregar();
  }

  private async carregar() {
    this.falha = null;
    try {
      const [config, objecoes] = await Promise.all([chamarApi('/negociador/config'), chamarApi('/negociador/objecoes')]);
      this.config = config;
      this.instrucoes = config.instrucoes_corretor ?? '';
      this.objecoes = objecoes.dados ?? [];
    } catch (e) {
      this.falha = e;
    }
  }

  /**
   * Grava uma mudança da config e redesenha com a resposta (que é a config inteira). As instruções só
   * voltam do servidor quando foram elas a mudança: o que está digitado e não salvo sobrevive a um
   * estilo, gatilho ou liga/desliga. Se falha, o controle (`alvo`) volta ao valor gravado.
   */
  private async gravar(mudanca: Partial<Config>, aviso = 'Salvo.', alvo?: { el: any; prop: 'marcado' | 'checked'; anterior: boolean }) {
    this.salvando = true;
    try {
      this.config = await enviar('PUT', '/negociador/config', mudanca);
      if ('instrucoes_corretor' in mudanca) this.instrucoes = this.config!.instrucoes_corretor ?? '';
      urbiVerso.notificar(aviso, 'sucesso');
    } catch (e) {
      await urbiVerso.alertar({ titulo: 'Não foi possível salvar', mensagem: mensagemDeErro(e), tipo: 'erro' });
      // O Lit só reaplica o que ele mesmo mudou: o clique mexeu no elemento por dentro, então o valor
      // gravado volta direto nele, depois do render.
      this.config = { ...this.config! };
      await this.updateComplete;
      if (alvo) {
        alvo.el[alvo.prop] = alvo.anterior;
        alvo.el.toggleAttribute(alvo.prop, alvo.anterior);
      }
    } finally {
      this.salvando = false;
    }
  }

  private salvarInstrucoes() {
    if (this.instrucoes.trim().length > LIMITE_INSTRUCOES) {
      void urbiVerso.alertar({ titulo: 'Instruções longas demais', mensagem: `Use até ${LIMITE_INSTRUCOES.toLocaleString('pt-BR')} caracteres.`, tipo: 'alerta' });
      return;
    }
    void this.gravar({ instrucoes_corretor: this.instrucoes.trim() || null }, 'Instruções salvas.');
  }

  private async editarObjecao(o: Linha) {
    const atual = o.minha ?? o.padrao;
    const v = await urbiVerso.formulario({
      titulo: `Minha resposta · ${o.titulo}`,
      mensagem: `Quando o cliente diz "${o.fala_cliente}"`,
      campos: [
        { nome: 'pergunta_exploracao', tipo: 'texto_longo', rotulo: 'Pergunta para explorar', obrigatorio: true, valor: atual.pergunta_exploracao ?? '' },
        { nome: 'resposta_base', tipo: 'texto_longo', rotulo: 'Resposta', obrigatorio: true, valor: atual.resposta_base ?? '' },
        { nome: 'proximo_passo', tipo: 'texto_longo', rotulo: 'Próximo passo', obrigatorio: true, valor: atual.proximo_passo ?? '' },
      ],
      rotuloConfirmar: 'Salvar a minha resposta',
    });
    if (!v) return;
    await this.objecao({ categoria: o.categoria, ...v }, 'Sua resposta foi salva.');
  }

  private async objecao(corpo: Record<string, unknown>, aviso: string) {
    try {
      const item = await enviar('PUT', '/negociador/objecoes', corpo);
      this.objecoes = this.objecoes.map((x) => (x.categoria === item.categoria ? item : x));
      urbiVerso.notificar(aviso, 'sucesso');
    } catch (e) {
      await urbiVerso.alertar({ titulo: 'Não foi possível salvar', mensagem: mensagemDeErro(e), tipo: 'erro' });
    }
  }

  render() {
    if (this.falha) return estadoDaFalha(this.falha, () => void this.carregar());
    const c = this.config;
    if (!c) return estadoTela('carregando');
    return html`<urbi-stack>
      <urbi-prosa papel="titulo">Negociador</urbi-prosa>
      <urbi-grid min="320px">
        <urbi-card expandir titulo="1 · Quando entra" icone="fa-solid fa-bolt">
          <urbi-prosa papel="dica">O Negociador começa a atuar quando:</urbi-prosa>
          ${GATILHOS_EM_USO.map(
            (g) => html`<urbi-checkbox label=${ROTULO_GATILHO[g]} ?marcado=${c.gatilhos[g] !== false} ?desabilitado=${this.salvando}
              @urbi:checkbox-change=${(e: CustomEvent) =>
                void this.gravar({ gatilhos: { [g]: !!e.detail.marcado } }, 'Salvo.', { el: e.target, prop: 'marcado', anterior: c.gatilhos[g] !== false })}></urbi-checkbox>`,
          )}
        </urbi-card>
        <urbi-card expandir titulo="2 · Quem negocia por padrão" icone="fa-solid fa-user-gear">
          <urbi-linha justificar="entre">
            <urbi-prosa>Negociador ligado</urbi-prosa>
            <urbi-toggle ?checked=${c.ligado} ?disabled=${this.salvando} ariaLabel="Negociador ligado"
              @urbi-toggle:change=${(e: CustomEvent) =>
                void this.gravar({ ligado: !!e.detail }, e.detail ? 'Negociador ligado.' : 'Negociador desligado.', { el: e.target, prop: 'checked', anterior: c.ligado })}></urbi-toggle>
          </urbi-linha>
          <urbi-linha>
            <urbi-prosa>Negociador IA</urbi-prosa>
            <urbi-badge cor="info">padrão</urbi-badge>
          </urbi-linha>
          <urbi-prosa papel="dica">${c.ligado
            ? 'Toda negociação nova começa conduzida por ele; em cada uma, você assume quando quiser.'
            : 'Desligado: as negociações novas começam conduzidas por você.'} Uma pessoa da sua equipe como negociadora chega numa versão seguinte.</urbi-prosa>
        </urbi-card>
        <urbi-card expandir titulo="3 · Estilo" icone="fa-solid fa-comment-dots">
          ${ESTILOS.map((e) => {
            const s = ESTILO_NEGOCIADOR[e];
            const ativo = c.estilo === e;
            return html`<urbi-stack>
              <urbi-linha justificar="entre">
                <urbi-prosa papel="secao">${s.rotulo}</urbi-prosa>
                ${ativo
                  ? html`<urbi-badge cor="sucesso">em uso</urbi-badge>`
                  : html`<urbi-botao pequeno variante="texto" ariaLabel=${`Usar o estilo ${s.rotulo}`} ?desabilitado=${this.salvando} @click=${() => void this.gravar({ estilo: e }, `Estilo ${s.rotulo.toLowerCase()}.`)}>Usar</urbi-botao>`}
              </urbi-linha>
              <urbi-prosa papel="secundario">${s.exemplo}</urbi-prosa>
            </urbi-stack>`;
          })}
        </urbi-card>
        <urbi-card expandir titulo="4 · Regras fixas" icone="fa-solid fa-shield-halved">
          <urbi-prosa papel="dica">Valem sempre, acima das suas instruções. Não se editam.</urbi-prosa>
          ${REGRAS_FIXAS.map((r) => html`<urbi-linha><urbi-icone classe="fa-solid fa-check"></urbi-icone><urbi-prosa>${r}</urbi-prosa></urbi-linha>`)}
        </urbi-card>
        <urbi-card expandir titulo="5 · Suas instruções" icone="fa-solid fa-pen-to-square">
          <urbi-textarea label="Como o Negociador deve conduzir" rows="8" valor=${this.instrucoes} placeholder="Em branco, vale o modelo do app."
            erro=${this.instrucoes.trim().length > LIMITE_INSTRUCOES ? `Até ${LIMITE_INSTRUCOES.toLocaleString('pt-BR')} caracteres.` : ''}
            @urbi:input-change=${(e: CustomEvent) => (this.instrucoes = String(e.detail.valor ?? ''))}></urbi-textarea>
          <urbi-linha justificar="entre" quebrar>
            <urbi-prosa papel="fraco">${contadorInstrucoes(this.instrucoes, LIMITE_INSTRUCOES)}${c.instrucoes_corretor ? '' : ' · em branco, vale o modelo'}</urbi-prosa>
            <urbi-linha>
              ${this.instrucoes.trim() ? nothing : html`<urbi-botao pequeno variante="texto" @click=${() => (this.instrucoes = PROMPT_PARTE_2_PADRAO)}>Começar do modelo</urbi-botao>`}
              <urbi-botao pequeno icone="fa-solid fa-check" ?carregando=${this.salvando} @click=${() => this.salvarInstrucoes()}>Salvar instruções</urbi-botao>
            </urbi-linha>
          </urbi-linha>
        </urbi-card>
        <urbi-card expandir titulo="6 · Respostas a objeções" icone="fa-solid fa-comments">
          <urbi-lista separador .itens=${this.objecoes} .render_item=${(o: Linha) => html`<urbi-linha justificar="entre" quebrar>
              <urbi-stack>
                <urbi-linha quebrar>
                  <urbi-prosa>${o.titulo}</urbi-prosa>
                  <urbi-badge cor=${o.usando === 'corretor' ? 'info' : 'padrao'}>${o.usando === 'corretor' ? 'Minha resposta' : 'Padrão'}</urbi-badge>
                </urbi-linha>
                <urbi-prosa papel="fraco">"${o.fala_cliente}"</urbi-prosa>
              </urbi-stack>
              <urbi-linha>
                <urbi-botao pequeno variante="texto" ariaLabel=${`Editar a resposta a ${o.titulo}`} @click=${() => void this.editarObjecao(o)}>Editar</urbi-botao>
                ${o.minha ? html`<urbi-botao pequeno variante="texto" ariaLabel=${`Voltar ao padrão: ${o.titulo}`} @click=${() => void this.objecao({ categoria: o.categoria, usar_padrao: true }, 'Voltou ao padrão.')}>Voltar ao padrão</urbi-botao>` : nothing}
              </urbi-linha>
            </urbi-linha>`}></urbi-lista>
        </urbi-card>
      </urbi-grid>
    </urbi-stack>`;
  }
}

/**
 * 7 · Testar (P17, direita): o motor sobre uma negociação fictícia, sem gravar nada. Os valores são os
 * do teste, digitados aqui; a resposta volta com as 7 verificações ("não revelou o recuo…") e a ZOPA, do recuo ao teto do comprador.
 */
@customElement('pc-negociador-teste')
export class PcNegociadorTeste extends LitElement {
  @state() private ia: boolean | null = null;
  @state() private valores = { pedido: '1.450.000', alvo: '1.400.000', recuo: '1.360.000', oferta: '1.320.000', teto: '1.400.000', mensagem: PERGUNTA_TESTE };
  @state() private resultado: Linha | null = null;
  @state() private testando = false;
  @state() private numeros: Linha | null = null;

  connectedCallback() {
    super.connectedCallback();
    void chamarApi('/negociador/ia').then(
      (r) => (this.ia = !!r?.disponivel),
      () => (this.ia = false),
    );
    void chamarApi('/negociador/numeros').then(
      (r) => (this.numeros = r),
      () => (this.numeros = null),
    );
  }

  private async testar() {
    const v = this.valores;
    const [pedido, alvo, recuo, oferta, teto] = [v.pedido, v.alvo, v.recuo, v.oferta, v.teto].map((x) => reaisParaCentavos(x));
    // O teto pode ficar em branco (desconhecido: sem ZOPA na resposta); escrito, tem que ser válido.
    if (!pedido || !alvo || !recuo || !oferta || Number.isNaN(teto)) {
      await urbiVerso.alertar({ titulo: 'Valores inválidos', mensagem: 'Escreva os valores em reais, por exemplo 1.360.000.', tipo: 'alerta' });
      return;
    }
    this.testando = true;
    this.resultado = null;
    try {
      this.resultado = await enviar('POST', '/negociador/teste', {
        mandato: { preco_pedido_c: pedido, alvo_c: alvo, recuo_c: recuo, autonomia: 'pergunta_antes' },
        propostas: [{ direcao: 'comprador', valor_c: oferta }],
        mensagem_cliente: v.mensagem,
        teto_estimado_c: teto ?? null,
      });
    } catch (e) {
      await urbiVerso.alertar({ titulo: 'Não foi possível testar', mensagem: mensagemDeErro(e), tipo: 'erro' });
    } finally {
      this.testando = false;
    }
  }

  private campo(rotulo: string, chave: keyof PcNegociadorTeste['valores']) {
    return html`<urbi-input label=${rotulo} valor=${this.valores[chave]} @urbi:input-change=${(e: CustomEvent) => (this.valores = { ...this.valores, [chave]: String(e.detail.valor ?? '') })}></urbi-input>`;
  }

  private resposta() {
    const r = this.resultado;
    if (!r) return nothing;
    const cp = r.resposta?.contraproposta;
    const z = r.zopa;
    return html`<urbi-stack>
      ${r.resposta?.mensagem ? html`<urbi-prosa pre>${r.resposta.mensagem}</urbi-prosa>` : nothing}
      ${cp?.valor_c ? html`<urbi-prosa papel="secundario">Contraproposta: ${reais(cp.valor_c)}${cp.concessao ? ` · ${cp.concessao}` : ''}</urbi-prosa>` : nothing}
      ${(r.validacoes ?? []).map(
        (x: Linha) => html`<urbi-linha>
          <urbi-icone classe=${x.ok ? 'fa-solid fa-check' : 'fa-solid fa-xmark'}></urbi-icone>
          <urbi-prosa papel=${x.ok ? 'sucesso' : 'alerta'}>${x.descricao}</urbi-prosa>
        </urbi-linha>`,
      )}
      ${r.passagem ? html`<urbi-prosa papel="alerta">Passaria a você${(r.motivos_passagem ?? []).length ? `: ${r.motivos_passagem.map((m: Linha) => m.descricao).join('; ')}` : '.'}</urbi-prosa>` : nothing}
      ${z?.existe === true ? html`<urbi-prosa papel="dica">ZOPA deste teste: de ${reais(z.de_c)} a ${reais(z.ate_c)}.</urbi-prosa>` : z?.existe === false ? html`<urbi-prosa papel="dica">Sem ZOPA neste teste: o teto do comprador fica abaixo do recuo.</urbi-prosa>` : nothing}
    </urbi-stack>`;
  }

  render() {
    const n = this.numeros;
    return html`<urbi-stack>
      <urbi-card titulo="7 · Testar" icone="fa-solid fa-flask">
        <urbi-prosa papel="dica">Faça o papel do comprador numa negociação de mentira. Nada é gravado nem enviado.</urbi-prosa>
        ${this.ia === false
          ? estadoTela('ia_indisponivel', { mensagem: 'IA indisponível agora: o teste volta quando ela voltar. O resto dos ajustes funciona normalmente.' })
          : html`<urbi-grid min="140px">
                ${this.campo('Pedido (R$)', 'pedido')}${this.campo('Alvo (R$)', 'alvo')}${this.campo('Recuo (R$)', 'recuo')}${this.campo('Oferta do comprador (R$)', 'oferta')}${this.campo('Teto do comprador (R$)', 'teto')}
              </urbi-grid>
              <urbi-textarea label="O comprador diz" rows="2" valor=${this.valores.mensagem} @urbi:input-change=${(e: CustomEvent) => (this.valores = { ...this.valores, mensagem: String(e.detail.valor ?? '') })}></urbi-textarea>
              <urbi-linha><urbi-botao pequeno icone="fa-solid fa-play" ?carregando=${this.testando} ?desabilitado=${this.ia === null} @click=${() => void this.testar()}>Testar</urbi-botao></urbi-linha>
              ${this.resposta()}`}
      </urbi-card>
      <urbi-card titulo="Números do mês" icone="fa-solid fa-chart-simple">
        <urbi-grid min="140px">
          <urbi-kpi rotulo="Rodadas" .valor=${n?.rodadas ?? '—'}></urbi-kpi>
          <urbi-kpi rotulo="Aprovadas sem edição" formato="texto" .valor=${n ? (n.decididas ? `${Math.round((n.aprovadas_sem_edicao / n.decididas) * 100)}%` : '—') : '—'}></urbi-kpi>
          <urbi-kpi rotulo="Custo por rodada" formato="texto" .valor=${CUSTO_POR_RODADA}></urbi-kpi>
        </urbi-grid>
      </urbi-card>
    </urbi-stack>`;
  }
}
