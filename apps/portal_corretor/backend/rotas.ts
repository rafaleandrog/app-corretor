import '@urbiverso/sdk/express';
import { Router } from 'express';
import manifesto from '../manifesto.json';
import { contaRotas } from './conta';
import { crmRotas } from './crm';
import { equipeRotas } from './equipe';
import { avisarAutorizacoesVencendo, imoveisRotas } from './imoveis';
import { funilRotas, reclassificarContatos } from './funil';
import { numerosRotas } from './numeros';
import { numerosNegociacaoRotas } from './numeros-negociacao';
import { enviosRotas } from './envios';
import { demoRotas } from './demo';
import { paginaRotas } from './pagina';
import { clienteRotas } from './cliente';
import { estudioRotas } from './estudio';
import { instagramRotas, renovarTokensInstagram } from './instagram';
import { assistenteRotas } from './assistente';
import { fichaRotas } from './ficha';
import { negociacaoRotas } from './negociacao';
import { negociadorRotas } from './negociador';
import { negociadorHumanoRotas } from './negociador-humano';
import { buscaRotas } from './busca';
import { conversasRotas } from './conversas';
import { escopoDeConta } from './escopo';
import { semByteNulo } from './acesso';

export { aoIniciar } from './semente';
// Páginas públicas, webhooks de entrada e listeners do bloco 5.
export { rotasPublicas, webhooks, reagir } from './publico';

// Rotinas declaradas no manifesto; o horário é do admin (rotinas.md).
export const rotinas = {
  reclassificar_contatos: reclassificarContatos,
  renovar_tokens_instagram: renovarTokensInstagram,
  avisar_autorizacoes_vencendo: avisarAutorizacoesVencendo,
};

export const rotas: Router = Router();

// Byte nulo no corpo ou na query não chega ao banco: 422 antes de qualquer rota (#229).
rotas.use(semByteNulo);

// Montada pelo shell em /api/portal_corretor/status. A rota é relativa: nunca escreva o prefixo.
// Esqueleto do bloco 0: confirma que backend e tela conversam na instância.
rotas.get('/status', (_req, res) => {
  res.json({ nome: manifesto.nome, versao: manifesto.versao });
});

// A equipe só usa `req.shell` (convites), sem tabela do app: não depende de conta ativa.
rotas.use('/equipe', equipeRotas);

// Tudo abaixo roda na conta ativa de quem atende várias contas (escopo.ts).
rotas.use(escopoDeConta);

rotas.use('/conta', contaRotas);
rotas.use(crmRotas);
rotas.use(imoveisRotas);
rotas.use(funilRotas);
rotas.use(numerosRotas);
rotas.use(numerosNegociacaoRotas);
rotas.use(enviosRotas);
rotas.use(demoRotas);
rotas.use(paginaRotas);
rotas.use(clienteRotas);
rotas.use(estudioRotas);
rotas.use(instagramRotas);
rotas.use(assistenteRotas);
rotas.use(fichaRotas);
rotas.use(negociacaoRotas);
rotas.use(negociadorRotas);
rotas.use(negociadorHumanoRotas);
rotas.use(buscaRotas);
rotas.use(conversasRotas);
