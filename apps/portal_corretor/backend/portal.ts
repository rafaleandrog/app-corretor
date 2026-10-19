import type { HelperDados } from '@urbiverso/sdk';
import { iso } from '../comum/funil';
import { imovelPublico, TEMAS } from '../comum/pagina';

// Seleções e Portal do Cliente na vitrine pública (bloco 5b, D-56, D-73). O cliente abre por link com
// o token do ingresso `wh`; a rota pública só lê a vitrine. Estas funções servem à rota do corretor
// (helper do request) e aos listeners (SISTEMA, que lê todas as contas): toda leitura filtra a conta.

type Linha = Record<string, any>;

export interface Corretor {
  nome: string;
  creci: string | null;
  telefone: string | null;
  cor: string;
}

const chave = (conta: number, id: number) => `${conta}:${id}`;

async function umaLinha(dados: HelperDados, tabela: string, filtros: Record<string, unknown>): Promise<Linha | null> {
  return (await dados.varrerTudo(tabela, { filtros, maximo: 1 }))[0] ?? null;
}

async function gravarVitrine(dados: HelperDados, conta: number, tipo: string, id: number, conteudo: unknown) {
  const agora = new Date().toISOString();
  const atual = await umaLinha(dados, 'vitrine_publica', { conta, tipo, chave: chave(conta, id) });
  if (atual) return dados.atualizar('vitrine_publica', atual.id, { dados: conteudo, publicado_em: agora });
  return dados.criar('vitrine_publica', { conta, tipo, chave: chave(conta, id), codigo: null, dados: conteudo, publicado_em: agora });
}

export async function apagarVitrine(dados: HelperDados, conta: number, tipo: string, id: number) {
  const atual = await umaLinha(dados, 'vitrine_publica', { conta, tipo, chave: chave(conta, id) });
  if (atual) await dados.deletar('vitrine_publica', atual.id);
}

export async function lerVitrine(dados: HelperDados, conta: number, tipo: string, id: number) {
  return umaLinha(dados, 'vitrine_publica', { conta, tipo, chave: chave(conta, id) });
}

/** Quem aparece no topo da seleção e do portal: o nome e a cor da página (se houver) e o perfil do corretor. */
export async function corretorDaConta(dados: HelperDados, conta: number, usuarioId: number, nomeUsuario: string): Promise<Corretor> {
  const [pagina, perfil, contaLinha] = await Promise.all([
    umaLinha(dados, 'paginas_corretor', { conta_id: conta, chave: 'conta' }),
    umaLinha(dados, 'perfis_corretor', { conta_id: conta, usuario_id: usuarioId }),
    umaLinha(dados, 'perfil_conta', { conta_id: conta, chave: 'conta' }),
  ]);
  return {
    nome: pagina?.nome_exibicao || nomeUsuario || contaLinha?.nome || 'Seu corretor',
    creci: perfil?.creci ?? contaLinha?.creci_juridico ?? null,
    telefone: perfil?.telefone ?? null,
    cor: TEMAS[pagina?.tema]?.cor ?? TEMAS.oceano.cor,
  };
}

/** Seleção enviada: retrato dos imóveis no envio, só com dado de anúncio, e a reação de cada um. */
export async function publicarSelecao(dados: HelperDados, conta: number, selecao: Linha, corretor: Corretor) {
  const itens = await dados.varrerTudo('selecao_itens', { filtros: { conta_id: conta, selecao_id: selecao.id }, ordenar: 'ordem', ordem: 'asc', maximo: 50 });
  const ids = itens.map((i) => i.imovel_id).join(',');
  const [imoveis, midias] = itens.length
    ? await Promise.all([
        dados.varrerTudo('imoveis', { filtros: { conta_id: conta, id: ids }, maximo: 50 }),
        dados.varrerTudo('imovel_midias', { filtros: { conta_id: conta, imovel_id: ids }, maximo: 2000 }),
      ])
    : [[], []];
  const porId = new Map(imoveis.map((i) => [i.id, i]));
  await gravarVitrine(dados, conta, 'selecao', selecao.id, {
    titulo: selecao.titulo,
    mensagem: selecao.mensagem ?? null,
    enviada_em: iso(selecao.enviada_em),
    expira_em: iso(selecao.expira_em),
    url_reacao: selecao.url_reacao ?? null,
    corretor,
    itens: itens
      .filter((i) => porId.has(i.imovel_id))
      .map((i) => ({ ...imovelPublico(porId.get(i.imovel_id)!, midias.filter((m) => m.imovel_id === i.imovel_id)), reacao: i.reacao ?? null })),
  });
}

/** Reação gravada: a vitrine da seleção mostra a escolha na próxima abertura. */
export async function marcarReacaoNaVitrine(dados: HelperDados, conta: number, selecaoId: number, codigo: string, reacao: string) {
  const linha = await lerVitrine(dados, conta, 'selecao', selecaoId);
  if (!linha) return;
  const conteudo = linha.dados as Linha;
  const itens = (conteudo.itens ?? []).map((i: Linha) => (i.codigo === codigo ? { ...i, reacao } : i));
  await dados.atualizar('vitrine_publica', linha.id, { dados: { ...conteudo, itens } });
}

/** Seleção que o cliente ainda pode abrir: enviada, não revogada, dentro da validade. */
export function selecaoValida(s: Linha, agora = new Date().toISOString()): boolean {
  const expira = iso(s.expira_em);
  return !s.revogada_em && (!expira || expira > agora);
}

/**
 * Portal do Cliente (11.3, comprador): as seleções válidas, a agenda de visitas, a jornada e o topo
 * com o corretor. Nada de nome, telefone ou e-mail do cliente (D-73). Sem acesso ativo, a linha sai.
 * `corretor` ausente (listener) mantém o topo já publicado.
 */
export async function sincronizarPortal(dados: HelperDados, conta: number, contatoId: number, corretor?: Corretor): Promise<void> {
  const acesso = await umaLinha(dados, 'acessos_cliente', { conta_id: conta, contato_id: contatoId, 'revogado_em[nulo]': 'true' });
  if (!acesso) {
    await apagarVitrine(dados, conta, 'portal', contatoId);
    return;
  }
  const atual = await lerVitrine(dados, conta, 'portal', contatoId);
  const topo = corretor ?? (atual?.dados as Linha | undefined)?.corretor;
  const [contato, selecoes, atividades] = await Promise.all([
    umaLinha(dados, 'contatos', { conta_id: conta, id: contatoId }),
    dados.varrerTudo('selecoes', { filtros: { conta_id: conta, contato_id: contatoId }, ordenar: 'enviada_em', ordem: 'desc', maximo: 200 }),
    dados.varrerTudo('atividades', { filtros: { conta_id: conta, contato_id: contatoId, tipo: 'visita' }, ordenar: 'quando', ordem: 'asc', maximo: 500 }),
  ]);
  if (!contato) {
    await apagarVitrine(dados, conta, 'portal', contatoId);
    return;
  }
  const agora = new Date().toISOString();
  const validas = selecoes.filter((s) => selecaoValida(s, agora));
  const visitas = atividades.length
    ? await dados.varrerTudo('visitas', { filtros: { conta_id: conta, atividade_id: atividades.map((a) => a.id).join(',') }, maximo: 500 })
    : [];
  const imovelDe = new Map(visitas.map((v) => [v.atividade_id, v.imovel_id]));
  const imoveisIds = [...new Set(visitas.map((v) => v.imovel_id))];
  const imoveis = imoveisIds.length ? await dados.varrerTudo('imoveis', { filtros: { conta_id: conta, id: imoveisIds.join(',') }, maximo: 500 }) : [];
  const imovel = new Map(imoveis.map((i) => [i.id, i]));
  const ontem = new Date(Date.now() - 86400e3).toISOString();
  const agenda = atividades
    .filter((a) => a.status === 'pendente' && (iso(a.quando) ?? '') >= ontem)
    .slice(0, 20)
    .map((a) => {
      const im = imovel.get(imovelDe.get(a.id));
      return {
        ref: a.id,
        quando: iso(a.quando),
        // Do imóvel, só o que pode aparecer num anúncio (o endereço segue `endereco_publico`).
        imovel: im ? { codigo: im.codigo, titulo: im.titulo ?? null, bairro: im.endereco_publico === 'regiao' ? null : (im.bairro ?? null), cidade: im.cidade ?? null, endereco: im.endereco_publico === 'completo' ? (im.endereco ?? null) : null } : null,
      };
    });
  const itens = validas.length ? await dados.varrerTudo('selecao_itens', { filtros: { conta_id: conta, selecao_id: validas.map((s) => s.id).join(',') }, maximo: 2000 }) : [];
  await gravarVitrine(dados, conta, 'portal', contatoId, {
    corretor: topo ?? null,
    url_acoes: acesso.url_acoes ?? null,
    selecoes: validas.map((s) => s.id),
    agenda,
    jornada: {
      desde: (iso(contato.criado_em) ?? agora).slice(0, 10),
      imoveis_recebidos: new Set(itens.map((i) => i.imovel_id)).size,
      visitas_feitas: atividades.filter((a) => a.status === 'feita').length,
    },
  });
}

/** Para rotas que mudam a agenda ou as seleções: o portal acompanha sem derrubar a rota. */
export async function tentarPortal(dados: HelperDados, conta: number | undefined, contatoId: number | null | undefined, corretor?: Corretor) {
  if (!conta || !contatoId) return;
  try {
    await sincronizarPortal(dados, conta, contatoId, corretor);
  } catch (e) {
    console.warn(`[portal_corretor] portal do cliente ${contatoId}: não sincronizado: ${(e as Error).message}`);
  }
}
