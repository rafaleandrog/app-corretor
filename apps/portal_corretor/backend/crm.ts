import '@urbiverso/sdk/express';
import { Router, type Request } from 'express';
import type { HelperDados } from '@urbiverso/sdk';
import {
  CANAIS,
  ETAPAS_PADRAO,
  MOTIVOS_PERDA,
  PIPELINES,
  reaisParaCentavos,
  validarAtividade,
  validarContato,
  validarEtapas,
  type Pipeline,
} from '../comum/crm';
import { gerarCsv } from '../comum/csv';
import { assincrono, erro, guardarCorretor, primeiro } from './acesso';
import { classificarManual, etapasPorId, playbookDaConta, proximaAbordagem, reclassificar } from './inteligencia';
import { tentarPortal } from './portal';
import { MARCO_PADRAO } from '../comum/funil';
import { marcoMaisAvancado } from '../comum/numeros';

const marcoDe = (e: Record<string, any> | null | undefined): string | null => (e ? (e.marco ?? MARCO_PADRAO[e.nome] ?? null) : null);

/** Comissão chega em % (6 ou "6,5") e sai como fração (0,065); vazio = sem comissão. */
function comissao(v: unknown): number | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
  return Number.isFinite(n) && n >= 0 && n <= 100 ? Math.round((n / 100) * 10000) / 10000 : NaN;
}

// CRM do corretor (bloco 2): contatos, negócios, atividades e etapas do funil. Todas as tabelas
// são segregadas por conta; no MVP cada conta tem um corretor, que é o responsável de tudo.
export const crmRotas: Router = Router();

// As guardas valem só nos prefixos do CRM: o router é montado na raiz junto com os outros.
guardarCorretor(crmRotas, ['/contatos', '/negocios', '/atividades', '/funil', '/visitas']);

const POR_PAGINA = 50;
const LIMITE_IMPORTACAO = 2000;
const eu = (req: Request) => req.contexto!.usuario.id;
const id = (v: unknown) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};
const agora = () => new Date().toISOString();
const violouUnico = (e: unknown) => (e as { code?: string })?.code === '23505';

/** Uma linha na linha do tempo do contato: o histórico do app (o barramento é efêmero). */
export async function registrar(
  dados: HelperDados,
  req: Request,
  evento: { tipo: string; alvo_tipo: 'contato' | 'negocio' | 'atividade'; alvo_id: number; contato_id: number | null; resumo: string; dados?: unknown },
) {
  await dados.criar('linha_do_tempo', {
    ...evento,
    resumo: evento.resumo.slice(0, 300),
    autor_id: eu(req),
    autor_papel: 'corretor',
    ocorrido_em: agora(),
  });
}

/** A origem (canal + campanha) é reaproveitada: uma linha por par na conta. */
async function origem(dados: HelperDados, canal: unknown, campanha: unknown): Promise<number | null> {
  const c = typeof canal === 'string' && (CANAIS as readonly string[]).includes(canal) ? canal : null;
  if (!c) return null;
  const camp = typeof campanha === 'string' && campanha.trim() ? campanha.trim().slice(0, 200) : null;
  // Igualdade em texto livre fatia o valor na vírgula (banco-de-dados.md): busca por `[busca]`,
  // que não fatia, e confere a igualdade exata aqui.
  const achar = async () => {
    const r = await dados.listar('origens', {
      filtros: camp ? { canal: c, 'campanha[busca]': camp } : { canal: c, 'campanha[nulo]': 'true' },
      por_pagina: 200,
    });
    return r.dados.find((o) => (o.campanha ?? null) === camp) ?? null;
  };
  const atual = await achar();
  if (atual) return atual.id;
  try {
    return (await dados.criar('origens', { canal: c, campanha: camp })).id;
  } catch (e) {
    if (!violouUnico(e)) throw e;
    return (await achar())?.id ?? null;
  }
}

/** Etapas da conta; na primeira vez, semeia o padrão (spec 6.2). */
export async function etapasDaConta(dados: HelperDados, pipeline?: Pipeline) {
  let r = await dados.listar('etapas_funil', { por_pagina: 200, ordenar: 'ordem', ordem: 'asc' });
  if (!r.dados.length) {
    for (const e of ETAPAS_PADRAO) {
      try {
        await dados.criar('etapas_funil', { ...e, ativa: true, marco: MARCO_PADRAO[e.nome] ?? null });
      } catch (err) {
        if ((err as { code?: string })?.code !== '23505') throw err; // outra requisição semeou junto
      }
    }
    r = await dados.listar('etapas_funil', { por_pagina: 200, ordenar: 'ordem', ordem: 'asc' });
  }
  return r.dados.filter((e) => !pipeline || e.pipeline === pipeline);
}

// ---------- Contatos ----------

crmRotas.get(
  '/contatos',
  assincrono(async (req, res) => {
    const filtros: Record<string, unknown> = {};
    const papel = typeof req.query.papel === 'string' ? req.query.papel : '';
    if (papel) filtros['papeis[busca]'] = papel;
    if (typeof req.query.temperatura === 'string' && ['frio', 'morno', 'quente'].includes(req.query.temperatura)) {
      filtros.temperatura = req.query.temperatura;
    }
    const parado = Number(req.query.parado_dias);
    if (Number.isInteger(parado) && parado > 0 && parado <= 3650) {
      filtros['ultimo_contato_em[lt]'] = new Date(Date.now() - parado * 86400e3).toISOString();
    }
    const busca = typeof req.query.busca === 'string' ? req.query.busca.trim().slice(0, 100) : '';
    const pagina = Math.min(Math.max(Math.trunc(Number(req.query.pagina)) || 1, 1), 1000);
    const r = await req.dados!.listar('contatos', {
      filtros,
      busca_ou: busca ? { colunas: ['nome', 'email', 'telefone'], termo: busca.replace(/^\+/, '') } : undefined,
      ordenar: 'nome',
      ordem: 'asc',
      pagina,
      por_pagina: POR_PAGINA,
    });
    res.json(r);
  }),
);

crmRotas.post(
  '/contatos',
  assincrono(async (req, res) => {
    const v = validarContato(req.body ?? {});
    if (!v.ok) return erro(res, 422, 'DADOS_INVALIDOS', 'Confira o contato.', v.erros);
    const dados = req.dados!;
    // Telefone repetido na mesma conta é recusado (spec 6.2), com o id do contato que já tem o número.
    if (v.dados.telefone) {
      const existente = await primeiro(dados, 'contatos', { telefone: v.dados.telefone });
      if (existente) return erro(res, 409, 'DUPLICATA', `Já existe um contato com este telefone: ${existente.nome}.`, [String(existente.id)]);
    }
    const origem_id = await origem(dados, req.body?.origem_canal ?? 'outro', req.body?.origem_campanha);
    let contato;
    try {
      contato = await dados.criar('contatos', { ...v.dados, responsavel_id: eu(req), origem_id, ultimo_contato_em: agora() });
    } catch (e) {
      // Outro cadastro com o mesmo telefone entrou entre a conferência e a gravação.
      if (violouUnico(e)) return erro(res, 409, 'DUPLICATA', 'Já existe um contato com este telefone.');
      throw e;
    }
    await registrar(dados, req, { tipo: 'contato.criado', alvo_tipo: 'contato', alvo_id: contato.id, contato_id: contato.id, resumo: 'Contato cadastrado' });
    if (!v.dados.temperatura) await reclassificar(dados, contato.id);
    else await classificarManual(dados, contato.id, v.dados.temperatura as 'frio' | 'morno' | 'quente', null);
    res.status(201).json((await dados.buscar('contatos', contato.id)) ?? contato);
  }),
);

crmRotas.get(
  '/contatos/exportar',
  assincrono(async (req, res) => {
    const linhas = await req.dados!.varrerTudo('contatos', { ordenar: 'nome', ordem: 'asc', maximo: 50000 });
    const csv = gerarCsv(
      ['Nome', 'Telefone', 'E-mail', 'Papéis', 'Temperatura', 'Origem', 'Campanha', 'Próximo passo', 'Próximo passo em', 'Cadastrado em'],
      linhas.map((c) => [
        c.nome, c.telefone, c.email, c.papeis, c.temperatura, c.origem_canal, c.origem_campanha,
        c.proximo_passo, c.proximo_passo_em ? new Date(c.proximo_passo_em).toLocaleString('pt-BR', { timeZone: req.contexto?.fuso }) : '',
        new Date(c.criado_em).toLocaleDateString('pt-BR', { timeZone: req.contexto?.fuso }),
      ]),
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="contatos.csv"');
    res.send(csv);
  }),
);

crmRotas.post(
  '/contatos/importar',
  assincrono(async (req, res) => {
    const linhas = Array.isArray(req.body?.linhas) ? (req.body.linhas as Record<string, unknown>[]) : [];
    const modo = ['pular', 'atualizar_vazios', 'sobrescrever'].includes(req.body?.modo) ? req.body.modo : 'pular';
    if (!linhas.length) return erro(res, 422, 'DADOS_INVALIDOS', 'Nenhuma linha para importar.');
    if (linhas.length > LIMITE_IMPORTACAO) return erro(res, 422, 'DADOS_INVALIDOS', `Importe no máximo ${LIMITE_IMPORTACAO} linhas por vez.`);
    const dados = req.dados!;
    const arquivo = typeof req.body?.arquivo === 'string' ? req.body.arquivo : null;
    const origem_id = await origem(dados, 'importacao', arquivo);
    const relatorio = { criados: 0, unidos: 0, pulados: 0, rejeitados: [] as { linha: number; motivo: string }[] };
    for (const [i, bruta] of linhas.entries()) {
      // Linha da planilha como o corretor a vê: a 1 é o cabeçalho.
      const linha = i + 2;
      const rejeitar = (motivo: string) => relatorio.rejeitados.push({ linha, motivo });
      const v = validarContato(bruta ?? {});
      if (!v.ok) {
        rejeitar(v.erros.join(' '));
        continue;
      }
      // Papel ausente na planilha não é dado: não sobrescreve o de quem já existe.
      const semPapel = bruta?.papeis === undefined || bruta?.papeis === null || bruta?.papeis === '';
      if (semPapel) delete v.dados.papeis;
      try {
        // Duplicata por telefone; se o telefone não achar ninguém (ou não houver), pelo e-mail (spec 12.1).
        const existente =
          (v.dados.telefone && (await primeiro(dados, 'contatos', { telefone: v.dados.telefone }))) ||
          (v.dados.email && (await primeiro(dados, 'contatos', { email: v.dados.email }))) ||
          null;
        if (!existente) {
          // Importado entra sem consentimento: o Mensageiro só fala com ele por modelo aprovado (D-20).
          // A data da importação conta como último contato, para o filtro "parados há N dias" o alcançar.
          const c = await dados.criar('contatos', { papeis: 'comprador', ...v.dados, responsavel_id: eu(req), origem_id, ultimo_contato_em: agora() });
          await registrar(dados, req, { tipo: 'contato.importado', alvo_tipo: 'contato', alvo_id: c.id, contato_id: c.id, resumo: `Importado de ${arquivo ?? 'planilha'}` });
          relatorio.criados++;
        } else if (modo === 'pular') {
          relatorio.pulados++;
        } else {
          const novos: Record<string, unknown> = Object.fromEntries(
            Object.entries(v.dados).filter(([k, val]) => val !== null && (modo === 'sobrescrever' || existente[k] === null || existente[k] === '')),
          );
          if (Object.keys(novos).length) await dados.atualizar('contatos', existente.id, novos);
          relatorio.unidos++;
        }
      } catch (e) {
        // Uma linha que esbarra num único (gravação simultânea) não derruba as outras.
        if (!violouUnico(e)) throw e;
        rejeitar('Já existe um contato com este telefone.');
      }
    }
    res.json(relatorio);
  }),
);

crmRotas.get(
  '/contatos/:id',
  assincrono(async (req, res) => {
    const cid = id(req.params.id);
    const dados = req.dados!;
    const contato = cid ? await dados.buscar('contatos', cid) : null;
    if (!contato) return erro(res, 404, 'NAO_ENCONTRADO', 'Contato não encontrado.');
    const [negocios, atividades, linha] = await Promise.all([
      dados.listar('negocios', { filtros: { contato_id: cid }, por_pagina: 100 }),
      dados.listar('atividades', { filtros: { contato_id: cid }, ordenar: 'quando', ordem: 'desc', por_pagina: 100 }),
      dados.listar('linha_do_tempo', { filtros: { contato_id: cid }, ordenar: 'ocorrido_em', ordem: 'desc', por_pagina: 50 }),
    ]);
    const consentimento = await primeiro(dados, 'consentimentos', { contato_id: cid, 'revogado_em[nulo]': 'true' });
    const idsVisita = atividades.dados.filter((a) => a.tipo === 'visita').map((a) => a.id);
    const visitas = idsVisita.length ? (await dados.listar('visitas', { filtros: { atividade_id: idsVisita.join(',') }, por_pagina: 100 })).dados : [];
    const etapas = await etapasPorId(dados);
    const [playbook, classificacoes] = await Promise.all([
      playbookDaConta(dados, etapas),
      dados.listar('classificacoes', { filtros: { contato_id: cid }, ordenar: 'em', ordem: 'desc', por_pagina: 10 }),
    ]);
    const abordagem = proximaAbordagem(contato, negocios.dados, etapas, playbook);
    res.json({ contato, negocios: negocios.dados, atividades: atividades.dados, visitas, linha_do_tempo: linha.dados, consentimento, abordagem, classificacoes: classificacoes.dados });
  }),
);

crmRotas.patch(
  '/contatos/:id',
  assincrono(async (req, res) => {
    const cid = id(req.params.id);
    const dados = req.dados!;
    const atual = cid ? await dados.buscar('contatos', cid) : null;
    if (!atual) return erro(res, 404, 'NAO_ENCONTRADO', 'Contato não encontrado.');
    const v = validarContato(req.body ?? {}, true);
    if (!v.ok) return erro(res, 422, 'DADOS_INVALIDOS', 'Confira o contato.', v.erros);
    if (v.dados.telefone && v.dados.telefone !== atual.telefone) {
      const outro = await primeiro(dados, 'contatos', { telefone: v.dados.telefone });
      if (outro) return erro(res, 409, 'DUPLICATA', `Já existe um contato com este telefone: ${outro.nome}.`, [String(outro.id)]);
    }
    // Temperatura escolhida pelo corretor tem histórico próprio e vale até um sinal forte (10.4).
    const { temperatura, ...resto } = v.dados;
    // Mudou a temperatura, ou confirmou a da regra com um motivo: vira escolha do corretor.
    const motivoInformado = typeof req.body?.temperatura_motivo === 'string' && req.body.temperatura_motivo.trim() !== '';
    const manual = 'temperatura' in v.dados && (temperatura !== atual.temperatura || (motivoInformado && !!temperatura));
    let contato;
    try {
      contato = await dados.atualizar('contatos', cid!, resto);
    } catch (e) {
      if (violouUnico(e)) return erro(res, 409, 'DUPLICATA', 'Já existe um contato com este telefone.');
      throw e;
    }
    if (!contato) return erro(res, 404, 'NAO_ENCONTRADO', 'Contato não encontrado.');
    if (manual) {
      const motivo = typeof req.body?.temperatura_motivo === 'string' ? req.body.temperatura_motivo : null;
      await classificarManual(dados, cid!, (temperatura ?? null) as 'frio' | 'morno' | 'quente' | null, motivo);
      contato = (await dados.buscar('contatos', cid!)) ?? contato;
    }
    if ('proximo_passo' in v.dados || 'proximo_passo_em' in v.dados) {
      await registrar(dados, req, { tipo: 'contato.proximo_passo', alvo_tipo: 'contato', alvo_id: cid!, contato_id: cid!, resumo: `Próximo passo: ${contato.proximo_passo ?? 'nenhum'}` });
    }
    res.json(contato);
  }),
);

crmRotas.patch(
  '/contatos/:id/remover',
  assincrono(async (req, res) => {
    const cid = id(req.params.id);
    const dados = req.dados!;
    if (!cid || !(await dados.buscar('contatos', cid))) return erro(res, 404, 'NAO_ENCONTRADO', 'Contato não encontrado.');
    const abertos = await dados.listar('negocios', { filtros: { contato_id: cid, 'ganho_em[nulo]': 'true', 'perdido_em[nulo]': 'true' }, por_pagina: 1 });
    if (abertos.total) return erro(res, 409, 'NEGOCIO_ABERTO', 'Este contato tem negócio em andamento. Encerre o negócio antes de remover o contato.');
    await dados.remover('contatos', cid, eu(req));
    res.json({ id: cid, removido: true });
  }),
);

crmRotas.post(
  '/contatos/:id/notas',
  assincrono(async (req, res) => {
    const cid = id(req.params.id);
    const dados = req.dados!;
    const texto = typeof req.body?.texto === 'string' ? req.body.texto.trim() : '';
    if (!texto) return erro(res, 422, 'DADOS_INVALIDOS', 'Escreva a nota.');
    if (!cid || !(await dados.buscar('contatos', cid))) return erro(res, 404, 'NAO_ENCONTRADO', 'Contato não encontrado.');
    await registrar(dados, req, { tipo: 'contato.nota', alvo_tipo: 'contato', alvo_id: cid, contato_id: cid, resumo: texto });
    await dados.atualizar('contatos', cid, { ultimo_contato_em: agora() });
    await reclassificar(dados, cid);
    res.status(201).json({ ok: true });
  }),
);

crmRotas.post(
  '/contatos/:id/consentimento',
  assincrono(async (req, res) => {
    const cid = id(req.params.id);
    const dados = req.dados!;
    if (!cid || !(await dados.buscar('contatos', cid))) return erro(res, 404, 'NAO_ENCONTRADO', 'Contato não encontrado.');
    const canal = typeof req.body?.canal === 'string' && req.body.canal.trim() ? req.body.canal.trim().slice(0, 30) : 'informado_pelo_corretor';
    const aceito_em = agora();
    await dados.criar('consentimentos', { contato_id: cid, texto_versao: 'v1', canal, registrado_por_id: eu(req), aceito_em });
    await dados.atualizar('contatos', cid, { consentimento_em: aceito_em });
    await registrar(dados, req, { tipo: 'consentimento.registrado', alvo_tipo: 'contato', alvo_id: cid, contato_id: cid, resumo: `Consentimento registrado (${canal})` });
    res.status(201).json({ consentimento_em: aceito_em });
  }),
);

crmRotas.post(
  '/contatos/:id/consentimento/revogar',
  assincrono(async (req, res) => {
    const cid = id(req.params.id);
    const dados = req.dados!;
    if (!cid || !(await dados.buscar('contatos', cid))) return erro(res, 404, 'NAO_ENCONTRADO', 'Contato não encontrado.');
    const vigentes = await dados.listar('consentimentos', { filtros: { contato_id: cid, 'revogado_em[nulo]': 'true' }, por_pagina: 100 });
    for (const c of vigentes.dados) await dados.atualizar('consentimentos', c.id, { revogado_em: agora() });
    await dados.atualizar('contatos', cid, { consentimento_em: null });
    await registrar(dados, req, { tipo: 'consentimento.revogado', alvo_tipo: 'contato', alvo_id: cid, contato_id: cid, resumo: 'Consentimento revogado' });
    res.json({ consentimento_em: null });
  }),
);

// ---------- Negócios ----------

crmRotas.post(
  '/negocios',
  assincrono(async (req, res) => {
    const dados = req.dados!;
    const cid = id(req.body?.contato_id);
    const contato = cid ? await dados.buscar('contatos', cid) : null;
    if (!contato) return erro(res, 422, 'DADOS_INVALIDOS', 'Escolha o contato do negócio.');
    const pipeline = (PIPELINES as readonly string[]).includes(req.body?.pipeline) ? (req.body.pipeline as Pipeline) : 'compra';
    const etapas = await etapasDaConta(dados, pipeline);
    const primeira = etapas.find((e) => e.ativa && e.tipo === 'aberta');
    if (!primeira) return erro(res, 409, 'SEM_ETAPA', 'Este funil não tem etapa em andamento ativa. Revise em Ajustes › Funil.');
    const valor = reaisParaCentavos(req.body?.valor_estimado);
    if (Number.isNaN(valor)) return erro(res, 422, 'DADOS_INVALIDOS', 'Valor estimado inválido.');
    const titulo = (typeof req.body?.titulo === 'string' && req.body.titulo.trim()) || (pipeline === 'compra' ? `Compra — ${contato.nome}` : `Venda — ${contato.nome}`);
    const iid = id(req.body?.imovel_id);
    if (iid && !(await dados.buscar('imoveis', iid))) return erro(res, 422, 'DADOS_INVALIDOS', 'Imóvel não encontrado.');
    const pct = comissao(req.body?.comissao);
    if (Number.isNaN(pct)) return erro(res, 422, 'DADOS_INVALIDOS', 'Comissão: de 0 a 100%.');
    const negocio = await dados.criar('negocios', {
      imovel_id: iid,
      comissao_pct: pct ?? null,
      marco_max: marcoDe(primeira),
      contato_id: cid,
      titulo: titulo.slice(0, 200),
      pipeline,
      etapa_id: primeira.id,
      etapa_desde: agora(),
      valor_estimado_c: valor ?? null,
      responsavel_id: eu(req),
      origem_id: contato.origem_id ?? null,
    });
    await registrar(dados, req, { tipo: 'negocio.criado', alvo_tipo: 'negocio', alvo_id: negocio.id, contato_id: cid, resumo: `Negócio aberto: ${negocio.titulo} (${primeira.nome})` });
    res.status(201).json(negocio);
  }),
);

crmRotas.patch(
  '/negocios/:id',
  assincrono(async (req, res) => {
    const nid = id(req.params.id);
    const dados = req.dados!;
    const atual = nid ? await dados.buscar('negocios', nid) : null;
    if (!atual) return erro(res, 404, 'NAO_ENCONTRADO', 'Negócio não encontrado.');
    const mudar: Record<string, unknown> = {};
    if ('titulo' in (req.body ?? {})) {
      const t = typeof req.body.titulo === 'string' ? req.body.titulo.trim().slice(0, 200) : '';
      if (!t) return erro(res, 422, 'DADOS_INVALIDOS', 'Informe o título.');
      mudar.titulo = t;
    }
    if ('valor_estimado' in (req.body ?? {})) {
      const v = reaisParaCentavos(req.body.valor_estimado);
      if (Number.isNaN(v)) return erro(res, 422, 'DADOS_INVALIDOS', 'Valor estimado inválido.');
      mudar.valor_estimado_c = v;
    }
    if ('comissao' in (req.body ?? {})) {
      const pct = comissao(req.body.comissao);
      if (Number.isNaN(pct)) return erro(res, 422, 'DADOS_INVALIDOS', 'Comissão: de 0 a 100%.');
      mudar.comissao_pct = pct;
    }
    if ('imovel_id' in (req.body ?? {})) {
      const iid = id(req.body.imovel_id);
      if (req.body.imovel_id !== null && req.body.imovel_id !== '' && (!iid || !(await dados.buscar('imoveis', iid)))) {
        return erro(res, 422, 'DADOS_INVALIDOS', 'Imóvel não encontrado.');
      }
      mudar.imovel_id = iid;
    }
    let resumo: string | null = null;
    const etapaId = id(req.body?.etapa_id);
    if (etapaId && etapaId !== atual.etapa_id) {
      const etapa = await dados.buscar('etapas_funil', etapaId);
      if (!etapa || etapa.pipeline !== atual.pipeline) return erro(res, 422, 'DADOS_INVALIDOS', 'Etapa de outro funil.');
      const motivo = req.body?.motivo_perda;
      if (etapa.tipo === 'perdida' && !(MOTIVOS_PERDA as readonly string[]).includes(motivo)) {
        return erro(res, 422, 'MOTIVO_OBRIGATORIO', 'Informe o motivo da perda.');
      }
      Object.assign(mudar, {
        // O marco mais avançado alcançado não volta quando o negócio recua (números, spec 11.2).
        marco_max: marcoMaisAvancado(atual.pipeline, atual.marco_max ?? marcoDe(await dados.buscar('etapas_funil', atual.etapa_id)), marcoDe(etapa)),
        etapa_id: etapaId,
        etapa_desde: agora(),
        ganho_em: etapa.tipo === 'ganha' ? agora() : null,
        perdido_em: etapa.tipo === 'perdida' ? agora() : null,
        motivo_perda: etapa.tipo === 'perdida' ? motivo : null,
      });
      resumo = `${atual.titulo}: ${atual.etapa_nome} → ${etapa.nome}`;
    }
    if (!Object.keys(mudar).length) return res.json(atual);
    const negocio = await dados.atualizar('negocios', nid!, mudar);
    if (!negocio) return erro(res, 404, 'NAO_ENCONTRADO', 'Negócio não encontrado.');
    if (resumo) {
      await registrar(dados, req, {
        tipo: 'negocio.etapa_mudou', alvo_tipo: 'negocio', alvo_id: nid!, contato_id: atual.contato_id, resumo,
        dados: { de: atual.etapa_id, para: etapaId, motivo_perda: mudar.motivo_perda ?? null },
      });
      await dados.atualizar('contatos', atual.contato_id, { ultimo_contato_em: agora() });
      await reclassificar(dados, atual.contato_id);
    }
    res.json(negocio);
  }),
);

crmRotas.patch(
  '/negocios/:id/remover',
  assincrono(async (req, res) => {
    const nid = id(req.params.id);
    const dados = req.dados!;
    const atual = nid ? await dados.buscar('negocios', nid) : null;
    if (!atual) return erro(res, 404, 'NAO_ENCONTRADO', 'Negócio não encontrado.');
    await dados.remover('negocios', nid!, eu(req));
    await registrar(dados, req, { tipo: 'negocio.removido', alvo_tipo: 'negocio', alvo_id: nid!, contato_id: atual.contato_id, resumo: `Negócio removido: ${atual.titulo}` });
    res.json({ id: nid, removido: true });
  }),
);

// ---------- Atividades (agenda, tarefas, visitas) ----------

crmRotas.get(
  '/atividades',
  assincrono(async (req, res) => {
    const filtros: Record<string, unknown> = {};
    const de = typeof req.query.de === 'string' ? new Date(req.query.de) : null;
    const ate = typeof req.query.ate === 'string' ? new Date(req.query.ate) : null;
    if (de && !Number.isNaN(de.getTime())) filtros['quando[gte]'] = de.toISOString();
    if (ate && !Number.isNaN(ate.getTime())) filtros['quando[lt]'] = ate.toISOString();
    if (typeof req.query.status === 'string' && ['pendente', 'feita', 'cancelada', 'nao_compareceu'].includes(req.query.status)) {
      filtros.status = req.query.status;
    }
    // Literal no backend é obedecido (banco-de-dados.md); a tela avisa quando `total` passa disso.
    const r = await req.dados!.listar('atividades', { filtros, ordenar: 'quando', ordem: 'asc', por_pagina: 500 });
    res.json(r);
  }),
);

crmRotas.post(
  '/atividades',
  assincrono(async (req, res) => {
    const dados = req.dados!;
    const v = validarAtividade(req.body ?? {});
    if (!v.ok) return erro(res, 422, 'DADOS_INVALIDOS', 'Confira a atividade.', v.erros);
    const cid = id(req.body?.contato_id);
    const nid = id(req.body?.negocio_id);
    const contato = cid ? await dados.buscar('contatos', cid) : null;
    if (cid && !contato) return erro(res, 422, 'DADOS_INVALIDOS', 'Contato não encontrado.');
    const negocio = nid ? await dados.buscar('negocios', nid) : null;
    if (nid && (!negocio || (cid && negocio.contato_id !== cid))) return erro(res, 422, 'DADOS_INVALIDOS', 'Negócio não encontrado para este contato.');
    // Visita a um imóvel ganha o detalhe em `visitas` (retorno do cliente, compartilhar com o proprietário).
    const iid = v.dados.tipo === 'visita' ? id(req.body?.imovel_id) : null;
    if (iid && !(await dados.buscar('imoveis', iid))) return erro(res, 422, 'DADOS_INVALIDOS', 'Imóvel não encontrado.');
    const atividade = await dados.transaction(async (trx) => {
      const a = await trx.criar('atividades', {
        status: 'pendente',
        ...v.dados,
        contato_id: cid ?? negocio?.contato_id ?? null,
        negocio_id: nid,
        responsavel_id: eu(req),
      });
      if (iid) await trx.criar('visitas', { atividade_id: a.id, imovel_id: iid });
      return a;
    });
    if (atividade.contato_id) {
      await registrar(dados, req, { tipo: 'atividade.criada', alvo_tipo: 'atividade', alvo_id: atividade.id, contato_id: atividade.contato_id, resumo: `Agendado: ${atividade.titulo}` });
      if (atividade.tipo === 'visita') {
        await reclassificar(dados, atividade.contato_id);
        // A agenda do portal do cliente mostra as visitas marcadas (bloco 5b).
        await tentarPortal(dados, req.contexto?.contaEscrita, atividade.contato_id);
      }
    }
    res.status(201).json(atividade);
  }),
);

crmRotas.patch(
  '/atividades/:id',
  assincrono(async (req, res) => {
    const aid = id(req.params.id);
    const dados = req.dados!;
    const atual = aid ? await dados.buscar('atividades', aid) : null;
    if (!atual) return erro(res, 404, 'NAO_ENCONTRADO', 'Atividade não encontrada.');
    const v = validarAtividade(req.body ?? {}, true);
    if (!v.ok) return erro(res, 422, 'DADOS_INVALIDOS', 'Confira a atividade.', v.erros);
    const atividade = await dados.atualizar('atividades', aid!, v.dados);
    if (!atividade) return erro(res, 404, 'NAO_ENCONTRADO', 'Atividade não encontrada.');
    if (atual.contato_id && v.dados.status && v.dados.status !== atual.status) {
      const rotulo: Record<string, string> = { feita: 'Feito', cancelada: 'Cancelado', nao_compareceu: 'Não compareceu', pendente: 'Reaberto' };
      await registrar(dados, req, { tipo: 'atividade.status', alvo_tipo: 'atividade', alvo_id: aid!, contato_id: atual.contato_id, resumo: `${rotulo[v.dados.status as string]}: ${atual.titulo}` });
      if (v.dados.status === 'feita') await dados.atualizar('contatos', atual.contato_id, { ultimo_contato_em: agora() });
      await reclassificar(dados, atual.contato_id);
    }
    if (atual.tipo === 'visita') await tentarPortal(dados, req.contexto?.contaEscrita, atual.contato_id);
    res.json(atividade);
  }),
);

crmRotas.patch(
  '/atividades/:id/remover',
  assincrono(async (req, res) => {
    const aid = id(req.params.id);
    const dados = req.dados!;
    const atual = aid ? await dados.buscar('atividades', aid) : null;
    if (!atual) return erro(res, 404, 'NAO_ENCONTRADO', 'Atividade não encontrada.');
    await dados.remover('atividades', aid!, eu(req));
    if (atual.tipo === 'visita') await tentarPortal(dados, req.contexto?.contaEscrita, atual.contato_id);
    res.json({ id: aid, removido: true });
  }),
);

// ---------- Visitas: retorno do cliente ----------

crmRotas.post(
  '/visitas/:atividade/feedback',
  assincrono(async (req, res) => {
    const aid = id(req.params.atividade);
    const dados = req.dados!;
    const atividade = aid ? await dados.buscar('atividades', aid) : null;
    const visita = atividade ? await primeiro(dados, 'visitas', { atividade_id: aid }) : null;
    if (!atividade || !visita) return erro(res, 404, 'NAO_ENCONTRADO', 'Visita não encontrada.');
    const nota = req.body?.nota === undefined || req.body?.nota === null || req.body?.nota === '' ? null : Number(req.body.nota);
    if (nota !== null && !(Number.isInteger(nota) && nota >= 1 && nota <= 5)) return erro(res, 422, 'DADOS_INVALIDOS', 'Nota de 1 a 5.');
    const texto = typeof req.body?.texto === 'string' ? req.body.texto.trim().slice(0, 4000) || null : null;
    if (nota === null && !texto) return erro(res, 422, 'DADOS_INVALIDOS', 'Dê uma nota ou escreva o retorno do cliente.');
    const compartilhar = req.body?.compartilhar === undefined ? visita.compartilhar_com_proprietario : req.body.compartilhar === true;
    const salva = await dados.atualizar('visitas', visita.id, { feedback_nota: nota, feedback_texto: texto, compartilhar_com_proprietario: compartilhar, feedback_em: agora() });
    // Registrar o retorno é sinal de que a visita aconteceu.
    if (atividade.status === 'pendente') await dados.atualizar('atividades', aid!, { status: 'feita' });
    if (atividade.contato_id) {
      await registrar(dados, req, {
        tipo: 'visita.feedback', alvo_tipo: 'atividade', alvo_id: aid!, contato_id: atividade.contato_id,
        resumo: `Retorno da visita ao ${visita.imovel_codigo ?? 'imóvel'}${nota ? ` (nota ${nota})` : ''}${texto ? `: ${texto}` : ''}`,
      });
      await dados.atualizar('contatos', atividade.contato_id, { ultimo_contato_em: agora() });
      await reclassificar(dados, atividade.contato_id);
      await tentarPortal(dados, req.contexto?.contaEscrita, atividade.contato_id);
    }
    res.json(salva);
  }),
);

// ---------- Etapas do funil (Ajustes › Funil) ----------

crmRotas.get(
  '/funil/etapas',
  assincrono(async (req, res) => {
    const pipeline = (PIPELINES as readonly string[]).includes(req.query.pipeline as string) ? (req.query.pipeline as Pipeline) : undefined;
    res.json({ etapas: await etapasDaConta(req.dados!, pipeline) });
  }),
);

crmRotas.put(
  '/funil/etapas/:pipeline',
  assincrono(async (req, res) => {
    const pipeline = req.params.pipeline as Pipeline;
    if (!(PIPELINES as readonly string[]).includes(pipeline)) return erro(res, 404, 'NAO_ENCONTRADO', 'Funil não encontrado.');
    const v = validarEtapas(pipeline, req.body?.etapas);
    if (!v.ok) return erro(res, 422, 'DADOS_INVALIDOS', 'Confira as etapas.', v.erros);
    const dados = req.dados!;
    const atuais = await etapasDaConta(dados, pipeline);
    const porId = new Map(atuais.map((e) => [e.id, e]));
    for (const e of v.dados) if (e.id && !porId.has(e.id)) return erro(res, 422, 'DADOS_INVALIDOS', 'Etapa de outro funil ou inexistente.');
    const ids = v.dados.map((e) => e.id).filter(Boolean);
    if (new Set(ids).size !== ids.length) return erro(res, 422, 'DADOS_INVALIDOS', 'A mesma etapa aparece duas vezes.');
    const mantidas = new Set(v.dados.map((e) => e.id).filter(Boolean));
    await dados.transaction(async (trx) => {
      // Etapa que saiu da lista não é apagada (pode haver negócio nela): fica inativa, com nome livre.
      for (const e of atuais) {
        if (!mantidas.has(e.id) && e.ativa) await trx.atualizar('etapas_funil', e.id, { ativa: false, nome: `${e.nome} (inativa ${e.id})`.slice(0, 60), ordem: 999 });
      }
      // Ordem e nomes trocam de posição sem colidir no único (pipeline, nome): primeiro um nome provisório.
      for (const e of v.dados) if (e.id) await trx.atualizar('etapas_funil', e.id, { nome: `__${e.id}` });
      for (const e of v.dados) {
        const linha = { nome: e.nome, ordem: e.ordem, tipo: e.tipo, probabilidade: e.probabilidade, ativa: true };
        if (e.id) await trx.atualizar('etapas_funil', e.id, linha);
        else await trx.criar('etapas_funil', { ...linha, pipeline });
      }
    });
    res.json({ etapas: await etapasDaConta(dados, pipeline) });
  }),
);
