import '@urbiverso/sdk/express';
import { Router } from 'express';

export const rotas: Router = Router();

// Montada pelo shell em /api/ola_mundo/ola. A rota é relativa: nunca escreva o prefixo.
rotas.get('/ola', (req, res) => {
  const nome = req.contexto?.usuario.nome ?? 'visitante';
  res.json({ mensagem: `Olá, ${nome}!` });
});
