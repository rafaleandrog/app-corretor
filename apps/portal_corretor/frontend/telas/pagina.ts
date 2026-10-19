import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { CampoFormulario, UrbiVersoAPI } from '@urbiverso/sdk';
import { ROTULO_BLOCO, type Bloco } from '../../comum/pagina';
import { dataHora, enviar, mensagemDeErro } from '../apoio';

declare const urbiVerso: UrbiVersoAPI;

interface Visao {
  pagina: { endereco: string; nome_exibicao: string; tema: string; blocos: Bloco[]; publicada_em: string | null; gerada_por_ia: boolean };
  salva: boolean;
  url: string;
  temas: { valor: string; rotulo: string; cor: string }[];
  marcados_para_pagina: number;
}

// Minha Página: montar por blocos, escolher endereço e cor, publicar. Depois de publicada, a página
// pública abre numa aba para conferir (exceção de UI declarada na spec 11.5); antes, não há prévia.
// Uma gravação por vez: cliques seguidos em subir/descer não se sobrepõem.
@customElement('pc-tela-pagina')
export class PcTelaPagina extends LitElement {
  @state() private visao: Visao | null = null;
  @state() private falha: string | null = null;
  @state() private ocupado = false;

  connectedCallback() {
    super.connectedCallback();
    void this.carregar();
  }

  private async carregar() {
    this.falha = null;
    try {
      this.visao = await urbiVerso.api('/pagina');
    } catch (e) {
      this.falha = (e as Error).message;
    }
  }

  /** URL completa: sem URL pública configurada na instância, a rota volta relativa. */
  private get urlCompleta() {
    const u = this.visao?.url ?? '';
    return u.startsWith('/') ? `${window.location.origin}${u}` : u;
  }

  @state() private salvando = false;

  private async salvar(mudancas: Partial<Visao['pagina']>, extra: Record<string, unknown> = {}) {
    if (this.salvando) return false;
    const p = { ...this.visao!.pagina, ...mudancas };
    this.salvando = true;
    try {
      this.visao = await enviar('PUT', '/pagina', { endereco: p.endereco, nome_exibicao: p.nome_exibicao, tema: p.tema, blocos: p.blocos, ...extra });
      urbiVerso.notificar('Salvo.', 'sucesso');
      return true;
    } catch (e) {
      await urbiVerso.alertar({ titulo: 'Não foi possível salvar', mensagem: mensagemDeErro(e), tipo: 'erro' });
      return false;
    } finally {
      this.salvando = false;
    }
  }

  private async aparencia() {
    const p = this.visao!.pagina;
    const v = await urbiVerso.formulario({
      titulo: 'Endereço e aparência',
      campos: [
        { nome: 'nome_exibicao', tipo: 'texto', rotulo: 'Nome que aparece na página', obrigatorio: true, valor: p.nome_exibicao },
        { nome: 'endereco', tipo: 'texto', rotulo: 'Endereço (letras minúsculas, números e hífen)', obrigatorio: true, valor: p.endereco },
        { nome: 'tema', tipo: 'selecao', rotulo: 'Cor da página', opcoes: this.visao!.temas.map((t) => ({ valor: t.valor, rotulo: t.rotulo })), valor: p.tema },
      ],
    });
    if (v) await this.salvar({ nome_exibicao: String(v.nome_exibicao), endereco: String(v.endereco).trim().toLowerCase(), tema: String(v.tema) });
  }

  private async mover(i: number, passo: number) {
    const blocos = [...this.visao!.pagina.blocos];
    const j = i + passo;
    if (j < 0 || j >= blocos.length) return;
    [blocos[i], blocos[j]] = [blocos[j], blocos[i]];
    await this.salvar({ blocos });
  }

  private async alternar(i: number) {
    const blocos = this.visao!.pagina.blocos.map((b, k) => (k === i ? { ...b, ativo: !b.ativo } : b));
    await this.salvar({ blocos });
  }

  private async camposDestaques(b: Bloco): Promise<CampoFormulario[]> {
    const r = await urbiVerso.api('/imoveis?publicado_pagina=true&por_pagina=50');
    const lista = (r.dados ?? []).filter((i: any) => i.publicado_pagina);
    if (!lista.length) return [];
    return lista.map((i: any) => ({ nome: `im_${i.codigo}`, tipo: 'booleano', rotulo: `${i.codigo} · ${i.titulo ?? i.tipo}`, valor: (b.codigos ?? []).includes(i.codigo) }));
  }

  private async editar(i: number) {
    const b = this.visao!.pagina.blocos[i];
    const campos: CampoFormulario[] = [];
    if (b.tipo !== 'contato') campos.push({ nome: 'titulo', tipo: 'texto', rotulo: 'Título do bloco', valor: b.titulo ?? '' });
    if (b.tipo === 'apresentacao' || b.tipo === 'sobre') campos.push({ nome: 'texto', tipo: 'texto_longo', rotulo: 'Texto', valor: b.texto ?? '' });
    if (b.tipo === 'bairros') campos.push({ nome: 'lista', tipo: 'texto_longo', rotulo: 'Um bairro ou região por linha', valor: (b.lista ?? []).join('\n') });
    if (b.tipo === 'contato') {
      campos.push({ nome: 'whatsapp', tipo: 'booleano', rotulo: 'Mostrar botão do WhatsApp', valor: b.whatsapp !== false });
      campos.push({ nome: 'instagram', tipo: 'texto', rotulo: 'Instagram (só o usuário)', valor: b.instagram ?? '', placeholder: 'seu.usuario' });
    }
    let mensagem: string | undefined;
    if (b.tipo === 'destaques') {
      const opcoes = await this.camposDestaques(b);
      if (!opcoes.length) mensagem = 'Marque imóveis para a página (na ficha do imóvel) para escolher os destaques.';
      else mensagem = 'Escolha até 6 imóveis (além disso, valem os 6 primeiros). Só aparecem os que estiverem publicados.';
      campos.push(...opcoes);
    }
    if (b.tipo === 'imoveis') mensagem = 'Mostra todos os imóveis marcados para a página, anunciados e com autorização vigente.';
    if (b.tipo === 'formulario') mensagem = 'O contato chega em Clientes, com negócio novo no funil e o consentimento registrado.';
    const v = await urbiVerso.formulario({ titulo: ROTULO_BLOCO[b.tipo], campos, mensagem });
    if (!v) return;
    const novo: Bloco = { ...b };
    if ('titulo' in v) novo.titulo = String(v.titulo ?? '');
    if ('texto' in v) novo.texto = String(v.texto ?? '');
    if ('lista' in v) novo.lista = String(v.lista ?? '').split('\n').map((s) => s.trim()).filter(Boolean);
    if ('whatsapp' in v) novo.whatsapp = v.whatsapp === true;
    if ('instagram' in v) novo.instagram = String(v.instagram ?? '');
    if (b.tipo === 'destaques') novo.codigos = Object.entries(v).filter(([k, x]) => k.startsWith('im_') && x === true).map(([k]) => k.slice(3)).slice(0, 6);
    const blocos = this.visao!.pagina.blocos.map((x, k) => (k === i ? novo : x));
    await this.salvar({ blocos });
  }

  private async sugerirTextos() {
    const v = await urbiVerso.formulario({
      titulo: 'Escrever com IA',
      mensagem: 'A IA escreve a apresentação e o "sobre mim" com o que você contar aqui e com os imóveis da página. Você revisa antes de usar.',
      campos: [{ nome: 'observacoes', tipo: 'texto_longo', rotulo: 'Conte um pouco sobre você (opcional)', placeholder: 'Ex.: atendo famílias que buscam casa no Lago Sul há 8 anos.' }],
      rotuloConfirmar: 'Escrever',
    });
    if (!v) return;
    this.ocupado = true;
    try {
      const r = await enviar('POST', '/pagina/sugerir-textos', { observacoes: v.observacoes, nome_exibicao: this.visao!.pagina.nome_exibicao });
      const ok = await urbiVerso.confirmar({
        titulo: 'Usar estes textos?',
        mensagem: `Apresentação:\n${r.apresentacao}\n\nSobre mim:\n${r.sobre}`,
        rotuloConfirmar: 'Usar e ligar os blocos',
      });
      if (!ok) return;
      const blocos = this.visao!.pagina.blocos.map((b) =>
        b.tipo === 'apresentacao' ? { ...b, texto: r.apresentacao, ativo: true } : b.tipo === 'sobre' ? { ...b, texto: r.sobre, ativo: true } : b,
      );
      await this.salvar({ blocos }, { gerada_por_ia: true });
    } catch (e) {
      await urbiVerso.alertar({ titulo: 'Não foi possível escrever agora', mensagem: mensagemDeErro(e), tipo: 'alerta' });
    } finally {
      this.ocupado = false;
    }
  }

  private async acao(rota: string, sucesso: string) {
    this.ocupado = true;
    try {
      const r = await enviar('POST', rota);
      urbiVerso.notificar(sucesso + (typeof r?.imoveis_publicados === 'number' ? ` ${r.imoveis_publicados} imóvel(is) na página.` : ''), 'sucesso');
      await this.carregar();
    } catch (e) {
      await urbiVerso.alertar({ titulo: 'Não foi possível concluir', mensagem: mensagemDeErro(e), tipo: 'erro' });
    } finally {
      this.ocupado = false;
    }
  }

  private async despublicar() {
    const ok = await urbiVerso.confirmar({ titulo: 'Tirar a página do ar', mensagem: 'A página e as fichas públicas deixam de abrir. Você pode publicar de novo quando quiser.', rotuloConfirmar: 'Tirar do ar', perigo: true });
    if (ok) await this.acao('/pagina/despublicar', 'Página fora do ar.');
  }

  private async copiar() {
    try {
      await navigator.clipboard.writeText(this.urlCompleta);
      urbiVerso.notificar('Link copiado.', 'sucesso');
    } catch {
      await urbiVerso.alertar({ titulo: 'Link da sua página', mensagem: this.urlCompleta });
    }
  }

  private bloco(b: Bloco, i: number, total: number) {
    return html`<urbi-linha quebrar>
      <urbi-prosa>${i + 1}. ${ROTULO_BLOCO[b.tipo]}</urbi-prosa>
      <urbi-badge cor=${b.ativo ? 'sucesso' : 'padrao'}>${b.ativo ? 'aparece' : 'oculto'}</urbi-badge>
      <urbi-botao variante="fantasma" pequeno icone="fa-solid fa-arrow-up" ariaLabel="Subir" title="Subir" ?desabilitado=${i === 0 || this.salvando} @click=${() => this.mover(i, -1)}></urbi-botao>
      <urbi-botao variante="fantasma" pequeno icone="fa-solid fa-arrow-down" ariaLabel="Descer" title="Descer" ?desabilitado=${i === total - 1 || this.salvando} @click=${() => this.mover(i, 1)}></urbi-botao>
      <urbi-botao variante="fantasma" pequeno icone=${b.ativo ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'} ariaLabel=${b.ativo ? 'Ocultar' : 'Mostrar'} title=${b.ativo ? 'Ocultar' : 'Mostrar'} ?desabilitado=${this.salvando} @click=${() => this.alternar(i)}></urbi-botao>
      <urbi-botao variante="fantasma" pequeno icone="fa-solid fa-pen" ariaLabel="Editar" title="Editar" @click=${() => this.editar(i)}></urbi-botao>
    </urbi-linha>`;
  }

  render() {
    if (this.falha) {
      return html`<urbi-banner variante="erro">
        ${this.falha}
        <urbi-botao slot="acao" pequeno variante="secundario" @click=${() => this.carregar()}>Tentar de novo</urbi-botao>
      </urbi-banner>`;
    }
    if (!this.visao) return html`<urbi-loading></urbi-loading>`;
    const { pagina: p, salva, temas, marcados_para_pagina } = this.visao;
    const tema = temas.find((t) => t.valor === p.tema);
    const noAr = !!p.publicada_em;
    return html`<urbi-stack>
      ${!salva ? html`<urbi-banner variante="info">Esta é uma sugestão de página. Ajuste o que quiser: ela é salva na primeira mudança. Depois de publicar, "Abrir minha página" mostra como ficou.</urbi-banner>` : ''}
      ${marcados_para_pagina === 0
        ? html`<urbi-banner variante="alerta">Nenhum imóvel marcado para a página. Na ficha do imóvel, ligue "Aparece na minha página" (precisa estar anunciado e com autorização vigente).</urbi-banner>`
        : ''}
      <urbi-card titulo="Situação" icone="fa-solid fa-globe">
        <urbi-linha quebrar>
          <urbi-badge cor=${noAr ? 'sucesso' : 'padrao'}>${noAr ? `No ar desde ${dataHora(p.publicada_em)}` : 'Fora do ar'}</urbi-badge>
          <urbi-prosa papel="secundario">${this.urlCompleta}</urbi-prosa>
        </urbi-linha>
        <urbi-linha quebrar>
          ${noAr
            ? html`<urbi-botao pequeno icone="fa-solid fa-arrow-up-right-from-square" @click=${() => window.open(this.urlCompleta, '_blank', 'noopener')}>Abrir minha página</urbi-botao>
                <urbi-botao pequeno variante="secundario" icone="fa-solid fa-copy" @click=${() => this.copiar()}>Copiar link</urbi-botao>
                <urbi-botao pequeno variante="secundario" icone="fa-solid fa-rotate" ?carregando=${this.ocupado} @click=${() => this.acao('/pagina/atualizar', 'Página atualizada.')}>Atualizar agora</urbi-botao>
                <urbi-botao pequeno variante="fantasma" @click=${() => this.despublicar()}>Tirar do ar</urbi-botao>`
            : html`<urbi-botao pequeno icone="fa-solid fa-rocket" ?carregando=${this.ocupado} ?desabilitado=${!salva} @click=${() => this.acao('/pagina/publicar', 'Página publicada.')}>Publicar</urbi-botao>
                ${!salva ? html`<urbi-prosa papel="dica">Salve uma mudança antes de publicar.</urbi-prosa>` : ''}`}
        </urbi-linha>
      </urbi-card>
      <urbi-card titulo="Endereço e aparência" icone="fa-solid fa-palette">
        <span slot="acoes"><urbi-botao variante="fantasma" pequeno icone="fa-solid fa-pen" ariaLabel="Editar endereço e aparência" title="Editar" @click=${() => this.aparencia()}></urbi-botao></span>
        <urbi-prosa>${p.nome_exibicao}</urbi-prosa>
        <urbi-prosa papel="secundario">Endereço: ${p.endereco} · Cor: ${tema?.rotulo ?? p.tema}</urbi-prosa>
      </urbi-card>
      <urbi-card titulo="Blocos da página" icone="fa-solid fa-table-cells-large">
        <span slot="acoes"><urbi-botao variante="secundario" pequeno icone="fa-solid fa-wand-magic-sparkles" ?carregando=${this.ocupado} @click=${() => this.sugerirTextos()}>Escrever com IA</urbi-botao></span>
        <urbi-prosa papel="dica">Os blocos aparecem nesta ordem. Oculte o que não quiser mostrar.</urbi-prosa>
        ${p.blocos.map((b, i) => this.bloco(b, i, p.blocos.length))}
      </urbi-card>
    </urbi-stack>`;
  }
}
