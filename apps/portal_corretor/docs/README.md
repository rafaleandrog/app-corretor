---
titulo: Portal do Corretor
descricao: O escritório digital do corretor de imóveis — o que já existe nesta versão.
---

# Portal do Corretor

App do corretor de imóveis. Cada corretor tem a **própria conta**: nenhum corretor vê nada de outro,
e a garantia é do banco de dados da plataforma, não só das telas.

## O que existe nesta versão (0.1.4; a 0.1.0 foi a primeira)

| Para quem | Tela | O que faz |
|---|---|---|
| Corretor | **Início** | O que fazer hoje (quentes sem resposta, abordagens atrasadas, visitas, próximos passos) e o que falta para começar — ver [Funil, temperatura e fila do dia](funil.md) |
| Corretor | **Desempenho** | Leads, conversão entre etapas, vendas, VGV, captações, comissão prevista, origem e motivos de perda — ver [Desempenho, envios e dados de demonstração](desempenho.md) |
| Corretor | **Funil** | Quadro dos negócios por etapa, com temperatura e abordagem atrasada; arrastar muda a etapa |
| Corretor | **Clientes** | Contatos, ficha com negócios, notas, consentimento e linha do tempo; importar e exportar planilha — ver [Clientes, negócios e agenda](clientes-e-agenda.md) |
| Corretor | **Agenda** | Atividades pendentes dos próximos 14 dias, com lembrete de visita por notificação |
| Corretor | **Imóveis › Minha carteira** | Imóveis com fotos, qualidade do anúncio, autorização de venda, descrição com IA e visitas — ver [Imóveis e empreendimentos](imoveis.md) |
| Corretor | **Imóveis › Empreendimentos** | Lançamentos com materiais e as unidades da carteira |
| Corretor | **Estúdio** | Peças para o Instagram com a sua marca: textos com IA, artes montadas pelo app ou feitas no Canva IA, aprovação e download — ver [Estúdio de conteúdo](estudio.md) |
| Corretor | **Minha página** | A página pública por blocos, com os imóveis anunciados e o formulário de contato — ver [Minha página, ficha pública e link rastreado](minha-pagina.md) |
| Visitante | **Página e ficha pública** (sem login) | A página do corretor e a ficha de cada imóvel anunciado; o contato vira cliente no funil |
| Corretor | **Clientes › ficha › Seleções e portal** | Monta seleções de imóveis e gera o link do portal do cliente — ver [Seleções e Portal do Cliente](selecoes-e-portal.md) |
| Cliente | **Seleção e Portal do Cliente** (link pessoal, sem login) | Reage aos imóveis (gostei, não gostei, quero visitar), vê as visitas, pede para remarcar e manda mensagem ao corretor |
| Corretor | **Assistente** (menu) | Tira dúvidas pelo manual, ajuda a decidir quem atender e cria lembretes ou agenda peças com a sua confirmação — ver [Assistente do Corretor](assistente.md) |
| Corretor | **Ajustes › Funil e abordagens** | As etapas de cada funil, a chance de fechar e a abordagem por etapa e temperatura |
| Corretor | **Ajustes › Conexões** | Conecta o Instagram para publicar e agendar pelo Estúdio — ver [Conexões (Instagram)](conexoes.md) |
| Corretor | **Ajustes › Conta e marca** | Seus dados, os dados da conta e as regras de atendimento — ver [Conta e ajustes](conta-e-ajustes.md) |
| Equipe da plataforma | **Equipe da plataforma › Corretores** | Convida corretores e acompanha os convites — ver [Convidar corretores](convidar-corretores.md) |

Integração disponível: Instagram (publicar e agendar pelo Estúdio). O WhatsApp e o Mensageiro (o assistente que conversa com os clientes) chegam numa versão seguinte: dependem de recursos que a plataforma ainda não oferece. A IA aparece no Assistente, nos imóveis (descrição e leitura de fotos), na Minha página e no Estúdio (textos),
quando liberada pelo administrador. Cada funcionalidade passa a constar aqui na versão em que chegar.

## Papéis

| Papel | Quem | Onde se atribui |
|---|---|---|
| `corretor` | O corretor, usuário externo dono da conta | Configurações › Usuários, seção Externos, depois que ele aceita o convite |
| `operacao` | A equipe da plataforma que convida corretores | Configurações › Usuários, seção Equipe |

Sem o papel, a tela mostra "Esta área não está liberada para você" e diz qual papel pedir.

**Administrador do app** (nível `admin`) vale por todos os papéis: vê e configura todas as telas, as do
corretor e as da equipe, sem precisar de papel atribuído (o papel `corretor` é externo e não pode ser
dado a quem é da equipe). Como as tabelas são segregadas por conta, para usar as telas do corretor o
admin precisa estar associado a uma conta (Admin › Contas); sem conta, a tela explica isso. Quem está em
mais de uma conta vê o seletor **Conta** no alto das telas e trabalha na conta escolhida (a escolha fica
lembrada no navegador); com uma conta só, o seletor não aparece. Com várias contas, listas, fichas e números mostram só a conta escolhida, e uma chamada sem a conta ativa é recusada com a orientação de escolhê-la.

### Endereço recebido (diagnóstico)

Ao abrir um endereço que o app não conhece, como `/portal_corretor/retorno?code=teste`, a tela
"Página não encontrada" mostra `/retorno?code=teste`. Serve para a equipe conferir o retorno das
conexões com a Meta, quando elas chegarem.

## Para o administrador da instância

- **IA:** o app declara três slots próprios: **Conteúdo** e **Assistente do Corretor** (base
  `normal`) e **Leitura de fotos** (base `arquivos`). Para ligá-los, em Admin › Instaláveis ›
  Apps › Portal do Corretor › IA, autorize as bases `normal` e `arquivos` (chave da plataforma) ou
  configure uma chave própria em cada slot. Sem isso o app funciona, sem os botões de IA, e o
  Assistente vira busca no manual. O microfone do Assistente aparece quando o slot de áudio da
  plataforma estiver liberado para o app.

- **Rotina:** "Temperatura dos contatos" (diária) esfria quem passou 7 dias sem contato. O horário
  e o liga-desliga ficam em Configurações da app › Rotinas (admin da app); sem ajuste, roda às 06:00 UTC.

- **Páginas públicas e webhooks:** a página do corretor, a ficha do imóvel, o formulário e o link
  rastreado — ver [Minha página, ficha pública e link rastreado](minha-pagina.md#para-o-administrador-da-instância);
  a seleção e o portal do cliente — ver [Seleções e Portal do Cliente](selecoes-e-portal.md#para-o-administrador-da-instância).

- **Instagram:** o app da Meta, os parâmetros `meta_app_id` e `meta_app_secret` e as contas de
  teste — ver [Conexões (Instagram)](conexoes.md#para-a-equipe-da-plataforma-antes-do-primeiro-corretor).
  A rotina "Conexões do Instagram" (diária) renova os acessos.

## Serviços externos

- **Instagram (Meta):** `graph.instagram.com` e `api.instagram.com`, para conectar e publicar.
  O app só chama a Meta quando o corretor conecta, publica ou agenda, e na renovação diária dos
  acessos.
