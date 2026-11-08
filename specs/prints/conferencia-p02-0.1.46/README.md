# Conferência visual do grupo 1 — moldura v2 e P02 Conversas (app 0.1.46, 08/11/2026)

Conferência da seção 6 de `specs/layout/README.md` (contrato versão 2) do **grupo 1 da fase 1.7**: a moldura do shell (D-114) e a P02 Conversas completa sem WhatsApp (D-116). Capturas da **app real na homologação**, só da área da app, lado a lado com a referência aprovada pelo dono.

| | |
|---|---|
| App na instância | 0.1.46, build `6a4d1e8` (pré-release do branch `grupo1/moldura-p02`, instalado pela atualização automática da homologação) |
| Shell | 0.56.37 |
| Conta | **Corretor A (demo)** (id 7), criada nesta sessão com usuário externo `corretor`; cinco conversas semeadas pelos caminhos reais (Portal do Cliente, compositor, envio de imóvel, link do portal), a de Ana Ribeiro com negociação conduzida pelo Negociador IA |
| Viewport | 1440 de largura no computador (altura 1420, para a área da app mostrar as colunas inteiras sem rolar) |
| Área capturada | só a moldura de três colunas (`urbi-3-colunas`), sem a barra nem o cabeçalho do shell: 1392 × 1221 px |
| Fonte | a fonte do tema vem do Google Fonts, bloqueado na rede do ambiente; a captura usa a fonte do sistema. Larguras de texto variam alguns pixels (README § 5); caixas e tamanhos não |
| Como entrou sem senha | `apps/portal_corretor/scripts/conferencia-visual/capturar.mjs` com `CONTA=7 CONVERSA=1` (ver `CLAUDE.md` › Armadilhas) |
| Como comparou | `comparar.py`: imagem lado a lado (esquerda a referência, direita a app) e medidas extraídas do DOM, atravessando shadow roots, no formato dos `.layout.json` |

Arquivos desta pasta: `P02-Conversas.png` (lado a lado), `P02-Conversas.app.png` (a captura da app sozinha), `P02-Conversas.app.json` (as medidas extraídas) e `medidas.md` (a tabela de medidas de todas as telas capturadas na mesma rodada, para a moldura).

## Moldura (vale para todas as telas do corretor no computador)

As 15 telas do computador foram capturadas na mesma rodada; a moldura é a mesma em todas (`medidas.md`).

| Medida | Referência v2 | App 0.1.46 | Diferença | Causa | Decisão |
|---|---|---|---|---|---|
| Menu | pelo shell (fora da área) | pelo shell: o `nav` do manifesto, oito itens + Equipe › Corretores; a app não desenha trilho | — | D-114 | Igual |
| Largura da área da app | 1289 | 1392 (1440 − 2 × 24 de margem da página do shell) | +103 | A referência reservou 103 px que o shell 0.56.37 não ocupa (a barra lateral do shell não existe no computador; o menu fica no botão do nome da app) | **Manter.** A largura cai toda no centro, que é flexível por decisão (D-114: "360 · flexível · 340") |
| Colunas | 360 · 589 · 340 | 360 · 691 · 339 | centro +102; contexto −1 | A mesma causa acima; o −1 é o filete da borda do `urbi-3-colunas` | Igual (lista e contexto dentro de ±4) |
| Título da coluna ("Conversas") | 22 px / 700, h1 | 20 px / 700, `urbi-prosa papel="titulo"` | −2 px | Tipografia do tema; o papel "título" do primitivo é 20 px | Dentro da tolerância; é o primitivo |
| Botão padrão ("Nova", ações rápidas, "Assumir") | 34 px, raio 10 | `urbi-botao` 34 px, raio 8 | raio −2 | Tema | Igual (o contrato v2 fixa 34 px; o raio do botão é do tema) |
| Botão Assistente | 34 × 34, só ícone, fundo da IA | `urbi-botao` só ícone com `ariaLabel`: 48 × 29 | +14 × −5 | O `urbi-botao` sem texto não vira quadrado: o padding lateral fica e a altura cai para a do conteúdo | **Registrar como diferença do primitivo** (README § 1: usar o primitivo e registrar). Pedido ao shell 24 |
| Campo de busca | 36 px (contrato v2 § 3) | `urbi-input` 34 px | −2 | Primitivo | Dentro da tolerância |
| Chips (filtros, status, origem) | 23 px, raio 999 | `urbi-chips-atalho` e `urbi-badge` 24 px, raio 999 | +1 | — | Igual |
| Cartão | raio 12, borda 1, padding 16 | `urbi-card` raio 12, padding 16 | — | — | Igual |
| Respiro da coluna | 16 px | `urbi-hospedeiro` 16 px | — | — | Igual |
| Assistente aberto | ocupa a coluna de contexto (D-109) | idem, 380 px | — | — | Igual (fora desta captura) |

## P02 Conversas — bloco a bloco (§ 6, itens a–e)

**(a) Colunas:** 360 · flexível · 340 ✔ (acima). **(b) Presença e ordem dos blocos:** confere abaixo. **(c) Tamanhos:** 34 / 34 / 24 / raio 12 ✔ (acima). **(d) Espaçamento e fonte:** respiro 16, gap 12 ✔; fontes 14 px no corpo, 12 px nas legendas (referência 14/12) ✔. **(e) Papéis de cor:** o Assistente e o Negociador em cor da IA, a temperatura "Quente" em alerta, a faixa do WhatsApp em aviso ✔.

Não há diferença estrutural (bloco faltando, fora de ordem ou na coluna errada). As diferenças de conteúdo e de primitivo:

| Bloco | Referência v2 | App 0.1.46 | Diferença | Causa | Decisão |
|---|---|---|---|---|---|
| Cabeçalho da lista | Conversas · [Nova] [✦] | Conversas · [+ Nova] [✦] | ícone no Nova | `urbi-botao icone` | Igual |
| Busca | "Buscar nome, telefone ou imóvel" | idem | — | — | Igual |
| Filtros | Minha vez 3 · Mensageiro 2 · Aguardando · Não lidas · Arquivadas | **Todas** · Minha vez 3 · Mensageiro · **Negociador 1** · Aguardando 2 · Não lidas 3 · Arquivadas | dois chips a mais | "Todas" é o chip ativo por padrão do `urbi-chips-atalho` (sem ele não há como limpar o filtro); "Negociador" é o filtro da tabela de comandos da P02 (spec 11, "quem atende: Negociador"), que a referência omitiu | **Manter os dois**; o dono pode mandar tirar "Todas" (P-43) |
| Lista de conversas | avatar, nome, "há 12 min", última mensagem, chips de status e origem; item ativo com fundo | idem, mais o **ponto de não lida** à esquerda e o chip "1 nova"; item ativo só com `aria-current` (sem fundo) | ponto e chip a mais; destaque do ativo | `urbi-lista` marca o ativo por `itemAtivo` mas não o pinta: pintar exige `classe-item` com CSS da tela, que a regra 10 proíbe (o mesmo em Clientes e Imóveis) | **Registrar como diferença do primitivo**; pedido ao shell 24 |
| Faixa do WhatsApp | (não existe: a referência mostra o WhatsApp conectado) | "WhatsApp ainda não conectado…" com **Ajustes › Conexões** | bloco a mais, no topo do centro | D-116 (sem WhatsApp no grupo 1) | Por decisão |
| Cabeçalho da conversa | AR · Ana Ribeiro · Quente · Visita sáb. 10 h · Veio do anúncio: Casa J. Botânico; à direita "Rafael assumiu" · [Reativar Mensageiro] | AR · Ana Ribeiro · Quente · Veio de Anúncio Instagram; à direita "Negociador IA atendendo" · [Assumir] | o chip do próximo passo falta (o contato demo não tem visita marcada); o estado de quem atende é outro (na demo o Negociador conduz) | dado da conta demo; estado | Igual em estrutura. "Reativar Mensageiro" aparece desabilitado quando o corretor atende (D-116) |
| Separador do dia | "Hoje · chegou pelo anúncio…" | "Hoje" | sem a origem | a origem já está no chip do cabeçalho | Manter |
| Balões | cliente à esquerda (branco); Mensageiro à direita (lilás, rótulo "Mensageiro"); hora no canto | cliente à esquerda; corretor à direita com rótulo "Rafael Gualberto · registrada / pelo WhatsApp do celular"; hora embaixo | rótulo do autor e canal (D-116: sem Mensageiro, as saídas são do corretor); balão em `urbi-card` (raio 12, fundo de superfície) em vez de lilás | D-116; primitivo | Por decisão; a cor da IA entra no balão quando o Negociador escreve (`variante` do cartão) |
| Cartão de imóvel na conversa | foto, título, m² · qts · vagas, preço, **Quero visitar · Ver fotos** | título, código · bairro, preço, **Ver ficha** | sem foto; botões do corretor, não do cliente | "Quero visitar" e "Ver fotos" são os botões do cliente (portal/WhatsApp); na tela do corretor o cartão leva à ficha. A foto entra quando a mídia do imóvel estiver no envio (grupo 3, P06) | Manter; foto no grupo 3 |
| Aviso de sistema | "Mensageiro passou para o Rafael: assunto de preço" ao centro | avisos ao centro em `urbi-badge` (reações do cliente, assumir/devolver) | — | — | Igual (nenhum na conversa demo) |
| Lista de mensagens | enche o centro e **rola por dentro**, compositor fixo embaixo | idem: `urbi-hospedeiro expandir` aninhado (build `6a4d1e8`; no `73fd986` o centro corria inteiro e o compositor ficava abaixo da dobra) | — | — | Igual |
| Ações rápidas | Imóvel · Seleção · Arquivo · Localização · Agendar visita · Portal do cliente | idem + **Proposta** | um botão a mais | "Proposta" está na tabela de comandos da P02 (D-116: todos os comandos que não dependem do WhatsApp) | Manter |
| Sugestão | chip lilás "Sugestão: …" | `urbi-botao secundario` com ✦ "Sugestão: …" (um clique põe no compositor) | cor | primitivo | Igual |
| Compositor | [clipe] [casa] campo 38 px "Escreva como Rafael…" [mic] [enviar], 34 × 34 cada | `urbi-redator`: textarea 75 px (auto-resize) e **Enviar** 25 px; sem clipe (anexo é a ação rápida Arquivo); microfone só aparece quando o slot de áudio da IA está resolvido na instância (a homologação não tem) | altura e botões | primitivo `urbi-redator` (ui-componentes-conteudo.md § `audio`) | **Registrar como diferença do primitivo**; o microfone é só configuração da instância |
| Rodapé do compositor | "Janela de 24 h aberta até…" | "Sem o WhatsApp do app, a mensagem abre no WhatsApp do seu celular…" | texto | D-116 | Por decisão |
| Contexto · Próxima abordagem | caixa lilás com texto e "Usar mensagem pronta" | `urbi-card` com ✦, texto e "Usar mensagem pronta" | cor do cartão | primitivo | Igual |
| Contexto · Enviado para Ana | h2 + linhas "Casa J. Botânico (cartão) · Clicou", "Localização · Lida", "Seleção · Abriu 2x" | `urbi-card` "Enviado para Ana" + `urbi-lista` com "Casa 4 quartos · Enviado", "Link do portal · Enviado" | seção em cartão; estados do envio da demo | primitivo (`urbi-card` é o agrupador com título); dado | Igual |
| Contexto · Também combinam | 2 imóveis com foto, bairro, preço e **Enviar**; chips do perfil | cartão com a dica "Anote o perfil de busca na ficha…" (o contato demo não tem perfil de busca) | estado vazio | dado da demo | Igual em estrutura (com perfil, a app lista os imóveis ativos que batem, com Enviar) |
| Abrir ficha completa | link com › | `urbi-botao` bloco "› Abrir ficha completa" | botão em vez de link | primitivo | Igual |

## Diferenças que o primitivo impõe (README § 1, "usar o primitivo e registrar")

| Diferença | Primitivo | Valor do contrato v2 | Valor do primitivo |
|---|---|---|---|
| Botão só ícone (Assistente) | `urbi-botao` sem texto | 34 × 34 | 48 × 29 |
| Item ativo da lista | `urbi-lista` | fundo destacado | só `aria-current` (sem CSS da tela não há como pintar) |
| Compositor | `urbi-redator` | campo de 38 px com clipe, casa, microfone e enviar de 34 × 34 | textarea de 75 px com auto-resize e Enviar de 25 px; microfone condicionado ao slot de áudio |
| Título da coluna | `urbi-prosa papel="titulo"` | 22 px | 20 px |
| Raio do botão | `urbi-botao` | 10 | 8 |

## O que fica para o dono

1. **Área da app 1392 px e centro de 691 px** (referência 1289 e 589): manter, porque o centro é flexível por decisão (D-114); se o dono preferir o centro mais estreito, é um teto no `urbi-3-colunas` que o primitivo não tem hoje (pedido ao shell).
2. **"Todas" nos filtros** da P02: manter ou tirar.
3. **Botão Assistente 48 × 29**: fica como está até o shell dar um botão só ícone quadrado (pedido 24), ou o dono aceita como é.

## Como repetir

```bash
CONTA=7 CONVERSA=1 node apps/portal_corretor/scripts/conferencia-visual/capturar.mjs pinguim /tmp/capturas
python3 -I apps/portal_corretor/scripts/conferencia-visual/comparar.py /tmp/capturas /tmp/lado --md
```

O primeiro lê `URBIVERSO_INSTANCIAS` do ambiente e não imprime o token. O segundo precisa de Pillow e gera as imagens lado a lado e a tabela de medidas em Markdown.
