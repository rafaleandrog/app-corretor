import { html, nothing, type TemplateResult } from 'lit';
import type { UrbiVersoAPI } from '@urbiverso/sdk';

declare const urbiVerso: UrbiVersoAPI;

// Os 7 estados obrigatórios de toda tela do corretor (spec 11.0.4), num lugar só para nenhuma tela
// desenhar o seu: `urbi-loading`, `urbi-estado-vazio` e `urbi-banner`. Os de tela inteira (carregando,
// vazio, erro, não encontrado) vão no lugar do conteúdo; os de faixa (integração desconectada, crédito
// esgotado, IA indisponível) vão no topo do centro, e o resto da tela continua funcionando.

export const ESTADOS = ['carregando', 'vazio', 'erro', 'sem_permissao', 'desconectada', 'sem_credito', 'ia_indisponivel'] as const;
export type EstadoTela = (typeof ESTADOS)[number];

/** Dica dos botões de IA desabilitados quando o slot não está liberado (11.0.4). */
export const DICA_IA_INDISPONIVEL = 'IA indisponível agora';

export interface OpcoesEstado {
  /** Frase principal; cada estado tem a sua padrão. */
  mensagem?: string;
  /** Segunda linha do vazio e do não encontrado. */
  submensagem?: string;
  icone?: string;
  /** A ação que resolve: no vazio ("Cadastrar o primeiro imóvel"). */
  acao?: { rotulo: string; icone?: string; aoEscolher: () => void };
  /** Erro: "Tentar de novo" chama isto. */
  aoTentar?: () => void;
  /** Integração desconectada: o nome dela ("Instagram"). */
  integracao?: string;
}

/** "Reconectar" leva a Ajustes › Conexões (P12); o apelido abre a aba certa. */
const reconectar = () => urbiVerso.navegarSub('/ajustes/conexoes');

export function estadoTela(tipo: EstadoTela, op: OpcoesEstado = {}): TemplateResult {
  switch (tipo) {
    case 'carregando':
      // Nunca tela branca: o spinner ocupa o lugar do conteúdo até os dados chegarem.
      return html`<urbi-loading mensagem=${op.mensagem ?? 'Carregando…'}></urbi-loading>`;
    case 'vazio':
      return html`<urbi-stack>
        <urbi-estado-vazio icone=${op.icone ?? 'fa-regular fa-folder-open'} mensagem=${op.mensagem ?? 'Nada por aqui ainda'}
          submensagem=${op.submensagem ?? nothing}></urbi-estado-vazio>
        ${op.acao
          ? html`<urbi-linha justificar="centro"><urbi-botao icone=${op.acao.icone ?? nothing} @click=${op.acao.aoEscolher}>${op.acao.rotulo}</urbi-botao></urbi-linha>`
          : nothing}
      </urbi-stack>`;
    case 'erro':
      // Frase curta para o corretor; o erro técnico fica no console do navegador, não na tela.
      return html`<urbi-banner variante="erro">
        ${op.mensagem ?? 'Não foi possível carregar agora.'}
        ${op.aoTentar ? html`<urbi-botao slot="acao" pequeno variante="secundario" @click=${op.aoTentar}>Tentar de novo</urbi-botao>` : nothing}
      </urbi-banner>`;
    case 'sem_permissao':
      // Sem permissão e de outra conta são a mesma coisa para quem vê: "Não encontrado" (D-40).
      return html`<urbi-estado-vazio expandir icone=${op.icone ?? 'fa-solid fa-magnifying-glass'} mensagem=${op.mensagem ?? 'Não encontrado'}
        submensagem=${op.submensagem ?? 'Isto não existe ou não está na sua conta.'}></urbi-estado-vazio>`;
    case 'desconectada':
      return html`<urbi-banner variante="alerta">
        ${op.mensagem ?? `Seu ${op.integracao ?? 'Instagram'} desconectou.`}
        <urbi-botao slot="acao" pequeno variante="secundario" @click=${reconectar}>Reconectar</urbi-botao>
      </urbi-banner>`;
    case 'sem_credito':
      // Pronto para o Mensageiro e o Negociador (D-87); nenhuma tela gasta crédito ainda.
      return html`<urbi-banner variante="alerta">
        ${op.mensagem ?? 'Créditos do mês acabaram. O Mensageiro e o Negociador passaram a pedir sua aprovação.'}
      </urbi-banner>`;
    case 'ia_indisponivel':
      return html`<urbi-banner variante="info" icone="fa-solid fa-wand-magic-sparkles">
        ${op.mensagem ?? `${DICA_IA_INDISPONIVEL}. O resto da tela funciona normalmente.`}
      </urbi-banner>`;
  }
}

/**
 * Estado de tela inteira para uma falha de carga: 404 e 403 viram "Não encontrado" (D-40), o resto
 * vira o erro com "Tentar de novo". O detalhe técnico vai para o console.
 */
export function estadoDaFalha(falha: unknown, aoTentar: () => void): TemplateResult {
  const status = (falha as { status?: number } | null)?.status;
  if (status === 404 || status === 403) return estadoTela('sem_permissao');
  console.error('[portal_corretor]', falha);
  return estadoTela('erro', { aoTentar });
}
