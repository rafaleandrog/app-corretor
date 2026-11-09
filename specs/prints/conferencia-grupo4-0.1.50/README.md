# Conferência visual do grupo 4: P08 Estúdio, P09 Página, M4 Portal, M5 Portal imóveis e M6 Página pública (app 0.1.50, 09/11/2026)

Esta é a conferência da seção 6 de `specs/layout/README.md` (contrato versão 2) para o **grupo 4 da fase 1.7** (etapa 4, branch `etapa4/grupo4`). Cada tela foi capturada na **app real em homologação** e posta ao lado da referência aprovada. Tolerâncias e regras pelas decisões:

- **D-121:** ±4 px nas colunas fixas, nas alturas e nas medidas internas. O centro é flexível.
- **D-122:** chip "Todas" primeiro.
- **D-123:** botão só com ícone fica em 48 × 29 até o pedido 24.
- **D-124:** usar o primitivo como ele é e registrar a diferença.
- **D-128:** cabeçalho comum e sem `pequeno` em Página.
- **D-119:** a referência é o alvo; diferença só por limite real da plataforma.

| | |
|---|---|
| App na instância | 0.1.50 (branch `etapa4/grupo4`), instalada na homologação "pinguim" |
| Conta | **Corretor A (demo)** (id 7), semeada com imóveis, fotos, página publicada em `corretor-a-demo`, seleção e portal da Ana. **Sem peças no Estúdio** e sem Instagram conectado |
| Viewport | Computador 1440 (altura 1420); celular 390 × 844 |
| Área capturada | Computador: só a moldura de três colunas, 1392 × 1221. Celular: a página inteira do portal ou da página pública |
| Fonte | Fonte do sistema (Google Fonts bloqueado no ambiente): a largura dos textos varia alguns pixels |
| Como capturou | `CONTA=7 CONVERSA=1 capturar.mjs pinguim <pasta> P08-Estudio,P09-Pagina,M4-Portal,M5-Portal-imoveis,M6-Pagina-publica`; comparação com `comparar.py --md` (saída em `medidas.md`) |

Arquivos: `<tela>.png` (referência à esquerda, app à direita), `<tela>.app.png`, `<tela>.app.json`, `medidas.md`.

## Telas capturadas e lacunas de captura

As cinco telas foram capturadas; nenhuma foi pulada. Lacunas:

1. **P08 sem peças.** A semente da conta 7 não cria peças do Estúdio, então a tela está no estado vazio e **não foi possível conferir**: a peça aberta, a prévia da arte, "Copiar descrição", a ação principal por estado, o Baixar, a lista "Seus pedidos" e o "Esta semana" com itens. Fica para depois de semear peças (escrita, fora do escopo desta conferência).
2. **Seleção pública** não é tela do script. O que se vê da seleção é o bloco dentro da aba Imóveis do portal (M5).
3. **M4 e M5 só mostram os primeiros 844 px.** A rolagem é interna à página do portal e a captura de página inteira não a alcança. Ficam sem captura: o fim da conversa (cartão de imóvel, compositor em uso), "Outros imóveis" e o resto da M5, as abas Agenda e Propostas.
4. **P09:** ajustes de outros blocos, o botão Computador da prévia e o menu "Mais" não foram abertos (o script não clica).

## Moldura (P08 e P09)

Colunas 360 · 691 · 339 contra 360 · 589 · 340: o centro é flexível (D-121); o −1 é o filete do primitivo. H1 com 20 px e peso 700 (referência 22 px). Botões de 25 px são do cabeçalho do shell (ignorar); 29 px é o só ícone (D-123); 34 px o padrão. Os botões de 64 a 79 px da referência da P08 são os cartões do Criar rápido. Cabeçalho da esquerda com **Buscar + Assistente** (D-126, aprovado) contra só Assistente.

## P08 Estúdio

| Diferença | Referência v2 | App 0.1.50 | Causa | Decisão |
|---|---|---|---|---|
| Subtítulo da conta | "@rafael.imoveis conectado" | "Instagram não conectado" | Estado real da homologação (#30) | Estado |
| Faixa de aviso no topo do centro | Não tem | Faixa amarela "Instagram não conectado…" com **Reconectar** | Visível e explicada (brief, #30) | Igual ao brief |
| Criar rápido | 4 cartões brancos de ~48 px de altura | 4 cartões cinza 2 × 2 de ~80 px, com ícone no título | `urbi-card clicavel` tem preenchimento e fundo próprios | Registrada (D-124) |
| Listas por etapa | Lista de pedidos com título · peças · estado | Chips "Todas · 0, Falta a arte · 0, …" em duas linhas e "Nenhum pedido ainda" | D-122; sem dados | Igual (D-122); itens sem captura (lacuna 1) |
| Centro | Conversa Você/Estúdio com prévias, legenda e Agendar · Publicar agora · Baixar | Estado vazio "Nenhum pedido ainda" e o compositor | Sem peça na conta | **Sem captura** (lacuna 1) |
| Compositor | Linha única com anexar, microfone e enviar | `urbi-redator` com área de ~75 px e "Enviar" | Primitivo | Registrada (D-124) |
| Esta semana | Lista com data · peça e estado, e "Publicar no horário se eu não mexer" | Cartão com Agendadas · 0 e Publicadas · 0; sem a opção de publicar no horário | Opções saíram da tela (#62, brief) | Registrada |
| Biblioteca | Lista de arquivos com Baixar | "Sem logo, foto ou referências ainda" + "Sua marca" | Sem peças na conta | Estado |
| Instagram | No cabeçalho | Cartão com "Conectar o Instagram" desabilitado e o porquê | #30 | Igual ao brief |
| Créditos do mês | "Artes 9 de 40 · Vídeos 0 de 8" com barra | `urbi-kpi` com "—" e a explicação; sem barra | Sem fonte no SDK (pedido ao shell 27); sem barra no catálogo | Registrada (D-124, D-119) |

## P09 Página

| Diferença | Referência v2 | App 0.1.50 | Causa | Decisão |
|---|---|---|---|---|
| Título | "Minha Página" | "Página" | Nome do menu | Igual ao menu |
| Cabeçalho | **Publicar** (primário) + Assistente | Buscar + Assistente; selo "Publicada desde 09/11/2026, 01:08" e link "Nome e endereço" | Página já publicada; o Publicar só aparece fora desse estado | Igual (D-128: sem `pequeno`) |
| Endereço | "[seu-endereço]/p/rafael" em 2 linhas | URL completa com reticências, 1 linha | `urbi-prosa truncar` (#180) | Igual |
| Blocos | 8 blocos com alça de arrastar e "Mostrar" à direita | 7 blocos em `urbi-arvore` com caixa à esquerda e ícone do tipo, sem alça visível; Subir e Descer abaixo | `urbi-arvore arrastavel` (D-119, D-124); Capa fora da lista; Empreendimentos e Depoimentos não são blocos na app | Forma registrada (D-124); lista de blocos **a decidir** |
| Faixa do centro | Barra "Pré-visualização" com o alternador | Rótulo pequeno "PRÉ-VISUALIZAÇÃO" e `urbi-botao-alternar` | Primitivo | Registrada (D-124) |
| Prévia | Celular 300 px com borda e cantos | Celular de ~300 px, rolável além da moldura | Exceção `pc-previa-pagina` | Igual |
| Cor da marca | Verde-escuro | Azul | Cor de marca da conta demo (D-85) | Dado |
| Direita | "Bloco: imóveis em destaque" com "Quais mostrar" (select) | "Bloco: Apresentação" com título, texto e "Salvar bloco", na coluna | D-119 (ajustes no lugar, sem diálogo); o bloco selecionado é outro | Igual ao brief |
| Marca | 4 amostras de cor + "Trocar foto e logo" | Texto, avatar e link "Editar em Ajustes › Conta e marca" | Não há seletor de cor; a marca é da conta (P13) | Registrada |
| Últimos 30 dias | 2 KPIs lado a lado | 2 `urbi-kpi` empilhados: Contatos pelo formulário · 1 e Visitas "—"; cabem em 340 px (#180) | Piso de 140 px do `urbi-kpi`; sem fonte de visitas | Registrada (D-124) |
| Ações | "Copiar link da página" largo | **Copiar link** · Mais, e "Perguntar ao Assistente" | Mais com "Atualizar agora" (brief) | Igual ao brief |

## M4 Portal do Cliente (390 × 844)

| Diferença | Referência v2 | App 0.1.50 | Causa | Decisão |
|---|---|---|---|---|
| Topo | "Meu atendimento ▾" + avatar do cliente (AR) | "Meu atendimento" + "com Rafael Gualberto · CRECI DF-12345-F" + avatar do corretor (RG), 61 px | Brief (avatar e nome do corretor) | Igual ao brief |
| Cor | Verde-azulado | Azul | Cor de marca da conta (D-85) | Dado |
| Faixa "Próximo passo · Ver" | "Visita sábado às 10 h" | "Visita sábado às **13 h**" | **Suspeita de fuso:** a conversa da semente diz "Sábado 10 h"; 13 h é 10 h de Brasília lida em UTC | **Conserto de código (verificar)** |
| Abas | Conversa · Imóveis 3 · Agenda 1 · **Arquivos 2** | Conversa · Imóveis 3 · Agenda 1 · **Propostas 1**, cabem em 390 px | Brief (#191: Propostas) | **Decisão do dono** |
| Balões | Compactos, do tamanho do texto | Balões de 279 px com 161 a 197 px de altura para 2 a 3 linhas, ~40 px de folga acima do texto e hora a 40 px abaixo | CSS do portal (`frontend/publico/estilo.ts`) | **Conserto de código** |
| Compositor | Uma linha fixa no pé, "Escreva para o Rafael" | Igual | — | Igual |
| Cartão de imóvel no chat | Capa, título, dados, preço, Gostei · Quero visitar | Existe, fora do primeiro quadro | Conversa mais longa que a da referência | Sem captura (lacuna 3) |

## M5 Portal, aba Imóveis (390 × 844)

| Diferença | Referência v2 | App 0.1.50 | Causa | Decisão |
|---|---|---|---|---|
| Cabeçalho do bloco | Só "Rafael escolheu para você · deslize as fotos" | "Sua seleção", "Casas e apartamentos para você" e a legenda repetindo o nome da seleção | Título da página + título da seleção + legenda | **Conserto de código:** três títulos e nome repetido |
| Foto | ~170 px com "1 de 12" | ~170 px, sem contador nem rótulo | Foto de exemplo; sem contador | Registrada |
| Título e situação | Título e "Visita sáb." na mesma linha | Título, chip abaixo, dados com "12 fotos" e "Ver descrição" | Brief (item 14) | Registrada |
| Reações | 3 botões numa linha | 5 botões em 2 linhas (Gostei · Não gostei · Quero visitar · Conversar sobre o preço · Comentar) | Brief (item 14) | Igual ao brief |
| Outros imóveis e "O que falta de você" | Cartões compactos e lista de verificação | Abaixo da dobra | Sem captura | Lacuna 3; "O que falta de você" **a confirmar** |

## M6 Página pública (390 × 844)

| Diferença | Referência v2 | App 0.1.50 | Causa | Decisão |
|---|---|---|---|---|
| Capa | 213 px com avatar, nome, "Casas e lotes em Brasília · CRECI" e **Falar no WhatsApp** | 165 px com avatar, nome e "Corretor de imóveis · CRECI DF-12345-F"; **sem o botão** | O botão só aparece com WhatsApp da página (`pagina-publica.ts:281`); a conta demo parece não ter | **Conferir a semente** |
| Apresentação | Não aparece | "Encontre o imóvel certo comigo", sem texto | Primeiro bloco abaixo da capa (brief); texto vazio | Igual ao brief |
| Imóveis em destaque | Seção com 2 cartões | Não há; só "Imóveis à venda" com 3 cartões | Bloco de destaques sem códigos ou oculto na página demo | **Conferir a semente** |
| Cartão | Foto ~130 px, preço à esquerda e botão à direita | Foto ~130 px, preço à esquerda e "Quero saber mais" (34 px) à direita; 2 cartões cabem sem rolar | #181 | Igual |
| Cor | Verde-escuro | Azul | Cor de marca da conta | Dado |
| Rótulo sobre a foto | "Casa 4 quartos" | Não há | Foto de exemplo | Registrada |

## Decisões aplicadas

- D-121: colunas fixas dentro de ±4 px; o centro não entra.
- D-122: "Todas" primeiro nas etapas do Estúdio.
- D-123: botões só com ícone em 48 × 29.
- D-124: Criar rápido, compositor, alternador, `urbi-arvore`, `urbi-kpi` empilhados e créditos sem barra.
- D-128: cabeçalho comum e sem `pequeno` na Página.

## Para consertar no código

1. **M4:** "Próximo passo" mostra 13 h onde a conversa diz 10 h (suspeita de fuso; verificar `backend/portal.ts`).
2. **M4:** balões altos demais (`frontend/publico/estilo.ts`).
3. **M5:** três títulos seguidos e nome da seleção repetido.
4. **Semente (#189):** conta 7 sem WhatsApp na página, sem destaques e sem peças no Estúdio.

## Para decidir pelo dono

1. **M4:** abas com Propostas (brief, #191) ou Arquivos (referência).
2. **P09:** blocos da referência (Capa, Empreendimentos, Depoimentos) contra os da spec.
3. **M5:** "O que falta de você" (lista de verificação da referência): entra ou não.
