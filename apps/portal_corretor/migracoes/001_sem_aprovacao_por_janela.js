// D-86 (release A): a aprovação por janela sai. Peça agendada sem aprovação volta a rascunho (o
// agendamento é cancelado) e a conta no modo "janela" passa a "manual". As colunas e a opção
// continuam no schema.json até o release B (#62): tirar a opção antes viraria CHECK contra linha em
// "janela" e deixaria a app !saudavel. Idempotente: na segunda execução não acha nada para mudar.
export default async function ({ dados, eventos, relato }) {
  const pecas = (await dados.varrerTudo('pecas', { filtros: { estado: 'agendada' } })).filter((p) => !p.aprovada_em);
  for (const p of pecas) {
    // Primeiro a peça: com estado e agendamento_id limpos, o listener já ignora o evento, mesmo que
    // o cancelamento abaixo não aconteça (ele escreve fora da transação da migração).
    await dados.atualizar('pecas', p.id, { estado: 'rascunho', agendada_para: null, agendamento_id: null });
    if (p.agendamento_id && typeof eventos?.cancelarAgendamento === 'function') {
      await eventos.cancelarAgendamento(Number(p.agendamento_id)).catch(() => undefined);
    }
  }
  if (pecas.length > 0) {
    relato?.avisar(
      `${pecas.length} peça(s) agendada(s) pela aprovação por janela voltaram a rascunho: o corretor aprova e agenda de novo`,
      pecas.slice(0, 20).map((p) => `peça #${p.id} (conta ${p.conta_id})`),
    );
  }
  const contas = await dados.varrerTudo('configuracoes_conta', { filtros: { modo_aprovacao_conteudo: 'janela' } });
  for (const c of contas) await dados.atualizar('configuracoes_conta', c.id, { modo_aprovacao_conteudo: 'manual' });
}
