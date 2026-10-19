import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { rotas, rotasPublicas } from '../backend/rotas';
import manifesto from '../manifesto.json';

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
  assert.deepEqual(corpo, { nome: manifesto.nome, versao: manifesto.versao });
});

test('manifesto e backend andam juntos: rotas públicas, webhooks, eventos e páginas', async () => {
  const backend = await import('../backend/rotas');
  const m = manifesto as any;
  for (const caminho of m.rotas_publicas) {
    const pilha = (rotasPublicas as any).stack.map((c: any) => c.route?.path).filter(Boolean);
    assert.ok(pilha.some((p: string) => p === caminho || p.startsWith(`${caminho}/`)), `rota pública ${caminho} sem GET`);
  }
  assert.deepEqual(Object.keys(backend.webhooks).sort(), Object.keys(m.webhooks).sort(), 'um handler por webhook declarado');
  assert.deepEqual(Object.keys(backend.reagir).sort(), Object.keys(m.eventos).sort(), 'um listener por evento declarado');
  for (const e of Object.values(m.eventos) as any[]) assert.equal(e.segregado_por_conta, true, 'evento da conta é segregado');
  const fonte = (await import('node:fs')).readFileSync(new URL('../frontend/publico/pagina-publica.ts', import.meta.url), 'utf8') +
    (await import('node:fs')).readFileSync(new URL('../frontend/publico/link.ts', import.meta.url), 'utf8');
  for (const p of Object.values(m.paginas_publicas) as any[]) assert.ok(fonte.includes(`@customElement('${p.componente}')`), `componente ${p.componente}`);
  // Campo pessoal do formulário nunca fica no log do webhook (wh.md § descartar).
  for (const c of ['nome', 'telefone', 'email', 'mensagem']) assert.equal(m.webhooks.formulario_lead.campos[c].descartar, true, c);
});
