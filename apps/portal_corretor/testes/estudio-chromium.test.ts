import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

// Estúdio no Padrão B (B6, issue #95) no DOM de verdade (Chromium): a moldura com Criar rápido 2×2 e
// Seus pedidos à esquerda, o pedido como conversa (`urbi-feed`) e o compositor no centro, Esta semana,
// Biblioteca e o aviso de CRECI à direita; os estados "Instagram desconectado" e "IA indisponível"; e
// NENHUM cartão de peça com mais de um botão principal. Os primitivos `urbi-*` são elementos sem
// registro: o teste mede o que a tela entrega a eles (o rodapé do feed é desenhado aqui, pela própria
// render prop). Sem Playwright, pula.

function playwright(): any {
  try {
    return createRequire(import.meta.url)('playwright');
  } catch {
    return null;
  }
}

const ORIGEM = 'https://app.exemplo';

const ENTRADA = `
import { render } from 'lit';
window.render = render;
import { Estudio } from './frontend/telas/estudio';
import './frontend/index';
// A instância viva do Estúdio (gancho de teste): recarregar e o cartão com as ações dela.
Estudio.aoNascer = (e) => (window.estudio = e);
window.recarregar = () => window.estudio.recarregar();
window.cartaoVivo = (p) => window.estudio.cartaoPeca(p);
// Só para desenhar um cartão (contar botões): uma instância que nunca nasceu, sem ação nenhuma.
window.cartaoPeca = (p) => new Estudio(() => {}).cartaoPeca(p);
const agora = Date.now();
const iso = (d) => new Date(agora + d * 86400e3).toISOString();
const arte = [{ id: 1, ordem: 1, url: '/arte/1.jpg' }];
const base = { pedido: 'Lançamento da casa do Lago Sul', imovel_id: 5, imovel_codigo: 'IM-0005', objetivo: 'novo_imovel', titulo: 'Casa no Lago Sul', legenda: 'Legenda', hashtags: '#LagoSul', motor: 'canva_ia' };
window.PECAS = [
  { ...base, id: 11, formato: 'post_1x1', estado: 'rascunho', arquivos: [], criado_em: iso(-1) },
  { ...base, id: 12, formato: 'story', estado: 'rascunho', arquivos: arte, criado_em: iso(-1) },
  { ...base, id: 13, formato: 'carrossel', estado: 'agendada', arquivos: arte, criado_em: iso(-1), agendada_para: iso(2), aprovada_em: iso(-1) },
  { ...base, id: 20, pedido: 'Vendido', objetivo: 'vendido', formato: 'post_1x1', estado: 'publicada', arquivos: arte, criado_em: iso(-3), publicada_em: iso(-2), permalink: 'https://instagram.com/p/x' },
];
window.ESTADOS_TESTE = [
  { estado: 'rascunho', arquivos: [] },
  { estado: 'rascunho', arquivos: arte },
  { estado: 'rejeitada', arquivos: arte },
  { estado: 'aprovada', arquivos: arte, aprovada_em: iso(0) },
  { estado: 'agendada', arquivos: arte, agendada_para: iso(1) },
  { estado: 'publicando', arquivos: arte, atualizado_em: iso(0) },
  { estado: 'publicada', arquivos: arte, permalink: 'x' },
  { estado: 'publicada', arquivos: arte },
  { estado: 'erro', arquivos: arte, aprovada_em: iso(0), erro: 'falhou' },
  { estado: 'erro', arquivos: arte },
  { estado: 'erro', arquivos: [] },
].map((e, i) => ({ ...base, id: 100 + i, formato: 'post_1x1', criado_em: iso(0), ...e }));
window.chamadas = [];
let aoMudarRota = null;
window.urbiVerso = {
  subRota: () => location.pathname.replace(/^\\/portal_corretor/, '') || '/',
  href: (s) => '/portal_corretor' + s,
  escutarRota: (cb) => ((aoMudarRota = cb), () => (aoMudarRota = null)),
  // Navegar dentro do app, como o shell: empilha o endereço e avisa a rota (o app recria a tela).
  navegarSub: (s) => {
    history.pushState(null, '', '/portal_corretor' + s);
    aoMudarRota?.(s.split('?')[0]);
  },
  usuario: () => ({ id: 1, nome: 'Marina' }),
  // FRIO: entrada a frio, como o shell publica (autenticacao.md § Quando o contexto existe): sem resposta
  // ainda (\`carregado: false\`, sem conta) até o teste chamar \`chegarContexto()\`. SEM_CONTA: o usuário
  // deixou de estar em conta (escopado, conjunto vazio).
  contexto: () =>
    window.FRIO && !window.CONTEXTO_CHEGOU
      ? { nivel: null, roles: [], carregado: false }
      : { carregado: true, nivel: 'usuario', roles: ['corretor'], conta: { resolucao: 'escopado', contas: window.SEM_CONTA ? [] : [{ id: 100, nome: 'A' }, { id: 200, nome: 'B' }] } },
  notificar: (m) => (window.avisos ??= []).push(m),
  alertar: async (a) => { (window.alertas ??= []).push(a.titulo); },
  confirmar: async () => true,
  formulario: async (f) => { (window.formularios ??= []).push(f); return null; },
  api: async (rota, opcoes) => {
    window.chamadas.push((opcoes?.method ?? 'GET') + ' ' + rota);
    const [caminho] = rota.split('?');
    const conta = Number(new Headers(opcoes?.headers).get('X-Conta'));
    // SEGURAR: a resposta de /estudio/pecas só sai quando o teste a libera (window.pendentes), com as peças da conta.
    if (caminho === '/estudio/pecas' && window.SEGURAR) {
      return new Promise((resolve) => (window.pendentes ??= []).push({ conta, liberar: (dados) => resolve({ dados, total: dados.length, ia: true }) }));
    }
    if (caminho === '/imoveis') return { dados: [{ id: 5, codigo: 'IM-0005', titulo: 'Casa' }], paginas: 1 };
    // SEGURAR_CRIAR: a criação da conta A fica em voo até o teste liberar.
    if (caminho === '/estudio/pedido' && window.SEGURAR_CRIAR) {
      return new Promise((resolve) => (window.criacoes ??= []).push(() => resolve({ pecas: [{ ...window.PECAS[0], id: 900 }], ia: true })));
    }
    // SEGURAR_APROVAR: o "Aprovar" da conta A fica em voo até o teste o fazer falhar; SEGURAR_APROVAR_OK, dar certo.
    if (/^\\/estudio\\/pecas\\/\\d+\\/aprovar$/.test(caminho) && window.SEGURAR_APROVAR) {
      return new Promise((_, rejeitar) => (window.aprovacoes ??= []).push(() => rejeitar(new Error('O servidor recusou'))));
    }
    if (/^\\/estudio\\/pecas\\/\\d+\\/aprovar$/.test(caminho) && window.SEGURAR_APROVAR_OK) {
      return new Promise((resolver) => (window.aprovacoes ??= []).push(() => resolver({ ok: true })));
    }
    // Remover: a peça sai das próximas cargas.
    const removida = /^\\/estudio\\/pecas\\/(\\d+)\\/remover$/.exec(caminho);
    if (removida) {
      (window.REMOVIDAS ??= []).push(Number(removida[1]));
      return { ok: true };
    }
    if (caminho === '/estudio/pecas') {
      // PECAS_POR_CONTA: cada conta com as suas peças; sem ele, as mesmas em todas.
      const dados = (window.PECAS_POR_CONTA?.[conta] ?? window.PECAS).filter((p) => !(window.REMOVIDAS ?? []).includes(p.id));
      return { dados, total: dados.length, ia: window.IA ?? true };
    }
    if (caminho === '/estudio/marca') return { creci: window.CRECI ?? null, logo_url: '/logo.png', foto_url: null, referencias: [{ id: 7, url: '/ref/7.jpg' }] };
    if (caminho === '/conexoes') return { instagram: window.IG === undefined ? { usuario: 'rafael.imoveis', ultimo_erro: null } : window.IG, disponivel: true };
    return {};
  },
};
const app = document.createElement('app-portal-corretor');
document.getElementById('raiz').append(app);
window.app = app;
window.desenhar = () => app.requestUpdate();
// O contexto mudou (chegou, ou a conta sumiu): o app ouve \`urbi:contexto-app\`.
const avisarContexto = () => window.dispatchEvent(new CustomEvent('urbi:contexto-app', { detail: window.urbiVerso.contexto() }));
window.chegarContexto = () => {
  window.CONTEXTO_CHEGOU = true;
  avisarContexto();
};
window.ficarSemConta = () => {
  window.SEM_CONTA = true;
  avisarContexto();
};
// Trocar de conta pelo seletor do app (o caminho real: aoEscolherConta → chave nova → instância nova).
window.trocar = (conta) => {
  const sel = app.shadowRoot.querySelector('urbi-select');
  sel.dispatchEvent(new CustomEvent('urbi:select-change', { detail: { valor: String(conta) } }));
};
// Navegação dentro do app: outra tela (o Estúdio sai do DOM) e a volta por um endereço do Estúdio.
window.sairDoEstudio = () => window.urbiVerso.navegarSub('/corretores');
window.abrirEstudio = (endereco) => window.urbiVerso.navegarSub(endereco);
// Outra app: o elemento do app sai do DOM (e volta depois, sem redesenhar).
window.irParaOutraApp = () => app.remove();
window.voltarDaOutraApp = () => document.getElementById('raiz').append(app);
`;

const PROFUNDO = `
window.$q = (s) => document.querySelector('app-portal-corretor')?.shadowRoot?.querySelector(s) ?? null;
window.$qa = (s) => [...(document.querySelector('app-portal-corretor')?.shadowRoot?.querySelectorAll(s) ?? [])];
window.profundo = (no) => {
  if (!no) return '';
  const partes = [];
  const andar = (n) => {
    if (n.nodeType === 3) partes.push(n.textContent);
    for (const a of ['titulo', 'texto', 'rotulo', 'mensagem', 'submensagem']) if (n.nodeType === 1 && n.getAttribute(a)) partes.push(n.getAttribute(a));
    if (n.shadowRoot) andar(n.shadowRoot);
    for (const f of n.childNodes) andar(f);
  };
  andar(no);
  return partes.join(' ').replace(/\\s+/g, ' ').trim();
};
// Botão principal: urbi-botao sem variante (o padrão é o primário) fora do gatilho do "Mais", ou o
// envio da arte em variante primária.
window.principais = (no) => [...no.querySelectorAll('urbi-botao, urbi-seletor-arquivo')].filter((b) =>
  b.localName === 'urbi-seletor-arquivo' ? b.getAttribute('variante') === 'primario' : !b.getAttribute('variante') || b.getAttribute('variante') === 'primario');
`;

async function montar(pw: any) {
  const pacote = await build({
    stdin: { contents: ENTRADA, resolveDir: process.cwd(), loader: 'ts' },
    bundle: true,
    write: false,
    format: 'iife',
    target: 'es2022',
    tsconfig: 'tsconfig.json',
    logLevel: 'silent',
  });
  const html = `<!doctype html><html><head><meta charset="utf-8"></head><body><div id="raiz"></div><script>${PROFUNDO}</script><script>${pacote.outputFiles[0].text}</script></body></html>`;
  const navegador = await pw.chromium.launch();
  const pagina = await navegador.newPage({ viewport: { width: 1440, height: 900 } });
  await pagina.route(`${ORIGEM}/**`, (r: any) => r.fulfill({ contentType: 'text/html', body: html }));
  return { navegador, pagina };
}

test('Estúdio no Chromium: moldura, Criar rápido 2×2, pedido como conversa, contexto e uma ação principal por cartão', async (t) => {
  const pw = playwright();
  if (!pw) return t.skip('Playwright não instalado neste ambiente');
  const { navegador, pagina } = await montar(pw);
  const esperar = () => pagina.waitForTimeout(120);
  try {
    await pagina.goto(`${ORIGEM}/portal_corretor/estudio?pedido=11`);
    await esperar();
    const r: any = await pagina.evaluate(() => {
      const w = window as any;
      const col = (slot: string) => (window as any).$q(`urbi-3-colunas > [slot="${slot}"]`);
      const feed = (window as any).$q('urbi-feed') as any;
      const lista = col('esquerda')!.querySelector('urbi-lista') as any;
      const rodapes = (feed?.itens ?? []).map((m: any) => {
        const div = document.createElement('div');
        w.render(feed.renderRodape(m), div);
        return { id: m.id, autor: m.autorNome, principais: w.principais(div).length, texto: w.profundo(div) };
      });
      return {
        trilhoAtivo: ((window as any).$q('urbi-trilho-atalhos') as any)?.itens.find((i: any) => i.ativo)?.id,
        esquerda: w.profundo(col('esquerda')),
        rapidos: [...col('esquerda')!.querySelectorAll('urbi-grid > urbi-botao')].map((b) => w.profundo(b)),
        pedidos: lista.itens.map((x: any) => x.id),
        ativo: lista.itens.filter((x: any) => lista.itemAtivo(x)).map((x: any) => x.id),
        centroFilhos: [...(window as any).$qa('urbi-3-colunas > [slot="centro"]')].map((e) => e.localName),
        feedPai: feed?.parentElement?.localName,
        feedSlot: feed?.getAttribute('slot'),
        redatorPai: (window as any).$q('urbi-redator')?.parentElement?.localName,
        redatorSlotPai: (window as any).$q('urbi-redator')?.parentElement?.getAttribute('slot'),
        feedExpandir: feed?.hasAttribute('expandir'),
        rodapes,
        direita: w.profundo(col('direita')),
        estilos: (window as any).$qa('style').length,
        chamadas: w.chamadas.slice(),
      };
    });
    assert.equal(r.trilhoAtivo, '/estudio');
    assert.match(r.esquerda, /Estúdio @rafael\.imoveis conectado/);
    assert.ok(!r.esquerda.includes('◎'), 'o ícone é o urbi-icone, não um glifo no texto');
    assert.deepEqual(r.rapidos, ['Lançamento', 'Baixou o preço', 'Vendido', 'Visita aberta']);
    assert.deepEqual(r.pedidos, [20, 11], 'Seus pedidos: o mais recente primeiro, um por envio');
    assert.deepEqual(r.ativo, [11], 'o pedido aberto fica marcado');
    assert.match(r.esquerda, /Todas · 4/);
    // Centro: o feed (expandir) e o compositor; sem faixa com IA liberada e Instagram conectado (e então
    // sem o hospedeiro das faixas, que deixaria um vão acima do feed).
    // Contrato do feed (ui-componentes-conteudo.md § Onde pôr o par feed + redator): o `urbi-feed[expandir]`
    // é filho DIRETO do `urbi-3-colunas` no slot do centro; o redator vai num `urbi-hospedeiro` do mesmo slot.
    assert.deepEqual(r.centroFilhos, ['urbi-feed', 'urbi-hospedeiro']);
    assert.equal(r.feedPai, 'urbi-3-colunas');
    assert.equal(r.feedSlot, 'centro');
    assert.equal(r.redatorPai, 'urbi-hospedeiro');
    assert.equal(r.redatorSlotPai, 'centro');
    assert.ok(r.feedExpandir);
    assert.deepEqual(r.rodapes.map((x: any) => [x.id, x.autor]), [[-11, 'Você'], [11, 'Estúdio'], [12, 'Estúdio'], [13, 'Estúdio']]);
    assert.equal(r.rodapes[0].texto, '', 'a mensagem do corretor não tem cartão');
    for (const x of r.rodapes.slice(1)) assert.equal(x.principais, 1, `peça ${x.id}: um botão principal`);
    assert.match(r.rodapes[1].texto, /falta a arte.*Copiar descrição.*Abrir no Canva.*Enviar a arte do Canva/);
    assert.match(r.rodapes[2].texto, /Aprovar/);
    assert.match(r.rodapes[3].texto, /Cancelar agendamento/);
    // Direita: Esta semana, Biblioteca com o logo e a referência, aviso de CRECI (falta) e nada de créditos.
    assert.match(r.direita, /Esta semana.*Agendadas · 1.*Carrossel · Casa no Lago Sul.*Publicadas · 1/);
    assert.match(r.direita, /Biblioteca.*Logo.*Referência 1/);
    assert.match(r.direita, /Adicione seu CRECI ao perfil para que ele apareça nos anúncios/);
    assert.doesNotMatch(`${r.esquerda} ${r.direita}`, /[Cc]rédito|janela|autofill|preenchimento automático/);
    assert.equal(r.estilos, 0, 'a tela não escreve CSS');
    assert.ok(r.chamadas.includes('GET /estudio/pecas') && r.chamadas.includes('GET /conexoes'));

    // Todo estado de peça: exatamente um botão principal no cartão.
    const contagem: any = await pagina.evaluate(() => {
      const w = window as any;
      return w.ESTADOS_TESTE.map((p: any) => {
        const div = document.createElement('div');
        w.render(w.cartaoPeca(p), div);
        return [p.estado, p.arquivos.length, w.principais(div).length];
      });
    });
    for (const [estado, arte, n] of contagem) assert.equal(n, 1, `${estado} (${arte ? 'com' : 'sem'} arte): ${n} botões principais`);

    // ?item= abre o pedido da peça; com CRECI o aviso some.
    await pagina.evaluate(() => {
      const w = window as any;
      w.CRECI = 'DF-1';
      history.replaceState(null, '', '/portal_corretor/estudio?item=20');
    });
    await pagina.evaluate(() => (window as any).desenhar());
    let s: any = await pagina.evaluate(() => {
      const w = window as any;
      const lista = (window as any).$q('urbi-3-colunas > [slot="esquerda"] urbi-lista') as any;
      return { ativo: lista.itens.filter((x: any) => lista.itemAtivo(x)).map((x: any) => x.id), feed: ((window as any).$q('urbi-feed') as any).itens.map((m: any) => m.id) };
    });
    assert.deepEqual(s, { ativo: [20], feed: [-20, 20] });

    // Pedido que não existe (ou de outra conta): "Não encontrado"; o compositor fica.
    await pagina.evaluate(() => {
      history.replaceState(null, '', '/portal_corretor/estudio?pedido=999');
      (window as any).desenhar();
    });
    s = await pagina.evaluate(() => {
      const w = window as any;
      const centro = (window as any).$q('urbi-3-colunas > [slot="centro"]')!;
      return { filhos: [...centro.children].map((e) => e.localName), texto: w.profundo(centro) };
    });
    assert.deepEqual(s.filhos, ['urbi-estado-vazio', 'urbi-redator']);
    assert.match(s.texto, /Não encontrado/);
    assert.deepEqual(await pagina.evaluate(() => [...(window as any).$qa('urbi-3-colunas > [slot="centro"]')].map((e) => e.localName)), ['urbi-hospedeiro'], 'sem pedido aberto o centro segue embrulhado num bloco só');
    assert.equal(await pagina.evaluate(() => (window as any).$q('urbi-3-colunas')!.getAttribute('painel-ativo')), 'centro', 'id que não acha pedido: o celular abre no centro');
  } finally {
    await navegador.close();
  }
});

test('Estúdio no Chromium: Instagram desconectado e IA indisponível são faixas; o Estúdio continua', async (t) => {
  const pw = playwright();
  if (!pw) return t.skip('Playwright não instalado neste ambiente');
  const { navegador, pagina } = await montar(pw);
  try {
    await pagina.addInitScript(() => {
      const w = window as any;
      w.IG = null;
      w.IA = false;
    });
    await pagina.goto(`${ORIGEM}/portal_corretor/estudio`);
    await pagina.waitForTimeout(120);
    const s: any = await pagina.evaluate(() => {
      const w = window as any;
      const centro = (window as any).$q('urbi-3-colunas > [slot="centro"]')!;
      return {
        filhos: [...centro.children].map((e) => e.localName + (e.getAttribute('variante') ? `:${e.getAttribute('variante')}` : '')),
        texto: w.profundo(centro),
        esquerda: w.profundo((window as any).$q('urbi-3-colunas > [slot="esquerda"]')),
        painel: (window as any).$q('urbi-3-colunas')!.getAttribute('painel-ativo'),
      };
    });
    assert.deepEqual(s.filhos, ['urbi-banner:info', 'urbi-banner:alerta', 'urbi-stack', 'urbi-redator']);
    assert.match(s.texto, /IA indisponível agora: os textos saem do modelo do app/);
    assert.match(s.texto, /Instagram não conectado.*Reconectar/);
    assert.match(s.texto, /Escolha um pedido na lista/);
    assert.match(s.esquerda, /Instagram não conectado/);
    assert.equal(s.painel, 'esquerda', 'sem pedido escolhido, o celular abre na lista');
  } finally {
    await navegador.close();
  }
});

test('Estúdio no Chromium: troca de conta com carga em voo descarta a resposta da anterior; falha de recarga fica visível', async (t) => {
  const pw = playwright();
  if (!pw) return t.skip('Playwright não instalado neste ambiente');
  const { navegador, pagina } = await montar(pw);
  try {
    // Carga da conta A (100) fica em voo.
    await pagina.addInitScript(() => ((window as any).SEGURAR = true));
    await pagina.goto(`${ORIGEM}/portal_corretor/estudio`);
    await pagina.waitForTimeout(120);
    const lido = () =>
      pagina.evaluate(() => {
        const w = window as any;
        const lista = (window as any).$q('urbi-lista') as any;
        return { texto: w.profundo((window as any).$q('urbi-inbox')), pedidos: (lista?.itens ?? []).map((x: any) => x.id), pendentes: w.pendentes.map((p: any) => p.conta), chamadas: w.chamadas.filter((c: string) => c === 'GET /estudio/pecas').length };
      });
    let r: any = await lido();
    assert.deepEqual(r.pendentes, [100]);
    assert.match(r.texto, /Carregando/);

    // (a) a conta muda para B com A em voo: carrega B; A responde e é descartada; nada de A na tela.
    await pagina.evaluate(() => {
      const w = window as any;
      w.trocar(200);
    });
    await pagina.waitForTimeout(60);
    r = await lido();
    assert.deepEqual(r.pendentes, [100, 200], 'uma carga de B acontece');
    assert.match(r.texto, /Carregando/);
    await pagina.evaluate(() => {
      const w = window as any;
      w.pendentes[0].liberar([{ ...w.PECAS[0], id: 501, pedido: 'DA CONTA A', titulo: 'Peça da conta A' }]);
    });
    await pagina.waitForTimeout(120);
    r = await lido();
    assert.match(r.texto, /Carregando/, 'a resposta de A não vira tela: B ainda não respondeu');
    assert.deepEqual(r.pedidos, [], 'nenhuma peça de A na tela');
    await pagina.evaluate(() => {
      const w = window as any;
      w.pendentes[1].liberar([{ ...w.PECAS[0], id: 601, pedido: 'DA CONTA B', titulo: 'Peça da conta B' }]);
    });
    await pagina.waitForTimeout(120);
    r = await lido();
    assert.deepEqual(r.pedidos, [601], 'só o que veio de B');

    // (b) duas cargas da mesma conta em sequência (a segunda antes de a primeira responder): só a última vale.
    await pagina.evaluate(() => {
      const w = window as any;
      w.recarregar();
      w.recarregar();
    });
    await pagina.waitForTimeout(60);
    assert.deepEqual(await pagina.evaluate(() => (window as any).pendentes.map((p: any) => p.conta)), [100, 200, 200, 200]);
    await pagina.evaluate(() => {
      const w = window as any;
      w.pendentes[3].liberar([{ ...w.PECAS[0], id: 701, pedido: 'ULTIMA', titulo: 'Peça da última carga' }]);
    });
    await pagina.waitForTimeout(100);
    await pagina.evaluate(() => {
      const w = window as any;
      w.pendentes[2].liberar([{ ...w.PECAS[0], id: 702, pedido: 'PENULTIMA', titulo: 'Peça da penúltima carga' }]);
    });
    await pagina.waitForTimeout(100);
    r = await lido();
    assert.deepEqual(r.pedidos, [701], 'só a resposta da última carga vale');

    // Falha de recarga com dados na tela: faixa com "Tentar de novo", dados preservados.
    await pagina.evaluate(() => {
      const w = window as any;
      w.SEGURAR = false;
      const original = w.urbiVerso.api;
      w.urbiVerso.api = async (rota: string, o: any) => {
        if (rota.startsWith('/estudio/pecas')) throw Object.assign(new Error('x'), { status: 500 });
        return original(rota, o);
      };
      w.recarregar();
    });
    await pagina.waitForTimeout(150);
    r = await lido();
    assert.match(r.texto, /Não foi possível atualizar o Estúdio/);
    assert.match(r.texto, /Tentar de novo/);
    assert.deepEqual(r.pedidos, [701], 'os dados continuam na tela');
  } finally {
    await navegador.close();
  }
});

test('Estúdio no Chromium: com pedido aberto, falha de recarga fica visível com "Tentar de novo" e os dados do pedido continuam', async (t) => {
  const pw = playwright();
  if (!pw) return t.skip('Playwright não instalado neste ambiente');
  const { navegador, pagina } = await montar(pw);
  try {
    await pagina.goto(`${ORIGEM}/portal_corretor/estudio?pedido=11`);
    await pagina.waitForTimeout(120);
    await pagina.evaluate(() => {
      const w = window as any;
      const original = w.urbiVerso.api;
      w.urbiVerso.api = async (rota: string, o: any) => {
        if (rota.startsWith('/estudio/pecas')) throw Object.assign(new Error('x'), { status: 500 });
        return original(rota, o);
      };
      w.recarregar();
    });
    await pagina.waitForTimeout(150);
    const r: any = await pagina.evaluate(() => {
      const w = window as any;
      const centros = [...(window as any).$qa('urbi-3-colunas > [slot="centro"]')];
      return {
        filhos: centros.map((e) => e.localName),
        faixa: centros.map((e) => w.profundo(e)).join(' '),
        feed: (((window as any).$q('urbi-feed') as any)?.itens ?? []).map((m: any) => m.id),
      };
    });
    assert.deepEqual(r.filhos, ['urbi-hospedeiro', 'urbi-feed', 'urbi-hospedeiro'], 'o pedido continua aberto');
    assert.match(r.faixa, /Não foi possível atualizar o Estúdio/);
    assert.match(r.faixa, /Tentar de novo/);
    assert.deepEqual(r.feed, [-11, 11, 12, 13], 'os dados do pedido continuam');
  } finally {
    await navegador.close();
  }
});

test('Estúdio no Chromium: ação da conta A que termina depois da troca para B não mexe no estado de B', async (t) => {
  const pw = playwright();
  if (!pw) return t.skip('Playwright não instalado neste ambiente');
  const { navegador, pagina } = await montar(pw);
  try {
    await pagina.goto(`${ORIGEM}/portal_corretor/estudio`);
    await pagina.waitForTimeout(120);
    // Conta A cria um pedido (Criar rápido) e a resposta fica em voo.
    await pagina.evaluate(() => {
      const w = window as any;
      w.SEGURAR_CRIAR = true;
      w.urbiVerso.formulario = async () => ({ imovel_id: '5', pedido: '' });
      ((window as any).$qa('urbi-3-colunas > [slot="esquerda"] urbi-grid > urbi-botao')[2] as HTMLElement).click();
    });
    await pagina.waitForTimeout(120);
    assert.equal(await pagina.evaluate(() => (window as any).criacoes.length), 1, 'a criação de A está em voo');
    // A conta muda para B; a carga de B termina.
    await pagina.evaluate(() => {
      (window as any).trocar(200);
    });
    await pagina.waitForTimeout(150);
    const antes: any = await pagina.evaluate(() => {
      const w = window as any;
      return { cargas: w.chamadas.filter((c: string) => c === 'GET /estudio/pecas').length, url: location.search };
    });
    // A criação de A termina agora.
    await pagina.evaluate(() => (window as any).criacoes[0]());
    await pagina.waitForTimeout(200);
    const depois: any = await pagina.evaluate(() => {
      const w = window as any;
      return {
        cargas: w.chamadas.filter((c: string) => c === 'GET /estudio/pecas').length,
        url: location.search,
        avisos: w.avisos ?? [],
        alertas: w.alertas ?? [],
        instrucoes: w.chamadas.filter((c: string) => c.includes('/instrucao')).length,
        trabalhando: (window as any).profundo((window as any).$q('urbi-3-colunas')).includes('Escrevendo os textos'),
        pedidos: (((window as any).$q('urbi-lista') as any)?.itens ?? []).map((x: any) => x.id),
        feed: (((window as any).$q('urbi-feed') as any)?.itens ?? []).map((m: any) => m.id),
      };
    });
    assert.ok(!depois.pedidos.includes(900) && !depois.feed.includes(900) && !depois.feed.includes(-900), 'a peça criada em A (900) não aparece em B');
    assert.doesNotMatch(depois.url, /900/);
    assert.equal(depois.url, antes.url, 'a URL de B não ganhou o ?pedido= de A');
    assert.equal(depois.cargas, antes.cargas, 'nenhuma recarga disparada por A em B');
    assert.deepEqual(depois.avisos, [], 'nenhum aviso de A aparece em B');
    assert.deepEqual(depois.alertas, []);
    assert.equal(depois.instrucoes, 0, 'nenhuma descrição das peças de A é buscada em B');
    assert.equal(depois.trabalhando, false);
  } finally {
    await navegador.close();
  }
});

test('Estúdio no Chromium: conta trocada no meio do envio pelo redator e de uma ação: nada de A em B, e o redator não recebe sucesso', async (t) => {
  const pw = playwright();
  if (!pw) return t.skip('Playwright não instalado neste ambiente');
  const { navegador, pagina } = await montar(pw);
  try {
    await pagina.goto(`${ORIGEM}/portal_corretor/estudio`);
    await pagina.waitForTimeout(120);
    // Conta A (100): o corretor envia um pedido pelo redator; a criação fica em voo. Em paralelo, um
    // "Aprovar" de A fica em voo também.
    await pagina.evaluate(() => {
      const w = window as any;
      w.SEGURAR_CRIAR = true;
      w.SEGURAR_APROVAR = true;
      w.urbiVerso.formulario = async () => ({ pedido: 'Pedido da conta A', imovel_id: '', objetivo: 'novo_imovel', f_post_1x1: true });
      w.redatorA = (window as any).$q('urbi-redator');
      w.resultado = 'pendente';
      w.redatorA.aoEnviar({ texto: 'Pedido da conta A' }).then(
        () => (w.resultado = 'resolvido'),
        (e: Error) => (w.resultado = `rejeitado:${e.name}`),
      );
      const div = document.createElement('div');
      w.render(w.cartaoVivo(w.PECAS[1]), div); // peça 12: rascunho com arte, o principal é "Aprovar"
      w.principais(div)[0].click();
    });
    await pagina.waitForTimeout(150);
    const emVoo: any = await pagina.evaluate(() => ({ criacoes: (window as any).criacoes?.length, aprovacoes: (window as any).aprovacoes?.length }));
    assert.deepEqual(emVoo, { criacoes: 1, aprovacoes: 1 }, 'a criação e a aprovação de A estão em voo');
    // A conta muda para B (200); a tela é reconstruída e a carga de B termina.
    await pagina.evaluate(() => {
      (window as any).trocar(200);
    });
    await pagina.waitForTimeout(150);
    const antes: any = await pagina.evaluate(() => ({ url: location.search, cargas: (window as any).chamadas.filter((c: string) => c === 'GET /estudio/pecas').length }));
    // As duas operações de A terminam agora: a criação dá certo, a aprovação falha.
    await pagina.evaluate(() => {
      const w = window as any;
      w.criacoes[0]();
      w.aprovacoes[0]();
    });
    await pagina.waitForTimeout(250);
    const depois: any = await pagina.evaluate(() => {
      const w = window as any;
      return {
        resultado: w.resultado,
        redatorNovo: (window as any).$q('urbi-redator') !== w.redatorA,
        redatorAFora: !w.redatorA.isConnected,
        url: location.search,
        cargas: w.chamadas.filter((c: string) => c === 'GET /estudio/pecas').length,
        avisos: w.avisos ?? [],
        alertas: w.alertas ?? [],
        instrucoes: w.chamadas.filter((c: string) => c.includes('/instrucao')).length,
        tela: w.profundo((window as any).$q('urbi-3-colunas')),
      };
    });
    assert.equal(depois.resultado, 'rejeitado:InstanciaEncerrada', 'o redator de A não recebe sucesso: o envio rejeita');
    assert.ok(depois.redatorNovo && depois.redatorAFora, 'o redator de B é outro; o texto devolvido fica no de A, fora da tela');
    assert.equal(depois.url, antes.url, 'a URL de B não ganhou o ?pedido= de A');
    assert.equal(depois.cargas, antes.cargas, 'nenhuma recarga disparada por A em B');
    assert.deepEqual(depois.avisos, [], 'nenhum aviso de sucesso de A aparece em B');
    assert.deepEqual(depois.alertas, [], 'nem o erro da aprovação de A');
    assert.equal(depois.instrucoes, 0, 'nenhuma descrição das peças de A é buscada em B');
    assert.doesNotMatch(depois.tela, /Escrevendo os textos|Pedido da conta A/);
  } finally {
    await navegador.close();
  }
});

// Peças da conta A (100) e da conta B (200): os ids nunca se repetem entre contas. Roda depois da
// primeira carga (as peças de teste nascem no script da página).
const POR_CONTA = () => {
  const w = window as any;
  w.PECAS_POR_CONTA = { 100: w.PECAS, 200: [{ ...w.PECAS[0], id: 601, pedido: 'DA CONTA B', titulo: 'Peça da conta B' }] };
};

test('Estúdio no Chromium: depois da troca de conta, nada escolhido na conta anterior aparece (pedido aberto, ?item=)', async (t) => {
  const pw = playwright();
  if (!pw) return t.skip('Playwright não instalado neste ambiente');
  const { navegador, pagina } = await montar(pw);
  const ler = () =>
    pagina.evaluate(() => {
      const w = window as any;
      const centros = [...(window as any).$qa('urbi-3-colunas > [slot="centro"]')];
      const lista = (window as any).$q('urbi-lista') as any;
      return {
        url: location.search,
        centro: centros.map((e) => w.profundo(e)).join(' '),
        feed: (((window as any).$q('urbi-feed') as any)?.itens ?? []).map((m: any) => m.id),
        pedidos: (lista?.itens ?? []).map((x: any) => x.id),
        ativo: (lista?.itens ?? []).filter((x: any) => lista.itemAtivo(x)).map((x: any) => x.id),
        painel: (window as any).$q('urbi-3-colunas')?.getAttribute('painel-ativo'),
      };
    });
  try {
    // (a) Conta A com o pedido 11 aberto e a etapa "Falta a arte" escolhida.
    await pagina.goto(`${ORIGEM}/portal_corretor/estudio?pedido=11&etapa=arte`);
    await pagina.waitForTimeout(120);
    await pagina.evaluate(POR_CONTA);
    let r: any = await ler();
    assert.deepEqual(r.feed, [-11, 11, 12, 13], 'em A o pedido 11 está aberto');
    await pagina.evaluate(() => (window as any).trocar(200));
    await pagina.waitForTimeout(150);
    r = await ler();
    assert.deepEqual(r.pedidos, [601], 'B mostra só as suas peças');
    assert.doesNotMatch(r.centro, /Não encontrado|não está na sua conta/, 'B não mostra "Não encontrado" pelo pedido de A');
    assert.doesNotMatch(r.url, /pedido=|item=/, 'a URL de B não guarda o pedido de A');
    assert.match(r.url, /etapa=arte/, 'a etapa é só o filtro das listas e fica');
    assert.deepEqual(r.feed, [], 'nenhum pedido aberto em B');
    assert.deepEqual(r.ativo, []);
    assert.equal(r.painel, 'esquerda', 'no celular B abre na lista, não num aviso');

    // (c) De volta a A: abre limpa (a escolha de antes não volta).
    await pagina.evaluate(() => (window as any).trocar(100));
    await pagina.waitForTimeout(150);
    r = await ler();
    assert.deepEqual(r.pedidos, [11], 'a lista de A, ainda na etapa Falta a arte');
    assert.doesNotMatch(r.url, /pedido=|item=/);
    assert.deepEqual(r.feed, []);
    assert.match(r.centro, /Escolha um pedido na lista/);

    // (b) Conta A com ?item=20 (pela Esta semana) → troca para B: idem.
    await pagina.evaluate(() => {
      history.replaceState(null, '', '/portal_corretor/estudio?item=20');
      (window as any).desenhar();
    });
    await pagina.waitForTimeout(80);
    r = await ler();
    assert.deepEqual(r.feed, [-20, 20], 'em A a peça 20 está aberta');
    await pagina.evaluate(() => (window as any).trocar(200));
    await pagina.waitForTimeout(150);
    r = await ler();
    assert.doesNotMatch(r.centro, /Não encontrado|não está na sua conta/);
    assert.doesNotMatch(r.url, /pedido=|item=/);
    assert.deepEqual(r.feed, []);
    assert.equal(r.painel, 'esquerda');

    // Endereço aberto já na conta nova (um link de B) fica: só a escolha de A sai.
    await pagina.evaluate(() => {
      history.replaceState(null, '', '/portal_corretor/estudio?pedido=601');
      (window as any).desenhar();
    });
    await pagina.waitForTimeout(80);
    assert.deepEqual((await ler()).feed, [-601, 601]);
  } finally {
    await navegador.close();
  }
});

test('Estúdio no Chromium: "Novo post" pedido em A com a carga em voo não abre o formulário em B; numa entrada normal abre', async (t) => {
  const pw = playwright();
  if (!pw) return t.skip('Playwright não instalado neste ambiente');
  let { navegador, pagina } = await montar(pw);
  try {
    await pagina.addInitScript(() => ((window as any).SEGURAR = true));
    await pagina.goto(`${ORIGEM}/portal_corretor/estudio?criar=post`);
    await pagina.waitForTimeout(120);
    assert.doesNotMatch(await pagina.evaluate(() => location.search), /criar=/, 'o pedido do menu Criar sai da URL');
    await pagina.evaluate(() => (window as any).trocar(200));
    await pagina.waitForTimeout(60);
    await pagina.evaluate(() => {
      const w = window as any;
      w.pendentes[0].liberar(w.PECAS);
      w.pendentes[1].liberar([{ ...w.PECAS[0], id: 601 }]);
    });
    await pagina.waitForTimeout(200);
    assert.deepEqual(await pagina.evaluate(() => ((window as any).formularios ?? []).map((f: any) => f.titulo)), [], 'B não abre o "Novo pedido" de A');
  } finally {
    await navegador.close();
  }
  ({ navegador, pagina } = await montar(pw));
  try {
    await pagina.goto(`${ORIGEM}/portal_corretor/estudio?criar=post`);
    await pagina.waitForTimeout(200);
    assert.deepEqual(await pagina.evaluate(() => ((window as any).formularios ?? []).map((f: any) => f.titulo)), ['Novo pedido'], 'sem troca, o Novo post abre');
  } finally {
    await navegador.close();
  }
});

test('Estúdio no Chromium: aprovar em A que dá certo depois da troca para B não mostra sucesso, não recarrega e não deixa nada de A', async (t) => {
  const pw = playwright();
  if (!pw) return t.skip('Playwright não instalado neste ambiente');
  const { navegador, pagina } = await montar(pw);
  try {
    await pagina.goto(`${ORIGEM}/portal_corretor/estudio?pedido=11`);
    await pagina.waitForTimeout(120);
    await pagina.evaluate(POR_CONTA);
    await pagina.evaluate(() => {
      const w = window as any;
      w.SEGURAR_APROVAR_OK = true;
      const div = document.createElement('div');
      w.render(w.cartaoVivo(w.PECAS[1]), div); // peça 12: o principal é "Aprovar"
      w.principais(div)[0].click();
    });
    await pagina.waitForTimeout(120);
    assert.equal(await pagina.evaluate(() => (window as any).aprovacoes?.length), 1, 'a aprovação de A está em voo');
    await pagina.evaluate(() => (window as any).trocar(200));
    await pagina.waitForTimeout(150);
    const antes: any = await pagina.evaluate(() => ({ url: location.search, cargas: (window as any).chamadas.filter((c: string) => c === 'GET /estudio/pecas').length }));
    await pagina.evaluate(() => (window as any).aprovacoes[0]());
    await pagina.waitForTimeout(250);
    const depois: any = await pagina.evaluate(() => {
      const w = window as any;
      return {
        url: location.search,
        cargas: w.chamadas.filter((c: string) => c === 'GET /estudio/pecas').length,
        avisos: w.avisos ?? [],
        alertas: w.alertas ?? [],
        pedidos: (((window as any).$q('urbi-lista') as any)?.itens ?? []).map((x: any) => x.id),
        feed: (((window as any).$q('urbi-feed') as any)?.itens ?? []).map((m: any) => m.id),
        tela: w.profundo((window as any).$q('urbi-3-colunas')),
      };
    });
    assert.deepEqual(depois.avisos, [], 'nenhum "Peça aprovada." de A em B');
    assert.deepEqual(depois.alertas, []);
    assert.equal(depois.cargas, antes.cargas, 'nenhuma recarga disparada por A em B');
    assert.equal(depois.url, antes.url);
    assert.doesNotMatch(depois.url, /pedido=|item=/, 'o pedido aberto em A não fica na URL de B');
    assert.deepEqual(depois.pedidos, [601], 'só as peças de B');
    assert.deepEqual(depois.feed, [], 'nenhum pedido de A aberto em B');
    assert.doesNotMatch(depois.tela, /Casa no Lago Sul|Não encontrado/);
  } finally {
    await navegador.close();
  }
});

test('Estúdio no Chromium: remover uma peça nunca leva a "Não encontrado"', async (t) => {
  const pw = playwright();
  if (!pw) return t.skip('Playwright não instalado neste ambiente');
  const { navegador, pagina } = await montar(pw);
  const removerPeca = (id: number) =>
    pagina.evaluate((id: number) => {
      const w = window as any;
      const div = document.createElement('div');
      w.render(w.cartaoVivo(w.PECAS.find((p: any) => p.id === id)), div);
      const item = [...div.querySelectorAll('urbi-dropdown-item')].find((e) => e.textContent!.trim() === 'Remover')!;
      item.dispatchEvent(new CustomEvent('urbi:dropdown-select'));
    }, id);
  const ler = () =>
    pagina.evaluate(() => {
      const w = window as any;
      return {
        url: location.search,
        centro: [...(window as any).$qa('urbi-3-colunas > [slot="centro"]')].map((e) => w.profundo(e)).join(' '),
        feed: (((window as any).$q('urbi-feed') as any)?.itens ?? []).map((m: any) => m.id),
        avisos: w.avisos ?? [],
      };
    });
  try {
    // Pedido de 3 peças (11, 12, 13) aberto pelo id da primeira; remove a primeira.
    await pagina.goto(`${ORIGEM}/portal_corretor/estudio?pedido=11`);
    await pagina.waitForTimeout(120);
    await removerPeca(11);
    await pagina.waitForTimeout(200);
    let r: any = await ler();
    assert.deepEqual(r.feed, [-12, 12, 13], 'o centro segue no pedido, com as 2 peças que sobraram');
    assert.equal(r.url, '?pedido=12');
    assert.doesNotMatch(r.centro, /Não encontrado|não está na sua conta/);
    assert.deepEqual(r.avisos, ['Peça removida.']);

    // Pedido de uma peça só, aberto pelo ?item=; remove a única.
    await pagina.evaluate(() => {
      const w = window as any;
      w.PECAS.push({ ...w.PECAS[0], id: 30, pedido: 'Visita aberta', objetivo: 'visita_aberta', formato: 'story', criado_em: new Date(Date.now() - 5 * 86400e3).toISOString() });
      history.replaceState(null, '', '/portal_corretor/estudio?item=30');
      w.recarregar();
    });
    await pagina.waitForTimeout(150);
    assert.deepEqual((await ler()).feed, [-30, 30]);
    await removerPeca(30);
    await pagina.waitForTimeout(200);
    r = await ler();
    assert.doesNotMatch(r.centro, /Não encontrado|não está na sua conta/, 'sem "Não encontrado" depois de remover a única');
    assert.doesNotMatch(r.url, /pedido=|item=/, 'volta a nenhum pedido escolhido');
    assert.deepEqual(r.feed, []);
    assert.match(r.centro, /Escolha um pedido na lista/);
  } finally {
    await navegador.close();
  }
});

// Entrada a frio (recarregar, link direto, nova aba): o Estúdio é aberto antes de o contexto da app
// chegar, como no app (frontend/index.ts: a tela só é desenhada, e o Estúdio só nasce, depois do contexto).
const formulariosAbertos = (p: any) => p.evaluate(() => ((window as any).formularios ?? []).map((f: any) => f.titulo));
const lerPedido = (p: any) =>
  p.evaluate(() => {
    const w = window as any;
    return {
      url: location.search,
      centro: [...(window as any).$qa('urbi-3-colunas > [slot="centro"]')].map((e) => w.profundo(e)).join(' '),
      feed: (((window as any).$q('urbi-feed') as any)?.itens ?? []).map((m: any) => m.id),
    };
  });
async function entrarAFrio(pw: any, endereco: string) {
  const m = await montar(pw);
  await m.pagina.addInitScript(() => ((window as any).FRIO = true));
  await m.pagina.goto(`${ORIGEM}/portal_corretor${endereco}`);
  await m.pagina.waitForTimeout(80);
  await m.pagina.evaluate(POR_CONTA);
  assert.equal(await m.pagina.evaluate(() => (window as any).$q('urbi-3-colunas')), null, 'sem contexto a tela não é desenhada');
  await m.pagina.evaluate(() => (window as any).chegarContexto());
  await m.pagina.waitForTimeout(200);
  return m;
}

test('Estúdio no Chromium: entrada a frio com ?criar=post (o contexto chega depois) abre o Novo pedido', async (t) => {
  const pw = playwright();
  if (!pw) return t.skip('Playwright não instalado neste ambiente');
  const { navegador, pagina } = await entrarAFrio(pw, '/estudio?criar=post');
  try {
    assert.deepEqual(await formulariosAbertos(pagina), ['Novo pedido']);
  } finally {
    await navegador.close();
  }
});

test('Estúdio no Chromium: entrada a frio com ?pedido= (o contexto chega depois) abre o pedido, sem "Não encontrado"', async (t) => {
  const pw = playwright();
  if (!pw) return t.skip('Playwright não instalado neste ambiente');
  const { navegador, pagina } = await entrarAFrio(pw, '/estudio?pedido=11');
  try {
    const r: any = await lerPedido(pagina);
    assert.equal(r.url, '?pedido=11', 'o pedido da URL fica');
    assert.deepEqual(r.feed, [-11, 11, 12, 13], 'o pedido 11 abre');
    assert.doesNotMatch(r.centro, /Não encontrado|não está na sua conta/);
  } finally {
    await navegador.close();
  }
});

test('Estúdio no Chromium: depois da troca, link do Estúdio aberto já em B (?pedido=, ?criar=post) fica; a troca seguinte ainda limpa', async (t) => {
  const pw = playwright();
  if (!pw) return t.skip('Playwright não instalado neste ambiente');
  const { navegador, pagina } = await entrarAFrio(pw, '/estudio?pedido=11');
  try {
    assert.deepEqual((await lerPedido(pagina)).feed, [-11, 11, 12, 13], 'em A o pedido 11 está aberto');
    // (c) O ramo "fica" pelo caminho real: A no Estúdio, sai para outra tela, troca para B lá e abre um
    // link do Estúdio de B: o pedido de B abre.
    await pagina.evaluate(() => {
      (window as any).sairDoEstudio();
      (window as any).trocar(200);
      (window as any).abrirEstudio('/estudio?pedido=601');
    });
    await pagina.waitForTimeout(200);
    const b: any = await lerPedido(pagina);
    assert.equal(b.url, '?pedido=601', 'o link de B fica');
    assert.deepEqual(b.feed, [-601, 601], 'o pedido de B abre');
    assert.doesNotMatch(b.centro, /Não encontrado|não está na sua conta/);

    // (d) Já em B depois da troca, "Novo post" pelo menu Criar abre em B.
    await pagina.evaluate(() => (window as any).abrirEstudio('/estudio?criar=post'));
    await pagina.waitForTimeout(200);
    assert.deepEqual(await formulariosAbertos(pagina), ['Novo pedido'], 'em B o Novo post abre');

    // A troca B→A ainda limpa o que era de B.
    await pagina.evaluate(() => (window as any).abrirEstudio('/estudio?pedido=601'));
    await pagina.waitForTimeout(150);
    await pagina.evaluate(() => (window as any).trocar(100));
    await pagina.waitForTimeout(200);
    const a: any = await lerPedido(pagina);
    assert.doesNotMatch(a.url, /pedido=|item=/, 'o pedido de B sai na troca para A');
    assert.deepEqual(a.feed, []);
  } finally {
    await navegador.close();
  }
});

// ---------- Tabela de transições (decisão de desenho: o estado é da instância da tela) ----------
//
// Um caso por linha. Em todos, a tela final não está em "carregando" e não mostra nada da conta (ou da
// instância) anterior. Ids das peças: A (100) tem 11 a 20; B (200) tem 601; o que uma instância morta
// recebe traz o texto "DA CONTA A" / "INSTANCIA ANTIGA" para a asserção pegar qualquer vazamento.

const telaFinal = (p: any) =>
  p.evaluate(() => {
    const w = window as any;
    const lista = w.$q('urbi-lista');
    return {
      texto: w.profundo(w.app.shadowRoot),
      carregando: w.$qa('urbi-loading').length,
      url: location.search,
      pedidos: (lista?.itens ?? []).map((x: any) => x.id),
      feed: (w.$q('urbi-feed')?.itens ?? []).map((m: any) => m.id),
      avisos: w.avisos ?? [],
      alertas: w.alertas ?? [],
      formularios: (w.formularios ?? []).map((f: any) => f.titulo),
    };
  });

function semCarregarNemAnterior(r: any, linha: string, anterior: RegExp = /DA CONTA A|INSTANCIA ANTIGA|Casa no Lago Sul|Lançamento da casa/) {
  assert.equal(r.carregando, 0, `${linha}: a tela final não está em "carregando"`);
  assert.doesNotMatch(r.texto, /Carregando/, `${linha}: nenhum "Carregando…" na tela final`);
  assert.doesNotMatch(r.texto, anterior, `${linha}: nada da conta (ou instância) anterior`);
}

const liberar = (p: any, i: number, pecas: 'A' | 'B' | 'ANTIGA' | 'TODAS') =>
  p.evaluate(
    ([i, pecas]: [number, string]) => {
      const w = window as any;
      const dados =
        pecas === 'TODAS' ? w.PECAS
        : pecas === 'B' ? [{ ...w.PECAS[0], id: 601, pedido: 'DA CONTA B', titulo: 'Peça da conta B' }]
        : [{ ...w.PECAS[0], id: 501, pedido: pecas === 'A' ? 'DA CONTA A' : 'INSTANCIA ANTIGA', titulo: pecas === 'A' ? 'DA CONTA A' : 'INSTANCIA ANTIGA' }];
      w.pendentes[i].liberar(dados);
    },
    [i, pecas],
  );
const pendentes = (p: any) => p.evaluate(() => ((window as any).pendentes ?? []).map((x: any) => x.conta));

test('transição 1/8: A → B durante a carga inicial', async (t) => {
  const pw = playwright();
  if (!pw) return t.skip('Playwright não instalado neste ambiente');
  const { navegador, pagina } = await montar(pw);
  try {
    await pagina.addInitScript(() => ((window as any).SEGURAR = true));
    await pagina.goto(`${ORIGEM}/portal_corretor/estudio`);
    await pagina.waitForTimeout(120);
    assert.deepEqual(await pendentes(pagina), [100]);
    // A troca mata a instância de A NA HORA (antes do redesenho): o `keyed` do lit não a desliga sozinho.
    const morreuNaTroca = await pagina.evaluate(() => {
      const w = window as any;
      w.instanciaA = w.estudio;
      w.trocar(200);
      return w.instanciaA.vivo;
    });
    assert.equal(morreuNaTroca, false, 'a instância de A deixa de estar viva no momento da troca');
    await pagina.waitForTimeout(120);
    assert.deepEqual(await pendentes(pagina), [100, 200], 'a instância de B nasce e carrega');
    assert.equal(await pagina.evaluate(() => (window as any).estudio !== (window as any).instanciaA && (window as any).estudio.vivo), true, 'B é outra instância, viva');
    // B responde primeiro; A responde depois, para a instância morta.
    await liberar(pagina, 1, 'B');
    await pagina.waitForTimeout(80);
    await liberar(pagina, 0, 'A');
    await pagina.waitForTimeout(150);
    const r: any = await telaFinal(pagina);
    semCarregarNemAnterior(r, 'A → B na carga inicial');
    assert.deepEqual(r.pedidos, [601]);
  } finally {
    await navegador.close();
  }
});

test('transição 2/8: A → B com um pedido em voo', async (t) => {
  const pw = playwright();
  if (!pw) return t.skip('Playwright não instalado neste ambiente');
  const { navegador, pagina } = await montar(pw);
  try {
    await pagina.goto(`${ORIGEM}/portal_corretor/estudio`);
    await pagina.waitForTimeout(120);
    await pagina.evaluate(POR_CONTA);
    await pagina.evaluate(() => {
      const w = window as any;
      w.SEGURAR_CRIAR = true;
      w.urbiVerso.formulario = async () => ({ imovel_id: '5', pedido: '' });
      (w.$qa('urbi-3-colunas > [slot="esquerda"] urbi-grid > urbi-botao')[2] as HTMLElement).click();
    });
    await pagina.waitForTimeout(120);
    assert.equal(await pagina.evaluate(() => (window as any).criacoes.length), 1, 'a criação de A está em voo');
    await pagina.evaluate(() => (window as any).trocar(200));
    await pagina.waitForTimeout(150);
    await pagina.evaluate(() => (window as any).criacoes[0]());
    await pagina.waitForTimeout(200);
    const r: any = await telaFinal(pagina);
    semCarregarNemAnterior(r, 'A → B com pedido em voo');
    assert.deepEqual(r.pedidos, [601]);
    assert.doesNotMatch(r.url, /pedido=|900/, 'a URL de B não ganha o pedido criado em A');
    assert.deepEqual(r.avisos, [], 'nenhum "peça criada" de A em B');
    assert.doesNotMatch(r.texto, /Escrevendo os textos/, 'nada "trabalhando" herdado');
  } finally {
    await navegador.close();
  }
});

test('transição 3/8: A → B com um aprovar em voo', async (t) => {
  const pw = playwright();
  if (!pw) return t.skip('Playwright não instalado neste ambiente');
  const { navegador, pagina } = await montar(pw);
  try {
    await pagina.goto(`${ORIGEM}/portal_corretor/estudio?pedido=11`);
    await pagina.waitForTimeout(120);
    await pagina.evaluate(POR_CONTA);
    await pagina.evaluate(() => {
      const w = window as any;
      w.SEGURAR_APROVAR_OK = true;
      const div = document.createElement('div');
      w.render(w.cartaoVivo(w.PECAS[1]), div); // peça 12: o principal é "Aprovar"
      w.principais(div)[0].click();
    });
    await pagina.waitForTimeout(120);
    assert.equal(await pagina.evaluate(() => (window as any).aprovacoes?.length), 1, 'o aprovar de A está em voo');
    await pagina.evaluate(() => (window as any).trocar(200));
    await pagina.waitForTimeout(150);
    const cargas = await pagina.evaluate(() => (window as any).chamadas.filter((c: string) => c === 'GET /estudio/pecas').length);
    await pagina.evaluate(() => (window as any).aprovacoes[0]());
    await pagina.waitForTimeout(200);
    const r: any = await telaFinal(pagina);
    semCarregarNemAnterior(r, 'A → B com aprovar em voo');
    assert.deepEqual(r.pedidos, [601]);
    assert.deepEqual(r.feed, []);
    assert.deepEqual(r.avisos, [], 'nenhum "Peça aprovada." de A em B');
    assert.equal(await pagina.evaluate(() => (window as any).chamadas.filter((c: string) => c === 'GET /estudio/pecas').length), cargas, 'a instância morta não recarrega');
  } finally {
    await navegador.close();
  }
});

test('transição 4/8: A → B com o ?pedido= de A na URL', async (t) => {
  const pw = playwright();
  if (!pw) return t.skip('Playwright não instalado neste ambiente');
  const { navegador, pagina } = await montar(pw);
  try {
    await pagina.goto(`${ORIGEM}/portal_corretor/estudio?pedido=11&etapa=arte`);
    await pagina.waitForTimeout(120);
    await pagina.evaluate(POR_CONTA);
    assert.deepEqual((await telaFinal(pagina)).feed, [-11, 11, 12, 13]);
    await pagina.evaluate(() => (window as any).trocar(200));
    await pagina.waitForTimeout(200);
    const r: any = await telaFinal(pagina);
    semCarregarNemAnterior(r, 'A → B com ?pedido= de A');
    assert.equal(r.url, '?etapa=arte', 'ao nascer, a instância de B limpa o ?pedido= que não é dela; a etapa fica');
    assert.doesNotMatch(r.texto, /Não encontrado|não está na sua conta/);
    assert.deepEqual(r.feed, []);
    assert.equal(await pagina.evaluate(() => (window as any).$q('urbi-3-colunas').getAttribute('painel-ativo')), 'esquerda');
  } finally {
    await navegador.close();
  }
});

test('transição 5/8: frio (sem contexto) → A', async (t) => {
  const pw = playwright();
  if (!pw) return t.skip('Playwright não instalado neste ambiente');
  const { navegador, pagina } = await entrarAFrio(pw, '/estudio?pedido=11');
  try {
    const r: any = await telaFinal(pagina);
    // Não há conta anterior: o que não pode aparecer é a conta B nem o estado "carregando".
    semCarregarNemAnterior(r, 'frio → A', /DA CONTA B|Peça da conta B/);
    assert.equal(r.url, '?pedido=11', 'o pedido do link é de A e fica');
    assert.deepEqual(r.feed, [-11, 11, 12, 13]);
  } finally {
    await navegador.close();
  }
});

test('transição 6/8: A → sem conta (com uma carga de A em voo)', async (t) => {
  const pw = playwright();
  if (!pw) return t.skip('Playwright não instalado neste ambiente');
  const { navegador, pagina } = await montar(pw);
  try {
    await pagina.goto(`${ORIGEM}/portal_corretor/estudio?pedido=11`);
    await pagina.waitForTimeout(120);
    await pagina.evaluate(() => {
      const w = window as any;
      w.SEGURAR = true;
      w.recarregar();
    });
    await pagina.waitForTimeout(60);
    await pagina.evaluate(() => (window as any).ficarSemConta());
    await pagina.waitForTimeout(100);
    await liberar(pagina, 0, 'A');
    await pagina.waitForTimeout(150);
    const r: any = await telaFinal(pagina);
    semCarregarNemAnterior(r, 'A → sem conta');
    assert.match(r.texto, /Você ainda não está em nenhuma conta/, 'o estado vazio de "sem conta"');
    assert.equal(await pagina.evaluate(() => (window as any).$q('urbi-3-colunas')), null, 'nada da moldura de A fica');
    assert.deepEqual(r.avisos, []);
  } finally {
    await navegador.close();
  }
});

test('transição 7/8: sair do Estúdio e voltar (e ir a outra app e voltar) com operação em voo', async (t) => {
  const pw = playwright();
  if (!pw) return t.skip('Playwright não instalado neste ambiente');
  const { navegador, pagina } = await montar(pw);
  try {
    await pagina.goto(`${ORIGEM}/portal_corretor/estudio?pedido=11`);
    await pagina.waitForTimeout(120);
    // Em voo: um aprovar e uma recarga desta instância.
    await pagina.evaluate(() => {
      const w = window as any;
      w.SEGURAR_APROVAR_OK = true;
      const div = document.createElement('div');
      w.render(w.cartaoVivo(w.PECAS[1]), div);
      w.principais(div)[0].click();
      w.SEGURAR = true;
      w.recarregar();
    });
    await pagina.waitForTimeout(80);
    assert.deepEqual(await pendentes(pagina), [100]);
    // Sai para outra tela do app e volta pelo endereço do Estúdio: a instância nova carrega (em voo).
    await pagina.evaluate(() => {
      const w = window as any;
      w.instanciaAntiga = w.estudio;
      w.sairDoEstudio();
    });
    await pagina.waitForTimeout(80);
    assert.equal(await pagina.evaluate(() => (window as any).instanciaAntiga.vivo), false, 'sair do Estúdio encerra a instância');
    await pagina.evaluate(() => (window as any).abrirEstudio('/estudio?pedido=11'));
    await pagina.waitForTimeout(80);
    assert.deepEqual(await pendentes(pagina), [100, 100], 'a instância nova carrega');
    // A instância antiga recebe tudo agora: a carga e o aprovar. Nada disso aparece.
    await liberar(pagina, 0, 'ANTIGA');
    await pagina.evaluate(() => (window as any).aprovacoes[0]());
    await pagina.waitForTimeout(120);
    assert.equal((await telaFinal(pagina)).carregando, 1, 'a instância nova ainda espera a SUA carga');
    await liberar(pagina, 1, 'TODAS');
    await pagina.waitForTimeout(150);
    let r: any = await telaFinal(pagina);
    semCarregarNemAnterior(r, 'sair do Estúdio e voltar', /INSTANCIA ANTIGA/);
    assert.deepEqual(r.feed, [-11, 11, 12, 13]);
    assert.deepEqual(r.avisos, [], 'nenhum "Peça aprovada." da instância que saiu');

    // Outra app: o app sai do DOM com uma carga em voo e volta (sem redesenhar): instância nova.
    await pagina.evaluate(() => (window as any).recarregar());
    await pagina.waitForTimeout(60);
    await pagina.evaluate(() => {
      const w = window as any;
      w.instanciaAntiga = w.estudio;
      w.irParaOutraApp();
    });
    assert.equal(await pagina.evaluate(() => (window as any).instanciaAntiga.vivo), false, 'ir a outra app encerra a instância (disconnected)');
    await liberar(pagina, 2, 'ANTIGA');
    await pagina.waitForTimeout(80);
    await pagina.evaluate(() => (window as any).voltarDaOutraApp());
    await pagina.waitForTimeout(120);
    assert.deepEqual(await pendentes(pagina), [100, 100, 100, 100], 'a volta é uma instância nova, que carrega');
    await liberar(pagina, 3, 'TODAS');
    await pagina.waitForTimeout(150);
    r = await telaFinal(pagina);
    semCarregarNemAnterior(r, 'outra app e volta', /INSTANCIA ANTIGA/);
    assert.deepEqual(r.feed, [-11, 11, 12, 13]);
  } finally {
    await navegador.close();
  }
});

test('transição 8/8: "Novo post" a frio', async (t) => {
  const pw = playwright();
  if (!pw) return t.skip('Playwright não instalado neste ambiente');
  const { navegador, pagina } = await entrarAFrio(pw, '/estudio?criar=post');
  try {
    await pagina.evaluate(() => (window as any).desenhar());
    await pagina.waitForTimeout(100);
    const r: any = await telaFinal(pagina);
    semCarregarNemAnterior(r, '"Novo post" a frio', /DA CONTA B/);
    assert.deepEqual(r.formularios, ['Novo pedido'], 'o Novo pedido abre uma vez, depois da primeira carga');
    assert.doesNotMatch(r.url, /criar=/, 'o pedido do menu Criar sai da URL');
  } finally {
    await navegador.close();
  }
});
