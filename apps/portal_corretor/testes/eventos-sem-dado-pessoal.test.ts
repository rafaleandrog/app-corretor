import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import schema from '../schema.json';
import { rotas, webhooks, reagir } from '../backend/rotas';
import { limparLimites } from '../backend/publico';
import { http, publicar as publicarNoInstagram } from '../backend/instagram';
import { BancoFalso, comServidor, type Ator, type Unico } from './apoio';

// F4 (#136, adendo a) e #151: todo evento segregado do app leva só ids. Como membro da conta, o
// negociador humano lê pelo barramento todos os eventos dela, inclusive os de negociações que não são
// dele; o payload, então, não pode trazer nome, telefone nem e-mail. A exceção é o que nasce num handler
// de `wh`, onde o SDK 100 não deixa gravar em tabela segregada (wh.md, contas.md § Modo de conexão): o
// dado do visitante só chega ao listener pelo evento. Essas exceções ficam nomeadas aqui, uma a uma, e
// o teste exige que estejam documentadas como risco residual e pedidas ao shell (pedido 16).
//
// Três camadas: (1) o manifesto, porque o barramento recusa payload com chave a mais ou a menos
// (barramento.md § campos); (2) toda chamada de publicar/agendar no backend, inclusive as com o tipo
// numa variável; (3) em execução, um cenário que passa pelas rotas, webhooks e listeners de verdade
// até emitir TODOS os eventos do manifesto, com dado pessoal marcado em tudo o que entra.

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

// ------------------------------------------------------------------------------------------------
// O detector de dado pessoal no VALOR (o nome do campo é o teste 1)

/** As pessoas do cenário: todo nome, telefone e e-mail que entra no app sai daqui. */
const PESSOAS = [
  { nome: 'Zuléica Quaresma', telefone: '+55 (61) 98888-7777', email: 'zuleica.quaresma@exemplo.com' },
  { nome: 'Teodomiro Quintela', telefone: '(61) 97777-6666', email: 'teodomiro.q@exemplo.com.br' },
  { nome: 'Hermengarda Bastos', telefone: '61 9 6666-5555', email: 'hermengarda@exemplo.org' },
];
const semAcento = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
/** Cada parte do nome, sem acento; e os 8 últimos dígitos de cada telefone, que sobrevivem a qualquer formato. */
const NOMES = PESSOAS.flatMap((p) => semAcento(p.nome).split(' '));
const FINAIS = PESSOAS.map((p) => p.telefone.replace(/\D/g, '').slice(-8));
const EMAIL = /[^\s@<>()]+@[^\s@<>()]+\.[a-z]{2,}/i;

/**
 * O valor traz dado pessoal de alguém do cenário? Olha em qualquer nível (lista, objeto e as chaves
 * dele), em texto e em número: nome ou sobrenome sem distinguir caixa nem acento, telefone em qualquer
 * formato (só os dígitos contam) e qualquer e-mail, de quem quer que seja.
 */
function pessoal(v: unknown): boolean {
  if (v === null || v === undefined || typeof v === 'boolean' || v instanceof Date) return false;
  if (Array.isArray(v)) return v.some(pessoal);
  if (typeof v === 'object') return Object.entries(v as object).some(([k, x]) => pessoal(k) || pessoal(x));
  const s = String(v);
  const palavras = semAcento(s).split(/[^a-z]+/);
  if (NOMES.some((n) => palavras.includes(n))) return true;
  const digitos = s.replace(/\D/g, '');
  if (FINAIS.some((f) => digitos.includes(f))) return true;
  return EMAIL.test(s);
}

test('pessoal(): pega o dado em qualquer formato e nível, e não acusa id, código, valor nem data', () => {
  const positivos: unknown[] = [
    'Zuléica Quaresma',
    'ZULEICA',
    'zuleica',
    'Sra. Quaresma',
    'Sou a Zuléica, me liga',
    '+55 (61) 98888-7777',
    '61988887777',
    '5561988887777',
    '9 8888 7777',
    '98888.7777',
    61988887777,
    5561988887777,
    'zuleica.quaresma@exemplo.com',
    'ZULEICA.QUARESMA@EXEMPLO.COM',
    'outra.pessoa@qualquer.com.br',
    'escreve pra mim: a@b.io',
    ['IM-0001', 'Teodomiro'],
    { a: [{ b: 'fale com Hermengarda' }] },
    { 'Quintela': 1 },
    { contato: { telefone: '(61) 97777-6666' } },
  ];
  const negativos: unknown[] = [
    null,
    undefined,
    true,
    0,
    42,
    146_000_000,
    50_000_000,
    'IM-0001',
    'NG-0001',
    'abc123',
    'gostei',
    'conversar_preco',
    'proposta_nova',
    'whatsapp',
    'formulario',
    '2026-11-05T13:00:00.000Z',
    new Date(),
    { negociacao_id: 3, proposta_id: 7 },
    [1, 2, 3],
    '8888',
    '98888',
    'Quarta-feira',
    'zule',
    'quaresmeira no jardim',
    'arroba solta @ no texto',
    'sem@dominio',
  ];
  for (const v of positivos) assert.equal(pessoal(v), true, `devia acusar: ${JSON.stringify(v)}`);
  for (const v of negativos) assert.equal(pessoal(v), false, `não devia acusar: ${v instanceof Date ? 'Date' : JSON.stringify(v)}`);
});

// ------------------------------------------------------------------------------------------------
// (1) O manifesto

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

// ------------------------------------------------------------------------------------------------
// (2) Toda chamada de publicar/agendar do backend

/**
 * Chamadas cujo tipo vem numa variável: os repassadores (que recebem o tipo de quem chama com literal)
 * e o laço de assumir/devolver. Uma chamada nova assim não passa por aqui calada: cubra o caminho no
 * cenário em execução abaixo e acrescente-a nesta lista.
 */
const TIPO_EM_VARIAVEL: Record<string, string[]> = {
  'conversas.ts': ['evento', 'tipo'],
  'negociacao.ts': ['tipo'],
  'negociador.ts': ['evento', 'tipo'],
  'negociador-entrada.ts': ['tipo'],
  'publico.ts': ['tipo'],
};

/** Os argumentos de uma chamada a partir do `(`, separados na vírgula de nível zero (fora de parênteses, chaves e aspas). */
function argumentos(texto: string, abre: number): string[] {
  const args: string[] = [];
  let nivel = 0;
  let aspas: string | null = null;
  let atual = '';
  for (let i = abre + 1; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) {
      atual += c;
      if (c === aspas && texto[i - 1] !== '\\') aspas = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') aspas = c;
    else if ('([{'.includes(c)) nivel++;
    else if (')]}'.includes(c)) {
      if (nivel === 0) return [...args, atual.trim()];
      nivel--;
    } else if (c === ',' && nivel === 0) {
      args.push(atual.trim());
      atual = '';
      continue;
    }
    atual += c;
  }
  return args;
}

test('toda chamada de publicar/agendar do backend: tipo literal declarado, ou repassador conhecido', () => {
  const dir = resolve(process.cwd(), 'backend');
  const fonte = readdirSync(dir)
    .filter((f) => f.endsWith('.ts'))
    .map((f) => ({ f, texto: readFileSync(resolve(dir, f), 'utf8').replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '') }));
  const literais = new Set<string>();
  const variaveis: Record<string, string[]> = {};
  for (const { f, texto } of fonte) {
    for (const m of texto.matchAll(/\b(publicar|agendar)\(/g)) {
      const args = argumentos(texto, m.index! + m[0].length - 1);
      // Assinatura (`publicar(req: Request, tipo: string, …)`, `publicar(p: { … })`), não chamada.
      if (/^\w+\s*:/.test(args[0] ?? '')) continue;
      // O `publicar` da Graph API do Instagram (instagram.ts) recebe a peça, não um evento.
      if (f === 'instagram.ts' && m[1] === 'publicar' && args[0]?.startsWith('{')) continue;
      // Repassador com o `req` na frente: o tipo é o segundo argumento.
      const arg = args[0] === 'req' ? args[1] : args[0];
      // Tipo escolhido num ternário: valem só os dois ramos, não a condição.
      const tipo = arg.includes('?') ? arg.slice(arg.indexOf('?') + 1) : arg;
      const strings = [...tipo.matchAll(/'([^']*)'/g)].map((x) => x[1]);
      if (strings.length) {
        for (const s of strings) {
          assert.ok(eventos[s], `${f}: emite '${s}', que o manifesto não declara`);
          literais.add(s);
        }
      } else {
        assert.match(tipo, /^\w+$/, `${f}: tipo de evento numa expressão que o teste não lê (${tipo})`);
        (variaveis[f] ??= []).push(tipo);
      }
    }
  }
  for (const f of Object.keys(variaveis)) variaveis[f].sort();
  assert.deepEqual(
    variaveis,
    TIPO_EM_VARIAVEL,
    'chamada nova com o tipo do evento numa variável: cubra o caminho no cenário em execução deste arquivo e ponha-a em TIPO_EM_VARIAVEL',
  );
  // Declarado sem chamada com o nome literal só vale se o nome está no backend (o laço de assumir/devolver);
  // que ele sai de verdade, quem prova é o cenário em execução.
  const tudo = fonte.map((x) => x.texto).join('\n');
  for (const tipo of Object.keys(eventos)) assert.ok(literais.has(tipo) || tudo.includes(`'${tipo}'`), `${tipo}: declarado e nunca emitido`);
  // Os publicadores de negociação aceitam só número ou null: texto não passa nem pelo tipo.
  const assinatura = /publicar(?:\s*=\s*async\s*)?\(\s*(?:req: Request,\s*)?tipo: string,\s*payload: Record<string, number \| null>/;
  for (const f of ['negociacao.ts', 'negociador.ts', 'publico.ts']) assert.match(fonte.find((x) => x.f === f)!.texto, assinatura, `${f}: publicador de negociação só com ids`);
});

// ------------------------------------------------------------------------------------------------
// (3) Em execução: todos os eventos do app, pelos caminhos de verdade

/**
 * Barramento falso que recusa como o real: tipo não declarado e payload com chave a mais ou a menos
 * lançam (barramento.md § campos). Os publicadores do app engolem o erro e só avisam no log, então a
 * recusa fica guardada para o teste ver.
 */
function barramento() {
  const emitidos: { tipo: string; payload: Record<string, unknown>; via: 'publicar' | 'agendar'; conta?: unknown }[] = [];
  const recusas: string[] = [];
  const conferir = (tipo: string, payload: Record<string, unknown>) => {
    const def = eventos[tipo];
    const motivo = !def
      ? `${tipo}: não declarado`
      : Object.keys(payload).sort().join(',') !== [...def.campos].sort().join(',')
        ? `${tipo}: publicou [${Object.keys(payload).sort()}], declarado [${[...def.campos].sort()}]`
        : null;
    if (motivo) {
      recusas.push(motivo);
      throw new Error(`EVENTO_RECUSADO: ${motivo}`);
    }
  };
  let seq = 0;
  return {
    emitidos,
    recusas,
    publicar: async (tipo: string, payload: Record<string, unknown>, opcoes?: { conta_id?: unknown }) => {
      conferir(tipo, payload);
      emitidos.push({ tipo, payload, via: 'publicar', conta: opcoes?.conta_id });
      return { id: ++seq };
    },
    agendar: async (tipo: string, payload: Record<string, unknown>, o: { em: Date; conta_id?: unknown }) => {
      conferir(tipo, payload);
      emitidos.push({ tipo, payload, via: 'agendar', conta: o?.conta_id });
      return { id: ++seq };
    },
    cancelarAgendamento: async () => true,
  };
}

const EM_ANDAMENTO = (schema.tabelas.negociacoes.unicos as unknown[]).find((u) => !Array.isArray(u)) as Exclude<Unico, string>;
const UNICOS: Record<string, Unico[]> = {
  negociacoes: [EM_ANDAMENTO, 'codigo'],
  mandatos_negociacao: ['negociacao_id+versao'],
  playbook_objecoes: ['categoria+origem'],
  config_negociador: ['chave'],
  vitrine_publica: ['tipo+chave'],
  contatos: ['telefone'],
  imoveis: ['codigo'],
  perfis_corretor: ['usuario_id'],
};
const MANDATO = {
  preco_pedido_c: 150_000_000,
  alvo_c: 145_000_000,
  recuo_c: 136_000_000,
  batna_vendedor: 'Esperar a proposta do vizinho',
  concessoes: [{ item: 'prazo de entrega de 90 dias', limite: '90 dias', contrapartida: 'entrada de 30%' }],
  validade: '2099-12-31',
  autonomia: 'pergunta_antes',
};
const SOZINHO = { ...MANDATO, autonomia: 'faz_sozinho', autorizacao_proprietario: { tipo: 'mensagem', data: '2026-10-20' } };
const resposta = (r: Record<string, unknown>) => ({
  objecao: null, interesses_identificados: [], teto_estimado_comprador_c: null, fonte_estimativa: null, movimento: 'responder_objecao',
  contraproposta: null, mensagem: null, passar_ao_corretor: false, motivo: null, resumo_rodada: null, ...r,
});
const contraproposta = (valor_c: number, extra: Record<string, unknown> = {}) =>
  resposta({ movimento: 'contraproposta', contraproposta: { valor_c, condicoes: null, concessao: null, contrapartida: null, validade_horas: 48 }, mensagem: `Posso levar ${valor_c / 100} ao vendedor.`, ...extra });

/** `req.ia`/`ctx.ia` simulada, com a fila de respostas que o teste vai enchendo. */
function iaSimulada() {
  const fila: Record<string, unknown>[] = [];
  return {
    fila,
    estadoSlot: async (slot: string) => ({ pedido: slot, efetivo: { slot, origem: 'global' }, backup: null }),
    consultar: async () => {
      const dados = fila.shift();
      if (!dados) throw new Error('chamada de IA a mais');
      return { dados, modelo: 'teste', tokens_entrada: 1, tokens_saida: 1, duracao_ms: 1 };
    },
  };
}

/** O shell que as rotas usadas pedem: ingresso do portal (wh) e a URL da app. */
function shellFalso() {
  let n = 0;
  return {
    urlApp: (sub: string) => `https://corretor.exemplo/portal_corretor${sub}`,
    gerarIngressoWh: async ({ webhook }: { webhook: string }) => {
      n++;
      return { url: `https://corretor.exemplo/api/wh/portal_corretor/wh_${webhook}_${n}x`, token: `wh_${webhook}_${n}x`, ingresso_id: n, expira_em: null };
    },
    revogarIngressoWh: async () => ({ revogado: true }),
  };
}

/** Instagram falso (Graph API), só o que a conexão pede. */
function metaFalsa() {
  http.fetch = async (url: string) => {
    const ok = (dados: unknown) => new Response(JSON.stringify(dados), { status: 200, headers: { 'Content-Type': 'application/json' } });
    if (url.startsWith('https://api.instagram.com/oauth/access_token')) return ok({ access_token: 'curto', user_id: 999 });
    if (url.includes('grant_type=ig_exchange_token')) return ok({ access_token: 'longo-1', expires_in: 5184000 });
    if (url.includes('/me?')) return ok({ user_id: '17841400000000001', username: 'corretor.teste', account_type: 'BUSINESS' });
    return new Response(JSON.stringify({ error: { message: 'inesperado', code: 1 } }), { status: 400 });
  };
  publicarNoInstagram.esperaMs = 0;
}

const notificacoes = { notificar: async () => ({ ok: true }), notificarAdmins: async () => {} };
const arquivos = { url: async (id: number) => `/api/arquivos/${id}?token=x` };
const parametros = { obter: async (slug: string) => ({ meta_app_id: '123456', meta_app_secret: 'segredo-do-app' } as Record<string, string>)[slug] ?? null };
const HOJE = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
const dia = (delta: number) => new Date(Date.now() + delta * 86400e3).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });

type Chamar = (metodo: string, caminho: string, corpo?: unknown) => Promise<{ status: number; corpo: any }>;
const ok = async (p: Promise<{ status: number; corpo: any }>, onde: string) => {
  const r = await p;
  assert.ok(r.status < 300, `${onde}: ${r.status} ${JSON.stringify(r.corpo)}`);
  return r.corpo;
};

test('em execução: todos os eventos do app, pelos caminhos reais, com dado pessoal só nos campos residuais', async () => {
  limparLimites();
  metaFalsa();
  const banco = new BancoFalso(UNICOS);
  const bus = barramento();
  const ia = iaSimulada();
  const shell = shellFalso();
  const A: Ator = { usuario: 1, conta: 100, papeis: ['corretor'], extras: { eventos: bus, ia, notificacoes, arquivos, parametros } };
  const ctx = { ...banco.ctxSistema([{ id: 100, nome: 'A' }]), eventos: bus, ia, notificacoes, arquivos, shell };
  const [zu, teo, her] = PESSOAS;
  const fala = (p: (typeof PESSOAS)[number]) => `Sou ${p.nome}, ${p.telefone}, ${p.email}`;

  // Webhook → listener, como a plataforma entrega: o handler publica e o listener recebe o mesmo payload.
  const webhook = async (nome: keyof typeof webhooks, contexto: Record<string, unknown>, corpo: unknown, ip: string) => {
    const r: any = { status: 200 };
    r.res = { status: (s: number) => ((r.status = s), r.res), json: (c: unknown) => ((r.corpo = c), r.res) };
    const antes = bus.emitidos.length;
    const req: any = { body: corpo, headers: {}, ip, wh: { webhook: nome, modo: 'recorrente', ingresso_id: 1, contexto, contador_usos: 0, criado_por: 1 }, eventos: bus };
    await webhooks[nome](req, r.res);
    assert.equal(r.status, 200, `${nome}: ${JSON.stringify(r.corpo)}`);
    for (const e of bus.emitidos.slice(antes)) {
      const listener = (reagir as Record<string, (ev: unknown, c: unknown) => Promise<unknown>>)[e.tipo];
      if (listener) await listener({ payload: e.payload, conta_id: e.conta }, ctx);
    }
  };

  let ids = { zu: 0, teo: 0 } as Record<string, number>;
  let n1 = 0;
  let n3 = 0;
  await comServidor(rotas, A, banco, shell, async (chamar: Chamar) => {
    // Pessoas: cliente, cliente do portal, e o perfil do corretor com dado da terceira.
    ids.zu = (await ok(chamar('POST', '/contatos', { nome: zu.nome, telefone: zu.telefone, email: zu.email }), 'contato 1')).id;
    ids.teo = (await ok(chamar('POST', '/contatos', { nome: teo.nome, telefone: teo.telefone, email: teo.email }), 'contato 2')).id;
    await ok(chamar('PUT', '/conta/meu-perfil', { creci: 'DF-12345-F', telefone: her.telefone }), 'perfil');

    // Conversas (P02, D-116): a conversa do cliente, o texto pelo WhatsApp do celular (mensagem_enviada).
    const cz = (await ok(chamar('POST', '/conversas', { contato_id: ids.zu }), 'conversa')).conversa.id;
    await ok(chamar('POST', `/conversas/${cz}/mensagens`, { texto: fala(zu) }), 'mensagem'); // mensagem_enviada

    // lembrete_visita (agendar): visita com o cliente.
    await ok(chamar('POST', '/atividades', { tipo: 'visita', titulo: `Visita com ${zu.nome}`, quando: new Date(Date.now() + 3 * 86400e3).toISOString(), contato_id: ids.zu, local: 'Lago Sul' }), 'visita');

    // Negociação 1, pelas rotas do corretor (pergunta antes).
    const d = banco.dados(100);
    const im1 = await d.criar('imoveis', { codigo: 'IM-9901', titulo: 'Apto Asa Sul', preco_c: MANDATO.preco_pedido_c });
    const ng1 = await d.criar('negocios', { contato_id: ids.zu, titulo: `Compra ${zu.nome}`, pipeline: 'compra', etapa_id: 1, responsavel_id: 1 });
    n1 = (await ok(chamar('POST', '/negociacoes', { negocio_id: ng1.id, imovel_id: im1.id }), 'negociação 1')).id; // negociacao_iniciada
    await ok(chamar('PUT', `/negociacoes/${n1}/mandato`, MANDATO), 'mandato 1'); // mandato_alterado
    const oferta = await ok(chamar('POST', `/negociacoes/${n1}/propostas`, { direcao: 'comprador', valor_c: 140_000_000, condicoes: fala(zu) }), 'oferta'); // proposta_recebida
    // objecao_detectada e contraproposta_sugerida: a IA acha a objeção e sugere dentro do mandato.
    ia.fila.push(contraproposta(146_000_000, { objecao: { categoria: 'preco', trecho: fala(zu) } }));
    const s = await ok(chamar('POST', `/negociacoes/${n1}/sugestao`, { mensagem_cliente: fala(zu) }), 'sugestão');
    await ok(chamar('POST', `/negociacoes/${n1}/decisao`, { acao: 'aprovar', execucao_id: s.execucao_id, canal: 'wa_me' }), 'aprovar'); // contraproposta_enviada
    await ok(chamar('POST', `/negociacoes/${n1}/propostas`, { direcao: 'vendedor', valor_c: 146_000_000, condicoes: fala(her) }), 'registro'); // proposta_registrada
    await ok(chamar('POST', `/negociacoes/${n1}/assumir`), 'assumir'); // negociacao_assumida
    await ok(chamar('POST', `/negociacoes/${n1}/devolver`), 'devolver'); // negociacao_devolvida
    // A conversa segue a negociação: devolvida ao Negociador, depois assumida (conversa_devolvida, conversa_assumida).
    await ok(chamar('POST', `/conversas/${cz}/devolver`), 'conversa devolvida');
    await ok(chamar('POST', `/conversas/${cz}/assumir`), 'conversa assumida');
    // Envio de imóvel ao cliente: envio_criado e a mensagem na conversa (mensagem_enviada).
    await ok(chamar('POST', '/envios', { contato_id: ids.zu, tipo: 'imovel', imovel_id: im1.id, canal: 'whatsapp', descricao: fala(zu) }), 'envio');
    await ok(chamar('POST', `/negociacoes/${n1}/decisao`, { acao: 'aceitar_acordo', proposta_id: oferta.id }), 'acordo'); // negociacao_acordo_proposto
    await ok(chamar('PATCH', `/negociacoes/${n1}`, { estado: 'ganha', valor_final_c: 140_000_000 }), 'encerrar'); // negociacao_encerrada

    // Negociação 2: oferta abaixo do recuo, o Negociador passa ao corretor (negociacao_limite_atingido).
    const ng2 = await d.criar('negocios', { contato_id: ids.zu, titulo: 'Compra 2', pipeline: 'compra', etapa_id: 1, responsavel_id: 1 });
    const n2 = (await ok(chamar('POST', '/negociacoes', { negocio_id: ng2.id, imovel_id: im1.id }), 'negociação 2')).id;
    await ok(chamar('PUT', `/negociacoes/${n2}/mandato`, MANDATO), 'mandato 2');
    await ok(chamar('POST', `/negociacoes/${n2}/propostas`, { direcao: 'comprador', valor_c: 120_000_000 }), 'oferta baixa');
    ia.fila.push(contraproposta(146_000_000));
    await ok(chamar('POST', `/negociacoes/${n2}/sugestao`, { mensagem_cliente: fala(zu) }), 'sugestão 2');

    // Negociação 3, do cliente do portal, com o Negociador fazendo sozinho.
    await ok(chamar('POST', `/contatos/${ids.teo}/portal`), 'link do portal');
    const im3 = await d.criar('imoveis', { codigo: 'IM-9903', titulo: 'Casa Lago', preco_c: MANDATO.preco_pedido_c });
    const ng3 = await d.criar('negocios', { contato_id: ids.teo, titulo: `Compra ${teo.nome}`, pipeline: 'compra', etapa_id: 1, responsavel_id: 1 });
    n3 = (await ok(chamar('POST', '/negociacoes', { negocio_id: ng3.id, imovel_id: im3.id }), 'negociação 3')).id;
    await ok(chamar('PUT', `/negociacoes/${n3}/mandato`, SOZINHO), 'mandato 3');
  });

  // publicacao_programada (agendar): peça aprovada, Instagram conectado. Sem IA (o Estúdio degrada para o texto padrão).
  await comServidor(rotas, { ...A, extras: { eventos: bus, notificacoes, arquivos, parametros } }, banco, shell, async (chamar: Chamar) => {
    const im = await ok(chamar('POST', '/imoveis', { tipo: 'casa', cidade: 'Brasília', bairro: 'Lago Sul', titulo: 'Casa' }), 'imóvel');
    await ok(chamar('PATCH', `/imoveis/${im.id}`, { preco: 2500000 }), 'preço');
    const dono = await ok(chamar('POST', '/contatos', { nome: her.nome, telefone: her.telefone, email: her.email }), 'proprietária');
    const aut = await ok(chamar('POST', '/autorizacoes', { imovel_id: im.id, proprietario_id: dono.id, inicio: HOJE, fim: dia(60), comissao_pct: '5', preco_autorizado: '2.500.000' }), 'autorização');
    await ok(chamar('POST', `/imoveis/${im.id}/midias`, { upload_id: 1, tipo: 'foto' }), 'foto');
    const doc = await ok(chamar('POST', `/imoveis/${im.id}/midias`, { upload_id: 2, tipo: 'documento' }), 'documento');
    await ok(chamar('PATCH', `/autorizacoes/${aut.id}`, { documento_midia_id: doc.id, situacao: 'assinada' }), 'assinada');
    await ok(chamar('PATCH', `/imoveis/${im.id}`, { situacao: 'ativo' }), 'anunciado');
    const peca = (await ok(chamar('POST', '/estudio/pedido', { imovel_id: im.id, objetivo: 'novo_imovel', formatos: ['post_1x1'] }), 'pedido')).pecas[0];
    await ok(chamar('PUT', `/estudio/pecas/${peca.id}/arquivos`, { upload_ids: [11], motor: 'canva_ia' }), 'arte');
    await ok(chamar('POST', `/estudio/pecas/${peca.id}/aprovar`), 'aprovar peça');
    await ok(chamar('POST', '/conexoes/instagram/retorno', { code: 'x' }), 'instagram');
    await ok(chamar('POST', `/estudio/pecas/${peca.id}/agendar`, { quando: new Date(Date.now() + 2 * 3600e3).toISOString() }), 'agendar');
  });

  // Pelo portal (webhook → listener): nova oferta, o motor responde sozinho (proposta_recebida e
  // contraproposta_enviada pelo listener), e o cliente aceita a resposta (proposta_aceite_cliente).
  ia.fila.push(contraproposta(146_000_000));
  await webhook('acao_cliente', { conta_id: 100, contato_id: ids.teo }, { tipo: 'proposta_nova', negociacao: n3, valor_c: 140_000_000, texto: fala(teo) }, '10.9.0.1');
  const resposta3 = banco.linhas('propostas').filter((p) => p.negociacao_id === n3 && p.direcao === 'vendedor').at(-1);
  assert.ok(resposta3, 'o Negociador respondeu pelo portal');
  await webhook('acao_cliente', { conta_id: 100, contato_id: ids.teo }, { tipo: 'proposta_aceite', negociacao: n3, proposta: resposta3!.id, texto: fala(teo) }, '10.9.0.2');
  await webhook('acao_cliente', { conta_id: 100, contato_id: ids.teo }, { tipo: 'mensagem', texto: fala(teo), negociacao: n3 }, '10.9.0.3');

  // Reação "conversar sobre o preço" numa seleção: o gatilho do listener abre a negociação (negociacao_iniciada pelo listener).
  const d = banco.dados(100);
  const aberta = await d.criar('etapas_funil', { pipeline: 'compra', nome: 'Visitou', tipo: 'aberta', ordem: 4, ativa: true, marco: 'visitou', probabilidade: 0.5 });
  const im4 = await d.criar('imoveis', { codigo: 'IM-9800', titulo: 'Cobertura', preco_c: MANDATO.preco_pedido_c });
  await d.criar('negocios', { contato_id: ids.zu, titulo: 'Compra cobertura', pipeline: 'compra', etapa_id: aberta.id, responsavel_id: 1, imovel_id: im4.id });
  const selecao = await d.criar('selecoes', { contato_id: ids.zu, titulo: 'Para você', expira_em: new Date(Date.now() + 86400e3).toISOString() });
  await d.criar('selecao_itens', { selecao_id: selecao.id, imovel_id: im4.id, ordem: 0 });
  await webhook('reacao_selecao', { conta_id: 100, selecao_id: selecao.id }, { imovel_codigo: 'IM-9800', reacao: 'conversar_preco', comentario: fala(zu) }, '10.9.0.4');

  // Página do corretor: contato pelo formulário e clique no link.
  await webhook('formulario_lead', { conta_id: 100 }, { nome: her.nome, telefone: her.telefone, email: her.email, mensagem: fala(her), imovel_codigo: 'IM-9901', consentimento: true }, '10.9.0.5');
  await webhook('clique_link', { conta_id: 100 }, { codigo: 'abc123' }, '10.9.0.6');

  // Nenhuma recusa: todo payload com exatamente as chaves do manifesto.
  assert.deepEqual(bus.recusas, []);
  // A conta (issue #157): o cenário é todo da conta 100; nenhum evento sai declarando outra.
  for (const e of bus.emitidos) assert.ok(e.conta === undefined || e.conta === 100, `${e.tipo}: conta ${String(e.conta)}`);
  // Todos os eventos do manifesto saíram de verdade. Evento novo no manifesto sem caminho aqui reprova.
  const saidos = new Set(bus.emitidos.map((e) => e.tipo));
  assert.deepEqual(Object.keys(eventos).filter((t) => !saidos.has(t)), [], 'eventos do manifesto que o cenário não emitiu: acrescente o caminho');
  // Os caminhos do listener (repassadores com o tipo em variável) emitiram, e na conta certa.
  const doListener = bus.emitidos.filter((e) => e.via === 'publicar' && e.conta !== undefined);
  for (const tipo of ['negociacao_iniciada', 'proposta_recebida', 'proposta_aceite_cliente', 'contraproposta_enviada', 'mensagem_recebida']) {
    assert.ok(doListener.some((e) => e.tipo === tipo && e.conta === 100), `${tipo} pelo listener, na conta 100`);
  }
  // Nenhum valor fora dos campos residuais traz o dado pessoal que entrou, e os que não são residuais são id, código ou valor.
  for (const { tipo, payload } of bus.emitidos) {
    for (const [campo, valor] of Object.entries(payload)) {
      if (RESIDUAL[tipo]?.includes(campo)) continue;
      assert.ok(!pessoal(valor), `${tipo}.${campo}: dado pessoal fora dos residuais (${JSON.stringify(valor)})`);
      assert.ok(valor === null || typeof valor === 'number' || (NAO_PESSOAIS.has(campo) && typeof valor === 'string'), `${tipo}.${campo}: só id, número ou código (${JSON.stringify(valor)})`);
    }
  }
  // Oferta e aceite pelo portal não levam o texto livre: só ids e o valor.
  const acoesPortal = bus.emitidos.filter((x) => x.tipo === 'acao_cliente_recebida' && x.payload.tipo !== 'mensagem');
  assert.deepEqual(acoesPortal.map((e) => e.payload.tipo).sort(), ['proposta_aceite', 'proposta_nova'], 'oferta e aceite pelo portal emitiram');
  for (const e of acoesPortal) assert.equal(e.payload.texto, null, `${e.payload.tipo}: sem texto`);
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
