# Contrato de layout das telas — Portal do Corretor (Padrão B)

Esta pasta existe para que a implementação reproduza **exatamente** a disposição das telas aprovadas: o que fica em cada coluna, a ordem dos elementos, larguras, alturas, espaçamentos, tamanhos de fonte e de botão. Ela complementa `specs/portal_corretor.md` (seção 11: comportamento, comandos, rotas, eventos) e `specs/telas_padrao_b.md` (componentes e wireframes).

## 1. O que mudou em relação à versão anterior

O guia `telas_padrao_b.md` dizia "não copie o CSS dos mockups". Isso foi lido como "o layout é livre", e as telas implementadas ficaram diferentes. **A partir deste contrato:**

| Aspecto | Status | Como aplicar |
|---|---|---|
| Estrutura: moldura, colunas, ordem e presença de cada elemento, o que fica em cada coluna | **Normativo** | Igual ao PNG e ao JSON de cada tela |
| Larguras das colunas, alturas de botões e campos, espaçamentos (padding, gap), raios, tamanhos e pesos de fonte | **Normativo**, com tolerância de ±4 px | Usar os valores da seção 3 e do JSON; se um primitivo `urbi-*` impuser outro valor, usar o primitivo e registrar a diferença no PR |
| Cores | **Por papel** | Mapear cada cor ao token do tema (seção 4); não usar hex do mockup no código |
| Fonte | **Por papel** | Usar a fonte do tema com a mesma escala de tamanhos e pesos |
| Textos dos rótulos e botões | **Normativo** | Iguais aos do mockup, salvo correção registrada na spec |
| Dados (nomes, valores, imóveis) | Exemplo | Vêm da semente de demonstração (`telas_padrao_b.md`, seção 5) |

Ordem de autoridade: SDK instalado (o que a plataforma permite) > spec seção 11 (comportamento) > **este contrato (forma)** > mockups HTML.

## 2. Arquivos

| Arquivo | Para quê |
|---|---|
| `png/<tela>.png` | **Imagem de referência** da tela, renderizada do mockup (desktop com 1440 px de largura; celular 390 × 844). É o alvo da comparação visual |
| `<tela>.layout.json` | **Medidas extraídas do navegador**: cada elemento relevante com caixa (x, y, largura, altura), texto, papel e estilos calculados |
| `../telas/<tela>.html` | Mockup aberto no navegador (inspecionar com as ferramentas de desenvolvedor) |

| Tela | Título | Viewport (px) | Imagem | Medidas | Mockup |
|---|---|---|---|---|---|
| P01-Hoje | Hoje | 1440 × 1000 | `png/P01-Hoje.png` | `P01-Hoje.layout.json` | `../telas/P01-Hoje.html` |
| P02-Conversas | Conversas | 1440 × 1270 | `png/P02-Conversas.png` | `P02-Conversas.layout.json` | `../telas/P02-Conversas.html` |
| P03-Funil | Clientes · Funil | 1440 × 1000 | `png/P03-Funil.png` | `P03-Funil.layout.json` | `../telas/P03-Funil.html` |
| P04-Cliente | Clientes · Lista e ficha | 1440 × 1000 | `png/P04-Cliente.png` | `P04-Cliente.layout.json` | `../telas/P04-Cliente.html` |
| P05-Assistente | Assistente aberto | 1440 × 1000 | `png/P05-Assistente.png` | `P05-Assistente.layout.json` | `../telas/P05-Assistente.html` |
| P06-Imoveis | Imóveis · Carteira e ficha | 1440 × 1000 | `png/P06-Imoveis.png` | `P06-Imoveis.layout.json` | `../telas/P06-Imoveis.html` |
| P07-Novo-imovel | Imóveis · Novo imóvel | 1440 × 1000 | `png/P07-Novo-imovel.png` | `P07-Novo-imovel.layout.json` | `../telas/P07-Novo-imovel.html` |
| P08-Estudio | Estúdio | 1440 × 1000 | `png/P08-Estudio.png` | `P08-Estudio.layout.json` | `../telas/P08-Estudio.html` |
| P09-Pagina | Página | 1440 × 1000 | `png/P09-Pagina.png` | `P09-Pagina.layout.json` | `../telas/P09-Pagina.html` |
| P10-Numeros | Números | 1440 × 1000 | `png/P10-Numeros.png` | `P10-Numeros.layout.json` | `../telas/P10-Numeros.html` |
| P11-Mensageiro | Ajustes · Mensageiro | 1440 × 1000 | `png/P11-Mensageiro.png` | `P11-Mensageiro.layout.json` | `../telas/P11-Mensageiro.html` |
| P12-Conexoes | Ajustes · Conexões | 1440 × 1000 | `png/P12-Conexoes.png` | `P12-Conexoes.layout.json` | `../telas/P12-Conexoes.html` |
| P13-Conta | Ajustes · Conta, marca e plano | 1440 × 1000 | `png/P13-Conta.png` | `P13-Conta.layout.json` | `../telas/P13-Conta.html` |
| P14-Importar | Clientes · Importar | 1440 × 1000 | `png/P14-Importar.png` | `P14-Importar.layout.json` | `../telas/P14-Importar.html` |
| P15-Negociacoes | Clientes · Negociações | 1440 × 1000 | `png/P15-Negociacoes.png` | `P15-Negociacoes.layout.json` | `../telas/P15-Negociacoes.html` |
| P16-Mandato | Mandato de negociação | 1440 × 1478 | `png/P16-Mandato.png` | `P16-Mandato.layout.json` | `../telas/P16-Mandato.html` |
| P17-Negociador | Ajustes · Negociador | 1440 × 1173 | `png/P17-Negociador.png` | `P17-Negociador.layout.json` | `../telas/P17-Negociador.html` |
| M1-Hoje | Celular · Hoje | 390 × 844 | `png/M1-Hoje.png` | `M1-Hoje.layout.json` | `../telas/M1-Hoje.html` |
| M2-Conversa | Celular · Conversa | 390 × 844 | `png/M2-Conversa.png` | `M2-Conversa.layout.json` | `../telas/M2-Conversa.html` |
| M3-Novo-imovel | Celular · Novo imóvel | 390 × 844 | `png/M3-Novo-imovel.png` | `M3-Novo-imovel.layout.json` | `../telas/M3-Novo-imovel.html` |
| M4-Portal | Cliente · Portal (conversa) | 390 × 844 | `png/M4-Portal.png` | `M4-Portal.layout.json` | `../telas/M4-Portal.html` |
| M5-Portal-imoveis | Cliente · Portal (imóveis) | 390 × 844 | `png/M5-Portal-imoveis.png` | `M5-Portal-imoveis.layout.json` | `../telas/M5-Portal-imoveis.html` |
| M6-Pagina-publica | Visitante · Minha Página | 390 × 844 | `png/M6-Pagina-publica.png` | `M6-Pagina-publica.layout.json` | `../telas/M6-Pagina-publica.html` |
| M7-Proprietario | Proprietário · Portal (fase 3) | 390 × 844 | `png/M7-Proprietario.png` | `M7-Proprietario.layout.json` | `../telas/M7-Proprietario.html` |
| M8-Aprovar-negociacao | Celular · Aprovar negociação | 390 × 844 | `png/M8-Aprovar-negociacao.png` | `M8-Aprovar-negociacao.layout.json` | `../telas/M8-Aprovar-negociacao.html` |

## 3. Constantes de layout (valem para todas as telas)

**Moldura do corretor (computador, 1440 px):**

| Elemento | Medida |
|---|---|
| Trilho de ícones | 88 px de largura; padding 14 px 8 px; itens com ícone 22 px + rótulo 11 px/800; item com padding 9 px 4 px, raio 12 px; botão Criar e botão Assistente com 56 px de altura, raio 14 px |
| Coluna esquerda (lista) | flex `1 1 340px`, máx. 380 px; borda direita 1 px |
| Coluna central (foco) | flex `999 1 520px` (ocupa o resto); fundo da página |
| Coluna direita (contexto) | flex `1 1 300px`, máx. 360 px; padding 18 px 16 px; gap 14 px entre blocos |
| Cabeçalho de coluna | padding 18 px 16 px 12 px; título 22 px/800; subtítulo 13 px |
| Título de seção da lista | 12 px/800, caixa alta, espaçamento 0,03 em; padding 14 px 16 px 6 px |
| Item de lista | padding 12 px 16 px; avatar 36 px; nome 14 px/800; linha secundária 12 px |
| Busca | altura 44 px; raio 10 px; padding horizontal 12 px; margem 0 16 px 10 px |
| Chips (filtros, status, temperatura) | padding 3 px 9 px; raio 999 px; 12 px/700; gap 6 px |
| Cartão | padding 16–20 px; raio 14 px; borda 1 px |
| Botão padrão | altura mínima 44 px; padding 11 px 18 px; raio 10 px; 14 px/700 |
| Botão pequeno | altura mínima 36 px; padding 8 px 14 px; raio 10 px; 13 px/700 |
| Campo de texto | altura mínima 44 px; raio 10 px; padding 0 12 px; 14 px |
| Texto base | 14 px; linha 1,45–1,5 |
| KPI | rótulo 12 px/700 caixa alta; valor 28 px/800 (22 px em contexto) |
| Bolha de mensagem | máx. 72% da largura; padding 10 px 12 px; raio 14 px; 14 px |
| Gap entre cartões de uma pilha | 12 px |

**Celular (390 × 844):** cabeçalho do shell com 60 px; conteúdo com padding 16 px e gap 12 px; atalhos do dia no rodapé da página com botões de 52 px; alvos de toque ≥ 44 px.

## 4. Cores do mockup → papel → token

| Hex no mockup | Papel | Token a usar (nome do tema do UrbiVerso; confirmar no SDK) |
|---|---|---|
| `#F4F3EF` | fundo da página | fundo base |
| `#FFFFFF` | superfície | superfície |
| `#E2E0D8` | linha | borda |
| `#1B2330` / `#4F5968` | texto / texto secundário | texto / texto suave |
| `#0B6B6F` / `#E3F1F1` | ação principal / fundo de seleção | primária / primária suave |
| `#5B3FB8` / `#EFEAFB` | IA | acento (ou exceção nomeada "ia") |
| `#B3261E` / `#FBE6E4` | quente, urgente | perigo |
| `#7A5000` / `#FBF1DC` | morno, aguardando | aviso |
| `#2F5DA8` / `#E6EEFA` | frio, informação | informação |
| `#1E6B3A` / `#E4F3E8` | sucesso, validado | sucesso |

## 5. Como ler o JSON

```json
{"tela":"P15-Negociacoes","viewport":{"largura":1440,"altura_conteudo":1000},
 "nos":[{"id":12,"parent":3,"tag":"section","label":"Negociação aberta",
         "box":{"x":468,"y":0,"w":612,"h":1000},
         "style":{"display":"flex","direction":"column","padding":"18px 16px 18px 16px","bg":"rgb(244, 243, 239)"}}]}
```

- `box`: posição e tamanho em px, relativos ao canto superior esquerdo da tela. Use para conferir larguras de coluna, alturas e alinhamentos.
- `parent`: monta a árvore; `label` vem do `aria-label` (nome da região ou do controle); `text`: texto visível do elemento.
- `style`: só o que importa para o layout: `display`, `direction`, `gap`, `columns` (grade), `padding`, `bg`, `border`, `radius`, `font` (tamanho/peso), `color`.
- Medido com a fonte Manrope; com a fonte do tema, larguras de texto variam alguns pixels. **Posições de blocos e tamanhos de componentes não devem variar além de ±4 px.**

## 6. Procedimento de conferência visual (obrigatório em todo bloco de tela)

1. Abrir a tela da app na instância de teste com a semente de demonstração, no mesmo viewport do PNG (1440 de largura no computador; 390 × 844 no celular).
2. Tirar captura (Playwright ou equivalente) e colocar **lado a lado** com `png/<tela>.png`.
3. Conferir, nesta ordem: (a) moldura e colunas; (b) presença e ordem de cada bloco e controle; (c) larguras e alturas (comparar com `box` do JSON); (d) espaçamentos e tamanhos de fonte; (e) papéis de cor.
4. Registrar no PR uma tabela "diferença · causa · decisão" para tudo que ficou fora da tolerância (ex.: "botão com 40 px · primitivo `urbi-botao` não permite 44 · mantido o primitivo").
5. Anexar as duas capturas ao PR.

Uma tela só é considerada pronta quando a comparação não tem diferença estrutural (bloco faltando, fora de ordem ou na coluna errada).
