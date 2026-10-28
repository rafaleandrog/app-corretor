---
titulo: Assistente do Corretor
descricao: O chat que abre à direita de qualquer tela — tira dúvidas pelo manual do app, ajuda a decidir quem atender e cria lembretes ou agenda peças, sempre com a sua confirmação.
---

# Assistente do Corretor

O **Assistente** abre um chat **na coluna da direita da tela em que você está**: a tela continua ali, e
**Fechar**, no topo do chat, o tira da coluna. Em **Números**, já no desenho novo, a lista e o centro ficam como estavam. Nas demais telas, a tela recarrega ao abrir e ao fechar o Assistente. Ele não está mais no menu:
- Nas telas no desenho novo (hoje, **Números**), é o botão **Assistente** no fim do trilho, à esquerda.
- Nas demais, é o botão **Assistente** no alto da tela, ao lado de **Criar**.
- O endereço antigo `/assistente` abre **Hoje** com o Assistente aberto.

Dá para perguntar por escrito ou ditar pelo microfone, quando a transcrição de voz estiver liberada.
- Ele responde pensando na tela em que você está.
- Se você trocar de tela, ele continua aberto, com a mesma conversa, enquanto o app estiver aberto.
- Quando a IA não está liberada para o app, o topo do chat avisa "IA indisponível agora" e ele responde com os artigos do manual.

## O que ele responde

| Pergunta | Exemplo | De onde vem a resposta |
|---|---|---|
| **Como usar o app** | "como conecto meu Instagram?", "dá para mandar uma seleção para o cliente?" | Deste manual (os artigos da documentação do app) e do que já está ligado na sua conta |
| **Quem atender** | "quem eu atendo primeiro hoje?" | Da fila do dia de Hoje, com o motivo de cada um |
| **Sobre um cliente** | "esse cliente vale insistir?" | Da ficha do cliente: temperatura, último contato, próximo passo, perfil de busca e histórico recente |

**A resposta:**
- Diz em que artigo do manual se baseou e tem o link **abrir a documentação**.
- Quando é algo que se faz numa tela, mostra o botão **Abrir** com o nome da tela.
- Se o manual não cobre o assunto, ele diz que não sabe e sugere falar com a equipe da plataforma
  que deu o seu acesso. Ele não inventa funcionalidade.

Na ficha do cliente, o item **Perguntar ao Assistente** do menu **Mais** abre o Assistente já sobre aquele cliente.
Abrir o Assistente com a ficha de um cliente na tela também o leva junto. O nome dele aparece no topo, e **Tirar** volta à conversa geral.

## O que ele faz, com confirmação

| Pedido | Exemplo | O que acontece no "Confirmar" |
|---|---|---|
| **Lembrete ou tarefa** | "me lembra de ligar para a Ana amanhã às 10h" | Cria a atividade (tarefa, ligação, mensagem ou retorno) na sua Agenda, ligada ao cliente quando é sobre um cliente da fila do dia ou da ficha aberta |
| **Agendar uma peça** | "agenda o post da casa do Lago para sexta às 18h" | Agenda a peça aprovada do Estúdio para publicar no Instagram, como em [Estúdio › Publicar](estudio.md) |

Antes de fazer, o Assistente mostra **Posso fazer isto?** com o que vai acontecer, escrito pelo
próprio app: a data e a hora conferidas e o cliente ou a peça encontrados. Nada acontece até você
clicar em **Confirmar**. Em **Agora não**, nada é feito. As mesmas regras das telas valem aqui: por
exemplo, agendar só de 5 minutos a 90 dias à frente, com o Instagram conectado.

**O que ele nunca faz:**
- mandar mensagem a cliente;
- mudar preço, proposta, comissão ou autorização;
- apagar algo.

Para esses casos, ele explica onde você mesmo faz.

## Sem IA

Se a IA do Assistente não estiver liberada pelo administrador, ou não responder naquela hora, o chat
vira uma **busca no manual**. Ele mostra os artigos mais próximos da sua pergunta. As ações e as
decisões precisam da IA.

## Privacidade

A IA recebe:
- a pergunta e as últimas mensagens da conversa;
- a tela em que você está e um resumo da conta (se há CRECI cadastrado, que é opcional, Instagram
  conectado, página publicada, totais);
- a fila do dia (nome, temperatura e motivo);
- os títulos das peças do Estúdio;
- os trechos do manual ligados à pergunta.

Sobre um cliente em foco, vão a temperatura, o perfil de busca e os resumos do histórico.
- **Telefone e e-mail não vão.** Nem as colunas, nem os números e endereços escritos em notas ou na
  mensagem do formulário: o app troca esses trechos por "[telefone]" e "[e-mail]".
- Cliente anonimizado não entra.

O **Resumir** e a **Mensagem sugerida** da ficha do cliente seguem as mesmas regras: vão para a IA
a temperatura, o próximo passo, o perfil de busca e os resumos do histórico, com telefone e e-mail
trocados por "[telefone]" e "[e-mail]". A Mensagem sugerida leva ainda o texto da abordagem do
playbook, o canal, a etapa e o prazo, também com telefone e e-mail trocados. O resumo só aparece na tela: não é gravado na ficha.

O que vem de outras pessoas (o nome e a mensagem de quem preencheu o formulário, por exemplo) é
tratado como dado, não como ordem. A resposta da IA aparece sem imagens nem links. O único link é o
da documentação, posto pelo app.
