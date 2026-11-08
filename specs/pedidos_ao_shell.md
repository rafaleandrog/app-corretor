# Pedidos ao shell do UrbiVerso — Portal do Corretor

Ajustes pequenos e gerais que o app precisa da plataforma. Servem a qualquer app que receba webhooks da Meta (WhatsApp, Instagram, Facebook). Verificar primeiro no SDK instalado se já existem; se não, propor ao dono um PR no monorepo do UrbiVerso.

## 1. Verificação por `GET` no endereço do `wh` (P-31) — bloqueia o bloco 6 do MVP

**Por quê:** a Meta só aceita um endereço de webhook depois de chamar esse mesmo endereço com `GET ?hub.mode=subscribe&hub.verify_token=<token>&hub.challenge=<n>` e receber de volta o valor de `hub.challenge` em texto puro com status 200. Vale para o endereço padrão do app e para o endereço alternativo de cada número de corretor. Hoje o `wh` só aceita `POST`.

**Proposta mínima:** no `POST /api/wh/:app_id/:token`, aceitar também `GET` quando o webhook declarar `"verificacao": "desafio_meta"` no manifesto; o shell compara `hub.verify_token` com um valor guardado no ingresso (definido em `gerarIngressoWh({ ..., verify_token })`) e devolve `hub.challenge`. Alternativa genérica: export `webhooks_verificacao.<nome>(req, res)` chamado no `GET`.

## 2. Corpo cru e cabeçalhos no handler do `wh` (P-32) — bloqueia o bloco 6

**Por quê:** a Meta assina cada `POST` com HMAC-SHA256 do corpo exatamente como enviado, no cabeçalho `X-Hub-Signature-256`, usando o segredo do app. Para validar, o handler precisa dos bytes originais e dos cabeçalhos.

**Proposta mínima:** `req.wh.corpo_bruto` (Buffer) e `req.headers` disponíveis no handler. Alternativa: o shell valida, se o webhook declarar `"assinatura": { "tipo": "hmac_sha256", "cabecalho": "X-Hub-Signature-256", "parametro_segredo": "meta_app_secret" }`.

## 3. Confirmar no SDK (sem mudança, se já houver) (P-33) — bloco 0

- O handler do `wh` lê o **contexto do ingresso** (o `contexto` passado em `gerarIngressoWh`), para saber de qual conta é a mensagem.
- O handler publica evento segregado com `{ conta_id }` e o listener `reagir` grava com `dados.comConta(contaId, …)`.
- **Rotas públicas** (Minha Página, ficha, seleção) leem tabelas segregadas de uma conta conhecida pela URL. Se não houver caminho sancionado, o app mantém `vitrine_publica` (só dados publicados, sem dado pessoal) — decidir com o dono.
- O frontend da app pode redirecionar para o cadastro incorporado hospedado da Meta e para o login do Instagram e receber o retorno numa sub-rota autenticada (P-36).

## 4. Confirmar no SDK: `req.ip` no handler do `wh` (bloco 5a)

O formulário da Minha Página limita 3 envios por minuto por origem usando `req.ip` (o primeiro `X-Forwarded-For` é do cliente e se falsifica). Os docs do SDK não dizem se o shell declara o proxy confiável (`trust proxy`) para os handlers de `wh`. Sem isso, `req.ip` é o endereço do balanceador e o limite passa a valer para a conta inteira. **Pedido:** confirmar o comportamento ou expor no `req.wh` um endereço de origem confiável.

## 5. Assistente da app em todas as telas e canal de suporte do externo (bloco 9, P-39)

A spec 10.2 pede o Assistente "em qualquer tela (botão fixo)". O contrato de UI proíbe `position: fixed` e altura própria na tela, e não há primitivo de painel lateral ou flutuante que a app possa abrir sobre as próprias telas. Por isso, no MVP, o Assistente é um item do menu (D-76). Pedido: um primitivo, ou um slot no `urbi-shell-page`, para um painel de chat fixo da app. E, para o corretor (externo, shell reduzido, sem "Reportar bug"), um caminho de suporte que a app possa indicar quando o Assistente não sabe responder.

## 6. Externo cai numa página inicial vazia (19/10/2026)

O corretor é externo. Ao entrar pela raiz da instância, ele vê só a marca e o avatar: o shell reduzido do externo não tem seletor de apps nem menu (permissoes.md § Usuário externo, "Gap conhecido"). Hoje ele só chega ao app por link direto (`/portal_corretor`), e o e-mail de convite não leva esse endereço. Na homologação o dono entrou como corretor e achou que não tinha acesso a nada. **Pedido:** externo com acesso a um app só cai direto nele (ou vê o atalho dos apps liberados na página inicial); e o convite emitido por uma app leva ao resgate e depois ao app que convidou.

## 7. Cartão com capa (imagem) nas telas autenticadas (spec 1.1, D-84)

A carteira de imóveis pede cartão com foto dominante (referência: imagem 1 da spec 2.7 e Kenlo). Nas páginas públicas o app tem CSS próprio e faz. Nas telas autenticadas o contrato de UI proíbe CSS da tela e o `urbi-card` do SDK 100 só tem `titulo`, `icone`, `clicavel` e os slots `detalhe` e `acoes`; o único primitivo com imagem é o `urbi-avatar`. **Pedido:** prop `imagem` (URL, proporção 4:3 ou 1:1) no `urbi-card`, ou um primitivo de cartão com capa. Até lá, a app usa `urbi-grid` + `urbi-card` + `urbi-avatar` grande (exceção nomeada D-65).

## 8. Estado da aba do `urbi-abas` na URL (spec 1.1, D-81)

Com Início, Clientes, Imóveis e Ajustes em abas, a aba ativa precisa sobreviver ao recarregar e poder ser compartilhada por link. Hoje a app lê `?aba=` em `window.location.search` e reflete com `history.replaceState`, à mão em cada tela. **Pedido:** atributo opcional no `urbi-abas` (por exemplo `parametro-url="aba"`) que faça isso pelo shell, ou documentar o padrão recomendado.

## 9. `cancelarAgendamento` no contexto de migração de app (D-86)

**Por quê:** a migração 001 do Estúdio devolve a rascunho as peças agendadas sem aprovação e precisa cancelar, no barramento, o `publicacao_programada` já marcado de cada uma. O `barramento.md` lista `cancelarAgendamento` em `req.eventos`, mas o helper `eventos` do contexto de migração (`upgrade-e-migracoes.md`, § Helper `eventos`) só tem as operações de inscrição. A migração chama o método de forma protegida (`typeof … === 'function'`), então sem ele o agendamento fica órfão e o listener descarta o evento na hora marcada. **Pedido:** expor `cancelarAgendamento` também no contexto de migração de app, ou documentar como uma migração cancela um agendamento.

## 10. Gaveta (drawer) nas telas autenticadas (spec 1.2, Padrão B)

**Por quê:** o Padrão B (spec 11.0) abre o mandato de negociação (P16) e, em telas estreitas, a coluna de contexto numa gaveta lateral sobre a tela. O catálogo `ui-componentes-*` do SDK 100 não tem gaveta, e o contrato de UI proíbe a tela de escrever CSS estrutural (`position`, altura própria).

**Até lá:** `urbi-modal`, como exceção nomeada (spec 11.9).

**Proposta mínima:** `urbi-gaveta` com lado (direita/baixo), largura em token, foco preso e fechar por Esc, com o mesmo contrato de eventos do `urbi-modal`.

## 11. Barra de progresso (spec 1.2, P01)

**Por quê:** "Primeiros passos" em Hoje (P01) mostra quanto da configuração inicial já foi feito. O SDK 100 tem `urbi-grafico-medidor` e `urbi-kpi`, mas não uma barra de progresso linear simples.

**Até lá:** texto "3 de 5" (exceção nomeada, spec 11.9).

**Proposta mínima:** `urbi-progresso` com `valor`, `maximo` e rótulo acessível.

## 12. Seletor segmentado de três posições (spec 1.2, P11 e P16)

**Por quê:** cada ação do Mensageiro e o nível de autonomia do Negociador se escolhem entre "Não faz · Pergunta antes · Faz sozinho" (ou "Só sugere · Pergunta antes · Faz sozinho"), lado a lado, com a posição visível de relance. O SDK 100 tem `urbi-toggle` (duas posições) e `urbi-select` (lista), não um seletor segmentado.

**Até lá:** `urbi-select` (exceção nomeada, spec 11.9).

**Proposta mínima:** `urbi-segmentado` com opções, valor e evento de mudança, acessível como grupo de rádios.

## 13. Faixa ZOPA (régua com marcas e intervalo colorido) (spec 1.2, P15, D-102)

**Por quê:** a negociação (P15) mostra numa régua horizontal o preço pedido, o alvo, o ponto de recuo, a última oferta, o teto estimado do comprador e a ZOPA pintada entre o recuo e o teto. Não há primitivo de régua ou faixa no SDK 100, e um componente de domínio com CSS próprio pede exceção nomeada.

**Até lá:** os valores em `urbi-kpi`, com a ZOPA dita em texto ("ZOPA estimada: R$ 1,35 mi a R$ 1,42 mi" ou "Sem ZOPA") (spec 11.9).

**Proposta mínima:** `urbi-regua` genérica: mínimo, máximo, marcas com rótulo e cor por papel, e intervalos coloridos; serve também a metas e faixas de preço.

## 14. Atalho de trilho que abre menu (spec 1.2, moldura do Padrão B, item B1)

**Por quê:** o guia do Padrão B põe o **Criar** no topo do trilho, abrindo um menu (Novo cliente, Novo imóvel, Novo post, Nova visita, Nova proposta). O `urbi-trilho-atalhos` do SDK 100 só emite `urbi:atalho-click` e não ancora um `urbi-dropdown`; um menu posicionado à mão pediria CSS estrutural.

**Até lá:** o Criar é um `urbi-dropdown` no `actions` do `urbi-shell-page`, no alto de toda tela do corretor (exceção nomeada em 11.9).

**Proposta mínima:** um campo `itens` no `UrbiAtalhoTrilho` (como o submenu do `urbi-menu-contexto`), que abre o menu ancorado no atalho e emite a escolha.

## 15. Saber se o menu da app aparece para quem está vendo (spec 11.0.1, item B1)

**Por quê:** pela regra 11.0.1, onde o menu do shell aparece o trilho fica só com Criar e Assistente. Mas o externo não abre o menu de navegação da app na topbar reduzida (gap em `permissoes.md` § Usuário externo), e a app não pode saber o tipo de quem vê. Sem um sinal, o trilho mostra os itens do menu sempre, e quem é da equipe os vê duas vezes.

**Até lá:** trilho com os itens do menu e o Assistente.

**Atualização (#166, 0.1.43, D-113):** a duplicação foi resolvida do lado do app, sem depender deste pedido: o `nav` do manifesto deixou de repetir as sete telas do trilho e ficou só com Equipe da plataforma › Corretores. O trilho é o menu das telas para todo mundo. O pedido continua valendo só se um dia o trilho tiver que encolher onde o menu do shell aparece (a regra antiga de 11.0.1).

**Proposta mínima:** fechar o gap (o externo abre o menu da app) ou expor em `urbiVerso.contexto()` um booleano "o menu da app está visível".

## 16. Evento segregado lido por todo membro da conta, e `wh` sem `req.dados` segregado (F4, #136)

**Por quê:** o negociador humano (D7) é membro da conta do corretor e lê, pelo barramento (listagem, busca individual e notificações por inscrição), todo evento segregado da conta: o recorte é por conta, não por papel nem por registro. O `destinatarios` do `publicar` recorta só o stream SSE (`barramento.md` § Destinatários). Os eventos de negociação já saem só com ids, mas três eventos nascem num handler de `wh`, onde o `req.dados` não é segregado e o app não pode gravar na conta antes de publicar (`wh.md`, `contas.md` § Modo de conexão). O dado pessoal só chega ao listener pelo evento:

- `lead_recebido`: nome, telefone, e-mail e mensagem de quem pediu contato;
- `reacao_recebida`: o comentário do cliente na seleção;
- `acao_cliente_recebida`: o texto da mensagem do cliente pelo portal.

**Até lá:** risco residual documentado em `apps/portal_corretor/docs/negociacao.md` (Negociador humano) e avisado na tela e no diálogo de convite; o teste `eventos-sem-dado-pessoal.test.ts` emite todos os eventos do app pelos caminhos reais e barra qualquer outro campo pessoal em evento (#151).

**Situação (05/11/2026, #151):** em aberto. O SDK instalado segue 100.0.0 e o próprio `wh.md` reconhece a lacuna: "`req.dados` não serve aqui (ainda)".

**Proposta mínima (qualquer uma fecha):** (a) `req.dados` segregado no handler de `wh`, com a conta do contexto do ingresso (como o listener recebe), para o app gravar o pedido e publicar só o id; ou (b) recorte de leitura do evento segregado por papel da app ou pela lista `destinatarios` também na listagem, no pull e nas inscrições, não só no SSE.

## 17. Saber se a política "permite contas multi-usuário" está ligada (F4, #136)

**Por quê:** o convite do negociador humano só funciona com a política ligada; desligada, a emissão é recusada com `CONVITE_MULTI_USUARIO_BLOQUEADO` (`contas.md` § Políticas de instância). O SDK 100 não tem como o app consultar a política antes, então a tela não pode esconder o botão nem dizer de antemão se vai dar certo.

**Até lá:** Ajustes › Negociador explica a política antes de convidar e, na recusa, traduz o código.

**Proposta mínima:** expor a política ao app, por exemplo um booleano `multi_usuario` em `req.shell.externos` (ou no retorno de uma consulta de capacidades do provisionamento), legível por quem pode convidar.

## 18. Atalho global de teclado e teclas reservadas pelo shell (spec 11.0.6, item B10, #145)

**Por quê:** os atalhos do corretor (`/` busca, `C` Criar, `A` Assistente, `J`/`K` e `E`) escutam `keydown` na janela (`frontend/atalhos.ts`). O SDK 100 não tem contrato para a app ouvir o teclado fora da própria tela nem diz quais teclas o shell usa ou vai usar; o único texto é "Sem atalho de teclado nesta versão." (`ui-componentes-layout.md`, no trilho). Hoje não há colisão, e o app se protege: não age em campo de texto, diálogo aberto nem com Ctrl, Cmd ou Alt. O risco é o shell ganhar um atalho com a mesma tecla e as duas ações dispararem juntas.

**Até lá:** o listener do app como está, desligado ao sair do app, e sem tecla com modificador.

**Proposta mínima:** documentar no SDK se a app pode ouvir teclado global e quais teclas o shell reserva (ou um registro de atalhos da app no shell, que resolva a colisão e mostre a lista ao usuário).

## 19. Prefixo das tags internas da app (`app-{pasta}` × prefixo próprio) (item B7, #145)

**Por quê:** o `ui.md` diz "Apps registram como `app-{nome-da-pasta}`" e não esclarece se a regra vale para os componentes internos da tela ou só para o componente de entrada. O app usa `pc-*` nos internos desde o início, e o empacotador não reclama.

**Até lá:** `pc-*` nos internos.

**Proposta mínima:** uma frase no `ui.md` dizendo a regra das tags internas (e, se for `app-{pasta}-*`, que o empacotador avise).

## 20. Comprimento CSS em prop de primitivo (`urbi-grid min`/`gap`) (item B5b, #145)

**Por quê:** o `ui.md` proíbe comprimento CSS em atributo de primitivo, mas o catálogo publica `min` e `gap` do `urbi-grid` com valores em px (`min="180px"`). O app segue o catálogo (`frontend/telas/novo-imovel.ts`, Números), e a revisão aponta a contradição a cada PR.

**Até lá:** o que o catálogo publica.

**Proposta mínima:** o `ui.md` abrir a exceção para as props documentadas do `urbi-grid` (ou o catálogo trocar px por um token de tamanho).

## 21. Primitivos `urbi-*` disponíveis para teste fora do shell (itens B5b e B7, #145)

**Por quê:** os testes no Chromium (`testes/*-chromium.test.ts`) montam as telas sem os primitivos, que não vêm no SDK. Por isso eles travam a árvore da moldura e os slots, mas não medem o layout real (largura das colunas, empilhamento no celular) e simulam o clique de `urbi-botao-alternar` em vez de clicar no primitivo de verdade.

**Até lá:** CSS de teste que imita o desktop documentado, e a medição registrada como limite da superfície nos próprios testes.

**Proposta mínima:** publicar no SDK um bundle dos primitivos (ou um registro de teste) que um teste possa carregar fora do shell.

## 22. Superfície de "conta ativa" no SDK: evento ou leitura (#144, sobra do B6)

**Por quê:** as telas do app guardam estado da conta em que estão (lista, ficha aberta, rascunho, conversa do Assistente) e precisam saber, na hora, quando a conta muda, para recriar a tela e descartar o que ainda chega da conta anterior. O SDK 100 não tem uma superfície própria de "conta ativa". O app deduz a conta de `urbiVerso.contexto().conta` (`contaEscrita` com uma conta só; o seletor próprio do app, guardado no navegador, com várias) e só fica sabendo da mudança pelo `urbi:contexto-app`, que dispara quando o contexto inteiro muda (`autenticacao.md` § Quando o contexto existe), sem dizer se o que mudou foi a conta. Também não há garantia documentada de que o contexto seja recarregado quando a conta muda no servidor: o shell o busca a cada navegação para a app, então uma troca feita pela plataforma só chega à tela na próxima navegação ou recarga, sem evento no meio. O caso que motivou o pedido: o operador que atende uma conta só tem a conta trocada; até a 0.1.36, a chave das telas usava só a conta do seletor (nula sem seletor) e a troca passava despercebida.

**Até lá:** `contaDeTrabalho()` (`frontend/apoio.ts`) é a identidade da conta para o estado das telas; a cada `urbi:contexto-app` o app a relê e, se mudou, recria a tela (chave `sub|conta|visita` em `frontend/index.ts`), relê os dados de módulo e recomeça o Assistente. Teste `troca-de-conta-chromium.test.ts` em cada tela do menu.

**Diálogo aberto durante a troca (#157):** `urbiVerso.formulario` e `urbiVerso.confirmar` abertos numa conta continuam abertos depois da troca, e o app não tem como fechá-los. Até a superfície existir, o app prende ao gesto que abriu o diálogo a busca dos campos `busca` (`buscaDoGesto`, em "Nova visita" e "Nova proposta": depois da troca ela não lista nem consulta nada) e descarta o que for confirmado depois. Com (a) ou (b), o shell poderia fechar os diálogos da app quando a conta muda.

**Proposta mínima (qualquer uma fecha):** (a) um evento `urbi:conta-ativa` no `window`, com `{ appId, conta }` no `detail`, disparado quando a conta de trabalho da app muda (inclusive a troca feita pela plataforma); ou (b) uma leitura `urbiVerso.contaAtiva(): number | null` com o mesmo significado do `req.contexto.contaEscrita` do backend, mais a garantia documentada de que o `urbi:contexto-app` dispara quando ela muda. Com (a) ou (b), o seletor de conta poderia também ser do shell, e o app deixaria de guardar a escolha no navegador.

## 23. Cor fixa de página pública × aviso `[tokens]` do empacotador (#168)

**Por quê:** `paginas-publicas.md` manda a página pública **não** adotar tokens de tema (visitante anônimo) e ter "HTML nativo com visual fixo" até existir vocabulário de marca, no mesmo bundle da app ("sem bundle separado"). Visual fixo é cor literal. Mas o empacotador (e a instalação) varre todo `frontend/**` com extensão `.js`, `.css` ou `.html` (pulando pastas com ponto e `node_modules`) atrás de literal de cor e avisa `[tokens] N literais de cor fora de token no bundle`, sem distinguir página pública de tela autenticada e sem marcação de exceção (só ignora comentário de bloco). O `"ui": false` do manifesto não resolve: essa auditoria roda sem olhar esse campo, e o `ui.md` diz que a página pública é ortogonal a ele. Resultado: toda instalação do app sai com aviso, e o aviso não tem conserto legítimo do lado da app. O registro de exceções do `ui.md` também não tem linha para página pública.

**Até lá:** exceção nomeada "paleta das páginas públicas" (spec 11.9): as 14 cores escritas uma vez, como literais, em `frontend/publico/estilo.ts`; o aviso fica (14 literais) e é esperado. Até a 0.1.44 a paleta era montada por uma função (`color(srgb …)` a partir de canais), que fazia a heurística contar 1 em vez de 14 — disfarce desfeito na 0.1.45.

**Proposta mínima (qualquer uma fecha):** (a) o vocabulário de marca para páginas públicas (tokens próprios, não de tema), que tiraria os literais; ou (b) a auditoria `[tokens]` ignorar o CSS dos componentes declarados em `paginas_publicas` do manifesto (ou um arquivo/pasta convencionado para eles), mais uma linha "Página pública: paleta fixa" no registro de exceções do `ui.md`.

## 24. Primitivos e contratos aquém do layout v2 (fase 1.7, grupo 1)

**Por quê:** a referência visual v2 (`specs/layout/README.md` § 3, aprovada pelo dono) fixa botão de 34 px, campo de 36 px e raio 12, e a conferência da P02 (`specs/prints/conferencia-p02-0.1.46/`) mostrou três pontos em que o primitivo não chega lá sem CSS da tela, que a regra 10 de `ui.md` proíbe:

1. **Botão só ícone** (`urbi-botao` com `icone` e `ariaLabel`, sem texto): sai 48 × 29. O contrato pede 34 × 34, quadrado, para o Assistente no cabeçalho da coluna esquerda de toda tela (D-114).
2. **Item ativo do `urbi-lista`**: `itemAtivo` marca `aria-current="true"` mas não pinta; o destaque "continua vindo de `classe-item`/`render_item`", isto é, de CSS da tela. Toda lista de três colunas (Conversas, Clientes, Imóveis) mostra o item aberto sem fundo.
3. **`urbi-redator` como compositor de conversa**: textarea de 75 px com auto-resize e "Enviar" de 25 px com texto; a referência é um campo de uma linha (38 px) com botões só ícone de 34 × 34 (anexar, enviar, microfone).

**Até lá:** usar o primitivo e registrar a diferença em cada PR de tela (README § 1).

4. **`urbi-feed` com conteúdo livre por mensagem** (balão espelhado por autor, cartão de imóvel, aviso ao centro): hoje a P02 monta os balões com `urbi-linha` + `urbi-card` (exceção nomeada "balões da conversa", spec 11.9) e perde o que o feed dá de graça (abertura no fim, scroll próprio, fill no celular).
5. **Contrato do `nav` do manifesto no bundle do SDK**: `apps-em-repo-proprio.md` remete a "Arquitetura e Apps", que não vem no bundle; falta dizer itens, níveis, ícone, rota `/`, e se o `nav` é filtrado por papel e mostrado ao usuário externo (o bundle do shell 0.56.37 sugere que mostra, `_renderExterno` da topbar; a confirmar entrando como o corretor demo; `permissoes.md` § Usuário externo ainda diz que não).
6. **`urbi-stack` com `gap`**: a tela precisa de um empilhamento mais apertado (nome + chips) e o catálogo diz "Props: nenhuma"; ou o stack ganha `gap` documentado (como `urbi-linha`), ou um papel "compacto".

7. **`criarOuAtualizar` sobre único parcial em tabela segregada:** `banco-de-dados.md` não diz se a chave do `ON CONFLICT` inclui `conta_id` quando o `unicos` da tabela é parcial (`onde removido_em nulo`) e a tabela é `segregada_por_conta`. Hoje a P02 lê e depois cria a conversa (uma por contato) e trata o `23505` relendo; com a resposta, o verbo certo substitui os dois passos.

8. **Categoria de auditoria para fato da conta:** `auditoria.md` define as oito categorias pela plataforma (`configuracao` = "mudança de config da plataforma: Slack, domínio de email"); conectar ou desconectar um canal da conta de um corretor (`canal_conectado`/`canal_desconectado`, 13.1) não tem categoria própria e usa `configuracao`. Pedir uma categoria para apps (ou a definição do uso por apps).
9. **Escopo do `ctx.dados` em listener e rotina de app segregada:** `contas.md` chama o filtro `conta_id` na leitura de "inócuo", mas em contexto SISTEMA (`varrerTudo` em listener e rotina) ele é o que separa as contas; `rotinas.md` não diz o escopo do `ctx.dados` numa app segregada. Documentar.
10. **Erro de único no `criar`:** `banco-de-dados.md` diz que o erro chega cru com `code` para CHECK (`23514`) e para o `restaurar` (`23505`); para o `criar` a app lê `code === '23505'` por analogia. Confirmar no doc.

**Proposta mínima:** (1) `urbi-botao` sem texto vira quadrado da altura do botão (34, ou 25 com `pequeno`); (2) `urbi-lista` pinta o item `aria-current` com o fundo de seleção do tema; (3) `urbi-redator` com uma prop `compacto` (ou `uma-linha`): campo de 36 px que cresce só ao digitar várias linhas e botões só ícone; (4) a (10) acima.

## 25. `nav` do manifesto filtrado por papel (D-125)

**Por quê:** o `nav` é o menu da app para todo usuário que a abre, e a app tem papéis externos com alcance diferente: o `corretor` usa as oito telas; o `negociador` humano só pode ver Clientes › Negociações (as atribuídas a ele). Sem filtro por papel, o negociador vê oito itens que respondem erro ou vazio. Até o grupo 1 da fase 1.7 o trilho da app resolvia isso (`MENU_NEGOCIADOR`); com o menu no `nav` (D-114), não há como.

**Até lá (D-125):** a app abre direto em Clientes › Negociações para quem tem só o papel `negociador` e redireciona qualquer outra rota para lá; o `nav` segue inteiro.

**Proposta mínima:** cada item do `nav` aceitar `papeis: ["corretor"]` (slugs de `roles`/`roles_externos`); sem o campo, o item vale para todos. E o contrato do `nav` (itens, níveis, ícone, rota `/`, visibilidade para o externo) entrar no bundle do SDK (`apps-em-repo-proprio.md`), que hoje remete a um documento que não vem no bundle.

## Se o shell não puder atender 1 e 2 a tempo

Usar um parceiro de soluções da Meta já aprovado (caminho B da spec 9.0) como ponte: ele recebe da Meta e reenvia por `POST` simples para o `wh` do app, sem desafio e com autenticação própria. Custo e dependência a decidir com o dono.
