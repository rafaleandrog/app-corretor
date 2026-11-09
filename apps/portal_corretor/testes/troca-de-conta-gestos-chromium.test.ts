import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

// Troca de conta no MEIO de um gesto (issue #144), no DOM de verdade (Chromium), com o app inteiro montado.
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
window.SEGURAR = () => false;
// FALHAR(metodo, caminho, conta, corpo): a resposta daquela requisição é um erro (com a marca da conta).
window.FALHAR = () => false;
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
  // Proprietários: 150 é de A, 250 é de B.
  if (caminho === '/contatos') return { dados: [{ id: c + 50, nome: 'Prop ' + M, telefone: null }], total: 1, paginas: 1 };
  const im = /^\\/imoveis\\/(\\d+)(\\/contexto)?$/.exec(caminho);
  if (im) {
    const id = Number(im[1]);
    if (id !== c + 1) throw Object.assign(new Error('Não encontrado.'), { codigo: 'NAO_ENCONTRADO' });
    return im[2] ? { combinam: [] } : metodo === 'GET' ? FICHA(id, c) : { ok: true };
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
  // O diálogo guarda o que mostrou; responde o que o teste pôs em RESPOSTA_FORMULARIO.
  formulario: async (a) => {
    window.formularios.push(JSON.stringify(a));
    if (window.FORMULARIO_QUEBRA) throw new Error('diálogo quebrou');
    return window.RESPOSTA_FORMULARIO ?? null;
  },
  // A confirmação fica aberta até o teste responder (window.confirmar(true)).
  confirmar: () => new Promise((r) => window.confirmacoes.push(r)),
  api: async (rota, opcoes) => {
    const [caminho] = rota.split('?');
    const metodo = opcoes?.method ?? 'GET';
    const conta = Number(new Headers(opcoes?.headers).get('X-Conta')) || window.CONTA;
    window.chamadas.push(metodo + ' ' + rota + ' @' + conta + (opcoes?.body ? ' ' + opcoes.body : ''));
    const corpo = opcoes?.body ? String(opcoes.body) : '';
    const responde = () => {
      if (window.FALHAR(metodo, caminho, conta, corpo)) throw new Error('Falha CONTA ' + conta);
      return responder(metodo, caminho, conta);
    };
    if (window.SEGURAR(metodo, caminho, conta, corpo)) return new Promise((r, f) => window.pendentes.push(() => { try { r(responde()); } catch (e) { f(e); } }));
    return responde();
  },
  fetch: async () => new Response('{}'),
};
import './frontend/index';
import { formularioEnviar } from './frontend/apoio';
// O formulário comum das telas (Novo contato, atividade, playbook...), chamado como as telas o chamam.
window.formularioEnviar = formularioEnviar;
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
  // Rejeição sem tratamento também chega como erro de console: nenhuma pode sobrar (nem a de ContaTrocada).
  pagina.on('console', (m: any) => m.type() === 'error' && /Uncaught/.test(m.text()) && erros.push(m.text()));
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
/** A → B → A: a conta volta a ser a do início, mas o gesto começado antes da ida já terminou. */
const idaEVolta = async (p: any) => {
  await trocar(p);
  await esperar(p);
  await p.evaluate(() => (window as any).trocarConta(100));
};
const RESPOSTA_AUTORIZACAO = {
  proprietario_id: '150', inicio: '2026-11-01', fim: '2027-05-01', preco_autorizado: 1, comissao_pct: 6,
  exclusiva: false, permite_placa: true, permite_portais: true, permite_parceria: false,
};

for (const modo of MODOS) {
  test(`Página (${modo}): editar Destaques com a carga de /imoveis em voo; a conta muda; nada de A no diálogo nem PUT em B`, async (t) => {
    await cenario(t, modo, '/pagina', '', async (p) => {
      // Os destaques são escolhidos na própria coluna: escolher o bloco lê os imóveis da conta.
      await p.evaluate(() => {
        const w = window as any;
        w.SEGURAR = (m: string, c: string, k: number) => m === 'GET' && c === '/imoveis' && k === 100;
        w.achar('urbi-arvore').dispatchEvent(new CustomEvent('urbi:arvore-selecao', { detail: { ids: ['destaques'] }, bubbles: true, composed: true }));
      });
      await esperar(p, 50);
      assert.ok((await p.evaluate(() => (window as any).pendentes.length)) > 0, 'a carga dos imóveis de A está em voo');
      await trocar(p);
      await esperar(p);
      await p.evaluate(() => (window as any).liberar());
      await esperar(p);
      const r = await depoisDaTroca(p);
      const caixas = await p.evaluate(() => (window as any).todos().filter((e: Element) => e.localName === 'urbi-checkbox').map((c: Element) => c.getAttribute('label') ?? ''));
      assert.deepEqual(caixas.filter((f: string) => /IM-100|CONTA 100/.test(f)), [], 'a coluna não mostra imóvel de A');
      assert.deepEqual(r.chamadas.filter((c) => c.startsWith('PUT ')), [], 'nenhum PUT /pagina depois da troca');
      assert.deepEqual(r.avisos, []);
      assert.deepEqual(r.alertas, []);
    });
  });

  test(`Página (${modo}): "Tirar do ar" confirmado depois da troca não despublica a página de B`, async (t) => {
    await cenario(t, modo, '/pagina', 'window.PUBLICADA = true', async (p) => {
      await p.evaluate(() => {
        const w = window as any;
        const item = w.porTexto('urbi-dropdown-item', 'Tirar do ar');
        item.dispatchEvent(new CustomEvent('urbi:dropdown-select', { bubbles: true, composed: true }));
      });
      await esperar(p, 50);
      assert.equal(await p.evaluate(() => (window as any).confirmacoes.length), 1, 'a confirmação está aberta em A');
      await trocar(p);
      await esperar(p);
      await p.evaluate(() => (window as any).confirmar(true));
      await esperar(p);
      const r = await depoisDaTroca(p);
      assert.deepEqual(r.chamadas.filter((c) => c.startsWith('POST ')), [], 'nenhum POST /pagina/despublicar');
      assert.deepEqual(r.avisos, []);
      assert.deepEqual(r.alertas, []);
    });
  });

  test(`Página (${modo}): sem troca, o mesmo gesto segue como antes (despublica e avisa)`, async (t) => {
    await cenario(t, modo, '/pagina', 'window.PUBLICADA = true', async (p) => {
      await p.evaluate(() => {
        const w = window as any;
        w.marco = w.chamadas.length;
        w.porTexto('urbi-dropdown-item', 'Tirar do ar').dispatchEvent(new CustomEvent('urbi:dropdown-select', { bubbles: true, composed: true }));
      });
      await esperar(p, 50);
      await p.evaluate(() => (window as any).confirmar(true));
      await esperar(p);
      const r = await depoisDaTroca(p);
      assert.ok(r.chamadas.some((c) => c.startsWith('POST /pagina/despublicar @100')), 'despublica na conta A');
      assert.deepEqual(r.avisos, ['Página fora do ar.']);
    });
  });

  test(`Novo imóvel (${modo}): Concluir com o PATCH em voo; a conta muda; sem envio, aviso nem ida à ficha de A`, async (t) => {
    await cenario(t, modo, '/imoveis/novo?item=101&passo=onde', '', async (p) => {
      await p.evaluate(() => {
        const w = window as any;
        w.SEGURAR = (m: string, c: string, k: number) => m === 'PATCH' && k === 100;
        w.clicar('urbi-botao', 'Concluir');
      });
      await esperar(p, 50);
      assert.ok((await p.evaluate(() => (window as any).chamadas.some((c: string) => c.startsWith('PATCH /imoveis/101 @100')))), 'o PATCH de A saiu');
      await trocar(p);
      await esperar(p);
      await p.evaluate(() => (window as any).liberar());
      await esperar(p);
      const r = await depoisDaTroca(p);
      assert.deepEqual(r.chamadas.filter((c) => !c.startsWith('GET ')), [], 'nenhum PATCH/POST depois da troca');
      assert.deepEqual(r.avisos, [], 'sem "Imóvel ativo e na sua página."');
      assert.deepEqual(r.alertas, []);
      assert.ok(r.url.startsWith('/portal_corretor/imoveis/novo'), `não foi à ficha do imóvel de A (${r.url})`);
    });
  });

  test(`Novo imóvel (${modo}): avançar cria o rascunho; a conta muda com o POST em voo; o resto da cadeia não roda em B`, async (t) => {
    await cenario(t, modo, '/imoveis/novo?passo=dados', '', async (p) => {
      await p.evaluate(() => {
        const w = window as any;
        w.achar('urbi-select[label="Tipo"]').dispatchEvent(new CustomEvent('urbi:select-change', { detail: { valor: 'casa' } }));
        w.achar('urbi-input[label="Cidade"]').dispatchEvent(new CustomEvent('urbi:input-change', { detail: { valor: 'Cidade CONTA 100' } }));
      });
      await esperar(p, 50);
      await p.evaluate(() => {
        const w = window as any;
        w.SEGURAR = (m: string, c: string, k: number) => m === 'POST' && c === '/imoveis' && k === 100;
        w.clicar('urbi-botao', 'Próximo');
      });
      await esperar(p, 50);
      assert.ok((await p.evaluate(() => (window as any).chamadas.some((c: string) => c.startsWith('POST /imoveis @100')))), 'o POST de A saiu');
      await trocar(p);
      await esperar(p);
      await p.evaluate(() => (window as any).liberar());
      await esperar(p);
      const r = await depoisDaTroca(p);
      assert.deepEqual(r.chamadas.filter((c) => /imoveis\/101|^(POST|PATCH|PUT) /.test(c)), [], 'nem releitura do rascunho de A nem escrita em B');
      assert.doesNotMatch(r.url, /item=101/, 'o id de A não vai para o endereço');
      assert.deepEqual(r.avisos, []);
      assert.deepEqual(r.alertas, []);
    });
  });

  test(`Página (${modo}): sem troca, editar Destaques segue como antes (o PUT sai em A e avisa)`, async (t) => {
    await cenario(t, modo, '/pagina?item=destaques', '', async (p) => {
      await p.evaluate(() => {
        const w = window as any;
        w.marco = w.chamadas.length;
      });
      await esperar(p);
      await p.evaluate(() => {
        const w = window as any;
        const caixa = w.todos().find((c: Element) => c.localName === 'urbi-checkbox' && /IM-100/.test(c.getAttribute('label') ?? ''));
        caixa.dispatchEvent(new CustomEvent('urbi:checkbox-change', { detail: { marcado: true }, bubbles: true, composed: true }));
      });
      await esperar(p, 50);
      await p.evaluate(() => (window as any).clicar('urbi-botao', 'Salvar bloco'));
      await esperar(p);
      const r = await depoisDaTroca(p);
      assert.ok(r.chamadas.some((c) => c.startsWith('PUT /pagina @100')), 'o PUT /pagina sai em A');
      assert.deepEqual(r.avisos, ['Salvo.']);
      assert.deepEqual(r.alertas, []);
    });
  });

  test(`Novo imóvel (${modo}): sem troca, Concluir segue como antes (PATCH em A, aviso e ida à ficha)`, async (t) => {
    await cenario(t, modo, '/imoveis/novo?item=101&passo=onde', '', async (p) => {
      await p.evaluate(() => {
        const w = window as any;
        w.marco = w.chamadas.length;
        w.clicar('urbi-botao', 'Concluir');
      });
      await esperar(p);
      const r = await depoisDaTroca(p);
      assert.ok(r.chamadas.some((c) => c.startsWith('PATCH /imoveis/101 @100')), 'o PATCH sai em A');
      assert.deepEqual(r.avisos, ['Imóvel ativo e na sua página.']);
      assert.deepEqual(r.alertas, []);
      assert.equal(r.url, '/portal_corretor/imoveis?item=101', 'vai à ficha do imóvel');
    });
  });

  test(`Novo imóvel (${modo}): Registrar autorização com a carga de proprietários em voo; a conta muda; nada de A no diálogo nem POST em B`, async (t) => {
    await cenario(t, modo, '/imoveis/novo?item=101&passo=autorizacao', '', async (p) => {
      await p.evaluate((resposta: unknown) => {
        const w = window as any;
        w.RESPOSTA_FORMULARIO = resposta;
        w.SEGURAR = (m: string, c: string, k: number) => m === 'GET' && c === '/contatos' && k === 100;
        w.clicar('urbi-botao', 'Registrar autorização');
      }, RESPOSTA_AUTORIZACAO);
      await esperar(p, 50);
      assert.ok((await p.evaluate(() => (window as any).chamadas.some((c: string) => c.startsWith('GET /contatos?papel=proprietario @100')))), 'a carga dos proprietários de A está em voo');
      await trocar(p);
      await esperar(p);
      await p.evaluate(() => (window as any).liberar());
      await esperar(p);
      const r = await depoisDaTroca(p);
      assert.deepEqual(r.formularios.filter((f) => /Autorização de venda|Prop CONTA 100/.test(f)), [], 'o diálogo não abre com proprietário de A');
      assert.deepEqual(r.chamadas.filter((c) => c.startsWith('POST /autorizacoes')), [], 'nenhum POST /autorizacoes');
      assert.deepEqual(r.avisos, []);
      assert.deepEqual(r.alertas, []);
    });
  });

  test(`Novo imóvel (${modo}): sem troca, Registrar autorização segue como antes (diálogo com o proprietário de A e POST em A)`, async (t) => {
    await cenario(t, modo, '/imoveis/novo?item=101&passo=autorizacao', '', async (p) => {
      await p.evaluate((resposta: unknown) => {
        const w = window as any;
        w.marco = w.chamadas.length;
        w.RESPOSTA_FORMULARIO = resposta;
        w.clicar('urbi-botao', 'Registrar autorização');
      }, RESPOSTA_AUTORIZACAO);
      await esperar(p);
      const r = await depoisDaTroca(p);
      assert.ok(r.formularios.some((f) => /Prop CONTA 100/.test(f)), 'o diálogo traz o proprietário de A');
      assert.ok(r.chamadas.some((c) => c.startsWith('POST /autorizacoes @100') && c.includes('"imovel_id":101')), 'o POST sai em A');
      assert.deepEqual(r.avisos, ['Salvo.']);
    });
  });

  test(`Novo imóvel (${modo}): ida e volta A → B → A com a carga de proprietários em voo também encerra o gesto`, async (t) => {
    await cenario(t, modo, '/imoveis/novo?item=101&passo=autorizacao', '', async (p) => {
      await p.evaluate((resposta: unknown) => {
        const w = window as any;
        w.RESPOSTA_FORMULARIO = resposta;
        w.SEGURAR = (m: string, c: string, k: number) => m === 'GET' && c === '/contatos' && k === 100;
        w.clicar('urbi-botao', 'Registrar autorização');
      }, RESPOSTA_AUTORIZACAO);
      await esperar(p, 50);
      await idaEVolta(p);
      await esperar(p);
      // Só a carga do gesto antigo é liberada; a tela recriada em A não segura nada.
      await p.evaluate(() => {
        const w = window as any;
        w.SEGURAR = () => false;
        w.liberar();
      });
      await esperar(p);
      const r = await depoisDaTroca(p);
      assert.deepEqual(r.formularios.filter((f) => /Autorização de venda/.test(f)), [], 'o diálogo do gesto antigo não abre');
      assert.deepEqual(r.chamadas.filter((c) => c.startsWith('POST /autorizacoes')), [], 'nenhum POST /autorizacoes');
      assert.deepEqual(r.avisos, []);
      assert.deepEqual(r.alertas, []);
    });
  });

  test(`Novo imóvel (${modo}): ida e volta A → B → A com o PATCH de Concluir em voo; sem aviso nem ida à ficha`, async (t) => {
    await cenario(t, modo, '/imoveis/novo?item=101&passo=onde', '', async (p) => {
      await p.evaluate(() => {
        const w = window as any;
        w.SEGURAR = (m: string, k: string, c: number) => m === 'PATCH' && c === 100;
        w.clicar('urbi-botao', 'Concluir');
      });
      await esperar(p, 50);
      await idaEVolta(p);
      await esperar(p);
      await p.evaluate(() => {
        const w = window as any;
        w.SEGURAR = () => false;
        w.liberar();
      });
      await esperar(p);
      const r = await depoisDaTroca(p);
      assert.deepEqual(r.chamadas.filter((c) => !c.startsWith('GET ')), [], 'nenhum PATCH/POST depois da troca');
      assert.deepEqual(r.avisos, []);
      assert.deepEqual(r.alertas, []);
      assert.ok(r.url.startsWith('/portal_corretor/imoveis/novo'), `não foi à ficha (${r.url})`);
    });
  });
}

// ---------- Guarda único do envio: respostas e erros EM VOO na troca (issue #144, rodada 3) ----------
//
// O guarda de `chamarApi`/`enviar` (apoio.ts) rejeita com `ContaTrocada` a resposta ou o erro de um pedido
// que saiu na conta A e volta com a conta já em B. Os casos abaixo são os do laudo: o alerta da importação
// (com o usuário fora da tela de Importar), o aviso da carga da Página (idem), o `formularioEnviar` e o
// salvar/refazer da Página. Cada um com o controle sem troca, para o teste não passar no vazio.

/** Mesma tela, sem troca: a resposta (ou o erro) chega e é mostrada como sempre. */
const semTroca = (p: any) => p.evaluate(() => ((window as any).marco = (window as any).chamadas.length));

/** Escolhe a planilha (uma coluna `nome`) e manda importar, com o POST da importação (não a prévia) em voo e falhando. */
async function importarEmVoo(p: any) {
  await p.evaluate(async () => {
    const w = window as any;
    const tela = w.achar('pc-tela-importar');
    await tela.escolher({ detail: { arquivo: new File(['nome,telefone\nAna,61999990000\n'], 'contatos.csv', { type: 'text/csv' }) } });
    const daImportacao = (m: string, c: string, k: number, corpo: string) => m === 'POST' && c === '/contatos/importar' && k === 100 && !corpo.includes('"simular":true');
    w.SEGURAR = daImportacao;
    w.FALHAR = daImportacao;
    void tela.importar();
  });
  await esperar(p, 50);
  assert.equal(await p.evaluate(() => (window as any).pendentes.length), 1, 'a importação de A está em voo');
  // O usuário sai da tela de Importar (a `visita` dela não avança mais) antes da troca.
  await p.evaluate(() => (window as any).urbiVerso.navegarSub('/clientes'));
  await esperar(p);
}

/** Volta à Página com a carga de A em voo e falhando, e sai dela antes da troca. */
async function cargaDaPaginaEmVoo(p: any) {
  await p.evaluate(() => (window as any).urbiVerso.navegarSub('/clientes'));
  await esperar(p);
  await p.evaluate(() => {
    const w = window as any;
    const daCarga = (m: string, c: string, k: number) => m === 'GET' && c === '/pagina' && k === 100;
    w.SEGURAR = daCarga;
    w.FALHAR = daCarga;
    w.urbiVerso.navegarSub('/pagina');
  });
  await esperar(p, 50);
  assert.equal(await p.evaluate(() => (window as any).pendentes.length), 1, 'a carga da Página de A está em voo');
  await p.evaluate(() => (window as any).urbiVerso.navegarSub('/clientes'));
  await esperar(p);
}

const AVISO_CARGA = 'Não foi possível atualizar a página. Mostrando a última leitura.';

for (const modo of MODOS) {
  test(`em voo (${modo}): a importação de A falha depois da troca, com o usuário fora de Importar; nenhum alerta em B`, async (t) => {
    await cenario(t, modo, '/clientes/importar', '', async (p) => {
      await importarEmVoo(p);
      await trocar(p);
      await esperar(p);
      await p.evaluate(() => (window as any).liberar());
      await esperar(p);
      const r = await depoisDaTroca(p);
      assert.deepEqual(r.alertas, [], 'o alerta "A importação parou" de A não abre em B');
      assert.deepEqual(r.avisos, []);
    });
  });

  test(`em voo (${modo}): sem troca, a importação que falha avisa como antes (controle)`, async (t) => {
    await cenario(t, modo, '/clientes/importar', '', async (p) => {
      await importarEmVoo(p);
      await semTroca(p);
      await p.evaluate(() => (window as any).liberar());
      await esperar(p);
      assert.deepEqual((await depoisDaTroca(p)).alertas, ['A importação parou']);
    });
  });

  test(`em voo (${modo}): a carga da Página de A falha depois da troca; sem aviso em B nem prévia pedida com a conta nova`, async (t) => {
    await cenario(t, modo, '/pagina', '', async (p) => {
      await cargaDaPaginaEmVoo(p);
      await trocar(p);
      await esperar(p);
      await p.evaluate(() => (window as any).liberar());
      await esperar(p);
      const r = await depoisDaTroca(p);
      assert.deepEqual(r.avisos, [], 'o aviso da carga de A não aparece em B');
      assert.deepEqual(r.alertas, []);
      assert.deepEqual(r.chamadas.filter((c) => c.startsWith('GET /pagina')), [], 'nem a prévia sai em B pela continuação de A');
    });
  });

  test(`em voo (${modo}): sem troca, a carga da Página que falha avisa como antes (controle)`, async (t) => {
    await cenario(t, modo, '/pagina', '', async (p) => {
      await cargaDaPaginaEmVoo(p);
      await semTroca(p);
      await p.evaluate(() => (window as any).liberar());
      await esperar(p);
      assert.deepEqual((await depoisDaTroca(p)).avisos, [AVISO_CARGA]);
    });
  });

  for (const falha of [false, true]) {
    test(`em voo (${modo}): formularioEnviar com o envio de A em voo (${falha ? 'falha' : 'sucesso'}); a conta muda; nem "Salvo." nem alerta, e devolve null`, async (t) => {
      await cenario(t, modo, '/clientes', '', async (p) => {
        await p.evaluate((falhar: boolean) => {
          const w = window as any;
          w.RESPOSTA_FORMULARIO = { nome: 'Ana' };
          w.SEGURAR = (m: string, c: string, k: number) => m === 'POST' && c === '/contatos' && k === 100;
          if (falhar) w.FALHAR = w.SEGURAR;
          // Como as telas chamam: `void formularioEnviar(...).then(...)`, sem `.catch`.
          void w.formularioEnviar('Novo contato', [], 'POST', '/contatos').then((r: unknown) => (w.resultado = r));
        }, falha);
        await esperar(p, 50);
        assert.equal(await p.evaluate(() => (window as any).pendentes.length), 1, 'o POST de A está em voo');
        await trocar(p);
        await esperar(p);
        await p.evaluate(() => (window as any).liberar());
        await esperar(p);
        const r = await depoisDaTroca(p);
        assert.deepEqual(r.avisos, []);
        assert.deepEqual(r.alertas, []);
        assert.equal(await p.evaluate(() => (window as any).resultado), null);
      });
    });
  }

  test(`em voo (${modo}): sem troca, formularioEnviar avisa como antes; o diálogo que quebra vira alerta, sem rejeição solta (controle)`, async (t) => {
    await cenario(t, modo, '/clientes', '', async (p) => {
      await p.evaluate(async () => {
        const w = window as any;
        w.marco = w.chamadas.length;
        w.RESPOSTA_FORMULARIO = { nome: 'Ana' };
        // Recusado (#187): o formulário reabre com o digitado e o erro; o corretor cancela na reabertura.
        w.FALHAR = (m: string, c: string) => m === 'POST' && c === '/contatos' && ((w.RESPOSTA_FORMULARIO = null), true);
        w.antes = w.formularios.length;
        await w.formularioEnviar('Novo contato', [{ nome: 'nome', tipo: 'texto' }], 'POST', '/contatos');
        w.reaberto = w.formularios[w.antes + 1];
        w.FALHAR = () => false;
        w.RESPOSTA_FORMULARIO = { nome: 'Ana' };
        await w.formularioEnviar('Novo contato', [], 'POST', '/contatos');
        w.FORMULARIO_QUEBRA = true;
        void w.formularioEnviar('Novo contato', [], 'POST', '/contatos').then((r: unknown) => (w.resultado = r));
      });
      await esperar(p);
      const r = await depoisDaTroca(p);
      const reaberto = JSON.parse(await p.evaluate(() => (window as any).reaberto));
      assert.equal(reaberto.campos[0].valor, 'Ana', 'reabre com o digitado');
      assert.match(reaberto.mensagem, /^Não foi possível salvar: /, 'com a frase do erro');
      assert.deepEqual(r.alertas, ['Não foi possível abrir o formulário'], 'a recusa não vira alerta solto');
      assert.deepEqual(r.avisos, ['Salvo.']);
      assert.equal(await p.evaluate(() => (window as any).resultado), null);
    });
  });

  for (const falha of [false, true]) {
    test(`em voo (${modo}): salvar da Página (editar bloco) com o PUT de A em voo (${falha ? 'falha' : 'sucesso'}); a conta muda; nada avisado nem gravado em B`, async (t) => {
      await cenario(t, modo, '/pagina?item=apresentacao', '', async (p) => {
        await p.evaluate((falhar: boolean) => {
          const w = window as any;
          w.SEGURAR = (m: string, c: string, k: number) => m === 'PUT' && c === '/pagina' && k === 100;
          if (falhar) w.FALHAR = w.SEGURAR;
          w.achar('urbi-input[label="Título do bloco"]').dispatchEvent(new CustomEvent('urbi:input-change', { detail: { valor: 'Título novo' } }));
        }, falha);
        await esperar(p, 50);
        await p.evaluate(() => (window as any).clicar('urbi-botao', 'Salvar bloco'));
        await esperar(p, 50);
        assert.equal(await p.evaluate(() => (window as any).pendentes.length), 1, 'o PUT /pagina de A está em voo');
        await trocar(p);
        await esperar(p);
        await p.evaluate(() => (window as any).liberar());
        await esperar(p);
        const r = await depoisDaTroca(p);
        assert.deepEqual(r.avisos, [], 'nem "Salvo." nem aviso de A em B');
        assert.deepEqual(r.alertas, []);
        assert.deepEqual(r.chamadas.filter((c) => !c.startsWith('GET ')), [], 'nenhuma escrita em B');
        // A tela de B segue livre (a trava do salvar de A não ficou presa nela): editar em B salva em B.
        await p.evaluate(() => (window as any).achar('urbi-input[label="Título do bloco"]').dispatchEvent(new CustomEvent('urbi:input-change', { detail: { valor: 'Título de B' } })));
        await esperar(p, 50);
        await p.evaluate(() => (window as any).clicar('urbi-botao', 'Salvar bloco'));
        await esperar(p);
        const b = await depoisDaTroca(p);
        assert.ok(b.chamadas.some((c) => c.startsWith('PUT /pagina @200')), 'o salvar de B sai em B');
        assert.deepEqual(b.avisos, ['Salvo.']);
      });
    });

    test(`em voo (${modo}): refazer a Página com IA, com os textos de A em voo (${falha ? 'falha' : 'sucesso'}); a conta muda; nem confirmação, nem alerta, nem PUT em B`, async (t) => {
      await cenario(t, modo, '/pagina', '', async (p) => {
        await p.evaluate((falhar: boolean) => {
          const w = window as any;
          w.RESPOSTA_FORMULARIO = { observacoes: 'Atendo no Lago Sul.' };
          w.SEGURAR = (m: string, c: string, k: number) => m === 'POST' && c === '/pagina/sugerir-textos' && k === 100;
          if (falhar) w.FALHAR = w.SEGURAR;
          w.clicar('urbi-botao', 'Refazer a página com IA');
        }, falha);
        await esperar(p, 50);
        assert.equal(await p.evaluate(() => (window as any).pendentes.length), 1, 'o pedido de textos de A está em voo');
        await trocar(p);
        await esperar(p);
        await p.evaluate(() => (window as any).liberar());
        await esperar(p);
        const r = await depoisDaTroca(p);
        assert.equal(await p.evaluate(() => (window as any).confirmacoes.length), 0, '"Usar estes textos?" de A não abre em B');
        assert.deepEqual(r.alertas, [], '"Não foi possível escrever agora" de A não abre em B');
        assert.deepEqual(r.avisos, []);
        assert.deepEqual(r.chamadas.filter((c) => !c.startsWith('GET ')), [], 'nenhuma escrita em B');
      });
    });

    // Controle do caso acima (issue #157): sem troca, o refazer segue como sempre.
    test(`em voo (${modo}): sem troca, refazer a Página com IA (${falha ? 'falha' : 'sucesso'}) segue como antes (controle)`, async (t) => {
      await cenario(t, modo, '/pagina', '', async (p) => {
        await p.evaluate((falhar: boolean) => {
          const w = window as any;
          w.RESPOSTA_FORMULARIO = { observacoes: 'Atendo no Lago Sul.' };
          w.SEGURAR = (m: string, c: string, k: number) => m === 'POST' && c === '/pagina/sugerir-textos' && k === 100;
          if (falhar) w.FALHAR = w.SEGURAR;
          w.clicar('urbi-botao', 'Refazer a página com IA');
        }, falha);
        await esperar(p, 50);
        assert.equal(await p.evaluate(() => (window as any).pendentes.length), 1, 'o pedido de textos está em voo');
        await semTroca(p);
        await p.evaluate(() => (window as any).liberar());
        await esperar(p);
        if (falha) {
          const r = await depoisDaTroca(p);
          assert.deepEqual(r.alertas, ['Não foi possível escrever agora']);
          assert.equal(await p.evaluate(() => (window as any).confirmacoes.length), 0);
          return;
        }
        assert.equal(await p.evaluate(() => (window as any).confirmacoes.length), 1, '"Usar estes textos?" abre em A');
        await p.evaluate(() => (window as any).confirmar(true));
        await esperar(p);
        const r = await depoisDaTroca(p);
        assert.ok(r.chamadas.some((c) => c.startsWith('PUT /pagina @100')), `os textos são gravados em A: ${JSON.stringify(r.chamadas)}`);
        assert.ok(!r.chamadas.some((c) => c.includes('@200')), 'nada em B');
        assert.deepEqual(r.alertas, []);
      });
    });
  }
}
