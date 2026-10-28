import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

// Clientes no Padrão B (B3, issue #92) no DOM de verdade (Chromium): a lista à esquerda, a ficha do
// cliente escolhido no centro (cabeçalho e abas) e o contexto à direita; `?item=` e `?secao=`
// sobrevivem a recarregar; o Funil recolhe a direita; um id que a conta não enxerga (de outro corretor)
// mostra "Não encontrado". Os primitivos `urbi-*` são elementos sem registro: o teste mede a estrutura
// e os dados que a tela entrega a eles. Sem Playwright instalado (o CI do kit não traz navegador), pula.

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
import { renderClientes } from './frontend/telas/clientes';
const CONTATOS = [
  { id: 7, nome: 'Ana Ribeiro', telefone: '+5561999990001', email: 'ana@exemplo.com', papeis: 'comprador', temperatura: 'quente', origem_canal: 'pagina', proximo_passo: null, proximo_passo_em: null },
  { id: 8, nome: 'Bruno Lima', telefone: null, email: null, papeis: 'proprietario', temperatura: null, origem_canal: null, proximo_passo: 'Ligar', proximo_passo_em: null },
];
const ficha = (c) => ({
  contato: { ...c, criado_em: '2026-10-01T12:00:00Z', ultimo_contato_em: null, observacoes: null,
    perfil_busca: { finalidade: 'moradia', tipos: ['apartamento'], regioes: ['Sudoeste'], preco_max_c: 90000000, quartos: 3 } },
  negocios: [{ id: 1, titulo: 'Compra', etapa_nome: 'Visita', etapa_tipo: 'andamento', pipeline: 'compra', valor_estimado_c: 0 }],
  atividades: [], visitas: [], linha_do_tempo: [{ id: 1, resumo: 'Contato registrado', ocorrido_em: '2026-10-02T12:00:00Z', autor_nome: 'Marina' }],
  consentimento: null, classificacoes: [],
  abordagem: c.id === 7 ? { abordagem: 'Ligar para combinar visita', canal_sugerido: 'ligacao', vencida: false, vence_em: null, etapa_nome: 'Visita' } : null,
});
const chamadas = [];
window.chamadas = chamadas;
window.navegou = [];
window.urbiVerso = {
  subRota: () => location.pathname.replace(/^\\/portal_corretor/, '') || '/',
  href: (s) => '/portal_corretor' + s,
  navegarSub: (s) => window.navegou.push(s),
  usuario: () => ({ id: 1, nome: 'Marina' }),
  contexto: () => ({ conta: { resolucao: 'escopado', contas: [{ id: 100, nome: 'A' }], contaEscrita: 100 } }),
  notificar: () => {},
  api: async (rota) => {
    chamadas.push(rota);
    const [caminho] = rota.split('?');
    if (caminho === '/conta') return { configuracoes: { dias_cliente_parado: 7 } };
    if (caminho === '/contatos') return { dados: CONTATOS, total: CONTATOS.length };
    if (caminho === '/funil/etapas') return { etapas: [] };
    if (caminho === '/envios') return { dados: [] };
    if (caminho === '/selecoes') return { dados: [] };
    if (caminho === '/funil/quadro') return { etapas: [], negocios: [] };
    const m = caminho.match(/^\\/contatos\\/(\\d+)(\\/.*)?$/);
    const c = m && CONTATOS.find((x) => x.id === Number(m[1]));
    // Contato de outra conta: a rota responde 404 (o RLS não devolve a linha).
    if (m && !c) throw Object.assign(new Error('Contato não encontrado.'), { status: 404 });
    if (m && !m[2]) return ficha(c);
    if (m && m[2] === '/mensagem-sugerida') return { mensagem: 'Oi, Ana!', ia: false };
    if (m && m[2] === '/ia') return { resumo: false, mensagem: false };
    if (m && m[2] === '/portal') return { ativo: true, link: '/portal_corretor/c?t=x', criado_em: '2026-10-03T12:00:00Z' };
    if (m && m[2] === '/tarefas-cliente') return { dados: [] };
    return {};
  },
};
const raiz = document.getElementById('raiz');
const desenhar = () => render(renderClientes(desenhar), raiz);
window.desenhar = desenhar;
desenhar();
`;

/** Texto de um nó e de todas as sombras abaixo dele (os elementos da app usam shadow DOM). */
const PROFUNDO = `
window.profundo = (no) => {
  if (!no) return '';
  const partes = [];
  const andar = (n) => {
    if (n.nodeType === 3) partes.push(n.textContent);
    // Título de cartão e rótulo de botão moram em atributo.
    if (n.nodeType === 1 && n.getAttribute('titulo')) partes.push(n.getAttribute('titulo'));
    if (n.shadowRoot) andar(n.shadowRoot);
    for (const f of n.childNodes) andar(f);
  };
  andar(no);
  return partes.join(' ').replace(/\\s+/g, ' ').trim();
};
window.achar = (raiz, seletor) => {
  const fila = [raiz];
  if (raiz?.shadowRoot) fila.push(raiz.shadowRoot);
  while (fila.length) {
    const n = fila.shift();
    const r = n.querySelector?.(seletor);
    if (r) return r;
    for (const e of n.querySelectorAll?.('*') ?? []) if (e.shadowRoot) fila.push(e.shadowRoot);
  }
  return null;
};
`;

test('Clientes no Chromium: lista, ficha no centro, contexto à direita, ?item= e ?secao= ao recarregar, Funil e isolamento', async (t) => {
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
    await pagina.route(`${ORIGEM}/**`, (r: any) => r.fulfill({ contentType: 'text/html', body: html }));
    const esperar = () => pagina.waitForTimeout(50);

    // Sem cliente escolhido: a lista à esquerda, "Escolha um cliente" no centro; no celular, abre na lista.
    await pagina.goto(`${ORIGEM}/portal_corretor/clientes`);
    await esperar();
    let r = await pagina.evaluate(() => {
      const w = window as any;
      const lista = w.achar(document, 'urbi-lista');
      return {
        itens: lista?.itens?.map((c: any) => c.nome),
        centro: document.querySelector('urbi-3-colunas > urbi-hospedeiro[slot="centro"] urbi-estado-vazio')?.getAttribute('mensagem'),
        painel: document.querySelector('urbi-3-colunas')?.getAttribute('painel-ativo'),
        visoes: w.achar(document, 'urbi-chips-atalho')?.opcoes?.map((o: any) => o.rotulo),
        estilos: document.querySelectorAll('#raiz style, #raiz [style]').length,
      };
    });
    assert.deepEqual(r.itens, ['Ana Ribeiro', 'Bruno Lima']);
    assert.equal(r.centro, 'Escolha um cliente');
    assert.equal(r.painel, 'esquerda');
    assert.deepEqual(r.visoes, ['Lista', 'Funil']);
    assert.equal(r.estilos, 0, 'nenhum <style> nem style= na tela');

    // Escolher Ana na lista: o `?item=` vai para a URL e a ficha abre nas duas colunas, sem navegar.
    await pagina.evaluate(() => {
      const w = window as any;
      w.achar(document, 'urbi-lista').dispatchEvent(new CustomEvent('urbi:lista-click', { detail: { item: { id: 7 } }, bubbles: true, composed: true }));
    });
    await esperar();
    const ficha = () =>
      pagina.evaluate(() => {
        const w = window as any;
        const centro = document.querySelector('urbi-3-colunas > urbi-hospedeiro[slot="centro"] pc-ficha-contato-foco') as any;
        const direita = document.querySelector('urbi-3-colunas > urbi-hospedeiro[slot="direita"] pc-ficha-contato-contexto') as any;
        const abas = w.achar(centro, 'urbi-abas') as any;
        return {
          url: location.search,
          navegou: w.navegou.slice(),
          centroId: centro?.contatoId,
          centro: w.profundo(centro),
          abas: abas?.abas?.map((a: any) => a.label),
          ativa: abas?.getAttribute('ativa'),
          direita: w.profundo(direita),
          painel: document.querySelector('urbi-3-colunas')?.getAttribute('painel-ativo'),
          ativoNaLista: w.achar(document, 'urbi-lista')?.itemAtivo?.({ id: 7 }),
        };
      });
    let f = await ficha();
    assert.equal(f.url, '?item=7');
    assert.deepEqual(f.navegou, [], 'escolher não navega: a lista fica onde estava');
    assert.equal(f.centroId, 7);
    assert.match(f.centro, /Ana Ribeiro/);
    assert.match(f.centro, /Conversa/);
    assert.match(f.centro, /Resumir/);
    assert.match(f.centro, /Próximo passo/, 'a aba Resumo abre com o próximo passo');
    assert.deepEqual(f.abas, ['Resumo', 'Linha do tempo', 'Enviados', 'Negócios']);
    assert.match(f.direita, /Perfil de busca/);
    assert.match(f.direita, /Moradia/);
    assert.match(f.direita, /Sudoeste/);
    assert.match(f.direita, /Portal do cliente/);
    assert.match(f.direita, /Reenviar link/);
    assert.match(f.direita, /Privacidade/);
    assert.equal(f.painel, 'centro');
    assert.equal(f.ativoNaLista, true, 'o cliente aberto fica marcado na lista');

    // Aba Negócios: vai para `?secao=` e mostra negócios, agenda e seleções.
    await pagina.evaluate(() => {
      const w = window as any;
      const abas = w.achar(document.querySelector('pc-ficha-contato-foco'), 'urbi-abas');
      abas.dispatchEvent(new CustomEvent('urbi:aba-selecionar', { detail: { id: 'negocios' }, bubbles: true, composed: true }));
    });
    await esperar();
    f = await ficha();
    assert.equal(f.url, '?item=7&secao=negocios');
    assert.equal(f.ativa, 'negocios');
    assert.match(f.centro, /Negócios/);
    assert.match(f.centro, /Agenda/);
    assert.match(f.centro, /Seleções/);

    // Recarregar: o mesmo cliente e a mesma aba.
    await pagina.reload();
    await esperar();
    f = await ficha();
    assert.equal(f.centroId, 7);
    assert.equal(f.ativa, 'negocios');
    assert.match(f.centro, /Ana Ribeiro/);

    // Id de outro corretor pela URL: a rota dá 404 e a tela mostra "Não encontrado", sem dado nenhum.
    await pagina.goto(`${ORIGEM}/portal_corretor/clientes?item=99`);
    await esperar();
    r = await pagina.evaluate(() => {
      const w = window as any;
      const centro = document.querySelector('pc-ficha-contato-foco');
      return { vazio: w.achar(centro, 'urbi-estado-vazio')?.getAttribute('mensagem'), texto: w.profundo(centro) } as any;
    });
    assert.equal((r as any).vazio, 'Não encontrado');
    assert.doesNotMatch((r as any).texto, /Ana|Bruno/);

    // Funil: o quadro no centro, a direita recolhida; escolher um cliente volta à Lista com a ficha.
    await pagina.goto(`${ORIGEM}/portal_corretor/clientes?visao=quadro`);
    await esperar();
    r = await pagina.evaluate(() => {
      const colunas = document.querySelector('urbi-3-colunas')!;
      return { quadro: !!colunas.querySelector('urbi-hospedeiro[slot="centro"] pc-clientes-quadro'), recolhida: colunas.hasAttribute('colapsada-direita') } as any;
    });
    assert.deepEqual(r, { quadro: true, recolhida: true });
    await pagina.evaluate(() => {
      const w = window as any;
      w.achar(document, 'urbi-lista').dispatchEvent(new CustomEvent('urbi:lista-click', { detail: { item: { id: 8 } }, bubbles: true, composed: true }));
    });
    await esperar();
    f = await ficha();
    assert.equal(f.url, '?item=8');
    assert.match(f.centro, /Bruno Lima/);

    // Voltar à ficha do mesmo contato por "Fazer agora" (`?sugerir=1`) é uma chegada nova: a Mensagem
    // sugerida carrega de novo e a aba vem do endereço; redesenhar a mesma visita não sugere outra vez.
    const sugestoes = () => pagina.evaluate(() => (window as any).chamadas.filter((c: string) => c.startsWith('/contatos/7/mensagem-sugerida')).length);
    const aba = () => pagina.evaluate(() => (window as any).achar(document.querySelector('pc-ficha-contato-foco'), 'urbi-abas')?.getAttribute('ativa'));
    const chegar = async (busca: string) => {
      await pagina.evaluate((b: string) => {
        const w = window as any;
        w.render(null, document.getElementById('raiz')); // sai de Clientes (Hoje): as duas colunas desconectam
        history.replaceState(null, '', location.pathname + b);
        w.desenhar();
      }, busca);
      await esperar();
    };
    await pagina.goto(`${ORIGEM}/portal_corretor/clientes?item=7&sugerir=1`);
    await esperar();
    assert.equal(await sugestoes(), 1, '(a) primeira abertura com sugerir sugere uma vez');
    assert.equal(await pagina.evaluate(() => location.search), '?item=7', 'o ?sugerir=1 sai do endereço');
    await pagina.evaluate(() => {
      const w = window as any;
      w.achar(document.querySelector('pc-ficha-contato-foco'), 'urbi-abas').dispatchEvent(new CustomEvent('urbi:aba-selecionar', { detail: { id: 'enviados' }, bubbles: true, composed: true }));
    });
    await esperar();
    await pagina.evaluate(() => (window as any).desenhar());
    await esperar();
    assert.equal(await sugestoes(), 1, '(b) mesma visita: trocar de aba e redesenhar não sugere de novo');
    assert.equal(await aba(), 'enviados', '(b) o estado da visita se mantém');
    await chegar('?item=7&sugerir=1&secao=linha');
    assert.equal(await sugestoes(), 2, '(c) voltar ao mesmo contato com sugerir sugere de novo');
    assert.equal(await aba(), 'linha', '(c) a aba vem do endereço');
    await chegar('?item=7');
    assert.equal(await sugestoes(), 2, '(d) voltar sem sugerir não sugere');
    assert.equal(await aba(), 'resumo', '(d) aba padrão');
  } finally {
    await navegador.close();
  }
});
