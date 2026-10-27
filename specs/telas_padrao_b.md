# Telas do Padrão B — guia visual para a implementação

> **Divergências com a spec (nota de 27/10/2026, spec 1.2).** Este guia e os mockups vieram do insumo do dono de 27/10, desenhado antes de decisões que a `main` já tinha tomado. **Onde a spec decidiu diferente do mockup, vale a spec** (`specs/portal_corretor.md`, seção 11):
> - **P04 e M4/M5/M5b — Portal do Cliente com login:** no MVP o portal é página pública por **link com token**, sem login e sem role `cliente`; as ações entram pelo `wh` do portal (D-56, D-73, D-104). Na P04, "Liberar item" vira gerar, reenviar e revogar o link do portal.
> - **P08 — Estúdio com Canva (preenchimento automático) e aprovação por janela:** a arte é feita **fora do app**, no Canva IA do corretor, a partir da descrição que o Estúdio prepara; sem Canva Enterprise, sem preenchimento automático, **sem aprovação por janela**; peças em listas por etapa (D-86, D-89 a D-91, D-105).
> - **P03 — listas salvas:** saem; ficam os filtros prontos (D-83).
> - **P13 — CRECI com estado de verificação:** o CRECI é opcional e nunca bloqueia; não há estado "em verificação" (D-93).
> - **Também:** menu com os nomes do Padrão B e rotas antigas como apelidos (D-103); onde o shell desenha o `nav`, o trilho fica só com Criar e Assistente (spec 11.0.1); ficha do contato de duas colunas (D-92) no centro e na direita, e carteira em **lista com miniatura** (D-106); Assistente na coluna de contexto (D-109); Negociador sem WhatsApp no MVP (D-107); negociador humano só com a política multi-usuário e convite sem CRECI (D-94, D-108); P16 abre em `urbi-modal` (gaveta é lacuna). As decisões do insumo (D-55 a D-63 dele) foram renumeradas na spec a partir de D-95 (tabela no PR da issue #88).

Este arquivo traduz o canvas de design aprovado pelo dono (Padrão B, 18 e 19/10/2026) em algo que a sessão de implementação consegue ler. Ele **não substitui** a spec: o que cada tela faz, cada comando, rota, evento e integração está em `specs/portal_corretor.md`, **seção 11**. Aqui ficam a forma de cada tela, os componentes que se repetem e os dados de exemplo.

**Mockups:** cada tela tem um arquivo HTML estático em `specs/telas/` (índice em `specs/telas/index.html`). Abra no navegador para ver a tela. São **referência visual**: na app, use os primitivos `urbi-*` e os tokens do tema; não copie o CSS dos mockups. As cores abaixo indicam **papéis semânticos** que devem ser mapeados para tokens do UrbiVerso.

**Ordem de autoridade em caso de conflito:** SDK instalado > spec seção 11 > este guia > mockups HTML.

---

## 1. Papéis visuais (mapear para tokens do tema)

| Papel | Cor no mockup | Uso |
|---|---|---|
| Fundo da página | `#F4F3EF` | Área atrás das colunas |
| Superfície | `#FFFFFF` | Colunas, cartões |
| Linha | `#E2E0D8` | Bordas e divisores |
| Texto | `#1B2330` · secundário `#4F5968` | Todo texto; secundário com contraste ≥ 4,5:1 |
| **Ação principal** | `#0B6B6F` (fundo claro `#E3F1F1`) | Botões primários, item ativo do trilho, seleção |
| **IA** | `#5B3FB8` (fundo `#EFEAFB`) | Tudo que a IA sugere ou faz: Assistente, Mensageiro, Negociador, "Resumir" |
| Quente | `#B3261E` / `#FBE6E4` | Temperatura quente, "Precisa de você", alertas |
| Morno | `#7A5000` / `#FBF1DC` | Temperatura morna, aguardando aprovação |
| Frio | `#2F5DA8` / `#E6EEFA` | Temperatura fria, oferta do comprador na faixa ZOPA |
| Sucesso | `#1E6B3A` / `#E4F3E8` | Validações passaram, conectado, publicado |
| Neutro | `#4F5968` / `#EEEDE7` | Chips informativos |

Tipografia do mockup: Manrope 400–800 (na app, a fonte do tema). Raios: cartões 14 px, botões 10 px, chips 999 px. Alvo de toque mínimo 44 px. Temperaturas diferem em claridade além da cor (acessibilidade).

## 2. Moldura (toda tela do corretor)

```
┌──────┬──────────────────────┬────────────────────────────────┬──────────────────────┐
│ [+]  │ ESQUERDA · lista      │ CENTRO · foco                   │ DIREITA · contexto   │
│Criar │ título + ações        │ cabeçalho do item               │ próxima ação (IA)    │
│      │ busca                 │                                 │ números do item      │
│ Hoje │ chips de filtro       │ conteúdo principal              │ atalhos              │
│ Conv.│ ─────────────────     │                                 │                      │
│ Clie.│ item selecionado ■    │                                 │ (o Assistente abre   │
│ Imóv.│ item                  │                                 │  nesta coluna)       │
│ Estú.│ item                  │                                 │                      │
│ Pág. │                       │ rodapé: compositor / ações      │                      │
│ Núm. │                       │                                 │                      │
│ Ajus.│                       │                                 │                      │
│ [✦]  │                       │                                 │                      │
│Assis.│                       │                                 │                      │
└──────┴──────────────────────┴────────────────────────────────┴──────────────────────┘
  88px      340–380px                 flexível (≥ 520px)               300–360px
```

Responsivo, celular e estados obrigatórios: spec 11.0.3 e 11.0.4.

## 3. Componentes que se repetem

| Componente | Aparência | Onde | Primitivo sugerido |
|---|---|---|---|
| **Chip de temperatura** | Pílula com fundo claro e texto forte: Quente / Morno / Frio | Listas, fichas, cartões | `urbi-badge` |
| **Chip de status e origem** | Pílula neutra ou colorida: "Visita marcada", "Veio do anúncio X" | Conversas, Funil | `urbi-badge` |
| **Cartão de ação** | Avatar ou ícone, chip de tipo, título, uma frase, **um** botão principal e no máximo um secundário | Hoje, M1 | `urbi-card` |
| **Bolha de mensagem** | Cliente à esquerda em branco; Mensageiro e Negociador à direita em lilás com rótulo; corretor à direita em verde claro; aviso de sistema centralizado em âmbar | Conversas, Portal | `urbi-chat` |
| **Cartão de imóvel no chat** | Foto, título · bairro, área · quartos, preço, dois botões ("Quero visitar", "Ver fotos") | Conversas, Portal | `urbi-card` dentro do `urbi-chat` |
| **Cartão de sugestão da IA** | Borda lilás de 2 px, rótulo "… sugere", texto, linha verde de validações, botões Enviar · Editar · Descartar | Conversas, Negociação, M8 | `urbi-card` |
| **Caixa da IA** | Fundo lilás claro, ícone de brilho, título, frase e botão | Contexto de várias telas | `urbi-card` |
| **Seletor de três posições** | Grupo segmentado: Não faz · Pergunta antes · Faz sozinho | Mensageiro, Mandato | lacuna (spec 11.9) |
| **Faixa ZOPA** | Régua horizontal vermelha clara com trecho verde (ZOPA estimada) e marcas verticais rotuladas: oferta do comprador, ponto de recuo (sigiloso, mascarado), teto estimado do comprador, alvo, preço pedido | Negociações, M8 | lacuna (spec 11.9) |
| **Escada de propostas** | Tabela por rodada: quem, valor, condições, concessão, contrapartida, quando | Negociações | `urbi-tabela` ou `urbi-feed` |
| **Barra de qualidade** | Barra com nota 0–100 colorida (≥ 80 sucesso, 60–79 morno, < 60 quente) e lista do que falta | Imóveis | barra simples |
| **Valor sigiloso** | "•••• mostrar" em negrito; nunca em superfície do cliente | Mandato, Negociações | texto + botão |

## 4. Telas (wireframes)

Legenda: `[Botão]`, `(chip)`, `■` item selecionado, `▸` navegação. Spec = seção 11.1 salvo indicação.

### P01 · Hoje — `telas/P01-Hoje.html`
```
ESQUERDA                     │ CENTRO                                  │ DIREITA
Hoje                          │ Fila do dia          na ordem do mais…  │ Agenda
Quinta, 23 · Mensageiro…      │ ┌ (Visita hoje · 10 h) Ana Ribeiro… ┐   │ 10:00 Visita · Ana
PRECISA DE VOCÊ · 2           │ │ frase           [Abrir roteiro][…]│   │ 14:30 Ligar Juliana
■ Juliana · negociar [Assumir]│ └───────────────────────────────────┘   │ Sua semana (4 KPIs)
  Ana · proposta?   [Assumir] │ ┌ (Quente) Juliana ofereceu…        ┐   │ Dica do Assistente
PRIMEIROS PASSOS · 3 de 5     │ ┌ (Aprovar) 3 peças do lançamento   ┐   │  [Ligar o Mensageiro]
▬▬▬▬▬▬░░░░                   │ ┌ (Retomar) 3 frios abriram…        ┐   │
✓ WhatsApp ✓ Instagram ✓ Imóvel│ [ Mais 6 para depois ]                 │
▸ Ligar Mensageiro ▸ Publicar │                                         │
```

### P02 · Conversas — `telas/P02-Conversas.html`
```
Conversas [Nova]              │ Ana Ribeiro (Quente)(Visita sáb)(Veio do │ PRÓXIMA ABORDAGEM (IA)
[busca]                       │ anúncio…)   (Rafael assumiu)[Reativar…]  │  [Usar mensagem pronta]
(Minha vez 3)(Mensageiro 2)   │ ─ Hoje · chegou pelo anúncio ─           │ Enviado para Ana
(Negociador)(Aguardando)…     │ cliente ▢        ▢ Mensageiro            │  cartão casa (Clicou)
■ Ana Ribeiro  (Visita)(Anún.)│ ▢ cartão do imóvel [Quero visitar]       │ Também combinam
  Juliana Prado (Pediu preço) │ ─ Mensageiro passou para Rafael: preço ─ │  imóvel [Enviar]
  Carlos …                    │ [Imóvel][Seleção][Arquivo][Local][Visita]│ Perfil de busca (chips)
                              │ [Portal][Proposta]                        │ [Abrir ficha completa]
                              │ [✦ Sugestão] 📎 [texto………] 🎤 [➤]        │
                              │ Janela de 24 h aberta até…               │
```

### P03 · Clientes › Funil — `telas/P03-Funil.html`
```
Clientes [Novo]               │ Funil de compra (23)  86% 31% 28% 40%    │ Juliana Prado
[Funil|Lista|Negociações]     │ ┌Novo┐┌Qualif┐┌Visita┐┌Visitou┐┌Prop.┐   │ (Quente)(Proposta)
FUNIS                         │ │card││card  ││card  ││card   ││■card│   │ Por que quente: …
■ Compra (23)  Captação (8)   │ └────┘└──────┘└──────┘└───────┘└─────┘   │ PRÓXIMA ABORDAGEM
POR TEMPERATURA               │  arrastar muda etapa; Perdido pede motivo│ [Registrar proposta]
Quentes 5 · Mornos 9 · Frios 10│                                          │ [Resumir][Tarefa][Conversa]
LISTAS SALVAS                 │                                          │ Enviado (abertos/cliques)
```

### P04 · Clientes › Lista e ficha — `telas/P04-Cliente.html`
```
Clientes [Importar][Novo]     │ (Ana) Ana Ribeiro  tel · e-mail · papel  │ Perfil de busca (chips)
[Funil|Lista|Negociações]     │ (Quente)(Visita)(Anúncio) [Conversa][Res.]│ Portal do cliente
[busca]  (Todos)(Compr.)(Prop.)│ [Resumo|Linha do tempo|Enviados|Negócios │  convite aceito · vê 3
■ Ana Ribeiro      (Quente)   │  |Negociação]                            │  [Liberar item][Reenviar]
  Juliana Prado    (Quente)   │ ▢ 10:42 Mensageiro marcou visita         │ Privacidade
  …                           │ ▢ 10:40 passou para você: preço          │  [Exportar][Remover]
```

### P05 · Assistente aberto — `telas/P05-Assistente.html`
Coluna direita substituída pelo painel do Assistente (largura 380–440 px): título com fechar; conversa; resposta com artigo da ajuda e `[Ir para Conexões]`; **ação proposta** em cartão com borda lilás ("Vou criar esta regra: …" `[Confirmar][Cancelar]`); chips de perguntas sugeridas; campo, microfone, enviar.

### P06 · Imóveis › Carteira e ficha — `telas/P06-Imoveis.html`
```
Imóveis [Novo]                │ Casa 4 quartos · Jardim Botânico [Editar] │ Qualidade do anúncio · 92
[Carteira 14|Empreend. 3]     │ [Criar conteúdo]                          │ ▬▬▬▬▬▬▬▬▬░
[busca] (Ativos)(Rascunhos)…  │ ┌capa grande┐┌sala┐┌coz.┐                 │ ✓ 12 fotos ＋ vídeo …
■ ▢ Casa J. Botânico  92 Ativo│ │           │┌suíte┐┌+8┐                 │ Últimos 30 dias (4 nºs)
  ▢ Apto Sudoeste     78      │ Dados (grade 3×2)                         │ Clientes que combinam
  ▢ Lote …            64      │ Descrição [Melhorar com IA]               │  Ana 92% [Enviar]
                              │ [Autorização de venda][Quem vê este imóvel]│
```

### P07 · Imóveis › Novo imóvel — `telas/P07-Novo-imovel.html`
Esquerda: passos (✓ Fotos · ■ Dados · Autorização · Onde aparece) e `[Salvar rascunho]`. Centro: grade de fotos com "(Capa sugerida)"; formulário 3 colunas com rótulo "· preenchido pela IA" e campo obrigatório vazio com borda âmbar; `[Ditar por voz]`; `[Voltar][Próximo: autorização]`. Direita: "Qualidade agora · 64", o que falta, caixa da IA "Depois de salvar…".

### P08 · Estúdio — `telas/P08-Estudio.html`
```
Estúdio  ◎ @conta conectado   │ Você: "Faz um pacote de lançamento…"      │ Esta semana
CRIAR RÁPIDO (2×2)            │ Estúdio: "Pronto: post, story e carrossel…"│  Sex 18 h Post (Agendado)
[Lançamento][Baixou o preço]  │  ▢post 1:1  ▢story 9:16  ▢carrossel 4:5   │  Sáb 9 h Story (Aprovar)
[Vendido][Visita aberta]      │  legenda · ✓ CRECI, autorização, link     │ ☑ Publicar no horário se
SEUS PEDIDOS                  │  [Agendar sex 18 h][Publicar agora][Baixar]│   eu não mexer
■ Lançamento · Casa J. Bot.   │ Você: "Troca a capa…"  Estúdio refazendo…  │ Biblioteca [Baixar]…
                              │ [pedido………] 🖼 🎤 [➤]                     │ Créditos do mês ▬▬░
```

### P09 · Página — `telas/P09-Pagina.html`
Esquerda: endereço e estado, `[Publicar]`, blocos arrastáveis com caixa "Mostrar" (o selecionado destacado), `[Refazer a página com IA]`. Centro: `[Celular|Computador]` e a pré-visualização (capa escura com foto, nome, CRECI, `[Falar no WhatsApp]`; bloco selecionado com borda). Direita: ajustes do bloco, cores da marca, visitas e contatos, `[Copiar link]`.

### P10 · Números — `telas/P10-Numeros.html`
Esquerda: lista de relatórios (Resumo · ■ Funil e conversão · Origem · Tempo de resposta · Conteúdo · Mensageiro · Negociação · Créditos). Centro: título com `(30 dias)(Comparar)(Todas as origens)`, 4 KPIs, barras do funil, "Contatos por horário" (fora do horário em lilás) e "Por que perdemos". Direita: caixa "O que melhorar" com `[Ver os 9 clientes]`, melhores origens, `[Exportar CSV]`.

### P11 · Ajustes › Mensageiro — `telas/P11-Mensageiro.html`
Esquerda: menu de Ajustes (■ Mensageiro · Negociador · Conexões · Conta e marca · Plano e créditos · Funil e abordagens · Horário · Privacidade). Centro: `(Ligado)[Pausar]`, barra de 5 passos, lista de ações com seletor de três posições, quadro "Nunca faz", `[Voltar][Próximo]`. Direita: conversa de teste e números do mês.

### P12 · Ajustes › Conexões — `telas/P12-Conexoes.html`
Centro: cartão WhatsApp com 3 passos numerados (✓ ✓ ■ "Confirmar no celular" `[Mostrar código]`), cartão Instagram `(Conectado)` com `[Testar publicação][Desconectar]`, cartão Agenda `(fase 6)`. Direita: "Por que conectar aqui", caixa do Assistente.

### P13 · Ajustes › Conta, marca e plano — `telas/P13-Conta.html`
Centro: perfil (foto, nome, CRECI com chip de verificação, WhatsApp, regiões), marca (logo, 4 cores, tom de voz em 3 opções), `[Salvar]`. Direita: plano, créditos do mês com barra, tabela de custo por ação.

### P14 · Clientes › Importar — `telas/P14-Importar.html`
Esquerda: fontes (■ Planilha/CSV · vCard · Outro CRM). Centro: arquivo e linhas, mapeamento coluna → campo (sugerido pela IA), prévia com o que acontece em cada linha, `[Importar N contatos]`. Direita: regra para repetidos (Pular · ■ Completar · Substituir) e regra de consentimento.

### P15 · Clientes › Negociações — `telas/P15-Negociacoes.html`
```
Clientes [Nova proposta]      │ (AR) Ana · Casa J. Botânico     [Assumir] │ MANDATO
[Funil|Lista|■Negociações]    │ (Rodada 3 de 4)(Negociador IA · pergunta  │ Pedido  R$ 1.450.000
(Aguardando você)(Negociador) │  antes)(Mandato válido até 30/10)         │ Alvo    R$ 1.400.000
(Cliente)(Proprietário)…      │ ┌ Faixa da negociação ───────────────────┐│ Recuo   •••• mostrar
■ Ana · R$1,32mi −9% (Neg. IA)│ │ oferta  recuo  teto  alvo      pedido  ││ Concessões: prazo, móveis
  Juliana · −6% (Aguard. você)│ │ ▬▬▬▬▬▬▬|▬▬▬▬▬▬▬▬|▬▬▬|▬▬▬▬▬▬▬▬▬|        ││ [Editar mandato]
  Paula · −6% (Aguard. cliente│ │        [  ZOPA  ]                       ││ LEITURA DO COMPRADOR
  Carlos (Aguard. proprietário│ └─────────────────────────────────────────┘│ (Objeção: preço)(Interesse…)
                              │ Escada: rodada · quem · valor · condições │ Teto ~R$ 1,39 mi · fonte…
                              │  · concessão · contrapartida · quando     │ PRÓXIMO MOVIMENTO (IA)
                              │ cliente: "1,40 está acima… consigo 1,32?" │ R$ 1.380.000 + 60 dias
                              │ ┌ Negociador sugere · rodada 4 ──────────┐│ ↔ entrada 30%
                              │ │ texto… ✓ acima do recuo · passo menor  ││ [Usar sugestão]
                              │ │ [Enviar][Editar][Descartar]            ││ [Passar ao proprietário]
```
Exemplo numérico coerente com as regras: pedido 1.450.000 → vendedor 1.400.000 (concede 50 mil) → sugestão 1.380.000 (concede 20 mil, menor que a anterior), acima do recuo 1.360.000 e dentro da ZOPA estimada (recuo 1.360.000 a teto 1.390.000).

### P16 · Mandato de negociação — `telas/P16-Mandato.html`
Gaveta de ~760 px sobre P15 (fundo esmaecido). Cabeçalho "Mandato de negociação · Ana · versão 2" com fechar. Quatro blocos numerados: **1 Valores** (pedido, alvo, recuo com aviso vermelho "sigiloso, o cliente nunca vê", BATNA do vendedor em texto, validação "✓ recuo ≤ alvo ≤ pedido"); **2 Concessões e contrapartidas** (linhas "concessão ↔ contrapartida", `[Adicionar concessão]`, passo máximo, rodadas); **3 Prazo e validade**; **4 Quem negocia e autonomia** (IA ou pessoa; Só sugere · ■ Pergunta antes · Faz sozinho; autorização do proprietário `[Anexar documento][Registrar por mensagem]`). Rodapé `[Cancelar][Salvar mandato]`.

### P17 · Ajustes › Negociador — `telas/P17-Negociador.html`
Centro em grade de 2 colunas com 6 seções numeradas: 1 Quando entra (4 caixas), 2 Quem negocia por padrão (IA ou pessoa, `[Convidar negociador]`), 3 Estilo (3 cartões com frase de exemplo), 4 Regras fixas (lista com ✓, não editável), 5 Suas instruções (texto com contador 4.000), 6 Respostas a objeções (lista por categoria com `(Padrão)` ou `(Minha resposta)`). Direita: **7 Testar** (simulador com a pergunta "Qual o mínimo que o dono aceita?" e a resposta que não revela o recuo, linha "✓ não revelou o recuo"), números do mês e custo por rodada.

### M1 · Celular · Hoje — `telas/M1-Hoje.html`
Cabeçalho do shell ("Portal do Corretor ▾", avatar); "Hoje"; "Precisa de você · 2" (cartões vermelho/âmbar); "Fila do dia" (cartões de uma linha); rodapé da página com 4 atalhos: Conversas (3) · Criar · Imóveis · Assistente.

### M2 · Celular · Conversa — `telas/M2-Conversa.html`
Voltar, avatar, nome e estado; faixa lilás com resumo; mensagens; aviso de passagem; ações rápidas (Sugestão · Imóvel · Portal); campo arredondado e botão de áudio.

### M3 · Celular · Novo imóvel — `telas/M3-Novo-imovel.html`
"Passo 1 de 4"; botão grande tracejado "Tirar fotos ou escolher da galeria"; grade 3 colunas de miniaturas; caixa da IA "A IA já entendeu…"; botão "Ditar o resto…"; rodapé `[Salvar rascunho][Continuar]`.

### M4 · Cliente · Portal (conversa) — `telas/M4-Portal.html`
"Meu atendimento ▾"; faixa verde "Próximo passo · Visita sábado às 10 h [Ver]"; abas Conversa · Imóveis 3 · Agenda 1 · Arquivos 2 (· Propostas quando houver); conversa com cartão de imóvel; campo "Escreva para o Rafael".

### M5 · Cliente · Portal (imóveis) — `telas/M5-Portal-imoveis.html`
Aba Imóveis ativa; imóvel em destaque com galeria, chip de visita e `[Gostei][Não gostei][Comentar]`; outros imóveis com a reação dada; cartão "O que falta de você" com caixa de seleção. A aba **Propostas (M5b)** segue o mesmo padrão em linha do tempo (spec 11.3) e nunca mostra mandato.

### M6 · Visitante · Minha Página — `telas/M6-Pagina-publica.html`
Página pública sem login: endereço; capa escura com foto, nome, CRECI e `[Falar no WhatsApp]`; "Imóveis em destaque" em cartões com `[Quero saber mais]`. CSS próprio com a cor da marca do corretor (sem tokens de tema).

### M7 · Proprietário · Portal (fase 3) — `telas/M7-Proprietario.html`
Imóvel e dias à venda; 3 números (vistas, visitas, propostas); "O que o corretor está fazendo" (entregas com estado); "Proposta recebida (Nova)" `[Ver detalhes][Falar com Rafael]`; "Retorno das visitas · revisado pelo corretor"; faixa "Fase 3".

### M8 · Celular · Aprovar negociação — `telas/M8-Aprovar-negociacao.html`
Voltar, "Ana · rodada 4 de 4"; faixa ZOPA compacta; "Última oferta R$ 1.320.000" com a frase do cliente e `(Objeção: preço)`; cartão lilás "Negociador sugere R$ 1.380.000 · concede entrega em 60 dias · pede entrada de 30%…" com a mensagem e "✓ acima do recuo · dentro do mandato"; rodapé `[Enviar][Editar][Assumir]`.

## 5. Dados de exemplo (usar na semente de demonstração)

Corretor de teste: **Rafael Gualberto**, CRECI fictício, Brasília. Clientes: **Ana Ribeiro** (quente, visita sábado 10 h, veio do anúncio do Instagram, casa 4 quartos até R$ 1,5 mi, financiamento aprovado; em negociação), **Juliana Prado** (quente, proposta de R$ 920 mil no apartamento do Sudoeste), **Carlos Menezes** (morno, qualificado, veio da Minha Página), **Fernanda Souza** (morna, nova, indicação, quer lote), **Roberto Lima** (frio, sem resposta há 9 dias), **Marcos Teixeira** (frio, visitou o lote). Imóveis: **Casa 4 quartos · Jardim Botânico** (R$ 1.450.000, 320 m², qualidade 92), **Apartamento 3 quartos · Sudoeste** (R$ 980.000, 112 m², 78), **Lote 450 m² · Reserva do Colorado Q1-03** (R$ 395.000, 64), **Cobertura 3 quartos · Noroeste** (R$ 2.100.000, rascunho, 41). Negociação de exemplo: a de P15 (seção 4). Um **segundo corretor** com seus próprios clientes e imóveis entra na semente só para o teste de isolamento (spec 4.5).
