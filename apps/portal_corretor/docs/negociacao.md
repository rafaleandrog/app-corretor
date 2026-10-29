---
titulo: Negociação e mandato
descricao: As negociações de um negócio, o mandato do vendedor (o que é sigiloso e quem vê), as propostas, o Negociador IA (como decide e o que nunca faz), os ajustes e as respostas a objeções.
---

# Negociação e mandato

A partir da versão 0.1.13 o app guarda as **negociações**: a etapa em que o corretor (ou o
**Negociador**, o assistente de negociação do app) troca propostas com o comprador até um acordo.
Na versão 0.1.16 chega o **Negociador IA**: ele lê a conversa, sugere o próximo movimento e
confere cada sugestão contra o mandato antes de qualquer coisa sair. Na versão 0.1.23 chegam as
telas: **Clientes › Negociações**, o **mandato** e a aba **Negociação** da ficha do cliente (ver
[As telas](#as-telas), abaixo). Ajustes › Negociador chega numa versão seguinte.

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
| Autorização do proprietário | Anexo ou mensagem, com a data. **Obrigatória** para "Faz sozinho" |

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

A tela da negociação também diz se existe **ZOPA**: se o teto estimado do comprador fica acima do
seu recuo. É uma conclusão tirada do recuo, sem mostrar o valor, e só aparece para você, nunca ao cliente.

Outro corretor nunca vê nada da negociação de outra conta: a resposta é "não encontrado".

## As telas

### Clientes › Negociações

Caminho: **Clientes → Negociações** (a terceira visão, ao lado de Lista e Funil). O endereço é
`/clientes?visao=negociacoes`, e cada negociação abre em `?item=<número da negociação>`, o mesmo
endereço dos avisos de negociação e do **Abrir** de "Precisa de você", em Hoje.

**À esquerda**, a lista das negociações, com os filtros **Todas** (as em andamento) · **Aguardando
você** · **Negociador** (as que o Negociador IA conduz) · **Cliente** · **Proprietário** ·
**Encerradas**. Cada linha mostra o cliente, o estado, o imóvel, a última oferta e a diferença para
o preço pedido (ex.: "R$ 1,32 mi · −9%"), quem conduz e há quanto tempo mudou. No topo,
**Nova proposta** (ver abaixo).

**No centro**, a negociação escolhida:
1. O cabeçalho com o cliente e o imóvel, **Assumir** (você passa a conduzir) ou **Devolver ao
   Negociador**, e os chips da rodada ("Rodada 3 de 4"), de quem conduz ("Negociador IA · pergunta
   antes"), da validade do mandato e do estado.
2. A **faixa da negociação**: última oferta, ponto de recuo, teto estimado do comprador, alvo e preço
   pedido, e a frase da **ZOPA estimada** (a faixa entre o seu recuo e o teto do comprador, em que
   um acordo é possível). O recuo e o alvo aparecem como **••••** até você clicar no **olho**, ao lado
   do título do cartão (clicar de novo oculta).
3. A **escada de propostas**: rodada, quem, valor, condições, concessão, contrapartida, canal e quando.
4. A **última oferta** do cliente, com o que ele disse e a objeção percebida.
5. O cartão **Negociador sugere · rodada n**, quando há uma sugestão esperando você: o valor, a
   concessão e a contrapartida, a mensagem e a linha das garantias ("✓ acima do recuo · ✓ passo
   menor…"). Botões **Enviar** (pelo portal), **Fazer agora** (abre o WhatsApp do seu celular com o
   texto pronto), **Editar** e **Descartar**. Editar passa pelas mesmas 7 garantias: um valor abaixo
   do recuo, por exemplo, não sai, e a tela diz qual regra barrou, sem mostrar o recuo. Quando a
   sugestão é só uma mensagem, o Editar aceita só o texto, sem valor.
   **Enviar** e **Fazer agora** ficam desligados quando a sugestão não passou nas garantias, quando
   não traz o que enviar ou quando foi feita antes da última oferta do cliente. A tela diz o motivo;
   no último caso, o **Pedir sugestão** aparece no cartão da sugestão (desligado sem mandato) e, no
   cartão **Próximo movimento**, o **Usar sugestão** é trocado por **Pedir sugestão**. O
   **Usar sugestão** também fica desligado nas outras travas.
   Se o cliente não tem um WhatsApp válido no cadastro, o **Fazer agora** é recusado e nada é gravado:
   envie pelo portal ou corrija o telefone. Se o navegador barrar a aba do WhatsApp, a tela mostra o
   texto pronto e o link para você copiar.
6. As ações: **Registrar oferta do cliente** (a que ele fez fora do portal) e, no **Mais**, registrar a
   resposta do proprietário e encerrar como ganha ou perdida. **Aceitar oferta** é um botão separado,
   com confirmação: o acordo vai ao proprietário e a negociação fica aguardando a decisão dele.

**À direita**:
- o **Mandato** em resumo: pedido, alvo, recuo e BATNA do vendedor (os três como **••••** até
  o **olho**), as concessões com as contrapartidas, o passo, as rodadas, a validade e a autonomia,
  com **Editar mandato** (ou **Definir mandato**, se ainda não houver);
- a **Leitura do comprador**: objeções, interesses, o teto estimado e a fonte;
- o **Próximo movimento (IA)**: **Usar sugestão** (envia a sugestão pelo portal) ou **Pedir
  sugestão** (você cola o que o cliente disse, e o Negociador prepara o próximo movimento dentro do
  mandato), e **Passar ao proprietário** (o mesmo aceite, com confirmação). Sem mandato, o pedido de
  sugestão fica desligado; com a IA fora do ar, a tela diz "IA indisponível agora" e a negociação
  segue com você.

O **olho** lê o mandato completo na hora e só para você; ao sair da negociação, os valores voltam
a ficar mascarados.

**No celular**, a mesma tela abre direto na negociação: rodada, faixa, última oferta e o cartão do
Negociador com Enviar, Editar e Assumir. As colunas da lista e do mandato ficam nas abas da tela.

### O mandato

Caminho: **Clientes → Negociações → a negociação → Editar mandato** (à direita). Abre numa janela
sobre a tela, com quatro blocos:
1. **Valores:** preço pedido (o do anúncio, no mandato novo), alvo, ponto de recuo e a BATNA do
   vendedor, com o aviso de que são sigilosos. A conferência "✓ recuo ≤ alvo ≤ pedido" acontece
   enquanto você digita; o app também recusa ao salvar.
2. **Concessões e contrapartidas:** uma linha por concessão (o que, até quanto e o que pedir em
   troca), **Adicionar concessão**, o passo máximo por rodada (em %) e o máximo de rodadas.
3. **Prazo e validade:** até quando o mandato vale.
4. **Quem negocia e autonomia:** Negociador IA ou você; **Só sugere**, **Pergunta antes** ou **Faz
   sozinho**; e a **autorização do proprietário**, por **Anexar documento** (o arquivo vai para os
   arquivos do imóvel como documento, nunca público) ou **Registrar por mensagem** (a data em que
   ele autorizou). A opção "Faz sozinho" só aparece na lista depois de registrada a autorização, e só
   salva com ela. O documento anexado precisa ser do imóvel da negociação. O documento citado por um mandato
   fica sempre interno: não vira foto, não vai ao anúncio e não pode ser apagado ("fica guardado com o
   histórico do mandato").

**Salvar mandato** cria uma versão nova; **Cancelar** fecha sem gravar.

### Na ficha do cliente e no Criar

- **Clientes → o cliente → aba Negociação:** cada negociação do cliente, com o estado, a rodada, a
  última oferta e quem conduz, e **Abrir**, que leva a Clientes › Negociações.
- **Nova proposta** (no Criar, no topo de Negociações, no **+** da aba Negociação e no Registrar
  proposta do Funil): escolha o cliente, o imóvel e o valor oferecido. A oferta entra na negociação
  em andamento desse cliente e imóvel; se não houver, o app abre a negociação (e, se preciso, um
  negócio de compra para o cliente) e leva você até ela.

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
  sua edição passa do recuo ou revela o sigilo (o app recusa e diz por quê).
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

- **Eventos** (todos da conta do corretor; o clique abre a negociação em Clientes › Negociações): negociação iniciada,
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
