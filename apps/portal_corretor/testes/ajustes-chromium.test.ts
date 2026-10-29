import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

// Ajustes no Padrão B (B8, issue #97) no DOM de verdade (Chromium): as seções no menu da esquerda, o
// conteúdo da seção no centro e a ajuda, o Assistente e (em Conta e marca) o aviso do CRECI à direita.
// `?aba=` e os apelidos antigos abrem a seção certa; o retorno do Instagram segue em Conexões. Os
// primitivos `urbi-*` são elementos sem registro: o teste mede a estrutura e os dados que a tela entrega
// a eles. Sem Playwright instalado, pula.

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
import { renderAjustes } from './frontend/telas/ajustes';
window.chamadas = [];
window.urbiVerso = {
  subRota: () => location.pathname.replace(/^\\/portal_corretor/, '') || '/',
  href: (s) => '/portal_corretor' + s,
  navegarSub: () => {},
  usuario: () => ({ id: 1, nome: 'Marina' }),
  contexto: () => ({ conta: { resolucao: 'escopado', contas: [{ id: 100, nome: 'A' }], contaEscrita: 100 } }),
  notificar: () => {},
  alertar: async () => {},
  api: async (rota) => {
    window.chamadas.push(rota);
    const [caminho] = rota.split('?');
    if (caminho === '/conta') return {
      perfil: { nome: 'Imobiliária Marina', tipo: 'corretor_autonomo', documento: null, creci_juridico: null },
      configuracoes: { prazo_primeiro_atendimento_min: 30, dias_cliente_parado: 7, validade_selecao_dias: 15, lembrete_visita_horas: 2 },
      meu_perfil: { creci: window.comCreci ? 'DF-12345-F' : null, telefone: '61999990000' },
    };
    if (caminho === '/estudio/marca') return { cor_primaria: '#123456', cor_secundaria: '#abcdef', estilo: 'moderno', assinatura: null, logo_url: null, referencias: [] };
    if (caminho === '/conexoes') return { instagram: null, disponivel: true, retorno: 'https://app.exemplo/portal_corretor/ajustes/conexoes' };
    return {};
  },
};
const raiz = document.getElementById('raiz');
const desenhar = () => render(renderAjustes(desenhar), raiz);
window.desenhar = desenhar;
desenhar();
`;

const PROFUNDO = `
window.profundo = (no) => {
  if (!no) return '';
  const partes = [];
  const andar = (n) => {
    if (n.nodeType === 3) partes.push(n.textContent);
    if (n.nodeType === 1) for (const a of ['titulo', 'mensagem', 'submensagem']) if (n.getAttribute(a)) partes.push(n.getAttribute(a));
    if (n.shadowRoot) andar(n.shadowRoot);
    for (const f of n.childNodes) andar(f);
  };
  andar(no);
  return partes.join(' ').replace(/\\s+/g, ' ').trim();
};
window.todos = (raiz, seletor) => {
  const fila = [raiz];
  const achados = [];
  while (fila.length) {
    const n = fila.shift();
    if (n.shadowRoot) fila.push(n.shadowRoot);
    for (const e of n.querySelectorAll?.(seletor) ?? []) achados.push(e);
    for (const e of n.querySelectorAll?.('*') ?? []) if (e.shadowRoot) fila.push(e.shadowRoot);
  }
  return achados;
};
`;

test('Ajustes no Chromium: seções à esquerda, conteúdo no centro, ajuda à direita, ?aba= e apelidos', async (t) => {
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
  const html = `<!doctype html><html><head><meta charset="utf-8"></head><body><div id="raiz"></div><script>${PROFUNDO}</script><script>${pacote.outputFiles[0].text}</script></body></html>`;
  const navegador = await pw.chromium.launch();
  try {
    const pagina = await navegador.newPage({ viewport: { width: 1440, height: 900 } });
    const erros: string[] = [];
    pagina.on('pageerror', (e: Error) => erros.push(e.message));
    await pagina.route(`${ORIGEM}/**`, (r: any) => r.fulfill({ contentType: 'text/html', body: html }));
    const esperar = () => pagina.waitForTimeout(80);
    const ler = () =>
      pagina.evaluate(() => {
        const w = window as any;
        const colunas = document.querySelector('urbi-3-colunas')!;
        const lista = w.todos(colunas.querySelector('urbi-hospedeiro[slot="esquerda"]'), 'urbi-lista')[0];
        return {
          url: location.pathname + location.search,
          secoes: lista?.itens?.map((s: any) => s.label),
          ativa: lista?.itens?.filter((s: any) => lista.itemAtivo(s)).map((s: any) => s.id),
          centro: w.profundo(colunas.querySelector('urbi-hospedeiro[slot="centro"]')),
          direita: w.profundo(colunas.querySelector('urbi-hospedeiro[slot="direita"]')),
          estilos: document.querySelectorAll('#raiz style, #raiz [style]').length,
        };
      });

    // /ajustes sem seção: Conta e marca, com os dados e a marca no centro e o aviso do CRECI à direita.
    await pagina.goto(`${ORIGEM}/portal_corretor/ajustes`);
    await esperar();
    let r: any = await ler();
    assert.deepEqual(r.secoes, ['Mensageiro', 'Negociador', 'Conexões', 'Conta e marca', 'Funil e abordagens', 'Horário de atendimento', 'Privacidade']);
    assert.deepEqual(r.ativa, ['conta']);
    assert.match(r.centro, /Seus dados/);
    assert.match(r.centro, /Sua marca/);
    assert.doesNotMatch(r.centro, /Adicione seu CRECI/, 'o aviso do CRECI saiu do centro');
    assert.match(r.direita, /Adicione seu CRECI ao perfil/);
    assert.match(r.direita, /Perguntar ao Assistente/);
    assert.equal(r.estilos, 0, 'nenhum <style> nem style= na tela');

    // Escolher Mensageiro: `?aba=` na URL, o estado bloqueado no centro e nenhuma configuração.
    await pagina.evaluate(() => {
      const w = window as any;
      const lista = w.todos(document.querySelector('urbi-hospedeiro[slot="esquerda"]'), 'urbi-lista')[0];
      lista.dispatchEvent(new CustomEvent('urbi:lista-click', { detail: { item: { id: 'mensageiro' } }, bubbles: true, composed: true }));
    });
    await esperar();
    r = await ler();
    assert.equal(r.url, '/portal_corretor/ajustes?aba=mensageiro');
    assert.deepEqual(r.ativa, ['mensageiro']);
    assert.match(r.centro, /O Mensageiro chega com a conexão do WhatsApp/);
    assert.doesNotMatch(r.direita, /CRECI/, 'o aviso do CRECI é só de Conta e marca');
    // Recarregar mantém a seção.
    await pagina.reload();
    await esperar();
    assert.deepEqual((await ler()).ativa, ['mensageiro']);

    // Negociador: "em breve", reservado para o D4.
    await pagina.goto(`${ORIGEM}/portal_corretor/ajustes?aba=negociador`);
    await esperar();
    assert.match((await ler()).centro, /Em breve/);

    // O retorno do Instagram (/ajustes/conexoes) abre Conexões: Instagram real, WhatsApp e Agenda.
    await pagina.goto(`${ORIGEM}/portal_corretor/ajustes/conexoes`);
    await esperar();
    r = await ler();
    assert.deepEqual(r.ativa, ['conexoes']);
    assert.match(r.centro, /Conectar Instagram/);
    assert.match(r.centro, /WhatsApp ainda não disponível/);
    assert.match(r.centro, /Agenda fase 6/);
    assert.match(r.direita, /Por que conectar aqui/);

    // Apelidos: /ajustes/marca e ?aba=marca abrem Conta e marca; /conta também. Com CRECI, sem aviso.
    for (const caminho of ['/portal_corretor/ajustes/marca', '/portal_corretor/ajustes?aba=marca', '/portal_corretor/conta']) {
      await pagina.goto(`${ORIGEM}${caminho}`);
      await pagina.evaluate(() => ((window as any).comCreci = true));
      await pagina.evaluate(() => (window as any).desenhar());
      await esperar();
      assert.deepEqual((await ler()).ativa, ['conta'], caminho);
    }

    // Privacidade: consentimento (na ficha) e exportar contatos.
    await pagina.goto(`${ORIGEM}/portal_corretor/ajustes?aba=privacidade`);
    await esperar();
    r = await ler();
    assert.match(r.centro, /Consentimento dos clientes/);
    assert.match(r.centro, /Exportar contatos/);
    assert.deepEqual(erros, [], 'sem erro de página');
  } finally {
    await navegador.close();
  }
});
