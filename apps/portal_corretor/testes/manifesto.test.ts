import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';

// O `pnpm test` roda na pasta da app (a CI usa `pnpm -r run test`, que entra em cada pacote).
const pasta = process.cwd();
const ler = (caminho: string) => JSON.parse(readFileSync(resolve(pasta, caminho), 'utf8'));
const manifesto = ler('manifesto.json');
const sdk = ler('node_modules/@urbiverso/sdk/package.json');

test('identidade aponta este repositório e o appId da pasta', () => {
  assert.equal(basename(pasta), 'portal_corretor');
  assert.equal(manifesto.identidade, 'rafaleandrog/app-corretor::portal_corretor');
});

test('pisos copiados do SDK instalado (KIT.md: copie, não chute)', () => {
  assert.equal(manifesto.sdk_min, Number(sdk.version.split('.')[0]));
  assert.equal(manifesto.shell_min, sdk.urbiverso.shell);
});

test('versão do manifesto e do package.json andam juntas', () => {
  assert.equal(ler('package.json').version, manifesto.versao);
});
