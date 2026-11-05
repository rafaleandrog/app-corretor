import { html, nothing, type TemplateResult } from 'lit';
import { keyed } from 'lit/directives/keyed.js';
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
// `?item=<id>` (uma peça); a etapa em `?etapa=`. Os dados ficam fora do componente, como em Hoje: as
// três colunas leem o mesmo estado e o app pede o redesenho.
const estado = {
  pecas: [] as Peca[],
  marca: null as Marca | null,
  conexao: null as Conexao | null,
  /** Slot `conteudo` liberado (vem com a lista de peças); `null` antes da primeira carga. */
  ia: null as boolean | null,
  falha: null as unknown,
  carregando: false,
  /** Conta dona dos dados; outra conta (ou nova entrada) pede releitura. */
  conta: undefined as number | null | undefined,
  precisaCarregar: true,
  trabalhando: null as string | null,
  /** Peça com arte que abriu o "Trocar a arte" (a peça sem arte já mostra o envio). */
  trocando: null as number | null,
  /** Peças com a descrição à vista, e a descrição já buscada de cada uma. */
  abertas: new Set<number>(),
  instrucoes: {} as Record<number, Instrucao>,
  /** "Novo post" do menu Criar, pendente até a primeira carga, com a conta em que foi pedido. */
  criarPost: null as { conta: number | null } | null,
};

let redesenhar: () => void = () => {};

/** Carga vigente: a resposta de uma carga que não é mais a última (outra chamada da mesma conta) é descartada. */
let geracao = 0;

/**
 * A escolha da URL (`?pedido=`, `?item=`) do último desenho e a conta em que foi feita. Na troca de
 * conta, o que ainda está na URL igual a ela é da conta anterior e sai (os ids são do banco, nunca
 * valem nas duas contas); um endereço novo, aberto já na outra conta, fica.
 */
let escolhaVista: { conta: number | null; pedido: string | null; item: string | null } | null = null;

// ---------- Estado entre contas: o ponto único ----------

/**
 * A conta ativa mudou no meio de uma operação do Estúdio. O resultado é descartado: nada é desenhado,
 * nenhum sucesso é mostrado (nem ao `urbi-redator`) e nada da conta anterior fica na tela, que já é
 * reconstruída pela troca (`carregar` zera o estado e o redator é recriado por conta).
 */
export class ContaTrocada extends Error {
  constructor() {
    super('conta_trocada');
    this.name = 'ContaTrocada';
  }
}

/**
 * A regra, num lugar só: espera `passo` e só devolve o resultado (ou o erro) se a conta ativa ainda for
 * `conta`, a de quando a operação começou. Se mudou, lança `ContaTrocada` e o resto da operação não roda.
 */
export async function seAindaNaConta<T>(conta: number | null, passo: Promise<T>): Promise<T> {
  let r: T;
  try {
    r = await passo;
  } catch (e) {
    if (contaAtiva() !== conta) throw new ContaTrocada();
    throw e;
  }
  if (contaAtiva() !== conta) throw new ContaTrocada();
  return r;
}

/** Abre uma operação: guarda a conta ativa agora e devolve o `seAindaNaConta` dela, para cada `await`. */
function nestaConta() {
  const conta = contaAtiva();
  return <T>(passo: Promise<T>) => seAindaNaConta(conta, passo);
}

/** "Não enviado": o formulário fechou sem resposta, ou o erro já foi mostrado. O redator devolve o texto. */
const CANCELADO = 'cancelado';
const cancelado = () => new Error(CANCELADO);

/** Quem dispara e não espera (clique, menu, `void`): a operação descartada ou cancelada termina em silêncio. */
function solto(p: unknown): void {
  void Promise.resolve(p).catch((e) => {
    if (e instanceof ContaTrocada || (e instanceof Error && e.message === CANCELADO)) return;
    console.error('[portal_corretor]', e);
  });
}

const solta = (a: Acao): Acao => (a.aoEscolher ? { ...a, aoEscolher: () => solto(a.aoEscolher!()) } : a);
const soltas = (acoes: Acao[]) => acoes.map(solta);

/** O app avisa que o corretor entrou no Estúdio (ou trocou de conta): os dados são relidos. */
export function aoAbrirEstudio() {
  estado.precisaCarregar = true;
  if (pedidoDeCriar('post')) estado.criarPost = { conta: contaAtiva() };
}

async function carregar() {
  const conta = contaAtiva();
  if (conta !== estado.conta) {
    estado.pecas = [];
    estado.marca = null;
    estado.conexao = null;
    estado.ia = null;
    estado.abertas = new Set();
    estado.instrucoes = {};
    // O que dependia da conta anterior: ação em andamento, "Trocar a arte" aberto e a peça já rolada.
    estado.trabalhando = null;
    estado.trocando = null;
    rolada = null;
    // O que foi escolhido ou pedido na conta anterior: o pedido aberto, a peça do `?item=` e o "Novo
    // post" ainda pendente. A conta nova abre como numa entrada no Estúdio. `?etapa=` é só o filtro
    // das listas (o mesmo em qualquer conta) e fica.
    if (estado.criarPost && estado.criarPost.conta !== conta) estado.criarPost = null;
    if (escolhaVista && escolhaVista.conta !== conta) {
      const q = escolha();
      const tirar = (['pedido', 'item'] as const).filter((k) => q[k] !== null && q[k] === escolhaVista![k]);
      if (tirar.length) filtrosNaUrl(filtrosDaUrl(), {}, [...tirar]);
    }
    escolhaVista = null;
    estado.conta = conta;
  }
  const minha = ++geracao;
  estado.precisaCarregar = false;
  estado.carregando = true;
  estado.falha = null;
  redesenhar();
  let vigente = true;
  try {
    const [p, m, c] = await seAindaNaConta(
      conta,
      Promise.all([
        chamarApi('/estudio/pecas'),
        chamarApi('/estudio/marca'),
        // Sem a conexão a tela segue (mostra "não conectado"): é contexto, não o conteúdo.
        chamarApi('/conexoes').catch(() => null),
      ]),
    );
    vigente = minha === geracao;
    if (vigente) {
      estado.pecas = p.dados;
      estado.ia = p.ia !== false;
      estado.marca = m;
      estado.conexao = c;
    }
  } catch (e) {
    vigente = !(e instanceof ContaTrocada) && minha === geracao;
    if (vigente) {
      estado.falha = e;
      // Com dados na tela a falha vira faixa (o `estadoDaFalha` só roda sem dados): o detalhe vai ao console.
      if (estado.marca) console.error('[portal_corretor]', e);
    }
  }
  if (!vigente) return;
  estado.carregando = false;
  redesenhar();
  if (estado.criarPost && estado.marca) {
    estado.criarPost = null;
    // Cancelar o formulário (ou trocar de conta) é só fechar; outro erro aparece.
    novoPedido('').catch((e) => {
      if (e instanceof ContaTrocada || (e instanceof Error && e.message === CANCELADO)) return;
      void urbiVerso.alertar({ titulo: 'Não foi possível abrir o pedido', mensagem: mensagemDeErro(e), tipo: 'erro' });
    });
  }
}

const recarregar = () => carregar();

// ---------- Endereço ----------

function escolha() {
  const q = filtrosDaUrl();
  return { pedido: q.get('pedido'), item: q.get('item'), etapa: q.get('etapa') };
}

function abrirPedido(id: number) {
  filtrosNaUrl(filtrosDaUrl(), { pedido: id }, ['item']);
  redesenhar();
}

function mudarEtapa(id: string) {
  filtrosNaUrl(filtrosDaUrl(), { etapa: id === 'todas' ? '' : id });
  redesenhar();
}

// ---------- Criar ----------

async function imoveisAnunciaveis(): Promise<Record<string, any>[]> {
  const lista: Record<string, any>[] = [];
  for (const situacao of ['ativo', 'reservado']) {
    for (let pagina = 1; pagina <= 20; pagina++) {
      const r = await chamarApi(`/imoveis?situacao=${situacao}&pagina=${pagina}`);
      lista.push(...(r.dados ?? []));
      if (pagina >= (r.paginas ?? 1)) break;
    }
  }
  return lista;
}

const opcaoImovel = (i: Record<string, any>) => ({ valor: String(i.id), rotulo: `${i.codigo} · ${i.titulo ?? i.tipo}`, textoBusca: `${i.bairro ?? ''} ${i.cidade ?? ''}` });

/**
 * O pedido vem do urbi-redator (texto ou microfone). Só resolve quando o pedido foi criado: cancelar o
 * formulário, falhar ou trocar de conta rejeita, e o redator não trata como enviado.
 */
async function novoPedido(falado: string) {
  const naConta = nestaConta();
  const imoveis = await naConta(imoveisAnunciaveis().catch((): Record<string, any>[] => []));
  const campos: CampoFormulario[] = [
    { nome: 'pedido', tipo: 'texto_longo', rotulo: 'O que você quer?', valor: falado, placeholder: 'Ex.: post de lançamento desta casa e um story, tom sofisticado.' },
    { nome: 'imovel_id', tipo: 'selecao', rotulo: 'Imóvel', pesquisavel: true, valor: '', opcoes: [{ valor: '', rotulo: 'Sem imóvel (peça institucional)' }, ...imoveis.map(opcaoImovel)] },
    { nome: 'objetivo', tipo: 'selecao', rotulo: 'Objetivo', valor: 'novo_imovel', opcoes: OBJETIVOS.map((o) => ({ valor: o, rotulo: ROTULO_OBJETIVO[o] })) },
    ...FORMATOS.map((f): CampoFormulario => ({ nome: `f_${f}`, tipo: 'booleano', rotulo: ROTULO_FORMATO[f], valor: f === 'post_1x1' })),
  ];
  const v = await naConta(
    urbiVerso.formulario({
      titulo: 'Novo pedido',
      campos,
      mensagem: 'O app escreve os textos (com IA, quando liberada) e a descrição da arte para colar no Canva IA, com a sua marca. Você gera lá, envia a arte aqui e revisa antes de aprovar.',
      rotuloConfirmar: 'Criar',
    }),
  );
  if (!v) throw cancelado();
  const formatos = FORMATOS.filter((f) => v[`f_${f}`] === true);
  await naConta(criar('/estudio/pedido', { pedido: v.pedido, imovel_id: v.imovel_id ? Number(v.imovel_id) : null, objetivo: v.objetivo, formatos }));
}

/** Criar rápido (2×2): sempre de um imóvel; Lançamento é o Pacote de lançamento. */
async function criarRapido(id: string) {
  const atalho = CRIAR_RAPIDO.find((a) => a.id === id);
  if (!atalho || estado.trabalhando) return;
  const naConta = nestaConta();
  let imoveis: Record<string, any>[];
  try {
    imoveis = await naConta(imoveisAnunciaveis());
  } catch (e) {
    if (e instanceof ContaTrocada) throw e;
    await naConta(urbiVerso.alertar({ titulo: 'Não foi possível carregar os imóveis', mensagem: mensagemDeErro(e), tipo: 'erro' }));
    return;
  }
  if (!imoveis.length) {
    await naConta(urbiVerso.alertar({ titulo: 'Nenhum imóvel anunciado', mensagem: `"${atalho.rotulo}" é para imóvel ativo ou reservado.`, tipo: 'alerta' }));
    return;
  }
  const v = await naConta(
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
  if (!atalho.formatos) await naConta(criar('/estudio/pacote', { imovel_id: Number(v.imovel_id), pedido: v.pedido, objetivo: atalho.objetivo }));
  else await naConta(criar('/estudio/pedido', { imovel_id: Number(v.imovel_id), pedido: v.pedido || atalho.rotulo, objetivo: atalho.objetivo, formatos: atalho.formatos }));
}

/** Cria e abre o pedido novo. Falha: mostra o erro e rejeita com "cancelado" (o redator devolve o texto). */
async function criar(rota: string, corpo: Record<string, unknown>) {
  const naConta = nestaConta();
  estado.trabalhando = 'Escrevendo os textos e a descrição…';
  redesenhar();
  let r: Record<string, any>;
  try {
    r = await naConta(enviar('POST', rota, corpo));
  } catch (e) {
    if (e instanceof ContaTrocada) throw e;
    estado.trabalhando = null;
    redesenhar();
    await naConta(urbiVerso.alertar({ titulo: 'Não foi possível criar', mensagem: mensagemDeErro(e), tipo: 'erro' }));
    throw cancelado();
  }
  const pecas = r.pecas as Peca[];
  estado.trabalhando = null;
  urbiVerso.notificar(`${pecas.length} peça(s) criada(s)${r.ia ? '' : ' (textos pelo modelo: a IA não está liberada agora)'}. Copie a descrição, gere a arte no Canva e envie na peça.`, 'sucesso');
  // O pedido novo abre no centro, na etapa "Todas", com a descrição e as fotos à vista.
  filtrosNaUrl(filtrosDaUrl(), { pedido: Math.min(...pecas.map((p) => p.id)) }, ['item', 'etapa']);
  for (const p of pecas) solto(abrirInstrucao(p.id));
  await naConta(carregar());
}

// ---------- A descrição (D-89 a D-91) ----------

/**
 * Busca a descrição da peça e a deixa à vista (D-74, D-86). Por padrão é a do Canva, com todas as
 * referências da marca; "Usar outra ferramenta" troca a ferramenta e as referências.
 */
async function abrirInstrucao(id: number, ferramenta: Ferramenta = 'canva', referencias?: number[]): Promise<Instrucao | null> {
  const naConta = nestaConta();
  estado.abertas = new Set(estado.abertas).add(id);
  redesenhar();
  const guardada = estado.instrucoes[id];
  if (guardada && guardada.ferramenta === ferramenta && !referencias) return guardada;
  const refs = referencias ?? (estado.marca?.referencias ?? []).map((r) => r.id);
  let r: Instrucao;
  try {
    r = (await naConta(chamarApi(`/estudio/pecas/${id}/instrucao?ferramenta=${encodeURIComponent(ferramenta)}${refs.length ? `&referencias=${refs.join(',')}` : ''}`))) as Instrucao;
  } catch (e) {
    if (e instanceof ContaTrocada) throw e;
    fecharInstrucao(id);
    await naConta(urbiVerso.alertar({ titulo: 'Não foi possível preparar a descrição', mensagem: mensagemDeErro(e), tipo: 'erro' }));
    return null;
  }
  estado.instrucoes = { ...estado.instrucoes, [id]: r };
  redesenhar();
  return r;
}

function fecharInstrucao(id: number) {
  const abertas = new Set(estado.abertas);
  abertas.delete(id);
  estado.abertas = abertas;
  redesenhar();
}

function alternarInstrucao(p: Peca) {
  if (estado.abertas.has(p.id)) fecharInstrucao(p.id);
  else solto(abrirInstrucao(p.id, estado.instrucoes[p.id]?.ferramenta));
}

async function copiarInstrucao(p: Peca) {
  const naConta = nestaConta();
  const r = await naConta(abrirInstrucao(p.id, estado.instrucoes[p.id]?.ferramenta));
  if (!r) return;
  let copiou = true;
  try {
    await naConta(navigator.clipboard.writeText(r.prompt));
  } catch (e) {
    if (e instanceof ContaTrocada) throw e;
    copiou = false; // sem área de transferência
  }
  urbiVerso.notificar(copiou ? `Descrição copiada. ${r.onde}` : 'Copie a descrição que aparece na peça.', copiou ? 'sucesso' : 'info');
}

/** Usar outra ferramenta (D-86): Claude Design ou outra, e as referências que entram na descrição. */
async function outraFerramenta(p: Peca) {
  const naConta = nestaConta();
  const refs = estado.marca?.referencias ?? [];
  const v = await naConta(
    urbiVerso.formulario({
      titulo: 'Usar outra ferramenta',
      mensagem: refs.length
        ? 'A descrição muda para a ferramenta escolhida. Marque as referências que entram (elas ficam em Ajustes › Conta e marca).'
        : 'A descrição muda para a ferramenta escolhida. Quer mandar referências (posts que você admira)? Envie em Ajustes › Conta e marca.',
      campos: [
        { nome: 'ferramenta', tipo: 'selecao', rotulo: 'Ferramenta', valor: estado.instrucoes[p.id]?.ferramenta ?? 'canva', opcoes: FERRAMENTAS.map((f) => ({ valor: f, rotulo: FERRAMENTA[f].rotulo })) },
        ...refs.map((r, i): CampoFormulario => ({ nome: `r_${r.id}`, tipo: 'booleano', rotulo: `Referência ${i + 1}`, valor: true })),
      ],
      rotuloConfirmar: 'Preparar',
    }),
  );
  if (!v) return;
  await naConta(abrirInstrucao(p.id, v.ferramenta as Ferramenta, refs.filter((r) => v[`r_${r.id}`] === true).map((r) => r.id)));
}

// ---------- Ações da peça ----------

async function editar(p: Peca) {
  const naConta = nestaConta();
  const v = await naConta(
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
  await naConta(acao(() => enviar('PATCH', `/estudio/pecas/${p.id}`, { ...v, destaques: String(v.destaques ?? '').split(',').map((d) => d.trim()).filter(Boolean) }), 'Textos salvos.'));
  // A descrição leva os textos: a guardada fica velha.
  const anterior = estado.instrucoes[p.id];
  const { [p.id]: _velha, ...resto } = estado.instrucoes;
  estado.instrucoes = resto;
  if (estado.abertas.has(p.id)) solto(abrirInstrucao(p.id, anterior?.ferramenta, anterior?.referencias.map((x) => x.id)));
}

async function enviarArte(p: Peca, e: CustomEvent) {
  const arquivos = ((e.detail.arquivos as File[]) ?? []).slice(0, p.formato === 'carrossel' ? MAX_SLIDES : 1);
  if (!arquivos.length || estado.trabalhando) return;
  const naConta = nestaConta();
  // Trocar uma arte que já existe pede confirmação (o seletor também avisa quando um arquivo sai da lista).
  if (p.arquivos?.length) {
    const ok = await naConta(urbiVerso.confirmar({ titulo: 'Trocar a arte', mensagem: `A arte da peça passa a ser ${arquivos.length === 1 ? 'esta imagem' : `estas ${arquivos.length} imagens, nesta ordem`}.`, rotuloConfirmar: 'Trocar' }));
    if (!ok) return;
  }
  const ferramenta = estado.instrucoes[p.id]?.ferramenta ?? 'canva';
  estado.trabalhando = 'Enviando a arte…';
  redesenhar();
  let uploads: number[];
  try {
    uploads = [];
    for (const f of arquivos) uploads.push(await naConta(subirArquivo('peca_arquivos', 'arquivo', f)));
    await naConta(enviar('PUT', `/estudio/pecas/${p.id}/arquivos`, { upload_ids: uploads, motor: ferramenta === 'canva' ? 'canva_ia' : 'upload' }));
  } catch (err) {
    if (err instanceof ContaTrocada) throw err;
    estado.trabalhando = null;
    redesenhar();
    await naConta(urbiVerso.alertar({ titulo: 'Não foi possível enviar', mensagem: mensagemDeErro(err), tipo: 'erro' }));
    await naConta(carregar());
    return;
  }
  estado.trabalhando = null;
  estado.trocando = null;
  fecharInstrucao(p.id);
  urbiVerso.notificar(p.formato === 'carrossel' && uploads.length === 1 ? 'Arte enviada. O carrossel precisa de pelo menos 2 imagens: envie todas juntas.' : 'Arte enviada. Revise e aprove.', 'sucesso');
  await naConta(carregar());
}

async function acao(fn: () => Promise<unknown>, sucesso: string) {
  const naConta = nestaConta();
  let r: { avisos?: string[] } | undefined;
  try {
    r = (await naConta(fn())) as { avisos?: string[] } | undefined;
  } catch (e) {
    if (e instanceof ContaTrocada) throw e;
    await naConta(urbiVerso.alertar({ titulo: 'Não foi possível concluir', mensagem: mensagemDeErro(e), tipo: 'erro' }));
    throw cancelado();
  }
  urbiVerso.notificar([sucesso, ...(r?.avisos ?? [])].join(' '), r?.avisos?.length ? 'info' : 'sucesso');
  await naConta(carregar());
}

async function agendar(p: Peca) {
  const naConta = nestaConta();
  const amanha = new Date(Date.now() + 86400e3).toLocaleDateString('sv-SE');
  const v = await naConta(
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
  await naConta(acao(() => enviar('POST', `/estudio/pecas/${p.id}/agendar`, { quando: juntarDataHora(v.dia, v.hora) }), 'Peça agendada.'));
}

/** Publicar: agora, agendar ou baixar para publicar pelo Instagram (e marcar "Publiquei por fora"). */
async function publicarOpcoes(p: Peca) {
  const naConta = nestaConta();
  const opcoes = [
    { valor: 'agora', rotulo: 'Publicar agora no Instagram' },
    { valor: 'agendar', rotulo: 'Agendar' },
    { valor: 'baixar', rotulo: 'Baixar a arte e a legenda (publico eu)' },
  ];
  const v = await naConta(
    urbiVerso.formulario({
      titulo: 'Publicar',
      mensagem: p.formato === 'story' ? 'O story sai sem legenda: confira se o CRECI está na arte.' : undefined,
      campos: [{ nome: 'como', tipo: 'selecao', rotulo: 'Como', obrigatorio: true, valor: opcoes[0].valor, opcoes }],
      rotuloConfirmar: 'Continuar',
    }),
  );
  if (!v) return;
  if (v.como === 'agora') await naConta(publicar(p));
  else if (v.como === 'agendar') await naConta(agendar(p));
  else await naConta(baixar(p));
}

/** Abre cada imagem numa aba, para ver e salvar. */
function verArte(p: Peca) {
  for (const a of (p.arquivos ?? []) as Record<string, any>[]) if (a.url) window.open(a.url, '_blank', 'noopener');
}

/** Baixar para publicar: as imagens e a legenda copiada. */
async function baixar(p: Peca) {
  const naConta = nestaConta();
  verArte(p);
  await naConta(copiarLegenda(p));
  urbiVerso.notificar('Publicou pelo Instagram? Use "Publiquei por fora" no Mais.', 'info');
}

async function publicar(p: Peca) {
  const naConta = nestaConta();
  const ok = await naConta(urbiVerso.confirmar({ titulo: 'Publicar agora', mensagem: 'A peça vai para o Instagram conectado. A API do Instagram não apaga publicações depois.', rotuloConfirmar: 'Publicar' }));
  if (!ok) return;
  estado.trabalhando = 'Publicando no Instagram…';
  redesenhar();
  let publicou = true;
  try {
    await naConta(enviar('POST', `/estudio/pecas/${p.id}/publicar`));
  } catch (e) {
    if (e instanceof ContaTrocada) throw e;
    publicou = false;
    estado.trabalhando = null;
    redesenhar();
    await naConta(urbiVerso.alertar({ titulo: 'Não foi publicada', mensagem: mensagemDeErro(e), tipo: 'erro' }));
  }
  estado.trabalhando = null;
  if (publicou) urbiVerso.notificar('Publicada no Instagram.', 'sucesso');
  await naConta(carregar());
}

async function publiqueiFora(p: Peca) {
  const naConta = nestaConta();
  const v = await naConta(
    urbiVerso.formulario({
      titulo: 'Publiquei por fora',
      mensagem: 'Publicou pelo Instagram ou pelo Meta Business Suite? Registre aqui para o Estúdio saber.',
      campos: [{ nome: 'link', tipo: 'texto', rotulo: 'Link do post (opcional)', placeholder: 'https://www.instagram.com/p/…' }],
      rotuloConfirmar: 'Registrar',
    }),
  );
  if (v) await naConta(acao(() => enviar('POST', `/estudio/pecas/${p.id}/publicada-fora`, { link: v.link }), 'Registrado como publicado.'));
}

async function remover(p: Peca) {
  const naConta = nestaConta();
  const ok = await naConta(urbiVerso.confirmar({ titulo: 'Remover peça', mensagem: 'A peça sai do Estúdio.', rotuloConfirmar: 'Remover', perigo: true }));
  if (!ok) return;
  await naConta(
    acao(async () => {
      const r = await naConta(enviar('PATCH', `/estudio/pecas/${p.id}/remover`));
      // Só na mesma conta (o `naConta` acima lança se mudou): o pedido aberto segue sem a peça.
      seguirSemPeca(p.id);
      return r;
    }, 'Peça removida.'),
  );
}

/**
 * Depois de remover uma peça: o id do pedido é o da sua peça de menor id, então tirar a primeira (ou a
 * do `?item=`) faria o endereço apontar para o nada. Se sobram peças do pedido aberto, a URL passa ao
 * pedido delas; se não sobra nada, volta a "nenhum pedido escolhido". Nunca "Não encontrado".
 */
function seguirSemPeca(id: number) {
  const aberto = pedidoEscolhido(agruparPedidos(estado.pecas), escolha()).pedido;
  estado.pecas = estado.pecas.filter((x) => x.id !== id);
  if (!aberto || !aberto.pecas.some((x) => x.id === id)) return;
  const resto = aberto.pecas.find((x) => x.id !== id);
  const novo = resto ? agruparPedidos(estado.pecas).find((x) => x.pecas.some((y) => y.id === resto.id)) : null;
  if (novo) filtrosNaUrl(filtrosDaUrl(), { pedido: novo.id }, ['item']);
  else filtrosNaUrl(filtrosDaUrl(), {}, ['pedido', 'item']);
}

async function copiarLegenda(p: Peca) {
  const naConta = nestaConta();
  const texto = [p.legenda, p.hashtags].filter(Boolean).join('\n\n');
  try {
    await naConta(navigator.clipboard.writeText(texto));
  } catch (e) {
    if (e instanceof ContaTrocada) throw e;
    await naConta(urbiVerso.alertar({ titulo: 'Legenda', mensagem: texto }));
    return;
  }
  urbiVerso.notificar('Legenda copiada.', 'sucesso');
}

const aprovar = (p: Peca) => acao(() => enviar('POST', `/estudio/pecas/${p.id}/aprovar`), 'Peça aprovada.');

/** A ação principal de cada estado (a de "falta a arte" é a área de envio, desenhada à parte). */
function acaoDe(nome: Exclude<AcaoPrincipal, 'enviar_arte'>, p: Peca): Acao {
  switch (nome) {
    case 'aprovar':
      return { rotulo: 'Aprovar', icone: 'fa-solid fa-check', aoEscolher: () => aprovar(p) };
    case 'publicar':
      return { rotulo: 'Publicar', icone: 'fa-brands fa-instagram', aoEscolher: () => publicarOpcoes(p) };
    case 'tentar_de_novo':
      return { rotulo: 'Tentar de novo', icone: 'fa-solid fa-rotate-right', aoEscolher: () => publicarOpcoes(p) };
    case 'cancelar_agendamento':
      return { rotulo: 'Cancelar agendamento', icone: 'fa-solid fa-calendar-xmark', aoEscolher: () => acao(() => enviar('POST', `/estudio/pecas/${p.id}/cancelar-agendamento`), 'Agendamento cancelado.') };
    case 'destravar':
      return { rotulo: 'Destravar', icone: 'fa-solid fa-unlock', aoEscolher: () => acao(() => enviar('POST', `/estudio/pecas/${p.id}/destravar`), 'Peça destravada: confira no Instagram.') };
    case 'ver_no_instagram':
      return { rotulo: 'Ver no Instagram', icone: 'fa-solid fa-arrow-up-right-from-square', aoEscolher: () => window.open(p.permalink!, '_blank', 'noopener') };
    case 'copiar_legenda':
      return { rotulo: 'Copiar legenda', icone: 'fa-solid fa-copy', aoEscolher: () => copiarLegenda(p) };
  }
}

/** O "Mais" da peça, pelo estado (D-86). */
function maisDe(p: Peca, principal: AcaoPrincipal): Acao[] {
  const travada = TRAVADA.includes(p.estado);
  const mais: Acao[] = [];
  if ((p.arquivos ?? []).length) mais.push({ rotulo: p.arquivos!.length > 1 ? 'Ver as artes' : 'Ver a arte', icone: 'fa-solid fa-image', aoEscolher: () => verArte(p) });
  if (!travada) {
    mais.push({ rotulo: 'Textos', icone: 'fa-solid fa-pen', aoEscolher: () => editar(p) });
    if (!semArte(p)) {
      mais.push(
        { rotulo: estado.abertas.has(p.id) ? 'Esconder a descrição' : 'Ver a descrição', icone: 'fa-solid fa-wand-magic-sparkles', aoEscolher: () => alternarInstrucao(p) },
        { rotulo: 'Trocar a arte', icone: 'fa-solid fa-upload', aoEscolher: () => ((estado.trocando = p.id), redesenhar()) },
      );
    }
    mais.push({ rotulo: 'Usar outra ferramenta', icone: 'fa-solid fa-shuffle', aoEscolher: () => outraFerramenta(p) });
  }
  if (p.estado === 'aprovada' || (p.estado === 'erro' && p.aprovada_em)) mais.push({ rotulo: 'Voltar a rascunho', icone: 'fa-solid fa-arrow-rotate-left', aoEscolher: () => acao(() => enviar('POST', `/estudio/pecas/${p.id}/rejeitar`), 'Peça de volta a rascunho.') });
  if (['aprovada', 'agendada', 'publicando', 'erro'].includes(p.estado)) mais.push({ rotulo: 'Publiquei por fora', icone: 'fa-solid fa-check-double', aoEscolher: () => publiqueiFora(p) });
  if (principal !== 'copiar_legenda') mais.push({ rotulo: 'Copiar legenda', icone: 'fa-solid fa-copy', aoEscolher: () => copiarLegenda(p) });
  if (!travada) mais.push({ rotulo: 'Remover', icone: 'fa-solid fa-trash', perigo: true, aoEscolher: () => remover(p) });
  return mais;
}

/** Só o "Mais" (o mesmo de `acoesComMais`), para a peça sem arte, cujo principal é a área de envio. */
function soMais(acoes: Acao[]): TemplateResult {
  return html`<urbi-dropdown flutuante>
    <urbi-botao slot="trigger" variante="secundario" icone="fa-solid fa-ellipsis">Mais</urbi-botao>
    <div slot="menu">
      ${acoes.map((a) => html`<urbi-dropdown-item icone=${a.icone ?? nothing} ?perigo=${!!a.perigo} @urbi:dropdown-select=${() => a.aoEscolher?.()}>${a.rotulo}</urbi-dropdown-item>`)}
    </div>
  </urbi-dropdown>`;
}

/** Envio da arte: o principal (grande, com área de arrastar) na peça sem arte; secundário para trocar. */
function seletorArte(p: Peca, primeira: boolean) {
  const carrossel = p.formato === 'carrossel';
  const nome = FERRAMENTA[estado.instrucoes[p.id]?.ferramenta ?? 'canva'].rotulo;
  return html`<urbi-seletor-arquivo
    accept="image/jpeg,image/png"
    ?multiplo=${carrossel}
    ?drop=${primeira}
    ?desabilitado=${!!estado.trabalhando}
    variante=${primeira ? 'primario' : 'secundario'}
    icone="fa-solid fa-upload"
    texto=${primeira ? `Enviar a arte ${carrossel ? '(as imagens) ' : ''}do ${nome}` : 'Escolher a nova arte'}
    dica=${carrossel ? `Arraste aqui as imagens baixadas, todas juntas e na ordem dos slides (de 2 a ${MAX_SLIDES}, JPG ou PNG)` : 'Arraste aqui a imagem baixada (JPG ou PNG)'}
    @urbi:seletor-arquivo-change=${(e: CustomEvent) => solto(enviarArte(p, e))}
  ></urbi-seletor-arquivo>`;
}

/** A descrição e os anexos (fotos e logo), à vista na peça. */
function instrucao(p: Peca) {
  const r = estado.instrucoes[p.id];
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
export function cartaoPeca(p: Peca): TemplateResult {
  const e = ESTADO[p.estado] ?? ESTADO.rascunho;
  const travada = TRAVADA.includes(p.estado);
  const falta = semArte(p) && !travada;
  const aberta = estado.abertas.has(p.id);
  const r = estado.instrucoes[p.id];
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
          <urbi-botao variante="secundario" icone="fa-solid fa-copy" @click=${() => solto(copiarInstrucao(p))}>Copiar descrição</urbi-botao>
          ${abrir ? html`<urbi-botao variante="secundario" icone="fa-solid fa-arrow-up-right-from-square" @click=${() => window.open(abrir, '_blank', 'noopener')}>Abrir no ${ferramenta.rotulo}</urbi-botao>` : nothing}
          <urbi-botao variante="fantasma" icone=${aberta ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down'} @click=${() => alternarInstrucao(p)}>${aberta ? 'Esconder descrição e fotos' : 'Ver descrição e fotos'}</urbi-botao>
          ${soMais(soltas(maisDe(p, principal)))}
        </urbi-linha>
        ${aberta ? instrucao(p) : nothing}
        ${seletorArte(p, true)}`
      : html`${acoesComMais(solta(acaoDe(principal, p)), soltas(maisDe(p, principal)))}
        ${aberta && !travada ? instrucao(p) : nothing}
        ${estado.trocando === p.id && !travada
          ? html`<urbi-linha quebrar>
              ${seletorArte(p, false)}
              <urbi-botao pequeno variante="fantasma" @click=${() => ((estado.trocando = null), redesenhar())}>Fechar</urbi-botao>
            </urbi-linha>`
          : nothing}`}
  </urbi-stack>`;
}

// ---------- O pedido como conversa ----------

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

function conversa(x: Pedido<Peca>, peca: number | null) {
  const eu = urbiVerso.usuario() ?? { id: 0 };
  const porId = new Map(x.pecas.map((p) => [p.id, p]));
  return html`<urbi-feed slot="centro" expandir usuario-atual-id=${eu.id} agrupar-minutos="0"
    .itens=${mensagensDoPedido(x, eu)}
    .renderRodape=${(m: ChatMensagem) => (porId.has(m.id) ? cartaoPeca(porId.get(m.id)!) : nothing)}
    ${ref((el) => rolarAte(el, peca))}></urbi-feed>`;
}

/** Peça do `?item=` à qual o feed já rolou: rola uma vez por escolha, não a cada redesenho. */
let rolada: number | null = null;

/** `?item=`: o feed rola até a peça depois de desenhar (o `rolarPara` resolve `false` se ela não está). */
function rolarAte(el: Element | undefined, peca: number | null) {
  if (!el || !peca || rolada === peca) return;
  rolada = peca;
  const feed = el as unknown as { rolarPara?: (id: number) => Promise<boolean>; updateComplete?: Promise<unknown> };
  void Promise.resolve(feed.updateComplete).then(() => feed.rolarPara?.(peca));
}

/**
 * O redator é recriado a cada conta (`keyed`): o envio de um pedido que termina depois da troca é
 * rejeitado (`ContaTrocada`), e o texto que o redator devolve fica no da conta anterior, fora da tela.
 */
function compositor() {
  return keyed(estado.conta, html`<urbi-redator
    audio
    chave-audio="portal_corretor:estudio-pedido"
    ?upload-em-andamento=${!!estado.trabalhando}
    placeholder="Escreva ou fale o pedido. Ex.: post de lançamento da casa do Lago Sul e um story, tom sofisticado."
    .aoEnviar=${(d: { texto: string }) => novoPedido(d.texto)}
  ></urbi-redator>`);
}

// ---------- Colunas ----------

function instagram(): { conectado: boolean; texto: string } {
  const ig = estado.conexao?.instagram;
  if (ig && !ig.ultimo_erro) return { conectado: true, texto: `@${ig.usuario} conectado` };
  if (ig) return { conectado: false, texto: `@${ig.usuario}: reconecte o Instagram` };
  return { conectado: false, texto: 'Instagram não conectado' };
}

function esquerda(pedidos: Pedido<Peca>[], aberto: number | null) {
  const etapa = etapaValida(escolha().etapa);
  const visiveis = pedidosNaEtapa(pedidos, etapa.id);
  const ig = instagram();
  return html`<urbi-stack>
    <urbi-stack>
      <urbi-prosa papel="titulo">Estúdio</urbi-prosa>
      <urbi-linha>${ig.conectado ? html`<urbi-icone icone="instagram" familia="brands"></urbi-icone>` : nothing}<urbi-prosa papel=${ig.conectado ? 'fraco' : 'secundario'}>${ig.texto}</urbi-prosa></urbi-linha>
    </urbi-stack>
    <urbi-prosa papel="secao">Criar rápido</urbi-prosa>
    <urbi-grid min="140px">
      ${CRIAR_RAPIDO.map(
        (a) => html`<urbi-botao variante="secundario" icone=${a.icone} title=${a.resumo} ?desabilitado=${!!estado.trabalhando} @click=${() => solto(criarRapido(a.id))}>${a.rotulo}</urbi-botao>`,
      )}
    </urbi-grid>
    ${estado.trabalhando ? html`<urbi-prosa papel="secundario">${estado.trabalhando}</urbi-prosa>` : nothing}
    <urbi-prosa papel="secao">Seus pedidos</urbi-prosa>
    ${pedidos.length
      ? html`<urbi-linha quebrar>
          ${ETAPAS.map((e) => {
            const n = estado.pecas.filter(e.casa).length;
            return e.id === 'todas' || n || etapa.id === e.id
              ? html`<urbi-badge interativo cor=${e.cor} ?ativo=${etapa.id === e.id} @click=${() => mudarEtapa(e.id)}>${e.rotulo} · ${n}</urbi-badge>`
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
          @urbi:lista-click=${(e: CustomEvent) => abrirPedido((e.detail.item as Pedido).id)}></urbi-lista>`
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
function centro(pedidos: Pedido<Peca>[]): { solto: boolean; conteudo: unknown } {
  const q = escolha();
  const { pedido, peca, naoEncontrado } = pedidoEscolhido(pedidos, q);
  const ig = estado.conexao?.instagram;
  const temFaixa = !!estado.falha || estado.ia === false || !ig || !!ig.ultimo_erro;
  const faixas = html`${estado.falha
      ? estadoTela('erro', {
          mensagem: 'Não foi possível atualizar o Estúdio agora. O que está na tela pode estar desatualizado.',
          aoTentar: recarregar,
        })
      : nothing}
    ${estado.ia === false
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
      conteudo: html`${temFaixa ? html`<urbi-hospedeiro slot="centro">${faixas}</urbi-hospedeiro>` : nothing}${conversa(pedido, peca)}<urbi-hospedeiro slot="centro">${compositor()}</urbi-hospedeiro>`,
    };
  }
  let corpo: unknown;
  if (naoEncontrado) corpo = estadoTela('sem_permissao');
  else if (pedidos.length) corpo = estadoTela('vazio', { icone: 'fa-solid fa-wand-magic-sparkles', mensagem: 'Escolha um pedido na lista', submensagem: 'Ou escreva um novo abaixo: o app escreve os textos e a descrição da arte para o Canva IA.' });
  else corpo = estadoTela('vazio', { icone: 'fa-solid fa-images', mensagem: 'Nenhum pedido ainda', submensagem: 'Escreva ou fale o pedido abaixo: o app escreve a descrição para você levar ao Canva.' });
  return { solto: false, conteudo: html`${faixas}${corpo}${compositor()}` };
}

function direita() {
  const { agendadas, publicadas } = estaSemana(estado.pecas);
  const m = estado.marca;
  const linhaSemana = (p: Peca, quando: string | null | undefined) => html`<urbi-linha justificar="entre">
    <urbi-stack>
      <urbi-prosa>${ROTULO_FORMATO[p.formato as Formato] ?? p.formato} · ${p.titulo ?? ''}</urbi-prosa>
      <urbi-prosa papel="fraco">${dataHora(quando)}</urbi-prosa>
    </urbi-stack>
    <urbi-botao pequeno variante="fantasma" icone="fa-solid fa-arrow-right" @click=${() => (filtrosNaUrl(filtrosDaUrl(), { item: p.id }, ['pedido']), redesenhar())}>Abrir</urbi-botao>
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
        ${agendadas.length ? agendadas.map((p) => linhaSemana(p, p.agendada_para)) : html`<urbi-prosa papel="dica">Nada agendado para os próximos 7 dias.</urbi-prosa>`}
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
export function renderEstudio(atualizar: () => void) {
  redesenhar = atualizar;
  // Outra conta: lê já, mesmo com uma carga em voo (a resposta da anterior é descartada em `carregar`).
  if (estado.conta !== contaAtiva()) void carregar();
  else if (estado.precisaCarregar && !estado.carregando) void carregar();
  // A escolha da URL desenhada agora é desta conta (a troca a compara antes de ler a conta nova).
  const q = escolha();
  escolhaVista = { conta: estado.conta ?? null, pedido: q.pedido, item: q.item };
  const rotulos = { lista: 'Pedidos', centro: 'Pedido', contexto: 'Semana' };
  if (!estado.marca) {
    const conteudo = estado.falha ? estadoDaFalha(estado.falha, recarregar) : estadoTela('carregando');
    return moldura({ menu: '/estudio', centro: conteudo }, atualizar);
  }
  const pedidos = agruparPedidos(estado.pecas);
  const { pedido, naoEncontrado } = pedidoEscolhido(pedidos, q);
  const c = centro(pedidos);
  return moldura(
    {
      menu: '/estudio',
      lista: esquerda(pedidos, pedido?.id ?? null),
      centro: c.conteudo,
      centroSolto: c.solto,
      contexto: direita(),
      rotulos,
      // Id na URL que não acha pedido: o "Não encontrado" está no centro, e o celular abre nele.
      painel: pedido || naoEncontrado ? 'centro' : 'esquerda',
    },
    atualizar,
  );
}

// Para os testes: o estado é do módulo.
export const _estadoEstudio = estado;
export const _recarregarEstudio = recarregar;
