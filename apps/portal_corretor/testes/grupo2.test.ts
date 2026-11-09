import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { rotas, reagir } from '../backend/rotas';
import { formatarTelefone, normalizarPerfilBusca, validarContato } from '../comum/crm';
import { horariosLivres, mensagemDaVisita } from '../comum/conversas';
import { ultimoSinal } from '../comum/funil';
import { BancoFalso, comServidor, type Ator } from './apoio';

// Etapa 4, grupo 2 (P01, P03, P04; Seleção e Agendar visita na P02): o que as rotas passaram a devolver
// e a fazer, com o isolamento entre contas (spec 4.5) em cada uma.

const UNICOS = { contatos: ['telefone'], imoveis: ['codigo'], visitas: ['atividade_id'], etapas_funil: ['pipeline+nome'], origens: ['canal+campanha'], vitrine_publica: ['tipo+chave'], selecao_itens: ['selecao_id+imovel_id'] };
type Publicado = { tipo: string; payload: Record<string, unknown> };
function eventos() {
  const publicados: Publicado[] = [];
  return { publicados, eventos: { publicar: async (tipo: string, payload: Record<string, unknown>) => publicados.push({ tipo, payload }) } };
}
const evA = eventos();
const A: Ator = { usuario: 1, conta: 100, papeis: ['corretor'], extras: { eventos: evA.eventos } };
const B: Ator = { usuario: 2, conta: 200, papeis: ['corretor'] };
const HOJE = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
const dia = (delta: number) => new Date(Date.now() + delta * 86400e3).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
const raiz = (f: string) => readFileSync(resolve(process.cwd(), f), 'utf8');

/** Shell falso com ingressos (como em cliente.test.ts): o `POST /selecoes` gera o link por ele. */
function shellFalso() {
  let n = 0;
  return {
    gerarIngressoWh: async ({ webhook, expira_em }: { webhook: string; contexto: unknown; expira_em?: Date }) => {
      n++;
      const token = `wh_${webhook}_${n}x`;
      return { url: `https://corretor.exemplo/api/wh/portal_corretor/${token}`, token, ingresso_id: n, expira_em: expira_em ? expira_em.toISOString() : null };
    },
    revogarIngressoWh: async () => ({ revogado: true }),
  };
}

type Chamar = (m: string, c: string, b?: unknown) => Promise<{ status: number; corpo: any }>;

async function imovelAnunciado(chamar: Chamar, titulo: string, telefoneDono: string) {
  const im = (await chamar('POST', '/imoveis', { tipo: 'apartamento', cidade: 'Brasília', bairro: 'Noroeste', titulo, endereco: 'SQNW 111 Bloco C', endereco_publico: 'bairro' })).corpo;
  await chamar('PATCH', `/imoveis/${im.id}`, { preco: 990000, quartos: 3 });
  const dono = (await chamar('POST', '/contatos', { nome: 'Dono Proprietário', telefone: telefoneDono })).corpo;
  const aut = (await chamar('POST', '/autorizacoes', { imovel_id: im.id, proprietario_id: dono.id, inicio: HOJE, fim: dia(60), comissao_pct: '5', preco_autorizado: '990.000' })).corpo;
  const doc = (await chamar('POST', `/imoveis/${im.id}/midias`, { upload_id: 702, tipo: 'documento' })).corpo;
  await chamar('PATCH', `/autorizacoes/${aut.id}`, { documento_midia_id: doc.id, situacao: 'assinada' });
  await chamar('PATCH', `/imoveis/${im.id}`, { situacao: 'ativo' });
  return im;
}

test('regras puras: telefone formatado (#182), perfil de busca normalizado, horários livres e o último sinal', () => {
  assert.equal(formatarTelefone('+5561990000101'), '(61) 99000-0101');
  assert.equal(formatarTelefone('61990000101'), '(61) 99000-0101');
  assert.equal(formatarTelefone('+556133330000'), '(61) 3333-0000');
  assert.equal(formatarTelefone('+351912345678'), '+351912345678', 'fora do Brasil sai como está');
  assert.equal(formatarTelefone(null), '');

  assert.deepEqual(normalizarPerfilBusca({ finalidade: ' moradia ', tipos: 'apartamento, casa', regioes: ['Sudoeste', ''], preco_max_c: '90000000', quartos: 3.4, vagas: 0, lixo: 1 }), {
    finalidade: 'moradia', tipos: ['apartamento', 'casa'], regioes: ['Sudoeste'], preco_max_c: 90000000, quartos: 3,
  });
  assert.equal(normalizarPerfilBusca({}), null);
  assert.equal(normalizarPerfilBusca('x'), null);
  const v = validarContato({ perfil_busca: { tipos: ['casa'] } }, true);
  assert.ok(v.ok && v.dados.perfil_busca && (v.dados.perfil_busca as { tipos: string[] }).tipos[0] === 'casa');
  assert.equal(validarContato({ perfil_busca: 'texto' }, true).ok, false);
  const nulo = validarContato({ perfil_busca: null }, true);
  assert.ok(nulo.ok && nulo.dados.perfil_busca === null, 'nulo limpa o perfil');

  // Horários livres: de hora em hora, 9 h às 18 h, sem domingo, nunca antes de uma hora a partir de agora, e sem choque com o que está marcado.
  const agora = new Date(2026, 10, 9, 14, 30); // segunda-feira
  const livres = horariosLivres([{ quando: new Date(2026, 10, 9, 16, 0).toISOString() }, { quando: new Date(2026, 10, 10, 9, 30).toISOString() }], agora, 2);
  const rotulos = livres.map((h) => h.rotulo);
  assert.equal(rotulos[0], 'Hoje · 17:00', 'começa uma hora depois de agora (15:30 → 16:00) e pula a hora da atividade das 16h');
  assert.ok(!rotulos.includes('Hoje · 16:00'), 'a hora da atividade marcada não entra');
  assert.ok(!rotulos.includes('Amanhã · 09:00') && !rotulos.includes('Amanhã · 10:00'), 'uma hora de folga para cada lado da atividade das 9h30');
  assert.ok(rotulos.includes('Amanhã · 11:00'));
  assert.ok(rotulos.every((r) => !/dom/.test(r)));
  assert.match(mensagemDaVisita('Ana Ribeiro', new Date(2026, 10, 10, 10, 0), { codigo: 'IM-0001', titulo: 'Casa', bairro: 'Lago Sul' }), /^Ana, visita marcada ao Casa \(Lago Sul\): .*10:00/);

  // Último sinal: o mais recente entre a linha do tempo e o clique num envio.
  assert.deepEqual(ultimoSinal({ resumo: 'Visitou', ocorrido_em: '2026-11-01T10:00:00Z' }, { imovel_titulo: 'Casa', cliques: 2, primeiro_clique_em: '2026-11-02T10:00:00Z' }), { texto: 'Abriu Casa 2x', em: '2026-11-02T10:00:00.000Z' });
  assert.equal(ultimoSinal({ resumo: 'Visitou', ocorrido_em: '2026-11-03T10:00:00Z' }, { tipo: 'selecao', cliques: 1, primeiro_clique_em: '2026-11-02T10:00:00Z' })?.texto, 'Visitou');
  assert.equal(ultimoSinal(null, { cliques: 0 }), null);
});

test('GET /atividades: nome do contato e código do imóvel da visita; ?contato_id= filtra ou é recusado (#196)', async () => {
  const banco = new BancoFalso(UNICOS);
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    const ana = (await chamar('POST', '/contatos', { nome: 'Ana Ribeiro', telefone: '61911110001' })).corpo;
    const bia = (await chamar('POST', '/contatos', { nome: 'Bia', telefone: '61911110002' })).corpo;
    const im = (await chamar('POST', '/imoveis', { tipo: 'casa', titulo: 'Casa do Lago', bairro: 'Lago Sul', cidade: 'Brasília' })).corpo;
    // Anunciável (envio só aceita imóvel ativo com autorização vigente).
    banco.linhas('imoveis').find((i) => i.id === im.id)!.situacao = 'ativo';
    await banco.dados(100).criar('autorizacoes_venda', { imovel_id: im.id, situacao: 'assinada', inicio: '2020-01-01', fim: '2099-12-31', documento_midia_id: 1 });
    await chamar('POST', '/atividades', { tipo: 'visita', titulo: 'Visita', quando: '2026-12-01T13:00:00Z', contato_id: ana.id, imovel_id: im.id });
    await chamar('POST', '/atividades', { tipo: 'ligacao', titulo: 'Ligar', quando: '2026-12-02T13:00:00Z', contato_id: bia.id });
    const todas = (await chamar('GET', '/atividades?status=pendente')).corpo;
    assert.deepEqual(todas.dados.map((a: any) => [a.contato_nome, a.imovel_codigo]), [['Ana Ribeiro', im.codigo], ['Bia', null]]);
    const daAna = (await chamar('GET', `/atividades?contato_id=${ana.id}`)).corpo;
    assert.deepEqual(daAna.dados.map((a: any) => a.titulo), ['Visita']);
    assert.equal((await chamar('GET', '/atividades?contato_id=abc')).status, 422);
    assert.equal((await chamar('GET', `/atividades?contato_id=${bia.id}&status=feita`)).corpo.total, 0);
  });
  await comServidor(rotas, B, banco, {}, async (chamar) => {
    assert.equal((await chamar('GET', `/atividades?contato_id=${banco.linhas('contatos')[0].id}`)).corpo.total, 0, 'B não lista as atividades do contato de A');
  });
});

test('origem na ficha e na exportação pela origem_id (#186); a lista traz a etapa do negócio; PATCH grava o perfil de busca', async () => {
  const banco = new BancoFalso(UNICOS);
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    const ana = (await chamar('POST', '/contatos', { nome: 'Ana', telefone: '61911110001', origem_canal: 'instagram', origem_campanha: 'Casa JB' })).corpo;
    // O banco falso não faz a junção `campos_incluir`: a ficha e a exportação resolvem pela origem_id.
    const ficha = (await chamar('GET', `/contatos/${ana.id}`)).corpo;
    assert.deepEqual([ficha.contato.origem_canal, ficha.contato.origem_campanha], ['instagram', 'Casa JB']);
    const csv = (await chamar('GET', '/contatos/exportar')).corpo as string;
    assert.match(csv, /Ana;\+5561911110001;;comprador;morno;instagram;Casa JB/);
    // Lista: a etapa do negócio em andamento.
    await chamar('POST', '/negocios', { contato_id: ana.id, pipeline: 'compra' });
    const lista = (await chamar('GET', '/contatos')).corpo;
    assert.equal(lista.dados[0].etapa_nome, 'Novo');
    // Perfil de busca (Editar perfil): normalizado; a ficha devolve; inválido é recusado.
    const r = await chamar('PATCH', `/contatos/${ana.id}`, { perfil_busca: { tipos: 'casa', regioes: ['Lago Sul'], preco_max_c: 150000000, quartos: 4 } });
    assert.equal(r.status, 200);
    assert.deepEqual(r.corpo.perfil_busca, { tipos: ['casa'], regioes: ['Lago Sul'], preco_max_c: 150000000, quartos: 4 });
    assert.equal((await chamar('PATCH', `/contatos/${ana.id}`, { perfil_busca: 'x' })).status, 422);
  });
  await comServidor(rotas, B, banco, {}, async (chamar) => {
    assert.equal((await chamar('PATCH', `/contatos/${banco.linhas('contatos')[0].id}`, { perfil_busca: { tipos: 'casa' } })).status, 404);
  });
});

test('GET /funil/quadro: o último sinal de cada cartão vem da linha do tempo ou do clique num envio', async () => {
  const banco = new BancoFalso(UNICOS);
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    const ana = (await chamar('POST', '/contatos', { nome: 'Ana', telefone: '61911110001' })).corpo;
    await chamar('POST', '/negocios', { contato_id: ana.id, pipeline: 'compra' });
    await chamar('POST', `/contatos/${ana.id}/notas`, { texto: 'Pediu fotos da casa' });
    let q = (await chamar('GET', '/funil/quadro?pipeline=compra')).corpo;
    assert.equal(q.negocios[0].ultimo_sinal?.texto, 'Pediu fotos da casa');
    // Um clique mais recente no envio vence a nota.
    const im = (await chamar('POST', '/imoveis', { tipo: 'casa', titulo: 'Casa do Lago', bairro: 'Lago Sul', cidade: 'Brasília' })).corpo;
    // Anunciável (envio só aceita imóvel ativo com autorização vigente).
    banco.linhas('imoveis').find((i) => i.id === im.id)!.situacao = 'ativo';
    await banco.dados(100).criar('autorizacoes_venda', { imovel_id: im.id, situacao: 'assinada', inicio: '2020-01-01', fim: '2099-12-31', documento_midia_id: 1 });
    const e = (await chamar('POST', '/envios', { contato_id: ana.id, tipo: 'imovel', imovel_id: im.id, canal: 'whatsapp' })).corpo;
    const envio = banco.linhas('envios').find((x) => x.id === (e.envio?.id ?? e.id))!;
    Object.assign(envio, { cliques: 2, primeiro_clique_em: new Date(Date.now() + 1000).toISOString(), imovel_titulo: 'Casa do Lago' });
    q = (await chamar('GET', '/funil/quadro?pipeline=compra')).corpo;
    assert.equal(q.negocios[0].ultimo_sinal?.texto, 'Abriu Casa do Lago 2x');
  });
});

test('POST /selecoes: o cartão da seleção entra na conversa, com os eventos envio_criado e mensagem_enviada só com ids; o portal diz o último acesso', async () => {
  const banco = new BancoFalso(UNICOS);
  evA.publicados.length = 0;
  let ana = 0;
  await comServidor(rotas, A, banco, shellFalso(), async (chamar) => {
    const im = await imovelAnunciado(chamar, 'Apto com varanda', '61944440001');
    ana = (await chamar('POST', '/contatos', { nome: 'Ana Ribeiro', telefone: '61911110001' })).corpo.id;
    const r = await chamar('POST', '/selecoes', { contato_id: ana, titulo: 'Casas no Noroeste', imovel_ids: [im.id] });
    assert.equal(r.status, 201, JSON.stringify(r.corpo));
    assert.match(r.corpo.mensagem, /Separei 1 imóvel para você/);
    assert.match(r.corpo.link_whatsapp, /^https:\/\/wa\.me\/5561911110001\?text=/);
    assert.ok(r.corpo.conversa_id > 0);
    const d = (await chamar('GET', `/conversas/${r.corpo.conversa_id}`)).corpo;
    const m = d.mensagens[d.mensagens.length - 1];
    assert.deepEqual([m.tipo, m.direcao, m.canal, m.conteudo], ['selecao', 'saida', 'wa_me', 'Casas no Noroeste']);
    assert.deepEqual(Object.keys(m.dados).sort(), ['link', 'quantidade', 'selecao_id', 'titulo']);
    assert.equal(d.conversa.ultima_mensagem, 'Seleção enviada: Casas no Noroeste');
    // Portal: sem acesso ainda; depois de gerar o link, sem último acesso até o cliente agir.
    await chamar('POST', `/contatos/${ana}/portal`);
    const p = (await chamar('GET', `/contatos/${ana}/portal`)).corpo;
    assert.deepEqual([p.ativo, p.ultimo_acesso_em], [true, null]);
  });
  const tipos = evA.publicados.map((p) => p.tipo);
  assert.ok(tipos.includes('envio_criado') && tipos.includes('mensagem_enviada'), tipos.join(','));
  const envio = evA.publicados.find((p) => p.tipo === 'envio_criado')!;
  assert.deepEqual(Object.keys(envio.payload).sort(), ['contato_id', 'envio_id', 'imovel_id']);
  for (const p of evA.publicados) assert.ok(!/Casas no Noroeste|Ana/.test(JSON.stringify(p.payload)), `evento ${p.tipo} sem texto nem nome`);

  // O cliente age pelo portal (mensagem): o listener marca o último acesso na conta certa.
  const ctx = { ...banco.ctxSistema([{ id: 100, nome: 'A' }, { id: 200, nome: 'B' }]), eventos: { publicar: async () => {} } };
  const payload = { contato_id: ana, tipo: 'mensagem', texto: 'Gostei da varanda', visita: null, tarefa: null, negociacao: null, proposta: null, valor_c: null };
  const acesso = banco.linhas('acessos_cliente').find((l) => Number(l.contato_id) === ana && l.conta_id === 100)!;
  assert.equal(acesso.ultimo_acesso_em ?? null, null, 'antes do evento, sem último acesso');
  // Na conta B o mesmo evento não marca nada (o contato não é dela): o valor de A fica igual.
  const MARCA = '2020-01-01T00:00:00.000Z';
  acesso.ultimo_acesso_em = MARCA;
  await reagir.acao_cliente_recebida({ payload, conta_id: 200 } as never, ctx);
  assert.equal(acesso.ultimo_acesso_em, MARCA, 'o evento da conta B não altera o último acesso de A');
  // Na conta A o evento altera.
  await reagir.acao_cliente_recebida({ payload, conta_id: 100 } as never, ctx);
  assert.notEqual(acesso.ultimo_acesso_em, MARCA, 'o evento da conta A altera o último acesso');
  await comServidor(rotas, A, banco, shellFalso(), async (chamar) => {
    const p = (await chamar('GET', `/contatos/${ana}/portal`)).corpo;
    assert.ok(p.ultimo_acesso_em, 'último acesso marcado');
    assert.ok(new Date(p.ultimo_acesso_em).getTime() > Date.now() - 60_000);
  });
  await comServidor(rotas, B, banco, shellFalso(), async (chamar) => {
    assert.equal((await chamar('GET', `/contatos/${ana}/portal`)).status, 404);
  });
});

/** Banco cujas escritas em `tabela` lançam (banco fora do ar no meio da rota). */
function falhandoAoCriar(banco: BancoFalso, tabelas: string[]) {
  const original = banco.dados.bind(banco);
  banco.dados = (conta: number | null, global = false) => {
    const h = original(conta, global);
    const criar = h.criar;
    const atualizar = h.atualizar;
    h.criar = async (tabela: string, d: Record<string, unknown>) => {
      if (tabelas.includes(tabela)) throw new Error('fora do ar');
      return criar(tabela, d);
    };
    h.atualizar = async (tabela: string, i: number, d: Record<string, unknown>) => {
      if (tabelas.includes(tabela)) throw new Error('fora do ar');
      return atualizar(tabela, i, d);
    };
    return h;
  };
}

test('POST /selecoes: com a seleção no ar, a falha ao registrar o cartão na conversa não vira erro nem convida a repetir', async () => {
  const banco = new BancoFalso(UNICOS);
  let ana = 0;
  let imovelId = 0;
  await comServidor(rotas, A, banco, shellFalso(), async (chamar) => {
    imovelId = (await imovelAnunciado(chamar, 'Apto com varanda', '61944440001')).id;
    ana = (await chamar('POST', '/contatos', { nome: 'Ana Ribeiro', telefone: '61911110001' })).corpo.id;
  });
  falhandoAoCriar(banco, ['mensagens', 'conversas']);
  const avisos: string[] = [];
  const warn = console.warn;
  console.warn = (...a: unknown[]) => void avisos.push(a.join(' '));
  try {
    await comServidor(rotas, A, banco, shellFalso(), async (chamar) => {
      const r = await chamar('POST', '/selecoes', { contato_id: ana, titulo: 'Casas no Noroeste', imovel_ids: [imovelId] });
      assert.equal(r.status, 201, JSON.stringify(r.corpo));
      assert.match(r.corpo.link, /\/portal_corretor\/s\?t=/);
      assert.match(r.corpo.mensagem, new RegExp(r.corpo.link.replace(/[?.]/g, '\\$&')));
      assert.match(r.corpo.link_whatsapp, /^https:\/\/wa\.me\//);
      assert.equal(r.corpo.conversa_id, null, 'o cartão não entrou na conversa');
    });
  } finally {
    console.warn = warn;
  }
  assert.equal(banco.linhas('selecoes').length, 1, 'uma seleção só');
  assert.equal(banco.linhas('mensagens').length, 0);
  assert.ok(avisos.some((a) => /cartão na conversa não concluído: fora do ar/.test(a)), avisos.join('\n'));
});

test('Agendar visita (P02): uma chamada cria a visita, o lembrete e a confirmação; a falha da confirmação não cria outra visita', async () => {
  const banco = new BancoFalso(UNICOS);
  evA.publicados.length = 0;
  let ana = 0;
  let imovelId = 0;
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    ana = (await chamar('POST', '/contatos', { nome: 'Ana Ribeiro', telefone: '61911110001' })).corpo.id;
    imovelId = (await chamar('POST', '/imoveis', { tipo: 'casa', titulo: 'Casa do Lago', bairro: 'Lago Sul', cidade: 'Brasília' })).corpo.id;
    const confirmacao = 'Ana, visita marcada ao Casa do Lago (Lago Sul): terça, às 10:00. Qualquer imprevisto, me avise por aqui.';
    const r = await chamar('POST', '/atividades', { tipo: 'visita', titulo: 'Visita', quando: '2026-12-01T13:00:00Z', contato_id: ana, imovel_id: imovelId, confirmacao });
    assert.equal(r.status, 201, JSON.stringify(r.corpo));
    assert.match(r.corpo.confirmacao.link, /^https:\/\/wa\.me\/5561911110001\?text=/);
    assert.ok(r.corpo.confirmacao.conversa_id > 0);
    const d = (await chamar('GET', `/conversas/${r.corpo.confirmacao.conversa_id}`)).corpo;
    const m = d.mensagens[d.mensagens.length - 1];
    assert.deepEqual([m.tipo, m.direcao, m.canal, m.conteudo], ['texto', 'saida', 'wa_me', confirmacao]);
    // Sem `confirmacao`, a resposta é a atividade como antes.
    const sem = await chamar('POST', '/atividades', { tipo: 'ligacao', titulo: 'Ligar', quando: '2026-12-02T13:00:00Z', contato_id: ana });
    assert.equal(sem.status, 201);
    assert.equal(sem.corpo.confirmacao, undefined);
  });
  const tipos = evA.publicados.map((p) => p.tipo);
  assert.ok(tipos.includes('visita_agendada') && tipos.includes('mensagem_enviada'), tipos.join(','));
  for (const p of evA.publicados) assert.ok(!/visita marcada|Ana/.test(JSON.stringify(p.payload)), `evento ${p.tipo} sem texto nem nome`);

  // A confirmação falha (banco fora do ar nas mensagens): a visita existe uma vez só e a resposta é coerente.
  falhandoAoCriar(banco, ['mensagens']);
  const visitasAntes = banco.linhas('atividades').filter((a) => a.tipo === 'visita').length;
  const mensagensAntes = banco.linhas('mensagens').length;
  const warn = console.warn;
  console.warn = () => {};
  try {
    await comServidor(rotas, A, banco, {}, async (chamar) => {
      const r = await chamar('POST', '/atividades', { tipo: 'visita', titulo: 'Visita 2', quando: '2026-12-03T13:00:00Z', contato_id: ana, imovel_id: imovelId, confirmacao: 'Ana, outra visita.' });
      assert.equal(r.status, 201, JSON.stringify(r.corpo));
      assert.equal(r.corpo.tipo, 'visita');
      assert.equal(r.corpo.confirmacao.conversa_id, null, 'a confirmação não entrou e a resposta diz isso');
      assert.match(r.corpo.confirmacao.link, /^https:\/\/wa\.me\//);
    });
  } finally {
    console.warn = warn;
  }
  assert.equal(banco.linhas('atividades').filter((a) => a.tipo === 'visita').length, visitasAntes + 1, 'uma visita só');
  assert.equal(banco.linhas('visitas').length, visitasAntes + 1);
  assert.equal(banco.linhas('mensagens').length, mensagensAntes);

  // B não registra confirmação no contato de A: o contato não é dela.
  await comServidor(rotas, B, banco, {}, async (chamar) => {
    assert.equal((await chamar('POST', '/atividades', { tipo: 'visita', titulo: 'V', quando: '2026-12-04T13:00:00Z', contato_id: ana, confirmacao: 'x' })).status, 422);
  });
});

test('Agendar visita (P02): gravada a visita, nenhum passo seguinte vira erro; cada passo da confirmação falha sozinho', async () => {
  const banco = new BancoFalso(UNICOS);
  let ana = 0;
  let imovelId = 0;
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    ana = (await chamar('POST', '/contatos', { nome: 'Ana Ribeiro', telefone: '61911110001' })).corpo.id;
    imovelId = (await chamar('POST', '/imoveis', { tipo: 'casa', titulo: 'Casa do Lago', bairro: 'Lago Sul', cidade: 'Brasília' })).corpo.id;
  });
  // A linha do tempo cai depois da visita gravada: 201, uma visita, uma confirmação; a falha fica no log.
  falhandoAoCriar(banco, ['linha_do_tempo']);
  const avisos: string[] = [];
  const warn = console.warn;
  console.warn = (...a: unknown[]) => void avisos.push(a.join(' '));
  try {
    await comServidor(rotas, A, banco, {}, async (chamar) => {
      const r = await chamar('POST', '/atividades', { tipo: 'visita', titulo: 'Visita', quando: '2026-12-01T13:00:00Z', contato_id: ana, imovel_id: imovelId, confirmacao: 'Ana, visita marcada.' });
      assert.equal(r.status, 201, JSON.stringify(r.corpo));
      assert.ok(r.corpo.confirmacao.conversa_id > 0);
    });
  } finally {
    console.warn = warn;
  }
  assert.equal(banco.linhas('atividades').length, 1, 'uma atividade só');
  assert.equal(banco.linhas('visitas').length, 1, 'uma visita só');
  assert.equal(banco.linhas('mensagens').length, 1, 'uma confirmação só');
  assert.ok(banco.linhas('contatos').find((c) => c.id === ana)?.ultimo_contato_em, 'o último contato não depende da linha do tempo');
  assert.ok(avisos.some((a) => /atividade \d+: linha do tempo não concluído: fora do ar/.test(a)), avisos.join('\n'));

  // O evento mensagem_enviada falha: a linha do tempo e o último contato da confirmação acontecem assim mesmo.
  const banco2 = new BancoFalso(UNICOS);
  const falhaEvento: Ator = { ...A, extras: { eventos: { publicar: async (tipo: string) => { if (tipo === 'mensagem_enviada') throw new Error('barramento fora do ar'); } } } };
  let bia = 0;
  console.warn = () => {};
  try {
    await comServidor(rotas, falhaEvento, banco2, {}, async (chamar) => {
      bia = (await chamar('POST', '/contatos', { nome: 'Bia Souza', telefone: '61911110002' })).corpo.id;
      const r = await chamar('POST', '/atividades', { tipo: 'visita', titulo: 'Visita', quando: '2026-12-01T13:00:00Z', contato_id: bia, confirmacao: 'Bia, visita marcada.' });
      assert.equal(r.status, 201, JSON.stringify(r.corpo));
      assert.ok(r.corpo.confirmacao.conversa_id > 0);
    });
  } finally {
    console.warn = warn;
  }
  const abordagem = banco2.linhas('linha_do_tempo').find((l) => l.tipo === 'abordagem.feita');
  assert.ok(abordagem, 'a linha do tempo da confirmação entrou');
  assert.ok(banco2.linhas('contatos').find((c) => c.id === bia)?.ultimo_contato_em, 'o último contato entrou');

  // `confirmacao` só vale na visita; a visita marcada só pelo negócio confirma ao contato do negócio.
  await comServidor(rotas, A, banco2, {}, async (chamar) => {
    const ligacao = await chamar('POST', '/atividades', { tipo: 'ligacao', titulo: 'Ligar', quando: '2026-12-02T13:00:00Z', contato_id: bia, confirmacao: 'Bia, te ligo.' });
    assert.equal(ligacao.status, 422, JSON.stringify(ligacao.corpo));
    assert.equal(ligacao.corpo.codigo, 'DADOS_INVALIDOS');
    const negocio = (await chamar('POST', '/negocios', { contato_id: bia })).corpo;
    const texto = 'Bia, visita pelo negócio marcada.';
    const r = await chamar('POST', '/atividades', { tipo: 'visita', titulo: 'Visita do negócio', quando: '2026-12-05T13:00:00Z', negocio_id: negocio.id, confirmacao: texto });
    assert.equal(r.status, 201, JSON.stringify(r.corpo));
    assert.equal(r.corpo.contato_id, bia);
    assert.ok(r.corpo.confirmacao.conversa_id > 0, 'a confirmação entrou na conversa do contato do negócio');
    const d = (await chamar('GET', `/conversas/${r.corpo.confirmacao.conversa_id}`)).corpo;
    assert.equal(d.mensagens[d.mensagens.length - 1].conteudo, texto);
  });
  assert.equal(banco2.linhas('atividades').filter((a) => a.tipo === 'ligacao').length, 0, 'a ligação recusada não foi gravada');
  assert.deepEqual([...new Set(banco2.linhas('conversas').map((c) => c.contato_id))], [bia], 'as confirmações estão na conversa da Bia');
});

test('telas do grupo 2: sem CSS próprio, sem `pequeno`, sem chamada direta; chip "Todas" primeiro (D-122) e o cabeçalho comum (D-128)', () => {
  for (const arq of ['frontend/telas/inicio.ts', 'frontend/telas/clientes.ts', 'frontend/telas/clientes-quadro.ts', 'frontend/telas/ficha-contato.ts', 'frontend/telas/selecoes-cliente.ts', 'frontend/telas/agenda.ts', 'frontend/moldura.ts']) {
    const fonte = raiz(arq);
    assert.doesNotMatch(fonte, /\bcss`|style=|<style|static styles|preencher|data-layout/, `${arq}: CSS na tela`);
    assert.doesNotMatch(fonte, /<urbi-botao[^>]*\bpequeno\b/, `${arq}: botão pequeno (D-128: 34 px)`);
  }
  const clientes = raiz('frontend/telas/clientes.ts');
  assert.match(clientes, /cabecalhoColuna\(\s*'Clientes'/, 'o cabeçalho comum da moldura');
  assert.match(clientes, /\{ id: 'todas', rotulo: 'Todas' \}, \.\.\.FILTROS_PRONTOS/);
  assert.match(clientes, /placeholder="Buscar nome ou telefone"/);
  assert.match(clientes, /formatarTelefone\(c\.telefone\)/);
  assert.match(clientes, /Mostrar mais/);
  // A duplicata oferece abrir o contato (#187): o laço compartilhado de apoio.ts, com a duplicata do contato.
  assert.match(clientes, /duplicata: duplicataDeContato\(abrir\)/, 'o Novo cliente usa a duplicata do contato (#187)');
  assert.match(raiz('frontend/apoio.ts'), /rotuloConfirmar: `Abrir \$\{nome\}`/, 'a duplicata oferece abrir o contato (#187)');
  const quadro = raiz('frontend/telas/clientes-quadro.ts');
  assert.match(quadro, /\{ id: 'todas', rotulo: 'Todas' \}, \.\.\.FILTROS_PRONTOS/);
  assert.doesNotMatch(quadro, /urbi-select/, 'sem select na esquerda do Funil');
  assert.match(quadro, /<urbi-kanban expandir/);
  const ficha = raiz('frontend/telas/ficha-contato.ts');
  assert.match(ficha, /ABA_PADRAO: AbaFicha = 'linha'/, 'a ficha abre na Linha do tempo (D-117)');
  assert.match(ficha, /Editar perfil/);
  assert.match(ficha, /Exportar dados/);
  const conversas = raiz('frontend/telas/conversas.ts');
  assert.match(conversas, /<urbi-modal title="Seleção de imóveis"/);
  assert.match(conversas, /<urbi-modal title="Agendar visita"/);
  assert.match(conversas, /enviar\('POST', '\/selecoes'/);
  assert.match(conversas, /enviar\('POST', '\/atividades', \{ tipo: 'visita'[^}]*confirmacao \}/, 'a visita e a confirmação numa chamada só');
  assert.doesNotMatch(conversas, /\/conversas\/\$\{this\.conversaId\}\/mensagens`, \{ texto \}\)\)\) as \{ link/, 'sem a segunda chamada da visita');
  assert.match(conversas, /window\.location\.origin/, 'a Seleção completa o link relativo');
});
