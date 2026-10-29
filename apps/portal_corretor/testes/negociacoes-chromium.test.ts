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
    execucao_id: 77, mensagem_cliente: '1,40 está acima do que posso. Consigo 1,32?', bloqueado_por: null,
    resposta: { movimento: 'contraproposta', interesses_identificados: ['mudar antes das aulas'], resumo_rodada: null,
      contraproposta: { valor_c: 138000000, concessao: 'prazo de entrega', contrapartida: 'entrada de 30%', validade_horas: 48 },
      mensagem: 'Ana, consigo R$ 1.380.000 com entrega em 60 dias e entrada de 30%.' },
    verificacoes: ['piso', 'passo', 'rodadas', 'concessoes', 'sigilo', 'validade', 'canal'].map((garantia) => ({ garantia, ok: true })),
  },
  zopa: { existe: true },
};
window.chamadas = [];
window.urbiVerso = {
  subRota: () => location.pathname.replace(/^\\/portal_corretor/, '') || '/',
  href: (s) => '/portal_corretor' + s,
  navegarSub: () => {},
  usuario: () => ({ id: 1, nome: 'Rafael' }),
  contexto: () => ({ conta: { resolucao: 'escopado', contas: [{ id: 100, nome: 'A' }], contaEscrita: 100 } }),
  notificar: () => {},
  alertar: async () => {},
  api: async (rota) => {
    window.chamadas.push(rota);
    const [caminho] = rota.split('?');
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
      const botao = w.todos(direita, 'urbi-botao').find((b: any) => b.textContent.trim() === 'mostrar');
      botao.click();
    });
    await esperar();
    f = await ler();
    assert.equal(f.mandato, 1);
    assert.match(f.direita, /Recuo R\$\s1\.360\.000,00/);
    assert.match(f.direita, /Manter anunciado/);
    assert.deepEqual([f.kpis[1][0], String(f.kpis[1][1]).replace(/\s/g, ' ')], ['Recuo', 'R$ 1.360.000,00'], 'o recuo revelado também na faixa');

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
