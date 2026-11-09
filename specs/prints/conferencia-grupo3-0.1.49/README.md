# Conferência visual do grupo 3: P06 Imóveis, P07 + M3 Novo imóvel, P15 Negociações e M8 (app 0.1.49, 09/11/2026)

Esta é a conferência da seção 6 de `specs/layout/README.md` (contrato versão 2) para o **grupo 3 da fase 1.7** (etapa 4, PR [#203](https://github.com/rafaleandrog/app-corretor/pull/203)). Cada tela foi capturada na **app real em homologação** e posta ao lado da referência aprovada pelo dono. As tolerâncias e regras seguem as decisões:

- **D-121:** ±4 px nas colunas fixas, nas alturas e nas medidas internas. O centro é flexível e não entra na conta.
- **D-122:** chip "Todas" primeiro.
- **D-123:** botão só com ícone fica em 48 × 29 até o pedido 24.
- **D-124:** usar o primitivo como ele é e registrar a diferença.
- **D-128:** cabeçalho comum e sem `pequeno` em Imóveis.

| | |
|---|---|
| App na instância | 0.1.49, pré-release do branch `etapa4/grupo3` (build do head `d5dd94e`; os commits seguintes só mexem em `specs/`), instalado pela atualização automática da homologação |
| Shell | 0.56.37 |
| Conta | **Corretor A (demo)** (id 7). Quatro imóveis (um ativo com descrição e mandato, um rascunho), **nenhuma foto enviada**, duas negociações (Ana Ribeiro com o Negociador IA aguardando você; Juliana Prado sem oferta). Nenhum comprador tem perfil de busca, por isso "Clientes que combinam" aparece vazio |
| Viewport | Computador com 1440 de largura (altura 1420). Celular com 390 × 844 |
| Área capturada | Só a moldura de três colunas, de 1392 × 1221 px |
| Fonte | Fonte do sistema. O Google Fonts está bloqueado na rede do ambiente, então a largura dos textos varia alguns pixels. Caixas e tamanhos não variam |
| Como entrou sem senha | `capturar.mjs pinguim <saída> P06-Imoveis,P07-Novo-imovel,M3-Novo-imovel,P15-Negociacoes,M8-Aprovar-negociacao` com `CONTA=7 CONVERSA=1` |
| Como comparou | `comparar.py --md` |

Arquivos desta pasta:

- `<tela>.png`: lado a lado, com a referência à esquerda e a app à direita.
- `<tela>.app.png`: só a captura da app.
- `<tela>.app.json`: as medidas extraídas.
- `medidas.md`: a tabela de medidas.

**P16 Mandato** não está no script de captura. Ela é um `urbi-modal` que se abre de dentro da P15 (Editar mandato), e o script não clica. Fica para conferência manual ou para um passo de clique no script; está registrada nas pendências do grupo 3.

## Moldura (as cinco telas)

A moldura é a mesma dos grupos 1 e 2. As colunas medem 360 · 691 · 339 contra 360 · 589 · 340 da referência. O centro é flexível (D-121); o −1 da coluna de contexto é o filete do primitivo. O título usa `urbi-prosa papel="titulo"` com 20 px e peso 700 (−2 px). O botão padrão tem 34 px, o campo 32 a 36 px e os chips 24 px (+1). Os botões de 25 px em `medidas.md` são do cabeçalho do shell e devem ser ignorados.

| Medida | Referência v2 | App 0.1.49 | Diferença | Causa | Decisão |
|---|---|---|---|---|---|
| Buscar e Assistente | Assistente com 34 × 34 | Buscar e Assistente com 48 × 29 | +14 × −5; Buscar a mais | D-126 e D-123 | Diferença aprovada (D-126) e registrada (D-123) |

## P06 Imóveis

| Medida | Referência v2 | App 0.1.49 | Diferença | Causa | Decisão |
|---|---|---|---|---|---|
| Cabeçalho da esquerda | "Imóveis" + Novo + Assistente | "Imóveis" + Novo + Buscar + Assistente, sem `pequeno` | Buscar | D-126, D-128 | Igual |
| Carteira · Empreendimentos | Segmentado com contagem | Dois chips-link com ícone e contagem | Forma | Não há segmentado no catálogo | Registrada (D-124) |
| Busca | Campo de 46 px | `urbi-input` de 34 px | −12 | Primitivo | Registrada (D-124) |
| Chips | Uma linha: Ativos · Rascunhos · Públicos · Privados | Duas linhas: Todas · Ativos · Rascunhos · Vendidos e Todas · Públicos · Privados | Linha a mais e "Todas" | D-122; a visibilidade é um filtro à parte | Igual (D-122) |
| Lista | Miniatura quadrada, título curto, bairro · preço, nota e situação à direita | Avatar redondo com ícone (sem foto), título curto, bairro · preço, chips de situação e de nota abaixo; sem rolagem lateral | Avatar redondo; chips abaixo | `urbi-lista` com `urbi-avatar` (D-65); parte da #180 | Registrada (exceção "grade de fotos", 11.9) |
| Título da ficha | "Casa 4 quartos · Jardim Botânico", código na linha de baixo | "IM-0001 · Casa 4 quartos · Jardim Botânico" | Código no título | Uma linha só no cabeçalho | Registrada |
| Ações do cabeçalho | Editar · Criar conteúdo | Editar · **Criar conteúdo** · Mais | "Mais" a mais | Menu "mais" (spec 2.6) | Igual à spec |
| Grade de fotos | Capa grande + 4 miniaturas + "+8 fotos" | Não aparece; no lugar, o bloco "Fotos e arquivos" com o seletor | Grade ausente | A conta demo não tem foto. A grade (`urbi-avatar` em `urbi-grid`) só aparece com mídia | Estado vazio; a grade preenchida fica sem captura (pendência) |
| O que falta | Lista de verificação na direita (Qualidade) | Cartão "O que falta · 55 de 100" no topo do centro e Qualidade na direita | Bloco a mais no centro | Brief do grupo 3 (O que falta no topo) | Igual |
| Dados | Grade de 3 colunas com preço, área, quartos, vagas, condomínio e IPTU | Grade com situação, qualidade, tipo, preço, local e cômodos | Campos | Cartão de dados da 0.1.x com Editar no lápis | Registrada |
| Ordem do centro | Fotos, dados, Descrição, Autorização + Quem vê | Dados, Descrição, Autorização, Quem vê, Fotos e arquivos, Visitas, Enviados | Fotos depois | Sem foto, o bloco com o seletor fica no fim | Registrada |
| Autorização e Quem vê | Lado a lado | Empilhados | Coluna | Primitivo de layout do centro | Registrada (D-124) |
| Últimos 30 dias | Grade 2 × 2 | Uma coluna de 4 `urbi-kpi` (Visitas, Enviado a, Cliques, Negócios), cabendo nos 340 px | Grade → coluna | Piso de 140 px do `urbi-kpi` (parte da #180) | Registrada (D-124) |
| Clientes que combinam | Lista com Enviar | Estado vazio | Estado | Nenhum comprador com perfil de busca na conta demo | Igual (estado vazio) |
| Mandato | Não aparece na referência da P06 | Pedido, alvo, recuo "•••• mostrar" e Editar mandato | Bloco a mais | Brief do grupo 3 (Mandato resumido; tela do corretor) | Igual ao brief |

## P07 Novo imóvel

| Medida | Referência v2 | App 0.1.49 | Diferença | Causa | Decisão |
|---|---|---|---|---|---|
| Esquerda | Passos 1 a 4 com estado e Salvar rascunho | Passos 1 a 4, Salvar rascunho, e a frase "Nenhum passo pede CRECI" | — | D-93 | Igual |
| Passo 1 | Grade de fotos (com Capa sugerida e rótulo) e o bloco Dados na mesma página | Passo 1 só com Fotos (seletor "Tirar fotos ou escolher da galeria"), código opcional, Voltar · Salvar rascunho · Próximo: dados | Fotos e dados em passos separados | Um passo por vez (spec 11.1 P07); a referência mostra o passo 2 já preenchido | Registrada |
| Grade das fotos | Miniaturas com rótulo e "Capa sugerida" | Não aparece | Sem foto | A captura não envia arquivos (só leitura) | Estado vazio |
| Selo do passo | "Passo 1 de 4" | `urbi-badge` "Passo 1 de 4" | — | — | Igual |
| Direita | Qualidade agora · 64, barra, lista e "Depois de salvar" | Qualidade agora · 0, bolinhas, o que falta e o cartão "A IA" com Depois de salvar e **Pacote de lançamento** (desabilitado até salvar) | Barra → bolinhas | Não há barra de progresso no catálogo (11.9) | Registrada (11.9) |

## M3 Novo imóvel (celular, 390 × 844)

| Medida | Referência v2 | App 0.1.49 | Diferença | Causa | Decisão |
|---|---|---|---|---|---|
| Topo | Cabeçalho do shell | Cabeçalho do shell, seletor de conta, abas Passos · Novo imóvel · Qualidade e Criar | Seletor e abas a mais | Shell 0.56.37 no celular (um painel por vez) | Pelo shell (D-114) |
| Fotos primeiro | Botão grande no topo | Seletor com o botão "Tirar fotos ou escolher da galeria" no topo | Caixa do primitivo | `urbi-seletor-arquivo` | Registrada (D-124) |
| Grade de ambientes e "A IA já entendeu" | Grade com rótulos e cartão | Não aparece | Sem foto | Estado vazio da conta demo | Estado vazio |
| Ditar o resto | Botão de microfone abaixo | Aparece no passo 2 | Passo | Ditar preenche os dados do passo 2 | Registrada |
| Salvar rascunho · Continuar | Fixos no rodapé | No fim da coluna (Voltar · Salvar rascunho · Próximo: dados) | Não fixos | Não há primitivo de rodapé fixo (D-124, 11.9) | Registrada (11.9) |

## P15 Negociações

| Medida | Referência v2 | App 0.1.49 | Diferença | Causa | Decisão |
|---|---|---|---|---|---|
| Cabeçalho da esquerda | "Clientes" + Nova proposta + Assistente e o alternador Funil · Lista · Negociações | "Negociações" + Buscar + Assistente e o botão **Nova proposta** abaixo; sem alternador | Título e alternador | A tela está em `/negociacoes`, rota própria; o alternador fica em Clientes | **A decidir:** igualar ao cabeçalho de Clientes (alternador) ou manter a rota própria |
| Chips | Aguardando você 1 · Negociador 1 · Cliente 1 · Proprietário 1 · Encerradas | Em andamento · Aguardando você · Negociador · Cliente · Proprietário · Encerradas, sem contagem | Sem contagem; "Em andamento" a mais | Filtro padrão em andamento | Registrada |
| Lista | Avatar, nome, imóvel · última oferta · %, temperatura e chip de quem conduz | Nome + chip de estado, imóvel, "R$ 1,32 mi × R$ 1,45 mi · −9%", quem conduz · tempo (#178) | Sem avatar | `urbi-lista` | Registrada (D-124) |
| Abre na primeira | Ana selecionada | Ana selecionada | — | — | Igual |
| Cabeçalho do centro | Avatar, "Ana Ribeiro · Casa 4 quartos, Jardim Botânico", chips de rodada, condutor e validade; Assumir | "Ana Ribeiro · Casa 4 quartos · Jardim Botânico" (#178), NG-0001 · IM-0001 · rodada 2 de 4, chips de estado, rodada, condutor e validade; **Assumir** · Mais | Sem avatar; Mais a mais | Menu "mais" com Encerrar | Igual à spec |
| Faixa da negociação | Barra gráfica com marcas | Marcas em `urbi-badge` por ordem de valor, com o recuo mascarado | Forma | Lacuna "faixa ZOPA" (11.9) | Registrada (11.9) |
| Escada de propostas | Tabela de 6 colunas | `urbi-lista` compacta: rodada · quem · valor e o canal · data | Tabela → lista | Parte da #180 e da #190 (11.9) | Registrada (11.9) |
| Nova contraproposta | Não aparece | Botões **Pedir sugestão** e **Nova contraproposta** abaixo da faixa | Botão a mais | D-120 | Igual à D-120 |
| Cartão "Negociador sugere" | Abaixo da conversa, com Enviar · Editar · Descartar | Não aparece | Estado | Não há sugestão pendente na conta demo (Pedir sugestão gera uma) | Estado |
| Direita | Mandato, Leitura do comprador, Próximo movimento | Mandato (com BATNA mascarada e concessões), Quem negocia, Leitura do comprador, Próximo movimento (Passar ao proprietário) | Quem negocia a mais | D-108 | Igual |

## M8 Aprovar negociação (celular, 390 × 844)

| Medida | Referência v2 | App 0.1.49 | Diferença | Causa | Decisão |
|---|---|---|---|---|---|
| Painel aberto | A negociação: cabeçalho "Ana Ribeiro · Casa J. Botânico · rodada 4 de 4" com voltar, faixa, última oferta, Negociador sugere, Enviar · Editar · Assumir no rodapé | O painel da lista (abas do shell Negociações · Negociação · Mandato, com a primeira ativa) | Painel inicial | O script abre `/negociacoes` sem `?item=`, e o shell no celular começa pelo primeiro painel; a negociação está na aba "Negociação" | **Captura incompleta:** a tela do M8 (aba Negociação) fica sem lado a lado; o script precisa de um passo que toque a aba. Pendência |
| Ações fixas | Enviar · Editar · Assumir fixos no rodapé | No fim do cartão de sugestão (pelo código) | Não fixas | Não há primitivo de rodapé fixo (D-124, 11.9) | Registrada (11.9) |

## Decisões aplicadas

- D-121: as colunas fixas estão dentro de ±4 px; o centro não entra.
- D-122: "Todas" vem primeiro nos chips de situação e de visibilidade.
- D-123: botões só com ícone ficam em 48 × 29 (pedido 24).
- D-124: grade de fotos, escada em lista, `urbi-kpi` em coluna, faixa em badges, ações fora do rodapé e segmentado em chips.
- D-128: cabeçalho comum e sem `pequeno` em Imóveis.

## Pendências desta conferência

1. **P16** (modal) e **M8** na aba Negociação ficaram sem captura. O script só navega por URL e não toca em botão nem em aba.
2. A grade de fotos preenchida e o "Clientes que combinam" com itens dependem de mídia e de perfil de busca na conta demo (escrita na instância, fora do escopo de leitura).
3. **P15:** cabeçalho "Negociações" com rota própria, contra "Clientes" com o alternador da referência. É decisão do dono.
