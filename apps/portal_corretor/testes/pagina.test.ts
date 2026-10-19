import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rotas, rotasPublicas, webhooks, reagir } from '../backend/rotas';
import { limparLimites } from '../backend/publico';
import { blocosPadrao, imovelPublico, sugerirEndereco, validarLead, validarPagina } from '../comum/pagina';
import { BancoFalso, comServidor, type Ator } from './apoio';

const UNICOS = { contatos: ['telefone'], imoveis: ['codigo'], visitas: ['atividade_id'], etapas_funil: ['pipeline+nome'], origens: ['canal+campanha'], vitrine_publica: ['tipo+chave'], paginas_corretor: ['chave'] };
const arquivos = { url: async (arquivo: number) => `/arquivo/${arquivo}` };
const A: Ator = { usuario: 1, conta: 100, papeis: ['corretor'], extras: { arquivos } };
const B: Ator = { usuario: 2, conta: 200, papeis: ['corretor'], extras: { arquivos } };
const VISITANTE: Ator = { usuario: 0, conta: null, papeis: [], extras: { arquivos } };
const HOJE = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
const dia = (delta: number) => new Date(Date.now() + delta * 86400e3).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });

let ingressos = 0;
const revogados: number[] = [];
const shell = {
  revogarIngressoWh: async ({ ingresso_id }: { ingresso_id: number }) => {
    revogados.push(ingresso_id);
    return { revogado: true };
  },
  gerarIngressoWh: async ({ webhook, contexto }: { webhook: string; contexto: { conta_id: number } }) => {
    ingressos++;
    return { url: `https://corretor.exemplo/api/wh/portal_corretor/wh_${webhook}_${contexto.conta_id}`, ingresso_id: ingressos, token: 'wh_x', expira_em: null };
  },
};

/** Imóvel anunciado, com foto pública, documento interno e autorização vigente. */
async function imovelAnunciado(chamar: (m: string, c: string, b?: unknown) => Promise<{ status: number; corpo: any }>, titulo: string, telefone: string) {
  const im = (await chamar('POST', '/imoveis', { tipo: 'apartamento', cidade: 'Brasília', bairro: 'Sudoeste', titulo, endereco: 'SQSW 300 Bloco A apto 101', endereco_publico: 'bairro' })).corpo;
  await chamar('PATCH', `/imoveis/${im.id}`, { preco: 850000, quartos: 3 });
  const dono = (await chamar('POST', '/contatos', { nome: 'Dona Lúcia Proprietária', telefone })).corpo;
  const aut = (await chamar('POST', '/autorizacoes', { imovel_id: im.id, proprietario_id: dono.id, inicio: HOJE, fim: dia(90), comissao_pct: '5', preco_autorizado: '850.000' })).corpo;
  const foto = (await chamar('POST', `/imoveis/${im.id}/midias`, { upload_id: 501, tipo: 'foto', legenda: 'Sala' })).corpo;
  const doc = (await chamar('POST', `/imoveis/${im.id}/midias`, { upload_id: 502, tipo: 'documento' })).corpo;
  await chamar('PATCH', `/autorizacoes/${aut.id}`, { documento_midia_id: doc.id, situacao: 'assinada' });
  const r = await chamar('PATCH', `/imoveis/${im.id}`, { situacao: 'ativo', publicado_pagina: true });
  assert.equal(r.status, 200, JSON.stringify(r.corpo));
  return { im, foto, doc, dono };
}

function resposta() {
  const r: { status: number; corpo: any; res: any } = { status: 200, corpo: null, res: null };
  r.res = {
    status(s: number) {
      r.status = s;
      return r.res;
    },
    json(c: unknown) {
      r.corpo = c;
      return r.res;
    },
  };
  return r;
}

function chamarWebhook(nome: keyof typeof webhooks, conta: number | null, corpo: unknown, ip = '10.0.0.1') {
  const publicados: { tipo: string; payload: any; opcoes: any }[] = [];
  const r = resposta();
  const req: any = {
    body: corpo,
    headers: { 'x-forwarded-for': ip },
    ip,
    wh: { webhook: nome, modo: 'recorrente', ingresso_id: 1, contexto: conta ? { conta_id: conta } : null, contador_usos: 0, criado_por: 1 },
    eventos: { publicar: async (tipo: string, payload: any, opcoes: any) => publicados.push({ tipo, payload, opcoes }) },
  };
  return webhooks[nome](req, r.res).then(() => ({ ...r, publicados }));
}

test('regras puras da página: endereço, blocos, o que vai a público e o formulário', () => {
  assert.equal(sugerirEndereco('João da Silva Néto'), 'joao-da-silva-neto');
  assert.equal(sugerirEndereco('Zé'), 'corretor-ze');
  const v = validarPagina({ endereco: 'joao-silva', tema: 'mata', nome_exibicao: 'João', blocos: [{ tipo: 'sobre', ativo: true, texto: 'Oi' }, { tipo: 'contato', instagram: '@joao.corretor' }] });
  assert.ok(v.ok);
  if (v.ok) {
    assert.equal(v.dados.blocos.length, 7, 'os blocos que faltam entram desligados');
    assert.deepEqual(v.dados.blocos.slice(0, 2).map((b) => b.tipo), ['sobre', 'contato'], 'a ordem é a do corretor');
    assert.equal(v.dados.blocos[1].instagram, 'joao.corretor');
  }
  assert.equal(validarPagina({ endereco: '-ruim', tema: 'mata', nome_exibicao: 'x', blocos: blocosPadrao() }).ok, false);
  assert.equal(validarPagina({ endereco: 'bom-nome', tema: 'neon', nome_exibicao: 'x', blocos: blocosPadrao() }).ok, false);
  assert.equal(validarPagina({ endereco: 'bom-nome', tema: 'mata', nome_exibicao: 'x', blocos: [{ tipo: 'sobre' }, { tipo: 'sobre' }] }).ok, false, 'bloco repetido');
  const pub = imovelPublico(
    { codigo: 'IM-0001', tipo: 'casa', proprietario_id: 9, endereco: 'Rua X, 10', endereco_publico: 'bairro', bairro: 'Lago Sul', cidade: 'Brasília', preco_c: 100 },
    [{ tipo: 'foto', publica: true, arquivo: 1, ordem: 2 }, { tipo: 'foto', publica: false, arquivo: 2, ordem: 0 }, { tipo: 'documento', publica: false, arquivo: 3 }, { tipo: 'foto', publica: true, arquivo: 4, ordem: 1 }],
  );
  assert.deepEqual(pub.fotos.map((f) => f.arquivo), [4, 1], 'só fotos públicas, na ordem');
  assert.equal(pub.endereco, null, 'endereço só quando liberado como completo');
  assert.ok(!('proprietario_id' in pub));
  assert.equal(imovelPublico({ codigo: 'X', endereco_publico: 'regiao', bairro: 'Lago Sul', cidade: 'Brasília' }, []).bairro, null);
  assert.equal(validarLead({ nome: 'Ana', telefone: '61 99999-1111' }).ok, false, 'sem consentimento');
  assert.equal(validarLead({ nome: 'Ana', consentimento: true }).ok, false, 'sem telefone nem e-mail');
  const lead = validarLead({ nome: 'Ana', telefone: '(61) 99999-1111', consentimento: true });
  assert.ok(lead.ok && lead.dados.telefone === '+5561999991111');
});

test('publicar a página põe na vitrine só o publicável, sem dado pessoal; outra conta não alcança', async () => {
  const banco = new BancoFalso(UNICOS);
  let ids: { im: any; foto: any; doc: any } = {} as any;
  await comServidor(rotas, A, banco, shell, async (chamar) => {
    ids = await imovelAnunciado(chamar, 'Apto com vista', '61911110001');
    const rascunho = (await chamar('POST', '/imoveis', { tipo: 'casa', cidade: 'Brasília', titulo: 'Rascunho secreto' })).corpo;
    assert.ok(rascunho.id);
    const inicial = (await chamar('GET', '/pagina')).corpo;
    assert.equal(inicial.salva, false);
    assert.equal(inicial.pagina.endereco, 'usuario-1');
    assert.equal((await chamar('POST', '/pagina/publicar')).corpo.codigo, 'PAGINA_NAO_SALVA');
    // Nada vai à vitrine antes de a página estar no ar.
    assert.equal(banco.linhas('vitrine_publica').length, 0);
    const salva = await chamar('PUT', '/pagina', { ...inicial.pagina, endereco: 'joao-corretor', nome_exibicao: 'João Corretor' });
    assert.equal(salva.status, 200);
    const pub = await chamar('POST', '/pagina/publicar');
    assert.equal(pub.status, 200);
    assert.equal(pub.corpo.imoveis_publicados, 1);
    assert.equal(pub.corpo.url, 'https://corretor.exemplo/portal_corretor/p?c=joao-corretor');
  });
  const vitrine = banco.linhas('vitrine_publica');
  assert.deepEqual(vitrine.map((l) => l.tipo).sort(), ['imovel', 'pagina']);
  const texto = JSON.stringify(vitrine);
  for (const proibido of ['Lúcia', '61911110001', 'SQSW 300', 'Rascunho secreto', 'comissao', 'proprietario', 'autoriza']) assert.ok(!texto.includes(proibido), `vitrine sem ${proibido}`);
  const anuncio = vitrine.find((l) => l.tipo === 'imovel')!.dados;
  assert.deepEqual([anuncio.bairro, anuncio.endereco], ['Sudoeste', null], 'bairro sim, endereço não');
  assert.deepEqual(anuncio.fotos.map((f: any) => f.arquivo), [501], 'documento (arquivo 502) não vai');
  assert.ok(vitrine.every((l: any) => l.conta_id === undefined && l.conta === 100), 'vitrine sem carimbo de conta, com a conta explícita');

  // Visitante anônimo lê a página e a ficha; endereço desconhecido é 404.
  await comServidor(rotasPublicas, VISITANTE, banco, {}, async (chamar) => {
    const p = await chamar('GET', '/vitrine/pagina?c=joao-corretor');
    assert.equal(p.status, 200);
    assert.equal(p.corpo.pagina.nome, 'João Corretor');
    assert.equal(p.corpo.imoveis.length, 1);
    assert.equal(p.corpo.imoveis[0].capa, '/arquivo/501');
    const f = await chamar('GET', `/vitrine/imovel?c=joao-corretor&i=${ids.im.codigo}`);
    assert.equal(f.status, 200);
    assert.deepEqual(f.corpo.imovel.fotos, [{ url: '/arquivo/501', legenda: 'Sala' }]);
    assert.equal(f.corpo.imovel.vigente_ate, undefined, 'dado interno não sai');
    assert.equal((await chamar('GET', '/vitrine/pagina?c=nao-existe')).status, 404);
    assert.equal((await chamar('GET', `/vitrine/imovel?c=joao-corretor&i=IM-9999`)).status, 404);
  });

  // Outra conta não usa o endereço de A, e as mudanças dela não tocam a vitrine de A.
  let codigoB = '';
  await comServidor(rotas, B, banco, shell, async (chamar) => {
    const p = (await chamar('GET', '/pagina')).corpo.pagina;
    assert.equal((await chamar('PUT', '/pagina', { ...p, endereco: 'joao-corretor' })).corpo.codigo, 'ENDERECO_EM_USO');
    assert.equal((await chamar('PUT', '/pagina', { ...p, endereco: 'maria-corretora' })).status, 200);
    // B anuncia um imóvel com o mesmo código do de A (o código é por conta).
    codigoB = (await imovelAnunciado(chamar, 'Casa da Maria', '61922220001')).im.codigo;
    assert.equal(codigoB, ids.im.codigo);
    await chamar('POST', '/pagina/publicar');
    // B não alcança o imóvel de A pelas rotas da conta: "não encontrado".
    assert.equal((await chamar('GET', `/imoveis/${ids.im.id}`)).status, 404);
    assert.equal((await chamar('PATCH', `/imoveis/${ids.im.id}`, { publicado_pagina: false })).status, 404);
  });
  await comServidor(rotasPublicas, VISITANTE, banco, {}, async (chamar) => {
    const pb = (await chamar('GET', '/vitrine/pagina?c=maria-corretora')).corpo;
    assert.deepEqual(pb.imoveis.map((i: any) => i.titulo), ['Casa da Maria'], 'a página de B lista só os imóveis de B');
    assert.equal((await chamar('GET', `/vitrine/imovel?c=maria-corretora&i=${codigoB}`)).corpo.imovel.titulo, 'Casa da Maria');
    assert.equal((await chamar('GET', `/vitrine/imovel?c=joao-corretor&i=${codigoB}`)).corpo.imovel.titulo, 'Apto com vista', 'mesmo código, conta de A');
  });
  await comServidor(rotas, B, banco, shell, async (chamar) => {
    await chamar('POST', '/pagina/despublicar');
  });
  assert.equal(banco.linhas('vitrine_publica').filter((l) => l.conta === 200).length, 0);
  assert.equal(banco.linhas('vitrine_publica').filter((l) => l.conta === 100).length, 2, 'a vitrine de A ficou intacta');

  // Mudanças no anúncio de A refletem na hora: foto privada sai, imóvel tirado da página sai.
  await comServidor(rotas, A, banco, shell, async (chamar) => {
    await chamar('PATCH', `/imoveis/${ids.im.id}/midias/${ids.foto.id}`, { publica: false });
    const linha = banco.linhas('vitrine_publica').find((l) => l.tipo === 'imovel')!;
    assert.equal(linha.dados.fotos.length, 0);
    await chamar('PATCH', `/imoveis/${ids.im.id}`, { publicado_pagina: false });
    assert.equal(banco.linhas('vitrine_publica').filter((l) => l.tipo === 'imovel').length, 0);
    await chamar('PATCH', `/imoveis/${ids.im.id}`, { publicado_pagina: true });
    assert.equal(banco.linhas('vitrine_publica').filter((l) => l.tipo === 'imovel').length, 1);
    // Trocar o endereço leva a página junto; tirar do ar apaga a página e os imóveis.
    const p = (await chamar('GET', '/pagina')).corpo.pagina;
    await chamar('PUT', '/pagina', { ...p, endereco: 'joao-imoveis' });
    assert.deepEqual(banco.linhas('vitrine_publica').filter((l) => l.tipo === 'pagina').map((l) => l.chave).sort(), ['joao-imoveis']);
    const pagina = banco.linhas('paginas_corretor').find((l) => l.conta_id === 100)!;
    const ingressosDeA = [pagina.ingresso_formulario_id, pagina.ingresso_clique_id];
    await chamar('POST', '/pagina/despublicar');
    assert.equal(banco.linhas('vitrine_publica').filter((l) => l.conta === 100).length, 0);
    assert.ok(ingressosDeA.every((i) => revogados.includes(i)), 'fora do ar, formulário e cliques são revogados');
    assert.equal(banco.linhas('paginas_corretor').find((l) => l.conta_id === 100)!.url_formulario, null);
  });
});

test('autorização vencida tira o anúncio da página pública mesmo sem nova publicação', async () => {
  const banco = new BancoFalso(UNICOS);
  let codigo = '';
  await comServidor(rotas, A, banco, shell, async (chamar) => {
    codigo = (await imovelAnunciado(chamar, 'Casa', '61911110002')).im.codigo;
    const p = (await chamar('GET', '/pagina')).corpo.pagina;
    await chamar('PUT', '/pagina', p);
    await chamar('POST', '/pagina/publicar');
  });
  banco.linhas('vitrine_publica').find((l) => l.tipo === 'imovel')!.dados.vigente_ate = dia(-1);
  await comServidor(rotasPublicas, VISITANTE, banco, {}, async (chamar) => {
    assert.equal((await chamar('GET', '/vitrine/pagina?c=usuario-1')).corpo.imoveis.length, 0);
    assert.equal((await chamar('GET', `/vitrine/imovel?c=usuario-1&i=${codigo}`)).status, 404);
  });
});

test('formulário: valida, barra robô e excesso, e publica o lead só na conta do ingresso', async () => {
  limparLimites();
  const semConta = await chamarWebhook('formulario_lead', null, { nome: 'Ana', telefone: '61999991111', consentimento: true });
  assert.equal(semConta.status, 404);
  const robo = await chamarWebhook('formulario_lead', 100, { nome: 'Bot', telefone: '61999991111', consentimento: true, site: 'http://spam' });
  assert.deepEqual([robo.status, robo.publicados.length], [200, 0], 'honeypot: finge sucesso e não grava');
  const invalido = await chamarWebhook('formulario_lead', 100, { nome: 'Ana', telefone: '61999991111' });
  assert.equal(invalido.status, 422);
  const ok = await chamarWebhook('formulario_lead', 100, { nome: 'Ana Souza', telefone: '(61) 99999-1111', mensagem: 'Quero visitar', imovel_codigo: 'IM-0001', consentimento: true });
  assert.equal(ok.status, 200);
  assert.equal(ok.publicados.length, 1);
  assert.equal(ok.publicados[0].tipo, 'lead_recebido');
  assert.deepEqual(ok.publicados[0].opcoes, { conta_id: 100 });
  assert.deepEqual(Object.keys(ok.publicados[0].payload).sort(), ['email', 'imovel_codigo', 'mensagem', 'nome', 'origem', 'responsavel_id', 'telefone']);
  assert.equal(ok.publicados[0].payload.origem, 'ficha_imovel');
  // Conta no corpo não vale nada: a conta é sempre a do ingresso.
  const forjado = await chamarWebhook('formulario_lead', 100, { nome: 'Eva', email: 'eva@exemplo.com', consentimento: true, conta_id: 200 }, '10.0.0.9');
  assert.deepEqual([forjado.status, forjado.publicados[0].opcoes.conta_id, 'conta_id' in forjado.publicados[0].payload], [200, 100, false]);
  // Limite de 3 por minuto por origem; a tentativa inválida também conta, o robô não.
  assert.equal((await chamarWebhook('formulario_lead', 100, { nome: 'Ana', telefone: '61999991111', consentimento: true })).status, 200);
  const excesso = await chamarWebhook('formulario_lead', 100, { nome: 'Ana', telefone: '61999991111', consentimento: true });
  assert.equal(excesso.status, 429);
  assert.equal((await chamarWebhook('formulario_lead', 100, { nome: 'Ana', telefone: '61999991111', consentimento: true }, '10.0.0.2')).status, 200, 'outra origem segue');
});

test('lead vira contato, negócio novo, consentimento e linha do tempo na conta certa; repetido não duplica', async () => {
  const banco = new BancoFalso(UNICOS);
  // Conta 200 com contato de mesmo telefone, negócio aberto, origem "pagina" e corretor ativo:
  // nada disso pode ser lido nem tocado pelo lead da conta 100 (a leitura SISTEMA vê todas as contas).
  await comServidor(rotas, B, banco, {}, async (chamar) => {
    const c = (await chamar('POST', '/contatos', { nome: 'Cliente de B', telefone: '61999991111', origem_canal: 'pagina' })).corpo;
    await chamar('POST', '/negocios', { contato_id: c.id });
  });
  banco.linhas('perfis_corretor').push({ id: 9001, conta_id: 200, usuario_id: 2, ativo: true } as any, { id: 9002, conta_id: 100, usuario_id: 1, ativo: true } as any);
  const ctx = banco.ctxSistema([{ id: 100, nome: 'A' }, { id: 200, nome: 'B' }]);
  // `responsavel_id` que não é corretor da conta: vale o corretor ativo da própria conta (1), nunca o de B (2).
  const evento = { payload: { nome: 'Ana Souza', telefone: '+5561999991111', email: null, mensagem: 'Quero visitar', imovel_codigo: null, origem: 'pagina', responsavel_id: 2 }, conta_id: 100 };
  const negociosB = banco.linhas('negocios').filter((n) => n.conta_id === 200).length;
  const origemB = banco.linhas('origens').find((o) => o.conta_id === 200 && o.canal === 'pagina')!;
  await reagir.lead_recebido(evento, ctx);
  const deA = banco.linhas('contatos').filter((c) => c.conta_id === 100);
  assert.equal(deA.length, 1);
  assert.deepEqual([deA[0].nome, deA[0].responsavel_id, !!deA[0].consentimento_em], ['Ana Souza', 1, true]);
  const negocio = banco.linhas('negocios').find((n) => n.conta_id === 100)!;
  const etapa = banco.linhas('etapas_funil').find((e) => e.id === negocio.etapa_id)!;
  assert.deepEqual([etapa.nome, etapa.conta_id, negocio.marco_max], ['Novo', 100, 'novo']);
  assert.equal(banco.linhas('consentimentos').filter((c) => c.conta_id === 100).length, 1);
  assert.ok(banco.linhas('linha_do_tempo').some((l) => l.conta_id === 100 && l.tipo === 'lead.recebido'));
  assert.equal(banco.linhas('origens').find((o) => o.conta_id === 100)!.canal, 'pagina');
  assert.notEqual(deA[0].origem_id, origemB.id, 'origem própria da conta, não a de B');
  assert.notEqual(negocio.id, banco.linhas('negocios').find((n) => n.conta_id === 200)!.id, 'negócio novo em A, não o aberto de B');
  // Reenvio igual em seguida: nada novo.
  await reagir.lead_recebido(evento, ctx);
  assert.equal(banco.linhas('consentimentos').filter((c) => c.conta_id === 100).length, 1);
  assert.equal(banco.linhas('negocios').filter((n) => n.conta_id === 100).length, 1);
  // Nova mensagem do mesmo telefone: une ao contato e reaproveita o negócio aberto.
  await reagir.lead_recebido({ ...evento, payload: { ...evento.payload, mensagem: 'Outra dúvida' } }, ctx);
  assert.equal(banco.linhas('contatos').filter((c) => c.conta_id === 100).length, 1);
  assert.equal(banco.linhas('negocios').filter((n) => n.conta_id === 100).length, 1);
  // A conta 200 ficou como estava.
  const deB = banco.linhas('contatos').filter((c) => c.conta_id === 200);
  assert.deepEqual([deB.length, deB[0].nome, !!deB[0].consentimento_em], [1, 'Cliente de B', false]);
  assert.equal(banco.linhas('negocios').filter((n) => n.conta_id === 200).length, negociosB);
  // Sem telefone, o mesmo e-mail une ao contato existente.
  banco.linhas('contatos').find((c) => c.conta_id === 100)!.email = 'ana@exemplo.com';
  await reagir.lead_recebido({ ...evento, payload: { ...evento.payload, telefone: null, email: 'ana@exemplo.com', mensagem: 'de novo pelo e-mail' } }, ctx);
  assert.equal(banco.linhas('contatos').filter((c) => c.conta_id === 100).length, 1);
  // Conta inativa: o comConta recusa e nada é gravado.
  const antes = banco.linhas('linha_do_tempo').length;
  await assert.rejects(reagir.lead_recebido({ ...evento, conta_id: 300 }, ctx), { codigo: 'CONTA_INVALIDA' });
  assert.equal(banco.linhas('linha_do_tempo').length, antes);
  assert.equal(banco.linhas('contatos').filter((c) => c.conta_id === 300).length, 0);
});

test('link rastreado: envio de imóvel publicado leva o link; o clique conta no envio da conta', async () => {
  limparLimites();
  const banco = new BancoFalso(UNICOS);
  let codigo = '';
  await comServidor(rotas, A, banco, shell, async (chamar) => {
    const { im } = await imovelAnunciado(chamar, 'Apto com vista', '61911110003');
    const cliente = (await chamar('POST', '/contatos', { nome: 'Rita Souza', telefone: '61988881111' })).corpo;
    // Sem página no ar, a mensagem sai sem link.
    const antes = await chamar('POST', '/envios', { contato_id: cliente.id, tipo: 'imovel', imovel_id: im.id });
    assert.equal(antes.corpo.link, null);
    const p = (await chamar('GET', '/pagina')).corpo.pagina;
    await chamar('PUT', '/pagina', p);
    await chamar('POST', '/pagina/publicar');
    const r = await chamar('POST', '/envios', { contato_id: cliente.id, tipo: 'imovel', imovel_id: im.id });
    assert.match(r.corpo.link, /^https:\/\/corretor\.exemplo\/portal_corretor\/l\?c=/);
    assert.ok(r.corpo.mensagem.includes(r.corpo.link));
    codigo = r.corpo.envio.link_rastreado;
  });
  await comServidor(rotasPublicas, VISITANTE, banco, {}, async (chamar) => {
    const l = await chamar('GET', `/vitrine/link?c=${codigo}`);
    assert.equal(l.status, 200);
    assert.match(l.corpo.destino, /^\/portal_corretor\/p\?c=usuario-1&i=IM-/);
    assert.match(l.corpo.url_clique, /wh_clique_link_100$/);
    assert.equal((await chamar('GET', '/vitrine/link?c=naoexiste')).status, 404);
  });
  const clique = await chamarWebhook('clique_link', 100, { codigo });
  assert.deepEqual(clique.publicados.map((p) => [p.tipo, p.opcoes.conta_id]), [['link_clicado', 100]]);
  const ctx = banco.ctxSistema([{ id: 100, nome: 'A' }, { id: 200, nome: 'B' }]);
  await reagir.link_clicado({ payload: { codigo }, conta_id: 100 }, ctx);
  await reagir.link_clicado({ payload: { codigo }, conta_id: 100 }, ctx);
  // Código de A chegando com a conta 200 não toca o envio de A.
  await reagir.link_clicado({ payload: { codigo }, conta_id: 200 }, ctx);
  const envio = banco.linhas('envios').find((e) => e.link_rastreado === codigo)!;
  assert.equal(envio.cliques, 2);
  assert.ok(envio.primeiro_clique_em);
  assert.equal(banco.linhas('linha_do_tempo').filter((l) => l.tipo === 'envio.aberto').length, 1, 'só o primeiro clique entra na linha do tempo');
});

test('instância sem URL pública: o envio sai sem link (endereço relativo não abre no WhatsApp)', async () => {
  const banco = new BancoFalso(UNICOS);
  const semUrl = { ...shell, gerarIngressoWh: async (o: { webhook: string }) => ({ ...(await shell.gerarIngressoWh({ ...o, contexto: { conta_id: 100 } })), url: `/api/wh/portal_corretor/wh_${o.webhook}` }) };
  await comServidor(rotas, A, banco, semUrl, async (chamar) => {
    const { im } = await imovelAnunciado(chamar, 'Apto', '61911110009');
    const cliente = (await chamar('POST', '/contatos', { nome: 'Rui', telefone: '61988882222' })).corpo;
    const p = (await chamar('GET', '/pagina')).corpo.pagina;
    await chamar('PUT', '/pagina', p);
    await chamar('POST', '/pagina/publicar');
    const r = await chamar('POST', '/envios', { contato_id: cliente.id, tipo: 'imovel', imovel_id: im.id });
    assert.equal(r.corpo.link, null);
    assert.ok(!r.corpo.mensagem.includes('/portal_corretor/l'));
  });
});

test('quem não é corretor não mexe na página', async () => {
  const banco = new BancoFalso(UNICOS);
  await comServidor(rotas, { usuario: 9, conta: null, papeis: ['operacao'] }, banco, shell, async (chamar) => {
    assert.equal((await chamar('GET', '/pagina')).status, 403);
    assert.equal((await chamar('POST', '/pagina/publicar')).status, 403);
  });
  await comServidor(rotas, { usuario: 3, conta: null, papeis: ['corretor'] }, banco, shell, async (chamar) => {
    assert.equal((await chamar('GET', '/pagina')).status, 409, 'corretor sem conta');
  });
});
