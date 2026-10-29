import { test } from 'node:test';
import assert from 'node:assert/strict';
import schema from '../schema.json';
import { rotas } from '../backend/rotas';
import { BancoFalso, comServidor, type Ator, type Unico } from './apoio';

// Consertos de backend do D3 (revisão do PR): o documento da autorização do proprietário citado por um
// mandato fica interno e não se remove; o anexo do mandato é um documento do imóvel da negociação; o
// "Fazer agora" sem WhatsApp do cliente recusa antes de gravar; a lista usa o JOIN de `campos_incluir`.

const EM_ANDAMENTO = (schema.tabelas.negociacoes.unicos as unknown[]).find((u) => !Array.isArray(u)) as Exclude<Unico, string>;
const UNICOS: Record<string, Unico[]> = { negociacoes: [EM_ANDAMENTO, 'codigo'], mandatos_negociacao: ['negociacao_id+versao'], playbook_objecoes: ['categoria+origem'], config_negociador: ['chave'] };

const PEDIDO = 150_000_000;
const MANDATO = {
  preco_pedido_c: PEDIDO,
  alvo_c: 145_000_000,
  recuo_c: 136_000_000,
  batna_vendedor: 'Manter anunciado',
  concessoes: [{ item: 'prazo de entrega de 90 dias', limite: '90 dias', contrapartida: 'entrada de 30%' }],
  validade: '2099-12-31',
  autonomia: 'pergunta_antes',
};
const anexo = (arquivo_id: number) => ({ ...MANDATO, autorizacao_proprietario: { tipo: 'anexo', arquivo_id, data: '2026-10-01' } });

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
const eventos = () => ({ publicar: async () => ({ id: 1 }) });

const sugestao = {
  objecao: { categoria: 'preco', trecho: 'Está caro' },
  interesses_identificados: ['entrega rápida'],
  teto_estimado_comprador_c: 139_000_000,
  fonte_estimativa: 'disse que tem 1,39 aprovado no banco',
  movimento: 'contraproposta',
  contraproposta: { valor_c: 146_000_000, condicoes: 'entrega em 90 dias', concessao: 'prazo de entrega de 90 dias', contrapartida: 'entrada de 30%', validade_horas: 48 },
  mensagem: 'Ana, consigo R$ 1.460.000 com entrega em 90 dias e entrada de 30%.',
  passar_ao_corretor: false,
  motivo: null,
  resumo_rodada: 'Cliente pediu 1,40; sugerida 1,46 com prazo.',
};

async function base(banco: BancoFalso, conta: number, telefone: string | null = '+5561988887777') {
  const d = banco.dados(conta);
  const contato = await d.criar('contatos', { nome: `Ana ${conta}`, telefone, email: `ana${conta}@exemplo.com` });
  const negocio = await d.criar('negocios', { contato_id: contato.id, titulo: 'Compra', pipeline: 'compra', etapa_id: 1, responsavel_id: 1 });
  const imovel = await d.criar('imoveis', { codigo: `IM-${conta}`, titulo: 'Casa 4 quartos', bairro: 'Jardim Botânico', preco_c: PEDIDO });
  const outro = await d.criar('imoveis', { codigo: `IM-${conta}-2`, titulo: 'Apartamento', bairro: 'Asa Sul', preco_c: PEDIDO });
  const midia = (imovel_id: number, tipo: string, arquivo: number) =>
    d.criar('imovel_midias', { imovel_id, arquivo, tipo, ordem: 0, publica: false, gerada_por_ia: false });
  return { contato, negocio, imovel, outro, midia };
}

const corretor = (conta: number, ia: unknown[] = []): Ator => ({ usuario: 1, conta, papeis: ['corretor'], extras: { eventos: eventos(), ia: iaSimulada(ia as Record<string, unknown>[]) } });

test('documento citado na autorização do proprietário de um mandato: não vira foto, não fica público, não se remove', async () => {
  const banco = new BancoFalso(UNICOS);
  const b = await base(banco, 100);
  const citado = await b.midia(b.imovel.id, 'documento', 501);
  const livre = await b.midia(b.imovel.id, 'documento', 502);
  await comServidor(rotas, corretor(100), banco, {}, async (chamar) => {
    const n = (await chamar('POST', '/negociacoes', { negocio_id: b.negocio.id, imovel_id: b.imovel.id })).corpo;
    const put = await chamar('PUT', `/negociacoes/${n.id}/mandato`, anexo(citado.id));
    assert.equal(put.status, 200, JSON.stringify(put.corpo));
    // Uma versão nova do mandato sem anexo: a versão antiga ainda cita o documento (histórico).
    assert.equal((await chamar('PUT', `/negociacoes/${n.id}/mandato`, MANDATO)).status, 200);

    const viraFoto = await chamar('PATCH', `/imoveis/${b.imovel.id}/midias/${citado.id}`, { tipo: 'foto' });
    assert.equal(viraFoto.status, 409);
    assert.equal(viraFoto.corpo.codigo, 'DOCUMENTO_EM_USO');
    assert.equal((await chamar('PATCH', `/imoveis/${b.imovel.id}/midias/${citado.id}`, { publica: true })).corpo.codigo, 'DOCUMENTO_EM_USO');
    const remover = await chamar('PATCH', `/imoveis/${b.imovel.id}/midias/${citado.id}/remover`);
    assert.equal(remover.status, 409);
    assert.equal(remover.corpo.codigo, 'DOCUMENTO_EM_USO');
    const linha = banco.linhas('imovel_midias').find((m) => m.id === citado.id)!;
    assert.deepEqual([linha.tipo, linha.publica], ['documento', false]);
    assert.equal((await chamar('PATCH', `/imoveis/${b.imovel.id}/midias/${citado.id}`, { legenda: 'Autorização' })).status, 200, 'legenda pode');

    // O documento que nenhum mandato cita segue livre.
    assert.equal((await chamar('PATCH', `/imoveis/${b.imovel.id}/midias/${livre.id}`, { tipo: 'foto', publica: true })).status, 200);
    assert.equal((await chamar('PATCH', `/imoveis/${b.imovel.id}/midias/${livre.id}/remover`)).status, 200);
  });
});

test('PUT do mandato com anexo: só um documento do imóvel da negociação', async () => {
  const banco = new BancoFalso(UNICOS);
  const b = await base(banco, 100);
  const doOutro = await b.midia(b.outro.id, 'documento', 601);
  const foto = await b.midia(b.imovel.id, 'foto', 602);
  const doc = await b.midia(b.imovel.id, 'documento', 603);
  // Documento de outra conta, no mesmo id de imóvel não importa: `buscar` não o vê.
  const c = await base(banco, 200);
  const deOutraConta = await c.midia(c.imovel.id, 'documento', 604);
  await comServidor(rotas, corretor(100), banco, {}, async (chamar) => {
    const n = (await chamar('POST', '/negociacoes', { negocio_id: b.negocio.id, imovel_id: b.imovel.id })).corpo;
    for (const [rotulo, mid] of [['de outro imóvel', doOutro.id], ['foto', foto.id], ['inexistente', 99999], ['de outra conta', deOutraConta.id]] as const) {
      const r = await chamar('PUT', `/negociacoes/${n.id}/mandato`, anexo(mid));
      assert.equal(r.status, 422, rotulo);
      assert.equal(r.corpo.codigo, 'DADOS_INVALIDOS', rotulo);
      assert.match(r.corpo.mensagem ?? r.corpo.message ?? JSON.stringify(r.corpo), /documento/, rotulo);
    }
    assert.equal(banco.linhas('mandatos_negociacao').length, 0, 'nada gravado');
    const ok = await chamar('PUT', `/negociacoes/${n.id}/mandato`, anexo(doc.id));
    assert.equal(ok.status, 200, JSON.stringify(ok.corpo));
    assert.equal(ok.corpo.autorizacao_proprietario.arquivo_id, doc.id);
  });
});

for (const [rotulo, acao] of [['aprovar', {}], ['editar', { contraproposta: { valor_c: 146_000_000 } }]] as const) {
  test(`decisão wa_me (${rotulo}) sem WhatsApp do cliente: 422 SEM_WHATSAPP e nada gravado; com telefone, 200 com link`, async () => {
    const banco = new BancoFalso(UNICOS);
    const b = await base(banco, 100, '123');
    await comServidor(rotas, corretor(100, [sugestao]), banco, {}, async (chamar) => {
      const n = (await chamar('POST', '/negociacoes', { negocio_id: b.negocio.id, imovel_id: b.imovel.id })).corpo;
      assert.equal((await chamar('PUT', `/negociacoes/${n.id}/mandato`, MANDATO)).status, 200);
      await chamar('POST', `/negociacoes/${n.id}/propostas`, { direcao: 'comprador', valor_c: 140_000_000 });
      const s = await chamar('POST', `/negociacoes/${n.id}/sugestao`, { mensagem_cliente: 'Está caro. Faço 1,40.' });
      assert.equal(s.status, 200, JSON.stringify(s.corpo));
      const antes = banco.linhas('propostas').length;
      const estado = banco.linhas('negociacoes')[0].estado;

      const r = await chamar('POST', `/negociacoes/${n.id}/decisao`, { acao: rotulo, execucao_id: s.corpo.execucao_id, canal: 'wa_me', ...acao });
      assert.equal(r.status, 422);
      assert.equal(r.corpo.codigo, 'SEM_WHATSAPP');
      assert.match(r.corpo.mensagem ?? r.corpo.message, /portal/);
      assert.equal(banco.linhas('propostas').filter((p) => p.direcao === 'vendedor').length, 0, 'nenhuma proposta do vendedor');
      assert.equal(banco.linhas('propostas').length, antes);
      assert.equal(banco.linhas('negociador_execucoes').find((e) => e.id === s.corpo.execucao_id)!.decisao, 'pendente', 'a sugestão continua pendente');
      assert.equal(banco.linhas('negociacoes')[0].estado, estado);

      // O corretor corrige o telefone: a mesma sugestão sai, com o link.
      banco.linhas('contatos')[0].telefone = '+55 (61) 98888-7777';
      const ok = await chamar('POST', `/negociacoes/${n.id}/decisao`, { acao: rotulo, execucao_id: s.corpo.execucao_id, canal: 'wa_me', ...acao });
      assert.equal(ok.status, 200, JSON.stringify(ok.corpo));
      assert.match(ok.corpo.link, /^https:\/\/wa\.me\/5561988887777\?text=/);
    });
  });
}

test('decisão pelo portal não exige telefone', async () => {
  const banco = new BancoFalso(UNICOS);
  const b = await base(banco, 100, null);
  await comServidor(rotas, corretor(100, [sugestao]), banco, {}, async (chamar) => {
    const n = (await chamar('POST', '/negociacoes', { negocio_id: b.negocio.id, imovel_id: b.imovel.id })).corpo;
    await chamar('PUT', `/negociacoes/${n.id}/mandato`, MANDATO);
    await chamar('POST', `/negociacoes/${n.id}/propostas`, { direcao: 'comprador', valor_c: 140_000_000 });
    const s = (await chamar('POST', `/negociacoes/${n.id}/sugestao`, { mensagem_cliente: 'Faço 1,40.' })).corpo;
    const r = await chamar('POST', `/negociacoes/${n.id}/decisao`, { acao: 'aprovar', execucao_id: s.execucao_id, canal: 'portal' });
    assert.equal(r.status, 200, JSON.stringify(r.corpo));
    assert.equal(r.corpo.link, null);
  });
});

test('lista e negociação: o nome do JOIN fica quando o contato ou o imóvel some do buscar', async () => {
  const banco = new BancoFalso(UNICOS);
  const b = await base(banco, 100);
  await comServidor(rotas, corretor(100), banco, {}, async (chamar) => {
    const n = (await chamar('POST', '/negociacoes', { negocio_id: b.negocio.id, imovel_id: b.imovel.id })).corpo;
    // O banco falso não faz o JOIN de `campos_incluir`: a linha recebe o que o framework traria.
    Object.assign(banco.linhas('negociacoes')[0], { contato_nome: 'Ana 100', imovel_codigo: 'IM-100', imovel_titulo: 'Casa 4 quartos' });
    await banco.dados(100).remover('contatos', b.contato.id);
    await banco.dados(100).remover('imoveis', b.imovel.id);

    const linha = (await chamar('GET', '/negociacoes')).corpo.dados[0];
    assert.deepEqual([linha.contato_nome, linha.imovel_codigo, linha.imovel_titulo], ['Ana 100', 'IM-100', 'Casa 4 quartos']);
    const det = (await chamar('GET', `/negociacoes/${n.id}`)).corpo;
    assert.deepEqual(det.contato, { id: b.contato.id, nome: 'Ana 100' });
    assert.deepEqual(det.imovel, { id: b.imovel.id, codigo: 'IM-100', titulo: 'Casa 4 quartos', bairro: null, preco_c: null });
  });
});

test('lista sem JOIN (banco falso): os nomes ainda vêm, completados pelas buscas', async () => {
  const banco = new BancoFalso(UNICOS);
  const b = await base(banco, 100);
  await comServidor(rotas, corretor(100), banco, {}, async (chamar) => {
    await chamar('POST', '/negociacoes', { negocio_id: b.negocio.id, imovel_id: b.imovel.id });
    const linha = (await chamar('GET', '/negociacoes')).corpo.dados[0];
    assert.deepEqual([linha.contato_nome, linha.imovel_codigo, linha.imovel_titulo], ['Ana 100', 'IM-100', 'Casa 4 quartos']);
  });
});
