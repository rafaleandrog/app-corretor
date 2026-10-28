import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { rotas } from '../backend/rotas';
import { ORDEM_FILA } from '../comum/funil';
import { ACOES_FILA, dicaDoAssistente, PASSOS_INICIAIS, primeirosPassos, TIPO_NA_FILA } from '../comum/hoje';
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

test('fila: todo tipo tem chip e exatamente um botão principal, no máximo um no "Mais"', () => {
  assert.deepEqual(Object.keys(ACOES_FILA).sort(), [...ORDEM_FILA].sort());
  assert.deepEqual(Object.keys(TIPO_NA_FILA).sort(), [...ORDEM_FILA].sort());
  for (const [tipo, a] of Object.entries(ACOES_FILA)) {
    assert.equal(typeof a.principal, 'string', tipo);
    assert.notEqual(a.principal, a.secundaria, `${tipo}: o secundário não repete o principal`);
  }
  // A tela usa a regra e o `acoesComMais` (um botão; o resto no "Mais"), sem botão principal solto no cartão.
  const tela = raiz('frontend/telas/inicio.ts');
  assert.match(tela, /ACOES_FILA\[i\.tipo\]/);
  assert.match(tela, /acoesComMais\(acaoDe\(regra\.principal/);
});

test('Dica do Assistente: concreta, a partir do que a tela tem', () => {
  const passos = primeirosPassos({ conta: true, telefone: true, instagram: false, imovel: true, pagina: true });
  assert.match(dicaDoAssistente([{ tipo: 'quente_sem_resposta' }, { tipo: 'quente_sem_resposta' }], passos), /^2 clientes quentes/);
  assert.match(dicaDoAssistente([{ tipo: 'abordagem_vencida' }], passos), /uma abordagem atrasada/);
  assert.match(dicaDoAssistente([], passos), /conectar o instagram/);
  assert.match(dicaDoAssistente([], primeirosPassos({ conta: true, telefone: true, instagram: true, imovel: true, pagina: true })), /Nada urgente/);
});

test('Hoje entra na moldura do Padrão B e relê os dados a cada entrada', () => {
  const indice = raiz('frontend/index.ts');
  assert.match(indice, /hoje: \{ titulo: 'Hoje', papel: 'corretor', moldura: true, aoAbrir: aoAbrirHoje/);
  assert.match(raiz('frontend/telas/inicio.ts'), /moldura\(\{ menu: '\/', lista: esquerda/);
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
    assert.deepEqual(r.passagens, [{ negociacao_id: 900, codigo: 'NG-0001', contato_id: contatoA, contato_nome: 'Juliana', motivo: 'A negociação espera a sua decisão' }]);
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
