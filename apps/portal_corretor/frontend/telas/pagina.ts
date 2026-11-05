import { html, nothing } from 'lit';
import type { CampoFormulario, UrbiVersoAPI } from '@urbiverso/sdk';
import { ROTULO_BLOCO, type Bloco } from '../../comum/pagina';
import { acoesComMais, avisoCreci, chamarApi, contaDeTrabalho, dataHora, enviar, itemDaUrl, itemNaUrl, mensagemDeErro } from '../apoio';
import { estadoDaFalha, estadoTela } from '../estados.js';
import { moldura } from '../moldura.js';
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
// Exceções de UI nomeadas (spec 11.9, regra do CLAUDE.md): (1) arrastar para ordenar não tem
// primitivo: subir/descer com [↑][↓]; (2) a prévia é a página pública dentro do editor, que tem CSS
// próprio por ser página pública, numa largura de celular (`pc-previa-pagina`); `urbi-hospedeiro` e
// `urbi-moldura` não mostram uma página com estilo próprio nem limitam a largura.

const estado = {
  visao: null as Visao | null,
  previa: null as Omit<PreviaPagina, 'destacar'> | null,
  falha: null as unknown,
  carregando: false,
  salvando: false,
  ocupado: false,
  dispositivo: 'celular' as 'celular' | 'computador',
  conta: null as number | null,
  geracao: 0,
};
let redesenhar: () => void = () => {};

/** Cada entrada em Página (e cada troca de conta) relê a página e a prévia. */
export function aoAbrirPagina() {
  if (estado.conta !== contaDeTrabalho()) {
    estado.visao = null;
    estado.previa = null;
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
    if (geracao === estado.geracao) estado.falha = e;
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
  itemNaUrl(tipo);
  redesenhar();
}

async function salvar(mudancas: Partial<Visao['pagina']>, extra: Record<string, unknown> = {}) {
  if (estado.salvando) {
    urbiVerso.notificar('Aguarde: a mudança anterior ainda está sendo salva.', 'info');
    return false;
  }
  const p = { ...estado.visao!.pagina, ...mudancas };
  const conta = estado.conta;
  estado.salvando = true;
  redesenhar();
  try {
    const visao = await enviar('PUT', '/pagina', { endereco: p.endereco, nome_exibicao: p.nome_exibicao, blocos: p.blocos, ...extra });
    // A conta mudou com o salvamento em voo: a página devolvida é da conta anterior e não entra na tela.
    if (conta !== estado.conta) return false;
    estado.visao = visao;
    urbiVerso.notificar('Salvo.', 'sucesso');
    void carregarPrevia();
    return true;
  } catch (e) {
    await urbiVerso.alertar({ titulo: 'Não foi possível salvar', mensagem: mensagemDeErro(e), tipo: 'erro' });
    return false;
  } finally {
    estado.salvando = false;
    redesenhar();
  }
}

async function nomeEEndereco() {
  const p = estado.visao!.pagina;
  const v = await urbiVerso.formulario({
    titulo: 'Nome e endereço',
    campos: [
      { nome: 'nome_exibicao', tipo: 'texto', rotulo: 'Nome que aparece na página', obrigatorio: true, valor: p.nome_exibicao },
      { nome: 'endereco', tipo: 'texto', rotulo: 'Endereço (letras minúsculas, números e hífen)', obrigatorio: true, valor: p.endereco },
    ],
  });
  if (v) await salvar({ nome_exibicao: String(v.nome_exibicao), endereco: String(v.endereco).trim().toLowerCase() });
}

async function mover(i: number, passo: number) {
  const blocos = [...estado.visao!.pagina.blocos];
  const j = i + passo;
  if (j < 0 || j >= blocos.length) return;
  [blocos[i], blocos[j]] = [blocos[j], blocos[i]];
  await salvar({ blocos });
}

async function alternar(i: number) {
  const blocos = estado.visao!.pagina.blocos.map((b, k) => (k === i ? { ...b, ativo: !b.ativo } : b));
  await salvar({ blocos });
}

async function camposDestaques(b: Bloco): Promise<CampoFormulario[]> {
  const r = await chamarApi('/imoveis?publicado_pagina=true&por_pagina=50');
  const lista = (r.dados ?? []).filter((i: any) => i.publicado_pagina);
  return lista.map((i: any) => ({ nome: `im_${i.codigo}`, tipo: 'booleano', rotulo: `${i.codigo} · ${i.titulo ?? i.tipo}`, valor: (b.codigos ?? []).includes(i.codigo) }));
}

async function editar(i: number) {
  const b = estado.visao!.pagina.blocos[i];
  const campos: CampoFormulario[] = [];
  if (b.tipo !== 'contato') campos.push({ nome: 'titulo', tipo: 'texto', rotulo: 'Título do bloco', valor: b.titulo ?? '' });
  if (b.tipo === 'apresentacao' || b.tipo === 'sobre') campos.push({ nome: 'texto', tipo: 'texto_longo', rotulo: 'Texto', valor: b.texto ?? '' });
  if (b.tipo === 'bairros') campos.push({ nome: 'lista', tipo: 'texto_longo', rotulo: 'Um bairro ou região por linha', valor: (b.lista ?? []).join('\n') });
  if (b.tipo === 'contato') {
    campos.push({ nome: 'whatsapp', tipo: 'booleano', rotulo: 'Mostrar botão do WhatsApp', valor: b.whatsapp !== false });
    campos.push({ nome: 'instagram', tipo: 'texto', rotulo: 'Instagram (só o usuário)', valor: b.instagram ?? '', placeholder: 'seu.usuario' });
  }
  let mensagem: string | undefined = DICA_BLOCO[b.tipo];
  if (b.tipo === 'destaques') {
    const opcoes = await camposDestaques(b);
    mensagem = opcoes.length
      ? 'Escolha até 6 imóveis (além disso, valem os 6 primeiros). Só aparecem os que estiverem publicados.'
      : 'Marque imóveis para a página (na ficha do imóvel) para escolher os destaques.';
    campos.push(...opcoes);
  }
  const v = await urbiVerso.formulario({ titulo: ROTULO_BLOCO[b.tipo], campos, mensagem });
  if (!v) return;
  const novo: Bloco = { ...b };
  if ('titulo' in v) novo.titulo = String(v.titulo ?? '');
  if ('texto' in v) novo.texto = String(v.texto ?? '');
  if ('lista' in v) novo.lista = String(v.lista ?? '').split('\n').map((s) => s.trim()).filter(Boolean);
  if ('whatsapp' in v) novo.whatsapp = v.whatsapp === true;
  if ('instagram' in v) novo.instagram = String(v.instagram ?? '');
  if (b.tipo === 'destaques') novo.codigos = Object.entries(v).filter(([k, x]) => k.startsWith('im_') && x === true).map(([k]) => k.slice(3)).slice(0, 6);
  const blocos = estado.visao!.pagina.blocos.map((x, k) => (k === i ? novo : x));
  await salvar({ blocos });
}

/** [Refazer a página com IA]: a mesma escrita de `POST /pagina/sugerir-textos`; o corretor revisa antes de usar. */
async function refazerComIa() {
  const v = await urbiVerso.formulario({
    titulo: 'Refazer a página com IA',
    mensagem: 'A IA escreve a apresentação e o "sobre mim" com o que você contar aqui e com os imóveis da página. Você revisa antes de usar.',
    campos: [{ nome: 'observacoes', tipo: 'texto_longo', rotulo: 'Conte um pouco sobre você (opcional)', placeholder: 'Ex.: atendo famílias que buscam casa no Lago Sul há 8 anos.' }],
    rotuloConfirmar: 'Escrever',
  });
  if (!v) return;
  const conta = estado.conta;
  estado.ocupado = true;
  redesenhar();
  try {
    const r = await enviar('POST', '/pagina/sugerir-textos', { observacoes: v.observacoes, nome_exibicao: estado.visao!.pagina.nome_exibicao });
    // Os textos são da conta em que foram pedidos: com a conta trocada, não se oferecem nem se gravam na outra.
    if (conta !== estado.conta) return;
    const ok = await urbiVerso.confirmar({
      titulo: 'Usar estes textos?',
      mensagem: `Apresentação:\n${r.apresentacao}\n\nSobre mim:\n${r.sobre}`,
      rotuloConfirmar: 'Usar e ligar os blocos',
    });
    if (!ok || conta !== estado.conta) return;
    const blocos = estado.visao!.pagina.blocos.map((b) =>
      b.tipo === 'apresentacao' ? { ...b, texto: r.apresentacao, ativo: true } : b.tipo === 'sobre' ? { ...b, texto: r.sobre, ativo: true } : b,
    );
    await salvar({ blocos }, { gerada_por_ia: true });
  } catch (e) {
    await urbiVerso.alertar({ titulo: 'Não foi possível escrever agora', mensagem: mensagemDeErro(e), tipo: 'alerta' });
  } finally {
    estado.ocupado = false;
    redesenhar();
  }
}

async function acao(rota: string, sucesso: string) {
  estado.ocupado = true;
  redesenhar();
  try {
    const r = await enviar('POST', rota);
    urbiVerso.notificar(sucesso + (typeof r?.imoveis_publicados === 'number' ? ` ${r.imoveis_publicados} imóvel(is) na página.` : ''), 'sucesso');
    await carregar();
  } catch (e) {
    await urbiVerso.alertar({ titulo: 'Não foi possível concluir', mensagem: mensagemDeErro(e), tipo: 'erro' });
  } finally {
    estado.ocupado = false;
    redesenhar();
  }
}

async function despublicar() {
  const ok = await urbiVerso.confirmar({ titulo: 'Tirar a página do ar', mensagem: 'A página e as fichas públicas deixam de abrir. Você pode publicar de novo quando quiser.', rotuloConfirmar: 'Tirar do ar', perigo: true });
  if (ok) await acao('/pagina/despublicar', 'Página fora do ar.');
}

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
  apresentacao: 'A capa: sua foto, o nome, o CRECI (só se cadastrado), o título e o texto, com o botão do WhatsApp.',
  imoveis: 'Mostra todos os imóveis marcados para a página, anunciados e com autorização vigente.',
  formulario: 'O contato chega em Clientes, com negócio novo no funil e o consentimento registrado.',
  contato: 'Os botões do WhatsApp e do Instagram, na capa.',
};

// ── Esquerda ──────────────────────────────────────────────────────────────────

function itemBloco(b: Bloco, i: number, total: number, sel: number) {
  return html`<urbi-linha justificar="entre" quebrar>
    <urbi-stack>
      <urbi-prosa>${ROTULO_BLOCO[b.tipo]}</urbi-prosa>
      <urbi-prosa papel="fraco">${b.ativo ? 'aparece' : 'oculto'}${i === sel ? ' · selecionado' : ''}</urbi-prosa>
    </urbi-stack>
    <urbi-linha>
      <urbi-botao variante="fantasma" pequeno icone="fa-solid fa-arrow-up" ariaLabel=${`Subir ${ROTULO_BLOCO[b.tipo]}`} title="Subir"
        ?desabilitado=${i === 0 || estado.salvando} @click=${(e: Event) => (e.stopPropagation(), void mover(i, -1))}></urbi-botao>
      <urbi-botao variante="fantasma" pequeno icone="fa-solid fa-arrow-down" ariaLabel=${`Descer ${ROTULO_BLOCO[b.tipo]}`} title="Descer"
        ?desabilitado=${i === total - 1 || estado.salvando} @click=${(e: Event) => (e.stopPropagation(), void mover(i, 1))}></urbi-botao>
      <urbi-checkbox label=${`Mostrar ${ROTULO_BLOCO[b.tipo]}`} ?marcado=${b.ativo} ?desabilitado=${estado.salvando}
        @click=${(e: Event) => e.stopPropagation()} @urbi:checkbox-change=${() => void alternar(i)}></urbi-checkbox>
    </urbi-linha>
  </urbi-linha>`;
}

function colunaBlocos() {
  const v = estado.visao!;
  const p = v.pagina;
  const noAr = !!p.publicada_em;
  const sel = selecionado();
  return html`<urbi-stack>
    <urbi-linha justificar="entre" quebrar>
      <urbi-stack>
        <urbi-prosa papel="titulo">Página</urbi-prosa>
        <urbi-prosa papel="secundario">${urlCompleta()}</urbi-prosa>
      </urbi-stack>
      ${noAr
        ? nothing
        : html`<urbi-botao icone="fa-solid fa-rocket" ?carregando=${estado.ocupado} ?desabilitado=${!v.salva}
            @click=${() => void acao('/pagina/publicar', 'Página publicada.')}>Publicar</urbi-botao>`}
    </urbi-linha>
    <urbi-linha quebrar>
      <urbi-badge cor=${noAr ? 'sucesso' : 'padrao'}>${noAr ? `Publicada desde ${dataHora(p.publicada_em)}` : 'Rascunho'}</urbi-badge>
      <urbi-botao variante="texto" pequeno @click=${() => void nomeEEndereco()}>Nome e endereço</urbi-botao>
    </urbi-linha>
    ${!v.salva ? html`<urbi-prosa papel="dica">Esta é uma sugestão de página: ela é salva na primeira mudança, e aí dá para publicar.</urbi-prosa>` : nothing}
    ${v.marcados_para_pagina === 0
      ? html`<urbi-banner variante="alerta">Nenhum imóvel marcado para a página. Na ficha do imóvel, ligue "Aparece na minha página" (precisa estar anunciado e com autorização vigente).</urbi-banner>`
      : nothing}
    <urbi-prosa papel="secao">Blocos</urbi-prosa>
    <urbi-lista clicavel separador .itens=${p.blocos} .itemAtivo=${(_b: Bloco, i: number) => i === sel}
      .render_item=${(b: Bloco, i: number) => itemBloco(b, i, p.blocos.length, sel)}
      @urbi:lista-click=${(e: CustomEvent) => selecionar((e.detail.item as Bloco).tipo)}></urbi-lista>
    <urbi-prosa papel="dica">Os blocos aparecem nesta ordem; use as setas para mudar de lugar.</urbi-prosa>
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

function resumoBloco(b: Bloco) {
  const linhas: string[] = [];
  if (b.tipo !== 'contato') linhas.push(`Título: ${b.titulo || '(o padrão)'}`);
  if ((b.tipo === 'apresentacao' || b.tipo === 'sobre') && b.texto) linhas.push(b.texto.length > 160 ? `${b.texto.slice(0, 160)}…` : b.texto);
  if ((b.tipo === 'apresentacao' || b.tipo === 'sobre') && !b.texto) linhas.push('Sem texto ainda.');
  if (b.tipo === 'bairros') linhas.push(b.lista?.length ? b.lista.join(', ') : 'Nenhum bairro ainda.');
  if (b.tipo === 'destaques') linhas.push(b.codigos?.length ? `Escolhidos: ${b.codigos.join(', ')}` : 'Nenhum imóvel escolhido: o bloco fica de fora até você escolher.');
  if (b.tipo === 'contato') linhas.push(`WhatsApp ${b.whatsapp !== false ? 'ligado' : 'desligado'}${b.instagram ? ` · Instagram @${b.instagram}` : ''}`);
  return linhas;
}

function colunaAjustes() {
  const v = estado.visao!;
  const i = selecionado();
  const b = v.pagina.blocos[i];
  const n = v.numeros;
  const noAr = !!v.pagina.publicada_em;
  return html`<urbi-stack>
    ${b
      ? html`<urbi-card titulo=${`Bloco: ${ROTULO_BLOCO[b.tipo]}`} icone="fa-solid fa-sliders">
          <urbi-stack>
            ${DICA_BLOCO[b.tipo] ? html`<urbi-prosa papel="dica">${DICA_BLOCO[b.tipo]}</urbi-prosa>` : nothing}
            ${resumoBloco(b).map((l) => html`<urbi-prosa papel="secundario">${l}</urbi-prosa>`)}
            <urbi-linha>
              <urbi-botao pequeno variante="secundario" icone="fa-solid fa-pen" @click=${() => void editar(i)}>Editar bloco</urbi-botao>
            </urbi-linha>
          </urbi-stack>
        </urbi-card>`
      : nothing}
    <urbi-card titulo="Marca" icone="fa-solid fa-palette">
      <urbi-stack>
        <urbi-linha>
          <urbi-avatar nome=${v.pagina.nome_exibicao} foto=${estado.previa?.pagina.foto_url ?? ''} tamanho="48"></urbi-avatar>
          <urbi-prosa papel="secundario">A página usa a cor, a foto e o nome da sua marca, os mesmos do Estúdio, das seleções e do portal.</urbi-prosa>
        </urbi-linha>
        <urbi-linha><urbi-botao variante="texto" pequeno href=${urbiVerso.href('/ajustes?aba=conta')}>Editar em Ajustes › Conta e marca</urbi-botao></urbi-linha>
        ${v.sem_creci ? avisoCreci() : nothing}
      </urbi-stack>
    </urbi-card>
    <urbi-card titulo="Últimos 30 dias" icone="fa-solid fa-chart-simple">
      <urbi-stack>
        <urbi-grid min="120px">
          <urbi-kpi rotulo="Visitas" .valor=${n?.visitas_30d ?? '—'} formato=${typeof n?.visitas_30d === 'number' ? 'numero' : 'texto'}></urbi-kpi>
          <urbi-kpi rotulo="Contatos" .valor=${n?.contatos_30d ?? 0} formato="numero"></urbi-kpi>
        </urbi-grid>
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
    <urbi-linha><urbi-botao variante="secundario" pequeno icone="fa-solid fa-comments" @click=${() => abrirAssistente()}>Perguntar ao Assistente</urbi-botao></urbi-linha>
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
