import { test, beforeEach } from 'node:test';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { chamarApi, contaAtiva, contasDoUsuario, escolherConta } from '../frontend/apoio';

// Lógica do `X-Conta` das telas (frontend/apoio.ts), com um `urbiVerso` simulado: quem atende várias
// contas declara a ativa; com uma conta só, nenhum cabeçalho vai.
const g = globalThis as any;
const guardado: Record<string, string> = {};
let chamadas: Array<[string, any]> = [];
const contas = (...ids: number[]) => ({ conta: { resolucao: 'escopado', contas: ids.map((id) => ({ id, nome: `C${id}` })) } });

beforeEach(() => {
  for (const k of Object.keys(guardado)) delete guardado[k];
  chamadas = [];
  g.localStorage = { getItem: (k: string) => guardado[k] ?? null, setItem: (k: string, v: string) => (guardado[k] = v) };
  g.urbiVerso = { contexto: () => g.ctx, api: async (r: string, o: any) => chamadas.push([r, o]) };
});

test('várias contas: manda X-Conta da escolhida e preserva os cabeçalhos', async () => {
  g.ctx = contas(7, 9);
  await chamarApi('/x', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
  assert.deepEqual(chamadas.pop()![1].headers, { 'content-type': 'application/json', 'X-Conta': '7' });
  escolherConta(9);
  await chamarApi('/y');
  assert.equal(chamadas.pop()![1].headers['X-Conta'], '9');
});

test('escolha que não é mais das contas do usuário cai na primeira', () => {
  g.ctx = contas(7, 9);
  escolherConta(123);
  assert.equal(contaAtiva(), 7);
});

test('uma conta só (contaEscrita resolvida): nenhum cabeçalho e nenhum seletor', async () => {
  g.ctx = { conta: { resolucao: 'escopado', contas: [{ id: 7, nome: 'A' }], contaEscrita: 7 } };
  await chamarApi('/z', { method: 'POST' });
  assert.deepEqual(chamadas.pop()![1], { method: 'POST' });
  assert.equal(contaAtiva(), null);
  assert.equal(contasDoUsuario().length, 0);
});

test('sem armazenamento no navegador a escolha vale a primeira conta', () => {
  g.ctx = contas(4, 5);
  g.localStorage = { getItem: () => { throw new Error('bloqueado'); }, setItem: () => { throw new Error('bloqueado'); } };
  escolherConta(5);
  assert.equal(contaAtiva(), 4);
});

test('telas autenticadas chamam o app por chamarApi/chamarFetch, nunca por urbiVerso.api direto', () => {
  const pasta = resolve(process.cwd(), 'frontend/telas');
  for (const arquivo of readdirSync(pasta).filter((f) => f.endsWith('.ts'))) {
    const fonte = readFileSync(resolve(pasta, arquivo), 'utf8');
    assert.doesNotMatch(fonte, /urbiVerso\.(api|fetch)\(/, `${arquivo}: use chamarApi/chamarFetch de ../apoio (sem elas a conta ativa não vai no X-Conta)`);
  }
});
