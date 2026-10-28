---
titulo: Números, envios e dados de demonstração
descricao: Os números do corretor (leads, conversão por etapa e por canal, gráficos, vendas, VGV, previsão de comissão), o histórico de envios e a conta de demonstração.
---

# Números, envios e dados de demonstração

## Números

**Números** (o antigo Desempenho; o endereço `/desempenho` continua abrindo) já está no desenho em
colunas: à esquerda, os relatórios (por enquanto, o **Resumo do período**); no meio, o relatório
aberto; à direita, o que ainda não tem fonte e o botão **Perguntar ao Assistente**. O relatório
aberto fica no endereço (`?item=resumo`). O Resumo mostra os números do período escolhido (7, 30 ou 90 dias, ou 12 meses),
comparados ao período anterior de mesmo tamanho. O período fica no endereço (`?dias=30`). A troca não cria entrada no
histórico do navegador (o Voltar não desfaz a escolha), mas recarregar a página ou abrir o link
guardado mantém o mesmo período.

No topo, quatro números: **Leads**, **Conversão total**, **Vendas** e **Comissão prevista**. Abaixo
de cada um, em texto pequeno, a comparação com o período anterior ("+3 que nos 30 dias
anteriores"; nas taxas, em pontos). A comissão prevista não tem comparação: é a previsão de hoje,
sobre os negócios em andamento.

**Conversão** (cartão abaixo dos quatro números). A turma é a dos negócios de compra **abertos no
período** (os leads). Para cada um, conta até onde ele chegou, mesmo que depois tenha recuado ou sido
perdido. O cartão mostra quantos chegaram a cada etapa, a fatia dos leads e a comparação com o período
anterior, mais um gráfico de colunas das etapas (este período ao lado do anterior) e quantos
**clientes únicos** há entre os leads (um cliente com dois negócios conta uma vez):

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

A conversão total (ganhos sobre leads) é um dos quatro números do topo.

"Chegar a uma etapa" vale pelo papel da etapa no funil, não pelo nome: renomear "Visitou" não
muda a conta. Etapa criada pelo corretor não tem papel próprio: o negócio continua contado nos
leads e vale o papel mais avançado que ele já alcançou nas etapas padrão. Para negócios abertos
antes desta versão, o app só sabe a etapa atual: um negócio desses que já foi perdido não conta
como tendo chegado a visita ou proposta. Sem leads, as taxas aparecem
como "—".

**Comissão prevista** (no topo) é a soma, nos negócios em andamento, de valor × comissão × chance
da etapa (Ajustes › Funil). Negócio sem valor ou sem comissão fica de fora e é contado à parte.

**Resultados** (cartão) traz o resto: VGV (soma do valor estimado das vendas), ciclo médio (dias
entre abrir e ganhar), visitas feitas e captações (negócios de venda abertos no período que
chegaram à autorização assinada). **Vendas**, no topo, são os ganhos no período.

**Leads por canal** (gráfico de pizza) e **Situação por canal** (colunas empilhadas: dos leads de
cada canal, quantos estão ganhos, em andamento e perdidos hoje). Abrindo o cartão da situação, a
tabela por origem traz leads, em andamento, ganhos, perdidos e a conversão de cada canal.

**Leads ao longo do período**: os leads abertos em cada intervalo, ao lado do período anterior na
mesma posição. Intervalo de um dia em 7 e 30 dias, de uma semana em 90 dias e de um doze avos do ano
em 12 meses.

**Motivos de perda** (gráfico de colunas) fecham o relatório. Na coluna da direita, **Sobre estes números** explica o que ainda não tem fonte: tempo de primeiro atendimento e números do
atendimento automático (o Mensageiro) chegam com o WhatsApp; conteúdo publicado, com o Estúdio;
custo por lead, comissão recebida e metas, em versões seguintes.

**Hoje** mostra, à direita, **Sua semana**: contatos novos, leads e visitas feitas nos últimos 7 dias
e a comissão prevista.

## Enviados ao cliente

Na ficha do cliente, na aba **Enviados** (o botão **+**) ou no topo da aba **Linha do tempo**, **Registrar envio** anota o que o corretor mandou (imóvel, arquivo,
mensagem, localização) e por onde (WhatsApp, e-mail, pessoalmente). Com um imóvel, o app devolve
a mensagem pronta para colar no WhatsApp (nome do cliente, título, bairro e preço; nunca o
proprietário nem o endereço completo). O envio conta como contato com o cliente e entra na linha
do tempo. A ficha do imóvel mostra a quem ele foi enviado.

Com a Minha página no ar e o imóvel publicado, a mensagem leva um link rastreado: o cartão
**Enviados ao cliente** da ficha mostra quantas vezes ele abriu — ver [Minha página, ficha pública e link rastreado](minha-pagina.md#link-rastreado).

## Dados de demonstração

Nas contas de teste (nome terminado em "(demo)"), Hoje oferece **Gerar dados de
demonstração** enquanto a conta não tem nenhum contato. Os dados são os do guia das telas, e o
corretor de teste é o responsável por tudo. Origens que já existem são reaproveitadas, e imóveis
e negociações recebem o próximo código livre. Se alguma etapa padrão foi renomeada ou removida, o
app avisa qual é e não grava nada. Rodar de novo não duplica: com contatos na conta, a geração é
recusada.

**Qual conjunto cada conta recebe.** Ao iniciar, o app marca as contas de teste:

- a de **menor número** (id) é a principal e recebe o conjunto completo do corretor de
  demonstração, Rafael Gualberto;
- as outras recebem um conjunto **menor e diferente**, o do segundo corretor, para o roteiro de
  isolamento: um corretor nunca vê nada do outro.

A marca é decidida quando o app vê a conta pela primeira vez e não muda depois. Por isso, se for
criada depois uma conta de teste de número menor, ela também vira principal, e a que já era
principal continua sendo: pode haver mais de uma conta principal.

Depois de uma atualização do app, a conta de teste que já tinha gerado a demonstração antiga
continua com ela, porque a geração só acontece em conta sem contatos. Para ver o conjunto novo, use
uma conta de teste que ainda não tenha contatos.

**O corretor.** O nome que aparece é o do usuário na instância (crie o usuário de teste como
"Rafael Gualberto"). Se o corretor ainda não tem perfil, ganha um CRECI fictício (DF-12345-F; no
segundo corretor, DF-54321-F). Se já tem perfil, o perfil fica como está, com ou sem CRECI.
**Nada depende do CRECI.**

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
| Casa 4 quartos · Jardim Botânico (320 m²) | R$ 1.450.000 | ativo | 55 |
| Apartamento 3 quartos · Sudoeste (112 m²) | R$ 980.000 | ativo | 35 |
| Lote 450 m² · Reserva do Colorado Q1-03 | R$ 395.000 | ativo | 35 |
| Cobertura 3 quartos · Noroeste | R$ 2.100.000 | rascunho | 25 |

A nota de qualidade é a do cálculo real, e a semente não força nada. Por isso ela não bate com os
números do guia (92, 78, 64 e 41):

- a semente não tem fotos (30 pontos) nem autorização de venda (15 pontos);
- a nota anda de 5 em 5.

**A negociação (tela de negociações).** Ana · Casa Jardim Botânico, conduzida pelo Negociador IA:

- **Mandato:** pedido R$ 1.450.000, alvo R$ 1.400.000, ponto de recuo R$ 1.360.000 (sigiloso),
  4 rodadas, autonomia "pergunta antes", válido por 5 dias. As concessões são o prazo de entrega
  de 60 dias, em troca de entrada de 30%, e os móveis planejados da cozinha, em troca de
  fechamento em 7 dias.
- **Escada:** o vendedor pede 1.450.000; a Ana oferece 1.320.000; o vendedor vai a 1.400.000; a
  Ana repete 1.320.000. Estamos na rodada 2 (cada oferta do comprador abre uma rodada).
- **Teto estimado do comprador:** R$ 1.390.000.
- **Objeção registrada:** preço.

### Conjunto do segundo corretor (as outras contas de teste)

- **Clientes:** Bruno Costa (Em atendimento, WhatsApp, R$ 520.000) e Lívia Rocha (Novo,
  indicação, R$ 450.000).
- **Imóvel:** um, o Apartamento 2 quartos · Águas Claras (R$ 520.000).
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
- Hoje, Sua semana: 6 contatos novos, 6 leads, 5 atendidos.
- Comissão prevista: 5% × (1,45 mi × 70% + 920 mil × 70% + 800 mil × 20% + 400 mil × 5% + 600 mil
  × 10% + 395 mil × 50%) = **R$ 104.825**.
- **Negociação:** última oferta × pedido = 1.320.000 ÷ 1.450.000 = **−9%**. ZOPA de R$ 1.360.000
  (recuo) a R$ 1.390.000 (teto estimado). O vendedor já concedeu R$ 50.000, e a próxima concessão
  cabe em 40% de (1.400.000 − 1.360.000) = **R$ 16.000**.
