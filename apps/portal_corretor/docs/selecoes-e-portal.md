---
titulo: Seleções e Portal do Cliente
descricao: Seleção de imóveis que o cliente abre pelo link e marca gostei, não gostei ou quero visitar, e o portal do cliente com o próximo passo, as datas, as seleções, as visitas, o que falta do cliente, a jornada e um espaço para falar com o corretor.
---

# Seleções e Portal do Cliente

O cliente não precisa de login: ele abre tudo por um **link pessoal**, que funciona como chave.
O corretor pode revogar o link quando quiser. Seleção e portal são pensados para o celular.

## Seleção de imóveis

Na ficha do cliente, em **Seleções e portal**, o botão **Nova seleção** abre a montagem:

1. Dê um título e, se quiser, uma mensagem.
2. Escolha de 1 a 12 imóveis da carteira. Só aparecem imóveis **ativos ou reservados com
   autorização de venda vigente**. Não precisam estar marcados para a Minha página.
3. **Criar e enviar** copia a mensagem com o link, pronta para colar no WhatsApp.

O link tem a forma `https://<instância>/portal_corretor/s?t=<chave>`. Vale pelo prazo de
"validade da seleção enviada" de Ajustes › Atendimento (14 dias, se você não mudar).

No topo, o cliente vê o seu nome, o CRECI, o botão de WhatsApp e a sua foto, na cor principal da
sua marca ([Ajustes › Marca](conta-e-ajustes.md#a-marca)). Mudar a cor ou a foto na marca muda as
seleções válidas e os portais já enviados, sem mandar link novo.

Logo abaixo do topo, em destaque, a data até quando a seleção vale.

Cada imóvel é um cartão de **foto grande** (as fotos passam de lado), pensado para o celular:
- preço em destaque, bairro e cidade, e ícones de quartos, área e vagas; a descrição abre num toque;
- três botões grandes: **Gostei**, **Não gostei** e **Quero visitar**.

Os ícones de quartos, área e vagas são os mesmos na sua página e na ficha pública do imóvel
([Minha página](minha-pagina.md)). Lá a foto fica menor: na página, em grade; na ficha, as fotos
passam de lado. O cartão de foto grande é o da seleção e o do portal.

O que nunca aparece: proprietário, comissão, documentos e endereço além do que o imóvel libera em
"endereço público". A seleção **acompanha o anúncio**: preço, fotos e descrição atualizam sozinhos,
e o imóvel que deixa de estar anunciado sai da seleção. Isso vale para imóvel vendido, retirado,
removido ou com a autorização vencida. Se nenhum imóvel restar, o cliente vê um aviso para falar
com o corretor.

**Quando o cliente reage:**
- a reação aparece na ficha, ao lado do código do imóvel;
- entra na linha do tempo, por exemplo "Gostou do IM-0001 (seleção "Casas")". Mudar de ideia
  vale a última escolha;
- conta como contato com o cliente, e a temperatura é recalculada;
- **Quero visitar** cria a tarefa "Marcar visita: IM-0001 · título", sem repetir se ela já
  estiver pendente.

**Copiar** gera de novo a mensagem com o link. **Revogar** faz o link parar de abrir, e a
seleção sai do portal. A ficha mostra cada seleção como válida (com a data limite), vencida ou
revogada.

O envio da seleção entra em **Tudo que você mandou** e na linha do tempo.

## Portal do Cliente

Na mesma área da ficha, **Gerar link do portal** cria o link do cliente
(`…/portal_corretor/c?t=<chave>`) e copia uma mensagem pronta. Há **um link por cliente**: clicar
de novo copia o mesmo link. O link não vence. **Revogar** faz ele parar de abrir, e um novo pode
ser gerado depois.

O portal é uma página só, curada por você (o modelo do Compass One). De cima para baixo:

| Parte | O que tem |
|---|---|
| Topo | O nome do corretor (o da Minha página, se houver), a foto, o CRECI e o botão de WhatsApp, na cor da marca. Embaixo, o **próximo passo para o cliente**, se você escreveu um |
| Datas | Em destaque: a **próxima visita** (dia e hora, e quanto falta: hoje, amanhã ou em N dias) e até quando a **seleção vale** (a que vence primeiro) |
| O que falta de você | As pendências que você pediu, cada uma com o botão **Feito** (só aparece se houver alguma) |
| Suas visitas | As visitas marcadas, por dia, com hora e imóvel. Um dia com mais de uma visita vira um **roteiro**: as paradas numeradas na ordem do horário e o link **Ver o roteiro no mapa**, com o trajeto todo. Em cada visita, **Como chegar** (abre o mapa do celular com a rota), **Adicionar ao calendário** (arquivo que abre no calendário do celular) e **Pedir para remarcar**. O mapa só usa o que o imóvel mostra em público: com o endereço publicado, a rota vai até ele; só com o bairro, o botão vira **Ver o bairro no mapa**; publicado só como região, não há mapa |
| Imóveis para você | As seleções válidas, em cartões de foto grande, com as reações, que o cliente pode mudar dali mesmo |
| Fale com o corretor | Uma mensagem livre |
| Sua jornada | Uma linha do tempo, da mais recente para a mais antiga: cada seleção recebida ("Recebeu 3 imóveis: Casas no Noroeste"), cada visita feita ("Visitou Apto com varanda, Noroeste"), cada pendência resolvida e, embaixo, o começo |

### Próximo passo para o cliente

Na ficha, em **Dados e próximo passo**, o botão **Definir próximo passo** tem o campo **Para o
cliente** (opcional, até 120 letras). O que você escrever ali aparece no topo do portal, por
exemplo "Visita sábado às 10h". Deixar vazio tira do portal. O próximo passo de cima, o seu, é
nota interna: nunca vai ao portal. Mudar o texto entra na linha do tempo.

### O que falta de você

Na ficha, em **Seleções e portal**, o botão **Pedir ao cliente** cria uma pendência para ele, por
exemplo "confirmar a visita" ou "enviar a documentação" (até 20 abertas por cliente). Ela entra na
linha do tempo ("Pediu ao cliente: …") e aparece no portal.

Quando o cliente toca em **Feito**:
- a pendência sai do portal;
- na ficha, ela fica marcada "feito em …";
- a linha do tempo ganha "Marcou como feito no portal: …", e conta como contato com o cliente;
- a jornada do portal ganha "Feito: …".

A conferência é feita quando o aviso chega ao app, e não no envio pelo portal: se a pendência
não for deste cliente ou já estiver feita, nada muda.

O ícone de lixeira ao lado de cada pendência a remove: ela sai da ficha e do portal.

**O que o cliente manda pelo portal:**
- **Mensagem:** entra na linha do tempo ("Mensagem pelo portal: …") e cria a tarefa "Responder
  a mensagem do portal".
- **Pedido para remarcar:** entra na linha do tempo com o horário que ele sugeriu e cria a
  tarefa "Remarcar visita: …". A visita em si só muda quando o corretor muda.

- **Pendência feita:** como acima, em [O que falta de você](#o-que-falta-de-você).

O portal acompanha o app: marcar, mudar ou cancelar uma visita, registrar o retorno, enviar ou
revogar uma seleção, mudar o próximo passo para o cliente e pedir ou remover uma pendência
atualiza o que o cliente vê. "Imóveis recebidos" conta tudo o que foi enviado e
não revogado, mesmo em seleções já vencidas.

**Cliente removido:** ao remover o contato, o portal e as seleções dele são revogados na hora e
param de abrir.

**Privacidade (D-73):** o portal não guarda nem mostra o nome, o telefone ou o e-mail do cliente.
Ele mostra só o que o corretor mandou e as datas das visitas. Das visitas, a jornada mostra o
imóvel do jeito do anúncio, nunca o título que você deu à visita na agenda. Quem tiver o link vê o portal, por
isso o corretor o envia só ao cliente e o revoga se ele for parar em outras mãos.

## Proteções

- **Links:** cada link é uma chave da plataforma (o "ingresso" de webhook). A rota pública só
  abre se a chave for válida, não estiver vencida e não tiver sido revogada.
- **Limites por endereço de internet e por minuto:** 30 reações por seleção e 5 ações no portal.
- **Registro de chamadas da plataforma:** o texto que o cliente escreve (mensagem, pedido de
  remarcar) nunca fica lá. Na pendência marcada como feita, só vai o número dela. O registro
  chega ao app pelos eventos da conta, que só os membros da conta leem, e fica guardado pelo
  prazo de retenção de eventos da instância, como no formulário da página (D-70).
- **Contas:** a conta vem sempre da chave, nunca do que o navegador manda. Uma reação ou pedido
  só vale para a seleção, o imóvel, a visita ou a pendência do próprio cliente; o resto é ignorado.
- **Links guardados:** o link de cada seleção e do portal fica guardado no app, para o corretor
  copiar de novo. Quem lê é só o corretor da conta. Para cortar um link, use **Revogar**.

## Para o administrador da instância

- **Webhooks:** o app declara mais dois. Ficam em Configurações da app › Webhooks:
  - `reacao_selecao`: um endereço por seleção, com validade;
  - `acao_cliente`: um endereço por cliente. Leva o `tipo` (`mensagem`, `remarcar` ou
    `tarefa_feita`) e, conforme o tipo, `texto`, `visita` ou `tarefa`.
- **Eventos:** `reacao_recebida` e `acao_cliente_recebida` são da conta: só os membros da conta
  os veem.
- **Páginas públicas:** `/portal_corretor/s` (seleção) e `/portal_corretor/c` (portal).
