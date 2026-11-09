import { html, nothing } from 'lit';
import type { UrbiVersoAPI } from '@urbiverso/sdk';
import { ROTULO_BLOCO, type Bloco } from '../../comum/pagina';
import { acoesComMais, avisoCreci, chamarApi, contaDeTrabalho, dataHora, ehContaTrocada, enviar, gesto, itemDaUrl, itemNaUrl, mensagemDeErro, noGesto, type Gesto } from '../apoio';
import { estadoDaFalha, estadoTela } from '../estados.js';
import { cabecalhoColuna, moldura } from '../moldura.js';
import type { PreviaPagina } from '../publico/pagina-publica.js';
import { abrirAssistente } from './assistente.js';

declare const urbiVerso: UrbiVersoAPI;

interface Visao {
  pagina: { endereco: string; nome_exibicao: string; blocos: Bloco[]; publicada_em: string | null; gerada_por_ia: boolean };
  salva: boolean;
  url: string;
  marcados_para_pagina: number;
  /** Conta sem CRECI: só o aviso discreto no editor (D-93); a página publica sem ele. */
  sem_creci?: boolean;
  /** Contatos que chegaram pela página nos últimos 30 dias; visitas ainda sem medição (`null`). */
  numeros?: { contatos_30d: number; visitas_30d: number | null };
}

// Página (P09, spec 11.1) na moldura do Padrão B:
// - esquerda: endereço e estado com [Publicar], os blocos na ordem (selecionado destacado, Mostrar,
//   subir e descer) e [Refazer a página com IA];
// - centro: Celular | Computador e a prévia — a própria página pública (`pc-pagina-publica`, CSS
//   próprio, spec 11.3) com os dados de `GET /pagina/previa` e o bloco selecionado contornado;
// - direita: ajustes do bloco selecionado, a marca (de Ajustes › Conta e marca, D-85), contatos e
//   visitas da página e [Copiar link].
// Os dados vivem no módulo (as três colunas leem o mesmo estado); `aoAbrirPagina` os relê a cada
// entrada e na troca de conta. O bloco selecionado fica em `?item=<tipo>`.
//
// Cada gesto (editar, mover, nome e endereço, publicar, tirar do ar, refazer com IA) roda num `gesto` da
// conta em que começou (apoio.ts): trocada a conta em qualquer await (diálogo aberto, carga dos imóveis,
// envio em voo), ele termina em silêncio, sem gravar, avisar nem mexer em `salvando`/`ocupado`, que a
// troca zera para a conta nova.
//
// Blocos arrastáveis (D-119) pelo `urbi-arvore` (lista de folhas com `arrastavel` e `marcavel`: a
// caixa é o "Mostrar"); as setas Subir e Descer do bloco selecionado ficam abaixo, como alternativa
// acessível (a árvore não move pelo teclado). Ajustes do bloco na própria coluna da direita, com os
// campos do bloco (não em diálogo). Exceção de UI nomeada (spec 11.9): a prévia é a página pública
// dentro do editor, que tem CSS próprio por ser página pública, numa largura de celular
// (`pc-previa-pagina`); `urbi-hospedeiro` e `urbi-moldura` não mostram uma página com estilo próprio
// nem limitam a largura.

const estado = {
  visao: null as Visao | null,
  previa: null as Omit<PreviaPagina, 'destacar'> | null,
  falha: null as unknown,
  carregando: false,
  salvando: false,
  ocupado: false,
  dispositivo: 'celular' as 'celular' | 'computador',
  /** Rascunho dos campos do bloco selecionado (coluna da direita); some ao trocar de bloco ou salvar. */
  rascunho: null as (Partial<Bloco> & { tipo: Bloco['tipo'] }) | null,
  /** Imóveis marcados para a página, para escolher os destaques. */
  publicaveis: null as { codigo: string; titulo: string | null; tipo: string }[] | null,
  conta: null as number | null,
  geracao: 0,
};
let redesenhar: () => void = () => {};

/** Cada entrada em Página (e cada troca de conta) relê a página e a prévia. */
export function aoAbrirPagina() {
  if (estado.conta !== contaDeTrabalho()) {
    estado.visao = null;
    estado.previa = null;
    estado.rascunho = null;
    estado.publicaveis = null;
    // As travas são do gesto da conta anterior, que termina em silêncio e não as solta: a nova começa livre.
    estado.salvando = false;
    estado.ocupado = false;
  }
  estado.conta = contaDeTrabalho();
  void carregar();
}

async function carregar() {
  const geracao = ++estado.geracao;
  estado.falha = null;
  estado.carregando = true;
  redesenhar();
  try {
    const visao = await chamarApi('/pagina');
    if (geracao !== estado.geracao) return;
    estado.visao = visao;
  } catch (e) {
    // Conta trocada com a carga em voo (guarda do envio): nem aviso, nem falha, nem a prévia, que sairia
    // já com o `X-Conta` da conta nova. A conta nova relê tudo na próxima entrada (`aoAbrirPagina`).
    if (ehContaTrocada(e)) return;
    if (geracao === estado.geracao) {
      estado.falha = e;
      // Com a página já carregada, o editor segue com a última leitura; o aviso diz que ela pode estar velha.
      if (estado.visao) urbiVerso.notificar('Não foi possível atualizar a página. Mostrando a última leitura.', 'erro');
    }
  } finally {
    if (geracao === estado.geracao) estado.carregando = false;
  }
  redesenhar();
  await carregarPrevia(geracao);
}

/** A prévia falhando não derruba o editor: o centro mostra o aviso e o resto continua. */
async function carregarPrevia(geracao = estado.geracao) {
  try {
    const r = await chamarApi('/pagina/previa');
    if (geracao === estado.geracao) estado.previa = r;
  } catch {
    if (geracao === estado.geracao) estado.previa = null;
  }
  redesenhar();
}

/** URL completa: sem URL pública configurada na instância, a rota volta relativa. */
function urlCompleta() {
  const u = estado.visao?.url ?? '';
  return u.startsWith('/') ? `${window.location.origin}${u}` : u;
}

function selecionado(): number {
  const blocos = estado.visao?.pagina.blocos ?? [];
  const i = blocos.findIndex((b) => b.tipo === itemDaUrl());
  return i >= 0 ? i : 0;
}

function selecionar(tipo: string) {
  if (estado.rascunho && estado.rascunho.tipo !== tipo) estado.rascunho = null;
  itemNaUrl(tipo);
  redesenhar();
}

/**
 * Grava a página com `mudancas`, no gesto `g` de quem chamou. A conta mudou antes (o gesto já não vive)
 * ou com o PUT em voo: nada é enviado, ou a resposta é descartada, sem aviso e sem tocar em `salvando`.
 */
async function salvar(g: Gesto, mudancas: Partial<Visao['pagina']>, extra: Record<string, unknown> = {}) {
  if (!g.vivo() || !estado.visao) return false;
  if (estado.salvando) {
    urbiVerso.notificar('Aguarde: a mudança anterior ainda está sendo salva.', 'info');
    return false;
  }
  const p = { ...estado.visao.pagina, ...mudancas };
  estado.salvando = true;
  redesenhar();
  try {
    const visao = await g.esperar(enviar('PUT', '/pagina', { endereco: p.endereco, nome_exibicao: p.nome_exibicao, blocos: p.blocos, ...extra }));
    estado.visao = visao;
    urbiVerso.notificar('Salvo.', 'sucesso');
    void carregarPrevia();
    return true;
  } catch (e) {
    if (g.encerrado(e)) return false;
    await urbiVerso.alertar({ titulo: 'Não foi possível salvar', mensagem: mensagemDeErro(e), tipo: 'erro' });
    return false;
  } finally {
    // A trava é desta conta: com a conta trocada, a nova já começou livre e pode estar salvando.
    if (g.vivo()) {
      estado.salvando = false;
      redesenhar();
    }
  }
}

const nomeEEndereco = () => noGesto(async (g) => {
  const p = estado.visao!.pagina;
  const v = await g.esperar(urbiVerso.formulario({
    titulo: 'Nome e endereço',
    campos: [
      { nome: 'nome_exibicao', tipo: 'texto', rotulo: 'Nome que aparece na página', obrigatorio: true, valor: p.nome_exibicao },
      { nome: 'endereco', tipo: 'texto', rotulo: 'Endereço (letras minúsculas, números e hífen)', obrigatorio: true, valor: p.endereco },
    ],
  }));
  if (v) await salvar(g, { nome_exibicao: String(v.nome_exibicao), endereco: String(v.endereco).trim().toLowerCase() });
});

async function mover(i: number, passo: number) {
  const blocos = [...estado.visao!.pagina.blocos];
  const j = i + passo;
  if (j < 0 || j >= blocos.length) return;
  [blocos[i], blocos[j]] = [blocos[j], blocos[i]];
  await salvar(gesto(), { blocos });
}

/** Soltura do arrastar (`urbi:arvore-mover`): os blocos levados vão para antes ou depois do alvo. */
async function moverPara(ids: string[], alvoId: string, posicao: string) {
  const blocos = estado.visao!.pagina.blocos;
  const levados = blocos.filter((b) => ids.includes(b.tipo));
  const resto = blocos.filter((b) => !ids.includes(b.tipo));
  const alvo = resto.findIndex((b) => b.tipo === alvoId);
  if (!levados.length || alvo < 0) return;
  const novo = [...resto.slice(0, posicao === 'antes' ? alvo : alvo + 1), ...levados, ...resto.slice(posicao === 'antes' ? alvo : alvo + 1)];
  if (novo.every((b, k) => b.tipo === blocos[k].tipo)) return;
  await salvar(gesto(), { blocos: novo });
}

async function alternar(i: number, ativo?: boolean) {
  const blocos = estado.visao!.pagina.blocos.map((b, k) => (k === i ? { ...b, ativo: ativo ?? !b.ativo } : b));
  if (blocos[i].ativo === estado.visao!.pagina.blocos[i].ativo) return;
  await salvar(gesto(), { blocos });
}

/** Os imóveis marcados para a página, lidos uma vez por entrada (para os destaques). */
let carregandoPublicaveis = false;
async function carregarPublicaveis() {
  if (estado.publicaveis || carregandoPublicaveis) return;
  carregandoPublicaveis = true;
  // Conta trocada com a leitura em voo: a lista de A não aparece em B (a conta nova lê a dela).
  const conta = estado.conta;
  try {
    const r = await chamarApi('/imoveis?publicado_pagina=true&por_pagina=50');
    if (conta !== estado.conta) return;
    estado.publicaveis = (r.dados ?? []).filter((i: any) => i.publicado_pagina).map((i: any) => ({ codigo: i.codigo, titulo: i.titulo ?? null, tipo: i.tipo }));
  } catch (e) {
    if (ehContaTrocada(e) || conta !== estado.conta) return;
    estado.publicaveis = [];
  } finally {
    carregandoPublicaveis = false;
  }
  redesenhar();
}

/** O bloco como está na tela: o salvo com o rascunho por cima. */
function blocoEditado(b: Bloco): Bloco {
  return estado.rascunho?.tipo === b.tipo ? { ...b, ...estado.rascunho } : b;
}

function mudar(b: Bloco, campos: Partial<Bloco>) {
  estado.rascunho = { ...(estado.rascunho?.tipo === b.tipo ? estado.rascunho : { tipo: b.tipo }), ...campos };
  redesenhar();
}

/** Salva os campos do bloco selecionado (coluna da direita). */
const salvarBloco = (i: number) => noGesto(async (g) => {
  const b = estado.visao!.pagina.blocos[i];
  if (estado.rascunho?.tipo !== b.tipo) return;
  const novo = blocoEditado(b);
  if (novo.tipo === 'destaques') novo.codigos = (novo.codigos ?? []).slice(0, 6);
  const blocos = estado.visao!.pagina.blocos.map((x, k) => (k === i ? novo : x));
  if (await salvar(g, { blocos })) estado.rascunho = null;
  redesenhar();
});

/** [Refazer a página com IA]: a mesma escrita de `POST /pagina/sugerir-textos`; o corretor revisa antes de usar. */
const refazerComIa = () => noGesto(async (g) => {
  const v = await g.esperar(urbiVerso.formulario({
    titulo: 'Refazer a página com IA',
    mensagem: 'A IA escreve a apresentação e o "sobre mim" com o que você contar aqui e com os imóveis da página. Você revisa antes de usar.',
    campos: [{ nome: 'observacoes', tipo: 'texto_longo', rotulo: 'Conte um pouco sobre você (opcional)', placeholder: 'Ex.: atendo famílias que buscam casa no Lago Sul há 8 anos.' }],
    rotuloConfirmar: 'Escrever',
  }));
  if (!v) return;
  estado.ocupado = true;
  redesenhar();
  try {
    // Os textos são da conta em que foram pedidos: com a conta trocada, não se oferecem nem se gravam na outra.
    const r = await g.esperar(enviar('POST', '/pagina/sugerir-textos', { observacoes: v.observacoes, nome_exibicao: estado.visao!.pagina.nome_exibicao }));
    const ok = await g.esperar(urbiVerso.confirmar({
      titulo: 'Usar estes textos?',
      mensagem: `Apresentação:\n${r.apresentacao}\n\nSobre mim:\n${r.sobre}`,
      rotuloConfirmar: 'Usar e ligar os blocos',
    }));
    if (!ok) return;
    const blocos = estado.visao!.pagina.blocos.map((b) =>
      b.tipo === 'apresentacao' ? { ...b, texto: r.apresentacao, ativo: true } : b.tipo === 'sobre' ? { ...b, texto: r.sobre, ativo: true } : b,
    );
    await salvar(g, { blocos }, { gerada_por_ia: true });
  } catch (e) {
    if (g.encerrado(e)) return;
    await urbiVerso.alertar({ titulo: 'Não foi possível escrever agora', mensagem: mensagemDeErro(e), tipo: 'alerta' });
  } finally {
    if (g.vivo()) {
      estado.ocupado = false;
      redesenhar();
    }
  }
});

/** Publicar, atualizar e tirar do ar: um POST e a releitura, no gesto `g` de quem chamou. */
async function acaoNoGesto(g: Gesto, rota: string, sucesso: string) {
  if (!g.vivo()) return;
  estado.ocupado = true;
  redesenhar();
  try {
    const r = await g.esperar(enviar('POST', rota));
    urbiVerso.notificar(sucesso + (typeof r?.imoveis_publicados === 'number' ? ` ${r.imoveis_publicados} imóvel(is) na página.` : ''), 'sucesso');
    await carregar();
  } catch (e) {
    if (g.encerrado(e)) return;
    await urbiVerso.alertar({ titulo: 'Não foi possível concluir', mensagem: mensagemDeErro(e), tipo: 'erro' });
  } finally {
    if (g.vivo()) {
      estado.ocupado = false;
      redesenhar();
    }
  }
}

const acao = (rota: string, sucesso: string) => noGesto((g) => acaoNoGesto(g, rota, sucesso));

/** Confirmado depois de a conta mudar, não tira nada do ar: a confirmação era da página da conta anterior. */
const despublicar = () => noGesto(async (g) => {
  const ok = await g.esperar(urbiVerso.confirmar({ titulo: 'Tirar a página do ar', mensagem: 'A página e as fichas públicas deixam de abrir. Você pode publicar de novo quando quiser.', rotuloConfirmar: 'Tirar do ar', perigo: true }));
  if (ok) await acaoNoGesto(g, '/pagina/despublicar', 'Página fora do ar.');
});

async function copiar() {
  try {
    await navigator.clipboard.writeText(urlCompleta());
    urbiVerso.notificar('Link copiado.', 'sucesso');
  } catch {
    await urbiVerso.alertar({ titulo: 'Link da sua página', mensagem: urlCompleta() });
  }
}

/** O que cada bloco faz, no diálogo e nos ajustes da direita. */
const DICA_BLOCO: Partial<Record<Bloco['tipo'], string>> = {
  apresentacao: 'O primeiro bloco abaixo da capa (foto, nome, CRECI se houver e WhatsApp): o título e o texto de apresentação.',
  imoveis: 'Mostra todos os imóveis marcados para a página, anunciados e com autorização vigente.',
  formulario: 'O contato chega em Clientes, com negócio novo no funil; o consentimento fica como declarado até você confirmar.',
  contato: 'O botão do WhatsApp na capa e o Instagram no fim da página.',
};

// ── Esquerda ──────────────────────────────────────────────────────────────────

const ICONE_BLOCO: Record<Bloco['tipo'], string> = {
  apresentacao: 'fa-solid fa-id-card',
  destaques: 'fa-solid fa-star',
  imoveis: 'fa-solid fa-house',
  sobre: 'fa-solid fa-user',
  bairros: 'fa-solid fa-map-location-dot',
  formulario: 'fa-solid fa-envelope',
  contato: 'fa-brands fa-whatsapp',
};

function colunaBlocos() {
  const v = estado.visao!;
  const p = v.pagina;
  const noAr = !!p.publicada_em;
  const sel = selecionado();
  const atual = p.blocos[sel];
  const nos = p.blocos.map((b) => ({ id: b.tipo, rotulo: `${ROTULO_BLOCO[b.tipo]}${b.ativo ? '' : ' (oculto)'}`, icone: ICONE_BLOCO[b.tipo], marcado: b.ativo ? 'sim' : 'nao', desabilitado: estado.salvando }));
  return html`<urbi-stack>
    ${cabecalhoColuna('Página', noAr
      ? nothing
      : html`<urbi-botao icone="fa-solid fa-rocket" ?carregando=${estado.ocupado} ?desabilitado=${!v.salva}
          @click=${() => void acao('/pagina/publicar', 'Página publicada.')}>Publicar</urbi-botao>`)}
    <urbi-linha>
      <urbi-prosa papel="secundario" truncar expandir title=${urlCompleta()}>${urlCompleta()}</urbi-prosa>
    </urbi-linha>
    <urbi-linha quebrar>
      <urbi-badge cor=${noAr ? 'sucesso' : 'padrao'}>${noAr ? `Publicada desde ${dataHora(p.publicada_em)}` : 'Rascunho'}</urbi-badge>
      <urbi-botao variante="texto" @click=${() => void nomeEEndereco()}>Nome e endereço</urbi-botao>
    </urbi-linha>
    ${!v.salva ? html`<urbi-prosa papel="dica">Esta é uma sugestão de página: ela é salva na primeira mudança, e aí dá para publicar.</urbi-prosa>` : nothing}
    ${v.marcados_para_pagina === 0
      ? html`<urbi-banner variante="alerta">Nenhum imóvel marcado para a página. Na ficha do imóvel, ligue "Aparece na minha página" (precisa estar anunciado e com autorização vigente).</urbi-banner>`
      : nothing}
    <urbi-prosa papel="secao">Blocos</urbi-prosa>
    <urbi-arvore marcavel arrastavel aria-label="Blocos da página" .nos=${nos} .selecionados=${atual ? [atual.tipo] : []}
      @urbi:arvore-selecao=${(e: CustomEvent) => e.detail.ids?.[0] && selecionar(e.detail.ids[0])}
      @urbi:arvore-marcar=${(e: CustomEvent) => void alternar(p.blocos.findIndex((b) => b.tipo === e.detail.id), e.detail.valor === 'sim')}
      @urbi:arvore-mover=${(e: CustomEvent) => void moverPara(e.detail.ids, e.detail.alvoId, e.detail.posicao)}></urbi-arvore>
    <urbi-linha justificar="entre" alinhar="centro">
      <urbi-prosa papel="dica">Arraste para mudar a ordem; a caixa mostra ou oculta o bloco.</urbi-prosa>
      <urbi-linha>
        <urbi-botao variante="fantasma" icone="fa-solid fa-arrow-up" ariaLabel=${`Subir ${atual ? ROTULO_BLOCO[atual.tipo] : 'bloco'}`} title="Subir o bloco selecionado"
          ?desabilitado=${sel === 0 || estado.salvando} @click=${() => void mover(sel, -1)}></urbi-botao>
        <urbi-botao variante="fantasma" icone="fa-solid fa-arrow-down" ariaLabel=${`Descer ${atual ? ROTULO_BLOCO[atual.tipo] : 'bloco'}`} title="Descer o bloco selecionado"
          ?desabilitado=${sel === p.blocos.length - 1 || estado.salvando} @click=${() => void mover(sel, 1)}></urbi-botao>
      </urbi-linha>
    </urbi-linha>
    <urbi-linha>
      <urbi-botao variante="secundario" icone="fa-solid fa-wand-magic-sparkles" ?carregando=${estado.ocupado}
        @click=${() => void refazerComIa()}>Refazer a página com IA</urbi-botao>
    </urbi-linha>
  </urbi-stack>`;
}

// ── Centro ────────────────────────────────────────────────────────────────────

function colunaPrevia() {
  const v = estado.visao!;
  const b = v.pagina.blocos[selecionado()];
  // Par exclusivo: o primitivo inverte o próprio `ligado` ao clique e emite o novo estado; clicar no que
  // já está ligado o apagaria sem mudar a prévia (o lit não reaplica um valor igual). Por isso o `ligado`
  // do botão clicado é reposto à força: ele fica ligado se, e só se, a prévia está nesse modo.
  const dispositivo = (d: 'celular' | 'computador', e: Event) => {
    estado.dispositivo = d;
    (e.currentTarget as HTMLElement & { ligado: boolean }).ligado = true;
    redesenhar();
  };
  return html`<urbi-stack>
    <urbi-linha justificar="entre" quebrar>
      <urbi-prosa papel="secao">Pré-visualização</urbi-prosa>
      <urbi-linha>
        <urbi-botao-alternar icone="fa-solid fa-mobile-screen" .ligado=${estado.dispositivo === 'celular'}
          @urbi:botao-alternar-change=${(e: Event) => dispositivo('celular', e)}>Celular</urbi-botao-alternar>
        <urbi-botao-alternar icone="fa-solid fa-desktop" .ligado=${estado.dispositivo === 'computador'}
          @urbi:botao-alternar-change=${(e: Event) => dispositivo('computador', e)}>Computador</urbi-botao-alternar>
      </urbi-linha>
    </urbi-linha>
    ${b && !b.ativo ? html`<urbi-prosa papel="dica">O bloco ${ROTULO_BLOCO[b.tipo]} está oculto: ligue "Mostrar" para ele aparecer na página.</urbi-prosa>` : nothing}
    ${estado.previa
      ? html`<pc-previa-pagina .previa=${{ ...estado.previa, destacar: b?.tipo ?? null }} .dispositivo=${estado.dispositivo}></pc-previa-pagina>`
      : estado.carregando
        ? estadoTela('carregando', { mensagem: 'Montando a prévia…' })
        : estadoTela('erro', { mensagem: 'Não foi possível montar a prévia agora.', aoTentar: () => void carregarPrevia() })}
  </urbi-stack>`;
}

// ── Direita ───────────────────────────────────────────────────────────────────

/** Os campos do bloco selecionado, na própria coluna (P09, direita). */
function camposDoBloco(i: number) {
  const salvo = estado.visao!.pagina.blocos[i];
  const b = blocoEditado(salvo);
  const sujo = estado.rascunho?.tipo === salvo.tipo;
  if (b.tipo === 'destaques' && !estado.publicaveis) void carregarPublicaveis();
  const escolhidos = b.codigos ?? [];
  return html`<urbi-stack>
    ${DICA_BLOCO[b.tipo] ? html`<urbi-prosa papel="dica">${DICA_BLOCO[b.tipo]}</urbi-prosa>` : nothing}
    ${b.tipo !== 'contato'
      ? html`<urbi-input label="Título do bloco" valor=${b.titulo ?? ''} placeholder=${ROTULO_BLOCO[b.tipo]} @urbi:input-change=${(e: CustomEvent) => mudar(salvo, { titulo: e.detail.valor })}></urbi-input>`
      : nothing}
    ${b.tipo === 'apresentacao' || b.tipo === 'sobre'
      ? html`<urbi-textarea label="Texto" rows="5" valor=${b.texto ?? ''} @urbi:input-change=${(e: CustomEvent) => mudar(salvo, { texto: e.detail.valor })}></urbi-textarea>`
      : nothing}
    ${b.tipo === 'bairros'
      ? html`<urbi-textarea label="Um bairro ou região por linha" rows="5" valor=${(b.lista ?? []).join('\n')}
          @urbi:input-change=${(e: CustomEvent) => mudar(salvo, { lista: String(e.detail.valor ?? '').split('\n').map((x) => x.trim()).filter(Boolean) })}></urbi-textarea>`
      : nothing}
    ${b.tipo === 'contato'
      ? html`<urbi-checkbox label="Mostrar botão do WhatsApp" ?marcado=${b.whatsapp !== false} @urbi:checkbox-change=${() => mudar(salvo, { whatsapp: b.whatsapp === false })}></urbi-checkbox>
          <urbi-input label="Instagram (só o usuário)" valor=${b.instagram ?? ''} placeholder="seu.usuario" @urbi:input-change=${(e: CustomEvent) => mudar(salvo, { instagram: e.detail.valor })}></urbi-input>`
      : nothing}
    ${b.tipo === 'destaques'
      ? !estado.publicaveis
        ? estadoTela('carregando', { mensagem: 'Carregando os imóveis…' })
        : estado.publicaveis.length
          ? html`<urbi-prosa papel="secundario">Escolha até 6 imóveis. Só aparecem os que estiverem publicados.</urbi-prosa>
              ${estado.publicaveis.map(
                (im) => html`<urbi-checkbox label=${`${im.codigo} · ${im.titulo ?? im.tipo}`} ?marcado=${escolhidos.includes(im.codigo)}
                  ?desabilitado=${!escolhidos.includes(im.codigo) && escolhidos.length >= 6}
                  @urbi:checkbox-change=${() => mudar(salvo, { codigos: escolhidos.includes(im.codigo) ? escolhidos.filter((c) => c !== im.codigo) : [...escolhidos, im.codigo] })}></urbi-checkbox>`,
              )}`
          : html`<urbi-prosa papel="dica">Marque imóveis para a página (na ficha do imóvel) para escolher os destaques.</urbi-prosa>`
      : nothing}
    <urbi-linha>
      <urbi-botao icone="fa-solid fa-check" ?desabilitado=${!sujo} ?carregando=${estado.salvando} @click=${() => void salvarBloco(i)}>Salvar bloco</urbi-botao>
      ${sujo ? html`<urbi-botao variante="texto" @click=${() => { estado.rascunho = null; redesenhar(); }}>Descartar</urbi-botao>` : nothing}
    </urbi-linha>
  </urbi-stack>`;
}

function colunaAjustes() {
  const v = estado.visao!;
  const i = selecionado();
  const b = v.pagina.blocos[i];
  const n = v.numeros;
  const noAr = !!v.pagina.publicada_em;
  return html`<urbi-stack>
    ${b
      ? html`<urbi-card titulo=${`Bloco: ${ROTULO_BLOCO[b.tipo]}`} icone="fa-solid fa-sliders">${camposDoBloco(i)}</urbi-card>`
      : nothing}
    <urbi-card titulo="Marca" icone="fa-solid fa-palette">
      <urbi-stack>
        <urbi-linha>
          <urbi-avatar nome=${v.pagina.nome_exibicao} foto=${estado.previa?.pagina.foto_url ?? ''} tamanho="48"></urbi-avatar>
          <urbi-prosa papel="secundario">A página usa a cor, a foto e o nome da sua marca, os mesmos do Estúdio, das seleções e do portal.</urbi-prosa>
        </urbi-linha>
        <urbi-linha><urbi-botao variante="texto" href=${urbiVerso.href('/ajustes?aba=conta')}>Editar em Ajustes › Conta e marca</urbi-botao></urbi-linha>
        ${v.sem_creci ? avisoCreci() : nothing}
      </urbi-stack>
    </urbi-card>
    <urbi-card titulo="Últimos 30 dias" icone="fa-solid fa-chart-simple">
      <urbi-stack>
        <urbi-kpi rotulo="Contatos pelo formulário" .valor=${n?.contatos_30d ?? 0} formato="numero"></urbi-kpi>
        <urbi-kpi rotulo="Visitas à página" .valor=${n?.visitas_30d ?? '—'} formato=${typeof n?.visitas_30d === 'number' ? 'numero' : 'texto'}></urbi-kpi>
        <urbi-prosa papel="fraco">Contatos que chegaram pelo formulário da página. As visitas à página ainda não são medidas.</urbi-prosa>
      </urbi-stack>
    </urbi-card>
    ${noAr
      ? acoesComMais({ rotulo: 'Copiar link', icone: 'fa-solid fa-copy', aoEscolher: () => void copiar() }, [
          { rotulo: 'Abrir minha página', icone: 'fa-solid fa-arrow-up-right-from-square', aoEscolher: () => window.open(urlCompleta(), '_blank', 'noopener') },
          { rotulo: 'Atualizar agora', icone: 'fa-solid fa-rotate', aoEscolher: () => void acao('/pagina/atualizar', 'Página atualizada.') },
          { rotulo: 'Tirar do ar', icone: 'fa-solid fa-power-off', perigo: true, aoEscolher: () => void despublicar() },
        ])
      : html`<urbi-prosa papel="dica">Depois de publicar, aqui ficam Copiar link, Abrir minha página e Atualizar agora.</urbi-prosa>`}
    <urbi-linha><urbi-botao variante="secundario" icone="fa-solid fa-comments" @click=${() => abrirAssistente()}>Perguntar ao Assistente</urbi-botao></urbi-linha>
  </urbi-stack>`;
}

export function renderPagina(atualizar: () => void) {
  redesenhar = atualizar;
  const rotulos = { lista: 'Blocos', centro: 'Prévia', contexto: 'Ajustes' };
  if (!estado.visao) {
    const centro = estado.falha ? estadoDaFalha(estado.falha, () => void carregar()) : estadoTela('carregando', { mensagem: 'Carregando a página…' });
    return moldura({ menu: '/pagina', lista: nothing, centro, contexto: nothing, rotulos }, atualizar);
  }
  return moldura({ menu: '/pagina', lista: colunaBlocos(), centro: colunaPrevia(), contexto: colunaAjustes(), rotulos }, atualizar);
}
