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
  // Os eventos da negociação (D1 e D2) só notificam: nenhum listener do app reage a eles.
  const soNotificam = [
    'negociacao_iniciada', 'proposta_recebida', 'proposta_registrada', 'mandato_alterado', 'negociacao_encerrada', 'negociacao_limite_atingido',
    'objecao_detectada', 'contraproposta_sugerida', 'contraproposta_enviada', 'negociacao_acordo_proposto', 'negociacao_assumida', 'negociacao_devolvida',
  ];
  for (const e of soNotificam) assert.ok(m.eventos[e], `evento ${e} declarado`);
  const comListener = Object.keys(m.eventos).filter((e) => !soNotificam.includes(e));
  assert.deepEqual(Object.keys(backend.reagir).sort(), comListener.sort(), 'um listener por evento declarado (fora os que só notificam)');
  for (const e of Object.values(m.eventos) as any[]) assert.equal(e.segregado_por_conta, true, 'evento da conta é segregado');
  const fs = await import('node:fs');
  const pasta = new URL('../frontend/publico/', import.meta.url);
  const fonte = fs.readdirSync(pasta).map((f) => fs.readFileSync(new URL(f, pasta), 'utf8')).join('\n');
  for (const p of Object.values(m.paginas_publicas) as any[]) assert.ok(fonte.includes(`@customElement('${p.componente}')`), `componente ${p.componente}`);
  // Campo pessoal do formulário nunca fica no log do webhook (wh.md § descartar).
  for (const c of ['nome', 'telefone', 'email', 'mensagem']) assert.equal(m.webhooks.formulario_lead.campos[c].descartar, true, c);
  assert.equal(m.webhooks.reacao_selecao.campos.comentario.descartar, true);
  assert.equal(m.webhooks.acao_cliente.campos.texto.descartar, true);
});
