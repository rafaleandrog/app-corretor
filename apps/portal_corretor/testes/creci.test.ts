import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rotas } from '../backend/rotas';
import { http, publicar } from '../backend/instagram';
import { AVISO_CRECI, AVISO_FORMATO_CRECI, LIMITE_CRECI } from '../comum/conta';
import { AVISO_CRECI_NAO_COUBE, checarPeca, LIMITE_LEGENDA, legendaComCreci } from '../comum/estudio';
import { BancoFalso, comServidor, type Ator } from './apoio';

// D-93: o CRECI é dado opcional do perfil e nunca bloqueia nada. Sem ele, cada ação segue; com ele,
// ele aparece na legenda, na vitrine pública (página, seleção, portal) e no rodapé da arte.

const UNICOS = {
  contatos: ['telefone'],
  imoveis: ['codigo'],
  perfis_corretor: ['usuario_id'],
  visitas: ['atividade_id'],
  etapas_funil: ['pipeline+nome'],
  origens: ['canal+campanha'],
  vitrine_publica: ['tipo+chave'],
  paginas_corretor: ['chave'],
  selecao_itens: ['selecao_id+imovel_id'],
};
const HOJE = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
const dia = (delta: number) => new Date(Date.now() + delta * 86400e3).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
const arquivos = { url: async (id: number) => `/api/arquivos/${id}?token=x` };
const parametros = { obter: async (slug: string) => ({ meta_app_id: '123456', meta_app_secret: 'segredo-do-app' } as Record<string, string>)[slug] ?? null };
publicar.esperaMs = 0;

/** Shell falso: ingressos de entrada (página, seleção, portal) e o endereço da app. */
function shellFalso() {
  const ingressos = new Map<string, { id: number; webhook: string; contexto: any; ativo: boolean }>();
  let n = 0;
  return {
    urlApp: (sub: string) => `https://corretor.exemplo/portal_corretor${sub}`,
    gerarIngressoWh: async ({ webhook, contexto, expira_em }: { webhook: string; contexto: any; expira_em?: Date }) => {
      n++;
      const token = `wh_${webhook}_${n}x`;
      ingressos.set(token, { id: n, webhook, contexto, ativo: true });
      return { url: `https://corretor.exemplo/api/wh/portal_corretor/${token}`, token, ingresso_id: n, expira_em: expira_em ? expira_em.toISOString() : null };
    },
    inspecionarIngressoWh: async ({ token }: { token: string }) => {
      const i = ingressos.get(token);
      if (!i || !i.ativo) throw Object.assign(new Error('inválido'), { codigo: 'WH_INGRESSO_INVALIDO' });
      return { ingresso_id: i.id, contexto: i.contexto, expira_em: null, contador_usos: 0 };
    },
    revogarIngressoWh: async ({ ingresso_id }: { ingresso_id: number }) => {
      for (const i of ingressos.values()) if (i.id === ingresso_id) i.ativo = false;
      return { revogado: true };
    },
  };
}

/** Instagram falso: responde como a Graph API e grava as legendas enviadas. */
function metaFalsa() {
  const legendas: (string | null)[] = [];
  let seq = 0;
  http.fetch = async (url: string, init?: RequestInit) => {
    const ok = (dados: unknown) => new Response(JSON.stringify(dados), { status: 200, headers: { 'Content-Type': 'application/json' } });
    if (url.startsWith('https://api.instagram.com/oauth/access_token')) return ok({ access_token: 'curto', user_id: 999 });
    if (url.includes('grant_type=ig_exchange_token')) return ok({ access_token: 'longo-1', expires_in: 5184000 });
    if (url.includes('/me?')) return ok({ user_id: '17841400000000001', username: 'joao.corretor', account_type: 'BUSINESS' });
    if (url.endsWith('/media')) {
      legendas.push(new URLSearchParams(typeof init?.body === 'string' ? init.body : '').get('caption'));
      return ok({ id: `c${++seq}` });
    }
    if (url.includes('fields=status_code')) return ok({ status_code: 'FINISHED' });
    if (url.endsWith('/media_publish')) return ok({ id: 'm1' });
    if (url.includes('fields=permalink')) return ok({ permalink: 'https://www.instagram.com/p/abc/' });
    return new Response(JSON.stringify({ error: { message: 'inesperado', code: 1 } }), { status: 400 });
  };
  return legendas;
}

function eventosFalsos() {
  const agendados: { tipo: string; payload: any }[] = [];
  return { agendados, agendar: async (tipo: string, payload: any) => (agendados.push({ tipo, payload }), { id: agendados.length }), cancelarAgendamento: async () => true };
}

type Chamar = (m: string, c: string, b?: unknown) => Promise<{ status: number; corpo: any }>;

const ator = (extras: Record<string, unknown> = {}): Ator => ({ usuario: 1, conta: 100, papeis: ['corretor'], extras: { arquivos, parametros, ...extras } });

/** Imóvel anunciado: foto pública, autorização assinada e vigente. */
async function imovelAnunciado(chamar: Chamar, telefoneDono = '61933330001') {
  const im = (await chamar('POST', '/imoveis', { tipo: 'apartamento', cidade: 'Brasília', bairro: 'Noroeste', titulo: 'Apto no Noroeste' })).corpo;
  await chamar('PATCH', `/imoveis/${im.id}`, { preco: 990000, quartos: 3, banheiros: 2, area_util_m2: 90 });
  const dono = (await chamar('POST', '/contatos', { nome: 'Dono Proprietário', telefone: telefoneDono })).corpo;
  const aut = (await chamar('POST', '/autorizacoes', { imovel_id: im.id, proprietario_id: dono.id, inicio: HOJE, fim: dia(60), comissao_pct: '5', preco_autorizado: '990.000' })).corpo;
  await chamar('POST', `/imoveis/${im.id}/midias`, { upload_id: 701, tipo: 'foto' });
  const doc = (await chamar('POST', `/imoveis/${im.id}/midias`, { upload_id: 702, tipo: 'documento' })).corpo;
  await chamar('PATCH', `/autorizacoes/${aut.id}`, { documento_midia_id: doc.id, situacao: 'assinada' });
  const r = await chamar('PATCH', `/imoveis/${im.id}`, { situacao: 'ativo', publicado_pagina: true });
  assert.equal(r.status, 200, JSON.stringify(r.corpo));
  return im;
}

/** Peça institucional com arte, aprovada. */
async function pecaAprovada(chamar: Chamar) {
  const p = (await chamar('POST', '/estudio/pedido', { pedido: 'Post institucional', formatos: ['post_1x1'] })).corpo.pecas[0];
  await chamar('PUT', `/estudio/pecas/${p.id}/arquivos`, { upload_ids: [11], motor: 'canva_ia' });
  const ok = await chamar('POST', `/estudio/pecas/${p.id}/aprovar`);
  assert.equal(ok.status, 200, JSON.stringify(ok.corpo));
  return ok.corpo;
}

test('CRECI: regras puras — aviso único, legenda só se couber, nunca pendência', () => {
  assert.equal(AVISO_CRECI, 'Adicione seu CRECI ao perfil para que ele apareça nos anúncios');
  const base = { formato: 'post_1x1', legenda: 'Oi', hashtags: null, arquivos: 1, objetivo: 'institucional' };
  const sem = checarPeca(base, { creci: null, imovel: false, autorizacaoVigente: false });
  assert.deepEqual(sem, { ok: true, pendencias: [], avisos: [AVISO_CRECI] });
  // Cabe: entra no fim; não cabe: a legenda fica e volta o aviso.
  assert.deepEqual(legendaComCreci('Oi', '#casa', 'DF-1-F'), { legenda: 'Oi\n\nCRECI DF-1-F', aviso: null });
  assert.deepEqual(legendaComCreci('Oi CRECI DF-1-F', null, 'DF-1-F'), { legenda: 'Oi CRECI DF-1-F', aviso: null }, 'já citado não repete');
  assert.deepEqual(legendaComCreci(null, null, null), { legenda: '', aviso: null });
  const noLimite = 'a'.repeat(LIMITE_LEGENDA - '#casa'.length - 2);
  const r = legendaComCreci(noLimite, '#casa', 'DF-1-F');
  assert.deepEqual(r, { legenda: noLimite, aviso: AVISO_CRECI_NAO_COUBE });
  assert.equal(checarPeca({ ...base, legenda: r.legenda, hashtags: '#casa' }, { creci: 'DF-1-F', imovel: false, autorizacaoVigente: false }).ok, true, 'no limite, sem o CRECI, passa');
  // O aviso da tela usa o mesmo texto (uma função só, `avisoCreci()` em frontend/visual.ts).
  const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const visual = readFileSync(resolve(app, 'frontend/visual.ts'), 'utf8');
  assert.match(visual, /export function avisoCreci\(\)/);
  assert.match(visual, /\$\{AVISO_CRECI\}/);
  assert.match(visual, /href\('\/ajustes\/conta'\)/);
});

test('CRECI: nada no código lê a situação do CRECI nem mostra selo de verificação', () => {
  const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const arquivosTs = (pasta: string): string[] =>
    readdirSync(pasta).flatMap((n) => {
      const c = join(pasta, n);
      return statSync(c).isDirectory() ? arquivosTs(c) : c.endsWith('.ts') ? [c] : [];
    });
  for (const pasta of ['backend', 'comum', 'frontend']) {
    for (const arq of arquivosTs(resolve(app, pasta))) {
      if (arq.endsWith('ajuda-gerada.ts')) continue;
      const linhas = readFileSync(arq, 'utf8').split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l));
      const codigo = linhas.join('\n');
      assert.ok(!codigo.includes('creci_situacao'), `${arq} lê creci_situacao`);
      assert.ok(!/CRECI (não )?verificado|CRECI irregular/.test(codigo), `${arq} mostra selo do CRECI`);
    }
  }
});

test('sem CRECI: salva o perfil; fora do formato salva com aviso; só o absurdo é recusado', async () => {
  const banco = new BancoFalso(UNICOS);
  await comServidor(rotas, ator(), banco, shellFalso(), async (chamar) => {
    const so = await chamar('PUT', '/conta/meu-perfil', { telefone: '61999990000' });
    assert.equal(so.status, 200, JSON.stringify(so.corpo));
    assert.deepEqual([so.corpo.creci, so.corpo.avisos], [null, []]);
    const fora = await chamar('PUT', '/conta/meu-perfil', { creci: ' creci  df 12345 ', telefone: '61999990000' });
    assert.equal(fora.status, 200, JSON.stringify(fora.corpo));
    assert.deepEqual([fora.corpo.creci, fora.corpo.avisos], ['DF 12345', [AVISO_FORMATO_CRECI]]);
    assert.equal(banco.linhas('perfis_corretor')[0].creci, 'DF 12345', 'gravado como digitado, normalizado');
    const longo = await chamar('PUT', '/conta/meu-perfil', { creci: 'x'.repeat(LIMITE_CRECI + 1) });
    assert.equal(longo.status, 422);
    assert.equal(banco.linhas('perfis_corretor')[0].creci, 'DF 12345', 'o recusado não sobrescreve');
  });
});

test('sem CRECI: publica a página, e o editor só avisa', async () => {
  const banco = new BancoFalso(UNICOS);
  await comServidor(rotas, ator(), banco, shellFalso(), async (chamar) => {
    await imovelAnunciado(chamar);
    const inicial = (await chamar('GET', '/pagina')).corpo;
    assert.equal(inicial.sem_creci, true);
    assert.equal((await chamar('PUT', '/pagina', { ...inicial.pagina, endereco: 'joao-corretor', nome_exibicao: 'João' })).status, 200);
    const pub = await chamar('POST', '/pagina/publicar');
    assert.equal(pub.status, 200, JSON.stringify(pub.corpo));
    assert.equal(pub.corpo.imoveis_publicados, 1);
  });
  const pagina = banco.linhas('vitrine_publica').find((l) => l.tipo === 'pagina')!;
  assert.equal(pagina.dados.creci, null);
});

test('sem CRECI: aprova a peça, com o aviso e sem CRECI na legenda', async () => {
  const banco = new BancoFalso(UNICOS);
  await comServidor(rotas, ator(), banco, shellFalso(), async (chamar) => {
    const aprovada = await pecaAprovada(chamar);
    assert.equal(aprovada.estado, 'aprovada');
    assert.deepEqual(aprovada.avisos, [AVISO_CRECI]);
    assert.ok(!/CRECI/.test(aprovada.legenda ?? ''));
  });
});

test('sem CRECI: publica agora e agenda no Instagram', async () => {
  const banco = new BancoFalso(UNICOS);
  const legendas = metaFalsa();
  const ev = eventosFalsos();
  await comServidor(rotas, ator({ eventos: ev }), banco, shellFalso(), async (chamar) => {
    await chamar('POST', '/conexoes/instagram/retorno', { code: 'x' });
    const agora = await pecaAprovada(chamar);
    const pub = await chamar('POST', `/estudio/pecas/${agora.id}/publicar`);
    assert.equal(pub.status, 200, JSON.stringify(pub.corpo));
    assert.equal(banco.linhas('pecas').find((p) => p.id === agora.id)!.estado, 'publicada');
    assert.ok(legendas.length && !legendas.some((l) => /CRECI/.test(l ?? '')));
    const depois = await pecaAprovada(chamar);
    const ag = await chamar('POST', `/estudio/pecas/${depois.id}/agendar`, { quando: new Date(Date.now() + 2 * 3600e3).toISOString() });
    assert.equal(ag.status, 200, JSON.stringify(ag.corpo));
    assert.equal(banco.linhas('pecas').find((p) => p.id === depois.id)!.estado, 'agendada');
  });
});

test('sem CRECI: cria imóvel, e a nota não perde pontos', async () => {
  const banco = new BancoFalso(UNICOS);
  await comServidor(rotas, ator(), banco, shellFalso(), async (chamar) => {
    const im = await imovelAnunciado(chamar);
    const sem = (await chamar('GET', `/imoveis/${im.id}`)).corpo;
    assert.equal(sem.sem_creci, true);
    assert.ok(!sem.qualidade.faltas.some((f: string) => /CRECI/.test(f)), 'o CRECI não é item do que falta');
    await chamar('PUT', '/conta/meu-perfil', { creci: 'DF-12345-F' });
    const com = (await chamar('GET', `/imoveis/${im.id}`)).corpo;
    assert.equal(com.sem_creci, false);
    assert.equal(sem.qualidade.nota, com.qualidade.nota, 'mesma nota com e sem CRECI');
    const lista = (await chamar('GET', '/imoveis')).corpo.dados[0];
    assert.equal(lista.qualidade.nota, com.qualidade.nota);
  });
});

test('com CRECI: aparece na legenda, na página, na seleção, no portal e no rodapé da arte', async () => {
  const banco = new BancoFalso(UNICOS);
  const shell = shellFalso();
  await comServidor(rotas, ator(), banco, shell, async (chamar) => {
    await chamar('PUT', '/conta/meu-perfil', { creci: 'DF-12345-F', telefone: '61999990000' });
    const im = await imovelAnunciado(chamar);
    // Legenda e rodapé da arte (nome · CRECI · assinatura).
    const aprovada = await pecaAprovada(chamar);
    assert.match(aprovada.legenda, /CRECI DF-12345-F$/);
    assert.deepEqual(aprovada.avisos, []);
    await chamar('PUT', '/estudio/marca', { cor_primaria: '#112233', cor_secundaria: '#ffcc00', estilo: 'moderno', assinatura: 'Seu corretor no Noroeste' });
    const outra = (await chamar('POST', '/estudio/pedido', { pedido: 'Post institucional', formatos: ['post_1x1'] })).corpo.pecas[0];
    const prompt = (await chamar('GET', `/estudio/pecas/${outra.id}/instrucao`)).corpo.prompt;
    assert.match(prompt, /CRECI DF-12345-F · Seu corretor no Noroeste/);
    // Página, seleção e portal.
    const inicial = (await chamar('GET', '/pagina')).corpo;
    assert.equal(inicial.sem_creci, false);
    await chamar('PUT', '/pagina', { ...inicial.pagina, endereco: 'joao-corretor', nome_exibicao: 'João' });
    assert.equal((await chamar('POST', '/pagina/publicar')).status, 200);
    const cliente = (await chamar('POST', '/contatos', { nome: 'Paula Compradora', telefone: '61944440001' })).corpo;
    assert.equal((await chamar('POST', '/selecoes', { contato_id: cliente.id, imovel_ids: [im.id] })).status, 201);
    assert.equal((await chamar('POST', `/contatos/${cliente.id}/portal`)).status, 201);
  });
  const vitrine = banco.linhas('vitrine_publica');
  assert.equal(vitrine.find((l) => l.tipo === 'pagina')!.dados.creci, 'DF-12345-F');
  assert.equal(vitrine.find((l) => l.tipo === 'selecao')!.dados.corretor.creci, 'DF-12345-F');
  assert.equal(vitrine.find((l) => l.tipo === 'portal')!.dados.corretor.creci, 'DF-12345-F');
});

// A1/A2: o `sem_creci` da ficha, o da página e a frase do contexto da IA seguem uma regra só — o
// perfil do próprio usuário na conta de escrita, ou o jurídico dessa conta. Quem decide é sempre um
// atendente de várias contas (leitura do conjunto), onde o CRECI alheio estaria ao alcance.
test('sem_creci da ficha e da página, e a frase da IA: só o CRECI do próprio usuário ou o jurídico da conta de escrita', async () => {
  const atendente = (extras: Record<string, unknown> = {}): Ator => ({ usuario: 8, conta: 100, contas: [100, 200], papeis: ['corretor'], extras: { arquivos, parametros, ...extras } });
  const casos: { nome: string; preparar: (banco: BancoFalso) => Promise<void>; esperado: boolean }[] = [
    { nome: '(1) usuário sem CRECI, conta sem jurídico', preparar: async () => {}, esperado: true },
    {
      nome: '(2) usuário sem CRECI, conta com jurídico',
      preparar: async (banco) => {
        await comServidor(rotas, ator(), banco, shellFalso(), async (chamar) => {
          assert.equal((await chamar('PUT', '/conta/perfil', { nome: 'Imobiliária 100', creci_juridico: 'DF-900-J' })).status, 200);
        });
      },
      esperado: false,
    },
    {
      nome: '(3) usuário com CRECI',
      preparar: async (banco) => {
        await comServidor(rotas, atendente(), banco, shellFalso(), async (chamar) => {
          assert.equal((await chamar('PUT', '/conta/meu-perfil', { creci: 'DF-8-F' })).status, 200);
        });
      },
      esperado: false,
    },
    {
      nome: '(4) usuário sem CRECI, conta sem jurídico, CRECI de outro corretor e de outra conta no banco',
      preparar: async (banco) => {
        // Outro corretor na mesma conta.
        await comServidor(rotas, ator(), banco, shellFalso(), async (chamar) => {
          assert.equal((await chamar('PUT', '/conta/meu-perfil', { creci: 'DF-1-F' })).status, 200);
        });
        // Outro corretor e jurídico em outra conta.
        await comServidor(rotas, { usuario: 2, conta: 200, papeis: ['corretor'] }, banco, shellFalso(), async (chamar) => {
          assert.equal((await chamar('PUT', '/conta/meu-perfil', { creci: 'DF-2-F' })).status, 200);
          assert.equal((await chamar('PUT', '/conta/perfil', { nome: 'Imobiliária 200', creci_juridico: 'DF-200-J' })).status, 200);
        });
        // O próprio usuário, mas na outra conta.
        await comServidor(rotas, { ...atendente(), conta: 200 }, banco, shellFalso(), async (chamar) => {
          assert.equal((await chamar('PUT', '/conta/meu-perfil', { creci: 'DF-8-F' })).status, 200);
        });
        assert.equal(banco.linhas('perfis_corretor').filter((l) => l.creci).length, 3);
      },
      esperado: true,
    },
  ];
  for (const caso of casos) {
    const banco = new BancoFalso(UNICOS);
    await caso.preparar(banco);
    const contextos: string[] = [];
    const ia = {
      estadoSlot: async () => ({ efetivo: true }),
      consultar: async (o: { contexto: string }) => (contextos.push(o.contexto), { dados: { apresentacao: 'Oi', sobre: 'Sobre' } }),
    };
    await comServidor(rotas, atendente({ ia }), banco, shellFalso(), async (chamar) => {
      const im = (await chamar('POST', '/imoveis', { tipo: 'apartamento', cidade: 'Brasília', bairro: 'Noroeste', titulo: 'Apto' })).corpo;
      const ficha = await chamar('GET', `/imoveis/${im.id}`);
      assert.equal(ficha.status, 200, JSON.stringify(ficha.corpo));
      assert.equal(ficha.corpo.sem_creci, caso.esperado, `ficha ${caso.nome}`);
      const pagina = await chamar('GET', '/pagina');
      assert.equal(pagina.status, 200, JSON.stringify(pagina.corpo));
      assert.equal(pagina.corpo.sem_creci, caso.esperado, `página ${caso.nome}`);
      assert.equal((await chamar('POST', '/pagina/sugerir-textos', {})).status, 200);
    });
    assert.equal(contextos.length, 1);
    assert.equal(contextos[0].includes('Tem CRECI cadastrado.'), !caso.esperado, `contexto da IA ${caso.nome}`);
  }
});
