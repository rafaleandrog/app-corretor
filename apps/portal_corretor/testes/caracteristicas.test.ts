import { test } from 'node:test';
import assert from 'node:assert/strict';
import { imovelPublico } from '../comum/pagina';
import { imovelParaArte } from '../comum/estudio';
import { listaDeCaracteristicas, validarImovel } from '../comum/imoveis';
import { caracteristicasNaVitrine } from '../backend/vitrine';
import { BancoFalso } from './apoio';

test('#179: o texto das características vira lista na vitrine e na peça do Estúdio', () => {
  const v = validarImovel({ tipo: 'casa', cidade: 'Brasília', caracteristicas: 'piscina, churrasqueira;  piscina\nvista' });
  assert.ok(v.ok);
  const im = { codigo: 'IM-1', tipo: 'casa', cidade: 'Brasília', caracteristicas: (v as any).dados.caracteristicas };
  assert.equal(im.caracteristicas, 'piscina, churrasqueira, vista');
  assert.deepEqual(imovelPublico(im, []).caracteristicas, ['piscina', 'churrasqueira', 'vista']);
  assert.deepEqual(imovelParaArte(im).caracteristicas, ['piscina', 'churrasqueira', 'vista']);
  assert.deepEqual(listaDeCaracteristicas(['a', ' a ', '', 'b']), ['a', 'b']);
  assert.deepEqual(listaDeCaracteristicas(null), []);
});

test('#179: o boot republica as características de quem já estava na vitrine, uma vez só', async () => {
  const banco = new BancoFalso();
  const d = banco.dados(100);
  const im = await d.criar('imoveis', { codigo: 'IM-1', tipo: 'casa', cidade: 'Brasília', caracteristicas: 'piscina, vista' });
  const sem = await d.criar('imoveis', { codigo: 'IM-2', tipo: 'casa', cidade: 'Brasília', caracteristicas: null });
  await d.criar('vitrine_publica', { conta: 100, tipo: 'imovel', chave: `100:${im.id}`, codigo: 'IM-1', dados: { codigo: 'IM-1', preco_c: 1, caracteristicas: [] } });
  await d.criar('vitrine_publica', { conta: 100, tipo: 'imovel', chave: `100:${sem.id}`, codigo: 'IM-2', dados: { codigo: 'IM-2', caracteristicas: [] } });
  assert.equal(await caracteristicasNaVitrine(d, 100), 1);
  const linha = banco.linhas('vitrine_publica').find((l) => l.codigo === 'IM-1')!;
  assert.deepEqual(linha.dados.caracteristicas, ['piscina', 'vista']);
  assert.equal(linha.dados.preco_c, 1);
  assert.equal(await caracteristicasNaVitrine(d, 100), 0);
});
