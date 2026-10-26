---
titulo: Conexões (Instagram)
descricao: Como o corretor conecta o Instagram para publicar e agendar pelo Estúdio, e o que a equipe da plataforma configura antes.
---

# Conexões (Instagram)

Em **Ajustes**, aba **Conexões**, o corretor conecta a conta profissional do Instagram. O login é feito
no próprio Instagram e não exige página do Facebook.

## Para o corretor

1. Clique em **Conectar Instagram**. O Instagram abre e pede a sua autorização para o app publicar.
2. Ao voltar, o app mostra a conta conectada (`@usuario`) e o tipo:
   - **Conta comercial:** publica posts, carrosséis e stories.
   - **Conta de criador:** publica posts e carrosséis. Stories pela API exigem conta comercial.
   - **Conta pessoal:** não conecta. Mude para conta profissional no Instagram e conecte de novo.
3. **Reconectar** troca o acesso, por exemplo depois de trocar a senha do Instagram.
   **Desconectar** corta o acesso. Publicações agendadas não saem enquanto a conta estiver
   desconectada.

O acesso vale 60 dias e é renovado sozinho pela rotina diária **Conexões do Instagram**. Se a
renovação falhar ou o Instagram recusar o acesso, a tela mostra **precisa de atenção**: é só
reconectar.

O app nunca mostra nem guarda em claro o acesso do Instagram. Ele fica cifrado e só é lido na hora
de publicar.

## Para a equipe da plataforma (antes do primeiro corretor)

1. **Crie um app na Meta** (developers.facebook.com) com o produto **Instagram** e a opção "API do
   Instagram com login do Instagram". Ele pode ficar em **modo de desenvolvimento**. Nesse modo, só
   contas adicionadas como testadoras conectam, o que basta para o MVP.
2. **URI de redirecionamento:** cadastre `https://<instância>/portal_corretor/ajustes/conexoes`.
   Ajustes virou uma tela só com abas, mas esse endereço continua valendo: ele abre Ajustes na aba
   Conexões e conclui a conexão. Não precisa mudar nada na Meta.
   Enquanto a conexão não está configurada, a tela de Conexões de um corretor mostra esse endereço
   exato, com o botão **Copiar endereço**.
3. **Permissões pedidas pelo app:** `instagram_business_basic` e
   `instagram_business_content_publish`.
4. **Parâmetros:** em Configurações da app › Parâmetros, preencha `meta_app_id` (o ID do app) e
   `meta_app_secret` (a chave secreta, guardada cifrada).
5. **Contas de teste:** no app da Meta, adicione as contas do Instagram como **testadoras**. Cada
   pessoa aceita o convite no Instagram (Configurações › Apps e sites › Convites de testador).

Sem os parâmetros, a tela de Conexões diz que a conexão ainda não foi configurada, e o Estúdio
segue com **baixar a arte** e **Publiquei por fora**.
