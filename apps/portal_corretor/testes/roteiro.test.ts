import { test } from 'node:test';
import assert from 'node:assert/strict';
import { linkComoChegar, linkRoteiro, lugarNoMapa, quantoFalta, roteiroPorDia } from '../comum/roteiro';

const SP = 'America/Sao_Paulo';
const casa = { codigo: 'IM-1', titulo: 'Casa', endereco: 'Rua A, 10', bairro: 'Noroeste', cidade: 'Brasília' };
const apto = { codigo: 'IM-2', titulo: 'Apto', endereco: null, bairro: 'Asa Sul', cidade: 'Brasília' };
const regiao = { codigo: 'IM-3', titulo: 'Lote', endereco: null, bairro: null, cidade: 'Brasília' };

test('roteiro: visitas por dia no fuso, na ordem do horário', () => {
  const r = roteiroPorDia(
    [
      { ref: 2, quando: '2026-11-07T16:00:00.000Z', imovel: apto }, // 13h em SP
      { ref: 1, quando: '2026-11-07T13:00:00.000Z', imovel: casa }, // 10h em SP
      { ref: 3, quando: '2026-11-08T01:30:00.000Z', imovel: regiao }, // 22h30 do dia 7 em SP
      { ref: 4, quando: '2026-11-09T13:00:00.000Z', imovel: null },
      { ref: 5, quando: null, imovel: casa },
    ],
    SP,
  );
  assert.deepEqual(r.map((d) => [d.dia, d.visitas.map((v) => v.ref)]), [['2026-11-07', [1, 2, 3]], ['2026-11-09', [4]]]);
});

test('mapa: endereço só quando publicado; bairro como região; sem os dois, nada', () => {
  assert.deepEqual(lugarNoMapa(casa), { texto: 'Rua A, 10, Noroeste, Brasília', exato: true });
  assert.deepEqual(lugarNoMapa(apto), { texto: 'Asa Sul, Brasília', exato: false });
  assert.equal(lugarNoMapa(regiao), null);
  assert.equal(linkComoChegar(null), null);
  assert.equal(linkComoChegar(casa), 'https://www.google.com/maps/dir/?api=1&destination=Rua%20A%2C%2010%2C%20Noroeste%2C%20Bras%C3%ADlia');
  const visitas = [casa, regiao, apto].map((imovel, i) => ({ ref: i, quando: null, imovel }));
  assert.equal(linkRoteiro(visitas), `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent('Asa Sul, Brasília')}&waypoints=${encodeURIComponent('Rua A, 10, Noroeste, Brasília')}`);
  assert.equal(linkRoteiro(visitas.slice(0, 2)), null, 'uma parada só no mapa não é roteiro');
});

test('quanto falta: hoje, amanhã ou em N dias, por dia de calendário', () => {
  const agora = new Date('2026-10-26T23:00:00.000Z'); // 20h do dia 26 em SP
  assert.equal(quantoFalta('2026-10-26T23:30:00.000Z', agora, SP), 'hoje');
  assert.equal(quantoFalta('2026-10-27T02:30:00.000Z', agora, SP), 'hoje', '2h30 do dia 27 em UTC ainda é dia 26 em SP');
  assert.equal(quantoFalta('2026-10-27T12:00:00.000Z', agora, SP), 'amanhã');
  assert.equal(quantoFalta('2026-11-02T12:00:00.000Z', agora, SP), 'em 7 dias');
});
