import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { rotas, rotasPublicas } from '../backend/rotas';

async function chamar(router: express.Router, caminho: string) {
  const app = express().use(router);
  const servidor = app.listen(0);
  try {
    const { port } = servidor.address() as AddressInfo;
    const r = await fetch(`http://127.0.0.1:${port}${caminho}`);
    return { status: r.status, corpo: await r.json() };
  } finally {
    servidor.close();
  }
}

test('GET /status devolve nome e versão do manifesto', async () => {
  const { status, corpo } = await chamar(rotas, '/status');
  assert.equal(status, 200);
  assert.deepEqual(corpo, { nome: 'Portal do Corretor', versao: '0.1.0' });
});

test('diagnóstico público ecoa segmento extra e query', async () => {
  const { status, corpo } = await chamar(rotasPublicas, '/diagnostico/joao?c=maria');
  assert.equal(status, 200);
  assert.deepEqual(corpo, { caminho: '/diagnostico/joao', query: { c: 'maria' } });
});
