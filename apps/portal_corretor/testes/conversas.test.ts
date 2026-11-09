import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rotas, reagir } from '../backend/rotas';
import { BancoFalso, comServidor, type Ator } from './apoio';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buscaDoGesto, gesto } from '../frontend/apoio';
import { chipDeStatus, contarFiltros, haQuanto, passaNoFiltro, resumoDaMensagem } from '../comum/conversas';

// Conversas (P02, D-116): uma conversa por cliente, alimentada pelo portal (listener), pelos envios e pelo
// que o corretor manda; isolamento entre contas (spec 4.5) e eventos só com ids.

const UNICOS = {
  contatos: ['telefone'],
  imoveis: ['codigo'],
  origens: ['canal+campanha'],
  etapas_funil: ['pipeline+nome'],
  conversas: [{ colunas: ['contato_id'], onde: [{ coluna: 'removido_em', operador: 'nulo' as const }] }],
};
type Publicado = { tipo: string; payload: Record<string, unknown> };
function eventos() {
  const publicados: Publicado[] = [];
  return { publicados, eventos: { publicar: async (tipo: string, payload: Record<string, unknown>) => publicados.push({ tipo, payload }) } };
}
const evA = eventos();
const evB = eventos();
const A: Ator = { usuario: 1, conta: 100, papeis: ['corretor'], extras: { eventos: evA.eventos } };
const B: Ator = { usuario: 2, conta: 200, papeis: ['corretor'], extras: { eventos: evB.eventos } };
const semShell = {};

test('corretor: nova conversa, texto pelo WhatsApp do celular, envio de imóvel como cartão, assumir e arquivar', async () => {
  const banco = new BancoFalso(UNICOS);
  evA.publicados.length = 0;
  await comServidor(rotas, A, banco, semShell, async (chamar) => {
    const ana = (await chamar('POST', '/contatos', { nome: 'Ana Ribeiro', telefone: '+5561999990001', origem_canal: 'instagram', origem_campanha: 'Casa J. Botânico' })).corpo;
    const im = (await chamar('POST', '/imoveis', { tipo: 'casa', titulo: 'Casa 4 quartos', bairro: 'Jardim Botânico', cidade: 'Brasília', preco_c: 145000000 })).corpo;
    // Anunciável (envio só aceita imóvel ativo com autorização vigente).
    banco.linhas('imoveis').find((i) => i.id === im.id)!.situacao = 'ativo';
    await banco.dados(100).criar('autorizacoes_venda', { imovel_id: im.id, situacao: 'assinada', inicio: '2020-01-01', fim: '2099-12-31', documento_midia_id: 1 });

    // Nova conversa (o botão Nova): uma por cliente; de novo, devolve a mesma.
    const nova = await chamar('POST', '/conversas', { contato_id: ana.id });
    assert.equal(nova.status, 201);
    assert.equal(nova.corpo.nova, true);
    const cid = nova.corpo.conversa.id;
    assert.deepEqual((await chamar('POST', '/conversas', { contato_id: ana.id })).corpo, { conversa: nova.corpo.conversa, nova: false });
    assert.equal((await chamar('POST', '/conversas', { contato_id: 999 })).status, 422);

    // Enviar texto: gravado como saída pelo `wa.me`, com o link para o celular; a conversa fica "aguardando cliente".
    assert.equal((await chamar('POST', `/conversas/${cid}/mensagens`, { texto: '   ' })).status, 422);
    const envio = await chamar('POST', `/conversas/${cid}/mensagens`, { texto: 'Oi, Ana! A casa está disponível, sim.' });
    assert.equal(envio.status, 201);
    assert.match(envio.corpo.link, /^https:\/\/wa\.me\/5561999990001\?text=/);
    assert.equal(envio.corpo.mensagem.canal, 'wa_me');
    assert.equal(envio.corpo.mensagem.direcao, 'saida');
    assert.equal(envio.corpo.conversa.estado, 'aguardando_cliente');
    assert.ok(banco.linhas('linha_do_tempo').some((l) => l.tipo === 'abordagem.feita' && l.contato_id === ana.id), 'conta como abordagem na linha do tempo');

    // Envio de imóvel (P02 › Imóvel): entra na conversa como cartão, sem endereço nem dado do proprietário.
    const e = await chamar('POST', '/envios', { contato_id: ana.id, tipo: 'imovel', imovel_id: im.id, canal: 'whatsapp' });
    assert.equal(e.status, 201);
    const detalhe = (await chamar('GET', `/conversas/${cid}`)).corpo;
    assert.deepEqual(detalhe.mensagens.map((m: { tipo: string; direcao: string }) => [m.tipo, m.direcao]), [['texto', 'saida'], ['imovel', 'saida']]);
    // `envio_id` marca o cartão do Registrar envio: o chat do portal deixa a anotação de fora (D-132).
    assert.deepEqual(Object.keys(detalhe.mensagens[1].dados).sort(), ['bairro', 'codigo', 'envio_id', 'imovel_id', 'link', 'preco_c', 'titulo']);
    assert.equal(detalhe.contato.nome, 'Ana Ribeiro');
    assert.equal(detalhe.whatsapp.conectado, false, 'sem o WhatsApp do app, a tela mostra a faixa');
    assert.equal(detalhe.negociacao, null);

    // A lista: resumo da última mensagem, chip de status e origem do contato; os filtros contam.
    const lista = (await chamar('GET', '/conversas')).corpo;
    assert.equal(lista.total, 1);
    assert.equal(lista.dados[0].ultima_mensagem, 'Imóvel enviado: Casa 4 quartos');
    assert.equal(lista.dados[0].origem_canal, 'instagram');
    assert.deepEqual(chipDeStatus(lista.dados[0]), { rotulo: 'Imóvel enviado', cor: 'padrao' });
    assert.equal(lista.contadores.aguardando, 1);
    assert.equal((await chamar('GET', '/conversas?filtro=nao_lidas')).corpo.total, 0);
    assert.equal((await chamar('GET', '/conversas?q=ribeiro')).corpo.total, 1);
    assert.equal((await chamar('GET', '/conversas?q=zzz')).corpo.total, 0);

    // Devolver ao Negociador sem negociação: não há agente atendendo (o Mensageiro chega com o WhatsApp).
    assert.equal((await chamar('POST', `/conversas/${cid}/devolver`)).corpo.codigo, 'SEM_AGENTE');
    // Assumir: a conversa fica com o corretor e ganha o aviso de sistema.
    const assumiu = await chamar('POST', `/conversas/${cid}/assumir`);
    assert.equal(assumiu.status, 200);
    assert.equal(assumiu.corpo.conversa.atendido_por, 'humano');
    const msgs = (await chamar('GET', `/conversas/${cid}`)).corpo.mensagens;
    assert.equal(msgs[msgs.length - 1].autor_tipo, 'sistema');
    assert.match(msgs[msgs.length - 1].conteudo, /assumiu a conversa/);

    // Arquivar tira da lista padrão e entra em Arquivadas.
    assert.equal((await chamar('PATCH', `/conversas/${cid}`, { arquivada: true })).status, 200);
    assert.equal((await chamar('GET', '/conversas')).corpo.total, 0);
    assert.equal((await chamar('GET', '/conversas?filtro=arquivadas')).corpo.total, 1);
    assert.equal((await chamar('PATCH', `/conversas/${cid}`, {})).status, 422);
  });
  // Eventos: só ids e o canal, nunca o texto da mensagem.
  const tipos = evA.publicados.map((p) => p.tipo);
  assert.deepEqual(tipos, ['imovel_criado', 'mensagem_enviada', 'envio_criado', 'mensagem_enviada', 'conversa_assumida']);
  const daConversa = evA.publicados.filter((p) => p.tipo !== 'imovel_criado');
  for (const p of evA.publicados) assert.ok(!/Oi, Ana|Casa 4 quartos/.test(JSON.stringify(p.payload)), `evento ${p.tipo} sem texto`);
  for (const p of daConversa) assert.ok('contato_id' in p.payload);
  assert.deepEqual(Object.keys(daConversa[0].payload).sort(), ['contato_id', 'conversa_id']);
  for (const p of evA.publicados) for (const v of Object.values(p.payload)) assert.ok(v === null || typeof v === 'number', `${p.tipo}: só ids`);
});

test('portal: a mensagem do cliente entra na conversa como não lida e publica mensagem_recebida; entregue de novo não duplica', async () => {
  const banco = new BancoFalso(UNICOS);
  evA.publicados.length = 0;
  let anaId = 0;
  await comServidor(rotas, A, banco, semShell, async (chamar) => {
    anaId = (await chamar('POST', '/contatos', { nome: 'Ana Ribeiro', telefone: '+5561999990001' })).corpo.id;
  });
  const publicados: Publicado[] = [];
  // O `publicar` falso exige a conta explícita, como o barramento em contexto sem usuário (barramento.md § Eventos segregados por conta).
  const ctx = { ...banco.ctxSistema([{ id: 100, nome: 'A' }, { id: 200, nome: 'B' }]), eventos: { publicar: async (tipo: string, payload: Record<string, unknown>, op?: { conta_id?: number }) => {
    if (op?.conta_id !== 100) throw new Error(`evento ${tipo} publicado pelo listener sem a conta (conta_id=${String(op?.conta_id)})`);
    publicados.push({ tipo, payload });
  } } };
  const payload = { contato_id: anaId, tipo: 'mensagem', texto: 'Posso levar minha mãe na visita?', visita: null, tarefa: null, negociacao: null, proposta: null, valor_c: null };
  await reagir.acao_cliente_recebida({ payload, conta_id: 100 } as never, ctx);
  await reagir.acao_cliente_recebida({ payload, conta_id: 100 } as never, ctx);
  assert.equal(banco.linhas('conversas').length, 1, 'uma conversa por cliente');
  assert.equal(banco.linhas('mensagens').length, 1, 'o mesmo evento entregue de novo não duplica');
  assert.equal(banco.linhas('conversas')[0].conta_id, 100);
  assert.deepEqual(publicados.map((p) => p.tipo), ['mensagem_recebida'], 'a reentrega não publica o evento de novo');
  assert.ok(!JSON.stringify(publicados[0].payload).includes('minha mãe'), 'evento sem o texto');

  await comServidor(rotas, A, banco, semShell, async (chamar) => {
    const lista = (await chamar('GET', '/conversas')).corpo;
    assert.equal(lista.total, 1);
    assert.deepEqual([lista.dados[0].nao_lidas, lista.dados[0].estado, lista.dados[0].ultima_mensagem], [1, 'aguardando_corretor', 'Posso levar minha mãe na visita?']);
    assert.deepEqual([lista.contadores.minha_vez, lista.contadores.nao_lidas], [1, 1]);
    assert.deepEqual(chipDeStatus(lista.dados[0]), { rotulo: 'Sua vez', cor: 'alerta' });
    // Ler não grava: o GET devolve a conversa como está; marcar como lida é o PATCH .../lida (que a tela chama ao abrir).
    const d = (await chamar('GET', `/conversas/${lista.dados[0].id}`)).corpo;
    assert.deepEqual([d.mensagens[0].direcao, d.mensagens[0].autor_tipo, d.mensagens[0].canal], ['entrada', 'contato', 'portal']);
    assert.equal(d.conversa.nao_lidas, 1, 'o GET não marca como lida');
    assert.equal((await chamar('GET', '/conversas?filtro=nao_lidas')).corpo.total, 1);
    const lida = await chamar('PATCH', `/conversas/${lista.dados[0].id}/lida`);
    assert.equal(lida.status, 200);
    assert.equal(lida.corpo.conversa.nao_lidas, 0);
    assert.equal((await chamar('GET', '/conversas?filtro=nao_lidas')).corpo.total, 0);
    assert.equal((await chamar('PATCH', '/conversas/999/lida')).status, 404);
  });

  // Mensagem da conta B para um contato que é da conta A: nada é gravado (o contato não existe em B).
  await reagir.acao_cliente_recebida({ payload, conta_id: 200 } as never, ctx);
  assert.equal(banco.linhas('conversas').length, 1);
});

test('isolamento: o corretor B não vê nem escreve na conversa do corretor A', async () => {
  const banco = new BancoFalso(UNICOS);
  let cid = 0;
  await comServidor(rotas, A, banco, semShell, async (chamar) => {
    const ana = (await chamar('POST', '/contatos', { nome: 'Ana', telefone: '+5561999990001' })).corpo;
    cid = (await chamar('POST', '/conversas', { contato_id: ana.id })).corpo.conversa.id;
    await chamar('POST', `/conversas/${cid}/mensagens`, { texto: 'Segredo de A' });
  });
  await comServidor(rotas, B, banco, semShell, async (chamar) => {
    assert.equal((await chamar('GET', '/conversas')).corpo.total, 0);
    assert.equal((await chamar('GET', `/conversas/${cid}`)).status, 404);
    assert.equal((await chamar('POST', `/conversas/${cid}/mensagens`, { texto: 'invasão' })).status, 404);
    assert.equal((await chamar('POST', `/conversas/${cid}/assumir`)).status, 404);
    assert.equal((await chamar('POST', `/conversas/${cid}/devolver`)).status, 404);
    assert.equal((await chamar('PATCH', `/conversas/${cid}/lida`)).status, 404);
    assert.equal((await chamar('PATCH', `/conversas/${cid}`, { arquivada: true })).status, 404);
    // Abrir conversa com o contato de A pelo id: "não encontrado" (D-40).
    const contatoDeA = banco.linhas('contatos')[0].id;
    assert.equal((await chamar('POST', '/conversas', { contato_id: contatoDeA })).status, 422);
  });
  for (const t of ['conversas', 'mensagens']) for (const l of banco.linhas(t)) assert.equal(l.conta_id, 100, `${t} só de A`);
  const sem = { usuario: 7, conta: 300, papeis: [] } as Ator;
  await comServidor(rotas, sem, banco, semShell, async (chamar) => {
    assert.equal((await chamar('GET', '/conversas')).status, 403);
  });
});

test('regras puras: filtros, contagem, resumo e hora relativa', () => {
  const base = { estado: 'aberta', atendido_por: 'humano', agente: null, nao_lidas: 0, arquivada_em: null, ultimo_tipo: null };
  assert.equal(passaNoFiltro({ ...base, nao_lidas: 2 }, 'minha_vez'), true);
  assert.equal(passaNoFiltro({ ...base, estado: 'aguardando_corretor' }, 'minha_vez'), true);
  assert.equal(passaNoFiltro({ ...base, atendido_por: 'agente', agente: 'negociador', nao_lidas: 1 }, 'minha_vez'), false);
  assert.equal(passaNoFiltro({ ...base, atendido_por: 'agente', agente: 'negociador' }, 'negociador'), true);
  assert.equal(passaNoFiltro({ ...base, arquivada_em: 'x' }, null), false);
  assert.equal(passaNoFiltro({ ...base, arquivada_em: 'x' }, 'arquivadas'), true);
  assert.deepEqual(contarFiltros([{ ...base, nao_lidas: 1 }, { ...base, estado: 'aguardando_cliente' }, { ...base, arquivada_em: 'x' }]), { minha_vez: 1, mensageiro: 0, negociador: 0, aguardando: 1, nao_lidas: 1, arquivadas: 1 });
  assert.equal(resumoDaMensagem({ tipo: 'texto', conteudo: '  Olá,\n tudo   bem? ' }), 'Olá, tudo bem?');
  assert.equal(resumoDaMensagem({ tipo: 'selecao', dados: { titulo: 'Casas' } }), 'Seleção enviada: Casas');
  assert.equal(resumoDaMensagem({ tipo: 'link_portal' }), 'Link do portal enviado');
  const agora = Date.parse('2026-11-08T12:00:00Z');
  assert.equal(haQuanto('2026-11-08T11:48:00Z', agora), 'há 12 min');
  assert.equal(haQuanto('2026-11-08T09:00:00Z', agora), 'há 3 h');
  assert.equal(haQuanto('2026-11-07T10:00:00Z', agora), 'ontem');
  assert.equal(haQuanto('2026-10-30T10:00:00Z', agora), 'há 9 dias');
  assert.equal(haQuanto(null), '');
});

test('devolver ao Negociador: 409 com negociação conduzida pelo corretor; com a IA conduzindo, a conversa passa ao agente e o GET lê quem atende', async () => {
  const banco = new BancoFalso(UNICOS);
  await comServidor(rotas, A, banco, semShell, async (chamar) => {
    const ana = (await chamar('POST', '/contatos', { nome: 'Ana', telefone: '+5561999990001' })).corpo;
    const cid = (await chamar('POST', '/conversas', { contato_id: ana.id })).corpo.conversa.id;
    const d = banco.dados(100);
    const negocio = await d.criar('negocios', { contato_id: ana.id, titulo: 'Compra', pipeline: 'compra', etapa_id: 1, responsavel_id: 1 });
    const neg = await d.criar('negociacoes', { negocio_id: negocio.id, contato_id: ana.id, estado: 'aberta', conduzida_por: 'corretor' });
    const r = await chamar('POST', `/conversas/${cid}/devolver`);
    assert.equal(r.status, 409);
    assert.equal(r.corpo.codigo, 'NEGOCIACAO_COM_CORRETOR');
    await d.atualizar('negociacoes', neg.id, { conduzida_por: 'ia' });
    // Com a IA conduzindo, abrir a conversa já mostra o Negociador atendendo (o PATCH lida alinha a linha).
    assert.equal((await chamar('GET', `/conversas/${cid}`)).corpo.conversa.atendido_por, 'agente');
    assert.equal((await chamar('PATCH', `/conversas/${cid}/lida`)).corpo.conversa.agente, 'negociador');
    assert.equal((await chamar('POST', `/conversas/${cid}/assumir`)).corpo.conversa.atendido_por, 'humano');
    const dev = await chamar('POST', `/conversas/${cid}/devolver`);
    assert.equal(dev.status, 200);
    assert.deepEqual([dev.corpo.conversa.atendido_por, dev.corpo.conversa.agente, dev.corpo.conversa.estado], ['agente', 'negociador', 'aberta']);
    const avisos = banco.linhas('mensagens').filter((m) => m.conversa_id === cid && m.autor_tipo === 'sistema').map((m) => m.conteudo);
    assert.ok(avisos.some((t) => String(t).includes('devolveu a conversa ao Negociador')), 'aviso de sistema na conversa');
    assert.ok(evA.publicados.some((p) => p.tipo === 'conversa_devolvida'));
  });
});

test('ganchos: "Fazer agora" com texto e canal e o link do portal entram na conversa como saída', async () => {
  const banco = new BancoFalso(UNICOS);
  await comServidor(rotas, A, banco, { gerarIngressoWh: async () => ({ url: 'https://x/api/wh/portal_corretor/t1', token: 't1', ingresso_id: 1, expira_em: null }), urlApp: (s: string) => `https://x/portal_corretor${s}` }, async (chamar) => {
    const ana = (await chamar('POST', '/contatos', { nome: 'Ana', telefone: '+5561999990001' })).corpo;
    assert.equal((await chamar('POST', `/abordagens/${ana.id}/feita`, { texto: 'Oi, Ana!', canal: 'whatsapp' })).status, 201);
    assert.equal((await chamar('POST', `/abordagens/${ana.id}/feita`, {})).status, 201, 'sem texto não entra na conversa');
    const portal = await chamar('POST', `/contatos/${ana.id}/portal`);
    assert.equal(portal.status, 201, JSON.stringify(portal.corpo));
    const msgs = banco.linhas('mensagens').filter((m) => m.contato_id === ana.id).map((m) => [m.tipo, m.direcao, m.canal]);
    assert.deepEqual(msgs, [['texto', 'saida', 'wa_me'], ['link_portal', 'saida', 'wa_me']]);
    assert.equal(banco.linhas('conversas').length, 1, 'uma conversa só');
    assert.equal(evA.publicados.filter((p) => p.tipo === 'mensagem_enviada').length >= 2, true);
  });
});

test('busca por imóvel e aviso de limite da caixa', async () => {
  const banco = new BancoFalso(UNICOS);
  await comServidor(rotas, A, banco, semShell, async (chamar) => {
    const ana = (await chamar('POST', '/contatos', { nome: 'Ana', telefone: '+5561999990001' })).corpo;
    const bia = (await chamar('POST', '/contatos', { nome: 'Bia', telefone: '+5561999990002' })).corpo;
    const im = (await chamar('POST', '/imoveis', { tipo: 'casa', titulo: 'Casa do Lago', bairro: 'Lago Sul', cidade: 'Brasília', preco_c: 145000000 })).corpo;
    // Anunciável (envio só aceita imóvel ativo com autorização vigente).
    banco.linhas('imoveis').find((i) => i.id === im.id)!.situacao = 'ativo';
    await banco.dados(100).criar('autorizacoes_venda', { imovel_id: im.id, situacao: 'assinada', inicio: '2020-01-01', fim: '2099-12-31', documento_midia_id: 1 });
    await chamar('POST', '/conversas', { contato_id: ana.id });
    await chamar('POST', '/conversas', { contato_id: bia.id });
    await chamar('POST', '/envios', { contato_id: ana.id, tipo: 'imovel', imovel_id: im.id, canal: 'whatsapp' });
    const porTitulo = (await chamar('GET', '/conversas?q=lago')).corpo;
    assert.deepEqual(porTitulo.dados.map((c: { contato_nome: string }) => c.contato_nome), ['Ana'], 'acha pela casa enviada');
    const porCodigo = (await chamar('GET', `/conversas?q=${encodeURIComponent(im.codigo)}`)).corpo;
    assert.equal(porCodigo.total, 1);
    assert.equal((await chamar('GET', '/conversas?q=xyz')).corpo.total, 0);
    const antes = (await chamar('GET', '/conversas')).corpo;
    assert.equal(antes.limite_atingido, false);
    // Acima do limite: a resposta avisa, e a caixa traz as mais recentes.
    const d = banco.dados(100);
    for (let i = 0; i < antes.limite; i++) {
      const c = await d.criar('contatos', { nome: `C${i}`, telefone: `+55619${String(100000 + i)}` });
      await d.criar('conversas', { contato_id: c.id, canal: 'registro', atendido_por: 'humano', estado: 'aberta', nao_entendidas: 0, nao_lidas: 0, ultima_mensagem_em: new Date(Date.now() + (i + 1) * 1000).toISOString() });
    }
    const depois = (await chamar('GET', '/conversas')).corpo;
    assert.equal(depois.limite_atingido, true);
    assert.equal(depois.dados.length, depois.limite);
    assert.ok(!depois.dados.some((c: { contato_nome: string }) => c.contato_nome === 'Ana'), 'Ana ficou fora da janela');
    // A busca vai ao banco: acha a Ana pelo nome e pela casa enviada mesmo fora da janela, da mais recente para a mais antiga.
    const foraDaJanela = (await chamar('GET', '/conversas?q=ana')).corpo;
    assert.deepEqual(foraDaJanela.dados.map((c: { contato_nome: string }) => c.contato_nome), ['Ana']);
    assert.equal((await chamar('GET', '/conversas?q=lago')).corpo.total, 1);
    const ordem = (await chamar('GET', '/conversas?q=C1')).corpo.dados.map((c: { ultima_mensagem_em: string }) => c.ultima_mensagem_em);
    assert.deepEqual(ordem, [...ordem].sort().reverse(), 'ordenada da mais recente para a mais antiga');
  });
});

test('corrida do ler-e-criar: a segunda chamada que bate no único devolve a conversa que entrou primeiro', async () => {
  const { conversaDoContato } = await import('../backend/conversas');
  const banco = new BancoFalso(UNICOS);
  const d = banco.dados(100);
  const ana = await d.criar('contatos', { nome: 'Ana', telefone: '+5561999990001' });
  // Leitura "atrasada": a primeira `listar` não vê a conversa que outro request acabou de criar.
  let leituras = 0;
  const atrasado = new Proxy(d, { get: (alvo, k) => (k === 'listar' ? async (...a: unknown[]) => (leituras++ === 0 ? { dados: [], total: 0 } : (alvo as any).listar(...a)) : (alvo as any)[k]) });
  const primeira = await conversaDoContato(d as any, Number(ana.id), 'registro');
  const segunda = await conversaDoContato(atrasado as any, Number(ana.id), 'registro');
  assert.equal(segunda.id, primeira.id);
  assert.equal(banco.linhas('conversas').length, 1);
});

test('Nova conversa (#182): o rótulo do cliente leva nome e telefone formatado, mas o valor enviado é o id do contato', async () => {
  const fonte = readFileSync(resolve(process.cwd(), 'frontend/telas/conversas.ts'), 'utf8');
  const m = fonte.match(/buscaDoGesto\(vida, '\/contatos', (\(c\) => `[^\n]*`)\)/);
  assert.ok(m, 'a busca do formulário Nova conversa continua usando buscaDoGesto em /contatos');
  assert.match(fonte, /salvar: \(v\) => enviar\('POST', '\/conversas', \{ contato_id: v\.contato_id \}\)/, 'o que se envia é o valor do campo, o id');
  const rotulo = new Function('formatarTelefone', `return ${m![1]}`)((v: string) => `fmt(${v})`);
  const g = globalThis as any;
  g.localStorage = { getItem: () => null, setItem: () => {} };
  g.urbiVerso = {
    contexto: () => ({}),
    api: async () => ({ dados: [{ id: 42, nome: 'Ana', telefone: '61999990001' }, { id: 43, nome: 'Bia', telefone: null }] }),
  };
  const achados = await buscaDoGesto(gesto(), '/contatos', rotulo)('a', new AbortController().signal);
  assert.deepEqual(achados, [{ valor: 42, rotulo: 'Ana · fmt(61999990001)' }, { valor: 43, rotulo: 'Bia' }]);
});
