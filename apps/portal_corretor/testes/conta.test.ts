import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizarTelefone, validarConfiguracoes, validarMeuPerfil, validarPerfilConta } from '../comum/conta';
import { aoIniciar, ehContaDemo, levarTemaParaMarca, semear } from '../backend/semente';
import { TEMAS } from '../comum/pagina';
import { BancoFalso } from './apoio';

test('CRECI e telefone são normalizados e validados', () => {
  const ok = validarMeuPerfil({ creci: ' df-12345-f ', telefone: '(61) 99999-0000' });
  assert.deepEqual(ok, { ok: true, dados: { creci: 'DF-12345-F', telefone: '+5561999990000' } });
  assert.equal(normalizarTelefone('+1 415 555 0100'), '+14155550100');
  assert.equal(normalizarTelefone('5561999990000'), '+5561999990000');
  const ruim = validarMeuPerfil({ creci: '12345', telefone: '12' });
  assert.equal(ruim.ok, false);
  assert.equal(validarMeuPerfil({}).ok, true);
});

test('perfil da conta exige nome e tipo conhecido', () => {
  assert.equal(validarPerfilConta({ nome: '  ' }).ok, false);
  assert.equal(validarPerfilConta({ nome: 'A', tipo: 'banco' }).ok, false);
  const r = validarPerfilConta({ nome: ' Marina ' });
  assert.ok(r.ok && r.dados.nome === 'Marina' && r.dados.tipo === 'corretor_autonomo');
});

test('configurações respeitam as faixas do schema', () => {
  const base = { prazo_primeiro_atendimento_min: 5, dias_cliente_parado: 7, validade_selecao_dias: 14 };
  assert.equal(validarConfiguracoes(base).ok, true);
  assert.equal(validarConfiguracoes({ ...base, prazo_primeiro_atendimento_min: 0 }).ok, false);
  assert.equal(validarConfiguracoes({ ...base, validade_selecao_dias: 2.5 }).ok, false);
  // Sem aprovação por janela (D-86): o modo antigo, se vier de tela em cache, é ignorado e não é gravado.
  const antigo = validarConfiguracoes({ ...base, modo_aprovacao_conteudo: 'janela', janela_aprovacao_horas: 12 });
  assert.ok(antigo.ok && !('modo_aprovacao_conteudo' in antigo.dados) && !('janela_aprovacao_horas' in antigo.dados));
  assert.equal(validarConfiguracoes({ ...base, dias_cliente_parado: '10' }).ok, true);
});

test('semente só toca contas "(demo)" e é idempotente', async () => {
  const banco = new BancoFalso({ perfil_conta: ['chave'], configuracoes_conta: ['chave'] });
  const contas = [
    { id: 1, nome: 'Marina (demo)' },
    { id: 2, nome: 'Corretor real' },
  ];
  assert.equal(ehContaDemo('Marina (Demo) '), true);
  assert.equal(await semear(banco.ctxSistema(contas)), 1);
  await semear(banco.ctxSistema(contas));
  assert.equal(banco.linhas('perfil_conta').length, 1);
  assert.equal(banco.linhas('perfil_conta')[0].nome, 'Marina');
  assert.equal(banco.linhas('perfil_conta')[0].conta_id, 1);
  assert.equal(banco.linhas('configuracoes_conta').length, 1);
});

// Marca única (D-85): a cor do tema da Minha Página vai para a marca no boot, sem migração.
const UNICOS_MARCA = { perfil_conta: ['chave'], configuracoes_conta: ['chave'], marca_conta: ['chave'] };
const pagina = (id: number, conta_id: number, tema: string) => ({ id, conta_id, chave: 'conta', endereco: `p${conta_id}`, tema });
const marcaDa = (banco: BancoFalso, conta: number) => banco.linhas('marca_conta').filter((l) => l.conta_id === conta);

test('tema da página vai para a marca: só sem marca, só fora do padrão, só na própria conta, e idempotente', async () => {
  const banco = new BancoFalso(UNICOS_MARCA);
  const contas = [
    { id: 100, nome: 'Vinho sem marca' },
    { id: 200, nome: 'Vinho com marca' },
    { id: 300, nome: 'Oceano' },
    { id: 400, nome: 'Sem página' },
    { id: 500, nome: 'Tema desconhecido' },
    { id: 600, nome: 'Mata sem marca' },
  ];
  banco.linhas('paginas_corretor').push(pagina(1, 100, 'vinho'), pagina(2, 200, 'vinho'), pagina(3, 300, 'oceano'), pagina(4, 500, 'neon'), pagina(5, 600, 'mata'));
  banco.linhas('marca_conta').push({ id: 1, conta_id: 200, chave: 'conta', cor_primaria: '#123456', cor_secundaria: '#f2b705', estilo: 'classico' });

  assert.equal(await levarTemaParaMarca(banco.ctxSistema(contas)), 2);
  // Vinho sem marca ganha a cor do vinho, com o resto da marca no padrão.
  assert.deepEqual(marcaDa(banco, 100).map((l) => [l.chave, l.cor_primaria, l.cor_secundaria, l.estilo]), [['conta', TEMAS.vinho.cor, '#f2b705', 'moderno']]);
  // Marca salva fica intacta, sem linha a mais.
  assert.deepEqual(marcaDa(banco, 200).map((l) => [l.cor_primaria, l.estilo]), [['#123456', 'classico']]);
  // Oceano (= azul padrão), sem página e tema desconhecido: nada criado.
  assert.deepEqual([300, 400, 500].map((c) => marcaDa(banco, c).length), [0, 0, 0]);
  // Duas contas: a cor de uma nunca vai para a outra (vinho em 100, mata em 600).
  assert.deepEqual(marcaDa(banco, 600).map((l) => l.cor_primaria), [TEMAS.mata.cor]);
  assert.equal(banco.linhas('marca_conta').length, 3);

  const antes = JSON.stringify([...banco.tabelas]);
  assert.equal(await levarTemaParaMarca(banco.ctxSistema(contas)), 0);
  assert.equal(JSON.stringify([...banco.tabelas]), antes, 'segunda execução não muda nada');
});

test('aoIniciar: falha numa conta não impede as outras, nem a semente impede a marca (e vice-versa); o hook avisa no fim', async () => {
  const banco = new BancoFalso(UNICOS_MARCA);
  const contas = [
    { id: 1, nome: 'Quebrada (demo)' },
    { id: 2, nome: 'Boa (demo)' },
    { id: 3, nome: 'Marca quebrada' },
    { id: 4, nome: 'Marca boa' },
  ];
  banco.linhas('paginas_corretor').push(pagina(1, 1, 'vinho'), pagina(2, 2, 'mata'), pagina(3, 3, 'grafite'), pagina(4, 4, 'terracota'));
  const ctx = banco.ctxSistema(contas);
  const comConta = ctx.dados.comConta;
  ctx.dados.comConta = async (id: number, fn: any) => {
    if (id === 1) throw new Error('conta inativa');
    return comConta(id, async (trx: any) => {
      if (id === 3) trx.criar = async () => { throw new Error('banco fora'); };
      return fn(trx);
    });
  };
  await assert.rejects(async () => aoIniciar(ctx), (e: Error) =>
    /Semente incompleta — Quebrada \(demo\): conta inativa/.test(e.message) &&
    /Quebrada \(demo\): conta inativa; Marca quebrada: banco fora/.test(e.message.split(' | ')[1]));
  // A semente demo rodou na conta boa, e a marca foi levada nas contas boas.
  assert.deepEqual(banco.linhas('perfil_conta').map((l) => [l.conta_id, l.nome]), [[2, 'Boa']]);
  assert.deepEqual(banco.linhas('marca_conta').map((l) => [l.conta_id, l.cor_primaria]), [[2, TEMAS.mata.cor], [4, TEMAS.terracota.cor]]);
});
