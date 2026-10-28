import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { CampoFormulario, UrbiVersoAPI } from '@urbiverso/sdk';
import { FERRAMENTA, FERRAMENTAS, FORMATOS, MAX_SLIDES, OBJETIVOS, ROTULO_FORMATO, ROTULO_OBJETIVO, type Ferramenta, type Formato } from '../../comum/estudio';
import { acoesComMais, avisoCreci, chamarApi, dataHora, enviar, juntarDataHora, mensagemDeErro, pedidoDeCriar, subirArquivo, type Acao } from '../apoio';

declare const urbiVerso: UrbiVersoAPI;

type Linha = Record<string, any>;
interface Marca {
  creci: string | null;
  referencias: { id: number; url: string }[];
}
/** A instrução da peça (GET /estudio/pecas/:id/instrucao): o texto, as fotos e o logo para anexar. */
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
const TRAVADA = ['agendada', 'publicando', 'publicada'];
const semArte = (p: Linha) => !(p.arquivos ?? []).length;
const aprovavel = (p: Linha) => p.estado === 'rascunho' || p.estado === 'rejeitada' || (p.estado === 'erro' && !p.aprovada_em);

/**
 * Listas por etapa (D-90, como as listas inteligentes do Follow Up Boss): cada peça cai na etapa em
 * que está, e o chip mostra quantas há. Peça com erro de publicação fica em "Prontas" (tentar de novo).
 */
const ETAPAS: { id: string; rotulo: string; cor: string; casa: (p: Linha) => boolean }[] = [
  { id: 'todas', rotulo: 'Todas', cor: 'info', casa: () => true },
  { id: 'arte', rotulo: 'Falta a arte', cor: 'alerta', casa: (p) => semArte(p) && !TRAVADA.includes(p.estado) },
  { id: 'aprovar', rotulo: 'Para aprovar', cor: 'info', casa: (p) => !semArte(p) && aprovavel(p) },
  { id: 'prontas', rotulo: 'Prontas para publicar', cor: 'sucesso', casa: (p) => p.estado === 'aprovada' || (p.estado === 'erro' && !!p.aprovada_em) },
  { id: 'agendadas', rotulo: 'Agendadas', cor: 'info', casa: (p) => p.estado === 'agendada' || p.estado === 'publicando' },
  { id: 'publicadas', rotulo: 'Publicadas', cor: 'sucesso', casa: (p) => p.estado === 'publicada' },
];

// Estúdio de Conteúdo (D-74, D-86, D-89, D-90): pedido em texto ou voz (urbi-redator). Aqui saem só
// os textos e a descrição da arte (prompt em blocos) com as fotos e o logo; a imagem é gerada no Canva
// IA (ou em outra ferramenta) e enviada de volta na própria peça. Aprovação e publicação; o CRECI sem
// cadastro nunca trava (D-89, D-93): só o aviso discreto na peça ainda não publicada. Peças em listas por etapa, com o próximo passo e uma ação principal
// pelo estado; o resto no "Mais".
// Prévia da arte por urbi-avatar (exceção de "cartão de arte", 11.5).
@customElement('pc-tela-estudio')
export class PcTelaEstudio extends LitElement {
  @state() private pecas: Linha[] = [];
  @state() private marca: Marca | null = null;
  @state() private falha: string | null = null;
  @state() private trabalhando: string | null = null;
  /** Peça com arte que abriu o "Trocar a arte" (a peça sem arte já mostra o envio). */
  @state() private trocando: number | null = null;
  /** Peças com a instrução à vista, e a instrução já buscada de cada uma. */
  @state() private abertas = new Set<number>();
  @state() private instrucoes: Record<number, Instrucao> = {};
  @state() private etapa = 'todas';

  connectedCallback() {
    super.connectedCallback();
    void this.carregar();
    // "Novo post" do menu Criar: o mesmo formulário do pedido escrito na caixa.
    if (pedidoDeCriar('post')) {
      // Cancelar o formulário lança 'cancelado' (o urbi-redator o trata); aqui é só fechar. Outro erro aparece.
      this.novoPedido('').catch((e) => {
        if (e instanceof Error && e.message === 'cancelado') return;
        void urbiVerso.alertar({ titulo: 'Não foi possível abrir o pedido', mensagem: mensagemDeErro(e), tipo: 'erro' });
      });
    }
  }

  private async carregar() {
    this.falha = null;
    try {
      const [p, m] = await Promise.all([chamarApi('/estudio/pecas'), chamarApi('/estudio/marca')]);
      this.pecas = p.dados;
      this.marca = m;
    } catch (e) {
      this.falha = (e as Error).message;
    }
  }

  private async imoveisAnunciaveis(): Promise<Linha[]> {
    const lista: Linha[] = [];
    for (const situacao of ['ativo', 'reservado']) {
      for (let pagina = 1; pagina <= 20; pagina++) {
        const r = await chamarApi(`/imoveis?situacao=${situacao}&pagina=${pagina}`);
        lista.push(...(r.dados ?? []));
        if (pagina >= (r.paginas ?? 1)) break;
      }
    }
    return lista;
  }

  /** O pedido vem do urbi-redator (texto ou microfone); cancelar o formulário devolve o texto à caixa. */
  private async novoPedido(falado: string) {
    let imoveis: Linha[] = [];
    try {
      imoveis = await this.imoveisAnunciaveis();
    } catch {
      imoveis = [];
    }
    const campos: CampoFormulario[] = [
      { nome: 'pedido', tipo: 'texto_longo', rotulo: 'O que você quer?', valor: falado, placeholder: 'Ex.: post de lançamento desta casa e um story, tom sofisticado.' },
      {
        nome: 'imovel_id', tipo: 'selecao', rotulo: 'Imóvel', pesquisavel: true, valor: '',
        opcoes: [{ valor: '', rotulo: 'Sem imóvel (peça institucional)' }, ...imoveis.map((i) => ({ valor: String(i.id), rotulo: `${i.codigo} · ${i.titulo ?? i.tipo}`, textoBusca: `${i.bairro ?? ''} ${i.cidade ?? ''}` }))],
      },
      { nome: 'objetivo', tipo: 'selecao', rotulo: 'Objetivo', valor: 'novo_imovel', opcoes: OBJETIVOS.map((o) => ({ valor: o, rotulo: ROTULO_OBJETIVO[o] })) },
      ...FORMATOS.map((f): CampoFormulario => ({ nome: `f_${f}`, tipo: 'booleano', rotulo: ROTULO_FORMATO[f], valor: f === 'post_1x1' })),
    ];
    const v = await urbiVerso.formulario({ titulo: 'Novo pedido', campos, mensagem: 'O app escreve os textos (com IA, quando liberada) e a descrição da arte para colar no Canva IA, com a sua marca. Você gera lá, envia a arte aqui e revisa antes de aprovar.', rotuloConfirmar: 'Criar' });
    if (!v) throw new Error('cancelado');
    const formatos = FORMATOS.filter((f) => v[`f_${f}`] === true);
    await this.criar('/estudio/pedido', { pedido: v.pedido, imovel_id: v.imovel_id ? Number(v.imovel_id) : null, objetivo: v.objetivo, formatos });
  }

  private async pacote() {
    let imoveis: Linha[] = [];
    try {
      imoveis = await this.imoveisAnunciaveis();
    } catch (e) {
      await urbiVerso.alertar({ titulo: 'Não foi possível carregar os imóveis', mensagem: mensagemDeErro(e), tipo: 'erro' });
      return;
    }
    if (!imoveis.length) {
      await urbiVerso.alertar({ titulo: 'Nenhum imóvel anunciado', mensagem: 'O pacote de lançamento é para imóvel ativo ou reservado.', tipo: 'alerta' });
      return;
    }
    const v = await urbiVerso.formulario({
      titulo: 'Pacote de lançamento',
      mensagem: 'Post, carrossel e story do imóvel: os textos e uma descrição para o Canva IA de cada um.',
      campos: [
        { nome: 'imovel_id', tipo: 'selecao', rotulo: 'Imóvel', obrigatorio: true, pesquisavel: true, opcoes: imoveis.map((i) => ({ valor: String(i.id), rotulo: `${i.codigo} · ${i.titulo ?? i.tipo}` })) },
        { nome: 'pedido', tipo: 'texto_longo', rotulo: 'Algum pedido? (opcional)', placeholder: 'Ex.: destacar a varanda gourmet.' },
      ],
      rotuloConfirmar: 'Criar pacote',
    });
    if (!v) return;
    await this.criar('/estudio/pacote', { imovel_id: Number(v.imovel_id), pedido: v.pedido, objetivo: 'novo_imovel' });
  }

  private async criar(rota: string, corpo: Record<string, unknown>) {
    this.trabalhando = 'Escrevendo os textos e a descrição…';
    try {
      const r = await enviar('POST', rota, corpo);
      urbiVerso.notificar(`${r.pecas.length} peça(s) criada(s)${r.ia ? '' : ' (textos pelo modelo: a IA não está liberada agora)'}. Copie a descrição, gere a arte no Canva e envie na peça.`, 'sucesso');
      this.etapa = 'todas';
      // As peças novas já abrem com a descrição e as fotos à vista.
      for (const p of r.pecas as Linha[]) void this.abrirInstrucao(p.id);
    } catch (e) {
      await urbiVerso.alertar({ titulo: 'Não foi possível criar', mensagem: mensagemDeErro(e), tipo: 'erro' });
    } finally {
      this.trabalhando = null;
      await this.carregar();
    }
  }

  private async editar(p: Linha) {
    const v = await urbiVerso.formulario({
      titulo: 'Textos da peça',
      campos: [
        { nome: 'titulo', tipo: 'texto', rotulo: 'Título', obrigatorio: true, valor: p.titulo },
        { nome: 'chamada', tipo: 'texto', rotulo: 'Chamada', valor: p.chamada ?? '' },
        { nome: 'destaques', tipo: 'texto', rotulo: 'Destaques (separados por vírgula, até 4)', valor: (p.destaques ?? []).join(', ') },
        { nome: 'legenda', tipo: 'texto_longo', rotulo: 'Legenda', valor: p.legenda ?? '' },
        { nome: 'hashtags', tipo: 'texto', rotulo: 'Hashtags', valor: p.hashtags ?? '' },
      ],
      mensagem: 'Mudou o título, a chamada ou os destaques? A descrição muda junto: copie de novo e refaça a arte no Canva.',
    });
    if (!v) return;
    await this.acao(() => enviar('PATCH', `/estudio/pecas/${p.id}`, { ...v, destaques: String(v.destaques ?? '').split(',').map((d) => d.trim()).filter(Boolean) }), 'Textos salvos.');
    // A instrução leva os textos: a guardada fica velha.
    const anterior = this.instrucoes[p.id];
    const { [p.id]: _velha, ...resto } = this.instrucoes;
    this.instrucoes = resto;
    if (this.abertas.has(p.id)) void this.abrirInstrucao(p.id, anterior?.ferramenta, anterior?.referencias.map((x) => x.id));
  }

  /**
   * Busca a instrução da peça e a deixa à vista (D-74, D-86). Por padrão é a do Canva, com todas as
   * referências da marca; "Usar outra ferramenta" troca a ferramenta e as referências.
   */
  private async abrirInstrucao(id: number, ferramenta: Ferramenta = 'canva', referencias?: number[]): Promise<Instrucao | null> {
    this.abertas = new Set(this.abertas).add(id);
    const guardada = this.instrucoes[id];
    if (guardada && guardada.ferramenta === ferramenta && !referencias) return guardada;
    const refs = referencias ?? (this.marca?.referencias ?? []).map((r) => r.id);
    try {
      const r = (await chamarApi(`/estudio/pecas/${id}/instrucao?ferramenta=${encodeURIComponent(ferramenta)}${refs.length ? `&referencias=${refs.join(',')}` : ''}`)) as Instrucao;
      this.instrucoes = { ...this.instrucoes, [id]: r };
      return r;
    } catch (e) {
      this.fecharInstrucao(id);
      await urbiVerso.alertar({ titulo: 'Não foi possível preparar a descrição', mensagem: mensagemDeErro(e), tipo: 'erro' });
      return null;
    }
  }

  private fecharInstrucao(id: number) {
    const abertas = new Set(this.abertas);
    abertas.delete(id);
    this.abertas = abertas;
  }

  private alternarInstrucao(p: Linha) {
    if (this.abertas.has(p.id)) this.fecharInstrucao(p.id);
    else void this.abrirInstrucao(p.id, this.instrucoes[p.id]?.ferramenta);
  }

  private async copiarInstrucao(p: Linha) {
    const r = await this.abrirInstrucao(p.id, this.instrucoes[p.id]?.ferramenta);
    if (!r) return;
    try {
      await navigator.clipboard.writeText(r.prompt);
      urbiVerso.notificar(`Descrição copiada. ${r.onde}`, 'sucesso');
    } catch {
      urbiVerso.notificar('Copie a descrição que aparece na peça.', 'info'); // sem área de transferência
    }
  }

  /** Usar outra ferramenta (D-86): Claude Design ou outra, e as referências que entram na instrução. */
  private async outraFerramenta(p: Linha) {
    const refs = this.marca?.referencias ?? [];
    const v = await urbiVerso.formulario({
      titulo: 'Usar outra ferramenta',
      mensagem: refs.length
        ? 'A descrição muda para a ferramenta escolhida. Marque as referências que entram (elas ficam em Ajustes › Marca).'
        : 'A descrição muda para a ferramenta escolhida. Quer mandar referências (posts que você admira)? Envie em Ajustes › Marca.',
      campos: [
        { nome: 'ferramenta', tipo: 'selecao', rotulo: 'Ferramenta', valor: this.instrucoes[p.id]?.ferramenta ?? 'canva', opcoes: FERRAMENTAS.map((f) => ({ valor: f, rotulo: FERRAMENTA[f].rotulo })) },
        ...refs.map((r, i): CampoFormulario => ({ nome: `r_${r.id}`, tipo: 'booleano', rotulo: `Referência ${i + 1}`, valor: true })),
      ],
      rotuloConfirmar: 'Preparar',
    });
    if (!v) return;
    await this.abrirInstrucao(p.id, v.ferramenta as Ferramenta, refs.filter((r) => v[`r_${r.id}`] === true).map((r) => r.id));
  }

  private async enviarArte(p: Linha, e: CustomEvent) {
    const arquivos = ((e.detail.arquivos as File[]) ?? []).slice(0, p.formato === 'carrossel' ? MAX_SLIDES : 1);
    if (!arquivos.length || this.trabalhando) return;
    // Trocar uma arte que já existe pede confirmação (o seletor também avisa quando um arquivo sai da lista).
    if (p.arquivos?.length) {
      const ok = await urbiVerso.confirmar({ titulo: 'Trocar a arte', mensagem: `A arte da peça passa a ser ${arquivos.length === 1 ? 'esta imagem' : `estas ${arquivos.length} imagens, nesta ordem`}.`, rotuloConfirmar: 'Trocar' });
      if (!ok) return;
    }
    const ferramenta = this.instrucoes[p.id]?.ferramenta ?? 'canva';
    this.trabalhando = 'Enviando a arte…';
    try {
      const uploads: number[] = [];
      for (const f of arquivos) uploads.push(await subirArquivo('peca_arquivos', 'arquivo', f));
      await enviar('PUT', `/estudio/pecas/${p.id}/arquivos`, { upload_ids: uploads, motor: ferramenta === 'canva' ? 'canva_ia' : 'upload' });
      this.trocando = null;
      this.fecharInstrucao(p.id);
      urbiVerso.notificar(p.formato === 'carrossel' && uploads.length === 1 ? 'Arte enviada. O carrossel precisa de pelo menos 2 imagens: envie todas juntas.' : 'Arte enviada. Revise e aprove.', 'sucesso');
    } catch (err) {
      await urbiVerso.alertar({ titulo: 'Não foi possível enviar', mensagem: mensagemDeErro(err), tipo: 'erro' });
    } finally {
      this.trabalhando = null;
      await this.carregar();
    }
  }

  private async acao(fn: () => Promise<unknown>, sucesso: string) {
    try {
      const r = (await fn()) as { avisos?: string[] } | undefined;
      urbiVerso.notificar([sucesso, ...(r?.avisos ?? [])].join(' '), r?.avisos?.length ? 'info' : 'sucesso');
      await this.carregar();
    } catch (e) {
      await urbiVerso.alertar({ titulo: 'Não foi possível concluir', mensagem: mensagemDeErro(e), tipo: 'erro' });
    }
  }

  private async agendar(p: Linha) {
    const amanha = new Date(Date.now() + 86400e3).toLocaleDateString('sv-SE');
    const v = await urbiVerso.formulario({
      titulo: 'Agendar no Instagram',
      mensagem: 'Na hora marcada o app confere a peça de novo e publica na sua conta conectada.',
      campos: [
        { nome: 'dia', tipo: 'data', rotulo: 'Dia', obrigatorio: true, valor: amanha },
        { nome: 'hora', tipo: 'texto', rotulo: 'Hora (HH:MM)', obrigatorio: true, valor: '09:00' },
      ],
      rotuloConfirmar: 'Agendar',
    });
    if (!v) return;
    await this.acao(() => enviar('POST', `/estudio/pecas/${p.id}/agendar`, { quando: juntarDataHora(v.dia, v.hora) }), 'Peça agendada.');
  }

  /** Publicar: agora, agendar ou baixar para publicar pelo Instagram (e marcar "Publiquei por fora"). */
  private async publicarOpcoes(p: Linha) {
    const opcoes = [
      { valor: 'agora', rotulo: 'Publicar agora no Instagram' },
      { valor: 'agendar', rotulo: 'Agendar' },
      { valor: 'baixar', rotulo: 'Baixar a arte e a legenda (publico eu)' },
    ];
    const v = await urbiVerso.formulario({
      titulo: 'Publicar',
      mensagem: p.formato === 'story' ? 'O story sai sem legenda: confira se o CRECI está na arte.' : undefined,
      campos: [{ nome: 'como', tipo: 'selecao', rotulo: 'Como', obrigatorio: true, valor: opcoes[0].valor, opcoes }],
      rotuloConfirmar: 'Continuar',
    });
    if (!v) return;
    if (v.como === 'agora') await this.publicar(p);
    else if (v.como === 'agendar') await this.agendar(p);
    else await this.baixar(p);
  }

  /** Abre cada imagem numa aba, para ver e salvar. */
  private verArte(p: Linha) {
    for (const a of (p.arquivos ?? []) as Linha[]) if (a.url) window.open(a.url, '_blank', 'noopener');
  }

  /** Baixar para publicar: as imagens e a legenda copiada. */
  private async baixar(p: Linha) {
    this.verArte(p);
    await this.copiarLegenda(p);
    urbiVerso.notificar('Publicou pelo Instagram? Use "Publiquei por fora" no Mais.', 'info');
  }

  private async publicar(p: Linha) {
    const ok = await urbiVerso.confirmar({ titulo: 'Publicar agora', mensagem: 'A peça vai para o Instagram conectado. A API do Instagram não apaga publicações depois.', rotuloConfirmar: 'Publicar' });
    if (!ok) return;
    this.trabalhando = 'Publicando no Instagram…';
    try {
      await enviar('POST', `/estudio/pecas/${p.id}/publicar`);
      urbiVerso.notificar('Publicada no Instagram.', 'sucesso');
    } catch (e) {
      await urbiVerso.alertar({ titulo: 'Não foi publicada', mensagem: mensagemDeErro(e), tipo: 'erro' });
    } finally {
      this.trabalhando = null;
      await this.carregar();
    }
  }

  private async publiqueiFora(p: Linha) {
    const v = await urbiVerso.formulario({
      titulo: 'Publiquei por fora',
      mensagem: 'Publicou pelo Instagram ou pelo Meta Business Suite? Registre aqui para o Estúdio saber.',
      campos: [{ nome: 'link', tipo: 'texto', rotulo: 'Link do post (opcional)', placeholder: 'https://www.instagram.com/p/…' }],
      rotuloConfirmar: 'Registrar',
    });
    if (v) await this.acao(() => enviar('POST', `/estudio/pecas/${p.id}/publicada-fora`, { link: v.link }), 'Registrado como publicado.');
  }

  private async remover(p: Linha) {
    const ok = await urbiVerso.confirmar({ titulo: 'Remover peça', mensagem: 'A peça sai do Estúdio.', rotuloConfirmar: 'Remover', perigo: true });
    if (ok) await this.acao(() => enviar('PATCH', `/estudio/pecas/${p.id}/remover`), 'Peça removida.');
  }

  private async copiarLegenda(p: Linha) {
    const texto = [p.legenda, p.hashtags].filter(Boolean).join('\n\n');
    try {
      await navigator.clipboard.writeText(texto);
      urbiVerso.notificar('Legenda copiada.', 'sucesso');
    } catch {
      await urbiVerso.alertar({ titulo: 'Legenda', mensagem: texto });
    }
  }

  private aprovar = (p: Linha) => this.acao(() => enviar('POST', `/estudio/pecas/${p.id}/aprovar`), 'Peça aprovada.');

  /** Uma ação principal pelo estado (D-86, princípio 14); o resto vai para o "Mais". */
  private acoes(p: Linha) {
    const travada = TRAVADA.includes(p.estado);
    const semArte = !(p.arquivos ?? []).length;
    const legenda: Acao = { rotulo: 'Copiar legenda', icone: 'fa-solid fa-copy', aoEscolher: () => this.copiarLegenda(p) };
    let principal: Acao;
    if (semArte && !travada) principal = { rotulo: 'Copiar descrição', icone: 'fa-solid fa-copy', aoEscolher: () => this.copiarInstrucao(p) };
    else if (aprovavel(p)) principal = { rotulo: 'Aprovar', icone: 'fa-solid fa-check', aoEscolher: () => this.aprovar(p) };
    else if (p.estado === 'aprovada') principal = { rotulo: 'Publicar', icone: 'fa-brands fa-instagram', aoEscolher: () => this.publicarOpcoes(p) };
    else if (p.estado === 'erro') principal = { rotulo: 'Tentar de novo', icone: 'fa-solid fa-rotate-right', aoEscolher: () => this.publicarOpcoes(p) };
    else if (p.estado === 'agendada') principal = { rotulo: 'Cancelar agendamento', icone: 'fa-solid fa-calendar-xmark', aoEscolher: () => this.acao(() => enviar('POST', `/estudio/pecas/${p.id}/cancelar-agendamento`), 'Agendamento cancelado.') };
    else if (p.estado === 'publicando') principal = { rotulo: 'Destravar', icone: 'fa-solid fa-unlock', aoEscolher: () => this.acao(() => enviar('POST', `/estudio/pecas/${p.id}/destravar`), 'Peça destravada: confira no Instagram.') };
    else if (p.permalink) principal = { rotulo: 'Ver no Instagram', icone: 'fa-solid fa-arrow-up-right-from-square', aoEscolher: () => window.open(p.permalink, '_blank', 'noopener') };
    else principal = legenda; // publicada por fora sem link
    const mais: Acao[] = [];
    if ((p.arquivos ?? []).length) mais.push({ rotulo: p.arquivos.length > 1 ? 'Ver as artes' : 'Ver a arte', icone: 'fa-solid fa-image', aoEscolher: () => this.verArte(p) });
    if (!travada) {
      mais.push({ rotulo: 'Textos', icone: 'fa-solid fa-pen', aoEscolher: () => this.editar(p) });
      if (!semArte) {
        mais.push(
          { rotulo: this.abertas.has(p.id) ? 'Esconder a descrição' : 'Ver a descrição', icone: 'fa-solid fa-wand-magic-sparkles', aoEscolher: () => this.alternarInstrucao(p) },
          { rotulo: 'Trocar a arte', icone: 'fa-solid fa-upload', aoEscolher: () => (this.trocando = p.id) },
        );
      }
      mais.push({ rotulo: 'Usar outra ferramenta', icone: 'fa-solid fa-shuffle', aoEscolher: () => this.outraFerramenta(p) });
    }
    if (p.estado === 'aprovada' || (p.estado === 'erro' && p.aprovada_em)) mais.push({ rotulo: 'Voltar a rascunho', icone: 'fa-solid fa-arrow-rotate-left', aoEscolher: () => this.acao(() => enviar('POST', `/estudio/pecas/${p.id}/rejeitar`), 'Peça de volta a rascunho.') });
    if (['aprovada', 'agendada', 'publicando', 'erro'].includes(p.estado)) mais.push({ rotulo: 'Publiquei por fora', icone: 'fa-solid fa-check-double', aoEscolher: () => this.publiqueiFora(p) });
    if (principal !== legenda) mais.push(legenda);
    if (!travada) mais.push({ rotulo: 'Remover', icone: 'fa-solid fa-trash', perigo: true, aoEscolher: () => this.remover(p) });
    return acoesComMais(principal, mais);
  }

  /** Envio da arte: grande e com área de arrastar na peça sem arte; compacto para trocar. */
  private seletorArte(p: Linha, primeira: boolean) {
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
      @urbi:seletor-arquivo-change=${(e: CustomEvent) => this.enviarArte(p, e)}
    ></urbi-seletor-arquivo>`;
  }

  /** A descrição e os anexos (fotos e logo), à vista na peça. */
  private instrucao(p: Linha) {
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
            ${r.logo_url ? html`<urbi-visualizador-arquivo pequeno variante="secundario" rotulo="Logo" url=${r.logo_url} nome="logo.png" mime="image/png"></urbi-visualizador-arquivo>` : ''}
          </urbi-linha>`
        : ''}
    </urbi-stack>`;
  }

  private peca(p: Linha) {
    const estado = ESTADO[p.estado] ?? ESTADO.rascunho;
    const capa = p.arquivos?.[0]?.url ?? '';
    const travada = ['agendada', 'publicando', 'publicada'].includes(p.estado);
    const semArte = !(p.arquivos ?? []).length;
    const aberta = this.abertas.has(p.id);
    const r = this.instrucoes[p.id];
    const ferramenta = FERRAMENTA[r?.ferramenta ?? 'canva'];
    const abrir = r ? r.abrir : FERRAMENTA.canva.abrir;
    const publicandoHa = p.estado === 'publicando' ? Date.now() - new Date(p.atualizado_em ?? p.criado_em).getTime() : 0;
    return html`<urbi-linha quebrar>
      <urbi-avatar nome=${p.titulo} foto=${capa} icone=${capa ? '' : 'fa-solid fa-image'} tamanho="64"></urbi-avatar>
      <urbi-stack>
        <urbi-linha quebrar>
          <urbi-prosa>${p.titulo}</urbi-prosa>
          ${semArte && !travada ? html`<urbi-badge cor="alerta">falta a arte</urbi-badge>` : html`<urbi-badge cor=${estado.cor}>${estado.rotulo}</urbi-badge>`}
        </urbi-linha>
        ${p.estado === 'agendada' ? html`<urbi-prosa papel="secundario">Agendada para ${dataHora(p.agendada_para)}</urbi-prosa>` : ''}
        ${p.estado === 'publicada' ? html`<urbi-prosa papel="secundario">Publicada em ${dataHora(p.publicada_em)}${p.publicada_por === 'fora' ? ' (por fora)' : ''}</urbi-prosa>` : ''}
        ${p.estado === 'publicando' && publicandoHa < QUINZE_MIN ? html`<urbi-prosa papel="dica">Publicando. Se passar de 15 minutos assim, use "Destravar".</urbi-prosa>` : ''}
        ${p.estado === 'erro' && p.erro ? html`<urbi-prosa papel="secundario">${p.erro}</urbi-prosa>` : ''}
        <urbi-prosa papel="fraco">${ROTULO_FORMATO[p.formato as Formato] ?? p.formato} · ${ROTULO_OBJETIVO[p.objetivo as keyof typeof ROTULO_OBJETIVO] ?? p.objetivo}${p.imovel_codigo ? ` · ${p.imovel_codigo}` : ''}${semArte ? '' : ` · ${MOTOR[p.motor] ?? p.motor}`} · ${dataHora(p.criado_em)}</urbi-prosa>
        ${semArte && !travada ? html`<urbi-prosa papel="dica">1. Copie a descrição${abrir ? ` e abra o ${ferramenta.rotulo}` : ''}. 2. Cole a descrição e anexe as fotos e o logo. 3. Baixe a arte pronta (JPG ou PNG) e envie aqui.</urbi-prosa>` : ''}
        ${!semArte && aprovavel(p) ? html`<urbi-prosa papel="dica">Próximo passo: confira a arte e aprove.</urbi-prosa>` : ''}
        ${p.estado === 'aprovada' ? html`<urbi-prosa papel="dica">Próximo passo: publique agora, agende ou baixe para publicar você.</urbi-prosa>` : ''}
        ${!travada && this.marca && !this.marca.creci ? avisoCreci() : ''}
        <urbi-linha quebrar>
          ${this.acoes(p)}
          ${semArte && !travada && abrir ? html`<urbi-botao variante="secundario" icone="fa-solid fa-arrow-up-right-from-square" @click=${() => window.open(abrir, '_blank', 'noopener')}>Abrir o ${ferramenta.rotulo}</urbi-botao>` : ''}
          ${semArte && !travada ? html`<urbi-botao variante="fantasma" icone=${aberta ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down'} @click=${() => this.alternarInstrucao(p)}>${aberta ? 'Esconder descrição e fotos' : 'Ver descrição e fotos'}</urbi-botao>` : ''}
        </urbi-linha>
        ${aberta && !travada ? this.instrucao(p) : ''}
        ${semArte && !travada ? this.seletorArte(p, true) : ''}
        ${this.trocando === p.id && !semArte && !travada
          ? html`<urbi-linha quebrar>
              ${this.seletorArte(p, false)}
              <urbi-botao pequeno variante="fantasma" @click=${() => (this.trocando = null)}>Fechar</urbi-botao>
            </urbi-linha>`
          : ''}
      </urbi-stack>
    </urbi-linha>`;
  }

  render() {
    if (this.falha) {
      return html`<urbi-banner variante="erro">${this.falha}<urbi-botao slot="acao" pequeno variante="secundario" @click=${() => this.carregar()}>Tentar de novo</urbi-botao></urbi-banner>`;
    }
    if (!this.marca) return html`<urbi-loading></urbi-loading>`;
    const m = this.marca;
    const etapa = ETAPAS.find((e) => e.id === this.etapa) ?? ETAPAS[0];
    const visiveis = this.pecas.filter(etapa.casa);
    // O CRECI não aparece como aviso no topo (D-89, D-90, D-93): o aviso fica na peça, e só quando falta.
    return html`<urbi-stack>
      <urbi-card titulo="Criar" icone="fa-solid fa-wand-magic-sparkles">
        <urbi-redator
          audio
          chave-audio="portal_corretor:estudio-pedido"
          ?upload-em-andamento=${!!this.trabalhando}
          placeholder="Escreva ou fale o pedido. Ex.: post de lançamento da casa do Lago Sul e um story, tom sofisticado."
          .aoEnviar=${(d: { texto: string }) => this.novoPedido(d.texto)}
        ></urbi-redator>
        <urbi-linha quebrar>
          <urbi-botao variante="secundario" icone="fa-solid fa-box-open" ?carregando=${!!this.trabalhando} @click=${() => this.pacote()}>Pacote de lançamento</urbi-botao>
        </urbi-linha>
        ${this.trabalhando ? html`<urbi-prosa papel="secundario">${this.trabalhando}</urbi-prosa>` : html`<urbi-prosa papel="dica">O app escreve os textos e uma descrição clara da arte, com a sua marca, o preço e o bairro. Você cola no Canva IA, gera, baixa e envia de volta na peça. Prefere Claude Design ou outra? Use "Mais › Usar outra ferramenta".</urbi-prosa>`}
        <urbi-linha><urbi-botao pequeno variante="fantasma" icone="fa-solid fa-palette" href=${urbiVerso.href('/ajustes/marca')}>Sua marca (logo, cores, estilo)</urbi-botao></urbi-linha>
      </urbi-card>
      <urbi-card titulo="Peças" icone="fa-solid fa-images">
        <urbi-stack>
          ${this.pecas.length
            ? html`<urbi-linha quebrar>
                ${ETAPAS.map((e) => {
                  const n = this.pecas.filter(e.casa).length;
                  return e.id === 'todas' || n || this.etapa === e.id
                    ? html`<urbi-badge interativo cor=${e.cor} ?ativo=${this.etapa === e.id} @click=${() => (this.etapa = e.id)}>${e.rotulo} · ${n}</urbi-badge>`
                    : '';
                })}
              </urbi-linha>`
            : ''}
          ${visiveis.length
            ? html`<urbi-lista separador .itens=${visiveis} .render_item=${(p: Linha) => this.peca(p)}></urbi-lista>`
            : this.pecas.length
              ? html`<urbi-estado-vazio icone="fa-solid fa-check" mensagem="Nada nesta etapa" submensagem="Escolha outra lista acima."></urbi-estado-vazio>`
              : html`<urbi-estado-vazio icone="fa-solid fa-images" mensagem="Nenhuma peça ainda" submensagem="Escreva ou fale o pedido acima: o app escreve a descrição para você levar ao Canva."></urbi-estado-vazio>`}
        </urbi-stack>
      </urbi-card>
    </urbi-stack>`;
  }
}
