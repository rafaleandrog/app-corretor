import { LitElement, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { UrbiVersoAPI } from '@urbiverso/sdk';
import './selecoes-cliente.js';
import { abrirAssistenteSobre } from './assistente.js';
import { tarefaDaAbordagem } from '../../comum/funil';
import { PAPEIS_NA_TELA } from '../../comum/crm';
import { linkWhatsapp } from '../../comum/pagina';
import { acoesComMais, chamarApi, chip, data, dataHora, enviar, filtrosDaUrl, filtrosNaUrl, formularioEnviar, juntarDataHora, mensagemDeErro, opcoes, opcoesChip, reais, rotuloChip, ROTULO_MOTIVO_PERDA, ROTULO_PAPEL, ROTULO_TIPO_ATIVIDADE } from '../apoio.js';

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

interface Sugestao {
  mensagem: string;
  ia: boolean;
}

const CANAL: Record<string, string> = { whatsapp: 'WhatsApp', ligacao: 'ligação', email: 'e-mail', visita: 'visita' };
const STATUS_ATIVIDADE: Record<string, string> = { pendente: 'Pendente', feita: 'Feita', cancelada: 'Cancelada', nao_compareceu: 'Não compareceu' };

// Ficha do contato (spec 11.1, bloco 4 da fase 1.5): no topo, o resumo em uma frase e os botões
// Resumir, Mensagem sugerida e Virar tarefa; as seções secundárias recolhidas (slot `detalhe` do
// urbi-card) e a linha do tempo aberta.
@customElement('pc-tela-ficha-contato')
export class PcTelaFichaContato extends LitElement {
  @property({ type: Number }) contatoId = 0;
  @state() private ficha: Ficha | null = null;
  @state() private envios: Linha[] = [];
  @state() private etapas: Linha[] = [];
  @state() private falha: string | null = null;
  /** Sonda dos slots (sem custo): Resumir só aparece com a IA do Assistente liberada. */
  @state() private ia = { resumo: false, mensagem: false };
  @state() private resumo: string | null = null;
  @state() private resumindo = false;
  @state() private sugestao: Sugestao | null = null;
  @state() private sugerindo = false;
  @state() private criandoTarefa = false;
  /** `?sugerir=1` (Início e quadro): carrega a mensagem sugerida uma vez, e só com abordagem. */
  private sugerirDaUrl = filtrosDaUrl().get('sugerir') === '1';

  connectedCallback() {
    super.connectedCallback();
    void this.carregar();
    void chamarApi(`/contatos/${this.contatoId}/ia`).then(
      (r) => (this.ia = { resumo: !!r.resumo, mensagem: !!r.mensagem }),
      () => undefined,
    );
  }

  private async carregar() {
    this.falha = null;
    const sugerirAgora = this.sugerirDaUrl;
    if (sugerirAgora) {
      this.sugerirDaUrl = false;
      filtrosNaUrl(filtrosDaUrl(), {}, ['sugerir']);
    }
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
      if (sugerirAgora && ficha.abordagem) void this.sugerir();
    } catch (e) {
      this.falha = (e as Error).message;
    }
  }

  private async depois(r: unknown) {
    if (r) await this.carregar();
  }

  private editar() {
    const c = this.ficha!.contato;
    // Na tela, só comprador e proprietário (spec 15.9, S11); outro papel que veio da planilha fica.
    const papeis: string[] = c.papeis.split(',').filter(Boolean);
    const outros = papeis.filter((p) => !(PAPEIS_NA_TELA as readonly string[]).includes(p));
    void formularioEnviar(
      'Editar contato',
      [
        { nome: 'nome', tipo: 'texto', rotulo: 'Nome', obrigatorio: true, valor: c.nome },
        { nome: 'telefone', tipo: 'texto', rotulo: 'Telefone (WhatsApp)', valor: c.telefone ?? '' },
        { nome: 'email', tipo: 'texto', rotulo: 'E-mail', valor: c.email ?? '' },
        ...PAPEIS_NA_TELA.map((p) => ({ nome: `papel_${p}`, tipo: 'booleano' as const, rotulo: ROTULO_PAPEL[p], valor: papeis.includes(p) })),
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
      ({ papel_comprador, papel_proprietario, ...v }) => ({
        ...v,
        papeis: [...PAPEIS_NA_TELA.filter((p) => ({ comprador: papel_comprador, proprietario: papel_proprietario })[p]), ...outros].join(','),
      }),
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
    this.sugestao = null;
    await this.tentar('Não foi possível pular', () => enviar('POST', `/abordagens/${this.contatoId}/adiar`, {}));
  }

  /** Resumir (slot `assistente`): só mostrado, nunca gravado. */
  private async resumir() {
    this.resumindo = true;
    try {
      this.resumo = (await enviar('POST', `/contatos/${this.contatoId}/resumo`, {})).resumo;
    } catch (e) {
      await urbiVerso.alertar({ titulo: 'Não foi possível resumir', mensagem: mensagemDeErro(e), tipo: 'erro' });
    } finally {
      this.resumindo = false;
    }
  }

  /** Mensagem sugerida (slot `funil`); sem IA, a rota devolve o texto do playbook. */
  private async sugerir() {
    if (this.sugerindo) return;
    this.sugerindo = true;
    try {
      const r = await chamarApi(`/contatos/${this.contatoId}/mensagem-sugerida`);
      this.sugestao = { mensagem: r.mensagem, ia: !!r.ia };
    } catch (e) {
      await urbiVerso.alertar({ titulo: 'Não foi possível sugerir', mensagem: mensagemDeErro(e), tipo: 'erro' });
    } finally {
      this.sugerindo = false;
    }
  }

  private async copiar(texto: string) {
    const ok = await navigator.clipboard?.writeText(texto).then(() => true, () => false);
    if (ok) urbiVerso.notificar('Mensagem copiada.', 'sucesso');
    else await urbiVerso.alertar({ titulo: 'Mensagem para copiar', mensagem: texto, tipo: 'info' });
  }

  /**
   * Fazer agora: abre o WhatsApp no próprio clique, antes de qualquer `await` (senão o navegador
   * bloqueia a janela), e registra a abordagem (uma linha na linha do tempo). Sem telefone, só copia.
   */
  private fazerAgora() {
    const texto = this.sugestao?.mensagem ?? this.ficha!.abordagem!.abordagem;
    const link = linkWhatsapp(this.ficha!.contato.telefone, texto);
    if (!link) {
      void this.copiar(texto);
      return;
    }
    window.open(link, '_blank', 'noopener');
    this.sugestao = null;
    void this.tentar('Não foi possível registrar a abordagem', async () => {
      await enviar('POST', `/abordagens/${this.contatoId}/feita`, { canal: 'whatsapp', texto });
      urbiVerso.notificar('Abordagem registrada.', 'sucesso');
    });
  }

  /** Virar tarefa: a próxima abordagem vira atividade na agenda, no prazo do playbook. */
  private async virarTarefa() {
    if (this.criandoTarefa) return;
    this.criandoTarefa = true;
    try {
      const corpo = tarefaDaAbordagem(this.ficha!.abordagem as Parameters<typeof tarefaDaAbordagem>[0], this.contatoId);
      await this.tentar('Não foi possível criar a tarefa', async () => {
        await enviar('POST', '/atividades', corpo);
        urbiVerso.notificar(`Tarefa criada para ${dataHora(corpo.quando)}.`, 'sucesso');
      });
    } finally {
      this.criandoTarefa = false;
    }
  }

  /** O resumo em uma frase do topo: temperatura com o motivo, próxima abordagem e último contato. */
  private fraseDoTopo(): string {
    const { contato: c, abordagem: a } = this.ficha!;
    const partes = [
      c.temperatura ? `${rotuloChip('temperatura', c.temperatura).rotulo}${c.temperatura_motivo ? ` (${c.temperatura_motivo})` : ''}` : 'Sem temperatura',
      a ? `próximo: ${a.abordagem.charAt(0).toLowerCase()}${a.abordagem.slice(1)}, por ${CANAL[a.canal_sugerido] ?? a.canal_sugerido}${a.vence_em ? ` até ${dataHora(a.vence_em)}` : ''}` : 'sem abordagem (nenhum negócio aberto)',
      `último contato ${c.ultimo_contato_em ? `em ${data(c.ultimo_contato_em)}` : 'nunca'}`,
    ];
    return `${partes.join(' · ')}.`;
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
    const { contato: c, negocios, atividades, linha_do_tempo, consentimento, abordagem: a } = this.ficha;
    const pendentes = atividades.filter((x) => x.status === 'pendente');
    const abertos = negocios.filter((n) => n.etapa_tipo === 'aberta' || !n.etapa_tipo);
    const temTelefone = !!linkWhatsapp(c.telefone, '-');
    const mais = [
      { rotulo: 'Perguntar ao Assistente', icone: 'fa-solid fa-comments', aoEscolher: () => this.perguntarAssistente() },
      ...(a
        ? [
            { rotulo: 'Registrar abordagem feita', icone: 'fa-solid fa-check', aoEscolher: () => void this.abordagemFeita() },
            { rotulo: 'Pular a abordagem', icone: 'fa-solid fa-forward', aoEscolher: () => void this.adiarAbordagem() },
          ]
        : []),
      { rotulo: 'Remover contato', icone: 'fa-solid fa-trash', perigo: true, aoEscolher: () => void this.remover() },
    ];
    return html`<urbi-stack>
      ${banner}
      <urbi-linha justificar="entre" quebrar>
        <urbi-botao variante="texto" icone="fa-solid fa-arrow-left" href=${urbiVerso.href('/clientes')}>Clientes</urbi-botao>
        ${acoesComMais({ rotulo: 'Registrar contato', icone: 'fa-solid fa-comment', aoEscolher: () => this.nota() }, mais)}
      </urbi-linha>
      <urbi-card titulo=${c.nome} icone="fa-solid fa-user">
        ${this.acao('Editar contato', 'fa-solid fa-pen', () => this.editar())}
        <urbi-linha quebrar>
          ${chip('temperatura', c.temperatura, c.temperatura_motivo)}
          ${c.papeis.split(',').filter(Boolean).map((p: string) => chip('papel', p))}
          ${chip('origem', c.origem_canal)}
          ${a?.vencida ? html`<urbi-badge cor="alerta">Abordagem atrasada</urbi-badge>` : ''}
        </urbi-linha>
        <urbi-prosa>${this.fraseDoTopo()}</urbi-prosa>
        <urbi-linha quebrar>
          ${this.ia.resumo
            ? html`<urbi-botao pequeno variante="secundario" icone="fa-solid fa-wand-magic-sparkles" ?carregando=${this.resumindo} @click=${() => this.resumir()}>Resumir</urbi-botao>`
            : ''}
          ${a
            ? html`<urbi-botao pequeno variante="secundario" icone="fa-solid fa-message" ?carregando=${this.sugerindo} @click=${() => this.sugerir()}>Mensagem sugerida</urbi-botao>
                <urbi-botao pequeno variante="secundario" icone="fa-solid fa-list-check" ?carregando=${this.criandoTarefa} @click=${() => this.virarTarefa()}>Virar tarefa</urbi-botao>`
            : ''}
        </urbi-linha>
        ${this.resumo
          ? html`<urbi-prosa papel="dica">${this.resumo}</urbi-prosa>
              <urbi-prosa papel="fraco">Resumo feito pela IA agora, a partir do histórico; não fica gravado.</urbi-prosa>`
          : ''}
        ${this.sugestao && a
          ? html`<urbi-prosa pre>${this.sugestao.mensagem}</urbi-prosa>
              <urbi-prosa papel="fraco">${this.sugestao.ia ? 'Escrita pela IA a partir do playbook e do histórico: revise antes de enviar.' : 'Texto do playbook (a IA da mensagem sugerida não está liberada).'}</urbi-prosa>
              <urbi-linha quebrar>
                <urbi-botao pequeno icone=${temTelefone ? 'fa-brands fa-whatsapp' : 'fa-solid fa-copy'} @click=${() => this.fazerAgora()}>${temTelefone ? 'Fazer agora' : 'Copiar texto'}</urbi-botao>
                ${temTelefone ? html`<urbi-botao pequeno variante="texto" @click=${() => this.copiar(this.sugestao!.mensagem)}>Copiar</urbi-botao>` : ''}
                <urbi-botao pequeno variante="texto" @click=${() => (this.sugestao = null)}>Fechar</urbi-botao>
              </urbi-linha>`
          : ''}
      </urbi-card>
      <urbi-card titulo="Dados e próximo passo" icone="fa-solid fa-id-card">
        ${this.acao('Definir próximo passo', 'fa-solid fa-forward', () => this.proximoPasso())}
        <urbi-prosa papel="secundario">${c.proximo_passo ? `Próximo passo: ${c.proximo_passo} · ${dataHora(c.proximo_passo_em)}` : 'Nenhum próximo passo combinado.'}</urbi-prosa>
        <div slot="detalhe">
          <urbi-stack>
            <urbi-prosa>${[c.telefone, c.email].filter(Boolean).join(' · ') || 'sem telefone nem e-mail'}</urbi-prosa>
            <urbi-prosa papel="secundario">
              ${c.origem_campanha ? `Campanha: ${c.origem_campanha} · ` : ''}cadastrado em ${data(c.criado_em)}${c.temperatura_autor === 'corretor' ? ' · temperatura marcada por você' : ''}
            </urbi-prosa>
            ${c.observacoes ? html`<urbi-prosa papel="dica" pre>${c.observacoes}</urbi-prosa>` : ''}
            <urbi-linha quebrar>
              ${consentimento
                ? html`<urbi-prosa>Consentimento registrado em ${dataHora(consentimento.aceito_em)} (${consentimento.canal}).</urbi-prosa>
                    <urbi-botao variante="texto" pequeno @click=${() => this.consentimento(false)}>Revogar</urbi-botao>`
                : html`<urbi-prosa papel="dica">Sem consentimento: o atendimento automático só usa mensagens-modelo aprovadas.</urbi-prosa>
                    <urbi-botao variante="texto" pequeno @click=${() => this.consentimento(true)}>Registrar</urbi-botao>`}
            </urbi-linha>
          </urbi-stack>
        </div>
      </urbi-card>
      <urbi-card titulo="Negócios" icone="fa-solid fa-handshake">
        ${this.acao('Novo negócio', 'fa-solid fa-plus', () => this.novoNegocio())}
        <urbi-prosa papel="secundario">${negocios.length ? `${abertos.length} aberto(s) de ${negocios.length}` : 'Nenhum negócio. Abra um quando o cliente quiser comprar ou vender.'}</urbi-prosa>
        ${negocios.length
          ? html`<div slot="detalhe"><urbi-lista separador .itens=${negocios} .render_item=${(n: Linha) => html`<urbi-linha justificar="entre" quebrar>
                <urbi-prosa>${n.titulo} · ${reais(n.valor_estimado_c)}${n.imovel_codigo ? ` · ${n.imovel_codigo}` : ''}</urbi-prosa>
                <urbi-linha>
                  ${chip('etapa', n.etapa_nome ? { nome: n.etapa_nome, tipo: n.etapa_tipo } : null)}
                  <urbi-botao variante="texto" pequeno @click=${() => this.moverEtapa(n)}>Mudar etapa</urbi-botao>
                </urbi-linha>
              </urbi-linha>`}></urbi-lista></div>`
          : ''}
      </urbi-card>
      <pc-selecoes-cliente .contatoId=${c.id} .nome=${c.nome} @mudou=${() => this.carregar()}></pc-selecoes-cliente>
      <urbi-card titulo="Tudo que você mandou" icone="fa-solid fa-paper-plane">
        ${this.acao('Registrar envio', 'fa-solid fa-plus', () => void this.registrarEnvio())}
        <urbi-prosa papel="secundario">${this.envios.length ? `${this.envios.length} envio(s); o último em ${dataHora(this.envios[0].enviado_em)}` : 'Nada registrado. Anote os imóveis e arquivos que mandar: o histórico fica aqui.'}</urbi-prosa>
        ${this.envios.length
          ? html`<div slot="detalhe"><urbi-lista separador .itens=${this.envios} .render_item=${(e: Linha) => html`<urbi-prosa>${e.imovel_codigo ? `${e.imovel_codigo}${e.imovel_titulo ? ` · ${e.imovel_titulo}` : ''}` : (e.descricao ?? e.tipo)}</urbi-prosa>
                <urbi-prosa papel="fraco">${dataHora(e.enviado_em)} · ${e.canal}${e.cliques ? ` · ${e.cliques} clique(s)` : ''}</urbi-prosa>`}></urbi-lista></div>`
          : ''}
      </urbi-card>
      <urbi-card titulo="Agenda deste cliente" icone="fa-solid fa-calendar-day">
        ${this.acao('Agendar', 'fa-solid fa-plus', () => this.novaAtividade())}
        <urbi-prosa papel="secundario">${atividades.length ? (pendentes.length ? `${pendentes.length} pendente(s); a próxima em ${dataHora([...pendentes].sort((x, y) => String(x.quando).localeCompare(String(y.quando)))[0].quando)}` : 'Nada pendente.') : 'Nada agendado. Marque uma ligação, visita ou reunião.'}</urbi-prosa>
        ${atividades.length
          ? html`<div slot="detalhe"><urbi-lista separador .itens=${atividades} .render_item=${(x: Linha) => html`<urbi-linha justificar="entre" quebrar>
                <urbi-prosa>${ROTULO_TIPO_ATIVIDADE[x.tipo]}: ${x.titulo} · ${dataHora(x.quando)}${x.local ? ` · ${x.local}` : ''}${this.visitaDe(x)}</urbi-prosa>
                <urbi-linha>
                  ${this.ficha!.visitas.some((v: Linha) => v.atividade_id === x.id)
                    ? html`<urbi-botao variante="texto" pequeno @click=${() => this.retornoVisita(x)}>Retorno</urbi-botao>`
                    : ''}
                  ${x.status === 'pendente'
                    ? html`<urbi-botao variante="texto" pequeno @click=${() => this.concluir(x)}>Marcar feito</urbi-botao>`
                    : html`<urbi-badge>${STATUS_ATIVIDADE[x.status]}</urbi-badge>`}
                </urbi-linha>
              </urbi-linha>`}></urbi-lista></div>`
          : ''}
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
