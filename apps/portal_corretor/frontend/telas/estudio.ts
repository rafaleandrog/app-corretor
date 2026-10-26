import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { CampoFormulario, UrbiVersoAPI } from '@urbiverso/sdk';
import { FERRAMENTA, FERRAMENTAS, FORMATOS, OBJETIVOS, ROTULO_FORMATO, ROTULO_OBJETIVO, type Formato, type ImovelArte } from '../../comum/estudio';
import { acoesComMais, chamarApi, dataHora, enviar, juntarDataHora, mensagemDeErro, subirArquivo, type Acao } from '../apoio';
import { gerarArte, type MarcaArte } from '../estudio/motor';

declare const urbiVerso: UrbiVersoAPI;

type Linha = Record<string, any>;
interface Marca extends MarcaArte {
  salva: boolean;
  foto_url: string | null;
  referencias: { id: number; url: string }[];
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
// `motor` guarda os valores de sempre (D-86): `canva_ia` é a arte feita em outra ferramenta.
const MOTOR: Record<string, string> = { interno: 'gerador do app', canva_ia: 'outra ferramenta', upload: 'arte enviada' };
const QUINZE_MIN = 15 * 60e3;

// Estúdio de Conteúdo (D-74, D-86): pedido em texto ou voz (urbi-redator), artes montadas pelo
// gerador do app, "Fazer em outra ferramenta" (instrução + fotos + referências) ou arte pronta enviada,
// aprovação e publicação. Cada peça tem uma ação principal pelo estado e o resto no "Mais".
// Prévia da arte por urbi-avatar (exceção de "cartão de arte", 11.5).
@customElement('pc-tela-estudio')
export class PcTelaEstudio extends LitElement {
  @state() private pecas: Linha[] = [];
  @state() private marca: Marca | null = null;
  @state() private falha: string | null = null;
  @state() private trabalhando: string | null = null;
  /** Peça com o seletor "Enviar arte pronta" aberto (e o motor que a arte leva). */
  @state() private enviando: { id: number; motor: 'canva_ia' | 'upload' } | null = null;

  connectedCallback() {
    super.connectedCallback();
    void this.carregar();
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
    const v = await urbiVerso.formulario({ titulo: 'Novo pedido', campos, mensagem: 'O app escreve os textos (com IA, quando liberada) e monta as artes com a sua marca. Você revisa antes de aprovar.', rotuloConfirmar: 'Criar' });
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
      mensagem: 'Post, carrossel e story do imóvel, com a mesma linha visual.',
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
    this.trabalhando = 'Escrevendo os textos…';
    try {
      const r = await enviar('POST', rota, corpo);
      const falhas: string[] = [];
      for (const [i, p] of r.pecas.entries()) {
        this.trabalhando = `Montando a arte ${i + 1} de ${r.pecas.length}…`;
        // A peça já existe: se a arte falhar, ela fica como rascunho para "Refazer arte".
        try {
          await this.montar(p, r.imovel);
        } catch (e) {
          falhas.push(`${p.titulo}: ${mensagemDeErro(e)}`);
        }
      }
      if (falhas.length) await urbiVerso.alertar({ titulo: 'Peças criadas, mas algumas artes não saíram', mensagem: `${falhas.join('\n')}\n\nUse "Refazer arte" na peça.`, tipo: 'alerta' });
      else urbiVerso.notificar(`${r.pecas.length} peça(s) pronta(s) para revisar${r.ia ? '' : ' (textos pelo modelo: a IA não está liberada agora)'}.`, 'sucesso');
    } catch (e) {
      await urbiVerso.alertar({ titulo: 'Não foi possível criar', mensagem: mensagemDeErro(e), tipo: 'erro' });
    } finally {
      this.trabalhando = null;
      await this.carregar();
    }
  }

  /** Gera a arte no navegador e envia em 2 passos (staging + rota da peça). */
  private async montar(p: Linha, imovel: { arte: ImovelArte; fotos: { url: string }[] } | null) {
    const { imagens: blobs, fotosFalharam } = await gerarArte(
      { formato: p.formato, objetivo: p.objetivo, titulo: p.titulo, chamada: p.chamada ?? null, destaques: Array.isArray(p.destaques) ? p.destaques : [] },
      imovel?.arte ?? null,
      (imovel?.fotos ?? []).map((f) => f.url),
      this.marca!,
    );
    const uploads: number[] = [];
    for (const [i, b] of blobs.entries()) uploads.push(await subirArquivo('peca_arquivos', 'arquivo', new File([b], `peca-${p.id}-${i + 1}.jpg`, { type: 'image/jpeg' })));
    await enviar('PUT', `/estudio/pecas/${p.id}/arquivos`, { upload_ids: uploads, motor: 'interno' });
    if (fotosFalharam) urbiVerso.notificar(`${fotosFalharam} foto(s) não carregaram e a arte saiu sem elas. Use "Refazer arte".`, 'info');
  }

  private async refazer(p: Linha) {
    this.trabalhando = 'Montando a arte…';
    try {
      const f = await chamarApi(`/estudio/pecas/${p.id}`);
      this.marca = f.marca;
      await this.montar(f.peca, f.imovel);
      urbiVerso.notificar('Arte refeita.', 'sucesso');
    } catch (e) {
      await urbiVerso.alertar({ titulo: 'Não foi possível montar', mensagem: mensagemDeErro(e), tipo: 'erro' });
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
      mensagem: 'Mudou o título, a chamada ou os destaques? Depois use "Refazer arte".',
    });
    if (!v) return;
    await this.acao(() => enviar('PATCH', `/estudio/pecas/${p.id}`, { ...v, destaques: String(v.destaques ?? '').split(',').map((d) => d.trim()).filter(Boolean) }), 'Textos salvos.');
  }

  /**
   * Fazer em outra ferramenta (D-74, D-86): escolhe a ferramenta e as referências, copia a instrução,
   * mostra os links das fotos, do logo e das referências e deixa o "Enviar arte pronta" aberto na peça.
   */
  private async outraFerramenta(p: Linha) {
    const refs = this.marca?.referencias ?? [];
    const v = await urbiVerso.formulario({
      titulo: 'Fazer em outra ferramenta',
      mensagem: refs.length
        ? 'O app prepara a instrução com a sua marca e os textos da peça. Marque as referências que entram (elas ficam em Ajustes › Marca).'
        : 'O app prepara a instrução com a sua marca e os textos da peça. Quer mandar referências (posts que você admira)? Envie em Ajustes › Marca.',
      campos: [
        { nome: 'ferramenta', tipo: 'selecao', rotulo: 'Ferramenta', valor: 'canva', opcoes: FERRAMENTAS.map((f) => ({ valor: f, rotulo: FERRAMENTA[f].rotulo })) },
        ...refs.map((r, i): CampoFormulario => ({ nome: `r_${r.id}`, tipo: 'booleano', rotulo: `Referência ${i + 1}`, valor: true })),
      ],
      rotuloConfirmar: 'Preparar',
    });
    if (!v) return;
    const escolhidas = refs.filter((r) => v[`r_${r.id}`] === true).map((r) => r.id);
    try {
      const r = await chamarApi(`/estudio/pecas/${p.id}/instrucao?ferramenta=${encodeURIComponent(String(v.ferramenta))}${escolhidas.length ? `&referencias=${escolhidas.join(',')}` : ''}`);
      let copiada = true;
      try {
        await navigator.clipboard.writeText(r.prompt);
      } catch {
        copiada = false; // sem área de transferência: a instrução aparece abaixo para copiar à mão
      }
      const fotos = (r.fotos as Linha[]).map((f, i) => `${i + 1}. ${f.url}`).join('\n');
      const mensagem =
        `1. ${copiada ? 'A instrução abaixo foi copiada.' : 'Copie a instrução abaixo.'} ${r.onde}\n` +
        `2. Baixe e anexe as fotos do imóvel e o seu logo pelos links${r.referencias.length ? ' (as referências estão na instrução)' : ''}.\n` +
        `3. Baixe a arte pronta (JPG ou PNG) e volte aqui: o "Enviar arte pronta" fica aberto na peça.\n\n` +
        `${r.prompt}\n\nFotos:\n${fotos || 'nenhuma foto pública'}${r.logo_url ? `\n\nLogo: ${r.logo_url}` : ''}`;
      if (r.abrir) {
        if (await urbiVerso.confirmar({ titulo: `Fazer no ${FERRAMENTA[r.ferramenta as keyof typeof FERRAMENTA].rotulo}`, mensagem, rotuloConfirmar: 'Abrir a ferramenta' })) window.open(r.abrir, '_blank', 'noopener');
      } else {
        await urbiVerso.alertar({ titulo: `Fazer no ${FERRAMENTA[r.ferramenta as keyof typeof FERRAMENTA].rotulo}`, mensagem });
      }
      this.enviando = { id: p.id, motor: 'canva_ia' };
    } catch (e) {
      await urbiVerso.alertar({ titulo: 'Não foi possível preparar', mensagem: mensagemDeErro(e), tipo: 'erro' });
    }
  }

  private async enviarArte(p: Linha, e: CustomEvent) {
    const arquivos = ((e.detail.arquivos as File[]) ?? []).slice(0, p.formato === 'carrossel' ? 5 : 1);
    if (!arquivos.length || this.trabalhando) return;
    // O seletor também avisa quando um arquivo sai da lista: troca só com confirmação.
    const ok = await urbiVerso.confirmar({ titulo: 'Trocar a arte', mensagem: `A arte da peça passa a ser ${arquivos.length === 1 ? 'esta imagem' : `estas ${arquivos.length} imagens, nesta ordem`}.`, rotuloConfirmar: 'Trocar' });
    if (!ok) return;
    const aberto = this.enviando;
    const motor = aberto && aberto.id === p.id ? aberto.motor : 'upload';
    this.trabalhando = 'Enviando a arte…';
    try {
      const uploads: number[] = [];
      for (const f of arquivos) uploads.push(await subirArquivo('peca_arquivos', 'arquivo', f));
      await enviar('PUT', `/estudio/pecas/${p.id}/arquivos`, { upload_ids: uploads, motor });
      this.enviando = null;
      urbiVerso.notificar('Arte enviada. Revise e aprove.', 'sucesso');
    } catch (err) {
      await urbiVerso.alertar({ titulo: 'Não foi possível enviar', mensagem: mensagemDeErro(err), tipo: 'erro' });
    } finally {
      this.trabalhando = null;
      await this.carregar();
    }
  }

  private async acao(fn: () => Promise<unknown>, sucesso: string) {
    try {
      await fn();
      urbiVerso.notificar(sucesso, 'sucesso');
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

  /** Story com arte que não é do gerador do app não sai pela API: o CRECI teria de estar na arte. */
  private soPorFora = (p: Linha) => p.formato === 'story' && p.motor !== 'interno';

  /** Publicar: agora, agendar ou baixar para publicar pelo Instagram (e marcar "Publiquei por fora"). */
  private async publicarOpcoes(p: Linha) {
    const opcoes = [
      ...(this.soPorFora(p) ? [] : [{ valor: 'agora', rotulo: 'Publicar agora no Instagram' }, { valor: 'agendar', rotulo: 'Agendar' }]),
      { valor: 'baixar', rotulo: 'Baixar a arte e a legenda (publico eu)' },
    ];
    const v = await urbiVerso.formulario({
      titulo: 'Publicar',
      mensagem: this.soPorFora(p) ? 'Story com arte de outra ferramenta ou enviada: confira o CRECI na arte, publique pelo Instagram e use "Publiquei por fora" no Mais.' : undefined,
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
    const travada = ['agendada', 'publicando', 'publicada'].includes(p.estado);
    const aprovavel = p.estado === 'rascunho' || p.estado === 'rejeitada' || (p.estado === 'erro' && !p.aprovada_em);
    const legenda: Acao = { rotulo: 'Copiar legenda', icone: 'fa-solid fa-copy', aoEscolher: () => this.copiarLegenda(p) };
    let principal: Acao;
    if (aprovavel) principal = { rotulo: 'Aprovar', icone: 'fa-solid fa-check', aoEscolher: () => this.aprovar(p) };
    else if (p.estado === 'aprovada') principal = { rotulo: 'Publicar', icone: 'fa-brands fa-instagram', aoEscolher: () => this.publicarOpcoes(p) };
    else if (p.estado === 'erro') principal = { rotulo: 'Tentar de novo', icone: 'fa-solid fa-rotate-right', aoEscolher: () => this.publicarOpcoes(p) };
    else if (p.estado === 'agendada') principal = { rotulo: 'Cancelar agendamento', icone: 'fa-solid fa-calendar-xmark', aoEscolher: () => this.acao(() => enviar('POST', `/estudio/pecas/${p.id}/cancelar-agendamento`), 'Agendamento cancelado.') };
    else if (p.estado === 'publicando') principal = { rotulo: 'Destravar', icone: 'fa-solid fa-unlock', aoEscolher: () => this.acao(() => enviar('POST', `/estudio/pecas/${p.id}/destravar`), 'Peça destravada: confira no Instagram.') };
    else if (p.permalink) principal = { rotulo: 'Ver no Instagram', icone: 'fa-solid fa-arrow-up-right-from-square', aoEscolher: () => window.open(p.permalink, '_blank', 'noopener') };
    else principal = legenda; // publicada por fora sem link
    const mais: Acao[] = [];
    if ((p.arquivos ?? []).length) mais.push({ rotulo: p.arquivos.length > 1 ? 'Ver as artes' : 'Ver a arte', icone: 'fa-solid fa-image', aoEscolher: () => this.verArte(p) });
    if (!travada) {
      mais.push(
        { rotulo: 'Textos', icone: 'fa-solid fa-pen', aoEscolher: () => this.editar(p) },
        { rotulo: 'Refazer arte', icone: 'fa-solid fa-rotate', aoEscolher: () => this.refazer(p) },
        { rotulo: 'Fazer em outra ferramenta', icone: 'fa-solid fa-wand-magic-sparkles', aoEscolher: () => this.outraFerramenta(p) },
        { rotulo: 'Enviar arte pronta', icone: 'fa-solid fa-upload', aoEscolher: () => (this.enviando = { id: p.id, motor: 'upload' }) },
      );
    }
    if (p.estado === 'aprovada' || (p.estado === 'erro' && p.aprovada_em)) mais.push({ rotulo: 'Voltar a rascunho', icone: 'fa-solid fa-arrow-rotate-left', aoEscolher: () => this.acao(() => enviar('POST', `/estudio/pecas/${p.id}/rejeitar`), 'Peça de volta a rascunho.') });
    if (['aprovada', 'agendada', 'publicando', 'erro'].includes(p.estado)) mais.push({ rotulo: 'Publiquei por fora', icone: 'fa-solid fa-check-double', aoEscolher: () => this.publiqueiFora(p) });
    if (principal !== legenda) mais.push(legenda);
    if (!travada) mais.push({ rotulo: 'Remover', icone: 'fa-solid fa-trash', perigo: true, aoEscolher: () => this.remover(p) });
    return acoesComMais(principal, mais);
  }

  private peca(p: Linha) {
    const estado = ESTADO[p.estado] ?? ESTADO.rascunho;
    const capa = p.arquivos?.[0]?.url ?? '';
    const publicandoHa = p.estado === 'publicando' ? Date.now() - new Date(p.atualizado_em ?? p.criado_em).getTime() : 0;
    return html`<urbi-linha quebrar>
      <urbi-avatar nome=${p.titulo} foto=${capa} icone=${capa ? '' : 'fa-solid fa-image'} tamanho="64"></urbi-avatar>
      <urbi-stack>
        <urbi-linha quebrar>
          <urbi-prosa>${p.titulo}</urbi-prosa>
          <urbi-badge cor=${estado.cor}>${estado.rotulo}</urbi-badge>
        </urbi-linha>
        ${p.estado === 'agendada' ? html`<urbi-prosa papel="secundario">Agendada para ${dataHora(p.agendada_para)}</urbi-prosa>` : ''}
        ${p.estado === 'publicada' ? html`<urbi-prosa papel="secundario">Publicada em ${dataHora(p.publicada_em)}${p.publicada_por === 'fora' ? ' (por fora)' : ''}</urbi-prosa>` : ''}
        ${p.estado === 'publicando' && publicandoHa < QUINZE_MIN ? html`<urbi-prosa papel="dica">Publicando. Se passar de 15 minutos assim, use "Destravar".</urbi-prosa>` : ''}
        ${p.estado === 'erro' && p.erro ? html`<urbi-prosa papel="secundario">${p.erro}</urbi-prosa>` : ''}
        <urbi-prosa papel="fraco">${ROTULO_FORMATO[p.formato as Formato] ?? p.formato} · ${ROTULO_OBJETIVO[p.objetivo as keyof typeof ROTULO_OBJETIVO] ?? p.objetivo}${p.imovel_codigo ? ` · ${p.imovel_codigo}` : ''} · ${MOTOR[p.motor] ?? p.motor} · ${dataHora(p.criado_em)}</urbi-prosa>
        ${this.acoes(p)}
        ${this.enviando?.id === p.id
          ? html`<urbi-linha quebrar>
              <urbi-seletor-arquivo accept="image/jpeg,image/png" ?multiplo=${p.formato === 'carrossel'} dica=${p.formato === 'carrossel' ? 'Arte pronta: até 5 imagens (JPG ou PNG), na ordem dos slides' : 'Arte pronta (JPG ou PNG)'} @urbi:seletor-arquivo-change=${(e: CustomEvent) => this.enviarArte(p, e)}></urbi-seletor-arquivo>
              <urbi-botao pequeno variante="fantasma" @click=${() => (this.enviando = null)}>Fechar</urbi-botao>
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
    return html`<urbi-stack>
      ${!m.creci ? html`<urbi-banner variante="alerta">Cadastre o seu CRECI em Ajustes › Conta: ele vai em toda arte e legenda, e sem ele a peça não é aprovada.</urbi-banner>` : ''}
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
        ${this.trabalhando ? html`<urbi-prosa papel="secundario">${this.trabalhando}</urbi-prosa>` : html`<urbi-prosa papel="dica">As artes saem com a sua marca, a foto do imóvel, o preço, o bairro e o CRECI. Prefere Canva, Claude Design ou outra? Em cada peça, "Mais › Fazer em outra ferramenta" prepara a instrução e as fotos.</urbi-prosa>`}
        <urbi-linha><urbi-botao pequeno variante="fantasma" icone="fa-solid fa-palette" href=${urbiVerso.href('/ajustes/marca')}>Sua marca (logo, cores, estilo)</urbi-botao></urbi-linha>
      </urbi-card>
      <urbi-card titulo="Peças" icone="fa-solid fa-images">
        ${this.pecas.length
          ? html`<urbi-lista separador .itens=${this.pecas} .render_item=${(p: Linha) => this.peca(p)}></urbi-lista>`
          : html`<urbi-estado-vazio icone="fa-solid fa-images" mensagem="Nenhuma peça ainda" submensagem="Faça um pedido ou gere o pacote de lançamento de um imóvel."></urbi-estado-vazio>`}
      </urbi-card>
    </urbi-stack>`;
  }
}
