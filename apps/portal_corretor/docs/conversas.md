---
titulo: Conversas
---

# Conversas

**Conversas** (menu › **Conversas**, endereço `/conversas`) é a caixa de conversas do corretor: tudo o que cada
cliente escreveu e tudo o que o corretor mandou a ele, numa conversa por cliente. Nesta versão o WhatsApp
ainda não está ligado ao app (ele chega com a conexão em Ajustes › Conexões), então a conversa é alimentada
por:

- **o que o cliente escreve pelo Portal do Cliente** (a aba Conversa do portal e a mensagem ao corretor de
  uma negociação) e as **reações** dele a uma seleção ("Quero visitar", "Conversar sobre o preço"), que
  chegam como avisos na conversa;
- **o que você manda**: o texto do compositor e o "Fazer agora" da ficha, que abrem o **WhatsApp do seu
  celular** com a mensagem pronta e ficam registrados aqui; os **envios** (imóvel, arquivo, localização,
  link do portal), com o cartão do que foi enviado.

Uma faixa no topo da conversa lembra que o WhatsApp não está conectado, com o atalho para Ajustes › Conexões.
Até lá, "Reativar Mensageiro", a janela de 24 horas e os modelos de mensagem ficam desligados.

## A tela

| Coluna | O que tem |
|---|---|
| Esquerda | Título, **Nova** (abre a conversa de um cliente) e o Assistente; busca por nome, telefone ou imóvel; filtros **Minha vez · Mensageiro · Negociador · Aguardando · Não lidas · Arquivadas** (com a contagem); a lista com nome, há quanto tempo, a última mensagem e os chips de status ("Sua vez", "Imóvel enviado", "Negociador atendendo") e de origem ("Anúncio Instagram", "Minha Página", "Portal") |
| Centro | A faixa do WhatsApp; o cabeçalho com nome, temperatura, próximo passo e origem, quem atende (**você**, ou o **Negociador IA** quando ele conduz uma negociação do cliente) com **Assumir** ou **Devolver ao Negociador** e **Arquivar**; as mensagens (as do cliente à esquerda, as suas e as do Negociador à direita, os avisos ao centro); as ações rápidas **Imóvel · Seleção · Arquivo · Localização · Agendar visita · Portal do cliente · Proposta**; a **sugestão** da IA (um clique a põe no compositor); o compositor com microfone |
| Direita | **Próxima abordagem** com "Usar mensagem pronta"; **Enviado para o cliente** com o que ele clicou ou abriu; **Também combinam** (imóveis ativos que batem com o perfil de busca, com **Enviar**); os chips do perfil de busca e **Abrir ficha completa** |

A conversa aberta fica no endereço (`?item=`); os filtros ficam em `?filtro=` e `?q=`. Abrir uma conversa
marca as mensagens dela como lidas. A busca acha pelo nome, pelo telefone, pela última mensagem e pelo
imóvel enviado ao cliente (código ou título). A caixa carrega as 200 conversas mais recentes; acima disso
uma faixa avisa e a busca e os filtros encontram as outras.

## O que cada ação faz

| Ação | O que acontece |
|---|---|
| Escrever e enviar | A mensagem é gravada como enviada e o WhatsApp do seu celular abre com ela (cliente sem WhatsApp cadastrado: fica só registrada). Conta como abordagem feita na linha do tempo do cliente |
| Imóvel | Escolhe um imóvel da carteira; registra o envio (com o link rastreado quando o imóvel está na sua página), abre o WhatsApp com a mensagem pronta e põe o cartão na conversa |
| Seleção | Leva à ficha do cliente, aba Negócios, onde a seleção é montada e enviada |
| Arquivo | Registra na conversa um arquivo que você mandou pelo seu WhatsApp (o arquivo em si não fica no app) |
| Localização | Escolhe o imóvel; registra o envio e abre o WhatsApp com a localização |
| Agendar visita | O mesmo formulário de **Criar › Nova visita**, com o cliente já escolhido |
| Portal do cliente | Gera (ou reenvia) o link do Portal do Cliente e abre o WhatsApp com ele; o link entra na conversa |
| Proposta | **Criar › Nova proposta** com o cliente já escolhido; abre a negociação em Clientes › Negociações |
| Assumir / Devolver ao Negociador | Trocam quem atende. Com uma negociação aberta conduzida pelo Negociador IA, a tela muda a negociação primeiro (as regras são as de [Negociação e mandato](negociacao.md)) e a conversa depois |
| Arquivar / Desarquivar | Tira a conversa da caixa (filtro **Arquivadas**); se o cliente voltar a falar, ela reabre sozinha |
| Nova | Escolhe um cliente e abre a conversa dele (a que já existe, se houver) |

## Para quem desenvolve

Tabelas `conversas` (uma por contato; `canal` `portal`, `registro` ou `wa_me`; `atendido_por`, `agente`,
`estado`, `nao_lidas`, `arquivada_em`, resumo da última mensagem) e `mensagens` (`direcao`, `autor_tipo`,
`canal`, `tipo` `texto`/`imovel`/`selecao`/`arquivo`/`localizacao`/`link_portal`/`sistema`, `conteudo`,
`dados` com o cartão). Rotas: `GET /conversas?filtro=&q=` (`limite` e `limite_atingido` na resposta), `POST /conversas` (`contato_id`),
`GET /conversas/:id` (só leitura), `PATCH /conversas/:id/lida` (marca como lida e alinha quem atende), `POST /conversas/:id/mensagens` (`texto`; devolve o link `wa.me`),
`POST /conversas/:id/assumir`, `POST /conversas/:id/devolver`, `PATCH /conversas/:id` (`arquivada`).
Eventos: `mensagem_recebida` (listener do portal), `mensagem_enviada` (compositor, "Fazer agora", envios,
link do portal), `envio_criado`, `conversa_assumida`, `conversa_devolvida`; só ids, nunca o texto nem o canal.
