import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

// Troca de conta no MEIO de um gesto do Funil e da busca global (issue #144), no DOM de verdade (Chromium),
// com o app inteiro montado. Mover o cartão para Perdido abre "Por que perdeu?"; com o diálogo aberto (ou o
// PATCH em voo) a conta de trabalho passa a B: nenhum PATCH sai depois da troca e nenhum aviso ou alerta
// aparece. A busca (`/`) aberta em A: depois da troca ela não busca na conta nova e o resultado escolhido
// (de A) não navega. Sem troca, os dois gestos seguem como antes.
//
// O harness é o de troca-de-conta-clientes-chromium.test.ts (cada resposta leva a marca da conta que a pediu,
// `SEGURAR` deixa requisições em voo e `SEGURAR_FORM` deixa o diálogo aberto). Sem Playwright, pula.

function playwright(): any {
  try {
    return createRequire(import.meta.url)('playwright');
  } catch {
    return null;
  }
}

const ORIGEM = 'https://app.exemplo';

const ENTRADA = `
let aoMudarRota = null;
window.chamadas = [];
window.pendentes = [];
window.avisos = [];
window.alertas = [];
window.formularios = [];
window.formsAbertos = [];
window.confirmacoes = [];
window.SEGURAR = () => false;
window.SEGURAR_FORM = false;
window.CONTA = 100;
const ctxConta = () => window.VARIAS
  ? { resolucao: 'escopado', contas: [{ id: 100, nome: 'A' }, { id: 200, nome: 'B' }] }
  : { resolucao: 'escopado', contas: [{ id: window.CONTA, nome: 'Conta ' + window.CONTA }], contaEscrita: window.CONTA };
// Id de uma conta não existe na outra (o RLS não devolve a linha): o contato 101 é de A, o 201 é de B.
const CONTATO = (c) => ({
  id: c + 1, nome: 'Ana CONTA ' + c, telefone: '+5561999990001', email: null, papeis: 'comprador', temperatura: null,
  origem_canal: null, proximo_passo: null, proximo_passo_em: null, criado_em: '2026-10-01T12:00:00Z', ultimo_contato_em: null,
  observacoes: null, perfil_busca: null,
});
const FICHA = (c) => ({
  contato: CONTATO(c), negocios: [], atividades: [], visitas: [], linha_do_tempo: [], consentimento: null, abordagem: null, classificacoes: [],
});
function responder(metodo, caminho, c) {
  if (caminho === '/conta') return { configuracoes: {} };
  if (caminho === '/contatos') return { dados: [CONTATO(c)], total: 1 };
  if (caminho === '/funil/etapas') return { etapas: [] };
  if (caminho === '/envios') return { dados: [] };
  if (caminho === '/selecoes') return { dados: [] };
  if (caminho === '/funil/quadro') return {
    etapas: [{ id: 1, nome: 'Novo', tipo: 'aberta' }, { id: 9, nome: 'Perdido', tipo: 'perdida' }],
    negocios: [{ id: c + 1, etapa_id: 1, contato_id: c + 1, contato_nome: 'Ana CONTA ' + c, titulo: 'Compra', temperatura: null }],
    passagem: [], funis: { compra: 1 }, temperaturas: {},
  };
  if (caminho === '/busca') return { clientes: [{ id: c + 1, nome: 'Ana CONTA ' + c, telefone: null, email: null }], imoveis: [], negociacoes: [] };
  const n = /^\\/negocios\\/(\\d+)$/.exec(caminho);
  if (n) {
    if (Number(n[1]) !== c + 1) throw Object.assign(new Error('Não encontrado.'), { status: 404, codigo: 'NAO_ENCONTRADO' });
    if (window.FALHAR_PATCH) throw Object.assign(new Error('Recusado.'), { status: 422 });
    return { ok: true };
  }
  if (caminho === '/imoveis') return { dados: [{ id: c + 1, codigo: 'IM-' + c, titulo: 'Casa CONTA ' + c, tipo: 'casa', autorizacao_vigente: true }], total: 1, paginas: 1 };
  const m = /^\\/contatos\\/(\\d+)(\\/.*)?$/.exec(caminho);
  if (m) {
    if (Number(m[1]) !== c + 1) throw Object.assign(new Error('Não encontrado.'), { status: 404, codigo: 'NAO_ENCONTRADO' });
    const resto = m[2] ?? '';
    if (resto === '' && metodo === 'GET') return FICHA(c);
    if (resto === '/ia') return { resumo: false, mensagem: false };
    if (resto === '/portal' && metodo === 'GET') return { ativo: true, link: '/portal_corretor/c?t=CONTA' + c, criado_em: '2026-10-03T12:00:00Z' };
    if (resto === '/portal') return { link: '/portal_corretor/c?t=CONTA' + c, novo: false };
    if (resto === '/tarefas-cliente' && metodo === 'GET') return { dados: [] };
    return { ok: true };
  }
  return {};
}
window.urbiVerso = {
  subRota: () => location.pathname.replace(/^\\/portal_corretor/, '') || '/',
  href: (s) => '/portal_corretor' + s,
  escutarRota: (cb) => ((aoMudarRota = cb), () => (aoMudarRota = null)),
  navegarSub: (s) => { history.pushState(null, '', '/portal_corretor' + s); aoMudarRota?.(s.split('?')[0]); },
  usuario: () => ({ id: 1, nome: 'Marina' }),
  contexto: () => ({ carregado: true, nivel: 'usuario', roles: ['corretor', 'operacao'], conta: ctxConta() }),
  notificar: (m) => window.avisos.push(m),
  alertar: async (a) => { window.alertas.push(a.titulo); },
  // O diálogo guarda o que mostrou; com SEGURAR_FORM fica aberto até o teste responder (window.responderForm()).
  formulario: (a) => {
    window.formularios.push(JSON.stringify(a));
    window.ultimoForm = a;
    if (window.SEGURAR_FORM) return new Promise((r) => window.formsAbertos.push(r));
    return Promise.resolve(window.RESPOSTA_FORMULARIO ?? null);
  },
  // A confirmação fica aberta até o teste responder (window.confirmar(true)).
  confirmar: () => new Promise((r) => window.confirmacoes.push(r)),
  api: async (rota, opcoes) => {
    const [caminho] = rota.split('?');
    const metodo = opcoes?.method ?? 'GET';
    const conta = Number(new Headers(opcoes?.headers).get('X-Conta')) || window.CONTA;
    window.chamadas.push(metodo + ' ' + rota + ' @' + conta + (opcoes?.body ? ' ' + opcoes.body : ''));
    const responde = () => responder(metodo, caminho, conta);
    if (window.SEGURAR(metodo, caminho, conta)) return new Promise((r, f) => window.pendentes.push(() => { try { r(responde()); } catch (e) { f(e); } }));
    return responde();
  },
  fetch: async () => new Response('{}'),
};
import './frontend/index';
const app = document.createElement('app-portal-corretor');
document.getElementById('raiz').append(app);
window.app = app;
window.trocarConta = (c) => {
  window.CONTA = c;
  if (window.VARIAS) {
    const sel = app.shadowRoot.querySelector('urbi-select[label="Conta"]');
    sel.dispatchEvent(new CustomEvent('urbi:select-change', { detail: { valor: String(c) } }));
  } else {
    window.dispatchEvent(new CustomEvent('urbi:contexto-app', { detail: { ...window.urbiVerso.contexto(), appId: 'portal_corretor' } }));
  }
};
window.liberar = () => window.pendentes.splice(0).forEach((f) => f());
window.confirmar = (sim) => window.confirmacoes.splice(0).forEach((r) => r(sim));
window.responderForm = (v) => window.formsAbertos.splice(0).forEach((r) => r(v));
window.todos = (n = app.shadowRoot, saida = []) => {
  for (const e of n.querySelectorAll('*')) { saida.push(e); if (e.shadowRoot) window.todos(e.shadowRoot, saida); }
  return saida;
};
window.achar = (sel) => window.todos().find((e) => e.matches(sel)) ?? null;
window.porTexto = (tag, texto) => window.todos().find((e) => e.localName === tag && e.textContent.trim().startsWith(texto)) ?? null;
window.clicarEm = (e, rotulo) => {
  if (!e) throw new Error('não achei ' + rotulo);
  e.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
};
window.clicar = (tag, texto) => window.clicarEm(window.porTexto(tag, texto), tag + ' "' + texto + '"');
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
  const html = `<!doctype html><html><head><meta charset="utf-8"></head><body><div id="raiz"></div><script>${pacote.outputFiles[0].text}</script></body></html>`;
  const navegador = await pw.chromium.launch();
  const pagina = await navegador.newPage({ viewport: { width: 1440, height: 900 } });
  const erros: string[] = [];
  pagina.on('pageerror', (e: Error) => erros.push(e.message));
  await pagina.route(`${ORIGEM}/**`, (r: any) => r.fulfill({ contentType: 'text/html', body: html }));
  return { navegador, pagina, erros };
}

const esperar = (p: any, ms = 150) => p.waitForTimeout(ms);
const MODOS = ['conta única trocada pelo shell', 'várias contas, troca pelo seletor'] as const;

async function cenario(t: any, modo: (typeof MODOS)[number], endereco: string, caso: (p: any) => Promise<void>) {
  const pw = playwright();
  if (!pw) return t.skip('Playwright não instalado neste ambiente');
  const { navegador, pagina, erros } = await montar(pw);
  try {
    if (modo.startsWith('várias')) await pagina.addInitScript(() => ((window as any).VARIAS = true));
    await pagina.goto(`${ORIGEM}/portal_corretor${endereco}`);
    await esperar(pagina);
    await caso(pagina);
    assert.deepEqual(erros, [], 'nenhum erro na página (nem rejeição sem tratamento)');
  } finally {
    await navegador.close();
  }
}

interface Depois {
  chamadas: string[];
  avisos: string[];
  alertas: string[];
  url: string;
  formularios: string[];
}
const depoisDaTroca = (p: any): Promise<Depois> =>
  p.evaluate(() => {
    const w = window as any;
    return { chamadas: w.chamadas.slice(w.marco) as string[], avisos: w.avisos as string[], alertas: w.alertas as string[], url: location.pathname + location.search, formularios: w.formularios as string[] };
  });
const trocar = (p: any) => p.evaluate(() => ((window as any).marco = (window as any).chamadas.length, (window as any).trocarConta(200)));
const escritas = (r: Depois) => r.chamadas.filter((c) => /^(POST|PUT|PATCH|DELETE) /.test(c));

const FUNIL = '/clientes?visao=funil';
const LISTA = '/clientes';

// Arrasta o cartão de A para Perdido: o `urbi-kanban` (sem implementação aqui) emite o evento do primitivo.
const moverParaPerdido = (p: any) =>
  p.evaluate(() => {
    const w = window as any;
    const k = w.achar('urbi-kanban');
    if (!k) throw new Error('não achei o urbi-kanban');
    w.kanbanDeA = k;
    k.dispatchEvent(new CustomEvent('urbi:kanban-mover', { detail: { item: { id: '101' }, listaDestino: '9' }, bubbles: true, composed: true }));
  });

// A busca global pelo atalho `/`; a lista do campo `busca` é pedida pela função do próprio formulário.
const abrirBusca = (p: any) => p.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: '/' })));
const buscarNoDialogo = (p: any, termo: string) =>
  p.evaluate(async (t: string) => (window as any).ultimoForm.campos[0].buscar(t, new AbortController().signal), termo);

for (const modo of MODOS) {
  test(`Funil (${modo}): "Por que perdeu?" confirmado depois da troca não move nada em B, sem aviso nem alerta`, async (t) => {
    await cenario(t, modo, FUNIL, async (p) => {
      await p.evaluate(() => ((window as any).SEGURAR_FORM = true));
      await moverParaPerdido(p);
      await esperar(p, 50);
      assert.equal(await p.evaluate(() => (window as any).formsAbertos.length), 1, 'o diálogo do motivo está aberto em A');
      await trocar(p);
      await esperar(p);
      await p.evaluate(() => (window as any).responderForm({ motivo: 'preco' }));
      await esperar(p);
      const r = await depoisDaTroca(p);
      assert.deepEqual(escritas(r), [], 'nenhum PATCH /negocios/101 depois da troca');
      assert.deepEqual(r.avisos, []);
      assert.deepEqual(r.alertas, [], 'sem "Não foi possível mover" na conta nova');
    });
  });

  test(`Funil (${modo}): PATCH do mover em voo; a conta muda; a falha dele não vira alerta em B`, async (t) => {
    await cenario(t, modo, FUNIL, async (p) => {
      await p.evaluate(() => {
        const w = window as any;
        w.RESPOSTA_FORMULARIO = { motivo: 'preco' };
        w.FALHAR_PATCH = true;
        w.SEGURAR = (m: string, c: string) => m === 'PATCH' && c === '/negocios/101';
      });
      await moverParaPerdido(p);
      await esperar(p, 50);
      assert.ok(await p.evaluate(() => (window as any).chamadas.some((c: string) => c.startsWith('PATCH /negocios/101 @100'))), 'o PATCH de A saiu');
      await trocar(p);
      await esperar(p);
      await p.evaluate(() => (window as any).liberar());
      await esperar(p);
      const r = await depoisDaTroca(p);
      assert.deepEqual(escritas(r), []);
      assert.deepEqual(r.avisos, []);
      assert.deepEqual(r.alertas, [], 'sem "Não foi possível mover" na conta nova');
    });
  });

  test(`Busca global (${modo}): o resultado de A escolhido depois da troca não navega, e a busca não pede nada em B`, async (t) => {
    await cenario(t, modo, LISTA, async (p) => {
      await p.evaluate(() => ((window as any).SEGURAR_FORM = true));
      await abrirBusca(p);
      await esperar(p, 50);
      assert.equal(await p.evaluate(() => (window as any).formsAbertos.length), 1, 'a busca está aberta em A');
      const opcoesA = await buscarNoDialogo(p, 'Ana');
      assert.equal(opcoesA.length, 1, 'a busca de A achou o cliente de A');
      await trocar(p);
      await esperar(p);
      const opcoesDepois = await buscarNoDialogo(p, 'Ana');
      assert.deepEqual(opcoesDepois, [], 'com a conta trocada, a lista aberta em A não traz nada');
      await p.evaluate((v: number) => (window as any).responderForm({ alvo: v }), opcoesA[0].valor);
      await esperar(p);
      const r = await depoisDaTroca(p);
      assert.deepEqual(r.chamadas.filter((c) => c.startsWith('GET /busca')), [], 'nenhuma busca na conta nova pelo diálogo de A');
      assert.doesNotMatch(r.url, /item=101/, `não abriu o cliente de A (${r.url})`);
      assert.deepEqual(r.alertas, []);
    });
  });

  test(`Funil e busca (${modo}): sem troca, seguem como antes (PATCH em A, recarga; a busca abre o cliente)`, async (t) => {
    await cenario(t, modo, FUNIL, async (p) => {
      await p.evaluate(() => {
        const w = window as any;
        w.marco = w.chamadas.length;
        w.RESPOSTA_FORMULARIO = { motivo: 'preco' };
      });
      await moverParaPerdido(p);
      await esperar(p);
      let r = await depoisDaTroca(p);
      assert.ok(r.chamadas.some((c) => c.startsWith('PATCH /negocios/101 @100') && c.includes('"motivo_perda":"preco"')), 'move na conta A com o motivo');
      const patch = r.chamadas.findIndex((c) => c.startsWith('PATCH /negocios/101'));
      assert.ok(r.chamadas.slice(patch).some((c) => c.startsWith('GET /funil/quadro')), 'o quadro é relido depois');
      assert.deepEqual(r.alertas, []);

      await p.evaluate(() => ((window as any).SEGURAR_FORM = true));
      await abrirBusca(p);
      await esperar(p, 50);
      const opcoes = await buscarNoDialogo(p, 'Ana');
      await p.evaluate((v: number) => (window as any).responderForm({ alvo: v }), opcoes[0].valor);
      await esperar(p);
      r = await depoisDaTroca(p);
      assert.match(r.url, /\/clientes\?item=101/, `a busca abriu o cliente de A (${r.url})`);
      assert.deepEqual(r.alertas, []);
    });
  });
}
