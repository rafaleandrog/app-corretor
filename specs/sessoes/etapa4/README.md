# Etapa 4 · como continuar em outra sessão

Esta pasta guarda o material de trabalho da etapa 4 da fase 1.7 (telas contra a referência v2, comandos ponta a ponta, issues abertas). Vale junto com `specs/plano_de_implementacao.md` (status e pendências) e `specs/portal_corretor.md` (decisões D-121 a D-128 e as que vierem).

## Estado

| Item | Situação |
|---|---|
| PR 1 · infra (#200) | mergeado, 0.1.47 |
| Grupo 2 · Hoje, Funil, Cliente, Seleção e Agendar visita na P02, Buscar (#201) | mergeado, 0.1.48 |
| Grupo 3 · Imóveis, Imóvel, M3, Negociações, Negociação, M8, Proposta na P02, D-120, D-125 | mergeado, 0.1.49 (#203) |
| Grupo 4 · Estúdio, Página, M6, M4 + M5 | mergeado, 0.1.50 (#204) |
| Grupo 5 · Números, Conexões, Conta e marca, Importar, Negociador, Assistente + transversais | mergeado, 0.1.51 (#205; conferência visual em `specs/prints/conferencia-grupo5-0.1.51/`) |
| Etapa 4 | **concluída** com o merge do #205 |
| Release da `main` para a homologação | logo após o merge do #205 (fim da etapa, ordem do dono de 08/11) |

## Como rodar um grupo (o que funcionou nos grupos 2 e 3)

1. **Branch** `etapa4/grupoN` a partir da `main` atualizada (`git fetch origin main && git checkout -B etapa4/grupoN origin/main`). Se o grupo anterior ainda estiver em revisão, pode nascer da branch dele e depois mergear a `main` (merge, nunca rebase/force).
2. **Implementação**: um agente (Opus) com o brief do grupo. O brief já traz spec, diagnóstico, referência, issues a fechar, regras e o formato do relatório. O agente comita e empurra a cada passo; não abre PR, não faz release, não toca na instância. `versao` do manifesto e `version` do `package.json` sobem juntos quando schema, migração ou pisos mudam (confira a `main` antes: o número é sequencial).
3. **PR**: título com o grupo e a versão; corpo com o que entrou por tela, `Closes #n` em inglês (um por issue), parciais, decisões que pedem o dono (P-nn), o que ficou de fora e por quê, diferenças de primitivo, eventos novos. Rodapé do Claude Code.
4. **Pré-release do branch** para a homologação "pinguim" (workflow `release.yml`, `ref` = branch, `alvo` = `portal_corretor`); a instância instala sozinha em poucos minutos (`GET /api/shell/apps` mostra a versão). É permitido só durante a conferência e a revisão do PR.
5. **Conferência visual** (seção 6 de `specs/layout/README.md`): `CONTA=7 CONVERSA=1 node apps/portal_corretor/scripts/conferencia-visual/capturar.mjs pinguim <saida> <telas>` e `comparar.py <saida> <lado> --md`; README no formato de `specs/prints/conferencia-grupo2-0.1.48/README.md` (tabela diferença · causa · decisão; D-121 tolerância, D-122 "Todas", D-123 botão só ícone, D-124 primitivo como ele é, D-126 Buscar, D-128 cabeçalho comum). Pode ser feita por um agente Sonnet.
6. **Revisão**: skill `revisar-pr-apps` com `#n máximo 3 rodadas`. Codex pela menção `@codex review` num comentário do PR (é o único lugar com arroba; em relatórios escreva "Codex"); Codex CLI e Kimi ficam fora enquanto o proxy do ambiente recusar `api.openai.com` e `api.moonshot.ai`. Lentes em Sonnet; Opus só para contrato (schema, manifesto, permissões, contas, auditoria) e consertos que o toquem. Um commit por rodada; passe de fechamento; veredito.
7. **Merge** com CI verde no head final e revisão sem bloqueante (autorização do dono para a etapa); conferir que as issues fecharam; plano com `[x]`, registro de sessão e pendências.

## Decisões que esperam o dono

- Título e rota da P15 ("Negociações", `/negociacoes`) × referência ("Clientes" com alternador): pendência (1) do grupo 3 no plano.
- Menu do usuário externo: pendência (1) do plano, a confirmar entrando como o corretor demo.
- Grupo 5: D-133, P-47, P-48, D-129, as diferenças da conferência visual (P05 379 × 340, P17, P10, P13) e as pendências (9) e (10) da revisão do Codex (ressincronizar `vitrine_publica` na mudança de perfil; reconhecer conta demo sem `perfil_conta`); ver `RETOMADA.md`.

## Arquivos desta pasta

- `brief-grupo2.md` … `brief-grupo5.md`: briefs de implementação (2 e 3 já executados; servem de modelo).
- `achados-201-r1.md`: achados das três rodadas da revisão do #201 (referência do que as lentes pegam).
- `RETOMADA.md`: etapa 4 concluída; lista do que espera o dono.
