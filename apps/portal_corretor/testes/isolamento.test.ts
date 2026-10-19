import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Router } from 'express';
import { assincrono } from '../backend/acesso';
import { rotas } from '../backend/rotas';
import { BancoFalso, comServidor, type Ator } from './apoio';

// Teste de isolamento do bloco 1 (spec 4.5, plano R.2): roda em todo PR. Dois corretores em contas
// distintas, a equipe da plataforma e um usuário sem papel. Cada um só alcança o que deve.
const UNICOS = { perfil_conta: ['chave'], configuracoes_conta: ['chave'], perfis_corretor: ['usuario_id'] };
const A: Ator = { usuario: 1, conta: 100, papeis: ['corretor'] };
const B: Ator = { usuario: 2, conta: 200, papeis: ['corretor'] };
const EQUIPE: Ator = { usuario: 9, conta: null, papeis: ['operacao'] };
const SEM_PAPEL: Ator = { usuario: 7, conta: 300, papeis: [] };
const semShell = {};

test('corretor B não vê a conta, o perfil nem as configurações do corretor A', async () => {
  const banco = new BancoFalso(UNICOS);
  await comServidor(rotas, A, banco, semShell, async (chamar) => {
    assert.equal((await chamar('PUT', '/conta/perfil', { nome: 'Marina Imóveis' })).status, 200);
    assert.equal((await chamar('PUT', '/conta/meu-perfil', { creci: 'df-12345-f', telefone: '(61) 99999-0000' })).status, 200);
    const cfg = { prazo_primeiro_atendimento_min: 3, dias_cliente_parado: 5, validade_selecao_dias: 10, modo_aprovacao_conteudo: 'janela', janela_aprovacao_horas: 12 };
    assert.equal((await chamar('PUT', '/conta/configuracoes', cfg)).status, 200);
  });
  await comServidor(rotas, B, banco, semShell, async (chamar) => {
    const r = await chamar('GET', '/conta');
    assert.equal(r.status, 200);
    assert.equal(r.corpo.perfil, null);
    assert.equal(r.corpo.meu_perfil.creci, null);
    assert.equal(r.corpo.configuracoes.padrao, true);
  });
  await comServidor(rotas, A, banco, semShell, async (chamar) => {
    const r = await chamar('GET', '/conta');
    assert.equal(r.corpo.perfil.nome, 'Marina Imóveis');
    assert.equal(r.corpo.meu_perfil.creci, 'DF-12345-F');
    assert.equal(r.corpo.meu_perfil.telefone, '+5561999990000');
    assert.equal(r.corpo.configuracoes.prazo_primeiro_atendimento_min, 3);
  });
  // Toda linha gravada ficou carimbada com a conta de A; nenhuma escrita foi parar em B.
  for (const linhas of banco.tabelas.values()) for (const l of linhas) assert.equal(l.conta_id, 100);
});

test('o perfil gravado é sempre o do usuário logado, mesmo se o corpo mandar outro usuario_id', async () => {
  const banco = new BancoFalso(UNICOS);
  await comServidor(rotas, A, banco, semShell, async (chamar) => {
    await chamar('PUT', '/conta/meu-perfil', { usuario_id: 999, creci: 'SP-1-J' });
  });
  const perfis = banco.linhas('perfis_corretor');
  assert.equal(perfis.length, 1);
  assert.equal(perfis[0].usuario_id, 1);
});

test('o corpo não consegue escrever conta_id nem situação do CRECI', async () => {
  const banco = new BancoFalso(UNICOS);
  await comServidor(rotas, A, banco, semShell, async (chamar) => {
    await chamar('PUT', '/conta/perfil', { nome: 'X', conta_id: 200 });
    await chamar('PUT', '/conta/meu-perfil', { creci: 'DF-1-F', creci_situacao: 'verificado' });
  });
  assert.equal(banco.linhas('perfil_conta')[0].conta_id, 100);
  assert.equal(banco.linhas('perfis_corretor')[0].creci_situacao, undefined);
});

test('cada papel só abre a própria área', async () => {
  const banco = new BancoFalso(UNICOS);
  await comServidor(rotas, SEM_PAPEL, banco, semShell, async (chamar) => {
    assert.equal((await chamar('GET', '/conta')).status, 403);
    assert.equal((await chamar('GET', '/equipe/convites')).status, 403);
  });
  await comServidor(rotas, A, banco, semShell, async (chamar) => {
    assert.equal((await chamar('GET', '/equipe/convites')).status, 403);
    assert.equal((await chamar('POST', '/equipe/convites', { email: 'x@y.com', conta: 'X' })).status, 403);
  });
  await comServidor(rotas, EQUIPE, banco, { externos: { listarConvites: async () => ({ convites: [], total: 0 }) } }, async (chamar) => {
    assert.equal((await chamar('GET', '/conta')).status, 403);
    assert.equal((await chamar('PUT', '/conta/perfil', { nome: 'Invasão' })).status, 403);
    assert.equal((await chamar('GET', '/equipe/convites')).status, 200);
  });
  assert.equal(banco.linhas('perfil_conta').length, 0);
});

test('corretor sem conta resolvida recebe explicação, não formulário vazio', async () => {
  await comServidor(rotas, { usuario: 5, conta: null, papeis: ['corretor'] }, new BancoFalso(UNICOS), semShell, async (chamar) => {
    const r = await chamar('GET', '/conta');
    assert.equal(r.status, 409);
    assert.equal(r.corpo.codigo, 'SEM_CONTA');
  });
});

test('admin do app alcança as áreas de todos os papéis, mesmo sem papel atribuído', async () => {
  const admin: Ator = { usuario: 8, conta: 100, papeis: [], nivel: 'admin' };
  await comServidor(rotas, admin, new BancoFalso(UNICOS), { externos: { listarConvites: async () => ({ convites: [], total: 0 }) } }, async (chamar) => {
    assert.equal((await chamar('GET', '/conta')).status, 200);
    assert.equal((await chamar('GET', '/equipe/convites')).status, 200);
  });
});

test('conta não informada (várias contas, sem X-Conta) diz o que fazer', async () => {
  const roteador = Router();
  roteador.get('/x', assincrono(async () => {
    throw Object.assign(new Error('Escrita em tabela segregada exige conta destino inequívoca'), { codigo: 'CONTA_NAO_INFORMADA', status: 400 });
  }));
  await comServidor(roteador, A, new BancoFalso(UNICOS), semShell, async (chamar) => {
    const r = await chamar('GET', '/x');
    assert.equal(r.status, 400);
    assert.equal(r.corpo.codigo, 'CONTA_NAO_INFORMADA');
    assert.match(r.corpo.mensagem, /seletor/);
  });
});

test('quem atende várias contas só enxerga e só mexe na conta ativa', async () => {
  const banco = new BancoFalso(UNICOS);
  await comServidor(rotas, A, banco, semShell, async (chamar) => {
    assert.equal((await chamar('POST', '/contatos', { nome: 'Ana da 100', telefone: '(61) 99999-0001' })).status, 201);
  });
  await comServidor(rotas, B, banco, semShell, async (chamar) => {
    assert.equal((await chamar('POST', '/contatos', { nome: 'Bia da 200', telefone: '(61) 99999-0002' })).status, 201);
  });
  const atendente: Ator = { usuario: 8, conta: 100, contas: [100, 200], papeis: ['corretor'] };
  await comServidor(rotas, atendente, banco, semShell, async (chamar) => {
    const r = await chamar('GET', '/contatos');
    assert.deepEqual(r.corpo.dados.map((c: any) => c.nome), ['Ana da 100']);
  });
  await comServidor(rotas, { ...atendente, conta: 200 }, banco, semShell, async (chamar) => {
    const r = await chamar('GET', '/contatos');
    assert.deepEqual(r.corpo.dados.map((c: any) => c.nome), ['Bia da 200']);
  });
  // Sem conta ativa declarada: nada de lista misturada, e a resposta diz o que fazer.
  await comServidor(rotas, { ...atendente, conta: null }, banco, semShell, async (chamar) => {
    const r = await chamar('GET', '/contatos');
    assert.equal(r.status, 400);
    assert.equal(r.corpo.codigo, 'CONTA_NAO_INFORMADA');
  });
});
