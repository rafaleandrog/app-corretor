# Plano de implementação — Portal do Corretor

Ordem de trabalho das sessões do Claude Code. Cada bloco cita as seções da spec (`specs/portal_corretor.md`) que o definem. Status: `[ ]` a fazer · `[~]` em andamento · `[x]` pronto (com PR) · `[!]` bloqueado (motivo ao lado).

**Regra:** só começar um bloco quando os anteriores de que ele depende estiverem `[x]`. Só começar uma fase quando o "pronto quando" da anterior estiver cumprido e o dono tiver aprovado.

---

## Fase 1 — MVP interno (spec 15.1)

Telas, funções, permissões, caminhos e automações prontos, testados pela equipe com contas de teste, na instância intermediária. **Sem corretor real.** Estimativa: 10 a 12 sessões.

| # | Bloco | Spec | Depende de | Pronto quando | Status |
|---|---|---|---|---|---|
| 0 | **Verificação e esqueleto da plataforma:** conferir no SDK os itens [plataforma] e `specs/pedidos_ao_shell.md` (itens 1 a 3); definir `shell_min`/`sdk_min`; repositório, build, empacote e instalação vazia na instância intermediária; abrir a issue | 4, 5, 9.0, 9.8, pedidos | — | App vazia instala pelo `.urbiapp.tgz`; relatório dos itens do shell entregue ao dono | [ ] |
| 1 | **Contas, papéis e isolamento:** roles e `roles_externos`, convite de corretor e de cliente, `perfil_conta`, `perfis_corretor`, `configuracoes_conta`, `itens_cliente`, semente idempotente (2 corretores, 2 clientes), **teste de isolamento automatizado** | 4.4, 4.5, 5, 6.0, 6.1, 6.15, 12.2 | 0 | Teste de isolamento passa; cada papel vê só o que deve | [ ] |
| 2 | **CRM:** contatos, negócios, etapas configuráveis, linha do tempo, tarefas, agenda, visitas, importação CSV, exportação; tela Clientes | 6.2, 7.1, 7.4, 11.1, 12.1 | 1 | Cadastrar, mover, importar e exportar; telas no computador e no celular | [ ] |
| 3 | **Imóveis (anúncios) e empreendimentos:** fotos (upload em 2 passos), descrição por IA, qualidade, autorização anexada, visibilidade; tela Imóveis | 6.3, 6.12, 10.6, 11.1 | 1 | Imóvel com fotos em menos de 3 min; qualidade calculada; só públicos aparecem fora | [ ] |
| 4 | **Funil e números:** quadro, temperatura com motivo, próxima abordagem (playbook semeado), fila do dia, envios rastreados, Início, Desempenho, KPIs | 6.12, 6.15, 10.4, 11.1, 11.2 | 2, 3 | KPIs batem com conferência manual sobre a semente; fila do dia ordenada | [ ] |
| 5 | **Páginas públicas e Portal do Cliente:** Minha Página (editor por blocos), ficha pública, seleção com reação, formulário por `wh`; Portal do Cliente (role `cliente`) no celular | 6.15, 7.2, 7.3, 11.1, 11.3 | 3, 4 | Visitante envia contato pela página; cliente vê só o que recebeu | [ ] |
| 6 | **WhatsApp:** conexão (cadastro incorporado hospedado, coexistência), ingresso `wh` por conta e endereço alternativo do número, validação de assinatura, caixa de conversas, envio de imóvel/seleção/arquivo/link, modelos, janela de 24 h | 9.0, 9.1, 9.8, pedidos | 2, 5; pedidos 1 e 2 resolvidos | Conta de teste conecta; mensagem de ida e volta pelo app | [ ] |
| 7 | **Mensageiro:** configuração em 5 passos, permissões por ação, conversa de teste, listener com IA, ações executadas pelo app, passagem ao corretor, custo, modo degradado | 10.3, 10.6, 10.7, 10.8 | 6 | Mensagem de teste às 22 h respondida em segundos, 3 imóveis enviados, visita marcada; passagem no Início | [ ] |
| 8 | **Estúdio e Instagram:** marca, pedido em texto ou voz, IA → Canva (fila de renderização, pasta por conta), biblioteca de arquivos, aprovação manual e por janela, **agendar** (`req.eventos.agendar`), **publicar agora**, **baixar arquivos**; conexão do Instagram | 9.2, 9.4, 10.5, 11.1 | 3; Canva da plataforma configurado | Pacote de lançamento publicado numa conta de teste no horário agendado | [ ] |
| 9 | **Assistente do Corretor:** chat em todas as telas com base nos `docs/` da app, ajuda a decidir, ações com confirmação (lembretes, tarefas, agendamento de posts) | 10.2, 11.1 | 2–8 | Responde as 30 perguntas do roteiro; ação só com confirmação | [ ] |
| 10 | **Fechamento do MVP:** roteiros de 15.1 executados e registrados; ajustes; docs da app completos | 15.1, 18 | 0–9 | Os 7 critérios de 15.1 cumpridos; dono aprova o MVP interno | [ ] |

**Em paralelo, fora do código (dono):** decidir o caminho do registro na Meta (P-26) e, se for o A, iniciar verificação da empresa e revisão do app; termos de uso e política de privacidade.

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
| | | | | |
