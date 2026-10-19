import '@urbiverso/sdk/express';
import { Router } from 'express';
import type { StatusConviteApp } from '@urbiverso/sdk';
import { emailValido } from '../comum/conta';
import { assincrono, erro, exigirPapel } from './acesso';

// Equipe da plataforma › Corretores. A equipe (`operacao`) convida cada corretor para uma conta
// nova — um corretor, uma conta (spec 4.4). O shell cria usuário e conta só quando o convite é
// aceito; o papel `corretor` é atribuído depois pelo admin da app (o convite não leva papel).
export const equipeRotas: Router = Router();

equipeRotas.use(exigirPapel('operacao'));

const STATUS: StatusConviteApp[] = ['emitido', 'resgatado', 'expirado', 'invalidado', 'revogado'];

equipeRotas.get(
  '/convites',
  assincrono(async (req, res) => {
    const status = STATUS.includes(req.query.status as StatusConviteApp) ? (req.query.status as StatusConviteApp) : undefined;
    const pagina = Math.max(Number(req.query.pagina) || 1, 1);
    const limite = 50;
    const r = await req.shell!.externos.listarConvites({ status, limite, deslocamento: (pagina - 1) * limite });
    res.json({
      convites: r.convites.map((c) => ({
        id: c.id,
        email: c.credencial,
        conta: c.contaNome,
        status: c.status,
        vigente_ate: c.vigenteAte,
        criado_em: c.criadoEm,
        usuario_id: c.usuarioId,
      })),
      total: r.total,
      pagina,
      por_pagina: limite,
    });
  }),
);

equipeRotas.post(
  '/convites',
  assincrono(async (req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const conta = typeof req.body?.conta === 'string' ? req.body.conta.trim() : '';
    const detalhes: string[] = [];
    if (!emailValido(email)) detalhes.push('Informe um e-mail válido.');
    if (!conta) detalhes.push('Informe o nome da conta do corretor (ex.: o nome dele ou da imobiliária).');
    if (conta.length > 200) detalhes.push('O nome da conta tem no máximo 200 caracteres.');
    if (detalhes.length) return erro(res, 422, 'DADOS_INVALIDOS', 'Confira o convite.', detalhes);
    const r = await req.shell!.externos.convidar({ email, contaNome: conta });
    res.status(201).json({ id: r.conviteId, vigente_ate: r.vigenteAte });
  }),
);

equipeRotas.post(
  '/convites/:id/revogar',
  assincrono(async (req, res) => {
    const conviteId = Number(req.params.id);
    if (!Number.isInteger(conviteId) || conviteId <= 0) return erro(res, 404, 'NAO_ENCONTRADO', 'Convite não encontrado.');
    await req.shell!.externos.revogarConvite({ conviteId });
    res.json({ id: conviteId, status: 'revogado' });
  }),
);
