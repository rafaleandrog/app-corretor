# Etapa 4 concluída

**Não há mais nada a retomar.** Os grupos 1 a 5 estão mergeados (#199, #200, #201, #203, #204, #205; app 0.1.51) e o release da `main` sai logo após o merge do #205. Plano e registro de sessões em `specs/plano_de_implementacao.md`.

## O que espera o dono (não decidir por ele)

- **D-133** (custo por lead e por venda, `custos-origem`, horizonte 1.3; vetável).
- **P-47** (atendimento automático sem consentimento só com mensagem-modelo).
- **P-48** (`ip_hash` por HMAC com segredo).
- **D-129** (lead × contato existente e consentimento declarado; vetável).
- Título e rota da P15 ("Negociações", `/negociacoes`) × referência ("Clientes" com alternador).
- Menu do usuário externo (a confirmar entrando como o corretor demo).
- Diferenças da conferência visual do grupo 5 (`specs/prints/conferencia-grupo5-0.1.51/`): P05, coluna direita 379 px contra 340 da referência (a spec fixa 380); P17, botões em duas linhas; P10, funil em colunas contra barras; P13, blocos Conta e Referências que a referência não tem.
- Revisão do Codex no #205 (head 91c0ce7): `PUT /conta/meu-perfil` não ressincroniza `vitrine_publica` quando `nome_profissional` muda (decidir se dispara a ressincronização, com o tratamento de falha da marca); conta demo criada depois do boot sem `perfil_conta` é tratada como real pelo bloqueio do #33 até o próximo `aoIniciar` (decidir como reconhecer demo sem a linha). Ver pendências (9) e (10) do grupo 5 no plano.

Issues parciais que seguem abertas: #182, #180, #192, #176, #73, #30.
