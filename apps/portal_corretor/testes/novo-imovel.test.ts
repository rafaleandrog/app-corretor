import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { rotas } from '../backend/rotas';
import {
  caracteristicasDasFotos,
  indicePasso,
  juntarCaracteristicas,
  obrigatoriosVazios,
  PASSOS_NOVO_IMOVEL,
  passoParaRetomar,
  passoSemRascunho,
  passoValido,
} from '../comum/imoveis';
import { PASSOS_INICIAIS } from '../comum/hoje';
import { TELAS_APP, telaBase } from '../comum/assistente';
import { destinoDeCriar } from '../frontend/criar';
import { resolverEndereco } from '../frontend/enderecos';
import { BancoFalso, comServidor, type Ator } from './apoio';

// Novo imóvel em 4 passos (B5 parte 2, issue #94: P07 e M3). A tela usa só as rotas de sempre; aqui se
// conferem as regras puras dos passos, o endereço, o caminho de rascunho que a tela percorre e o
// isolamento entre contas pela URL.

const UNICOS = { contatos: ['telefone'], imoveis: ['codigo'], empreendimentos: ['nome'], visitas: ['atividade_id'], etapas_funil: ['pipeline+nome'] };
const A: Ator = { usuario: 1, conta: 100, papeis: ['corretor'] };
const B: Ator = { usuario: 2, conta: 200, papeis: ['corretor'] };
const HOJE = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
const dia = (delta: number) => new Date(Date.now() + delta * 86400e3).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
const raiz = (f: string) => readFileSync(resolve(process.cwd(), f), 'utf8');

test('passos: Fotos · Dados · Autorização · Onde aparece, nesta ordem; ?passo= só aceita os quatro', () => {
  assert.deepEqual(
    PASSOS_NOVO_IMOVEL.map((p) => p.rotulo),
    ['Fotos', 'Dados', 'Autorização', 'Onde aparece'],
  );
  assert.equal(indicePasso('autorizacao'), 2);
  assert.equal(passoValido('dados'), 'dados');
  assert.equal(passoValido('creci'), null);
  assert.equal(passoValido(null), null);
  // Sem rascunho, a URL não leva a Autorização nem a Onde aparece: abre em Dados (como o clique no passo).
  assert.equal(passoSemRascunho(null), 'fotos');
  assert.equal(passoSemRascunho('fotos'), 'fotos');
  assert.equal(passoSemRascunho('dados'), 'dados');
  assert.equal(passoSemRascunho('autorizacao'), 'dados');
  assert.equal(passoSemRascunho('onde'), 'dados');
});

test('obrigatórios do passo Dados: só tipo e cidade, nenhum é CRECI (D-93)', () => {
  assert.deepEqual(obrigatoriosVazios({}), ['Tipo', 'Cidade']);
  assert.deepEqual(obrigatoriosVazios({ tipo: 'casa', cidade: '  ' }), ['Cidade']);
  assert.deepEqual(obrigatoriosVazios({ tipo: 'casa', cidade: 'Brasília' }), []);
});

test('o que a leitura das fotos preenche: só as características que o ambiente mostra, sem repetir', () => {
  assert.deepEqual(caracteristicasDasFotos(['fachada', 'varanda', 'sala', 'area_lazer', 'varanda', null, 'garagem']), ['varanda', 'área de lazer', 'garagem']);
  assert.deepEqual(caracteristicasDasFotos(['quarto', 'cozinha']), [], 'quartos e cômodos não se deduzem de foto');
  assert.equal(juntarCaracteristicas('Piscina, Varanda', ['varanda', 'vista']), 'Piscina, Varanda, vista');
  assert.equal(juntarCaracteristicas(null, ['vista']), 'vista');
  assert.equal(juntarCaracteristicas('piscina', []), 'piscina');
});

test('rascunho retoma no primeiro passo com o que fazer', () => {
  const dados = { tipo: 'casa', cidade: 'Brasília' };
  assert.equal(passoParaRetomar({ fotos: 0, dados, autorizacoes: 0 }), 'fotos');
  assert.equal(passoParaRetomar({ fotos: 3, dados: { tipo: 'casa' }, autorizacoes: 0 }), 'dados');
  assert.equal(passoParaRetomar({ fotos: 3, dados, autorizacoes: 0 }), 'autorizacao');
  assert.equal(passoParaRetomar({ fotos: 3, dados, autorizacoes: 1 }), 'onde');
});

test('/imoveis/novo abre o Novo imóvel; o Criar, o [Novo] e o primeiro passo de Hoje levam a ele', () => {
  assert.deepEqual(resolverEndereco('/imoveis/novo'), { chave: 'novo_imovel' });
  assert.deepEqual(resolverEndereco('/imoveis/7'), { chave: 'imovel', param: '7' }, 'a ficha continua');
  assert.equal(destinoDeCriar('imovel', '/clientes'), '/imoveis/novo');
  assert.equal(PASSOS_INICIAIS.find((p) => p.id === 'imovel')!.rota, '/imoveis/novo');
  assert.equal(telaBase('/imoveis/novo'), '/imoveis/novo');
  assert.equal(TELAS_APP['/imoveis/novo'].doc, 'imoveis');
  assert.match(raiz('frontend/index.ts'), /novo_imovel: \{ titulo: 'Novo imóvel', papel: 'corretor', moldura: true, render: \(_p, app\) => renderNovoImovel/);
  assert.match(raiz('frontend/telas/imoveis.ts'), /urbiVerso\.navegarSub\('\/imoveis\/novo'\)/);
  // A ficha de um rascunho oferece continuar o cadastro de onde parou.
  assert.match(raiz('frontend/telas/ficha-imovel.ts'), /im\.situacao === 'rascunho'[\s\S]{0,200}\/imoveis\/novo\?item=\$\{im\.id\}[\s\S]{0,80}Continuar cadastro/);
  const tela = raiz('frontend/telas/novo-imovel.ts');
  // Nenhum passo pede CRECI (D-93): a tela não lê nem trava por ele.
  assert.doesNotMatch(tela, /sem_creci|CRECI_AUSENTE|avisoCreci/);
  // Sem CSS próprio: só primitivos e a moldura.
  assert.doesNotMatch(tela, /static styles|<style|style=/);
  for (const t of ['Passo ${i + 1} de ${PASSOS_NOVO_IMOVEL.length}', 'Tirar fotos ou escolher da galeria', 'Salvar rascunho', 'Capa sugerida', 'preenchido pela IA', 'Qualidade agora · ']) {
    assert.ok(tela.includes(t), t);
  }
});

test('M3 (celular), passo 1: fotos, grade, "A IA já entendeu", "Ditar o resto", rodapé; a P07 (computador) fica como era', () => {
  const tela = raiz('frontend/telas/novo-imovel.ts');
  const corte = (de: string, ate: string) => {
    const i = tela.indexOf(de);
    const j = tela.indexOf(ate, i + de.length);
    assert.ok(i >= 0 && j > i, de);
    return tela.slice(i, j);
  };
  const fotos = corte('  private fotos() {', '  private dados() {');
  const ordem = ['urbi-seletor-arquivo', '<urbi-grid min=', '${celular ? this.entendeu() : nothing}', '${celular ? this.ditar() : nothing}'].map((t) => fotos.indexOf(t));
  assert.ok(ordem.every((n) => n >= 0), 'os quatro blocos estão no passo 1');
  assert.deepEqual([...ordem].sort((a, b) => a - b), ordem, 'celular: seletor, grade, A IA já entendeu, Ditar o resto');
  // Computador (P07): o banner continua antes da grade e o ditado fica em Dados.
  assert.ok(fotos.indexOf('${celular ? nothing : this.entendeu()}') < fotos.indexOf('<urbi-grid min='), 'P07: banner antes da grade');
  assert.match(corte('  private dados() {', '  private autorizacao() {'), /\$\{noCelular\(\) \? nothing : this\.ditar\(\)\}/, 'P07: Ditar fica em Dados; no celular sai de lá');
  // Rodapé: "Continuar" no celular, "Próximo: …" no computador.
  assert.match(tela, /noCelular\(\) \? 'Continuar' : `Próximo: \$\{PASSOS_NOVO_IMOVEL\[i \+ 1\]\.rotulo\.toLowerCase\(\)\}`/);
});

test('o caminho da tela: rascunho na primeira foto, dados salvos por passo, autorização opcional, público só com ela', async () => {
  const banco = new BancoFalso(UNICOS);
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    // Passo 1: sem rascunho, a rota pede tipo e cidade; com eles, a primeira foto cria o rascunho. Conta sem CRECI não trava nada.
    const vazio = { tipo: '', titulo: '', bairro: '', cidade: '', uf: '', quartos: null, preco: null, caracteristicas: '' };
    assert.equal((await chamar('POST', '/imoveis', vazio)).status, 422, 'por isso o passo Fotos pede tipo e cidade antes');
    const criado = await chamar('POST', '/imoveis', { ...vazio, tipo: 'casa', cidade: 'Brasília' });
    assert.equal(criado.status, 201);
    assert.equal(criado.corpo.situacao, 'rascunho');
    const id = criado.corpo.id;
    const f1 = (await chamar('POST', `/imoveis/${id}/midias`, { upload_id: 11, tipo: 'foto' })).corpo;
    const f2 = (await chamar('POST', `/imoveis/${id}/midias`, { upload_id: 12, tipo: 'foto' })).corpo;
    assert.equal((await chamar('PUT', `/imoveis/${id}/midias/ordem`, { ids: [f2.id, f1.id] })).status, 200, 'usar como capa');
    // Passo 2: os dados salvam ao sair do passo.
    const dados = { tipo: 'casa', titulo: '', bairro: 'Jardim Botânico', cidade: 'Brasília', uf: 'df', quartos: 4, suites: 2, banheiros: 3, vagas: 2, area_util_m2: 280, preco: 1450000, condominio: null, caracteristicas: 'piscina, varanda' };
    assert.equal((await chamar('PATCH', `/imoveis/${id}`, dados)).status, 200);
    // Retomar: o rascunho volta com tudo, e as fotos na ordem escolhida.
    const ficha = (await chamar('GET', `/imoveis/${id}`)).corpo;
    assert.equal(ficha.imovel.situacao, 'rascunho');
    assert.equal(ficha.imovel.uf, 'DF');
    assert.equal(ficha.imovel.preco_c, 145_000_000);
    assert.deepEqual(ficha.midias.map((m: any) => m.id), [f2.id, f1.id]);
    assert.equal(passoParaRetomar({ fotos: 2, dados: ficha.imovel, autorizacoes: ficha.autorizacoes.length }), 'autorizacao');
    // Passo 4 sem autorização: "público" é recusado pela rota, "só você" segue.
    const publico = await chamar('PATCH', `/imoveis/${id}`, { situacao: 'ativo', publicado_pagina: true });
    assert.equal(publico.status, 409);
    assert.equal(publico.corpo.codigo, 'SEM_AUTORIZACAO');
    // Passo 3: registrar, anexar o documento e marcar assinada.
    const dono = (await chamar('POST', '/contatos', { nome: 'Dono', telefone: '61944443333' })).corpo.id;
    const aut = (await chamar('POST', '/autorizacoes', { imovel_id: id, proprietario_id: dono, inicio: HOJE, fim: dia(180), comissao_pct: 6, preco_autorizado: 1450000 })).corpo;
    const doc = (await chamar('POST', `/imoveis/${id}/midias`, { upload_id: 13, tipo: 'documento' })).corpo;
    assert.equal(doc.publica, false, 'o documento nasce interno');
    assert.equal((await chamar('PATCH', `/autorizacoes/${aut.id}`, { documento_midia_id: doc.id, situacao: 'assinada' })).status, 200);
    // Agora "público" ativa e publica.
    const ok = await chamar('PATCH', `/imoveis/${id}`, { situacao: 'ativo', publicado_pagina: true });
    assert.equal(ok.status, 200);
    assert.equal(ok.corpo.situacao, 'ativo');
    assert.equal(ok.corpo.publicado_pagina, true);
  });
});

test('isolamento: B não abre nem continua o rascunho de A pela URL do Novo imóvel', async () => {
  const banco = new BancoFalso(UNICOS);
  const a: Record<string, number> = {};
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    a.imovel = (await chamar('POST', '/imoveis', { tipo: 'casa', cidade: 'Brasília' })).corpo.id;
    a.foto = (await chamar('POST', `/imoveis/${a.imovel}/midias`, { upload_id: 21, tipo: 'foto' })).corpo.id;
    a.dono = (await chamar('POST', '/contatos', { nome: 'Proprietário de A', telefone: '61933332222', papeis: 'proprietario' })).corpo.id;
    const meus = (await chamar('GET', '/contatos?papel=proprietario')).corpo.dados.map((c: any) => c.id);
    assert.ok(meus.includes(a.dono), 'A acha o próprio proprietário');
  });
  await comServidor(rotas, B, banco, {}, async (chamar) => {
    // A busca de proprietário do passo Autorização não traz ninguém de A.
    const donos = (await chamar('GET', '/contatos?papel=proprietario')).corpo;
    assert.ok(!donos.dados.some((c: any) => c.id === a.dono), 'B não vê o proprietário de A');
    assert.equal(donos.total, 0);
    // `/imoveis/novo?item=<id de A>`: tudo o que a tela chama responde "não encontrado".
    assert.equal((await chamar('GET', `/imoveis/${a.imovel}`)).status, 404);
    assert.equal((await chamar('GET', `/imoveis/${a.imovel}/contexto`)).status, 404);
    assert.equal((await chamar('PATCH', `/imoveis/${a.imovel}`, { cidade: 'Outra' })).status, 404);
    assert.equal((await chamar('POST', `/imoveis/${a.imovel}/midias`, { upload_id: 22, tipo: 'foto' })).status, 404);
    assert.equal((await chamar('PUT', `/imoveis/${a.imovel}/midias/ordem`, { ids: [a.foto] })).status, 404);
    assert.equal((await chamar('POST', `/imoveis/${a.imovel}/midias/ordem-sugerida`)).status, 404);
    assert.equal((await chamar('POST', `/imoveis/${a.imovel}/midias/${a.foto}/analisar`)).status, 404);
    assert.equal((await chamar('PATCH', `/imoveis/${a.imovel}/midias/${a.foto}/remover`)).status, 404);
    assert.equal((await chamar('POST', '/autorizacoes', { imovel_id: a.imovel, inicio: HOJE, fim: dia(1), comissao_pct: 1, preco_autorizado: 1 })).status, 422);
  });
  const im = banco.linhas('imoveis').find((x) => x.id === a.imovel)!;
  assert.equal(im.cidade, 'Brasília', 'nada de B chegou ao rascunho de A');
  assert.equal(banco.linhas('imovel_midias').filter((m) => m.imovel_id === a.imovel).length, 1);
});
