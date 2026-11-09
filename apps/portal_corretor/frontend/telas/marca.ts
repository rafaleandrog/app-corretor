import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { keyed } from 'lit/directives/keyed.js';
import type { UrbiVersoAPI } from '@urbiverso/sdk';
import { MAX_REFERENCIAS, ROTULO_TOM_VOZ, TONS_VOZ, type TomVoz } from '../../comum/estudio';
import { chamarApi, enviar, escolhaUnica, gesto, mensagemDeErro, subirArquivo } from '../apoio';

declare const urbiVerso: UrbiVersoAPI;

interface Marca {
  cor_primaria: string;
  cor_secundaria: string;
  estilo: string;
  assinatura: string | null;
  tom_voz?: TomVoz;
  logo_url: string | null;
  foto_url?: string | null;
  /** Imagens que o corretor admira (D-86): entram, se ele marcar, na instrução de "Fazer em outra ferramenta". */
  referencias: { id: number; url: string }[];
  /** Só em resposta que ressincronizou o que está no ar (salvar, foto, republicar): true = não acompanhou. Ausente (logo) = nada a dizer. */
  vitrine_desatualizada?: boolean;
}

const ESTILOS = [
  { valor: 'moderno', rotulo: 'Moderno' },
  { valor: 'classico', rotulo: 'Clássico' },
  { valor: 'minimalista', rotulo: 'Minimalista' },
];

// Ajustes › Conta e marca (D-81, D-85, P13): logo e foto com rótulo e prévia, cores com amostra (#182
// item 6), estilo, assinatura e tom de voz, num formulário na tela com Salvar. A marca é única: o Estúdio
// a usa nas artes (o tom de voz vai aos textos), e a cor principal e a foto valem na página pública, nas
// seleções e no portal. Mesmas rotas de antes (`/estudio/marca`).

interface RascunhoMarca {
  cor_primaria: string;
  cor_secundaria: string;
  estilo: string;
  assinatura: string;
  tom_voz: TomVoz;
}

const rascunhoDaMarca = (m: Marca): RascunhoMarca => ({
  cor_primaria: m.cor_primaria,
  cor_secundaria: m.cor_secundaria,
  estilo: m.estilo,
  assinatura: m.assinatura ?? '',
  tom_voz: m.tom_voz ?? 'proximo',
});

/** Os tons de voz como opções de escolha única (os "rádios" da referência). */
export const OPCOES_TOM_VOZ = TONS_VOZ.map((id) => ({ id, ...ROTULO_TOM_VOZ[id] }));
@customElement('pc-tela-marca')
export class PcTelaMarca extends LitElement {
  @state() private marca: Marca | null = null;
  @state() private falha: string | null = null;
  @state() private rascunho: RascunhoMarca | null = null;
  @state() private salvando = false;
  /** Salvar gravou a marca, mas o que está no ar não acompanhou: fica até refazer dar certo. */
  @state() private desatualizada = false;
  @state() private refazendo = false;
  /** Troca a cada envio de referência: o seletor volta vazio (ele também avisa quando um arquivo sai da lista). */
  @state() private seletorRefs = 0;
  /**
   * A conta em que a tela nasceu (a troca de conta a recria). Toda continuação passa por `vida.esperar`:
   * trocada a conta em qualquer await (diálogo aberto, laço de envios), o gesto termina em silêncio.
   */
  private readonly vida = gesto();

  /** Um gesto com diálogo ou cadeia de awaits: conta trocada no meio termina em silêncio. */
  private async semAvisoDeOutraConta(fn: () => Promise<unknown>) {
    // A conta já mudou (a tela é de antes): o gesto nem começa, nenhum diálogo abre.
    if (!this.vida.vivo()) return;
    try {
      await fn();
    } catch (e) {
      if (!this.vida.encerrado(e)) throw e;
    }
  }

  connectedCallback() {
    super.connectedCallback();
    void this.carregar();
  }

  private async carregar() {
    this.falha = null;
    try {
      this.marca = await this.vida.esperar(chamarApi('/estudio/marca'));
      this.rascunho = rascunhoDaMarca(this.marca!);
    } catch (e) {
      if (this.vida.encerrado(e)) return;
      this.falha = mensagemDeErro(e);
    }
  }

  /** Salvar devolve a marca e diz se o que está no ar acompanhou (`vitrine_desatualizada`). */
  private async acao(fn: () => Promise<Marca>, sucesso: string) {
    // Confere antes de `fn()`: a escrita sairia já com o `X-Conta` da outra conta.
    if (!this.vida.vivo()) return false;
    try {
      const r = await this.vida.esperar(fn());
      this.marca = r;
      // Só uma resposta que ressincronizou muda o alerta; sem o campo (logo), ele fica como está.
      if (r.vitrine_desatualizada === true) this.desatualizada = true;
      else if (r.vitrine_desatualizada === false) this.desatualizada = false;
      urbiVerso.notificar(sucesso, 'sucesso');
      return true;
    } catch (e) {
      if (this.vida.encerrado(e)) return false;
      await urbiVerso.alertar({ titulo: 'Não foi possível concluir', mensagem: mensagemDeErro(e), tipo: 'erro' });
      return false;
    }
  }

  private mudar<K extends keyof RascunhoMarca>(campo: K, valor: RascunhoMarca[K]) {
    if (this.rascunho) this.rascunho = { ...this.rascunho, [campo]: valor };
  }

  /** Salvar marca (P13): o formulário inteiro num `PUT /estudio/marca`, como antes. */
  private async salvar() {
    const r = this.rascunho;
    if (!r || this.salvando) return;
    this.salvando = true;
    try {
      const ok = await this.acao(() => enviar('PUT', '/estudio/marca', { ...r, assinatura: r.assinatura }), 'Marca salva.');
      if (ok && this.marca) this.rascunho = rascunhoDaMarca(this.marca);
    } finally {
      this.salvando = false;
    }
  }

  /** Refaz a página no ar (se publicada), as seleções e os portais com a marca salva. */
  private async refazer() {
    if (!this.vida.vivo()) return;
    this.refazendo = true;
    try {
      const r: Marca = await this.vida.esperar(enviar('POST', '/estudio/marca/republicar'));
      this.marca = r;
      this.desatualizada = !!r.vitrine_desatualizada;
      if (!this.desatualizada) urbiVerso.notificar('Página, seleções e portais atualizados.', 'sucesso');
    } catch (e) {
      if (this.vida.encerrado(e)) return;
      await urbiVerso.alertar({ titulo: 'Não foi possível concluir', mensagem: mensagemDeErro(e), tipo: 'erro' });
    } finally {
      this.refazendo = false;
    }
  }

  private async enviarArquivo(tipo: 'logo' | 'foto', e: CustomEvent) {
    const f = ((e.detail.arquivos as File[]) ?? [])[0];
    if (!f) return;
    await this.acao(
      async () => enviar('POST', '/estudio/marca/arquivos', { tipo, upload_id: await this.vida.esperar(subirArquivo('marca_arquivos', 'arquivo', f)) }),
      tipo === 'logo' ? 'Logo salvo.' : 'Foto salva.',
    );
  }

  /** Referências somam (até o limite), uma por arquivo escolhido. */
  private async enviarReferencias(e: CustomEvent) {
    const livres = MAX_REFERENCIAS - (this.marca?.referencias.length ?? 0);
    const arquivos = ((e.detail.arquivos as File[]) ?? []).slice(0, Math.max(livres, 0));
    if (!this.vida.vivo()) return;
    if (!arquivos.length) {
      if (livres <= 0) await urbiVerso.alertar({ titulo: 'Limite de referências', mensagem: `Até ${MAX_REFERENCIAS}. Tire uma antes de enviar outra.`, tipo: 'alerta' });
      return;
    }
    // Cada passo do laço confere a conta: trocada no meio, nenhum envio mais sai (com o `X-Conta` da nova).
    await this.acao(async () => {
      let r: Marca = this.marca!;
      for (const f of arquivos) {
        const upload_id = await this.vida.esperar(subirArquivo('marca_arquivos', 'arquivo', f));
        r = await this.vida.esperar(enviar('POST', '/estudio/marca/arquivos', { tipo: 'referencia', upload_id }));
      }
      return r;
    }, arquivos.length > 1 ? 'Referências salvas.' : 'Referência salva.');
    if (this.vida.vivo()) this.seletorRefs++;
  }

  private tirarReferencia(id: number) {
    return this.semAvisoDeOutraConta(async () => {
      const ok = await this.vida.esperar(urbiVerso.confirmar({ titulo: 'Tirar referência', mensagem: 'A imagem sai das suas referências.', rotuloConfirmar: 'Tirar', perigo: true }));
      if (ok) await this.acao(() => enviar('PATCH', `/estudio/marca/arquivos/${id}/remover`), 'Referência tirada.');
    });
  }

  render() {
    if (this.falha) {
      return html`<urbi-banner variante="erro">${this.falha}<urbi-botao slot="acao" variante="secundario" @click=${() => this.carregar()}>Tentar de novo</urbi-botao></urbi-banner>`;
    }
    if (!this.marca || !this.rascunho) return html`<urbi-loading></urbi-loading>`;
    const m = this.marca;
    const r = this.rascunho;
    const aviso = this.desatualizada
      ? html`<urbi-banner variante="alerta">A marca foi salva, mas a sua página, as seleções ou o portal do cliente ainda mostram a marca anterior.<urbi-botao slot="acao" variante="secundario" icone="fa-solid fa-rotate" ?carregando=${this.refazendo} @click=${() => this.refazer()}>Atualizar o que está no ar</urbi-botao></urbi-banner>`
      : '';
    return html`${aviso}<urbi-card titulo="Sua marca" icone="fa-solid fa-palette">
      <urbi-stack>
        <urbi-prosa papel="secundario">Usada nas artes do Estúdio, na sua página, nas seleções e no portal do cliente.</urbi-prosa>
        <urbi-grid min="220px">
          <urbi-stack>
            <urbi-linha alinhar="centro">
              <urbi-avatar nome="Logo" foto=${m.logo_url ?? ''} icone=${m.logo_url ? '' : 'fa-solid fa-image'} tamanho="56"></urbi-avatar>
              <urbi-prosa papel="fraco">${m.logo_url ? 'Logo atual' : 'Sem logo'}</urbi-prosa>
            </urbi-linha>
            <urbi-seletor-arquivo label="Logo" texto=${m.logo_url ? 'Trocar o logo' : 'Enviar o logo'} icone="fa-solid fa-image" accept="image/png,image/jpeg,image/webp"
              @urbi:seletor-arquivo-change=${(e: CustomEvent) => this.enviarArquivo('logo', e)}></urbi-seletor-arquivo>
            <urbi-prosa papel="dica">PNG com fundo transparente fica melhor.</urbi-prosa>
          </urbi-stack>
          <urbi-stack>
            <urbi-linha alinhar="centro">
              <urbi-avatar nome="Sua foto" foto=${m.foto_url ?? ''} icone=${m.foto_url ? '' : 'fa-solid fa-user'} tamanho="56"></urbi-avatar>
              <urbi-prosa papel="fraco">${m.foto_url ? 'Sua foto atual' : 'Sem foto'}</urbi-prosa>
            </urbi-linha>
            <urbi-seletor-arquivo label="Sua foto (opcional)" texto=${m.foto_url ? 'Trocar a foto' : 'Enviar a foto'} icone="fa-solid fa-user" accept="image/png,image/jpeg,image/webp"
              @urbi:seletor-arquivo-change=${(e: CustomEvent) => this.enviarArquivo('foto', e)}></urbi-seletor-arquivo>
            <urbi-prosa papel="dica">Aparece na sua página e no portal do cliente.</urbi-prosa>
          </urbi-stack>
        </urbi-grid>
        <urbi-grid min="160px">
          <urbi-input label="Cor principal" tipo="color" valor=${r.cor_primaria} @urbi:input-change=${(e: CustomEvent) => this.mudar('cor_primaria', String(e.detail.valor))}></urbi-input>
          <urbi-input label="Cor de apoio" tipo="color" valor=${r.cor_secundaria} @urbi:input-change=${(e: CustomEvent) => this.mudar('cor_secundaria', String(e.detail.valor))}></urbi-input>
          <urbi-select label="Estilo das artes" valor=${r.estilo} .opcoes=${ESTILOS} @urbi:select-change=${(e: CustomEvent) => this.mudar('estilo', String(e.detail.valor))}></urbi-select>
        </urbi-grid>
        <urbi-prosa papel="fraco">Cor principal ${r.cor_primaria.toUpperCase()} · cor de apoio ${r.cor_secundaria.toUpperCase()}</urbi-prosa>
        <urbi-input label="Assinatura curta (opcional)" valor=${r.assinatura} placeholder="Ex.: Seu corretor no Lago Sul"
          @urbi:input-change=${(e: CustomEvent) => this.mudar('assinatura', String(e.detail.valor ?? ''))}></urbi-input>
        <urbi-prosa papel="secao">Tom de voz (artes do Estúdio)</urbi-prosa>
        <urbi-grid min="180px">
          ${escolhaUnica(OPCOES_TOM_VOZ, r.tom_voz, (id) => this.mudar('tom_voz', id), { selo: 'escolhido', nome: 'Tom de voz (artes do Estúdio)' })}
        </urbi-grid>
        <urbi-prosa papel="dica">Esta marca vale em todo lugar. A cor principal e a sua foto aparecem para o cliente; salvar já atualiza o que está no ar e, se não conseguir, avisa aqui. Logo e foto são salvos ao escolher o arquivo.</urbi-prosa>
        <urbi-linha justificar="fim">
          <urbi-botao icone="fa-solid fa-check" ?carregando=${this.salvando} @click=${() => void this.salvar()}>Salvar marca</urbi-botao>
        </urbi-linha>
      </urbi-stack>
    </urbi-card>
    <urbi-card titulo="Referências" icone="fa-solid fa-images">
      ${m.referencias.length
        ? html`<urbi-linha quebrar>
            ${m.referencias.map(
              (ref, i) => html`<urbi-linha>
                <urbi-avatar nome=${`Referência ${i + 1}`} foto=${ref.url} tamanho="56"></urbi-avatar>
                <urbi-botao variante="fantasma" icone="fa-solid fa-trash" ariaLabel=${`Tirar a referência ${i + 1}`} title="Tirar" @click=${() => this.tirarReferencia(ref.id)}></urbi-botao>
              </urbi-linha>`,
            )}
          </urbi-linha>`
        : ''}
      ${m.referencias.length < MAX_REFERENCIAS
        ? keyed(this.seletorRefs, html`<urbi-seletor-arquivo label="Referências" accept="image/png,image/jpeg,image/webp" multiplo dica=${`Posts ou artes que você admira (até ${MAX_REFERENCIAS})`} @urbi:seletor-arquivo-change=${(e: CustomEvent) => this.enviarReferencias(e)}></urbi-seletor-arquivo>`)
        : ''}
      <urbi-prosa papel="dica">Só você vê. No Estúdio, "Fazer em outra ferramenta" pergunta quais referências entram na instrução, como inspiração de estilo.</urbi-prosa>
    </urbi-card>`;
  }
}
