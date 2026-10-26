import { LitElement, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { UrbiColunaTabela, UrbiVersoAPI } from '@urbiverso/sdk';
import { secaoDaFalta } from '../../comum/imoveis';
import { acoesComMais, chamarApi, corQualidade, data, dataHora, enviar, formularioEnviar, mensagemDeErro, opcoes, reais, ROTULO_AMBIENTE, ROTULO_TIPO_IMOVEL, ROTULO_TIPO_MIDIA, SITUACAO_IMOVEL, subirArquivo, type Acao } from '../apoio.js';

declare const urbiVerso: UrbiVersoAPI;

type Linha = Record<string, any>;

interface Ficha {
  imovel: Linha;
  qualidade: { nota: number; faltas: string[] };
  autorizacao_vigente: boolean;
  publicavel: boolean;
  fotos_publicas: number;
  midias: Linha[];
  autorizacoes: Linha[];
  visitas: Linha[];
  negocios: Linha[];
}

const SITUACAO_AUTORIZACAO: Record<string, { rotulo: string; cor: string }> = {
  rascunho: { rotulo: 'Rascunho', cor: 'padrao' },
  enviada: { rotulo: 'Enviada ao proprietário', cor: 'info' },
  assinada: { rotulo: 'Assinada', cor: 'sucesso' },
  vencida: { rotulo: 'Vencida', cor: 'alerta' },
  revogada: { rotulo: 'Revogada', cor: 'padrao' },
};
const hojeIso = () => new Date().toLocaleDateString('sv-SE');
const mais = (dias: number) => new Date(Date.now() + dias * 86400e3).toLocaleDateString('sv-SE');

// Ficha do imóvel: o que falta no anúncio, dados, fotos (cadastro rápido), descrição com IA,
// autorização de venda, visitas e negócios. Publicar pede autorização vigente.
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

  connectedCallback() {
    super.connectedCallback();
    void this.carregar();
    void chamarApi('/imoveis/ia').then((r) => (this.ia = r), () => undefined);
  }

  private async carregar() {
    this.falha = null;
    try {
      const [ficha, envios] = await Promise.all([chamarApi(`/imoveis/${this.imovelId}`), chamarApi(`/envios?imovel_id=${this.imovelId}`).catch(() => ({ dados: [] }))]);
      this.ficha = ficha;
      this.envios = envios.dados;
    } catch (e) {
      this.falha = (e as Error).message;
    }
  }

  private async depois(r: unknown) {
    if (r) await this.carregar();
  }

  private async tentar(titulo: string, fn: () => Promise<unknown>) {
    try {
      await fn();
      await this.carregar();
    } catch (e) {
      await urbiVerso.alertar({ titulo, mensagem: mensagemDeErro(e), tipo: 'erro' });
    }
  }

  // ---------- Fotos e arquivos ----------

  /** Envia em sequência: staging, grava a mídia e, se a IA estiver ligada, pede a leitura da foto. */
  private async enviarArquivos(e: CustomEvent) {
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
        const upload_id = await subirArquivo('imovel_midias', 'arquivo', f);
        novas.push(await enviar('POST', `/imoveis/${this.imovelId}/midias`, { upload_id, tipo }));
      } catch (err) {
        recusados.push(`${f.name}: ${mensagemDeErro(err)}`);
      }
    }
    if (this.ia.fotos) {
      for (const [i, m] of novas.filter((n) => n.tipo === 'foto').entries()) {
        this.enviando = `Lendo as fotos com IA (${i + 1})…`;
        await enviar('POST', `/imoveis/${this.imovelId}/midias/${m.id}/analisar`, {}).catch(() => undefined); // leitura é bônus
      }
    }
    this.enviando = null;
    await this.carregar();
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
    ).then((r) => this.depois(r));
  }

  private async removerMidia(m: Linha) {
    const ok = await urbiVerso.confirmar({ titulo: 'Apagar arquivo', mensagem: 'O arquivo é apagado de vez.', rotuloConfirmar: 'Apagar', perigo: true });
    if (ok) await this.tentar('Não foi possível apagar', () => enviar('PATCH', `/imoveis/${this.imovelId}/midias/${m.id}/remover`, {}));
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
            <urbi-botao variante="fantasma" pequeno icone="fa-solid fa-arrow-up" ariaLabel="Subir" ?desabilitado=${i === 0} @click=${() => this.mover(i, -1)}></urbi-botao>
            <urbi-botao variante="fantasma" pequeno icone="fa-solid fa-arrow-down" ariaLabel="Descer" ?desabilitado=${i === lista.length - 1} @click=${() => this.mover(i, 1)}></urbi-botao>
            <urbi-visualizador-arquivo pequeno variante="fantasma" rotulo="Ver" url=${m.url ?? ''} nome=${m.legenda ?? ROTULO_TIPO_MIDIA[m.tipo]}
              mime=${m.tipo === 'foto' ? 'image/jpeg' : ''}></urbi-visualizador-arquivo>
            <urbi-botao variante="fantasma" pequeno icone="fa-solid fa-pen" ariaLabel="Editar" @click=${() => this.editarMidia(m)}></urbi-botao>
            <urbi-botao variante="fantasma" pequeno icone="fa-solid fa-trash" ariaLabel="Apagar" @click=${() => this.removerMidia(m)}></urbi-botao>
          </urbi-linha>`;
        },
      },
    ];
  }

  // ---------- Dados e situação ----------

  private async opcoesVinculos() {
    if (!this.contatos.length) this.contatos = (await chamarApi('/contatos?papel=proprietario')).dados;
    if (!this.empreendimentos.length) this.empreendimentos = (await chamarApi('/empreendimentos')).dados;
  }

  private async editar() {
    const im = this.ficha!.imovel;
    try {
      await this.opcoesVinculos();
    } catch {
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
        { nome: 'preco', tipo: 'numero', rotulo: 'Preço (R$; vazio = sob consulta)', valor: im.preco_c ? im.preco_c / 100 : null, min: 0 },
        { nome: 'condominio', tipo: 'numero', rotulo: 'Condomínio (R$/mês)', valor: im.condominio_c ? im.condominio_c / 100 : null, min: 0 },
        { nome: 'iptu_anual', tipo: 'numero', rotulo: 'IPTU (R$/ano)', valor: im.iptu_anual_c ? im.iptu_anual_c / 100 : null, min: 0 },
        { nome: 'area_util_m2', tipo: 'numero', rotulo: 'Área útil (m²)', valor: n(im.area_util_m2), min: 0, step: 0.01 },
        { nome: 'area_total_m2', tipo: 'numero', rotulo: 'Área total (m²)', valor: n(im.area_total_m2), min: 0, step: 0.01 },
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
          opcoes: this.comAtual(
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
          opcoes: this.comAtual([{ valor: '', rotulo: 'Nenhum' }, ...this.empreendimentos.map((x) => ({ valor: String(x.id), rotulo: x.nome }))], im.empreendimento_id, im.empreendimento_nome),
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
    ).then((r) => {
      this.contatos = [];
      return this.depois(r);
    });
  }

  /** Garante a opção atual na seleção, mesmo fora da lista carregada (a seleção abriria vazia). */
  private comAtual(opcoes: { valor: string; rotulo: string; textoBusca?: string }[], atual: number | null, nome: string | null) {
    if (!atual || opcoes.some((o) => o.valor === String(atual))) return opcoes;
    return [{ valor: String(atual), rotulo: nome ?? `Atual (${atual})` }, ...opcoes];
  }

  private async situacao() {
    const im = this.ficha!.imovel;
    const v = await urbiVerso.formulario({
      titulo: 'Situação do imóvel',
      mensagem: 'Ativo e reservado pedem autorização de venda assinada e vigente.',
      campos: [{ nome: 'situacao', tipo: 'selecao', rotulo: 'Situação', valor: im.situacao, opcoes: Object.entries(SITUACAO_IMOVEL).map(([valor, s]) => ({ valor, rotulo: s.rotulo })) }],
    });
    if (v) await this.tentar('Não foi possível mudar a situação', () => enviar('PATCH', `/imoveis/${this.imovelId}`, { situacao: v.situacao }));
  }

  private async publicar(sim: boolean) {
    await this.tentar(sim ? 'Ainda não dá para publicar' : 'Não foi possível tirar da página', () => enviar('PATCH', `/imoveis/${this.imovelId}`, { publicado_pagina: sim }));
  }

  private async remover() {
    const ok = await urbiVerso.confirmar({ titulo: 'Remover imóvel', mensagem: 'O imóvel sai da carteira e da sua página. Fotos e autorizações ficam guardadas.', rotuloConfirmar: 'Remover', perigo: true });
    if (!ok) return;
    try {
      await enviar('PATCH', `/imoveis/${this.imovelId}/remover`, {});
      urbiVerso.navegarSub('/imoveis');
    } catch (e) {
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
      sugestao ? { mensagem: 'Revise antes de salvar: a IA usa só os dados cadastrados, mas confira cada informação.', rotuloConfirmar: 'Usar esta descrição' } : {},
    ).then((r) => this.depois(r));
  }

  private async escreverComIa() {
    this.escrevendo = true;
    try {
      const s = await enviar('POST', `/imoveis/${this.imovelId}/descricao`, {});
      this.editarDescricao(s);
    } catch (e) {
      await urbiVerso.alertar({ titulo: 'Não foi possível escrever agora', mensagem: mensagemDeErro(e), tipo: 'alerta' });
    } finally {
      this.escrevendo = false;
    }
  }

  // ---------- Autorização ----------

  private async novaAutorizacao() {
    const im = this.ficha!.imovel;
    try {
      await this.opcoesVinculos();
    } catch {
      /* segue com o proprietário atual, se houver */
    }
    const opcoesProp = this.comAtual(this.contatos.map((c) => ({ valor: String(c.id), rotulo: c.nome, textoBusca: c.telefone ?? '' })), im.proprietario_id, im.proprietario_nome);
    if (!opcoesProp.length) {
      await urbiVerso.alertar({ titulo: 'Cadastre o proprietário', mensagem: 'Em Clientes, cadastre quem assina a autorização com o papel "proprietário" e volte aqui.', tipo: 'alerta' });
      return;
    }
    void formularioEnviar(
      'Autorização de venda',
      [
        {
          nome: 'proprietario_id',
          tipo: 'selecao',
          rotulo: 'Proprietário que assina',
          obrigatorio: true,
          pesquisavel: true,
          valor: im.proprietario_id ? String(im.proprietario_id) : null,
          opcoes: opcoesProp,
        },
        { nome: 'inicio', tipo: 'data', rotulo: 'Início', obrigatorio: true, valor: hojeIso() },
        { nome: 'fim', tipo: 'data', rotulo: 'Fim', obrigatorio: true, valor: mais(180) },
        { nome: 'preco_autorizado', tipo: 'numero', rotulo: 'Preço autorizado (R$)', obrigatorio: true, valor: im.preco_c ? im.preco_c / 100 : null, min: 0 },
        { nome: 'comissao_pct', tipo: 'numero', rotulo: 'Comissão (%)', obrigatorio: true, valor: 6, min: 0, max: 100, step: 0.5 },
        { nome: 'exclusiva', tipo: 'booleano', rotulo: 'Exclusiva', valor: false },
        { nome: 'permite_placa', tipo: 'booleano', rotulo: 'Permite placa', valor: true },
        { nome: 'permite_portais', tipo: 'booleano', rotulo: 'Permite anunciar em portais', valor: true },
        { nome: 'permite_parceria', tipo: 'booleano', rotulo: 'Permite parceria com outros corretores', valor: false },
      ],
      'POST',
      '/autorizacoes',
      (v) => ({ ...v, imovel_id: this.imovelId, proprietario_id: Number(v.proprietario_id) }),
      { mensagem: 'Depois de assinada, anexe o documento e marque como assinada.' },
    ).then((r) => this.depois(r));
  }

  private async assinar(a: Linha) {
    const docs = this.ficha!.midias.filter((m) => m.tipo === 'documento' || m.tipo === 'foto');
    if (!docs.length) {
      await urbiVerso.alertar({ titulo: 'Anexe o documento', mensagem: 'Envie o documento assinado (PDF ou foto) em "Fotos e arquivos" e volte aqui.', tipo: 'alerta' });
      return;
    }
    const v = await urbiVerso.formulario({
      titulo: 'Marcar como assinada',
      mensagem: 'O documento escolhido fica interno: nunca aparece no anúncio.',
      campos: [
        {
          nome: 'documento_midia_id',
          tipo: 'selecao',
          rotulo: 'Documento assinado',
          obrigatorio: true,
          valor: docs.find((d) => d.tipo === 'documento') ? String(docs.find((d) => d.tipo === 'documento')!.id) : null,
          opcoes: docs.map((d) => ({ valor: String(d.id), rotulo: `${ROTULO_TIPO_MIDIA[d.tipo]}: ${d.legenda ?? `arquivo ${d.id}`}` })),
        },
      ],
      rotuloConfirmar: 'Marcar como assinada',
    });
    if (v) await this.tentar('Não foi possível marcar como assinada', () => enviar('PATCH', `/autorizacoes/${a.id}`, { documento_midia_id: Number(v.documento_midia_id), situacao: 'assinada' }));
  }

  private async revogar(a: Linha) {
    const ok = await urbiVerso.confirmar({ titulo: 'Revogar autorização', mensagem: 'Sem autorização vigente, o imóvel deixa de aparecer na sua página.', rotuloConfirmar: 'Revogar', perigo: true });
    if (ok) await this.tentar('Não foi possível revogar', () => enviar('PATCH', `/autorizacoes/${a.id}`, { situacao: 'revogada' }));
  }

  private acao(rotulo: string, icone: string, fn: () => void) {
    return html`<span slot="acoes"><urbi-botao variante="fantasma" pequeno icone=${icone} ariaLabel=${rotulo} title=${rotulo} @click=${fn}></urbi-botao></span>`;
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
        const aberta = this.ficha!.autorizacoes.find((a) => ['rascunho', 'enviada'].includes(a.situacao));
        return void (aberta ? this.assinar(aberta) : this.novaAutorizacao());
      }
      case 'conta':
        return urbiVerso.navegarSub('/ajustes/conta');
      case 'fotos':
        return this.renderRoot.querySelector('#fotos')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  private oQueFalta(qualidade: Ficha['qualidade']) {
    if (!qualidade.faltas.length) return '';
    return html`<urbi-card titulo="O que falta no anúncio" icone="fa-solid fa-list-check">
      <span slot="acoes"><urbi-badge cor=${corQualidade(qualidade.nota)} title="Qualidade do anúncio">${qualidade.nota}</urbi-badge></span>
      <urbi-lista separador clicavel .itens=${qualidade.faltas}
        .render_item=${(f: string) => html`<urbi-linha justificar="entre">
          <urbi-prosa>${f}</urbi-prosa>
          <urbi-icone classe="fa-solid fa-chevron-right"></urbi-icone>
        </urbi-linha>`}
        @urbi:lista-click=${(e: CustomEvent) => this.resolver(e.detail.item as string)}></urbi-lista>
    </urbi-card>`;
  }

  // ---------- Tela ----------

  // Ficha (D-84, spec 11.1): "o que falta" no topo; uma ação principal (publicar ou tirar da página)
  // e o resto em "Mais"; os cartões mostram um resumo e guardam a lista no `detalhe`, recolhido.
  // Sem foto, fotos e arquivos ficam abertos: é por onde o cadastro continua.
  render() {
    const banner = this.falha
      ? html`<urbi-banner variante="erro">
          ${this.falha}
          <urbi-botao slot="acao" pequeno variante="secundario" @click=${() => this.carregar()}>Tentar de novo</urbi-botao>
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
    const tabelaMidias = midias.length ? html`<urbi-tabela responsivo="multiline" .colunas=${this.colunasMidias()} .linhas=${midias}></urbi-tabela>` : '';
    return html`<urbi-stack>
      ${banner}
      <urbi-linha justificar="entre" quebrar>
        <urbi-botao variante="texto" icone="fa-solid fa-arrow-left" href=${urbiVerso.href('/imoveis')}>Imóveis</urbi-botao>
        ${acoesComMais(principal, [
          { rotulo: 'Editar dados', icone: 'fa-solid fa-pen', aoEscolher: () => void this.editar() },
          { rotulo: 'Situação', icone: 'fa-solid fa-flag', aoEscolher: () => void this.situacao() },
          { rotulo: 'Remover', icone: 'fa-solid fa-trash', perigo: true, aoEscolher: () => void this.remover() },
        ])}
      </urbi-linha>
      ${this.oQueFalta(qualidade)}
      <urbi-card titulo=${`${im.codigo} · ${im.titulo ?? ROTULO_TIPO_IMOVEL[im.tipo] ?? im.tipo}`} icone="fa-solid fa-house">
        ${this.acao('Editar dados', 'fa-solid fa-pen', () => this.editar())}
        <urbi-linha quebrar>
          <urbi-badge cor=${s.cor}>${s.rotulo}</urbi-badge>
          ${this.ficha.publicavel
            ? html`<urbi-badge cor="sucesso">Na página</urbi-badge>`
            : im.publicado_pagina
              ? html`<urbi-badge cor="alerta">Marcado para a página, mas sem autorização vigente ou fora de ativo</urbi-badge>`
              : ''}
          <urbi-badge cor=${corQualidade(qualidade.nota)}>Qualidade ${qualidade.nota}</urbi-badge>
        </urbi-linha>
        <urbi-prosa>${ROTULO_TIPO_IMOVEL[im.tipo] ?? im.tipo} · ${im.preco_c ? reais(im.preco_c) : 'preço sob consulta'}${im.condominio_c ? ` · condomínio ${reais(im.condominio_c)}` : ''}</urbi-prosa>
        <urbi-prosa papel="secundario">${[im.bairro, im.cidade, im.uf].filter(Boolean).join(', ')}${comodos.length ? ` · ${comodos.join(' · ')}` : ''}</urbi-prosa>
        ${im.proprietario_nome ? html`<urbi-prosa papel="secundario">Proprietário: ${im.proprietario_nome}</urbi-prosa>` : ''}
        ${im.empreendimento_nome ? html`<urbi-prosa papel="secundario">Empreendimento: ${im.empreendimento_nome}</urbi-prosa>` : ''}
        ${im.caracteristicas ? html`<urbi-prosa papel="dica">${im.caracteristicas}</urbi-prosa>` : ''}
      </urbi-card>
      <urbi-card id="fotos" titulo="Fotos e arquivos" icone="fa-solid fa-images">
        ${this.ia.fotos && fotos
          ? html`<span slot="acoes"><urbi-botao variante="fantasma" pequeno icone="fa-solid fa-wand-magic-sparkles" ariaLabel="Ordem sugerida" title="Ordem sugerida"
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
      </urbi-card>
      <urbi-card titulo="Descrição" icone="fa-solid fa-align-left">
        ${this.acao('Editar descrição', 'fa-solid fa-pen', () => this.editarDescricao())}
        ${im.descricao
          ? html`<urbi-prosa papel="secundario">${im.descricao.length} caracteres${im.descricao.length < 400 ? ' (com 400 ou mais o anúncio ganha pontos)' : ''}</urbi-prosa>
              <div slot="detalhe"><urbi-prosa pre>${im.descricao}</urbi-prosa></div>`
          : html`<urbi-prosa papel="dica">Sem descrição.</urbi-prosa>`}
        ${this.ia.conteudo
          ? html`<urbi-linha><urbi-botao variante="secundario" pequeno icone="fa-solid fa-wand-magic-sparkles" ?carregando=${this.escrevendo} @click=${() => this.escreverComIa()}>Escrever com IA</urbi-botao></urbi-linha>`
          : ''}
      </urbi-card>
      <urbi-card titulo="Autorização de venda" icone="fa-solid fa-file-signature">
        ${this.acao('Nova autorização', 'fa-solid fa-plus', () => this.novaAutorizacao())}
        ${autorizacoes.length
          ? html`<urbi-prosa papel="secundario">${this.ficha.autorizacao_vigente ? 'Assinada e vigente.' : 'Nenhuma assinada e vigente.'} ${autorizacoes.length} registrada(s).</urbi-prosa>
              <div slot="detalhe">
                <urbi-lista separador .itens=${autorizacoes} .render_item=${(a: Linha) => {
                  const sa = SITUACAO_AUTORIZACAO[a.situacao_efetiva] ?? { rotulo: a.situacao_efetiva, cor: 'padrao' };
                  return html`<urbi-linha justificar="entre" quebrar>
                    <urbi-stack>
                      <urbi-prosa>${data(a.inicio)} a ${data(a.fim)} · ${a.exclusiva ? 'exclusiva' : 'sem exclusividade'} · ${Number(a.comissao_pct)}% · ${reais(a.preco_autorizado_c)}</urbi-prosa>
                      <urbi-prosa papel="fraco">${a.proprietario_nome ?? ''}${a.permite_parceria ? ' · aceita parceria' : ''}${a.permite_portais ? ' · portais' : ''}${a.permite_placa ? ' · placa' : ''}</urbi-prosa>
                    </urbi-stack>
                    <urbi-linha quebrar>
                      <urbi-badge cor=${sa.cor}>${sa.rotulo}</urbi-badge>
                      ${['rascunho', 'enviada'].includes(a.situacao) ? html`<urbi-botao variante="texto" pequeno @click=${() => this.assinar(a)}>Marcar assinada</urbi-botao>` : ''}
                      ${a.situacao !== 'revogada' ? html`<urbi-botao variante="texto" pequeno @click=${() => this.revogar(a)}>Revogar</urbi-botao>` : ''}
                    </urbi-linha>
                  </urbi-linha>`;
                }}></urbi-lista>
              </div>`
          : html`<urbi-prosa papel="dica">Sem autorização. Para anunciar, registre a autorização e anexe o documento assinado.</urbi-prosa>`}
      </urbi-card>
      <urbi-card titulo="Visitas" icone="fa-solid fa-door-open">
        ${visitas.length
          ? html`<urbi-prosa papel="secundario">${visitas.length} visita(s).</urbi-prosa>
              <div slot="detalhe">
                <urbi-lista separador .itens=${visitas} .render_item=${(v: Linha) => html`<urbi-stack>
                    <urbi-linha justificar="entre" quebrar>
                      <urbi-prosa>${dataHora(v.quando)}${v.contato_nome ? ` · ${v.contato_nome}` : ''}</urbi-prosa>
                      ${v.contato_id ? html`<urbi-botao variante="texto" pequeno href=${urbiVerso.href(`/clientes/${v.contato_id}`)}>Ver cliente</urbi-botao>` : ''}
                    </urbi-linha>
                    ${v.feedback_em
                      ? html`<urbi-prosa papel="secundario">${v.feedback_nota ? `Nota ${v.feedback_nota}/5. ` : ''}${v.feedback_texto ?? ''}${v.compartilhar_com_proprietario ? '' : ' (não compartilhar com o proprietário)'}</urbi-prosa>`
                      : html`<urbi-prosa papel="fraco">Sem retorno registrado.</urbi-prosa>`}
                  </urbi-stack>`}></urbi-lista>
              </div>`
          : html`<urbi-prosa papel="dica">Nenhuma visita. Agende pela ficha do cliente, escolhendo este imóvel.</urbi-prosa>`}
      </urbi-card>
      <urbi-card titulo="Enviado a" icone="fa-solid fa-paper-plane">
        ${this.envios.length
          ? html`<urbi-prosa papel="secundario">Enviado a ${this.envios.length} cliente(s).</urbi-prosa>
              <div slot="detalhe">
                <urbi-lista separador .itens=${this.envios} .render_item=${(e: Linha) => html`<urbi-linha justificar="entre" quebrar>
                    <urbi-prosa>${e.contato_nome ?? 'Cliente'} · ${dataHora(e.enviado_em)}</urbi-prosa>
                    <urbi-botao variante="texto" pequeno href=${urbiVerso.href(`/clientes/${e.contato_id}`)}>Ver cliente</urbi-botao>
                  </urbi-linha>`}></urbi-lista>
              </div>`
          : html`<urbi-prosa papel="dica">Ainda não foi enviado a nenhum cliente. Registre o envio pela ficha do cliente.</urbi-prosa>`}
      </urbi-card>
      <urbi-card titulo="Negócios" icone="fa-solid fa-handshake">
        ${negocios.length
          ? html`<urbi-prosa papel="secundario">${negocios.length} negócio(s) ligado(s).</urbi-prosa>
              <div slot="detalhe">
                <urbi-lista separador .itens=${negocios} .render_item=${(n: Linha) => html`<urbi-linha justificar="entre" quebrar>
                    <urbi-prosa>${n.titulo}</urbi-prosa>
                    <urbi-linha>
                      <urbi-badge>${n.etapa_nome ?? ''}</urbi-badge>
                      <urbi-botao variante="texto" pequeno href=${urbiVerso.href(`/clientes/${n.contato_id}`)}>Ver cliente</urbi-botao>
                    </urbi-linha>
                  </urbi-linha>`}></urbi-lista>
              </div>`
          : html`<urbi-prosa papel="dica">Nenhum negócio ligado a este imóvel.</urbi-prosa>`}
      </urbi-card>
    </urbi-stack>`;
  }
}
