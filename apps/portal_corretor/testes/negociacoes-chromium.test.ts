import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

// Clientes › Negociações (D3, issue #102) no DOM de verdade (Chromium): a lista com "última oferta ×
// pedido", a negociação no centro (faixa, escada, sugestão) e o mandato à direita. O sigilo (recuo, alvo,
// BATNA) só vem da rota do mandato e aparece mascarado até o corretor pedir; a sugestão editada abaixo
// do recuo mostra o 422 do backend; o formulário do mandato recusa recuo acima do alvo. Os primitivos
// `urbi-*` são elementos sem registro: o teste mede o que a tela entrega a eles. Sem Playwright, pula.

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
const MANDATO = { id: 3, negociacao_id: 1, versao: 1, preco_pedido_c: 145000000, alvo_c: 140000000, recuo_c: 136000000,
  batna_vendedor: 'Outra familia visitou', concessoes: [{ item: 'prazo de 60 dias', limite: 'ate 60 dias', contrapartida: 'entrada de 30%' }],
  passo_max_pct: 0.4, rodadas_max: 4, validade: '2099-12-31', autonomia: 'pergunta_antes', autorizacao_proprietario: null };
// O resumo do detalhe vem do backend sem recuo, alvo nem BATNA (semSigilo).
const RESUMO = { ...MANDATO };
delete RESUMO.recuo_c; delete RESUMO.alvo_c; delete RESUMO.batna_vendedor;
const DETALHE = {
  id: 1, contato_nome: 'Ana Ribeiro', imovel_id: 5, imovel_titulo: 'Casa J. Botanico', estado: 'ativa', conduzida_por: 'ia', rodadas: 2,
  teto_estimado_comprador_c: 139000000, fonte_estimativa: 'banco aprovou', mandato: RESUMO,
  propostas: [
    { id: 11, rodada: 1, direcao: 'vendedor', autor_tipo: 'corretor', valor_c: 145000000, canal: 'registro', criado_em: '2026-10-27T12:00:00Z' },
    { id: 12, rodada: 2, direcao: 'comprador', autor_tipo: 'cliente', valor_c: 132000000, canal: 'registro', criado_em: '2026-10-28T12:00:00Z' },
  ],
  objecoes: [{ categoria: 'preco' }],
  ultima_fala: { texto: 'Consigo 1,32?', em: '2026-10-28T12:00:00Z' },
  sugestao: { execucao_id: 9, resposta: { contraproposta: { valor_c: 138400000, condicoes: 'entrega em 60 dias' }, mensagem: 'Ana, consigo 1.384.000.', interesses_identificados: ['mudar em 60 dias'] },
    validacoes: [{ ok: true, descricao: 'não ofereceu abaixo do ponto de recuo' }], bloqueado_por: null },
};
window.chamadas = [];
window.alertas = [];
window.urbiVerso = {
  subRota: () => location.pathname.replace(/^\\/portal_corretor/, '') || '/',
  href: (s) => '/portal_corretor' + s,
  navegarSub: () => {},
  usuario: () => ({ id: 1, nome: 'Marina' }),
  contexto: () => ({ conta: { resolucao: 'escopado', contas: [{ id: 100, nome: 'A' }], contaEscrita: 100 } }),
  notificar: () => {},
  alertar: async (a) => { window.alertas.push(a.titulo + ' | ' + a.mensagem); },
  confirmar: async () => window.confirmarResposta ?? true,
  formulario: async () => window.respostaFormulario ?? null,
  api: async (rota, opcoes) => {
    const metodo = opcoes?.method ?? 'GET';
    window.chamadas.push(metodo + ' ' + rota);
    const [caminho] = rota.split('?');
    if (caminho === '/conta') return { configuracoes: { dias_cliente_parado: 7 } };
    if (caminho === '/negociador/ia') return { disponivel: true };
    if (caminho === '/negociacoes') return { dados: [{ id: 1, contato_nome: 'Ana Ribeiro', imovel_titulo: 'Casa J. Botanico', estado: 'ativa', conduzida_por: 'ia', ultima_oferta_c: 132000000, preco_pedido_c: 145000000 }], total: 1 };
    if (caminho === '/negociacoes/1') return DETALHE;
    if (caminho === '/negociacoes/1/mandato') return { vigente: MANDATO, versoes: [MANDATO] };
    if (caminho === '/negociacoes/1/decisao') {
      (window.decisoes ??= []).push(JSON.parse(opcoes?.body ?? '{}'));
      if (window.respostaDecisao) return window.respostaDecisao(JSON.parse(opcoes?.body ?? '{}'));
      throw Object.assign(new Error('A contraproposta não respeita o mandato.'), { status: 422, codigo: 'MOVIMENTO_BLOQUEADO', detalhes: ['Abaixo do ponto de recuo: o app não envia.'] });
    }
    return {};
  },
};
const raiz = document.getElementById('raiz');
const desenhar = () => render(renderClientes(desenhar), raiz);
window.desenhar = desenhar;
desenhar();
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
  const pagina = await navegador.newPage({ viewport: { width: 1440, height: 900 } });
  await pagina.route(`${ORIGEM}/**`, (r: any) => r.fulfill({ contentType: 'text/html', body: html }));
  return { navegador, pagina };
}

test('Negociações no Chromium: lista, faixa, sigilo mascarado, sugestão editada abaixo do recuo e mandato que recusa recuo acima do alvo', async (t) => {
  const pw = playwright();
  if (!pw) return t.skip('Playwright não instalado neste ambiente');
  const { navegador, pagina } = await montar(pw);
  const esperar = () => pagina.waitForTimeout(120);
  try {
    await pagina.goto(`${ORIGEM}/portal_corretor/clientes?visao=negociacoes&item=1`);
    await esperar();
    let r: any = await pagina.evaluate(() => {
      const w = window as any;
      return {
        // O urbi-lista (sem registro no teste) recebe as linhas e o render_item: desenha-se a primeira aqui.
        lista: (() => {
          const l = w.todos(document.querySelector('pc-negociacoes-lista'), 'urbi-lista')[0];
          const div = document.createElement('div');
          w.render(l.render_item(l.itens[0]), div);
          return w.profundo(div);
        })(),
        centro: w.profundo(document.querySelector('pc-negociacao-foco')),
        // Botões de ação no corpo do card (o urbi-card não tem slot "acao").
        semSlotAcao: w.todos(document, 'urbi-botao').every((b: any) => b.getAttribute('slot') !== 'acao'),
        registrar: !!w.botao(document.querySelector('pc-negociacao-foco'), 'Registrar oferta do cliente'),
        direita: w.profundo(document.querySelector('pc-negociacao-contexto')),
        chamadas: w.chamadas.slice(),
      };
    });
    // Lista: última oferta × pedido.
    assert.match(r.lista, /Ana Ribeiro/);
    assert.match(r.lista, /−9%/);
    // O mandato (com o sigilo) só vem da rota própria; a lista e o detalhe não o pedem por outro caminho.
    assert.ok(r.chamadas.includes('GET /negociacoes/1/mandato'));
    assert.ok(r.chamadas.every((c: string) => !/mandato/.test(c) || c === 'GET /negociacoes/1/mandato'));
    // Centro: faixa com o recuo mascarado, escada, última fala e a sugestão com as validações.
    assert.match(r.centro, /Ponto de recuo\s*:\s*•••• \(sigiloso\)/);
    assert.match(r.centro, /ZOPA estimada/);
    assert.match(r.centro, /Consigo 1,32\?/);
    assert.match(r.centro, /Negociador sugere · rodada 3/);
    assert.match(r.centro, /ok: não ofereceu abaixo do ponto de recuo/);
    // A sugestão vem logo depois da faixa, antes da escada (P15, M8).
    assert.match(r.centro, /Faixa da negociação.*Negociador sugere.*Escada de propostas/);
    assert.ok(r.semSlotAcao && r.registrar, 'Registrar oferta do cliente aparece no corpo do cartão');
    assert.match(r.centro, /Rodada 2 de 4/);
    // Direita: o recuo e a BATNA mascarados até o corretor pedir.
    assert.doesNotMatch(`${r.centro} ${r.direita}`, /1\.360\.000/, 'o recuo não aparece em lugar nenhum antes do "mostrar"');
    assert.doesNotMatch(r.direita, /Outra familia/);
    assert.match(r.direita, /Alvo R\$\s?1\.400\.000/);
    await pagina.evaluate(() => {
      const w = window as any;
      w.botao(document.querySelector('pc-negociacao-contexto'), 'mostrar').click();
    });
    await esperar();
    r = await pagina.evaluate(() => (window as any).profundo(document.querySelector('pc-negociacao-contexto')));
    assert.match(r, /Recuo R\$\s?1\.360\.000/, 'mostrar revela o recuo só na tela do corretor');

    // Editar a sugestão para abaixo do recuo: o backend recusa (422) e a tela mostra o motivo.
    await pagina.evaluate(() => {
      const w = window as any;
      w.respostaFormulario = { valor: '1.300.000', condicoes: '', mensagem: 'Ana, faço 1,3.' };
      w.botao(document.querySelector('pc-negociacao-foco'), 'Editar').click();
    });
    await esperar();
    r = await pagina.evaluate(() => ({ alertas: (window as any).alertas.slice(), chamadas: (window as any).chamadas.slice() }));
    assert.ok(r.chamadas.includes('POST /negociacoes/1/decisao'));
    assert.deepEqual(r.alertas, ['A contraproposta não foi enviada | Abaixo do ponto de recuo: o app não envia.']);

    // Mandato (P16): recuo acima do alvo é recusado no próprio formulário, e Salvar fica desligado.
    await pagina.evaluate(() => {
      const w = window as any;
      w.botao(document.querySelector('pc-negociacao-contexto'), 'Editar mandato').click();
    });
    await esperar();
    // Com mandato, o recuo abre mascarado: nem no texto nem num campo, até o corretor tocar em "mostrar".
    r = await pagina.evaluate(() => {
      const w = window as any;
      const modal = w.todos(document, 'pc-mandato-modal')[0];
      return {
        texto: w.profundo(modal),
        campo: !!w.todos(modal, 'urbi-input').find((i: any) => i.getAttribute('label') === 'Ponto de recuo (R$)'),
        valores: w.todos(modal, 'input').map((i: any) => i.value).join(' | '),
        mostrar: !!w.botao(modal, 'mostrar'),
      };
    });
    assert.doesNotMatch(r.texto, /1\.360\.000/, 'o recuo não aparece no modal antes do "mostrar"');
    assert.doesNotMatch(r.valores, /1\.360\.000/);
    assert.match(r.texto, /Ponto de recuo \(R\$\) ••••/);
    assert.deepEqual([r.campo, r.mostrar], [false, true]);
    await pagina.evaluate(() => {
      const w = window as any;
      w.botao(w.todos(document, 'pc-mandato-modal')[0], 'mostrar').click();
    });
    await esperar();
    r = await pagina.evaluate(() => {
      const w = window as any;
      const modal = w.todos(document, 'pc-mandato-modal')[0];
      const recuo = w.todos(modal, 'urbi-input').find((i: any) => i.getAttribute('label') === 'Ponto de recuo (R$)');
      if (!recuo) return false;
      recuo.dispatchEvent(new CustomEvent('urbi:input-change', { detail: { valor: '1.410.000' }, bubbles: true, composed: true }));
      return !!modal;
    });
    assert.equal(r, true);
    await esperar();
    r = await pagina.evaluate(() => {
      const w = window as any;
      const modal = w.todos(document, 'pc-mandato-modal')[0];
      const recuo = w.todos(modal, 'urbi-input').find((i: any) => i.getAttribute('label') === 'Ponto de recuo (R$)');
      return { texto: w.profundo(modal), salvar: w.botao(modal, 'Salvar mandato')?.hasAttribute('desabilitado'), recuoTipo: recuo.getAttribute('tipo'), anexar: !!w.botao(modal, 'Anexar documento') };
    });
    assert.match(r.texto, /Quem negocia e autonomia/);
    assert.equal(r.recuoTipo, null, 'o recuo num urbi-input comum, com a dica de sigilo');
    assert.ok(r.anexar);
    assert.match(r.texto, /O ponto de recuo não pode ficar acima do alvo\./);
    assert.equal(r.salvar, true);
  } finally {
    await navegador.close();
  }
});

test('Negociações no Chromium: aceite só com confirmação; Fazer agora sem WhatsApp ou com a aba barrada não engana o corretor', async (t) => {
  const pw = playwright();
  if (!pw) return t.skip('Playwright não instalado neste ambiente');
  const { navegador, pagina } = await montar(pw);
  const esperar = () => pagina.waitForTimeout(120);
  try {
    await pagina.goto(`${ORIGEM}/portal_corretor/clientes?visao=negociacoes&item=1`);
    await esperar();
    const decisoes = () => pagina.evaluate(() => ((window as any).decisoes ?? []).slice());

    // Passar ao proprietário (o aceite final): sem confirmar, nada sai; confirmado, um aceitar_acordo.
    await pagina.evaluate(() => {
      const w = window as any;
      w.confirmarResposta = false;
      w.botao(document.querySelector('pc-negociacao-contexto'), 'Passar ao proprietário').click();
    });
    await esperar();
    assert.deepEqual(await decisoes(), [], 'cancelar a confirmação não envia nada');
    await pagina.evaluate(() => {
      const w = window as any;
      w.confirmarResposta = true;
      w.respostaDecisao = () => ({ ok: true, estado: 'aguardando_proprietario' });
      w.botao(document.querySelector('pc-negociacao-contexto'), 'Passar ao proprietário').click();
    });
    await esperar();
    const aceites = (await decisoes()).filter((d: any) => d.acao === 'aceitar_acordo');
    assert.equal(aceites.length, 1);
    assert.equal(typeof aceites[0].proposta_id, 'number');

    // Fazer agora com o cliente sem WhatsApp: o backend recusa (422 SEM_WHATSAPP), a aba aberta no clique
    // fecha e o alerta diz o motivo.
    await pagina.evaluate(() => {
      const w = window as any;
      w.decisoes = [];
      w.alertas = [];
      w.janelas = [];
      window.open = (() => {
        const j = { fechada: false, location: { href: '' }, close() { this.fechada = true; } };
        w.janelas.push(j);
        return j;
      }) as any;
      w.respostaDecisao = () => {
        throw Object.assign(new Error('O cliente não tem um telefone de WhatsApp válido no cadastro. Envie pelo portal ou corrija o telefone do contato.'), { status: 422, codigo: 'SEM_WHATSAPP' });
      };
      w.botao(document.querySelector('pc-negociacao-foco'), 'Fazer agora').click();
    });
    await esperar();
    let r: any = await pagina.evaluate(() => ({ alertas: (window as any).alertas.slice(), janelas: (window as any).janelas.map((j: any) => j.fechada) }));
    assert.deepEqual(r.janelas, [true], 'a aba aberta no clique fecha');
    assert.equal(r.alertas.length, 1);
    assert.match(r.alertas[0], /WhatsApp válido/);

    // Aba barrada pelo navegador (window.open devolve null): o alerta traz o texto pronto e o link.
    await pagina.evaluate(() => {
      const w = window as any;
      w.alertas = [];
      window.open = (() => null) as any;
      w.respostaDecisao = () => ({ ok: true, decisao: 'aprovada', canal: 'wa_me', texto: 'Ana, consigo 1.384.000.', link: 'https://wa.me/5561999990001?text=Ana' });
      w.botao(document.querySelector('pc-negociacao-foco'), 'Fazer agora').click();
    });
    await esperar();
    r = await pagina.evaluate(() => (window as any).alertas.slice());
    assert.equal(r.length, 1);
    assert.match(r[0], /Ana, consigo 1\.384\.000\./);
    assert.match(r[0], /https:\/\/wa\.me\/5561999990001/);
  } finally {
    await navegador.close();
  }
});
