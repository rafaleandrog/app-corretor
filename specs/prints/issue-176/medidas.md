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
| `urbi-badge` neutro · **de estado** (Quente, Morno, Frio, Feito, link ativo, Abordagem atrasada) | 4,50 · **3,69 a 4,08** | 4,68 · **3,74** (Quente, Sem resposta) a 7,11 | shell |
| Iniciais do `urbi-avatar` | **3,76 a 4,05** | 4,83 a 5,39 | shell |
| Rótulo do `urbi-kpi` | **4,47** | 4,69 | shell |
| Submensagem do `urbi-estado-vazio` | **3,10** | 3,78 | shell |
| Versão na barra do shell | **3,16** | 3,80 | shell |

Os números são iguais em 1366×657 e 1440×1000: o fundo e a cor não mudam com a janela.

## Correção no app (0.1.58) e prova

As 88 ocorrências de `papel="fraco"` em `frontend/telas/` passaram a `papel="dica"`. O `dica` tem o mesmo tamanho (0,75rem) e usa `--cor-texto-sec`. No `fraco` não sobrou texto desabilitado, único uso que o token prevê. Prova no DOM vivo das cinco telas: o pior caso passou a **4,60** no claro e **4,97** no escuro. A linha ficou 1 px mais baixa (17 → 16 px; 35 → 32 em duas linhas). `testes/contraste.test.ts` impede que o `fraco` volte.

O que fica abaixo de 4,5 é do shell (pedido 28).
