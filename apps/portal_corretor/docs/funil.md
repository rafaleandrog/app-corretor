---
titulo: Funil, temperatura e fila do dia
descricao: A visão Funil de Clientes, temperatura do contato com motivo, abordagens recomendadas e a fila do dia em Hoje.
---

# Funil, temperatura e fila do dia

## Funil: Clientes › Funil

O funil é a visão **Funil** de **Clientes** (o botão **Funil**, ao lado de **Lista**, no alto
da coluna da esquerda). O endereço é `/clientes?visao=funil`; os endereços antigos `/funil` e
`/clientes?visao=quadro` continuam abrindo a visão Funil. A tela tem três colunas:

**Esquerda: o que mostrar.**

- **Funis**: "Compra" e "Venda e captação", cada um com quantos negócios estão em andamento.
- **Filtros prontos**: Novos, Sem contato, Quentes e Retorno vencido, os mesmos da Lista.
- **Por temperatura**: Quentes, Mornos e Frios, cada um com quantos clientes têm negócio em
  andamento no funil. A contagem não muda com os filtros; tocar numa delas filtra o quadro. Embaixo,
  a regra em uma linha: quente é quem tem proposta, visita marcada ou gostou da visita; morno,
  quem conversou nos últimos 7 dias; frio, quem está há mais de 7 dias sem contato.
- **Sem contato há** 3, 7, 15, 30 ou 90 dias.

Não há listas salvas: os filtros prontos ocupam o lugar delas. Tudo o que você escolhe fica no
endereço da página.

**Centro: o quadro.** No alto, o funil e quantos negócios estão em andamento, e a **taxa de
passagem** entre cada etapa e a seguinte (por exemplo, "Novo → Em atendimento 86%"). Abaixo, uma
coluna por etapa, e em cada cartão o nome do cliente, o título, o valor, a temperatura e o aviso
de **abordagem atrasada**.

- **Como a taxa é contada:** dos negócios do quadro que chegaram a uma etapa, quantos chegaram à
  seguinte. Ela usa a etapa mais avançada a que cada negócio chegou, como em
  [Números](desempenho.md): quem voltou ou foi perdido conta até onde foi, e o ganho passou por
  todas. A conta é sobre os negócios do quadro (os em andamento e os ganhos e perdidos dos últimos
  30 dias), sem os filtros. Uma etapa que você criou em Ajustes › Funil não tem taxa.
- **Arraste** o cartão para mudar de etapa. Ao soltar em **Perdido**, o app pergunta o motivo; sem
  motivo, nada é gravado e o cartão volta.
- **Toque** no cartão para ver o cliente na coluna da direita, sem sair do Funil. No cartão com
  **abordagem atrasada**, o cliente abre já com a **Mensagem sugerida** pronta.
- Ganhos e perdidos ficam no quadro por 30 dias; os em andamento ficam sempre.

**Direita: o cliente do cartão escolhido.**

- A temperatura com o motivo ("Por que quente: tem visita marcada") e a etapa.
- A **próxima abordagem**, com **Mensagem sugerida**, **Fazer agora** e **Virar tarefa** (ver
  [Próxima abordagem](#próxima-abordagem)).
- **Registrar proposta**: registra a oferta do cliente (imóvel e valor) e abre a negociação em
  Clientes › Negociações — ver [Negociação e mandato](negociacao.md#nova-proposta-e-a-aba-negociação).
- **Resumir** (quando a IA está liberada), **Tarefa** (agendar), **Conversa** (abre o WhatsApp do
  cliente) e **Abrir ficha**.
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

**Hoje** responde "o que eu faço agora". Ela vem no desenho novo, em três colunas (no celular, uma por
vez, em abas: **Hoje · Fila · Agenda**).

**À esquerda:**

- O dia por extenso e o estado do Mensageiro (por enquanto, "ainda não disponível": ele chega com o WhatsApp).
- **Precisa de você**: as negociações que esperam a sua decisão e os clientes quentes sem resposta,
  cada um com o botão **Abrir** (a ficha do cliente). Na aba **Negociação** da ficha, a negociação
  abre em Clientes › Negociações, onde ficam **Assumir** e **Devolver ao Negociador**. A lista mostra até 20 negociações e até 50 clientes quentes.
- **Primeiros passos · x de 5**, com as bolinhas de progresso e um **Fazer** em cada passo pendente:
  dar nome à conta, informar o seu telefone, conectar o Instagram, cadastrar o primeiro imóvel e
  publicar a Página. Some quando os 5 estão feitos. Quando o WhatsApp e o Mensageiro existirem, os
  passos deles entram aqui.
- O CRECI **não** é um passo: sem ele, aparece só o aviso discreto *"Adicione seu CRECI ao perfil para
  que ele apareça nos anúncios"*, com o atalho **Ajustes › Conta** (o CRECI jurídico da conta também vale).
- Nas contas de teste ainda sem contatos, o convite para **Gerar dados de demonstração**.

**No centro**, a **fila do dia** em cartões, na ordem do mais urgente, com cada cliente uma vez só
(no motivo mais urgente):

1. **Quentes sem resposta**: quente e mais de um dia sem contato.
2. **Abordagens atrasadas**: o prazo do playbook passou.
3. **Visitas de hoje e amanhã**.
4. **Próximos passos vencidos**.

Cada cartão traz o tipo (Quente, Atrasada, Visita, Próximo passo), a temperatura, o nome, o motivo em
uma linha e **um** botão, com no máximo uma ação a mais no "Mais":

| Tipo | Botão | No "Mais" |
|---|---|---|
| Quente | **Fazer agora** (abre a ficha com a mensagem sugerida) | — |
| Atrasada | **Fazer agora** (abre a ficha com a mensagem sugerida) | **Fiz**: registra a abordagem feita |
| Visita | **Abrir** (a ficha do cliente) | **Visita feita** |
| Próximo passo | **Abrir** (a ficha do cliente) | — |

Aparecem 8 cartões; o resto fica em **Mais N para depois**. O WhatsApp abre na ficha, no clique do
**Fazer agora** de lá: Hoje e a visão Funil só levam até a mensagem pronta (e ela só é gerada se o contato
tiver abordagem). Fila vazia mostra "Nada urgente agora" e o botão **Cadastrar um cliente**.

**À direita:**

- **Agenda de hoje**: o que está pendente hoje, por horário, até 20 compromissos. **Ver agenda** troca o centro pela lista
  dos próximos 14 dias (ver [Clientes, negócios e agenda](clientes-e-agenda.md#agenda)), e **Voltar
  para a fila** desfaz. O endereço `/agenda` abre Hoje direto na agenda.
- **Sua semana**: contatos novos, leads e visitas feitas nos últimos 7 dias, e a comissão prevista.
- **Dica do Assistente**: uma sugestão a partir do que está na tela (os quentes sem resposta, as
  abordagens atrasadas ou o primeiro passo ainda não feito dos Primeiros passos; sem nada disso, a dica é "Nada urgente agora…"), com **Perguntar ao Assistente**. Quando a IA não
  está liberada, o botão fica desligado com "IA indisponível agora", e uma faixa no alto do centro
  avisa; o resto de Hoje funciona.

Tudo vem numa chamada só (`GET /inicio`), relida a cada vez que você entra em Hoje ou troca de conta. Ao trocar de conta, Hoje mostra
"carregando" até chegarem os dados da conta nova (nada da conta anterior fica na tela); se a
releitura falhar, aparece o erro com **Tentar de novo** no lugar dos dados; se a resposta for 403 ou 404, aparece **Não encontrado**.

As passagens do atendimento automático, as peças aguardando aprovação e os frios que reagiram a um
envio entram na fila com o WhatsApp, com o Estúdio e com os envios rastreados.
