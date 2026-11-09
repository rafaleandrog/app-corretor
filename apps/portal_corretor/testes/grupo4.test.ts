import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rotas, rotasPublicas, reagir } from '../backend/rotas';
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
  // Semente: quatro mensagens de texto e o cartão da seleção; o link do portal fica fora.
  assert.deepEqual(portalDe(banco, ana.id).conversa.map((m: any) => [m.de, m.tipo]), [
    ['voce', 'texto'], ['corretor', 'texto'], ['voce', 'texto'], ['corretor', 'texto'], ['corretor', 'selecao'],
  ]);
  // Aviso interno (sistema) não vai; o corretor manda um imóvel e ele aparece como cartão, sem link nem id interno.
  const dados = banco.dados(100);
  await registrarMensagem(dados, { contato_id: ana.id, direcao: 'saida', autor_tipo: 'sistema', canal: 'sistema', tipo: 'sistema', conteudo: 'Mensageiro passou para você: preço' });
  const casa = banco.linhas('imoveis').find((i) => i.titulo?.startsWith('Casa'))!;
  await registrarMensagem(dados, {
    contato_id: ana.id, direcao: 'saida', autor_tipo: 'humano', autor_id: 1, canal: 'registro', tipo: 'imovel', conteudo: 'Casa',
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
