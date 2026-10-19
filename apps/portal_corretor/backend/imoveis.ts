import '@urbiverso/sdk/express';
import { Router, type Request, type Response } from 'express';
import type { HelperDados } from '@urbiverso/sdk';
import {
  AMBIENTES,
  autorizacaoVigente,
  contextoDescricao,
  INSTRUCAO_DESCRICAO,
  INSTRUCAO_FOTO,
  podeGerarDescricao,
  proximoCodigo,
  qualidadeAnuncio,
  SCHEMA_DESCRICAO,
  SCHEMA_FOTO,
  SITUACOES_ANUNCIADAS,
  SITUACOES_IMOVEL,
  situacaoAutorizacao,
  sugerirOrdem,
  TIPOS_MATERIAL,
  TIPOS_MIDIA,
  validarAutorizacao,
  validarEmpreendimento,
  validarImovel,
  type Autorizacao,
} from '../comum/imoveis';
import { normalizarPapeis } from '../comum/crm';
import { assincrono, erro, guardarCorretor, primeiro } from './acesso';
import { tentarSincronizar } from './vitrine';

// Imóveis (anúncios), mídias, autorizações de venda e empreendimentos (bloco 3). Tabelas
// segregadas por conta; arquivos servidos só por URL assinada gerada aqui (tabela `restrito`).
export const imoveisRotas: Router = Router();
guardarCorretor(imoveisRotas, ['/imoveis', '/autorizacoes', '/empreendimentos']);

const POR_PAGINA = 50;
const TTL_URL = 3600;
/** Teto de arquivos por imóvel: mantém a listagem (50 imóveis por página) dentro do `maximo` da leitura. */
const LIMITE_MIDIAS = 80;
const id = (v: unknown) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};
const violouUnico = (e: unknown) => (e as { code?: string })?.code === '23505';
/** Hoje no fuso da conta, `AAAA-MM-DD` (as datas da autorização são datas civis). */
const hoje = (req: Request) => new Date().toLocaleDateString('sv-SE', { timeZone: req.contexto?.fuso || 'America/Sao_Paulo' });

/** URL assinada de um arquivo; sem `req.arquivos` (teste, contexto sem schema), sem URL. */
async function url(req: Request, arquivo: number | null | undefined): Promise<string | null> {
  if (!arquivo || !req.arquivos) return null;
  try {
    return await req.arquivos.url(arquivo, TTL_URL);
  } catch {
    return null; // arquivo que saiu (Faxina, takedown) não derruba a ficha
  }
}

async function temCreci(dados: HelperDados): Promise<boolean> {
  const corretor = await primeiro(dados, 'perfis_corretor', { 'creci[nulo]': 'false' });
  if (corretor) return true;
  const conta = await primeiro(dados, 'perfil_conta', { chave: 'conta' });
  return !!conta?.creci_juridico;
}

/** Erro de `upload_id` recusado pelo framework (vencido, de outro usuário, destino errado). */
export function uploadRecusado(e: unknown): { status: number; mensagem: string } | null {
  const c = (e as { codigo?: string })?.codigo;
  if (!c?.startsWith('ARQUIVOS_')) return null;
  return {
    status: c === 'ARQUIVOS_UPLOAD_DE_OUTRO_USUARIO' ? 403 : c === 'ARQUIVOS_DESTINO_INVALIDO' ? 400 : c === 'ARQUIVOS_NAO_ENCONTRADO' ? 404 : 410,
    mensagem: 'O arquivo enviado expirou ou não serve para este campo. Envie de novo.',
  };
}

/** Mídias, autorizações e a qualidade de um conjunto de imóveis, numa leitura por tabela. */
async function complementos(req: Request, imoveis: Record<string, any>[]) {
  const dados = req.dados!;
  if (!imoveis.length) return new Map<number, { midias: any[]; autorizacoes: any[] }>();
  const ids = imoveis.map((i) => i.id).join(',');
  const [midias, autorizacoes] = await Promise.all([
    dados.varrerTudo('imovel_midias', { filtros: { imovel_id: ids }, ordenar: 'ordem', ordem: 'asc', maximo: 5000 }),
    dados.varrerTudo('autorizacoes_venda', { filtros: { imovel_id: ids }, ordenar: 'id', ordem: 'desc', maximo: 2000 }),
  ]);
  const mapa = new Map<number, { midias: any[]; autorizacoes: any[] }>();
  for (const i of imoveis) mapa.set(i.id, { midias: [], autorizacoes: [] });
  for (const m of midias) mapa.get(m.imovel_id)?.midias.push(m);
  for (const a of autorizacoes) mapa.get(a.imovel_id)?.autorizacoes.push(a);
  return mapa;
}

function resumo(im: Record<string, any>, extra: { midias: any[]; autorizacoes: any[] }, dia: string, creci: boolean) {
  const vigente = extra.autorizacoes.some((a) => autorizacaoVigente(a as Autorizacao, dia));
  const fotosPublicas = extra.midias.filter((m) => m.tipo === 'foto' && m.publica).length;
  const qualidade = qualidadeAnuncio(im, { fotosPublicas, autorizacaoVigente: vigente, creci });
  // Publicável: o que poderá aparecer fora do app (Minha Página, ficha pública) — bloco 5 lê isto.
  const publicavel = im.publicado_pagina && SITUACOES_ANUNCIADAS.includes(im.situacao) && vigente;
  return { qualidade, autorizacao_vigente: vigente, publicavel, fotos_publicas: fotosPublicas };
}

/** Conteúdo devolvido pela extração (texto JSON ou objeto); `null` se não for um objeto. */
function lerObjeto(conteudo: unknown): Record<string, unknown> | null {
  let v = conteudo;
  if (typeof v === 'string') {
    try {
      v = JSON.parse(v);
    } catch {
      return null;
    }
  }
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/**
 * Erro do helper de IA (ia.md: "o helper lança exceções que a app deve capturar"): vira 503 com
 * mensagem do app, sem repassar o texto interno. Erro que não é da IA segue para o tratador.
 */
function falhaIa(res: Response, e: unknown, mensagem: string) {
  const codigo = (e as { codigo?: string })?.codigo;
  // Sem código, ou slot fora do manifesto (bug do app, ia.md): não vira "IA indisponível".
  if (!codigo || codigo === 'SLOT_INVALIDO') throw e;
  return erro(res, 503, 'IA_INDISPONIVEL', codigo === 'SLOT_NAO_CONFIGURADO' ? 'A IA não está liberada para o app agora.' : mensagem);
}

/** `estadoSlot` sem custo; falha da sonda conta como indisponível, salvo slot fora do manifesto. */
async function sondar(req: Request, slot: string) {
  if (!req.ia) return null;
  try {
    return await req.ia.estadoSlot(slot);
  } catch (e) {
    if ((e as { codigo?: string })?.codigo === 'SLOT_INVALIDO') throw e;
    return null;
  }
}

// ---------- Imóveis ----------

imoveisRotas.get(
  '/imoveis',
  assincrono(async (req, res) => {
    const filtros: Record<string, unknown> = {};
    if (typeof req.query.situacao === 'string' && (SITUACOES_IMOVEL as readonly string[]).includes(req.query.situacao)) filtros.situacao = req.query.situacao;
    const eid = id(req.query.empreendimento_id);
    if (eid) filtros.empreendimento_id = eid;
    if (req.query.publicado_pagina === 'true') filtros.publicado_pagina = true;
    const busca = typeof req.query.busca === 'string' ? req.query.busca.trim().slice(0, 100) : '';
    const pagina = Math.min(Math.max(Math.trunc(Number(req.query.pagina)) || 1, 1), 1000);
    const r = await req.dados!.listar('imoveis', {
      filtros,
      busca_ou: busca ? { colunas: ['codigo', 'titulo', 'bairro', 'cidade'], termo: busca } : undefined,
      ordenar: 'atualizado_em',
      ordem: 'desc',
      pagina,
      por_pagina: POR_PAGINA,
    });
    const [extras, creci] = await Promise.all([complementos(req, r.dados), temCreci(req.dados!)]);
    const dia = hoje(req);
    const dados = await Promise.all(
      r.dados.map(async (im) => {
        const extra = extras.get(im.id)!;
        const capa = extra.midias.find((m) => m.tipo === 'foto');
        return { ...im, ...resumo(im, extra, dia, creci), capa_url: await url(req, capa?.arquivo) };
      }),
    );
    res.json({ ...r, dados });
  }),
);

imoveisRotas.post(
  '/imoveis',
  assincrono(async (req, res) => {
    const v = validarImovel(req.body ?? {});
    if (!v.ok) return erro(res, 422, 'DADOS_INVALIDOS', 'Confira o imóvel.', v.erros);
    const dados = req.dados!;
    // Código do corretor, ou o próximo `IM-nnnn`. Código repetido entre os vivos: 409 ou próximo número.
    const proprio = v.dados.codigo;
    for (let tentativa = 0; tentativa < 5; tentativa++) {
      const codigo =
        proprio ?? proximoCodigo((await dados.listar('imoveis', { filtros: { 'codigo[busca]': 'IM-' }, ordenar: 'id', ordem: 'desc', por_pagina: 200 })).dados.map((i) => i.codigo));
      try {
        const imovel = await dados.criar('imoveis', { ...v.dados, codigo, situacao: 'rascunho', publicado_pagina: false });
        return res.status(201).json(imovel);
      } catch (e) {
        if (!violouUnico(e)) throw e;
        if (proprio) return erro(res, 409, 'CODIGO_REPETIDO', `Já existe um imóvel com o código ${proprio}.`);
      }
    }
    return erro(res, 409, 'CODIGO_REPETIDO', 'Não foi possível gerar o código agora. Tente de novo.');
  }),
);

imoveisRotas.get(
  '/imoveis/ia',
  assincrono(async (req, res) => {
    // Sonda sem custo (estadoSlot): a tela mostra os botões de IA só quando o slot resolve.
    const estado = async (slot: string) => {
      if (!req.ia) return false;
      try {
        return !!(await req.ia.estadoSlot(slot)).efetivo;
      } catch (e) {
        // Slot fora do manifesto é bug do app, não "IA desligada": não esconde.
        if ((e as { codigo?: string })?.codigo === 'SLOT_INVALIDO') throw e;
        return false;
      }
    };
    res.json({ fotos: await estado('fotos'), conteudo: await estado('conteudo') });
  }),
);

imoveisRotas.get(
  '/imoveis/:id',
  assincrono(async (req, res) => {
    const iid = id(req.params.id);
    const dados = req.dados!;
    const imovel = iid ? await dados.buscar('imoveis', iid) : null;
    if (!imovel) return erro(res, 404, 'NAO_ENCONTRADO', 'Imóvel não encontrado.');
    const [extras, creci, visitas, negocios] = await Promise.all([
      complementos(req, [imovel]),
      temCreci(dados),
      dados.listar('visitas', { filtros: { imovel_id: iid }, ordenar: 'id', ordem: 'desc', por_pagina: 100 }),
      dados.listar('negocios', { filtros: { imovel_id: iid }, por_pagina: 100 }),
    ]);
    const extra = extras.get(iid!)!;
    const dia = hoje(req);
    const idsAtividade = visitas.dados.map((v) => v.atividade_id);
    const atividades = idsAtividade.length ? (await dados.listar('atividades', { filtros: { id: idsAtividade.join(',') }, por_pagina: 100 })).dados : [];
    const porAtividade = new Map(atividades.map((a) => [a.id, a]));
    res.json({
      imovel,
      ...resumo(imovel, extra, dia, creci),
      midias: await Promise.all(extra.midias.map(async (m) => ({ ...m, url: await url(req, m.arquivo) }))),
      autorizacoes: extra.autorizacoes.map((a) => ({ ...a, situacao_efetiva: situacaoAutorizacao(a as Autorizacao, dia), vigente: autorizacaoVigente(a as Autorizacao, dia) })),
      visitas: visitas.dados.map((v) => {
        const a = porAtividade.get(v.atividade_id);
        return { ...v, quando: a?.quando ?? null, status: a?.status ?? null, contato_id: a?.contato_id ?? null, contato_nome: a?.contato_nome ?? null };
      }),
      negocios: negocios.dados,
    });
  }),
);

/** Confere que o proprietário é um contato da conta. Não grava nada: o papel vem depois do sucesso. */
async function proprietario(dados: HelperDados, bruto: unknown): Promise<{ id: number | null; contato?: Record<string, any> } | { erro: string }> {
  if (bruto === null || bruto === '') return { id: null };
  const cid = id(bruto);
  const contato = cid ? await dados.buscar('contatos', cid) : null;
  if (!contato) return { erro: 'Proprietário não encontrado entre os seus contatos.' };
  return { id: cid, contato };
}

/** O contato que passou a ser proprietário ganha o papel `proprietario` se ainda não tinha. */
async function marcarProprietario(dados: HelperDados, contato?: Record<string, any>) {
  if (!contato) return;
  const papeis = normalizarPapeis(contato.papeis);
  if (!papeis.includes('proprietario')) await dados.atualizar('contatos', contato.id, { papeis: normalizarPapeis([...papeis, 'proprietario']).join(',') });
}

imoveisRotas.patch(
  '/imoveis/:id',
  assincrono(async (req, res) => {
    const iid = id(req.params.id);
    const dados = req.dados!;
    const atual = iid ? await dados.buscar('imoveis', iid) : null;
    if (!atual) return erro(res, 404, 'NAO_ENCONTRADO', 'Imóvel não encontrado.');
    const corpo = req.body ?? {};
    const v = validarImovel(corpo, true);
    if (!v.ok) return erro(res, 422, 'DADOS_INVALIDOS', 'Confira o imóvel.', v.erros);
    const mudar: Record<string, unknown> = { ...v.dados };
    let novoProprietario: Record<string, any> | undefined;
    if ('proprietario_id' in corpo) {
      const p = await proprietario(dados, corpo.proprietario_id);
      if ('erro' in p) return erro(res, 422, 'DADOS_INVALIDOS', p.erro);
      mudar.proprietario_id = p.id;
      novoProprietario = p.contato;
    }
    if ('empreendimento_id' in corpo) {
      const eid = corpo.empreendimento_id === null || corpo.empreendimento_id === '' ? null : id(corpo.empreendimento_id);
      if (corpo.empreendimento_id !== null && corpo.empreendimento_id !== '' && (!eid || !(await dados.buscar('empreendimentos', eid)))) {
        return erro(res, 422, 'DADOS_INVALIDOS', 'Empreendimento não encontrado.');
      }
      mudar.empreendimento_id = eid;
    }
    if ('situacao' in corpo) {
      if (!(SITUACOES_IMOVEL as readonly string[]).includes(corpo.situacao)) return erro(res, 422, 'DADOS_INVALIDOS', 'Situação inválida.');
      mudar.situacao = corpo.situacao;
    }
    if ('publicado_pagina' in corpo) mudar.publicado_pagina = corpo.publicado_pagina === true;
    // Anúncio só dentro da autorização (spec 6.3): ativo, reservado e publicado pedem autorização vigente.
    const situacao = (mudar.situacao ?? atual.situacao) as string;
    const publicando = mudar.publicado_pagina === true && !atual.publicado_pagina;
    const anunciando = mudar.situacao !== undefined && SITUACOES_ANUNCIADAS.includes(situacao) && !SITUACOES_ANUNCIADAS.includes(atual.situacao);
    if (publicando || anunciando) {
      const auts = await dados.listar('autorizacoes_venda', { filtros: { imovel_id: iid, situacao: 'assinada' }, por_pagina: 50 });
      if (!auts.dados.some((a) => autorizacaoVigente(a as Autorizacao, hoje(req)))) {
        return erro(res, 409, 'SEM_AUTORIZACAO', 'Para anunciar, anexe a autorização de venda assinada e dentro da vigência.');
      }
    }
    try {
      const imovel = await dados.atualizar('imoveis', iid!, mudar);
      if (!imovel) return erro(res, 404, 'NAO_ENCONTRADO', 'Imóvel não encontrado.');
      await marcarProprietario(dados, novoProprietario);
      // A vitrine pública acompanha o anúncio (bloco 5).
      await tentarSincronizar(req, imovel.id);
      res.json(imovel);
    } catch (e) {
      if (violouUnico(e)) return erro(res, 409, 'CODIGO_REPETIDO', 'Já existe um imóvel com este código.');
      throw e;
    }
  }),
);

imoveisRotas.patch(
  '/imoveis/:id/remover',
  assincrono(async (req, res) => {
    const iid = id(req.params.id);
    const dados = req.dados!;
    if (!iid || !(await dados.buscar('imoveis', iid))) return erro(res, 404, 'NAO_ENCONTRADO', 'Imóvel não encontrado.');
    // Sai da página antes de sair da lista; mídias e autorizações ficam (soft delete).
    await dados.atualizar('imoveis', iid, { publicado_pagina: false });
    await dados.remover('imoveis', iid, req.contexto!.usuario.id);
    await tentarSincronizar(req, iid);
    res.json({ ok: true });
  }),
);

// ---------- Mídias ----------

async function imovelOu404(req: Request) {
  const iid = id(req.params.id);
  return iid ? await req.dados!.buscar('imoveis', iid) : null;
}

async function midiaDoImovel(req: Request, imovelId: number) {
  const mid = id(req.params.midia);
  const m = mid ? await req.dados!.buscar('imovel_midias', mid) : null;
  return m && m.imovel_id === imovelId ? m : null;
}

imoveisRotas.post(
  '/imoveis/:id/midias',
  assincrono(async (req, res) => {
    const imovel = await imovelOu404(req);
    if (!imovel) return erro(res, 404, 'NAO_ENCONTRADO', 'Imóvel não encontrado.');
    const upload = id(req.body?.upload_id);
    if (!upload) return erro(res, 422, 'DADOS_INVALIDOS', 'Envie o arquivo antes.');
    const tipo = (TIPOS_MIDIA as readonly string[]).includes(req.body?.tipo) ? req.body.tipo : 'foto';
    const dados = req.dados!;
    const ultima = await dados.listar('imovel_midias', { filtros: { imovel_id: imovel.id }, ordenar: 'ordem', ordem: 'desc', por_pagina: 1 });
    if (ultima.total >= LIMITE_MIDIAS) return erro(res, 409, 'LIMITE_MIDIAS', `Cada imóvel guarda até ${LIMITE_MIDIAS} arquivos. Apague alguns antes.`);
    try {
      const midia = await dados.criar('imovel_midias', {
        imovel_id: imovel.id,
        arquivo: upload,
        tipo,
        ordem: (ultima.dados[0]?.ordem ?? -1) + 1,
        legenda: typeof req.body?.legenda === 'string' ? req.body.legenda.trim().slice(0, 200) || null : null,
        // Documento (autorização, matrícula) nunca é público; o resto nasce público.
        publica: tipo === 'documento' ? false : req.body?.publica !== false,
      });
      await tentarSincronizar(req, imovel.id);
      res.status(201).json({ ...midia, url: await url(req, midia.arquivo) });
    } catch (e) {
      const r = uploadRecusado(e);
      if (r) return erro(res, r.status, 'UPLOAD_RECUSADO', r.mensagem);
      throw e;
    }
  }),
);

imoveisRotas.put(
  '/imoveis/:id/midias/ordem',
  assincrono(async (req, res) => {
    const imovel = await imovelOu404(req);
    if (!imovel) return erro(res, 404, 'NAO_ENCONTRADO', 'Imóvel não encontrado.');
    const ids: unknown[] = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const dados = req.dados!;
    const atuais = await dados.varrerTudo('imovel_midias', { filtros: { imovel_id: imovel.id }, maximo: 1000 });
    const daqui = new Set(atuais.map((m) => m.id));
    const lista = ids.map(id);
    if (lista.length !== atuais.length || new Set(lista).size !== lista.length || lista.some((m) => !m || !daqui.has(m))) {
      return erro(res, 422, 'DADOS_INVALIDOS', 'Envie todas as mídias do imóvel, uma vez cada.');
    }
    await dados.transaction(async (trx) => {
      for (const [ordem, mid] of lista.entries()) await trx.atualizar('imovel_midias', mid!, { ordem });
    });
    await tentarSincronizar(req, imovel.id);
    res.json({ ok: true });
  }),
);

imoveisRotas.post(
  '/imoveis/:id/midias/ordem-sugerida',
  assincrono(async (req, res) => {
    const imovel = await imovelOu404(req);
    if (!imovel) return erro(res, 404, 'NAO_ENCONTRADO', 'Imóvel não encontrado.');
    const dados = req.dados!;
    const atuais = await dados.varrerTudo('imovel_midias', { filtros: { imovel_id: imovel.id }, maximo: 1000 });
    const ordem = sugerirOrdem(atuais as any);
    await dados.transaction(async (trx) => {
      for (const [i, mid] of ordem.entries()) await trx.atualizar('imovel_midias', mid, { ordem: i });
    });
    res.json({ ids: ordem });
  }),
);

imoveisRotas.patch(
  '/imoveis/:id/midias/:midia',
  assincrono(async (req, res) => {
    const imovel = await imovelOu404(req);
    const midia = imovel ? await midiaDoImovel(req, imovel.id) : null;
    if (!midia) return erro(res, 404, 'NAO_ENCONTRADO', 'Arquivo não encontrado.');
    const mudar: Record<string, unknown> = {};
    const corpo = req.body ?? {};
    if ('legenda' in corpo) mudar.legenda = typeof corpo.legenda === 'string' ? corpo.legenda.trim().slice(0, 200) || null : null;
    if ('tipo' in corpo) {
      if (!(TIPOS_MIDIA as readonly string[]).includes(corpo.tipo)) return erro(res, 422, 'DADOS_INVALIDOS', 'Tipo de arquivo inválido.');
      mudar.tipo = corpo.tipo;
    }
    if ('publica' in corpo) mudar.publica = corpo.publica === true;
    // O documento de uma autorização nunca vira foto nem fica público, por nenhum caminho.
    if ((mudar.tipo !== undefined && mudar.tipo !== 'documento') || mudar.publica === true) {
      const usa = await primeiro(req.dados!, 'autorizacoes_venda', { documento_midia_id: midia.id });
      if (usa) return erro(res, 409, 'DOCUMENTO_EM_USO', 'Este arquivo é o documento de uma autorização: fica sempre interno.');
    }
    if ((mudar.tipo ?? midia.tipo) === 'documento' && (mudar.publica ?? midia.publica)) mudar.publica = false;
    const salva = Object.keys(mudar).length ? await req.dados!.atualizar('imovel_midias', midia.id, mudar) : midia;
    await tentarSincronizar(req, imovel!.id);
    res.json(salva);
  }),
);

imoveisRotas.patch(
  '/imoveis/:id/midias/:midia/remover',
  assincrono(async (req, res) => {
    const imovel = await imovelOu404(req);
    const midia = imovel ? await midiaDoImovel(req, imovel.id) : null;
    if (!midia) return erro(res, 404, 'NAO_ENCONTRADO', 'Arquivo não encontrado.');
    const dados = req.dados!;
    const usa = await primeiro(dados, 'autorizacoes_venda', { documento_midia_id: midia.id, situacao: 'assinada' });
    if (usa) return erro(res, 409, 'DOCUMENTO_EM_USO', 'Este arquivo é o documento de uma autorização assinada. Revogue ou troque o documento antes.');
    // Apagar de verdade leva o arquivo para a fila de exclusão (arquivos.md).
    await dados.deletar('imovel_midias', midia.id);
    await tentarSincronizar(req, imovel!.id);
    res.json({ ok: true });
  }),
);

imoveisRotas.post(
  '/imoveis/:id/midias/:midia/analisar',
  assincrono(async (req, res) => {
    const imovel = await imovelOu404(req);
    const midia = imovel ? await midiaDoImovel(req, imovel.id) : null;
    if (!midia) return erro(res, 404, 'NAO_ENCONTRADO', 'Arquivo não encontrado.');
    if (midia.tipo !== 'foto') return erro(res, 422, 'DADOS_INVALIDOS', 'Só fotos são lidas.');
    const estado = await sondar(req, 'fotos');
    if (!estado?.efetivo) return erro(res, 503, 'IA_INDISPONIVEL', 'A leitura de fotos não está disponível agora.');
    let bruto: Record<string, unknown> | null;
    try {
      const r = await req.ia!.extrairConteudo({ arquivo_id: midia.arquivo }, { instrucao: INSTRUCAO_FOTO, schema: SCHEMA_FOTO, slot: 'fotos' });
      bruto = lerObjeto(r.conteudo);
    } catch (e) {
      return falhaIa(res, e, 'A leitura da foto falhou agora.');
    }
    // O app valida a resposta: fora do formato, não grava nada.
    if (!bruto) return erro(res, 503, 'IA_INDISPONIVEL', 'A leitura da foto voltou fora do formato. Tente de novo.');
    const ambiente = (AMBIENTES as readonly string[]).includes(bruto.ambiente as string) ? (bruto.ambiente as string) : 'outro';
    const nota = Number.isInteger(bruto.nota) ? Math.min(Math.max(bruto.nota as number, 0), 10) : null;
    const legenda = typeof bruto.legenda === 'string' ? bruto.legenda.trim().slice(0, 200) : '';
    const salva = await req.dados!.atualizar('imovel_midias', midia.id, {
      ia_ambiente: ambiente,
      ia_nota: nota,
      // A legenda da IA só preenche a vazia: a do corretor nunca é trocada.
      ...(midia.legenda || !legenda ? {} : { legenda }),
    });
    if (!midia.legenda && legenda) await tentarSincronizar(req, imovel!.id);
    res.json(salva);
  }),
);

imoveisRotas.post(
  '/imoveis/:id/descricao',
  assincrono(async (req, res) => {
    const imovel = await imovelOu404(req);
    if (!imovel) return erro(res, 404, 'NAO_ENCONTRADO', 'Imóvel não encontrado.');
    const falta = podeGerarDescricao(imovel);
    if (falta) return erro(res, 422, 'DADOS_INSUFICIENTES', falta);
    const estado = await sondar(req, 'conteudo');
    if (!estado?.efetivo) return erro(res, 503, 'IA_INDISPONIVEL', 'A escrita com IA não está disponível agora. Escreva a descrição à mão.');
    const midias = await req.dados!.listar('imovel_midias', { filtros: { imovel_id: imovel.id, tipo: 'foto' }, por_pagina: 100 });
    const ambientes = midias.dados.map((m) => m.ia_ambiente).filter(Boolean) as string[];
    let r;
    try {
      r = await req.ia!.consultar({ contexto: contextoDescricao(imovel, ambientes), schema: SCHEMA_DESCRICAO, slot: 'conteudo', instrucoes_sistema: INSTRUCAO_DESCRICAO });
    } catch (e) {
      return falhaIa(res, e, 'A escrita com IA falhou agora. Tente de novo ou escreva à mão.');
    }
    // Sugestão: não grava. O corretor revisa e salva pela edição do imóvel.
    res.json({
      titulo: String(r.dados.titulo ?? '').slice(0, 120),
      descricao: String(r.dados.descricao ?? '').slice(0, 8000),
      destaques: Array.isArray(r.dados.destaques) ? r.dados.destaques.map(String).slice(0, 8) : [],
    });
  }),
);

// ---------- Autorizações de venda ----------

imoveisRotas.post(
  '/autorizacoes',
  assincrono(async (req, res) => {
    const dados = req.dados!;
    const iid = id(req.body?.imovel_id);
    const imovel = iid ? await dados.buscar('imoveis', iid) : null;
    if (!imovel) return erro(res, 422, 'DADOS_INVALIDOS', 'Imóvel não encontrado.');
    const v = validarAutorizacao(req.body ?? {});
    if (!v.ok) return erro(res, 422, 'DADOS_INVALIDOS', 'Confira a autorização.', v.erros);
    const p = await proprietario(dados, req.body?.proprietario_id ?? imovel.proprietario_id);
    if ('erro' in p || !p.id) return erro(res, 422, 'DADOS_INVALIDOS', 'erro' in p ? p.erro : 'Escolha o proprietário que assina a autorização.');
    const situacao = v.dados.situacao === 'assinada' ? 'rascunho' : (v.dados.situacao ?? 'rascunho'); // assinar pede documento: rota de PATCH
    // Autorização, proprietário do imóvel e papel do contato juntos: retry não duplica pela metade.
    const aut = await dados.transaction(async (trx) => {
      const nova = await trx.criar('autorizacoes_venda', { ...v.dados, situacao, imovel_id: iid, proprietario_id: p.id });
      if (!imovel.proprietario_id) await trx.atualizar('imoveis', imovel.id, { proprietario_id: p.id });
      await marcarProprietario(trx, p.contato);
      return nova;
    });
    await tentarSincronizar(req, imovel.id);
    res.status(201).json(aut);
  }),
);

imoveisRotas.patch(
  '/autorizacoes/:id',
  assincrono(async (req, res) => {
    const aid = id(req.params.id);
    const dados = req.dados!;
    const atual = aid ? await dados.buscar('autorizacoes_venda', aid) : null;
    if (!atual) return erro(res, 404, 'NAO_ENCONTRADO', 'Autorização não encontrada.');
    const v = validarAutorizacao(req.body ?? {}, true);
    if (!v.ok) return erro(res, 422, 'DADOS_INVALIDOS', 'Confira a autorização.', v.erros);
    const mudar: Record<string, unknown> = { ...v.dados };
    const inicio = (mudar.inicio ?? atual.inicio) as string;
    const fim = (mudar.fim ?? atual.fim) as string;
    if (fim < inicio) return erro(res, 422, 'DADOS_INVALIDOS', 'O fim vem depois do início.');
    if ('documento_midia_id' in (req.body ?? {})) {
      const mid = id(req.body.documento_midia_id);
      const doc = mid ? await dados.buscar('imovel_midias', mid) : null;
      if (req.body.documento_midia_id !== null && (!doc || doc.imovel_id !== atual.imovel_id)) {
        return erro(res, 422, 'DADOS_INVALIDOS', 'Escolha um arquivo deste imóvel como documento.');
      }
      mudar.documento_midia_id = doc ? doc.id : null;
      // O documento assinado nunca fica público.
      if (doc && (doc.tipo !== 'documento' || doc.publica)) await dados.atualizar('imovel_midias', doc.id, { tipo: 'documento', publica: false });
    }
    const situacao = (mudar.situacao ?? atual.situacao) as string;
    const documento = 'documento_midia_id' in mudar ? mudar.documento_midia_id : atual.documento_midia_id;
    if (situacao === 'assinada' && !documento) {
      return erro(res, 422, 'DOCUMENTO_OBRIGATORIO', 'Anexe o documento assinado antes de marcar a autorização como assinada.');
    }
    const aut = await dados.atualizar('autorizacoes_venda', aid!, mudar);
    await tentarSincronizar(req, atual.imovel_id);
    res.json(aut);
  }),
);

// ---------- Empreendimentos ----------

imoveisRotas.get(
  '/empreendimentos',
  assincrono(async (req, res) => {
    const busca = typeof req.query.busca === 'string' ? req.query.busca.trim().slice(0, 100) : '';
    const r = await req.dados!.listar('empreendimentos', {
      busca_ou: busca ? { colunas: ['nome', 'construtora', 'cidade', 'regiao'], termo: busca } : undefined,
      ordenar: 'nome',
      ordem: 'asc',
      por_pagina: 200,
    });
    res.json(r);
  }),
);

imoveisRotas.post(
  '/empreendimentos',
  assincrono(async (req, res) => {
    const v = validarEmpreendimento(req.body ?? {});
    if (!v.ok) return erro(res, 422, 'DADOS_INVALIDOS', 'Confira o empreendimento.', v.erros);
    try {
      res.status(201).json(await req.dados!.criar('empreendimentos', v.dados));
    } catch (e) {
      if (violouUnico(e)) return erro(res, 409, 'NOME_REPETIDO', 'Já existe um empreendimento com este nome.');
      throw e;
    }
  }),
);

imoveisRotas.get(
  '/empreendimentos/:id',
  assincrono(async (req, res) => {
    const eid = id(req.params.id);
    const dados = req.dados!;
    const emp = eid ? await dados.buscar('empreendimentos', eid) : null;
    if (!emp) return erro(res, 404, 'NAO_ENCONTRADO', 'Empreendimento não encontrado.');
    const [materiais, imoveis] = await Promise.all([
      dados.listar('empreendimento_materiais', { filtros: { empreendimento_id: eid }, ordenar: 'id', ordem: 'asc', por_pagina: 200 }),
      dados.listar('imoveis', { filtros: { empreendimento_id: eid }, ordenar: 'codigo', ordem: 'asc', por_pagina: 200 }),
    ]);
    res.json({
      empreendimento: emp,
      materiais: await Promise.all(materiais.dados.map(async (m) => ({ ...m, url: await url(req, m.arquivo) }))),
      imoveis: imoveis.dados,
    });
  }),
);

imoveisRotas.patch(
  '/empreendimentos/:id',
  assincrono(async (req, res) => {
    const eid = id(req.params.id);
    const dados = req.dados!;
    if (!eid || !(await dados.buscar('empreendimentos', eid))) return erro(res, 404, 'NAO_ENCONTRADO', 'Empreendimento não encontrado.');
    const v = validarEmpreendimento(req.body ?? {}, true);
    if (!v.ok) return erro(res, 422, 'DADOS_INVALIDOS', 'Confira o empreendimento.', v.erros);
    try {
      res.json(await dados.atualizar('empreendimentos', eid, v.dados));
    } catch (e) {
      if (violouUnico(e)) return erro(res, 409, 'NOME_REPETIDO', 'Já existe um empreendimento com este nome.');
      throw e;
    }
  }),
);

imoveisRotas.patch(
  '/empreendimentos/:id/remover',
  assincrono(async (req, res) => {
    const eid = id(req.params.id);
    const dados = req.dados!;
    if (!eid || !(await dados.buscar('empreendimentos', eid))) return erro(res, 404, 'NAO_ENCONTRADO', 'Empreendimento não encontrado.');
    const vinculados = await dados.listar('imoveis', { filtros: { empreendimento_id: eid }, por_pagina: 1 });
    if (vinculados.total) return erro(res, 409, 'EM_USO', 'Há imóveis ligados a este empreendimento. Desligue-os antes de remover.');
    await dados.remover('empreendimentos', eid, req.contexto!.usuario.id);
    res.json({ ok: true });
  }),
);

imoveisRotas.post(
  '/empreendimentos/:id/materiais',
  assincrono(async (req, res) => {
    const eid = id(req.params.id);
    const dados = req.dados!;
    if (!eid || !(await dados.buscar('empreendimentos', eid))) return erro(res, 404, 'NAO_ENCONTRADO', 'Empreendimento não encontrado.');
    const upload = id(req.body?.upload_id);
    const titulo = typeof req.body?.titulo === 'string' ? req.body.titulo.trim().slice(0, 120) : '';
    if (!upload || !titulo) return erro(res, 422, 'DADOS_INVALIDOS', 'Envie o arquivo e dê um título.');
    const tipo = (TIPOS_MATERIAL as readonly string[]).includes(req.body?.tipo) ? req.body.tipo : 'outro';
    try {
      const m = await dados.criar('empreendimento_materiais', { empreendimento_id: eid, arquivo: upload, titulo, tipo, publico: req.body?.publico !== false });
      res.status(201).json({ ...m, url: await url(req, m.arquivo) });
    } catch (e) {
      const r = uploadRecusado(e);
      if (r) return erro(res, r.status, 'UPLOAD_RECUSADO', r.mensagem);
      throw e;
    }
  }),
);

imoveisRotas.patch(
  '/empreendimentos/:id/materiais/:material/remover',
  assincrono(async (req, res) => {
    const eid = id(req.params.id);
    const mid = id(req.params.material);
    const dados = req.dados!;
    const m = mid ? await dados.buscar('empreendimento_materiais', mid) : null;
    if (!m || m.empreendimento_id !== eid) return erro(res, 404, 'NAO_ENCONTRADO', 'Material não encontrado.');
    await dados.deletar('empreendimento_materiais', m.id);
    res.json({ ok: true });
  }),
);
