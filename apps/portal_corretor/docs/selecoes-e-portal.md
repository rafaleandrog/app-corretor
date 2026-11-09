---
titulo: Seleções e Portal do Cliente
descricao: Seleção de imóveis que o cliente abre pelo link e marca gostei, não gostei, quero visitar, conversar sobre o preço ou comenta, e o portal do cliente (Meu atendimento) com o próximo passo e as abas Conversa, Imóveis, Agenda e Propostas (ou Arquivos).
---

# Seleções e Portal do Cliente

O cliente não precisa de login: ele abre tudo por um **link pessoal**, que funciona como chave.
O corretor pode revogar o link quando quiser. Seleção e portal são pensados para o celular.

## Seleção de imóveis

Na ficha do cliente, na aba **Negócios**, o cartão **Seleções** tem o botão **+** (Nova seleção), que abre a montagem
(o mesmo que **Liberar item**, no cartão Portal do cliente). Em [Conversas](conversas.md), o botão **Seleção** abre a
mesma montagem com os imóveis que combinam com o perfil de busca já marcados, envia o link na conversa e abre o WhatsApp:

1. Dê um título e, se quiser, uma mensagem.
2. Escolha de 1 a 12 imóveis da carteira. Só aparecem imóveis **ativos ou reservados com
   autorização de venda vigente**. Não precisam estar marcados para a Página.
3. **Criar e enviar** copia a mensagem com o link, pronta para colar no WhatsApp.

O link tem a forma `https://<instância>/portal_corretor/s?t=<chave>` (sem endereço público configurado na instância,
a ficha e a Conversa completam o link com o endereço em que você está). Criada a seleção, ela vale mesmo que um
passo seguinte (o registro na conversa, por exemplo) falhe: o link volta para você do mesmo jeito, sem criar outra. Vale pelo prazo de
"validade da seleção enviada" de Ajustes › Horário de atendimento (14 dias, se você não mudar).

No topo, o cliente vê o seu nome, o CRECI (só se cadastrado), o botão de WhatsApp e a sua
foto (sem foto, as suas iniciais), na cor principal da
sua marca ([Ajustes › Conta e marca](conta-e-ajustes.md#a-marca)). Mudar a cor ou a foto na marca muda as
seleções válidas e os portais já enviados, sem mandar link novo.

Logo abaixo do topo, em destaque, a data até quando a seleção vale.

Cada imóvel é um cartão pensado para o celular, com a foto baixa (as fotos passam de lado) para o
preço e as reações ficarem perto:
- o **título do imóvel**; embaixo, numa linha, o bairro (só se o título ainda não o cita), a área,
  os quartos e as vagas ("Jardim Botânico · 320 m² · 4 qts · 3 vagas"); o **preço** logo abaixo; a
  descrição abre num toque;
- os botões **Gostei**, **Não gostei**, **Quero visitar**, **Conversar sobre o preço** e **Comentar**.

**Comentar** abre um campo (até 300 letras). O comentário vai junto com a reação já dada e
aparece na linha do tempo, por exemplo "Gostou do IM-0001: a cozinha é pequena (seleção
"Casas")". Sem reação ainda, a seleção avulsa pede antes o Gostei ou o Não gostei; no portal,
o comentário vai como mensagem ao corretor, citando o imóvel.

Os ícones de quartos, área e vagas são os mesmos na sua página e na ficha pública do imóvel
([Página](minha-pagina.md)). Lá a foto fica menor: na página, em grade; na ficha, as fotos
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
- **Conversar sobre o preço** cria a tarefa "Conversar sobre o preço: IM-0001 · título" (também
  sem repetir) e, com o momento marcado em Ajustes › Negociador, faz o Negociador entrar na
  negociação daquele imóvel (ver
  [Quando o Negociador entra](negociacao.md#quando-o-negociador-entra)). O cliente vê "Recebido. O
  corretor vai falar com você sobre o preço deste imóvel".

**Copiar** gera de novo a mensagem com o link. **Revogar** faz o link parar de abrir, e a
seleção sai do portal. A ficha mostra cada seleção como válida (com a data limite), vencida ou
revogada.

O envio da seleção entra em **Enviados ao cliente**, no histórico e na conversa do cliente (o cartão
da seleção, com o link).

## Portal do Cliente

Na ficha do cliente, à direita, o cartão **Portal do cliente** mostra se há link ativo, quando
foi gerado e o **último acesso**: a última vez que o cliente agiu pelo portal (mensagem, pedido de
remarcar, pendência feita, oferta ou aceite); abrir a página sem agir não conta, porque a página
pública não grava nada. **Gerar link do portal** cria o link do cliente (`…/portal_corretor/c?t=<chave>`) e
copia uma mensagem pronta. Há **um link por cliente**: **Reenviar link** copia de novo a mensagem
com o mesmo link. **Liberar item** monta uma seleção nova, que o cliente vê no portal. O link não
vence. **Revogar** faz ele parar de abrir, e um novo pode ser gerado depois. O portal abre por link,
sem login.

O portal se chama **Meu atendimento** e é curado por você (o modelo do Compass One), pensado
para o celular:

- **Topo** baixo: "Meu atendimento", o seu nome (o da Página, se houver) e o CRECI só se você tiver
  preenchido, o botão **WhatsApp** e a sua foto (sem foto, as iniciais), na cor da marca.
- **Próximo passo**, logo abaixo, numa faixa na cor da marca com o botão **Ver**, que leva à aba
  certa. Vale, nesta ordem: o texto que você escreveu para o cliente (ver abaixo); uma proposta do
  vendedor esperando a resposta dele ("Proposta do vendedor aguardando sua resposta" → Propostas);
  a próxima visita ("Visita sábado às 10 h" → Agenda); a seleção que vence em até 3 dias ("Sua
  seleção vale até 20 de novembro" → Imóveis); os imóveis ainda sem reação ("2 imóveis esperando
  sua opinião" → Imóveis). Sem nada disso, a faixa não aparece.
- **Quatro abas**, que cabem na largura do celular: **Conversa · Imóveis N · Agenda N · Propostas
  N**. Sem negociação, a quarta aba é **Arquivos**. A aba fica no endereço (`…#imoveis`), então o
  cliente volta para a mesma aba ao recarregar.

| Aba | O que tem |
|---|---|
| Conversa | A conversa com você, como num aplicativo de mensagens: as mensagens que você mandou para o cliente, à esquerda, e as dele, à direita, com a hora (a hora do dia da sua conta, igual em qualquer celular; mensagem de outro dia mostra também o dia da semana). Um imóvel enviado aparece como cartão (foto, título, dados e preço, sem texto ao lado) com **Gostei · Quero visitar** quando ele está numa seleção válida do cliente; a seleção enviada aparece como "Separei 3 imóveis para você" com **Ver imóveis**. O que o cliente vê e o que nunca vê está logo abaixo da tabela. No pé da tela fica o campo **Escreva para o <seu primeiro nome>**, de uma linha, com o botão de enviar: a mensagem aparece na hora, entra na sua conversa com o cliente em [Conversas](conversas.md), na linha do tempo e vira a tarefa "Responder a mensagem do portal". Mostra as 40 mensagens mais recentes |
| Imóveis | No alto, o recado das seleções válidas. Só entra seleção que tem título ou mensagem (a que não tem nenhum dos dois não aparece, nem que traga imóveis novos). Com **uma só**, o bloco se chama **Sua seleção**, ou leva o título dela, se tiver, e mostra a mensagem. Com **várias**, o bloco se chama **Suas seleções** e lista cada uma, da mais recente para a mais antiga (pela data de envio), com o seu título e a sua mensagem (cada uma só com o que tem). Sem nenhuma, o bloco some. Depois, o imóvel em **destaque**, com o nome da seleção a que pertence (só quando há várias seleções no recado e ela tem título), no cartão descrito acima (foto um pouco mais alta), com o selo **Visita sáb.** quando há visita marcada a ele. Embaixo, **Outros imóveis**, cada um com a miniatura, o bairro, o preço e a reação dada ("Gostei", "Sem reação"); um toque põe o imóvel no destaque. Por fim, **O que falta de você**: as pendências que você pediu, cada uma com o botão **Feito** (só aparece se houver alguma). O número da aba conta os imóveis das seleções válidas, sem repetir o mesmo imóvel |
| Agenda | As visitas marcadas, por dia, com hora e imóvel. Um dia com mais de uma visita vira um **roteiro**: as paradas numeradas na ordem do horário e o link **Ver o roteiro no mapa**, com o trajeto todo. O dia e a hora de cada visita saem no **horário da sua conta** (o mesmo que você vê no app), não no do celular do cliente: quem abre o portal em outra cidade ou país vê "sábado às 10 h" igual a você. O mesmo vale para o "Visita sábado às 10 h" do **Próximo passo**, o selo de visita no imóvel, a divisão por dia do roteiro e as datas da **Sua jornada**. Em cada visita, **Como chegar** (abre o mapa do celular com a rota), **Adicionar ao calendário** (arquivo que abre no calendário do celular, que mostra a hora no fuso do próprio celular) e **Pedir para remarcar**. O mapa só usa o que o imóvel mostra em público: com o endereço publicado, a rota vai até ele; só com o bairro, o botão vira **Ver o bairro no mapa**; publicado só como região, não há mapa. Embaixo, **Sua jornada**: uma linha do tempo, da mais recente para a mais antiga, com cada seleção recebida ("Recebeu 3 imóveis: Casas no Noroeste"), cada visita feita, cada pendência resolvida e, embaixo, o começo. O número da aba, o **Próximo passo** e o selo de visita usam o mesmo critério: visita que ainda vai acontecer ou que começou há até 1 hora (para a visita em andamento não sumir) |
| Propostas | Ver [Propostas](#propostas), abaixo. O número conta as negociações do cliente, como as outras abas contam os seus itens |
| Arquivos | Só sem negociação. Ainda sem arquivos (D-73): a aba avisa que, por enquanto, os documentos chegam pelo WhatsApp. O número fica em 0 |

**O que o cliente vê na Conversa.** Só o que ele mesmo escreveu e o que você mandou **por escrito**
para ele:
- as mensagens dele (pelo portal ou pelo WhatsApp);
- as suas que saíram pelo WhatsApp do celular (o botão de enviar da Conversa, a seleção, a
  confirmação de visita) ou pelo portal;
- o **cartão do imóvel** que você registrou em **Registrar envio**: foto, título, dados e preço, sem
  nenhum texto ao lado. O cartão da seleção ("Separei 3 imóveis para você") também vai sem texto livre.

O Negociador não escreve na Conversa: o que ele propõe ao cliente aparece como proposta, na aba
[Propostas](#propostas).

**O que o cliente nunca vê:**
- o que você só **registrou** (cliente sem WhatsApp cadastrado, "só registrar", abordagem por ligação,
  visita ou e-mail, envio presencial): é anotação sua, não mensagem entregue;
- o **Detalhe** que você escreve em **Registrar envio**, nem quando o envio foi pelo WhatsApp: é a sua
  anotação do que mandou pelo seu celular. De um envio registrado, só o cartão do imóvel aparece. Um
  envio de arquivo, de localização ou de mensagem fica só com você;
- mensagem cujo envio **falhou**;
- avisos internos: "Mensageiro passou para você", "Negociação aberta", as reações às seleções e o
  recado da oferta fora do esperado ("Pelo portal, o cliente tentou ofertar…"), que é só para você;
- o próprio link do portal, o link rastreado e os dados internos do imóvel.

**A conversa no portal.** Essas mensagens ficam guardadas na versão pública do portal do cliente,
que só abre com o link (a chave) dele: é a única informação pessoal ali, numa exceção decidida pelo
dono (D-132). Remover o cliente ou revogar o link tira tudo do ar na hora.

### Propostas

Uma negociação por imóvel (a perdida some do portal), com o momento dela ("Sua vez de responder",
"Com o corretor", "Aguardando a decisão do proprietário", "Negócio fechado", "Pausada") e as rodadas
numa linha do tempo: as ofertas do cliente (só o valor e a data) e as propostas do vendedor que
foram enviadas a ele, com condições, concessão, contrapartida e validade. Abaixo, três botões:
- **Aceitar condição** (só na última proposta do vendedor, dentro da validade): pede confirmação
  ("Aceitar R$ 1.460.000?") e avisa que **aceitar não fecha o negócio** — você confirma com ele e
  com o proprietário;
- **Fazer nova oferta:** o cliente digita o valor em reais (por exemplo, 1.380.000). Um valor
  muito baixo (menos de R$ 10 mil ou de metade do preço pedido) é quase sempre erro de digitação:
  o portal pergunta "Você quis dizer R$ 1.350.000?" e envia o valor corrigido só se o cliente
  confirmar. Se um valor assim chegar mesmo assim, o app recusa com a mesma pergunta, **não grava a
  oferta, não gasta rodada do mandato nem chama o Negociador**; você recebe só um recado na conversa
  ("Pelo portal, o cliente tentou ofertar R$ 1.350,00; a oferta não foi registrada");
- **Mensagem ao corretor:** abre um campo de texto ali mesmo, na negociação. A mensagem vai pelo mesmo
  caminho da aba Conversa (e, no app, entra em **Conversas**, ver [Conversas](conversas.md)) e já cita o imóvel ("Sobre a negociação do imóvel …"), então o corretor
  sabe de qual negociação se trata. Se o cliente pede desconto ou fala de preço, o Negociador entra
  nessa negociação (ver [Quando o Negociador entra](negociacao.md#quando-o-negociador-entra)).

Ao abrir a confirmação do aceite ou a nova oferta, o cursor já vai para ela. Depois de uma oferta ou
de um aceite, o portal se atualiza sozinho algumas vezes por cerca de um minuto, para mostrar a
resposta assim que ela chegar.

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
  só os membros da conta os veem. `acao_cliente_recebida` leva também o `valor_c` da oferta; já
  `proposta_aceite_cliente` e `proposta_recebida` publicam só ids (a negociação e a proposta).
  O `valor_c` sai do registro do webhook (só o registro; o evento segue com ele). Se o link do
  portal for revogado antes de a oferta ou o aceite ser processado, o pedido é descartado.
  O `comentario` da reação e o `texto` da mensagem vão no evento (nascem no webhook, que ainda não
  grava na conta) e todo membro da conta os lê, inclusive um negociador convidado: risco residual
  documentado em Negociação e mandato › Negociador humano.
- **Páginas públicas:** `/portal_corretor/s` (seleção) e `/portal_corretor/c` (portal).
