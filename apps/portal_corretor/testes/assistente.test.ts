import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { rotas } from '../backend/rotas';
import { buscarArtigos, telaBase, validarAcao } from '../comum/assistente';
import { BancoFalso, comServidor, type Ator } from './apoio';

const UNICOS = { contatos: ['telefone'], imoveis: ['codigo'], perfis_corretor: ['usuario_id'] };

test('base de ajuda gerada está em dia com docs/ (rode `pnpm ajuda` depois de mudar um doc)', () => {
  const gerado = execFileSync(process.execPath, ['--input-type=module', '-e', "const m = await import('./scripts/gerar-ajuda.mjs'); process.stdout.write(m.conteudoGerado('docs'));"], { encoding: 'utf8' });
  assert.equal(readFileSync('comum/ajuda-gerada.ts', 'utf8'), gerado);
});

// Roteiro das 30 perguntas do Assistente (plano, bloco 9): para cada uma, o artigo certo precisa
// estar entre os 3 primeiros que vão para a IA. É a parte determinística da resposta; a redação
// da IA se confere na instância (roteiro R.9).
const ROTEIRO: [string, string, string][] = [
  ['como conecto meu Instagram?', '/', 'conexoes'],
  ['por que não consigo publicar story?', '/estudio', 'estudio'],
  ['como agendo um post para sexta?', '/estudio', 'estudio'],
  ['dá para usar o Canva para fazer a arte?', '/estudio', 'estudio'],
  ['onde mudo as cores da minha marca?', '/estudio', 'estudio'],
  ['o que é o pacote de lançamento?', '/', 'estudio'],
  ['por que a peça não pode ser aprovada sem CRECI?', '/estudio', 'estudio'],
  ['como mando uma seleção de imóveis para o cliente?', '/clientes', 'selecoes-e-portal'],
  ['o cliente consegue ver as visitas marcadas?', '/', 'selecoes-e-portal'],
  ['como revogo o link do portal do cliente?', '/clientes', 'selecoes-e-portal'],
  ['como publico a minha página?', '/', 'minha-pagina'],
  ['por que um imóvel não aparece na minha página?', '/pagina', 'minha-pagina'],
  ['para onde vai o contato que preenche o formulário da página?', '/', 'minha-pagina'],
  ['o que é o link rastreado?', '/', 'minha-pagina'],
  ['como importo uma planilha de contatos?', '/clientes', 'clientes-e-agenda'],
  ['como exporto meus clientes?', '/', 'clientes-e-agenda'],
  ['onde vejo a agenda da semana?', '/', 'clientes-e-agenda'],
  ['como registro o consentimento do cliente?', '/clientes', 'clientes-e-agenda'],
  ['o que significa contato quente?', '/', 'funil'],
  ['como o app decide a temperatura do contato?', '/funil', 'funil'],
  ['o que aparece no Início?', '/', 'funil'],
  ['como mudo as etapas do funil?', '/ajustes/funil', 'funil'],
  ['como cadastro a autorização de venda?', '/imoveis', 'imoveis'],
  ['a IA escreve a descrição do imóvel?', '/imoveis', 'imoveis'],
  ['como cadastro um empreendimento com tabela e planta?', '/', 'imoveis'],
  ['onde vejo a conversão e o VGV?', '/', 'desempenho'],
  ['onde cadastro meu CRECI?', '/', 'conta-e-ajustes'],
  ['como convido um corretor?', '/corretores', 'convidar-corretores'],
  ['o assistente faz coisas sozinho sem eu confirmar?', '/', 'assistente'],
  ['o assistente manda o telefone do cliente para a IA?', '/', 'assistente'],
];

test('roteiro das 30 perguntas: o artigo certo está entre os 3 primeiros', () => {
  assert.equal(ROTEIRO.length, 30);
  const falhas = ROTEIRO.filter(([pergunta, tela, slug]) => !buscarArtigos(pergunta, tela, 3).some((a) => a.slug === slug)).map(
    ([pergunta, tela, slug]) => `${pergunta} → esperado ${slug}, veio ${buscarArtigos(pergunta, tela, 3).map((a) => a.slug).join(', ')}`,
  );
  assert.deepEqual(falhas, []);
  assert.equal(telaBase('/clientes/12'), '/clientes');
  assert.equal(telaBase('/qualquer'), '/');
  assert.deepEqual(buscarArtigos('xyzzy plugh', '/'), [], 'sem termo conhecido, nada');
});

test('ações propostas pela IA: só valem as conferidas, com o resumo escrito pelo app', () => {
  const agora = new Date('2026-10-19T12:00:00Z');
  const ctx = { contatos: new Map([[7, 'Ana']]), pecas: new Map([[3, { titulo: 'Casa no Lago', estado: 'aprovada' }]]), agora };
  const tarefa = validarAcao({ tipo: 'criar_atividade', tipo_atividade: 'ligacao', titulo: ' Ligar para a Ana ', quando: '2026-10-20T10:00:00-03:00', contato_id: 7 }, ctx)!;
  assert.equal(tarefa.rota, '/atividades');
  assert.deepEqual(tarefa.corpo, { tipo: 'ligacao', titulo: 'Ligar para a Ana', quando: '2026-10-20T13:00:00.000Z', contato_id: 7 });
  assert.match(tarefa.resumo, /ligação “Ligar para a Ana” com Ana/);
  // Contato que não está no contexto não entra; tipo desconhecido vira tarefa.
  const semContato = validarAcao({ tipo: 'criar_atividade', tipo_atividade: 'visita', titulo: 'Rever proposta', quando: '2026-10-20T10:00:00-03:00', contato_id: 99 }, ctx)!;
  assert.deepEqual([semContato.corpo.contato_id, semContato.corpo.tipo], [undefined, 'tarefa']);
  assert.equal(validarAcao({ tipo: 'criar_atividade', titulo: 'Ontem', quando: '2026-10-18T10:00:00Z' }, ctx), null, 'no passado');
  assert.equal(validarAcao({ tipo: 'criar_atividade', titulo: 'x', quando: '2026-10-20T10:00:00Z' }, ctx), null, 'título curto');
  const peca = validarAcao({ tipo: 'agendar_peca', peca_id: 3, quando: '2026-10-23T21:00:00Z' }, ctx)!;
  assert.deepEqual([peca.rota, peca.corpo], ['/estudio/pecas/3/agendar', { quando: '2026-10-23T21:00:00.000Z' }]);
  assert.equal(validarAcao({ tipo: 'agendar_peca', peca_id: 4, quando: '2026-10-23T21:00:00Z' }, ctx), null, 'peça fora da lista');
  assert.equal(validarAcao({ tipo: 'agendar_peca', peca_id: 3, quando: '2026-10-19T12:02:00Z' }, ctx), null, 'menos de 5 minutos');
  assert.equal(validarAcao({ tipo: 'mudar_preco', imovel_id: 1 }, ctx), null);
  assert.equal(validarAcao({ tipo: 'nenhuma' }, ctx), null);
});

let contextoIa = '';
let respostaIa: Record<string, unknown> = {};
const iaLigada = {
  estadoSlot: async (slot: string) => ({ pedido: slot, efetivo: { slot, origem: 'global' }, backup: null }),
  consultar: async (o: { contexto: string; slot: string }) => {
    contextoIa = `${o.slot}\n${o.contexto}`;
    return { dados: respostaIa };
  },
};
const iaDesligada = { estadoSlot: async (slot: string) => ({ pedido: slot, efetivo: null, backup: null }) };
const A: Ator = { usuario: 1, conta: 100, papeis: ['corretor'], extras: { ia: iaDesligada } };
const AcomIA: Ator = { ...A, extras: { ia: iaLigada } };

test('rota do Assistente: sem IA busca na ajuda; com IA manda contexto sem telefone e devolve só ação conferida', async () => {
  const banco = new BancoFalso(UNICOS);
  let anaId = 0;
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    assert.equal((await chamar('POST', '/assistente/perguntar', { pergunta: '  ' })).status, 422);
    const r = (await chamar('POST', '/assistente/perguntar', { pergunta: 'como conecto meu Instagram?', tela: '/' })).corpo;
    assert.equal(r.sem_ia, true);
    assert.equal(r.acao, null);
    assert.equal(r.artigos[0].slug, 'conexoes');
    const ana = (await chamar('POST', '/contatos', { nome: 'Ana Souza', telefone: '61988887777', email: 'ana@exemplo.com' })).corpo;
    anaId = ana.id;
    await chamar('PATCH', `/contatos/${ana.id}`, { temperatura: 'quente' });
  });
  await comServidor(rotas, AcomIA, banco, {}, async (chamar) => {
    const amanha = new Date(Date.now() + 86400e3).toISOString();
    respostaIa = {
      resposta: 'Ligue para a Ana amanhã cedo.', artigos: ['inexistente#1'], tela: '/agenda', nao_sei: false,
      acao: { tipo: 'criar_atividade', tipo_atividade: 'ligacao', titulo: 'Ligar para a Ana', quando: amanha, contato_id: anaId },
    };
    const r = (await chamar('POST', '/assistente/perguntar', { pergunta: 'me lembra de ligar para a Ana amanhã', tela: `/clientes/${anaId}`, contato_id: anaId, historico: [{ autor: 'eu', texto: 'oi' }] })).corpo;
    assert.equal(r.sem_ia, false);
    assert.deepEqual(r.tela, { sub: '/agenda', nome: 'Agenda' });
    assert.equal(r.acao.rota, '/atividades');
    assert.equal(r.acao.corpo.contato_id, anaId);
    assert.ok(r.artigos.length <= 1, 'artigo inventado não volta');
    assert.match(contextoIa, /^assistente\n/, 'slot próprio');
    assert.match(contextoIa, /CONTATO EM FOCO:\nContato #\d+: Ana Souza/);
    assert.match(contextoIa, /TELA ATUAL: Clientes/);
    assert.match(contextoIa, /Instagram: não conectado/);
    assert.doesNotMatch(contextoIa, /61988887777|ana@exemplo\.com/, 'telefone e e-mail não vão para a IA');
    // A ação confirmada vai pela rota de sempre.
    const feito = await chamar('POST', r.acao.rota, r.acao.corpo);
    assert.equal(feito.status, 201, JSON.stringify(feito.corpo));
    // IA tenta uma ação proibida: nada volta.
    respostaIa = { resposta: 'Mudei o preço.', artigos: [], tela: '', nao_sei: false, acao: { tipo: 'mudar_preco' } };
    assert.equal((await chamar('POST', '/assistente/perguntar', { pergunta: 'baixa o preço da casa' })).corpo.acao, null);
  });
  // Outra conta não consegue focar o contato de A.
  await comServidor(rotas, { usuario: 2, conta: 200, papeis: ['corretor'], extras: { ia: iaLigada } }, banco, {}, async (chamar) => {
    respostaIa = { resposta: 'ok', artigos: [], tela: '', nao_sei: true, acao: { tipo: 'criar_atividade', titulo: 'Ligar', quando: new Date(Date.now() + 86400e3).toISOString(), contato_id: anaId } };
    const r = (await chamar('POST', '/assistente/perguntar', { pergunta: 'quem é a Ana?', contato_id: anaId })).corpo;
    assert.doesNotMatch(contextoIa, /Ana Souza/);
    assert.equal(r.acao.corpo.contato_id, undefined, 'contato de outra conta não entra na ação');
  });
  // Sem o papel de corretor, a rota é barrada.
  await comServidor(rotas, { usuario: 3, conta: 100, papeis: ['operacao'] }, banco, {}, async (chamar) => {
    assert.equal((await chamar('POST', '/assistente/perguntar', { pergunta: 'oi' })).status, 403);
  });
});
