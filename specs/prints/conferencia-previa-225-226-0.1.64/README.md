# Conferência visual dos PRs #225 (P15) e #226 (M3) — prévia 0.1.64, 27/11/2026

Conferência da seção 6 de `specs/layout/README.md` (contrato versão 2), pedida pelo dono na conversa de 27/11/2026, para destravar o #225 (P15 dentro de Clientes) e o #226 (ordem do M3 no celular). As capturas são da **app real na homologação**, só da área da app, lado a lado com a referência aprovada. A linha de base é a conferência do grupo 3 (`specs/prints/conferencia-grupo3-0.1.49/`).

| | |
|---|---|
| App na instância | 0.1.64, build `47ef75a1`: pré-release da branch `claude/previa-225-226` (a `main` em `cea477a` com o #225 e o #226 mesclados), instalada pela atualização automática do pinguim às 20:54 UTC |
| Shell | 0.56.39 |
| Conta | **Corretor A (demo)** (id 7), com a semente da demo |
| Viewport | 1440 de largura no computador (altura 1420); 390 × 844 no celular |
| Como entrou sem senha | `capturar.mjs pinguim <saída> P15,M8,M3,P07` com `CONTA=7`. Para o M8 usei uma cópia do script com a rota `/portal_corretor/clientes?visao=negociacoes&item=1`, que abre a negociação NG-0001 na aba Negociação |
| Como comparou | `comparar.py --md`: lado a lado (à esquerda a referência, à direita a app) e a tabela `medidas.md` |
| Fonte | A fonte do tema vem do Google Fonts, que a rede do ambiente bloqueia, então a captura usa a fonte do sistema. A largura do texto varia alguns pixels; caixas e tamanhos não |

Arquivos: `<tela>.png` (lado a lado), `<tela>.app.png` (a captura da app sozinha), `<tela>.app.json` (as medidas extraídas do DOM) e `medidas.md`.

**Resultado:** nenhuma diferença estrutural nova. O que cada PR promete aparece na tela. As diferenças que sobram são as que já estavam registradas na 0.1.49 (primitivos, D-124 e 11.9) ou vêm do estado da conta demo.

## P15 Negociações dentro de Clientes (PR #225, computador)

**(a) Colunas:** 360 · 691 · 339 ✔ (a referência tem 360 · 589 · 340; o centro é flexível, D-114). **(b) Blocos e ordem:** conferidos abaixo. **(c) Tamanhos:** botões 34, chips 24, título 20/700 ✔. **(d) Espaçamento e fonte:** iguais à 0.1.49. **(e) Papéis de cor:** Assistente e Negociador na cor da IA, "Aguardando você" em aviso ✔.

| Bloco | Referência v2 | App (prévia) | Diferença | Causa | Decisão |
|---|---|---|---|---|---|
| Cabeçalho da esquerda | "Clientes" + Nova proposta (secundário: branco com borda) + Assistente 34 × 34 na mesma linha; alternador segmentado Funil · Lista · Negociações abaixo | **"Clientes" + Nova proposta + Buscar + Assistente na mesma linha; alternador Funil · Lista · Negociações abaixo** | Buscar a mais; Assistente 48 × 29; alternador em chips; Nova proposta preenchido na captura | Busca da lista (cabeçalho padrão de Clientes); D-123; D-124; papel de cor | **Resolvido pelo #225** (na 0.1.49 o título era "Negociações", sem alternador). Nova proposta passou a `secundario` no #225 depois desta captura, como na referência (só muda a cor, não a caixa) |
| Endereço | `/clientes?visao=negociacoes&item=<id>` | idem; `/negociacoes` redireciona para cá, menos para o negociador humano | — | D-96, D-125 | Igual |
| Chips | Aguardando você 1 · Negociador 1 · Cliente 1 · Proprietário 1 · Encerradas | Em andamento · Aguardando você · Negociador · Cliente · Proprietário · Encerradas | Sem contagem; "Em andamento" a mais | Filtro padrão | Registrada na 0.1.49 |
| Lista | Avatar, nome, imóvel, oferta e % | Nome + estado, imóvel, "R$ 1,32 mi × R$ 1,45 mi · −9%", quem conduz | Sem avatar | `urbi-lista` | Registrada (D-124) |
| Centro | Cabeçalho, faixa, escada em tabela, conversa, "Negociador sugere" | Cabeçalho, Devolver ao Negociador · Mais, faixa em badges, Pedir sugestão · Nova contraproposta, escada em lista, última fala do cliente | Forma da faixa e da escada; sem cartão de sugestão | Lacunas 11.9; não há sugestão pendente na conta demo | Registrada; estado |
| Direita | Mandato, Leitura do comprador, Próximo movimento | Mandato, Quem negocia, Leitura do comprador, Próximo movimento | Quem negocia a mais | D-108 | Igual |

## M3 Novo imóvel no celular (PR #226, 390 × 844)

| Bloco | Referência v2 | App (prévia) | Diferença | Causa | Decisão |
|---|---|---|---|---|---|
| Topo | "Novo imóvel" · Passo 1 de 4 | Cabeçalho do shell, seletor de conta, abas Passos · Novo imóvel · Qualidade; "Fotos" · Passo 1 de 4 | Seletor e abas a mais | Shell no celular (D-114); o seletor só aparece para quem atende várias contas | Pelo shell |
| 1. Fotos | Botão grande "Tirar fotos ou escolher da galeria" | `urbi-seletor-arquivo` com o botão "Tirar fotos ou escolher da galeria" | Caixa do primitivo | `urbi-seletor-arquivo` | Registrada (D-124) |
| 2. Grade de ambientes e "A IA já entendeu" | Grade 3 colunas e cartão | Não aparecem | — | Sem foto na conta demo (estado vazio) | Estado |
| 3. Ditar o resto | Botão de microfone **no passo 1**, depois da grade | **Cartão "Ditar o resto" no passo 1**, depois das fotos | Cartão com campo em vez de botão | `urbi-redator` (o microfone só aparece com o slot de áudio da IA) | **Resolvido pelo #226** (na 0.1.49 ficava no passo 2) |
| Seu código (opcional) | Não aparece | Campo entre "Ditar o resto" e o rodapé | Bloco a mais | Mesmo campo do P07 (código próprio do imóvel) | Manter; não é diferença de estrutura |
| 4. Rodapé | Salvar rascunho · **Continuar**, fixos | Salvar rascunho · **Continuar** no fim da coluna (y = 874, logo abaixo da dobra) | Não fixos | Não há primitivo de rodapé fixo | Registrada (11.9); **o texto "Continuar" foi resolvido pelo #226** (era "Próximo: dados") |

## P07 Novo imóvel no computador (o #226 não deve mudá-lo)

Igual à 0.1.49: as colunas medem 360 · 691 · 339; à esquerda os passos 1–4 e Salvar rascunho; no centro Fotos com Voltar · Salvar rascunho · **Próximo: dados**; à direita Qualidade agora e A IA. "Ditar" continua em Dados (passo 2). Nada mudou ✔.

## M8 Aprovar negociação no celular (rota nova do #225, 390 × 844)

Pela primeira vez a captura saiu na aba Negociação (a pendência 1 da 0.1.49), pela rota nova `clientes?visao=negociacoes&item=1`.

| Bloco | Referência v2 | App (prévia) | Diferença | Causa | Decisão |
|---|---|---|---|---|---|
| Topo | Voltar · "Ana Ribeiro · Casa J. Botânico · rodada 4 de 4" | Cabeçalho do shell, seletor de conta, abas Negociações · **Negociação** · Mandato; "Ana Ribeiro · Casa 4 quartos · Jardim Botânico", NG-0001 · IM-0001 · rodada 2 de 4, chips | Abas e chips a mais | Shell no celular (D-114) | Pelo shell |
| Faixa da negociação | Barra gráfica | Marcas em badges, recuo mascarado | Forma | Lacuna "faixa ZOPA" (11.9) | Registrada |
| Última oferta | Cartão com valor, fala do cliente e objeção | A oferta está na faixa e na escada; a fala e a objeção ficam em Leitura do comprador (aba Mandato) | Sem cartão próprio | Desenho da P15 reaproveitado no celular, igual desde a 0.1.49 | **Anterior aos PRs**; nova pendência (abaixo) |
| Negociador sugere | Cartão com a sugestão | Pedir sugestão · Nova contraproposta | Sem cartão | Não há sugestão pendente na conta demo | Estado |
| Enviar · Editar · Assumir | Fixos no rodapé | No cartão de sugestão, quando houver | Não fixos | Não há primitivo de rodapé fixo | Registrada (11.9) |

## Pendências desta conferência

1. **M8, cartão "Última oferta":** a referência mostra um cartão próprio, e a app espalha a informação entre a faixa, a escada e a aba Mandato. Isso vem de antes dos PRs, que não mexeram nessa tela, mas é uma diferença de bloco que só agora pôde ser vista. Fica para o dono decidir.
2. **Script:** `capturar.mjs` abre o M8 sem `&item=`, e por isso a captura cai na lista. Aqui usei uma cópia local com `&item=1`; levar isso ao script é manutenção.
3. Grade de fotos preenchida, "A IA já entendeu" e cartão "Negociador sugere": dependem de mídia e de uma sugestão pendente na conta demo, que exigem escrita na instância.
