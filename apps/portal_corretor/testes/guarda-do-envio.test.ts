import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { chamarApi, chamarFetch, ContaTrocada, ehContaTrocada, enviar, escolherConta, formularioEnviar, seNaoContaTrocada } from '../frontend/apoio';

// O guarda único do envio (frontend/apoio.ts, issue #144): todo pedido guarda a época da conta de trabalho
// no envio e, na volta (resposta OU erro), rejeita com `ContaTrocada` se a conta mudou no meio. Sem troca,
// tudo segue como antes. `urbiVerso` simulado, com cada pedido segurado até o teste soltá-lo.
const g = globalThis as any;
const guardado: Record<string, string> = {};
let emVoo: Array<{ ok: (v: unknown) => void; falha: (e: unknown) => void }> = [];
let avisos: string[] = [];
let formulario: () => Promise<unknown> = async () => ({});

const varias = (...ids: number[]) => ({ conta: { resolucao: 'escopado', contas: ids.map((id) => ({ id, nome: `C${id}` })) } });
const unica = (id: number) => ({ conta: { resolucao: 'escopado', contas: [{ id, nome: `C${id}` }], contaEscrita: id } });

const segurar = () => new Promise((ok, falha) => emVoo.push({ ok, falha }));
const soltar = (v: unknown = { dados: 'da conta' }) => emVoo.shift()!.ok(v);
const falhar = (e: unknown = new Error('Falha da conta anterior')) => emVoo.shift()!.falha(e);

beforeEach(() => {
  for (const k of Object.keys(guardado)) delete guardado[k];
  emVoo = [];
  avisos = [];
  formulario = async () => ({});
  g.localStorage = { getItem: (k: string) => guardado[k] ?? null, setItem: (k: string, v: string) => (guardado[k] = v) };
  g.urbiVerso = {
    contexto: () => g.ctx,
    api: () => segurar(),
    fetch: () => segurar(),
    formulario: () => formulario(),
    notificar: (m: string) => avisos.push(`notificar: ${m}`),
    alertar: async (o: { titulo: string }) => avisos.push(`alertar: ${o.titulo}`),
  };
  g.ctx = varias(7, 9);
  escolherConta(7);
});

test('sem troca: a resposta e o erro chegam como sempre', async () => {
  const p = chamarApi('/x');
  soltar({ ok: 1 });
  assert.deepEqual(await p, { ok: 1 });
  const erro = new Error('NAO_ENCONTRADO');
  const q = chamarApi('/y');
  falhar(erro);
  await assert.rejects(q, (e) => e === erro);
});

test('várias contas: resposta em voo com troca pelo seletor rejeita com ContaTrocada, nunca entrega o dado', async () => {
  const p = chamarApi('/contatos');
  escolherConta(9);
  soltar({ dados: ['contato de 7'] });
  await assert.rejects(p, (e) => ehContaTrocada(e) && e instanceof ContaTrocada);
});

test('várias contas: erro em voo com troca rejeita com ContaTrocada, não com o erro da conta anterior', async () => {
  const p = enviar('POST', '/contatos/importar', { linhas: [] });
  escolherConta(9);
  falhar(new Error('A importação falhou em 7'));
  await assert.rejects(p, (e) => ehContaTrocada(e));
});

test('conta única trocada pelo shell (contaEscrita) com o pedido em voo: ContaTrocada, também no chamarFetch', async () => {
  g.ctx = unica(1);
  const p = chamarApi('/pagina');
  const q = chamarFetch('/arquivo');
  g.ctx = unica(2); // o shell trocou a conta; o guarda lê o contexto na volta
  soltar();
  falhar();
  await assert.rejects(p, (e) => ehContaTrocada(e));
  await assert.rejects(q, (e) => ehContaTrocada(e));
});

test('ida e volta A → B → A com o pedido em voo também rejeita (a época avançou)', async () => {
  const p = chamarApi('/inicio');
  escolherConta(9);
  escolherConta(7);
  soltar();
  await assert.rejects(p, (e) => ehContaTrocada(e));
});

test('pedido enviado depois da troca segue normal', async () => {
  escolherConta(9);
  const p = chamarApi('/inicio');
  soltar({ conta: 9 });
  assert.deepEqual(await p, { conta: 9 });
});

test('seNaoContaTrocada: ContaTrocada some em silêncio; o resto vai para o tratador', () => {
  const vistos: unknown[] = [];
  const tratar = seNaoContaTrocada((e) => (vistos.push(e), 'tratado'));
  assert.equal(tratar(new ContaTrocada()), undefined);
  const outro = new Error('outro');
  assert.equal(tratar(outro), 'tratado');
  assert.deepEqual(vistos, [outro]);
  assert.equal(ehContaTrocada(new Error('conta_trocada')), false);
});

test('formularioEnviar: envio em voo com troca de conta → null, sem "Salvo." nem alerta', async () => {
  const p = formularioEnviar('Novo contato', [], 'POST', '/contatos');
  await new Promise((r) => setImmediate(r)); // o diálogo respondeu, o POST saiu
  assert.equal(emVoo.length, 1);
  escolherConta(9);
  falhar(new Error('erro de 7'));
  assert.equal(await p, null);
  assert.deepEqual(avisos, []);
});

test('formularioEnviar: troca com o diálogo aberto → nada é enviado nem avisado', async () => {
  let responder!: (v: unknown) => void;
  formulario = () => new Promise((r) => (responder = r));
  const p = formularioEnviar('Novo contato', [], 'POST', '/contatos');
  await new Promise((r) => setImmediate(r));
  escolherConta(9);
  responder({ nome: 'de 7' });
  assert.equal(await p, null);
  assert.equal(emVoo.length, 0);
  assert.deepEqual(avisos, []);
});

test('formularioEnviar nunca rejeita: falha do diálogo vira alerta e null; sem troca, salva e avisa', async () => {
  formulario = async () => {
    throw new Error('diálogo quebrou');
  };
  assert.equal(await formularioEnviar('X', [], 'POST', '/x'), null);
  assert.deepEqual(avisos, ['alertar: Não foi possível abrir o formulário']);
  avisos = [];
  formulario = async () => ({ nome: 'a' });
  const p = formularioEnviar('X', [], 'POST', '/x');
  await new Promise((r) => setImmediate(r));
  soltar({ id: 1 });
  assert.deepEqual(await p, { id: 1 });
  assert.deepEqual(avisos, ['notificar: Salvo.']);
});
