import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { CampoFormulario, UrbiVersoAPI } from '@urbiverso/sdk';
import { PLAYBOOK_OBJECOES_PADRAO } from '../../comum/negociacao';
import { reaisParaCentavos } from '../../comum/crm';
import { buscaDoGesto, chamarApi, ContaTrocada, contaDeTrabalho, data, dataHora, ehContaTrocada, enviar, falhaAmbigua, formularioQueSalva, seNaoContaTrocada, filtrosDaUrl, filtrosNaUrl, gesto, mensagemDeErro, reais, soNegociador, type Gesto } from '../apoio.js';
import { moldura } from '../moldura.js';
import { acoesComMais, type Acao } from '../visual.js';
import { haQuanto } from '../../comum/conversas';
import { MOTIVOS_PERDA, ROTULO_MOTIVO_PERDA } from '../../comum/crm';
import { estadoDaFalha, estadoTela } from '../estados.js';
import './mandato.js';
import { registrarLista, soltarLista } from '../atalhos.js';

declare const urbiVerso: UrbiVersoAPI;

type Linha = Record<string, any>;

// Clientes › Negociações (P15, M8): a lista das negociações à esquerda, a negociação escolhida no centro
// (faixa, escada de propostas, a última fala do cliente e a sugestão do Negociador) e, à direita, o
// mandato, a leitura do comprador e o próximo movimento. O sigilo do mandato (recuo, alvo e BATNA do
// vendedor) só vem da rota própria (`GET /negociacoes/:id/mandato`, só do corretor) e aparece
// mascarado ("•••• mostrar"); a lista e o detalhe nunca o trazem (`semSigilo` no backend).
//
// Negociador humano (D7, spec 11.6): a mesma tela, só com as negociações atribuídas a ele, o mandato em
// leitura, completo e com o recuo mascarado como para o corretor (spec 11.6), e sem as ações do corretor:
// aceitar o acordo, editar o mandato, abrir negociação e atribuir. Ele pede sugestão, aprova, edita,
// descarta, registra a oferta do cliente, assume e devolve ao Negociador IA; o backend barra o resto.

export const ROTULO_ESTADO: Record<string, string> = {
  ativa: 'Em andamento',
  aguardando_corretor: 'Aguardando você',
  aguardando_cliente: 'Aguardando cliente',
  aguardando_proprietario: 'Aguardando proprietário',
  pausada: 'Pausada',
  ganha: 'Ganha',
  perdida: 'Perdida',
};
const COR_ESTADO: Record<string, string> = { aguardando_corretor: 'alerta', ganha: 'sucesso', perdida: 'erro' };
const QUEM_CONDUZ: Record<string, string> = { ia: 'Negociador IA', humano: 'Negociador', corretor: 'Você' };
/** Quem conduz, como quem está na tela lê: para o negociador humano, "Você" é ele e o corretor é "Corretor". */
const quemConduz = (d: Linha) =>
  soNegociador()
    ? ({ ia: 'Negociador IA', humano: 'Você', corretor: 'Corretor' } as Record<string, string>)[d.conduzida_por] ?? d.conduzida_por
    : d.conduzida_por === 'humano' && d.negociador_nome
      ? `Negociador (${d.negociador_nome})`
      : (QUEM_CONDUZ[d.conduzida_por] ?? d.conduzida_por);
const AUTONOMIA: Record<string, string> = { sugere: 'só sugere', pergunta_antes: 'pergunta antes', faz_sozinho: 'faz sozinho' };
const CANAL: Record<string, string> = { registro: 'Registro', portal: 'Portal', wa_me: 'Fazer agora', whatsapp: 'WhatsApp' };
const OBJECAO = Object.fromEntries(PLAYBOOK_OBJECOES_PADRAO.map((o) => [o.categoria, o.titulo]));

/** Filtros da lista (P15): `?neg=` no endereço; sem ele, as em andamento. */
const FILTROS = [
  { id: 'andamento', rotulo: 'Em andamento', estados: 'ativa,aguardando_corretor,aguardando_cliente,aguardando_proprietario,pausada' },
  { id: 'voce', rotulo: 'Aguardando você', estados: 'aguardando_corretor' },
  { id: 'negociador', rotulo: 'Negociador', estados: 'ativa' },
  { id: 'cliente', rotulo: 'Cliente', estados: 'aguardando_cliente' },
  { id: 'proprietario', rotulo: 'Proprietário', estados: 'aguardando_proprietario' },
  { id: 'encerradas', rotulo: 'Encerradas', estados: 'ganha,perdida' },
];

/**
 * A negociação mudou (oferta, decisão, passagem, assumir/devolver, mandato, encerramento): a lista relê
 * para mostrar a última oferta, o estado e quem conduz de agora (#188).
 */
export const EVENTO_NEGOCIACAO_MUDOU = 'pc-negociacao-mudou';
const avisarQueMudou = (id: number) => window.dispatchEvent(new CustomEvent(EVENTO_NEGOCIACAO_MUDOU, { detail: { id } }));

/** "−9%": a última oferta do comprador contra o preço pedido do mandato. */
export function diferencaDoPedido(oferta_c: number | null | undefined, pedido_c: number | null | undefined): string | null {
  if (!oferta_c || !pedido_c) return null;
  const pct = Math.round((oferta_c / pedido_c - 1) * 100);
  return `${pct > 0 ? '+' : pct < 0 ? '−' : ''}${Math.abs(pct)}%`;
}

/** Quem fez cada proposta da escada, como quem está na tela lê (o corretor ou o negociador humano). */
function quem(p: Linha): string {
  if (p.direcao === 'comprador') return 'Comprador';
  if (p.direcao === 'proprietario') return 'Proprietário';
  if (p.autor_tipo === 'negociador_ia') return 'Negociador IA';
  if (soNegociador()) return p.autor_tipo === 'negociador_humano' ? `Negociador${p.autor_nome ? ` (${p.autor_nome})` : ''}` : 'Corretor';
  return p.autor_tipo === 'negociador_humano' ? `Negociador${p.autor_nome ? ` (${p.autor_nome})` : ''}` : 'Você (vendedor)';
}

/**
 * A recusa do envio é só por ficar abaixo do recuo (D-120)? Então o corretor pode confirmar. O 422
 * `MOVIMENTO_BLOQUEADO` lista em `detalhes` cada garantia que barrou ("ABAIXO_DO_RECUO: …"); abaixo do
 * recuo o passo também falha (ele é medido até o recuo). O negociador humano nunca confirma.
 */
export function abaixoDoRecuoConfirmavel(e: unknown): boolean {
  const f = e as { codigo?: string; detalhes?: string[] };
  if (soNegociador() || f?.codigo !== 'MOVIMENTO_BLOQUEADO' || !Array.isArray(f.detalhes)) return false;
  const codigos = f.detalhes.map((d) => String(d).split(':')[0].trim());
  return codigos.includes('ABAIXO_DO_RECUO') && codigos.every((c) => c === 'ABAIXO_DO_RECUO' || c === 'PASSO_ACIMA_DO_LIMITE');
}

/** "R$ 1,32 mi" / "R$ 920 mil": cabe na linha da lista de 360 px. */
const reaisCurtos = (c: number) => (c >= 100_000_000 ? `R$ ${(c / 100_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} mi` : c >= 100_000 ? `R$ ${Math.round(c / 100_000)} mil` : reais(c));

const centavosDigitados = (v: unknown): number | null => {
  const c = reaisParaCentavos(v);
  return typeof c === 'number' && Number.isFinite(c) && c > 0 ? c : null;
};

// ---------------------------------------------------------------------------------------------------
// Formulários que gravam (#187, dívida do #207): recusado, o formulário reabre com o digitado e a frase do
// erro (`formularioQueSalva`), em vez do alerta solto. O que sai para fora nunca se repete por reabrir: o
// POST de proposta não tem chave de idempotência, então a falha AMBÍGUA (rede, 5xx: o servidor pode ter
// gravado) confere a escada antes de deixar reenviar; as outras gravações são condicionadas no servidor
// (repetidas, dão 409 e nada muda).

const valorInvalido = (exemplo: string) => new Error(`Digite o valor em reais, por exemplo ${exemplo}.`);

/** A falha ambígua cuja conferência também falhou: o corretor decide, sabendo que pode ter entrado. */
export const FRASE_PROPOSTA_EM_DUVIDA = 'A resposta não chegou, e a proposta pode ter sido registrada. Cancele e confira a escada de propostas antes de enviar de novo.';
export const FRASE_SUGESTAO_EM_DUVIDA = 'A resposta não chegou, e o pedido pode ter chegado ao Negociador. Cancele e confira a negociação antes de pedir de novo.';

/** Os ids das propostas da negociação, para a conferência depois de uma falha ambígua. */
async function idsDasPropostas(g: Gesto, nid: number): Promise<Set<number>> {
  const r = await g.esperar(chamarApi(`/negociacoes/${nid}/propostas`));
  return new Set(((r?.dados ?? []) as Linha[]).map((p) => Number(p.id)));
}

/**
 * O POST da proposta falhou. Recusa do app (nada gravado): relança, e o formulário reabre para corrigir.
 * Falha ambígua: relê a escada. A proposta entrou (uma que não estava em `antes`, com a mesma direção e o
 * mesmo valor): devolve-a marcada `conferida`, e nada é reenviado. Não entrou, ou a releitura falhou: a frase da
 * dúvida (a proposta pode ainda estar sendo gravada), e o corretor confere a escada antes de reenviar.
 */
export async function conferirProposta(g: Gesto, e: unknown, nid: number, antes: Set<number>, direcao: string, valor_c: number): Promise<Linha> {
  if (g.encerrado(e) || !falhaAmbigua(e)) throw e;
  let escada: Linha[];
  try {
    escada = (await g.esperar(chamarApi(`/negociacoes/${nid}/propostas`)))?.dados ?? [];
  } catch (e2) {
    if (g.encerrado(e2)) throw e2;
    throw new Error(FRASE_PROPOSTA_EM_DUVIDA);
  }
  const entrou = escada.find((p) => !antes.has(Number(p.id)) && p.direcao === direcao && Number(p.valor_c) === valor_c);
  // A releitura vazia não prova que não gravou: a requisição original pode ainda estar rodando (sem chave de
  // idempotência), então o formulário reabre dizendo que a proposta PODE ter sido registrada.
  if (!entrou) throw new Error(FRASE_PROPOSTA_EM_DUVIDA);
  return { ...entrou, conferida: true };
}

/** O que muda na negociação quando um pedido de sugestão chega ao servidor (sugestão, proposta, estado, fala). */
const marcaDaNegociacao = (d: Linha | null) =>
  JSON.stringify([d?.estado ?? null, d?.sugestao?.execucao_id ?? null, ((d?.propostas ?? []) as Linha[]).map((p) => p.id), d?.ultima_fala?.em ?? null]);

// ---------------------------------------------------------------------------------------------------
// Estado da negociação aberta: o centro e a direita leem o MESMO estado (como a ficha do cliente).

class NegociacaoAberta {
  private ouvintes = new Set<() => void>();
  readonly s: { detalhe: Linha | null; mandato: Linha | null; falha: unknown; ia: boolean | null; ocupado: boolean };
  private geracao = 0;
  /**
   * A conta em que a negociação foi aberta (`negociacaoDe` abre outra na troca de conta). Toda continuação
   * passa por `vida.esperar`: trocada a conta em qualquer await (diálogo aberto, envio em voo, o laço de
   * Retirar), o gesto termina em silêncio, sem novo envio, estado, aviso nem navegação.
   */
  readonly vida = gesto();

  constructor(readonly id: number) {
    const avisar = () => this.ouvintes.forEach((f) => f());
    this.s = new Proxy({ detalhe: null, mandato: null, falha: null, ia: null, ocupado: false } as NegociacaoAberta['s'], {
      set(alvo, chave, valor) {
        (alvo as unknown as Record<string | symbol, unknown>)[chave] = valor;
        avisar();
        return true;
      },
    });
  }

  get emUso() {
    return this.ouvintes.size > 0;
  }

  ouvir(fn: () => void) {
    this.ouvintes.add(fn);
    return () => this.ouvintes.delete(fn);
  }

  /** Lê a negociação e o mandato (rota própria, com o sigilo) e, na primeira vez, sonda a IA. */
  async carregar() {
    const g = ++this.geracao;
    this.s.falha = null;
    if (this.s.ia === null) void chamarApi('/negociador/ia').then((r) => (this.s.ia = !!r?.disponivel), seNaoContaTrocada(() => (this.s.ia = false)));
    try {
      const [detalhe, mandato] = await this.vida.esperar(Promise.all([chamarApi(`/negociacoes/${this.id}`), chamarApi(`/negociacoes/${this.id}/mandato`)]));
      if (g !== this.geracao || !this.emUso) return;
      this.s.detalhe = detalhe;
      this.s.mandato = mandato?.vigente ?? null;
    } catch (e) {
      if (this.vida.encerrado(e)) return;
      if (g === this.geracao) this.s.falha = e;
    }
  }

  /** Um gesto com diálogo ou cadeia de awaits: conta trocada no meio termina em silêncio. */
  async semAvisoDeOutraConta(fn: () => Promise<unknown>) {
    try {
      await fn();
    } catch (e) {
      if (!this.vida.encerrado(e)) throw e;
    }
  }

  /** Uma ação que grava: avisa o erro (o 422 das garantias diz o que barrou) e relê. */
  async agir(titulo: string, fn: () => Promise<unknown>): Promise<boolean> {
    if (this.s.ocupado || !this.vida.vivo()) return false;
    try {
      await this.gravar(fn);
      return true;
    } catch (e) {
      // Conta trocada no meio: sem alerta, e quem chamou não segue.
      if (this.vida.encerrado(e)) return false;
      // ESCREVA_A_MENSAGEM (D-111): o texto da rota diz o que fazer; vai como está.
      const mensagem = (e as { codigo?: string })?.codigo === 'ESCREVA_A_MENSAGEM' ? (e as Error).message : mensagemDeErro(e);
      await urbiVerso.alertar({ titulo, mensagem, tipo: 'erro' });
      return false;
    }
  }

  /**
   * Grava como o `agir` (a trava, a releitura e o aviso à lista), mas a falha volta a quem chamou: dentro
   * de `formularioQueSalva`, o formulário reabre com o digitado e a frase dela (#187).
   */
  async gravar<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.vida.vivo()) throw new ContaTrocada();
    if (this.s.ocupado) throw new Error('Outra ação desta negociação ainda está em andamento. Espere terminar e envie de novo.');
    this.s.ocupado = true;
    try {
      return await this.vida.esperar(fn());
    } finally {
      // A trava e a releitura são desta conta; a negociação da outra é outro objeto, que começou livre.
      if (this.vida.vivo()) {
        this.s.ocupado = false;
        await this.carregar();
        avisarQueMudou(this.id);
      }
    }
  }

  /**
   * O POST de uma proposta desta negociação. Falha ambígua: confere a escada (`conferirProposta`); a
   * proposta que entrou não é reenviada. `antes` é a escada da tela, lida antes do envio.
   */
  private async postarProposta(corpo: Record<string, unknown>): Promise<Linha> {
    const antes = new Set(((this.s.detalhe?.propostas ?? []) as Linha[]).map((p) => Number(p.id)));
    try {
      return await this.vida.esperar(enviar('POST', `/negociacoes/${this.id}/propostas`, corpo));
    } catch (e) {
      if (this.vida.encerrado(e)) throw e;
      return conferirProposta(this.vida, e, this.id, antes, String(corpo.direcao), Number(corpo.valor_c));
    }
  }

  /**
   * Nova contraproposta (D-120): a do corretor (ou do negociador humano), sem depender de sugestão. Sai
   * pelo portal ou pelo Fazer agora, com as validações de 10.9.7 no backend. Abaixo do ponto de recuo, o
   * corretor recebe o aviso e confirma (fica na trilha de auditoria); o negociador humano é bloqueado.
   */
  novaContraproposta() {
    return this.semAvisoDeOutraConta(() => this.novaContrapropostaNaConta());
  }

  private async novaContrapropostaNaConta() {
    const m = this.s.mandato;
    const concessoes = ((m?.concessoes ?? []) as Linha[]).filter((c) => c.item);
    // A janela do Fazer agora abre no clique de cada envio (senão o navegador a bloqueia), só recebe o link
    // depois de gravar e fecha a cada falha, antes de o formulário reabrir: nunca duas abertas nem um link
    // aberto sem a proposta gravada.
    const envio: { janela: Window | null; canal: string } = { janela: null, canal: 'portal' };
    const r = await formularioQueSalva<Linha>({
      titulo: 'Nova contraproposta',
      mensagem: 'A sua contraproposta, sem depender de sugestão. O app confere o mandato antes de enviar: passo, rodadas, concessões, validade e sigilo.',
      campos: [
        { nome: 'valor', tipo: 'texto', rotulo: 'Valor (R$)', placeholder: '1.400.000', obrigatorio: true },
        { nome: 'condicoes', tipo: 'texto', rotulo: 'Condições (opcional)', placeholder: 'à vista, entrada de 30%' },
        ...(concessoes.length
          ? [{ nome: 'concessao', tipo: 'selecao' as const, rotulo: 'Concessão (do mandato)', valor: '', opcoes: [{ valor: '', rotulo: 'Nenhuma' }, ...concessoes.map((c) => ({ valor: String(c.item), rotulo: `${c.item} ↔ ${c.contrapartida}` }))] }]
          : []),
        { nome: 'validade_horas', tipo: 'texto', rotulo: 'Vale por (horas; vazio = a do mandato)', placeholder: m?.validade_contraproposta_horas ? String(m.validade_contraproposta_horas) : '48' },
        { nome: 'mensagem', tipo: 'texto_longo', rotulo: 'Mensagem ao cliente (opcional)', placeholder: 'Em branco, sai a mensagem montada pelo app.' },
        { nome: 'canal', tipo: 'selecao', rotulo: 'Enviar por', valor: 'portal', opcoes: [{ valor: 'portal', rotulo: 'Portal do cliente' }, { valor: 'wa_me', rotulo: 'Fazer agora (WhatsApp do seu celular)' }] },
      ],
      rotuloConfirmar: 'Enviar contraproposta',
      gesto: this.vida,
      aviso: null,
      salvar: async (v) => {
        const valor_c = centavosDigitados(v.valor);
        if (!valor_c) throw valorInvalido('1.400.000');
        const item = concessoes.find((c) => String(c.item) === String(v.concessao ?? ''));
        const horas = Number(String(v.validade_horas ?? '').trim());
        const canal = v.canal === 'wa_me' ? 'wa_me' : 'portal';
        const corpo: Record<string, unknown> = {
          direcao: 'vendedor',
          valor_c,
          canal,
          condicoes: v.condicoes ? String(v.condicoes) : null,
          concessao: item ? String(item.item) : null,
          contrapartida: item ? String(item.contrapartida) : null,
          ...(Number.isInteger(horas) && horas > 0 ? { validade_horas: horas } : {}),
          ...(String(v.mensagem ?? '').trim() ? { mensagem: String(v.mensagem).trim() } : {}),
        };
        envio.canal = canal;
        envio.janela = canal === 'wa_me' ? window.open('', '_blank') : null;
        try {
          return await this.gravar(() => this.enviarContraproposta(corpo, valor_c));
        } catch (e) {
          // Fecha a desta tentativa; a próxima abre outra no próprio clique.
          envio.janela?.close();
          throw e;
        }
      },
    });
    const janela = envio.janela;
    if (!r) return void janela?.close();
    if (envio.canal !== 'wa_me') return void urbiVerso.notificar('Contraproposta enviada pelo portal do cliente.', 'sucesso');
    if (r.link && janela) janela.location.href = r.link;
    else if (r.conferida) {
      // Gravou, mas a resposta (com o texto e o link) se perdeu: nada é reenviado; o corretor escreve à mão.
      janela?.close();
      await this.vida.esperar(urbiVerso.alertar({ titulo: 'Contraproposta registrada', mensagem: `A resposta demorou, mas a contraproposta de ${reais(r.valor_c)} já está na escada. A mensagem pronta não chegou: escreva ao cliente pelo WhatsApp do seu celular.`, tipo: 'info' }));
    } else {
      janela?.close();
      await this.vida.esperar(urbiVerso.alertar({ titulo: 'Mensagem pronta', mensagem: [r.texto ?? '', r.link ? `Abra no WhatsApp: ${r.link}` : ''].filter(Boolean).join('\n\n'), tipo: 'info' }));
    }
  }

  /**
   * Um envio da Nova contraproposta. D-120: a recusa só por ficar abaixo do recuo pede a confirmação do
   * corretor, NESTE envio; só confirmado vai o segundo POST, com a marca (fica na trilha de auditoria). O
   * negociador humano nunca confirma (`abaixoDoRecuoConfirmavel`, e o backend ignora a marca dele). Não
   * confirmou: nada sai, e o formulário reabre com o digitado. O primeiro POST foi recusado (422, nada
   * gravado), então o segundo nunca duplica; o reenvio pelo formulário reaberto começa de novo sem a marca.
   */
  private async enviarContraproposta(corpo: Record<string, unknown>, valor_c: number): Promise<Linha> {
    try {
      return await this.postarProposta(corpo);
    } catch (e) {
      if (this.vida.encerrado(e) || !abaixoDoRecuoConfirmavel(e)) throw e;
      const sim = await this.vida.esperar(urbiVerso.confirmar({
        titulo: 'Abaixo do ponto de recuo',
        mensagem: `${reais(valor_c)} fica abaixo do ponto de recuo do mandato. Enviar mesmo assim? O envio fica registrado na trilha de auditoria, com o seu nome.`,
        rotuloConfirmar: 'Enviar abaixo do recuo',
        perigo: true,
      }));
      if (!sim) throw new Error('A contraproposta fica abaixo do ponto de recuo e não foi enviada. Ajuste o valor ou cancele.');
      return this.postarProposta({ ...corpo, confirmar_abaixo_do_recuo: true });
    }
  }

  /**
   * Registrar a decisão do proprietário (P15) sobre o acordo levado a ele: aceita (encerra ganha),
   * recusa, ou contraproposta do proprietário (`PATCH /propostas/:id`). Só o corretor.
   */
  registrarDecisao(decisao: 'aceita' | 'recusa' | 'contraproposta') {
    return this.semAvisoDeOutraConta(() => this.registrarDecisaoNaConta(decisao));
  }

  private async registrarDecisaoNaConta(decisao: 'aceita' | 'recusa' | 'contraproposta') {
    const acordo = ((this.s.detalhe?.propostas ?? []) as Linha[]).filter((p) => p.direcao === 'comprador' && p.estado === 'aceita').pop();
    if (!acordo) return;
    const corpo: Record<string, unknown> = { decisao };
    if (decisao === 'contraproposta') {
      // A decisão é condicionada no servidor (sob a trava: a proposta `aceita` e a negociação aguardando o
      // proprietário): repetida depois de gravar, dá 409 e nenhuma segunda rodada entra.
      await formularioQueSalva({
        titulo: 'Contraproposta do proprietário',
        gesto: this.vida,
        campos: [
          { nome: 'valor', tipo: 'texto', rotulo: 'Valor que o proprietário aceita (R$)', placeholder: '1.420.000', obrigatorio: true },
          { nome: 'condicoes', tipo: 'texto', rotulo: 'Condições (opcional)' },
        ],
        rotuloConfirmar: 'Registrar',
        aviso: 'Decisão do proprietário registrada.',
        salvar: async (v) => {
          const valor_c = centavosDigitados(v.valor);
          if (!valor_c) throw valorInvalido('1.420.000');
          return this.gravar(() => this.vida.esperar(enviar('PATCH', `/propostas/${acordo.id}`, { ...corpo, valor_c, condicoes: v.condicoes ? String(v.condicoes) : null })));
        },
      });
      return;
    }
    const sim = await this.vida.esperar(urbiVerso.confirmar({
      titulo: decisao === 'aceita' ? 'O proprietário aceitou' : 'O proprietário recusou',
      mensagem: decisao === 'aceita'
        ? `A negociação se encerra como ganha por ${reais(acordo.valor_c)}, e o negócio fica com esse valor.`
        : 'A oferta do comprador fica recusada e a negociação volta para você.',
      rotuloConfirmar: 'Registrar decisão',
    }));
    if (!sim) return;
    await this.agir('Não foi possível registrar a decisão', async () => {
      const r = await this.vida.esperar(enviar('PATCH', `/propostas/${acordo.id}`, corpo));
      urbiVerso.notificar(
        decisao === 'aceita'
          ? `Negociação ganha.${r?.comissao_prevista_c ? ` Comissão prevista: ${reais(r.comissao_prevista_c)}.` : ''}`
          : 'Decisão do proprietário registrada.',
        'sucesso',
      );
    });
  }

  /** Encerrar (menu "mais" do cabeçalho): ganha com o valor final, ou perdida com o motivo. */
  encerrar(como: 'ganha' | 'perdida') {
    return this.semAvisoDeOutraConta(async () => {
      const oferta = this.ultimaOferta();
      const formulario: { titulo: string; mensagem?: string; campos: CampoFormulario[]; rotuloConfirmar: string } =
        como === 'ganha'
          ? {
              titulo: 'Encerrar como ganha',
              mensagem: 'O valor final passa a ser o valor do negócio, e o app calcula a comissão prevista.',
              campos: [{ nome: 'valor', tipo: 'texto', rotulo: 'Valor final (R$)', obrigatorio: true, valor: oferta ? (oferta.valor_c / 100).toLocaleString('pt-BR') : '' }],
              rotuloConfirmar: 'Encerrar como ganha',
            }
          : {
              titulo: 'Encerrar como perdida',
              campos: [{ nome: 'motivo', tipo: 'selecao', rotulo: 'Motivo', obrigatorio: true, opcoes: MOTIVOS_PERDA.map((mo) => ({ valor: mo, rotulo: ROTULO_MOTIVO_PERDA[mo] ?? mo })) }],
              rotuloConfirmar: 'Encerrar como perdida',
            };
      // O encerramento é condicionado no servidor (`atualizarSe` no estado lido): repetido depois de gravar,
      // dá 409 NEGOCIACAO_ENCERRADA, e o evento não se publica duas vezes.
      const r = await formularioQueSalva<Linha>({
        ...formulario,
        gesto: this.vida,
        aviso: null,
        salvar: async (v) => {
          const corpo: Record<string, unknown> = { estado: como };
          if (como === 'ganha') {
            const valor_c = centavosDigitados(v.valor);
            if (!valor_c) throw valorInvalido('1.400.000');
            corpo.valor_final_c = valor_c;
          } else corpo.motivo_perda = String(v.motivo);
          return this.gravar(() => this.vida.esperar(enviar('PATCH', `/negociacoes/${this.id}`, corpo)));
        },
      });
      if (!r) return;
      urbiVerso.notificar(como === 'ganha' ? `Negociação ganha.${r.comissao_prevista_c ? ` Comissão prevista: ${reais(r.comissao_prevista_c)}.` : ''}` : 'Negociação encerrada como perdida.', 'sucesso');
    });
  }

  ultimaOferta(): Linha | null {
    const ofertas = (this.s.detalhe?.propostas ?? []).filter((p: Linha) => p.direcao === 'comprador');
    return ofertas[ofertas.length - 1] ?? null;
  }

  pedirSugestao() {
    return this.semAvisoDeOutraConta(() => this.pedirSugestaoNaConta());
  }

  private async pedirSugestaoNaConta() {
    // A IA falhou (503 IA_INDISPONIVEL, antes de gravar): o formulário reabre com o que foi colado. A falha
    // ambígua (o servidor pode ter rodado o Negociador, que em "faz sozinho" envia) não reenvia às cegas:
    // relê a negociação e, se ela mudou, o pedido chegou.
    const r = await formularioQueSalva<Linha>({
      titulo: 'Pedir sugestão ao Negociador',
      gesto: this.vida,
      mensagem: 'Cole o que o cliente disse por último, se houver. O Negociador sugere o próximo movimento dentro do mandato; nada é enviado sem a sua aprovação, salvo em "faz sozinho".',
      campos: [{ nome: 'mensagem_cliente', tipo: 'texto_longo', rotulo: 'O que o cliente disse (opcional)' }],
      rotuloConfirmar: 'Pedir sugestão',
      aviso: null,
      salvar: (v) =>
        this.gravar(async () => {
          const antes = marcaDaNegociacao(this.s.detalhe);
          try {
            return await this.vida.esperar(enviar('POST', `/negociacoes/${this.id}/sugestao`, { mensagem_cliente: v.mensagem_cliente ? String(v.mensagem_cliente) : null, canal: 'portal' }));
          } catch (e) {
            if (this.vida.encerrado(e) || !falhaAmbigua(e)) throw e;
            let depois: Linha | null;
            try {
              depois = await this.vida.esperar(chamarApi(`/negociacoes/${this.id}`));
            } catch (e2) {
              if (this.vida.encerrado(e2)) throw e2;
              throw new Error(FRASE_SUGESTAO_EM_DUVIDA);
            }
            // Sem mudança na releitura não prova que nada foi feito (o Negociador pode ainda estar rodando ou a
            // marca não mudar): frase de dúvida, nunca o convite a reenviar.
            if (marcaDaNegociacao(depois) === antes) throw new Error(FRASE_SUGESTAO_EM_DUVIDA);
            return { conferida: true } as Linha;
          }
        }),
    });
    if (!r) return;
    if (r.conferida) urbiVerso.notificar('A resposta demorou, mas o pedido chegou ao Negociador: confira a negociação.', 'info');
    else if (r.passagem) urbiVerso.notificar(`A negociação passou a você: ${(r.motivos_passagem ?? []).map((m: Linha) => m.descricao).join('; ') || 'o Negociador pediu.'}`, 'info');
    else if (r.enviada) urbiVerso.notificar('O Negociador enviou a contraproposta pelo portal.', 'sucesso');
  }

  /** A sugestão traz contraproposta? Só ela se aprova; a só em texto o corretor revisa e envia (D-111). */
  temContraproposta(): boolean {
    return !!this.s.detalhe?.sugestao?.resposta?.contraproposta?.valor_c;
  }

  /** Enviar (portal) ou Fazer agora (WhatsApp do celular) a contraproposta sugerida, com a mensagem montada. */
  async aprovar(canal: 'portal' | 'wa_me') {
    const sugestao = this.s.detalhe?.sugestao;
    if (!sugestao) return;
    // Só texto não se aprova (a rota responde ESCREVA_A_MENSAGEM): vai para a revisão do texto.
    if (!this.temContraproposta()) return this.editar();
    // A janela abre no próprio clique (senão o navegador a bloqueia) e recebe o link quando ele chega.
    const janela = canal === 'wa_me' ? window.open('', '_blank') : null;
    const ok = await this.agir('Não foi possível enviar', async () => {
      let r: any;
      try {
        r = await this.vida.esperar(enviar('POST', `/negociacoes/${this.id}/decisao`, { acao: 'aprovar', execucao_id: sugestao.execucao_id, canal }));
      } catch (e) {
        janela?.close(); // fecha antes de o alerta de erro aparecer
        throw e;
      }
      if (canal === 'wa_me') {
        if (r?.link && janela) janela.location.href = r.link;
        else {
          // Aba barrada pelo navegador: o texto e o link vão para o corretor copiar e abrir à mão.
          janela?.close();
          await urbiVerso.alertar({ titulo: 'Mensagem pronta', mensagem: [r?.texto ?? '', r?.link ? `Abra no WhatsApp: ${r.link}` : ''].filter(Boolean).join('\n\n'), tipo: 'info' });
        }
      } else urbiVerso.notificar('Contraproposta enviada pelo portal do cliente.', 'sucesso');
    });
    if (!ok) janela?.close();
  }

  /**
   * Editar (D-111). Só texto: o rascunho vem no campo, a mensagem é obrigatória e sai como do corretor.
   * Contraproposta: o valor vem preenchido e só vai se mudar (sem as condições, a concessão e a
   * contrapartida do modelo); a mensagem começa vazia e, em branco, sai a montada pelo app.
   */
  editar() {
    return this.semAvisoDeOutraConta(() => this.editarNaConta());
  }

  private async editarNaConta() {
    const sugestao = this.s.detalhe?.sugestao;
    if (!sugestao) return;
    const rascunho = String(sugestao.resposta?.mensagem ?? '');
    // A decisão reserva a sugestão no servidor (`atualizarSe` na execução pendente, sob a trava, com as
    // garantias de 10.9.7 refeitas): repetida depois de gravar, dá 409 SUGESTAO_JA_DECIDIDA, nunca dois envios.
    if (!this.temContraproposta()) {
      await formularioQueSalva({
        titulo: 'Revisar e enviar',
        gesto: this.vida,
        mensagem: 'O texto do Negociador é só um rascunho: revise e envie com as suas palavras. O app confere de novo que nada revele o sigilo.',
        campos: [{ nome: 'mensagem', tipo: 'texto_longo', rotulo: 'Mensagem ao cliente', valor: rascunho, obrigatorio: true }],
        rotuloConfirmar: 'Enviar pelo portal',
        aviso: 'Mensagem enviada pelo portal do cliente.',
        salvar: async (v) => {
          const mensagem = String(v.mensagem ?? '').trim();
          if (!mensagem) throw new Error('Escreva a mensagem ao cliente.');
          return this.gravar(() => this.vida.esperar(enviar('POST', `/negociacoes/${this.id}/decisao`, { acao: 'editar', execucao_id: sugestao.execucao_id, canal: 'portal', mensagem })));
        },
      });
      return;
    }
    const cp = sugestao.resposta.contraproposta;
    await formularioQueSalva({
      titulo: 'Editar a sugestão',
      gesto: this.vida,
      mensagem: `O app confere de novo as regras do mandato: abaixo do recuo, passo maior que o permitido ou texto que revele o sigilo não são enviados.${rascunho ? `\n\nRascunho do Negociador (só referência): ${rascunho}` : ''}`,
      campos: [
        { nome: 'valor', tipo: 'texto', rotulo: 'Valor da contraproposta (R$)', valor: (cp.valor_c / 100).toLocaleString('pt-BR') },
        { nome: 'mensagem', tipo: 'texto_longo', rotulo: 'Mensagem ao cliente (opcional)', valor: '', placeholder: 'Em branco, sai a mensagem montada pelo app.' },
      ],
      rotuloConfirmar: 'Enviar pelo portal',
      aviso: 'Contraproposta enviada pelo portal do cliente.',
      salvar: async (v) => {
        const digitado = String(v.valor ?? '').trim();
        const valor_c = digitado ? centavosDigitados(digitado) : cp.valor_c;
        if (!valor_c) throw valorInvalido('1.380.000');
        const mensagem = String(v.mensagem ?? '').trim();
        return this.gravar(() =>
          this.vida.esperar(enviar('POST', `/negociacoes/${this.id}/decisao`, {
            acao: 'editar', execucao_id: sugestao.execucao_id, canal: 'portal',
            ...(valor_c !== cp.valor_c ? { contraproposta: { valor_c, validade_horas: cp.validade_horas ?? null } } : {}),
            ...(mensagem ? { mensagem } : {}),
          })),
        );
      },
    });
  }

  async descartar() {
    const sugestao = this.s.detalhe?.sugestao;
    if (!sugestao) return;
    await this.agir('Não foi possível descartar', () => enviar('POST', `/negociacoes/${this.id}/decisao`, { acao: 'descartar', execucao_id: sugestao.execucao_id }));
  }

  registrarOferta() {
    return this.semAvisoDeOutraConta(() => this.registrarOfertaNaConta());
  }

  private async registrarOfertaNaConta() {
    // O registro é um POST de proposta: a falha ambígua confere a escada (`postarProposta`).
    await formularioQueSalva({
      titulo: 'Registrar oferta do cliente',
      gesto: this.vida,
      campos: [
        { nome: 'valor', tipo: 'texto', rotulo: 'Valor oferecido (R$)', placeholder: '1.320.000', obrigatorio: true },
        { nome: 'condicoes', tipo: 'texto', rotulo: 'Condições (opcional)' },
      ],
      rotuloConfirmar: 'Registrar',
      aviso: null,
      salvar: async (v) => {
        const valor_c = centavosDigitados(v.valor);
        if (!valor_c) throw valorInvalido('1.320.000');
        return this.gravar(() => this.postarProposta({ direcao: 'comprador', valor_c, condicoes: v.condicoes ? String(v.condicoes) : null }));
      },
    });
  }

  async conduzir(acao: 'assumir' | 'devolver') {
    await this.agir(acao === 'assumir' ? 'Não foi possível assumir' : 'Não foi possível devolver', () => enviar('POST', `/negociacoes/${this.id}/${acao}`, {}));
  }

  /** Aceite final (só o corretor): a última oferta do comprador vai ao proprietário. */
  passarAoProprietario() {
    return this.semAvisoDeOutraConta(() => this.passarAoProprietarioNaConta());
  }

  private async passarAoProprietarioNaConta() {
    const oferta = this.ultimaOferta();
    if (!oferta) return;
    const ok = await this.vida.esperar(urbiVerso.confirmar({
      titulo: 'Passar ao proprietário',
      mensagem: `A oferta de ${reais(oferta.valor_c)} vai ao proprietário para decisão. Daqui em diante nada é enviado ao cliente até a decisão dele.`,
      rotuloConfirmar: 'Passar ao proprietário',
    }));
    if (!ok) return;
    await this.agir('Não foi possível passar ao proprietário', () => enviar('POST', `/negociacoes/${this.id}/decisao`, { acao: 'aceitar_acordo', proposta_id: oferta.id }));
  }
}

let aberta: { conta: number | null; n: NegociacaoAberta } | null = null;

/** A negociação aberta: uma por vez, da conta ativa; uma visita nova relê do zero. */
export function negociacaoDe(id: number): NegociacaoAberta {
  const conta = contaDeTrabalho();
  if (!aberta || aberta.conta !== conta || aberta.n.id !== id || !aberta.n.emUso) aberta = { conta, n: new NegociacaoAberta(id) };
  return aberta.n;
}

abstract class ColunaDaNegociacao extends LitElement {
  @property({ type: Number }) negociacaoId = 0;
  protected n: NegociacaoAberta | null = null;
  private soltar?: () => void;

  connectedCallback() {
    super.connectedCallback();
    this.n = negociacaoDe(this.negociacaoId);
    this.soltar = this.n.ouvir(() => this.requestUpdate());
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.soltar?.();
  }
}

// ---------------------------------------------------------------------------------------------------
// Esquerda: a lista, com os filtros de 11.1 (P15).

@customElement('pc-negociacoes-lista')
export class PcNegociacoesLista extends LitElement {
  @property({ attribute: false }) selecionado: number | null = null;
  @property({ attribute: false }) aoEscolher: (id: number) => void = () => {};
  /** A lista da tela Negociações entra no J/K (11.0.6); a da aba Negociação na ficha, não. */
  @property({ type: Boolean }) atalhos = false;
  @state() private linhas: Linha[] = [];
  @state() private carregando = true;
  @state() private falha: string | null = null;
  private geracao = 0;

  private aoMudar = () => void this.carregar();

  connectedCallback() {
    super.connectedCallback();
    void this.carregar();
    window.addEventListener(EVENTO_NEGOCIACAO_MUDOU, this.aoMudar);
    if (this.atalhos) {
      registrarLista(this, { ids: () => this.linhas.map((n) => Number(n.id)), atual: () => this.selecionado, escolher: (id) => this.aoEscolher(id) });
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    soltarLista(this);
    window.removeEventListener(EVENTO_NEGOCIACAO_MUDOU, this.aoMudar);
  }

  private filtro() {
    const id = filtrosDaUrl().get('neg');
    return FILTROS.find((f) => f.id === id) ?? FILTROS[0];
  }

  private async carregar() {
    const g = ++this.geracao;
    this.carregando = true;
    this.falha = null;
    try {
      const f = this.filtro();
      const r = await chamarApi(`/negociacoes?estado=${f.estados}&por_pagina=100`);
      if (g !== this.geracao) return;
      // "Negociador": em andamento com o Negociador conduzindo (a rota filtra só o estado).
      this.linhas = f.id === 'negociador' ? r.dados.filter((n: Linha) => n.conduzida_por !== 'corretor') : r.dados;
      // Sem `?item=`, a tela abre na primeira negociação (como a referência P15). No celular (M8), não:
      // lá a lista é a primeira coluna e a negociação abre no toque.
      if (this.atalhos && !this.selecionado && this.linhas.length && window.innerWidth > 900) this.aoEscolher(Number(this.linhas[0].id));
    } catch (e) {
      if (g === this.geracao && !ehContaTrocada(e)) this.falha = mensagemDeErro(e);
    } finally {
      if (g === this.geracao) this.carregando = false;
    }
  }

  private filtrar(id: string) {
    filtrosNaUrl(filtrosDaUrl(), { neg: id === 'andamento' ? '' : id });
    void this.carregar();
  }

  /** Cliente, imóvel, última oferta × pedido, quem conduz e o tempo desde a última rodada (P15, #178). */
  private linha(n: Linha) {
    const dif = diferencaDoPedido(n.ultima_oferta_c, n.preco_pedido_c);
    return html`<urbi-stack>
      <urbi-linha justificar="entre">
        <urbi-prosa truncar>${n.contato_nome ?? 'Cliente'}</urbi-prosa>
        <urbi-badge cor=${COR_ESTADO[n.estado] ?? ''}>${ROTULO_ESTADO[n.estado] ?? n.estado}</urbi-badge>
      </urbi-linha>
      <urbi-prosa papel="secundario" truncar>${n.imovel_titulo ?? n.imovel_codigo ?? n.codigo ?? ''}</urbi-prosa>
      <urbi-prosa papel="secundario" truncar>${n.ultima_oferta_c ? `${reaisCurtos(n.ultima_oferta_c)}${n.preco_pedido_c ? ` × ${reaisCurtos(n.preco_pedido_c)}` : ''}${dif ? ` · ${dif}` : ''}` : 'sem oferta'}</urbi-prosa>
      <urbi-prosa papel="dica" truncar>${quemConduz(n)}${n.ultima_rodada_em ? ` · ${haQuanto(n.ultima_rodada_em)}` : ''}</urbi-prosa>
    </urbi-stack>`;
  }

  render() {
    return html`<urbi-stack>
      <urbi-chips-atalho .opcoes=${FILTROS.map((f) => ({ id: f.id, rotulo: f.rotulo }))} ativo=${this.filtro().id}
        @urbi:chip-atalho:click=${(e: CustomEvent) => this.filtrar(e.detail.id)}></urbi-chips-atalho>
      ${this.falha
        ? estadoTela('erro', { aoTentar: () => void this.carregar() })
        : html`<urbi-lista clicavel separador .itens=${this.linhas} ?carregando=${this.carregando}
            mensagem-vazio=${soNegociador() ? 'Nenhuma negociação atribuída a você aqui. O corretor atribui as negociações que você conduz.' : 'Nenhuma negociação aqui. Comece por Criar › Nova proposta.'}
            .itemAtivo=${(n: Linha) => n.id === this.selecionado}
            .indicador=${(n: Linha) => (n.id === this.selecionado ? 'var(--cor-primaria)' : '')}
            .render_item=${(n: Linha) => this.linha(n)}
            @urbi:lista-click=${(e: CustomEvent) => this.aoEscolher((e.detail.item as Linha).id)}></urbi-lista>`}
    </urbi-stack>`;
  }
}

// ---------------------------------------------------------------------------------------------------
// Centro: cabeçalho, faixa, a sugestão do Negociador (ou Pedir sugestão), escada e última fala (P15; no celular, M8).

/**
 * Faixa da negociação (D-102). Lacuna nomeada em 11.9 (pedido ao shell 13): até o primitivo existir,
 * é montada com primitivos — as marcas em ordem de valor, como badges, e a ZOPA estimada numa linha. O
 * recuo aparece mascarado ("••••"); a tela é só do corretor.
 */
export function marcasDaFaixa(p: { oferta_c?: number | null; recuo_c?: number | null; teto_c?: number | null; alvo_c?: number | null; pedido_c?: number | null }) {
  const marcas = [
    { id: 'oferta', rotulo: 'Oferta do comprador', valor: p.oferta_c, texto: reais(p.oferta_c) },
    { id: 'recuo', rotulo: 'Ponto de recuo', valor: p.recuo_c, texto: '•••• (sigiloso)' },
    { id: 'teto', rotulo: 'Teto estimado do comprador', valor: p.teto_c, texto: `~${reais(p.teto_c)}` },
    { id: 'alvo', rotulo: 'Alvo', valor: p.alvo_c, texto: reais(p.alvo_c) },
    { id: 'pedido', rotulo: 'Preço pedido', valor: p.pedido_c, texto: reais(p.pedido_c) },
  ].filter((m) => typeof m.valor === 'number' && m.valor > 0);
  marcas.sort((a, b) => (a.valor as number) - (b.valor as number));
  const zopa = p.recuo_c && p.teto_c ? (p.teto_c >= p.recuo_c ? 'existe' : 'nao') : 'sem_dados';
  return { marcas: marcas.map(({ id, rotulo, texto }) => ({ id, rotulo, texto })), zopa };
}

@customElement('pc-negociacao-foco')
export class PcNegociacaoFoco extends ColunaDaNegociacao {
  connectedCallback() {
    super.connectedCallback();
    void this.n!.carregar();
  }

  private faixa(d: Linha, m: Linha | null) {
    const oferta = this.n!.ultimaOferta();
    const { marcas, zopa } = marcasDaFaixa({ oferta_c: oferta?.valor_c, recuo_c: m?.recuo_c, teto_c: d.teto_estimado_comprador_c, alvo_c: m?.alvo_c, pedido_c: m?.preco_pedido_c });
    return html`<urbi-card titulo="Faixa da negociação" icone="fa-solid fa-ruler-horizontal">
      <urbi-linha quebrar>
        ${marcas.map((x) => html`<urbi-badge cor=${x.id === 'oferta' && m && oferta && oferta.valor_c < m.recuo_c ? 'erro' : ''}>${x.rotulo}: ${x.texto}</urbi-badge>`)}
      </urbi-linha>
      ${zopa === 'existe'
        ? html`<urbi-prosa papel="secundario"><urbi-badge cor="sucesso">ZOPA estimada</urbi-badge> entre o seu ponto de recuo e ~${reais(d.teto_estimado_comprador_c)} (o teto estimado do comprador).</urbi-prosa>`
        : zopa === 'nao'
          ? html`<urbi-prosa papel="secundario"><urbi-badge cor="erro">Sem ZOPA</urbi-badge> o teto estimado do comprador está abaixo do seu ponto de recuo.</urbi-prosa>`
          : html`<urbi-prosa papel="dica">A ZOPA aparece com o mandato e o teto estimado do comprador.</urbi-prosa>`}
    </urbi-card>`;
  }

  private escada(d: Linha) {
    const linhas = (d.propostas ?? []).map((p: Linha) => ({
      rodada: p.rodada,
      quem: quem(p),
      valor: reais(p.valor_c),
      condicoes: p.condicoes ?? '—',
      concessao: p.concessao ?? '—',
      contrapartida: p.contrapartida ?? '—',
      canal: CANAL[p.canal] ?? p.canal,
      quando: dataHora(p.criado_em),
    }));
    // Lista compacta, uma rodada por item (#180 e #190): a tabela de 8 colunas passava da coluna central e,
    // no celular, virava rótulos empilhados. Rodada, quem e valor na linha de cima; o resto, embaixo.
    type Degrau = (typeof linhas)[number];
    return html`<urbi-card titulo="Escada de propostas" icone="fa-solid fa-stairs">
      ${linhas.length
        ? html`<urbi-lista separador .itens=${linhas} .render_item=${(p: Degrau) => html`<urbi-stack>
            <urbi-linha justificar="entre">
              <urbi-prosa truncar>R${p.rodada} · ${p.quem}</urbi-prosa>
              <urbi-prosa><strong>${p.valor}</strong></urbi-prosa>
            </urbi-linha>
            <urbi-prosa papel="dica">${[p.condicoes !== '—' ? p.condicoes : null, p.concessao !== '—' ? `${p.concessao} ↔ ${p.contrapartida}` : null, p.canal, p.quando].filter(Boolean).join(' · ')}</urbi-prosa>
          </urbi-stack>`}></urbi-lista>`
        : html`<urbi-prosa papel="dica">Nenhuma proposta ainda. Registre a oferta do cliente para começar.</urbi-prosa>`}
      <urbi-linha quebrar>
        <urbi-botao variante="secundario" icone="fa-solid fa-plus" ?desabilitado=${this.n!.s.ocupado} @click=${() => void this.n!.registrarOferta()}>Registrar oferta do cliente</urbi-botao>
      </urbi-linha>
    </urbi-card>`;
  }

  private sugestao(d: Linha) {
    const s = d.sugestao;
    if (!s) {
      const ia = this.n!.s.ia;
      return html`<urbi-linha quebrar>
        <urbi-botao icone="fa-solid fa-wand-magic-sparkles" ?desabilitado=${ia === false || this.n!.s.ocupado} ?carregando=${this.n!.s.ocupado}
          title=${ia === false ? 'IA indisponível agora' : nothing} @click=${() => void this.n!.pedirSugestao()}>Pedir sugestão</urbi-botao>
        ${ia === false ? html`<urbi-prosa papel="dica">IA indisponível agora: registre as propostas à mão; o mandato continua valendo.</urbi-prosa>` : ''}
      </urbi-linha>`;
    }
    const r = s.resposta ?? {};
    const cp = r.contraproposta;
    const bloqueada = !!s.bloqueado_por;
    return html`<urbi-card titulo=${`Negociador sugere · rodada ${Number(d.rodadas ?? 0) + 1}`} icone="fa-solid fa-wand-magic-sparkles">
      ${cp?.valor_c
        ? html`<urbi-prosa><strong>${reais(cp.valor_c)}</strong>${cp.condicoes ? ` · ${cp.condicoes}` : ''}${cp.concessao ? ` · ${cp.concessao} ↔ ${cp.contrapartida ?? ''}` : ''}</urbi-prosa>`
        : ''}
      ${r.mensagem ? html`<urbi-prosa papel="dica">Rascunho do Negociador (não sai como está):</urbi-prosa><urbi-prosa pre>${r.mensagem}</urbi-prosa>` : ''}
      <urbi-prosa papel="dica">${(s.validacoes ?? []).map((v: Linha) => `${v.ok ? 'ok' : 'falhou'}: ${v.descricao}`).join(' · ')}</urbi-prosa>
      ${bloqueada ? html`<urbi-banner variante="alerta">Bloqueada pelas regras do mandato: edite antes de enviar, ou descarte.</urbi-banner>` : ''}
      <urbi-linha quebrar>
        ${cp?.valor_c
          ? html`<urbi-botao icone="fa-solid fa-paper-plane" ?desabilitado=${bloqueada || this.n!.s.ocupado} @click=${() => void this.n!.aprovar('portal')}>Enviar</urbi-botao>
              <urbi-botao variante="secundario" icone="fa-brands fa-whatsapp" ?desabilitado=${bloqueada || this.n!.s.ocupado} @click=${() => void this.n!.aprovar('wa_me')}>Fazer agora</urbi-botao>`
          : html`<urbi-botao icone="fa-solid fa-pen" ?desabilitado=${this.n!.s.ocupado} @click=${() => void this.n!.editar()}>Revisar e enviar</urbi-botao>`}
        <urbi-dropdown flutuante>
          <urbi-botao slot="trigger" variante="texto" icone="fa-solid fa-ellipsis" ?desabilitado=${this.n!.s.ocupado}>Mais</urbi-botao>
          <div slot="menu">
            ${cp?.valor_c ? html`<urbi-dropdown-item icone="fa-solid fa-pen" @urbi:dropdown-select=${() => void this.n!.editar()}>Editar</urbi-dropdown-item>` : ''}
            <urbi-dropdown-item icone="fa-solid fa-trash" perigo @urbi:dropdown-select=${() => void this.n!.descartar()}>Descartar</urbi-dropdown-item>
          </div>
        </urbi-dropdown>
      </urbi-linha>
    </urbi-card>`;
  }

  render() {
    const { detalhe: d, mandato: m, falha } = this.n!.s;
    if (!d) return falha ? estadoDaFalha(falha, () => void this.n!.carregar()) : estadoTela('carregando');
    const resumo = d.mandato as Linha | null;
    const encerrada = d.estado === 'ganha' || d.estado === 'perdida';
    // Quem está na tela conduz? O corretor, como `corretor`; o negociador humano, como `humano` (D7).
    const conduzo = d.conduzida_por === (soNegociador() ? 'humano' : 'corretor');
    const principal: Acao = conduzo
      ? { rotulo: 'Devolver ao Negociador', icone: 'fa-solid fa-robot', aoEscolher: () => void this.n!.conduzir('devolver') }
      : { rotulo: 'Assumir', icone: 'fa-solid fa-hand', aoEscolher: () => void this.n!.conduzir('assumir') };
    // Encerrar é só do corretor (spec 14), no menu "mais" do cabeçalho.
    const mais: Acao[] = soNegociador()
      ? []
      : [
          { rotulo: 'Encerrar como ganha', icone: 'fa-solid fa-trophy', aoEscolher: () => void this.n!.encerrar('ganha') },
          { rotulo: 'Encerrar como perdida', icone: 'fa-solid fa-xmark', perigo: true, aoEscolher: () => void this.n!.encerrar('perdida') },
        ];
    // "Ana Ribeiro · Casa 4 quartos, Jardim Botânico" (P15) e, no celular (M8), "· rodada 4 de 4".
    const titulo = [d.contato_nome ?? 'Cliente', d.imovel_titulo ?? d.imovel_codigo ?? d.codigo].filter(Boolean).join(' · ');
    // Título, chips e só depois Assumir · Mais, como a referência P15 (Assumir abaixo dos chips). Com o título
    // na mesma `urbi-linha` das ações, o stack não encolhia: no celular o título passava 78 px da tela, cortado
    // sem quebrar (448 px em 390, medido na 0.1.51; #190). Fora da linha, ele quebra na largura da coluna.
    return html`<urbi-stack>
      <urbi-stack>
        <urbi-prosa papel="titulo">${titulo}</urbi-prosa>
        <urbi-prosa papel="dica">${d.codigo}${d.imovel_codigo ? ` · ${d.imovel_codigo}` : ''} · rodada ${d.rodadas ?? 0}${resumo?.rodadas_max ? ` de ${resumo.rodadas_max}` : ''}</urbi-prosa>
      </urbi-stack>
      <urbi-linha quebrar>
        <urbi-badge cor=${COR_ESTADO[d.estado] ?? ''}>${ROTULO_ESTADO[d.estado] ?? d.estado}</urbi-badge>
        <urbi-badge>Rodada ${d.rodadas ?? 0}${resumo?.rodadas_max ? ` de ${resumo.rodadas_max}` : ''}</urbi-badge>
        <urbi-badge>${quemConduz(d)}${resumo?.autonomia && d.conduzida_por === 'ia' ? ` · ${AUTONOMIA[resumo.autonomia]}` : ''}</urbi-badge>
        ${resumo?.validade
          ? html`<urbi-badge>Mandato válido até ${data(`${resumo.validade}T12:00:00`)}</urbi-badge>`
          : html`<urbi-badge cor="alerta">Sem mandato</urbi-badge>`}
      </urbi-linha>
      ${encerrada ? '' : acoesComMais(principal, mais)}
      ${this.faixa(d, m)}
      ${encerrada ? '' : this.sugestao(d)}
      ${encerrada || d.estado === 'aguardando_proprietario'
        ? ''
        : html`<urbi-linha quebrar>
            <urbi-botao variante="secundario" icone="fa-solid fa-reply" ?desabilitado=${this.n!.s.ocupado || !m}
              title=${m ? nothing : 'Defina o mandato antes'} @click=${() => void this.n!.novaContraproposta()}>Nova contraproposta</urbi-botao>
            ${m ? '' : html`<urbi-prosa papel="dica">Sem mandato, nenhuma contraproposta sai: defina o mandato à direita.</urbi-prosa>`}
          </urbi-linha>`}
      ${this.escada(d)}
      ${d.ultima_fala ? html`<urbi-card titulo="Última fala do cliente" icone="fa-solid fa-comment"><urbi-prosa pre>${d.ultima_fala.texto}</urbi-prosa><urbi-prosa papel="dica">${dataHora(d.ultima_fala.em)}</urbi-prosa></urbi-card>` : ''}
    </urbi-stack>`;
  }
}

// ---------------------------------------------------------------------------------------------------
// Direita: mandato (sigilo mascarado), leitura do comprador e o próximo movimento.

@customElement('pc-negociacao-contexto')
export class PcNegociacaoContexto extends ColunaDaNegociacao {
  @state() private mostrar: { recuo: boolean; batna: boolean } = { recuo: false, batna: false };
  @state() private editando = false;

  private sigilo(chave: 'recuo' | 'batna', texto: string) {
    return this.mostrar[chave]
      ? html`${texto} <urbi-botao pequeno variante="texto" @click=${() => (this.mostrar = { ...this.mostrar, [chave]: false })}>esconder</urbi-botao>`
      : html`<strong>••••</strong> <urbi-botao pequeno variante="texto" @click=${() => (this.mostrar = { ...this.mostrar, [chave]: true })}>mostrar</urbi-botao>`;
  }

  private cartaoMandato(m: Linha | null) {
    // Negociador humano (spec 11.6): o mesmo cartão, em leitura (sem definir nem editar o mandato).
    const leitura = soNegociador();
    if (!m && leitura) {
      return html`<urbi-card titulo="Mandato" icone="fa-solid fa-file-shield">
        <urbi-prosa papel="dica">O corretor ainda não definiu o mandato desta negociação. Sem ele, nenhuma contraproposta sai: fale com o corretor.</urbi-prosa>
      </urbi-card>`;
    }
    if (!m) {
      return html`<urbi-card titulo="Mandato" icone="fa-solid fa-file-shield">
        <urbi-prosa papel="dica">Sem mandato, o Negociador não age: ele só passa a negociação a você. Defina até onde ele pode ir.</urbi-prosa>
        <urbi-botao pequeno icone="fa-solid fa-plus" @click=${() => (this.editando = true)}>Definir mandato</urbi-botao>
      </urbi-card>`;
    }
    const concessoes = (m.concessoes ?? []) as Linha[];
    return html`<urbi-card titulo="Mandato" icone="fa-solid fa-file-shield">
      <urbi-prosa>Pedido ${reais(m.preco_pedido_c)}</urbi-prosa>
      <urbi-prosa>Alvo ${reais(m.alvo_c)}</urbi-prosa>
      <urbi-prosa>Recuo ${this.sigilo('recuo', reais(m.recuo_c))}</urbi-prosa>
      ${m.batna_vendedor ? html`<urbi-prosa>BATNA do vendedor ${this.sigilo('batna', m.batna_vendedor)}</urbi-prosa>` : ''}
      <urbi-prosa papel="secundario">${concessoes.length ? `Concessões: ${concessoes.map((c) => `${c.item} ↔ ${c.contrapartida}`).join('; ')}` : 'Sem concessões além do preço.'}</urbi-prosa>
      <urbi-prosa papel="dica">Até ${m.rodadas_max} rodadas · passo de até ${Math.round(Number(m.passo_max_pct) * 100)}% · ${AUTONOMIA[m.autonomia] ?? m.autonomia} · válido até ${data(`${m.validade}T12:00:00`)}</urbi-prosa>
      <urbi-prosa papel="dica">Recuo e BATNA são sigilosos: o cliente nunca os vê.</urbi-prosa>
      ${leitura ? nothing : html`<urbi-botao pequeno variante="secundario" icone="fa-solid fa-pen" @click=${() => (this.editando = true)}>Editar mandato</urbi-botao>`}
    </urbi-card>`;
  }

  /**
   * Quem negocia (só o corretor, D7): atribuir a negociação a um negociador humano da conta, ou retirar.
   * A lista vem de quem aceitou o convite (Ajustes › Negociador) e já tem o papel `negociador`.
   */
  private cartaoQuemNegocia(d: Linha) {
    const encerrada = d.estado === 'ganha' || d.estado === 'perdida';
    return html`<urbi-card titulo="Quem negocia" icone="fa-solid fa-user-gear">
      <urbi-prosa>${quemConduz(d)}</urbi-prosa>
      ${encerrada
        ? ''
        : html`<urbi-linha quebrar>
            <urbi-botao pequeno variante="secundario" icone="fa-solid fa-user-plus" ?desabilitado=${this.n!.s.ocupado} @click=${() => void this.atribuir(d)}>${d.negociador_usuario_id ? 'Trocar negociador' : 'Atribuir a um negociador'}</urbi-botao>
            ${d.negociador_usuario_id
              ? html`<urbi-botao pequeno variante="texto" ?desabilitado=${this.n!.s.ocupado} @click=${() => void this.retirar(d)}>Retirar do negociador</urbi-botao>`
              : ''}
          </urbi-linha>`}
    </urbi-card>`;
  }

  private atribuir(d: Linha) {
    const n = this.n!;
    return n.semAvisoDeOutraConta(() => this.atribuirNaConta(n, d));
  }

  private async atribuirNaConta(n: NegociacaoAberta, d: Linha) {
    let pessoas: Linha[];
    try {
      pessoas = (await n.vida.esperar(chamarApi('/negociador/negociadores')))?.dados ?? [];
    } catch (e) {
      if (n.vida.encerrado(e)) return;
      await urbiVerso.alertar({ titulo: 'Negociador humano indisponível', mensagem: mensagemDeErro(e), tipo: 'alerta' });
      return;
    }
    const prontas = pessoas.filter((p) => p.tem_papel);
    if (!prontas.length) {
      const semPapel = pessoas.length - prontas.length;
      await urbiVerso.alertar({
        titulo: 'Nenhum negociador pronto',
        mensagem: semPapel
          ? 'Quem aceitou o seu convite ainda não tem o papel negociador ou perdeu o acesso ao app. Peça ao administrador do app para conferir em Configurações › Usuários.'
          : 'Convide uma pessoa em Ajustes › Negociador › Quem negocia. Depois do aceite, o administrador do app atribui o papel negociador a ela.',
        tipo: 'info',
      });
      return;
    }
    // A atribuição à mesma pessoa é reaproveitada no servidor (e não avisa de novo): repetir não duplica.
    await formularioQueSalva({
      titulo: 'Atribuir a um negociador',
      gesto: n.vida,
      mensagem: 'A pessoa passa a conduzir esta negociação, dentro do mandato. Ela não vê o recuo, o alvo nem a BATNA do vendedor e não aceita o acordo final.',
      campos: [{ nome: 'usuario_id', tipo: 'selecao', rotulo: 'Negociador', obrigatorio: true, opcoes: prontas.map((p) => ({ valor: String(p.usuario_id), rotulo: p.email })) }],
      rotuloConfirmar: 'Atribuir',
      aviso: 'Negociação atribuída.',
      salvar: (v) => n.gravar(() => n.vida.esperar(enviar('POST', '/negociador/atribuicoes', { negociacao_id: d.id, usuario_id: Number(v.usuario_id) }))),
    });
  }

  private retirar(d: Linha) {
    const n = this.n!;
    return n.semAvisoDeOutraConta(async () => {
      const ok = await n.vida.esperar(urbiVerso.confirmar({ titulo: 'Retirar do negociador', mensagem: 'A negociação volta para você conduzir.', rotuloConfirmar: 'Retirar' }));
      if (!ok) return;
      await this.retirarNaConta(n, d);
    });
  }

  private async retirarNaConta(n: NegociacaoAberta, d: Linha) {
    await n.agir('Não foi possível retirar', async () => {
      const ativas: Linha[] = (await n.vida.esperar(chamarApi(`/negociador/atribuicoes?negociacao_id=${d.id}&ativa=true`)))?.dados ?? [];
      // Cada PATCH do laço confere a conta: trocada no meio, nenhum sai mais (com o `X-Conta` da nova).
      for (const a of ativas) await n.vida.esperar(enviar('PATCH', `/negociador/atribuicoes/${a.id}`, { ativa: false }));
      urbiVerso.notificar('A negociação voltou para você.', 'sucesso');
    });
  }

  private cartaoLeitura(d: Linha) {
    const objecoes = [...new Set(((d.objecoes ?? []) as Linha[]).map((o) => o.categoria))];
    const interesses = (d.sugestao?.resposta?.interesses_identificados ?? []) as string[];
    return html`<urbi-card titulo="Leitura do comprador" icone="fa-solid fa-binoculars">
      ${objecoes.length || interesses.length
        ? html`<urbi-linha quebrar>
            ${objecoes.map((c) => html`<urbi-badge cor="alerta">Objeção: ${(OBJECAO[c] ?? c).toLowerCase()}</urbi-badge>`)}
            ${interesses.map((i) => html`<urbi-badge>Interesse: ${i}</urbi-badge>`)}
          </urbi-linha>`
        : ''}
      ${d.teto_estimado_comprador_c
        ? html`<urbi-prosa>Teto estimado ~${reais(d.teto_estimado_comprador_c)}${d.fonte_estimativa ? ` · fonte: ${d.fonte_estimativa}` : ''}</urbi-prosa>`
        : html`<urbi-prosa papel="dica">Sem teto estimado ainda: o Negociador estima a cada sugestão.</urbi-prosa>`}
      ${d.batna_estimada_comprador ? html`<urbi-prosa papel="secundario">Alternativa do comprador: ${d.batna_estimada_comprador}</urbi-prosa>` : ''}
    </urbi-card>`;
  }

  private cartaoProximo(d: Linha) {
    const cp = d.sugestao?.resposta?.contraproposta;
    const oferta = this.n!.ultimaOferta();
    // Aceitar o acordo é só do corretor (D-98): o negociador humano não vê o botão (e a rota o recusa).
    const podePassar = !soNegociador() && !!oferta && !['aguardando_proprietario', 'ganha', 'perdida'].includes(d.estado);
    return html`<urbi-card titulo="Próximo movimento" icone="fa-solid fa-forward">
      ${cp?.valor_c
        ? html`<urbi-prosa>Contraproposta de ${reais(cp.valor_c)}${cp.condicoes ? `, ${cp.condicoes}` : ''}${cp.concessao ? `, com ${cp.concessao} pedindo ${cp.contrapartida ?? 'contrapartida'}` : ''}.</urbi-prosa>
            <urbi-botao ?desabilitado=${!!d.sugestao.bloqueado_por || this.n!.s.ocupado} @click=${() => void this.n!.aprovar('portal')}>Usar sugestão</urbi-botao>`
        : d.estado === 'aguardando_proprietario'
          ? soNegociador()
            ? html`<urbi-prosa papel="dica">O acordo está com o proprietário; o corretor registra a decisão dele.</urbi-prosa>`
            : html`<urbi-prosa>O acordo está com o proprietário. Registre a decisão dele:</urbi-prosa>
                <urbi-linha quebrar>
                  <urbi-botao icone="fa-solid fa-check" ?desabilitado=${this.n!.s.ocupado} @click=${() => void this.n!.registrarDecisao('aceita')}>Aceita</urbi-botao>
                  <urbi-botao variante="secundario" icone="fa-solid fa-xmark" ?desabilitado=${this.n!.s.ocupado} @click=${() => void this.n!.registrarDecisao('recusa')}>Recusa</urbi-botao>
                  <urbi-botao variante="secundario" icone="fa-solid fa-reply" ?desabilitado=${this.n!.s.ocupado} @click=${() => void this.n!.registrarDecisao('contraproposta')}>Contraproposta do proprietário</urbi-botao>
                </urbi-linha>`
          : html`<urbi-prosa papel="dica">Peça uma sugestão ao Negociador no centro, ou registre a oferta do cliente.</urbi-prosa>`}
      ${podePassar
        ? html`<urbi-botao variante="secundario" icone="fa-solid fa-handshake" ?desabilitado=${this.n!.s.ocupado} @click=${() => void this.n!.passarAoProprietario()}>Passar ao proprietário</urbi-botao>
            <urbi-prosa papel="dica">Aceitar a oferta de ${reais(oferta!.valor_c)} é sempre seu: o Negociador nunca fecha o acordo.</urbi-prosa>`
        : soNegociador() && oferta && !['aguardando_proprietario', 'ganha', 'perdida'].includes(d.estado)
          ? html`<urbi-prosa papel="dica">Aceitar o acordo é do corretor: quando o comprador topar, avise o corretor.</urbi-prosa>`
          : ''}
    </urbi-card>`;
  }

  render() {
    const { detalhe: d, mandato: m } = this.n!.s;
    if (!d) return this.n!.s.falha ? '' : estadoTela('carregando');
    return html`<urbi-stack>
      ${this.cartaoMandato(m)}
      ${soNegociador() ? '' : this.cartaoQuemNegocia(d)}
      ${this.cartaoLeitura(d)}
      ${this.cartaoProximo(d)}
      ${this.editando
        ? html`<pc-mandato-modal .negociacaoId=${d.id} .imovelId=${d.imovel_id} .atual=${m} .conduzidaPor=${d.conduzida_por} .negociadorId=${Number(d.negociador_usuario_id) || 0}
            .aoFechar=${(salvou: boolean) => {
              this.editando = false;
              if (salvou) void this.n!.carregar().then(() => avisarQueMudou(d.id));
            }}></pc-mandato-modal>`
        : ''}
    </urbi-stack>`;
  }
}

// ---------------------------------------------------------------------------------------------------
// Criar › Nova proposta: cliente, imóvel e a oferta, que cai sempre numa negociação DO IMÓVEL escolhido.
// Depois abre a negociação (P15).

/**
 * Registra a proposta e devolve o id da negociação, ou `null` (cancelou, falhou, ou a conta mudou no meio:
 * aí em silêncio, sem mais envios, aviso nem a navegação de quem chamou).
 */
export async function novaProposta(foco?: { id: number; nome: string } | null): Promise<number | null> {
  const g = gesto();
  try {
    return await novaPropostaNoGesto(g, foco);
  } catch (e) {
    if (g.encerrado(e)) return null;
    throw e;
  }
}

/**
 * Uma tentativa da Nova proposta que gravou parte dos passos (o negócio, a negociação) e falhou depois. O
 * formulário reabre e o reenvio, com o mesmo cliente e o mesmo imóvel, segue do passo que faltou: nada já
 * gravado se grava de novo.
 */
interface PassosDaProposta {
  contato: number;
  imovel: number;
  negocio?: Linha;
  nid?: number;
}

async function novaPropostaNoGesto(g: Gesto, foco?: { id: number; nome: string } | null): Promise<number | null> {
  let feitos: PassosDaProposta | null = null;
  const campos: CampoFormulario[] = [
    { nome: 'contato_id', tipo: 'busca', rotulo: 'Cliente', obrigatorio: true, valor: foco?.id ?? null, rotuloValor: foco?.nome, placeholder: 'Nome ou telefone', buscar: buscaDoGesto(g, '/contatos', (c) => c.nome) },
    { nome: 'imovel_id', tipo: 'busca', rotulo: 'Imóvel', obrigatorio: true, placeholder: 'Código, bairro ou título', buscar: buscaDoGesto(g, '/imoveis', (i) => `${i.codigo} · ${i.titulo ?? i.bairro ?? ''}`) },
    { nome: 'valor', tipo: 'texto', rotulo: 'Valor oferecido (R$)', placeholder: '1.320.000', obrigatorio: true },
    { nome: 'condicoes', tipo: 'texto', rotulo: 'Condições (opcional)' },
  ] as CampoFormulario[];
  const r = await formularioQueSalva<{ nid: number }>({
    titulo: 'Nova proposta',
    gesto: g,
    mensagem: 'Registre a oferta do cliente. A negociação abre em Clientes › Negociações, onde você define o mandato.',
    campos,
    rotuloConfirmar: 'Registrar proposta',
    aviso: 'Proposta registrada.',
    salvar: async (v) => {
      const valor_c = centavosDigitados(v.valor);
      if (!valor_c) throw valorInvalido('1.320.000');
      const contato = Number(v.contato_id);
      const imovel = Number(v.imovel_id);
      if (!feitos || feitos.contato !== contato || feitos.imovel !== imovel) feitos = { contato, imovel };
      const passos = feitos;
      if (!passos.nid) {
        // Conduta (uma negociação em andamento por negócio, 6.16): 1) o cliente já negocia ESTE imóvel →
        // a oferta entra nela; 2) senão, um negócio aberto de compra do cliente sobre este imóvel (ou sem
        // imóvel) e sem negociação em andamento recebe a negociação nova; 3) senão, abre um negócio próprio
        // para o imóvel. Negócio que já negocia OUTRO imóvel nunca recebe a oferta (não grava no imóvel errado).
        // Relidos a cada tentativa: o negócio e a negociação que uma tentativa anterior criou (inclusive com
        // a resposta perdida) aparecem aqui e não se criam de novo.
        const emAndamento: Linha[] = (await g.esperar(chamarApi(`/negociacoes?contato_id=${contato}&estado=${FILTROS[0].estados}&por_pagina=100`)))?.dados ?? [];
        let negociacao: Linha | null = emAndamento.find((n) => Number(n.imovel_id) === imovel) ?? null;
        if (!negociacao) {
          const ocupados = new Set(emAndamento.map((n) => Number(n.negocio_id)));
          const negocios: Linha[] = (await g.esperar(chamarApi(`/contatos/${contato}`)))?.negocios ?? [];
          const livre = (n: Linha) => n.etapa_tipo === 'aberta' && n.pipeline === 'compra' && !ocupados.has(Number(n.id));
          let negocio = negocios.find((n) => livre(n) && Number(n.imovel_id) === imovel) ?? negocios.find((n) => livre(n) && !n.imovel_id) ?? passos.negocio ?? null;
          if (!negocio) {
            negocio = passos.negocio = await g.esperar(enviar('POST', '/negocios', { contato_id: contato, imovel_id: imovel }));
            urbiVerso.notificar('Aberto um negócio novo do cliente para este imóvel.', 'info');
          }
          // O negócio novo que já nasce na Proposta abre a negociação sozinho (gatilho `etapa_proposta`):
          // a oferta entra nela, sem pedir outra (que daria 409 NEGOCIACAO_EXISTENTE).
          const entrou = negocio === passos.negocio ? negocio?.negociador_entrou : null;
          negociacao = entrou?.negociacao_id ? { id: entrou.negociacao_id } : await g.esperar(enviar('POST', '/negociacoes', { negocio_id: negocio!.id, imovel_id: imovel }));
        }
        passos.nid = Number(negociacao!.id);
      }
      const nid = passos.nid;
      const antes = await idsDasPropostas(g, nid);
      try {
        await g.esperar(enviar('POST', `/negociacoes/${nid}/propostas`, { direcao: 'comprador', valor_c, condicoes: v.condicoes ? String(v.condicoes) : null }));
      } catch (e) {
        if (g.encerrado(e)) throw e;
        await conferirProposta(g, e, nid, antes, 'comprador', valor_c);
      }
      return { nid };
    },
  });
  return r ? r.nid : null;
}

/**
 * Proposta pela conversa (P02, D-127): o registro de proposta ligado ao negócio do contato, que CRIA ou
 * ABRE a negociação. Com uma negociação em andamento do cliente, ela é a escolha; com negócios abertos de
 * compra (com imóvel) sem negociação, cada um vira uma escolha que cria a negociação (`POST /negociacoes`,
 * evento `negociacao_iniciada` e o aviso "Negociação aberta" na conversa). A oferta é opcional. Sem
 * nenhuma das duas, cai na Nova proposta (escolha do imóvel pela busca). Devolve o id da negociação.
 */
export async function propostaDoContato(g: Gesto, contato: { id: number; nome: string }): Promise<number | null> {
  const [neg, ficha] = await g.esperar(Promise.all([
    chamarApi(`/negociacoes?contato_id=${contato.id}&estado=${FILTROS[0].estados}&por_pagina=50`),
    chamarApi(`/contatos/${contato.id}`),
  ]));
  const abertas: Linha[] = neg?.dados ?? [];
  const ocupados = new Set(abertas.map((n) => Number(n.negocio_id)));
  const livres: Linha[] = ((ficha?.negocios ?? []) as Linha[]).filter((n) => n.etapa_tipo === 'aberta' && n.pipeline === 'compra' && n.imovel_id && !ocupados.has(Number(n.id)));
  const escolhas = [
    ...abertas.map((n) => ({ valor: `neg:${n.id}`, rotulo: `${n.codigo} · ${n.imovel_titulo ?? n.imovel_codigo ?? 'imóvel'} (em andamento)` })),
    ...livres.map((n) => ({ valor: `negocio:${n.id}:${n.imovel_id}`, rotulo: `${n.titulo ?? 'Negócio'}${n.imovel_codigo ? ` · ${n.imovel_codigo}` : ''} (abrir negociação)` })),
  ];
  if (!escolhas.length) return novaProposta(contato);
  // A negociação aberta numa tentativa que falhou depois (na oferta) é reaproveitada no reenvio com a mesma
  // escolha; com a resposta perdida, o servidor recusa a segunda (409 NEGOCIACAO_EXISTENTE, um índice único).
  const abertasAqui = new Map<string, number>();
  const r = await formularioQueSalva<{ nid: number }>({
    titulo: `Proposta · ${contato.nome}`,
    gesto: g,
    mensagem: 'Escolha o negócio. Sem negociação ainda, ela é aberta agora; a oferta é opcional (registre-a se o cliente já disse um valor).',
    campos: [
      { nome: 'escolha', tipo: 'selecao', rotulo: 'Negócio e imóvel', obrigatorio: true, valor: escolhas[0].valor, opcoes: escolhas },
      { nome: 'valor', tipo: 'texto', rotulo: 'Oferta do cliente (R$, opcional)', placeholder: '1.320.000' },
      { nome: 'condicoes', tipo: 'texto', rotulo: 'Condições (opcional)' },
    ],
    rotuloConfirmar: 'Abrir a negociação',
    aviso: null,
    salvar: async (v) => {
      const digitado = String(v.valor ?? '').trim();
      const valor_c = digitado ? centavosDigitados(digitado) : null;
      if (digitado && !valor_c) throw valorInvalido('1.320.000');
      const escolha = String(v.escolha);
      const [tipo, a, b] = escolha.split(':');
      let nid = Number(a);
      if (tipo === 'negocio') {
        const ja = abertasAqui.get(escolha);
        if (ja) nid = ja;
        else {
          const criada = await g.esperar(enviar('POST', '/negociacoes', { negocio_id: Number(a), imovel_id: Number(b) }));
          nid = Number(criada.id);
          abertasAqui.set(escolha, nid);
          urbiVerso.notificar(`Negociação ${criada.codigo} aberta.`, 'sucesso');
        }
      }
      if (valor_c) {
        const antes = await idsDasPropostas(g, nid);
        try {
          await g.esperar(enviar('POST', `/negociacoes/${nid}/propostas`, { direcao: 'comprador', valor_c, condicoes: v.condicoes ? String(v.condicoes) : null }));
        } catch (e) {
          if (g.encerrado(e)) throw e;
          await conferirProposta(g, e, nid, antes, 'comprador', valor_c);
        }
      }
      return { nid };
    },
  });
  return r ? r.nid : null;
}

/**
 * Abre a negociação em Clientes › Negociações (P15), pela navegação da SPA, como o Criar faz. Com query,
 * o caminho é o de overview.md (pushState + PopStateEvent, o mesmo que o navegarSub faz por dentro):
 * o navegarSub só documenta o path.
 */
export function abrirNegociacao(id: number) {
  history.pushState(history.state, '', `${urbiVerso.href('/clientes')}?visao=negociacoes&item=${id}`);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

// Aba Negociação da ficha do cliente (P04): as negociações dele, com o atalho para a P15.
@customElement('pc-negociacoes-do-cliente')
export class PcNegociacoesDoCliente extends LitElement {
  @property({ type: Number }) contatoId = 0;
  @property() nome = '';
  @state() private linhas: Linha[] | null = null;
  @state() private falha = false;

  connectedCallback() {
    super.connectedCallback();
    chamarApi(`/negociacoes?contato_id=${this.contatoId}&por_pagina=50`).then(
      (r) => (this.linhas = r?.dados ?? []),
      seNaoContaTrocada(() => (this.falha = true)),
    );
  }

  render() {
    if (this.falha) return estadoTela('erro', { mensagem: 'Não foi possível ler as negociações.' });
    if (!this.linhas) return estadoTela('carregando');
    return html`<urbi-card titulo="Negociação" icone="fa-solid fa-handshake">
      ${this.linhas.length
        ? html`<urbi-lista clicavel separador .itens=${this.linhas}
            .render_item=${(n: Linha) => {
              const dif = diferencaDoPedido(n.ultima_oferta_c, n.preco_pedido_c);
              return html`<urbi-linha justificar="entre" quebrar>
                <urbi-prosa>${n.imovel_titulo ?? n.imovel_codigo ?? n.codigo}${n.ultima_oferta_c ? ` · ${reais(n.ultima_oferta_c)}${dif ? ` · ${dif}` : ''}` : ''}</urbi-prosa>
                <urbi-badge cor=${COR_ESTADO[n.estado] ?? ''}>${ROTULO_ESTADO[n.estado] ?? n.estado}</urbi-badge>
              </urbi-linha>`;
            }}
            @urbi:lista-click=${(e: CustomEvent) => abrirNegociacao((e.detail.item as Linha).id)}></urbi-lista>`
        : html`<urbi-prosa papel="dica">Nenhuma negociação com ${this.nome || 'este cliente'}. Quando ele fizer uma oferta, registre em Nova proposta.</urbi-prosa>`}
      <urbi-linha>
        <urbi-botao pequeno variante="secundario" icone="fa-solid fa-plus"
          @click=${() => void novaProposta({ id: this.contatoId, nome: this.nome }).then((n) => n && abrirNegociacao(n))}>Nova proposta</urbi-botao>
      </urbi-linha>
    </urbi-card>`;
  }
}

/**
 * Hoje do negociador humano (D7, spec 11.6): as negociações atribuídas a ele, com os mesmos filtros da
 * lista. Escolher uma abre a negociação em Negociações (`/negociacoes?item=`).
 */
export function renderHojeNegociador(atualizar: () => void) {
  const abrir = (id: number) => {
    history.pushState(history.state, '', `${urbiVerso.href('/negociacoes')}?item=${id}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };
  const centro = html`<urbi-stack>
    <urbi-prosa papel="titulo">Suas negociações</urbi-prosa>
    <urbi-prosa papel="secundario">As negociações que o corretor atribuiu a você. Você conduz dentro do mandato; aceitar o acordo é sempre do corretor.</urbi-prosa>
    <pc-negociacoes-lista .aoEscolher=${abrir}></pc-negociacoes-lista>
  </urbi-stack>`;
  return moldura({ menu: '/', centro }, atualizar);
}
