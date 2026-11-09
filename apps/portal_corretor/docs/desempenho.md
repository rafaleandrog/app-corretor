---
titulo: Números, envios e dados de demonstração
descricao: Os números do corretor (leads, conversão por etapa e por canal, gráficos, vendas, VGV, previsão de comissão, negociação), o histórico de envios e a conta de demonstração.
---

# Números, envios e dados de demonstração

## Números

**Números** (o antigo Desempenho; o endereço `/desempenho` continua abrindo) fica no desenho em
colunas (no celular, uma por vez, com abas):

- **À esquerda, os relatórios:** **Resumo** · **Funil e conversão** · **Origem dos contatos** ·
  **Conteúdo** · **Negociação**. Números abre em **Funil e conversão**. Tempo de resposta e
  Mensageiro só aparecem quando o WhatsApp chegar, e Créditos não entram em Números.
  O relatório aberto fica no endereço (`/numeros?relatorio=funil`; o antigo `?item=` também abre).
- **No centro, o relatório aberto.** No alto, o título e três escolhas:
  - o **período**: 7, 30 ou 90 dias, ou 12 meses (`?dias=30`), sempre comparado ao período anterior
    de mesmo tamanho;
  - **Comparar**: ligado (o padrão), cada número traz a comparação em texto pequeno e os gráficos
    mostram o período anterior ao lado; desligado (`?comparar=0`), só o período;
  - a **origem**: **Todas as origens** ou um canal que teve leads (`?origem=instagram`). Com um
    canal, todos os números contam só os negócios daquele canal; as visitas feitas, que não têm
    origem, aparecem como "—".

  As escolhas ficam no endereço sem criar entrada no histórico do navegador (o Voltar não as
  desfaz), e recarregar ou abrir o link guardado mantém as mesmas. Se a leitura do filtro novo
  falhar, a tela mostra o erro, com a opção de tentar de novo, e não os números do filtro anterior.
- **À direita:**
  - **O que melhorar**: uma leitura curta feita pelo app com os números do período, sem IA. Ela
    aponta o passo do funil em que mais se perde (entre contato → visita, visita → proposta e
    proposta → venda) e o motivo de perda informado mais comum (as perdas marcadas sem motivo não
    entram nessa escolha). Havendo esse motivo, **Ver os N clientes**
    abre Clientes só com quem teve negócio de compra perdido por ele desde o início do período (e
    do canal escolhido, se houver). N conta clientes, não negócios: dois negócios perdidos do mesmo
    cliente contam um, e negócio sem cliente não conta. Em Clientes, uma faixa diz que o filtro veio de Números, com **Tirar o
    filtro**;
  - **Melhores origens**: até quatro canais, os que mais levaram leads do período à visita (no
    empate, os com mais leads), com as visitas e os leads de cada um;
  - **Exportar CSV**: baixa uma planilha (separador `;`) com um indicador por linha, o período e o
    anterior: leads, etapas, taxas, vendas, VGV, ciclo, visitas, captações, comissão prevista,
    leads fora do horário, peças publicadas, leads por origem, perdas por motivo e leads por hora.
    Só números da conta, nenhum dado de cliente;
  - **Perguntar ao Assistente**.

Os quatro números de cada relatório ficam numa linha (no celular, em pílulas), em janelas a partir de ~1377 px de largura; abaixo disso o quarto cai para a linha de baixo até o shell ajustar o `urbi-grid` (pedido 31). Valores em reais
de R$ 1.000 para cima aparecem sem centavos ("R$ 104.825"); abaixo disso, com centavos.

### Resumo

Quatro números: **Leads**, **Conversão total**, **Vendas** e **Comissão prevista**. Abaixo de cada
um, em texto pequeno, a comparação com o período anterior ("+3 que nos 30 dias anteriores"; nas
taxas, em pontos). A comissão prevista não tem comparação: é a previsão de hoje, sobre os negócios
em andamento. Depois, **Resultados** (VGV, ciclo médio, visitas feitas e captações) e **Leads ao
longo do período**.

### Funil e conversão

Quatro números: **Contatos** (os leads), **Contato → visita**, **Visita → proposta** e **Ganhos**
(com o valor das vendas, quando há). Depois:

- **Até onde os contatos chegaram**: as colunas de cada etapa (explicadas abaixo) e, abrindo o
  cartão, as taxas entre etapas;
- **Contatos por horário**: a hora do dia em que cada lead do período chegou, no fuso da conta, com
  os que chegaram **fora do horário comercial** (antes das 8h ou a partir das 19h) em destaque e a
  conta "N de M no período". O app ainda não tem horário de atendimento configurável, por isso vale
  esse horário fixo;
- **Por que perdemos**: os motivos de perda do período.

### Origem dos contatos

**Leads por canal** (pizza), **Situação por canal** (dos leads de cada canal, quantos estão ganhos,
em andamento e perdidos hoje) e a tabela **Por canal**: leads, quantos visitaram, em andamento,
ganhos, perdidos e a conversão de cada canal.

### Conteúdo

**Conteúdo** mostra as **peças publicadas** pelo Estúdio no período e os **leads do Instagram**
(pela origem do contato), com a comparação. Alcance, cliques e leads de cada peça ainda não têm
fonte.

### Negociação

Os números das negociações da conta no período escolhido. Com **Comparar** ligado (o padrão), cada
número traz a comparação em texto pequeno (taxas e porcentagens em pontos; contagens e médias em
diferença simples) e o gráfico de objeções mostra o período anterior ao lado, nas mesmas categorias
do período atual. A comparação só aparece quando há valor nos dois períodos: sem valor em qualquer
um deles, some (nunca "0"). Contagens, como Propostas recebidas, são sempre número e por isso
comparam também contra 0. Com Comparar desligado, só o período atual.
São só somas e médias: nenhum valor do mandato (recuo, alvo, BATNA) nem a estimativa do teto do
comprador aparece, e nada é mostrado negociação por negociação. O filtro de origem não vale neste
relatório (a escolha some do alto dele). Quando falta dado, aparece uma frase no lugar do número.

| Número | Como é contado | Sem dado |
|---|---|---|
| **Propostas recebidas** | Propostas do comprador registradas no período (pelo portal, pelo WhatsApp ou pelo corretor) | "Nenhuma proposta no período" |
| **Taxa de acordo** | Das negociações encerradas no período, quantas foram ganhas; abaixo, "N de M encerradas" | "Nenhuma negociação encerrada no período" |
| **Desconto médio** | Nas ganhas no período, a média de (preço pedido − valor final) ÷ preço pedido. O preço pedido é o do mandato ligado à negociação; ganha sem mandato fica de fora. Venda acima do pedido entra como desconto negativo | "Nenhum acordo com preço pedido no período" |
| **Rodadas até o acordo** | Média de rodadas das negociações ganhas no período | "Nenhum acordo no período" |
| **Acordos dentro da ZOPA** | Das ganhas no período que têm o recuo do mandato ligado à negociação, o teto do comprador estimado e o valor final, quantas fecharam entre o seu recuo e esse teto. As que não têm algum desses três (por exemplo, sem estimativa ou sem mandato) são contadas à parte | "Nenhum acordo com o teto do comprador estimado" (ou "Nenhum acordo no período") |
| **Sugestões aprovadas sem edição** | Das sugestões do Negociador enviadas no período (aprovadas ou editadas por você, pela data da decisão), quantas saíram sem edição; abaixo, "N de M enviadas". Envio automático e descartadas não entram | "Nenhuma sugestão do Negociador enviada no período" |
| **Objeções mais frequentes** | Objeções detectadas no período, por tipo (os mesmos nomes de Ajustes › Negociador › Respostas a objeções), da mais comum para a menos | "Nenhuma objeção registrada no período." |

"Encerrada no período" e "ganha no período" valem pela data em que a negociação foi encerrada.
Só o corretor da conta e o admin do app abrem este relatório; quem negocia por ele (o negociador
convidado) não vê Números.

### Como cada número é contado

**Até onde os contatos chegaram** (em Funil e conversão). A turma é a dos negócios de compra
**abertos no período** (os leads). Para cada um, conta até onde ele chegou, mesmo que depois tenha
recuado ou sido perdido. O cartão mostra um gráfico de colunas das etapas (com Comparar, o período
anterior ao lado) e quantos **clientes únicos** há entre os leads (um cliente com dois negócios
conta uma vez):

| Etapa | Conta |
|---|---|
| Leads | Negócios de compra abertos no período |
| Em atendimento | Dos leads, quantos chegaram a "Em atendimento" ou além |
| Visitaram | Dos leads, quantos chegaram a "Visitou" ou além |
| Proposta | Dos leads, quantos chegaram a "Proposta" ou além |
| Ganhos | Dos leads, quantos foram ganhos |

Abrindo o cartão (seta), aparecem as taxas entre etapas, com a comparação em pontos:

| Taxa | Conta |
|---|---|
| Lead → atendimento | Em atendimento sobre leads |
| Lead → visita | Visitaram sobre leads |
| Visita → proposta | Dos que visitaram, quantos chegaram à proposta |
| Proposta → ganho | Dos que chegaram à proposta, quantos foram ganhos |

A conversão total (ganhos sobre leads) é um dos quatro números do Resumo e também aparece entre as taxas.

"Chegar a uma etapa" vale pelo papel da etapa no funil, não pelo nome: renomear "Visitou" não
muda a conta. Etapa criada pelo corretor não tem papel próprio: o negócio continua contado nos
leads e vale o papel mais avançado que ele já alcançou nas etapas padrão. Para negócios abertos
antes desta versão, o app só sabe a etapa atual: um negócio desses que já foi perdido não conta
como tendo chegado a visita ou proposta. Sem leads, as taxas aparecem
como "—".

**Comissão prevista** (no Resumo) é a soma, nos negócios em andamento, de valor × comissão × chance
da etapa (Ajustes › Funil). Negócio sem valor ou sem comissão fica de fora e é contado à parte.

**Resultados** (cartão) traz o resto: VGV (soma do valor estimado das vendas), ciclo médio (dias
entre abrir e ganhar), visitas feitas e captações (negócios de venda abertos no período que
chegaram à autorização assinada). **Vendas**, no Resumo, são os ganhos no período.

**Leads ao longo do período**: os leads abertos em cada intervalo, ao lado do período anterior na
mesma posição. Intervalo de um dia em 7 e 30 dias, de uma semana em 90 dias e de um doze avos do ano
em 12 meses.

Ainda sem fonte: tempo de primeiro atendimento e números do atendimento automático (o Mensageiro),
que chegam com o WhatsApp; alcance do conteúdo; custo por lead e por venda (o investimento por
canal ainda não se informa no app), comissão recebida e metas, em versões seguintes.

**Hoje** mostra, à direita, **Sua semana**: contatos novos, leads e visitas feitas nos últimos 7 dias
e a comissão prevista.

## Enviados ao cliente

Na ficha do cliente, na aba **Enviados** (o botão **+**) ou no topo da aba **Linha do tempo**, **Registrar envio** anota o que o corretor mandou (imóvel, arquivo,
mensagem, localização) e por onde (WhatsApp, e-mail, pessoalmente). Com um imóvel, o app devolve
a mensagem pronta para colar no WhatsApp (nome do cliente, título, bairro e preço; nunca o
proprietário nem o endereço completo). O envio conta como contato com o cliente e entra na linha
do tempo. A ficha do imóvel mostra a quem ele foi enviado.

Com a Página no ar e o imóvel publicado, a mensagem leva um link rastreado: o cartão
**Enviados ao cliente** da ficha mostra quantas vezes ele abriu — ver [Página, ficha pública e link rastreado](minha-pagina.md#link-rastreado).

## Dados de demonstração

Nas contas de teste (nome terminado em "(demo)"), Hoje oferece **Gerar dados de
demonstração** enquanto a conta não tem nenhum contato. Os dados são os do guia das telas, e o
corretor de teste é o responsável por tudo. Origens que já existem são reaproveitadas, e imóveis
e negociações recebem o próximo código livre. Se alguma etapa padrão foi renomeada ou removida, o
app avisa qual é e não grava nada.

Além dos clientes, imóveis e da negociação, a geração deixa a demonstração pronta para mostrar
todas as telas:

- **fotos de exemplo** nos imóveis ativos (imagens simples geradas pelo app: 12 na casa, 8 no
  apartamento, 3 no lote);
- **autorização de venda assinada**, com o documento anexado (um PDF de exemplo, sempre interno),
  em cada imóvel ativo; a da casa é exclusiva. Os proprietários entram como contatos com o papel
  proprietário (Helena Duarte, Sérgio Mattos e Wagner Lopes; no segundo corretor, Otávio Reis);
- os imóveis ativos **marcados para a Minha Página** e a **página publicada**, com o endereço livre
  sugerido pelo nome do corretor;
- a **conversa** da Ana (quatro mensagens de exemplo), uma **seleção** com os três imóveis ativos e
  o **portal do cliente** dela, que entram na conversa como cartões.
- o **WhatsApp fictício** do corretor no perfil (é dele que sai o "Falar no WhatsApp" da capa da
  página pública) e os **imóveis em destaque** da página (a casa e o apartamento);
- no Estúdio, quatro **peças** de exemplo: duas em rascunho sem arte (falta a arte), uma em rascunho
  com arte (para aprovar) e uma aprovada. As duas que têm arte (a de rascunho e a aprovada) só são
  criadas quando o envio de arquivos está disponível na instância; sem ele, entram só as duas sem
  arte. O mesmo vale para as fotos de exemplo e a autorização com documento. Nada é agendado nem
  publicado no Instagram, e nenhum evento é disparado.

**Rodar de novo completa o que falta e não duplica nada.** Numa conta que já tem contatos, o botão
(ou `POST /demo/semear`) só acrescenta o que ainda não existe: fotos só em imóvel sem foto,
autorização só em imóvel sem autorização vigente, dados só nos campos vazios, conversa, seleção e
portal só se a Ana ainda não tem. A conversa da Ana gravada por versões anteriores também é
corrigida: antes, as mensagens, o cartão da seleção e o link do portal dela eram gravados como
anotação, e o portal esconde anotação; rodar de novo as transforma em conversa de verdade, e a Ana as
vê na aba Conversa do portal. Só mudam as mensagens idênticas às da demonstração (o que você
escreveu na conversa dela fica como está), e a resposta traz "conversa de Ana Ribeiro no portal"
com o número de mensagens corrigidas. O WhatsApp fictício do corretor só entra se o perfil não tem telefone (sem perfil, o perfil é criado
já com ele; o número que o corretor digitou fica); os
destaques, só se o bloco está ligado e vazio (a escolha do corretor fica); as peças, só se a conta
não tem nenhuma. Uma página já salva fica com o endereço e os blocos dela; se não
está no ar, é publicada. A escada antiga da negociação (até a versão 0.1.49) é trocada pela do guia
só quando está exatamente como a semente antiga gravou. A resposta diz o que foi feito
(`completado`) e o que não deu certo sem mudar nada (`avisos`, uma lista de textos, vazia quando
tudo correu bem; por exemplo "página não publicada: Este endereço já é de outra página. Escolha
outro."). Aviso não conta como completado: sem mais nada a fazer, a geração é recusada como antes e
a mensagem traz o aviso entre parênteses. Sem nada a completar, a geração é recusada como antes ("Esta conta já tem
contatos").

**Qual conjunto cada conta recebe.** Ao iniciar, o app marca as contas de teste:

- a de **menor número** (id) é a principal e recebe o conjunto completo do corretor de
  demonstração, Rafael Gualberto;
- as outras recebem um conjunto **menor e diferente**, o do segundo corretor, para o roteiro de
  isolamento: um corretor nunca vê nada do outro.

A marca é decidida quando o app vê a conta pela primeira vez e não muda depois. Por isso, se for
criada depois uma conta de teste de número menor, ela também vira principal, e a que já era
principal continua sendo: pode haver mais de uma conta principal.

Depois de uma atualização do app, a conta de teste que já tinha gerado a demonstração antiga
continua com os clientes e imóveis dela; gerar de novo só completa o que faltar (acima).

**O corretor.** O nome que aparece é o do usuário na instância (crie o usuário de teste como
"Rafael Gualberto"). Se o corretor ainda não tem perfil, ganha um CRECI fictício (DF-12345-F; no
segundo corretor, DF-54321-F) e um WhatsApp fictício (+55 61 99000-0100; no segundo corretor,
+55 61 99000-0200), de onde sai o "Falar no WhatsApp" da página pública. Se já tem perfil, o
perfil fica como está, com ou sem CRECI; só o telefone entra, e só se estiver vazio. **Nada
depende do CRECI.**

### Conjunto do guia (conta principal)

| Cliente | Etapa | Valor | Origem | Temperatura (pela regra) |
|---|---|---|---|---|
| Ana Ribeiro | Proposta; visita sábado às 10 h; em negociação | R$ 1.450.000 | Instagram | quente |
| Juliana Prado | Proposta (R$ 920 mil no apartamento do Sudoeste) | R$ 920.000 | Portal imobiliário | quente |
| Carlos Menezes | Qualificado | R$ 800.000 | Minha Página | morno |
| Fernanda Souza | Novo (quer lote) | R$ 400.000 | Indicação | morno |
| Roberto Lima | Em atendimento, sem resposta há 9 dias | R$ 600.000 | WhatsApp | frio |
| Marcos Teixeira | Visitou o lote há 12 dias (nota 3) | R$ 395.000 | Placa | frio |

Todos com comissão de 5%. As temperaturas não são gravadas à mão: saem da regra de sempre, a
partir da etapa, das visitas e do último contato.

| Imóvel | Preço | Situação | Qualidade |
|---|---|---|---|
| Casa 4 quartos · Jardim Botânico (320 m²) | R$ 1.450.000 | ativo | 100 |
| Apartamento 3 quartos · Sudoeste (112 m²) | R$ 980.000 | ativo | 80 (descrição curta) |
| Lote 450 m² · Reserva do Colorado Q1-03 | R$ 395.000 | ativo | 70 (3 fotos) |
| Cobertura 3 quartos · Noroeste (180 m²) | R$ 2.100.000 | rascunho | 35 (sem fotos, descrição nem autorização) |

A nota de qualidade é a do cálculo real, e a semente não força nada. Ela anda de 5 em 5, por isso
fica no valor mais perto possível dos números do guia (92, 78, 64 e 41) com dados coerentes.

**A negociação (tela de negociações).** Ana · Casa Jardim Botânico, conduzida pelo Negociador IA:

- **Mandato:** pedido R$ 1.450.000, alvo R$ 1.400.000, ponto de recuo R$ 1.360.000 (sigiloso),
  4 rodadas, autonomia "pergunta antes", válido por 5 dias. As concessões são o prazo de entrega
  de 60 dias, em troca de entrada de 30%, e os móveis planejados da cozinha, em troca de
  fechamento em 7 dias.
- **Escada (a do guia):** o anúncio pede 1.450.000; a Ana oferece 1.300.000; o Negociador responde
  1.400.000 (enviada pelo portal); a Ana sobe a 1.320.000. Estamos na rodada 2 (cada oferta do
  comprador abre uma rodada).
- **Teto estimado do comprador:** R$ 1.390.000.
- **Objeção registrada:** preço.

### Conjunto do segundo corretor (as outras contas de teste)

- **Clientes:** Bruno Costa (Em atendimento, WhatsApp, R$ 520.000) e Lívia Rocha (Novo,
  indicação, R$ 450.000).
- **Imóvel:** um, o Apartamento 2 quartos · Águas Claras (R$ 520.000), com 2 fotos, autorização
  assinada e na página do segundo corretor.
- Nenhuma negociação.

### Conferência manual (conta principal, últimos 30 dias, logo depois de gerar)

- Leads: **6**, todos de compra, em 6 clientes únicos.
- Etapas: 6 leads, 5 em atendimento (todos menos a Fernanda), 3 visitaram (Ana, Juliana e Marcos,
  porque quem chegou à proposta passou pela visita), 2 na proposta, 0 ganhos.
- Lead → atendimento: 5 de 6 = **83%**.
- Lead → visita: 3 de 6 = **50%**.
- Visita → proposta: 2 de 3 = **67%**.
- Proposta → ganho: **0%**.
- Conversão total: **0%**.
- Vendas: **0**. VGV: **R$ 0**. Captações: **0**.
- Visitas feitas: **1** (Marcos).
- Por origem: cada canal com 1 lead em andamento (Instagram, Portal imobiliário, Minha Página,
  Indicação, WhatsApp, Placa).
- Hoje, Sua semana: 9 contatos novos (os 6 clientes e os 3 proprietários), 6 leads, 5 atendidos.
- Funil e conversão: Contatos **6**, Contato → visita **50%**, Visita → proposta **67%**, Ganhos
  **0**; Contatos por horário soma 6.
- O que melhorar: sem perdas, só a leitura do funil ("67% das visitas viram proposta, mas só 0% das
  propostas viram venda"), sem o botão Ver os N clientes.
- Melhores origens: primeiro os canais com 1 visita (Instagram, Portal imobiliário e Placa), depois
  um canal com 1 lead e nenhuma visita.
- Comissão prevista: 5% × (1,45 mi × 70% + 920 mil × 70% + 800 mil × 20% + 400 mil × 5% + 600 mil
  × 10% + 395 mil × 50%) = **R$ 104.825**.
- **Negociação:** última oferta × pedido = 1.320.000 ÷ 1.450.000 = **−9%**. ZOPA de R$ 1.360.000
  (recuo) a R$ 1.390.000 (teto estimado). O vendedor já concedeu R$ 50.000, e a próxima concessão
  cabe em 40% de (1.400.000 − 1.360.000) = **R$ 16.000**.
