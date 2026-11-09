# Issue #171: geometria real da moldura (app 0.1.51 na homologação "pinguim", 09/11/2026)

Medido só em leitura com Playwright (base `scripts/conferencia-visual/capturar.mjs`; `CONTA=7`, conta Corretor A (demo); toda chamada que grava foi bloqueada no navegador). Abrir o Assistente é estado de tela, não grava. Fonte do sistema (Google Fonts bloqueado). Dados brutos em `medidas.json`; capturas `<tela>[-assistente]-<largura>x<altura>.png`.

## Altura (o que vem antes do trabalho)

| Faixa | y (px) | Altura |
|---|---|---|
| Barra do shell | 0 | 56 |
| Cabeçalho do shell (título + Criar) | 80 | 37 (+24 de respiro acima e 12 abaixo) |
| Seletor **Conta** (só para quem atende 2+ contas; o corretor de uma conta não o vê) | 129 | 54 |
| Moldura de colunas | 183 | resto da janela − 16 |

Moldura: **521** px em 1280×720, **458** em 1366×657, **770** em 1920×969. Sem o seletor de conta, +54 (575 · 512 · 824).

## Larguras (lista · centro · contexto)

| Janela | Sem Assistente | Com Assistente |
|---|---|---|
| 1280×720 | 360 · **531** · 339 | 360 · **491** · 379 |
| 1366×657 | 360 · 617 · 339 | 360 · 577 · 379 |
| 1920×969 | 360 · 1171 · 339 | 360 · 1131 · 379 |

Igual em Clientes, Imóveis, Ajustes e Hoje (Ajustes tinha 429 px de centro na 0.1.43). Só 1280 com o Assistente fica abaixo dos 520 px do guia (−29), pelos 380 px do Assistente (spec do grupo 5).

## Rolagem

Não há mais trilho vertical: o menu é o `nav` do shell, no nome da app na barra (D-114). Cada coluna rola por dentro: lista de Clientes 458/933 px em 1366×657, Imóveis 458/601, centro de Ajustes 458/1365, contexto de Hoje 458/709. A lista de Ajustes (7 itens) cabe inteira em 458. Nada fica inalcançável por falta de rolagem.

## O que some

**Cabeçalho da coluna de Clientes** (Clientes · Importar · Novo · Buscar · Assistente): os botões ocupam 314 px (x=126 a 440: Importar 107 + Novo 87 + Buscar 48 + Assistente 48 + gaps de 8), ~400 com o título, e a coluna dá 328 úteis (360 − 2×16). Não cabe numa linha: o Buscar termina na borda da coluna (24–384) e o Assistente (392–440) fica fora. Em toda largura (a coluna é fixa) o **Buscar sai cortado e o Assistente fica fora da coluna**, inalcançável; no celular, o Assistente. Conversas, Imóveis e Página cabem.

| Botão (1366×657) | Antes (x) | Com `quebrar` (x) |
|---|---|---|
| Importar | 126–233 | 40–147 (2ª linha) |
| Novo | 241–328 | 155–242 |
| Buscar | 336–384 **cortado** | 250–298 |
| Assistente | 392–440 **cortado** | 306–354 |

Prova feita no DOM da página ao vivo (`Clientes-cabecalho-com-quebrar-*.png`); nas outras telas o cabeçalho não muda (uma linha, 34 px). Corrigido na 0.1.54 (`frontend/moldura.ts`, `cabecalhoColuna`).

## Celular (390×844)

Barra 56 · título + Criar até y=101 · seletor de conta 54 · abas das colunas 37 · conteúdo a partir de y=204 (150 sem o seletor, 18 %). O nome da app sai truncado ("Portal do Corr…") na barra do shell.

## Diferença · causa · decisão

| Diferença | Referência v2 | App 0.1.51 | Causa | Decisão |
|---|---|---|---|---|
| Cabeçalho de Clientes em duas linhas | P04: uma linha, sem Buscar | Título e botões em duas linhas (com `quebrar`) | Buscar (D-126) e botões só ícone de 48 px (D-123) passam de 328 px úteis | `quebrar` do `urbi-linha`, sem tirar botão. **Decisão do dono pendente:** Importar só ícone ou no menu "mais" |

A altura do cabeçalho de Clientes sai da tolerância de ±4 px da D-121 nesta tela.
