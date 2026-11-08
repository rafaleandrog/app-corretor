# Conferência visual do grupo 2 — P01 Hoje, M1, P03 Funil, P04 Cliente e P02 Conversas (app 0.1.48, 08/11/2026)

Conferência da seção 6 de `specs/layout/README.md` (contrato versão 2) do **grupo 2 da fase 1.7** (etapa 4, PR [#201](https://github.com/rafaleandrog/app-corretor/pull/201)): P01 Hoje + M1, P03 Funil, P04 Cliente, e a P02 com Seleção, Agendar visita e o botão Buscar. Capturas da **app real na homologação**, só da área da app, lado a lado com a referência aprovada pelo dono. Tolerância e regras pelas decisões D-121 (±4 px nas colunas fixas, alturas e medidas internas; o centro flexível não entra), D-122 (chip "Todas"), D-123 (botão só ícone 48 × 29 até o pedido 24), D-124 (usar o primitivo como ele é e registrar) e D-126 (Buscar como diferença aprovada).

| | |
|---|---|
| App na instância | 0.1.48, pré-release do branch `etapa4/grupo2` (build `b89e915`; o código da app é o mesmo do head revisado `5c7fa53`, que só mexeu no plano), instalado pela atualização automática da homologação |
| Shell | 0.56.37 |
| Conta | **Corretor A (demo)** (id 7), a mesma do grupo 1: cinco contatos, conversas semeadas pelos caminhos reais, uma negociação com o Negociador IA; sem agenda marcada e sem perfil de busca na Ana (estados vazios aparecem nas capturas) |
| Viewport | 1440 de largura no computador (altura 1420); 390 × 844 no celular |
| Área capturada | só a moldura de três colunas (`urbi-3-colunas`), sem a barra nem o cabeçalho do shell: 1392 × 1221 px |
| Fonte | a fonte do tema vem do Google Fonts, bloqueado na rede do ambiente; a captura usa a fonte do sistema (larguras de texto variam alguns pixels; caixas e tamanhos não) |
| Como entrou sem senha | `apps/portal_corretor/scripts/conferencia-visual/capturar.mjs` com `CONTA=7 CONVERSA=1` e o filtro `P01,M1,P03,P04,P02` |
| Como comparou | `comparar.py --md`: imagem lado a lado (esquerda a referência, direita a app) e medidas extraídas do DOM, atravessando shadow roots |

Arquivos desta pasta: `<tela>.png` (lado a lado), `<tela>.app.png` (a captura da app sozinha), `<tela>.app.json` (as medidas extraídas) e `medidas.md` (a tabela de medidas das cinco telas).

## Moldura (as cinco telas)

A moldura é a do grupo 1 (`specs/prints/conferencia-p02-0.1.46/README.md`): colunas 360 · 691 · 339 contra 360 · 589 · 340 da referência (centro flexível, D-121; contexto −1 pelo filete do primitivo), título 20 px/700 (`urbi-prosa papel="titulo"`, −2 px), botão padrão 34 px, campo 34 px (−2), chips 24 px (+1). O que mudou neste grupo:

| Medida | Referência v2 | App 0.1.48 | Diferença | Causa | Decisão |
|---|---|---|---|---|---|
| Botão Buscar | não existe na referência | `urbi-botao` só ícone (lupa) antes do Assistente, 48 × 29, com `ariaLabel` | botão a mais | D-126: busca global como botão em toda tela; a tecla `/` continua | **Diferença aprovada** (D-126), sem referência nova |
| Botão Assistente e Buscar | 34 × 34 | 48 × 29 | +14 × −5 | o `urbi-botao` sem texto não vira quadrado | Registrada (D-123), pedido ao shell 24 |
| Botões de 25 px nas medidas (`medidas.md`) | — | elemento do shell fora da área (y negativo) | — | o extrator lê o botão do cabeçalho do shell; não é botão da app | Ignorar na leitura da tabela |

## P01 Hoje

| Medida | Referência v2 | App 0.1.48 | Diferença | Causa | Decisão |
|---|---|---|---|---|---|
| Cabeçalho da esquerda | "Hoje" + Assistente | "Hoje" + Buscar + Assistente, abas Hoje · Agenda como chips abaixo | abas a mais | spec 11.1 P01 (abas Hoje · Agenda; na referência a agenda fica na direita e as abas não aparecem) | Igual à spec; na referência vale a spec (nota do guia) |
| Linha de contexto | "Quinta, 23 · Mensageiro atendeu 11 conversas desde ontem" | "Domingo, 8 de novembro · Mensageiro: ainda não disponível" | texto | sem WhatsApp (D-78) | Igual (estado honesto) |
| Precisa de você | 2 cartões coloridos (nome, motivo, **Assumir** 34 px) | 1 cartão (Ana Ribeiro · NG-0001, motivo em uma linha, **Assumir** 34 px) | fundo do cartão sem a cor de alerta | `urbi-card` sem variante de cor; só o chip leva cor | Registrada (D-124) |
| Primeiros passos | título "3 de 5", barra, lista com riscados e setas | "2 de 5", bolinhas, lista com chip Feito/botão Fazer | barra → bolinhas | sem barra de progresso no catálogo (spec 11.9: lacuna; "texto N de 5") | Registrada (11.9) |
| Fila do dia (centro) | cartões com chip de motivo + nome + descrição + botão principal 34 px + secundário; rodapé "Mais 6 para depois" | cartões com chip de motivo + temperatura + nome + descrição + data, **Fazer agora** (principal) + **Falar com <nome>** + "mais" | rodapé "Mais N" ausente | a conta demo tem 4 itens, abaixo do corte de 10 da fila | Igual (não há mais itens) |
| Cartão da fila | fundo branco, raio 12 | `urbi-card` raio 10 | raio −2 | tema | Dentro da tolerância |
| Agenda (direita) | lista hora · item | cartão "Agenda de hoje" com "Nada marcado para hoje" + Ver agenda | estado vazio | sem atividade marcada na conta demo | Igual (estado vazio da spec 11.0.4) |
| Sua semana | **2 × 2** (1ª resposta · Visitas / Quentes · Previsto) | **1 × 4** (Contatos novos · Leads · Visitas feitas · Comissão prevista) | grade e rótulos | `urbi-kpi` com piso `min="140px"`: a coluna de 340 não comporta dois por linha; os quatro números são os da spec 11.1 P01 ("contatos novos, leads, visitas feitas, comissão prevista"); a referência trazia os da versão anterior | Registrada (D-124); rótulos pela spec |
| Comissão prevista | "R$ 38 mil" | "R$ 104.825,00" | formato | o `urbi-kpi` mostra o valor inteiro; #180 (Números) trata o formato sem centavos no grupo 5 | Pendente no grupo 5 (#180) |
| Dica do Assistente | cartão lilás com texto e link "Ligar o Mensageiro" | `urbi-card` com texto e **Criar o lembrete** (ação validada) + **Perguntar ao Assistente** | fundo sem cor; botão em vez de link | `urbi-card` sem variante de cor; a ação da dica é botão de confirmação (D-76) | Registrada (D-124) |

## M1 Hoje (celular, 390 × 844)

| Medida | Referência v2 | App 0.1.48 | Diferença | Causa | Decisão |
|---|---|---|---|---|---|
| Topo | cabeçalho do shell com "Portal do Corretor" e avatar | cabeçalho do shell, seletor de conta, abas do shell Hoje · Fila · Agenda (os três painéis da moldura) e botão Criar | seletor e abas do shell a mais | o shell 0.56.37 no celular mostra o seletor de conta (quem atende várias) e um painel por vez, com as abas da `urbi-3-colunas` | Pelo shell (D-114); registrada |
| Atalhos do dia | barra fixa no rodapé: Conversas 3 · Criar · Imóveis · Assistente | linha de botões no topo da coluna: Conversas · Criar · Imóveis · Assistente | posição e selo | o contrato de UI proíbe CSS estrutural (barra fixa); o selo de Conversas depende de contagem que a P02 ainda não expõe aqui | Registrada (D-124); selo pendente |
| Precisa de você | cartões coloridos com seta | cartão com nome · NG-0001 e **Assumir** | cor do cartão | `urbi-card` sem variante | Registrada (D-124) |
| Fila do dia | 3 cartões brancos com chip e seta | lista compacta: avatar, nome, motivo e **Fazer agora** | botão em vez de seta | uma ação principal por item (spec 2.6) | Igual à spec |
| Primeiros passos | não aparece na referência | aparece abaixo da fila | seção a mais | a coluna esquerda da P01 é o painel inicial no celular | Igual à spec (M1 = esquerda da P01) |

## P03 Funil

| Medida | Referência v2 | App 0.1.48 | Diferença | Causa | Decisão |
|---|---|---|---|---|---|
| Cabeçalho da esquerda | "Clientes" + Novo + Assistente | "Clientes" + Importar + Novo + Buscar + Assistente, sem `pequeno` | Importar a mais | cabeçalho comum de Clientes (D-128) | Igual (D-128) |
| Alternador Funil · Lista · Negociações | segmentado (fundo cinza, pílula branca) | três chips | forma | sem segmentado no catálogo; chips do primitivo | Registrada (D-124) |
| Funis | lista com nome, descrição e contagem à direita | chips "Compra (6)" · "Venda e captação (0)" | lista → chips | o quadro tem dois funis; a contagem foi para o chip | Registrada (D-124); as descrições ficaram no texto de rodapé |
| Filtros prontos e temperatura | chips com contagem (Quentes 5 · Mornos 9 · Frios 10) e definição em uma linha | chips com "Todas" primeiro e contagem; definições em uma linha de rodapé | "Todas" a mais | D-122 | Igual (D-122) |
| Listas salvas | "Abriram e não responderam" | não existe | seção a menos | D-83: sem listas salvas (nota do guia: vale a spec) | Igual à spec |
| Taxas (centro) | 4 percentuais em linha, sem caixa | 6 `urbi-kpi` em `urbi-grid min="140px"` (4 + 2) | caixas e quantidade | o funil da conta demo tem 7 etapas (6 passagens); o `urbi-kpi` é o primitivo de número | Registrada (D-124) |
| Quadro | colunas de 180 px, altura do conteúdo | `urbi-kanban expandir` ocupando a coluna (#180) | altura | #180 | Igual |
| Direita | cliente selecionado (Juliana) com Próxima abordagem, Resumir, Criar tarefa, Abrir conversa, Enviado | estado vazio "Clique num cartão…" | estado | a captura não seleciona cartão; com cartão, os comandos são os da spec (lente de revisão confere) | Igual (estado vazio) |

## P04 Cliente

| Medida | Referência v2 | App 0.1.48 | Diferença | Causa | Decisão |
|---|---|---|---|---|---|
| Cabeçalho da esquerda | "Clientes" + Importar + Novo + Assistente | igual, com Buscar, sem `pequeno` | Buscar | D-126, D-128 | Igual |
| Busca | campo 46 px | `urbi-input` 34 px | −12 | primitivo | Registrada (D-124) |
| Chips | uma linha (Todos 58 · Compradores · Proprietários) | duas linhas (Todas · Compradores · Proprietários; Todas · Novos · Sem contato · Quentes · Retorno vencido) + botão **Filtros** | linha a mais | os filtros prontos valem para Lista e Funil; "Todas" pela D-122 | Registrada; "Filtros (N)" pela #172 |
| Lista | avatar, nome, subtítulo em uma linha, temperatura | avatar, nome, chips de etapa e origem, telefone formatado | chips em vez de subtítulo | etapa na lista (`etapa_nome`) e origem (#186); telefone (#182) | Registrada |
| Cabeçalho da ficha | nome, telefone mascarado, e-mail, papel; chips; Conversa + Resumir | igual, com ícones de WhatsApp e telefone e "Mais"; telefone sem máscara | máscara | a referência mascara por ser imagem pública; a tela do corretor mostra o dado | Igual |
| Abas | Resumo · Linha do tempo · Enviados 6 · Negócios 1 (Linha do tempo aberta) | Resumo · Linha do tempo · Enviados 2 · Negócios 1 (Linha do tempo aberta, D-117) | — | — | Igual |
| Linha do tempo | ícone por item, texto, hora | texto, data · autor, com Registrar contato · Registrar envio no alto | sem ícone | `urbi-lista` sem ícone por item | Registrada (D-124) |
| Perfil de busca (direita) | chips + Editar perfil | estado vazio + **Editar perfil** | estado | a Ana da conta demo não tem perfil | Igual (estado vazio) |
| Portal do cliente | texto + Liberar item + Reenviar link | chip "link ativo", texto com último acesso, Liberar item · Reenviar link, Revogar | — | — | Igual |
| Privacidade | texto + Exportar dados + Remover cliente (links) | texto + **Exportar dados** (botão) + **Remover cliente** (link) | botão | ação com efeito vira botão | Igual |

## P02 Conversas (o que mudou no grupo 2)

| Medida | Referência v2 | App 0.1.48 | Diferença | Causa | Decisão |
|---|---|---|---|---|---|
| Cabeçalho | "Conversas" + Nova + Assistente | + Buscar | D-126 | — | Igual |
| Barra de comandos | Imóvel · Seleção · Arquivo · Localização · Agendar visita · Portal do cliente | + **Proposta** (grupo 3) ; Seleção e Agendar visita abrem gavetas (`urbi-modal`) com efeito completo (D-127) | botão a mais | o grupo 3 completa a Proposta | Igual |
| Resto da tela | — | como no grupo 1 (`conferencia-p02-0.1.46`) | — | — | — |

## Resumo

Nenhuma diferença estrutural contra o contrato v2 nas cinco telas: colunas fixas, alturas e cabeçalhos dentro da tolerância da D-121. As diferenças são (a) de primitivo, registradas pela D-124 (cartões sem cor de variante, chips no lugar do segmentado e da lista de funis, `urbi-kpi` 1 × 4 em Sua semana e as taxas em caixas, campo de busca 34 px, botão só ícone 48 × 29, linha do tempo sem ícone, atalhos do M1 no topo), (b) de spec sobre a referência (abas Hoje · Agenda, sem listas salvas, rótulos de Sua semana), (c) de estado da conta demo (agenda vazia, perfil de busca vazio, cartão do Funil não selecionado) e (d) aprovadas pelo dono (Buscar, D-126; "Todas", D-122). Ficam para os grupos seguintes: formato da comissão sem centavos (#180, grupo 5), selo de contagem em Conversas no M1 (com a contagem de não lidas exposta à P01), e a cor do cartão de alerta quando o shell oferecer variante no `urbi-card` (pedido ao shell 24).
