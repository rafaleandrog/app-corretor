import '@urbiverso/sdk/express';
import { Router, type Request } from 'express';
import {
  artigoParaContexto,
  buscarArtigos,
  deslocamento,
  fusoValido,
  mascarar,
  respostaSegura,
  INSTRUCAO_ASSISTENTE,
  SCHEMA_RESPOSTA,
  TELAS_APP,
  telaBase,
  validarAcao,
  type Achado,
} from '../comum/assistente';
import { iso } from '../comum/funil';
import { assincrono, erro, guardarCorretor, primeiro } from './acesso';
import { filaDoDia } from './funil';

// Assistente do Corretor (bloco 9, spec 10.2). Responde pela ajuda (docs/ da app, D-58) e pelo
// estado da conta; propõe ações que o corretor confirma na tela. A ação não é executada aqui: a
// confirmada vai pelas rotas de sempre (POST /atividades, agendar peça), que validam de novo. (A
// fila do dia semeia as etapas e o playbook padrão na primeira vez, como o Início.)
export const assistenteRotas = Router();
guardarCorretor(assistenteRotas, ['/assistente']);

const SLOT = 'assistente';
const texto = (v: unknown, limite: number) => (typeof v === 'string' ? v.trim().slice(0, limite) : '');

/** `estadoSlot` sem custo; falha da sonda conta como indisponível, salvo slot fora do manifesto. */
async function iaDisponivel(req: Request): Promise<boolean> {
  if (!req.ia) return false;
  try {
    return !!(await req.ia.estadoSlot(SLOT)).efetivo;
  } catch (e) {
    if ((e as { codigo?: string })?.codigo === 'SLOT_INVALIDO') throw e;
    return false;
  }
}

/** Resumo do que já está ligado na conta, para responder "já conectei?" sem a IA adivinhar. */
async function estadoDaConta(req: Request): Promise<string> {
  const dados = req.dados!;
  const [eu, canal, pagina, contatos, imoveis, pecas] = await Promise.all([
    primeiro(dados, 'perfis_corretor', { usuario_id: req.contexto!.usuario.id }),
    primeiro(dados, 'canais_sociais', { rede: 'instagram', 'desconectado_em[nulo]': 'true' }),
    primeiro(dados, 'paginas_corretor', { chave: 'conta' }),
    dados.listar('contatos', { por_pagina: 1 }),
    dados.listar('imoveis', { por_pagina: 1 }),
    dados.listar('pecas', { filtros: { estado: 'aprovada' }, por_pagina: 1 }),
  ]);
  return [
    `CRECI cadastrado: ${eu?.creci ? 'sim' : 'não'}`,
    `Instagram: ${canal ? `conectado (@${canal.usuario}, conta ${canal.tipo_conta})` : 'não conectado'}`,
    `Minha página: ${pagina?.publicada_em ? 'publicada' : pagina ? 'rascunho, não publicada' : 'ainda não criada'}`,
    `Contatos: ${contatos.total} · Imóveis: ${imoveis.total} · Peças aprovadas esperando publicação: ${pecas.total}`,
  ].join('\n');
}

/** Dados permitidos de um contato (10.2): sem telefone nem e-mail; o histórico pelos resumos. */
export async function contextoContato(req: Request, contatoId: number): Promise<{ texto: string; nome: string } | null> {
  const dados = req.dados!;
  const c = await dados.buscar('contatos', contatoId);
  if (!c || c.anonimizado_em) return null;
  const linha = await dados.listar('linha_do_tempo', { filtros: { contato_id: c.id }, ordenar: 'ocorrido_em', ordem: 'desc', por_pagina: 8 });
  const perfil = c.perfil_busca && typeof c.perfil_busca === 'object' ? JSON.stringify(c.perfil_busca).slice(0, 400) : null;
  return {
    nome: mascarar(c.nome),
    texto: [
      `Contato #${c.id}: ${mascarar(c.nome)}`,
      `Temperatura: ${c.temperatura ?? 'sem classificação'}${c.temperatura_motivo ? ` (${mascarar(c.temperatura_motivo)})` : ''}`,
      `Último contato: ${iso(c.ultimo_contato_em) ?? 'nunca'}`,
      c.proximo_passo ? `Próximo passo: ${mascarar(c.proximo_passo)}${c.proximo_passo_em ? ` em ${iso(c.proximo_passo_em)}` : ''}` : null,
      perfil ? `Perfil de busca: ${mascarar(perfil)}` : null,
      linha.dados.length ? `Histórico recente:\n${linha.dados.map((l) => `- ${iso(l.ocorrido_em)?.slice(0, 10)}: ${mascarar(String(l.resumo ?? l.tipo).slice(0, 160))}`).join('\n')}` : null,
    ].filter(Boolean).join('\n'),
  };
}

/** Só os artigos que a IA citou e que estavam entre os enviados: nada de artigo sem relação. */
function artigosDaResposta(achados: Achado[], citados: unknown) {
  const ids = Array.isArray(citados) ? citados.filter((x): x is string => typeof x === 'string') : [];
  return achados.filter((a) => ids.includes(a.id)).map(({ id, slug, titulo, secao }) => ({ id, slug, titulo, secao }));
}

assistenteRotas.post(
  '/assistente/perguntar',
  assincrono(async (req, res) => {
    const pergunta = texto(req.body?.pergunta, 1000);
    if (!pergunta) return erro(res, 422, 'DADOS_INVALIDOS', 'Escreva a pergunta.');
    const tela = telaBase(texto(req.body?.tela, 200) || '/');
    const historico = (Array.isArray(req.body?.historico) ? req.body.historico : [])
      .slice(-6)
      .map((h: { autor?: unknown; texto?: unknown }) => ({ autor: h?.autor === 'assistente' ? 'Assistente' : 'Corretor', texto: texto(h?.texto, 800) }))
      .filter((h: { texto: string }) => h.texto);
    const ultimoMeu = [...historico].reverse().find((h: { autor: string }) => h.autor === 'Corretor')?.texto ?? '';
    const achados = buscarArtigos(`${pergunta} ${ultimoMeu}`, tela, 5);

    // Sem IA (ou se ela falhar na hora), o Assistente vira busca na ajuda: os artigos mais próximos.
    const soAjuda = (motivo: string) => {
      const lista = achados.slice(0, 3);
      return res.json({
        sem_ia: true,
        resposta: lista.length ? `${motivo} Pela ajuda, estes artigos falam do assunto:` : `${motivo} Não achei nada na ajuda com essas palavras: tente outras palavras ou abra a documentação.`,
        artigos: lista.map(({ id, slug, titulo, secao }) => ({ id, slug, titulo, secao })),
        tela: null,
        acao: null,
        nao_sei: !lista.length,
      });
    };
    if (!(await iaDisponivel(req))) return soAjuda('A IA do Assistente não está liberada agora.');

    const dados = req.dados!;
    const fuso = fusoValido(req.contexto?.fuso);
    const contatoId = Number.isInteger(req.body?.contato_id) ? (req.body.contato_id as number) : null;
    const recentes = (estado: string) => dados.listar('pecas', { filtros: { estado }, ordenar: 'criado_em', ordem: 'desc', por_pagina: 10 });
    const [estado, fila, foco, aprovadas, rascunhos] = await Promise.all([
      estadoDaConta(req),
      filaDoDia(dados, fuso).catch(() => []),
      contatoId ? contextoContato(req, contatoId) : Promise.resolve(null),
      recentes('aprovada'),
      recentes('rascunho'),
    ]);
    const pecas = { dados: [...aprovadas.dados, ...rascunhos.dados] };
    const contatos = new Map<number, string>(fila.slice(0, 10).map((i) => [i.contato_id, mascarar(i.contato_nome)]));
    if (foco && contatoId) contatos.set(contatoId, foco.nome);
    const mapaPecas = new Map(pecas.dados.map((p) => [p.id as number, { titulo: String(p.titulo ?? `Peça ${p.id}`), estado: String(p.estado) }]));
    const agora = new Date();
    const contexto = [
      `AGORA: ${agora.toLocaleString('pt-BR', { timeZone: fuso })} (fuso ${fuso}, deslocamento ${deslocamento(fuso, agora)}; ISO ${agora.toISOString()})`,
      `TELA ATUAL: ${TELAS_APP[tela]?.nome ?? 'Início'}`,
      `ESTADO DA CONTA:\n${estado}`,
      fila.length
        ? `FILA DO DIA (mais urgente primeiro):\n${fila.slice(0, 10).map((i) => `- contato #${i.contato_id} ${mascarar(i.contato_nome)} · ${i.tipo} · ${i.temperatura ?? 'sem temperatura'} · ${mascarar(i.texto)}`).join('\n')}`
        : 'FILA DO DIA: vazia.',
      foco ? `CONTATO EM FOCO:\n${foco.texto}` : null,
      mapaPecas.size ? `PEÇAS DO ESTÚDIO:\n${[...mapaPecas].map(([id, p]) => `- #${id} ${mascarar(p.titulo)} (${p.estado})`).join('\n')}` : null,
      achados.length ? `ARTIGOS DA AJUDA:\n${achados.map((a) => artigoParaContexto(a)).join('\n\n')}` : 'ARTIGOS DA AJUDA: nenhum ligado à pergunta.',
      historico.length ? `CONVERSA ATÉ AGORA:\n${historico.map((h: { autor: string; texto: string }) => `${h.autor}: ${mascarar(h.texto)}`).join('\n')}` : null,
      `PERGUNTA DO CORRETOR: ${pergunta}`,
    ].filter(Boolean).join('\n\n');

    let r;
    try {
      r = await req.ia!.consultar({ contexto, schema: SCHEMA_RESPOSTA, slot: SLOT, instrucoes_sistema: INSTRUCAO_ASSISTENTE });
    } catch (e) {
      const codigo = (e as { codigo?: string })?.codigo;
      if (!codigo || codigo === 'SLOT_INVALIDO') throw e;
      return soAjuda('A IA do Assistente não respondeu agora.');
    }
    const d = (r.dados ?? {}) as Record<string, unknown>;
    const naoSei = d.nao_sei === true;
    const sub = typeof d.tela === 'string' && TELAS_APP[d.tela] ? d.tela : null;
    res.json({
      sem_ia: false,
      resposta: respostaSegura(texto(d.resposta, 2000)) || 'Não consegui montar uma resposta. Pode perguntar de outro jeito?',
      artigos: artigosDaResposta(achados, d.artigos),
      tela: sub ? { sub, nome: TELAS_APP[sub].nome } : null,
      acao: validarAcao(d.acao, { contatos, pecas: mapaPecas, agora, fuso }),
      nao_sei: naoSei,
    });
  }),
);
