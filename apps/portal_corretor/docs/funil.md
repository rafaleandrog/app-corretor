---
titulo: Funil, temperatura e fila do dia
descricao: A visão Funil de Clientes, temperatura do contato com motivo, abordagens recomendadas e a fila do dia em Hoje.
---

# Funil, temperatura e fila do dia

## Funil: Clientes › Funil

O funil é a visão **Funil** de **Clientes** (o botão **Funil**, ao lado de **Lista**, no alto
da coluna da esquerda). O endereço é `/clientes?visao=funil`; os endereços antigos `/funil` e
`/clientes?visao=quadro` continuam abrindo a visão Funil. A tela tem três colunas:

A coluna da direita mostra uma dica enquanto nenhum cartão foi escolhido; ao tocar num cartão, ela
abre com o cliente.

**Esquerda: o que mostrar.** Tudo em chips, com **Todas** primeiro em cada linha (é o chip que
desliga o filtro):

- **Funis**: "Compra" e "Venda e captação", cada um com quantos negócios estão em andamento.
- **Filtros prontos**: Novos, Sem contato, Quentes e Retorno vencido, os mesmos da Lista ("Sem
  contato" usa o N de Ajustes › Horário de atendimento).
- **Por temperatura**: Quentes, Mornos e Frios, cada um com quantos clientes têm negócio em
  andamento no funil. A contagem não muda com os filtros; tocar numa delas filtra o quadro. Embaixo,
  a regra em uma linha: quente é quem tem proposta, visita marcada ou gostou da visita; morno,
  quem conversou nos últimos 7 dias; frio, quem está há mais de 7 dias sem contato.

Não há listas salvas: os filtros prontos ocupam o lugar delas. Tudo o que você escolhe fica no
endereço da página.

**Centro: o quadro.** No alto, o funil e quantos negócios estão em andamento, e a **taxa de
passagem** entre cada etapa e a seguinte, em números ("86%" sobre "Novo → Em atendimento"; passe o
mouse para ver quantos de quantos). Abaixo, o quadro ocupa a altura que sobra no centro e rola por
dentro: uma coluna por etapa, e em cada cartão o nome do cliente, o título, o valor, o **último
sinal** (o que aconteceu por último com ele: "Abriu Casa do Lago 2x", "Pediu fotos da casa"), a
temperatura e o aviso de **abordagem atrasada**.

- **Como a taxa é contada:** dos negócios do quadro que chegaram a uma etapa, quantos chegaram à
  seguinte. Ela usa a etapa mais avançada a que cada negócio chegou, como em
  [Números](desempenho.md): quem voltou ou foi perdido conta até onde foi, e o ganho passou por
  todas. A conta é sobre os negócios do quadro (os em andamento e os ganhos e perdidos dos últimos
  30 dias), sem os filtros. Uma etapa que você criou em Ajustes › Funil não tem taxa.
- **Arraste** o cartão para mudar de etapa. Ao soltar em **Perdido**, o app pergunta o motivo; sem
  motivo, nada é gravado e o cartão volta. Ao soltar um negócio de compra com imóvel em
  **Proposta**, o Negociador entra: a negociação nasce e a tela avisa com o código dela (ver
  [Quando o Negociador entra](negociacao.md#quando-o-negociador-entra)). Não há "desfazer" por
  tempo: para voltar, arraste o cartão de volta.
- O **último sinal** do cartão é o mais recente entre a linha do tempo do cliente e o último clique
  num envio (imóvel, seleção, link), com quantas vezes ele abriu.
- **Toque** no cartão para ver o cliente na coluna da direita, sem sair do Funil. No cartão com
  **abordagem atrasada**, o cliente abre já com a **Mensagem sugerida** pronta.
- Ganhos e perdidos ficam no quadro por 30 dias; os em andamento ficam sempre.

**Direita: o cliente do cartão escolhido.**

- A temperatura com o motivo ("Por que quente: tem visita marcada") e a etapa.
- A **próxima abordagem**, com **Mensagem pronta** (a mensagem sugerida, ver
  [Próxima abordagem](#próxima-abordagem)), **Fazer agora** (abre o WhatsApp do celular com ela e
  registra a abordagem) e **Virar tarefa**.
- **Registrar proposta**: registra a oferta do cliente (imóvel e valor) e abre a negociação em
  Clientes › Negociações — ver [Negociação e mandato](negociacao.md#nova-proposta-e-o-cartão-negociação).
- **Resumir** (quando a IA está liberada), **Criar tarefa** (a abordagem vira tarefa no prazo do
  playbook; sem abordagem, o formulário de agendar), **Abrir conversa** (a conversa do cliente em
  [Conversas](conversas.md)) e **Abrir ficha**.
- **Enviados**: o que foi mandado ao cliente, quando ele abriu o link e quantos cliques deu.

## Temperatura do contato

Cada contato é **frio**, **morno** ou **quente**, sempre com o motivo em uma frase. O app
recalcula quando acontece algo com o contato (cadastro, nota, visita marcada, retorno de visita,
mudança de etapa, atividade concluída, abordagem feita) e, uma vez por dia, esfria quem passou 7
dias sem contato:

| Temperatura | Quando |
|---|---|
| Quente | Negócio em proposta ou documentação (inclui "Proposta recebida" na venda); visita marcada nos próximos 14 dias; retorno de visita com nota 4 ou 5 nos últimos 14 dias |
| Morno | Teve contato nos últimos 7 dias, sem visita marcada; ou retorno de visita com nota 1 ou 2 |
| Frio | Mais de 7 dias sem contato, ou nenhum contato registrado |

O corretor pode trocar a temperatura na edição do contato, com o motivo (confirmar a mesma
temperatura com um motivo também conta como escolha dele). **A escolha vale até surgir um sinal
forte depois dela**: visita marcada, retorno de visita ou negócio que entra em proposta. O que já
existia quando ele escolheu não desfaz a escolha (remarcar uma visita antiga também não), e um
sinal fraco, como uma nota, também não. A
ficha guarda o histórico das últimas mudanças.

## Próxima abordagem

Para cada contato com negócio em andamento, a etapa e a temperatura apontam uma abordagem do
**playbook** (sem linha para essa combinação, não há abordagem): o que fazer, por onde (WhatsApp, ligação, e-mail, visita) e em quanto tempo. O prazo
conta do mais recente entre a entrada na etapa, o último contato e o último "pular".

Na ficha do cliente, a abordagem aparece no cartão **Próximo passo**, com dois botões:

- **Mensagem sugerida** mostra o texto pronto para mandar ao cliente. Com a IA liberada, ela adapta
  a abordagem do playbook ao histórico recente do contato (sem repetir o que já foi mandado; onde
  faltar imóvel ou horário, deixa um espaço como "[imóvel]" para você completar). Sem a IA, aparece
  o texto do playbook como está. Revise antes de enviar: nada sai sozinho.
  - Acima do texto, os **objetivos de um toque** trocam o que a mensagem faz: **Pelo playbook** (o
    padrão, quando há abordagem), **Apresentação**, **Retorno**, **Ainda procurando?** e **Manter
    contato**. Com a IA liberada, ela escreve para o objetivo com o histórico do contato (as mesmas
    regras: sem telefone nem e-mail); sem a IA, aparece um modelo pronto do objetivo para você
    ajustar. Os objetivos funcionam também sem negócio em andamento.
  - **Fazer agora** abre o WhatsApp do cliente com a mensagem e registra a abordagem no histórico
    ("Abordagem por WhatsApp: …"), contando como contato. Uma linha só: não entra em "Enviados ao
    cliente".
  - Contato sem telefone: o botão vira **Copiar texto**, e você registra depois pelo menu **Mais ›
    Registrar abordagem feita**.
- **Virar tarefa** põe a abordagem na agenda: ligação vira ligação, visita vira visita, WhatsApp
  vira mensagem e e-mail vira tarefa, no prazo do playbook (se o prazo já passou, conta de agora),
  ligada ao contato e ao negócio.

No menu **Mais** da ficha:

- **Registrar abordagem feita** anota o que você fez por outro caminho (ligou, encontrou) e conta
  como contato.
- **Pular a abordagem** recomeça o prazo a partir de agora.

### Ajustes › Funil e abordagens

Abaixo das etapas, a tabela de abordagens por etapa e temperatura. O app semeia uma abordagem
para cada etapa da semente e cada temperatura; toque numa linha para mudar o texto, o canal e o
prazo. Etapas criadas pelo corretor começam sem abordagem: use **Nova abordagem**.

## Hoje (antes, Início)

**Hoje** responde "o que eu faço agora". Ela vem em três colunas (no celular, uma por vez, em abas:
**Hoje · Fila · Agenda**; a aba Hoje abre primeiro, com a linha de atalhos do dia **Conversas ·
Criar · Imóveis · Assistente**, "Precisa de você" e, logo abaixo, a fila do dia em cartões compactos,
numa só rolagem). O endereço `/hoje` também abre a tela.

**À esquerda:**

- As abas **Hoje · Agenda** (a Agenda é a lista dos próximos 14 dias), o dia por extenso e o estado
  do Mensageiro (por enquanto, "ainda não disponível": ele chega com o WhatsApp).
- **Precisa de você**: só as negociações que esperam a sua decisão (as que o Negociador passou a
  você, ou com uma oferta do cliente esperando resposta), cada uma com o motivo em uma linha e o
  botão **Assumir**: você passa a conduzir a negociação e ela abre em Clientes › Negociações; se o
  Negociador atendia a conversa do cliente, a conversa também passa a você e é ela que abre. A lista
  mostra até 20 negociações. Os clientes quentes sem resposta ficam na fila do dia.
- **Primeiros passos · x de 5**, com as bolinhas de progresso e um **Fazer** em cada passo pendente:
  dar nome à conta, informar o seu telefone, conectar o Instagram, cadastrar o primeiro imóvel e
  publicar a Página. Some quando os 5 estão feitos. Quando o WhatsApp e o Mensageiro existirem, os
  passos deles entram aqui.
- O CRECI **não** é um passo: sem ele, aparece só o aviso discreto *"Adicione seu CRECI ao perfil para
  que ele apareça nos anúncios"*, com o atalho **Ajustes › Conta e marca** (o CRECI jurídico da conta também vale).
- Nas contas de teste ainda sem contatos, o convite para **Gerar dados de demonstração**.

**No centro**, a **fila do dia** em cartões, na ordem do mais urgente, com cada cliente uma vez só
(no motivo mais urgente):

1. **Quentes sem resposta**: quente e mais de um dia sem contato.
2. **Abordagens atrasadas**: o prazo do playbook passou.
3. **Visitas de hoje e amanhã**.
4. **Propostas recebidas**: a última proposta da negociação é do comprador e ainda não foi respondida.
5. **Próximos passos vencidos** (retorno vencido).
6. **Peças aguardando**: peças do Estúdio aprovadas e ainda sem data para publicar.
7. **Autorizações vencendo**: autorizações de venda assinadas que vencem nos próximos 30 dias (a mesma
   janela do aviso de autorização vencendo).

Cada cartão traz o chip do **motivo** (Sem resposta, Abordagem atrasada, Visita hoje ou amanhã,
Proposta recebida, Retorno vencido, Peça aguardando, Autorização vencendo), a temperatura do cliente
(quando há), o nome, o motivo em uma linha, **um** botão principal, um secundário e o "Mais", onde
**Agora não** tira o cliente da fila pelo resto do dia (no fuso da conta), em qualquer motivo com
cliente, e o prazo da abordagem recomeça a contar de agora. No dia seguinte ele volta normalmente;
**Fiz** desfaz o adiamento. Peças, autorizações e "Precisa de você" não são afetados:

| Motivo | Botão | Secundário | No "Mais" |
|---|---|---|---|
| Sem resposta | **Fazer agora** (abre a ficha com a mensagem sugerida) | **Falar com <nome>** (a conversa dele) | Agora não |
| Abordagem atrasada | **Fazer agora** | **Falar com <nome>** | **Fiz** (registra a abordagem feita), Agora não |
| Visita | **Abrir** (a ficha do cliente) | **Falar com <nome>** | **Visita feita**, Agora não |
| Proposta recebida | **Responder** (abre a negociação) | **Registrar proposta** | Agora não |
| Retorno vencido | **Abrir** | **Falar com <nome>** | Agora não |
| Peça aguardando | **Revisar** (abre a peça no Estúdio) | — | — |
| Autorização vencendo | **Abrir** (o imóvel, na autorização) | — | — |

Aparecem 8 cartões; o resto fica em **Mais N para depois**. O WhatsApp abre na ficha, no clique do
**Fazer agora** de lá: Hoje e a visão Funil só levam até a mensagem pronta (e ela só é gerada se o contato
tiver abordagem). Fila vazia mostra "Nada urgente agora" e o botão **Cadastrar um cliente**.

**À direita:**

- **Agenda de hoje**: o que está pendente hoje, por horário, até 20 compromissos. **Ver agenda** troca o centro pela lista
  dos próximos 14 dias (ver [Clientes, negócios e agenda](clientes-e-agenda.md#agenda)), e **Voltar
  para a fila** desfaz. O endereço `/agenda` abre Hoje direto na agenda.
- **Sua semana**: contatos novos, leads e visitas feitas nos últimos 7 dias, em três números que se arrumam lado a lado
  conforme a largura que sobra no cartão (quando sobra pouco, ficam um embaixo do outro), e embaixo, numa
  linha só, a comissão prevista.
- **Dica do Assistente**: uma sugestão a partir do que está na tela e um botão só: com uma **ação**
  quando há o que fazer, o botão da ação; sem ação, **Perguntar ao Assistente**. Com ação: com um quente sem resposta, **Criar o lembrete** (uma ligação daqui a 1 hora para
  responder a ele); com uma abordagem atrasada, um retorno daqui a 2 horas; com uma peça aprovada
  sem data, **Agendar a peça** (amanhã às 18 h no fuso da conta, a mesma hora do resumo que você confirma). O botão pede confirmação ("Posso fazer isto?") e só
  então executa, pela mesma rota de sempre (a atividade entra na agenda; a peça é agendada). Sem
  ação (o primeiro passo ainda não feito, ou "nada urgente"), **Perguntar ao Assistente** abre o
  Assistente já com a dica como pergunta; quando a IA não está liberada, esse botão fica desligado,
  com a nota "IA indisponível agora" embaixo. O botão de uma ação não usa IA e funciona igual com a
  IA fora do ar. Sem IA, uma faixa no alto do centro avisa; o resto de Hoje funciona.

Tudo vem numa chamada só (`GET /inicio`), relida a cada vez que você entra em Hoje ou troca de conta. Ao trocar de conta, Hoje mostra
"carregando" até chegarem os dados da conta nova (nada da conta anterior fica na tela); se a
releitura falhar, aparece o erro com **Tentar de novo** no lugar dos dados; se a resposta for 403 ou 404, aparece **Não encontrado**.

As passagens do Mensageiro e os frios que reagiram a um envio entram com o WhatsApp e com os envios
rastreados.

**Para quem desenvolve:** `GET /inicio` devolve `fila` (cada item com `tipo`, `contato_id` — nulo na
peça e na autorização —, `negociacao_id`, `peca_id` ou `imovel_id` conforme o tipo), `passagens` (com
`conversa_id` quando o Negociador atende a conversa) e `dica` (`texto` e `acao` já conferida pelo
`validarAcao` do Assistente: `rota` e `corpo` da execução, ou nulo). Assumir é `POST
/negociacoes/:id/assumir` e, com conversa, `POST /conversas/:id/assumir`; "Agora não" é `POST
/abordagens/:contato/adiar`.
