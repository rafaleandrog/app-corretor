import '@urbiverso/sdk/express';
import { Router } from 'express';
import manifesto from '../manifesto.json';
import { contaRotas } from './conta';
import { crmRotas } from './crm';
import { equipeRotas } from './equipe';
import { imoveisRotas } from './imoveis';
import { funilRotas, reclassificarContatos } from './funil';
import { numerosRotas } from './numeros';
import { enviosRotas } from './envios';
import { demoRotas } from './demo';
import { paginaRotas } from './pagina';
import { clienteRotas } from './cliente';
import { estudioRotas } from './estudio';
import { instagramRotas, renovarTokensInstagram } from './instagram';
import { assistenteRotas } from './assistente';

export { aoIniciar } from './semente';
// Páginas públicas, webhooks de entrada e listeners do bloco 5.
export { rotasPublicas, webhooks, reagir } from './publico';

// Rotinas declaradas no manifesto; o horário é do admin (rotinas.md).
export const rotinas = {
  reclassificar_contatos: reclassificarContatos,
  renovar_tokens_instagram: renovarTokensInstagram,
};

export const rotas: Router = Router();

// Montada pelo shell em /api/portal_corretor/status. A rota é relativa: nunca escreva o prefixo.
// Esqueleto do bloco 0: confirma que backend e tela conversam na instância.
rotas.get('/status', (_req, res) => {
  res.json({ nome: manifesto.nome, versao: manifesto.versao });
});

rotas.use('/conta', contaRotas);
rotas.use('/equipe', equipeRotas);
rotas.use(crmRotas);
rotas.use(imoveisRotas);
rotas.use(funilRotas);
rotas.use(numerosRotas);
rotas.use(enviosRotas);
rotas.use(demoRotas);
rotas.use(paginaRotas);
rotas.use(clienteRotas);
rotas.use(estudioRotas);
rotas.use(instagramRotas);
rotas.use(assistenteRotas);
