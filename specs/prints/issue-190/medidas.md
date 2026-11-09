# Issue #190: celular medido na homologação "pinguim" (app 0.1.51, 09/11/2026)

Só leitura, 390 × 844 (viewport simples; capturas com deviceScaleFactor 2), base `scripts/conferencia-visual/capturar.mjs`, `CONTA=7` (Corretor A (demo)). Toda chamada à instância que não fosse GET/HEAD foi abortada no navegador: nenhuma tentada (`medidas.json`, `prova.json`). Fonte do sistema. `inicio.ts`, `novo-imovel.ts` e `negociacoes.ts` não mudaram entre a 0.1.51 e a `main` 0.1.55. Medidas em px de CSS, y a partir do topo da janela.

## Moldura (todas as telas)

| Faixa | y | Altura |
|---|---|---|
| Barra do shell (nome da app no menu) | 0 | 56 |
| Título da página + Criar | 64 | 37 |
| Seletor **Conta** (só quem atende 2+ contas) | 113 | 54 |
| Abas do `urbi-3-colunas` | 167 | 37 |
| Conteúdo (respiro de 16) | **220** | (166 sem o seletor; a referência começa em ~67) |

Rodapé da janela: nada (o fundo do shell). A "Menu" de 33 px da issue não existe mais (trilho saiu, D-114). Barra de atalhos e ações fixas no rodapé: o SDK não tem (pedido ao shell 32).

## Telas

| Tela | Medido (0.1.51) | Situação |
|---|---|---|
| M1 Hoje (`Hoje-390x844.png`) | Abre na aba Hoje; atalhos em 2 linhas (220–296), cabeçalho da coluna e Hoje · Agenda, "Precisa de você · 1" em 416, fila em linhas de **47–48 px** (522–761): cabem as 5 e a passagem (na conta demo a fila tem 5 itens; o limite do código é `FILA_VISIVEL` = 8). Aba "Fila" mostra a Agenda quando ela está escolhida | Lista compacta já resolvida (grupo 2). A barra de abas sai na 0.1.56 (`urbi-2x1`). Prova no DOM: conteúdo em **183** (com o seletor de Conta visível; sem ele, cerca de 129), fila 485–724, contexto embaixo (`Hoje-prova-2x1-390x844.png`) |
| M3 Novo imóvel (`Novo-imovel-390x844.png`) | Abre no passo **Fotos** (220), seletor com "Tirar fotos ou escolher da galeria" habilitado (254–469); Voltar · Salvar rascunho · Próximo: dados em 641, no fluxo | Só o início resolvido (grupo 3: Fotos primeiro). **Não bate com a referência:** o banner "A IA já entendeu" vem antes da grade de fotos e "Ditar o resto" fica no passo 2; ordem para o dono decidir. Rodapé fixo: D-124 / pedido 32 |
| Criar › Novo imóvel (`Criar-novo-imovel-390x844.png`) | Navega a `/imoveis/novo` e o menu fecha | Resolvido (#182 item 3) |
| M8 negociação 1 (`Negociacao-390x844.png`) | Título "Ana Ribeiro · Casa 4 quartos · Jardim Botânico" com **448 px em 390**, cortado sem quebrar; chips em 3 linhas (320–406); escada em lista, **46–47 px por proposta**; sem sugestão na conta demo (só "Pedir sugestão") | Título "•" e escada resolvidos (grupo 3). Título fora da linha das ações na 0.1.56; prova no DOM: 350 px em 2 linhas, sem rolagem lateral (`Negociacao-prova-titulo-390x844.png`) |
