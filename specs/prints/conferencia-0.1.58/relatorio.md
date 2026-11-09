# Conferência só de leitura: portal_corretor 0.1.58 na "pinguim" (09/11/2026)

Playwright pré-instalado, base `capturar.mjs` (token injetado só nas chamadas à instância; `eu-sistema` respondido com `identidade`), `CONTA=7` (Corretor A (demo)), fonte do sistema. Toda chamada à instância que não fosse GET/HEAD era respondida 204 no navegador: **nenhuma foi tentada** (lista vazia em `medidas.json`). Erros de página (`pageerror`) e respostas 4xx/5xx nas telas abertas: **nenhum**. Scripts: `base.cjs`, `help2.js`, `conferir.cjs`, `funil.cjs` nesta pasta.

| # | Item | Resultado | Medido |
|---|---|---|---|
| 1 | `GET /api/shell/apps` | PASSOU | portal_corretor **0.1.58** (shell_min 0.56.37, sdk_min 100) |
| 2 | #190 celular 390×844 | PASSOU | `urbi-2x1` presente, `urbi-3-colunas` ausente, nenhum `role=tab` visível. Atalhos Conversas, Criar, Imóveis (y 183) e Assistente (y 225) visíveis. "Precisa de você · 1" em y 376,5. Conteúdo começa em **y 167** (com o seletor Conta). Aba Agenda (`?aba=agenda`): atalhos e "Precisa de você" iguais. 390 → 1280: `urbi-3-colunas` sim, `urbi-2x1` não. → 390: volta ao `urbi-2x1`. Negociação 1: título com 350 px (x 20–370), 2 linhas, `scrollWidth` = `clientWidth` = 350, documento 390 |
| 3 | #171 cabeçalho de Clientes | PASSOU | Em 1280 e 1440, coluna x 24–384. Importar 40–147, Novo 155–242, Buscar 250–298, Assistente 306–354. Todos na 2ª linha (y 233–267), dentro da coluna e clicáveis no centro |
| 4 | #180 Imóveis e Funil | PASSOU | Imóvel 14 aberto: lista com `scrollWidth` 360 = `clientWidth` 360 e nenhum transbordo na coluna. Título "Lote 450 m²…" com `truncar` e `text-overflow: ellipsis` (262 > 236 px, então mostra "…"). Funil, base do `urbi-kanban` × base do centro: 968/984 (**16 px**) em 1440×1000 e 688/704 (**16 px**) em 1280×720 |
| 5 | #176 contraste, pior texto de apoio (`dica`/`secundario`) | FALHOU contra o esperado (2 divergências) | Ver a tabela abaixo |
| 6 | #182 item 2, telefone | PASSOU | Busca com "990000101" mostra "Cliente · Ana Ribeiro · (61) 99000-0101", sem "+5561". Nova conversa (só digitado, não salvo) mostra "Ana Ribeiro · (61) 99000-0101", sem "+5561" |
| 7 | #192 campos sem nome | PASSOU (contagem igual) | **13 de 21**: Clientes 1/2, Filtros 2/2, Novo imóvel passo 1 1/2, Importar 2/2, Conta e marca 7/13. Nas três telas pedidas, 10 de 17. As árvores são idênticas às da 0.1.51. Pela mesma regra, os 6 `radio` (Importar, tom) ficam fora da conta e todos têm nome |
| 8 | #39, #187, "Baixou o preço" (#182 item 15) | NÃO EXERCIDO | Esses itens precisam gravar (POST). Lacuna: falta o principal de QA |

## Item 5: contraste (WCAG 2.x, alfas compostos sobre o fundo efetivo, 1440×1000, `data-theme` trocado só no DOM)

| Tela | Claro: pior apoio (pior `dica`) | Escuro | Esperado | Situação |
|---|---|---|---|---|
| Clientes | 4,74 | 5,18 | ≥ 4,60 / ≥ 4,97 | ok |
| Ficha de contato | 4,60 | 4,97 | idem | ok |
| Imóveis | 4,60 | 4,97 | idem | ok |
| **Ajustes** (`/ajustes`) | **4,47** `secundario` ("Fala como você fala…", `urbi-card` de tom, fundo `#E0E3E7`) (dica 4,60) | **4,69** (dica 4,97) | idem | **DIVERGE** no `secundario` do cartão de tom. A `dica` passa |
| Hoje | 4,60 | 4,97 | idem | ok |
| Funil | 4,24 (cartão `#D8D4CE`) | **4,69** (`#2B2D2A`) | claro 4,24 (exceção) | claro bate. **Escuro DIVERGE**: 4,69 < 4,97, e o escuro não está na lista de exceções (a remedição da #176 já registrava 4,69) |
| Modal de mandato | 4,49 | 5,10 | claro 4,49 (exceção) | ok |

**Papel fraco:** `--cor-texto-fraco` = `rgba(13,27,42,.48)` no claro e `rgba(255,255,255,.4)` no escuro. Nenhum `urbi-prosa papel="fraco"` na árvore. Os únicos textos na cor do fraco são do shell: a versão na `urbi-topbar` (3,16 / 3,80), a submensagem do `urbi-estado-vazio` (3,10 / 3,78) e "Vazio" no `urbi-kanban` (2,97). Nada do app.

## Observação de passagem

Na aba Agenda do celular, linhas longas da agenda ("Tarefa: O Negociador entrou na NG-0002: def…") terminam cortadas na borda do cartão, sem "…" visível (`item2-Hoje-Agenda-390x844.png`). Não há rolagem lateral (documento com 390). Não foi pedido; fica só registrado.
