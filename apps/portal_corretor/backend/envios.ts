import '@urbiverso/sdk/express';
import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { assincrono, erro, guardarCorretor } from './acesso';
import { registrar } from './crm';
import { reclassificar } from './inteligencia';

// Envios (bloco 4b, spec 6.15): o histórico de tudo que o corretor mandou a cada cliente. Nesta
// versão o envio é registrado pelo corretor (ele manda pelo próprio WhatsApp); o link rastreado
// com contagem de cliques chega com as páginas públicas (bloco 5), que são o destino do link.
export const enviosRotas: Router = Router();
guardarCorretor(enviosRotas, ['/envios']);

const TIPOS = ['imovel', 'arquivo', 'mensagem', 'localizacao', 'simulacao'] as const;
const CANAIS = ['whatsapp', 'email', 'presencial'] as const;
const id = (v: unknown) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};
const reais = (c: number | null | undefined) => (c ? (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'preço sob consulta');

enviosRotas.post(
  '/envios',
  assincrono(async (req, res) => {
    const dados = req.dados!;
    const cid = id(req.body?.contato_id);
    const contato = cid ? await dados.buscar('contatos', cid) : null;
    if (!contato) return erro(res, 422, 'DADOS_INVALIDOS', 'Escolha o cliente.');
    const tipo = (TIPOS as readonly string[]).includes(req.body?.tipo) ? req.body.tipo : null;
    if (!tipo) return erro(res, 422, 'DADOS_INVALIDOS', 'Tipo de envio inválido.');
    const canal = (CANAIS as readonly string[]).includes(req.body?.canal) ? req.body.canal : 'whatsapp';
    const iid = id(req.body?.imovel_id);
    const imovel = iid ? await dados.buscar('imoveis', iid) : null;
    if (tipo === 'imovel' && !imovel) return erro(res, 422, 'DADOS_INVALIDOS', 'Escolha o imóvel enviado.');
    if (iid && !imovel) return erro(res, 422, 'DADOS_INVALIDOS', 'Imóvel não encontrado.');
    const nid = id(req.body?.negocio_id);
    const negocio = nid ? await dados.buscar('negocios', nid) : null;
    if (nid && (!negocio || negocio.contato_id !== cid)) return erro(res, 422, 'DADOS_INVALIDOS', 'Negócio não encontrado para este cliente.');
    const descricao = typeof req.body?.descricao === 'string' ? req.body.descricao.trim().slice(0, 300) || null : null;
    const agora = new Date().toISOString();
    const envio = await dados.criar('envios', {
      contato_id: cid,
      negocio_id: nid,
      imovel_id: imovel?.id ?? null,
      tipo,
      canal,
      autor_tipo: 'humano',
      descricao,
      // Código curto reservado para o link rastreado (bloco 5); ainda não há página de destino.
      link_rastreado: randomBytes(6).toString('base64url'),
      enviado_em: agora,
      cliques: 0,
    });
    const oQue = imovel ? `${imovel.codigo}${imovel.titulo ? ` · ${imovel.titulo}` : ''}` : (descricao ?? tipo);
    await registrar(dados, req, { tipo: 'envio.registrado', alvo_tipo: 'contato', alvo_id: cid!, contato_id: cid!, resumo: `Enviado por ${canal}: ${oQue}` });
    await dados.atualizar('contatos', cid!, { ultimo_contato_em: agora });
    await reclassificar(dados, cid!);
    // Texto pronto para o corretor colar no WhatsApp (sem dado do proprietário nem endereço completo).
    const primeiroNome = String(contato.nome).split(' ')[0];
    const mensagem = imovel
      ? `Olá, ${primeiroNome}! Separei este imóvel para você: ${imovel.titulo ?? imovel.tipo} em ${[imovel.bairro, imovel.cidade].filter(Boolean).join(', ')}, ${reais(imovel.preco_c)}. Posso te mandar mais fotos ou marcar uma visita?`
      : null;
    res.status(201).json({ envio, mensagem });
  }),
);

enviosRotas.get(
  '/envios',
  assincrono(async (req, res) => {
    const filtros: Record<string, unknown> = {};
    const cid = id(req.query.contato_id);
    const iid = id(req.query.imovel_id);
    if (cid) filtros.contato_id = cid;
    if (iid) filtros.imovel_id = iid;
    const r = await req.dados!.listar('envios', { filtros, ordenar: 'enviado_em', ordem: 'desc', por_pagina: 100 });
    res.json(r);
  }),
);
