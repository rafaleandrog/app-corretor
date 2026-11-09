# Issue #176: contraste medido na homologação "pinguim" (app 0.1.51, shell 0.56.37, 09/11/2026)

Só leitura, Playwright com a base de `scripts/conferencia-visual/capturar.mjs` (`CONTA=7`, Corretor A (demo)). Toda chamada à instância que não fosse GET/HEAD era abortada no navegador (nenhuma tentada). Fonte do sistema (Google Fonts bloqueado). Tema do usuário: `light`. O escuro foi medido trocando só o `data-theme` do `<html>` no navegador (nada gravado). Capturas `<tela>-<tema>-<largura>x<altura>.png`; `prova-*` é a troca `fraco` → `dica` aplicada no DOM vivo; `Menu-*` tem o menu da app (o `nav` do shell) aberto. Dados em `medidas.json`.

**Método.** Estilo computado de cada texto visível. O fundo efetivo é a composição dos alfas pela árvore composta (`assignedSlot`/host) até a primeira camada opaca. A cor do texto (também com alfa) é composta sobre esse fundo, e o contraste sai pela fórmula WCAG 2.x (luminância relativa). Não usei o pixel mais escuro. O botão primário não foi medido: o fundo dele é um gradiente.

## Fundo das colunas

A moldura é `urbi-3-colunas` com `urbi-hospedeiro` (`frontend/moldura.ts`). Nenhuma tela usa `urbi-inbox`: há só um comentário antigo em `estudio.ts`. O `urbi-3-colunas` e o `urbi-hospedeiro` não pintam nada. As três colunas mostram o `div.conteudo` do `urbi-shell-page`, que é opaco e pinta `--cor-fundo`:

| Tema | Coluna (fundo da página) | Cartão `urbi-card` (`--cor-superficie` sobre ele) | Guia § 1 |
|---|---|---|---|
| claro | `#F2F4F7` | `rgba(13,27,42,.04)` → `#E9EBEF` | colunas e cartões `#FFFFFF` sobre `#F4F3EF` |
| escuro | `#0D1B2A` | `rgba(255,255,255,.04)` → `#172433` | — |

O véu translúcido do `urbi-inbox` (`div.layout` .04, `detail-pane` .05) já não está na tela. A diferença para o guia continua: a coluna tem a cor do fundo da página e o cartão é mais escuro que ela (a superfície do tema claro é um véu escuro, não branco).

## Contraste (antes de mudar o código)

| Texto | Claro (coluna · cartão) | Escuro (coluna · cartão) | Dono da cor |
|---|---|---|---|
| `urbi-prosa papel="fraco"` (secundário da lista de Clientes "(61) 99000-0101 · Comprador", linha de Imóveis, metas da ficha, rótulos de Ajustes, data de Hoje) | **3,10 · 3,04** | **3,78 · 3,70** | app (escolha do papel) |
| Aviso de IA na ficha ("IA indisponível agora: Resumir volta…", `papel="fraco"` num `urbi-card`) | **3,04** (deduzido: mesmo papel no mesmo fundo; a IA estava disponível, então o aviso não apareceu) | **3,70** (idem) | app |
| `papel="secundario"` (secundário da ficha) | 4,74 · 4,60 | 5,18 · 4,97 | primitivo |
| `papel="dica"` (12 px, `--cor-texto-sec`) | 4,74 · 4,60 | 5,18 · 4,97 | primitivo |
| Menu da app (`nav` do shell, item / título de seção) | 11,83 / 4,91 | 11,58 / 4,94 | shell |
| Rótulo do trilho | não existe mais (D-114: o menu é o `nav`) | — | — |
| `urbi-chips-atalho` inativo · **ativo** | 4,50 · **4,05** | 4,68 · 5,39 | shell |
| `urbi-badge` neutro · **de estado** (Quente, Morno, Frio, Feito, link ativo, Abordagem atrasada) | 4,50 · **3,69 a 4,08** (SUBSTITUÍDO pela seção Remedição da revisão: ver abaixo; remedido 3,02–4,15) | 4,68 · **3,74** (Quente, Sem resposta) a 7,11 (SUBSTITUÍDO: remedido 3,30–7,11) | shell |
| Iniciais do `urbi-avatar` | **3,76 a 4,05** | 4,83 a 5,39 | shell |
| Rótulo do `urbi-kpi` | **4,47** | 4,69 | shell |
| Submensagem do `urbi-estado-vazio` | **3,10** | 3,78 | shell |
| Versão na barra do shell | **3,16** | 3,80 | shell |

Os números são iguais em 1366×657 e 1440×1000: o fundo e a cor não mudam com a janela.

## Correção no app (0.1.58) e prova

As 88 ocorrências de `papel="fraco"` em `frontend/telas/` passaram a `papel="dica"`. O `dica` tem o mesmo tamanho (0,75rem) e usa `--cor-texto-sec`. No `fraco` não sobrou texto desabilitado, único uso que o token prevê. Prova no DOM vivo das cinco telas: o pior caso passou a **4,60** no claro e **4,97** no escuro (SUBSTITUÍDO pela seção Remedição da revisão: ver abaixo; 11 telas, pior caso 4,24 no Funil claro). A linha ficou 1 px mais baixa (17 → 16 px; 35 → 32 em duas linhas). `testes/contraste.test.ts` impede que o `fraco` volte.

O que fica abaixo de 4,5 é do shell (pedido 28).

## Remedição da revisão (PR #213)

Remedido em 09/11/2026 na "pinguim" (app 0.1.51, `CONTA=7`, 1366×657), só leitura: nenhuma chamada que grava foi tentada (lista de bloqueadas vazia). Dados em `medidas.json` › `remedicao_revisao`; capturas `remedicao-<tela>-<tema>-dica-1366x657.png` (o estado depois da troca `fraco` → `dica` no DOM vivo).

**Correção de método.** O texto de um `urbi-badge` fica no light DOM e herda a cor do `span.badge` da sombra, pelo `<slot>`. A medição anterior lia a cor do host (`rgba(13,27,42,.87)`), e por isso o selo aparecia a 10,97. Agora a cor de cada nó de texto vem do `<slot>` que o distribui (`assignedSlot`), e o fundo efetivo é composto a partir dali. Os textos fora da janela também contam.

### a) Selos de estado `urbi-badge` (cor do texto · fundo efetivo · razão)

| Selo (`cor`) | Onde | Claro | Escuro |
|---|---|---|---|
| Quente (`erro`) | linha da lista de Clientes (coluna) | `#BF492B` · `#EEE6E7` · 4,08 | `#D75D3D` · `#21222C` · 4,17 |
| Quente, Sem resposta (`erro`) | cartão (ficha, fila de Hoje, Negociações) | `#BF492B` · `#E5DEDF` · 3,78 | `#D75D3D` · `#2A2A34` · **3,74** |
| Quente (`erro`) | cartão do Funil (`variante-alerta`) | `#BF492B` · `#D6C9C1` · **3,09** | `#D75D3D` · `#3C322C` · **3,30** |
| Morno (`alerta`) | lista de Clientes | `#A36000` · `#EAE5DE` · 3,97 | `#F7A111` · `#242828` · 7,11 |
| Morno, Abordagem atrasada (`alerta`) | cartão (Hoje, Negociações) | `#A36000` · `#E2DDD7` · 3,69 | `#F7A111` · `#2D312F` · 6,34 |
| Morno, Abordagem atrasada (`alerta`) | cartão do Funil (`variante-alerta`) | `#A36000` · `#D3C8B9` · **3,02** | `#F7A111` · `#3F3827` · 5,55 |
| Frio (`info`) | lista de Clientes · cartão de Hoje | 4,15 · 3,86 | 5,58 · 5,00 |
| Frio (`info`) | cartão do Funil | `#0D75A9` · `#C8CCCB` · 3,14 | `#2AA9E0` · `#2B393C` · 4,48 |
| Feito, Ativo, Publicada (`sucesso`) | coluna (Hoje, Imóveis, Página) | `#027E66` · `#DAE8E9` · 4,00 | `#13A98D` · `#0E2934` · 5,11 |
| link ativo, ZOPA, escolhido (`sucesso`) | cartão (ficha, Negociações, Importar) | `#027E66` · `#D2E0E1` · 3,72 | `#13A98D` · `#16313C` · 4,59 |
| escolhido (`sucesso`) | cartão dentro de cartão (Conta e marca) | `#027E66` · `#CAD9DA` · 3,45 | `#13A98D` · `#1F3943` · 4,10 |
| neutro (`padrao` ou sem `cor`) | coluna | `rgba(13,27,42,.62)` · `#E2E5E9` · 4,50 | `rgba(255,255,255,.5)` · `#202D3B` · 4,68 |
| neutro | cartão (ficha, Imóveis) | `#D9DDE1` · **4,36** | `#293643` · **4,37** |
| `alerta` com texto neutro (faltas da qualidade em Imóveis) | coluna | `#E0E3E7` · 4,47 | `#202D3B` · 4,69 |

Ressalvas: (a) "Em andamento" e "Ponto de recuo" (Negociações) aparecem no array `badges` com 10,97/10,32 (claro) e 12,75/11,67 (escuro), leitura da cor do host, e não entram nas faixas citadas dos selos de estado; (b) `secundario` sobre `variante-alerta` é inferido (mesmo token do `dica`), não medido.

Telas com selo medido: Clientes, ficha, Hoje, Imóveis, Negociações, Funil, Página, Conversas, Importar, Conta e marca (Estúdio não tem selo).

### b) Altura da linha (`getBoundingClientRect().height`, claro, troca no DOM vivo)

| Medida | `fraco` | `dica` | Diferença |
|---|---|---|---|
| Uma linha de apoio (`urbi-prosa`, Clientes e Hoje) | 17,39 | 16,19 | −1,20 |
| Duas linhas (data de Hoje) | 34,78 | 32,38 | −2,40 |
| Linha da lista de Clientes (com um apoio) | 80,58 / 81,58 | 79,38 / 80,38 | −1,20 por linha |
| Lista de Clientes, 5 primeiros itens somados | 372,01 | 366,00 | **−6,01** |
| Lista de Clientes inteira (9 itens) | 628,53 | 617,70 | −10,83 |
| Fila de Hoje (1 item, sem apoio `fraco`) | 47,14 | 47,14 | 0 |
| Primeiros passos de Hoje (5 itens) | 143,16 | 143,16 | 0 (a altura vem do selo e do botão) |

### c) `dica` aplicada no DOM vivo: pior contraste por tela

| Tela | Claro (pior `dica` · `fraco` antes) | Escuro | Onde está o pior |
|---|---|---|---|
| Clientes | 4,74 · 3,10 | 5,18 · 3,78 | coluna |
| Ficha | 4,60 · 3,04 | 4,97 · 3,70 | cartão |
| Hoje | 4,60 · 3,10 | 4,97 · 3,78 | cartão |
| Imóveis | 4,60 · 3,04 | 4,97 · 3,70 | cartão |
| Negociações | 4,60 · 3,04 | 4,97 · 3,70 | cartão |
| **Funil** | **4,24** · **2,89** | 4,69 · 3,55 | sinal do cartão (`urbi-prosa papel="dica" truncar`, `clientes-quadro.ts`) sobre o cartão `variante-alerta` do quadro (`#D8D4CE`); 4,30 no cartão sem variante |
| Estúdio | 4,60 · 3,04 | 4,97 · 3,70 | cartão interativo |
| Página | 4,60 · 3,04 | 4,97 · 3,70 | cartão |
| Conversas | 4,74 · 3,10 | 5,18 · 3,78 | coluna |
| Importar | 4,74 · 3,10 | 5,18 · 3,78 | coluna |
| Conta e marca | 4,60 · 3,04 | 4,97 · 3,70 | cartão |

Com as cinco telas da prova anterior (Ajustes na seção padrão), são 12 telas medidas com `dica`. Só o Funil, no claro, fica abaixo de 4,5:1. (SUBSTITUÍDO pela conferência da 0.1.58 e pela seção Remedição: exceções abaixo de 4,5:1 no claro são Funil 4,24, mandato 4,49 e Ajustes 4,47 em um texto `secundario`; ver specs/prints/conferencia-0.1.58/)

### d) Aviso de IA na ficha

Com a IA disponível, o aviso não aparece. Para medi-lo, a sonda `GET /contatos/{id}/ia` foi respondida no próprio navegador com `{resumo:false, mensagem:false}`. Nada foi à instância e nada foi gravado. O aviso aparece num `urbi-card` (`#E9EBEF` / `#172433`): **3,04** claro e **3,70** escuro com `fraco`, e **4,60** / **4,97** com `dica`. Agora é medido, não deduzido.

### Divergências

- **DIVERGE** selo de estado no claro: antes "3,69 a 4,08", agora **3,02 a 4,15**. 3,02 é Morno e Abordagem atrasada no cartão do Funil, e 4,15 é Frio na lista. Fora do Funil e de Conta e marca a faixa vai de 3,69 a 4,15.
- **DIVERGE** selo de estado no escuro: antes "3,74 (Quente) a 7,11", agora **3,30 a 7,11**. 3,30 é Quente no cartão do Funil. Os valores 3,74 e 7,11 se confirmam.
- **DIVERGE** `urbi-badge` neutro: antes "4,50 · 4,68". Esses valores valem só sobre a coluna. Num cartão o neutro dá **4,36 · 4,37**, abaixo de 4,5.
- **DIVERGE** pior caso do `dica`: antes "4,60 / 4,97", agora **4,24** no claro (Funil). O escuro se mantém em 4,69, acima de 4,5. Nas outras 10 telas, 4,60 / 4,97 se confirma. (SUBSTITUÍDO pela conferência da 0.1.58 e pela seção Remedição: exceções abaixo de 4,5:1 no claro são Funil 4,24, mandato 4,49 e Ajustes 4,47 em um texto `secundario`; ver specs/prints/conferencia-0.1.58/)
- **DIVERGE** pior caso do `fraco` antes da troca: antes 3,04, agora **2,89** (Funil, claro).
- Alturas: "17 → 16 px; 35 → 32" eram valores arredondados. Os medidos são 17,39 → 16,19 (−1,20) e 34,78 → 32,38 (**−2,40, não −3**). Numa lista de 5 clientes, a lista fica 6,01 px mais baixa. As listas de Hoje não mudam.
- O aviso de IA (3,04 / 3,70) se confirma, agora medido.


## Cobertura das 21 telas (pós-Codex)

O Codex apontou (P1) que a medição cobria 12 telas e o PR mexe em 21 arquivos de `frontend/telas/`. Esta seção liga cada arquivo à tela e mede as que faltavam. Dados em `medidas.json` › `cobertura_21_telas`; capturas `cobertura-<tela>-<tema>-fraco-dica-1366x657.png` (esquerda `fraco`, direita `dica`, faixa magenta no meio).

**Limite desta evidência.** O procedimento da seção 6 de `specs/layout/README.md` (captura lado a lado contra o PNG de referência) **não foi refeito tela a tela**. Foi feita medição antes/depois do próprio efeito da troca (contraste e altura) no DOM ao vivo da 0.1.51, porque a 0.1.58 não está instalada.

**Método.** Igual ao da seção "Remedição da revisão": homologação "pinguim" (app 0.1.51), `CONTA=7`, só leitura, estilos computados, razão WCAG compondo alfas sobre o fundo efetivo (cor lida do `<slot>` do `urbi-prosa`), `papel` trocado no DOM ao vivo sem gravar, 1366×657 e 1440×1000, claro e escuro (`data-theme`). Chamadas que gravam são abortadas no navegador: nesta rodada foram 4 tentativas, todas `PATCH /conversas/1/lida` (a tela de Conversas marca a conversa como lida ao abrir), e nenhuma chegou à instância. Todas as telas são do papel `corretor` (`TELAS` em `frontend/index.ts`); Hoje e Negociações também abrem para o negociador humano. Altura do bloco: soma das alturas dos elementos trocados e `scrollHeight` do conteúdo de cada coluna (esquerda/centro/direita), antes → depois.

### a) Arquivo → tela

| Arquivo | Tela | Endereço | Situação |
|---|---|---|---|
| `ajustes.ts` | Ajustes (linha de estado no menu da aba) | `/ajustes e /ajustes/<aba>` | medida (remedição anterior) e, nesta, 7 linhas do menu em /ajustes/funil |
| `clientes-quadro.ts` | Clientes › Funil | `/clientes?visao=funil` | medida (remedição anterior; nesta, Clientes-funil) |
| `clientes.ts` | Clientes › lista | `/clientes` | medida (remedição anterior) |
| `conexoes.ts` | Ajustes › Conexões | `/ajustes/conexoes` | medida nesta (Conexoes) |
| `conta.ts` | Ajustes › Conta e marca / Atendimento | `/ajustes/conta` | medida (anterior) e nesta (Ajustes-conta) |
| `conversas.ts` | Conversas | `/conversas?item=` | medida (anterior) e nesta (Conversas) |
| `desempenho.ts` | Números (apelido /desempenho) | `/numeros` | medida nesta (Numeros) |
| `empreendimentos.ts` | Imóveis › aba Empreendimentos | `/imoveis?aba=empreendimentos (apelido /empreendimentos)` | não medida: a conta demo (CONTA=7) não tem empreendimento (GET /empreendimentos devolve lista vazia) e o estado vazio não tem texto com `fraco` |
| `estudio.ts` | Estúdio | `/estudio` | medida (anterior) |
| `ficha-contato.ts` | Clientes › ficha do contato | `/clientes?item=` | medida (anterior) e nesta (Ficha-contato) |
| `ficha-imovel.ts` | Imóveis › ficha do imóvel | `/imoveis?item= (apelido /imoveis/<id>)` | medida nesta (Imovel-ficha) |
| `imoveis.ts` | Imóveis › lista (e coluna de contexto) | `/imoveis` | medida (anterior) e nesta (Imovel-ficha, a lista está na coluna esquerda) |
| `importar.ts` | Importar contatos | `/clientes/importar` | medida (anterior) |
| `inicio.ts` | Hoje (e Hoje › Agenda) | `/ e /agenda` | medida (anterior) e nesta (Hoje-agenda) |
| `mandato.ts` | Modal Definir/Editar mandato, aberto na ficha do imóvel e na negociação | `/imoveis?item= e /negociacoes?neg=, botão Editar mandato` | medida nesta (Imovel-mandato, Negociacao-mandato); abrir o modal não grava |
| `marca.ts` | Ajustes › Conta e marca (cartão Sua marca) | `/ajustes/conta` | medida (anterior) e nesta (Ajustes-conta) |
| `negociacoes.ts` | Negociações (também do negociador humano) | `/negociacoes?neg=` | medida (anterior) e nesta (Negociacoes-item); estados condicionais não vistos (ver não medidas) |
| `negociador-ajustes.ts` | Ajustes › Negociador | `/ajustes/negociador` | medida nesta (Ajustes-negociador); o teste do Negociador não foi exercitado (ver não medidas) |
| `novo-imovel.ts` | Novo imóvel (4 passos) | `/imoveis/novo e /imoveis/novo?item=12&passo=dados|autorizacao|onde` | medida nesta (passo Fotos sem item; passos Dados, Autorização e Onde aparece com `?item=12`, só leitura) |
| `pagina.ts` | Página | `/pagina` | medida (anterior) |
| `selecoes-cliente.ts` | Clientes › ficha › Seleções e Portal do cliente | `/clientes?item= (dentro da ficha)` | medida nesta (Ficha-contato, host pc-selecoes-cliente); a linha "Enviada em" não apareceu |

### b) Telas medidas nesta rodada

Colunas: elementos trocados; pior contraste claro (`fraco` → `dica`); pior contraste escuro; diferença da soma das alturas dos elementos trocados em px (1366 / 1440); diferença do conteúdo das colunas esq/centro/dir em px (1366 · 1440); elementos com número de linhas ou transbordo (`scrollWidth > clientWidth`) diferente (1366 / 1440).

| Tela | Trocados | Claro | Escuro | Δ elementos (px) | Δ colunas (px) | Linhas/transbordo |
|---|---|---|---|---|---|---|
| Números (`desempenho.ts`) | 9 (9 visíveis) | 3,04 → **4,6** | 3,7 → 4,97 | -10,8 / -12,0 | 0/-2/0 · 0/-3/0 | 0 / 0 |
| Ajustes › Conexões (`conexoes.ts`) | 11 (11 visíveis) | 3,04 → **4,6** | 3,7 → 4,97 | -14,4 / -14,4 | 0/-6/0 · 0/-7/0 | 0 / 0 |
| Ajustes › Negociador (`negociador-ajustes.ts`) | 19 (19 visíveis) | 3,04 → **4,6** | 3,7 → 4,97 | -22,8 / -22,8 | 0/-12/-2 · 0/-12/-2 | 0 / 0 |
| Imóveis › ficha do imóvel (`ficha-imovel.ts, imoveis.ts`) | 27 (13 visíveis) | 3,04 → **4,6** | 3,7 → 4,97 | -15,6 / -15,6 | -4/-6/0 · 0/-6/0 | 0 / 0 |
| Novo imóvel (passo Fotos) (`novo-imovel.ts (Fotos)`) | 5 (5 visíveis) | 3,1 → **4,74** | 3,78 → 5,18 | -6,0 / -6,0 | 0/0/0 · 0/0/0 | 0 / 0 |
| Novo imóvel (passo Dados) (`novo-imovel.ts`) | 6 (6 visíveis) | 3,04 → **4,6** | 3,7 → 4,97 | -8,4 / -8,4 | 0/-3/0 · 0/0/0 | 0 / 0 |
| Novo imóvel (passo Autorização) (`novo-imovel.ts`) | 7 (7 visíveis) | 3,1 → **4,74** | 3,78 → 5,18 | -8,4 / -8,4 | 0/0/0 · 0/0/0 | 0 / 0 |
| Novo imóvel (passo Onde aparece) (`novo-imovel.ts`) | 7 (7 visíveis) | 3,1 → **4,74** | 3,78 → 5,18 | -8,4 / -8,4 | 0/0/0 · 0/0/0 | 0 / 0 |
| Imóveis › ficha › modal Editar mandato (`mandato.ts`) | 32 (18 visíveis) | 2,99 → **4,49** | 3,76 → **5,10** (a linha antiga dizia 3,7 → 4,97: SUBSTITUÍDO; valor da conferência real 0.1.58 e do `medidas.json`) | -25,2 / -25,2 | -4/-6/-9 · 0/-6/-9 | 0 / 0 |
| Negociações › modal Editar mandato (`mandato.ts, negociacoes.ts`) | 15 (15 visíveis) | 2,99 → **4,49** | 3,76 → **5,10** (a linha antiga dizia 3,7 → 4,97: SUBSTITUÍDO; valor da conferência real 0.1.58 e do `medidas.json`) | -25,2 / -25,2 | 0/-6/-9 · 0/0/-9 | 0 / 0 |
| Negociações (item aberto) (`negociacoes.ts`) | 10 (10 visíveis) | 3,04 → **4,6** | 3,7 → 4,97 | -15,6 / -15,6 | 0/-6/-7 · 0/0/0 | 0 / 0 |
| Clientes › ficha (com seleções e portal) (`ficha-contato.ts, selecoes-cliente.ts`) | 19 (18 visíveis) | 3,04 → **4,6** | 3,7 → 4,97 | -22,8 / -22,8 | -11/-10/-2 · -11/0/0 | 0 / 0 |
| Ajustes › Funil (`ajustes.ts (menu)`) | 7 (7 visíveis) | 3,1 → **4,74** | 3,78 → 5,18 | -8,4 / -8,4 | 0/0/0 · 0/0/0 | 0 / 0 |
| Ajustes › Conta e marca (`conta.ts, marca.ts`) | 11 (11 visíveis) | 3,04 → **4,6** | 3,7 → 4,97 | -14,4 / -13,2 | 0/-4/0 · 0/-3/0 | 0 / 0 |
| Conversas (`conversas.ts`) | 16 (16 visíveis) | 3,04 → **4,6** | 3,7 → 4,97 | -19,2 / -19,2 | 0/-13/0 · 0/-13/0 | 0 / 0 |
| Clientes › Funil (item aberto) (`clientes-quadro.ts`) | 9 (9 visíveis) | 2,89 → **4,24** | 3,55 → 4,69 | -13,2 / -13,2 | 0/-2/-4 · 0/0/0 | 0 / 0 |
| Hoje › Agenda (`inicio.ts`) | 4 (4 visíveis) | 3,1 → **4,74** | 3,78 → 5,18 | -6,0 / -6,0 | 0/0/0 · 0/0/0 | 0 / 0 |

Os números de contraste são iguais nas duas janelas. Nenhum elemento mudou de número de linhas nem passou a transbordar. A maior variação é de 1,2 px por linha (17,39 → 16,19 px; duas linhas, 34,78 → 32,38), igual à da remedição anterior. "Visíveis" é menor que "trocados" onde há texto em aba ou bloco fora da janela (por exemplo a ficha do imóvel); todos entram na conta de contraste.

### c) Divergências

- **DIVERGE** Modal Editar mandato (`mandato.ts`), claro: o `dica` mede **4,49:1**, abaixo de 4,5:1 por 0,01 (cinco textos; antes 2,99). No escuro 5,10 (antes 3,76).
- **DIVERGE** Clientes › Funil, claro: `dica` **4,24:1** (antes 2,89), já registrado e confirmado. O escuro mede 4,69.
- Nas demais telas medidas nesta rodada o pior `dica` é 4,60 (claro) e 4,97 (escuro) sobre cartão, ou 4,74 e 5,18 sobre a coluna. Nenhuma diferença de altura passou de 4 px por linha (o máximo foi 1,2 px).

### d) Não medidas (com motivo)

- **não medida:** `empreendimentos.ts` (2 usos) e a ficha do empreendimento: não medida: conta demo sem empreendimentos; as duas telas só mostram texto com o papel quando há dado.
- **não medida:** negociador-ajustes.ts, "Você, como comprador", "Negociador · teste", "O Negociador está respondendo…" (aviso de teste do Negociador): não medida: só aparecem depois de "Testar", que chama a IA e grava a conversa de teste; nenhuma chamada que grava foi tentada.
- **não medida:** novo-imovel.ts, estados "documento(s) anexado(s)", resumo de ambiente da IA ("ia_ambiente") e avanço de passo: não medida: dependem de anexar foto/documento ou de avançar o passo, que grava o rascunho. Os 4 passos foram abertos por URL, sem avançar.
- **não medida:** negociacoes.ts, estados condicionais ("IA indisponível agora: registre as propostas à mão", "Rascunho do Negociador", "Sem mandato, nenhuma contraproposta sai", "A ZOPA aparece com o mandato…", "Aceitar o acordo é do corretor…"): não medida: dependem de IA indisponível, de rascunho gerado (grava) ou de negociação sem mandato/sem oferta; a única negociação da conta demo tem mandato.
- **não medida:** selecoes-cliente.ts, "Enviada em …": não medida: a ficha aberta não trouxe seleção enviada naquela posição; os outros 2 usos foram vistos.
- **não medida:** desempenho.ts, "Só números somados da conta…" (relatório): não medida: aparece só com relatório gerado (grava).
- estudio.ts, importar.ts, pagina.ts e o texto de IA indisponível da ficha já tinham sido medidos na remedição anterior (aviso de IA medido com a sonda respondida no navegador); nesta rodada não foram refeitos, e não confirmei neles os textos estáticos \"Próximo passo:\" (conversas.ts), \"Na ordem do mais urgente\" (inicio.ts) e \"No portal do cliente:\" (ficha-contato.ts).
- Corretores (operacao), Agenda, Playbook, funil-ajustes, Assistente e ficha do empreendimento não entram nos 21 arquivos: nenhum deles tinha `papel="fraco"` na main (grep) e o PR não os alterou. Corretores é do papel operacao, não alcançável por corretor.

### Resumo

Dos 21 arquivos, 20 têm ao menos uma tela medida com `dica` (nesta rodada ou na remedição anterior); só `empreendimentos.ts` ficou sem medida (conta demo sem empreendimento). Em vários arquivos há estados condicionais (listados acima) que não puderam ser exercitados sem gravar ou sem dado. O que continua abaixo de 4,5:1 com `dica`: Funil no claro (4,24) e o modal de mandato no claro (4,49).

## Conferência real da 0.1.58

Ver `specs/prints/conferencia-0.1.58/` (09/11/2026, só leitura): no shell 0.56.37 com o app 0.1.58 o modal de mandato mede 4,49 (claro) e 5,10 (escuro), o Funil 4,24 e 4,69, e o `secundario` do cartão de tom de Ajustes 4,47 e 4,69.
