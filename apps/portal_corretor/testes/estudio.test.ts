import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rotas } from '../backend/rotas';
import { checarPeca, imovelParaArte, promptFerramenta, textosDaIa, textosPadrao, validarMarca } from '../comum/estudio';
import { BancoFalso, comServidor, type Ator } from './apoio';

const UNICOS = { contatos: ['telefone'], imoveis: ['codigo'], marca_conta: ['chave'], marca_arquivos: ['tipo'], perfis_corretor: ['usuario_id'] };
const arquivos = { url: async (arquivo: number) => `/arquivo/${arquivo}` };
const HOJE = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
const dia = (delta: number) => new Date(Date.now() + delta * 86400e3).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
let contextoIa = '';
const iaLigada = {
  estadoSlot: async (slot: string) => ({ pedido: slot, efetivo: { slot, origem: 'global' }, backup: null }),
  consultar: async (o: { contexto: string }) => {
    contextoIa = o.contexto;
    return { dados: { titulo: 'Casa dos sonhos no Lago Sul com jardim enorme e piscina aquecida', chamada: 'Agende já', destaques: ['Piscina', 'Jardim', ''], legenda: 'Legenda da IA', hashtags: ['#LagoSul', 'casas'] } };
  },
};
const iaDesligada = { estadoSlot: async (slot: string) => ({ pedido: slot, efetivo: null, backup: null }) };
const A: Ator = { usuario: 1, conta: 100, papeis: ['corretor'], extras: { arquivos, ia: iaDesligada } };
const AcomIA: Ator = { ...A, extras: { arquivos, ia: iaLigada } };
const B: Ator = { usuario: 2, conta: 200, papeis: ['corretor'], extras: { arquivos } };

type Chamar = (m: string, c: string, b?: unknown) => Promise<{ status: number; corpo: any }>;

async function imovelAnunciado(chamar: Chamar) {
  const im = (await chamar('POST', '/imoveis', { tipo: 'casa', cidade: 'Brasília', bairro: 'Lago Sul', titulo: 'Casa com jardim', endereco: 'SHIS QI 9 Conjunto 1', endereco_publico: 'bairro' })).corpo;
  await chamar('PATCH', `/imoveis/${im.id}`, { preco: 2500000, quartos: 4, vagas: 3 });
  const dono = (await chamar('POST', '/contatos', { nome: 'Dona Proprietária', telefone: '61977770001' })).corpo;
  const aut = (await chamar('POST', '/autorizacoes', { imovel_id: im.id, proprietario_id: dono.id, inicio: HOJE, fim: dia(60), comissao_pct: '5', preco_autorizado: '2.500.000' })).corpo;
  await chamar('POST', `/imoveis/${im.id}/midias`, { upload_id: 801, tipo: 'foto' });
  const doc = (await chamar('POST', `/imoveis/${im.id}/midias`, { upload_id: 802, tipo: 'documento' })).corpo;
  await chamar('PATCH', `/autorizacoes/${aut.id}`, { documento_midia_id: doc.id, situacao: 'assinada' });
  await chamar('PATCH', `/imoveis/${im.id}`, { situacao: 'ativo' });
  return im;
}

test('regras puras do Estúdio: marca, textos sem IA, resposta da IA validada, pacote do Canva e checagens', () => {
  assert.equal(validarMarca({ cor_primaria: 'azul', cor_secundaria: '#ffffff', estilo: 'moderno' }).ok, false);
  const m = validarMarca({ cor_primaria: '#0B5394', cor_secundaria: '#F2B705', estilo: 'classico', assinatura: '  Seu corretor  ' });
  assert.ok(m.ok && m.dados.cor_primaria === '#0b5394' && m.dados.assinatura === 'Seu corretor');
  const im = imovelParaArte({ codigo: 'IM-0001', tipo: 'casa', titulo: null, preco_c: 250000000, bairro: 'Lago Sul', cidade: 'Brasília', endereco: 'SHIS QI 9', endereco_publico: 'regiao', proprietario_id: 7, quartos: 4 });
  assert.equal(im.bairro, null, 'endereço público "região" esconde o bairro');
  assert.ok(!('endereco' in im) && !('proprietario_id' in im));
  const t = textosPadrao(im, 'novo_imovel', 'DF-12345');
  assert.match(t.legenda, /CRECI DF-12345/);
  assert.match(t.legenda, /R\$\s?2\.500\.000/);
  assert.ok(!textosPadrao(im, 'vendido', null).legenda.includes('R$'), 'vendido não mostra preço');
  const ia = textosDaIa({ titulo: 'x'.repeat(200), destaques: ['', 'Piscina'], hashtags: ['#Lago Sul'], legenda: '' }, t);
  assert.equal(ia.titulo.length, 60);
  assert.deepEqual(ia.destaques, ['Piscina']);
  assert.deepEqual(ia.hashtags, ['#lagosul']);
  assert.equal(ia.legenda, t.legenda, 'vazio da IA cai no padrão');
  const marcaJoao = { nome: 'João', creci: 'DF-1', cor_primaria: '#000000', cor_secundaria: '#ffffff', estilo: 'moderno', assinatura: null };
  const prompt = promptFerramenta('canva', { formato: 'carrossel', objetivo: 'baixou_preco', textos: t, fotos: 4 }, marcaJoao, im);
  assert.match(prompt, /^Instagram carousel with 4 slides, 1080 x 1350 px/);
  // Blocos fixos, na ordem (D-90); instruções em inglês e o texto da arte em português, entre aspas (D-91).
  assert.match(prompt, /TEXT ON THE ART \(keep exactly as written, in Brazilian Portuguese[\s\S]*\nPHOTOS:[\s\S]*\nSLIDES:\n1\. Cover[\s\S]*\n4\. Closing[\s\S]*\nVISUAL:[\s\S]*\nDO NOT:/);
  assert.match(prompt, /- Footer: "João · CRECI DF-1"/);
  assert.match(prompt, /- Call to action: "Acabou de chegar\. Agende sua visita\."/);
  assert.match(prompt, /Modern style/);
  const semNada = promptFerramenta('canva', { formato: 'story', objetivo: 'destaque', textos: t, fotos: 0 }, { ...marcaJoao, creci: null }, im);
  assert.ok(!semNada.includes('CRECI') && /There is no photo of the property/.test(semNada) && /250 px/.test(semNada) && !/Badge/.test(semNada), 'sem CRECI, sem foto e sem selo a descrição segue');
  assert.match(prompt, /CRECI DF-1/);
  assert.match(prompt, /BAIXOU O PREÇO/);
  assert.ok(!prompt.includes('SHIS'), 'sem endereço');
  assert.ok(!/REFERENCES/.test(prompt), 'sem referência, nenhuma linha de referência');
  // Claude Design: mesma instrução, com a entrega pedida em tamanho exato e as referências por link.
  const design = promptFerramenta('claude_design', { formato: 'story', objetivo: 'novo_imovel', textos: t, fotos: 1, referencias: ['/arquivo/r1', '/arquivo/r2'] }, marcaJoao, im);
  assert.match(design, /^Instagram story, 1080 x 1920 px/);
  assert.match(design, /Deliver the final art as JPG or PNG, exactly 1080 x 1920 px/);
  assert.match(design, /1\. \/arquivo\/r1\n2\. \/arquivo\/r2/);
  assert.match(design, /CRECI DF-1/);
  assert.ok(!prompt.includes('Deliver the final art'), 'no Canva a entrega é pelo próprio Canva');
  const base = { formato: 'post_1x1', legenda: 'ok', hashtags: '#a', arquivos: 1, objetivo: 'novo_imovel' };
  assert.deepEqual(checarPeca(base, { creci: 'DF-1', imovel: true, autorizacaoVigente: true }), { ok: true, pendencias: [], avisos: [] });
  // D-89: sem CRECI é aviso, nunca pendência; a autorização vigente continua pendência.
  const semCreci = checarPeca(base, { creci: null, imovel: true, autorizacaoVigente: false });
  assert.deepEqual([semCreci.pendencias.length, semCreci.avisos.length], [1, 1]);
  assert.equal(checarPeca(base, { creci: null, imovel: false, autorizacaoVigente: false }).ok, true, 'sem CRECI aprova');
  assert.equal(checarPeca({ ...base, objetivo: 'vendido' }, { creci: 'x', imovel: true, autorizacaoVigente: false }).ok, true, 'vendido não pede autorização vigente');
  assert.equal(checarPeca({ ...base, formato: 'carrossel', arquivos: 1 }, { creci: 'x', imovel: false, autorizacaoVigente: false }).ok, false);
  assert.equal(checarPeca({ ...base, legenda: 'x'.repeat(2300) }, { creci: 'x', imovel: false, autorizacaoVigente: false }).ok, false);
});

test('Estúdio: pedido vira peças com textos (modelo sem IA), arte enviada, aprovação com checagens', async () => {
  const banco = new BancoFalso(UNICOS);
  let imovel: any;
  let pecaId = 0;
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    imovel = await imovelAnunciado(chamar);
    const marca = (await chamar('GET', '/estudio/marca')).corpo;
    assert.deepEqual([marca.salva, marca.cor_primaria, marca.creci], [false, '#0b5394', null]);
    assert.equal((await chamar('PUT', '/estudio/marca', { cor_primaria: 'x', cor_secundaria: '#ffffff', estilo: 'moderno' })).status, 422);
    assert.equal((await chamar('PUT', '/estudio/marca', { cor_primaria: '#112233', cor_secundaria: '#ffcc00', estilo: 'minimalista' })).corpo.salva, true);
    assert.equal((await chamar('POST', '/estudio/marca/arquivos', { tipo: 'logo', upload_id: 901 })).corpo.logo_url, '/arquivo/901');
    assert.equal((await chamar('POST', '/estudio/pedido', { pedido: 'post', formatos: [] })).status, 422);
    const r = await chamar('POST', '/estudio/pedido', { pedido: 'Post de lançamento', imovel_id: imovel.id, objetivo: 'novo_imovel', formatos: ['post_1x1', 'carrossel'] });
    assert.equal(r.status, 201, JSON.stringify(r.corpo));
    assert.equal(r.corpo.ia, false, 'IA desligada: textos pelo modelo');
    assert.equal(r.corpo.pecas.length, 2);
    assert.deepEqual(r.corpo.imovel.fotos.map((f: any) => f.url), ['/arquivo/801'], 'só fotos públicas, nunca o documento');
    assert.ok(!JSON.stringify(r.corpo).includes('Proprietária') && !JSON.stringify(r.corpo).includes('SHIS'));
    pecaId = r.corpo.pecas[0].id;
    const carrossel = r.corpo.pecas[1].id;
    assert.deepEqual(r.corpo.pecas.map((p: any) => [p.motor, p.arquivos.length]), [['canva_ia', 0], ['canva_ia', 0]], 'a arte vem do Canva (D-89)');
    // Sem arte: aprovação recusada com a lista do que falta; o CRECI ausente não entra nela (D-89).
    const recusa = await chamar('POST', `/estudio/pecas/${pecaId}/aprovar`);
    assert.equal(recusa.corpo.codigo, 'CHECAGEM_PENDENTE');
    assert.deepEqual(recusa.corpo.detalhes, ['Envie a arte feita no Canva (ou em outra ferramenta) antes de aprovar.']);
    assert.equal((await chamar('PUT', `/estudio/pecas/${pecaId}/arquivos`, { upload_ids: [1, 2] })).status, 422, 'post leva uma imagem');
    assert.equal((await chamar('PUT', `/estudio/pecas/${carrossel}/arquivos`, { upload_ids: [1, 2, 3, 4, 5, 6] })).status, 422, 'carrossel até 5');
    const arte = await chamar('PUT', `/estudio/pecas/${pecaId}/arquivos`, { upload_ids: [1001], motor: 'canva_ia' });
    assert.deepEqual(arte.corpo.arquivos.map((a: any) => a.url), ['/arquivo/1001']);
    // Sem CRECI a peça é aprovada, com o lembrete; a legenda e a instrução saem sem CRECI.
    const semCreci = await chamar('POST', `/estudio/pecas/${pecaId}/aprovar`);
    assert.equal(semCreci.status, 200, JSON.stringify(semCreci.corpo));
    assert.equal(semCreci.corpo.estado, 'aprovada');
    assert.equal(semCreci.corpo.avisos.length, 1);
    assert.ok(!/CRECI/.test(semCreci.corpo.legenda ?? ''));
    assert.ok(!/CRECI/.test((await chamar('GET', `/estudio/pecas/${pecaId}/instrucao`)).corpo.prompt), 'instrução sem CRECI, sem travar');
    await chamar('POST', `/estudio/pecas/${pecaId}/rejeitar`);
    await chamar('PUT', '/conta/meu-perfil', { creci: 'DF-12345-F', telefone: '61999990000' });
    const ok = await chamar('POST', `/estudio/pecas/${pecaId}/aprovar`);
    assert.equal(ok.status, 200, JSON.stringify(ok.corpo));
    assert.equal(ok.corpo.estado, 'aprovada');
    assert.match(ok.corpo.legenda, /CRECI DF-12345-F$/, 'a aprovação garante o CRECI na legenda');
    // Arte nova ou texto novo pedem nova aprovação.
    await chamar('PUT', `/estudio/pecas/${pecaId}/arquivos`, { upload_ids: [1002], motor: 'canva_ia' });
    assert.equal(banco.linhas('pecas').find((p) => p.id === pecaId)!.estado, 'rascunho');
    assert.equal(banco.linhas('peca_arquivos').filter((a) => a.peca_id === pecaId).length, 1, 'a arte anterior foi substituída');
    await chamar('POST', `/estudio/pecas/${pecaId}/aprovar`);
    await chamar('PATCH', `/estudio/pecas/${pecaId}`, { titulo: 'Outro título' });
    assert.equal(banco.linhas('pecas').find((p) => p.id === pecaId)!.estado, 'rascunho');
    // Legenda já com o CRECI não ganha outro.
    await chamar('POST', `/estudio/pecas/${pecaId}/aprovar`);
    assert.equal((banco.linhas('pecas').find((p) => p.id === pecaId)!.legenda.match(/DF-12345-F/g) ?? []).length, 1);
    await chamar('PATCH', `/estudio/pecas/${pecaId}`, { chamada: 'Nova chamada' });
    // O CRECI entra antes da checagem: legenda no limite com o CRECI acrescentado não passa.
    const linha = banco.linhas('pecas').find((p) => p.id === pecaId)!;
    const original = linha.legenda;
    linha.legenda = 'a'.repeat(2200 - (linha.hashtags ?? '').length - 2 - 5);
    const estouro = await chamar('POST', `/estudio/pecas/${pecaId}/aprovar`);
    assert.equal(estouro.corpo.codigo, 'CHECAGEM_PENDENTE', 'legenda + CRECI acima de 2.200 é recusada');
    linha.legenda = original;
    // Fazer em outra ferramenta: instrução e fotos públicas; o Canva é o padrão e tem link para abrir.
    const canva = (await chamar('GET', `/estudio/pecas/${pecaId}/instrucao`)).corpo;
    assert.equal(canva.ferramenta, 'canva');
    assert.match(canva.prompt, /CRECI DF-12345-F/);
    assert.deepEqual(canva.fotos.map((f: any) => f.url), ['/arquivo/801']);
    assert.equal(canva.logo_url, '/arquivo/901');
    assert.match(canva.prompt, /- Place the attached logo in the bottom corner/, 'com logo na marca, a descrição pede o logo');
    assert.equal(canva.abrir, 'https://www.canva.com/ai');
    const design = (await chamar('GET', `/estudio/pecas/${pecaId}/instrucao?ferramenta=claude_design`)).corpo;
    assert.equal(design.ferramenta, 'claude_design');
    assert.equal(design.abrir, null);
    assert.match(design.prompt, /Deliver the final art/);
    // Pacote de lançamento: três formatos.
    const pacote = await chamar('POST', '/estudio/pacote', { imovel_id: imovel.id });
    assert.deepEqual(pacote.corpo.pecas.map((p: any) => p.formato), ['post_1x1', 'carrossel', 'story']);
    assert.equal((await chamar('GET', '/estudio/pecas')).corpo.total, 5);
    assert.equal((await chamar('PATCH', `/estudio/pecas/${pecaId}/remover`)).status, 200);
    assert.equal((await chamar('GET', '/estudio/pecas')).corpo.total, 4);
  });

  // Outra conta não vê, não aprova e não usa o imóvel de A.
  await comServidor(rotas, B, banco, {}, async (chamar) => {
    assert.equal((await chamar('GET', '/estudio/pecas')).corpo.total, 0);
    const deA = banco.linhas('pecas').find((p) => p.conta_id === 100 && !p.removido_em)!.id;
    assert.equal((await chamar('GET', `/estudio/pecas/${deA}`)).status, 404);
    assert.equal((await chamar('POST', `/estudio/pecas/${deA}/aprovar`)).status, 404);
    assert.equal((await chamar('PUT', `/estudio/pecas/${deA}/arquivos`, { upload_ids: [5] })).status, 404);
    assert.equal((await chamar('POST', '/estudio/pedido', { imovel_id: imovel.id, formatos: ['story'] })).status, 422, 'imóvel de outra conta');
    assert.equal((await chamar('GET', '/estudio/marca')).corpo.cor_primaria, '#0b5394', 'marca de A não aparece');
  });
});

test('Estúdio com IA: textos da IA validados, contexto só com dado público', async () => {
  const banco = new BancoFalso(UNICOS);
  await comServidor(rotas, AcomIA, banco, {}, async (chamar) => {
    const im = await imovelAnunciado(chamar);
    const r = await chamar('POST', '/estudio/pedido', { pedido: 'Story sofisticado', imovel_id: im.id, objetivo: 'destaque', formatos: ['story'] });
    assert.equal(r.corpo.ia, true);
    const p = r.corpo.pecas[0];
    assert.equal(p.titulo.length, 60, 'título cortado no limite');
    assert.deepEqual(p.destaques, ['Piscina', 'Jardim']);
    assert.equal(p.hashtags, '#lagosul #casas');
    assert.equal(p.gerada_por_ia, true);
    for (const proibido of ['Proprietária', 'SHIS', 'comiss', '61977770001']) assert.ok(!contextoIa.includes(proibido), `contexto sem ${proibido}`);
    assert.match(contextoIa, /Lago Sul, Brasília/);
  });
});

test('Referências do corretor: somam até o limite, entram na instrução só se escolhidas e nunca as de outra conta', async () => {
  // O único de `marca_arquivos` é parcial (logo e foto, uma por conta; referência soma): o banco falso não tem
  // único parcial, então aqui ele fica de fora e a rota garante a troca de logo e foto.
  const banco = new BancoFalso({ contatos: ['telefone'], imoveis: ['codigo'], marca_conta: ['chave'], perfis_corretor: ['usuario_id'] });
  let pecaA = 0;
  let refsA: number[] = [];
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    await chamar('POST', '/estudio/marca/arquivos', { tipo: 'logo', upload_id: 900 });
    await chamar('POST', '/estudio/marca/arquivos', { tipo: 'logo', upload_id: 901 });
    for (const u of [701, 702]) assert.equal((await chamar('POST', '/estudio/marca/arquivos', { tipo: 'referencia', upload_id: u })).status, 200);
    const m = (await chamar('GET', '/estudio/marca')).corpo;
    assert.equal(m.logo_url, '/arquivo/901', 'logo troca, não soma');
    assert.deepEqual(m.referencias.map((r: any) => r.url), ['/arquivo/701', '/arquivo/702']);
    refsA = m.referencias.map((r: any) => r.id);
    const r = await chamar('POST', '/estudio/pedido', { pedido: 'Post institucional', formatos: ['post_1x1'] });
    pecaA = r.corpo.pecas[0].id;
    const sem = (await chamar('GET', `/estudio/pecas/${pecaA}/instrucao`)).corpo;
    assert.deepEqual(sem.referencias, [], 'sem escolher, nenhuma referência');
    const uma = (await chamar('GET', `/estudio/pecas/${pecaA}/instrucao?ferramenta=outra&referencias=${refsA[1]}`)).corpo;
    assert.deepEqual(uma.referencias.map((x: any) => x.url), ['/arquivo/702']);
    assert.match(uma.prompt, /1\. \/arquivo\/702/);
    assert.ok(!uma.prompt.includes('/arquivo/701'));
    for (const u of [703, 704, 705, 706]) await chamar('POST', '/estudio/marca/arquivos', { tipo: 'referencia', upload_id: u });
    assert.equal((await chamar('POST', '/estudio/marca/arquivos', { tipo: 'referencia', upload_id: 707 })).corpo.codigo, 'LIMITE', 'até 6');
    const tirada = await chamar('PATCH', `/estudio/marca/arquivos/${refsA[0]}/remover`);
    assert.equal(tirada.corpo.referencias.length, 5);
    const logo = banco.linhas('marca_arquivos').find((l) => l.tipo === 'logo')!;
    assert.equal((await chamar('PATCH', `/estudio/marca/arquivos/${logo.id}/remover`)).status, 404, 'logo não sai por aqui');
  });

  await comServidor(rotas, B, banco, {}, async (chamar) => {
    await chamar('POST', '/estudio/marca/arquivos', { tipo: 'referencia', upload_id: 801 });
    const mb = (await chamar('GET', '/estudio/marca')).corpo;
    assert.deepEqual(mb.referencias.map((r: any) => r.url), ['/arquivo/801'], 'só as referências de B');
    assert.equal(mb.logo_url, null);
    const pb = (await chamar('POST', '/estudio/pedido', { pedido: 'Post', formatos: ['post_1x1'] })).corpo.pecas[0].id;
    // Pedir o id de uma referência de A na peça de B não traz nada; a peça de A é 404; tirar a de A é 404.
    const i = (await chamar('GET', `/estudio/pecas/${pb}/instrucao?referencias=${refsA[1]}`)).corpo;
    assert.deepEqual(i.referencias, []);
    assert.ok(!i.prompt.includes('/arquivo/70'));
    assert.equal((await chamar('GET', `/estudio/pecas/${pecaA}/instrucao`)).status, 404);
    assert.equal((await chamar('PATCH', `/estudio/marca/arquivos/${refsA[1]}/remover`)).status, 404);
  });
  assert.equal(banco.linhas('marca_arquivos').filter((l) => l.conta_id === 100 && l.tipo === 'referencia').length, 5);
});
