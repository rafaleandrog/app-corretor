import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rotas, rotasPublicas } from '../backend/rotas';
import { estudioRotas } from '../backend/estudio';
import { BancoFalso, comServidor, type Ator } from './apoio';

// Marca única (bloco 7, D-85): a cor principal e a foto de Ajustes › Marca valem na página pública,
// na seleção e no portal, e salvar a marca atualiza o que está no ar sem republicar à mão.

const UNICOS = {
  contatos: ['telefone'],
  imoveis: ['codigo'],
  vitrine_publica: ['tipo+chave'],
  selecao_itens: ['selecao_id+imovel_id'],
  paginas_corretor: ['chave'],
  marca_conta: ['chave'],
  marca_arquivos: ['tipo'],
};
const arquivos = { url: async (arquivo: number) => `/arquivo/${arquivo}` };
const A: Ator = { usuario: 1, conta: 100, papeis: ['corretor'], extras: { arquivos } };
const B: Ator = { usuario: 2, conta: 200, papeis: ['corretor'], extras: { arquivos } };
/** Atende a conta de A e a dela (300), escrevendo na 300. */
const C: Ator = { usuario: 3, conta: 300, contas: [100, 300], papeis: ['corretor'], extras: { arquivos } };
const VISITANTE: Ator = { usuario: 0, conta: null, papeis: [], extras: { arquivos } };
const HOJE = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
const dia = (delta: number) => new Date(Date.now() + delta * 86400e3).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
const PADRAO = '#0b5394';

type Chamar = (m: string, c: string, b?: unknown) => Promise<{ status: number; corpo: any }>;

function shellFalso() {
  const ingressos = new Map<string, { id: number; webhook: string; contexto: any }>();
  let n = 0;
  return {
    gerarIngressoWh: async ({ webhook, contexto }: { webhook: string; contexto: any }) => {
      n++;
      const token = `wh_${webhook}_${n}x`;
      ingressos.set(token, { id: n, webhook, contexto });
      return { url: `https://corretor.exemplo/api/wh/portal_corretor/${token}`, token, ingresso_id: n, expira_em: null };
    },
    inspecionarIngressoWh: async ({ webhook, token }: { webhook: string; token: string }) => {
      const i = ingressos.get(token);
      if (!i || i.webhook !== webhook) throw Object.assign(new Error('inválido'), { codigo: 'WH_INGRESSO_INVALIDO' });
      return { ingresso_id: i.id, contexto: i.contexto, expira_em: null, contador_usos: 0 };
    },
    revogarIngressoWh: async () => ({ revogado: true }),
  };
}
const tokenDe = (link: string) => new URL(link).searchParams.get('t')!;

/** Página no ar com um imóvel anunciado, uma seleção e o portal de um cliente. */
async function contaNoAr(chamar: Chamar, telefone: string) {
  const im = (await chamar('POST', '/imoveis', { tipo: 'casa', cidade: 'Brasília', bairro: 'Lago Norte', titulo: 'Casa', endereco: 'SHIN QI 1', endereco_publico: 'bairro' })).corpo;
  await chamar('PATCH', `/imoveis/${im.id}`, { preco: 900000 });
  const dono = (await chamar('POST', '/contatos', { nome: 'Dono', telefone: `${telefone}1` })).corpo;
  const aut = (await chamar('POST', '/autorizacoes', { imovel_id: im.id, proprietario_id: dono.id, inicio: HOJE, fim: dia(60), comissao_pct: '5', preco_autorizado: '900.000' })).corpo;
  await chamar('POST', `/imoveis/${im.id}/midias`, { upload_id: 701, tipo: 'foto' });
  const doc = (await chamar('POST', `/imoveis/${im.id}/midias`, { upload_id: 702, tipo: 'documento' })).corpo;
  await chamar('PATCH', `/autorizacoes/${aut.id}`, { documento_midia_id: doc.id, situacao: 'assinada' });
  await chamar('PATCH', `/imoveis/${im.id}`, { situacao: 'ativo', publicado_pagina: true });
  const p = (await chamar('GET', '/pagina')).corpo.pagina;
  assert.equal((await chamar('PUT', '/pagina', p)).status, 200);
  assert.equal((await chamar('POST', '/pagina/publicar')).status, 200);
  const cliente = (await chamar('POST', '/contatos', { nome: 'Cliente', telefone: `${telefone}2` })).corpo;
  const selecao = (await chamar('POST', '/selecoes', { contato_id: cliente.id, titulo: 'Casas', imovel_ids: [im.id] })).corpo.link as string;
  const portal = (await chamar('POST', `/contatos/${cliente.id}/portal`)).corpo.link as string;
  return { selecao, portal, endereco: p.endereco as string };
}

const vitrineDe = (banco: BancoFalso, conta: number, tipo: string) => banco.linhas('vitrine_publica').filter((l: any) => l.conta === conta && l.tipo === tipo);

test('marca única: a cor e a foto de Ajustes › Marca valem na página, na seleção e no portal, sem republicar', async () => {
  const banco = new BancoFalso(UNICOS);
  const shell = shellFalso();
  let deA = { selecao: '', portal: '', endereco: '' };
  await comServidor(rotas, A, banco, shell, async (chamar) => {
    deA = await contaNoAr(chamar, '6195550000');
    // Sem marca salva, tudo sai com a cor padrão e sem foto.
    assert.equal(vitrineDe(banco, 100, 'pagina')[0].dados.cor, PADRAO);
    assert.deepEqual([vitrineDe(banco, 100, 'selecao')[0].dados.corretor.cor, vitrineDe(banco, 100, 'selecao')[0].dados.corretor.foto], [PADRAO, null]);
    // A tela da página não oferece mais cor.
    const visao = (await chamar('GET', '/pagina')).corpo;
    assert.ok(!('temas' in visao) && !('tema' in visao.pagina));

    assert.equal((await chamar('PUT', '/estudio/marca', { cor_primaria: '#AA3300', cor_secundaria: '#ffcc00', estilo: 'classico' })).status, 200);
    assert.equal((await chamar('POST', '/estudio/marca/arquivos', { tipo: 'foto', upload_id: 950 })).status, 200);
  });
  // Salvar a marca já mudou o que está no ar: a página, a seleção e o portal.
  assert.equal(vitrineDe(banco, 100, 'pagina')[0].dados.cor, '#aa3300');
  for (const tipo of ['selecao', 'portal']) {
    const topo = vitrineDe(banco, 100, tipo)[0].dados.corretor;
    assert.deepEqual([topo.cor, topo.foto], ['#aa3300', 950], `${tipo} com a marca nova`);
    assert.ok(topo.nome, `${tipo} mantém o resto do topo`);
  }

  // B salva outra marca e publica: nada de B chega à vitrine de A, nem o contrário.
  let deB = { selecao: '', portal: '', endereco: '' };
  await comServidor(rotas, B, banco, shell, async (chamar) => {
    assert.equal((await chamar('GET', '/estudio/marca')).corpo.cor_primaria, PADRAO, 'marca de A não aparece para B');
    deB = await contaNoAr(chamar, '6196660000');
    await chamar('PUT', '/estudio/marca', { cor_primaria: '#00aa00', cor_secundaria: '#ffffff', estilo: 'moderno' });
    await chamar('POST', '/estudio/marca/arquivos', { tipo: 'foto', upload_id: 960 });
  });
  assert.equal(vitrineDe(banco, 100, 'pagina')[0].dados.cor, '#aa3300');
  assert.equal(vitrineDe(banco, 100, 'portal')[0].dados.corretor.foto, 950);
  assert.equal(vitrineDe(banco, 200, 'pagina')[0].dados.cor, '#00aa00');
  assert.deepEqual([vitrineDe(banco, 200, 'selecao')[0].dados.corretor.cor, vitrineDe(banco, 200, 'selecao')[0].dados.corretor.foto], ['#00aa00', 960]);

  // As páginas públicas: a foto vai como URL assinada, nunca como id de arquivo.
  await comServidor(rotasPublicas, VISITANTE, banco, shell, async (chamar) => {
    assert.equal((await chamar('GET', `/vitrine/pagina?c=${deA.endereco}`)).corpo.pagina.cor, '#aa3300');
    const s = (await chamar('GET', `/vitrine/selecao?t=${tokenDe(deA.selecao)}`)).corpo.selecao.corretor;
    assert.deepEqual([s.cor, s.foto_url, 'foto' in s], ['#aa3300', '/arquivo/950', false]);
    const p = (await chamar('GET', `/vitrine/portal?t=${tokenDe(deA.portal)}`)).corpo.portal.corretor;
    assert.deepEqual([p.cor, p.foto_url], ['#aa3300', '/arquivo/950']);
    const sb = (await chamar('GET', `/vitrine/selecao?t=${tokenDe(deB.selecao)}`)).corpo.selecao.corretor;
    assert.deepEqual([sb.cor, sb.foto_url], ['#00aa00', '/arquivo/960']);
  });

  // Quem atende a conta de A e a dela escreve na dela: vê o padrão, nunca a marca de A, e salvar
  // cria a marca da conta dela sem tocar a de A.
  await comServidor(rotas, C, banco, shell, async (chamar) => {
    const m = (await chamar('GET', '/estudio/marca')).corpo;
    assert.deepEqual([m.cor_primaria, m.salva, m.foto_url], [PADRAO, false, null]);
    assert.equal((await chamar('PUT', '/estudio/marca', { cor_primaria: '#222222', cor_secundaria: '#ffffff', estilo: 'moderno' })).status, 200);
    assert.equal((await chamar('POST', '/estudio/marca/arquivos', { tipo: 'foto', upload_id: 970 })).status, 200);
  });
  const marcas = banco.linhas('marca_conta').map((l: any) => [l.conta_id, l.cor_primaria]).sort();
  assert.deepEqual(marcas, [[100, '#aa3300'], [200, '#00aa00'], [300, '#222222']]);
  const fotos = banco.linhas('marca_arquivos').map((l: any) => [l.conta_id, l.arquivo]).sort();
  assert.deepEqual(fotos, [[100, 950], [200, 960], [300, 970]]);
  assert.equal(vitrineDe(banco, 100, 'selecao')[0].dados.corretor.cor, '#aa3300', 'a vitrine de A não mudou');
});

/**
 * Injeta falha no banco falso sem mexer nele: `pagina` derruba a republicação da página no ar (a
 * leitura da linha da página na vitrine, em `sincronizarTudo`); `vitrine` derruba a das seleções e
 * portais (`aplicarMarcaNaVitrine`).
 */
function comFalhas(banco: BancoFalso) {
  const estado: { falha: 'pagina' | 'vitrine' | null } = { falha: null };
  const original = banco.dados.bind(banco);
  banco.dados = (conta: number | null, global?: boolean) => {
    const h = original(conta, global);
    const varrer = h.varrerTudo;
    h.varrerTudo = async (tabela: string, op: any = {}) => {
      if (estado.falha === 'pagina' && tabela === 'vitrine_publica' && op.filtros?.tipo === 'pagina') throw new Error('falha simulada na página');
      if (estado.falha === 'vitrine' && tabela === 'vitrine_publica' && ['selecao', 'portal'].includes(op.filtros?.tipo)) throw new Error('falha simulada nas seleções');
      return varrer(tabela, op);
    };
    return h;
  };
  return estado;
}

const cores = (banco: BancoFalso, conta: number) => ({
  pagina: vitrineDe(banco, conta, 'pagina')[0]?.dados.cor,
  selecao: vitrineDe(banco, conta, 'selecao')[0].dados.corretor.cor,
  portal: vitrineDe(banco, conta, 'portal')[0].dados.corretor.cor,
});

test('marca: o que está no ar não acompanhou → a marca fica salva, a resposta avisa e "republicar" refaz as três superfícies', async () => {
  const banco = new BancoFalso(UNICOS);
  const falhas = comFalhas(banco);
  await comServidor(rotas, A, banco, shellFalso(), async (chamar) => {
    await contaNoAr(chamar, '6197770000');
    // (1) Tudo certo: sem aviso, as três superfícies com a cor nova.
    let r = await chamar('PUT', '/estudio/marca', { cor_primaria: '#111111', cor_secundaria: '#ffffff', estilo: 'moderno' });
    assert.deepEqual([r.status, r.corpo.vitrine_desatualizada], [200, false]);
    assert.deepEqual(cores(banco, 100), { pagina: '#111111', selecao: '#111111', portal: '#111111' });

    // (2) A republicação da página falha: a marca fica gravada, a resposta avisa.
    falhas.falha = 'pagina';
    r = await chamar('PUT', '/estudio/marca', { cor_primaria: '#222222', cor_secundaria: '#ffffff', estilo: 'moderno' });
    assert.deepEqual([r.status, r.corpo.vitrine_desatualizada, r.corpo.cor_primaria], [200, true, '#222222']);
    assert.equal(banco.linhas('marca_conta')[0].cor_primaria, '#222222');
    assert.equal(cores(banco, 100).pagina, '#111111', 'a página no ar ficou com a cor anterior');
    // (4) O conserto oferecido, com o banco bom: as três superfícies com a cor nova, sem aviso.
    falhas.falha = null;
    r = await chamar('POST', '/estudio/marca/republicar');
    assert.deepEqual([r.status, r.corpo.vitrine_desatualizada], [200, false]);
    assert.deepEqual(cores(banco, 100), { pagina: '#222222', selecao: '#222222', portal: '#222222' });

    // (3) Seleções e portais falham: a marca fica gravada, a resposta avisa.
    falhas.falha = 'vitrine';
    r = await chamar('PUT', '/estudio/marca', { cor_primaria: '#333333', cor_secundaria: '#ffffff', estilo: 'moderno' });
    assert.deepEqual([r.status, r.corpo.vitrine_desatualizada], [200, true]);
    assert.equal(banco.linhas('marca_conta')[0].cor_primaria, '#333333');
    assert.deepEqual(cores(banco, 100), { pagina: '#333333', selecao: '#222222', portal: '#222222' });
    // (4) O conserto refaz as seleções e os portais.
    falhas.falha = null;
    r = await chamar('POST', '/estudio/marca/republicar');
    assert.deepEqual([r.status, r.corpo.vitrine_desatualizada], [200, false]);
    assert.deepEqual(cores(banco, 100), { pagina: '#333333', selecao: '#333333', portal: '#333333' });
    // O conserto falhando de novo continua avisando.
    falhas.falha = 'vitrine';
    assert.equal((await chamar('POST', '/estudio/marca/republicar')).corpo.vitrine_desatualizada, true);
    falhas.falha = null;

    // (4) Com a página fora do ar o conserto também vale: refaz seleções e portais.
    assert.equal((await chamar('POST', '/pagina/despublicar')).status, 200);
    falhas.falha = 'vitrine';
    r = await chamar('PUT', '/estudio/marca', { cor_primaria: '#444444', cor_secundaria: '#ffffff', estilo: 'moderno' });
    assert.equal(r.corpo.vitrine_desatualizada, true);
    falhas.falha = null;
    r = await chamar('POST', '/estudio/marca/republicar');
    assert.deepEqual([r.status, r.corpo.vitrine_desatualizada], [200, false]);
    assert.deepEqual(cores(banco, 100), { pagina: undefined, selecao: '#444444', portal: '#444444' });
  });
  // A rota de conserto tem a mesma guarda das outras do Estúdio.
  await comServidor(rotas, { usuario: 9, conta: 100, papeis: ['cliente'] }, banco, shellFalso(), async (chamar) => {
    assert.equal((await chamar('POST', '/estudio/marca/republicar')).status, 403);
  });
});

test('marca: trocar a foto atualiza seleção e portal; falha ao republicar grava a foto e avisa', async () => {
  const banco = new BancoFalso(UNICOS);
  const falhas = comFalhas(banco);
  await comServidor(rotas, A, banco, shellFalso(), async (chamar) => {
    await contaNoAr(chamar, '6198880000');
    assert.equal((await chamar('POST', '/estudio/marca/arquivos', { tipo: 'foto', upload_id: 950 })).corpo.vitrine_desatualizada, false);
    // (5) Troca de foto (já existia: `atualizar`): seleção e portal com a foto nova.
    const r = await chamar('POST', '/estudio/marca/arquivos', { tipo: 'foto', upload_id: 951 });
    assert.deepEqual([r.status, r.corpo.vitrine_desatualizada], [200, false]);
    for (const tipo of ['selecao', 'portal']) assert.equal(vitrineDe(banco, 100, tipo)[0].dados.corretor.foto, 951, `${tipo} com a foto nova`);
    // (6) Falha ao republicar: o arquivo fica gravado e a resposta avisa.
    falhas.falha = 'vitrine';
    const f = await chamar('POST', '/estudio/marca/arquivos', { tipo: 'foto', upload_id: 952 });
    assert.deepEqual([f.status, f.corpo.vitrine_desatualizada, f.corpo.foto_url], [200, true, '/arquivo/952']);
    assert.deepEqual(banco.linhas('marca_arquivos').map((l: any) => l.arquivo), [952]);
    assert.equal(vitrineDe(banco, 100, 'selecao')[0].dados.corretor.foto, 951);
    falhas.falha = null;
    assert.equal((await chamar('POST', '/estudio/marca/republicar')).corpo.vitrine_desatualizada, false);
    for (const tipo of ['selecao', 'portal']) assert.equal(vitrineDe(banco, 100, tipo)[0].dados.corretor.foto, 952);
  });
});

test('marca: o CRECI vem da conta de escrita, nunca de outra que o usuário também atende', async () => {
  const banco = new BancoFalso(UNICOS);
  // A conta 100 primeiro: sem o filtro de conta, a leitura do conjunto devolveria o dela.
  banco.linhas('perfis_corretor').push({ id: 9001, conta_id: 100, usuario_id: 3, creci: 'CRECI-100' } as any, { id: 9002, conta_id: 300, usuario_id: 3, creci: 'CRECI-300' } as any);
  banco.linhas('perfil_conta').push({ id: 9003, conta_id: 100, chave: 'conta', creci_juridico: 'J-100' } as any, { id: 9004, conta_id: 300, chave: 'conta', creci_juridico: 'J-300' } as any);
  // Direto no router do Estúdio, sem o escopo de conta de `rotas` (escopo.ts): o filtro é da própria
  // leitura, não depende de quem monta o router.
  for (const router of [estudioRotas, rotas]) {
    await comServidor(router, C, banco, shellFalso(), async (chamar) => {
      assert.equal((await chamar('GET', '/estudio/marca')).corpo.creci, 'CRECI-300');
    });
  }
  await comServidor(rotas, C, banco, shellFalso(), async (chamar) => {
    assert.equal((await chamar('PUT', '/estudio/marca', { cor_primaria: '#222222', cor_secundaria: '#ffffff', estilo: 'moderno' })).corpo.creci, 'CRECI-300');
  });
  // Sem perfil próprio, vale o CRECI jurídico da conta de escrita, não o da outra.
  const D: Ator = { usuario: 4, conta: 300, contas: [100, 300], papeis: ['corretor'], extras: { arquivos } };
  for (const router of [estudioRotas, rotas]) {
    await comServidor(router, D, banco, shellFalso(), async (chamar) => {
      assert.equal((await chamar('GET', '/estudio/marca')).corpo.creci, 'J-300');
    });
  }
  // Só na conta 100, o mesmo usuário nunca vê o da 300.
  await comServidor(rotas, { usuario: 3, conta: 100, papeis: ['corretor'], extras: { arquivos } }, banco, shellFalso(), async (chamar) => {
    assert.equal((await chamar('GET', '/estudio/marca')).corpo.creci, 'CRECI-100');
  });
  await comServidor(rotas, { usuario: 4, conta: 100, papeis: ['corretor'], extras: { arquivos } }, banco, shellFalso(), async (chamar) => {
    assert.equal((await chamar('GET', '/estudio/marca')).corpo.creci, 'J-100');
  });
});
