---
titulo: Funil, temperatura e fila do dia
descricao: Quadro do funil, temperatura do contato com motivo, abordagens recomendadas e a fila do dia no Início.
---

# Funil, temperatura e fila do dia

## Funil: Clientes › Quadro

O funil é a visão **Quadro** de **Clientes** (o botão **Quadro**, ao lado de **Lista**, no alto
da tela). Ele mostra os negócios em quadro, uma coluna por etapa, com o nome do cliente, o título,
o valor, a temperatura e o aviso de **abordagem atrasada**. O endereço antigo `/funil` continua
abrindo o quadro.

- Arraste o cartão para mudar de etapa. Ao soltar em **Perdido**, o app pergunta o motivo; sem
  motivo, o cartão volta.
- Toque no cartão para abrir a ficha do cliente. No cartão com **abordagem atrasada**, a ficha abre
  já com a mensagem sugerida, pronta para o **Fazer agora** (ver
  [Próxima abordagem](#próxima-abordagem)).
- Filtros: funil (compra ou venda e captação), temperatura e "sem contato há" 3, 7, 15, 30 ou 90
  dias (as mesmas opções da Lista). Ficam no endereço da página.
- Ganhos e perdidos ficam no quadro por 30 dias; os em andamento ficam sempre.

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

## Início: Hoje e Agenda

No topo do Início, a **faixa da semana**: contatos novos, leads e visitas feitas nos últimos 7 dias
e a comissão prevista. Abaixo, duas abas.

**Hoje** é a fila do dia: o que precisa de você agora, em grupos nesta ordem, com cada cliente uma
vez só (no motivo mais urgente):

1. **Quentes sem resposta**: quente e mais de um dia sem contato.
2. **Abordagens atrasadas**: o prazo do playbook passou.
3. **Visitas de hoje e amanhã**.
4. **Próximos passos vencidos**.

Cada item traz o nome, a temperatura, o motivo em uma linha e **um** botão:

| Grupo | Botão | No "Mais" |
|---|---|---|
| Quentes sem resposta | **Fazer agora** (abre a ficha com a mensagem sugerida) | — |
| Abordagens atrasadas | **Fazer agora** (abre a ficha com a mensagem sugerida) | **Fiz**: registra a abordagem feita |
| Visitas | **Abrir** (a ficha do cliente) | **Visita feita** |
| Próximos passos vencidos | **Abrir** (a ficha do cliente) | — |

O WhatsApp abre na ficha, no clique do **Fazer agora** de lá: o Início e o quadro só levam até a
mensagem pronta (e ela só é gerada se o contato tiver abordagem).

Fila vazia mostra "Nada urgente agora" e o botão **Ver a agenda**.

**Agenda** é a lista dos próximos 14 dias (ver [Clientes, negócios e agenda](clientes-e-agenda.md#agenda)).
Ela só carrega quando você abre a aba. O endereço `/agenda` abre o Início direto nessa aba.

Os banners "complete a conta" (o nome da conta e o seu telefone) e, nas contas de teste, "gerar
dados de demonstração" aparecem acima da faixa enquanto valem. O CRECI é opcional e não entra nos
primeiros passos: sem ele, aparece só o aviso discreto *"Adicione seu CRECI ao perfil para que ele
apareça nos anúncios"*, com o atalho **Ajustes › Conta**. Empreendimentos fica na aba de mesmo nome em **Imóveis**.

As passagens do atendimento automático, as peças aguardando aprovação e os frios que reagiram a um
envio entram na fila com o WhatsApp, com o Estúdio e com os envios rastreados.
