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
import { renderEstudio, cartaoPeca, _recarregarEstudio } from './frontend/telas/estudio';
window.cartaoPeca = cartaoPeca;
window.recarregar = _recarregarEstudio;
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
window.urbiVerso = {
  subRota: () => location.pathname.replace(/^\\/portal_corretor/, '') || '/',
  href: (s) => '/portal_corretor' + s,
  navegarSub: () => {},
  usuario: () => ({ id: 1, nome: 'Marina' }),
  contexto: () => ({ conta: { resolucao: 'escopado', contas: [{ id: 100, nome: 'A' }, { id: 200, nome: 'B' }] } }),
  notificar: () => {},
  alertar: async () => {},
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
    if (caminho === '/estudio/pecas') return { dados: window.PECAS, total: window.PECAS.length, ia: window.IA ?? true };
    if (caminho === '/estudio/marca') return { creci: window.CRECI ?? null, logo_url: '/logo.png', foto_url: null, referencias: [{ id: 7, url: '/ref/7.jpg' }] };
    if (caminho === '/conexoes') return { instagram: window.IG === undefined ? { usuario: 'rafael.imoveis', ultimo_erro: null } : window.IG, disponivel: true };
    return {};
  },
};
const raiz = document.getElementById('raiz');
const desenhar = () => render(renderEstudio(desenhar), raiz);
window.desenhar = desenhar;
desenhar();
`;

const PROFUNDO = `
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
      const col = (slot: string) => document.querySelector(`urbi-3-colunas > [slot="${slot}"]`);
      const feed = document.querySelector('urbi-feed') as any;
      const lista = col('esquerda')!.querySelector('urbi-lista') as any;
      const rodapes = (feed?.itens ?? []).map((m: any) => {
        const div = document.createElement('div');
        w.render(feed.renderRodape(m), div);
        return { id: m.id, autor: m.autorNome, principais: w.principais(div).length, texto: w.profundo(div) };
      });
      return {
        trilhoAtivo: (document.querySelector('urbi-trilho-atalhos') as any)?.itens.find((i: any) => i.ativo)?.id,
        esquerda: w.profundo(col('esquerda')),
        rapidos: [...col('esquerda')!.querySelectorAll('urbi-grid > urbi-botao')].map((b) => w.profundo(b)),
        pedidos: lista.itens.map((x: any) => x.id),
        ativo: lista.itens.filter((x: any) => lista.itemAtivo(x)).map((x: any) => x.id),
        centroFilhos: [...document.querySelectorAll('urbi-3-colunas > [slot="centro"]')].map((e) => e.localName),
        feedPai: feed?.parentElement?.localName,
        feedSlot: feed?.getAttribute('slot'),
        redatorPai: document.querySelector('urbi-redator')?.parentElement?.localName,
        redatorSlotPai: document.querySelector('urbi-redator')?.parentElement?.getAttribute('slot'),
        feedExpandir: feed?.hasAttribute('expandir'),
        rodapes,
        direita: w.profundo(col('direita')),
        estilos: document.querySelectorAll('style').length,
        chamadas: w.chamadas.slice(),
      };
    });
    assert.equal(r.trilhoAtivo, '/estudio');
    assert.match(r.esquerda, /Estúdio ◎ @rafael\.imoveis conectado/);
    assert.deepEqual(r.rapidos, ['Lançamento', 'Baixou o preço', 'Vendido', 'Visita aberta']);
    assert.deepEqual(r.pedidos, [20, 11], 'Seus pedidos: o mais recente primeiro, um por envio');
    assert.deepEqual(r.ativo, [11], 'o pedido aberto fica marcado');
    assert.match(r.esquerda, /Todas · 4/);
    // Centro: o feed (expandir) e o compositor; sem faixa com IA liberada e Instagram conectado.
    // Contrato do feed (ui-componentes-conteudo.md § Onde pôr o par feed + redator): o `urbi-feed[expandir]`
    // é filho DIRETO do `urbi-3-colunas` no slot do centro; o redator vai num `urbi-hospedeiro` do mesmo slot.
    assert.deepEqual(r.centroFilhos, ['urbi-hospedeiro', 'urbi-feed', 'urbi-hospedeiro']);
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
      const lista = document.querySelector('urbi-3-colunas > [slot="esquerda"] urbi-lista') as any;
      return { ativo: lista.itens.filter((x: any) => lista.itemAtivo(x)).map((x: any) => x.id), feed: (document.querySelector('urbi-feed') as any).itens.map((m: any) => m.id) };
    });
    assert.deepEqual(s, { ativo: [20], feed: [-20, 20] });

    // Pedido que não existe (ou de outra conta): "Não encontrado"; o compositor fica.
    await pagina.evaluate(() => {
      history.replaceState(null, '', '/portal_corretor/estudio?pedido=999');
      (window as any).desenhar();
    });
    s = await pagina.evaluate(() => {
      const w = window as any;
      const centro = document.querySelector('urbi-3-colunas > [slot="centro"]')!;
      return { filhos: [...centro.children].map((e) => e.localName), texto: w.profundo(centro) };
    });
    assert.deepEqual(s.filhos, ['urbi-estado-vazio', 'urbi-redator']);
    assert.match(s.texto, /Não encontrado/);
    assert.deepEqual(await pagina.evaluate(() => [...document.querySelectorAll('urbi-3-colunas > [slot="centro"]')].map((e) => e.localName)), ['urbi-hospedeiro'], 'sem pedido aberto o centro segue embrulhado num bloco só');
    assert.equal(await pagina.evaluate(() => document.querySelector('urbi-3-colunas')!.getAttribute('painel-ativo')), 'centro', 'id que não acha pedido: o celular abre no centro');
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
      const centro = document.querySelector('urbi-3-colunas > [slot="centro"]')!;
      return {
        filhos: [...centro.children].map((e) => e.localName + (e.getAttribute('variante') ? `:${e.getAttribute('variante')}` : '')),
        texto: w.profundo(centro),
        esquerda: w.profundo(document.querySelector('urbi-3-colunas > [slot="esquerda"]')),
        painel: document.querySelector('urbi-3-colunas')!.getAttribute('painel-ativo'),
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
        const lista = document.querySelector('urbi-lista') as any;
        return { texto: w.profundo(document.querySelector('urbi-inbox')), pedidos: (lista?.itens ?? []).map((x: any) => x.id), pendentes: w.pendentes.map((p: any) => p.conta), chamadas: w.chamadas.filter((c: string) => c === 'GET /estudio/pecas').length };
      });
    let r: any = await lido();
    assert.deepEqual(r.pendentes, [100]);
    assert.match(r.texto, /Carregando/);

    // (a) a conta muda para B com A em voo: carrega B; A responde e é descartada; nada de A na tela.
    await pagina.evaluate(() => {
      const w = window as any;
      localStorage.setItem('portal_corretor:conta', '200');
      w.desenhar();
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
