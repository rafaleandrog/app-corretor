# Como o dono decide

Regras curtas tiradas de correções, recusas e edições do dono. Todo papel lê antes de planejar.
Entram por PR, cinco por vez, e o dono pode cortar ou reescrever qualquer uma.

> As linhas abaixo foram **semeadas pela IA na etapa PREPARAR (25/11/2026)** a partir de decisões já
> registradas no `CLAUDE.md`, na spec e no plano, não de uma correção feita à rotina. A coluna "o
> que a rotina entendeu" é uma reconstrução do engano que cada decisão corrigiu. Corte ou reescreva
> à vontade.

| Quando | O dono disse ou fez | O que a rotina entendeu | O que ele queria |
|---|---|---|---|
| 23/10/2026 (spec 1.1, D-86, #43 → #56) | Pediu para "retirar e manter só o essencial": os cinco caminhos de arte do Estúdio viraram um fluxo só | Mais caminhos e mais opções deixam o app mais completo | Menos é mais: uma ação principal por item, nenhuma configuração sem uso na versão corrente; antes de acrescentar tela, botão ou ajuste, ver se cabe numa aba ou menu existente |
| 27/10/2026 (D-93, #89) | Decidiu que o CRECI é dado opcional e nunca bloqueia | Regra legal do corretor podia travar o cadastro e a publicação | Sem CRECI, aviso discreto com atalho para o perfil; nunca erro nem bloqueio |
| 29/10/2026 (D-112) | Decidiu que o negociador humano lê o mandato completo (recuo, alvo e BATNA), só em leitura | Sigilo do mandato valia também para o negociador humano | Decisão de desenho sobre sigilo e permissão volta para ele; a IA não escolhe |
| 08/11/2026 (`CLAUDE.md`, `specs/layout/`) | Tornou `specs/layout/` a referência visual oficial e proibiu apagar ou substituir imagens sem autorização | O mockup ou o código podiam redefinir a tela | Tela nova ou alterada só com PNG e `.layout.json` aprovados antes, e conferência visual no PR |
| 09–12/11/2026 (PRs #225 e #226) | Segurou dois PRs revisados até a conferência visual na instância | PR revisado e com CI verde está pronto para entrar | PR de tela só entra depois da conferência visual da seção 6 de `specs/layout/README.md`, que exige release de pré-visualização por ordem dele |
| Desde 18/10/2026 (`CLAUDE.md`) | Merge só com autorização expressa na conversa; antes de qualquer merge, parar e perguntar | Uma autorização de merge valia para as próximas | Autorização vale para o pedido em que foi dada. Exceção da rotina (25/11/2026): `Autonomia: 2` no prompt da tarefa libera pequenos e médios não sensíveis |
| 25/11/2026 (PREPARAR) | Escolheu o destino nas fases 1 e 2 da spec | O Estado da Arte cobriria todas as fases da spec | Fases 3 a 7 ficam fora por ora; a rotina não propõe passos para elas |
