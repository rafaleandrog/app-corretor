---
titulo: Negociação e mandato
descricao: As negociações de um negócio, o mandato do vendedor (o que é sigiloso e quem vê), as propostas, os ajustes do Negociador e as respostas a objeções.
---

# Negociação e mandato

A partir da versão 0.1.13 o app guarda as **negociações**: a etapa em que o corretor (ou o
**Negociador**, o assistente de negociação do app) troca propostas com o comprador até um acordo.
Nesta versão existem os dados e as regras; as telas (Clientes › Negociações, o formulário do
mandato e Ajustes › Negociador) e as sugestões do Negociador chegam nas versões seguintes. Até lá,
nenhum item novo aparece no menu, e **Criar › Nova proposta** só abre a ficha do cliente.

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

Outro corretor nunca vê nada da negociação de outra conta: a resposta é "não encontrado".

## Propostas

Cada proposta registra quem propôs (comprador, vendedor ou proprietário), o valor, as condições, a
concessão, a contrapartida e a validade. Nesta versão o corretor **registra** as propostas
(canal "registro"); o envio pelo Portal do Cliente e pelo **Fazer agora** (o WhatsApp do celular
do corretor) chega com o Negociador, sempre conferido contra o mandato antes de sair.

A **rodada** é calculada pelo app: cada oferta do comprador abre uma rodada, e a resposta do
vendedor ou do proprietário fica na rodada aberta. A negociação guarda o número de rodadas.

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

- **Eventos** (todos da conta do corretor; o clique leva à tela Clientes, mas nesta versão ela só tem as visões Lista e Quadro, então o link ainda não abre a negociação): negociação iniciada,
  oferta do comprador recebida, proposta registrada, mandato alterado, negociação encerrada e
  "o Negociador precisa de você" (limite do mandato atingido; passa a sair com o Negociador). O
  conteúdo desses eventos nunca leva valores do mandato.
- **Respostas a objeções:** semeadas a cada início do app, em toda conta ativa, sem duplicar. Conta
  criada depois do último início recebe as respostas no próximo; até lá, essa conta não tem as respostas. Nesta versão ainda não existe tela de respostas a objeções: elas só existem nos dados da conta.
