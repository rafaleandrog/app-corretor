import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { webhooks } from '../backend/rotas';
import { limparLimites } from '../backend/publico';

// F4 (#136, adendo a): todo evento segregado do app leva só ids. Como membro da conta, o negociador
// humano lê pelo barramento todos os eventos dela, inclusive os de negociações que não são dele; o
// payload, então, não pode trazer nome, telefone nem e-mail. A exceção é o que nasce num handler de
// `wh`, onde o SDK 100 não deixa gravar em tabela segregada (wh.md, contas.md § Modo de conexão): o
// dado do visitante só chega ao listener pelo evento. Essas exceções ficam nomeadas aqui, uma a uma,
// e o teste exige que estejam documentadas como risco residual e pedidas ao shell.

const manifesto = JSON.parse(readFileSync(resolve(process.cwd(), 'manifesto.json'), 'utf8'));
const eventos = manifesto.eventos as Record<string, { campos: string[]; segregado_por_conta?: boolean }>;

/** Campos que são identificadores (número de registro da conta). */
const eh_id = (c: string) => c.endsWith('_id') || ['negociacao', 'proposta', 'visita', 'tarefa'].includes(c);
/** Campos que não identificam pessoa: códigos do app, rótulos fechados, datas e o valor da oferta. */
const NAO_PESSOAIS = new Set(['codigo', 'imovel_codigo', 'reacao', 'tipo', 'origem', 'agendada_para', 'quando', 'valor_c']);
/**
 * Risco residual (nasce num handler de `wh`, sem como gravar antes de publicar). Mudar esta lista
 * exige mudar a doc da app e o pedido ao shell, que o teste confere.
 */
const RESIDUAL: Record<string, string[]> = {
  lead_recebido: ['nome', 'telefone', 'email', 'mensagem'],
  reacao_recebida: ['comentario'],
  acao_cliente_recebida: ['texto'],
};
/** Nomes de campo que denunciam dado pessoal ou texto livre de pessoa. */
const PESSOAIS = /nome|telefone|whats|e_?mail|cpf|rg\b|endereco|nascimento|mensagem|texto|comentario|fala/;

test('todo evento do manifesto é segregado e cada campo é id, código ou residual nomeado', () => {
  for (const [tipo, def] of Object.entries(eventos)) {
    assert.equal(def.segregado_por_conta, true, `${tipo}: evento do app é da conta`);
    for (const campo of def.campos) {
      const residual = RESIDUAL[tipo]?.includes(campo);
      if (PESSOAIS.test(campo)) assert.ok(residual, `${tipo}.${campo}: dado pessoal no payload (só ids; o listener busca o resto no banco)`);
      assert.ok(eh_id(campo) || NAO_PESSOAIS.has(campo) || residual, `${tipo}.${campo}: campo sem classificação; é dado pessoal?`);
    }
  }
  for (const [tipo, campos] of Object.entries(RESIDUAL)) {
    for (const c of campos) assert.ok(eventos[tipo]?.campos.includes(c), `${tipo}.${c}: residual que já saiu do manifesto, tire da lista`);
  }
});

test('todo evento publicado ou agendado pelo backend está no manifesto, e todo evento declarado é emitido', () => {
  const dir = resolve(process.cwd(), 'backend');
  const fonte = readdirSync(dir)
    .filter((f) => f.endsWith('.ts'))
    .map((f) => ({ f, texto: readFileSync(resolve(dir, f), 'utf8') }));
  const literais = new Set<string>();
  for (const { f, texto } of fonte) {
    for (const m of texto.matchAll(/\b(?:publicar|agendar)\(\s*(?:req,\s*)?'([a-z_]+)'/g)) {
      assert.ok(eventos[m[1]], `${f}: publica '${m[1]}', que o manifesto não declara`);
      literais.add(m[1]);
    }
  }
  const tudo = fonte.map((x) => x.texto).join('\n');
  for (const tipo of Object.keys(eventos)) assert.ok(literais.has(tipo) || tudo.includes(`'${tipo}'`), `${tipo}: declarado e nunca emitido`);
  // Os publicadores de negociação aceitam só número ou null: texto não passa nem pelo tipo.
  const assinatura = /publicar\(\s*(?:req: Request,\s*)?tipo: string,\s*payload: Record<string, number \| null>/;
  for (const f of ['negociacao.ts', 'negociador.ts']) assert.match(fonte.find((x) => x.f === f)!.texto, assinatura, `${f}: publicador de negociação só com ids`);
});

test('em execução: o dado pessoal do visitante só aparece nos campos residuais', async () => {
  limparLimites();
  const NOME = 'Fulana Pessoal';
  const TELEFONE = '61988887777';
  const EMAIL = 'fulana@pessoal.com';
  const pessoal = (v: unknown) => typeof v === 'string' && (v.includes('Fulana') || v.includes('88887777') || v.includes('@'));
  const resposta = () => {
    const r: any = { status: 200 };
    r.res = { status: (s: number) => ((r.status = s), r.res), json: (c: unknown) => ((r.corpo = c), r.res) };
    return r;
  };
  const chamar = async (nome: keyof typeof webhooks, contexto: unknown, corpo: unknown, ip: string) => {
    const publicados: { tipo: string; payload: Record<string, unknown> }[] = [];
    const req: any = { body: corpo, headers: {}, ip, wh: { webhook: nome, modo: 'recorrente', ingresso_id: 1, contexto, contador_usos: 0, criado_por: 1 }, eventos: { publicar: async (tipo: string, payload: any) => publicados.push({ tipo, payload }) } };
    await webhooks[nome](req, resposta().res);
    return publicados;
  };
  // Tudo o que o visitante digita leva o dado pessoal, para ver onde ele vai parar.
  const texto = `Sou ${NOME}, ${TELEFONE}, ${EMAIL}`;
  const publicados = [
    ...(await chamar('formulario_lead', { conta_id: 100 }, { nome: NOME, telefone: TELEFONE, email: EMAIL, mensagem: texto, imovel_codigo: 'IM-0001', consentimento: true }, '10.9.0.1')),
    ...(await chamar('reacao_selecao', { conta_id: 100, selecao_id: 7 }, { imovel_codigo: 'IM-0001', reacao: 'gostei', comentario: texto }, '10.9.0.2')),
    ...(await chamar('acao_cliente', { conta_id: 100, contato_id: 9 }, { tipo: 'mensagem', texto, negociacao: 3 }, '10.9.0.3')),
    ...(await chamar('acao_cliente', { conta_id: 100, contato_id: 9 }, { tipo: 'proposta_nova', texto, negociacao: 3, valor_c: 50_000_000 }, '10.9.0.4')),
    ...(await chamar('clique_link', { conta_id: 100 }, { codigo: 'abc123' }, '10.9.0.5')),
  ];
  assert.deepEqual(publicados.map((p) => p.tipo), ['lead_recebido', 'reacao_recebida', 'acao_cliente_recebida', 'acao_cliente_recebida', 'link_clicado']);
  for (const { tipo, payload } of publicados) {
    for (const [campo, valor] of Object.entries(payload)) {
      if (!RESIDUAL[tipo]?.includes(campo)) assert.ok(!pessoal(valor), `${tipo}.${campo}: dado pessoal fora dos residuais (${String(valor)})`);
    }
  }
  // Oferta pelo portal não leva texto livre: só ids e o valor.
  assert.equal(publicados[3].payload.texto, null);
});

test('o risco residual está documentado na app e pedido ao shell', () => {
  const pedidos = readFileSync(resolve(process.cwd(), '../../specs/pedidos_ao_shell.md'), 'utf8');
  const docs = readFileSync(resolve(process.cwd(), 'docs/negociacao.md'), 'utf8');
  for (const tipo of Object.keys(RESIDUAL)) {
    assert.ok(pedidos.includes(`\`${tipo}\``), `pedidos_ao_shell.md: falta o residual ${tipo}`);
    assert.ok(docs.includes(`\`${tipo}\``), `docs/negociacao.md: falta o residual ${tipo}`);
  }
  assert.match(pedidos, /multi-usuário/, 'pedidos_ao_shell.md: falta o pedido para expor a política multi-usuário');
});
