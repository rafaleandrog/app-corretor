---
titulo: Convidar corretores
descricao: Como a equipe da plataforma convida um corretor e libera o app para ele.
---

# Convidar corretores

Tela **Equipe da plataforma › Corretores**, para quem tem o papel `operacao`.

## Passo a passo

1. Clique em **Convidar corretor**, informe o e-mail dele e o **nome da conta** (o nome dele ou da
   imobiliária) e envie.
2. O corretor recebe um e-mail, aceita o convite e cria a senha. Só nesse momento a plataforma cria
   o usuário e a conta dele — convite não aceito não deixa nada para trás.
3. Quando o convite aparecer como **Aceito**, o administrador do app abre **Configurações ›
   Usuários**, seção **Externos**, e atribui ao corretor o papel **corretor**. O convite não leva
   papel: sem esse passo, o app continua fechado para ele.

Convite ainda não aceito pode ser **revogado**: o link deixa de funcionar na hora.

## O que precisa estar ligado na instância

O administrador da instância (alçada `apps`) libera, em **Admin › Instaláveis › Apps › Portal do
Corretor**:

- o **provisionamento de externos** e a capacidade **criar conta**;
- o **nível padrão de externos** em **escrita** (é o nível com que o corretor usa o app);
- o **e-mail de sistema** da instância, sem o qual o convite não sai.

Se algo faltar, o convite é recusado com a mensagem da plataforma (por exemplo, "provisionamento
não liberado" ou "e-mail de sistema indisponível").

## Regras que valem sempre

- **Um corretor, uma conta.** Cada convite cria uma conta nova; os dados de uma conta nunca
  aparecem em outra.
- **Um e-mail, um convite pendente.** Convidar de novo um e-mail com convite em aberto é recusado.
- A equipe da plataforma não vê clientes, imóveis nem conversas dos corretores.
