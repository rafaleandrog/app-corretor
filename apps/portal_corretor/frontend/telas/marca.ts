import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { UrbiVersoAPI } from '@urbiverso/sdk';
import { chamarApi, enviar, mensagemDeErro, subirArquivo } from '../apoio';

declare const urbiVerso: UrbiVersoAPI;

interface Marca {
  cor_primaria: string;
  cor_secundaria: string;
  estilo: string;
  assinatura: string | null;
  logo_url: string | null;
}

const ESTILOS = [
  { valor: 'moderno', rotulo: 'Moderno' },
  { valor: 'classico', rotulo: 'Clássico' },
  { valor: 'minimalista', rotulo: 'Minimalista' },
];

// Ajustes › Marca (D-81, D-85): logo, foto, cores, estilo e assinatura. A marca é única: o Estúdio a
// usa nas artes, e a cor principal e a foto valem na página pública, nas seleções e no portal.
// Mesmas rotas de antes (`/estudio/marca`); só o lugar na tela mudou.
@customElement('pc-tela-marca')
export class PcTelaMarca extends LitElement {
  @state() private marca: Marca | null = null;
  @state() private falha: string | null = null;

  connectedCallback() {
    super.connectedCallback();
    void this.carregar();
  }

  private async carregar() {
    this.falha = null;
    try {
      this.marca = await chamarApi('/estudio/marca');
    } catch (e) {
      this.falha = (e as Error).message;
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

  private async editar() {
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

  private async enviarArquivo(tipo: 'logo' | 'foto', e: CustomEvent) {
    const f = ((e.detail.arquivos as File[]) ?? [])[0];
    if (!f) return;
    await this.acao(async () => enviar('POST', '/estudio/marca/arquivos', { tipo, upload_id: await subirArquivo('marca_arquivos', 'arquivo', f) }), tipo === 'logo' ? 'Logo salvo.' : 'Foto salva.');
  }

  render() {
    if (this.falha) {
      return html`<urbi-banner variante="erro">${this.falha}<urbi-botao slot="acao" pequeno variante="secundario" @click=${() => this.carregar()}>Tentar de novo</urbi-botao></urbi-banner>`;
    }
    if (!this.marca) return html`<urbi-loading></urbi-loading>`;
    const m = this.marca;
    return html`<urbi-card titulo="Sua marca" icone="fa-solid fa-palette">
      <span slot="acoes"><urbi-botao variante="fantasma" pequeno icone="fa-solid fa-pen" ariaLabel="Editar a marca" title="Editar" @click=${() => this.editar()}></urbi-botao></span>
      <urbi-linha quebrar>
        <urbi-avatar nome="Logo" foto=${m.logo_url ?? ''} icone=${m.logo_url ? '' : 'fa-solid fa-image'} tamanho="56"></urbi-avatar>
        <urbi-prosa papel="secundario">Cores ${m.cor_primaria} e ${m.cor_secundaria} · estilo ${ESTILOS.find((e) => e.valor === m.estilo)?.rotulo ?? m.estilo}${m.assinatura ? ` · "${m.assinatura}"` : ''}</urbi-prosa>
      </urbi-linha>
      <urbi-linha quebrar>
        <urbi-seletor-arquivo accept="image/png,image/jpeg,image/webp" dica="Logo (PNG com fundo transparente fica melhor)" @urbi:seletor-arquivo-change=${(e: CustomEvent) => this.enviarArquivo('logo', e)}></urbi-seletor-arquivo>
        <urbi-seletor-arquivo accept="image/png,image/jpeg,image/webp" dica="Sua foto (opcional)" @urbi:seletor-arquivo-change=${(e: CustomEvent) => this.enviarArquivo('foto', e)}></urbi-seletor-arquivo>
      </urbi-linha>
      <urbi-prosa papel="dica">Esta marca vale em todo lugar: nas artes do Estúdio, na sua página, nas seleções e no portal do cliente. A cor principal e a sua foto aparecem para o cliente; salvar já atualiza o que está no ar.</urbi-prosa>
    </urbi-card>`;
  }
}
