import '@urbiverso/sdk/express';
import type { NextFunction, Request, Response } from 'express';
import type { HelperDados } from '@urbiverso/sdk';
import { erro } from './acesso';

// Quem atende várias contas (o admin do app, por exemplo) lê o conjunto delas, mas o app trabalha
// numa conta de cada vez: a ativa, declarada em `X-Conta` (contas.md § Escrita com N contas). Este
// escopo faz `req.dados` enxergar só a conta ativa, para listas, fichas e números não misturarem
// contas. Com uma conta só o RLS já isola e nada muda.

const LEITURAS_COM_FILTRO = new Set(['listar', 'varrerTudo']);
// Verbos por id: confere antes que a linha é da conta ativa, senão age como "não encontrado".
const POR_ID = new Set(['atualizar', 'deletar', 'remover', 'restaurar', 'atualizarSe', 'incrementar']);

const daConta = (linha: Record<string, any> | null | undefined, conta: number) => !!linha && Number(linha.conta_id) === conta;

/** `req.dados` restrito à conta `conta`. Tabela sem `conta_id` (global) não passa por aqui. */
export function escoparPorConta(dados: HelperDados, conta: number): HelperDados {
  return new Proxy(dados, {
    get(alvo, nome: string) {
      const original = (alvo as any)[nome];
      if (typeof original !== 'function') return original;
      const chamar = original.bind(alvo);
      if (LEITURAS_COM_FILTRO.has(nome)) {
        return (tabela: string, opcoes: Record<string, any> = {}) =>
          chamar(tabela, { ...opcoes, filtros: { ...opcoes.filtros, conta_id: conta } });
      }
      if (nome === 'existe') {
        return (tabela: string, filtros: Record<string, any> = {}) => chamar(tabela, { ...filtros, conta_id: conta });
      }
      if (nome === 'buscar') {
        return async (...args: any[]) => {
          const linha = await chamar(...args);
          return daConta(linha, conta) ? linha : null;
        };
      }
      if (POR_ID.has(nome)) {
        return async (tabela: string, id: number, ...resto: any[]) => {
          if (!daConta(await alvo.buscar(tabela, id), conta)) return null;
          return chamar(tabela, id, ...resto);
        };
      }
      if (nome === 'transaction') {
        return (callback: (trx: HelperDados) => Promise<unknown>) => chamar((trx: HelperDados) => callback(escoparPorConta(trx, conta)));
      }
      return chamar;
    },
  });
}

/**
 * Antes das rotas autenticadas: com várias contas, exige a ativa (`X-Conta`) e restringe `req.dados`
 * a ela. Sem o cabeçalho a resposta diz o que fazer, em vez de listar tudo misturado.
 */
export function escopoDeConta(req: Request, res: Response, next: NextFunction) {
  const c = req.contexto;
  if (!req.dados || !c?.contas || c.contas.length < 2) return next();
  if (!c.contaEscrita) {
    return erro(res, 400, 'CONTA_NAO_INFORMADA', 'Você atende mais de uma conta: escolha a conta no seletor do alto da tela (ou envie o cabeçalho X-Conta).');
  }
  req.dados = escoparPorConta(req.dados, c.contaEscrita);
  next();
}
