# Retomada da etapa 4 (pausa pedida pelo dono em 08/11, ~16h15 UTC)

## Estado no momento da pausa

- **main**: 4898559 (#200 mergeado). Pinguim com 0.1.48 do branch `etapa4/grupo2` (pré-release b89e915).
- **PR #201 (grupo 2)**, branch `etapa4/grupo2`, head **f268716** (= origin). Revisão em modo ciclo, rodada 3 (última) EM VOO:
  lentes L4+L1, T4, S2 e a varredura final sobre o diff acumulado (Opus, em background) + Codex pelo GitHub (pedido no head f268716).
  Relatórios das rodadas 1 e 2 publicados (6723597872, 6723757080). Placar: rodada 1 zerou 5 de 6 bloqueantes; o 6.º (visita duplicada)
  voltou na rodada 2 como 2.ª passagem e foi consertado em f268716 (todos os passos de `POST /atividades` protegidos, enumerados).
  Threads do Codex respondidas (6). Suíte: 624 passando; tsc limpo; empacotador ok (0.1.48).
  Conferência visual commitada: `specs/prints/conferencia-grupo2-0.1.48/` (06cf45e).
  Achados por rodada: `scratchpad/revisao/achados-201-r1.md`.
- **Grupo 3**, branch `etapa4/grupo3` (worktree `.claude/worktrees/…`, agente Opus em background): 3+ commits empurrados
  (#38/#39, #179, D-120/#178/#194/#195). Brief: `scratchpad/brief-grupo3.md`. Quando terminar, manda relatório.
- Briefs dos grupos 4 e 5 prontos: `scratchpad/brief-grupo4.md`, `brief-grupo5.md`.
- Ordens permanentes: subagentes só em Opus/Sonnet (nunca Fable); revisão com a skill `revisar-pr-apps` (Codex por `@codex review`
  no PR, sem arroba em texto de relatório; Kimi/Codex CLI bloqueados pelo proxy: 403); pré-release de branch só durante conferência
  e revisão; **nenhum release da main até o fim da etapa 4**; merge de cada PR do grupo após revisão limpa e CI verde (autorização dada).

## O que falta no #201 quando as lentes da rodada 3 voltarem

1. Ler os 4 relatórios (+ Codex). Se zero bloqueante: suíte completa (já rodada em f268716, repetir uma vez), passe de fechamento
   (só triviais: `pequeno` em `frontend/estados.ts:51`; nada em `negociacoes.ts`, que é do grupo 3), registrar no plano as observações
   abertas (fuso do navegador na agenda; página de 1000 linhas; ORDEM_FILA; atalhos do M1 vs spec 11.5; matchMedia/gancho aoSair;
   #187 parcial; testes só por grep; campos_incluir; aba Negócios empilhada; modal da visita em formulario), corrigir o corpo do PR
   (#187 parcial), comentário do passe, veredito, merge (gate: CI verde no SHA final, Closes em inglês, docs, versão 0.1.48),
   conferir issues fechadas (#172 #175 #186 #196 #197; #187 fica aberta), plano com [x] do grupo 2.
2. Se sobrar bloqueante: rodadas esgotadas → veredito "não recomendo" com a pergunta ao dono.

## Modo de operação eficiente a partir da retomada (ordem do dono)

- A sessão principal vira **coordenadora magra**: não lê diffs, não roda lentes, não escreve relatórios longos. Só despacha, lê
  relatórios curtos (≤ 300 palavras), confere portões (CI, head, versão) e faz merge.
- **Um agente Opus "condutor" por PR**, que executa o ciclo inteiro e devolve um resumo: ele invoca a skill `revisar-pr-apps`
  (`#N máximo 3 rodadas`) e, dentro dela, usa **Sonnet** para as lentes adversariais (L1–L5, T4, S1–S3) e **Opus** só para lentes de
  contrato sensível (schema, manifesto, permissões, contas) e para os lotes de conserto que tocam contrato; lotes de conserto
  mecânicos/locais em **Sonnet**. Ele mesmo pede `@codex review` no PR e incorpora. Ele comita os consertos (um por rodada) e empurra.
- **Implementação de grupo** (3 já em curso; 4 e 5): um agente Opus por grupo com o brief existente; conferência visual
  (`capturar.mjs` + `comparar.py` + README da pasta `specs/prints/conferencia-grupoN-<versao>/`) feita por um agente **Sonnet** com o
  roteiro de `specs/prints/conferencia-grupo2-0.1.48/README.md` como modelo; o pré-release do branch é disparado pela coordenadora
  (`release.yml`, ref = branch, alvo `portal_corretor`) antes da conferência.
- Paralelismo: grupo N+1 implementa em worktree enquanto o grupo N está em revisão; reconciliação (plano, spec, manifesto `versao`,
  P02, ajuda gerada) feita pelo implementador ao rebasear sobre a main depois do merge anterior.
- Cada relatório ao dono: o que ficou pronto, pendente, próximo item; sem repetir o conteúdo dos comentários do PR.

## Roteiro da próxima mensagem "continue"

1. Checar notificações (relatórios da rodada 3, Codex, grupo 3).
2. Fechar o #201 como acima (passe + veredito + merge) — se as lentes já voltaram, a coordenadora faz só o fechamento (sem lentes novas).
3. Grupo 3: quando o agente entregar, despachar UM agente Opus condutor: rebase sobre a main (com #201), reconciliar, testes, PR com
   `Closes`, pedir pré-release à coordenadora, conferência (Sonnet), skill de revisão em ciclo (lentes Sonnet/Opus), consertos, veredito.
4. Grupo 4: despachar implementador Opus com `brief-grupo4.md` em worktree assim que o grupo 3 abrir PR (antes: publicar a Minha Página
   da conta demo, item do brief).
5. Grupo 5 idem, depois do 4. Ao final de tudo: release da main (`release.yml`, alvo `portal_corretor`) e aviso ao dono.

## Chegou durante a pausa (não agido)

- **Grupo 3 ENTREGUE** (agente concluído): branch `etapa4/grupo3`, 7 commits (836a4a6 … 698fc43), 630 testes, empacotador ok,
  versão 0.1.48 (→ 0.1.49 na reconciliação com o grupo 2, que já usa 0.1.48). Sem PR, sem conferência visual. Closes #38 #39 #178
  #179 #185 #188 #194 #195; parciais #180, #182 (3,4), #190 (M3, M8). Decisões P-44 (passo abaixo do recuo liberado junto com a
  confirmação da D-120) e P-45 (colunas de dinheiro INTEGER: teto R$ 21.474.836,47; #39 pedia 99 mi) registradas na spec → perguntar
  ao dono. Fora: Editar da sugestão abaixo do recuo; ações fixas no rodapé de M3/M8 (sem primitivo). Eventos novos:
  `contraproposta_abaixo_do_recuo` (auditável), `proposta_decidida`. Commits com atribuição "Claude Opus 5.5" (lembrete do sistema).
  Worktree do agente: `.claude/worktrees/agent-a4a491ab22b8e218c` (branch local `worktree-agent-…`; o trabalho está em `origin/etapa4/grupo3`).
- **Rodada 3 do #201 · T4** (Opus, 150s): sem bloqueante; 4 observações de teste (asserções de `ultimo_contato_em` vazias em
  grupo2.test.ts:326,346; "nada gravado" conta só atividades :351-362; "não de outro" sem segundo contato :363; sem teste para
  reclassificar lançando, contato do negócio removido, aviso parcial da seleção).
- **Rodada 3 do #201 · S2+S1** (Opus, 420s): sem bloqueante; 2 observações (aviso "lembrete programado" sem condição: lembrete só
  quando a visita está a >24 h e ligado, conversas.ts:684-685 e corpo do PR; doc conversas.md:66-67 afirma `confirmacao` na resposta
  sem a condição de haver contato). Commit, comentários, docs e ajuda gerada batem com o código.
- **Rodada 3 do #201 · L4+L1** (Opus, 75s): sem-achado; 2 observações (`conversa_id` nulo também quando a mensagem foi gravada mas o
  `atualizar` da conversa falhou, crm.ts:658-667; visita só com `negocio_id` sem contato resolvível → 201 sem `confirmacao`).
- Faltam: varredura final (diff acumulado) e Codex no head f268716. Até agora a rodada 3 está SEM BLOQUEANTE → na retomada:
  passe de fechamento + veredito + merge, se a varredura e o Codex não trouxerem bloqueante.
- **Varredura final do #201** (Opus, 180s, diff acumulado 4898559...f268716): SEM bloqueante; 2 observações (`link_whatsapp` de
  `POST /selecoes` sai relativo sem URL pública, nenhuma tela usa o campo, cliente.ts:145 — tirar o campo ou completar no backend;
  chip "Visita hoje/amanhã" em `comum/hoje.ts:69` no fuso do navegador vs texto do cartão no fuso da conta, funil.ts:287).
  Coerência interna conferida (semErro, confirmacao, abordagem_adiada_em, horaLocalNoFuso, ABA_PADRAO, travas, ACOES_FILA, ajuda gerada).
- Falta só o Codex no head f268716 (em execução às 16h11). Rodada 3 = 0 bloqueantes nas 3 lentes + varredura.
  Na retomada: ler o Codex; passe de fechamento (candidatos triviais: `pequeno` em estados.ts:51; tirar `link_whatsapp` da resposta
  e do doc OU completar no backend — escolher 1 desfecho → é decisão, logo dispensar e registrar; "lembrete programado" condicional
  no aviso da tela, conversas.ts:684-685, ≤5 linhas; demais dispensadas com motivo), comentário do passe, veredito, merge.
- **Codex no head f268716 (16h14)**: 2 achados P2, nenhum P1: (1) conversas.ts:685 aviso "lembrete programado" sem condição
  (= observação da S2; lembrete não existe com `lembrete_visita_horas=0`, visita a <24 h ou falha no barramento) — thread 4506878062;
  (2) publico.ts:658 `ultimo_acesso_em` regravado na reentrega do evento (= observação O3 da rodada 1) — thread 4506878064.
  As duas threads ainda SEM resposta minha (responder na retomada). RODADA 3 FECHADA SEM BLOQUEANTE.
