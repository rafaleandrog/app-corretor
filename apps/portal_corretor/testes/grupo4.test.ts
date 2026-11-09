import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rotas, rotasPublicas, reagir, webhooks } from '../backend/rotas';
import { limparLimites } from '../backend/publico';
import { tentarPortal } from '../backend/portal';
import { semear } from '../backend/semente';
import { registrarMensagem } from '../backend/conversas';
import { abasDoPortal, proximoPassoDoPortal } from '../comum/portal-cliente';
import { BancoFalso, comServidor, type Ator } from './apoio';

// Etapa 4, grupo 4 (#191): o Portal do Cliente com a conversa como chat, a faixa "Próximo passo",
// quatro abas e o contador de Propostas coerente. A semente completa (#189) monta o cenário da Ana.

const UNICOS = {
  contatos: ['telefone'], imoveis: ['codigo'], visitas: ['atividade_id'], etapas_funil: ['pipeline+nome'], origens: ['canal+campanha'],
  vitrine_publica: ['tipo+chave'], selecao_itens: ['selecao_id+imovel_id'], paginas_corretor: ['chave'], marca_conta: ['chave'], perfis_corretor: ['usuario_id'],
};

function helpers() {
  let uploads = 0;
  let n = 0;
  const ingressos = new Map<string, { id: number; webhook: string; contexto: any }>();
  const arquivos = {
    enviar: async () => ({ upload_id: 9000 + ++uploads, expira_em: new Date(Date.now() + 600e3) }),
    url: async (id: number) => `/arquivo/${id}`,
  };
  const shell = {
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
  return { arquivos, shell };
}

const A = (extras: Record<string, unknown>): Ator => ({ usuario: 1, conta: 100, papeis: ['corretor'], extras });

async function cenarioDaAna() {
  const banco = new BancoFalso(UNICOS);
  await semear(banco.ctxSistema([{ id: 100, nome: 'Rafael Gualberto (demo)' }]));
  const h = helpers();
  await comServidor(rotas, A({ arquivos: h.arquivos }), banco, h.shell, async (chamar) => {
    assert.equal((await chamar('POST', '/demo/semear', {})).status, 201);
  });
  const ana = banco.linhas('contatos').find((c) => c.nome === 'Ana Ribeiro')!;
  const acesso = banco.linhas('acessos_cliente').find((a) => a.contato_id === ana.id)!;
  const token = new URL(acesso.link).searchParams.get('t')!;
  return { banco, h, ana, token };
}

const portalDe = (banco: BancoFalso, contato: number) => banco.linhas('vitrine_publica').find((l) => l.tipo === 'portal' && l.chave === `100:${contato}`)!.dados;

test('#191: a conversa vai ao portal só com o que o cliente vê; mensagem nova (dos dois lados) chega na hora', async () => {
  const { banco, h, ana, token } = await cenarioDaAna();
  // Aviso interno (sistema) não vai; o corretor manda um imóvel e ele aparece como cartão, sem link nem id interno.
  const dados = banco.dados(100);
  await registrarMensagem(dados, { contato_id: ana.id, direcao: 'saida', autor_tipo: 'sistema', canal: 'sistema', tipo: 'sistema', conteudo: 'Mensageiro passou para você: preço' });
  const casa = banco.linhas('imoveis').find((i) => i.titulo?.startsWith('Casa'))!;
  await registrarMensagem(dados, {
    contato_id: ana.id, direcao: 'saida', autor_tipo: 'humano', autor_id: 1, canal: 'wa_me', tipo: 'imovel', conteudo: 'Casa',
    dados: { imovel_id: casa.id, codigo: casa.codigo, titulo: casa.titulo, bairro: casa.bairro, preco_c: casa.preco_c, link: 'https://x/l?c=abc' },
  });
  const conversa = portalDe(banco, ana.id).conversa;
  assert.ok(!conversa.some((m: any) => m.tipo === 'sistema'));
  const cartao = conversa.at(-1);
  assert.deepEqual(cartao.imovel, { codigo: casa.codigo, titulo: casa.titulo, bairro: casa.bairro, preco_c: casa.preco_c });
  assert.ok(!JSON.stringify(cartao).includes('l?c=abc') && !('imovel_id' in cartao.imovel));
  // A cliente escreve pelo compositor (acao_cliente, tipo mensagem): o listener grava e o portal mostra.
  await reagir.acao_cliente_recebida({ conta_id: 100, payload: { contato_id: ana.id, tipo: 'mensagem', texto: 'Quero visitar!' } }, banco.ctxSistema([{ id: 100, nome: 'Rafael Gualberto (demo)' }]));
  assert.deepEqual(portalDe(banco, ana.id).conversa.at(-1), { ...portalDe(banco, ana.id).conversa.at(-1), de: 'voce', texto: 'Quero visitar!' });
  // A rota pública devolve a conversa junto com o resto.
  await comServidor(rotasPublicas, { usuario: 0, conta: null, papeis: [], extras: { arquivos: h.arquivos } }, banco, h.shell, async (chamar) => {
    const r = await chamar('GET', `/vitrine/portal?t=${token}`);
    assert.equal(r.status, 200);
    assert.equal(r.corpo.portal.conversa.at(-1).texto, 'Quero visitar!');
    assert.ok(!JSON.stringify(r.corpo).includes('Ana Ribeiro'), 'sem o nome do cliente');
  });
});

test('#191: Próximo passo (proposta, visita, seleção que vence, imóveis sem reação) e as abas da Ana', async () => {
  const { banco, h, token } = await cenarioDaAna();
  // O portal como a página pública o recebe (seleções já abertas, com as fotos).
  const p = await comServidor(rotasPublicas, { usuario: 0, conta: null, papeis: [], extras: { arquivos: h.arquivos } }, banco, h.shell, async (chamar) => (await chamar('GET', `/vitrine/portal?t=${token}`)).corpo.portal);
  // Ana: a proposta do Negociador (1,40 mi) foi respondida com 1,32 mi; nada esperando ela: vale a visita de sábado.
  const passo = proximoPassoDoPortal(p, Date.now(), 'America/Sao_Paulo')!;
  assert.equal(passo.aba, 'agenda');
  assert.match(passo.texto, /^Visita sábado às 10 h$/);
  assert.deepEqual(abasDoPortal(p).map((a) => [a.id, a.n]), [['conversa', null], ['imoveis', 3], ['agenda', 1], ['propostas', 1]]);
  // Ordem da faixa: proposta aceitável primeiro, depois a visita, a seleção que vence e os imóveis sem reação.
  const agora = Date.parse('2026-11-09T12:00:00Z');
  const propostaAberta = { pode_agir: true, propostas: [{ ref: 1, quem: 'vendedor', estado: 'enviada', valor_c: 1, validade_ate: null }] };
  assert.equal(proximoPassoDoPortal({ negociacoes: [propostaAberta], agenda: [{ quando: '2026-11-10T13:00:00Z' }] }, agora)!.aba, 'propostas');
  const vence = proximoPassoDoPortal({ selecoes: [{ expira_em: '2026-11-11T12:00:00Z', itens: [{ codigo: 'IM-1' }] }] }, agora, 'America/Sao_Paulo')!;
  assert.deepEqual(vence, { texto: 'Sua seleção vale até 11 de novembro', aba: 'imoveis' });
  assert.deepEqual(proximoPassoDoPortal({ selecoes: [{ expira_em: '2026-12-11T12:00:00Z', itens: [{ codigo: 'IM-1' }, { codigo: 'IM-2', reacao: 'gostei' }] }] }, agora), { texto: '1 imóvel esperando sua opinião', aba: 'imoveis' });
  assert.equal(proximoPassoDoPortal({}, agora), null);
  // O texto que o corretor escreveu para o cliente vem antes de tudo.
  assert.equal(proximoPassoDoPortal({ proximo_passo: 'Trazer os documentos', negociacoes: [propostaAberta] }, agora)!.texto, 'Trazer os documentos');
});

test('#191: a semente mostra a conversa da Ana no portal (quatro textos e o cartão da seleção)', async () => {
  const { banco, ana } = await cenarioDaAna();
  assert.deepEqual(portalDe(banco, ana.id).conversa.map((m: any) => [m.de, m.tipo]), [
    ['voce', 'texto'], ['corretor', 'texto'], ['voce', 'texto'], ['corretor', 'texto'], ['corretor', 'selecao'],
  ]);
});

const SISTEMA = [{ id: 100, nome: 'Rafael Gualberto (demo)' }];

test('D-132: o chat do portal leva só o que o cliente escreveu e o que lhe foi entregue por escrito', async () => {
  const { banco, h, ana } = await cenarioDaAna();
  const textos = () => portalDe(banco, ana.id).conversa.map((m: any) => m.texto);
  const conversa = banco.linhas('conversas').find((c) => c.contato_id === ana.id)!;
  await comServidor(rotas, A({ arquivos: h.arquivos }), banco, h.shell, async (chamar) => {
    // Enviar pela conversa (P02): pelo WhatsApp do celular entra; "só registrar" é anotação e fica fora.
    assert.equal((await chamar('POST', `/conversas/${conversa.id}/mensagens`, { texto: 'Enviada pelo WhatsApp' })).status, 201);
    assert.equal((await chamar('POST', `/conversas/${conversa.id}/mensagens`, { texto: 'Anotação: ligou, quer desconto', canal: 'registro' })).status, 201);
    // Abordagem por ligação com texto: vira mensagem `registro` na P02, mas não foi escrita ao cliente.
    assert.equal((await chamar('POST', `/abordagens/${ana.id}/feita`, { texto: 'Liguei e combinamos sábado', canal: 'ligacao' })).status, 201);
    assert.equal((await chamar('POST', `/abordagens/${ana.id}/feita`, { texto: 'Mandei as fotos pelo WhatsApp', canal: 'whatsapp' })).status, 201);
  });
  assert.ok(banco.linhas('mensagens').some((m) => m.conteudo === 'Liguei e combinamos sábado' && m.canal === 'registro'), 'a anotação existe na P02');
  assert.deepEqual(textos().slice(-2), ['Enviada pelo WhatsApp', 'Mandei as fotos pelo WhatsApp']);
  assert.ok(!textos().includes('Anotação: ligou, quer desconto') && !textos().includes('Liguei e combinamos sábado'));

  // Mensagem com falha de envio fica fora (sai na sincronização seguinte).
  const dados = banco.dados(100);
  const falhou = banco.linhas('mensagens').find((m) => m.conteudo === 'Enviada pelo WhatsApp')!;
  await dados.atualizar('mensagens', falhou.id, { status: 'falhou' });
  await reagir.acao_cliente_recebida({ conta_id: 100, payload: { contato_id: ana.id, tipo: 'mensagem', texto: 'Oi de novo' } }, banco.ctxSistema(SISTEMA));
  assert.ok(!textos().includes('Enviada pelo WhatsApp'), 'a que falhou não aparece');
  assert.equal(textos().at(-1), 'Oi de novo');

  // Entrada que não é do contato (escrita de outro autor) fica fora.
  await registrarMensagem(dados, { contato_id: ana.id, direcao: 'entrada', autor_tipo: 'agente', canal: 'portal', tipo: 'texto', conteudo: 'Entrada do agente' });
  await registrarMensagem(dados, { contato_id: ana.id, direcao: 'entrada', autor_tipo: 'humano', autor_id: 1, canal: 'portal', tipo: 'texto', conteudo: 'Entrada de um humano' });
  assert.ok(!textos().includes('Entrada do agente') && !textos().includes('Entrada de um humano'));
  assert.equal(textos().at(-1), 'Oi de novo');
});

test('D-132: o recado da oferta implausível (#194) chega ao corretor e não ao chat do cliente', async () => {
  limparLimites();
  const { banco, ana } = await cenarioDaAna();
  const negociacao = banco.linhas('negociacoes').find((n) => n.contato_id === ana.id)!;
  const ctx = { ...banco.ctxSistema(SISTEMA), eventos: { publicar: async () => ({ id: 1 }) } };
  // Primeira trava (webhook): publica a mensagem com o recado; o listener a grava como entrada do portal.
  const publicados: any[] = [];
  const r: any = { status: 200, corpo: null };
  const res: any = { status: (s: number) => ((r.status = s), res), json: (c: unknown) => ((r.corpo = c), res) };
  const req: any = {
    body: { tipo: 'proposta_nova', negociacao: negociacao.id, valor_c: 100 }, headers: {}, ip: '10.4.0.1', dados: banco.dados(null),
    wh: { webhook: 'acao_cliente', modo: 'recorrente', ingresso_id: 1, contexto: { conta_id: 100, contato_id: ana.id }, contador_usos: 0, criado_por: 1 },
    eventos: { publicar: async (tipo: string, payload: any, opcoes: any) => void publicados.push({ tipo, payload, opcoes }) },
  };
  await webhooks.acao_cliente(req, res);
  assert.equal(r.corpo?.codigo, 'OFERTA_IMPLAUSIVEL');
  assert.equal(publicados.length, 1);
  await reagir.acao_cliente_recebida({ conta_id: 100, payload: publicados[0].payload }, ctx);
  // Segunda trava (listener): a oferta implausível que chega direto vira o recado marcado.
  await reagir.acao_cliente_recebida({ conta_id: 100, payload: { contato_id: ana.id, tipo: 'proposta_nova', texto: null, visita: null, tarefa: null, negociacao: negociacao.id, proposta: null, valor_c: 1 } }, ctx);
  const recados = banco.linhas('mensagens').filter((m) => /não foi registrada/.test(String(m.conteudo)));
  assert.equal(recados.length, 2, 'o corretor recebe os dois recados na conversa (P02), com o texto de sempre');
  assert.equal(recados.filter((m) => m.dados?.aviso === 'oferta_implausivel').length, 1, 'o do listener leva a marca');
  const chat = JSON.stringify(portalDe(banco, ana.id).conversa);
  assert.ok(!chat.includes('tentou ofertar'), chat);
  // O cliente que escreve algo parecido continua vendo a própria mensagem.
  await reagir.acao_cliente_recebida({ conta_id: 100, payload: { contato_id: ana.id, tipo: 'mensagem', texto: 'Pelo portal, o cliente sou eu' } }, ctx);
  assert.equal(portalDe(banco, ana.id).conversa.at(-1).texto, 'Pelo portal, o cliente sou eu');
});

test('D-132: o chat mostra as 40 mais recentes, da mais antiga para a mais nova', async () => {
  const { banco, ana } = await cenarioDaAna();
  const dados = banco.dados(100);
  const base = Date.now() + 3600e3;
  for (let i = 1; i <= 45; i++) {
    await registrarMensagem(dados, {
      contato_id: ana.id, direcao: i % 2 ? 'entrada' : 'saida', autor_tipo: i % 2 ? 'contato' : 'humano', autor_id: i % 2 ? null : 1,
      canal: i % 2 ? 'portal' : 'wa_me', tipo: 'texto', conteudo: `m${i}`, em: new Date(base + i * 60e3).toISOString(),
    });
    // Anotações entre elas não ocupam lugar no corte.
    if (i % 5 === 0) await registrarMensagem(dados, { contato_id: ana.id, direcao: 'saida', autor_tipo: 'humano', autor_id: 1, canal: 'registro', tipo: 'texto', conteudo: `nota${i}`, em: new Date(base + i * 60e3 + 1).toISOString() });
  }
  const textos = portalDe(banco, ana.id).conversa.map((m: any) => m.texto);
  assert.equal(textos.length, 40);
  assert.deepEqual(textos, Array.from({ length: 40 }, (_, k) => `m${k + 6}`));
});

test('D-132: falha do banco na sincronização do portal sobe dentro da transação do listener e fica no log na rota', async () => {
  const erroSql = Object.assign(new Error('relation does not exist'), { code: '42P01' });
  const dadosQueFalham: any = { listar: async () => { throw erroSql; }, varrerTudo: async () => { throw erroSql; }, buscar: async () => { throw erroSql; } };
  await assert.rejects(tentarPortal(dadosQueFalham, 100, 1, undefined, { emTransacao: true }), /relation does not exist/);
  await tentarPortal(dadosQueFalham, 100, 1);
  const erroJs: any = { listar: async () => { throw new TypeError('x'); }, varrerTudo: async () => { throw new TypeError('x'); }, buscar: async () => { throw new TypeError('x'); } };
  await tentarPortal(erroJs, 100, 1, undefined, { emTransacao: true });
});
