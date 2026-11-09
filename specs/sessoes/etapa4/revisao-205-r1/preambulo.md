# Preâmbulo comum — lente de revisão do PR #205 (rafaleandrog/app-corretor), rodada 1

- Árvore: /home/user/app-corretor, branch etapa4/grupo5, head 7299500. BASE (merge-base) = 75e14f1df3a814e0a574313f731519fc7a0a3f7c.
  Diff: `git -C /home/user/app-corretor diff 75e14f1df3a814e0a574313f731519fc7a0a3f7c...7299500` ou o arquivo pronto /tmp/claude-0/-home-user-app-corretor/728ca8f2-8a77-5bf2-a00e-7feb0661a04a/scratchpad/rev205/DIFF.patch.
- App: apps/portal_corretor (Portal do Corretor, plataforma UrbiVerso). Regras do repo: /home/user/app-corretor/CLAUDE.md e KIT.md (leia).
- Superfície de contrato: SÓ o SDK instalado, apps/portal_corretor/node_modules/@urbiverso/sdk/docs/ (versão 100.0.0). NÃO leia o repositório do shell nem docs do monorepo. Contrato ausente do bundle já é o achado (classe c).
- Produto: specs/portal_corretor.md (spec 11.x das telas P05, P10, P12, P13, P14, P17; D-133 nova; P-47, P-48), brief do grupo: specs/sessoes/etapa4/brief-grupo5.md. Corpo do PR: /tmp/claude-0/-home-user-app-corretor/728ca8f2-8a77-5bf2-a00e-7feb0661a04a/scratchpad/rev205/corpo-pr.md.
- PROIBIDO: tocar qualquer rota de API de qualquer instância (nem GET); editar arquivo, commitar, propor patch aplicado; rodar build, teste, lint, instalação (nada de pnpm/npm/node/tsc). Só ler: git, grep/rg, sed, cat.
- Escopo: só código que o diff toca (função com pelo menos uma linha num hunk conta inteira). Nada de estilo/preferência.
- Toda afirmação de achado com arquivo:linha conferidos e CITAÇÃO LITERAL (do contrato, da spec ou do código). Não invente: sem material, VEREDITO NAO_EXECUTADA com motivo.
- Bloqueante = quebra real (bug com cenário concreto, vazamento entre contas, violação de contrato do SDK, regra do CLAUDE.md quebrada, dado perdido). O resto é observação.
- Limite rígido 350–450 palavras. Escreva a saída também em /tmp/claude-0/-home-user-app-corretor/728ca8f2-8a77-5bf2-a00e-7feb0661a04a/scratchpad/rev205/<id-da-lente>.md. Formato (texto livre fixo):
  LENTE: <id>  MOTOR: nativo/<modelo>  DURACAO: <s>
  VEREDITO: sem-achado | precisa-atencao | NAO_EXECUTADA
  RESUMO: <uma linha>
  --- por achado:
  ACHADO: <bloqueante|observacao> | <arquivo>:<linha> | <título>
  CITACAO: "<literal>"
  CORPO: <2 a 3 frases: o cenário concreto que quebra>
  (no fim, uma linha: "passou: ..." com o que conferiu e passou)
