# Conferência visual do grupo 5: P05 Assistente, P10 Números, P12 Conexões, P13 Conta, P14 Importar e P17 Negociador (app 0.1.51, 09/11/2026)

Conferência da seção 6 de `specs/layout/README.md` (contrato versão 2) para o **grupo 5 da fase 1.7** (etapa 4, branch `etapa4/grupo5`). Cada tela foi capturada na **app real em homologação** e posta ao lado da referência aprovada. Tolerâncias e regras pelas decisões:

- **D-121:** ±4 px nas colunas fixas (360 e 340), nas alturas e nas medidas internas. O centro é flexível.
- **D-122:** chip "Todas" primeiro.
- **D-123:** botão só com ícone fica em 48 × 29 até o pedido 24.
- **D-124:** usar o primitivo como ele é (botão só ícone, `urbi-lista` sem item ativo pintado, `urbi-redator`, balões, `nav`, `gap`) e registrar a diferença.
- **D-126:** Buscar + Assistente no cabeçalho da esquerda.
- **D-128:** cabeçalho comum e sem `pequeno`.
- **D-119:** a referência é o alvo; diferença só por limite real da plataforma.
- **D-125 e D-127** não se aplicam a estas telas.

| | |
|---|---|
| App na instância | 0.1.51 (branch `etapa4/grupo5`), instalada na homologação "pinguim" |
| Conta | **Corretor A (demo)** (id 7), a mesma do grupo 4 |
| Viewport | Computador 1440 (altura 1420); só a moldura de três colunas, 1392 × 1221 |
| Fonte | Fonte do sistema (Google Fonts bloqueado): a largura dos textos varia alguns pixels |
| Como capturou | `CONTA=7 CONVERSA=1 capturar.mjs pinguim <pasta> P05-Assistente,P10-Numeros,P12-Conexoes,P13-Conta,P14-Importar,P17-Negociador`; comparação com `comparar.py --md` (saída em `medidas.md`). Só leitura: o script apenas navega. |

Arquivos: `<tela>.png` (referência à esquerda, app à direita), `<tela>.app.png`, `<tela>.app.json`, `medidas.md`.

## Telas capturadas e lacunas de captura

As seis telas foram capturadas. Lacunas (o script não clica, não digita e não envia arquivo; nada foi escrito na instância):

1. **P05:** a rota `/assistente` abre a tela Hoje com o painel do Assistente **vazio** ("Nenhuma mensagem ainda"). Sem captura: conversa com resposta, o cartão de ação proposta (Confirmar · Cancelar) e o "Ir para Conexões".
2. **P10:** só a aba "Funil e conversão" (a aberta). Resumo da semana, Origem, Conteúdo, Mensageiro e Créditos não foram abertos.
3. **P12:** só a seção Conexões. WhatsApp, Instagram e Agenda estão nos estados reais da homologação, não nos da referência (conectado).
4. **P13:** a página passa de 1221 px e a captura termina em "Referências"; o fim (Salvar, resto de Referências) não aparece. O Plano e créditos da referência não é desta tela na app.
5. **P14:** só o estado inicial, sem arquivo. **Não foi possível conferir** o mapeamento de colunas, a prévia, "Importar N contatos" e o Cancelar, que exigem enviar uma planilha (escrita).
6. **P17:** captura até "Suas instruções" e "Regras fixas"; "6 Respostas a objeções" fica abaixo do corte. O teste do Negociador não foi enviado.

## Moldura (todas)

Colunas 360 · 691 · 339 contra 360 · 589 · 340: dentro de D-121 nas fixas (−1 é o filete). H1 com 20 px e peso 700 (referência 22 px, dentro de ±4). Botões de 25 px são do cabeçalho do shell; 29 px é o só ícone (D-123); 34 px o padrão. Chips de 24 contra 23. Cabeçalho da esquerda com **Buscar + Assistente** (D-126). A lista da esquerda não pinta o item ativo (D-124).

**Exceção à moldura, P05:** colunas 360 · 651 · **379** contra 360 · 589 · 340. A direita passa **+39 px** do alvo de 340 (D-121), mas a spec do grupo 5 fixa o Assistente em 380 px (tabela de primitivos por tela). É escolha da spec, não erro de captura: **confirmar com o dono que a referência vale 380**.

## P05 Assistente

| Diferença | Referência v2 | App 0.1.51 | Causa | Decisão |
|---|---|---|---|---|
| Coluna direita | 340 px | 379 px | Spec do grupo 5 (380) | **A confirmar** (passa de D-121) |
| Centro | Fila do dia (4 itens: Visita, Quente, Aprovar, Retomar) | Fila do dia com 5 contatos, cada um com Fazer agora · Falar com · mais | Tela Hoje real, dados da conta demo | Dado |
| Conversa | Pergunta, resposta, ação proposta | "Nenhuma mensagem ainda" | Sem captura (lacuna 1) | Sem captura |
| Perguntas sugeridas | 3 chips no pé | 3 chips no topo do painel, antes do exemplo | Spec do grupo 5 (`urbi-badge interativo`) | Igual à spec |
| Campo | Linha de 38 px com microfone e enviar | `urbi-redator` de 75 px, "Enviar" em texto | Primitivo | Registrada (D-124) |
| Fechar | X no cabeçalho | X, só ícone | D-123 | Igual |
| Esquerda | Só o Assistente; "Precisa de você · 2" | Buscar + Assistente, filtros Hoje/Agenda, "Primeiros passos 3 de 5" | D-126; tela Hoje real | Igual (D-126) |

## P10 Números

| Diferença | Referência v2 | App 0.1.51 | Causa | Decisão |
|---|---|---|---|---|
| Navegação esquerda | 7 itens com o ativo pintado | Itens sem fundo no ativo; descrição pequena abaixo | D-124 (`urbi-lista`) | Registrada |
| Filtros | Chips "30 dias · Comparar · Todas as origens" | 5 chips de período, **Comparar** botão e select "Origem" | Mais opções na app; "Todas" por D-122 | Registrada |
| KPIs | 4 cartões; 58 · 31% · 28% · 2 | 4 cartões; 6 · 50% · 67% · 0 | Dados da conta 7 | Dado |
| Funil | Barras horizontais por etapa (Contatos a Ganhos) | **Gráfico de colunas** com 5 etapas e legenda Este período · Período anterior | `urbi-grafico` | **A decidir:** forma do gráfico |
| Contatos por horário | Colunas pequenas, texto "Em roxo, fora do seu horário" | Gráfico largo com legenda no horário · fora do horário | Primitivo de gráfico | Registrada |
| Por que perdemos | Lista com 4 motivos e contagem | "Nenhuma perda no período" | Dado | Estado |
| Direita | "O que melhorar", "Melhores origens" com visitas, Exportar CSV | Mesmos blocos, com ícone e pouco texto; "Perguntar ao Assistente" | Dados; brief | Igual |

## P12 Conexões

| Diferença | Referência v2 | App 0.1.51 | Causa | Decisão |
|---|---|---|---|---|
| WhatsApp | "Passo 3 de 3" com 3 passos e Mostrar código | Selo "chega numa próxima versão", 3 passos em cinza e **Conectar WhatsApp** desabilitado | Estado real: depende de pedido ao shell | Estado |
| Instagram | "Conectado" com @rafael.imoveis e Testar publicação · Desconectar | "indisponível nesta instalação", **Conectar Instagram** desabilitado, endereço para a equipe e Copiar endereço | #30 | Igual ao brief |
| Agenda | "Opcional · fase 6" | Igual, com **Conectar agenda** desabilitado | Spec | Igual |
| Direita | "Por que conectar aqui" + cartão Assistente | Mesmos dois blocos, texto próprio | — | Igual |
| Esquerda | 8 itens com chevron | 8 itens sem chevron nem ativo pintado | D-124 | Registrada |

## P13 Conta

| Diferença | Referência v2 | App 0.1.51 | Causa | Decisão |
|---|---|---|---|---|
| Seu perfil | Avatar RG, Trocar foto, Nome, CRECI, WhatsApp, Regiões | Nome, CRECI, WhatsApp, Regiões em branco/placeholder (a conta demo mostra "Como os clientes te conhecem") | Dados; foto foi para Sua marca | Registrada |
| Conta | Não existe | Bloco "Conta": nome da conta, tipo, CPF/CNPJ, CRECI jurídico, **Salvar perfil e conta** | Brief | **A confirmar** (bloco novo) |
| Sua marca | Logo, 4 amostras de cor, Tom de voz | Logo e foto com seletor de arquivo, Cor principal e Cor de apoio (campos), Estilo das artes, Assinatura curta, Tom de voz com descrição, Salvar marca | Não há seletor de amostras no catálogo | Registrada (D-124) |
| Referências | Não existe | Bloco "Referências" com Selecionar arquivos | Brief | **A confirmar** |
| Direita | "Plano" e "Créditos de outubro" com barra e preços | "Para que servem estes dados" + Assistente | Plano e créditos ficou em outra tela (fonte ainda sem SDK, pedido 27) | **A confirmar** |
| Campos | 38 px | 27 a 36 px (mediana por rótulo) | Medida não comparável (rótulo na caixa) | Sem conclusão |

## P14 Importar

| Diferença | Referência v2 | App 0.1.51 | Causa | Decisão |
|---|---|---|---|---|
| Estado | Arquivo carregado, mapeamento e prévia | Estado inicial: select "De onde vem a planilha?" e área de arrastar | Sem captura (lacuna 5) | **Sem captura** |
| Esquerda | 3 origens, cabeçalho "Importar contatos" | Link "Clientes", 3 origens, "Outro CRM, direto" em fase 2 | Navegação de volta | Igual |
| Direita | "Se o contato já existir" com 3 opções e "Depois de importar" | Mesmas 3 como cartões (Pular · Completar · Substituir) e "Depois de importar" | `urbi-radio` em cartões | Igual |

## P17 Negociador

| Diferença | Referência v2 | App 0.1.51 | Causa | Decisão |
|---|---|---|---|---|
| Botões de "Suas instruções" | Altura 38 px | "Salvar instruções" e "Começar do modelo" com **52 px** (texto em 2 linhas no botão estreito) | Largura da coluna | **Passa de ±4** (52 contra 38) |
| Cabeçalho | Ligado · Pausar | Igual | — | Igual |
| Seções | 1 a 6, numeradas e "7. Testar" na direita | 1 a 5 e "7 · Testar" na direita; 6 abaixo do corte | Spec | Igual |
| Quem negocia | 2 cartões Negociador IA / Uma pessoa | Select "Negociador IA (padrão)" + Convidar negociador | Primitivo, brief | Registrada |
| Estilo | 3 cartões curtos | 3 cartões altos com descrição e exemplo | Brief | Registrada |
| Regras fixas | Lista de 6 itens curtos | Lista longa, parágrafos de até 4 linhas | Texto da plataforma | **Conferir:** coluna longa |
| Suas instruções | Texto preenchido, "Modelo pronto carregado", 312 / 4.000 | Vazio ("Em branco, vale o modelo"), 0 / 4.000 | Dado | Estado |
| Este mês | 4 KPIs (38 · 4 · 4,1% · 81%) | 2 KPIs (1 · —), empilhados | Dado; D-124 | Registrada |
| Campos | 38 e 160 | textarea 144 e 48 | Medida interna | Dentro, salvo a de instruções |

## Decisões aplicadas

D-121 (colunas fixas ±4; o centro não entra), D-122, D-123, D-124, D-126, D-128 e D-119.

## Para decidir pelo dono

1. **P05:** coluna do Assistente em 380 (spec) contra 340 (referência).
2. **P10:** funil em colunas (app) ou em barras horizontais (referência).
3. **P13:** blocos "Conta" e "Referências" e o "Plano" da referência.
4. **P17:** botão de duas linhas de 52 px e a lista longa de regras fixas.

## Para consertar ou semear

1. Semear peças, conversa do Assistente e um arquivo para poder conferir P05 e P14.
2. Estender o script (clique, digitação, upload) para os estados fora das lacunas 1, 5 e 6.
