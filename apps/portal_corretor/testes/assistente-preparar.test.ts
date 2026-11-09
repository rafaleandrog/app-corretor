import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rotas } from '../backend/rotas';
import { BancoFalso, comServidor, type Ator } from './apoio';

const UNICOS = { contatos: ['telefone'], imoveis: ['codigo'], perfis_corretor: ['usuario_id'], etapas_funil: ['pipeline+nome'], playbook_funil: ['etapa_id+temperatura'] };
const antes = (dias: number) => new Date(Date.now() - dias * 24 * 3600 * 1000).toISOString();

test('POST /assistente/perguntar prepara o funil da conta ativa: playbook semeado e fila com a abordagem vencida', async () => {
  const banco = new BancoFalso(UNICOS);
  const contextos: string[] = [];
  const ia = {
    estadoSlot: async (slot: string) => ({ pedido: slot, efetivo: { slot, origem: 'global' }, backup: null }),
    consultar: async (o: { contexto: string }) => {
      contextos.push(o.contexto);
      return { dados: { resposta: 'ok', nao_sei: false } };
    },
  };
  const ator: Ator = { usuario: 1, conta: 100, papeis: ['corretor'], extras: { ia } };
  await comServidor(rotas, ator, banco, {}, async (chamar) => {
    const c = (await chamar('POST', '/contatos', { nome: 'Beto', telefone: '61911110002' })).corpo;
    await chamar('POST', '/negocios', { contato_id: c.id });
    banco.linhas('negocios')[0].etapa_desde = antes(3);
    banco.linhas('contatos')[0].ultimo_contato_em = antes(3);
    // Conta sem playbook (criada depois do último aoIniciar): a fila sairia vazia.
    banco.linhas('playbook_funil').length = 0;
    assert.equal((await chamar('GET', '/inicio')).corpo.fila.length, 0, 'GET só lê: fila vazia sem playbook');
    assert.equal(banco.linhas('playbook_funil').length, 0, 'GET não grava');

    const r = await chamar('POST', '/assistente/perguntar', { pergunta: 'o que faço hoje?' });
    assert.equal(r.status, 200);
    assert.equal(r.corpo.sem_ia, false);
    assert.ok(banco.linhas('playbook_funil').some((p) => p.conta_id === 100), 'playbook existe depois de perguntar');
    assert.equal(contextos.length, 1);
    assert.ok(!contextos[0].includes('FILA DO DIA: vazia.'), 'a fila enviada à IA não é vazia');
    assert.match(contextos[0], /abordagem_vencida/);
  });
});
