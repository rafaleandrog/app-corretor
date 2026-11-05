import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

// Página (P09) e Números (P10) no Padrão B (B7, issue #96) no DOM de verdade (Chromium). Trava a
// estrutura: as três colunas da moldura, o que cada uma mostra e os dados entregues aos primitivos.
// Os `urbi-*` são elementos sem registro; a prévia (`pc-pagina-publica`) é real, com o CSS próprio das
// páginas públicas. Sem Playwright instalado, pula.

function playwright(): any {
  try {
    return createRequire(import.meta.url)('playwright');
  } catch {
    return null;
  }
}

const ORIGEM = 'https://app.exemplo';

const BLOCOS = [
  { tipo: 'apresentacao', ativo: true, titulo: 'Encontre o imóvel certo comigo', texto: 'Atendo no Sudoeste.' },
  { tipo: 'destaques', ativo: true, titulo: 'Imóveis em destaque', codigos: ['IM-0001'] },
  { tipo: 'imoveis', ativo: true, titulo: 'Imóveis à venda' },
  { tipo: 'sobre', ativo: false, titulo: 'Sobre mim', texto: null },
  { tipo: 'bairros', ativo: false, titulo: 'Onde eu atendo', lista: [] },
  { tipo: 'formulario', ativo: true, titulo: 'Fale comigo' },
  { tipo: 'contato', ativo: true, whatsapp: true, instagram: null },
];

const kpis = (leads: number) => ({
  leads, clientes_unicos: leads, etapas: { leads, atendimento: 5, visitou: 3, proposta: 2, ganhos: 1 },
  lead_atendimento: 0.833, lead_visita: 0.5, visita_proposta: 0.667, proposta_ganho: 0.5, conversao_total: 0.167,
  ganhos: 1, ciclo_medio_dias: 20, vgv_c: 145000000, captacoes: 0, visitas: 3,
  motivos_perda: [{ motivo: 'sem_resposta', quantidade: 2 }],
  por_origem: [{ canal: 'instagram', leads: 3, visitaram: 2, ganhos: 1, abertos: 2, perdidos: 0 }, { canal: 'pagina', leads: 3, visitaram: 1, ganhos: 0, abertos: 3, perdidos: 0 }],
});

const ENTRADA = `
import { render } from 'lit';
import { aoAbrirPagina, renderPagina } from './frontend/telas/pagina';
import { aoAbrirNumeros, renderNumeros } from './frontend/telas/desempenho';
import './frontend/telas/previa-pagina';
window.navegou = [];
window.litRender = render;
window.urbiVerso = {
  subRota: () => location.pathname.replace(/^\\/portal_corretor/, '') || '/',
  href: (s) => '/portal_corretor' + s,
  navegarSub: (s) => window.navegou.push(s),
  usuario: () => ({ id: 1, nome: 'Rafael' }),
  contexto: () => window.contasTeste
    ? { conta: { resolucao: 'escopado', contas: window.contasTeste } }
    : { conta: { resolucao: 'escopado', contas: [{ id: 100, nome: 'A' }], contaEscrita: 100 } },
  notificar: () => {},
  alertar: async () => {},
  api: async (rota, opcoes) => {
    const [caminho] = rota.split('?');
    if (caminho === '/pagina') return {
      pagina: { endereco: 'rafael', nome_exibicao: 'Rafael Gualberto', blocos: ${JSON.stringify(BLOCOS)}, publicada_em: '2026-10-20T12:00:00.000Z', gerada_por_ia: false },
      salva: true, url: 'https://corretor.exemplo/portal_corretor/p?c=rafael', marcados_para_pagina: 2, sem_creci: true,
      numeros: { contatos_30d: 14, visitas_30d: null },
    };
    if (caminho === '/pagina/previa') return {
      publicada: true,
      pagina: { endereco: 'rafael', nome: 'Rafael Gualberto', creci: null, telefone: '+5561999990000', cor: '#12302F', foto_url: null, url_formulario: null,
        blocos: ${JSON.stringify(BLOCOS.filter((b) => b.ativo))} },
      imoveis: [{ codigo: 'IM-0001', titulo: 'Casa 4 quartos', tipo: 'casa', situacao: 'ativo', preco_c: 145000000, bairro: 'Jardim Botânico', cidade: 'Brasília', quartos: 4, area_util_m2: 320, vagas: 2, capa: null }],
    };
    if (caminho === '/numeros/negociacao') {
      window.ultimaNegociacao = rota;
      // Cenário de duas contas: cada leitura espera o seu portão e devolve números próprios da conta.
      const conta = Number(opcoes?.headers?.['X-Conta'] ?? 0);
      if (conta) await window.portao[conta];
      const vazio = { propostas_recebidas: 0, encerradas: 0, ganhas: 0, taxa_acordo: null, desconto_medio: null, rodadas_medias: null, dentro_zopa: null, zopa_sem_estimativa: 0, objecoes: [], sugestoes_enviadas: 0, sugestoes_sem_edicao: 0, taxa_sem_edicao: null };
      return {
        dias: 30, periodo: { de: '2026-10-06T00:00:00.000Z', ate: '2026-11-05T00:00:00.000Z' },
        atual: { propostas_recebidas: conta === 200 ? 9 : 5, encerradas: 4, ganhas: 3, taxa_acordo: 0.75, desconto_medio: 0.075, rodadas_medias: 3, dentro_zopa: null, zopa_sem_estimativa: 3,
          objecoes: [{ categoria: 'preco', quantidade: 2 }, { categoria: 'decisao_compartilhada', quantidade: 1 }], sugestoes_enviadas: 3, sugestoes_sem_edicao: 2, taxa_sem_edicao: 0.667 },
        anterior: { ...vazio, propostas_recebidas: 2, desconto_medio: 0.045, rodadas_medias: 2.5, taxa_sem_edicao: 0.5, objecoes: [{ categoria: 'preco', quantidade: 1 }] },
      };
    }
    if (caminho === '/numeros') {
      window.ultimaNumeros = rota;
      return {
        dias: 30, origem: null, origens_disponiveis: ['instagram', 'pagina', 'nao_informada'], periodo: { de: '2026-10-06T00:00:00.000Z', ate: '2026-11-05T00:00:00.000Z' },
        atual: ${JSON.stringify(kpis(6))}, anterior: ${JSON.stringify(kpis(4))},
        previsao: { valor_c: 10482500, sem_dados: 0 },
        serie_leads: { categorias: ['01/10', '02/10'], atual: [3, 3], anterior: [2, 2] },
        por_hora: { horas: [1,0,0,0,0,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,1,0,0,1], fora: 3, inicio: 8, fim: 19 },
        melhores_origens: [{ canal: 'instagram', leads: 3, visitaram: 2, ganhos: 1, abertos: 2, perdidos: 0 }, { canal: 'pagina', leads: 3, visitaram: 1, ganhos: 0, abertos: 3, perdidos: 0 }],
        o_que_melhorar: { texto: '67% das visitas viram proposta, mas só 50% dos contatos chegam à visita: é aí que mais se perde.', motivo: 'sem_resposta', clientes: 2, perdido_desde: '2026-10-06T00:00:00.000Z' },
        conteudo: { publicadas: 4, publicadas_anterior: 2 },
      };
    }
    return {};
  },
};
const raiz = document.getElementById('raiz');
window.tela = 'pagina';
const desenhar = () => render(window.tela === 'pagina' ? renderPagina(desenhar) : renderNumeros(desenhar), raiz);
window.desenhar = desenhar;
window.abrir = (t) => { window.tela = t; desenhar(); (t === 'pagina' ? aoAbrirPagina : aoAbrirNumeros)(); };
`;

// O primitivo `urbi-3-colunas` não é registrado neste teste (só a prévia é real); este CSS, só do teste,
// reproduz o desktop documentado (esquerda | centro mais largo | direita) para a medição provar que as
// três colunas são filhas diretas da moldura, nos slots certos, com conteúdo e lado a lado.
const MOLDURA_DE_TESTE = 'urbi-3-colunas{display:grid;grid-template-columns:220px minmax(0,1fr) 280px;width:100%}urbi-3-colunas>urbi-hospedeiro{display:block;min-width:0}';

const PROFUNDO = `
window.profundo = (no) => {
  if (!no) return '';
  const partes = [];
  const andar = (n) => {
    if (n.nodeType === 3) partes.push(n.textContent);
    if (n.nodeType === 1) for (const a of ['titulo', 'mensagem', 'submensagem', 'rotulo', 'label']) if (n.getAttribute(a)) partes.push(n.getAttribute(a));
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

test('Página e Números no Chromium: três colunas, prévia com destaque, relatórios, O que melhorar e Ver os N clientes', async (t) => {
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
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${MOLDURA_DE_TESTE}</style></head><body><div id="raiz"></div><script>${PROFUNDO}</script><script>${pacote.outputFiles[0].text}</script></body></html>`;
  const navegador = await pw.chromium.launch();
  try {
    const pagina = await navegador.newPage({ viewport: { width: 1440, height: 900 } });
    const erros: string[] = [];
    pagina.on('pageerror', (e: Error) => erros.push(e.message));
    await pagina.route(`${ORIGEM}/**`, (r: any) => r.fulfill({ contentType: 'text/html', body: html }));
    const esperar = () => pagina.waitForTimeout(120);
    // Moldura de três colunas medida: lado a lado, sem sobreposição, cada uma com largura.
    const medirMoldura = async (tela: string) => {
      const m = await pagina.evaluate(() => {
        const c = document.querySelector('urbi-3-colunas')!;
        const caixa = (s: string) => {
          const e = c.querySelector(`:scope > urbi-hospedeiro[slot="${s}"]`)!;
          const { left, right, width, height } = e.getBoundingClientRect();
          return { left, right, width, height };
        };
        return { esquerda: caixa('esquerda'), centro: caixa('centro'), direita: caixa('direita') };
      });
      for (const k of ['esquerda', 'centro', 'direita'] as const) {
        assert.ok(m[k].width > 0 && m[k].height > 0, `${tela}: coluna ${k} visível (${m[k].width}x${m[k].height})`);
      }
      assert.ok(m.esquerda.right <= m.centro.left + 0.5, `${tela}: esquerda à esquerda do centro`);
      assert.ok(m.centro.right <= m.direita.left + 0.5, `${tela}: centro à esquerda da direita`);
    };
    const colunas = () =>
      pagina.evaluate(() => {
        const w = window as any;
        const c = document.querySelector('urbi-3-colunas')!;
        const col = (s: string) => c.querySelector(`urbi-hospedeiro[slot="${s}"]`);
        return {
          url: location.pathname + location.search,
          esquerda: w.profundo(col('esquerda')),
          centro: w.profundo(col('centro')),
          direita: w.profundo(col('direita')),
          estilos: document.querySelectorAll('#raiz style, #raiz [style]').length,
        };
      });

    // ── P09 · Página ──
    await pagina.goto(`${ORIGEM}/portal_corretor/pagina`);
    await pagina.evaluate(() => (window as any).abrir('pagina'));
    await esperar();
    let r: any = await colunas();
    assert.match(r.esquerda, /rafael/);
    assert.match(r.esquerda, /Publicada desde/);
    assert.match(r.esquerda, /Refazer a página com IA/);
    const blocos = await pagina.evaluate(() => {
      const w = window as any;
      const lista = w.todos(document.querySelector('urbi-hospedeiro[slot="esquerda"]'), 'urbi-lista')[0];
      return { tipos: lista.itens.map((b: any) => b.tipo), ativo: lista.itens.filter((b: any, i: number) => lista.itemAtivo(b, i)).map((b: any) => b.tipo), mostrar: w.todos(lista, 'urbi-checkbox').length };
    });
    assert.deepEqual(blocos.tipos, ['apresentacao', 'destaques', 'imoveis', 'sobre', 'bairros', 'formulario', 'contato']);
    assert.deepEqual(blocos.ativo, ['apresentacao'], 'sem ?item=, o primeiro bloco');
    assert.match(r.centro, /Pré-visualização/);
    assert.match(r.centro, /Rafael Gualberto/, 'a prévia é a página pública');
    assert.doesNotMatch(r.centro, /CRECI/, 'sem CRECI, a capa não o mostra (D-93)');
    assert.match(r.centro, /Na prévia o formulário não envia/);
    assert.match(r.direita, /Bloco: Apresentação/);
    assert.match(r.direita, /Editar em Ajustes › Conta e marca/);
    assert.match(r.direita, /Adicione seu CRECI ao perfil/);
    assert.match(r.direita, /Contatos/);
    assert.match(r.direita, /Copiar link/);
    assert.equal(r.estilos, 0, 'nenhum <style> nem style= na tela (a exceção da prévia fica no shadow dela)');
    await medirMoldura('Página');

    // Cada "Mostrar" diz de qual bloco é (nome acessível por bloco).
    const nomes = await pagina.evaluate(() => {
      const w = window as any;
      const lista = w.todos(document.querySelector('urbi-hospedeiro[slot="esquerda"]'), 'urbi-lista')[0];
      // `urbi-lista` não está registrada: renderiza-se o `render_item` de cada bloco à parte.
      return lista.itens.map((b: any, i: number) => {
        const d = document.createElement('div');
        w.litRender(lista.render_item(b, i), d);
        return d.querySelector('urbi-checkbox')!.getAttribute('label');
      });
    });
    assert.equal(new Set(nomes).size, 7, `rótulos distintos: ${nomes}`);
    assert.ok(nomes.every((n: string) => /^Mostrar .+/.test(n)));

    // Celular: a prévia tem largura de celular; Computador: ocupa o centro.
    const largura = () =>
      pagina.evaluate(() => {
        const w = window as any;
        const p = w.todos(document, 'pc-previa-pagina')[0];
        return { dispositivo: p.getAttribute('dispositivo'), largura: p.shadowRoot.querySelector('.tela').getBoundingClientRect().width };
      });
    let l = await largura();
    assert.equal(l.dispositivo, 'celular');
    assert.ok(l.largura <= 392, `celular com ${l.largura}px`);
    await pagina.evaluate(() => {
      const w = window as any;
      const b = w.todos(document, 'urbi-botao-alternar').find((x: any) => x.textContent.includes('Computador'));
      b.dispatchEvent(new CustomEvent('urbi:botao-alternar-change', { detail: true }));
    });
    await esperar();
    l = await largura();
    assert.equal(l.dispositivo, 'computador');
    assert.ok(l.largura > 392, `computador com ${l.largura}px`);

    // Par exclusivo: clicar no botão já ligado não o apaga (o primitivo inverte o próprio `ligado`).
    const ligados = () =>
      pagina.evaluate(() => {
        const w = window as any;
        const o: Record<string, boolean> = {};
        for (const b of w.todos(document, 'urbi-botao-alternar')) {
          const n = b.textContent.trim();
          if (n === 'Celular' || n === 'Computador') o[n] = b.ligado;
        }
        return o;
      });
    const clicar = async (nome: string) => {
      await pagina.evaluate((n: string) => {
        const w = window as any;
        const b = w.todos(document, 'urbi-botao-alternar').find((x: any) => x.textContent.trim() === n);
        b.ligado = !b.ligado; // o que o primitivo faz ao clique
        b.dispatchEvent(new CustomEvent('urbi:botao-alternar-change', { detail: b.ligado }));
      }, nome);
      await esperar();
    };
    assert.deepEqual(await ligados(), { Celular: false, Computador: true });
    await clicar('Computador');
    assert.deepEqual(await ligados(), { Celular: false, Computador: true }, 'Computador segue aceso');
    assert.equal((await largura()).dispositivo, 'computador');
    await clicar('Celular');
    assert.deepEqual(await ligados(), { Celular: true, Computador: false });
    await clicar('Celular');
    assert.deepEqual(await ligados(), { Celular: true, Computador: false }, 'Celular segue aceso');
    assert.equal((await largura()).dispositivo, 'celular');

    // Escolher "Imóveis em destaque": vira o selecionado, vai para a URL e ganha contorno na prévia.
    await pagina.evaluate(() => {
      const w = window as any;
      const lista = w.todos(document.querySelector('urbi-hospedeiro[slot="esquerda"]'), 'urbi-lista')[0];
      lista.dispatchEvent(new CustomEvent('urbi:lista-click', { detail: { item: lista.itens[1], indice: 1 } }));
    });
    await esperar();
    r = await colunas();
    assert.match(r.url, /item=destaques/);
    assert.match(r.direita, /Bloco: Imóveis em destaque/);
    assert.match(r.direita, /Escolhidos: IM-0001/);
    const destaque = await pagina.evaluate(() => {
      const w = window as any;
      const pub = w.todos(document, 'pc-pagina-publica')[0];
      return [...pub.shadowRoot.querySelectorAll('.destacado')].map((e: Element) => e.querySelector('h2')?.textContent);
    });
    assert.deepEqual(destaque, ['Imóveis em destaque']);
    const contorno = await pagina.evaluate(() => {
      const w = window as any;
      const pub = w.todos(document, 'pc-pagina-publica')[0];
      const e = pub.shadowRoot.querySelector('.destacado');
      const c = getComputedStyle(e);
      return { estilo: c.outlineStyle, largura: c.outlineWidth, cor: c.outlineColor };
    });
    assert.equal(contorno.estilo, 'solid');
    assert.equal(contorno.largura, '3px');
    assert.notEqual(contorno.cor, 'rgba(0, 0, 0, 0)');

    // ── P10 · Números ──
    await pagina.goto(`${ORIGEM}/portal_corretor/numeros`);
    await pagina.evaluate(() => (window as any).abrir('numeros'));
    await esperar();
    r = await colunas();
    const relatorios = await pagina.evaluate(() => {
      const w = window as any;
      const lista = w.todos(document.querySelector('urbi-hospedeiro[slot="esquerda"]'), 'urbi-lista')[0];
      return lista.itens.map((x: any) => `${x.titulo}${x.emBreve ? ' (em breve)' : ''}`);
    });
    assert.deepEqual(relatorios, ['Resumo', 'Funil e conversão', 'Origem dos contatos', 'Tempo de resposta', 'Conteúdo', 'Mensageiro (em breve)', 'Negociação']);
    assert.doesNotMatch(r.esquerda, /Créditos/, 'créditos não entram (D-87)');
    assert.match(r.centro, /Resumo/);
    await medirMoldura('Números');
    const origens = await pagina.evaluate(() => {
      const w = window as any;
      return w.todos(document.querySelector('urbi-hospedeiro[slot="centro"]'), 'urbi-select')[0].opcoes.map((o: any) => o.rotulo);
    });
    assert.deepEqual(origens, ['Todas as origens', 'Instagram', 'Minha página'], 'só canais do catálogo com leads');
    assert.match(r.centro, /Comparar/);
    for (const k of ['Leads', 'Conversão total', 'Vendas', 'Comissão prevista']) assert.match(r.centro, new RegExp(k));
    assert.match(r.direita, /O que melhorar/);
    assert.match(r.direita, /Ver os 2 clientes/);
    assert.match(r.direita, /Melhores origens/);
    const melhores = await pagina.evaluate(() => {
      const w = window as any;
      return w.todos(document.querySelector('urbi-hospedeiro[slot="direita"]'), 'urbi-lista')[0].itens.map((o: any) => [o.canal, o.visitaram]);
    });
    assert.deepEqual(melhores, [['instagram', 2], ['pagina', 1]]);
    assert.match(r.direita, /Exportar CSV/);
    assert.equal(r.estilos, 0);

    // Funil e conversão: 4 KPIs do mockup, barras, contatos por horário e por que perdemos.
    await pagina.evaluate(() => {
      const w = window as any;
      const lista = w.todos(document.querySelector('urbi-hospedeiro[slot="esquerda"]'), 'urbi-lista')[0];
      lista.dispatchEvent(new CustomEvent('urbi:lista-click', { detail: { item: lista.itens[1], indice: 1 } }));
    });
    await esperar();
    r = await colunas();
    assert.match(r.url, /relatorio=funil/);
    for (const k of ['Contatos', 'Contato → visita', 'Visita → proposta', 'Ganhos', 'Até onde os contatos chegaram', 'Contatos por horário', 'Por que perdemos']) assert.match(r.centro, new RegExp(k));
    assert.match(r.centro, /3 de 6 no período/);
    const horario = await pagina.evaluate(() => {
      const w = window as any;
      const g = w.todos(document, 'urbi-grafico-colunas').find((x: any) => x.categorias.length === 24);
      return g.series.map((s: any) => [s.rotulo, s.valores.reduce((a: number, b: number) => a + b, 0)]);
    });
    assert.deepEqual(horario, [['No horário (8h–19h)', 3], ['Fora do horário', 3]]);

    // Ver os N clientes abre Clientes filtrado pelo motivo e pelo início do período.
    await pagina.evaluate(() => {
      const w = window as any;
      w.todos(document, 'urbi-botao').find((b: any) => b.textContent.includes('Ver os 2 clientes')).click();
    });
    const navegou = await pagina.evaluate(() => (window as any).navegou);
    assert.deepEqual(navegou, ['/clientes?perdido_motivo=sem_resposta&perdido_desde=2026-10-06T00%3A00%3A00.000Z']);

    // Negociação (D6): os 7 KPIs da 11.2 pelo `GET /numeros/negociacao`; sem dado, frase no lugar do número.
    await pagina.evaluate(() => {
      const w = window as any;
      const lista = w.todos(document.querySelector('urbi-hospedeiro[slot="esquerda"]'), 'urbi-lista')[0];
      lista.dispatchEvent(new CustomEvent('urbi:lista-click', { detail: { item: lista.itens[6], indice: 6 } }));
    });
    await esperar();
    r = await colunas();
    assert.match(r.url, /relatorio=negociacao/);
    assert.equal(await pagina.evaluate(() => (window as any).ultimaNegociacao), '/numeros/negociacao?dias=30');
    assert.doesNotMatch(r.centro, /Em breve/);
    for (const k of ['Propostas recebidas', 'Taxa de acordo', '3 de 4 encerradas', 'Desconto médio', 'Rodadas até o acordo', 'Acordos dentro da ZOPA',
      'Nenhum acordo com o teto do comprador estimado', 'Sugestões aprovadas sem edição', '2 de 3 enviadas', 'Objeções mais frequentes', '\\+3 que nos 30 dias anteriores',
      '\\+3 pontos que nos 30 dias anteriores', '\\+0,5 que nos 30 dias anteriores', '\\+17 pontos que nos 30 dias anteriores']) {
      assert.match(r.centro, new RegExp(k), k);
    }
    const kpisNeg = await pagina.evaluate(() =>
      (window as any).todos(document.querySelector('urbi-hospedeiro[slot="centro"]'), 'urbi-kpi').map((k: any) => [k.getAttribute('rotulo'), k.valor]),
    );
    assert.deepEqual(kpisNeg, [['Propostas recebidas', '5'], ['Taxa de acordo', '75%'], ['Desconto médio', '7,5%'], ['Rodadas até o acordo', '3'], ['Sugestões aprovadas sem edição', '67%']],
      'a ZOPA sem estimativa vira frase, não número');
    const objecoes = await pagina.evaluate(() => (window as any).todos(document.querySelector('urbi-hospedeiro[slot="centro"]'), 'urbi-grafico-colunas')[0].categorias);
    assert.deepEqual(objecoes, ['Preço', 'Decisão compartilhada']);
    // Comparar ligado: o período anterior ao lado, alinhado às categorias exibidas (ausente no anterior = 0).
    const serieObjecoes = await pagina.evaluate(() => (window as any).todos(document.querySelector('urbi-hospedeiro[slot="centro"]'), 'urbi-grafico-colunas')[0].series);
    assert.deepEqual(serieObjecoes, [{ rotulo: 'Este período', valores: [2, 1] }, { rotulo: 'Período anterior', valores: [1, 0] }]);
    assert.equal(await pagina.evaluate(() => (window as any).todos(document.querySelector('urbi-hospedeiro[slot="centro"]'), 'urbi-select').length), 0, 'sem filtro de origem neste relatório');
    assert.equal(r.estilos, 0);

    // Apelido antigo `?item=` ainda abre o relatório; o período vai à consulta.
    await pagina.goto(`${ORIGEM}/portal_corretor/numeros?item=origem&dias=90`);
    await pagina.evaluate(() => (window as any).abrir('numeros'));
    await esperar();
    r = await colunas();
    assert.match(r.centro, /Origem dos contatos/);
    assert.match(r.centro, /Leads por canal/);
    assert.equal(await pagina.evaluate(() => (window as any).ultimaNumeros), '/numeros?dias=90');

    // Troca de conta com a leitura da outra em voo: a resposta da conta A nunca aparece na conta B.
    await pagina.goto(`${ORIGEM}/portal_corretor/numeros?relatorio=negociacao&dias=30`);
    await pagina.evaluate(() => {
      const w = window as any;
      w.contasTeste = [{ id: 100, nome: 'A' }, { id: 200, nome: 'B' }];
      localStorage.setItem('portal_corretor:conta', '100');
      w.portao = {};
      w.liberar = {};
      for (const c of [100, 200]) w.portao[c] = new Promise((ok) => (w.liberar[c] = ok));
    });
    await pagina.evaluate(() => (window as any).abrir('numeros')); // leitura da conta A em voo, Negociação aberta
    await esperar();
    await pagina.evaluate(() => {
      history.replaceState(null, '', '/portal_corretor/numeros?relatorio=resumo&dias=30'); // muda de relatório
      localStorage.setItem('portal_corretor:conta', '200'); // troca para a conta B
      (window as any).abrir('numeros');
    });
    await esperar();
    await pagina.evaluate(() => (window as any).liberar[100]()); // a resposta de A chega
    await esperar();
    await pagina.evaluate(() => {
      const w = window as any;
      const lista = w.todos(document.querySelector('urbi-hospedeiro[slot="esquerda"]'), 'urbi-lista')[0];
      lista.dispatchEvent(new CustomEvent('urbi:lista-click', { detail: { item: lista.itens[6], indice: 6 } }));
    });
    await esperar(); // a leitura de B (presa no portão) ainda não chegou
    r = await colunas();
    assert.match(r.centro, /Carregando a negociação/, 'o número de A não aparece na conta B');
    assert.equal(await pagina.evaluate(() => (window as any).todos(document.querySelector('urbi-hospedeiro[slot="centro"]'), 'urbi-kpi').length), 0);
    await pagina.evaluate(() => (window as any).liberar[200]());
    await esperar();
    const propostasB = await pagina.evaluate(() =>
      (window as any).todos(document.querySelector('urbi-hospedeiro[slot="centro"]'), 'urbi-kpi').map((k: any) => [k.getAttribute('rotulo'), k.valor])[0],
    );
    assert.deepEqual(propostasB, ['Propostas recebidas', '9'], 'a leitura da conta B é a exibida');
    assert.deepEqual(erros, []);
  } finally {
    await navegador.close();
  }
});
