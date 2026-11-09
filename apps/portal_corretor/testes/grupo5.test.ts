import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { rotas } from '../backend/rotas';
import { semearFunis } from '../backend/semente';
import { CODIGOS_DO_APP, FRASE_GENERICA, FRASES_DA_PLATAFORMA, fraseDoErro } from '../frontend/estados';
import { semPapelDeEquipe } from '../frontend/telas/corretores';
import { BancoFalso, comServidor, type Ator } from './apoio';

// Etapa 4, grupo 5: transversais (#177 mensagens da plataforma, #173 Corretores sem o papel Equipe,
// #183 literal de cor em comentário, #32 nenhum GET grava, #33 admin sem resíduo em conta real).

const UNICOS = { contatos: ['telefone'], etapas_funil: ['pipeline+nome'], origens: ['canal+campanha'], perfis_corretor: ['usuario_id'], perfil_conta: ['chave'] };
const A: Ator = { usuario: 1, conta: 100, papeis: ['corretor'] };
const RAIZ = process.cwd();
const fontes = (pasta: string) =>
  readdirSync(resolve(RAIZ, pasta))
    .filter((f) => f.endsWith('.ts'))
    .map((f) => ({ arq: `${pasta}/${f}`, texto: readFileSync(resolve(RAIZ, pasta, f), 'utf8') }));

function semConsole<T>(fn: () => T): T {
  const [e, w] = [console.error, console.warn];
  console.error = () => {};
  console.warn = () => {};
  try {
    return fn();
  } finally {
    console.error = e;
    console.warn = w;
  }
}

test('#177: a mensagem crua da plataforma nunca vai à tela; o código conhecido vira frase do app', () => {
  const daPlataforma = (codigo: string, mensagem: string, status = 403) => Object.assign(new Error(mensagem), { codigo, status });
  semConsole(() => {
    // Os do relato da issue.
    const fora = fraseDoErro(daPlataforma('CONTA_INVALIDA', 'A conta informada em X-Conta está fora da sua membership ativa.'));
    assert.doesNotMatch(fora, /X-Conta|membership/);
    assert.match(fora, /Recarregue a página/);
    const papel = fraseDoErro(daPlataforma('PROVISIONA_SEM_PAPEL', "Provisionar externo em 'portal_corretor' exige o papel 'operacao'."));
    assert.doesNotMatch(papel, /Provisionar externo/);
    assert.match(papel, /Configurações › Usuários/);
    for (const codigo of ['CONTA_FORA_DA_MEMBERSHIP', 'PROVISIONA_SEM_PAPEL', 'SEM_CONTA', 'AUTH_SEM_PERMISSAO', 'SEM_PAPEL', 'CORPO_MUITO_GRANDE']) {
      assert.ok(FRASES_DA_PLATAFORMA[codigo], codigo);
      assert.equal(fraseDoErro(daPlataforma(codigo, 'texto técnico qualquer')), FRASES_DA_PLATAFORMA[codigo]);
    }
    // Código desconhecido, 500 sem código e falha de rede: a frase genérica.
    assert.equal(fraseDoErro(daPlataforma('ALGO_NOVO_DO_SHELL', 'detalhe interno do shell', 409)), FRASE_GENERICA);
    assert.equal(fraseDoErro(Object.assign(new Error('relation "contatos" does not exist'), { status: 500 })), FRASE_GENERICA);
    assert.equal(fraseDoErro(new TypeError('Failed to fetch')), FRASE_GENERICA);
    assert.equal(fraseDoErro({ mensagem: 'objeto cru' }), FRASE_GENERICA);
  });
  // Código do app: a frase do app (ou os detalhes da validação).
  assert.equal(fraseDoErro(Object.assign(new Error('Confira o contato.'), { codigo: 'DADOS_INVALIDOS', status: 422, detalhes: ['Nome é obrigatório.'] })), 'Nome é obrigatório.');
  assert.equal(fraseDoErro(Object.assign(new Error('Contato não encontrado.'), { codigo: 'NAO_ENCONTRADO', status: 404 })), 'Contato não encontrado.');
  // Erro local da tela (sem status): a frase dela.
  assert.equal(fraseDoErro(new Error('Escolha um arquivo .csv.')), 'Escolha um arquivo .csv.');
});

test('#177: todo código que o backend emite está no conjunto do app (senão a tela trocaria a frase pela genérica)', () => {
  const emitidos = new Set<string>();
  for (const { texto } of [...fontes('backend'), ...fontes('comum')]) {
    for (const m of texto.matchAll(/erro\(res, \d+, '([A-Z_]+)'|codigo: '([A-Z_]+)'|new ErroInstagram\([^;]*?'([A-Z_]+)'\)/g)) emitidos.add(m[1] ?? m[2] ?? m[3]);
  }
  emitidos.delete('TESTE'); // `codigo` da negociação simulada do Negociador, não erro
  emitidos.delete('EXPIRED'); // `status_code` da Meta, não erro do app
  const fora = [...emitidos].filter((c) => !CODIGOS_DO_APP.has(c) && !FRASES_DA_PLATAFORMA[c]);
  assert.deepEqual(fora, []);
});

test('#177: nenhuma tela põe `message` de erro na tela sem passar pelo mapa', () => {
  // Exceções conhecidas, que leem a frase do app pelo código: DUPLICATA (nome do contato), ESCREVA_A_MENSAGEM
  // e o CANCELADO local do Estúdio.
  const permitidas = [/codigo === 'ESCREVA_A_MENSAGEM' \? \(e as Error\)\.message/, /exec\(falha\.message\)/, /\$\{falha\.message\} Abrir a ficha/, /e\.message === CANCELADO/];
  for (const { arq, texto } of fontes('frontend/telas')) {
    for (const linha of texto.split('\n')) {
      if (!/\.message\b/.test(linha) || permitidas.some((p) => p.test(linha))) continue;
      assert.fail(`${arq}: ${linha.trim()}`);
    }
  }
});

test('#173: sem o papel Equipe, Corretores explica e esconde o convite; o doc diz o caminho', () => {
  assert.equal(semPapelDeEquipe({ codigo: 'PROVISIONA_SEM_PAPEL', status: 403 }), true);
  assert.equal(semPapelDeEquipe({ codigo: 'SEM_PAPEL', status: 403 }), false);
  const tela = readFileSync(resolve(RAIZ, 'frontend/telas/corretores.ts'), 'utf8');
  const render = tela.slice(tela.indexOf('  render() {'));
  const vazio = render.slice(0, render.indexOf('const aceitos'));
  assert.match(vazio, /if \(this\.semPapelDeEquipe\)/);
  assert.match(vazio, /urbi-estado-vazio/);
  assert.doesNotMatch(vazio, /Convidar corretor<\/urbi-botao>/);
  assert.match(readFileSync(resolve(RAIZ, 'docs/convidar-corretores.md'), 'utf8'), /Administrador do app sem o papel Equipe/);
});

test('#183: nenhum comentário HTML de template carrega "#nnn" (o empacotador o conta como cor)', () => {
  for (const { arq, texto } of [...fontes('frontend'), ...fontes('frontend/telas')]) {
    assert.doesNotMatch(texto, /<!--[^>]*#[0-9a-fA-F]{3}/, arq);
  }
});

test('#32: nenhum GET do funil grava; a conta é preparada no início do app ou pelo POST', async () => {
  const banco = new BancoFalso(UNICOS);
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    for (const rota of ['/funil/etapas', '/funil/quadro', '/funil/playbook', '/inicio']) assert.equal((await chamar('GET', rota)).status, 200, rota);
    assert.equal(banco.linhas('etapas_funil').length + banco.linhas('playbook_funil').length, 0);
  });
  // `aoIniciar`: cada conta ativa ganha o padrão, uma vez.
  const ctx = banco.ctxSistema([{ id: 100, nome: 'Marina' }, { id: 200, nome: 'Pedro' }]);
  assert.equal(await semearFunis(ctx), 2);
  const etapas100 = banco.linhas('etapas_funil').filter((e) => e.conta_id === 100).length;
  assert.equal(etapas100, 16);
  assert.equal(banco.linhas('etapas_funil').filter((e) => e.conta_id === 200).length, 16);
  await semearFunis(ctx);
  assert.equal(banco.linhas('etapas_funil').length, 32, 'idempotente');
  assert.ok(banco.linhas('playbook_funil').some((p) => p.conta_id === 200));
});

test('#33: o admin do app (sem papel corretor) não grava perfil de corretor numa conta real; na demo grava', async () => {
  const banco = new BancoFalso(UNICOS);
  const admin: Ator = { usuario: 9, conta: 100, papeis: [], nivel: 'admin' };
  await comServidor(rotas, admin, banco, {}, async (chamar) => {
    const r = await chamar('PUT', '/conta/meu-perfil', { telefone: '61999990000' });
    assert.equal(r.status, 403);
    assert.equal(r.corpo.codigo, 'SO_O_CORRETOR');
    assert.equal(banco.linhas('perfis_corretor').length, 0);
    assert.equal((await chamar('GET', '/conta')).corpo.admin_em_conta_real, true);
  });
  banco.linhas('perfil_conta').push({ id: 9001, conta_id: 100, chave: 'conta', tipo: 'corretor_autonomo', nome: 'Teste', demo: true });
  await comServidor(rotas, admin, banco, {}, async (chamar) => {
    assert.equal((await chamar('PUT', '/conta/meu-perfil', { telefone: '61999990000' })).status, 200);
  });
  // O corretor grava o próprio perfil em qualquer conta.
  await comServidor(rotas, { ...A, conta: 300 }, banco, {}, async (chamar) => {
    assert.equal((await chamar('PUT', '/conta/meu-perfil', { telefone: '61999990001' })).status, 200);
  });
});

test('P05: três perguntas sugeridas por tela, que preenchem o campo; exemplo na conversa vazia; Confirmar · Cancelar', async () => {
  const { PERGUNTAS_SUGERIDAS, perguntasSugeridas, TELAS_APP } = await import('../comum/assistente');
  for (const [sub, lista] of Object.entries(PERGUNTAS_SUGERIDAS)) {
    assert.equal(lista.length, 3, sub);
    assert.ok(sub in TELAS_APP, `${sub} é tela do app`);
  }
  assert.deepEqual(perguntasSugeridas('/clientes/12'), PERGUNTAS_SUGERIDAS['/clientes']);
  assert.deepEqual(perguntasSugeridas('/ajustes/privacidade'), PERGUNTAS_SUGERIDAS['/ajustes'], 'aba sem lista própria: a de Ajustes');
  assert.deepEqual(perguntasSugeridas('/qualquer'), PERGUNTAS_SUGERIDAS['/']);
  const fonte = readFileSync(resolve(RAIZ, 'frontend/telas/assistente.ts'), 'utf8');
  assert.match(fonte, /\.valorInicial=\$\{conversa\.rascunho\}/, 'o chip preenche o campo do chat');
  assert.match(fonte, /<urbi-badge interativo[^>]*@click=\$\{\(\) => preencherPergunta\(p\)\}/);
  assert.match(fonte, /\baudio\b/, 'microfone no campo');
  assert.match(fonte, />Confirmar<\/urbi-botao>[\s\S]*>Cancelar<\/urbi-botao>/);
  assert.match(fonte, /EXEMPLO_CONVERSA_VAZIA/);
  assert.match(fonte, /Ir para \$\{irPara\.nome\}/);
  assert.doesNotMatch(fonte, /\bpequeno\b/);
});
