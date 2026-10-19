import '@urbiverso/sdk/express';
import { Router } from 'express';
import manifesto from '../manifesto.json';
import { contaRotas } from './conta';
import { equipeRotas } from './equipe';

export { aoIniciar } from './semente';

export const rotas: Router = Router();

// Montada pelo shell em /api/portal_corretor/status. A rota é relativa: nunca escreva o prefixo.
// Esqueleto do bloco 0: confirma que backend e tela conversam na instância.
rotas.get('/status', (_req, res) => {
  res.json({ nome: manifesto.nome, versao: manifesto.versao });
});

rotas.use('/conta', contaRotas);
rotas.use('/equipe', equipeRotas);

// Diagnóstico do bloco 0 (sai no bloco 5): devolve o caminho e a query com que a rota pública foi
// chamada, para confirmar na instância se /pub aceita segmento extra e query. Não lê dado nenhum.
export const rotasPublicas: Router = Router();

rotasPublicas.get(['/diagnostico', '/diagnostico/*'], (req, res) => {
  res.json({ caminho: req.path, query: req.query });
});
