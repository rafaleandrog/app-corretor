import { test } from 'node:test';
import assert from 'node:assert/strict';
import schema from '../schema.json';
import { rotas } from '../backend/rotas';
import { BancoFalso, comServidor, type Ator, type Unico } from './apoio';

// Etapa 4, grupo 3 (P15): nomes na lista e no cabeçalho (#178), Nova contraproposta pelo portal e pelo
// Fazer agora com as validações de 10.9.7 e o aviso abaixo do recuo (D-120), decisão do proprietário
// (`PATCH /propostas/:id`) e a comissão prevista ao ganhar.

const EM_ANDAMENTO = (schema.tabelas.negociacoes.unicos as unknown[]).find((u) => !Array.isArray(u)) as Exclude<Unico, string>;
const UNICOS: Record<string, Unico[]> = { negociacoes: [EM_ANDAMENTO, 'codigo'], mandatos_negociacao: ['negociacao_id+versao'], config_negociador: ['chave'] };
const RECUO = 136_000_000;
const MANDATO = {
  preco_pedido_c: 150_000_000,
  alvo_c: 145_000_000,
  recuo_c: RECUO,
  batna_vendedor: 'Outro comprador',
  concessoes: [{ item: 'prazo de entrega de 90 dias', limite: '90 dias', contrapartida: 'entrada de 30%' }],
  validade: '2099-12-31',
  validade_contraproposta_horas: 48,
  autonomia: 'pergunta_antes',
};

function eventos() {
  const publicados: { tipo: string; payload: Record<string, unknown> }[] = [];
  return { publicados, publicar: async (tipo: string, payload: Record<string, unknown>) => (publicados.push({ tipo, payload }), { id: publicados.length }) };
}
const corretor = (usuario: number, conta: number, ev = eventos()): Ator => ({ usuario, conta, papeis: ['corretor'], extras: { eventos: ev } });

async function base(banco: BancoFalso, conta: number) {
  const d = banco.dados(conta);
  const contato = await d.criar('contatos', { nome: 'Ana Ribeiro', telefone: '+5561988887777' });
  const negocio = await d.criar('negocios', { contato_id: contato.id, titulo: 'Compra', pipeline: 'compra', etapa_id: 1, responsavel_id: 1, comissao_pct: 0.05 });
  const imovel = await d.criar('imoveis', { codigo: 'IM-0007', titulo: 'Casa 4 quartos, Jardim Botânico', preco_c: 150_000_000 });
  return { contato, negocio, imovel };
}

type Chamar = (m: string, c: string, corpo?: unknown) => Promise<{ status: number; corpo: any }>;
async function pronta(chamar: Chamar, b: Awaited<ReturnType<typeof base>>) {
  const n = await chamar('POST', '/negociacoes', { negocio_id: b.negocio.id, imovel_id: b.imovel.id, conduzida_por: 'corretor' });
  assert.equal(n.status, 201, JSON.stringify(n.corpo));
  assert.equal((await chamar('PUT', `/negociacoes/${n.corpo.id}/mandato`, MANDATO)).status, 200);
  return n.corpo.id as number;
}

test('#178: lista e detalhe trazem o nome do cliente, o título e o código do imóvel e a última rodada', async () => {
  const banco = new BancoFalso(UNICOS);
  const b = await base(banco, 100);
  await comServidor(rotas, corretor(1, 100), banco, {}, async (chamar) => {
    const nid = await pronta(chamar, b);
    await chamar('POST', `/negociacoes/${nid}/propostas`, { direcao: 'comprador', valor_c: 132_000_000 });
    const lista = await chamar('GET', '/negociacoes');
    const item = lista.corpo.dados[0];
    assert.equal(item.contato_nome, 'Ana Ribeiro');
    assert.equal(item.imovel_titulo, 'Casa 4 quartos, Jardim Botânico');
    assert.equal(item.imovel_codigo, 'IM-0007');
    assert.equal(item.ultima_oferta_c, 132_000_000);
    assert.equal(item.preco_pedido_c, 150_000_000);
    assert.ok(item.ultima_rodada_em);
    const det = await chamar('GET', `/negociacoes/${nid}`);
    assert.deepEqual([det.corpo.contato_nome, det.corpo.imovel_titulo, det.corpo.imovel_codigo], ['Ana Ribeiro', 'Casa 4 quartos, Jardim Botânico', 'IM-0007']);
  });
});

test('D-120: Nova contraproposta sai pelo portal e pelo Fazer agora, validada; validade padrão do mandato', async () => {
  const banco = new BancoFalso(UNICOS);
  const b = await base(banco, 100);
  const ev = eventos();
  await comServidor(rotas, corretor(1, 100, ev), banco, {}, async (chamar) => {
    const nid = await pronta(chamar, b);
    await chamar('POST', `/negociacoes/${nid}/propostas`, { direcao: 'comprador', valor_c: 132_000_000 });
    const portal = await chamar('POST', `/negociacoes/${nid}/propostas`, { direcao: 'vendedor', valor_c: 147_000_000, canal: 'portal' });
    assert.equal(portal.status, 201, JSON.stringify(portal.corpo));
    assert.equal(portal.corpo.estado, 'enviada');
    assert.equal(portal.corpo.canal, 'portal');
    assert.equal(portal.corpo.link, null);
    assert.ok(portal.corpo.validade_ate, 'validade padrão do mandato (48 h)');
    const horas = (new Date(portal.corpo.validade_ate).getTime() - Date.now()) / 3600e3;
    assert.ok(horas > 47 && horas <= 48, String(horas));
    assert.ok(ev.publicados.some((e) => e.tipo === 'contraproposta_enviada'));
    assert.equal((await chamar('GET', `/negociacoes/${nid}`)).corpo.estado, 'aguardando_cliente');
    // Comprador responde; Fazer agora devolve o wa.me com o texto pronto.
    await chamar('POST', `/negociacoes/${nid}/propostas`, { direcao: 'comprador', valor_c: 138_000_000 });
    const wa = await chamar('POST', `/negociacoes/${nid}/propostas`, { direcao: 'vendedor', valor_c: 145_000_000, canal: 'wa_me', validade_horas: 24 });
    assert.equal(wa.status, 201, JSON.stringify(wa.corpo));
    assert.match(wa.corpo.link, /^https:\/\/wa\.me\/5561988887777\?text=/);
    assert.match(wa.corpo.texto, /R\$/);
    // Garantias continuam: passo acima do limite bloqueia sem confirmação possível.
    await chamar('POST', `/negociacoes/${nid}/propostas`, { direcao: 'comprador', valor_c: 139_000_000 });
    const passo = await chamar('POST', `/negociacoes/${nid}/propostas`, { direcao: 'vendedor', valor_c: 140_000_000, canal: 'portal' });
    assert.equal(passo.status, 422);
    assert.ok(passo.corpo.bloqueado_por.includes('PASSO_ACIMA_DO_LIMITE'));
    assert.equal(passo.corpo.confirmar_abaixo_do_recuo, false);
    // Canal desconhecido e comprador pelo portal não passam.
    assert.equal((await chamar('POST', `/negociacoes/${nid}/propostas`, { direcao: 'vendedor', valor_c: 145_000_000, canal: 'whatsapp' })).corpo.codigo, 'CANAL_INDISPONIVEL');
    assert.equal((await chamar('POST', `/negociacoes/${nid}/propostas`, { direcao: 'comprador', valor_c: 145_000_000, canal: 'portal' })).status, 422);
    // Nenhuma resposta traz o sigilo.
    for (const r of [portal, wa, passo]) assert.ok(!JSON.stringify(r.corpo).includes(String(RECUO)));
  });
});

test('D-120: abaixo do recuo o corretor confirma e fica auditável; sem confirmação, 422 que pede a confirmação', async () => {
  const banco = new BancoFalso(UNICOS);
  const b = await base(banco, 100);
  const ev = eventos();
  await comServidor(rotas, corretor(1, 100, ev), banco, {}, async (chamar) => {
    const nid = await pronta(chamar, b);
    await chamar('POST', `/negociacoes/${nid}/propostas`, { direcao: 'comprador', valor_c: 120_000_000 });
    const sem = await chamar('POST', `/negociacoes/${nid}/propostas`, { direcao: 'vendedor', valor_c: 130_000_000, canal: 'portal' });
    assert.equal(sem.status, 422);
    assert.equal(sem.corpo.confirmar_abaixo_do_recuo, true);
    assert.ok(sem.corpo.bloqueado_por.includes('ABAIXO_DO_RECUO'));
    assert.ok(!ev.publicados.some((e) => e.tipo === 'contraproposta_abaixo_do_recuo'));
    const com = await chamar('POST', `/negociacoes/${nid}/propostas`, { direcao: 'vendedor', valor_c: 130_000_000, canal: 'portal', confirmar_abaixo_do_recuo: true });
    assert.equal(com.status, 201, JSON.stringify(com.corpo));
    assert.equal(com.corpo.abaixo_do_recuo, true);
    const audit = ev.publicados.find((e) => e.tipo === 'contraproposta_abaixo_do_recuo')!;
    assert.deepEqual(Object.keys(audit.payload).sort(), ['ator_id', 'ator_nome', 'negociacao_id', 'proposta_id']);
    assert.equal(audit.payload.ator_id, 1);
    assert.equal(audit.payload.ator_nome, 'Usuário 1');
  });
});

test('D-120: o negociador humano continua bloqueado abaixo do recuo, mesmo pedindo a confirmação', async () => {
  const banco = new BancoFalso(UNICOS);
  const b = await base(banco, 100);
  let nid = 0;
  await comServidor(rotas, corretor(1, 100), banco, {}, async (chamar) => {
    nid = await pronta(chamar, b);
    await chamar('POST', `/negociacoes/${nid}/propostas`, { direcao: 'comprador', valor_c: 120_000_000 });
  });
  await banco.dados(100).criar('atribuicoes_negociacao', { negociacao_id: nid, usuario_id: 5, ativa: true });
  const ev = eventos();
  await comServidor(rotas, { usuario: 5, conta: 100, papeis: ['negociador'], extras: { eventos: ev } }, banco, {}, async (chamar) => {
    const r = await chamar('POST', `/negociacoes/${nid}/propostas`, { direcao: 'vendedor', valor_c: 130_000_000, canal: 'portal', confirmar_abaixo_do_recuo: true });
    assert.equal(r.status, 422, JSON.stringify(r.corpo));
    assert.equal(r.corpo.confirmar_abaixo_do_recuo, false);
    assert.ok(!ev.publicados.some((e) => e.tipo === 'contraproposta_abaixo_do_recuo'));
    // E não registra a decisão do proprietário.
    assert.equal((await chamar('PATCH', '/propostas/1', { decisao: 'aceita' })).status, 403);
  });
});

test('decisão do proprietário: recusa e contraproposta voltam ao corretor; aceita encerra ganha com a comissão prevista', async () => {
  const banco = new BancoFalso(UNICOS);
  const b = await base(banco, 100);
  const ev = eventos();
  await comServidor(rotas, corretor(1, 100, ev), banco, {}, async (chamar) => {
    const nid = await pronta(chamar, b);
    const oferta = (await chamar('POST', `/negociacoes/${nid}/propostas`, { direcao: 'comprador', valor_c: 140_000_000 })).corpo;
    // Sem acordo levado ao proprietário, não há decisão.
    assert.equal((await chamar('PATCH', `/propostas/${oferta.id}`, { decisao: 'aceita' })).corpo.codigo, 'SEM_ACORDO');
    assert.equal((await chamar('POST', `/negociacoes/${nid}/decisao`, { acao: 'aceitar_acordo', proposta_id: oferta.id })).status, 200);
    // Nova contraproposta do vendedor não sai com o acordo no proprietário.
    assert.equal((await chamar('POST', `/negociacoes/${nid}/propostas`, { direcao: 'vendedor', valor_c: 146_000_000, canal: 'portal' })).corpo.codigo, 'ACORDO_PROPOSTO');
    assert.equal((await chamar('PATCH', `/propostas/${oferta.id}`, { decisao: 'talvez' })).status, 422);
    assert.equal((await chamar('PATCH', `/propostas/${oferta.id}`, { decisao: 'contraproposta' })).status, 422);
    const cp = await chamar('PATCH', `/propostas/${oferta.id}`, { decisao: 'contraproposta', valor_c: 144_000_000, condicoes: 'à vista' });
    assert.equal(cp.status, 200, JSON.stringify(cp.corpo));
    assert.equal(cp.corpo.negociacao.estado, 'aguardando_corretor');
    assert.equal(cp.corpo.proposta.direcao, 'proprietario');
    assert.ok(ev.publicados.some((e) => e.tipo === 'proposta_decidida' && e.payload.proposta_id === oferta.id));
    // Outro acordo, desta vez aceito pelo proprietário.
    const oferta2 = (await chamar('POST', `/negociacoes/${nid}/propostas`, { direcao: 'comprador', valor_c: 142_000_000 })).corpo;
    await chamar('POST', `/negociacoes/${nid}/decisao`, { acao: 'aceitar_acordo', proposta_id: oferta2.id });
    const ok = await chamar('PATCH', `/propostas/${oferta2.id}`, { decisao: 'aceita' });
    assert.equal(ok.status, 200, JSON.stringify(ok.corpo));
    assert.equal(ok.corpo.negociacao.estado, 'ganha');
    assert.equal(ok.corpo.negociacao.valor_final_c, 142_000_000);
    assert.equal(ok.corpo.comissao_prevista_c, 7_100_000);
    assert.equal(banco.linhas('negocios')[0].valor_estimado_c, 142_000_000);
    assert.ok(ev.publicados.some((e) => e.tipo === 'negociacao_encerrada'));
    assert.equal((await chamar('PATCH', `/propostas/${oferta2.id}`, { decisao: 'recusa' })).corpo.codigo, 'NEGOCIACAO_ENCERRADA');
  });
});

test('isolamento: a decisão do proprietário e a nova contraproposta de outra conta respondem 404', async () => {
  const banco = new BancoFalso(UNICOS);
  const b = await base(banco, 100);
  let nid = 0;
  let pid = 0;
  await comServidor(rotas, corretor(1, 100), banco, {}, async (chamar) => {
    nid = await pronta(chamar, b);
    pid = (await chamar('POST', `/negociacoes/${nid}/propostas`, { direcao: 'comprador', valor_c: 140_000_000 })).corpo.id;
    await chamar('POST', `/negociacoes/${nid}/decisao`, { acao: 'aceitar_acordo', proposta_id: pid });
  });
  await comServidor(rotas, corretor(2, 200), banco, {}, async (chamar) => {
    assert.equal((await chamar('PATCH', `/propostas/${pid}`, { decisao: 'aceita' })).status, 404);
    assert.equal((await chamar('POST', `/negociacoes/${nid}/propostas`, { direcao: 'vendedor', valor_c: 146_000_000, canal: 'portal' })).status, 404);
    assert.equal((await chamar('GET', `/negociacoes/${nid}`)).status, 404);
  });
  assert.equal(banco.linhas('negociacoes')[0].estado, 'aguardando_proprietario');
});

test('Encerrar como ganha pelo PATCH devolve a comissão prevista e atualiza o valor do negócio', async () => {
  const banco = new BancoFalso(UNICOS);
  const b = await base(banco, 100);
  await comServidor(rotas, corretor(1, 100), banco, {}, async (chamar) => {
    const nid = await pronta(chamar, b);
    const r = await chamar('PATCH', `/negociacoes/${nid}`, { estado: 'ganha', valor_final_c: 140_000_000 });
    assert.equal(r.status, 200);
    assert.equal(r.corpo.comissao_prevista_c, 7_000_000);
    assert.equal(banco.linhas('negocios')[0].valor_estimado_c, 140_000_000);
  });
});

test('D-127: abrir a negociação deixa o aviso de sistema "Negociação aberta" na conversa do cliente', async () => {
  const banco = new BancoFalso(UNICOS);
  const b = await base(banco, 100);
  await comServidor(rotas, corretor(1, 100), banco, {}, async (chamar) => {
    const nid = await pronta(chamar, b);
    const msg = banco.linhas('mensagens').find((m) => m.tipo === 'sistema' && /Negociação aberta/.test(String(m.conteudo)))!;
    assert.ok(msg, 'aviso na conversa');
    assert.equal(msg.contato_id, b.contato.id);
    assert.equal(msg.dados.negociacao_id, nid);
    assert.equal(msg.autor_tipo, 'sistema');
  });
});
