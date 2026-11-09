---
titulo: Conexões (Instagram)
descricao: Como o corretor conecta o Instagram para publicar e agendar pelo Estúdio, e o que a equipe da plataforma configura antes.
---

# Conexões (Instagram)

Em **Ajustes**, seção **Conexões**, o corretor conecta a conta profissional do Instagram. O login é feito
no próprio Instagram e não exige página do Facebook.

Na mesma seção ficam dois cartões sem nada para configurar ainda, com os botões desligados e o porquê:
**WhatsApp** ("chega numa próxima versão"; o cartão já mostra os três passos que a conexão vai ter:
entrar com a conta da Meta, digitar o número que você já usa no WhatsApp Business e confirmar no
celular; até lá o Fazer agora abre o WhatsApp do seu celular) e **Agenda** ("opcional · fase 6": a
sincronização com uma agenda externa). À direita, uma frase de por que conectar e o lembrete de que
você pode desconectar quando quiser.

No menu de Ajustes, cada seção tem uma linha com o que está valendo: em Conexões, "Instagram
conectado", "Instagram precisa de atenção", "nada conectado" ou "Instagram e WhatsApp indisponíveis"
(quando a equipe ainda não configurou a conexão); no Negociador, ligado ou pausado, quem negocia e o
estilo; em Horário de atendimento, os prazos de cliente parado e da seleção.

## Para o corretor

1. Clique em **Conectar Instagram** (ou **Reconectar Instagram**, se a conta já foi conectada antes e
   desconectada). O Instagram abre e pede a sua autorização para o app publicar.
2. Ao voltar, o app mostra a conta conectada (`@usuario`) e o tipo:
   - **Conta comercial:** publica posts, carrosséis e stories.
   - **Conta de criador:** publica posts e carrosséis. Stories pela API exigem conta comercial.
   - **Conta pessoal:** não conecta. Mude para conta profissional no Instagram e conecte de novo.
3. **Testar publicação** confere, sem publicar nada, que o app consegue publicar na sua conta: ele
   pergunta ao Instagram quantas publicações a conta fez nas últimas 24 horas (o que só responde a
   quem tem a permissão de publicar) e mostra "Tudo certo" com essa conta, ou o motivo da falha. Um
   acesso vencido passa a **precisa de atenção**, com o botão **Reconectar**, que troca o acesso
   (também depois de trocar a senha do Instagram).
   **Desconectar** corta o acesso e apaga o acesso guardado. Publicações agendadas não saem enquanto a
   conta estiver desconectada.

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
   Ajustes virou uma tela com seções, mas esse endereço continua valendo: ele abre Ajustes na seção
   Conexões e conclui a conexão. Não precisa mudar nada na Meta.
   Enquanto a conexão não está configurada, a tela de Conexões de um corretor mostra esse endereço
   exato, com o botão **Copiar endereço**.
3. **Permissões pedidas pelo app:** `instagram_business_basic` e
   `instagram_business_content_publish`.
4. **Parâmetros:** em Configurações da app › Parâmetros, preencha `meta_app_id` (o ID do app) e
   `meta_app_secret` (a chave secreta, guardada cifrada).
5. **Contas de teste:** no app da Meta, adicione as contas do Instagram como **testadoras**. Cada
   pessoa aceita o convite no Instagram (Configurações › Apps e sites › Convites de testador).

Sem os parâmetros, o cartão do Instagram continua à vista, marcado "indisponível nesta instalação",
com o **Conectar Instagram** desligado e a explicação, e o Estúdio segue com **baixar a arte** e
**Publiquei por fora**.

Conectar e desconectar ficam na trilha de auditoria da plataforma (eventos `canal_conectado` e
`canal_desconectado`, só com os ids e o nome de quem fez).
