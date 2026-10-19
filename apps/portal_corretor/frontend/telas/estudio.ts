import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { CampoFormulario, UrbiVersoAPI } from '@urbiverso/sdk';
import { FORMATOS, OBJETIVOS, ROTULO_FORMATO, ROTULO_OBJETIVO, type Formato, type ImovelArte } from '../../comum/estudio';
import { dataHora, enviar, mensagemDeErro, subirArquivo } from '../apoio';
import { gerarArte, type MarcaArte } from '../estudio/motor';

declare const urbiVerso: UrbiVersoAPI;

type Linha = Record<string, any>;
interface Marca extends MarcaArte {
  salva: boolean;
  foto_url: string | null;
}
const ESTADO: Record<string, { cor: string; rotulo: string }> = {
  rascunho: { cor: 'padrao', rotulo: 'rascunho' },
  aprovada: { cor: 'sucesso', rotulo: 'aprovada' },
  agendada: { cor: 'info', rotulo: 'agendada' },
  publicada: { cor: 'sucesso', rotulo: 'publicada' },
  rejeitada: { cor: 'alerta', rotulo: 'rejeitada' },
  erro: { cor: 'erro', rotulo: 'com erro' },
};
const MOTOR: Record<string, string> = { interno: 'gerador do app', canva_ia: 'Canva IA', upload: 'arte enviada' };
const ESTILOS = [
  { valor: 'moderno', rotulo: 'Moderno' },
  { valor: 'classico', rotulo: 'Clássico' },
  { valor: 'minimalista', rotulo: 'Minimalista' },
];

// Estúdio de Conteúdo (bloco 8a, D-74): pedido em texto ou voz, artes montadas pelo gerador do app,
// alternativa pelo Canva IA (pacote com a instrução e as fotos), aprovação e biblioteca para baixar.
// Prévia das artes por urbi-avatar e urbi-visualizador-arquivo (exceção de "cartão de arte", 11.5).
@customElement('pc-tela-estudio')
export class PcTelaEstudio extends LitElement {
  @state() private pecas: Linha[] = [];
  @state() private marca: Marca | null = null;
  @state() private falha: string | null = null;
  @state() private trabalhando: string | null = null;
  @state() private ouvindo = false;

  connectedCallback() {
    super.connectedCallback();
    void this.carregar();
  }

  private async carregar() {
    this.falha = null;
    try {
      const [p, m] = await Promise.all([urbiVerso.api('/estudio/pecas'), urbiVerso.api('/estudio/marca')]);
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
    const v = await urbiVerso.formulario({ titulo: 'Novo pedido', campos, mensagem: 'O app escreve os textos (com IA, quando liberada) e monta as artes com a sua marca. Você revisa antes de aprovar.', rotuloConfirmar: 'Criar' });
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
      for (const [i, p] of r.pecas.entries()) {
        this.trabalhando = `Montando a arte ${i + 1} de ${r.pecas.length}…`;
        await this.montar(p, r.imovel);
      }
      urbiVerso.notificar(`${r.pecas.length} peça(s) pronta(s) para revisar${r.ia ? '' : ' (textos pelo modelo: a IA não está liberada agora)'}.`, 'sucesso');
    } catch (e) {
      await urbiVerso.alertar({ titulo: 'Não foi possível criar', mensagem: mensagemDeErro(e), tipo: 'erro' });
    } finally {
      this.trabalhando = null;
      await this.carregar();
    }
  }

  /** Gera a arte no navegador e envia em 2 passos (staging + rota da peça). */
  private async montar(p: Linha, imovel: { arte: ImovelArte; fotos: { url: string }[] } | null) {
    const blobs = await gerarArte(
      { formato: p.formato, objetivo: p.objetivo, titulo: p.titulo, chamada: p.chamada ?? null, destaques: Array.isArray(p.destaques) ? p.destaques : [] },
      imovel?.arte ?? null,
      (imovel?.fotos ?? []).map((f) => f.url),
      this.marca!,
    );
    const uploads: number[] = [];
    for (const [i, b] of blobs.entries()) uploads.push(await subirArquivo('peca_arquivos', 'arquivo', new File([b], `peca-${p.id}-${i + 1}.jpg`, { type: 'image/jpeg' })));
    await enviar('PUT', `/estudio/pecas/${p.id}/arquivos`, { upload_ids: uploads, motor: 'interno' });
  }

  private async refazer(p: Linha) {
    this.trabalhando = 'Montando a arte…';
    try {
      const f = await urbiVerso.api(`/estudio/pecas/${p.id}`);
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

  /** Canva IA (D-74): copia a instrução, abre as fotos para anexar e o Canva numa aba; a arte volta por "Enviar arte". */
  private async canva(p: Linha) {
    try {
      const r = await urbiVerso.api(`/estudio/pecas/${p.id}/canva`);
      try {
        await navigator.clipboard.writeText(r.prompt);
      } catch {
        // sem área de transferência: a instrução aparece no alerta abaixo
      }
      const fotos = (r.fotos as Linha[]).map((f, i) => `${i + 1}. ${f.url}`).join('\n');
      const ok = await urbiVerso.confirmar({
        titulo: 'Criar no Canva IA',
        mensagem:
          `1. A instrução abaixo foi copiada: cole no "O que vamos criar hoje?" do Canva IA.\n` +
          `2. Anexe as fotos do imóvel (baixe pelos links) e o seu logo.\n` +
          `3. Baixe a arte pronta (JPG ou PNG) e volte aqui em "Enviar arte".\n\n` +
          `${r.prompt}\n\nFotos:\n${fotos || 'nenhuma foto pública'}${r.logo_url ? `\n\nLogo: ${r.logo_url}` : ''}`,
        rotuloConfirmar: 'Abrir o Canva IA',
      });
      if (ok) window.open(r.abrir, '_blank', 'noopener');
    } catch (e) {
      await urbiVerso.alertar({ titulo: 'Não foi possível preparar', mensagem: mensagemDeErro(e), tipo: 'erro' });
    }
  }

  private async enviarArte(p: Linha, e: CustomEvent) {
    const arquivos = ((e.detail.arquivos as File[]) ?? []).slice(0, p.formato === 'carrossel' ? 5 : 1);
    if (!arquivos.length) return;
    this.trabalhando = 'Enviando a arte…';
    try {
      const uploads: number[] = [];
      for (const f of arquivos) uploads.push(await subirArquivo('peca_arquivos', 'arquivo', f));
      await enviar('PUT', `/estudio/pecas/${p.id}/arquivos`, { upload_ids: uploads, motor: 'canva_ia' });
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

  private peca(p: Linha) {
    const estado = ESTADO[p.estado] ?? ESTADO.rascunho;
    const capa = p.arquivos?.[0]?.url ?? '';
    const travada = ['agendada', 'publicada'].includes(p.estado);
    return html`<urbi-linha quebrar>
      <urbi-avatar nome=${p.titulo} foto=${capa} icone=${capa ? '' : 'fa-solid fa-image'} tamanho="64"></urbi-avatar>
      <urbi-stack>
        <urbi-linha quebrar>
          <urbi-prosa>${p.titulo}</urbi-prosa>
          <urbi-badge cor=${estado.cor}>${estado.rotulo}</urbi-badge>
        </urbi-linha>
        <urbi-prosa papel="fraco">${ROTULO_FORMATO[p.formato as Formato] ?? p.formato} · ${ROTULO_OBJETIVO[p.objetivo as keyof typeof ROTULO_OBJETIVO] ?? p.objetivo}${p.imovel_codigo ? ` · ${p.imovel_codigo}` : ''} · ${MOTOR[p.motor] ?? p.motor} · ${dataHora(p.criado_em)}</urbi-prosa>
        <urbi-linha quebrar>
          ${(p.arquivos ?? []).map((a: Linha, i: number) => html`<urbi-visualizador-arquivo pequeno variante="fantasma" rotulo=${p.arquivos.length > 1 ? `Ver ${i + 1}` : 'Ver arte'} url=${a.url ?? ''} nome=${`${p.titulo} ${i + 1}.jpg`} mime="image/jpeg"></urbi-visualizador-arquivo>`)}
          <urbi-botao pequeno variante="fantasma" icone="fa-solid fa-copy" @click=${() => this.copiarLegenda(p)}>Legenda</urbi-botao>
          ${travada
            ? ''
            : html`<urbi-botao pequeno variante="fantasma" icone="fa-solid fa-pen" @click=${() => this.editar(p)}>Textos</urbi-botao>
                <urbi-botao pequeno variante="fantasma" icone="fa-solid fa-rotate" ?carregando=${!!this.trabalhando} @click=${() => this.refazer(p)}>Refazer arte</urbi-botao>
                <urbi-botao pequeno variante="fantasma" icone="fa-solid fa-wand-magic-sparkles" @click=${() => this.canva(p)}>Canva IA</urbi-botao>
                <urbi-seletor-arquivo accept="image/jpeg,image/png" ?multiplo=${p.formato === 'carrossel'} dica="Enviar arte pronta (JPG ou PNG)" @urbi:seletor-arquivo-change=${(e: CustomEvent) => this.enviarArte(p, e)}></urbi-seletor-arquivo>`}
          ${p.estado === 'rascunho' || p.estado === 'rejeitada'
            ? html`<urbi-botao pequeno icone="fa-solid fa-check" @click=${() => this.acao(() => enviar('POST', `/estudio/pecas/${p.id}/aprovar`), 'Peça aprovada.')}>Aprovar</urbi-botao>`
            : ''}
          ${p.estado === 'aprovada' ? html`<urbi-botao pequeno variante="secundario" @click=${() => this.acao(() => enviar('POST', `/estudio/pecas/${p.id}/rejeitar`), 'Peça devolvida.')}>Rejeitar</urbi-botao>` : ''}
          ${travada ? '' : html`<urbi-botao pequeno variante="fantasma" icone="fa-solid fa-trash" ariaLabel="Remover peça" title="Remover" @click=${() => this.remover(p)}></urbi-botao>`}
        </urbi-linha>
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
      ${!m.creci ? html`<urbi-banner variante="alerta">Cadastre o seu CRECI em Ajustes › Conta e marca: ele vai em toda arte e legenda, e sem ele a peça não é aprovada.</urbi-banner>` : ''}
      <urbi-card titulo="Criar" icone="fa-solid fa-wand-magic-sparkles">
        <urbi-linha quebrar>
          <urbi-botao icone="fa-solid fa-plus" ?carregando=${!!this.trabalhando} @click=${() => this.novoPedido()}>Novo pedido</urbi-botao>
          <urbi-botao variante="secundario" icone="fa-solid fa-microphone" ?carregando=${this.ouvindo} @click=${async () => { const t = await this.ouvir(); if (t) await this.novoPedido(t); }}>Falar o pedido</urbi-botao>
          <urbi-botao variante="secundario" icone="fa-solid fa-box-open" ?carregando=${!!this.trabalhando} @click=${() => this.pacote()}>Pacote de lançamento</urbi-botao>
        </urbi-linha>
        ${this.trabalhando ? html`<urbi-prosa papel="secundario">${this.trabalhando}</urbi-prosa>` : html`<urbi-prosa papel="dica">As artes saem com a sua marca, a foto do imóvel, o preço, o bairro e o CRECI. Prefere o Canva? Em cada peça, "Canva IA" prepara a instrução e as fotos.</urbi-prosa>`}
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
          <urbi-seletor-arquivo accept="image/png,image/jpeg,image/webp" dica="Logo (PNG com fundo transparente fica melhor)" @urbi:seletor-arquivo-change=${(e: CustomEvent) => this.enviarMarca('logo', e)}></urbi-seletor-arquivo>
          <urbi-seletor-arquivo accept="image/png,image/jpeg,image/webp" dica="Sua foto (opcional)" @urbi:seletor-arquivo-change=${(e: CustomEvent) => this.enviarMarca('foto', e)}></urbi-seletor-arquivo>
        </urbi-linha>
      </urbi-card>
    </urbi-stack>`;
  }
}
