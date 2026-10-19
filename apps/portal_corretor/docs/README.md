---
titulo: Portal do Corretor
descricao: O escritório digital do corretor de imóveis — o que já existe nesta versão.
---

# Portal do Corretor

App do corretor de imóveis. Cada corretor tem a **própria conta**: nenhum corretor vê nada de outro,
e a garantia é do banco de dados da plataforma, não só das telas.

## O que existe nesta versão (0.7.0)

| Para quem | Tela | O que faz |
|---|---|---|
| Corretor | **Início** | O que fazer hoje (quentes sem resposta, abordagens atrasadas, visitas, próximos passos) e o que falta para começar — ver [Funil, temperatura e fila do dia](funil.md) |
| Corretor | **Desempenho** | Leads, conversão entre etapas, vendas, VGV, captações, comissão prevista, origem e motivos de perda — ver [Desempenho, envios e dados de demonstração](desempenho.md) |
| Corretor | **Funil** | Quadro dos negócios por etapa, com temperatura e abordagem atrasada; arrastar muda a etapa |
| Corretor | **Clientes** | Contatos, ficha com negócios, notas, consentimento e linha do tempo; importar e exportar planilha — ver [Clientes, negócios e agenda](clientes-e-agenda.md) |
| Corretor | **Agenda** | Atividades pendentes dos próximos 14 dias |
| Corretor | **Imóveis › Minha carteira** | Imóveis com fotos, qualidade do anúncio, autorização de venda, descrição com IA e visitas — ver [Imóveis e empreendimentos](imoveis.md) |
| Corretor | **Imóveis › Empreendimentos** | Lançamentos com materiais e as unidades da carteira |
| Corretor | **Minha página** | A página pública por blocos, com os imóveis anunciados e o formulário de contato — ver [Minha página, ficha pública e link rastreado](minha-pagina.md) |
| Visitante | **Página e ficha pública** (sem login) | A página do corretor e a ficha de cada imóvel anunciado; o contato vira cliente no funil |
| Corretor | **Ajustes › Funil e abordagens** | As etapas de cada funil, a chance de fechar e a abordagem por etapa e temperatura |
| Corretor | **Ajustes › Conta e marca** | Seus dados, os dados da conta e as regras de atendimento — ver [Conta e ajustes](conta-e-ajustes.md) |
| Equipe da plataforma | **Equipe da plataforma › Corretores** | Convida corretores e acompanha os convites — ver [Convidar corretores](convidar-corretores.md) |

Ainda não há integrações (WhatsApp, Instagram). A IA aparece nos imóveis (descrição e leitura de fotos) e na Minha página (textos), quando
liberada pelo administrador. Cada funcionalidade passa a constar aqui na versão em que chegar.

## Papéis

| Papel | Quem | Onde se atribui |
|---|---|---|
| `corretor` | O corretor, usuário externo dono da conta | Configurações › Usuários, seção Externos, depois que ele aceita o convite |
| `operacao` | A equipe da plataforma que convida corretores | Configurações › Usuários, seção Equipe |

Sem o papel, a tela mostra "Esta área não está liberada para você" e diz qual papel pedir.

### Endereço recebido (diagnóstico)

Ao abrir um endereço que o app não conhece, como `/portal_corretor/retorno?code=teste`, a tela
"Página não encontrada" mostra `/retorno?code=teste`. Serve para a equipe conferir o retorno das
conexões com a Meta, quando elas chegarem.

## Para o administrador da instância

- **IA:** o app declara dois slots próprios, **Conteúdo** (base `normal`) e **Leitura de fotos**
  (base `arquivos`). Para ligá-los, em Admin › Instaláveis › Apps › Portal do Corretor › IA,
  autorize as bases `normal` e `arquivos` (chave da plataforma) ou configure uma chave própria em
  cada slot. Sem isso o app funciona, sem os botões de IA.

- **Rotina:** "Temperatura dos contatos" (diária) esfria quem passou 7 dias sem contato. O horário
  e o liga-desliga ficam em Configurações da app › Rotinas (admin da app); sem ajuste, roda às 06:00 UTC.

- **Páginas públicas e webhooks:** a página do corretor, a ficha do imóvel, o formulário e o link
  rastreado — ver [Minha página, ficha pública e link rastreado](minha-pagina.md#para-o-administrador-da-instância).

## Serviços externos

Nenhum nesta versão.
