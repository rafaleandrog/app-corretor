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
import { render, nothing } from 'lit';
import { renderHoje } from './frontend/telas/inicio';
import { aoMudarAssistente, fecharAssistente } from './frontend/telas/assistente';
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
window.desmontar = () => render(nothing, raiz);
window.fecharAssistente = fecharAssistente;
aoMudarAssistente(desenhar);
desenhar();
`;

const AJUDA = `
// Conta os ouvintes 'change' ligados nas consultas de mídia (a vigia do corte do celular).
window.ouvintes = 0;
const somar = MediaQueryList.prototype.addEventListener;
const tirar = MediaQueryList.prototype.removeEventListener;
MediaQueryList.prototype.addEventListener = function (tipo, f, o) { if (tipo === 'change') window.ouvintes++; return somar.call(this, tipo, f, o); };
MediaQueryList.prototype.removeEventListener = function (tipo, f, o) { if (tipo === 'change') window.ouvintes--; return tirar.call(this, tipo, f, o); };
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

async function montar(pw: any, dicaComAcao: boolean, viewport = { width: 1440, height: 900 }, busca = '') {
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
  const pagina = await navegador.newPage({ viewport });
  await pagina.route(`${ORIGEM}/**`, (r: any) => r.fulfill({ contentType: 'text/html', body: html }));
  await pagina.goto(`${ORIGEM}/portal_corretor/${busca}`);
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

test('Hoje no celular (M1, #190): sem as abas das colunas, uma rolagem com atalhos, "Precisa de você", a fila e o contexto embaixo', async (t) => {
  const pw = playwright();
  if (!pw) return t.skip('Playwright não instalado neste ambiente');
  const { navegador, pagina } = await montar(pw, false, { width: 390, height: 844 });
  try {
    const r = await pagina.evaluate(() => {
      const w = window as any;
      const dois = w.todos(document, 'urbi-2x1')[0];
      const texto = w.profundo(dois);
      return {
        tres: w.todos(document, 'urbi-3-colunas').length,
        slots: dois ? [...dois.children].map((c: Element) => c.getAttribute('slot')) : [],
        ordem: ['Conversas', 'Precisa de você', 'Fila do dia', 'Nada marcado para hoje'].map((x) => texto.indexOf(x)),
        agenda: w.todos(dois, 'urbi-card').map((c: Element) => c.getAttribute('titulo')),
      };
    });
    assert.equal(r.tres, 0, 'sem urbi-3-colunas (e sem a barra de abas dele) no celular');
    assert.deepEqual(r.slots, ['esquerda', 'direita']);
    assert.ok(r.ordem.every((i: number, k: number) => i >= 0 && (k === 0 || i > r.ordem[k - 1])), `na ordem: atalhos, Precisa de você, fila, contexto (${r.ordem})`);
    assert.ok(r.agenda.includes('Agenda de hoje'));
  } finally {
    await navegador.close();
  }
});

/** A forma de Hoje agora: estrutura, slots, textos na ordem e ouvintes ligados. */
const forma = (pagina: any) =>
  pagina.evaluate(() => {
    const w = window as any;
    const dois = w.todos(document, 'urbi-2x1')[0];
    const tres = w.todos(document, 'urbi-3-colunas')[0];
    const texto = w.profundo(dois ?? tres);
    const pos = (x: string) => texto.indexOf(x);
    return {
      estrutura: dois ? '2x1' : tres ? '3-colunas' : '',
      slots: dois ? [...dois.children].map((c: Element) => c.getAttribute('slot')) : [],
      botoes: w.todos(dois ?? tres ?? document, 'urbi-botao').map((b: Element) => w.profundo(b)),
      pos: { atalhos: pos('Conversas'), precisa: pos('Precisa de você'), fila: pos('Fila do dia'), agenda: pos('Agenda dos próximos 14 dias'), contexto: pos('Nada marcado para hoje') },
      ouvintes: w.ouvintes,
    };
  });

const emOrdem = (xs: number[]) => xs.every((i, k) => i >= 0 && (k === 0 || i > xs[k - 1]));

test('Hoje no celular com a Agenda (?aba=agenda): só a fila vira Agenda; atalhos e "Precisa de você" ficam, na ordem', async (t) => {
  const pw = playwright();
  if (!pw) return t.skip('Playwright não instalado neste ambiente');
  const { navegador, pagina } = await montar(pw, false, { width: 390, height: 844 }, '?aba=agenda');
  try {
    const f = await forma(pagina);
    assert.equal(f.estrutura, '2x1');
    assert.deepEqual(f.slots, ['esquerda', 'direita']);
    for (const b of ['Conversas', 'Criar', 'Assistente', 'Voltar para a fila']) assert.ok(f.botoes.includes(b), `botão ${b}`);
    assert.equal(f.pos.fila, -1, 'a fila sai enquanto a Agenda está escolhida');
    assert.ok(emOrdem([f.pos.atalhos, f.pos.precisa, f.pos.agenda, f.pos.contexto]), `atalhos → Precisa de você → Agenda → contexto (${JSON.stringify(f.pos)})`);
    // Voltar para a fila: a fila volta no mesmo lugar, com o resto intacto.
    await pagina.evaluate(() => {
      const w = window as any;
      w.todos(document, 'urbi-botao').find((b: Element) => w.profundo(b) === 'Voltar para a fila').click();
    });
    await pagina.waitForTimeout(50);
    const g = await forma(pagina);
    assert.equal(g.pos.agenda, -1);
    assert.ok(emOrdem([g.pos.atalhos, g.pos.precisa, g.pos.fila, g.pos.contexto]), `atalhos → Precisa de você → fila → contexto (${JSON.stringify(g.pos)})`);
  } finally {
    await navegador.close();
  }
});

test('Hoje cruzando os 900 px (390 → 1280 → 390): redesenha com a estrutura certa, mantém a aba e o ouvinte não duplica nem vaza', async (t) => {
  const pw = playwright();
  if (!pw) return t.skip('Playwright não instalado neste ambiente');
  const { navegador, pagina } = await montar(pw, false, { width: 390, height: 844 }, '?aba=agenda');
  try {
    let f = await forma(pagina);
    assert.equal(f.estrutura, '2x1');
    assert.equal(f.ouvintes, 1, 'um ouvinte ao conectar');
    await pagina.setViewportSize({ width: 1280, height: 800 });
    await pagina.waitForTimeout(100);
    f = await forma(pagina);
    assert.equal(f.estrutura, '3-colunas', 'no desktop, três colunas sem outro desenho do app');
    assert.ok(f.pos.agenda >= 0, 'a Agenda escolhida na URL continua');
    assert.equal(f.ouvintes, 1);
    await pagina.setViewportSize({ width: 390, height: 844 });
    await pagina.waitForTimeout(100);
    f = await forma(pagina);
    assert.equal(f.estrutura, '2x1');
    assert.ok(f.pos.agenda >= 0 && f.pos.precisa >= 0 && f.pos.atalhos >= 0);
    assert.equal(f.ouvintes, 1);
    // Redesenhos na mesma largura não somam ouvinte.
    await pagina.evaluate(() => ((window as any).desenhar(), (window as any).desenhar()));
    assert.equal((await forma(pagina)).ouvintes, 1);
    // Saiu do DOM: deixa de ouvir; voltou: um só de novo.
    await pagina.evaluate(() => (window as any).desmontar());
    assert.equal(await pagina.evaluate(() => (window as any).ouvintes), 0, 'ao desconectar, o ouvinte sai');
    await pagina.evaluate(() => (window as any).desenhar());
    assert.equal((await forma(pagina)).ouvintes, 1, 'ao reconectar, um só');
  } finally {
    await navegador.close();
  }
});

test('Hoje no celular: o Assistente aberto volta às três colunas e, fechado, ao 2x1', async (t) => {
  const pw = playwright();
  if (!pw) return t.skip('Playwright não instalado neste ambiente');
  const { navegador, pagina } = await montar(pw, false, { width: 390, height: 844 });
  try {
    assert.equal((await forma(pagina)).estrutura, '2x1');
    await pagina.evaluate(() => {
      const w = window as any;
      w.todos(document, 'urbi-botao').find((b: Element) => w.profundo(b) === 'Assistente').click();
    });
    await pagina.waitForTimeout(100);
    let f = await forma(pagina);
    assert.equal(f.estrutura, '3-colunas');
    assert.equal(f.ouvintes, 1);
    await pagina.evaluate(() => (window as any).fecharAssistente());
    await pagina.waitForTimeout(50);
    f = await forma(pagina);
    assert.equal(f.estrutura, '2x1');
    assert.equal(f.ouvintes, 1);
  } finally {
    await navegador.close();
  }
});
