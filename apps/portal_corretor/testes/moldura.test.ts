import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { nothing } from 'lit';
import { ENDERECOS, resolverEndereco, contatoDoEndereco } from '../frontend/enderecos';
import { ESTADOS, estadoDaFalha, estadoTela, type EstadoTela } from '../frontend/estados';
import { comAssistente, itensDoTrilho, moldura } from '../frontend/moldura';
import { destinoDeCriar, OPCOES_CRIAR } from '../frontend/criar';
import { abrirAssistente, abrirAssistenteSobre, assistenteAberto, fecharAssistente, lembrarContato, lembrarTela } from '../frontend/telas/assistente';
import { itemDaUrl, itemNaUrl, pedidoDeCriar } from '../frontend/visual';

// Moldura do Padrão B (item B1): os 7 estados, os apelidos, o Assistente na coluna de contexto, o
// `?item=` e a estrutura de primitivos. Sem navegador: o template do lit é achatado em texto, com os
// valores no lugar (o teste no Chromium, `moldura-chromium.test.ts`, confere o DOM de verdade).

/** Achata um TemplateResult (e o que vier dentro) em HTML, com cada valor no lugar do marcador. */
function texto(v: unknown): string {
  if (v === nothing || v === null || v === undefined || v === false) return '';
  if (Array.isArray(v)) return v.map(texto).join('');
  const t = v as { strings?: readonly string[]; values?: unknown[] };
  if (t && t.strings && t.values) {
    // Valor de atributo (`nome=${v}`) sai entre aspas, como no HTML escrito à mão.
    return t.strings.reduce((acc, s, i) => {
      if (i >= t.values!.length) return acc + s;
      const v = texto(t.values![i]);
      return acc + s + (/[\w-]=$/.test(s) ? `"${v}"` : v);
    }, '');
  }
  if (typeof v === 'function') return '';
  if (typeof v === 'object') return '[objeto]';
  return String(v);
}

// Navegador mínimo: a URL da app é `/portal_corretor/<sub>`; `navegarSub` empilha, `replaceState` troca.
function navegador(endereco: string) {
  const url = new URL(endereco, 'https://instancia.exemplo');
  const navegou: string[] = [];
  const chamadas: string[] = [];
  const g = globalThis as Record<string, unknown>;
  g.window = { location: url };
  g.history = {
    state: null,
    replaceState(_e: unknown, _t: string, nova: string) {
      const n = new URL(nova, url);
      url.pathname = n.pathname;
      url.search = n.search;
    },
  };
  g.localStorage = undefined;
  g.urbiVerso = {
    subRota: () => url.pathname.replace(/^\/portal_corretor/, '') || '/',
    href: (sub: string) => `/portal_corretor${sub.startsWith('/') ? sub : `/${sub}`}`,
    navegarSub: (sub: string) => navegou.push(sub),
    usuario: () => ({ id: 1, nome: 'Marina' }),
    contexto: () => ({ contaEscrita: 100 }),
    api: async (rota: string) => (chamadas.push(rota), rota === '/assistente/ia' ? { assistente: false } : {}),
  };
  return { url, navegou, chamadas };
}

/** O `urbi-chat` é filho direto do painel: nenhum `urbi-hospedeiro` aberto à sua volta. */
function chatSolto(h: string) {
  const i = h.indexOf('<urbi-chat');
  assert.ok(i >= 0, 'o chat está na página');
  assert.ok(h.lastIndexOf('<urbi-hospedeiro', i) < h.lastIndexOf('</urbi-hospedeiro>', i), 'sem hospedeiro em volta do chat');
  assert.match(h.slice(i), /^<urbi-chat\s+slot="direita"\s+expandir/);
}

const MARCAS: Record<EstadoTela, RegExp[]> = {
  carregando: [/<urbi-loading/],
  vazio: [/<urbi-estado-vazio/, /Nenhum imóvel ainda/, /<urbi-botao[^>]*>Cadastrar o primeiro imóvel/],
  erro: [/<urbi-banner variante="erro"/, /Tentar de novo/],
  sem_permissao: [/<urbi-estado-vazio/, /mensagem="Não encontrado"/],
  desconectada: [/<urbi-banner variante="alerta"/, /Seu Instagram desconectou\./, />Reconectar</],
  sem_credito: [/<urbi-banner variante="alerta"/, /Créditos do mês acabaram\. O Mensageiro e o Negociador passaram a pedir sua aprovação\./],
  ia_indisponivel: [/<urbi-banner variante="info"/, /IA indisponível agora/],
};

test('os 7 estados obrigatórios (11.0.4) saem dos primitivos, cada um com a frase da spec', () => {
  navegador('/portal_corretor/numeros');
  assert.deepEqual([...ESTADOS], Object.keys(MARCAS));
  for (const tipo of ESTADOS) {
    const op = tipo === 'vazio' ? { mensagem: 'Nenhum imóvel ainda', acao: { rotulo: 'Cadastrar o primeiro imóvel', aoEscolher: () => {} } } : { aoTentar: () => {} };
    const h = texto(estadoTela(tipo, op));
    for (const marca of MARCAS[tipo]) assert.match(h, marca, `${tipo}: ${marca}`);
    assert.doesNotMatch(h, /style=|<style/, `${tipo}: sem CSS na tela`);
  }
  // Falha de carga: 404 e 403 são "Não encontrado" (D-40); o resto é erro com tentar de novo, sem o texto técnico.
  const erroConsole = console.error;
  console.error = () => {};
  try {
    assert.match(texto(estadoDaFalha({ status: 404 }, () => {})), /Não encontrado/);
    assert.match(texto(estadoDaFalha({ status: 403 }, () => {})), /Não encontrado/);
    const h = texto(estadoDaFalha(Object.assign(new Error('relation contatos does not exist'), { status: 500 }), () => {}));
    assert.match(h, /Tentar de novo/);
    assert.doesNotMatch(h, /relation/);
  } finally {
    console.error = erroConsole;
  }
});

test('cada endereço antigo abre a tela nova certa (spec 11.0.5, D-103)', () => {
  const esperado: Record<string, string> = {
    '/': 'hoje',
    '/agenda': 'hoje',
    '/assistente': 'hoje',
    '/desempenho': 'numeros',
    '/numeros': 'numeros',
    '/funil': 'clientes',
    '/conta': 'ajustes',
    '/empreendimentos': 'imoveis',
    '/pagina': 'pagina',
    '/ajustes/conexoes': 'ajustes',
  };
  for (const [sub, chave] of Object.entries(esperado)) assert.equal(resolverEndereco(sub).chave, chave, sub);
  assert.equal(resolverEndereco('/desempenho/').chave, 'numeros', 'barra no fim');
  assert.deepEqual(resolverEndereco('/clientes/12'), { chave: 'cliente', param: '12' });
  assert.deepEqual(resolverEndereco('/qualquer'), {});
  // Todo endereço da tabela abre uma tela.
  for (const sub of Object.keys(ENDERECOS)) assert.ok(resolverEndereco(sub).chave, sub);
  assert.equal(contatoDoEndereco('/clientes/7'), 7);
  assert.equal(contatoDoEndereco('/clientes'), null);
});

test('estrutura da moldura: inbox com trilho, três colunas com respiro, nada de CSS próprio', () => {
  navegador('/portal_corretor/numeros');
  fecharAssistente();
  const h = texto(moldura({ menu: '/numeros', lista: 'LISTA', centro: 'CENTRO', contexto: 'CONTEXTO' }, () => {}));
  const ordem = [
    /<urbi-inbox largura-sidebar="0px" largura-min-sidebar="0px" sem-redimensionar texto-voltar="Menu"/,
    /<urbi-trilho-atalhos slot="sidebar-trilho"/,
    /<urbi-3-colunas slot="detalhe" redimensionavel colapsavel-esquerda colapsavel-direita/,
    /<urbi-hospedeiro slot="esquerda" expandir>LISTA<\/urbi-hospedeiro>/,
    /<urbi-hospedeiro slot="centro" expandir>CENTRO<\/urbi-hospedeiro>/,
    /<urbi-hospedeiro slot="direita" expandir>CONTEXTO<\/urbi-hospedeiro>/,
    /<\/urbi-3-colunas>/,
    /<\/urbi-inbox>/,
  ];
  let desde = 0;
  for (const r of ordem) {
    const m = h.slice(desde).match(r);
    assert.ok(m, `fora de ordem ou ausente: ${r}`);
    desde += m!.index! + m![0].length;
  }
  // Sem lista: só foco e contexto, no `urbi-2x1`.
  const dois = texto(moldura({ menu: '/', centro: 'CENTRO', contexto: 'CONTEXTO' }, () => {}));
  assert.match(dois, /<urbi-2x1 slot="detalhe">\s*<urbi-hospedeiro slot="esquerda" expandir>CENTRO<\/urbi-hospedeiro>\s*<urbi-hospedeiro slot="direita" expandir>CONTEXTO/);
  assert.doesNotMatch(dois, /urbi-3-colunas/);
  // Nenhum CSS estrutural nos arquivos da moldura (spec 11.0.1: as larguras são as do primitivo).
  for (const arq of ['frontend/moldura.ts', 'frontend/estados.ts', 'frontend/criar.ts', 'frontend/enderecos.ts']) {
    const fonte = readFileSync(resolve(process.cwd(), arq), 'utf8');
    assert.doesNotMatch(fonte, /\bcss`|style=|<style|static styles/, arq);
  }
  // Trilho: o menu do Padrão B na ordem de 11.0.1 e o Assistente no pé, com o item da tela ativo.
  const itens = itensDoTrilho('/numeros');
  assert.deepEqual(itens.map((i) => i.rotulo), ['Hoje', 'Clientes', 'Imóveis', 'Estúdio', 'Página', 'Números', 'Ajustes', 'Assistente']);
  assert.deepEqual(itens.filter((i) => i.ativo).map((i) => i.id), ['/numeros']);
});

test('o Assistente abre e fecha na coluna de contexto e leva o contato em foco (D-109)', async () => {
  const { chamadas } = navegador('/portal_corretor/clientes/7');
  fecharAssistente();
  lembrarTela('/clientes/7');
  lembrarContato({ id: 7, nome: 'Ana Souza' });
  const op = { menu: '/clientes', lista: 'LISTA', centro: 'CENTRO', contexto: 'CONTEXTO' };
  assert.match(texto(moldura(op, () => {})), /slot="direita" expandir>CONTEXTO/);

  // O botão do trilho abre: o painel toma o lugar do contexto; esquerda e centro ficam.
  abrirAssistente();
  assert.equal(assistenteAberto(), true);
  await new Promise((r) => setTimeout(r, 0));
  assert.ok(chamadas.includes('/assistente/ia'), 'sonda o slot ao abrir');
  let h = texto(moldura(op, () => {}));
  assert.match(h, /slot="esquerda" expandir>LISTA/);
  assert.match(h, /slot="centro" expandir>CENTRO/);
  assert.doesNotMatch(h, /CONTEXTO/);
  // Topo (título, Fechar, aviso, contato) num hospedeiro de altura natural; o chat solto no slot `direita`.
  assert.match(h, /<urbi-hospedeiro slot="direita">[\s\S]*Assistente[\s\S]*Fechar[\s\S]*Sobre: Ana Souza[\s\S]*<\/urbi-hospedeiro>\s*<urbi-chat/);
  chatSolto(h);
  assert.match(h, /Sobre: Ana Souza/, 'leva o contato da ficha aberta');
  assert.match(h, /IA indisponível agora/, 'slot desligado: o Assistente avisa e segue pela ajuda');
  assert.match(h, /painel-ativo="direita"/, 'no celular, a aba do Assistente');
  assert.deepEqual(itensDoTrilho('/clientes').filter((i) => i.ativo).map((i) => i.id), ['assistente']);

  // Fechar devolve o contexto da tela.
  fecharAssistente();
  h = texto(moldura(op, () => {}));
  assert.match(h, /slot="direita" expandir>CONTEXTO/);
  assert.doesNotMatch(h, /<urbi-chat/);

  // Tela fora da moldura: aberto, divide a página com ela; fechado, a tela segue igual.
  assert.equal(comAssistente('TELA'), 'TELA');
  abrirAssistenteSobre({ id: 9, nome: 'Bruno' });
  const solta = texto(comAssistente('TELA'));
  assert.match(solta, /<urbi-2x1><urbi-hospedeiro slot="esquerda" expandir>TELA<\/urbi-hospedeiro><urbi-hospedeiro slot="direita-topo">[\s\S]*Sobre: Bruno[\s\S]*<\/urbi-hospedeiro>\s*<urbi-chat/);
  chatSolto(solta);
  // `urbi-2x1` da moldura (sem lista): o mesmo desenho, topo na zona fixa e chat solto em `direita`.
  const dois = texto(moldura({ menu: '/', centro: 'CENTRO', contexto: 'CONTEXTO' }, () => {}));
  assert.match(dois, /<urbi-2x1 slot="detalhe">[\s\S]*<urbi-hospedeiro slot="direita-topo">[\s\S]*Sobre: Bruno/);
  chatSolto(dois);
  fecharAssistente();
});

test('cada abertura do Assistente sonda de novo e a resposta antiga não vence a nova', async () => {
  const { chamadas } = navegador('/portal_corretor/numeros');
  const g = globalThis as unknown as { urbiVerso: { api: (r: string) => Promise<unknown> } };
  const pendentes: ((v: unknown) => void)[] = [];
  g.urbiVerso.api = (rota) => (chamadas.push(rota), new Promise((ok) => pendentes.push(ok)));
  const op = { menu: '/numeros', centro: 'CENTRO', contexto: 'CONTEXTO' };
  fecharAssistente();
  abrirAssistente();
  fecharAssistente();
  abrirAssistente();
  assert.equal(chamadas.filter((c) => c === '/assistente/ia').length, 2, 'uma sonda por abertura');
  // A segunda diz que o slot está livre; a primeira, atrasada, diz que não: não sobrescreve.
  pendentes[1]({ assistente: true });
  await new Promise((r) => setTimeout(r, 0));
  pendentes[0]({ assistente: false });
  await new Promise((r) => setTimeout(r, 0));
  assert.doesNotMatch(texto(moldura(op, () => {})), /IA indisponível/);
  // Falha passageira da última sonda avisa; a abertura seguinte sonda de novo e limpa o aviso.
  fecharAssistente();
  abrirAssistente();
  fecharAssistente();
  abrirAssistente();
  assert.equal(chamadas.filter((c) => c === '/assistente/ia').length, 4);
  pendentes[3]({ assistente: true });
  await new Promise((r) => setTimeout(r, 0));
  assert.doesNotMatch(texto(moldura(op, () => {})), /IA indisponível/);
  fecharAssistente();
});

test('no celular, trocar de tela por fora do trilho devolve as colunas', () => {
  navegador('/portal_corretor/numeros');
  fecharAssistente();
  let atualizacoes = 0;
  const voltar = (h: unknown) => {
    const m = (h as { values: unknown[] }).values.find((v) => typeof v === 'function' && (v as () => void).length === 0);
    assert.ok(m, 'o Voltar do inbox está ligado');
    (m as () => void)();
  };
  const op = (menu: string) => ({ menu, centro: 'CENTRO', contexto: 'CONTEXTO' });
  // O primeiro valor do template da moldura é o `?detalhe-visivel`.
  const visivel = (h: unknown) => (h as { values: unknown[] }).values[0];
  const a = moldura(op('/numeros'), () => atualizacoes++);
  assert.equal(visivel(a), true, 'colunas à vista');
  voltar(a); // o Voltar mostra o trilho
  assert.equal(visivel(moldura(op('/numeros'), () => {})), false, 'mesma tela: segue no trilho');
  assert.equal(visivel(moldura(op('/clientes'), () => {})), true, 'outra tela: volta às colunas');
  assert.equal(atualizacoes, 1);
});

test('`?item=` guarda o item selecionado e sobrevive a recarregar', () => {
  const { url } = navegador('/portal_corretor/numeros?dias=90');
  assert.equal(itemDaUrl(), null);
  itemNaUrl('resumo');
  assert.equal(`${url.pathname}${url.search}`, '/portal_corretor/numeros?dias=90&item=resumo', 'mantém os filtros');
  // Recarregar: um navegador novo no mesmo endereço lê o mesmo item.
  navegador(`${url.pathname}${url.search}`);
  assert.equal(itemDaUrl(), 'resumo');
  itemNaUrl(null);
  assert.equal(itemDaUrl(), null);
});

test('Criar: cada opção leva à criação certa, com o cliente em foco quando há', () => {
  assert.deepEqual(OPCOES_CRIAR.map((o) => o.rotulo), ['Novo cliente', 'Novo imóvel', 'Novo post', 'Nova visita', 'Nova proposta']);
  assert.equal(destinoDeCriar('cliente', '/numeros'), '/clientes?criar=cliente');
  assert.equal(destinoDeCriar('imovel', '/'), '/imoveis?criar=imovel');
  assert.equal(destinoDeCriar('post', '/'), '/estudio?criar=post');
  assert.equal(destinoDeCriar('visita', '/'), null, 'abre o formulário ali mesmo');
  // Nova proposta abre o formulário aqui mesmo (cliente em foco já escolhido) e depois a negociação (P15).
  assert.equal(destinoDeCriar('proposta', '/clientes/7'), null);
  assert.equal(destinoDeCriar('proposta', '/imoveis'), null);
  // A tela de destino consome o pedido uma vez: recarregar não abre de novo.
  const { url } = navegador('/portal_corretor/clientes?criar=cliente&visao=quadro');
  assert.equal(pedidoDeCriar('imovel'), false);
  assert.equal(pedidoDeCriar('cliente'), true);
  assert.equal(url.search, '?visao=quadro');
  assert.equal(pedidoDeCriar('cliente'), false);
});
