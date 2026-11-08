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
cliente (ver [As telas da negociação](#as-telas-da-negociação)). Na versão 0.1.27 chega a seção
**Ajustes › Negociador** (ver [Ajustes do Negociador](#ajustes-do-negociador)). Na versão 0.1.28
chega o **negociador humano**: uma pessoa que o corretor convida para conduzir negociações (ver
[Negociador humano](#negociador-humano)). Na 0.1.35 a conferência de sigilo passa a deixar sair
alguns formatos comuns ("W3 Sul", "Apto 2B"), com o critério de equivalência decidido pelo dono (ver
[Como o Negociador IA decide](#como-o-negociador-ia-decide-e-o-que-ele-nunca-faz)). Na 0.1.36 chegam os
**gatilhos** (etapa Proposta, pedido de desconto no portal e a reação "Conversar sobre o preço"), o
**negociador padrão** da conta e o aviso direto ao negociador humano (ver [Quando o Negociador
entra](#quando-o-negociador-entra)); a 0.1.38 deixa esses gatilhos mais robustos (a negociação e a
tarefa do mandato nascem juntas, e a mesma mensagem não faz o Negociador responder duas vezes). Na
0.1.39, trocar de conta recria a tela da negociação (ver [Trocar de conta no meio de uma
negociação](#trocar-de-conta-no-meio-de-uma-negociação)). Na 0.1.40, se a IA falha numa mensagem do
cliente, a mesma mensagem entregue de novo tenta outra vez, e a negociação aberta pela reação ou pela
mensagem do cliente só vai ao negociador padrão quando o app consegue conferir o acesso dele. Na 0.1.41,
o código de unidade que se lê como ordinal, tempo ou escala ("apto 6A") passa pela mesma conferência da
gêmea que os formatos comuns (ver [Como o Negociador IA decide](#como-o-negociador-ia-decide-e-o-que-ele-nunca-faz)).

### Resumo das garantias

| Garantia | Onde está explicada |
|---|---|
| Nenhuma contraproposta abaixo do ponto de recuo, nem acima do passo máximo ou depois da última rodada | [Como o Negociador IA decide](#como-o-negociador-ia-decide-e-o-que-ele-nunca-faz) |
| Recuo, alvo e alternativa (BATNA) do vendedor nunca saem ao cliente: a conferência de sigilo retém o que parece número, e um formato comum só sai se a mensagem-gêmea com algarismo comum também sairia (critério de equivalência) | [Como o Negociador IA decide](#como-o-negociador-ia-decide-e-o-que-ele-nunca-faz) |
| O aceite final, o mandato e a decisão do proprietário são só do corretor | [Negociação](#negociação) e [Negociador humano](#negociador-humano) |
| Quando o Negociador entra: só pelos momentos marcados em Ajustes › Negociador, conduzido por quem está em **Quem negocia por padrão** (o Negociador IA, se nada for escolhido) | [Quando o Negociador entra](#quando-o-negociador-entra) |
| Eventos de negociação levam só números de identificação, sem nome, telefone, valor ou mandato; três eventos de webhook público ficam como risco residual, até a plataforma resolver | [Negociador humano](#negociador-humano) |
| Uma resposta que chega depois de trocar de conta não aparece na conta nova | [Trocar de conta no meio de uma negociação](#trocar-de-conta-no-meio-de-uma-negociação) |

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
  **Fazer agora** abre o WhatsApp do celular com a mensagem pronta (se o cliente não tem um
  telefone de WhatsApp válido no cadastro, o app recusa e não grava nada; se o navegador barrar a
  aba, a tela mostra o texto e o link para você copiar); **Editar** muda o valor ou o texto (o
  valor vem preenchido e a mensagem em branco, com o rascunho do Negociador ao lado só para
  consulta; em branco, sai a mensagem montada pelo app. O app confere de novo e, se a edição passar
  do recuo ou revelar o sigilo, não envia e diz o motivo); **Descartar** descarta. Numa sugestão só
  em texto, no lugar de Enviar e Fazer agora fica **Revisar e enviar**: o rascunho vem no campo e
  você o ajusta e envia como seu. Sugestão bloqueada pelas regras só sai
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
- **Quem conduz:** o **Negociador IA** (o padrão), o **corretor** ou o **negociador humano** (uma
  pessoa convidada pelo corretor, a quem ele atribui a negociação; ver
  [Negociador humano](#negociador-humano)). A negociação nova começa com quem está em **Ajustes ›
  Negociador › Quem negocia por padrão**: o Negociador IA ou a pessoa escolhida ali, que já recebe a
  negociação atribuída e um aviso. Com o Negociador desligado nos ajustes, a negociação nova começa
  conduzida pelo corretor. A negociação aberta à mão (**Nova proposta**) segue o mesmo padrão; depois
  de aberta, **Assumir** passa a condução a você e **Devolver** a entrega de novo ao Negociador.
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
- O documento da autorização por anexo é conferido no momento de gravar, com a negociação e o
  documento reservados até o fim da gravação. Se o documento foi apagado nesse meio-tempo, o mandato
  é recusado com `DADOS_INVALIDOS` (anexe de novo); se o mandato gravou primeiro, quem tenta apagar o
  documento recebe `DOCUMENTO_EM_USO`.

**Passo máximo, como se calcula:** é a fração do intervalo que **ainda resta** entre a posição atual
do vendedor e o ponto de recuo. Na primeira rodada, a posição atual é o preço pedido; depois, a
última contraproposta do vendedor. Exemplo com 40%, pedido de R$ 1.000.000 e recuo de R$ 800.000:
a primeira concessão vai a no máximo R$ 80.000 (até R$ 920.000); a seguinte, a R$ 48.000 (até
R$ 872.000). Como o intervalo encolhe, a concessão diminui a cada rodada.

### O que é sigiloso e quem vê

**Alvo, ponto de recuo e BATNA do vendedor nunca são revelados pelo Negociador** (regra do dono do
produto). No app, eles só aparecem para o **corretor da conta** e para o **administrador do app** (que precisa estar associado a uma conta), e só no mandato da negociação. O **negociador humano**, que é da equipe do corretor, lê o mandato completo, com os três campos, mas só o das negociações atribuídas a ele e só em leitura. A equipe da plataforma com só o papel de operação não passa nas telas e rotas de negociação (o guarda exige o papel `corretor`, o papel `negociador` com a negociação atribuída, ou o nível de administrador do app); quem tem operação e também é administrador do app passa, desde que esteja associado a uma conta.
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
   "um milhão e quatrocentos e sessenta mil"), horário, data sem ano ("28/10"), ordinal ("5º andar"), quantidade
   ("2-3 vagas") e telefone com hífen ("(61) 99999-9999"). Por isso retêm dígitos separados ("1 3 6 0 mil", "1/3/6/0", "1:360:000",
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
   ou de taxa não é lido como preço. **Formatos comuns que passam (desde a 0.1.35):** só os que não têm
   grupo de algarismos livre, onde um valor caberia: endereço de Brasília ("W3 Sul", "L2 Norte"); código
   de unidade com no máximo dois algarismos e uma letra, logo depois de "apto", "apartamento", "ap",
   "torre", "bloco", "bl", "unidade", "casa", "sala", "loja", "conjunto" ou "cj" ("Apto 2B", "Torre
   B2"); e data sem ano e sem hora ("visita dia 28/10"), que já passava. Na leitura do código, toda
   letra que alguém pode tomar por algarismo é conferida com cada algarismo que ela pode ser: "a" 4,
   "b" 8 ou 6, "e" 3, "g" 6 ou 9, "i" e "l" 1, "o" 0, "q" 9, "s" 5, "t" 7, "z" 2. O código passa só
   quando nenhuma leitura revela, nem a letra lida como letra nem como algarismo: "Torre E6" é também
   36, "Apto A5" é 45, "Bloco B4" é 84, "Apto 2B" é 28 e 26, "L3 Norte" é 13. O "w" do eixo e letras
   como "c", "d", "f", "h" ficam só letra. "l", "i" e "o", no código, contam sempre como algarismo (no
   resto da mensagem, só com contexto: "o" depois de um dígito, como em "1.36O.000"; "l" e "I"
   maiúsculo antes de um dígito; o "i" minúsculo, nunca), então o
   código de unidade com uma delas ("Apto 3l", "Torre O3") não é mais código e retém. A marcação também conta: sublinhado, asterisco, til, crase e os caracteres
   invisíveis (zero-width) colados ao código (`Apto 5B_`, `*Apto 5C*`, `_W4 Sul`) fazem o formato
   reter, e as palavras de preço, de conta e de número são procuradas também com essa marcação tirada
   ou trocada por espaço (`_menos_ apto 5B` e `Apto 4B_six` retêm). Endereço e código passam
   quando valem três condições e a gêmea passa (abaixo). (1) O formato é o **único número da mensagem**: nenhum outro
   algarismo, número ou ordinal por extenso, em português, inglês ou espanhol ("treze", "quinto",
   "sexta", "thirteen", "trece", "trescientos", "quinientos", "tercero", "cuarto", "octavo"), "um",
   "uma" ou "num", "par", "pares", "pair", "dupla" ou "dozen", algarismo
   romano ("Torre XIII"; palavras como "vi" e "mil" também contam), nem outro formato, em lugar
   nenhum dela. (2)
   Os algarismos dele não dão o recuo, o alvo ou valor da alternativa do vendedor em nenhuma escala
   (nem com o milhão subentendido: "Torre 36B" pode ser 1,36 mi, e "Torre 4B", 1,4 mi ou 2,4 mi;
   "Torre 05B", 1,05 mi), nem valor abaixo do recuo ("Apto 9B" pode ser 900 mil; "Torre 35B", 1,35
   mi; "Torre 3B", 1,3 mi). Por isso, num imóvel de 1,5 mi com recuo de 1,36 mi, "W3 Sul", "L2
   Norte", "Apto 2B" e "Torre 3B" retêm; num imóvel em que esses valores não dizem nada, passam. E,
   com palavra de diferença, margem, percentual ou limite na mensagem ("folga", "margem", "gordura",
   "chão", "até", "por", "sobre", "%" (também o de largura cheia, "％"), "pc", "pp", "bps", "percentual",
   "porcentagem", "off", "taxa", "less", "minus", "below", "delta"…, ou um "-" ou "+" solto ou colado ao
   código; "por favor" não conta),
   também não dão o recuo ou
   o alvo como diferença do pedido ("a folga é o apto 14B" = 140 mil) ou como percentual dele
   ("gordura: Torre 3B" = 3%). (3) A mensagem não fala de preço, oferta ou aceite ("valor", "R$",
   "fecho", "aceita", "desce", "vendedor", "anunciado", "contraproposta", "combinado", "pode ser",
   "bate", "ficamos", "ok", "sim", "de acordo", "entrada", "sinal", "comissão", "economia", "recua",
   e em inglês e espanhol "price", "precio", "offer", "deal", "rebaja", "commission"…; "fica na" de
   lugar não conta): é todo o vocabulário com que a conferência lê preço, oferta, aceite e limite, e
   por isso "Ok, apto 5B" também retém. **Retidos, por decisão:** telefone com espaço ou sem hífen ("me liga no (61) 99999
   1234", "ligue 0800 345 6789"), CEP ("CEP 70.000-000") e data seguida direto da hora ("visita dia
   28/10 15h", "28/10 15h30"), que já retinham, e o número entre parênteses depois do preço ("R$
   1.460.000 (2 vagas)"). O telefone com hífen ("(61) 99999-9999") segue leitura padrão e passa. A data com a hora depois de "às" ou de vírgula ("visita dia 28/10 às 10h",
   "visita dia 28/10, 15h") passa, como antes: data e horário são lidos cada um como leitura padrão. A data com
   ano ("vistoria 28/10/2026"), também com o ano de dois algarismos ("visita dia 28/10/26"), passava
   antes e retém desde a 0.1.35. Cada grupo de algarismos
   deles é um lugar onde um valor cabe ("CEP 70.000-136", "visita dia 28/10/1360 15h", "me liga no 61
   3333 1251"), e conferir grupo a grupo não fechou o vazamento. Também retêm: código com outro
   número na mensagem ("Apto 2B, 3 quartos e 2 vagas", "Torre B2, 3º andar", "treze andares, apto
   6B", "fecho em 1. Torre 36B", "W3 Sul 704"); código com três algarismos ou duas letras ("apto
   360B", "Torre BB2"); código cujos algarismos dão valor sigiloso ("Apto 1B", "W1 Sul", "Torre 36B",
   "Apto 9B" quando o recuo é 1.360.000); e qualquer formato numa mensagem que fala de preço ("Quanto
   ele aceita? Torre B2"). Juros
   e rendimento podem reter a mensagem ("juros de 9,33% ao ano" é lido como percentual sobre o
   pedido). A conferência prefere reter a mais: uma mensagem retida vai para você decidir e nada sai
   ao cliente. Uma
   alternativa do vendedor dita com outras palavras pode não ser reconhecida pela conferência, por
   isso essa regra também está nas instruções do Negociador; o risco não some por completo, e é
   mais um motivo para você ler antes de enviar. **Critério de equivalência dos formatos comuns
   (decisão do dono, 05/11/2026):** liberar um formato comum só conta como piora do sigilo quando a
   mesma informação, escrita com algarismo comum no lugar do código ("bloco 6" no lugar de "bloco
   C6", "apto 5" no lugar de "apto 5B"), é retida pela conferência de antes da 0.1.35. **A
   conferência aplica esse critério ela mesma:** antes de deixar um código passar, ela monta a
   mensagem-gêmea, a mesma mensagem com o código trocado por cada leitura dele em algarismos ("bloco
   C50" vira "bloco 50"; "bloco S5" vira "bloco 5" e "bloco 55"; "apto 5B" vira "apto 5", "apto 58" e
   "apto 56"), e lê a gêmea do jeito comum, sem liberar formato nenhum. Se alguma gêmea retém, o código
   retém também, qualquer que seja a palavra que fez a gêmea reter. Por isso, num imóvel de 1,5 mi com
   alvo de 1,45 mi, "Fica no bloco C50" e "Por favor, apto K43" retêm: "Fica no bloco 50" e "Por favor,
   apto 43" já retinham (o número depois de "fica" ou de "por" é lido como diferença de um valor
   público, e 50 mil é a distância do pedido ao alvo). **Desde a 0.1.41**, a gêmea vale também para
   todo código com algarismo e letra que a conferência lê como número comum, de qualquer tamanho: ordinal
   ("apto 6A" como "6ª"), tempo ("apto 6S", "apto 13600s"), escala ("apto 24M", "apto 1360mi"),
   quantidade ("apto 1360km") e horário ("apto 7h15", cuja gêmea é "apto 715"; "apto 7h15min"), que antes
   passavam sem conferência. Se o código tiver letras demais para conferir todas as leituras, ele retém
   sem conferir. Logo depois de "apto", "torre", "bloco" e das
   outras palavras de endereço (também "apt", "quadra", "lote", "nº"), com qualquer separador entre a
   palavra e o código (espaço, vírgula, ponto e vírgula, dois-pontos, barra, hífen, parêntese ou "nº":
   "apto, 6A" é conferido igual a "apto 6A"; "6ª" conta como "6A"), ele retém quando alguma gêmea
   retém, mesmo que o valor lido do código seja público ("Fica no apto 6A" e "Fica no apto, 6A" retêm,
   porque "Fica no apto 64" e "Fica no apto, 64" retêm; "Fica no apto 7h15" retém, porque "Fica no
   apto 715" retém) e segue passando quando nenhuma retém ("Apto 6A", "Apto 2A", "Fica no 6º andar"). Na mesma mensagem, até quatro códigos assim são conferidos; do quinto
   em diante, a mensagem retém sem conferir. Se a forma com
   algarismo já passava, a forma com código passa também e o risco é o mesmo de antes: **risco
   residual, já existente, e não criado pelos formatos comuns**. Hoje esse risco cobre o número curto
   fora do contexto de preço disfarçado assim: número ou ordinal por extenso em outra língua
   ("Thirteenth story, bloco C6", "decimotercera", "cero"); símbolo que lembra número (emoji de dado,
   "⚀⚂ Bloco C6"); palavra de conta abreviada, com erro de grafia ou soletrada ("Dif.: apto 5B", "dsct",
   "men.", "menoz", "bxa", "g a p", "o-f-f"); caractere invisível que parte a palavra ("menos" partido em dois) ou
   caractere de tag colado ao código; traço longo ou hífen seguido de pontuação ("Apto 5B—", "Apto
   5B-."); e "d" lido como 0 ("Torre D5"). Em todos, "bloco 6", "apto 5" ou "torre 5" com o mesmo
   disfarce já passavam. Fica também no risco residual o **número colado em unidade**: "Fica no apto
   1.360km" e "Fica no apto 1.360x" passam pela conferência, porque o número grudado em "km" ou em "x"
   é lido do jeito comum, como distância ou como parcelas, e essa leitura não confere a gêmea (a
   conferência da 0.1.41 pega o código sem ponto, como "apto 1360km"). Era assim antes da 0.1.41 e
   continua igual depois: não é piora desta versão. Conferir a gêmea de toda leitura comum mexeria
   também em horário, distância e parcelas em qualquer frase, o que pede outro desenho; o caso ficou
   registrado em issue própria. Por isso a conferência não é a única barreira: no "só sugere" e no
   "pergunta antes", você lê a mensagem antes de ela sair.
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
- **Só sugere** e **Pergunta antes:** a sugestão espera você. O texto que a IA escreveu é um
  **rascunho para você**: ele nunca sai como está. Você **aprova** (escolhendo portal ou Fazer
  agora), **edita** ou **descarta**:
  - **aprovar** uma contraproposta envia a mensagem que o app monta, como no "faz sozinho": o valor,
    a concessão e a contrapartida como estão no seu mandato e a validade;
  - uma resposta **só em texto** (objeção, pergunta) não se aprova: **edite** e envie com as suas
    palavras, ou descarte (na tela, é o **Revisar e enviar**);
  - **editar** envia o texto que você escreveu. Se você mudar só o valor, ou deixar a mensagem em
    branco, sai a mensagem montada. Editar sem escrever mensagem e sem mexer na contraproposta vale
    como aprovar (fica registrado como aprovação); qualquer texto que você escreva, mesmo igual ao
    rascunho, conta como edição.
  - se você edita e informa a concessão sem a contrapartida, a mensagem montada **não cita** a
    concessão, mas a proposta guarda a concessão que você informou.

  Aprovar ou editar confere as 7 garantias de novo: nem a sua edição passa do recuo ou revela o
  sigilo (o app recusa e diz por quê).
  Só a sugestão mais recente se aprova: se depois dela houve outra sugestão ou qualquer proposta
  nova (do comprador, do vendedor ou do proprietário, que o Negociador não viu ao sugerir), ela some
  da tela e aprovar ou editar é recusado com `SUGESTAO_SUPERADA` (peça outra sugestão); descartar
  continua valendo.
- **Faz sozinho:** com o Negociador conduzindo e a autorização do proprietário no mandato, a
  contraproposta que passa nas garantias é registrada sozinha como enviada pelo portal e a
  negociação passa a "aguardando o cliente". Nesse envio automático **o texto da IA não sai**: o
  app monta uma mensagem curta só com o valor, a concessão e a contrapartida como estão no seu
  mandato e a validade (por exemplo: "Olá, Ana. O vendedor propõe R$ 1.460.000, com prazo de
  entrega de 90 dias, pedindo em troca entrada de 30%. A proposta vale por 48 horas."). O cliente
  vê a proposta na aba Propostas do portal.

**O Negociador nunca aceita o acordo.** Aceitar a proposta do comprador é uma ação separada, feita
só por quem tem o papel de corretor (o administrador do app também pode, pois vale por todos os
papéis). A negociação passa a "aguardando o proprietário", que decide o fechamento. O Negociador
não precisa de CRECI. Se você aceitar o acordo, o Negociador não sugere nem envia mais nada depois disso (aprovar ou editar uma sugestão que ficou pendente também é recusado; descartar ainda pode).

**Um atendente por vez:** **Assumir** faz você conduzir; **Devolver** entrega de novo ao Negociador
(se ele estiver ligado nos ajustes).

**Simulador:** o motor pode ser testado numa negociação fictícia (em Ajustes › Negociador, à
direita, no cartão **Testar**): você escreve a mensagem do comprador e vê a resposta e as
7 garantias marcadas (✓ ou ✗). Nada é gravado.

**Sem IA:** há dois casos. Se a IA não está disponível na instância, o pedido de sugestão responde
"IA indisponível agora: a negociação segue com você." Se a IA estava disponível mas não respondeu,
a mensagem é "A IA não respondeu agora. Tente de novo em instantes; a negociação segue com você."
Nos dois casos nada é gravado e nada muda na negociação (nem o estado, nem quem conduz): você
conduz com as propostas e o Fazer agora, e pode pedir a sugestão de novo depois. Sem mandato
vigente (ou com o mandato vencido) o app nem consulta a IA: a negociação vai para "aguardando o
corretor" e você recebe o aviso "o Negociador precisa de você".

## Ajustes do Negociador

Em **Ajustes › Negociador**, uma configuração por conta, criada na primeira vez que o corretor
salva (até lá valem os padrões). Gatilho, liga/desliga e estilo gravam na hora; as instruções,
em **Salvar instruções**. Cada gravação sobe a versão da configuração. A configuração também
guarda a **assinatura** que o cliente vê; ela aparece na tela com o negociador humano, numa versão
seguinte. No centro, seis blocos:

1. **Quando entra:** quatro caixas, todas marcadas por padrão (ver
   [Quando o Negociador entra](#quando-o-negociador-entra)): o negócio chega à etapa Proposta; o
   cliente pede desconto ou fala de preço numa mensagem do portal; o cliente reage "Conversar sobre o
   preço"; uma oferta é registrada ou feita no portal.
2. **Quem negocia por padrão:** o botão **Negociador ligado** (padrão: ligado) e **Conduz as
   negociações novas**: **Negociador IA (padrão)** ou uma das pessoas que aceitaram o convite e já
   têm o papel negociador. Escolhida uma pessoa, toda negociação nova já nasce atribuída a ela, que
   recebe um aviso. Desligado o Negociador, nada entra sozinho e as negociações novas começam
   conduzidas por você (a escolha fica guardada, mas sem efeito). Abaixo, o **negociador humano**:
   **Convidar negociador** (só o e-mail, sem CRECI), os convites pendentes (com **Revogar**) e quem
   já aceitou, marcado **pronto** ou **falta o papel** (ver [Negociador humano](#negociador-humano)).
   O Negociador não pede CRECI.
3. **Estilo:** cooperativo (padrão), firme ou consultivo, cada um com um exemplo de fala; **Usar**
   troca o estilo.
4. **Regras fixas:** as 10 regras que o Negociador nunca quebra, só para ler. São as mesmas,
   palavra por palavra, que vão nas instruções dele, e valem acima das suas.
5. **Suas instruções:** até 4.000 caracteres (o contador mostra quantos já foram), com **Salvar
   instruções**. Em branco, vale o modelo do app; **Começar do modelo** coloca o modelo na caixa
   para você editar.
6. **Respostas a objeções:** a lista das 10 objeções, cada uma marcada **Padrão** ou **Minha
   resposta**. **Editar** abre a pergunta para explorar, a resposta e o próximo passo; **Voltar ao
   padrão** volta à resposta do app (ver abaixo).

À direita:

- **Testar:** uma negociação de mentira, com pedido, alvo, recuo, a oferta e o teto do comprador
  digitados ali (já vêm preenchidos com um exemplo) e a fala do comprador (vem com "Qual o mínimo
  que o dono aceita?"). **Testar** mostra a resposta do Negociador, as 7 garantias marcadas (com um
  sinal de certo ou de falha, como "não revelou o recuo, o alvo nem a BATNA do vendedor"), se a
  conversa passaria a você e por quê, e a ZOPA do teste (do recuo ao teto do comprador). Nada é
  gravado nem enviado. Sem IA na instância, o cartão diz "IA indisponível agora" e o resto da seção
  funciona normalmente.
- **Números do mês:** **Rodadas** conta as sugestões que o Negociador criou desde o dia 1º;
  **Aprovadas sem edição**, a parte das sugestões criadas no mês e aprovadas ou editadas (as
  ainda abertas e as recusadas não entram na conta) que você aprovou sem editar; e o custo por rodada ("Incluído no plano").
  Para outros períodos, com taxa de acordo, desconto médio, rodadas, ZOPA e objeções, veja
  **Números › Negociação** (lá a conta das aprovadas sem edição vai pela data em que você decidiu).

### Quando o Negociador entra

Cada momento tem a sua caixa em **Quando entra**; com a caixa desmarcada, ou o Negociador desligado,
o app faz o que fazia antes (a tarefa para você, sem negociação nova). "Entrar" quer dizer: a
negociação do negócio passa a existir, conduzida por quem está em **Quem negocia por padrão**. O
Negociador só propõe valores com o **mandato** definido; por isso, toda negociação aberta por um
destes momentos cria para você a tarefa "O Negociador entrou na NG-0001: defina o mandato".

| Momento | O que acontece |
|---|---|
| **O negócio chega à etapa Proposta** | Ao mover um negócio de compra para a etapa Proposta (no Funil ou na ficha do cliente), a negociação nasce, se o negócio tem imóvel e ainda não tem negociação em andamento. Vale também para o negócio que você cria e que já nasce na Proposta (quando ela é a primeira etapa em andamento ativa do seu funil); ao registrar uma oferta para um imóvel sem negócio, a oferta entra na negociação que nasceu assim. A tela avisa: "A negociação NG-0001 foi aberta e quem conduz é o Negociador IA". Sem imóvel no negócio, nada nasce: abra a negociação à mão quando escolher o imóvel. A negociação e a tarefa do mandato nascem juntas; se algo falhar ao abri-la, o negócio muda de etapa do mesmo jeito e você abre a negociação à mão. Os negócios que chegam pelo formulário da sua página não abrem negociação sozinhos |
| **O cliente pede desconto ou fala de preço** | Numa mensagem do portal ("tem desconto à vista?", "achei caro", "aceita proposta?", "qual o valor?"). A mensagem continua chegando a você, com a tarefa "Responder a mensagem do portal". Mandada da seção de uma negociação, ela vale para aquela negociação; mandada de outro lugar, para a única negociação em andamento do cliente ou, sem nenhuma, para o único negócio de compra em aberto dele com imóvel. Se o **Negociador IA** conduz e há mandato vigente, ele prepara a resposta a essa mensagem, com as mesmas 7 garantias de sempre: no "pergunta antes", a sugestão espera a sua aprovação; no "faz sozinho", só uma contraproposta montada pelo código sai pelo portal. Conduzida por você ou pelo negociador humano, o Negociador IA não responde por vocês. A mesma mensagem entregue de novo em até 10 minutos (inclusive duas vezes ao mesmo tempo) não faz o Negociador responder duas vezes; se a IA falhou ou estava fora do ar naquela mensagem, a entrega repetida dela tenta de novo. Uma negociação indicada que não é deste cliente (de outro cliente seu ou de outra conta) é ignorada: fica só a tarefa. O WhatsApp do app ainda não existe: quando existir, a conversa de lá também passa por este momento |
| **O cliente reage "Conversar sobre o preço"** | Na seleção ou no portal. Vira a tarefa "Conversar sobre o preço: IM-0001 · título" e o Negociador entra na negociação daquele imóvel (ou a abre, no negócio de compra do cliente com aquele imóvel) |
| **Uma oferta é registrada ou feita no portal** | Como antes: o Negociador IA roda sobre a oferta (ver [No Portal do Cliente](#no-portal-do-cliente)) |

Quando não dá para saber de qual negociação o cliente fala (duas em andamento, ou nenhuma e mais de
um negócio de compra com imóvel), nada nasce: você recebe a tarefa de sempre e decide.

O aceite final continua só seu, em qualquer caso: nenhum desses momentos fecha acordo, mexe no
mandato ou leva nada ao proprietário.

## Negociador humano

Uma pessoa que o corretor convida para conduzir negociações por ele: um sócio, um especialista ou
alguém da equipe dele. É opcional: o padrão continua sendo o Negociador IA. A pessoa entra na
**conta do corretor** com o papel `negociador` e não precisa de CRECI.

### O que o negociador vê e faz

- **Aviso:** quando recebe uma negociação (atribuída pelo corretor ou por ser o negociador padrão da
  conta), a pessoa recebe uma notificação da plataforma só para ela: "Você recebeu a negociação
  NG-0001 no Portal do Corretor", com o link para a negociação. O aviso não traz o nome do cliente,
  telefone nem valores. Atribuir de novo a mesma pessoa não repete o aviso.
- **Menu:** só **Hoje** (as negociações atribuídas a ele) e **Negociações**. Conversas entra quando
  houver WhatsApp. Ele não vê clientes, imóveis, Estúdio, Página, Números nem Ajustes: essas telas
  mostram "Esta área não está liberada para você", e a API responde `403 SEM_PAPEL`.
- **Só as negociações atribuídas a ele.** As outras da conta não aparecem na lista e, pelo endereço,
  respondem "não encontrado" (`404`), como a negociação de outra conta. Retirada a atribuição, ele
  deixa de ver a negociação na hora.
- **A tela da negociação** é a mesma do corretor, com o mandato **em leitura e completo**, inclusive
  o alvo, o ponto de recuo e a BATNA do vendedor: ele os lê, mas não os muda. Como ele propõe
  valores, esconder o recuo não adiantaria (a recusa de um valor abaixo dele já o revelaria). O
  cliente, o portal, os eventos e a vitrine continuam sem nenhum dos três.
- **Pode:** pedir sugestão ao Negociador IA; enviar, fazer agora, editar ou descartar a sugestão
  (tudo o que ele registra ou envia passa pelas 7 garantias do código, as mesmas do Negociador IA:
  nada abaixo do recuo, passo, rodadas, concessões, sigilo, validade e canal); registrar a oferta do cliente e a resposta do
  vendedor (aparece como "Negociador" na escada de propostas); atualizar a leitura do comprador;
  **Assumir** (passa a conduzir) e **Devolver ao Negociador** IA.
- **Não pode** (a API responde `403 SO_O_CORRETOR`): aceitar o acordo final ("Passar ao
  proprietário"), registrar a decisão do proprietário, criar ou editar o mandato, abrir negociação
  nova, encerrar a negociação, trocar quem conduz pelo formulário da negociação, convidar pessoas e
  atribuir negociações.

### Como o corretor convida e atribui

1. Em **Ajustes › Negociador › Quem negocia por padrão**, **Convidar negociador** pede só o e-mail.
   A pessoa recebe o link por e-mail e entra na **sua** conta (o convite é sempre para a conta em que
   você está). Os convites aparecem ali, com **Revogar** enquanto estão pendentes.
2. Depois do aceite, o **administrador do app** atribui o papel `negociador` à pessoa em
   **Configurações › Usuários**, seção Externos (o app não pode atribuir papel sozinho). Até lá,
   ela aparece como **falta o papel** e não recebe negociações. Também aparece assim quem tem o
   papel mas perdeu o acesso ao app (ou quando a plataforma não consegue confirmar o acesso agora).
3. Na negociação (Clientes › Negociações), o cartão **Quem negocia**, à direita, tem **Atribuir a um
   negociador** (escolha a pessoa) e, com uma atribuída, **Trocar negociador** e **Retirar do
   negociador**. Atribuir faz a pessoa conduzir a negociação; retirar a devolve a você. Uma pessoa
   por negociação: atribuir a outra tira a anterior.
4. Para que toda negociação nova já nasça com ela, escolha a pessoa em **Ajustes › Negociador ›
   Quem negocia por padrão › Conduz as negociações novas**. Só aparecem ali as pessoas marcadas
   **pronto**. Se a pessoa perder o papel, perder o acesso ao app ou sair da conta, as negociações
   novas voltam a nascer com o Negociador IA, sem atribuição nem aviso. Isso vale para as que o
   app cria numa ação sua (como mover o negócio para Proposta) e também para as abertas pelas
   reações e mensagens do cliente: ali o app confere ao menos o papel e o acesso da pessoa, e,
   sem como conferir o acesso, a negociação nasce com o Negociador IA. Escolher
   **Negociador IA (padrão)** tira a pessoa.

Quando o convite não sai, a tela diz por quê. Os casos mais comuns:

| Código | O que quer dizer |
|---|---|
| `CONVITE_MULTI_USUARIO_BLOQUEADO` | A política "permite contas multi-usuário" está desligada na instância: o negociador humano não está disponível, e o Negociador IA segue funcionando |
| `PROVISIONA_NAO_LIBERADA` | O administrador da instância ainda não liberou os convites deste app para contas existentes |
| `PROVISIONA_NAO_DECLARADA` | A versão instalada do app não convida pessoas |
| `CONVITE_CONTA_DIVERGENTE` | A pessoa já usa a plataforma por outra conta (um usuário externo pertence a uma conta só) |
| `CONVITE_IDENTIDADE_INTERNA` | O e-mail é de alguém da equipe da plataforma |
| `CONVITE_JA_PENDENTE` | Já há um convite pendente para o e-mail |
| `PLANO_ASSENTOS_ESGOTADOS` | O plano da conta não tem mais lugares |
| `NEGOCIADOR_SEM_PAPEL` (409) | Ao atribuir ou escolher como padrão: a pessoa aceitou o convite, mas ainda não tem o papel negociador ou perdeu o acesso ao app |
| `NEGOCIADOR_NAO_ENCONTRADO` (404) | Ao atribuir ou escolher como padrão: a pessoa não aceitou convite desta conta |
| `CONVITE_INDISPONIVEL` (503) | Esta instância não oferece ao app o provisionamento de convites (não é falha passageira): fale com o administrador da instância |

Se o e-mail do convite não sair, o convite fica valendo e a tela avisa (peça à pessoa para olhar o
spam, ou revogue e convide de novo).

**Antes de convidar:** a tela e o diálogo de convite avisam que a instância precisa da política
"permite contas multi-usuário" ligada e que quem entra na conta vê os contatos que chegam pela página
e os recados dos clientes (abaixo). O app não tem como consultar essa política antes: só sabe no
convite, quando ela recusa com `CONVITE_MULTI_USUARIO_BLOQUEADO` (pedido ao shell para expor a política).

**O que o negociador vê pelo barramento:** como membro da conta, ele lê os eventos do app pelo
barramento da plataforma, e o barramento não filtra por negociação nem por papel. Isso vale para
as cinco formas de ler um evento: a lista de eventos, a busca de um evento avulso, o acompanhamento
ao vivo, o replay de quem reconecta e as notificações por inscrição. As telas e rotas do app só mostram as atribuídas.
O mesmo vale para os demais eventos da conta (clientes, visitas, negócios, imóveis, página, Estúdio e canais; ver
[Avisos e eventos](eventos.md)): ele os lê, e eles levam só ids, rótulos fechados e, nos de canal, o nome do corretor que agiu.

- **Eventos de negociação** (`negociacao_iniciada`, `proposta_recebida`, `mandato_alterado` e os
  outros): levam **só ids** (negociação, negócio, proposta, mandato, objeção, execução). Sem nome,
  telefone, e-mail, valores, recuo, alvo nem BATNA. De uma negociação que não é dele, o negociador
  vê só que algo aconteceu nela; para abrir, a rota responde "não encontrado".
- **Risco residual:** três eventos nascem num webhook público (formulário, seleção e portal), onde a
  plataforma ainda não deixa o app gravar na conta antes de publicar. O dado chega ao app só pelo
  evento, e o negociador também o lê:
  - `lead_recebido`: nome, telefone, e-mail e mensagem de quem pediu contato pela página;
  - `reacao_recebida`: o comentário do cliente na reação a um imóvel da seleção;
  - `acao_cliente_recebida`: o texto da mensagem que o cliente mandou pelo portal (e o valor de uma
    oferta, que não é dado pessoal).

  Esse dado também fica guardado no histórico de eventos da plataforma até a limpeza automática por
  retenção (o prazo é da instância).

  Fechar isso depende da plataforma (pedido ao shell). Até lá, **convide só quem pode ver os
  contatos que chegam pela sua página e pelo portal.**

  Um teste do app emite todos os eventos pelos caminhos reais (rotas, webhooks e listeners), com
  nome, telefone e e-mail em tudo o que entra, e reprova se algum desses dados aparecer fora dos campos residuais acima, ou se um evento novo surgir sem passar por ele.

### O que o dono da instância precisa ligar

Sem isto, o convite é recusado com a mensagem do código correspondente:

- **Admin › Instaláveis › Apps › Portal do Corretor:** o provisionamento de externos ligado (master
  switch) e a capacidade **admitir em conta existente**. A capacidade "criar conta" é a que a
  equipe da plataforma já usa para convidar corretores.
- **Nível padrão do externo** (`permissao_padrao_externo`, em Admin › Instaláveis › Apps) em
  **escrita** ou acima (o teto é escrita): sem ele o papel `negociador` não pode ser atribuído
  (`permissoes.md`).
- **Política "permite contas multi-usuário" ligada** na instância. Desligada, o segundo externo da
  conta (o negociador, depois do corretor) é recusado, no convite e no aceite.
- **Assentos:** se a conta tem plano com teto de assentos, o negociador ocupa um lugar.
- **O e-mail de sistema** da instância ligado e com domínio (o convite vai por e-mail).
- **O papel `negociador`** atribuído à pessoa em **Configurações › Usuários** (seção Externos) pelo
  administrador do app, depois que ela aceitar o convite.

## Trocar de conta no meio de uma negociação

Quem atende mais de uma conta (ou tem a conta trocada pela equipe da plataforma) pode mudar de conta
com uma negociação aberta. Nesse momento a tela de **Negociações** abre de novo, do zero, já na conta
nova: a negociação que estava aberta, a sugestão, a faixa e o mandato da conta anterior saem da tela.

O app confere a conta num lugar só, no envio de todo pedido ao servidor: se a resposta (ou o erro) de
um pedido feito na conta anterior chega depois da troca, ela é descartada em silêncio, e nada dela
aparece na conta nova, nem como aviso de erro. Vale para pedir sugestão, enviar, aprovar, registrar
proposta e salvar o mandato. O que já tinha sido gravado antes da troca fica gravado na conta em que
foi feito; confira lá, voltando a ela. Ver também [Trocar de conta](conta-e-ajustes.md#trocar-de-conta).

## Respostas a objeções

O app traz respostas prontas para as 10 objeções mais comuns: preço, "vou pensar", "vi mais
barato", localização, estado do imóvel, financiamento, decisão com outra pessoa, prazo, condomínio
e IPTU, e documentação. Para cada uma: a pergunta para explorar, a resposta com critério objetivo e
o próximo passo. Elas entram em toda conta quando o app inicia.

O corretor pode **editar a própria resposta** de uma categoria ou **voltar ao padrão**. A resposta
padrão nunca é apagada nem reescrita.

## Para o administrador da instância

- **Negociador humano:** para o corretor convidar, ligue o provisionamento do app com "admitir em
  conta existente" e a política "permite contas multi-usuário"; depois do aceite, atribua o papel
  `negociador` em Configurações › Usuários — ver [O que o dono da instância precisa ligar](#o-que-o-dono-da-instância-precisa-ligar).
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
