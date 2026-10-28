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

**Proposta mínima:** fechar o gap (o externo abre o menu da app) ou expor em `urbiVerso.contexto()` um booleano "o menu da app está visível".

## Se o shell não puder atender 1 e 2 a tempo

Usar um parceiro de soluções da Meta já aprovado (caminho B da spec 9.0) como ponte: ele recebe da Meta e reenvia por `POST` simples para o `wh` do app, sem desafio e com autenticação própria. Custo e dependência a decidir com o dono.
