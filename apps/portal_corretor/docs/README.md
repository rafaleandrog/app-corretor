---
titulo: Portal do Corretor
descricao: O escritório digital do corretor de imóveis — o que já existe nesta versão.
---

# Portal do Corretor

App do corretor de imóveis. Cada corretor tem a **própria conta**: nenhum corretor vê nada de outro,
e a garantia é do banco de dados da plataforma, não só das telas.

## O que existe nesta versão (0.1.45; a 0.1.0 foi a primeira)

| Para quem | Tela | O que faz |
|---|---|---|
| Corretor | **Hoje** (antes, Início) | No desenho novo, em três colunas: **Precisa de você** e **Primeiros passos** (x de 5, sem o CRECI); a **fila do dia** em cartões, um botão por item; e, à direita, a agenda de hoje (com **Ver agenda**, os próximos 14 dias), **Sua semana** e a **Dica do Assistente** — ver [Funil, temperatura e fila do dia](funil.md) e [Clientes, negócios e agenda](clientes-e-agenda.md) |
| Corretor | **Números** (antes, Desempenho) | No desenho novo: à esquerda, os relatórios (Resumo, Funil e conversão, Origem dos contatos, Tempo de resposta, Conteúdo e Negociação; Mensageiro "em breve"); no centro, o relatório com período, **Comparar** e origem; à direita, **O que melhorar** (com **Ver os N clientes**), as melhores origens e **Exportar CSV** — ver [Números, envios e dados de demonstração](desempenho.md) |
| Corretor | **Clientes** | No desenho novo, em três colunas: a lista (visões **Lista** e **Funil**, busca, filtros prontos Novos · Sem contato · Quentes · Retorno vencido e o papel), a **ficha** do cliente escolhido (cabeçalho com Conversa e Resumir; abas Resumo · Linha do tempo · Enviados · Negócios) e, à direita, perfil de busca, portal do cliente e privacidade; importar e exportar planilha — ver [Clientes, negócios e agenda](clientes-e-agenda.md) e [Funil, temperatura e fila do dia](funil.md) |
| Corretor | **Imóveis** | No desenho novo: à esquerda, as abas **Carteira** (lista com miniatura, busca e chips Ativos · Rascunhos · Vendidos) e **Empreendimentos**; no centro, a ficha (galeria, dados, quem vê, fotos, descrição com IA, autorização e visitas); à direita, a qualidade com o que falta, os números de 30 dias e os clientes que combinam. **Novo imóvel** em 4 passos (Fotos · Dados · Autorização · Onde aparece), com rascunho salvo em cada passo, a IA lendo as fotos e nenhum passo pedindo CRECI — ver [Imóveis e empreendimentos](imoveis.md#novo-imóvel-em-4-passos) |
| Corretor | **Estúdio** | Peças para o Instagram com a sua marca: textos com IA e descrição pronta para gerar a arte no Canva IA (ou em outra ferramenta), envio da arte na peça, aprovação e publicação — ver [Estúdio de conteúdo](estudio.md) |
| Corretor | **Página** (antes, Minha página) | No desenho novo: à esquerda, o endereço, **Publicar** e os blocos (Mostrar, subir e descer); no centro, a **prévia** da página no Celular ou no Computador, com o bloco escolhido destacado; à direita, os ajustes do bloco, a marca, os contatos que vieram da página e **Copiar link** — ver [Página, ficha pública e link rastreado](minha-pagina.md) |
| Visitante | **Página e ficha pública** (sem login) | A página do corretor (capa com foto, nome, CRECI se houver e WhatsApp; imóveis em destaque com **Quero saber mais**) e a ficha de cada imóvel anunciado; o contato vira cliente no funil |
| Corretor | **Clientes › ficha › Seleções e Portal do cliente** | Monta seleções de imóveis (aba Negócios), gera, reenvia e revoga o link do portal do cliente e pede pendências a ele (**Pedir ao cliente**), na coluna da direita; o próximo passo que ele vê no portal fica no cartão Próximo passo — ver [Seleções e Portal do Cliente](selecoes-e-portal.md) |
| Cliente | **Seleção e Portal do Cliente** (link pessoal, sem login) | O portal "Meu atendimento" com o próximo passo e as abas Conversa, Imóveis, Agenda, Propostas (quando há negociação: vê as rodadas, aceita a condição do vendedor, que não fecha o acordo, ou faz nova oferta) e Arquivos: reage aos imóveis (gostei, não gostei, quero visitar, comentar), vê as visitas, pede para remarcar, manda mensagem ao corretor e marca como feitas as pendências que o corretor pediu (botão **Feito**); link revogado mostra "Link expirado" |
| Corretor | **Assistente** (botão, abre à direita da tela) | Tira dúvidas pelo manual, ajuda a decidir quem atender e cria lembretes ou agenda peças com a sua confirmação — ver [Assistente do Corretor](assistente.md) |
| Corretor | **Ajustes** | No desenho novo, em três colunas: as seções à esquerda (Mensageiro, Negociador, Conexões, Conta e marca, Funil e abordagens, Horário de atendimento, Privacidade), o conteúdo no centro e a ajuda à direita — ver [Conta e ajustes](conta-e-ajustes.md) e [Conexões (Instagram)](conexoes.md) |
| Corretor | **Clientes › Negociações** | A negociação de cada negócio: a faixa com a ZOPA, a escada de propostas, a sugestão do Negociador IA (Enviar, Fazer agora, Editar, Descartar), o mandato do vendedor (recuo e BATNA mascarados) e o aceite, que é sempre seu; o jeito do Negociador fica em Ajustes › Negociador — ver [Negociação e mandato](negociacao.md) |
| Negociador humano | **Hoje** e **Negociações** | Só as negociações que o corretor atribuiu a ele: pede sugestão, envia, edita e registra propostas dentro do mandato, sem ver o recuo, o alvo nem a BATNA do vendedor e sem aceitar o acordo final. O corretor convida a pessoa em Ajustes › Negociador (só o e-mail, sem CRECI) e atribui na negociação — ver [Negociador humano](negociacao.md#negociador-humano) |
| Corretor | **Buscar** e atalhos de teclado | Busca clientes, imóveis e negociações da sua conta (a tecla `/` em qualquer tela da área do corretor); `C` Criar, `A` Assistente, `J`/`K` próximo e anterior na lista, `E` editar — ver [Atalhos e busca](#atalhos-e-busca) |
| Corretor | **Criar** (no alto de toda tela) | Novo cliente, Novo imóvel, Novo post, Nova visita e Nova proposta — ver [Como as telas se organizam](#como-as-telas-se-organizam) |
| Corretor | Endereços antigos | `/agenda`, `/funil`, `/empreendimentos`, `/minha-pagina`, `/desempenho` e `/assistente` abrem Hoje › Agenda, Clientes › Funil, Imóveis › Empreendimentos, Página, Números e Hoje com o Assistente aberto; `/conta` e `/ajustes/marca` abrem Ajustes › Conta e marca |
| Equipe da plataforma | **Equipe da plataforma › Corretores** (no menu do app, no alto da página) | Convida corretores e acompanha os convites — ver [Convidar corretores](convidar-corretores.md) |

Integração disponível: Instagram (publicar e agendar pelo Estúdio). O WhatsApp e o Mensageiro (o assistente que conversa com os clientes) chegam numa versão seguinte: dependem de recursos que a plataforma ainda não oferece. A IA aparece no Assistente, na ficha do cliente (Resumir e Mensagem sugerida), nos imóveis (descrição e leitura de fotos), na Página e no Estúdio (textos),
quando liberada pelo administrador. Cada funcionalidade passa a constar aqui na versão em que chegar.

## Como as telas se organizam

O menu das telas é o do shell (**Portal do Corretor ▾**): **Hoje · Conversas · Clientes · Imóveis · Estúdio · Página · Números · Ajustes**. Todas
as telas do corretor estão num desenho só, em colunas (o "Padrão B"): Hoje, Clientes (Lista, Funil,
Negociações e Importar), Imóveis (e Novo imóvel), Estúdio, Página, Números e Ajustes. A tela
**Corretores**, da equipe da plataforma, fica fora desse desenho.

Em telas largas, as colunas usam a largura inteira da área do app. Nas telas de três colunas, as
laterais têm largura fixa (a lista com 360 px e a coluna da direita com 340 px, ou 380 px com o
Assistente aberto) e a coluna do meio fica com todo o resto, então cresce em monitores grandes. Quando a
coluna da direita não tem nada a mostrar ainda (nenhum item escolhido), ela diz "Escolha um item". Em telas estreitas (até 900 px de largura, como celular e tablets menores em pé),
as colunas viram abas, como antes.

### Mapa das telas

| Tela | Como chegar | Endereço | Onde está explicada |
|---|---|---|---|
| Hoje | Menu › **Hoje** | `/` (aba Agenda: `/agenda`) | [Funil, temperatura e fila do dia](funil.md) |
| Conversas | Menu › **Conversas** | `/conversas?item=<número>` | [Conversas](conversas.md) |
| Clientes › Lista e ficha | Menu › **Clientes** › escolha um cliente | `/clientes?item=<número>` | [Clientes, negócios e agenda](clientes-e-agenda.md) |
| Clientes › Funil | Menu › **Clientes** › botão **Funil** | `/clientes?visao=funil` (ou `/funil`) | [Funil, temperatura e fila do dia](funil.md) |
| Clientes › Negociações | Menu › **Clientes** › botão **Negociações** | `/clientes?visao=negociacoes&item=<número>` (ou `/negociacoes`) | [Negociação e mandato](negociacao.md) |
| Mandato do vendedor | Clientes › Negociações › negociação › **Editar mandato** | (janela sobre a negociação) | [Negociação e mandato](negociacao.md#o-formulário-do-mandato) |
| Importar contatos | Menu › **Clientes** › **Importar** | `/clientes/importar` | [Clientes, negócios e agenda](clientes-e-agenda.md) |
| Imóveis (Carteira e Empreendimentos) | Menu › **Imóveis** | `/imoveis` (ou `/empreendimentos`) | [Imóveis e empreendimentos](imoveis.md) |
| Novo imóvel | **Criar** › Novo imóvel, ou Imóveis › **Novo** | `/imoveis/novo` | [Imóveis e empreendimentos](imoveis.md#novo-imóvel-em-4-passos) |
| Estúdio | Menu › **Estúdio** | `/estudio` | [Estúdio de conteúdo](estudio.md) |
| Página | Menu › **Página** | `/pagina` (ou `/minha-pagina`) | [Página, ficha pública e link rastreado](minha-pagina.md) |
| Números | Menu › **Números** | `/numeros?relatorio=<relatório>` (ou `/desempenho`) | [Números, envios e dados de demonstração](desempenho.md) |
| Ajustes › Conta e marca | Menu › **Ajustes** › Conta e marca | `/ajustes/conta` | [Conta e ajustes](conta-e-ajustes.md) |
| Ajustes › Conexões | Menu › **Ajustes** › Conexões | `/ajustes/conexoes` | [Conexões (Instagram)](conexoes.md) |
| Ajustes › Negociador | Menu › **Ajustes** › Negociador | `/ajustes/negociador` | [Negociação e mandato](negociacao.md#ajustes-do-negociador) |
| Ajustes › Funil e abordagens | Menu › **Ajustes** › Funil e abordagens | `/ajustes/funil` | [Funil, temperatura e fila do dia](funil.md) |
| Assistente | Botão **Assistente** (✦) no cabeçalho da coluna esquerda de toda tela (ou tecla `A`) | `/assistente` abre Hoje com ele aberto | [Assistente do Corretor](assistente.md) |
| Página pública e ficha do imóvel | Link da Página (sem login) | página pública do app | [Página, ficha pública e link rastreado](minha-pagina.md) |
| Portal do Cliente e seleção | Link pessoal do cliente (sem login) | página pública do app | [Seleções e Portal do Cliente](selecoes-e-portal.md) |

| Parte | Onde fica | O que faz |
|---|---|---|
| **Menu** | Nome do app no alto da página (**Portal do Corretor ▾**) | As telas do corretor na ordem **Hoje · Conversas · Clientes · Imóveis · Estúdio · Página · Números · Ajustes**, mais Equipe da plataforma › Corretores para a equipe (desde a 0.1.46 o menu é o do shell; a app não tem mais o trilho lateral) |
| **Lista** | Coluna da esquerda | O que existe naquela tela (em Números, os relatórios; em Página, os blocos). O item escolhido fica no endereço (`?item=`; em Números, `?relatorio=`): recarregar ou abrir o link guardado reabre o mesmo |
| **Foco** | Coluna do meio, a mais larga | O que você está fazendo: o item aberto e as ações principais |
| **Contexto** | Coluna da direita | O que ajuda a decidir sobre o item aberto. O Assistente, quando aberto, ocupa esta coluna |

- As colunas da esquerda (360 px) e da direita (340 px) têm largura fixa; a do meio fica com o resto. A da direita mostra "Escolha um item" enquanto nada está aberto.
- No celular, aparece uma coluna por vez, com abas para trocar entre elas.

**Criar**, no alto de toda tela do corretor, abre:

| Opção | O que acontece |
|---|---|
| Novo cliente | Abre Clientes já com o cadastro de contato |
| Novo imóvel | Abre a tela Novo imóvel em 4 passos (`/imoveis/novo`), em branco e no passo Fotos |
| Novo post | Abre o Estúdio já com o pedido de peça |
| Nova visita | Pede o cliente, o imóvel, o dia e a hora ali mesmo; com a ficha de um cliente aberta, ele já vem escolhido. Depois abre a ficha do cliente |
| Nova proposta | Pede o cliente (o da ficha aberta já vem escolhido), o imóvel e o valor oferecido; registra a oferta e abre a negociação em Clientes › Negociações |

**Assistente:** abre na coluna da direita da tela em que você está, sem sair dela, em todas as telas do
corretor. **Fechar** devolve o contexto no lugar do Assistente, e a lista e o centro ficam como estavam —
ver [Assistente do Corretor](assistente.md).

**Estados das telas** (são sete, o conjunto comum às telas do corretor; cada tela mostra só os que se aplicam a ela):
- Enquanto carrega, aparece o indicador de carregamento, nunca a tela em branco.
- Quando não há nada, uma frase diz o que falta e o botão que resolve (por exemplo, "Nenhum imóvel ainda" com **Cadastrar o primeiro imóvel**).
- Se algo não carregou, aparece uma frase curta com **Tentar de novo**.
- O que não existe ou é de outra conta aparece como **Não encontrado**, nunca como "sem permissão".
- Quando o Instagram desconecta, uma faixa no Estúdio diz "Seu Instagram desconectou" com **Reconectar** (leva a Ajustes › Conexões).
- Quando a IA não está liberada, aparece o aviso "IA indisponível agora" e o resto da tela funciona (Hoje, ficha do cliente, Negociações, Estúdio, Ajustes › Negociador e o Assistente).
- A faixa "Créditos do mês acabaram" está pronta, mas ainda não aparece: nenhuma função gasta crédito antes do Mensageiro.

## Atalhos e busca

**Buscar** abre pela tecla `/` nas telas em colunas: Hoje, Negociações, Clientes, Importar contatos, Imóveis, Estúdio, Página, Números e Ajustes (o negociador humano não o vê). A tecla `/` abre a busca em qualquer tela da área do corretor, com ou sem trilho. Digite pelo menos 2
letras: aparecem até 5 resultados de cada tipo, só da sua conta.

| Tipo | Busca por | Ao escolher |
|---|---|---|
| Cliente | Nome, telefone (com ou sem máscara) ou e-mail | Abre a ficha em Clientes |
| Imóvel | Título, código ou bairro | Abre a ficha em Imóveis |
| Negociação | Código (NG-…), ou o nome do cliente ou o imóvel dela | Abre a negociação em Clientes › Negociações |

- Clientes anonimizados (pedido de exclusão de dados) não aparecem.
- Da negociação aparecem só o código, o cliente e o imóvel: nenhum valor, e nada do mandato.
- A busca é do corretor. O negociador humano não busca na carteira.

**Atalhos de teclado** (computador):

| Tecla | O que faz |
|---|---|
| `/` | Abre a busca |
| `C` | Abre Criar (escolha o que criar e confirme) |
| `A` | Abre ou fecha o Assistente |
| `J` / `K` | Próximo e anterior na lista de Clientes, de Negociações e da carteira de Imóveis; sem item aberto, `J` vai ao primeiro e `K` ao último |
| `E` | Editar o cliente ou o imóvel aberto |

- Nenhum atalho age com o foco num campo de texto, num seletor, numa caixa de diálogo ou num formulário, inclusive dentro de componentes. O app olha só onde está o foco: com uma janela aberta e o foco fora dela, o atalho ainda age.
- Com Ctrl, Cmd ou Alt junto, a tecla é do navegador, não do app.
- O negociador humano tem só `J`/`K`, na lista dele.

## Papéis

| Papel | Quem | Onde se atribui |
|---|---|---|
| `corretor` | O corretor, usuário externo dono da conta | Configurações › Usuários, seção Externos, depois que ele aceita o convite |
| `operacao` | A equipe da plataforma que convida corretores | Configurações › Usuários, seção Equipe |
| `negociador` | A pessoa que o corretor convidou para conduzir negociações (externo, na conta do corretor) | Configurações › Usuários, seção Externos, depois que ela aceita o convite — ver [Negociador humano](negociacao.md#negociador-humano) |

Sem o papel, a tela mostra "Esta área não está liberada para você" e diz qual papel pedir.

**Administrador do app** (nível `admin`) vale por todos os papéis: vê e configura todas as telas, as do
corretor e as da equipe, sem precisar de papel atribuído (o papel `corretor` é externo e não pode ser
dado a quem é da equipe). Como as tabelas são segregadas por conta, para usar as telas do corretor o
admin precisa estar associado a uma conta (Admin › Acesso › Contas). Sem nenhuma conta, as telas do
corretor mostram "Você ainda não está em nenhuma conta" com esse caminho, e a API responde `SEM_CONTA`
(409) em vez de erro de conta não informada; a área Corretores (convites) segue aberta. Quem está em
mais de uma conta vê o seletor **Conta** no alto das telas e trabalha na conta escolhida (a escolha fica
lembrada no navegador); com uma conta só, o seletor não aparece. Com várias contas, listas, fichas e números mostram só a conta escolhida, e uma chamada sem a conta ativa é recusada com a orientação de escolhê-la (a lista de convites da equipe não depende de conta).

### Endereço recebido (diagnóstico)

Ao abrir um endereço que o app não conhece, como `/portal_corretor/retorno?code=teste`, a tela
"Página não encontrada" mostra `/retorno?code=teste`. Serve para a equipe conferir o retorno das
conexões com a Meta, quando elas chegarem.

## Para o administrador da instância

- **IA:** o app declara cinco slots próprios: **Conteúdo** e **Assistente do Corretor** (base
  `normal`), **Leitura de fotos** (base `arquivos`), **Mensagem sugerida** (slot `funil`, base
  `barato`: adapta a abordagem do playbook ao histórico, na ficha do cliente) e **Negociador**
  (base `poder`: sugere o próximo movimento da negociação). Para ligá-los, em
  Admin › Instaláveis › Apps › Portal do Corretor › IA, autorize as bases `normal`, `arquivos`,
  `barato` e `poder` (chave da plataforma) ou configure uma chave própria em cada slot. Sem isso o app
  funciona, sem os botões de IA, e o Assistente vira busca no manual. Sem a base `barato`, a
  Mensagem sugerida mostra o texto do playbook como está. O microfone do Assistente aparece quando o slot de áudio da
  plataforma estiver liberado para o app.

- **Rotina:** "Temperatura dos contatos" (diária) esfria quem passou 7 dias sem contato. O horário
  e o liga-desliga ficam em Configurações da app › Rotinas (admin da app); sem ajuste, roda às 06:00 UTC.

- **Páginas públicas e webhooks:** a página do corretor, a ficha do imóvel, o formulário e o link
  rastreado — ver [Página, ficha pública e link rastreado](minha-pagina.md#para-o-administrador-da-instância);
  a seleção e o portal do cliente — ver [Seleções e Portal do Cliente](selecoes-e-portal.md#para-o-administrador-da-instância).

- **Aviso de cores na instalação:** instalar ou atualizar o app mostra o aviso `[tokens] 14 literais
  de cor fora de token no bundle — frontend/index.js`. É esperado: são as cores fixas das páginas
  públicas, que por regra da plataforma não usam o tema (o visitante não está logado). O aviso não
  impede a instalação e não indica problema nas telas do corretor.

- **Instagram:** o app da Meta, os parâmetros `meta_app_id` e `meta_app_secret` e as contas de
  teste — ver [Conexões (Instagram)](conexoes.md#para-a-equipe-da-plataforma-antes-do-primeiro-corretor).
  A rotina "Conexões do Instagram" (diária) renova os acessos.

## Serviços externos

- **Instagram (Meta):** `graph.instagram.com` e `api.instagram.com`, para conectar e publicar.
  O app só chama a Meta quando o corretor conecta, publica ou agenda, e na renovação diária dos
  acessos.
