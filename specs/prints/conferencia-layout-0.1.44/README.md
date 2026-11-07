# Conferência visual por captura — app 0.1.44 × contrato de layout (07/11/2026)

Primeira conferência da seção 6 de `specs/layout/README.md` feita com **capturas da app real**, na instância de homologação, e não por leitura de código (a anterior, R.8.1 do plano, foi por código). Serve de **linha de base**: mostra o quanto cada tela implementada está longe da referência antes de qualquer PR de tela.

| | |
|---|---|
| App na instância | 0.1.44 (a `main` estava em 0.1.45, que só muda a paleta das páginas públicas) |
| Shell | 0.56.37 |
| Conta | conta de QA já existente, com dados de QA. Não há conta "(demo)" na instância, e a semente do guia só entra nessas contas no boot da app. Os dados são exemplo (README § 1), então nomes e valores diferem; estrutura e medidas não dependem deles |
| Viewports | 1440 × 1000 no computador; 390 × 844 no celular, como o contrato |
| Fonte | a fonte do tema vem do Google Fonts, bloqueado na rede do ambiente; a captura usa a fonte do sistema. Larguras de texto variam alguns pixels (README § 5); caixas e tamanhos não |
| Como entrou sem senha | `apps/portal_corretor/scripts/conferencia-visual/capturar.mjs`: injeta o token da API em todas as chamadas e responde à rota de identidade do shell (só cookie) com o corpo da rota equivalente que aceita token. Nada é gravado na instância |
| Como comparou | `comparar.py`: imagem lado a lado (esquerda a referência, direita a app) e medidas extraídas do DOM, atravessando shadow roots, no formato dos `.layout.json` |

## Telas conferidas e telas fora

| Situação | Telas |
|---|---|
| Capturadas e comparadas (19) | P01, P03, P04, P05, P06, P07, P08, P09, P10, P12, P13, P14, P15, P17, M1, M3, M4, M5, M6 |
| Sem tela na app (WhatsApp, bloco 6/7; D-78) | P02 Conversas, P11 Mensageiro, M2 Conversa |
| Fase 3 | M7 Proprietário |
| Dependem de negociação aberta (a conta de QA não tem nenhuma) | P16 Mandato, M8 Aprovar negociação (P15 foi capturada no estado vazio) |
| Capturada, mas sem o estado da referência | M5: o portal da conta de QA não tem imóveis enviados, então a aba Imóveis não existe; ficou igual à M4 |

As imagens lado a lado estão nesta pasta (`<tela>.png`).

## Moldura comum (vale para todas as telas do corretor no computador)

Esta é a diferença estrutural que domina tudo o mais. A referência desenha o app ocupando a janela inteira: trilho de 88 px colado à esquerda, de alto a baixo, com **Criar** no topo e **Assistente** e avatar no pé; três colunas começando em y = 0. A app roda **dentro da página do shell**: barra do shell (56 px) + cabeçalho da página com o título (h1 de 20 px/700) e o botão **Criar** à direita + moldura com 24 px de margem. A moldura começa em **y = 130**, e o trilho (88 px, igual) fica em x = 25 e com 671 px de altura, com **Buscar** e **Assistente** no fim e sem Criar nem avatar.

| Medida | Referência | App 0.1.44 | Diferença | Causa | Decisão sugerida |
|---|---|---|---|---|---|
| Início da área do app | y = 0 | y = 130 (barra do shell 56 + cabeçalho da página) | 130 px a menos de altura útil | O shell é dono da barra e do cabeçalho da página (pedidos ao shell 14 e 15; exceção 11.9 do B1) | Aceitar e registrar como D-nn, ou pedir ao shell um modo "página cheia" para o app |
| Trilho | 88 × 1000, Criar no topo, Assistente e avatar no pé | 88 × 671, Buscar e Assistente no pé, sem Criar e sem avatar | Estrutura | Criar está no cabeçalho do shell (pedido 14); Buscar é o B10 sem D-xx (R.8.1) | Mesma do item acima; Buscar precisa de decisão |
| Colunas (lista · foco · contexto) | 340 · 712 · 300 (P05: 340 · 632 · 380) | 360 · 589 · 340 (P05: 360 · 529 · 400) | lista +20, foco −123, contexto +40 | `urbi-3-colunas` com margem de 24 px e proporção própria; o contrato pede `1 1 340px` máx. 380, `999 1 520px`, `1 1 300px` máx. 360 | Ajustar as proporções nos parâmetros do primitivo; onde não der, exceção nomeada |
| Título da coluna (h1 "Hoje", "Clientes") | 22 px/800 | 20 px/700 (é o cabeçalho da página do shell; dentro da coluna o título é 18 px/700) | −2 px, peso menor | Tipografia do tema e do shell | Dentro da tolerância de ±4 px em tamanho; o peso 800 não existe na fonte do tema (Montserrat vai até 700) → registrar como "vem do tema" |
| Botão padrão | 44 px (36 o pequeno, 56 Criar/Assistente) | `urbi-botao` com 34 px (padrão) e 25 px (pequeno) | −10 e −11 px | Primitivo `urbi-botao` não expõe altura | Fora da tolerância; é o primitivo → registrar a diferença (README § 1) e abrir pedido ao shell para tamanho "44" ou aceitar como D-nn |
| Chips | 23 px, raio 999 | `urbi-badge` 24 px | +1 | — | Igual |
| Busca / campo de texto | 44–46 px, raio 10 | `input` 32–36 px dentro de `urbi-campo` de 52–54 px (rótulo em cima) | campo −10 px; conjunto +8 px | Primitivo `urbi-campo` inclui o rótulo acima | Registrar como primitivo; conferir se o rótulo pode ir como placeholder na busca |
| Cartão | raio 14, borda 1, padding 16–20 | `urbi-card` raio 12, padding 16 | −2 raio | Tema | Dentro da tolerância |

## Tela a tela (computador)

Cada linha segue o § 6: (a) moldura e colunas, (b) presença e ordem dos blocos, (c) medidas, (d) espaçamento e fonte, (e) papéis de cor. "Estrutural" é bloco faltando, fora de ordem ou na coluna errada: enquanto houver, a tela não está pronta pelo contrato.

| Tela | O que bate | Diferenças estruturais (bloqueiam) | Medidas fora de ±4 px | Observação |
|---|---|---|---|---|
| **P01 Hoje** | Três colunas; esquerda com título, data, "Precisa de você · N"; centro "Fila do dia" na ordem do mais urgente, cartões com chips; direita Agenda, Sua semana (4 números), Dica do Assistente | "Precisa de você" com **Abrir** em vez de **Assumir**; sem "Primeiros passos · x de 5"; cartões da fila sem o botão secundário ("Falar com Ana", "Registrar proposta") nem "Mais N para depois"; chips do cartão repetem "Quente · Quente" em vez de "tipo · temperatura"; Sua semana em uma coluna de 4 KPIs (referência: grade 2×2) | Colunas (moldura); botões 34 vs 44; KPI valor 22 vs 28 | Conta de QA tem 50 itens na fila; o mockup mostra 4 |
| **P03 Funil** | Alternador Funil · Lista · Negociações; funis com contagem; filtros prontos; quadro por etapa com cartões de cliente e temperatura | Lista à esquerda ganhou **filtros por temperatura e "sem contato há"** no lugar da seção "Por temperatura" com contagens e da lista de "Listas salvas" (D-83 tira as listas; as contagens por temperatura faltam); **coluna direita recolhida** por padrão (0.1.44, "espaço do centro"): o cliente escolhido não aparece até clicar; taxas de passagem como chips em linha, não como 4 KPIs no topo do quadro | Coluna esquerda 280 (lista estreita) vs 340; quadro 975 vs 712 | A decisão de recolher a direita é da sessão de 07/11; a referência tem as três colunas abertas |
| **P04 Cliente** | Lista com Importar e Novo, busca, chips de papel, lista com etapa, origem e temperatura; ficha com avatar, nome, chips, Conversa e Resumir; abas Resumo · Linha do tempo · Enviados · Negócios; direita com Perfil de busca, Portal do cliente, Privacidade | Alternador Funil · Lista · Negociações está **abaixo** de Importar/Novo (referência: acima da busca); ficha abre na aba **Resumo** com "Próximo passo" e "Cadastro" em cartões, enquanto a referência mostra a **Linha do tempo** como foco; filtros a mais na lista (Todos · Novos · Sem contato · Quentes · Retorno vencido e os selects) | Busca 36 vs 46; botões 25–34 vs 36–44 | Histórico numa aba do centro, e não na direita como D-92/D-106 (R.8.1 item 6) |
| **P05 Assistente** | Assistente abre na coluna direita e as outras ficam (D-109); campo de pergunta e Enviar no pé; Fechar no topo | Sem os **chips de perguntas sugeridas**; sem **microfone**; conversa vazia não mostra exemplo; largura da coluna do Assistente 400 vs 380 | Campo 75 (textarea) vs 46; Enviar 25 vs 44 | R.8.1 item 8 |
| **P06 Imóveis** | Abas Carteira · Empreendimentos com total, busca, lista com miniatura, código, preço, situação e nota; ficha com Editar, Criar conteúdo e Mais; Dados; Quem vê; direita com Qualidade, Últimos 30 dias, Clientes que combinam | Ficha mostra **uma foto grande redonda** e três miniaturas redondas em vez da grade de fotos (capa + 2 colunas + "+N fotos"); **Descrição + Melhorar com IA** e **Autorização de venda** não aparecem na primeira dobra (estão abaixo de Dados); Qualidade como "50 de 100" com bolinhas, não barra; "Últimos 30 dias" com 4 números em grade 2×2 (referência: 4 em 2 linhas de 2, igual) | Foto da ficha 240 px de diâmetro vs grade de 3 × 150 px; botões 34 vs 36/44 | A foto redonda é um bloco em ordem e forma diferentes: estrutural |
| **P07 Novo imóvel** | 4 passos à esquerda com Salvar rascunho; centro com "Fotos", "Passo 1 de 4", área de envio; direita com "Qualidade agora · 0" e a caixa da IA; Voltar / Salvar rascunho / Próximo | Passo 1 pede **Tipo, Cidade e Código** antes das fotos (a referência começa pelas fotos e deixa dados para o passo 2; R.8.1 registra "porque a rota exige", sem D-xx); sem grade de miniaturas com rótulo de ambiente | Campos 32 vs 44; área de envio 160 px vs grade | Fluxo diferente do contrato: precisa de decisão |
| **P08 Estúdio** | Esquerda com Criar rápido (4 atalhos) e Seus pedidos com filtros; centro com estado vazio e compositor; direita com Esta semana, Biblioteca | Criar rápido em **2 colunas de botões pequenos** (referência: 4 cartões 2×2 com título e subtítulo); sem o pedido aberto como conversa com prévias e os três botões Agendar · Publicar agora · Baixar (D-89 a D-91 mudaram o fluxo: arte fora do app); sem "Créditos do mês" (D-87); aviso amarelo do Instagram ocupa o topo do centro | Compositor 75 vs 46; botões 34 vs 56–66 | Grande parte é por decisão (D-86, D-89 a D-91, D-105); a forma do Criar rápido não |
| **P09 Página** | Esquerda com endereço, estado, blocos com Mostrar e setas, "Refazer a página com IA"; centro com Pré-visualização Celular · Computador; direita com o bloco escolhido, Marca, Últimos 30 dias, Copiar link | Sem botão **Publicar** no cabeçalho da coluna (publicada "desde"); prévia ocupa o centro em largura cheia, não como um celular de 300 px centralizado com borda; ajustes do bloco abrem em diálogo ("Editar bloco"), não na direita (pendência B7) | Prévia 589 px vs 300 px | Setas em vez de arrastar é exceção 11.9 do B7 |
| **P10 Números** | Lista de relatórios com descrição à esquerda; centro com período (7 · 30 · 90 · 12 meses), Comparar, Origem; KPIs; gráfico; direita com "O que melhorar" + "Ver os N clientes", Melhores origens, Exportar CSV | Abre em **Resumo** com KPIs Leads · Conversão · Vendas · Comissão (a referência abre em "Funil e conversão" com Contatos · Contato→visita · Visita→proposta · Ganhos e as barras "Até onde os contatos chegaram"); Comparar é botão, não link; sem "Contatos por horário" e "Por que perdemos" na primeira dobra | KPI 28 px igual; botões 25–34 vs 36 | O relatório padrão difere do mockup: decisão |
| **P12 Conexões** | Menu de Ajustes à esquerda com as 7 seções; cartões Instagram, WhatsApp, Agenda; direita "Por que conectar aqui" e Assistente | Cartões **sem os passos numerados** do WhatsApp (D-59/D-78: WhatsApp "ainda não disponível"); Instagram "não configurado pela equipe" na instância (pendência #30), por isso sem "Conectado · Desconectar · Testar publicação"; itens do menu sem a linha de estado ("ligado · texto") | — | Quase tudo por decisão ou pendência de ambiente |
| **P13 Conta e marca** | Menu de Ajustes; centro com Seus dados, Conta, Sua marca, Referências; direita com ajuda e aviso do CRECI | Edição por **diálogo** (lápis) em vez de formulário na tela com Salvar (R.8.1 registra sem D-xx); sem "Regiões que atende" e "Tom de voz" (R.8.1 item 11); sem Plano e créditos à direita (D-87) | Sem campos na tela para medir | — |
| **P14 Importar** | Fontes à esquerda; centro com origem da planilha e área de envio; direita com repetidos (Pular · Completar · Substituir) e consentimento | Estado inicial sem arquivo (a referência mostra o arquivo carregado, o mapeamento e a prévia); repetidos como **chips** em vez de rádios com explicação; vCard e outro CRM "em breve" (item 13 do R.8.1) | Área de envio 120 px; botões 34 vs 44 | Para comparar o mapeamento e a prévia é preciso enviar um CSV (escrita; não feito) |
| **P15 Negociações** | Nova proposta, filtros (Em andamento · Aguardando você · Negociador · Cliente · Proprietário · Encerradas) | Estado vazio: sem negociação na conta de QA, o centro mostra "Escolha uma negociação" e a direita fica recolhida ("Mandato" na borda) | — | Precisa de conta com a semente do guia para comparar a faixa, a escada e o cartão "Negociador sugere" |
| **P17 Negociador** | Menu de Ajustes; centro com 1 Quando entra (4 gatilhos), 2 Quem negocia (Negociador IA padrão, Convidar negociador), 3 Estilo (3 estilos com exemplo), 4 Regras fixas; direita com "O que é o Negociador", 7 Testar (campos de pedido, alvo, recuo, oferta, teto, fala do comprador), Números do mês | Seções em **uma coluna** (referência: 1 e 2 lado a lado, 4 e 5 lado a lado, 6 Objeções embaixo); "Ligado · Pausar" vira um interruptor dentro da seção 2; Estilo como lista com "Usar" em vez de 3 cartões selecionáveis; Testar com formulário de valores em vez da conversa simulada com "não revelou o recuo" | Campos 32–36 vs 40–46; textarea 144 vs 160 | A grade 2×2 das seções é estrutural |

## Tela a tela (celular)

| Tela | O que bate | Diferenças estruturais | Observação |
|---|---|---|---|
| **M1 Hoje** | Cabeçalho do shell com o nome do app; "Fila do dia · N" com cartões de um toque | A app mostra **barra "Menu"** + abas **Hoje · Fila · Agenda** e abre na aba Fila; a referência abre em "Precisa de você" seguido da fila, numa só rolagem, e tem a **linha de atalhos do dia** no pé (Conversas · Criar · Imóveis · Assistente), que falta (R.8.1 item 4); Criar no cabeçalho (pedido 14) | Cartões 34 px de botão vs 44; alvos de toque ≥ 44 só no cartão inteiro |
| **M3 Novo imóvel** | "Novo imóvel", "Passo 1 de 4", botão de fotos, Salvar rascunho e Próximo no pé | Abas Passos · Novo imóvel · Qualidade e Tipo/Cidade/Código antes das fotos (igual à P07); sem miniaturas com rótulo; sem "A IA já entendeu" e "Ditar o resto" (R.8.1 item 10) | Botões do pé 34 vs 44 |
| **M4 Portal** | "Meu atendimento", abas Conversa · Imóveis · Agenda · Arquivos, campo "Escreva para o corretor" | Topo é uma **capa azul grande** com nome, CRECI e "Falar no WhatsApp" (D-104: marca do corretor), sem a faixa verde "Próximo passo · Ver"; a aba Conversa mostra "Histórico" com marcos, não mensagens nem cartão de imóvel (R.8.1 item 15); campo como caixa grande com Enviar, não como linha com botão redondo | A capa toma 300 px dos 844 |
| **M5 Portal · imóveis** | — | Não comparável: o portal desta conta não tem imóveis enviados, e a aba Imóveis mostra "0" | Precisa de conta com a semente |
| **M6 Página pública** | Capa com iniciais, nome, CRECI, "Falar no WhatsApp"; "Destaques" com cartões de imóvel com foto, preço e dados | Capa com texto de apresentação e `@instagram` dentro (referência: só nome, linha e botão); cartão de imóvel com **preço acima do título** e sem "Quero saber mais" (referência: preço e botão na mesma linha); título do bloco "Destaques da semana" (referência "Imóveis em destaque") | A cor da capa é a da marca (D-85) |

## Medidas extraídas (resumo por tela)

Alturas em px. "Botões": alturas distintas encontradas (referência: `button`; app: `urbi-botao`). "Campos": referência mede o `label` que envolve o `input`; app mede o `input`. Colunas da referência são as três `section` dentro de `main`; da app, os `urbi-hospedeiro` do `urbi-3-colunas`.

| Tela | Trilho ref/app | Colunas ref | Colunas app | h1 ref/app | Botões ref/app | Campos ref/app | Chips ref/app |
|---|---|---|---|---|---|---|---|
| M1-Hoje | None/None | [] | [382] | 24px/800/20px/700 | [44]/[25, 34] | []/[] | [23]/[24] |
| M3-Novo-imovel | None/None | [] | [382] | 22px/800/20px/700 | [44, 52, 120]/[25, 34] | []/[32, 36] | [23]/[24] |
| M4-Portal | None/None | [] | [] | None/25.6px/700 | [44, 48]/[] | [46]/[96] | []/[] |
| M5-Portal-imoveis | None/None | [] | [] | None/25.6px/700 | [44, 48]/[] | [44]/[96] | [23]/[] |
| M6-Pagina-publica | None/None | [] | [] | None/25.6px/700 | []/[] | []/[13, 44, 96] | []/[] |
| P01-Hoje | 88/88 | [340, 712, 300] | [360, 589, 340] | 22px/800/20px/700 | [36, 44, 56]/[25, 34] | []/[] | [23]/[24] |
| P03-Funil | 88/88 | [340, 712, 300] | [280, 975] | 22px/800/20px/700 | [36, 56]/[20, 25] | []/[36] | [23]/[24] |
| P04-Cliente | 88/88 | [340, 712, 300] | [360, 589, 340] | 22px/800/20px/700 | [36, 44, 56]/[20, 25] | [46]/[32, 36] | [23]/[24] |
| P05-Assistente | 88/88 | [340, 632, 380] | [360, 529, 400] | 22px/800/20px/700 | [36, 56]/[25, 34] | [46]/[75] | [23]/[24] |
| P06-Imoveis | 88/88 | [340, 712, 300] | [360, 589, 340] | 22px/800/20px/700 | [36, 56]/[20, 25, 34] | [46]/[32] | [23]/[24] |
| P07-Novo-imovel | 88/88 | [340, 712, 300] | [360, 589, 340] | 22px/800/20px/700 | [36, 44, 56]/[25, 34] | [67, 84]/[32, 36] | [23]/[24] |
| P08-Estudio | 88/88 | [340, 712, 300] | [360, 589, 340] | 22px/800/20px/700 | [36, 56, 64, 66, 79]/[25, 34] | [26, 46]/[75] | [23]/[24] |
| P09-Pagina | 88/88 | [340, 712, 300] | [360, 589, 340] | 22px/800/20px/700 | [36, 56]/[20, 25, 34] | [19]/[13, 16, 44, 96] | []/[24] |
| P10-Numeros | 88/88 | [340, 712, 300] | [360, 589, 340] | 22px/800/20px/700 | [36, 56]/[25, 34] | []/[36] | [23]/[24] |
| P12-Conexoes | 88/88 | [340, 712, 300] | [360, 589, 340] | 22px/800/20px/700 | [36, 56]/[25] | []/[] | [23]/[24] |
| P13-Conta | 88/88 | [340, 712, 300] | [360, 589, 340] | 22px/800/20px/700 | [36, 44, 56]/[20, 25, 34] | [48, 67]/[] | [23]/[] |
| P14-Importar | 88/88 | [340, 712, 300] | [360, 589, 340] | 22px/800/20px/700 | [44, 56]/[25, 34] | [58, 60]/[36] | [23]/[24] |
| P15-Negociacoes | 88/88 | [340, 712, 300] | [360, 895] | 22px/800/20px/700 | [18, 36, 56]/[25] | []/[] | [23]/[] |
| P17-Negociador | 88/88 | [340, 712, 300] | [360, 589, 340] | 22px/800/20px/700 | [36, 46, 56]/[25] | [40, 46, 160]/[16, 32, 36, 48, 144] | [23]/[24] |

## Diferenças que o primitivo impõe (README § 1, "usar o primitivo e registrar")

| Diferença | Primitivo | Valor do contrato | Valor do primitivo |
|---|---|---|---|
| Altura do botão padrão | `urbi-botao` | 44 (36 o pequeno) | 34 (25 o pequeno) |
| Altura do campo de texto | `urbi-campo` + `input` | 44, raio 10, sem rótulo interno | 32–36 dentro de um bloco de 52–54 com rótulo em cima |
| Raio do cartão | `urbi-card` | 14 | 12 |
| Peso 800 nos títulos | fonte do tema (Montserrat) | 800 | 700 (a fonte não tem 800) |
| Margem da moldura e proporção das colunas | `urbi-3-colunas` dentro de `urbi-shell-page` | colunas de 340 · resto · 300, coladas nas bordas | 24 px de margem, 360 · resto · 340 |

## O que fazer com isto

1. Antes de qualquer PR de tela, o dono decide a **moldura**: aceitar a página do shell (barra + cabeçalho + 24 px) como está, registrando D-nn e a diferença de 130 px, ou pedir ao shell o modo "página cheia". Tudo o mais se mede a partir dessa decisão.
2. As diferenças de **primitivo** (botão 34, campo 32–36, raio 12) entram como linhas fixas na tabela de todo PR de tela, até haver pedido ao shell ou D-nn.
3. As diferenças **estruturais** listadas por tela viram o escopo do PR de cada tela; as que já têm D-xx ficam registradas como "por decisão".
4. Para P15, P16, M5 e M8 é preciso uma conta **"(demo)"** na instância (nome terminando em "(demo)") e um boot da app, para a semente do guia entrar; depois, rodar os dois scripts de novo.
5. P02, P11, M2 e M7 ficam fora até o WhatsApp (bloco 6/7) e a fase 3.

## Como repetir

```bash
node apps/portal_corretor/scripts/conferencia-visual/capturar.mjs pinguim /tmp/capturas
python3 -I apps/portal_corretor/scripts/conferencia-visual/comparar.py /tmp/capturas specs/prints/conferencia-layout-<versão> --md
```

O primeiro lê `URBIVERSO_INSTANCIAS` do ambiente e não imprime o token. O segundo precisa de Pillow e gera as imagens lado a lado e a tabela de medidas em Markdown.
