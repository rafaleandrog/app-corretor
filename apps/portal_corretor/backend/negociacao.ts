import '@urbiverso/sdk/express';
import { Router, type Request } from 'express';
import type { HelperDados } from '@urbiverso/sdk';
import {
  CATEGORIAS_OBJECAO,
  CONFIG_NEGOCIADOR_PADRAO,
  DIRECOES,
  ENCERRADOS,
  ESTADOS_NEGOCIACAO,
  ESTILOS,
  GATILHOS,
  LIMITE_INSTRUCOES,
  MOTIVOS_PERDA,
  PLAYBOOK_OBJECOES_PADRAO,
  proximoCodigoNegociacao,
  rodadaDaProposta,
  semSigilo,
  validarMandato,
  type Direcao,
} from '../comum/negociacao';
import { assincrono, erro, guardarCorretor, primeiro, salvarUnico } from './acesso';
import { tentarPortal } from './portal';
import { contaDoRequest } from './vitrine';

// Negociação (bloco D1 da fase 1.6; spec 6.16, 7.1, 10.9.2, 10.9.3, 13 e Apêndice D). Só os dados e
// as rotas do corretor: o motor do Negociador (sugestão, validações de 10.9.7, envio pelo portal ou
// pelo Fazer agora) é o D2; o negociador humano, o D7. Sigilo (regra do dono): recuo, alvo e BATNA
// do vendedor só saem para o corretor da conta nas duas rotas do mandato: GET /negociacoes/:id/mandato
// e a resposta do PUT /negociacoes/:id/mandato (que devolve a versão que ele acabou de gravar). Toda
// outra resposta e todo evento passam por `semSigilo()`.
export const negociacaoRotas = Router();
guardarCorretor(negociacaoRotas, ['/negociacoes', '/negociador']);

type Linha = Record<string, any>;

export const id = (v: unknown) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};
export const texto = (v: unknown, limite: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, limite) : null);
export const encerrada = (n: Linha) => (ENCERRADOS as readonly string[]).includes(n.estado);
const violouUnico = (e: unknown) => (e as { code?: string })?.code === '23505';

export const NAO_ENCONTRADA = 'Negociação não encontrada.';
export const MENSAGEM_ENCERRADA = 'Esta negociação já foi encerrada.';

/**
 * Publica um evento da negociação (segregado, payload só com ids). O `semSigilo` é a segunda trava:
 * o payload já nasce só com ids, mas um campo sigiloso nunca chega ao barramento, que os membros da
 * conta leem. A escrita já aconteceu: falha do barramento não desfaz nem derruba a resposta.
 */
export async function publicar(req: Request, tipo: string, payload: Record<string, number | null>) {
  try {
    await req.eventos?.publicar(tipo, semSigilo(payload));
  } catch (e) {
    console.warn(`[portal_corretor] evento ${tipo} não publicado: ${(e as Error).message}`);
  }
}

/**
 * O Portal do Cliente acompanha a negociação (D5, M5b): proposta, estado ou negociação nova mudam o que
 * o cliente vê. Sem derrubar a rota: a vitrine se refaz na próxima mudança, se falhar aqui.
 */
export async function portalDa(req: Request, negociacao: Linha | null | undefined) {
  if (negociacao?.contato_id) await tentarPortal(req.dados!, contaDoRequest(req), Number(negociacao.contato_id));
}

/**
 * Configuração do Negociador da conta, sem gravar (a linha nasce no primeiro PUT). `conta` é
 * obrigatória fora de rota (listener, SISTEMA): ali a leitura enxerga todas as contas.
 */
export async function configDaConta(dados: HelperDados, conta?: number) {
  const linha = await primeiro(dados, 'config_negociador', { chave: 'conta', ...(conta ? { conta_id: conta } : {}) });
  if (!linha) return { ...CONFIG_NEGOCIADOR_PADRAO, gatilhos: { ...CONFIG_NEGOCIADOR_PADRAO.gatilhos }, padrao: true };
  return {
    ligado: !!linha.ligado,
    conduz_padrao: linha.conduz_padrao,
    negociador_padrao_id: linha.negociador_padrao_id ?? null,
    gatilhos: { ...CONFIG_NEGOCIADOR_PADRAO.gatilhos, ...(linha.gatilhos ?? {}) },
    estilo: linha.estilo,
    instrucoes_corretor: linha.instrucoes_corretor ?? null,
    assinatura_humana: linha.assinatura_humana ?? null,
    versao: Number(linha.versao),
    padrao: false,
  };
}

/** Mandato vigente (o da `negociacoes.mandato_id`), com os campos sigilosos. Uso interno. */
export async function mandatoVigente(dados: HelperDados, negociacao: Linha): Promise<Linha | null> {
  if (!negociacao.mandato_id) return null;
  const m = await dados.buscar('mandatos_negociacao', Number(negociacao.mandato_id));
  return m && Number(m.negociacao_id) === Number(negociacao.id) ? normalizarMandato(m) : null;
}

/** A negociação em andamento (não encerrada) do negócio, se houver. */
async function negociacaoAberta(dados: HelperDados, negocioId: number): Promise<Linha | null> {
  const r = await dados.listar('negociacoes', { filtros: { negocio_id: negocioId }, por_pagina: 100 });
  return r.dados.find((n) => !encerrada(n)) ?? null;
}

/** Maior id de proposta já gravada, de qualquer lado (0 sem nenhuma): o marco que a execução guarda em `entrada.propostas_ate`. */
export const ultimaPropostaId = (propostas: Linha[]) =>
  propostas.reduce((m, p) => (Number(p.id) > m ? Number(p.id) : m), 0);

/**
 * Sugestão superada: há execução mais nova na negociação, ou QUALQUER proposta (comprador, vendedor ou
 * proprietário) gravada depois dela — o motor sugeriu sem vê-la. `maisNovaId` é o id da execução mais
 * recente da negociação. Execução antiga, sem `propostas_ate`, cai na data de criação.
 */
export function sugestaoSuperada(execucao: Linha, maisNovaId: number, propostas: Linha[]): boolean {
  if (maisNovaId > Number(execucao.id)) return true;
  const marco = execucao.entrada?.propostas_ate;
  const desde = new Date(execucao.criado_em).getTime();
  return propostas.some((p) => (typeof marco === 'number' ? Number(p.id) > marco : new Date(p.criado_em).getTime() > desde));
}

/** `decimal` chega como texto do banco: a fração volta como número. */
function normalizarMandato(m: Linha): Linha {
  return { ...m, passo_max_pct: Number(m.passo_max_pct) };
}

negociacaoRotas.get(
  '/negociacoes',
  assincrono(async (req, res) => {
    const dados = req.dados!;
    const filtros: Record<string, unknown> = {};
    const estados = typeof req.query.estado === 'string' ? req.query.estado.split(',').filter((e) => (ESTADOS_NEGOCIACAO as readonly string[]).includes(e)) : [];
    if (estados.length) filtros.estado = estados.join(',');
    for (const chave of ['contato_id', 'negocio_id', 'imovel_id']) {
      const v = id(req.query[chave]);
      if (v) filtros[chave] = v;
    }
    const por_pagina = Math.min(100, id(req.query.por_pagina) ?? 50);
    const pagina = id(req.query.pagina) ?? 1;
    const r = await dados.listar('negociacoes', { filtros, ordenar: 'atualizado_em', ordem: 'desc', pagina, por_pagina });
    const ids = r.dados.map((n) => n.id);
    const mandatos = r.dados.map((n) => n.mandato_id).filter(Boolean);
    const [ofertas, vigentes] = await Promise.all([
      ids.length
        ? dados.varrerTudo('propostas', { filtros: { negociacao_id: ids.join(','), direcao: 'comprador' }, ordenar: 'id', ordem: 'desc', maximo: 5000 })
        : [],
      mandatos.length ? dados.varrerTudo('mandatos_negociacao', { filtros: { id: mandatos.join(',') }, maximo: 100 }) : [],
    ]);
    const ultima = new Map<number, Linha>();
    for (const p of ofertas) if (!ultima.has(Number(p.negociacao_id))) ultima.set(Number(p.negociacao_id), p);
    // Da lista só sai o preço pedido do mandato (não é sigiloso): a tela mostra "última oferta × pedido".
    const pedido = new Map(vigentes.map((m) => [Number(m.id), Number(m.preco_pedido_c)]));
    const linhas = r.dados.map((n) => ({
      ...n,
      ultima_oferta_c: ultima.get(Number(n.id))?.valor_c ?? null,
      ultima_oferta_em: ultima.get(Number(n.id))?.criado_em ?? null,
      preco_pedido_c: n.mandato_id ? (pedido.get(Number(n.mandato_id)) ?? null) : null,
    }));
    res.json(semSigilo({ ...r, dados: linhas }));
  }),
);

negociacaoRotas.post(
  '/negociacoes',
  assincrono(async (req, res) => {
    const dados = req.dados!;
    const negocioId = id(req.body?.negocio_id);
    const imovelId = id(req.body?.imovel_id);
    if (!negocioId || !imovelId) return erro(res, 422, 'DADOS_INVALIDOS', 'Informe o negócio e o imóvel da negociação.');
    // `buscar` só enxerga a conta ativa: negócio ou imóvel de outra conta é "não encontrado".
    const [negocio, imovel] = await Promise.all([dados.buscar('negocios', negocioId), dados.buscar('imoveis', imovelId)]);
    if (!negocio) return erro(res, 404, 'NAO_ENCONTRADO', 'Negócio não encontrado.');
    if (!imovel) return erro(res, 404, 'NAO_ENCONTRADO', 'Imóvel não encontrado.');
    // Uma negociação em andamento por negócio (6.16): a encerrada não impede uma nova. A leitura aqui
    // só dá a mensagem com o código; quem garante é o único parcial do schema.json (negocio_id onde o
    // estado não é ganha nem perdida), que recusa a segunda criada ao mesmo tempo.
    const aberta = await negociacaoAberta(dados, negocioId);
    if (aberta) return erro(res, 409, 'NEGOCIACAO_EXISTENTE', `Este negócio já está em negociação (${aberta.codigo}).`);
    // Quem conduz: o pedido, ou o Negociador IA (D-94) — o corretor, se o Negociador estiver desligado.
    // `humano` chega com o negociador humano (D7, política multi-usuário).
    const config = await configDaConta(dados);
    const pedida = req.body?.conduzida_por;
    if (pedida !== undefined && pedida !== 'ia' && pedida !== 'corretor') {
      return erro(res, 422, 'DADOS_INVALIDOS', 'Quem conduz: use ia ou corretor.');
    }
    const conduzida_por = pedida ?? (config.ligado ? 'ia' : 'corretor');
    for (let tentativa = 0; tentativa < 5; tentativa++) {
      const codigos = (await dados.listar('negociacoes', { filtros: { 'codigo[busca]': 'NG-' }, ordenar: 'id', ordem: 'desc', por_pagina: 200 })).dados.map((n) => n.codigo);
      try {
        const negociacao = await dados.criar('negociacoes', {
          codigo: proximoCodigoNegociacao(codigos),
          negocio_id: negocioId,
          imovel_id: imovelId,
          contato_id: negocio.contato_id,
          estado: 'ativa',
          conduzida_por,
          rodadas: 0,
        });
        await publicar(req, 'negociacao_iniciada', { negociacao_id: negociacao.id, negocio_id: negocioId });
        await portalDa(req, negociacao);
        return res.status(201).json(semSigilo(negociacao));
      } catch (e) {
        if (!violouUnico(e)) throw e;
        // Dois únicos na tabela: o do `codigo` (tenta outro código) e o da negociação em andamento por
        // negócio (outra tela criou agora). Relê para saber qual foi, sem depender do nome do índice.
        const outra = await negociacaoAberta(dados, negocioId);
        if (outra) return erro(res, 409, 'NEGOCIACAO_EXISTENTE', `Este negócio já está em negociação (${outra.codigo}).`);
      }
    }
    return erro(res, 409, 'CODIGO_REPETIDO', 'Não foi possível gerar o código agora. Tente de novo.');
  }),
);

negociacaoRotas.get(
  '/negociacoes/:id',
  assincrono(async (req, res) => {
    const dados = req.dados!;
    const nid = id(req.params.id);
    const negociacao = nid ? await dados.buscar('negociacoes', nid) : null;
    if (!negociacao) return erro(res, 404, 'NAO_ENCONTRADO', NAO_ENCONTRADA);
    const [mandato, propostas, objecoes, execucoes] = await Promise.all([
      mandatoVigente(dados, negociacao),
      dados.varrerTudo('propostas', { filtros: { negociacao_id: nid }, ordenar: 'id', ordem: 'asc', maximo: 500 }),
      dados.varrerTudo('objecoes_detectadas', { filtros: { negociacao_id: nid }, ordenar: 'id', ordem: 'asc', maximo: 500 }),
      dados.listar('negociador_execucoes', { filtros: { negociacao_id: nid }, ordenar: 'id', ordem: 'desc', por_pagina: 20 }),
    ]);
    // Para a tela (P15): a última fala do cliente registrada e a sugestão do Negociador que espera o
    // corretor. A saída gravada já é a guardável (o que vazaria o sigilo foi retido no motor, D2).
    // Só a execução MAIS RECENTE, pendente e sem proposta (de qualquer lado) depois dela: a superada não aparece.
    const fala = execucoes.dados.find((e) => e.mensagem_cliente);
    const ultima = execucoes.dados[0];
    const pendente = ultima?.decisao === 'pendente' && !sugestaoSuperada(ultima, Number(ultima.id), propostas) ? ultima : null;
    const sugestao = pendente
      ? { execucao_id: pendente.id, resposta: pendente.saida ?? null, validacoes: pendente.validacoes?.verificacoes ?? [], bloqueado_por: pendente.bloqueado_por ?? null, criado_em: pendente.criado_em }
      : null;
    // O mandato aparece aqui só no resumo, sem recuo, alvo nem BATNA (o completo é a rota /mandato).
    res.json(semSigilo({ ...negociacao, mandato, propostas, objecoes, ultima_fala: fala ? { texto: fala.mensagem_cliente, em: fala.criado_em } : null, sugestao }));
  }),
);

negociacaoRotas.patch(
  '/negociacoes/:id',
  assincrono(async (req, res) => {
    const dados = req.dados!;
    const nid = id(req.params.id);
    const atual = nid ? await dados.buscar('negociacoes', nid) : null;
    if (!atual) return erro(res, 404, 'NAO_ENCONTRADO', NAO_ENCONTRADA);
    if (encerrada(atual)) return erro(res, 409, 'NEGOCIACAO_ENCERRADA', MENSAGEM_ENCERRADA);
    const b = (req.body ?? {}) as Record<string, unknown>;
    const mudancas: Record<string, unknown> = {};
    const erros: string[] = [];
    if (b.estado !== undefined) {
      if (!(ESTADOS_NEGOCIACAO as readonly unknown[]).includes(b.estado)) erros.push('estado: valor desconhecido.');
      else mudancas.estado = b.estado;
    }
    if (b.conduzida_por !== undefined) {
      if (b.conduzida_por !== 'ia' && b.conduzida_por !== 'corretor') erros.push('conduzida_por: use ia ou corretor.');
      else mudancas.conduzida_por = b.conduzida_por;
    }
    for (const campo of ['teto_estimado_comprador_c', 'valor_final_c']) {
      if (b[campo] === undefined) continue;
      if (b[campo] !== null && !(Number.isInteger(b[campo]) && (b[campo] as number) >= 0)) erros.push(`${campo}: use centavos (inteiro).`);
      else mudancas[campo] = b[campo];
    }
    if (b.fonte_estimativa !== undefined) mudancas.fonte_estimativa = texto(b.fonte_estimativa, 300);
    if (b.batna_estimada_comprador !== undefined) mudancas.batna_estimada_comprador = texto(b.batna_estimada_comprador, 500);
    if (b.motivo_perda !== undefined) {
      if (b.motivo_perda !== null && !(MOTIVOS_PERDA as readonly unknown[]).includes(b.motivo_perda)) erros.push('motivo_perda: valor desconhecido.');
      else mudancas.motivo_perda = b.motivo_perda;
    }
    if (erros.length) return erro(res, 422, 'DADOS_INVALIDOS', 'Confira a negociação.', erros);
    if (!Object.keys(mudancas).length) return erro(res, 422, 'DADOS_INVALIDOS', 'Nada para alterar.');
    const fim = mudancas.estado === 'ganha' || mudancas.estado === 'perdida';
    // O valor que fica gravado é o do pedido quando ele traz o campo (null inclusive), senão o atual.
    const final = (campo: string) => (campo in mudancas ? mudancas[campo] : atual[campo]);
    const condicoes: Record<string, unknown> = { estado: atual.estado };
    if (mudancas.estado === 'ganha') {
      if (!(Number(final('valor_final_c')) > 0)) return erro(res, 422, 'DADOS_INVALIDOS', 'Para encerrar como ganha, informe o valor final.');
      // Apoiado no valor já gravado: outro PATCH não pode apagá-lo entre a leitura e esta escrita.
      if (!('valor_final_c' in mudancas)) condicoes.valor_final_c = atual.valor_final_c;
    }
    if (mudancas.estado === 'perdida') {
      if (!final('motivo_perda')) return erro(res, 422, 'DADOS_INVALIDOS', 'Para encerrar como perdida, informe o motivo.');
      if (!('motivo_perda' in mudancas)) condicoes.motivo_perda = atual.motivo_perda;
    }
    if (fim) mudancas.encerrada_em = new Date();
    // Condicionada ao estado lido (e ao valor ou motivo em que o encerramento se apoia): dois
    // encerramentos simultâneos não publicam duas vezes, e nenhum grava ganha sem valor.
    const salva = await dados.atualizarSe('negociacoes', nid!, mudancas, condicoes);
    if (!salva) return erro(res, 409, 'NEGOCIACAO_ALTERADA', 'A negociação mudou enquanto você editava. Abra de novo.');
    if (fim) await publicar(req, 'negociacao_encerrada', { negociacao_id: nid! });
    await portalDa(req, salva);
    res.json(semSigilo(salva));
  }),
);

// Com a resposta do PUT abaixo, as únicas que devolvem recuo, alvo e BATNA do vendedor: só ao
// corretor da conta (guardarCorretor).
negociacaoRotas.get(
  '/negociacoes/:id/mandato',
  assincrono(async (req, res) => {
    const dados = req.dados!;
    const nid = id(req.params.id);
    const negociacao = nid ? await dados.buscar('negociacoes', nid) : null;
    if (!negociacao) return erro(res, 404, 'NAO_ENCONTRADO', NAO_ENCONTRADA);
    const versoes = await dados.varrerTudo('mandatos_negociacao', { filtros: { negociacao_id: nid }, ordenar: 'versao', ordem: 'desc', maximo: 200 });
    res.json({ vigente: await mandatoVigente(dados, negociacao), versoes: versoes.map(normalizarMandato) });
  }),
);

negociacaoRotas.put(
  '/negociacoes/:id/mandato',
  assincrono(async (req, res) => {
    const dados = req.dados!;
    const nid = id(req.params.id);
    const negociacao = nid ? await dados.buscar('negociacoes', nid) : null;
    if (!negociacao) return erro(res, 404, 'NAO_ENCONTRADO', NAO_ENCONTRADA);
    if (encerrada(negociacao)) return erro(res, 409, 'NEGOCIACAO_ENCERRADA', MENSAGEM_ENCERRADA);
    const v = validarMandato((req.body ?? {}) as Record<string, unknown>);
    if (!v.ok) return res.status(v.status).json({ erro: true, codigo: v.codigo, motivo: v.motivo, mensagem: v.mensagem, ...(v.detalhes ? { detalhes: v.detalhes } : {}) });
    // Autorização por anexo: o documento é uma mídia tipo documento do MESMO imóvel da negociação (não há
    // armazenamento próprio; o documento entra pela ficha do imóvel). `buscar` só enxerga a conta ativa.
    const aut = v.dados.autorizacao_proprietario as { tipo: string; arquivo_id: number | null } | null;
    if (aut?.tipo === 'anexo') {
      const midia = await dados.buscar('imovel_midias', Number(aut.arquivo_id));
      if (!midia || midia.tipo !== 'documento' || Number(midia.imovel_id) !== Number(negociacao.imovel_id)) {
        return erro(res, 422, 'DADOS_INVALIDOS', 'O documento da autorização tem de ser um documento anexado a este imóvel (ficha do imóvel › Fotos e arquivos).');
      }
    }
    // Cada alteração é uma versão nova; as anteriores ficam (histórico). A vigente é a da negociação.
    let mandato: Linha;
    try {
      mandato = await dados.transaction(async (trx) => {
        const ultima = (await trx.listar('mandatos_negociacao', { filtros: { negociacao_id: nid }, ordenar: 'versao', ordem: 'desc', por_pagina: 1 })).dados[0];
        const criado = await trx.criar('mandatos_negociacao', {
          ...v.dados,
          negociacao_id: nid,
          versao: (ultima ? Number(ultima.versao) : 0) + 1,
          alterado_por_id: req.contexto?.usuario.id ?? null,
        });
        await trx.atualizar('negociacoes', nid!, { mandato_id: criado.id });
        return criado;
      });
    } catch (e) {
      if (!violouUnico(e)) throw e;
      return erro(res, 409, 'MANDATO_ALTERADO', 'O mandato foi alterado agora por outra tela. Abra de novo.');
    }
    // Sem valores: só os ids (13.1).
    await publicar(req, 'mandato_alterado', { negociacao_id: nid!, mandato_id: mandato.id });
    // Ao corretor que gravou, a versão completa (com recuo, alvo e BATNA), como no GET do mandato.
    res.json(normalizarMandato(mandato));
  }),
);

negociacaoRotas.get(
  '/negociacoes/:id/propostas',
  assincrono(async (req, res) => {
    const dados = req.dados!;
    const nid = id(req.params.id);
    const negociacao = nid ? await dados.buscar('negociacoes', nid) : null;
    if (!negociacao) return erro(res, 404, 'NAO_ENCONTRADO', NAO_ENCONTRADA);
    const propostas = await dados.varrerTudo('propostas', { filtros: { negociacao_id: nid }, ordenar: 'id', ordem: 'asc', maximo: 500 });
    res.json(semSigilo({ dados: propostas }));
  }),
);

export interface NovaProposta {
  direcao: Direcao;
  autor_tipo: string;
  autor_usuario_id: number | null;
  valor_c: number;
  condicoes: string | null;
  concessao: string | null;
  contrapartida: string | null;
  validade_ate: Date | null;
  canal: string;
  estado: string;
}

/**
 * Grava uma proposta dentro de uma transação já aberta: trava a negociação ANTES de contar
 * (banco-de-dados.md, Trava de linha), calcula a rodada e materializa `rodadas`. Duas propostas ao
 * mesmo tempo se enfileiram aqui, e a segunda conta já com a primeira. Relida travada, ninguém a
 * encerra entre esta checagem e a escrita. Usada pelo registro do corretor e pelo envio do Negociador.
 */
export async function gravarPropostaTravada(
  trx: HelperDados,
  nid: number,
  nova: NovaProposta,
): Promise<{ recusa: 404 | 409 } | { proposta: Linha; negociacao: Linha }> {
  const viva = await trx.buscar('negociacoes', nid, { travar: true });
  if (!viva) return { recusa: 404 };
  if (encerrada(viva)) return { recusa: 409 };
  const anteriores = await trx.varrerTudo('propostas', { filtros: { negociacao_id: nid }, maximo: 500 });
  const rodada = rodadaDaProposta(anteriores.map((p) => p.direcao as Direcao), nova.direcao);
  const proposta = await trx.criar('propostas', { negociacao_id: nid, rodada, ...nova });
  // `rodadas` é materializado a cada proposta (6.16), lido da linha travada: nunca regride.
  if (rodada > Number(viva.rodadas ?? 0)) await trx.atualizar('negociacoes', nid, { rodadas: rodada });
  return { proposta, negociacao: viva };
}

// Quem é o autor de cada direção no registro feito pelo corretor (o Negociador grava as suas no D2).
const AUTOR_DO_REGISTRO: Record<Direcao, string> = { comprador: 'cliente', vendedor: 'corretor', proprietario: 'proprietario' };

negociacaoRotas.post(
  '/negociacoes/:id/propostas',
  assincrono(async (req, res) => {
    const dados = req.dados!;
    const nid = id(req.params.id);
    const negociacao = nid ? await dados.buscar('negociacoes', nid) : null;
    if (!negociacao) return erro(res, 404, 'NAO_ENCONTRADO', NAO_ENCONTRADA);
    if (encerrada(negociacao)) return erro(res, 409, 'NEGOCIACAO_ENCERRADA', MENSAGEM_ENCERRADA);
    const b = (req.body ?? {}) as Record<string, unknown>;
    const erros: string[] = [];
    if (!(DIRECOES as readonly unknown[]).includes(b.direcao)) erros.push('direcao: use comprador, vendedor ou proprietario.');
    if (!(Number.isInteger(b.valor_c) && (b.valor_c as number) > 0)) erros.push('valor_c: informe o valor em centavos.');
    let validade_ate: Date | null = null;
    if (b.validade_ate !== undefined && b.validade_ate !== null) {
      const d = typeof b.validade_ate === 'string' ? new Date(b.validade_ate) : null;
      if (!d || Number.isNaN(d.getTime())) erros.push('validade_ate: use data e hora (ISO).');
      else validade_ate = d;
    }
    for (const campo of ['concessao', 'contrapartida']) {
      if (b[campo] !== undefined && b[campo] !== null && typeof b[campo] !== 'string') erros.push(`${campo}: use texto.`);
    }
    if (erros.length) return erro(res, 422, 'DADOS_INVALIDOS', 'Confira a proposta.', erros);
    // No D1 só existe o registro feito pelo corretor. Enviar pelo portal ou pelo Fazer agora passa
    // pelas validações do mandato no código (10.9.7), que chegam com o motor do Negociador (D2).
    const canal = b.canal ?? 'registro';
    if (canal !== 'registro') {
      return erro(res, 422, 'CANAL_INDISPONIVEL', 'Por enquanto, só o registro de proposta está disponível; o envio pelo portal e pelo Fazer agora chega em seguida.');
    }
    const direcao = b.direcao as Direcao;
    const resultado = await dados.transaction((trx) =>
      gravarPropostaTravada(trx, nid!, {
        direcao,
        autor_tipo: AUTOR_DO_REGISTRO[direcao],
        autor_usuario_id: req.contexto?.usuario.id ?? null,
        valor_c: b.valor_c as number,
        condicoes: texto(b.condicoes, 500),
        concessao: texto(b.concessao, 200),
        contrapartida: texto(b.contrapartida, 200),
        validade_ate,
        canal,
        estado: 'registrada',
      }),
    );
    if ('recusa' in resultado) {
      return resultado.recusa === 404 ? erro(res, 404, 'NAO_ENCONTRADO', NAO_ENCONTRADA) : erro(res, 409, 'NEGOCIACAO_ENCERRADA', MENSAGEM_ENCERRADA);
    }
    const { proposta } = resultado;
    await publicar(req, direcao === 'comprador' ? 'proposta_recebida' : 'proposta_registrada', { negociacao_id: nid!, proposta_id: proposta.id });
    await portalDa(req, negociacao);
    res.status(201).json(semSigilo(proposta));
  }),
);

negociacaoRotas.get(
  '/negociador/config',
  assincrono(async (req, res) => {
    res.json(await configDaConta(req.dados!));
  }),
);

negociacaoRotas.put(
  '/negociador/config',
  assincrono(async (req, res) => {
    const dados = req.dados!;
    const b = (req.body ?? {}) as Record<string, unknown>;
    const atual = await configDaConta(dados);
    const erros: string[] = [];
    const valores: Record<string, unknown> = {};
    if (b.ligado !== undefined) {
      if (typeof b.ligado !== 'boolean') erros.push('ligado: use verdadeiro ou falso.');
      else valores.ligado = b.ligado;
    }
    if (b.conduz_padrao !== undefined) {
      if (b.conduz_padrao !== 'ia' && b.conduz_padrao !== 'humano') erros.push('conduz_padrao: use ia ou humano.');
      // A pessoa que negocia é escolhida no convite do negociador humano (D7), que ainda não existe.
      else if (b.conduz_padrao === 'humano' && !atual.negociador_padrao_id) erros.push('conduz_padrao: convide e escolha um negociador humano antes.');
      else valores.conduz_padrao = b.conduz_padrao;
    }
    if (b.estilo !== undefined) {
      if (!(ESTILOS as readonly unknown[]).includes(b.estilo)) erros.push('estilo: use cooperativo, firme ou consultivo.');
      else valores.estilo = b.estilo;
    }
    if (b.gatilhos !== undefined) {
      const g = b.gatilhos as Record<string, unknown>;
      if (!g || typeof g !== 'object' || Array.isArray(g) || Object.entries(g).some(([k, v]) => !(GATILHOS as readonly string[]).includes(k) || typeof v !== 'boolean')) {
        erros.push(`gatilhos: marque verdadeiro ou falso em ${GATILHOS.join(', ')}.`);
      } else valores.gatilhos = { ...atual.gatilhos, ...g };
    }
    if (b.instrucoes_corretor !== undefined) {
      if (b.instrucoes_corretor !== null && typeof b.instrucoes_corretor !== 'string') erros.push('instrucoes_corretor: use texto.');
      else if (typeof b.instrucoes_corretor === 'string' && b.instrucoes_corretor.trim().length > LIMITE_INSTRUCOES) {
        erros.push(`instrucoes_corretor: até ${LIMITE_INSTRUCOES.toLocaleString('pt-BR')} caracteres.`);
      } else valores.instrucoes_corretor = texto(b.instrucoes_corretor, LIMITE_INSTRUCOES);
    }
    if (b.assinatura_humana !== undefined) {
      if (b.assinatura_humana !== null && typeof b.assinatura_humana !== 'string') erros.push('assinatura_humana: use texto.');
      else if (typeof b.assinatura_humana === 'string' && b.assinatura_humana.trim().length > 120) erros.push('assinatura_humana: até 120 caracteres.');
      else valores.assinatura_humana = texto(b.assinatura_humana, 120);
    }
    if (erros.length) return erro(res, 422, 'DADOS_INVALIDOS', 'Confira os ajustes do Negociador.', erros);
    // A primeira gravação leva os padrões junto (a linha nasce aqui, nunca dentro de um GET).
    const base = atual.padrao
      ? { ligado: atual.ligado, conduz_padrao: atual.conduz_padrao, gatilhos: atual.gatilhos, estilo: atual.estilo }
      : {};
    await salvarUnico(dados, 'config_negociador', { chave: 'conta' }, { ...base, ...valores, versao: atual.versao + 1 });
    res.json(await configDaConta(dados));
  }),
);

/**
 * O playbook da conta por categoria: o padrão (Apêndice D) e a resposta do corretor, quando houver.
 * `conta` é obrigatória fora de rota (listener, SISTEMA): ali a leitura enxerga todas as contas.
 */
export async function objecoesDaConta(dados: HelperDados, conta?: number) {
  const linhas = await dados.varrerTudo('playbook_objecoes', { ...(conta ? { filtros: { conta_id: conta } } : {}), maximo: 100 });
  return PLAYBOOK_OBJECOES_PADRAO.map((p) => {
    // Conta criada depois do último boot ainda não tem a semente: o padrão vem da constante.
    const padrao = linhas.find((l) => l.categoria === p.categoria && l.origem === 'padrao') ?? p;
    const minha = linhas.find((l) => l.categoria === p.categoria && l.origem === 'corretor') ?? null;
    const resposta = (l: Linha) => ({ pergunta_exploracao: l.pergunta_exploracao, resposta_base: l.resposta_base, proximo_passo: l.proximo_passo });
    return {
      categoria: p.categoria,
      titulo: p.titulo,
      fala_cliente: padrao.fala_cliente ?? p.fala_cliente,
      padrao: resposta(padrao),
      minha: minha ? { id: minha.id, ...resposta(minha) } : null,
      usando: minha ? 'corretor' : 'padrao',
    };
  });
}

negociacaoRotas.get(
  '/negociador/objecoes',
  assincrono(async (req, res) => {
    res.json({ dados: await objecoesDaConta(req.dados!) });
  }),
);

// Uma categoria por vez: "editar a minha resposta" grava a do corretor; "usar padrão" a remove.
negociacaoRotas.put(
  '/negociador/objecoes',
  assincrono(async (req, res) => {
    const dados = req.dados!;
    const b = (req.body ?? {}) as Record<string, unknown>;
    if (!(CATEGORIAS_OBJECAO as readonly unknown[]).includes(b.categoria)) return erro(res, 422, 'DADOS_INVALIDOS', 'Categoria de objeção desconhecida.');
    const minha = await primeiro(dados, 'playbook_objecoes', { categoria: b.categoria, origem: 'corretor' });
    if (b.usar_padrao === true) {
      if (minha) await dados.remover('playbook_objecoes', minha.id, req.contexto?.usuario.id);
    } else {
      const limites: Record<string, number> = { pergunta_exploracao: 300, resposta_base: 1000, proximo_passo: 500 };
      const erros = Object.entries(limites)
        .filter(([campo, limite]) => typeof b[campo] !== 'string' || !(b[campo] as string).trim() || (b[campo] as string).trim().length > limite)
        .map(([campo, limite]) => `${campo}: obrigatório, até ${limite} caracteres.`);
      if (erros.length) return erro(res, 422, 'DADOS_INVALIDOS', 'Confira a resposta.', erros);
      const valores = Object.fromEntries(Object.keys(limites).map((c) => [c, (b[c] as string).trim()]));
      const padrao = PLAYBOOK_OBJECOES_PADRAO.find((p) => p.categoria === b.categoria)!;
      if (minha) await dados.atualizar('playbook_objecoes', minha.id, valores);
      else {
        try {
          await dados.criar('playbook_objecoes', { categoria: b.categoria, origem: 'corretor', fala_cliente: padrao.fala_cliente, ...valores });
        } catch (e) {
          if (!violouUnico(e)) throw e;
          return erro(res, 409, 'OBJECAO_ALTERADA', 'Esta resposta foi salva agora por outra tela. Abra de novo.');
        }
      }
    }
    const item = (await objecoesDaConta(dados)).find((o) => o.categoria === b.categoria);
    res.json(item);
  }),
);
