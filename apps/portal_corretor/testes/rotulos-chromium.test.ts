import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

// Issue #192: todo campo que o app monta leva o nome pelo atributo do primitivo (ui-componentes-conteudo.md
// § Formulários): `label` em `urbi-input*`, `urbi-select`, `urbi-textarea`, `urbi-checkbox` e
// `urbi-seletor-arquivo`; `rotulo` em `urbi-seletor-objeto`; `aria-label` em `urbi-toggle` e
// `urbi-botao-alternar`; e o campo nativo das páginas públicas, `<label>` ou `aria-label`. Telas do #192:
// Ajustes (todas as seções, Conta e marca inclusive), Novo imóvel (os 4 passos), Importar (com as
// colunas de um arquivo lido) e a lista de Clientes, abertas pelos endereços do menu. Os primitivos são
// elementos sem registro aqui: o teste mede o que a tela ENTREGA a eles. Se o primitivo liga esse
// rótulo ao campo é do shell (pedido 29a); na homologação, `specs/prints/issue-192/`. Sem Playwright, pula.

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
import { renderAjustes } from './frontend/telas/ajustes';
import { renderNovoImovel } from './frontend/telas/novo-imovel';
import { renderImportar } from './frontend/telas/importar';
import { renderClientes } from './frontend/telas/clientes';
const banco = window.SEMENTE ?? { imovel: null };
window.urbiVerso = {
  subRota: () => location.pathname.replace(/^\\/portal_corretor/, '') || '/',
  href: (s) => '/portal_corretor' + s,
  navegarSub: (s) => history.pushState(null, '', '/portal_corretor' + s),
  usuario: () => ({ id: 1, nome: 'Marina' }),
  contexto: () => ({ conta: { resolucao: 'escopado', contas: [{ id: 100, nome: 'A' }], contaEscrita: 100 } }),
  notificar: () => {},
  alertar: async () => {},
  confirmar: async () => true,
  api: async (rota) => {
    const [caminho] = rota.split('?');
    if (caminho === '/conta') return {
      perfil: { nome: 'Imobiliária Marina', tipo: 'corretor_autonomo', documento: null, creci_juridico: null },
      configuracoes: { prazo_primeiro_atendimento_min: 30, dias_cliente_parado: 7, validade_selecao_dias: 15, lembrete_visita_horas: 2 },
      meu_perfil: { creci: null, telefone: '61999990000' },
    };
    if (caminho === '/estudio/marca') return { cor_primaria: '#123456', cor_secundaria: '#abcdef', estilo: 'moderno', assinatura: null, logo_url: null, referencias: [] };
    if (caminho === '/negociador/config') return { ligado: true, conduz_padrao: 'ia', gatilhos: {}, estilo: 'cooperativo', instrucoes_corretor: null, versao: 0 };
    if (caminho === '/negociador/objecoes') return { dados: [] };
    if (caminho === '/negociador/ia') return { disponivel: true };
    if (caminho === '/negociador/numeros') return { desde: '2026-10-01', rodadas: 0, decididas: 0, aprovadas_sem_edicao: 0 };
    if (caminho === '/conexoes') return { instagram: null, disponivel: true, retorno: '' };
    if (caminho === '/contatos') return { dados: [{ id: 1, nome: 'Ana', papeis: ['comprador'], temperatura: 'quente' }], total: 1 };
    if (caminho === '/imoveis/ia') return { fotos: true, conteudo: false };
    const m = caminho.match(/^\\/imoveis\\/(\\d+)$/);
    if (m && banco.imovel) return { imovel: banco.imovel, qualidade: { nota: 0, faltas: [] }, autorizacao_vigente: false, fotos_publicas: 0, midias: [], autorizacoes: [] };
    return {};
  },
};
const raiz = document.getElementById('raiz');
const TELAS = { ajustes: renderAjustes, novo: renderNovoImovel, importar: renderImportar, clientes: renderClientes };
const sub = window.urbiVerso.subRota();
const tela = sub.startsWith('/ajustes') ? 'ajustes' : sub === '/imoveis/novo' ? 'novo' : sub === '/clientes/importar' ? 'importar' : 'clientes';
const desenhar = () => render(TELAS[tela](desenhar), raiz);
desenhar();
`;

/** Os campos da página (atravessando as sombras) e os que ficam sem nome pelo atributo do primitivo. */
const CAMPOS = `
const POR_LABEL = new Set(['urbi-input', 'urbi-input-numero', 'urbi-input-data', 'urbi-input-data-hora', 'urbi-input-segredo', 'urbi-textarea',
  'urbi-select', 'urbi-select-usuarios', 'urbi-checkbox', 'urbi-seletor-arquivo', 'urbi-editor-markdown', 'urbi-slider', 'urbi-input-score']);
const POR_ROTULO = new Set(['urbi-seletor-objeto']);
const POR_ARIA = new Set(['urbi-toggle', 'urbi-botao-alternar']);
window.campos = () => {
  const lista = [];
  const fila = [document];
  while (fila.length) {
    const n = fila.shift();
    for (const e of n.querySelectorAll?.('*') ?? []) {
      if (e.shadowRoot) fila.push(e.shadowRoot);
      const t = e.localName;
      let nome;
      if (POR_LABEL.has(t)) nome = e.getAttribute('label') ?? e.label;
      else if (POR_ROTULO.has(t)) nome = e.getAttribute('rotulo') ?? e.rotulo;
      else if (POR_ARIA.has(t)) nome = e.getAttribute('aria-label') ?? e.ariaLabel;
      else if ((t === 'input' && e.type !== 'hidden') || t === 'select' || t === 'textarea')
        nome = e.getAttribute('aria-label') || e.getAttribute('aria-labelledby') || [...(e.labels ?? [])].map((l) => l.textContent).join(' ');
      else continue;
      lista.push({ tag: t, nome: String(nome ?? '').trim() });
    }
  }
  return lista;
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
  const html = `<!doctype html><html><head><meta charset="utf-8"></head><body><div id="raiz"></div><script>${CAMPOS}</script><script>${pacote.outputFiles[0].text}</script></body></html>`;
  const navegador = await pw.chromium.launch();
  const pagina = await navegador.newPage({ viewport: { width: 1440, height: 900 } });
  await pagina.route(`${ORIGEM}/**`, (r: any) => r.fulfill({ contentType: 'text/html', body: html }));
  return { navegador, pagina };
}

async function semNome(pagina: any, caminho: string, minimo: number, antes?: () => Promise<void>) {
  await pagina.goto(`${ORIGEM}${caminho}`);
  await pagina.waitForTimeout(120);
  if (antes) {
    await antes();
    await pagina.waitForTimeout(120);
  }
  const campos: { tag: string; nome: string }[] = await pagina.evaluate(() => (window as any).campos());
  assert.ok(campos.length >= minimo, `${caminho}: ${campos.length} campos (esperava ao menos ${minimo}); a tela abriu?`);
  return campos.filter((c) => !c.nome).map((c) => `${caminho} › ${c.tag}`);
}

test('Rótulos (#192): todo campo que o app monta em Ajustes, Novo imóvel, Importar e Clientes leva o nome pelo atributo do primitivo', async (t) => {
  const pw = playwright();
  if (!pw) return t.skip('Playwright não instalado neste ambiente');
  const { navegador, pagina } = await montar(pw);
  try {
    const erros: string[] = [];
    pagina.on('pageerror', (e: Error) => erros.push(e.message));
    const faltam: string[] = [];
    // Ajustes: o caminho do menu (/ajustes) e cada seção por ?aba=, e os apelidos /ajustes/marca e /ajustes/conexoes.
    faltam.push(...(await semNome(pagina, '/portal_corretor/ajustes', 10)));
    faltam.push(...(await semNome(pagina, '/portal_corretor/ajustes/marca', 10)));
    // Mínimo 0: `atendimento` (`pc-tela-conta`), `conexoes` (`pc-tela-conexoes`), `funil` (`pc-tela-funil-ajustes`) e `privacidade` (`pc-ajustes-privacidade`) entregam elementos próprios que este teste não registra; então este teste não alcança os campos dessas seções, e o 0 só prova que a página abre sem erro. A cobertura desses campos é da varredura estática de `testes/rotulos.test.ts`. `mensageiro` é só um estado vazio, sem campo.
    faltam.push(...(await semNome(pagina, '/portal_corretor/ajustes?aba=atendimento', 0)));
    faltam.push(...(await semNome(pagina, '/portal_corretor/ajustes?aba=negociador', 3)));
    for (const aba of ['conexoes', 'funil', 'privacidade', 'mensageiro']) faltam.push(...(await semNome(pagina, `/portal_corretor/ajustes?aba=${aba}`, 0)));
    // Novo imóvel: Fotos e Dados sem rascunho; Autorização e Onde aparece com um rascunho retomado.
    faltam.push(...(await semNome(pagina, '/portal_corretor/imoveis/novo', 2)));
    faltam.push(...(await semNome(pagina, '/portal_corretor/imoveis/novo?passo=dados', 5)));
    await pagina.addInitScript(() => {
      (window as any).SEMENTE = { imovel: { id: 7, codigo: 'IM-0007', situacao: 'rascunho', publicado_pagina: false, tipo: 'casa', cidade: 'Brasília' } };
    });
    faltam.push(...(await semNome(pagina, '/portal_corretor/imoveis/novo?item=7&passo=dados', 5)));
    faltam.push(...(await semNome(pagina, '/portal_corretor/imoveis/novo?item=7&passo=autorizacao', 1)));
    // Mínimo 0: o passo Onde é só uma `urbi-lista` clicável com as duas opções (Só você, Público), sem campo de primitivo; não usa `escolhaUnica`.
    faltam.push(...(await semNome(pagina, '/portal_corretor/imoveis/novo?item=7&passo=onde', 0)));
    // Importar (o botão Importar de Clientes): a origem e o arquivo; com um CSV lido, cada coluna mapeada.
    faltam.push(...(await semNome(pagina, '/portal_corretor/clientes/importar', 2)));
    const comArquivo = await semNome(pagina, '/portal_corretor/clientes/importar', 6, () =>
      pagina.evaluate(() => {
        const achar = (raiz: any): any => {
          for (const e of raiz.querySelectorAll('*')) {
            if (e.localName === 'urbi-seletor-arquivo') return e;
            const r = e.shadowRoot && achar(e.shadowRoot);
            if (r) return r;
          }
          return null;
        };
        const arquivo = new File(['nome,telefone,email\nAna,61999990000,ana@exemplo.invalid\n'], 'clientes.csv', { type: 'text/csv' });
        achar(document).dispatchEvent(new CustomEvent('urbi:seletor-arquivo-change', { detail: { arquivos: [arquivo], arquivo }, bubbles: true, composed: true }));
      }),
    );
    faltam.push(...comArquivo);
    // Clientes (lista): a busca.
    faltam.push(...(await semNome(pagina, '/portal_corretor/clientes', 1)));
    assert.deepEqual(faltam, [], 'campo sem nome pelo atributo do primitivo');
    assert.deepEqual(erros, [], 'sem erro de página');
  } finally {
    await navegador.close();
  }
});
