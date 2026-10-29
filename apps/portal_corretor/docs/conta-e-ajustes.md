---
titulo: Conta e ajustes
descricao: A tela de Ajustes (Mensageiro, Negociador, Conexões, Conta e marca, Funil e abordagens, Horário de atendimento, Privacidade) — seus dados de corretor, a conta, a marca e as regras de atendimento.
---

# Conta e ajustes

**Ajustes** é a última tela do menu. Ela segue o desenho novo das outras telas, em três colunas (no
celular, uma por vez, em abas):

- **à esquerda**, as seções;
- **no centro**, o conteúdo da seção escolhida (cada bloco tem o botão de lápis para editar);
- **à direita**, uma ajuda curta da seção e o botão **Perguntar ao Assistente**. Em Conta e marca,
  aparece ali também o aviso do CRECI, quando ele falta.

| Seção | O que tem |
|---|---|
| **Mensageiro** | Ainda nada para configurar: o Mensageiro chega com a conexão do WhatsApp |
| **Negociador** | "Em breve": os ajustes do Negociador chegam numa versão seguinte (o mandato de cada negociação fica em [Clientes › Negociações](negociacao.md)) |
| **Conexões** | O Instagram, o WhatsApp ("ainda não disponível") e a Agenda ("fase 6") — ver [Conexões (Instagram)](conexoes.md) |
| **Conta e marca** | Seus dados (CRECI e telefone), os dados da conta e a marca (logo, sua foto, cores, estilo e assinatura) |
| **Funil e abordagens** | Etapas de cada funil e a abordagem por etapa e temperatura — ver [Funil](funil.md) |
| **Horário de atendimento** | As regras de atendimento, abaixo |
| **Privacidade** | O consentimento dos clientes (que fica na ficha de cada um) e **Exportar contatos** |

A seção aberta fica no endereço (`/ajustes?aba=conexoes`, por exemplo): dá para guardar ou mandar o
link direto, e recarregar a tela volta à mesma seção. Os endereços antigos continuam abrindo:

- `/conta` abre Conta e marca;
- `/ajustes/marca` e `?aba=marca` também abrem Conta e marca, porque a Marca agora fica nessa seção;
- `/ajustes/conexoes` e `/ajustes/funil` abrem as seções deles.

## Conta › Seus dados: CRECI e telefone

- **CRECI** (opcional): é aqui que você cadastra. O formato usual é `UF-número-F` (pessoa física)
  ou `-J` (pessoa jurídica), por exemplo `DF-12345-F`. Pode digitar em minúsculas: o app passa
  para maiúsculas e tira os espaços das pontas. Se você digitar a palavra "CRECI" antes do número
  (`CRECI: DF-12345-F`), ela é tirada ao salvar, porque o app já a escreve onde o CRECI aparece. Se o CRECI estiver fora desse formato, ele é salvo
  assim mesmo e o app avisa para você conferir; só recusa o que passa de 20 caracteres. Com o CRECI
  cadastrado, ele aparece no rodapé das artes (pela descrição do Estúdio), na legenda das peças, na
  sua página, nas seleções e no portal do cliente.
- **Sem CRECI nada fica travado.** Onde ele faria falta (Hoje, a peça do Estúdio, o editor da
  página e "o que falta" na ficha do imóvel), aparece só o aviso discreto *"Adicione seu CRECI ao
  perfil para que ele apareça nos anúncios"*, com o atalho **Ajustes › Conta e marca**, e também na coluna da direita desta seção. O CRECI jurídico da
  conta também vale: com ele, o aviso some.
- **Telefone (WhatsApp)** com DDD, por exemplo `(61) 99999-9999` (o zero antes do DDD pode ficar).
  Sem o `+` do país, o app entende que é um número do Brasil e exige DDD e 8 ou 9 dígitos.
- Não há verificação nem selo do CRECI: o app não mostra "verificado" nem "não verificado".

## Conta › Conta

- **Nome da conta**: o nome com que você trabalha; nas próximas versões aparece na sua página e
  para os seus clientes.
- **Tipo**: corretor autônomo, imobiliária ou incorporadora.
- **CPF ou CNPJ** e **CRECI jurídico** (imobiliária): opcionais.

## A marca

A seção **Conta e marca** guarda também a marca da conta, e ela é uma só para tudo o que o cliente vê:

| Onde | O que da marca aparece |
|---|---|
| [Estúdio](estudio.md#sua-marca) | Tudo: cores, estilo, assinatura, logo e foto, na descrição para o Canva e no logo para anexar; as referências, só na descrição (o cliente nunca as vê) |
| [Minha página](minha-pagina.md) | A cor principal (topo, botões e destaques) e a sua foto na capa; sem foto, a capa mostra as iniciais |
| [Seleção e Portal do Cliente](selecoes-e-portal.md) | A cor principal e a sua foto, no topo |

Até você salvar a marca, vale o padrão: azul `#0b5394` e cor de apoio amarela, sem foto. A página
não tem mais cor própria. Quem tinha escolhido uma cor para a página antes desta versão (que não
fosse o "Oceano", que já é o azul padrão) e ainda não tinha salvo a marca ganha essa cor como cor
principal da marca; o app faz isso sozinho, ao iniciar, uma vez por conta. Quem já tinha marca
salva fica com a marca. Se a página for refeita antes de esse preenchimento rodar, ela sai no azul
padrão, e o preenchimento não a refaz: ela só ganha a cor quando for refeita de novo, por **Atualizar agora** (Minha página) ou **Atualizar o que está no ar** (Ajustes › Marca), ou ao salvar a marca.

**Salvar a marca, ou trocar a foto, já atualiza o que está no ar**: a página publicada, as seleções
válidas e os portais dos clientes passam a usar a cor e a foto novas, sem publicar de novo. Se algo
disso não acompanhar, a marca fica salva mesmo assim e a seção **Conta e marca** mostra o alerta "A marca
foi salva, mas a sua página, as seleções ou o portal do cliente ainda mostram a marca anterior",
com o botão **Atualizar o que está no ar**. Ele refaz a página (se estiver publicada), as seleções
e os portais com a marca salva, e também funciona com a página fora do ar. O **Atualizar agora**
da Minha página refaz só a página, não as seleções nem os portais. O logo vale só nas artes do
Estúdio.

## Horário de atendimento

| Ajuste | Padrão | Para que serve |
|---|---|---|
| Cliente parado depois de | 7 dias | Quando um cliente sem conversa entra na fila de retomada |
| Validade da seleção enviada | 14 dias | Por quanto tempo o link de uma seleção de imóveis vale |
| Lembrete de visita | 24 horas antes | Notificação para você antes de cada visita pendente; 0 desliga |

Enquanto você não salvar, valem os padrões.

O prazo de primeiro atendimento (meta de 5 minutos para responder um contato novo) saiu da tela:
volta junto com o WhatsApp, quando houver mensagem para medir. O valor gravado continua guardado.

## Privacidade

- **Consentimento:** cada cliente diz se aceita receber mensagens suas e do atendimento automático.
  Você registra ou revoga isso na ficha dele, no cartão **Cadastro** (aba Resumo). A seção tem o
  atalho **Abrir Clientes**.
- **Exportar contatos:** baixa a planilha com os contatos da sua conta, a mesma do botão Exportar
  de Clientes. Para tirar um contato da lista, use **Remover** na ficha dele: o histórico fica
  guardado.
