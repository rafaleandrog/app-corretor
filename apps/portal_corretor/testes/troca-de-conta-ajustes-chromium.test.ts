import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

// Troca de conta no MEIO de um gesto em Ajustes (issue #144, Conexões e Negociador), no DOM de verdade
// (Chromium), com o app inteiro montado. Harness copiado de troca-de-conta-gestos-chromium.test.ts.
// Um gesto começado na conta A (clique que abre diálogo, carga auxiliar, cadeia de awaits) e que vê, num
// await, a conta de trabalho passar a B termina em silêncio: nenhuma escrita nova, nenhum estado ou tela,
// nenhum aviso ou alerta, nenhuma navegação. O mecanismo é o `gesto` de frontend/apoio.ts.
//
// O servidor simulado é o de troca-de-conta-chromium.test.ts, enxuto: cada resposta leva a marca da conta
// que a pediu (`CONTA 100`, `CONTA 200`), e `SEGURAR(metodo, caminho, conta)` deixa em voo as requisições
// escolhidas até o teste liberar. Sem Playwright, pula.

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
window.confirmacoes = [];
window.formAbertos = [];
window.SEGURAR = () => false;
window.CONTA = 100;
const ctxConta = () => window.VARIAS
  ? { resolucao: 'escopado', contas: [{ id: 100, nome: 'A' }, { id: 200, nome: 'B' }] }
  : { resolucao: 'escopado', contas: [{ id: window.CONTA, nome: 'Conta ' + window.CONTA }], contaEscrita: window.CONTA };
const BLOCOS = (c) => [
  { tipo: 'apresentacao', ativo: true, titulo: 'Apresentação CONTA ' + c, texto: 'Texto CONTA ' + c },
  { tipo: 'destaques', ativo: true, titulo: 'Destaques CONTA ' + c, codigos: [] },
  { tipo: 'contato', ativo: true, whatsapp: true, instagram: null },
];
const FICHA = (id, c) => ({
  imovel: { id, codigo: 'IM-' + c, titulo: 'Casa CONTA ' + c, tipo: 'casa', cidade: 'Cidade CONTA ' + c, uf: 'DF', situacao: 'ativo', publicado_pagina: true, preco_c: 100 },
  qualidade: { nota: 80, faltas: [] }, autorizacao_vigente: true, fotos_publicas: 0, midias: [], autorizacoes: [],
});
// Id de uma conta não existe na outra (o RLS não devolve a linha): 101 é de A, 201 é de B.
function responder(metodo, caminho, c) {
  const M = 'CONTA ' + c;
  if (caminho === '/pagina') return {
    pagina: { endereco: 'p' + c, nome_exibicao: 'Página ' + M, blocos: BLOCOS(c), publicada_em: window.PUBLICADA ? new Date().toISOString() : null, gerada_por_ia: false },
    salva: true, url: 'https://corretor.exemplo/p?c=p' + c, marcados_para_pagina: 1, sem_creci: false, numeros: { contatos_30d: 0, visitas_30d: null },
  };
  if (caminho === '/pagina/previa') return { publicada: false, pagina: { endereco: 'p' + c, nome: 'Prévia ' + M, creci: null, telefone: null, cor: '#123456', foto_url: null, url_formulario: null, blocos: BLOCOS(c) }, imoveis: [] };
  if (caminho === '/imoveis' && metodo === 'POST') return { id: c + 1 };
  if (caminho === '/imoveis') return { dados: [{ id: c + 1, codigo: 'IM-' + c, titulo: 'Casa ' + M, tipo: 'casa', situacao: 'ativo', publicado_pagina: true }], total: 1, paginas: 1 };
  if (caminho === '/imoveis/ia') return { fotos: false, conteudo: false };
  const im = /^\\/imoveis\\/(\\d+)(\\/contexto)?$/.exec(caminho);
  if (im) {
    const id = Number(im[1]);
    if (id !== c + 1) throw Object.assign(new Error('Não encontrado.'), { codigo: 'NAO_ENCONTRADO' });
    return im[2] ? { combinam: [] } : metodo === 'GET' ? FICHA(id, c) : { ok: true };
  }
  if (caminho === '/conexoes') return { instagram: { usuario: 'ig' + c, tipo_conta: 'BUSINESS', conectado_em: '2026-01-01T00:00:00Z', token_expira_em: null, ultimo_erro: null }, disponivel: true, retorno: 'https://app.exemplo/r' };
  if (caminho === '/negociador/config') return { ligado: true, conduz_padrao: 'ia', negociador_padrao_id: null, gatilhos: {}, estilo: 'cooperativo', instrucoes_corretor: null };
  if (caminho === '/negociador/objecoes' && metodo === 'GET') return { dados: [
    { categoria: 'preco', titulo: 'Preço', fala_cliente: 'Está caro', padrao: { pergunta_exploracao: 'P ' + M, resposta_base: 'R ' + M, proximo_passo: 'N ' + M }, minha: null, usando: 'padrao' },
  ] };
  if (caminho === '/negociador/objecoes') return { categoria: 'preco', titulo: 'Preço', fala_cliente: 'Está caro', padrao: {}, minha: {}, usando: 'corretor' };
  if (caminho === '/negociador/convites') return { convites: [] };
  if (caminho === '/negociador/negociadores') return { dados: [] };
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
  // O diálogo guarda o que mostrou; responde o que o teste pôs em RESPOSTA_FORMULARIO.
  // Com FORMULARIO_ABERTO, o diálogo fica aberto até o teste fechar (window.fecharFormulario()).
  formulario: (a) => {
    window.formularios.push(JSON.stringify(a));
    if (window.FORMULARIO_ABERTO) return new Promise((r) => window.formAbertos.push(() => r(window.RESPOSTA_FORMULARIO ?? null)));
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
    window.dispatchEvent(new CustomEvent('urbi:contexto-app', { detail: window.urbiVerso.contexto() }));
  }
};
window.fecharFormulario = () => window.formAbertos.splice(0).forEach((f) => f());
window.liberar = () => window.pendentes.splice(0).forEach((f) => f());
window.confirmar = (sim) => window.confirmacoes.splice(0).forEach((r) => r(sim));
// Todos os elementos, atravessando shadow roots.
window.todos = (n = app.shadowRoot, saida = []) => {
  for (const e of n.querySelectorAll('*')) { saida.push(e); if (e.shadowRoot) window.todos(e.shadowRoot, saida); }
  return saida;
};
window.achar = (sel) => window.todos().find((e) => e.matches(sel)) ?? null;
window.porTexto = (tag, texto) => window.todos().find((e) => e.localName === tag && e.textContent.trim().startsWith(texto)) ?? null;
window.clicar = (tag, texto) => {
  const e = window.porTexto(tag, texto);
  if (!e) throw new Error('não achei ' + tag + ' "' + texto + '"');
  e.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
};
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

/** Abre o endereço no modo, roda o caso e fecha o navegador. */
async function cenario(t: any, modo: (typeof MODOS)[number], endereco: string, antes: string, caso: (p: any) => Promise<void>) {
  const pw = playwright();
  if (!pw) return t.skip('Playwright não instalado neste ambiente');
  const { navegador, pagina, erros } = await montar(pw);
  try {
    if (modo.startsWith('várias')) await pagina.addInitScript(() => ((window as any).VARIAS = true));
    if (antes) await pagina.addInitScript(antes);
    await pagina.goto(`${ORIGEM}/portal_corretor${endereco}`);
    await esperar(pagina);
    await caso(pagina);
    assert.deepEqual(erros, [], 'nenhum erro na página (nem rejeição sem tratamento)');
  } finally {
    await navegador.close();
  }
}

/** O que aconteceu depois da troca: as chamadas a partir do marco, os avisos, os alertas e o endereço. */
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

const RESPOSTA = { pergunta_exploracao: 'minha p', resposta_base: 'minha r', proximo_passo: 'meu n' };
/** Abre "Editar" da objeção Preço (a lista é um primitivo sem registro aqui: o gesto é chamado direto). */
const editarObjecao = (p: any) =>
  p.evaluate(() => {
    const w = window as any;
    const tela = w.achar('pc-ajustes-negociador');
    void tela.editarObjecao(tela.objecoes[0]);
  });

for (const modo of MODOS) {
  test(`Conexões (${modo}): "Desconectar" confirmado depois da troca não desconecta o Instagram de B`, async (t) => {
    await cenario(t, modo, '/ajustes?aba=conexoes', '', async (p) => {
      await p.evaluate(() => (window as any).clicar('urbi-botao', 'Desconectar'));
      await esperar(p, 50);
      assert.equal(await p.evaluate(() => (window as any).confirmacoes.length), 1, 'a confirmação está aberta em A');
      await trocar(p);
      await esperar(p);
      await p.evaluate(() => (window as any).confirmar(true));
      await esperar(p);
      const r = await depoisDaTroca(p);
      assert.deepEqual(r.chamadas.filter((c) => c.startsWith('POST ')), [], 'nenhum POST /conexoes/instagram/desconectar');
      assert.deepEqual(r.avisos, []);
      assert.deepEqual(r.alertas, []);
    });
  });

  test(`Conexões (${modo}): troca com o POST de desconectar em voo; sem aviso nem releitura de A`, async (t) => {
    await cenario(t, modo, '/ajustes?aba=conexoes', '', async (p) => {
      await p.evaluate(() => {
        const w = window as any;
        w.SEGURAR = (m: string, c: string, k: number) => m === 'POST' && k === 100;
        w.clicar('urbi-botao', 'Desconectar');
      });
      await esperar(p, 50);
      await p.evaluate(() => (window as any).confirmar(true));
      await esperar(p, 50);
      assert.ok(await p.evaluate(() => (window as any).chamadas.some((c: string) => c.startsWith('POST /conexoes/instagram/desconectar @100'))), 'o POST de A saiu');
      await trocar(p);
      await esperar(p);
      await p.evaluate(() => (window as any).liberar());
      await esperar(p);
      const r = await depoisDaTroca(p);
      assert.deepEqual(r.chamadas.filter((c) => c.includes('@100')), [], 'nada de A depois da troca');
      assert.deepEqual(r.chamadas.filter((c) => c.startsWith('POST ')), []);
      assert.deepEqual(r.avisos, [], 'sem "Instagram desconectado."');
      assert.deepEqual(r.alertas, []);
    });
  });

  test(`Conexões (${modo}): sem troca, desconectar segue como antes (POST em A e aviso)`, async (t) => {
    await cenario(t, modo, '/ajustes?aba=conexoes', '', async (p) => {
      await p.evaluate(() => {
        const w = window as any;
        w.marco = w.chamadas.length;
        w.clicar('urbi-botao', 'Desconectar');
      });
      await esperar(p, 50);
      await p.evaluate(() => (window as any).confirmar(true));
      await esperar(p);
      const r = await depoisDaTroca(p);
      assert.ok(r.chamadas.some((c) => c.startsWith('POST /conexoes/instagram/desconectar @100')), 'desconecta na conta A');
      assert.deepEqual(r.avisos, ['Instagram desconectado.']);
    });
  });

  test(`Negociador (${modo}): editar a objeção com o diálogo aberto; a conta muda; nenhum PUT em B`, async (t) => {
    await cenario(t, modo, '/ajustes?aba=negociador', '', async (p) => {
      await p.evaluate((v: any) => {
        const w = window as any;
        w.RESPOSTA_FORMULARIO = v;
        w.FORMULARIO_ABERTO = true;
      }, RESPOSTA);
      await editarObjecao(p);
      await esperar(p, 50);
      assert.equal(await p.evaluate(() => (window as any).formAbertos.length), 1, 'o diálogo está aberto em A');
      assert.match(await p.evaluate(() => (window as any).formularios.at(-1)), /CONTA 100/, 'preenchido com a resposta de A');
      await trocar(p);
      await esperar(p);
      await p.evaluate(() => (window as any).fecharFormulario());
      await esperar(p);
      const r = await depoisDaTroca(p);
      assert.deepEqual(r.chamadas.filter((c) => c.startsWith('PUT ')), [], 'nenhum PUT /negociador/objecoes');
      assert.deepEqual(r.avisos, []);
      assert.deepEqual(r.alertas, []);
    });
  });

  test(`Negociador (${modo}): troca com o PUT da objeção em voo; sem aviso nem erro na conta nova`, async (t) => {
    await cenario(t, modo, '/ajustes?aba=negociador', '', async (p) => {
      await p.evaluate((v: any) => {
        const w = window as any;
        w.RESPOSTA_FORMULARIO = v;
        w.SEGURAR = (m: string, c: string, k: number) => m === 'PUT' && k === 100;
      }, RESPOSTA);
      await editarObjecao(p);
      await esperar(p, 50);
      assert.ok(await p.evaluate(() => (window as any).chamadas.some((c: string) => c.startsWith('PUT /negociador/objecoes @100'))), 'o PUT de A saiu');
      await trocar(p);
      await esperar(p);
      await p.evaluate(() => (window as any).liberar());
      await esperar(p);
      const r = await depoisDaTroca(p);
      assert.deepEqual(r.chamadas.filter((c) => c.startsWith('PUT ')), []);
      assert.deepEqual(r.avisos, [], 'sem "Sua resposta foi salva."');
      assert.deepEqual(r.alertas, []);
    });
  });

  test(`Negociador (${modo}): sem troca, editar a objeção segue como antes (PUT em A e aviso)`, async (t) => {
    await cenario(t, modo, '/ajustes?aba=negociador', '', async (p) => {
      await p.evaluate((v: any) => {
        const w = window as any;
        w.RESPOSTA_FORMULARIO = v;
        w.marco = w.chamadas.length;
      }, RESPOSTA);
      await editarObjecao(p);
      await esperar(p);
      const r = await depoisDaTroca(p);
      assert.ok(r.chamadas.some((c) => c.startsWith('PUT /negociador/objecoes @100') && c.includes('minha r')), 'grava na conta A');
      assert.deepEqual(r.avisos, ['Sua resposta foi salva.']);
    });
  });
}
