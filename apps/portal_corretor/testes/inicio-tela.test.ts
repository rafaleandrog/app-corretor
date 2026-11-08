import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

// Hoje (P01) no DOM de verdade (Chromium): o "Fiz" com o registro em voo não envia de novo, e a Dica do
// Assistente mostra o botão da ação quando tem ação e "Perguntar ao Assistente" só quando não tem.
// Os primitivos `urbi-*` são elementos sem registro. Sem Playwright instalado (o CI do kit não traz navegador), pula.

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
import { renderHoje } from './frontend/telas/inicio';
const ACAO = { tipo: 'criar_atividade', resumo: 'Criar uma ligação para Ana Ribeiro', rota: '/atividades', corpo: { titulo: 'Responder Ana Ribeiro' } };
const dados = () => ({
  fila: [{ tipo: 'abordagem_vencida', contato_id: 7, contato_nome: 'Ana Ribeiro', temperatura: 'quente', quando: null, texto: 'Ligar para combinar visita' }],
  passagens: [], agenda_hoje: [], primeiros_passos: [], sem_creci: false, semana: null, demo_disponivel: false,
  dica: window.dicaComAcao
    ? { texto: 'Posso criar um lembrete para responder Ana Ribeiro daqui a 1 hora.', acao: ACAO }
    : { texto: 'Pergunte ao Assistente quais clientes vale a pena retomar.', acao: null },
});
window.envios = [];
window.urbiVerso = {
  subRota: () => '/',
  href: (s) => '/portal_corretor' + s,
  navegarSub: () => {},
  usuario: () => ({ id: 1, nome: 'Marina' }),
  contexto: () => ({ conta: { resolucao: 'escopado', contas: [{ id: 100, nome: 'A' }], contaEscrita: 100 } }),
  notificar: () => {},
  alertar: async () => {},
  confirmar: async () => true,
  api: async (rota, op) => {
    const [caminho] = rota.split('?');
    if (op && op.method && op.method !== 'GET') {
      window.envios.push(op.method + ' ' + caminho);
      if (caminho.endsWith('/feita')) await new Promise((r) => (window.soltarEnvio = r));
      return {};
    }
    if (caminho === '/inicio') return dados();
    if (caminho === '/assistente/ia') return { assistente: true };
    return {};
  },
};
const raiz = document.getElementById('raiz');
const desenhar = () => render(renderHoje(desenhar), raiz);
window.desenhar = desenhar;
desenhar();
`;

const AJUDA = `
window.profundo = (no) => {
  if (!no) return '';
  const partes = [];
  const andar = (n) => {
    if (n.nodeType === 3) partes.push(n.textContent);
    if (n.shadowRoot) andar(n.shadowRoot);
    for (const f of n.childNodes) andar(f);
  };
  andar(no);
  return partes.join(' ').replace(/\\s+/g, ' ').trim();
};
window.todos = (raiz, seletor) => {
  const achados = [];
  const fila = [raiz];
  while (fila.length) {
    const n = fila.shift();
    for (const e of n.querySelectorAll?.('*') ?? []) {
      if (e.matches(seletor)) achados.push(e);
      if (e.shadowRoot) fila.push(e.shadowRoot);
    }
  }
  return achados;
};
`;

async function montar(pw: any, dicaComAcao: boolean) {
  const pacote = await build({
    stdin: { contents: ENTRADA, resolveDir: process.cwd(), loader: 'ts' },
    bundle: true,
    write: false,
    format: 'iife',
    target: 'es2022',
    tsconfig: 'tsconfig.json',
    logLevel: 'silent',
  });
  const html = `<!doctype html><html><head><meta charset="utf-8"></head><body><div id="raiz"></div><script>window.dicaComAcao = ${dicaComAcao};${AJUDA}</script><script>${pacote.outputFiles[0].text}</script></body></html>`;
  const navegador = await pw.chromium.launch();
  const pagina = await navegador.newPage({ viewport: { width: 1440, height: 900 } });
  await pagina.route(`${ORIGEM}/**`, (r: any) => r.fulfill({ contentType: 'text/html', body: html }));
  await pagina.goto(`${ORIGEM}/portal_corretor/`);
  await pagina.waitForTimeout(100);
  return { navegador, pagina };
}

/** Os botões da Dica do Assistente (o cartão da direita). */
const botoesDaDica = (pagina: any) =>
  pagina.evaluate(() => {
    const w = window as any;
    const cartao = w.todos(document, 'urbi-card').find((c: Element) => c.getAttribute('titulo') === 'Dica do Assistente');
    return w.todos(cartao, 'urbi-botao').map((b: Element) => w.profundo(b));
  });

test('Hoje: dois cliques em "Fiz" com o registro em voo mandam um POST só', async (t) => {
  const pw = playwright();
  if (!pw) return t.skip('Playwright não instalado neste ambiente');
  const { navegador, pagina } = await montar(pw, false);
  try {
    const clicarFiz = () =>
      pagina.evaluate(() => {
        const w = window as any;
        const fiz = w.todos(document, 'urbi-dropdown-item').find((i: Element) => w.profundo(i) === 'Fiz');
        fiz.dispatchEvent(new CustomEvent('urbi:dropdown-select', { bubbles: true, composed: true }));
      });
    await clicarFiz();
    await pagina.waitForTimeout(50);
    await clicarFiz();
    await pagina.waitForTimeout(50);
    const feitas = () => pagina.evaluate(() => (window as any).envios.filter((e: string) => e === 'POST /abordagens/7/feita').length);
    assert.equal(await feitas(), 1, 'o segundo clique, com o primeiro em voo, não envia');
    // Terminado o registro, o botão volta a valer.
    await pagina.evaluate(() => (window as any).soltarEnvio());
    await pagina.waitForTimeout(100);
    await clicarFiz();
    await pagina.waitForTimeout(50);
    assert.equal(await feitas(), 2, 'depois do registro, um clique novo envia');
  } finally {
    await navegador.close();
  }
});

test('Hoje: Dica com ação mostra o botão da ação (sem "Perguntar"); sem ação, "Perguntar ao Assistente"', async (t) => {
  const pw = playwright();
  if (!pw) return t.skip('Playwright não instalado neste ambiente');
  for (const [comAcao, esperado] of [[true, ['Criar o lembrete']], [false, ['Perguntar ao Assistente']]] as const) {
    const { navegador, pagina } = await montar(pw, comAcao);
    try {
      assert.deepEqual(await botoesDaDica(pagina), esperado, comAcao ? 'com ação' : 'sem ação');
    } finally {
      await navegador.close();
    }
  }
});
