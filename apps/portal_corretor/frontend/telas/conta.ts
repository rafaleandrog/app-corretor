import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { CampoFormulario, UrbiVersoAPI } from '@urbiverso/sdk';

declare const urbiVerso: UrbiVersoAPI;

interface DadosConta {
  perfil: { nome: string; tipo: string; documento: string | null; creci_juridico: string | null } | null;
  configuracoes: {
    prazo_primeiro_atendimento_min: number;
    dias_cliente_parado: number;
    validade_selecao_dias: number;
    modo_aprovacao_conteudo: string;
    janela_aprovacao_horas: number;
  };
  meu_perfil: { creci: string | null; telefone: string | null; creci_situacao: string };
}

const TIPOS = [
  { valor: 'corretor_autonomo', rotulo: 'Corretor autônomo' },
  { valor: 'imobiliaria', rotulo: 'Imobiliária' },
  { valor: 'incorporadora', rotulo: 'Incorporadora' },
];
const SITUACAO: Record<string, { cor: string; rotulo: string }> = {
  nao_verificado: { cor: 'alerta', rotulo: 'CRECI não verificado' },
  verificado: { cor: 'sucesso', rotulo: 'CRECI verificado' },
  irregular: { cor: 'erro', rotulo: 'CRECI irregular' },
};
const nada = 'não informado';

// Ajustes › Conta e marca: dados da conta, do corretor e as configurações de atendimento.
// A marca (logo, cores, foto) entra com o Estúdio, no bloco 8.
@customElement('pc-tela-conta')
export class PcTelaConta extends LitElement {
  @state() private dados: DadosConta | null = null;
  @state() private falha: string | null = null;

  connectedCallback() {
    super.connectedCallback();
    void this.carregar();
  }

  private async carregar() {
    this.falha = null;
    try {
      this.dados = await urbiVerso.api('/conta');
    } catch (e) {
      this.falha = (e as Error).message;
    }
  }

  // Abre o formulário, grava e recarrega. Erro de validação volta com a lista em `detalhes`.
  private async editar(titulo: string, rota: string, campos: CampoFormulario[]) {
    const valores = await urbiVerso.formulario({ titulo, campos });
    if (!valores) return;
    try {
      await urbiVerso.api(rota, { method: 'PUT', body: JSON.stringify(valores), headers: { 'Content-Type': 'application/json' } });
      urbiVerso.notificar('Salvo.', 'sucesso');
      await this.carregar();
    } catch (e) {
      const falha = e as Error & { detalhes?: string[] };
      await urbiVerso.alertar({ titulo: 'Não foi possível salvar', mensagem: falha.detalhes?.join('\n') || falha.message });
    }
  }

  private editarMeuPerfil() {
    const p = this.dados!.meu_perfil;
    void this.editar('Seus dados', '/conta/meu-perfil', [
      { nome: 'creci', tipo: 'texto', rotulo: 'CRECI', valor: p.creci ?? '', placeholder: 'DF-12345-F' },
      { nome: 'telefone', tipo: 'texto', rotulo: 'Telefone (WhatsApp)', valor: p.telefone ?? '', placeholder: '(61) 99999-9999' },
    ]);
  }

  private editarPerfil() {
    const p = this.dados!.perfil;
    void this.editar('Conta', '/conta/perfil', [
      { nome: 'nome', tipo: 'texto', rotulo: 'Nome da conta', obrigatorio: true, valor: p?.nome ?? '' },
      { nome: 'tipo', tipo: 'selecao', rotulo: 'Tipo', opcoes: TIPOS, valor: p?.tipo ?? 'corretor_autonomo' },
      { nome: 'documento', tipo: 'texto', rotulo: 'CPF ou CNPJ (opcional)', valor: p?.documento ?? '' },
      { nome: 'creci_juridico', tipo: 'texto', rotulo: 'CRECI jurídico (imobiliária)', valor: p?.creci_juridico ?? '' },
    ]);
  }

  private editarConfiguracoes() {
    const c = this.dados!.configuracoes;
    void this.editar('Atendimento', '/conta/configuracoes', [
      { nome: 'prazo_primeiro_atendimento_min', tipo: 'numero', rotulo: 'Prazo de primeiro atendimento (minutos)', obrigatorio: true, min: 1, max: 1440, valor: c.prazo_primeiro_atendimento_min },
      { nome: 'dias_cliente_parado', tipo: 'numero', rotulo: 'Cliente parado depois de (dias)', obrigatorio: true, min: 1, max: 365, valor: c.dias_cliente_parado },
      { nome: 'validade_selecao_dias', tipo: 'numero', rotulo: 'Validade da seleção enviada (dias)', obrigatorio: true, min: 1, max: 365, valor: c.validade_selecao_dias },
      { nome: 'modo_aprovacao_conteudo', tipo: 'selecao', rotulo: 'Aprovação de conteúdo', opcoes: [{ valor: 'manual', rotulo: 'Eu aprovo cada peça' }, { valor: 'janela', rotulo: 'Publica sozinho se eu não responder na janela' }], valor: c.modo_aprovacao_conteudo },
      { nome: 'janela_aprovacao_horas', tipo: 'numero', rotulo: 'Janela de aprovação (horas)', obrigatorio: true, min: 1, max: 168, valor: c.janela_aprovacao_horas },
    ]);
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
    const situacao = SITUACAO[eu.creci_situacao] ?? SITUACAO.nao_verificado;
    const tipo = TIPOS.find((t) => t.valor === perfil?.tipo)?.rotulo ?? nada;
    return html`<urbi-stack>
      <urbi-card titulo="Seus dados" icone="fa-solid fa-id-badge">
        ${this.botaoEditar('Editar seus dados', () => this.editarMeuPerfil())}
        <urbi-linha quebrar>
          <urbi-prosa>${urbiVerso.usuario()?.nome ?? ''}</urbi-prosa>
          <urbi-badge cor=${situacao.cor}>${situacao.rotulo}</urbi-badge>
        </urbi-linha>
        <urbi-prosa papel="secundario">CRECI: ${eu.creci ?? nada} · Telefone: ${eu.telefone ?? nada}</urbi-prosa>
      </urbi-card>
      <urbi-card titulo="Conta" icone="fa-solid fa-building">
        ${this.botaoEditar('Editar a conta', () => this.editarPerfil())}
        ${perfil
          ? html`<urbi-prosa>${perfil.nome}</urbi-prosa>
              <urbi-prosa papel="secundario">${tipo} · Documento: ${perfil.documento ?? nada} · CRECI jurídico: ${perfil.creci_juridico ?? nada}</urbi-prosa>`
          : html`<urbi-prosa papel="dica">Dê um nome à sua conta: é o que aparece na sua página e para os seus clientes.</urbi-prosa>`}
      </urbi-card>
      <urbi-card titulo="Atendimento" icone="fa-solid fa-clock">
        ${this.botaoEditar('Editar o atendimento', () => this.editarConfiguracoes())}
        <urbi-prosa papel="secundario">
          Primeiro atendimento em até ${c.prazo_primeiro_atendimento_min} min · cliente parado após ${c.dias_cliente_parado} dias ·
          seleção vale ${c.validade_selecao_dias} dias ·
          ${c.modo_aprovacao_conteudo === 'janela' ? `conteúdo publica sozinho após ${c.janela_aprovacao_horas} h sem resposta` : 'você aprova cada peça'}
        </urbi-prosa>
      </urbi-card>
    </urbi-stack>`;
  }
}
