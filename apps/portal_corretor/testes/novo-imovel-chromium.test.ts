import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

// Novo imóvel em 4 passos (B5 parte 2, issue #94: P07 e M3) no DOM de verdade (Chromium), com uma api
// falsa: tipo e cidade antes da primeira foto, o rascunho criado na primeira foto, a leitura da IA que
// preenche as características e sugere a capa, o obrigatório vazio destacado, o salvar por passo, a
// retomada pelo `?item=` e o imóvel de outra conta como "não encontrado". Os primitivos `urbi-*` são
// elementos sem registro: o teste mede a estrutura e os dados que a tela entrega a eles. Sem Playwright
// instalado (o CI do kit não traz navegador), pula.

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
import { renderNovoImovel } from './frontend/telas/novo-imovel';
const AMBIENTES = ['varanda', 'fachada'];
// Um rascunho já salvo pode vir semeado (window.SEMENTE) antes da tela abrir.
const banco = window.SEMENTE ?? { imovel: null, midias: [], autorizacoes: [] };
const chamadas = [];
window.chamadas = chamadas;
window.banco = banco;
window.avisos = [];
window.urbiVerso = {
  subRota: () => location.pathname.replace(/^\\/portal_corretor/, '') || '/',
  href: (s) => '/portal_corretor' + s,
  navegarSub: (s) => history.pushState(null, '', '/portal_corretor' + s),
  usuario: () => ({ id: 1, nome: 'Marina' }),
  contexto: () => ({ conta: { resolucao: 'escopado', contas: [{ id: 100, nome: 'A' }], contaEscrita: 100 } }),
  notificar: (m) => window.avisos.push(m),
  alertar: async (a) => window.avisos.push(a.titulo + ': ' + a.mensagem),
  confirmar: async () => true,
  api: async (rota, op = {}) => {
    const metodo = op.method ?? 'GET';
    const corpo = typeof op.body === 'string' ? JSON.parse(op.body) : null;
    chamadas.push(metodo + ' ' + rota);
    const [caminho] = rota.split('?');
    if (caminho === '/imoveis/ia') return { fotos: true, conteudo: false };
    if (caminho.startsWith('/dados/portal_corretor/imovel_midias/__upload')) return { upload_id: 500 + chamadas.length };
    if (caminho === '/imoveis' && metodo === 'POST') {
      // Como a rota: sem tipo e cidade, só o rascunho vazio (P07: fotos primeiro), que nasce "outro".
      if (!corpo.rascunho && (!corpo.tipo || !corpo.cidade)) throw Object.assign(new Error('Confira o imóvel.'), { status: 422 });
      banco.imovel = { id: 7, codigo: 'IM-0007', situacao: 'rascunho', publicado_pagina: false, ...corpo, tipo: corpo.tipo || 'outro' };
      return banco.imovel;
    }
    const m = caminho.match(/^\\/imoveis\\/(\\d+)(\\/.*)?$/);
    // Imóvel de outra conta: a rota responde 404 (o RLS não devolve a linha).
    if (m && (!banco.imovel || Number(m[1]) !== banco.imovel.id)) throw Object.assign(new Error('Imóvel não encontrado.'), { status: 404 });
    const resto = m && m[2];
    if (m && !resto && metodo === 'GET') {
      const fotos = banco.midias.filter((x) => x.tipo === 'foto');
      return { imovel: banco.imovel, qualidade: { nota: 0, faltas: [] }, autorizacao_vigente: false, fotos_publicas: fotos.length,
        midias: banco.midias.map((x) => ({ ...x, url: 'https://img/' + x.id })), autorizacoes: banco.autorizacoes };
    }
    if (m && !resto && metodo === 'PATCH') {
      if (window.gancho) await window.gancho(corpo);
      if (corpo.publicado_pagina === true) throw Object.assign(new Error('Para anunciar, anexe a autorização.'), { status: 409 });
      Object.assign(banco.imovel, corpo);
      return banco.imovel;
    }
    if (resto === '/contexto') return { combinam: [{ id: 1 }, { id: 2 }] };
    if (resto === '/midias' && metodo === 'POST') {
      const nova = { id: 20 + banco.midias.length, tipo: corpo.tipo, ordem: banco.midias.length, legenda: null, ia_ambiente: null, publica: corpo.tipo !== 'documento' };
      banco.midias.push(nova);
      return nova;
    }
    const a = resto && resto.match(/^\\/midias\\/(\\d+)\\/analisar$/);
    if (a) {
      const x = banco.midias.find((y) => y.id === Number(a[1]));
      x.ia_ambiente = AMBIENTES[banco.midias.indexOf(x) % AMBIENTES.length];
      return x;
    }
    if (resto === '/midias/ordem-sugerida') {
      banco.midias.sort((p, q) => (q.ia_ambiente === 'fachada') - (p.ia_ambiente === 'fachada'));
      return { ids: banco.midias.map((x) => x.id) };
    }
    return {};
  },
};
const raiz = document.getElementById('raiz');
const desenhar = () => render(renderNovoImovel(desenhar), raiz);
desenhar();
`;

/** Texto de um nó e das sombras abaixo dele, com os atributos que carregam texto (título, rótulo, erro). */
const PROFUNDO = `
window.profundo = (no) => {
  if (!no) return '';
  const partes = [];
  const andar = (n) => {
    if (n.nodeType === 3) partes.push(n.textContent);
    if (n.nodeType === 1) for (const a of ['titulo', 'label', 'texto', 'erro']) if (n.getAttribute(a)) partes.push(n.getAttribute(a));
    if (n.shadowRoot) andar(n.shadowRoot);
    for (const f of n.childNodes) andar(f);
  };
  andar(no);
  return partes.join(' ').replace(/\\s+/g, ' ').trim();
};
window.todos = (seletor) => {
  const achados = [];
  const fila = [document];
  while (fila.length) {
    const n = fila.shift();
    achados.push(...(n.querySelectorAll?.(seletor) ?? []));
    for (const e of n.querySelectorAll?.('*') ?? []) if (e.shadowRoot) fila.push(e.shadowRoot);
  }
  return achados;
};
// O urbi-lista não está registrado aqui: o texto dos itens sai do render_item que a tela entrega a ele.
window.itensDaLista = (lista) => (lista.itens ?? []).map((i) => {
  const d = document.createElement('div');
  window.render(lista.render_item(i), d);
  return window.profundo(d);
});
window.coluna = (tag) => {
  const el = document.querySelector(tag);
  const listas = [];
  const fila = el?.shadowRoot ? [el.shadowRoot] : [];
  while (fila.length) {
    const n = fila.shift();
    for (const e of n.querySelectorAll('*')) {
      if (e.localName === 'urbi-lista') listas.push(...window.itensDaLista(e));
      if (e.shadowRoot) fila.push(e.shadowRoot);
    }
  }
  return [window.profundo(el), ...listas].join(' | ');
};
window.disparar = (no, tipo, detail) => no.dispatchEvent(new CustomEvent(tipo, { detail, bubbles: true, composed: true }));
// Rodapé do passo: os botões do último filho do urbi-stack do centro, com o estado de cada um.
window.rodape = () => {
  const stack = document.querySelector('pc-novo-imovel-passo')?.shadowRoot?.querySelector('urbi-stack');
  return [...(stack?.lastElementChild?.querySelectorAll('urbi-botao') ?? [])].map((b) => b.textContent.trim() + (b.hasAttribute('desabilitado') ? ' [desabilitado]' : ''));
};
window.botao = (texto) => window.todos('urbi-botao').find((b) => b.textContent.trim().startsWith(texto));
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

test('Novo imóvel no Chromium: 4 passos, fotos primeiro, rascunho na primeira foto, IA nas características, obrigatório só depois de mexer, valores no formato brasileiro', async (t) => {
  const pw = playwright();
  if (!pw) return t.skip('Playwright não instalado neste ambiente');
  const { navegador, pagina } = await montar(pw);
  const espera = () => pagina.waitForTimeout(60);
  const ev = (fn: string) => pagina.evaluate(fn);
  try {
    await pagina.goto(`${ORIGEM}/portal_corretor/imoveis/novo`);
    await espera();
    // Passo 1: "Passo 1 de 4", o botão grande de fotos no topo e livre (P07 e M3: fotos primeiro); passos à esquerda; qualidade à direita.
    const inicio = await pagina.evaluate(() => {
      const w = window as any;
      return {
        centro: w.coluna('pc-novo-imovel-passo'),
        esquerda: w.coluna('pc-novo-imovel-passos'),
        direita: w.coluna('pc-novo-imovel-qualidade'),
        travado: w.todos('urbi-seletor-arquivo')[0].hasAttribute('desabilitado'),
        estilos: document.querySelectorAll('style, [style]').length + w.todos('style').length,
      };
    });
    assert.match(inicio.centro, /Fotos Passo 1 de 4/);
    assert.match(inicio.centro, /Tirar fotos ou escolher da galeria/);
    assert.match(inicio.centro, /Salvar rascunho/);
    assert.match(inicio.esquerda, /Fotos .*Dados .*Autorização .*Onde aparece/);
    assert.match(inicio.esquerda, /Nenhum passo pede CRECI/);
    assert.match(inicio.direita, /Qualidade agora · 0/);
    assert.equal(inicio.travado, false, 'as fotos vêm primeiro, sem pedir tipo e cidade');
    assert.doesNotMatch(inicio.centro, /Obrigatório/, 'a tela não abre em vermelho (#182, item 4)');
    assert.equal(inicio.estilos, 0, 'sem CSS próprio');

    // Estrutura (moldura.ts, D-114): urbi-3-colunas > 3 urbi-hospedeiro[expandir] nos slots
    // esquerda, centro e direita, nessa ordem, cada um com a sua coluna; o celular abre no centro (painel-ativo, M3).
    const estrutura = await pagina.evaluate(() => {
      const q = (s: string) => document.querySelector(s);
      const tres = q('#raiz > urbi-3-colunas') as HTMLElement;
      const filhos = [...(tres?.children ?? [])];
      const hosp = (slot: string) => q(`urbi-3-colunas > urbi-hospedeiro[slot="${slot}"][expandir]`) as HTMLElement | null;
      // Medida: os `urbi-*` não estão registrados aqui (inline, sem layout de colunas: o `left` fica igual nos três),
      // então o estável é: nenhuma coluna sobe acima da anterior (top não decrescente), a ordem no DOM e o `left` dentro do viewport.
      const caixas = ['esquerda', 'centro', 'direita'].map((s) => hosp(s)?.getBoundingClientRect());
      const lefts = caixas.map((c) => c?.left ?? NaN);
      const tops = caixas.map((c) => c?.top ?? NaN);
      return {
        filhos: filhos.map((f) => `${f.localName}[${f.getAttribute('slot')}]`),
        colunas: ['esquerda', 'centro', 'direita'].map((s) => hosp(s)?.firstElementChild?.localName),
        painel: tres?.getAttribute('painel-ativo'),
        rotulos: ['label-esquerda', 'label-centro', 'label-direita'].map((a) => tres?.getAttribute(a)),
        tops, crescente: tops.every((t, i) => Number.isFinite(t) && (i === 0 || t >= tops[i - 1])) &&
          [hosp('esquerda'), hosp('centro'), hosp('direita')].every((h, i, a) => i === 0 || !!(a[i - 1]!.compareDocumentPosition(h!) & Node.DOCUMENT_POSITION_FOLLOWING)),
        dentro: lefts.every((l) => l >= 0 && l < window.innerWidth),
      };
    });
    assert.deepEqual(estrutura.filhos, ['urbi-hospedeiro[esquerda]', 'urbi-hospedeiro[centro]', 'urbi-hospedeiro[direita]']);
    assert.deepEqual(estrutura.colunas, ['pc-novo-imovel-passos', 'pc-novo-imovel-passo', 'pc-novo-imovel-qualidade']);
    assert.equal(estrutura.painel, 'centro', 'o celular abre no centro');
    assert.deepEqual(estrutura.rotulos, ['Passos', 'Novo imóvel', 'Qualidade']);
    assert.equal(estrutura.crescente, true, 'esquerda, centro e direita na ordem, medidas no viewport de desktop');
    assert.equal(estrutura.dentro, true, 'as três colunas começam dentro do viewport');
    assert.deepEqual(await ev(`rodape()`), ['Voltar [desabilitado]', 'Salvar rascunho', 'Próximo: dados'], 'passo 1: sem volta');

    // A primeira foto cria o rascunho vazio (sem tipo nem cidade), a IA lê e sugere a capa.
    await ev(`disparar(todos('urbi-seletor-arquivo')[0], 'urbi:seletor-arquivo-change', {
      arquivos: [new File(['a'], 'varanda.jpg', { type: 'image/jpeg' }), new File(['b'], 'fachada.jpg', { type: 'image/jpeg' })] })`);
    await pagina.waitForTimeout(200);
    const fotos = await pagina.evaluate(() => {
      const w = window as any;
      return { centro: w.coluna('pc-novo-imovel-passo'), direita: w.coluna('pc-novo-imovel-qualidade'), url: location.search, chamadas: w.chamadas.filter((c: string) => !c.startsWith('GET')) };
    });
    assert.deepEqual(fotos.chamadas.filter((c: string) => /^POST \/imoveis(\/7\/midias)?$/.test(c)), ['POST /imoveis', 'POST /imoveis/7/midias', 'POST /imoveis/7/midias']);
    assert.ok(fotos.chamadas.includes('POST /imoveis/7/midias/ordem-sugerida'), 'ordem sugerida depois da leitura');
    assert.match(fotos.centro, /Capa sugerida Fachada/, 'a fachada vira a capa sugerida');
    assert.match(fotos.direita, /Li 2 foto\(s\)/);
    assert.match(fotos.direita, /varanda/);
    assert.match(fotos.direita, /avisar 2 cliente\(s\) que combinam/);
    assert.match(fotos.direita, /Depois de salvar posso:/);
    assert.match(fotos.centro, /A IA já entendeu/);
    assert.equal(fotos.url, '?item=7&passo=fotos');
    assert.equal(await ev(`window.banco.imovel.rascunho`), true, 'rascunho vazio: tipo e cidade vêm no passo 2');

    // Passo 2: as características vêm da leitura das fotos, com o rótulo; cidade apagada fica destacada e não avança.
    await ev(`botao('Próximo').click()`);
    await espera();
    const dados = await pagina.evaluate(() => {
      const w = window as any;
      const area = w.todos('urbi-textarea')[0];
      return { rotulo: area.getAttribute('label'), valor: area.getAttribute('valor'), url: location.search };
    });
    assert.equal(dados.rotulo, 'Características (separe por vírgula) · preenchido pela IA');
    assert.equal(dados.valor, 'varanda');
    assert.equal(dados.url, '?item=7&passo=dados');
    assert.deepEqual(await ev(`rodape()`), ['Voltar', 'Salvar rascunho', 'Próximo: autorização'], 'passo 2: Voltar habilitado');
    // Ninguém mexeu ainda: tipo e cidade vazios, sem vermelho; ao tentar avançar, o destaque aparece e não avança.
    assert.equal(await ev(`todos('urbi-input').find((i) => i.getAttribute('label') === 'Cidade').getAttribute('erro')`), '');
    await ev(`botao('Próximo').click()`);
    await espera();
    assert.match(await ev(`coluna('pc-novo-imovel-passo')`), /Dados Passo 2 de 4/, 'obrigatório vazio não avança');
    assert.equal(await ev(`todos('urbi-input').find((i) => i.getAttribute('label') === 'Cidade').getAttribute('erro')`), 'Obrigatório');
    // Preenchido, avança e salva os dados (PATCH) ao sair do passo. Preço e área em texto, no formato brasileiro (#185).
    await ev(`disparar(todos('urbi-select')[0], 'urbi:select-change', { valor: 'casa' })`);
    await ev(`disparar(todos('urbi-input').find((i) => i.getAttribute('label') === 'Cidade'), 'urbi:input-change', { valor: 'Brasília' })`);
    await ev(`disparar(todos('urbi-input').find((i) => i.getAttribute('label') === 'Preço (R$)'), 'urbi:input-change', { valor: '1.450.000' })`);
    await ev(`disparar(todos('urbi-input').find((i) => i.getAttribute('label') === 'Área útil (m²)'), 'urbi:input-change', { valor: '120,5' })`);
    await ev(`disparar(todos('urbi-input-numero').find((i) => i.getAttribute('label') === 'Quartos'), 'urbi:input-numero-change', { valor: 4 })`);
    await espera();
    await ev(`botao('Próximo').click()`);
    await espera();
    const autorizacao = await pagina.evaluate(() => {
      const w = window as any;
      return { centro: w.coluna('pc-novo-imovel-passo'), patch: w.chamadas.includes('PATCH /imoveis/7'), banco: w.banco.imovel };
    });
    assert.match(autorizacao.centro, /Autorização Passo 3 de 4/);
    assert.deepEqual(await ev(`rodape()`), ['Voltar', 'Salvar rascunho', 'Próximo: onde aparece'], 'passo 3');
    assert.match(autorizacao.centro, /Opcional para o rascunho/);
    assert.equal(autorizacao.patch, true);
    assert.equal(autorizacao.banco.quartos, 4);
    assert.equal(autorizacao.banco.caracteristicas, 'varanda');
    assert.equal(autorizacao.banco.tipo, 'casa');
    assert.equal(autorizacao.banco.preco, '1.450.000', 'o texto vai como digitado; o backend lê (validarImovel)');
    assert.equal(autorizacao.banco.area_util_m2, '120,5');

    // Passo 4: sem autorização, "Público" não fica escolhido; Concluir com "Só você" vai à ficha.
    await ev(`botao('Próximo').click()`);
    await espera();
    await ev(`disparar(todos('urbi-lista').at(-1), 'urbi:lista-click', { item: { id: 'publico' } })`);
    await espera();
    const onde = await ev(`coluna('pc-novo-imovel-passo')`);
    assert.match(onde, /Onde aparece Passo 4 de 4/);
    assert.deepEqual(await ev(`rodape()`), ['Voltar', 'Salvar rascunho', 'Concluir'], 'passo 4: Concluir no lugar do Próximo');
    assert.match(onde, /Só você · escolhido/);
    assert.match(onde, /Precisa da autorização assinada e vigente/);
    await ev(`botao('Concluir').click()`);
    await espera();
    assert.equal(await ev(`location.pathname + location.search`), '/portal_corretor/imoveis?item=7');

  } finally {
    await navegador.close();
  }
});

test('Novo imóvel no Chromium: retoma o rascunho pelo ?item= e o de outra conta é "não encontrado"', async (t) => {
  const pw = playwright();
  if (!pw) return t.skip('Playwright não instalado neste ambiente');
  const { navegador, pagina } = await montar(pw);
  try {
    // Um rascunho com fotos e dados, sem autorização: retoma em Autorização.
    await pagina.addInitScript(() => {
      (window as any).SEMENTE = {
        imovel: { id: 7, codigo: 'IM-0007', situacao: 'rascunho', publicado_pagina: false, tipo: 'casa', cidade: 'Brasília', quartos: 3 },
        // A varanda foi lida antes, e o corretor apagou "varanda" das características.
        midias: [{ id: 20, tipo: 'foto', ordem: 0, ia_ambiente: 'fachada' }, { id: 21, tipo: 'foto', ordem: 1, ia_ambiente: 'varanda' }],
        autorizacoes: [],
      };
    });
    await pagina.goto(`${ORIGEM}/portal_corretor/imoveis/novo?item=7`);
    await pagina.waitForTimeout(80);
    const retomado = await pagina.evaluate(() => ({ centro: (window as any).coluna('pc-novo-imovel-passo'), esquerda: (window as any).coluna('pc-novo-imovel-passos'), url: location.search }));
    assert.match(retomado.centro, /Autorização Passo 3 de 4/);
    assert.match(retomado.esquerda, /IM-0007 · rascunho/);
    assert.match(retomado.esquerda, /2 enviada\(s\)/);
    assert.equal(retomado.url, '?item=7&passo=autorizacao');
    // `?passo=` explícito vale mais que a retomada.
    await pagina.goto(`${ORIGEM}/portal_corretor/imoveis/novo?item=7&passo=dados`);
    await pagina.waitForTimeout(80);
    assert.match(await pagina.evaluate(() => (window as any).coluna('pc-novo-imovel-passo')), /Dados Passo 2 de 4/);
    const caracteristicas = await pagina.evaluate(() => {
      const area = (window as any).todos('urbi-textarea')[0];
      return { valor: area.getAttribute('valor') ?? '', rotulo: area.getAttribute('label') };
    });
    assert.equal(caracteristicas.valor, '', 'o que o corretor apagou não volta ao retomar');
    assert.doesNotMatch(caracteristicas.rotulo, /preenchido pela IA/);
    // Sem rascunho, `?passo=onde` abre em Dados.
    await pagina.goto(`${ORIGEM}/portal_corretor/imoveis/novo?passo=onde`);
    await pagina.waitForTimeout(80);
    assert.match(await pagina.evaluate(() => (window as any).coluna('pc-novo-imovel-passo')), /Dados Passo 2 de 4/);
    await pagina.goto(`${ORIGEM}/portal_corretor/imoveis/novo?item=99`);
    await pagina.waitForTimeout(80);
    const fora = await pagina.evaluate(() => (window as any).todos('urbi-estado-vazio').length);
    assert.ok(fora > 0, 'imóvel de outra conta: estado "não encontrado", sem passo');
    assert.doesNotMatch(await pagina.evaluate(() => (window as any).coluna('pc-novo-imovel-passo')), /Passo \d de 4/);
    assert.equal(await pagina.evaluate(() => (window as any).coluna('pc-novo-imovel-passos') + (window as any).coluna('pc-novo-imovel-qualidade')), '', 'esquerda e direita vazias');
  } finally {
    await navegador.close();
  }
});

test('Novo imóvel no Chromium: o que se digita com o PATCH em voo chega ao servidor antes de Salvar rascunho e Concluir saírem da tela', async (t) => {
  const pw = playwright();
  if (!pw) return t.skip('Playwright não instalado neste ambiente');
  for (const acao of ['Salvar rascunho', 'Concluir']) {
    const { navegador, pagina } = await montar(pw);
    try {
      await pagina.addInitScript(() => {
        const w = window as any;
        w.SEMENTE = {
          imovel: { id: 7, codigo: 'IM-0007', situacao: 'rascunho', publicado_pagina: false, tipo: 'casa', cidade: 'Brasília' },
          midias: [],
          autorizacoes: [],
        };
        // Segura o primeiro PATCH até o teste liberar; os seguintes passam direto.
        w.corposPatch = [];
        w.liberarPatch = null;
        let primeiro = true;
        w.gancho = async (corpo: unknown) => {
          w.corposPatch.push(JSON.stringify(corpo));
          if (!primeiro) return;
          primeiro = false;
          await new Promise((r) => (w.liberarPatch = r));
        };
      });
      await pagina.goto(`${ORIGEM}/portal_corretor/imoveis/novo?item=7&passo=dados`);
      await pagina.waitForTimeout(80);
      // O campo Cidade só existe no passo Dados: guarda o elemento, cujo ouvinte segue valendo nos outros passos.
      await pagina.evaluate(`window.campo = todos('urbi-input').find((i) => i.getAttribute('label') === 'Cidade'); 0`);
      const cidade = (v: string) => `disparar(window.campo, 'urbi:input-change', { valor: '${v}' })`;
      if (acao === 'Concluir') {
        for (let i = 0; i < 2; i++) {
          await pagina.evaluate(`botao('Próximo').click()`);
          await pagina.waitForTimeout(80);
        }
      }
      await pagina.evaluate(cidade('Gama'));
      await pagina.evaluate(`botao('${acao}').click()`);
      await pagina.waitForFunction(() => (window as any).liberarPatch);
      // Digita com o PATCH a caminho, depois libera.
      await pagina.evaluate(cidade('Taguatinga'));
      await pagina.evaluate(`window.liberarPatch(); 0`);
      await pagina.waitForTimeout(150);
      const fim = await pagina.evaluate(() => ({ cidade: (window as any).banco.imovel.cidade, url: location.pathname + location.search, avisos: (window as any).avisos }));
      const saiu = fim.url === '/portal_corretor/imoveis?item=7';
      assert.ok(!saiu || fim.cidade === 'Taguatinga', `${acao}: saiu da tela com "${fim.cidade}" no servidor, e o digitado se perdeu`);
      assert.equal(fim.cidade, 'Taguatinga', `${acao}: o texto digitado durante o PATCH tem que chegar ao servidor`);
      assert.ok(saiu, `${acao}: sem edição pendente, segue para a ficha`);
    } finally {
      await navegador.close();
    }
  }
});
