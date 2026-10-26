---
titulo: Desempenho, envios e dados de demonstração
descricao: Os números do corretor (leads, conversão por etapa, vendas, VGV, previsão de comissão), o histórico de envios e a conta de demonstração.
---

# Desempenho, envios e dados de demonstração

## Desempenho

**Desempenho** mostra os números do período escolhido (7, 30 ou 90 dias, ou 12 meses),
comparados ao período anterior de mesmo tamanho. O período fica no endereço (`?dias=30`). A troca não cria entrada no
histórico do navegador (o Voltar não desfaz a escolha), mas recarregar a página ou abrir o link
guardado mantém o mesmo período.

No topo, quatro números: **Leads**, **Conversão total**, **Vendas** e **Comissão prevista**. Abaixo
de cada um, em texto pequeno, a comparação com o período anterior ("+3 que nos 30 dias
anteriores"; nas taxas, em pontos). A comissão prevista não tem comparação: é a previsão de hoje,
sobre os negócios em andamento.

**Funil de compra** (cartão abaixo dos quatro números). A turma é a dos negócios de compra
**abertos no período** (os leads). Para
cada um, conta até onde ele chegou, mesmo que depois tenha recuado ou sido perdido:

| Número | Conta |
|---|---|
| Leads | Negócios de compra abertos no período |
| Lead → atendimento | Dos leads, quantos chegaram a "Em atendimento" ou além |
| Lead → visita | Dos leads, quantos chegaram a "Visitou" ou além |
| Visita → proposta | Dos que visitaram, quantos chegaram a "Proposta" ou além |
| Proposta → ganho | Dos que chegaram à proposta, quantos foram ganhos |
| Conversão total | Ganhos sobre leads |

Leads e Conversão total são dois dos quatro números do topo; o cartão traz só as quatro taxas de etapa.

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

**Por origem** (leads, ganhos e conversão por canal) e **motivos de perda** completam a tela. Um
parágrafo no fim explica o que ainda não tem fonte: tempo de primeiro atendimento e números do
atendimento automático (o Mensageiro) chegam com o WhatsApp; conteúdo publicado, com o Estúdio;
custo por lead, comissão recebida e metas, em versões seguintes.

O **Início** mostra a faixa da semana: contatos novos, leads e visitas feitas nos últimos 7 dias,
mais a comissão prevista.

## Tudo que você mandou

Na ficha do cliente, **Registrar envio** anota o que o corretor mandou (imóvel, arquivo,
mensagem, localização) e por onde (WhatsApp, e-mail, pessoalmente). Com um imóvel, o app devolve
a mensagem pronta para colar no WhatsApp (nome do cliente, título, bairro e preço; nunca o
proprietário nem o endereço completo). O envio conta como contato com o cliente e entra na linha
do tempo. A ficha do imóvel mostra a quem ele foi enviado.

Com a Minha página no ar e o imóvel publicado, a mensagem leva um link rastreado: a ficha do
cliente mostra quantas vezes ele abriu — ver [Minha página, ficha pública e link rastreado](minha-pagina.md#link-rastreado).

## Dados de demonstração

Nas contas de teste (nome terminado em "(demo)"), o Início oferece **Gerar dados de
demonstração** enquanto a conta não tem nenhum contato. Ele cria 10 clientes com origem, 10
negócios, 2 imóveis e 2 visitas, com o próprio corretor como responsável. Origens que já
existem são reaproveitadas e os imóveis recebem o próximo código livre. Se alguma etapa padrão
foi renomeada ou removida, o app avisa qual é e não grava nada.

### Conferência manual (últimos 30 dias, logo depois de gerar)

| Cliente | Funil | Etapa | Valor | Origem |
|---|---|---|---|---|
| Ana | compra | Novo | R$ 300.000 | Instagram |
| Bruno | compra | Em atendimento | R$ 500.000 | WhatsApp |
| Carla | compra | Qualificado (visita amanhã) | R$ 400.000 | Indicação |
| Diego | compra | Visitou (retorno nota 4) | R$ 700.000 | Portal |
| Elisa | compra | Proposta | R$ 900.000 | Indicação |
| Fábio | compra | Ganho (passou por Documentação) | R$ 650.000 | Indicação |
| Gabi | compra | Ganho (passou por Proposta) | R$ 420.000 | Instagram |
| Hugo | compra | Perdido por preço (tinha visitado) | R$ 350.000 | Portal |
| Iara | venda | Autorização assinada | R$ 1.200.000 | Indicação |
| João | venda | Avaliação | R$ 800.000 | Placa |

Todos com comissão de 5%. Números esperados:

- Leads: **8** (os de compra).
- Lead → atendimento: 7 de 8 = **88%** (todos menos Ana).
- Lead → visita: 5 de 8 = **63%** (Diego, Elisa, Fábio, Gabi, Hugo).
- Visita → proposta: 3 de 5 = **60%** (Elisa, Fábio, Gabi).
- Proposta → ganho: 2 de 3 = **67%**.
- Conversão total: 2 de 8 = **25%**.
- Vendas: **2**; VGV: **R$ 1.070.000**.
- Captações: **1** (Iara).
- Visitas feitas: **1** (Diego).
- Por origem: Indicação 3 leads e 1 ganho; Instagram 2 e 1; Portal imobiliário 2 e 0; WhatsApp 1 e 0.
- Motivos de perda: preço, 1.
- Comissão prevista: 5% × (300 mil × 5% + 500 mil × 10% + 400 mil × 20% + 700 mil × 50% + 900 mil × 70%
  + 1,2 milhão × 40% + 800 mil × 15%) = **R$ 86.250**.
