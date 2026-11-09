import { LitElement, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { UrbiVersoAPI } from '@urbiverso/sdk';
import { ESTILOS, LIMITE_INSTRUCOES } from '../../comum/negociacao';
import { PROMPT_PARTE_2_PADRAO, REGRAS_FIXAS } from '../../comum/negociador';
import { contadorInstrucoes, CUSTO_POR_RODADA, ESTILO_NEGOCIADOR, GATILHOS_EM_USO, LIMITE_EVENTOS, MENSAGEM_CONVITE, PERGUNTA_TESTE, POLITICA_CONVITE, ROTULO_GATILHO, SELO_SIGILO } from '../../comum/negociador-ajustes';
import { reaisParaCentavos } from '../../comum/crm';
import { chamarApi, enviar, escolhaUnica, gesto, mensagemDeErro, reais } from '../apoio.js';
import { estadoDaFalha, estadoTela } from '../estados.js';

declare const urbiVerso: UrbiVersoAPI;

// Ajustes › Negociador (P17, spec 11.1; item D4): como o Negociador trata propostas e contrapropostas.
// No centro, com o interruptor Ligado · Pausar no cabeçalho, em duas colunas quando cabem
// (`urbi-grid min="260px"`): 1 Quando entra e 2 Quem negocia; 3 Estilo como três cartões selecionáveis
// com exemplo e "em uso"; 4 Regras fixas (só exibidas, da MESMA constante que monta o prompt do motor)
// e 5 Suas instruções; 6 Respostas a objeções embaixo. À direita, 7 Testar como conversa simulada (o
// simulador de `/negociador/teste`, que não grava nada) e os números do mês. Os dados são os de
// `/negociador/config` e `/negociador/objecoes` (D1). Em "Quem negocia", o convite do negociador humano
// (D7): só o e-mail, sem CRECI (D-94), e só com a política multi-usuário (D-108): recusado por ela, o
// botão sai e a tela diz por quê.

type Linha = Record<string, any>;

interface Config {
  ligado: boolean;
  conduz_padrao: string;
  negociador_padrao_id: number | null;
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
  /** Convites de negociador da conta e quem aceitou (D7); `indisponivel` diz por que não carregou. */
  @state() private equipe: { convites: Linha[]; negociadores: Linha[]; indisponivel: string | null } | null = null;
  /** O convite foi recusado pela política "contas multi-usuário" desligada (D-108): o botão sai. */
  @state() private semMultiUsuario = false;
  /**
   * A conta em que a tela nasceu (a troca de conta a recria). Toda continuação passa por `vida.esperar`:
   * trocada a conta com o diálogo aberto (preenchido com dado de A) ou o envio em voo, nada sai com o
   * `X-Conta` da nova (o PUT de objeção e o de config são por categoria/campo: sobrescreveriam B), nem há
   * estado, aviso ou alerta.
   */
  private readonly vida = gesto();

  connectedCallback() {
    super.connectedCallback();
    void this.carregar();
  }

  /** Um gesto com diálogo ou cadeia de awaits: conta trocada no meio termina em silêncio. */
  private async semAvisoDeOutraConta(fn: () => Promise<unknown>) {
    try {
      if (this.vida.vivo()) await fn();
    } catch (e) {
      if (!this.vida.encerrado(e)) throw e;
    }
  }

  private async carregar() {
    this.falha = null;
    try {
      const [config, objecoes] = await this.vida.esperar(Promise.all([chamarApi('/negociador/config'), chamarApi('/negociador/objecoes')]));
      this.config = config;
      this.instrucoes = config.instrucoes_corretor ?? '';
      this.objecoes = objecoes.dados ?? [];
    } catch (e) {
      if (this.vida.encerrado(e)) return;
      this.falha = e;
    }
    void this.carregarEquipe();
  }

  /** Convites e negociadores: falhar aqui não derruba a seção (a política multi-usuário pode estar desligada). */
  private async carregarEquipe() {
    try {
      const [c, n] = await this.vida.esperar(Promise.all([chamarApi('/negociador/convites'), chamarApi('/negociador/negociadores')]));
      this.equipe = { convites: c?.convites ?? [], negociadores: n?.dados ?? [], indisponivel: null };
    } catch (e) {
      if (this.vida.encerrado(e)) return;
      this.equipe = { convites: [], negociadores: [], indisponivel: mensagemDeErro(e) };
    }
  }

  /** Convidar negociador: só o e-mail (D-94, sem CRECI). Os erros da plataforma chegam traduzidos pela rota. */
  private convidar() {
    return this.semAvisoDeOutraConta(async () => {
      const v = await this.vida.esperar(urbiVerso.formulario({
        titulo: 'Convidar negociador',
        mensagem: MENSAGEM_CONVITE,
        campos: [{ nome: 'email', tipo: 'texto', rotulo: 'E-mail', obrigatorio: true, placeholder: 'nome@exemplo.com' }],
        rotuloConfirmar: 'Convidar',
      }));
      if (!v) return;
      try {
        const r = await this.vida.esperar(enviar('POST', '/negociador/convites', { email: String(v.email ?? '') }));
        if (r?.aviso) await this.vida.esperar(urbiVerso.alertar({ titulo: 'Convite criado', mensagem: r.aviso, tipo: 'alerta' }));
        else urbiVerso.notificar('Convite enviado.', 'sucesso');
      } catch (e) {
        if (this.vida.encerrado(e)) throw e;
        if ((e as { codigo?: string })?.codigo === 'CONVITE_MULTI_USUARIO_BLOQUEADO') this.semMultiUsuario = true;
        await this.vida.esperar(urbiVerso.alertar({ titulo: 'Não foi possível convidar', mensagem: mensagemDeErro(e), tipo: 'erro' }));
      }
      await this.carregarEquipe();
    });
  }

  private revogar(c: Linha) {
    return this.semAvisoDeOutraConta(async () => {
      const ok = await this.vida.esperar(urbiVerso.confirmar({ titulo: 'Revogar convite', mensagem: `O convite para ${c.email} deixa de valer.`, rotuloConfirmar: 'Revogar' }));
      if (!ok) return;
      try {
        await this.vida.esperar(enviar('POST', `/negociador/convites/${c.id}/revogar`));
        urbiVerso.notificar('Convite revogado.', 'sucesso');
      } catch (e) {
        if (this.vida.encerrado(e)) throw e;
        await this.vida.esperar(urbiVerso.alertar({ titulo: 'Não foi possível revogar', mensagem: mensagemDeErro(e), tipo: 'erro' }));
      }
      await this.carregarEquipe();
    });
  }

  /** Bloco do negociador humano dentro de "Quem negocia" (D7). */
  private pessoas() {
    const eq = this.equipe;
    const ROTULO: Record<string, string> = { emitido: 'pendente', resgatado: 'aceito', expirado: 'expirado', invalidado: 'invalidado', revogado: 'revogado' };
    return html`<urbi-linha justificar="entre" quebrar>
        <urbi-prosa>Negociador humano</urbi-prosa>
        ${eq?.indisponivel || this.semMultiUsuario ? nothing : html`<urbi-botao variante="secundario" icone="fa-solid fa-user-plus" @click=${() => void this.convidar()}>Convidar negociador</urbi-botao>`}
      </urbi-linha>
      ${this.semMultiUsuario
        ? html`<urbi-prosa papel="dica">Esta instalação não permite mais de uma pessoa por conta (política "contas multi-usuário" desligada): o Negociador IA conduz as negociações. Fale com a equipe da plataforma se precisar de um negociador humano.</urbi-prosa>`
        : eq?.indisponivel ? nothing : html`<urbi-prosa papel="dica">${POLITICA_CONVITE} ${LIMITE_EVENTOS}</urbi-prosa>`}
      ${!eq
        ? html`<urbi-loading></urbi-loading>`
        : eq.indisponivel
          ? html`<urbi-prosa papel="fraco">${eq.indisponivel}</urbi-prosa>`
          : html`${eq.negociadores.length
                ? eq.negociadores.map(
                    (n) => html`<urbi-linha justificar="entre" quebrar>
                      <urbi-prosa>${n.email}</urbi-prosa>
                      ${n.tem_papel ? html`<urbi-badge cor="sucesso">pronto</urbi-badge>` : html`<urbi-badge cor="alerta">falta o papel</urbi-badge>`}
                    </urbi-linha>`,
                  )
                : nothing}
              ${eq.convites
                .filter((c) => c.status !== 'resgatado')
                .map(
                  (c) => html`<urbi-linha justificar="entre" quebrar>
                    <urbi-prosa papel="secundario">${c.email}</urbi-prosa>
                    <urbi-linha>
                      <urbi-badge>${ROTULO[c.status] ?? c.status}</urbi-badge>
                      ${c.status === 'emitido'
                        ? html`<urbi-botao variante="texto" ariaLabel=${`Revogar o convite de ${c.email}`} @click=${() => void this.revogar(c)}>Revogar</urbi-botao>`
                        : nothing}
                    </urbi-linha>
                  </urbi-linha>`,
                )}
              ${eq.negociadores.some((n) => !n.tem_papel)
                ? html`<urbi-prosa papel="dica">Depois do aceite, peça ao administrador do app para atribuir o papel negociador em Configurações › Usuários. Aí você atribui negociações à pessoa, na própria negociação.</urbi-prosa>`
                : nothing}`}`;
  }

  /**
   * Quem conduz as negociações novas (F3): o Negociador IA (padrão, D-94) ou uma pessoa que aceitou o
   * convite e já tem o papel negociador. A negociação nova já nasce atribuída a ela, que recebe o aviso.
   */
  private quemConduz(c: Config) {
    const prontos = (this.equipe?.negociadores ?? []).filter((n) => n.tem_papel);
    const atual = c.conduz_padrao === 'humano' && c.negociador_padrao_id ? `pessoa:${c.negociador_padrao_id}` : 'ia';
    const opcoes = [
      { valor: 'ia', rotulo: 'Negociador IA (padrão)' },
      ...prontos.map((n) => ({ valor: `pessoa:${n.usuario_id}`, rotulo: n.email })),
      // A pessoa gravada que saiu da lista (perdeu o papel ou a conta): continua visível, com o aviso.
      ...(atual !== 'ia' && !prontos.some((n) => `pessoa:${n.usuario_id}` === atual) ? [{ valor: atual, rotulo: 'Pessoa escolhida (sem o papel negociador agora)' }] : []),
    ];
    const pessoa = atual !== 'ia';
    return html`<urbi-select label="Conduz as negociações novas" valor=${atual} .opcoes=${opcoes} ?desabilitado=${this.salvando || !c.ligado}
        @urbi:select-change=${(e: CustomEvent) => {
          const v = String(e.detail.valor ?? 'ia');
          const uid = Number(v.replace('pessoa:', ''));
          void this.gravar(v.startsWith('pessoa:') && uid ? { negociador_padrao_id: uid, conduz_padrao: 'humano' } : { conduz_padrao: 'ia', negociador_padrao_id: null }, 'Salvo.');
        }}></urbi-select>
      <urbi-prosa papel="dica">${!c.ligado
        ? 'Desligado: nada entra sozinho e as negociações novas começam conduzidas por você.'
        : pessoa
          ? 'Toda negociação nova já nasce atribuída a esta pessoa, que recebe um aviso. Ela conduz dentro do mandato, com as mesmas garantias do Negociador IA; o aceite final continua só seu.'
          : 'Toda negociação nova começa conduzida pelo Negociador IA; em cada uma, você assume quando quiser.'}</urbi-prosa>`;
  }

  /**
   * Grava uma mudança da config e redesenha com a resposta (que é a config inteira). As instruções só
   * voltam do servidor quando foram elas a mudança: o que está digitado e não salvo sobrevive a um
   * estilo, gatilho ou liga/desliga. Se falha, o controle (`alvo`) volta ao valor gravado.
   */
  private async gravar(mudanca: Partial<Config>, aviso = 'Salvo.', alvo?: { el: any; prop: 'marcado' | 'checked'; anterior: boolean }) {
    if (!this.vida.vivo()) return;
    this.salvando = true;
    try {
      this.config = await this.vida.esperar(enviar('PUT', '/negociador/config', mudanca));
      if ('instrucoes_corretor' in mudanca) this.instrucoes = this.config!.instrucoes_corretor ?? '';
      urbiVerso.notificar(aviso, 'sucesso');
    } catch (e) {
      if (this.vida.encerrado(e)) return;
      await urbiVerso.alertar({ titulo: 'Não foi possível salvar', mensagem: mensagemDeErro(e), tipo: 'erro' });
      if (!this.vida.vivo()) return;
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

  private editarObjecao(o: Linha) {
    return this.semAvisoDeOutraConta(async () => {
      const atual = o.minha ?? o.padrao;
      const v = await this.vida.esperar(urbiVerso.formulario({
        titulo: `Minha resposta · ${o.titulo}`,
        mensagem: `Quando o cliente diz "${o.fala_cliente}"`,
        campos: [
          { nome: 'pergunta_exploracao', tipo: 'texto_longo', rotulo: 'Pergunta para explorar', obrigatorio: true, valor: atual.pergunta_exploracao ?? '' },
          { nome: 'resposta_base', tipo: 'texto_longo', rotulo: 'Resposta', obrigatorio: true, valor: atual.resposta_base ?? '' },
          { nome: 'proximo_passo', tipo: 'texto_longo', rotulo: 'Próximo passo', obrigatorio: true, valor: atual.proximo_passo ?? '' },
        ],
        rotuloConfirmar: 'Salvar a minha resposta',
      }));
      if (!v) return;
      await this.objecao({ categoria: o.categoria, ...v }, 'Sua resposta foi salva.');
    });
  }

  private async objecao(corpo: Record<string, unknown>, aviso: string) {
    if (!this.vida.vivo()) return;
    try {
      const item = await this.vida.esperar(enviar('PUT', '/negociador/objecoes', corpo));
      this.objecoes = this.objecoes.map((x) => (x.categoria === item.categoria ? item : x));
      urbiVerso.notificar(aviso, 'sucesso');
    } catch (e) {
      if (this.vida.encerrado(e)) return;
      await urbiVerso.alertar({ titulo: 'Não foi possível salvar', mensagem: mensagemDeErro(e), tipo: 'erro' });
    }
  }

  render() {
    if (this.falha) return estadoDaFalha(this.falha, () => void this.carregar());
    const c = this.config;
    if (!c) return estadoTela('carregando');
    const estilos = ESTILOS.map((e) => ({ id: e, rotulo: ESTILO_NEGOCIADOR[e].rotulo, explicacao: ESTILO_NEGOCIADOR[e].jeito, exemplo: ESTILO_NEGOCIADOR[e].exemplo }));
    return html`<urbi-stack>
      <urbi-linha justificar="entre" alinhar="centro" quebrar>
        <urbi-prosa papel="titulo">Negociador</urbi-prosa>
        <urbi-linha alinhar="centro">
          <urbi-badge cor=${c.ligado ? 'sucesso' : 'padrao'}>${c.ligado ? 'Ligado' : 'Pausado'}</urbi-badge>
          <urbi-botao variante="secundario" icone=${c.ligado ? 'fa-solid fa-pause' : 'fa-solid fa-play'} ?carregando=${this.salvando}
            @click=${() => void this.gravar({ ligado: !c.ligado }, c.ligado ? 'Negociador pausado.' : 'Negociador ligado.')}>${c.ligado ? 'Pausar' : 'Ligar'}</urbi-botao>
        </urbi-linha>
      </urbi-linha>
      <urbi-grid min="260px">
        <urbi-card expandir titulo="1 · Quando entra" icone="fa-solid fa-bolt">
          <urbi-prosa papel="dica">O Negociador começa a atuar quando:</urbi-prosa>
          ${GATILHOS_EM_USO.map(
            (g) => html`<urbi-checkbox label=${ROTULO_GATILHO[g]} ?marcado=${c.gatilhos[g] !== false} ?desabilitado=${this.salvando}
              @urbi:checkbox-change=${(e: CustomEvent) =>
                void this.gravar({ gatilhos: { [g]: !!e.detail.marcado } }, 'Salvo.', { el: e.target, prop: 'marcado', anterior: c.gatilhos[g] !== false })}></urbi-checkbox>`,
          )}
        </urbi-card>
        <urbi-card expandir titulo="2 · Quem negocia por padrão" icone="fa-solid fa-user-gear">
          ${this.quemConduz(c)}
          ${this.pessoas()}
        </urbi-card>
      </urbi-grid>
      <urbi-card titulo="3 · Estilo" icone="fa-solid fa-comment-dots">
        <urbi-grid min="200px">
          ${escolhaUnica(estilos, c.estilo as (typeof ESTILOS)[number], (e) => void this.gravar({ estilo: e }, `Estilo ${ESTILO_NEGOCIADOR[e].rotulo.toLowerCase()}.`), { desabilitado: this.salvando })}
        </urbi-grid>
      </urbi-card>
      <urbi-grid min="260px">
        <urbi-card expandir titulo="4 · Regras fixas" icone="fa-solid fa-shield-halved">
          <urbi-prosa papel="dica">Da plataforma: valem sempre, acima das suas instruções, e não podem ser desligadas.</urbi-prosa>
          ${REGRAS_FIXAS.map((r) => html`<urbi-linha><urbi-icone classe="fa-solid fa-check"></urbi-icone><urbi-prosa>${r}</urbi-prosa></urbi-linha>`)}
        </urbi-card>
        <urbi-card expandir titulo="5 · Suas instruções" icone="fa-solid fa-pen-to-square">
          <urbi-textarea label="Como o Negociador deve conduzir" rows="8" valor=${this.instrucoes} placeholder="Em branco, vale o modelo do app."
            erro=${this.instrucoes.trim().length > LIMITE_INSTRUCOES ? `Até ${LIMITE_INSTRUCOES.toLocaleString('pt-BR')} caracteres.` : ''}
            @urbi:input-change=${(e: CustomEvent) => (this.instrucoes = String(e.detail.valor ?? ''))}></urbi-textarea>
          <urbi-linha justificar="entre" quebrar>
            <urbi-prosa papel="fraco">${contadorInstrucoes(this.instrucoes, LIMITE_INSTRUCOES)}${c.instrucoes_corretor ? '' : ' · em branco, vale o modelo'}</urbi-prosa>
            <urbi-linha>
              ${this.instrucoes.trim() ? nothing : html`<urbi-botao variante="texto" @click=${() => (this.instrucoes = PROMPT_PARTE_2_PADRAO)}>Começar do modelo</urbi-botao>`}
              <urbi-botao icone="fa-solid fa-check" ?carregando=${this.salvando} @click=${() => this.salvarInstrucoes()}>Salvar instruções</urbi-botao>
            </urbi-linha>
          </urbi-linha>
        </urbi-card>
      </urbi-grid>
      <urbi-card titulo="6 · Respostas a objeções" icone="fa-solid fa-comments">
        <urbi-lista separador .itens=${this.objecoes} .render_item=${(o: Linha) => html`<urbi-linha justificar="entre" quebrar>
            <urbi-stack>
              <urbi-linha quebrar>
                <urbi-prosa>${o.titulo}</urbi-prosa>
                <urbi-badge cor=${o.usando === 'corretor' ? 'info' : 'padrao'}>${o.usando === 'corretor' ? 'Minha resposta' : 'Padrão'}</urbi-badge>
              </urbi-linha>
              <urbi-prosa papel="fraco">"${o.fala_cliente}"</urbi-prosa>
            </urbi-stack>
            <urbi-linha>
              <urbi-botao variante="texto" ariaLabel=${`Editar a resposta a ${o.titulo}`} @click=${() => void this.editarObjecao(o)}>Editar</urbi-botao>
              ${o.minha ? html`<urbi-botao variante="texto" ariaLabel=${`Voltar ao padrão: ${o.titulo}`} @click=${() => void this.objecao({ categoria: o.categoria, usar_padrao: true }, 'Voltou ao padrão.')}>Voltar ao padrão</urbi-botao>` : nothing}
            </urbi-linha>
          </urbi-linha>`}></urbi-lista>
      </urbi-card>
    </urbi-stack>`;
  }
}

/**
 * 7 · Testar (P17, direita): o motor sobre uma negociação fictícia, sem gravar nada, como uma conversa
 * simulada: o corretor escreve como comprador e a resposta do Negociador volta em bolha, com o selo "não
 * revelou o recuo" quando a garantia de sigilo passou. Os valores do teste ficam no "Valores do teste"
 * (o detalhe do cartão). Os balões são `urbi-badge quebra-linha` alinhados por `urbi-linha` (o `urbi-chat`
 * pede a altura de uma coluna inteira, que este cartão não tem; diferença de primitivo, D-124).
 */
interface FalaTeste {
  quem: 'comprador' | 'negociador';
  texto: string;
  detalhe?: Linha;
}

@customElement('pc-negociador-teste')
export class PcNegociadorTeste extends LitElement {
  @state() private ia: boolean | null = null;
  @state() private valores = { pedido: '1.450.000', alvo: '1.400.000', recuo: '1.360.000', oferta: '1.320.000', teto: '1.400.000' };
  @state() private rascunho = PERGUNTA_TESTE;
  @state() private conversa: FalaTeste[] = [];
  @state() private testando = false;
  @state() private numeros: Linha | null = null;
  /** A conta em que o painel nasceu: resposta (ou falha) que volta depois da troca não entra na tela. */
  private readonly vida = gesto();

  connectedCallback() {
    super.connectedCallback();
    void this.vida.esperar(chamarApi('/negociador/ia')).then(
      (r) => (this.ia = !!r?.disponivel),
      (e) => void (this.vida.encerrado(e) || (this.ia = false)),
    );
    void this.vida.esperar(chamarApi('/negociador/numeros')).then(
      (r) => (this.numeros = r),
      (e) => void (this.vida.encerrado(e) || (this.numeros = null)),
    );
  }

  private async testar() {
    const v = this.valores;
    const fala = this.rascunho.trim();
    if (!fala) return;
    const [pedido, alvo, recuo, oferta, teto] = [v.pedido, v.alvo, v.recuo, v.oferta, v.teto].map((x) => reaisParaCentavos(x));
    // O teto pode ficar em branco (desconhecido: sem ZOPA na resposta); escrito, tem que ser válido.
    if (!pedido || !alvo || !recuo || !oferta || Number.isNaN(teto)) {
      await urbiVerso.alertar({ titulo: 'Valores inválidos', mensagem: 'Abra "Valores do teste" e escreva os valores em reais, por exemplo 1.360.000.', tipo: 'alerta' });
      return;
    }
    if (!this.vida.vivo()) return;
    this.testando = true;
    this.conversa = [...this.conversa, { quem: 'comprador', texto: fala }];
    this.rascunho = '';
    try {
      const r = await this.vida.esperar(enviar('POST', '/negociador/teste', {
        mandato: { preco_pedido_c: pedido, alvo_c: alvo, recuo_c: recuo, autonomia: 'pergunta_antes' },
        propostas: [{ direcao: 'comprador', valor_c: oferta }],
        mensagem_cliente: fala,
        teto_estimado_c: teto ?? null,
      }));
      this.conversa = [...this.conversa, { quem: 'negociador', texto: r.resposta?.mensagem || 'O Negociador não escreveu mensagem nesta rodada.', detalhe: r }];
    } catch (e) {
      if (this.vida.encerrado(e)) return;
      await urbiVerso.alertar({ titulo: 'Não foi possível testar', mensagem: mensagemDeErro(e), tipo: 'erro' });
    } finally {
      this.testando = false;
    }
  }

  private campo(rotulo: string, chave: keyof PcNegociadorTeste['valores']) {
    return html`<urbi-input label=${rotulo} valor=${this.valores[chave]} @urbi:input-change=${(e: CustomEvent) => (this.valores = { ...this.valores, [chave]: String(e.detail.valor ?? '') })}></urbi-input>`;
  }

  /** O que veio junto da resposta: a contraproposta, as garantias, a passagem a você e a ZOPA. */
  private detalhe(r: Linha) {
    const cp = r.resposta?.contraproposta;
    const z = r.zopa;
    const sigilo = (r.validacoes ?? []).find((x: Linha) => x.garantia === 'sigilo');
    return html`<urbi-stack>
      ${sigilo?.ok ? html`<urbi-linha><urbi-badge cor="sucesso">${SELO_SIGILO}</urbi-badge></urbi-linha>` : nothing}
      ${cp?.valor_c ? html`<urbi-prosa papel="secundario">Contraproposta: ${reais(cp.valor_c)}${cp.concessao ? ` · ${cp.concessao}` : ''}</urbi-prosa>` : nothing}
      ${(r.validacoes ?? []).filter((x: Linha) => !x.ok).map(
        (x: Linha) => html`<urbi-linha>
          <urbi-icone classe="fa-solid fa-xmark"></urbi-icone>
          <urbi-prosa papel="alerta">${x.descricao}</urbi-prosa>
        </urbi-linha>`,
      )}
      ${r.passagem ? html`<urbi-prosa papel="alerta">Passaria a você${(r.motivos_passagem ?? []).length ? `: ${r.motivos_passagem.map((m: Linha) => m.descricao).join('; ')}` : '.'}</urbi-prosa>` : nothing}
      ${z?.existe === true ? html`<urbi-prosa papel="dica">ZOPA deste teste: de ${reais(z.de_c)} a ${reais(z.ate_c)}.</urbi-prosa>` : z?.existe === false ? html`<urbi-prosa papel="dica">Sem ZOPA neste teste: o teto do comprador fica abaixo do recuo.</urbi-prosa>` : nothing}
    </urbi-stack>`;
  }

  private bolhas() {
    return this.conversa.map((f) =>
      f.quem === 'comprador'
        ? html`<urbi-linha justificar="fim"><urbi-stack>
            <urbi-prosa papel="fraco">Você, como comprador</urbi-prosa>
            <urbi-badge cor="info" quebra-linha>${f.texto}</urbi-badge>
          </urbi-stack></urbi-linha>`
        : html`<urbi-linha justificar="inicio"><urbi-stack>
            <urbi-prosa papel="fraco">Negociador · teste</urbi-prosa>
            <urbi-badge quebra-linha>${f.texto}</urbi-badge>
            ${f.detalhe ? this.detalhe(f.detalhe) : nothing}
          </urbi-stack></urbi-linha>`,
    );
  }

  render() {
    const n = this.numeros;
    return html`<urbi-stack>
      <urbi-card titulo="7 · Testar" icone="fa-solid fa-flask">
        <urbi-prosa papel="dica">Faça o papel do comprador. Nada é gravado nem enviado.</urbi-prosa>
        ${this.ia === false
          ? estadoTela('ia_indisponivel', { mensagem: 'IA indisponível agora: o teste volta quando ela voltar. O resto dos ajustes funciona normalmente.' })
          : html`<urbi-stack>
                ${this.bolhas()}
                ${this.testando ? html`<urbi-prosa papel="fraco">O Negociador está respondendo…</urbi-prosa>` : nothing}
                <urbi-textarea label="Escreva como comprador" rows="2" valor=${this.rascunho} @urbi:input-change=${(e: CustomEvent) => (this.rascunho = String(e.detail.valor ?? ''))}></urbi-textarea>
                <urbi-linha justificar="entre">
                  ${this.conversa.length ? html`<urbi-botao variante="texto" ?desabilitado=${this.testando} @click=${() => ((this.conversa = []), (this.rascunho = PERGUNTA_TESTE))}>Recomeçar</urbi-botao>` : html`<span></span>`}
                  <urbi-botao icone="fa-solid fa-paper-plane" ?carregando=${this.testando} ?desabilitado=${this.ia === null || !this.rascunho.trim()} @click=${() => void this.testar()}>Enviar</urbi-botao>
                </urbi-linha>
              </urbi-stack>`}
        <div slot="detalhe">
          <urbi-prosa papel="secao">Valores do teste</urbi-prosa>
          <urbi-grid min="140px">
            ${this.campo('Pedido (R$)', 'pedido')}${this.campo('Alvo (R$)', 'alvo')}${this.campo('Recuo (R$)', 'recuo')}${this.campo('Oferta do comprador (R$)', 'oferta')}${this.campo('Teto do comprador (R$)', 'teto')}
          </urbi-grid>
        </div>
      </urbi-card>
      <urbi-card titulo="Este mês" icone="fa-solid fa-chart-simple">
        <urbi-grid min="140px">
          <urbi-kpi rotulo="Rodadas" .valor=${n?.rodadas ?? '—'}></urbi-kpi>
          <urbi-kpi rotulo="Aprovadas sem edição" formato="texto" .valor=${n ? (n.decididas ? `${Math.round((n.aprovadas_sem_edicao / n.decididas) * 100)}%` : '—') : '—'}></urbi-kpi>
        </urbi-grid>
        <urbi-prosa papel="fraco">Custo estimado por rodada: ${CUSTO_POR_RODADA.toLowerCase()}.</urbi-prosa>
      </urbi-card>
    </urbi-stack>`;
  }
}
