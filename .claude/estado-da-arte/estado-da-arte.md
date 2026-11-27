# Estado da Arte — Portal do Corretor (`portal_corretor`)

> Este documento descreve a versão final e ideal do app. É lido só pelas sessões e agentes de IA
> que trabalham no repositório. Mora em `.claude/estado-da-arte/`, que não entra no pacote do app.
> **Só muda por PR que o dono mergeia.** Nenhuma sessão edita este arquivo direto.
>
> **Versão 1, rascunhada pela IA na etapa PREPARAR (25/11/2026)**, com o dono presente na conversa,
> a partir do `CLAUDE.md`, do `KIT.md`, do `manifesto.json` (0.1.63), dos guias em
> `apps/portal_corretor/docs/`, da spec (`specs/portal_corretor.md`, seções 2.6, 11, 15.1 e 15.2),
> do plano (`specs/plano_de_implementacao.md`, inclusive "Pendências para as próximas sessões"),
> das 11 issues abertas e dos PRs #225 e #226. Nada aqui é regra de negócio nova: o produto
> continua definido pela spec, e este documento só diz **qual é o destino** e **quanto falta**.
> Onde a frase é leitura da IA, e não algo que o dono já disse ou decidiu, ela leva **(?)** e é
> repetida em § Perguntas ao dono. Situação de cada item medida contra a `main` em `5ade5d5`
> (25/11/2026).
>
> **Decisões do dono na PREPARAR (25/11/2026):** o destino são as **fases 1 e 2** da spec (o MVP
> interno completo e o MVP validado com corretores reais); as fases 3 a 7 ficam fora, de propósito,
> por ora. Ver § Respostas do dono.

## Para quem é e o que resolve

Para o corretor de imóveis autônomo, que hoje trabalha entre WhatsApp, planilha, Instagram e
portais: o app é o escritório digital dele, no computador e no celular, onde cada tela responde "o
que eu faço agora?". Junta os clientes e o funil com IA, a carteira de imóveis, o conteúdo para o
Instagram, a página própria, o Portal do Cliente, o Negociador e o Assistente, numa conta só dele —
nenhum corretor vê nada de outro. O cliente do corretor acompanha o atendimento pelo celular, por
link, sem senha. (Resumo da spec 2.1 a 2.4 e do `CLAUDE.md` § O que é.)

## Princípios

- **O app já está bem evoluído: evolui, não substitui.** Todo item e toda referência trazida para
  cá se somam ao que o app já faz (0.1.63: Padrão B, Negociador, Estúdio, Portal do Cliente). Nenhuma
  sessão troca, remove ou reescreve comportamento, tela, cálculo ou dado que já existe por causa de
  uma referência ou de um item deste documento. Se uma referência contradiz o que o app faz, vira
  pergunta ao dono, nunca troca.
- **Isolamento é inegociável.** Nenhum corretor vê nada de outro; recurso de outra conta responde
  "não encontrado"; o cliente só vê o que recebeu; o teste de isolamento roda em todo PR
  (`CLAUDE.md` § Regras que não se quebram; spec 4.5).
- **O app nunca decide pelo corretor** o que é dele decidir: preço, desconto, proposta, reserva,
  comissão; o aceite final da negociação é sempre do corretor (spec 2.6, princípio 3; 10.9).
- **Determinismo.** Mesmos dados dão os mesmos números, a mesma fila e a mesma temperatura; KPI só
  com fonte, período e fórmula (spec 11.2), e ausência é frase, não zero (princípio 5).
- **Entrada separada de resultado.** O que o corretor digita não se confunde com o que o app ou a
  IA calculou ou sugeriu: a sugestão da IA é sempre proposta, e a ação acontece só depois da
  confirmação dele (spec 10; `CLAUDE.md`: "o app valida e executa as ações"). (?)
- **Precisão.** Dinheiro em reais com duas casas, no formato brasileiro na entrada e na tela, e
  gravado sem perda (#185, D-131); área e percentuais sem arredondar no cálculo. (?)
- **O código e o `schema.json` mandam sobre os documentos consultivos.** As referências de mercado
  (`specs/referencias*.md`), os mockups (`specs/telas/`) e este documento explicam o destino; se
  divergirem do código, a divergência vira issue, nunca ajuste automático. A referência visual
  oficial é `specs/layout/` (`CLAUDE.md`).
- **A tela só oferece o que o servidor aceita**, e o servidor é a fronteira real: papel, conta e
  validação são conferidos na rota, não só escondidos na tela. Nenhuma configuração sem uso na
  versão corrente aparece na tela (spec 2.6, princípio 14; 15.9).
- **Menos é mais.** Uma tela, uma pergunta, uma ação: um botão principal por item, o resto no menu
  "mais"; IA como botão na tela certa (spec 2.6, princípios 13 e 14).
- **Contratos da plataforma.** Só o que o `@urbiverso/sdk` instalado expõe: banco só por
  `req.dados` e `schema.json`, IA só por `req.ia.consultar` com JSON Schema, hora marcada por
  `req.eventos.agendar`, UI só com primitivos `urbi-*` e tokens na moldura do Padrão B, permissão
  só por `nivelApp`/`rolesApp` (`KIT.md`, `CLAUDE.md`). O que o SDK não permite vira pedido ao
  shell, nunca contorno.
- **A documentação servida descreve a tela.** `apps/portal_corretor/docs/` muda no mesmo PR que o
  comportamento, com `pnpm ajuda` rodado (é a base do Assistente).

## Itens

Um item por coisa que o app deve ser ou fazer na versão final (fases 1 e 2 da spec). A ordem segue
a spec 15.1 e 15.2, não a prioridade.

### 1. Conta, papéis e isolamento

- **O que é:** cada corretor numa conta própria; papéis `corretor`, `negociador`, `operacao`; o
  cliente entra por link com token; recurso de outra conta responde "não encontrado".
- **Por que importa:** regra inegociável do dono (`CLAUDE.md`); critério 3 da spec 15.1.
- **Pronto quando:** a matriz da seção 14 da spec passa papel por papel nos testes e na instância,
  e o teste de isolamento (4.5) passa em todo PR, inclusive pelo Assistente e pelo Negociador.
- **Situação:** **parcial.** Testes de isolamento e de papéis na `main` (`testes/`), e a rodada de
  QA de 12/11 na homologação deu o isolamento entre contas OK (plano, "QA com escrita"). Falta a
  matriz papel por papel na instância com o perfil `corretor` real (#34, itens 1 e 3) e a
  confirmação do menu do usuário externo (plano, "Pendências da etapa 4", item 1).

### 2. Hoje: o que fazer agora

- **O que é:** a tela inicial com a fila do dia (uma ação principal por cartão), Precisa de você,
  Primeiros passos, a agenda e a Dica do Assistente.
- **Por que importa:** princípio 1 da spec ("cada tela responde o que eu faço agora?"); D-80 e
  #52, #91.
- **Pronto quando:** a fila do dia sai ordenada e sem item com dois botões principais, no
  computador (P01) e no celular (M1), conferida contra `specs/layout/`.
- **Situação:** **feito** no código (`docs/README.md`, tela Hoje; #52 e #91 fechadas; grupo 2 da
  fase 1.7, 0.1.48). A conferência visual na instância segue o item 14.

### 3. Clientes, funil e CRM

- **O que é:** lista, ficha (resumo, linha do tempo, enviados, negócios), Funil como visão de
  Clientes, etapas configuráveis, tarefas, agenda e visitas, importação (planilha e vCard) e
  exportação.
- **Por que importa:** bloco "CRM e funil" da spec 15.1; importação com modelos de outros CRMs
  entra na fase 2 (15.2).
- **Pronto quando:** cadastrar, mover, importar e exportar funcionam de ponta a ponta no
  computador e no celular, e a importação oferece os modelos Kenlo, Jetimob e Imobzi (#65).
- **Situação:** **parcial.** O CRM está na `main` (`docs/clientes-e-agenda.md`, `docs/funil.md`;
  correções do QA de 12/11 no #235). Faltam os modelos de #65 (esperam um arquivo de exportação de
  exemplo de cada sistema, que é do dono) e o "desfazer em 8 s" da spec 11.0.6, que depende do
  pedido 24 ao shell (toast com ação).

### 4. Inteligência do funil

- **O que é:** temperatura com motivo, próxima abordagem pelo playbook, Resumir com IA, Mensagem
  sugerida com "Fazer agora" e Virar tarefa.
- **Por que importa:** spec 10.4 e princípio 13 (IA no lugar onde se trabalha); #54.
- **Pronto quando:** cada ação de IA degrada com mensagem clara quando o slot não está disponível,
  e a rotina de temperatura dispara e é conferida na instância (critério 4 da 15.1).
- **Situação:** **parcial.** Código na `main` (#54 fechada; rotina `reclassificar_contatos` no
  manifesto). Falta a conferência da automação na instância (critério 4), que entra pelo roteiro
  R.8 (item 15).

### 5. Imóveis e empreendimentos

- **O que é:** carteira e empreendimentos numa tela; Novo imóvel em 4 passos com fotos primeiro,
  IA lendo as fotos e escrevendo a descrição, qualidade com "o que falta", autorização de venda e
  visibilidade.
- **Por que importa:** bloco "Imóveis" da 15.1; independência de estoque (princípio 8).
- **Pronto quando:** um imóvel com fotos é cadastrado em menos de 3 minutos, no computador (P06,
  P07) e no celular (M3) na ordem da referência, e só os públicos aparecem fora.
- **Situação:** **parcial.** Na `main` (`docs/imoveis.md`; grupo 3 da fase 1.7). O PR #226 (ordem
  do M3 igual à referência, D-139) está aberto, revisado, esperando a conferência visual.

### 6. Conversas e WhatsApp

- **O que é:** a tela Conversas com o WhatsApp do corretor conectado em até 3 passos (cadastro
  incorporado com coexistência): caixa com chips e resumo, envio de imóvel como cartão, seleção,
  arquivo, localização e link do portal, modelos e janela de 24 h.
- **Por que importa:** princípio 12 (o WhatsApp do relacionamento passa pelo app, D-25); bloco 6
  do plano; #8.
- **Pronto quando:** uma conta de teste conecta e uma mensagem faz ida e volta pelo app, com a
  conversa listada com chips e resumo (#8, "Pronto quando").
- **Situação:** **parcial.** A tela Conversas existe sem WhatsApp (D-116, 0.1.46,
  `docs/conversas.md`). O WhatsApp está **bloqueado pela plataforma**: P-31 (GET de verificação da
  Meta) e P-32 (corpo cru no handler) não existem no SDK 100 (plano, R.1; D-78). Nenhuma sessão
  contorna: espera o SDK, ou uma decisão do dono pelo caminho B (parceiro Meta, D-59).

### 7. Mensageiro

- **O que é:** o agente que atende os clientes no WhatsApp do corretor: configuração em 5 passos,
  permissões por ação ("pergunta antes" ou "faz sozinho"), conversa de teste, passagem ao corretor
  com resumo, custo visível e modo degradado.
- **Por que importa:** spec 10.3; bloco 7; #9; critério "Mensageiro atendeu clientes reais sem
  nenhuma ação proibida" da 15.2.
- **Pronto quando:** o "Pronto quando" de #9 (mensagem de teste às 22 h respondida em segundos, 3
  imóveis enviados como cartão, visita marcada, passagem no Hoje com o resumo; assumir e reativar
  pelo mesmo botão).
- **Situação:** **falta.** Depende do item 6 (#8).

### 8. Estúdio e Instagram

- **O que é:** peças para o Instagram com a marca do corretor: Criar rápido, gerador do app, "Fazer
  em outra ferramenta" e "Enviar arte pronta", legendas com IA, aprovação manual, agendar, publicar
  agora e baixar.
- **Por que importa:** bloco "Conteúdo" da 15.1; critério 2 da 15.1 (pacote de lançamento
  publicado numa conta de teste) e "publicou pelo menos 8 peças" da 15.2.
- **Pronto quando:** um pacote de lançamento é gerado e publicado no horário agendado numa conta
  de teste do Instagram, na instância.
- **Situação:** **parcial.** Código na `main` (`docs/estudio.md`, `docs/conexoes.md`; #56, #62 e o
  QA de 12/11 no #237). O fluxo de ponta a ponta não fecha na homologação porque o Instagram não
  está configurado lá (#30: credenciais da Meta nos parâmetros da instância, ação do dono).

### 9. Página do corretor e ficha pública

- **O que é:** a Minha Página por blocos (arrastar, mostrar, ocultar), a ficha pública do imóvel, o
  formulário que vira contato no funil e o link rastreado.
- **Por que importa:** bloco "Página" da 15.1; princípio 11 (menor fricção).
- **Pronto quando:** um visitante envia contato pela página e ele aparece no funil; a página no
  celular mostra imóvel na primeira tela.
- **Situação:** **feito** no código (`docs/minha-pagina.md`; #181 e #234 fechadas). Fica como
  observação, não como falta, o que o plano lista como decisão do dono: visitas à Página não
  medidas (P09 mostra "—") e o botão cortado na prévia em 1280 px (plano, "KPIs e prévia da
  Página"). (?)

### 10. Portal do Cliente e seleções

- **O que é:** o "Meu atendimento" do cliente no celular, por link pessoal: Próximo passo,
  Conversa, Imóveis, Agenda, Propostas; seleções com reação; pendências com "Feito".
- **Por que importa:** bloco "Cliente" da 15.1; visão do cliente (2.4); referência Compass One
  (#59).
- **Pronto quando:** o cliente de teste abre o portal, reage, pede para remarcar e manda mensagem,
  e vê só o que recebeu (critérios 2 e 3 da 15.1).
- **Situação:** **feito** no código (`docs/selecoes-e-portal.md`; #59, #98, #191, #231 fechadas). A
  conferência de ponta a ponta na instância entra pelo R.8 (item 15).

### 11. Negociação: Negociador IA e negociador humano

- **O que é:** propostas e rodadas, mandato sigiloso por negócio, faixa ZOPA, Negociador IA nos
  três níveis ("faz sozinho" só no portal), negociador humano opcional, validações de código da
  10.9.7.
- **Por que importa:** arco 1.2 (#87); critério 8 da 15.1; regras do `CLAUDE.md` sobre recuo,
  alvo e BATNA.
- **Pronto quando:** as 7 conversas-roteiro de 10.9.9 passam (nenhuma contraproposta abaixo do
  recuo, nenhum vazamento de recuo, alvo ou BATNA, passagem correta) e o negociador humano de teste
  vê só a negociação atribuída.
- **Situação:** **parcial.** Código na `main` (`docs/negociacao.md`; #100 a #106, #133 a #136).
  Ficam: o PR #225 (P15 dentro de Clientes, D-136) aberto, esperando a conferência visual; a forma
  final da autorização do proprietário para "faz sozinho" (P-41, decisão do dono); e o negociador
  lendo eventos da conta pelo barramento (plano, "Negociador lê os eventos da conta"), que é limite
  do SDK.

### 12. Assistente do Corretor

- **O que é:** o chat ao lado de toda tela, que responde pelo manual do app (`docs/`), ajuda a
  decidir e cria lembretes, tarefas e agendamentos com a confirmação do corretor.
- **Por que importa:** bloco "Assistente" da 15.1; critério 6 (30 perguntas).
- **Pronto quando:** o Assistente responde corretamente as 30 perguntas do roteiro na instância, e
  nenhuma ação acontece sem confirmação.
- **Situação:** **parcial.** Código e roteiro na `main` (`docs/assistente.md`, `testes/`). A
  execução das 30 perguntas na instância entra pelo R.8 (item 15).

### 13. Números

- **O que é:** relatórios com KPIs de fonte, período e fórmula (spec 11.2), quatro números acima
  da dobra, O que melhorar, exportação.
- **Por que importa:** princípios 5 e 9; critério 5 da 15.1; "tempo médio de primeira resposta
  caiu" da 15.2.
- **Pronto quando:** funil e tempo de resposta batem com a conferência manual sobre a semente, e o
  tempo de primeira resposta é medido por corretor durante o piloto.
- **Situação:** **parcial.** Na `main` (`docs/desempenho.md`; #60, #96). O tempo de primeira
  resposta depende das conversas do WhatsApp (item 6); o horário de atendimento usado em "Contatos
  por horário" é fixo, 8h–19h (plano, "Página e Números").

### 14. Padrão B, celular e acessibilidade

- **O que é:** todas as telas do corretor na moldura do Padrão B (spec 11.0) e iguais às
  referências oficiais de `specs/layout/`, no computador e no celular, com os estados de 11.0.4 e
  campos com nome acessível.
- **Por que importa:** critérios 1 e 9 da 15.1; `CLAUDE.md` § Referência visual.
- **Pronto quando:** a conferência visual da seção 6 de `specs/layout/README.md` passa nas 25 telas
  e o contraste fica em 4,5:1 ou mais.
- **Situação:** **parcial.** Grupos 1 a 5 da fase 1.7 entregues (0.1.46 a 0.1.51) e o resíduo da
  etapa 5 (0.1.52 a 0.1.60). Ficam: as decisões de tela listadas no plano ("Cabeçalho de
  Clientes", "Telas no celular", "KPIs e prévia"); a acessibilidade dos campos, bloqueada pelo
  pedido 29a ao shell; o contraste de alguns selos, aceito até o pedido 28.

### 15. Fechamento do MVP interno (fase 1)

- **O que é:** os 9 critérios da spec 15.1 executados e registrados na instância, com a app
  instalada e atualizada pelo pacote, sem reprovação.
- **Por que importa:** é o "pronto" da fase 1 e a porta para a fase 2; bloco 10 do plano.
- **Pronto quando:** o roteiro R.8 está executado na instância com registro, os 9 critérios da
  15.1 cumpridos (exceto os que dependem dos itens 6 e 7, se o dono mantiver a D-78), e o dono
  aprova o MVP interno.
- **Situação:** **falta.** Há merges na `main` desde a 0.1.58 sem release solta (plano, "Release da
  main": o próximo release precisa subir a `versao` para 0.1.64), e o R.8 não foi executado. Release
  e homologação são do dono.

### 16. Documentação servida em dia

- **O que é:** `apps/portal_corretor/docs/` descreve o que a tela faz na versão instalada, e a base
  do Assistente (`comum/ajuda-gerada.ts`) está em dia.
- **Por que importa:** princípio "a documentação servida descreve a tela"; o Assistente responde a
  partir dela.
- **Pronto quando:** cada guia confere com a tela da versão corrente, e o `docs/README.md` cita a
  versão do manifesto.
- **Situação:** **parcial.** O teste de base de ajuda garante a sincronia com `docs/`, mas o
  `docs/README.md` ainda diz "O que existe nesta versão (0.1.53)" com o manifesto em 0.1.63.

### 17. Pré-requisitos do piloto (fase 2)

- **O que é:** o app registrado na Meta com verificação da empresa e acesso avançado, termos de
  uso, política de privacidade e consentimentos publicados, e suporte definido.
- **Por que importa:** pré-requisitos da spec 15.2; bloco 2.1 do plano.
- **Pronto quando:** a conexão de uma conta real de WhatsApp e de Instagram funciona.
- **Situação:** **falta.** Depende do dono (P-26, caminho do registro na Meta; textos legais) e do
  item 6.

### 18. Piloto com corretores reais (fase 2)

- **O que é:** 3 a 5 corretores reais por 4 semanas, com acompanhamento semanal e ajustes de tela,
  texto, IA e automação.
- **Por que importa:** é o destino desta versão do documento: o "MVP validado" (spec 15.2).
- **Pronto quando:** cada corretor conectou WhatsApp e Instagram sem ajuda; publicou ao menos 8
  peças; o Mensageiro atendeu clientes reais sem ação proibida; o tempo médio de primeira resposta
  caiu; nenhum incidente de vazamento entre contas; os corretores dizem que continuariam usando.
- **Situação:** **falta.** Depende dos itens 15 e 17. Nenhum corretor real usa o app hoje
  (`CLAUDE.md`).

## Fora do Estado da Arte, de propósito

- **Fases 3 a 7 da spec** (proprietário, equipe, metas e comissões, rede e incorporadoras, mais
  canais, futuro; `specs/horizonte.md`). Decisão do dono em 25/11/2026: o destino desta versão são
  as fases 1 e 2. Voltam por PR quando o dono ampliar o destino.
- **"Design da plataforma" (#48) e integração do Canva por API (#47):** adiadas pelo dono para
  depois da fase 2 (D-86, #49).
- **Aprovação por janela no Estúdio:** saiu de vez em 23/10 (D-86; #55, #62).
- **Exportar CSV para a Criação em massa do Canva (#46):** não planejado (#43, direção de 23/10).
- **Login, ajuda, bug, sugestão, "sobre", temas e branding da instância:** são da plataforma
  (`CLAUDE.md`).
- **Contornar limite do SDK** (WhatsApp por outro caminho, SQL cru, rota do shell inventada): nunca;
  vira pedido ao shell ou decisão do dono.

## Perguntas ao dono

As perguntas abaixo foram feitas na conversa da PREPARAR; o que ele respondeu está em § Respostas
do dono. O que ficou marcado (?) e ainda não tem resposta continua aqui.

1. **Princípio "entrada separada de resultado"** (?): a leitura é "sugestão da IA é sempre
   proposta, a ação só acontece depois da confirmação do corretor". Está certo, ou ele quer dizer
   outra coisa neste app?
2. **Princípio "precisão"** (?): dinheiro em duas casas no formato brasileiro, sem perda na
   gravação; área e percentuais sem arredondar no cálculo. Confirma?
3. **Item 9** (?): visitas à Página não medidas e o botão cortado na prévia em 1280 px ficam como
   observação, e a Página conta como feita. Ou ele quer que medir visitas faça parte do destino?

## Respostas do dono

- **25/11/2026 (PREPARAR, na conversa):** o destino são as fases 1 e 2 da spec ("Fases 1 e 2");
  as fases 3 a 7 ficam fora, por ora. Aplicado no cabeçalho, nos itens 17 e 18 e em § Fora.
- **25/11/2026:** merge automático igual ao da viabilidade: a tarefa de Merge mergeia sozinha itens
  pequenos e médios não sensíveis com `Autonomia: 2` no prompt; o resto espera o dono. Aplicado no
  `CLAUDE.md` § Merge da rotina, no mesmo PR de instalação.
- **25/11/2026:** um Construtor por dia (6h17) e o Merge à 0h17, horário de Brasília; as tarefas
  são criadas desligadas e ligadas depois do merge da instalação.
