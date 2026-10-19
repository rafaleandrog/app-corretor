// Gerado por scripts/gerar-ajuda.mjs a partir de docs/. Não edite: rode `pnpm ajuda`.
export interface ArtigoAjuda { slug: string; titulo: string; secao: string; texto: string }
export const ARTIGOS: ArtigoAjuda[] = [
 {
  "slug": "readme",
  "titulo": "Portal do Corretor",
  "secao": "Portal do Corretor",
  "texto": "App do corretor de imóveis. Cada corretor tem a **própria conta**: nenhum corretor vê nada de outro,\ne a garantia é do banco de dados da plataforma, não só das telas."
 },
 {
  "slug": "readme",
  "titulo": "Portal do Corretor",
  "secao": "O que existe nesta versão (0.11.0)",
  "texto": "| Para quem | Tela | O que faz |\n|---|---|---|\n| Corretor | **Início** | O que fazer hoje (quentes sem resposta, abordagens atrasadas, visitas, próximos passos) e o que falta para começar — ver [Funil, temperatura e fila do dia](funil.md) |\n| Corretor | **Desempenho** | Leads, conversão entre etapas, vendas, VGV, captações, comissão prevista, origem e motivos de perda — ver [Desempenho, envios e dados de demonstração](desempenho.md) |\n| Corretor | **Funil** | Quadro dos negócios por etapa, com temperatura e abordagem atrasada; arrastar muda a etapa |\n| Corretor | **Clientes** | Contatos, ficha com negócios, notas, consentimento e linha do tempo; importar e exportar planilha — ver [Clientes, negócios e agenda](clientes-e-agenda.md) |\n| Corretor | **Agenda** | Atividades pendentes dos próximos 14 dias |\n| Corretor | **Imóveis › Minha carteira** | Imóveis com fotos, qualidade do anúncio, autorização de venda, descrição com IA e visitas — ver [Imóveis e empreendimentos](imoveis.md) |\n| Corretor | **Imóveis › Empreendimentos** | Lançamentos com materiais e as unidades da carteira |\n| Corretor | **Estúdio** | Peças para o Instagram com a sua marca: textos com IA, artes montadas pelo app ou feitas no Canva IA, aprovação e download — ver [Estúdio de conteúdo](estudio.md) |\n| Corretor | **Minha página** | A página pública por blocos, com os imóveis anunciados e o formulário de contato — ver [Minha página, ficha pública e link rastreado](minha-pagina.md) |\n| Visitante | **Página e ficha pública** (sem login) | A página do corretor e a ficha de cada imóvel anunciado; o contato vira cliente no funil |\n| Corretor | **Clientes › ficha › Seleções e portal** | Monta seleções de imóveis e gera o link do portal do cliente — ver [Seleções e Portal do Cliente](selecoes-e-portal.md) |\n| Cliente | **Seleção e Portal do Cliente** (link pessoal, sem login) | Reage aos imóveis (gostei, não gostei, quero visitar), vê as visitas, pede para remarcar e manda mensagem ao corretor |\n| Corretor | **Assistente** (botão em todas as telas) | Tira dúvidas pelo manual, ajuda a decidir quem atender e cria lembretes ou agenda peças com a sua confirmação — ver [Assistente do Corretor](assistente.md) |\n| Corretor | **Ajustes › Funil e abordagens** | As etapas de cada funil, a chance de fechar e a abordagem por etapa e temperatura |\n| Corretor | **Ajustes › Conexões** | Conecta o Instagram para publicar e agendar pelo Estúdio — ver [Conexões (Instagram)](conexoes.md) |\n| Corretor | **Ajustes › Conta e marca** | Seus dados, os dados da conta e as regras de atendimento — ver [Conta e ajustes](conta-e-ajustes.md) |\n| Equipe da plataforma | **Equipe da plataforma › Corretores** | Convida corretores e acompanha os convites — ver [Convidar corretores](convidar-corretores.md) |\n\nIntegração disponível: Instagram (publicar e agendar pelo Estúdio). O WhatsApp ainda não. A IA aparece no Assistente, nos imóveis (descrição e leitura de fotos), na Minha página e no Estúdio (textos),\nquando liberada pelo administrador. Cada funcionalidade passa a constar aqui na versão em que chegar."
 },
 {
  "slug": "readme",
  "titulo": "Portal do Corretor",
  "secao": "Papéis",
  "texto": "| Papel | Quem | Onde se atribui |\n|---|---|---|\n| `corretor` | O corretor, usuário externo dono da conta | Configurações › Usuários, seção Externos, depois que ele aceita o convite |\n| `operacao` | A equipe da plataforma que convida corretores | Configurações › Usuários, seção Equipe |\n\nSem o papel, a tela mostra \"Esta área não está liberada para você\" e diz qual papel pedir.\n\n### Endereço recebido (diagnóstico)\n\nAo abrir um endereço que o app não conhece, como `/portal_corretor/retorno?code=teste`, a tela\n\"Página não encontrada\" mostra `/retorno?code=teste`. Serve para a equipe conferir o retorno das\nconexões com a Meta, quando elas chegarem."
 },
 {
  "slug": "readme",
  "titulo": "Portal do Corretor",
  "secao": "Para o administrador da instância",
  "texto": "- **IA:** o app declara três slots próprios: **Conteúdo** e **Assistente do Corretor** (base\n  `normal`) e **Leitura de fotos** (base `arquivos`). Para ligá-los, em Admin › Instaláveis ›\n  Apps › Portal do Corretor › IA, autorize as bases `normal` e `arquivos` (chave da plataforma) ou\n  configure uma chave própria em cada slot. Sem isso o app funciona, sem os botões de IA, e o\n  Assistente vira busca no manual. O microfone do Assistente aparece quando o slot de áudio da\n  plataforma estiver liberado para o app.\n\n- **Rotina:** \"Temperatura dos contatos\" (diária) esfria quem passou 7 dias sem contato. O horário\n  e o liga-desliga ficam em Configurações da app › Rotinas (admin da app); sem ajuste, roda às 06:00 UTC.\n\n- **Páginas públicas e webhooks:** a página do corretor, a ficha do imóvel, o formulário e o link\n  rastreado — ver [Minha página, ficha pública e link rastreado](minha-pagina.md#para-o-administrador-da-instância);\n  a seleção e o portal do cliente — ver [Seleções e Portal do Cliente](selecoes-e-portal.md#para-o-administrador-da-instância).\n\n- **Instagram:** o app da Meta, os parâmetros `meta_app_id` e `meta_app_secret` e as contas de\n  teste — ver [Conexões (Instagram)](conexoes.md#para-a-equipe-da-plataforma-antes-do-primeiro-corretor).\n  A rotina \"Conexões do Instagram\" (diária) renova os acessos."
 },
 {
  "slug": "readme",
  "titulo": "Portal do Corretor",
  "secao": "Serviços externos",
  "texto": "- **Instagram (Meta):** `graph.instagram.com` e `api.instagram.com`, para conectar e publicar.\n  O app só chama a Meta quando o corretor conecta, publica ou agenda, e na renovação diária dos\n  acessos."
 },
 {
  "slug": "assistente",
  "titulo": "Assistente do Corretor",
  "secao": "Assistente do Corretor",
  "texto": "O botão **Assistente** fica no canto de baixo, em todas as telas do corretor. Ele abre um chat. Dá\npara perguntar por escrito ou ditar, pelo microfone, quando a transcrição de voz estiver liberada.\nA conversa continua enquanto você troca de tela."
 },
 {
  "slug": "assistente",
  "titulo": "Assistente do Corretor",
  "secao": "O que ele responde",
  "texto": "| Pergunta | Exemplo | De onde vem a resposta |\n|---|---|---|\n| **Como usar o app** | \"como conecto meu Instagram?\", \"dá para mandar uma seleção para o cliente?\" | Deste manual (os artigos da documentação do app) e do que já está ligado na sua conta |\n| **Quem atender** | \"quem eu atendo primeiro hoje?\" | Da fila do dia do Início, com o motivo de cada um |\n| **Sobre um cliente** | \"esse cliente vale insistir?\" | Da ficha do cliente: temperatura, último contato, próximo passo, perfil de busca e histórico recente |\n\n**A resposta:**\n- Diz em que artigo do manual se baseou e tem o link **abrir a documentação**.\n- Quando é algo que se faz numa tela, mostra o botão **Abrir** com o nome da tela.\n- Se o manual não cobre o assunto, ele diz que não sabe e indica o menu **?** › Reportar bug ou\n  Fazer sugestão. Ele não inventa funcionalidade.\n\nNa ficha do cliente, o botão **Perguntar ao Assistente** abre o chat já sobre aquele cliente. O\nnome dele aparece no topo, e **Tirar** volta à conversa geral."
 },
 {
  "slug": "assistente",
  "titulo": "Assistente do Corretor",
  "secao": "O que ele faz, com confirmação",
  "texto": "| Pedido | Exemplo | O que acontece no \"Confirmar\" |\n|---|---|---|\n| **Lembrete ou tarefa** | \"me lembra de ligar para a Ana amanhã às 10h\" | Cria a atividade (tarefa, ligação, mensagem ou retorno) na sua Agenda, ligada ao cliente quando é sobre um cliente da fila do dia ou da ficha aberta |\n| **Agendar uma peça** | \"agenda o post da casa do Lago para sexta às 18h\" | Agenda a peça aprovada do Estúdio para publicar no Instagram, como em [Estúdio › Publicar](estudio.md) |\n\nAntes de fazer, o Assistente mostra **Posso fazer isto?** com o que vai acontecer, escrito pelo\npróprio app: a data e a hora conferidas e o cliente ou a peça encontrados. Nada acontece até você\nclicar em **Confirmar**. Em **Agora não**, nada é feito. As mesmas regras das telas valem aqui: por\nexemplo, agendar só de 5 minutos a 90 dias à frente, com o Instagram conectado.\n\n**O que ele nunca faz:**\n- mandar mensagem a cliente;\n- mudar preço, proposta, comissão ou autorização;\n- apagar algo.\n\nPara esses casos, ele explica onde você mesmo faz."
 },
 {
  "slug": "assistente",
  "titulo": "Assistente do Corretor",
  "secao": "Sem IA",
  "texto": "Se a IA do Assistente não estiver liberada pelo administrador, o chat vira uma **busca no manual**.\nEle mostra os artigos mais próximos da sua pergunta. As ações e as decisões precisam da IA."
 },
 {
  "slug": "assistente",
  "titulo": "Assistente do Corretor",
  "secao": "Privacidade",
  "texto": "A IA recebe:\n- a pergunta e as últimas mensagens da conversa;\n- a tela em que você está e um resumo da conta (CRECI cadastrado, Instagram conectado, página\n  publicada, totais);\n- a fila do dia (nome, temperatura e motivo);\n- os títulos das peças do Estúdio;\n- os trechos do manual ligados à pergunta.\n\nSobre um cliente em foco, vão a temperatura, o perfil de busca e os resumos do histórico. **Telefone\ne e-mail não vão.** Cliente anonimizado não entra."
 },
 {
  "slug": "clientes-e-agenda",
  "titulo": "Clientes, negócios e agenda",
  "secao": "Clientes, negócios e agenda",
  "texto": "Tudo aqui é da conta do corretor: ninguém de outra conta vê, abre ou altera. Um endereço de\ncontato, negócio ou atividade de outra conta responde \"não encontrado\"."
 },
 {
  "slug": "clientes-e-agenda",
  "titulo": "Clientes, negócios e agenda",
  "secao": "Clientes",
  "texto": "**Clientes** lista os contatos da conta, 50 por página, em ordem alfabética.\n\n- **Busca** por nome, telefone ou e-mail.\n- **Filtros:** papel (comprador, proprietário, investidor, parceiro, fornecedor), temperatura e\n  \"parados há mais de N dias\" (sem contato registrado nesse tempo; para quem veio de planilha, conta\n  a partir da importação).\n- A busca e os filtros ficam no endereço da página: dá para voltar ou guardar o link.\n- **Novo contato:** nome e telefone ou e-mail. Sem papel informado, o contato entra como comprador.\n  O telefone é guardado no formato internacional (`+55…`); sem o `+`, o app assume Brasil.\n\n### Duplicatas\n\nNa mesma conta não existem dois contatos ativos com o mesmo telefone. Ao cadastrar ou editar com\num telefone que já existe, o app recusa e, em geral, diz o nome de quem já tem aquele número. Contato\nremovido libera o telefone.\n\n### Ficha do contato\n\nAbrir um contato mostra a ficha:\n\n- **Dados** e **próximo passo** (o que fazer e quando), editáveis. Nos dados fica a **temperatura**\n  (frio, morno ou quente), que por enquanto o corretor marca à mão; o motivo e a sugestão\n  automática chegam com o quadro do funil.\n- **Notas** livres, que vão para a linha do tempo.\n- **Negócios** do contato, com a etapa atual e o botão **Mudar etapa**.\n- **Agenda:** as atividades ligadas ao contato.\n- **Consentimento:** registrar que o cliente aceitou receber mensagens, e revogar.\n- **Linha do tempo:** tudo o que aconteceu com o contato, com autor e hora.\n- **Remover:** o contato sai das listas, mas não é apagado. Contato com negócio em andamento não\n  pode ser removido: encerre o negócio antes."
 },
 {
  "slug": "clientes-e-agenda",
  "titulo": "Clientes, negócios e agenda",
  "secao": "Negócios e funil",
  "texto": "Um negócio é uma oportunidade com um contato, em um de dois funis:\n\n| Funil | Para | Etapas iniciais |\n|---|---|---|\n| Compra | Cliente comprador | Novo → Em atendimento → Qualificado → Visita agendada → Visitou → Proposta → Documentação → Ganho / Perdido |\n| Venda e captação | Proprietário | Contato → Avaliação → Autorização assinada → Anunciado → Proposta recebida → Vendido / Encerrado |\n\n- Negócio novo começa na primeira etapa em andamento do funil.\n- Valores em reais; o app aceita `1.234,56` ou `1234.56`.\n- Mover para a etapa de **perda** pede o motivo (preço, localização, financiamento, desistiu,\n  comprou com outro, sem resposta, outro). Ganho e perda ficam com data.\n- Cada mudança de etapa vai para a linha do tempo e conta como contato com o cliente.\n\n### Ajustes › Funil\n\nCada funil tem a sua lista de etapas, na ordem, com a chance de fechar (de 0 a 100%), usada nas\nprevisões. O corretor pode renomear, reordenar, criar e tirar etapas, e salva um funil por vez.\n\nRegras: ao menos uma etapa em andamento, exatamente uma de ganho e uma de perda, que ficam no fim\ndo funil, e nomes sem repetição. Etapa tirada do funil não some dos negócios que estão nela: fica inativa e deixa de\naparecer para os negócios novos."
 },
 {
  "slug": "clientes-e-agenda",
  "titulo": "Clientes, negócios e agenda",
  "secao": "Agenda",
  "texto": "Atividades são tarefas, ligações, mensagens, visitas, reuniões e retornos, com dia, hora e local,\nligadas ou não a um contato e a um negócio.\n\n**Agenda** mostra as pendentes dos próximos 14 dias agrupadas em Atrasadas, Hoje, Amanhã e os dias\nseguintes, até 500 de uma vez; passando disso, um aviso pede para resolver as atrasadas. Marcar como **feita** registra o contato com o cliente; feita, cancelada e \"não\ncompareceu\" vão para a linha do tempo.\n\nO detalhe da visita (imóvel visitado e retorno do cliente) chega junto com os imóveis."
 },
 {
  "slug": "clientes-e-agenda",
  "titulo": "Clientes, negócios e agenda",
  "secao": "Importar planilha",
  "texto": "**Clientes › Importar** recebe um arquivo CSV com cabeçalho (no Excel: Salvar como › CSV).\n\n1. O app lê o arquivo no navegador (UTF-8 ou o formato do Excel antigo) e aceita `;` ou `,`.\n2. Sugere qual coluna é nome, telefone, e-mail, papel e observações; o corretor confere e muda.\n3. Mostra as 10 primeiras linhas como ficariam.\n4. O corretor escolhe o que fazer quando o contato já existe (mesmo telefone; se o telefone não\n   achar ninguém, mesmo e-mail): **pular**, **completar só os campos vazios** ou **sobrescrever com\n   a planilha**. Coluna não mapeada não apaga nem troca nada: sem a coluna de papel, o contato\n   existente fica com os papéis que tinha (o novo entra como comprador).\n5. O relatório mostra quantos foram criados, unidos a contatos existentes, pulados e rejeitados,\n   com a linha da planilha (contando o cabeçalho como linha 1) e o motivo de cada rejeição. Uma\n   linha que esbarra no telefone de outro contato (por exemplo, cadastrado ao mesmo tempo) é\n   rejeitada, e as demais seguem.\n\nLimite de 2.000 linhas por vez. Contatos importados entram **sem consentimento** e com origem\n\"importação\"."
 },
 {
  "slug": "clientes-e-agenda",
  "titulo": "Clientes, negócios e agenda",
  "secao": "Exportar",
  "texto": "**Exportar** baixa todos os contatos ativos da conta em CSV para o Excel (separador `;`, acentos\npreservados): nome, telefone, e-mail, papéis, temperatura, origem, campanha, próximo passo (o quê e quando) e\ndata de cadastro. Células que começam como fórmula (`=`, `@`, ou `+`/`-` seguidos de texto) ganham um\napóstrofo para o Excel não executá-las; telefones e números com sinal saem como estão."
 },
 {
  "slug": "conexoes",
  "titulo": "Conexões (Instagram)",
  "secao": "Conexões (Instagram)",
  "texto": "Em **Ajustes › Conexões** o corretor conecta a conta profissional do Instagram. O login é feito\nno próprio Instagram e não exige página do Facebook."
 },
 {
  "slug": "conexoes",
  "titulo": "Conexões (Instagram)",
  "secao": "Para o corretor",
  "texto": "1. Clique em **Conectar Instagram**. O Instagram abre e pede a sua autorização para o app publicar.\n2. Ao voltar, o app mostra a conta conectada (`@usuario`) e o tipo:\n   - **Conta comercial:** publica posts, carrosséis e stories.\n   - **Conta de criador:** publica posts e carrosséis. Stories pela API exigem conta comercial.\n   - **Conta pessoal:** não conecta. Mude para conta profissional no Instagram e conecte de novo.\n3. **Reconectar** troca o acesso, por exemplo depois de trocar a senha do Instagram.\n   **Desconectar** corta o acesso. Publicações agendadas não saem enquanto a conta estiver\n   desconectada.\n\nO acesso vale 60 dias e é renovado sozinho pela rotina diária **Conexões do Instagram**. Se a\nrenovação falhar ou o Instagram recusar o acesso, a tela mostra **precisa de atenção**: é só\nreconectar.\n\nO app nunca mostra nem guarda em claro o acesso do Instagram. Ele fica cifrado e só é lido na hora\nde publicar."
 },
 {
  "slug": "conexoes",
  "titulo": "Conexões (Instagram)",
  "secao": "Para a equipe da plataforma (antes do primeiro corretor)",
  "texto": "1. **Crie um app na Meta** (developers.facebook.com) com o produto **Instagram** e a opção \"API do\n   Instagram com login do Instagram\". Ele pode ficar em **modo de desenvolvimento**. Nesse modo, só\n   contas adicionadas como testadoras conectam, o que basta para o MVP.\n2. **URI de redirecionamento:** cadastre `https://<instância>/portal_corretor/ajustes/conexoes`.\n   Enquanto a conexão não está configurada, a tela de Conexões de um corretor mostra esse endereço\n   exato, com o botão **Copiar endereço**.\n3. **Permissões pedidas pelo app:** `instagram_business_basic` e\n   `instagram_business_content_publish`.\n4. **Parâmetros:** em Configurações da app › Parâmetros, preencha `meta_app_id` (o ID do app) e\n   `meta_app_secret` (a chave secreta, guardada cifrada).\n5. **Contas de teste:** no app da Meta, adicione as contas do Instagram como **testadoras**. Cada\n   pessoa aceita o convite no Instagram (Configurações › Apps e sites › Convites de testador).\n\nSem os parâmetros, a tela de Conexões diz que a conexão ainda não foi configurada, e o Estúdio\nsegue com **baixar a arte** e **Publiquei por fora**."
 },
 {
  "slug": "conta-e-ajustes",
  "titulo": "Conta e ajustes",
  "secao": "Conta e ajustes",
  "texto": "Em **Ajustes › Conta e marca** o corretor mantém três blocos. Cada um tem o botão de lápis para\neditar."
 },
 {
  "slug": "conta-e-ajustes",
  "titulo": "Conta e ajustes",
  "secao": "Seus dados: CRECI e telefone",
  "texto": "- **CRECI**: é aqui que você cadastra. O formato é `UF-número-F` (pessoa física) ou `-J` (pessoa\n  jurídica), por exemplo `DF-12345-F`. Pode digitar em minúsculas: o app corrige. O CRECI vai no\n  rodapé das artes e na legenda das peças do Estúdio. Sem ele, a peça não é aprovada.\n- **Telefone (WhatsApp)** com DDD, por exemplo `(61) 99999-9999` (o zero antes do DDD pode ficar).\n  Sem o `+` do país, o app entende que é um número do Brasil e exige DDD e 8 ou 9 dígitos.\n- **Situação do CRECI**: começa como \"não verificado\". A verificação é feita pela equipe da\n  plataforma e ainda não tem tela nesta versão."
 },
 {
  "slug": "conta-e-ajustes",
  "titulo": "Conta e ajustes",
  "secao": "Conta",
  "texto": "- **Nome da conta**: o nome com que você trabalha; nas próximas versões aparece na sua página e\n  para os seus clientes.\n- **Tipo**: corretor autônomo, imobiliária ou incorporadora.\n- **CPF ou CNPJ** e **CRECI jurídico** (imobiliária): opcionais."
 },
 {
  "slug": "conta-e-ajustes",
  "titulo": "Conta e ajustes",
  "secao": "Atendimento",
  "texto": "| Ajuste | Padrão | Para que serve |\n|---|---|---|\n| Prazo de primeiro atendimento | 5 minutos | Meta de tempo para responder um contato novo |\n| Cliente parado depois de | 7 dias | Quando um cliente sem conversa entra na fila de retomada |\n| Validade da seleção enviada | 14 dias | Por quanto tempo o link de uma seleção de imóveis vale |\n| Aprovação de conteúdo | Você aprova cada peça | Ou: publica sozinho se você não responder na janela |\n| Janela de aprovação | 24 horas | Usada quando a aprovação é por janela |\n\nEnquanto você não salvar, valem os padrões. Os ajustes passam a ter efeito à medida que as\nfuncionalidades chegam (funil, seleções, Estúdio)."
 },
 {
  "slug": "conta-e-ajustes",
  "titulo": "Conta e ajustes",
  "secao": "A marca",
  "texto": "Logo, cores e foto entram junto com o Estúdio de conteúdo, numa próxima versão."
 },
 {
  "slug": "convidar-corretores",
  "titulo": "Convidar corretores",
  "secao": "Convidar corretores",
  "texto": "Tela **Equipe da plataforma › Corretores**, para quem tem o papel `operacao` — que o administrador\ndo app atribui em **Configurações › Usuários**, seção **Equipe**. Para quem só tem esse papel, o\nInício do app abre direto nesta tela."
 },
 {
  "slug": "convidar-corretores",
  "titulo": "Convidar corretores",
  "secao": "Passo a passo",
  "texto": "1. Clique em **Convidar corretor**, informe o e-mail dele e o **nome da conta** (o nome dele ou da\n   imobiliária) e envie.\n2. O corretor recebe um e-mail, aceita o convite e cria a senha. Só nesse momento a plataforma cria\n   o usuário e a conta dele — convite não aceito não deixa nada para trás.\n3. Quando o convite aparecer como **Aceito**, o administrador do app abre **Configurações ›\n   Usuários**, seção **Externos**, e atribui ao corretor o papel **corretor**. O convite não leva\n   papel: sem esse passo, o app continua fechado para ele.\n\nConvite ainda não aceito pode ser **revogado**: o link deixa de funcionar na hora. A lista mostra\n50 convites por vez; **Mostrar mais** traz os seguintes.\n\nSe o convite for criado mas o e-mail não sair, o app avisa: o convite já está na lista e não adianta\nconvidar de novo o mesmo e-mail enquanto ele estiver pendente — revogue e convide outra vez, se for\no caso."
 },
 {
  "slug": "convidar-corretores",
  "titulo": "Convidar corretores",
  "secao": "O que precisa estar ligado na instância",
  "texto": "O administrador da instância (alçada `apps`) libera, em **Admin › Instaláveis › Apps › Portal do\nCorretor**:\n\n- o **provisionamento de externos** e a capacidade **criar conta**;\n- o **nível padrão de externos** em **escrita** (é o nível com que o corretor usa o app);\n- o **e-mail de sistema** da instância, sem o qual o convite não sai.\n\nSe algo faltar, o convite é recusado e a mensagem traz o código da plataforma — por exemplo,\n`PROVISIONA_NAO_LIBERADA` (provisionamento ou \"criar conta\" não liberados) ou\n`EMAIL_SISTEMA_INDISPONIVEL` (e-mail de sistema desligado)."
 },
 {
  "slug": "convidar-corretores",
  "titulo": "Convidar corretores",
  "secao": "Regras que valem sempre",
  "texto": "- **Um corretor, uma conta.** Cada convite cria uma conta nova; os dados de uma conta nunca\n  aparecem em outra.\n- **Um e-mail, um convite pendente.** Convidar de novo um e-mail com convite em aberto é recusado.\n- A equipe da plataforma não vê clientes, imóveis nem conversas dos corretores."
 },
 {
  "slug": "convidar-corretores",
  "titulo": "Convidar corretores",
  "secao": "Contas de demonstração",
  "texto": "Conta cujo nome termina em **(demo)** — por exemplo `Marina (demo)` — recebe dados de demonstração\nquando o app inicia (por enquanto, o nome da conta e as configurações padrão). Use o sufixo só em\ncontas de teste da equipe, nunca na de um corretor real."
 },
 {
  "slug": "desempenho",
  "titulo": "Desempenho, envios e dados de demonstração",
  "secao": "Desempenho",
  "texto": "**Desempenho** mostra os números do período escolhido (7, 30 ou 90 dias, ou 12 meses),\ncomparados ao período anterior de mesmo tamanho.\n\n**Funil de compra.** A turma é a dos negócios de compra **abertos no período** (os leads). Para\ncada um, conta até onde ele chegou, mesmo que depois tenha recuado ou sido perdido:\n\n| Número | Conta |\n|---|---|\n| Leads | Negócios de compra abertos no período |\n| Lead → atendimento | Dos leads, quantos chegaram a \"Em atendimento\" ou além |\n| Lead → visita | Dos leads, quantos chegaram a \"Visitou\" ou além |\n| Visita → proposta | Dos que visitaram, quantos chegaram a \"Proposta\" ou além |\n| Proposta → ganho | Dos que chegaram à proposta, quantos foram ganhos |\n| Conversão total | Ganhos sobre leads |\n\n\"Chegar a uma etapa\" vale pelo papel da etapa no funil, não pelo nome: renomear \"Visitou\" não\nmuda a conta. Etapa criada pelo corretor não tem papel próprio: o negócio continua contado nos\nleads e vale o papel mais avançado que ele já alcançou nas etapas padrão. Para negócios abertos\nantes desta versão, o app só sabe a etapa atual: um negócio desses que já foi perdido não conta\ncomo tendo chegado a visita ou proposta. Sem leads, as taxas aparecem\ncomo \"—\".\n\n**Resultados.** Vendas (ganhos no período), VGV (soma do valor estimado das vendas), ciclo médio\n(dias entre abrir e ganhar), visitas feitas, captações (negócios de venda abertos no período que\nchegaram à autorização assinada) e a **comissão prevista**: a soma, nos negócios em andamento, de\nvalor × comissão × chance da etapa (Ajustes › Funil). Negócio sem valor ou sem comissão fica de\nfora e é contado à parte.\n\n**Por origem** (leads, ganhos e conversão por canal) e **motivos de perda** completam a tela.\nTempo de primeiro atendimento, números do atendimento automático, conteúdo, custo por lead,\ncomissão recebida e metas chegam nas próximas versões.\n\nO **Início** mostra a faixa da semana: contatos novos, leads e visitas feitas nos últimos 7 dias,\nmais a comissão prevista."
 },
 {
  "slug": "desempenho",
  "titulo": "Desempenho, envios e dados de demonstração",
  "secao": "Tudo que você mandou",
  "texto": "Na ficha do cliente, **Registrar envio** anota o que o corretor mandou (imóvel, arquivo,\nmensagem, localização) e por onde (WhatsApp, e-mail, pessoalmente). Com um imóvel, o app devolve\na mensagem pronta para colar no WhatsApp (nome do cliente, título, bairro e preço; nunca o\nproprietário nem o endereço completo). O envio conta como contato com o cliente e entra na linha\ndo tempo. A ficha do imóvel mostra a quem ele foi enviado.\n\nCom a Minha página no ar e o imóvel publicado, a mensagem leva um link rastreado: a ficha do\ncliente mostra quantas vezes ele abriu — ver [Minha página, ficha pública e link rastreado](minha-pagina.md#link-rastreado)."
 },
 {
  "slug": "desempenho",
  "titulo": "Desempenho, envios e dados de demonstração",
  "secao": "Dados de demonstração",
  "texto": "Nas contas de teste (nome terminado em \"(demo)\"), o Início oferece **Gerar dados de\ndemonstração** enquanto a conta não tem nenhum contato. Ele cria 10 clientes com origem, 10\nnegócios, 2 imóveis e 2 visitas, com o próprio corretor como responsável. Origens que já\nexistem são reaproveitadas e os imóveis recebem o próximo código livre. Se alguma etapa padrão\nfoi renomeada ou removida, o app avisa qual é e não grava nada.\n\n### Conferência manual (últimos 30 dias, logo depois de gerar)\n\n| Cliente | Funil | Etapa | Valor | Origem |\n|---|---|---|---|---|\n| Ana | compra | Novo | R$ 300.000 | Instagram |\n| Bruno | compra | Em atendimento | R$ 500.000 | WhatsApp |\n| Carla | compra | Qualificado (visita amanhã) | R$ 400.000 | Indicação |\n| Diego | compra | Visitou (retorno nota 4) | R$ 700.000 | Portal |\n| Elisa | compra | Proposta | R$ 900.000 | Indicação |\n| Fábio | compra | Ganho (passou por Documentação) | R$ 650.000 | Indicação |\n| Gabi | compra | Ganho (passou por Proposta) | R$ 420.000 | Instagram |\n| Hugo | compra | Perdido por preço (tinha visitado) | R$ 350.000 | Portal |\n| Iara | venda | Autorização assinada | R$ 1.200.000 | Indicação |\n| João | venda | Avaliação | R$ 800.000 | Placa |\n\nTodos com comissão de 5%. Números esperados:\n\n- Leads: **8** (os de compra).\n- Lead → atendimento: 7 de 8 = **88%** (todos menos Ana).\n- Lead → visita: 5 de 8 = **63%** (Diego, Elisa, Fábio, Gabi, Hugo).\n- Visita → proposta: 3 de 5 = **60%** (Elisa, Fábio, Gabi).\n- Proposta → ganho: 2 de 3 = **67%**.\n- Conversão total: 2 de 8 = **25%**.\n- Vendas: **2**; VGV: **R$ 1.070.000**.\n- Captações: **1** (Iara).\n- Visitas feitas: **1** (Diego).\n- Por origem: Indicação 3 leads e 1 ganho; Instagram 2 e 1; Portal 2 e 0; WhatsApp 1 e 0.\n- Motivos de perda: preço, 1.\n- Comissão prevista: 5% × (300 mil × 5% + 500 mil × 10% + 400 mil × 20% + 700 mil × 50% + 900 mil × 70%\n  + 1,2 milhão × 40% + 800 mil × 15%) = **R$ 86.250**."
 },
 {
  "slug": "estudio",
  "titulo": "Estúdio de conteúdo",
  "secao": "Estúdio de conteúdo",
  "texto": "O **Estúdio** cria peças para o Instagram com a marca do corretor e publica de três jeitos:\npublicar agora, agendar no app ou baixar a arte e publicar por fora. Para os dois primeiros, a\nconta do Instagram precisa estar conectada em [Conexões](conexoes.md)."
 },
 {
  "slug": "estudio",
  "titulo": "Estúdio de conteúdo",
  "secao": "Sua marca",
  "texto": "Em **Sua marca** ficam a cor principal, a cor de apoio, o estilo (moderno, clássico ou\nminimalista), uma assinatura curta opcional (por exemplo \"Seu corretor no Lago Sul\"), o logo e a\nsua foto. A arte do gerador do app sai com o seu nome e o CRECI no rodapé, e a legenda de toda peça\naprovada leva o CRECI (o app acrescenta se faltar, inclusive em arte feita no Canva). **Sem CRECI\ncadastrado** (Ajustes › Conta e marca), a peça não pode ser aprovada."
 },
 {
  "slug": "estudio",
  "titulo": "Estúdio de conteúdo",
  "secao": "Criar",
  "texto": "| Botão | O que faz |\n|---|---|\n| **Novo pedido** | Você escreve o que quer, escolhe o imóvel (ou nenhum, para uma peça institucional), o objetivo e os formatos. Sai uma peça por formato |\n| **Falar o pedido** | O mesmo, ditando. A transcrição é do próprio navegador (o Chrome e o Edge usam o serviço de voz deles), não da IA da plataforma |\n| **Pacote de lançamento** | Post, carrossel e story de um imóvel, de uma vez |\n\n**Formatos:**\n\n| Formato | Tamanho |\n|---|---|\n| Post quadrado | 1080 x 1080 |\n| Post retrato | 1080 x 1350 |\n| Carrossel | Até 5 slides de 1080 x 1350 |\n| Story | 1080 x 1920 |\n\n**Objetivos:** novo imóvel, baixou o preço, vendido, visita aberta e destaque. Os quatro primeiros\npõem um selo na arte. \"Vendido\" não mostra o preço.\n\n**Os textos:**\n- Cada peça recebe título, chamada, até 4 destaques, legenda e hashtags. Com a IA liberada pelo\n  administrador, ela escreve a partir do seu pedido e dos dados públicos do imóvel.\n- Sem a IA, o app monta os textos por modelo, e o Estúdio continua funcionando.\n- A IA nunca recebe o proprietário, a comissão, o endereço além do bairro nem dado de cliente. A\n  resposta dela é conferida e cortada nos limites antes de ser usada.\n\n**A arte, pelo gerador do app:** a arte é montada no seu navegador, com:\n- a primeira foto pública do imóvel;\n- o título, o preço, o bairro e os destaques;\n- o selo do objetivo;\n- o logo, o nome e o CRECI.\n\nNo carrossel, os slides são:\n1. capa;\n2. até três fotos com um destaque cada;\n3. slide final com a chamada e o contato.\n\nA plataforma não gera imagem por IA: a arte segue um modelo fixo e usa só as fotos reais do\nimóvel. Se alguma foto não carregar, o app avisa e a arte pode ser refeita. Se a arte de uma\npeça não sair, a peça fica como rascunho para \"Refazer arte\"."
 },
 {
  "slug": "estudio",
  "titulo": "Estúdio de conteúdo",
  "secao": "Pelo Canva IA",
  "texto": "Prefere o Canva? Em cada peça, o botão **Canva IA**:\n\n1. copia uma instrução pronta. Ela traz o formato e o tamanho, as cores e o estilo da marca, o\n   selo, o título, os destaques, o preço, o local, a chamada e o rodapé com nome e CRECI, além das\n   regras: não alterar as fotos, não pôr endereço completo nem promessa de valorização;\n2. mostra os links das fotos públicas do imóvel e do logo, para você baixar e anexar no Canva;\n3. abre o Canva IA (\"O que vamos criar hoje?\") numa aba.\n\nCole a instrução, anexe as fotos, gere e baixe a arte em JPG ou PNG. Depois use **Enviar arte\npronta** na peça. A arte enviada substitui a anterior. Isso funciona com o plano de Canva que\nvocê tiver; o app não se conecta ao Canva (D-74)."
 },
 {
  "slug": "estudio",
  "titulo": "Estúdio de conteúdo",
  "secao": "Revisar, aprovar e baixar",
  "texto": "Cada peça mostra a prévia, o formato, o objetivo, o imóvel, quem fez a arte (gerador do app,\nCanva IA ou arte enviada) e a situação: rascunho, aprovada, rejeitada.\n\n| Botão | O que faz |\n|---|---|\n| **Ver arte** | Abre a imagem para conferir e baixar (no carrossel, um botão por slide) |\n| **Legenda** | Copia a legenda com as hashtags |\n| **Textos** | Edita título, chamada, destaques, legenda e hashtags |\n| **Refazer arte** | Monta de novo com os textos e a marca atuais |\n| **Aprovar** | Confere antes as pendências e diz o que falta |\n| **Rejeitar** | Devolve a peça aprovada |\n\n**O que a aprovação confere:**\n- o CRECI cadastrado (e o põe na legenda, se faltar);\n- a autorização de venda vigente do imóvel (exceto em \"Vendido\");\n- a arte pronta (no carrossel, pelo menos 2 imagens);\n- a legenda com até 2.200 caracteres;\n- no máximo 30 hashtags.\n\nMudar os textos ou a arte de uma peça aprovada a devolve para rascunho: o que muda precisa de\nnova aprovação. \"Enviar arte pronta\" pede confirmação antes de trocar a arte. A biblioteca mostra\nas 200 peças mais recentes."
 },
 {
  "slug": "estudio",
  "titulo": "Estúdio de conteúdo",
  "secao": "Publicar",
  "texto": "| Modo | Como funciona |\n|---|---|\n| **Publicar agora** | Peça aprovada vai na hora para o Instagram conectado. O app confere a peça de novo (CRECI, autorização vigente, arte, limites) antes de publicar |\n| **Agendar** | Escolha dia e hora, de 5 minutos a 90 dias à frente. Na hora, o app confere e publica. **Cancelar agendamento** devolve a peça para aprovada (ou para rascunho, se ela foi agendada pela aprovação por janela) |\n| **Baixar e publicar por fora** | Baixe a arte em **Ver arte**, copie a **Legenda** e publique pelo Instagram ou pelo Meta Business Suite (que agendam por conta própria). Depois use **Publiquei por fora**, com o link do post se quiser |\n\n**Como sai no Instagram:**\n- **Carrossel:** um item por slide.\n- **Story:** sai sem legenda (o Instagram não usa). Por isso o CRECI precisa estar na arte, e o app\n  só publica e agenda story com arte do **gerador do app**, que traz o CRECI no rodapé. Story com\n  arte do Canva ou enviada: confira a arte, publique pelo Instagram e use **Publiquei por fora**.\n- **Legenda:** leva as hashtags e o CRECI.\n\nPublicada pela API, a peça mostra **Ver no Instagram**. A API do Instagram **não apaga**\npublicações: para tirar um post, apague pelo próprio Instagram.\n\n**Aprovação por janela:** com \"Publica sozinho se eu não responder na janela\", escolhido em Ajustes\n› Conta e marca, um rascunho também pode ser agendado. Na hora, ele é aprovado e publicado se\npassar nas checagens e se a conta ainda estiver nesse modo. Se não passar, fica com erro e sem\naprovação. Para impedir, cancele o agendamento.\n\n**Enquanto publica,** a peça fica **publicando…** e não pode ser editada, agendada nem cancelada.\nAssim, dois cliques (ou o agendamento e um \"Publicar agora\") não publicam duas vezes.\n\n**Quando não sai:** a peça fica **com erro** e mostra o motivo, por exemplo \"o Instagram não está\nconectado\", \"reconecte o Instagram\" ou o que o Instagram respondeu. Resolva e use **Publicar\nagora** ou **Agendar** de novo. Se você editar os textos de uma peça com erro, ela volta a\nrascunho e precisa de nova aprovação.\n\n**Agendamento atrasado:** se a plataforma ficar fora do ar e só voltar mais de 6 horas depois da\nhora marcada, a peça não é publicada atrasada: fica com erro, para você decidir."
 },
 {
  "slug": "funil",
  "titulo": "Funil, temperatura e fila do dia",
  "secao": "Funil",
  "texto": "**Funil** mostra os negócios em quadro, uma coluna por etapa, com o nome do cliente, o título, o\nvalor, a temperatura e o aviso de **abordagem atrasada**.\n\n- Arraste o cartão para mudar de etapa. Ao soltar em **Perdido**, o app pergunta o motivo; sem\n  motivo, o cartão volta.\n- Toque no cartão para abrir a ficha do cliente.\n- Filtros: funil (compra ou venda e captação), temperatura e \"sem contato há N dias\".\n- Ganhos e perdidos ficam no quadro por 30 dias; os em andamento ficam sempre."
 },
 {
  "slug": "funil",
  "titulo": "Funil, temperatura e fila do dia",
  "secao": "Temperatura do contato",
  "texto": "Cada contato é **frio**, **morno** ou **quente**, sempre com o motivo em uma frase. O app\nrecalcula quando acontece algo com o contato (cadastro, nota, visita marcada, retorno de visita,\nmudança de etapa, atividade concluída, abordagem feita) e, uma vez por dia, esfria quem passou 7\ndias sem contato:\n\n| Temperatura | Quando |\n|---|---|\n| Quente | Negócio em proposta ou documentação (inclui \"Proposta recebida\" na venda); visita marcada nos próximos 14 dias; retorno de visita com nota 4 ou 5 nos últimos 14 dias |\n| Morno | Teve contato nos últimos 7 dias, sem visita marcada; ou retorno de visita com nota 1 ou 2 |\n| Frio | Mais de 7 dias sem contato, ou nenhum contato registrado |\n\nO corretor pode trocar a temperatura na edição do contato, com o motivo (confirmar a mesma\ntemperatura com um motivo também conta como escolha dele). **A escolha vale até surgir um sinal\nforte depois dela**: visita marcada, retorno de visita ou negócio que entra em proposta. O que já\nexistia quando ele escolheu não desfaz a escolha (remarcar uma visita antiga também não), e um\nsinal fraco, como uma nota, também não. A\nficha guarda o histórico das últimas mudanças."
 },
 {
  "slug": "funil",
  "titulo": "Funil, temperatura e fila do dia",
  "secao": "Próxima abordagem",
  "texto": "Para cada contato com negócio em andamento, a etapa e a temperatura apontam uma abordagem do\n**playbook**: o que fazer, por onde (WhatsApp, ligação, e-mail, visita) e em quanto tempo. O prazo\nconta do mais recente entre a entrada na etapa, o último contato e o último \"pular\".\n\nNa ficha do cliente:\n\n- **Fiz agora** registra a abordagem na linha do tempo e conta como contato.\n- **Pular** recomeça o prazo a partir de agora.\n\n### Ajustes › Funil e abordagens\n\nAbaixo das etapas, a tabela de abordagens por etapa e temperatura. O app semeia uma abordagem\npara cada etapa da semente e cada temperatura; toque numa linha para mudar o texto, o canal e o\nprazo. Etapas criadas pelo corretor começam sem abordagem: use **Nova abordagem**."
 },
 {
  "slug": "funil",
  "titulo": "Funil, temperatura e fila do dia",
  "secao": "Início: para hoje",
  "texto": "O Início lista o que precisa do corretor agora, nesta ordem, com cada cliente uma vez só:\n\n1. **Quentes sem resposta**: quente e mais de um dia sem contato.\n2. **Abordagens atrasadas**: o prazo do playbook passou (com o botão **Fiz**).\n3. **Visitas de hoje e amanhã**.\n4. **Próximos passos vencidos**.\n\nMais atalhos para Clientes, Funil, Imóveis e Agenda. As passagens do atendimento automático e os\nfrios que reagiram a um envio entram com o WhatsApp e com os envios rastreados."
 },
 {
  "slug": "imoveis",
  "titulo": "Imóveis e empreendimentos",
  "secao": "Imóveis e empreendimentos",
  "texto": "Tudo é da conta do corretor: ninguém de outra conta vê, abre ou altera. Endereço de imóvel,\nfoto, autorização ou empreendimento de outra conta responde \"não encontrado\"; um vínculo com algo\nde outra conta (proprietário, empreendimento, imóvel, documento) é recusado como \"não encontrado\"."
 },
 {
  "slug": "imoveis",
  "titulo": "Imóveis e empreendimentos",
  "secao": "Minha carteira",
  "texto": "**Imóveis › Minha carteira** lista os imóveis com a foto de capa, o local, o preço, a situação e a\nnota de qualidade. Busca por código, título, bairro ou cidade e filtro por situação (ficam no\nendereço da página).\n\n### Cadastro rápido\n\n1. **Novo imóvel**: tipo, cidade e, se quiser, título, bairro, UF e um código seu. Sem código, o\n   app numera `IM-0001`, `IM-0002`… O código não se repete entre os imóveis da conta.\n2. A ficha abre já pedindo as **fotos**: arraste várias de uma vez (JPG, PNG, WEBP, vídeo MP4 ou\n   PDF, até 25 MB cada). A primeira foto é a capa.\n3. Com a leitura de fotos ligada, cada foto é lida pela IA: ela diz o ambiente (fachada, sala,\n   cozinha…), dá uma nota para o anúncio e escreve uma legenda quando a foto não tem uma (a do\n   corretor nunca é trocada). **Ordem sugerida** põe a melhor foto de fachada, sala ou vista como\n   capa e as demais na sequência de uma visita.\n4. **Editar dados**: preço (vazio = sob consulta), condomínio, IPTU, áreas, cômodos, endereço,\n   características, proprietário e empreendimento.\n\n### Fotos e arquivos\n\nCada arquivo tem tipo (foto, vídeo, planta, tour, documento), legenda e a marca \"pode aparecer no\nanúncio\". **Documento nunca aparece no anúncio**, mesmo marcado; o documento de uma autorização\nnão pode virar foto nem ficar público, e o de uma autorização assinada não pode ser apagado. Cada imóvel guarda até 80 arquivos. Dá para subir, descer,\nver, editar e apagar (apagar é de vez, para liberar o espaço). As fotos são mostradas por um link temporário, que vale uma\nhora.\n\n### Qualidade do anúncio (0 a 100)\n\nCalculada a cada leitura, nunca gravada. A ficha mostra o que falta, na ordem do peso:\n\n| Item | Pontos |\n|---|---|\n| 8 ou mais fotos que podem aparecer no anúncio | 25 |\n| Descrição com 400 caracteres ou mais | 15 |\n| Preço informado | 15 |\n| Autorização de venda assinada e vigente | 15 |\n| Área e cômodos (quartos e banheiros; lote, galpão, rural, sala e loja só a área) | 10 |\n| Localização (bairro e cidade) | 10 |\n| CRECI preenchido em Conta e marca | 10 |\n\n### Descrição com IA\n\n**Escrever com IA** sugere título, descrição e destaques a partir dos dados cadastrados e dos\nambientes vistos nas fotos. A sugestão abre para o corretor revisar; só é salva quando ele\nconfirma. A IA não recebe os campos de proprietário, endereço completo e comissão (o título, as\ncaracterísticas e a descrição que o corretor escreveu vão como estão), e é instruída a não\ninventar informação nem citar endereço ou nome. Sem tipo ou sem área, o app não pede a descrição.\n\nOs botões de IA só aparecem quando a IA está liberada para o app. Sem ela, tudo funciona à mão.\nSe a IA falhar ou responder fora do formato, o app avisa e não grava nada.\n\n### Situação e publicação\n\nSituações: rascunho, em captação, ativo, reservado, vendido, suspenso e encerrado.\n\n**Anúncio só com autorização.** Para pôr o imóvel em **ativo** ou **reservado**, ou marcá-lo para\n**a sua página**, é preciso uma autorização de venda **assinada, com o documento anexado e dentro\nda vigência**. O imóvel só aparece fora do app quando as três coisas valem juntas: ativo ou\nreservado, marcado para a página e autorização vigente. Se a autorização vence ou é revogada, o\nimóvel deixa de aparecer, mesmo continuando marcado (a ficha avisa).\n\n**Remover** tira o imóvel da página e da carteira; fotos e autorizações ficam guardadas."
 },
 {
  "slug": "imoveis",
  "titulo": "Imóveis e empreendimentos",
  "secao": "Autorização de venda",
  "texto": "**Nova autorização**: proprietário que assina (um contato com papel proprietário), início, fim,\npreço autorizado, comissão e o que ela permite (exclusiva, placa, portais, parceria). Nasce como\nrascunho. Assinada, o corretor envia o documento em \"Fotos e arquivos\" e usa **Marcar assinada**,\nescolhendo o arquivo: ele vira documento interno. A autorização assinada cujo fim passou aparece\ncomo **vencida**. **Revogar** encerra a autorização. O documento de uma autorização assinada não\npode ser apagado.\n\nO proprietário escolhido ganha o papel \"proprietário\" na ficha dele, se ainda não tinha."
 },
 {
  "slug": "imoveis",
  "titulo": "Imóveis e empreendimentos",
  "secao": "Visitas",
  "texto": "Na ficha do cliente, **Agendar** com o tipo **visita** e o imóvel escolhido cria a visita. Depois,\n**Retorno** registra se o cliente gostou (nota de 1 a 5), o que ele disse e se o retorno pode ser\ncompartilhado com o proprietário (sem o nome do cliente). Registrar o retorno marca a visita como\nfeita e entra na linha do tempo. A ficha do imóvel lista as visitas com os retornos.\n\nNegócios também podem ser ligados a um imóvel; a ficha do imóvel mostra os negócios dele."
 },
 {
  "slug": "imoveis",
  "titulo": "Imóveis e empreendimentos",
  "secao": "Empreendimentos",
  "texto": "**Imóveis › Empreendimentos**: os lançamentos que o corretor vende, com nome (sem repetir),\nconstrutora, tipo (prédio, condomínio de casas, loteamento), fase (lançamento, em obras, pronto),\nlocal, faixa de preço, tipologias e descrição.\n\n- **Materiais**: planta, tabela de preços, memorial, book (PDF ou imagem), cada um marcado se pode\n  ser enviado ao cliente.\n- **Unidades na sua carteira**: os imóveis ligados ao empreendimento (escolhido nos dados do\n  imóvel).\n- Empreendimento com imóveis ligados não pode ser removido: desligue-os antes."
 },
 {
  "slug": "minha-pagina",
  "titulo": "Minha página, ficha pública e link rastreado",
  "secao": "Minha página",
  "texto": "Em **Minha página** o corretor monta a própria página na internet, que abre sem login, no celular\nou no computador:\n\n- **Endereço e aparência:** o nome que aparece, o endereço (`joao-corretor`, por exemplo) e uma\n  das cinco cores. O endereço é único na plataforma inteira. Se outra pessoa já usa o endereço,\n  o app avisa.\n- **Blocos**, na ordem escolhida, cada um podendo aparecer ou ficar oculto:\n\n| Bloco | O que mostra |\n|---|---|\n| Apresentação | Título e texto no topo, com o nome, o CRECI e os botões de WhatsApp e Instagram |\n| Imóveis em destaque | Até 6 imóveis escolhidos |\n| Todos os imóveis | Todos os imóveis publicados |\n| Sobre mim | Um texto mais longo |\n| Bairros que atendo | Uma lista de bairros ou regiões |\n| Formulário de contato | Nome, telefone, e-mail, mensagem e a autorização de contato |\n| WhatsApp e Instagram | Liga ou desliga o botão do WhatsApp e informa o Instagram |\n\n- **Escrever com IA** sugere a apresentação e o \"sobre mim\" a partir do que o corretor contar e\n  das regiões dos imóveis. A IA não inventa prêmios, anos de experiência nem números. O corretor\n  revisa antes de usar. Sem a IA liberada, o botão avisa e os textos são escritos à mão.\n- **Publicar** põe a página no ar. **Atualizar agora** refaz a página com o estado atual dos\n  imóveis e do perfil. **Tirar do ar** faz a página e as fichas pararem de abrir; o formulário e\n  a contagem de cliques param de receber, e os links enviados mostram \"Imóvel indisponível\".\n  Publicar de novo cria endereços de entrada novos, e os links enviados antes voltam a abrir e a\n  contar.\n\nO nome, o CRECI e o telefone de WhatsApp da página vêm do perfil de quem salva ou publica a página\n(Ajustes › Conta e marca). Mudou o CRECI ou o telefone? Use **Atualizar agora**.\n\nO link da página tem a forma `https://<instância>/portal_corretor/p?c=<endereço>`. **Copiar link**\ncopia o endereço completo.\n\nAinda não há prévia do link no WhatsApp (a foto e o título que aparecem ao colar um link). Isso\nfica para uma versão futura (P-37)."
 },
 {
  "slug": "minha-pagina",
  "titulo": "Minha página, ficha pública e link rastreado",
  "secao": "Que imóvel aparece",
  "texto": "Aparece na página o imóvel que cumpre as três condições:\n\n1. está marcado \"Aparece na minha página\", na ficha do imóvel;\n2. está **ativo** ou **reservado**;\n3. tem autorização de venda **assinada, com documento e dentro da vigência**.\n\nA página acompanha as mudanças na hora: editar o anúncio, trocar fotos, mudar a autorização ou\ntirar o imóvel da página atualiza a versão pública. Se essa atualização falhar, a mudança no\nimóvel fica gravada e a página pública segue como estava até o **Atualizar agora**. Quando a\nautorização vence, o imóvel some da página no dia seguinte ao fim, mesmo sem nova publicação.\n\n**O que vai para a internet:** só dados de anúncio. Vão o tipo, o título, o preço, o\ncondomínio, o IPTU, as áreas, os cômodos, as características, a descrição e as fotos marcadas\ncomo públicas. A localização segue a escolha \"endereço público\" do imóvel:\n\n| Escolha | O que aparece |\n|---|---|\n| Região | Só a cidade |\n| Bairro | Bairro e cidade |\n| Completo | Também o endereço |\n\n**Nunca vão:** o proprietário, a comissão, a autorização, os documentos, as fotos privadas e os\nimóveis em rascunho.\n\n**Ficha pública** (`…/p?c=<endereço>&i=<código>`): galeria de fotos em tela cheia, preço,\ndetalhes, descrição, características e um formulário de contato que já cita o imóvel. O botão de\nWhatsApp abre a conversa com o código do imóvel no texto."
 },
 {
  "slug": "minha-pagina",
  "titulo": "Minha página, ficha pública e link rastreado",
  "secao": "Formulário de contato",
  "texto": "Quem preenche o formulário vira cliente em **Clientes**:\n\n- **Contato novo:** criado como comprador, com origem \"página\". O responsável é quem publicou\n  a página pela primeira vez; se essa pessoa não for mais corretor ativo da conta, o primeiro\n  corretor ativo.\n- **Telefone já cadastrado** (ou, sem contato com o telefone, o mesmo e-mail): o pedido entra no\n  contato existente.\n- **Negócio:** um negócio de compra na primeira etapa do funil (\"Novo\"), se o contato ainda não\n  tem um em andamento. Pela ficha de um imóvel, o negócio já fica ligado a ele.\n- **Consentimento:** registrado com a versão do texto (`formulario-v1`), porque a autorização de\n  contato é obrigatória.\n- **Linha do tempo:** registra \"Pediu contato pela sua página\" (ou \"pela ficha do IM-0001\"), com a\n  mensagem. A temperatura é recalculada.\n- **Envio repetido:** a mesma mensagem enviada de novo em até 5 minutos não duplica nada.\n\n**Proteções:**\n- No máximo 3 envios por minuto vindos de um mesmo endereço de internet, contados em memória em\n  cada servidor do app (com mais de um servidor, o limite vale por servidor). O app usa uma\n  versão embaralhada do endereço e não a grava.\n- Um campo escondido barra robôs: quem o preenche recebe \"enviado\" e nada é gravado.\n\nNome, telefone, e-mail e mensagem são marcados para **nunca ficar no registro de chamadas** da\nplataforma. O administrador do app vê que houve um envio, não o conteúdo."
 },
 {
  "slug": "minha-pagina",
  "titulo": "Minha página, ficha pública e link rastreado",
  "secao": "Link rastreado",
  "texto": "Com a página no ar, **Registrar envio** de um imóvel publicado devolve a mensagem pronta com um\nlink curto (`…/portal_corretor/l?c=<código>`). Quando o cliente abre o link:\n\n1. o clique é contado no envio (a ficha do cliente mostra \"N clique(s)\");\n2. o primeiro clique entra na linha do tempo: \"Abriu o link que você mandou\";\n3. o cliente vai para a ficha pública do imóvel.\n\nO mesmo navegador conta uma vez por aba. Sem página no ar, com o imóvel fora da página ou numa\ninstância sem endereço público configurado, a mensagem sai sem link. O link de um imóvel que\ndeixou de ser anunciado mostra \"Imóvel indisponível\" (a abertura ainda é contada)."
 },
 {
  "slug": "minha-pagina",
  "titulo": "Minha página, ficha pública e link rastreado",
  "secao": "Para o administrador da instância",
  "texto": "- **Webhooks:** o app declara dois, ambos com um endereço por conta. Os endereços são gerados\n  pelo app quando o corretor publica a página e revogados quando ele a tira do ar. Ficam em\n  Configurações da app › Webhooks:\n  - `formulario_lead`: o formulário da página e da ficha;\n  - `clique_link`: o clique no link.\n  - Desativar um webhook ali corta, para todas as contas, o formulário ou a contagem de\n    cliques.\n- **Formulário embutido em outro site:** não é preciso nada para a página do próprio app. Se um\n  dia o formulário for posto em outro site, cadastre esse site na variável de origens dos\n  webhooks (Admin › Variáveis).\n- **Eventos:** `lead_recebido` e `link_clicado` são da conta: só os membros da conta os veem. O\n  `lead_recebido` leva nome, telefone, e-mail e mensagem do visitante (é por ele que o contato\n  chega ao app) e fica guardado pelo prazo de retenção de eventos da instância.\n- **Endereço público da instância:** o link rastreado só é gerado quando a instância tem URL\n  pública configurada.\n- **Páginas públicas:** o app declara duas:\n  - `/portal_corretor/p`: a página e a ficha;\n  - `/portal_corretor/l`: o link.\n  - Nenhuma pede para ser embutida em outro site."
 },
 {
  "slug": "selecoes-e-portal",
  "titulo": "Seleções e Portal do Cliente",
  "secao": "Seleções e Portal do Cliente",
  "texto": "O cliente não precisa de login: ele abre tudo por um **link pessoal**, que funciona como chave.\nO corretor pode revogar o link quando quiser. Seleção e portal são pensados para o celular."
 },
 {
  "slug": "selecoes-e-portal",
  "titulo": "Seleções e Portal do Cliente",
  "secao": "Seleção de imóveis",
  "texto": "Na ficha do cliente, em **Seleções e portal**, o botão **Nova seleção** abre a montagem:\n\n1. Dê um título e, se quiser, uma mensagem.\n2. Escolha de 1 a 12 imóveis da carteira. Só aparecem imóveis **ativos ou reservados com\n   autorização de venda vigente**. Não precisam estar marcados para a Minha página.\n3. **Criar e enviar** copia a mensagem com o link, pronta para colar no WhatsApp.\n\nO link tem a forma `https://<instância>/portal_corretor/s?t=<chave>`. Vale pelo prazo de\n\"validade da seleção enviada\" de Ajustes › Conta e marca (14 dias, se você não mudar).\n\nO que o cliente vê em cada imóvel:\n- fotos públicas, preço, bairro e cidade, área, quartos, vagas e descrição;\n- os botões **Gostei**, **Não gostei** e **Quero visitar**.\n\nO que nunca aparece: proprietário, comissão, documentos e endereço além do que o imóvel libera em\n\"endereço público\". A seleção **acompanha o anúncio**: preço, fotos e descrição atualizam sozinhos,\ne o imóvel que deixa de estar anunciado sai da seleção. Isso vale para imóvel vendido, retirado,\nremovido ou com a autorização vencida. Se nenhum imóvel restar, o cliente vê um aviso para falar\ncom o corretor.\n\n**Quando o cliente reage:**\n- a reação aparece na ficha, ao lado do código do imóvel;\n- entra na linha do tempo, por exemplo \"Gostou do IM-0001 (seleção \"Casas\")\". Mudar de ideia\n  vale a última escolha;\n- conta como contato com o cliente, e a temperatura é recalculada;\n- **Quero visitar** cria a tarefa \"Marcar visita: IM-0001 · título\", sem repetir se ela já\n  estiver pendente.\n\n**Copiar** gera de novo a mensagem com o link. **Revogar** faz o link parar de abrir, e a\nseleção sai do portal. A ficha mostra cada seleção como válida (com a data limite), vencida ou\nrevogada.\n\nO envio da seleção entra em **Tudo que você mandou** e na linha do tempo."
 },
 {
  "slug": "selecoes-e-portal",
  "titulo": "Seleções e Portal do Cliente",
  "secao": "Portal do Cliente",
  "texto": "Na mesma área da ficha, **Gerar link do portal** cria o link do cliente\n(`…/portal_corretor/c?t=<chave>`) e copia uma mensagem pronta. Há **um link por cliente**: clicar\nde novo copia o mesmo link. O link não vence. **Revogar** faz ele parar de abrir, e um novo pode\nser gerado depois.\n\nO portal mostra:\n\n| Parte | O que tem |\n|---|---|\n| Topo | O nome do corretor (o da Minha página, se houver), o CRECI e o botão de WhatsApp |\n| Suas visitas | As visitas marcadas, com dia, hora e imóvel. Botões **Adicionar ao calendário** (arquivo que abre no calendário do celular) e **Pedir para remarcar** |\n| Imóveis para você | As seleções válidas, com as reações, que o cliente pode mudar dali mesmo |\n| Fale com o corretor | Uma mensagem livre |\n| Sua jornada | Desde quando é cliente, quantos imóveis recebeu e quantas visitas fez |\n\n**O que o cliente manda pelo portal:**\n- **Mensagem:** entra na linha do tempo (\"Mensagem pelo portal: …\") e cria a tarefa \"Responder\n  a mensagem do portal\".\n- **Pedido para remarcar:** entra na linha do tempo com o horário que ele sugeriu e cria a\n  tarefa \"Remarcar visita: …\". A visita em si só muda quando o corretor muda.\n\nO portal acompanha o app: marcar, mudar ou cancelar uma visita, registrar o retorno, enviar ou\nrevogar uma seleção atualiza o que o cliente vê. \"Imóveis recebidos\" conta tudo o que foi enviado e\nnão revogado, mesmo em seleções já vencidas.\n\n**Cliente removido:** ao remover o contato, o portal e as seleções dele são revogados na hora e\nparam de abrir.\n\n**Privacidade (D-73):** o portal não guarda nem mostra o nome, o telefone ou o e-mail do cliente.\nEle mostra só o que o corretor mandou e as datas das visitas. Quem tiver o link vê o portal, por\nisso o corretor o envia só ao cliente e o revoga se ele for parar em outras mãos."
 },
 {
  "slug": "selecoes-e-portal",
  "titulo": "Seleções e Portal do Cliente",
  "secao": "Proteções",
  "texto": "- **Links:** cada link é uma chave da plataforma (o \"ingresso\" de webhook). A rota pública só\n  abre se a chave for válida, não estiver vencida e não tiver sido revogada.\n- **Limites por endereço de internet e por minuto:** 30 reações por seleção e 5 ações no portal.\n- **Registro de chamadas da plataforma:** o texto que o cliente escreve (mensagem, pedido de\n  remarcar) nunca fica lá. Ele chega ao app pelos eventos da conta, que só os membros da conta\n  leem, e fica guardado pelo prazo de retenção de eventos da instância, como no formulário da\n  página (D-70).\n- **Contas:** a conta vem sempre da chave, nunca do que o navegador manda. Uma reação ou pedido\n  só vale para a seleção, o imóvel ou a visita do próprio cliente.\n- **Links guardados:** o link de cada seleção e do portal fica guardado no app, para o corretor\n  copiar de novo. Quem lê é só o corretor da conta. Para cortar um link, use **Revogar**."
 },
 {
  "slug": "selecoes-e-portal",
  "titulo": "Seleções e Portal do Cliente",
  "secao": "Para o administrador da instância",
  "texto": "- **Webhooks:** o app declara mais dois. Ficam em Configurações da app › Webhooks:\n  - `reacao_selecao`: um endereço por seleção, com validade;\n  - `acao_cliente`: um endereço por cliente.\n- **Eventos:** `reacao_recebida` e `acao_cliente_recebida` são da conta: só os membros da conta\n  os veem.\n- **Páginas públicas:** `/portal_corretor/s` (seleção) e `/portal_corretor/c` (portal)."
 }
];
