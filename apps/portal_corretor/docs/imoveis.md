---
titulo: Imóveis e empreendimentos
descricao: Carteira de imóveis com fotos, qualidade do anúncio, autorização de venda, descrição com IA, visitas e empreendimentos.
---

# Imóveis e empreendimentos

Tudo é da conta do corretor: ninguém de outra conta vê, abre ou altera. Endereço de imóvel,
foto, autorização ou empreendimento de outra conta responde "não encontrado"; um vínculo com algo
de outra conta (proprietário, empreendimento, imóvel, documento) é recusado como "não encontrado".

## Carteira

No menu, **Imóveis** abre no desenho novo, em três colunas (no celular, uma por vez, em abas:
**Carteira · Ficha · Contexto**). Sem imóvel escolhido, o celular abre na lista.

**À esquerda**, o título **Imóveis** com **Novo** e duas abas, cada uma com o total: **Carteira**
(a primeira) e **Empreendimentos**. Na Carteira:

- **Busca** por código, título, bairro ou cidade.
- **Chips** de situação, um de cada vez: **Todos**, **Ativos**, **Rascunhos** e **Vendidos** (as
  demais situações aparecem em Todos).
- A **lista**, do mais recente para o mais antigo, com a miniatura da capa, o código e o título, o
  preço e o local, a situação e a nota de qualidade. Sem nenhum imóvel, a lista convida a cadastrar
  o primeiro.

A busca, o chip, a aba e o imóvel escolhido ficam no endereço da página (`/imoveis?item=<número>`),
então o link que você guardar volta no mesmo lugar. O endereço antigo `/empreendimentos` abre direto
a aba Empreendimentos, e `/imoveis/<número>` abre a mesma tela com o imóvel escolhido.

**No centro**, a ficha do imóvel escolhido (abaixo). **À direita**, o contexto dele:

- **Qualidade do anúncio**: a nota de 0 a 100 (verde a partir de 80, âmbar de 60 a 79, vermelho
  abaixo de 60; no código, as cores `sucesso`, `alerta` e `erro` do selo), com as bolinhas de 0 a 10 no lugar da barra, que o catálogo de telas ainda não
  tem. Embaixo, **o que falta**: cada pendência leva ao lugar que a resolve — fotos rola até o
  cartão de fotos; descrição abre a descrição; preço, área, cômodos e localização abrem os dados;
  autorização abre a nova autorização (ou "marcar assinada", se já há uma em andamento). Sem o seu
  CRECI nesta conta e sem o CRECI jurídico dela, aparece também o aviso discreto *"Adicione seu
  CRECI ao perfil para que ele apareça nos anúncios"*, com o atalho **Ajustes › Conta**; o CRECI não
  entra na nota.
- **Últimos 30 dias**: visitas marcadas, a quantos clientes o imóvel foi enviado, os cliques nesses
  envios e os negócios ligados a ele (este último, de todo o período).
- **Clientes que combinam**: até 10 compradores da conta cujo **perfil de busca** bate com o imóvel,
  com o que bateu (tipo, região, preço, quartos, vagas, área) e o botão **Enviar**, que abre a
  ficha do cliente para você mandar a seleção. Cada critério do perfil precisa bater; o que o
  perfil não diz não conta, e perfil vazio não combina com nada. O perfil de busca vem da
  importação de contatos; ainda não há onde editá-lo na tela. Contatos anonimizados não entram. Em
  conta muito grande a busca olha só os primeiros 10 000 contatos com perfil (em ordem de cadastro) e
  para ao achar 10; os números dos últimos 30 dias contam até 10 000 envios do imóvel no período.

### Cadastro rápido

1. **Novo imóvel**: tipo, cidade e, se quiser, título, bairro, UF e um código seu. Sem código, o
   app numera `IM-0001`, `IM-0002`… O código não se repete entre os imóveis da conta.
2. A ficha abre já pedindo as **fotos** (o cartão de fotos fica aberto enquanto o imóvel não tem foto): arraste várias de uma vez (JPG, PNG, WEBP, vídeo MP4 ou
   PDF, até 25 MB cada). A primeira foto é a capa.
3. Com a leitura de fotos ligada, cada foto é lida pela IA: ela diz o ambiente (fachada, sala,
   cozinha…), dá uma nota para o anúncio e escreve uma legenda quando a foto não tem uma (a do
   corretor nunca é trocada). **Ordem sugerida** põe a melhor foto de fachada, sala ou vista como
   capa e as demais na sequência de uma visita.
4. **Editar dados** (no botão de lápis do cartão do imóvel ou em **Mais**): preço (vazio = sob consulta), condomínio, IPTU, áreas, cômodos, endereço,
   características, proprietário e empreendimento.

### A ficha do imóvel

- No alto, o código e o título, **Editar** (os dados) e **Criar conteúdo** (abre o Estúdio com um
  post novo). No **Mais**: situação e remover.
- A **galeria**: a capa grande e até 8 miniaturas das outras fotos.
- **Dados**, em grade de pares rótulo/valor: situação, qualidade, tipo, preço, condomínio, local, cômodos,
  proprietário, empreendimento e características.
- **Quem vê este imóvel**: se ele está na sua página pública, e o botão **Publicar na página** (ou
  **Tirar da página**, se já está marcado).
- Os cartões de fotos, descrição, autorização, visitas, envios e negócios mostram um resumo; a
  lista completa abre pela seta do cartão. Sem foto, os arquivos ficam à mostra.
- O formulário de dados pede só o que o corretor usa agora; campos das fases seguintes
  (compartilhamento na rede, origem do estoque, posição no mapa) não aparecem.

### Fotos e arquivos

Cada arquivo tem tipo (foto, vídeo, planta, tour, documento), legenda e a marca "pode aparecer no
anúncio". **Documento nunca aparece no anúncio**, mesmo marcado; o documento de uma autorização
não pode virar foto nem ficar público, e o de uma autorização assinada não pode ser apagado. Cada imóvel guarda até 80 arquivos. Dá para subir, descer,
ver, editar e apagar (apagar é de vez, para liberar o espaço). As fotos são mostradas por um link temporário, que vale uma
hora.

### Qualidade do anúncio (0 a 100)

Calculada a cada leitura, nunca gravada. O contexto da ficha mostra o que falta, na ordem do peso:

| Item | Pontos |
|---|---|
| 8 ou mais fotos que podem aparecer no anúncio | 30 |
| Descrição com 400 caracteres ou mais | 20 |
| Preço informado | 15 |
| Autorização de venda assinada e vigente | 15 |
| Área e cômodos (quartos e banheiros; lote, galpão, rural, sala e loja só a área) | 10 |
| Localização (bairro e cidade) | 10 |

O CRECI é opcional e não pesa na nota: um imóvel completo chega a 100 com ou sem CRECI.

### Descrição com IA

**Melhorar com IA** sugere título, descrição e destaques a partir dos dados cadastrados e dos
ambientes vistos nas fotos. A sugestão abre para o corretor revisar; só é salva quando ele
confirma. A IA não recebe os campos de proprietário, endereço completo e comissão (o título, as
características e a descrição que o corretor escreveu vão como estão), e é instruída a não
inventar informação nem citar endereço ou nome. Sem tipo ou sem área, o app não pede a descrição.

Os botões de IA só aparecem quando a IA está liberada para o app. Sem ela, tudo funciona à mão.
Se a IA falhar ou responder fora do formato, o app avisa e não grava nada.

### Situação e publicação

Situações: rascunho, em captação, ativo, reservado, vendido, suspenso e encerrado.

**Anúncio só com autorização.** Para pôr o imóvel em **ativo** ou **reservado**, ou marcá-lo para
**a sua página**, é preciso uma autorização de venda **assinada, com o documento anexado e dentro
da vigência**. O imóvel só aparece fora do app quando as três coisas valem juntas: ativo ou
reservado, marcado para a página e autorização vigente. Se a autorização vence ou é revogada, o
imóvel deixa de aparecer, mesmo continuando marcado (a ficha avisa).

**Remover** tira o imóvel da página e da carteira; fotos e autorizações ficam guardadas.

## Autorização de venda

**Nova autorização**: proprietário que assina (um contato com papel proprietário), início, fim,
preço autorizado, comissão e o que ela permite (exclusiva, placa, portais, parceria). Nasce como
rascunho. Assinada, o corretor envia o documento em "Fotos e arquivos" e usa **Marcar assinada**,
escolhendo o arquivo: ele vira documento interno. A autorização assinada cujo fim passou aparece
como **vencida**. **Revogar** encerra a autorização. O documento de uma autorização assinada não
pode ser apagado.

O proprietário escolhido ganha o papel "proprietário" na ficha dele, se ainda não tinha.

## Visitas

Na ficha do cliente, **Agendar** com o tipo **visita** e o imóvel escolhido cria a visita. Depois,
**Retorno** registra se o cliente gostou (nota de 1 a 5), o que ele disse e se o retorno pode ser
compartilhado com o proprietário (sem o nome do cliente). Registrar o retorno marca a visita como
feita e entra na linha do tempo. A ficha do imóvel lista as visitas com os retornos.

Negócios também podem ser ligados a um imóvel; a ficha do imóvel mostra os negócios dele.

## Empreendimentos

Ficam na aba **Empreendimentos** de **Imóveis**, na mesma moldura: a lista à esquerda (busca e
**Novo**), a ficha no centro e, à direita, os atalhos para vender (**Criar conteúdo**). O endereço
`/empreendimentos` abre a aba, e `/empreendimentos/<número>` abre a mesma tela com ele escolhido. São os lançamentos que o corretor vende, com nome (sem repetir),
construtora, tipo (prédio, condomínio de casas, loteamento), fase (lançamento, em obras, pronto),
local, faixa de preço, tipologias e descrição.

- **Materiais**: planta, tabela de preços, memorial, book (PDF ou imagem), cada um marcado se pode
  ser enviado ao cliente.
- **Unidades na sua carteira**: os imóveis ligados ao empreendimento (escolhido nos dados do
  imóvel).
- Empreendimento com imóveis ligados não pode ser removido: desligue-os antes.
