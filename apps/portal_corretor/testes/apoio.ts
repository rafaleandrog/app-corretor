import express from 'express';
import type { AddressInfo } from 'node:net';
import type { Router } from 'express';

// Banco falso em memória que imita a Segregação por Conta: cada request enxerga só as linhas da
// sua conta e grava carimbando a conta ativa — como o RLS faz na instância. Escrever `conta_id`
// no corpo lança, como o `422 DADOS_CAMPO_RESERVADO` do framework. Não substitui o roteiro na
// instância (o RLS de verdade só se prova lá); prova que o código depende só de `req.dados`.
export type Linha = Record<string, any> & { id: number; conta_id: number };

export class BancoFalso {
  private seq = 0;
  readonly tabelas = new Map<string, Linha[]>();
  // Colunas `unico` por tabela, compostas com a conta (como no schema segregado).
  constructor(private unicos: Record<string, string[]> = {}) {}

  linhas(tabela: string): Linha[] {
    if (!this.tabelas.has(tabela)) this.tabelas.set(tabela, []);
    return this.tabelas.get(tabela)!;
  }

  /** Helper `req.dados` de uma conta (null = resolução NEGAR: lê vazio, escrita negada). */
  dados(conta: number | null): any {
    const banco = this;
    const visiveis = (tabela: string, removidos = false) =>
      conta === null ? [] : banco.linhas(tabela).filter((l) => l.conta_id === conta && (removidos || !l.removido_em));
    const exigirConta = () => {
      if (conta === null) throw Object.assign(new Error('CONTA_ACESSO_NEGADO'), { codigo: 'CONTA_ACESSO_NEGADO' });
    };
    const semReservado = (d: Record<string, unknown>) => {
      if ('conta_id' in d) throw new Error('DADOS_CAMPO_RESERVADO: conta_id');
    };
    const consultar = (tabela: string, op: OpcoesFalsas = {}) => {
      let r = visiveis(tabela).filter((l) => casa(l, op.filtros));
      if (op.busca_ou?.termo) {
        const t = semAcento(op.busca_ou.termo);
        r = r.filter((l) => op.busca_ou!.colunas.some((c) => semAcento(String(l[c] ?? '')).includes(t)));
      }
      if (op.ordenar) {
        const dir = op.ordem === 'desc' ? -1 : 1;
        r = [...r].sort((a, b) => (a[op.ordenar!] > b[op.ordenar!] ? dir : a[op.ordenar!] < b[op.ordenar!] ? -dir : 0));
      }
      return r;
    };
    const helper = {
      async listar(tabela: string, op: OpcoesFalsas = {}) {
        const r = consultar(tabela, op);
        const por = op.por_pagina ?? 20;
        const ini = ((op.pagina ?? 1) - 1) * por;
        return { dados: r.slice(ini, ini + por).map((l) => ({ ...l })), total: r.length, pagina: op.pagina ?? 1, por_pagina: por, paginas: Math.ceil(r.length / por) };
      },
      async varrerTudo(tabela: string, op: OpcoesFalsas = {}) {
        return consultar(tabela, op).map((l) => ({ ...l }));
      },
      async buscar(tabela: string, id: number) {
        const l = visiveis(tabela).find((x) => x.id === id);
        return l ? { ...l } : null;
      },
      async remover(tabela: string, id: number, por?: number) {
        exigirConta();
        const alvo = visiveis(tabela).find((l) => l.id === id);
        return alvo ? Object.assign(alvo, { removido_em: new Date().toISOString(), removido_por_id: por ?? null }) : null;
      },
      async transaction(fn: (trx: any) => Promise<unknown>) {
        return fn(helper);
      },
      async existe(tabela: string, filtros: Record<string, unknown>) {
        return visiveis(tabela).some((l) => casa(l, filtros));
      },
      async criar(tabela: string, d: Record<string, unknown>) {
        exigirConta();
        semReservado(d);
        const linha = { ...d, id: ++banco.seq, conta_id: conta! } as Linha;
        for (const col of banco.unicos[tabela] ?? []) {
          if (linha[col] !== null && linha[col] !== undefined && visiveis(tabela).some((l) => l[col] === linha[col])) {
            throw Object.assign(new Error(`unico ${tabela}.${col}`), { code: '23505' });
          }
        }
        banco.linhas(tabela).push(linha);
        return { ...linha };
      },
      async atualizar(tabela: string, id: number, d: Record<string, unknown>) {
        exigirConta();
        semReservado(d);
        const alvo = visiveis(tabela).find((l) => l.id === id);
        return alvo ? { ...Object.assign(alvo, d) } : null;
      },
      async criarOuAtualizar(tabela: string, chave: string[], d: Record<string, unknown>) {
        exigirConta();
        semReservado(d);
        const alvo = visiveis(tabela).find((l) => chave.every((c) => l[c] === d[c]));
        if (alvo) return Object.assign(alvo, d);
        return helper.criar(tabela, d);
      },
    };
    return helper;
  }

  /** Contexto SISTEMA do hook: `comConta` aponta a escrita; a leitura enxerga tudo. */
  ctxSistema(contas: { id: number; nome: string }[]): any {
    const banco = this;
    const todas = (tabela: string) => banco.linhas(tabela);
    return {
      contas: { listarAtivas: async () => contas },
      dados: {
        async comConta(id: number, fn: (trx: any) => Promise<void>) {
          const trx = banco.dados(id);
          trx.existe = async (tabela: string, filtros: Record<string, unknown>) =>
            todas(tabela).some((l) => Object.entries(filtros).every(([k, v]) => String(l[k]) === String(v)));
          return fn(trx);
        },
      },
    };
  }
}

interface OpcoesFalsas {
  filtros?: Record<string, unknown>;
  busca_ou?: { colunas: string[]; termo: string };
  ordenar?: string;
  ordem?: 'asc' | 'desc';
  pagina?: number;
  por_pagina?: number;
}

const semAcento = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** Os operadores de filtro do framework que o app usa: igualdade, [busca], [nulo], [lt], [gte]. */
function casa(l: Linha, filtros: Record<string, unknown> = {}) {
  return Object.entries(filtros).every(([chave, v]) => {
    const m = chave.match(/^(.+)\[(busca|nulo|lt|gte)\]$/);
    if (!m) return String(l[chave]) === String(v);
    const [, col, op] = m;
    const atual = l[col];
    if (op === 'nulo') return (atual === null || atual === undefined) === (String(v) === 'true');
    if (op === 'busca') return semAcento(String(atual ?? '')).includes(semAcento(String(v)));
    if (atual === null || atual === undefined) return false;
    return op === 'lt' ? atual < (v as string) : atual >= (v as string);
  });
}

export interface Ator {
  usuario: number;
  conta: number | null;
  papeis: string[];
}

/** Sobe o router com o contexto de um ator e devolve uma função de chamada HTTP. */
export async function comServidor<T>(
  router: Router,
  ator: Ator,
  banco: BancoFalso,
  shell: Record<string, unknown>,
  fn: (chamar: (metodo: string, caminho: string, corpo?: unknown) => Promise<{ status: number; corpo: any }>) => Promise<T>,
): Promise<T> {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).contexto = {
      usuario: { id: ator.usuario, nome: `Usuário ${ator.usuario}`, tipo: 'nao_informado', natureza: 'nao_informado', avatar_url: null },
      nivelApp: 'escrita',
      rolesApp: ator.papeis,
      permissoesApps: {},
      resolucao: ator.conta === null ? 'negar' : 'escopado',
      contas: ator.conta === null ? [] : [ator.conta],
      contaEscrita: ator.conta ?? undefined,
    };
    (req as any).dados = banco.dados(ator.conta);
    (req as any).shell = shell;
    next();
  });
  app.use(router);
  const servidor = app.listen(0);
  try {
    const { port } = servidor.address() as AddressInfo;
    return await fn(async (metodo, caminho, corpo) => {
      const r = await fetch(`http://127.0.0.1:${port}${caminho}`, {
        method: metodo,
        headers: { 'Content-Type': 'application/json' },
        body: corpo === undefined ? undefined : JSON.stringify(corpo),
      });
      const texto = await r.text();
      return { status: r.status, corpo: texto ? JSON.parse(texto) : null };
    });
  } finally {
    servidor.close();
  }
}
