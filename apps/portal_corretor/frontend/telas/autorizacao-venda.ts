import type { UrbiVersoAPI } from '@urbiverso/sdk';
import { chamarApi, enviar, formularioEnviar, mensagemDeErro, ROTULO_TIPO_MIDIA } from '../apoio.js';

declare const urbiVerso: UrbiVersoAPI;

type Linha = Record<string, any>;

// Autorização de venda: registrar e marcar como assinada. Uma regra só para a ficha do imóvel (P06) e
// para o passo Autorização do Novo imóvel (P07, M3). As rotas são as de sempre (`POST /autorizacoes`,
// `PATCH /autorizacoes/:id`), que validam proprietário, vigência e documento de novo.

export const SITUACAO_AUTORIZACAO: Record<string, { rotulo: string; cor: string }> = {
  rascunho: { rotulo: 'Rascunho', cor: 'padrao' },
  enviada: { rotulo: 'Enviada ao proprietário', cor: 'info' },
  assinada: { rotulo: 'Assinada', cor: 'sucesso' },
  vencida: { rotulo: 'Vencida', cor: 'alerta' },
  revogada: { rotulo: 'Revogada', cor: 'padrao' },
};

const hojeIso = () => new Date().toLocaleDateString('sv-SE');
const mais = (dias: number) => new Date(Date.now() + dias * 86400e3).toLocaleDateString('sv-SE');

/** Garante a opção atual na seleção, mesmo fora da lista carregada (a seleção abriria vazia). */
export function comAtual(opcoes: { valor: string; rotulo: string; textoBusca?: string }[], atual: number | null, nome: string | null) {
  if (!atual || opcoes.some((o) => o.valor === String(atual))) return opcoes;
  return [{ valor: String(atual), rotulo: nome ?? `Atual (${atual})` }, ...opcoes];
}

/** A autorização ainda aberta (rascunho ou enviada), a que se marca como assinada. */
export const autorizacaoAberta = (autorizacoes: Linha[]) => autorizacoes.find((a) => ['rascunho', 'enviada'].includes(a.situacao)) ?? null;

/**
 * Registra a autorização de venda do imóvel: proprietário que assina, vigência, preço, comissão e
 * permissões. Devolve a autorização criada, ou `null` (cancelou, falhou ou falta o proprietário).
 */
export async function registrarAutorizacao(im: Linha): Promise<Linha | null> {
  let contatos: Linha[] = [];
  try {
    contatos = (await chamarApi('/contatos?papel=proprietario')).dados;
  } catch {
    /* segue com o proprietário atual, se houver */
  }
  const opcoesProp = comAtual(contatos.map((c) => ({ valor: String(c.id), rotulo: c.nome, textoBusca: c.telefone ?? '' })), im.proprietario_id, im.proprietario_nome);
  if (!opcoesProp.length) {
    await urbiVerso.alertar({ titulo: 'Cadastre o proprietário', mensagem: 'Em Clientes, cadastre quem assina a autorização com o papel "proprietário" e volte aqui.', tipo: 'alerta' });
    return null;
  }
  return formularioEnviar(
    'Autorização de venda',
    [
      {
        nome: 'proprietario_id',
        tipo: 'selecao',
        rotulo: 'Proprietário que assina',
        obrigatorio: true,
        pesquisavel: true,
        valor: im.proprietario_id ? String(im.proprietario_id) : null,
        opcoes: opcoesProp,
      },
      { nome: 'inicio', tipo: 'data', rotulo: 'Início', obrigatorio: true, valor: hojeIso() },
      { nome: 'fim', tipo: 'data', rotulo: 'Fim', obrigatorio: true, valor: mais(180) },
      { nome: 'preco_autorizado', tipo: 'numero', rotulo: 'Preço autorizado (R$)', obrigatorio: true, valor: im.preco_c ? im.preco_c / 100 : null, min: 0 },
      { nome: 'comissao_pct', tipo: 'numero', rotulo: 'Comissão (%)', obrigatorio: true, valor: 6, min: 0, max: 100, step: 0.5 },
      { nome: 'exclusiva', tipo: 'booleano', rotulo: 'Exclusiva', valor: false },
      { nome: 'permite_placa', tipo: 'booleano', rotulo: 'Permite placa', valor: true },
      { nome: 'permite_portais', tipo: 'booleano', rotulo: 'Permite anunciar em portais', valor: true },
      { nome: 'permite_parceria', tipo: 'booleano', rotulo: 'Permite parceria com outros corretores', valor: false },
    ],
    'POST',
    '/autorizacoes',
    (v) => ({ ...v, imovel_id: im.id, proprietario_id: Number(v.proprietario_id) }),
    { mensagem: 'Depois de assinada, anexe o documento e marque como assinada.' },
  );
}

/**
 * Marca a autorização como assinada, escolhendo o documento entre os arquivos do imóvel (o escolhido
 * passa a ser interno). Devolve `true` quando salvou.
 */
export async function marcarAssinada(a: Linha, midias: Linha[], ondeAnexar = 'em "Fotos e arquivos"'): Promise<boolean> {
  const docs = midias.filter((m) => m.tipo === 'documento' || m.tipo === 'foto');
  if (!docs.length) {
    await urbiVerso.alertar({ titulo: 'Anexe o documento', mensagem: `Envie o documento assinado (PDF ou foto) ${ondeAnexar} e volte aqui.`, tipo: 'alerta' });
    return false;
  }
  const doc = docs.find((d) => d.tipo === 'documento');
  const v = await urbiVerso.formulario({
    titulo: 'Marcar como assinada',
    mensagem: 'O documento escolhido fica interno: nunca aparece no anúncio.',
    campos: [
      {
        nome: 'documento_midia_id',
        tipo: 'selecao',
        rotulo: 'Documento assinado',
        obrigatorio: true,
        valor: doc ? String(doc.id) : null,
        opcoes: docs.map((d) => ({ valor: String(d.id), rotulo: `${ROTULO_TIPO_MIDIA[d.tipo]}: ${d.legenda ?? `arquivo ${d.id}`}` })),
      },
    ],
    rotuloConfirmar: 'Marcar como assinada',
  });
  if (!v) return false;
  try {
    await enviar('PATCH', `/autorizacoes/${a.id}`, { documento_midia_id: Number(v.documento_midia_id), situacao: 'assinada' });
    return true;
  } catch (e) {
    await urbiVerso.alertar({ titulo: 'Não foi possível marcar como assinada', mensagem: mensagemDeErro(e), tipo: 'erro' });
    return false;
  }
}
