import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { keyed } from 'lit/directives/keyed.js';
import type { UrbiVersoAPI } from '@urbiverso/sdk';
import './telas/inicio.js';
import './telas/conta.js';
import './telas/corretores.js';
import './telas/clientes.js';
import './telas/ficha-contato.js';
import './telas/agenda.js';
import './telas/funil-ajustes.js';
import './telas/importar.js';
import './telas/imoveis.js';
import './telas/ficha-imovel.js';
import './telas/empreendimentos.js';
import './telas/ficha-empreendimento.js';
import './telas/funil.js';
import './telas/desempenho.js';
import './telas/pagina.js';
import './telas/estudio.js';
import './telas/conexoes.js';
import { lembrarTela } from './telas/assistente.js';
import './publico/pagina-publica.js';
import './publico/link.js';
import './publico/selecao.js';

declare const urbiVerso: UrbiVersoAPI;

interface Tela {
  titulo: string;
  papel: 'corretor' | 'operacao';
  render: (param?: string) => unknown;
}

// Uma entrada por rota. A tela só abre para quem tem o papel; o backend barra de novo.
const TELAS: Record<string, Tela> = {
  '/': { titulo: 'Início', papel: 'corretor', render: () => html`<pc-tela-inicio></pc-tela-inicio>` },
  '/funil': { titulo: 'Funil', papel: 'corretor', render: () => html`<pc-tela-funil></pc-tela-funil>` },
  '/clientes': { titulo: 'Clientes', papel: 'corretor', render: () => html`<pc-tela-clientes></pc-tela-clientes>` },
  '/clientes/importar': { titulo: 'Importar contatos', papel: 'corretor', render: () => html`<pc-tela-importar></pc-tela-importar>` },
  '/clientes/:id': { titulo: 'Cliente', papel: 'corretor', render: (id) => html`<pc-tela-ficha-contato .contatoId=${Number(id)}></pc-tela-ficha-contato>` },
  '/imoveis': { titulo: 'Minha carteira', papel: 'corretor', render: () => html`<pc-tela-imoveis></pc-tela-imoveis>` },
  '/imoveis/:id': { titulo: 'Imóvel', papel: 'corretor', render: (id) => html`<pc-tela-ficha-imovel .imovelId=${Number(id)}></pc-tela-ficha-imovel>` },
  '/empreendimentos': { titulo: 'Empreendimentos', papel: 'corretor', render: () => html`<pc-tela-empreendimentos></pc-tela-empreendimentos>` },
  '/empreendimentos/:id': {
    titulo: 'Empreendimento',
    papel: 'corretor',
    render: (id) => html`<pc-tela-ficha-empreendimento .empreendimentoId=${Number(id)}></pc-tela-ficha-empreendimento>`,
  },
  '/desempenho': { titulo: 'Desempenho', papel: 'corretor', render: () => html`<pc-tela-desempenho></pc-tela-desempenho>` },
  '/pagina': { titulo: 'Minha página', papel: 'corretor', render: () => html`<pc-tela-pagina></pc-tela-pagina>` },
  '/estudio': { titulo: 'Estúdio', papel: 'corretor', render: () => html`<pc-tela-estudio></pc-tela-estudio>` },
  '/assistente': { titulo: 'Assistente', papel: 'corretor', render: () => html`<pc-tela-assistente expandir></pc-tela-assistente>` },
  '/agenda': { titulo: 'Agenda', papel: 'corretor', render: () => html`<pc-tela-agenda></pc-tela-agenda>` },
  '/conta': { titulo: 'Conta e marca', papel: 'corretor', render: () => html`<pc-tela-conta></pc-tela-conta>` },
  '/ajustes/conexoes': { titulo: 'Conexões', papel: 'corretor', render: () => html`<pc-tela-conexoes></pc-tela-conexoes>` },
  '/ajustes/funil': { titulo: 'Funil e abordagens', papel: 'corretor', render: () => html`<pc-tela-funil-ajustes></pc-tela-funil-ajustes>` },
  '/corretores': { titulo: 'Corretores', papel: 'operacao', render: () => html`<pc-tela-corretores></pc-tela-corretores>` },
};

/** Rota exata primeiro; depois as de parâmetro numérico (`/clientes/:id`, `/imoveis/:id`…). */
function resolver(sub: string): { tela?: Tela; param?: string } {
  if (TELAS[sub]) return { tela: TELAS[sub] };
  const m = sub.match(/^\/(clientes|imoveis|empreendimentos)\/(\d+)$/);
  return m ? { tela: TELAS[`/${m[1]}/:id`], param: m[2] } : {};
}

/** `/conta/` e `/conta` são a mesma tela; a raiz continua `/`. */
const normalizar = (sub: string) => (sub.length > 1 ? sub.replace(/\/+$/, '') : sub) || '/';

// Tag fixa pela plataforma: `app-` + appId com hífens.
@customElement('app-portal-corretor')
export class AppPortalCorretor extends LitElement {
  @state() private sub = normalizar(urbiVerso.subRota());
  @state() private carregado = false;
  @state() private papeis: string[] = [];
  private cancelarRota?: () => void;
  // Contexto chega assíncrono: até `carregado`, roles vazias são falta de resposta, não de acesso.
  private aoMudarContexto = () => {
    const ctx = urbiVerso.contexto();
    this.carregado = ctx.carregado ?? false;
    this.papeis = ctx.roles ?? [];
  };

  // Réplica local do contrato `:host` de tela raiz (ui.md § Cadeia de altura). App plugável não
  // importa `estiloPagina` de @urbiverso/ui; layout, respiro e tipografia ficam nos primitivos.
  static styles = css`
    :host { display: flex; flex-direction: column; height: 100%; min-height: 0; overflow: hidden; }
  `;

  connectedCallback() {
    super.connectedCallback();
    lembrarTela(this.sub);
    this.cancelarRota = urbiVerso.escutarRota((sub) => {
      this.sub = normalizar(sub);
      // O Assistente responde pela tela em que o corretor estava antes de abri-lo.
      lembrarTela(this.sub);
    });
    this.aoMudarContexto();
    window.addEventListener('urbi:contexto-app', this.aoMudarContexto);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.cancelarRota?.();
    window.removeEventListener('urbi:contexto-app', this.aoMudarContexto);
  }

  private conteudo(tela: Tela | undefined, param?: string) {
    if (!this.carregado) return html`<urbi-loading></urbi-loading>`;
    if (!tela) {
      // O endereço recebido fica visível de propósito: é o diagnóstico do retorno de redirecionamento
      // (P-36, roteiro R.6). A query não volta por subRota() (overview.md).
      return html`<urbi-estado-vazio expandir icone="fa-solid fa-compass" mensagem="Página não encontrada"
        submensagem="Endereço recebido: ${this.sub}${window.location.search}. Use o menu do app para escolher uma tela."></urbi-estado-vazio>`;
    }
    if (!this.papeis.includes(tela.papel)) {
      const quem = tela.papel === 'corretor' ? 'corretor' : 'equipe da plataforma (operacao)';
      return html`<urbi-estado-vazio expandir icone="fa-solid fa-lock" mensagem="Esta área não está liberada para você"
        submensagem="Ela é do papel ${quem}. Peça ao administrador do app para atribuir o papel em Configurações › Usuários."></urbi-estado-vazio>`;
    }
    // `keyed` pelo endereço: trocar de cliente recria a tela em vez de reaproveitar o estado.
    return keyed(this.sub, tela.render(param));
  }

  render() {
    // A equipe da plataforma não tem carteira: no Início ela cai direto na lista de corretores.
    const soEquipe = !this.papeis.includes('corretor') && this.papeis.includes('operacao');
    const { tela, param } = this.sub === '/' && soEquipe ? { tela: TELAS['/corretores'], param: undefined } : resolver(this.sub);
    return html`<urbi-shell-page titulo=${tela?.titulo ?? 'Portal do Corretor'}>${this.conteudo(tela, param)}</urbi-shell-page>`;
  }
}
