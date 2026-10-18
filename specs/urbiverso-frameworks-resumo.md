# UrbiVerso — resumo de frameworks para quem escreve a SPEC de uma app

> Destilado de `docs/shell/*.md` em 2026-10-18. Serve a quem NÃO lê o repositório e precisa que a spec seja compatível com o que a plataforma **permite**, **determina** e **obriga**. Nomes em `código` são exatos. Em caso de conflito, o código/doc do repositório vence. Itens com "(SDK N)" exigem `sdk_min: N` no manifesto.

---

## 0. Modelo mental

- Plataforma web corporativa, instalável por instância (uma por organização). **Shell** central + **apps** plugáveis + **módulos** de dados compartilhados.
- Criar app é **declarar** (manifesto, schema, rotas, tela) e usar frameworks do shell — não programar infraestrutura (auth, banco, eventos, permissões, notificações, IA, e-mail…).
- Stack: Node 20 + Express + TypeScript; frontend Lit (Web Components); PostgreSQL com **um schema por app**; esbuild.
- Todas as apps rodam no mesmo processo Node; isolamento é por convenção/middleware, não por sandbox.
- Idioma do código: português (variáveis, tabelas, rotas).
- **UI e API andam juntas:** capacidade na API tem que existir na tela e vice-versa. Se não merece tela, não existe na API.
- **Doc e código no mesmo PR.** Specs descrevem só o que ainda não existe.
- **Apps não se comunicam diretamente.** Só por: API do shell, barramento de eventos, disparadores (via Remessa `acionador`), webhooks (`wh`). Nunca importar código do shell/outra app, nem ler `process.env` do shell, nem tocar tabela de outra app.

### Estrutura de uma app
```
apps/<nome>/
  manifesto.json      (obrigatório)
  schema.json         (se usa banco)
  backend/rotas.ts    (Express Router, rotas RELATIVAS)
  frontend/index.ts   (Web Component app-<nome>)
  comum/              (opcional: código puro compartilhado backend↔frontend)
  migracoes/          (scripts JS que só mexem em DADOS)
  docs/               (README.md = visão geral; alimenta o widget de ajuda)
```
- Nome da pasta = identificador = schema PostgreSQL: **`snake_case`** (minúsculas, dígitos, `_`, começa com letra). Tag do componente: `minha_app` → `app-minha-app`.
- **Nomes reservados** (reprovam registro): schemas `shell, nucleo, public, information_schema, pg_catalog, pg_toast` e qualquer `pg_*`; namespaces de API `pub, dados, apps, wh, arq, webhook, api, app, modulos`; rotas de topo do SPA `admin, docs, changelog, notificacoes, inscricoes, preferencias, perfil, os`; namespaces de evento `urbiverso, erro, erros`.
- Rotas da app: `GET/POST /api/<appId>/*` (**sem** `/apps/`; `/api/apps/...` dá 404). Públicas: `/api/pub/<appId>/*`. Pessoais: `/api/<appId>/pessoal/*`. CRUD genérico: `/api/dados/<appId>/<tabela>`. Módulos: `/api/<appId>/modulos/<slug>/*`.
- Em `rotas.ts` use caminhos relativos (`/itens`), nunca `/api/meu-app/itens`.
- Exports reconhecidos de `backend/rotas.ts` (todos opcionais, exceto o router): `rotas`/`default` (obrigatório), `rotasPublicas`, `rotasPessoais`, `webhooks`, `webhooks_upload`, `rotinas`, `disparadores`, `reagir`, `aoIniciar`, `aoEncerrar`.

### Ciclo de vida
1. Boot: cria schema, reconcilia tabelas do `schema.json`, registra roles, aplica migrações pendentes (instalação virgem faz baseline e **pula** migrações → seed deve ser idempotente em `aoIniciar`).
2. Monta rotas; depois do `listen` roda `aoIniciar(ctx)` (30 s) para app **operacional** (= ligada **e** saudável).
3. `aoEncerrar` (orçamento único de 5 s para todas as apps) no desligamento ou quando o admin desliga a app.
4. App `!saudavel` (piso de versão, dependência de módulo, schema com pendência) não carrega backend → `503 APP_INDISPONIVEL`.
5. Instalar/atualizar app reinicia o shell. `aoIniciar` pode receber requests antes de terminar: tolerar. Hooks não são scheduler (use rotinas/`agendar`) nem hook de instalação (rodam a cada boot).

---

## 1. Manifesto (`manifesto.json`) — campos

| Campo | Obrig. | Notas |
|---|:-:|---|
| `nome`, `versao` (`x.y.z`), `descricao` | sim | |
| `identidade` | sim* | `{owner}/{repo}::{slug}`; `slug` = nome da pasta (diverge → reprova). *Janela de 30 dias já corrida: declare sempre |
| `shell_min` | não | string `x.y.z`; piso de versão do shell |
| `sdk_min` | não | **inteiro** (`94`, nunca `"94.0.0"`); piso do nível do SDK |
| `roles`, `roles_externos` | não | papéis por nível (§3) |
| `permissao_padrao`, `permissao_padrao_externo`, `aceita_externos` | não | §3 |
| `dependencias` | não | módulos (§6); exige `sdk_min ≥ 87` |
| `rotas_publicas`, `paginas_publicas` | não | §8 |
| `nav` | não | menu da app (§9) |
| `eventos`, `erros` | não | §7 |
| `webhooks`, `rotinas`, `disparadores` | não | §8 |
| `parametros`, `telas_config` | não | config (§9) |
| `ia` (`true` ou `{slots}`), `emails` (`true`), `wiki` (`{leitura,escrita}`) | não | capacidades (§10) |
| `ui` (boolean) | não | `false` = a plataforma não valida a UI da app |
| `acesso_irrestrito`, `provisiona_externos`, `altera_plano` | não | superpoderes por papel (§3) |

- **Pisos:** `shell_min` e `sdk_min` são independentes e cumulativos; ausente = não testado. A primeira declaração de `sdk_min` exige também `shell_min ≥ 0.53.10`. **Mentir para baixo** passa no gate e quebra em runtime; mentir para cima só trava instalação.
- **Versão:** `versao` é chave de compatibilidade; downgrade é recusado. **Obriga** subir (mín. +1 em `z`) quando muda `schema.json`, há migração, ou muda `shell_min`/`sdk_min`.
- Recurso novo cunha piso. Resumo dos pisos que a spec pode acabar exigindo:

| Recurso | `sdk_min` | `shell_min` |
|---|---|---|
| `auditavel` | — | 0.50.16 |
| vocabulário estendido de `req.dados` | — | 0.53.3 |
| `descartar` em campo de wh | 60 | — |
| `notificarAdmins` | 69 | — |
| `permite_embed` | 79 | 0.56.6 |
| hooks `aoIniciar/aoEncerrar` | 59 | — |
| `dependencias` (módulos) | 87 | 0.53.10 |
| referência a tabela de módulo no schema | 90 | — |
| `rotasPessoais`/tabela `pessoal`, `formato`/`intervalo`, `incrementar`, `destinatarios` em evento | 94 | `destinatarios`: 0.56.25 |
| `disparadores` | 95 | 0.56.26 |
| `geometria` (só módulo) | 99 | — |

---

## 2. Framework de Dados (`schema.json`, `req.dados`)

**Modelo:** app declara tabelas; shell cria/reconcilia no boot, expõe API, aplica permissão por nível. Schema PostgreSQL próprio por app.

**PROÍBE:** SQL cru, abrir conexão/importar pool do shell, FK ou acesso a tabela de outra app. **PERMITE:** `req.dados`, `req.modulos`, FK para `shell.usuarios` e para tabelas expostas de módulos.

### Formato
`{ "tabelas": { "<tabela>": { "acesso_externo": "...", "colunas": {...}, ... } }, "sql_declarado": {...}? }` — nomes `snake_case`, sem prefixo de app.

**Tipos de coluna:** `texto` (VARCHAR, `limite`), `texto_longo`, `inteiro`, `decimal` (`precisao` 10, `escala` 2), `booleano`, `data` (string `YYYY-MM-DD`, nunca `Date`), `datahora` (TIMESTAMPTZ; string ISO), `json` (JSONB), `referencia` (FK para o `id` do alvo), `arquivo`, `segredo` (cifrado AES-256-GCM; app escreve e nunca lê de volta), `geometria` (**só módulo** com PostGIS).

**Propriedades de coluna:** `tipo`, `obrigatorio`, `unico`, `padrao`, `limite`, `opcoes` (vira CHECK/enum), `tabela_ref`, `ao_deletar` (`cascata|anular|restringir`), `campos_incluir` (`"nome as autor_nome"` → LEFT JOIN automático), `precisao`, `escala`, `formato` (regex ≤200, sem `\`; SDK 94), `intervalo` `{min,max,min_exclusivo,max_exclusivo}` (SDK 94), e para `arquivo`: `mimes`, `tamanho_max_mb`, `multiplo`, `publico`.

**Propriedades de tabela:** `colunas`; **`acesso_externo` (OBRIGATÓRIO, sem default): `completo | somente_leitura | restrito`**; `unicos` (grupos de colunas; objeto `{colunas, onde, nulos_distintos}` para único parcial); `indices`; `referencias` (FK composta); `soft_delete`; `id_legivel` (`"{nome} ({cpf})"`); `busca_texto` `{colunas, idioma}`; `segregada_por_conta`; `pessoal`; `subtipo_de`/`discriminador`/`valor_discriminador` (herança de um nível).

**Colunas automáticas — PROÍBE declarar:** `id` (serial), `criado_em`, `atualizado_em`; com soft delete `removido_em`, `removido_por_id`; em tabela segregada `conta_id`. Escrever `removido_*`/`conta_id` no body → `422 DADOS_CAMPO_RESERVADO`.

`segredo` não entra em `unicos`, `indices`, `referencias`, `id_legivel`, `campos_incluir`, nem aceita `obrigatorio/unico/padrao/opcoes/limite`; não é filtrável/ordenável; lista devolve máscara; só `req.dados.revelar` mostra.

### API genérica `/api/dados/<app>/<tabela>`
- `GET /` lista, `POST /`, `GET /:id`, `PATCH /:id`, `DELETE /:id`. **Gate só por nível de app:** leitura→GET, escrita→POST/PUT/PATCH, **admin→DELETE**.
- Filtros: `?col=v`, `?col=a,b` (IN), `?col[gt|gte|lt|lte|neq]=v`, `?col[busca]=x` (ILIKE sem acento), `?col[nulo]=true|false`, `?texto=` (full-text se `busca_texto`).
- `?ordenar=<uma coluna>&ordem=asc|desc` (default `criado_em DESC`; **sem ordenação multi-coluna**), `?pagina=&por_pagina=` (default 20, máx 100) → `{dados,total,pagina,por_pagina,paginas}`; há cursor pagination. `?incluir=rel,rel.sub` (2 níveis). Palavras reservadas na query: `ordenar, ordem, pagina, por_pagina, limite, incluir, distinto, removido`.
- A rota genérica **não conhece** permissão fina (dono, membro, linha). Tabela com qualquer regra além do nível → `acesso_externo: "restrito"` + rotas customizadas com `req.dados`. `req.dados` ignora `acesso_externo`.

### `req.dados` (backend)
`listar`, `buscar` (null se não achar), `criar`, `atualizar`, `deletar`, `revelar(tabela,id,coluna)`, `remover`/`restaurar` (soft), `transaction(trx=>…)`; vocabulário estendido (shell 0.53.3): `travessia`, `existe`, `atualizarVarios`, `removerVarios`, `deletarVarios`, `atualizarSe` (lock otimista), `criarOuAtualizar` (chave tem de ser `unico/unicos`), `varrerTudo`, `incrementar` (SDK 93), `buscar(...,{travar:true})`, `busca_ou`, `sqlDeclarado`; só em migração: `limparColuna`, `limparTabela`. Seletor de lote vazio lança. Rota que repassa `por_pagina` deve limitar com `Math.min(…,100)`.

### Teto do framework (subset deliberado de SQL)
Degraus: (1) vocabulário; (2) `sql_declarado`; (3) banco próprio. **Fora por contrato:** JOIN livre de N tabelas, união de caminhos alternativos, estatística além de contar/somar/média por grupo, consultas recursivas. `sql_declarado` = um SELECT/WITH somente leitura, parâmetros `:nome` por bind, sem `shell.*`, sem `;`, só funções da allowlist; devolve array cru (não vira endpoint).

### Soft delete
`soft_delete: true` por tabela (use só com motivo de histórico/restauro; tabela de junção pura fica hard). `PATCH /{tabela}/{id}/remover` e `/restaurar` (nível `escrita`, idempotentes); `DELETE /:id` = hard delete (admin). GET lista só vivos (`?removido=incluir|apenas`); `GET /:id` de removido → 404. Restaurar que viola único → `409 DADOS_UNIQUE_VIOLADO`. Remover soft-delete não toca anexos.
**Consequência para a spec:** "autor com `escrita` apaga o próprio registro" = modele como `PATCH …/remover`, nunca `DELETE`.

### Reconciliação no boot (converge nos dois sentidos)
Cria/aperta/afrouxa tabela, coluna, FK, único, índice, CHECK, DEFAULT; poda o que ficou órfão **e vazio**. Aperto barrado por dado legado vira pendência (app `!saudavel` com receita). Remover coluna/tabela **com dado** → erro: escreva no mesmo release migração que esvazia. **Fora de escopo:** mudar `tipo`/`limite`/`precisao` (crie coluna nova, migre, remova a antiga). Migração de app só toca dados via helpers; estrutura nunca em migração. Ciclo de FK entre ≥2 tabelas é recusado. Tirar `soft_delete` com tombstones deixa a app `!saudavel`.

### Outros contratos
- `pessoal: true` (SDK 94): tabela de estado do próprio usuário; exige coluna `usuario_id` (`referencia` a `shell.usuarios`); só ela aceita escrita pelas rotas `/pessoal/*`; sem `arquivo`/subtipo.
- `shell.usuarios` é a única tabela do shell referenciável; leitura pela view `shell.vw_usuarios` (`id, nome, avatar_url, ativo`; sem `tipo`).
- Erros: `DADOS_VALIDACAO_FALHOU` 422, `DADOS_REFERENCIA_INVALIDA` 422, `DADOS_UNIQUE_VIOLADO` 409, `DADOS_DEPENDENCIA_EXISTE` 409, `DADOS_REGISTRO_NAO_ENCONTRADO` 404.
- Exemplo mínimo:
```json
{ "tabelas": { "contratos": {
  "acesso_externo": "restrito", "soft_delete": true, "id_legivel": "{titulo}",
  "colunas": {
    "titulo": {"tipo":"texto","limite":200,"obrigatorio":true},
    "status": {"tipo":"texto","opcoes":["rascunho","ativo"],"padrao":"rascunho"},
    "valor":  {"tipo":"decimal","intervalo":{"min":0}},
    "autor_id": {"tipo":"referencia","tabela_ref":"shell.usuarios","campos_incluir":["nome as autor_nome"]},
    "pdf": {"tipo":"arquivo","mimes":["application/pdf"],"tamanho_max_mb":10} },
  "unicos": [["titulo"]] } } }
```

### Lixeira (grátis)
Para toda tabela `soft_delete`: aba **Lixeira** em Configurações (só admin da app): listar removidos, **Restaurar**, **Hard-delete** (dispara cascata de arquivos). Declare `id_legivel` para ficar legível. **Não existe:** purga automática, bulk, busca/filtro, preview, audit de quem restaurou, export.

### Arquivos (coluna `arquivo`)
- `multiplo` 1 → INTEGER; >1 → JSONB (array de ids). `mimes` aceita curinga (`image/*`). Limite global 50 MB (`URBIVERSO_UPLOAD_MAX_MB`) + blacklist de mimes executáveis; coluna só restringe. Sem quota por app.
- **Upload em 2 passos:** (1) `POST /api/dados/<app>/<tabela>/__upload?coluna=<col>` multipart, 1 arquivo/chamada → `201 {upload_id, expira_em}` (staging 10 min); (2) gravar o `upload_id` na coluna via POST/PATCH genérico ou `req.dados`. Só quem subiu vincula; mesma app/tabela/coluna.
- Download: `GET …/{id}/{coluna}/download` (permissão = a do registro pai); link externo por token (`?token=sset_…`). Em `restrito`: download direto `403`; sirva por rota própria com `req.arquivos.url(id, ttl)`. `inline` só pdf/png/jpeg/gif/webp; SVG/HTML/XML viram octet-stream.
- `req.arquivos`: `enviar`, `ler`, `lerMetadados`, `url`, `prorrogar`, `remover` (recusa coluna `obrigatorio`).
- **TTL é política do admin** (default 90 dias, alçada `operacao`); a spec **não** define retenção. Anexo de coluna `obrigatorio` nunca expira. **PROÍBE:** endpoint multipart próprio, `sendFile`, arquivo em subtipo/tabela `pessoal`.
- Spec deve dizer, por coluna: tipos aceitos, tamanho máximo, quantidade.

---

## 3. Usuários, permissões, alçadas, autenticação

### Usuário
Todo caller é um **usuário**, com dois eixos independentes:

- **`tipo`** (esfera e teto de poder; régua `externo < colaborador < dono < operador < sysadmin`):

| tipo | Admin | Nível numa app |
|---|---|---|
| `externo` | nunca | só `permissao_padrao_externo`, e só se a app declara `aceita_externos: true`; sem grant individual; teto `escrita` |
| `colaborador` | só abas das alçadas que tiver | maior entre `permissao_padrao` e grant individual |
| `dono` | inteira (11 alçadas de produto) | igual colaborador, sem bypass |
| `operador` | só alçadas concedidas (staff Urbiverso; nasce sem nenhuma) | só grant individual |
| `sysadmin` | inteira (12 alçadas) | só grant individual |

- **`natureza`** só define protocolo/apresentação: `humano` (Slack OAuth, e-mail/senha, ou token; notificações inbox/Slack/e-mail/push/SSE), `openclaw` (agente externo; token; inbox + webhook), `servico` (integração de API; token; só inbox). Existe também agente interno.
- **Agente é usuário de primeira classe:** pode ser sysadmin, dono, externo, receber alçadas/roles, ser membro de conta. **PROÍBE segregar por natureza** em regra, rota, tela ou gate. Nunca escreva "só humano pode X"; o eixo certo é `tipo`, permissão ou credencial.
- Ser admin da instância ou ter alçada **não dá acesso a nenhuma app**: precisa de permissão de app explícita.
- Na rota de app, `req.contexto.usuario.tipo` e `.natureza` valem sempre `'nao_informado'` (de propósito); a app também não vê alçadas nem credencial.

### Permissões por app (4 camadas, em cadeia)
1. **Alçada** (administra a instância) → 2. **Nível de app** `nenhuma < leitura < escrita < admin` → 3. **Roles** do manifesto → 4. **Permissão por objeto** (opcional; da app).

- `permissao_padrao` (`nenhuma|leitura|escrita`; teto `escrita`) vale para todo o produto; **`admin` é sempre grant individual** (feito por quem tem alçada `usuarios`).
- **Contrato método→nível (a app não afrouxa, só restringe):** `GET/HEAD`→`leitura`; `POST/PUT/PATCH`→`escrita`; `DELETE`→`admin`; `OPTIONS` livre; outro método `405`; insuficiente `403 AUTH_NIVEL_INSUFICIENTE`.
- **Roles:** `roles: {leitura:{slug:"descrição"|{descricao,sticker}}, escrita:{…}, admin:{…}}` (equipe) e `roles_externos: {leitura:{…}, escrita:{…}}` (**sem `admin`**). Slugs únicos entre os dois blocos (senão a app não registra). O role **refina, nunca eleva**; `nivelApp: admin` **não** confere roles de `escrita/leitura` (admin precisa se autoatribuir; tela gateada só por role pode ficar invisível ao admin). Role de um bloco nunca chega ao outro (`403 ROLE_PUBLICO_INCOMPATIVEL`). Para gatear comportamento de externo, use role que só existe em `roles_externos`.
- **Superpoderes por papel** (apontam para role declarado): `acesso_irrestrito.papel` (equipe; atravessa todas as contas), `provisiona_externos.papel`/`papel_externo` (convite de externo), `altera_plano.papel_externo`. Evite para lógica de negócio.
- **Rotas pessoais** (SDK 94): export `rotasPessoais` em `/api/<app>/pessoal/*`; escrita liberada a partir de `leitura`; `req.dados` só grava em tabela `"pessoal": true` e na linha do próprio usuário (`ROTA_PESSOAL_*`); sem `req.eventos/notificacoes/ia/wiki/modulos`. Para marcador "lido até", preferências, ordem de sidebar.
- **O que a app lê:** `req.contexto = { usuario:{id,nome,avatar_url,…}, nivelApp, rolesApp[], fuso (IANA), conta, plano, privilegios }`. Helpers `req.shell`: `listarUsuariosPorRole(role)`, `nivelEfetivoUsuario(id)`, `urlApp(sub)`. Ao referenciar outro usuário em dado próprio (responsável, membro), chame `nivelEfetivoUsuario` e recuse `422` se `'nenhuma'`. Frontend: `urbiVerso.usuario()`, `urbiVerso.contexto()` (`carregado:false` = ainda carregando; `carregado:true,nivel:null` = sem acesso), evento `urbi:contexto-app`.
- `urbi-select-usuarios permissao-minima="leitura"` só serve a interno (externo toma 403); use `publico_alvo` (`interno|externo`), não o tipo.
- **Permissão por objeto:** tabela de associação própria (ex. `projeto_membros{projeto_id, usuario_id, funcao}`) + módulo de permissões nas rotas custom; **obriga** trancar o CRUD genérico dessa tabela (`acesso_externo: "restrito"`). Nunca eleva além do nível de app.
- **PROÍBE** decidir permissão por `usuario.tipo`, `natureza` ou "veio por token". Fonte de verdade: `nivelApp` + `rolesApp`; escopo de dado: `usuario.id`.

### Alçadas (administração da instância; conjunto fechado de 12)
`usuarios` (usuários, tipos, alçadas, nível de app, tokens), `contas` (contas, membros, planos), `integracoes` (wiki, IA, domínios de e-mail), `marcas` (branding), `nucleo` (autorizar entidades de módulo; **único gate das telas/API de cada módulo**), `apps` (instalar/atualizar/ligar/desligar/desinstalar apps; é poder de executar código), `operacao` (Faxina, inventário de arquivos, TTL, fuso, rate limit), `sistema` (deploy, upgrade, reinício), `seguranca` (URL pública, modo seguro, OAuth, e-mail de sistema), `suporte` (Sentinela, ordens de serviço), `auditoria` (ler a trilha; só leitura), `plataforma` (só operador/sysadmin).
- **A app não declara nem checa alçada.** Funcionalidade administrativa da app = `nivelApp = admin` ou role. Módulo (não app) usa `nucleo`.
- Regras: só se concede alçada que se detém; ninguém age sobre alvo mais poderoso; externo nunca recebe alçada; sysadmin = 12 por definição; **dono** da instância (lado do cliente) = 11 de produto.

### Autenticação — a app NUNCA implementa
Login, cadastro, sessão, verificação de token, reset de senha: tudo do shell. Request chega autenticada com `req.contexto`. Sem credencial `401`; sem permissão `403`. Não leia `Authorization` na app.
- Humano: Slack OAuth (primário) + e-mail/senha; sessão cookie httpOnly 7 dias.
- **Token Bearer** (`urbi_<64 hex>`) para agente/serviço/script: vinculado a um usuário; herda `nivelApp`, roles, conta; alçadas por escopo próprio cravado na emissão; opcional `somente_leitura` (bloqueia escrita) e `expira_em`; todo usuário interno emite os próprios em `/preferencias`.

### Contas (tenancy)
Externo pertence a exatamente 1 conta (permanente); interno 0..N. Isolamento por tenant é opt-in (§4). **Obriga:** app que aceita externos deve escopar dado por `usuario.id` (ou usar segregação por conta).

---

## 4. Segregação por conta (multi-tenancy)

- `"segregada_por_conta": true` na tabela → coluna `conta_id` injetada + **RLS no PostgreSQL** (FORCE ROW LEVEL SECURITY). Basta **uma** tabela para a app inteira entrar no regime.
- **Obriga/impõe:** `unico/unicos` viram compostos com `conta_id`; `referencia` entre tabelas segregadas vira FK composta; **PROÍBE SQL cru e o pool em toda a app** (só `req.dados`); `req.dados` segregado fica inoperante em handler de `wh`.
- **Resolução (o shell resolve):** ESCOPADO (contas em que o usuário é membro), IRRESTRITO (só via `acesso_irrestrito.papel`), SISTEMA (rotinas/listeners/hooks: lê tudo, escreve endereçado via `dados.comConta(contaId, …)`; `ctx.contas.listarAtivas()`), NEGAR (lista vazia; a UI deve mostrar vazio explicável).
- **Escrita exige conta destino única:** com N contas ou IRRESTRITO, header `X-Conta`; sem ele `400 CONTA_NAO_INFORMADA`. Seletor: `GET /api/shell/contas/minhas` / `urbiVerso.contexto()`.
- Membership é binária (sem graduação). Papéis finos = 4ª camada da app. Fronteira dura entre atores exige contas distintas. Conta inativa corta os externos dela. Conta nasce por ato da instância (alçada `contas`); app só provisiona externo com `provisiona_externos`.
- **Quando usar:** SaaS/portal multi-tenant em que vazamento entre tenants é incidente. **Não usar:** app interna sem tenants; refinamento por dono/papel/sub-conta; modelo incerto; necessidade de SQL cru. É **de mão única** (adotar tabela populada exige migração de backfill; framework nunca desliga RLS sozinho). Tabela não segregada com dado de conta é erro do dev (externo vê todas as linhas dela).

---

## 5. Frontend da app

- Web Component `app-<pasta>` em Lit (decorators; `experimentalDecorators: true`, `useDefineForClassFields: false`). O shell faz `import()` ao navegar. Estende `LitElement` (não `UrbiPageBase`); raiz com altura natural.
- **Build:** esbuild gera `frontend/index.js` (ESM, `--external:@urbiverso/ui`) e `backend/rotas.js` (ESM **self-contained**, `--minify`, banner `createRequire`). **Proibido import de valor de `@urbiverso/ui`** na app (só `import type`; os `urbi-*` vêm por tag, registrados globalmente) — reprova em CI/empacotamento/instalação/boot. Sem `instanceof` cruzando shell↔app (compare por `name`/`codigo`).
- **API no frontend:** `urbiVerso.api('/rota')` (caminho relativo à app, **sem o slug**; injeta `/<appId>`; decodifica JSON, lança em não-2xx com `status`, `codigo`, `detalhes`, `erros`, `id`). Dados genéricos: `urbiVerso.api('/dados/<app>/<tabela>')` (nada injetado). `urbiVerso.fetch()` para `Response` cru (download/stream). `{anonimo:true}` para rotas públicas. Módulos: `urbiVerso.modulo('<slug>','/rota')`.
- **Restart da instância:** o shell trata sozinho (banner global; GET repetido com backoff; escrita **nunca** reenviada → rejeita `PLATAFORMA_REINICIOU`). A app não mostra toast de 502.
- **Navegação:** a app é SPA dentro do SPA; 1º segmento = `appId`; resto é sub-rota da app. Helpers: `subRota()`, `href(sub)`, `navegarSub(sub)` (chamar pelo objeto), `escutarRota(cb)`. Sem `replace`/`state`. Link = `<a href=${urbiVerso.href(…)}>` + interceptação do clique simples. Tenha sempre fallback de rota desconhecida (não há 404 do shell).
- **`nav` (manifesto):** `NavItem{titulo, rota("/x"), icone("fa-solid fa-inbox"), itens[]}`; folha **ou** grupo; máx 20 itens, 2 níveis. Shell injeta **Home** primeiro e **Configurações** (só admin) por último. No mobile só pelo dropdown do nome da app.
- **Feedback imperativo:** `urbiVerso.notificar()` (toast), `confirmar()`, `prompt()`, `alertar()`, `formulario()` (SDK 93). **PROÍBE** `alert/confirm/prompt` nativos.

### Framework de UI (constituição)
- `urbi-*` e tokens semânticos são o **default** (app autenticada e tela de módulo). `ui: false` desliga só a *validação*; primitivos/tokens continuam. Global: sem opt-out por rota.
- **Obriga:** telas só com primitivos `urbi-*`; cor/fonte/espaço por token ("papel, não aparência": `urbi-botao variante="primario"`, `urbi-banner variante="erro"`, `urbi-prosa papel="fraco"`).
- **PROÍBE:** `style=`/CSS inline de apresentação; `static styles` de conteúdo; cor/borda/fonte/sombra/raio literais (alpha só com `color-mix()`); `div` com `display:flex/grid/height/overflow/position` (use `urbi-stack`, `urbi-linha`, `urbi-hospedeiro`, `urbi-2x1`…); `:host` estrutural em app/módulo; reimplementar primitivo; emoji como ícone; `<i class="fa-…">` cru; spinner próprio.
- **Exceção nomeada:** componente de domínio ultra-específico (funil, palco) como HTML próprio, com linha no registro de exceções no mesmo PR; o reutilizável vira primitivo novo. **A spec deve declarar lacunas** de primitivo.
- Fill de altura: filho declara `[expandir]`; eventos custom com prefixo `urbi:`. Mobile: layout adapta sozinho (≤900px o fill morre e o conteúdo rola).
- **Temas:** `dark, light, sepia, cyberpunk, filhos`, por usuário e default por instância; tokens `var(--cor-*)` sem fallback. **Branding** (nome, tagline, logos, favicon, fundo de login) é da instância (alçada `marcas`); a app só herda.
- **Ícones:** `<urbi-icone icone="inbox" familia="solid|regular|brands">` (só estilos solid/regular/brands, FontAwesome free; subset dinâmico, nada a instalar).

**Catálogo `urbi-*` (nomes, por função):**
- *Layout:* `tela-cheia`, `centralizado`, `shell-page` (só shell), `inbox`, `trilho-atalhos`, `2x1`, `grid-2x2`, `grid-3x2`, `grid`, `3-colunas`, `abas`, `wrap`, `stack`, `linha`, `hospedeiro`, `moldura`, `modal`, `superficie`, `ficha`.
- *Dados/conteúdo:* `tabela`, `planilha` (grade editável, cola do Excel), `lista`, `arvore`, `kanban`, `categorizador`, `inbox-lista`, `kpi`, `grafico-colunas|linha|area|pizza|medidor`, `mapa-de-calor`, `espelho`, `prosa`, `markdown`, `navegador-json`, `lista-alteracoes`, `changelog-release`, `chat`, `redator` (@menção, anexos, microfone), `feed`, `reacoes`, `card`, `nav`, `canal-slack`.
- *Formulário:* `input`, `input-numero`, `input-segredo`, `input-data`, `input-hora`, `input-data-hora`, `input-score`, `textarea`, `editor-markdown`, `select`, `select-usuarios`, `seletor-objeto`, `seletor-arquivo`, `checkbox`, `toggle`, `slider`, `chips-atalho`, `botao` (`primario/secundario/perigo/sucesso/fantasma/texto`), `botao-alternar`, `botao-voltar`, `dropdown`, `menu-contexto`.
- *Feedback:* `badge`, `banner`, `toaster`, `confirmar`, `prompt`, `formulario`, `alerta`, `loading`, `spinner`, `estado-vazio`, `bolinhas`, `timer`.
- *Mídia:* `avatar`, `avatar-lista`, `icone`, `visualizador-arquivo` (PDF/imagem), `qrcode`, `mapa` (GeoJSON).
- *Legado/não usar:* `data-table`, `list-nav`, `issue`.

---

## 6. Módulos (dados compartilhados entre apps)

**O que são:** conteúdo com schema, rotas e versão próprios, consumido por várias apps. Identidade `{owner}/{repo}::{slug}`; **não têm usuários nem papéis**; tela própria em `/<slug>` visível só à alçada `nucleo`. Não existe editor genérico do shell para dado de módulo.

| Módulo | Identidade | Entidades |
|---|---|---|
| **pessoas** (obrigatório; sem ele a instância não sobe) v1.7.0 | `urbiverso/urbiverso::pessoas` | `pessoas`, `vinculos_conjugais` |
| **imobiliário** (instalável) v1.0.0 | `urbiverso/modulos-urbiverso::imobiliario` | `imoveis`, `parcelamentos`, `incorporacoes`, `matriculas`, `setores_habitacionais`, `transacoes` |

**Critério módulo × app × framework:** pessoa e imóvel **já existem como módulo** → **não crie tabelas próprias de PF/PJ/imóvel**; guarde só `pessoa_id`/`imovel_id` (FK ou id lógico). App = regra de negócio e UX com `nivelApp`/`rolesApp`. Framework = capacidade genérica já oferecida (dados, eventos, IA, e-mail…): use, não reimplemente.

### Declarar
```json
"shell_min": "0.53.10", "sdk_min": 90,
"dependencias": {
  "urbiverso/urbiverso::pessoas": { "versao_min": "1.1.0", "entidades": { "pessoas": ["ler","escrever"] } } }
```
- Entrada aceita só `versao_min` (obrig.) e `entidades` (objeto não vazio; flags `ler|escrever|remover|destruir`, sem repetição). **PROÍBE** conviver com `dependencias_nucleo`/`permissoes_nucleo` (contrato antigo, obsoleto) e usar `req.nucleo`/`urbiVerso.nucleo`.
- Flags: `ler`=GET; `escrever`=POST/PATCH/batch/sub-recursos; `remover`=soft delete/restaurar (nível escrita); `destruir`=DELETE hard (exige nível `admin` na app).
- **O manifesto é só pedido.** Quem libera é o **admin da instância**, por toggle (app × módulo × entidade × flag), na aba Núcleo da app; **toda flag nasce desligada**. A app sobe normalmente com flag desligada: a UI mostra banner informativo, nunca erro fatal. Erros 403: `NUCLEO_FLAG_NAO_PEDIDA`, `NUCLEO_FLAG_DESLIGADA`, `AUTH_NIVEL_INSUFICIENTE`. Dependência que não resolve na instalação → `422`.

### Consumir
- HTTP `/api/<app>/modulos/<slug>/…` (módulo não declarado → 404). Frontend `urbiVerso.modulo(slug, caminho)`; componentes do módulo por tag (ex. `<pessoas-nome pessoa-id="42">`) só garantidos se o módulo está em `dependencias`.
- Backend `req.modulos.<slug>`: `batch(entidade, itens)`, `buscarPorChave(…)`, `chamarSubrecurso(caminho, corpo)`, `atualizar(caminho, corpo)`. Erros são **exceções** (capture e `next(erro)`); `ehErroFlagNucleo`. Em migração: `ctx.modulos.pessoas.criarOuAtualizar` (PF por `cpf`, PJ por `cnpj`).
- **Referência de tabela de módulo no `schema.json`:**
```json
"pessoa_id": {"tipo":"referencia","tabela_ref":"pessoas.pessoas","obrigatorio":true,
  "ao_deletar":"restringir","campos_incluir":["nome as pessoa_nome","tipo as pessoa_tipo","removido_em as pessoa_removida_em"]}
```
  FK física; só `pessoas.pessoas` e `pessoas.pessoas_fisicas` são referenciáveis; exige módulo em `dependencias` + `ler`; `ao_deletar` só `restringir|anular` (nunca `cascata`); colunas expostas: `tipo` (`fisica|juridica`), `nome`, `id_legivel`, `removido_em` (1.1.0), `cpf`/`cnpj` (1.2.0). `campos_incluir` só funciona em superfície autenticada (não em rota pública, webhook, listener, rotina, migração). Imobiliário: só id lógico.
- **PROÍBE:** SQL no schema do módulo (`42501`); `req.modulos` em rota pública, webhook, listener, rotina, `aoIniciar` ou migração; frontend de módulo em página pública; usar módulo sem declarar.

### Modelo de pessoas (Party Pattern)
- `pessoas` (supertipo): `tipo` `fisica|juridica`; endereço opcional (`pais` ISO-2, `codigo_postal`, `estado`, `cidade`, `endereco`, `endereco_linha2`). Vínculos de outras entidades apontam sempre ao supertipo (`pessoa_id`).
- `pessoas_fisicas`: `nome`, `cpf` (obrigatórios); opcionais `nacionalidade`, `profissao`, `data_nascimento`, `nome_pai`, `nome_mae`, `doc_identidade_tipo` (`rg|cin|rne_crnm|passaporte|outro`) + `_numero/_orgao/_uf`, `solteiro_declarado`; `estado_civil` derivado e só leitura.
- `pessoas_juridicas`: `razao_social`, `cnpj` (obrigatórios), `nome_fantasia`.
- Contatos 1:N (e-mails e telefones de PF e PJ); e-mail/telefone únicos globalmente. CPF/CNPJ únicos entre pessoas vivas. Todas as entidades têm soft delete (exceto `vinculos_conjugais`, que se **encerra**).
- `vinculos_conjugais`: `tipo` (`casamento|uniao_estavel`), `regime_bens`, datas, `motivo_encerramento`; no máximo 1 vínculo ativo por pessoa. O módulo **não guarda histórico**: app que gera documento deve congelar a qualificação lida na hora.
- Tela do módulo pessoas (`/pessoas`, alçada `nucleo`): lista, ficha com contatos, CRUD, importação CSV em dois passos.
- Imobiliário (alto nível): `imoveis` (`tipo` `lote|gleba|unidade`), `parcelamentos`, `incorporacoes` (chave natural `slug`), `matriculas` (uf+cri+numero; referência ao cartório, não é fonte da verdade da propriedade), `transacoes` (pilha append-only ligando pessoas a imóveis), `imovel_pessoas` (ocupação).

---

## 7. Barramento de eventos, notificações, auditoria

### Declaração no manifesto
```json
"eventos": { "nova_mensagem": {
  "descricao": "…", "campos": ["proposta_id","autor","mensagem"],
  "conteudo": "Nova mensagem de {autor}",
  "api": "propostas/{proposta_id}/mensagens", "rota": "proposta/{proposta_id}",
  "auditavel": {…}, "segregado_por_conta": true } },
"erros": { "pedido_falhou": { "campos": […], "conteudo": "…", "api": "…", "rota": "…" } }
```
- `campos` = chaves **obrigatórias** do payload (fechado: ausente → `CAMPOS_AUSENTES`, extra → `CAMPOS_NAO_DECLARADOS`); `null` é valor válido (não invente sentinela). `conteudo` = template `{campo}`. `api` = GET que resolve o recurso (relativo vira `/api/{slug}/…`). `rota` = sub-rota de frontend. Em `erros`, `api` e `rota` são obrigatórios; `severidade` foi removida. Apps não declaram `paginas`. Evento sem superfície não deve existir.
- Tipos: `app.{slug}.{acao}`; erros `app.{slug}.erro.{acao}`. App só publica/agenda/inscreve em `app.{seu_slug}.*`. Nomes reservados já injetados (não declare): `listener_falhou`, `remessa_falhou`, `evento_rejeitado`, `iniciar_falhou`, `encerrar_falhou` (+ `ia_chamada`, `override_ia_removido` se `ia`; `email_envio_falhou` se `emails`) e eventos comuns como `sentinela_*`, `ingresso_wh_gerado`, `destino_remessa_alterado`, `notificacao_externos_alterada`; todo nome iniciado por `sentinela` é reservado.
- **O CRUD genérico não publica eventos**: quem publica é a rota custom, com payload enriquecido.

### `req.eventos`
`publicar(tipo, payload, {destinatarios?})`, `publicarErro`, `agendar(tipo, payload, {em: Date} | {recorrencia: 'cron 5 campos'})`, `cancelarAgendamento(id)`, `listarAgendamentos`. Agendamento: precisão de minuto, at-least-once, catch-up após downtime; desinstalar cancela pendentes; tipos auditáveis não são agendáveis. `destinatarios` recorta **só o SSE de tela** (máx 500; não é sigilo nem notificação). `shell.eventos` é efêmero (Faxina; ≥30 dias, default 365) — prova durável = `auditavel`. Nunca credencial/PII sensível em payload ou `conteudo`.

### `reagir` (listeners in-process)
`export const reagir = { nova_mensagem: async (evento, ctx) => {…} }`; só tipos da **própria** app; sem cross-app, sem listener de `erro.*`. `ctx = {eventos, shell, notificacoes, slack, dados?, arquivos?, ia?, email?, parametros?}`; **sem usuário**. Sem retry e sem ordem garantida: seja idempotente.

### Inscrições e notificações
- `inscreverUsuario(usuarioId, tipo, filtros, forca='forte', escopo='')`, `cancelarInscricao`, `cancelarInscricoesPorEscopo`, `listarInscricoes` (lançam `HELPER_EXIGE_CONTEXTO` em rota pública). `forte` vem da app (usuário só silencia); `fraca` vem do usuário (seguir); `automática` só para erros.
- `req.notificacoes.notificar(usuarioId, msg, {payload?, rota?, nome_sessao?})` (destinatário precisa ≥`leitura` na app); `notificarAdmins(msg)` (SDK 69). Máx 1 notificação por usuário por evento.
- Canais por natureza: `inbox` sempre; `slack/email/push` só humano; `webhook` só `openclaw`; `servico` só inbox. Externo recebe evento só se o admin ligou "notifica externos" (exige `aceita_externos`); **externo nunca recebe erro**. Leitura: `erro.*` só admin da app; demais `app.*` ≥`leitura`; sysadmin sem bypass.
- **Eventos segregados por conta** (`segregado_por_conta:true` no tipo; exige ≥1 tabela segregada): cada publicação endereçada a 1 conta; em listener/rotina/webhook passe `{conta_id}`; leitura só alcança quem resolve para a conta.

### Auditoria
Flag no tipo de evento: `"auditavel": {"categoria":"aprovacao","ator":{"id":"ator_id","desc":"ator_nome"},"alvo":{"tipo":"cliente","id":"cliente_id","desc":"cliente_nome"}}`. Categorias: `autenticacao, permissao, provisao, sistema, configuracao, mfa, impersonacao, aprovacao`. Garante trilha **append-only** selada por hash-chain, retida ~10 anos, nunca tocada pela Faxina; consulta só pela alçada `auditoria` (admin de app **não** consulta). **PROÍBE** `auditavel` em `*.erro.*`, publicação por HTTP, agendamento, PII sensível no payload. A mutação de negócio é anterior e best-effort (falha da trilha não a desfaz). Para valor legal: aprovação, consentimento, mudança de permissão.

---

## 8. Integrações: webhooks, remessa, disparadores, rotinas, páginas públicas

### Webhooks de entrada (`wh`) — caminho OFICIAL de escrita externa/anônima
```json
"webhooks": { "resposta_teste": { "modo":"uso_unico", "descricao":"…",
  "campos": { "respostas":{"tipo":"array","item":{"tipo":"string"},"obrigatorio":true},
              "mensagem":{"tipo":"string","descartar":true} } },
  "alertas": { "modo":"recorrente", "descricao":"…" } }
```
- `modo`: `uso_unico` (1 ingresso por contexto, consumido na 1ª chamada; expira 30 d default, máx 1 ano) ou `recorrente` (URL estável). Campos: `string|number|boolean|object|array`, `obrigatorio`, `exemplo`, `descartar` (não persiste no log; SDK 60).
- `POST /api/wh/:app_id/:token` (token `wh_`+64 hex é a única credencial; corpo JSON obrigatório). Gerar ingresso: `req.shell.gerarIngressoWh({webhook, contexto?, expira_em?})` → `{url, token, ingresso_id, expira_em}` (+ `revogarIngressoWh`, `listarIngressosWh`).
- Handler `export const webhooks = { nome: async (req,res)=>{…} }`; roda **anônimo** (nunca impersona o criador; `req.wh.criado_por` é só audit); a app responde; só 2xx consome o ingresso; timeout 30 s (504 sem abortar) → idempotência. Declarado sem handler = `quebrado`.
- **Arquivos (2 fases):** declare `"arquivos": {"tipos":[…],"tamanho_max_mb":10,"quantidade_maxima":1}` (V1: 1 arquivo); handler chama `req.shell.gerarUploadWh(…)` e devolve `upload.url` (TTL 10 min); cliente faz multipart em `/api/arq/{app}/{token}`; export `webhooks_upload` com a mesma chave deve associar `arquivo_id` à coluna `arquivo` via `req.dados.atualizar` (senão o staging é descartado).
- Admin da app gerencia em Config › Webhooks (toggle, gerar/revogar URL, log do payload por 90 dias).

### Remessa externa (saída; zero código na app)
Qualquer evento `app.{slug}.*` pode virar envio a um destino **cadastrado pelo admin da app** (a app não tem campo de manifesto/handler/helper para isso). Adaptadores: `webhook` (POST HTTPS assinado HMAC; leva só claim-check `{evento:{id,tipo,criado_em,url}, base_url}`, **sem payload**), `rotina_claude`, `slack` (conteúdo + deep link), `sentinela` (abre caso), `acionador` (aciona disparador de outra app). Fila com 6 tentativas (~4h24), at-least-once; esgotada publica `erro.remessa_falhou`. Projete `conteudo/api/rota` sabendo que os adaptadores os usam.

### Disparadores (app → app sem acoplamento; SDK 95, shell 0.56.26)
Receptora declara ações tipadas:
```json
"disparadores": { "criar_tarefa": { "descricao":"Cria tarefa",
  "campos": { "titulo":{"tipo":"texto","obrigatorio":true}, "prazo":{"tipo":"data"}, "responsavel":{"tipo":"usuario"} } } }
```
Tipos: `texto, inteiro, decimal, booleano, data (DataCalendario), datahora (Date), usuario ({tipo,id,nome}), lista, objeto`. Handler `export const disparadores = { criar_tarefa: async (req)=>{…} }` — sem `res`; lançar ou passar de 30 s = falha com backoff; `req.disparo.origem.disparo_id` → **obriga idempotência**. Fluxo: admin da **origem** cria destino `acionador` e mapeia campos → vira **proposta** → admin da **receptora** autoriza/rejeita/revoga (Config › Disparadores); sem autorização o destino é inerte; app/disparador/evento imutáveis após o 1º envio. App segregada por conta **não** pode ser receptora; evento segregado nunca aciona disparador.

### Rotinas (cron gerenciado)
```json
"rotinas": { "consultar_djen": { "titulo":"Consulta diária", "descricao":"…", "frequencia":"diaria" } }
```
`frequencia` ∈ `diaria|semanal|mensal`; admin define horário/dia no fuso da organização e liga/desliga (default 06:00 UTC; mensal dia 1–28; "Rodar agora"). Handler `export const rotinas = { nome: async (ctx) => ({ok:true, resultado:{…}}) }` (`ctx` como listener, sem usuário). Garantias: lock por rotina, catch-up (1 execução após downtime), timeout 15 min, falha não mata a série. **Obriga** handler idempotente e declaração + export. **PROÍBE:** frequência < diária (use `agendar` com cron), laço em segundos (use `aoIniciar`), one-shot (use `agendar`), reação a fato imediato (use evento).

### Páginas públicas
Duas declarações **independentes**:
```json
"rotas_publicas": ["/horarios","/agendar"],
"paginas_publicas": { "/visita": { "titulo":"Agende sua visita", "componente":"agendamento-visita", "permite_embed": true } }
```
- `rotas_publicas`: prefixo de segmento; ficam em `/api/pub/<app>/…`; exigem `export const rotasPublicas` (Router). **Só GET** (escrita anônima = `wh`). Sem `req.contexto.usuario`/`nivelApp`/`rolesApp`; sem `req.modulos`; helpers de inscrição e `lerThread/receberEvento/resolverUsuario` lançam `HELPER_EXIGE_CONTEXTO`. **A app deve filtrar o que é visível** (ex. `visivel_publico=true`); o shell não filtra. Throttling é da borda.
- `paginas_publicas`: URL `https://{instância}/{app}{caminho}`, **sem chrome do shell**, custom element do bundle da própria app, **não adota tokens de tema**; chamadas do componente com `{anonimo:true}`; endpoints chamados precisam estar em `rotas_publicas`.
- **Embed em `<iframe>`:** duas chaves — app declara `permite_embed:true` (SDK 79) **e** admin da app cadastra origens em Config › Páginas públicas; sem as duas, bloqueado.

---

## 9. Config da app

- Página Config só para `nivelApp = admin`; abas montadas pelo shell: `Parâmetros`, `telas_config`, `Manifesto`, `Usuários` (atribuir roles), `Arquivos`, `Schema`, `Planos`, `Lixeira`, e IA/Email/Slack/Wiki/Eventos/Webhooks/Disparadores/Rotinas/Páginas públicas conforme declarado.
- **`parametros` (zero UI):** `{ slug: { tipo, nullable?, padrao, descricao?, secret? } }`; `slug` `^[a-z][a-z0-9_]*$`; `tipo` ∈ `bool|numero|string|texto_longo` (sem objeto/array); `padrao` obrigatório exceto `secret`. O padrão é **vivo** (mudar `padrao` num release vale para quem nunca personalizou; valor personalizado congela até "Restaurar padrão"). `secret: true` só em `string`, **sem `padrao`**, cifrado, só lido via `req.parametros.obter()` (null até configurar → app degrada). `req.parametros.obter(slug)` / `definir(slug, valor)` (admin; `shell_min 0.53.20` com `padrao`). **Não use** para estado mutável (use `req.dados`), dado estruturado, nem config por usuário.
- **`telas_config`:** `{ chave: { titulo, descricao?, componente } }`; `componente` = tag do custom element registrada pelo `index.ts` da app; montado **sem props**; painel full-bleed envolto em `urbi-hospedeiro`; a página já exige admin. Use para listas editáveis, vínculos, regras de negócio.

---

## 10. Capacidades opcionais (por capacidade: app declara → admin autoriza → helper pode vir `null`/erro — **a app deve tratar a indisponibilidade**)

### IA — `"ia": true` ou `{"slots": {"<nome>": {"titulo","base","descricao"}}}`
- A app envia contexto + **JSON Schema** e recebe JSON; nunca vê chave/provedor/modelo. Slots pedíveis: `poder` (raciocínio crítico, caro), `normal` (default), `barato` (volume/lote), `arquivos` (PDF/imagem), `audio` (STT), `classificador` (probabilidade medida); `gera_imagem` sem API. Backups são failsafe, não pedíveis. Cascata cai para o degrau abaixo.
- Quem configura: admin da instância (Admin › IA: provedor/chave por slot; autorização app × slot) e admin da app (Config › IA: override com chave própria, limites, histórico).
- `req.ia`: `consultar({contexto, schema, slot?, instrucoes_sistema?, modelo?, cache?})` → `{dados, modelo, tokens_entrada, tokens_saida, duracao_ms}`; `extrairConteudo` (texto UTF-8/PDF/imagem); `transcrever` (≤5 MiB/180 s); `classificar` (perguntas `sim_nao|escolha|escala`; resposta + probabilidade) e `classificarPorTexto`; `estadoSlot(slug)` (sonda sem custo); variantes `*Async` (fila com retry ~31 h; exigem `aoConcluir:{evento}` com o **evento declarado em `manifesto.eventos`**).
- Limites: contexto+instruções ≤ **512 KB** (`ENTRADA_MUITO_GRANDE`), saída ≤ 16000 tokens (`RESPOSTA_TRUNCADA`); decida por `codigo`, não por mensagem. **A spec não pode depender só do classificador nativo** (instância sem conta não o configura): sonde `estadoSlot('classificador')`, caia para `classificarPorTexto` e persista o `caminho`/`modelo` que gerou o dado.
- **PROÍBE/não usar para:** agente autônomo com tool use, texto livre sem schema, geração de imagem, áudio longo/TTS, chamar provedor direto. Microfone pronto: `urbi-chat audio` / `urbi-redator`.
- Na spec descreva: slots usados e por quê, contexto de entrada, formato JSON de saída, e o comportamento degradado.

### E-mail — `"emails": true`
Remetente/domínio **não** ficam no manifesto: admin da instância configura domínios e autoriza a app por domínio; admin da app define remetente em Config › Email. `req.email.enviar({dominio, tipo:'aviso', assunto?, titulo, corpo (markdown), cta?, dados?, para, cc?, bcc?, replyTo?})` → `{email_id, status:'enfileirado'}` (assíncrono). Limites: corpo 50 KB, dados 16 KB, 50 destinatários. `dominiosDisponiveis()`. **Não usar** para notificação interna (use barramento), mailing em massa, 2FA/criticidade alta (best-effort).

### Slack
`req.slack`: `notificar({texto, canal, blocos?, thread_ts?})` (`canal` = **ID cru** C…/G…/D…, não `#nome`; devolve `{ok:false,codigo,erro}` em falha), `lerThread(canal, threadTs, …)` (DM recusada), `receberEvento()` em handler de webhook (HMAC; SDK 45 + shell 0.53.25), `resolverUsuario(slackId)`, `resolverNomeCanal`. Config por app (Slack ativo, token/signing secret próprios opcionais); a app não guarda canal em config — o destino é escolhido pelo código.

### Wiki (MediaWiki) — `"wiki": {"leitura": true, "escrita": true}`
`escrita` implica `leitura` (declare o mínimo). Efetivo = manifesto ∩ toggle do admin. `req.wiki` é `null` se inativo → app deve tratar (503). `ler`, `buscar`, `renderizar`, `escrever(titulo, wikitext, {comentario obrig., …})`, `siteinfo`. Permissão por `nivelApp` (`leitura` lê; `escrita`/`admin` escrevem). Fora do escopo v1: upload binário, mover, renomear, deletar. Descreva na spec: páginas (padrões de título), quando edita, se precisa escrever.

### Ajuda e feedback (a app ganha de graça — **não implemente**)
Widget "?" na topbar: documentação (`/{appId}/docs`, de `apps/<nome>/docs`), "Detalhes do app" (gerado do manifesto: versão, descrição, roles com sticker), reportar bug, sugestão e casos no **Sentinela** (caso local, triagem por IA, curadoria do admin, escalada ao GitHub, Ordem de Serviço). Bug/sugestão aparecem só se o admin ligou o Sentinela no escopo; externo não vê reporte. Casos automáticos por evento via destino de remessa `sentinela`. Implicação: **não** especifique tela de bug/sugestão/"sobre"; mantenha `descricao`, descrições de `roles` e `docs/README.md`.

---

## 11. Distribuição, versão e instalação

- **Onde a app vive:** repositório próprio (padrão; também em `apps/<appId>/`, um repo pode ter várias apps/módulos; compila contra o `@urbiverso/sdk` **publicado**) ou monorepo da plataforma (bundled; não é o caminho de apps novas). Quem escreve app usa o **bundle do SDK instalado** como referência de contrato, nunca o `main` do monorepo. Teste de app é na instância **intermediária**, não na de desenvolvimento.
- **Pacote:** `<appId>-<versao>.urbiapp.tgz` + `.sha256`; só runtime: `manifesto.json`, `backend/rotas.js` (self-contained, Node 20+), `frontend/index.js` + assets, `schema.json`, `migracoes/`, `docs/`. Nunca `.ts`, `node_modules`, `package.json`, `tsconfig`, `specs/`. Empacota com `urbi-empacotar`; release com `urbi-release` (tag `<slug>-a<versao>_<sha8>`).
- **Instalação** em Admin → Instaláveis → Apps (alçada `apps`): release GitHub, servidor de distribuição (`urbihub` v1) ou upload do tarball. **Reprova com `422`** (versão antiga intacta): checksum, nome, manifesto, `shell_min`/`sdk_min` acima da instância, `schema.json` inválido, dry-run de schema contra o banco vivo, migração que não parseia, dependência de módulo que não resolve, identidade (`IDENTIDADE_NAO_CONFERE/DIVERGENTE/NAO_VERIFICAVEL`), downgrade. Upload de tarball **não verifica** identidade e nunca sobrescreve app verificada.
- **Quebra retroativa:** aditivo é livre (mas cunha piso). Remover/alterar contrato existente exige janela de obsolescência (aviso → erro → gate nas portas), sem exceção por urgência. Rota administrativa gateada por alçada pode sumir sem janela.
- **Infra de host (egresso):** o `fetch()` global do backend obedece a um proxy de egresso configurado pelo admin (`nenhum campo na app`); clientes sobre `node:http(s)` (axios, got) **não** passam por ele. Documente no README da app se um destino exige o proxy.
- Isolamento: apps no mesmo processo; app que precisa de isolamento máximo/dado sensível implementa a própria camada de dados com credenciais separadas.

---

## 12. Checklist — o que a SPEC deve explicitar (e o que não deve inventar)

**Deve declarar**
1. Nome da pasta (`snake_case`, não reservado), `nome`, `descricao`, `identidade`, pisos `shell_min`/`sdk_min` coerentes com o que usa.
2. Públicos: só equipe? aceita externos (`aceita_externos`, `permissao_padrao_externo`, `roles_externos`)? Multi-tenant (`segregada_por_conta`, com a consequência "sem SQL cru")?
3. `permissao_padrao` e roles por nível (slugs únicos; descrições legíveis). Mapa ação → método HTTP → nível; **remover = `PATCH`/soft delete**, `DELETE` só admin.
4. Tabelas: tipo de cada coluna, `acesso_externo` por tabela, únicos, índices, `soft_delete`, `id_legivel`, arquivos (tipos/tamanho/quantidade), `segredo`, referências a pessoas/usuários (FK ou id lógico).
5. Consultas que excedem o vocabulário (JOIN livre, recursão, estatística complexa) → decidir `sql_declarado`/degrau 3 já na spec.
6. Eventos (campos, `conteudo`, `api`, `rota`, auditável?, segregado?), erros, quem é notificado e por qual canal; `agendar` vs `rotinas` (frequência ≥ diária).
7. Entradas externas (`wh`: modo, campos, arquivos), saídas (remessa é configuração do admin), integração com outra app (disparador tipado + idempotência), páginas/rotas públicas (só GET; filtro de visibilidade; embed).
8. Telas: lista de telas e `nav`; componentes `urbi-*` que cobrem cada uma; **lacunas** de primitivo/exceções de UI; comportamento mobile; estados vazio/carregando/sem acesso/flag de módulo desligada.
9. Parâmetros declarativos vs telas de configuração; segredos por app (`parametros secret`) vs por registro (`segredo`).
10. Uso de IA/e-mail/Slack/Wiki com o **comportamento degradado** quando o recurso não está autorizado/configurado.
11. Dependências de módulo (`dependencias`, flags mínimas, `versao_min`) e o que acontece com flag desligada.

**Não deve inventar** (a plataforma já resolve ou proíbe)
- Login/SSO/cadastro/reset de senha, tela de "ajuda/sobre/bug/sugestão", tabelas próprias de pessoa/imóvel, editor genérico de dado de módulo, retenção de arquivos (TTL é do admin), configuração de remessa/branding/temas, alçadas novas (a app só tem `nivelApp`/`rolesApp`), regra por `natureza` (humano/agente) ou por `usuario.tipo`, comunicação direta entre apps, SQL cru, ordenação multi-coluna na API genérica, listener de evento de outra app, escrita anônima fora de `wh`, mutação de `tipo/limite/precisao` de coluna in-place (exige coluna nova + migração), CSS/estilo próprio fora do registro de exceções.
