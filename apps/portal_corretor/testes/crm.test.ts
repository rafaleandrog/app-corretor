import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rotas } from '../backend/rotas';
import { normalizarPapeis, reaisParaCentavos, validarEtapas, ETAPAS_PADRAO } from '../comum/crm';
import { gerarCsv, lerCsv, sugerirMapeamento } from '../comum/csv';
import { BancoFalso, comServidor, type Ator } from './apoio';

const UNICOS = { contatos: ['telefone'], etapas_funil: [] as string[] };
const A: Ator = { usuario: 1, conta: 100, papeis: ['corretor'] };
const B: Ator = { usuario: 2, conta: 200, papeis: ['corretor'] };

test('regras puras: papéis, dinheiro, etapas e CSV', () => {
  assert.deepEqual(normalizarPapeis('Proprietário, comprador; nada'), ['comprador', 'proprietario']);
  assert.equal(reaisParaCentavos('1.234,56'), 123456);
  assert.equal(reaisParaCentavos(850000), 85000000);
  assert.ok(Number.isNaN(reaisParaCentavos('abc')));
  assert.equal(validarEtapas('compra', ETAPAS_PADRAO.filter((e) => e.pipeline === 'compra')).ok, true);
  assert.equal(validarEtapas('compra', [{ nome: 'Só', tipo: 'aberta', probabilidade: 0.5 }]).ok, false);
  assert.deepEqual(lerCsv('nome;telefone\n"Silva; Ana";61 9999\n\n'), [['nome', 'telefone'], ['Silva; Ana', '61 9999']]);
  assert.deepEqual(lerCsv('a,b\r\n"x ""y""",2'), [['a', 'b'], ['x "y"', '2']]);
  assert.equal(gerarCsv(['N'], [['=SOMA(1)'], ['a;b']]), '﻿N\r\n\'=SOMA(1)\r\n"a;b"\r\n');
  assert.deepEqual(sugerirMapeamento(['Nome do cliente', 'Celular', 'E-mail']), { nome: 0, telefone: 1, email: 2, papeis: null, observacoes: null });
});

test('etapas do funil nascem com o padrão e a configuração é validada', async () => {
  const banco = new BancoFalso(UNICOS);
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    const r = await chamar('GET', '/funil/etapas?pipeline=compra');
    assert.equal(r.corpo.etapas.length, 9);
    assert.equal((await chamar('GET', '/funil/etapas')).corpo.etapas.length, 16);
    const semGanho = r.corpo.etapas.filter((e: any) => e.tipo !== 'ganha');
    assert.equal((await chamar('PUT', '/funil/etapas/compra', { etapas: semGanho })).status, 422);
    // Tirar "Qualificado" e renomear "Novo": a tirada fica inativa, nada é apagado.
    const nova = r.corpo.etapas.filter((e: any) => e.nome !== 'Qualificado').map((e: any) => (e.nome === 'Novo' ? { ...e, nome: 'Lead' } : e));
    const salvo = await chamar('PUT', '/funil/etapas/compra', { etapas: nova });
    assert.equal(salvo.status, 200);
    const ativas = salvo.corpo.etapas.filter((e: any) => e.ativa);
    assert.equal(ativas.length, 8);
    assert.equal(ativas[0].nome, 'Lead');
  });
  assert.equal(banco.linhas('etapas_funil').length, 16);
});

test('contato: cria, recusa telefone duplicado e edita só o que veio', async () => {
  const banco = new BancoFalso(UNICOS);
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    const c = await chamar('POST', '/contatos', { nome: 'Ana', telefone: '(61) 99999-0000', papeis: 'comprador', origem_canal: 'instagram' });
    assert.equal(c.status, 201);
    assert.equal(c.corpo.telefone, '+5561999990000');
    const dup = await chamar('POST', '/contatos', { nome: 'Outra Ana', telefone: '61999990000' });
    assert.equal(dup.status, 409);
    assert.equal(dup.corpo.codigo, 'DUPLICATA');
    assert.equal((await chamar('POST', '/contatos', { nome: 'Sem meio de contato' })).status, 422);
    const ed = await chamar('PATCH', `/contatos/${c.corpo.id}`, { proximo_passo: 'Ligar', proximo_passo_em: '2026-11-01T12:00:00Z' });
    assert.equal(ed.corpo.nome, 'Ana');
    assert.equal(ed.corpo.proximo_passo, 'Ligar');
    const lista = await chamar('GET', '/contatos?busca=ana&papel=comprador');
    assert.equal(lista.corpo.total, 1);
  });
  assert.equal(banco.linhas('origens').length, 1);
  assert.equal(banco.linhas('linha_do_tempo').length, 2);
});

test('negócio: abre na primeira etapa, perder exige motivo e vai para a linha do tempo', async () => {
  const banco = new BancoFalso(UNICOS);
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    const c = (await chamar('POST', '/contatos', { nome: 'Bruno', telefone: '61988887777' })).corpo;
    const n = await chamar('POST', '/negocios', { contato_id: c.id, valor_estimado: '650.000,00' });
    assert.equal(n.status, 201);
    assert.equal(n.corpo.valor_estimado_c, 65000000);
    const etapas = (await chamar('GET', '/funil/etapas?pipeline=compra')).corpo.etapas;
    assert.equal(n.corpo.etapa_id, etapas[0].id);
    const perdido = etapas.find((e: any) => e.tipo === 'perdida');
    assert.equal((await chamar('PATCH', `/negocios/${n.corpo.id}`, { etapa_id: perdido.id })).status, 422);
    const ok = await chamar('PATCH', `/negocios/${n.corpo.id}`, { etapa_id: perdido.id, motivo_perda: 'preco' });
    assert.equal(ok.status, 200);
    assert.ok(ok.corpo.perdido_em);
    const venda = (await chamar('GET', '/funil/etapas?pipeline=venda_captacao')).corpo.etapas[0];
    assert.equal((await chamar('PATCH', `/negocios/${n.corpo.id}`, { etapa_id: venda.id })).status, 422);
    const ficha = await chamar('GET', `/contatos/${c.id}`);
    assert.ok(ficha.corpo.linha_do_tempo.some((l: any) => l.tipo === 'negocio.etapa_mudou'));
  });
});

test('contato com negócio aberto não é removido; sem negócio aberto, sai da lista', async () => {
  const banco = new BancoFalso(UNICOS);
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    const c = (await chamar('POST', '/contatos', { nome: 'Carla', email: 'carla@x.com' })).corpo;
    const n = (await chamar('POST', '/negocios', { contato_id: c.id })).corpo;
    assert.equal((await chamar('PATCH', `/contatos/${c.id}/remover`)).status, 409);
    await chamar('PATCH', `/negocios/${n.id}/remover`);
    assert.equal((await chamar('PATCH', `/contatos/${c.id}/remover`)).status, 200);
    assert.equal((await chamar('GET', `/contatos/${c.id}`)).status, 404);
    assert.equal((await chamar('GET', '/contatos')).corpo.total, 0);
  });
});

test('atividade ligada ao contato; concluir atualiza o último contato', async () => {
  const banco = new BancoFalso(UNICOS);
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    const c = (await chamar('POST', '/contatos', { nome: 'Davi', telefone: '61977776666' })).corpo;
    banco.linhas('contatos')[0].ultimo_contato_em = '2020-01-01T00:00:00.000Z';
    assert.equal((await chamar('GET', '/contatos?parado_dias=30')).corpo.total, 1);
    const a = await chamar('POST', '/atividades', { tipo: 'visita', titulo: 'Visita apto', quando: '2026-11-02T13:00:00Z', contato_id: c.id });
    assert.equal(a.status, 201);
    assert.equal((await chamar('POST', '/atividades', { tipo: 'voo', titulo: 'x', quando: 'amanhã' })).status, 422);
    const ag = await chamar('GET', '/atividades?status=pendente');
    assert.equal(ag.corpo.total, 1);
    await chamar('PATCH', `/atividades/${a.corpo.id}`, { status: 'feita' });
    assert.ok(banco.linhas('contatos')[0].ultimo_contato_em > '2026-01-01');
    assert.equal((await chamar('GET', '/contatos?parado_dias=30')).corpo.total, 0);
  });
});

test('importação: cria, pula ou completa duplicatas e relata rejeitadas', async () => {
  const banco = new BancoFalso(UNICOS);
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    await chamar('POST', '/contatos', { nome: 'Eva', telefone: '61966665555' });
    const linhas = [
      { nome: 'Eva Planilha', telefone: '61 96666-5555', email: 'eva@x.com' },
      { nome: 'Fábio', telefone: '61955554444', papeis: 'proprietário' },
      { nome: '', telefone: '' },
    ];
    const pular = await chamar('POST', '/contatos/importar', { linhas, modo: 'pular', arquivo: 'base.csv' });
    assert.deepEqual({ ...pular.corpo, rejeitados: pular.corpo.rejeitados.length }, { criados: 1, unidos: 0, pulados: 1, rejeitados: 1 });
    const completar = await chamar('POST', '/contatos/importar', { linhas: linhas.slice(0, 1), modo: 'atualizar_vazios' });
    assert.equal(completar.corpo.unidos, 1);
  });
  const eva = banco.linhas('contatos').find((c) => c.telefone === '+5561966665555')!;
  assert.equal(eva.nome, 'Eva');
  assert.equal(eva.email, 'eva@x.com');
  assert.equal(banco.linhas('contatos').find((c) => c.nome === 'Fábio')!.papeis, 'proprietario');
});

test('exportação sai em CSV com separador ponto e vírgula', async () => {
  const banco = new BancoFalso(UNICOS);
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    await chamar('POST', '/contatos', { nome: 'Gil; Junior', telefone: '61944443333' });
  });
  const { default: express } = await import('express');
  const app = express();
  app.use((req, _res, next) => {
    (req as any).contexto = { usuario: { id: 1 }, rolesApp: ['corretor'], resolucao: 'escopado', fuso: 'America/Sao_Paulo' };
    (req as any).dados = banco.dados(100);
    next();
  });
  app.use(rotas);
  const servidor = app.listen(0);
  try {
    const r = await fetch(`http://127.0.0.1:${(servidor.address() as { port: number }).port}/contatos/exportar`);
    assert.match(r.headers.get('content-type') ?? '', /text\/csv/);
    // Bytes crus: o text() do fetch descarta o BOM, que o Excel precisa para ler os acentos.
    const bytes = new Uint8Array(await r.arrayBuffer());
    assert.deepEqual([...bytes.slice(0, 3)], [0xef, 0xbb, 0xbf]);
    const texto = new TextDecoder().decode(bytes);
    assert.ok(texto.startsWith('Nome;Telefone;E-mail'));
    assert.ok(texto.includes('"Gil; Junior";+5561944443333'));
  } finally {
    servidor.close();
  }
});

test('isolamento do CRM: o corretor B não abre, não edita e não move nada do A', async () => {
  const banco = new BancoFalso(UNICOS);
  let contatoA = 0;
  let negocioA = 0;
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    contatoA = (await chamar('POST', '/contatos', { nome: 'Cliente de A', telefone: '61933332222' })).corpo.id;
    negocioA = (await chamar('POST', '/negocios', { contato_id: contatoA })).corpo.id;
  });
  await comServidor(rotas, B, banco, {}, async (chamar) => {
    assert.equal((await chamar('GET', `/contatos/${contatoA}`)).status, 404);
    assert.equal((await chamar('PATCH', `/contatos/${contatoA}`, { nome: 'Invadido' })).status, 404);
    assert.equal((await chamar('PATCH', `/negocios/${negocioA}`, { titulo: 'x' })).status, 404);
    assert.equal((await chamar('POST', '/negocios', { contato_id: contatoA })).status, 422);
    assert.equal((await chamar('POST', '/atividades', { titulo: 'x', quando: '2026-11-01T10:00:00Z', contato_id: contatoA })).status, 422);
    assert.equal((await chamar('GET', '/contatos')).corpo.total, 0);
    // B pode ter um contato com o mesmo telefone: a unicidade é por conta.
    assert.equal((await chamar('POST', '/contatos', { nome: 'Cliente de B', telefone: '61933332222' })).status, 201);
  });
  assert.equal(banco.linhas('contatos').find((c) => c.id === contatoA)!.nome, 'Cliente de A');
});

test('equipe da plataforma não alcança o CRM', async () => {
  await comServidor(rotas, { usuario: 9, conta: null, papeis: ['operacao'] }, new BancoFalso(UNICOS), {}, async (chamar) => {
    assert.equal((await chamar('GET', '/contatos')).status, 403);
    assert.equal((await chamar('GET', '/funil/etapas')).status, 403);
  });
});
