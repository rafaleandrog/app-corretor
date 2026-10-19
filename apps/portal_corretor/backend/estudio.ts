import '@urbiverso/sdk/express';
import { Router, type Request } from 'express';
import {
  checarPeca,
  contextoPeca,
  FORMATOS,
  imovelParaArte,
  INSTRUCAO_PECA,
  MAX_SLIDES,
  OBJETIVOS,
  promptCanva,
  SCHEMA_PECA,
  textosDaIa,
  textosPadrao,
  validarMarca,
  type Formato,
  type Objetivo,
  type TextosPeca,
} from '../comum/estudio';
import { autorizacaoVigente, type Autorizacao } from '../comum/imoveis';
import { assincrono, erro, guardarCorretor, primeiro, salvarUnico } from './acesso';
import { contaDoRequest } from './vitrine';

// Estúdio de Conteúdo (bloco 8a, spec 9.4, 10.5, D-74): marca, pedido → textos (IA com JSON Schema,
// ou modelo quando a IA não está disponível), arte montada pelo gerador do app no navegador do
// corretor (a plataforma não gera imagem, 10.6) ou feita no Canva IA e enviada de volta, aprovação
// com checagens e biblioteca para baixar. Agendar e publicar no Instagram chegam no bloco 8b.
export const estudioRotas: Router = Router();
guardarCorretor(estudioRotas, ['/estudio']);

const TTL = 3600;
const id = (v: unknown) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};
const texto = (v: unknown, limite: number) => (typeof v === 'string' ? v.trim().slice(0, limite) : '');
const hoje = (req: Request) => new Date().toLocaleDateString('sv-SE', { timeZone: req.contexto?.fuso || 'America/Sao_Paulo' });

async function url(req: Request, arquivo: number | null | undefined): Promise<string | null> {
  if (!arquivo || !req.arquivos) return null;
  try {
    return await req.arquivos.url(arquivo, TTL);
  } catch {
    return null;
  }
}

/** Upload recusado pelo framework (vencido, de outro usuário, destino errado) vira 4xx com mensagem. */
function uploadRecusado(e: unknown) {
  const c = (e as { codigo?: string })?.codigo;
  return c?.startsWith('ARQUIVOS_') ? 'O arquivo enviado expirou ou não serve para este campo. Envie de novo.' : null;
}

async function creci(req: Request): Promise<string | null> {
  const dados = req.dados!;
  const [eu, conta] = await Promise.all([
    primeiro(dados, 'perfis_corretor', { usuario_id: req.contexto!.usuario.id }),
    primeiro(dados, 'perfil_conta', { chave: 'conta' }),
  ]);
  return eu?.creci ?? conta?.creci_juridico ?? null;
}

/** A marca da conta (padrão até o corretor salvar), com logo e foto por URL assinada. */
async function marca(req: Request) {
  const dados = req.dados!;
  const [m, arquivos, pagina] = await Promise.all([
    primeiro(dados, 'marca_conta', { chave: 'conta' }),
    dados.listar('marca_arquivos', { por_pagina: 5 }),
    primeiro(dados, 'paginas_corretor', { chave: 'conta' }),
  ]);
  const de = (tipo: string) => arquivos.dados.find((a) => a.tipo === tipo);
  return {
    nome: pagina?.nome_exibicao || req.contexto!.usuario.nome || 'Corretor',
    creci: await creci(req),
    cor_primaria: m?.cor_primaria ?? '#0b5394',
    cor_secundaria: m?.cor_secundaria ?? '#f2b705',
    estilo: m?.estilo ?? 'moderno',
    assinatura: m?.assinatura ?? null,
    salva: !!m,
    logo_url: await url(req, de('logo')?.arquivo),
    foto_url: await url(req, de('foto')?.arquivo),
  };
}

estudioRotas.get(
  '/estudio/marca',
  assincrono(async (req, res) => {
    res.json(await marca(req));
  }),
);

estudioRotas.put(
  '/estudio/marca',
  assincrono(async (req, res) => {
    const v = validarMarca(req.body ?? {});
    if (!v.ok) return erro(res, 422, 'DADOS_INVALIDOS', 'Confira a marca.', v.erros);
    await salvarUnico(req.dados!, 'marca_conta', { chave: 'conta' }, { ...v.dados });
    res.json(await marca(req));
  }),
);

/** Logo ou foto do corretor (upload em 2 passos): troca o anterior. */
estudioRotas.post(
  '/estudio/marca/arquivos',
  assincrono(async (req, res) => {
    const tipo = ['logo', 'foto'].includes(req.body?.tipo) ? (req.body.tipo as string) : null;
    const upload = id(req.body?.upload_id);
    if (!tipo || !upload) return erro(res, 422, 'DADOS_INVALIDOS', 'Envie o logo ou a foto.');
    const dados = req.dados!;
    const atual = await primeiro(dados, 'marca_arquivos', { tipo });
    try {
      if (atual) await dados.atualizar('marca_arquivos', atual.id, { arquivo: upload });
      else await dados.criar('marca_arquivos', { tipo, arquivo: upload });
    } catch (e) {
      const msg = uploadRecusado(e);
      if (msg) return erro(res, 410, 'UPLOAD_RECUSADO', msg);
      throw e;
    }
    res.json(await marca(req));
  }),
);

// ---------- Peças ----------

/** Imóvel da conta para a peça, com as fotos públicas (URL assinada) na ordem do anúncio. */
async function imovelDaPeca(req: Request, imovelId: number | null) {
  if (!imovelId) return null;
  const dados = req.dados!;
  const im = await dados.buscar('imoveis', imovelId);
  if (!im || Number(im.conta_id) !== contaDoRequest(req)) return null;
  const [midias, autorizacoes] = await Promise.all([
    dados.varrerTudo('imovel_midias', { filtros: { imovel_id: im.id, tipo: 'foto', publica: true }, ordenar: 'ordem', ordem: 'asc', maximo: 200 }),
    dados.varrerTudo('autorizacoes_venda', { filtros: { imovel_id: im.id }, maximo: 200 }),
  ]);
  const fotos = (await Promise.all(midias.slice(0, 10).map(async (m) => ({ id: m.id, url: await url(req, m.arquivo), legenda: m.legenda ?? null })))).filter((f) => f.url);
  return { linha: im, arte: imovelParaArte(im), fotos, vigente: autorizacoes.some((a) => autorizacaoVigente(a as Autorizacao, hoje(req))) };
}

/** Textos da peça: IA (slot `conteudo`, JSON Schema) ou o modelo, quando a IA não está disponível. */
async function textos(req: Request, pedido: string, im: ReturnType<typeof imovelParaArte> | null, objetivo: Objetivo, formato: Formato): Promise<{ textos: TextosPeca; ia: boolean }> {
  const padrao = textosPadrao(im, objetivo, await creci(req));
  if (!req.ia) return { textos: padrao, ia: false };
  try {
    const estado = await req.ia.estadoSlot('conteudo');
    if (!estado?.efetivo) return { textos: padrao, ia: false };
    const r = await req.ia.consultar({ contexto: contextoPeca(pedido, im, objetivo, formato), schema: SCHEMA_PECA, slot: 'conteudo', instrucoes_sistema: INSTRUCAO_PECA });
    return { textos: textosDaIa((r.dados ?? {}) as Record<string, unknown>, padrao), ia: true };
  } catch (e) {
    const codigo = (e as { codigo?: string })?.codigo;
    if (!codigo || codigo === 'SLOT_INVALIDO') throw e; // bug do app, não "IA indisponível"
    return { textos: padrao, ia: false };
  }
}

async function comArquivos(req: Request, pecas: Record<string, any>[]) {
  if (!pecas.length) return [];
  const arquivos = await req.dados!.varrerTudo('peca_arquivos', { filtros: { peca_id: pecas.map((p) => p.id).join(',') }, ordenar: 'ordem', ordem: 'asc', maximo: 2000 });
  return Promise.all(
    pecas.map(async (p) => ({
      ...p,
      arquivos: await Promise.all(arquivos.filter((a) => a.peca_id === p.id).map(async (a) => ({ id: a.id, ordem: a.ordem, url: await url(req, a.arquivo) }))),
    })),
  );
}

estudioRotas.get(
  '/estudio/pecas',
  assincrono(async (req, res) => {
    const filtros: Record<string, unknown> = {};
    if (typeof req.query.estado === 'string' && req.query.estado) filtros.estado = req.query.estado;
    const iid = id(req.query.imovel_id);
    if (iid) filtros.imovel_id = iid;
    const r = await req.dados!.listar('pecas', { filtros, ordenar: 'criado_em', ordem: 'desc', por_pagina: 60 });
    res.json({ ...r, dados: await comArquivos(req, r.dados) });
  }),
);

/**
 * Pedido em texto (ou voz, transcrita no navegador): uma peça por formato pedido, com os textos já
 * prontos. A arte é montada em seguida pelo navegador (gerador do app) e enviada em `/arquivos`.
 */
estudioRotas.post(
  '/estudio/pedido',
  assincrono(async (req, res) => {
    const pedido = texto(req.body?.pedido, 1000);
    const objetivo = (OBJETIVOS as readonly string[]).includes(req.body?.objetivo) ? (req.body.objetivo as Objetivo) : 'destaque';
    const formatos = [...new Set((Array.isArray(req.body?.formatos) ? req.body.formatos : []).filter((f: unknown) => (FORMATOS as readonly string[]).includes(f as string)))] as Formato[];
    if (!formatos.length) return erro(res, 422, 'DADOS_INVALIDOS', 'Escolha ao menos um formato.');
    const iid = id(req.body?.imovel_id);
    const imovel = await imovelDaPeca(req, iid);
    if (iid && !imovel) return erro(res, 422, 'DADOS_INVALIDOS', 'Imóvel não encontrado.');
    if (!imovel && !pedido) return erro(res, 422, 'DADOS_INVALIDOS', 'Escreva o pedido ou escolha um imóvel.');
    const criadas: Record<string, any>[] = [];
    let usouIa = false;
    for (const formato of formatos) {
      const t = await textos(req, pedido, imovel?.arte ?? null, objetivo, formato);
      usouIa ||= t.ia;
      criadas.push(
        await req.dados!.criar('pecas', {
          imovel_id: imovel?.linha.id ?? null, formato, objetivo, pedido: pedido || null, titulo: t.textos.titulo, chamada: t.textos.chamada,
          destaques: t.textos.destaques, legenda: t.textos.legenda, hashtags: t.textos.hashtags.join(' '), motor: 'interno', estado: 'rascunho', gerada_por_ia: t.ia,
        }),
      );
    }
    res.status(201).json({ pecas: await comArquivos(req, criadas), ia: usouIa, imovel: imovel ? { arte: imovel.arte, fotos: imovel.fotos } : null });
  }),
);

/** Pacote de lançamento (10.5): post, carrossel e story de um imóvel, de uma vez. */
estudioRotas.post(
  '/estudio/pacote',
  assincrono(async (req, res) => {
    const iid = id(req.body?.imovel_id);
    if (!iid) return erro(res, 422, 'DADOS_INVALIDOS', 'Escolha o imóvel do lançamento.');
    const pedido = texto(req.body?.pedido, 1000) || 'Pacote de lançamento do imóvel';
    const imovel = await imovelDaPeca(req, iid);
    if (!imovel) return erro(res, 422, 'DADOS_INVALIDOS', 'Imóvel não encontrado.');
    const objetivo = (OBJETIVOS as readonly string[]).includes(req.body?.objetivo) ? (req.body.objetivo as Objetivo) : 'novo_imovel';
    const criadas: Record<string, any>[] = [];
    let usouIa = false;
    for (const formato of ['post_1x1', 'carrossel', 'story'] as Formato[]) {
      const t = await textos(req, pedido, imovel.arte, objetivo, formato);
      usouIa ||= t.ia;
      criadas.push(
        await req.dados!.criar('pecas', {
          imovel_id: imovel.linha.id, formato, objetivo, pedido, titulo: t.textos.titulo, chamada: t.textos.chamada, destaques: t.textos.destaques,
          legenda: t.textos.legenda, hashtags: t.textos.hashtags.join(' '), motor: 'interno', estado: 'rascunho', gerada_por_ia: t.ia,
        }),
      );
    }
    res.status(201).json({ pecas: await comArquivos(req, criadas), ia: usouIa, imovel: { arte: imovel.arte, fotos: imovel.fotos } });
  }),
);

const campos = (p: Record<string, any>, arquivos: number) => ({ formato: p.formato, objetivo: p.objetivo, legenda: p.legenda ?? null, hashtags: p.hashtags ?? null, arquivos });

async function pecaOu404(req: Request) {
  const pid = id(req.params.id);
  return pid ? req.dados!.buscar('pecas', pid) : null;
}

/** Ficha da peça: textos, arquivos, o imóvel (para o gerador montar a arte) e as checagens. */
estudioRotas.get(
  '/estudio/pecas/:id',
  assincrono(async (req, res) => {
    const p = await pecaOu404(req);
    if (!p) return erro(res, 404, 'NAO_ENCONTRADO', 'Peça não encontrada.');
    const [peca] = await comArquivos(req, [p]);
    const imovel = await imovelDaPeca(req, p.imovel_id ?? null);
    const checagem = checarPeca(campos(p, peca.arquivos.length), { creci: await creci(req), imovel: !!p.imovel_id, autorizacaoVigente: !!imovel?.vigente });
    res.json({ peca, imovel: imovel ? { arte: imovel.arte, fotos: imovel.fotos } : null, marca: await marca(req), checagem });
  }),
);

/** Editar os textos; peça já aprovada volta a rascunho (o que muda precisa de nova aprovação). */
estudioRotas.patch(
  '/estudio/pecas/:id',
  assincrono(async (req, res) => {
    const p = await pecaOu404(req);
    if (!p) return erro(res, 404, 'NAO_ENCONTRADO', 'Peça não encontrada.');
    if (['agendada', 'publicada'].includes(p.estado)) return erro(res, 409, 'PECA_TRAVADA', 'Peça agendada ou publicada não muda. Duplique ou cancele o agendamento.');
    const c = req.body ?? {};
    const mudar: Record<string, unknown> = {};
    if ('titulo' in c) mudar.titulo = texto(c.titulo, 80) || p.titulo;
    if ('chamada' in c) mudar.chamada = texto(c.chamada, 120) || null;
    if ('legenda' in c) mudar.legenda = texto(c.legenda, 2200) || null;
    if ('hashtags' in c) mudar.hashtags = texto(c.hashtags, 600) || null;
    if ('destaques' in c) mudar.destaques = (Array.isArray(c.destaques) ? c.destaques : []).map((d: unknown) => texto(d, 24)).filter(Boolean).slice(0, 4);
    if (p.estado === 'aprovada' || p.estado === 'rejeitada') Object.assign(mudar, { estado: 'rascunho', aprovada_em: null, aprovada_por_id: null });
    res.json(await req.dados!.atualizar('pecas', p.id, mudar));
  }),
);

/**
 * Arte da peça: as imagens geradas no navegador (gerador do app) ou feitas no Canva IA, enviadas em
 * 2 passos. Substitui as anteriores; arte nova pede nova aprovação.
 */
estudioRotas.put(
  '/estudio/pecas/:id/arquivos',
  assincrono(async (req, res) => {
    const p = await pecaOu404(req);
    if (!p) return erro(res, 404, 'NAO_ENCONTRADO', 'Peça não encontrada.');
    if (['agendada', 'publicada'].includes(p.estado)) return erro(res, 409, 'PECA_TRAVADA', 'Peça agendada ou publicada não muda.');
    const uploads = (Array.isArray(req.body?.upload_ids) ? req.body.upload_ids : []).map(id);
    const limite = p.formato === 'carrossel' ? MAX_SLIDES : 1;
    if (!uploads.length || uploads.some((u: number | null) => !u) || uploads.length > limite) {
      return erro(res, 422, 'DADOS_INVALIDOS', limite === 1 ? 'Envie uma imagem.' : `Envie de 1 a ${limite} imagens.`);
    }
    const motor = ['interno', 'canva_ia', 'upload'].includes(req.body?.motor) ? req.body.motor : 'upload';
    const dados = req.dados!;
    const antigos = await dados.varrerTudo('peca_arquivos', { filtros: { peca_id: p.id }, maximo: 50 });
    try {
      await dados.transaction(async (trx) => {
        // Apagar leva o arquivo antigo para a fila de exclusão (arquivos.md).
        for (const a of antigos) await trx.deletar('peca_arquivos', a.id);
        for (const [ordem, upload] of uploads.entries()) await trx.criar('peca_arquivos', { peca_id: p.id, arquivo: upload, ordem });
        await trx.atualizar('pecas', p.id, { motor, ...(p.estado === 'aprovada' || p.estado === 'rejeitada' || p.estado === 'erro' ? { estado: 'rascunho', aprovada_em: null, aprovada_por_id: null, erro: null } : {}) });
      });
    } catch (e) {
      const msg = uploadRecusado(e);
      if (msg) return erro(res, 410, 'UPLOAD_RECUSADO', msg);
      throw e;
    }
    const [peca] = await comArquivos(req, [(await dados.buscar('pecas', p.id))!]);
    res.json(peca);
  }),
);

estudioRotas.post(
  '/estudio/pecas/:id/aprovar',
  assincrono(async (req, res) => {
    const p = await pecaOu404(req);
    if (!p) return erro(res, 404, 'NAO_ENCONTRADO', 'Peça não encontrada.');
    if (p.estado !== 'rascunho' && p.estado !== 'rejeitada') return erro(res, 409, 'ESTADO_INVALIDO', 'Só rascunho é aprovado.');
    const arquivos = await req.dados!.listar('peca_arquivos', { filtros: { peca_id: p.id }, por_pagina: 1 });
    const imovel = await imovelDaPeca(req, p.imovel_id ?? null);
    const checagem = checarPeca(campos(p, arquivos.total), { creci: await creci(req), imovel: !!p.imovel_id, autorizacaoVigente: !!imovel?.vigente });
    if (!checagem.ok) return erro(res, 422, 'CHECAGEM_PENDENTE', 'Antes de aprovar, resolva:', checagem.pendencias);
    res.json(await req.dados!.atualizar('pecas', p.id, { estado: 'aprovada', aprovada_em: new Date().toISOString(), aprovada_por_id: req.contexto!.usuario.id }));
  }),
);

estudioRotas.post(
  '/estudio/pecas/:id/rejeitar',
  assincrono(async (req, res) => {
    const p = await pecaOu404(req);
    if (!p) return erro(res, 404, 'NAO_ENCONTRADO', 'Peça não encontrada.');
    if (p.estado === 'publicada') return erro(res, 409, 'ESTADO_INVALIDO', 'Peça publicada não volta.');
    res.json(await req.dados!.atualizar('pecas', p.id, { estado: 'rejeitada', aprovada_em: null, aprovada_por_id: null }));
  }),
);

estudioRotas.patch(
  '/estudio/pecas/:id/remover',
  assincrono(async (req, res) => {
    const p = await pecaOu404(req);
    if (!p) return erro(res, 404, 'NAO_ENCONTRADO', 'Peça não encontrada.');
    if (p.estado === 'agendada') return erro(res, 409, 'PECA_AGENDADA', 'Cancele o agendamento antes de remover.');
    await req.dados!.remover('pecas', p.id, req.contexto!.usuario.id);
    res.json({ id: p.id, removido: true });
  }),
);

/** Pacote para o Canva IA (D-74): a instrução pronta e as fotos para anexar. */
estudioRotas.get(
  '/estudio/pecas/:id/canva',
  assincrono(async (req, res) => {
    const p = await pecaOu404(req);
    if (!p) return erro(res, 404, 'NAO_ENCONTRADO', 'Peça não encontrada.');
    const imovel = await imovelDaPeca(req, p.imovel_id ?? null);
    const m = await marca(req);
    const fotos = (imovel?.fotos ?? []).slice(0, p.formato === 'carrossel' ? MAX_SLIDES : 3);
    const prompt = promptCanva(
      { formato: p.formato, objetivo: p.objetivo, textos: { titulo: p.titulo, chamada: p.chamada ?? '', destaques: Array.isArray(p.destaques) ? p.destaques : [], legenda: p.legenda ?? '', hashtags: [] }, fotos: fotos.length },
      m,
      imovel?.arte ?? null,
    );
    res.json({ prompt, fotos, logo_url: m.logo_url, abrir: 'https://www.canva.com/ai' });
  }),
);
