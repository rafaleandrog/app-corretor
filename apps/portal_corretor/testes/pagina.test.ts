import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rotas, rotasPublicas, webhooks, reagir } from '../backend/rotas';
import { createHash } from 'node:crypto';
import { hashDaOrigem, limparLimites } from '../backend/publico';
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
    return { url: `https://corretor.exemplo/api/wh/portal_corretor/wh_${webhook}_${contexto.conta_id}_${ingressos}`, ingresso_id: ingressos, token: 'wh_x', expira_em: null };
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

function chamarWebhook(nome: keyof typeof webhooks, conta: number | null, corpo: unknown, ip = '10.0.0.1', segredo?: string) {
  const publicados: { tipo: string; payload: any; opcoes: any }[] = [];
  const r = resposta();
  const req: any = {
    body: corpo,
    headers: { 'x-forwarded-for': ip },
    ip,
    wh: { webhook: nome, modo: 'recorrente', ingresso_id: 1, contexto: conta ? { conta_id: conta } : null, contador_usos: 0, criado_por: 1 },
    eventos: { publicar: async (tipo: string, payload: any, opcoes: any) => publicados.push({ tipo, payload, opcoes }) },
    parametros: segredo === undefined ? { obter: async () => null } : { obter: async (slug: string) => (slug === 'ip_hash_segredo' ? segredo : null) },
  };
  return webhooks[nome](req, r.res).then(() => ({ ...r, publicados }));
}

test('regras puras da página: endereço, blocos, o que vai a público e o formulário', () => {
  assert.equal(sugerirEndereco('João da Silva Néto'), 'joao-da-silva-neto');
  assert.equal(sugerirEndereco('Zé'), 'corretor-ze');
  const v = validarPagina({ endereco: 'joao-silva', nome_exibicao: 'João', blocos: [{ tipo: 'sobre', ativo: true, texto: 'Oi' }, { tipo: 'contato', instagram: '@joao.corretor' }] });
  assert.ok(v.ok);
  if (v.ok) {
    assert.equal(v.dados.blocos.length, 7, 'os blocos que faltam entram desligados');
    assert.deepEqual(v.dados.blocos.slice(0, 2).map((b) => b.tipo), ['sobre', 'contato'], 'a ordem é a do corretor');
    assert.equal(v.dados.blocos[1].instagram, 'joao.corretor');
  }
  assert.equal(validarPagina({ endereco: '-ruim', nome_exibicao: 'x', blocos: blocosPadrao() }).ok, false);
  const comTema = validarPagina({ endereco: 'bom-nome', tema: 'neon', nome_exibicao: 'x', blocos: blocosPadrao() });
  assert.ok(comTema.ok && !('tema' in comTema.dados), 'a cor é da marca (D-85): tema que ainda chegue é ignorado');
  assert.equal(validarPagina({ endereco: 'bom-nome', nome_exibicao: 'x', blocos: [{ tipo: 'sobre' }, { tipo: 'sobre' }] }).ok, false, 'bloco repetido');
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
  assert.deepEqual(Object.keys(ok.publicados[0].payload).sort(), ['email', 'imovel_codigo', 'ip_hash', 'mensagem', 'nome', 'origem', 'responsavel_id', 'telefone']);
  assert.equal(ok.publicados[0].payload.ip_hash, null, 'sem o segredo configurado, a origem não é gravada (o formulário segue)');
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
  // D-129: o consentimento do formulário é só declarado; o contato fica sem consentimento até o corretor confirmar.
  assert.deepEqual([deA[0].nome, deA[0].responsavel_id, !!deA[0].consentimento_em], ['Ana Souza', 1, false]);
  const negocio = banco.linhas('negocios').find((n) => n.conta_id === 100)!;
  const etapa = banco.linhas('etapas_funil').find((e) => e.id === negocio.etapa_id)!;
  assert.deepEqual([etapa.nome, etapa.conta_id, negocio.marco_max], ['Novo', 100, 'novo']);
  assert.deepEqual(banco.linhas('consentimentos').filter((c) => c.conta_id === 100).map((c) => [c.declarado, c.texto_versao]), [[true, 'formulario-v1']]);
  assert.ok(banco.linhas('linha_do_tempo').some((l) => l.conta_id === 100 && l.tipo === 'lead.recebido'));
  assert.equal(banco.linhas('origens').find((o) => o.conta_id === 100)!.canal, 'pagina');
  assert.notEqual(deA[0].origem_id, origemB.id, 'origem própria da conta, não a de B');
  assert.notEqual(negocio.id, banco.linhas('negocios').find((n) => n.conta_id === 200)!.id, 'negócio novo em A, não o aberto de B');
  // Reenvio igual em seguida: nada novo.
  await reagir.lead_recebido(evento, ctx);
  assert.equal(banco.linhas('consentimentos').filter((c) => c.conta_id === 100).length, 1);
  assert.equal(banco.linhas('negocios').filter((n) => n.conta_id === 100).length, 1);
  // Nova mensagem do mesmo telefone: une ao contato, sem negócio novo (D-129: vira pedido e tarefa).
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
  let urlAntiga = '';
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
    assert.match(l.corpo.url_clique, /wh_clique_link_100_\d+$/);
    urlAntiga = l.corpo.url_clique;
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
  // Tirar do ar e publicar de novo: o link antigo volta a abrir e conta no endereço novo.
  await comServidor(rotas, A, banco, shell, async (chamar) => {
    await chamar('POST', '/pagina/despublicar');
  });
  await comServidor(rotasPublicas, VISITANTE, banco, {}, async (chamar) => {
    const fora = (await chamar('GET', `/vitrine/link?c=${codigo}`)).corpo;
    assert.deepEqual([fora.destino, fora.url_clique], [null, null], 'fora do ar: indisponível e nada a contar');
  });
  await comServidor(rotas, A, banco, shell, async (chamar) => {
    await chamar('POST', '/pagina/publicar');
  });
  const novaUrl = banco.linhas('paginas_corretor').find((l) => l.conta_id === 100)!.url_clique;
  await comServidor(rotasPublicas, VISITANTE, banco, {}, async (chamar) => {
    const volta = (await chamar('GET', `/vitrine/link?c=${codigo}`)).corpo;
    assert.match(volta.destino, /^\/portal_corretor\/p\?c=usuario-1&i=IM-/);
    assert.equal(volta.url_clique, novaUrl);
    assert.notEqual(novaUrl, urlAntiga, 'o endereço revogado não é mais usado');
  });
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

test('quem atende 2 contas publica, edita e despublica a vitrine na conta ativa (tabela não segregada sob o escopo de conta)', async () => {
  const banco = new BancoFalso(UNICOS);
  const atendente: Ator = { usuario: 8, conta: 100, contas: [100, 200], papeis: ['corretor'], extras: { arquivos } };
  await comServidor(rotas, atendente, banco, shell, async (chamar) => {
    const { im, foto } = await imovelAnunciado(chamar, 'Apto do atendente', '61933330001');
    const inicial = (await chamar('GET', '/pagina')).corpo.pagina;
    assert.equal((await chamar('PUT', '/pagina', { ...inicial, endereco: 'atendente', nome_exibicao: 'Atendente' })).status, 200);
    assert.equal((await chamar('POST', '/pagina/publicar')).status, 200);
    const noAr = (tipo: string) => banco.linhas('vitrine_publica').filter((l) => l.conta === 100 && l.tipo === tipo);
    assert.equal(noAr('pagina').length, 1);
    assert.equal(noAr('imovel').length, 1);
    // Editar o anúncio atualiza a linha pública por id, e tirar da página apaga (os dois verbos por id).
    assert.equal(noAr('imovel')[0].dados.fotos.length, 1, 'a foto pública está na vitrine antes da edição');
    assert.equal((await chamar('PATCH', `/imoveis/${im.id}/midias/${foto.id}`, { publica: false })).status, 200);
    assert.equal(noAr('imovel')[0].dados.fotos.length, 0, 'a edição chegou à vitrine');
    assert.equal((await chamar('PATCH', `/imoveis/${im.id}`, { publicado_pagina: false })).status, 200);
    assert.equal(noAr('imovel').length, 0, 'retirar o imóvel apaga a linha pública');
    assert.equal((await chamar('POST', '/pagina/despublicar')).status, 200);
    assert.equal(banco.linhas('vitrine_publica').filter((l) => l.conta === 100).length, 0, 'despublicar apaga tudo da conta');
  });
});

test('prévia da Página (P09): o que o visitante veria, sem endereço de entrada nem dado pessoal; contatos da página; A × B', async () => {
  const banco = new BancoFalso(UNICOS);
  let publica: any = null;
  await comServidor(rotas, A, banco, shell, async (chamar) => {
    await imovelAnunciado(chamar, 'Apto com vista', '61911110002');
    await chamar('POST', '/imoveis', { tipo: 'casa', cidade: 'Brasília', titulo: 'Rascunho secreto' });
    // Antes de salvar: a prévia já monta a sugestão, com o imóvel publicável.
    const antes = await chamar('GET', '/pagina/previa');
    assert.equal(antes.status, 200);
    assert.equal(antes.corpo.publicada, false);
    assert.equal(antes.corpo.pagina.endereco, 'usuario-1');
    assert.deepEqual(antes.corpo.imoveis.map((i: any) => i.titulo), ['Apto com vista'], 'rascunho não aparece');
    assert.equal(antes.corpo.imoveis[0].capa, '/arquivo/501');
    assert.equal(antes.corpo.pagina.url_formulario, null, 'na prévia o formulário não envia');
    assert.equal('url_clique' in antes.corpo.pagina, false);
    assert.equal('foto' in antes.corpo.pagina, false, 'id de arquivo não sai, só URL');
    assert.ok(antes.corpo.pagina.blocos.every((b: any) => b.ativo), 'só os blocos que aparecem');
    const texto = JSON.stringify(antes.corpo);
    for (const proibido of ['Lúcia', '61911110002', 'SQSW 300', 'Rascunho secreto', 'comissao', 'proprietario']) assert.ok(!texto.includes(proibido), `prévia sem ${proibido}`);
    // Os contatos da página (30 dias) contam só os que vieram pelo canal da página.
    assert.deepEqual((await chamar('GET', '/pagina')).corpo.numeros, { contatos_30d: 0, visitas_30d: null });
    await chamar('POST', '/contatos', { nome: 'Veio da Página', telefone: '61922223333', origem_canal: 'pagina' });
    await chamar('POST', '/contatos', { nome: 'Veio do Portal', telefone: '61922224444', origem_canal: 'portal' });
    assert.equal((await chamar('GET', '/pagina')).corpo.numeros.contatos_30d, 1);
    // Publicada, a prévia mostra o mesmo que a página pública.
    const inicial = (await chamar('GET', '/pagina')).corpo;
    await chamar('PUT', '/pagina', { ...inicial.pagina, endereco: 'ana-corretora', nome_exibicao: 'Ana Corretora' });
    assert.equal((await chamar('POST', '/pagina/publicar')).status, 200);
    publica = (await chamar('GET', '/pagina/previa')).corpo;
    assert.equal(publica.publicada, true);
  });
  await comServidor(rotasPublicas, VISITANTE, banco, {}, async (chamar) => {
    const p = (await chamar('GET', '/vitrine/pagina?c=ana-corretora')).corpo;
    assert.deepEqual(publica.imoveis, p.imoveis, 'mesmos cartões da página pública');
    const { url_formulario: _a, url_clique: _c, ...semUrlPublica } = p.pagina;
    const { url_formulario: _b, ...semUrlPrevia } = publica.pagina;
    assert.deepEqual(semUrlPrevia, semUrlPublica, 'mesma página, menos os endereços de entrada');
    assert.ok(p.pagina.url_formulario, 'o visitante continua com o formulário');
  });
  // B: a prévia é só da conta dele, sem nada de A.
  await comServidor(rotas, B, banco, shell, async (chamar) => {
    const r = (await chamar('GET', '/pagina/previa')).corpo;
    assert.deepEqual(r.imoveis, []);
    assert.equal(r.pagina.endereco, 'usuario-2');
    assert.equal((await chamar('GET', '/pagina')).corpo.numeros.contatos_30d, 0);
  });
  await comServidor(rotas, { usuario: 9, conta: 100, papeis: ['cliente'] }, banco, shell, async (chamar) => {
    assert.equal((await chamar('GET', '/pagina/previa')).status, 403);
  });
});

// Guarda de regressão: hoje o recorte já vem do escopo de conta (backend/escopo.ts) e do filtro explícito de contatosDaPagina.
test('GET /pagina: contatos_30d conta só os da página da conta do request, mesmo para quem atende 2 contas', async () => {
  const banco = new BancoFalso(UNICOS);
  const atendente: Ator = { usuario: 8, conta: 100, contas: [100, 200], papeis: ['corretor'], extras: { arquivos } };
  const naConta = (conta: number): Ator => ({ ...atendente, conta });
  // Dois contatos da página na conta 100 e um na 200 (a leitura do membro enxerga as duas).
  await comServidor(rotas, naConta(100), banco, shell, async (chamar) => {
    await chamar('POST', '/contatos', { nome: 'Página A1', telefone: '61900000001', origem_canal: 'pagina' });
    await chamar('POST', '/contatos', { nome: 'Página A2', telefone: '61900000002', origem_canal: 'pagina' });
  });
  await comServidor(rotas, naConta(200), banco, shell, async (chamar) => {
    await chamar('POST', '/contatos', { nome: 'Página B1', telefone: '61900000003', origem_canal: 'pagina' });
  });
  await comServidor(rotas, naConta(100), banco, shell, async (chamar) => {
    assert.equal((await chamar('GET', '/pagina')).corpo.numeros.contatos_30d, 2, 'conta 100: só os dela');
  });
  await comServidor(rotas, naConta(200), banco, shell, async (chamar) => {
    assert.equal((await chamar('GET', '/pagina')).corpo.numeros.contatos_30d, 1, 'conta 200: só o dela');
  });
});

test('#193 (D-129): lead com telefone de contato existente não muda e-mail, consentimento nem último contato', async () => {
  const banco = new BancoFalso(UNICOS);
  let anaId = 0;
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    anaId = (await chamar('POST', '/contatos', { nome: 'Ana Ribeiro', telefone: '61990000101' })).corpo.id;
  });
  banco.linhas('perfis_corretor').push({ id: 9002, conta_id: 100, usuario_id: 1, ativo: true } as any);
  const ana = () => banco.linhas('contatos').find((c) => c.id === anaId)!;
  const antes = { ...ana() };
  const ctx = banco.ctxSistema([{ id: 100, nome: 'A' }]);
  const evento = { payload: { nome: 'Fulano Trocado', telefone: '+5561990000101', email: 'invasor@exemplo.com', mensagem: 'oi', imovel_codigo: null, origem: 'pagina', responsavel_id: 1, ip_hash: 'abcdef0123456789' }, conta_id: 100 };
  await reagir.lead_recebido(evento, ctx);
  assert.deepEqual([ana().email ?? null, ana().consentimento_em ?? null, ana().ultimo_contato_em], [null, null, antes.ultimo_contato_em]);
  assert.equal(ana().nome, 'Ana Ribeiro');
  assert.equal(banco.linhas('negocios').filter((n) => n.contato_id === anaId).length, 0, 'sem negócio novo: o corretor decide');
  // Linha do tempo com o nome enviado destacado e a tarefa "Novo pedido pela página".
  const linha = banco.linhas('linha_do_tempo').find((l) => l.contato_id === anaId && l.tipo === 'lead.recebido')!;
  assert.match(linha.resumo, /veio como Fulano Trocado/);
  assert.deepEqual([linha.dados.nome_diverge, linha.dados.email_enviado], [true, 'invasor@exemplo.com']);
  const tarefa = banco.linhas('atividades').find((a) => a.contato_id === anaId && a.tipo === 'tarefa')!;
  assert.equal(tarefa.titulo, 'Novo pedido pela página (veio como Fulano Trocado)');
  assert.match(tarefa.resultado, /não foi gravado/);
  // Consentimento só declarado, ligado ao envio, com a origem embaralhada.
  const c = banco.linhas('consentimentos').filter((x) => x.contato_id === anaId);
  assert.deepEqual(c.map((x) => [x.declarado, x.ip_hash, x.texto_versao, x.registrado_por_id]), [[true, 'abcdef0123456789', 'formulario-v1', null]]);
  assert.equal(linha.dados.consentimento_id, c[0].id);
  // A ficha não conta o declarado como consentimento e mostra que ele espera a confirmação.
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    const ficha = (await chamar('GET', `/contatos/${anaId}`)).corpo;
    assert.equal(ficha.consentimento, null);
    assert.equal(ficha.consentimento_declarado.declarado, true);
    assert.equal((await chamar('POST', `/contatos/${anaId}/consentimento`, { canal: 'whatsapp' })).status, 201);
    const depois = (await chamar('GET', `/contatos/${anaId}`)).corpo;
    assert.ok(depois.consentimento && !depois.consentimento.declarado);
  });
  // Mesmo nome (sem acento e caixa diferentes): sem o destaque.
  await reagir.lead_recebido({ ...evento, payload: { ...evento.payload, nome: 'ana ribeiro', email: null, mensagem: 'outra' } }, ctx);
  const tarefas = banco.linhas('atividades').filter((a) => a.contato_id === anaId && a.tipo === 'tarefa');
  assert.equal(tarefas[1].titulo, 'Novo pedido pela página');
});

/** Contato Ana (conta 100) pronto para receber lead pelo listener. */
async function anaParaLead() {
  const banco = new BancoFalso(UNICOS);
  let anaId = 0;
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    anaId = (await chamar('POST', '/contatos', { nome: 'Ana Ribeiro', telefone: '61990000101' })).corpo.id;
  });
  banco.linhas('perfis_corretor').push({ id: 9002, conta_id: 100, usuario_id: 1, ativo: true } as any);
  const ctx = banco.ctxSistema([{ id: 100, nome: 'A' }]);
  const evento = { payload: { nome: 'Ana Ribeiro', telefone: '+5561990000101', email: null, mensagem: null, imovel_codigo: null, origem: 'pagina', responsavel_id: 1, ip_hash: 'abcdef0123456789' }, conta_id: 100 };
  const pedidos = () => banco.linhas('linha_do_tempo').filter((l) => l.contato_id === anaId && l.tipo === 'lead.recebido');
  return { banco, anaId, ctx, evento, pedidos };
}

test('lead de contato com muitos pedidos antigos: a leitura da duplicata é só da janela de 5 minutos e o lead entra', async () => {
  const { banco, anaId, ctx, evento, pedidos } = await anaParaLead();
  const velho = new Date(Date.now() - 3 * 86_400_000).toISOString();
  for (let i = 0; i < 80; i++) {
    banco.linhas('linha_do_tempo').push({ id: 50000 + i, conta_id: 100, tipo: 'lead.recebido', contato_id: anaId, resumo: 'antigo', dados: { mensagem: null, imovel_codigo: null }, ocorrido_em: velho } as any);
  }
  // Espia as leituras da linha do tempo e faz o `varrerTudo` lançar como o real quando passa do `maximo`
  // (banco-de-dados.md: lança, não corta): sem a janela no filtro, os 80 antigos estouram o teto e o lead cai.
  const leituras: Record<string, unknown>[] = [];
  const original = ctx.dados.comConta;
  ctx.dados.comConta = (id: number, fn: (trx: any) => Promise<unknown>) =>
    original(id, (trx: any) => fn({
      ...trx,
      varrerTudo: async (t: string, op: any = {}) => {
        if (t === 'linha_do_tempo') leituras.push({ ...op.filtros, maximo: op.maximo });
        const r = await trx.varrerTudo(t, op);
        if (r.length > (op.maximo ?? 100_000)) throw new Error(`maximo estourado em ${t}: ${r.length}`);
        return r;
      },
    }));
  await reagir.lead_recebido(evento, ctx);
  assert.equal(pedidos().length, 81, 'o pedido novo entra apesar dos antigos idênticos');
  assert.ok(leituras.length > 0 && leituras.every((f) => 'ocorrido_em[gte]' in f), 'a leitura de duplicata filtra por data');
  assert.ok(leituras.every((f) => typeof f.maximo === 'number' && f.maximo < 81), 'o teto é menor que os pedidos antigos: sem a janela, estouraria');
});

test('lead repetido deduplica só com mesma mensagem E mesmo imóvel; imóveis diferentes sem mensagem não se perdem', async () => {
  const { banco, anaId, ctx, evento, pedidos } = await anaParaLead();
  const ficha = (codigo: string | null, mensagem: string | null = null) => ({ ...evento, payload: { ...evento.payload, imovel_codigo: codigo, mensagem } });
  await reagir.lead_recebido(ficha('AP-1'), ctx);
  await reagir.lead_recebido(ficha('AP-1'), ctx);
  assert.equal(pedidos().length, 1, 'mesmo imóvel e mesma mensagem: duplicata');
  await reagir.lead_recebido(ficha('AP-2'), ctx);
  assert.deepEqual(pedidos().map((l) => l.dados.imovel_codigo), ['AP-1', 'AP-2'], 'outro imóvel sem mensagem: pedido novo');
  await reagir.lead_recebido(ficha('AP-2', 'Aceita financiamento?'), ctx);
  assert.equal(pedidos().length, 3, 'mesmo imóvel, mensagem diferente: pedido novo');
  assert.equal(banco.linhas('atividades').filter((a) => a.contato_id === anaId && a.tipo === 'tarefa').length, 3);
});

test('corrida: dois leads idênticos do mesmo contato existente gravam uma vez (contato travado antes da checagem)', async () => {
  const { banco, anaId, ctx, evento, pedidos } = await anaParaLead();
  const chave = `contatos:${anaId}`;
  let abrir!: () => void;
  const portao = new Promise<void>((ok) => (abrir = ok));
  let segundaTerminou = false;
  let esperou = false;
  // A primeira para logo depois de travar o contato; a segunda chega à trava e espera.
  banco.pausaNaTransacao = async (tabela) => {
    if (tabela !== 'contatos:travada') return;
    banco.pausaNaTransacao = null;
    abrir();
    while (!segundaTerminou && banco.esperando(chave) === 0) await new Promise((ok) => setTimeout(ok, 1));
    esperou = banco.esperando(chave) > 0;
  };
  await Promise.all([
    reagir.lead_recebido(evento, ctx).finally(() => ((banco.pausaNaTransacao = null), abrir())),
    portao.then(() => reagir.lead_recebido(evento, ctx)).finally(() => (segundaTerminou = true)),
  ]);
  assert.ok(esperou, 'o segundo envio esperou a trava do contato');
  assert.equal(pedidos().length, 1);
  assert.equal(banco.linhas('consentimentos').filter((c) => c.contato_id === anaId).length, 1);
  assert.equal(banco.linhas('atividades').filter((a) => a.contato_id === anaId && a.tipo === 'tarefa').length, 1);
});

test('formulário: ip_hash é HMAC com o segredo do parâmetro, e o limite por minuto segue valendo', async () => {
  const ip = '10.0.0.7';
  const corpo = { nome: 'Ana', telefone: '61999991111', consentimento: true };
  limparLimites();
  const a = await chamarWebhook('formulario_lead', 100, corpo, ip, 'segredo-um');
  const hash = a.publicados[0].payload.ip_hash;
  assert.match(hash, /^[0-9a-f]{16}$/);
  assert.equal(hash, hashDaOrigem(ip, 'segredo-um'), 'determinístico com o mesmo segredo');
  assert.notEqual(hash, hashDaOrigem(ip, 'segredo-dois'), 'outro segredo, outro hash');
  assert.notEqual(hash, createHash('sha256').update(ip).digest('hex').slice(0, 16), 'nunca o SHA-256 puro do IP');
  assert.equal((await chamarWebhook('formulario_lead', 100, corpo, ip, 'segredo-um')).status, 200);
  assert.equal((await chamarWebhook('formulario_lead', 100, corpo, ip, 'segredo-um')).status, 200);
  assert.equal((await chamarWebhook('formulario_lead', 100, corpo, ip, 'segredo-um')).status, 429, 'o quarto no minuto é barrado');
  assert.equal((await chamarWebhook('formulario_lead', 100, corpo, '10.0.0.8', 'segredo-um')).status, 200, 'outra origem segue: o limite não vira global');
  // Sem segredo (ausente ou vazio): o formulário funciona, não grava a origem e o limite continua por IP.
  for (const sem of [undefined, '']) {
    limparLimites();
    const r = await chamarWebhook('formulario_lead', 100, corpo, ip, sem);
    assert.deepEqual([r.status, r.publicados[0].payload.ip_hash], [200, null]);
    await chamarWebhook('formulario_lead', 100, corpo, ip, sem);
    await chamarWebhook('formulario_lead', 100, corpo, ip, sem);
    assert.equal((await chamarWebhook('formulario_lead', 100, corpo, ip, sem)).status, 429);
  }
});
