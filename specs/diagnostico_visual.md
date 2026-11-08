# Diagnóstico visual e de comandos — app 0.1.44 × `specs/layout/` e spec seção 11

> Etapa 2 do arco das referências visuais (07/11/2026). **Só diagnóstico: nada foi corrigido.** Cada linha diz o tipo da diferença, o que está diferente, onde está no código e o que se propõe. A ordem de correção proposta está no fim, com P02 Conversas como piloto.

## 0. Resumo

| | |
|---|---|
| App conferida | 0.1.44 na instância de homologação (a `main` está em 0.1.45, que só muda a paleta das páginas públicas, #170) |
| Referência | `specs/layout/png/<tela>.png` e `<tela>.layout.json` (contrato de `specs/layout/README.md`); comportamento e comandos pela spec 11 (rotas da seção 7, eventos da 13) |
| Telas conferidas por captura | 20 de 25: P01, P03–P10, P12–P15, P17, M1, M3–M6, M8 |
| Telas que não existem na app | P02 Conversas, P11 Mensageiro, M2 Conversa (WhatsApp, blocos 6 e 7, D-78) e M7 Proprietário (fase 3); ver seção 4 |
| Telas sem o estado da referência | P15, M5 e M8 capturadas vazias e **P16 Mandato não capturada**: a conta de QA não tem negociação nem imóveis enviados ao portal. A instância **não tem conta "(demo)"**, e a semente do guia (spec 12.2) só entra nessas contas no boot da app |
| Diferença que domina | A **moldura**: a app roda dentro da página do shell (barra 56 px + cabeçalho com título e Criar + margem de 24 px); o conteúdo começa em y = 130, o trilho não tem Criar nem avatar, e as colunas saem 360 · 589 · 340 em vez de 340 · 712 · 300. Decisão do dono antes de qualquer tela (seção 2) |
| Comandos | Conferidos pelo código (tela → rota → handler → evento → teste), não por execução na instância: ver seção 1 |

## 1. Método, e o que não foi possível

**Capturas.** As telas foram abertas na instância pelo Playwright com `apps/portal_corretor/scripts/conferencia-visual/capturar.mjs`, nos viewports do contrato (1440 × 1000 e 390 × 844), e comparadas com `comparar.py` (imagem lado a lado + medidas extraídas do DOM, atravessando shadow roots, no formato dos `.layout.json`). As imagens lado a lado desta rodada estão em `specs/prints/conferencia-layout-0.1.44/` (etapa 1; a app na instância não mudou desde então).

**O que não foi como pedido, e como foi feito no lugar:**

1. **Sem a semente de demonstração.** A instância não tem conta cujo nome termine em "(demo)"; a semente só entra nessas contas e só no boot da app (`backend/semente.ts:7-14`), que eu não consigo disparar (alçada `sistema`). As capturas usam a **conta de QA** existente, com dados de QA. Estrutura e medidas não dependem dos dados; o que depende (negociação aberta em P15/P16/M8, imóveis enviados em M5, faixa "Próximo passo" em M4) ficou **sem o estado da referência** e está marcado como tal.
2. **Sem senha de navegador.** O shell só reconhece sessão por cookie; o script injeta o token da API e responde à rota de identidade do shell com a rota equivalente que aceita token. Nada foi gravado na instância.
3. **Fonte.** A fonte do tema (Montserrat) vem do Google Fonts, bloqueado na rede do ambiente; as capturas usam a fonte do sistema. Larguras de texto variam alguns pixels (README § 5); caixas, alturas e tamanhos de fonte não.
4. **Comandos "funcionam"?** Conferido **pelo código**, sem executar escrita na instância: para cada comando da spec 11, se o botão existe na tela (`frontend/telas/*.ts`), que rota ele chama (`chamarApi`/`enviar`), se a rota existe no backend (`backend/*.ts`) e o handler faz o efeito, se o evento da spec é publicado (`manifesto.json`, `eventos.publicar`) e se há teste (`testes/*.test.ts`). "Sem funcionar" é: botão existe mas a rota não existe, o handler não faz o efeito, está "em breve"/desabilitado, ou o evento não é publicado.

**Tipos usados nas tabelas:** `bloco faltando` · `fora de ordem` · `coluna errada` · `medida fora de ±4 px` · `cor ou fonte fora do tema` · `comando ausente` · `comando sem funcionar`. Quando a diferença já tem decisão registrada (D-nn, pedido ao shell, exceção 11.9, pendência do plano), a proposta diz "manter, por decisão" e cita.

**Regra de leitura.** Ordem de autoridade: SDK > spec seção 11 (comportamento) > contrato `specs/layout/` (forma) > mockups. Onde a **spec e a referência visual divergem** (acontece em P04, ver 3.4), a tabela registra a divergência e pede decisão, em vez de escolher.

## 2. Moldura comum (vale para todas as telas do corretor no computador)

Medidas da app a 1440 px: `urbi-shell-page` começa em y = 56 (barra do shell), o cabeçalho da página ocupa 56–129 (título h1 20 px/700 e o botão Criar à direita) e o `urbi-inbox` vai de (24, 129) com 1392 × 855. Dentro dele, trilho `urbi-trilho-atalhos` 88 × 671 em x = 25 e `urbi-3-colunas` com `urbi-hospedeiro` de 360 · 589 · 340 (Assistente aberto: 360 · 529 · 400; lista estreita no Funil: 280 · 975).

| Tipo | O que está diferente | Onde está no código | Proposta |
|---|---|---|---|
| bloco faltando / fora de ordem | **Criar** não está no topo do trilho; está no cabeçalho da página do shell, à direita. O **avatar** do pé do trilho não existe | `frontend/index.ts:239-247` (ações da `urbi-shell-page` com `menuCriar()`); `frontend/criar.ts`; `frontend/moldura.ts:62-71` (itens do trilho) | Decisão do dono: (a) manter por decisão (exceção 11.9 do B1, pedido ao shell 14) e registrar D-nn, ou (b) pôr Criar como primeiro item do trilho se o `urbi-trilho-atalhos` aceitar um item de ação. O avatar é do shell (barra superior): manter |
| bloco faltando | O trilho tem **Buscar** a mais (a spec 11.7 põe a busca no cabeçalho da coluna esquerda); o **selo numérico** de Clientes não aparece | `frontend/moldura.ts:70` (Buscar); `moldura.ts:62-71` (sem `contador`) | Decisão: manter Buscar no trilho como D-nn ou tirá-lo e pôr a busca global na coluna esquerda; ligar o `contador` de Clientes (R.8.1 item 5) |
| medida fora de ±4 px | Área útil começa em **y = 130**, não em 0: 130 px a menos de altura em toda tela; trilho com 671 px em vez de 1000 | `frontend/index.ts:247` (`urbi-shell-page ?dashboard`), moldura dentro da página do shell | Decisão do dono: aceitar a página do shell como está (D-nn) ou pedir ao shell um modo "página cheia" (pedido ao shell novo). Sem isso, nenhuma tela bate em altura |
| medida fora de ±4 px | **Colunas 360 · 589 · 340** (contrato: 340 · resto ≈ 712 · 300; lista máx. 380, contexto máx. 360). Centro 123 px mais estreito; é isso que quebra a grade 2 colunas do P17 e o quadro do P03 | `frontend/moldura.ts:112-123` (`largura-esquerda` 360/280, `largura-direita` 340/400, mínimos e máximos) | Trocar para `largura-esquerda="340px"`, `largura-direita="300px"` (Assistente 380) e margem 0 se o `urbi-shell-page` permitir; o resto vai para o centro. Conferir no primitivo se as larguras são aceitas |
| medida fora de ±4 px | **Botão padrão 34 px** (`urbi-botao`) e pequeno 25 px; contrato 44 e 36 | Primitivo `urbi-botao` (SDK), usado em toda tela | Registrar como diferença de primitivo em todo PR (README § 1); abrir pedido ao shell para tamanho "44" ou aceitar como D-nn |
| medida fora de ±4 px | **Campo de texto 32–36 px** dentro de `urbi-campo`/`urbi-input` com rótulo em cima (52–54 no conjunto); contrato 44, raio 10, rótulo como placeholder na busca | Primitivos `urbi-input`, `urbi-select`, `urbi-busca` | Registrar como primitivo; na busca da coluna esquerda, usar placeholder sem rótulo se o primitivo permitir |
| medida fora de ±4 px | **Título da coluna** 18 px/700 (dentro da coluna) e 20 px/700 (cabeçalho do shell); contrato 22 px/800. Chips 24 px (contrato 23): igual. Cartão raio 12 (contrato 14): dentro da tolerância | `urbi-prosa papel="titulo"` nas telas; `urbi-shell-page` | Dentro de ±4 px no tamanho; o **peso 800 não existe** na fonte do tema (vai até 700): registrar "vem do tema" |
| cor ou fonte fora do tema | Nenhuma: as telas do corretor usam só tokens e primitivos. O aviso do empacotador (14 literais de cor) é da paleta das páginas públicas, exceção nomeada do #170 | `frontend/publico/estilo.ts` | Manter |

## 3. Tela a tela

Cada tabela traz primeiro as diferenças **visuais** (contra o PNG e o `.layout.json`) e depois os **comandos** (contra a spec 11). Medidas das colunas por tela, da app: ver 3.0.

### 3.0 Medidas por tela (app a 1440 × 1000, referência entre parênteses)

| Tela | Colunas app (ref) | h1 app (ref) | Botões `urbi-botao` (ref `button`) | Campos app (ref) | Chips app (ref) |
|---|---|---|---|---|---|
| M1-Hoje | [382] ([]) | 20px/700 (24px/800) | [25, 34] ([44]) | [] ([]) | [24] ([23]) |
| M3-Novo-imovel | [382] ([]) | 20px/700 (22px/800) | [25, 34] ([44, 52, 120]) | [32, 36] ([]) | [24] ([23]) |
| M4-Portal | [] ([]) | 25.6px/700 (None) | [] ([44, 48]) | [96] ([46]) | [] ([]) |
| M5-Portal-imoveis | [] ([]) | 25.6px/700 (None) | [] ([44, 48]) | [] ([44]) | [] ([23]) |
| M6-Pagina-publica | [] ([]) | 25.6px/700 (None) | [] ([]) | [13, 44, 96] ([]) | [] ([]) |
| M8-Aprovar-negociacao | [382] ([]) | 20px/700 (None) | [25] ([44]) | [] ([]) | [] ([23]) |
| P01-Hoje | [360, 589, 340] ([340, 712, 300]) | 20px/700 (22px/800) | [25, 34] ([36, 44, 56]) | [] ([]) | [24] ([23]) |
| P03-Funil | [280, 975] ([340, 712, 300]) | 20px/700 (22px/800) | [20, 25] ([36, 56]) | [36] ([]) | [24] ([23]) |
| P04-Cliente | [360, 589, 340] ([340, 712, 300]) | 20px/700 (22px/800) | [20, 25] ([36, 44, 56]) | [32, 36] ([46]) | [24] ([23]) |
| P05-Assistente | [360, 529, 400] ([340, 632, 380]) | 20px/700 (22px/800) | [25, 34] ([36, 56]) | [75] ([46]) | [24] ([23]) |
| P06-Imoveis | [360, 589, 340] ([340, 712, 300]) | 20px/700 (22px/800) | [20, 25, 34] ([36, 56]) | [32] ([46]) | [24] ([23]) |
| P07-Novo-imovel | [360, 589, 340] ([340, 712, 300]) | 20px/700 (22px/800) | [25, 34] ([36, 44, 56]) | [32, 36] ([67, 84]) | [24] ([23]) |
| P08-Estudio | [360, 589, 340] ([340, 712, 300]) | 20px/700 (22px/800) | [25, 34] ([36, 56, 64, 66, 79]) | [75] ([26, 46]) | [24] ([23]) |
| P09-Pagina | [360, 589, 340] ([340, 712, 300]) | 20px/700 (22px/800) | [20, 25, 34] ([36, 56]) | [13, 16, 44, 96] ([19]) | [24] ([]) |
| P10-Numeros | [360, 589, 340] ([340, 712, 300]) | 20px/700 (22px/800) | [25, 34] ([36, 56]) | [36] ([]) | [24] ([23]) |
| P12-Conexoes | [360, 589, 340] ([340, 712, 300]) | 20px/700 (22px/800) | [25] ([36, 56]) | [] ([]) | [24] ([23]) |
| P13-Conta | [360, 589, 340] ([340, 712, 300]) | 20px/700 (22px/800) | [20, 25, 34] ([36, 44, 56]) | [] ([48, 67]) | [] ([23]) |
| P14-Importar | [360, 589, 340] ([340, 712, 300]) | 20px/700 (22px/800) | [25, 34] ([44, 56]) | [36] ([58, 60]) | [24] ([23]) |
| P15-Negociacoes | [360, 895] ([340, 712, 300]) | 20px/700 (22px/800) | [25] ([18, 36, 56]) | [] ([]) | [] ([23]) |
| P17-Negociador | [360, 589, 340] ([340, 712, 300]) | 20px/700 (22px/800) | [25] ([36, 46, 56]) | [16, 32, 36, 48, 144] ([40, 46, 160]) | [24] ([23]) |

### 3.1 P01 · Hoje (`/`; a spec diz `/hoje`)

Visual: três colunas e a ordem geral batem (esquerda com título, data, "Precisa de você · N"; centro "Fila do dia" na ordem do mais urgente; direita Agenda, Sua semana, Dica do Assistente). "Primeiros passos" e "Mais N para depois" existem no código (`inicio.ts:226`, `:284`) e não apareceram só porque a conta de QA já completou os passos e a fila cabia: não são diferenças.

| Tipo | O que está diferente | Onde está no código | Proposta |
|---|---|---|---|
| bloco faltando | Abas **Hoje · Agenda** no cabeçalho da coluna esquerda não aparecem no computador (a Agenda abre por "Ver agenda" na direita); o endereço `/hoje` não existe (Hoje é `/`) | `frontend/telas/inicio.ts:138-143` (`mudarVisao`, abas só no celular); `frontend/enderecos.ts` | Mostrar as abas Hoje · Agenda também no computador (D-82); registrar `/hoje` como apelido |
| bloco faltando | "Precisa de você" lista passagens com **Abrir** (ficha do cliente) em vez de **Assumir** (abre a negociação já assumida) | `inicio.ts:203-222` | Trocar o botão por Assumir chamando `POST /negociacoes/:id/assumir` e abrindo P15 (pendência do B2, R.8.1 item 1) |
| bloco faltando | Cartões da fila têm **um botão** (Fazer agora / Abrir); a referência mostra o secundário ("Falar com Ana", "Registrar proposta") e **"Agora não"** no menu "mais"; os chips repetem "Quente · Quente" (tipo e temperatura com o mesmo rótulo) | `inicio.ts:146-170` (`acaoDe`, `acoesDoItem`), `ACOES_FILA` | Acrescentar "Agora não" (`POST /abordagens/:contato/adiar`, que já existe) no "mais" de todo cartão; rotular o chip de tipo pelo motivo ("Sem resposta", "Visita hoje"), não pela temperatura |
| fora de ordem / medida | **Sua semana** em 1 coluna de 4 KPIs de 274 × 72 (valor 22 px); referência: grade 2 × 2 com KPI de 28 px | `inicio.ts:310-319` (`urbi-grid` com piso de 140 px do `urbi-kpi`, que na coluna de 308 px cabe 1 por linha) | Com a coluna de contexto em 300 px (seção 2) continua 1 por linha: pedir ao `urbi-kpi` um modo compacto ou aceitar 1 × 4 como D-nn |
| medida fora de ±4 px | Botões 34/25 px; título 18 px/700 | Primitivos (seção 2) | Registrar |

Comandos (spec P01 e 11.7):

Comandos da spec conferidos pelo código: **17 OK**, **6 por decisão**, **7 ausentes ou sem funcionar** (abaixo). O detalhe comando a comando, com rota, evento e teste, está no Anexo A.

| Tipo | O que está diferente | Onde está no código | Proposta |
|---|---|---|---|
| comando sem funcionar | Assumir (passagem do Negociador) — pendência do B2 "o Assumir espera o D2/D3", plano:235; R.8.1 item 1, plano:443, sem decisão | Parcial: a passagem tem o botão Abrir (`frontend/telas/inicio.ts:213-215`), que leva a `/clientes/:contato` (ficha), não à negociação; sem `contato_id` não há botão nenhum | Trocar Abrir por Assumir na passagem: `enviar('POST', '/negociacoes/:id/assumir')` e `abrirNegociacao(id)` (já existe em `frontend/telas/negociacoes.ts:802-805`); manter Abrir no "Mais". Teste no `hoje`/Chromium |
| comando ausente | Botão principal do cartão: Registrar proposta (propostas recebidas) — R.8.1 item 2, plano:444, sem decisão | Existe o que o cartão chamaria: `POST /negociacoes/:id/propostas` (`backend/negociacao.ts:543`) | Acrescentar os motivos `proposta_recebida` (negociações com proposta do comprador pendente → botão abre P15), `peca_aguardando` (peças `aprovada` sem agendamento → "Revisar peça", P08) e `prazo_autorizacao` (autorizações a vencer, já há `autorizacao.vencendo` na spec 13) em `filaDoDia` + `ACOES_FILA`; ou D-nn deixando para o Mensageiro |
| comando ausente | Botão principal do cartão: Revisar peça (peças aguardando) — R.8.1 item 2 | Não (idem) | Idem acima |
| comando ausente | Agora não (adia o cartão, no "Mais") — R.8.1 item 2, sem decisão | Existe: `POST /abordagens/:contato/adiar` (`backend/funil.ts:201-211`), usada pela ficha como "Pular a abordagem" (`ficha-contato.ts:413-416,576`) | Pôr "Agora não" no "Mais" dos cartões `abordagem_vencida` (→ `/adiar`) e, para os outros tipos, um adiar de dia (`quente_sem_resposta` e `proximo_passo` não têm rota de adiar: precisaria de `abordagem_adiada_em` valer para eles ou de uma rota nova) |
| comando sem funcionar | Dica do Assistente (executa a sugestão após confirmação) — R.8.1 item 2 "Dica só abre o Assistente", sem decisão | Parcial: o cartão existe (`inicio.ts:323-332`) com o botão Perguntar ao Assistente, que só abre o painel (`abrirAssistente()`); a dica é texto calculado na tela (`comum/hoje.ts:65-77`), sem ação | Ou registrar D-nn: a dica é só atalho para o Assistente, onde a ação é proposta e confirmada pelas rotas de sempre (D-76/D-109), e emendar a spec; ou fazer a dica vir de `GET /inicio` como `{texto, acao}` validada por `validarAcao` (`comum/assistente`) e confirmada com o mesmo cartão "Posso fazer isto?" |
| comando sem funcionar | Atalho `E` enviar sugestão aceita — tecla existe com outro efeito; B10 registrou "E nas fichas" sem D-nn, plano:211 | Não como a spec: `E` está ligado a editar o item aberto (`atalhos.ts:12,41,228-233`; `registrarEdicao` em `ficha-contato.ts:922` e na ficha do imóvel). Nenhum "Enviar" de sugestão (cartão "Negociador sugere", P15) responde ao `E` | Decidir: `E` dispara o Enviar do cartão de sugestão quando ele está na tela (P15; e Mensageiro depois) e editar vai para outra tecla; ou D-nn aceitando `E` = editar e emendando 11.0.6 |
| comando ausente | Desfazer por 8 s em mover etapa, arquivar, revogar link (11.0.6) — sem decisão; o SDK 100 não tem notificação com ação | Não em nenhuma tela do grupo (nenhum "desfazer" no frontend) | Pedido ao shell (toast com ação) ou D-nn dispensando |

### 3.2 P03 · Clientes › Funil (`/clientes?visao=funil`)

Visual: alternador Funil · Lista · Negociações, funis com contagem, filtros prontos, quadro por etapa com cartões de cliente e temperatura, arrastar muda a etapa (`clientes-quadro.ts:120-121`).

| Tipo | O que está diferente | Onde está no código | Proposta |
|---|---|---|---|
| coluna errada | A **coluna direita começa recolhida** (só o trilho "Cliente" na borda); a referência abre com o cliente selecionado à direita (Por que quente, Próxima abordagem, Resumir, Criar tarefa, Abrir conversa, Enviado) | `frontend/telas/clientes.ts:131` (`recolherContexto: !item`, `listaEstreita: true`), decisão da sessão de 07/11 ("espaço do centro") | Decisão do dono: a referência pede três colunas abertas; se ficar recolhida, registrar D-nn e, ao escolher um cartão, abrir a direita |
| medida fora de ±4 px | Lista **280 px** (lista estreita) e quadro 975; referência 340 · 712 · 300 | `clientes.ts:131`; `moldura.ts:122` (`listaEstreita` → 280) | Voltar a 340 quando a moldura for ajustada (seção 2) |
| bloco faltando | Faltam as **taxas entre etapas como 4 números** no topo do quadro (há a linha "Novo → Em atendimento 76%" em chips) e o **"último sinal"** nos cartões ("abriu a seleção 2x") | `clientes-quadro.ts:222-251` (`taxas()`); cartão do quadro | Manter as taxas em chips (cabem) ou KPIs se o centro voltar a 712; acrescentar o último sinal ao cartão (R.8.1 item 7), vindo do `GET /funil/quadro` |
| fora de ordem | A esquerda tem **filtros por temperatura e "sem contato há"** (selects) no lugar da seção "Por temperatura" com contagem e definição em uma linha; não há "Listas salvas" (certo, D-83) | `clientes-quadro.ts:103` | Trocar os selects por chips com contagem e a definição em uma linha (spec P03) |

Comandos:

Comandos da spec conferidos pelo código: **11 OK**, **0 por decisão**, **2 ausentes ou sem funcionar** (abaixo). O detalhe comando a comando, com rota, evento e teste, está no Anexo A.

| Tipo | O que está diferente | Onde está no código | Proposta |
|---|---|---|---|
| comando sem funcionar | Arrastar cartão (muda etapa; motivo se perdido; desfazer 8 s) — só o evento; e sem desfazer 8 s | Sim: `urbi-kanban` `@urbi:kanban-mover` (`frontend/telas/clientes-quadro.ts:253-255` → `mover` `:167-195`); Perdido abre o motivo (`:177-185`); sem desfazer (nenhum "desfazer" no frontend) | Declarar `negocio_etapa_mudou` no manifesto (`campos`: negocio_id, de, para; subir `versao`) e `req.eventos.publicar` em `crm.ts:514`. Desfazer: `urbiVerso.notificar` não tem ação no SDK 100 → pedido ao shell ("toast com ação") ou D-nn dispensando o desfazer (o arrasto de volta já é um gesto) |
| comando ausente | Cartão com último sinal ("abriu a seleção 2x") e aviso de abordagem atrasada — é conteúdo, não botão; R.8.1 item 7, sem decisão | Atrasada sim (`clientes-quadro.ts:203`); último sinal não (cartão mostra título e valor, `:197-206`) | Devolver `ultimo_sinal` no quadro (último item da `linha_do_tempo` do contato, ou cliques de `envios`) e mostrar no cartão |

### 3.3 P04 · Clientes › Lista e ficha (`/clientes?item=:id`)

Visual: lista com Importar e Novo, visões, busca, chips de papel; ficha com avatar, nome, chips, Conversa e Resumir; abas Resumo · Linha do tempo · Enviados · Negócios; direita com Perfil de busca, Portal do cliente, Privacidade. **A referência visual (PNG) e a spec divergem aqui**: a spec 11.1 P04 (D-92, D-106) põe o **histórico na coluna direita** e o cliente no centro; o PNG mostra o histórico como aba do centro e a direita com Perfil de busca, Portal e Privacidade, **como a app faz hoje**. Pela ordem de autoridade vale a spec, mas a referência acabou de ser aprovada como oficial: **pede decisão** (seção 6).

| Tipo | O que está diferente | Onde está no código | Proposta |
|---|---|---|---|
| coluna errada (spec) / igual (PNG) | Histórico como aba "Linha do tempo" no centro; a spec pede na direita | `frontend/telas/ficha-contato.ts` (abas em `?secao=`) | Decisão do dono: spec (histórico à direita) ou PNG (como está). Se spec, atualizar o PNG e o JSON de P04 antes do PR |
| fora de ordem | A ficha abre na aba **Resumo** (Próximo passo e Cadastro em cartões); a referência abre na **Linha do tempo** | `ficha-contato.ts` (aba padrão `resumo`) | Se a decisão for o PNG, abrir em Linha do tempo por padrão |
| bloco faltando | Lista com filtros a mais (Todos · Novos · Sem contato · Quentes · Retorno vencido e dois selects) e as visões como chips, não como alternador segmentado | `frontend/telas/clientes.ts:236-246` (`topoClientes`, `urbi-chips-atalho`), `:261-290` | Manter os filtros prontos (spec P04 os cita); o alternador segmentado não existe como primitivo: registrar lacuna 11.9 |
| medida fora de ±4 px | Busca 36 px (ref 46); botões 25/34 (ref 36/44) | Primitivos (seção 2) | Registrar |

Comandos:

Comandos da spec conferidos pelo código: **21 OK**, **0 por decisão**, **2 ausentes ou sem funcionar** (abaixo). O detalhe comando a comando, com rota, evento e teste, está no Anexo A.

| Tipo | O que está diferente | Onde está no código | Proposta |
|---|---|---|---|
| comando sem funcionar | Gerar / Reenviar link do portal — só o evento | Sim: `frontend/telas/selecoes-cliente.ts:306,310` → `gerarPortal` `:182-187` (copia a mensagem com o link) | Declarar `acesso_cliente_convidado` (só `contato_id`, sem link/token) e publicar em `cliente.ts:184`; ou D-nn: o convite fica só na linha do tempo (nenhum assinante hoje) |
| comando ausente | Portal do cliente: link ativo, último acesso — é dado, não botão; sem decisão | Link e "gerado em": `selecoes-cliente.ts:300-310`; último acesso não (a rota devolve só `ativo, link, criado_em`, `cliente.ts:147-155`) | Gravar `ultimo_acesso_em` em `acessos_cliente` no `wh` do portal (`publico.ts`) e devolver no GET |

### 3.4 P05 · Assistente (coluna direita, `/assistente`)

Visual: abre na coluna direita mantendo lista e centro (D-109); Fechar no topo; campo e Enviar no pé.

| Tipo | O que está diferente | Onde está no código | Proposta |
|---|---|---|---|
| bloco faltando | Sem **chips de perguntas sugeridas** e sem **microfone** no campo; conversa vazia sem exemplo | `frontend/telas/assistente.ts` (`painelAssistente`) | Acrescentar 3 chips de perguntas (as do roteiro R.8.2) e o microfone do `urbi-redator`, se o primitivo do chat aceitar |
| medida fora de ±4 px | Coluna do Assistente 400 px (ref 380); campo 75 px (textarea; ref 46); Enviar 25 px (ref 44) | `moldura.ts:122-123` (`largura-direita` 400 com Assistente); primitivo do chat | Ajustar para 380 com a moldura; o campo é do primitivo |

Comandos:

Comandos da spec conferidos pelo código: **8 OK**, **0 por decisão**, **1 ausentes ou sem funcionar** (abaixo). O detalhe comando a comando, com rota, evento e teste, está no Anexo A.

| Tipo | O que está diferente | Onde está no código | Proposta |
|---|---|---|---|
| comando ausente | Sugestões de perguntas em chips — R.8.1 item 8, plano:450, sem decisão | Não (nenhum chip/sugestão em `assistente.ts`) | Chips fixos por tela (`TELAS_APP` de `comum/assistente.ts` já sabe a tela) acima do chat, que preenchem `perguntar()` |

### 3.5 P06 · Imóveis › Carteira e ficha (`/imoveis?item=:id`)

Visual: abas Carteira · Empreendimentos com total, busca, lista com miniatura, código, preço, situação e nota; ficha com Editar, Criar conteúdo e Mais; Dados; Quem vê; direita com Qualidade, Últimos 30 dias, Clientes que combinam.

| Tipo | O que está diferente | Onde está no código | Proposta |
|---|---|---|---|
| bloco faltando / fora de ordem | A ficha mostra **uma foto redonda de 240 px** e miniaturas redondas de 56 px em vez da grade de fotos (capa + 2 colunas + "+N fotos", 3 × 150 px) | `frontend/telas/ficha-imovel.ts:491-493` (`urbi-avatar` 240/56; exceção nomeada "até haver primitivo de galeria", `:202`) | Grade de miniaturas quadradas com `urbi-grid` + imagem, ou pedido ao shell de primitivo de galeria; a foto redonda é estrutural e deve sair |
| fora de ordem | **Descrição + Melhorar com IA** e **Autorização de venda** ficam abaixo de Dados, em cartões recolhidos; a referência os mostra na primeira dobra | `ficha-imovel.ts:369-444` ("os cartões mostram um resumo e guardam a lista no detalhe, recolhido") | Abrir Descrição e Autorização por padrão na ordem da referência (fotos → dados → descrição → autorização → quem vê) |
| bloco faltando | Sem **filtro de visibilidade** (Públicos · Privados) na lista; sem **Mandato resumido** com "Definir mandato" na direita | `frontend/telas/imoveis.ts:52-53` (só situação); `ficha-imovel.ts` (direita) | Acrescentar o chip de visibilidade e o cartão Mandato quando houver negociação (R.8.1 item 9) |
| medida fora de ±4 px | Qualidade como "50 de 100" com bolinhas, não barra; busca 32 px | Primitivos (`urbi-progresso`?) | Registrar |

Comandos:

Comandos da spec conferidos pelo código: **16 OK**, **2 por decisão**, **3 ausentes ou sem funcionar** (abaixo). O detalhe comando a comando, com rota, evento e teste, está no Anexo A.

| Tipo | O que está diferente | Onde está no código | Proposta |
|---|---|---|---|
| comando sem funcionar | Criar conteúdo (leva a P08 com o imóvel) — parcial): chega a P08 e abre o Novo pedido, mas o imóvel não vai junto (seleção "Imóvel" vazia, `estudio.ts:363`); `docs/imoveis.md:115` documenta só "abre o Estúdio com um post novo" | `frontend/telas/ficha-imovel.ts:483` (ação principal `acoesComMais`, `sub: '/estudio?criar=post'`) | Passar `?criar=post&imovel=<id>` e pré-selecionar em `novoPedido` (um `filtrosDaUrl().get('imovel')` em `estudio.ts:218/363`) |
| comando sem funcionar | Enviar a cliente (`POST /envios`) — botão "Enviar" em Clientes que combinam — parcial): o botão existe e navega, mas não envia; `docs/imoveis.md:43-45` descreve assim ("abre a ficha do cliente") sem D-nn | `frontend/telas/imoveis.ts:372` botão "Enviar" é `href=/clientes/:id` (abre a ficha do cliente) | Em P06, "Enviar" abre `formularioEnviar('POST','/envios')` já com `contato_id` e `imovel_id` (o diálogo de `ficha-contato.ts:521` reaproveitado) e mostra a `mensagem` pronta para colar |
| comando sem funcionar | Mudar visibilidade (`PATCH /imoveis/:id`, evento `imovel.visibilidade_mudou`) — "Quem vê este imóvel" — só o evento | `ficha-imovel.ts:469-471, 519` ação principal "Publicar na página" / "Tirar da página" | Declarar `imovel_visibilidade_mudou` no manifesto (segregado, só `imovel_id` e `publicado`) e publicar em `imoveis.ts:391-395`; ou D-nn que o dispensa |

### 3.6 P07 · Imóveis › Novo imóvel (`/imoveis/novo`) e M3

Visual: 4 passos à esquerda com Salvar rascunho; "Fotos", "Passo 1 de 4", área de envio; direita "Qualidade agora · 0" e a caixa da IA; Voltar / Salvar rascunho / Próximo.

| Tipo | O que está diferente | Onde está no código | Proposta |
|---|---|---|---|
| fora de ordem | O passo 1 pede **Tipo, Cidade e Código antes das fotos**; a referência começa pelas fotos e deixa dados para o passo 2 | `frontend/telas/novo-imovel.ts:651-675` ("obrigatórios no passo Fotos sem rascunho", porque `POST /imoveis` exige tipo e cidade) | Criar o rascunho sem tipo e cidade (backend `imoveis.ts`, `POST /imoveis` aceitando rascunho vazio) e mover os dois campos ao passo 2; ou decisão D-nn mantendo (R.8.1 registra sem decisão) |
| bloco faltando | Sem grade de miniaturas com rótulo de ambiente (Fachada, Sala…) e "Capa sugerida" antes de haver fotos; sem **reordenar** arrastando; no celular, sem **"A IA já entendeu"** nem **"Ditar o resto"** | `novo-imovel.ts:406-465` (ordem só por "pôr como capa"), `:682-690` | Miniaturas com o rótulo que a IA leu (`/imoveis/:id/midias/:midia/analisar` já existe); ditado pelo microfone do `urbi-redator` (R.8.1 item 10) |
| medida fora de ±4 px | Campos 32 px (ref 44); área de envio 160 px | Primitivos | Registrar |

Comandos:

Comandos da spec conferidos pelo código: **13 OK**, **0 por decisão**, **4 ausentes ou sem funcionar** (abaixo). O detalhe comando a comando, com rota, evento e teste, está no Anexo A.

| Tipo | O que está diferente | Onde está no código | Proposta |
|---|---|---|---|
| comando sem funcionar | Salvar rascunho (`POST /imoveis` a cada passo) — só o evento `imovel.criado` | `novo-imovel.ts:637, 818` → `salvarRascunho` `:391-404`; cada passo salva ao sair (`:362-365`) | Declarar `imovel_criado` no manifesto e publicar em `imoveis.ts:190-191` (só `imovel_id`, `codigo`) |
| comando sem funcionar | Passo 4: visibilidade (só eu / público) e Concluir — só o evento `imovel.ativado` | `novo-imovel.ts:773-797` (`escolherOnde` `:508-516`, público só com autorização vigente); Concluir `:819` → `:522-543` | Publicar `imovel_ativado` em `imoveis.ts:391` quando `anunciando` (`:383`) |
| comando ausente | Direita: "Depois de salvar posso: escrever a descrição, montar o pacote de lançamento, avisar N clientes que combinam" — parcial): falta a frase/atalho do pacote | `novo-imovel.ts:851-866`: descrição (`:864`) e N clientes (`:863`, de `GET /imoveis/:id/contexto` `:228`) ✓; "montar o pacote de lançamento" não aparece | Frase + atalho `/estudio?criar=post&imovel=<id>` (mesma correção do Criar conteúdo de P06) |
| comando ausente | Ditar o resto — registrado no plano: "o que falta" item 10 "faltam o ditado por voz e a reordenação das fotos" | Não há (grep `Ditar`/`microfone`/`urbi-redator` em `novo-imovel.ts`: nada; o microfone só existe no Assistente e no Estúdio, `docs/assistente.md:14`, `docs/estudio.md:90`) | `urbi-redator` com microfone no passo Dados → `POST /imoveis/ia` (`imoveis.ts:202`) preenchendo os campos "preenchido pela IA". |

### 3.7 P08 · Estúdio (`/estudio`)

Visual: esquerda com Criar rápido (4 atalhos) e Seus pedidos com filtros por etapa; centro com estado vazio e compositor; direita com Esta semana e Biblioteca. Grande parte do que difere da referência é **por decisão**: arte feita fora do app, sem prévias prontas, sem aprovação por janela, sem créditos (D-86, D-87, D-89 a D-91, D-105).

| Tipo | O que está diferente | Onde está no código | Proposta |
|---|---|---|---|
| fora de ordem | **Criar rápido** são 4 botões pequenos em 2 colunas; a referência tem 4 cartões 2 × 2 com título e subtítulo ("Pacote de lançamento · post + story + carrossel") | `frontend/telas/estudio.ts:380`, `:901-908` | Cartões 2 × 2 (`urbi-grid` + `urbi-card` clicável) com título e subtítulo |
| bloco faltando | O pedido aberto não mostra as **3 prévias** nem os botões **Agendar · Publicar agora · Baixar** lado a lado; a ação principal muda por estado e o resto vai ao "Mais" | `estudio.ts:806-832`, `:601-648` | Manter, por decisão (D-86, D-89 a D-91, princípio 14) |
| bloco faltando | Sem **Créditos do mês** na direita | `estudio.ts:990-998` | Manter, por decisão (D-87) |
| bloco faltando | Faixa amarela "Instagram não conectado" ocupa o topo do centro | `estudio.ts:956` | É o estado obrigatório 11.0.4 (integração desconectada): manter; some com o Instagram configurado na instância (pendência #30) |
| medida fora de ±4 px | Compositor 75 px (ref 46); botões 34 (ref 56–66 nos cartões) | Primitivos | Registrar |

Comandos:

Comandos da spec conferidos pelo código: **17 OK**, **1 por decisão**, **2 ausentes ou sem funcionar** (abaixo). O detalhe comando a comando, com rota, evento e teste, está no Anexo A.

| Tipo | O que está diferente | Onde está no código | Proposta |
|---|---|---|---|
| comando ausente | Publicar agora (cria o contêiner e publica) — OK (comando); eventos de 11.8 ausentes | `estudio.ts:615-633` (Publicar › agora) → `publicar` `:647-663` | Se o dono quiser os `publicacao.*`: declarar e publicar em `instagram.ts:192-196` (só `peca_id`) |
| comando sem funcionar | Baixar (download do arquivo ou pacote, a qualquer momento) — parcial): abre as imagens em abas em vez de baixar, não há "pacote", e não está disponível em todo estado | `estudio.ts:641-645` só pela opção "Baixar a arte e a legenda" do diálogo Publicar (`:619`, peça aprovada/erro); fora disso, "Ver a arte" no Mais `:741` | Botão "Baixar" no cartão em todo estado com arte, por `urbi-visualizador-arquivo` (já usado para fotos da instrução `:797`) ou `<a download>`; pacote (zip com legenda) é rota nova |

### 3.8 P09 · Página (`/pagina`)

Visual: esquerda com endereço, estado, blocos com Mostrar e setas, "Refazer a página com IA"; centro com Celular · Computador e a prévia; direita com o bloco escolhido, Marca, Últimos 30 dias, Copiar link. **Publicar** existe (`pagina.ts:329`) e só aparece quando há o que publicar.

| Tipo | O que está diferente | Onde está no código | Proposta |
|---|---|---|---|
| coluna errada | Os **ajustes do bloco** abrem em diálogo ("Editar bloco"); a referência os mostra na coluna direita (campos do bloco) | `frontend/telas/pagina.ts` (direita: resumo + Editar bloco); pendência B7 no plano | Editar na própria coluna direita (formulário do bloco) |
| medida fora de ±4 px | Prévia Celular com **390 px sem moldura**; referência: 300 px com borda e cantos arredondados | `frontend/telas/previa-pagina.ts`; `pagina.ts:26-40` | Largura 300 e borda na `pc-previa-pagina` (exceção nomeada `pc-previa-pagina` já existe) |
| bloco faltando | Blocos com **setas ↑↓** em vez de arrastar | `pagina.ts` (lista de blocos) | Manter, por decisão (exceção 11.9 do B7) |
| medida fora de ±4 px | "Visitas —" porque não são medidas | pendência B7 | Manter até haver fonte |

Comandos:

Comandos da spec conferidos pelo código: **14 OK**, **0 por decisão**, **1 ausentes ou sem funcionar** (abaixo). O detalhe comando a comando, com rota, evento e teste, está no Anexo A.

| Tipo | O que está diferente | Onde está no código | Proposta |
|---|---|---|---|
| comando sem funcionar | Publicar — só o evento | `pagina.ts:326-329` (só enquanto não está no ar; desabilitado até a página ser salva `?desabilitado=${!v.salva}`) | Declarar `pagina_publicada` (só `endereco`) e publicar em `pagina.ts:184`; ou D-nn dispensando |

### 3.9 P10 · Números (`/numeros`)

Visual: lista de relatórios com descrição; centro com período (7 · 30 · 90 · 12 meses), Comparar, Origem, KPIs, gráfico; direita com "O que melhorar" + "Ver os N clientes", Melhores origens, Exportar CSV.

| Tipo | O que está diferente | Onde está no código | Proposta |
|---|---|---|---|
| fora de ordem | Abre no relatório **Resumo** (Leads · Conversão · Vendas · Comissão); a referência e a spec (`?relatorio=funil`) abrem em **Funil e conversão** (Contatos · Contato → visita · Visita → proposta · Ganhos, "Até onde os contatos chegaram", Contatos por horário, Por que perdemos). Esses blocos existem no relatório Funil | `frontend/telas/desempenho.ts:35-36`, `:66-68` (padrão `RELATORIOS[0]` = resumo), `:215-270` | Padrão `funil`, ou decisão D-nn mantendo Resumo como primeiro |
| medida fora de ±4 px | Comparar é botão-alternar; KPIs em 28 px batem | `desempenho.ts:177` | Igual |

Comandos:

Comandos da spec conferidos pelo código: **13 OK**, **1 por decisão**, **1 ausentes ou sem funcionar** (abaixo). O detalhe comando a comando, com rota, evento e teste, está no Anexo A.

| Tipo | O que está diferente | Onde está no código | Proposta |
|---|---|---|---|
| comando ausente | Custo por lead / por venda (11.2) e `GET/PUT /custos-origem` "Investimento por canal/mês — Números" (seção 7, linha 838) — não está na prosa de P10, só na seção 7 e na 11.2 | Não há botão nem campo para informar investimento | Decidir se entra na 1.2 (campo na direita de Origem dos contatos) ou vai ao horizonte; registrar D-nn |

### 3.10 P12 · Ajustes › Conexões (`/ajustes/conexoes`)

Visual: menu de Ajustes à esquerda com as 7 seções; cartões Instagram, WhatsApp, Agenda; direita "Por que conectar aqui" e Assistente.

| Tipo | O que está diferente | Onde está no código | Proposta |
|---|---|---|---|
| bloco faltando | Cartão WhatsApp sem os **3 passos numerados**; "ainda não disponível" | `frontend/telas/conexoes.ts:16-17` | Manter, por decisão (D-59, D-78) até o bloco 6 |
| bloco faltando | Instagram "não configurado pela equipe da plataforma" na instância; sem "Conectado · Desconectar · **Testar publicação**" | `conexoes.ts:130-140`; pendência #30 | Configurar as credenciais da app Meta na homologação (dono); acrescentar "Testar publicação" (R.8.1 item 12) |
| bloco faltando | Itens do menu de Ajustes sem a **linha de estado** ("ligado · texto", "WhatsApp e Instagram") | `frontend/telas/ajustes.ts:27-61` | Acrescentar a linha secundária a cada item |

Comandos:

Comandos da spec conferidos pelo código: **5 OK**, **3 por decisão**, **2 ausentes ou sem funcionar** (abaixo). O detalhe comando a comando, com rota, evento e teste, está no Anexo A.

| Tipo | O que está diferente | Onde está no código | Proposta |
|---|---|---|---|
| comando sem funcionar | Conectar Instagram (login do Instagram, D-75) — só o evento) — a conexão funciona; falta o evento auditável que a spec 13.1 pede | Sim: `conexoes.ts:145` (botão); `conectar()` `:82-100` gera `state`, chama a rota e vai para a Meta; volta tratada em `iniciar()` `:38-70` (`?code=&state=`) | Declarar `canal_conectado` (`auditavel`) no manifesto (sobe `versao`) e publicar em `instagram.ts` após `dados.criar('canais_sociais', …)` (`:258-262`), só com ids; ou registrar D-nn adiando a trilha auditável |
| comando sem funcionar | Desconectar — só o evento); além disso sem teste de backend | Sim: `conexoes.ts:141`; `desconectar()` `:102-113` com confirmação | Mesma proposta do evento; acrescentar em `instagram.test.ts` um caso "desconectar apaga o token e `GET /conexoes` volta `null`" |

### 3.11 P13 · Ajustes › Conta e marca (`/ajustes/conta`)

Visual: menu de Ajustes; centro com Seus dados, Conta, Sua marca, Referências; direita com ajuda e o aviso do CRECI.

| Tipo | O que está diferente | Onde está no código | Proposta |
|---|---|---|---|
| fora de ordem | **Edição por diálogo** (lápis em cada cartão) em vez do formulário na tela com **Salvar** | `frontend/telas/conta.ts:76-103` (`editar(...)` abre diálogo) | Formulário na tela (Seu perfil e Sua marca) com Salvar, como a referência; ou D-nn mantendo (R.8.1 registra sem decisão) |
| bloco faltando | Sem **Regiões que atende** e **Tom de voz** (há "Estilo" da marca, que é outra coisa) | `conta.ts:76-88`; `frontend/telas/marca.ts:28` | Acrescentar os dois campos (perfil e marca) |
| bloco faltando | Sem **Plano, créditos e tabela de créditos por ação** na direita | — | Manter, por decisão (D-87) |
| medida fora de ±4 px | Sem campos na tela para medir (são do diálogo) | — | — |

Comandos:

Comandos da spec conferidos pelo código: **15 OK**, **6 por decisão**, **1 ausentes ou sem funcionar** (abaixo). O detalhe comando a comando, com rota, evento e teste, está no Anexo A.

| Tipo | O que está diferente | Onde está no código | Proposta |
|---|---|---|---|
| comando ausente | Seu perfil: nome profissional | Só leitura do nome do usuário do shell (`frontend/telas/conta.ts:128`, `urbiVerso.usuario()?.nome`); sem campo editável; o backend de `meu-perfil` só aceita `creci` e `telefone` (`comum/conta.ts:110-121`) | Decidir se o nome do shell basta (D-nn) ou criar `nome_profissional` em `perfis_corretor` (sobe `versao`) |

### 3.12 P14 · Clientes › Importar (`/clientes/importar`)

Visual: fontes à esquerda; centro com origem da planilha e área de envio; direita com repetidos e consentimento. A referência mostra o estado **com arquivo carregado** (mapeamento e prévia); a captura está sem arquivo, porque enviar um CSV seria escrita na instância.

| Tipo | O que está diferente | Onde está no código | Proposta |
|---|---|---|---|
| fora de ordem | Repetidos como **chips** (Pular · Completar · Substituir); referência: rádios com explicação de uma linha | `frontend/telas/importar.ts:24-26` | Rádios com a explicação (os textos já existem) |
| bloco faltando | **vCard** e **Outro CRM** "em breve" (a spec põe vCard no MVP) | `importar.ts:132-134` | Decisão: implementar vCard no PR da tela ou registrar adiamento D-nn (R.8.1 item 13) |
| medida fora de ±4 px | Área de envio 120 px; botões 34 | Primitivos | Registrar |

Comandos:

Comandos da spec conferidos pelo código: **7 OK**, **2 por decisão**, **2 ausentes ou sem funcionar** (abaixo). O detalhe comando a comando, com rota, evento e teste, está no Anexo A.

| Tipo | O que está diferente | Onde está no código | Proposta |
|---|---|---|---|
| comando sem funcionar | Importar N contatos — só o evento) — a importação funciona; falta `contatos.importados` | Sim: `importar.ts:268`, `importar()` `:196-219` (exige coluna do nome, limite 2000 linhas `:17`, aviso de 100 kB `:261-266`) | Declarar `contatos_importados` (`segregado_por_conta`, só contagens e `origem_id`, sem dado pessoal) e publicar em `crm.ts:286` antes do `res.json`; ou D-nn dizendo que a linha do tempo basta |
| comando ausente | Relatório final: criados, unidos, rejeitados (baixável, 12.1) — só o "baixável" | Relatório na tela (`importar.ts:271-279`, tabela de rejeitados); sem botão para baixar | Botão "Baixar relatório" que gera CSV das rejeitadas no navegador (como `exportarCsv` de Números) |

### 3.13 P15 · Clientes › Negociações, P16 · Mandato e M8

Visual: Nova proposta e os 6 filtros batem. **Estado vazio** na conta de QA: o centro mostra "Escolha uma negociação" e a direita recolhida ("Mandato" na borda). Faixa, escada, última fala, cartão "Negociador sugere", Assumir/Devolver, Mandato com recuo mascarado e Leitura do comprador existem no código (`negociacoes.ts:457-547`); P16 abre em `urbi-modal` (`mandato.ts`, pedido 10). **Não dá para comparar a forma sem uma conta "(demo)".**

| Tipo | O que está diferente | Onde está no código | Proposta |
|---|---|---|---|
| coluna errada | Direita começa **recolhida** sem item; a referência abre com o Mandato à direita e a primeira negociação selecionada | `frontend/telas/clientes.ts:178` (`recolherContexto: !item`) | Selecionar a primeira negociação ao abrir sem `?item=` (como a referência) e abrir a direita |
| bloco faltando | Faixa ZOPA desenhada em marcas de texto (sem régua) | `negociacoes.ts:433-470` (lacuna 11.9, pedido ao shell 13) | Manter, por decisão, até o primitivo |
| bloco faltando | P16 em `urbi-modal`, não em gaveta; autonomia como lista, não seletor de 3 posições | `frontend/telas/mandato.ts` (pedidos 10 e 12) | Manter, por decisão |
| bloco faltando | M8 não é tela própria: é a P15 em abas Negociações · Negociação · Mandato; sem a barra fixa Enviar · Editar · Assumir no pé | `moldura.ts` (abas do `urbi-3-colunas` no celular); `negociacoes.ts` | Decisão: aceitar as abas (11.0.3) e pôr os três botões no fim da aba Negociação |
| a conferir | Forma da faixa, da escada e do cartão de sugestão contra o PNG | — | Repetir a captura com a conta "(demo)" |

Comandos:

Comandos da spec conferidos pelo código: **14 OK**, **5 por decisão**, **5 ausentes ou sem funcionar** (abaixo). O detalhe comando a comando, com rota, evento e teste, está no Anexo A.

| Tipo | O que está diferente | Onde está no código | Proposta |
|---|---|---|---|
| comando ausente | Registrar decisão (Aceita · Recusa · Contraproposta do proprietário) | Não há botão (grep `proprietario`/`decisão` em `frontend/telas`: só leitura de estado em `negociacoes.ts:531,604,696`); com a negociação em `aguardando_proprietario` o cartão só diz "O acordo está com o proprietário" (`:701`) | Depois de "Passar ao proprietário" a tela não tem saída: nem decisão nem encerramento (linha abaixo). Botão "Registrar decisão do proprietário" no Próximo movimento (aceita → `PATCH /negociacoes/:id {estado:'ganha', valor_final_c}`; recusa → proposta recusada e estado de volta; contraproposta → `POST /propostas direcao proprietario`) e evento `proposta_decidida` no manifesto. |
| comando ausente | Encerrar (ganho gera comissão prevista · perdido com motivo) | Não há botão (grep `Encerrar`, `'ganha'`, `valor_final`, `motivo_perda` em `frontend/telas`: só leitura de estado) | Botão "Encerrar" no menu "mais" do cabeçalho chamando a rota que já existe. `docs/negociacao.md:146-149` descreve o encerramento sem dizer por onde se faz. |
| comando sem funcionar | **Enviar pelo portal** e **Fazer agora** só existem como aprovação ou edição de uma sugestão pendente do Negociador; o corretor não consegue mandar uma contraproposta própria sem sugestão (IA indisponível ou conduzindo sozinho): `POST /negociacoes/:id/propostas` com `canal` diferente de `registro` responde `422 CANAL_INDISPONIVEL`; Editar também só sai pelo portal | `backend/negociacao.ts:566-569`; `frontend/telas/negociacoes.ts:249,270` (canal fixo) | Aceitar `canal: portal` e `wa_me` com `direcao: vendedor` na rota (validando 10.9.7) e dar ao corretor os dois botões fora do cartão de sugestão |
| comando sem funcionar | Depois de "Passar ao proprietário" a negociação fica em `aguardando_proprietario` **sem saída na tela**: não há Registrar decisão (nem `PATCH /propostas/:id` nem `proposta_decidida`) nem Encerrar, embora `PATCH /negociacoes/:id` (ganha/perdida) exista e tenha teste só por API; o aviso de M8 em Hoje leva à ficha do cliente, não à negociação | `backend/negociacao.ts:355-413`; `testes/negociacao.test.ts:169-172`; `inicio.ts:213-215` | Botões Registrar decisão e Encerrar no cabeçalho de P15 (direita), ligados às rotas; aviso de Hoje abrindo `?visao=negociacoes&item=` |
| comando ausente | Bloco 3 · Prazo: validade do mandato e de cada contraproposta — parcial; registrado no plano, "o que falta" item 14 | validade do mandato `mandato.ts:232`; validade por contraproposta: sem campo (`validarMandato` só aceita `validade`, `comum/negociacao.ts:141`; a validade da contraproposta vem de `validade_horas` sugerido pelo modelo ou digitado na edição, `backend/negociador.ts:583`) | Campo "validade padrão de cada contraproposta (h)" no mandato, usado quando o modelo/edição não informa. |
| comando ausente | Bloco 4 · Autonomia: Negociador IA ou humano (escolher a pessoa, D-108) — no modal (efeito existe em P15; registrado no plano, item 14: "a D-108 … não justifica essa troca" | `mandato.ts:236-241`: select só "Negociador IA" / "Você (corretor)"; `humano` aparece como texto fixo `:237`. Escolher a pessoa é no cartão "Quem negocia" de P15 (`negociacoes.ts:603-672`) | Ou pôr o seletor da pessoa no bloco 4, ou registrar D-nn de que a escolha fica no cartão Quem negocia. |
| comando ausente | P16 "sobre P06" (mandato resumido na ficha do imóvel) — registrado no plano | não há em `imoveis` (plano "o que falta" item 9) | — |

### 3.14 P17 · Ajustes › Negociador (`/ajustes/negociador`)

Visual: menu de Ajustes; centro com 1 Quando entra, 2 Quem negocia, 3 Estilo, 4 Regras fixas, 5 Instruções, 6 Objeções; direita com "O que é o Negociador", 7 Testar, Números do mês.

| Tipo | O que está diferente | Onde está no código | Proposta |
|---|---|---|---|
| fora de ordem / medida | As 6 seções saem em **uma coluna** (cartões de 557 px); a referência tem 1 e 2 lado a lado, 4 e 5 lado a lado, 6 embaixo | `frontend/telas/negociador-ajustes.ts:263` (`urbi-grid min="320px"`: com o centro em 589 px cabe 1 por linha; em 712 cabem 2) | Resolve-se com a moldura (seção 2); se o centro não voltar a 712, `min="260px"` |
| fora de ordem | "Ligado · Pausar" vira um **interruptor** dentro da seção 2; a referência o põe no cabeçalho do centro | `negociador-ajustes.ts:272-281` | Mover o interruptor ao cabeçalho da coluna central |
| fora de ordem | **Estilo** como lista com "Usar"; referência: 3 cartões selecionáveis com exemplo | `negociador-ajustes.ts:282-291` | 3 cartões em `urbi-grid` com o exemplo e o estado "em uso" |
| fora de ordem | **7 Testar** é um formulário de valores (pedido, alvo, recuo, oferta, teto, fala) e um botão; a referência é a conversa simulada com a resposta e "não revelou o recuo" | `negociador-ajustes.ts` (bloco Testar) | Mostrar a resposta do `/negociador/teste` como bolhas e o selo de sigilo |
| medida fora de ±4 px | Campos 32–36 (ref 40–46); textarea 144 (ref 160) | Primitivos | Registrar |

Comandos:

Comandos da spec conferidos pelo código: **11 OK**, **1 por decisão**, **1 ausentes ou sem funcionar** (abaixo). O detalhe comando a comando, com rota, evento e teste, está no Anexo A.

| Tipo | O que está diferente | Onde está no código | Proposta |
|---|---|---|---|
| comando sem funcionar | Auditoria: evento `negociador.config_alterada` (auditável) — só o evento | — | Declarar `negociador_config_alterada` (só ids/campos mudados) e publicar no PUT; `auditavel: true`. |

### 3.15 M1 · Hoje (celular, 390 × 844)

| Tipo | O que está diferente | Onde está no código | Proposta |
|---|---|---|---|
| fora de ordem | A app mostra a barra **"Menu"** e as abas **Hoje · Fila · Agenda**, abrindo na Fila; a referência abre em "Precisa de você" seguido da fila, numa só rolagem | `frontend/moldura.ts:58-60`, `:132-139` (abas do `urbi-3-colunas` no celular, 11.0.3) | Decisão: aceitar as abas (spec 11.0.3) e abrir na aba Hoje (esquerda), não na Fila; ou juntar Precisa de você e Fila numa aba |
| bloco faltando | Falta a **linha de atalhos do dia** (Conversas · Criar · Imóveis · Assistente) no pé ou no topo | `inicio.ts` (não existe); spec 11.5 | Acrescentar a linha com `urbi-botao` grandes (52 px) quando a largura for ≤ 900 (R.8.1 item 4) |
| fora de ordem | **Criar** no cabeçalho do shell, não na linha de atalhos | `index.ts:239` | Idem seção 2 |
| medida fora de ±4 px | Botões dos cartões 34 px (ref 44); alvos de toque ≥ 44 só no cartão inteiro | Primitivos | Registrar |

Comandos:

Comandos da spec conferidos pelo código: **3 OK**, **1 por decisão**, **1 ausentes ou sem funcionar** (abaixo). O detalhe comando a comando, com rota, evento e teste, está no Anexo A.

| Tipo | O que está diferente | Onde está no código | Proposta |
|---|---|---|---|
| comando ausente | Linha de atalhos do dia no topo: Criar · Clientes · Imóveis · Assistente (Conversas com selo) — registrado no plano: "o que falta" item 4 e R.8 "M1 abas e sem atalhos do dia" | Não há (grep "atalhos do dia"/`urbi-chips-atalho` em `moldura.ts`, `inicio.ts`, `index.ts`: nada). No celular o trilho vira o botão "Menu" do `urbi-inbox` (`frontend/moldura.ts:136-139`) e as colunas viram abas Hoje · Fila · Agenda (`inicio.ts:342`, `moldura.ts:125`) | Linha de botões/chips no topo do centro só ≤ 900 px (Criar, Clientes, Imóveis, Assistente). |

### 3.16 M4 · Portal do Cliente e M5 · Imóveis (página pública por token)

Visual: "Meu atendimento", abas Conversa · Imóveis · Agenda · Arquivos (+ Propostas quando há negociação), campo "Escreva para o corretor". As reações Gostei · Não gostei · Quero visitar · Conversar sobre o preço existem (`publico/selecao.ts:42-45`), assim como a faixa "Próximo passo" (`:229`, só quando há um). **M5 não comparável** nesta conta: o portal não tem imóveis enviados.

| Tipo | O que está diferente | Onde está no código | Proposta |
|---|---|---|---|
| fora de ordem / medida | O topo é uma **capa azul de ~300 px** com nome, CRECI e "Falar no WhatsApp"; a referência tem uma barra de 60 px ("Meu atendimento" + avatar) e a faixa verde "Próximo passo · Ver" | `frontend/publico/selecao.ts` (topo), `publico/estilo.ts` | Reduzir a capa à barra de 60 px (nome + avatar) e deixar a faixa "Próximo passo" logo abaixo; a spec 11.3 pede "foto e nome do corretor e botão WhatsApp" no topo: cabe numa linha |
| bloco faltando | A aba **Conversa** mostra "Histórico" (marcos) e um formulário grande; a referência mostra mensagens, cartão de imóvel enviado e o compositor de uma linha com botão redondo | `selecao.ts:554-577` | Compositor de uma linha no pé; mensagens e cartões quando houver fonte (D-73: no MVP a mensagem vira item da linha do tempo; R.8.1 item 15) |
| cor ou fonte fora do tema | A capa usa a **cor da marca** do corretor (azul), não o verde da referência | `publico/estilo.ts` (marca como dado, D-85) | Manter, por decisão (D-85, exceção #170) |
| medida fora de ±4 px | Campo 96 px (textarea; ref 46); botão 48 | CSS próprio da página pública | Ajustar no CSS próprio (não há primitivo aqui) |

Comandos (entrada pelo `wh` do portal):

Comandos da spec conferidos pelo código: **22 OK**, **1 por decisão**, **0 ausentes ou sem funcionar** (abaixo). O detalhe comando a comando, com rota, evento e teste, está no Anexo A.

### 3.17 M6 · Página pública (`/p?c=<endereço>`)

| Tipo | O que está diferente | Onde está no código | Proposta |
|---|---|---|---|
| fora de ordem | A capa traz o **texto de apresentação e o @instagram** dentro dela; a referência tem só avatar, nome, linha do CRECI e o botão WhatsApp, e a apresentação vem como bloco | `frontend/publico/pagina-publica.ts:64-65` (capa), bloco `apresentacao` | Capa só com nome, linha e botão; apresentação como primeiro bloco abaixo |
| fora de ordem | No cartão do imóvel o **preço fica acima do título** e não há o botão **"Quero saber mais"** na linha do preço (a referência põe título, linha de dados, preço à esquerda e o botão à direita) | `pagina-publica.ts` (método `cartao()`) | Reordenar o cartão e trazer o botão (a spec M6 o exige: abre o WhatsApp com o imóvel citado) |
| bloco faltando | Título do bloco "Destaques da semana" (dado da conta) e sem "Imóveis em destaque" fixo | `pagina-publica.ts:273` (`b.titulo || 'Imóveis em destaque'`) | É dado: manter |
| cor ou fonte fora do tema | Cor da marca (azul) em vez do verde da referência | `publico/estilo.ts` (D-85) | Manter, por decisão |

Comandos:

Comandos da spec conferidos pelo código: **6 OK**, **0 por decisão**, **0 ausentes ou sem funcionar** (abaixo). O detalhe comando a comando, com rota, evento e teste, está no Anexo A.

### 3.18 Achados transversais dos comandos (valem para várias telas)

| Tipo | O que está diferente | Onde está no código | Proposta |
|---|---|---|---|
| comando sem funcionar (evento) | **Nenhum dos eventos "das telas do Padrão B" da spec 13.1 está no manifesto**: `negocio.etapa_mudou`, `acesso_cliente.convidado`, `atividade.criada`, `visita.agendada`, `envio.criado`, `imovel.criado`, `imovel.ativado`, `imovel.visibilidade_mudou`, `pagina.publicada`, `contatos.importados`, `canal.conectado`, `canal.desconectado`, `negociador.config_alterada`, `proposta.decidida`, `selecao.reagida`, `visita.pedida`, `mensagem.recebida`. Os comandos funcionam e gravam na linha do tempo, mas sem evento. Os 19 eventos do manifesto cobrem lead, link, reação, portal, publicação, lembrete e negociação | `apps/portal_corretor/manifesto.json` (`eventos`); `backend/crm.ts:286,514`, `cliente.ts:182`, `imoveis.ts`, `estudio.ts`, `pagina.ts`, `instagram.ts:258-280`, `negociacao.ts` (sem `req.eventos.publicar`) | Decisão do dono: um bloco só de eventos (declarar no manifesto com `segregado_por_conta`, publicar nas rotas, subir `versao`) antes ou depois das telas; ou D-nn aceitando a linha do tempo como registro suficiente no MVP |
| comando sem funcionar (auditoria) | Nenhum evento do manifesto tem a flag `auditavel`; `mandato_alterado` é publicado sem trilha; `negociador.config_alterada`, `canal.conectado/desconectado` e `mensageiro.permissoes_alteradas` não existem | `manifesto.json` | Entra no mesmo bloco de eventos |
| comando ausente | **Desfazer por 8 s** (11.0.6: mover etapa, arquivar, revogar link) não existe em tela alguma; o SDK 100 não tem notificação com ação | `frontend/` (nenhum "desfazer") | Pedido ao shell (notificação com ação) ou D-nn adiando |
| comando sem funcionar | Atalho **`E`** edita o item aberto em vez de "enviar sugestão aceita" | `frontend/atalhos.ts:41` | Trocar o efeito ou registrar D-nn (B10 anotou sem decisão) |
| comando ausente | Endereços `/hoje` e `/inicio` não existem (Hoje é `/`); P08 usa `?item=`/`?pedido=`/`?etapa=` em vez de `?peca=` | `frontend/enderecos.ts:21-58` | Acrescentar os apelidos |
| estados 11.0.4 | Pequenos desvios: P10 sem esqueleto na direita ao carregar; P12/P13 mostram 403/404 como faixa genérica em vez de "Não encontrado" (D-40); P14 sem "Tentar de novo"; na ficha do imóvel os botões de IA **somem** em vez de ficarem desabilitados com a dica; a Página não sonda o `estadoSlot` e "Refazer com IA" só avisa depois do clique | `desempenho.ts:450-451`; `ajustes.ts`; `importar.ts`; `ficha-imovel.ts:523-546`; `pagina.ts:242` | Corrigir no PR de cada tela |
| sem teste | `POST /conexoes/instagram/desconectar` (só com API simulada), `POST /funil/playbook`, `POST /pagina/atualizar`, o "resolver" de O que falta (P06), o `baixar` do Estúdio; CSV de Números sem o relatório Negociação | `testes/` | Cobrir no PR de cada tela |

## 4. Telas da referência que ainda não existem na app

| Tela | Referência | Por que não existe | O que já há no código | Dependência |
|---|---|---|---|---|
| **P02 · Conversas** | `P02-Conversas.png`, 143 nós | WhatsApp (blocos 6 e 7): pedidos ao shell 1 e 2 (P-31/P-32) não atendidos pelo SDK 100 (D-59, D-78) | **Nada de conversa:** o `schema.json` não tem tabela de conversas nem de mensagens (38 tabelas; as mais próximas são `envios`, `linha_do_tempo`, `tarefas_cliente` e `acessos_cliente`); não há rota `/conversas` nem tela. "Conversas" não está no trilho (D-103) | Decisão de produto para o piloto: ver 6.3 |
| **P11 · Ajustes › Mensageiro** | `P11-Mensageiro.png`, 161 nós | Bloco 7 (Mensageiro), preso ao WhatsApp | Item "Mensageiro" no menu de Ajustes com a explicação "chega com a conexão do WhatsApp" (`ajustes.ts:27-61`); nenhuma rota `/mensageiro` | Blocos 6 e 7 |
| **M2 · Conversa (celular)** | `M2-Conversa.png` | Idem P02 | — | Idem P02 |
| **M7 · Portal do Proprietário** | `M7-Proprietario.png` | Fase 3 (spec 11.3) | A aba Propostas do portal (M5b) e `vitrine_publica`; nada do proprietário | Fase 3 |
| **M5 · Portal › Imóveis** (existe, não comparada) | `M5-Portal-imoveis.png` | A conta de QA não tem imóveis enviados ao portal | `publico/selecao.ts:582` (aba Imóveis com Gostei, Não gostei, Quero visitar, Conversar sobre o preço) | Conta "(demo)" |
| **P16 · Mandato** (existe, não capturada) | `P16-Mandato.png` | Abre sobre uma negociação; não há nenhuma na conta de QA | `frontend/telas/mandato.ts` (`urbi-modal`, 4 blocos) | Conta "(demo)" |

## 5. Ordem proposta para as correções

Grupos de 3 a 4 telas, cada um num PR (ou um por tela se ficar grande), sempre com PNG e `.layout.json` aprovados antes e a conferência da seção 6 do contrato no PR. **Antes do grupo 1, as decisões da seção 6 (moldura, primitivos, P04), porque mudam a referência de todas as telas.**

| Grupo | Telas | Por quê nesta ordem | O que precisa antes |
|---|---|---|---|
| **1 · Piloto** | **P02 Conversas** (computador) + **moldura comum** (seção 2) | P02 é a tela mais completa do Padrão B (lista com busca e chips, cabeçalho de conversa, mensagens, ações rápidas, compositor, contexto com próxima abordagem e enviados): o que se decidir e construir nela (larguras, cabeçalho de coluna, item de lista, chips, busca, compositor) vira o molde das outras. Como não há WhatsApp, o piloto é a **tela e o esqueleto de dados**, não a integração: ver 6.3 | Decisões 6.1 a 6.3; schema de conversas e mensagens (sobe `versao`) ou dados só de demonstração |
| **2 · Núcleo do dia** | P01 Hoje + M1, P03 Funil, P04 Cliente | São as telas que o corretor abre todo dia e as que mais têm bloco faltando (Assumir, Agora não, abas Hoje · Agenda, atalhos do dia, direita recolhida, último sinal, histórico) | Decisão 6.4 (P04) |
| **3 · Imóveis e negociação** | P06 Imóveis, P07 Novo imóvel + M3, P15 Negociações + P16 + M8 | Compartilham a semente (imóveis e a negociação da Ana) e a decisão do fluxo do passo 1; P15/P16/M8 só se conferem com a conta "(demo)" | Conta "(demo)" na homologação (6.5) |
| **4 · Público e conteúdo** | P08 Estúdio, P09 Página, M6 Página pública, M4 + M5 Portal | Mesma família (marca, CSS próprio das páginas públicas, prévia da Página); a maior parte do Estúdio é "por decisão" e o PR é pequeno | Instagram configurado na homologação (#30) para comparar os estados conectados |
| **5 · Ajustes e números** | P10 Números, P12 Conexões, P13 Conta e marca, P14 Importar, P17 Negociador, P05 Assistente | Diferenças de ordem e forma (relatório padrão, formulário na tela, grade 2 colunas, Testar como conversa, chips de perguntas); poucas de bloco faltando. P17 depende da largura do centro (grupo 1) | — |
| Fora | P11, M2 (blocos 6 e 7), M7 (fase 3) | Esperam o WhatsApp e a fase 3 | — |

## 6. Dúvidas para o dono, antes das etapas 3 e 4

1. **Moldura: página do shell ou página cheia?** Hoje a app vive dentro da `urbi-shell-page` (barra + cabeçalho + 24 px de margem): o conteúdo começa 130 px abaixo da referência, Criar fica no cabeçalho e o trilho não tem Criar nem avatar. Ou isso vira decisão D-nn (e **os 17 PNG do computador precisam ser regenerados** com a moldura do shell, para a conferência ±4 px fazer sentido), ou abre-se um pedido ao shell de modo "página cheia" e as telas esperam. Sem essa decisão, nenhuma tela passa na conferência de altura.
2. **Primitivos:** `urbi-botao` 34/25 px (contrato 44/36), campos 32–36 (contrato 44), raio 12 (contrato 14), peso 800 inexistente. Aceitar como D-nn ("o primitivo manda") ou pedir ao shell tamanhos novos? Até lá, cada PR de tela repete a mesma tabela.
3. **P02 como piloto sem WhatsApp:** não há tabela de conversas nem de mensagens, nem rota `/conversas`. O piloto pode ser (a) a tela com **dados de demonstração** só na conta "(demo)" (sem schema novo), (b) a tela **com schema** de `conversas` e `mensagens` alimentado pelas mensagens do portal (D-73 já diz que a mensagem do cliente vira item da linha do tempo) e pelo "Fazer agora", deixando o WhatsApp para o bloco 6, ou (c) só a moldura e o estado vazio. A (b) muda escopo e `versao`; a (a) não entrega nada funcional. Qual?
4. **P04: a spec (D-92/D-106, histórico na coluna direita) e a referência visual aprovada (histórico como aba do centro, direita com Perfil de busca, Portal e Privacidade) divergem.** Qual vale? Se a spec, o PNG e o JSON de P04 precisam mudar antes do PR; se o PNG, a spec ganha uma D-nn.
5. **Conta "(demo)" na homologação:** criar uma conta cujo nome termine em "(demo)" (com um usuário externo corretor) e reiniciar a app, para a semente do guia entrar. Sem isso, P15, P16, M5 e M8 não têm como ser conferidas, e P01/P03/P04 ficam com dados que não são os do mockup. Posso criar a conta pela API (alçadas `contas` e `usuarios`), mas o boot da app depende de quem tem a alçada `sistema`.
6. **Decisões já registradas que contradizem a referência** (Estúdio sem prévias e sem créditos, D-86 a D-91; Página com setas, 11.9; P16 em modal, pedido 10; faixa sem régua, pedido 13; WhatsApp "ainda não disponível", D-78): a conferência vai sempre marcá-las como "por decisão". Vale atualizar os PNG dessas telas para o que foi decidido, ou a referência fica como alvo futuro?
7. **Instagram na homologação (#30) e app 0.1.45:** sem as credenciais da app Meta, P12 e P08 só mostram o estado desconectado; e a instância está um release atrás da `main`.

## Anexo A · Conferência de comandos, comando a comando

Produzida por quatro frentes de leitura de código em paralelo (grupo A: P01, P03, P04, P05 e 11.7; B: P06 a P09; C: P10, P12, P13, P14; D: P15 a P17, celular e portal), só com leitura de código, docs e testes: nada foi executado na instância. Colunas: comando da spec · rota e evento na spec · existe na tela (arquivo:linha) · rota que a tela chama · rota no backend · evento publicado · teste · estado · proposta.

### Grupo A · P01, P03, P04, P05 e comandos globais

Diagnóstico só por leitura de código, docs e testes (branch `docs/diagnostico-visual`, app 0.1.45). Caminhos relativos a `apps/portal_corretor/` salvo quando dito. Rotas do backend são relativas (servidas em `/api/portal_corretor/…`).

**Convenções usadas nas tabelas**
- **Evento**: nome da spec traduzido para sublinhado e conferido com os 19 eventos do `manifesto.json` (`lead_recebido`, `link_clicado`, `reacao_recebida`, `acao_cliente_recebida`, `publicacao_programada`, `lembrete_visita`, `negociacao_iniciada`, `proposta_recebida`, `proposta_aceite_cliente`, `proposta_registrada`, `mandato_alterado`, `negociacao_encerrada`, `negociacao_limite_atingido`, `objecao_detectada`, `contraproposta_sugerida`, `contraproposta_enviada`, `negociacao_acordo_proposto`, `negociacao_assumida`, `negociacao_devolvida`). O que não está lá é "não (sem evento no manifesto)".
- **Estado**: seguindo o brief à risca, um comando cujo botão e rota funcionam mas cujo evento da spec não é publicado entra como **comando sem funcionar (só o evento)**; no resumo esses são contados à parte. **Por decisão** só quando há D-xx, pedido ao shell ou exceção nomeada; o que está na lista "divergências sem decisão" da R.8.1 (`specs/plano_de_implementacao.md:440-460`) é citado, mas conta como ausente/sem funcionar, porque ainda espera o dono.
- Linha "Teste" cita o arquivo em `testes/`.

---

#### P01 · Hoje (spec 1360–1378)

| Comando (spec) | Rota e evento na spec | Existe na tela? | Rota que a tela chama | Rota no backend | Evento publicado | Teste | Estado | Proposta |
|---|---|---|---|---|---|---|---|---|
| **Assumir** (passagem do Negociador) | `POST /negociacoes/:id/assumir` · `negociacao.assumida` | Parcial: a passagem tem o botão **Abrir** (`frontend/telas/inicio.ts:213-215`), que leva a `/clientes/:contato` (ficha), não à negociação; sem `contato_id` não há botão nenhum | Nenhuma (só `href`) | `POST /negociacoes/:id/assumir` existe: `backend/negociador.ts:718-745` | `negociacao_assumida` (`backend/negociador.ts:719,741`) — mas Hoje não a dispara | Rota: `negociador-humano.test.ts:538-562`, `eventos-sem-dado-pessoal.test.ts:405`. Tela: `hoje.test.ts:79` só confere `passagens` sem sigilo | **comando sem funcionar** (pendência do B2 "o Assumir espera o D2/D3", plano:235; R.8.1 item 1, plano:443, sem decisão) | Trocar **Abrir** por **Assumir** na passagem: `enviar('POST', '/negociacoes/:id/assumir')` e `abrirNegociacao(id)` (já existe em `frontend/telas/negociacoes.ts:802-805`); manter Abrir no "Mais". Teste no `hoje`/Chromium |
| Assumir (passagem do Mensageiro, `conversa.assumida`) | `POST /conversas/:id/assumir` · `conversa.assumida` | Não (nem a passagem existe: `passagens()` lê só `negociacoes`, `backend/funil.ts:272-286`) | — | Não encontrada (`rotas.txt` não tem `/conversas`) | Não (sem evento no manifesto) | — | **por decisão** (P02 fora do arco 1.2: P-31/P-32, D-59, D-78; spec 1382) | Nada até o WhatsApp |
| Botão principal do cartão: **Fazer agora** (quente sem resposta, abordagem atrasada) | conforme o cartão | Sim: `inicio.ts:150-151` (href `/clientes/:id?sugerir=1`); a ficha abre o WhatsApp no clique e registra (`ficha-contato.ts:461-474`) | Da ficha: `GET /contatos/:id/mensagem-sugerida` (`ficha-contato.ts:440`) e `POST /abordagens/:contato/feita` (`:471`) | `backend/ficha.ts:102-142`; `backend/funil.ts:180-199` | — (a spec não pede) | `hoje.test.ts:28` (um principal por tipo), `funil.test.ts:70-101`, `ficha.test.ts:176`, `clientes-chromium.test.ts:359-396` (`?sugerir=1`) | **OK** (rota real: via ficha, `docs/funil.md:151-155`) | — |
| Botão principal do cartão: **Fiz** (atrasada, no "Mais") | conforme o cartão | Sim: `inicio.ts:152-153` | `POST /abordagens/:contato/feita` | `backend/funil.ts:180-199` | — | `funil.test.ts:90` (`/feita` 201) | **OK** | — |
| Botão principal do cartão: **Abrir** (visita, próximo passo) | conforme | Sim: `inicio.ts:160-161` | — (href `/clientes/:id`) | — | — | `hoje.test.ts:28` | **OK** | — |
| Botão principal do cartão: **Visita feita** (no "Mais") | conforme | Sim: `inicio.ts:154-159` (só com `atividade_id`, `:168`) | `PATCH /atividades/:id` `{status:'feita'}` | `backend/crm.ts:600-626` | — | `crm.test.ts:127-148` | **OK** | — |
| Botão principal do cartão: **Registrar proposta** (propostas recebidas) | conforme | Não: a fila só tem 4 motivos (`comum/funil.ts:159` `TipoFila`; `backend/funil.ts:226-266` `filaDoDia`); passagens não viram cartão, e "propostas recebidas", "peças aguardando aprovação" e "prazos (autorizações)" não entram | — | Existe o que o cartão chamaria: `POST /negociacoes/:id/propostas` (`backend/negociacao.ts:543`) | `proposta_recebida` já sai do portal (`backend/publico.ts:590`) | `funil.test.ts:102` só cobre os 4 tipos | **comando ausente** (R.8.1 item 2, plano:444, sem decisão) | Acrescentar os motivos `proposta_recebida` (negociações com proposta do comprador pendente → botão abre P15), `peca_aguardando` (peças `aprovada` sem agendamento → "Revisar peça", P08) e `prazo_autorizacao` (autorizações a vencer, já há `autorizacao.vencendo` na spec 13) em `filaDoDia` + `ACOES_FILA`; ou D-nn deixando para o Mensageiro |
| Botão principal do cartão: **Revisar peça** (peças aguardando) | conforme | Não (idem) | — | — | — | — | **comando ausente** (R.8.1 item 2) | Idem acima |
| **Agora não** (adia o cartão, no "Mais") | rota de adiar da abordagem | Não: `ACOES_FILA` tem só `fiz`/`visita_feita` como secundária (`comum/hoje.ts:43-48`); "Agora não" não aparece em `inicio.ts` | — | Existe: `POST /abordagens/:contato/adiar` (`backend/funil.ts:201-211`), usada pela ficha como "Pular a abordagem" (`ficha-contato.ts:413-416,576`) | — | `funil.test.ts:88` | **comando ausente** (R.8.1 item 2, sem decisão) | Pôr "Agora não" no "Mais" dos cartões `abordagem_vencida` (→ `/adiar`) e, para os outros tipos, um adiar de dia (`quente_sem_resposta` e `proximo_passo` não têm rota de adiar: precisaria de `abordagem_adiada_em` valer para eles ou de uma rota nova) |
| Item de **Primeiros passos** | — | Sim: `inicio.ts:234-237` (`href` de `p.rota`); passos em `comum/hoje.ts:22-28` (conta, telefone, Instagram, imóvel, Página) | — | `GET /inicio` monta `primeiros_passos` (`backend/funil.ts:304-325`) | — | `hoje.test.ts:20,55` | **OK** (sem WhatsApp/Mensageiro: D-78; barra de progresso → `urbi-bolinhas`, pedido ao shell 11) | — |
| **Dica do Assistente** (executa a sugestão após confirmação) | `POST /assistente/acoes/:id/confirmar` | Parcial: o cartão existe (`inicio.ts:323-332`) com o botão **Perguntar ao Assistente**, que só abre o painel (`abrirAssistente()`); a dica é texto calculado na tela (`comum/hoje.ts:65-77`), sem ação | Nenhuma | **Não encontrada** (`rotas.txt` não tem `/assistente/acoes`) | — | `hoje.test.ts:41` (texto da dica) | **comando sem funcionar** (R.8.1 item 2 "Dica só abre o Assistente", sem decisão) | Ou registrar D-nn: a dica é só atalho para o Assistente, onde a ação é proposta e confirmada pelas rotas de sempre (D-76/D-109), e emendar a spec; ou fazer a dica vir de `GET /inicio` como `{texto, acao}` validada por `validarAcao` (`comum/assistente`) e confirmada com o mesmo cartão "Posso fazer isto?" |
| **Ver agenda** / **Voltar para a fila** (prosa: aba Agenda) | — | Sim: `inicio.ts:305` e `:256` → `mudarVisao` (`:139-143`, `?aba=agenda`) | `GET /atividades?status=pendente&ate=` (`frontend/telas/agenda.ts:29`) | `backend/crm.ts:544-559` | — | `inicio.test.ts:12,16,27`, `hoje.test.ts:49` | **OK** (forma: botão, não `urbi-abas`; ver (a)) | — |
| Agenda: **Feito · Não veio · Cancelar · Abrir cliente** | — | Sim: `agenda.ts:61-67` | `PATCH /atividades/:id` | `backend/crm.ts:600-626` | — | `crm.test.ts:127` | **OK** | — |
| **Gerar dados de demonstração** (não está na spec P01) | — | `inicio.ts:240-245` | `POST /demo/semear` | `backend/demo.ts:101` | — | `demo.test.ts` | OK (extra, conta de teste) | — |
| Backend `GET /inicio` agrega tudo numa chamada | `GET /inicio` | `inicio.ts:90` (junto com a sonda `GET /assistente/ia`) | `GET /inicio` | `backend/funil.ts:327-348` | — | `hoje.test.ts:55,79,247`, `funil.test.ts:86-93` | **OK** | — |

**(a) Abas, visões e endereço (11.0.5)**
- Endereço: a spec diz `/hoje` com apelido `/inicio`. **Nenhum dos dois existe**: `frontend/enderecos.ts:21-58` tem `/`, `/agenda` e `/assistente` para Hoje; o trilho usa `/` (`enderecos.ts:139`). O teste `moldura.test.ts:103-121` só confere `/`, `/agenda`, `/assistente`. R.8.1 item 3 (plano:445). Proposta: acrescentar `'/hoje': 'hoje'` e `'/inicio': 'hoje'` a `ENDERECOS` (duas linhas + teste), ou D-nn aceitando `/`.
- Abas **Hoje · Agenda** (D-82): no computador **não há `urbi-abas`** em `inicio.ts` (nenhuma ocorrência); a agenda troca o centro por `?aba=agenda`/`/agenda` (`inicio.ts:49-54,139-143`) pelos botões **Ver agenda**/**Voltar para a fila**. No celular as abas da moldura são as colunas Hoje · Fila · Agenda (`inicio.ts:342`), não as abas da spec. R.8.1 item 3.
- `/agenda` abre direto na agenda: OK (`comum/funil.ts:13`, `inicio.test.ts:16`).

**(b) Estados obrigatórios (11.0.4)**
- Carregando: `inicio.ts:344` (`estadoTela('carregando')`, `frontend/estados.ts:36-38`); Agenda `agenda.ts:88`. OK.
- Vazio: fila vazia com "Nada urgente agora" + **Cadastrar um cliente** (`inicio.ts:261-271`); Agenda `agenda.ts:89-98`. OK.
- Erro: `inicio.ts:344` → `estadoDaFalha` com **Tentar de novo** (`estados.ts:47-52,78-83`); Agenda `agenda.ts:80-87`. OK. Não encontrado (404/403): `estados.ts:78-81`. OK.
- Integração desconectada: não tratado em Hoje (o único uso de `estadoTela('desconectada')` é `frontend/telas/estudio.ts:954`); Hoje não toca integração, então não se aplica.
- IA indisponível: sonda `GET /assistente/ia` (`inicio.ts:90`), faixa no centro (`inicio.ts:250`) e botão da Dica desabilitado com a dica (`inicio.ts:327-330`). OK. Crédito esgotado: não se aplica (D-87).

---

#### P03 · Clientes — Funil (spec 1404–1421)

| Comando (spec) | Rota e evento na spec | Existe na tela? | Rota que a tela chama | Rota no backend | Evento publicado | Teste | Estado | Proposta |
|---|---|---|---|---|---|---|---|---|
| **Arrastar cartão** (muda etapa; motivo se perdido; desfazer 8 s) | `PATCH /negocios/:id` · `negocio.etapa_mudou` | Sim: `urbi-kanban` `@urbi:kanban-mover` (`frontend/telas/clientes-quadro.ts:253-255` → `mover` `:167-195`); Perdido abre o motivo (`:177-185`); **sem desfazer** (nenhum "desfazer" no frontend) | `PATCH /negocios/:id` `{etapa_id, motivo_perda}` (`:187`) | `backend/crm.ts:460-527` (422 `MOTIVO_OBRIGATORIO` `:498-500`; linha do tempo `:514-517`) | **Não (sem evento no manifesto)**; só linha do tempo `negocio.etapa_mudou` (`crm.ts:514`) | `crm.test.ts:93-112,307-340`, `troca-de-conta-quadro-chromium.test.ts:194-240`, `clientes-chromium.test.ts:330-335` | **comando sem funcionar (só o evento; e sem desfazer 8 s)** | Declarar `negocio_etapa_mudou` no manifesto (`campos`: negocio_id, de, para; subir `versao`) e `req.eventos.publicar` em `crm.ts:514`. Desfazer: `urbiVerso.notificar` não tem ação no SDK 100 → pedido ao shell ("toast com ação") ou D-nn dispensando o desfazer (o arrasto de volta já é um gesto) |
| **Resumir** (direita) | `POST /contatos/:id/resumo` · — (IA) | Sim: `ficha-contato.ts:843-844` (`renderFunil`) → `resumir` `:419-429`; desabilitado pela sonda `GET /contatos/:id/ia` (`:125-134`) | `POST /contatos/:id/resumo` | `backend/ficha.ts:82-100` (slot `assistente`, 503 `IA_INDISPONIVEL`) | — | `ficha.test.ts:48,95,156`, `clientes-chromium.test.ts:137` | **OK** | — |
| **Virar tarefa** (tarefa com prazo do playbook) | `POST /atividades` · — | Sim: dentro do cartão Próximo passo que a direita reaproveita (`ficha-contato.ts:840` → `:686`, só com abordagem) → `virarTarefa` `:477-489` (`tarefaDaAbordagem`, `comum/funil.ts`); há ainda **Tarefa** (`:845`, formulário livre) | `POST /atividades` | `backend/crm.ts:561-598` | `atividade.criada`: não (sem evento no manifesto; a spec P03 não exige) | `ficha.test.ts:176,201-205`, `crm.test.ts:127` | **OK** | — |
| **Mover para Proposta** (abre P15; com mandato ativa o Negociador conforme configuração) | `PATCH /negocios/:id` + `POST /negociacoes` · `negociacao.iniciada` | Parcial: o arrasto é o mesmo `PATCH` (`clientes-quadro.ts:187`); o backend abre a negociação sozinho pelo gatilho `etapa_proposta` (`crm.ts:521-523` → `backend/negociador-entrada.ts:50-82`) e a tela só avisa (`avisoDeEntrada`, `clientes-quadro.ts:188-189`); **não abre P15**; `POST /negociacoes` não é chamado pelo quadro | `PATCH /negocios/:id` | `crm.ts:460-527`; `negociador-entrada.ts:50-82` → `criarNegociacao` + `depoisDeCriar` (`backend/negociacao.ts:245-250`) | `negociacao_iniciada` (`negociacao.ts:247`, só quando o gatilho está ligado e há imóvel no negócio) | `negociador-gatilhos.test.ts:162-209` | **OK** (rota real: só o PATCH; a negociação nasce pelo gatilho F3, 0.1.36; o "abrir P15" fica no **Registrar proposta** da direita) | Depois do PATCH com `negociador_entrou`, oferecer "Abrir negociação" no aviso (ou navegar com `abrirNegociacao`) para cumprir "abre P15" |
| **Mensagem sugerida / Fazer agora** (direita, prosa) | — (as de P04) | Sim: `ficha-contato.ts:840` reaproveita `cartaoProximoPasso` (`:655-689`): **Mensagem sugerida** `:685`, **Fazer agora** `:680` | `GET /contatos/:id/mensagem-sugerida` (`:440`); `POST /abordagens/:contato/feita` (`:471`) | `backend/ficha.ts:102-142`; `backend/funil.ts:180-199` | — | `ficha.test.ts:48,77,95,142,176`, `clientes-chromium.test.ts:396-410` | **OK** | — |
| **Registrar proposta** (prosa 11.1/R.8.1; botão da direita) | `POST /negociacoes` · `negociacao.iniciada` | Sim: `ficha-contato.ts:842` → `registrarProposta` `:815-819` → `novaProposta` (`negociacoes.ts:738-800`) → `abrirNegociacao` (`:802`) | `GET /negociacoes?contato_id=`, `GET /contatos/:id`, `POST /negocios` (se preciso), `POST /negociacoes` (`negociacoes.ts:785`), `POST /negociacoes/:id/propostas` (`:789`) | `backend/negociacao.ts:211` (POST), `:543` (propostas) | `negociacao_iniciada` (`negociacao.ts:247`); `proposta_recebida` (`:624`) | `negociacao.test.ts:121-179`, `dialogos-troca-de-conta.test.ts:67` | **OK** | — |
| **Abrir ficha** (direita) | — | Sim: `ficha-contato.ts:848` (href `/clientes?item=`) | — | — | — | `clientes-chromium.test.ts:198` | **OK** | — |
| **Conversa** (direita; WhatsApp) | — | Sim: `ficha-contato.ts:846-847` → `abrirWhatsapp` `:500-503` (wa.me) | nenhuma | — | — | — | **OK** | — |
| **Enviados** com abertura e clique (direita) | — | Sim: `ficha-contato.ts:851-856` (`primeiro_clique_em`, `cliques`) | `GET /envios?contato_id=` (`:155`) | `backend/envios.ts:70-81`; clique conta em `publico.ts:321` | `link_clicado` (`publico.ts:321`) | `numeros.test.ts:146-161` (POST), `negociador-humano.test.ts:307` (403) | **OK** | — |
| Alternador **Funil · Lista · Negociações** (D-96) | — | Sim: `frontend/telas/clientes.ts:57-62,246` | — | — | — | `clientes.test.ts:94`, `clientes-chromium.test.ts:198` | **OK** | — |
| **Funis** com contagem, **filtros prontos**, **temperatura** com definição, "Sem contato há" | — | Sim: `clientes-quadro.ts:94-116` (contagens vêm do quadro `:20-31`) | `GET /funil/quadro?pipeline&temperatura&parado_dias&…` (`:153`), `GET /conta` (`:35`) | `backend/funil.ts:43-114` | — | `funil.test.ts:122,167`, `crm.test.ts:266` | **OK** (sem listas salvas: D-83) | — |
| Cabeçalho: total aberto e **taxas entre etapas** | — | Sim: `clientes-quadro.ts:223-230,248-251` | idem quadro (`passagem`) | `funil.ts:81-82` (`taxasDePassagem`) | — | `funil.test.ts:138,167` | **OK** | — |
| Cartão com **último sinal** ("abriu a seleção 2x") e aviso de abordagem atrasada | — | Atrasada sim (`clientes-quadro.ts:203`); último sinal **não** (cartão mostra título e valor, `:197-206`) | — | o quadro não devolve sinal (`funil.ts:93-110`) | — | — | **comando ausente** (é conteúdo, não botão; R.8.1 item 7, sem decisão) | Devolver `ultimo_sinal` no quadro (último item da `linha_do_tempo` do contato, ou cliques de `envios`) e mostrar no cartão |

**(a) Abas, visões e endereço**
- `/clientes?visao=funil` e apelido `/funil`: `clientes.ts:62-65` (`OPCOES_VISAO`), `enderecos.ts:29`; `?visao=quadro` antigo também abre o Funil (`clientes.ts:65`). Filtros na URL (`pipeline`, `temperatura`, `parado_dias`, `pronto`; `chaveDoQuadro` `clientes-quadro.ts:45-48`); cartão escolhido em `?item=` (`contatoDoFunil` `:51-54`); `?sugerir=1` (`:213-220`). Testes `clientes.test.ts:81,94`, `moldura.test.ts:103`, `clientes-chromium.test.ts:198,396`. OK.
- Celular: a spec pede "lista agrupada por etapa, sem quadro"; o `urbi-kanban` é usado em toda largura (`clientes-quadro.ts:253`). Sem decisão registrada. (Não é comando; anotado.)

**(b) Estados obrigatórios**
- Carregando: `clientes-quadro.ts:239` (`urbi-loading`); direita `ficha-contato.ts:827`. OK.
- Vazio: `clientes-quadro.ts:256-257` ("Nenhum negócio…", sem botão de ação; a spec pede "a ação que resolve"); direita sem cartão escolhido: dica `clientes.ts:127`. Parcial (falta o botão "Abrir um negócio"/"Novo").
- Erro: `clientes-quadro.ts:233-238` com **Tentar de novo**; `:247` faixa quando já havia quadro. OK. Não encontrado: direita `ficha-contato.ts:827` (`estadoDaFalha`). OK.
- Integração desconectada: não se aplica. Crédito: não se aplica (D-87).
- IA indisponível: **Resumir** da direita desabilitado pela sonda `/contatos/:id/ia` (`ficha-contato.ts:843-844`); não há faixa `ia_indisponivel` no centro do Funil (nenhum uso em `clientes-quadro.ts`/`clientes.ts`), só na ficha (`ficha-contato.ts:626`). Parcial, aceitável (os botões de IA estão na direita).

---

#### P04 · Clientes — Lista e ficha (spec 1423–1432)

| Comando (spec) | Rota e evento na spec | Existe na tela? | Rota que a tela chama | Rota no backend | Evento publicado | Teste | Estado | Proposta |
|---|---|---|---|---|---|---|---|---|
| **Resumir** | `POST /contatos/:id/resumo` | Sim: cabeçalho `ficha-contato.ts:620-621` → `:419-429` | `POST /contatos/:id/resumo` | `backend/ficha.ts:82-100` | — (IA) | `ficha.test.ts:48,95,122,156`, `clientes-chromium.test.ts:137,267` | **OK** (a spec põe Resumir no Histórico, à direita; ficou no cabeçalho do centro, R.8.1 item 6) | — |
| **Mensagem sugerida** | — | Sim: `ficha-contato.ts:685` → `sugerir` `:436-448` (objetivos em chips `:672-674`) | `GET /contatos/:id/mensagem-sugerida[?objetivo=]` | `backend/ficha.ts:102-142` (sem IA devolve o playbook/modelo) | — | `ficha.test.ts:48,77,95,142`, `clientes-chromium.test.ts:359-410` | **OK** | — |
| **Fazer agora** (abre o WhatsApp e registra a abordagem) | — | Sim: `ficha-contato.ts:680` → `fazerAgora` `:461-474` (`window.open(wa.me)` antes do await; sem telefone copia) | `POST /abordagens/:contato/feita` `{canal:'whatsapp', texto}` | `backend/funil.ts:180-199` | — | `ficha.test.ts:176` | **OK** | — |
| **Virar tarefa** | `POST /atividades` | Sim: `ficha-contato.ts:686` → `:477-489` | `POST /atividades` | `backend/crm.ts:561-598` | `atividade.criada`: não (sem evento no manifesto) | `ficha.test.ts:176,201` | **OK** (a spec P04 não pede evento) | — |
| **Gerar / Reenviar link** do portal | rotas do portal do contato · `acesso_cliente.convidado` | Sim: `frontend/telas/selecoes-cliente.ts:306,310` → `gerarPortal` `:182-187` (copia a mensagem com o link) | `POST /contatos/:id/portal` | `backend/cliente.ts:157-185` (um link por cliente; `envios` `link_portal` `:181`; linha do tempo `portal.criado` `:182`) | **Não (sem evento no manifesto)** | `cliente.test.ts:177-250,291`, `creci.test.ts:244`, `clientes.test.ts:56-79` (A×B), `eventos-sem-dado-pessoal.test.ts:419` | **comando sem funcionar (só o evento)** | Declarar `acesso_cliente_convidado` (só `contato_id`, sem link/token) e publicar em `cliente.ts:184`; ou D-nn: o convite fica só na linha do tempo (nenhum assinante hoje) |
| **Revogar** link do portal | rotas do portal · — | Sim: `selecoes-cliente.ts:307` → `revogarPortal` `:199-207` (confirmação) | `PATCH /contatos/:id/portal/revogar` | `backend/cliente.ts:187-202` | — | `cliente.test.ts:244-249` | **OK** (sem o desfazer 8 s de 11.0.6) | — |
| **Exportar** | `GET /contatos/exportar` | Sim: `ficha-contato.ts:876` → `:764-778` (e no topo da lista `clientes.ts:243,217-234`) | `GET /contatos/exportar` (`chamarFetch`) | `backend/crm.ts:194-211` | — | `crm.test.ts:279-306` | **OK** | — |
| **Remover** (soft delete) | `PATCH /contatos/:id/remover` | Sim: `ficha-contato.ts:877` e no "Mais" `:584` → `:383-399` | `PATCH /contatos/:id/remover` | `backend/crm.ts:358-374` | — | `crm.test.ts:114-126`, `cliente.test.ts:257` | **OK** | — |
| **Registrar contato** (Histórico) | — | Sim: `ficha-contato.ts:742` → `nota` `:247-251` | `POST /contatos/:id/notas` | `backend/crm.ts:375-389` | — | `ficha.test.ts:38`, `assistente.test.ts:163` (uso), `crm.test.ts:332` (A×B) | **OK** | — |
| **Registrar envio** | — | Sim: `ficha-contato.ts:743,754` → `:517-548` (mensagem pronta copiada) | `POST /envios` | `backend/envios.ts:23-68` | `envio.criado`: não (sem evento no manifesto; P04 não exige) | `numeros.test.ts:146-161` | **OK** | — |
| **Enviados ao cliente** (lista) | — | Sim: `ficha-contato.ts:752-760` | `GET /envios?contato_id=` (`:155`) | `backend/envios.ts:70-81` | — | — (só o POST) | **OK** | — |
| **Portal do cliente**: link ativo, **último acesso** | — | Link e "gerado em": `selecoes-cliente.ts:300-310`; **último acesso não** (a rota devolve só `ativo, link, criado_em`, `cliente.ts:147-155`) | `GET /contatos/:id/portal` | `backend/cliente.ts:147-155` | — | `cliente.test.ts:190` | **comando ausente** (é dado, não botão; sem decisão) | Gravar `ultimo_acesso_em` em `acessos_cliente` no `wh` do portal (`publico.ts`) e devolver no GET |
| **Novo** (lista) | `POST /contatos` | Sim: `clientes.ts:242` → `novoContato` `:190-215` | `POST /contatos` | `backend/crm.ts:167-193` | — | `crm.test.ts:73-92` | **OK** | — |
| **Importar** (lista) | P14 | Sim: `clientes.ts:241` (href `/clientes/importar`) | — | P14 (outro grupo) | — | `clientes-chromium.test.ts:198` | **OK** | — |
| Busca (nome, telefone, e-mail), filtros prontos, Compradores · Proprietários | `GET /contatos` | Sim: `clientes.ts:405-423` | `GET /contatos?busca&papel&temperatura&origem&pronto…` (`:323`, `consulta` `:310-316`) | `backend/crm.ts:112-166` | — | `crm.test.ts:220,231,266` | **OK** (temperatura/origem a mais: R.8.1) | — |
| **WhatsApp · Ligar · E-mail** (cabeçalho) | — | Sim: `ficha-contato.ts:619,622,623` (wa.me, `tel:`, `mailto:`) | nenhuma | — | — | `clientes-chromium.test.ts:267` | **OK** | — |
| Cadastro e **consentimento** (registrar / revogar) | — | Sim: `ficha-contato.ts:645-649` → `:363-381` | `POST /contatos/:id/consentimento`, `…/revogar` | `backend/crm.ts:390-420` | auditável na spec; nenhum evento no manifesto | `crm.test.ts:333-334` (só A×B 404) | **OK** (sem teste positivo) | Teste positivo do consentimento |
| **Editar contato** (também atalho `E`) | `PATCH /contatos/:id` | Sim: "Mais" `:571`, lápis `:639`, atalho `:922` | `PATCH /contatos/:id` | `backend/crm.ts:315-357` | — | `crm.test.ts:73`, `atalhos-chromium.test.ts:90` | **OK** | — |
| **Combinar próximo passo** (lápis) | — | Sim: `:659` → `:226-245` | `PATCH /contatos/:id` (`proximo_passo*`) | `crm.ts:315` | — | — | **OK** | — |
| **Novo negócio / Mudar etapa** | — | Sim: `:694` → `:263-286`; `:703` → `:288-311` | `POST /negocios`; `PATCH /negocios/:id` | `crm.ts:421-458`, `:460-527` | `negociacao_iniciada` se cair na Proposta (`negociador-entrada.ts:50`) | `crm.test.ts:93`, `negociador-gatilhos.test.ts:162` | **OK** | — |
| **Agendar / Feito / Retorno da visita** (Agenda) | — | Sim: `:729` → `:313-334`; `:724` → `:353-361`; `:721` → `:336-351` | `POST /atividades`; `PATCH /atividades/:id`; `POST /visitas/:atividade/feedback` | `crm.ts:561`, `:600`, `:642-672` | `lembrete_visita` agendado (`crm.ts:586`) | `crm.test.ts:127`, `cliente.test.ts:199` | **OK** (feedback sem teste dedicado encontrado) | — |
| **Perguntar ao Assistente** sobre o cliente | — | Sim: `:572` → `abrirAssistenteSobre` (`assistente.ts:139-142`) | — | — | — | `moldura.test.ts:161-182` | **OK** | — |
| **Registrar abordagem feita / Pular a abordagem** ("Mais") | — | Sim: `:575-576` → `:401-416` | `POST /abordagens/:contato/feita`, `…/adiar` | `backend/funil.ts:180-211` | — | `funil.test.ts:70-101` | **OK** | — |

**(a) Abas, visões e endereço**
- `/clientes?visao=lista&item=:id`: `clientes.ts:62-71` (`visaoAtual`, `clienteDaUrl`), `enderecos.ts:82-88` (`contatoDoItem`: o `item` só é contato na Lista); `?secao=` guarda a aba da ficha (`ficha-contato.ts:41-51,137-141`); `/clientes/:id` é apelido canonizado por `fichaCanonica` (`enderecos.ts:122-130`, `index.ts:164-168`). Testes `clientes.test.ts:19-45,81,94`, `clientes-chromium.test.ts:198` (`?item=` e `?secao=` ao recarregar), `moldura.test.ts:254`. OK.
- Abas da ficha: Resumo · Linha do tempo · Enviados · Negócios · Negociação (`ficha-contato.ts:41-47`). A spec D-92/D-106 põe o histórico na coluna **direita** e aqui ele ficou numa aba do centro; a direita tem Perfil de busca, Portal e Privacidade (`ficha-contato.ts:861-881`). R.8.1 item 6, sem decisão.

**(b) Estados obrigatórios**
- Carregando: lista `clientes.ts:426` (`?carregando` no `urbi-lista`), ficha `ficha-contato.ts:783,863`. OK.
- Vazio: lista `clientes.ts:427` (frase + "Cadastre o primeiro (Novo)…", sem botão clicável no estado), centro sem cliente `clientes.ts:139-143`, abas com dica e ação (`:668,706,732,748,758,870`). OK.
- Erro: lista `clientes.ts:424-425` (**Tentar de novo**), ficha `ficha-contato.ts:783-785`. OK. Não encontrado: `ficha-contato.ts:783` → `estadoDaFalha` (`clientes-chromium.test.ts:198`, A×B pela URL). OK.
- IA indisponível: sonda `GET /contatos/:id/ia` (`ficha-contato.ts:125-134`), Resumir desabilitado com dica e frase (`:620-621,626`); mensagem sugerida degrada para o playbook (`ficha.ts:129`). Testes `clientes-chromium.test.ts:137`, `ficha.test.ts:48,142`. OK.
- Integração desconectada e crédito: não se aplicam.

---

#### P05 · Assistente (spec 1434–1444)

| Comando (spec) | Rota e evento na spec | Existe na tela? | Rota que a tela chama | Rota no backend | Evento publicado | Teste | Estado | Proposta |
|---|---|---|---|---|---|---|---|---|
| **Perguntar** | `POST /assistente/perguntar` · — | Sim: `urbi-chat` `.aoEnviar` (`frontend/telas/assistente.ts:247-257`) → `perguntar` `:160-192` (leva `tela`, `historico`, `contato_id`) | `POST /assistente/perguntar` | `backend/assistente.ts:95-171` (sem IA → busca na ajuda `:109-120`; ação só a validada `:168`) | — | `assistente.test.ts:57,78,129-190`; frontend só mock (`troca-de-conta-chromium.test.ts:59`) | **OK** | Teste de tela do `perguntar`/`confirmar` (hoje só o backend é testado) |
| **Confirmar ação** (cartão "Vou criar esta tarefa… Confirmar · Cancelar") | rota da própria ação (`POST /atividades`, agendar peça) · conforme a ação | Sim: cartão "Posso fazer isto?" `:234-241` → `confirmar` `:194-207` (`POST p.rota, p.corpo`); **Agora não** = Cancelar (`:239` → `recusar` `:209-212`) | `POST /atividades` ou `POST /estudio/pecas/:id/agendar` (o que a IA propôs e `validarAcao` aceitou) | `backend/crm.ts:561` · `backend/instagram.ts:311` | `atividade.criada`: não (sem evento no manifesto); peça: `publicacao_programada` (`instagram.ts`) | `assistente.test.ts:89-128` (`validarAcao`), `:148-151` (`acao.rota === '/atividades'`) | **OK** (rótulo "Agora não", `docs/assistente.md:45`) | — |
| Resposta com artigo citado e botão **Ir para…** | — | Sim: rodapé "Na ajuda" com link da documentação (`:177-179`); botão "Abrir <tela>" `:243-245` | — | `backend/assistente.ts:166-167` | — | `assistente.test.ts:134-140` | **OK** (o botão fica acima do chat, R.8.1 P05) | — |
| **Sugestões de perguntas em chips** | — | **Não** (nenhum chip/sugestão em `assistente.ts`) | — | — | — | — | **comando ausente** (R.8.1 item 8, plano:450, sem decisão) | Chips fixos por tela (`TELAS_APP` de `comum/assistente.ts` já sabe a tela) acima do chat, que preenchem `perguntar()` |
| Campo de texto com **microfone** | — | Sim: `urbi-chat audio chave-audio="portal_corretor:assistente"` (`:253-254`) | (transcrição é da plataforma) | — | — | — | **OK** (`docs/assistente.md:14`) | — |
| Botão **Assistente** no trilho (e `A`) | `POST /assistente/perguntar` | Sim: `frontend/moldura.ts:71,78-80`; atalho `frontend/atalhos.ts:38,225`; telas fora da moldura `frontend/criar.ts:100-103` | sonda `GET /assistente/ia` ao abrir (`assistente.ts:115-121,127`) | `backend/assistente.ts:88-93` | — | `moldura.test.ts:161-233`, `atalhos-chromium.test.ts:99-109`, `busca.test.ts:217` | **OK** | — |
| **Fechar** / **Tirar** contato em foco | — | `:225`, `:231` | — | — | — | `moldura.test.ts:161` | **OK** | — |
| Sabe a tela e o item abertos (contexto) | — | Sim: `lembrarTela` (`index.ts:181`), `lembrarContato` (`ficha-contato.ts:160`), `contatoEmFoco` (`assistente.ts:102-106`) | corpo do `perguntar` (`:172-175`) | `backend/assistente.ts:100,124-129,145` | — | `moldura.test.ts:161` ("Sobre: Ana Souza"), `assistente.test.ts:148` | **OK** | — |
| Conversa em memória entre telas; no máximo uma ação | D-76 | `conversa` fora do componente `:44-67`; `proposta` única `:180` | — | `SCHEMA_RESPOSTA` (`comum/assistente`) | — | `assistente.test.ts:89` | **OK** | — |

**(a) Abas, visões e endereço**
- Coluna de contexto em qualquer tela (D-109): `moldura.ts:104-129` (3 colunas) e `:150-153` (`comAssistente`, `urbi-2x1`). Apelido `/assistente` abre Hoje com o painel (`enderecos.ts:26`, `index.ts:182`); o negociador humano é levado a `/negociacoes` (`index.ts:169-177`). Testes `moldura.test.ts:103,161`, `menu.test.ts`. OK.

**(b) Estados obrigatórios**
- Carregando: placeholder "Pensando…" e composer travado (`assistente.ts:163,255`). OK.
- Vazio: o chat começa sem mensagens e sem frase de boas-vindas/estado vazio (não há `urbi-estado-vazio`); os chips sugeridos cobririam isso. Parcial.
- Erro: a falha vira mensagem do Assistente "Não consegui responder: …" (`:187`), sem **Tentar de novo** (o corretor reenvia). Parcial.
- IA indisponível: sonda `GET /assistente/ia` a cada abertura (`:115-128`), faixa "IA indisponível agora: respondo com os artigos da ajuda" (`:227`) e o backend degrada para busca na ajuda (`backend/assistente.ts:109-120`). Testes `moldura.test.ts:182,205`, `assistente.test.ts:129,192`. OK.
- Integração desconectada / crédito: não se aplicam.

---

#### 11.7 · Menu Criar e comandos globais (spec ~1685) e atalhos 11.0.6 (spec 1351)

| Comando (spec) | Rota e evento na spec | Existe na tela? | Rota que a tela chama | Rota no backend | Evento publicado | Teste | Estado | Proposta |
|---|---|---|---|---|---|---|---|---|
| Botão **Criar** no topo do trilho (11.0.1) | — | Sim, mas no `actions` do `urbi-shell-page` (`frontend/criar.ts:88-97`, `index.ts:239`), não no trilho | — | — | — | `moldura.test.ts:266` | **por decisão** (exceção nomeada B1 (a), spec 11.9; pedido ao shell 14) | — |
| **Novo cliente** (captação em 3 passos: nome e telefone; o que procura; origem) | `POST /contatos` | Sim: `criar.ts:19,29-30` → `/clientes?criar=cliente` (`irParaComQuery` `:69-74`) → `clientes.ts:285` (`pedidoDeCriar`) → `novoContato` `:190-215`. **Forma**: um diálogo de 6 campos (nome, telefone, e-mail, papel, origem, campanha), não 3 passos; "o que procura" não é perguntado (o perfil de busca só nasce das observações, `ficha-contato.ts:870`) | `POST /contatos` | `backend/crm.ts:167-193` | — | `criar.test.ts:40-75`, `moldura.test.ts:266`, `crm.test.ts:73` | **OK** (rota e efeito iguais; forma diverge sem decisão) | Acrescentar um campo "O que procura" (→ `observacoes`/`perfil_busca`) ou D-nn aceitando o diálogo único |
| **Novo imóvel** (P07) | `POST /imoveis` | Sim: `criar.ts:20,31-32` → `/imoveis/novo` | (P07, outro grupo) | `backend/imoveis.ts:179` | `imovel.criado`: não (sem evento no manifesto) | `criar.test.ts:55`, `moldura.test.ts:266` | **OK** | — |
| **Novo post** (P08 com o Criar aberto) | rotas do Estúdio | Sim: `criar.ts:21,33-34` → `/estudio?criar=post` → `frontend/telas/estudio.ts:218` | (P08, outro grupo) | `backend/estudio.ts` | — | `moldura.test.ts:266` | **OK** | — |
| **Nova visita** (seletor de cliente, imóvel e horário livre) | `POST /atividades` | Sim: `criar.ts:22,36-37,84` → `novaVisita` `:42-61` (cliente em foco já escolhido `:45,49`; busca de cliente e imóvel; **dia + hora digitada**, sem "horário livre") | `POST /atividades` (`:56`), `GET /contatos` e `GET /imoveis` na busca | `backend/crm.ts:561-598` (agenda `lembrete_visita` `:586`) | `visita.agendada`: não (sem evento no manifesto); `lembrete_visita` é agendado | `dialogos-troca-de-conta.test.ts:66`, `moldura.test.ts:266`, `crm.test.ts:127` | **OK** (rota real; "horário livre" não existe — sem decisão) | Sugerir horários livres a partir de `GET /atividades` do dia, ou D-nn |
| **Nova proposta** (P15 com seletor de negócio) | `POST /negociacoes` | Sim: `criar.ts:23,35-37,79-83` → `novaProposta` (`negociacoes.ts:738-800`: cliente, imóvel, valor, condições; o negócio é escolhido pela conduta `:769-786`, sem seletor) → `abrirNegociacao` `:802` | `GET /negociacoes?contato_id=`, `GET /contatos/:id`, `POST /negocios`, `POST /negociacoes` (`:785`), `POST /negociacoes/:id/propostas` (`:789`) | `backend/negociacao.ts:211`, `:543`; `crm.ts:421` | `negociacao_iniciada` (`negociacao.ts:247`), `proposta_recebida` (`:624`) | `negociacao.test.ts:121-179`, `dialogos-troca-de-conta.test.ts:67` | **OK** (rota real; sem seletor de negócio, por conduta — `docs/negociacao.md`) | — |
| **Busca global** (`/`; "cabeçalho de qualquer coluna esquerda"; resultados: clientes, imóveis, peças) | `GET /busca?q=` | Sim: tecla `/` (`atalhos.ts:36,223`) e item **Buscar** do trilho (`moldura.ts:70,81-83`) → `abrirBusca` (`atalhos.ts:153-194`, diálogo `urbiVerso.formulario` com campo `busca`). **Não** está no cabeçalho da coluna esquerda; resultados: clientes, imóveis e **negociações** (sem peças) | `GET /busca?q=` (`:166`) | `backend/busca.ts:40-112` (2–100 caracteres, 5 por tipo, `semSigilo`) | — | `busca.test.ts:42-200,265`, `atalhos-chromium.test.ts:93`, `menu.test.ts:105` | **OK** (rota real; lugar e tipos divergem: R.8.1 item 5 "Buscar no trilho", sem decisão; peças faltam sem registro) | Acrescentar `pecas` (título) ao `GET /busca` e ao `opcoesDaBusca`; decidir trilho × cabeçalho (D-nn) |
| **Assistente** (`A`, trilho → P05) | `POST /assistente/perguntar` | Sim: `moldura.ts:71`, `atalhos.ts:38,225` | ver P05 | ver P05 | — | `atalhos-chromium.test.ts:99`, `busca.test.ts:217`, `moldura.test.ts:161` | **OK** | — |
| Atalho **`C`** criar | — | Sim: `atalhos.ts:37,197-207,224` (diálogo de uma escolha, depois o mesmo `criar()`) | conforme a opção | — | — | `busca.test.ts:215-216`, `atalhos-chromium.test.ts:105` | **OK** | — |
| Atalho **`J`/`K`** próximo/anterior na lista | — | Sim: `atalhos.ts:40-41,78-84,235-240`; registrado pela Lista de Clientes (`clientes.ts:287-291`), Negociações (`clientes.ts:169`) e carteira de Imóveis; **não no Funil** (`clientes.ts:288` devolve `[]` fora da Lista; plano:211 "J/K no Funil… ficaram de fora") | — | — | — | `busca.test.ts:254`, `atalhos-chromium.test.ts:53-92` | **OK** (Funil de fora, registrado no plano:211 sem D-nn) | Registrar a ordem dos cartões do quadro em `registrarLista` |
| Atalho **`E` enviar sugestão aceita** | — | **Não como a spec**: `E` está ligado a **editar** o item aberto (`atalhos.ts:12,41,228-233`; `registrarEdicao` em `ficha-contato.ts:922` e na ficha do imóvel). Nenhum "Enviar" de sugestão (cartão "Negociador sugere", P15) responde ao `E` | — | — | — | `busca.test.ts:220`, `atalhos-chromium.test.ts:90-109` (testam `E` = editar) | **comando sem funcionar** (tecla existe com outro efeito; B10 registrou "E nas fichas" sem D-nn, plano:211) | Decidir: `E` dispara o **Enviar** do cartão de sugestão quando ele está na tela (P15; e Mensageiro depois) e editar vai para outra tecla; ou D-nn aceitando `E` = editar e emendando 11.0.6 |
| Atalhos nunca em campo de texto / celular sem atalho | — | `atalhos.ts:44-75` (`focoEmCampo`, modificadores) | — | — | — | `busca.test.ts:213-249`, `atalhos-chromium.test.ts:53` | **OK** (pedido ao shell 18 para teclas reservadas) | — |
| **Desfazer por 8 s** em mover etapa, arquivar, revogar link (11.0.6) | — | **Não** em nenhuma tela do grupo (nenhum "desfazer" no frontend) | — | — | — | — | **comando ausente** (sem decisão; o SDK 100 não tem notificação com ação) | Pedido ao shell (toast com ação) ou D-nn dispensando |
| Custo estimado no botão de ação que gasta crédito (11.0.6) | — | Não há ação que gaste crédito antes do Mensageiro | — | — | — | — | **por decisão** (D-87) | — |
| Aviso de CRECI com atalho (11.0.6, D-93) | — | Sim: `avisoCreci()` em Hoje (`inicio.ts:239`, `GET /inicio.sem_creci`) | — | `backend/funil.ts:323` | — | `hoje.test.ts:55`, `creci.test.ts` | **OK** | — |

---

#### Resumo por tela

| Tela | OK | Ausente | Sem funcionar | Por decisão |
|---|---|---|---|---|
| P01 Hoje (15 linhas) | 9 | 3 (Registrar proposta, Revisar peça, Agora não) | 2 (Assumir leva à ficha; Dica do Assistente só abre o painel, rota `/assistente/acoes/:id/confirmar` não existe) | 1 (conversa.assumida, P02) |
| P03 Funil (13) | 11 | 1 (último sinal no cartão) | 1 (arrastar: `negocio.etapa_mudou` não existe no manifesto e sem desfazer 8 s; o mover em si funciona) | 0 |
| P04 Ficha (23) | 21 | 1 (último acesso do portal) | 1 (Gerar link: `acesso_cliente.convidado` não existe no manifesto; o link funciona) | 0 |
| P05 Assistente (9) | 8 | 1 (chips de perguntas sugeridas) | 0 | 0 |
| 11.7 + atalhos (15) | 11 | 1 (desfazer 8 s) | 1 (`E` edita em vez de enviar a sugestão aceita) | 2 (Criar fora do trilho, pedido ao shell 14; custo de crédito, D-87) |

Dos 5 "sem funcionar", 2 são só pelo evento ausente do manifesto (arrastar cartão, gerar link do portal); os outros 3 têm efeito diferente do da spec (Assumir, Dica do Assistente, `E`).

#### As descobertas mais importantes

1. **Hoje não cumpre o "o que eu faço agora" da spec nos dois pontos de IA/negociação:** a passagem do Negociador tem **Abrir** (ficha) no lugar de **Assumir** (`inicio.ts:213-215`), embora `POST /negociacoes/:id/assumir` e `abrirNegociacao` já existam; a **Dica do Assistente** não executa nada e a rota `POST /assistente/acoes/:id/confirmar` não existe; a fila não tem **propostas recebidas, peças para aprovar nem prazos**, nem **Agora não**. Tudo isso está na lista R.8.1 "sem decisão" (plano:443-445) desde 05/11 e não virou issue nem D-nn.
2. **Eventos das telas do Padrão B não estão no manifesto:** `negocio_etapa_mudou`, `acesso_cliente_convidado`, `atividade_criada`, `visita_agendada`, `envio_criado` (spec 13.1 "completam o catálogo") não existem; os comandos gravam só na linha do tempo. Publicá-los pede `manifesto.eventos` + `req.eventos.publicar` em `crm.ts:514` e `cliente.ts:184` e subir `versao`.
3. **Endereço e atalhos divergem da spec sem decisão:** `/hoje` e `/inicio` não existem (`enderecos.ts:21-58`; Hoje é `/`); o atalho **`E`** edita a ficha em vez de "enviar sugestão aceita" (`atalhos.ts:41`), e a busca global não devolve **peças** nem fica no cabeçalho da coluna esquerda (`busca.ts`, `moldura.ts:70`). Nenhum **desfazer 8 s** existe (o SDK 100 não tem toast com ação: candidato a pedido ao shell).

### Grupo B · P06, P07, P08, P09

Diagnóstico só de leitura (07/11/2026, branch `docs/diagnostico-visual`). Caminhos relativos a `apps/portal_corretor/`; spec = `specs/portal_corretor.md`. Rotas do backend são relativas (`/api/portal_corretor/…`).

**Eventos do manifesto (19):** `lead_recebido`, `link_clicado`, `reacao_recebida`, `acao_cliente_recebida`, `publicacao_programada`, `lembrete_visita` e os 13 de negociação. **Nenhum dos eventos que a spec pede para este grupo existe**, exceto `publicacao_programada`: faltam `imovel.criado`, `imovel.ativado`, `imovel.visibilidade_mudou` (P06/P07, spec 1455, 1467, 13.1 linha 1757), `pagina.publicada` (P09, 11.8/13.1) e `peca.pronta`, `publicacao.feita`, `publicacao.falhou` (P08 via 11.8/13.1). Nenhuma rota de `backend/imoveis.ts`, `estudio.ts`, `pagina.ts` ou `envios.ts` chama `req.eventos.publicar` (grep: só `instagram.ts:326` agenda `publicacao_programada` e `publico.ts` publica `lead_recebido`/`link_clicado`/`reacao_recebida`). A spec 13.1 (linha 1757) diz que "o catálogo vigente é o do `manifesto.json`" para os que já existiam com outro nome; os quatro acima não existem com nome nenhum.

Convenção de **Estado**: OK · comando ausente · comando sem funcionar · por decisão. Quando só o evento falta, está escrito "sem funcionar (só o evento)".

---

#### P06 · Imóveis — Carteira e ficha (`/imoveis?item=:id`, spec 1445–1455)

Spec seção 7: `/imoveis` (806), `/imoveis/:id` (807), `/imoveis/:id/midias` (808), `/autorizacoes` (809), `/envios` (848), `/empreendimentos-corretor` (854; rota real `/empreendimentos`).

| Comando (spec) | Rota e evento na spec | Existe na tela? | Rota que a tela chama | Rota no backend | Evento publicado | Teste | Estado | Proposta |
|---|---|---|---|---|---|---|---|---|
| **Criar conteúdo** (leva a P08 **com o imóvel**) | rotas do Estúdio; sem evento | `frontend/telas/ficha-imovel.ts:483` (ação principal `acoesComMais`, `sub: '/estudio?criar=post'`) | sub-rota `/estudio?criar=post` → `estudio.ts:218` consome e `estudio.ts:294-301` abre `novoPedido('')`; o POST só sai do formulário (`estudio.ts:377` → `POST /estudio/pedido`) | `backend/estudio.ts:263` | não | `testes/estudio-chromium.test.ts:812` (`?criar=post`), `testes/criar.test.ts` | **comando sem funcionar (parcial)**: chega a P08 e abre o Novo pedido, mas o imóvel **não vai junto** (seleção "Imóvel" vazia, `estudio.ts:363`); `docs/imoveis.md:115` documenta só "abre o Estúdio com um post novo" | Passar `?criar=post&imovel=<id>` e pré-selecionar em `novoPedido` (um `filtrosDaUrl().get('imovel')` em `estudio.ts:218/363`) |
| **Melhorar descrição** (`POST /imoveis/:id/descricao`) | `POST /imoveis/:id/descricao`; sem evento | `ficha-imovel.ts:545` botão "Melhorar com IA" (só quando `this.ia.conteudo`, sonda `GET /imoveis/ia` em `ficha-imovel.ts:72`) | `ficha-imovel.ts:390` `POST /imoveis/:id/descricao`; a sugestão vai ao diálogo e grava por `PATCH /imoveis/:id` (`ficha-imovel.ts:379-380`) | `backend/imoveis.ts:654-678` (sonda `estadoSlot` 661, `req.ia.consultar` 667, não grava) | não (a spec não pede) | `testes/imoveis.test.ts` (`/descricao`) | **OK** | 11.0.4 pede botão **desabilitado com a dica "IA indisponível agora"**; aqui o botão **some** (`ficha-imovel.ts:544-546`). Trocar por `?desabilitado` + `title=DICA_IA_INDISPONIVEL` |
| **Enviar a cliente** (`POST /envios`) — botão "Enviar" em Clientes que combinam | `POST /envios`; 11.8 cita `envio.criado` (P02) | `frontend/telas/imoveis.ts:372` botão "Enviar" é `href=/clientes/:id` (abre a ficha do cliente) | nenhuma a partir de P06; o `POST /envios` só sai de Clientes › ficha › "Registrar envio" (`ficha-contato.ts:743,754` → `:537`), sem o imóvel pré-escolhido | `backend/envios.ts:23-68` (cria envio, registra atividade, link rastreado) | não (`envio.criado` não está no manifesto) | `testes/clientes.test.ts`, `testes/ficha.test.ts` (`/envios`); nenhum para o botão de P06 | **comando sem funcionar (parcial)**: o botão existe e navega, mas não envia; `docs/imoveis.md:43-45` descreve assim ("abre a ficha do cliente") sem D-nn | Em P06, "Enviar" abre `formularioEnviar('POST','/envios')` já com `contato_id` e `imovel_id` (o diálogo de `ficha-contato.ts:521` reaproveitado) e mostra a `mensagem` pronta para colar |
| **Mudar visibilidade** (`PATCH /imoveis/:id`, evento `imovel.visibilidade_mudou`) — "Quem vê este imóvel" | `PATCH /imoveis/:id`; evento `imovel.visibilidade_mudou` | `ficha-imovel.ts:469-471, 519` ação principal "Publicar na página" / "Tirar da página" | `ficha-imovel.ts:349` `PATCH /imoveis/:id {publicado_pagina}` | `backend/imoveis.ts:350-402` (379 aplica; 382-389 exige autorização vigente; 395 sincroniza a vitrine) | **não (sem evento no manifesto)** | `testes/imoveis.test.ts`, `testes/pagina.test.ts`, `testes/creci.test.ts` (`publicado_pagina`) | **comando sem funcionar (só o evento)** | Declarar `imovel_visibilidade_mudou` no manifesto (segregado, só `imovel_id` e `publicado`) e publicar em `imoveis.ts:391-395`; ou D-nn que o dispensa |
| **Definir mandato** (abre P16) e **Mandato resumido** à direita quando há negociação | — (P16: `/negociacoes/:id/mandato`) | **não há** (grep "mandato" em `imoveis.ts`/`ficha-imovel.ts`: nada; P16 só por P15, `frontend/telas/mandato.ts`) | — | `backend/negociacao.ts:419/432` existe | não | — | **por decisão (pendência registrada)**: `specs/plano_de_implementacao.md:423` e `:451` ("faltam o filtro de visibilidade e o mandato resumido com Definir mandato") | Na coluna da direita: se `GET /imoveis/:id/contexto` trouxer a negociação em andamento, cartão Mandato (preço pedido, alvo; recuo mascarado) e "Definir/Editar mandato" abrindo o `urbi-modal` de `mandato.ts` |
| **Editar** (cabeçalho; tecla E) | `PATCH /imoveis/:id` | `ficha-imovel.ts:482`; atalho `registrarEdicao` `:75` | `ficha-imovel.ts:315` `PATCH /imoveis/:id` | `backend/imoveis.ts:350` | não | `testes/imoveis.test.ts`, `testes/trava-edicao.test.ts` | **OK** | — |
| **Novo** (lista) → P07 | `POST /imoveis` via P07 | `imoveis.ts:260` → `:211` `navegarSub('/imoveis/novo')`; vazio com "Cadastrar o primeiro imóvel" `:240` | sub-rota `/imoveis/novo` | — | — | `testes/novo-imovel.test.ts:72` | **OK** | — |
| **O que falta** (lista da qualidade, cada item leva à seção que resolve) | — | `imoveis.ts:344-349` → evento `EVENTO_RESOLVER_FALTA` → `ficha-imovel.ts:427-440` (dados/descrição/autorização/fotos) | `GET /imoveis/:id/contexto` (`imoveis.ts:320`) | `backend/imoveis.ts:302-332` | não | `testes/imoveis-padrao-b.test.ts:49` (contexto); o clique "resolver" não tem teste próprio | **OK** | — |
| **Fotos e arquivos**: enviar, ordem ↑↓, ordem sugerida (IA), editar, apagar, análise IA | `/imoveis/:id/midias` POST/PATCH/DELETE | `ficha-imovel.ts:527-529` (seletor), `:198-203` (↑↓, Ver, Editar, Apagar), `:524-525` (Ordem sugerida, só com `ia.fotos`) | `:146` `POST …/midias`; `:170` `PUT …/midias/ordem`; `:525` `POST …/midias/ordem-sugerida`; `:181-182` `PATCH …/midias/:midia`; `:191` `PATCH …/midias/:midia/remover`; `:155` `POST …/midias/:midia/analisar` | `backend/imoveis.ts:463, 495, 516, 546, 592, 623` | não | `testes/imoveis.test.ts`, `testes/trava-edicao.test.ts` | **OK** (DELETE da spec virou `PATCH …/remover`, soft delete) | — |
| **Autorização de venda**: Nova, Marcar assinada, Revogar | `/autorizacoes` GET/POST/PATCH | `ficha-imovel.ts:549` (Nova), `:562` (Marcar assinada), `:563` (Revogar) | `autorizacao-venda.ts:54-79` `POST /autorizacoes`; `:121` `PATCH /autorizacoes/:id` (assinada + documento); `ficha-imovel.ts:416` `PATCH /autorizacoes/:id {situacao:'revogada'}` | `backend/imoveis.ts:682-704, 706-750` | não | `testes/imoveis.test.ts`, `testes/trava-edicao.test.ts`, `testes/creci.test.ts` | **OK** (`GET /autorizacoes` da spec não existe: a lista vem em `GET /imoveis/:id`, `backend/imoveis.ts:237-241`) | — |
| **Situação** (Mais) | `PATCH /imoveis/:id`; `imovel.ativado` ao ativar (P07) | `ficha-imovel.ts:484` → `:336-346` | `:344` `PATCH /imoveis/:id {situacao}` | `backend/imoveis.ts:375-389` | **não** (`imovel.ativado` fora do manifesto) | `testes/imoveis.test.ts` | **OK** quanto à rota; evento, ver P07 | — |
| **Remover** (Mais) | `PATCH …/remover` (soft delete) | `ficha-imovel.ts:485` → `:353-367` | `:358` `PATCH /imoveis/:id/remover` | `backend/imoveis.ts:404-416` | não | `testes/imoveis.test.ts`, `testes/imoveis-padrao-b.test.ts:87` | **OK** | — |
| **Continuar cadastro** (rascunho) | — | `ficha-imovel.ts:479-481` → `/imoveis/novo?item=<id>` | sub-rota | — | — | `testes/novo-imovel-chromium.test.ts:298` | **OK** | — |
| **Alternador Carteira · Empreendimentos** (D-84) | — | `imoveis.ts:262` `urbi-abas`, `?aba=` (`:70-77`), apelido `/empreendimentos` (`comum/imoveis.ts:22`, `frontend/enderecos.ts:33`) | `GET /imoveis`, `GET /empreendimentos` (`imoveis.ts:187-188`) | `backend/imoveis.ts:147, 754` | não | `testes/imoveis-padrao-b.test.ts:33`, `testes/moldura.test.ts` | **OK** | — |
| **Busca** (bairro, código, preço) e **filtros de situação e visibilidade** | `GET /imoveis` com filtros | busca `imoveis.ts:267-268` (código, título, bairro, cidade — **sem preço**); chips de situação `:50-55, 269-273`; **filtro de visibilidade: não há** | `GET /imoveis?busca&situacao` (`:173-177`) | `backend/imoveis.ts:150-164` (aceita `publicado_pagina=true` em `:154`, a tela não usa) | não | `testes/imoveis.test.ts` | busca/situação **OK**; visibilidade **por decisão (pendência registrada)** `plano:423, 451` | Chips "Públicos / Só eu" mandando `publicado_pagina` (o backend já filtra); busca por preço pede filtro `preco_c[lte]` |
| **Lista com miniatura, preço, bairro, nota colorida e situação** | — | `imoveis.ts:214-228` (`urbi-avatar` D-65, `corQualidade`) | `GET /imoveis` (traz `capa_url`, `qualidade`) | `backend/imoveis.ts:165-173` | — | `testes/imoveis-padrao-b.test.ts:111` | **OK** | — |
| **Direita: Qualidade do anúncio** (nota) | — | `imoveis.ts:337-353` | `GET /imoveis/:id/contexto` | `backend/imoveis.ts:318-321` | — | `testes/imoveis-padrao-b.test.ts:49` | **OK** (barra é lacuna 11.9: selo + `urbi-bolinhas`) | — |
| **Direita: Últimos 30 dias** (visualizações, cliques, contatos, visitas "quando a fonte existir") | — | `imoveis.ts:354-361`: Visitas, Enviado a, Cliques nos envios, Negócios ligados | idem | `backend/imoveis.ts:323-328` | — | `testes/imoveis-padrao-b.test.ts:49, 146` | **OK** (visualizações e contatos não têm fonte; `plano:423` registra) | — |
| **Direita: Clientes que combinam** | — | `imoveis.ts:362-375` | idem (`combinam`) | `backend/imoveis.ts:316` `compradoresQueCombinam` | — | `testes/imoveis-padrao-b.test.ts:18, 49, 71` | **OK** (o "Enviar" é a linha acima) | — |
| **Empreendimentos**: Novo, Editar, Enviar material, apagar material, Remover, "Criar conteúdo" no contexto | `/empreendimentos-corretor` GET/POST/PATCH | `empreendimentos.ts:103` (Novo), `ficha-empreendimento.ts:169` (Editar), `:180-181` (material), `:187` (apagar material), `:166` (Remover), `empreendimentos.ts:119` (Criar conteúdo → `href /estudio`, sem contexto) | `empreendimentos.ts:59` `POST /empreendimentos`; `ficha-empreendimento.ts:76` `PATCH /empreendimentos/:id`; `:107` `POST …/materiais`; `:128` `PATCH …/materiais/:m/remover`; `:141` `PATCH …/remover` | `backend/imoveis.ts:769, 802, 832, 853, 819` | não | `testes/imoveis.test.ts` (`/empreendimentos`, `/materiais`) | **OK** (rota real `/empreendimentos`) | — |
| **CRECI ausente**: aviso discreto, nunca bloqueio (D-93) | — | `imoveis.ts:351` `avisoCreci()` (`frontend/visual.ts:240-245`, atalho `/ajustes/conta`) | `sem_creci` em `GET /imoveis/:id/contexto` | `backend/imoveis.ts:322` | — | `testes/creci.test.ts` | **OK** | — |

**(a) Abas/visões e endereço (11.0.5):** `/imoveis?item=:id` ✓ (`imoveis.ts:41-42, 57-68`); `/imoveis/:id` e `/empreendimentos/:id` abrem a mesma moldura com o item (`enderecos.ts:60-72`, `imoveis.ts:83-87`); aba em `?aba=empreendimentos` e apelido `/empreendimentos` ✓; busca e situação na URL (`imoveis.ts:202-207`) ✓. Falta só o filtro de visibilidade (linha da tabela).

**(b) Estados 11.0.4:** Carregando: lista `imoveis.ts:232`, ficha `ficha-imovel.ts:457` (`urbi-loading`), contexto `imoveis.ts:334` ✓. Vazio: carteira com "Cadastrar o primeiro imóvel" `imoveis.ts:233-241`, centro sem item `imoveis.ts:111`, empreendimentos `empreendimentos.ts:73-82` ✓. Erro: lista `imoveis.ts:231` (`estadoDaFalha` → Tentar de novo), contexto `:333`, ficha `ficha-imovel.ts:450-456` (banner + Tentar de novo) ✓. Não encontrado: lista/contexto pelo `estadoDaFalha` (404 → "Não encontrado", `frontend/estados.ts:80`) ✓; a **ficha** mostra a mensagem do backend ("Imóvel não encontrado.") num banner de erro com "Tentar de novo" em vez do estado "Não encontrado" (`ficha-imovel.ts:96, 450-456`) — divergência pequena. Integração desconectada: não se aplica. Crédito: não se aplica (D-87). IA indisponível: sonda `GET /imoveis/ia` (`ficha-imovel.ts:72`, `backend/imoveis.ts:201-217`), mas os botões de IA **somem** em vez de ficarem desabilitados com a dica (`ficha-imovel.ts:523-526, 544-546`).

---

#### P07 · Imóveis — Novo imóvel (`/imoveis/novo`, spec 1457–1467)

| Comando (spec) | Rota e evento na spec | Existe na tela? | Rota que a tela chama | Rota no backend | Evento publicado | Teste | Estado | Proposta |
|---|---|---|---|---|---|---|---|---|
| **Novo imóvel** no menu Criar (11.7) → P07 | `POST /imoveis` | `frontend/criar.ts:191-192` → `/imoveis/novo`; `imoveis.ts:156` aceita o `?criar=imovel` antigo | sub-rota `/imoveis/novo` (`enderecos.ts:35`) | — | — | `testes/criar.test.ts`, `testes/novo-imovel.test.ts:72` | **OK** | — |
| **4 passos Fotos · Dados · Autorização · Onde aparece, com estado de cada um** | — | `novo-imovel.ts:606-640` (lista com ✓ e resumo `:587-603`), `irPara` `:354-371` | — | — | — | `testes/novo-imovel.test.ts:33`, `testes/novo-imovel-chromium.test.ts:163` | **OK** | — |
| **Salvar rascunho** (`POST /imoveis` a cada passo) | `POST /imoveis` (rascunho); evento `imovel.criado` | `novo-imovel.ts:637, 818` → `salvarRascunho` `:391-404`; cada passo salva ao sair (`:362-365`) | `:297` `POST /imoveis` (cria rascunho); `:313` `PATCH /imoveis/:id` | `backend/imoveis.ts:178-199` (`situacao: 'rascunho'` em `:190`), `:350` | **não (sem evento no manifesto)** | `testes/novo-imovel.test.ts:93`, `testes/novo-imovel-chromium.test.ts:163, 344` | **comando sem funcionar (só o evento `imovel.criado`)** | Declarar `imovel_criado` no manifesto e publicar em `imoveis.ts:190-191` (só `imovel_id`, `codigo`) |
| **Passo 1: escolher fotos; a IA sugere ordem e capa** | upload em 2 passos; IA `fotos` | `novo-imovel.ts:682-684` (seletor, câmera/galeria), `:694-695` Usar como capa, `:697-698` Apagar, selo "Capa sugerida" `:690` | `:424-425` `subirArquivo` + `POST /imoveis/:id/midias`; `:439` `POST …/analisar`; `:448` `POST …/ordem-sugerida`; `:465` `PUT …/midias/ordem`; `:476` `PATCH …/remover` | `backend/imoveis.ts:463, 623, 516, 495, 592` | não | `testes/novo-imovel.test.ts:93`, `testes/novo-imovel-chromium.test.ts:163, 236` | **OK** | — |
| **Passo 2: campos pré-preenchidos pela IA a partir das fotos** (marcados "preenchido pela IA"; obrigatório vazio em destaque) | IA `fotos`/`conteudo` | `novo-imovel.ts:707-738`; só **Características** vem das fotos (`:249-264`, rótulo `:710`); tipo e cidade destacados (`:654-661`, `erro="Obrigatório"`) | `GET /imoveis/:id` (`:225`) com `ia_ambiente` das mídias | `backend/imoveis.ts:623-652` (análise grava `ia_ambiente`, `ia_nota`, legenda) | não | `testes/novo-imovel.test.ts:50, 56`, `testes/novo-imovel-chromium.test.ts:163` | **OK** (parcial por desenho: só características; preço/quartos/área não vêm das fotos) | — |
| **Passo 2: ditado pelo microfone do `urbi-redator`** (campos pré-preenchidos "do ditado") | IA `conteudo` | **não há** (grep `redator|microfone|ditado` em `novo-imovel.ts`: nada) | — | não há rota de extração de campos a partir de texto | não | — | **comando ausente** (nenhum D-nn nem pendência registrada; `plano:424` não cita) | `urbi-redator audio` no passo Dados + `POST /imoveis/:id/preencher` (slot `conteudo`, JSON Schema dos campos do formulário), marcando "preenchido pela IA"; ou D-nn adiando |
| **Passo 3: autorização** (exclusiva, validade, comissão, documento) | `/autorizacoes` | `novo-imovel.ts:740-771`: Registrar autorização `:763-764`, Marcar como assinada `:762`, Anexar documento `:766-768` | `autorizacao-venda.ts:54-79` `POST /autorizacoes`; `:121` `PATCH /autorizacoes/:id`; `novo-imovel.ts:485-486` `POST …/midias {tipo:'documento'}` | `backend/imoveis.ts:682, 706, 463` | não | `testes/novo-imovel.test.ts:93` | **OK** | — |
| **Passo 4: visibilidade (só eu / público)** e **Concluir** | `PATCH /imoveis/:id`; ao ativar, evento `imovel.ativado` | `novo-imovel.ts:773-797` (`escolherOnde` `:508-516`, público só com autorização vigente); Concluir `:819` → `:522-543` | `:533` `PATCH /imoveis/:id {situacao:'ativo', publicado_pagina:true}` ou `:535` `{publicado_pagina:false}` | `backend/imoveis.ts:350-402` (384-389 exige autorização) | **não (sem evento no manifesto)** | `testes/novo-imovel.test.ts:93` ("público só com ela"), `testes/novo-imovel-chromium.test.ts:344` | **comando sem funcionar (só o evento `imovel.ativado`)** | Publicar `imovel_ativado` em `imoveis.ts:391` quando `anunciando` (`:383`) |
| **Voltar / Próximo** | — | `novo-imovel.ts:816, 819` → `:374-388` | — | — | — | chromium `:163` | **OK** | — |
| **Direita: Qualidade ao vivo e o que falta** | — | `novo-imovel.ts:829-885` (`qualidadeAnuncio` de `comum/imoveis.ts`, calculada do formulário antes de salvar) | — | — | — | `testes/novo-imovel-chromium.test.ts:163` | **OK** | — |
| **Direita: "Depois de salvar posso: escrever a descrição, montar o pacote de lançamento, avisar N clientes que combinam"** | — | `novo-imovel.ts:851-866`: descrição (`:864`) e N clientes (`:863`, de `GET /imoveis/:id/contexto` `:228`) ✓; **"montar o pacote de lançamento" não aparece** | `GET /imoveis/:id/contexto` | `backend/imoveis.ts:302` | — | — | **comando ausente (parcial)**: falta a frase/atalho do pacote | Frase + atalho `/estudio?criar=post&imovel=<id>` (mesma correção do Criar conteúdo de P06) |
| **Celular (M3)**: uma coluna, "Passo n de 4", botão grande de fotos, rodapé | — | `novo-imovel.ts:552-563` (`painel: 'centro'`), `:811`, `:682` | — | — | — | chromium `:163` | **OK** | — |

**(a) Endereço:** `/imoveis/novo` ✓ (`enderecos.ts:35`); `?item=<id>` retoma o rascunho e `?passo=` ✓ (`novo-imovel.ts:184-210, 273-276`). `?passo=` fica na URL depois do passo (sobra de #157 em `plano:150`, decisão do dono).

**(b) Estados:** Carregando `novo-imovel.ts:802` ✓. Vazio: não há lista; passo Fotos sem foto mostra dica `:703` ✓. Erro/Não encontrado: `:801` `estadoDaFalha` (404 → "Não encontrado"; `testes/novo-imovel-chromium.test.ts:298`, `testes/novo-imovel.test.ts:134`) ✓. Integração desconectada: não se aplica. IA indisponível: sonda `GET /imoveis/ia` `:188`; a direita diz "A leitura das fotos pela IA não está disponível agora" `:858` e o passo Fotos muda o texto `:679-681` ✓ (não há botão de IA a desabilitar: a leitura é automática no envio).

---

#### P08 · Estúdio (`/estudio?peca=:id`, spec 1469–1488)

Spec seção 7: `/conexoes/instagram` (853; rota real `GET /conexoes`, `POST /conexoes/instagram/iniciar|retorno|desconectar`, `backend/instagram.ts:204-280`). Rotas do Estúdio em `docs/estudio.md`.

| Comando (spec) | Rota e evento na spec | Existe na tela? | Rota que a tela chama | Rota no backend | Evento publicado | Teste | Estado | Proposta |
|---|---|---|---|---|---|---|---|---|
| **Criar** (pedido em texto com microfone, imóvel, objetivo, formatos) → peças em "Falta a arte" | IA `conteudo`; 11.8 cita `peca.pronta` | compositor `urbi-redator audio` `estudio.ts:873-881` (no **centro**, não na esquerda como a spec desenha; `plano:425` aceita) → `novoPedido` `:353-378` (diálogo com imóvel, objetivo, formatos) | `:377` `POST /estudio/pedido` | `backend/estudio.ts:263-288` (textos por IA com `estadoSlot` + `consultar` `:200-213`, senão modelo; `estado: 'rascunho'`) | não (`peca.pronta` fora do manifesto; a tabela de P08 não pede evento) | `testes/estudio.test.ts:86, 183`, `testes/estudio-chromium.test.ts:189, 508` | **OK** | — |
| **Pacote de lançamento** (Criar rápido › Lançamento) | IA `conteudo` | `estudio.ts:902-906` (Criar rápido 2×2, `comum/estudio-pedidos.ts:149-154`) → `criarRapido` `:381-410` | `:408` `POST /estudio/pacote` (Lançamento) ou `:409` `POST /estudio/pedido` (os outros 3) | `backend/estudio.ts:291-314` (post, carrossel e story) | não | `testes/estudio.test.ts:86`, `testes/estudio-padrao-b.test.ts:79`, chromium `:189` | **OK** | — |
| **Enviar arte** (anexa a arte feita fora) | — | `estudio.ts:770-784` área de arrastar (principal quando falta a arte, `:830-838`); "Trocar a arte" no Mais `:747` | `:567-568` `subirArquivo('peca_arquivos')` + `PUT /estudio/pecas/:id/arquivos` | `backend/estudio.ts:360-389` (substitui, volta a rascunho) | não | `testes/estudio.test.ts:86` | **OK** | — |
| **Aprovar** | — | `estudio.ts:715, 720-721` (principal em rascunho) | `POST /estudio/pecas/:id/aprovar` | `backend/estudio.ts:391-409` (checagens, CRECI na legenda só se couber) | não | `testes/estudio.test.ts:86`, `testes/creci.test.ts`, chromium `:189, 686` | **OK** | — |
| **Agendar** → evento segregado `publicacao_programada` na hora (D-75) | Instagram; `publicacao_programada` | `estudio.ts:615-633` (Publicar › Agendar) → `agendar` `:597-612` | `:611` `POST /estudio/pecas/:id/agendar` | `backend/instagram.ts:310-335`; `req.eventos.agendar('publicacao_programada', …, { em })` `:326`; listener `aoPublicacaoProgramada` `:406-420` | **`publicacao_programada`** (manifesto ✓) | `testes/instagram.test.ts:138`, `testes/eventos-sem-dado-pessoal.test.ts` | **OK** | — |
| **Publicar agora** (cria o contêiner e publica) | Instagram; 11.8/13.1 citam `publicacao.feita`/`publicacao.falhou` | `estudio.ts:615-633` (Publicar › agora) → `publicar` `:647-663` | `:653` `POST /estudio/pecas/:id/publicar` | `backend/instagram.ts:290-304` → `publicarPeca` `:150-197` (contêiner, token, `atualizarSe`) | **não** (`publicacao.feita`/`falhou` fora do manifesto; a tabela de P08 não pede) | `testes/instagram.test.ts:101, 217, 297` | **OK** (comando); eventos de 11.8 ausentes | Se o dono quiser os `publicacao.*`: declarar e publicar em `instagram.ts:192-196` (só `peca_id`) |
| **Baixar** (download do arquivo ou pacote, **a qualquer momento**) | — | `estudio.ts:641-645` só pela opção "Baixar a arte e a legenda" do diálogo Publicar (`:619`, peça aprovada/erro); fora disso, "Ver a arte" no Mais `:741` | nenhuma rota: `window.open` de cada imagem `:636-638` + legenda na área de transferência `:703-713` | — (URLs assinadas vêm em `GET /estudio/pecas`) | não | — (nenhum teste de `baixar`/`verArte`) | **comando sem funcionar (parcial)**: abre as imagens em abas em vez de baixar, não há "pacote", e não está disponível em todo estado | Botão "Baixar" no cartão em todo estado com arte, por `urbi-visualizador-arquivo` (já usado para fotos da instrução `:797`) ou `<a download>`; pacote (zip com legenda) é rota nova |
| **Copiar descrição** | — | `estudio.ts:832` → `copiarInstrucao` `:496-507`; "Ver/Esconder descrição" `:834, 746` | `:472` `GET /estudio/pecas/:id/instrucao?ferramenta&referencias` | `backend/estudio.ts:438-457` (`promptFerramenta`, fotos públicas, logo, referências) | não | `testes/estudio.test.ts:121, 199`, chromium `:189` | **OK** | — |
| **Abrir o Canva IA** / **Usar outra ferramenta** | Canva IA fora do app | `estudio.ts:833` (`window.open(abrir)`), `:750` → `outraFerramenta` `:510-527` | `GET …/instrucao?ferramenta=` | `backend/estudio.ts:443` `ferramentaValida` | não | `testes/estudio.test.ts:199` | **OK** | — |
| **Tentar de novo** (erro) | — | `estudio.ts:724-725` → `publicarOpcoes` | idem Publicar | idem | não | `testes/instagram.test.ts:297, 338` | **OK** | — |
| **Menu "mais"**: Textos, Trocar a arte, Voltar a rascunho, Publiquei por fora, Copiar legenda, Remover, Cancelar agendamento, Destravar, Ver no Instagram | — | `estudio.ts:738-757, 718-735` | `:546` `PATCH /estudio/pecas/:id`; `:752` `POST …/rejeitar`; `:674` `POST …/publicada-fora`; `:681` `PATCH …/remover`; `:727` `POST …/cancelar-agendamento`; `:729` `POST …/destravar` | `backend/estudio.ts:337, 411, 422`; `backend/instagram.ts:375, 337, 360` | não | `testes/estudio.test.ts`, `testes/instagram.test.ts:198, 217, 297`, chromium `:733` | **OK** | — |
| **Listas por etapa com contagem** (Todas · Falta a arte · Para aprovar · Prontas para publicar · Agendadas · Publicadas) | D-90 | `estudio.ts:908-918`, `?etapa=` `:329-332`; nomes em `comum/estudio-pedidos.ts:89-96` (iguais aos da spec) | `GET /estudio/pecas` (`:270`) | `backend/estudio.ts:246-257` | — | `testes/estudio-padrao-b.test.ts:85` | **OK** | — |
| **Próximo passo escrito** e **uma ação principal por estado** | D-86 | `estudio.ts:829` (`proximoPasso`), `:817, 830-846` (`acaoPrincipal`, `comum/estudio-pedidos.ts:114-139`) | — | — | — | `testes/estudio-padrao-b.test.ts:56`, chromium `:189` | **OK** | — |
| **Direita: Esta semana** | — | `estudio.ts:990-997` (`estaSemana`) | `GET /estudio/pecas` | — | — | `testes/estudio-padrao-b.test.ts:85` | **OK** | — |
| **Direita: conta do Instagram conectada** | `GET /conexoes` | mostrada na **esquerda** `estudio.ts:885-900` (não na direita) | `:273` `GET /conexoes` | `backend/instagram.ts:204-217` | — | chromium `:300` | **OK** (lugar diferente; `plano:425` registra "@conta conectado" no título) | — |
| **Direita: biblioteca de arquivos** | — | `estudio.ts:998-1008` (logo, foto, referências; atalho "Sua marca" `/ajustes/marca`) | `:271` `GET /estudio/marca` | `backend/estudio.ts:93-98` | — | `testes/marca.test.ts` | **OK** | — |
| **Direita: créditos do mês** | com o Mensageiro (D-87) | não há | — | — | — | — | **por decisão (D-87; `plano:425` "Sem Créditos do mês")** | — |
| **CRECI ausente: uma linha da dica, nunca bloqueio** | D-90, D-93 | `estudio.ts:1009` `avisoCreci()` | `creci` em `GET /estudio/marca` | `backend/estudio.ts:80` | — | `testes/creci.test.ts`, `testes/estudio.test.ts:120-121` | **OK** | — |
| **Novo post** no menu Criar (11.7) → P08 com o Criar aberto | rotas do Estúdio | `frontend/criar.ts:193-194` → `/estudio?criar=post`; `estudio.ts:218, 294-301` abre o Novo pedido após a carga | `POST /estudio/pedido` (ao confirmar) | `backend/estudio.ts:263` | não | `testes/estudio-chromium.test.ts:655, 812, 1160`, `testes/criar.test.ts` | **OK** | — |
| **Celular: enviar a arte pela câmera ou galeria** | — | `estudio.ts:773-784` (`accept=image/jpeg,image/png`; sem `capture`, o navegador oferece câmera e galeria) | idem Enviar arte | idem | — | — | **OK** | — |

**(a) Abas/visões e endereço:** a spec escreve `/estudio?peca=:id`; o real é `?item=<peça>` ou `?pedido=<id do pedido>` e `?etapa=` (`estudio.ts:91-92, 136-139, 317-332`; `plano:425` registra `/estudio?pedido=&item=&etapa=`). Rota real: `?item=` no lugar de `?peca=`. As "listas por etapa" são o filtro `?etapa=` da lista única (D-90).

**(b) Estados:** Carregando `estudio.ts:1023` ✓. Vazio `:969-970` (sem pedido / escolha um pedido; o compositor fica) ✓. Erro: carga inicial `:1023` `estadoDaFalha`; com dados, faixa "Não foi possível atualizar o Estúdio" com Tentar de novo `:944-949` ✓ (chromium `:333, 419`). Não encontrado `:968` ✓ (`?pedido=` de outra conta limpo ao nascer `:311-313`). **Integração desconectada**: faixa `:953-958` por `estadoTela('desconectada')` (`frontend/estados.ts:57-61`, "Reconectar" → `/ajustes/conexoes` `:31-32`) ✓ (chromium `:300`). Crédito: não se aplica (D-87). **IA indisponível**: faixa `:950-952` com `DICA_IA_INDISPONIVEL`, sonda `ia` em `GET /estudio/pecas` (`backend/estudio.ts:216-224, 253-255`); os botões de criar seguem ativos porque os textos saem do modelo (D-89) ✓ (chromium `:300`).

---

#### P09 · Página (`/pagina`; apelido `/minha-pagina`, spec 1490–1500)

Spec seção 7: `/paginas` GET/PUT/POST (850) → rotas reais `GET/PUT /pagina`, `GET /pagina/previa`, `POST /pagina/publicar|atualizar|despublicar|sugerir-textos` (`backend/pagina.ts:91-262`). Página pública `/p?c=<endereço>` (D-71): `backend/publico.ts:59` (`/vitrine/pagina`), `frontend/publico/pagina-publica.ts`.

| Comando (spec) | Rota e evento na spec | Existe na tela? | Rota que a tela chama | Rota no backend | Evento publicado | Teste | Estado | Proposta |
|---|---|---|---|---|---|---|---|---|
| **Publicar** | rotas da Página; 11.8/13.1 evento `pagina.publicada` | `pagina.ts:326-329` (só enquanto não está no ar; desabilitado até a página ser salva `?desabilitado=${!v.salva}`) | `:271/257` `POST /pagina/publicar` | `backend/pagina.ts:150-186` (ingressos `wh` do formulário e do clique, `sincronizarTudo`) | **não (sem evento no manifesto)** | `testes/pagina.test.ts:99, 365`, `testes/creci.test.ts`, `testes/marca.test.ts` | **comando sem funcionar (só o evento)** | Declarar `pagina_publicada` (só `endereco`) e publicar em `pagina.ts:184`; ou D-nn dispensando |
| **Endereço e estado (publicada/rascunho)**; **Nome e endereço** | `PUT /pagina` | `pagina.ts:321-335` (URL, selo "Publicada desde…"/"Rascunho"); `:333` → `nomeEEndereco` `:154-164` | `:136` `PUT /pagina` | `backend/pagina.ts:120-148` (`ENDERECO_EM_USO` 409) | não | `testes/pagina.test.ts:71, 99` | **OK** | — |
| **Blocos com subir, descer e mostrar** (apresentação, destaques, todos os imóveis, sobre mim, bairros, formulário, WhatsApp e Instagram) | `PUT /pagina` | `pagina.ts:298-313` (↑↓ `:305-308`, checkbox Mostrar `:309-310`), lista `:340-342`; blocos de `comum/pagina.ts` (`ROTULO_BLOCO`) | `mover` `:166-172` e `alternar` `:174-177` → `PUT /pagina` | `backend/pagina.ts:120` | não | `testes/pagina.test.ts:71`, `testes/pagina-numeros-chromium.test.ts:137, 227` | **OK** (setas em vez de arrastar: exceção nomeada 11.9 B7 (b), `plano:119` item 3) | — |
| **Selecionar bloco** (`?item=`) com o bloco contornado na prévia | — | `pagina.ts:111-120, 340-342`; `destacar` `:376` | — | — | — | chromium `:137` ("prévia com destaque") | **OK** | — |
| **Pré-visualização Celular · Computador** (dados de `GET /pagina/previa`; exceção `pc-previa-pagina`) | `GET /pagina/previa` | `pagina.ts:353-380` (`urbi-botao-alternar`), `previa-pagina.ts:139-160` (390 px no Celular) | `:97` `GET /pagina/previa` | `backend/pagina.ts:103-118` | — | `testes/pagina.test.ts:387`, chromium `:137` | **OK** | O modo Celular/Computador fica só em memória (`pagina.ts:50, 360`), não na URL (11.0 pede "aba… sempre na URL"); opcional `?dispositivo=` |
| **Ajustes do bloco selecionado** (resumo e Editar bloco) | `PUT /pagina` | `pagina.ts:403-413` → `editar` `:185-214` (diálogo `urbiVerso.formulario`; destaques listam `GET /imoveis?publicado_pagina=true` `:180`) | `PUT /pagina` | `backend/pagina.ts:120` | não | `testes/pagina.test.ts:71` | **OK** (diálogo em vez de campos na coluna: pendência B7 (4), `plano:119`) | — |
| **Marca** (a marca única de Ajustes, D-85) | `/estudio/marca` | `pagina.ts:414-423` (cartão com foto e atalho "Editar em Ajustes › Conta e marca" `/ajustes?aba=conta` `:420`); edição em `frontend/telas/marca.ts:91-161` | `marca.ts:65` `GET /estudio/marca`, `:106` `PUT /estudio/marca`, `:130, 149` `POST /estudio/marca/arquivos`, `:114` `POST /estudio/marca/republicar`, `:159` `PATCH …/arquivos/:id/remover` | `backend/estudio.ts:93, 100, 140, 131, 172` | não | `testes/marca.test.ts`, `testes/ajustes-chromium.test.ts` | **OK** | — |
| **Últimos 30 dias** (visitas "—"; contatos do formulário) | — | `pagina.ts:424-432` | `numeros` em `GET /pagina` (`:75`) | `backend/pagina.ts:83-89` (`contatosDaPagina`), `visao` | — | `testes/pagina.test.ts:439` | **OK** (visitas "—": pendência B7 (1), `plano:119`) | — |
| **Copiar link** | — | `pagina.ts:434` (principal quando no ar) → `copiar` `:279-286` | nenhuma (`url` de `GET /pagina`, `urlCompleta` `:106-109`) | — | — | — (não há teste do clique) | **OK** | — |
| **"Atualizar agora" no menu "mais"** | rotas da Página | `pagina.ts:436` → `acao('/pagina/atualizar')` `:252-271` | `POST /pagina/atualizar` | `backend/pagina.ts:188-196` (`sincronizarTudo`; 422 se fora do ar) | não | **nenhum** (`grep pagina/atualizar testes/`: vazio) | **OK, sem teste** | Um caso em `testes/pagina.test.ts` (publica, muda imóvel, atualizar, confere a vitrine; A × B) |
| **Tirar do ar** (Mais; `docs/minha-pagina.md:33, 64`) | — | `pagina.ts:437` → `despublicar` `:274-277` (confirmação) | `POST /pagina/despublicar` | `backend/pagina.ts:198-222` (revoga ingressos `wh`, `despublicarTudo`) | não | `testes/pagina.test.ts:365`, `testes/marca.test.ts`, `testes/troca-de-conta-gestos-chromium.test.ts` | **OK** | — |
| **Abrir minha página** (Mais) | — | `pagina.ts:435` `window.open` | — | — | — | — | **OK** | — |
| **Refazer a página com IA** (página "montada pela IA e ajustável") | IA `conteudo` | `pagina.ts:345-346` → `refazerComIa` `:217-249` (sugestão → confirmação → `PUT /pagina` com `gerada_por_ia`) | `:229` `POST /pagina/sugerir-textos`; `:239` `PUT /pagina` | `backend/pagina.ts:225-262` (sonda `estadoSlot` `:231-235` → 503 `IA_INDISPONIVEL`; `consultar` `:254`) | não | `testes/creci.test.ts`, `testes/troca-de-conta-gestos-chromium.test.ts` | **OK** | Ver (b): o botão fica sempre habilitado; 11.0.4 pede desabilitado com dica quando o slot não está liberado |
| **CRECI na capa só com CRECI no perfil; sem ele não aparece** (D-93) | — | `pagina.ts:290` (DICA_BLOCO), aviso `:421` `avisoCreci()` | `sem_creci` em `GET /pagina` | `backend/pagina.ts` (`visao`), `:247` | — | `testes/creci.test.ts` | **OK** | — |
| **Perguntar ao Assistente** | `POST /assistente/perguntar` | `pagina.ts:440` `abrirAssistente()` | — | `backend/assistente.ts:96` | — | `testes/assistente.test.ts` | **OK** | — |

**(a) Abas/visões e endereço:** `/pagina` ✓ e apelido `/minha-pagina` ✓ (`frontend/enderecos.ts:37, 39`); bloco selecionado em `?item=<tipo>` ✓ (`pagina.ts:111-120`). O seletor Celular · Computador não vai à URL (`pagina.ts:50`).

**(b) Estados:** Carregando `pagina.ts:447-449` ("Carregando a página…") e prévia `:377-378` ✓. Vazio: não se aplica (a página nasce como sugestão; sem imóvel marcado há o `urbi-banner` `:336-338`) ✓. Erro: carga `:448` `estadoDaFalha` (Tentar de novo); prévia `:379` com Tentar de novo; com dados, `notificar` `:85` ✓. Não encontrado: não se aplica (página da própria conta). Integração: não se aplica. Crédito: não se aplica. **IA indisponível: parcial** — a tela não sonda o slot (`estadoSlot` só no backend `pagina.ts:231`); "Refazer a página com IA" segue habilitado e a falta de IA só aparece como alerta de erro depois do clique (`pagina.ts:242`), não como botão desabilitado com a dica "IA indisponível agora" (11.0.4).

---

#### Resumo por tela

| Tela | OK | ausente | sem funcionar | por decisão |
|---|---|---|---|---|
| P06 | 14 | 0 | 3 (Criar conteúdo sem o imóvel; Enviar a cliente não envia; visibilidade sem evento) | 2 (mandato resumido/Definir mandato; filtro de visibilidade) |
| P07 | 8 | 2 (ditado por microfone; frase do pacote de lançamento) | 2 (só os eventos `imovel.criado` e `imovel.ativado`) | 0 |
| P08 | 18 | 0 | 1 (Baixar: abre em abas, sem pacote, não em todo estado) | 1 (créditos do mês, D-87) |
| P09 | 13 (1 sem teste: Atualizar agora) | 0 | 1 (só o evento `pagina.publicada`) | 0 |

#### As descobertas mais importantes

1. **Nenhum evento de domínio deste grupo existe no manifesto** além de `publicacao_programada`: `imovel.criado`, `imovel.ativado`, `imovel.visibilidade_mudou`, `pagina.publicada` (e os de 11.8 `peca.pronta`, `publicacao.feita/falhou`) não são declarados nem publicados — `backend/imoveis.ts`, `estudio.ts`, `pagina.ts` e `envios.ts` não chamam `req.eventos.publicar`. Os comandos funcionam; o que falta é o rastro no barramento (e o que a Sentinela/rotinas assinariam).
2. **Dois comandos de P06 param no meio do caminho:** "Criar conteúdo" leva ao Estúdio **sem o imóvel** (`ficha-imovel.ts:483` → `estudio.ts:363` com a seleção vazia) e "Enviar" em Clientes que combinam só **navega para a ficha do cliente** (`imoveis.ts:372`), onde o corretor ainda escolhe o imóvel de novo; nenhum `POST /envios` sai de P06.
3. **"Baixar" do Estúdio não baixa** (`estudio.ts:636-645` abre cada imagem numa aba e copia a legenda), não existe "pacote" e só aparece pelo diálogo Publicar (peça aprovada) — a spec pede "a qualquer momento".
4. Pequenas divergências de 11.0.4 com a IA: na ficha do imóvel os botões de IA **somem** em vez de ficarem desabilitados com a dica (`ficha-imovel.ts:523-526, 544-546`); na Página não há sonda e o botão "Refazer com IA" só avisa depois do clique (`pagina.ts:242`). O Estúdio e o Novo imóvel tratam o estado como pede.
5. Sem teste: `POST /pagina/atualizar` (rota existe, `backend/pagina.ts:188`, nenhum teste a chama); o clique em "resolver" do "O que falta" e o `baixar` do Estúdio também não têm teste próprio.
6. Ausências de P07 sem decisão registrada: o **ditado por microfone** (`urbi-redator`) para pré-preencher os dados não existe (só as características vêm das fotos) e a frase "montar o pacote de lançamento" não está na coluna da direita.

### Grupo C · P10, P12, P13, P14

Diagnóstico só de leitura (branch `docs/diagnostico-visual`), 07/11/2026. Caminhos relativos a `apps/portal_corretor/`, salvo `specs/…` (relativos a ``). P11 Mensageiro fica de fora (não existe: D-78).

Convenções: "não (sem evento no manifesto)" = o manifesto não declara o evento (os 19 declarados são os de `manifesto.json`, chave `eventos`; nenhum dos eventos desta tela está lá). Estado "comando sem funcionar (só o evento)" = o botão existe e a rota faz o efeito, mas o evento que a spec pede não é publicado; o brief manda classificar assim, e o resumo separa esse caso.

---

#### P10 · Números (`/numeros?relatorio=funil`; apelido `/desempenho`) — spec linhas 1502–1512

| Comando (spec) | Rota e evento na spec | Existe na tela? | Rota que a tela chama | Rota no backend | Evento publicado | Teste | Estado | Proposta |
|---|---|---|---|---|---|---|---|---|
| Escolher relatório na esquerda: Resumo · Funil e conversão · Origem dos contatos · Conteúdo · Negociação | `GET /desempenho` (seção 7); P10 na 11.8: `/numeros`; sem evento | Sim: `frontend/telas/desempenho.ts:34-42` (`RELATORIOS`), lista em `:410-427`, clique `:426` → `?relatorio=` | `GET /numeros?dias=&origem=` (`desempenho.ts:113`); Negociação: `GET /numeros/negociacao?dias=` (`:93`) | `backend/numeros.ts:45-87`; `backend/numeros-negociacao.ts:134-174` | — (a spec 11.8 não prevê evento para P10) | `testes/numeros-p10.test.ts:96`, `testes/numeros-negociacao.test.ts:94`, `testes/pagina-numeros-chromium.test.ts:137` | **OK** (rota real: `/numeros`, não `/desempenho`) | — |
| Relatórios Tempo de resposta · Mensageiro · Créditos ("com os blocos 6 e 7") | `/desempenho`; Créditos: `GET /consumo` (seção 7) | Tempo de resposta e Mensageiro aparecem na lista (`desempenho.ts:38,40`) e o centro mostra "em breve"/"chega com o WhatsApp" (`relatorioSemFonte`, `:322-330`, escolhido em `:394`); Créditos não aparece | nenhuma | nenhuma (`numeros.ts:84` lista `tempo_primeiro_atendimento`, `agentes` como `indisponiveis`) | não | `numeros-p10.test.ts` só confere o centro dos existentes | **por decisão** (D-78: sem WhatsApp/Mensageiro; D-87: créditos só com o Mensageiro; pendência B7 item 5 em `specs/plano_de_implementacao.md:119`) | Manter até os blocos 6 e 7; quando chegarem, trocar `emBreve` e ligar `/consumo` |
| Período e comparação (centro) | `GET /desempenho` com período; 11.2: 30 dias com os 30 anteriores | Sim: chips de período `desempenho.ts:165-166` (`PERIODOS` `:27-32`), toggle Comparar `:167-168`; estado na URL (`?dias=`, `?comparar=0`, `lerFiltros` `:63-70`, `mudar` `:128-135`) | `GET /numeros?dias=` (`:113`) | `numeros.ts:48,54,63-64` (`periodos(dias)`, atual e anterior) | — | `numeros-p10.test.ts:96`; `pagina-numeros-chromium.test.ts:137` | **OK** | — |
| Filtro de origem ("Todas as origens"; está no mockup e no R.8.1, não na prosa de P10) | — | Sim: `desempenho.ts:171-174` (`?origem=`), escondido no relatório Negociação | `GET /numeros?origem=` (`:113`) | `numeros.ts:51-53,70` | — | `numeros-p10.test.ts:96` ("origem") | **OK** (extra ao texto de P10) | — |
| Quatro números acima da dobra: leads, conversão total, vendas, comissão prevista | 11.2 (fórmulas) | Sim, no Resumo: `desempenho.ts:181-186`; no Funil, outros quatro (`:221-224`: Contatos, Contato→visita, Visita→proposta, Ganhos) | `GET /numeros` | `numeros.ts:63-64,75` (`calcularKpis`, `previsaoPonderada` em `comum/numeros.ts`) | — | `testes/numeros.test.ts:12,78` (KPIs conferidos à mão) | **OK** | — |
| Barras da coorte (até onde os contatos chegaram) | 11.2: coorte = negócios criados no período | Sim: `desempenho.ts:234-237` (`urbi-grafico-colunas`), taxas no detalhe `:241-248` | `GET /numeros` | `numeros.ts:63` (`atual.etapas`) | — | `numeros.test.ts:12`; `numeros-p10.test.ts:96` | **OK** | — |
| Motivos de perda | 11.2: distribuição de `motivo_perda` | Sim: `desempenho.ts:264-269` ("Por que perdemos") | `GET /numeros` | `numeros.ts:63` (`atual.motivos_perda`) | — | `numeros.test.ts:12` | **OK** | — |
| Contatos por horário (Lais; "horário de atendimento") | 11.2 (leads por horário) | Sim: `desempenho.ts:250-263`; horário comercial fixo 8h–19h (`comum/numeros.ts:201`) | `GET /numeros` | `numeros.ts:77` (`leadsPorHora`, fuso do contexto) | — | `numeros-p10.test.ts:17,96` | **OK** (pendência B7 item 2: início/fim fixos até Ajustes › Horário de atendimento ter os campos; `plano_de_implementacao.md:119`) | Ver Horário de atendimento abaixo |
| Direita: **O que melhorar** com ação "Ver os N clientes" | "leitura com ação" | Sim: `desempenho.ts:452-458`; `verClientes` `:429-435` abre `/clientes?perdido_motivo=&perdido_desde=(&perdido_origem=)` | `GET /numeros` (`o_que_melhorar`); o botão navega para Clientes (filtro `perdido_*` de `GET /contatos`) | `numeros.ts:65,80` (`oQueMelhorar`) ; filtro em `backend/crm.ts` (`GET /contatos`) | — | `numeros-p10.test.ts:17,96,152`; `pagina-numeros-chromium.test.ts:329,357-360` | **OK** | — |
| Direita: melhores origens | — | Sim: `desempenho.ts:461-471` | `GET /numeros` (`melhores_origens`) | `numeros.ts:78` | — | `numeros-p10.test.ts:17,96` | **OK** | — |
| Direita: **Exportar CSV** | 7.4: CSV `;`, cabeçalho em português, dinheiro com vírgula | Sim: `desempenho.ts:474`; `exportarCsv` `:437-447` monta o arquivo no navegador com `linhasCsvNumeros` (`comum/numeros.ts:299-324`) | nenhuma rota própria (usa a resposta de `GET /numeros` já carregada) | — | — | `numeros-p10.test.ts:64` (CSV puro); `pagina-numeros-chromium.test.ts:336` (botão) | **OK** (observação: o CSV cobre só o relatório geral; os KPIs do relatório **Negociação** não entram, `linhasCsvNumeros` recebe só `RespostaNumeros`) | Incluir as linhas de Negociação no CSV quando esse relatório estiver aberto |
| Relatório Negociação: propostas recebidas, taxa de acordo, desconto médio sobre o preço pedido, rodadas até o acordo, objeções mais frequentes, % sugestões aprovadas sem edição (+ ZOPA, 11.2) | `GET /numeros` (11.8); fórmulas 11.2 | Sim: `desempenho.ts:345-388` (`relatorioNegociacao`), 7 KPIs e gráfico de objeções | `GET /numeros/negociacao?dias=` (`:93`) | `numeros-negociacao.ts:134-174` (cálculo em `comum/numeros-negociacao.ts`; só agregados, mandato lido só para preço pedido e recuo `:118-119,147-159`) | — | `numeros-negociacao.test.ts:14,94` (KPIs à mão, isolamento, sem valor sigiloso) | **OK** (rota real: `/numeros/negociacao`) | — |
| Custo por lead / por venda (11.2) e `GET/PUT /custos-origem` "Investimento por canal/mês — Números" (seção 7, linha 838) | `/custos-origem` | Não há botão nem campo para informar investimento | nenhuma | nenhuma (`numeros.ts:84` declara `custo_por_lead` em `indisponiveis`) | — | — | **comando ausente** (não está na prosa de P10, só na seção 7 e na 11.2) | Decidir se entra na 1.2 (campo na direita de Origem dos contatos) ou vai ao horizonte; registrar D-nn |
| "Perguntar ao Assistente" na direita | — (11.7: Assistente é do trilho) | Sim, extra: `desempenho.ts:475` → `abrirAssistente()` | — | — | — | — | **OK** (extra, não pedido em P10) | Conferir com o princípio 14 (uma ação principal; o trilho já abre o Assistente) |
| Apelido `/desempenho` | 11.0.5 / D-103 | Sim: `frontend/enderecos.ts:42` | — | — | — | `numeros-p10.test.ts:160` | **OK** | — |

**(a) Abas/visões e endereço (11.0.5):** `/numeros?relatorio=<id>` com `?dias=`, `?origem=`, `?comparar=0` (`desempenho.ts:63-70,128-135`; `?item=` antigo ainda vale); apelido `/desempenho` (`enderecos.ts:42`). Observação: sem `?relatorio=` abre **Resumo** (`lerFiltros` `:68`, `RELATORIOS[0]`), não `funil` como o título da spec sugere; a lista de relatórios tem Tempo de resposta e Mensageiro, mas não Créditos (D-87).

**(b) Estados 11.0.4:** carregando: `estadoTela('carregando')` no centro (`desempenho.ts:391,397`); a coluna direita fica vazia enquanto carrega (`contexto()` devolve `nothing`, `:450-451`) — sem esqueleto, pequeno desvio. Vazio: por relatório (`:236,273,323-330`). Erro: `estadoDaFalha` com "Tentar de novo" (`:391,397`) e faixa de erro quando há dado antigo (`:404`). Sem permissão/outra conta: `estadoDaFalha` → "Não encontrado" (`frontend/estados.ts:78-82`). Integração desconectada: não se aplica (sem integração). IA indisponível: não se aplica (nenhum botão de IA; o Assistente trata o próprio estado em P05). Crédito esgotado: não se aplica.

---

#### P12 · Ajustes — Conexões (`/ajustes/conexoes`) — spec linhas 1520–1524

| Comando (spec) | Rota e evento na spec | Existe na tela? | Rota que a tela chama | Rota no backend | Evento publicado | Teste | Estado | Proposta |
|---|---|---|---|---|---|---|---|---|
| Cartão **Instagram**: conectado, tipo de conta, o que pode publicar | `GET /conexoes/instagram` (seção 7, linha 853); `GET /canais` (linha 819) | Sim: `frontend/telas/conexoes.ts:130-138` (badge conectado/"precisa de atenção", `@usuario`, comercial × criador, aviso de stories) | `GET /conexoes` (`conexoes.ts:75`) | `backend/instagram.ts:204-216` | — | `testes/instagram.test.ts:65` (backend); `testes/ajustes-chromium.test.ts:249-253` (tela) | **OK** (rota real: `GET /conexoes`) | — |
| **Conectar Instagram** (login do Instagram, D-75) | `POST /conexoes/instagram`; evento auditável `canal.conectado` | Sim: `conexoes.ts:145` (botão); `conectar()` `:82-100` gera `state`, chama a rota e vai para a Meta; volta tratada em `iniciar()` `:38-70` (`?code=&state=`) | `POST /conexoes/instagram/iniciar` (`:94`); `POST /conexoes/instagram/retorno` (`:58`) | `instagram.ts:220-234` (iniciar), `:238-270` (retorno: troca o código, confere tipo de conta, grava `canais_sociais` com token em `segredo`) | **não** (sem evento no manifesto; `canal_conectado` não existe e `instagram.ts:238-270` não publica nada) | `instagram.test.ts:65` (503 sem app Meta, 422 state, URL da Meta, retorno, `CONTA_PESSOAL`, isolamento A×B); `testes/creci.test.ts:189`; `ajustes-chromium.test.ts:250` | **comando sem funcionar (só o evento)** — a conexão funciona; falta o evento auditável que a spec 13.1 pede | Declarar `canal_conectado` (`auditavel`) no manifesto (sobe `versao`) e publicar em `instagram.ts` após `dados.criar('canais_sociais', …)` (`:258-262`), só com ids; ou registrar D-nn adiando a trilha auditável |
| **Desconectar** | `DELETE /conexoes/instagram`; evento auditável `canal.desconectado` | Sim: `conexoes.ts:141`; `desconectar()` `:102-113` com confirmação | `POST /conexoes/instagram/desconectar` (`:106`) | `instagram.ts:272-280` (`desconectado_em`, `token: null`) | **não** (sem evento no manifesto) | Só com API simulada no Chromium: `testes/troca-de-conta-ajustes-chromium.test.ts:199-250`; **o handler do backend não tem teste** (`instagram.test.ts` nunca chama `desconectar`) | **comando sem funcionar (só o evento)**; além disso sem teste de backend | Mesma proposta do evento; acrescentar em `instagram.test.ts` um caso "desconectar apaga o token e `GET /conexoes` volta `null`" |
| **Reconectar** (docs `docs/conexoes.md:23`; não está em P12) | — | Sim: `conexoes.ts:140` → `conectar()` | as de Conectar | as de Conectar | não | `ajustes-chromium` não exercita | **OK** (extra) | — |
| Cartão **WhatsApp** com 3 passos (entrar com a Meta · número · confirmar) "quando o bloco 6 chegar" | `GET/POST/DELETE /conexoes/whatsapp` (seção 7, linha 852) | Cartão existe com "ainda não disponível" e texto (`conexoes.ts:150-153`); sem os 3 passos nem ação | nenhuma | nenhuma (`rotas.txt` não tem `/conexoes/whatsapp`) | não | `ajustes-chromium.test.ts:251` | **por decisão** (D-78; pedidos ao shell 1 e 2, `specs/pedidos_ao_shell.md:5-16`, P-31/P-32) | Manter; entra com o bloco 6 |
| Cartão **Agenda** (fase 6) | — | Sim: `conexoes.ts:154-157` com badge "fase 6" | nenhuma | nenhuma | não | `ajustes-chromium.test.ts:252` | **por decisão** (spec: fase 6) | — |
| Direita: "Por que conectar aqui" em uma frase + aviso de que pode desconectar | — | Sim: `frontend/telas/ajustes.ts:34-37` (texto da seção `conexoes`), montado em `:103-104` | — | — | — | `ajustes-chromium.test.ts:253` | **OK** | — |
| **Não pede CRECI** (D-93) | — | Sim: aviso do CRECI só na seção `conta` (`ajustes.ts:105`); nenhuma checagem em `instagram.ts` | — | — | — | `creci.test.ts:189` ("sem CRECI: publica agora e agenda no Instagram") | **OK** | — |
| "Testar publicação" (mockup P12; spec 9.2 "publicação de teste privada") | — | Não | — | — | — | — | **por decisão** (D-75: a API não tem publicação de teste; vira a checagem do tipo de conta `instagram.ts:252-254`; R.8.1 §12 em `plano_de_implementacao.md:454` ainda aberta para o dono) | Fechar a R.8.1 §12 com D-75 (aceitar como está) |
| Endereço de retorno para a equipe (Copiar endereço) | — | Sim, extra: `conexoes.ts:146-148` (`copiarRetorno` `:115-123`), só quando a Meta não está configurada | `GET /conexoes` (`retorno`) | `instagram.ts:214` | — | `instagram.test.ts:65` (`retorno`) | **OK** (extra; `docs/conexoes.md:34`) | — |

**(a) Abas/visões e endereço:** `/ajustes/conexoes` e `/ajustes?aba=conexoes` (`frontend/enderecos.ts:49`; `comum/ajustes.ts:39-45`; troca de seção por `replaceState` em `ajustes.ts:89-93`); `/ajustes/conexoes` é também o `redirect_uri` cadastrado na Meta (`instagram.ts:232`; `instagram.test.ts:65` confere `…/portal_corretor/ajustes/conexoes`). Menu de Ajustes à esquerda com as 7 seções (`comum/ajustes.ts:9-17`; sem "Plano e créditos", D-87). Testes: `testes/ajustes.test.ts:22,35`, `ajustes-chromium.test.ts:132,249,261`.

**(b) Estados 11.0.4:** carregando `urbi-loading` (`conexoes.ts:127`); erro: banner + "Tentar de novo" (`:126`); vazio = "Conectar Instagram" (`:144-145`) ou "ainda não configurada pela equipe" (`:146-148`); **integração desconectada**: badge "precisa de atenção" + banner com `ultimo_erro` (`:133-137`) e, nas outras telas, a faixa "Seu Instagram desconectou. Reconectar" leva para cá (`frontend/estados.ts:31-32,57-61`; usada em `frontend/telas/estudio.ts:955-956`); sem permissão/outra conta: 403/404 viram o banner de erro genérico (`:77` usa `e.message`, não `estadoDaFalha`) — pequeno desvio de D-40; IA indisponível e crédito: não se aplicam.

---

#### P13 · Ajustes — Conta e marca (`/ajustes/conta`) — spec linhas 1526–1530

##### Seu perfil e Sua marca

| Comando (spec) | Rota e evento na spec | Existe na tela? | Rota que a tela chama | Rota no backend | Evento publicado | Teste | Estado | Proposta |
|---|---|---|---|---|---|---|---|---|
| Seu perfil: **foto** | `/conta` (11.8) | Sim, mas no cartão **Sua marca** (D-85, a foto é da marca): `frontend/telas/marca.ts:180` ("Sua foto"), `enviarArquivo('foto')` `:126-133` | `POST /estudio/marca/arquivos {tipo:'foto'}` (`:130`), upload em 2 passos (`subirArquivo`) | `backend/estudio.ts:140-166` (foto ressincroniza seleção e portal `:163-164`) | — | `testes/marca.test.ts:216` | **OK** (lugar diferente da spec: na marca, não no perfil) | — |
| Seu perfil: **nome profissional** | `/conta` | Só leitura do nome do usuário do shell (`frontend/telas/conta.ts:128`, `urbiVerso.usuario()?.nome`); sem campo editável; o backend de `meu-perfil` só aceita `creci` e `telefone` (`comum/conta.ts:110-121`) | — | — | — | — | **comando ausente** | Decidir se o nome do shell basta (D-nn) ou criar `nome_profissional` em `perfis_corretor` (sobe `versao`) |
| Seu perfil: **CRECI opcional**, sem estado de verificação, frase de aviso quando vazio | `/conta`; D-93 | Sim: campo "CRECI (opcional)" `conta.ts:77`; sem selo (`:129`); aviso na direita `ajustes.ts:105,120-150` (`avisoCreci`, só quando nem o pessoal nem o jurídico existem) | `PUT /conta/meu-perfil` (`conta.ts:76`, via `editar` `:56-72`) | `backend/conta.ts:61-71` (`validarMeuPerfil` em `comum/conta.ts:110-121`: fora do formato salva com aviso) | — | `testes/conta.test.ts:18,29`; `testes/creci.test.ts:130,148`; `testes/isolamento.test.ts:21,46,57`; `ajustes-chromium.test.ts:136-137` | **OK** | — |
| Seu perfil: **telefone** | `/conta` | Sim: `conta.ts:78` | `PUT /conta/meu-perfil` | `backend/conta.ts:61-71` | — | `conta.test.ts:8`; `isolamento.test.ts:21` | **OK** | — |
| Seu perfil: **regiões** | `/conta` | Não | — | — | — | — | **por decisão** (pendência registrada R.8.1 §11, `plano_de_implementacao.md:453`, ainda sem decisão do dono) | Dono decide: campo `regioes` em `perfis_corretor` (sobe `versao`) ou D-nn tirando da 1.2 |
| Conta (nome da conta, tipo, documento, CRECI jurídico) — não listado em P13, está em `docs/conta-e-ajustes.md:50` | — | Sim: `conta.ts:82-90,131-137` | `PUT /conta/perfil` (`:84`) | `backend/conta.ts:38-46` | — | `conta.test.ts:53`; `isolamento.test.ts:20,56,75`; `testes/robustez.test.ts` | **OK** (extra) | — |
| Sua marca: **logo** | `/conta`; D-85 | Sim: `marca.ts:179` | `POST /estudio/marca/arquivos {tipo:'logo'}` (`:130`) | `estudio.ts:140-166` (logo não ressincroniza, `:160-162`) | — | `testes/estudio.test.ts:96`; `marca.test.ts:238` | **OK** (rota real: `/estudio/marca/*`, herdada do Estúdio) | — |
| Sua marca: **cor principal, cor de apoio** | D-85 | Sim: diálogo "Sua marca" `marca.ts:95-107` (campos `:100-101`) | `PUT /estudio/marca` (`:106`) | `estudio.ts:100-124` (`validarMarca` `comum/estudio.ts:47`; ressincroniza o que está no ar `:121-122`) | — | `estudio.test.ts:94-95`; `marca.test.ts:72,162` | **OK** | — |
| Sua marca: **assinatura** | D-85 | Sim: `marca.ts:103` | `PUT /estudio/marca` | `estudio.ts:100-124` | — | `marca.test.ts:72` | **OK** | — |
| Sua marca: **tom de voz** (usado pelas artes, pela Página e pelo Negociador) | D-85; 6.x `marcas.tom_de_voz` (spec linha 594) | Não; há **Estilo** (moderno/clássico/minimalista, `marca.ts:22-26,102`), que é outra coisa | — | — (`validarMarca` não tem `tom_de_voz`) | — | — | **por decisão** (pendência R.8.1 §11, `plano_de_implementacao.md:453`, sem decisão do dono) | Dono decide: coluna `tom_de_voz` em `marca_conta` lida pelo Estúdio/Página/Negociador, ou D-nn |
| Marca única (D-85): vale no Estúdio, Página, seleção e portal | D-85 | Sim: texto `marca.ts:182`; "Atualizar o que está no ar" `:170` quando a vitrine não acompanhou | `POST /estudio/marca/republicar` (`:114`) | `estudio.ts:131-137` | — | `marca.test.ts:72,162,216,271` | **OK** (extra: o botão de refazer) | — |
| Referências (D-86; não está em P13) | D-86 | Sim, extra: `marca.ts:184-199,136-161` | `POST /estudio/marca/arquivos {tipo:'referencia'}`; `PATCH /estudio/marca/arquivos/:id/remover` (`:149,159`) | `estudio.ts:147-150,172-181` | — | `estudio.test.ts:208-240` | **OK** (extra, D-86) | — |
| Direita: **Plano**, **Créditos do mês** com barra, **tabela de créditos por ação** | `GET /consumo` (seção 7); "com o Mensageiro (D-87)" | Não; a direita tem a ajuda da seção, o aviso do CRECI e a caixa do Assistente (`ajustes.ts:103-111`) | — | — | — | `ajustes-chromium.test.ts:137-138` | **por decisão** (D-87: tabela de créditos só com o Mensageiro, bloco 7; menu sem "Plano e créditos", `comum/ajustes.ts:5-7`) | Manter até o bloco 7 |

##### Funil e abordagens (`/ajustes/funil`)

| Comando (spec) | Rota e evento na spec | Existe na tela? | Rota que a tela chama | Rota no backend | Evento publicado | Teste | Estado | Proposta |
|---|---|---|---|---|---|---|---|---|
| Etapas do funil: ver, criar, editar, reordenar, tirar, salvar (por pipeline) | `GET, PUT /funil/etapas` (seção 7, linha 803) | Sim: `frontend/telas/funil-ajustes.ts:146` (Nova etapa), `:147` (Salvar este funil), `:122-125` (subir, descer, editar, tirar); rascunho local, o PUT manda a lista inteira | `GET /funil/etapas` (`:45`); `PUT /funil/etapas/:pipeline` (`:98`) | `backend/crm.ts:673-679` (GET), `:681-710` (PUT: valida, inativa as que saíram, renomeia em transação) | — (seção 13 não prevê evento) | `testes/crm.test.ts:44-68,342,362`; `isolamento.test.ts:93` | **OK** (rota real: `PUT /funil/etapas/:pipeline`) | — |
| Playbook: editar abordagem (etapa × temperatura: o que fazer, canal, prazo) | 6.15 (sem rota na seção 7) | Sim: `frontend/telas/playbook.ts:246-247` (linha clicável) → `editar` `:203-205` | `PUT /funil/playbook/:id` (`:204`) | `backend/funil.ts:146-156` | — | `testes/funil.test.ts:94-98,252-258`; `testes/ficha.test.ts:127-128` | **OK** | — |
| Playbook: **Nova abordagem** (só para etapas sem abordagem) | 6.15 | Sim: `playbook.ts:243` → `nova` `:207-221` | `POST /funil/playbook` (`:217`) | `funil.ts:158-176` (409 `JA_EXISTE` na duplicata) | — | **nenhum teste chama `POST /funil/playbook`** (só GET e PUT) | **OK** sem teste da rota de criação | Acrescentar em `funil.test.ts` o caso criar abordagem (201), etapa não aberta (422) e duplicata (409) |

##### Horário de atendimento (`/ajustes/atendimento`)

| Comando (spec) | Rota e evento na spec | Existe na tela? | Rota que a tela chama | Rota no backend | Evento publicado | Teste | Estado | Proposta |
|---|---|---|---|---|---|---|---|---|
| Cliente parado, validade da seleção, lembrete de visita | `/conta` (11.8) | Sim: `conta.ts:116-122` (cartão Atendimento), diálogo `:92-100` | `PUT /conta/configuracoes` (`:95`) | `backend/conta.ts:48-59` (`validarConfiguracoes` `comum/conta.ts:128-145`) | — | `conta.test.ts:60`; `isolamento.test.ts:23`; `testes/lembretes.test.ts` | **OK** | — |
| Prazo de primeiro atendimento ("com o WhatsApp") | `/conta` | Fora da tela; o valor gravado vai fixo no PUT (`conta.ts:94,99`) | `PUT /conta/configuracoes` | `backend/conta.ts:48-59` | — | `conta.test.ts:60` | **por decisão** (D-78; `docs/conta-e-ajustes.md:111-113`) | Volta com o bloco 6 |
| Início e fim do horário de atendimento (o que Números › "Contatos por horário" usa) | — (P10/11.2 "fora do horário comercial") | Não; `HORARIO_COMERCIAL` fixo 8h–19h em `comum/numeros.ts:201` | — | — | — | `numeros-p10.test.ts:17` (fixo) | **por decisão** (pendência B7 item 2, `plano_de_implementacao.md:119`, aberta) | Dono decide: campos `atendimento_inicio_h`/`fim_h` em `configuracoes_conta` lidos por `leadsPorHora`, ou aceitar o fixo (D-nn) |

##### Privacidade (`/ajustes/privacidade`)

| Comando (spec) | Rota e evento na spec | Existe na tela? | Rota que a tela chama | Rota no backend | Evento publicado | Teste | Estado | Proposta |
|---|---|---|---|---|---|---|---|---|
| **Exportação** (CSV da carteira) | `GET /contatos/exportar` — "dono_conta, gestor" (seção 7, linha 800); 7.4 CSV `;` | Sim: `ajustes.ts:190` ("Exportar contatos"), `exportar()` `:162-180` baixa o blob | `GET /contatos/exportar` por `chamarFetch` (`:166`) | `backend/crm.ts:194-210` (papel `corretor`, guarda `crm.ts:41`) | — | `crm.test.ts:279` (backend); `ajustes-chromium.test.ts:268-269` (tela) | **OK** (papel real: `corretor`, não `dono_conta`/`gestor` — no MVP são a mesma pessoa) | — |
| LGPD (fase 2) | — | Não | — | — | — | — | **por decisão** (spec: fase 2) | — |
| Consentimento: atalho para a ficha (não está em P13; `docs/conta-e-ajustes.md:116`) | 12.1 | Sim, extra: `ajustes.ts:184-187` ("Abrir Clientes") | navega para `/clientes` | — | — | `ajustes-chromium.test.ts:268` | **OK** (extra) | — |

**(a) Abas/visões e endereço:** menu de Ajustes à esquerda com Mensageiro · Negociador · Conexões · Conta e marca · Funil e abordagens · Horário de atendimento · Privacidade (`comum/ajustes.ts:9-17`; sem Plano e créditos, D-87); seção em `/ajustes?aba=<id>` (`ajustes.ts:91`, `replaceState`, sem entrada no histórico — justificado em `:82-84`) e apelidos `/conta`, `/ajustes/conta`, `/ajustes/marca` (→ conta), `/ajustes/funil`, `/ajustes/atendimento`, `/ajustes/privacidade` (`enderecos.ts:46-54`; `comum/ajustes.ts:24-45`). Padrão sem `?aba=`: Conta e marca (`comum/ajustes.ts:22`). Testes: `ajustes.test.ts:22,35,51`; `ajustes-chromium.test.ts:132-133,149,261`. Só a seção aberta é montada (`keyed`, `ajustes.ts:114`).

**(b) Estados 11.0.4:** carregando: `urbi-loading` em cada seção (`conta.ts:113`, `marca.ts:85`, `funil-ajustes.ts:139`, `playbook.ts:240`); erro: banner + "Tentar de novo" (`conta.ts:107-112`, `marca.ts:83`, `funil-ajustes.ts:133-138`, `playbook.ts:234-239`); vazio: conta sem perfil → dica "Dê um nome à sua conta" (`conta.ts:136`); funil sem etapas e playbook sem abordagens mostram tabela vazia (sem `urbi-estado-vazio` — pequeno desvio); sem permissão/outra conta: banner genérico com `e.message` (não `estadoDaFalha`) — pequeno desvio de D-40; sem conta resolvida: 409 `SEM_CONTA` com frase (`backend/conta.ts:17-19`); integração desconectada, IA indisponível e crédito: não se aplicam (o IA indisponível existe na seção Negociador, fora deste grupo, `negociador-ajustes.ts:414`).

---

#### P14 · Clientes — Importar (`/clientes/importar`) — spec linhas 1532–1534; 12.1 (linha 1742)

| Comando (spec) | Rota e evento na spec | Existe na tela? | Rota que a tela chama | Rota no backend | Evento publicado | Teste | Estado | Proposta |
|---|---|---|---|---|---|---|---|---|
| Fonte **Planilha/CSV** | `POST /contatos/importar` | Sim: `frontend/telas/importar.ts:132` (única fonte ativa); arquivo lido no navegador (`lerCsv`, `comum/csv.ts`), UTF-8 com recuo para Latin-1 (`:162-164`) | — | — | — | `testes/crm.test.ts:12` (CSV puro) | **OK** | — |
| Fonte **Contatos do celular (vCard)** | `POST /contatos/importar` | Item na lista com badge "Em breve", sem ação (`importar.ts:133,144`) | nenhuma | nenhuma (a rota só recebe `linhas` já convertidas, `crm.ts:215`) | — | — | **por decisão** (pendência R.8.1 §13, `plano_de_implementacao.md:455`: "vCard em breve embora a spec o ponha no MVP"; sem decisão do dono; a frase de P14 é ambígua sobre se "fase 2" cobre só o Outro CRM) | Dono decide: parser vCard no navegador (`comum/vcard.ts`) alimentando a mesma rota, ou D-nn para a fase 2 |
| Fonte **Outro CRM — fase 2** | — | Item "Em breve" (`importar.ts:134`); modelos de planilha de CRM em "De onde vem a planilha?" (`:243`, só "simples" em `comum/csv.ts:82-88`) | — | — | — | `crm.test.ts:26` | **por decisão** (spec: fase 2; Kenlo/Jetimob/Imobzi fora por falta de exemplos reais, `plano_de_implementacao.md:48,253`) | — |
| Centro: arquivo e número de linhas | — | Sim: `importar.ts:245-247` | — | — | — | `testes/troca-de-conta-gestos-chromium.test.ts:445` (fluxo) | **OK** | — |
| **Mapeamento de colunas sugerido** | 12.1 | Sim: `importar.ts:248-257` (`mapearPorModelo` `:170,177`; troca manual `:182-185`) | — | — | — | `crm.test.ts:26` | **OK** | — |
| **Prévia** do que acontece em cada linha (novo, já existe, ignorado) | 12.1: 10 primeiras linhas | Sim: `importar.ts:258-260`, `preverLinhas` `:84-94` (10 linhas, `LINHAS_PREVIA` `:20`), coluna "O que acontece" `:221-233` | `POST /contatos/importar {simular:true}` (`:88`) | `crm.ts:222-243` (mesma validação e busca de repetidos, sem gravar; teto `LIMITE_PREVIA`) | — | `crm.test.ts:149` | **OK** (rota real: a própria rota de importar com `simular`) | — |
| **Importar N contatos** | `POST /contatos/importar`; evento `contatos.importados` (13.1 e 11.8) | Sim: `importar.ts:268`, `importar()` `:196-219` (exige coluna do nome, limite 2000 linhas `:17`, aviso de 100 kB `:261-266`) | `POST /contatos/importar` (`:208`) | `crm.ts:212-288` (cria com `origem_id` "importacao"/campanha = arquivo `:244-245`, sem consentimento `:266-268`, modos de duplicata `:216,271-279`, 409 de corrida `:280-284`) | **não** (sem evento no manifesto); só a linha do tempo por contato `contato.importado` (`crm.ts:269`) | `crm.test.ts:182,366`; `testes/guarda-do-envio.test.ts:57`; `troca-de-conta-gestos-chromium.test.ts:445` | **comando sem funcionar (só o evento)** — a importação funciona; falta `contatos.importados` | Declarar `contatos_importados` (`segregado_por_conta`, só contagens e `origem_id`, sem dado pessoal) e publicar em `crm.ts:286` antes do `res.json`; ou D-nn dizendo que a linha do tempo basta |
| Relatório final: criados, unidos, rejeitados **(baixável, 12.1)** | 12.1 | Relatório na tela (`importar.ts:271-279`, tabela de rejeitados); **sem botão para baixar** | — | `crm.ts:246,286` devolve o relatório | — | `crm.test.ts:182` | **comando ausente** (só o "baixável") | Botão "Baixar relatório" que gera CSV das rejeitadas no navegador (como `exportarCsv` de Números) |
| Direita: regra para contato repetido **Pular · Completar · Substituir** | seção 7: modos `pular`/`atualizar`/`criar`; 12.1: `pular`, `atualizar campos vazios`, `sobrescrever` | Sim: `importar.ts:291-299` (chips; `REPETIDOS` `:23-27`); mudar a regra refaz a prévia `:294-297` | modo no corpo do `POST /contatos/importar` | `crm.ts:216` aceita `pular`/`atualizar_vazios`/`sobrescrever` | — | `crm.test.ts:182` | **OK** (nomes reais dos modos diferem da seção 7; batem com 12.1) | Alinhar a seção 7 à 12.1 |
| Direita: regra de consentimento (12.1) | 12.1 / D-20 | Sim: `importar.ts:300-305` (texto) | — | `crm.ts:266-268` (`consentimento_id` nulo) | — | — | **OK** | — |
| Voltar a Clientes | — | Sim: `importar.ts:138` | — | — | — | — | **OK** (extra) | — |

**(a) Abas/visões e endereço:** `/clientes/importar` (`enderecos.ts:30`; `frontend/index.ts:56`, `aoAbrirImportar` zera o estado a cada entrada `importar.ts:68-72`); menu ativo `/clientes` (`:115`). Sem abas; a fonte não vai à URL (só uma fonte existe). O mockup/plano coloca também o botão **Importar** no alto da lista de Clientes (`docs/clientes-e-agenda.md:21`), fora deste grupo.

**(b) Estados 11.0.4:** carregando: não há carga inicial (arquivo local); o botão mostra `?carregando` durante o envio (`importar.ts:268`); erro: `urbiVerso.alertar` na importação (`:214`), sem "Tentar de novo" no lugar do conteúdo; a prévia falha em silêncio (`:90-93`) — pequeno desvio; vazio: o estado inicial é o seletor de arquivo (`:245`), sem `urbi-estado-vazio` (aceitável: a ação que resolve é o próprio seletor); sem permissão: 403 da rota vira alerta; integração desconectada, IA indisponível e crédito: não se aplicam.

---

#### Resumo por tela

| Tela | OK | ausente | sem funcionar | …dos quais só pelo evento | por decisão |
|---|---|---|---|---|---|
| P10 Números | 12 | 1 (custos por origem) | 0 | 0 | 1 (Tempo de resposta/Mensageiro/Créditos) |
| P12 Conexões | 5 | 0 | 2 (Conectar, Desconectar) | 2 | 3 (WhatsApp, Agenda, Testar publicação) |
| P13 Conta e marca + Funil + Horário + Privacidade | 15 | 1 (nome profissional) | 0 | 0 | 6 (regiões, tom de voz, Plano/créditos, prazo 1.º atendimento, início/fim do horário, LGPD) |
| P14 Importar | 7 | 1 (relatório baixável) | 1 (Importar: evento) | 1 | 2 (vCard, Outro CRM) |

#### Descobertas mais importantes

1. **Nenhum dos eventos que a spec pede para estas telas existe no manifesto**: `canal.conectado`/`canal.desconectado` (auditáveis, P12) e `contatos.importados` (P14). As ações funcionam, mas sem trilha. Os 19 eventos do `manifesto.json` são só os de lead/link/reação/portal/publicação/lembrete/negociação. Corrigir pede manifesto (sobe `versao`) e `req.eventos.publicar` em `backend/instagram.ts:258-262,272-280` e `backend/crm.ts:286`.
2. **Três lacunas de P13/P14 estão registradas como "divergência sem decisão" (R.8.1 §11–13, `specs/plano_de_implementacao.md:453-455`) e esperam o dono**: regiões e tom de voz no perfil/marca, "Testar publicação" (que D-75 já responde: a API não tem) e vCard em "em breve". Mais o início/fim do horário de atendimento (pendência B7 item 2) e o nome profissional (não registrado em lugar nenhum).
3. **Buracos de teste**: `POST /conexoes/instagram/desconectar` só é exercitado com API simulada no Chromium (o handler do backend nunca roda em teste); `POST /funil/playbook` (criar abordagem) não tem teste; o CSV de Números não inclui o relatório Negociação. Pequenos desvios de 11.0.4: P10 sem esqueleto na coluna direita enquanto carrega; P12/P13 mostram 403/404 como banner genérico em vez de "Não encontrado" (D-40); P14 sem "Tentar de novo" e com prévia que falha em silêncio.

### Grupo D · P15, P16, P17, celular e portal

Diagnóstico só de leitura (branch `docs/diagnostico-visual`, app `apps/portal_corretor`, manifesto `0.1.45`). Caminhos relativos a `apps/portal_corretor/`. Rotas do backend são relativas (servidas em `/api/portal_corretor/…`); as públicas em `/pub/portal_corretor/…`.

Convenções: "evento" compara o nome da spec traduzido para sublinhado com a chave `eventos` do `manifesto.json` (19 eventos) e com `publicar(...)` no backend. "Teste" cita o arquivo em `testes/`.

Observação transversal (vale para P15/P16/P17): **nenhum evento do manifesto tem a flag `auditavel`**; a spec 13.1 pede `mandato.alterado` e `negociador.config_alterada` auditáveis e reconhece que "os auditáveis ainda saem sem a trilha de auditoria". `mandato_alterado` existe e é publicado; `negociador_config_alterada` não existe no manifesto nem no código.

---

#### P15 · Clientes — Negociações (`/clientes?visao=negociacoes&item=:id`) — spec 1536–1558

| Comando (spec) | Rota e evento na spec | Existe na tela? (arquivo:linha) | Rota que a tela chama (arquivo:linha) | Rota no backend (arquivo:linha) | Evento publicado | Teste (arquivo) | Estado | Proposta |
|---|---|---|---|---|---|---|---|---|
| Registrar oferta do cliente | `POST /negociacoes/:id/propostas` · `proposta.recebida` | `frontend/telas/negociacoes.ts:491` (botão no pé da escada); diálogo `:272-287` | `negociacoes.ts:285` `POST /negociacoes/${id}/propostas` `{direcao:'comprador'}` (canal `registro` por omissão) | `backend/negociacao.ts:543-629` | `proposta_recebida` (`negociacao.ts:624`) | `negociacao.test.ts:188`; `negociacoes-chromium.test.ts:145,164` | **OK** | — |
| Pedir sugestão (custo mostrado) | `POST /negociacoes/:id/sugestao` · `contraproposta.sugerida` | `negociacoes.ts:502` ("Pedir sugestão", desabilitado quando `/negociador/ia` diz indisponível `:120,:500-503`); diálogo `:196-209` | `negociacoes.ts:205` `POST /negociacoes/${id}/sugestao` `{mensagem_cliente, canal:'portal'}` | `backend/negociador.ts:458-497` (motor `executarMotor`) | `contraproposta_sugerida` (`negociador.ts:428`) só quando a sugestão traz contraproposta e fica pendente; passagem publica `negociacao_limite_atingido` (`:425`); "faz sozinho" publica `contraproposta_enviada` (`:426`); sugestão só em texto não publica nada | `negociador.test.ts`; `negociador-humano.test.ts`; `eventos-sem-dado-pessoal.test.ts` | **OK** | O custo não aparece no botão (11.0.6 "~N créditos"); o único texto de custo é `CUSTO_POR_RODADA = 'Incluído no plano'` em P17 (`comum/negociador-ajustes.ts:38`). Mostrar a mesma dica no botão. |
| Enviar pelo portal | `POST /negociacoes/:id/propostas` (`direcao: vendedor`) · `contraproposta.enviada` | `negociacoes.ts:518` ("Enviar", cartão da sugestão) e `:700` ("Usar sugestão", direita); `aprovar()` `:213-241`; sugestão só texto → "Revisar e enviar" `:521` | `negociacoes.ts:222` `POST /negociacoes/${id}/decisao` `{acao:'aprovar', execucao_id, canal:'portal'}`; editada `:249,:270` `{acao:'editar'}` | `backend/negociador.ts:503-712` (valida 10.9.7 em `validarMovimento` `:619`, grava proposta `canal: portal` `:632-645`, `portalDa` `:696`). `POST /propostas` com `canal ≠ registro` responde `422 CANAL_INDISPONIVEL` (`negociacao.ts:566-569`) | `contraproposta_enviada` (`negociador.ts:695`) | `negociador.test.ts`; `negociacoes-chromium.test.ts:311-352`; `eventos-sem-dado-pessoal.test.ts` | **OK** (rota real: `POST /negociacoes/:id/decisao`) | Só existe como aprovação/edição de uma **sugestão pendente**: sem sugestão (IA indisponível, ou corretor conduzindo sem pedir sugestão) o corretor **não tem como enviar uma contraproposta própria pelo portal**; o registro (`direcao: vendedor`, canal `registro`) não chega ao cliente. Decidir: abrir `canal: portal/wa_me` no `POST /propostas` do corretor (com as 7 garantias, como já faz para o negociador humano em `negociacao.ts:589-604`) ou registrar como decisão. |
| Fazer agora | `POST /negociacoes/:id/propostas` · `contraproposta.enviada` | `negociacoes.ts:519` ("Fazer agora"); `aprovar('wa_me')` abre `wa.me` `:219-238` | `negociacoes.ts:222` `POST …/decisao` `{acao:'aprovar', canal:'wa_me'}` | `backend/negociador.ts:503-712` (`SEM_WHATSAPP` `:560-564`; link `wa.me` `:709`) | `contraproposta_enviada` (`:695`) | `negociacoes-chromium.test.ts:241-300`; `negociador.test.ts` | **OK** (rota real: `/decisao`; D-107) | "Editar" envia sempre pelo portal (`negociacoes.ts:249,270`, canal fixo): não há "editar e fazer agora". Oferecer o canal no diálogo de edição. |
| Passar para o proprietário | `POST /negociacoes/:id/decisao` · `negociacao.acordo_proposto` | `negociacoes.ts:703` ("Passar ao proprietário", cartão Próximo movimento; confirma `:311-317`) | `negociacoes.ts:318` `POST …/decisao` `{acao:'aceitar_acordo', proposta_id}` | `backend/negociador.ts:515-541` (só corretor; estado → `aguardando_proprietario`) | `negociacao_acordo_proposto` (`negociador.ts:539`) | `negociacoes-chromium.test.ts:251-263`; `negociador.test.ts`; `sigilo.test.ts` | **OK** | A spec pede "resumo da proposta para decisão"; a confirmação mostra só o valor (`:313`). |
| Registrar decisão (Aceita · Recusa · Contraproposta do proprietário) | `PATCH /propostas/:id` · `proposta.decidida` | **Não há botão** (grep `proprietario`/`decisão` em `frontend/telas`: só leitura de estado em `negociacoes.ts:531,604,696`); com a negociação em `aguardando_proprietario` o cartão só diz "O acordo está com o proprietário" (`:701`) | — | `PATCH /propostas/:id`: **não encontrado** (`rotas.txt`). O que existe: `POST /negociacoes/:id/propostas` com `direcao: 'proprietario'` grava uma rodada do proprietário, só pelo corretor (`negociacao.ts:541,573`), sem marcar a proposta aceita/recusada; e `PATCH /negociacoes/:id` `estado: ganha/perdida` (`:355-413`) | não (sem evento `proposta_decidida` no manifesto; spec 13.1 diz que chega "com o portal (D5)", mas o D5 trouxe só `proposta_aceite_cliente`) | só API: `negociador-humano.test.ts:431`, `portal-propostas.test.ts:386` (direção `proprietario`) | **comando ausente** | Depois de "Passar ao proprietário" a tela não tem saída: nem decisão nem encerramento (linha abaixo). Botão "Registrar decisão do proprietário" no Próximo movimento (aceita → `PATCH /negociacoes/:id {estado:'ganha', valor_final_c}`; recusa → proposta recusada e estado de volta; contraproposta → `POST /propostas direcao proprietario`) e evento `proposta_decidida` no manifesto. |
| Assumir / Devolver ao Negociador | `POST /negociacoes/:id/assumir` · `/devolver` · `negociacao.assumida` | `negociacoes.ts:539-540` (cabeçalho do centro); também o select "Quem negocia" do mandato `mandato.ts:238-240` | `negociacoes.ts:300` `POST /negociacoes/${id}/${acao}`; `mandato.ts:98` | `backend/negociador.ts:717-745` (laço `assumir`/`devolver`; não aparece em `rotas.txt` por ser template literal; `NEGOCIADOR_DESLIGADO` `:734`) | `negociacao_assumida` / `negociacao_devolvida` (`negociador.ts:740`) | `negociador.test.ts`; `negociador-humano.test.ts:538`; `eventos-sem-dado-pessoal.test.ts` | **OK** | — |
| Encerrar (ganho gera comissão prevista · perdido com motivo) | `PATCH /negociacoes/:id` · `negociacao.encerrada` | **Não há botão** (grep `Encerrar`, `'ganha'`, `valor_final`, `motivo_perda` em `frontend/telas`: só leitura de estado) | — | `PATCH /negociacoes/:id` (`backend/negociacao.ts:355-413`): `ganha` exige `valor_final_c`, `perdida` exige `motivo_perda`, grava `encerrada_em` | `negociacao_encerrada` (`negociacao.ts:409`) | só API: `negociacao.test.ts:169-172,275` | **comando ausente** | Botão "Encerrar" no menu "mais" do cabeçalho chamando a rota que já existe. `docs/negociacao.md:146-149` descreve o encerramento sem dizer por onde se faz. |
| Editar mandato (abre P16) | — · `mandato.alterado` (auditável) | `negociacoes.ts:595` ("Editar mandato") / `:583` ("Definir mandato") → `pc-mandato-modal` `:717-722` | `mandato.ts:175` `PUT /negociacoes/${id}/mandato` | `backend/negociacao.ts:432-487` | `mandato_alterado` (`negociacao.ts:482`), **sem `auditavel`** no manifesto | `negociacao.test.ts:186-224`; `negociacoes-chromium.test.ts:192-229` | **OK** (auditoria pendente, reconhecida na spec 13.1) | Marcar `auditavel: true` no manifesto quando o SDK aceitar. |
| Botões da direita (spec): Enviar pelo portal · Fazer agora · Editar · Passar para o proprietário · Assumir | — | Enviar/Fazer agora/Editar ficam no **centro** (cartão da sugestão `:518-520`); direita tem "Usar sugestão" `:700` e "Passar ao proprietário" `:703`; Assumir no cabeçalho `:540` | idem acima | idem | idem | idem | **OK** (posição difere do wireframe) | — |

Comandos na tela que a spec não lista: **Descartar** sugestão (`:522` → `/decisao {acao:'descartar'}`), **Atribuir a um negociador / Trocar / Retirar** (`:610-612` → `POST /negociador/atribuicoes` e `PATCH /negociador/atribuicoes/:id`, `backend/negociador-humano.ts:152,196`), **Nova proposta** no alto da lista (`frontend/telas/clientes.ts:167` → fluxo `novaProposta` `negociacoes.ts:736-801`, que cria negócio/negociação e registra a oferta).

**(a) Abas/visões e endereço (11.0.5):** `/clientes?visao=negociacoes&item=:id` existe (`clientes.ts:60-65,112,153-181`; filtros `?neg=` em `negociacoes.ts:50-57,382-385`: Em andamento · Aguardando você · Negociador · Cliente · Proprietário · Encerradas, cobrem os cinco da spec). `/negociacoes?item=` é o endereço do negociador humano (`enderecos.ts:56`, `clientes.ts:183-186`). A visão "Negociador atendendo" filtra `estado=ativa` e `conduzida_por !== corretor` no cliente (`:390`). **Faltam as "mensagens da negociação (portal e registros)"**: o centro mostra só "Última fala do cliente" (`:548`), já registrado no plano ("o que falta" item 14).

**(b) Estados 11.0.4:** carregando ✓ (`:529`, `:713`, lista `?carregando` `:419`); vazio ✓ (`:420` com atalho "Criar › Nova proposta"; sem item `clientes.ts:171`); erro ✓ (`:418` Tentar de novo; `:529` `estadoDaFalha`; a direita devolve vazio na falha `:713`); outra conta → 404 "não encontrado" via `estadoDaFalha`; integração desconectada n/a (só `wa.me`); IA indisponível ✓ (`:500-503` botão desabilitado + dica "IA indisponível agora", sonda `GET /negociador/ia` `backend/negociador.ts:236-241`).

---

#### P16 · Mandato de negociação (modal sobre P15) — spec 1560–1570

| Comando (spec) | Rota e evento na spec | Existe na tela? | Rota que a tela chama | Rota no backend | Evento publicado | Teste | Estado | Proposta |
|---|---|---|---|---|---|---|---|---|
| Abre em `urbi-modal` (gaveta é lacuna) | — | `frontend/telas/mandato.ts:197` `urbi-modal` | — | — | — | `negociacoes-chromium.test.ts:192-229` | **por decisão** (pedido ao shell 10; plano "Sobras" cita) | — |
| Bloco 1 · Valores: pedido (do anúncio), alvo, recuo, BATNA; validação recuo ≤ alvo ≤ pedido | `PUT /negociacoes/:id/mandato` | `mandato.ts:199-212` (pedido vem de `GET /imoveis/:id` `:77-81`; recuo mascarado "•••• mostrar" `:203-205`; erros ao vivo `errosDoFormulario` `:189,255`) | `mandato.ts:175` `PUT …/mandato` | `backend/negociacao.ts:432-487` + `validarMandato` `comum/negociacao.ts:126-180` (`RECUO_ACIMA_DO_ALVO`, `MANDATO_INVALIDO`) | `mandato_alterado` (`:482`) | `negociacao.test.ts:186-224`; `negociacoes-chromium.test.ts:192-229` | **OK** | — |
| Bloco 2 · Concessões e contrapartidas; passo máximo (40%) e rodadas (4) | idem | `mandato.ts:213-230`; padrões em `formularioDe` `:22-23` | idem | idem | idem | idem | **OK** | — |
| Bloco 3 · Prazo: validade do mandato **e de cada contraproposta** | idem | validade do mandato `mandato.ts:232`; **validade por contraproposta: sem campo** (`validarMandato` só aceita `validade`, `comum/negociacao.ts:141`; a validade da contraproposta vem de `validade_horas` sugerido pelo modelo ou digitado na edição, `backend/negociador.ts:583`) | — | — | — | — | **comando ausente** (parcial; registrado no plano, "o que falta" item 14) | Campo "validade padrão de cada contraproposta (h)" no mandato, usado quando o modelo/edição não informa. |
| Bloco 4 · Autonomia: Negociador IA ou humano (escolher a pessoa, D-108) | idem | `mandato.ts:236-241`: select só "Negociador IA" / "Você (corretor)"; `humano` aparece como texto fixo `:237`. Escolher a pessoa é no cartão "Quem negocia" de P15 (`negociacoes.ts:603-672`) | `mandato.ts:98` `POST …/assumir` ou `/devolver` (vale na hora, sem salvar `:241`) | `backend/negociador.ts:717-745`; atribuição `negociador-humano.ts:152` | `negociacao_assumida`/`negociacao_devolvida` | `negociador-humano.test.ts:230` | **comando ausente no modal** (efeito existe em P15; registrado no plano, item 14: "a D-108 … não justifica essa troca") | Ou pôr o seletor da pessoa no bloco 4, ou registrar D-nn de que a escolha fica no cartão Quem negocia. |
| Nível: Só sugere · Pergunta antes · Faz sozinho (seletor de 3 posições) | idem | `mandato.ts:191-196,242-243` (`urbi-select`; "Faz sozinho" só aparece com autorização `:195`) | `PUT` | `validarMandato` `comum/negociacao.ts:142-143,177` | — | `negociacao.test.ts` | **por decisão** (pedido ao shell 12; lacuna 11.9) | — |
| Autorização do proprietário (anexo ou "autorizado por mensagem em <data>"), obrigatória para faz sozinho (D-99, P-41) | idem | `mandato.ts:244-253` ("Anexar documento" `:251`, "Registrar por mensagem" `:252`, "Tirar" `:247`) | `PUT` | `backend/negociacao.ts:447-466` (anexo = mídia `documento` do mesmo imóvel, relida travada; `DOCUMENTO_EM_USO` na remoção) + `validarMandato` `:160-178` | — | `negociacoes-chromium.test.ts:229`; `negociacao.test.ts` | **OK** (forma final em P-41, aberta) | — |
| Salvar mandato (versão nova) | `PUT /negociacoes/:id/mandato` · `mandato.alterado` (auditável) | `mandato.ts:258` (desabilitado com erros) | `:175` | `backend/negociacao.ts:432-487` (`versao + 1` `:473`; `409 MANDATO_ALTERADO`) | `mandato_alterado` (`:482`), sem `auditavel` | `negociacao.test.ts:186-224` | **OK** (auditoria pendente) | `auditavel: true` no manifesto. |
| Ler mandato | `GET /negociacoes/:id/mandato` | `negociacoes.ts:124` (vigente + versões; sigilo mascarado `:566-570`) | `GET` | `backend/negociacao.ts:419-430` | — | `negociador-humano.test.ts:288` (negociador lê completo, D-112) | **OK** | — |
| P16 "sobre P06" (mandato resumido na ficha do imóvel) | — | não há em `imoveis` (plano "o que falta" item 9) | — | — | — | — | **comando ausente** (registrado no plano) | — |

**(a) Endereço:** não tem endereço próprio (abre por estado `editando` em `negociacoes.ts:717`); fecha e relê a negociação (`:719-721`). **(b) Estados:** carregando → "Anexar documento" fica desabilitado até `GET /imoveis/:id` voltar (`mandato.ts:251`, `documentos === null`); erro ao salvar → `urbiVerso.alertar` (`:180`); troca de conta no meio termina em silêncio (`:53-67`); vazio/IA/integração n/a.

---

#### P17 · Ajustes — Negociador (`/ajustes/negociador`) — spec 1572–1583

| Comando (spec) | Rota e evento na spec | Existe na tela? | Rota que a tela chama | Rota no backend | Evento publicado | Teste | Estado | Proposta |
|---|---|---|---|---|---|---|---|---|
| 1 · Quando entra: 4 gatilhos marcáveis (etapa Proposta; pede desconto/fala de preço; reação "conversar sobre o preço"; oferta registrada ou feita no portal) | `PUT /negociador/config` | `frontend/telas/negociador-ajustes.ts:264-271` (`GATILHOS_EM_USO`/`ROTULO_GATILHO` em `comum/negociador-ajustes.ts:7-19`) | `negociador-ajustes.ts:199` `PUT /negociador/config {gatilhos}` | `backend/negociacao.ts:638-712` (`:684-689`); leitores dos gatilhos em `backend/negociador-entrada.ts:50,93` e `backend/publico.ts:484-486,568-569,651-654` | não (ver linha "Auditoria") | `ajustes-chromium.test.ts:190`; `negociador-gatilhos.test.ts` | **OK** | — |
| 2 · Quem negocia por padrão: IA (D-94) ou pessoa da lista | `PUT /negociador/config` | `:167-188` (select "Conduz as negociações novas" `:177-182`); toggle "Negociador ligado" `:275-277` (extra) | `:199` `PUT {conduz_padrao, negociador_padrao_id}` / `{ligado}` | `backend/negociacao.ts:646-676` (confere papel e nível com o shell, `negociador-padrao.ts:38-50`) | não (ver "Auditoria") | `negociador-humano.test.ts`; `negociador-robustez.test.ts` | **OK** | — |
| 2 · Convidar negociador (sem CRECI D-94; só com política multi-usuário D-108) | prosa | `:130` ("Convidar negociador"); diálogo só e-mail `:88-107`; convites pendentes com "Revogar" `:153`; lista de quem aceitou `:137-144` | `:98` `POST /negociador/convites`; `:114` `POST /negociador/convites/:id/revogar`; `:79` `GET /negociador/convites` e `GET /negociador/negociadores` | `backend/negociador-humano.ts:84-103` (503 sem `req.shell`; `CONVITE_MULTI_USUARIO_BLOQUEADO` `:30`), `:105-122`, `:69-81`, `:126-136` | — (spec não pede) | `negociador-humano.test.ts:157-230` | **OK** (a política só se descobre no convite: pedido ao shell 17) | — |
| 3 · Estilo: Cooperativo (padrão) · Firme · Consultivo, com exemplo | `PUT /negociador/config` | `:282-296` ("Usar" `:291`; exemplos `ESTILO_NEGOCIADOR` `comum/negociador-ajustes.ts:22`) | `:199` `PUT {estilo}` | `backend/negociacao.ts:680-683` | não (ver "Auditoria") | `ajustes-chromium.test.ts` | **OK** | — |
| 4 · Regras fixas (só exibidas) | — | `:297-300` (`REGRAS_FIXAS`, a mesma constante do prompt, `comum/negociador.ts`) | — | — | — | `ajustes-chromium.test.ts:5` | **OK** | — |
| 5 · Instruções do corretor (≤ 4.000, modelo do Apêndice C) | `PUT /negociador/config` | `:301-312` ("Começar do modelo" `:308` = `PROMPT_PARTE_2_PADRAO`; "Salvar instruções" `:309`; contador `:306`) | `:224` → `:199` `PUT {instrucoes_corretor}` | `backend/negociacao.ts:690-696` (`LIMITE_INSTRUCOES`) | não (ver "Auditoria") | `negociacao.test.ts`; `ajustes-chromium.test.ts` | **OK** | — |
| 6 · Respostas a objeções (Apêndice D): "usar padrão" / "editar a minha" por categoria | `GET/PUT /negociador/objecoes` (spec 7) | `:313-327` ("Editar" `:323`, "Voltar ao padrão" `:324`; diálogo `:227-243`) | `:248` `PUT /negociador/objecoes`; `:65` `GET` | `backend/negociacao.ts:763-800` (`objecoesDaConta` `:737-760`) | — (spec não pede) | `negociacao.test.ts`; `ajustes-chromium.test.ts:46` | **OK** | `docs/negociacao.md:686` ainda diz "Nesta versão ainda não existe tela de respostas a objeções": doc desatualizada. |
| 7 · Testar: simulador com a faixa ZOPA reagindo | `POST /negociador/teste` | `pc-negociador-teste` `:337-421` ("Testar" `:419`; valores `:340`) | `:371` `POST /negociador/teste` | `backend/negociador.ts:748-808` (não grava; `IA_INDISPONIVEL` 503 `:770`) | — | `ajustes-chromium.test.ts:159-199`; `negociador.test.ts`; `negociador-humano.test.ts` | **OK** (ZOPA sai em texto `:404`; régua é o pedido ao shell 13) | — |
| Direita: pré-visualização de como o Negociador responde à última objeção testada | — | `:389-406` (`resposta()`: mensagem, contraproposta, 7 verificações, passagem, ZOPA) | — | — | — | `ajustes-chromium.test.ts:179` | **OK** | — |
| Direita: números do mês (rodadas, acordos, desconto médio, % aprovadas sem edição) | `GET /negociador/numeros` (docs) | `:422-428`: só **Rodadas** e **Aprovadas sem edição** | `:353` `GET /negociador/numeros` | `backend/negociacao.ts:714-731` (`rodadas`, `decididas`, `aprovadas_sem_edicao`); acordos e desconto médio só em `GET /numeros/negociacao` (`numeros-negociacao.ts:27`, P10) | — | `ajustes-chromium.test.ts:51`; `negociacao.test.ts`; `numeros-negociacao.test.ts` | **por decisão** (pendência registrada no plano: "Falta, se o dono quiser, acordos e desconto médio também no P17 (R.8.1)") | — |
| Direita: custo estimado por rodada | — | `:426` KPI com `CUSTO_POR_RODADA = 'Incluído no plano'` (`comum/negociador-ajustes.ts:38`) | — | — | — | — | **OK** (valor fixo, sem créditos no SDK 100) | — |
| `GET/POST/PATCH /negociador/atribuicoes` (listadas na spec de P17) | prosa | não estão em P17; ficam no cartão "Quem negocia" de P15 (`negociacoes.ts:603-672`) | `negociacoes.ts:654,664,666` | `backend/negociador-humano.ts:138,152,196` | — | `negociador-humano.test.ts:230` | **OK** (noutra tela) | — |
| Auditoria: evento `negociador.config_alterada` (auditável) | `negociador.config_alterada` | — | — | `PUT /negociador/config` não publica nada (`backend/negociacao.ts:638-712`, sem `publicar`) | **não (sem evento no manifesto)**; a spec 13.1 reconhece a lacuna ("só os que já estão no manifesto existem hoje") | — | **comando sem funcionar** (só o evento) | Declarar `negociador_config_alterada` (só ids/campos mudados) e publicar no PUT; `auditavel: true`. |

**(a) Abas/endereço:** `/ajustes/negociador` ✓ (`frontend/enderecos.ts:53`; `ajustes.ts:65,106` via `?aba=negociador`); esquerda = menu de Ajustes ✓ (`ajustes-chromium.test.ts:93`). O centro é uma grade de cartões (`:263`), não a lista 1–7 em coluna (R.8 estrutural registrado: "P17 seções em uma coluna e Testar como formulário").

**(b) Estados:** carregando ✓ (`:260`; equipe `:134`); erro ✓ (`:258` `estadoDaFalha` com Tentar de novo; falha da equipe não derruba a seção `:76-85,:135-136`); vazio n/a; integração desconectada → "Negociador humano indisponível" em texto quando o shell não responde (`:136`); IA indisponível ✓ (`:413-414` `estadoTela('ia_indisponivel')` no Testar, botão desabilitado até a sonda `:419`).

---

#### M1 · Hoje no celular — spec 11.5 (~linha 1676) — só o específico do celular

| Comando (spec) | Rota e evento na spec | Existe na tela? | Rota que a tela chama | Rota no backend | Evento publicado | Teste | Estado | Proposta |
|---|---|---|---|---|---|---|---|---|
| Linha de **atalhos do dia** no topo: Criar · Clientes · Imóveis · Assistente (Conversas com selo) | — | **Não há** (grep "atalhos do dia"/`urbi-chips-atalho` em `moldura.ts`, `inicio.ts`, `index.ts`: nada). No celular o trilho vira o botão "Menu" do `urbi-inbox` (`frontend/moldura.ts:136-139`) e as colunas viram abas Hoje · Fila · Agenda (`inicio.ts:342`, `moldura.ts:125`) | — | — | — | `moldura-largura-chromium.test.ts:246-250` só mede caixas em 390 px | **comando ausente** (registrado no plano: "o que falta" item 4 e R.8 "M1 abas e sem atalhos do dia") | Linha de botões/chips no topo do centro só ≤ 900 px (Criar, Clientes, Imóveis, Assistente). |
| "Precisa de você" (passagens do Negociador) | `GET /inicio` | `inicio.ts:203-224` (passagens + quentes); botão **"Abrir"** `:214` leva à **ficha** `/clientes/:contato`, não à negociação (spec P01: "Assumir" abre P15) | `inicio.ts:90` `GET /inicio` | `backend/funil.ts:272-285` (`estado = aguardando_corretor`, motivo fixo "A negociação espera a sua decisão") | — | `hoje.test.ts:79-94` | **OK** (a diferença Abrir × Assumir é de P01, já registrada no R.8 "P01 Abrir × Assumir") | Levar à negociação (`/clientes?visao=negociacoes&item=`) e oferecer Assumir. |
| Fila do dia em cartões com um toque | `GET /inicio` | `inicio.ts:173-186` (um principal + "Mais" `:165-170`) | `:90` | `funil.ts:328-345` | — | `hoje.test.ts:28` | **OK** (não é específico do celular) | — |
| Uma coluna por vez (11.0.3) | — | `moldura.ts:118-129` (`painel-ativo`, rótulos das abas) | — | — | — | `moldura-largura-chromium.test.ts:246-250` | **OK** | — |
| Conversas com selo | D-103 | não existe Conversas (WhatsApp bloqueado) | — | — | — | — | **por decisão** (D-103, D-59/D-78) | — |

**(a)** Abas Hoje · Agenda em `?aba=` com apelido `/agenda` (`inicio.ts:49-54`, `enderecos.ts:22-26`); o endereço `/hoje` da spec não existe (Hoje é `/`; plano "o que falta" item 3). **(b)** carregando ✓ (`:344`); erro ✓ (`:344` `estadoDaFalha`); vazio ✓ (`:265-270` com "Cadastrar um cliente"); IA indisponível ✓ (faixa `:250` e botão da Dica `:327-330`); integração: só o texto "Mensageiro: ainda não disponível" (`:201`), sem faixa de reconexão (não há integração em Hoje).

---

#### M3 · Novo imóvel no celular — spec 11.5 (~linha 1678) — só o específico do celular

| Comando (spec) | Rota e evento na spec | Existe na tela? | Rota que a tela chama | Rota no backend | Evento publicado | Teste | Estado | Proposta |
|---|---|---|---|---|---|---|---|---|
| Botão grande "Tirar fotos ou escolher da galeria" | upload em 2 passos (P07) | `frontend/telas/novo-imovel.ts:682` (`urbi-seletor-arquivo` primário com câmera/galeria) | `enviarFotos` → `POST /imoveis/:id/midias` | `backend/imoveis.ts:464` | — (de P07) | `novo-imovel-chromium.test.ts:184`; `novo-imovel.test.ts` | **OK** | — |
| Miniaturas | — | `novo-imovel.ts:685-700` (ambiente lido pela IA, Usar como capa, Apagar) | — | `imoveis.ts:546,592` | — | `novo-imovel-chromium.test.ts:163` | **OK** | — |
| "A IA já entendeu…" | IA `fotos` | `:679-680` ("a IA lê cada uma, diz o ambiente e põe a melhor de capa") e `:719` ("A IA leu as fotos e preencheu o que elas mostram") | análise `POST /imoveis/:id/midias/:midia/analisar` | `imoveis.ts:623` | — | `novo-imovel-chromium.test.ts:163` ("IA nas características") | **OK** (texto diferente) | — |
| **Ditar o resto** | ditado pelo microfone do `urbi-redator`, IA `conteudo` (P07) | **Não há** (grep `Ditar`/`microfone`/`urbi-redator` em `novo-imovel.ts`: nada; o microfone só existe no Assistente e no Estúdio, `docs/assistente.md:14`, `docs/estudio.md:90`) | — | não encontrado (nenhuma rota de ditado para imóvel) | — | — | **comando ausente** (registrado no plano: "o que falta" item 10 "faltam o ditado por voz e a reordenação das fotos") | `urbi-redator` com microfone no passo Dados → `POST /imoveis/ia` (`imoveis.ts:202`) preenchendo os campos "preenchido pela IA". |
| Salvar rascunho · Continuar | `POST/PATCH /imoveis` | "Salvar rascunho" `:818` (e `:637` na esquerda); "Próximo: …"/"Concluir" `:806,:816-819` (rótulo "Próximo", não "Continuar") | `salvarRascunho` `:391-402`; `PATCH /imoveis/:id` | `imoveis.ts:179,351` | — | `novo-imovel-chromium.test.ts:344` | **OK** (rótulo) | — |

**(a)** `/imoveis/novo?item=&passo=` ✓ (`novo-imovel.ts:46-51`); no celular abre no centro (passo). **(b)** carregando/erro via `tentar()` (`:362,:398`); IA indisponível: o texto alterna com `e.ia.fotos` (`:679-681`) e os campos não ganham o rótulo "preenchido pela IA"; vazio e integração n/a.

---

#### M8 · Aprovar negociação (celular) — spec 11.5 (~linha 1679)

| Comando (spec) | Rota e evento na spec | Existe na tela? | Rota que a tela chama | Rota no backend | Evento publicado | Teste | Estado | Proposta |
|---|---|---|---|---|---|---|---|---|
| Aviso em Hoje: "Negociador sugere contraproposta para Juliana" | — | `inicio.ts:203-224` lista as negociações em `aguardando_corretor` com motivo genérico (`funil.ts:283`). A sugestão pendente ("pergunta antes") só põe a negociação em `aguardando_corretor` quando nasce pelo **portal** (`backend/publico.ts:616-619`, com a tarefa "Aprovar a sugestão do Negociador…"); pedida pelo corretor na rota, o estado não muda (`backend/negociador.ts:379` só na passagem). A notificação do shell vem do evento `contraproposta_sugerida` (`conteudo` + `rota` no manifesto) | `GET /inicio` | `funil.ts:272-285` | `contraproposta_sugerida` (`negociador.ts:428`) | `hoje.test.ts:79-94`; `portal-propostas.test.ts:431` | **OK** (texto genérico; rota do aviso leva à ficha, não à negociação) | Motivo específico por tipo (passagem × sugestão pendente) e link para `?visao=negociacoes&item=`. |
| … e por e-mail (D-57) | `req.notificacoes` | não há `notificar(` no motor (`backend/negociador.ts`, `negociador-entrada.ts`); só o negociador humano recebe notificação direta ao ser atribuído (`negociador-padrao.ts:94-107`) | — | — | — | — | **por decisão** (D-57: entrega é do shell; `barramento.md:30` diz e-mail "(futuro)") | — |
| Tela com faixa ZOPA resumida, mensagem sugerida, concessão e contrapartida | `GET /negociacoes/:id` | é P15 em uma coluna: `clientes.ts:153-181` (`painel: 'centro'` com item `:179`, rótulos Negociações · Negociação · Mandato); faixa `negociacoes.ts:457-470`; cartão "Negociador sugere" `:496-524` (valor · concessão ↔ contrapartida `:512`, rascunho `:513`, verificações `:514`) | `negociacoes.ts:124` | `backend/negociacao.ts:328-352` | — | `negociacoes-chromium.test.ts` (só 1440 px; nenhum teste em 390 px desta tela) | **OK** | Teste da tela em 390 px. |
| Enviar pelo portal · Fazer agora · Editar · Assumir | `/decisao` · `/assumir` | `negociacoes.ts:518-520` e `:540` | `:222,:249,:270,:300` | `negociador.ts:503-712,717-745` | `contraproposta_enviada`, `negociacao_assumida` | `negociacoes-chromium.test.ts` | **OK** (idem P15) | — |

---

#### M4 · Portal do Cliente — início (`/c?t=<token>`) — spec 1629–1634

Entrada: `GET /pub/portal_corretor/vitrine/portal?t=` (`backend/publico.ts:175-195`, token conferido por `inspecionarIngressoWh` `:122-133`); ações pelo `wh` `acao_cliente` (`:279-314`), listener `aoReceberAcaoCliente` (`:626-673`) grava com `comConta`.

| Comando (spec) | Rota e evento na spec | Existe na tela? | Rota que a tela chama | Rota no backend | Evento publicado | Teste | Estado | Proposta |
|---|---|---|---|---|---|---|---|---|
| Topo: foto e nome do corretor, CRECI quando houver (D-93), botão WhatsApp (`wa.me`) | vitrine | `frontend/publico/selecao.ts:212-234` (`topo()`: foto/iniciais `:219-221`, CRECI só se existir `:225`, "Falar no WhatsApp" `:229`); chamado em `:774` | `GET /vitrine/portal` (`:406-423`) | `publico.ts:175-195` (`corretorPublico` `:141-145`) | — | `portal-b9.test.ts:100`; `marca.test.ts`; `cliente.test.ts:177` | **OK** | — |
| Faixa "Próximo passo" em destaque com "Ver" | vitrine | `selecao.ts:223-228` (`proximoPasso`, botão "Ver" → `destinoDoProximoPasso` `comum/portal-cliente.ts:72`) | idem | `backend/portal.ts:228-229` (só `proximo_passo_cliente` preenchido) | — | `portal-compass.test.ts:81`; `portal-b9.test.ts:57` | **OK** | — |
| Seções: Imóveis para você (N) · Agenda (N) · Sua jornada · Propostas (N) quando houver | vitrine | abas Conversa · Imóveis N · Agenda N · Propostas N (só com negociação) · Arquivos 0 (`comum/portal-cliente.ts:60-68`; `selecao.ts:769-797`); jornada dentro de Conversa `:565` | idem | `portal.ts:179-250` (`sincronizarPortal`) | — | `portal-b9.test.ts:57`; `portal-compass.test.ts:192` | **OK** (Arquivos como aba vazia é extra, D-73) | — |
| Mensagem ao corretor ("Escreva para o Rafael" + enviar) → item da linha do tempo e tarefa (D-73) | `wh` do portal · `mensagem.recebida` | `selecao.ts:566-575` (form "Escreva para <nome>", "Enviar" `:573`); `acao()` `:468-483` | `postar(url_acoes, {tipo:'mensagem', texto})` (`:475`) | `publico.ts:279-314` (handler `acao_cliente`, limite 5/min `:303`) → listener `:645-655` (linha do tempo `portal.mensagem` + tarefa "Responder a mensagem do portal"; fala de preço aciona o Negociador `:651-654`) | `acao_cliente_recebida` (`publico.ts:308`); **`mensagem_recebida` não existe no manifesto** (efeito igual) | `cliente.test.ts:177`; `negociador-gatilhos.test.ts`; `rotas.test.ts` | **OK** (evento real: `acao_cliente_recebida`) | — |
| "Com o WhatsApp, entra na mesma conversa" | blocos 6/7 | botão "Conversar no WhatsApp" `:577` (`wa.me`) | — | — | — | — | **por decisão** (D-59/D-78/D-107: sem WhatsApp no SDK 100) | — |

**(a)** Endereço `/portal_corretor/c?t=` (manifesto `paginas_publicas['/c']` → `pc-portal-cliente`); aba na URL por `#imoveis` etc. (`selecao.ts:364,431`). **(b)** carregando ✓ (`:766`); erro ✓ (`telaDeErro` `:291-299`: "Link expirado" para 404 e "Tentar de novo" para rede); vazio ✓ por aba (`:647` "Nenhuma visita marcada", `:722`, `:761`); outra conta/token revogado → 404 "Portal indisponível" (`publico.ts:181`); integração/IA n/a (página pública). CSS próprio (`estilo.ts`, exceção nomeada #168).

---

#### M5 · Portal do Cliente — Imóveis e agenda — spec 1636–1638

| Comando (spec) | Rota e evento na spec | Existe na tela? | Rota que a tela chama | Rota no backend | Evento publicado | Teste | Estado | Proposta |
|---|---|---|---|---|---|---|---|---|
| Imóvel em destaque com galeria, preço e botões Gostei · Não gostei · Quero visitar · Conversar sobre o preço | `wh` · `selecao.reagida` | `selecao.ts:583-607` (`abaImoveis`, destaque com `cartaoImovel`); botões `:41-46,:178`; `enviarReacao` `:242-261` (resposta imediata, reverte se falhar) | `postar(selecao.url_reacao, {imovel_codigo, reacao})` (`:250`) | `publico.ts:260-273` (handler `reacao_selecao`, 30/min) → listener `aoReceberReacao` `:462-494` (grava no item, linha do tempo, tarefa "Marcar visita"/"Conversar sobre o preço", gatilho `reacao_preco` `:484-486`, republica seleção e portal) | `reacao_recebida` (`publico.ts:271`); **`selecao_reagida` não existe no manifesto** (efeito igual) | `cliente.test.ts:78,291`; `negociador-gatilhos.test.ts`; `eventos-sem-dado-pessoal.test.ts` | **OK** (evento real: `reacao_recebida`) | — |
| Lista dos outros imóveis com a reação dada | vitrine | `selecao.ts:608-622` ("Outros imóveis", `reacaoDada` `:618`; toque põe no destaque) | — | `portal.ts` (seleções publicadas) | — | `portal-b9.test.ts:57` | **OK** | — |
| Comentar (prosa das docs; não está na spec) | `wh` | `:268-299` (`enviarComentario`) | `url_reacao` com `comentario` ou `url_acoes` mensagem | `publico.ts:271,:279` | `reacao_recebida` / `acao_cliente_recebida` | `cliente.test.ts` | **OK** (extra) | — |
| Agenda com visitas e reuniões | vitrine | `selecao.ts:644-660` (`abaAgenda`, roteiro por dia `comum/roteiro.ts`; "Como chegar"/"Ver o roteiro no mapa") | `GET /vitrine/portal` | `portal.ts:179-250` (`agenda`) | — | `cliente.test.ts:177`; `portal-compass.test.ts:192` | **OK** (só visitas; "reuniões" não entram na vitrine) | — |
| Adicionar ao calendário do celular | — | `selecao.ts:485-494` (`.ics` em `data:` URL), botão `:508` | — (local) | — | — | — (sem teste) | **OK** | Teste puro do `.ics`. |
| Pedir para remarcar | `wh` · `visita.pedida` | `selecao.ts:509` ("Pedir para remarcar"), form `:513-520` | `postar(url_acoes, {tipo:'remarcar', visita, texto})` (`:475`) | `publico.ts:279-314` → listener `:656-662` (linha do tempo `portal.remarcar` + tarefa "Remarcar visita: …") | `acao_cliente_recebida` (`:308`); **`visita_pedida` não existe no manifesto** (efeito igual) | `cliente.test.ts:177`; `portal-propostas.test.ts:365` | **OK** (evento real: `acao_cliente_recebida`) | — |
| Cartão "O que falta de você" (spec: fase 3) | `wh` | já existe: `selecao.ts:623-640` ("Feito" `:457-466`) | `postar(url_acoes, {tipo:'tarefa_feita', tarefa})` (`:460`) | `publico.ts:279-314` → `tarefaFeita` `:500-508,638-644`; rotas do corretor `backend/cliente.ts:211-250` | `acao_cliente_recebida` | `portal-compass.test.ts:112` | **OK** (adiantado em relação à spec) | — |

**(a)/(b)** iguais a M4 (abas `#imoveis`, `#agenda`; estados em `:766-767`; vazio por aba `:647`).

---

#### M5b · Portal do Cliente — Propostas — spec 1640–1650

| Comando (spec) | Entrada / Evento na spec | Existe na tela? | Rota que a tela chama | Rota no backend | Evento publicado | Teste | Estado | Proposta |
|---|---|---|---|---|---|---|---|---|
| Linha do tempo das propostas (valor, condições, validade, estado); nunca mandato/alvo/recuo/BATNA | vitrine | `selecao.ts:709-757` (`abaPropostas`; rodadas `:722`, situação `:52-59`) | `GET /vitrine/portal` | `publico.ts:189` (`semSigilo` de novo); lista permitida em `comum/portal-cliente.ts:172-209` (`negociacaoPublica`), publicada em `portal.ts:235` | — | `portal-propostas.test.ts:152,177` (vazamento); `sigilo.test.ts` | **OK** | — |
| Reagir a imóvel | `wh` · `selecao.reagida` | (M5) | | | `reacao_recebida` | | **OK** (ver M5) | — |
| Pedir/remarcar visita | `wh` · `visita.pedida` | (M5) | | | `acao_cliente_recebida` | | **OK** (ver M5) | — |
| Mensagem ao corretor | `wh` · `mensagem.recebida` | `selecao.ts:727` ("Mensagem ao corretor", campo na própria negociação `:679-690`) | `postar(url_acoes, {tipo:'mensagem', negociacao, texto:'Sobre a negociação do imóvel …'})` (`:686`) | `publico.ts:279-314` (`negociacao` só com tipo mensagem/proposta `:292`) → listener `:645-655` (fala de preço → `entrarPeloCliente` na negociação indicada `:652`) | `acao_cliente_recebida` | `negociador-gatilhos.test.ts`; `portal-propostas.test.ts:365` | **OK** (evento real: `acao_cliente_recebida`) | — |
| Fazer nova oferta (`canal: portal`) | `wh` · `proposta.recebida` | `selecao.ts:726` ("Fazer nova oferta"), campo `:741`, envio `:661-677` (`centavosDoValor`) | `postar(url_acoes, {tipo:'proposta_nova', negociacao, valor_c})` (`:654,:676`) | `publico.ts:279-314` (`valor_c` ≤ 1 bi `:294`) → `aoPropostaDoPortal` `:523-623` (grava rodada `canal: portal` sob trava `:550-561`; motor "faz sozinho"/"pergunta antes" `:566-622`; senão `aguardando_corretor` + tarefa) | `proposta_recebida` (`publico.ts:590`) | `portal-propostas.test.ts:284-468`; `eventos-sem-dado-pessoal.test.ts` | **OK** | — |
| Aceitar condição (registra intenção; não fecha; sem código) | `wh` · `proposta.aceite_cliente` | `selecao.ts:725` ("Aceitar condição", só na última do vendedor dentro da validade, `propostaAceitavel` `comum/portal-cliente.ts:211`); confirmação `:730-737` ("Confirmar aceite" `:734`); aviso "aceitar não fecha" `:714` | `postar(url_acoes, {tipo:'proposta_aceite', negociacao, proposta})` (`:734`) | `publico.ts:279-314` → `aoPropostaDoPortal` `:538-544` (vira oferta do comprador no mesmo valor, passagem ao corretor `:570-572`, tarefa "Cliente aceitou…: confirme e leve ao proprietário") | `proposta_aceite_cliente` (`publico.ts:590`) | `portal-propostas.test.ts:209,386,409`; `rotas.test.ts` | **OK** | — |
| Sem botões com acordo no proprietário, pausada ou encerrada | — | `selecao.ts:723-728` (`n.pode_agir`); `clienteNaoAge` no backend `publico.ts:513,533` | — | — | — | `portal-propostas.test.ts:152` | **OK** | — |

Observação: o portal se atualiza sozinho por ~1 min depois de oferta/aceite (`docs/selecoes-e-portal.md:112-114`); nenhum SSE (13.1 "telas abertas atualizam pelo stream SSE") nas páginas públicas: por desenho (anônimo).

---

#### Seleção (`/s?t=<token>`) — spec 1652–1654

| Comando (spec) | Entrada / Evento | Existe na tela? | Rota que a tela chama | Rota no backend | Evento publicado | Teste | Estado | Proposta |
|---|---|---|---|---|---|---|---|---|
| Cartões de imóvel (foto grande, preço, bairro, ícones de quartos, área e vagas), galeria | vitrine | `pc-selecao-publica` `selecao.ts:302-356` (cartão `:152-199`, ícones `publico/icones.ts`) | `GET /pub/portal_corretor/vitrine/selecao?t=` (`:310-325`) | `publico.ts:162-173` (`selecaoPublica` `:148-160`; vencida → 404) | — | `cliente.test.ts:78,162,291`; `marca.test.ts` | **OK** | — |
| Reação (Gostei · Não gostei · Quero visitar · Conversar sobre o preço) | `wh reacao_selecao` · `selecao.reagida` | `:178` (`reagir` `:346`) | `postar(url_reacao, …)` `:250` | `publico.ts:260-273` → `:462-494` | `reacao_recebida` | `cliente.test.ts:78` | **OK** (evento real: `reacao_recebida`) | — |
| "Quero visitar" → tarefa do corretor | listener | `:255-256` (aviso "Pedido de visita enviado") | idem | `publico.ts:481` (tarefa "Marcar visita: …") | `reacao_recebida` | `cliente.test.ts:78` ("reação vira tarefa") | **OK** | — |
| Sozinha ou dentro do Portal | — | `:302` (avulsa) e `:583-607` (dentro do portal, `url_acoes` para comentário sem reação `:280`) | — | — | — | — | **OK** | — |

**(a)** `/portal_corretor/s?t=` (manifesto `paginas_publicas['/s']`). **(b)** carregando `:329`; expirado/falha `:330` (`telaDeErro`); vazio: seleção sem imóvel restante mostra aviso para falar com o corretor (`docs/selecoes-e-portal.md:46-47`; vitrine republicada em `portal.ts:86-125`).

---

#### M6 · Página pública (`/p?c=<endereço>`; ficha `/p?c=&i=`) — spec 1656–1658

| Comando (spec) | Rota e evento na spec | Existe na tela? | Rota que a tela chama | Rota no backend | Evento publicado | Teste | Estado | Proposta |
|---|---|---|---|---|---|---|---|---|
| Capa com foto, nome, CRECI quando houver (D-93), **Falar no WhatsApp** | vitrine | `frontend/publico/pagina-publica.ts:245-257` (CRECI `:252`, WhatsApp `:257` via `linkWhatsapp`) | `GET /pub/portal_corretor/vitrine/pagina?c=` (`:129`) | `backend/publico.ts:59-79` (`paginaPublica` `:51-54`, só vitrine) | — | `pagina.test.ts:99,191`; `portal-b9.test.ts:100`; `marca.test.ts` | **OK** | — |
| Imóveis em destaque com **Quero saber mais** (abre o WhatsApp citando o imóvel) | — | `pagina-publica.ts:216-222` (`wa.me` com "Quero saber mais sobre o imóvel IM-0001"; sem WhatsApp, leva à ficha) | — | — | — | `pagina.test.ts:71` (regras puras) | **OK** | R.8 estrutural registra "M6 … sem 'Quero saber mais'" como diferença visual (posição), não ausência. |
| Demais blocos conforme P09 | vitrine | `:280-330` (blocos da página publicada) | idem | `publico.ts:59-79` | — | `pagina.test.ts:99` | **OK** | — |
| Formulário por `wh` (nome, telefone, e-mail, mensagem, consentimento, honeypot) | `wh formulario_lead` · `lead_recebido` | `:196-214` (form com `site` escondido `:206`, consentimento obrigatório `:207`); envio `:165-192` | `fetch(pagina.url_formulario, POST)` (`:180`) — único `fetch` cru, em rota de `wh` anônima (permitido) | `publico.ts:240-257` (honeypot, 3/min por IP, `validarLead`) → listener `aoReceberLead` `:361-418` (contato/negócio/consentimento/linha do tempo) | `lead_recebido` (`publico.ts:251`) ✓ (mesmo nome da spec) | `pagina.test.ts:207,232`; `rotas.test.ts`; `eventos-sem-dado-pessoal.test.ts` | **OK** | — |
| Ficha pública do imóvel `/p?c=&i=` | vitrine | `:124` (`/vitrine/imovel`), galeria e "Quero saber mais"/formulário `:328` | `GET /pub/portal_corretor/vitrine/imovel?c=&i=` | `publico.ts:82-95` (autorização vencida some `:47,:88`) | — | `pagina.test.ts:191`; `portal-b9.test.ts:100` | **OK** | — |
| Link rastreado `/l?c=` (D-68, não está em 11.3 mas é pública) | `wh clique_link` · `link.clicado` | `frontend/publico/link.ts:37-61` | `GET /vitrine/link` `:41`; `fetch(url_clique)` `:52` | `publico.ts:101-115,317-323` → `aoClicarLink` `:421-438` | `link_clicado` (`publico.ts:321`) | `pagina.test.ts:281,339` | **OK** | — |

**(a)** `/portal_corretor/p` e `/portal_corretor/l` (manifesto `paginas_publicas`). **(b)** carregando `:340`; não encontrada `:341`; falha com "Tentar de novo" `:345`; link indisponível `link.ts:64-69`; vazio (página sem imóveis) é o bloco vazio; integração/IA n/a. CSS próprio (`estilo.ts`, 14 literais, exceção nomeada #168).

---

#### Backend sem botão correspondente neste grupo (para registro)

- `backend/lembretes.ts:18-32,43-67`: lembrete de visita ao corretor por `req.eventos.agendar('lembrete_visita')` + `ctx.notificacoes.notificar` (bloco 10, spec 15.1 item 4); testes `lembretes.test.ts`. Não pertence a nenhuma tela deste grupo; o cliente não recebe lembrete (vem com o WhatsApp).
- `backend/negociador-entrada.ts`: os 3 gatilhos do Negociador (etapa Proposta, pedido de desconto, reação de preço) e `motorNaMensagem`; marcados em P17 e exercidos por `negociador-gatilhos.test.ts`.
- `backend/negociacao.ts:714-731` `GET /negociador/numeros`; `:763-800` objeções; `:631-712` config: todos com botão em P17.
- `backend/cliente.ts:147-250`: link do portal, revogar, pendências do cliente: botões na ficha (P04, outro grupo); o lado do cliente está em M5.

#### Resumo por tela

| Tela | OK | ausentes | sem funcionar | por decisão |
|---|---|---|---|---|
| P15 | 8 | 2 (Registrar decisão; Encerrar) | 0 | 0 |
| P16 | 5 | 3 (validade por contraproposta; escolher a pessoa no bloco 4; mandato em P06) | 0 | 2 (modal em vez de gaveta; seletor de 3 posições) |
| P17 | 11 | 0 | 1 (evento `negociador.config_alterada`) | 1 (acordos/desconto médio no painel) |
| M1 | 3 | 1 (atalhos do dia) | 0 | 1 (Conversas com selo) |
| M3 | 4 | 1 (Ditar o resto) | 0 | 0 |
| M8 | 3 | 0 | 0 | 1 (e-mail, D-57) |
| M4 | 4 | 0 | 0 | 1 (WhatsApp na conversa) |
| M5 | 7 | 0 | 0 | 0 |
| M5b | 7 | 0 | 0 | 0 |
| Seleção | 4 | 0 | 0 | 0 |
| M6 | 6 | 0 | 0 | 0 |

Eventos da spec sem chave no manifesto, mas com efeito coberto por outro evento: `selecao.reagida` → `reacao_recebida`; `visita.pedida`, `mensagem.recebida` → `acao_cliente_recebida`. Sem cobertura nenhuma: `proposta.decidida`, `negociador.config_alterada`.
