---
titulo: Seleções e Portal do Cliente
descricao: Seleção de imóveis que o cliente abre pelo link e marca gostei, não gostei, quero visitar ou comenta, e o portal do cliente (Meu atendimento) com o próximo passo e as abas Conversa, Imóveis, Agenda e Arquivos.
---

# Seleções e Portal do Cliente

O cliente não precisa de login: ele abre tudo por um **link pessoal**, que funciona como chave.
O corretor pode revogar o link quando quiser. Seleção e portal são pensados para o celular.

## Seleção de imóveis

Na ficha do cliente, na aba **Negócios**, o cartão **Seleções** tem o botão **+** (Nova seleção), que abre a montagem:

1. Dê um título e, se quiser, uma mensagem.
2. Escolha de 1 a 12 imóveis da carteira. Só aparecem imóveis **ativos ou reservados com
   autorização de venda vigente**. Não precisam estar marcados para a Minha página.
3. **Criar e enviar** copia a mensagem com o link, pronta para colar no WhatsApp.

O link tem a forma `https://<instância>/portal_corretor/s?t=<chave>`. Vale pelo prazo de
"validade da seleção enviada" de Ajustes › Atendimento (14 dias, se você não mudar).

No topo, o cliente vê o seu nome, o CRECI (só se cadastrado), o botão de WhatsApp e a sua
foto (sem foto, as suas iniciais), na cor principal da
sua marca ([Ajustes › Marca](conta-e-ajustes.md#a-marca)). Mudar a cor ou a foto na marca muda as
seleções válidas e os portais já enviados, sem mandar link novo.

Logo abaixo do topo, em destaque, a data até quando a seleção vale.

Cada imóvel é um cartão de **foto grande** (as fotos passam de lado), pensado para o celular:
- preço em destaque, bairro e cidade, e ícones de quartos, área e vagas; a descrição abre num toque;
- botões grandes: **Gostei**, **Não gostei**, **Quero visitar** e **Comentar**.

**Comentar** abre um campo (até 300 letras). O comentário vai junto com a reação já dada e
aparece na linha do tempo, por exemplo "Gostou do IM-0001: a cozinha é pequena (seleção
"Casas")". Sem reação ainda, a seleção avulsa pede antes o Gostei ou o Não gostei; no portal,
o comentário vai como mensagem ao corretor, citando o imóvel.

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

O envio da seleção entra em **Enviados ao cliente** e no histórico.

## Portal do Cliente

Na ficha do cliente, à direita, o cartão **Portal do cliente** mostra se há link ativo e quando
foi gerado. **Gerar link do portal** cria o link do cliente (`…/portal_corretor/c?t=<chave>`) e
copia uma mensagem pronta. Há **um link por cliente**: **Reenviar link** copia de novo a mensagem
com o mesmo link. O link não vence. **Revogar** faz ele parar de abrir, e um novo pode ser gerado
depois. O portal abre por link, sem login.

O portal se chama **Meu atendimento** e é curado por você (o modelo do Compass One). No topo
ficam o nome do corretor (o da Minha página, se houver), a foto (sem foto, as iniciais), o CRECI
só se você tiver preenchido, e o botão de WhatsApp, na cor da marca. Embaixo, em destaque, o
**próximo passo para o cliente**, se você escreveu um, com o botão **Ver**: ele leva à aba Agenda
quando há visita marcada e à aba Imóveis quando não há.

Logo abaixo do topo, as abas **Conversa · Imóveis N · Agenda N · Propostas N · Arquivos N**. A aba
Propostas só aparece quando o cliente tem negociação. A aba fica no endereço (`…#imoveis`), então o
cliente volta para a mesma aba ao recarregar; no celular, a aba escolhida rola para a vista.

| Aba | O que tem |
|---|---|
| Conversa | As datas em destaque: a **próxima visita** (dia e hora, e quanto falta: hoje, amanhã ou em N dias) e até quando a **seleção vale** (a que vence primeiro). O **histórico**: uma linha do tempo, da mais recente para a mais antiga, com cada seleção recebida ("Recebeu 3 imóveis: Casas no Noroeste"), cada visita feita ("Visitou Apto com varanda, Noroeste"), cada pendência resolvida e, embaixo, o começo. O campo **Escreva para <seu nome>** e o botão **Conversar no WhatsApp** |
| Imóveis | No alto, **Suas seleções** (**Sua seleção**, se houver só uma): o título e a mensagem que o corretor escreveu em cada seleção válida que tenha um dos dois; seleção sem título nem mensagem não aparece, e a que só repete imóveis de outra aparece se tiver um dos dois. Sem nenhuma, o bloco some. Depois, o imóvel em **destaque**, com o nome da seleção a que pertence (só quando ela tem título), em cartão de foto grande (as fotos passam de lado), com o selo **Visita sáb.** quando há visita marcada a ele e os botões **Gostei · Não gostei · Quero visitar · Comentar**. Embaixo, **Outros imóveis**, cada um com a miniatura, o bairro, o preço e a reação dada ("Gostei", "Sem reação"); um toque põe o imóvel no destaque. Por fim, **O que falta de você**: as pendências que você pediu, cada uma com o botão **Feito** (só aparece se houver alguma). O número da aba conta os imóveis das seleções válidas, sem repetir o mesmo imóvel |
| Agenda | As visitas marcadas, por dia, com hora e imóvel. Um dia com mais de uma visita vira um **roteiro**: as paradas numeradas na ordem do horário e o link **Ver o roteiro no mapa**, com o trajeto todo. Em cada visita, **Como chegar** (abre o mapa do celular com a rota), **Adicionar ao calendário** (arquivo que abre no calendário do celular) e **Pedir para remarcar**. O mapa só usa o que o imóvel mostra em público: com o endereço publicado, a rota vai até ele; só com o bairro, o botão vira **Ver o bairro no mapa**; publicado só como região, não há mapa. O número da aba, o botão **Ver**, o selo de visita e a "Próxima visita" da Conversa usam o mesmo critério: visita que ainda vai acontecer ou que começou há até 1 hora (para a visita em andamento não sumir) |
| Propostas | Ver [Propostas](#propostas), abaixo. O número conta as propostas do vendedor que esperam a resposta do cliente |
| Arquivos | Ainda sem arquivos (D-73): a aba avisa que, por enquanto, os documentos chegam pelo WhatsApp. O número fica em 0 |

A Conversa não guarda as mensagens trocadas: o que o cliente escreve vai para a sua linha do
tempo, e a resposta sai pelo seu WhatsApp.

### Propostas

Uma negociação por imóvel (a perdida some do portal), com o momento dela ("Sua vez de responder",
"Com o corretor", "Aguardando a decisão do proprietário", "Negócio fechado", "Pausada") e as rodadas
numa linha do tempo: as ofertas do cliente (só o valor e a data) e as propostas do vendedor que
foram enviadas a ele, com condições, concessão, contrapartida e validade. Abaixo, dois botões:
- **Aceitar condição** (só na última proposta do vendedor, dentro da validade): pede confirmação
  ("Aceitar R$ 1.460.000?") e avisa que **aceitar não fecha o negócio** — você confirma com ele e
  com o proprietário;
- **Nova oferta:** o cliente digita o valor em reais (por exemplo, 1.380.000).

Com o acordo já com o proprietário, negociação pausada ou encerrada, os botões somem. O que acontece
depois de cada ação está em [Negociação › No Portal do Cliente](negociacao.md#no-portal-do-cliente).
O portal nunca mostra o mandato: o recuo, o alvo, a BATNA, o teto estimado do comprador nem quem
conduz.

**Link expirado:** um link revogado, trocado ou vencido (portal ou seleção) abre a tela **Link
expirado**, que pede um novo ao corretor. Se o problema for a conexão, a tela oferece **Tentar de
novo**.

### Próximo passo para o cliente

Na ficha, no cartão **Próximo passo**, o lápis (**Combinar próximo passo**) tem o campo **Para o
cliente** (opcional, até 120 letras). O que você escrever ali aparece no topo do portal, por
exemplo "Visita sábado às 10h". Deixar vazio tira do portal. O passo combinado, o seu, é
nota interna: nunca vai ao portal. Mudar o texto entra na linha do tempo.

### O que falta de você

Na ficha, na coluna da direita, no cartão **Portal do cliente**, o botão **Pedir ao cliente** (na parte
**O que falta do cliente**) cria uma pendência para ele, por
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
- **Mensagem** (pela Conversa, ou por **Comentar** num imóvel ainda sem reação): entra na linha do tempo ("Mensagem pelo portal: …") e cria a tarefa "Responder
  a mensagem do portal".
- **Pedido para remarcar:** entra na linha do tempo com o horário que ele sugeriu e cria a
  tarefa "Remarcar visita: …". A visita em si só muda quando o corretor muda.

- **Pendência feita:** como acima, em [O que falta de você](#o-que-falta-de-você).
- **Oferta e aceite de condição:** ver [Propostas](#propostas).

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
  - `acao_cliente`: um endereço por cliente. Leva o `tipo` (`mensagem`, `remarcar`,
    `tarefa_feita`, `proposta_nova` ou `proposta_aceite`) e, conforme o tipo, `texto`, `visita`,
    `tarefa`, `negociacao`, `valor_c` (a oferta, em centavos) ou `proposta`. Oferta e aceite não
    levam texto livre.
- **Eventos:** `reacao_recebida`, `acao_cliente_recebida` e `proposta_aceite_cliente` são da conta:
  só os membros da conta os veem. O aceite e a oferta do cliente publicam só ids
  (`proposta_aceite_cliente` e `proposta_recebida`: a negociação e a proposta).
- **Páginas públicas:** `/portal_corretor/s` (seleção) e `/portal_corretor/c` (portal).
