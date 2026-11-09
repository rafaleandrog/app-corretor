import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { UrbiColunaTabela, UrbiVersoAPI } from '@urbiverso/sdk';
import { chamarApi, ehContaTrocada, formularioQueSalva, gesto, mensagemDeErro } from '../apoio.js';

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

/** Frase do estado vazio de quem não tem o papel `operacao` (#173; o mesmo texto em docs/convidar-corretores.md). */
export const SEM_PAPEL_DE_EQUIPE =
  'Convidar corretores é tarefa da equipe da plataforma. Peça a quem administra a plataforma para atribuir a você o papel Equipe (operacao) deste app em Configurações › Usuários, seção Equipe, e abra esta tela de novo.';

/** A plataforma recusou por falta do papel `operacao` (o código chega no erro de `urbiVerso.api`). */
export const semPapelDeEquipe = (e: unknown) => (e as { codigo?: string } | null)?.codigo === 'PROVISIONA_SEM_PAPEL';

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
  /**
   * Quem abriu a tela não tem o papel `operacao` (o admin do app sem ele, #173): a plataforma recusa a
   * lista e o convite com `PROVISIONA_SEM_PAPEL`. A tela explica e esconde "Convidar corretor".
   */
  @state() private semPapelDeEquipe = false;
  // Cada carregamento recebe um número; resposta de um carregamento anterior é descartada.
  private geracao = 0;
  /**
   * A conta em que a tela nasceu (a troca de conta a recria). Toda continuação passa por `vida.esperar`:
   * trocada a conta com o diálogo aberto ou o envio em voo, nada sai com o `X-Conta` da nova, nem há
   * estado, aviso ou alerta.
   */
  private readonly vida = gesto();

  /** Um gesto com diálogo ou cadeia de awaits: conta trocada no meio termina em silêncio. */
  private async semAvisoDeOutraConta(fn: () => Promise<unknown>) {
    try {
      if (this.vida.vivo()) await fn();
    } catch (e) {
      if (!this.vida.encerrado(e)) throw e;
    }
  }

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
      const r = await this.vida.esperar(chamarApi('/equipe/convites?pagina=1'));
      if (geracao !== this.geracao) return;
      this.convites = r.convites;
      this.total = r.total;
      this.pagina = 1;
    } catch (e) {
      if (this.vida.encerrado(e)) return;
      if (geracao !== this.geracao) return;
      if (semPapelDeEquipe(e)) this.semPapelDeEquipe = true;
      else this.falha = mensagemDeErro(e);
    } finally {
      if (geracao === this.geracao) this.carregando = false;
    }
  }

  /** Anexa a próxima página de 50. Um por vez; a falha não apaga o que já está na tela. */
  private async mostrarMais() {
    if (this.buscandoMais || this.carregando || !this.vida.vivo()) return;
    const geracao = this.geracao;
    const pagina = this.pagina + 1;
    this.buscandoMais = true;
    this.falhaMais = null;
    try {
      const r = await this.vida.esperar(chamarApi(`/equipe/convites?pagina=${pagina}`));
      if (geracao !== this.geracao) return;
      this.convites = [...this.convites, ...r.convites];
      this.total = r.total;
      this.pagina = pagina;
    } catch (e) {
      if (this.vida.encerrado(e)) return;
      if (geracao === this.geracao) this.falhaMais = mensagemDeErro(e);
    } finally {
      if (geracao === this.geracao) this.buscandoMais = false;
    }
  }

  private convidar() {
    return this.semAvisoDeOutraConta(async () => {
      // Recusado (#187): o formulário reabre com o e-mail e o nome da conta, e a frase do erro. Sem o papel de
      // equipe, convidar não tem como dar certo: a tela mostra o aviso fixo e o formulário não volta.
      let semPapel = false;
      const r = await formularioQueSalva({
        titulo: 'Convidar corretor',
        mensagem: 'O corretor recebe um e-mail para criar a senha. A conta dele nasce quando ele aceitar.',
        rotuloConfirmar: 'Enviar convite',
        campos: [
          { nome: 'email', tipo: 'texto', rotulo: 'E-mail do corretor', obrigatorio: true, placeholder: 'nome@exemplo.com' },
          { nome: 'conta', tipo: 'texto', rotulo: 'Nome da conta', obrigatorio: true, placeholder: 'Ex.: Marina Souza Imóveis' },
        ],
        gesto: this.vida,
        aviso: null,
        salvar: async (valores) => {
          try {
            return await chamarApi('/equipe/convites', { method: 'POST', body: JSON.stringify(valores), headers: { 'Content-Type': 'application/json' } });
          } catch (e) {
            if (ehContaTrocada(e) || !semPapelDeEquipe(e)) throw e;
            semPapel = true;
            return null;
          }
        },
      });
      if (!this.vida.vivo()) return;
      if (semPapel) {
        this.semPapelDeEquipe = true;
        return;
      }
      if (!r) return;
      if (r.aviso) await this.vida.esperar(urbiVerso.alertar({ titulo: 'Convite criado', mensagem: r.aviso, tipo: 'alerta' }));
      else urbiVerso.notificar('Convite enviado.', 'sucesso');
      await this.carregar();
    });
  }

  private revogar(c: Convite) {
    return this.semAvisoDeOutraConta(async () => {
      const ok = await this.vida.esperar(urbiVerso.confirmar({ titulo: 'Revogar convite', mensagem: `O link enviado para ${c.email} deixa de funcionar.`, rotuloConfirmar: 'Revogar' }));
      if (!ok) return;
      try {
        await this.vida.esperar(chamarApi(`/equipe/convites/${c.id}/revogar`, { method: 'POST' }));
        await this.carregar();
      } catch (e) {
        if (this.vida.encerrado(e)) throw e;
        await urbiVerso.alertar({ titulo: 'Não foi possível revogar', mensagem: mensagemDeErro(e) });
      }
    });
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
            ? html`<urbi-botao variante="texto" @click=${() => this.revogar(l as Convite)}>Revogar</urbi-botao>`
            : html``,
      },
    ];
  }

  render() {
    if (this.semPapelDeEquipe) {
      return html`<urbi-stack>
        <urbi-estado-vazio icone="fa-solid fa-user-lock" mensagem="Para convidar corretores, falta o papel Equipe"
          submensagem=${SEM_PAPEL_DE_EQUIPE}></urbi-estado-vazio>
      </urbi-stack>`;
    }
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
            <urbi-botao slot="acao" variante="secundario" @click=${() => this.carregar()}>Tentar de novo</urbi-botao>
          </urbi-banner>`
        : html`<urbi-tabela responsivo="multiline" .colunas=${this.colunas()} .linhas=${this.convites} ?carregando=${this.carregando}
            mensagem-vazio="Nenhum convite enviado ainda. Use “Convidar corretor”."></urbi-tabela>
          ${this.falhaMais
            ? html`<urbi-banner variante="erro">
                Não foi possível trazer mais convites: ${this.falhaMais}
                <urbi-botao slot="acao" variante="secundario" @click=${() => this.mostrarMais()}>Tentar de novo</urbi-botao>
              </urbi-banner>`
            : faltam > 0
              ? html`<urbi-botao variante="secundario" bloco ?carregando=${this.buscandoMais} @click=${() => this.mostrarMais()}>
                  Mostrar mais (${faltam} restantes)
                </urbi-botao>`
              : ''}`}
    </urbi-stack>`;
  }
}
