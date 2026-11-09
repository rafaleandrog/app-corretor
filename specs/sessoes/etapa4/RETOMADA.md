# Retomada da etapa 4 (pausa pedida pelo dono em 09/11, ~04h30 UTC)

## Estado

- **main** = 75e14f1 (grupo 4, #204, mergeado; versão 0.1.50). Grupos 1 a 4 da etapa 4 fechados (#200, #201, #203, #204).
- **PR #205 (grupo 5)**, branch `etapa4/grupo5`, versão **0.1.51** (schema: `perfis_corretor.nome_profissional`, `regioes`,
  `marca_conta.tom_voz`). A `main` já foi mesclada; `tsc` limpo, 696 testes passando, empacotador ok. Corpo do PR com `Closes` em inglês
  (#177 #173 #183 #40 #32 #33 #80 #68) e os parciais (#182, #180, #192, #176, #73, #30).
- Pré-release do branch disparado (`release.yml`, ref `etapa4/grupo5`, alvo `portal_corretor`). Confira com
  `GET /api/shell/apps` na pinguim (token de `URBIVERSO_INSTANCIAS`) se a 0.1.51 instalou.
- Codex pedido no PR (comentário `@codex review`); leia o resultado nos comentários/threads do PR.

## Revisão do #205: rodada 1 interrompida (pausa)

Preâmbulo e laudos das lentes que terminaram: `specs/sessoes/etapa4/revisao-205-r1/` (S3, contrato barramento/IA, S1S2).
- **Bloqueante (S3):** `frontend/visual.ts:279-281` — `escolhaUnica` põe `role="radio"` em `urbi-card clicavel` sem `tabindex`,
  sem Enter/Espaço e sem `role="radiogroup"`; teclado e leitor de tela não trocam tom de voz, estilo do Negociador nem modo de
  repetidos. Conserto: foco + teclas + grupo, ou `urbi-select`; registrar a lacuna de acessibilidade no pedido ao shell 29.
- Observações: escolha única fora da tabela da spec 11.9 (registrar lá); `backend/negociacao.ts:898` PUT sem mudança grava evento
  auditável (só publicar se houver alteração); três comentários velhos (ver S1S2.md).
- **Não terminaram** (rodar de novo, só estas): L1 backend, L1/L3 frontend, L2 comportamento removido, L4/T3 concorrência e
  compatibilidade, contrato dados/manifesto (Opus), contrato permissões/contas (Opus).
- Conferência visual ainda não feita: agente Sonnet, `capturar.mjs` + `comparar.py`, README no formato de
  `specs/prints/conferencia-grupo4-0.1.50/`, pasta `specs/prints/conferencia-grupo5-0.1.51/`, telas P05, P10, P12, P13, P14, P17.

## O que falta, em ordem

1. Rodar as 6 lentes que faltam (Sonnet; as duas de contrato em Opus) + conferência visual em paralelo.
2. Publicar o relatório da rodada 1 no PR (formato da skill `revisar-pr-apps`, com quadro de execução).
3. Consertos em lotes disjuntos por arquivo (subagentes), um commit por rodada; `tsc`, `pnpm test`, `pnpm empacotar`;
   se mexer em `docs/`, `pnpm ajuda` e commitar `comum/ajuda-gerada.ts`.
4. **Rodada 2 (a última; o dono pediu só duas)**, passe de fechamento, veredito.
5. Merge (autorizado para a etapa) com CI verde no SHA final; fechar à mão as issues do `Closes`, com motivo; plano atualizado no
   próprio PR (linha do grupo 5 `[x]` 0.1.51 #205, registro de sessões, pendências).
6. Fim da etapa: release da `main` (`release.yml`, ref `main`, alvo `portal_corretor`) e aviso ao dono.

## Ordens permanentes do dono

- Subagentes só Opus ou Sonnet. Revisão pela skill `revisar-pr-apps`; Codex só pela menção no PR (em relatórios, escreva "Codex"
  sem arroba); Codex CLI e Kimi bloqueados pelo proxy (403): motor nativo.
- Pré-release de branch só na conferência e na revisão; nenhum release da `main` antes do fim da etapa 4.
- Merge de cada PR após revisão sem bloqueante e CI verde (autorização dada para a etapa). Closes não fecha sozinho aqui: fechar à mão.
- **Esperam o dono (não decida):** D-133 (vetável), P-47 (sem consentimento só mensagem-modelo), P-48 (ip_hash por HMAC),
  D-129 (vetável), título e rota da P15, menu do usuário externo.
- Economia de tokens: sessão coordenadora magra; relatórios curtos; nada de reler diffs inteiros na sessão principal.
