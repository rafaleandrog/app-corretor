---
titulo: Convidar corretores
descricao: Como a equipe da plataforma convida um corretor e libera o app para ele.
---

# Convidar corretores

Tela **Equipe da plataforma › Corretores**, para quem tem o papel `operacao` — que o administrador
do app atribui em **Configurações › Usuários**, seção **Equipe**. Para quem só tem esse papel, o
Início do app abre direto nesta tela.

## Passo a passo

1. Clique em **Convidar corretor**, informe o e-mail dele e o **nome da conta** (o nome dele ou da
   imobiliária) e envie.
2. O corretor recebe um e-mail, aceita o convite e cria a senha. Só nesse momento a plataforma cria
   o usuário e a conta dele — convite não aceito não deixa nada para trás.
3. Quando o convite aparecer como **Aceito**, o administrador do app abre **Configurações ›
   Usuários**, seção **Externos**, e atribui ao corretor o papel **corretor**. O convite não leva
   papel: sem esse passo, o app continua fechado para ele.
4. Mande ao corretor o **endereço do app**: `https://<endereço da instância>/portal_corretor`. O
   corretor é usuário externo, e a plataforma não mostra a ele lista de apps nem menu na página
   inicial: quem entra pela página inicial vê só a marca da instância e o avatar. Ele entra pelo
   endereço do app (vale salvar nos favoritos). O e-mail de convite é da plataforma e não leva esse
   endereço.

Convite ainda não aceito pode ser **revogado**: o link deixa de funcionar na hora. A lista mostra
50 convites por vez; **Mostrar mais** traz os seguintes.

Se o convite for criado mas o e-mail não sair, o app avisa: o convite já está na lista e não adianta
convidar de novo o mesmo e-mail enquanto ele estiver pendente — revogue e convide outra vez, se for
o caso.

## O que precisa estar ligado na instância

O administrador da instância (alçada `apps`) libera, em **Admin › Instaláveis › Apps › Portal do
Corretor**:

- o **provisionamento de externos** e a capacidade **criar conta**;
- o **nível padrão de externos** em **escrita** (é o nível com que o corretor usa o app);
- o **e-mail de sistema** da instância, sem o qual o convite não sai.

Se algo faltar, o convite é recusado e a mensagem traz o código da plataforma — por exemplo,
`PROVISIONA_NAO_LIBERADA` (provisionamento ou "criar conta" não liberados) ou
`EMAIL_SISTEMA_INDISPONIVEL` (e-mail de sistema desligado).

## Regras que valem sempre

- **Um corretor, uma conta.** Cada convite cria uma conta nova; os dados de uma conta nunca
  aparecem em outra.
- **Um e-mail, um convite pendente.** Convidar de novo um e-mail com convite em aberto é recusado.
- A equipe da plataforma não vê clientes, imóveis nem conversas dos corretores.

## Contas de demonstração

Conta cujo nome termina em **(demo)** — por exemplo `Marina (demo)` — recebe dados de demonstração
quando o app inicia (por enquanto, o nome da conta e as configurações padrão). Use o sufixo só em
contas de teste da equipe, nunca na de um corretor real.
