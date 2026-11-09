import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rotas } from '../backend/rotas';
import { camposDoDitado, numeroEmTexto, rascunhoSemTipo, reaisEmTexto } from '../comum/imoveis';
import { BancoFalso, comServidor, type Ator } from './apoio';

// Etapa 4, grupo 3 (P07 e M3): rascunho que nasce pelas fotos, "Ditar o resto" e os valores no
// formato brasileiro (#185).

const UNICOS = { contatos: ['telefone'], imoveis: ['codigo'] };
const ia = (resposta: Record<string, unknown>, captura: { contexto?: string } = {}) => ({
  estadoSlot: async (slot: string) => ({ pedido: slot, efetivo: { slot, origem: 'global' }, backup: null }),
  consultar: async (o: { contexto: string }) => ((captura.contexto = o.contexto), { dados: resposta }),
});

test('#185: valores no formato brasileiro, em texto, gravam certo no cadastro e na edição', async () => {
  const banco = new BancoFalso(UNICOS);
  await comServidor(rotas, { usuario: 1, conta: 100, papeis: ['corretor'] }, banco, {}, async (chamar) => {
    const r = await chamar('POST', '/imoveis', { tipo: 'casa', cidade: 'Brasília', preco: '1.450.000', area_util_m2: '120,5', condominio: '1.200,50' });
    assert.equal(r.status, 201, JSON.stringify(r.corpo));
    assert.equal(r.corpo.preco_c, 145_000_000);
    assert.equal(Number(r.corpo.area_util_m2), 120.5);
    assert.equal(r.corpo.condominio_c, 120_050);
    const p = await chamar('PATCH', `/imoveis/${r.corpo.id}`, { preco: '1.500.000', area_total_m2: '1.200' });
    assert.equal(p.status, 200, JSON.stringify(p.corpo));
    assert.equal(banco.linhas('imoveis')[0].preco_c, 150_000_000);
    assert.equal(Number(banco.linhas('imoveis')[0].area_total_m2), 1200);
  });
  // O que a tela mostra no campo de texto.
  assert.equal(reaisEmTexto(145_000_000), '1.450.000');
  assert.equal(reaisEmTexto(120_050), '1.200,50');
  assert.equal(reaisEmTexto(null), '');
  assert.equal(numeroEmTexto(120.5), '120,5');
  assert.equal(numeroEmTexto('1200'), '1.200');
});

test('P07: rascunho vazio pelas fotos nasce "outro" sem cidade; sem a marca, tipo e cidade continuam obrigatórios', async () => {
  const banco = new BancoFalso(UNICOS);
  await comServidor(rotas, { usuario: 1, conta: 100, papeis: ['corretor'] }, banco, {}, async (chamar) => {
    assert.equal((await chamar('POST', '/imoveis', {})).status, 422);
    const r = await chamar('POST', '/imoveis', { rascunho: true });
    assert.equal(r.status, 201, JSON.stringify(r.corpo));
    assert.deepEqual([r.corpo.situacao, r.corpo.tipo, r.corpo.cidade ?? null], ['rascunho', 'outro', null]);
    assert.equal(rascunhoSemTipo(r.corpo), true);
    assert.equal((await chamar('POST', '/imoveis', { rascunho: true, preco: '99999999999999999999999' })).status, 422, 'o rascunho vazio ainda valida o que vem');
    const p = await chamar('PATCH', `/imoveis/${r.corpo.id}`, { tipo: 'casa', cidade: 'Brasília' });
    assert.equal(p.status, 200);
    assert.equal(rascunhoSemTipo(banco.linhas('imoveis')[0]), false);
  });
});

test('Ditar o resto: a fala vira campos saneados; IA fora do ar é 503; fala vazia é 422', async () => {
  const captura: { contexto?: string } = {};
  const resposta = { tipo: 'apartamento', bairro: 'Sudoeste', cidade: 'Brasília', uf: 'df', quartos: 3, suites: 120, area_util_m2: 120.5, preco_reais: 1_400_000, condominio_reais: 1200, caracteristicas: ['piscina', ' ', 'vista'], extra: 'x' };
  const A: Ator = { usuario: 1, conta: 100, papeis: ['corretor'], extras: { ia: ia(resposta, captura) } };
  await comServidor(rotas, A, new BancoFalso(UNICOS), {}, async (chamar) => {
    const r = await chamar('POST', '/imoveis/ia', { texto: 'apartamento de 3 quartos no Sudoeste, 120 metros e meio, um milhão e quatrocentos' });
    assert.equal(r.status, 200, JSON.stringify(r.corpo));
    assert.deepEqual(r.corpo.campos, { tipo: 'apartamento', bairro: 'Sudoeste', cidade: 'Brasília', uf: 'DF', quartos: 3, area_util_m2: '120,5', preco: '1.400.000', condominio: '1.200', caracteristicas: 'piscina, vista' });
    assert.match(captura.contexto!, /Sudoeste/);
    assert.equal((await chamar('POST', '/imoveis/ia', { texto: '  ' })).status, 422);
  });
  const sem: Ator = { usuario: 1, conta: 100, papeis: ['corretor'], extras: { ia: { estadoSlot: async () => ({ efetivo: null }) } } };
  await comServidor(rotas, sem, new BancoFalso(UNICOS), {}, async (chamar) => {
    assert.equal((await chamar('POST', '/imoveis/ia', { texto: 'casa' })).status, 503);
  });
  assert.deepEqual(camposDoDitado({ tipo: 'castelo', uf: 'Distrito', quartos: -1, preco_reais: 1e12 }), {});
  // Quem não é corretor não dita.
  await comServidor(rotas, { usuario: 9, conta: null, papeis: ['operacao'] }, new BancoFalso(UNICOS), {}, async (chamar) => {
    assert.equal((await chamar('POST', '/imoveis/ia', { texto: 'casa' })).status, 403);
  });
});

test('POST /envios só aceita imóvel anunciável: rascunho 422, ativo com autorização vigente 201', async () => {
  const banco = new BancoFalso({ ...UNICOS });
  await comServidor(rotas, { usuario: 1, conta: 100, papeis: ['corretor'] }, banco, {}, async (chamar) => {
    const c = (await chamar('POST', '/contatos', { nome: 'Rita Souza', telefone: '61988881111' })).corpo;
    const im = (await chamar('POST', '/imoveis', { tipo: 'apartamento', cidade: 'Brasília', titulo: 'Apto' })).corpo;
    const corpo = { contato_id: c.id, tipo: 'imovel', imovel_id: im.id, canal: 'whatsapp' };
    const r = await chamar('POST', '/envios', corpo);
    assert.equal(r.status, 422, JSON.stringify(r.corpo));
    assert.equal(r.corpo.codigo ?? r.corpo.erro?.codigo, 'IMOVEL_NAO_ANUNCIAVEL');
    assert.equal(banco.linhas('envios').length, 0);
    // Ativo sem autorização vigente continua recusado.
    banco.linhas('imoveis')[0].situacao = 'ativo';
    assert.equal((await chamar('POST', '/envios', corpo)).status, 422);
    // Ativo com autorização assinada e vigente: envia.
    await banco.dados(100).criar('autorizacoes_venda', { imovel_id: im.id, situacao: 'assinada', inicio: '2020-01-01', fim: '2099-12-31', documento_midia_id: 1 });
    const ok = await chamar('POST', '/envios', corpo);
    assert.equal(ok.status, 201, JSON.stringify(ok.corpo));
    assert.equal((await chamar('GET', `/imoveis/${im.id}/contexto`)).corpo.anunciavel, true);
  });
});

test('POST /envios: registro de envio já feito fora do app não exige imóvel anunciável', async () => {
  const banco = new BancoFalso({ ...UNICOS });
  await comServidor(rotas, { usuario: 1, conta: 100, papeis: ['corretor'] }, banco, {}, async (chamar) => {
    const c = (await chamar('POST', '/contatos', { nome: 'Rita Souza', telefone: '61988881111' })).corpo;
    const im = (await chamar('POST', '/imoveis', { tipo: 'apartamento', cidade: 'Brasília', titulo: 'Apto' })).corpo;
    banco.linhas('imoveis')[0].situacao = 'vendido';
    for (const extra of [{ tipo: 'imovel', canal: 'presencial' }, { tipo: 'imovel', canal: 'email' }, { tipo: 'simulacao', canal: 'email' }, { tipo: 'arquivo', canal: 'presencial' }]) {
      const r = await chamar('POST', '/envios', { contato_id: c.id, imovel_id: im.id, ...extra });
      assert.equal(r.status, 201, JSON.stringify(r.corpo));
    }
    // O cartão pelo WhatsApp, esse sim, continua exigindo imóvel anunciável.
    const wa = await chamar('POST', '/envios', { contato_id: c.id, imovel_id: im.id, tipo: 'imovel', canal: 'whatsapp' });
    assert.equal(wa.status, 422, JSON.stringify(wa.corpo));
    assert.equal(banco.linhas('envios').length, 4);
  });
});
