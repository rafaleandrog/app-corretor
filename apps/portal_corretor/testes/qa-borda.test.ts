import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Request, Response } from 'express';
import { rotas, webhooks } from '../backend/rotas';
import { temByteNulo } from '../backend/acesso';
import { validarContato, validarEtapas } from '../comum/crm';
import { enderecoEmTexto, validarAutorizacao } from '../comum/imoveis';
import { BancoFalso, comServidor, type Ator } from './apoio';

// Achados do QA na instância (12/11): issues #229 (500 em entrada de borda), #230 (etapas do funil)
// e #231 (endereço como "[object Object]").

const UNICOS = { contatos: ['telefone'], etapas_funil: ['pipeline+nome'], origens: ['canal+campanha'] };
const A: Ator = { usuario: 1, conta: 100, papeis: ['corretor'] };

test('#229: data que não existe na autorização é recusada, não chega ao banco', () => {
  const base = { proprietario_id: 1, comissao_pct: 5, preco_autorizado: 900000, fim: '2027-01-31' };
  for (const inicio of ['2026-02-31', '2026-04-31', '2027-02-29', '0000-01-01']) {
    const v = validarAutorizacao({ ...base, inicio });
    assert.equal(v.ok, false, inicio);
    if (!v.ok) assert.ok(v.erros.some((e) => /Início: data inválida/.test(e)), inicio);
  }
  const fim = validarAutorizacao({ fim: '2027-02-31' }, true);
  assert.equal(fim.ok, false);
  assert.equal(validarAutorizacao({ inicio: '2028-02-29' }, true).ok, true, 'ano bissexto vale');
});

test('#229: linha da importação que não é objeto vira rejeitada, sem derrubar o lote', async () => {
  for (const bruta of ['abc', 5, [1, 2], true]) assert.equal(validarContato(bruta as never).ok, false);
  const banco = new BancoFalso(UNICOS);
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    const r = await chamar('POST', '/contatos/importar', { linhas: [{ nome: 'qa-v6a', telefone: '61990000001' }, 'abc', 7], modo: 'pular' });
    assert.equal(r.status, 200);
    assert.equal(r.corpo.rejeitados.length, 2);
    assert.equal(banco.linhas('contatos').length, 1);
  });
});

test('#229: byte nulo no corpo ou na query responde 422 nas rotas e nos webhooks', async () => {
  assert.equal(temByteNulo({ nome: 'qa\u0000nul' }), true);
  assert.equal(temByteNulo({ nome: 'qa', lista: ['a', { b: 'c\u0000' }] }), true);
  assert.equal(temByteNulo({ nome: 'qa \\u0000 escrito' }), false, 'a barra escrita pelo usuário não é byte nulo');
  assert.equal(temByteNulo(undefined, {}), false);
  const banco = new BancoFalso(UNICOS);
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    const r = await chamar('POST', '/contatos', { nome: 'qa\u0000nul', telefone: '61990000002' });
    assert.deepEqual([r.status, r.corpo.codigo], [422, 'TEXTO_INVALIDO']);
    assert.equal((await chamar('GET', '/contatos?busca=%00')).status, 422);
    assert.equal(banco.linhas('contatos').length, 0);
  });
  // Webhook: recusa antes de publicar o evento.
  let status = 0;
  let publicou = false;
  const res = { status: (s: number) => ((status = s), res), json: () => res } as unknown as Response;
  const req = { body: { nome: 'qa\u0000', telefone: '61990000003' }, eventos: { publicar: async () => (publicou = true) } } as unknown as Request;
  await webhooks.formulario_lead(req, res);
  assert.deepEqual([status, publicou], [422, false]);
});

test('#230: etapa com negócio aberto não sai do funil e não troca de tipo; id em texto não duplica', async () => {
  const banco = new BancoFalso(UNICOS);
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    await chamar('POST', '/funil/preparar', {});
    const etapas = (await chamar('GET', '/funil/etapas?pipeline=compra')).corpo.etapas;
    const c = (await chamar('POST', '/contatos', { nome: 'qa-funil', telefone: '61990000004' })).corpo;
    const n = (await chamar('POST', '/negocios', { contato_id: c.id })).corpo;
    const daEtapa = etapas.find((e: any) => e.id === n.etapa_id);

    // Tirar a etapa do negócio: recusado, com o nome da etapa no detalhe.
    const semEla = etapas.filter((e: any) => e.id !== daEtapa.id);
    const tirar = await chamar('PUT', '/funil/etapas/compra', { etapas: semEla });
    assert.deepEqual([tirar.status, tirar.corpo.codigo], [422, 'ETAPA_COM_NEGOCIOS']);
    assert.match(tirar.corpo.detalhes[0], new RegExp(daEtapa.nome));

    // Trocar o tipo dela: recusado (ganho_em/perdido_em ficariam incoerentes).
    const ganha = etapas.find((e: any) => e.tipo === 'ganha');
    const trocada = etapas.map((e: any) => (e.id === daEtapa.id ? { ...e, tipo: 'ganha' } : e.id === ganha.id ? { ...e, tipo: 'aberta' } : e));
    assert.equal((await chamar('PUT', '/funil/etapas/compra', { etapas: trocada })).status, 422);

    // Id como texto numérico vale como o mesmo id; id que não é número é recusado.
    const total = banco.linhas('etapas_funil').length;
    const comTexto = etapas.map((e: any) => ({ ...e, id: String(e.id) }));
    assert.equal((await chamar('PUT', '/funil/etapas/compra', { etapas: comTexto })).status, 200);
    assert.equal(banco.linhas('etapas_funil').length, total, 'nenhuma etapa nova');
    assert.ok(banco.linhas('etapas_funil').every((e) => e.ativa !== false), 'nenhuma desativada');
    assert.equal(validarEtapas('compra', etapas.map((e: any, i: number) => (i === 0 ? { ...e, id: 'abc' } : e))).ok, false);

    // Etapa sem negócio sai normalmente; mover negócio para ela depois é recusado.
    const vazia = etapas.find((e: any) => e.tipo === 'aberta' && e.id !== daEtapa.id);
    assert.equal((await chamar('PUT', '/funil/etapas/compra', { etapas: etapas.filter((e: any) => e.id !== vazia.id) })).status, 200);
    const mover = await chamar('PATCH', `/negocios/${n.id}`, { etapa_id: vazia.id });
    assert.deepEqual([mover.status, mover.corpo.codigo], [422, 'ETAPA_INATIVA']);
  });
});

test('#230: negócio que já estava numa etapa inativa continua com coluna no quadro', async () => {
  const banco = new BancoFalso(UNICOS);
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    await chamar('POST', '/funil/preparar', {});
    const c = (await chamar('POST', '/contatos', { nome: 'qa-quadro', telefone: '61990000005' })).corpo;
    const n = (await chamar('POST', '/negocios', { contato_id: c.id })).corpo;
    // Dado de antes da correção: a etapa foi desativada com o negócio dentro.
    const etapa = banco.linhas('etapas_funil').find((e) => e.id === n.etapa_id)!;
    etapa.ativa = false;
    const q = (await chamar('GET', '/funil/quadro?pipeline=compra')).corpo;
    const coluna = q.etapas.find((e: any) => e.id === n.etapa_id);
    assert.ok(coluna, 'a etapa inativa com negócio aparece');
    assert.ok(q.negocios.some((x: any) => x.id === n.id));
    const finais = q.etapas.findIndex((e: any) => e.tipo !== 'aberta');
    assert.ok(q.etapas.indexOf(coluna) < finais, 'antes das etapas de ganho e perda');
  });
});

test('#231: endereço do imóvel sai em texto no que é publicado', () => {
  assert.equal(enderecoEmTexto({ logradouro: 'SQN 211 Bloco C', numero: '304', complemento: 'apto 304', cep: '70863-030' }), 'SQN 211 Bloco C, 304 - apto 304 - CEP 70863-030');
  assert.equal(enderecoEmTexto({ logradouro: 'Rua X' }), 'Rua X');
  assert.equal(enderecoEmTexto('SQNW 111 Bloco C'), 'SQNW 111 Bloco C');
  assert.equal(enderecoEmTexto({}), null);
  assert.equal(enderecoEmTexto(null), null);
  assert.equal(enderecoEmTexto(['a']), null);
});
