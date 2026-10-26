import { LitElement, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { UrbiVersoAPI } from '@urbiverso/sdk';
import './selecoes-cliente.js';
import { abrirAssistenteSobre } from './assistente.js';
import { chamarApi, data, dataHora, enviar, formularioEnviar, juntarDataHora, mensagemDeErro, opcoes, opcoesChip, reais, ROTULO_MOTIVO_PERDA, ROTULO_PAPEL, ROTULO_TIPO_ATIVIDADE } from '../apoio.js';

declare const urbiVerso: UrbiVersoAPI;

type Linha = Record<string, any>;
interface Ficha {
  contato: Linha;
  negocios: Linha[];
  atividades: Linha[];
  visitas: Linha[];
  linha_do_tempo: Linha[];
  consentimento: Linha | null;
  abordagem: Linha | null;
  classificacoes: Linha[];
}

const CANAL: Record<string, string> = { whatsapp: 'WhatsApp', ligacao: 'ligação', email: 'e-mail', visita: 'visita' };
const STATUS_ATIVIDADE: Record<string, string> = { pendente: 'Pendente', feita: 'Feita', cancelada: 'Cancelada', nao_compareceu: 'Não compareceu' };

// Ficha do contato: dados, próximo passo, negócios (com mudança de etapa), atividades,
// consentimento e a linha do tempo de tudo que aconteceu com ele.
@customElement('pc-tela-ficha-contato')
export class PcTelaFichaContato extends LitElement {
  @property({ type: Number }) contatoId = 0;
  @state() private ficha: Ficha | null = null;
  @state() private envios: Linha[] = [];
  @state() private etapas: Linha[] = [];
  @state() private falha: string | null = null;

  connectedCallback() {
    super.connectedCallback();
    void this.carregar();
  }

  private async carregar() {
    this.falha = null;
    try {
      const [ficha, etapas, envios] = await Promise.all([
        chamarApi(`/contatos/${this.contatoId}`),
        chamarApi('/funil/etapas'),
        // O histórico de envios é complementar: se falhar, a ficha abre sem ele.
        chamarApi(`/envios?contato_id=${this.contatoId}`).catch(() => ({ dados: [] })),
      ]);
      this.ficha = ficha;
      this.etapas = etapas.etapas;
      this.envios = envios.dados;
    } catch (e) {
      this.falha = (e as Error).message;
    }
  }

  private async depois(r: unknown) {
    if (r) await this.carregar();
  }

  private editar() {
    const c = this.ficha!.contato;
    void formularioEnviar(
      'Editar contato',
      [
        { nome: 'nome', tipo: 'texto', rotulo: 'Nome', obrigatorio: true, valor: c.nome },
        { nome: 'telefone', tipo: 'texto', rotulo: 'Telefone (WhatsApp)', valor: c.telefone ?? '' },
        { nome: 'email', tipo: 'texto', rotulo: 'E-mail', valor: c.email ?? '' },
        { nome: 'papeis', tipo: 'texto', rotulo: 'Papéis (separe por vírgula)', valor: c.papeis.split(',').map((p: string) => ROTULO_PAPEL[p] ?? p).join(', ') },
        {
          nome: 'temperatura',
          tipo: 'selecao',
          rotulo: 'Temperatura',
          valor: c.temperatura ?? '',
          opcoes: [{ valor: '', rotulo: 'Sem classificação' }, ...opcoesChip('temperatura')],
        },
        { nome: 'temperatura_motivo', tipo: 'texto', rotulo: 'Por que essa temperatura (se mudou)', placeholder: 'Ex.: disse que compra só no ano que vem' },
        { nome: 'observacoes', tipo: 'texto_longo', rotulo: 'Observações', valor: c.observacoes ?? '' },
      ],
      'PATCH',
      `/contatos/${c.id}`,
    ).then((r) => this.depois(r));
  }

  private proximoPasso() {
    const c = this.ficha!.contato;
    const quando = c.proximo_passo_em ? new Date(c.proximo_passo_em) : null;
    void formularioEnviar(
      'Próximo passo',
      [
        { nome: 'proximo_passo', tipo: 'texto', rotulo: 'O que fazer', valor: c.proximo_passo ?? '', placeholder: 'Ex.: ligar para combinar visita' },
        { nome: 'dia', tipo: 'data', rotulo: 'Dia', valor: quando ? quando.toLocaleDateString('sv-SE') : null },
        { nome: 'hora', tipo: 'texto', rotulo: 'Hora (opcional)', valor: quando ? quando.toTimeString().slice(0, 5) : '', placeholder: '09:00' },
      ],
      'PATCH',
      `/contatos/${c.id}`,
      (v) => ({ proximo_passo: v.proximo_passo, proximo_passo_em: juntarDataHora(v.dia, v.hora) ?? '' }),
    ).then((r) => this.depois(r));
  }

  private nota() {
    void formularioEnviar('Registrar contato ou nota', [{ nome: 'texto', tipo: 'texto_longo', rotulo: 'O que aconteceu', obrigatorio: true }], 'POST', `/contatos/${this.contatoId}/notas`).then((r) =>
      this.depois(r),
    );
  }

  /** Imóveis da carteira para escolher no negócio e na visita (os 50 mais recentes, com busca). */
  private async opcoesImoveis() {
    try {
      const r = await chamarApi('/imoveis');
      return [{ valor: '', rotulo: 'Nenhum' }, ...r.dados.map((i: Linha) => ({ valor: String(i.id), rotulo: `${i.codigo} · ${i.titulo ?? i.bairro ?? ''}`, textoBusca: i.bairro ?? '' }))];
    } catch {
      return [{ valor: '', rotulo: 'Nenhum' }];
    }
  }

  private async novoNegocio() {
    const imoveis = await this.opcoesImoveis();
    void formularioEnviar(
      'Novo negócio',
      [
        { nome: 'pipeline', tipo: 'selecao', rotulo: 'Tipo', valor: 'compra', opcoes: [{ valor: 'compra', rotulo: 'Compra (o cliente quer comprar)' }, { valor: 'venda_captacao', rotulo: 'Venda (o cliente quer vender)' }] },
        { nome: 'titulo', tipo: 'texto', rotulo: 'Título (opcional)', placeholder: 'Ex.: Apartamento 3 quartos na Asa Norte' },
        { nome: 'valor_estimado', tipo: 'numero', rotulo: 'Valor estimado (R$, opcional)', min: 0 },
        { nome: 'comissao', tipo: 'numero', rotulo: 'Sua comissão (%, opcional)', min: 0, max: 100, step: 0.5 },
        { nome: 'imovel_id', tipo: 'selecao', rotulo: 'Imóvel (opcional)', valor: '', pesquisavel: true, opcoes: imoveis },
      ],
      'POST',
      '/negocios',
      (v) => ({ ...v, imovel_id: v.imovel_id ? Number(v.imovel_id) : null, contato_id: this.contatoId }),
    ).then((r) => this.depois(r));
  }

  private async moverEtapa(negocio: Linha) {
    const etapas = this.etapas.filter((e) => e.pipeline === negocio.pipeline && e.ativa);
    const v = await urbiVerso.formulario({
      titulo: 'Mudar etapa',
      campos: [
        { nome: 'etapa_id', tipo: 'selecao', rotulo: 'Etapa', valor: String(negocio.etapa_id), opcoes: etapas.map((e) => ({ valor: String(e.id), rotulo: e.nome })) },
        { nome: 'motivo_perda', tipo: 'selecao', rotulo: 'Motivo, se perdido', opcoes: opcoes(ROTULO_MOTIVO_PERDA) },
      ],
    });
    if (!v) return;
    try {
      await enviar('PATCH', `/negocios/${negocio.id}`, { etapa_id: Number(v.etapa_id), motivo_perda: v.motivo_perda || undefined });
      await this.carregar();
    } catch (e) {
      await urbiVerso.alertar({ titulo: 'Não foi possível mudar a etapa', mensagem: mensagemDeErro(e), tipo: 'erro' });
    }
  }

  private async novaAtividade() {
    const imoveis = await this.opcoesImoveis();
    void formularioEnviar(
      'Agendar',
      [
        { nome: 'tipo', tipo: 'selecao', rotulo: 'Tipo', valor: 'ligacao', opcoes: opcoes(ROTULO_TIPO_ATIVIDADE) },
        { nome: 'titulo', tipo: 'texto', rotulo: 'O que é', obrigatorio: true },
        { nome: 'dia', tipo: 'data', rotulo: 'Dia', obrigatorio: true },
        { nome: 'hora', tipo: 'texto', rotulo: 'Hora', valor: '09:00' },
        { nome: 'local', tipo: 'texto', rotulo: 'Local (visita ou reunião)' },
        { nome: 'imovel_id', tipo: 'selecao', rotulo: 'Imóvel visitado (só para visita)', valor: '', pesquisavel: true, opcoes: imoveis },
      ],
      'POST',
      '/atividades',
      (v) => ({
        tipo: v.tipo, titulo: v.titulo, quando: juntarDataHora(v.dia, v.hora), local: v.local, contato_id: this.contatoId,
        imovel_id: v.tipo === 'visita' && v.imovel_id ? Number(v.imovel_id) : undefined,
      }),
    ).then((r) => this.depois(r));
  }

  private retornoVisita(a: Linha) {
    const v = this.ficha!.visitas.find((x: Linha) => x.atividade_id === a.id);
    void formularioEnviar(
      'Retorno da visita',
      [
        { nome: 'nota', tipo: 'selecao', rotulo: 'O cliente gostou?', valor: v?.feedback_nota ? String(v.feedback_nota) : null,
          opcoes: [{ valor: '5', rotulo: '5 — adorou' }, { valor: '4', rotulo: '4 — gostou' }, { valor: '3', rotulo: '3 — mais ou menos' }, { valor: '2', rotulo: '2 — não gostou' }, { valor: '1', rotulo: '1 — descartou' }] },
        { nome: 'texto', tipo: 'texto_longo', rotulo: 'O que ele disse', valor: v?.feedback_texto ?? '' },
        { nome: 'compartilhar', tipo: 'booleano', rotulo: 'Pode compartilhar com o proprietário (sem o nome do cliente)', valor: v?.compartilhar_com_proprietario ?? true },
      ],
      'POST',
      `/visitas/${a.id}/feedback`,
      (x) => ({ ...x, nota: x.nota ? Number(x.nota) : null }),
    ).then((r) => this.depois(r));
  }

  private async concluir(a: Linha) {
    try {
      await enviar('PATCH', `/atividades/${a.id}`, { status: 'feita' });
      await this.carregar();
    } catch (e) {
      await urbiVerso.alertar({ titulo: 'Não foi possível concluir', mensagem: mensagemDeErro(e), tipo: 'erro' });
    }
  }

  private async consentimento(registrar: boolean) {
    const ok = await urbiVerso.confirmar(
      registrar
        ? { titulo: 'Registrar consentimento', mensagem: 'O cliente autorizou receber mensagens suas e do seu atendimento automático?', rotuloConfirmar: 'Sim, autorizou' }
        : { titulo: 'Revogar consentimento', mensagem: 'A partir de agora ele só recebe mensagens que você enviar manualmente.', rotuloConfirmar: 'Revogar' },
    );
    if (!ok) return;
    try {
      await enviar('POST', `/contatos/${this.contatoId}/consentimento${registrar ? '' : '/revogar'}`, {});
      await this.carregar();
    } catch (e) {
      await urbiVerso.alertar({ titulo: 'Não foi possível salvar', mensagem: mensagemDeErro(e), tipo: 'erro' });
    }
  }

  private async remover() {
    const ok = await urbiVerso.confirmar({ titulo: 'Remover contato', mensagem: 'O contato sai da sua lista. O histórico fica guardado.', rotuloConfirmar: 'Remover', perigo: true });
    if (!ok) return;
    try {
      await enviar('PATCH', `/contatos/${this.contatoId}/remover`, {});
      urbiVerso.navegarSub('/clientes');
    } catch (e) {
      await urbiVerso.alertar({ titulo: 'Não foi possível remover', mensagem: mensagemDeErro(e), tipo: 'erro' });
    }
  }

  private async abordagemFeita() {
    const a = this.ficha!.abordagem!;
    const v = await urbiVerso.formulario({
      titulo: 'Registrar abordagem',
      campos: [{ nome: 'texto', tipo: 'texto_longo', rotulo: 'O que você fez', valor: a.abordagem }],
      rotuloConfirmar: 'Registrar',
    });
    if (v) await this.tentar('Não foi possível registrar', () => enviar('POST', `/abordagens/${this.contatoId}/feita`, { texto: v.texto }));
  }

  private async adiarAbordagem() {
    await this.tentar('Não foi possível pular', () => enviar('POST', `/abordagens/${this.contatoId}/adiar`, {}));
  }

  private async tentar(titulo: string, fn: () => Promise<unknown>) {
    try {
      await fn();
      await this.carregar();
    } catch (e) {
      await urbiVerso.alertar({ titulo, mensagem: mensagemDeErro(e), tipo: 'erro' });
    }
  }

  private async registrarEnvio() {
    const imoveis = await this.opcoesImoveis();
    const v = await urbiVerso.formulario({
      titulo: 'Registrar envio',
      mensagem: 'Anote o que você mandou ao cliente. Com um imóvel, o app prepara a mensagem para você colar no WhatsApp.',
      campos: [
        { nome: 'tipo', tipo: 'selecao', rotulo: 'O que mandou', valor: 'imovel', opcoes: [{ valor: 'imovel', rotulo: 'Imóvel' }, { valor: 'arquivo', rotulo: 'Arquivo' }, { valor: 'mensagem', rotulo: 'Mensagem' }, { valor: 'localizacao', rotulo: 'Localização' }] },
        { nome: 'imovel_id', tipo: 'selecao', rotulo: 'Imóvel', valor: '', pesquisavel: true, opcoes: imoveis },
        { nome: 'canal', tipo: 'selecao', rotulo: 'Por onde', valor: 'whatsapp', opcoes: [{ valor: 'whatsapp', rotulo: 'WhatsApp' }, { valor: 'email', rotulo: 'E-mail' }, { valor: 'presencial', rotulo: 'Pessoalmente' }] },
        { nome: 'descricao', tipo: 'texto', rotulo: 'Detalhe (opcional)' },
      ],
      rotuloConfirmar: 'Registrar',
    });
    if (!v) return;
    try {
      const r = await enviar('POST', '/envios', { ...v, contato_id: this.contatoId, imovel_id: v.imovel_id ? Number(v.imovel_id) : null });
      await this.carregar();
      if (r.mensagem) {
        const copiada = await navigator.clipboard?.writeText(r.mensagem).then(() => true, () => false);
        if (copiada) urbiVerso.notificar('Envio registrado. A mensagem foi copiada: é só colar no WhatsApp.', 'sucesso');
        else await urbiVerso.alertar({ titulo: 'Mensagem pronta para colar', mensagem: r.mensagem, tipo: 'sucesso' });
      } else urbiVerso.notificar('Envio registrado.', 'sucesso');
    } catch (e) {
      await urbiVerso.alertar({ titulo: 'Não foi possível registrar', mensagem: mensagemDeErro(e), tipo: 'erro' });
    }
  }

  /** Imóvel e nota da visita, para a linha da agenda. */
  private visitaDe(a: Linha) {
    const v = this.ficha!.visitas.find((x: Linha) => x.atividade_id === a.id);
    return v ? ` · ${v.imovel_codigo ?? 'imóvel'}${v.feedback_nota ? ` · nota ${v.feedback_nota}/5` : ''}` : '';
  }

  private acao(rotulo: string, icone: string, fn: () => void) {
    return html`<span slot="acoes"><urbi-botao variante="fantasma" pequeno icone=${icone} ariaLabel=${rotulo} title=${rotulo} @click=${fn}></urbi-botao></span>`;
  }

  /** Abre o Assistente sobre este contato (spec 11.1: "perguntar ao Assistente sobre este cliente"). */
  private perguntarAssistente() {
    const c = this.ficha!.contato;
    abrirAssistenteSobre({ id: c.id, nome: c.nome });
  }

  render() {
    const banner = this.falha
      ? html`<urbi-banner variante="erro">
          ${this.falha}
          <urbi-botao slot="acao" pequeno variante="secundario" @click=${() => this.carregar()}>Tentar de novo</urbi-botao>
        </urbi-banner>`
      : '';
    // Falha ao recarregar depois de uma ação mantém a ficha que já estava na tela.
    if (this.falha && !this.ficha) return banner;
    if (!this.ficha) return html`<urbi-loading></urbi-loading>`;
    const { contato: c, negocios, atividades, linha_do_tempo, consentimento } = this.ficha;
    const pendentes = atividades.filter((a) => a.status === 'pendente');
    return html`<urbi-stack>
      ${banner}
      <urbi-linha justificar="entre" quebrar>
        <urbi-botao variante="texto" icone="fa-solid fa-arrow-left" href=${urbiVerso.href('/clientes')}>Clientes</urbi-botao>
        <urbi-linha>
          <urbi-botao variante="secundario" pequeno icone="fa-solid fa-comment" @click=${() => this.nota()}>Registrar contato</urbi-botao>
          <urbi-botao variante="secundario" pequeno icone="fa-solid fa-comments" @click=${() => this.perguntarAssistente()}>Perguntar ao Assistente</urbi-botao>
          <urbi-botao variante="perigo" pequeno icone="fa-solid fa-trash" @click=${() => this.remover()}>Remover</urbi-botao>
        </urbi-linha>
      </urbi-linha>
      <urbi-card titulo=${c.nome} icone="fa-solid fa-user">
        ${this.acao('Editar contato', 'fa-solid fa-pen', () => this.editar())}
        <urbi-prosa>${[c.telefone, c.email].filter(Boolean).join(' · ') || 'sem telefone nem e-mail'}</urbi-prosa>
        <urbi-prosa papel="secundario">
          ${c.papeis.split(',').map((p: string) => ROTULO_PAPEL[p] ?? p).join(', ')}${c.temperatura ? ` · ${c.temperatura}${c.temperatura_motivo ? ` (${c.temperatura_motivo}${c.temperatura_autor === 'corretor' ? ', marcado por você' : ''})` : ''}` : ''} · chegou por ${c.origem_canal ?? 'origem não informada'}${c.origem_campanha ? ` (${c.origem_campanha})` : ''}
          · cadastrado em ${data(c.criado_em)}
        </urbi-prosa>
        ${c.observacoes ? html`<urbi-prosa papel="dica" pre>${c.observacoes}</urbi-prosa>` : ''}
      </urbi-card>
      ${this.ficha.abordagem
        ? html`<urbi-card titulo="Próxima abordagem" icone="fa-solid fa-route">
            <urbi-prosa>${this.ficha.abordagem.abordagem}</urbi-prosa>
            <urbi-prosa papel="secundario">${this.ficha.abordagem.etapa_nome} · ${this.ficha.abordagem.temperatura} · por ${CANAL[this.ficha.abordagem.canal_sugerido] ?? this.ficha.abordagem.canal_sugerido}${
              this.ficha.abordagem.vence_em ? ` · até ${dataHora(this.ficha.abordagem.vence_em)}` : ''}</urbi-prosa>
            <urbi-linha quebrar>
              ${this.ficha.abordagem.vencida ? html`<urbi-badge cor="alerta">Atrasada</urbi-badge>` : ''}
              <urbi-botao pequeno @click=${() => this.abordagemFeita()}>Fiz agora</urbi-botao>
              <urbi-botao variante="texto" pequeno @click=${() => this.adiarAbordagem()}>Pular</urbi-botao>
            </urbi-linha>
          </urbi-card>`
        : ''}
      <urbi-card titulo="Próximo passo" icone="fa-solid fa-forward">
        ${this.acao('Definir próximo passo', 'fa-solid fa-pen', () => this.proximoPasso())}
        ${c.proximo_passo
          ? html`<urbi-prosa>${c.proximo_passo}</urbi-prosa><urbi-prosa papel="secundario">${dataHora(c.proximo_passo_em)}</urbi-prosa>`
          : html`<urbi-prosa papel="dica">Nenhum próximo passo combinado.</urbi-prosa>`}
      </urbi-card>
      <urbi-card titulo="Negócios" icone="fa-solid fa-handshake">
        ${this.acao('Novo negócio', 'fa-solid fa-plus', () => this.novoNegocio())}
        ${negocios.length
          ? html`<urbi-lista separador .itens=${negocios} .render_item=${(n: Linha) => html`<urbi-linha justificar="entre" quebrar>
                <urbi-prosa>${n.titulo} · ${reais(n.valor_estimado_c)}${n.imovel_codigo ? ` · ${n.imovel_codigo}` : ""}</urbi-prosa>
                <urbi-linha>
                  <urbi-badge cor=${n.etapa_tipo === 'ganha' ? 'sucesso' : n.etapa_tipo === 'perdida' ? 'padrao' : 'info'}>${n.etapa_nome}</urbi-badge>
                  <urbi-botao variante="texto" pequeno @click=${() => this.moverEtapa(n)}>Mudar etapa</urbi-botao>
                </urbi-linha>
              </urbi-linha>`}></urbi-lista>`
          : html`<urbi-prosa papel="dica">Nenhum negócio. Abra um quando o cliente quiser comprar ou vender.</urbi-prosa>`}
      </urbi-card>
      <urbi-card titulo="Agenda deste cliente" icone="fa-solid fa-calendar-day">
        ${this.acao('Agendar', 'fa-solid fa-plus', () => this.novaAtividade())}
        ${atividades.length
          ? html`<urbi-lista separador .itens=${atividades} .render_item=${(a: Linha) => html`<urbi-linha justificar="entre" quebrar>
                <urbi-prosa>${ROTULO_TIPO_ATIVIDADE[a.tipo]}: ${a.titulo} · ${dataHora(a.quando)}${a.local ? ` · ${a.local}` : ''}${this.visitaDe(a)}</urbi-prosa>
                <urbi-linha>
                  ${this.ficha!.visitas.some((v: Linha) => v.atividade_id === a.id)
                    ? html`<urbi-botao variante="texto" pequeno @click=${() => this.retornoVisita(a)}>Retorno</urbi-botao>`
                    : ''}
                  ${a.status === 'pendente'
                    ? html`<urbi-botao variante="texto" pequeno @click=${() => this.concluir(a)}>Marcar feito</urbi-botao>`
                    : html`<urbi-badge>${STATUS_ATIVIDADE[a.status]}</urbi-badge>`}
                </urbi-linha>
              </urbi-linha>`}></urbi-lista>
            ${pendentes.length ? '' : html`<urbi-prosa papel="dica">Nada pendente.</urbi-prosa>`}`
          : html`<urbi-prosa papel="dica">Nada agendado. Marque uma ligação, visita ou reunião.</urbi-prosa>`}
      </urbi-card>
      <pc-selecoes-cliente .contatoId=${c.id} .nome=${c.nome} @mudou=${() => this.carregar()}></pc-selecoes-cliente>
      <urbi-card titulo="Tudo que você mandou" icone="fa-solid fa-paper-plane">
        ${this.acao('Registrar envio', 'fa-solid fa-plus', () => void this.registrarEnvio())}
        ${this.envios.length
          ? html`<urbi-lista separador .itens=${this.envios} .render_item=${(e: Linha) => html`<urbi-prosa>${e.imovel_codigo ? `${e.imovel_codigo}${e.imovel_titulo ? ` · ${e.imovel_titulo}` : ''}` : (e.descricao ?? e.tipo)}</urbi-prosa>
                <urbi-prosa papel="fraco">${dataHora(e.enviado_em)} · ${e.canal}${e.cliques ? ` · ${e.cliques} clique(s)` : ''}</urbi-prosa>`}></urbi-lista>`
          : html`<urbi-prosa papel="dica">Nada registrado. Anote os imóveis e arquivos que mandar: o histórico fica aqui.</urbi-prosa>`}
      </urbi-card>
      <urbi-card titulo="Consentimento" icone="fa-solid fa-shield-halved">
        ${consentimento
          ? html`<urbi-prosa>Autorizou receber mensagens em ${dataHora(consentimento.aceito_em)} (${consentimento.canal}).</urbi-prosa>
              <urbi-botao variante="texto" pequeno @click=${() => this.consentimento(false)}>Revogar</urbi-botao>`
          : html`<urbi-prosa papel="dica">Sem consentimento registrado: o atendimento automático só poderá usar mensagens-modelo aprovadas.</urbi-prosa>
              <urbi-botao variante="texto" pequeno @click=${() => this.consentimento(true)}>Registrar consentimento</urbi-botao>`}
      </urbi-card>
      <urbi-card titulo="Linha do tempo" icone="fa-solid fa-clock-rotate-left">
        ${linha_do_tempo.length
          ? html`<urbi-lista separador .itens=${linha_do_tempo} .render_item=${(l: Linha) => html`<urbi-prosa>${l.resumo}</urbi-prosa>
                <urbi-prosa papel="fraco">${dataHora(l.ocorrido_em)} · ${l.autor_nome ?? 'sistema'}</urbi-prosa>`}></urbi-lista>`
          : html`<urbi-prosa papel="dica">Nada registrado ainda.</urbi-prosa>`}
      </urbi-card>
    </urbi-stack>`;
  }
}
