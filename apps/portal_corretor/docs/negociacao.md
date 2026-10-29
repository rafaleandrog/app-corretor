---
titulo: Negociação e mandato
descricao: As negociações de um negócio, o mandato do vendedor (o que é sigiloso e quem vê), as propostas, o Negociador IA (como decide e o que nunca faz), os ajustes e as respostas a objeções.
---

# Negociação e mandato

A partir da versão 0.1.13 o app guarda as **negociações**: a etapa em que o corretor (ou o
**Negociador**, o assistente de negociação do app) troca propostas com o comprador até um acordo.
Na versão 0.1.16 chega o **Negociador IA**: ele lê a conversa, sugere o próximo movimento e
confere cada sugestão contra o mandato antes de qualquer coisa sair. Na versão 0.1.23 chegam as
telas: **Clientes › Negociações**, o formulário do **mandato** e a aba **Negociação** na ficha do
cliente (ver [As telas da negociação](#as-telas-da-negociação)). Ajustes › Negociador chega numa
versão seguinte.

## As telas da negociação

### Clientes › Negociações

Caminho: **Clientes** → botão **Negociações** (ao lado de Funil e Lista) → escolha a negociação na
lista. O endereço é `/clientes?visao=negociacoes&item=<número da negociação>`, o mesmo das
notificações de proposta. No celular aparece uma coluna por vez; com uma negociação escolhida, abre
no centro.

**Esquerda: a lista.** Filtros: Em andamento (o que abre), Aguardando você, Negociador (as que o
Negociador conduz), Cliente, Proprietário e Encerradas. Cada linha mostra o cliente, o imóvel, a
última oferta do comprador e a diferença para o preço pedido ("R$ 1.320.000 · −9%"), o estado e
quem conduz. **Nova proposta**, no alto, abre o registro de proposta (ver abaixo).

**Centro: a negociação.**

- **Cabeçalho:** o cliente e o imóvel, o estado, a rodada ("Rodada 2 de 4"), quem conduz e a
  autonomia ("Negociador IA · pergunta antes") e até quando vale o mandato. **Assumir** passa a
  negociação para você; **Devolver ao Negociador** a devolve (só com o Negociador ligado nos ajustes).
- **Faixa da negociação:** as marcas em ordem de valor — oferta do comprador, ponto de recuo
  (sempre mascarado, "•••• (sigiloso)"), teto estimado do comprador, alvo e preço pedido — e a
  **ZOPA estimada** (a zona de possível acordo, entre o seu ponto de recuo e o teto estimado do
  comprador). Sem ZOPA, a faixa avisa. A faixa é montada com os componentes da plataforma, como
  marcas em linha; a régua desenhada espera um componente novo (pedido à plataforma).
- **Negociador sugere** (logo abaixo da faixa): a sugestão que espera você, com o valor, o texto e a
  linha de conferências ("ok: não ofereceu abaixo do ponto de recuo · ok: …"; a que barrou aparece
  como "falhou: …"). Só aparece a sugestão mais recente, e só enquanto nenhuma proposta (do comprador,
  do vendedor ou do proprietário) foi gravada depois dela; a superada some, e aprová-la ou editá-la é recusado ("Há uma sugestão ou
  proposta mais nova: peça outra sugestão."), mas descartá-la ainda pode. **Enviar** manda pelo Portal do Cliente;
  **Fazer agora** abre o WhatsApp do celular com a mensagem pronta; **Editar** muda o valor, as
  condições ou o texto (o app confere de novo e, se a edição passar do recuo ou revelar o sigilo,
  não envia e diz o motivo); **Descartar** descarta. Sugestão bloqueada pelas regras só sai
  editada. Sem sugestão, **Pedir sugestão** chama o Negociador (com a IA fora do ar, o botão
  desliga e você segue à mão).
- **Escada de propostas:** cada proposta numa linha — rodada, quem, valor, condições, concessão,
  contrapartida, canal e quando. **Registrar oferta do cliente**, no pé do cartão, acrescenta uma oferta.
- **Última fala do cliente:** o que você colou ao pedir a sugestão.

**Direita: o mandato e o próximo movimento.**

- **Mandato:** pedido e alvo; o **recuo** e a **BATNA do vendedor** aparecem como "••••" até você
  tocar em **mostrar** (e voltam com **esconder**). Concessões, rodadas, passo, autonomia e
  validade. **Editar mandato** abre o formulário.
- **Leitura do comprador:** as objeções detectadas, os interesses, o teto estimado com a fonte e a
  alternativa do comprador.
- **Próximo movimento:** a contraproposta sugerida, com **Usar sugestão** (envia pelo portal), e
  **Passar ao proprietário**: o aceite da última oferta do comprador, que pede confirmação e é
  sempre seu (o Negociador nunca fecha o acordo). Depois disso, nada sai para o cliente até a
  decisão do proprietário.

### O formulário do mandato

Abre por **Editar mandato** (ou **Definir mandato**, quando ainda não há). Quatro blocos:

1. **Valores:** preço pedido (na primeira vez, vem do anúncio), alvo, ponto de recuo e a BATNA do
   vendedor, com o aviso de que são sigilosos. Com mandato já salvo, o ponto de recuo abre mascarado
   ("••••") e só vira campo editável quando você toca em **mostrar**; no primeiro mandato o campo já
   vem aberto.
2. **Concessões e contrapartidas:** cada linha é "o que se concede, até onde, e o que se pede em
   troca"; mais o passo máximo por rodada (40% é o padrão) e o número máximo de rodadas.
3. **Prazo:** até quando o mandato vale.
4. **Quem negocia e autonomia:** **Quem negocia** é o Negociador IA ou você (corretor); a troca vale
   na hora, sem salvar (é o mesmo Assumir e Devolver do cabeçalho; devolver ao Negociador pede o
   Negociador ligado nos ajustes, senão a tela avisa e você segue negociando). Uma pessoa da sua
   equipe como negociador só existe em contas com vários usuários. Autonomia: só sugere ou pergunta
   antes; **faz sozinho dentro da faixa** só aparece com a autorização do proprietário registrada:
   **Anexar documento** (escolhe um dos documentos já anexados ao imóvel, com a data; o cartão mostra
   "Autorizado por documento <nome> em <data>") ou **Registrar por mensagem** (com a data). Sem
   documento no imóvel, o botão explica que o documento entra pela ficha do imóvel (Imóveis › ficha ›
   Fotos e arquivos, como documento). Ao salvar, o app confere que o documento é deste imóvel. Enquanto o mandato vigente de uma
   negociação em andamento usa o documento, ele não pode ser apagado, virar foto nem ficar público
   na ficha do imóvel.

O formulário confere enquanto você digita, com as mesmas regras da gravação (recuo ≤ alvo ≤
pedido, concessão com contrapartida, faz sozinho com a autorização), e **Salvar mandato** só liga
sem erro. Cada gravação é uma versão nova.

### Nova proposta e a aba Negociação

**Criar › Nova proposta** (e **Registrar proposta**, no cliente escolhido do Funil) pede o cliente,
o imóvel e o valor oferecido. A oferta cai sempre numa negociação **do imóvel escolhido** (um negócio
tem uma negociação em andamento por vez):

1. se o cliente já negocia esse imóvel, a oferta entra nessa negociação;
2. senão, um negócio de compra em andamento do cliente sobre esse imóvel (ou sem imóvel) e sem
   negociação em andamento recebe a negociação nova;
3. senão (por exemplo, o negócio dele já negocia outro imóvel), o app abre um negócio novo do cliente
   para esse imóvel e avisa. A oferta nunca é gravada na negociação de outro imóvel.

Depois abre a negociação.

Na ficha do cliente, a aba **Negociação** lista as negociações dele, com a última oferta e o
estado; tocar numa delas abre Clientes › Negociações. **Nova proposta**, no pé do cartão, abre o
mesmo registro com o cliente já escolhido.

## Negociação

Uma negociação nasce de um **negócio** do funil e de um **imóvel** da carteira, os dois da mesma
conta. Ela recebe um código `NG-0001`, `NG-0002`… e guarda o cliente do negócio.

- **Uma em andamento por negócio.** Encerrada (ganha ou perdida), o negócio pode abrir outra.
- **Estado:** ativa, aguardando o cliente, aguardando o corretor, aguardando o proprietário,
  pausada, **ganha** ou **perdida**. Encerrar como ganha pede o valor final; como perdida, o motivo
  (os mesmos motivos de perda do funil). Encerrada, a negociação não muda mais.
- **Quem conduz:** o **Negociador IA** (o padrão) ou o **corretor**. Com o Negociador desligado nos
  ajustes, a negociação nova começa conduzida pelo corretor. O negociador humano (uma pessoa
  convidada pelo corretor) chega numa versão seguinte.
- **Leitura do comprador:** teto estimado, a fonte da estimativa e a alternativa provável do
  comprador. Essa alternativa é o que a sigla **BATNA** quer dizer: o que a pessoa faria se não
  fechasse este negócio (por exemplo, comprar outro imóvel parecido). Aqui é uma estimativa do
  comprador. Não são sigilosos.

## Mandato: até onde o Negociador pode ir

O **mandato** é o combinado do corretor com o proprietário para aquela negociação:

| Campo | O que é |
|---|---|
| Preço pedido | O valor anunciado (a âncora) |
| **Alvo** | Onde o vendedor quer fechar — **sigiloso** |
| **Ponto de recuo** | O valor abaixo do qual o vendedor prefere não fechar — **sigiloso** |
| **BATNA do vendedor** | A melhor alternativa do vendedor se não houver este acordo (ex.: "manter anunciado 60 dias") — **sigilosa** |
| Concessões | O que o vendedor pode ceder (prazo, itens, forma de pagamento), cada uma com a **contrapartida** a pedir em troca |
| Passo máximo | Que parte do que ainda falta até o ponto de recuo o vendedor pode ceder numa rodada (padrão 40%; ver abaixo) |
| Rodadas | Número máximo de rodadas (padrão 4) |
| Validade | Até quando o mandato vale |
| Autonomia | **Só sugere**, **Pergunta antes** (padrão) ou **Faz sozinho dentro da faixa** |
| Autorização do proprietário | Anexo (um documento já anexado ao imóvel da negociação) ou mensagem, com a data. **Obrigatória** para "Faz sozinho" |

**Regras de gravação:**
- **Ponto de recuo ≤ alvo ≤ preço pedido.** Recuo acima do alvo é recusado com
  `RECUO_ACIMA_DO_ALVO`; alvo acima do pedido, com `MANDATO_INVALIDO` (motivo
  `alvo_acima_do_pedido`).
- Passo máximo maior que 0 e até 1 (100%); rodadas de 1 a 50.
- Toda concessão precisa da contrapartida.
- "Faz sozinho" sem a autorização do proprietário é recusado com `AUTORIZACAO_PROPRIETARIO_AUSENTE`.
- Cada alteração cria uma **versão nova** do mandato; as anteriores ficam no histórico. A vigente é
  a última.
- Negociação encerrada não aceita mandato novo.

**Passo máximo, como se calcula:** é a fração do intervalo que **ainda resta** entre a posição atual
do vendedor e o ponto de recuo. Na primeira rodada, a posição atual é o preço pedido; depois, a
última contraproposta do vendedor. Exemplo com 40%, pedido de R$ 1.000.000 e recuo de R$ 800.000:
a primeira concessão vai a no máximo R$ 80.000 (até R$ 920.000); a seguinte, a R$ 48.000 (até
R$ 872.000). Como o intervalo encolhe, a concessão diminui a cada rodada.

### O que é sigiloso e quem vê

**Alvo, ponto de recuo e BATNA do vendedor nunca são revelados pelo Negociador** (regra do dono do
produto). No app, eles só aparecem para o **corretor da conta** e para o **administrador do app** (que precisa estar associado a uma conta), e só no mandato da negociação. A equipe da plataforma com só o papel de operação não passa nas telas e rotas de negociação (o guarda exige o papel `corretor` ou o nível de administrador do app); quem tem operação e também é administrador do app passa, desde que esteja associado a uma conta.
Ficam fora de:
- a lista e o detalhe da negociação (o mandato aparece ali só com o que não é sigiloso);
- as propostas;
- os **avisos e eventos** do app (que levam só os números de identificação, nunca valores);
- a exportação de contatos e a ficha do cliente;
- tudo o que o cliente vê: portal, seleções, página pública e vitrine.

Outro corretor nunca vê nada da negociação de outra conta: a resposta é "não encontrado".

## Propostas

Cada proposta registra quem propôs (comprador, vendedor ou proprietário), o valor, as condições, a
concessão, a contrapartida e a validade. Nesta versão o corretor **registra** as propostas
(canal "registro"). A contraproposta do vendedor pode ser enviada pelo **Portal do Cliente** ou pelo **Fazer
agora** (o app monta a mensagem e o link do WhatsApp do celular do corretor, que envia), sempre
conferida contra o mandato antes de sair — ver a seção seguinte. O WhatsApp do próprio app ainda
não existe.

### No Portal do Cliente

O cliente vê as propostas na aba **Propostas** do portal dele (ver
[Seleções e Portal do Cliente](selecoes-e-portal.md#propostas)), por negociação, numa linha do
tempo:
- as **ofertas dele**, só com valor, rodada e data (as anotações que você fez ao registrá-las não
  aparecem);
- as **propostas do vendedor que foram enviadas** a ele (pelo portal ou pelo Fazer agora), com
  valor, condições, concessão, contrapartida e validade. A proposta que você só **registrou** não
  aparece, e a do proprietário nunca aparece.

O que o portal **nunca** mostra: o ponto de recuo, o alvo, a BATNA, o teto estimado do comprador, a
fonte dessa estimativa e quem conduz. O app monta o que vai ao portal por uma lista de campos
**permitidos**: campo novo numa tabela não chega ao cliente sem alguém o pôr nessa lista.

Pelo portal o cliente tem três botões:
- **Fazer nova oferta:** ela entra na escada como oferta do comprador, pelo canal portal, e você
  recebe o aviso. Se o Negociador IA conduz a negociação, está ligado, tem mandato vigente e o
  gatilho "oferta registrada ou feita no portal" está marcado, ele roda sozinho sobre a oferta, com
  as mesmas 7 garantias: no **faz sozinho**, a contraproposta que passa sai pelo portal com o texto
  montado pelo código; em qualquer outro caso (só sugere, pergunta antes, passagem, IA fora do ar),
  a negociação vai para "aguardando o corretor", com a tarefa de responder ou de aprovar a sugestão.
  Uma oferta abaixo do recuo é sempre passagem a você.
- **Mensagem ao corretor:** um texto livre sobre a negociação, que chega a você como qualquer
  mensagem do portal, já citando o imóvel. Não é oferta nem aceite e não mexe na escada.
- **Aceitar a condição** da última proposta do vendedor, enquanto ela vale. O aceite **não fecha o
  acordo**: vira uma oferta do cliente no mesmo valor e a negociação vai para "aguardando o
  corretor", com a tarefa de confirmar e levar ao proprietário. Quem aceita o acordo é você (ver
  abaixo).

Com o acordo já com o proprietário, negociação pausada ou encerrada, o cliente só vê, não age.
Cada ação dele entra na linha do tempo do cliente.

A **rodada** é calculada pelo app: cada oferta do comprador abre uma rodada, e a resposta do
vendedor ou do proprietário fica na rodada aberta. A negociação guarda o número de rodadas.

## Como o Negociador IA decide e o que ele nunca faz

Ao pedir uma sugestão (com a última mensagem do cliente, se houver), o Negociador recebe o imóvel,
o mandato, a escada de propostas, as últimas 30 mensagens da negociação, as objeções já vistas e as
suas respostas a objeções. Ele devolve uma leitura (a objeção do cliente, o que interessa a ele, uma
estimativa do teto do comprador) e **um movimento**: responder a objeção, pedir informação,
contrapropor, resumir o acordo ou passar a você. O alvo, o ponto de recuo e a BATNA do vendedor vão
para ele marcados como sigilosos.

**Antes de mostrar ou enviar qualquer coisa, o app confere 7 garantias** (no código, não na
conversa com a IA):

1. **Piso:** a contraproposta nunca fica abaixo do ponto de recuo (igual ao recuo pode).
2. **Passo:** a concessão de preço cabe no passo máximo da rodada e não é maior que a anterior.
3. **Rodadas:** não passa do número de rodadas do mandato.
4. **Concessões:** só itens do mandato, cada um com a contrapartida.
5. **Sigilo:** nenhum texto que pode chegar ao cliente (a mensagem e, da contraproposta, as
   condições, a concessão e a contrapartida) pode citar o recuo, o alvo nem a BATNA do vendedor. O app procura
   esses valores nos formatos usuais ("1.360.000", "1,36 mi", "1360 mil", por extenso, com pequena
   margem de diferença) e frases como "mínimo", "piso" ou "o dono aceita até". É uma checagem
   automática, que não substitui a sua leitura: confira o texto antes de enviar. A mensagem que o
   app retém não vai ao cliente e não aparece como sugestão. Nas mensagens ao cliente, o Negociador
   só pode citar valores que já são públicos: a contraproposta, o preço pedido e as ofertas já
   trocadas. Qualquer outro valor na faixa de preço do imóvel faz a mensagem ser retida. **O que
   parece número e não tem leitura padrão também retém.** Parece número: algarismo de qualquer tipo
   (inclusive "❶", "①" e emoji de número), letra colada a algarismo ("1.36O.000") e número por
   extenso. Leitura padrão: valor com milhar e decimal usuais ou por extenso ("1.460.000", "1,46 mi",
   "um milhão e quatrocentos e sessenta mil"), horário, data, ordinal ("5º andar"), quantidade
   ("2-3 vagas") e telefone. Por isso retêm dígitos separados ("1 3 6 0 mil", "1/3/6/0", "1:360:000",
   "1 ponto 36 milhão", o número partido por uma quebra de linha) e algarismos ditos um a um ("um,
   três, seis, zero mil"). Se, desfeito o disfarce, cada número daquele trecho for a contraproposta, o
   pedido ou uma oferta já trocada ("1 4 6 0 mil"), a mensagem passa; um número público em outro ponto
   do texto não absolve o trecho disfarçado. Também retêm: mil subentendido quando se fala do preço
   ("abaixo de 1.360 não rola", "fecho em 1.360"); número por extenso sem a escala ("mil trezentos e
   sessenta"); diferença ou percentual que, aplicado a um valor público, chega ao recuo ou ao alvo
   ("o dono pode ceder 140 mil", "uns 140 do pedido", "1.500.000 - 140.000", "4,6% acima dos
   1.300.000"); a diferença ligada a uma base dita por palavra, conferida com essa base ("100 mil
   abaixo da nossa contraproposta"); o preço falado sem as escalas ("1 e 360", "treze sessenta"); a
   conta escrita entre dois valores, conferida com a base que o texto cita, mesmo que outra base
   explique a diferença, e com o lado sem escala lido na escala do outro ("1.460 - 100 mil"); e o
   percentual aplicado à base citada ("3% abaixo dos R$ 1.400.000 que você ofereceu"; sem base
   citada, valem o pedido e a contraproposta). Oferecer ou aceitar um valor abaixo do recuo também
   retém, olhando as palavras em volta do valor e não a frase ("1.300.000? Fechado.", "pode ser 1,3
   sim", "negócio fechado em um vírgula três"); só relatar a oferta do comprador passa ("recebi sua
   proposta de R$ 1.300.000", "sua oferta de R$ 1.300.000 fica registrada"). "2 mil" de condomínio
   ou de taxa não é lido como preço. Juros e rendimento podem reter a mensagem ("juros de 9,33% ao
   ano" é lido como percentual sobre o pedido). A conferência prefere reter a mais: uma
   mensagem retida vai para você decidir e nada sai ao cliente. Uma
   alternativa do vendedor dita com outras palavras pode não ser reconhecida pela conferência, por
   isso essa regra também está nas instruções do Negociador; o risco não some por completo, e é
   mais um motivo para você ler antes de enviar.
6. **Validade:** o mandato está vigente; "faz sozinho" só com a autorização do proprietário.
7. **Canal:** portal ou Fazer agora; "faz sozinho" só pelo portal.

Se alguma falha, **nada sai**: a negociação vai para "aguardando o corretor", você recebe o aviso
"o Negociador precisa de você" e a execução fica registrada com o motivo. O Negociador também
**passa a você** quando o comprador oferece abaixo do recuo, quando acabam as rodadas, quando o
cliente aceita (o acordo é sempre seu), quando ele pede algo fora do mandato, fala de comissão,
permuta, financiamento fora do comum, documentos ou assunto jurídico, quando é agressivo ou pede
uma pessoa, quando o mandato venceu ou não existe e quando **não há ZOPA** (o teto estimado do
comprador está abaixo do recuo). Sem mandato, ele nem chama a IA.

**O que acontece com a sugestão, por autonomia:**
- **Só sugere** e **Pergunta antes:** a sugestão espera você. Você **aprova** (escolhendo portal ou
  Fazer agora), **edita** ou **descarta**. Aprovar ou editar confere as 7 garantias de novo: nem a
  sua edição passa do recuo ou revela o sigilo (o app recusa e diz por quê). Só a sugestão mais
  recente se aprova: se depois dela houve outra sugestão ou qualquer proposta nova (do comprador,
  do vendedor ou do proprietário, que o Negociador não viu ao sugerir), ela some da tela e aprovar ou
  editar é recusado com `SUGESTAO_SUPERADA` (peça outra sugestão); descartar continua valendo.
- **Faz sozinho:** com o Negociador conduzindo e a autorização do proprietário no mandato, a
  contraproposta que passa nas garantias é registrada sozinha como enviada pelo portal e a
  negociação passa a "aguardando o cliente". Nesse envio automático **o texto da IA não sai**: o
  app monta uma mensagem curta só com o valor, a concessão e a contrapartida como estão no seu
  mandato e a validade (por exemplo: "Olá, Ana. O vendedor propõe R$ 1.460.000, com prazo de
  entrega de 90 dias, pedindo em troca entrada de 30%. A proposta vale por 48 horas."). A conversa
  livre da IA só chega ao cliente depois que você lê e aprova. O cliente vê a proposta na aba
  Propostas do portal.

**O Negociador nunca aceita o acordo.** Aceitar a proposta do comprador é uma ação separada, feita
só por quem tem o papel de corretor (o administrador do app também pode, pois vale por todos os
papéis). A negociação passa a "aguardando o proprietário", que decide o fechamento. O Negociador
não precisa de CRECI. Se você aceitar o acordo, o Negociador não sugere nem envia mais nada depois disso (aprovar ou editar uma sugestão que ficou pendente também é recusado; descartar ainda pode).

**Um atendente por vez:** **Assumir** faz você conduzir; **Devolver** entrega de novo ao Negociador
(se ele estiver ligado nos ajustes).

**Simulador:** o motor pode ser testado numa negociação fictícia (a tela dele, em Ajustes ›
Negociador, chega numa versão seguinte): você escreve a mensagem do comprador e vê a resposta e as
7 garantias marcadas (✓ ou ✗). Nada é gravado.

**Sem IA:** há dois casos. Se a IA não está disponível na instância, o pedido de sugestão responde
"IA indisponível agora: a negociação segue com você." Se a IA estava disponível mas não respondeu,
a mensagem é "A IA não respondeu agora. Tente de novo em instantes; a negociação segue com você."
Nos dois casos nada é gravado e nada muda na negociação (nem o estado, nem quem conduz): você
conduz com as propostas e o Fazer agora, e pode pedir a sugestão de novo depois. Sem mandato
vigente (ou com o mandato vencido) o app nem consulta a IA: a negociação vai para "aguardando o
corretor" e você recebe o aviso "o Negociador precisa de você".

## Ajustes do Negociador

Uma configuração por conta, criada na primeira vez que o corretor salva (até lá valem os padrões):
- **Ligado** (padrão: sim) e **quem negocia por padrão** (padrão: o Negociador IA);
- **quando entra:** negócio chega à etapa Proposta, cliente pede desconto, reação "conversar sobre
  o preço", oferta registrada ou feita no portal (todos marcados por padrão);
- **estilo:** cooperativo (padrão), firme ou consultivo;
- **instruções do corretor** (até 4.000 caracteres) e a **assinatura** que o cliente vê.

Cada gravação sobe a versão da configuração.

## Respostas a objeções

O app traz respostas prontas para as 10 objeções mais comuns: preço, "vou pensar", "vi mais
barato", localização, estado do imóvel, financiamento, decisão com outra pessoa, prazo, condomínio
e IPTU, e documentação. Para cada uma: a pergunta para explorar, a resposta com critério objetivo e
o próximo passo. Elas entram em toda conta quando o app inicia.

O corretor pode **editar a própria resposta** de uma categoria ou **voltar ao padrão**. A resposta
padrão nunca é apagada nem reescrita.

## Para o administrador da instância

- **Eventos** (todos da conta do corretor; o clique leva à tela Clientes, mas nesta versão ela só tem as visões Lista e Funil, então o link ainda não abre a negociação): negociação iniciada,
  oferta do comprador recebida, proposta registrada, mandato alterado, negociação encerrada,
  "o Negociador precisa de você" (passagem ao corretor), objeção detectada, contraproposta
  esperando aprovação, contraproposta enviada, acordo aguardando o proprietário, negociação
  assumida e devolvida. O conteúdo desses eventos nunca leva valores do mandato.
- **IA:** o Negociador usa o slot **Negociador**, que é um slot próprio do app e herda a base
  `poder`. Não há autorização separada para ele: o que o administrador libera, em Admin ›
  Instaláveis › Apps › Portal do Corretor › IA, é o uso da chave da plataforma na base `poder`
  (ou configura uma chave própria do app para o slot). Se a base `poder` não estiver liberada, o
  sistema tenta `normal` e depois `barato`, e o Negociador roda com um modelo menor. Só quando
  nenhum deles resolve, o pedido de sugestão responde "IA indisponível agora" e o corretor conduz.
- **Respostas a objeções:** semeadas a cada início do app, em toda conta ativa, sem duplicar. Conta
  criada depois do último início recebe as respostas no próximo; até lá, essa conta não tem as respostas. Nesta versão ainda não existe tela de respostas a objeções: elas só existem nos dados da conta.
