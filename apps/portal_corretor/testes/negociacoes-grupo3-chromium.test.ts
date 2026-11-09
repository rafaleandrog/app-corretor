import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import schema from '../schema.json';
import { rotas } from '../backend/rotas';
import { BancoFalso, comServidor, type Unico } from './apoio';

// Etapa 4, grupo 3 (P15 e M8) no Chromium, com as respostas REAIS das rotas (#178: o teste antigo
// inventava `contato_nome`): a lista e o detalhe saem de `GET /negociacoes` e `GET /negociacoes/:id`
// rodando sobre o banco falso. Sem `?item=` a tela abre na primeira negociação; a escada é lista
// compacta; Nova contraproposta abaixo do recuo pede a confirmação e reenvia; depois de agir, a lista
// relê (#188); com o acordo no proprietário, a decisão dele aparece no Próximo movimento.

function playwright(): any {
  try {
    return createRequire(import.meta.url)('playwright');
  } catch {
    return null;
  }
}

const ORIGEM = 'https://app.exemplo';
const EM_ANDAMENTO = (schema.tabelas.negociacoes.unicos as unknown[]).find((u) => !Array.isArray(u)) as Exclude<Unico, string>;
const UNICOS: Record<string, Unico[]> = { negociacoes: [EM_ANDAMENTO, 'codigo'], mandatos_negociacao: ['negociacao_id+versao'], config_negociador: ['chave'] };
const MANDATO = {
  preco_pedido_c: 145_000_000, alvo_c: 140_000_000, recuo_c: 136_000_000, batna_vendedor: 'Outra familia visitou',
  concessoes: [{ item: 'prazo de 60 dias', limite: 'ate 60 dias', contrapartida: 'entrada de 30%' }],
  validade: '2099-12-31', autonomia: 'pergunta_antes',
};

/** Respostas reais das rotas: uma negociação com mandato e uma oferta; `acordo` a leva ao proprietário. */
async function respostasReais(acordo: boolean) {
  const banco = new BancoFalso(UNICOS);
  const d = banco.dados(100);
  const contato = await d.criar('contatos', { nome: 'Ana Ribeiro', telefone: '+5561988887777' });
  const negocio = await d.criar('negocios', { contato_id: contato.id, titulo: 'Compra', pipeline: 'compra', etapa_id: 1, responsavel_id: 1 });
  const imovel = await d.criar('imoveis', { codigo: 'IM-0007', titulo: 'Casa 4 quartos, Jardim Botânico', preco_c: 145_000_000 });
  const saida: Record<string, unknown> = {};
  await comServidor(rotas, { usuario: 1, conta: 100, papeis: ['corretor'] }, banco, {}, async (chamar) => {
    const nid = (await chamar('POST', '/negociacoes', { negocio_id: negocio.id, imovel_id: imovel.id, conduzida_por: 'corretor' })).corpo.id;
    await chamar('PUT', `/negociacoes/${nid}/mandato`, MANDATO);
    const oferta = (await chamar('POST', `/negociacoes/${nid}/propostas`, { direcao: 'comprador', valor_c: 132_000_000 })).corpo;
    if (acordo) await chamar('POST', `/negociacoes/${nid}/decisao`, { acao: 'aceitar_acordo', proposta_id: oferta.id });
    saida.nid = nid;
    saida.oferta = oferta.id;
    saida.lista = (await chamar('GET', '/negociacoes?estado=ativa,aguardando_corretor,aguardando_cliente,aguardando_proprietario,pausada&por_pagina=100')).corpo;
    saida.detalhe = (await chamar('GET', `/negociacoes/${nid}`)).corpo;
    saida.mandato = (await chamar('GET', `/negociacoes/${nid}/mandato`)).corpo;
  });
  return saida;
}

const ENTRADA = `
import { render } from 'lit';
window.render = render;
import { renderClientes } from './frontend/telas/clientes';
window.chamadas = [];
window.corpos = [];
window.alertas = [];
window.confirmacoes = [];
window.urbiVerso = {
  subRota: () => location.pathname.replace(/^\\/portal_corretor/, '') || '/',
  href: (s) => '/portal_corretor' + s,
  navegarSub: () => {},
  usuario: () => ({ id: 1, nome: 'Marina' }),
  contexto: () => ({ conta: { resolucao: 'escopado', contas: [{ id: 100, nome: 'A' }], contaEscrita: 100 } }),
  notificar: () => {},
  alertar: async (a) => { window.alertas.push(a.titulo + ' | ' + a.mensagem); },
  confirmar: async (c) => { window.confirmacoes.push(c.titulo); return true; },
  formulario: async (f) => { (window.formularios ??= []).push(f.titulo); const r = window.respostaFormulario ?? null; window.respostaFormulario = null; return r; },
  api: async (rota, opcoes) => {
    const metodo = opcoes?.method ?? 'GET';
    const R = window.RESPOSTAS;
    window.chamadas.push(metodo + ' ' + rota);
    if (opcoes?.body) window.corpos.push(JSON.parse(opcoes.body));
    const [caminho] = rota.split('?');
    if (caminho === '/conta') return { configuracoes: { dias_cliente_parado: 7 } };
    if (caminho === '/negociador/ia') return { disponivel: true };
    if (caminho === '/negociador/negociadores') return { dados: [] };
    if (caminho === '/negociacoes') return R.lista;
    if (caminho === '/negociacoes/' + R.nid) return R.detalhe;
    if (caminho === '/negociacoes/' + R.nid + '/mandato') return R.mandato;
    if (caminho === '/negociacoes/' + R.nid + '/propostas' && metodo === 'POST') {
      const corpo = JSON.parse(opcoes.body);
      if (!corpo.confirmar_abaixo_do_recuo) {
        throw Object.assign(new Error('Esta contraproposta fica abaixo do ponto de recuo do mandato.'), { status: 422, codigo: 'MOVIMENTO_BLOQUEADO',
          detalhes: ['ABAIXO_DO_RECUO: valor abaixo do ponto de recuo', 'PASSO_ACIMA_DO_LIMITE: concessão maior que o passo máximo desta rodada'] });
      }
      return { id: 99, estado: 'enviada', canal: 'portal', abaixo_do_recuo: true, texto: 'Olá', link: null };
    }
    if (caminho.startsWith('/propostas/') && metodo === 'PATCH') return { ok: true, comissao_prevista_c: null };
    return {};
  },
};
const raiz = document.getElementById('raiz');
const desenhar = () => render(renderClientes(desenhar), raiz);
window.desenhar = desenhar;
window.iniciar = (respostas) => { window.RESPOSTAS = respostas; desenhar(); };
`;

const PROFUNDO = `
window.profundo = (no) => {
  if (!no) return '';
  const partes = [];
  const andar = (n) => {
    if (n.nodeType === 3) partes.push(n.textContent);
    if (n.nodeType === 1 && n.getAttribute('titulo')) partes.push(n.getAttribute('titulo'));
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
window.botao = (raiz, texto) => window.todos(raiz, 'urbi-botao').find((b) => window.profundo(b).includes(texto));
`;

async function montar(pw: any) {
  const pacote = await build({ stdin: { contents: ENTRADA, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, write: false, format: 'iife', target: 'es2022', tsconfig: 'tsconfig.json', logLevel: 'silent' });
  const html = `<!doctype html><html><head><meta charset="utf-8"></head><body><div id="raiz"></div><script>${PROFUNDO}</script><script>${pacote.outputFiles[0].text}</script></body></html>`;
  const navegador = await pw.chromium.launch();
  const pagina = await navegador.newPage({ viewport: { width: 1440, height: 900 } });
  await pagina.route(`${ORIGEM}/**`, (r: any) => r.fulfill({ contentType: 'text/html', body: html }));
  return { navegador, pagina };
}

test('P15 no Chromium com as rotas reais: nomes (#178), abre na primeira, escada compacta, Nova contraproposta abaixo do recuo e a lista relida (#188)', async (t) => {
  const pw = playwright();
  if (!pw) return t.skip('Playwright não instalado neste ambiente');
  const R = await respostasReais(false);
  const { navegador, pagina } = await montar(pw);
  const esperar = () => pagina.waitForTimeout(150);
  try {
    await pagina.goto(`${ORIGEM}/portal_corretor/clientes?visao=negociacoes`);
    await pagina.evaluate((r: unknown) => (window as any).iniciar(r), R);
    await esperar();
    await pagina.evaluate(() => (window as any).desenhar());
    await esperar();
    const r: any = await pagina.evaluate(() => {
      const w = window as any;
      const l = w.todos(document.querySelector('pc-negociacoes-lista'), 'urbi-lista')[0];
      const div = document.createElement('div');
      w.render(l.render_item(l.itens[0]), div);
      const foco = document.querySelector('pc-negociacao-foco');
      return {
        url: location.search,
        lista: w.profundo(div),
        centro: w.profundo(foco),
        tabela: w.todos(foco, 'urbi-tabela').length,
        escada: w.todos(foco, 'urbi-lista').length,
      };
    });
    assert.match(r.url, new RegExp(`item=${R.nid}`), 'sem ?item=, a primeira negociação abre');
    assert.match(r.lista, /Ana Ribeiro/);
    assert.match(r.lista, /Casa 4 quartos, Jardim Botânico/);
    assert.match(r.lista, /R\$ 1,32 mi × R\$ 1,45 mi · −9%/);
    assert.match(r.lista, /Você · (agora|há )/, 'quem conduz e o tempo desde a última rodada');
    assert.match(r.centro, /Ana Ribeiro · Casa 4 quartos, Jardim Botânico/);
    assert.match(r.centro, /rodada 1 de 4/);
    assert.equal(r.tabela, 0, 'a escada não é mais a tabela de 8 colunas');
    assert.ok(r.escada >= 1);

    // Nova contraproposta abaixo do recuo: 422, a confirmação, o reenvio com a marca; depois, a lista relê.
    const antes = await pagina.evaluate(() => (window as any).chamadas.filter((c: string) => c.startsWith('GET /negociacoes?')).length);
    await pagina.evaluate(() => {
      const w = window as any;
      w.respostaFormulario = { valor: '1.300.000', condicoes: '', concessao: '', validade_horas: '', mensagem: '', canal: 'portal' };
      w.botao(document.querySelector('pc-negociacao-foco'), 'Nova contraproposta').click();
    });
    await pagina.waitForTimeout(400);
    const depois: any = await pagina.evaluate(() => {
      const w = window as any;
      return {
        corpos: w.corpos.filter((c: any) => c.direcao === 'vendedor'),
        confirmacoes: w.confirmacoes.slice(),
        alertas: w.alertas.slice(),
        listas: w.chamadas.filter((c: string) => c.startsWith('GET /negociacoes?')).length,
      };
    });
    assert.deepEqual(depois.confirmacoes, ['Abaixo do ponto de recuo']);
    assert.equal(depois.corpos.length, 2);
    assert.equal(depois.corpos[0].confirmar_abaixo_do_recuo, undefined);
    assert.equal(depois.corpos[1].confirmar_abaixo_do_recuo, true);
    assert.equal(depois.corpos[1].valor_c, 130_000_000);
    assert.deepEqual(depois.alertas, []);
    assert.ok(depois.listas > antes, 'a lista relê depois de agir (#188)');
  } finally {
    await navegador.close();
  }
});

test('P15 no Chromium: acordo com o proprietário mostra Aceita · Recusa · Contraproposta e registra pela rota da proposta', async (t) => {
  const pw = playwright();
  if (!pw) return t.skip('Playwright não instalado neste ambiente');
  const R = await respostasReais(true);
  const { navegador, pagina } = await montar(pw);
  const esperar = () => pagina.waitForTimeout(150);
  try {
    await pagina.goto(`${ORIGEM}/portal_corretor/clientes?visao=negociacoes&item=${R.nid}`);
    await pagina.evaluate((r: unknown) => (window as any).iniciar(r), R);
    await esperar();
    const direita = await pagina.evaluate(() => (window as any).profundo(document.querySelector('pc-negociacao-contexto')));
    assert.match(direita, /O acordo está com o proprietário/);
    assert.match(direita, /Aceita.*Recusa.*Contraproposta do proprietário/);
    await pagina.evaluate(() => (window as any).botao(document.querySelector('pc-negociacao-contexto'), 'Recusa').click());
    await esperar();
    const chamadas: string[] = await pagina.evaluate(() => (window as any).chamadas.slice());
    assert.ok(chamadas.includes(`PATCH /propostas/${R.oferta}`), chamadas.join(', '));
    // Sem Nova contraproposta com o acordo no proprietário.
    assert.equal(await pagina.evaluate(() => !!(window as any).botao(document.querySelector('pc-negociacao-foco'), 'Nova contraproposta')), false);
  } finally {
    await navegador.close();
  }
});
