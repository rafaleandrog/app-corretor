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
  /** Integração que nunca foi conectada nesta conta: o botão diz "Conectar", não "Reconectar" (#182, item 5). */
  nuncaConectou?: boolean;
}

/** "Conectar"/"Reconectar" leva a Ajustes › Conexões (P12); o apelido abre a aba certa. */
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
        ${op.aoTentar ? html`<urbi-botao slot="acao" variante="secundario" @click=${op.aoTentar}>Tentar de novo</urbi-botao>` : nothing}
      </urbi-banner>`;
    case 'sem_permissao':
      // Sem permissão e de outra conta são a mesma coisa para quem vê: "Não encontrado" (D-40).
      return html`<urbi-estado-vazio expandir icone=${op.icone ?? 'fa-solid fa-magnifying-glass'} mensagem=${op.mensagem ?? 'Não encontrado'}
        submensagem=${op.submensagem ?? 'Isto não existe ou não está na sua conta.'}></urbi-estado-vazio>`;
    case 'desconectada':
      return html`<urbi-banner variante="alerta">
        ${op.mensagem ?? (op.nuncaConectou ? `Seu ${op.integracao ?? 'Instagram'} ainda não está conectado.` : `Seu ${op.integracao ?? 'Instagram'} desconectou.`)}
        <urbi-botao slot="acao" variante="secundario" @click=${reconectar}>${op.nuncaConectou ? 'Conectar' : 'Reconectar'}</urbi-botao>
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

// ---------- Mensagens da plataforma → frases do app (#177) ----------
//
// O erro que `urbiVerso.api` lança traz `status`, `codigo`, `detalhes` e a `message` do corpo
// (apps-em-repo-proprio.md § ler o erro). Quando quem respondeu foi o backend do app (`erro()` em
// `backend/acesso.ts`), a frase é do app e vai à tela. Quando foi a plataforma (o shell antes da rota, ou
// um erro do SDK repassado pela rota), a frase tem jargão ("X-Conta", "membership", nome de papel) e o
// corretor não tem como agir: troca-se pela frase do mapa abaixo, com a ação certa. Código que nenhum dos
// dois conhece vira a frase genérica, e o texto técnico fica só no console.

/** Códigos que o backend do app emite com frase própria (o teste confere com `backend/`). */
export const CODIGOS_DO_APP: ReadonlySet<string> = new Set([
  'ACORDO_PROPOSTO', 'ETAPA_COM_NEGOCIOS', 'ETAPA_INATIVA', 'TEXTO_INVALIDO', 'AINDA_PUBLICANDO', 'AUTORIZACAO_ALTERADA', 'AUTORIZACAO_PROPRIETARIO_AUSENTE', 'BUSCA_CURTA', 'BUSCA_LONGA',
  'CANAL_INDISPONIVEL', 'CHECAGEM_PENDENTE', 'CODIGO_REPETIDO', 'CONTA_PESSOAL', 'CONVITE_INDISPONIVEL', 'DADOS_INSUFICIENTES',
  'DADOS_INVALIDOS', 'DOCUMENTO_EM_USO', 'DOCUMENTO_OBRIGATORIO', 'DUPLICATA', 'EM_USO', 'ENDERECO_EM_USO', 'ESCREVA_A_MENSAGEM',
  'ESTADO_INVALIDO', 'ETAPAS_ALTERADAS', 'IA_INDISPONIVEL', 'IMOVEL_NAO_ANUNCIAVEL', 'INSTAGRAM_DESCONECTADO',
  'INSTAGRAM_FORA', 'INSTAGRAM_LENTO', 'INSTAGRAM_NAO_CONFIGURADO', 'INSTAGRAM_RECUSOU', 'JA_EXISTE', 'JA_TEM_DADOS', 'LIMITE', 'LIMITE_MIDIAS', 'MANDATO_ALTERADO', 'MANDATO_INVALIDO',
  'MIDIA_ALTERADA', 'MOTIVO_OBRIGATORIO', 'MOVIMENTO_BLOQUEADO', 'MUITAS_TENTATIVAS', 'NAO_ENCONTRADO', 'NAO_PUBLICADA',
  'NEGOCIACAO_ALTERADA', 'NEGOCIACAO_COM_CORRETOR', 'NEGOCIACAO_ENCERRADA', 'NEGOCIACAO_EXISTENTE', 'NEGOCIADOR_DESLIGADO',
  'NEGOCIADOR_NAO_ENCONTRADO', 'NEGOCIADOR_SEM_PAPEL', 'NEGOCIO_ABERTO', 'NOME_REPETIDO', 'OBJECAO_ALTERADA',
  'OFERTA_IMPLAUSIVEL', 'PAGINA_FORA_DO_AR', 'PAGINA_NAO_SALVA', 'PECA_AGENDADA', 'PECA_MUDOU', 'PECA_TRAVADA',
  'PROPOSTA_INDISPONIVEL', 'PROPOSTA_VENCIDA', 'RECUO_ACIMA_DO_ALVO', 'SEM_ABORDAGEM', 'SEM_ACORDO', 'SEM_AGENTE',
  'SEM_ARTE', 'SEM_AUTORIZACAO', 'SEM_ETAPA', 'SEM_WHATSAPP', 'SO_DEMO', 'SO_O_CORRETOR', 'SUGESTAO_JA_DECIDIDA', 'SUGESTAO_SUPERADA', 'TOKEN_INVALIDO',
  'UPLOAD_RECUSADO',
]);

const RECARREGAR_CONTA = 'Esta conta não está mais disponível para você. Recarregue a página e, se atende mais de uma conta, escolha outra no seletor do alto da tela.';
const SEM_PERMISSAO = 'Seu usuário não tem permissão para isto. Peça a quem administra a plataforma para liberar o acesso.';
const INSTABILIDADE = 'A plataforma não respondeu agora. Espere alguns segundos e tente de novo.';

/** Códigos da plataforma (contas.md, autenticacao.md, overview.md) e os de acesso do app, com a frase e a ação. */
export const FRASES_DA_PLATAFORMA: Readonly<Record<string, string>> = {
  CONTA_INVALIDA: RECARREGAR_CONTA,
  CONTA_FORA_DA_MEMBERSHIP: RECARREGAR_CONTA,
  CONTA_DIVERGENTE: 'Este registro é de outra conta. Recarregue a página para ver os dados da conta em que você está.',
  CONTA_INATIVA: 'Esta conta está desativada. Fale com quem cuida das contas da plataforma.',
  CONTA_ACESSO_NEGADO: 'Seu usuário não está associado a nenhuma conta, então não dá para gravar nada. Peça a quem cuida das contas da plataforma para associar você a uma conta.',
  SEM_CONTA: 'Seu usuário não está associado a nenhuma conta. Peça a quem cuida das contas da plataforma para associar você a uma conta.',
  CONTA_NAO_INFORMADA: 'Você atende mais de uma conta: escolha a conta no seletor do alto da tela e tente de novo.',
  PROVISIONA_SEM_PAPEL: 'Para convidar corretores, seu usuário precisa do papel Equipe (operacao) neste app. Peça a quem administra a plataforma para atribuí-lo em Configurações › Usuários.',
  PROVISIONA_NAO_LIBERADA: 'O convite de corretores ainda não foi liberado para este app pela equipe da plataforma.',
  PROVISIONA_CONTA_ALHEIA: 'Este convite é de outra conta. Recarregue a página.',
  AUTH_SEM_PERMISSAO: SEM_PERMISSAO,
  AUTH_SEM_ALCADA: SEM_PERMISSAO,
  AUTH_TOKEN_FORA_DO_ESCOPO: SEM_PERMISSAO,
  SEM_PAPEL: 'Esta área não está liberada para o seu usuário. Peça a quem administra a plataforma para atribuir o papel certo neste app.',
  CORPO_MUITO_GRANDE: 'O envio ficou grande demais para uma vez só. Divida em partes menores e envie de novo.',
  AUTH_INFRA_INDISPONIVEL: INSTABILIDADE,
  PLATAFORMA_REINICIOU: INSTABILIDADE,
  APP_INDISPONIVEL: 'O app está em manutenção agora. Tente de novo em alguns minutos.',
  PLANO_ASSENTOS_ESGOTADOS: 'O plano da conta não tem mais vagas para pessoas. Fale com quem cuida das contas da plataforma.',
  CONVITE_JA_PENDENTE: 'Já existe um convite pendente para este e-mail. Revogue o anterior para enviar de novo.',
  CONVITE_MULTI_USUARIO_BLOQUEADO: 'A plataforma não permite mais de uma pessoa nesta conta.',
  CONVITE_CONTA_DIVERGENTE: 'Este e-mail já está ligado a outra conta da plataforma.',
  CONVITE_IDENTIDADE_INTERNA: 'Este e-mail é de alguém da equipe da plataforma; corretor convidado precisa de um e-mail próprio.',
  CONVITE_EMAIL_FALHOU: 'O convite foi criado, mas o e-mail não saiu. Tente reenviar em alguns minutos.',
  EMAIL_SISTEMA_INDISPONIVEL: 'O envio de e-mails da plataforma está indisponível agora. Tente de novo mais tarde.',
};

/** Frase da tela quando o código não é conhecido: o detalhe técnico vai só ao console. */
export const FRASE_GENERICA = 'Não foi possível concluir agora. Tente de novo; se continuar, avise a equipe pelo botão de ajuda.';

/**
 * A frase que a tela mostra para um erro. Erro da rota do app (código em `CODIGOS_DO_APP`): os `detalhes`
 * ou a frase do app. Erro da plataforma conhecido: a frase do mapa. Resto: a genérica, com o texto
 * técnico no console. Erro local do app (sem `status`, um `Error` lançado pela própria tela): a frase dele.
 */
export function fraseDoErro(e: unknown): string {
  const falha = (e ?? {}) as Error & { detalhes?: string[]; codigo?: string; status?: number };
  const codigo = typeof falha.codigo === 'string' ? falha.codigo : '';
  if (codigo && FRASES_DA_PLATAFORMA[codigo]) {
    console.warn('[portal_corretor]', codigo, falha.message);
    return FRASES_DA_PLATAFORMA[codigo];
  }
  // DUPLICATA traz o id do contato existente em `detalhes`: não é texto para o usuário.
  if (codigo === 'DUPLICATA') return falha.message;
  if (codigo && CODIGOS_DO_APP.has(codigo)) return falha.detalhes?.length ? falha.detalhes.join('\n') : falha.message;
  const daRede = typeof falha.status === 'number' || codigo || falha.name === 'TypeError' || !(e instanceof Error);
  if (daRede) {
    console.error('[portal_corretor]', e);
    return FRASE_GENERICA;
  }
  return falha.message || FRASE_GENERICA;
}
