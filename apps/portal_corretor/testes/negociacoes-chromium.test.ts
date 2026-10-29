import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

// Clientes › Negociações (P15, D3) no DOM de verdade (Chromium): a lista à esquerda com os filtros, a
// negociação no centro (faixa com recuo e alvo mascarados, escada, cartão "Negociador sugere") e, à
// direita, o mandato em resumo. O mandato completo só é pedido ao clicar em "mostrar"; "Editar mandato"
// abre o P16 em `urbi-modal`; no celular (M8) a moldura abre no centro. Sem Playwright, pula.

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
import { renderClientes } from './frontend/telas/clientes';
const CASO = window.CASO ?? '';
const NEG = {
  id: 55, codigo: 'NG-0001', estado: 'aguardando_corretor', conduzida_por: 'ia', rodadas: 3, contato_id: 7,
  teto_estimado_comprador_c: 139000000, fonte_estimativa: 'financiamento aprovado de 1,39', batna_estimada_comprador: null,
  contato: { id: 7, nome: 'Ana Ribeiro' },
  imovel: { id: 3, codigo: 'IM-0001', titulo: 'Casa 4 quartos', bairro: 'Jardim Botânico', preco_c: 145000000 },
  mandato: { id: 9, versao: 2, preco_pedido_c: 145000000, concessoes: [{ item: 'prazo de entrega', limite: '60 dias', contrapartida: 'entrada de 30%' }],
    passo_max_pct: 0.4, rodadas_max: 4, validade: '2099-10-30', autonomia: 'pergunta_antes', autorizacao_proprietario: null },
  propostas: [
    { id: 1, rodada: 1, direcao: 'comprador', autor_tipo: 'cliente', valor_c: 130000000, canal: 'registro', estado: 'registrada', criado_em: '2026-10-20T12:00:00Z' },
    { id: 2, rodada: 1, direcao: 'vendedor', autor_tipo: 'corretor', valor_c: 140000000, canal: 'portal', estado: 'enviada', criado_em: '2026-10-21T12:00:00Z' },
    { id: 3, rodada: 3, direcao: 'comprador', autor_tipo: 'cliente', valor_c: 132000000, condicoes: 'financiamento aprovado', canal: 'portal', estado: 'enviada', criado_em: '2026-10-27T12:00:00Z' },
  ],
  objecoes: [{ id: 1, categoria: 'preco', tratada: false }],
  sugestao: {
    execucao_id: 77, mensagem_cliente: '1,40 está acima do que posso. Consigo 1,32?', bloqueado_por: null, criado_em: CASO === 'anterior' ? '2026-10-26T12:00:00Z' : '2026-10-28T12:00:00Z',
    resposta: { movimento: 'contraproposta', interesses_identificados: ['mudar antes das aulas'], resumo_rodada: null,
      contraproposta: { valor_c: 138000000, concessao: 'prazo de entrega', contrapartida: 'entrada de 30%', validade_horas: 48 },
      mensagem: 'Ana, consigo R$ 1.380.000 com entrega em 60 dias e entrada de 30%.' },
    verificacoes: ['piso', 'passo', 'rodadas', 'concessoes', 'sigilo', 'validade', 'canal'].map((garantia) => ({ garantia, ok: !(CASO === 'reprovada' && garantia === 'passo') })),
  },
  zopa: { existe: true },
};
if (CASO === 'sem_movimento') NEG.sugestao.resposta = { movimento: 'pergunta', mensagem: '', interesses_identificados: [], resumo_rodada: 'Só uma pergunta ao cliente.' };
window.chamadas = [];
// Cada chamada com método e corpo (o PUT do mandato e o POST da decisão são conferidos por aqui).
window.pedidos = [];
window.alertas = [];
window.notificacoes = [];
window.formularios = [];
window.respostaFormulario = null;
window.respostaConfirmar = false;
window.respostaDecisao = () => ({ ok: true });
window.abertas = [];
window.abrirDevolve = null;
window.open = (url) => { window.abertas.push(url); return window.abrirDevolve; };
window.urbiVerso = {
  subRota: () => location.pathname.replace(/^\\/portal_corretor/, '') || '/',
  href: (s) => '/portal_corretor' + s,
  navegarSub: () => {},
  usuario: () => ({ id: 1, nome: 'Rafael' }),
  contexto: () => ({ conta: { resolucao: 'escopado', contas: [{ id: 100, nome: 'A' }], contaEscrita: 100 } }),
  notificar: (m) => window.notificacoes.push(m),
  alertar: async (o) => { window.alertas.push(o); },
  confirmar: async () => window.respostaConfirmar,
  formulario: async (o) => { window.formularios.push(o); return window.respostaFormulario; },
  api: async (rota, opcoes) => {
    window.chamadas.push(rota);
    const metodo = opcoes?.method ?? 'GET';
    window.pedidos.push({ rota, metodo, corpo: opcoes?.body ? JSON.parse(opcoes.body) : null });
    const [caminho] = rota.split('?');
    if (metodo === 'PUT' && caminho === '/negociacoes/55/mandato') return { ok: true };
    if (metodo === 'POST' && caminho === '/negociacoes/55/decisao') return window.respostaDecisao(JSON.parse(opcoes.body));
    if (caminho === '/negociacoes') return { dados: [{ id: 55, codigo: 'NG-0001', estado: 'aguardando_corretor', conduzida_por: 'ia', contato_nome: 'Ana Ribeiro', imovel_codigo: 'IM-0001', imovel_titulo: 'Casa 4 quartos', ultima_oferta_c: 132000000, preco_pedido_c: 145000000, atualizado_em: new Date().toISOString() }], total: 1 };
    if (caminho === '/negociador/ia') return { disponivel: true };
    if (caminho === '/negociacoes/55') return NEG;
    if (caminho === '/negociacoes/55/mandato') return { vigente: { ...NEG.mandato, alvo_c: 140000000, recuo_c: 136000000, batna_vendedor: 'Manter anunciado' }, versoes: [] };
    throw Object.assign(new Error('Não encontrado'), { status: 404 });
  },
};
const raiz = document.getElementById('raiz');
const desenhar = () => render(renderClientes(desenhar), raiz);
desenhar();
`;

const PROFUNDO = `
window.profundo = (no) => {
  if (!no) return '';
  const partes = [];
  const andar = (n) => {
    if (n.nodeType === 3) partes.push(n.textContent);
    if (n.nodeType === 1) for (const a of ['titulo', 'rotulo', 'mensagem', 'texto']) if (n.getAttribute(a)) partes.push(n.getAttribute(a));
    if (n.nodeType === 1 && n.valor !== undefined && n.tagName === 'URBI-KPI') partes.push(String(n.valor));
    if (n.shadowRoot) andar(n.shadowRoot);
    for (const f of n.childNodes) andar(f);
  };
  andar(no);
  return partes.join(' ').replace(/\\s+/g, ' ').trim();
};
window.todos = (raiz, seletor) => {
  const achados = [];
  const fila = [raiz];
  if (raiz?.shadowRoot) fila.push(raiz.shadowRoot);
  while (fila.length) {
    const n = fila.shift();
    for (const e of n.querySelectorAll?.(seletor) ?? []) achados.push(e);
    for (const e of n.querySelectorAll?.('*') ?? []) if (e.shadowRoot) fila.push(e.shadowRoot);
  }
  return achados;
};
`;

test('Negociações no Chromium: lista, faixa mascarada, sugestão, mostrar sob clique, mandato em modal e celular', async (t) => {
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
    const consoles: string[] = [];
    pagina.on('pageerror', (e: Error) => erros.push(e.message));
    pagina.on('console', (m: any) => consoles.push(m.text()));
    await pagina.route(`${ORIGEM}/**`, (r: any) => r.fulfill({ contentType: 'text/html', body: html }));
    const esperar = () => pagina.waitForTimeout(80);

    // Sem negociação escolhida: a lista à esquerda com os filtros; "Escolha uma negociação" no centro.
    await pagina.goto(`${ORIGEM}/portal_corretor/clientes?visao=negociacoes`);
    await esperar();
    let r: any = await pagina.evaluate(() => {
      const w = window as any;
      const esquerda = document.querySelector('urbi-3-colunas > urbi-hospedeiro[slot="esquerda"] pc-negociacoes-lista') as any;
      const chips = w.todos(esquerda, 'urbi-chips-atalho').map((c: any) => c.opcoes.map((o: any) => o.rotulo));
      return {
        chips,
        itens: w.todos(esquerda, 'urbi-lista')[0]?.itens?.map((n: any) => n.contato_nome),
        texto: w.profundo(esquerda),
        centro: document.querySelector('urbi-3-colunas > urbi-hospedeiro[slot="centro"] urbi-estado-vazio')?.getAttribute('mensagem'),
        estilos: document.querySelectorAll('#raiz style, #raiz [style]').length,
      };
    });
    assert.deepEqual(r.chips, [['Lista', 'Funil', 'Negociações'], ['Todas', 'Aguardando você', 'Negociador', 'Cliente', 'Proprietário', 'Encerradas']]);
    assert.deepEqual(r.itens, ['Ana Ribeiro']);
    assert.match(r.texto, /Nova proposta/);
    assert.equal(r.centro, 'Escolha uma negociação');
    assert.equal(r.estilos, 0, 'nenhum <style> nem style= na tela');

    // Escolher Ana: `?item=55`, o centro e a direita da negociação; o mandato completo NÃO foi pedido.
    await pagina.evaluate(() => {
      const w = window as any;
      w.todos(document, 'urbi-lista')[0].dispatchEvent(new CustomEvent('urbi:lista-click', { detail: { item: { id: 55 } }, bubbles: true, composed: true }));
    });
    await esperar();
    const ler = () =>
      pagina.evaluate(() => {
        const w = window as any;
        const centro = document.querySelector('urbi-3-colunas > urbi-hospedeiro[slot="centro"] pc-negociacao-foco');
        const direita = document.querySelector('urbi-3-colunas > urbi-hospedeiro[slot="direita"] pc-negociacao-contexto');
        return {
          url: location.search,
          centro: w.profundo(centro),
          direita: w.profundo(direita),
          mandato: w.chamadas.filter((c: string) => c.endsWith('/mandato')).length,
          kpis: w.todos(centro, 'urbi-kpi').map((k: any) => [k.getAttribute('rotulo'), k.valor]),
          tabela: w.todos(centro, 'urbi-tabela')[0]?.linhas?.length,
          painel: document.querySelector('urbi-3-colunas')?.getAttribute('painel-ativo'),
        };
      });
    let f: any = await ler();
    assert.equal(f.url, '?visao=negociacoes&item=55');
    assert.equal(f.mandato, 0, 'sem clique, nenhuma leitura do mandato completo');
    assert.match(f.centro, /Ana Ribeiro · Casa 4 quartos/);
    assert.match(f.centro, /Assumir/);
    assert.match(f.centro, /Rodada 3 de 4/);
    assert.match(f.centro, /Negociador IA · pergunta antes/);
    assert.match(f.centro, /Mandato válido até/);
    assert.deepEqual(f.kpis, [['Última oferta', 'R$ 1,32 mi'], ['Recuo', '••••'], ['Teto estimado', 'R$ 1,39 mi'], ['Alvo', '••••'], ['Pedido', 'R$ 1,45 mi']]);
    assert.match(f.centro, /ZOPA estimada: do seu recuo até o teto estimado do comprador/);
    assert.match(f.centro, /1,40 está acima do que posso/);
    assert.match(f.centro, /Objeção: Preço/);
    assert.match(f.centro, /Negociador sugere · rodada 3/);
    assert.match(f.centro, /✓ acima do recuo · ✓ passo menor/);
    assert.match(f.centro, /Enviar.*Fazer agora.*Editar.*Descartar/);
    // Ordem do centro (spec 11.1): faixa, escada, última fala do cliente, cartão de sugestão, ações.
    const ordem = ['Faixa da negociação', 'Escada de propostas', '1,40 está acima do que posso', 'Negociador sugere', 'Registrar oferta do cliente'].map((t) => f.centro.indexOf(t));
    assert.ok(ordem.every((i, k) => i >= 0 && (k === 0 || i > ordem[k - 1])), `ordem do centro: ${ordem}`);
    assert.equal(f.tabela, 3, 'a escada com as três propostas');
    assert.match(f.centro, /Aceitar oferta de R\$ 1,32 mi/);
    assert.match(f.direita, /Mandato/);
    assert.match(f.direita, /Recuo ••••/);
    assert.match(f.direita, /BATNA do vendedor ••••/);
    assert.match(f.direita, /prazo de entrega \(até 60 dias\) ↔ entrada de 30%/);
    assert.match(f.direita, /Leitura do comprador/);
    assert.match(f.direita, /mudar antes das aulas/);
    assert.match(f.direita, /Próximo movimento/);
    assert.match(f.direita, /Usar sugestão/);
    assert.match(f.direita, /Passar ao proprietário/);
    assert.doesNotMatch(f.centro + f.direita, /1\.360\.000|1,36 mi|Manter anunciado/, 'nada sigiloso antes do clique');

    // "mostrar": uma leitura da rota do mandato, e o recuo e o alvo aparecem nas duas colunas.
    await pagina.evaluate(() => {
      const w = window as any;
      const direita = document.querySelector('pc-negociacao-contexto');
      const botao = w.todos(direita, 'urbi-botao').find((b: any) => b.getAttribute('title') === 'Mostrar recuo, alvo e BATNA');
      if (botao.getAttribute('icone') !== 'fa-solid fa-eye' || botao.getAttribute('arialabel') !== 'Mostrar recuo, alvo e BATNA' || botao.textContent.trim()) throw new Error('mostrar não é só-ícone');
      botao.click();
    });
    await esperar();
    f = await ler();
    assert.equal(f.mandato, 1);
    assert.match(f.direita, /Recuo R\$\s1\.360\.000,00/);
    assert.match(f.direita, /Manter anunciado/);
    assert.deepEqual([f.kpis[1][0], String(f.kpis[1][1]).replace(/\s/g, ' ')], ['Recuo', 'R$ 1.360.000,00'], 'o recuo revelado também na faixa');
    const ocultar = await pagina.evaluate(() =>
      (window as any).todos(document.querySelector('pc-negociacao-contexto'), 'urbi-botao').filter((b: any) => b.getAttribute('title') === 'Ocultar recuo, alvo e BATNA').map((b: any) => [b.getAttribute('icone'), b.getAttribute('arialabel')]),
    );
    assert.deepEqual(ocultar, [['fa-solid fa-eye-slash', 'Ocultar recuo, alvo e BATNA']]);

    // Editar mandato: o P16 abre em urbi-modal com os quatro blocos.
    await pagina.evaluate(() => {
      const w = window as any;
      const direita = document.querySelector('pc-negociacao-contexto');
      w.todos(direita, 'urbi-botao').find((b: any) => b.textContent.includes('Editar mandato')).click();
    });
    await esperar();
    r = await pagina.evaluate(() => {
      const w = window as any;
      const modal = w.todos(document, 'pc-mandato urbi-modal, urbi-modal')[0];
      return { titulo: modal?.getAttribute('title'), texto: w.profundo(modal) };
    });
    assert.equal(r.titulo, 'Mandato de negociação · Ana Ribeiro · versão 2');
    for (const bloco of ['1 · Valores', '2 · Concessões e contrapartidas', '3 · Prazo e validade', '4 · Quem negocia e autonomia', '✓ recuo ≤ alvo ≤ pedido', 'Salvar mandato', 'Anexar documento', 'Registrar por mensagem']) {
      assert.ok(r.texto.includes(bloco), `P16 sem ${bloco}`);
    }

    // Celular (M8): com a negociação escolhida, a moldura abre no centro.
    await pagina.setViewportSize({ width: 390, height: 844 });
    await pagina.goto(`${ORIGEM}/portal_corretor/clientes?visao=negociacoes&item=55`);
    await esperar();
    f = await ler();
    assert.equal(f.painel, 'centro');
    assert.match(f.centro, /Negociador sugere/);
    assert.equal(f.mandato, 0, 'nova visita: o sigilo volta a ficar mascarado');
    assert.deepEqual(erros, [], 'sem erro de página');
    assert.ok(!consoles.some((c) => /1360|136000000|Manter anunciado/.test(c)), 'nada sigiloso no console');
  } finally {
    await navegador.close();
  }
});

// ---------------------------------------------------------------------------------------------------
// Ações pela tela: o mandato recusado antes do PUT, o 422 do bloqueio em texto, o aceite com
// confirmação, o Fazer agora sem pop-up e a sugestão que não sai como está.

let html: Promise<string> | null = null;
const pagina = () =>
  (html ??= build({ stdin: { contents: ENTRADA, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, write: false, format: 'iife', target: 'es2022', tsconfig: 'tsconfig.json', logLevel: 'silent' }).then(
    (p) => `<!doctype html><html><head><meta charset="utf-8"></head><body><div id="raiz"></div><script>${PROFUNDO}</script><script>${p.outputFiles[0].text}</script></body></html>`,
  ));

/** Abre a negociação 55 numa página nova, com o caso (`window.CASO`) antes do app. */
async function abrir(pw: any, caso = '') {
  const corpo = await pagina();
  const navegador = await pw.chromium.launch();
  const p = await navegador.newPage({ viewport: { width: 1440, height: 900 } });
  const erros: string[] = [];
  p.on('pageerror', (e: Error) => erros.push(e.message));
  await p.addInitScript((c: string) => ((window as any).CASO = c), caso);
  await p.route(`${ORIGEM}/**`, (r: any) => r.fulfill({ contentType: 'text/html', body: corpo }));
  await p.goto(`${ORIGEM}/portal_corretor/clientes?visao=negociacoes&item=55`);
  await p.waitForTimeout(120);
  return { navegador, p, erros, esperar: () => p.waitForTimeout(120) };
}

/** Clica no `urbi-botao` de texto `rotulo` (senão, o primeiro cujo texto ou title começa com ele), dentro de `dono`. */
const clicar = (p: any, dono: string, rotulo: string) =>
  p.evaluate(
    ([d, r]: string[]) => {
      const w = window as any;
      const botoes = w.todos(w.todos(document, d)[0], 'urbi-botao');
      const b = botoes.find((x: any) => x.textContent.trim() === r) ?? botoes.find((x: any) => x.textContent.trim().startsWith(r) || (x.getAttribute('title') ?? '').startsWith(r));
      if (!b) throw new Error(`sem botão ${r}`);
      b.click();
    },
    [dono, rotulo],
  );

test('Chromium · P16: recuo acima do alvo é recusado sem PUT; válido sai em centavos; "Faz sozinho" só com a autorização', async (t) => {
  const pw = playwright();
  if (!pw) return t.skip('Playwright não instalado neste ambiente');
  const { navegador, p, erros, esperar } = await abrir(pw);
  try {
    await clicar(p, 'pc-negociacao-contexto', 'Editar mandato');
    await esperar();
    const autonomias = () =>
      p.evaluate(() => (window as any).todos((window as any).todos(document, 'pc-mandato')[0], 'urbi-select').find((s: any) => s.getAttribute('label') === 'Autonomia do Negociador').opcoes.map((o: any) => o.valor));
    // Sem autorização registrada, "Faz sozinho" não é opção.
    assert.deepEqual(await autonomias(), ['sugere', 'pergunta_antes']);

    const digitar = (rotulo: string, valor: string) =>
      p.evaluate(
        ([r, v]: string[]) => {
          const campo = (window as any).todos((window as any).todos(document, 'pc-mandato')[0], 'urbi-input').find((i: any) => i.getAttribute('label') === r);
          campo.dispatchEvent(new CustomEvent('urbi:input-change', { detail: { valor: v } }));
        },
        [rotulo, valor],
      );
    const puts = () => p.evaluate(() => (window as any).pedidos.filter((x: any) => x.metodo === 'PUT'));
    await digitar('Ponto de recuo (R$)', '1.420.000');
    await esperar();
    await clicar(p, 'pc-mandato', 'Salvar mandato');
    await esperar();
    const texto = await p.evaluate(() => (window as any).profundo((window as any).todos(document, 'pc-mandato')[0]));
    assert.match(texto, /O ponto de recuo não pode ficar acima do alvo\./);
    assert.deepEqual(await puts(), [], 'nenhum PUT …/mandato com recuo acima do alvo');

    // A autorização por mensagem libera "Faz sozinho"; tirá-la some com a opção.
    await p.evaluate(() => ((window as any).respostaFormulario = { data: '2026-10-28' }));
    await clicar(p, 'pc-mandato', 'Registrar por mensagem');
    await esperar();
    assert.deepEqual(await autonomias(), ['sugere', 'pergunta_antes', 'faz_sozinho']);
    await clicar(p, 'pc-mandato', 'Tirar');
    await esperar();
    assert.deepEqual(await autonomias(), ['sugere', 'pergunta_antes']);

    // Valores válidos: o PUT sai, com recuo e alvo em centavos.
    await digitar('Ponto de recuo (R$)', '1.350.000');
    await digitar('Alvo (R$)', '1.410.000');
    await esperar();
    await clicar(p, 'pc-mandato', 'Salvar mandato');
    await esperar();
    const [put, ...outros] = await puts();
    assert.equal(outros.length, 0);
    assert.equal(put.rota, '/negociacoes/55/mandato');
    assert.equal(put.corpo.recuo_c, 135000000);
    assert.equal(put.corpo.alvo_c, 141000000);
    assert.equal(put.corpo.autonomia, 'pergunta_antes');
    assert.equal(await p.evaluate(() => (window as any).todos(document, 'pc-mandato').length > 0), false, 'o modal fecha depois de salvo');
    assert.deepEqual(erros, []);
  } finally {
    await navegador.close();
  }
});

test('Chromium · decisões: 422 do bloqueio vira texto sem o recuo; aceite só com confirmação; Fazer agora sem pop-up mostra o texto', async (t) => {
  const pw = playwright();
  if (!pw) return t.skip('Playwright não instalado neste ambiente');
  const { navegador, p, erros, esperar } = await abrir(pw);
  const w = (fn: string) => p.evaluate(fn);
  const decisoes = () => p.evaluate(() => (window as any).pedidos.filter((x: any) => x.metodo === 'POST' && x.rota === '/negociacoes/55/decisao').map((x: any) => x.corpo));
  try {
    // Editar abaixo do recuo: o backend responde 422 MOVIMENTO_BLOQUEADO e a tela diz a garantia.
    await w(`window.respostaFormulario = { valor: '1.300.000', condicoes: '', concessao: '', contrapartida: '', mensagem: 'Ana, 1,30.', canal: 'portal' };
      window.respostaDecisao = (c) => { if (c.acao === 'editar') throw Object.assign(new Error('Esta contraproposta não pode sair como está.'), { status: 422, codigo: 'MOVIMENTO_BLOQUEADO', detalhes: ['ABAIXO_DO_RECUO: valor abaixo do ponto de recuo'] }); return { ok: true }; };`);
    await clicar(p, 'pc-negociacao-foco', 'Editar');
    await esperar();
    let alertas: any[] = await w('window.alertas');
    assert.equal(alertas.length, 1);
    assert.match(alertas[0].mensagem, /✗ valor abaixo do ponto de recuo/);
    assert.doesNotMatch(alertas[0].mensagem, /1\.360\.000|136000000|1,36/, 'o recuo não aparece no erro');
    assert.equal((await decisoes())[0].contraproposta.valor_c, 130000000);

    // Aceitar: confirmar = false não faz POST; true faz um POST aceitar_acordo da última oferta.
    await clicar(p, 'pc-negociacao-foco', 'Aceitar oferta de');
    await esperar();
    assert.equal((await decisoes()).filter((c: any) => c.acao === 'aceitar_acordo').length, 0);
    await w('window.respostaConfirmar = true');
    await clicar(p, 'pc-negociacao-foco', 'Aceitar oferta de');
    await esperar();
    assert.deepEqual((await decisoes()).filter((c: any) => c.acao === 'aceitar_acordo'), [{ acao: 'aceitar_acordo', proposta_id: 3 }]);

    // Fazer agora com o pop-up barrado (window.open devolve null): o texto pronto e o link num alerta.
    await w(`window.alertas = []; window.notificacoes = [];
      window.respostaDecisao = () => ({ ok: true, texto: 'Ana, consigo R$ 1.380.000.', link: 'https://wa.me/5561999990000?text=Ana' });`);
    await clicar(p, 'pc-negociacao-foco', 'Fazer agora');
    await esperar();
    alertas = await w('window.alertas');
    assert.equal(alertas.length, 1);
    assert.equal(alertas[0].tipo, 'info');
    assert.match(alertas[0].mensagem, /Ana, consigo R\$ 1\.380\.000\./);
    assert.match(alertas[0].mensagem, /https:\/\/wa\.me\/5561999990000\?text=Ana/);
    assert.deepEqual(await w('window.abertas'), ['https://wa.me/5561999990000?text=Ana']);
    assert.ok(!(await w('window.notificacoes')).some((n: string) => /que abriu/.test(n)), 'nunca "o WhatsApp que abriu" sem ter aberto');

    // Sem link (sem telefone): só o texto, sem tentar abrir.
    await w(`window.alertas = []; window.abertas = []; window.respostaDecisao = () => ({ ok: true, texto: 'Ana, consigo R$ 1.380.000.', link: null });`);
    await clicar(p, 'pc-negociacao-foco', 'Fazer agora');
    await esperar();
    alertas = await w('window.alertas');
    assert.match(alertas[0].mensagem, /Ana, consigo R\$ 1\.380\.000\./);
    assert.deepEqual(await w('window.abertas'), []);

    // Com a aba aberta: aí sim "o WhatsApp que abriu".
    await w(`window.alertas = []; window.abrirDevolve = { opener: window }; window.respostaDecisao = () => ({ ok: true, texto: 'x', link: 'https://wa.me/5561999990000' });`);
    await clicar(p, 'pc-negociacao-foco', 'Fazer agora');
    await esperar();
    assert.deepEqual(await w('window.alertas'), []);
    assert.ok((await w('window.notificacoes')).some((n: string) => /que abriu/.test(n)));
    assert.equal(await w('window.abrirDevolve.opener'), null, 'a aba do WhatsApp sem opener');

    // Editar com canal wa_me e pop-up barrado: o mesmo alerta com o texto.
    await w(`window.alertas = []; window.abrirDevolve = null;
      window.respostaFormulario = { valor: '1.380.000', condicoes: '', concessao: '', contrapartida: '', mensagem: 'Ana, fechado em 1,38.', canal: 'wa_me' };
      window.respostaDecisao = () => ({ ok: true, texto: 'Ana, fechado em 1,38.', link: 'https://wa.me/5561999990000' });`);
    await clicar(p, 'pc-negociacao-foco', 'Editar');
    await esperar();
    alertas = await w('window.alertas');
    assert.equal(alertas[0]?.tipo, 'info');
    assert.match(alertas[0].mensagem, /Ana, fechado em 1,38\./);
    assert.deepEqual(erros, []);
  } finally {
    await navegador.close();
  }
});

for (const [caso, frase] of [
  ['reprovada', /Alguma regra do mandato reprovou esta sugestão/],
  ['anterior', /anterior à última oferta do cliente\. Peça outra/],
  ['sem_movimento', /não traz contraproposta nem mensagem/],
] as const) {
  test(`Chromium · sugestão que não sai como está (${caso}): Enviar, Fazer agora e Usar sugestão desabilitados; Editar e Descartar seguem`, async (t) => {
    const pw = playwright();
    if (!pw) return t.skip('Playwright não instalado neste ambiente');
    const { navegador, p, erros, esperar } = await abrir(pw, caso);
    try {
      const r = await p.evaluate(() => {
        const w = window as any;
        const botoes = (sel: string) => Object.fromEntries(w.todos(document.querySelector(sel), 'urbi-botao').map((b: any) => [b.textContent.trim(), b.hasAttribute('desabilitado')]));
        return { centro: botoes('pc-negociacao-foco'), direita: botoes('pc-negociacao-contexto'), texto: w.profundo(document.querySelector('pc-negociacao-foco')) + w.profundo(document.querySelector('pc-negociacao-contexto')) };
      });
      assert.match(r.texto, frase);
      assert.equal(r.centro['Enviar'], true);
      assert.equal(r.centro['Fazer agora'], true);
      assert.equal(r.centro['Editar'], false);
      assert.equal(r.centro['Descartar'], false);
      if (caso === 'anterior') {
        assert.equal(r.centro['Pedir sugestão'], false, 'no cartão, pedir outra');
        assert.equal(r.direita['Pedir sugestão'], false, 'no Próximo movimento, pedir outra');
        assert.ok(!('Usar sugestão' in r.direita));
      } else assert.equal(r.direita['Usar sugestão'], true);

      // Clicar mesmo assim (o primitivo não está registrado no teste) não faz POST.
      await clicar(p, 'pc-negociacao-foco', 'Enviar');
      await esperar();
      assert.equal(await p.evaluate(() => (window as any).pedidos.filter((x: any) => x.metodo === 'POST').length), 0);

      if (caso === 'sem_movimento') {
        // Editar sem contraproposta: o valor é opcional; vazio, sai só a mensagem.
        await p.evaluate(() => ((window as any).respostaFormulario = { valor: '', condicoes: '', concessao: '', contrapartida: '', mensagem: 'Qual o prazo que você precisa?', canal: 'portal' }));
        await clicar(p, 'pc-negociacao-foco', 'Editar');
        await esperar();
        const { campo, corpo } = await p.evaluate(() => ({
          campo: (window as any).formularios.at(-1).campos.find((c: any) => c.nome === 'valor'),
          corpo: (window as any).pedidos.find((x: any) => x.metodo === 'POST').corpo,
        }));
        assert.equal(campo.obrigatorio, false);
        assert.equal(corpo.acao, 'editar');
        assert.equal(corpo.mensagem, 'Qual o prazo que você precisa?');
        assert.ok(!('contraproposta' in corpo), 'sem contraproposta no corpo');
        // Valor preenchido e inválido: alerta, sem POST.
        await p.evaluate(() => {
          const w = window as any;
          w.respostaFormulario = { valor: 'mil e pouco', mensagem: 'x', canal: 'portal' };
          w.pedidos = [];
        });
        await clicar(p, 'pc-negociacao-foco', 'Editar');
        await esperar();
        assert.equal(await p.evaluate(() => (window as any).alertas.at(-1)?.titulo), 'Valor inválido');
        assert.equal(await p.evaluate(() => (window as any).pedidos.filter((x: any) => x.metodo === 'POST').length), 0);
      }
      assert.deepEqual(erros, []);
    } finally {
      await navegador.close();
    }
  });
}
