import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

// #187 (dívida do #207): os formulários das Negociações não perdem o digitado. Recusado, o formulário reabre
// com os mesmos valores e a frase do erro (`formularioQueSalva`), e nada com efeito externo se repete: o POST
// de proposta (sem chave de idempotência) confere a escada na falha ambígua (rede, 5xx) antes de deixar
// reenviar; a janela do Fazer agora abre por clique e só recebe o link depois de gravar; a confirmação abaixo
// do recuo (D-120) é pedida em cada envio, nunca pulada; a Nova proposta em vários passos não regrava o passo
// que já gravou. O diálogo responde pela fila `fila` ('MESMO' devolve o que ele mostrou: prova que o reenvio
// leva os valores reabertos). Sem Playwright, pula.

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
import { novaProposta, propostaDoContato } from './frontend/telas/negociacoes';
import { gesto } from './frontend/apoio';
window.novaProposta = novaProposta;
window.propostaDoContato = (c) => propostaDoContato(gesto(), c);
const MANDATO = { id: 3, negociacao_id: 1, versao: 1, preco_pedido_c: 145000000, alvo_c: 140000000, recuo_c: 136000000,
  batna_vendedor: 'Outra familia', concessoes: [], passo_max_pct: 0.4, rodadas_max: 4, validade: '2099-12-31', autonomia: 'pergunta_antes', autorizacao_proprietario: null };
const PROPOSTAS = [
  { id: 11, rodada: 1, direcao: 'vendedor', autor_tipo: 'corretor', valor_c: 145000000, canal: 'registro', estado: 'registrada', criado_em: '2026-10-27T12:00:00Z' },
  { id: 12, rodada: 2, direcao: 'comprador', autor_tipo: 'cliente', valor_c: 132000000, canal: 'registro', estado: 'registrada', criado_em: '2026-10-28T12:00:00Z' },
];
const DETALHE = { id: 1, contato_nome: 'Ana Ribeiro', imovel_id: 5, imovel_titulo: 'Casa', estado: 'ativa', conduzida_por: 'corretor', rodadas: 2,
  mandato: { rodadas_max: 4, validade: '2099-12-31' }, propostas: PROPOSTAS, objecoes: [], ultima_fala: null, sugestao: null };
window.PROPOSTAS = PROPOSTAS;
window.DETALHE = DETALHE;
window.chamadas = [];
window.corpos = [];
window.alertas = [];
window.avisos = [];
window.confirmacoes = [];
window.respostasConfirmar = [];
window.forms = [];
window.fila = [];
window.janelas = [];
window.papeis = ['corretor'];
window.erro = (status, codigo, mensagem, detalhes) => Object.assign(new Error(mensagem), { status, codigo, detalhes });
window.open = () => {
  const j = { fechada: false, location: { href: '' }, close() { this.fechada = true; } };
  window.janelas.push(j);
  return j;
};
window.urbiVerso = {
  subRota: () => location.pathname.replace(/^\\/portal_corretor/, '') || '/',
  href: (s) => '/portal_corretor' + s,
  navegarSub: () => {},
  usuario: () => ({ id: 1, nome: 'Marina' }),
  contexto: () => ({ nivel: 'usuario', roles: window.papeis, conta: { resolucao: 'escopado', contas: [{ id: 100, nome: 'A' }], contaEscrita: 100 } }),
  notificar: (m) => window.avisos.push(m),
  alertar: async (a) => { window.alertas.push(a.titulo + ' | ' + a.mensagem); },
  confirmar: async (c) => { window.confirmacoes.push(c.titulo); return window.respostasConfirmar.shift() ?? false; },
  formulario: async (f) => {
    window.forms.push(f);
    const r = window.fila.shift();
    return r === 'MESMO' ? Object.fromEntries(f.campos.map((c) => [c.nome, c.valor])) : (r ?? null);
  },
  api: async (rota, opcoes) => {
    const metodo = opcoes?.method ?? 'GET';
    const corpo = opcoes?.body ? JSON.parse(opcoes.body) : undefined;
    window.chamadas.push(metodo + ' ' + rota);
    if (corpo !== undefined) window.corpos.push({ rota: metodo + ' ' + rota, corpo });
    const [caminho] = rota.split('?');
    // A rota do teste responde primeiro (undefined: segue para as de sempre).
    const r = await window.rotas?.(metodo, caminho, corpo);
    if (r !== undefined) return r;
    if (caminho === '/conta') return { configuracoes: { dias_cliente_parado: 7 } };
    if (caminho === '/negociador/ia') return { disponivel: true };
    if (caminho === '/negociacoes') return { dados: [{ id: 1, contato_nome: 'Ana Ribeiro', estado: 'ativa', conduzida_por: 'corretor' }], total: 1 };
    if (caminho === '/negociacoes/1') return window.detalhe ?? DETALHE;
    if (caminho === '/negociacoes/1/mandato') return { vigente: MANDATO, versoes: [MANDATO] };
    if (caminho === '/negociacoes/1/propostas' && metodo === 'GET') return { dados: window.escada ?? PROPOSTAS };
    return {};
  },
};
// #acordo: a negociação com o acordo levado ao proprietário (a oferta do comprador aceita).
if (location.hash.includes('acordo')) window.detalhe = { ...DETALHE, estado: 'aguardando_proprietario', propostas: [PROPOSTAS[0], { ...PROPOSTAS[1], estado: 'aceita' }] };
const raiz = document.getElementById('raiz');
const desenhar = () => render(renderClientes(desenhar), raiz);
if (!location.hash.includes('solto')) desenhar();
`;

const PROFUNDO = `
window.profundo = (no) => {
  if (!no) return '';
  const partes = [];
  const andar = (n) => {
    if (n.nodeType === 3) partes.push(n.textContent);
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
window.clicar = (onde, texto) => window.todos(document.querySelector(onde), 'urbi-botao').find((b) => window.profundo(b).includes(texto)).click();
window.escolher = (onde, texto) => window.todos(document.querySelector(onde), 'urbi-dropdown-item').find((i) => window.profundo(i).includes(texto))
  .dispatchEvent(new CustomEvent('urbi:dropdown-select', { bubbles: true, composed: true }));
// Zera os registros entre os casos (a página segue a mesma).
window.zerar = () => {
  for (const k of ['chamadas', 'corpos', 'alertas', 'avisos', 'confirmacoes', 'forms', 'janelas']) window[k] = [];
  window.respostasConfirmar = [];
  window.fila = [];
  window.rotas = null;
  window.escada = null;
};
window.posts = (rota) => window.chamadas.filter((c) => c === 'POST ' + rota).length;
window.form = (i) => { const f = window.forms[i]; return f && { titulo: f.titulo, mensagem: f.mensagem ?? '', valores: Object.fromEntries(f.campos.map((c) => [c.nome, c.valor])), rotulos: Object.fromEntries(f.campos.map((c) => [c.nome, c.rotuloValor])) }; };
`;

async function montar(pw: any, hash = '') {
  const pacote = await build({ stdin: { contents: ENTRADA, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, write: false, format: 'iife', target: 'es2022', tsconfig: 'tsconfig.json', logLevel: 'silent' });
  const html = `<!doctype html><html><head><meta charset="utf-8"></head><body><div id="raiz"></div><script>${PROFUNDO}</script><script>${pacote.outputFiles[0].text}</script></body></html>`;
  const navegador = await pw.chromium.launch();
  const pagina = await navegador.newPage({ viewport: { width: 1440, height: 900 } });
  await pagina.route(`${ORIGEM}/**`, (r: any) => r.fulfill({ contentType: 'text/html', body: html }));
  await pagina.goto(`${ORIGEM}/portal_corretor/clientes?visao=negociacoes&item=1${hash}`);
  await pagina.waitForTimeout(150);
  return { navegador, pagina };
}

const CONTRA = { valor: '1.400.000', condicoes: 'à vista', validade_horas: '', mensagem: 'Ana, consigo 1,4.' };

test('Nova contraproposta (#187): reabre com o digitado; janela por clique e só com a proposta gravada; a falha ambígua que gravou não reenvia', async (t) => {
  const pw = playwright();
  if (!pw) return t.skip('Playwright não instalado neste ambiente');
  const { navegador, pagina } = await montar(pw);
  const esperar = () => pagina.waitForTimeout(200);
  try {
    // 1) Fazer agora, a rede cai antes de gravar (a escada relida não tem a proposta): a janela desta
    // tentativa fecha, o formulário reabre com os mesmos valores, e o reenvio grava e abre o link na janela nova.
    await pagina.evaluate((v: any) => {
      const w = window as any;
      w.zerar();
      let n = 0;
      w.rotas = (m: string, c: string) => {
        if (m !== 'POST' || c !== '/negociacoes/1/propostas') return undefined;
        if (n++ === 0) throw new TypeError('Failed to fetch');
        return { id: 50, link: 'https://wa.me/5561999990001?text=Ana', texto: 'Ana' };
      };
      w.fila = [{ ...v, canal: 'wa_me' }, 'MESMO'];
      w.clicar('pc-negociacao-foco', 'Nova contraproposta');
    }, CONTRA);
    await esperar();
    let r: any = await pagina.evaluate(() => {
      const w = window as any;
      return { posts: w.posts('/negociacoes/1/propostas'), n: w.forms.length, f: w.form(1), janelas: w.janelas.map((j: any) => [j.fechada, j.location.href]), alertas: w.alertas.slice(), corpos: w.corpos.map((c: any) => c.corpo) };
    });
    assert.equal(r.posts, 2, 'um envio por clique em Enviar');
    assert.equal(r.n, 2, 'reabriu uma vez');
    assert.deepEqual(r.f.valores, { ...CONTRA, canal: 'wa_me' }, 'com o que foi digitado');
    assert.match(r.f.mensagem, /a proposta pode ter sido registrada\. Cancele e confira a escada de propostas antes de enviar de novo\./, 'a releitura vazia não prova que não gravou');
    assert.deepEqual(r.janelas, [[true, ''], [false, 'https://wa.me/5561999990001?text=Ana']], 'a janela da falha fechou sem link; a do envio que gravou recebeu o link');
    assert.deepEqual(r.alertas, []);
    assert.deepEqual(r.corpos[0], r.corpos[1], 'o reenvio leva os mesmos dados');

    // 2) 502 depois de o servidor gravar: a escada relida tem a proposta nova; nada é reenviado, o formulário
    // não reabre, a janela fecha sem link e o corretor sabe que ela foi registrada.
    await pagina.evaluate((v: any) => {
      const w = window as any;
      w.zerar();
      w.rotas = (m: string, c: string) => {
        if (m !== 'POST' || c !== '/negociacoes/1/propostas') return undefined;
        w.escada = [...w.PROPOSTAS, { id: 77, direcao: 'vendedor', valor_c: 140000000, estado: 'enviada' }];
        throw Object.assign(new Error('Bad Gateway'), { status: 502 });
      };
      w.fila = [{ ...v, canal: 'wa_me' }, 'MESMO'];
      w.clicar('pc-negociacao-foco', 'Nova contraproposta');
    }, CONTRA);
    await esperar();
    r = await pagina.evaluate(() => {
      const w = window as any;
      return { posts: w.posts('/negociacoes/1/propostas'), n: w.forms.length, janelas: w.janelas.map((j: any) => [j.fechada, j.location.href]), alertas: w.alertas.slice() };
    });
    assert.equal(r.posts, 1, 'não reenviou');
    assert.equal(r.n, 1, 'não reabriu');
    assert.deepEqual(r.janelas, [[true, '']]);
    assert.equal(r.alertas.length, 1);
    assert.match(r.alertas[0], /^Contraproposta registrada \| A resposta demorou, mas a contraproposta de R\$\s?1\.400\.000,00 já está na escada/);

    // 3) Ambígua e a releitura também falha: a frase da dúvida, e o corretor decide (aqui, cancela).
    await pagina.evaluate((v: any) => {
      const w = window as any;
      w.zerar();
      w.rotas = (m: string, c: string) => {
        if (c !== '/negociacoes/1/propostas') return undefined;
        throw m === 'POST' ? Object.assign(new Error('x'), { status: 500 }) : new TypeError('Failed to fetch');
      };
      w.fila = [{ ...v, canal: 'portal' }, null];
      w.clicar('pc-negociacao-foco', 'Nova contraproposta');
    }, CONTRA);
    await esperar();
    r = await pagina.evaluate(() => ({ posts: (window as any).posts('/negociacoes/1/propostas'), f: (window as any).form(1) }));
    assert.equal(r.posts, 1);
    assert.match(r.f.mensagem, /a proposta pode ter sido registrada\. Cancele e confira a escada de propostas antes de enviar de novo\./);
    assert.equal(r.f.valores.valor, '1.400.000');
  } finally {
    await navegador.close();
  }
});

test('Nova contraproposta abaixo do recuo (#187, D-120): a confirmação é pedida em cada envio; recusada, nada sai e o formulário reabre; o negociador humano nunca confirma', async (t) => {
  const pw = playwright();
  if (!pw) return t.skip('Playwright não instalado neste ambiente');
  const { navegador, pagina } = await montar(pw);
  const esperar = () => pagina.waitForTimeout(200);
  // A rota da contraproposta: sem a marca, 422 só por ficar abaixo do recuo; com ela, grava.
  const abaixo = `
    window.rotas = (m, c, corpo) => {
      if (m !== 'POST' || c !== '/negociacoes/1/propostas') return undefined;
      if (!corpo.confirmar_abaixo_do_recuo) {
        throw window.erro(422, 'MOVIMENTO_BLOQUEADO', 'Esta contraproposta fica abaixo do ponto de recuo do mandato.', ['ABAIXO_DO_RECUO: valor abaixo do ponto de recuo']);
      }
      return { id: 51, estado: 'enviada' };
    };`;
  try {
    await pagina.evaluate((js: string) => {
      const w = window as any;
      w.zerar();
      new Function(js)();
      w.respostasConfirmar = [false, true];
      w.fila = [{ valor: '1.300.000', condicoes: '', validade_horas: '', mensagem: '', canal: 'portal' }, 'MESMO'];
      w.clicar('pc-negociacao-foco', 'Nova contraproposta');
    }, abaixo);
    await esperar();
    let r: any = await pagina.evaluate(() => {
      const w = window as any;
      return { corpos: w.corpos.filter((c: any) => c.rota === 'POST /negociacoes/1/propostas').map((c: any) => c.corpo.confirmar_abaixo_do_recuo ?? null), confirmacoes: w.confirmacoes.slice(), f: w.form(1), n: w.forms.length, avisos: w.avisos.slice() };
    });
    assert.deepEqual(r.confirmacoes, ['Abaixo do ponto de recuo', 'Abaixo do ponto de recuo'], 'pedida de novo no reenvio, nunca pulada');
    assert.deepEqual(r.corpos, [null, null, true], 'a marca só sai depois do "sim", uma vez');
    assert.equal(r.n, 2);
    assert.match(r.f.mensagem, /fica abaixo do ponto de recuo e não foi enviada/);
    assert.equal(r.f.valores.valor, '1.300.000');
    assert.deepEqual(r.avisos.filter((a: string) => /Contraproposta enviada/.test(a)), ['Contraproposta enviada pelo portal do cliente.']);

    // Negociador humano: sem confirmação; a recusa volta no formulário, e nada sai com a marca.
    await pagina.evaluate((js: string) => {
      const w = window as any;
      w.zerar();
      w.papeis = ['negociador'];
      new Function(js)();
      w.fila = [{ valor: '1.300.000', condicoes: '', validade_horas: '', mensagem: '', canal: 'portal' }, null];
      w.clicar('pc-negociacao-foco', 'Nova contraproposta');
    }, abaixo);
    await esperar();
    r = await pagina.evaluate(() => {
      const w = window as any;
      return { corpos: w.corpos.filter((c: any) => c.rota === 'POST /negociacoes/1/propostas').map((c: any) => c.corpo.confirmar_abaixo_do_recuo ?? null), confirmacoes: w.confirmacoes.slice(), f: w.form(1) };
    });
    assert.deepEqual(r.confirmacoes, []);
    assert.deepEqual(r.corpos, [null]);
    assert.match(r.f.mensagem, /ABAIXO_DO_RECUO|abaixo do ponto de recuo/);
  } finally {
    await navegador.close();
  }
});

test('Registrar oferta, Pedir sugestão, Encerrar e Atribuir (#187): reabrem com o digitado; a falha ambígua que gravou não reenvia', async (t) => {
  const pw = playwright();
  if (!pw) return t.skip('Playwright não instalado neste ambiente');
  const { navegador, pagina } = await montar(pw);
  const esperar = () => pagina.waitForTimeout(200);
  try {
    // Registrar oferta: 422 reabre; o reenvio cai na rede depois de gravar, e a escada relida o confirma.
    await pagina.evaluate(() => {
      const w = window as any;
      w.zerar();
      let n = 0;
      w.rotas = (m: string, c: string) => {
        if (m !== 'POST' || c !== '/negociacoes/1/propostas') return undefined;
        if (n++ === 0) throw w.erro(422, 'DADOS_INVALIDOS', 'Confira a proposta.', ['valor_c: informe o valor em centavos.']);
        w.escada = [...w.PROPOSTAS, { id: 88, direcao: 'comprador', valor_c: 133000000 }];
        throw new TypeError('Failed to fetch');
      };
      w.fila = [{ valor: '1.330.000', condicoes: 'financiado' }, 'MESMO'];
      w.clicar('pc-negociacao-foco', 'Registrar oferta do cliente');
    });
    await esperar();
    let r: any = await pagina.evaluate(() => {
      const w = window as any;
      return { posts: w.posts('/negociacoes/1/propostas'), n: w.forms.length, f: w.form(1), alertas: w.alertas.slice() };
    });
    assert.equal(r.posts, 2, 'o segundo envio gravou: nenhum terceiro');
    assert.equal(r.n, 2);
    assert.deepEqual(r.f.valores, { valor: '1.330.000', condicoes: 'financiado' });
    assert.match(r.f.mensagem, /valor_c: informe o valor em centavos\./);
    assert.deepEqual(r.alertas, []);

    // Pedir sugestão: a IA falhou (503 IA_INDISPONIVEL, nada gravado): reabre com o que foi colado; o
    // reenvio funciona. Depois, a rede cai com o pedido já feito (a negociação relida mudou): não reenvia.
    await pagina.evaluate(() => {
      const w = window as any;
      w.zerar();
      let n = 0;
      w.rotas = (m: string, c: string) => {
        if (m !== 'POST' || c !== '/negociacoes/1/sugestao') return undefined;
        if (n++ === 0) throw w.erro(503, 'IA_INDISPONIVEL', 'A IA não respondeu agora. Tente de novo em instantes; a negociação segue com você.');
        return { execucao_id: 12, passagem: false, enviada: null };
      };
      w.fila = [{ mensagem_cliente: 'Consigo 1,33 à vista' }, 'MESMO'];
      w.clicar('pc-negociacao-foco', 'Pedir sugestão');
    });
    await esperar();
    r = await pagina.evaluate(() => {
      const w = window as any;
      return { posts: w.posts('/negociacoes/1/sugestao'), f: w.form(1), n: w.forms.length };
    });
    assert.equal(r.posts, 2);
    assert.equal(r.n, 2);
    assert.equal(r.f.valores.mensagem_cliente, 'Consigo 1,33 à vista');
    assert.match(r.f.mensagem, /A IA não respondeu agora/);
    await pagina.evaluate(() => {
      const w = window as any;
      w.zerar();
      w.rotas = (m: string, c: string) => {
        if (m !== 'POST' || c !== '/negociacoes/1/sugestao') return undefined;
        // O servidor rodou o Negociador (a sugestão nova aparece na releitura) e a resposta se perdeu.
        w.detalhe = { ...w.DETALHE, estado: 'aguardando_corretor', sugestao: { execucao_id: 13, resposta: { contraproposta: null, mensagem: 'Oi' }, validacoes: [], bloqueado_por: null } };
        throw Object.assign(new Error('Gateway Timeout'), { status: 504 });
      };
      w.fila = [{ mensagem_cliente: 'E aí?' }, 'MESMO'];
      w.clicar('pc-negociacao-foco', 'Pedir sugestão');
    });
    await esperar();
    r = await pagina.evaluate(() => {
      const w = window as any;
      return { posts: w.posts('/negociacoes/1/sugestao'), n: w.forms.length, avisos: w.avisos.slice() };
    });
    assert.equal(r.posts, 1, 'não pediu de novo');
    assert.equal(r.n, 1, 'não reabriu');
    assert.ok(r.avisos.some((a: string) => /o pedido chegou ao Negociador/.test(a)));
    await pagina.evaluate(() => ((window as any).detalhe = null));

    // Encerrar como ganha: o valor que não é número volta no formulário (sem PATCH); o reenvio encerra uma vez.
    await pagina.evaluate(() => {
      const w = window as any;
      w.zerar();
      w.rotas = (m: string, c: string) => (m === 'PATCH' && c === '/negociacoes/1' ? { id: 1, estado: 'ganha', comissao_prevista_c: null } : undefined);
      w.fila = [{ valor: 'um milhão' }, { valor: '1.390.000' }];
      w.escolher('pc-negociacao-foco', 'Encerrar como ganha');
    });
    await esperar();
    r = await pagina.evaluate(() => {
      const w = window as any;
      return { patches: w.chamadas.filter((c: string) => c === 'PATCH /negociacoes/1').length, f: w.form(1), corpo: w.corpos.find((c: any) => c.rota === 'PATCH /negociacoes/1')?.corpo, avisos: w.avisos.slice() };
    });
    assert.equal(r.patches, 1);
    assert.equal(r.f.valores.valor, 'um milhão');
    assert.match(r.f.mensagem, /Digite o valor em reais/);
    assert.deepEqual(r.corpo, { estado: 'ganha', valor_final_c: 139000000 });
    assert.ok(r.avisos.includes('Negociação ganha.'));

    // Atribuir: 409 (sem o papel) reabre com a pessoa escolhida; Cancelar não envia mais.
    await pagina.evaluate(() => {
      const w = window as any;
      w.zerar();
      w.rotas = (m: string, c: string) => {
        if (c === '/negociador/negociadores') return { dados: [{ usuario_id: 9, email: 'neg@exemplo.com', tem_papel: true }] };
        if (m === 'POST' && c === '/negociador/atribuicoes') throw w.erro(409, 'NEGOCIADOR_SEM_PAPEL', 'Esta pessoa aceitou o convite, mas ainda não tem o papel negociador.');
        return undefined;
      };
      w.fila = [{ usuario_id: '9' }, null];
      w.clicar('pc-negociacao-contexto', 'Atribuir a um negociador');
    });
    await esperar();
    r = await pagina.evaluate(() => {
      const w = window as any;
      return { posts: w.posts('/negociador/atribuicoes'), f: w.form(1), n: w.forms.length };
    });
    assert.equal(r.posts, 1);
    assert.equal(r.n, 2);
    assert.equal(r.f.valores.usuario_id, '9');
    assert.match(r.f.mensagem, /ainda não tem o papel negociador/);
  } finally {
    await navegador.close();
  }
});

test('Contraproposta do proprietário (#187): o valor recusado volta no formulário e a decisão sai uma vez', async (t) => {
  const pw = playwright();
  if (!pw) return t.skip('Playwright não instalado neste ambiente');
  const { navegador, pagina } = await montar(pw, '#acordo');
  const esperar = () => pagina.waitForTimeout(200);
  try {
    await pagina.evaluate(() => {
      const w = window as any;
      w.zerar();
      let n = 0;
      w.rotas = (m: string, c: string) => {
        if (m !== 'PATCH' || c !== '/propostas/12') return undefined;
        if (n++ === 0) throw w.erro(422, 'DADOS_INVALIDOS', 'Informe o valor da contraproposta do proprietário.');
        return { ok: true, decisao: 'contraproposta' };
      };
      w.fila = [{ valor: '1.420.000', condicoes: 'entrega em 90 dias' }, 'MESMO'];
      w.clicar('pc-negociacao-contexto', 'Contraproposta do proprietário');
    });
    await esperar();
    const r: any = await pagina.evaluate(() => {
      const w = window as any;
      return { patches: w.chamadas.filter((c: string) => c === 'PATCH /propostas/12').length, n: w.forms.length, f: w.form(1), avisos: w.avisos.slice(), corpos: w.corpos.map((c: any) => c.corpo) };
    });
    assert.equal(r.patches, 2);
    assert.equal(r.n, 2);
    assert.deepEqual(r.f.valores, { valor: '1.420.000', condicoes: 'entrega em 90 dias' });
    assert.match(r.f.mensagem, /Informe o valor da contraproposta do proprietário\./);
    assert.deepEqual(r.corpos[1], { decisao: 'contraproposta', valor_c: 142000000, condicoes: 'entrega em 90 dias' });
    assert.ok(r.avisos.includes('Decisão do proprietário registrada.'));
  } finally {
    await navegador.close();
  }
});

test('Nova proposta e Proposta pela conversa (#187): o passo que já gravou (negócio, negociação) não se grava de novo ao reabrir', async (t) => {
  const pw = playwright();
  if (!pw) return t.skip('Playwright não instalado neste ambiente');
  const { navegador, pagina } = await montar(pw, '#solto');
  try {
    // Nova proposta, cliente sem negócio: o negócio e a negociação são criados; a oferta é recusada (422);
    // reaberto (com o cliente e o imóvel escolhidos), o reenvio só registra a oferta.
    let r: any = await pagina.evaluate(async () => {
      const w = window as any;
      w.zerar();
      let n = 0;
      w.rotas = (m: string, c: string) => {
        if (c === '/negociacoes' && m === 'GET') return { dados: [] };
        if (c === '/contatos/5') return { negocios: [] };
        if (c === '/negocios') return { id: 70 };
        if (c === '/negociacoes' && m === 'POST') return { id: 80, codigo: 'NEG-80' };
        if (c === '/negociacoes/80/propostas' && m === 'POST') {
          if (n++ === 0) throw w.erro(422, 'DADOS_INVALIDOS', 'Confira a proposta.', ['valor_c: informe o valor em centavos (até R$ 21.474.836,47).']);
          return { id: 90 };
        }
        return undefined;
      };
      w.fila = [{ contato_id: 5, imovel_id: 7, valor: '1.320.000', condicoes: '' }, 'MESMO'];
      const nid = await w.novaProposta({ id: 5, nome: 'Ana Ribeiro' });
      return { nid, negocios: w.posts('/negocios'), negociacoes: w.posts('/negociacoes'), ofertas: w.posts('/negociacoes/80/propostas'), f: w.form(1), avisos: w.avisos.slice(), alertas: w.alertas.slice() };
    });
    assert.equal(r.nid, 80);
    assert.deepEqual([r.negocios, r.negociacoes, r.ofertas], [1, 1, 2], 'o negócio e a negociação uma vez só');
    assert.equal(r.f.valores.contato_id, 5);
    assert.equal(r.f.rotulos.contato_id, 'Ana Ribeiro', 'o cliente reabre com o nome, não #5');
    assert.equal(r.f.valores.imovel_id, 7);
    assert.match(r.f.mensagem, /valor_c: informe o valor em centavos/);
    assert.deepEqual(r.avisos, ['Aberto um negócio novo do cliente para este imóvel.', 'Proposta registrada.']);
    assert.deepEqual(r.alertas, []);

    // A negociação cai na rede depois de o negócio gravar: o reenvio não cria outro negócio.
    r = await pagina.evaluate(async () => {
      const w = window as any;
      w.zerar();
      let n = 0;
      w.rotas = (m: string, c: string) => {
        if (c === '/negociacoes' && m === 'GET') return { dados: [] };
        if (c === '/contatos/5') return { negocios: [] };
        if (c === '/negocios') return { id: 71 };
        if (c === '/negociacoes' && m === 'POST') {
          if (n++ === 0) throw w.erro(409, 'CODIGO_REPETIDO', 'Não foi possível gerar o código agora. Tente de novo.');
          return { id: 81, codigo: 'NEG-81' };
        }
        if (c === '/negociacoes/81/propostas' && m === 'POST') return { id: 91 };
        return undefined;
      };
      w.fila = [{ contato_id: 5, imovel_id: 7, valor: '1.320.000', condicoes: '' }, 'MESMO'];
      const nid = await w.novaProposta({ id: 5, nome: 'Ana Ribeiro' });
      return { nid, negocios: w.posts('/negocios'), negociacoes: w.posts('/negociacoes'), corpos: w.corpos.filter((c: any) => c.rota === 'POST /negociacoes').map((c: any) => c.corpo) };
    });
    assert.equal(r.nid, 81);
    assert.equal(r.negocios, 1, 'o negócio da primeira tentativa é o do reenvio');
    assert.equal(r.negociacoes, 2);
    assert.deepEqual(r.corpos[1], { negocio_id: 71, imovel_id: 7 });

    // Proposta pela conversa: a negociação aberta na primeira tentativa é reaproveitada; a oferta, que
    // caiu na rede sem gravar (escada relida sem ela), é enviada de novo.
    r = await pagina.evaluate(async () => {
      const w = window as any;
      w.zerar();
      let n = 0;
      w.rotas = (m: string, c: string) => {
        if (c === '/negociacoes' && m === 'GET') return { dados: [] };
        if (c === '/contatos/5') return { negocios: [{ id: 60, etapa_tipo: 'aberta', pipeline: 'compra', imovel_id: 7, titulo: 'Compra', imovel_codigo: 'IM-7' }] };
        if (c === '/negociacoes' && m === 'POST') return { id: 82, codigo: 'NEG-82' };
        if (c === '/negociacoes/82/propostas' && m === 'GET') return { dados: [] };
        if (c === '/negociacoes/82/propostas' && m === 'POST') {
          if (n++ === 0) throw new TypeError('Failed to fetch');
          return { id: 92 };
        }
        return undefined;
      };
      w.fila = [{ escolha: 'negocio:60:7', valor: '1.300.000', condicoes: '' }, 'MESMO'];
      const nid = await w.propostaDoContato({ id: 5, nome: 'Ana Ribeiro' });
      return { nid, negociacoes: w.posts('/negociacoes'), ofertas: w.posts('/negociacoes/82/propostas'), f: w.form(1) };
    });
    assert.equal(r.nid, 82);
    assert.equal(r.negociacoes, 1, 'a negociação uma vez só');
    assert.equal(r.ofertas, 2, 'a oferta não tinha entrado: o reenvio é seguro');
    assert.deepEqual(r.f.valores, { escolha: 'negocio:60:7', valor: '1.300.000', condicoes: '' });
  } finally {
    await navegador.close();
  }
});

test('Falha PLATAFORMA_REINICIOU (#187): conta como ambígua em qualquer status; relê a escada e não reenvia a que entrou; sem achá-la, diz que pode ter entrado', async (t) => {
  const pw = playwright();
  if (!pw) return t.skip('Playwright não instalado neste ambiente');
  const { navegador, pagina } = await montar(pw);
  const esperar = () => pagina.waitForTimeout(200);
  try {
    // Registrar oferta: o restart derrubou a resposta (sem status), mas a escada relida tem a oferta.
    await pagina.evaluate(() => {
      const w = window as any;
      w.zerar();
      w.rotas = (m: string, c: string) => {
        if (m !== 'POST' || c !== '/negociacoes/1/propostas') return undefined;
        w.escada = [...w.PROPOSTAS, { id: 88, direcao: 'comprador', valor_c: 133000000 }];
        throw Object.assign(new Error('A plataforma reiniciou'), { codigo: 'PLATAFORMA_REINICIOU' });
      };
      w.fila = [{ valor: '1.330.000', condicoes: '' }, 'MESMO'];
      w.clicar('pc-negociacao-foco', 'Registrar oferta do cliente');
    });
    await esperar();
    let r: any = await pagina.evaluate(() => ({ posts: (window as any).posts('/negociacoes/1/propostas'), n: (window as any).forms.length }));
    assert.equal(r.posts, 1, 'não reenviou');
    assert.equal(r.n, 1, 'não reabriu');

    // Mesmo com status 4xx e a escada sem a oferta: o formulário reabre com a frase da dúvida.
    await pagina.evaluate(() => {
      const w = window as any;
      w.zerar();
      w.rotas = (m: string, c: string) => {
        if (m !== 'POST' || c !== '/negociacoes/1/propostas') return undefined;
        throw Object.assign(new Error('A plataforma reiniciou'), { codigo: 'PLATAFORMA_REINICIOU', status: 409 });
      };
      w.fila = [{ valor: '1.330.000', condicoes: '' }, null];
      w.clicar('pc-negociacao-foco', 'Registrar oferta do cliente');
    });
    await esperar();
    r = await pagina.evaluate(() => ({ posts: (window as any).posts('/negociacoes/1/propostas'), f: (window as any).form(1), alertas: (window as any).alertas.slice() }));
    assert.equal(r.posts, 1);
    assert.match(r.f.mensagem, /a proposta pode ter sido registrada\. Cancele e confira a escada de propostas antes de enviar de novo\./);
    assert.equal(r.f.valores.valor, '1.330.000');

    // Pedir sugestão: o pedido chegou (a negociação relida mudou) e o restart perdeu a resposta.
    await pagina.evaluate(() => {
      const w = window as any;
      w.zerar();
      w.rotas = (m: string, c: string) => {
        if (m !== 'POST' || c !== '/negociacoes/1/sugestao') return undefined;
        w.detalhe = { ...w.DETALHE, estado: 'aguardando_corretor', sugestao: { execucao_id: 14, resposta: { contraproposta: null, mensagem: 'Oi' }, validacoes: [], bloqueado_por: null } };
        throw Object.assign(new Error('A plataforma reiniciou'), { codigo: 'PLATAFORMA_REINICIOU' });
      };
      w.fila = [{ mensagem_cliente: 'E aí?' }, 'MESMO'];
      w.clicar('pc-negociacao-foco', 'Pedir sugestão');
    });
    await esperar();
    r = await pagina.evaluate(() => ({ posts: (window as any).posts('/negociacoes/1/sugestao'), n: (window as any).forms.length }));
    assert.equal(r.posts, 1, 'não pediu de novo');
    assert.equal(r.n, 1);
  } finally {
    await navegador.close();
  }
});
