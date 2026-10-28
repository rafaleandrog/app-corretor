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

No alto da lista: **Importar** (planilha), **Novo** (cadastro rápido) e **Exportar** (a planilha dos
contatos), e as duas visões:

- **Lista** (a que abre): os contatos da conta, 50 por página, em ordem alfabética, cada um com a
  temperatura, a origem e o próximo passo (ou o telefone).
- **Funil**: o quadro por etapa, com arrastar para mudar de etapa, no meio da tela (a coluna da
  direita recolhe) — ver [Funil, temperatura e fila do dia](funil.md). O endereço antigo `/funil`
  abre esta visão. Escolher um cliente na lista com o Funil aberto volta à Lista com a ficha dele.

A visão escolhida fica no endereço (`/clientes?visao=quadro`). Uma terceira visão, **Negociações**,
chega com o Negociador.

Na **Lista**:

- **Busca** por nome, telefone ou e-mail.
- **Filtros prontos**, um de cada vez:

  | Filtro | Quem aparece |
  |---|---|
  | Novos | Cadastrados nos últimos 7 dias |
  | Sem contato | Sem contato registrado há mais de N dias, o N de **Ajustes › Atendimento** ("Cliente parado depois de"); para quem veio de planilha, conta a partir da importação |
  | Quentes | Temperatura quente (escolher uma temperatura no filtro tira este, e vice-versa) |
  | Retorno vencido | O próximo passo combinado já passou da data |

  **Todos** desliga o filtro pronto.
- **Papel:** Todos · Compradores · Proprietários. E os filtros de **temperatura** e **origem** (por
  onde o contato chegou). Tudo combina com a busca e com o filtro pronto.
- A busca e os filtros ficam no endereço da página: dá para voltar ou guardar o link.
- **Novo:** nome, telefone ou e-mail, papel (comprador ou proprietário) e por onde chegou. Sem papel
  informado, o contato entra como comprador. O telefone é guardado no formato internacional
  (`+55…`); sem o `+`, o app assume Brasil. Salvo, a ficha do contato novo abre.
- **Papéis de rede** (investidor, parceiro, fornecedor) não se escolhem no filtro nem no cadastro;
  quem já os tem (por planilha ou edição na ficha) continua com eles, e a lista os mostra.

### Duplicatas

Na mesma conta não existem dois contatos ativos com o mesmo telefone. Ao cadastrar ou editar com
um telefone que já existe, o app recusa e, em geral, diz o nome de quem já tem aquele número. Contato
removido libera o telefone.

### Ficha do contato

A ficha ocupa o meio e a direita da tela (no desenho da ficha de pessoa do Follow Up Boss).

**No meio, o cliente.** No alto, o **cabeçalho**: a inicial (ou foto), o nome, o telefone, o e-mail
e o papel; os chips de **temperatura** (passe o mouse para ver o motivo), **etapa** do negócio em
andamento e **origem**; uma linha com o motivo da temperatura e o último contato; e os botões:

- **Conversa:** abre o WhatsApp do contato numa aba nova (sem telefone, fica desligado).
- **Resumir:** a IA resume o histórico em até três frases, logo abaixo; o resumo não fica gravado.
  Sem a IA do Assistente liberada, o botão fica desligado com "IA indisponível agora".
- **Ligar** e **E-mail** (os ícones), quando há telefone e e-mail.
- **Mais:** Editar contato, Perguntar ao Assistente (abre o Assistente na coluna da direita, já sobre
  este cliente), Remover contato e, com abordagem, Registrar abordagem feita e Pular a abordagem.

Embaixo, quatro abas. A aba aberta fica no endereço (`?secao=`) e volta ao recarregar.

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
    (registrado em … · revogar, ou registrar). O lápis edita o contato.
- **Linha do tempo:** **Registrar contato** (nota livre) e **Registrar envio** no topo; abaixo, tudo o
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

  A aba **Negociação** chega com o Negociador.

**À direita, o contexto:**

- **Perfil de busca:** o que o cliente procura, em etiquetas (finalidade, tipos, regiões, faixa de
  preço, quartos, vagas, área). Sem perfil ainda, uma dica.
- **Portal do cliente:** se há link ativo e quando foi gerado, **Reenviar link** (copia a mensagem com
  o link de novo), **Revogar**, ou **Gerar link do portal**. A seta do cartão abre **o que falta do
  cliente** (botão **Pedir ao cliente**). Ver [Seleções e Portal do Cliente](selecoes-e-portal.md#portal-do-cliente).
- **Privacidade:** **Exportar** (a planilha dos contatos da conta) e **Remover** (o contato sai das
  listas, mas não é apagado). Contato com negócio em andamento não pode ser removido: encerre o
  negócio antes.

Vindo do **Fazer agora** de Hoje ou de um cartão com **Abordagem atrasada** no Funil, a ficha
abre já com a **Mensagem sugerida** carregada (o endereço traz `?sugerir=1`), e o **Fazer agora**
dela abre o WhatsApp. Sem abordagem, ou abrindo a ficha por outro caminho, nada é gerado sozinho.

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
do funil, e nomes sem repetição. Etapa tirada do funil não some dos negócios que estão nela: fica inativa e deixa de
aparecer para os negócios novos.

## Agenda

Atividades são tarefas, ligações, mensagens, visitas, reuniões e retornos, com dia, hora e local,
ligadas ou não a um contato e a um negócio.

A **Agenda** abre em Hoje, pelo **Ver agenda** da Agenda de hoje (o endereço `/agenda` abre Hoje direto nela). Mostra as pendentes
dos próximos 14 dias agrupadas em Atrasadas, Hoje, Amanhã e os dias seguintes, até 500 de uma vez;
passando disso, um aviso pede para resolver as atrasadas. Cada atividade tem o botão **Feito**; no
**Mais**, abrir o cliente, "não veio" (visitas) e cancelar. Marcar como **feita** registra o contato
com o cliente; feita, cancelada e "não compareceu" vão para a linha do tempo. Sem nada pendente, o
botão **Abrir Clientes** leva à lista para agendar pela ficha.

O detalhe da visita (imóvel visitado e retorno do cliente) fica na ficha do imóvel.

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

## Importar planilha

**Clientes › Importar** recebe um arquivo CSV com cabeçalho (no Excel: Salvar como › CSV).

1. **De onde vem a planilha?** O corretor escolhe o modelo: **planilha simples** (colunas `Nome`,
   `Telefone` e `E-mail`, sem diferença de acento ou maiúscula) ou **outra**. O modelo só
   pré-preenche as colunas; o que ele não encontra fica com a sugestão de "outra". Modelos de
   outros CRMs (Kenlo, Jetimob, Imobzi) ainda não existem: cada um entra depois de conferido com
   uma exportação real do sistema. Até lá, use **outra**.
2. O app lê o arquivo no navegador (UTF-8 ou o formato do Excel antigo) e aceita `;` ou `,`.
3. Sugere qual coluna é nome, telefone, e-mail, papel e observações (pelo modelo ou, em
   **outra**, pelo nome do cabeçalho); o corretor confere e muda.
4. Mostra as 10 primeiras linhas como ficariam.
5. O corretor escolhe o que fazer quando o contato já existe (mesmo telefone; se o telefone não
   achar ninguém, mesmo e-mail): **pular**, **completar só os campos vazios** ou **sobrescrever com
   a planilha**. Coluna não mapeada não apaga nem troca nada: sem a coluna de papel, o contato
   existente fica com os papéis que tinha (o novo entra como comprador).
6. O relatório mostra quantos foram criados, unidos a contatos existentes, pulados e rejeitados,
   com a linha da planilha (contando o cabeçalho como linha 1) e o motivo de cada rejeição. Uma
   linha que esbarra no telefone de outro contato (por exemplo, cadastrado ao mesmo tempo) é
   rejeitada, e as demais seguem.

Limite de 2.000 linhas por vez, e cada importação envia no máximo 100 kB (limite da plataforma):
com nome, telefone, e-mail e observação, isso dá algumas centenas de linhas. Quando o envio passa
disso, a tela avisa o tamanho antes de importar; divida a planilha. Contatos importados entram
**sem consentimento** e com origem "importação".

## Exportar

**Exportar** baixa todos os contatos ativos da conta em CSV para o Excel (separador `;`, acentos
preservados): nome, telefone, e-mail, papéis, temperatura, origem, campanha, próximo passo (o quê e quando) e
data de cadastro. Células que começam como fórmula (`=`, `@`, ou `+`/`-` seguidos de texto) ganham um
apóstrofo para o Excel não executá-las; telefones e números com sinal saem como estão.
