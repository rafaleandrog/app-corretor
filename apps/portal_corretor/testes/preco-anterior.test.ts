import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rotas } from '../backend/rotas';
import { precoAnteriorAoMudar } from '../backend/imoveis';
import { imovelParaArte, textosPadrao, textoPreco, promptFerramenta, contextoPeca } from '../comum/estudio';
import { imovelPublico } from '../comum/pagina';
import { BancoFalso, comServidor, type Ator } from './apoio';

const UNICOS = { contatos: ['telefone'], imoveis: ['codigo'], marca_conta: ['chave'], marca_arquivos: ['tipo'], perfis_corretor: ['usuario_id'] };
const arquivos = { url: async (arquivo: number) => `/arquivo/${arquivo}` };
const A: Ator = { usuario: 1, conta: 100, papeis: ['corretor'], extras: { arquivos, ia: { estadoSlot: async (slot: string) => ({ pedido: slot, efetivo: null, backup: null }) } } };
const B: Ator = { usuario: 2, conta: 200, papeis: ['corretor'], extras: { arquivos } };

test('precoAnteriorAoMudar: cai grava o anterior; igual mantém; sobe ou sem valor limpa', () => {
  assert.equal(precoAnteriorAoMudar(250000000, 240000000), 250000000);
  assert.equal(precoAnteriorAoMudar(240000000, 250000000), null);
  assert.equal(precoAnteriorAoMudar(250000000, 250000000), null, 'igual sem anterior: nada');
  assert.equal(precoAnteriorAoMudar(240000000, 240000000, 250000000), 250000000, 'igual: mantém');
  assert.equal(precoAnteriorAoMudar(null, 250000000), null);
  assert.equal(precoAnteriorAoMudar(250000000, null), null);
});

test('PATCH do imóvel: preço cai grava preco_anterior_c; igual mantém; sobe limpa; outro campo não mexe; teto 32 bits', async () => {
  const banco = new BancoFalso(UNICOS);
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    const im = (await chamar('POST', '/imoveis', { tipo: 'casa', cidade: 'Brasília', bairro: 'Lago Sul' })).corpo;
    const anterior = () => banco.linhas('imoveis').find((l) => l.id === im.id)!.preco_anterior_c ?? null;
    assert.equal((await chamar('PATCH', `/imoveis/${im.id}`, { preco: 2500000 })).status, 200);
    assert.equal(anterior(), null, 'primeiro preço: sem anterior');
    await chamar('PATCH', `/imoveis/${im.id}`, { preco: 2400000 });
    assert.equal(anterior(), 250000000, 'caiu: guarda o de antes');
    await chamar('PATCH', `/imoveis/${im.id}`, { quartos: 3 });
    assert.equal(anterior(), 250000000, 'outro campo não mexe');
    await chamar('PATCH', `/imoveis/${im.id}`, { preco: 2400000, quartos: 3 });
    assert.equal(anterior(), 250000000, 'corpo do formulário (mesmo preço + outro campo): mantém');
    await chamar('PATCH', `/imoveis/${im.id}`, { preco: null });
    assert.equal(anterior(), null, 'sem preço: limpa');
    await chamar('PATCH', `/imoveis/${im.id}`, { preco: 2500000 });
    await chamar('PATCH', `/imoveis/${im.id}`, { preco: 2400000 });
    await chamar('PATCH', `/imoveis/${im.id}`, { preco: 2300000 });
    assert.equal(anterior(), 240000000);
    await chamar('PATCH', `/imoveis/${im.id}`, { preco: 2600000 });
    assert.equal(anterior(), null, 'subiu: limpa');
    // Teto de 32 bits (D-131): R$ 21.474.836,47 passa; acima, recusa.
    assert.equal((await chamar('PATCH', `/imoveis/${im.id}`, { preco: '21.474.836,47' })).status, 200);
    assert.equal(banco.linhas('imoveis').find((l) => l.id === im.id)!.preco_c, 2147483647);
    assert.equal((await chamar('PATCH', `/imoveis/${im.id}`, { preco: '21.474.836,48' })).status, 422);
    await chamar('PATCH', `/imoveis/${im.id}`, { preco: '21.474.000,00' });
    assert.equal(anterior(), 2147483647, 'cai a partir do teto');
    // A resposta do PATCH é só do corretor dono; o outro corretor não enxerga o imóvel.
    (globalThis as any).__imA = im.id;
  });
  await comServidor(rotas, B, banco, {}, async (chamar) => {
    assert.equal((await chamar('PATCH', `/imoveis/${(globalThis as any).__imA}`, { preco: 1 })).status, 404);
  });
});

test('pacote "Baixou o preço": "de X por Y" só com o anterior; sem ele, sem número inventado', () => {
  const base = { codigo: 'IM-1', tipo: 'casa', titulo: null, bairro: 'Lago Sul', cidade: 'Brasília', preco_c: 240000000 };
  const com = imovelParaArte({ ...base, preco_anterior_c: 250000000 });
  const sem = imovelParaArte(base);
  assert.equal(com.preco_anterior_c, 250000000);
  assert.equal(sem.preco_anterior_c, null);
  assert.match(textoPreco(com, 'baixou_preco')!, /^de R\$\s?2\.500\.000 por R\$\s?2\.400\.000$/);
  assert.match(textosPadrao(com, 'baixou_preco', null).legenda, /Valor: de R\$\s?2\.500\.000 por R\$\s?2\.400\.000/);
  assert.match(contextoPeca('', com, 'baixou_preco', 'post_1x1'), /Preço: de R\$\s?2\.500\.000 por/);
  const marca = { nome: 'J', creci: null, cor_primaria: '#000000', cor_secundaria: '#ffffff', estilo: 'moderno', assinatura: null };
  assert.match(promptFerramenta('canva', { formato: 'post_1x1', objetivo: 'baixou_preco', textos: textosPadrao(com, 'baixou_preco', null), fotos: 1 }, marca, com), /- Price: "de R\$\s?2\.500\.000 por/);
  const legSem = textosPadrao(sem, 'baixou_preco', null).legenda;
  assert.ok(!/\bde R\$/.test(legSem) && /Valor: R\$\s?2\.400\.000/.test(legSem));
  // Outros objetivos nunca citam o anterior; anterior não maior que o atual é ignorado.
  assert.equal(textoPreco(com, 'novo_imovel')?.startsWith('de '), false);
  assert.equal(imovelParaArte({ ...base, preco_anterior_c: 100 }).preco_anterior_c, null);
  const pub = imovelPublico({ ...base, preco_anterior_c: 250000000, situacao: 'ativo', finalidade: 'venda' }, []);
  assert.ok(!('preco_anterior_c' in pub) && pub.preco_c === 240000000, 'a vitrine não leva o preço anterior');
});
