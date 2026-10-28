import { test } from 'node:test';
import assert from 'node:assert/strict';
import schema from '../schema.json';
import manifesto from '../manifesto.json';
import { rotas, rotasPublicas, webhooks, reagir } from '../backend/rotas';
import { limparLimites } from '../backend/publico';
import { abasDoPortal, centavosDoValor, negociacaoPublica, propostaAceitavel, propostaPublica } from '../comum/portal-cliente';
import { BancoFalso, comServidor, type Ator, type Unico } from './apoio';

// Bloco D5 (#104): propostas no Portal do Cliente (M5b), sempre por token. O cliente vê as rodadas da
// negociação, aceita a condição do vendedor (que NUNCA fecha o acordo: vira oferta dele e passagem ao
// corretor) ou faz nova oferta (que entra na escada e, se o Negociador conduz, passa pelo motor do D2).
// O mandato (recuo, alvo, BATNA), o teto estimado e quem conduz nunca saem.

const EM_ANDAMENTO = (schema.tabelas.negociacoes.unicos as unknown[]).find((u) => !Array.isArray(u)) as Exclude<Unico, string>;
const UNICOS: Record<string, Unico[]> = {
  negociacoes: [EM_ANDAMENTO, 'codigo'],
  mandatos_negociacao: ['negociacao_id+versao'],
  playbook_objecoes: ['categoria+origem'],
  config_negociador: ['chave'],
  vitrine_publica: ['tipo+chave'],
};

const PEDIDO = 150_000_000;
const ALVO = 145_000_000;
const RECUO = 136_000_000;
const BATNA = 'Manter anunciado por sessenta dias e esperar a proposta do vizinho do terceiro andar';
const MANDATO = {
  preco_pedido_c: PEDIDO,
  alvo_c: ALVO,
  recuo_c: RECUO,
  batna_vendedor: BATNA,
  concessoes: [{ item: 'prazo de entrega de 90 dias', limite: '90 dias', contrapartida: 'entrada de 30%' }],
  validade: '2099-12-31',
  autonomia: 'pergunta_antes',
};
const SOZINHO = { ...MANDATO, autonomia: 'faz_sozinho', autorizacao_proprietario: { tipo: 'mensagem', data: '2026-10-20' } };
type Chamar = (metodo: string, caminho: string, corpo?: unknown) => Promise<{ status: number; corpo: any }>;

function shellFalso() {
  const ingressos = new Map<string, { id: number; webhook: string; contexto: any; ativo: boolean }>();
  let n = 0;
  return {
    gerarIngressoWh: async ({ webhook, contexto }: { webhook: string; contexto: any }) => {
      n++;
      const token = `wh_${webhook}_${n}x`;
      ingressos.set(token, { id: n, webhook, contexto, ativo: true });
      return { url: `https://corretor.exemplo/api/wh/portal_corretor/${token}`, token, ingresso_id: n, expira_em: null };
    },
    inspecionarIngressoWh: async ({ webhook, token }: { webhook: string; token: string }) => {
      const i = ingressos.get(token);
      if (!i || i.webhook !== webhook || !i.ativo) throw Object.assign(new Error('inválido'), { codigo: 'WH_INGRESSO_INVALIDO' });
      return { ingresso_id: i.id, contexto: i.contexto, expira_em: null, contador_usos: 0 };
    },
    revogarIngressoWh: async ({ ingresso_id }: { ingresso_id: number }) => {
      for (const i of ingressos.values()) if (i.id === ingresso_id) i.ativo = false;
      return { revogado: true };
    },
  };
}

/** Chaves do payload contra `campos` do manifesto: o barramento recusa chave ausente e chave a mais. */
function desvioDe(tipo: string, payload: Record<string, unknown>): string | null {
  const declarado = (manifesto.eventos as Record<string, { campos: string[] }>)[tipo];
  if (!declarado) return null;
  const a = Object.keys(payload).sort().join(',');
  const b = [...declarado.campos].sort().join(',');
  return a === b ? null : `${tipo}: publicou [${a}], declarado [${b}]`;
}

/** Barramento falso que recusa como o real (payload fechado) e guarda o desvio, que o `publicar` do código pode engolir. */
function eventosFalsos() {
  const publicados: { tipo: string; payload: Record<string, unknown>; opcoes?: any }[] = [];
  const desvios: string[] = [];
  return {
    publicados,
    desvios,
    publicar: async (tipo: string, payload: Record<string, unknown>, opcoes?: any) => {
      const d = desvioDe(tipo, payload);
      if (d) {
        desvios.push(d);
        throw new Error(`CAMPOS: ${d}`);
      }
      publicados.push({ tipo, payload, opcoes });
      return { id: publicados.length };
    },
  };
}

const resposta = (r: Record<string, unknown>) => ({
  objecao: null, interesses_identificados: [], teto_estimado_comprador_c: null, fonte_estimativa: null, movimento: 'responder_objecao',
  contraproposta: null, mensagem: null, passar_ao_corretor: false, motivo: null, resumo_rodada: null, ...r,
});
const contraproposta = (valor_c: number, mensagem: string) =>
  resposta({ movimento: 'contraproposta', contraproposta: { valor_c, condicoes: null, concessao: null, contrapartida: null, validade_horas: 48 }, mensagem });

function iaSimulada(respostas: Record<string, unknown>[]) {
  const chamadas: unknown[] = [];
  return {
    chamadas,
    estadoSlot: async (slot: string) => ({ pedido: slot, efetivo: { slot, origem: 'global' }, backup: null }),
    consultar: async (o: unknown) => {
      chamadas.push(o);
      const proxima = respostas.shift();
      if (!proxima) throw new Error('chamada de IA a mais');
      return { dados: proxima, modelo: 'teste', tokens_entrada: 100, tokens_saida: 50, duracao_ms: 10 };
    },
  };
}

/** Webhook do portal com o contexto do ingresso do cliente; devolve o que o handler publicou. */
async function webhook(contexto: Record<string, unknown>, corpo: unknown, ip = '10.9.0.1') {
  const publicados: { tipo: string; payload: any; opcoes: any }[] = [];
  const desvios: string[] = [];
  const r: { status: number; corpo: any; res: any } = { status: 200, corpo: null, res: null };
  r.res = { status: (s: number) => ((r.status = s), r.res), json: (c: unknown) => ((r.corpo = c), r.res) };
  const req: any = { body: corpo, headers: {}, ip, wh: { webhook: 'acao_cliente', modo: 'recorrente', ingresso_id: 1, contexto, contador_usos: 0, criado_por: 1 }, eventos: { publicar: async (tipo: string, payload: any, opcoes: any) => { const d = desvioDe(tipo, payload); if (d) { desvios.push(d); throw new Error(`CAMPOS: ${d}`); } publicados.push({ tipo, payload, opcoes }); } } };
  await webhooks.acao_cliente(req, r.res);
  return { ...r, publicados, desvios };
}

/** Uma conta com cliente, imóvel anunciado, negociação com mandato e o link do portal do cliente. */
async function montar(banco: BancoFalso, shell: ReturnType<typeof shellFalso>, ator: Ator, mandato: Record<string, unknown>) {
  let saida: { contatoId: number; nid: number; link: string } = {} as any;
  await comServidor(rotas, ator, banco, shell, async (chamar: Chamar) => {
    const contato = (await chamar('POST', '/contatos', { nome: `Ana Comprador ${ator.conta}`, telefone: `+55619${ator.conta}77777`, email: `ana${ator.conta}@exemplo.com` })).corpo;
    const negocio = await banco.dados(ator.conta!).criar('negocios', { contato_id: contato.id, titulo: 'Compra apto', pipeline: 'compra', etapa_id: 1, responsavel_id: ator.usuario });
    const imovel = await banco.dados(ator.conta!).criar('imoveis', { codigo: 'IM-0001', titulo: 'Apto Asa Sul', bairro: 'Asa Sul', cidade: 'Brasília', preco_c: PEDIDO, endereco: 'SQS 308 Bloco Secreto', endereco_publico: 'bairro' });
    const link = (await chamar('POST', `/contatos/${contato.id}/portal`)).corpo.link;
    const n = await chamar('POST', '/negociacoes', { negocio_id: negocio.id, imovel_id: imovel.id });
    assert.equal(n.status, 201, JSON.stringify(n.corpo));
    assert.equal((await chamar('PUT', `/negociacoes/${n.corpo.id}/mandato`, mandato)).status, 200);
    saida = { contatoId: contato.id, nid: n.corpo.id, link };
  });
  return saida;
}

const tokenDe = (link: string) => new URL(link).searchParams.get('t')!;
const ctxListener = (banco: BancoFalso, ev: ReturnType<typeof eventosFalsos>, ia?: unknown) => ({ ...banco.ctxSistema([{ id: 100, nome: 'A' }, { id: 200, nome: 'B' }]), eventos: ev, ia });

/** O handler publica; o listener (SISTEMA) recebe o mesmo evento na conta do ingresso. */
async function entregar(contexto: Record<string, unknown>, corpo: unknown, ctx: any) {
  const w = await webhook(contexto, corpo);
  assert.equal(w.status, 200, JSON.stringify(w.corpo));
  assert.deepEqual(w.desvios, [], 'o handler publica exatamente as chaves declaradas');
  for (const p of w.publicados) await reagir.acao_cliente_recebida({ payload: p.payload, conta_id: p.opcoes.conta_id }, ctx);
  return w;
}

// ------------------------------------------------------------------------------------------------

test('regras puras: lista permitida de campos, proposta aceitável, valor digitado e a aba Propostas', () => {
  const vendedorRegistrada = { id: 1, negociacao_id: 9, direcao: 'vendedor', valor_c: 148_000_000, estado: 'registrada', canal: 'registro' };
  const proprietario = { id: 2, negociacao_id: 9, direcao: 'proprietario', valor_c: 137_000_000, estado: 'registrada' };
  const comprador = { id: 3, negociacao_id: 9, direcao: 'comprador', valor_c: 130_000_000, estado: 'registrada', condicoes: 'anotação interna do corretor', autor_usuario_id: 1 };
  const enviada = { id: 4, negociacao_id: 9, direcao: 'vendedor', valor_c: 146_000_000, estado: 'enviada', canal: 'portal', condicoes: 'à vista', concessao: 'prazo de entrega de 90 dias', contrapartida: 'entrada de 30%', validade_ate: '2099-01-01T00:00:00.000Z', recuo_c: RECUO };
  assert.equal(propostaPublica(vendedorRegistrada), null, 'registro interno do corretor não sai');
  assert.equal(propostaPublica(proprietario), null, 'proposta do proprietário nunca sai');
  assert.deepEqual(Object.keys(propostaPublica(comprador)!).sort(), ['concessao', 'condicoes', 'contrapartida', 'estado', 'quando', 'quem', 'ref', 'rodada', 'validade_ate', 'valor_c']);
  assert.equal(propostaPublica(comprador)!.condicoes, null, 'a anotação do corretor sobre a oferta do cliente não sai');
  const n = negociacaoPublica({ id: 9, estado: 'aguardando_cliente', mandato_id: 5, teto_estimado_comprador_c: 140_000_000, fonte_estimativa: 'disse que tem 1,4', conduzida_por: 'ia' }, [enviada, comprador, proprietario, vendedorRegistrada], { codigo: 'IM-0001', titulo: 'Apto', bairro: 'Asa Sul', cidade: 'Brasília', endereco: 'x' } as any);
  assert.deepEqual(Object.keys(n).sort(), ['imovel', 'pode_agir', 'propostas', 'ref', 'situacao']);
  assert.deepEqual(Object.keys(n.imovel!).sort(), ['bairro', 'cidade', 'codigo', 'titulo']);
  assert.deepEqual(n.propostas.map((p) => p.ref), [3, 4]);
  assert.ok(!JSON.stringify(n).includes(String(RECUO)) && !JSON.stringify(n).includes('140000000') && !JSON.stringify(n).includes('disse que'));
  assert.equal(propostaAceitavel(n)?.ref, 4);
  assert.equal(propostaAceitavel(n, Date.parse('2100-01-01')), null, 'vencida não se aceita');
  assert.equal(propostaAceitavel({ ...n, pode_agir: false }), null, 'com o proprietário não se aceita');
  assert.deepEqual(
    ['1.380.000', '1380000', 'R$ 1.380.000,50', '1.380,5', 'abc', '1.38.000', ''].map(centavosDoValor),
    [138_000_000, 138_000_000, 138_000_050, 138_050, null, null, null],
  );
  assert.deepEqual(abasDoPortal({ negociacoes: [n] }).map((a) => [a.id, a.n]), [['conversa', null], ['imoveis', 0], ['agenda', 0], ['propostas', 1], ['arquivos', 0]]);
  assert.ok(!abasDoPortal({ negociacoes: [] }).some((a) => a.id === 'propostas'), 'sem negociação, sem a aba');
});

test('vazamento: o JSON público do portal, com mandato preenchido, não traz recuo, alvo, BATNA, teto nem nomes desses campos', async () => {
  limparLimites();
  const banco = new BancoFalso(UNICOS);
  const shell = shellFalso();
  const ev = eventosFalsos();
  const A: Ator = { usuario: 1, conta: 100, papeis: ['corretor'], extras: { eventos: ev } };
  const { nid, link } = await montar(banco, shell, A, MANDATO);
  await comServidor(rotas, A, banco, shell, async (chamar: Chamar) => {
    // O corretor registra a oferta do cliente e manda uma contraproposta pelo portal (aprovada).
    await chamar('POST', `/negociacoes/${nid}/propostas`, { direcao: 'comprador', valor_c: 130_000_000, condicoes: 'disse que o teto é 1,40 mi' });
    await chamar('POST', `/negociacoes/${nid}/propostas`, { direcao: 'proprietario', valor_c: 137_000_000 });
    await chamar('POST', `/negociacoes/${nid}/propostas`, { direcao: 'vendedor', valor_c: 148_500_000 });
    await banco.dados(100).atualizar('negociacoes', nid, { teto_estimado_comprador_c: 140_000_000, fonte_estimativa: 'Ana disse que o banco aprova até 1,4' });
  });
  await comServidor(rotasPublicas, { usuario: 0, conta: null, papeis: [] }, banco, shell, async (chamar: Chamar) => {
    const r = await chamar('GET', `/vitrine/portal?t=${tokenDe(link)}`);
    assert.equal(r.status, 200);
    const json = JSON.stringify(r.corpo);
    assert.equal(r.corpo.portal.negociacoes.length, 1);
    assert.deepEqual(r.corpo.portal.negociacoes[0].propostas.map((p: any) => [p.quem, p.valor_c]), [['voce', 130_000_000]]);
    const registrada = banco.linhas('propostas').find((x) => x.direcao === 'vendedor' && x.valor_c === 148_500_000);
    assert.equal(registrada?.estado, 'registrada', 'a proposta do vendedor lançada pelo corretor fica só registrada');
    assert.ok(!json.includes('148500000'), 'a proposta registrada do vendedor não sai no portal');
    for (const proibido of [String(RECUO), String(ALVO), '1.360.000', '1.450.000', 'vizinho', 'sessenta dias', '140000000', '137000000', 'teto', 'banco aprova', 'disse que',
      'recuo', 'alvo_c', 'batna', 'mandato', 'fonte_estimativa', 'conduzida_por', 'SQS 308', 'Ana Comprador', '77777', 'ana100@']) {
      assert.ok(!json.includes(proibido), `portal sem ${proibido}`);
    }
  });
  const linha = banco.linhas('vitrine_publica').find((l) => l.tipo === 'portal')!;
  for (const proibido of [String(RECUO), String(ALVO), 'vizinho', 'recuo', 'batna', 'teto_estimado']) assert.ok(!JSON.stringify(linha).includes(proibido), `vitrine sem ${proibido}`);
});

test('aceite do cliente: vira oferta dele e passagem ao corretor, nunca acordo nem ganha; repetido não duplica', async () => {
  limparLimites();
  const banco = new BancoFalso(UNICOS);
  const shell = shellFalso();
  const ev = eventosFalsos();
  const A: Ator = { usuario: 1, conta: 100, papeis: ['corretor'], extras: { eventos: ev } };
  const { nid, contatoId } = await montar(banco, shell, A, MANDATO);
  // Contraproposta do vendedor enviada pelo portal (o corretor aprovou: estado `enviada`, canal portal).
  const d = banco.dados(100);
  await d.criar('propostas', { negociacao_id: nid, rodada: 1, direcao: 'comprador', autor_tipo: 'cliente', valor_c: 130_000_000, canal: 'registro', estado: 'registrada' });
  const vend = await d.criar('propostas', { negociacao_id: nid, rodada: 1, direcao: 'vendedor', autor_tipo: 'corretor', valor_c: 146_000_000, canal: 'portal', estado: 'enviada', validade_ate: new Date(Date.now() + 86400e3).toISOString() });
  await d.atualizar('negociacoes', nid, { estado: 'aguardando_cliente' });
  const ctx = ctxListener(banco, ev);
  const contexto = { conta_id: 100, contato_id: contatoId };

  // Aceitar uma proposta que não é a última do vendedor, ou de outra negociação: ignorado.
  await entregar(contexto, { tipo: 'proposta_aceite', negociacao: nid, proposta: vend.id - 1 }, ctx);
  assert.equal(banco.linhas('propostas').length, 2);

  const w = await entregar(contexto, { tipo: 'proposta_aceite', negociacao: nid, proposta: vend.id }, ctx);
  assert.deepEqual(Object.keys(w.publicados[0].payload).filter((k) => w.publicados[0].payload[k] !== null && w.publicados[0].payload[k] !== undefined).sort(), ['contato_id', 'negociacao', 'proposta', 'tipo']);
  assert.deepEqual(ev.desvios, []);
  await entregar(contexto, { tipo: 'proposta_aceite', negociacao: nid, proposta: vend.id }, ctx);
  const props = banco.linhas('propostas').filter((p) => p.negociacao_id === nid);
  assert.equal(props.length, 3, 'uma oferta do cliente no valor aceito, uma vez só');
  const minha = props.at(-1)!;
  assert.deepEqual([minha.direcao, minha.autor_tipo, minha.canal, minha.valor_c, minha.estado], ['comprador', 'cliente', 'portal', 146_000_000, 'enviada']);
  const neg = banco.linhas('negociacoes').find((n) => n.id === nid)!;
  assert.equal(neg.estado, 'aguardando_corretor', 'passagem ao corretor');
  assert.ok(!props.some((p) => p.estado === 'aceita'), 'nada aceito: o acordo é do corretor (D-98)');
  assert.ok(banco.linhas('atividades').some((a) => a.tipo === 'tarefa' && /aceitou a proposta/.test(a.titulo)));
  const doAceite = ev.publicados.filter((e) => e.tipo === 'proposta_aceite_cliente');
  assert.equal(doAceite.length, 1);
  assert.deepEqual(doAceite[0].payload, { negociacao_id: nid, proposta_id: minha.id });
  assert.equal(doAceite[0].opcoes.conta_id, 100);
  for (const e of ev.publicados) {
    const declarado = (manifesto.eventos as Record<string, { campos: string[] }>)[e.tipo];
    if (declarado && e.tipo.startsWith('proposta')) assert.deepEqual(Object.keys(e.payload).sort(), [...declarado.campos].sort());
  }
  // O portal mostra a oferta do cliente e a situação "com o corretor"; depois do aceite não há mais o que aceitar.
  const portal = banco.linhas('vitrine_publica').find((l) => l.tipo === 'portal')!.dados;
  assert.equal(portal.negociacoes[0].situacao, 'com_o_corretor');
  assert.equal(propostaAceitavel(portal.negociacoes[0]), null);
});

test('token revogado ou de outra conta não alcança a negociação; outra conta não grava nada', async () => {
  limparLimites();
  const banco = new BancoFalso(UNICOS);
  const shell = shellFalso();
  const ev = eventosFalsos();
  const A: Ator = { usuario: 1, conta: 100, papeis: ['corretor'], extras: { eventos: ev } };
  const B: Ator = { usuario: 2, conta: 200, papeis: ['corretor'], extras: { eventos: ev } };
  const a = await montar(banco, shell, A, MANDATO);
  const b = await montar(banco, shell, B, MANDATO);
  const ctx = ctxListener(banco, ev);
  // Ingresso de B (conta 200, cliente de B) apontando a negociação de A: ignorado.
  await entregar({ conta_id: 200, contato_id: b.contatoId }, { tipo: 'proposta_nova', negociacao: a.nid, valor_c: 140_000_000 }, ctx);
  // Cliente de A, mas o ingresso diz conta 200: a negociação de A não é da conta 200.
  await entregar({ conta_id: 200, contato_id: a.contatoId }, { tipo: 'proposta_nova', negociacao: a.nid, valor_c: 140_000_000 }, ctx);
  assert.equal(banco.linhas('propostas').length, 0, 'nada gravado em nenhuma conta');
  // Revogado: a rota pública não abre (o portal diz "link expirado").
  await comServidor(rotas, A, banco, shell, async (chamar: Chamar) => {
    assert.equal((await chamar('PATCH', `/contatos/${a.contatoId}/portal/revogar`)).status, 200);
  });
  await comServidor(rotasPublicas, { usuario: 0, conta: null, papeis: [] }, banco, shell, async (chamar: Chamar) => {
    assert.equal((await chamar('GET', `/vitrine/portal?t=${tokenDe(a.link)}`)).status, 404);
    const pb = await chamar('GET', `/vitrine/portal?t=${tokenDe(b.link)}`);
    assert.ok(!JSON.stringify(pb.corpo).includes(`"ref":${a.nid},`), 'o portal de B não lista a negociação de A');
  });
  // Validação do handler: oferta sem valor ou com valor absurdo; aceite sem proposta.
  assert.equal((await webhook({ conta_id: 100, contato_id: a.contatoId }, { tipo: 'proposta_nova', negociacao: a.nid })).status, 422);
  assert.equal((await webhook({ conta_id: 100, contato_id: a.contatoId }, { tipo: 'proposta_nova', negociacao: a.nid, valor_c: 1e15 })).status, 422);
  assert.equal((await webhook({ conta_id: 100, contato_id: a.contatoId }, { tipo: 'proposta_aceite', negociacao: a.nid })).status, 422);
});

test('oferta nova abaixo do recuo, com faz sozinho e a IA tentando descer: nenhuma contraproposta automática abaixo do recuo', async () => {
  limparLimites();
  const banco = new BancoFalso(UNICOS);
  const shell = shellFalso();
  const ev = eventosFalsos();
  const A: Ator = { usuario: 1, conta: 100, papeis: ['corretor'], extras: { eventos: ev } };
  const { nid, contatoId } = await montar(banco, shell, A, SOZINHO);
  // A IA tenta responder a oferta baixa com uma contraproposta abaixo do recuo.
  const ia = iaSimulada([contraproposta(RECUO - 1_000_000, 'Ana, fecho por 1,35 mi.')]);
  const ctx = ctxListener(banco, ev, ia);
  await entregar({ conta_id: 100, contato_id: contatoId }, { tipo: 'proposta_nova', negociacao: nid, valor_c: 120_000_000 }, ctx);
  const props = banco.linhas('propostas').filter((p) => p.negociacao_id === nid);
  assert.equal(ia.chamadas.length, 1, 'a IA foi chamada: a barreira do recuo é do código, não da ausência de consulta');
  assert.deepEqual(ev.desvios, []);
  assert.deepEqual(props.map((p) => [p.direcao, p.canal, p.valor_c]), [['comprador', 'portal', 120_000_000]], 'só a oferta do cliente; nada do vendedor');
  assert.ok(!props.some((p) => p.direcao === 'vendedor' && p.valor_c < RECUO));
  const neg = banco.linhas('negociacoes').find((n) => n.id === nid)!;
  assert.equal(neg.estado, 'aguardando_corretor', 'oferta abaixo do recuo é passagem (10.9.5)');
  assert.ok(banco.linhas('atividades').some((a) => a.tipo === 'tarefa' && /oferta do portal/.test(a.titulo)));
  assert.ok(ev.publicados.some((e) => e.tipo === 'proposta_recebida'));
  assert.ok(ev.publicados.some((e) => e.tipo === 'negociacao_limite_atingido'));
  for (const e of ev.publicados.filter((x) => x.tipo !== 'acao_cliente_recebida')) for (const v of Object.values(e.payload)) assert.equal(typeof v, 'number', `${e.tipo} só com ids`);
});

test('oferta nova dentro do mandato, com faz sozinho: o motor do D2 responde pelo portal com o texto do código, e o portal mostra', async () => {
  limparLimites();
  const banco = new BancoFalso(UNICOS);
  const shell = shellFalso();
  const ev = eventosFalsos();
  const A: Ator = { usuario: 1, conta: 100, papeis: ['corretor'], extras: { eventos: ev } };
  const { nid, contatoId } = await montar(banco, shell, A, SOZINHO);
  const ia = iaSimulada([contraproposta(146_000_000, 'Ana, consigo levar ao vendedor R$ 1.460.000.')]);
  const ctx = ctxListener(banco, ev, ia);
  await entregar({ conta_id: 100, contato_id: contatoId }, { tipo: 'proposta_nova', negociacao: nid, valor_c: 140_000_000 }, ctx);
  assert.equal(ia.chamadas.length, 1, 'o motor rodou uma vez');
  const props = banco.linhas('propostas').filter((p) => p.negociacao_id === nid);
  assert.deepEqual(props.map((p) => [p.direcao, p.autor_tipo, p.canal, p.valor_c]), [['comprador', 'cliente', 'portal', 140_000_000], ['vendedor', 'negociador_ia', 'portal', 146_000_000]]);
  assert.equal(banco.linhas('negociacoes').find((n) => n.id === nid)!.estado, 'aguardando_cliente');
  const portal = banco.linhas('vitrine_publica').find((l) => l.tipo === 'portal')!.dados;
  assert.deepEqual(portal.negociacoes[0].propostas.map((p: any) => [p.quem, p.valor_c]), [['voce', 140_000_000], ['vendedor', 146_000_000]]);
  assert.equal(portal.negociacoes[0].situacao, 'sua_vez');
  // O que o cliente recebe é o texto montado pelo código (D-110), e nada fora do mandato traz o recuo.
  const execucao = banco.linhas('negociador_execucoes').at(-1)!;
  assert.equal(execucao.decisao, 'automatica');
  assert.ok(String(execucao.mensagem_enviada).includes('1.460.000'));
  for (const [tabela, linhas] of banco.tabelas) if (tabela !== 'mandatos_negociacao') assert.ok(!JSON.stringify(linhas).includes(String(RECUO)), `${tabela} sem o recuo`);
});

test('sem o Negociador conduzindo ou com o gatilho desligado: a oferta vai ao corretor e a IA não é chamada', async () => {
  limparLimites();
  const banco = new BancoFalso(UNICOS);
  const shell = shellFalso();
  const ev = eventosFalsos();
  const A: Ator = { usuario: 1, conta: 100, papeis: ['corretor'], extras: { eventos: ev } };
  const { nid, contatoId } = await montar(banco, shell, A, SOZINHO);
  await comServidor(rotas, A, banco, shell, async (chamar: Chamar) => {
    assert.equal((await chamar('POST', `/negociacoes/${nid}/assumir`)).status, 200);
  });
  const ia = iaSimulada([]);
  const ctx = ctxListener(banco, ev, ia);
  await entregar({ conta_id: 100, contato_id: contatoId }, { tipo: 'proposta_nova', negociacao: nid, valor_c: 141_000_000 }, ctx);
  assert.equal(ia.chamadas.length, 0);
  assert.equal(banco.linhas('negociacoes').find((n) => n.id === nid)!.estado, 'aguardando_corretor');
  // O mesmo evento entregue de novo não grava a segunda oferta.
  await entregar({ conta_id: 100, contato_id: contatoId }, { tipo: 'proposta_nova', negociacao: nid, valor_c: 141_000_000 }, ctx);
  assert.equal(banco.linhas('propostas').filter((p) => p.negociacao_id === nid).length, 1);
  // Com o acordo já com o proprietário, o cliente não age mais pelo portal.
  await banco.dados(100).atualizar('negociacoes', nid, { estado: 'aguardando_proprietario' });
  await entregar({ conta_id: 100, contato_id: contatoId }, { tipo: 'proposta_nova', negociacao: nid, valor_c: 142_000_000 }, ctx);
  assert.equal(banco.linhas('propostas').filter((p) => p.negociacao_id === nid).length, 1);
});

/** Mandato com o vendedor já tendo enviado uma contraproposta ao cliente (aguardando_cliente). */
async function comProposta(banco: BancoFalso, nid: number, extra: Record<string, unknown> = {}) {
  const d = banco.dados(100);
  await d.criar('propostas', { negociacao_id: nid, rodada: 1, direcao: 'comprador', autor_tipo: 'cliente', valor_c: 130_000_000, canal: 'registro', estado: 'registrada' });
  const vend = await d.criar('propostas', { negociacao_id: nid, rodada: 1, direcao: 'vendedor', autor_tipo: 'corretor', valor_c: 146_000_000, canal: 'portal', estado: 'enviada', validade_ate: new Date(Date.now() + 86400e3).toISOString(), ...extra });
  await d.atualizar('negociacoes', nid, { estado: 'aguardando_cliente' });
  return vend;
}

test('payload fechado: para os 5 tipos o handler publica exatamente as chaves de `campos` do manifesto', async () => {
  limparLimites();
  const campos = (manifesto.eventos as Record<string, { campos: string[] }>).acao_cliente_recebida.campos;
  const contexto = { conta_id: 100, contato_id: 7 };
  const corpos: Record<string, unknown>[] = [
    { tipo: 'mensagem', texto: 'Posso visitar no sábado?' },
    { tipo: 'remarcar', visita: 3, texto: 'outro dia' },
    { tipo: 'tarefa_feita', tarefa: 4 },
    { tipo: 'proposta_nova', negociacao: 5, valor_c: 140_000_000 },
    { tipo: 'proposta_aceite', negociacao: 5, proposta: 9 },
  ];
  for (const corpo of corpos) {
    const w = await webhook(contexto, corpo, `10.8.0.${corpos.indexOf(corpo) + 1}`);
    assert.equal(w.status, 200, `${corpo.tipo}: ${JSON.stringify(w.corpo)}`);
    assert.equal(w.publicados.length, 1);
    assert.equal(w.publicados[0].tipo, 'acao_cliente_recebida');
    assert.deepEqual(Object.keys(w.publicados[0].payload).sort(), [...campos].sort(), `${corpo.tipo}: chaves iguais às declaradas`);
    assert.deepEqual(w.desvios, []);
  }
});

test('aceite vale com proposta do proprietário ou registro do vendedor depois: mesma regra do portal (lista pública)', async () => {
  limparLimites();
  const banco = new BancoFalso(UNICOS);
  const shell = shellFalso();
  const ev = eventosFalsos();
  const A: Ator = { usuario: 1, conta: 100, papeis: ['corretor'], extras: { eventos: ev } };
  const { nid, contatoId } = await montar(banco, shell, A, MANDATO);
  const vend = await comProposta(banco, nid);
  const d = banco.dados(100);
  await d.criar('propostas', { negociacao_id: nid, rodada: 1, direcao: 'proprietario', autor_tipo: 'corretor', valor_c: 137_000_000, canal: 'registro', estado: 'registrada' });
  await d.criar('propostas', { negociacao_id: nid, rodada: 1, direcao: 'vendedor', autor_tipo: 'corretor', valor_c: 147_000_000, canal: 'registro', estado: 'registrada' });
  // O portal ainda oferece o aceite (a lista pública termina na proposta enviada)...
  const portal = banco.linhas('vitrine_publica').find((l) => l.tipo === 'portal');
  const publica = negociacaoPublica(banco.linhas('negociacoes').find((n) => n.id === nid)!, banco.linhas('propostas'), null);
  assert.equal(propostaAceitavel(publica)?.ref, vend.id, `o portal oferece o aceite (${portal ? 'vitrine presente' : 'sem vitrine'})`);
  // ...e o listener usa a mesma regra: aceita.
  await entregar({ conta_id: 100, contato_id: contatoId }, { tipo: 'proposta_aceite', negociacao: nid, proposta: vend.id }, ctxListener(banco, ev));
  const minha = banco.linhas('propostas').filter((p) => p.negociacao_id === nid).at(-1)!;
  assert.deepEqual([minha.direcao, minha.canal, minha.valor_c], ['comprador', 'portal', 146_000_000]);
  assert.equal(banco.linhas('negociacoes').find((n) => n.id === nid)!.estado, 'aguardando_corretor');
  assert.deepEqual(ev.desvios, []);
});

test('aceite depois da revogação do acesso do cliente: nada é gravado', async () => {
  limparLimites();
  const banco = new BancoFalso(UNICOS);
  const shell = shellFalso();
  const ev = eventosFalsos();
  const A: Ator = { usuario: 1, conta: 100, papeis: ['corretor'], extras: { eventos: ev } };
  const { nid, contatoId } = await montar(banco, shell, A, MANDATO);
  const vend = await comProposta(banco, nid);
  const w = await webhook({ conta_id: 100, contato_id: contatoId }, { tipo: 'proposta_aceite', negociacao: nid, proposta: vend.id });
  assert.equal(w.status, 200);
  await comServidor(rotas, A, banco, shell, async (chamar: Chamar) => {
    assert.equal((await chamar('PATCH', `/contatos/${contatoId}/portal/revogar`)).status, 200);
  });
  const antes = banco.linhas('propostas').length;
  const atividades = banco.linhas('atividades').length;
  for (const p of w.publicados) await reagir.acao_cliente_recebida({ payload: p.payload, conta_id: p.opcoes.conta_id }, ctxListener(banco, ev));
  assert.equal(banco.linhas('propostas').length, antes, 'nenhuma oferta gravada');
  assert.equal(banco.linhas('atividades').length, atividades, 'nenhuma tarefa criada');
  assert.equal(banco.linhas('negociacoes').find((n) => n.id === nid)!.estado, 'aguardando_cliente', 'estado intacto');
  assert.ok(!ev.publicados.some((e) => /^proposta_/.test(e.tipo)), 'nenhum evento de proposta');
});

test('autonomia pergunta_antes: a sugestão espera a aprovação, com a tarefa "Aprovar a sugestão" e a negociação com o corretor', async () => {
  limparLimites();
  const banco = new BancoFalso(UNICOS);
  const shell = shellFalso();
  const ev = eventosFalsos();
  const A: Ator = { usuario: 1, conta: 100, papeis: ['corretor'], extras: { eventos: ev } };
  const { nid, contatoId } = await montar(banco, shell, A, MANDATO);
  const ia = iaSimulada([contraproposta(146_000_000, 'Ana, consigo levar ao vendedor R$ 1.460.000.')]);
  await entregar({ conta_id: 100, contato_id: contatoId }, { tipo: 'proposta_nova', negociacao: nid, valor_c: 140_000_000 }, ctxListener(banco, ev, ia));
  assert.equal(ia.chamadas.length, 1);
  assert.equal(banco.linhas('propostas').filter((p) => p.negociacao_id === nid && p.direcao === 'vendedor').length, 0, 'nada sai ao cliente sem aprovação');
  assert.equal(banco.linhas('negociacoes').find((n) => n.id === nid)!.estado, 'aguardando_corretor');
  assert.ok(banco.linhas('atividades').some((a) => a.tipo === 'tarefa' && /^Aprovar a sugestão/.test(a.titulo)));
  assert.ok(ev.publicados.some((e) => e.tipo === 'contraproposta_sugerida'));
  assert.deepEqual(ev.desvios, []);
});

test('IA indisponível (sem slot efetivo ou consulta que falha): a oferta vai ao corretor com a tarefa', async () => {
  const falhas: Record<string, (ia: ReturnType<typeof iaSimulada>) => unknown> = {
    'sem slot efetivo': (ia) => ({ ...ia, estadoSlot: async (slot: string) => ({ pedido: slot, efetivo: null, backup: null }) }),
    'consulta lançando com codigo': (ia) => ({ ...ia, consultar: async () => { throw Object.assign(new Error('fora do ar'), { codigo: 'IA_INDISPONIVEL' }); } }),
  };
  for (const [nome, montarIa] of Object.entries(falhas)) {
    limparLimites();
    const banco = new BancoFalso(UNICOS);
    const shell = shellFalso();
    const ev = eventosFalsos();
    const A: Ator = { usuario: 1, conta: 100, papeis: ['corretor'], extras: { eventos: ev } };
    const { nid, contatoId } = await montar(banco, shell, A, SOZINHO);
    await entregar({ conta_id: 100, contato_id: contatoId }, { tipo: 'proposta_nova', negociacao: nid, valor_c: 140_000_000 }, ctxListener(banco, ev, montarIa(iaSimulada([]))));
    assert.equal(banco.linhas('negociacoes').find((n) => n.id === nid)!.estado, 'aguardando_corretor', nome);
    assert.ok(banco.linhas('atividades').some((a) => a.tipo === 'tarefa' && /oferta do portal/.test(a.titulo)), nome);
    assert.equal(banco.linhas('propostas').filter((p) => p.negociacao_id === nid && p.direcao === 'vendedor').length, 0, nome);
    assert.deepEqual(ev.desvios, [], nome);
  }
});

test('o corretor respondeu no meio do motor: o estado não regride e a tarefa não é criada', async () => {
  limparLimites();
  const banco = new BancoFalso(UNICOS);
  const shell = shellFalso();
  const ev = eventosFalsos();
  const A: Ator = { usuario: 1, conta: 100, papeis: ['corretor'], extras: { eventos: ev } };
  const { nid, contatoId } = await montar(banco, shell, A, MANDATO);
  const ia = iaSimulada([contraproposta(146_000_000, 'Ana, consigo levar ao vendedor R$ 1.460.000.')]);
  const base = iaSimulada([]);
  // Durante a chamada de IA, o corretor envia a sua resposta (proposta do vendedor) e a negociação fica com o cliente.
  const iaComCorretor = {
    ...base,
    consultar: async (o: unknown) => {
      const r = await ia.consultar(o);
      await banco.dados(100).criar('propostas', { negociacao_id: nid, rodada: 2, direcao: 'vendedor', autor_tipo: 'corretor', valor_c: 147_000_000, canal: 'portal', estado: 'enviada' });
      await banco.dados(100).atualizar('negociacoes', nid, { estado: 'aguardando_cliente' });
      return r;
    },
  };
  await entregar({ conta_id: 100, contato_id: contatoId }, { tipo: 'proposta_nova', negociacao: nid, valor_c: 140_000_000 }, ctxListener(banco, ev, iaComCorretor));
  assert.equal(banco.linhas('negociacoes').find((n) => n.id === nid)!.estado, 'aguardando_cliente', 'não regride');
  assert.ok(!banco.linhas('atividades').some((a) => a.tipo === 'tarefa' && /Aprovar a sugestão|oferta do portal/.test(a.titulo)));
});
