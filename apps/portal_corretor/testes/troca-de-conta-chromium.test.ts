import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

// Troca de conta em CADA tela do menu (issue #144), no DOM de verdade (Chromium), com o app inteiro
// (`frontend/index.ts`) montado. O caso que o B6 resolveu só no Estúdio: o operador que atende UMA conta
// (contexto com `contaEscrita`, sem seletor e sem `X-Conta`) tem a conta trocada pelo shell. O app só sabe
// pelo `urbi:contexto-app`; a conta de trabalho entra na chave da tela (`sub|conta|visita`), a tela nasce
// de novo e o estado guardado fora do componente é relido. Também a troca pelo seletor (várias contas).
//
// Cada resposta do servidor simulado leva a marca da conta que a pediu (`CONTA 100`, `CONTA 200`), a
// conta resolvida no momento do pedido, como o shell faz. O critério: depois da troca, nenhum texto,
// atributo ou propriedade de elemento da página tem a marca da conta anterior, inclusive quando a resposta
// da conta anterior chega DEPOIS da troca (continuação assíncrona descartada). Sem Playwright, pula.

function playwright(): any {
  try {
    return createRequire(import.meta.url)('playwright');
  } catch {
    return null;
  }
}

const ORIGEM = 'https://app.exemplo';

const ENTRADA = `
let aoMudarRota = null;
window.chamadas = [];
window.pendentes = [];
// CONTA: a conta de trabalho no shell. VARIAS: o usuário atende 100 e 200 e escolhe no seletor; senão,
// uma conta só (contaEscrita), que o shell troca.
window.CONTA = 100;
const ctxConta = () => window.VARIAS
  ? { resolucao: 'escopado', contas: [{ id: 100, nome: 'A' }, { id: 200, nome: 'B' }] }
  : { resolucao: 'escopado', contas: [{ id: window.CONTA, nome: 'Conta ' + window.CONTA }], contaEscrita: window.CONTA };
const agora = new Date().toISOString();
const PECA = (c) => ({ id: c + 11, pedido: 'Pedido CONTA ' + c, imovel_id: c + 1, imovel_codigo: 'IM-' + c, objetivo: 'novo_imovel', titulo: 'Peça CONTA ' + c,
  legenda: 'Legenda CONTA ' + c, hashtags: '#x', motor: 'canva_ia', formato: 'post_1x1', estado: 'rascunho', arquivos: [], criado_em: agora });
const kpis = (leads) => ({
  leads, clientes_unicos: leads, etapas: { leads, atendimento: 5, visitou: 3, proposta: 2, ganhos: 1 },
  lead_atendimento: 0.8, lead_visita: 0.5, visita_proposta: 0.6, proposta_ganho: 0.5, conversao_total: 0.1,
  ganhos: 1, ciclo_medio_dias: 20, vgv_c: 100, captacoes: 0, visitas: 3, motivos_perda: [], por_origem: [],
});
const BLOCOS = (c) => [
  { tipo: 'apresentacao', ativo: true, titulo: 'Apresentação CONTA ' + c, texto: 'Texto CONTA ' + c },
  { tipo: 'imoveis', ativo: true, titulo: 'Imóveis' },
  { tipo: 'contato', ativo: true, whatsapp: true, instagram: null },
];
// Cada rota com dados da conta c. Id de uma conta não existe na outra (o RLS não devolve a linha).
function responder(caminho, c) {
  const M = 'CONTA ' + c;
  if (caminho === '/inicio') return {
    fila: [{ tipo: 'proximo_passo', contato_id: c + 1, contato_nome: 'Ana ' + M, temperatura: 'quente', quando: agora, texto: 'Ligar ' + M }],
    passagens: [], agenda_hoje: [{ id: c + 2, tipo: 'visita', titulo: 'Visita ' + M, quando: agora, contato_nome: 'Ana ' + M }],
    primeiros_passos: [], sem_creci: false, semana: null, demo_disponivel: false,
  };
  if (caminho === '/assistente/ia') return { assistente: true };
  if (caminho === '/assistente/perguntar') return { resposta: 'Resposta ' + M, artigos: [], acao: null, tela: null };
  if (caminho === '/negociacoes') return { dados: [{ id: c + 1, contato_nome: 'Ana ' + M, imovel_titulo: 'Casa ' + M, estado: 'ativa', conduzida_por: 'ia', ultima_oferta_c: 1, preco_pedido_c: 2 }], total: 1 };
  if (caminho === '/negociador/ia') return { disponivel: true };
  if (caminho === '/conta') return {
    perfil: { nome: 'Imobiliária ' + M, tipo: 'corretor_autonomo', documento: null, creci_juridico: null },
    configuracoes: { prazo_primeiro_atendimento_min: 30, dias_cliente_parado: 7, validade_selecao_dias: 15, lembrete_visita_horas: 2 },
    meu_perfil: { creci: null, telefone: '61999990000' },
  };
  if (caminho === '/contatos') return { dados: [{ id: c + 1, nome: 'Ana ' + M, telefone: null, email: null, papeis: 'comprador', temperatura: 'quente', origem_canal: 'pagina', proximo_passo: null, proximo_passo_em: null }], total: 1 };
  if (caminho === '/funil/quadro') return {
    etapas: [{ id: 1, nome: 'Novo', tipo: 'aberta' }],
    negocios: [{ id: c + 1, etapa_id: 1, contato_id: c + 1, contato_nome: 'Ana ' + M, titulo: 'Compra ' + M, temperatura: 'quente', abordagem_vencida: false }],
    passagem: [], funis: { compra: c + 7, venda_captacao: 0 }, temperaturas: { quente: c + 3, morno: 0, frio: 0 },
  };
  if (caminho === '/imoveis') return { dados: [{ id: c + 1, codigo: 'IM-' + c, titulo: 'Casa ' + M, tipo: 'casa', situacao: 'ativo', preco_c: 100, bairro: 'Bairro ' + M, cidade: 'Brasília', capa: null }], total: 1, paginas: 1 };
  if (caminho === '/empreendimentos') return { dados: [], total: 0 };
  if (caminho === '/imoveis/ia') return { fotos: true, conteudo: true };
  if (caminho === '/estudio/pecas') return { dados: [PECA(c)], total: 1, ia: true };
  if (caminho === '/estudio/marca') return { cor_primaria: '#123456', cor_secundaria: '#abcdef', estilo: 'moderno', assinatura: 'Assinatura ' + M, logo_url: null, foto_url: null, referencias: [], creci: null };
  if (caminho === '/conexoes') return { instagram: { usuario: M, ultimo_erro: null }, disponivel: true };
  if (caminho === '/pagina') return {
    pagina: { endereco: 'p' + c, nome_exibicao: 'Página ' + M, blocos: BLOCOS(c), publicada_em: null, gerada_por_ia: false },
    salva: true, url: 'https://corretor.exemplo/p?c=p' + c, marcados_para_pagina: 0, sem_creci: false, numeros: { contatos_30d: 0, visitas_30d: null },
  };
  if (caminho === '/pagina/previa') return { publicada: false, pagina: { endereco: 'p' + c, nome: 'Prévia ' + M, creci: null, telefone: null, cor: '#123456', foto_url: null, url_formulario: null, blocos: BLOCOS(c) }, imoveis: [] };
  if (caminho === '/numeros') return {
    dias: 30, origem: null, origens_disponiveis: [], periodo: { de: agora, ate: agora }, atual: kpis(6), anterior: kpis(4),
    previsao: { valor_c: 100, sem_dados: 0 }, serie_leads: { categorias: [], atual: [], anterior: [] },
    por_hora: { horas: Array(24).fill(0), fora: 0, inicio: 8, fim: 19 }, melhores_origens: [],
    o_que_melhorar: { texto: 'Melhorar ' + M, motivo: null, clientes: 0, perdido_desde: agora }, conteudo: { publicadas: 0, publicadas_anterior: 0 },
  };
  if (caminho === '/funil/etapas') return { etapas: [{ id: c + 1, pipeline: 'compra', nome: 'Etapa ' + M, tipo: 'aberta', ordem: 1, ativa: true }] };
  if (caminho === '/funil/playbook') return { abordagens: [], etapas_sem_abordagem: [] };
  if (caminho === '/negociador/config') return { ligado: true, conduz_padrao: 'ia', gatilhos: { etapa_proposta: true, pedido_desconto: true, reacao_preco: false, oferta_registrada: true }, estilo: 'cooperativo', instrucoes_corretor: 'Instrução ' + M, versao: 0 };
  if (caminho === '/negociador/objecoes') return { dados: [] };
  if (caminho === '/negociador/numeros') return { desde: '2026-10-01', rodadas: 0, decididas: 0, aprovadas_sem_edicao: 0 };
  if (caminho === '/negociador/convites' || caminho === '/negociador/negociadores') return { dados: [] };
  if (caminho === '/equipe/convites') return { convites: [], total: 0 };
  return {};
}
window.urbiVerso = {
  subRota: () => location.pathname.replace(/^\\/portal_corretor/, '') || '/',
  href: (s) => '/portal_corretor' + s,
  escutarRota: (cb) => ((aoMudarRota = cb), () => (aoMudarRota = null)),
  navegarSub: (s) => { history.pushState(null, '', '/portal_corretor' + s); aoMudarRota?.(s.split('?')[0]); },
  usuario: () => ({ id: 1, nome: 'Marina' }),
  contexto: () => ({ carregado: true, nivel: 'usuario', roles: ['corretor', 'operacao'], conta: ctxConta() }),
  notificar: (m) => (window.avisos ??= []).push(m),
  alertar: async (a) => { (window.alertas ??= []).push(a.titulo); },
  confirmar: async () => true,
  formulario: async () => null,
  api: async (rota, opcoes) => {
    const [caminho] = rota.split('?');
    // A conta do pedido: o X-Conta (várias contas) ou a conta que o shell resolve agora (uma conta só).
    const conta = Number(new Headers(opcoes?.headers).get('X-Conta')) || window.CONTA;
    window.chamadas.push((opcoes?.method ?? 'GET') + ' ' + rota + ' @' + conta);
    const dados = responder(caminho, conta);
    // SEGURAR: toda resposta da conta 100 fica em voo até o teste liberar (depois da troca).
    if (window.SEGURAR && conta === 100) return new Promise((r) => window.pendentes.push(() => r(dados)));
    return dados;
  },
  fetch: async () => new Response('{}'),
};
import './frontend/index';
import { Estudio } from './frontend/telas/estudio';
Estudio.aoNascer = (e) => (window.estudio = e);
const app = document.createElement('app-portal-corretor');
document.getElementById('raiz').append(app);
window.app = app;
// O shell trocou a conta (operador de conta única) ou o usuário escolheu no seletor (várias contas).
window.trocarConta = (c) => {
  window.CONTA = c;
  if (window.VARIAS) {
    const sel = app.shadowRoot.querySelector('urbi-select[label="Conta"]');
    sel.dispatchEvent(new CustomEvent('urbi:select-change', { detail: { valor: String(c) } }));
  } else {
    window.dispatchEvent(new CustomEvent('urbi:contexto-app', { detail: { ...window.urbiVerso.contexto(), appId: 'portal_corretor' } }));
  }
};
// Primeiro elemento do seletor em qualquer profundidade (atravessa shadow roots).
window.achar = (sel, n = app.shadowRoot) => n.querySelector(sel) ?? [...n.querySelectorAll('*')].map((e) => e.shadowRoot && window.achar(sel, e.shadowRoot)).find(Boolean) ?? null;
window.liberar = () => window.pendentes.splice(0).forEach((f) => f());
// Tudo o que a página mostra ou entrega aos primitivos: texto, atributos e as propriedades próprias dos
// elementos (as listas, opções e itens que o lit liga por \`.prop=\`), atravessando shadow roots.
window.tudo = () => {
  const partes = [];
  const andar = (n) => {
    if (n.nodeType === 3) partes.push(n.textContent);
    if (n.nodeType === 1) {
      for (const a of n.attributes) partes.push(a.value);
      for (const k of Object.keys(n)) {
        if (k.startsWith('__')) continue;
        try { partes.push(JSON.stringify(n[k], (_c, v) => (typeof v === 'function' || v instanceof Node ? undefined : v))); } catch {}
      }
    }
    if (n.shadowRoot) andar(n.shadowRoot);
    for (const f of n.childNodes) andar(f);
  };
  andar(app);
  return partes.join(' ');
};
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
  const html = `<!doctype html><html><head><meta charset="utf-8"></head><body><div id="raiz"></div><script>${pacote.outputFiles[0].text}</script></body></html>`;
  const navegador = await pw.chromium.launch();
  const pagina = await navegador.newPage({ viewport: { width: 1440, height: 900 } });
  const erros: string[] = [];
  pagina.on('pageerror', (e: Error) => erros.push(e.message));
  // Rejeição sem tratamento também chega como erro de console: nenhuma pode sobrar (nem a de ContaTrocada).
  pagina.on('console', (m: any) => m.type() === 'error' && /Uncaught/.test(m.text()) && erros.push(m.text()));
  await pagina.route(`${ORIGEM}/**`, (r: any) => r.fulfill({ contentType: 'text/html', body: html }));
  return { navegador, pagina, erros };
}

// As telas do menu (trilho do corretor e a da equipe), cada uma com o endereço e, quando a tela mostra
// dado da conta, a marca que tem de aparecer (para o teste não passar no vazio).
const TELAS: { nome: string; endereco: string; mostra: boolean }[] = [
  { nome: 'Hoje', endereco: '/', mostra: true },
  { nome: 'Hoje › Agenda', endereco: '/agenda', mostra: false },
  { nome: 'Negociações', endereco: '/negociacoes', mostra: true },
  { nome: 'Clientes (Lista)', endereco: '/clientes', mostra: true },
  { nome: 'Clientes (Funil)', endereco: '/clientes?visao=quadro', mostra: true },
  { nome: 'Importar contatos', endereco: '/clientes/importar', mostra: false },
  { nome: 'Imóveis', endereco: '/imoveis', mostra: true },
  { nome: 'Novo imóvel', endereco: '/imoveis/novo', mostra: false },
  { nome: 'Estúdio', endereco: '/estudio', mostra: true },
  { nome: 'Página', endereco: '/pagina', mostra: true },
  { nome: 'Números', endereco: '/numeros', mostra: true },
  { nome: 'Ajustes › Conta', endereco: '/ajustes', mostra: true },
  { nome: 'Ajustes › Marca', endereco: '/ajustes/marca', mostra: true },
  { nome: 'Ajustes › Conexões', endereco: '/ajustes/conexoes', mostra: true },
  { nome: 'Ajustes › Funil', endereco: '/ajustes/funil', mostra: true },
  { nome: 'Ajustes › Atendimento', endereco: '/ajustes/atendimento', mostra: false },
  { nome: 'Ajustes › Negociador', endereco: '/ajustes/negociador', mostra: true },
  { nome: 'Ajustes › Privacidade', endereco: '/ajustes/privacidade', mostra: false },
  { nome: 'Corretores (equipe)', endereco: '/corretores', mostra: false },
];

const esperar = (p: any, ms = 150) => p.waitForTimeout(ms);
const tudo = (p: any): Promise<string> => p.evaluate(() => (window as any).tudo());
// A instância da tela: o primeiro filho do `urbi-shell-page` que não é ação nem o seletor de conta.
const instancia = (p: any) =>
  p.evaluate(() => {
    const w = window as any;
    const pagina = w.app.shadowRoot.querySelector('urbi-shell-page');
    const el = [...pagina.children].find((e: any) => !['urbi-select', 'urbi-menu', 'urbi-botao'].includes(e.localName) && !e.hasAttribute?.('slot'));
    w.marcadas ??= new WeakSet();
    const nova = el ? !w.marcadas.has(el) : null;
    if (el) w.marcadas.add(el);
    return nova;
  });

for (const modo of ['conta única trocada pelo shell', 'várias contas, troca pelo seletor'] as const) {
  test(`troca de conta (${modo}): nenhuma tela do menu mostra dado da conta anterior`, async (t) => {
    const pw = playwright();
    if (!pw) return t.skip('Playwright não instalado neste ambiente');
    for (const tela of TELAS) {
      const { navegador, pagina, erros } = await montar(pw);
      try {
        if (modo.startsWith('várias')) await pagina.addInitScript(() => ((window as any).VARIAS = true));
        await pagina.goto(`${ORIGEM}/portal_corretor${tela.endereco}`);
        await esperar(pagina);
        const antes = await tudo(pagina);
        if (tela.mostra) assert.match(antes, /CONTA 100/, `${tela.nome}: a tela mostra dado da conta A antes da troca`);
        assert.doesNotMatch(antes, /CONTA 200/, `${tela.nome}: nada da conta B antes da troca`);
        assert.equal(await instancia(pagina), true);
        await pagina.evaluate(() => (window as any).trocarConta(200));
        await esperar(pagina);
        const depois = await tudo(pagina);
        assert.doesNotMatch(depois, /CONTA 100/, `${tela.nome}: nada da conta A depois da troca`);
        if (tela.mostra) assert.match(depois, /CONTA 200/, `${tela.nome}: a tela mostra a conta B`);
        assert.equal(await instancia(pagina), true, `${tela.nome}: a troca de conta recria a tela (instância nova)`);
        assert.deepEqual(erros, [], `${tela.nome}: nenhum erro na página`);
      } finally {
        await navegador.close();
      }
    }
  });
}

for (const modo of ['conta única trocada pelo shell', 'várias contas, troca pelo seletor'] as const) {
test(`troca de conta (${modo}) com as respostas da conta anterior em voo: chegam depois e são descartadas, em cada tela`, async (t) => {
  const pw = playwright();
  if (!pw) return t.skip('Playwright não instalado neste ambiente');
  for (const tela of TELAS) {
    const { navegador, pagina, erros } = await montar(pw);
    try {
      if (modo.startsWith('várias')) await pagina.addInitScript(() => ((window as any).VARIAS = true));
      await pagina.addInitScript(() => ((window as any).SEGURAR = true));
      await pagina.goto(`${ORIGEM}/portal_corretor${tela.endereco}`);
      await esperar(pagina, 80);
      // A conta muda com as cargas de A em voo; B carrega; só então A responde.
      await pagina.evaluate(() => (window as any).trocarConta(200));
      await esperar(pagina);
      await pagina.evaluate(() => (window as any).liberar());
      await esperar(pagina);
      const depois = await tudo(pagina);
      assert.doesNotMatch(depois, /CONTA 100/, `${tela.nome}: a resposta tardia da conta A não aparece`);
      if (tela.mostra) assert.match(depois, /CONTA 200/, `${tela.nome}: a tela mostra a conta B`);
      assert.deepEqual(erros, [], `${tela.nome}: nenhum erro na página (nem rejeição sem tratamento)`);
    } finally {
      await navegador.close();
    }
  }
});
}

test('Assistente: a conversa é da conta; trocar de conta (com a pergunta em voo) recomeça vazia', async (t) => {
  const pw = playwright();
  if (!pw) return t.skip('Playwright não instalado neste ambiente');
  const { navegador, pagina, erros } = await montar(pw);
  try {
    await pagina.goto(`${ORIGEM}/portal_corretor/assistente`);
    await esperar(pagina);
    // Uma pergunta respondida na conta A.
    await pagina.evaluate(() => (window as any).achar('urbi-chat').aoEnviar({ texto: 'Pergunta da conta A' }));
    await esperar(pagina);
    assert.match(await tudo(pagina), /Resposta CONTA 100/, 'a resposta de A aparece em A');
    // Outra pergunta fica em voo; a conta muda; a resposta de A chega depois.
    await pagina.evaluate(() => {
      (window as any).SEGURAR = true;
      void (window as any).achar('urbi-chat').aoEnviar({ texto: 'Outra da conta A' });
    });
    await esperar(pagina, 50);
    await pagina.evaluate(() => (window as any).trocarConta(200));
    await esperar(pagina);
    await pagina.evaluate(() => (window as any).liberar());
    await esperar(pagina);
    const depois = await tudo(pagina);
    assert.doesNotMatch(depois, /CONTA 100|Pergunta da conta A|Outra da conta A/, 'nada da conversa de A em B');
    assert.equal(await pagina.evaluate(() => (window as any).achar('urbi-chat').itens.length), 0, 'a conversa recomeça vazia');
    assert.deepEqual(erros, []);
  } finally {
    await navegador.close();
  }
});

test('Novo imóvel: o rascunho digitado na conta A não segue para a conta B', async (t) => {
  const pw = playwright();
  if (!pw) return t.skip('Playwright não instalado neste ambiente');
  const { navegador, pagina, erros } = await montar(pw);
  try {
    await pagina.goto(`${ORIGEM}/portal_corretor/imoveis/novo`);
    await esperar(pagina);
    await pagina.evaluate(() =>
      (window as any).achar('pc-novo-imovel-passo urbi-input[label="Cidade"], urbi-input[label="Cidade"]')
        .dispatchEvent(new CustomEvent('urbi:input-change', { detail: { valor: 'Cidade CONTA 100' } })),
    );
    await esperar(pagina);
    assert.match(await tudo(pagina), /Cidade CONTA 100/, 'o rascunho está na tela de A');
    await pagina.evaluate(() => (window as any).trocarConta(200));
    await esperar(pagina);
    assert.doesNotMatch(await tudo(pagina), /CONTA 100/, 'B começa um Novo imóvel vazio');
    assert.deepEqual(erros, []);
  } finally {
    await navegador.close();
  }
});
