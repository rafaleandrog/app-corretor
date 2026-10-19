import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { UrbiColunaTabela, UrbiVersoAPI } from '@urbiverso/sdk';

declare const urbiVerso: UrbiVersoAPI;

interface Convite {
  id: number;
  email: string;
  conta: string | null;
  status: 'emitido' | 'resgatado' | 'expirado' | 'invalidado' | 'revogado';
  vigente_ate: string;
  criado_em: string;
}

const STATUS: Record<Convite['status'], { cor: string; rotulo: string }> = {
  emitido: { cor: 'info', rotulo: 'Aguardando aceite' },
  resgatado: { cor: 'sucesso', rotulo: 'Aceito' },
  expirado: { cor: 'padrao', rotulo: 'Expirado' },
  invalidado: { cor: 'alerta', rotulo: 'Invalidado' },
  revogado: { cor: 'padrao', rotulo: 'Revogado' },
};

const data = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');

// Equipe da plataforma › Corretores: convida cada corretor para uma conta nova e acompanha os
// convites. Quem aceitou ainda precisa do papel `corretor` (Configurações › Usuários).
@customElement('pc-tela-corretores')
export class PcTelaCorretores extends LitElement {
  @state() private convites: Convite[] = [];
  @state() private total = 0;
  @state() private pagina = 1;
  @state() private carregando = true;
  @state() private buscandoMais = false;
  @state() private falha: string | null = null;
  @state() private falhaMais: string | null = null;
  // Cada carregamento recebe um número; resposta de um carregamento anterior é descartada.
  private geracao = 0;

  connectedCallback() {
    super.connectedCallback();
    void this.carregar();
  }

  /** Recarrega a lista do zero; invalida qualquer "Mostrar mais" em voo. */
  private async carregar() {
    const geracao = ++this.geracao;
    this.carregando = true;
    this.buscandoMais = false;
    this.falha = null;
    this.falhaMais = null;
    try {
      const r = await urbiVerso.api('/equipe/convites?pagina=1');
      if (geracao !== this.geracao) return;
      this.convites = r.convites;
      this.total = r.total;
      this.pagina = 1;
    } catch (e) {
      if (geracao === this.geracao) this.falha = (e as Error).message;
    } finally {
      if (geracao === this.geracao) this.carregando = false;
    }
  }

  /** Anexa a próxima página de 50. Um por vez; a falha não apaga o que já está na tela. */
  private async mostrarMais() {
    if (this.buscandoMais || this.carregando) return;
    const geracao = this.geracao;
    const pagina = this.pagina + 1;
    this.buscandoMais = true;
    this.falhaMais = null;
    try {
      const r = await urbiVerso.api(`/equipe/convites?pagina=${pagina}`);
      if (geracao !== this.geracao) return;
      this.convites = [...this.convites, ...r.convites];
      this.total = r.total;
      this.pagina = pagina;
    } catch (e) {
      if (geracao === this.geracao) this.falhaMais = (e as Error).message;
    } finally {
      if (geracao === this.geracao) this.buscandoMais = false;
    }
  }

  private async convidar() {
    const valores = await urbiVerso.formulario<{ email: string; conta: string }>({
      titulo: 'Convidar corretor',
      mensagem: 'O corretor recebe um e-mail para criar a senha. A conta dele nasce quando ele aceitar.',
      rotuloConfirmar: 'Enviar convite',
      campos: [
        { nome: 'email', tipo: 'texto', rotulo: 'E-mail do corretor', obrigatorio: true, placeholder: 'nome@exemplo.com' },
        { nome: 'conta', tipo: 'texto', rotulo: 'Nome da conta', obrigatorio: true, placeholder: 'Ex.: Marina Souza Imóveis' },
      ],
    });
    if (!valores) return;
    try {
      const r = await urbiVerso.api('/equipe/convites', { method: 'POST', body: JSON.stringify(valores), headers: { 'Content-Type': 'application/json' } });
      if (r?.aviso) await urbiVerso.alertar({ titulo: 'Convite criado', mensagem: r.aviso, tipo: 'alerta' });
      else urbiVerso.notificar('Convite enviado.', 'sucesso');
      await this.carregar();
    } catch (e) {
      const falha = e as Error & { detalhes?: string[] };
      await urbiVerso.alertar({ titulo: 'Convite não enviado', mensagem: falha.detalhes?.join('\n') || falha.message });
    }
  }

  private async revogar(c: Convite) {
    const ok = await urbiVerso.confirmar({ titulo: 'Revogar convite', mensagem: `O link enviado para ${c.email} deixa de funcionar.`, rotuloConfirmar: 'Revogar' });
    if (!ok) return;
    try {
      await urbiVerso.api(`/equipe/convites/${c.id}/revogar`, { method: 'POST' });
      await this.carregar();
    } catch (e) {
      await urbiVerso.alertar({ titulo: 'Não foi possível revogar', mensagem: (e as Error).message });
    }
  }

  private colunas(): UrbiColunaTabela[] {
    return [
      { id: 'email', label: 'E-mail' },
      { id: 'conta', label: 'Conta', valor: (l) => (l as Convite).conta ?? '—' },
      {
        id: 'status',
        label: 'Situação',
        render: (l) => {
          const s = STATUS[(l as Convite).status];
          return html`<urbi-badge cor=${s.cor}>${s.rotulo}</urbi-badge>`;
        },
      },
      { id: 'criado_em', label: 'Enviado em', valor: (l) => data((l as Convite).criado_em) },
      {
        id: 'acao',
        label: '',
        semRotuloMobile: true,
        render: (l) =>
          (l as Convite).status === 'emitido'
            ? html`<urbi-botao variante="texto" pequeno @click=${() => this.revogar(l as Convite)}>Revogar</urbi-botao>`
            : html``,
      },
    ];
  }

  render() {
    const aceitos = this.convites.filter((c) => c.status === 'resgatado').length;
    const faltam = this.total - this.convites.length;
    return html`<urbi-stack>
      <urbi-linha justificar="entre" quebrar>
        <urbi-prosa papel="secundario">Cada corretor convidado ganha uma conta própria: ninguém vê os dados de outro.</urbi-prosa>
        <urbi-botao icone="fa-solid fa-user-plus" @click=${() => this.convidar()}>Convidar corretor</urbi-botao>
      </urbi-linha>
      ${aceitos
        ? html`<urbi-banner variante="alerta">
            Entre os convites listados, ${aceitos === 1 ? '1 foi aceito' : `${aceitos} foram aceitos`}. Confira se cada corretor já tem o papel
            "corretor" em Configurações › Usuários; sem ele o app fica fechado para o corretor.
          </urbi-banner>`
        : ''}
      ${this.falha
        ? html`<urbi-banner variante="erro">
            ${this.falha}
            <urbi-botao slot="acao" pequeno variante="secundario" @click=${() => this.carregar()}>Tentar de novo</urbi-botao>
          </urbi-banner>`
        : html`<urbi-tabela responsivo="multiline" .colunas=${this.colunas()} .linhas=${this.convites} ?carregando=${this.carregando}
            mensagem-vazio="Nenhum convite enviado ainda. Use “Convidar corretor”."></urbi-tabela>
          ${this.falhaMais
            ? html`<urbi-banner variante="erro">
                Não foi possível trazer mais convites: ${this.falhaMais}
                <urbi-botao slot="acao" pequeno variante="secundario" @click=${() => this.mostrarMais()}>Tentar de novo</urbi-botao>
              </urbi-banner>`
            : faltam > 0
              ? html`<urbi-botao variante="secundario" bloco ?carregando=${this.buscandoMais} @click=${() => this.mostrarMais()}>
                  Mostrar mais (${faltam} restantes)
                </urbi-botao>`
              : ''}`}
    </urbi-stack>`;
  }
}
