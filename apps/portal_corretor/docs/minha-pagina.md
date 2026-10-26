---
titulo: Minha página, ficha pública e link rastreado
descricao: A página pública do corretor por blocos, a ficha de cada imóvel anunciado, o formulário de contato que vira cliente no funil e o link que mostra quando o cliente abriu o imóvel.
---

# Minha página, ficha pública e link rastreado

## Minha página

Em **Minha página** o corretor monta a própria página na internet, que abre sem login, no celular
ou no computador:

- **Endereço e aparência:** o nome que aparece, o endereço (`joao-corretor`, por exemplo) e uma
  das cinco cores. O endereço é único na plataforma inteira. Se outra pessoa já usa o endereço,
  o app avisa.
- **Blocos**, na ordem escolhida, cada um podendo aparecer ou ficar oculto:

| Bloco | O que mostra |
|---|---|
| Apresentação | Título e texto no topo, com o nome, o CRECI e os botões de WhatsApp e Instagram |
| Imóveis em destaque | Até 6 imóveis escolhidos |
| Todos os imóveis | Todos os imóveis publicados |
| Sobre mim | Um texto mais longo |
| Bairros que atendo | Uma lista de bairros ou regiões |
| Formulário de contato | Nome, telefone, e-mail, mensagem e a autorização de contato |
| WhatsApp e Instagram | Liga ou desliga o botão do WhatsApp e informa o Instagram |

- **Escrever com IA** sugere a apresentação e o "sobre mim" a partir do que o corretor contar e
  das regiões dos imóveis. A IA não inventa prêmios, anos de experiência nem números. O corretor
  revisa antes de usar. Sem a IA liberada, o botão avisa e os textos são escritos à mão.
- **Publicar** põe a página no ar. **Atualizar agora** refaz a página com o estado atual dos
  imóveis e do perfil. **Tirar do ar** faz a página e as fichas pararem de abrir; o formulário e
  a contagem de cliques param de receber, e os links enviados mostram "Imóvel indisponível".
  Publicar de novo cria endereços de entrada novos, e os links enviados antes voltam a abrir e a
  contar.

O nome, o CRECI e o telefone de WhatsApp da página vêm do perfil de quem salva ou publica a página
(Ajustes › Conta). Mudou o CRECI ou o telefone? Use **Atualizar agora**.

O link da página tem a forma `https://<instância>/portal_corretor/p?c=<endereço>`. **Copiar link**
copia o endereço completo.

Ainda não há prévia do link no WhatsApp (a foto e o título que aparecem ao colar um link). Isso
fica para uma versão futura (P-37).

## Que imóvel aparece

Aparece na página o imóvel que cumpre as três condições:

1. está marcado "Aparece na minha página", na ficha do imóvel;
2. está **ativo** ou **reservado**;
3. tem autorização de venda **assinada, com documento e dentro da vigência**.

A página acompanha as mudanças na hora: editar o anúncio, trocar fotos, mudar a autorização ou
tirar o imóvel da página atualiza a versão pública. Se essa atualização falhar, a mudança no
imóvel fica gravada e a página pública segue como estava até o **Atualizar agora**. Quando a
autorização vence, o imóvel some da página no dia seguinte ao fim, mesmo sem nova publicação.

**O que vai para a internet:** só dados de anúncio. Vão o tipo, o título, o preço, o
condomínio, o IPTU, as áreas, os cômodos, as características, a descrição e as fotos marcadas
como públicas. A localização segue a escolha "endereço público" do imóvel:

| Escolha | O que aparece |
|---|---|
| Região | Só a cidade |
| Bairro | Bairro e cidade |
| Completo | Também o endereço |

**Nunca vão:** o proprietário, a comissão, a autorização, os documentos, as fotos privadas e os
imóveis em rascunho.

**Ficha pública** (`…/p?c=<endereço>&i=<código>`): galeria de fotos em tela cheia, preço,
detalhes, descrição, características e um formulário de contato que já cita o imóvel. O botão de
WhatsApp abre a conversa com o código do imóvel no texto.

## Formulário de contato

Quem preenche o formulário vira cliente em **Clientes**:

- **Contato novo:** criado como comprador, com origem "página". O responsável é quem publicou
  a página pela primeira vez; se essa pessoa não for mais corretor ativo da conta, o primeiro
  corretor ativo.
- **Telefone já cadastrado** (ou, sem contato com o telefone, o mesmo e-mail): o pedido entra no
  contato existente.
- **Negócio:** um negócio de compra na primeira etapa do funil ("Novo"), se o contato ainda não
  tem um em andamento. Pela ficha de um imóvel, o negócio já fica ligado a ele.
- **Consentimento:** registrado com a versão do texto (`formulario-v1`), porque a autorização de
  contato é obrigatória.
- **Linha do tempo:** registra "Pediu contato pela sua página" (ou "pela ficha do IM-0001"), com a
  mensagem. A temperatura é recalculada.
- **Envio repetido:** a mesma mensagem enviada de novo em até 5 minutos não duplica nada.

**Proteções:**
- No máximo 3 envios por minuto vindos de um mesmo endereço de internet, contados em memória em
  cada servidor do app (com mais de um servidor, o limite vale por servidor). O app usa uma
  versão embaralhada do endereço e não a grava.
- Um campo escondido barra robôs: quem o preenche recebe "enviado" e nada é gravado.

Nome, telefone, e-mail e mensagem são marcados para **nunca ficar no registro de chamadas** da
plataforma. O administrador do app vê que houve um envio, não o conteúdo.

## Link rastreado

Com a página no ar, **Registrar envio** de um imóvel publicado devolve a mensagem pronta com um
link curto (`…/portal_corretor/l?c=<código>`). Quando o cliente abre o link:

1. o clique é contado no envio (a ficha do cliente mostra "N clique(s)");
2. o primeiro clique entra na linha do tempo: "Abriu o link que você mandou";
3. o cliente vai para a ficha pública do imóvel.

O mesmo navegador conta uma vez por aba. Sem página no ar, com o imóvel fora da página ou numa
instância sem endereço público configurado, a mensagem sai sem link. O link de um imóvel que
deixou de ser anunciado mostra "Imóvel indisponível" (a abertura ainda é contada).

## Para o administrador da instância

- **Webhooks:** o app declara dois, ambos com um endereço por conta. Os endereços são gerados
  pelo app quando o corretor publica a página e revogados quando ele a tira do ar. Ficam em
  Configurações da app › Webhooks:
  - `formulario_lead`: o formulário da página e da ficha;
  - `clique_link`: o clique no link.
  - Desativar um webhook ali corta, para todas as contas, o formulário ou a contagem de
    cliques.
- **Formulário embutido em outro site:** não é preciso nada para a página do próprio app. Se um
  dia o formulário for posto em outro site, cadastre esse site na variável de origens dos
  webhooks (Admin › Variáveis).
- **Eventos:** `lead_recebido` e `link_clicado` são da conta: só os membros da conta os veem. O
  `lead_recebido` leva nome, telefone, e-mail e mensagem do visitante (é por ele que o contato
  chega ao app) e fica guardado pelo prazo de retenção de eventos da instância.
- **Endereço público da instância:** o link rastreado só é gerado quando a instância tem URL
  pública configurada.
- **Páginas públicas:** o app declara duas:
  - `/portal_corretor/p`: a página e a ficha;
  - `/portal_corretor/l`: o link.
  - Nenhuma pede para ser embutida em outro site.
