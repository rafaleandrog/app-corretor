import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { CampoFormulario, UrbiVersoAPI } from '@urbiverso/sdk';
import { FORMATOS, MAX_SLIDES, OBJETIVOS, ROTULO_FORMATO, ROTULO_OBJETIVO, type Formato } from '../../comum/estudio';
import { dataHora, enviar, juntarDataHora, mensagemDeErro, subirArquivo } from '../apoio';

declare const urbiVerso: UrbiVersoAPI;

type Linha = Record<string, any>;
interface Marca {
  nome: string;
  creci: string | null;
  cor_primaria: string;
  cor_secundaria: string;
  estilo: string;
  assinatura: string | null;
  salva: boolean;
  logo_url: string | null;
  foto_url: string | null;
}
/** O que o Canva IA precisa (GET /estudio/pecas/:id/canva): a instrução, as fotos e o logo. */
interface Canva {
  prompt: string;
  fotos: { url: string; legenda: string | null }[];
  logo_url: string | null;
  abrir: string;
}
const CANVA = 'https://www.canva.com/ai';
const ESTADO: Record<string, { cor: string; rotulo: string }> = {
  rascunho: { cor: 'padrao', rotulo: 'rascunho' },
  aprovada: { cor: 'sucesso', rotulo: 'aprovada' },
  agendada: { cor: 'info', rotulo: 'agendada' },
  publicando: { cor: 'info', rotulo: 'publicando…' },
  publicada: { cor: 'sucesso', rotulo: 'publicada' },
  rejeitada: { cor: 'alerta', rotulo: 'rejeitada' },
  erro: { cor: 'erro', rotulo: 'com erro' },
};
const MOTOR: Record<string, string> = { interno: 'gerador do app', canva_ia: 'arte do Canva', upload: 'arte enviada' };
const ESTILOS = [
  { valor: 'moderno', rotulo: 'Moderno' },
  { valor: 'classico', rotulo: 'Clássico' },
  { valor: 'minimalista', rotulo: 'Minimalista' },
];

// Estúdio de Conteúdo (bloco 8a, D-74, D-79): pedido em texto ou voz; aqui saem só os textos e a
// instrução para o Canva IA, a imagem é gerada no Canva e enviada de volta na peça; aprovação e
// biblioteca para baixar. O CRECI sem cadastro é lembrete, nunca trava (D-79).
// Prévia das artes por urbi-avatar e urbi-visualizador-arquivo (exceção de "cartão de arte", 11.5).
@customElement('pc-tela-estudio')
export class PcTelaEstudio extends LitElement {
  @state() private pecas: Linha[] = [];
  @state() private marca: Marca | null = null;
  @state() private falha: string | null = null;
  @state() private trabalhando: string | null = null;
  @state() private ouvindo = false;
  /** Aprovação por janela (Ajustes › Conta e marca): o rascunho pode ser agendado. */
  @state() private janela = false;
  /** Peças com a instrução do Canva aberta, e o que já foi buscado para cada uma. */
  @state() private abertas = new Set<number>();
  @state() private canvas: Record<number, Canva> = {};

  connectedCallback() {
    super.connectedCallback();
    void this.carregar();
  }

  private async carregar() {
    this.falha = null;
    try {
      const [p, m, c] = await Promise.all([urbiVerso.api('/estudio/pecas'), urbiVerso.api('/estudio/marca'), urbiVerso.api('/conta').catch(() => null)]);
      this.pecas = p.dados;
      this.marca = m;
      this.janela = c?.configuracoes?.modo_aprovacao_conteudo === 'janela';
    } catch (e) {
      this.falha = (e as Error).message;
    }
  }

  private async imoveisAnunciaveis(): Promise<Linha[]> {
    const lista: Linha[] = [];
    for (const situacao of ['ativo', 'reservado']) {
      for (let pagina = 1; pagina <= 20; pagina++) {
        const r = await urbiVerso.api(`/imoveis?situacao=${situacao}&pagina=${pagina}`);
        lista.push(...(r.dados ?? []));
        if (pagina >= (r.paginas ?? 1)) break;
      }
    }
    return lista;
  }

  /** Voz: transcrição no navegador (Web Speech), quando o navegador oferece; o texto vai para o pedido. */
  private ouvir(): Promise<string | null> {
    const Reconhecimento = (window as unknown as Record<string, any>).SpeechRecognition ?? (window as unknown as Record<string, any>).webkitSpeechRecognition;
    if (!Reconhecimento) {
      void urbiVerso.alertar({ titulo: 'Voz indisponível neste navegador', mensagem: 'Escreva o pedido. O Chrome e o Edge transcrevem a voz.', tipo: 'alerta' });
      return Promise.resolve(null);
    }
    return new Promise((ok) => {
      const r = new Reconhecimento();
      r.lang = 'pt-BR';
      r.interimResults = false;
      let texto = '';
      r.onresult = (e: any) => (texto = Array.from(e.results).map((x: any) => x[0].transcript).join(' '));
      r.onend = () => {
        this.ouvindo = false;
        ok(texto || null);
      };
      r.onerror = () => {
        this.ouvindo = false;
        ok(null);
      };
      this.ouvindo = true;
      r.start();
    });
  }

  private async novoPedido(falado: string | null = null) {
    let imoveis: Linha[] = [];
    try {
      imoveis = await this.imoveisAnunciaveis();
    } catch {
      imoveis = [];
    }
    const campos: CampoFormulario[] = [
      { nome: 'pedido', tipo: 'texto_longo', rotulo: 'O que você quer?', valor: falado ?? '', placeholder: 'Ex.: post de lançamento desta casa e um story, tom sofisticado.' },
      {
        nome: 'imovel_id', tipo: 'selecao', rotulo: 'Imóvel', pesquisavel: true, valor: '',
        opcoes: [{ valor: '', rotulo: 'Sem imóvel (peça institucional)' }, ...imoveis.map((i) => ({ valor: String(i.id), rotulo: `${i.codigo} · ${i.titulo ?? i.tipo}`, textoBusca: `${i.bairro ?? ''} ${i.cidade ?? ''}` }))],
      },
      { nome: 'objetivo', tipo: 'selecao', rotulo: 'Objetivo', valor: 'novo_imovel', opcoes: OBJETIVOS.map((o) => ({ valor: o, rotulo: ROTULO_OBJETIVO[o] })) },
      ...FORMATOS.map((f): CampoFormulario => ({ nome: `f_${f}`, tipo: 'booleano', rotulo: ROTULO_FORMATO[f], valor: f === 'post_1x1' })),
    ];
    const v = await urbiVerso.formulario({ titulo: 'Novo pedido', campos, mensagem: 'O app escreve os textos (com IA, quando liberada) e a instrução para gerar a arte no Canva IA. Você envia a arte e revisa antes de aprovar.', rotuloConfirmar: 'Criar' });
    if (!v) return;
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
      mensagem: 'Post, carrossel e story do imóvel: os textos e uma instrução do Canva IA para cada um.',
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
    this.trabalhando = 'Escrevendo os textos e a instrução para o Canva…';
    try {
      const r = await enviar('POST', rota, corpo);
      urbiVerso.notificar(`${r.pecas.length} peça(s) criada(s)${r.ia ? '' : ' (textos pelo modelo: a IA não está liberada agora)'}. Agora faça a arte no Canva e envie aqui.`, 'sucesso');
      // As peças novas já abrem com a instrução e as fotos à vista.
      for (const p of r.pecas as Linha[]) void this.abrirCanva(p.id);
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
      mensagem: 'Mudou o título, a chamada ou os destaques? A instrução do Canva muda junto: copie de novo e refaça a arte lá.',
    });
    if (!v) return;
    await this.acao(() => enviar('PATCH', `/estudio/pecas/${p.id}`, { ...v, destaques: String(v.destaques ?? '').split(',').map((d) => d.trim()).filter(Boolean) }), 'Textos salvos.');
    const { [p.id]: _, ...resto } = this.canvas;
    this.canvas = resto;
    if (this.abertas.has(p.id)) void this.abrirCanva(p.id);
  }

  /** Busca a instrução e as fotos do Canva (D-74) e mostra na peça. */
  private async abrirCanva(id: number): Promise<Canva | null> {
    this.abertas = new Set(this.abertas).add(id);
    if (this.canvas[id]) return this.canvas[id];
    try {
      const r = (await urbiVerso.api(`/estudio/pecas/${id}/canva`)) as Canva;
      this.canvas = { ...this.canvas, [id]: r };
      return r;
    } catch (e) {
      this.fecharCanva(id);
      await urbiVerso.alertar({ titulo: 'Não foi possível preparar a instrução', mensagem: mensagemDeErro(e), tipo: 'erro' });
      return null;
    }
  }

  private fecharCanva(id: number) {
    const abertas = new Set(this.abertas);
    abertas.delete(id);
    this.abertas = abertas;
  }

  private async copiarInstrucao(p: Linha) {
    const c = await this.abrirCanva(p.id);
    if (!c) return;
    try {
      await navigator.clipboard.writeText(c.prompt);
      urbiVerso.notificar('Instrução copiada: cole no "O que vamos criar hoje?" do Canva IA.', 'sucesso');
    } catch {
      urbiVerso.notificar('Copie a instrução que aparece na peça.', 'info');
    }
  }

  private async enviarArte(p: Linha, e: CustomEvent) {
    const limite = p.formato === 'carrossel' ? MAX_SLIDES : 1;
    const arquivos = ((e.detail.arquivos as File[]) ?? []).slice(0, limite);
    if (!arquivos.length || this.trabalhando) return;
    // Trocar uma arte que já existe pede confirmação (o seletor também avisa quando um arquivo sai da lista).
    if (p.arquivos?.length) {
      const ok = await urbiVerso.confirmar({ titulo: 'Trocar a arte', mensagem: `A arte da peça passa a ser ${arquivos.length === 1 ? 'esta imagem' : `estas ${arquivos.length} imagens, nesta ordem`}.`, rotuloConfirmar: 'Trocar' });
      if (!ok) return;
    }
    this.trabalhando = 'Enviando a arte…';
    try {
      const uploads: number[] = [];
      for (const f of arquivos) uploads.push(await subirArquivo('peca_arquivos', 'arquivo', f));
      await enviar('PUT', `/estudio/pecas/${p.id}/arquivos`, { upload_ids: uploads, motor: 'canva_ia' });
      this.fecharCanva(p.id);
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

  private async editarMarca() {
    const m = this.marca!;
    const v = await urbiVerso.formulario({
      titulo: 'Sua marca',
      campos: [
        { nome: 'cor_primaria', tipo: 'texto', rotulo: 'Cor principal (#RRGGBB)', obrigatorio: true, valor: m.cor_primaria },
        { nome: 'cor_secundaria', tipo: 'texto', rotulo: 'Cor de apoio (#RRGGBB)', obrigatorio: true, valor: m.cor_secundaria },
        { nome: 'estilo', tipo: 'selecao', rotulo: 'Estilo', opcoes: ESTILOS, valor: m.estilo },
        { nome: 'assinatura', tipo: 'texto', rotulo: 'Assinatura curta (opcional)', valor: m.assinatura ?? '', placeholder: 'Ex.: Seu corretor no Lago Sul' },
      ],
    });
    if (v) await this.acao(() => enviar('PUT', '/estudio/marca', v), 'Marca salva.');
  }

  private async enviarMarca(tipo: 'logo' | 'foto', e: CustomEvent) {
    const f = ((e.detail.arquivos as File[]) ?? [])[0];
    if (!f) return;
    await this.acao(async () => enviar('POST', '/estudio/marca/arquivos', { tipo, upload_id: await subirArquivo('marca_arquivos', 'arquivo', f) }), tipo === 'logo' ? 'Logo salvo.' : 'Foto salva.');
  }

  /** Seletor da arte do Canva: grande, com área de arrastar, enquanto a peça não tem arte. */
  private seletorArte(p: Linha, primeira: boolean) {
    const carrossel = p.formato === 'carrossel';
    return html`<urbi-seletor-arquivo
      accept="image/jpeg,image/png"
      ?multiplo=${carrossel}
      ?drop=${primeira}
      ?desabilitado=${!!this.trabalhando}
      variante=${primeira ? 'primario' : 'fantasma'}
      icone="fa-solid fa-upload"
      texto=${primeira ? (carrossel ? 'Enviar as imagens do Canva' : 'Enviar a arte do Canva') : 'Trocar a arte'}
      dica=${carrossel ? `Arraste aqui as imagens baixadas do Canva, todas juntas e na ordem dos slides (de 2 a ${MAX_SLIDES}, JPG ou PNG)` : 'Arraste aqui a imagem baixada do Canva (JPG ou PNG)'}
      @urbi:seletor-arquivo-change=${(e: CustomEvent) => this.enviarArte(p, e)}
    ></urbi-seletor-arquivo>`;
  }

  /** A instrução e as fotos para o Canva IA, à vista na peça. */
  private instrucao(p: Linha) {
    const c = this.canvas[p.id];
    if (!c) return html`<urbi-loading></urbi-loading>`;
    const anexos = c.fotos.length || c.logo_url;
    return html`<urbi-stack>
      <urbi-prosa papel="secao">Instrução para o Canva IA</urbi-prosa>
      <urbi-prosa pre>${c.prompt}</urbi-prosa>
      <urbi-prosa papel="secundario">${anexos ? 'Para anexar no Canva (abra e baixe):' : 'Sem fotos públicas do imóvel: anexe as suas no Canva, se quiser.'}</urbi-prosa>
      ${anexos
        ? html`<urbi-linha quebrar>
            ${c.fotos.map((f, i) => html`<urbi-visualizador-arquivo pequeno variante="secundario" rotulo=${`Foto ${i + 1}`} url=${f.url} nome=${`${p.imovel_codigo ?? 'foto'}-${i + 1}.jpg`} mime="image/jpeg"></urbi-visualizador-arquivo>`)}
            ${c.logo_url ? html`<urbi-visualizador-arquivo pequeno variante="secundario" rotulo="Logo" url=${c.logo_url} nome="logo.png" mime="image/png"></urbi-visualizador-arquivo>` : ''}
          </urbi-linha>`
        : ''}
    </urbi-stack>`;
  }

  private peca(p: Linha) {
    const estado = ESTADO[p.estado] ?? ESTADO.rascunho;
    const capa = p.arquivos?.[0]?.url ?? '';
    const travada = ['agendada', 'publicando', 'publicada'].includes(p.estado);
    const semArte = !p.arquivos?.length;
    const aberta = this.abertas.has(p.id);
    const alternar = () => (aberta ? this.fecharCanva(p.id) : this.abrirCanva(p.id));
    return html`<urbi-linha quebrar>
      <urbi-avatar nome=${p.titulo} foto=${capa} icone=${capa ? '' : 'fa-solid fa-image'} tamanho="64"></urbi-avatar>
      <urbi-stack>
        <urbi-linha quebrar>
          <urbi-prosa>${p.titulo}</urbi-prosa>
          ${semArte && !travada ? html`<urbi-badge cor="alerta">falta a arte do Canva</urbi-badge>` : html`<urbi-badge cor=${estado.cor}>${estado.rotulo}</urbi-badge>`}
        </urbi-linha>
        ${p.estado === 'agendada' ? html`<urbi-prosa papel="secundario">Agendada para ${dataHora(p.agendada_para)}</urbi-prosa>` : ''}
        ${p.estado === 'publicada' ? html`<urbi-prosa papel="secundario">Publicada em ${dataHora(p.publicada_em)}${p.publicada_por === 'fora' ? ' (por fora)' : ''}</urbi-prosa>` : ''}
        ${p.estado === 'erro' && p.erro ? html`<urbi-prosa papel="secundario">${p.erro}</urbi-prosa>` : ''}
        <urbi-prosa papel="fraco">${ROTULO_FORMATO[p.formato as Formato] ?? p.formato} · ${ROTULO_OBJETIVO[p.objetivo as keyof typeof ROTULO_OBJETIVO] ?? p.objetivo}${p.imovel_codigo ? ` · ${p.imovel_codigo}` : ''}${semArte ? '' : ` · ${MOTOR[p.motor] ?? p.motor}`} · ${dataHora(p.criado_em)}</urbi-prosa>
        ${semArte && !travada
          ? html`<urbi-prosa papel="dica">1. Copie a instrução e abra o Canva IA. 2. Cole a instrução e anexe as fotos. 3. Baixe a arte pronta (JPG ou PNG) e envie aqui.</urbi-prosa>
              <urbi-linha quebrar>
                <urbi-botao pequeno icone="fa-solid fa-copy" @click=${() => this.copiarInstrucao(p)}>Copiar instrução</urbi-botao>
                <urbi-botao pequeno variante="secundario" icone="fa-solid fa-arrow-up-right-from-square" @click=${() => window.open(this.canvas[p.id]?.abrir ?? CANVA, '_blank', 'noopener')}>Abrir o Canva IA</urbi-botao>
                <urbi-botao pequeno variante="fantasma" icone=${aberta ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down'} @click=${alternar}>${aberta ? 'Esconder instrução e fotos' : 'Ver instrução e fotos'}</urbi-botao>
              </urbi-linha>
              ${aberta ? this.instrucao(p) : ''}
              ${this.seletorArte(p, true)}`
          : ''}
        <urbi-linha quebrar>
          ${(p.arquivos ?? []).map((a: Linha, i: number) => html`<urbi-visualizador-arquivo pequeno variante="fantasma" rotulo=${p.arquivos.length > 1 ? `Ver ${i + 1}` : 'Ver arte'} url=${a.url ?? ''} nome=${`${p.titulo} ${i + 1}.jpg`} mime="image/jpeg"></urbi-visualizador-arquivo>`)}
          <urbi-botao pequeno variante="fantasma" icone="fa-solid fa-copy" @click=${() => this.copiarLegenda(p)}>Legenda</urbi-botao>
          ${travada
            ? ''
            : html`<urbi-botao pequeno variante="fantasma" icone="fa-solid fa-pen" @click=${() => this.editar(p)}>Textos</urbi-botao>
                ${semArte
                  ? ''
                  : html`<urbi-botao pequeno variante="fantasma" icone="fa-solid fa-wand-magic-sparkles" @click=${alternar}>Instrução do Canva</urbi-botao>
                      ${this.seletorArte(p, false)}`}`}
          ${!semArte && (p.estado === 'rascunho' || p.estado === 'rejeitada' || (p.estado === 'erro' && !p.aprovada_em))
            ? html`<urbi-botao pequeno icone="fa-solid fa-check" @click=${() => this.acao(() => enviar('POST', `/estudio/pecas/${p.id}/aprovar`), 'Peça aprovada.')}>Aprovar</urbi-botao>`
            : ''}
          ${p.estado === 'aprovada' || (p.estado === 'erro' && p.aprovada_em)
            ? html`<urbi-botao pequeno icone="fa-brands fa-instagram" ?carregando=${!!this.trabalhando} @click=${() => this.publicar(p)}>Publicar agora</urbi-botao>
                <urbi-botao pequeno variante="secundario" icone="fa-solid fa-calendar-plus" @click=${() => this.agendar(p)}>Agendar</urbi-botao>`
            : ''}
          ${p.estado === 'publicando' ? html`<urbi-botao pequeno variante="fantasma" icone="fa-solid fa-unlock" @click=${() => this.acao(() => enviar('POST', `/estudio/pecas/${p.id}/destravar`), 'Peça destravada: confira no Instagram.')}>Ainda publicando? Destravar</urbi-botao>` : ''}
          ${p.estado === 'rascunho' && this.janela && !semArte ? html`<urbi-botao pequeno variante="secundario" icone="fa-solid fa-calendar-plus" @click=${() => this.agendar(p)}>Agendar (aprova na hora)</urbi-botao>` : ''}
          ${p.estado === 'agendada' ? html`<urbi-botao pequeno variante="secundario" @click=${() => this.acao(() => enviar('POST', `/estudio/pecas/${p.id}/cancelar-agendamento`), 'Agendamento cancelado.')}>Cancelar agendamento</urbi-botao>` : ''}
          ${['aprovada', 'agendada', 'publicando', 'erro'].includes(p.estado) ? html`<urbi-botao pequeno variante="fantasma" icone="fa-solid fa-check-double" @click=${() => this.publiqueiFora(p)}>Publiquei por fora</urbi-botao>` : ''}
          ${p.estado === 'publicada' && p.permalink ? html`<urbi-botao pequeno variante="fantasma" icone="fa-solid fa-arrow-up-right-from-square" @click=${() => window.open(p.permalink, '_blank', 'noopener')}>Ver no Instagram</urbi-botao>` : ''}
          ${p.estado === 'aprovada' ? html`<urbi-botao pequeno variante="secundario" @click=${() => this.acao(() => enviar('POST', `/estudio/pecas/${p.id}/rejeitar`), 'Peça devolvida.')}>Rejeitar</urbi-botao>` : ''}
          ${travada ? '' : html`<urbi-botao pequeno variante="fantasma" icone="fa-solid fa-trash" ariaLabel="Remover peça" title="Remover" @click=${() => this.remover(p)}></urbi-botao>`}
        </urbi-linha>
        ${aberta && !semArte && !travada ? this.instrucao(p) : ''}
      </urbi-stack>
    </urbi-linha>`;
  }

  render() {
    if (this.falha) {
      return html`<urbi-banner variante="erro">${this.falha}<urbi-botao slot="acao" pequeno variante="secundario" @click=${() => this.carregar()}>Tentar de novo</urbi-botao></urbi-banner>`;
    }
    if (!this.marca) return html`<urbi-loading></urbi-loading>`;
    const m = this.marca;
    return html`<urbi-stack>
      ${!m.creci
        ? html`<urbi-banner variante="info" fechavel>
            Dica: cadastre o seu CRECI para ele entrar na instrução do Canva e na legenda. O Estúdio funciona sem ele, mas anúncio de imóvel deve mostrar o CRECI.
            <urbi-botao slot="acao" pequeno variante="secundario" href=${urbiVerso.href('/conta')}>Cadastrar</urbi-botao>
          </urbi-banner>`
        : ''}
      <urbi-card titulo="Criar" icone="fa-solid fa-wand-magic-sparkles">
        <urbi-linha quebrar>
          <urbi-botao icone="fa-solid fa-plus" ?carregando=${!!this.trabalhando} @click=${() => this.novoPedido()}>Novo pedido</urbi-botao>
          <urbi-botao variante="secundario" icone="fa-solid fa-microphone" ?carregando=${this.ouvindo} @click=${async () => { const t = await this.ouvir(); if (t) await this.novoPedido(t); }}>Falar o pedido</urbi-botao>
          <urbi-botao variante="secundario" icone="fa-solid fa-box-open" ?carregando=${!!this.trabalhando} @click=${() => this.pacote()}>Pacote de lançamento</urbi-botao>
        </urbi-linha>
        ${this.trabalhando ? html`<urbi-prosa papel="secundario">${this.trabalhando}</urbi-prosa>` : html`<urbi-prosa papel="dica">Aqui o app escreve os textos e a instrução para o Canva IA, com a sua marca, o preço, o bairro e o CRECI. A imagem você gera no Canva e envia de volta na peça.</urbi-prosa>`}
      </urbi-card>
      <urbi-card titulo="Peças" icone="fa-solid fa-images">
        ${this.pecas.length
          ? html`<urbi-lista separador .itens=${this.pecas} .render_item=${(p: Linha) => this.peca(p)}></urbi-lista>`
          : html`<urbi-estado-vazio icone="fa-solid fa-images" mensagem="Nenhuma peça ainda" submensagem="Faça um pedido ou gere o pacote de lançamento de um imóvel."></urbi-estado-vazio>`}
      </urbi-card>
      <urbi-card titulo="Sua marca" icone="fa-solid fa-palette">
        <span slot="acoes"><urbi-botao variante="fantasma" pequeno icone="fa-solid fa-pen" ariaLabel="Editar a marca" title="Editar" @click=${() => this.editarMarca()}></urbi-botao></span>
        <urbi-linha quebrar>
          <urbi-avatar nome="Logo" foto=${m.logo_url ?? ''} icone=${m.logo_url ? '' : 'fa-solid fa-image'} tamanho="56"></urbi-avatar>
          <urbi-prosa papel="secundario">Cores ${m.cor_primaria} e ${m.cor_secundaria} · estilo ${ESTILOS.find((e) => e.valor === m.estilo)?.rotulo ?? m.estilo}${m.assinatura ? ` · "${m.assinatura}"` : ''}</urbi-prosa>
        </urbi-linha>
        <urbi-linha quebrar>
          <urbi-seletor-arquivo accept="image/png,image/jpeg,image/webp" icone="fa-solid fa-upload" texto=${m.logo_url ? 'Trocar o logo' : 'Enviar o logo'} @urbi:seletor-arquivo-change=${(e: CustomEvent) => this.enviarMarca('logo', e)}></urbi-seletor-arquivo>
          <urbi-seletor-arquivo accept="image/png,image/jpeg,image/webp" icone="fa-solid fa-user" texto=${m.foto_url ? 'Trocar a sua foto' : 'Enviar a sua foto (opcional)'} @urbi:seletor-arquivo-change=${(e: CustomEvent) => this.enviarMarca('foto', e)}></urbi-seletor-arquivo>
        </urbi-linha>
        <urbi-prosa papel="dica">O logo (PNG com fundo transparente fica melhor) aparece junto das fotos para anexar no Canva.</urbi-prosa>
      </urbi-card>
    </urbi-stack>`;
  }
}
