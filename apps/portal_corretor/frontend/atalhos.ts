import type { UrbiVersoAPI } from '@urbiverso/sdk';
import { BUSCA_MIN, cortarTermo, normalizarTermo } from '../comum/busca';
import { formatarTelefone } from '../comum/crm';
import { chamarApi, noGesto } from './apoio.js';
import { criar, irParaComQuery, OPCOES_CRIAR, type OpcaoCriar } from './criar.js';
import { alternarAssistente } from './telas/assistente.js';
import { abrirNegociacao } from './telas/negociacoes.js';

declare const urbiVerso: UrbiVersoAPI;

// Busca global e atalhos de teclado (spec 11.7 e 11.0.6, item B10).
//
// Atalhos: `/` busca · `C` Criar · `A` Assistente · `J`/`K` próximo e anterior na lista · `E` editar o
// item aberto. Nenhum dispara com o foco num campo de texto (nem num diálogo aberto), nem com Ctrl,
// Cmd ou Alt: digitar "Joaquim" na busca de Clientes não pula de cliente.
//
// A busca abre o formulário de um campo `busca` do SDK (`urbiVerso.formulario`, o `urbi-seletor-objeto`
// por baixo): a lista se carrega enquanto se digita, sem CSS próprio. Ela pede `GET /busca`, que só
// responde pela conta ativa, e leva à ficha do que foi escolhido.
//
// As listas e as fichas se registram aqui (`registrarLista`, `registrarEdicao`) ao entrar na tela e se
// soltam ao sair; vale a última registrada. Tela sem registro: J, K e E não fazem nada.

export type AcaoAtalho = 'buscar' | 'criar' | 'assistente' | 'proximo' | 'anterior' | 'editar';

/** O que o atalho lê do `KeyboardEvent` (o teste monta um objeto com isso). */
export interface Tecla {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  isComposing?: boolean;
  defaultPrevented?: boolean;
}

const TECLAS: Record<string, AcaoAtalho> = {
  '/': 'buscar',
  c: 'criar',
  a: 'assistente',
  j: 'proximo',
  k: 'anterior',
  e: 'editar',
};

/** Primitivos que recebem texto ou abrem diálogo: com o shadow root fechado, o caminho para neles. */
const PRIMITIVOS_DE_TEXTO = /^URBI-(INPUT|TEXTAREA|SELECT|SELETOR|REDATOR|CHAT|BUSCA|MODAL|FORMULARIO|PROMPT|CONFIRMAR|ALERTA|PLANILHA|EDITOR)/;
const PAPEIS_DE_TEXTO = new Set(['textbox', 'searchbox', 'combobox', 'dialog', 'alertdialog', 'listbox', 'menu']);

/**
 * O foco está num lugar onde a tecla é texto, não atalho? `caminho` é o `composedPath()` do evento:
 * atravessa os shadow roots abertos, do elemento focado até a janela. Na dúvida, bloqueia: todo
 * `input` (até checkbox), `textarea`, `select`, conteúdo editável, papel de caixa de texto ou de
 * diálogo, e os primitivos de formulário e de diálogo do shell.
 */
export function focoEmCampo(caminho: readonly unknown[]): boolean {
  for (const no of caminho) {
    const el = no as { tagName?: string; isContentEditable?: boolean; getAttribute?: (n: string) => string | null };
    const tag = typeof el?.tagName === 'string' ? el.tagName.toUpperCase() : '';
    if (!tag) continue;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (el.isContentEditable) return true;
    if (PRIMITIVOS_DE_TEXTO.test(tag)) return true;
    const papel = el.getAttribute?.('role');
    if (papel && PAPEIS_DE_TEXTO.has(papel)) return true;
    if (el.getAttribute?.('contenteditable') === 'true' || el.getAttribute?.('contenteditable') === '') return true;
  }
  return false;
}

/** A ação da tecla, ou `null` se ela não é atalho aqui (campo de texto, modificador, composição). */
export function atalhoDe(e: Tecla, caminho: readonly unknown[]): AcaoAtalho | null {
  if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return null;
  const acao = TECLAS[e.key.length === 1 ? e.key.toLowerCase() : ''];
  if (!acao) return null;
  return focoEmCampo(caminho) ? null : acao;
}

/** Próximo (`passo` 1) ou anterior (-1) na lista. Sem item aberto, J vai ao primeiro e K ao último; nas pontas, fica. */
export function vizinho(ids: readonly number[], atual: number | null, passo: 1 | -1): number | null {
  if (!ids.length) return null;
  const i = atual === null ? -1 : ids.indexOf(atual);
  if (i < 0) return passo > 0 ? ids[0] : ids[ids.length - 1];
  const j = i + passo;
  return j < 0 || j >= ids.length ? null : ids[j];
}

// ---------- Registro das listas e fichas ----------

export interface ListaDeAtalhos {
  /** Ids na ordem em que aparecem. */
  ids: () => number[];
  /** O item aberto (`?item=`), ou `null`. */
  atual: () => number | null;
  escolher: (id: number) => void;
}

const listas = new Map<object, ListaDeAtalhos>();
const edicoes = new Map<object, () => void>();
const ultimo = <T>(m: Map<object, T>): T | null => {
  let v: T | null = null;
  for (const x of m.values()) v = x;
  return v;
};

/** A lista da tela entra no J/K. `dono` é quem registra (o elemento); a última registrada vale. */
export function registrarLista(dono: object, lista: ListaDeAtalhos) {
  listas.delete(dono);
  listas.set(dono, lista);
}
export const soltarLista = (dono: object) => void listas.delete(dono);

/** A ficha aberta entra no E: `editar` abre a edição dela. */
export function registrarEdicao(dono: object, editar: () => void) {
  edicoes.delete(dono);
  edicoes.set(dono, editar);
}
export const soltarEdicao = (dono: object) => void edicoes.delete(dono);

// ---------- Busca ----------

export interface RespostaBusca {
  clientes: { id: number; nome: string; telefone: string | null; email: string | null }[];
  imoveis: { id: number; codigo: string; titulo: string | null; bairro: string | null }[];
  negociacoes: { id: number; codigo: string; contato_nome: string | null; imovel_codigo: string | null; imovel_titulo: string | null }[];
}

export type DestinoBusca = { tipo: 'cliente' | 'imovel' | 'negociacao'; id: number };

const juntar = (...partes: (string | null | undefined)[]) => partes.filter((p) => p && String(p).trim()).join(' · ');

/** As opções da lista, na ordem clientes, imóveis, negociações, com o tipo à frente do rótulo; o telefone formatado (#182, item 2). */
export function opcoesDaBusca(r: Partial<RespostaBusca> | null | undefined): { rotulo: string; destino: DestinoBusca }[] {
  return [
    ...(r?.clientes ?? []).map((c) => ({ rotulo: juntar('Cliente', c.nome, formatarTelefone(c.telefone) || c.email), destino: { tipo: 'cliente' as const, id: c.id } })),
    ...(r?.imoveis ?? []).map((i) => ({ rotulo: juntar('Imóvel', i.codigo, i.titulo, i.bairro), destino: { tipo: 'imovel' as const, id: i.id } })),
    ...(r?.negociacoes ?? []).map((n) => ({
      rotulo: juntar('Negociação', n.codigo, n.contato_nome, n.imovel_titulo ?? n.imovel_codigo),
      destino: { tipo: 'negociacao' as const, id: n.id },
    })),
  ];
}

/** Abre o que foi escolhido: o cliente na Lista, a ficha do imóvel, a negociação em Clientes › Negociações. */
export function irPara(d: DestinoBusca) {
  if (d.tipo === 'cliente') irParaComQuery(`/clientes?item=${d.id}`);
  else if (d.tipo === 'imovel') urbiVerso.navegarSub(`/imoveis/${d.id}`);
  else abrirNegociacao(d.id);
}

/**
 * A busca global (`/` ou o botão Buscar no cabeçalho da coluna esquerda, D-126). É um gesto da conta em que abriu: trocada a conta com o
 * diálogo aberto, a lista para de buscar e o escolhido (que é da conta anterior) não abre nada.
 */
export function abrirBusca() {
  return noGesto(async (g) => {
    if (!g.vivo()) return;
    // O campo `busca` do formulário devolve um número: cada resultado ganha um, e o mapa diz aonde ir.
    const destinos = new Map<number, DestinoBusca>();
    let seq = 0;
    const buscar = async (termo: string, signal: AbortSignal) => {
      const q = cortarTermo(termo);
      // Mesma regra da rota: termo que ela recusaria por curto ("+5", "(1") nem é enviado.
      // Conta trocada com o diálogo aberto: nada de buscar na outra conta para uma lista desta.
      if (!normalizarTermo(q) || !g.vivo()) return [];
      let r: RespostaBusca;
      try {
        r = (await g.esperar(chamarApi(`/busca?q=${encodeURIComponent(q)}`, { signal }))) as RespostaBusca;
      } catch (e) {
        // A resposta chegou com a conta já trocada: a lista fica vazia, sem erro no diálogo.
        if (g.encerrado(e)) return [];
        throw e;
      }
      return opcoesDaBusca(r).map((o) => {
        destinos.set(++seq, o.destino);
        return { valor: seq, rotulo: o.rotulo };
      });
    };
    const r = await g.esperar(urbiVerso.formulario({
      titulo: 'Buscar',
      rotuloConfirmar: 'Abrir',
      campos: [
        {
          nome: 'alvo',
          tipo: 'busca',
          rotulo: 'Cliente, imóvel ou negociação',
          placeholder: `Nome, telefone, e-mail, código ou bairro (${BUSCA_MIN}+ letras)`,
          // Campo de busca não leva o asterisco de obrigatório (#182, item 1): sem escolha, "Abrir" não
          // abre nada. Com menos de BUSCA_MIN letras, nada é buscado (`buscar` devolve vazio).
          buscar,
        },
      ],
    }));
    const destino = typeof r?.alvo === 'number' ? destinos.get(r.alvo) : undefined;
    if (destino) irPara(destino);
  });
}

/**
 * Criar pelo teclado (`C`) e pela linha de atalhos do celular (M1): as mesmas opções do botão Criar, num
 * formulário de uma escolha (conta trocada com ele aberto: nada).
 */
export function abrirCriar() {
  return noGesto(async (g) => {
    const r = await g.esperar(urbiVerso.formulario({
      titulo: 'Criar',
      rotuloConfirmar: 'Continuar',
      campos: [{ nome: 'opcao', tipo: 'selecao', rotulo: 'O que criar', obrigatorio: true, opcoes: OPCOES_CRIAR.map((o) => ({ valor: o.id, rotulo: o.rotulo })) }],
    }));
    const opcao = OPCOES_CRIAR.find((o) => o.id === r?.opcao)?.id as OpcaoCriar | undefined;
    if (opcao) criar(opcao);
  });
}

// ---------- Instalação ----------

/**
 * Liga os atalhos na janela. `corretor()` diz se quem está vendo é da área do corretor (com conta):
 * só ele busca, cria e abre o Assistente. J, K e E valem para quem tem lista ou ficha registrada.
 * Devolve quem desliga.
 */
export function instalarAtalhos(corretor: () => boolean): () => void {
  const aoTeclar = (e: KeyboardEvent) => {
    const acao = atalhoDe(e, e.composedPath());
    if (!acao) return;
    if (acao === 'buscar' || acao === 'criar' || acao === 'assistente') {
      if (!corretor()) return;
      e.preventDefault();
      if (acao === 'buscar') void abrirBusca();
      else if (acao === 'criar') void abrirCriar();
      else alternarAssistente();
      return;
    }
    if (acao === 'editar') {
      const editar = ultimo(edicoes);
      if (!editar) return;
      e.preventDefault();
      editar();
      return;
    }
    const lista = ultimo(listas);
    if (!lista) return;
    const id = vizinho(lista.ids(), lista.atual(), acao === 'proximo' ? 1 : -1);
    if (id === null) return;
    e.preventDefault();
    lista.escolher(id);
  };
  window.addEventListener('keydown', aoTeclar);
  return () => window.removeEventListener('keydown', aoTeclar);
}
