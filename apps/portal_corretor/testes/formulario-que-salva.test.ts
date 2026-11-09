import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { escolherConta, formularioEnviar, formularioQueSalva, duplicataDeContato, camposComValores } from '../frontend/apoio';
import { FRASE_GENERICA } from '../frontend/estados';

// Issue #187: salvar que o servidor recusa NUNCA descarta o que o corretor digitou. O `urbiVerso.formulario`
// fecha ao confirmar (ui-componentes-conteudo.md); o laço de `formularioQueSalva` (apoio.ts) reabre com os
// mesmos valores e a frase do erro no `mensagem`, até salvar ou o corretor cancelar. `urbiVerso` simulado: o
// diálogo responde o que a fila `respostas` manda e guarda o que mostrou; cada envio responde pela fila `envios`.
const g = globalThis as any;
const guardado: Record<string, string> = {};
let respostas: Array<Record<string, unknown> | null | (() => Record<string, unknown> | null)> = [];
let abertos: any[] = [];
let envios: Array<unknown> = [];
let enviados: Array<{ rota: string; corpo: unknown }> = [];
let avisos: string[] = [];
let confirmacoes: any[] = [];
let respostaConfirmar = false;

const erro = (message: string, extra: Record<string, unknown>) => Object.assign(new Error(message), extra);
const recusa = (detalhe: string) => erro('Dados inválidos.', { status: 422, codigo: 'DADOS_INVALIDOS', detalhes: [detalhe] });
const duplicata = () => erro('Já existe um contato com este telefone: Ana Ribeiro.', { status: 409, codigo: 'DUPLICATA', detalhes: ['42'] });

beforeEach(() => {
  for (const k of Object.keys(guardado)) delete guardado[k];
  respostas = [];
  abertos = [];
  envios = [];
  enviados = [];
  avisos = [];
  confirmacoes = [];
  respostaConfirmar = false;
  g.localStorage = { getItem: (k: string) => guardado[k] ?? null, setItem: (k: string, v: string) => (guardado[k] = v) };
  g.ctx = { conta: { resolucao: 'escopado', contas: [{ id: 7, nome: 'C7' }, { id: 9, nome: 'C9' }] } };
  g.urbiVerso = {
    contexto: () => g.ctx,
    api: async (rota: string, o: RequestInit) => {
      enviados.push({ rota, corpo: o?.body ? JSON.parse(String(o.body)) : undefined });
      const r = envios.shift();
      if (typeof r === 'function') return r();
      if (r instanceof Error) throw r;
      return r;
    },
    formulario: async (o: any) => {
      abertos.push(o);
      const r = respostas.shift();
      return typeof r === 'function' ? r() : (r ?? null);
    },
    confirmar: async (o: any) => (confirmacoes.push(o), respostaConfirmar),
    notificar: (m: string) => avisos.push(`notificar: ${m}`),
    alertar: async (o: { titulo: string }) => avisos.push(`alertar: ${o.titulo}`),
  };
  escolherConta(7);
});

const CAMPOS = [
  { nome: 'nome', tipo: 'texto' as const, rotulo: 'Nome', obrigatorio: true },
  { nome: 'telefone', tipo: 'texto' as const, rotulo: 'Telefone', valor: '' },
  { nome: 'vip', tipo: 'booleano' as const, rotulo: 'VIP', valor: false },
];

test('422 DADOS_INVALIDOS: reabre com o digitado e a frase do erro; salvando na segunda, avisa e devolve', async () => {
  respostas = [{ nome: 'Ana', telefone: '123', vip: true }, { nome: 'Ana', telefone: '(61) 99999-0000', vip: true }];
  envios = [recusa('Telefone inválido. Use DDD e número.'), { id: 5 }];
  const r = await formularioEnviar('Novo contato', CAMPOS, 'POST', '/contatos', undefined, { mensagem: 'Explicação.' });
  assert.deepEqual(r, { id: 5 });
  assert.equal(abertos.length, 2, 'o formulário reabriu uma vez');
  const reaberto = abertos[1];
  assert.deepEqual(reaberto.campos.map((c: any) => c.valor), ['Ana', '123', true], 'com os mesmos valores');
  assert.equal(reaberto.mensagem, 'Não foi possível salvar: Telefone inválido. Use DDD e número. Confira e tente de novo.\n\nExplicação.', 'a frase do erro em cima da explicação');
  assert.equal(abertos[0].mensagem, 'Explicação.');
  assert.deepEqual(avisos, ['notificar: Salvo.'], 'a recusa não vira alerta solto');
  assert.equal(enviados.length, 2);
});

test('Cancelar na reabertura encerra o laço: null, sem alerta nem novo envio', async () => {
  respostas = [{ nome: 'Ana', telefone: '1', vip: false }, null];
  envios = [recusa('Telefone inválido.')];
  assert.equal(await formularioEnviar('Novo contato', CAMPOS, 'POST', '/contatos'), null);
  assert.equal(abertos.length, 2);
  assert.equal(enviados.length, 1);
  assert.deepEqual(avisos, []);
});

test('rede ou 5xx também reabre, com a frase genérica', async () => {
  respostas = [{ nome: 'Ana', telefone: '', vip: false }, null];
  envios = [erro('Internal Server Error', { status: 500 })];
  assert.equal(await formularioEnviar('X', CAMPOS, 'POST', '/x'), null);
  assert.equal(abertos[1].mensagem, `Não foi possível salvar: ${FRASE_GENERICA} Confira e tente de novo.`);
  assert.equal(abertos[1].campos[0].valor, 'Ana');
});

test('409 DUPLICATA com o id: "Abrir <nome>" abre o existente; "Corrigir" reabre com o digitado', async () => {
  const abertosNaFicha: number[] = [];
  respostas = [{ nome: 'Ana', telefone: '61999990000', vip: false }];
  envios = [duplicata()];
  respostaConfirmar = true;
  const r = await formularioQueSalva({ titulo: 'Novo cliente', campos: CAMPOS, salvar: (v) => g.urbiVerso.api('/contatos', { body: JSON.stringify(v) }), duplicata: duplicataDeContato((id) => abertosNaFicha.push(id)) });
  assert.equal(r, null);
  assert.deepEqual(abertosNaFicha, [42], 'abriu o contato que já tem o número');
  assert.equal(confirmacoes[0].rotuloConfirmar, 'Abrir Ana Ribeiro');
  assert.equal(confirmacoes[0].rotuloCancelar, 'Corrigir');
  assert.equal(abertos.length, 1, 'não reabriu');

  // Corrigir: volta ao formulário com o digitado e a frase da duplicata.
  abertos = [];
  confirmacoes = [];
  respostaConfirmar = false;
  respostas = [{ nome: 'Ana', telefone: '61999990000', vip: false }, null];
  envios = [duplicata()];
  await formularioQueSalva({ titulo: 'Novo cliente', campos: CAMPOS, salvar: (v) => g.urbiVerso.api('/contatos', { body: JSON.stringify(v) }), duplicata: duplicataDeContato((id) => abertosNaFicha.push(id)) });
  assert.equal(confirmacoes.length, 1);
  assert.deepEqual(abertos[1].campos.map((c: any) => c.valor), ['Ana', '61999990000', false]);
  assert.match(abertos[1].mensagem, /Já existe um contato com este telefone: Ana Ribeiro\./);
  assert.deepEqual(abertosNaFicha, [42], 'nada novo aberto');
});

test('conta trocada com o envio em voo: termina em silêncio, sem reabrir nem avisar', async () => {
  respostas = [{ nome: 'Ana', telefone: '', vip: false }];
  envios = [() => {
    escolherConta(9);
    throw recusa('de 7');
  }];
  assert.equal(await formularioEnviar('Novo contato', CAMPOS, 'POST', '/contatos'), null);
  assert.equal(abertos.length, 1);
  assert.deepEqual(avisos, []);
});

test('validação local no `salvar` (throw new Error) reabre com a frase dela', async () => {
  respostas = [{ nome: '', telefone: '', vip: false }, null];
  await formularioQueSalva({ titulo: 'X', campos: CAMPOS, salvar: () => { throw new Error('Escolha de 1 a 10 imóveis.'); } });
  assert.equal(abertos[1].mensagem, 'Não foi possível salvar: Escolha de 1 a 10 imóveis. Confira e tente de novo.');
});

test('campo `busca` reabre com o texto que a busca mostrou (não com #id); `aviso: null` deixa o aviso para quem chamou', async () => {
  const busca = { nome: 'contato_id', tipo: 'busca' as const, rotulo: 'Cliente', buscar: async () => [{ valor: 3, rotulo: 'Bia Souza' }] };
  respostas = [
    () => {
      void abertos[0].campos[0].buscar('bi', new AbortController().signal);
      return { contato_id: 3 };
    },
    null,
  ];
  envios = [recusa('Cliente sem telefone.')];
  await formularioQueSalva({ titulo: 'Nova conversa', campos: [busca], aviso: null, salvar: (v) => g.urbiVerso.api('/conversas', { body: JSON.stringify(v) }) });
  assert.equal(abertos[1].campos[0].valor, 3);
  assert.equal(abertos[1].campos[0].rotuloValor, 'Bia Souza');
  assert.deepEqual(avisos, []);
});

test('camposComValores: só troca o valor das chaves que vieram; campos fora da resposta ficam como estavam', () => {
  const c = camposComValores(CAMPOS, { nome: 'Ana' });
  assert.equal((c[0] as any).valor, 'Ana');
  assert.equal(c[1], CAMPOS[1]);
});

// Cada tela corrigida (#187) salva pelo laço comum, e não com `urbiVerso.formulario` + alerta solto.
const raiz = (arq: string) => readFileSync(resolve(process.cwd(), arq), 'utf8');
const CORRIGIDAS: Array<[string, string]> = [
  ['frontend/telas/clientes.ts', 'Novo cliente'],
  ['frontend/telas/ficha-contato.ts', 'Mudar etapa'],
  ['frontend/telas/ficha-contato.ts', 'Registrar abordagem'],
  ['frontend/telas/ficha-contato.ts', 'Registrar envio'],
  ['frontend/telas/ficha-imovel.ts', 'Situação do imóvel'],
  ['frontend/telas/ficha-empreendimento.ts', 'Material'],
  ['frontend/telas/negociador-ajustes.ts', 'Convidar negociador'],
  ['frontend/telas/negociador-ajustes.ts', '`Minha resposta · ${o.titulo}`'],
  ['frontend/telas/pagina.ts', 'Nome e endereço'],
  ['frontend/telas/selecoes-cliente.ts', 'Nova seleção'],
  ['frontend/telas/selecoes-cliente.ts', 'Pedir ao cliente'],
  ['frontend/telas/corretores.ts', 'Convidar corretor'],
  ['frontend/telas/autorizacao-venda.ts', 'Marcar como assinada'],
  ['frontend/telas/conversas.ts', 'Nova conversa'],
  ['frontend/telas/clientes-quadro.ts', 'Por que perdeu?'],
  ['frontend/telas/estudio.ts', 'Textos da peça'],
  ['frontend/telas/estudio.ts', 'Agendar no Instagram'],
  ['frontend/telas/estudio.ts', 'Publiquei por fora'],
];

test('telas corrigidas (#187): o formulário que grava passa por formularioQueSalva', () => {
  const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (const [arq, titulo] of CORRIGIDAS) {
    const fonte = raiz(arq);
    const t = titulo.startsWith('`') ? escapar(titulo) : `'${escapar(titulo)}'`;
    assert.match(fonte, new RegExp(`formularioQueSalva(<[^>]+>)?\\(\\{\\s*titulo: ${t}`), `${arq}: ${titulo}`);
    assert.doesNotMatch(fonte, new RegExp(`urbiVerso\\.formulario(<[^>]+>)?\\(\\{\\s*titulo: ${t}`), `${arq}: ${titulo} ainda abre o formulário solto`);
  }
  // O envio do Conversas (título calculado) e o editar da Conta (título do chamador) também.
  assert.match(raiz('frontend/telas/conversas.ts'), /formularioQueSalva\(\{\s*titulo,\s*campos,/);
  assert.match(raiz('frontend/telas/conta.ts'), /formularioQueSalva\(\{\s*titulo,\s*campos,/);
  // E o `formularioEnviar` (16 telas) é o mesmo laço.
  assert.match(raiz('frontend/apoio.ts'), /return formularioQueSalva\(\{ titulo, campos, \.\.\.opcoes, salvar:/);
});

test('pedido ao shell 30 registrado (#187): formulário que valida no servidor sem fechar', () => {
  const pedidos = raiz('../../specs/pedidos_ao_shell.md');
  assert.match(pedidos, /## 30\. Formulário que valida no servidor sem fechar \(#187\)/);
  assert.match(pedidos, /aoEnviar/);
});
