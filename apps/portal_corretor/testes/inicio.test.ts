import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ABAS_INICIO, APELIDOS_INICIO, ROTA_AGENDA } from '../comum/funil';
import { TELAS_APP, telaBase } from '../comum/assistente';

const manifesto = JSON.parse(readFileSync(resolve(process.cwd(), 'manifesto.json'), 'utf8'));
const indice = readFileSync(resolve(process.cwd(), 'frontend/index.ts'), 'utf8');

test('Início: abas Hoje e Agenda, nesta ordem; Hoje é a primeira', () => {
  assert.deepEqual(ABAS_INICIO.map((a) => a.id), ['hoje', 'agenda']);
});

test('/agenda é apelido do Início na aba Agenda (D-82)', () => {
  assert.equal(APELIDOS_INICIO['/agenda'], 'agenda');
  assert.ok(ABAS_INICIO.some((a) => a.id === APELIDOS_INICIO['/agenda']));
  // A rota abre a mesma tela do Início, não a tela Agenda antiga.
  assert.match(indice, /'\/agenda': INICIO,/);
  assert.doesNotMatch(indice, /<pc-tela-agenda>/);
  // O Assistente segue apontando `/agenda`, agora com o nome da aba.
  assert.equal(telaBase('/agenda'), '/agenda');
  assert.equal(TELAS_APP['/agenda'].nome, 'Início › Agenda');
});

test('lembrete de visita abre o Início na aba Agenda', () => {
  assert.equal(ROTA_AGENDA, '?aba=agenda');
  assert.equal(manifesto.eventos.lembrete_visita.rota, ROTA_AGENDA);
  assert.equal(new URLSearchParams(ROTA_AGENDA).get('aba'), APELIDOS_INICIO['/agenda']);
});
