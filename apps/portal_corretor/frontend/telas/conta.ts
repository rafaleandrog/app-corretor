import { LitElement, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { CampoFormulario, UrbiVersoAPI } from '@urbiverso/sdk';
import { avisoCreci, chamarApi } from '../apoio.js';

declare const urbiVerso: UrbiVersoAPI;

interface DadosConta {
  perfil: { nome: string; tipo: string; documento: string | null; creci_juridico: string | null } | null;
  configuracoes: {
    prazo_primeiro_atendimento_min: number;
    dias_cliente_parado: number;
    validade_selecao_dias: number;
    lembrete_visita_horas: number;
  };
  meu_perfil: { creci: string | null; telefone: string | null };
}

const TIPOS = [
  { valor: 'corretor_autonomo', rotulo: 'Corretor autônomo' },
  { valor: 'imobiliaria', rotulo: 'Imobiliária' },
  { valor: 'incorporadora', rotulo: 'Incorporadora' },
];
const nada = 'não informado';

// Ajustes › Conta (seus dados e a conta) e Ajustes › Atendimento: o mesmo `GET /conta`, cada aba
// mostra a sua parte.
@customElement('pc-tela-conta')
export class PcTelaConta extends LitElement {
  @property() parte: 'conta' | 'atendimento' = 'conta';
  @state() private dados: DadosConta | null = null;
  @state() private falha: string | null = null;

  connectedCallback() {
    super.connectedCallback();
    void this.carregar();
  }

  private async carregar() {
    this.falha = null;
    try {
      this.dados = await chamarApi('/conta');
    } catch (e) {
      this.falha = (e as Error).message;
    }
  }

  // Abre o formulário, grava e recarrega. Erro de validação volta com a lista em `detalhes`.
  // `fixos` vão junto sem aparecer no formulário (campo que saiu da tela mas continua no dado).
  private async editar(titulo: string, rota: string, campos: CampoFormulario[], fixos: Record<string, unknown> = {}) {
    const valores = await urbiVerso.formulario({ titulo, campos });
    if (!valores) return;
    try {
      const r = await chamarApi(rota, { method: 'PUT', body: JSON.stringify({ ...fixos, ...valores }), headers: { 'Content-Type': 'application/json' } });
      // Salvo com aviso (CRECI fora do formato usual, D-93): avisa sem desfazer nada.
      const avisos: string[] = Array.isArray(r?.avisos) ? r.avisos : [];
      urbiVerso.notificar(avisos.length ? `Salvo. ${avisos.join(' ')}` : 'Salvo.', avisos.length ? 'info' : 'sucesso');
      await this.carregar();
    } catch (e) {
      const falha = e as Error & { detalhes?: string[] };
      await urbiVerso.alertar({ titulo: 'Não foi possível salvar', mensagem: falha.detalhes?.join('\n') || falha.message });
    }
  }

  private editarMeuPerfil() {
    const p = this.dados!.meu_perfil;
    void this.editar('Seus dados', '/conta/meu-perfil', [
      { nome: 'creci', tipo: 'texto', rotulo: 'CRECI (opcional)', valor: p.creci ?? '', placeholder: 'DF-12345-F' },
      { nome: 'telefone', tipo: 'texto', rotulo: 'Telefone (WhatsApp)', valor: p.telefone ?? '', placeholder: '(61) 99999-9999' },
    ]);
  }

  private editarPerfil() {
    const p = this.dados!.perfil;
    void this.editar('Conta', '/conta/perfil', [
      { nome: 'nome', tipo: 'texto', rotulo: 'Nome da conta', obrigatorio: true, valor: p?.nome ?? '' },
      { nome: 'tipo', tipo: 'selecao', rotulo: 'Tipo', opcoes: TIPOS, valor: p?.tipo ?? 'corretor_autonomo' },
      { nome: 'documento', tipo: 'texto', rotulo: 'CPF ou CNPJ (opcional)', valor: p?.documento ?? '' },
      { nome: 'creci_juridico', tipo: 'texto', rotulo: 'CRECI jurídico (imobiliária, opcional)', valor: p?.creci_juridico ?? '' },
    ]);
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
    return html`<span slot="acoes"><urbi-botao variante="fantasma" pequeno icone="fa-solid fa-pen" ariaLabel=${rotulo} title=${rotulo} @click=${acao}></urbi-botao></span>`;
  }

  render() {
    if (this.falha) {
      return html`<urbi-banner variante="erro">
        ${this.falha}
        <urbi-botao slot="acao" pequeno variante="secundario" @click=${() => this.carregar()}>Tentar de novo</urbi-botao>
      </urbi-banner>`;
    }
    if (!this.dados) return html`<urbi-loading></urbi-loading>`;
    const { perfil, configuracoes: c, meu_perfil: eu } = this.dados;
    if (this.parte === 'atendimento') {
      return html`<urbi-card titulo="Atendimento" icone="fa-solid fa-clock">
        ${this.botaoEditar('Editar o atendimento', () => this.editarConfiguracoes())}
        <urbi-prosa papel="secundario">
          Cliente parado após ${c.dias_cliente_parado} dias · seleção vale ${c.validade_selecao_dias} dias ·
          ${c.lembrete_visita_horas ? `lembrete ${c.lembrete_visita_horas} h antes de cada visita` : 'sem lembrete de visita'}
        </urbi-prosa>
      </urbi-card>`;
    }
    const tipo = TIPOS.find((t) => t.valor === perfil?.tipo)?.rotulo ?? nada;
    return html`<urbi-stack>
      <urbi-card titulo="Seus dados" icone="fa-solid fa-id-badge">
        ${this.botaoEditar('Editar seus dados', () => this.editarMeuPerfil())}
        <urbi-prosa>${urbiVerso.usuario()?.nome ?? ''}</urbi-prosa>
        <urbi-prosa papel="secundario">CRECI: ${eu.creci ?? nada} · Telefone: ${eu.telefone ?? nada}</urbi-prosa>
        ${eu.creci || perfil?.creci_juridico ? '' : avisoCreci()}
      </urbi-card>
      <urbi-card titulo="Conta" icone="fa-solid fa-building">
        ${this.botaoEditar('Editar a conta', () => this.editarPerfil())}
        ${perfil
          ? html`<urbi-prosa>${perfil.nome}</urbi-prosa>
              <urbi-prosa papel="secundario">${tipo} · Documento: ${perfil.documento ?? nada} · CRECI jurídico: ${perfil.creci_juridico ?? nada}</urbi-prosa>`
          : html`<urbi-prosa papel="dica">Dê um nome à sua conta: é o que aparece na sua página e para os seus clientes.</urbi-prosa>`}
      </urbi-card>
    </urbi-stack>`;
  }
}
