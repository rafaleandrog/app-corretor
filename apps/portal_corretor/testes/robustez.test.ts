import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { rotas } from '../backend/rotas';
import { assincrono, salvarUnico } from '../backend/acesso';
import { normalizarTelefone, telefoneValido, validarMeuPerfil } from '../comum/conta';
import { semear } from '../backend/semente';
import { BancoFalso, comServidor, type Ator } from './apoio';

const UNICOS = { perfil_conta: ['chave'], configuracoes_conta: ['chave'], perfis_corretor: ['usuario_id'] };
const A: Ator = { usuario: 1, conta: 100, papeis: ['corretor'] };
const EQUIPE: Ator = { usuario: 9, conta: null, papeis: ['operacao'] };

test('salvar de novo atualiza a mesma linha, sem duplicar', async () => {
  const banco = new BancoFalso(UNICOS);
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    await chamar('PUT', '/conta/perfil', { nome: 'Primeiro' });
    const r = await chamar('PUT', '/conta/perfil', { nome: 'Segundo' });
    assert.equal(r.status, 200);
    assert.equal(r.corpo.nome, 'Segundo');
    const g = await chamar('GET', '/conta');
    assert.equal(g.corpo.perfil.nome, 'Segundo');
  });
  assert.equal(banco.linhas('perfil_conta').length, 1);
});

test('corrida de criação cai no único e vira atualização da linha vencedora', async () => {
  const banco = new BancoFalso(UNICOS);
  const dados = banco.dados(100);
  // Simula a outra requisição criando entre a leitura e a criação desta.
  const listar = dados.listar.bind(dados);
  let primeira = true;
  dados.listar = async (t: string, op: any) => {
    const r = await listar(t, op);
    if (primeira) {
      primeira = false;
      await dados.criar('perfil_conta', { chave: 'conta', nome: 'Outra requisição' });
      return { ...r, dados: [] };
    }
    return r;
  };
  const linha = await salvarUnico(dados, 'perfil_conta', { chave: 'conta' }, { nome: 'Esta' });
  assert.equal(linha.nome, 'Esta');
  assert.equal(banco.linhas('perfil_conta').length, 1);
});

test('dados inválidos nas rotas voltam 422 com a lista de detalhes', async () => {
  await comServidor(rotas, A, new BancoFalso(UNICOS), {}, async (chamar) => {
    const cfg = await chamar('PUT', '/conta/configuracoes', { prazo_primeiro_atendimento_min: 0, modo_aprovacao_conteudo: 'x' });
    assert.equal(cfg.status, 422);
    assert.ok(cfg.corpo.detalhes.length >= 2);
    assert.equal((await chamar('PUT', '/conta/perfil', { nome: '' })).status, 422);
    assert.equal((await chamar('PUT', '/conta/meu-perfil', { telefone: 61999990000 })).status, 422);
  });
});

test('telefone brasileiro exige DDD válido e 10 ou 11 dígitos', () => {
  assert.equal(normalizarTelefone('061 99999-0000'), '+5561999990000');
  assert.equal(telefoneValido(normalizarTelefone('(61) 3333-4444')!), true);
  assert.equal(telefoneValido(normalizarTelefone('99999999')!), false);
  assert.equal(telefoneValido('+55061999990000'), false);
  assert.equal(telefoneValido('+14155550100'), true);
  assert.equal(validarMeuPerfil({ creci: 123 }).ok, false);
});

test('erros de provisionamento sem status e violação de CHECK não viram 500', async () => {
  const app = express();
  app.get('/a', assincrono(async () => { throw Object.assign(new Error('não liberado'), { codigo: 'PROVISIONA_NAO_LIBERADA' }); }));
  app.get('/b', assincrono(async () => { throw Object.assign(new Error('check'), { code: '23514' }); }));
  const servidor = app.listen(0);
  try {
    const porta = (servidor.address() as { port: number }).port;
    const a = await fetch(`http://127.0.0.1:${porta}/a`);
    assert.equal(a.status, 400);
    assert.equal((await a.json()).codigo, 'PROVISIONA_NAO_LIBERADA');
    assert.equal((await fetch(`http://127.0.0.1:${porta}/b`)).status, 422);
  } finally {
    servidor.close();
  }
});

test('convite criado com e-mail que falhou volta 202 com aviso', async () => {
  const shell = {
    externos: {
      convidar: async () => {
        throw Object.assign(new Error('e-mail'), { codigo: 'CONVITE_EMAIL_FALHOU', status: 502 });
      },
    },
  };
  await comServidor(rotas, EQUIPE, new BancoFalso(), shell, async (chamar) => {
    const r = await chamar('POST', '/equipe/convites', { email: 'a@b.com', conta: 'A' });
    assert.equal(r.status, 202);
    assert.match(r.corpo.aviso, /convite foi criado/);
  });
});

test('lista de convites repassa o filtro de situação e limita a página', async () => {
  const pedidos: any[] = [];
  const shell = { externos: { listarConvites: async (op: any) => { pedidos.push(op); return { convites: [], total: 0 }; } } };
  await comServidor(rotas, EQUIPE, new BancoFalso(), shell, async (chamar) => {
    await chamar('GET', '/equipe/convites?status=resgatado&pagina=2');
    await chamar('GET', '/equipe/convites?status=qualquer&pagina=1e300');
  });
  assert.deepEqual(pedidos[0], { status: 'resgatado', limite: 50, deslocamento: 50 });
  assert.deepEqual(pedidos[1], { status: undefined, limite: 50, deslocamento: 999 * 50 });
});

test('semente segue para as outras contas quando uma falha, e avisa no fim', async () => {
  const banco = new BancoFalso(UNICOS);
  const ctx = banco.ctxSistema([
    { id: 1, nome: 'Quebrada (demo)' },
    { id: 2, nome: 'Boa (demo) ' },
  ]);
  const comConta = ctx.dados.comConta;
  ctx.dados.comConta = async (id: number, fn: any) => {
    if (id === 1) throw new Error('conta inativa');
    return comConta(id, fn);
  };
  await assert.rejects(semear(ctx), /Quebrada \(demo\): conta inativa/);
  assert.equal(banco.linhas('perfil_conta').length, 1);
  assert.equal(banco.linhas('perfil_conta')[0].nome, 'Boa');
});

test('sem conta resolvida, a escrita também recebe a explicação SEM_CONTA', async () => {
  await comServidor(rotas, { usuario: 5, conta: null, papeis: ['corretor'] }, new BancoFalso(UNICOS), {}, async (chamar) => {
    const r = await chamar('PUT', '/conta/perfil', { nome: 'X' });
    assert.equal(r.status, 409);
    assert.equal(r.corpo.codigo, 'SEM_CONTA');
  });
});

test('linha que some durante a gravação é falha, não sucesso com a linha antiga', async () => {
  const banco = new BancoFalso(UNICOS);
  const dados = banco.dados(100);
  await dados.criar('perfil_conta', { chave: 'conta', nome: 'Antiga' });
  dados.atualizar = async () => null;
  await assert.rejects(salvarUnico(dados, 'perfil_conta', { chave: 'conta' }, { nome: 'Nova' }), /sumiu/);
});

test('código de erro desconhecido sem status segue como falha interna', async () => {
  const app = express();
  app.get('/c', assincrono(async () => { throw Object.assign(new Error('bug'), { codigo: 'VOCABULARIO_INVALIDO' }); }));
  const servidor = app.listen(0);
  try {
    const porta = (servidor.address() as { port: number }).port;
    assert.equal((await fetch(`http://127.0.0.1:${porta}/c`)).status, 500);
  } finally {
    servidor.close();
  }
});
