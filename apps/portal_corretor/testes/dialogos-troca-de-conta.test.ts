import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { buscaDoGesto, escolherConta, gesto } from '../frontend/apoio';
import { novaVisita } from '../frontend/criar';
import { novaProposta } from '../frontend/telas/negociacoes';

// Issue #157 (sobra do #156): a busca dos diálogos "Nova visita" e "Nova proposta" é presa ao gesto que
// abriu o diálogo. Com o diálogo aberto em A e a conta trocada para B, ela não consulta nem lista B; a
// resposta de A que chega depois da troca também não aparece.
const g = globalThis as any;
const guardado: Record<string, string> = {};
let pedidos: { rota: string; conta: string | null }[] = [];
let emVoo: Array<(v: unknown) => void> = [];
let segurarPedidos = false;
let camposAbertos: any[] = [];
let fecharDialogo: (v: unknown) => void = () => {};

const varias = (...ids: number[]) => ({ conta: { resolucao: 'escopado', contas: ids.map((id) => ({ id, nome: `C${id}` })) } });

beforeEach(() => {
  for (const k of Object.keys(guardado)) delete guardado[k];
  pedidos = [];
  emVoo = [];
  segurarPedidos = false;
  camposAbertos = [];
  g.localStorage = { getItem: (k: string) => guardado[k] ?? null, setItem: (k: string, v: string) => (guardado[k] = v) };
  g.urbiVerso = {
    contexto: () => g.ctx,
    api: (rota: string, o: RequestInit = {}) => {
      const conta = new Headers(o.headers).get('X-Conta');
      pedidos.push({ rota, conta });
      const resposta = { dados: [{ id: Number(conta), nome: `da conta ${conta}`, codigo: `IM-${conta}` }] };
      return segurarPedidos ? new Promise((ok) => emVoo.push(() => ok(resposta))) : Promise.resolve(resposta);
    },
    formulario: (o: { campos: any[] }) => {
      camposAbertos = o.campos;
      return new Promise((ok) => (fecharDialogo = ok));
    },
    notificar: () => {},
    alertar: async () => {},
    navegarSub: () => {},
  };
  g.ctx = varias(7, 9);
  escolherConta(7);
});

test('buscaDoGesto: na conta do gesto lista; depois da troca, nada (e nem consulta a conta nova)', async () => {
  const vida = gesto();
  const buscar = buscaDoGesto(vida, '/contatos', (c) => c.nome);
  assert.deepEqual(await buscar('a', new AbortController().signal), [{ valor: 7, rotulo: 'da conta 7' }]);
  escolherConta(9);
  assert.deepEqual(await buscar('a', new AbortController().signal), []);
  assert.deepEqual(pedidos.map((p) => p.conta), ['7'], 'nenhum pedido sai para a conta 9');
});

test('buscaDoGesto: resposta de A que chega depois da troca vira lista vazia, sem erro', async () => {
  segurarPedidos = true;
  const buscar = buscaDoGesto(gesto(), '/imoveis', (i) => i.codigo);
  const p = buscar('x', new AbortController().signal);
  escolherConta(9);
  emVoo.shift()!(undefined);
  assert.deepEqual(await p, []);
});

for (const [nome, abrir] of [
  ['Nova visita', () => novaVisita()],
  ['Nova proposta', () => novaProposta(null)],
] as const) {
  test(`${nome}: diálogo aberto em A não lista dados de B depois da troca`, async () => {
    const fim = abrir();
    await new Promise((r) => setImmediate(r));
    const busca = camposAbertos.filter((c) => c.tipo === 'busca');
    assert.equal(busca.length, 2);
    for (const c of busca) assert.equal((await c.buscar('a', new AbortController().signal)).length, 1, 'na conta 7, lista');
    escolherConta(9);
    for (const c of busca) assert.deepEqual(await c.buscar('a', new AbortController().signal), [], 'na conta 9, nada');
    assert.ok(pedidos.every((p) => p.conta === '7'), JSON.stringify(pedidos));
    // Confirmado depois da troca: nada é enviado.
    fecharDialogo({ contato_id: 9, imovel_id: 9, dia: '2026-12-01', hora: '10:00', valor: '1.000.000' });
    await fim;
    assert.ok(pedidos.every((p) => p.conta === '7'), 'nenhum envio para a conta 9');
  });
}
