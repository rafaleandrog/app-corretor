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

## Se o shell não puder atender 1 e 2 a tempo

Usar um parceiro de soluções da Meta já aprovado (caminho B da spec 9.0) como ponte: ele recebe da Meta e reenvia por `POST` simples para o `wh` do app, sem desafio e com autenticação própria. Custo e dependência a decidir com o dono.
