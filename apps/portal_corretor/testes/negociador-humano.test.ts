import { test } from 'node:test';
import assert from 'node:assert/strict';
import schema from '../schema.json';
import manifesto from '../manifesto.json';
import { rotas } from '../backend/rotas';
import { CAMPOS_SIGILOSOS } from '../comum/negociacao';
import { BancoFalso, comServidor, type Ator, type Unico } from './apoio';

// Negociador humano (D7, issue #106): manifesto, convite sem CRECI com os erros do SDK traduzidos e 503
// sem `req.shell`, atribuição pelo corretor só na própria conta, e a matriz do papel `negociador`: só as
// negociações atribuídas, o mandato completo em leitura (decisão do dono, spec 11.6 e 14) e nenhum
// recuo, alvo nem BATNA nas outras respostas de `/negociacoes*` nem nos eventos, a resposta do vendedor
// pelas validações de 10.9.7, nunca o aceite final, e as outras áreas fechadas.

const EM_ANDAMENTO = (schema.tabelas.negociacoes.unicos as unknown[]).find((u) => !Array.isArray(u)) as Exclude<Unico, string>;
const UNICOS: Record<string, Unico[]> = { negociacoes: [EM_ANDAMENTO, 'codigo'], mandatos_negociacao: ['negociacao_id+versao'], playbook_objecoes: ['categoria+origem'], config_negociador: ['chave'] };

const PEDIDO = 150_000_000;
const ALVO = 145_123_456;
const RECUO = 136_654_321;
const BATNA = 'Manter-anunciado-e-esperar-o-vizinho';
const MANDATO = {
  preco_pedido_c: PEDIDO,
  alvo_c: ALVO,
  recuo_c: RECUO,
  batna_vendedor: BATNA,
  concessoes: [{ item: 'prazo de entrega de 90 dias', limite: '90 dias', contrapartida: 'entrada de 30%' }],
  validade: '2099-12-31',
  autonomia: 'pergunta_antes',
};

type Chamar = (metodo: string, caminho: string, corpo?: unknown) => Promise<{ status: number; corpo: any }>;

function eventosFalsos() {
  const publicados: { tipo: string; payload: Record<string, unknown> }[] = [];
  return { publicados, publicar: async (tipo: string, payload: Record<string, unknown>) => (publicados.push({ tipo, payload }), { id: publicados.length }) };
}

/** IA que devolve, em ordem, as respostas dadas. */
function iaSimulada(respostas: Record<string, unknown>[]) {
  return {
    estadoSlot: async (slot: string) => ({ pedido: slot, efetivo: { slot, origem: 'global' }, backup: null }),
    consultar: async () => {
      const dados = respostas.shift();
      if (!dados) throw new Error('chamada de IA a mais');
      return { dados, modelo: 'teste', tokens_entrada: 1, tokens_saida: 1, duracao_ms: 1 };
    },
  };
}

const contraproposta = (valor_c: number) => ({
  objecao: null,
  interesses_identificados: [],
  teto_estimado_comprador_c: null,
  fonte_estimativa: null,
  movimento: 'contraproposta',
  contraproposta: { valor_c, condicoes: null, concessao: null, contrapartida: null, validade_horas: 48 },
  mensagem: null,
  passar_ao_corretor: false,
  motivo: null,
  resumo_rodada: null,
});

interface ConviteFalso {
  id: number;
  intencao: 'criar_conta' | 'admitir_existente';
  credencial: string;
  status: string;
  usuarioId: number | null;
  contaId: number | null;
  contaAlvo: number | null;
  contaNome: string | null;
}

/**
 * Dublê de `req.shell` com os convites da instância. Negociadores: 5 (aceitou na conta 100, com papel),
 * 7 (aceitou na conta 100, sem o papel ainda) e 6 (aceitou na conta 200, com papel). O 1 é o corretor
 * da conta 100 (convite de criar conta, que não é de negociador).
 */
function shellFalso(falha?: { codigo: string; status?: number }) {
  const chamadas: unknown[] = [];
  const convites: ConviteFalso[] = [
    { id: 1, intencao: 'criar_conta', credencial: 'corretor@a.com', status: 'resgatado', usuarioId: 1, contaId: 100, contaAlvo: null, contaNome: 'Conta A' },
    { id: 2, intencao: 'admitir_existente', credencial: 'neg5@a.com', status: 'resgatado', usuarioId: 5, contaId: 100, contaAlvo: 100, contaNome: null },
    { id: 3, intencao: 'admitir_existente', credencial: 'neg7@a.com', status: 'resgatado', usuarioId: 7, contaId: 100, contaAlvo: 100, contaNome: null },
    { id: 4, intencao: 'admitir_existente', credencial: 'neg6@b.com', status: 'resgatado', usuarioId: 6, contaId: 200, contaAlvo: 200, contaNome: null },
    { id: 5, intencao: 'admitir_existente', credencial: 'pendente@b.com', status: 'emitido', usuarioId: null, contaId: null, contaAlvo: 200, contaNome: null },
  ];
  const revogados: number[] = [];
  return {
    chamadas,
    convites,
    revogados,
    listarUsuariosPorRole: async (role: string) => (role === 'negociador' ? [5, 6] : []),
    externos: {
      convidar: async (o: Record<string, unknown>) => {
        chamadas.push(o);
        if (falha) throw Object.assign(new Error(`falha ${falha.codigo}`), falha);
        const id = convites.length + 1;
        convites.push({ id, intencao: 'admitir_existente', credencial: String(o.email), status: 'emitido', usuarioId: null, contaId: null, contaAlvo: Number(o.contaId), contaNome: null });
        return { conviteId: id, vigenteAte: new Date('2099-01-01') };
      },
      listarConvites: async (o: { contaAlvo?: number; status?: string } = {}) => {
        const lista = convites
          .filter((c) => o.contaAlvo === undefined || (c.contaAlvo ?? c.contaId) === o.contaAlvo)
          .filter((c) => !o.status || c.status === o.status)
          .map((c) => ({ ...c, appId: 'portal_corretor', vigenteAte: new Date('2099-01-01'), criadoEm: new Date('2026-10-01') }));
        return { convites: lista, total: lista.length, limite: 200, deslocamento: 0 };
      },
      revogarConvite: async ({ conviteId }: { conviteId: number }) => {
        revogados.push(conviteId);
        return { conviteId };
      },
    },
  };
}

async function base(banco: BancoFalso, conta: number, n = 1) {
  const d = banco.dados(conta);
  const contato = await d.criar('contatos', { nome: `Ana ${conta}-${n}`, telefone: '+5561988887777' });
  const negocio = await d.criar('negocios', { contato_id: contato.id, titulo: 'Compra apto', pipeline: 'compra', etapa_id: 1, responsavel_id: 1 });
  const imovel = await d.criar('imoveis', { codigo: `IM-000${n}`, titulo: 'Apto Asa Sul', preco_c: PEDIDO });
  return { contato, negocio, imovel };
}

async function negociacaoPronta(chamar: Chamar, b: Awaited<ReturnType<typeof base>>) {
  const n = await chamar('POST', '/negociacoes', { negocio_id: b.negocio.id, imovel_id: b.imovel.id });
  assert.equal(n.status, 201, JSON.stringify(n.corpo));
  const m = await chamar('PUT', `/negociacoes/${n.corpo.id}/mandato`, MANDATO);
  assert.equal(m.status, 200, JSON.stringify(m.corpo));
  return n.corpo.id as number;
}

/** Nenhum valor sigiloso e nenhum campo sigiloso no JSON inteiro da resposta. */
function semSigiloNaResposta(corpo: unknown, onde: string) {
  const texto = JSON.stringify(corpo ?? null);
  assert.ok(!texto.includes(String(RECUO)), `${onde}: recuo vazou`);
  assert.ok(!texto.includes(String(ALVO)), `${onde}: alvo vazou`);
  assert.ok(!texto.includes(BATNA), `${onde}: BATNA vazou`);
  for (const campo of CAMPOS_SIGILOSOS) assert.ok(!texto.includes(`"${campo}"`), `${onde}: campo ${campo} presente`);
}

const corretor = (usuario: number, conta: number, extras: Record<string, unknown> = {}): Ator => ({ usuario, conta, papeis: ['corretor'], extras });
const negociador = (usuario: number, conta: number, extras: Record<string, unknown> = {}): Ator => ({ usuario, conta, papeis: ['negociador'], extras });

test('manifesto: papel externo negociador (escrita) e o corretor convida para a própria conta', () => {
  const m = manifesto as unknown as { roles: Record<string, Record<string, string>>; roles_externos: Record<string, Record<string, string>>; provisiona_externos: Record<string, string> };
  assert.ok(m.roles_externos.escrita.negociador, 'roles_externos.escrita.negociador');
  assert.equal(m.provisiona_externos.papel_externo, 'corretor');
  assert.equal(m.provisiona_externos.papel, 'operacao');
  // Slug único entre os dois blocos (permissoes.md): negociador não está no bloco da equipe.
  for (const nivel of Object.values(m.roles)) assert.ok(!('negociador' in nivel));
  assert.ok(!('admin' in m.roles_externos), 'roles_externos não tem grupo admin');
});

test('convite: só o e-mail, para a conta ativa do corretor, sem campo de CRECI', async () => {
  const banco = new BancoFalso(UNICOS);
  const shell = shellFalso();
  await comServidor(rotas, corretor(1, 100), banco, shell, async (chamar) => {
    const r = await chamar('POST', '/negociador/convites', { email: ' Novo@Exemplo.com ', creci: 'DF-123-F', contaId: 200, conta: 'outra' });
    assert.equal(r.status, 201, JSON.stringify(r.corpo));
    assert.deepEqual(shell.chamadas, [{ email: 'novo@exemplo.com', contaId: 100 }], 'nada além do e-mail e da conta ativa');
    const invalido = await chamar('POST', '/negociador/convites', { email: 'sem-arroba' });
    assert.deepEqual([invalido.status, invalido.corpo.codigo], [422, 'DADOS_INVALIDOS']);
    assert.equal(shell.chamadas.length, 1);
    // A lista mostra só os convites de negociador desta conta (o de criar a conta do corretor fica fora).
    const lista = await chamar('GET', '/negociador/convites');
    assert.equal(lista.status, 200);
    assert.deepEqual(lista.corpo.convites.map((c: { email: string }) => c.email).sort(), ['neg5@a.com', 'neg7@a.com', 'novo@exemplo.com']);
    for (const c of lista.corpo.convites) assert.ok(!('creci' in c));
  });
});

test('convite: os erros do SDK chegam traduzidos, com o código e o HTTP do SDK', async () => {
  const casos: [{ codigo: string; status?: number }, number, RegExp][] = [
    [{ codigo: 'CONVITE_MULTI_USUARIO_BLOQUEADO', status: 409 }, 409, /multi-usuário/],
    [{ codigo: 'CONVITE_MULTI_USUARIO_BLOQUEADO' }, 409, /multi-usuário/],
    [{ codigo: 'CONVITE_CONTA_DIVERGENTE', status: 409 }, 409, /outra conta/],
    [{ codigo: 'CONVITE_IDENTIDADE_INTERNA', status: 409 }, 409, /equipe da plataforma/],
    [{ codigo: 'PROVISIONA_NAO_DECLARADA', status: 403 }, 403, /suporte/],
    [{ codigo: 'PROVISIONA_NAO_LIBERADA', status: 403 }, 403, /admitir em conta existente/],
    [{ codigo: 'PROVISIONA_CONTA_ALHEIA', status: 403 }, 403, /própria conta/],
    [{ codigo: 'PLANO_ASSENTOS_ESGOTADOS', status: 409 }, 409, /lugares/],
    [{ codigo: 'CONVITE_JA_PENDENTE', status: 409 }, 409, /pendente/],
  ];
  for (const [falha, status, mensagem] of casos) {
    await comServidor(rotas, corretor(1, 100), new BancoFalso(UNICOS), shellFalso(falha), async (chamar) => {
      const r = await chamar('POST', '/negociador/convites', { email: 'pessoa@exemplo.com' });
      assert.equal(r.status, status, falha.codigo);
      assert.equal(r.corpo.codigo, falha.codigo);
      assert.match(r.corpo.mensagem, mensagem, falha.codigo);
    });
  }
  // A entrega do e-mail falhou, mas o convite existe: 202 com o aviso, nunca erro.
  await comServidor(rotas, corretor(1, 100), new BancoFalso(UNICOS), shellFalso({ codigo: 'CONVITE_EMAIL_FALHOU', status: 502 }), async (chamar) => {
    const r = await chamar('POST', '/negociador/convites', { email: 'pessoa@exemplo.com' });
    assert.equal(r.status, 202);
    assert.match(r.corpo.aviso, /e-mail não saiu/);
  });
});

test('sem req.shell (ou sem externos): 503 nas rotas de convite e de negociadores, nunca 500', async () => {
  for (const shell of [undefined, {}, { listarUsuariosPorRole: async () => [] }]) {
    const banco = new BancoFalso(UNICOS);
    await comServidor(rotas, corretor(1, 100), banco, shell as Record<string, unknown>, async (chamar) => {
      for (const [metodo, caminho, corpo] of [
        ['GET', '/negociador/convites'],
        ['POST', '/negociador/convites', { email: 'a@b.com' }],
        ['POST', '/negociador/convites/2/revogar', {}],
        ['GET', '/negociador/negociadores'],
      ] as [string, string, unknown?][]) {
        const r = await chamar(metodo, caminho, corpo);
        assert.deepEqual([r.status, r.corpo.codigo], [503, 'CONVITE_INDISPONIVEL'], `${metodo} ${caminho}`);
      }
    });
  }
});

test('revogar: só o convite de negociador da própria conta; o de outra conta é 404', async () => {
  const shell = shellFalso();
  await comServidor(rotas, corretor(1, 100), new BancoFalso(UNICOS), shell, async (chamar) => {
    assert.equal((await chamar('POST', '/negociador/convites/5/revogar', {})).status, 404, 'convite da conta 200');
    assert.equal((await chamar('POST', '/negociador/convites/1/revogar', {})).status, 404, 'convite de criar conta não é de negociador');
    assert.equal((await chamar('POST', '/negociador/convites/2/revogar', {})).status, 200);
  });
  assert.deepEqual(shell.revogados, [2]);
});

test('atribuição: o corretor atribui e retira; B não atribui negociação de A nem negociador de A', async () => {
  const banco = new BancoFalso(UNICOS);
  const shell = shellFalso();
  const ev = eventosFalsos();
  const a = await base(banco, 100);
  const b = await base(banco, 200);
  let nidA = 0;
  let nidB = 0;
  let atribuicao = 0;
  await comServidor(rotas, corretor(1, 100, { eventos: ev }), banco, shell, async (chamar) => {
    nidA = await negociacaoPronta(chamar, a);
    const disponiveis = await chamar('GET', '/negociador/negociadores');
    assert.deepEqual(disponiveis.corpo.dados, [
      { usuario_id: 5, email: 'neg5@a.com', tem_papel: true },
      { usuario_id: 7, email: 'neg7@a.com', tem_papel: false },
    ]);
    // Sem o papel ainda: recusa explicando o passo do administrador.
    const semPapel = await chamar('POST', '/negociador/atribuicoes', { negociacao_id: nidA, usuario_id: 7 });
    assert.deepEqual([semPapel.status, semPapel.corpo.codigo], [409, 'NEGOCIADOR_SEM_PAPEL']);
    // O negociador da conta B não é desta conta.
    const alheio = await chamar('POST', '/negociador/atribuicoes', { negociacao_id: nidA, usuario_id: 6 });
    assert.deepEqual([alheio.status, alheio.corpo.codigo], [404, 'NEGOCIADOR_NAO_ENCONTRADO']);
    const r = await chamar('POST', '/negociador/atribuicoes', { negociacao_id: nidA, usuario_id: 5 });
    assert.equal(r.status, 201, JSON.stringify(r.corpo));
    atribuicao = r.corpo.id;
    // De novo, para a mesma pessoa: a mesma atribuição, sem duplicar.
    const de_novo = await chamar('POST', '/negociador/atribuicoes', { negociacao_id: nidA, usuario_id: 5 });
    assert.deepEqual([de_novo.status, de_novo.corpo.id], [200, atribuicao]);
    const n = await chamar('GET', `/negociacoes/${nidA}`);
    assert.equal(n.corpo.conduzida_por, 'humano');
    assert.equal(n.corpo.negociador_usuario_id, 5);
  });
  assert.equal(banco.linhas('atribuicoes_negociacao').filter((l) => l.ativa).length, 1);
  await comServidor(rotas, corretor(2, 200, { eventos: ev }), banco, shell, async (chamar) => {
    nidB = await negociacaoPronta(chamar, b);
    // A negociação de A não existe para B.
    const r = await chamar('POST', '/negociador/atribuicoes', { negociacao_id: nidA, usuario_id: 6 });
    assert.deepEqual([r.status, r.corpo.codigo], [404, 'NAO_ENCONTRADO']);
    // O negociador de A não é de B.
    const x = await chamar('POST', '/negociador/atribuicoes', { negociacao_id: nidB, usuario_id: 5 });
    assert.deepEqual([x.status, x.corpo.codigo], [404, 'NEGOCIADOR_NAO_ENCONTRADO']);
    // A atribuição de A também não: nem listar, nem retirar.
    assert.deepEqual((await chamar('GET', '/negociador/atribuicoes')).corpo.dados, []);
    assert.equal((await chamar('PATCH', `/negociador/atribuicoes/${atribuicao}`, { ativa: false })).status, 404);
  });
  assert.equal(banco.linhas('atribuicoes_negociacao').find((l) => l.id === atribuicao)!.ativa, true, 'B não mexeu na de A');
  for (const l of banco.linhas('atribuicoes_negociacao')) assert.equal(l.conta_id, 100);
  await comServidor(rotas, corretor(1, 100, { eventos: ev }), banco, shell, async (chamar) => {
    assert.equal((await chamar('PATCH', `/negociador/atribuicoes/${atribuicao}`, { ativa: 'nao' })).status, 422);
    const r = await chamar('PATCH', `/negociador/atribuicoes/${atribuicao}`, { ativa: false });
    assert.equal(r.status, 200);
    assert.equal(r.corpo.ativa, false);
    const n = await chamar('GET', `/negociacoes/${nidA}`);
    assert.equal(n.corpo.conduzida_por, 'corretor', 'volta ao corretor');
    assert.equal(n.corpo.negociador_usuario_id ?? null, null);
  });
});

test('matriz do negociador: só as atribuídas, mandato completo, sem sigilo no resto de /negociacoes*, sem aceite, outras áreas fechadas', async () => {
  const banco = new BancoFalso(UNICOS);
  const shell = shellFalso();
  const ev = eventosFalsos();
  const a1 = await base(banco, 100, 1);
  const a2 = await base(banco, 100, 2);
  let minha = 0;
  let outra = 0;
  let atribuicao = 0;
  await comServidor(rotas, corretor(1, 100, { eventos: ev }), banco, shell, async (chamar) => {
    minha = await negociacaoPronta(chamar, a1);
    outra = await negociacaoPronta(chamar, a2);
    for (const nid of [minha, outra]) assert.equal((await chamar('POST', `/negociacoes/${nid}/propostas`, { direcao: 'comprador', valor_c: 137_000_000 })).status, 201);
    atribuicao = (await chamar('POST', '/negociador/atribuicoes', { negociacao_id: minha, usuario_id: 5 })).corpo.id;
  });

  const ia = iaSimulada([contraproposta(148_000_000)]);
  await comServidor(rotas, negociador(5, 100, { eventos: ev, ia }), banco, shell, async (chamar) => {
    // Outras áreas: 403 SEM_PAPEL (o padrão das guardas do app), com ou sem rota no caminho.
    for (const caminho of ['/contatos', '/imoveis', '/pagina', '/estudio/pecas', '/numeros', '/conta', '/inicio', '/negocios', '/assistente/ia', '/funil', '/envios', '/selecoes']) {
      const r = await chamar('GET', caminho);
      assert.deepEqual([r.status, r.corpo?.codigo], [403, 'SEM_PAPEL'], caminho);
    }
    // `/negociador/*` é do corretor, salvo a sonda da IA.
    for (const caminho of ['/negociador/config', '/negociador/objecoes', '/negociador/numeros', '/negociador/convites', '/negociador/negociadores', '/negociador/atribuicoes']) {
      const r = await chamar('GET', caminho);
      assert.deepEqual([r.status, r.corpo?.codigo], [403, 'SEM_PAPEL'], caminho);
    }
    assert.equal((await chamar('POST', '/negociador/convites', { email: 'x@y.com' })).status, 403);
    assert.equal((await chamar('POST', '/negociador/teste', { mensagem_cliente: 'oi' })).status, 403);
    assert.equal((await chamar('POST', '/negociador/atribuicoes', { negociacao_id: outra, usuario_id: 5 })).status, 403);
    assert.equal(shell.chamadas.length, 0, 'nenhum convite saiu');
    const sonda = await chamar('GET', '/negociador/ia');
    assert.deepEqual([sonda.status, sonda.corpo.disponivel], [200, true]);

    // A negociação não atribuída: 404 em toda rota, como a de outra conta.
    for (const [metodo, caminho, corpo] of [
      ['GET', `/negociacoes/${outra}`],
      ['GET', `/negociacoes/${outra}/mandato`],
      ['GET', `/negociacoes/${outra}/propostas`],
      ['POST', `/negociacoes/${outra}/propostas`, { direcao: 'comprador', valor_c: 137_500_000 }],
      ['POST', `/negociacoes/${outra}/sugestao`, {}],
      ['POST', `/negociacoes/${outra}/decisao`, { acao: 'descartar', execucao_id: 1 }],
      ['POST', `/negociacoes/${outra}/assumir`, {}],
      ['PATCH', `/negociacoes/${outra}`, { fonte_estimativa: 'x' }],
      ['GET', '/negociacoes/abc'],
    ] as [string, string, unknown?][]) {
      const r = await chamar(metodo, caminho, corpo);
      assert.deepEqual([r.status, r.corpo.codigo], [404, 'NAO_ENCONTRADO'], `${metodo} ${caminho}`);
    }

    // Lista: só a atribuída.
    const lista = await chamar('GET', '/negociacoes');
    assert.deepEqual(lista.corpo.dados.map((n: { id: number }) => n.id), [minha]);
    semSigiloNaResposta(lista.corpo, 'lista');

    // A atribuída: detalhe e propostas sem o sigilo; o mandato completo, em leitura (spec 14).
    const det = await chamar('GET', `/negociacoes/${minha}`);
    assert.equal(det.status, 200);
    semSigiloNaResposta(det.corpo, 'detalhe');
    const mandato = await chamar('GET', `/negociacoes/${minha}/mandato`);
    assert.equal(mandato.status, 200);
    assert.deepEqual(
      [mandato.corpo.vigente.preco_pedido_c, mandato.corpo.vigente.alvo_c, mandato.corpo.vigente.recuo_c, mandato.corpo.vigente.batna_vendedor],
      [PEDIDO, ALVO, RECUO, BATNA],
      'o mandato chega completo',
    );
    assert.equal(mandato.corpo.versoes[0].recuo_c, RECUO);
    semSigiloNaResposta((await chamar('GET', `/negociacoes/${minha}/propostas`)).corpo, 'propostas');

    // O que é só do corretor: 403 SO_O_CORRETOR, nada gravado.
    for (const [metodo, caminho, corpo] of [
      ['PUT', `/negociacoes/${minha}/mandato`, { ...MANDATO, recuo_c: 1 }],
      ['POST', '/negociacoes', { negocio_id: a2.negocio.id, imovel_id: a2.imovel.id }],
      ['PATCH', `/negociacoes/${minha}`, { estado: 'perdida', motivo_perda: 'preco' }],
      ['PATCH', `/negociacoes/${minha}`, { conduzida_por: 'corretor' }],
      ['POST', `/negociacoes/${minha}/propostas`, { direcao: 'proprietario', valor_c: 140_000_000 }],
    ] as [string, string, unknown][]) {
      const r = await chamar(metodo, caminho, corpo);
      assert.deepEqual([r.status, r.corpo.codigo], [403, 'SO_O_CORRETOR'], `${metodo} ${caminho}`);
    }
    // A leitura do comprador ele atualiza.
    const leitura = await chamar('PATCH', `/negociacoes/${minha}`, { fonte_estimativa: 'conversa por telefone' });
    assert.equal(leitura.status, 200);
    semSigiloNaResposta(leitura.corpo, 'patch');

    // Registra a oferta do cliente.
    const oferta = await chamar('POST', `/negociacoes/${minha}/propostas`, { direcao: 'comprador', valor_c: 137_500_000 });
    assert.equal(oferta.status, 201);
    semSigiloNaResposta(oferta.corpo, 'oferta');

    // Sugestão e aprovação: as mesmas validações do D2, sem sigilo na resposta.
    const sug = await chamar('POST', `/negociacoes/${minha}/sugestao`, { mensagem_cliente: 'Pode melhorar um pouco o preço?' });
    assert.equal(sug.status, 200, JSON.stringify(sug.corpo));
    semSigiloNaResposta(sug.corpo, 'sugestão');
    semSigiloNaResposta((await chamar('GET', `/negociacoes/${minha}`)).corpo, 'detalhe com sugestão');
    const apr = await chamar('POST', `/negociacoes/${minha}/decisao`, { acao: 'aprovar', execucao_id: sug.corpo.execucao_id, canal: 'portal' });
    assert.equal(apr.status, 200, JSON.stringify(apr.corpo));
    semSigiloNaResposta(apr.corpo, 'decisão');

    // Nova oferta do comprador, que só o corretor pode aceitar.
    const nova = await chamar('POST', `/negociacoes/${minha}/propostas`, { direcao: 'comprador', valor_c: 138_000_000 });
    assert.equal(nova.status, 201);

    // O aceite final é só do corretor.
    const aceite = await chamar('POST', `/negociacoes/${minha}/decisao`, { acao: 'aceitar_acordo', proposta_id: nova.corpo.id });
    assert.deepEqual([aceite.status, aceite.corpo.codigo], [403, 'SO_O_CORRETOR']);

    // Assume como `humano` e devolve ao Negociador IA.
    const assumiu = await chamar('POST', `/negociacoes/${minha}/assumir`, {});
    assert.deepEqual([assumiu.status, assumiu.corpo.conduzida_por], [200, 'humano']);
    semSigiloNaResposta(assumiu.corpo, 'assumir');
    const devolveu = await chamar('POST', `/negociacoes/${minha}/devolver`, {});
    assert.deepEqual([devolveu.status, devolveu.corpo.conduzida_por], [200, 'ia']);
    semSigiloNaResposta(devolveu.corpo, 'devolver');
  });

  // Nenhum evento leva recuo, alvo nem BATNA.
  assert.ok(ev.publicados.length > 0);
  semSigiloNaResposta(ev.publicados, 'eventos');

  // Nada mudou no que é do corretor.
  const n = banco.linhas('negociacoes').find((l) => l.id === minha)!;
  assert.notEqual(n.estado, 'aguardando_proprietario');
  assert.equal(banco.linhas('mandatos_negociacao').filter((m) => m.negociacao_id === minha).length, 1, 'mandato sem versão nova');
  assert.equal(banco.linhas('negociacoes').length, 2, 'nenhuma negociação nova');
  assert.ok(!banco.linhas('propostas').some((p) => p.direcao === 'proprietario'));
  for (const p of banco.linhas('propostas').filter((p) => p.direcao === 'vendedor')) assert.ok(p.valor_c >= RECUO, 'nada abaixo do recuo');
  assert.equal(banco.linhas('propostas').find((p) => p.direcao === 'vendedor')!.autor_usuario_id, 5);

  // O corretor continua vendo tudo da conta, com o mandato completo.
  await comServidor(rotas, corretor(1, 100, { eventos: ev }), banco, shell, async (chamar) => {
    assert.equal((await chamar('GET', '/negociacoes')).corpo.dados.length, 2);
    assert.equal((await chamar('GET', `/negociacoes/${outra}/mandato`)).corpo.vigente.recuo_c, RECUO);
    // Retirada a atribuição, o negociador deixa de ver a negociação.
    assert.equal((await chamar('PATCH', `/negociador/atribuicoes/${atribuicao}`, { ativa: false })).status, 200);
  });
  await comServidor(rotas, negociador(5, 100, { eventos: ev }), banco, shell, async (chamar) => {
    assert.deepEqual((await chamar('GET', '/negociacoes')).corpo.dados, []);
    assert.equal((await chamar('GET', `/negociacoes/${minha}`)).status, 404);
  });
});

test('registro do vendedor pelo negociador leva o rótulo negociador_humano; edição também', async () => {
  const banco = new BancoFalso(UNICOS);
  const shell = shellFalso();
  const ev = eventosFalsos();
  const a = await base(banco, 100);
  let nid = 0;
  await comServidor(rotas, corretor(1, 100, { eventos: ev }), banco, shell, async (chamar) => {
    nid = await negociacaoPronta(chamar, a);
    await chamar('POST', `/negociacoes/${nid}/propostas`, { direcao: 'comprador', valor_c: 137_000_000 });
    await chamar('POST', '/negociador/atribuicoes', { negociacao_id: nid, usuario_id: 5 });
  });
  const ia = iaSimulada([contraproposta(149_000_000)]);
  await comServidor(rotas, negociador(5, 100, { eventos: ev, ia }), banco, shell, async (chamar) => {
    const sug = await chamar('POST', `/negociacoes/${nid}/sugestao`, {});
    assert.equal(sug.status, 200, JSON.stringify(sug.corpo));
    // Editar abaixo do recuo: as garantias do D2 barram (422), nada sai.
    const baixo = await chamar('POST', `/negociacoes/${nid}/decisao`, { acao: 'editar', execucao_id: sug.corpo.execucao_id, canal: 'portal', contraproposta: { valor_c: RECUO - 1 } });
    assert.deepEqual([baixo.status, baixo.corpo.codigo], [422, 'MOVIMENTO_BLOQUEADO']);
    assert.ok(baixo.corpo.bloqueado_por.includes('ABAIXO_DO_RECUO'));
    semSigiloNaResposta(baixo.corpo, 'bloqueio');
    const ok = await chamar('POST', `/negociacoes/${nid}/decisao`, { acao: 'editar', execucao_id: sug.corpo.execucao_id, canal: 'portal', contraproposta: { valor_c: 148_500_000 } });
    assert.equal(ok.status, 200, JSON.stringify(ok.corpo));
  });
  const vendedor = banco.linhas('propostas').filter((p) => p.direcao === 'vendedor');
  assert.deepEqual(vendedor.map((p) => [p.autor_tipo, p.autor_usuario_id, p.valor_c]), [['negociador_humano', 5, 148_500_000]]);
});

test('resposta do vendedor registrada pelo negociador: as garantias de 10.9.7 barram; eventos sem sigilo', async () => {
  const banco = new BancoFalso(UNICOS);
  const shell = shellFalso();
  const ev = eventosFalsos();
  const a1 = await base(banco, 100, 1);
  const a2 = await base(banco, 100, 2);
  let minha = 0;
  let outra = 0;
  await comServidor(rotas, corretor(1, 100, { eventos: ev }), banco, shell, async (chamar) => {
    minha = await negociacaoPronta(chamar, a1);
    outra = await negociacaoPronta(chamar, a2);
    for (const nid of [minha, outra]) assert.equal((await chamar('POST', `/negociacoes/${nid}/propostas`, { direcao: 'comprador', valor_c: 137_000_000 })).status, 201);
    await chamar('POST', '/negociador/atribuicoes', { negociacao_id: minha, usuario_id: 5 });
  });
  const vendedor = () => banco.linhas('propostas').filter((p) => p.direcao === 'vendedor');
  const inicio = ev.publicados.length;
  await comServidor(rotas, negociador(5, 100, { eventos: ev }), banco, shell, async (chamar) => {
    // Mandato completo da atribuída; o da não atribuída é 404.
    const m = await chamar('GET', `/negociacoes/${minha}/mandato`);
    assert.deepEqual([m.status, m.corpo.vigente.recuo_c, m.corpo.vigente.alvo_c, m.corpo.vigente.batna_vendedor], [200, RECUO, ALVO, BATNA]);
    assert.deepEqual([(await chamar('GET', `/negociacoes/${outra}/mandato`)).status], [404]);

    // Abaixo do recuo (até R$ 1,00): 422 MOVIMENTO_BLOQUEADO, nada gravado.
    for (const valor_c of [RECUO - 1, 100]) {
      const r = await chamar('POST', `/negociacoes/${minha}/propostas`, { direcao: 'vendedor', valor_c });
      assert.deepEqual([r.status, r.corpo.codigo], [422, 'MOVIMENTO_BLOQUEADO'], String(valor_c));
      assert.ok(r.corpo.bloqueado_por.includes('ABAIXO_DO_RECUO'), JSON.stringify(r.corpo));
      assert.ok(Array.isArray(r.corpo.detalhes) && r.corpo.detalhes.length > 0);
    }
    // Concessão fora do mandato também barra.
    const fora = await chamar('POST', `/negociacoes/${minha}/propostas`, { direcao: 'vendedor', valor_c: 148_000_000, concessao: 'piscina nova', contrapartida: 'x' });
    assert.deepEqual([fora.status, fora.corpo.codigo], [422, 'MOVIMENTO_BLOQUEADO']);
    assert.ok(fora.corpo.bloqueado_por.includes('CONCESSAO_FORA_DO_MANDATO'));
    assert.equal(vendedor().length, 0, 'nada gravado');
    assert.equal(ev.publicados.length, inicio, 'nenhum evento do bloqueio');

    // Dentro do mandato: passa, com o rótulo do negociador.
    const ok = await chamar('POST', `/negociacoes/${minha}/propostas`, { direcao: 'vendedor', valor_c: 148_000_000 });
    assert.equal(ok.status, 201, JSON.stringify(ok.corpo));
    semSigiloNaResposta(ok.corpo, 'registro');
  });
  assert.deepEqual(vendedor().map((p) => [p.autor_tipo, p.autor_usuario_id, p.valor_c]), [['negociador_humano', 5, 148_000_000]]);
  assert.ok(ev.publicados.length > inicio);
  semSigiloNaResposta(ev.publicados, 'eventos');

  // O corretor registra o que o dono decidiu, sem a trava de 10.9.7 (comportamento de antes).
  await comServidor(rotas, corretor(1, 100, { eventos: ev }), banco, shell, async (chamar) => {
    const r = await chamar('POST', `/negociacoes/${outra}/propostas`, { direcao: 'vendedor', valor_c: RECUO - 1 });
    assert.equal(r.status, 201, JSON.stringify(r.corpo));
  });
});

test('negociador da conta B contra a negociação da conta A: 404 em tudo', async () => {
  const banco = new BancoFalso(UNICOS);
  const shell = shellFalso();
  const ev = eventosFalsos();
  const a = await base(banco, 100);
  let nid = 0;
  await comServidor(rotas, corretor(1, 100, { eventos: ev }), banco, shell, async (chamar) => {
    nid = await negociacaoPronta(chamar, a);
    await chamar('POST', '/negociador/atribuicoes', { negociacao_id: nid, usuario_id: 5 });
  });
  await comServidor(rotas, negociador(6, 200, { eventos: ev }), banco, shell, async (chamar) => {
    for (const [metodo, caminho, corpo] of [
      ['GET', `/negociacoes/${nid}`],
      ['GET', `/negociacoes/${nid}/mandato`],
      ['GET', `/negociacoes/${nid}/propostas`],
      ['POST', `/negociacoes/${nid}/propostas`, { direcao: 'vendedor', valor_c: 148_000_000 }],
      ['POST', `/negociacoes/${nid}/assumir`, {}],
      ['POST', `/negociacoes/${nid}/devolver`, {}],
    ] as [string, string, unknown?][]) {
      const r = await chamar(metodo, caminho, corpo);
      assert.deepEqual([r.status, r.corpo.codigo], [404, 'NAO_ENCONTRADO'], `${metodo} ${caminho}`);
      semSigiloNaResposta(r.corpo, `${metodo} ${caminho}`);
    }
    assert.deepEqual((await chamar('GET', '/negociacoes')).corpo.dados, []);
  });
  assert.equal(banco.linhas('propostas').length, 0);
});

test('assumir e devolver: o negociador não toma de volta o que o corretor assumiu', async () => {
  const banco = new BancoFalso(UNICOS);
  const shell = shellFalso();
  const ev = eventosFalsos();
  const a = await base(banco, 100);
  let nid = 0;
  const conduz = () => banco.linhas('negociacoes').find((l) => l.id === nid)!.conduzida_por;
  await comServidor(rotas, corretor(1, 100, { eventos: ev }), banco, shell, async (chamar) => {
    nid = await negociacaoPronta(chamar, a);
    await chamar('POST', '/negociador/atribuicoes', { negociacao_id: nid, usuario_id: 5 });
    assert.equal(conduz(), 'humano');
    assert.deepEqual([(await chamar('POST', `/negociacoes/${nid}/assumir`, {})).corpo.conduzida_por], ['corretor']);
  });
  await comServidor(rotas, negociador(5, 100, { eventos: ev }), banco, shell, async (chamar) => {
    for (const rota of ['assumir', 'devolver']) {
      const r = await chamar('POST', `/negociacoes/${nid}/${rota}`, {});
      assert.deepEqual([r.status, r.corpo.codigo], [403, 'SO_O_CORRETOR'], rota);
      assert.equal(conduz(), 'corretor', rota);
    }
  });
  await comServidor(rotas, corretor(1, 100, { eventos: ev }), banco, shell, async (chamar) => {
    assert.equal((await chamar('POST', `/negociacoes/${nid}/devolver`, {})).corpo.conduzida_por, 'ia');
  });
  await comServidor(rotas, negociador(5, 100, { eventos: ev }), banco, shell, async (chamar) => {
    const assumiu = await chamar('POST', `/negociacoes/${nid}/assumir`, {});
    assert.deepEqual([assumiu.status, assumiu.corpo.conduzida_por], [200, 'humano']);
    const devolveu = await chamar('POST', `/negociacoes/${nid}/devolver`, {});
    assert.deepEqual([devolveu.status, devolveu.corpo.conduzida_por], [200, 'ia']);
  });
  semSigiloNaResposta(ev.publicados, 'eventos');
});
