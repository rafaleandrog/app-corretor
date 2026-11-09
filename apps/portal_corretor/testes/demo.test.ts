import { test } from 'node:test';
import assert from 'node:assert/strict';
import schema from '../schema.json';
import { rotas } from '../backend/rotas';
import { semear } from '../backend/semente';
import { proximoSabado10h } from '../backend/demo';
import { passoMaximo_c, validarMandato } from '../comum/negociacao';
import { zopa } from '../comum/negociador';
import { BancoFalso, comServidor, type Ator, type Unico } from './apoio';

// Semente de demonstração do Padrão B (E1, issue #107): o conjunto do guia (specs/telas_padrao_b.md
// §5) na conta principal, o conjunto menor do segundo corretor na outra, sem CRECI nada quebra.

const EM_ANDAMENTO = (schema.tabelas.negociacoes.unicos as unknown[]).find((u) => !Array.isArray(u)) as Exclude<Unico, string>;
const UNICOS: Record<string, Unico[]> = {
  contatos: ['telefone'], etapas_funil: ['pipeline+nome'], playbook_funil: ['etapa_id+temperatura'], imoveis: ['codigo'], visitas: ['atividade_id'],
  origens: ['canal+campanha'], negociacoes: [EM_ANDAMENTO, 'codigo'], mandatos_negociacao: ['negociacao_id+versao'], perfis_corretor: ['usuario_id'],
};
const A: Ator = { usuario: 1, conta: 100, papeis: ['corretor'] };
const B: Ator = { usuario: 2, conta: 200, papeis: ['corretor'] };

async function duasContasDemo() {
  const banco = new BancoFalso(UNICOS);
  // A ordem da lista não importa: a principal é a de menor id.
  await semear(banco.ctxSistema([{ id: 200, nome: 'Segundo Corretor (demo)' }, { id: 100, nome: 'Rafael Gualberto (demo)' }]));
  return banco;
}

test('boot marca a conta principal (menor id) e a de isolamento; a marca não muda depois', async () => {
  const banco = await duasContasDemo();
  const conjunto = (conta: number) => banco.linhas('perfil_conta').find((p) => p.conta_id === conta)!.demo_conjunto;
  assert.equal(conjunto(100), 'principal');
  assert.equal(conjunto(200), 'isolamento');
  // Uma conta de teste de id menor que aparece depois não rouba o conjunto de quem já tem.
  await semear(banco.ctxSistema([{ id: 50, nome: 'Nova (demo)' }, { id: 100, nome: 'Rafael Gualberto (demo)' }, { id: 200, nome: 'Segundo Corretor (demo)' }]));
  assert.equal(conjunto(100), 'principal');
  assert.equal(conjunto(200), 'isolamento');
  assert.equal(conjunto(50), 'principal');
});

test('conjunto do guia: clientes, temperaturas, imóveis, visita de sábado e a negociação do P15', async () => {
  const banco = await duasContasDemo();
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    const g = await chamar('POST', '/demo/semear', {});
    assert.equal(g.status, 201);
    assert.deepEqual(g.corpo, { contatos: 6, negocios: 6, imoveis: 4, negociacoes: 1, completado: ['Casa 4 quartos · Jardim Botânico: dados', 'Apartamento 3 quartos · Sudoeste: dados', 'Lote 450 m² · Reserva do Colorado Q1-03: dados', 'Estúdio: 2 peças', 'conversa de Ana Ribeiro'], avisos: [] });
    // Idempotente: a segunda vez não grava nada.
    assert.equal((await chamar('POST', '/demo/semear', {})).status, 409);
    const contatos = banco.linhas('contatos').filter((c) => c.conta_id === 100);
    assert.equal(contatos.length, 6);
    assert.equal(banco.linhas('negocios').filter((n) => n.conta_id === 100).length, 6);
    assert.equal(banco.linhas('negociacoes').filter((n) => n.conta_id === 100).length, 1);
    // As temperaturas saem da regra (não são gravadas à mão) e batem com o guia.
    const temperatura = Object.fromEntries(contatos.map((c) => [c.nome, c.temperatura]));
    assert.deepEqual(temperatura, {
      'Ana Ribeiro': 'quente', 'Juliana Prado': 'quente', 'Carlos Menezes': 'morno',
      'Fernanda Souza': 'morno', 'Roberto Lima': 'frio', 'Marcos Teixeira': 'frio',
    });
    assert.match(contatos.find((c) => c.nome === 'Roberto Lima')!.temperatura_motivo, /há 9 dias/);
    const origem = (nome: string) => banco.linhas('origens').find((o) => o.id === contatos.find((c) => c.nome === nome)!.origem_id)!.canal;
    assert.deepEqual(['Ana Ribeiro', 'Carlos Menezes', 'Fernanda Souza'].map(origem), ['instagram', 'pagina', 'indicacao']);
    // Imóveis: a nota de qualidade é a do cálculo real; sem `req.arquivos` (este teste) não há fotos
    // nem autorização (o teste "completa" abaixo cobre as duas).
    const lista = (await chamar('GET', '/imoveis?por_pagina=50')).corpo;
    const nota = Object.fromEntries(lista.dados.map((i: any) => [i.titulo, [i.preco_c, i.situacao, i.qualidade?.nota]]));
    assert.deepEqual(nota, {
      'Casa 4 quartos · Jardim Botânico': [145000000, 'ativo', 55],
      'Apartamento 3 quartos · Sudoeste': [98000000, 'ativo', 35],
      'Lote 450 m² · Reserva do Colorado Q1-03': [39500000, 'ativo', 55],
      'Cobertura 3 quartos · Noroeste': [210000000, 'rascunho', 35],
    });
    // A visita da Ana é no sábado, 10 h de Brasília.
    const visita = banco.linhas('atividades').find((a) => a.conta_id === 100 && a.status === 'pendente')!;
    const quando = new Date(visita.quando);
    assert.equal(quando.getUTCDay(), 6);
    assert.equal(quando.getUTCHours(), 13);
    // Negociação do P15: lista com última oferta × pedido (−9%), escada e mandato.
    const negs = (await chamar('GET', '/negociacoes')).corpo.dados;
    assert.equal(negs.length, 1);
    const n = negs[0];
    const anaId = contatos.find((c) => c.nome === 'Ana Ribeiro')!.id;
    assert.equal(n.contato_id, anaId);
    assert.deepEqual([n.estado, n.conduzida_por, n.rodadas, n.ultima_oferta_c, n.preco_pedido_c], ['ativa', 'ia', 2, 132000000, 145000000]);
    assert.equal(Math.round((n.ultima_oferta_c / n.preco_pedido_c - 1) * 100), -9);
    assert.ok(!('recuo_c' in n) && !JSON.stringify(n).includes('136000000'), 'a lista não leva o recuo');
    const detalhe = (await chamar('GET', `/negociacoes/${n.id}`)).corpo;
    const propostas = detalhe.propostas;
    // Escada do guia (P15, #189): comprador 1,30 mi → Negociador 1,40 mi → comprador 1,32 mi.
    assert.deepEqual(propostas.map((p: any) => [p.rodada, p.direcao, p.autor_tipo, p.valor_c]), [
      [1, 'comprador', 'cliente', 130000000], [1, 'vendedor', 'negociador_ia', 140000000], [2, 'comprador', 'cliente', 132000000],
    ]);
    const mandato = (await chamar('GET', `/negociacoes/${n.id}/mandato`)).corpo;
    const m = mandato.vigente;
    assert.deepEqual([m.preco_pedido_c, m.alvo_c, m.recuo_c, m.rodadas_max, m.autonomia], [145000000, 140000000, 136000000, 4, 'pergunta_antes']);
    // O mandato da semente passa na mesma validação da tela.
    assert.equal(validarMandato({ ...m }).ok, true);
    // KPIs da negociação, à mão: ZOPA de 1,36 mi (recuo) a 1,39 mi (teto estimado); concessão do
    // vendedor até aqui 50 mil (do pedido de 1,45 a 1,40); a próxima cabe em 40% de (1,40 − 1,36) = 16 mil.
    assert.deepEqual(zopa(m, banco.linhas('negociacoes').find((x) => x.id === n.id)!.teto_estimado_comprador_c), { existe: true, de_c: 136000000, ate_c: 139000000 });
    const posicaoVendedor = propostas.filter((p: any) => p.direcao === 'vendedor').at(-1).valor_c;
    assert.equal(passoMaximo_c(posicaoVendedor, m.recuo_c, Number(m.passo_max_pct)), 1600000);
    assert.equal(banco.linhas('objecoes_detectadas').filter((o) => o.negociacao_id === n.id)[0].categoria, 'preco');
    // CRECI fictício no perfil do corretor.
    assert.equal(banco.linhas('perfis_corretor').find((p) => p.usuario_id === 1)!.creci, 'DF-12345-F');
  });
});

test('segundo corretor: conjunto próprio e menor; nada de um aparece para o outro', async () => {
  const banco = await duasContasDemo();
  await comServidor(rotas, A, banco, {}, async (chamar) => assert.equal((await chamar('POST', '/demo/semear', {})).status, 201));
  const negA = banco.linhas('negociacoes').find((n) => n.conta_id === 100)!.id;
  const anaA = banco.linhas('contatos').find((c) => c.nome === 'Ana Ribeiro')!.id;
  await comServidor(rotas, B, banco, {}, async (chamar) => {
    const g = await chamar('POST', '/demo/semear', {});
    assert.equal(g.status, 201);
    assert.deepEqual(g.corpo, { contatos: 2, negocios: 2, imoveis: 1, negociacoes: 0, completado: ['Apartamento 2 quartos · Águas Claras: dados'], avisos: [] });
    const nomes = (await chamar('GET', '/contatos?por_pagina=50')).corpo.dados.map((c: any) => c.nome).sort();
    assert.deepEqual(nomes, ['Bruno Costa', 'Lívia Rocha']);
    assert.equal((await chamar('GET', '/negociacoes')).corpo.dados.length, 0);
    assert.equal((await chamar('GET', `/negociacoes/${negA}`)).status, 404);
    assert.equal((await chamar('GET', `/negociacoes/${negA}/mandato`)).status, 404);
    assert.equal((await chamar('GET', `/contatos/${anaA}`)).status, 404);
    const imoveis = (await chamar('GET', '/imoveis')).corpo;
    assert.deepEqual(imoveis.dados.map((i: any) => i.titulo), ['Apartamento 2 quartos · Águas Claras']);
    assert.equal((await chamar('GET', '/numeros?dias=30')).corpo.atual.leads, 2);
  });
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    const nomes = (await chamar('GET', '/contatos?por_pagina=50')).corpo.dados.map((c: any) => c.nome);
    assert.ok(!nomes.includes('Bruno Costa') && nomes.length === 6);
  });
});

test('sem CRECI: a semente não sobrescreve o perfil e tudo funciona (D-93)', async () => {
  const banco = await duasContasDemo();
  await comServidor(rotas, A, banco, {}, async (chamar) => {
    assert.equal((await chamar('PUT', '/conta/meu-perfil', { creci: '', telefone: '' })).status, 200);
    assert.equal((await chamar('POST', '/demo/semear', {})).status, 201);
    assert.equal(banco.linhas('perfis_corretor').find((p) => p.usuario_id === 1)!.creci ?? null, null, 'o perfil sem CRECI fica sem CRECI');
    const nid = banco.linhas('negociacoes').find((n) => n.conta_id === 100)!.id;
    for (const rota of ['/inicio', '/contatos', '/imoveis', '/negociacoes', `/negociacoes/${nid}`, `/negociacoes/${nid}/mandato`, '/numeros?dias=30']) {
      assert.equal((await chamar('GET', rota)).status, 200, rota);
    }
    // Registrar uma proposta também não pede CRECI.
    assert.equal((await chamar('POST', `/negociacoes/${nid}/propostas`, { direcao: 'comprador', valor_c: 133000000 })).status, 201);
  });
});

test('proximoSabado10h: hoje é sábado antes das 10 h, depois das 10 h e um dia qualquer', () => {
  assert.equal(proximoSabado10h(new Date('2026-10-31T12:00:00.000Z')), '2026-10-31T13:00:00.000Z');
  assert.equal(proximoSabado10h(new Date('2026-10-31T14:00:00.000Z')), '2026-11-07T13:00:00.000Z');
  assert.equal(proximoSabado10h(new Date('2026-10-28T09:00:00.000Z')), '2026-10-31T13:00:00.000Z');
});

// ---------- #189: a semente completa a demonstração do guia ----------

function helpers() {
  let uploads = 0;
  let ingressos = 0;
  const arquivos = {
    enviar: async (o: { tabela: string; coluna: string; mime: string; buffer: Buffer }) => {
      assert.ok(['imovel_midias', 'peca_arquivos'].includes(o.tabela));
      assert.ok(o.buffer.length > 100 && ['image/png', 'application/pdf'].includes(o.mime));
      return { upload_id: 9000 + ++uploads, expira_em: new Date(Date.now() + 600e3) };
    },
    url: async (id: number) => `/arquivo/${id}`,
  };
  const shell = {
    gerarIngressoWh: async ({ webhook, contexto }: { webhook: string; contexto: { conta_id: number } }) => {
      ingressos++;
      return { url: `https://corretor.exemplo/api/wh/portal_corretor/wh_${webhook}_${contexto.conta_id}_${ingressos}`, ingresso_id: ingressos, token: `tk${ingressos}`, expira_em: null };
    },
    revogarIngressoWh: async () => ({ ok: true }),
  };
  return { arquivos, shell };
}

test('#189: semente completa: fotos, autorização, página no ar, conversa, seleção e portal da Ana; idempotente', async () => {
  const banco = await duasContasDemo();
  const { arquivos, shell } = helpers();
  await comServidor(rotas, { ...A, extras: { arquivos } }, banco, shell, async (chamar) => {
    const g = await chamar('POST', '/demo/semear', {});
    assert.equal(g.status, 201);
    assert.ok(g.corpo.completado.includes('página publicada (usuario-1)'), JSON.stringify(g.corpo.completado));
    // Qualidade (cálculo real): casa 100, apartamento 80, lote 70, cobertura 35.
    const lista = (await chamar('GET', '/imoveis?por_pagina=50')).corpo.dados;
    assert.deepEqual(Object.fromEntries(lista.map((i: any) => [i.titulo, i.qualidade?.nota])), {
      'Casa 4 quartos · Jardim Botânico': 100, 'Apartamento 3 quartos · Sudoeste': 80, 'Lote 450 m² · Reserva do Colorado Q1-03': 70, 'Cobertura 3 quartos · Noroeste': 35,
    });
    const casa = lista.find((i: any) => i.titulo.startsWith('Casa'));
    const aut = banco.linhas('autorizacoes_venda').find((a) => a.imovel_id === casa.id)!;
    assert.deepEqual([aut.situacao, aut.exclusiva, !!aut.documento_midia_id], ['assinada', true, true]);
    const doc = banco.linhas('imovel_midias').find((m) => m.id === aut.documento_midia_id)!;
    assert.deepEqual([doc.tipo, doc.publica], ['documento', false], 'o documento da autorização nunca é público');
    // Página no ar com os três imóveis ativos; a cobertura (rascunho) fica fora.
    const pagina = (await chamar('GET', '/pagina')).corpo;
    assert.ok(pagina.pagina.publicada_em);
    assert.equal(pagina.marcados_para_pagina, 3);
    const naVitrine = banco.linhas('vitrine_publica').filter((l) => l.conta === 100 && l.tipo === 'imovel');
    assert.equal(naVitrine.length, 3);
    assert.ok(naVitrine.every((l) => !JSON.stringify(l.dados).includes('Helena')), 'proprietário nunca vai a público');
    // Seleção e portal da Ana; a conversa tem as mensagens de exemplo e os dois cartões.
    const ana = banco.linhas('contatos').find((c) => c.nome === 'Ana Ribeiro')!;
    const sel = (await chamar('GET', `/selecoes?contato_id=${ana.id}`)).corpo.dados;
    assert.equal(sel.length, 1);
    assert.equal(sel[0].itens.length, 3);
    assert.equal((await chamar('GET', `/contatos/${ana.id}/portal`)).corpo.ativo, true);
    const msgs = banco.linhas('mensagens').filter((m) => m.contato_id === ana.id).map((m) => m.tipo);
    assert.deepEqual(msgs, ['texto', 'texto', 'texto', 'texto', 'selecao', 'link_portal']);
    const portal = banco.linhas('vitrine_publica').find((l) => l.tipo === 'portal' && l.chave === `100:${ana.id}`)!;
    assert.equal(portal.dados.selecoes.length, 1);
    assert.deepEqual(portal.dados.negociacoes[0].propostas.map((p: any) => [p.quem, p.valor_c]), [['voce', 130000000], ['vendedor', 140000000], ['voce', 132000000]]);
    // De novo: nada a completar, nada duplicado.
    assert.equal((await chamar('POST', '/demo/semear', {})).status, 409);
    assert.equal(banco.linhas('selecoes').length, 1);
    assert.equal(banco.linhas('autorizacoes_venda').filter((a) => a.conta_id === 100).length, 3);
  });
});

test('#189: conta que já gerou e publicou a página à mão: completa sem trocar o endereço e troca a escada antiga', async () => {
  const banco = await duasContasDemo();
  const { arquivos, shell } = helpers();
  // A geração antiga (sem arquivos nem shell) e a página publicada à mão com outro endereço.
  await comServidor(rotas, A, banco, shell, async (chamar) => {
    assert.equal((await chamar('POST', '/demo/semear', {})).status, 201);
    const p = (await chamar('GET', '/pagina')).corpo.pagina;
    assert.equal((await chamar('PUT', '/pagina', { ...p, endereco: 'corretor-a-demo' })).status, 200);
    assert.equal((await chamar('POST', '/pagina/publicar')).status, 200);
  });
  // A escada como a semente gravava até a 0.1.49.
  const neg = banco.linhas('negociacoes').find((n) => n.conta_id === 100)!;
  const tabela = banco.linhas('propostas');
  for (const p of tabela.filter((x) => x.negociacao_id === neg.id)) tabela.splice(tabela.indexOf(p), 1);
  let pid = 5000;
  for (const [rodada, direcao, valor_c] of [[1, 'vendedor', 145000000], [1, 'comprador', 132000000], [1, 'vendedor', 140000000], [2, 'comprador', 132000000]] as const) {
    tabela.push({ id: ++pid, conta_id: 100, negociacao_id: neg.id, rodada, direcao, valor_c, autor_tipo: direcao === 'vendedor' ? 'corretor' : 'cliente', canal: 'registro', estado: 'registrada' });
  }
  await comServidor(rotas, { ...A, extras: { arquivos } }, banco, shell, async (chamar) => {
    const g = await chamar('POST', '/demo/semear', {});
    assert.equal(g.status, 200);
    assert.ok(g.corpo.completado.some((f: string) => f.startsWith('escada')), JSON.stringify(g.corpo.completado));
    const pagina = (await chamar('GET', '/pagina')).corpo;
    assert.equal(pagina.pagina.endereco, 'corretor-a-demo');
    assert.equal(banco.linhas('vitrine_publica').filter((l) => l.conta === 100 && l.tipo === 'imovel').length, 3);
    const props = banco.linhas('propostas').filter((p) => p.negociacao_id === neg.id).map((p) => [p.rodada, p.direcao, p.valor_c]);
    assert.deepEqual(props, [[1, 'comprador', 130000000], [1, 'vendedor', 140000000], [2, 'comprador', 132000000]]);
    assert.equal((await chamar('POST', '/demo/semear', {})).status, 409);
  });
});

test('#41: segunda conta de quem atende várias recebe endereço livre e publica sem 409', async () => {
  const banco = new BancoFalso(UNICOS);
  const { shell } = helpers();
  const atende = (conta: number): Ator => ({ usuario: 9, conta, contas: [100, 200], papeis: ['corretor'] });
  await comServidor(rotas, atende(100), banco, shell, async (chamar) => {
    const p = (await chamar('GET', '/pagina')).corpo.pagina;
    assert.equal(p.endereco, 'usuario-9');
    await chamar('PUT', '/pagina', p);
    assert.equal((await chamar('POST', '/pagina/publicar')).status, 200);
  });
  await comServidor(rotas, atende(200), banco, shell, async (chamar) => {
    const p = (await chamar('GET', '/pagina')).corpo.pagina;
    assert.equal(p.endereco, 'usuario-9-2');
    await chamar('PUT', '/pagina', p);
    assert.equal((await chamar('POST', '/pagina/publicar')).status, 200);
  });
});

test('#189: o corretor tirou um imóvel da página: a semente não o republica, nem completando outra coisa', async () => {
  const banco = await duasContasDemo();
  const { arquivos, shell } = helpers();
  await comServidor(rotas, { ...A, extras: { arquivos } }, banco, shell, async (chamar) => {
    assert.equal((await chamar('POST', '/demo/semear', {})).status, 201);
    const apto = banco.linhas('imoveis').find((i) => i.conta_id === 100 && i.titulo.startsWith('Apartamento'))!;
    assert.equal(apto.publicado_pagina, true, 'recém-criado na semente: entra na página');
    // O corretor desliga; nada mais falta: a segunda chamada recusa e não religa.
    apto.publicado_pagina = false;
    assert.equal((await chamar('POST', '/demo/semear', {})).status, 409);
    assert.equal(apto.publicado_pagina, false);
    // Agora falta outra coisa (a autorização da casa): a chamada completa isso e continua sem religar.
    const casa = banco.linhas('imoveis').find((i) => i.conta_id === 100 && i.titulo.startsWith('Casa'))!;
    const auts = banco.linhas('autorizacoes_venda');
    for (const a of auts.filter((x) => x.imovel_id === casa.id)) auts.splice(auts.indexOf(a), 1);
    const g = await chamar('POST', '/demo/semear', {});
    assert.equal(g.status, 200);
    assert.ok(g.corpo.completado.includes('Casa 4 quartos · Jardim Botânico: autorização assinada'), JSON.stringify(g.corpo.completado));
    assert.equal(apto.publicado_pagina, false);
  });
});

test('#189: publicação da página que falha vira aviso: não conta como completado e não impede o 409', async () => {
  const banco = await duasContasDemo();
  const { arquivos, shell } = helpers();
  await comServidor(rotas, { ...A, extras: { arquivos } }, banco, shell, async (chamar) => {
    assert.equal((await chamar('POST', '/demo/semear', {})).status, 201);
    // A página sai do ar e o endereço dela passa a ser de outra conta.
    const pagina = banco.linhas('paginas_corretor').find((p) => p.conta_id === 100)!;
    pagina.publicada_em = null;
    banco.linhas('vitrine_publica').push({ id: 90001, conta_id: 999, conta: 999, tipo: 'pagina', chave: pagina.endereco, dados: {} });
    // Sem mais nada a fazer: 409, com a falha na mensagem, a cada chamada.
    for (let i = 0; i < 2; i++) {
      const g = await chamar('POST', '/demo/semear', {});
      assert.equal(g.status, 409);
      assert.match(JSON.stringify(g.corpo), /página não publicada: Este endereço já é de outra página/);
    }
    // Com outra coisa a completar: 200, o completado traz só o que mudou e a falha vai em `avisos`.
    const casa = banco.linhas('imoveis').find((i) => i.conta_id === 100 && i.titulo.startsWith('Casa'))!;
    const auts = banco.linhas('autorizacoes_venda');
    for (const a of auts.filter((x) => x.imovel_id === casa.id)) auts.splice(auts.indexOf(a), 1);
    const g = await chamar('POST', '/demo/semear', {});
    assert.equal(g.status, 200);
    assert.deepEqual(g.corpo.completado, ['Casa 4 quartos · Jardim Botânico: autorização assinada']);
    assert.deepEqual(g.corpo.avisos, ['página não publicada: Este endereço já é de outra página. Escolha outro.']);
  });
});

test('#189: WhatsApp, destaques da página e peças do Estúdio entram na semente; segunda chamada não duplica', async () => {
  const banco = await duasContasDemo();
  const { arquivos, shell } = helpers();
  await comServidor(rotas, { ...A, extras: { arquivos } }, banco, shell, async (chamar) => {
    const g = await chamar('POST', '/demo/semear', {});
    assert.equal(g.status, 201);
    assert.ok(g.corpo.completado.includes('Estúdio: 4 peças'), JSON.stringify(g.corpo.completado));
    // WhatsApp: o telefone fictício do corretor vai ao perfil e à vitrine da página (a capa lê dele).
    assert.equal(banco.linhas('perfis_corretor').find((x) => x.conta_id === 100)!.telefone, '+5561990000100');
    const vitrine = () => banco.linhas('vitrine_publica').find((l) => l.conta === 100 && l.tipo === 'pagina')!;
    assert.equal(vitrine().dados.telefone, '+5561990000100');
    // Destaques: a casa e o apartamento, com os códigos reais, na página salva e na vitrine.
    const codigo = (inicio: string) => banco.linhas('imoveis').find((i) => i.conta_id === 100 && i.titulo.startsWith(inicio))!.codigo;
    const pagina = banco.linhas('paginas_corretor').find((p) => p.conta_id === 100)!;
    assert.deepEqual(pagina.blocos.find((b: any) => b.tipo === 'destaques').codigos, [codigo('Casa'), codigo('Apartamento')]);
    assert.deepEqual(vitrine().dados.blocos.find((b: any) => b.tipo === 'destaques').codigos, [codigo('Casa'), codigo('Apartamento')]);
    // Estúdio: duas sem arte (falta a arte), uma com arte para aprovar e uma aprovada; nada agendado nem publicado.
    const pecas = banco.linhas('pecas').filter((x) => x.conta_id === 100);
    assert.deepEqual(pecas.map((x) => x.estado), ['rascunho', 'rascunho', 'rascunho', 'aprovada']);
    assert.ok(pecas.every((x) => !x.agendamento_id && !x.publicada_em && !x.permalink));
    const comArte = new Set(banco.linhas('peca_arquivos').filter((x) => x.conta_id === 100).map((x) => x.peca_id));
    assert.deepEqual(pecas.map((x) => comArte.has(x.id)), [false, false, true, true]);
    const aprovada = pecas[3];
    assert.ok(aprovada.aprovada_em && aprovada.aprovada_por_id === 1);
    assert.equal(banco.linhas('pecas').filter((x) => x.conta_id === 200).length, 0, 'a outra conta não recebe peças do conjunto principal');
    // De novo: nada a completar, nada duplicado.
    assert.equal((await chamar('POST', '/demo/semear', {})).status, 409);
    assert.equal(banco.linhas('pecas').filter((x) => x.conta_id === 100).length, 4);
    assert.equal(banco.linhas('peca_arquivos').filter((x) => x.conta_id === 100).length, 2);
  });
});

test('#189: completar preenche WhatsApp e destaques vazios, mas respeita o que o corretor escolheu', async () => {
  const banco = await duasContasDemo();
  const { arquivos, shell } = helpers();
  await comServidor(rotas, { ...A, extras: { arquivos } }, banco, shell, async (chamar) => {
    assert.equal((await chamar('POST', '/demo/semear', {})).status, 201);
    const perfil = banco.linhas('perfis_corretor').find((x) => x.conta_id === 100)!;
    const pagina = banco.linhas('paginas_corretor').find((p) => p.conta_id === 100)!;
    const destaques = () => pagina.blocos.find((b: any) => b.tipo === 'destaques');
    const lote = banco.linhas('imoveis').find((i) => i.conta_id === 100 && i.titulo.startsWith('Lote'))!.codigo;
    // O corretor tem o próprio telefone e escolheu só o lote: nada a completar.
    perfil.telefone = '+5561988887777';
    destaques().codigos = [lote];
    assert.equal((await chamar('POST', '/demo/semear', {})).status, 409);
    assert.equal(perfil.telefone, '+5561988887777');
    assert.deepEqual(destaques().codigos, [lote]);
    // Conta com telefone e destaques vazios (e a página já no ar): a semente completa e a vitrine acompanha.
    perfil.telefone = null;
    destaques().codigos = [];
    const g = await chamar('POST', '/demo/semear', {});
    assert.equal(g.status, 200);
    assert.deepEqual(g.corpo.completado.map((f: string) => f.split(':')[0]), ['WhatsApp do corretor', 'destaques da página']);
    assert.equal(perfil.telefone, '+5561990000100');
    assert.equal(destaques().codigos.length, 2);
    const vit = banco.linhas('vitrine_publica').find((l) => l.conta === 100 && l.tipo === 'pagina')!;
    assert.equal(vit.dados.telefone, '+5561990000100');
    assert.equal(vit.dados.blocos.find((b: any) => b.tipo === 'destaques').codigos.length, 2);
    assert.equal((await chamar('POST', '/demo/semear', {})).status, 409);
  });
});

test('#189: conta que já tem peça no Estúdio não recebe as da semente', async () => {
  const banco = await duasContasDemo();
  const { arquivos, shell } = helpers();
  await comServidor(rotas, { ...A, extras: { arquivos } }, banco, shell, async (chamar) => {
    assert.equal((await chamar('POST', '/demo/semear', {})).status, 201);
    const tabela = banco.linhas('pecas');
    const minha = tabela.filter((x) => x.conta_id === 100)[0];
    for (const x of tabela.filter((x) => x.conta_id === 100 && x !== minha)) tabela.splice(tabela.indexOf(x), 1);
    // Falta outra coisa (autorização da casa): completa isso e não mexe nas peças.
    const casa = banco.linhas('imoveis').find((i) => i.conta_id === 100 && i.titulo.startsWith('Casa'))!;
    const auts = banco.linhas('autorizacoes_venda');
    for (const a of auts.filter((x) => x.imovel_id === casa.id)) auts.splice(auts.indexOf(a), 1);
    const g = await chamar('POST', '/demo/semear', {});
    assert.equal(g.status, 200);
    assert.ok(!g.corpo.completado.some((f: string) => f.startsWith('Estúdio')), JSON.stringify(g.corpo.completado));
    assert.equal(banco.linhas('pecas').filter((x) => x.conta_id === 100).length, 1);
  });
});
