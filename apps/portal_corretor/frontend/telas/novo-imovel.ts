import { LitElement, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { UrbiVersoAPI } from '@urbiverso/sdk';
import {
  caracteristicasDasFotos,
  indicePasso,
  juntarCaracteristicas,
  obrigatoriosVazios,
  PASSOS_NOVO_IMOVEL,
  passoParaRetomar,
  passoSemRascunho,
  passoValido,
  qualidadeAnuncio,
  numeroEmTexto,
  rascunhoSemTipo,
  reaisEmTexto,
  type PassoNovoImovel,
} from '../../comum/imoveis';
import { reaisParaCentavos } from '../../comum/crm';
import {
  chamarApi,
  corQualidade,
  data,
  enviar,
  filtrosDaUrl,
  filtrosNaUrl,
  gesto,
  mensagemDeErro,
  opcoes,
  reais,
  ROTULO_AMBIENTE,
  ROTULO_TIPO_IMOVEL,
  subirArquivo,
} from '../apoio.js';
import { irParaComQuery } from '../criar.js';
import { estadoDaFalha, estadoTela } from '../estados.js';
import { cabecalhoColuna, moldura } from '../moldura.js';
import { autorizacaoAberta, marcarAssinada, registrarAutorizacao, SITUACAO_AUTORIZACAO } from './autorizacao-venda.js';

declare const urbiVerso: UrbiVersoAPI;

type Linha = Record<string, any>;

// Novo imóvel em 4 passos (spec 11.1 P07 e 11.5 M3; B5 parte 2, issue #94), em `/imoveis/novo`:
//
//   esquerda   os passos (Fotos · Dados · Autorização · Onde aparece), com o resumo de cada um, e [Salvar rascunho]
//   centro     o passo: "Passo n de 4", o conteúdo, e [Voltar] [Salvar rascunho] [Próximo]
//   direita    "Qualidade agora · n", o que falta e a caixa da IA
//
// No celular (M3) a moldura mostra uma coluna por vez e abre no centro: o próprio passo traz "Passo n de 4",
// o botão grande de tirar ou escolher fotos e o rodapé com [Salvar rascunho] e [Continuar]. Sem CSS próprio.
//
// O imóvel nasce como rascunho na primeira coisa que precisa de id (a primeira foto, ou sair do passo
// Dados). A rota de criação pede tipo e cidade: sem rascunho ainda, o passo Fotos pede os dois antes do
// seletor de fotos. Cada passo salva ao sair dele, e `?item=<id>` retoma o rascunho (sem `?passo=`, no primeiro passo
// com o que fazer). As rotas são as de sempre (`/imoveis`, `/imoveis/:id/midias…`, `/autorizacoes`), que
// validam e escopam pela conta: o imóvel de outra conta responde "não encontrado". Nenhum passo pede CRECI
// (D-93) e a autorização é opcional para o rascunho.

/** Campos do passo Dados; dinheiro em reais, como as rotas recebem. */
interface Formulario {
  tipo: string;
  /** Código do corretor: só na criação (vazio, o app numera `IM-0001`…). */
  codigo: string;
  titulo: string;
  bairro: string;
  cidade: string;
  uf: string;
  quartos: number | null;
  suites: number | null;
  banheiros: number | null;
  vagas: number | null;
  /** Área e dinheiro em texto, no formato brasileiro ("120,5", "1.450.000"): o backend lê (#185). */
  area_util_m2: string;
  preco: string;
  condominio: string;
  caracteristicas: string;
}

interface Ficha {
  imovel: Linha;
  qualidade: { nota: number; faltas: string[] };
  autorizacao_vigente: boolean;
  fotos_publicas: number;
  midias: Linha[];
  autorizacoes: Linha[];
}

const VAZIO: Formulario = {
  tipo: '',
  codigo: '',
  titulo: '',
  bairro: '',
  cidade: '',
  uf: '',
  quartos: null,
  suites: null,
  banheiros: null,
  vagas: null,
  area_util_m2: '',
  preco: '',
  condominio: '',
  caracteristicas: '',
};

const doImovel = (im: Linha): Formulario => {
  const n = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v));
  return {
    // O rascunho que nasceu pelas fotos guarda o "outro" de reserva: o passo 2 pede o tipo de verdade.
    tipo: rascunhoSemTipo(im) ? '' : (im.tipo ?? ''),
    codigo: im.codigo ?? '',
    titulo: im.titulo ?? '',
    bairro: im.bairro ?? '',
    cidade: im.cidade ?? '',
    uf: im.uf ?? '',
    quartos: n(im.quartos),
    suites: n(im.suites),
    banheiros: n(im.banheiros),
    vagas: n(im.vagas),
    area_util_m2: numeroEmTexto(im.area_util_m2),
    preco: reaisEmTexto(im.preco_c),
    condominio: reaisEmTexto(im.condominio_c),
    caracteristicas: im.caracteristicas ?? '',
  };
};

/** Tipo de um arquivo pelo MIME, ou pela extensão quando o navegador manda o `type` vazio. */
function tipoDoArquivo(f: File): 'foto' | 'video' | 'documento' {
  const mime = f.type || (/\.(jpe?g|png|webp)$/i.test(f.name) ? 'image/' : /\.mp4$/i.test(f.name) ? 'video/' : '');
  return mime.startsWith('image/') ? 'foto' : mime.startsWith('video/') ? 'video' : 'documento';
}

/**
 * O estado do Novo imóvel, compartilhado pelas três colunas (cada uma é um elemento da moldura). Quem
 * muda chama `mudou()`, e as três se redesenham.
 *
 * O estado é da conta em que a tela nasceu (`vida`, um gesto de apoio.ts): a troca de conta recria a tela
 * e um estado novo; toda continuação deste passa por `esperar`. Trocada a conta em qualquer await, o
 * que vinha depois (novo envio, aviso, alerta, URL, ida à ficha) não acontece: termina em silêncio.
 */
class NovoImovel extends EventTarget {
  private readonly vida = gesto();
  id: number | null = null;
  passo: PassoNovoImovel = 'fotos';
  ficha: Ficha | null = null;
  form: Formulario = { ...VAZIO };
  /** Há dados do passo Dados ainda não salvos. */
  sujo = false;
  /** Campos que o corretor mexeu nesta visita: a IA não os preenche mais. */
  editados = new Set<string>();
  /**
   * O corretor tentou avançar com obrigatórios vazios: só a partir daí, ou depois de mexer no campo, o
   * "Obrigatório" aparece (#182, item 4). A tela não abre em vermelho.
   */
  tentouAvancar = false;
  /** Campos que a IA preencheu pelo ditado nesta visita ("preenchido pela IA"). */
  ditados = new Set<string>();
  ditando = false;
  /**
   * Alguma foto foi lida pela IA nesta visita à tela. Só aí as características das fotos entram no
   * formulário: ao retomar um rascunho, o que o corretor apagou antes não volta sozinho.
   */
  leuFotosAgora = false;
  ia = { fotos: false, conteudo: false };
  ocupado: string | null = null;
  falha: unknown = null;
  carregando = false;
  /** A ordem das fotos veio da IA (`ordem-sugerida`) nesta visita: a primeira é a "capa sugerida". */
  capaSugerida = false;
  combinam: number | null = null;
  onde: 'so_voce' | 'publico' = 'so_voce';

  mudou() {
    if (this === atual && this.vida.vivo()) canal.dispatchEvent(new Event('mudou'));
  }

  /** Espera `passo` só enquanto a conta é a deste estado; senão lança `ContaTrocada`. */
  private esperar<T>(passo: T | PromiseLike<T>): Promise<T> {
    return this.vida.esperar(passo);
  }

  /** Roda um gesto que não passa por `tentar`: conta trocada no meio termina em silêncio. */
  private async semAvisoDeOutraConta(fn: () => Promise<unknown>) {
    // A conta já mudou (o estado é de antes): o gesto nem começa, nenhum diálogo abre.
    if (!this.vida.vivo()) return;
    try {
      await fn();
    } catch (e) {
      if (!this.vida.encerrado(e)) throw e;
    }
  }

  /** Entrada na tela: lê `?item=` e `?passo=`; um rascunho é relido do servidor. */
  abrir() {
    return this.semAvisoDeOutraConta(() => this.abrirNaConta());
  }

  private async abrirNaConta() {
    const q = filtrosDaUrl();
    const item = Number(q.get('item')) || null;
    const pedido = passoValido(q.get('passo'));
    void chamarApi('/imoveis/ia').then(
      (r) => void ((this.ia = r), this.mudou()), // conta trocada em voo: `ContaTrocada` (guarda do envio)
      () => undefined,
    );
    if (!item) {
      this.passo = passoSemRascunho(pedido);
      this.mudou();
      return;
    }
    this.id = item;
    this.carregando = true;
    this.mudou();
    await this.reler();
    this.carregando = false;
    if (this.ficha) {
      this.passo =
        pedido ??
        passoParaRetomar({ fotos: this.fotos().length, dados: this.form as unknown as Record<string, unknown>, autorizacoes: this.ficha.autorizacoes.length });
      this.onde = this.ficha.imovel.publicado_pagina ? 'publico' : 'so_voce';
      this.naUrl();
    }
    this.mudou();
  }

  /** Relê a ficha (o [Tentar de novo] e o fim dos gestos); conta trocada no meio: em silêncio. */
  recarregar() {
    return this.semAvisoDeOutraConta(() => this.reler());
  }

  /**
   * Relê a ficha; os dados do formulário só são trocados quando não há edição por salvar. Dentro de uma
   * cadeia: com a conta trocada, lança `ContaTrocada` e o resto da cadeia não roda.
   */
  private async reler() {
    if (!this.id) return;
    this.falha = null;
    try {
      this.ficha = await this.esperar(chamarApi(`/imoveis/${this.id}`));
      if (!this.sujo) this.form = doImovel(this.ficha!.imovel);
      if (this.leuFotosAgora) this.sugerirDasFotos();
      void chamarApi(`/imoveis/${this.id}/contexto`).then(
        (c) => void ((this.combinam = c.combinam?.length ?? 0), this.mudou()), // idem
        () => undefined,
      );
    } catch (e) {
      if (this.vida.encerrado(e)) throw e;
      this.falha = e;
    }
    this.mudou();
  }

  fotos(): Linha[] {
    return (this.ficha?.midias ?? []).filter((m) => m.tipo === 'foto');
  }

  /** O que a leitura das fotos sugere para as características (só ambientes que viram característica). */
  sugeridasPelasFotos(): string[] {
    return caracteristicasDasFotos(this.fotos().map((m) => m.ia_ambiente));
  }

  /** A IA preenche as características com o que as fotos mostram, enquanto o corretor não mexer no campo. */
  private sugerirDasFotos() {
    if (this.editados.has('caracteristicas')) return;
    const juntas = juntarCaracteristicas(this.form.caracteristicas, this.sugeridasPelasFotos());
    if (juntas !== this.form.caracteristicas) {
      this.form = { ...this.form, caracteristicas: juntas };
      this.sujo = true;
    }
  }

  /** O campo mostra "preenchido pela IA": veio da leitura das fotos e o corretor não mexeu. */
  preenchidoPelaIa(campo: keyof Formulario): boolean {
    if (this.ditados.has(campo) && !this.editados.has(campo)) return true;
    if (campo !== 'caracteristicas' || this.editados.has(campo)) return false;
    const atuais = this.form.caracteristicas.toLowerCase();
    const sugeridas = this.sugeridasPelasFotos();
    return sugeridas.length > 0 && sugeridas.every((s) => atuais.includes(s.toLowerCase()));
  }

  editar(campo: keyof Formulario, valor: unknown) {
    this.form = { ...this.form, [campo]: valor } as Formulario;
    this.editados.add(campo);
    this.ditados.delete(campo);
    this.sujo = true;
    this.mudou();
  }

  /** O "Obrigatório" do campo aparece só depois de mexer nele ou de tentar avançar (#182, item 4). */
  mostrarErro(campo: keyof Formulario): boolean {
    return (this.tentouAvancar || this.editados.has(campo)) && !String(this.form[campo] ?? '').trim();
  }

  /**
   * "Ditar o resto" (P07, passo 2): o texto do microfone (ou digitado) vai à IA, que devolve os campos que
   * ouviu; entram só os que o corretor ainda não mexeu, marcados como "preenchido pela IA".
   */
  ditar(texto: string) {
    return this.semAvisoDeOutraConta(async () => {
      if (!texto.trim() || this.ditando) return;
      this.ditando = true;
      this.mudou();
      try {
        const r = await this.esperar(enviar('POST', '/imoveis/ia', { texto }));
        const campos = (r?.campos ?? {}) as Record<string, string | number>;
        let n = 0;
        const novo = { ...this.form } as unknown as Record<string, unknown>;
        for (const [c, v] of Object.entries(campos)) {
          if (!(c in novo) || this.editados.has(c)) continue;
          novo[c] = c === 'caracteristicas' ? juntarCaracteristicas(String(novo[c] ?? ''), String(v).split(', ')) : v;
          this.ditados.add(c);
          n++;
        }
        this.form = novo as unknown as Formulario;
        if (n) this.sujo = true;
        urbiVerso.notificar(n ? `A IA preencheu ${n} campo(s). Confira.` : 'A IA não achou dados do imóvel nessa fala.', n ? 'sucesso' : 'info');
      } catch (e) {
        if (this.vida.encerrado(e)) throw e;
        await urbiVerso.alertar({ titulo: 'Não foi possível ditar agora', mensagem: mensagemDeErro(e), tipo: 'erro' });
      } finally {
        this.ditando = false;
        this.mudou();
      }
    });
  }

  /** `?item=` e `?passo=` no endereço, sem empilhar histórico: recarregar a página volta aqui. */
  private naUrl() {
    filtrosNaUrl(filtrosDaUrl(), { item: this.id, passo: this.passo });
  }

  /** O corpo do PATCH/POST: os campos do formulário, como as rotas recebem. */
  private corpo(): Record<string, unknown> {
    const { codigo, tipo, ...f } = this.form;
    // O código só vai na criação; depois, é o do imóvel e não muda por aqui. Tipo vazio (rascunho que
    // nasceu pelas fotos) não vai: a rota recusaria, e o passo 2 o pede antes de seguir.
    return { ...f, ...(tipo ? { tipo } : {}), uf: f.uf.trim().toUpperCase(), ...(this.id || !codigo.trim() ? {} : { codigo }) };
  }

  /** Faltam os obrigatórios (tipo e cidade), sem os quais o rascunho não é criado nem avança do Dados. */
  faltamObrigatorios(): string[] {
    return obrigatoriosVazios(this.form as unknown as Record<string, unknown>);
  }

  /**
   * O imóvel existe como rascunho (cria na primeira vez que precisa). Sem tipo e cidade ainda (o cadastro
   * começa pelas fotos), nasce como rascunho vazio (`rascunho: true`) e os dois vêm no passo 2.
   */
  async garantirRascunho(): Promise<number> {
    if (this.id) return this.id;
    // O que se digitar com o POST em voo continua pendente: só o que foi enviado conta como salvo.
    const enviado = this.form;
    const corpo = this.faltamObrigatorios().length ? { ...this.corpo(), rascunho: true } : this.corpo();
    const criado = await this.esperar(enviar('POST', '/imoveis', corpo));
    this.id = criado.id;
    if (this.form === enviado) this.sujo = false;
    this.naUrl();
    await this.reler();
    return this.id!;
  }

  /** Salva os dados se houver edição pendente (cada passo salva ao sair dele). */
  async salvarDados() {
    if (!this.id) {
      if (this.sujo) await this.garantirRascunho();
      return;
    }
    if (!this.sujo) return;
    const enviado = this.form;
    await this.esperar(enviar('PATCH', `/imoveis/${this.id}`, this.corpo()));
    if (this.form === enviado) this.sujo = false;
    await this.reler();
  }

  /**
   * Salva tudo o que está pendente e garante o rascunho, e só volta com `sujo` falso: o que se digitou com
   * um salvamento em voo (ou o que a releitura sugeriu) vai numa nova rodada. Poucas rodadas: quem não para
   * de digitar recebe o aviso em vez de um laço sem fim. Conta trocada no meio: `ContaTrocada` segue.
   */
  async salvarTudo() {
    for (let rodada = 0; rodada < 3; rodada++) {
      await this.salvarDados();
      await this.garantirRascunho();
      if (!this.sujo) return;
    }
    throw new Error('Você continuou editando enquanto salvava. Tente de novo.');
  }

  /**
   * Executa com o aviso de ocupado; falha vira alerta e devolve `false`. Conta trocada no meio (ou com a
   * última requisição em voo) também devolve `false`, sem alerta: quem chamou não avisa nem navega.
   */
  async tentar(rotulo: string, titulo: string, fn: () => Promise<unknown>): Promise<boolean> {
    if (this.ocupado || !this.vida.vivo()) return false;
    this.ocupado = rotulo;
    this.mudou();
    try {
      await this.esperar(fn());
      return true;
    } catch (e) {
      if (this.vida.encerrado(e)) return false;
      await urbiVerso.alertar({ titulo, mensagem: mensagemDeErro(e), tipo: 'erro' });
      return false;
    } finally {
      this.ocupado = null;
      this.mudou();
    }
  }

  /** Vai a outro passo salvando o atual. Os passos 3 e 4 precisam do rascunho criado. */
  async irPara(passo: PassoNovoImovel) {
    if (passo === this.passo || !this.vida.vivo()) return;
    // Autorização e Onde aparece pedem tipo e cidade (o rascunho já pode existir pelas fotos): sem eles, vai a Dados.
    if (indicePasso(passo) >= indicePasso('autorizacao') && this.faltamObrigatorios().length) {
      urbiVerso.notificar('Antes, preencha tipo e cidade no passo Dados.', 'info');
      this.tentouAvancar = true;
      passo = 'dados';
      if (passo === this.passo) return this.mudou();
    }
    const ok = await this.tentar('Salvando…', 'Não foi possível salvar o rascunho', async () => {
      await this.salvarDados();
      if (indicePasso(passo) >= indicePasso('autorizacao')) await this.garantirRascunho();
    });
    if (!ok) return;
    this.passo = passo;
    if (this.id) this.naUrl();
    else filtrosNaUrl(filtrosDaUrl(), { passo });
    this.mudou();
  }

  /** O passo Dados só avança com os obrigatórios preenchidos; os outros avançam sempre. */
  async proximo() {
    if (!this.vida.vivo()) return;
    if (this.passo === 'dados' && this.faltamObrigatorios().length) {
      this.tentouAvancar = true;
      this.mudou();
      urbiVerso.notificar('Preencha os campos destacados para continuar. Para parar agora, salve o rascunho.', 'info');
      return;
    }
    const i = indicePasso(this.passo);
    if (i < PASSOS_NOVO_IMOVEL.length - 1) await this.irPara(PASSOS_NOVO_IMOVEL[i + 1].id);
    else await this.concluir();
  }

  async voltar() {
    const i = indicePasso(this.passo);
    if (i > 0) await this.irPara(PASSOS_NOVO_IMOVEL[i - 1].id);
  }

  /** Salva o que há e vai para a ficha do rascunho na carteira. */
  async salvarRascunho() {
    if (!this.vida.vivo()) return;
    // Sem nada ainda (nem foto nem dado), não há o que guardar.
    if (!this.id && !this.sujo) {
      urbiVerso.notificar('Envie uma foto ou preencha um dado para guardar o rascunho.', 'info');
      return;
    }
    const ok = await this.tentar('Salvando…', 'Não foi possível salvar o rascunho', async () => {
      await this.salvarTudo();
    });
    if (!ok) return;
    urbiVerso.notificar('Rascunho salvo. Na ficha, "Continuar cadastro" volta a este passo.', 'sucesso');
    irParaComQuery(`/imoveis?item=${this.id}`);
  }

  /** Fotos: envia uma a uma, pede a leitura da IA (se ligada) e, com ela, a ordem sugerida (capa primeiro). */
  enviarFotos(arquivos: File[]) {
    return this.semAvisoDeOutraConta(() => this.enviarFotosNaConta(arquivos));
  }

  private async enviarFotosNaConta(arquivos: File[]) {
    if (!arquivos.length || this.ocupado) return;
    const recusados: string[] = [];
    let enviadas = 0;
    const ok = await this.tentar('Preparando o rascunho…', 'Não foi possível criar o rascunho', () => this.garantirRascunho());
    if (!ok) return;
    this.ocupado = 'Enviando…';
    const novas: Linha[] = [];
    try {
      for (const [i, f] of arquivos.entries()) {
        this.ocupado = `Enviando ${i + 1} de ${arquivos.length}…`;
        this.mudou();
        try {
          const upload_id = await this.esperar(subirArquivo('imovel_midias', 'arquivo', f));
          novas.push(await this.esperar(enviar('POST', `/imoveis/${this.id}/midias`, { upload_id, tipo: tipoDoArquivo(f) })));
          enviadas++;
        } catch (e) {
          if (this.vida.encerrado(e)) throw e;
          recusados.push(`${f.name}: ${mensagemDeErro(e)}`);
        }
      }
      if (this.ia.fotos) {
        const fotos = novas.filter((n) => n.tipo === 'foto');
        let lidas = 0;
        for (const [i, m] of fotos.entries()) {
          this.ocupado = `A IA está lendo as fotos (${i + 1} de ${fotos.length})…`;
          this.mudou();
          await this.esperar(
            enviar('POST', `/imoveis/${this.id}/midias/${m.id}/analisar`, {}).then(
              () => lidas++,
              () => undefined, // a leitura é bônus
            ),
          );
        }
        if (lidas) this.leuFotosAgora = true;
        // Sem nenhuma leitura, não há base para sugerir a capa: a ordem fica como estava, sem o selo.
        if (lidas) {
          const ordenou = await this.esperar(enviar('POST', `/imoveis/${this.id}/midias/ordem-sugerida`, {}).then(() => true, () => false));
          if (ordenou) this.capaSugerida = true;
        }
      }
    } finally {
      this.ocupado = null;
      // Com a conta trocada, não relê: a exceção `ContaTrocada` segue e o gesto termina em silêncio.
      if (this.vida.vivo()) await this.reler();
    }
    if (recusados.length) await urbiVerso.alertar({ titulo: 'Alguns arquivos não foram enviados', mensagem: recusados.join('\n'), tipo: 'alerta' });
    else if (enviadas) urbiVerso.notificar(`${enviadas} foto(s) enviada(s).`, 'sucesso');
  }

  /** Põe a foto em primeiro (a capa); a ordem das demais fica como está. */
  async usarComoCapa(m: Linha) {
    const todas = this.ficha!.midias;
    const ids = [m.id, ...todas.filter((x) => x.id !== m.id).map((x) => x.id)];
    const ok = await this.tentar('Mudando a capa…', 'Não foi possível mudar a capa', () => this.esperar(enviar('PUT', `/imoveis/${this.id}/midias/ordem`, { ids })));
    if (ok) {
      this.capaSugerida = false;
      await this.recarregar();
    }
  }

  /** Move a foto uma posição (setas, como na Página: o primitivo da grade não arrasta). */
  async moverFoto(m: Linha, delta: -1 | 1) {
    const ids = this.ficha!.midias.filter((x) => x.tipo === 'foto').map((x) => x.id);
    const outras = this.ficha!.midias.filter((x) => x.tipo !== 'foto').map((x) => x.id);
    const i = ids.indexOf(m.id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    const ok = await this.tentar('Mudando a ordem…', 'Não foi possível mudar a ordem', () => this.esperar(enviar('PUT', `/imoveis/${this.id}/midias/ordem`, { ids: [...ids, ...outras] })));
    if (ok) {
      if (i === 0 || j === 0) this.capaSugerida = false;
      await this.recarregar();
    }
  }

  apagarFoto(m: Linha) {
    return this.semAvisoDeOutraConta(async () => {
      const sim = await this.esperar(urbiVerso.confirmar({ titulo: 'Apagar foto', mensagem: 'A foto é apagada de vez.', rotuloConfirmar: 'Apagar', perigo: true }));
      if (!sim) return;
      const ok = await this.tentar('Apagando…', 'Não foi possível apagar', () => enviar('PATCH', `/imoveis/${this.id}/midias/${m.id}/remover`, {}));
      if (ok) await this.reler();
    });
  }

  /** Autorização: o documento assinado entra como arquivo interno do imóvel. */
  async anexarDocumento(arquivo: File | null) {
    if (!arquivo || !this.id) return;
    const ok = await this.tentar('Enviando o documento…', 'Não foi possível enviar o documento', async () => {
      const upload_id = await this.esperar(subirArquivo('imovel_midias', 'arquivo', arquivo));
      await this.esperar(enviar('POST', `/imoveis/${this.id}/midias`, { upload_id, tipo: 'documento' }));
    });
    if (ok) {
      urbiVerso.notificar('Documento anexado. Ele fica interno, fora do anúncio.', 'sucesso');
      await this.recarregar();
    }
  }

  // A autorização tem os próprios diálogos (autorizacao-venda.ts); aqui, a releitura depois só se a conta é a mesma.
  registrarAutorizacao() {
    return this.semAvisoDeOutraConta(async () => {
      if (!this.ficha) return;
      if (await this.esperar(registrarAutorizacao(this.ficha.imovel, { gesto: this.vida }))) await this.reler();
    });
  }

  marcarAssinada(a: Linha) {
    return this.semAvisoDeOutraConta(async () => {
      if (await this.esperar(marcarAssinada(a, this.ficha!.midias, 'aqui mesmo, em "Anexar o documento assinado",', { gesto: this.vida }))) await this.reler();
    });
  }

  escolherOnde(onde: 'so_voce' | 'publico') {
    if (!this.vida.vivo()) return;
    if (onde === 'publico' && !this.ficha?.autorizacao_vigente) {
      urbiVerso.notificar('Para aparecer na sua página, a autorização precisa estar assinada e vigente (passo 3).', 'info');
      return;
    }
    this.onde = onde;
    this.mudou();
  }

  /**
   * Fim: "público" ativa o imóvel e o publica na página (a rota confere a autorização vigente); "só você"
   * tira da página se estava, sem mudar a situação. Depois, a ficha na carteira.
   */
  async concluir() {
    const ok = await this.tentar('Concluindo…', 'Não foi possível concluir', async () => {
      await this.salvarTudo();
      // A última leitura pode ter falhado: decidir sobre a ficha nula ou velha publicaria às cegas.
      // `reler`, e não `recarregar`: com a conta trocada, `ContaTrocada` segue e a cadeia para aqui.
      if (this.falha || !this.ficha) await this.reler();
      if (this.falha || !this.ficha) throw this.falha ?? new Error('Não foi possível ler o imóvel. Tente de novo.');
      // A releitura pode ter deixado edição pendente (a sugestão das fotos): nada sai da tela sujo.
      if (this.sujo) await this.salvarTudo();
      const im = this.ficha.imovel;
      if (this.onde === 'publico') {
        await this.esperar(enviar('PATCH', `/imoveis/${this.id}`, { ...(['ativo', 'reservado'].includes(im.situacao) ? {} : { situacao: 'ativo' }), publicado_pagina: true }));
      } else if (im.publicado_pagina) {
        await this.esperar(enviar('PATCH', `/imoveis/${this.id}`, { publicado_pagina: false }));
      }
      // Digitado durante a publicação: ainda vai, antes de sair.
      if (this.sujo) await this.salvarTudo();
    });
    if (!ok) return;
    urbiVerso.notificar(this.onde === 'publico' ? 'Imóvel ativo e na sua página.' : 'Imóvel salvo. Só você vê.', 'sucesso');
    irParaComQuery(`/imoveis?item=${this.id}`);
  }
}

/** Avisa as três colunas que o estado mudou; elas leem sempre o estado `atual`. */
const canal = new EventTarget();
let atual = new NovoImovel();

/** A tela na moldura de Imóveis. Cada entrada (o `index.ts` recria a tela a cada navegação) começa um estado novo. */
export function renderNovoImovel(atualizar: () => void) {
  return moldura(
    {
      menu: '/imoveis',
      lista: html`<pc-novo-imovel-passos></pc-novo-imovel-passos>`,
      centro: html`<pc-novo-imovel-passo></pc-novo-imovel-passo>`,
      contexto: html`<pc-novo-imovel-qualidade></pc-novo-imovel-qualidade>`,
      rotulos: { lista: 'Passos', centro: 'Novo imóvel', contexto: 'Qualidade' },
      painel: 'centro',
    },
    atualizar,
  );
}

/**
 * Base das três colunas: redesenha quando o estado muda. O centro é quem começa um estado novo (a esquerda
 * conecta antes dele, por isso todas leem o `atual` na hora de desenhar).
 */
class ColunaNovoImovel extends LitElement {
  protected get estado() {
    return atual;
  }
  private aoMudar = () => this.requestUpdate();

  connectedCallback() {
    super.connectedCallback();
    canal.addEventListener('mudou', this.aoMudar);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    canal.removeEventListener('mudou', this.aoMudar);
  }
}

/** Resumo de cada passo na coluna da esquerda. */
function resumoDoPasso(e: NovoImovel, passo: PassoNovoImovel): string {
  const f = e.ficha;
  switch (passo) {
    case 'fotos': {
      const n = e.fotos().length;
      return n ? `${n} enviada(s)` : 'a IA lê e ordena';
    }
    case 'dados': {
      const faltam = obrigatoriosVazios(e.form as unknown as Record<string, unknown>);
      return faltam.length ? `falta: ${faltam.join(', ').toLowerCase()}` : e.preenchidoPelaIa('caracteristicas') ? 'a IA ajudou' : 'conferidos';
    }
    case 'autorizacao':
      return f?.autorizacao_vigente ? 'assinada e vigente' : f?.autorizacoes.length ? 'registrada' : 'opcional no rascunho';
    case 'onde':
      return e.onde === 'publico' ? 'público' : 'só você ou público';
  }
}

// Esquerda (P07): título, os 4 passos com ✓ quando têm o essencial e [Salvar rascunho].
@customElement('pc-novo-imovel-passos')
export class PcNovoImovelPassos extends ColunaNovoImovel {
  render() {
    const e = this.estado;
    // Imóvel que a conta não enxerga (de outra conta, ou removido): só o centro fala, com "não encontrado".
    if (e.falha && !e.ficha) return nothing;
    const feito = (p: PassoNovoImovel) =>
      p === 'fotos'
        ? e.fotos().length > 0
        : p === 'dados'
          ? !!e.id && !obrigatoriosVazios(e.form as unknown as Record<string, unknown>).length
          : p === 'autorizacao'
            ? !!e.ficha?.autorizacao_vigente
            : !!e.ficha?.imovel.publicado_pagina;
    const passos = PASSOS_NOVO_IMOVEL.map((p, i) => ({ ...p, i }));
    return html`<urbi-stack>
      <urbi-stack>
        ${cabecalhoColuna(e.ficha ? `${e.ficha.imovel.codigo} · rascunho` : 'Novo imóvel')}
        <urbi-prosa papel="fraco">Leva cerca de 3 minutos. Nenhum passo pede CRECI.</urbi-prosa>
      </urbi-stack>
      <urbi-lista separador clicavel .itens=${passos} .itemAtivo=${(p: (typeof passos)[number]) => p.id === e.passo}
        .render_item=${(p: (typeof passos)[number]) => html`<urbi-linha>
          ${feito(p.id)
            ? html`<urbi-badge cor="sucesso" title="Pronto"><urbi-icone classe="fa-solid fa-check"></urbi-icone></urbi-badge>`
            : html`<urbi-badge>${p.i + 1}</urbi-badge>`}
          <urbi-stack>
            <urbi-prosa>${p.rotulo}</urbi-prosa>
            <urbi-prosa papel="fraco" truncar>${resumoDoPasso(e, p.id)}</urbi-prosa>
          </urbi-stack>
        </urbi-linha>`}
        @urbi:lista-click=${(ev: CustomEvent) => void e.irPara((ev.detail.item as (typeof passos)[number]).id)}></urbi-lista>
      <urbi-botao variante="secundario" icone="fa-solid fa-floppy-disk" ?desabilitado=${!!e.ocupado} @click=${() => e.salvarRascunho()}>Salvar rascunho</urbi-botao>
    </urbi-stack>`;
  }
}

// Centro (P07 e M3): o passo, com "Passo n de 4" e o rodapé [Voltar] [Salvar rascunho] [Próximo].
@customElement('pc-novo-imovel-passo')
export class PcNovoImovelPasso extends ColunaNovoImovel {
  connectedCallback() {
    atual = new NovoImovel();
    super.connectedCallback();
    void atual.abrir();
  }

  /** Tipo e cidade: obrigatórios; o "Obrigatório" só depois de mexer no campo ou de tentar avançar (#182, item 4). */
  private campoTipo() {
    const e = this.estado;
    return html`<urbi-select label="Tipo" obrigatorio valor=${e.form.tipo} placeholder="Escolha" erro=${e.mostrarErro('tipo') ? 'Obrigatório' : ''}
      .opcoes=${opcoes(ROTULO_TIPO_IMOVEL)} @urbi:select-change=${(ev: CustomEvent) => e.editar('tipo', ev.detail.valor)}></urbi-select>`;
  }

  private campoCidade() {
    const e = this.estado;
    return html`<urbi-input label="Cidade" obrigatorio valor=${e.form.cidade} erro=${e.mostrarErro('cidade') ? 'Obrigatório' : ''}
      @urbi:input-change=${(ev: CustomEvent) => e.editar('cidade', ev.detail.valor)}></urbi-input>`;
  }

  private fotos() {
    const e = this.estado;
    const fotos = e.fotos();
    const lidas = fotos.filter((m) => m.ia_ambiente);
    // O cadastro começa pelas fotos (P07 e M3): o rascunho nasce com a primeira, sem pedir tipo nem
    // cidade (que vêm no passo 2). O botão grande vem no topo.
    return html`<urbi-stack>
      <urbi-seletor-arquivo drop multiplo variante="primario" icone="fa-solid fa-camera" texto="Tirar fotos ou escolher da galeria"
        accept="image/jpeg,image/png,image/webp" dica="Fotos JPG, PNG ou WEBP, até 25 MB cada. Com 8 ou mais, o anúncio ganha pontos."
        ?desabilitado=${!!e.ocupado} @urbi:seletor-arquivo-change=${(ev: CustomEvent) => e.enviarFotos((ev.detail.arquivos as File[]) ?? [])}></urbi-seletor-arquivo>
      <urbi-prosa papel="secundario">${e.ia.fotos
        ? 'Envie as fotos de uma vez: a IA lê cada uma, diz o ambiente e põe a melhor de capa. Depois você muda a ordem com as setas.'
        : 'Envie as fotos de uma vez. A primeira é a capa; mude a ordem com as setas.'}</urbi-prosa>
      ${lidas.length
        ? html`<urbi-banner variante="info">A IA já entendeu: ${[...new Set(lidas.map((m) => (ROTULO_AMBIENTE[m.ia_ambiente] ?? m.ia_ambiente).toLowerCase()))].join(', ')}.</urbi-banner>`
        : nothing}
      ${fotos.length
        ? html`<urbi-grid min="128px" gap="12px">
            ${fotos.map(
              (m, i) => html`<urbi-stack>
                <urbi-avatar nome=${m.legenda ?? 'Foto'} foto=${m.url ?? ''} tamanho="112"></urbi-avatar>
                ${i === 0 ? html`<urbi-badge cor=${e.capaSugerida ? 'info' : 'padrao'}>${e.capaSugerida ? 'Capa sugerida' : 'Capa'}</urbi-badge>` : nothing}
                <urbi-prosa papel="fraco" truncar>${m.ia_ambiente ? (ROTULO_AMBIENTE[m.ia_ambiente] ?? m.ia_ambiente) : (m.legenda ?? `Foto ${i + 1}`)}</urbi-prosa>
                <urbi-linha>
                  <urbi-botao variante="fantasma" icone="fa-solid fa-arrow-left" ariaLabel="Mover para antes" title="Mover para antes"
                    ?desabilitado=${!!e.ocupado || i === 0} @click=${() => e.moverFoto(m, -1)}></urbi-botao>
                  <urbi-botao variante="fantasma" icone="fa-solid fa-arrow-right" ariaLabel="Mover para depois" title="Mover para depois"
                    ?desabilitado=${!!e.ocupado || i === fotos.length - 1} @click=${() => e.moverFoto(m, 1)}></urbi-botao>
                  <urbi-botao variante="fantasma" icone="fa-solid fa-trash" ariaLabel="Apagar" title="Apagar" ?desabilitado=${!!e.ocupado}
                    @click=${() => e.apagarFoto(m)}></urbi-botao>
                </urbi-linha>
              </urbi-stack>`,
            )}
          </urbi-grid>`
        : html`<urbi-prosa papel="dica">Sem fotos ainda. Pode seguir sem elas e voltar depois: o rascunho guarda o que já foi feito.</urbi-prosa>`}
      ${e.id
        ? nothing
        : html`<urbi-input label="Seu código (opcional)" valor=${e.form.codigo} placeholder="Em branco: IM-0001, IM-0002…"
            @urbi:input-change=${(ev: CustomEvent) => e.editar('codigo', ev.detail.valor)}></urbi-input>`}
    </urbi-stack>`;
  }

  private dados() {
    const e = this.estado;
    const f = e.form;
    const rotulo = (campo: keyof Formulario, base: string) => (e.preenchidoPelaIa(campo) ? `${base} · preenchido pela IA` : base);
    const num = (campo: keyof Formulario, base: string, op: { step?: number; max?: number } = {}) =>
      html`<urbi-input-numero label=${rotulo(campo, base)} .valor=${f[campo] as number | null} .min=${0} .max=${op.max ?? null} .step=${op.step ?? 1}
        @urbi:input-numero-change=${(ev: CustomEvent) => e.editar(campo, ev.detail.valor)}></urbi-input-numero>`;
    // Dinheiro e área em texto, no formato brasileiro (#185): o campo numérico do navegador perdia o
    // ponto de milhar ("1.450.000" virava R$ 1,45). A string vai como está; o backend lê.
    const valor = (campo: 'preco' | 'condominio' | 'area_util_m2', base: string, exemplo: string) =>
      html`<urbi-input label=${rotulo(campo, base)} valor=${f[campo]} placeholder=${exemplo}
        @urbi:input-change=${(ev: CustomEvent) => e.editar(campo, ev.detail.valor)}></urbi-input>`;
    const texto = (campo: keyof Formulario, base: string, op: { placeholder?: string } = {}) =>
      html`<urbi-input label=${rotulo(campo, base)} valor=${String(f[campo] ?? '')} placeholder=${op.placeholder ?? ''}
        @urbi:input-change=${(ev: CustomEvent) => e.editar(campo, ev.detail.valor)}></urbi-input>`;
    return html`<urbi-stack>
      <urbi-prosa papel="secundario">${e.sugeridasPelasFotos().length
        ? 'A IA leu as fotos e preencheu o que elas mostram. Confira e complete o resto.'
        : 'Confira e complete. Só tipo e cidade são obrigatórios; o resto conta para a qualidade do anúncio.'}</urbi-prosa>
      ${e.ia.conteudo
        ? html`<urbi-card titulo="Ditar o resto" icone="fa-solid fa-microphone">
            <urbi-stack>
              <urbi-prosa papel="fraco">Fale (ou escreva) o que falta: "apartamento de 3 quartos no Sudoeste, 120 metros, um milhão e quatrocentos, condomínio de 1.200". A IA preenche os campos que você ainda não mexeu.</urbi-prosa>
              <urbi-redator audio placeholder="Toque no microfone ou escreva…" chave-audio="novo-imovel-ditado" ?upload-em-andamento=${e.ditando}
                @urbi:redator-enviar=${(ev: CustomEvent) => void e.ditar(String(ev.detail.texto ?? ''))}></urbi-redator>
              ${e.ditando ? html`<urbi-prosa papel="secundario">A IA está preenchendo…</urbi-prosa>` : nothing}
            </urbi-stack>
          </urbi-card>`
        : html`<urbi-prosa papel="dica">Ditar os dados pede a IA de conteúdo, que não está disponível agora: preencha à mão.</urbi-prosa>`}
      <urbi-grid min="180px" gap="12px">
        ${this.campoTipo()}
        ${texto('bairro', 'Bairro')}
        ${this.campoCidade()}
        ${texto('uf', 'UF', { placeholder: 'DF' })}
        ${num('quartos', 'Quartos', { max: 99 })}
        ${num('suites', 'Suítes', { max: 99 })}
        ${num('banheiros', 'Banheiros', { max: 99 })}
        ${num('vagas', 'Vagas', { max: 99 })}
        ${valor('area_util_m2', 'Área útil (m²)', '120,5')}
        ${valor('preco', 'Preço (R$)', '1.450.000')}
        ${valor('condominio', 'Condomínio (R$)', '1.200')}
      </urbi-grid>
      ${texto('titulo', 'Título (opcional)', { placeholder: 'Ex.: Casa com piscina no Jardim Botânico' })}
      <urbi-textarea label=${rotulo('caracteristicas', 'Características (separe por vírgula)')} valor=${f.caracteristicas}
        placeholder="piscina, churrasqueira, armários planejados" @urbi:input-change=${(ev: CustomEvent) => e.editar('caracteristicas', ev.detail.valor)}></urbi-textarea>
    </urbi-stack>`;
  }

  private autorizacao() {
    const e = this.estado;
    const auts = e.ficha?.autorizacoes ?? [];
    const aberta = autorizacaoAberta(auts);
    const documentos = (e.ficha?.midias ?? []).filter((m) => m.tipo === 'documento');
    return html`<urbi-stack>
      <urbi-prosa papel="secundario">Opcional para o rascunho. Para anunciar (ativo ou na sua página), a autorização precisa estar assinada,
        com o documento anexado, e dentro da vigência. O documento fica interno: nunca aparece no anúncio.</urbi-prosa>
      ${auts.length
        ? html`<urbi-lista separador .itens=${auts} .render_item=${(a: Linha) => {
            const s = SITUACAO_AUTORIZACAO[a.situacao_efetiva] ?? { rotulo: a.situacao_efetiva, cor: 'padrao' };
            return html`<urbi-linha justificar="entre" quebrar>
              <urbi-stack>
                <urbi-prosa>${data(a.inicio)} a ${data(a.fim)} · ${Number(a.comissao_pct)}% · ${reais(a.preco_autorizado_c)}</urbi-prosa>
                <urbi-prosa papel="fraco">${a.proprietario_nome ?? ''}${a.exclusiva ? ' · exclusiva' : ''}</urbi-prosa>
              </urbi-stack>
              <urbi-badge cor=${s.cor}>${s.rotulo}</urbi-badge>
            </urbi-linha>`;
          }}></urbi-lista>`
        : html`<urbi-prosa papel="dica">Nenhuma autorização registrada. Pode pular e registrar depois, pela ficha.</urbi-prosa>`}
      <urbi-linha quebrar>
        ${aberta
          ? html`<urbi-botao icone="fa-solid fa-signature" ?desabilitado=${!!e.ocupado} @click=${() => e.marcarAssinada(aberta)}>Marcar como assinada</urbi-botao>`
          : html`<urbi-botao variante=${e.ficha?.autorizacao_vigente ? 'secundario' : 'primario'} icone="fa-solid fa-file-signature" ?desabilitado=${!!e.ocupado}
              @click=${() => e.registrarAutorizacao()}>Registrar autorização</urbi-botao>`}
      </urbi-linha>
      <urbi-seletor-arquivo label="Anexar o documento assinado" icone="fa-solid fa-paperclip" texto="Escolher PDF ou foto"
        accept="application/pdf,image/jpeg,image/png,image/webp" ?desabilitado=${!!e.ocupado}
        @urbi:seletor-arquivo-change=${(ev: CustomEvent) => e.anexarDocumento(ev.detail.arquivo as File | null)}></urbi-seletor-arquivo>
      ${documentos.length ? html`<urbi-prosa papel="fraco">${documentos.length} documento(s) anexado(s), todos internos.</urbi-prosa>` : nothing}
    </urbi-stack>`;
  }

  private onde() {
    const e = this.estado;
    const vigente = !!e.ficha?.autorizacao_vigente;
    const opcoesOnde = [
      { id: 'so_voce' as const, icone: 'fa-solid fa-lock', titulo: 'Só você', texto: 'Fica na sua carteira. Você envia aos clientes quando quiser, pelas seleções.' },
      {
        id: 'publico' as const,
        icone: 'fa-solid fa-globe',
        titulo: 'Público',
        texto: vigente ? 'Fica ativo e aparece na sua página pública.' : 'Precisa da autorização assinada e vigente (passo 3).',
      },
    ];
    return html`<urbi-stack>
      <urbi-prosa papel="secundario">Quem vê este imóvel. Dá para mudar depois, na ficha.</urbi-prosa>
      <urbi-lista separador clicavel .itens=${opcoesOnde} .itemAtivo=${(o: (typeof opcoesOnde)[number]) => o.id === e.onde}
        .render_item=${(o: (typeof opcoesOnde)[number]) => html`<urbi-linha>
          <urbi-icone classe=${o.icone}></urbi-icone>
          <urbi-stack>
            <urbi-prosa>${o.titulo}${o.id === e.onde ? ' · escolhido' : ''}</urbi-prosa>
            <urbi-prosa papel="fraco">${o.texto}</urbi-prosa>
          </urbi-stack>
        </urbi-linha>`}
        @urbi:lista-click=${(ev: CustomEvent) => e.escolherOnde((ev.detail.item as (typeof opcoesOnde)[number]).id)}></urbi-lista>
    </urbi-stack>`;
  }

  render() {
    const e = this.estado;
    if (e.falha && !e.ficha) return estadoDaFalha(e.falha, () => void e.recarregar());
    if (e.carregando) return estadoTela('carregando');
    const i = indicePasso(e.passo);
    const passo = PASSOS_NOVO_IMOVEL[i];
    const ultimo = i === PASSOS_NOVO_IMOVEL.length - 1;
    const proximo = ultimo ? 'Concluir' : `Próximo: ${PASSOS_NOVO_IMOVEL[i + 1].rotulo.toLowerCase()}`;
    const conteudo = { fotos: () => this.fotos(), dados: () => this.dados(), autorizacao: () => this.autorizacao(), onde: () => this.onde() }[e.passo]();
    return html`<urbi-stack>
      <urbi-linha justificar="entre" quebrar>
        <urbi-prosa papel="titulo">${passo.rotulo}</urbi-prosa>
        <urbi-badge cor="info">Passo ${i + 1} de ${PASSOS_NOVO_IMOVEL.length}</urbi-badge>
      </urbi-linha>
      ${conteudo}
      ${e.ocupado ? html`<urbi-prosa papel="secundario">${e.ocupado}</urbi-prosa>` : nothing}
      <urbi-linha justificar="entre" quebrar>
        <urbi-botao variante="texto" icone="fa-solid fa-arrow-left" ?desabilitado=${i === 0 || !!e.ocupado} @click=${() => e.voltar()}>Voltar</urbi-botao>
        <urbi-linha quebrar>
          <urbi-botao variante="secundario" ?desabilitado=${!!e.ocupado} @click=${() => e.salvarRascunho()}>Salvar rascunho</urbi-botao>
          <urbi-botao ?desabilitado=${!!e.ocupado} @click=${() => e.proximo()}>${proximo}</urbi-botao>
        </urbi-linha>
      </urbi-linha>
    </urbi-stack>`;
  }
}

// Direita (P07): "Qualidade agora · n" com o que falta, calculada dos dados na tela (antes de salvar),
// e a caixa da IA: o que ela leu das fotos e o que faz depois de salvar. A barra de qualidade é lacuna
// (spec 11.9): a nota vai em `urbi-badge` colorido com `urbi-bolinhas`, a mesma exceção nomeada da ficha.
@customElement('pc-novo-imovel-qualidade')
export class PcNovoImovelQualidade extends ColunaNovoImovel {
  private qualidade() {
    const e = this.estado;
    const f = e.form;
    const im = e.ficha?.imovel ?? {};
    return qualidadeAnuncio(
      {
        tipo: f.tipo,
        descricao: im.descricao ?? null,
        preco_c: reaisParaCentavos(f.preco) || null,
        area_util_m2: Number(String(f.area_util_m2).replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')) || null,
        area_total_m2: im.area_total_m2 ?? null,
        quartos: f.quartos,
        banheiros: f.banheiros,
        bairro: f.bairro || null,
        cidade: f.cidade || null,
      },
      { fotosPublicas: e.ficha?.fotos_publicas ?? 0, autorizacaoVigente: !!e.ficha?.autorizacao_vigente },
    );
  }

  private ia() {
    const e = this.estado;
    const fotos = e.fotos();
    const lidas = fotos.filter((m) => m.ia_ambiente);
    const ambientes = [...new Set(lidas.map((m) => ROTULO_AMBIENTE[m.ia_ambiente] ?? m.ia_ambiente))];
    const sugeridas = e.sugeridasPelasFotos();
    const frases: string[] = [];
    if (!e.ia.fotos) frases.push('A leitura das fotos pela IA não está disponível agora: complete os dados à mão.');
    else if (lidas.length) {
      frases.push(`Li ${lidas.length} foto(s): ${ambientes.join(', ').toLowerCase()}.`);
      if (sugeridas.length) frases.push(`Pus nas características o que as fotos mostram: ${sugeridas.join(', ')}.`);
    } else frases.push('Envie as fotos: eu digo o ambiente de cada uma e sugiro a capa.');
    // P07: o que a IA faz depois de salvar, numa frase só.
    const depois = [
      ...(e.ia.conteudo ? ['escrever a descrição'] : []),
      'montar o pacote de lançamento no Estúdio',
      ...(e.combinam ? [`avisar ${e.combinam} cliente(s) que combinam`] : []),
    ];
    frases.push(`Depois de salvar posso: ${depois.join(', ')}.`);
    return frases;
  }

  render() {
    if (this.estado.falha && !this.estado.ficha) return nothing;
    const q = this.qualidade();
    return html`<urbi-stack>
      <urbi-card titulo=${`Qualidade agora · ${q.nota}`} icone="fa-solid fa-list-check">
        <urbi-stack>
          <urbi-linha>
            <urbi-badge cor=${corQualidade(q.nota)}>${q.nota} de 100</urbi-badge>
            <urbi-bolinhas valor=${Math.round(q.nota / 10)} maximo="10" .glow=${false}></urbi-bolinhas>
          </urbi-linha>
          ${q.faltas.length
            ? html`<urbi-lista separador .itens=${q.faltas} .render_item=${(f: string) => html`<urbi-linha>
                <urbi-icone classe="fa-solid fa-plus"></urbi-icone>
                <urbi-prosa>${f}</urbi-prosa>
              </urbi-linha>`}></urbi-lista>`
            : html`<urbi-prosa papel="sucesso">Nada falta no anúncio.</urbi-prosa>`}
        </urbi-stack>
      </urbi-card>
      <urbi-card titulo="A IA" icone="fa-solid fa-wand-magic-sparkles">
        <urbi-stack>
          ${this.ia().map((f) => html`<urbi-prosa papel="secundario">${f}</urbi-prosa>`)}
          <urbi-botao variante="secundario" icone="fa-solid fa-wand-magic-sparkles" ?desabilitado=${!this.estado.id}
            title=${this.estado.id ? 'Abre o Estúdio com este imóvel' : 'Envie uma foto ou salve o rascunho antes'}
            @click=${() => irParaComQuery(`/estudio?criar=post&imovel=${this.estado.id}`)}>Pacote de lançamento</urbi-botao>
        </urbi-stack>
      </urbi-card>
    </urbi-stack>`;
  }
}
