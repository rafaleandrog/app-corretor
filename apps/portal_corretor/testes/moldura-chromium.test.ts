import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

// A moldura no DOM de verdade (Chromium): propriedades e eventos ligados, a árvore de primitivos
// travada e nenhum estilo próprio. Os primitivos `urbi-*` são da instância e não vêm no SDK; aqui são
// elementos sem registro, então o teste mede a ESTRUTURA que a moldura entrega a eles (tags, slots,
// atributos, propriedades), não larguras. As larguras são as dos primitivos e se conferem na instância.
// Sem Playwright instalado (o CI do kit não traz navegador), o teste pula.

function playwright(): any {
  try {
    return createRequire(import.meta.url)('playwright');
  } catch {
    return null;
  }
}

const ENTRADA = `
import { render } from 'lit';
import { comAssistente, moldura } from './frontend/moldura';
import { ESTADOS, estadoTela } from './frontend/estados';
import { abrirAssistente, aoMudarAssistente, fecharAssistente } from './frontend/telas/assistente';
const navegou = [];
window.navegou = navegou;
window.urbiVerso = {
  subRota: () => '/numeros',
  href: (s) => '/portal_corretor' + s,
  navegarSub: (s) => navegou.push(s),
  usuario: () => ({ id: 1, nome: 'Marina' }),
  contexto: () => ({ contaEscrita: 100 }),
  api: async () => ({ assistente: true }),
  notificar: () => {},
};
const raiz = document.getElementById('raiz');
let modo = 'completa';
let menu = '/numeros';
const desenhar = () => render(
  modo === 'sem-lista' ? moldura({ menu, centro: 'CENTRO', contexto: 'CONTEXTO' }, desenhar)
    : modo === 'comAssistente' ? comAssistente('TELA')
    : moldura({ menu, lista: 'LISTA', centro: 'CENTRO', contexto: 'CONTEXTO' }, desenhar),
  raiz,
);
window.desenhar = () => ((modo = 'completa'), desenhar());
window.desenharSemLista = () => ((modo = 'sem-lista'), desenhar());
window.desenharComAssistente = () => ((modo = 'comAssistente'), desenhar());
window.desenharMenu = (m) => ((menu = m), (modo = 'completa'), desenhar());
// Como o app raiz (index.ts): a conversa redesenha a página quando muda.
aoMudarAssistente(desenhar);
window.fecharAssistente = fecharAssistente;
window.abrirAssistente = abrirAssistente;
window.estados = () => ESTADOS.map((t) => {
  const div = document.createElement('div');
  render(estadoTela(t, { aoTentar: () => {}, acao: { rotulo: 'Resolver', aoEscolher: () => {} } }), div);
  return [t, [...div.querySelectorAll('*')].map((e) => e.localName)];
});
desenhar();
`;

test('moldura no Chromium: árvore de primitivos, trilho ligado, Assistente na direita e sem CSS próprio', async (t) => {
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
    const pagina = await navegador.newPage({ viewport: { width: 1440, height: 900 } });
    await pagina.setContent('<!doctype html><html><body><div id="raiz"></div></body></html>');
    await pagina.addScriptTag({ content: pacote.outputFiles[0].text });

    const arvore = await pagina.evaluate(() => {
      const q = (s: string) => document.querySelector(s);
      const trilho = q('#raiz > urbi-inbox > urbi-trilho-atalhos[slot="sidebar-trilho"]') as any;
      const colunas = q('#raiz > urbi-inbox > urbi-3-colunas[slot="detalhe"]');
      const hosp = (slot: string) => q(`urbi-3-colunas > urbi-hospedeiro[slot="${slot}"][expandir]`)?.textContent?.trim();
      return {
        inbox: ['largura-sidebar', 'largura-min-sidebar', 'texto-voltar'].map((a) => q('#raiz > urbi-inbox')?.getAttribute(a)),
        detalheVisivel: q('#raiz > urbi-inbox')?.hasAttribute('detalhe-visivel'),
        trilho: trilho?.itens?.map((i: any) => `${i.rotulo}${i.ativo ? '*' : ''}`),
        colunas: ['largura-esquerda', 'largura-direita', 'painel-ativo'].map((a) => colunas?.getAttribute(a)),
        flags: ['redimensionavel', 'colapsavel-esquerda', 'colapsavel-direita'].map((a) => colunas?.hasAttribute(a)),
        conteudo: [hosp('esquerda'), hosp('centro'), hosp('direita')],
        estilos: document.querySelectorAll('style, [style]').length,
      };
    });
    assert.deepEqual(arvore.inbox, ['0px', '0px', 'Menu']);
    assert.equal(arvore.detalheVisivel, true);
    assert.deepEqual(arvore.trilho, ['Hoje', 'Clientes', 'Imóveis', 'Estúdio', 'Página', 'Números*', 'Ajustes', 'Assistente']);
    assert.deepEqual(arvore.colunas, ['360px', '320px', 'centro']);
    assert.deepEqual(arvore.flags, [true, true, true]);
    assert.deepEqual(arvore.conteudo, ['LISTA', 'CENTRO', 'CONTEXTO']);
    assert.equal(arvore.estilos, 0, 'nenhum <style> nem style= na moldura');

    // Clique no trilho: navega pelo `navegarSub`; o Assistente abre na coluna da direita.
    const depois = await pagina.evaluate(async () => {
      const trilho = document.querySelector('urbi-trilho-atalhos')!;
      trilho.dispatchEvent(new CustomEvent('urbi:atalho-click', { detail: { id: '/clientes' }, bubbles: true, composed: true }));
      trilho.dispatchEvent(new CustomEvent('urbi:atalho-click', { detail: { id: 'assistente' }, bubbles: true, composed: true }));
      await new Promise((r) => setTimeout(r, 0));
      const direita = document.querySelector('urbi-3-colunas > urbi-hospedeiro[slot="direita"]')!;
      const r = {
        navegou: (window as any).navegou.slice(),
        // O chat é filho DIRETO da coluna (sem hospedeiro entre eles), com `expandir`; o topo é o hospedeiro irmão.
        chat: !!document.querySelector('urbi-3-colunas > urbi-chat[slot="direita"][expandir]'),
        chatEmHospedeiro: !!document.querySelector('urbi-hospedeiro urbi-chat'),
        contexto: direita.textContent!.includes('CONTEXTO'),
        centro: document.querySelector('urbi-hospedeiro[slot="centro"]')!.textContent!.trim(),
        largura: document.querySelector('urbi-3-colunas')!.getAttribute('largura-direita'),
        ativo: (document.querySelector('urbi-trilho-atalhos') as any).itens.filter((i: any) => i.ativo).map((i: any) => i.id),
      };
      // Fechar pelo botão do painel devolve o contexto.
      (direita.querySelector('urbi-botao[icone="fa-solid fa-xmark"]') as HTMLElement).click();
      r.contexto = document.querySelector('urbi-hospedeiro[slot="direita"]')!.textContent!.includes('CONTEXTO');
      return r;
    });
    assert.deepEqual(depois.navegou, ['/clientes']);
    assert.equal(depois.chat, true, 'chat filho direto do slot direita do urbi-3-colunas');
    assert.equal(depois.chatEmHospedeiro, false, 'nenhum hospedeiro em volta do chat');
    assert.equal(depois.centro, 'CENTRO', 'o centro fica');
    assert.equal(depois.largura, '400px');
    assert.deepEqual(depois.ativo, ['assistente']);
    assert.equal(depois.contexto, true, 'fechar devolve o contexto');

    // Sem lista (`urbi-2x1`) e tela fora da moldura (`comAssistente`): topo na zona `direita-topo`, chat solto em `direita`.
    const doisLayouts = await pagina.evaluate(async () => {
      const w = window as any;
      const medir = () => ({
        chat: !!document.querySelector('urbi-2x1 > urbi-chat[slot="direita"][expandir]'),
        topo: !!document.querySelector('urbi-2x1 > urbi-hospedeiro[slot="direita-topo"] urbi-botao[icone="fa-solid fa-xmark"]'),
        emHospedeiro: !!document.querySelector('urbi-hospedeiro urbi-chat'),
      });
      w.fecharAssistente();
      w.desenharSemLista();
      w.abrirAssistente();
      await new Promise((r) => setTimeout(r, 0));
      const semLista = medir();
      w.fecharAssistente();
      w.desenharComAssistente();
      w.abrirAssistente();
      await new Promise((r) => setTimeout(r, 0));
      const comAssist = medir();
      w.fecharAssistente();
      return { semLista, comAssist };
    });
    for (const [nome, m] of Object.entries(doisLayouts)) assert.deepEqual(m, { chat: true, topo: true, emHospedeiro: false }, nome);

    // Celular: o Voltar mostra o trilho e trocar de tela por fora dele devolve as colunas.
    const celular = await pagina.evaluate(() => {
      const w = window as any;
      w.desenhar();
      const inbox = () => document.querySelector('#raiz > urbi-inbox')!;
      inbox().dispatchEvent(new CustomEvent('urbi:inbox-voltar', { bubbles: true, composed: true }));
      const noTrilho = !inbox().hasAttribute('detalhe-visivel');
      w.desenharMenu('/clientes');
      return { noTrilho, depois: inbox().hasAttribute('detalhe-visivel') };
    });
    assert.deepEqual(celular, { noTrilho: true, depois: true });

    // Os 7 estados no DOM: cada um com o primitivo certo.
    const estados = Object.fromEntries(await pagina.evaluate(() => (window as any).estados()));
    assert.ok(estados.carregando.includes('urbi-loading'));
    assert.ok(estados.vazio.includes('urbi-estado-vazio') && estados.vazio.includes('urbi-botao'));
    assert.ok(estados.erro.includes('urbi-banner') && estados.erro.includes('urbi-botao'));
    assert.ok(estados.sem_permissao.includes('urbi-estado-vazio'));
    for (const faixa of ['desconectada', 'sem_credito', 'ia_indisponivel']) assert.ok(estados[faixa].includes('urbi-banner'), faixa);
  } finally {
    await navegador.close();
  }
});
