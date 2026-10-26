---
titulo: Clientes, negócios e agenda
descricao: Cadastro de contatos, negócios no funil, atividades, importação e exportação de planilha.
---

# Clientes, negócios e agenda

Tudo aqui é da conta do corretor: ninguém de outra conta vê, abre ou altera. Um endereço de
contato, negócio ou atividade de outra conta responde "não encontrado".

## Clientes

**Clientes** lista os contatos da conta, 50 por página, em ordem alfabética.

- **Busca** por nome, telefone ou e-mail.
- **Filtros:** papel (comprador, proprietário, investidor, parceiro, fornecedor), temperatura e
  "parados há mais de N dias" (sem contato registrado nesse tempo; para quem veio de planilha, conta
  a partir da importação).
- A busca e os filtros ficam no endereço da página: dá para voltar ou guardar o link.
- **Novo contato:** nome e telefone ou e-mail. Sem papel informado, o contato entra como comprador.
  O telefone é guardado no formato internacional (`+55…`); sem o `+`, o app assume Brasil.

### Duplicatas

Na mesma conta não existem dois contatos ativos com o mesmo telefone. Ao cadastrar ou editar com
um telefone que já existe, o app recusa e, em geral, diz o nome de quem já tem aquele número. Contato
removido libera o telefone.

### Ficha do contato

Abrir um contato mostra a ficha:

- **Dados** e **próximo passo** (o que fazer e quando), editáveis. Nos dados fica a **temperatura**
  (frio, morno ou quente), que por enquanto o corretor marca à mão; o motivo e a sugestão
  automática chegam com o quadro do funil.
- **Notas** livres, que vão para a linha do tempo.
- **Negócios** do contato, com a etapa atual e o botão **Mudar etapa**.
- **Agenda:** as atividades ligadas ao contato.
- **Consentimento:** registrar que o cliente aceitou receber mensagens, e revogar.
- **Linha do tempo:** tudo o que aconteceu com o contato, com autor e hora.
- **Remover:** o contato sai das listas, mas não é apagado. Contato com negócio em andamento não
  pode ser removido: encerre o negócio antes.

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

**Agenda** mostra as pendentes dos próximos 14 dias agrupadas em Atrasadas, Hoje, Amanhã e os dias
seguintes, até 500 de uma vez; passando disso, um aviso pede para resolver as atrasadas. Marcar como **feita** registra o contato com o cliente; feita, cancelada e "não
compareceu" vão para a linha do tempo.

O detalhe da visita (imóvel visitado e retorno do cliente) fica na ficha do imóvel.

**Lembrete de visita:** um dia antes de cada visita pendente (ou no prazo escolhido em Ajustes ›
Atendimento), você recebe uma notificação na plataforma com a visita, a hora, o
cliente e o local. Clicar nela abre a Agenda.
- Visita feita, cancelada ou removida antes da hora não gera lembrete.
- Visita marcada para dali a menos tempo que o prazo também não gera.
- Mudar o prazo (ou desligar com 0) vale na hora para os lembretes que ainda não saíram; com outro
  prazo, as visitas já marcadas ficam sem lembrete, e as próximas usam o prazo novo.
- Se a plataforma estiver fora do ar na hora do lembrete e só voltar mais de meia hora depois, ele
  não sai.

O lembrete para o cliente, pelo WhatsApp, chega com o Mensageiro.

## Importar planilha

**Clientes › Importar** recebe um arquivo CSV com cabeçalho (no Excel: Salvar como › CSV).

1. O app lê o arquivo no navegador (UTF-8 ou o formato do Excel antigo) e aceita `;` ou `,`.
2. Sugere qual coluna é nome, telefone, e-mail, papel e observações; o corretor confere e muda.
3. Mostra as 10 primeiras linhas como ficariam.
4. O corretor escolhe o que fazer quando o contato já existe (mesmo telefone; se o telefone não
   achar ninguém, mesmo e-mail): **pular**, **completar só os campos vazios** ou **sobrescrever com
   a planilha**. Coluna não mapeada não apaga nem troca nada: sem a coluna de papel, o contato
   existente fica com os papéis que tinha (o novo entra como comprador).
5. O relatório mostra quantos foram criados, unidos a contatos existentes, pulados e rejeitados,
   com a linha da planilha (contando o cabeçalho como linha 1) e o motivo de cada rejeição. Uma
   linha que esbarra no telefone de outro contato (por exemplo, cadastrado ao mesmo tempo) é
   rejeitada, e as demais seguem.

Limite de 2.000 linhas por vez. Contatos importados entram **sem consentimento** e com origem
"importação".

## Exportar

**Exportar** baixa todos os contatos ativos da conta em CSV para o Excel (separador `;`, acentos
preservados): nome, telefone, e-mail, papéis, temperatura, origem, campanha, próximo passo (o quê e quando) e
data de cadastro. Células que começam como fórmula (`=`, `@`, ou `+`/`-` seguidos de texto) ganham um
apóstrofo para o Excel não executá-las; telefones e números com sinal saem como estão.
