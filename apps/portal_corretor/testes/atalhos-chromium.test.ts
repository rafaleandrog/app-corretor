import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

// Atalhos de teclado no DOM de verdade (Chromium, spec 11.0.6, item B10): a tecla digitada pelo teclado
// num campo de texto, inclusive dentro de um shadow root (como os das telas e dos primitivos), não
// dispara atalho; fora dele, J/K andam na lista registrada, E abre a edição e `/` abre a busca.
// Sem Playwright instalado (o CI do kit não traz navegador), o teste pula.

function playwright(): any {
  try {
    return createRequire(import.meta.url)('playwright');
  } catch {
    return null;
  }
}

const ENTRADA = `
import { instalarAtalhos, registrarEdicao, registrarLista, soltarLista } from './frontend/atalhos';
import { aoMudarAssistente, assistenteAberto } from './frontend/telas/assistente';
const log = [];
let ultimoEstado = false;
aoMudarAssistente(() => { if (assistenteAberto() !== ultimoEstado) { ultimoEstado = assistenteAberto(); log.push('assistente ' + ultimoEstado); } });
window.corretor = true;
// "Criar" escolhe Novo imóvel, para conferir o caminho até o destino; os demais formulários fecham.
window.log = log;
window.urbiVerso = {
  subRota: () => '/clientes',
  href: (s) => '/portal_corretor' + s,
  navegarSub: (s) => log.push('navegar ' + s),
  contexto: () => ({ contaEscrita: 100, roles: ['corretor'] }),
  api: async () => ({}),
  notificar: () => {},
  formulario: async (op) => (log.push('formulario ' + op.titulo), op.titulo === 'Criar' ? { opcao: 'imovel' } : null),
};
let atual = 7;
const dono = {};
registrarLista(dono, { ids: () => [4, 7, 9], atual: () => atual, escolher: (id) => { atual = id; log.push('escolher ' + id); } });
registrarEdicao({}, () => log.push('editar'));
window.soltar = () => soltarLista(dono);
instalarAtalhos(() => window.corretor);

// Um campo solto, um dentro de shadow root aberto e um conteúdo editável.
const host = document.createElement('div');
host.id = 'host';
document.body.append(host);
const raiz = host.attachShadow({ mode: 'open' });
raiz.innerHTML = '<input id="sombra">';
document.body.insertAdjacentHTML('beforeend', '<input id="solto"><textarea id="area"></textarea><div id="editavel" contenteditable="true"></div><button id="botao">ok</button>');
`;

test('atalhos no Chromium: nada dispara no campo de texto; fora dele, J/K, E e /', async (t) => {
  const pw = playwright();
  if (!pw) return t.skip('Playwright não instalado neste ambiente');
  const pacote = await build({
    stdin: { contents: ENTRADA, resolveDir: process.cwd(), loader: 'ts' },
    bundle: true,
    write: false,
    format: 'iife',
    target: 'es2022',
    tsconfig: 'tsconfig.json',
    logLevel: 'silent',
  });
  const navegador = await pw.chromium.launch();
  try {
    const pagina = await navegador.newPage();
    await pagina.setContent('<!doctype html><html><body></body></html>');
    await pagina.addScriptTag({ content: pacote.outputFiles[0].text });
    const log = () => pagina.evaluate(() => (window as any).log.splice(0));

    // Digitando nos campos: o texto entra e nenhum atalho age.
    for (const alvo of ['#solto', '#area', '#editavel']) {
      await pagina.click(alvo);
      await pagina.keyboard.type('jke/ca');
      assert.deepEqual(await log(), [], alvo);
    }
    await pagina.locator('#host').evaluate((h: any) => h.shadowRoot.getElementById('sombra').focus());
    await pagina.keyboard.type('jke/ca');
    assert.deepEqual(await log(), [], 'input dentro de shadow root');
    assert.equal(await pagina.locator('#host').evaluate((h: any) => h.shadowRoot.getElementById('sombra').value), 'jke/ca');
    assert.equal(await pagina.inputValue('#solto'), 'jke/ca');

    // Fora dos campos (num botão), os atalhos agem.
    await pagina.focus('#botao');
    await pagina.keyboard.press('j');
    await pagina.keyboard.press('j');
    await pagina.keyboard.press('j');
    await pagina.keyboard.press('k');
    await pagina.keyboard.press('e');
    await pagina.keyboard.press('Control+j');
    assert.deepEqual(await log(), ['escolher 9', 'escolher 7', 'editar'], 'J na ponta fica; Ctrl+J é do navegador');
    await pagina.keyboard.press('/');
    await pagina.keyboard.press('Shift+C');
    await new Promise((r) => setTimeout(r, 50));
    assert.deepEqual(await log(), ['formulario Buscar', 'formulario Criar', 'navegar /imoveis/novo'], 'C chega ao destino da opção escolhida');

    // A abre e fecha o Assistente.
    await pagina.keyboard.press('a');
    await pagina.keyboard.press('Shift+A');
    assert.deepEqual(await log(), ['assistente true', 'assistente false']);

    // Quem não é corretor: /, C e A não fazem nada; J/K e E seguem com a lista e a ficha registradas.
    await pagina.evaluate(() => ((window as any).corretor = false));
    for (const tecla of ['/', 'c', 'a']) await pagina.keyboard.press(tecla);
    await pagina.keyboard.press('k');
    await pagina.keyboard.press('e');
    await new Promise((r) => setTimeout(r, 50));
    assert.deepEqual(await log(), ['escolher 4', 'editar'], 'sem papel de corretor, só a navegação na lista e a edição');
    await pagina.evaluate(() => ((window as any).corretor = true));

    // Lista que saiu da tela não responde mais.
    await pagina.evaluate(() => (window as any).soltar());
    await pagina.keyboard.press('j');
    assert.deepEqual(await log(), []);
  } finally {
    await navegador.close();
  }
});
