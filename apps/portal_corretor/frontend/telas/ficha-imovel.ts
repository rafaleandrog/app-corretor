import { LitElement, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { keyed } from 'lit/directives/keyed.js';
import type { UrbiColunaTabela, UrbiVersoAPI } from '@urbiverso/sdk';
import { numeroEmTexto, reaisEmTexto, secaoDaFalta } from '../../comum/imoveis';
import { acoesComMais, chamarApi, corQualidade, data, dataHora, enviar, formularioEnviar, gesto, mensagemDeErro, opcoes, reais, ROTULO_AMBIENTE, ROTULO_TIPO_IMOVEL, ROTULO_TIPO_MIDIA, SITUACAO_IMOVEL, subirArquivo, type Acao } from '../apoio.js';
import { filtrosDaUrl, filtrosNaUrl } from '../visual.js';
import { irParaComQuery } from '../criar.js';
import { autorizacaoAberta, comAtual, marcarAssinada, registrarAutorizacao, SITUACAO_AUTORIZACAO } from './autorizacao-venda.js';
import { registrarEdicao, soltarEdicao } from '../atalhos.js';

declare const urbiVerso: UrbiVersoAPI;

type Linha = Record<string, any>;

interface Ficha {
  imovel: Linha;
  qualidade: { nota: number; faltas: string[] };
  autorizacao_vigente: boolean;
  publicavel: boolean;
  fotos_publicas: number;
  /** Conta sem CRECI: só o aviso discreto em "o que falta" (D-93), fora da nota. */
  sem_creci?: boolean;
  midias: Linha[];
  autorizacoes: Linha[];
  visitas: Linha[];
  negocios: Linha[];
}

/** Par rótulo/valor da grade de dados: só primitivos `urbi-*`. */
const par = (rotulo: string, valor: unknown) => html`<urbi-stack>
  <urbi-prosa papel="fraco">${rotulo}</urbi-prosa>
  ${typeof valor === 'string' ? html`<urbi-prosa>${valor}</urbi-prosa>` : valor}
</urbi-stack>`;

/** A ficha avisa que o imóvel mudou ou saiu (dados, fotos, situação, publicação, autorização): o contexto da direita e a lista da esquerda releem. */
export const EVENTO_IMOVEL_MUDOU = 'pc:imovel-mudou';
/** O contexto da direita pede à ficha que abra o que resolve uma pendência de "o que falta". */
export const EVENTO_RESOLVER_FALTA = 'pc:resolver-falta';

// Ficha do imóvel, no centro da moldura de Imóveis (P06): cabeçalho com Editar e Criar conteúdo,
// galeria (capa e miniaturas), dados, quem vê o imóvel, fotos e arquivos, descrição com IA,
// autorização de venda, visitas e negócios. A qualidade e "o que falta" ficam na coluna da direita
// (`pc-contexto-imovel`), que pede por evento a seção que resolve cada pendência. Publicar pede
// autorização vigente.
@customElement('pc-tela-ficha-imovel')
export class PcTelaFichaImovel extends LitElement {
  @property({ type: Number }) imovelId = 0;
  @state() private ficha: Ficha | null = null;
  @state() private envios: Linha[] = [];
  @state() private falha: string | null = null;
  @state() private ia = { fotos: false, conteudo: false };
  @state() private enviando: string | null = null;
  @state() private escrevendo = false;
  @state() private contatos: Linha[] = [];
  @state() private empreendimentos: Linha[] = [];
  /**
   * A conta em que a ficha nasceu (a troca de conta recria a tela). Toda continuação passa por
   * `vida.esperar`: trocada a conta em qualquer await, o gesto termina em silêncio (sem novo envio,
   * estado, aviso nem navegação).
   */
  private readonly vida = gesto();

  private aoResolver = (e: Event) => {
    const d = (e as CustomEvent).detail;
    if (d?.id === this.imovelId && this.ficha) this.resolver(String(d.falta));
  };

  connectedCallback() {
    super.connectedCallback();
    void this.carregar(true);
    void chamarApi('/imoveis/ia').then((r) => void (this.ia = r), () => undefined); // conta trocada em voo: `ContaTrocada`, nada muda
    window.addEventListener(EVENTO_RESOLVER_FALTA, this.aoResolver);
    // E (11.0.6): o mesmo Editar do cabeçalho, com a ficha carregada.
    registrarEdicao(this, () => void (this.ficha && this.editar()));
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    soltarEdicao(this);
    window.removeEventListener(EVENTO_RESOLVER_FALTA, this.aoResolver);
  }

  /** `primeira`: a carga de entrada; as seguintes vêm de uma mudança e avisam o contexto da direita. */
  private async carregar(primeira = false) {
    this.falha = null;
    try {
      const [ficha, envios] = await this.vida.esperar(
        Promise.all([chamarApi(`/imoveis/${this.imovelId}`), chamarApi(`/envios?imovel_id=${this.imovelId}`).catch(() => ({ dados: [] }))]),
      );
      this.ficha = ficha;
      this.envios = envios.dados;
      if (!primeira) window.dispatchEvent(new CustomEvent(EVENTO_IMOVEL_MUDOU, { detail: { id: this.imovelId } }));
    } catch (e) {
      if (this.vida.encerrado(e)) return;
      this.falha = (e as Error).message;
    }
  }

  private async depois(r: unknown) {
    if (r) await this.carregar();
  }

  /** Um gesto com diálogo ou cadeia de awaits: conta trocada no meio termina em silêncio. */
  private async semAvisoDeOutraConta(fn: () => Promise<unknown>) {
    // A conta já mudou (a ficha é de antes): o gesto nem começa, nenhum diálogo abre.
    if (!this.vida.vivo()) return;
    try {
      await fn();
    } catch (e) {
      if (!this.vida.encerrado(e)) throw e;
    }
  }

  private async tentar(titulo: string, fn: () => Promise<unknown>) {
    // Confere antes de `fn()`: a escrita sairia já com o `X-Conta` da outra conta.
    if (!this.vida.vivo()) return;
    try {
      await this.vida.esperar(fn());
      await this.carregar();
    } catch (e) {
      if (this.vida.encerrado(e)) return;
      await urbiVerso.alertar({ titulo, mensagem: mensagemDeErro(e), tipo: 'erro' });
    }
  }

  // ---------- Fotos e arquivos ----------

  /** Envia em sequência: staging, grava a mídia e, se a IA estiver ligada, pede a leitura da foto. */
  private enviarArquivos(e: CustomEvent) {
    return this.semAvisoDeOutraConta(() => this.enviarArquivosNaConta(e));
  }

  private async enviarArquivosNaConta(e: CustomEvent) {
    const arquivos = (e.detail.arquivos as File[]) ?? [];
    if (!arquivos.length || this.enviando) return;
    const recusados: string[] = [];
    const novas: Linha[] = [];
    for (const [i, f] of arquivos.entries()) {
      this.enviando = `Enviando ${i + 1} de ${arquivos.length}…`;
      // Alguns navegadores mandam `type` vazio: cai na extensão do nome.
      const mime = f.type || (/\.(jpe?g|png|webp)$/i.test(f.name) ? 'image/' : /\.mp4$/i.test(f.name) ? 'video/' : '');
      const tipo = mime.startsWith('image/') ? 'foto' : mime.startsWith('video/') ? 'video' : 'documento';
      try {
        const upload_id = await this.vida.esperar(subirArquivo('imovel_midias', 'arquivo', f));
        novas.push(await this.vida.esperar(enviar('POST', `/imoveis/${this.imovelId}/midias`, { upload_id, tipo })));
      } catch (err) {
        if (this.vida.encerrado(err)) throw err;
        recusados.push(`${f.name}: ${mensagemDeErro(err)}`);
      }
    }
    if (this.ia.fotos) {
      for (const [i, m] of novas.filter((n) => n.tipo === 'foto').entries()) {
        this.enviando = `Lendo as fotos com IA (${i + 1})…`;
        await this.vida.esperar(enviar('POST', `/imoveis/${this.imovelId}/midias/${m.id}/analisar`, {}).catch(() => undefined)); // leitura é bônus
      }
    }
    this.enviando = null;
    await this.carregar();
    if (!this.vida.vivo()) return;
    if (recusados.length) await urbiVerso.alertar({ titulo: 'Alguns arquivos não foram enviados', mensagem: recusados.join('\n'), tipo: 'alerta' });
    else urbiVerso.notificar(`${novas.length} arquivo(s) enviado(s).`, 'sucesso');
  }

  private mover(i: number, delta: number) {
    const lista = [...this.ficha!.midias];
    const j = i + delta;
    if (j < 0 || j >= lista.length) return;
    [lista[i], lista[j]] = [lista[j], lista[i]];
    void this.tentar('Não foi possível mudar a ordem', () => enviar('PUT', `/imoveis/${this.imovelId}/midias/ordem`, { ids: lista.map((m) => m.id) }));
  }

  private editarMidia(m: Linha) {
    void formularioEnviar(
      'Arquivo',
      [
        { nome: 'tipo', tipo: 'selecao', rotulo: 'Tipo', valor: m.tipo, opcoes: opcoes(ROTULO_TIPO_MIDIA) },
        { nome: 'legenda', tipo: 'texto', rotulo: 'Legenda', valor: m.legenda ?? '' },
        { nome: 'publica', tipo: 'booleano', rotulo: 'Pode aparecer no anúncio (documentos nunca aparecem)', valor: !!m.publica },
      ],
      'PATCH',
      `/imoveis/${this.imovelId}/midias/${m.id}`,
      undefined,
      { gesto: this.vida },
    ).then((r) => this.depois(r));
  }

  private removerMidia(m: Linha) {
    return this.semAvisoDeOutraConta(async () => {
      const ok = await this.vida.esperar(urbiVerso.confirmar({ titulo: 'Apagar arquivo', mensagem: 'O arquivo é apagado de vez.', rotuloConfirmar: 'Apagar', perigo: true }));
      if (ok) await this.tentar('Não foi possível apagar', () => enviar('PATCH', `/imoveis/${this.imovelId}/midias/${m.id}/remover`, {}));
    });
  }

  private colunasMidias(): UrbiColunaTabela[] {
    const lista = this.ficha!.midias;
    return [
      {
        id: 'mini',
        label: '',
        semRotuloMobile: true,
        // Miniatura pelo urbi-avatar (exceção nomeada até haver primitivo de galeria — spec 11.5).
        render: (l) => {
          const m = l as Linha;
          return m.tipo === 'foto'
            ? html`<urbi-avatar nome=${m.legenda ?? 'Foto'} foto=${m.url ?? ''} tamanho="56"></urbi-avatar>`
            : html`<urbi-avatar nome=${ROTULO_TIPO_MIDIA[m.tipo]} icone=${m.tipo === 'documento' ? 'fa-solid fa-file-signature' : 'fa-solid fa-file'} tamanho="56"></urbi-avatar>`;
        },
      },
      {
        id: 'legenda',
        label: 'Arquivo',
        render: (l) => {
          const m = l as Linha;
          return html`<urbi-stack>
            <urbi-prosa>${m.legenda ?? ROTULO_TIPO_MIDIA[m.tipo]}</urbi-prosa>
            <urbi-prosa papel="fraco">${[
              ROTULO_TIPO_MIDIA[m.tipo],
              m.ia_ambiente ? `IA: ${ROTULO_AMBIENTE[m.ia_ambiente] ?? m.ia_ambiente}${m.ia_nota !== null ? `, nota ${m.ia_nota}` : ''}` : null,
              m.publica ? 'no anúncio' : 'interno',
            ].filter(Boolean).join(' · ')}</urbi-prosa>
          </urbi-stack>`;
        },
      },
      {
        id: 'acoes',
        label: '',
        semRotuloMobile: true,
        render: (l) => {
          const i = lista.findIndex((x) => x.id === (l as Linha).id);
          const m = lista[i];
          return html`<urbi-linha quebrar>
            <urbi-botao variante="fantasma" icone="fa-solid fa-arrow-up" ariaLabel="Subir" ?desabilitado=${i === 0} @click=${() => this.mover(i, -1)}></urbi-botao>
            <urbi-botao variante="fantasma" icone="fa-solid fa-arrow-down" ariaLabel="Descer" ?desabilitado=${i === lista.length - 1} @click=${() => this.mover(i, 1)}></urbi-botao>
            <urbi-visualizador-arquivo variante="fantasma" rotulo="Ver" url=${m.url ?? ''} nome=${m.legenda ?? ROTULO_TIPO_MIDIA[m.tipo]}
              mime=${m.tipo === 'foto' ? 'image/jpeg' : ''}></urbi-visualizador-arquivo>
            <urbi-botao variante="fantasma" icone="fa-solid fa-pen" ariaLabel="Editar" @click=${() => this.editarMidia(m)}></urbi-botao>
            <urbi-botao variante="fantasma" icone="fa-solid fa-trash" ariaLabel="Apagar" @click=${() => this.removerMidia(m)}></urbi-botao>
          </urbi-linha>`;
        },
      },
    ];
  }

  // ---------- Dados e situação ----------

  private async opcoesVinculos() {
    if (!this.contatos.length) this.contatos = (await this.vida.esperar(chamarApi('/contatos?papel=proprietario'))).dados;
    if (!this.empreendimentos.length) this.empreendimentos = (await this.vida.esperar(chamarApi('/empreendimentos'))).dados;
  }

  private async editar() {
    if (!this.vida.vivo()) return;
    const im = this.ficha!.imovel;
    try {
      await this.opcoesVinculos();
    } catch (e) {
      // Conta trocada com as listas em voo: o formulário (do imóvel da conta anterior) não abre.
      if (this.vida.encerrado(e)) return;
      /* sem as listas, o formulário abre sem proprietário e empreendimento */
    }
    const e = im.endereco ?? {};
    const n = (v: number | null) => (v === null || v === undefined ? null : Number(v));
    void formularioEnviar(
      'Dados do imóvel',
      [
        { nome: 'titulo', tipo: 'texto', rotulo: 'Título', valor: im.titulo ?? '' },
        { nome: 'tipo', tipo: 'selecao', rotulo: 'Tipo', valor: im.tipo, opcoes: opcoes(ROTULO_TIPO_IMOVEL) },
        { nome: 'finalidade', tipo: 'selecao', rotulo: 'Finalidade', valor: im.finalidade, opcoes: [{ valor: 'venda', rotulo: 'Venda' }, { valor: 'venda_e_locacao', rotulo: 'Venda e locação' }] },
        // Dinheiro e área em texto, no formato brasileiro (#185): o campo numérico perdia o ponto de
        // milhar ("1.500.000" virava R$ 1,50). A string vai ao backend, que lê "1.450.000" e "120,5".
        { nome: 'preco', tipo: 'texto', rotulo: 'Preço (R$; vazio = sob consulta)', valor: reaisEmTexto(im.preco_c), placeholder: '1.450.000' },
        { nome: 'condominio', tipo: 'texto', rotulo: 'Condomínio (R$/mês)', valor: reaisEmTexto(im.condominio_c), placeholder: '1.200' },
        { nome: 'iptu_anual', tipo: 'texto', rotulo: 'IPTU (R$/ano)', valor: reaisEmTexto(im.iptu_anual_c), placeholder: '4.800' },
        { nome: 'area_util_m2', tipo: 'texto', rotulo: 'Área útil (m²)', valor: numeroEmTexto(n(im.area_util_m2)), placeholder: '120,5' },
        { nome: 'area_total_m2', tipo: 'texto', rotulo: 'Área total (m²)', valor: numeroEmTexto(n(im.area_total_m2)), placeholder: '250' },
        { nome: 'quartos', tipo: 'numero', rotulo: 'Quartos', valor: im.quartos, min: 0, max: 99 },
        { nome: 'suites', tipo: 'numero', rotulo: 'Suítes', valor: im.suites, min: 0, max: 99 },
        { nome: 'banheiros', tipo: 'numero', rotulo: 'Banheiros', valor: im.banheiros, min: 0, max: 99 },
        { nome: 'vagas', tipo: 'numero', rotulo: 'Vagas', valor: im.vagas, min: 0, max: 99 },
        { nome: 'logradouro', tipo: 'texto', rotulo: 'Endereço (rua, quadra)', valor: e.logradouro ?? '' },
        { nome: 'numero', tipo: 'texto', rotulo: 'Número', valor: e.numero ?? '' },
        { nome: 'complemento', tipo: 'texto', rotulo: 'Complemento', valor: e.complemento ?? '' },
        { nome: 'bairro', tipo: 'texto', rotulo: 'Bairro', valor: im.bairro ?? '' },
        { nome: 'cidade', tipo: 'texto', rotulo: 'Cidade', valor: im.cidade ?? '', obrigatorio: true },
        { nome: 'uf', tipo: 'texto', rotulo: 'UF', valor: im.uf ?? '' },
        { nome: 'cep', tipo: 'texto', rotulo: 'CEP', valor: e.cep ?? '' },
        {
          nome: 'endereco_publico',
          tipo: 'selecao',
          rotulo: 'O que mostrar do endereço no anúncio',
          valor: im.endereco_publico,
          opcoes: [{ valor: 'bairro', rotulo: 'Só o bairro' }, { valor: 'regiao', rotulo: 'Só a cidade' }, { valor: 'completo', rotulo: 'Endereço completo' }],
        },
        { nome: 'caracteristicas', tipo: 'texto_longo', rotulo: 'Características (separe por vírgula)', valor: im.caracteristicas ?? '', placeholder: 'piscina, churrasqueira, armários planejados' },
        {
          nome: 'proprietario_id',
          tipo: 'selecao',
          rotulo: 'Proprietário (contatos com papel proprietário)',
          pesquisavel: true,
          valor: im.proprietario_id ? String(im.proprietario_id) : '',
          opcoes: comAtual(
            [{ valor: '', rotulo: 'Sem proprietário' }, ...this.contatos.map((c) => ({ valor: String(c.id), rotulo: c.nome, textoBusca: c.telefone ?? '' }))],
            im.proprietario_id,
            im.proprietario_nome,
          ),
        },
        {
          nome: 'empreendimento_id',
          tipo: 'selecao',
          rotulo: 'Empreendimento',
          valor: im.empreendimento_id ? String(im.empreendimento_id) : '',
          opcoes: comAtual([{ valor: '', rotulo: 'Nenhum' }, ...this.empreendimentos.map((x) => ({ valor: String(x.id), rotulo: x.nome }))], im.empreendimento_id, im.empreendimento_nome),
        },
      ],
      'PATCH',
      `/imoveis/${this.imovelId}`,
      (v) => {
        const { proprietario_id, empreendimento_id, ...resto } = v;
        const novoProp = proprietario_id ? Number(proprietario_id) : null;
        const novoEmp = empreendimento_id ? Number(empreendimento_id) : null;
        // Vínculos só vão quando mudaram: o que não foi tocado não é reescrito.
        return {
          ...resto,
          endereco: { logradouro: v.logradouro, numero: v.numero, complemento: v.complemento, cep: v.cep },
          ...(novoProp !== (im.proprietario_id ?? null) ? { proprietario_id: novoProp } : {}),
          ...(novoEmp !== (im.empreendimento_id ?? null) ? { empreendimento_id: novoEmp } : {}),
        };
      },
      { gesto: this.vida },
    ).then((r) => {
      if (!this.vida.vivo()) return;
      this.contatos = [];
      return this.depois(r);
    });
  }

  private situacao() {
    return this.semAvisoDeOutraConta(async () => {
      const im = this.ficha!.imovel;
      const v = await this.vida.esperar(urbiVerso.formulario({
        titulo: 'Situação do imóvel',
        mensagem: 'Ativo e reservado pedem autorização de venda assinada e vigente.',
        campos: [{ nome: 'situacao', tipo: 'selecao', rotulo: 'Situação', valor: im.situacao, opcoes: Object.entries(SITUACAO_IMOVEL).map(([valor, s]) => ({ valor, rotulo: s.rotulo })) }],
      }));
      if (v) await this.tentar('Não foi possível mudar a situação', () => enviar('PATCH', `/imoveis/${this.imovelId}`, { situacao: v.situacao }));
    });
  }

  private async publicar(sim: boolean) {
    await this.tentar(sim ? 'Ainda não dá para publicar' : 'Não foi possível tirar da página', () => enviar('PATCH', `/imoveis/${this.imovelId}`, { publicado_pagina: sim }));
  }

  /** Conta trocada com a confirmação aberta ou o PATCH em voo: nada é removido, avisado nem navegado. */
  private async remover() {
    if (!this.vida.vivo()) return;
    try {
      const ok = await this.vida.esperar(urbiVerso.confirmar({ titulo: 'Remover imóvel', mensagem: 'O imóvel sai da carteira e da sua página. Fotos e autorizações ficam guardadas.', rotuloConfirmar: 'Remover', perigo: true }));
      if (!ok) return;
      await this.vida.esperar(enviar('PATCH', `/imoveis/${this.imovelId}/remover`, {}));
      window.dispatchEvent(new CustomEvent(EVENTO_IMOVEL_MUDOU, { detail: { id: this.imovelId, removido: true } }));
      // Tira o `?item=` do endereço: o centro não fica com a ficha do que saiu.
      filtrosNaUrl(filtrosDaUrl(), {}, ['item']);
      urbiVerso.navegarSub('/imoveis');
    } catch (e) {
      if (this.vida.encerrado(e)) return;
      await urbiVerso.alertar({ titulo: 'Não foi possível remover', mensagem: mensagemDeErro(e), tipo: 'erro' });
    }
  }

  // ---------- Descrição ----------

  private editarDescricao(sugestao?: { titulo: string; descricao: string; destaques: string[] }) {
    const im = this.ficha!.imovel;
    void formularioEnviar(
      sugestao ? 'Descrição sugerida pela IA' : 'Descrição',
      [
        { nome: 'titulo', tipo: 'texto', rotulo: 'Título', valor: sugestao?.titulo || im.titulo || '' },
        { nome: 'descricao', tipo: 'texto_longo', rotulo: 'Descrição', valor: sugestao ? [sugestao.descricao, sugestao.destaques.length ? `Destaques: ${sugestao.destaques.join(' · ')}` : ''].filter(Boolean).join('\n\n') : im.descricao ?? '' },
      ],
      'PATCH',
      `/imoveis/${this.imovelId}`,
      undefined,
      { ...(sugestao ? { mensagem: 'Revise antes de salvar: a IA usa só os dados cadastrados, mas confira cada informação.', rotuloConfirmar: 'Usar esta descrição' } : {}), gesto: this.vida },
    ).then((r) => this.depois(r));
  }

  private async escreverComIa() {
    if (!this.vida.vivo()) return;
    this.escrevendo = true;
    try {
      const s = await this.vida.esperar(enviar('POST', `/imoveis/${this.imovelId}/descricao`, {}));
      this.editarDescricao(s);
    } catch (e) {
      if (this.vida.encerrado(e)) return;
      await urbiVerso.alertar({ titulo: 'Não foi possível escrever agora', mensagem: mensagemDeErro(e), tipo: 'alerta' });
    } finally {
      this.escrevendo = false;
    }
  }

  // ---------- Autorização ----------

  // A autorização tem os próprios diálogos (autorizacao-venda.ts); aqui, a releitura só se a conta é a mesma.
  private novaAutorizacao() {
    return this.semAvisoDeOutraConta(async () => this.depois(await this.vida.esperar(registrarAutorizacao(this.ficha!.imovel, { gesto: this.vida }))));
  }

  private assinar(a: Linha) {
    return this.semAvisoDeOutraConta(async () => {
      if (await this.vida.esperar(marcarAssinada(a, this.ficha!.midias, undefined, { gesto: this.vida }))) await this.carregar();
    });
  }

  private revogar(a: Linha) {
    return this.semAvisoDeOutraConta(async () => {
      const ok = await this.vida.esperar(urbiVerso.confirmar({ titulo: 'Revogar autorização', mensagem: 'Sem autorização vigente, o imóvel deixa de aparecer na sua página.', rotuloConfirmar: 'Revogar', perigo: true }));
      if (ok) await this.tentar('Não foi possível revogar', () => enviar('PATCH', `/autorizacoes/${a.id}`, { situacao: 'revogada' }));
    });
  }

  private acao(rotulo: string, icone: string, fn: () => void) {
    return html`<span slot="acoes"><urbi-botao variante="fantasma" icone=${icone} ariaLabel=${rotulo} title=${rotulo} @click=${fn}></urbi-botao></span>`;
  }

  // ---------- O que falta ----------

  /** Cada pendência leva à seção que a resolve: abre o formulário dela ou rola até o cartão. */
  private resolver(falta: string) {
    switch (secaoDaFalta(falta)) {
      case 'dados':
        return void this.editar();
      case 'descricao':
        return this.editarDescricao();
      case 'autorizacao': {
        const aberta = autorizacaoAberta(this.ficha!.autorizacoes);
        return void (aberta ? this.assinar(aberta) : this.novaAutorizacao());
      }
      case 'fotos':
        return this.renderRoot.querySelector('#fotos')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  // ---------- Tela ----------

  // Ficha (P06): Editar e Criar conteúdo no alto, o resto em "Mais"; publicar ou tirar da página fica
  // em "Quem vê este imóvel". Os cartões mostram um resumo e guardam a lista no `detalhe`, recolhido.
  // Sem foto, fotos e arquivos ficam abertos: é por onde o cadastro continua.
  // Os cartões com `keyed` são recriados quando muda se há `detalhe` ou `acoes`: o urbi-card lê essa presença
  // só na renderização (SDK, urbi-card), então sem a chave a seta e a cabeça ficariam como estavam antes.
  render() {
    const banner = this.falha
      ? html`<urbi-banner variante="erro">
          ${this.falha}
          <urbi-botao slot="acao" variante="secundario" @click=${() => this.carregar()}>Tentar de novo</urbi-botao>
        </urbi-banner>`
      : '';
    if (this.falha && !this.ficha) return banner;
    if (!this.ficha) return html`<urbi-loading></urbi-loading>`;
    const { imovel: im, qualidade, midias, autorizacoes, visitas, negocios } = this.ficha;
    const s = SITUACAO_IMOVEL[im.situacao] ?? { rotulo: im.situacao, cor: 'padrao' };
    const comodos = [
      im.area_util_m2 ? `${Number(im.area_util_m2)} m² úteis` : null,
      im.area_total_m2 ? `${Number(im.area_total_m2)} m² total` : null,
      im.quartos != null ? `${im.quartos} quarto(s)` : null,
      im.suites ? `${im.suites} suíte(s)` : null,
      im.banheiros != null ? `${im.banheiros} banheiro(s)` : null,
      im.vagas != null ? `${im.vagas} vaga(s)` : null,
    ].filter(Boolean);
    const fotos = midias.filter((m) => m.tipo === 'foto').length;
    const principal: Acao = im.publicado_pagina
      ? { rotulo: 'Tirar da página', icone: 'fa-solid fa-eye-slash', aoEscolher: () => void this.publicar(false) }
      : { rotulo: 'Publicar na página', icone: 'fa-solid fa-globe', aoEscolher: () => void this.publicar(true) };
    const fotosComUrl = midias.filter((m) => m.tipo === 'foto' && m.url);
    const tabelaMidias = midias.length ? html`<urbi-tabela responsivo="multiline" .colunas=${this.colunasMidias()} .linhas=${midias}></urbi-tabela>` : '';
    return html`<urbi-stack>
      ${banner}
      <urbi-linha justificar="entre" quebrar>
        <urbi-prosa papel="titulo">${im.codigo} · ${im.titulo ?? ROTULO_TIPO_IMOVEL[im.tipo] ?? im.tipo}</urbi-prosa>
        <urbi-linha quebrar>
          ${im.situacao === 'rascunho'
            ? html`<urbi-botao icone="fa-solid fa-list-check" @click=${() => irParaComQuery(`/imoveis/novo?item=${im.id}`)}>Continuar cadastro</urbi-botao>`
            : ''}
          <urbi-botao variante="secundario" icone="fa-solid fa-pen" @click=${() => this.editar()}>Editar</urbi-botao>
          ${acoesComMais({ rotulo: 'Criar conteúdo', icone: 'fa-solid fa-wand-magic-sparkles', sub: `/estudio?criar=post&imovel=${im.id}` }, [
            { rotulo: 'Situação', icone: 'fa-solid fa-flag', aoEscolher: () => void this.situacao() },
            { rotulo: 'Remover', icone: 'fa-solid fa-trash', perigo: true, aoEscolher: () => void this.remover() },
          ])}
        </urbi-linha>
      </urbi-linha>
      ${qualidade.faltas.length
        ? html`<urbi-card titulo=${`O que falta · ${qualidade.nota} de 100`} icone="fa-solid fa-list-check">
            <urbi-linha quebrar>
              ${qualidade.faltas.map((f: string) => html`<urbi-badge interativo cor="alerta" @click=${() => void this.resolver(f)}>${f}</urbi-badge>`)}
            </urbi-linha>
          </urbi-card>`
        : ''}
      ${fotosComUrl.length
        ? html`<urbi-grid min="96px" gap="8px">
            ${fotosComUrl.slice(0, 6).map((m) => html`<urbi-avatar nome=${m.legenda ?? im.codigo} foto=${m.url} tamanho="96"></urbi-avatar>`)}
            ${fotosComUrl.length > 6
              ? html`<urbi-badge interativo @click=${() => this.renderRoot.querySelector('#fotos')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>+${fotosComUrl.length - 6} fotos</urbi-badge>`
              : ''}
          </urbi-grid>`
        : ''}
      <urbi-card titulo="Dados" icone="fa-solid fa-house">
        ${this.acao('Editar dados', 'fa-solid fa-pen', () => this.editar())}
        <urbi-grid min="170px" gap="12px">
          ${par('Situação', html`<urbi-badge cor=${s.cor}>${s.rotulo}</urbi-badge>`)}
          ${par('Qualidade', html`<urbi-badge cor=${corQualidade(qualidade.nota)}>${qualidade.nota} de 100</urbi-badge>`)}
          ${par('Tipo', ROTULO_TIPO_IMOVEL[im.tipo] ?? im.tipo)}
          ${par('Preço', im.preco_c ? reais(im.preco_c) : 'Sob consulta')}
          ${im.condominio_c ? par('Condomínio', reais(im.condominio_c)) : ''}
          ${par('Local', [im.bairro, im.cidade, im.uf].filter(Boolean).join(', ') || 'Não informado')}
          ${comodos.length ? par('Cômodos', comodos.join(' · ')) : ''}
          ${im.proprietario_nome ? par('Proprietário', im.proprietario_nome) : ''}
          ${im.empreendimento_nome ? par('Empreendimento', im.empreendimento_nome) : ''}
          ${im.caracteristicas ? par('Características', im.caracteristicas) : ''}
        </urbi-grid>
      </urbi-card>
      ${keyed(`descricao|aberta|${!!im.descricao}`, html`<urbi-card titulo="Descrição" icone="fa-solid fa-align-left">
        ${this.acao('Editar descrição', 'fa-solid fa-pen', () => this.editarDescricao())}
        ${im.descricao
          ? html`<urbi-prosa pre>${im.descricao}</urbi-prosa>
              <urbi-prosa papel="fraco">${im.descricao.length} caracteres${im.descricao.length < 400 ? ' (com 400 ou mais o anúncio ganha pontos)' : ''}</urbi-prosa>`
          : html`<urbi-prosa papel="dica">Sem descrição.</urbi-prosa>`}
        ${this.ia.conteudo
          ? html`<urbi-linha><urbi-botao variante="secundario" icone="fa-solid fa-wand-magic-sparkles" ?carregando=${this.escrevendo} @click=${() => this.escreverComIa()}>Melhorar com IA</urbi-botao></urbi-linha>`
          : ''}
      </urbi-card>`)}
      ${keyed(`autorizacao|aberta|${autorizacoes.length > 0}`, html`<urbi-card titulo="Autorização de venda" icone="fa-solid fa-file-signature">
        ${this.acao('Nova autorização', 'fa-solid fa-plus', () => this.novaAutorizacao())}
        ${autorizacoes.length
          ? html`<urbi-prosa papel="secundario">${this.ficha.autorizacao_vigente ? 'Assinada e vigente.' : 'Nenhuma assinada e vigente.'} ${autorizacoes.length} registrada(s).</urbi-prosa>
              <urbi-stack>
                <urbi-lista separador .itens=${autorizacoes} .render_item=${(a: Linha) => {
                  const sa = SITUACAO_AUTORIZACAO[a.situacao_efetiva] ?? { rotulo: a.situacao_efetiva, cor: 'padrao' };
                  return html`<urbi-linha justificar="entre" quebrar>
                    <urbi-stack>
                      <urbi-prosa>${data(a.inicio)} a ${data(a.fim)} · ${a.exclusiva ? 'exclusiva' : 'sem exclusividade'} · ${Number(a.comissao_pct)}% · ${reais(a.preco_autorizado_c)}</urbi-prosa>
                      <urbi-prosa papel="fraco">${a.proprietario_nome ?? ''}${a.permite_parceria ? ' · aceita parceria' : ''}${a.permite_portais ? ' · portais' : ''}${a.permite_placa ? ' · placa' : ''}</urbi-prosa>
                    </urbi-stack>
                    <urbi-linha quebrar>
                      <urbi-badge cor=${sa.cor}>${sa.rotulo}</urbi-badge>
                      ${['rascunho', 'enviada'].includes(a.situacao) ? html`<urbi-botao variante="texto" @click=${() => this.assinar(a)}>Marcar assinada</urbi-botao>` : ''}
                      ${a.situacao !== 'revogada' ? html`<urbi-botao variante="texto" @click=${() => this.revogar(a)}>Revogar</urbi-botao>` : ''}
                    </urbi-linha>
                  </urbi-linha>`;
                }}></urbi-lista>
              </urbi-stack>`
          : html`<urbi-prosa papel="dica">Sem autorização. Para anunciar, registre a autorização e anexe o documento assinado.</urbi-prosa>`}
      </urbi-card>`)}
      <urbi-card titulo="Quem vê este imóvel" icone="fa-solid fa-eye">
        <urbi-stack>
          <urbi-prosa papel="secundario">${this.ficha.publicavel
            ? 'Está na sua página pública e nas seleções que você enviar.'
            : im.publicado_pagina
              ? 'Marcado para a página, mas só aparece com autorização vigente e situação ativa ou reservada.'
              : 'Só você vê. Ele aparece para clientes nas seleções que você enviar e, publicado, na sua página.'}</urbi-prosa>
          <urbi-linha>${acoesComMais(principal, [])}</urbi-linha>
        </urbi-stack>
      </urbi-card>
      ${keyed(`fotos|${fotos > 0}|${!!this.ia.fotos}`, html`<urbi-card id="fotos" titulo="Fotos e arquivos" icone="fa-solid fa-images">
        ${this.ia.fotos && fotos
          ? html`<span slot="acoes"><urbi-botao variante="fantasma" icone="fa-solid fa-wand-magic-sparkles" ariaLabel="Ordem sugerida" title="Ordem sugerida"
              @click=${() => this.tentar('Não foi possível ordenar', () => enviar('POST', `/imoveis/${this.imovelId}/midias/ordem-sugerida`, {}))}></urbi-botao></span>`
          : ''}
        <urbi-seletor-arquivo drop multiplo accept="image/jpeg,image/png,image/webp,video/mp4,application/pdf" ?desabilitado=${!!this.enviando}
          dica="Fotos (JPG, PNG, WEBP), vídeo MP4 ou PDF — até 25 MB cada. A primeira foto é a capa."
          @urbi:seletor-arquivo-change=${(e: CustomEvent) => this.enviarArquivos(e)}></urbi-seletor-arquivo>
        ${this.enviando ? html`<urbi-prosa papel="secundario">${this.enviando}</urbi-prosa>` : ''}
        ${!midias.length
          ? html`<urbi-prosa papel="dica">Nenhum arquivo. Comece pelas fotos: com 8 ou mais o anúncio ganha pontos de qualidade.</urbi-prosa>`
          : fotos
            ? html`<urbi-prosa papel="secundario">${fotos} foto(s), ${this.ficha.fotos_publicas} no anúncio · ${midias.length} arquivo(s) no total</urbi-prosa>
                <div slot="detalhe">${tabelaMidias}</div>`
            : tabelaMidias}
      </urbi-card>`)}
      ${keyed(`visitas|${visitas.length > 0}`, html`<urbi-card titulo="Visitas" icone="fa-solid fa-door-open">
        ${visitas.length
          ? html`<urbi-prosa papel="secundario">${visitas.length} visita(s).</urbi-prosa>
              <div slot="detalhe">
                <urbi-lista separador .itens=${visitas} .render_item=${(v: Linha) => html`<urbi-stack>
                    <urbi-linha justificar="entre" quebrar>
                      <urbi-prosa>${dataHora(v.quando)}${v.contato_nome ? ` · ${v.contato_nome}` : ''}</urbi-prosa>
                      ${v.contato_id ? html`<urbi-botao variante="texto" href=${urbiVerso.href(`/clientes/${v.contato_id}`)}>Ver cliente</urbi-botao>` : ''}
                    </urbi-linha>
                    ${v.feedback_em
                      ? html`<urbi-prosa papel="secundario">${v.feedback_nota ? `Nota ${v.feedback_nota}/5. ` : ''}${v.feedback_texto ?? ''}${v.compartilhar_com_proprietario ? '' : ' (não compartilhar com o proprietário)'}</urbi-prosa>`
                      : html`<urbi-prosa papel="fraco">Sem retorno registrado.</urbi-prosa>`}
                  </urbi-stack>`}></urbi-lista>
              </div>`
          : html`<urbi-prosa papel="dica">Nenhuma visita. Agende pela ficha do cliente, escolhendo este imóvel.</urbi-prosa>`}
      </urbi-card>`)}
      ${keyed(`envios|${this.envios.length > 0}`, html`<urbi-card titulo="Enviado a" icone="fa-solid fa-paper-plane">
        ${this.envios.length
          ? html`<urbi-prosa papel="secundario">Enviado a ${this.envios.length} cliente(s).</urbi-prosa>
              <div slot="detalhe">
                <urbi-lista separador .itens=${this.envios} .render_item=${(e: Linha) => html`<urbi-linha justificar="entre" quebrar>
                    <urbi-prosa>${e.contato_nome ?? 'Cliente'} · ${dataHora(e.enviado_em)}</urbi-prosa>
                    <urbi-botao variante="texto" href=${urbiVerso.href(`/clientes/${e.contato_id}`)}>Ver cliente</urbi-botao>
                  </urbi-linha>`}></urbi-lista>
              </div>`
          : html`<urbi-prosa papel="dica">Ainda não foi enviado a nenhum cliente. Registre o envio pela ficha do cliente.</urbi-prosa>`}
      </urbi-card>`)}
      ${keyed(`negocios|${negocios.length > 0}`, html`<urbi-card titulo="Negócios" icone="fa-solid fa-handshake">
        ${negocios.length
          ? html`<urbi-prosa papel="secundario">${negocios.length} negócio(s) ligado(s).</urbi-prosa>
              <div slot="detalhe">
                <urbi-lista separador .itens=${negocios} .render_item=${(n: Linha) => html`<urbi-linha justificar="entre" quebrar>
                    <urbi-prosa>${n.titulo}</urbi-prosa>
                    <urbi-linha>
                      <urbi-badge>${n.etapa_nome ?? ''}</urbi-badge>
                      <urbi-botao variante="texto" href=${urbiVerso.href(`/clientes/${n.contato_id}`)}>Ver cliente</urbi-botao>
                    </urbi-linha>
                  </urbi-linha>`}></urbi-lista>
              </div>`
          : html`<urbi-prosa papel="dica">Nenhum negócio ligado a este imóvel.</urbi-prosa>`}
      </urbi-card>`)}
    </urbi-stack>`;
  }
}
