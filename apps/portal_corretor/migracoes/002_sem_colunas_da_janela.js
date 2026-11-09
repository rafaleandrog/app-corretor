// D-86 (release B, #62): a aprovação por janela saiu na migração 001 (release A), que levou toda conta
// em "janela" para "manual". As duas colunas deixam o schema.json; aqui elas são esvaziadas para a poda
// pós-migrações derrubar a estrutura. Nada é lido delas: o modo é sempre "manual" e as horas não têm uso.
// Onde a coluna nunca recebeu dado, a poda já a derrubou e `limparColuna` vira no-op (banco-de-dados.md).
export default async function ({ dados }) {
  await dados.limparColuna('configuracoes_conta', 'modo_aprovacao_conteudo');
  await dados.limparColuna('configuracoes_conta', 'janela_aprovacao_horas');
}
