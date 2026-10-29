---
titulo: Portal do Corretor
descricao: O escritório digital do corretor de imóveis — o que já existe nesta versão.
---

# Portal do Corretor

App do corretor de imóveis. Cada corretor tem a **própria conta**: nenhum corretor vê nada de outro,
e a garantia é do banco de dados da plataforma, não só das telas.

## O que existe nesta versão (0.1.23; a 0.1.0 foi a primeira)

| Para quem | Tela | O que faz |
|---|---|---|
| Corretor | **Hoje** (antes, Início) | No desenho novo, em três colunas: **Precisa de você** e **Primeiros passos** (x de 5, sem o CRECI); a **fila do dia** em cartões, um botão por item; e, à direita, a agenda de hoje (com **Ver agenda**, os próximos 14 dias), **Sua semana** e a **Dica do Assistente** — ver [Funil, temperatura e fila do dia](funil.md) e [Clientes, negócios e agenda](clientes-e-agenda.md) |
| Corretor | **Números** (antes, Desempenho) | Leads, conversão entre etapas, vendas, VGV, captações, comissão prevista, origem e motivos de perda — ver [Números, envios e dados de demonstração](desempenho.md) |
| Corretor | **Clientes** | No desenho novo, em três colunas: a lista (visões **Lista**, **Funil** e **Negociações**, busca, filtros prontos Novos · Sem contato · Quentes · Retorno vencido e o papel), a **ficha** do cliente escolhido (cabeçalho com Conversa e Resumir; abas Resumo · Linha do tempo · Enviados · Negócios · Negociação) e, à direita, perfil de busca, portal do cliente e privacidade; importar e exportar planilha — ver [Clientes, negócios e agenda](clientes-e-agenda.md) e [Funil, temperatura e fila do dia](funil.md) |
| Corretor | **Imóveis** | No desenho novo: à esquerda, as abas **Carteira** (lista com miniatura, busca e chips Ativos · Rascunhos · Vendidos) e **Empreendimentos**; no centro, a ficha (galeria, dados, quem vê, fotos, descrição com IA, autorização e visitas); à direita, a qualidade com o que falta, os números de 30 dias e os clientes que combinam — ver [Imóveis e empreendimentos](imoveis.md) |
| Corretor | **Estúdio** | Peças para o Instagram com a sua marca: textos com IA e descrição pronta para gerar a arte no Canva IA (ou em outra ferramenta), envio da arte na peça, aprovação e publicação — ver [Estúdio de conteúdo](estudio.md) |
| Corretor | **Página** (antes, Minha página) | A página pública por blocos, com os imóveis anunciados e o formulário de contato — ver [Minha página, ficha pública e link rastreado](minha-pagina.md) |
| Visitante | **Página e ficha pública** (sem login) | A página do corretor (capa com foto, nome, CRECI se houver e WhatsApp; imóveis em destaque com **Quero saber mais**) e a ficha de cada imóvel anunciado; o contato vira cliente no funil |
| Corretor | **Clientes › ficha › Seleções e Portal do cliente** | Monta seleções de imóveis (aba Negócios), gera, reenvia e revoga o link do portal do cliente e pede pendências a ele (**Pedir ao cliente**), na coluna da direita; o próximo passo que ele vê no portal fica no cartão Próximo passo — ver [Seleções e Portal do Cliente](selecoes-e-portal.md) |
| Cliente | **Seleção e Portal do Cliente** (link pessoal, sem login) | O portal "Meu atendimento" com o próximo passo e as abas Conversa, Imóveis, Agenda, Propostas (quando há negociação: vê as rodadas, aceita a condição do vendedor, que não fecha o acordo, ou faz nova oferta) e Arquivos: reage aos imóveis (gostei, não gostei, quero visitar, comentar), vê as visitas, pede para remarcar, manda mensagem ao corretor e marca como feitas as pendências que o corretor pediu (botão **Feito**); link revogado mostra "Link expirado" |
| Corretor | **Assistente** (botão, abre à direita da tela) | Tira dúvidas pelo manual, ajuda a decidir quem atender e cria lembretes ou agenda peças com a sua confirmação — ver [Assistente do Corretor](assistente.md) |
| Corretor | **Ajustes** | Uma tela com cinco abas: Conta, Marca, Conexões (Instagram), Funil e abordagens, Atendimento — ver [Conta e ajustes](conta-e-ajustes.md) e [Conexões (Instagram)](conexoes.md) |
| Corretor | **Negociação** (Clientes › Negociações) | A negociação de um negócio: a lista com os filtros, a faixa da negociação (recuo e alvo mascarados até **mostrar**), a escada de propostas, o cartão do Negociador IA (Enviar, Fazer agora, Editar, Descartar; nunca aceita o acordo), o mandato do vendedor numa janela de quatro blocos, a aba Negociação da ficha e a Nova proposta; os ajustes do Negociador chegam numa versão seguinte — ver [Negociação e mandato](negociacao.md) |
| Corretor | **Criar** (no alto de toda tela) | Novo cliente, Novo imóvel, Novo post, Nova visita e Nova proposta — ver [Como as telas se organizam](#como-as-telas-se-organizam) |
| Corretor | Endereços antigos | `/agenda`, `/funil`, `/empreendimentos`, `/desempenho` e `/assistente` abrem Hoje › Agenda, Clientes › Funil, Imóveis › Empreendimentos, Números e Hoje com o Assistente aberto; `/conta` abre Ajustes › Conta |
| Equipe da plataforma | **Equipe da plataforma › Corretores** | Convida corretores e acompanha os convites — ver [Convidar corretores](convidar-corretores.md) |

Integração disponível: Instagram (publicar e agendar pelo Estúdio). O WhatsApp e o Mensageiro (o assistente que conversa com os clientes) chegam numa versão seguinte: dependem de recursos que a plataforma ainda não oferece. A IA aparece no Assistente, na ficha do cliente (Resumir e Mensagem sugerida), nos imóveis (descrição e leitura de fotos), na Minha página e no Estúdio (textos),
quando liberada pelo administrador. Cada funcionalidade passa a constar aqui na versão em que chegar.

## Como as telas se organizam

O menu tem, nesta ordem: **Hoje · Clientes · Imóveis · Estúdio · Página · Números · Ajustes**. As
telas estão passando para um desenho só, em colunas (o "Padrão B"). **Hoje**, **Clientes**, **Imóveis** e **Números** já estão nele; as
outras chegam nas próximas versões, sem perder nada do que fazem hoje.

| Parte | Onde fica | O que faz |
|---|---|---|
| **Trilho** | Faixa estreita à esquerda | Os itens do menu, com o da tela aberta destacado, e o botão **Assistente** no fim. No celular, o botão **Menu** no alto mostra o trilho |
| **Lista** | Coluna da esquerda | O que existe naquela tela (em Números, os relatórios). O item escolhido fica no endereço (`?item=`): recarregar ou abrir o link guardado reabre o mesmo |
| **Foco** | Coluna do meio, a mais larga | O que você está fazendo: o item aberto e as ações principais |
| **Contexto** | Coluna da direita | O que ajuda a decidir sobre o item aberto. O Assistente, quando aberto, ocupa esta coluna |

- As colunas da esquerda e da direita podem ser alargadas, arrastando a divisa, e recolhidas pela setinha no topo delas.
- No celular, aparece uma coluna por vez, com abas para trocar entre elas.

**Criar**, no alto de toda tela do corretor, abre:

| Opção | O que acontece |
|---|---|
| Novo cliente | Abre Clientes já com o cadastro de contato |
| Novo imóvel | Abre Imóveis já com o cadastro do imóvel |
| Novo post | Abre o Estúdio já com o pedido de peça |
| Nova visita | Pede o cliente, o imóvel, o dia e a hora ali mesmo; com a ficha de um cliente aberta, ele já vem escolhido. Depois abre a ficha do cliente |
| Nova proposta | Abre Clientes › Negociações com o registro da proposta: cliente (o da ficha aberta já vem escolhido), imóvel e valor. A oferta entra na negociação desse cliente e imóvel, que nasce se ainda não existir |

**Assistente:** abre na coluna da direita da tela em que você está, sem sair dela. Em **Hoje**, **Imóveis** e **Números**, já no
desenho novo, **Fechar** devolve o contexto no lugar do Assistente, e a lista e o centro ficam como estavam.
Nas telas que ainda não estão no desenho novo, o botão **Assistente** fica no alto, ao lado de Criar, e o
Assistente divide a tela com ela; abrir e fechar recarrega a tela, que não volta exatamente como estava —
ver [Assistente do Corretor](assistente.md).

**Estados de toda tela** (**Hoje**, **Imóveis** e **Números** já usam os estados comuns, de `frontend/estados.ts`; as demais telas passam a usá-los ao entrar no desenho novo):
- Enquanto carrega, aparece o indicador de carregamento, nunca a tela em branco. A maioria das telas já mostra o indicador.
- Se algo não carregou, aparece uma frase curta com **Tentar de novo**. A maioria das telas já tem o botão.
- O que não existe ou é de outra conta aparece como **Não encontrado**. Hoje isso vale em **Números**, em **Hoje** e em **Imóveis**.
- Quando a IA não está liberada, aparece o aviso "IA indisponível agora" e o resto da tela funciona. Hoje o aviso aparece no painel do **Assistente** e em **Hoje**.

## Papéis

| Papel | Quem | Onde se atribui |
|---|---|---|
| `corretor` | O corretor, usuário externo dono da conta | Configurações › Usuários, seção Externos, depois que ele aceita o convite |
| `operacao` | A equipe da plataforma que convida corretores | Configurações › Usuários, seção Equipe |

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
  rastreado — ver [Minha página, ficha pública e link rastreado](minha-pagina.md#para-o-administrador-da-instância);
  a seleção e o portal do cliente — ver [Seleções e Portal do Cliente](selecoes-e-portal.md#para-o-administrador-da-instância).

- **Instagram:** o app da Meta, os parâmetros `meta_app_id` e `meta_app_secret` e as contas de
  teste — ver [Conexões (Instagram)](conexoes.md#para-a-equipe-da-plataforma-antes-do-primeiro-corretor).
  A rotina "Conexões do Instagram" (diária) renova os acessos.

## Serviços externos

- **Instagram (Meta):** `graph.instagram.com` e `api.instagram.com`, para conectar e publicar.
  O app só chama a Meta quando o corretor conecta, publica ou agenda, e na renovação diária dos
  acessos.
