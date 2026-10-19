import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escoparPorConta } from '../backend/escopo';

// Teste do proxy de `req.dados` (backend/escopo.ts) contra um `dados` mínimo que segue o contrato do
// SDK: linhas com `conta_id`, soft delete (`buscar` esconde removido, salvo `incluir_removidos`),
// `restaurar`/`remover` idempotentes e leitura que enxerga o conjunto das contas.
type Linha = Record<string, any>;
function falso(linhas: Record<string, Linha[]>) {
  const achar = (t: string, id: number) => linhas[t].find((l) => l.id === id);
  const chamadas: string[] = [];
  const dados: any = {
    async listar(t: string, o: { filtros?: Linha } = {}) {
      const f = o.filtros ?? {};
      return { dados: linhas[t].filter((l) => !l.removido_em && Object.entries(f).every(([k, v]) => k === 'conta_id' && t === 'vitrine_publica' ? true : l[k] === v)) };
    },
    async varrerTudo(t: string, o: { filtros?: Linha } = {}) {
      return (await dados.listar(t, o)).dados;
    },
    async buscar(t: string, id: number, o: { incluir_removidos?: boolean } = {}) {
      const l = achar(t, id);
      return l && (!l.removido_em || o.incluir_removidos) ? l : null;
    },
    async atualizar(t: string, id: number, d: Linha) {
      chamadas.push(`atualizar:${t}:${id}`);
      const l = achar(t, id);
      return l ? Object.assign(l, d) : null;
    },
    async remover(t: string, id: number) {
      const l = achar(t, id);
      return l ? Object.assign(l, { removido_em: l.removido_em ?? 'agora' }) : null;
    },
    async restaurar(t: string, id: number) {
      const l = achar(t, id);
      if (l) l.removido_em = null;
      return l ?? null;
    },
    async deletar(t: string, id: number) {
      const i = linhas[t].findIndex((l) => l.id === id);
      if (i < 0) return false;
      linhas[t].splice(i, 1);
      return true;
    },
    async existe(t: string, f: Linha) {
      if (t === 'vitrine_publica' && 'conta_id' in f) throw new Error('VOCABULARIO_INVALIDO: conta_id');
      return linhas[t].some((l) => Object.entries(f).every(([k, v]) => l[k] === v));
    },
    async transaction(cb: (trx: any) => Promise<unknown>) {
      return cb(dados);
    },
    async travessia() {
      return { dados: [] };
    },
    async sqlDeclarado() {
      return [];
    },
    async comConta(_conta: number, cb: () => Promise<unknown>) {
      return cb();
    },
    async limparTabela() {
      return 0;
    },
    async atualizarSe(t: string, id: number, d: Linha, condicoes: Linha) {
      const l = achar(t, id);
      return l && !l.removido_em && Object.entries(condicoes).every(([k, v]) => l[k] === v) ? Object.assign(l, d) : null;
    },
    async incrementar(t: string, id: number, inc: Record<string, number>) {
      const l = achar(t, id);
      if (!l) return null;
      for (const [k, v] of Object.entries(inc)) l[k] = (l[k] ?? 0) + v;
      return l;
    },
    async revelar(t: string, id: number, coluna: string) {
      const l = achar(t, id);
      return l && !l.removido_em ? (l[coluna] ?? null) : null;
    },
  };
  return { dados, chamadas };
}
const base = () => ({
  contatos: [
    { id: 1, conta_id: 100, nome: 'Ana', visitas: 0, segredo: 'da-100' },
    { id: 2, conta_id: 200, nome: 'Bia', visitas: 0, segredo: 'da-200' },
  ],
  vitrine_publica: [{ id: 10, conta: 100, tipo: 'pagina', chave: 'ana', dados: { v: 1 } }],
});

test('tabela segregada: lista só a conta ativa e trata linha de outra conta como inexistente', async () => {
  const { dados } = falso(base());
  const d = escoparPorConta(dados, 100);
  assert.deepEqual((await d.listar('contatos')).dados.map((l: any) => l.nome), ['Ana']);
  assert.equal(await d.buscar('contatos', 2), null);
  assert.equal(await d.atualizar('contatos', 2, { nome: 'X' }), null);
  assert.equal(await d.deletar('contatos', 2), false);
  assert.equal((await d.atualizar('contatos', 1, { nome: 'Ana 2' }))!.nome, 'Ana 2');
});

test('tabela não segregada (vitrine_publica) passa sem escopo: atualizar, existe e deletar funcionam', async () => {
  const { dados } = falso(base());
  const d = escoparPorConta(dados, 100);
  const atual = await d.buscar('vitrine_publica', 10);
  assert.equal(atual?.chave, 'ana');
  assert.deepEqual((await d.atualizar('vitrine_publica', 10, { dados: { v: 2 } }))!.dados, { v: 2 });
  assert.equal(await d.existe('vitrine_publica', { tipo: 'pagina' }), true);
  assert.equal((await d.varrerTudo('vitrine_publica', { filtros: { conta: 100 } })).length, 1);
  assert.equal(await d.deletar('vitrine_publica', 10), true);
});

test('soft delete: remover é idempotente e restaurar alcança linha removida da conta ativa', async () => {
  const { dados } = falso(base());
  const d = escoparPorConta(dados, 100);
  assert.equal((await d.remover('contatos', 1))?.removido_em, 'agora');
  assert.equal((await d.remover('contatos', 1))?.id, 1);
  assert.equal((await d.restaurar('contatos', 1))?.removido_em, null);
  // Linha removida de OUTRA conta: a checagem enxerga removidos, mas não vaza o escopo.
  const outra = (await d.listar('contatos')).dados.length;
  await dados.remover('contatos', 2);
  assert.equal(await d.restaurar('contatos', 2), null, 'linha removida de outra conta continua inalcançável');
  assert.equal(await d.deletar('contatos', 2), false);
  assert.equal(outra, 1);
});

test('transaction entrega o trx escopado; verbos sem escopo falham alto nas tabelas segregadas', async () => {
  const { dados } = falso(base());
  const d = escoparPorConta(dados, 100);
  await d.transaction(async (trx: any) => {
    assert.equal(await trx.buscar('contatos', 2), null);
  });
  assert.throws(() => (d as any).travessia('contatos', {}), /não tem escopo de conta/);
  assert.doesNotThrow(() => (d as any).travessia('vitrine_publica', {}));
  assert.throws(() => (d as any).sqlDeclarado('qualquer_consulta', {}), /não tem escopo de conta/);
  assert.throws(() => (d as any).comConta(200, async () => {}), /não tem escopo de conta/);
  assert.throws(() => (d as any).limparTabela('contatos'), /não tem escopo de conta/);
});

test('atualizarSe, incrementar e revelar só alcançam linha da conta ativa', async () => {
  const { dados } = falso(base());
  const d = escoparPorConta(dados, 100);
  assert.equal((await d.atualizarSe('contatos', 1, { nome: 'Ana 3' }, { nome: 'Ana' }))!.nome, 'Ana 3');
  assert.equal(await d.atualizarSe('contatos', 2, { nome: 'X' }, { nome: 'Bia' }), null);
  assert.equal((await d.incrementar('contatos', 1, { visitas: 2 }))!.visitas, 2);
  assert.equal(await d.incrementar('contatos', 2, { visitas: 2 }), null);
  assert.equal(await d.revelar('contatos', 1, 'segredo'), 'da-100');
  assert.equal(await d.revelar('contatos', 2, 'segredo'), null, 'segredo de outra conta não sai');
  assert.equal((await dados.buscar('contatos', 2)).visitas, 0, 'a linha da outra conta ficou intacta');
});
