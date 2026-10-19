import '@urbiverso/sdk/express';
import type { NextFunction, Request, Response } from 'express';
import type { HelperDados } from '@urbiverso/sdk';
import { erro, MENSAGEM_SEM_CONTA, MENSAGEM_VARIAS_CONTAS, semConta } from './acesso';
import schema from '../schema.json';

// Quem atende várias contas (o admin do app, por exemplo) lê o conjunto delas, mas o app trabalha
// numa conta de cada vez: a ativa, declarada em `X-Conta` (contas.md § Escrita com N contas). Este
// escopo faz `req.dados` enxergar só a conta ativa nas tabelas segregadas, para listas, fichas e
// números não misturarem contas. Com uma conta só o RLS já isola e nada muda. Tabela que não é
// segregada (hoje só `vitrine_publica`, que guarda a conta na coluna `conta`) passa direto: a conta
// não a escopa (contas.md: "O que a conta NÃO escopa: tabela não-segregada").

const SEGREGADAS = new Set(
  Object.entries((schema as { tabelas: Record<string, { segregada_por_conta?: boolean }> }).tabelas)
    .filter(([, t]) => t.segregada_por_conta)
    .map(([nome]) => nome),
);

const LEITURAS_COM_FILTRO = new Set(['listar', 'varrerTudo']);
// Verbos por id: confere antes que a linha é da conta ativa, senão age como "não encontrado".
const POR_ID = new Set(['atualizar', 'deletar', 'remover', 'restaurar', 'atualizarSe', 'incrementar', 'revelar']);
// Sem escopo de conta possível aqui: para quem atende várias contas agiriam em todas elas. Nenhuma
// rota os usa; se alguma passar a usar, falha alto em vez de misturar contas em silêncio.
const SEM_ESCOPO = new Set(['travessia', 'atualizarVarios', 'removerVarios', 'deletarVarios', 'criarOuAtualizar', 'limparColuna', 'limparTabela']);
// Verbos cujo 1º argumento não é tabela (consulta declarada, bloco de conta): sempre falham alto.
const NUNCA = new Set(['sqlDeclarado', 'comConta']);

const daConta = (linha: Record<string, any> | null | undefined, conta: number) => !!linha && Number(linha.conta_id) === conta;

/** `req.dados` restrito à conta `conta` nas tabelas segregadas; as demais passam sem mudança. */
export function escoparPorConta(dados: HelperDados, conta: number): HelperDados {
  return new Proxy(dados, {
    get(alvo, nome: string) {
      const original = (alvo as any)[nome];
      if (typeof original !== 'function') return original;
      const chamar = original.bind(alvo);
      if (nome === 'transaction') {
        return (callback: (trx: HelperDados) => Promise<unknown>) => chamar((trx: HelperDados) => callback(escoparPorConta(trx, conta)));
      }
      if (NUNCA.has(nome)) {
        return () => {
          throw new Error(`req.dados.${nome} não tem escopo de conta: use só em rotina/listener, com a conta explícita (backend/escopo.ts)`);
        };
      }
      if (SEM_ESCOPO.has(nome)) {
        return (...args: any[]) => {
          if (typeof args[0] === 'string' && !SEGREGADAS.has(args[0])) return chamar(...args);
          throw new Error(`req.dados.${nome} não tem escopo de conta: não use com quem atende várias contas (backend/escopo.ts)`);
        };
      }
      const comTabela = (fn: (tabela: string, ...resto: any[]) => any) => (tabela: string, ...resto: any[]) =>
        SEGREGADAS.has(tabela) ? fn(tabela, ...resto) : chamar(tabela, ...resto);
      if (LEITURAS_COM_FILTRO.has(nome)) {
        return comTabela((tabela, opcoes: Record<string, any> = {}) =>
          chamar(tabela, { ...opcoes, filtros: { ...opcoes.filtros, conta_id: conta } }),
        );
      }
      if (nome === 'existe') {
        return comTabela((tabela, filtros: Record<string, any> = {}) => chamar(tabela, { ...filtros, conta_id: conta }));
      }
      if (nome === 'buscar') {
        return comTabela(async (tabela, ...resto) => {
          const linha = await chamar(tabela, ...resto);
          return daConta(linha, conta) ? linha : null;
        });
      }
      if (POR_ID.has(nome)) {
        // A checagem enxerga removidos: remover/restaurar/deletar/atualizar alcançam linha removida.
        // "Não encontrado" tem o valor de cada verbo: `deletar` devolve boolean, os demais `null`.
        const naoEncontrado = nome === 'deletar' ? false : null;
        return comTabela(async (tabela, id: number, ...resto) => {
          if (!daConta(await alvo.buscar(tabela, id, { incluir_removidos: true }), conta)) return naoEncontrado;
          return chamar(tabela, id, ...resto);
        });
      }
      return chamar;
    },
  });
}

/**
 * Antes das rotas que usam `req.dados`: com várias contas, exige a ativa (`X-Conta`) e restringe
 * `req.dados` a ela. Sem o cabeçalho a resposta diz o que fazer, em vez de listar tudo misturado
 * (decisão D-79: vale também para leitura, porque a leitura sem conta ativa mistura contas).
 */
export function escopoDeConta(req: Request, res: Response, next: NextFunction) {
  const c = req.contexto;
  // Sem nenhuma conta, as telas do corretor não têm onde ler nem gravar: explica antes de qualquer
  // rota. Só para quem alcança essas telas; os demais seguem e recebem o 403 do papel.
  const corretor = c?.nivelApp === 'admin' || !!c?.rolesApp?.includes('corretor');
  if (req.dados && corretor && semConta(req)) return erro(res, 409, 'SEM_CONTA', MENSAGEM_SEM_CONTA);
  // `contas` ausente = irrestrito/sistema (o manifesto não declara `acesso_irrestrito`, então não ocorre).
  if (!req.dados || !c?.contas || c.contas.length < 2) return next();
  if (!c.contaEscrita) {
    return erro(res, 400, 'CONTA_NAO_INFORMADA', MENSAGEM_VARIAS_CONTAS);
  }
  req.dados = escoparPorConta(req.dados, c.contaEscrita);
  next();
}
