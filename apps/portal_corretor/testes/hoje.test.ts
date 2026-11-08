import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { rotas } from '../backend/rotas';
import { ORDEM_FILA } from '../comum/funil';
import { ACOES_FILA, cargaVazia, dicaDoAssistente, entrarEmHoje, iniciarCarga, marcarEntrada, mostrarTudo, motivoDoItem, MOTIVO_NA_FILA, PASSOS_INICIAIS, precisaCarregar, primeirosPassos, receberCarga, telaDeHoje } from '../comum/hoje';
import { validarAcao } from '../comum/assistente';
import { CAMPOS_SIGILOSOS } from '../comum/negociacao';
import { BancoFalso, comServidor, type Ator } from './apoio';

// Hoje no Padrão B (B2, issue #91): Precisa de você, Primeiros passos sem CRECI, fila em cartões com
// um botão principal, agenda de hoje e o isolamento entre contas do que a rota passou a devolver.

const UNICOS = { contatos: ['telefone'], etapas_funil: ['pipeline+nome'], playbook_funil: ['etapa_id+temperatura'], visitas: ['atividade_id'] };
const A: Ator = { usuario: 1, conta: 100, papeis: ['corretor'] };
const B: Ator = { usuario: 2, conta: 200, papeis: ['corretor'] };
const HORA = 3600e3;
const raiz = (f: string) => readFileSync(resolve(process.cwd(), f), 'utf8');

test('Primeiros passos: 5 passos, nenhum é o CRECI (D-93)', () => {
  assert.equal(PASSOS_INICIAIS.length, 5);
  assert.ok(PASSOS_INICIAIS.every((p) => !/creci/i.test(`${p.id} ${p.rotulo} ${p.rota}`)));
  const tudo = primeirosPassos({ conta: true, telefone: true, instagram: true, imovel: true, pagina: true });
  assert.ok(tudo.every((p) => p.feito));
  assert.deepEqual(primeirosPassos({ conta: true, telefone: false, instagram: false, imovel: true, pagina: false }).filter((p) => p.feito).map((p) => p.id), ['conta', 'imovel']);
});

test('fila: todo tipo tem chip de motivo (nunca a temperatura), um botão principal, no máximo um secundário e o resto no "Mais"', () => {
  assert.deepEqual(Object.keys(ACOES_FILA).sort(), [...ORDEM_FILA].sort());
  assert.deepEqual(Object.keys(MOTIVO_NA_FILA).sort(), [...ORDEM_FILA].sort());
  for (const [tipo, a] of Object.entries(ACOES_FILA)) {
    assert.equal(typeof a.principal, 'string', tipo);
    assert.notEqual(a.principal, a.secundaria, `${tipo}: o secundário não repete o principal`);
    assert.ok(!a.mais.includes(a.principal) && (!a.secundaria || !a.mais.includes(a.secundaria)), `${tipo}: o "Mais" não repete os botões`);
    assert.doesNotMatch(MOTIVO_NA_FILA[tipo as keyof typeof MOTIVO_NA_FILA], /^(Quente|Morno|Frio)$/, `${tipo}: o chip de motivo não repete a temperatura (#175)`);
  }
  // O chip da visita diz o dia.
  const agora = new Date('2026-11-08T12:00:00');
  assert.equal(motivoDoItem({ tipo: 'visita', quando: '2026-11-08T15:00:00' }, agora), 'Visita hoje');
  assert.equal(motivoDoItem({ tipo: 'visita', quando: '2026-11-09T15:00:00' }, agora), 'Visita amanhã');
  assert.equal(motivoDoItem({ tipo: 'quente_sem_resposta' }, agora), 'Sem resposta');
  // A tela usa a regra: o principal, o secundário visível e o "Mais" com "Agora não" (`POST /abordagens/:contato/adiar`).
  const tela = raiz('frontend/telas/inicio.ts');
  assert.match(tela, /ACOES_FILA\[i\.tipo\]/);
  assert.match(tela, /botao\(acaoDe\(regra\.principal/);
  assert.match(tela, /abordagens\/\$\{i\.contato_id\}\/adiar/);
  assert.match(tela, /negociacoes\/\$\{p\.negociacao_id\}\/assumir/);
});

test('Dica do Assistente: concreta, a partir do que a tela tem, com a ação que `validarAcao` confere', () => {
  const passos = primeirosPassos({ conta: true, telefone: true, instagram: false, imovel: true, pagina: true });
  const agora = new Date('2026-11-08T12:00:00Z');
  const quente = { tipo: 'quente_sem_resposta' as const, contato_id: 7, contato_nome: 'Ana Ribeiro', texto: 'x' };
  const d1 = dicaDoAssistente([quente, { ...quente, contato_id: 8, contato_nome: 'Bia' }], passos, agora);
  assert.match(d1.texto, /^2 clientes quentes/);
  assert.deepEqual(d1.acao, { tipo: 'criar_atividade', tipo_atividade: 'ligacao', titulo: 'Responder Ana Ribeiro', quando: '2026-11-08T13:00:00.000Z', contato_id: 7 });
  // A ação passa pelo mesmo `validarAcao` do Assistente: só contato da fila e horário na janela.
  const v = validarAcao(d1.acao, { contatos: new Map([[7, 'Ana Ribeiro']]), pecas: new Map(), agora });
  assert.equal(v?.rota, '/atividades');
  assert.deepEqual(v?.corpo, { tipo: 'ligacao', titulo: 'Responder Ana Ribeiro', quando: '2026-11-08T13:00:00.000Z', contato_id: 7 });
  assert.equal(validarAcao(d1.acao, { contatos: new Map(), pecas: new Map(), agora })?.corpo.contato_id, undefined, 'contato fora da fila não entra no corpo');
  const d2 = dicaDoAssistente([{ tipo: 'abordagem_vencida', contato_id: 9, contato_nome: 'Caio', texto: 'x' }], passos, agora);
  assert.match(d2.texto, /uma abordagem atrasada/);
  assert.equal(d2.acao?.tipo_atividade, 'retorno');
  const d3 = dicaDoAssistente([{ tipo: 'peca_aguardando', contato_id: null, contato_nome: 'Lançamento', texto: 'x', peca_id: 3 }], passos, agora);
  assert.deepEqual([d3.acao?.tipo, d3.acao?.peca_id], ['agendar_peca', 3]);
  assert.ok(validarAcao(d3.acao, { contatos: new Map(), pecas: new Map([[3, { titulo: 'Lançamento', estado: 'aprovada' }]]), agora }), 'peça aprovada agenda');
  assert.equal(validarAcao(d3.acao, { contatos: new Map(), pecas: new Map([[3, { titulo: 'Lançamento', estado: 'rascunho' }]]), agora }), null, 'rascunho não agenda');
  const d4 = dicaDoAssistente([], passos, agora);
  assert.match(d4.texto, /conectar o instagram/);
  assert.equal(d4.acao, null, 'sem ação: o botão abre o Assistente');
  assert.match(dicaDoAssistente([], primeirosPassos({ conta: true, telefone: true, instagram: true, imovel: true, pagina: true }), agora).texto, /Nada urgente/);
});

test('Hoje entra na moldura do Padrão B e relê os dados a cada entrada', () => {
  const indice = raiz('frontend/index.ts');
  assert.match(indice, /hoje: \{ titulo: 'Hoje', papel: 'corretor', moldura: true, aoAbrir: aoAbrirHoje/);
  assert.match(raiz('frontend/telas/inicio.ts'), /moldura\(\s*\{ menu: '\/', lista: esquerda/);
});

test('GET /inicio: conta nova tem 0 de 5 e o aviso do CRECI; completa sem CRECI fica 5 de 5', async () => {
  const banco = new BancoFalso(UNICOS);
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    let r = (await chamar('GET', '/inicio')).corpo;
    assert.equal(r.primeiros_passos.length, 5);
    assert.equal(r.primeiros_passos.filter((p: any) => p.feito).length, 0);
    assert.equal(r.sem_creci, true);
    assert.deepEqual([r.passagens, r.agenda_hoje, r.fila], [[], [], []]);
    // Tudo pronto, menos o CRECI: os passos fecham, e o CRECI segue só como aviso.
    banco.linhas('perfil_conta').push({ id: 1, conta_id: 100, chave: 'conta', nome: 'Imóveis da Ana', creci_juridico: null });
    banco.linhas('perfis_corretor').push({ id: 2, conta_id: 100, usuario_id: 1, telefone: '+5561999990000', creci: null });
    banco.linhas('canais_sociais').push({ id: 3, conta_id: 100, rede: 'instagram', usuario: 'ana', desconectado_em: null });
    banco.linhas('imoveis').push({ id: 4, conta_id: 100, codigo: 'IM-1', tipo: 'casa', situacao: 'disponivel' });
    banco.linhas('paginas_corretor').push({ id: 5, conta_id: 100, chave: 'conta', endereco: 'ana', publicada_em: new Date().toISOString() });
    r = (await chamar('GET', '/inicio')).corpo;
    assert.deepEqual(r.primeiros_passos.map((p: any) => p.feito), [true, true, true, true, true]);
    assert.equal(r.sem_creci, true, 'sem CRECI e com os 5 passos feitos');
    // Instagram desconectado volta a ser passo pendente.
    banco.linhas('canais_sociais')[0].desconectado_em = new Date().toISOString();
    r = (await chamar('GET', '/inicio')).corpo;
    assert.equal(r.primeiros_passos.find((p: any) => p.id === 'instagram').feito, false);
  });
});

test('GET /inicio: passagens sem sigilo, agenda só de hoje, e nada de uma conta na outra', async () => {
  const banco = new BancoFalso(UNICOS);
  let contatoA = 0;
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    contatoA = (await chamar('POST', '/contatos', { nome: 'Juliana', telefone: '61911112222' })).corpo.id;
    await chamar('POST', '/atividades', { tipo: 'ligacao', titulo: 'Ligar Juliana', quando: new Date(Date.now() + HORA / 60).toISOString(), contato_id: contatoA });
    await chamar('POST', '/atividades', { tipo: 'tarefa', titulo: 'Depois de amanhã', quando: new Date(Date.now() + 50 * HORA).toISOString(), contato_id: contatoA });
  });
  // Negociação que espera o corretor, com campo sigiloso na linha: ele não pode sair em Hoje.
  banco.linhas('negociacoes').push(
    { id: 900, conta_id: 100, codigo: 'NG-0001', contato_id: contatoA, estado: 'aguardando_corretor', recuo_c: 1, alvo_c: 2, batna_vendedor: 'x', atualizado_em: new Date().toISOString() },
    { id: 901, conta_id: 100, codigo: 'NG-0002', contato_id: contatoA, estado: 'ativa', atualizado_em: new Date().toISOString() },
  );
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    const r = (await chamar('GET', '/inicio')).corpo;
    assert.deepEqual(r.passagens, [{ negociacao_id: 900, codigo: 'NG-0001', contato_id: contatoA, contato_nome: 'Juliana', conversa_id: null, motivo: 'A negociação espera a sua decisão' }]);
    // A dica vem pronta da rota, com a ação conferida (sem fila nem passo pendente aqui, só o texto).
    assert.equal(typeof r.dica.texto, 'string');
    const texto = JSON.stringify(r);
    for (const c of CAMPOS_SIGILOSOS) assert.ok(!texto.includes(`"${c}"`), `${c} não sai de Hoje`);
    // Só a ligação de hoje: a de daqui a 50 h fica para a agenda de 14 dias. (Perto da meia-noite a de
    // hoje pode cair amanhã; aí a lista fica vazia, nunca com a de depois de amanhã.)
    assert.ok(r.agenda_hoje.every((a: any) => a.titulo === 'Ligar Juliana'));
  });
  // B não vê nada de A: nem passagem, nem compromisso, nem passo feito.
  await comServidor(rotas, B, banco, {}, async (chamar) => {
    const r = (await chamar('GET', '/inicio')).corpo;
    assert.deepEqual([r.passagens, r.agenda_hoje, r.fila], [[], [], []]);
    assert.equal(r.primeiros_passos.filter((p: any) => p.feito).length, 0);
  });
});

// Carga de Hoje: os dados vivem no módulo; o app chama `aoAbrirHoje` a cada entrada e na troca de conta.
type Dados = { de: string };
/** O que a tela desenha: os dados só aparecem se forem da conta ativa. */
const desenhado = (c: ReturnType<typeof cargaVazia<Dados>>) => (telaDeHoje(c) === 'dados' ? c.dados!.de : telaDeHoje(c));
/** Uma carga completa para `conta`: entra, inicia e recebe. */
function carregada(c: ReturnType<typeof cargaVazia<Dados>>, conta: number, de: string) {
  const e = iniciarCarga(entrarEmHoje(c, conta));
  return receberCarga(e, e.geracao, { dados: { de } });
}

test('Hoje: troca de conta nunca desenha dados da conta anterior', () => {
  let c = carregada(cargaVazia<Dados>(), 100, 'A');
  assert.equal(desenhado(c), 'A');
  // Troca para B: antes da resposta nova, nada de A.
  c = entrarEmHoje(c, 200);
  assert.equal(desenhado(c), 'carregando');
  // A resposta de A (carga já em voo) chega atrasada depois da troca: ignorada.
  const emVooA = iniciarCarga(entrarEmHoje(carregada(cargaVazia<Dados>(), 100, 'A'), 100));
  let atrasada = entrarEmHoje(emVooA, 200);
  atrasada = receberCarga(atrasada, emVooA.geracao, { dados: { de: 'A' } });
  assert.equal(desenhado(atrasada), 'carregando');
  assert.equal(atrasada.dados, null);
  // Resposta de B: mostra B.
  c = iniciarCarga(c);
  c = receberCarga(c, c.geracao, { dados: { de: 'B' } });
  assert.equal(desenhado(c), 'B');
  // Mesmo depois de B carregar, a resposta velha de A segue ignorada.
  assert.equal(desenhado(receberCarga(c, emVooA.geracao, { dados: { de: 'A' } })), 'B');
});

test('Hoje: entrada na mesma conta mantém os dados (sem piscar) e a recarga que falha mostra a falha', () => {
  let c = carregada(cargaVazia<Dados>(), 100, 'A');
  const de_novo = entrarEmHoje(c, 100);
  assert.equal(de_novo, c, 'mesma conta: nada é descartado');
  assert.equal(desenhado(de_novo), 'A');
  // Recarga em voo: segue A até a resposta.
  c = iniciarCarga(de_novo);
  assert.equal(desenhado(c), 'A');
  // A recarga falha: falha, nunca dados velhos.
  c = receberCarga(c, c.geracao, { falha: new Error('rede') });
  assert.equal(desenhado(c), 'falha');
  assert.equal(c.dados, null);
  // "Tentar de novo": volta a carregar e, chegando, mostra os dados.
  c = iniciarCarga(c);
  assert.equal(desenhado(c), 'carregando');
  c = receberCarga(c, c.geracao, { dados: { de: 'A' } });
  assert.equal(desenhado(c), 'A');
  // Falha atrasada de uma carga superada também é ignorada.
  const velha = c.geracao;
  c = iniciarCarga(c);
  assert.equal(desenhado(receberCarga(c, velha, { falha: new Error('velha') })), 'A');
});

test('Hoje: a tela não guarda dados, falha nem recarga soltos no módulo (só a carga por conta)', () => {
  const tela = raiz('frontend/telas/inicio.ts');
  for (const solto of ['estado.dados', 'estado.falha', 'estado.vencido', 'estado.verTudo']) assert.ok(!tela.includes(solto), `${solto} vive na carga`);
  assert.ok(tela.includes('telaDeHoje(estado.carga)'), 'o que se desenha sai da carga');
});

test('Hoje: falha de A some na troca para B (carregando, com carga a pedir), não "falha"', () => {
  let c = iniciarCarga(entrarEmHoje(cargaVazia<Dados>(), 100));
  c = receberCarga(c, c.geracao, { falha: new Error('rede') });
  assert.equal(desenhado(c), 'falha');
  c = entrarEmHoje(c, 200);
  assert.equal(desenhado(c), 'carregando');
  assert.equal(c.falha, null);
  assert.ok(precisaCarregar(c), 'a carga de B é pedida');
  c = iniciarCarga(c);
  assert.equal(desenhado(c), 'carregando');
  assert.ok(!precisaCarregar(c), 'com carga em voo não pede outra');
});

test('Hoje: A→B→A descarta a resposta velha de A', () => {
  const emVooA = iniciarCarga(entrarEmHoje(cargaVazia<Dados>(), 100));
  let c = entrarEmHoje(entrarEmHoje(emVooA, 200), 100);
  assert.equal(desenhado(c), 'carregando');
  assert.ok(precisaCarregar(c));
  c = receberCarga(c, emVooA.geracao, { dados: { de: 'A velha' } });
  assert.equal(desenhado(c), 'carregando', 'a resposta da primeira passagem por A não vale');
  c = iniciarCarga(c);
  c = receberCarga(c, c.geracao, { dados: { de: 'A nova' } });
  assert.equal(desenhado(c), 'A nova');
});

test('Hoje: primeira entrada com conta null pede a carga uma vez e não laça', () => {
  let c = entrarEmHoje(cargaVazia<Dados>(), null);
  assert.equal(c.conta, null);
  assert.equal(desenhado(c), 'carregando');
  assert.ok(precisaCarregar(c));
  c = iniciarCarga(c);
  // Render de novo (entrarEmHoje com a mesma conta null) não pede outra carga nem descarta a em voo.
  c = entrarEmHoje(c, null);
  assert.ok(!precisaCarregar(c));
  c = receberCarga(c, c.geracao, { dados: { de: 'sem conta' } });
  assert.equal(desenhado(c), 'sem conta');
  assert.ok(!precisaCarregar(entrarEmHoje(c, null)), 'carregada, nada mais a pedir');
});

test('Hoje: conta que muda sem aoAbrir (outra aba) descarta tudo, zera o "ver tudo" e pede nova carga', () => {
  let c = carregada(cargaVazia<Dados>(), 100, 'A');
  c = mostrarTudo(c);
  assert.ok(!precisaCarregar(c), 'carregada e sem entrada nova: nada a pedir');
  // Só o render percebe a conta nova (entrarEmHoje), sem marcarEntrada.
  c = entrarEmHoje(c, 200);
  assert.equal(desenhado(c), 'carregando');
  assert.equal(c.verTudo, false);
  assert.ok(precisaCarregar(c), 'a tela não fica presa em "carregando" sem carga em voo');
  c = iniciarCarga(c);
  c = receberCarga(c, c.geracao, { dados: { de: 'B' } });
  assert.equal(desenhado(c), 'B');
  assert.ok(!precisaCarregar(c), 'sem laço de recarga');
});

test('Hoje: entrar de novo na mesma conta relê sem piscar e fecha o "ver tudo"; a falha da releitura aparece', () => {
  let c = mostrarTudo(carregada(cargaVazia<Dados>(), 100, 'A'));
  c = marcarEntrada(entrarEmHoje(c, 100));
  assert.equal(desenhado(c), 'A');
  assert.equal(c.verTudo, false);
  assert.ok(precisaCarregar(c));
  c = iniciarCarga(c);
  assert.equal(desenhado(c), 'A');
  assert.ok(!precisaCarregar(c));
  c = receberCarga(c, c.geracao, { falha: new Error('rede') });
  assert.equal(desenhado(c), 'falha');
  assert.ok(!precisaCarregar(c), 'falha não reabre carga sozinha (o "Tentar de novo" é do corretor)');
});

test('Hoje: falha com valor falso, ou resposta sem dados, ainda é "falha"', () => {
  for (const falha of [undefined, null, 0, '']) {
    const c = iniciarCarga(entrarEmHoje(cargaVazia<Dados>(), 100));
    assert.equal(desenhado(receberCarga(c, c.geracao, { falha })), 'falha', String(falha));
  }
  const c = iniciarCarga(entrarEmHoje(cargaVazia<Dados>(), 100));
  const vazia = receberCarga(c, c.geracao, { dados: null as unknown as Dados });
  assert.equal(telaDeHoje(vazia), 'falha');
  assert.ok(!precisaCarregar(vazia));
});

test('GET /inicio: com leitura sem escopo do banco, o estado de Hoje ainda é só da conta ativa (A completa, B vazia)', async () => {
  const banco = new BancoFalso(UNICOS);
  // A, completa, com CRECI no perfil do corretor e no jurídico da conta.
  banco.linhas('perfil_conta').push({ id: 1, conta_id: 100, chave: 'conta', nome: 'Imóveis da Ana', creci_juridico: 'J-123' });
  banco.linhas('perfis_corretor').push({ id: 2, conta_id: 100, usuario_id: 1, telefone: '+5561999990000', creci: 'F-123' });
  banco.linhas('canais_sociais').push({ id: 3, conta_id: 100, rede: 'instagram', usuario: 'ana', desconectado_em: null });
  banco.linhas('imoveis').push({ id: 4, conta_id: 100, codigo: 'IM-1', tipo: 'casa', situacao: 'disponivel' });
  banco.linhas('paginas_corretor').push({ id: 5, conta_id: 100, chave: 'conta', endereco: 'ana', publicada_em: new Date().toISOString() });
  // `contas` liga no BancoFalso a leitura de todas as contas (como o SISTEMA) e, com uma conta só, o
  // `escopoDeConta` não restringe: só o filtro de conta do próprio `estadoDaConta` separa A de B. Se ele
  // deixar de escopar, B enxerga as linhas de A e o teste fica vermelho.
  const ver = (ator: Ator) => comServidor(rotas, ator, banco, {}, async (chamar) => (await chamar('GET', '/inicio')).corpo);
  const a = await ver({ usuario: 1, conta: 100, contas: [100], papeis: ['corretor'] });
  assert.equal(a.primeiros_passos.filter((p: any) => p.feito).length, 5, 'o dado de A existe');
  assert.equal(a.sem_creci, false);
  const b = await ver({ usuario: 2, conta: 200, contas: [200], papeis: ['corretor'] });
  assert.equal(b.primeiros_passos.filter((p: any) => p.feito).length, 0);
  assert.equal(b.sem_creci, true);
});

test('GET /inicio: a fila traz proposta recebida, peça aprovada sem data e autorização a vencer; a passagem leva a conversa do Negociador', async () => {
  const banco = new BancoFalso(UNICOS);
  const dia = (d: number) => new Date(Date.now() + d * 86400e3).toISOString().slice(0, 10);
  let ana = 0;
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    ana = (await chamar('POST', '/contatos', { nome: 'Ana', telefone: '61911110001' })).corpo.id;
  });
  banco.linhas('negociacoes').push(
    // Ativa, com a última proposta do comprador esperando resposta: "Proposta recebida" na fila.
    { id: 10, conta_id: 100, codigo: 'NG-0010', contato_id: ana, estado: 'ativa', conduzida_por: 'corretor', atualizado_em: new Date().toISOString() },
    // Passada pelo Negociador: em "Precisa de você", com a conversa que ele atende.
    { id: 11, conta_id: 100, codigo: 'NG-0011', contato_id: ana, estado: 'aguardando_corretor', conduzida_por: 'ia', atualizado_em: new Date().toISOString() },
    // Já respondida pelo vendedor: fora da fila. De outra conta: invisível.
    { id: 12, conta_id: 100, codigo: 'NG-0012', contato_id: ana, estado: 'aguardando_cliente', conduzida_por: 'corretor', atualizado_em: new Date().toISOString() },
    { id: 13, conta_id: 200, codigo: 'NG-0013', contato_id: ana, estado: 'ativa', conduzida_por: 'corretor', atualizado_em: new Date().toISOString() },
  );
  banco.linhas('propostas').push(
    { id: 1, conta_id: 100, negociacao_id: 10, direcao: 'comprador', valor_c: 92000000, estado: 'registrada', criado_em: new Date().toISOString() },
    { id: 2, conta_id: 100, negociacao_id: 12, direcao: 'comprador', valor_c: 1, estado: 'registrada', criado_em: new Date().toISOString() },
    { id: 3, conta_id: 100, negociacao_id: 12, direcao: 'vendedor', valor_c: 2, estado: 'enviada', criado_em: new Date().toISOString() },
    { id: 4, conta_id: 200, negociacao_id: 13, direcao: 'comprador', valor_c: 3, estado: 'registrada', criado_em: new Date().toISOString() },
  );
  banco.linhas('conversas').push({ id: 50, conta_id: 100, contato_id: ana, atendido_por: 'agente', agente: 'negociador', estado: 'aberta', ultima_mensagem_em: new Date().toISOString() });
  banco.linhas('pecas').push(
    { id: 30, conta_id: 100, titulo: 'Lançamento', estado: 'aprovada', agendada_para: null, aprovada_em: new Date().toISOString() },
    { id: 31, conta_id: 100, titulo: 'Agendada', estado: 'aprovada', agendada_para: new Date().toISOString(), aprovada_em: new Date().toISOString() },
    { id: 32, conta_id: 200, titulo: 'De B', estado: 'aprovada', agendada_para: null, aprovada_em: new Date().toISOString() },
  );
  banco.linhas('imoveis').push({ id: 40, conta_id: 100, codigo: 'IM-0040', tipo: 'casa', situacao: 'ativo' });
  banco.linhas('autorizacoes_venda').push(
    { id: 60, conta_id: 100, imovel_id: 40, situacao: 'assinada', inicio: dia(-300), fim: dia(10) },
    { id: 61, conta_id: 100, imovel_id: 40, situacao: 'assinada', inicio: dia(-300), fim: dia(90) },
    { id: 62, conta_id: 100, imovel_id: 40, situacao: 'revogada', inicio: dia(-300), fim: dia(5) },
  );
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    const r = (await chamar('GET', '/inicio')).corpo;
    const tipos = r.fila.map((i: any) => [i.tipo, i.negociacao_id ?? i.peca_id ?? i.imovel_id]);
    assert.deepEqual(tipos, [['proposta_recebida', 10], ['peca_aguardando', 30], ['prazo_autorizacao', 40]]);
    assert.match(r.fila[0].texto, /R\$\s?920\.000/);
    assert.equal(r.fila[0].contato_nome, 'Ana');
    assert.equal(r.fila[1].contato_id, null);
    assert.match(r.fila[2].contato_nome, /IM-0040/);
    assert.match(r.fila[2].texto, /vence em \d{2}\/\d{2}\/\d{4}/);
    assert.deepEqual(r.passagens.map((p: any) => [p.negociacao_id, p.conversa_id, p.motivo]), [[11, 50, 'O Negociador passou a você']]);
    // A dica: a peça aprovada sem data vira a ação "agendar a peça", já validada.
    assert.equal(r.dica.acao?.tipo, 'agendar_peca');
    assert.equal(r.dica.acao?.rota, '/estudio/pecas/30/agendar');
    for (const c of CAMPOS_SIGILOSOS) assert.ok(!JSON.stringify(r).includes(`"${c}"`), `${c} não sai de Hoje`);
  });
  await comServidor(rotas, B, banco, {}, async (chamar) => {
    const r = (await chamar('GET', '/inicio')).corpo;
    // B vê só o que é da conta B: a negociação 13 (a proposta dela) e a peça 32; nada de A.
    assert.deepEqual(r.fila.map((i: any) => [i.tipo, i.negociacao_id ?? i.peca_id]), [['proposta_recebida', 13], ['peca_aguardando', 32]]);
    assert.deepEqual(r.passagens, []);
  });
});
