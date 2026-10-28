# Plano de implementação — Portal do Corretor

Ordem de trabalho das sessões do Claude Code. Cada bloco cita as seções da spec (`specs/portal_corretor.md`) que o definem. Status: `[ ]` a fazer · `[~]` em andamento · `[x]` pronto (com PR) · `[!]` bloqueado (motivo ao lado).

**Regra:** só começar um bloco quando os anteriores de que ele depende estiverem `[x]`. Só começar uma fase quando o "pronto quando" da anterior estiver cumprido e o dono tiver aprovado.

---

## Fase 1 — MVP interno (spec 15.1)

Telas, funções, permissões, caminhos e automações prontos, testados pela equipe com contas de teste, na instância intermediária. **Sem corretor real.** Estimativa: 10 a 12 sessões.

| # | Bloco | Spec | Depende de | Pronto quando | Status |
|---|---|---|---|---|---|
| 0 | **Verificação e esqueleto da plataforma:** conferir no SDK os itens [plataforma] e `specs/pedidos_ao_shell.md` (itens 1 a 3); definir `shell_min`/`sdk_min`; repositório, build, empacote e instalação vazia na instância intermediária; abrir a issue | 4, 5, 9.0, 9.8, pedidos | — | App vazia instala pelo `.urbiapp.tgz`; relatório dos itens do shell entregue ao dono | [x] código pronto e na `main` (PRs #2 e #13 a #22); a conferência na instância é o roteiro R.8 |
| 1 | **Contas, papéis e isolamento:** roles e `roles_externos`, convite de corretor e de cliente, `perfil_conta`, `perfis_corretor`, `configuracoes_conta`, `itens_cliente`, semente idempotente (2 corretores, 2 clientes), **teste de isolamento automatizado** | 4.4, 4.5, 5, 6.0, 6.1, 6.15, 12.2 | 0 | Teste de isolamento passa; cada papel vê só o que deve | [x] código pronto e na `main` (PRs #2 e #13 a #22); a conferência na instância é o roteiro R.8 |
| 2 | **CRM:** contatos, negócios, etapas configuráveis, linha do tempo, tarefas, agenda, visitas, importação CSV, exportação; tela Clientes | 6.2, 7.1, 7.4, 11.1, 12.1 | 1 | Cadastrar, mover, importar e exportar; telas no computador e no celular | [x] código pronto e na `main` (PRs #2 e #13 a #22); a conferência na instância é o roteiro R.8 |
| 3 | **Imóveis (anúncios) e empreendimentos:** fotos (upload em 2 passos), descrição por IA, qualidade, autorização anexada, visibilidade; tela Imóveis | 6.3, 6.12, 10.6, 11.1 | 1 | Imóvel com fotos em menos de 3 min; qualidade calculada; só públicos aparecem fora | [x] código pronto e na `main` (PRs #2 e #13 a #22); a conferência na instância é o roteiro R.8 |
| 4 | **Funil e números:** quadro, temperatura com motivo, próxima abordagem (playbook semeado), fila do dia, envios rastreados, Início, Desempenho, KPIs | 6.12, 6.15, 10.4, 11.1, 11.2 | 2, 3 | KPIs batem com conferência manual sobre a semente; fila do dia ordenada | [x] código pronto e na `main` (PRs #2 e #13 a #22); a conferência na instância é o roteiro R.8 |
| 5 | **Páginas públicas e Portal do Cliente:** Minha Página (editor por blocos), ficha pública, seleção com reação, formulário por `wh`; Portal do Cliente (role `cliente`) no celular | 6.15, 7.2, 7.3, 11.1, 11.3 | 3, 4 | Visitante envia contato pela página; cliente vê só o que recebeu | [x] código pronto e na `main` (PRs #2 e #13 a #22); a conferência na instância é o roteiro R.8 |
| 6 | **WhatsApp:** conexão (cadastro incorporado hospedado, coexistência), ingresso `wh` por conta e endereço alternativo do número, validação de assinatura, caixa de conversas, envio de imóvel/seleção/arquivo/link, modelos, janela de 24 h | 9.0, 9.1, 9.8, pedidos | 2, 5; pedidos 1 e 2 resolvidos | Conta de teste conecta; mensagem de ida e volta pelo app | [!] fora do 0.1.0 (D-78): P-31 e P-32 não existem no SDK 100 (R.1); entra numa versão seguinte |
| 7 | **Mensageiro:** configuração em 5 passos, permissões por ação, conversa de teste, listener com IA, ações executadas pelo app, passagem ao corretor, custo, modo degradado | 10.3, 10.6, 10.7, 10.8 | 6 | Mensagem de teste às 22 h respondida em segundos, 3 imóveis enviados, visita marcada; passagem no Início | [!] fora do 0.1.0 (D-78): depende do 6 |
| 8 | **Estúdio e Instagram:** marca, pedido em texto ou voz, IA → Canva (fila de renderização, pasta por conta), biblioteca de arquivos, aprovação manual e por janela, **agendar** (`req.eventos.agendar`), **publicar agora**, **baixar arquivos**; conexão do Instagram | 9.2, 9.4, 10.5, 11.1 | 3; Canva da plataforma configurado | Pacote de lançamento publicado numa conta de teste no horário agendado | [x] código pronto e na `main` (PRs #2 e #13 a #22); a conferência na instância é o roteiro R.8 |
| 9 | **Assistente do Corretor:** chat em todas as telas com base nos `docs/` da app, ajuda a decidir, ações com confirmação (lembretes, tarefas, agendamento de posts) | 10.2, 11.1 | 2–8 | Responde as 30 perguntas do roteiro; ação só com confirmação | [x] código pronto e na `main` (PRs #2 e #13 a #22); a conferência na instância é o roteiro R.8 |
| 10 | **Fechamento do MVP:** roteiros de 15.1 executados e registrados; ajustes; docs da app completos | 15.1, 18 | 0–9 | Os 7 critérios de 15.1 cumpridos; dono aprova o MVP interno | [~] código pronto e na `main` (PRs #23, #24, #26 a #29, #36 e #37): versão 0.1.4 com admin de todos os papéis, seletor de conta, escopo da conta ativa e tokens de tema; falta executar o R.8 e o R.10 na instância depois do release |

**Em paralelo, fora do código (dono):** decidir o caminho do registro na Meta (P-26) e, se for o A, iniciar verificação da empresa e revisão do app; termos de uso e política de privacidade; treinamento curto e comunidade de corretores para a fase 2 (saiu da spec em 23/10: não é funcionalidade do app).

---

## Fase 1.5 — Simplificação e estado da arte (spec 1.1, 23/10/2026)

Aprovada pelo dono em 23/10. Fonte: spec 2.6 (princípios 13 e 14), 2.7, 5.1, 11, 15.8, 15.9 e D-80 a D-88; `specs/referencias_principais.md`. Guarda-chuva: **#49**. Um PR por bloco, nesta ordem; 0 e 1 podem andar em paralelo, 5 e 7 também, depois do 1. Regras comuns no corpo de #49.

| # | Bloco | Issue | Depende de | Pronto quando | Status |
|---|---|---|---|---|---|
| 0 | **Fundação visual:** chip, cartão de imóvel, filtro na URL e menu "mais" em `frontend/apoio.ts` | #50 | — | Telas atuais usam os helpers sem mudar comportamento | [x] código pronto e na `main` (PR #66; helpers em `frontend/visual.ts`, reexportados por `apoio.ts`) |
| 1 | **Menu de oito itens e Ajustes numa tela só** (abas Conta · Marca · Conexões · Funil e abordagens · Atendimento); rotas antigas como apelidos | #51 | — | Menu com 8 itens; retorno do Instagram em `/ajustes/conexoes` segue vivo | [x] código pronto neste PR (#67) |
| 2 | **Início:** fila do dia com uma ação por item e aba Agenda; sai a grade de atalhos | #52 | 0, 1 | Nenhum item com dois botões; Agenda só busca quando aberta | [x] código pronto neste PR (Início com abas Hoje · Agenda, `/agenda` apelido) |
| 3 | **Clientes:** visões Lista · Quadro (o Funil entra aqui) e filtros prontos | #53 | 0, 1 | `/funil` abre o Quadro; chips filtram com teste | [x] código pronto neste PR (Lista · Quadro em `urbi-abas`, filtros prontos, `/funil` apelido) |
| 4 | **Ficha do contato:** resumo em uma frase, Resumir com IA, Mensagem sugerida com Fazer agora (`wa.me`), Virar tarefa; slot `funil` | #54 | 0, 3 | Com e sem IA funciona; privacidade e isolamento testados | [x] código pronto neste PR (rotas em `backend/ficha.ts`; slot `funil` declarado, admin autoriza a base `barato`) |
| 5 | **Estúdio sem aprovação por janela (release A):** migração 001 e código deixa de ler o modo | #55 | 1 | Migração idempotente; nada de `janela` fora do schema | [x] código pronto neste PR (release A; release B em #62) |
| 6 | **Estúdio:** um caminho de arte, "Fazer em outra ferramenta", uma ação por estado | #56 | 0, 5 | Nenhum cartão com mais de um botão principal | [x] código pronto neste PR (#56) |
| 7 | **Marca única** em Ajustes › Marca para Estúdio, Minha página, seleção e portal | #57 | 1 | Mudar a cor muda as quatro superfícies | [x] código pronto neste PR (preenchimento da cor no início da app, versão 0.1.6) |
| 8 | **Imóveis:** abas Carteira · Empreendimentos, grade de cartões, "o que falta" no topo | #58 | 0, 1 | Cartões no computador e no celular | [x] código pronto neste PR (Carteira · Empreendimentos em `urbi-abas`, `/empreendimentos` apelido, carteira em `urbi-grid` de `cartaoImovel`, ficha com "o que falta" no topo) |
| 9 | **Portal e seleção** no modelo Compass One: próximo passo, datas-chave, foto dominante, "o que falta de você" | #59 | 0, 7 | Portal no celular sem dado pessoal; tarefa do cliente fecha pelo webhook | [x] código no PR do bloco 9 (aguarda revisão); conferência visual no celular pelo dono |
| 10 | **Desempenho enxuto:** quatro números acima da dobra | #60 | 1 | Conferência manual da demonstração bate | [x] |
| 11 | **Importar:** modelos de outros CRMs (fase 2 da spec) | #61 | — | Cabeçalho de cada modelo mapeia certo | [x] mecanismo e planilha simples; Kenlo, Jetimob e Imobzi esperam exportação real |
| 12 | **Estúdio sem aprovação por janela (release B):** schema | #62 | 5 e um release no meio | Instala e atualiza sem reprovação | [ ] |

**Issues antigas:** #43 com a direção nova; #44 e #45 fechadas em favor de #56; #46 não planejada; #47 e #48 adiadas para depois da fase 2; #8 e #9 com os itens das referências (Conversas no padrão da Lais, origem do anúncio, créditos). Bugs #38 a #41 e processo #30, #33 a #35 entram antes da fase 2.

**O que saiu e por quê:** spec 15.9. **Pedidos ao shell novos:** itens 7 (cartão com capa) e 8 (aba na URL) de `specs/pedidos_ao_shell.md`.

---

## Fase 1.6 — Padrão B, Negociador e CRECI opcional (spec 1.2, 27/10/2026)

Plano aprovado pelo dono em 27/10. Fonte: spec 1.2 — 2.8, 5.1, 6.16, 7.1, 10.9, 11 (Padrão B), 13, 14, 15.1 (critérios 8 e 9), D-93 a D-109, P-40 a P-42; guia `specs/telas_padrao_b.md` e mockups `specs/telas/`. Insumo do dono: branch `claude/bold-clarke-8afn50`, pasta `specs/entrada_27-10/` (fica fora da `main`). Guarda-chuva: **#87**. Um PR por item; regras comuns no corpo de #87 (código, testes e docs juntos; isolamento A × B em toda rota nova; `versao` sobe com schema, rota ou pisos; `Closes #<n>`; status e linha no registro). Pisos não mudam (SDK 100.0.0, shell 0.56.37).

| Item | O que é | Issue | Depende de | Status |
|---|---|---|---|---|
| A1 | **Spec 1.2:** fundir o insumo de 27/10 na `main`, D-93/D-94, renumeração, guia e mockups, pedidos ao shell 10–13, plano | #88 | — | [x] PR aberto (só texto); aguarda revisão |
| C1 | **CRECI opcional (D-93):** sem bloqueio nem `CRECI_AUSENTE`, aviso discreto com atalho para o perfil, sem estado de verificação | #89 | A1 | [x] PR aberto (0.1.11); aguarda revisão |
| B1 | **Moldura do Padrão B:** `urbi-3-colunas` + `urbi-trilho-atalhos` (+ `urbi-inbox`), Criar no cabeçalho e Assistente no trilho, menu com os nomes do Padrão B e apelidos (D-103), estados de 11.0.4 | #90 | A1 | [x] PR aberto (moldura em Números; 0.1.12); aguarda revisão |
| B2 | **Hoje** (P01, M1) na moldura | #91 | B1, C1 | [x] PR aberto (0.1.15) |
| B3 | **Clientes — Lista e ficha** (P04): ficha D-92 no centro e na direita (D-106) | #92 | B1, C1 | [x] PR aberto (0.1.17) |
| B4 | **Clientes — Funil e Importar** (P03, P14) | #93 | B3 | [ ] |
| B5 | **Imóveis** (P06, P07, M3): carteira em lista com miniatura (D-106) | #94 | B1, C1 | [ ] |
| B6 | **Estúdio** (P08) na moldura, D-89 a D-91 (D-105) | #95 | B1, C1 | [ ] |
| B7 | **Página e Números** (P09, P10) | #96 | B1, C1 | [ ] |
| B8 | **Ajustes** (P12, P13 e menu de Ajustes) | #97 | B1, C1 | [ ] |
| B9 | **Portal do Cliente e página pública** (M4, M5, M6) por token (D-104) | #98 | A1 (roteiro de #87: páginas públicas têm CSS próprio) | [x] PR aberto; aguarda revisão |
| B10 | **Busca global e atalhos** (11.7) | #99 | B1 | [ ] |
| D1 | **Dados da negociação** (6.16): tabelas, eventos, semente idempotente do Apêndice D | #100 | A1 | [x] PR aberto (0.1.13); aguarda revisão |
| D2 | **Motor do Negociador** (10.9): slot `negociador`, validações de 10.9.7, sugestão, rotas de 7.1 | #101 | D1 | [x] PR aberto (0.1.16); aguarda revisão |
| D3 | **Telas P15, P16 e M8** (faixa ZOPA como exceção nomeada) | #102 | D2, B3 | [ ] |
| D4 | **Ajustes › Negociador** (P17) | #103 | D2, B8 | [ ] |
| D5 | **Propostas no portal** (M5b) por `wh` com token | #104 | D2, B9 | [ ] |
| D6 | **Relatório Negociação** (P10, KPIs de 11.2) | #105 | D3, B7 | [ ] |
| D7 | **Negociador humano** (role `negociador`, 11.6; política multi-usuário, D-108; convite sem CRECI, D-94) | #106 | D3 | [ ] |
| E1 | **Semente de demonstração** com negociações | #107 | D1 | [ ] |
| E2 | **Fechamento do arco:** critérios 8 e 9 de 15.1 (R.8), docs da app, versão | #108 | todos | [ ] |

```
A1 ──┬─ C1 ─┬─ B2 ║ B3 ║ B5 ║ B6 ║ B7 ║ B8 ║ B9   (depois de B1 e C1)
     ├─ B1 ─┘     B3 ─ B4
     └─ D1 ─ D2 ─┬─ D3 (depois de B3) ─ D6 (depois de B7)
                 ├─ D4 (depois de B8)
                 ├─ D5 (depois de B9)
                 └─ D7 (depois de D3)
E1 depois de D1 · B10 depois de B1 · E2 por último
```

**Fora deste arco (decisão 7 da coordenação, em #87):** as dívidas abertas #32, #38, #39, #40, #62, #68, #69, #73 e #80; P02 Conversas e P11 Mensageiro de verdade (#8 e #9, presos a P-31/P-32); a decisão do proprietário pelo portal (fase 3). **Pedidos ao shell novos:** itens 10 a 13 (gaveta, barra de progresso, seletor segmentado, faixa ZOPA).

---

## Fase 2 — Validação com corretores reais (spec 15.2)

| # | Bloco | Pronto quando | Status |
|---|---|---|---|
| 2.1 | Pré-requisitos: registro na Meta com acesso avançado; termos e consentimentos publicados; suporte definido | Conexão de conta real funciona | [ ] |
| 2.2 | Piloto: 3 a 5 corretores por 4 semanas; acompanhamento semanal | Critérios de "MVP validado" (15.2) | [ ] |
| 2.3 | Ajustes de tela, texto, IA e automação vindos do piloto | Dono declara o MVP validado | [ ] |

## Fase 3 — Relacionamento completo e proprietário (spec 15.3)

Blocos: Portal do Cliente para proprietário (entregas, metas do imóvel, visitas com retorno revisado, propostas, comissão combinada); relatório semanal; propostas com versões e vínculo opcional ao módulo `pessoas`; Mensageiro com áudio recebido transcrito, follow-up, reativação e simulação de financiamento; agente do proprietário; Estúdio com vídeo, edição de foto e mobília virtual rotulada, calendário sugerido; "editar no Canva" na conta do corretor; atribuição de conteúdo a visita.

## Fase 4 — Equipe, metas e comissões (spec 15.4)

Blocos: imobiliária com vários corretores e gestor (inclui P-35); fila compartilhada e reatribuição; metas com ritmo; comissões com divisões e recebimentos; Facebook, Instagram Direct e Messenger na caixa; painel do gestor; planos e cobrança.

## Fase 5 — Rede e incorporadoras (spec 15.5)

Blocos: conexões, grupos e perfil público; compartilhamento de imóvel e de necessidade de comprador; match; parcerias com termo, divisão e ciência do titular; proteção de cliente; módulo Incorporadora sobre o módulo `imobiliario` (vitrine, tabela versionada, espelho, credenciamento, reservas com fila, lista de espera, exceções, comissão visível).

## Fase 6 — Expansão de canais (spec 15.6)

Blocos: TikTok, YouTube Shorts, LinkedIn, Google; portais (feed e leads); assinatura eletrônica; agenda externa; domínio próprio e incorporação da Minha Página em site; blog e SEO; Portal do Comprador pós-venda.

## Fase 7 — Futuro (spec 15.7)

Agente de voz que liga; anúncios pagos; adiantamento de comissão e crédito; rede entre instalações e SGR do COFECI; leitura do núcleo UP/Urbitá; app nativo se necessário.

---

## Registro de sessões

| Data | Bloco | O que foi feito | PR | Próximo passo |
|---|---|---|---|---|
| 28/10/2026 | Fase 1.6 · B3 | Clientes na moldura do Padrão B (P04, D-106): lista à esquerda (Importar, Novo, Exportar; visões Lista · Funil; busca, filtros prontos, papel, temperatura e origem), ficha do cliente escolhido no centro (cabeçalho com Conversa e Resumir; abas Resumo · Linha do tempo · Enviados · Negócios em `?secao=`) e, à direita, perfil de busca, portal do cliente (gerar, reenviar, revogar, pendências) e privacidade; `?item=` guarda o cliente; `/clientes/:id` vira apelido de `/clientes?item=:id`; Funil recolhe a direita; ficha como estado compartilhado entre as duas colunas; testes em Node e no Chromium (isolamento A × B pela URL); docs e ajuda; 0.1.17 | PR de #92 | Revisão do PR; depois B4 (Funil e Importar) |
| 28/10/2026 | Fase 1.6 · D2 | Motor do Negociador IA (0.1.16): slot `negociador` (base `poder`); `comum/negociador.ts` puro (prompt em 2 partes do Apêndice C, contexto com sigilo marcado, `SCHEMA_RESPOSTA`, `validarMovimento` com as 7 garantias de 10.9.7, sigilo por valor ±1% em dígitos, mil, milhão e por extenso, `exigePassagem` de 10.9.5, ZOPA); rotas `/negociacoes/:id/sugestao`, `/decisao` (aprovar, editar com revalidação, descartar, aceitar acordo só do corretor), `/assumir`, `/devolver`, `/negociador/teste` e `/negociador/ia`; faz sozinho só no portal; objeções gravadas; 6 eventos novos; as 7 conversas-roteiro com IA simulada que tenta furar. Sem tela (D3/D4) | PR de #101 | Revisão do PR; depois D3 (espera B4) e E1 |
| 28/10/2026 | Fase 1.6 · D1 | Dados da negociação (0.1.13): 8 tabelas de 6.16, rotas `/negociacoes` (lista, detalhe, PATCH/encerrar), `/negociacoes/:id/mandato` (versões; recuo ≤ alvo ≤ pedido; faz sozinho com autorização), `/negociacoes/:id/propostas` (só `canal: registro`; rodada calculada), `/negociador/config` e `/negociador/objecoes`; `semSigilo()` única; 6 eventos só com ids; semente do Apêndice D em `aoIniciar` em toda conta; adendo O4/O5/O6/O12 na spec; `docs/negociacao.md`. Sem tela (D3/D4) | PR de #100 | Revisão do PR; depois D2 e E1 |
| 28/10/2026 | Fase 1.6 · B1 | Moldura do Padrão B (`frontend/moldura.ts`): `urbi-inbox` com o trilho (`urbi-trilho-atalhos`: os itens do menu, porque o externo não abre o menu da app, e o Assistente) e `urbi-3-colunas` (lista, foco, contexto) ou `urbi-2x1`; Números migrada como prova do encaixe; Criar (`urbi-dropdown`) no cabeçalho de toda tela do corretor; Assistente na coluna de contexto (D-109), `/assistente` abre Hoje com ele; `?item=`; os 7 estados de 11.0.4 (`frontend/estados.ts`) e `GET /assistente/ia`; menu com os nomes do Padrão B e apelidos em `frontend/enderecos.ts`; teste no Chromium da estrutura; versão 0.1.12 (a 0.1.11 foi do C1) | (este PR) | Revisão; depois B2 a B10 migram as demais telas |
| 28/10/2026 | Fase 1.6 · C1 | CRECI opcional (D-93): perfil salva CRECI fora do formato usual com aviso (erro só acima de 20 caracteres; `formato` saiu da coluna `creci`); selo de verificação fora da tela e `creci_situacao` inerte; legenda leva o CRECI só se couber nos 2.200 (senão aviso, nunca `CHECAGEM_PENDENTE`), na aprovação e na publicação; nota de qualidade sem os 10 pontos do CRECI (fotos 30, descrição 20); primeiros passos sem CRECI; `avisoCreci()` em `frontend/visual.ts` no Início, na peça do Estúdio, no editor da página e em "o que falta" da ficha; `testes/creci.test.ts`; docs e ajuda; versão 0.1.11 | PR de #89 | Revisão do PR; depois B2, B3, B5–B8 (com B1) |
| 27/10/2026 | Fase 1.6 · A1 | Spec 1.2: insumo de 27/10 (Padrão B, Negociador) fundido na `main` com D-01 a D-92 mantidas; decisões do insumo renumeradas para D-95 a D-102, D-93 (CRECI opcional), D-94 (Negociador sem CRECI) e D-103 a D-109 (coordenação); P-40 encerrada, P-41 e P-42 novas, P-37 do insumo fechada por SSE; 6.16, 10.9, 11 (Padrão B, P01–P17, M1–M8, 11.5–11.9), Apêndices C e D; `specs/telas_padrao_b.md` com nota de divergências e `specs/telas/`; pedidos ao shell 10–13; stack funcional 1.6; `CLAUDE.md`; Fase 1.6 e critérios 8 e 9 no R.8. Só texto, nenhum arquivo em `apps/` | #109 | Revisão do PR; depois C1, B1 e D1 |
| 27/10/2026 | Pós-1.5 · Ficha (duas colunas) | Ficha do contato simplificada (D-92), no desenho do Follow Up Boss: `urbi-2x1 largura="largo"` com o cliente (chips, motivo e último contato, WhatsApp/Ligar/E-mail, cadastro e consentimento no detalhe), Próximo passo (abordagem com Atrasada, passo combinado, Mensagem sugerida, Virar tarefa), Negócios, Agenda (pendentes à mostra, passadas no detalhe) e Seleções e portal à esquerda; Histórico (Registrar contato, Registrar envio, Resumir) e Enviados ao cliente à direita; "Nova seleção" vira o + da cabeça do cartão; Editar no menu Mais. Só frontend e docs, sem mudança de rota nem versão | (este PR) | Revisão do PR e conferência na instância |
| 28/10/2026 | Fase 1.6 · B9 | Portal do Cliente no formato M4/M5 ("Meu atendimento", próximo passo com [Ver], abas Conversa · Imóveis n · Agenda n · Arquivos n; destaque com galeria, chip de visita e Gostei · Não gostei · Quero visitar · Comentar pelo `reacao_selecao`; outros imóveis com a reação; "O que falta de você"); estado "Link expirado" no portal e na seleção; Minha Página M6 (capa com foto da marca ou iniciais, CRECI só se houver, "Imóveis em destaque" com Quero saber mais pelo WhatsApp). Regras puras em `comum/portal-cliente.ts`; foto do corretor na vitrine da página como arquivo e URL assinada na rota; versão 0.1.14. Arquivos sem fonte (D-73) e Conversa sem histórico de mensagens registrados como lacuna | (este PR) | Revisão do PR; depois D5 (espera D2) |
| 28/10/2026 | Fase 1.6 · B2 | Hoje (P01, M1) na moldura: esquerda com o dia e o estado do Mensageiro, **Precisa de você** (negociações `aguardando_corretor` e quentes sem resposta, com **Abrir**) e **Primeiros passos** x de 5 com `urbi-bolinhas` (nome da conta, telefone, Instagram, primeiro imóvel, Página publicada; sem CRECI, que fica no aviso de D-93); centro com a fila do dia em cartões de ação na ordem de `filaDoDia` (um principal e no máximo um no "Mais", `comum/hoje.ts`) e "Mais N para depois"; direita com a agenda de hoje ("Ver agenda" abre os 14 dias), Sua semana (4 números) e a Dica do Assistente; estados vazio e IA indisponível pelo helper do B1. `GET /inicio` ganha `passagens` (por `semSigilo`), `agenda_hoje`, `primeiros_passos` e `sem_creci`; `testes/hoje.test.ts`; versão 0.1.15 | PR de #91 | Revisão do PR; o **Assumir** da passagem espera o D2/D3 |
| 26/10/2026 | Pós-1.5 · Portal (roteiro de visitas) | Portal do Cliente no modelo "tour" da referência: visitas por dia, dia com várias vira roteiro numerado com "Ver o roteiro no mapa"; "Como chegar" por visita (endereço só se publicado; só bairro vira "Ver o bairro no mapa"; região, sem mapa); próxima visita com "hoje / amanhã / em N dias". Só frontend público, `comum/roteiro.ts` com testes | — | Revisão do PR |
| 26/10/2026 | Pós-1.5 · Ficha (objetivos da mensagem) | Mensagem sugerida com objetivos de um toque (referência Follow Up Boss): Pelo playbook, Apresentação, Retorno, Ainda procurando? e Manter contato; `GET /contatos/:id/mensagem-sugerida?objetivo=` cumpre o objetivo com a IA (slot `funil`, mesmo contexto mascarado) ou devolve o modelo do objetivo, inclusive sem negócio aberto; `comum/mensagens.ts` | — | Portal: roteiro de visitas e "Como chegar" |
| 26/10/2026 | Pós-1.5 · Desempenho (visual Lais) | Conversão no visual da referência Lais, mantendo os quatro números no topo: cartão Conversão com as etapas em contagem (fatia dos leads, comparação) e gráfico de colunas contra o período anterior, taxas no detalhe, clientes únicos; Leads por canal (pizza) e Situação por canal (colunas empilhadas, tabela no detalhe); Leads ao longo do período (linha); motivos de perda em colunas; Início com "Em atendimento" na faixa da semana. `/numeros` ganha `etapas`, `clientes_unicos`, `por_origem[].abertos/perdidos` e `serie_leads` (aditivo). Só primitivos `urbi-kpi`/`urbi-grafico-*` | #83 | Revisão do PR |
| 26/10/2026 | 1.5 · 6 (ajuste) | Estúdio pelo Canva (D-89): peça nasce com textos e instrução à vista (Copiar instrução, Abrir o Canva, fotos e logo para baixar) e o envio da arte na peça, com área de arrastar; gerador do app e "Refazer arte" saem (`frontend/estudio/motor.ts` apagado); "Usar outra ferramenta" troca a instrução; CRECI vira aviso (`checarPeca.avisos`) na aprovação e na publicação, story do Canva publica pela API; versão 0.1.9 | — | QA na instância |
| 26/10/2026 | 1.5 · 9 | Portal e seleção no modelo Compass One (#59): `contatos.proximo_passo_cliente` editado em Definir próximo passo e publicado na vitrine só quando preenchido (o `proximo_passo` interno nunca sai); tabela `tarefas_cliente` (segregada, restrita, soft delete) com rotas `GET/POST /contatos/:id/tarefas-cliente` e `PATCH /tarefas-cliente/:id/remover`, botão Pedir ao cliente na ficha; webhook `acao_cliente` com `tipo: tarefa_feita` e campo `tarefa` (mesmo token e limite por IP), listener grava `feita_em`, linha do tempo e ressincroniza o portal; portal com próximo passo no topo, datas-chave (próxima visita, validade da seleção), "O que falta de você", jornada em eventos (linha do tempo vertical); cartões de foto dominante com ícones de quartos, área e vagas na seleção, no portal, na página e na ficha pública; teste `portal-compass.test.ts`; versão 0.1.8 | (este PR) | Revisão do PR; a versão 0.1.8 já está resolvida: o bloco 6 (#56) entrou na main em 0.1.7 |
| 26/10/2026 | 1.5 · 6 | Estúdio com um caminho de arte (D-86): "Canva IA" vira **Fazer em outra ferramenta** (Canva, Claude Design ou outra), que muda só o texto da instrução (`promptFerramenta` em `comum/estudio.ts`; rota `GET /estudio/pecas/:id/instrucao?ferramenta=&referencias=` no lugar de `/canva`), sem ZIP; referências do corretor como `marca_arquivos.tipo = referencia` (até 6, Ajustes › Marca, escolhidas na peça, por link assinado, só da conta de escrita; `unicos` de `marca_arquivos` vira parcial: um logo e uma foto por conta, referência soma; `PATCH /estudio/marca/arquivos/:id/remover`); `pecas.motor` sem migração, rótulo "outra ferramenta"; cartão da peça com uma ação principal por estado e o resto no Mais (`acoesComMais`); Publicar pergunta agora/agendar/baixar; "Rejeitar" vira "Voltar a rascunho" (rota igual); pedido pelo `urbi-redator` com microfone (sai o Web Speech); testes em `estudio.test.ts`; versão 0.1.7 | (este PR) | Revisão do PR; o #59 também vai a 0.1.7: quem mergear por último sobe para 0.1.8 |
>| 26/10/2026 | 1.5 · 8 | Imóveis numa tela com `urbi-abas` Carteira · Empreendimentos (aba em `?aba=`, `ABAS_IMOVEIS`/`APELIDOS_IMOVEIS` em `comum/imoveis.ts`); `/empreendimentos` apelido da aba (também no Assistente: "Imóveis › Empreendimentos"); link do pé do Início removido; Carteira em `urbi-grid` de `cartaoImovel` (exceção D-65 até o pedido ao shell 7) com estado vazio "Cadastre o primeiro imóvel"; ficha com "o que falta" no topo (`secaoDaFalta` leva cada pendência ao formulário ou cartão certo), Publicar/Tirar da página como ação principal e o resto em "Mais", cartões com resumo e lista no slot `detalhe` (fotos à mostra sem foto); formulário já não expunha campos de fase 5; 3 testes novos | (este PR) | Revisão do PR; blocos 4, 6, 7, 9 |
| 26/10/2026 | 1.5 · 7 | Marca única (D-85): a cor da página pública, da seleção e do portal vem de `marca_conta.cor_primaria` (`marcaPublica` em `backend/portal.ts`, lida sempre com o filtro da conta); a foto do corretor (`marca_arquivos`) entra no topo da seleção e do portal, como URL assinada na rota pública; salvar a marca ou a foto republica a página no ar e as seleções e portais da vitrine (`ressincronizarMarca`); `tema` sai de `validarPagina` e da tela da página (coluna fica no schema); preenchimento no início da app (`levarTemaParaMarca` em `backend/semente.ts`) leva a cor do tema para a marca de quem não tinha marca, sem migração; aviso `vitrine_desatualizada` ao salvar e botão "Atualizar o que está no ar" (`POST /estudio/marca/republicar`); leituras da marca presas à conta de escrita (quem atende várias contas); testes `marca.test.ts` e `conta.test.ts`; versão 0.1.6 | (este PR) | Revisão do PR; #59 (portal no modelo Compass One) depende deste |
| 26/10/2026 | 1.5 · 4 | Ficha do contato: topo com chips (temperatura com motivo, papel, origem) e o resumo em uma frase (temperatura, próxima abordagem com canal e prazo, último contato); **Resumir** (`POST /contatos/:id/resumo`, slot `assistente`, até três frases, não gravado) só com o slot liberado (sonda `GET /contatos/:id/ia`); **Mensagem sugerida** (`GET /contatos/:id/mensagem-sugerida`, slot novo `funil` base `barato`, sem IA o texto do playbook) com **Fazer agora** (`wa.me` no clique, registro por `/abordagens/:contato/feita` com `canal`, uma linha na linha do tempo; sem telefone, copia); **Virar tarefa** (`tarefaDaAbordagem` em `comum/funil.ts` → `POST /atividades`); seções secundárias no `detalhe` do `urbi-card` (consentimento numa linha em Dados); papéis na edição só comprador e proprietário; teste `testes/ficha.test.ts`; versão mantida em 0.1.6 | (este PR) | Revisão do PR; o Início (#52) usa o mesmo Fazer agora |
| 26/10/2026 | 1.5 · 2 | Início com a faixa da semana sobre `urbi-abas` Hoje · Agenda (aba em `?aba=`); Hoje é a fila de `GET /inicio` agrupada por motivo, cada item com nome, chip de temperatura, motivo e um botão (Fazer agora abre a ficha; Fiz e Visita feita no "Mais"); Agenda monta `pc-tela-agenda` só quando ativa, com um botão por atividade; `/agenda` é apelido de Início › Agenda (também no Assistente); lembrete de visita (manifesto e `notificar`) abre `?aba=agenda`; sai a grade de atalhos (fica só o link de Empreendimentos até #58); `GET /inicio` intacto; teste `testes/inicio.test.ts`. Sem mudança de schema nem versão | (este PR) | Revisão do PR; Fazer agora com `wa.me` na #54 |
| 26/10/2026 | 1.5 · 5 | Sem aprovação por janela, release A (D-86): primeira migração do app, `migracoes/001_sem_aprovacao_por_janela.js` (peça agendada sem aprovação volta a rascunho e o agendamento é cancelado; conta em `janela` vira `manual`; idempotente); agendar só peça aprovada; o listener não aprova nada; o ajuste sai de Ajustes › Atendimento e o botão "Agendar (aprova na hora)" sai do Estúdio; Assistente só propõe agendar peça aprovada; `schema.json` intacto (opção e colunas saem na #62); teste da migração; versão 0.1.6 | (este PR) | Release B (#62) num release seguinte; merge só com ordem do dono |
| 26/10/2026 | 1.5 · 10 | Desempenho enxuto: quatro `urbi-kpi` no topo (leads, conversão total, vendas, comissão prevista) com a comparação ao período anterior em texto pequeno; funil da coorte em lista; Resultados com VGV, ciclo, visitas e captações; período lido de `?dias=` por `filtrosDaUrl`; origem pelos rótulos de `visual.ts`. Sem mudança de fórmula | — | Revisão do PR |
| 26/10/2026 | 1.5 · 3 | Clientes com visões Lista · Quadro (`urbi-abas formato-desktop="botoes"`, `?visao=quadro`); `telas/funil.ts` virou `telas/clientes-quadro.ts` e `/funil` é apelido do Quadro (também no Assistente); filtros prontos Novos · Sem contato (N de Ajustes › Atendimento) · Quentes · Retorno vencido em `urbi-chips-atalho`; `GET /contatos` com `criado_em[gte]`, `proximo_passo_em[lt]` e `origem`; "parado" com as mesmas opções (3/7/15/30/90) e a mesma leitura na lista e no quadro (`comum/crm.ts`); papéis na tela só comprador e proprietário; `abaDaUrl`/`abaNaUrl` com chave, apelidos e rota canônica (parte de #69); servidor de teste com o `query parser` do shell | (este PR) | Revisão do PR; bloco 4 |
| 26/10/2026 | 1.5 · 1 | Menu do corretor com oito itens (D-81); Ajustes numa tela só com `urbi-abas` (Conta · Marca · Conexões · Funil e abordagens · Atendimento, aba em `?aba=`); `/conta` e `/ajustes/*` viram apelidos (retorno do Instagram em `/ajustes/conexoes` intacto); marca sai do Estúdio para Ajustes › Marca; prazo de primeiro atendimento sai da tela (fica no dado); Assistente com as telas novas; atalho de Empreendimentos no Início até #58 | (este PR) | Blocos seguintes da fase 1.5 (#52 em diante); merge só com ordem do dono |
| 26/10/2026 | 11 | Importar: passo "De onde vem a planilha?" com modelos em `comum/csv.ts` (`MODELOS_IMPORTACAO`, `mapearPorModelo`); modelo "planilha simples"; aviso do teto de 100 kB do envio na tela; Kenlo, Jetimob e Imobzi fora (sem cabeçalho confirmado em doc pública nem arquivo de exemplo); 1 teste novo | — | Revisão do PR; exemplos reais de exportação dos três CRMs com o dono |
| 26/10/2026 | 1.5 · 0 | Fundação visual: `chip` (temperatura, papel, origem, etapa), `cartaoImovel` (D-65), `filtrosNaUrl`/`filtrosDaUrl`/`abaDaUrl`/`abaNaUrl` e `acoesComMais` em `frontend/visual.ts`, reexportados por `apoio.ts`; Clientes, Ficha do contato, Funil, Imóveis, Desempenho, Conexões e Abordagens sem `replaceState` nem mapa de temperatura próprios; teste `testes/visual.test.ts`. Sem mudança visível | #66 | Bloco 1 (#51) |
| 23/10/2026 | Fase 1.5 | Plano de simplificação aprovado pelo dono: spec 1.1 (2.6, 2.7, 5.1, 11, 15.8, 15.9, D-80 a D-88), `specs/referencias_principais.md` e `specs/horizonte.md` novos, `CLAUDE.md` e pedidos ao shell 7 e 8; issues #49 (guarda-chuva) e #50 a #62; #44–#46 fechadas, #47–#48 adiadas, #8 e #43 atualizadas | — | Blocos 0 e 1 (#50, #51) em sessões novas; merge só com ordem do dono |
| 18/10/2026 | Preparação | Repositório criado com o kit 100.3.16, specs e CLAUDE.md; revisão de viabilidade contra o SDK 100 aprovada (R.1–R.5); decisões D-55 a D-60 | — | Bloco 0 |
| 18/10/2026 | 0 | Esqueleto `apps/portal_corretor` 0.1.0: manifesto (identidade, pisos 100/0.56.37), rota `/status`, tela inicial, página pública e linha de diagnóstico, testes (manifesto e rotas), `docs/README.md`; empacotador limpo | #2 | Dono instala e confere R.6; depois bloco 1 |
| 19/10/2026 | 1 | Contas e papéis: manifesto com `roles` (`operacao`), `roles_externos` (`corretor`), `provisiona_externos`; tabelas da conta; telas Início, Conta e marca, Corretores; testes de isolamento com banco simulado; revisão em 2 rodadas | #13 | Roteiro R.6/R.7 na instância; bloco 2 |
| 19/10/2026 | 2 | CRM: tabelas `origens`, `contatos`, `consentimentos`, `etapas_funil`, `negocios`, `atividades`, `linha_do_tempo`; rotas de contatos, negócios, atividades e funil; importação e exportação CSV; telas Clientes, ficha, Agenda, Ajustes › Funil; 13 testes novos (isolamento do CRM incluso; 42 no total); versão 0.3.0 | #14 | Revisão do PR; bloco 3 |
| 19/10/2026 | 3 | Imóveis: tabelas `imoveis`, `imovel_midias`, `autorizacoes_venda`, `empreendimentos`, `empreendimento_materiais`, `visitas` e `negocios.imovel_id`; slots de IA `conteudo` e `fotos`; telas Minha carteira, ficha do imóvel, Empreendimentos e ficha; visita e retorno na ficha do cliente; 10 testes novos (52 no total); versão 0.4.0 | #15 | Revisão do PR; bloco 4 |
| 19/10/2026 | 4a | Funil: `classificacoes`, `playbook_funil`, `etapas_funil.marco`, temperatura com motivo em `contatos`; rotas de quadro, playbook, abordagens e Início; rotina `reclassificar_contatos`; telas Funil, Início (fila do dia), abordagem na ficha e playbook em Ajustes; 7 testes novos (59 no total); versão 0.5.0 | #16 | Revisão do PR; bloco 4b |
| 19/10/2026 | 4b | Números: `envios`, `negocios.marco_max`, `perfil_conta.demo`; rotas de números, envios e demonstração; telas Desempenho, faixa da semana no Início, envios nas fichas; 5 testes novos (64 no total), com os KPIs da demonstração conferidos; versão 0.6.0 | #17 | Revisado sem bloqueantes (2 rodadas); bloco 5 |
| 19/10/2026 | 5a | Minha Página, ficha pública, formulário e link: `paginas_corretor` e `vitrine_publica` (única tabela não segregada, D-55); rotas públicas `/vitrine/*`; webhooks `formulario_lead` e `clique_link` (campos pessoais com `descartar`); eventos segregados `lead_recebido` e `link_clicado` com listeners por `comConta`; telas Minha página, página pública e link; 8 testes novos (72 no total); versão 0.7.0; decisões D-69 a D-72 (primeiro release 0.1.0) | #18 | Revisão do PR; bloco 5b |
| 19/10/2026 | 5b | Seleções e Portal do Cliente: `selecoes`, `selecao_itens`, `acessos_cliente`; rotas públicas `/vitrine/selecao` e `/vitrine/portal` pelo token do ingresso (`inspecionarIngressoWh`); webhooks `reacao_selecao` e `acao_cliente`; eventos segregados `reacao_recebida` e `acao_cliente_recebida` com listeners por `comConta`; portal sincronizado com visitas e seleções; páginas `/s` e `/c`; 5 testes novos (77 no total); versão 0.8.0; D-73 | #19 | Revisão do PR; bloco 8 |
| 19/10/2026 | 8a | Estúdio: `marca_conta`, `marca_arquivos`, `pecas`, `peca_arquivos`; rotas `/estudio/*`; gerador de artes no navegador; Canva IA assistido; tela Estúdio; 3 testes novos (80 no total); versão 0.9.0; D-74 | #20 | Revisão do PR; bloco 8b |
| 19/10/2026 | 8b | Instagram: `canais_sociais` (token em `segredo`), parâmetros `meta_app_id`/`meta_app_secret`, rotas `/conexoes/*` e publicar/agendar/cancelar/publicada-fora, evento segregado `publicacao_programada` e listener, rotina `renovar_tokens_instagram`, tela Conexões; banco falso com máscara de segredo e `revelar`; 4 testes novos (84 no total); versão 0.10.0; D-75 | #21 | Revisão do PR; bloco 9 |
| 19/10/2026 | 8b | Revisão do PR #21 (rodada 1): estado `publicando` com reserva por `atualizarSe`, Meta fora de transação, evento com `agendada_para`, story só com arte do gerador, peça com erro editada volta a rascunho, rotina com `conta_id` numérico; 86 testes | #21 | Rodada 2; bloco 9 |
| 19/10/2026 | 9 | Assistente do Corretor: `scripts/gerar-ajuda.mjs` → `comum/ajuda-gerada.ts`, busca por termos, rota `/assistente/perguntar` (slot `assistente`), `pc-assistente` com `urbi-chat` em todas as telas, "Perguntar ao Assistente" na ficha do contato, ações conferidas e executadas pelas rotas de sempre; `filaDoDia` extraída do Início; docs `assistente.md`; roteiro das 30 perguntas; 4 testes novos (90); versão 0.11.0; D-76, P-38 | #22 | Revisão do PR; bloco 10 |
| 19/10/2026 | 9 | Revisão do PR #22 (rodada 1): Assistente vira tela do menu (sem CSS estrutural), `aoEnviar` trava o composer, fuso da conta na hora proposta, texto de terceiros mascarado e marcado como dado, resposta sem link e imagem, título limpo no resumo, busca com plural e radical de 5 letras, IA que falha volta à busca na ajuda; P-39 e pedido ao shell 5; 93 testes | #22 | Rodada 2 |
| 19/10/2026 | 8b | Revisão do PR #21, rodadas 2 e 3: transação por fase na rota, rota destravar (15 min), resultado condicionado a `publicando`, aprovar peça com erro da janela, limite de 30 s por chamada e 6 min de prazo; banco falso com rollback e DSL estrito; 88 testes; sem bloqueantes | #21 | Merge com ordem do dono |
| 19/10/2026 | 10a | Lembrete de visita: `configuracoes_conta.lembrete_visita_horas` (24, 0 desliga), `atividades.lembrete_enviado_para`, evento segregado `lembrete_visita` agendado ao criar e remarcar a visita, listener idempotente que notifica o responsável (`ctx.notificacoes`); roteiro de fechamento do MVP (R.8); 3 testes novos (95); versão 0.12.0; D-77 | #23 | Revisão do PR; roteiro R.8 na instância |
| 19/10/2026 | 10a | Revisão do PR #23 (rodada 1): o listener confere o prazo na hora (0 desliga o que já estava agendado; prazo trocado não lembra na hora velha), visita que já passou não é lembrada, gravação condicionada (`atualizarSe`), PATCH só reagenda se a hora, o status ou o tipo mudarem, PUT sem o campo mantém o valor gravado, `intervalo` no schema; 97 testes | #23 | Rodada 2 |
| 19/10/2026 | 10b | Merge dos PRs #2 e #13 a #22 na `main` (ordem do dono); D-78 (0.1.0 sem WhatsApp e Mensageiro); versão volta a 0.1.0 (D-69); plano fechado | #24 | Release 0.1.0 por ordem do dono; R.8 na instância |
| 19/10/2026 | 10b | Admin do app vale por todos os papéis, no backend e nas telas (#26); paleta única nas páginas públicas e no canvas do Estúdio, aviso de tokens de tema de 34 para 2 literais (#27); versão 0.1.1 | #26, #27 | Release 0.1.1 por ordem do dono |
| 19/10/2026 | 10b | Seletor de conta e cabeçalho `X-Conta` em todas as chamadas das telas (admin com várias contas via erro "conta destino inequívoca" em Início, Funil, Minha página, Conexões); versão 0.1.2 | #28 | Release 0.1.2 por ordem do dono; QA como admin |
| 19/10/2026 | 10b | Achados do QA como admin (#28): erro de conta não informada diz o que fazer; mensagem de probabilidade das etapas corrigida; versão 0.1.3 | #29 | Release 0.1.3 por ordem do dono; QA com 2+ contas; Instagram sem configuração na instância (pedido ao dono) |
| 19/10/2026 | 10b | Escopo da conta ativa em `req.dados` para quem atende várias contas (`backend/escopo.ts`); chamada sem `X-Conta` recusada com orientação; teste de isolamento com 2 contas; versão 0.1.4 | #36 | Release 0.1.4 por ordem do dono; issue #32 (leitura que escreve) |
| 19/10/2026 | 10b | Revisão do PR #36 pela skill `revisar-pr-apps` (2 rodadas, motor nativo; Codex sem login e Kimi sem rede nesta sessão): achou bloqueante próprio (`vitrine_publica`, tabela não segregada, sob o escopo de conta), consertado antes do merge; decisão D-79; merge sem o CI do GitHub (job preso na fila, sem rodar nenhum passo; validação local equivalente: typecheck, build, testes e empacotamento; relato da sessão), relatórios das 2 rodadas nos comentários [1](https://github.com/rafaleandrog/app-corretor/pull/36#issuecomment-6271477529) e [2](https://github.com/rafaleandrog/app-corretor/pull/36#issuecomment-6271576078) do PR #36; testes de fechamento (vitrine ponta a ponta com 2 contas, `atualizarSe`/`incrementar`/`revelar`); pendências em R.11 | #36, #37 | Release 0.1.4 por ordem do dono; R.10 na instância |
| 19/10/2026 | 10b | Causa do "você atende mais de uma conta" do dono: o usuário dele não é membro de nenhuma conta (`escopado` com conjunto vazio, conferido pela API na homologação); a escrita caía em `CONTA_NAO_INFORMADA` e a mensagem dizia "várias contas". Agora `SEM_CONTA` (409) com o caminho Admin › Acesso › Contas, e as telas do corretor mostram esse aviso; versão 0.1.5 | (este PR) | Dono se associa a uma conta; painel geral do admin (`visao_global`, só leitura) |
| 26/10/2026 | Estúdio | D-90 e D-91: descrição da arte em blocos fixos para o Canva IA (textos exatos, fotos, slides, visual, não faça), "descrição" no lugar de "instrução", listas por etapa com contagem e próximo passo em cada peça, CRECI fora do aviso no topo; D-91: descrição mista (instruções em inglês, texto da arte em português, entre aspas); docs do Estúdio e ajuda gerada; 154 testes; versão 0.1.10 | — | Revisão do PR; atualizar a instância e recarregar a tela |

---

## Revisão de viabilidade contra o SDK instalado — APROVADA pelo dono em 18/10/2026

Conferida em 18/10/2026 contra `@urbiverso/sdk` **100.0.0** (shell **0.56.37**, kit 100.3.16), lendo os docs em `apps/*/node_modules/@urbiverso/sdk/docs/`. Nada acima foi apagado. Aprovada integralmente pelo dono em 18/10/2026: os ajustes de R.2 valem para os blocos e as decisões de R.3 viraram D-55 a D-60 na spec.

### R.1 Pedidos ao shell (P-31 a P-33) — resultado da conferência

| Item | Existe no SDK 100? | Evidência | Consequência |
|---|---|---|---|
| P-31 · `GET` de verificação da Meta | **Não** | `wh.md` § Tabela de erros: método diferente de POST → `405 METODO_NAO_PERMITIDO` | Bloco 6 `[!]` |
| P-32 · corpo cru e cabeçalhos no handler | **Não** | `wh.md` § Registrar handler: `req.body` já parseado; corpo cru só para `req.slack` | Bloco 6 `[!]` (HMAC inviável) |
| P-33 · contexto do ingresso no handler | Sim | `wh.md`: `req.wh.contexto` | ok |
| P-33 · evento segregado com `{conta_id}` e listener com `comConta` | Sim | `barramento.md` § Eventos segregados; `contas.md` § Escrita em várias contas | ok; o handler **não grava nada** (o `req.dados` dele falha fechado): valida, publica e responde |
| P-33 · rota pública lê tabela segregada | **Não** | `contas.md`: sem conta resolvida → zero linhas; `comConta` só em SISTEMA | `vitrine_publica` **não segregada** (decisão R.3-1) |
| P-36 · retorno do OAuth/cadastro numa sub-rota | Em parte | `overview.md` § Navegação SPA: sub-rota pelo path, query em `window.location.search` | Testar na instância o redirecionamento da Meta (bloco 0, R.6) |

**Bloqueados enquanto P-31/P-32 não saem:** bloco 6, bloco 7 (depende do 6), a parte do 9 que age no WhatsApp e o fechamento (10). Alternativa (caminho B, parceiro Meta) só por decisão do dono.

### R.2 Ajustes propostos por bloco

| # | Ajuste | Motivo (SDK) |
|---|---|---|
| 0 | Pisos `sdk_min: 100`, `shell_min: "0.56.37"` (não 94/0.56.25). Confirmar que a instância intermediária roda shell ≥ 0.56.37 | KIT.md: "copie; não chute"; a spec já usa `urbi-planilha` (SDK 98) e `urbi-card` com ícone (SDK 100) |
| 0 | Identidade `rafaleandrog/app-corretor::portal_corretor` | `obsolescencias.json`: manifesto sem identidade já é erro desde 13/10 e reprova a partir de 28/10/2026 |
| 0 | Testar na instância: página pública com parâmetro (`/p/joao` ou `/p?c=joao`) e retorno de redirecionamento numa sub-rota autenticada (P-36) | Catálogo de páginas públicas é por caminho fixo; segmento dinâmico não documentado |
| 0 | Release pelo `release.yml` do kit (ele chama o `urbi-release`); secret `URBIVERSO_PACKAGES_TOKEN` no repositório | `apps-em-repo-proprio.md` § Release |
| 1 | Corretor convidado por `req.shell.externos.convidar({email, contaNome})` (uma conta nova por corretor); o **papel `corretor` é atribuído depois pelo admin da app** (o convite não leva papel) | `contas.md` § Superfície; `PROVISIONA_SEM_PAPEL` |
| 1 | Contas e usuários da semente criados **à mão** na instância; `aoIniciar` só semeia dados nas contas de demonstração (`comConta`) | Migração e `aoIniciar` não criam conta nem usuário |
| 1 | "Teste de isolamento automatizado" redefinido: (a) testes unitários das rotas com `req.dados` simulado, em todo PR — papel certo/errado, cliente só vê `itens_cliente`; (b) roteiro HTTP na instância com os 4 usuários de teste, a cada bloco | O SDK não traz banco de teste para app; o RLS só se prova na instância |
| 1 | Payload de evento segregado **sem dado pessoal** | O externo da conta (cliente) lista os eventos segregados da conta (`barramento.md`) |
| 1 | Avisos ao corretor pela tela Início + e-mail (não `req.notificacoes`) | `permissoes.md`: o shell do externo não mostra notificações; entrega a externo só com opt-in por tipo (`barramento.md`) |
| 2–3 | Remoção por **rota própria** que chama `req.dados.remover` (o `PATCH …/remover` genérico fica trancado por `restrito`); `DELETE` do corretor vira essa rota | `banco-de-dados.md`; externo tem teto `escrita` |
| 2–3 | Ids inteiros (não uuid); download de foto por rota própria com `req.arquivos.url` | `banco-de-dados.md` |
| 3 | Descrição por IA depende dos slots de IA autorizados para a app pelo admin | `ia.md` |
| 4 | Mover o **link rastreado** (`/l/:codigo`, rota pública + `wh`) para o bloco 4, senão "envios rastreados" depende do 5 | Dependência não listada |
| 5 | Minha Página, ficha e seleção leem de `vitrine_publica`; sem prévia de link (Open Graph) no WhatsApp — vira pendência P-37 | `paginas-publicas.md`: página montada no navegador |
| 5 | Lacunas de UI a declarar em 11.5: calendário/agenda, foto/galeria inline, editor por blocos, pré-visualização da página, cartão de arte; trocar `urbi-ficha` (não é painel lateral) | Catálogos `ui-componentes-*` |
| 7 | Slot `audio` renomeado (colide com slot padrão); slot extra com base `classificador` para temperatura; admin sobe o limite de IA (padrão 10/min **por app**) | `ia.md` |
| 8 | **Canva não existe na plataforma**: integração própria da app por `fetch()`, credenciais em `parametros secret`, token renovável em coluna `segredo`; fila de renderização por `agendar` com recorrência (rotina é no mínimo diária) | `grep canva` vazio; `rotinas.md`; `barramento.md` § Recorrência |
| 8 | Bloco 8 **não** depende de P-31/P-32 (publicar no Instagram não usa webhook): pode andar antes do 6 | — |
| 9 | Base de ajuda do Assistente: a app não tem leitura dos próprios `docs/`; proposta: script que gera um `.ts` com os docs antes do build (decisão R.3-4). Chat pode começar após o 4 | `documentacao.md`; KIT proíbe mudar flags do esbuild |
| spec | Corrigir: papéis de 15.1 (`dono_conta`, `agente`, `operador_plataforma`) e de 7.1/14 (`gestor`, `comercial_inc.`) → `corretor`/`cliente`/`operacao`/`suporte`; `conteudo_texto` × `conteudo`; anotações "AE sim" × `restrito` | Coerência interna |

### R.3 Decisões do dono antes do bloco 1

**Decididas em 18/10/2026 (D-55 a D-60):** 1 → sim, `vitrine_publica` é a única tabela não segregada (D-55); 2 → (b), link com token sem login no MVP (D-56); 3 → Início + e-mail (D-57); 4 → gerar no build a partir de `docs/` (D-58); 5 → esperar P-31/P-32 do time urbiverso; parceiro só por nova decisão (D-59); 6 → Canva com credenciais do dono até o bloco 8, senão o bloco começa pelo motor interno (D-60). Texto original das perguntas abaixo.

1. **Páginas públicas:** aceitar `vitrine_publica` como **única** tabela fora da segregação, só com o que o corretor publicou e sem dado pessoal? (exceção à regra de 4.5)
2. **Portal do Cliente no MVP:** (a) usuário externo com login (4.4/D-23) — exige a política "contas multi-usuário" ligada na instância, o cliente fica preso a um único corretor e enxerga os eventos da conta; ou (b) link com token, página pública sem login (11.3/15.1) — menos atrito, sem essas amarras, ações por `wh`.
3. **Avisos ao corretor:** Início + e-mail (WhatsApp para o próprio corretor quando o bloco 6 existir).
4. **Base do Assistente:** gerar no build a partir de `docs/` · delegar ao assistente de documentação do shell · tabela de ajuda mantida pela equipe.
5. **WhatsApp:** esperar P-31/P-32 do time urbiverso ou adotar parceiro (caminho B).
6. **Canva:** conta Enterprise e credenciais de API antes do bloco 8; senão o bloco 8 começa pelo motor interno de reserva.

### R.4 Ordem proposta

0 → 1 → 2 → 3 → 4 → 5 → 8 → 9 (parte sem WhatsApp) → 6 → 7 → 9 (resto) → 10. Os blocos 6 e 7 entram assim que P-31/P-32 estiverem no SDK publicado (ou o caminho B for decidido).

### R.5 Tarefas do dono em paralelo

| Tarefa | Necessária a partir do |
|---|---|
| Cadastrar `URBIVERSO_PACKAGES_TOKEN` nos secrets do repositório | Bloco 0 (primeiro release) |
| Confirmar a instância intermediária (shell ≥ 0.56.37), ter admin nela e dar acesso de leitura do repositório ao usuário do PAT da instância (ou entregar um PAT de leitura) | Bloco 0 |
| Levar P-31 e P-32 ao time urbiverso | Já (bloqueia o 6) |
| Na instância: e-mail de sistema, provisionamento de externos ligado (e multi-usuário, se R.3-2 = a) | Bloco 1 |
| Criar à mão os 2 corretores de teste (contas com nome terminado em "(demo)", para a semente) e atribuir o papel `corretor`; atribuir `operacao` a quem convida | Bloco 1 |
| Em Admin › Instaláveis › Apps: nível padrão de externos = escrita; liberar o provisionamento de externos e a capacidade "criar conta" | Bloco 1 |
| Responder P-04, P-10, P-12, P-15, P-19 e as decisões R.3 | Bloco 1 |
| Autorizar os slots de IA da app (`conteudo` e `fotos` no bloco 3, `assistente` no bloco 9; a base `audio` para o microfone do Assistente) e o limite por minuto | Bloco 3 |
| Conta Canva Enterprise + credenciais de API | Bloco 8 |
| App registrado na Meta em modo de desenvolvimento + contas de teste do Instagram | Bloco 8 |
| Contas de teste do WhatsApp como testadoras | Bloco 6 |
| Roteiro das 30 perguntas do Assistente — rascunho em `testes/assistente.test.ts` (ROTEIRO); revisar e trocar perguntas se quiser | Bloco 9 |
| P-26 (caminho A/B/C) e, se A, verificação da empresa e revisão do app; termos e privacidade | Em paralelo; obrigatório na fase 2 |

### R.6 Conferência do bloco 0 na instância (dono, depois de instalar)

1. Admin › Instaláveis › Apps → instalar `portal_corretor` (do repositório, depois do release, ou por upload do `dist/portal_corretor-<versão>.urbiapp.tgz` gerado pelo `pnpm -r empacotar`, hoje 0.3.0). Deve instalar sem `422`.
2. Abrir o app como corretor: aparece o Início pedindo para completar a conta (versão 0.2.0 em diante; na 0.1.0 era "Portal do Corretor em construção").
3. Abrir `/portal_corretor/retorno?code=teste`: a tela "Página não encontrada" mostra "Endereço recebido: /retorno?code=teste" (P-36 ok) — ou o app não abre (P-36 precisa de outro caminho).
4. Sem login, abrir `/portal_corretor/p`, `/portal_corretor/p/teste` e `/portal_corretor/p?c=teste`: anotar quais abrem a página e o que a rota pública respondeu. Decide se a Minha Página usa `/p/<slug>` ou `/p?c=<slug>`.

### R.7 Notas do bloco 1

- **`suporte` com acesso irrestrito não foi declarado.** Depende da regra de P-19 (acesso da plataforma a uma conta para suporte); sem a declaração, ninguém atravessa contas. Entra quando o dono decidir P-19.
- **Gravação de linha única** (conta, configurações, perfil) por leitura + atualização/criação, não por `criarOuAtualizar`: em tabela segregada o SDK não documenta o alvo do upsert (revisão do #13).
- **Teste de isolamento:** prova que o código depende só de `req.dados` (banco simulado por conta); o RLS de verdade se confere no roteiro abaixo.
- **Roteiro na instância (somar ao R.6):** com dois corretores de teste em contas "(demo)", cada um edita a própria conta e confirma que não vê a do outro; um usuário só com `operacao` não abre Conta e marca; um usuário sem papel vê "área não liberada" nas duas telas; convite enviado aparece como "Aguardando aceite" e, aceito, como "Aceito".

### R.8 Roteiro de fechamento do MVP (bloco 10, spec 15.1)

Executado pela equipe na instância intermediária, com a app instalada pelo pacote. Registre cada item (data, quem, resultado) na tabela do registro de sessões ou numa issue do bloco 10.

**Antes de começar (dono):**
- instalar a versão mais recente (`.urbiapp.tgz` do release ou do `dist/`);
- 2 corretores "(demo)" com o papel `corretor`, 1 usuário com `operacao`;
- slots de IA `conteudo`, `fotos` e `assistente` autorizados (e o de áudio da plataforma, para o microfone);
- rotinas `reclassificar_contatos` e `renovar_tokens_instagram` ligadas;
- app da Meta em desenvolvimento com `meta_app_id`/`meta_app_secret` e as contas de teste do Instagram.

| # | Critério 15.1 | Como conferir | Situação |
|---|---|---|---|
| 1 | Telas | Abrir cada tela do corretor no computador e no celular (Início, Funil, Clientes, ficha, Agenda, Imóveis, ficha, Empreendimentos, Desempenho, Minha página, Estúdio, Conexões, Conta e marca, Funil e abordagens, Assistente); ver o estado vazio (conta nova) e o de erro (desligar a IA, desconectar o Instagram). Página pública, ficha do imóvel, seleção e Portal do Cliente no celular | Pronto para conferir |
| 2 | Caminhos | Sem atalho de desenvolvedor: cadastrar imóvel com fotos e autorização → publicar na Minha página → abrir a ficha pública e mandar o formulário (vira contato no funil) → montar seleção e gerar o portal → cliente reage e pede visita → pacote de lançamento no Estúdio → aprovar → publicar e agendar no Instagram de teste | Pronto, **menos WhatsApp e Mensageiro** (blocos 6 e 7) |
| 3 | Permissões | Matriz da seção 14 papel por papel; corretor B não abre nada de A pela URL, pelo Assistente (contato em foco) nem pelo link público; usuário só com `operacao` não abre a área do corretor; cliente só vê o próprio portal | Pronto para conferir (24+ testes de isolamento automatizados passam em todo PR) |
| 4 | Automações | Lembrete de visita (marcar visita para daqui a 25 h e ver a notificação 1 h depois), publicação agendada (agendar para daqui a 10 min), temperatura (rotina), próxima abordagem (fila do Início). Anotar à mão o atraso real de cada disparo (a spec pede o registro na tabela `pendencias_agendadas` da app, 6.15, que fica fora do 0.1.0 pela D-78: o atraso se confere pela hora da notificação ou da publicação) | Pronto, menos as automações do Mensageiro |
| 5 | Números | Carregar os dados de demonstração e conferir à mão funil, conversão e tempo de resposta do Desempenho | Pronto para conferir |
| 6 | Ajuda | Fazer ao Assistente as 30 perguntas do roteiro (`testes/assistente.test.ts`) e anotar se a resposta está certa e cita o artigo; conferir o link da documentação (P-38) | Pronto para conferir |
| 7 | Instalação | Instalar e atualizar (versão anterior → atual) sem reprovação | Pronto para conferir |
| 8 | Negociação (spec 1.2) | As 7 conversas-roteiro de 10.9.9: nenhuma contraproposta abaixo do recuo; nenhum vazamento de recuo, alvo ou BATNA do vendedor (portal, vitrine, eventos); passagem correta ao corretor; um negociador humano de teste vê só a negociação atribuída (com a política multi-usuário ligada) | Espera a Fase 1.6 (D1 a D7) |
| 9 | Padrão B (spec 1.2) | Todas as telas de 11.1, 11.3 e 11.5 na moldura de 11.0, com os estados de 11.0.4, no computador e no celular | Espera a Fase 1.6 (B1 a B10) |

**Decidido (D-78):** o 0.1.0 sai sem WhatsApp e sem Mensageiro (blocos 6 e 7, travados em P-31/P-32); os critérios 2 e 4 ficam parciais, registrados acima.

### R.9 Release 0.1.0 (aguarda a ordem do dono)

Tudo do MVP está na `main`, com a versão 0.1.0. Quando o dono mandar: Actions → `release.yml` → Run workflow, alvo `portal_corretor`. O secret `URBIVERSO_PACKAGES_TOKEN` precisa estar nos secrets do repositório (KIT.md). Depois: instalar na instância intermediária e executar o R.8. Se alguma instância de teste tiver uma versão interna maior instalada à mão (pacote do `dist/`), desinstale antes, porque 0.1.0 é menor.


### R.10 Roteiro de QA: admin do app com 2 contas (issue #34)

Pré-requisitos: 0.1.4 ou posterior instalada; uma segunda conta de teste (`qa-…`) com o admin (ou o QA Principal) como membro; Instagram fora do roteiro enquanto a instância não o configurar (#30).

1. **Seletor:** com 2 contas aparece **Conta** no alto das telas; com 1 não aparece.
2. **Escrita:** Início, Funil, Funil e abordagens, Minha página e Conexões abrem sem erro de conta, em cada uma das duas contas.
3. **Isolamento:** criar contato e imóvel na conta A; trocar para a B e conferir que não aparecem em Clientes, Imóveis, Funil nem Desempenho; voltar à A e conferir que continuam lá (#31).
4. **Sem conta ativa (API):** chamada sem `X-Conta` responde `400 CONTA_NAO_INFORMADA` com a orientação.
5. **Papéis:** o admin alcança as telas de corretor e a de Corretores (equipe); um usuário com papel só de corretor não alcança Corretores.
6. **Perfil corretor:** convite aceito de um externo de teste; conferir que ele só vê a própria conta.
7. **Fixtures:** importar CSV, subir fotos e autorização num imóvel, enviar seleção e abrir o Portal do Cliente pelo link.
8. **Tela:** percorrer o menu no computador e no celular e registrar erros visíveis.

Registrar o resultado no relatório da skill `qa` e abrir issue para o que quebrar.


### R.11 Pendências abertas (19/10/2026)

| Item | O que falta | De quem |
|---|---|---|
| #30 Instagram não configurado na homologação | Cadastrar as credenciais da app Meta na instância (conta de teste da equipe) e reexecutar o QA de Conexões e Estúdio | Dono / equipe da plataforma |
| #32 Etapas do funil semeadas dentro de GET | O erro de conta nas telas está resolvido (D-79 + seletor). Resta a escrita dentro de leitura. Mudar isso altera o que um corretor novo vê em Funil e Ajustes, então exige decisão: semear no primeiro acesso (hoje) ou por chamada explícita da tela. **Não alterado sem decisão e sem QA em instância** | Dono |
| #33 Avaliar o app como admin | Decidir conta de demonstração por instância e "ver como cliente" (muda o que o admin vê) | Dono |
| #34 Lacunas de QA | Segunda conta de teste, versão instalada, perfil corretor, fixtures e tela: roteiro R.10 | Dono autoriza; sessão de QA executa |
| #35 Armadilhas de processo | Resolvidos no #36: aviso no `CLAUDE.md` e teste do `X-Conta`. Restam: tokens de tema (2 literais, heurística), atualização automática da instância e `X-Conta` malformado (403 no shell) | Equipe da plataforma |
| Motores da revisão | Codex: `codex login status` diz "Not logged in" nesta sessão (instalado, sem login). Kimi: `api.moonshot.ai` negado pela rede do ambiente | Dono (ambiente de nuvem) |
