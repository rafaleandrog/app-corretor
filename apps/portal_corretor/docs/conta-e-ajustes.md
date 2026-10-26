---
titulo: Conta e ajustes
descricao: A tela de Ajustes (Conta, Marca, Conexões, Funil e abordagens, Atendimento) — seus dados de corretor, os dados da conta e as regras de atendimento.
---

# Conta e ajustes

**Ajustes** é uma tela só, no fim do menu, com cinco abas. Cada bloco tem o botão de lápis para
editar.

| Aba | O que tem |
|---|---|
| **Conta** | Seus dados (CRECI e telefone) e os dados da conta |
| **Marca** | Logo, sua foto, cores, estilo e assinatura — a marca única do Estúdio, da página, das seleções e do portal (abaixo) |
| **Conexões** | Instagram — ver [Conexões (Instagram)](conexoes.md) |
| **Funil e abordagens** | Etapas de cada funil e a abordagem por etapa e temperatura — ver [Funil](funil.md) |
| **Atendimento** | As regras de atendimento, abaixo |

A aba aberta fica no endereço (`/ajustes?aba=marca`, por exemplo): dá para guardar ou mandar o link
direto. Os endereços antigos continuam abrindo: `/conta` abre a aba Conta, e `/ajustes/conexoes` e
`/ajustes/funil` abrem as abas deles.

## Conta › Seus dados: CRECI e telefone

- **CRECI**: é aqui que você cadastra. O formato é `UF-número-F` (pessoa física) ou `-J` (pessoa
  jurídica), por exemplo `DF-12345-F`. Pode digitar em minúsculas: o app corrige. O CRECI vai no
  rodapé das artes (pela instrução do Estúdio) e na legenda das peças. Sem ele nada fica travado:
  o app só lembra de cadastrar.
- **Telefone (WhatsApp)** com DDD, por exemplo `(61) 99999-9999` (o zero antes do DDD pode ficar).
  Sem o `+` do país, o app entende que é um número do Brasil e exige DDD e 8 ou 9 dígitos.
- **Situação do CRECI**: começa como "não verificado". A verificação é feita pela equipe da
  plataforma e ainda não tem tela nesta versão.

## Conta › Conta

- **Nome da conta**: o nome com que você trabalha; nas próximas versões aparece na sua página e
  para os seus clientes.
- **Tipo**: corretor autônomo, imobiliária ou incorporadora.
- **CPF ou CNPJ** e **CRECI jurídico** (imobiliária): opcionais.

## A marca

A aba **Marca** guarda a marca da conta, e ela é uma só para tudo o que o cliente vê:

| Onde | O que da marca aparece |
|---|---|
| [Estúdio](estudio.md#sua-marca) | Tudo: cores, estilo, assinatura, logo e foto, na instrução para o Canva e no logo para anexar; as referências, só na instrução (o cliente nunca as vê) |
| [Minha página](minha-pagina.md) | A cor principal (topo, botões e destaques) |
| [Seleção e Portal do Cliente](selecoes-e-portal.md) | A cor principal e a sua foto, no topo |

Até você salvar a marca, vale o padrão: azul `#0b5394` e cor de apoio amarela, sem foto. A página
não tem mais cor própria. Quem tinha escolhido uma cor para a página antes desta versão (que não
fosse o "Oceano", que já é o azul padrão) e ainda não tinha salvo a marca ganha essa cor como cor
principal da marca; o app faz isso sozinho, ao iniciar, uma vez por conta. Quem já tinha marca
salva fica com a marca. Se a página for refeita antes de esse preenchimento rodar, ela sai no azul
padrão, e o preenchimento não a refaz: ela só ganha a cor quando for refeita de novo, por **Atualizar agora** (Minha página) ou **Atualizar o que está no ar** (Ajustes › Marca), ou ao salvar a marca.

**Salvar a marca, ou trocar a foto, já atualiza o que está no ar**: a página publicada, as seleções
válidas e os portais dos clientes passam a usar a cor e a foto novas, sem publicar de novo. Se algo
disso não acompanhar, a marca fica salva mesmo assim e a tela **Marca** mostra o alerta "A marca
foi salva, mas a sua página, as seleções ou o portal do cliente ainda mostram a marca anterior",
com o botão **Atualizar o que está no ar**. Ele refaz a página (se estiver publicada), as seleções
e os portais com a marca salva, e também funciona com a página fora do ar. O **Atualizar agora**
da Minha página refaz só a página, não as seleções nem os portais. O logo vale só nas artes do
Estúdio.

## Atendimento

| Ajuste | Padrão | Para que serve |
|---|---|---|
| Cliente parado depois de | 7 dias | Quando um cliente sem conversa entra na fila de retomada |
| Validade da seleção enviada | 14 dias | Por quanto tempo o link de uma seleção de imóveis vale |
| Lembrete de visita | 24 horas antes | Notificação para você antes de cada visita pendente; 0 desliga |

Enquanto você não salvar, valem os padrões.

O prazo de primeiro atendimento (meta de 5 minutos para responder um contato novo) saiu da tela:
volta junto com o WhatsApp, quando houver mensagem para medir. O valor gravado continua guardado.
