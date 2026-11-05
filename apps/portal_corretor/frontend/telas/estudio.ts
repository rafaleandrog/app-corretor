import { html, nothing, type TemplateResult } from 'lit';
import { AsyncDirective, directive } from 'lit/async-directive.js';
import { ref } from 'lit/directives/ref.js';
import type { CampoFormulario, ChatMensagem, UrbiVersoAPI } from '@urbiverso/sdk';
import { FERRAMENTA, FERRAMENTAS, FORMATOS, MAX_SLIDES, OBJETIVOS, ROTULO_FORMATO, ROTULO_OBJETIVO, type Ferramenta, type Formato, type Objetivo } from '../../comum/estudio';
import {
  acaoPrincipal,
  agruparPedidos,
  CRIAR_RAPIDO,
  ETAPAS,
  estaSemana,
  etapaValida,
  pedidoEscolhido,
  pedidosNaEtapa,
  proximoPasso,
  resumoPedido,
  semArte,
  tituloPedido,
  TRAVADA,
  type AcaoPrincipal,
  type Pedido,
  type PecaTela,
} from '../../comum/estudio-pedidos';
import {
  acoesComMais,
  avisoCreci,
  chamarApi,
  contaAtiva,
  dataHora,
  enviar,
  filtrosDaUrl,
  filtrosNaUrl,
  juntarDataHora,
  mensagemDeErro,
  pedidoDeCriar,
  subirArquivo,
  type Acao,
} from '../apoio.js';
import { DICA_IA_INDISPONIVEL, estadoDaFalha, estadoTela } from '../estados.js';
import { moldura } from '../moldura.js';

declare const urbiVerso: UrbiVersoAPI;

type Peca = PecaTela & Record<string, any>;
interface Marca {
  creci: string | null;
  logo_url: string | null;
  foto_url: string | null;
  referencias: { id: number; url: string }[];
}
interface Conexao {
  instagram: { usuario: string; ultimo_erro: string | null } | null;
  disponivel: boolean;
}
/** A descrição da peça (GET /estudio/pecas/:id/instrucao): o texto, as fotos e o logo para anexar. */
interface Instrucao {
  ferramenta: Ferramenta;
  prompt: string;
  onde: string;
  fotos: { url: string }[];
  logo_url: string | null;
  referencias: { id: number }[];
  abrir: string | null;
}

const ESTADO: Record<string, { cor: string; rotulo: string }> = {
  rascunho: { cor: 'padrao', rotulo: 'rascunho' },
  aprovada: { cor: 'sucesso', rotulo: 'aprovada' },
  agendada: { cor: 'info', rotulo: 'agendada' },
  publicando: { cor: 'info', rotulo: 'publicando…' },
  publicada: { cor: 'sucesso', rotulo: 'publicada' },
  rejeitada: { cor: 'alerta', rotulo: 'de volta a rascunho' },
  erro: { cor: 'erro', rotulo: 'com erro' },
};
// `motor` guarda os valores de sempre (D-86, D-89): `canva_ia` é a arte feita no Canva, `upload` a de
// outra ferramenta; `interno` só existe nas peças antigas, do gerador do app que saiu.
const MOTOR: Record<string, string> = { interno: 'gerador do app', canva_ia: 'arte do Canva', upload: 'arte de outra ferramenta' };
const QUINZE_MIN = 15 * 60e3;
/** Autor das mensagens do Estúdio no feed (as peças); o corretor é o usuário logado. */
const AUTOR_ESTUDIO = -1;

// Estúdio no Padrão B (spec 11.1 P08, D-105; B6 do arco #87). O comportamento é o de D-89 a D-91: o
// app escreve os textos e a DESCRIÇÃO da arte (instruções em inglês, texto da arte em português); a
// arte é feita fora do app, no Canva IA (ou em outra ferramenta), e enviada na própria peça. Sem
// aprovação por janela (D-86), sem preenchimento automático do Canva e sem créditos (D-87).
//
// Moldura: esquerda "Estúdio" (estado do Instagram), Criar rápido 2×2 e Seus pedidos (com as etapas
// de D-90); centro o pedido como conversa (`urbi-feed`: o texto do corretor e as peças, cada uma com a
// sua ação principal no rodapé) e o compositor (`urbi-redator`); direita Esta semana, Biblioteca e o
// aviso de CRECI quando falta. O pedido aberto fica em `?pedido=<id>` (o id da primeira peça) ou
// `?item=<id>` (uma peça); a etapa em `?etapa=`.
//
// ---------- O estado é da INSTÂNCIA da tela (decisão de desenho do B6) ----------
//
// Cada `Estudio` é uma instância da tela, nascida quando ela entra no DOM e encerrada quando sai. Todo
// o estado (peças, marca, ação em andamento, descrições abertas, "Novo post" pendente) é dela; nada
// fica no módulo, nem passa de uma instância para outra, a não ser o `?pedido=`/`?item=`/`?etapa=` que
// ela mesma escreve na URL e lê ao nascer.
//
// - Troca de conta é instância nova: o app recria o conteúdo pela chave `sub|conta|visita`
//   (frontend/index.ts, `keyed`); a instância guarda a chave com que nasceu e, quando a do app muda, já
//   não está viva. Sair do Estúdio, ir a outra app ou perder o contexto tira a diretiva do DOM
//   (`disconnected`), e a instância morre também.
//   A chave é conferida pela instância porque o `keyed` do lit 3 não avisa as diretivas assíncronas na
//   troca de chave: ele zera o valor da parte antes de limpá-la, e o `disconnected()` delas não roda
//   (lit-html/async-directive.js, `notifyChildPartConnectedChanged` lê o valor já zerado). Sem isso a
//   instância velha seguiria "viva", fora da tela.
// - Ao nascer, a instância começa do zero, consome o `?criar=post` e carrega. Na primeira carga, se o
//   `?pedido=`/`?item=` da URL não é desta conta, a URL é limpa.
// - Toda continuação assíncrona passa por `esperar`, que confere `vivo`. Instância morta termina em
//   SILÊNCIO: não desenha, não avisa, não mexe na URL; o que ficou nela some com ela.
//
// A instância mora numa diretiva assíncrona do lit (`AsyncDirective`), e não num elemento próprio: a
// moldura exige o `urbi-inbox` direto no body do `urbi-shell-page` (moldura.ts). `disconnected()` da
// diretiva faz o papel do `disconnectedCallback`.

/** A instância saiu do DOM: a continuação para aqui, em silêncio. */
export class InstanciaEncerrada extends Error {
  constructor() {
    super('instancia_encerrada');
    this.name = 'InstanciaEncerrada';
  }
}

/** "Não enviado": o formulário fechou sem resposta, ou o erro já foi mostrado. O redator devolve o texto. */
const CANCELADO = 'cancelado';
const cancelado = () => new Error(CANCELADO);
/** A regra do silêncio, num lugar só: instância encerrada ou operação cancelada não viram erro na tela. */
const silencioso = (e: unknown) => e instanceof InstanciaEncerrada || (e instanceof Error && e.message === CANCELADO);

/**
 * A conta em que o Estúdio trabalha: a escolhida no seletor (quem atende várias contas) ou a conta única
 * de escrita (`contaEscrita`: com uma conta só, o shell resolve sozinho e `contaAtiva()` é nula, porque
 * não há seletor nem `X-Conta`). O app só chama a tela com o contexto carregado e fora do "sem conta"
 * (`semConta()`); mas `semConta()` é falso quando o contexto já carregou sem o campo `conta`, e aí a
 * tela é chamada e a conta de trabalho é nula, de forma estável (não é uma janela passageira).
 */
const contaDeTrabalho = (): number | null => contaAtiva() ?? urbiVerso.contexto?.()?.conta?.contaEscrita ?? null;

const opcaoImovel = (i: Record<string, any>) => ({ valor: String(i.id), rotulo: `${i.codigo} · ${i.titulo ?? i.tipo}`, textoBusca: `${i.bairro ?? ''} ${i.cidade ?? ''}` });

function escolha() {
  const q = filtrosDaUrl();
  return { pedido: q.get('pedido'), item: q.get('item'), etapa: q.get('etapa') };
}

/** Mensagens do feed: o texto do corretor e uma mensagem do Estúdio por peça (id da mensagem = id da peça). */
export function mensagensDoPedido(x: Pedido<Peca>, eu: { id: number; nome?: string }): ChatMensagem[] {
  const pedido: ChatMensagem = {
    id: -x.id,
    autorId: eu.id,
    autorNome: 'Você',
    texto: x.texto?.trim() || `${ROTULO_OBJETIVO[x.objetivo as Objetivo] ?? x.objetivo}${x.pecas[0]?.imovel_codigo ? ` · ${x.pecas[0].imovel_codigo}` : ''}`,
    criadoEm: x.criado_em,
  };
  const pecas = x.pecas.map(
    (p): ChatMensagem => ({
      id: p.id,
      autorId: AUTOR_ESTUDIO,
      autorNome: 'Estúdio',
      autorIcone: 'fa-solid fa-wand-magic-sparkles',
      texto: [`${ROTULO_FORMATO[p.formato as Formato] ?? p.formato} · ${p.titulo ?? ''}`, p.legenda, p.hashtags].filter(Boolean).join('\n\n'),
      criadoEm: p.criado_em,
      anexos: ((p.arquivos ?? []) as Record<string, any>[]).filter((a) => a.url).map((a, i) => ({ id: a.id ?? i, nome: `${p.formato}-${i + 1}`, mime: 'image/jpeg', tamanho: 0, urlDownload: a.url })),
    }),
  );
  return [pedido, ...pecas];
}

/** Uma instância da tela do Estúdio. */
export class Estudio {
  /** Gancho de teste (o teste do Chromium guarda a instância viva); nulo no app. Não guarda estado. */
  static aoNascer: ((e: Estudio) => void) | null = null;

  /** A conta em que a instância nasceu (`contaDeTrabalho`); `null`: sem contexto de conta (o estado vazio da moldura). */
  private conta: number | null = null;
  /** Ligada entre `nascer` e `morrer` (a diretiva saiu do DOM). */
  private ligada = false;
  /** A chave do app quando a instância nasceu (`sub|conta|visita`). */
  private minhaChave: string | undefined;

  private pecas: Peca[] = [];
  private marca: Marca | null = null;
  private conexao: Conexao | null = null;
  /** Slot `conteudo` liberado (vem com a lista de peças); `null` antes da primeira carga. */
  private ia: boolean | null = null;
  private falha: unknown = null;
  /** Carga vigente: a resposta de uma carga que não é mais a última desta instância é descartada. */
  private geracao = 0;
  /** A primeira carga já conferiu se o `?pedido=`/`?item=` da URL é desta conta. */
  private escolhaConferida = false;
  /** "Novo post" do menu Criar (`?criar=post` ao nascer): abre o formulário depois da primeira carga. */
  private criarPost = false;
  private trabalhando: string | null = null;
  /** Peça com arte que abriu o "Trocar a arte" (a peça sem arte já mostra o envio). */
  private trocando: number | null = null;
  /** Peças com a descrição à vista, e a descrição já buscada de cada uma. */
  private abertas = new Set<number>();
  private instrucoes: Record<number, Instrucao> = {};
  /** Peça do `?item=` à qual o feed já rolou: rola uma vez por escolha, não a cada redesenho. */
  private rolada: number | null = null;

  constructor(
    public atualizar: () => void,
    /** A chave vigente do app (`frontend/index.ts`); sem app (teste de desenho), nenhuma. */
    private chaveVigente: () => string | undefined = () => undefined,
  ) {}

  /**
   * Viva: no DOM (entre `nascer` e `morrer`) e ainda a instância da página (a chave do app é a de quando
   * nasceu). Troca de conta, navegação ou volta ao Estúdio mudam a chave: a instância morre na hora, sem
   * esperar o redesenho. Nada aqui lê a conta: a identidade é a da instância.
   */
  get vivo(): boolean {
    return this.ligada && this.chaveVigente() === this.minhaChave;
  }

  nascer() {
    this.ligada = true;
    this.minhaChave = this.chaveVigente();
    this.conta = contaDeTrabalho();
    Estudio.aoNascer?.(this);
    if (this.conta === null) return;
    this.criarPost = pedidoDeCriar('post');
    // Fora do desenho em curso: a carga pede redesenho, e a diretiva está no meio de um.
    queueMicrotask(() => this.solto(this.carregar()));
  }

  morrer() {
    this.ligada = false;
  }

  /** Pede o redesenho ao app, só se viva. */
  private redesenhar() {
    if (this.vivo) this.atualizar();
  }

  /**
   * O ponto único: espera `passo` e só devolve o resultado (ou o erro) se a instância ainda está viva.
   * Se morreu no meio, lança `InstanciaEncerrada` e o resto da operação não roda.
   */
  async esperar<T>(passo: Promise<T>): Promise<T> {
    let r: T;
    try {
      r = await passo;
    } catch (e) {
      if (!this.vivo) throw new InstanciaEncerrada();
      throw e;
    }
    if (!this.vivo) throw new InstanciaEncerrada();
    return r;
  }

  /** Quem dispara e não espera (clique, menu): a operação encerrada ou cancelada termina em silêncio. */
  private solto(p: unknown): void {
    void Promise.resolve(p).catch((e) => {
      if (silencioso(e) || !this.vivo) return;
      console.error('[portal_corretor]', e);
    });
  }

  private solta = (a: Acao): Acao => (a.aoEscolher ? { ...a, aoEscolher: () => this.solto(a.aoEscolher!()) } : a);
  private soltas = (acoes: Acao[]) => acoes.map(this.solta);

  // ---------- Carga ----------

  private async carregar() {
    const minha = ++this.geracao;
    this.falha = null;
    this.redesenhar();
    try {
      const [p, m, c] = await this.esperar(
        Promise.all([
          chamarApi('/estudio/pecas'),
          chamarApi('/estudio/marca'),
          // Sem a conexão a tela segue (mostra "não conectado"): é contexto, não o conteúdo.
          chamarApi('/conexoes').catch(() => null),
        ]),
      );
      if (minha !== this.geracao) return;
      this.pecas = p.dados;
      this.ia = p.ia !== false;
      this.marca = m;
      this.conexao = c;
    } catch (e) {
      if (e instanceof InstanciaEncerrada) throw e;
      // Uma carga mais nova desta instância está em voo: ela é quem decide o que a tela mostra.
      if (minha !== this.geracao) return;
      this.falha = e;
      // Com dados na tela a falha vira faixa (o `estadoDaFalha` só roda sem dados): o detalhe vai ao console.
      if (this.marca) console.error('[portal_corretor]', e);
    }
    if (this.marca && !this.escolhaConferida) {
      this.escolhaConferida = true;
      this.limparEscolhaDeOutraConta();
    }
    this.redesenhar();
    if (this.criarPost && this.marca) {
      this.criarPost = false;
      // Cancelar o formulário é só fechar; outro erro aparece (instância encerrada: silêncio).
      this.novoPedido('').catch((e) => {
        if (silencioso(e) || !this.vivo) return;
        void urbiVerso.alertar({ titulo: 'Não foi possível abrir o pedido', mensagem: mensagemDeErro(e), tipo: 'erro' });
      });
    }
  }

  private recarregar = () => this.solto(this.carregar());

  /**
   * Ao nascer: o `?pedido=`/`?item=` que não acha nada nesta conta é de outra (ficou da conta anterior,
   * ou é um link de outra conta). A URL é limpa e a tela abre como numa entrada no Estúdio. `?etapa=` é
   * só o filtro das listas e fica.
   */
  private limparEscolhaDeOutraConta() {
    if (pedidoEscolhido(agruparPedidos(this.pecas), escolha()).naoEncontrado) filtrosNaUrl(filtrosDaUrl(), {}, ['pedido', 'item']);
  }

  // ---------- Endereço ----------

  private abrirPedido(id: number) {
    filtrosNaUrl(filtrosDaUrl(), { pedido: id }, ['item']);
    this.rolada = null;
    this.redesenhar();
  }

  private abrirPeca(id: number) {
    filtrosNaUrl(filtrosDaUrl(), { item: id }, ['pedido']);
    this.rolada = null;
    this.redesenhar();
  }

  private mudarEtapa(id: string) {
    filtrosNaUrl(filtrosDaUrl(), { etapa: id === 'todas' ? '' : id });
    this.redesenhar();
  }

  // ---------- Criar ----------

  private async imoveisAnunciaveis(): Promise<Record<string, any>[]> {
    const lista: Record<string, any>[] = [];
    for (const situacao of ['ativo', 'reservado']) {
      for (let pagina = 1; pagina <= 20; pagina++) {
        const r = await this.esperar(chamarApi(`/imoveis?situacao=${situacao}&pagina=${pagina}`));
        lista.push(...(r.dados ?? []));
        if (pagina >= (r.paginas ?? 1)) break;
      }
    }
    return lista;
  }

  /**
   * O pedido vem do urbi-redator (texto ou microfone). Só resolve quando o pedido foi criado: cancelar o
   * formulário ou falhar rejeita (o redator devolve o texto), e a instância encerrada rejeita em
   * silêncio. Nunca um sucesso falso.
   */
  async novoPedido(falado: string) {
    let imoveis: Record<string, any>[];
    try {
      imoveis = await this.imoveisAnunciaveis();
    } catch (e) {
      if (e instanceof InstanciaEncerrada) throw e;
      imoveis = [];
    }
    const campos: CampoFormulario[] = [
      { nome: 'pedido', tipo: 'texto_longo', rotulo: 'O que você quer?', valor: falado, placeholder: 'Ex.: post de lançamento desta casa e um story, tom sofisticado.' },
      { nome: 'imovel_id', tipo: 'selecao', rotulo: 'Imóvel', pesquisavel: true, valor: '', opcoes: [{ valor: '', rotulo: 'Sem imóvel (peça institucional)' }, ...imoveis.map(opcaoImovel)] },
      { nome: 'objetivo', tipo: 'selecao', rotulo: 'Objetivo', valor: 'novo_imovel', opcoes: OBJETIVOS.map((o) => ({ valor: o, rotulo: ROTULO_OBJETIVO[o] })) },
      ...FORMATOS.map((f): CampoFormulario => ({ nome: `f_${f}`, tipo: 'booleano', rotulo: ROTULO_FORMATO[f], valor: f === 'post_1x1' })),
    ];
    const v = await this.esperar(
      urbiVerso.formulario({
        titulo: 'Novo pedido',
        campos,
        mensagem: 'O app escreve os textos (com IA, quando liberada) e a descrição da arte para colar no Canva IA, com a sua marca. Você gera lá, envia a arte aqui e revisa antes de aprovar.',
        rotuloConfirmar: 'Criar',
      }),
    );
    if (!v) throw cancelado();
    const formatos = FORMATOS.filter((f) => v[`f_${f}`] === true);
    await this.criar('/estudio/pedido', { pedido: v.pedido, imovel_id: v.imovel_id ? Number(v.imovel_id) : null, objetivo: v.objetivo, formatos });
  }

  /** Criar rápido (2×2): sempre de um imóvel; Lançamento é o Pacote de lançamento. */
  private async criarRapido(id: string) {
    const atalho = CRIAR_RAPIDO.find((a) => a.id === id);
    if (!atalho || this.trabalhando) return;
    let imoveis: Record<string, any>[];
    try {
      imoveis = await this.imoveisAnunciaveis();
    } catch (e) {
      if (e instanceof InstanciaEncerrada) throw e;
      await this.esperar(urbiVerso.alertar({ titulo: 'Não foi possível carregar os imóveis', mensagem: mensagemDeErro(e), tipo: 'erro' }));
      return;
    }
    if (!imoveis.length) {
      await this.esperar(urbiVerso.alertar({ titulo: 'Nenhum imóvel anunciado', mensagem: `"${atalho.rotulo}" é para imóvel ativo ou reservado.`, tipo: 'alerta' }));
      return;
    }
    const v = await this.esperar(
      urbiVerso.formulario({
        titulo: atalho.formatos ? atalho.rotulo : 'Pacote de lançamento',
        mensagem: `Sai ${atalho.resumo}: os textos e uma descrição para o Canva IA de cada peça.`,
        campos: [
          { nome: 'imovel_id', tipo: 'selecao', rotulo: 'Imóvel', obrigatorio: true, pesquisavel: true, opcoes: imoveis.map(opcaoImovel) },
          { nome: 'pedido', tipo: 'texto_longo', rotulo: 'Algum pedido? (opcional)', placeholder: 'Ex.: destacar a varanda gourmet.' },
        ],
        rotuloConfirmar: 'Criar',
      }),
    );
    if (!v) return;
    if (!atalho.formatos) await this.criar('/estudio/pacote', { imovel_id: Number(v.imovel_id), pedido: v.pedido, objetivo: atalho.objetivo });
    else await this.criar('/estudio/pedido', { imovel_id: Number(v.imovel_id), pedido: v.pedido || atalho.rotulo, objetivo: atalho.objetivo, formatos: atalho.formatos });
  }

  /** Cria e abre o pedido novo. Falha: mostra o erro e rejeita com "cancelado" (o redator devolve o texto). */
  private async criar(rota: string, corpo: Record<string, unknown>) {
    this.trabalhando = 'Escrevendo os textos e a descrição…';
    this.redesenhar();
    let r: Record<string, any>;
    try {
      r = await this.esperar(enviar('POST', rota, corpo));
    } catch (e) {
      if (e instanceof InstanciaEncerrada) throw e;
      this.trabalhando = null;
      this.redesenhar();
      await this.esperar(urbiVerso.alertar({ titulo: 'Não foi possível criar', mensagem: mensagemDeErro(e), tipo: 'erro' }));
      throw cancelado();
    }
    const pecas = r.pecas as Peca[];
    const criadas = new Set(pecas.map((p) => p.id));
    this.trabalhando = null;
    urbiVerso.notificar(`${pecas.length} peça(s) criada(s)${r.ia ? '' : ' (textos pelo modelo: a IA não está liberada agora)'}. Copie a descrição, gere a arte no Canva e envie na peça.`, 'sucesso');
    // O pedido novo abre no centro, na etapa "Todas", com a descrição e as fotos à vista. O id do pedido
    // não é o da peça criada: um envio igual ao anterior em menos de 2 min junta as peças ao pedido dele
    // (`agruparPedidos`). As peças criadas entram na lista já, e a URL vai ao pedido que as contém.
    this.pecas = [...this.pecas.filter((p) => !criadas.has(p.id)), ...pecas];
    filtrosNaUrl(filtrosDaUrl(), { pedido: this.pedidoDasPecas(criadas) ?? Math.min(...criadas) }, ['item', 'etapa']);
    const urlGravada = location.search;
    for (const p of pecas) this.solto(this.abrirInstrucao(p.id));
    const antes = this.geracao;
    await this.carregar();
    // `carregar` pode voltar normalmente com a instância já encerrada: morta, termina aqui, em silêncio.
    if (!this.vivo) throw new InstanciaEncerrada();
    // A carga desta criação gravou a lista do servidor (nenhuma outra a passou na frente, e não falhou):
    // o pedido aberto é o que contém as peças criadas. O servidor pode ter separado os grupos (outra aba
    // criou uma peça entre as nossas), e então o pedido da URL, mesmo existindo, não as contém.
    // Se o usuário abriu outro pedido ou peça durante a carga, a URL mudou: a escolha dele fica.
    if (this.geracao !== antes + 1 || this.falha || location.search !== urlGravada) return;
    const deNovo = this.pedidoDasPecas(criadas);
    if (deNovo !== null && pedidoEscolhido(agruparPedidos(this.pecas), escolha()).pedido?.id !== deNovo) {
      filtrosNaUrl(filtrosDaUrl(), { pedido: deNovo }, ['item']);
      this.redesenhar();
    }
  }

  /** O id do pedido (agrupado) que contém as peças `ids`, ou `null`. */
  private pedidoDasPecas(ids: Set<number>): number | null {
    return agruparPedidos(this.pecas).find((x) => x.pecas.some((p) => ids.has(p.id)))?.id ?? null;
  }

  // ---------- A descrição (D-89 a D-91) ----------

  /**
   * Busca a descrição da peça e a deixa à vista (D-74, D-86). Por padrão é a do Canva, com todas as
   * referências da marca; "Usar outra ferramenta" troca a ferramenta e as referências.
   */
  private async abrirInstrucao(id: number, ferramenta: Ferramenta = 'canva', referencias?: number[]): Promise<Instrucao | null> {
    this.abertas = new Set(this.abertas).add(id);
    this.redesenhar();
    const guardada = this.instrucoes[id];
    if (guardada && guardada.ferramenta === ferramenta && !referencias) return guardada;
    const refs = referencias ?? (this.marca?.referencias ?? []).map((r) => r.id);
    let r: Instrucao;
    try {
      r = (await this.esperar(chamarApi(`/estudio/pecas/${id}/instrucao?ferramenta=${encodeURIComponent(ferramenta)}${refs.length ? `&referencias=${refs.join(',')}` : ''}`))) as Instrucao;
    } catch (e) {
      if (e instanceof InstanciaEncerrada) throw e;
      this.fecharInstrucao(id);
      await this.esperar(urbiVerso.alertar({ titulo: 'Não foi possível preparar a descrição', mensagem: mensagemDeErro(e), tipo: 'erro' }));
      return null;
    }
    this.instrucoes = { ...this.instrucoes, [id]: r };
    this.redesenhar();
    return r;
  }

  private fecharInstrucao(id: number) {
    const abertas = new Set(this.abertas);
    abertas.delete(id);
    this.abertas = abertas;
    this.redesenhar();
  }

  private alternarInstrucao(p: Peca) {
    if (this.abertas.has(p.id)) this.fecharInstrucao(p.id);
    else this.solto(this.abrirInstrucao(p.id, this.instrucoes[p.id]?.ferramenta));
  }

  private async copiarInstrucao(p: Peca) {
    const r = await this.abrirInstrucao(p.id, this.instrucoes[p.id]?.ferramenta);
    if (!r) return;
    let copiou = true;
    try {
      await this.esperar(navigator.clipboard.writeText(r.prompt));
    } catch (e) {
      if (e instanceof InstanciaEncerrada) throw e;
      copiou = false; // sem área de transferência
    }
    urbiVerso.notificar(copiou ? `Descrição copiada. ${r.onde}` : 'Copie a descrição que aparece na peça.', copiou ? 'sucesso' : 'info');
  }

  /** Usar outra ferramenta (D-86): Claude Design ou outra, e as referências que entram na descrição. */
  private async outraFerramenta(p: Peca) {
    const refs = this.marca?.referencias ?? [];
    const v = await this.esperar(
      urbiVerso.formulario({
        titulo: 'Usar outra ferramenta',
        mensagem: refs.length
          ? 'A descrição muda para a ferramenta escolhida. Marque as referências que entram (elas ficam em Ajustes › Conta e marca).'
          : 'A descrição muda para a ferramenta escolhida. Quer mandar referências (posts que você admira)? Envie em Ajustes › Conta e marca.',
        campos: [
          { nome: 'ferramenta', tipo: 'selecao', rotulo: 'Ferramenta', valor: this.instrucoes[p.id]?.ferramenta ?? 'canva', opcoes: FERRAMENTAS.map((f) => ({ valor: f, rotulo: FERRAMENTA[f].rotulo })) },
          ...refs.map((r, i): CampoFormulario => ({ nome: `r_${r.id}`, tipo: 'booleano', rotulo: `Referência ${i + 1}`, valor: true })),
        ],
        rotuloConfirmar: 'Preparar',
      }),
    );
    if (!v) return;
    await this.abrirInstrucao(p.id, v.ferramenta as Ferramenta, refs.filter((r) => v[`r_${r.id}`] === true).map((r) => r.id));
  }

  // ---------- Ações da peça ----------

  private async editar(p: Peca) {
    const v = await this.esperar(
      urbiVerso.formulario({
        titulo: 'Textos da peça',
        campos: [
          { nome: 'titulo', tipo: 'texto', rotulo: 'Título', obrigatorio: true, valor: p.titulo },
          { nome: 'chamada', tipo: 'texto', rotulo: 'Chamada', valor: p.chamada ?? '' },
          { nome: 'destaques', tipo: 'texto', rotulo: 'Destaques (separados por vírgula, até 4)', valor: (p.destaques ?? []).join(', ') },
          { nome: 'legenda', tipo: 'texto_longo', rotulo: 'Legenda', valor: p.legenda ?? '' },
          { nome: 'hashtags', tipo: 'texto', rotulo: 'Hashtags', valor: p.hashtags ?? '' },
        ],
        mensagem: 'Mudou o título, a chamada ou os destaques? A descrição muda junto: copie de novo e refaça a arte no Canva.',
      }),
    );
    if (!v) return;
    await this.acao(() => enviar('PATCH', `/estudio/pecas/${p.id}`, { ...v, destaques: String(v.destaques ?? '').split(',').map((d) => d.trim()).filter(Boolean) }), 'Textos salvos.');
    // A descrição leva os textos: a guardada fica velha.
    const anterior = this.instrucoes[p.id];
    const { [p.id]: _velha, ...resto } = this.instrucoes;
    this.instrucoes = resto;
    if (this.abertas.has(p.id)) this.solto(this.abrirInstrucao(p.id, anterior?.ferramenta, anterior?.referencias.map((x) => x.id)));
  }

  private async enviarArte(p: Peca, e: CustomEvent) {
    const arquivos = ((e.detail.arquivos as File[]) ?? []).slice(0, p.formato === 'carrossel' ? MAX_SLIDES : 1);
    if (!arquivos.length || this.trabalhando) return;
    // Trocar uma arte que já existe pede confirmação (o seletor também avisa quando um arquivo sai da lista).
    if (p.arquivos?.length) {
      const ok = await this.esperar(urbiVerso.confirmar({ titulo: 'Trocar a arte', mensagem: `A arte da peça passa a ser ${arquivos.length === 1 ? 'esta imagem' : `estas ${arquivos.length} imagens, nesta ordem`}.`, rotuloConfirmar: 'Trocar' }));
      if (!ok) return;
    }
    const ferramenta = this.instrucoes[p.id]?.ferramenta ?? 'canva';
    this.trabalhando = 'Enviando a arte…';
    this.redesenhar();
    const uploads: number[] = [];
    try {
      for (const f of arquivos) uploads.push(await this.esperar(subirArquivo('peca_arquivos', 'arquivo', f)));
      await this.esperar(enviar('PUT', `/estudio/pecas/${p.id}/arquivos`, { upload_ids: uploads, motor: ferramenta === 'canva' ? 'canva_ia' : 'upload' }));
    } catch (err) {
      if (err instanceof InstanciaEncerrada) throw err;
      this.trabalhando = null;
      this.redesenhar();
      await this.esperar(urbiVerso.alertar({ titulo: 'Não foi possível enviar', mensagem: mensagemDeErro(err), tipo: 'erro' }));
      await this.carregar();
      return;
    }
    this.trabalhando = null;
    this.trocando = null;
    this.fecharInstrucao(p.id);
    urbiVerso.notificar(p.formato === 'carrossel' && uploads.length === 1 ? 'Arte enviada. O carrossel precisa de pelo menos 2 imagens: envie todas juntas.' : 'Arte enviada. Revise e aprove.', 'sucesso');
    await this.carregar();
  }

  private async acao(fn: () => Promise<unknown>, sucesso: string) {
    let r: { avisos?: string[] } | undefined;
    try {
      r = (await this.esperar(fn())) as { avisos?: string[] } | undefined;
    } catch (e) {
      if (e instanceof InstanciaEncerrada) throw e;
      await this.esperar(urbiVerso.alertar({ titulo: 'Não foi possível concluir', mensagem: mensagemDeErro(e), tipo: 'erro' }));
      throw cancelado();
    }
    urbiVerso.notificar([sucesso, ...(r?.avisos ?? [])].join(' '), r?.avisos?.length ? 'info' : 'sucesso');
    await this.carregar();
  }

  private async agendar(p: Peca) {
    const amanha = new Date(Date.now() + 86400e3).toLocaleDateString('sv-SE');
    const v = await this.esperar(
      urbiVerso.formulario({
        titulo: 'Agendar no Instagram',
        mensagem: 'Na hora marcada o app confere a peça de novo e publica na sua conta conectada.',
        campos: [
          { nome: 'dia', tipo: 'data', rotulo: 'Dia', obrigatorio: true, valor: amanha },
          { nome: 'hora', tipo: 'texto', rotulo: 'Hora (HH:MM)', obrigatorio: true, valor: '09:00' },
        ],
        rotuloConfirmar: 'Agendar',
      }),
    );
    if (!v) return;
    await this.acao(() => enviar('POST', `/estudio/pecas/${p.id}/agendar`, { quando: juntarDataHora(v.dia, v.hora) }), 'Peça agendada.');
  }

  /** Publicar: agora, agendar ou baixar para publicar pelo Instagram (e marcar "Publiquei por fora"). */
  private async publicarOpcoes(p: Peca) {
    const opcoes = [
      { valor: 'agora', rotulo: 'Publicar agora no Instagram' },
      { valor: 'agendar', rotulo: 'Agendar' },
      { valor: 'baixar', rotulo: 'Baixar a arte e a legenda (publico eu)' },
    ];
    const v = await this.esperar(
      urbiVerso.formulario({
        titulo: 'Publicar',
        mensagem: p.formato === 'story' ? 'O story sai sem legenda: confira se o CRECI está na arte.' : undefined,
        campos: [{ nome: 'como', tipo: 'selecao', rotulo: 'Como', obrigatorio: true, valor: opcoes[0].valor, opcoes }],
        rotuloConfirmar: 'Continuar',
      }),
    );
    if (!v) return;
    if (v.como === 'agora') await this.publicar(p);
    else if (v.como === 'agendar') await this.agendar(p);
    else await this.baixar(p);
  }

  /** Abre cada imagem numa aba, para ver e salvar. */
  private verArte(p: Peca) {
    for (const a of (p.arquivos ?? []) as Record<string, any>[]) if (a.url) window.open(a.url, '_blank', 'noopener');
  }

  /** Baixar para publicar: as imagens e a legenda copiada. */
  private async baixar(p: Peca) {
    this.verArte(p);
    await this.copiarLegenda(p);
    urbiVerso.notificar('Publicou pelo Instagram? Use "Publiquei por fora" no Mais.', 'info');
  }

  private async publicar(p: Peca) {
    const ok = await this.esperar(urbiVerso.confirmar({ titulo: 'Publicar agora', mensagem: 'A peça vai para o Instagram conectado. A API do Instagram não apaga publicações depois.', rotuloConfirmar: 'Publicar' }));
    if (!ok) return;
    this.trabalhando = 'Publicando no Instagram…';
    this.redesenhar();
    try {
      await this.esperar(enviar('POST', `/estudio/pecas/${p.id}/publicar`));
      this.trabalhando = null;
      urbiVerso.notificar('Publicada no Instagram.', 'sucesso');
    } catch (e) {
      if (e instanceof InstanciaEncerrada) throw e;
      this.trabalhando = null;
      this.redesenhar();
      await this.esperar(urbiVerso.alertar({ titulo: 'Não foi publicada', mensagem: mensagemDeErro(e), tipo: 'erro' }));
    }
    await this.carregar();
  }

  private async publiqueiFora(p: Peca) {
    const v = await this.esperar(
      urbiVerso.formulario({
        titulo: 'Publiquei por fora',
        mensagem: 'Publicou pelo Instagram ou pelo Meta Business Suite? Registre aqui para o Estúdio saber.',
        campos: [{ nome: 'link', tipo: 'texto', rotulo: 'Link do post (opcional)', placeholder: 'https://www.instagram.com/p/…' }],
        rotuloConfirmar: 'Registrar',
      }),
    );
    if (v) await this.acao(() => enviar('POST', `/estudio/pecas/${p.id}/publicada-fora`, { link: v.link }), 'Registrado como publicado.');
  }

  private async remover(p: Peca) {
    const ok = await this.esperar(urbiVerso.confirmar({ titulo: 'Remover peça', mensagem: 'A peça sai do Estúdio.', rotuloConfirmar: 'Remover', perigo: true }));
    if (!ok) return;
    await this.acao(async () => {
      const r = await this.esperar(enviar('PATCH', `/estudio/pecas/${p.id}/remover`));
      // Instância viva (o `esperar` acima lança se não): o pedido aberto segue sem a peça.
      this.seguirSemPeca(p.id);
      return r;
    }, 'Peça removida.');
  }

  /**
   * Depois de remover uma peça: o id do pedido é o da sua peça de menor id, então tirar a primeira (ou a
   * do `?item=`) faria o endereço apontar para o nada. Se sobram peças do pedido aberto, a URL passa ao
   * pedido delas; se não sobra nada, volta a "nenhum pedido escolhido". Nunca "Não encontrado".
   */
  private seguirSemPeca(id: number) {
    const aberto = pedidoEscolhido(agruparPedidos(this.pecas), escolha()).pedido;
    this.pecas = this.pecas.filter((x) => x.id !== id);
    if (!aberto || !aberto.pecas.some((x) => x.id === id)) return;
    const resto = aberto.pecas.find((x) => x.id !== id);
    const novo = resto ? agruparPedidos(this.pecas).find((x) => x.pecas.some((y) => y.id === resto.id)) : null;
    if (novo) filtrosNaUrl(filtrosDaUrl(), { pedido: novo.id }, ['item']);
    else filtrosNaUrl(filtrosDaUrl(), {}, ['pedido', 'item']);
  }

  private async copiarLegenda(p: Peca) {
    const texto = [p.legenda, p.hashtags].filter(Boolean).join('\n\n');
    try {
      await this.esperar(navigator.clipboard.writeText(texto));
    } catch (e) {
      if (e instanceof InstanciaEncerrada) throw e;
      await this.esperar(urbiVerso.alertar({ titulo: 'Legenda', mensagem: texto }));
      return;
    }
    urbiVerso.notificar('Legenda copiada.', 'sucesso');
  }

  private aprovar = (p: Peca) => this.acao(() => enviar('POST', `/estudio/pecas/${p.id}/aprovar`), 'Peça aprovada.');

  /** A ação principal de cada estado (a de "falta a arte" é a área de envio, desenhada à parte). */
  private acaoDe(nome: Exclude<AcaoPrincipal, 'enviar_arte'>, p: Peca): Acao {
    switch (nome) {
      case 'aprovar':
        return { rotulo: 'Aprovar', icone: 'fa-solid fa-check', aoEscolher: () => this.aprovar(p) };
      case 'publicar':
        return { rotulo: 'Publicar', icone: 'fa-brands fa-instagram', aoEscolher: () => this.publicarOpcoes(p) };
      case 'tentar_de_novo':
        return { rotulo: 'Tentar de novo', icone: 'fa-solid fa-rotate-right', aoEscolher: () => this.publicarOpcoes(p) };
      case 'cancelar_agendamento':
        return { rotulo: 'Cancelar agendamento', icone: 'fa-solid fa-calendar-xmark', aoEscolher: () => this.acao(() => enviar('POST', `/estudio/pecas/${p.id}/cancelar-agendamento`), 'Agendamento cancelado.') };
      case 'destravar':
        return { rotulo: 'Destravar', icone: 'fa-solid fa-unlock', aoEscolher: () => this.acao(() => enviar('POST', `/estudio/pecas/${p.id}/destravar`), 'Peça destravada: confira no Instagram.') };
      case 'ver_no_instagram':
        return { rotulo: 'Ver no Instagram', icone: 'fa-solid fa-arrow-up-right-from-square', aoEscolher: () => window.open(p.permalink!, '_blank', 'noopener') };
      case 'copiar_legenda':
        return { rotulo: 'Copiar legenda', icone: 'fa-solid fa-copy', aoEscolher: () => this.copiarLegenda(p) };
    }
  }

  /** O "Mais" da peça, pelo estado (D-86). */
  private maisDe(p: Peca, principal: AcaoPrincipal): Acao[] {
    const travada = TRAVADA.includes(p.estado);
    const mais: Acao[] = [];
    if ((p.arquivos ?? []).length) mais.push({ rotulo: p.arquivos!.length > 1 ? 'Ver as artes' : 'Ver a arte', icone: 'fa-solid fa-image', aoEscolher: () => this.verArte(p) });
    if (!travada) {
      mais.push({ rotulo: 'Textos', icone: 'fa-solid fa-pen', aoEscolher: () => this.editar(p) });
      if (!semArte(p)) {
        mais.push(
          { rotulo: this.abertas.has(p.id) ? 'Esconder a descrição' : 'Ver a descrição', icone: 'fa-solid fa-wand-magic-sparkles', aoEscolher: () => this.alternarInstrucao(p) },
          { rotulo: 'Trocar a arte', icone: 'fa-solid fa-upload', aoEscolher: () => ((this.trocando = p.id), this.redesenhar()) },
        );
      }
      mais.push({ rotulo: 'Usar outra ferramenta', icone: 'fa-solid fa-shuffle', aoEscolher: () => this.outraFerramenta(p) });
    }
    if (p.estado === 'aprovada' || (p.estado === 'erro' && p.aprovada_em)) mais.push({ rotulo: 'Voltar a rascunho', icone: 'fa-solid fa-arrow-rotate-left', aoEscolher: () => this.acao(() => enviar('POST', `/estudio/pecas/${p.id}/rejeitar`), 'Peça de volta a rascunho.') });
    if (['aprovada', 'agendada', 'publicando', 'erro'].includes(p.estado)) mais.push({ rotulo: 'Publiquei por fora', icone: 'fa-solid fa-check-double', aoEscolher: () => this.publiqueiFora(p) });
    if (principal !== 'copiar_legenda') mais.push({ rotulo: 'Copiar legenda', icone: 'fa-solid fa-copy', aoEscolher: () => this.copiarLegenda(p) });
    if (!travada) mais.push({ rotulo: 'Remover', icone: 'fa-solid fa-trash', perigo: true, aoEscolher: () => this.remover(p) });
    return mais;
  }

  /** Só o "Mais" (o mesmo de `acoesComMais`), para a peça sem arte, cujo principal é a área de envio. */
  private soMais(acoes: Acao[]): TemplateResult {
    return html`<urbi-dropdown flutuante>
      <urbi-botao slot="trigger" variante="secundario" icone="fa-solid fa-ellipsis">Mais</urbi-botao>
      <div slot="menu">
        ${acoes.map((a) => html`<urbi-dropdown-item icone=${a.icone ?? nothing} ?perigo=${!!a.perigo} @urbi:dropdown-select=${() => a.aoEscolher?.()}>${a.rotulo}</urbi-dropdown-item>`)}
      </div>
    </urbi-dropdown>`;
  }

  /** Envio da arte: o principal (grande, com área de arrastar) na peça sem arte; secundário para trocar. */
  private seletorArte(p: Peca, primeira: boolean) {
    const carrossel = p.formato === 'carrossel';
    const nome = FERRAMENTA[this.instrucoes[p.id]?.ferramenta ?? 'canva'].rotulo;
    return html`<urbi-seletor-arquivo
      accept="image/jpeg,image/png"
      ?multiplo=${carrossel}
      ?drop=${primeira}
      ?desabilitado=${!!this.trabalhando}
      variante=${primeira ? 'primario' : 'secundario'}
      icone="fa-solid fa-upload"
      texto=${primeira ? `Enviar a arte ${carrossel ? '(as imagens) ' : ''}do ${nome}` : 'Escolher a nova arte'}
      dica=${carrossel ? `Arraste aqui as imagens baixadas, todas juntas e na ordem dos slides (de 2 a ${MAX_SLIDES}, JPG ou PNG)` : 'Arraste aqui a imagem baixada (JPG ou PNG)'}
      @urbi:seletor-arquivo-change=${(e: CustomEvent) => this.solto(this.enviarArte(p, e))}
    ></urbi-seletor-arquivo>`;
  }

  /** A descrição e os anexos (fotos e logo), à vista na peça. */
  private instrucao(p: Peca) {
    const r = this.instrucoes[p.id];
    if (!r) return html`<urbi-loading></urbi-loading>`;
    const anexos = r.fotos.length || r.logo_url;
    return html`<urbi-stack>
      <urbi-prosa papel="secao">Descrição para o ${FERRAMENTA[r.ferramenta].rotulo}</urbi-prosa>
      <urbi-prosa pre>${r.prompt}</urbi-prosa>
      <urbi-prosa papel="secundario">${anexos ? 'Para anexar (abra e baixe):' : 'Sem fotos públicas do imóvel: anexe as suas na ferramenta, se quiser.'}</urbi-prosa>
      ${anexos
        ? html`<urbi-linha quebrar>
            ${r.fotos.map((f, i) => html`<urbi-visualizador-arquivo pequeno variante="secundario" rotulo=${`Foto ${i + 1}`} url=${f.url} nome=${`${p.imovel_codigo ?? 'foto'}-${i + 1}.jpg`} mime="image/jpeg"></urbi-visualizador-arquivo>`)}
            ${r.logo_url ? html`<urbi-visualizador-arquivo pequeno variante="secundario" rotulo="Logo" url=${r.logo_url} nome="logo.png" mime="image/png"></urbi-visualizador-arquivo>` : nothing}
          </urbi-linha>`
        : nothing}
    </urbi-stack>`;
  }

  /**
   * O cartão da peça, no rodapé da mensagem do Estúdio: situação, próximo passo, UMA ação principal
   * (D-86) e o "Mais". Sem arte, a principal é a área de envio; Copiar descrição e Abrir no Canva vão
   * como secundários ao lado.
   */
  cartaoPeca(p: Peca): TemplateResult {
    const e = ESTADO[p.estado] ?? ESTADO.rascunho;
    const travada = TRAVADA.includes(p.estado);
    const falta = semArte(p) && !travada;
    const aberta = this.abertas.has(p.id);
    const r = this.instrucoes[p.id];
    const ferramenta = FERRAMENTA[r?.ferramenta ?? 'canva'];
    const abrir = r ? r.abrir : FERRAMENTA.canva.abrir;
    const principal = acaoPrincipal(p);
    const passo = proximoPasso(p, ferramenta.rotulo);
    const publicandoHa = p.estado === 'publicando' ? Date.now() - new Date(p.atualizado_em ?? p.criado_em).getTime() : 0;
    return html`<urbi-stack>
      <urbi-linha quebrar>
        ${falta ? html`<urbi-badge cor="alerta">falta a arte</urbi-badge>` : html`<urbi-badge cor=${e.cor}>${e.rotulo}</urbi-badge>`}
        <urbi-prosa papel="fraco">${ROTULO_FORMATO[p.formato as Formato] ?? p.formato} · ${ROTULO_OBJETIVO[p.objetivo as Objetivo] ?? p.objetivo}${semArte(p) ? '' : ` · ${MOTOR[p.motor] ?? p.motor}`}</urbi-prosa>
      </urbi-linha>
      ${p.estado === 'agendada' ? html`<urbi-prosa papel="secundario">Agendada para ${dataHora(p.agendada_para)}</urbi-prosa>` : nothing}
      ${p.estado === 'publicada' ? html`<urbi-prosa papel="secundario">Publicada em ${dataHora(p.publicada_em)}${p.publicada_por === 'fora' ? ' (por fora)' : ''}</urbi-prosa>` : nothing}
      ${p.estado === 'publicando' && publicandoHa < QUINZE_MIN ? html`<urbi-prosa papel="dica">Publicando. Se passar de 15 minutos assim, use "Destravar".</urbi-prosa>` : nothing}
      ${p.estado === 'erro' && p.erro ? html`<urbi-prosa papel="secundario">${p.erro}</urbi-prosa>` : nothing}
      ${passo ? html`<urbi-prosa papel="dica">${passo}</urbi-prosa>` : nothing}
      ${principal === 'enviar_arte'
        ? html`<urbi-linha quebrar>
            <urbi-botao variante="secundario" icone="fa-solid fa-copy" @click=${() => this.solto(this.copiarInstrucao(p))}>Copiar descrição</urbi-botao>
            ${abrir ? html`<urbi-botao variante="secundario" icone="fa-solid fa-arrow-up-right-from-square" @click=${() => window.open(abrir, '_blank', 'noopener')}>Abrir no ${ferramenta.rotulo}</urbi-botao>` : nothing}
            <urbi-botao variante="fantasma" icone=${aberta ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down'} @click=${() => this.alternarInstrucao(p)}>${aberta ? 'Esconder descrição e fotos' : 'Ver descrição e fotos'}</urbi-botao>
            ${this.soMais(this.soltas(this.maisDe(p, principal)))}
          </urbi-linha>
          ${aberta ? this.instrucao(p) : nothing}
          ${this.seletorArte(p, true)}`
        : html`${acoesComMais(this.solta(this.acaoDe(principal, p)), this.soltas(this.maisDe(p, principal)))}
          ${aberta && !travada ? this.instrucao(p) : nothing}
          ${this.trocando === p.id && !travada
            ? html`<urbi-linha quebrar>
                ${this.seletorArte(p, false)}
                <urbi-botao pequeno variante="fantasma" @click=${() => ((this.trocando = null), this.redesenhar())}>Fechar</urbi-botao>
              </urbi-linha>`
            : nothing}`}
    </urbi-stack>`;
  }

  // ---------- O pedido como conversa ----------

  private conversa(x: Pedido<Peca>, peca: number | null) {
    const eu = urbiVerso.usuario() ?? { id: 0 };
    const porId = new Map(x.pecas.map((p) => [p.id, p]));
    return html`<urbi-feed slot="centro" expandir usuario-atual-id=${eu.id} agrupar-minutos="0"
      .itens=${mensagensDoPedido(x, eu)}
      .renderRodape=${(m: ChatMensagem) => (porId.has(m.id) ? this.cartaoPeca(porId.get(m.id)!) : nothing)}
      ${ref((el) => this.rolarAte(el, peca))}></urbi-feed>`;
  }

  /** `?item=`: o feed rola até a peça depois de desenhar (o `rolarPara` resolve `false` se ela não está). */
  private rolarAte(el: Element | undefined, peca: number | null) {
    if (!el || !peca || this.rolada === peca) return;
    this.rolada = peca;
    const feed = el as unknown as { rolarPara?: (id: number) => Promise<boolean>; updateComplete?: Promise<unknown> };
    void Promise.resolve(feed.updateComplete).then(() => this.vivo && feed.rolarPara?.(peca));
  }

  /**
   * O redator é da instância: o envio que termina depois de ela morrer rejeita em silêncio
   * (`InstanciaEncerrada`), e o texto que o redator devolve fica nele, fora da tela.
   */
  private compositor() {
    return html`<urbi-redator
      audio
      chave-audio="portal_corretor:estudio-pedido"
      ?upload-em-andamento=${!!this.trabalhando}
      placeholder="Escreva ou fale o pedido. Ex.: post de lançamento da casa do Lago Sul e um story, tom sofisticado."
      .aoEnviar=${(d: { texto: string }) => this.novoPedido(d.texto)}
    ></urbi-redator>`;
  }

  // ---------- Colunas ----------

  private instagram(): { conectado: boolean; texto: string } {
    const ig = this.conexao?.instagram;
    if (ig && !ig.ultimo_erro) return { conectado: true, texto: `@${ig.usuario} conectado` };
    if (ig) return { conectado: false, texto: `@${ig.usuario}: reconecte o Instagram` };
    return { conectado: false, texto: 'Instagram não conectado' };
  }

  private esquerda(pedidos: Pedido<Peca>[], aberto: number | null) {
    const etapa = etapaValida(escolha().etapa);
    const visiveis = pedidosNaEtapa(pedidos, etapa.id);
    const ig = this.instagram();
    return html`<urbi-stack>
      <urbi-stack>
        <urbi-prosa papel="titulo">Estúdio</urbi-prosa>
        <urbi-linha>${ig.conectado ? html`<urbi-icone icone="instagram" familia="brands"></urbi-icone>` : nothing}<urbi-prosa papel=${ig.conectado ? 'fraco' : 'secundario'}>${ig.texto}</urbi-prosa></urbi-linha>
      </urbi-stack>
      <urbi-prosa papel="secao">Criar rápido</urbi-prosa>
      <urbi-grid min="140px">
        ${CRIAR_RAPIDO.map(
          (a) => html`<urbi-botao variante="secundario" icone=${a.icone} title=${a.resumo} ?desabilitado=${!!this.trabalhando} @click=${() => this.solto(this.criarRapido(a.id))}>${a.rotulo}</urbi-botao>`,
        )}
      </urbi-grid>
      ${this.trabalhando ? html`<urbi-prosa papel="secundario">${this.trabalhando}</urbi-prosa>` : nothing}
      <urbi-prosa papel="secao">Seus pedidos</urbi-prosa>
      ${pedidos.length
        ? html`<urbi-linha quebrar>
            ${ETAPAS.map((e) => {
              const n = this.pecas.filter(e.casa).length;
              return e.id === 'todas' || n || etapa.id === e.id
                ? html`<urbi-badge interativo cor=${e.cor} ?ativo=${etapa.id === e.id} @click=${() => this.mudarEtapa(e.id)}>${e.rotulo} · ${n}</urbi-badge>`
                : nothing;
            })}
          </urbi-linha>`
        : nothing}
      ${visiveis.length
        ? html`<urbi-lista separador clicavel .itens=${visiveis} .itemAtivo=${(x: Pedido) => x.id === aberto}
            .render_item=${(x: Pedido<Peca>) => html`<urbi-stack>
              <urbi-linha justificar="entre">
                <urbi-prosa>${tituloPedido(x, x.pecas[0]?.imovel_codigo)}</urbi-prosa>
                ${x.id === aberto ? html`<urbi-badge cor="info">aberto</urbi-badge>` : nothing}
              </urbi-linha>
              <urbi-prosa papel="fraco">${resumoPedido(x)} · ${dataHora(x.criado_em)}</urbi-prosa>
            </urbi-stack>`}
            @urbi:lista-click=${(e: CustomEvent) => this.abrirPedido((e.detail.item as Pedido).id)}></urbi-lista>`
        : pedidos.length
          ? html`<urbi-prosa papel="dica">Nenhum pedido nesta etapa. Escolha outra acima.</urbi-prosa>`
          : html`<urbi-prosa papel="dica">Nenhum pedido ainda. Use o Criar rápido ou escreva o pedido no centro.</urbi-prosa>`}
    </urbi-stack>`;
  }

  /**
   * Com pedido aberto o centro é o par feed + redator no `slot="centro"` do `urbi-3-colunas`: o feed
   * `expandir` é filho direto (o fill só se mantém aí), as faixas de estado e o redator vão em
   * `urbi-hospedeiro` do mesmo slot (`centroSolto` na moldura). Sem pedido aberto o centro é um bloco só.
   */
  private centro(pedidos: Pedido<Peca>[]): { solto: boolean; conteudo: unknown } {
    const { pedido, peca, naoEncontrado } = pedidoEscolhido(pedidos, escolha());
    const ig = this.conexao?.instagram;
    const temFaixa = !!this.falha || this.ia === false || !ig || !!ig.ultimo_erro;
    const faixas = html`${this.falha
        ? estadoTela('erro', {
            mensagem: 'Não foi possível atualizar o Estúdio agora. O que está na tela pode estar desatualizado.',
            aoTentar: this.recarregar,
          })
        : nothing}
      ${this.ia === false
        ? estadoTela('ia_indisponivel', { mensagem: `${DICA_IA_INDISPONIVEL}: os textos saem do modelo do app. A descrição da arte e o resto do Estúdio funcionam.` })
        : nothing}
      ${!ig || ig.ultimo_erro
        ? estadoTela('desconectada', {
            integracao: 'Instagram',
            mensagem: ig ? 'Seu Instagram desconectou: publicar e agendar pelo app voltam depois de reconectar. Baixar e publicar você continua valendo.' : 'Instagram não conectado: para publicar e agendar pelo app, conecte. Baixar e publicar você funciona sem ele.',
          })
        : nothing}`;
    if (pedido) {
      // As faixas aparecem com o pedido aberto (a falha de recarga precisa ser vista); sem faixa, nem o
      // hospedeiro delas, que deixaria um vão acima do feed.
      return {
        solto: true,
        conteudo: html`${temFaixa ? html`<urbi-hospedeiro slot="centro">${faixas}</urbi-hospedeiro>` : nothing}${this.conversa(pedido, peca)}<urbi-hospedeiro slot="centro">${this.compositor()}</urbi-hospedeiro>`,
      };
    }
    let corpo: unknown;
    if (naoEncontrado) corpo = estadoTela('sem_permissao');
    else if (pedidos.length) corpo = estadoTela('vazio', { icone: 'fa-solid fa-wand-magic-sparkles', mensagem: 'Escolha um pedido na lista', submensagem: 'Ou escreva um novo abaixo: o app escreve os textos e a descrição da arte para o Canva IA.' });
    else corpo = estadoTela('vazio', { icone: 'fa-solid fa-images', mensagem: 'Nenhum pedido ainda', submensagem: 'Escreva ou fale o pedido abaixo: o app escreve a descrição para você levar ao Canva.' });
    return { solto: false, conteudo: html`${faixas}${corpo}${this.compositor()}` };
  }

  private direita() {
    const { agendadas, publicadas } = estaSemana(this.pecas);
    const m = this.marca;
    const linhaSemana = (p: Peca, quando: string | null | undefined) => html`<urbi-linha justificar="entre">
      <urbi-stack>
        <urbi-prosa>${ROTULO_FORMATO[p.formato as Formato] ?? p.formato} · ${p.titulo ?? ''}</urbi-prosa>
        <urbi-prosa papel="fraco">${dataHora(quando)}</urbi-prosa>
      </urbi-stack>
      <urbi-botao pequeno variante="fantasma" icone="fa-solid fa-arrow-right" @click=${() => this.abrirPeca(p.id)}>Abrir</urbi-botao>
    </urbi-linha>`;
    const arquivos = [
      ...(m?.logo_url ? [{ rotulo: 'Logo', url: m.logo_url, nome: 'logo.png', mime: 'image/png' }] : []),
      ...(m?.foto_url ? [{ rotulo: 'Sua foto', url: m.foto_url, nome: 'foto.jpg', mime: 'image/jpeg' }] : []),
      ...(m?.referencias ?? []).map((r, i) => ({ rotulo: `Referência ${i + 1}`, url: r.url, nome: `referencia-${i + 1}.jpg`, mime: 'image/jpeg' })),
    ];
    return html`<urbi-stack>
      <urbi-card titulo="Esta semana" icone="fa-solid fa-calendar-week">
        <urbi-stack>
          <urbi-prosa papel="secao">Agendadas · ${agendadas.length}</urbi-prosa>
          ${agendadas.length ? agendadas.map((p) => linhaSemana(p, p.agendada_para)) : html`<urbi-prosa papel="dica">Nada agendado de ontem até daqui a 7 dias.</urbi-prosa>`}
          <urbi-prosa papel="secao">Publicadas · ${publicadas.length}</urbi-prosa>
          ${publicadas.length ? publicadas.map((p) => linhaSemana(p, p.publicada_em)) : html`<urbi-prosa papel="dica">Nada publicado nos últimos 7 dias.</urbi-prosa>`}
        </urbi-stack>
      </urbi-card>
      <urbi-card titulo="Biblioteca" icone="fa-solid fa-folder-open">
        <urbi-stack>
          ${arquivos.length
            ? html`<urbi-linha quebrar>
                ${arquivos.map((a) => html`<urbi-visualizador-arquivo pequeno variante="secundario" rotulo=${a.rotulo} url=${a.url} nome=${a.nome} mime=${a.mime}></urbi-visualizador-arquivo>`)}
              </urbi-linha>
              <urbi-prosa papel="dica">Abra para ver e baixar. Leve ao Canva junto com a descrição.</urbi-prosa>`
            : html`<urbi-prosa papel="dica">Sem logo, foto ou referências ainda.</urbi-prosa>`}
          <urbi-linha><urbi-botao pequeno variante="fantasma" icone="fa-solid fa-palette" href=${urbiVerso.href('/ajustes/marca')}>Sua marca (logo, cores, estilo)</urbi-botao></urbi-linha>
        </urbi-stack>
      </urbi-card>
      ${m && !m.creci ? avisoCreci() : nothing}
    </urbi-stack>`;
  }

  /** O Estúdio na moldura: trilho · pedidos · conversa · contexto (abas no celular). */
  desenhar(): TemplateResult {
    // Sem conta ativa não há o que mostrar: o estado vazio padrão, sem nada herdado.
    if (this.conta === null) {
      return moldura(
        { menu: '/estudio', centro: estadoTela('vazio', { icone: 'fa-solid fa-building-user', mensagem: 'Nenhuma conta ativa', submensagem: 'O Estúdio trabalha dentro de uma conta. Recarregue a página; se continuar assim, fale com quem cuida das contas.' }) },
        this.atualizar,
      );
    }
    if (!this.marca) {
      const conteudo = this.falha ? estadoDaFalha(this.falha, this.recarregar) : estadoTela('carregando');
      return moldura({ menu: '/estudio', centro: conteudo }, this.atualizar);
    }
    const pedidos = agruparPedidos(this.pecas);
    const { pedido, naoEncontrado } = pedidoEscolhido(pedidos, escolha());
    const c = this.centro(pedidos);
    return moldura(
      {
        menu: '/estudio',
        lista: this.esquerda(pedidos, pedido?.id ?? null),
        centro: c.conteudo,
        centroSolto: c.solto,
        contexto: this.direita(),
        rotulos: { lista: 'Pedidos', centro: 'Pedido', contexto: 'Semana' },
        // Id na URL que não acha pedido: o "Não encontrado" está no centro, e o celular abre nele.
        painel: pedido || naoEncontrado ? 'centro' : 'esquerda',
      },
      this.atualizar,
    );
  }
}

/** Dona de UMA instância: nasce com a parte, morre quando a parte sai do DOM. */
class DiretivaEstudio extends AsyncDirective {
  private instancia: Estudio | null = null;
  private atualizar: () => void = () => {};
  private chave: () => string | undefined = () => undefined;

  render(atualizar: () => void, chave?: () => string) {
    this.atualizar = atualizar;
    if (chave) this.chave = chave;
    if (!this.instancia) {
      this.instancia = new Estudio(atualizar, this.chave);
      this.instancia.nascer();
    }
    this.instancia.atualizar = atualizar;
    return this.instancia.desenhar();
  }

  protected disconnected() {
    this.instancia?.morrer();
    this.instancia = null;
  }

  /** De volta ao DOM (o app saiu e voltou sem redesenhar): é uma instância nova, do zero. */
  protected reconnected() {
    this.instancia = new Estudio(this.atualizar, this.chave);
    this.instancia.nascer();
    this.setValue(this.instancia.desenhar());
  }
}

const estudio = directive(DiretivaEstudio);

/**
 * A tela do Estúdio. `chave` lê a chave vigente do app (`sub|conta|visita`). O `html` em volta dá à
 * diretiva uma parte própria, que o `keyed` do app troca inteira na chave nova (e a instância nova nasce).
 */
export function renderEstudio(atualizar: () => void, chave?: () => string) {
  return html`${estudio(atualizar, chave)}`;
}
