import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { keyed } from 'lit/directives/keyed.js';
import type { UrbiVersoAPI } from '@urbiverso/sdk';
import { MAX_REFERENCIAS } from '../../comum/estudio';
import { chamarApi, enviar, gesto, mensagemDeErro, subirArquivo } from '../apoio';

declare const urbiVerso: UrbiVersoAPI;

interface Marca {
  cor_primaria: string;
  cor_secundaria: string;
  estilo: string;
  assinatura: string | null;
  logo_url: string | null;
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

// Ajustes › Conta e marca (D-81, D-85): logo, foto, cores, estilo e assinatura. A marca é única: o Estúdio a
// usa nas artes, e a cor principal e a foto valem na página pública, nas seleções e no portal.
// Mesmas rotas de antes (`/estudio/marca`); só o lugar na tela mudou.
@customElement('pc-tela-marca')
export class PcTelaMarca extends LitElement {
  @state() private marca: Marca | null = null;
  @state() private falha: string | null = null;
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

  private editar() {
    return this.semAvisoDeOutraConta(() => this.editarNaConta());
  }

  private async editarNaConta() {
    const m = this.marca!;
    const v = await this.vida.esperar(urbiVerso.formulario({
      titulo: 'Sua marca',
      campos: [
        { nome: 'cor_primaria', tipo: 'texto', rotulo: 'Cor principal (#RRGGBB)', obrigatorio: true, valor: m.cor_primaria },
        { nome: 'cor_secundaria', tipo: 'texto', rotulo: 'Cor de apoio (#RRGGBB)', obrigatorio: true, valor: m.cor_secundaria },
        { nome: 'estilo', tipo: 'selecao', rotulo: 'Estilo', opcoes: ESTILOS, valor: m.estilo },
        { nome: 'assinatura', tipo: 'texto', rotulo: 'Assinatura curta (opcional)', valor: m.assinatura ?? '', placeholder: 'Ex.: Seu corretor no Lago Sul' },
      ],
    }));
    if (v) await this.acao(() => enviar('PUT', '/estudio/marca', v), 'Marca salva.');
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
      return html`<urbi-banner variante="erro">${this.falha}<urbi-botao slot="acao" pequeno variante="secundario" @click=${() => this.carregar()}>Tentar de novo</urbi-botao></urbi-banner>`;
    }
    if (!this.marca) return html`<urbi-loading></urbi-loading>`;
    const m = this.marca;
    const aviso = this.desatualizada
      ? html`<urbi-banner variante="alerta">A marca foi salva, mas a sua página, as seleções ou o portal do cliente ainda mostram a marca anterior.<urbi-botao slot="acao" pequeno variante="secundario" icone="fa-solid fa-rotate" ?carregando=${this.refazendo} @click=${() => this.refazer()}>Atualizar o que está no ar</urbi-botao></urbi-banner>`
      : '';
    return html`${aviso}<urbi-card titulo="Sua marca" icone="fa-solid fa-palette">
      <span slot="acoes"><urbi-botao variante="fantasma" pequeno icone="fa-solid fa-pen" ariaLabel="Editar a marca" title="Editar" @click=${() => this.editar()}></urbi-botao></span>
      <urbi-linha quebrar>
        <urbi-avatar nome="Logo" foto=${m.logo_url ?? ''} icone=${m.logo_url ? '' : 'fa-solid fa-image'} tamanho="56"></urbi-avatar>
        <urbi-prosa papel="secundario">Cores ${m.cor_primaria} e ${m.cor_secundaria} · estilo ${ESTILOS.find((e) => e.valor === m.estilo)?.rotulo ?? m.estilo}${m.assinatura ? ` · "${m.assinatura}"` : ''}</urbi-prosa>
      </urbi-linha>
      <urbi-linha quebrar>
        <urbi-seletor-arquivo accept="image/png,image/jpeg,image/webp" dica="Logo (PNG com fundo transparente fica melhor)" @urbi:seletor-arquivo-change=${(e: CustomEvent) => this.enviarArquivo('logo', e)}></urbi-seletor-arquivo>
        <urbi-seletor-arquivo accept="image/png,image/jpeg,image/webp" dica="Sua foto (opcional)" @urbi:seletor-arquivo-change=${(e: CustomEvent) => this.enviarArquivo('foto', e)}></urbi-seletor-arquivo>
      </urbi-linha>
      <urbi-prosa papel="dica">Esta marca vale em todo lugar: nas artes do Estúdio, na sua página, nas seleções e no portal do cliente. A cor principal e a sua foto aparecem para o cliente; salvar já atualiza o que está no ar e, se não conseguir, avisa aqui.</urbi-prosa>
    </urbi-card>
    <urbi-card titulo="Referências" icone="fa-solid fa-images">
      ${m.referencias.length
        ? html`<urbi-linha quebrar>
            ${m.referencias.map(
              (r, i) => html`<urbi-linha>
                <urbi-avatar nome=${`Referência ${i + 1}`} foto=${r.url} tamanho="56"></urbi-avatar>
                <urbi-botao variante="fantasma" pequeno icone="fa-solid fa-trash" ariaLabel=${`Tirar a referência ${i + 1}`} title="Tirar" @click=${() => this.tirarReferencia(r.id)}></urbi-botao>
              </urbi-linha>`,
            )}
          </urbi-linha>`
        : ''}
      ${m.referencias.length < MAX_REFERENCIAS
        ? keyed(this.seletorRefs, html`<urbi-seletor-arquivo accept="image/png,image/jpeg,image/webp" multiplo dica=${`Posts ou artes que você admira (até ${MAX_REFERENCIAS})`} @urbi:seletor-arquivo-change=${(e: CustomEvent) => this.enviarReferencias(e)}></urbi-seletor-arquivo>`)
        : ''}
      <urbi-prosa papel="dica">Só você vê. No Estúdio, "Fazer em outra ferramenta" pergunta quais referências entram na instrução, como inspiração de estilo.</urbi-prosa>
    </urbi-card>`;
  }
}
