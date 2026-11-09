import '@urbiverso/sdk/express';
import type { Request } from 'express';
import { Router } from 'express';
import type { HelperDados } from '@urbiverso/sdk';
import { assincrono, erro, guardarCorretor, id, primeiro } from './acesso';
import { registrar } from './crm';
import { reclassificar } from './inteligencia';
import { tentarPortal } from './portal';
import { linkWhatsapp } from '../comum/pagina';
import {
  type CanalMensagem,
  contarFiltros,
  FILTROS_CONVERSA,
  type FiltroConversa,
  passaNoFiltro,
  resumoDaMensagem,
  type TipoMensagem,
} from '../comum/conversas';

// Conversas (spec 11.1 P02, 6.5; D-116): uma conversa por cliente, alimentada pelas mensagens do Portal
// do Cliente (listener em publico.ts), pelos envios (envios.ts, cliente.ts) e pelo que o corretor manda
// daqui ("Fazer agora" e o compositor abrem o WhatsApp do celular com o texto e gravam a mensagem como
// saída pelo `wa.me`). O canal WhatsApp do app, a janela de 24 h e os modelos chegam no bloco 6 (D-59,
// D-78): até lá a tela avisa e deixa desligado o que depende deles.

export const conversasRotas: Router = Router();
guardarCorretor(conversasRotas, ['/conversas']);

type Linha = Record<string, any>;
const agora = () => new Date().toISOString();
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : typeof v === 'string' ? v : null);

export interface NovaMensagem {
  contato_id: number;
  direcao: 'entrada' | 'saida';
  autor_tipo: 'contato' | 'humano' | 'agente' | 'sistema';
  autor_id?: number | null;
  canal: CanalMensagem;
  tipo?: TipoMensagem;
  conteudo?: string | null;
  /** O cartão (imóvel, seleção, arquivo, localização, link): só o que o cliente também vê. */
  dados?: Record<string, unknown> | null;
  em?: string;
  /** Conta do bloco `comConta` (listener): a conversa é procurada nela. Na rota, fica de fora. */
  conta?: number;
}

/** A conversa do contato (uma por contato, D-116), criada na primeira mensagem. */
export async function conversaDoContato(dados: HelperDados, contatoId: number, canal: CanalMensagem = 'portal', responsavelId: number | null = null, conta?: number): Promise<Linha> {
  // No listener (`comConta`, leitura global) a busca leva a conta; na rota o `req.dados` já é da conta.
  const existente = conta
    ? (await dados.varrerTudo('conversas', { filtros: { conta_id: conta, contato_id: contatoId, 'removido_em[nulo]': 'true' }, maximo: 1 }))[0] ?? null
    : await primeiro(dados, 'conversas', { contato_id: contatoId });
  if (existente) return existente;
  try {
    return await dados.criar('conversas', {
      contato_id: contatoId,
      canal: canal === 'sistema' ? 'portal' : canal,
      responsavel_id: responsavelId,
      atendido_por: 'humano',
      estado: 'aberta',
      nao_entendidas: 0,
      nao_lidas: 0,
      // Nunca nula: a caixa ordena por ela em ordem decrescente, e nulo iria para a frente (PostgreSQL).
      ultima_mensagem_em: agora(),
    });
  } catch (e) {
    // Corrida do ler-e-criar (banco-de-dados.md § criarOuAtualizar): duas chamadas acharam "não existe" e
    // a segunda bateu no único `contato_id`; vale a que entrou primeiro. (Pedido ao shell 24.7: o verbo
    // `criarOuAtualizar` sobre único parcial em tabela segregada substituiria os dois passos.)
    if ((e as { code?: string }).code !== '23505') throw e;
    // No listener (`conta`) o `dados` é a transação do `comConta`, que o PostgreSQL já abortou: nada se lê
    // nela; o erro sobe e o `comContaRepetindo` refaz o bloco inteiro. Na rota (fora de transação) relê.
    if (conta) throw e;
    const vencedora = await primeiro(dados, 'conversas', { contato_id: contatoId });
    if (!vencedora) throw e;
    return vencedora;
  }
}

/**
 * Grava uma mensagem na conversa do contato e atualiza o resumo da conversa (última mensagem, não lidas,
 * estado, primeiras respostas). Serve às rotas (req.dados) e aos listeners (trx do `comConta`): quem
 * chama publica o evento, porque só ele tem o `eventos` certo.
 */
export async function registrarMensagem(dados: HelperDados, m: NovaMensagem): Promise<{ conversa: Linha; mensagem: Linha; repetida: boolean }> {
  const em = m.em ?? agora();
  const tipo = m.tipo ?? 'texto';
  const conversa = await conversaDoContato(dados, m.contato_id, m.canal, m.autor_tipo === 'humano' ? (m.autor_id ?? null) : null, m.conta);
  if (m.conta) {
    // Listener: o mesmo evento entregue de novo não duplica a mensagem (como a linha do tempo faz).
    // O barramento não refaz entrega (barramento.md: idempotência é do listener); a reentrega vem do webhook
    // do portal, que o navegador do cliente pode repetir. A janela é curta (2 min) para não engolir um "ok"
    // legítimo repetido mais tarde. O `conteudo` fica fora do filtro (a vírgula no valor vira lista, § filtros
    // em array) e é comparado aqui; `maximo` lança em vez de cortar, e 200 iguais em 2 min numa conversa é
    // falha que deve aparecer, não dedup.
    const limite = new Date(Date.now() - 2 * 60_000).toISOString();
    const repetida = (await dados.varrerTudo('mensagens', { filtros: { conta_id: m.conta, conversa_id: conversa.id, direcao: m.direcao, tipo, 'em[gte]': limite }, maximo: 200 })).find(
      (x: Linha) => (x.conteudo ?? null) === (m.conteudo ?? null),
    );
    if (repetida) return { conversa, mensagem: repetida, repetida: true };
  }
  const mensagem = await dados.criar('mensagens', {
    conversa_id: conversa.id,
    contato_id: m.contato_id,
    direcao: m.direcao,
    autor_tipo: m.autor_tipo,
    autor_id: m.autor_id ?? null,
    canal: m.canal,
    tipo,
    conteudo: m.conteudo ?? null,
    dados: m.dados ?? null,
    status: 'enviada',
    em,
  });
  const mudanca: Linha = { ultima_mensagem_em: em, ultima_mensagem: resumoDaMensagem({ tipo, conteudo: m.conteudo, dados: m.dados }), ultimo_tipo: tipo };
  if (m.autor_tipo === 'sistema') {
    // Aviso de sistema não muda quem espera quem.
  } else if (m.direcao === 'entrada') {
    mudanca.estado = conversa.atendido_por === 'agente' ? 'aberta' : 'aguardando_corretor';
    if (!conversa.primeira_entrada_em) mudanca.primeira_entrada_em = em;
    if (conversa.arquivada_em) mudanca.arquivada_em = null; // o cliente voltou a falar: a conversa reabre
  } else {
    mudanca.estado = 'aguardando_cliente';
    if (!conversa.primeira_resposta_em) mudanca.primeira_resposta_em = em;
    if (m.autor_tipo === 'humano' && !conversa.primeira_resposta_humana_em) mudanca.primeira_resposta_humana_em = em;
    if (m.autor_tipo === 'humano' && !conversa.responsavel_id && m.autor_id) mudanca.responsavel_id = m.autor_id;
  }
  let salva = await dados.atualizar('conversas', conversa.id, mudanca);
  if (!salva) throw Object.assign(new Error('Conversa não encontrada.'), { codigo: 'NAO_ENCONTRADO' });
  // O contador soma com `incrementar`, nunca ler-somar-gravar (banco-de-dados.md § Contratos): duas entradas juntas somam duas.
  if (m.autor_tipo !== 'sistema' && m.direcao === 'entrada') salva = (await dados.incrementar('conversas', conversa.id, { nao_lidas: 1 })) ?? salva;
  // O portal do cliente mostra a conversa (M4, #191): a mensagem que o cliente vê vai para lá. Sem
  // portal ativo, nada acontece; uma falha fica no log e não desfaz a mensagem.
  if (m.autor_tipo !== 'sistema' && tipo !== 'sistema') await tentarPortal(dados, Number(salva.conta_id ?? m.conta) || undefined, m.contato_id);
  return { conversa: salva, mensagem, repetida: false };
}

/** Payload dos eventos de mensagem (13.1): só ids, nunca o texto nem o canal (#151: o listener lê o resto no banco). */
export const payloadDaMensagem = (r: { conversa: Linha; mensagem: Linha }) => ({
  conversa_id: Number(r.conversa.id),
  contato_id: Number(r.mensagem.contato_id),
});

async function publicar(req: Request, tipo: string, payload: Record<string, unknown>) {
  try {
    await req.eventos?.publicar(tipo, payload);
  } catch (e) {
    // O evento é trilha, não a escrita: falhar aqui não desfaz a mensagem (fica no log do shell).
    console.warn(`[portal_corretor] evento ${tipo} não publicado:`, (e as Error).message);
  }
}

const eu = (req: Request) => req.contexto!.usuario.id;

/** Negociação ativa do contato (conduzida por alguém): é ela que diz se o Negociador atende a conversa. */
async function negociacaoAtiva(dados: HelperDados, contatoId: number): Promise<Linha | null> {
  const r = await dados.listar('negociacoes', { filtros: { contato_id: contatoId }, ordenar: 'id', ordem: 'desc', por_pagina: 20 });
  return r.dados.find((n: Linha) => !['encerrada', 'ganha', 'perdida', 'cancelada'].includes(String(n.estado)) && !n.encerrada_em) ?? null;
}

/** Quem atende, lido da negociação ativa (10.9.4): o corretor, ou o Negociador IA quando ele conduz. */
function atendimentoDe(negociacao: Linha | null): { atendido_por: 'humano' | 'agente'; agente: 'negociador' | null } {
  return negociacao?.conduzida_por === 'ia' ? { atendido_por: 'agente', agente: 'negociador' } : { atendido_por: 'humano', agente: null };
}

/** Quantas conversas a caixa carrega de uma vez (as mais recentes). */
export const LIMITE_CAIXA = 200;

/** Tetos da busca (uma consulta por tabela, sem lançar): contatos e imóveis que casam, envios desses imóveis. */
const TETO_BUSCA = { contatos: 200, imoveis: 100, envios: 500 } as const;

/**
 * Contatos que casam com o termo no banco (não só na janela da caixa): pelo nome ou telefone, ou por terem
 * recebido um imóvel cujo código ou título contém o termo (`envios.imovel_id`). `busca_ou` faz uma consulta
 * só por tabela (banco-de-dados.md § busca_ou); acima dos tetos a busca é parcial, o que a tela não promete além do
 * que mostra.
 */
async function contatosQueCasam(dados: HelperDados, q: string): Promise<Set<number>> {
  const ids = new Set<number>();
  for (const c of (await dados.listar('contatos', { busca_ou: { colunas: ['nome', 'telefone'], termo: q }, por_pagina: TETO_BUSCA.contatos })).dados as Linha[]) ids.add(Number(c.id));
  const imoveis = (await dados.listar('imoveis', { busca_ou: { colunas: ['codigo', 'titulo'], termo: q }, por_pagina: TETO_BUSCA.imoveis })).dados as Linha[];
  if (imoveis.length) {
    const envios = await dados.listar('envios', { filtros: { imovel_id: imoveis.map((im) => Number(im.id)).join(',') }, ordenar: 'enviado_em', ordem: 'desc', por_pagina: TETO_BUSCA.envios });
    for (const e of envios.dados as Linha[]) ids.add(Number(e.contato_id));
  }
  return ids;
}

// ---------- Lista ----------

conversasRotas.get(
  '/conversas',
  assincrono(async (req, res) => {
    const dados = req.dados!;
    const filtro = (FILTROS_CONVERSA as readonly string[]).includes(String(req.query.filtro)) ? (String(req.query.filtro) as FiltroConversa) : null;
    const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
    // A caixa mostra as LIMITE_CAIXA conversas mais recentes; acima disso a resposta avisa (`limite_atingido`),
    // os filtros e as contagens valem sobre essa janela, e a BUSCA vai ao banco: uma conversa antiga entra
    // pelo contato (nome, telefone, imóvel enviado) mesmo fora da janela.
    const r = await dados.listar('conversas', { ordenar: 'ultima_mensagem_em', ordem: 'desc', por_pagina: LIMITE_CAIXA });
    const janela: Linha[] = r.dados;
    const limiteAtingido = r.total > janela.length;
    const contatosDaBusca = q ? await contatosQueCasam(dados, q) : null;
    const todas: Linha[] = [...janela];
    if (contatosDaBusca?.size) {
      const vistas = new Set(janela.map((c) => Number(c.id)));
      const extras = await dados.listar('conversas', { filtros: { contato_id: [...contatosDaBusca].join(',') }, ordenar: 'ultima_mensagem_em', ordem: 'desc', por_pagina: LIMITE_CAIXA });
      for (const c of extras.dados as Linha[]) if (!vistas.has(Number(c.id))) todas.push(c);
      // A lista continua da mais recente para a mais antiga, com as de fora da janela no lugar delas.
      todas.sort((a, b) => String(b.ultima_mensagem_em ?? '').localeCompare(String(a.ultima_mensagem_em ?? '')));
    }
    // O contato de cada conversa da caixa (nome, telefone, temperatura e a origem para o chip): só os
    // referenciados, por id (a lista inteira de contatos cortaria em quem tem mais de uma página).
    const contatos = new Map<number, Linha>();
    const origens = new Map<number, string>();
    const idsContatos = [...new Set(todas.map((c) => Number(c.contato_id)))];
    if (idsContatos.length) {
      for (const c of await dados.varrerTudo('contatos', { filtros: { id: idsContatos.join(',') }, maximo: idsContatos.length })) contatos.set(Number(c.id), c);
      const idsOrigens = [...new Set([...contatos.values()].map((c) => Number(c.origem_id)).filter((n) => n > 0))];
      if (idsOrigens.length) for (const o of await dados.varrerTudo('origens', { filtros: { id: idsOrigens.join(',') }, maximo: idsOrigens.length })) origens.set(Number(o.id), String(o.canal));
    }
    const contatoDe = (c: Linha): Linha => contatos.get(Number(c.contato_id)) ?? {};
    const origemDe = (c: Linha): string | null => contatoDe(c).origem_canal ?? origens.get(Number(contatoDe(c).origem_id)) ?? null;
    // A busca casa pelo contato (no banco: nome, telefone, imóvel enviado; acima dos tetos, ainda pelo nome e
    // telefone lidos aqui, para a janela não perder ninguém) ou pela última mensagem.
    const casaBusca = (c: Linha) =>
      !q ||
      (contatosDaBusca?.has(Number(c.contato_id)) ?? false) ||
      [contatoDe(c).nome, contatoDe(c).telefone, c.ultima_mensagem].some((v) => String(v ?? '').toLowerCase().includes(q));
    const lista = todas.filter((c) => passaNoFiltro(c, filtro) && casaBusca(c)).map((c) => ({
      id: c.id,
      contato_id: c.contato_id,
      contato_nome: contatoDe(c).nome ?? c.contato_nome ?? null,
      contato_temperatura: contatoDe(c).temperatura ?? null,
      origem_canal: origemDe(c),
      canal: c.canal,
      estado: c.estado,
      atendido_por: c.atendido_por,
      agente: c.agente ?? null,
      nao_lidas: Number(c.nao_lidas ?? 0),
      ultima_mensagem: c.ultima_mensagem ?? null,
      ultima_mensagem_em: iso(c.ultima_mensagem_em),
      ultimo_tipo: c.ultimo_tipo ?? null,
      arquivada: !!c.arquivada_em,
    }));
    res.json({ dados: lista, total: lista.length, contadores: contarFiltros(janela), limite: LIMITE_CAIXA, limite_atingido: limiteAtingido });
  }),
);

// Nova conversa a partir de um contato (o botão "Nova"): devolve a que já existe, se houver.
conversasRotas.post(
  '/conversas',
  assincrono(async (req, res) => {
    const dados = req.dados!;
    const cid = id(req.body?.contato_id);
    const contato = cid ? await dados.buscar('contatos', cid) : null;
    if (!contato) return erro(res, 422, 'DADOS_INVALIDOS', 'Escolha o cliente.');
    const existente = await primeiro(dados, 'conversas', { contato_id: cid! });
    if (existente) return res.json({ conversa: existente, nova: false });
    const conversa = await conversaDoContato(dados, cid!, 'registro', eu(req));
    res.status(201).json({ conversa, nova: true });
  }),
);

// ---------- A conversa ----------

conversasRotas.get(
  '/conversas/:id',
  assincrono(async (req, res) => {
    const dados = req.dados!;
    const cid = id(req.params.id);
    const conversa = cid ? await dados.buscar('conversas', cid) : null;
    if (!conversa) return erro(res, 404, 'NAO_ENCONTRADO', 'Conversa não encontrada.');
    const [contato, mensagens, negociacao] = await Promise.all([
      dados.buscar('contatos', Number(conversa.contato_id)),
      dados.listar('mensagens', { filtros: { conversa_id: cid! }, ordenar: 'em', ordem: 'desc', por_pagina: 100 }),
      negociacaoAtiva(dados, Number(conversa.contato_id)),
    ]);
    if (!contato) return erro(res, 404, 'NAO_ENCONTRADO', 'Conversa não encontrada.');
    // Leitura não grava (permissoes.md, método → nível): marcar como lida e sincronizar quem atende é o
    // `PATCH /conversas/:id/lida`, que a tela chama ao abrir a conversa.
    res.json({
      conversa: { ...conversa, ultima_mensagem_em: iso(conversa.ultima_mensagem_em), ...atendimentoDe(negociacao) },
      contato: {
        id: contato.id, nome: contato.nome, telefone: contato.telefone ?? null, temperatura: contato.temperatura ?? null,
        temperatura_motivo: contato.temperatura_motivo ?? null, perfil_busca: contato.perfil_busca ?? null,
        origem_canal: contato.origem_canal ?? null, origem_campanha: contato.origem_campanha ?? null, proximo_passo: contato.proximo_passo ?? null,
      },
      mensagens: (mensagens.dados as Linha[]).reverse().map((m) => ({ ...m, em: iso(m.em) })),
      tem_mais: mensagens.total > mensagens.dados.length,
      negociacao: negociacao ? { id: negociacao.id, estado: negociacao.estado, conduzida_por: negociacao.conduzida_por, codigo: negociacao.codigo ?? null } : null,
      whatsapp: { conectado: false },
    });
  }),
);

/**
 * Abrir a conversa marca as mensagens como lidas (o filtro "Não lidas" é o que o corretor ainda não abriu)
 * e alinha quem atende com a negociação ativa (10.9.4). É escrita, por isso é `PATCH` e não o `GET`.
 */
conversasRotas.patch(
  '/conversas/:id/lida',
  assincrono(async (req, res) => {
    const dados = req.dados!;
    const cid = id(req.params.id);
    const conversa = cid ? await dados.buscar('conversas', cid) : null;
    if (!conversa) return erro(res, 404, 'NAO_ENCONTRADO', 'Conversa não encontrada.');
    const atendimento = atendimentoDe(await negociacaoAtiva(dados, Number(conversa.contato_id)));
    const mudanca: Linha = {};
    if (Number(conversa.nao_lidas ?? 0) > 0) mudanca.nao_lidas = 0;
    if (conversa.atendido_por !== atendimento.atendido_por || (conversa.agente ?? null) !== atendimento.agente) Object.assign(mudanca, atendimento);
    const atual = Object.keys(mudanca).length ? await dados.atualizar('conversas', cid!, mudanca) : conversa;
    if (!atual) return erro(res, 404, 'NAO_ENCONTRADO', 'Conversa não encontrada.');
    res.json({ conversa: { ...atual, ultima_mensagem_em: iso(atual.ultima_mensagem_em) } });
  }),
);

/**
 * Enviar texto (P02): sem o WhatsApp do app, a mensagem sai pelo WhatsApp do celular (`wa.me`, D-107) e
 * fica gravada como saída; sem telefone, fica só registrada. A tela abre o link que volta aqui.
 */
conversasRotas.post(
  '/conversas/:id/mensagens',
  assincrono(async (req, res) => {
    const dados = req.dados!;
    const cid = id(req.params.id);
    const conversa = cid ? await dados.buscar('conversas', cid) : null;
    if (!conversa) return erro(res, 404, 'NAO_ENCONTRADO', 'Conversa não encontrada.');
    const texto = typeof req.body?.texto === 'string' ? req.body.texto.trim().slice(0, 4000) : '';
    if (!texto) return erro(res, 422, 'DADOS_INVALIDOS', 'Escreva a mensagem.');
    const contato = await dados.buscar('contatos', Number(conversa.contato_id));
    if (!contato) return erro(res, 404, 'NAO_ENCONTRADO', 'Conversa não encontrada.');
    const link = linkWhatsapp(contato.telefone, texto);
    const pedido = req.body?.canal === 'registro' ? 'registro' : link ? 'wa_me' : 'registro';
    const r = await registrarMensagem(dados, { contato_id: Number(contato.id), direcao: 'saida', autor_tipo: 'humano', autor_id: eu(req), canal: pedido, tipo: 'texto', conteudo: texto });
    await registrar(dados, req, {
      tipo: 'abordagem.feita', alvo_tipo: 'contato', alvo_id: Number(contato.id), contato_id: Number(contato.id),
      resumo: `Mensagem ${pedido === 'wa_me' ? 'pelo WhatsApp' : 'registrada'}: ${texto.slice(0, 200)}`, dados: { canal: pedido === 'wa_me' ? 'whatsapp' : 'registro', conversa_id: cid },
    });
    await dados.atualizar('contatos', Number(contato.id), { ultimo_contato_em: agora(), abordagem_adiada_em: null });
    await reclassificar(dados, Number(contato.id));
    await publicar(req, 'mensagem_enviada', payloadDaMensagem(r));
    res.status(201).json({ mensagem: { ...r.mensagem, em: iso(r.mensagem.em) }, conversa: r.conversa, link: pedido === 'wa_me' ? link : null });
  }),
);

// Assumir e Devolver ao Negociador (11.1 P02): trocam quem atende. Com negociação ativa, a conversa segue a
// negociação, que já tem as suas regras (negociador.ts): a tela chama lá primeiro e aqui depois.
for (const [rota, para, evento] of [
  ['assumir', 'humano', 'conversa_assumida'],
  ['devolver', 'agente', 'conversa_devolvida'],
] as const) {
  conversasRotas.post(
    `/conversas/:id/${rota}`,
    assincrono(async (req, res) => {
      const dados = req.dados!;
      const cid = id(req.params.id);
      const conversa = cid ? await dados.buscar('conversas', cid) : null;
      if (!conversa) return erro(res, 404, 'NAO_ENCONTRADO', 'Conversa não encontrada.');
      const negociacao = await negociacaoAtiva(dados, Number(conversa.contato_id));
      if (para === 'agente' && !negociacao) return erro(res, 409, 'SEM_AGENTE', 'Não há Negociador atendendo este cliente: devolver só vale com uma negociação aberta. O Mensageiro chega com o WhatsApp.');
      if (para === 'agente' && negociacao?.conduzida_por !== 'ia') return erro(res, 409, 'NEGOCIACAO_COM_CORRETOR', 'Devolva a negociação ao Negociador primeiro (Clientes › Negociações).');
      const quem = para === 'agente' ? { atendido_por: 'agente', agente: 'negociador' } : { atendido_por: 'humano', agente: null };
      const nome = req.contexto!.usuario.nome;
      const salva = await dados.atualizar('conversas', cid!, { ...quem, estado: para === 'humano' ? 'aguardando_corretor' : 'aberta' });
      if (!salva) return erro(res, 404, 'NAO_ENCONTRADO', 'Conversa não encontrada.');
      await registrarMensagem(dados, {
        contato_id: Number(conversa.contato_id), direcao: 'saida', autor_tipo: 'sistema', canal: 'sistema', tipo: 'sistema',
        conteudo: para === 'humano' ? `${nome} assumiu a conversa` : `${nome} devolveu a conversa ao Negociador`,
      });
      await publicar(req, evento, { conversa_id: cid!, contato_id: Number(conversa.contato_id) });
      res.json({ conversa: salva });
    }),
  );
}

// Arquivar e desarquivar.
conversasRotas.patch(
  '/conversas/:id',
  assincrono(async (req, res) => {
    const dados = req.dados!;
    const cid = id(req.params.id);
    const conversa = cid ? await dados.buscar('conversas', cid) : null;
    if (!conversa) return erro(res, 404, 'NAO_ENCONTRADO', 'Conversa não encontrada.');
    if (typeof req.body?.arquivada !== 'boolean') return erro(res, 422, 'DADOS_INVALIDOS', 'Nada para mudar.');
    const salva = await dados.atualizar('conversas', cid!, { arquivada_em: req.body.arquivada ? agora() : null });
    if (!salva) return erro(res, 404, 'NAO_ENCONTRADO', 'Conversa não encontrada.');
    res.json({ conversa: salva });
  }),
);
