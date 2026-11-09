import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { CampoFormulario, UrbiVersoAPI } from '@urbiverso/sdk';
import { formatarTelefone } from '../../comum/crm';
import { validarMeuPerfil, validarPerfilConta } from '../../comum/conta';
import { chamarApi, enviar, formularioQueSalva, gesto, mensagemDeErro } from '../apoio.js';

declare const urbiVerso: UrbiVersoAPI;

interface DadosConta {
  perfil: { nome: string; tipo: string; documento: string | null; creci_juridico: string | null } | null;
  configuracoes: {
    prazo_primeiro_atendimento_min: number;
    dias_cliente_parado: number;
    validade_selecao_dias: number;
    lembrete_visita_horas: number;
  };
  meu_perfil: { creci: string | null; telefone: string | null; nome_profissional?: string | null; regioes?: string | null };
  /** #33: o admin do app numa conta que não é de demonstração não grava perfil de corretor. */
  admin_em_conta_real?: boolean;
}

/** O rascunho do formulário de Conta e marca › Seu perfil (P13), na tela, com Salvar. */
interface Rascunho {
  nome_profissional: string;
  creci: string;
  telefone: string;
  regioes: string;
  conta_nome: string;
  conta_tipo: string;
  documento: string;
  creci_juridico: string;
}

const TIPOS = [
  { valor: 'corretor_autonomo', rotulo: 'Corretor autônomo' },
  { valor: 'imobiliaria', rotulo: 'Imobiliária' },
  { valor: 'incorporadora', rotulo: 'Incorporadora' },
];
/** O formulário nasce dos dados gravados; telefone em (61) 99999-9999, como o corretor digita. */
function rascunhoDe(d: DadosConta): Rascunho {
  const eu = d.meu_perfil;
  return {
    nome_profissional: eu.nome_profissional ?? '',
    creci: eu.creci ?? '',
    telefone: eu.telefone ? formatarTelefone(eu.telefone) : '',
    regioes: eu.regioes ?? '',
    conta_nome: d.perfil?.nome ?? '',
    conta_tipo: d.perfil?.tipo ?? 'corretor_autonomo',
    documento: d.perfil?.documento ?? '',
    creci_juridico: d.perfil?.creci_juridico ?? '',
  };
}

// Ajustes › Conta e marca (Seu perfil e a conta, num formulário na tela com Salvar, P13; a marca é
// `pc-tela-marca`) e Ajustes › Horário de atendimento: o mesmo `GET /conta`, cada seção mostra a sua
// parte. O CRECI é opcional e sem estado de verificação (D-93): vazio, só a frase. O aviso do CRECI
// (C1) fica na direita.
@customElement('pc-tela-conta')
export class PcTelaConta extends LitElement {
  @property() parte: 'conta' | 'atendimento' = 'conta';
  @state() private dados: DadosConta | null = null;
  @state() private falha: string | null = null;
  @state() private rascunho: Rascunho | null = null;
  @state() private salvando = false;
  /** Erros da última tentativa de salvar, um por linha (a validação do backend em `detalhes`). */
  @state() private errosSalvar: string[] = [];
  /**
   * A conta em que a tela nasceu (a troca de conta a recria). Toda continuação passa por `vida.esperar`:
   * trocada a conta com o formulário aberto ou o PUT em voo, nada é gravado, avisado nem relido.
   */
  private readonly vida = gesto();

  connectedCallback() {
    super.connectedCallback();
    void this.carregar();
  }

  private async carregar() {
    this.falha = null;
    try {
      this.dados = await this.vida.esperar(chamarApi('/conta'));
      this.rascunho = rascunhoDe(this.dados!);
    } catch (e) {
      if (this.vida.encerrado(e)) return;
      this.falha = mensagemDeErro(e);
    }
  }

  // Abre o formulário, grava e recarrega. Erro de validação volta com a lista em `detalhes`.
  // `fixos` vão junto sem aparecer no formulário (campo que saiu da tela mas continua no dado).
  // Recusado (#187): o formulário reabre com o digitado e a frase do erro, até salvar ou cancelar.
  private async editar(titulo: string, rota: string, campos: CampoFormulario[], fixos: Record<string, unknown> = {}) {
    try {
      if (!this.vida.vivo()) return;
      const r = await formularioQueSalva({
        titulo,
        campos,
        gesto: this.vida,
        aviso: null,
        salvar: (valores) => chamarApi(rota, { method: 'PUT', body: JSON.stringify({ ...fixos, ...valores }), headers: { 'Content-Type': 'application/json' } }),
      });
      if (!r || !this.vida.vivo()) return;
      // Salvo com aviso (CRECI fora do formato usual, D-93): avisa sem desfazer nada.
      const avisos: string[] = Array.isArray(r?.avisos) ? r.avisos : [];
      urbiVerso.notificar(avisos.length ? `Salvo. ${avisos.join(' ')}` : 'Salvo.', avisos.length ? 'info' : 'sucesso');
      window.dispatchEvent(new CustomEvent('pc-conta-salva'));
      window.dispatchEvent(new CustomEvent('pc-ajustes-mudou'));
      await this.carregar();
    } catch (e) {
      if (this.vida.encerrado(e)) return;
      await urbiVerso.alertar({ titulo: 'Não foi possível salvar', mensagem: mensagemDeErro(e) });
    }
  }

  private mudar(campo: keyof Rascunho, valor: string) {
    if (this.rascunho) this.rascunho = { ...this.rascunho, [campo]: valor };
  }

  /**
   * Salvar (P13): grava o seu perfil (`PUT /conta/meu-perfil`) e, se mudou, a conta (`PUT /conta/perfil`).
   * Erro de validação fica na tela, com os campos como estavam.
   */
  private async salvar() {
    const r = this.rascunho;
    const d = this.dados;
    if (!r || !d || this.salvando || !this.vida.vivo()) return;
    this.salvando = true;
    this.errosSalvar = [];
    const avisos: string[] = [];
    let perfilSalvo = false;
    try {
      const p = d.perfil;
      const contaMudou = !p || p.nome !== r.conta_nome.trim() || p.tipo !== r.conta_tipo || (p.documento ?? '') !== r.documento.trim() || (p.creci_juridico ?? '') !== r.creci_juridico.trim();
      const gravaConta = contaMudou && !!(p || r.conta_nome.trim());
      const corpoEu = { creci: r.creci, telefone: r.telefone, nome_profissional: r.nome_profissional, regioes: r.regioes };
      const corpoConta = { nome: r.conta_nome, tipo: r.conta_tipo, documento: r.documento, creci_juridico: r.creci_juridico };
      // Valida as duas partes com os mesmos validadores do backend antes do primeiro PUT: nada é gravado
      // se qualquer parte já é sabidamente inválida.
      const erros: string[] = [];
      if (!d.admin_em_conta_real) {
        const v = validarMeuPerfil(corpoEu);
        if (!v.ok) erros.push(...v.erros);
      }
      if (gravaConta) {
        const v = validarPerfilConta(corpoConta);
        if (!v.ok) erros.push(...v.erros);
      }
      if (erros.length) {
        this.errosSalvar = erros;
        return;
      }
      if (!d.admin_em_conta_real) {
        const eu = await this.vida.esperar(enviar('PUT', '/conta/meu-perfil', corpoEu));
        perfilSalvo = true;
        if (Array.isArray(eu?.avisos)) avisos.push(...eu.avisos);
      }
      if (gravaConta) {
        await this.vida.esperar(enviar('PUT', '/conta/perfil', corpoConta));
      }
      // Salvo com aviso (CRECI fora do formato usual, D-93): avisa sem desfazer nada.
      urbiVerso.notificar(avisos.length ? `Salvo. ${avisos.join(' ')}` : 'Salvo.', avisos.length ? 'info' : 'sucesso');
      window.dispatchEvent(new CustomEvent('pc-conta-salva'));
      await this.carregar();
    } catch (e) {
      if (this.vida.encerrado(e)) return;
      const falha = e as { detalhes?: string[] };
      const erros = falha.detalhes?.length ? falha.detalhes : [mensagemDeErro(e)];
      if (perfilSalvo) {
        // O segundo PUT falhou depois de o primeiro gravar: diz qual parte foi salva e mantém os avisos.
        this.errosSalvar = ['O seu perfil foi salvo, mas os dados da conta não.', ...erros, ...avisos];
        window.dispatchEvent(new CustomEvent('pc-conta-salva'));
        await this.carregar();
        this.rascunho = r; // o que o corretor digitou continua na tela para ele corrigir a conta
      } else {
        this.errosSalvar = erros;
      }
    } finally {
      this.salvando = false;
    }
  }

  private editarConfiguracoes() {
    const c = this.dados!.configuracoes;
    // O prazo de primeiro atendimento volta à tela com o WhatsApp; até lá segue o valor gravado.
    void this.editar('Atendimento', '/conta/configuracoes', [
      { nome: 'dias_cliente_parado', tipo: 'numero', rotulo: 'Cliente parado depois de (dias)', obrigatorio: true, min: 1, max: 365, valor: c.dias_cliente_parado },
      { nome: 'validade_selecao_dias', tipo: 'numero', rotulo: 'Validade da seleção enviada (dias)', obrigatorio: true, min: 1, max: 365, valor: c.validade_selecao_dias },
      { nome: 'lembrete_visita_horas', tipo: 'numero', rotulo: 'Lembrete de visita (horas antes; 0 desliga)', obrigatorio: true, min: 0, max: 168, valor: c.lembrete_visita_horas },
    ], { prazo_primeiro_atendimento_min: c.prazo_primeiro_atendimento_min });
  }

  private botaoEditar(rotulo: string, acao: () => void) {
    return html`<span slot="acoes"><urbi-botao variante="fantasma" icone="fa-solid fa-pen" ariaLabel=${rotulo} title=${rotulo} @click=${acao}></urbi-botao></span>`;
  }

  render() {
    if (this.falha) {
      return html`<urbi-banner variante="erro">
        ${this.falha}
        <urbi-botao slot="acao" variante="secundario" @click=${() => this.carregar()}>Tentar de novo</urbi-botao>
      </urbi-banner>`;
    }
    if (!this.dados) return html`<urbi-loading></urbi-loading>`;
    const { perfil, configuracoes: c } = this.dados;
    if (this.parte === 'atendimento') {
      return html`<urbi-card titulo="Atendimento" icone="fa-solid fa-clock">
        ${this.botaoEditar('Editar o atendimento', () => this.editarConfiguracoes())}
        <urbi-prosa papel="secundario">
          Cliente parado após ${c.dias_cliente_parado} dias · seleção vale ${c.validade_selecao_dias} dias ·
          ${c.lembrete_visita_horas ? `lembrete ${c.lembrete_visita_horas} h antes de cada visita` : 'sem lembrete de visita'}
        </urbi-prosa>
      </urbi-card>`;
    }
    const r = this.rascunho ?? rascunhoDe(this.dados);
    const bloqueado = !!this.dados.admin_em_conta_real;
    const campo = (rotulo: string, chave: keyof Rascunho, extra: { placeholder?: string; tipo?: string; desabilitado?: boolean } = {}) =>
      html`<urbi-input label=${rotulo} tipo=${extra.tipo ?? 'text'} valor=${r[chave]} placeholder=${extra.placeholder ?? ''} ?desabilitado=${extra.desabilitado ?? false}
        @urbi:input-change=${(e: CustomEvent) => this.mudar(chave, String(e.detail.valor ?? ''))}></urbi-input>`;
    return html`<urbi-stack>
      <urbi-card titulo="Seu perfil" icone="fa-solid fa-id-badge">
        <urbi-stack>
          ${bloqueado
            ? html`<urbi-banner variante="info">Você está como administrador do app numa conta que não é de demonstração: o seu perfil de corretor não é gravado aqui. Para avaliar o app, use uma conta de demonstração (nome terminado em “(demo)”). Os dados da conta continuam editáveis.</urbi-banner>`
            : nothing}
          <urbi-grid min="220px">
            ${campo('Nome profissional', 'nome_profissional', { placeholder: urbiVerso.usuario()?.nome ?? 'Como os clientes te conhecem', desabilitado: bloqueado })}
            ${campo('CRECI (opcional)', 'creci', { placeholder: 'DF-12345-F', desabilitado: bloqueado })}
            ${campo('WhatsApp', 'telefone', { placeholder: '(61) 99999-9999', tipo: 'tel', desabilitado: bloqueado })}
            ${campo('Regiões que atende', 'regioes', { placeholder: 'Ex.: Lago Sul, Sudoeste, Jardim Botânico', desabilitado: bloqueado })}
          </urbi-grid>
          <urbi-prosa papel="dica">A foto do perfil fica em Sua marca, logo abaixo, e aparece na sua página, nas seleções e no portal do cliente.</urbi-prosa>
        </urbi-stack>
      </urbi-card>
      <urbi-card titulo="Conta" icone="fa-solid fa-building">
        <urbi-stack>
          <urbi-grid min="220px">
            ${campo('Nome da conta', 'conta_nome', { placeholder: 'Seu nome ou o da imobiliária' })}
            <urbi-select label="Tipo de conta" valor=${r.conta_tipo} .opcoes=${TIPOS} @urbi:select-change=${(e: CustomEvent) => this.mudar('conta_tipo', String(e.detail.valor))}></urbi-select>
            ${campo('CPF ou CNPJ (opcional)', 'documento')}
            ${campo('CRECI jurídico (imobiliária, opcional)', 'creci_juridico')}
          </urbi-grid>
          ${perfil ? nothing : html`<urbi-prosa papel="dica">Dê um nome à sua conta: é o que aparece na sua página e para os seus clientes.</urbi-prosa>`}
        </urbi-stack>
      </urbi-card>
      ${this.errosSalvar.length ? html`<urbi-banner variante="erro">Não foi possível salvar: ${this.errosSalvar.join(' ')}</urbi-banner>` : nothing}
      <urbi-linha justificar="fim">
        <urbi-botao icone="fa-solid fa-check" ?carregando=${this.salvando} @click=${() => void this.salvar()}>Salvar perfil e conta</urbi-botao>
      </urbi-linha>
    </urbi-stack>`;
  }
}
