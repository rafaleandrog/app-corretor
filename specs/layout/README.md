# Contrato de layout das telas — Portal do Corretor (Padrão B) · versão 2

**Versão 2 (moldura do shell).** As referências foram regeneradas para a moldura real da app dentro do shell do UrbiVerso e para os tamanhos dos primitivos da plataforma, conforme as decisões da etapa 3 (`specs/decisoes_etapa3.md`). Elas substituem a versão 1 inteira. Esta pasta complementa `specs/portal_corretor.md` (seção 11: comportamento, comandos, rotas, eventos) e `specs/telas_padrao_b.md` (componentes e wireframes).

## 1. O que é obrigatório

| Aspecto | Status | Como aplicar |
|---|---|---|
| Estrutura: colunas, ordem e presença de cada elemento, o que fica em cada coluna | **Normativo** | Igual ao PNG e ao JSON de cada tela |
| Larguras, alturas, espaçamentos, raios, tamanhos e pesos de fonte | **Normativo**, tolerância de ±4 px | Valores da seção 3 e do JSON. Se um primitivo `urbi-*` impuser outro valor, usar o primitivo e registrar no PR |
| Cores | **Por papel** | Token do tema (seção 4); nunca o hex do mockup |
| Fonte | **Por papel** | Fonte do tema, com a escala de tamanhos e pesos (peso máximo 700) |
| Textos de rótulos e botões | **Normativo** | Iguais aos do mockup, salvo correção registrada na spec |
| Dados (nomes, valores, imóveis) | Exemplo | Semente de demonstração (`telas_padrao_b.md`, seção 5) |

Ordem de autoridade: SDK instalado > spec seção 11 (comportamento) > **este contrato (forma)** > mockups HTML.

## 2. Arquivos

| Tela | Título | Área (px) | Imagem | Medidas | Mockup |
|---|---|---|---|---|---|
| P01-Hoje | Hoje | 1289 × 870 | `png/P01-Hoje.png` | `P01-Hoje.layout.json` | `../telas/P01-Hoje.html` |
| P02-Conversas | Conversas | 1289 × 1285 | `png/P02-Conversas.png` | `P02-Conversas.layout.json` | `../telas/P02-Conversas.html` |
| P03-Funil | Clientes · Funil | 1289 × 870 | `png/P03-Funil.png` | `P03-Funil.layout.json` | `../telas/P03-Funil.html` |
| P04-Cliente | Clientes · Lista e ficha | 1289 × 870 | `png/P04-Cliente.png` | `P04-Cliente.layout.json` | `../telas/P04-Cliente.html` |
| P05-Assistente | Assistente aberto | 1289 × 870 | `png/P05-Assistente.png` | `P05-Assistente.layout.json` | `../telas/P05-Assistente.html` |
| P06-Imoveis | Imóveis · Carteira e ficha | 1289 × 870 | `png/P06-Imoveis.png` | `P06-Imoveis.layout.json` | `../telas/P06-Imoveis.html` |
| P07-Novo-imovel | Imóveis · Novo imóvel | 1289 × 870 | `png/P07-Novo-imovel.png` | `P07-Novo-imovel.layout.json` | `../telas/P07-Novo-imovel.html` |
| P08-Estudio | Estúdio | 1289 × 870 | `png/P08-Estudio.png` | `P08-Estudio.layout.json` | `../telas/P08-Estudio.html` |
| P09-Pagina | Página | 1289 × 870 | `png/P09-Pagina.png` | `P09-Pagina.layout.json` | `../telas/P09-Pagina.html` |
| P10-Numeros | Números | 1289 × 870 | `png/P10-Numeros.png` | `P10-Numeros.layout.json` | `../telas/P10-Numeros.html` |
| P11-Mensageiro | Ajustes · Mensageiro | 1289 × 1045 | `png/P11-Mensageiro.png` | `P11-Mensageiro.layout.json` | `../telas/P11-Mensageiro.html` |
| P12-Conexoes | Ajustes · Conexões | 1289 × 870 | `png/P12-Conexoes.png` | `P12-Conexoes.layout.json` | `../telas/P12-Conexoes.html` |
| P13-Conta | Ajustes · Conta, marca e plano | 1289 × 870 | `png/P13-Conta.png` | `P13-Conta.layout.json` | `../telas/P13-Conta.html` |
| P14-Importar | Clientes · Importar | 1289 × 870 | `png/P14-Importar.png` | `P14-Importar.layout.json` | `../telas/P14-Importar.html` |
| P15-Negociacoes | Clientes · Negociações | 1289 × 914 | `png/P15-Negociacoes.png` | `P15-Negociacoes.layout.json` | `../telas/P15-Negociacoes.html` |
| P16-Mandato | Mandato de negociação | 1289 × 1418 | `png/P16-Mandato.png` | `P16-Mandato.layout.json` | `../telas/P16-Mandato.html` |
| P17-Negociador | Ajustes · Negociador | 1289 × 1236 | `png/P17-Negociador.png` | `P17-Negociador.layout.json` | `../telas/P17-Negociador.html` |
| M1-Hoje | Celular · Hoje | 390 × 844 | `png/M1-Hoje.png` | `M1-Hoje.layout.json` | `../telas/M1-Hoje.html` |
| M2-Conversa | Celular · Conversa | 390 × 844 | `png/M2-Conversa.png` | `M2-Conversa.layout.json` | `../telas/M2-Conversa.html` |
| M3-Novo-imovel | Celular · Novo imóvel | 390 × 844 | `png/M3-Novo-imovel.png` | `M3-Novo-imovel.layout.json` | `../telas/M3-Novo-imovel.html` |
| M4-Portal | Cliente · Portal (conversa) | 390 × 844 | `png/M4-Portal.png` | `M4-Portal.layout.json` | `../telas/M4-Portal.html` |
| M5-Portal-imoveis | Cliente · Portal (imóveis) | 390 × 844 | `png/M5-Portal-imoveis.png` | `M5-Portal-imoveis.layout.json` | `../telas/M5-Portal-imoveis.html` |
| M6-Pagina-publica | Visitante · Minha Página | 390 × 844 | `png/M6-Pagina-publica.png` | `M6-Pagina-publica.layout.json` | `../telas/M6-Pagina-publica.html` |
| M7-Proprietario | Proprietário · Portal (fase 3) | 390 × 844 | `png/M7-Proprietario.png` | `M7-Proprietario.layout.json` | `../telas/M7-Proprietario.html` |
| M8-Aprovar-negociacao | Celular · Aprovar negociação | 390 × 844 | `png/M8-Aprovar-negociacao.png` | `M8-Aprovar-negociacao.layout.json` | `../telas/M8-Aprovar-negociacao.html` |

## 3. Constantes de layout (versão 2)

**Moldura no computador (viewport de 1440 px).** A app vive dentro da página do shell: barra do shell, cabeçalho do shell com o botão **Criar** e margem de 24 px. Isso ocupa cerca de 130 px acima da área da app. **As imagens e os JSONs mostram só a área da app**, com 1289 px de largura; a conferência mede a partir do canto superior esquerdo dessa área.

| Elemento | Medida |
|---|---|
| Menu principal | É o menu do shell (`nav` do manifesto). **A app não desenha trilho próprio** |
| Criar | No cabeçalho do shell |
| Assistente | Botão de 34 × 34 px, raio 10, fundo IA claro, ícone de brilho, no fim do cabeçalho da coluna esquerda de toda tela |
| Coluna esquerda (lista) | **360 px fixos**; borda direita 1 px |
| Coluna central (foco) | **Flexível** (589 px em viewport de 1440) |
| Coluna direita (contexto) | **340 px fixos**; padding 18 px 16 px; gap 14 px |
| Gaveta (Mandato) | 760 px, alinhada à direita, sobre o conteúdo esmaecido |
| Cabeçalho de coluna | padding 18 px 16 px 12 px; título 22 px/700; subtítulo 13 px |
| Título de seção da lista | 12 px/700, caixa alta; padding 14 px 16 px 6 px |
| Item de lista | padding 12 px 16 px; avatar 36 px; nome 14 px/700; linha secundária 12 px |
| Busca e campos | **altura 36 px**; raio 10 px; padding 0 12 px; 14 px |
| Botão | **altura 34 px**; padding 0 16 px (pequeno: 0 12 px); raio 10 px; 14 px/700 (pequeno 13 px) |
| Botão de ícone | 34 × 34 px |
| Chips | padding 3 px 9 px; raio 999 px; 12 px/700; gap 6 px |
| Cartão | padding 16–20 px; **raio 12 px**; borda 1 px |
| Texto base | 14 px; linha 1,45–1,5 |
| KPI | rótulo 12 px/700 caixa alta; valor 28 px/700 (22 px em contexto) |
| Bolha de mensagem | máx. 72% da largura; padding 10 px 12 px; raio 12 px |
| Gap entre cartões | 12 px |
| Peso de fonte | **máximo 700** (o peso 800 não existe na fonte do tema) |

**Celular (390 × 844):** abaixo do cabeçalho do shell; conteúdo com padding 16 px e gap 12 px; botões com 34 px de altura e campos com 36 px (primitivos da plataforma); atalhos do dia no rodapé da página.

## 4. Cores do mockup → papel → token

| Hex no mockup | Papel | Token (confirmar o nome no SDK) |
|---|---|---|
| `#F4F3EF` | fundo da página | fundo base |
| `#FFFFFF` | superfície | superfície |
| `#E2E0D8` | linha | borda |
| `#1B2330` / `#4F5968` | texto / secundário | texto / texto suave |
| `#0B6B6F` / `#E3F1F1` | ação principal / seleção | primária / primária suave |
| `#5B3FB8` / `#EFEAFB` | IA | acento (ou exceção nomeada "ia") |
| `#B3261E` / `#FBE6E4` | quente, urgente | perigo |
| `#7A5000` / `#FBF1DC` | morno, aguardando | aviso |
| `#2F5DA8` / `#E6EEFA` | frio, informação | informação |
| `#1E6B3A` / `#E4F3E8` | sucesso, validado | sucesso |

## 5. Como ler o JSON

Cada arquivo tem `viewport` (largura da área e altura do conteúdo) e `nos`: elementos com `box` (x, y, largura, altura em px, relativos ao canto superior esquerdo da área da app), `parent` (árvore), `label` (`aria-label`), `text` e `style` (`display`, `direction`, `gap`, `columns`, `padding`, `bg`, `border`, `radius`, `font` tamanho/peso, `color`). Medido com Manrope; com a fonte do tema, larguras de texto variam alguns pixels, mas **posições de blocos e tamanhos de componentes não devem variar além de ±4 px**.

## 6. Conferência visual (obrigatória em todo PR de tela)

1. Abrir a tela da app na instância de teste com a conta "(demo)" e a semente, em viewport de 1440 px de largura (celular: 390 × 844).
2. Capturar **só a área da app** (sem a barra e o cabeçalho do shell) e colocar lado a lado com `png/<tela>.png`.
3. Conferir: (a) colunas e larguras 360 · flexível · 340; (b) presença e ordem de cada bloco e controle; (c) tamanhos pelo `box` do JSON; (d) espaçamentos e fontes; (e) papéis de cor.
4. No PR, tabela "diferença · causa · decisão" para tudo fora da tolerância e as duas capturas anexadas.

Uma tela só está pronta sem diferença estrutural (bloco faltando, fora de ordem ou na coluna errada).
