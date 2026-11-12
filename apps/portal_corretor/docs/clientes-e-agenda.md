---
titulo: Clientes, negócios e agenda
descricao: Cadastro de contatos, negócios no funil, atividades, importação e exportação de planilha.
---

# Clientes, negócios e agenda

Tudo aqui é da conta do corretor: ninguém de outra conta vê, abre ou altera. Um endereço de
contato, negócio ou atividade de outra conta responde "não encontrado".

## Clientes

**Clientes** fica em colunas (o desenho novo das telas, ver [Como as telas se organizam](README.md#como-as-telas-se-organizam)):
a **lista** à esquerda, a **ficha** do cliente escolhido no meio e, à direita, o **perfil de busca**,
o **portal do cliente** e a **privacidade**. Escolher um cliente na lista abre a ficha sem sair da
lista; o cliente aberto fica marcado nela e no endereço (`/clientes?item=<número>`): recarregar a
página ou abrir o link guardado reabre o mesmo cliente. O endereço antigo de uma ficha
(`/clientes/<número>`) continua funcionando e abre o mesmo cliente na lista. No celular aparece uma
coluna por vez, com abas (Clientes · Ficha · Portal); sem cliente escolhido, abre na lista.

No alto da lista, o cabeçalho comum das telas: **Importar** (planilha), **Novo** (cadastro rápido),
**Buscar** e o Assistente; abaixo, as três visões (Funil · Lista · Negociações). A planilha dos
contatos sai pelo **Exportar dados** da ficha (cartão Privacidade).

- **Lista** (a que abre): os contatos da conta, 50 de cada vez e em ordem alfabética, cada um com
  a temperatura, a etapa do negócio em andamento, a origem e o próximo passo (ou o telefone, no
  formato "(61) 99000-0101"). **Mostrar mais** traz os 50 seguintes.
- **Funil**: os filtros à esquerda, o quadro por etapa no meio (arrastar muda a etapa) e, à
  direita, o cliente do cartão escolhido — ver [Funil, temperatura e fila do dia](funil.md). Os
  endereços antigos `/funil` e `/clientes?visao=quadro` abrem esta visão. **Abrir ficha**, na
  coluna da direita, leva à Lista com a ficha do cliente.

- **Negociações**: as propostas e contrapropostas de cada negociação, com o mandato — ver
  [Negociação e mandato](negociacao.md#as-telas-da-negociação).

A visão escolhida fica no endereço (`/clientes?visao=funil`, `?visao=negociacoes`).

Na **Lista**:

- **Busca** por nome ou telefone (o e-mail também encontra).
- **Filtros prontos**, um de cada vez:

  | Filtro | Quem aparece |
  |---|---|
  | Novos | Cadastrados nos últimos 7 dias |
  | Sem contato | Sem contato registrado há mais de N dias, o N de **Ajustes › Horário de atendimento** ("Cliente parado depois de"); para quem veio de planilha, conta a partir da importação |
  | Quentes | Temperatura quente (escolher uma temperatura no filtro tira este, e vice-versa) |
  | Retorno vencido | O próximo passo combinado já passou da data |

  **Todas** desliga o filtro pronto.
- **Papel:** Todas · Compradores · Proprietários. O botão **Filtros** abre a **temperatura** e a
  **origem** (por onde o contato chegou) e mostra quantos estão ligados. Tudo combina com a busca e
  com o filtro pronto.
- A busca e os filtros ficam no endereço da página: dá para voltar ou guardar o link.
- **Novo** (o diálogo **Novo cliente**, o mesmo nome do menu Criar): nome, telefone ou e-mail, papel (comprador ou proprietário) e por onde chegou. Sem papel
  informado, o contato entra como comprador. O telefone é guardado no formato internacional
  (`+55…`); sem o `+`, o app assume Brasil. Salvo, a ficha do contato novo abre. Se o app recusar
  (telefone inválido, nome em branco), o formulário reabre com o que você digitou e a mensagem no
  alto; se o telefone já for de outro contato, **Abrir <nome>** abre a ficha dele (ou **Corrigir**
  volta ao formulário).
- **Papéis de rede** (investidor, parceiro, fornecedor) não se escolhem no filtro nem no cadastro;
  quem já os tem (por planilha ou edição na ficha) continua com eles, e a lista os mostra.

### Duplicatas

Na mesma conta não existem dois contatos ativos com o mesmo telefone. Ao cadastrar ou editar com
um telefone que já existe, o app recusa e, em geral, diz o nome de quem já tem aquele número: no
**Novo cliente** e no **Editar contato** da ficha, **Abrir <nome>** abre a ficha de quem já tem o número,
e **Corrigir** reabre o formulário com o que você digitou. Clicar fora do formulário ou apertar Esc também cancela e descarta o que foi digitado, como o **Cancelar**. Se a gravação falhar por rede ou erro do servidor, antes de salvar de novo confira na lista se o registro já não entrou, porque o servidor pode ter gravado antes de a resposta se perder. Contato removido libera o telefone.

### Ficha do contato

A ficha ocupa o meio e a direita da tela (no desenho da ficha de pessoa do Follow Up Boss).

**No meio, o cliente.** No alto, o **cabeçalho**: a inicial (ou foto), o nome, o telefone, o e-mail
e o papel; os chips de **temperatura** (passe o mouse para ver o motivo), **etapa** do negócio em
andamento e **origem**; uma linha com o motivo da temperatura e o último contato; e os botões:

- **Conversa:** abre a conversa do cliente em [Conversas](conversas.md) (criada na hora, se ainda não
  existir).
- **Resumir:** a IA resume o histórico em até três frases, logo abaixo; o resumo não fica gravado.
  Sem a IA do Assistente liberada, o botão fica desligado com "IA indisponível agora".
- **WhatsApp**, **Ligar** e **E-mail** (os ícones), quando há telefone e e-mail.
- **Mais:** Editar contato, Perguntar ao Assistente (abre o Assistente na coluna da direita, já sobre
  este cliente), Remover contato e, com abordagem, Registrar abordagem feita e Pular a abordagem.

Embaixo, quatro abas: **Resumo · Linha do tempo · Enviados N · Negócios N** (N é a contagem). A
ficha abre na **Linha do tempo**; a aba aberta fica no endereço (`?secao=`) e volta ao recarregar.

- **Resumo:**
  - **Próximo passo:** a próxima abordagem do playbook (o que fazer, por onde, até quando e a
    etapa, com o chip **Atrasada** quando venceu), o passo **combinado** por você e o que o cliente
    lê no portal. Os botões **Mensagem sugerida** e **Virar tarefa** ficam aqui (ver
    [Próxima abordagem](funil.md#próxima-abordagem)). Sem negócio em andamento, ou sem linha do
    playbook para a etapa e a temperatura dele, não há abordagem: **Virar tarefa** não aparece, e a
    **Mensagem sugerida** começa pelo objetivo **Retorno** (troque nos objetivos de um toque:
    Apresentação, Retorno, Ainda procurando? e Manter contato). Sem a IA liberada, a mensagem vem do
    texto do playbook ou do modelo do objetivo. O lápis do cartão, **Combinar próximo passo**, define
    o passo combinado e o campo **Para o cliente** (opcional, até 120 letras), que aparece no topo do
    portal, por exemplo "Visita sábado às 10h". O passo combinado é nota sua e nunca aparece para o
    cliente.
  - **Cadastro:** origem e campanha, data de cadastro, observações e o **consentimento** numa linha
    (registrado em … · revogar, ou registrar). Quem pediu contato pelo formulário da página aparece
    com "Declarou consentimento no formulário…" e o botão **Confirmar**: a declaração não vale como
    consentimento até você confirmar com o cliente. O lápis edita o contato; a edição não deixa o
    contato sem telefone e sem e-mail ao mesmo tempo.
- **Linha do tempo:** **Registrar contato** (nota livre, até 5.000 caracteres, guardada inteira) e **Registrar envio** no topo (por e-mail ou pessoalmente, o registro não exige imóvel anunciável; só o cartão pelo WhatsApp exige); abaixo, tudo o
  que aconteceu com o contato, com autor e hora.
- **Enviados:** imóveis, arquivos e mensagens registrados, com os cliques no link; o **+** registra um
  envio (ver [Enviados ao cliente](desempenho.md#enviados-ao-cliente)).
- **Negócios:**
  - **Negócios:** cada negócio com a etapa, o valor e o imóvel, e o botão **Mudar etapa**; o **+**
    abre um negócio novo.
  - **Agenda:** as atividades marcadas com o contato, da mais próxima para a mais distante, com
    **Feito** e, nas visitas, **Retorno**; o **+** agenda. As já feitas, canceladas ou sem
    comparecimento ficam na seta do cartão.
  - **Seleções:** as seleções de imóveis enviadas, com as reações; o **+** monta uma seleção nova
    (ver [Seleções e Portal do Cliente](selecoes-e-portal.md)).
  - **Negociações:** as negociações do cliente, com a última oferta e o estado; tocar numa delas
    abre Clientes › Negociações. **Nova proposta** registra uma oferta.

**À direita, o contexto:**

- **Perfil de busca:** o que o cliente procura, em etiquetas (finalidade, tipos, regiões, faixa de
  preço, quartos, vagas, área). **Editar perfil** abre o formulário; é o perfil que decide os imóveis
  que combinam em Conversas e os marcados numa seleção nova.
- **Portal do cliente:** se há link ativo, quando foi gerado e o **último acesso** (a última vez que
  o cliente agiu pelo portal: mensagem, pedido de remarcar, pendência feita ou oferta; abrir a página
  sem agir não conta). **Liberar item** monta uma seleção nova, que entra no portal; **Reenviar link**
  copia a mensagem com o mesmo link; **Revogar**; ou **Gerar link do portal**. A seta do cartão abre
  **o que falta do cliente** (botão **Pedir ao cliente**). Ver [Seleções e Portal do Cliente](selecoes-e-portal.md#portal-do-cliente).
- **Privacidade:** o consentimento em uma linha, **Exportar dados** (a planilha dos contatos da
  conta) e **Remover cliente** (o contato sai das listas, mas não é apagado). Contato com negócio em
  andamento não pode ser removido: encerre o negócio antes.

Vindo do **Fazer agora** de Hoje, a ficha abre na aba **Resumo**, com o cartão **Próximo passo** e a
**Mensagem sugerida** já carregada (o endereço traz `?sugerir=1`), e o **Fazer agora** dela abre o
WhatsApp (por outro caminho vale a regra de sempre: a **Linha do tempo**, ou a aba do endereço). No Funil, tocar num cartão
com **Abordagem atrasada** abre o cliente na coluna da direita, sem sair do Funil, também com a
**Mensagem sugerida** pronta. Sem abordagem, ou abrindo o cliente por outro caminho, nada é gerado
sozinho.

Um cliente de outra conta, aberto por um link ou pelo endereço, mostra "Não encontrado".

## Negócios e funil

Um negócio é uma oportunidade com um contato, em um de dois funis:

| Funil | Para | Etapas iniciais |
|---|---|---|
| Compra | Cliente comprador | Novo → Em atendimento → Qualificado → Visita agendada → Visitou → Proposta → Documentação → Ganho / Perdido |
| Venda e captação | Proprietário | Contato → Avaliação → Autorização assinada → Anunciado → Proposta recebida → Vendido / Encerrado |

- Negócio novo começa na primeira etapa em andamento do funil.
- Valores em reais; o app aceita `1.234,56` ou `1234.56`.
- Mover para a etapa de **perda** pede o motivo (preço, localização, financiamento, desistiu,
  comprou com outro, sem resposta, outro). Ganho e perda ficam com data.
- Cada mudança de etapa vai para a linha do tempo e conta como contato com o cliente.

### Ajustes › Funil

Cada funil tem a sua lista de etapas, na ordem, com a chance de fechar (de 0 a 100%), usada nas
previsões. O corretor pode renomear, reordenar, criar e tirar etapas, e salva um funil por vez.

Regras: ao menos uma etapa em andamento, exatamente uma de ganho e uma de perda, que ficam no fim
do funil, e nomes sem repetição. Etapa com negócio em andamento não sai do funil: mova os negócios para
outra etapa antes. Etapa que já tem negócios também não troca de tipo (em andamento, ganho ou perda): crie
uma etapa nova com o tipo que quer. Etapa tirada do funil fica inativa, não recebe negócio e deixa de
aparecer para os negócios novos; se ainda houver negócio nela, ela continua como coluna no quadro, antes
das etapas de ganho e perda, até ele sair.

## Agenda

Atividades são tarefas, ligações, mensagens, visitas, reuniões e retornos, com dia, hora e local,
ligadas ou não a um contato e a um negócio.

A **Agenda** abre em Hoje, pelo **Ver agenda** da Agenda de hoje (o endereço `/agenda` abre Hoje direto nela). Mostra as pendentes
dos próximos 14 dias agrupadas em Atrasadas, Hoje, Amanhã e os dias seguintes, até 500 de uma vez;
passando disso, um aviso pede para resolver as atrasadas. Cada atividade tem o botão **Feito**; no
**Mais**, abrir o cliente, "não veio" (visitas) e cancelar. Marcar como **feita** registra o contato
com o cliente; feita, cancelada e "não compareceu" vão para a linha do tempo. Sem nada pendente, o
botão **Abrir Clientes** leva à lista para agendar pela ficha.

Cada linha mostra o cliente e, nas visitas, o código do imóvel. O detalhe da visita (retorno do
cliente) fica na ficha do imóvel; numa visita marcada sem imóvel, o retorno vai para a linha do tempo
do cliente.

**Para quem desenvolve:** `GET /atividades?status=&de=&ate=&contato_id=` devolve cada atividade com
`contato_nome` e, na visita, `imovel_id` e `imovel_codigo`; `contato_id` que não é um id responde 422.

**Lembrete de visita:** um dia antes de cada visita pendente (ou no prazo escolhido em Ajustes ›
Atendimento), você recebe uma notificação na plataforma com a visita, a hora, o
cliente e o local. Clicar nela abre Hoje na agenda dos próximos 14 dias.
- Visita feita, cancelada ou removida antes da hora não gera lembrete.
- Visita marcada para dali a menos tempo que o prazo também não gera.
- Mudar o prazo (ou desligar com 0) vale na hora para os lembretes que ainda não saíram; com outro
  prazo, as visitas já marcadas ficam sem lembrete, e as próximas usam o prazo novo.
- Se a plataforma estiver fora do ar na hora do lembrete e só voltar mais de meia hora depois, ele
  não sai.

O lembrete para o cliente, pelo WhatsApp, chega com o Mensageiro.

## Importar planilha ou contatos do celular

**Clientes › Importar** recebe um arquivo CSV com cabeçalho (no Excel: Salvar como › CSV) ou o
arquivo vCard (`.vcf`) dos contatos do celular. A tela tem três colunas: à esquerda, de onde vêm os
contatos; no meio, o arquivo, as colunas e a prévia; à direita, as regras.

- **Fontes (esquerda).** **Planilha ou CSV** e **Contatos do celular** (vCard). Não há fonte "Outro CRM": uma
  dica abaixo das fontes manda exportar os clientes do outro CRM em CSV e escolher Planilha.
- **Contatos do celular.** Exporte os contatos como vCard (no iPhone, em iCloud › Contatos ›
  Exportar vCard; no Android, em Contatos › Exportar) e escolha o arquivo. O app lê o arquivo no
  navegador e transforma cada contato numa linha com **Nome**, **Telefone** (o celular, se houver
  mais de um), **E-mail** e **Observações** (a nota do contato); daí em diante é igual à planilha
  (colunas, prévia, importação). Contato sem nome e sem telefone fica de fora. Um arquivo `.vcf`
  escolhido com a fonte Planilha também é reconhecido.

No meio:

1. **De onde vem a planilha?** O corretor escolhe o modelo: **planilha simples** (colunas `Nome`,
   `Telefone` e `E-mail`, sem diferença de acento ou maiúscula) ou **outra**. O modelo só
   pré-preenche as colunas; o que ele não encontra fica com a sugestão de "outra". Modelos de
   outros CRMs (Kenlo, Jetimob, Imobzi) ainda não existem: cada um entra depois de conferido com
   uma exportação real do sistema. Até lá, use **outra**.
2. O app lê o arquivo no navegador (UTF-8 ou o formato do Excel antigo) e aceita `;` ou `,`. Mostra
   o nome do arquivo e quantas linhas ele tem.
3. Sugere qual coluna é nome, telefone, e-mail, papel e observações (pelo modelo ou, em
   **outra**, pelo nome do cabeçalho); o corretor confere e muda.
4. **Prévia**: as 10 primeiras linhas como ficariam e, para cada uma, **o que acontece**: novo
   contato, já existe (e o que a regra de repetidos faz com ele) ou ignorada, com o motivo. A prévia
   usa a mesma validação e a mesma busca de repetidos da importação, sem gravar nada; uma linha
   repetida dentro da própria planilha aparece como "já existe".
5. **Importar N contatos** (N são as linhas com nome) e o relatório: quantos foram criados, unidos a
   contatos existentes, pulados e rejeitados, com a linha da planilha (contando o cabeçalho como
   linha 1) e o motivo de cada rejeição. Uma linha que esbarra no telefone de outro contato (por
   exemplo, cadastrado ao mesmo tempo) é rejeitada, e as demais seguem; o mesmo vale para uma linha
   sem os campos do contato (vazia ou mal formada no arquivo). Contato criado sem temperatura na
   planilha ganha a da regra, com o motivo, como no cadastro. **Baixar relatório** baixa
   uma planilha com as linhas rejeitadas: o número da linha, o motivo e as células originais, para
   corrigir e importar de novo. **Cancelar** limpa o arquivo e recomeça.

À direita:

- **Se o contato já existir** (mesmo telefone; se o telefone não achar ninguém, mesmo e-mail): uma
  das três opções, cada uma com a explicação: **Pular** (fica como está), **Completar** (preenche só
  os campos vazios) ou **Substituir** (a planilha substitui os dados). Coluna não mapeada não apaga nem troca nada: sem a coluna de papel,
  o contato existente fica com os papéis que tinha (o novo entra como comprador).
- **Consentimento**: contatos importados entram sem consentimento registrado (ver abaixo).

Limite de 2.000 linhas por vez, com quantas colunas a planilha tiver. Como a plataforma aceita no
máximo 100 kB por envio, o app manda a importação em partes (até 400 linhas e cerca de 80 kB cada),
uma depois da outra, e soma os relatórios; a tela mostra "Enviando a parte N de M". Se uma parte
falhar, o que já entrou fica, o relatório mostra até onde foi e o aviso diz a partir de qual linha
importar de novo. Contatos importados entram
**sem consentimento** e com origem "importação".

## Exportar

**Exportar dados** (no cartão Privacidade da ficha) baixa todos os contatos ativos da conta em CSV para o Excel (separador `;`, acentos
preservados): nome, telefone, e-mail, papéis, temperatura, origem e campanha (por onde cada um chegou), próximo passo (o quê e quando) e
data de cadastro. Células que começam como fórmula (`=`, `@`, ou `+`/`-` seguidos de texto) ganham um
apóstrofo para o Excel não executá-las; telefones e números com sinal saem como estão.
