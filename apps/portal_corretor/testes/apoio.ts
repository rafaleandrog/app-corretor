import express from 'express';
import type { AddressInfo } from 'node:net';
import type { Router } from 'express';

// Banco falso em memória que imita a Segregação por Conta: cada request enxerga só as linhas da
// sua conta e grava carimbando a conta ativa — como o RLS faz na instância. Escrever `conta_id`
// no corpo lança, como o `422 DADOS_CAMPO_RESERVADO` do framework. Não substitui o roteiro na
// instância (o RLS de verdade só se prova lá); prova que o código depende só de `req.dados`.
import schema from '../schema.json';

/** Colunas `datahora` por tabela (mais as automáticas): no banco real chegam como `Date` (banco-de-dados.md). */
const DATAHORA: Record<string, Set<string>> = Object.fromEntries(
  Object.entries((schema as { tabelas: Record<string, { colunas: Record<string, { tipo: string }> }> }).tabelas).map(([t, def]) => [
    t,
    new Set(['criado_em', 'atualizado_em', 'removido_em', ...Object.entries(def.colunas).filter(([, c]) => c.tipo === 'datahora').map(([n]) => n)]),
  ]),
);
/** Tabelas fora da segregação (D-55): sem RLS, sem carimbo de conta. */
const GLOBAIS = new Set(
  Object.entries((schema as { tabelas: Record<string, { segregada_por_conta?: boolean }> }).tabelas).filter(([, d]) => d.segregada_por_conta === false).map(([t]) => t),
);
/** Cópia da linha como o `req.dados` devolve: `datahora` vira `Date`. */
/** Gravação como o framework faz: `Date` vira ISO. */
const comoGravado = (d: Record<string, unknown>) => Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v instanceof Date ? v.toISOString() : v]));

function comoLido(tabela: string, l: Record<string, any>) {
  const cols = DATAHORA[tabela];
  const r: Record<string, any> = { ...l };
  if (cols) for (const c of cols) if (typeof r[c] === 'string') r[c] = new Date(r[c]);
  return r;
}

export type Linha = Record<string, any> & { id: number; conta_id: number };

export class BancoFalso {
  private seq = 0;
  readonly tabelas = new Map<string, Linha[]>();
  // Únicos por tabela, compostos com a conta (como no schema segregado). Composto: 'pipeline+nome'.
  // Valem no criar e no atualizar, entre as linhas vivas (como o único parcial em removido_em nulo).
  constructor(private unicos: Record<string, string[]> = {}) {}

  linhas(tabela: string): Linha[] {
    if (!this.tabelas.has(tabela)) this.tabelas.set(tabela, []);
    return this.tabelas.get(tabela)!;
  }

  /**
   * Helper `req.dados` de uma conta (null = resolução NEGAR: lê vazio, escrita negada). Tabela não
   * segregada é vista inteira e gravada sem conta. `leituraGlobal` imita o SISTEMA dentro do
   * `comConta`: lê todas as contas e grava na conta do bloco.
   */
  dados(conta: number | null, leituraGlobal = false): any {
    const banco = this;
    const visiveis = (tabela: string, removidos = false) =>
      GLOBAIS.has(tabela) || leituraGlobal
        ? banco.linhas(tabela).filter((l) => removidos || !l.removido_em)
        : conta === null
          ? []
          : banco.linhas(tabela).filter((l) => l.conta_id === conta && (removidos || !l.removido_em));
    let tabelaAtual = '';
    const exigirConta = () => {
      if (GLOBAIS.has(tabelaAtual)) return;
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
        const k = op.ordenar;
        r = [...r].sort((a, b) => (a[k] ?? '') > (b[k] ?? '') ? dir : (a[k] ?? '') < (b[k] ?? '') ? -dir : 0);
      }
      return r;
    };
    const colide = (tabela: string, linha: Linha) => {
      for (const unico of banco.unicos[tabela] ?? []) {
        const cols = unico.split('+');
        if (cols.some((c) => linha[c] === null || linha[c] === undefined)) continue;
        const vizinhas = GLOBAIS.has(tabela) ? visiveis(tabela) : banco.linhas(tabela).filter((l) => l.conta_id === linha.conta_id && !l.removido_em);
        if (vizinhas.some((l) => l.id !== linha.id && cols.every((c) => l[c] === linha[c]))) {
          throw Object.assign(new Error(`unico ${tabela}.${unico}`), { code: '23505' });
        }
      }
    };
    const helper = {
      async listar(tabela: string, op: OpcoesFalsas = {}) {
        const r = consultar(tabela, op);
        const por = op.por_pagina ?? 20;
        const ini = ((op.pagina ?? 1) - 1) * por;
        return { dados: r.slice(ini, ini + por).map((l) => comoLido(tabela, l)), total: r.length, pagina: op.pagina ?? 1, por_pagina: por, paginas: Math.ceil(r.length / por) };
      },
      async varrerTudo(tabela: string, op: OpcoesFalsas = {}) {
        return consultar(tabela, op).map((l) => comoLido(tabela, l));
      },
      async buscar(tabela: string, id: number) {
        const l = visiveis(tabela).find((x) => x.id === id);
        return l ? comoLido(tabela, l) : null;
      },
      async remover(tabela: string, id: number, por?: number) {
        tabelaAtual = tabela;
        exigirConta();
        const alvo = visiveis(tabela).find((l) => l.id === id);
        return alvo ? Object.assign(alvo, { removido_em: new Date().toISOString(), removido_por_id: por ?? null }) : null;
      },
      async deletar(tabela: string, id: number) {
        tabelaAtual = tabela;
        exigirConta();
        const linhas = banco.linhas(tabela);
        const i = linhas.findIndex((l) => l.id === id && (GLOBAIS.has(tabela) || l.conta_id === conta));
        if (i < 0) return false;
        linhas.splice(i, 1);
        return true;
      },
      async transaction(fn: (trx: any) => Promise<unknown>) {
        return fn(helper);
      },
      async existe(tabela: string, filtros: Record<string, unknown>) {
        return visiveis(tabela).some((l) => casa(l, filtros));
      },
      async criar(tabela: string, d: Record<string, unknown>) {
        tabelaAtual = tabela;
        exigirConta();
        semReservado(d);
        const agora = new Date().toISOString();
        const linha = { criado_em: agora, atualizado_em: agora, ...comoGravado(d), id: banco.seq + 1, ...(GLOBAIS.has(tabela) ? {} : { conta_id: conta! }) } as Linha;
        colide(tabela, linha);
        banco.seq++;
        banco.linhas(tabela).push(linha);
        return comoLido(tabela, linha);
      },
      async atualizar(tabela: string, id: number, d: Record<string, unknown>) {
        tabelaAtual = tabela;
        exigirConta();
        semReservado(d);
        const alvo = visiveis(tabela).find((l) => l.id === id);
        if (!alvo) return null;
        colide(tabela, { ...alvo, ...comoGravado(d) });
        return comoLido(tabela, Object.assign(alvo, comoGravado(d), { atualizado_em: new Date().toISOString() }));
      },
      async criarOuAtualizar(tabela: string, chave: string[], d: Record<string, unknown>) {
        tabelaAtual = tabela;
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
        // Leitura SISTEMA enxerga todas as contas (contas.md).
        async varrerTudo(tabela: string, op: OpcoesFalsas = {}) {
          return todas(tabela).filter((l) => !l.removido_em && casa(l, op.filtros)).map((l) => comoLido(tabela, l));
        },
        async comConta(id: number, fn: (trx: any) => Promise<void>) {
          if (!contas.some((c) => c.id === id)) throw Object.assign(new Error('conta inativa'), { codigo: 'CONTA_INVALIDA' });
          const trx = banco.dados(id, true);
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
    // Igualdade com vírgula é lista (IN), como no framework: a vírgula sempre separa.
    if (!m) return String(v).split(',').includes(String(l[chave]));
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
  /** Outros helpers do request (`arquivos`, `ia`), quando o teste precisa deles. */
  extras?: Record<string, unknown>;
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
    Object.assign(req, ator.extras ?? {});
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
