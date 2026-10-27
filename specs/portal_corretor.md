# Spec — Portal do Corretor (`portal_corretor`)

> Arquivo: `specs/portal_corretor.md`. Instruções de sessão em `CLAUDE.md`; ordem e status em `specs/plano_de_implementacao.md`; ajustes do shell em `specs/pedidos_ao_shell.md`.

## 1. Status e convenções

| Campo | Valor |
|---|---|
| Status | **1.2 — Padrão B, Negociador e CRECI opcional (27/10/2026).** Telas no Padrão B (11.0, D-95), com os nomes de menu do Padrão B e as rotas antigas como apelidos (D-103); novo papel **Negociador** (10.9, D-97), com negociação no MVP (D-100) e sem WhatsApp enquanto P-31/P-32 não chegam (D-107); CRECI opcional, nunca bloqueio (D-93). Funde o insumo do dono de 27/10 com a 1.1 (D-01 a D-92 valem). **1.1 (23/10/2026):** MVP 0.1.0 implementado (blocos 0–5, 8, 9 e 10a); simplificação e itens das cinco referências principais (2.7, 15.8, 15.9, D-80 a D-88). Escopo do MVP aprovado (D-41), MVP interno sem corretor real (D-43). Implementação guiada por `CLAUDE.md` e `specs/plano_de_implementacao.md` |
| Issue | A abrir no repositório do app na primeira sessão (texto no Apêndice A) |
| Slug / schema | `portal_corretor` (snake_case, vira o schema PostgreSQL) |
| Instância-alvo | Pinguim (teste). Produção: qualquer instância que instale o app (D-02) |
| Base | MVP "Portal do Corretor · laboratório Urbiverso UP/Urbitá" v2; `specs/stack_funcional.md`; `specs/referencias.md`; `specs/referencias_principais.md` (18/10, D-80); direção do dono em 17/10/2026 (duas rodadas), em 23/10/2026 (simplificação, 15.9) e em 27/10/2026 (Padrão B, Negociador, CRECI opcional; guia visual em `specs/telas_padrao_b.md` e mockups em `specs/telas/`) |
| Piso de shell / SDK | Proposto `shell_min: "0.56.25"`, `sdk_min: 94` (4.1); confirmar na implementação **Superado:** `sdk_min: 100`, `shell_min: "0.56.37"` (plano, R.2; SDK instalado) |
| Data | 27/10/2026 (1.1 em 23/10/2026; 1.0 em 18/10/2026) |

**Convenções do texto.** `D-nn` é decisão registrada (seção 16). `P-nn` é pendência (seção 17) e marca, no ponto do texto, tudo que depende de resposta. **[plataforma]** marca afirmação sobre o UrbiVerso que a implementação ainda confere no SDK instalado; as regras da seção 4 vêm do resumo dos frameworks de 18/10/2026. "Conta" é o espaço de trabalho de um corretor autônomo, de uma imobiliária ou de uma incorporadora. "Cliente" é sempre o cliente **do corretor** (comprador ou proprietário), nunca o corretor. Valores em dinheiro estão sempre em centavos de real no banco. Ausência de dado é `null` no banco e frase na tela, nunca zero.

## 2. Visão, públicos e princípios

### 2.1 Visão

O Portal do Corretor é o escritório digital do corretor. Num só app, no computador e no celular, ele organiza todos os clientes e o funil, conversa com eles pelo WhatsApp, tem uma IA que atende por ele quando ele quiser, produz e publica conteúdo no Instagram sem designer, mantém uma página profissional própria e dá a cada cliente um acesso simples pelo celular onde ele acompanha tudo.

O corretor faz o que exige gente: visitar, negociar, fechar. O resto o app faz ou prepara.

**Três números que o produto persegue:** tempo até a primeira resposta ao cliente (segundos, 24 h); custo para vender (menos ferramentas soltas, designer, secretária, portal); conversão de contato em visita e de visita em proposta.

### 2.2 Escala de acesso: plataforma → corretor → cliente

| Camada | Quem | Como acessa | O que vê e faz | O que nunca vê |
|---|---|---|---|---|
| **Plataforma** | Operador do app na instância (UrbiVerso / UP-Urbitá ou quem instalar) | Usuário interno da instância [plataforma] | Planos, cotas, contas de corretores, suporte, métricas agregadas de uso, base de ajuda do Assistente | Conteúdo das conversas e dados dos clientes do corretor, salvo pedido de suporte autorizado pelo dono da conta (P-19) |
| **Conta do corretor** | Corretor autônomo; ou imobiliária com dono, gestor e corretores | Usuário da plataforma, membro da conta | Tudo da própria carteira; o gestor vê a equipe | Clientes de outras contas |
| **Agentes da conta** | Assistente do Corretor, Mensageiro e agentes de bastidor | Lógica do backend da app (não são usuários da plataforma); autoria registrada | Só o que a seção 10 permite | O que o corretor não permitiu |
| **Clientes do corretor** | Comprador, proprietário | **Usuário externo** por link enviado pelo WhatsApp, sem instalar nada (D-23) | Só o que é dele: imóveis enviados, visitas, documentos, conversa, andamento; o proprietário vê o imóvel dele | Outros clientes, notas internas, comissão interna, dados do outro lado da negociação **No MVP: link com token, sem login (D-56).** |
| **Parceiros** | Corretores de outras contas, incorporadoras | Usuário da plataforma em outra conta, ou externo | O negócio ou o imóvel compartilhado | Clientes e proprietários do outro |

### 2.3 Visão do corretor

**Onde usa:** computador para organizar, analisar o funil e montar conteúdo; celular para atender, registrar visita, aprovar peça e responder o cliente. As duas experiências são completas: nada essencial existe só em uma delas (D-24).

**O dia dele no app:**
1. Abre **Hoje** (P01): o que precisa dele agora (conversas que o Mensageiro ou o Negociador passaram, clientes quentes, visitas do dia, retornos vencidos, peças aguardando aprovação).
2. Responde e atende em **Conversas** (P02), o WhatsApp dentro do app, com o Mensageiro ajudando ou atendendo por ele (quando o WhatsApp chegar, blocos 6 e 7).
3. Olha **Clientes › Funil** (P03): onde cada cliente está, quem esfriou, o que cada um abriu e clicou, e a **próxima abordagem** sugerida pela IA, já com a mensagem pronta para mandar.
3a. Acompanha **Clientes › Negociações** (P15): propostas e contrapropostas conduzidas pelo Negociador (IA ou pessoa) dentro do mandato que ele definiu.
4. Cadastra imóvel ou empreendimento com fotos (P07); no **Estúdio** (P08) o app prepara os textos e a descrição da arte para o Canva IA e agenda a publicação no **Instagram** (D-89).
5. Manda ao cliente, com um toque, uma **seleção**, um arquivo ou o link do **Portal do Cliente**.
6. Pergunta ao **Assistente** qualquer coisa sobre o app ("como faço para…", "o que eu posso oferecer para esse proprietário?", "configura um lembrete automático para visitas"); ele abre na coluna de contexto da tela em que o corretor está (D-109).
7. Ajusta a **Página** (P09, a Minha Página) quando quiser.

**O que ele configura uma vez (em Ajustes):** perfil (com CRECI, opcional, D-93), marca (logo, cores, foto), conexão do WhatsApp, conexão do Instagram, o Mensageiro e o Negociador (se contratar), a página.

### 2.4 Visão do cliente do corretor

**Onde usa:** quase sempre no celular, a partir de um link que chega no WhatsApp. Não instala app, não cria senha no primeiro acesso (D-23). A tela é pensada para o polegar e para leitura rápida.

**Comprador vê:**
- Os imóveis que o corretor mandou, em cartões grandes com fotos, preço, bairro e o essencial; reage com um toque (gostei, não gostei, quero visitar, quero conversar sobre o preço).
- Visitas e reuniões marcadas, com endereço, mapa, lembrete e botão para remarcar.
- Arquivos e informações que o corretor enviou (planta, tabela, simulação, memorial), num só lugar.
- O próximo passo combinado e uma linha do tempo simples do atendimento.
- Botão para falar no WhatsApp com o corretor (ou o Mensageiro).

**Proprietário vê:**
- A situação do imóvel e o que o corretor está fazendo por ele (entregas com prova: fotos feitas, anúncio publicado, posts, visitas).
- Visitas realizadas e o retorno de cada uma, revisado pelo corretor antes de aparecer.
- Propostas recebidas (valor e condições, sem nome do comprador) e o que decidiu.
- Metas combinadas para o período e o andamento; comissão combinada e o valor estimado ao preço atual.
- Relatório semanal e conversa com o corretor.

**O que o cliente faz:** reagir, pedir e remarcar visita, baixar arquivo, mandar mensagem, dar ciência de proposta (proprietário), aprovar conteúdo do próprio imóvel se combinado.

### 2.5 As cinco capacidades de IA

| Capacidade | Para quem | O que faz | Oferta |
|---|---|---|---|
| **A1 · Assistente do Corretor** | Corretor | Tira dúvidas sobre tudo que o app oferece e como usar; ajuda a decidir ("o que eu ofereço para esse cliente?"); prepara rascunhos; configura automações conversando, sempre com confirmação | Incluído em todos os planos |
| **A2 · Mensageiro** | Clientes do corretor, pelo WhatsApp | Responde perguntas, envia informações e arquivos, agenda visitas, conversas e reuniões, faz follow-up; responde em texto e entende áudio (fase 3); age como o corretor configurar | Produto à parte, possivelmente com custo adicional (P-11) |
| **A3 · Inteligência do Funil** | Corretor | Classifica cada contato (frio, morno, quente) com motivo; aponta a próxima abordagem conforme a etapa; monta a fila do dia | Incluído |
| **A4 · Estúdio de Conteúdo** | Corretor | A partir do imóvel e da marca, gera posts e stories do Instagram, legendas, descrições e a landing page; agenda e publica | Incluído com cota; extras por crédito |
| **A5 · Negociador** | Clientes do corretor na etapa de negociação | Responde objeções, recebe propostas, sugere e envia contrapropostas dentro do mandato (BATNA, ZOPA, ponto de recuo), leva o acordo à decisão; pode ser **IA ou pessoa** (10.9, D-97); no MVP, sem WhatsApp: oferta registrada pelo corretor ou feita no portal, contraproposta pelo portal ou por "Fazer agora" (D-107) | Produto à parte junto com o Mensageiro (P-11); papel humano incluído |

### 2.6 Princípios

Herdados do MVP:
1. Cada tela responde "o que eu faço agora?".
2. Celular primeiro; para o cliente, celular sempre.
3. O app nunca decide pelo corretor o que é dele decidir: preço, desconto, proposta, reserva, comissão.
4. Dado de uma pessoa nunca vaza para outra.
5. Número sem fonte não vai para a tela; ausência é frase, não zero.
6. Tudo que um agente faz é rastreável: quem, quando, por quê, quanto custou.
7. Regra legal é regra de produto: autorização escrita para anunciar e ciência do titular em parceria com exclusividade (seção 9.7). O **CRECI é dado opcional do perfil, nunca bloqueio** (D-93): com CRECI, ele aparece nas artes, na página e na assinatura; sem CRECI, não aparece, e o app mostra o aviso discreto "Adicione seu CRECI ao perfil para que ele apareça nos anúncios", com atalho para o perfil.

Da plataforma (roteiro do dono): UI e API andam juntas; a app nunca escreve SQL; agente não-humano é usuário de primeira classe; o nome da pasta é o schema.

Desta spec:
8. **Independência de estoque:** cadastro próprio de imóveis e empreendimentos; núcleo e incorporadoras como fontes opcionais (D-01).
9. **Velocidade de resposta é métrica de produto.**
10. **Custo visível:** toda ação que gasta crédito mostra custo antes e depois.
11. **Menor fricção possível:** toda conexão (WhatsApp, Instagram) em até 3 passos, toda configuração com padrão pronto, todo cadastro aceitando foto e voz.
12. **O WhatsApp do relacionamento passa pelo app:** é no app que fica o histórico, a IA e as métricas (D-25).
13. **IA no lugar onde se trabalha** (1.1, Follow Up Boss): a IA aparece como botão na tela certa (resumir, sugerir mensagem, virar tarefa, escrever descrição, gerar arte), não como um chat que o corretor precisa aprender a usar; o Assistente serve para dúvidas e pedidos livres.
14. **Uma tela, uma pergunta, uma ação** (1.1): cada lista mostra um botão principal por item e o resto fica num menu "mais"; nenhuma configuração sem uso na versão corrente aparece na tela; o que é a mesma coisa vista de dois jeitos (lista e quadro, hoje e agenda) é uma tela com duas visões, não duas telas.

### 2.7 Referências visuais e de produto escolhidas pelo dono

**Imagens (17/10):** imagem 1, conceito de app imobiliário para celular (projeto de comunidade no Figma): cartões de imóvel grandes com foto dominante, preço e atributos em ícones, navegação inferior, busca no topo — modelo da experiência do cliente no celular (seleção, Portal do Cliente, ficha pública) e da carteira do corretor no celular. Imagens 4 e 5, Compass One (painel do cliente da Compass, EUA): painel único conectado ao corretor, jornada em etapas, o que já aconteceu e o que vem, documentos e conversa — modelo do Portal do Cliente e da linha do tempo.

**Referências principais (18/10, detalhadas em `specs/referencias_principais.md`, D-80):** cinco produtos, cada um o melhor em uma coisa e simples na superfície. O app copia **um padrão de cada**:

| Referência | O padrão copiado | Onde vive no app |
|---|---|---|
| Follow Up Boss | O dia é uma lista: listas por regra (novos, sem contato, quentes, retorno vencido) e IA como botão no lugar certo (resumir, sugerir mensagem, virar tarefa), não como chat | Início (fila do dia) · Clientes (filtros prontos) · ficha do contato (botões de IA) |
| Lais | Uma caixa, um número, passagem visível: chips de etiqueta, origem e status por conversa; "corretor assumiu" e "reativar"; resumo do lead em uma frase | Conversas (blocos 6 e 7) · topo da ficha do contato |
| Morada.ai | A IA executa, não só conversa: atualiza o funil, agenda, mede; origem do anúncio antes do "olá" | Mensageiro (bloco 7) · `origens` · temperatura com motivo |
| Compass One | O cliente tem uma página só, curada pelo corretor: próximo passo, linha do tempo, datas-chave, o que falta de você | Portal do Cliente e seleção |
| Kenlo | Carteira visual (cartão com foto e nota de qualidade) e custo de IA visível por ação | Imóveis · Plano e consumo (com o Mensageiro, D-87) |

Os detalhes visuais (componentes, cores, espaçamento) seguem os catálogos de UI do UrbiVerso; as referências definem estrutura e hierarquia, não estilo. **Direção estrutural por superfície (1.1):**

| Superfície | Direção |
|---|---|
| Início | Lista única do dia, agrupada por motivo; cada item com nome, chip de temperatura, o motivo em uma linha e **um** botão (Fazer agora / Fiz / Abrir); faixa de quatro números; aba Agenda |
| Clientes | Visões Lista · Quadro; filtros prontos como chips; ficha com resumo em uma frase, botões de IA e linha do tempo; seções secundárias recolhidas |
| Imóveis | Grade de cartões (`urbi-grid` + `urbi-card`) com miniatura grande, preço, bairro, ícones e nota; foto dominante quando o shell oferecer cartão com capa (`specs/pedidos_ao_shell.md`, item 7); "o que falta" como lista no topo da ficha |
| Estúdio | Cartão da peça = prévia + situação + uma ação principal; menu "mais" |
| Portal e seleção | Uma coluna, topo com corretor e próximo passo, cartões grandes com foto dominante (CSS próprio das páginas públicas), botões grandes, linha do tempo vertical, datas-chave em destaque |
| Conversas (bloco 6) | Lista com chips (etiqueta, origem, status) e resumo em uma frase; na conversa, faixa "Mensageiro atende" / "Você assumiu" com botão único |
| Estados vazios | Sempre a próxima ação ("Cadastre o primeiro imóvel") |

**1.2 (27/10):** a direção por superfície continua valendo **dentro da moldura do Padrão B** (11.0, D-95): Hoje, Clientes, Imóveis, Estúdio, Página, Números e Ajustes passam a ter lista à esquerda, item no centro e contexto à direita. Onde o Padrão B muda a direção acima, vale o 11.1: a carteira de imóveis vira **lista com miniatura** na coluna esquerda (P06, D-106) e a ficha do contato (D-92) ocupa o centro e a direita (P04, D-106).

### 2.8 Mapa de referências por seção

Para cada parte do app, a referência de mercado ou de método de onde ela foi tirada. Detalhes em `specs/referencias_principais.md` e `specs/referencias.md`.

| Parte do app | Seção | Referência principal | O que foi aproveitado |
|---|---|---|---|
| Padrão de telas (moldura + três colunas) | 11.0 | Lais, Kommo | Conversa no centro, contexto ao lado, IA e humano no mesmo número |
| Hoje e fila do dia | 11.1 P01 | Compass One, Follow Up Boss | Um cartão por ação; listas do dia por regra |
| Conversas | 11.1 P02, 10.3 | Lais, Kommo, Kenlo | Assumir e reativar a IA; origem e status; corretor vê só os seus |
| Funil e filtros prontos | 11.1 P03, 10.4 | Follow Up Boss, Kenlo | Quadro, filtros prontos (D-83), resumo e tarefa com um clique |
| Ficha do cliente e linha do tempo | 11.1 P04 | Follow Up Boss | Ficha de duas colunas (D-92); histórico único de tudo que aconteceu e foi enviado |
| Assistente do Corretor | 10.2, P05 | Real Brokerage (Leo), Follow Up Boss | Assistente interno; IA sem prompt no fluxo |
| Mensageiro | 10.3, P11 | Lais, Morada | Resposta em segundos, agendamento, tom de voz da marca, passagem |
| Negociador, mandato, faixa ZOPA | 10.9, P15–P17 | Fisher, Ury e Patton (*Como Chegar ao Sim*); Grupo LU (BATNA, ZOPA e ponto de recuo); Voss; Cialdini | BATNA, ZOPA, ponto de recuo; concessões com contrapartida; tratamento de objeções |
| Imóveis e qualidade do anúncio | 11.1 P06–P07 | Kenlo | Nota de qualidade, descrição por IA, carteira |
| Estúdio e publicação | 10.5, 9.2, 9.4, P08 | Rechat, Luxury Presence, Canva | Campanha pronta ao ativar imóvel; descrição da arte para o Canva IA (D-89 a D-91); listas por etapa |
| Minha Página | P09 | Luxury Presence | Site do corretor montado e mantido pela IA |
| Números | 11.2, P10 | Follow Up Boss, Morada, Lais | Relatórios por origem, retorno por canal, leads por horário |
| Créditos por ação | P13 | Kenlo | Créditos por recurso de IA (com o Mensageiro, D-87) |
| Importação | 12.1, P14 | Follow Up Boss, Kenlo | Migração assistida |
| Portal do Cliente | 11.3 | Compass One | Painel do cliente por link, próximo passo, jornada, o que falta de você |
| Portal do Proprietário (fase 3) | 11.3 M7 | Compass One, ShowingTime | Engajamento do anúncio; retorno de visita revisado antes de publicar |
| Conexão do WhatsApp | 9.0, 9.1, P12 | Meta (cadastro incorporado com coexistência) | Manter o número no celular |
| Rede e parcerias (fase 5) | `specs/horizonte.md` | Homer, Rechat (rede), Apto | Match comprador × imóvel, termo digital, comissão visível |
| Incorporadora (fase 5) | `specs/horizonte.md` | CV CRM, Facilita, DWV | Espelho, reserva com fila, simulador pela tabela |
| Regras legais | 9.7, 10.9.6 | Lei 6.530/78, Código de Ética do COFECI, CDC, LGPD | Autorização, lealdade nas informações, consentimento; CRECI opcional no perfil (D-93) |

## 3. O que existe hoje e o que muda

### 3.1 Peça a peça

| Peça no MVP | Situação no MVP | Na spec |
|---|---|---|
| Início ("o que fazer agora") | Demonstrado | Mantido. Ganha cronômetro de primeiro atendimento e fila de passagens dos agentes |
| Clientes (compradores e proprietários, etapas, linha do tempo) | Demonstrado | Mantido e separado em Contato + Negócio. Funil configurável por conta |
| Captação em 3 passos | Demonstrado | Mantida |
| Imóveis da carteira, qualidade 0–100 | Demonstrado | Mantido. Qualidade passa a exigir fotos reais; o CRECI é opcional e só aparece como aviso (D-93) |
| Página do corretor por blocos | Demonstrado | Mantida, com formulário por webhook (página pública só faz GET) |
| Seleções com reações | Demonstrado | Mantidas, reações por webhook |
| Relatório semanal ao proprietário, radar | Demonstrado / Simulado | Viram o Portal do Proprietário com entregas, metas e comissão |
| Conversas, assistente 24 h por roteiro | Simulado | WhatsApp oficial + agentes de IA com níveis de autonomia |
| Divulgação (peças, anúncio impulsionado) | Ilustrado | Estúdio de conteúdo: post, carrossel, story, vídeo, publicação automática e calendário |
| Parcerias e comissão | Demonstrado | Viram a Rede: conexões, compartilhamento automático, parcerias com divisão |
| Vitrine, tabela versionada, espelho, reservas com fila, exceções (canal UP) | Demonstrado | Módulo "Incorporadora", usado por qualquer conta do tipo incorporadora (UP/Urbitá é a primeira) |
| Habilitação de corretores, autorizações (comercial UP) | Demonstrado | Credenciamento na rede da incorporadora (CRECI informado no perfil, sem verificação pelo app, D-93) |
| Plano e créditos | Simulado | Consumo medido por conta; precificação em P-11 |
| Métricas agregadas (843 linhas no seed) | Demonstrado | Mantidas como agregados diários + painel de conversão completo |
| Estado no navegador (`lab-corretor-v1`) | Protótipo | Banco do app. Migração do seed como demonstração (seção 12) |
| — | Não existia | **Assistente do Corretor** (A1): dúvidas do produto, decisões, automações por conversa |
| Assistente 24 h por roteiro | Simulado | Vira o **Mensageiro** (A2), configurável por ação; responde em texto e transcreve áudio (fase 3) |
| Seleção por link | Demonstrado | Vira parte do **Portal do Cliente** (comprador e proprietário), celular primeiro |
| Página por blocos | Demonstrado | **Minha Página** montada pelo Estúdio e editável pelo corretor |
| Divulgação ilustrada | Ilustrado | **Estúdio de Conteúdo** com publicação automática no Instagram |

### 3.2 O que entra

Todo o escopo, fase a fase, está na seção 15. O MVP (fase 1) é: CRM e funil com IA, WhatsApp pelo app com o Mensageiro em texto, Assistente do Corretor, Estúdio com publicação no Instagram, Minha Página e Portal do Cliente comprador.

### 3.3 O que fica de fora

Gestão de locação e administração de aluguéis; financeiro completo da imobiliária (contas a pagar, folha); emissão de nota fiscal; ranking público entre corretores (excluído no MVP, mantido fora); disparo em massa para listas compradas; leilão de leads; geração de imagem que altere o imóvel sem rótulo (virtual staging só rotulado).

## 4. Arquitetura no UrbiVerso

Fonte desta seção: resumo dos frameworks destilado de `docs/shell/*.md` em 18/10/2026. Em conflito, vale o bundle do `@urbiverso/sdk` instalado, que a sessão de implementação confere (P-01).

### 4.1 Forma do repositório e da app

Repositório próprio do app, compilando contra o `@urbiverso/sdk` **publicado** (nunca o `main` do monorepo):

```
apps/portal_corretor/
  manifesto.json        identidade {owner}/{repo}::portal_corretor
  schema.json           tabelas da app (schema PostgreSQL portal_corretor)
  backend/rotas.ts      rotas, rotasPublicas, webhooks, webhooks_upload, rotinas, reagir, aoIniciar
  frontend/index.ts     Web Component app-portal-corretor (Lit) + componentes das páginas públicas
  comum/                regras puras compartilhadas (fórmulas de temperatura, qualidade, compatibilidade)
  migracoes/            só dados (a semente de demonstração é idempotente em aoIniciar)
  docs/README.md        visão geral; alimenta o widget de ajuda e a base do Assistente
specs/                  esta spec, o plano e os anexos (fora do pacote da app)
CLAUDE.md               instruções permanentes para as sessões de implementação
```

Build com esbuild (frontend ESM com `@urbiverso/ui` externo; backend self-contained), empacote `portal_corretor-<versao>.urbiapp.tgz`, release pela ferramenta do SDK, instalação em Admin › Instaláveis › Apps. **Teste na instância intermediária** (não na de desenvolvimento). Pisos iniciais propostos: `sdk_min: 94`, `shell_min: "0.56.25"` (rotas pessoais, `incrementar`, `destinatarios`, `formato`/`intervalo`) — **superados por `sdk_min: 100`, `shell_min: "0.56.37"` (plano, R.2)**; a implementação ajusta ao que realmente usar.

### 4.2 Frameworks usados

| Framework | Uso no app |
|---|---|
| Dados (`schema.json`, `req.dados`) | Todas as tabelas, **todas** `segregada_por_conta: true` e `acesso_externo: "restrito"` (acesso só por rotas próprias); `soft_delete` nas de negócio; `busca_texto` em contatos e anúncios; `sql_declarado` para o funil por coorte |
| Usuários, permissões, contas | Corretor e clientes como usuários **externos** da conta do corretor, diferenciados por `roles_externos`; equipe da plataforma como usuários internos com `roles` (4.4) **No MVP o cliente não é usuário (D-56).** |
| Arquivos (coluna `arquivo`, `req.arquivos`) | Fotos, vídeos, documentos, artes; upload em 2 passos; download por rota própria com `req.arquivos.url` |
| Barramento (`req.eventos`, `reagir`) | Todos os eventos da seção 13, `segregado_por_conta: true`; **`agendar`** para tudo que tem hora marcada (publicação, lembrete, vencimento) |
| Notificações | `req.notificacoes.notificar` ao corretor (inbox e push) **Revisto por D-57: Início + e-mail.** |
| Webhooks (`wh`) | Entrada do WhatsApp e do Instagram (Meta), formulários e reações das páginas públicas, retorno de render |
| Rotas e páginas públicas | Minha Página, ficha pública do imóvel, seleção (só GET; envios por `wh`) |
| Rotinas | Diárias, semanais e mensais da seção 8 |
| IA (`req.ia`) | Slots declarados (10.6), sempre com JSON Schema |
| E-mail (`req.email`) | Avisos ao corretor e, na fase 3, relatório ao proprietário |
| Parâmetros | Só configuração da instalação (credenciais do app na Meta e do Canva, limites); configuração **por conta** é tabela |
| `telas_config` | Telas de admin da app para a equipe da plataforma: modelos de arte, playbook padrão, base de ajuda |
| Módulos | **Não no MVP.** `pessoas` opcional na fase 3 (qualificação em proposta); `imobiliario` na fase 5 (unidades de empreendimento) (4.6) |
| Ajuda e feedback | Grátis da plataforma: widget "?", Sentinela. **Não implementar** tela de ajuda, bug ou "sobre" |

### 4.3 O que a plataforma determina para este app

| Regra da plataforma | Consequência no desenho |
|---|---|
| `agendar(tipo, payload, {em})` com precisão de minuto, catch-up e at-least-once | **Agendamento resolvido sem relógio externo**: publicação no Instagram, lembrete de visita e vencimentos são eventos agendados; listener idempotente |
| Rotinas só diária, semanal ou mensal, até 15 min | Rotinas para varreduras e relatórios; nada imediato |
| Webhook `wh`: só `POST`, roda anônimo, timeout 30 s, token na URL | O handler valida, grava o mínimo e publica evento; o trabalho pesado (IA, envio) roda no listener `reagir` |
| `req.dados` de tabela segregada fica inoperante no handler de `wh` | O handler resolve a conta e publica o evento com `{conta_id}`; o listener grava com `dados.comConta` (P-33) |
| Listener `reagir`: sem usuário, sem retry, sem ordem garantida | Idempotência por `id_externo` da mensagem; reprocessamento seguro |
| IA só com JSON Schema; proíbe agente autônomo com tool use, texto livre, geração de imagem, TTS e chamada direta a provedor | Mensageiro e Assistente decidem em uma chamada estruturada e **o app executa as ações** (10.6). **Sem resposta em áudio** (D-48); artes pelo Canva (9.4) |
| Contexto + instruções da IA até 512 KB; saída até 16 mil tokens | Contexto enxuto e montado pelo app |
| Página pública: sem chrome do shell, **sem tokens de tema**, só GET; a app filtra o que é visível | Marca do corretor como dado e CSS próprio nas páginas públicas; filtro `visibilidade = publico` no código |
| Telas autenticadas: só primitivos `urbi-*` e tokens; exceção nomeada para componente de domínio | Lacunas declaradas em 11.9 |
| `nav` até 20 itens e 2 níveis; no celular, o menu fica no dropdown do nome da app; o shell desenha o `nav` e não deixa escondê-lo | Atalhos do dia a dia ficam na própria tela Hoje, não numa barra própria; onde o shell mostra o `nav`, o trilho da moldura fica só com Criar e Assistente (11.0.1) |
| `DELETE` exige nível `admin`; externo tem teto `escrita` | Corretor "apaga" por `PATCH …/remover` (soft delete); lixeira é da equipe da plataforma |
| Sem SQL cru; sem ordenação multi-coluna na API genérica; sem mediana e percentil | Agregados por `sql_declarado` ou cálculo em código; tempo de resposta em média + faixas |
| `fetch()` global passa pelo proxy de egresso; `axios`/`got` não | Todas as chamadas a Meta, Canva e render com `fetch` |
| Coluna `segredo` (cifrada; leitura só por `revelar`) e `parametros` `secret` | Tokens de cada corretor em `segredo`; credenciais do app em `parametros` |
| Sem tabelas próprias de pessoa e imóvel quando o módulo existe | Contato (lead) e anúncio são dados comerciais da app, com vínculo opcional ao módulo (4.6, D-46) |
| Geometria só em módulo | Localização como `lat`/`lng` + GeoJSON em `json`; `urbi-mapa` aceita GeoJSON |

### 4.4 Contas, usuários e papéis

| Quem | Tipo na plataforma | Conta | Papel na app |
|---|---|---|---|
| Corretor autônomo | `externo` | A conta dele (criada pela instância ou por convite da equipe) | role externo `corretor` |
| Cliente do corretor (comprador, proprietário) | `externo` | A **mesma** conta do corretor que o convidou | role externo `cliente` (perfil comprador/proprietário em dado) **No MVP: sem conta; acesso por link com token (D-56).** |
| Negociador humano (sócio, especialista, outra pessoa da equipe do corretor) | `externo` | A conta do corretor que o convidou | role externo `negociador`: só as negociações atribuídas (11.6, 14). Convite **sem CRECI** (D-94). Opcional: o padrão é o Negociador IA. Entra por último no arco 1.2 e **exige a política "permite contas multi-usuário" ligada na instância** (`contas.md`: com ela desligada, o segundo externo na conta é recusado com `CONVITE_MULTI_USUARIO_BLOQUEADO`) (D-108) |
| Equipe da plataforma (operação, suporte) | interno (`colaborador`) | — | roles de equipe `operacao` e `suporte`; `suporte` com `acesso_irrestrito` só quando autorizado (P-19) |
| Admin da app | interno com nível `admin` | — | Config, Lixeira, IA, Webhooks, Rotinas |

Manifesto (desenho completo; **no MVP sai o papel `cliente`, o `roles_externos` fica só com `corretor` e o corretor não convida clientes — D-56**): `aceita_externos: true`, `permissao_padrao_externo: "escrita"`, `roles_externos.escrita: { corretor, cliente }`, `provisiona_externos.papel_externo: "corretor"` (o corretor convida os próprios clientes) e `provisiona_externos.papel: "operacao"` (a equipe convida corretores). Toda rota decide por `rolesApp` e escopa por `usuario.id`; nunca por `tipo` ou `natureza`.

**Negociador humano (1.2, D-97, D-108):** `roles_externos.escrita` ganha `negociador`, e o corretor passa a convidar externos com esse papel (o convite não pede CRECI, D-94). Só funciona com a política "permite contas multi-usuário" ligada pelo admin da instância; desligada, o app mostra que o negociador humano não está disponível e segue com o Negociador IA.

> **Revisto para o MVP por D-56:** o cliente acessa o Portal do Cliente por link com token, página pública sem login, e age por `wh`; sem papel `cliente`, sem convite de cliente e sem `roles_externos.cliente` no MVP. O texto a seguir fica como desenho de fase posterior.

**Como o cliente entra (D-23 revista):** o corretor envia pelo WhatsApp o convite da plataforma; o cliente cria o acesso no primeiro clique (e-mail e senha, conforme o shell) e passa a ver o **Portal do Cliente** como tela da app, no celular. Seleções avulsas e a Minha Página continuam como páginas públicas sem login (11.3). Se o shell vier a oferecer acesso por link mágico, o atrito some (P-20).

**Fase 4 (equipe):** imobiliária = uma conta com vários corretores; um externo pertence a uma conta só, então corretor que muda de imobiliária é tratado na fase 4 (P-35).

### 4.5 Segmentação e isolamento (regra inegociável)

Vários corretores usam o mesmo app, cada um com seus imóveis e seus clientes. **Ninguém vê o que não é seu, e o cliente só vê o que o corretor dele escolheu mostrar.**

| Camada | Como se garante |
|---|---|
| Entre corretores | **Proibição absoluta, garantida pelo banco:** cada corretor é uma conta; todas as tabelas `segregada_por_conta: true` → RLS forçado no PostgreSQL. Nenhuma rota, listener, rotina ou IA consegue ler ou gravar linha de outra conta, nem por erro de código. Nenhuma tabela da app fica fora do regime, **exceto `vitrine_publica` (D-55)**: só o que o corretor publicou, sem dado pessoal |
| Corretor × cliente na mesma conta | Toda tabela `acesso_externo: "restrito"` (sem CRUD genérico); rotas próprias: role `corretor` lê a conta, role `cliente` lê **só** o que está em `itens_cliente` com o `usuario.id` dele **No MVP (D-56) o cliente não tem conta: vê só o que o link com token dele alcança.** |
| Entre clientes do mesmo corretor | Mesmo filtro por `usuario.id` em `itens_cliente` **No MVP (D-56) o cliente não tem conta: vê só o que o link com token dele alcança.** |
| Público anônimo | Rotas públicas só devolvem o que tem `visibilidade = publico`, sem dado pessoal |
| IA | Contexto montado pelo app só com dados da conta e, para o cliente, só com o que ele recebeu |
| Fornecedores com conta da plataforma (Canva, render) | Pasta e prefixo por conta; `canva_vinculos` (9.4) |
| Equipe da plataforma | Só agregados; acesso a conta com `acesso_irrestrito` apenas sob autorização registrada |
| Resposta | Recurso de outra conta ou não concedido → "não encontrado" |

**Teste obrigatório (seção 18):** dois corretores e dois clientes na semente; cada um tenta ler, listar, buscar e abrir por link tudo dos outros, inclusive pedindo ao Mensageiro e ao Assistente; o resultado é sempre vazio ou "não encontrado".

### 4.6 Módulos `pessoas` e `imobiliario` (D-46)

A plataforma orienta a não criar tabelas próprias de pessoa e imóvel quando o módulo existe. Este app guarda **dados comerciais do corretor**, que não são o cadastro civil da pessoa nem o cadastral do imóvel:
- **Contato (lead)** chega só com nome e telefone, sem CPF; o módulo `pessoas` exige CPF/CNPJ e trata e-mail e telefone como únicos na instância, o que colide quando dois corretores atendem a mesma pessoa e quebraria o isolamento entre corretores. → `contatos` é tabela da app; quando um negócio chega à proposta (fase 3), a qualificação pode ser gravada no módulo `pessoas` e o contato guarda `pessoa_id`.
- **Anúncio** é a oferta comercial do corretor (preço pedido, fotos, descrição, autorização, visibilidade). → tabela `anuncios` (chamada "imóvel" na tela e neste texto), com `imovel_id` lógico opcional para o módulo `imobiliario` quando a instância tiver o imóvel cadastrado.
- **Unidades de empreendimento** (módulo Incorporadora, fase 5) usam o módulo `imobiliario` (`incorporacoes`, `parcelamentos`, `imoveis`), o que também atende o núcleo da UP/Urbitá.

**Confirmado pelo dono em 18/10/2026:** contato e anúncio são dados do app, no schema do app, protegidos pelo RLS (P-34 encerrada).

## 5. Manifesto

Esboço do conteúdo. A forma exata é a do SDK instalado; a implementação escreve o `manifesto.json` a partir daqui. **Nota da implementação:** `permissao_padrao` e `permissao_padrao_externo` não são campos do manifesto no SDK 100 — são configurados pelo admin da instância em Admin › Instaláveis › Apps (plano, R.5); `versao`, `shell_min` e `sdk_min` vigentes estão no `manifesto.json` da app.

```json
{
  "nome": "Portal do Corretor",
  "versao": "0.1.0",
  "descricao": "CRM, funil com IA, WhatsApp, conteúdo para Instagram, página própria e portal do cliente para corretores de imóveis",
  "identidade": "<owner>/<repo>::portal_corretor",
  "shell_min": "0.56.25",
  "sdk_min": 94,
  "permissao_padrao": "nenhuma",
  "aceita_externos": true,
  "permissao_padrao_externo": "escrita",
  "roles": {
    "escrita": { "operacao": "Equipe da plataforma: convida corretores, mantém modelos e ajuda",
                 "suporte": "Equipe de suporte: acesso a uma conta só com autorização do corretor" }
  },
  "roles_externos": {
    "escrita": { "corretor": "Corretor: usa o app inteiro na própria conta",
                 "cliente": "Cliente do corretor: vê só o que recebeu (fase posterior, D-56)",
                 "negociador": "Negociador: conduz as negociações atribuídas, dentro do mandato (D-108)" }
  },
  "provisiona_externos": { "papel": "operacao", "papel_externo": "corretor" },
  "acesso_irrestrito": { "papel": "suporte" },
  "nav": "seção 5.1",
  "eventos": "seção 13.1 (todos com segregado_por_conta: true)",
  "erros": "seção 13.2",
  "webhooks": "seção 7.3",
  "rotinas": "seção 8",
  "rotas_publicas": ["/pagina", "/imovel", "/selecao"],
  "paginas_publicas": { "/p": {}, "/s": {} },
  "parametros": "seção 5.2",
  "telas_config": { "modelos_arte": {}, "playbook_padrao": {}, "playbook_objecoes_padrao": {}, "prompt_negociador_padrao": {}, "ajuda": {} },
  "ia": { "slots": "seção 10.6" },
  "emails": true
}
```

### 5.1 Navegação (`nav`) — Padrão B

**1.2 (D-103, revê D-81 nos nomes):** corretor, nesta ordem: **Hoje · Clientes · Imóveis · Estúdio · Página · Números · Ajustes** (sete itens), e **Conversas** entre Hoje e Clientes quando o WhatsApp chegar (blocos 6 e 7, P-31/P-32). Dentro de **Hoje**, as abas Hoje e Agenda (D-82); dentro de **Clientes**, as visões Funil · Lista · Negociações (D-96); dentro de **Imóveis**, Carteira · Empreendimentos (D-84); dentro de **Ajustes**, o menu da coluna esquerda: Mensageiro · Negociador · Conexões · Conta e marca · Plano e créditos · Funil e abordagens · Horário de atendimento · Privacidade (cada item aparece quando a função existe, princípio 14). **Criar** e **Assistente** são botões fixos do trilho da moldura (11.0.1); o Assistente sai do menu e abre na coluna de contexto (D-109, revê D-76). O shell injeta Home e Configurações. A equipe da plataforma (`operacao`) mantém o grupo Equipe da plataforma › Corretores (D-61). Itens das fases seguintes (Proprietários, Rede, Equipe) entram como visões dentro de Clientes ou Imóveis, não como itens novos.

**Apelidos (o SDK não redireciona):** as rotas de antes continuam abrindo a tela nova na aba ou visão certa — Início → Hoje; Desempenho → Números; Minha página → Página; Funil → Clientes › Funil; Agenda → Hoje › Agenda; Assistente → Hoje com o Assistente aberto na coluna de contexto; as abas antigas de Ajustes → o item correspondente do menu de Ajustes.

Negociador humano (role `negociador`, D-108): **Hoje · Clientes › Negociações** (só as atribuídas) e, quando houver WhatsApp, **Conversas** dessas negociações.

**Menu da 1.1 (D-81), substituído pelos nomes acima:** Início · Clientes · Imóveis · Estúdio · Minha página · Desempenho · Assistente · Ajustes. O texto a seguir fica como registro:

Corretor (1.1, D-81, oito itens): **Início · Clientes · Imóveis · Estúdio · Minha página · Desempenho · Assistente · Ajustes**. Início tem as abas Hoje e Agenda (D-82); Clientes tem as visões Lista e Quadro, que é o funil (D-83); Imóveis tem as abas Carteira e Empreendimentos (D-84); Ajustes é uma tela com as abas Conta, Marca, Conexões, Funil e abordagens e Atendimento. **Conversas** entra entre Início e Clientes quando o WhatsApp chegar (bloco 6); Plano e consumo, com o Mensageiro (bloco 7). O shell injeta Home e Configurações. A equipe da plataforma (`operacao`) tem o grupo Equipe da plataforma › Corretores (D-61). Itens das fases seguintes (Proprietários, Rede, Equipe) entram com a fase.

O menu de 0.1.0 (Início, Assistente, Funil, Clientes, Agenda, Desempenho, Imóveis › Minha carteira · Empreendimentos, Estúdio, Minha página, Ajustes › Conta e marca · Conexões · Funil e abordagens; treze entradas) fica registrado em 15.9; as rotas antigas continuam abrindo a tela nova na aba certa, porque o SDK não redireciona.

Cliente (role `cliente`, fase posterior): só **Meu atendimento** (Portal do Cliente). No MVP o cliente acessa por link (D-56).

### 5.2 Parâmetros da instalação

| Parâmetro | Tipo | Observação |
|---|---|---|
| `meta_app_id` | string | App registrado na Meta (titular em P-26) |
| `meta_app_secret` | string `secret` | Validação de assinatura dos webhooks e troca de tokens |
| `meta_config_cadastro_whatsapp` | string | Configuração do cadastro incorporado |
| `canva_client_id` / `canva_client_secret` | string / `secret` | Integração Canva da plataforma (a plataforma não tem integração Canva: a app integra por `fetch()` — D-60) |
| `canva_pasta_raiz` | string | Pasta raiz das contas no Canva |
| `prazo_primeiro_atendimento_min` | numero | Padrão 5 |
| `cota_mensal_ia_padrao`, `cota_mensal_artes_padrao` | numero | Cotas por conta até haver planos |

Configuração **por conta** (horário de atendimento, dias para cliente parado, validade de seleção, lembrete de visita, autonomia do Mensageiro) fica na tabela `configuracoes_conta`, editada pelo corretor em Ajustes.

## 6. Modelo de dados

### 6.0 Como ler este modelo

As tabelas abaixo são o **modelo lógico**. A implementação escreve o `schema.json` seguindo o framework de dados, com estas regras de tradução:

- **Não declarar** `id`, `criado_em`, `atualizado_em`, `conta_id`, `removido_em`, `removido_por_id`: são automáticos. Onde o texto diz uuid, o id é o automático.
- **Toda tabela:** `segregada_por_conta: true`, `acesso_externo: "restrito"`; `soft_delete: true` nas de negócio (contatos, negócios, anúncios, empreendimentos, peças, seleções, propostas); tabelas "só inclusão" sem soft delete.
- **Tipos:** enum → `texto` com `opcoes`; lista → `json`; dinheiro → `inteiro` em centavos; percentual → `decimal` com `escala` 4; datas → `data` ou `datahora`; referência a pessoa da plataforma → `referencia` a `shell.usuarios`; arquivos → coluna `arquivo` com `mimes`, `tamanho_max_mb`, `multiplo` (fotos e vídeos em tabela de mídias, uma por linha); tokens de terceiros → `segredo`.
- **Unicidade** fica composta com a conta automaticamente.
- **Renomeações no `schema.json`:** `imoveis` → **`anuncios`** (4.6); `contas` → **`perfil_conta`** (a conta é da plataforma; aqui só tipo, marca e plano); `membros` → **`perfis_corretor`** (CRECI, foto, telefone, por `usuario_id`); `eventos` → **`linha_do_tempo`** (o histórico do app; o barramento da plataforma é efêmero).
- **`agentes`** é configuração (o Mensageiro e o Assistente rodam no backend, não precisam ser usuários da plataforma); a autoria das ações fica em `linha_do_tempo` com `autor_tipo`.
- **`pendencias_agendadas`** vira registro de conferência dos agendamentos feitos com `req.eventos.agendar` (id do agendamento, tipo, hora prevista e real).
- **Configuração por conta** em `configuracoes_conta` (5.2).
- **Fora do MVP**, as tabelas das fases seguintes (proprietário, metas, comissões, rede, incorporadora) ficam descritas para orientar, mas só entram no `schema.json` na fase delas.

Os campos "Origem" referem-se ao protótipo de laboratório e servem só de rastreabilidade.

### 6.1 Conta e pessoas

**`contas`** — tenant.

| Coluna | Tipo | Obr. | Origem | Observação |
|---|---|---|---|---|
| tipo | enum `corretor_autonomo`/`imobiliaria`/`incorporadora` | sim | novo | |
| nome | texto | sim | `corretores.nome` | |
| documento | texto | não | novo | CPF/CNPJ, só para contrato e comissão |
| creci_juridico | texto | não | novo | Imobiliária |
| marca | json | não | `paginas.cor`, `paginas.logo` | Cores, logotipo, fontes do kit visual |
| plano | texto | sim | `planos.tier` | P-11 |

**`membros`** — usuário da plataforma dentro da conta.

| Coluna | Tipo | Obr. | Origem | Observação |
|---|---|---|---|---|
| usuario_id | ref usuário [plataforma] | sim | `corretores.id` | |
| papel | enum (5.2) | sim | `perfil` | |
| creci | texto | não | `corretores.creci` | Formato `UF-nnnnn-F/J`. Opcional, nunca bloqueio (D-93): com valor, aparece nas artes, na página e na assinatura; vazio, não aparece e o app mostra o aviso discreto com atalho para o perfil |
| creci_situacao | enum `nao_verificado`/`verificado`/`irregular` | sim | `corretores.habilitacao` | P-12. **1.2 (D-93):** não aparece na tela e não muda nenhum comportamento; fica só como dado opcional (sem estado "em verificação") |
| telefone | texto | não | `corretores.telefone` | E.164 |
| foto | ref arquivo | não | `paginas.foto` | |
| ativo | booleano | sim | novo | |

Chave: (`conta_id`, `usuario_id`) única. Usuário agente também é membro com `papel = agente`.

### 6.2 CRM

**`contatos`** (S, L `C-nnnn`, AE não) — pessoa física ou jurídica.

| Coluna | Tipo | Obr. | Origem | Observação |
|---|---|---|---|---|
| nome | texto | sim | `contatos.nome` | |
| telefone_norm | texto | não | `contatos.telefone` | Só dígitos, sem 55; chave de duplicidade |
| email | texto | não | `contatos.email` | minúsculo |
| papeis | lista enum `comprador`/`proprietario`/`investidor`/`parceiro`/`fornecedor` | sim | `contatos.papeis` | |
| responsavel_id | ref membro | sim | `contatos.corretor` | |
| origem | ref `origens` | sim | `contatos.origem` | Primeira origem; as demais ficam em eventos |
| etiquetas | lista texto | não | novo | |
| perfil_busca | json | não | `contatos.perfil` | tipos, regiões, faixa de preço `_c`, área mín., quartos, vagas, finalidade |
| temperatura | enum `frio`/`morno`/`quente` | não | novo | Calculada pelo agente ou corretor; nunca zero |
| nota_qualificacao | inteiro 0–100 | não | novo | Seção 6.12 (fórmula) |
| ultimo_contato_em | data-hora | não | `contatos.ultimaInteracao` | Materializado por evento |
| proximo_passo | texto | não | `contatos.proximoPasso` | |
| proximo_passo_em | data-hora | não | `contatos.retorno` | |
| consentimento_id | ref `consentimentos` | não | novo | LGPD |
| anonimizado_em | data-hora | não | novo | Seção 6.10 |

Índices: (`conta_id`, `telefone_norm`) único quando não nulo; (`conta_id`, `responsavel_id`, `proximo_passo_em`). Regra: telefone repetido na mesma conta liga ao contato existente; repetido em outra conta não é visível (privacidade) — a proteção de cliente na rede é tratada por `parcerias` e `protecoes_cliente`.

**`etapas_funil`** — configurável por conta, por pipeline.

| Coluna | Tipo | Obr. | Origem | Observação |
|---|---|---|---|---|
| pipeline | enum `compra`/`venda_captacao`/`incorporadora` | sim | novo | |
| nome | texto | sim | etapas do MVP | |
| ordem | inteiro | sim | novo | |
| tipo | enum `aberta`/`ganha`/`perdida` | sim | novo | |
| probabilidade | decimal 0–1 | sim | novo | Usada na previsão ponderada |

Semente por pipeline. **Compra**: Novo (0,05) → Em atendimento (0,10) → Qualificado (0,20) → Visita agendada (0,35) → Visitou (0,50) → Proposta (0,70) → Documentação (0,90) → Ganho (1) / Perdido (0). **Venda/captação** (proprietário): Contato (0,05) → Avaliação (0,15) → Autorização assinada (0,40) → Anunciado (0,50) → Proposta recebida (0,75) → Vendido (1) / Encerrado (0). Mapeamento das etapas do MVP: `novo`→Novo, `atendimento`→Em atendimento, `visita`→Visita agendada, `proposta`→Proposta, `fechado`→Ganho, `perdido`→Perdido, `pos_venda` vira estado do contato e não etapa.

**`negocios`** (S, L `N-nnnn`) — oportunidade; um contato pode ter vários.

| Coluna | Tipo | Obr. | Origem | Observação |
|---|---|---|---|---|
| contato_id | ref | sim | `contatos.id` | |
| pipeline | enum | sim | novo | |
| etapa_id | ref | sim | `contatos.etapa` | |
| etapa_desde | data-hora | sim | novo | Para tempo na etapa |
| imovel_id | ref | não | `propostas.imovel` | Imóvel principal do negócio |
| valor_estimado_c | inteiro | não | `propostas.valor` | |
| comissao_pct | decimal | não | `comissoes.pct` | |
| responsavel_id | ref membro | sim | `contatos.corretor` | |
| origem_id | ref | sim | herdada do contato | Atribuição de conversão |
| motivo_perda | enum `preco`/`localizacao`/`financiamento`/`desistiu`/`comprou_com_outro`/`sem_resposta`/`outro` | quando perdido | `contatos.motivo` | |
| ganho_em, perdido_em | data-hora | não | novo | |

**`atividades`** (S) — tarefas, ligações, visitas, retornos.

| Coluna | Tipo | Obr. | Origem | Observação |
|---|---|---|---|---|
| tipo | enum `tarefa`/`ligacao`/`mensagem`/`visita`/`reuniao`/`retorno` | sim | `atividades.tipo` | |
| negocio_id / contato_id / imovel_id | ref | ao menos um | `atividades.alvo` | |
| responsavel_id | ref membro | sim | | |
| quando | data-hora | sim | `atividades.quando` | |
| status | enum `pendente`/`feita`/`cancelada`/`nao_compareceu` | sim | novo | |
| resultado | texto | não | novo | |
| criada_por_agente | booleano | sim | novo | |

**`visitas`** — detalhe de atividade `visita`: `atividade_id`, `imovel_id`, `pretendente_id` (contato), `confirmada_em`, `feedback_nota` (1–5, nullable), `feedback_texto`, `ficha_assinada` (ref arquivo; ficha de visita protege a comissão), `compartilhar_com_proprietario` (booleano, padrão sim, sem nome do pretendente). Origem: `horariosVisita` + pedidos de visita do MVP.

**`eventos`** (só inclusão) — linha do tempo e auditoria de tudo.

| Coluna | Tipo | Obr. | Origem | Observação |
|---|---|---|---|---|
| tipo | texto (catálogo seção 13) | sim | `historico`, `linhaDoTempo` | |
| alvo_tipo, alvo_id | texto, uuid | sim | | |
| autor_id | ref membro ou externo | não | | `null` = sistema |
| autor_papel | texto | sim | | Distingue agente de humano |
| dados | json | não | | |
| custo_creditos | inteiro | não | `consumos` | |
| ocorrido_em | data-hora | sim | | |

Índice: (`conta_id`, `alvo_tipo`, `alvo_id`, `ocorrido_em`).

**`origens`** — canal e campanha: `canal` (enum `pagina`/`whatsapp`/`instagram`/`facebook`/`tiktok`/`youtube`/`portal`/`indicacao`/`rede`/`incorporadora`/`placa`/`evento`/`importacao`/`outro`), `campanha` (texto), `peca_id` (ref, se veio de conteúdo), `link_rastreado` (código curto). Origem: `contatos.origem`, `metricas.origem`.

**`custos_origem`** — investimento declarado por canal/campanha/mês: `origem_id`, `mes` (data, dia 1), `valor_c`. Sem custo declarado, o custo por lead é `null` e a tela diz "informe o investimento".

**`consentimentos`**: `contato_id`, `texto_versao`, `canal`, `aceito_em`, `ip_hash`, `revogado_em`.

### 6.3 Imóveis e autorização

**`imoveis`** (S, L `IM-nnnn` ou código do corretor, AE sim para campos públicos)

| Coluna | Tipo | Obr. | Origem | Observação |
|---|---|---|---|---|
| codigo | texto | sim | `imoveis.codigo` | Único por conta |
| tipo | enum `casa`/`apartamento`/`lote`/`sala`/`loja`/`galpao`/`rural`/`outro` | sim | `imoveis.tipo` | |
| finalidade | enum `venda`/`venda_e_locacao` | sim | novo | Locação fora (3.3) |
| situacao | enum `rascunho`/`captacao`/`ativo`/`reservado`/`vendido`/`suspenso`/`encerrado` | sim | `imoveis.situacao` | |
| proprietario_id | ref contato | não | `imoveis.proprietario` | Nunca exposto em AE |
| origem_estoque | enum `carteira`/`rede`/`incorporadora` | sim | `imoveis.origem` | |
| unidade_id | ref `unidades` | quando incorporadora | `lotes.id` | |
| preco_c | inteiro | não | `imoveis.preco` | `null` = "sob consulta" |
| condominio_c, iptu_anual_c | inteiro | não | novo | |
| area_util_m2, area_total_m2 | decimal(10,2) | não | `imoveis.area` | |
| quartos, suites, banheiros, vagas | inteiro | não | `imoveis.*` | |
| endereco | json | sim | `imoveis.endereco` | Logradouro, nº, bairro, cidade, UF, CEP |
| endereco_publico | enum `completo`/`bairro`/`regiao` | sim | novo | Padrão `bairro` |
| lat, lng | decimal | não | novo | Filtro por caixa envolvente |
| geometria | json GeoJSON | não | `lotes.poligono` | Só lote/terreno |
| caracteristicas | lista texto | não | `imoveis.atributos` | |
| descricao | texto | não | `imoveis.descricao` | Pode ser gerada pelo Estúdio (10.5) |
| qualidade | inteiro 0–100 | — | — | **Derivado, não gravado** (6.12) |
| publicado_pagina | booleano | sim | `imoveis.naPagina` | |
| compartilhado_rede | enum `nao`/`conexoes`/`rede_aberta` | sim | novo | Exige autorização compatível (9.7) |

**`imovel_midias`** (S, AE sim quando `publica`): `imovel_id`, `arquivo_id`, `tipo` (`foto`/`video`/`planta`/`tour`/`documento`), `ordem`, `legenda`, `publica` (booleano), `gerada_por_ia` (booleano), `rotulo_ia` (texto obrigatório se gerada; ex.: "imagem ilustrativa"). Origem: `imoveis.fotos`, `imoveis.documentos` (classificação interno/pode exibir → `publica`).

**`autorizacoes_venda`** (S, L `AV-nnnn`)

| Coluna | Tipo | Obr. | Origem | Observação |
|---|---|---|---|---|
| imovel_id, proprietario_id | ref | sim | `imoveis.autorizacao` | |
| exclusiva | booleano | sim | `imoveis.exclusividade` | |
| inicio, fim | data | sim | | Vigência; anúncio só dentro dela |
| comissao_pct | decimal | sim | | |
| preco_autorizado_c | inteiro | sim | | |
| permite_parceria | booleano | sim | novo | Se `false`, não vai à rede |
| permite_placa, permite_portais | booleano | sim | novo | |
| documento_id | ref arquivo | sim para `ativo` | novo | Documento assinado |
| situacao | enum `rascunho`/`enviada`/`assinada`/`vencida`/`revogada` | sim | novo | `vencida` calculada na leitura e materializada na rotina diária |

### 6.4 Seleções e propostas

**`selecoes`** (S, L `S-nnnn`, AE sim por token): `contato_id`, `titulo`, `token` (aleatório, 32+ caracteres), `expira_em` (padrão +14 dias), `mensagem`, `criada_por_agente`. Origem: `selecoes`.
**`selecao_itens`**: `selecao_id`, `imovel_id`, `ordem`, `nota_corretor`.
**`reacoes`** (só inclusão, entra por webhook): `selecao_item_id`, `reacao` (`gostei`/`nao_gostei`/`quero_visitar`/`conversar_preco`), `comentario`, `em`. Origem: `selecoes.reacoes`.

**`propostas`** (S, L `P-nnnn`)

| Coluna | Tipo | Obr. | Origem | Observação |
|---|---|---|---|---|
| negocio_id, imovel_id | ref | sim | `propostas.*` | |
| versao | inteiro | sim | novo | Contraproposta = nova versão |
| valor_c, entrada_c | inteiro | sim, não | `propostas.valor`, `.entrada` | |
| parcelas, valor_parcela_c | inteiro | não | `propostas.parcelas` | |
| forma | enum `a_vista`/`financiamento`/`direto`/`permuta`/`misto` | sim | novo | |
| condicoes | texto | não | `propostas.condicoes` | |
| tabela_versao_id | ref | quando incorporadora | `propostas.tabela` | Proposta presa à versão |
| estado | enum `rascunho`/`enviada`/`em_analise`/`aceita`/`recusada`/`contraproposta`/`revalidar`/`expirada` | sim | `propostas.estado` | |
| decisor | enum `proprietario`/`incorporadora` | sim | `propostas.decisor` | |
| desvio_pct | decimal | não | **derivado** | Diferença à tabela; se > alçada → exceção |
| validade | data | sim | novo | |

### 6.5 Conversas e WhatsApp

**`canais_mensagem`**: `tipo` (`whatsapp_cloud`/`instagram_dm`/`messenger`/`email`), `identificador` (número E.164 ou id da página), `estado` (`pendente`/`conectado`/`erro`/`desconectado`), `credencial_ref` (referência ao segredo, nunca o segredo; P-01 sobre onde guardar), `membro_id` (dono do número), `limite_diario` (do provedor). Origem: `canais`.

**`conversas`** (S): `canal_id`, `contato_id`, `responsavel_id`, `atendido_por` (`agente`/`humano`), `agente_id`, `janela_ate` (fim da janela de 24 h do WhatsApp, recalculada a cada mensagem recebida), `primeira_entrada_em`, `primeira_resposta_em`, `primeira_resposta_humana_em`, `estado` (`aberta`/`aguardando_cliente`/`aguardando_corretor`/`encerrada`), `nao_entendidas` (inteiro; herdado do MVP). Origem: `conversas`.

**`mensagens`** (só inclusão): `conversa_id`, `direcao` (`entrada`/`saida`), `autor_tipo` (`contato`/`humano`/`agente`/`sistema`), `autor_id`, `conteudo` (texto), `midia_id`, `modelo_id` (se template), `categoria_cobranca` (`marketing`/`utilidade`/`autenticacao`/`servico`/`null`), `id_externo`, `status` (`enviada`/`entregue`/`lida`/`falhou`), `custo_c` (do provedor, quando informado), `em`.

**`modelos_mensagem`** — templates aprovados: `canal_id`, `nome`, `categoria`, `idioma`, `corpo`, `variaveis` (json), `status_aprovacao` (`rascunho`/`em_analise`/`aprovado`/`rejeitado`), `motivo_rejeicao`.

### 6.6 Agentes

**`agentes`**: `membro_id` (o usuário agente), `funcao` (`sdr`/`nutricao`/`proprietario`/`pos_venda`/`reativacao`/`conteudo`), `nome_publico` (como se apresenta), `autonomia` (`desligado`/`rascunho`/`supervisionado`/`autonomo`), `horario` (json; `sempre` ou fora do horário comercial), `instrucoes_conta` (texto do corretor: tom, regiões, diferenciais), `limites` (json: máx. mensagens por conversa/dia, temas proibidos, valor máximo citável), `responsavel_humano_id`, `ativo`. Origem: `assistentes`.

**`agente_execucoes`** (só inclusão): `agente_id`, `gatilho` (evento), `alvo_tipo`/`alvo_id`, `slot_ia`, `entrada_resumo` (hash e tamanho, não o conteúdo inteiro), `saida` (json validado, seção 10.6), `acoes_executadas` (json), `passou_para_humano` (booleano), `motivo_passagem`, `creditos`, `duracao_ms`, `erro`. Origem: `consumos`, `assistentes.log`.

**`base_conhecimento`** (S): `titulo`, `conteudo`, `escopo` (`conta`/`imovel`/`empreendimento`), `alvo_id`, `ativo`. Perguntas frequentes, regras de visita, documentação exigida, condições de pagamento.

**`passagens`**: `conversa_id`, `agente_id`, `para_membro_id`, `motivo` (enum, seção 10.3), `resumo` (gerado), `criada_em`, `assumida_em`, `prazo_ate` (derivado do parâmetro de atendimento). Alimenta a fila de Hoje.

### 6.7 Conteúdo

**`marcas`** — kit visual por membro/conta: `cores`, `fontes`, `logotipo_id`, `assinatura` (texto, opcional; leva o CRECI quando o perfil tem, D-93), `tom_de_voz`, `hashtags_padrao`. Origem: `paginas`.

**`pecas`** (S, L `PC-nnnn`)

| Coluna | Tipo | Obr. | Origem | Observação |
|---|---|---|---|---|
| tipo | enum `post`/`carrossel`/`story`/`reels`/`video_longo`/`descricao_portal`/`email`/`mensagem` | sim | `pecas.tipo` | |
| objetivo | enum `novo_imovel`/`baixou_preco`/`vendido`/`visita_aberta`/`autoridade`/`bairro`/`depoimento`/`empreendimento`/`captacao` | sim | novo | |
| imovel_id / empreendimento_id | ref | não | `pecas.imovel` | |
| titulo, legenda | texto | sim | `pecas.texto` | |
| midias | lista ref arquivo | não | `pecas.arte` | |
| roteiro | json | para vídeo | novo | Cenas, texto em tela, narração, duração |
| gerada_por_ia | booleano | sim | novo | |
| estado | enum `rascunho`/`gerando`/`revisao`/`aprovada`/`agendada`/`publicada`/`erro`/`arquivada` | sim | `pecas.estado` | |
| checagens | json | — | **derivado** | Autorização vigente, rótulo de IA, tamanho por canal (10.5); CRECI ausente vira só aviso, nunca bloqueio (D-93) |
| link_rastreado | texto | sim | novo | Código curto por peça, mede cliques e leads |

**`canais_sociais`**: `rede` (`instagram`/`facebook`/`tiktok`/`youtube`/`linkedin`/`google_perfil`), `conta_externa`, `credencial_ref`, `estado`, `escopos`. 

**`publicacoes`**: `peca_id`, `canal_social_id` ou `destino` (`pagina`/`portal:<nome>`/`rede`), `agendada_para`, `publicada_em`, `id_externo`, `url_externa`, `estado` (`agendada`/`enviando`/`publicada`/`falhou`/`removida`), `erro`, `metricas` (json atualizado pela rotina diária: alcance, impressões, curtidas, comentários, salvamentos, compartilhamentos, visualizações de vídeo).

### 6.8 e 6.9 Rede e Incorporadora

Movidas para `specs/horizonte.md` (D-88): só entram no `schema.json` nas fases 5 e 7.

### 6.10 Proprietário, metas e comissões

**`portais_proprietario`** (AE sim por token): `imovel_id`, `proprietario_id`, `token`, `ativo`, `ultimo_acesso_em`, `preferencias` (json: frequência do relatório, canal).
**`entregas`** — compromissos do corretor com o proprietário (plano de marketing): `imovel_id`, `tipo` (`fotos_profissionais`/`video`/`tour`/`anuncio_portal`/`post_redes`/`placa`/`visita_aberta`/`relatorio`/`avaliacao`/`outro`), `descricao`, `prazo`, `estado` (`prevista`/`feita`/`atrasada`/`cancelada`; `atrasada` derivado), `evidencia` (ref publicação, arquivo ou link), `feita_em`. A entrega `post_redes` se fecha sozinha quando a publicação correspondente é feita.
**`metas_imovel`** — combinado com o proprietário para o período: `imovel_id`, `periodo` (data início/fim), `visitas_alvo`, `propostas_alvo`, `revisao_preco_em` (data combinada para rever preço se as metas não forem atingidas).
**`relatorios_proprietario`**: `imovel_id`, `periodo`, `conteudo` (json congelado no envio), `enviado_em`, `lido_em`, `comentario_proprietario`. Origem: `relatorios`.
**`mensagens_proprietario`**: thread do portal (`autor_tipo`, `texto`, `em`), entra por webhook.

**`metas`** — do membro ou da equipe: `escopo` (`membro`/`equipe`/`conta`), `alvo_id`, `indicador` (`vgv_c`/`vendas`/`captacoes`/`visitas`/`propostas`/`primeiro_atendimento_dentro_prazo_pct`/`comissao_recebida_c`/`pecas_publicadas`), `periodo` (mês, trimestre, ano), `alvo`, `tipo` (`resultado`/`atividade`). Indicadores de atividade são os que o corretor controla; os de resultado são consequência.
**`comissoes`** (L `CO-nnnn`): `negocio_id`, `base_c` (valor da venda), `pct`, `valor_bruto_c` (= base × pct, gravado no fechamento), `estado` (`prevista`/`a_receber`/`recebida_parcial`/`recebida`/`cancelada`).
**`comissao_divisoes`**: `comissao_id`, `beneficiario` (`membro`/`conta`/`externo`), `beneficiario_id`, `pct_da_comissao`, `valor_c`. Soma de `pct_da_comissao` = 1.
**`recebimentos`**: `comissao_id`, `valor_c`, `recebido_em`, `comprovante_id`.

### 6.11 Métricas e consumo

**`metricas_diarias`** (agregado, sem dado pessoal): `dia`, `membro_id`, `imovel_id` (nullable), `peca_id` (nullable), `origem_id` (nullable), `tipo` (`visualizacao_pagina`/`visualizacao_imovel`/`clique_whatsapp`/`lead`/`reacao`/`visita_pedida`/`clique_link`/`alcance_peca`), `quantidade`. Origem: `metricas` (843 linhas no seed). Chave única (`dia`, `membro_id`, `imovel_id`, `peca_id`, `origem_id`, `tipo`); a rotina e o webhook somam, nunca inserem duplicado.
**`consumos`** (só inclusão): `tipo` (`ia_texto`/`ia_imagem`/`ia_video`/`whatsapp_mensagem`/`publicacao`), `creditos`, `custo_c` (quando conhecido), `referencia` (execução, mensagem, peça), `em`. Origem: `consumos`.

### 6.12 Derivados que não se gravam

| Derivado | Fórmula |
|---|---|
| Qualidade do anúncio (0–100) | Fotos públicas ≥ 8 (25) + descrição ≥ 400 caracteres (15) + preço informado (15) + área e cômodos (10) + localização (10) + autorização vigente (15) + CRECI na página (10; só pontua, nunca bloqueia, D-93). Sem autorização vigente o anúncio não publica, independentemente da nota |
| Compatibilidade imóvel × perfil | Tipo (30) + região (25) + preço dentro da faixa ±10% (25) + área (10) + quartos/vagas (10). `null` se o perfil não tem tipo nem preço |
| Nota de qualificação do contato | Tem prazo de compra (20) + faixa de preço (15) + forma de pagamento (15) + respondeu nas últimas 72 h (20) + pediu visita (20) + reagiu positivamente a seleção (10) |
| Prazo restante (reserva, autorização, seleção, primeiro atendimento) | `vence_em − agora`, mostrado em horas/dias |
| Desvio da proposta | `(valor_c − preço_tabela_c) / preço_tabela_c` |
| Previsão ponderada | Σ (`valor_estimado_c` × `comissao_pct` × probabilidade da etapa) dos negócios abertos |
| Radar de preço | R$/m² do imóvel vs média dos imóveis da mesma conta e região/tipo, faixa ±10%; com menos de 3 comparáveis, `null` e frase |

### 6.13 `sql_declarado` [plataforma]

Consultas agregadas previstas (P-01 confere a allowlist): funil por coorte (negócios criados no período por etapa máxima atingida, a partir de `eventos` de mudança de etapa); tempos de primeiro atendimento em faixas; conversão por origem; contagens por dia de `metricas_diarias`; previsão ponderada. Se a allowlist não comportar a de funil por coorte, a rotina diária materializa `funil_diario` (P-01).

### 6.14 LGPD e retenção

Exclusão comum é soft-delete. Pedido do titular anonimiza (`nome` → "Contato removido", telefone/e-mail nulos, mensagens com conteúdo substituído, eventos preservados sem dados pessoais). Rotina mensal anonimiza contatos sem negócio aberto e sem interação há 24 meses (prazo P-15). O controlador dos dados do comprador é a conta que o atende (P-10). Exportação da própria carteira é direito do dono da conta (7.4).

### 6.15 Tabelas acrescentadas na 0.3

**`acessos_cliente`** (AE sim por token) — o acesso do cliente do corretor como usuário externo (2.2).

| Coluna | Tipo | Obr. | Origem | Observação |
|---|---|---|---|---|
| contato_id | ref | sim | novo | Comprador ou proprietário |
| perfil | enum `comprador`/`proprietario` | sim | novo | Define o que o portal mostra |
| token | texto 32+ | sim | `selecoes.token` | Link enviado pelo WhatsApp |
| usuario_externo_id | ref usuário [plataforma] | não | novo | Preenchido se o cliente optar por entrar com conta (P-20) |
| codigo_confirmacao_em | data-hora | não | novo | Confirmação por código no WhatsApp para ações sensíveis |
| ativo, expira_em | booleano, data | sim, não | novo | O corretor revoga quando quiser |
| ultimo_acesso_em | data-hora | não | novo | |

**`envios`** (só inclusão) — tudo que o corretor ou o Mensageiro mandou ao cliente, com abertura e clique. É a base do "histórico de tudo que mandei" e dos cliques do funil.

| Coluna | Tipo | Obr. | Origem | Observação |
|---|---|---|---|---|
| contato_id, negocio_id | ref | sim, não | novo | |
| tipo | enum `imovel`/`selecao`/`arquivo`/`link_portal`/`simulacao`/`localizacao`/`mensagem_modelo`/`peca` | sim | novo | |
| alvo_id | uuid | não | | Imóvel, seleção, arquivo, peça |
| canal | enum `whatsapp`/`email`/`portal` | sim | | |
| autor_tipo | enum `humano`/`mensageiro` | sim | | |
| link_rastreado | texto | sim | | Código curto |
| enviado_em, entregue_em, lido_em | data-hora | sim, não, não | | Status do WhatsApp quando houver |
| primeiro_clique_em, cliques | data-hora, inteiro | não, sim | | Somado pelo webhook do link |

**`classificacoes`** (só inclusão) — histórico de temperatura e etapa sugerida.

| Coluna | Tipo | Obr. | Observação |
|---|---|---|---|
| contato_id | ref | sim | |
| temperatura | enum `frio`/`morno`/`quente` | sim | |
| motivo | texto | sim | Frase curta: "pediu visita e respondeu em 2 min" |
| sinais | json | sim | Sinais usados (6.12) |
| autor | enum `regra`/`ia`/`corretor` | sim | Corretor pode sobrescrever; a sobrescrita vale até novo sinal forte |
| em | data-hora | sim | |

`contatos.temperatura` guarda a última; o histórico fica aqui.

**`playbook_funil`** — abordagens recomendadas por etapa e temperatura (padrão vem semeado; a conta ajusta).

| Coluna | Tipo | Obr. | Observação |
|---|---|---|---|
| pipeline, etapa_id, temperatura | | sim | |
| abordagem | texto | sim | Ex.: "Mandar 3 imóveis compatíveis e oferecer 2 horários de visita" |
| canal_sugerido | enum | sim | |
| prazo_horas | inteiro | sim | Quando a abordagem vira tarefa atrasada |
| modelo_mensagem_id | ref | não | Mensagem pronta |

**`paginas_corretor`** (AE sim) — a landing page própria.

| Coluna | Tipo | Obr. | Origem | Observação |
|---|---|---|---|---|
| membro_id | ref | sim | `paginas` | Uma por corretor; imobiliária pode ter a sua |
| endereco | texto | sim | `paginas.slug` | `/p/<slug>`; domínio próprio em fase futura (P-21) |
| tema | enum dos temas permitidos | sim | novo | Dentro do que a página pública aceita (sem tokens de tema; cores como dado). **1.1:** sai da tela; a cor vem da marca única (D-85); a coluna fica, aditiva |
| blocos | json | sim | `paginas.blocos` | Ordem e conteúdo: apresentação, destaques, imóveis, empreendimentos, depoimentos, sobre, bairros atendidos, formulário, WhatsApp, Instagram |
| seo | json | não | novo | Título, descrição, imagem de compartilhamento |
| publicada_em | data-hora | não | | |
| gerada_por_ia | booleano | sim | novo | Primeira versão montada pelo Estúdio |

**`assistente_conversas`** e **`assistente_mensagens`** — o chat do corretor com o Assistente (A1): `membro_id`, `tela_origem`, `pergunta`, `resposta`, `fontes` (artigos de ajuda usados), `acao_proposta` (json), `acao_confirmada_em`, `util` (polegar), `creditos`.

**`itens_cliente`** (AE sim por token) — concessão explícita do que cada cliente vê (4.5).

| Coluna | Tipo | Obr. | Observação |
|---|---|---|---|
| acesso_cliente_id | ref | sim | |
| tipo | enum `imovel`/`empreendimento`/`selecao`/`arquivo`/`visita`/`reuniao`/`proposta`/`relatorio`/`entrega` | sim | |
| alvo_id | uuid | sim | |
| concedido_por | ref membro ou agente | sim | |
| concedido_em, revogado_em | data-hora | sim, não | Revogar some do portal na hora |

Índice único (`acesso_cliente_id`, `tipo`, `alvo_id`). Todo envio ao cliente (`envios`) cria a concessão correspondente.

**`pendencias_agendadas`** — conferência dos agendamentos feitos com `req.eventos.agendar` (publicação, lembrete, vencimento): `tipo`, `alvo_id`, `agendamento_id`, `executar_em`, `executado_em`, `atraso_seg`. A rotina diária usa para recuperar o que falhou.

**`visibilidade`** acrescentada a `imoveis`, `empreendimentos` e `contatos`: enum `privado` (padrão) / `equipe` / `rede` / `publico`.

**Alterações em tabelas da 0.2:** `agentes` ganha `config_mensageiro` (json do assistente de configuração, 10.3), `voz` (`texto`/`texto_e_audio`), `permissoes_acao` (json: por ação, `nao`/`perguntar`/`sim`); `canais_mensagem` ganha `modo` (`coexistencia`/`api_exclusiva`), `estado_sincronizacao`, `nota_qualidade`; `canais_sociais` ganha `tipo_conta` (`business`/`creator`), `token_expira_em`; `publicacoes` ganha `container_id` e `container_expira_em` (Instagram, 9.2); `visitas` ganha `feedback_publicado_em` (revisão antes do proprietário).

### 6.16 Negociação (1.2)

Todas as tabelas abaixo seguem a regra da 4.5: `segregada_por_conta: true` e `acesso_externo: "restrito"`.

**`negociacoes`** (S, L `NG-nnnn`) — uma por negócio em negociação.

| Coluna | Tipo | Obr. | Observação |
|---|---|---|---|
| negocio_id, anuncio_id, contato_id | ref | sim | |
| estado | enum `ativa`/`aguardando_cliente`/`aguardando_corretor`/`aguardando_proprietario`/`ganha`/`perdida`/`pausada` | sim | |
| conduzida_por | enum `ia`/`humano`/`corretor` | sim | `humano` só com a política multi-usuário ligada (D-108) |
| negociador_usuario_id | ref `shell.usuarios` | quando humano | |
| mandato_id | ref | não | Sem mandato, o Negociador só sugere |
| teto_estimado_comprador_c | inteiro | não | Última estimativa; com `fonte_estimativa` (texto) |
| batna_estimada_comprador | texto | não | |
| valor_final_c | inteiro | quando ganha | |
| motivo_perda | enum (6.2) | quando perdida | |
| rodadas | inteiro | sim | Materializado a cada proposta |

**`mandatos_negociacao`** (S; **sigiloso**: nunca vai ao portal do cliente, a página pública, à vitrine nem a exportação do cliente).

| Coluna | Tipo | Obr. | Observação |
|---|---|---|---|
| negociacao_id | ref | sim | Um vigente por negociação; versões anteriores ficam (histórico) |
| preco_pedido_c, alvo_c, recuo_c | inteiro | sim | Validação recuo ≤ alvo ≤ pedido |
| batna_vendedor | texto | não | Sigiloso |
| concessoes | json | sim | Lista `{item, limite, contrapartida}` |
| passo_max_pct | decimal | sim | Padrão 0,40 do intervalo restante |
| rodadas_max | inteiro | sim | Padrão 4 |
| validade | data | sim | |
| autonomia | enum `sugere`/`pergunta_antes`/`faz_sozinho` | sim | `faz_sozinho` só age no canal do portal (D-107) |
| autorizacao_proprietario | json | quando `faz_sozinho` | `{tipo: anexo|mensagem, arquivo_id, data}`; forma final em P-41 |
| versao | inteiro | sim | |

**`propostas`** (6.4) ganha: `negociacao_id`, `rodada` (inteiro), `direcao` (`comprador`/`vendedor`/`proprietario`), `autor_tipo` (`cliente`/`corretor`/`negociador_ia`/`negociador_humano`/`proprietario`), `concessao` (json), `contrapartida` (json), `validade_ate` (datahora), `canal` (`registro` = registrada pelo corretor / `portal` = feita ou enviada pelo Portal do Cliente por token / `wa_me` = enviada pelo "Fazer agora", que abre o WhatsApp do celular do corretor e registra o envio / `whatsapp` = API do WhatsApp, só quando P-31/P-32 forem atendidas). As propostas passam a existir **no MVP** (antes estavam na fase 3; D-100).

**`atribuicoes_negociacao`**: `negociacao_id`, `usuario_id` (negociador humano), `atribuida_por`, `ativa`. Define o que o role `negociador` enxerga (11.6); toda rota filtra por `usuario_id = usuario.id` para esse role.

**`objecoes_detectadas`** (só inclusão): `negociacao_id`, `contato_id`, `categoria` (Apêndice D), `trecho`, `detectada_por` (`ia`/`humano`), `tratada` (booleano), `em`.

**`config_negociador`** (uma por conta): `ligado`, `conduz_padrao` (`ia`/`humano`; padrão `ia`, D-94), `negociador_padrao_id`, `gatilhos` (json), `estilo` (`cooperativo`/`firme`/`consultivo`), `instrucoes_corretor` (texto, até 4.000), `assinatura_humana` (texto que o cliente vê), `versao`.

**`playbook_objecoes`**: `categoria`, `pergunta_exploracao`, `resposta_base`, `proximo_passo`, `origem` (`padrao`/`corretor`). Semeado com o Apêndice D em `aoIniciar` (idempotente); o corretor edita por categoria.

**`negociador_execucoes`** (só inclusão): como `agente_execucoes` (6.6), com `validacoes` (json do resultado de 10.9.7), `bloqueado_por` (texto) e `aprovada_sem_edicao` (booleano).

## 7. API

Envelope, paginação e formato de erro seguem o contrato da API do shell (P-01). Toda rota filtra por `conta_id` do usuário; rota de membro `corretor` filtra também por `responsavel_id`, exceto o que foi compartilhado. "Tela" indica onde a rota é usada (nenhuma rota sem tela).

**Tradução para a plataforma.** Rotas relativas em `backend/rotas.ts` (servidas em `/api/portal_corretor/…`); públicas em `rotasPublicas` (`/api/pub/portal_corretor/…`, só GET); webhooks em `webhooks` (`/api/wh/…`). Na tabela abaixo, "Papel mínimo" vira role (`corretor`, `negociador`, `operacao`; `cliente` só na fase posterior, D-56) checado na rota; o Portal do Cliente do MVP não tem rota autenticada, só página pública e `wh` com token (D-73). As rotas que já existem em 0.1.0 estão descritas em `apps/portal_corretor/docs/`; a tabela abaixo é o desenho. Todo `DELETE` da tabela vira `PATCH …/remover` (soft delete). Paginação limitada a 100 por página. Toda rota tem tela (11).

### 7.1 Internas

| Rota | Métodos | Papel mínimo | Devolve / faz | Tela |
|---|---|---|---|---|
| `/inicio` | GET | corretor | Passagens pendentes, primeiros atendimentos correndo, retornos do dia, visitas, prazos vencendo, entregas atrasadas | Hoje |
| `/contatos` | GET, POST | corretor | Lista com filtros (papel, etapa, temperatura, origem, parado há N dias, responsável); cria | Clientes |
| `/contatos/:id` | GET, PATCH, DELETE | corretor (dono) | Ficha com linha do tempo, negócios, conversas, seleções | Clientes › ficha |
| `/contatos/importar` | POST | corretor | CSV; modos de duplicata `pular`/`atualizar`/`criar` (12.1) | Clientes › importar |
| `/contatos/exportar` | GET | dono_conta, gestor | CSV da carteira | Ajustes › Privacidade |
| `/negocios` | GET, POST | corretor | Lista e quadro por etapa | Clientes › Funil |
| `/negocios/:id` | GET, PATCH | corretor | Inclui mudança de etapa (gera evento) e motivo de perda | Clientes › Funil |
| `/funil/etapas` | GET, PUT | dono_conta | Configuração de etapas | Ajustes › Funil e abordagens |
| `/atividades` | GET, POST, PATCH | corretor | Agenda e tarefas | Hoje (abas Hoje e Agenda), Clientes |
| `/visitas/:id/feedback` | POST | corretor | Registra feedback e ficha | Hoje › Agenda, Clientes › ficha |
| `/imoveis` | GET, POST | corretor | Carteira, filtros por situação, origem, qualidade | Imóveis |
| `/imoveis/:id` | GET, PATCH, DELETE | corretor (dono) | Ficha, mídias, autorização, entregas, métricas | Imóveis › ficha |
| `/imoveis/:id/midias` | POST, PATCH, DELETE | corretor | Upload e ordem | Imóveis › mídias |
| `/autorizacoes` | GET, POST, PATCH | corretor | Autorização de venda | Imóveis › autorização |
| `/selecoes` | GET, POST | corretor, agente | Cria com token | Clientes › seleção |
| `/propostas` | GET, POST, PATCH | corretor | Versões, envio, decisão registrada | Clientes › Negociações (P15) |
| `/conversas` | GET | corretor | Caixa unificada com filtros `minha vez`, `com agente`, `aguardando cliente` | Conversas |
| `/conversas/:id/mensagens` | GET, POST | corretor, agente | Envia texto, mídia, modelo | Conversas › thread |
| `/conversas/:id/assumir` | POST | corretor | Tira o agente da conversa | Conversas › thread |
| `/conversas/:id/devolver` | POST | corretor | Devolve ao agente | Conversas › thread |
| `/agentes` | GET, PUT | dono_conta | Configuração, autonomia, limites, instruções | Ajustes › Mensageiro |
| `/agentes/:id/execucoes` | GET | dono_conta, gestor | Trilha com custo | Ajustes › Mensageiro |
| `/base-conhecimento` | GET, POST, PATCH, DELETE | corretor | | Ajustes › Mensageiro |
| `/canais` | GET, POST, DELETE | dono_conta | Conecta WhatsApp e redes | Ajustes › Conexões |
| `/modelos-mensagem` | GET, POST | dono_conta | Submete template | Ajustes › Conexões |
| `/pecas` | GET, POST | corretor | Lista e cria (manual ou gerar) | Estúdio |
| `/pecas/:id` | GET, PATCH, DELETE | corretor | Edita, aprova | Estúdio |
| `/pecas/:id/gerar` | POST | corretor | Dispara geração (texto, arte, vídeo) com custo estimado | Estúdio |
| `/publicacoes` | GET, POST, DELETE | corretor | Agenda, publica, remove | Estúdio |
| `/regras-publicacao` | GET, PUT | dono_conta | Divulgação automática | (horizonte, D-88) |
| `/rede/conexoes` | GET, POST, PATCH | corretor | Convites e aceite | Rede |
| `/rede/grupos` | GET, POST, PATCH | corretor | | Rede › grupos |
| `/rede/imoveis` | GET | corretor | Imóveis compartilhados comigo, filtros | Imóveis › rede |
| `/rede/compartilhamentos` | POST, DELETE | corretor | | Imóveis › ficha |
| `/parcerias` | GET, POST, PATCH | corretor | Propõe, aceita, encerra | Rede › parcerias |
| `/proprietarios/:imovel/portal` | GET, POST | corretor | Ativa portal, gera token | Proprietários |
| `/entregas` | GET, POST, PATCH | corretor | | Proprietários › imóvel |
| `/metas-imovel` | GET, PUT | corretor | | Proprietários › imóvel |
| `/relatorios-proprietario` | GET, POST | corretor | Pré-visualiza e envia | Proprietários › relatório |
| `/metas` | GET, PUT | gestor (equipe), corretor (próprias) | | Números (fase 4) |
| `/comissoes` | GET, POST, PATCH | corretor | Previstas, a receber, divisões, recebimentos | Clientes › Funil (fase 4) |
| `/desempenho` | GET | corretor | KPIs da seção 11.2 com período e recorte | Números |
| `/custos-origem` | GET, PUT | dono_conta | Investimento por canal/mês | Números |
| `/consumo` | GET | dono_conta | Créditos do mês por tipo | Ajustes › Plano e créditos |
| `/assistente` | GET, POST | corretor | Conversa com o Assistente; ação proposta e confirmação | Assistente (coluna de contexto, P05) |
| `/assistente/acoes/:id/confirmar` | POST | corretor | Executa a ação proposta | Assistente (coluna de contexto, P05) |
| `/mensageiro` | GET, PUT | dono_conta | Configuração em 5 passos, permissões por ação | Ajustes › Mensageiro |
| `/mensageiro/teste` | POST | dono_conta | Conversa de teste sem enviar ao WhatsApp | Ajustes › Mensageiro |
| `/mensageiro/aprovacoes` | GET, POST | corretor | Ações em "pergunta antes" aguardando | Hoje, Conversas |
| `/funil/fila` | GET | corretor | Fila do dia | Hoje, Clientes › Funil |
| `/contatos/:id/proxima-abordagem` | GET, POST | corretor | Sugestão e "fazer agora" | Clientes › Funil |
| `/contatos/:id/temperatura` | PUT | corretor | Sobrescreve a classificação | Clientes › Funil |
| `/envios` | GET, POST | corretor, agente | Envia imóvel, arquivo, seleção, link; lista com abertura e cliques | Conversas, Clientes |
| `/acessos-cliente` | GET, POST, DELETE | corretor | Gera, envia e revoga link do Portal do Cliente | Clientes, Conversas |
| `/paginas` | GET, PUT, POST | corretor | Editor e publicação da Minha Página | Página |
| `/templates-arte` | GET | corretor | Modelos disponíveis | (horizonte, D-88) |
| `/conexoes/whatsapp` | GET, POST, DELETE | dono_conta | Início e estado do cadastro incorporado | Ajustes › Conexões |
| `/conexoes/instagram` | GET, POST, DELETE | dono_conta | Login do Instagram, checagem de conta e permissão | Ajustes › Conexões |
| `/empreendimentos-corretor` | GET, POST, PATCH | corretor | Empreendimentos cadastrados pelo corretor (D-31) | Imóveis |
| `/negociacoes` | GET, POST | corretor, negociador (atribuídas) | Lista com os filtros de P15; cria negociação a partir de um negócio | Clientes › Negociações (P15) |
| `/negociacoes/:id` | GET, PATCH | corretor, negociador (atribuída) | Detalhe com faixa ZOPA, escada de propostas e leitura do comprador; encerrar | P15 |
| `/negociacoes/:id/mandato` | GET, PUT | corretor (escrita); negociador (leitura) | Mandato vigente e versões; **nunca** sai em rota pública, vitrine ou portal | P16 |
| `/negociacoes/:id/propostas` | GET, POST | corretor, negociador | Registra a oferta do comprador (`canal: registro`) ou envia contraproposta pelo portal ou por "Fazer agora" (`wa_me`), sempre validada por 10.9.7 (D-107) | P15, M8 |
| `/negociacoes/:id/sugestao` | POST | corretor, negociador | Próximo movimento do Negociador IA (custo mostrado; degrada sem slot) | P15, M8 |
| `/negociacoes/:id/decisao` | POST | corretor | Leva o acordo à decisão do proprietário (MVP: o corretor registra) | P15 |
| `/negociacoes/:id/assumir`, `/negociacoes/:id/devolver` | POST | corretor, negociador | Troca quem conduz | P15 |
| `/propostas/:id` | PATCH | corretor | Registra a decisão do proprietário (aceita, recusa, contraproposta) | P15 |
| `/negociador/config` | GET, PUT | corretor | Gatilhos, estilo, instruções, respostas a objeções | Ajustes › Negociador (P17) |
| `/negociador/teste` | POST | corretor | Simulador (não envia nada ao cliente) | P17 |
| `/negociador/atribuicoes` | GET, POST, PATCH | corretor | Convidar (sem CRECI, D-94) e atribuir negociador humano; recusa com aviso se a política multi-usuário estiver desligada (D-108) | P17, P15 |
| `/busca` | GET | corretor | Busca global por tipo (clientes, imóveis, conversas, peças) | Todas (coluna esquerda, `/`) |
| Incorporadora: `/empreendimentos`, `/unidades`, `/tabelas`, `/credenciamentos`, `/reservas`, `/reservas/:id/confirmar`, `/excecoes`, `/excecoes/:id/decidir`, `/materiais`, `/listas-espera` | conforme | comercial_incorporadora (corretor credenciado lê e pede) | Herdado do MVP | Painel, Empreendimentos, Espelho, Reservas, Corretores, Exceções |

### 7.2 Públicas (GET, páginas públicas)

`/c/:token` (Portal do Cliente, comprador ou proprietário), `/p/:corretor` (Minha Página), `/p/:corretor/imovel/:codigo`, `/s/:token` (seleção), `/m/:empreendimento` (material público), `/l/:codigo` (link rastreado: conta o clique pelo webhook e redireciona — P-01 sobre redirecionamento a partir de página GET), `/rede/:membro` (cartão público). — **Implementado (bloco 5a) com endereço por query (D-71):** `/p?c=<endereço>`, `/p?c=<endereço>&i=<código>` e `/l?c=<código>`.

### 7.3 Webhooks de entrada (wh)

| Webhook | Origem | Validação | Efeito |
|---|---|---|---|
| `formulario_lead` | Página, imóvel, material | Honeypot `site`, limite 3/min por IP-hash, consentimento obrigatório | Cria/une contato, negócio `Novo`, conversa; evento `lead.recebido` |
| `reacao_selecao` | Seleção | Token válido e não expirado | Grava reação; `quero_visitar` cria tarefa e aciona agente |
| `proprietario_acao` | Portal | Token | Mensagem, aceite de entrega, ciência de proposta, aprovação de preço/conteúdo |
| Portal do Cliente — propostas (1.2, M5b) | Portal do Cliente (página pública por token, D-73, D-104) | Token do ingresso conferido por `inspecionarIngressoWh`; limite por IP-hash | **Nova oferta** (grava rodada `direcao: comprador`, `canal: portal`; evento `proposta.recebida`) e **aceitar condição** (registra só a intenção; evento `proposta.aceite_cliente`); o listener grava com `comConta`. Nenhum dado do mandato volta na resposta |
| `whatsapp_entrada` | Meta Cloud API | Assinatura do provedor | Mensagem recebida, status de entrega, falha |
| `social_callback` | Meta, TikTok, YouTube | Assinatura | Status de publicação, comentários e DMs com intenção (fase 6) |
| `video_pronto` | Provedor de vídeo | Assinatura | Anexa vídeo à peça, muda estado para `revisao` |
| `rede_federada` | Outra instância | Chave de conexão | Fase 7 (P-16) |
| `metrica_publica` | Páginas públicas | Limite por IP-hash | Soma em `metricas_diarias` |

### 7.4 Exportação

CSV com cabeçalho em português e separador `;` (Excel pt-BR): contatos, negócios, atividades, imóveis, comissões; para incorporadora: reservas, propostas, espelho por versão de tabela. Exporta só o que o papel enxerga. Dinheiro sai em reais com vírgula.

## 8. Rotinas

**Tradução para a plataforma.** As rotinas abaixo são `rotinas` do manifesto (diária, semanal, mensal; horário definido pelo admin da app; até 15 min; idempotentes). **Tudo que tem hora marcada** — publicação agendada, lembrete de visita, vencimento de seleção, reserva ou janela de aprovação — usa `req.eventos.agendar` no momento em que a coisa é criada, e a rotina diária só confere e recupera o que falhou.

Todas idempotentes por chave (`rotina`, `periodo`, `alvo_id`): rodar duas vezes no mesmo período não duplica aviso nem gravação. Orçamento: 15 min; se não terminar, grava cursor e continua na próxima execução, publicando `rotina.incompleta`.

| Rotina | Cadência | Lote / cursor | O que faz |
|---|---|---|---|
| `vencimentos_diarios` | Diária | por conta | Materializa `vencida` em reservas, seleções, autorizações; abre a janela da fila para o próximo; marca entregas atrasadas; avisa autorização a 30 e 7 dias do fim |
| `cobranca_atendimento` | Diária | por conta | Lista conversas e passagens fora do prazo do dia anterior; resumo ao gestor. O alerta em tempo real é por evento (13), não por rotina |
| `clientes_parados` | Diária | 500 contatos | Cria tarefa "retomar" para quem passou de `dias_cliente_parado`; aciona agente de reativação se autonomia permitir |
| `metricas_redes` | Diária | 200 publicações | Busca métricas das publicações dos últimos 30 dias |
| `agregados_funil` | Diária | por conta | Materializa `funil_diario` se a allowlist não comportar (6.13) |
| `relatorio_proprietario` | Semanal | 100 imóveis | Prepara relatório da semana (visitas, feedbacks sem nome, métricas, entregas, propostas) e envia por e-mail/WhatsApp conforme preferência. Horário P-05 |
| `resumo_semanal_corretor` | Semanal | por membro | O que andou, o que travou, metas da semana |
| `radar_mensal` | Mensal | por imóvel ativo | Radar de preço e revisão combinada (`metas_imovel.revisao_preco_em`) |
| `fechamento_consumo` | Mensal | por conta | Fecha consumo, zera cota |
| `retencao_lgpd` | Mensal | 1.000 contatos | Anonimização por inatividade (6.14) |
| `pos_venda` | Mensal | por contato `pos_venda` | Aniversário de compra, relatório anual de valorização, pedido de indicação (agente de pós-venda) |

## 9. Integrações externas

### 9.0 Meta: o que é do corretor e o que é do app

**Do corretor, sempre:** o número e a conta do WhatsApp Business, o Instagram, a página do Facebook, as conversas, os seguidores e o pagamento das mensagens à Meta (no modelo de provedor de tecnologia, o próprio corretor cadastra a forma de pagamento no gerenciador do WhatsApp). A plataforma não tem conta para publicar, divulgar imóveis ou falar com clientes (D-42).

**Do app, uma vez para todos os corretores:** o **registro do software** na Meta. Ele existe por quatro motivos práticos:

1. **A Meta só deixa um software acessar a conta de alguém se ele estiver identificado.** O botão "Conectar" abre a tela da Meta onde o corretor lê "Portal do Corretor quer acessar seu WhatsApp e seu Instagram" e autoriza. Esse nome, o logotipo e as permissões pedidas vêm do registro. Sem registro, a tela não existe e o botão não funciona. É o mesmo que acontece em "entrar com Google" num site, ou quando o corretor conecta o Instagram ao mLabs, RD Station ou Hootsuite: a conta é dele, mas a ferramenta é registrada.
2. **As mensagens dos clientes só chegam ao app pelo registro.** Quando um cliente escreve para o número do corretor, a Meta entrega a mensagem no endereço configurado no app registrado. Sem registro, o Mensageiro não recebe nada.
3. **A conexão sem trocar de número (coexistência) só existe pelo cadastro incorporado,** que é oferecido por software registrado como provedor de tecnologia. Sem isso, o corretor teria de tirar o número do WhatsApp Business do celular ou usar um número novo.
4. **A Meta revisa o software, não o corretor.** A verificação da empresa e a revisão do app são feitas uma vez, por quem desenvolve; depois disso, qualquer corretor conecta em poucos cliques.

**O que o registro não é:** não é conta de Instagram nem de WhatsApp, não publica nada, não aparece para os clientes do corretor, não dá acesso a contas de ninguém sem autorização expressa, que o corretor pode revogar a qualquer momento.

**Caminhos possíveis (P-26):**

| Caminho | Quem registra | Para o corretor | Para a empresa |
|---|---|---|---|
| **A. Registro próprio** (recomendado) | A empresa dona do produto, uma vez | Conecta em poucos cliques, mantém o número no celular | Verificação da empresa (CNPJ, site, domínio) e revisão do app com vídeo; algumas semanas, feitas durante o MVP |
| **B. Parceiro já aprovado** | Um provedor de soluções (360dialog, Infobip, Twilio, Gupshup, Blip, Zenvia) | Igual ao A | Sem revisão própria do WhatsApp; custo do parceiro por mensagem ou por conta; dependência de fornecedor. O Instagram ainda pede registro próprio ou API de terceiros |
| **C. Cada corretor registra o próprio app** | O corretor, em developers.facebook.com | Cerca de uma hora de configuração técnica, gerar e colar tokens no app, sem coexistência | Nenhum registro; suporte técnico alto. Serve como modo avançado, não como padrão |

**No MVP nada disso bloqueia:** o app registrado em modo de desenvolvimento funciona para a equipe e os testadores, com as contas de teste da equipe. A decisão A, B ou C precisa estar tomada antes da fase 2 (validação).

### 9.1 WhatsApp (Meta Cloud API) — conexão em 3 passos

A comunicação do relacionamento com o cliente passa pelo app (D-25). A conexão tem de ser simples para um corretor que já usa o WhatsApp Business no celular.

**Fluxo:**
1. Em Configurações › WhatsApp, o corretor toca "Conectar meu WhatsApp" e entra com a conta Meta.
2. Digita o número que já usa no WhatsApp Business. O fluxo de cadastro incorporado da Meta (versão atual, "número primeiro") reconhece o número e dispara a **coexistência**: confirma o perfil (foto, nome) e lê um QR code no celular.
3. O app mostra "sincronizando" e, ao terminar, "conectado". As conversas passam a aparecer na caixa do app; o corretor continua podendo usar o aplicativo no celular.

**Regras da coexistência que viram regra de produto:**
- Mensagens enviadas e recebidas espelham entre o aplicativo e o app; o histórico do app é a fonte para métricas e IA.
- O aplicativo no celular continua sendo o aparelho principal; se o corretor desinstalar, a conexão cai → o app detecta, marca o canal como `erro` e avisa.
- Janela de atendimento e cobrança não são compartilhadas entre aplicativo e API: o app só conta o que passa por ele.
- Uma conta do aplicativo, um número em coexistência.
- A versão 2 do cadastro incorporado foi descontinuada em 15/10/2026: construir direto na versão atual.
- Para oferecer o cadastro incorporado a terceiros, o app precisa estar registrado na Meta (9.0).

**Alternativas, em ordem:** número novo exclusivo para a API (sem coexistência); BSP que já é provedor aprovado, até a aprovação própria sair; link `wa.me` com registro manual (sempre disponível, sem IA).

**Regras de mensagem (mantidas):** fora da janela de 24 h só modelo aprovado; cobrança por mensagem por categoria, em BRL para contas novas no Brasil; classificação de respostas do provedor como na 0.2.

**Como as mensagens chegam ao app (desenho do webhook):**
1. Ao conectar o WhatsApp de um corretor, o app gera um **ingresso `wh` próprio da conta** (`gerarIngressoWh` com a conta no contexto, modo recorrente).
2. O app configura esse endereço como **endereço alternativo de webhook do número do corretor** na Meta (recurso oficial: a Meta envia as mensagens daquele número para o endereço alternativo, com um token de verificação próprio).
3. Cada mensagem chega no ingresso da conta certa: o handler já sabe de qual corretor é, sem tabela de roteamento. Ele valida a assinatura da Meta, grava o recebimento mínimo e publica `mensagem_recebida` com `{conta_id}`.
4. O listener `reagir` carrega o contexto da conta (`dados.comConta`), chama a IA, executa as ações e responde pelo WhatsApp. Idempotente pelo id da mensagem.
5. O endereço padrão do app na Meta aponta para um ingresso geral que só registra e descarta o que não tiver conta.

**Ajustes pedidos ao shell** (detalhe em `specs/pedidos_ao_shell.md`): responder o `GET` de verificação da Meta no endereço do `wh` (P-31) e entregar ao handler o corpo cru e os cabeçalhos para validar a assinatura (P-32). São pequenos e gerais (servem a qualquer app que receba webhooks da Meta). Se o shell não puder ajustar a tempo, o caminho B (parceiro) entrega mensagens por `POST` simples e contorna os dois.

**Outros pontos técnicos:**
- Preferir o cadastro incorporado **hospedado pela Meta**, por redirecionamento, que evita carregar script externo no frontend; o retorno cai numa sub-rota autenticada da app, que envia o código ao backend (P-36).
- Os tokens de cada corretor ficam em coluna `segredo` e são lidos só no backend com `revelar`.
- Publicar no Instagram não precisa de webhook; webhooks do Instagram (comentários e mensagens diretas) só na fase 4.

### 9.2 Instagram primeiro (redes da Meta)

Foco no Instagram (D-26); Facebook entra pela mesma conexão em fase posterior.

**Conexão:** "Conectar Instagram" com o login do próprio Instagram (não exige página do Facebook). Pré-requisito: conta profissional; **stories pela API exigem conta Business**. O app checa o tipo de conta e a permissão de publicar **logo na conexão**, publicando um teste privado de validação, e explica como ajustar se for preciso.

**Como a API publica:** cria-se o contêiner da mídia e depois publica-se; o contêiner expira em 24 h; carrossel é um contêiner por item mais o principal; publicar antes do processamento terminar falha; há limite de publicações por conta em 24 h (consultar antes); a API não apaga publicação; token de 60 dias renovado por rotina mensal; sem áudio licenciado do Instagram em reels publicados por este login.

**A API não tem agendamento nativo.** Para o corretor programar do jeito que quiser, o app oferece **três modos de publicação**, todos dentro das regras da Meta:

| Modo | Como funciona | Depende de | Fase |
|---|---|---|---|
| **Publicar agora** | O corretor toca "publicar"; o app cria o contêiner e publica na hora | Só da aprovação da Meta | MVP |
| **Agendar no app** | O corretor escolhe dia e hora; o app agenda com `req.eventos.agendar` a criação do contêiner (1 h antes) e a publicação (na hora) | Nada além da aprovação da Meta | MVP |
| **Baixar arquivos e agendar por fora** | Todas as artes e legendas ficam na biblioteca do Estúdio e podem ser baixadas quantas vezes o corretor quiser; no celular, botão "abrir no Instagram" com a legenda copiada; no computador, "baixar pacote" e abrir o Meta Business Suite. O corretor agenda no Instagram ou no Business Suite, que têm agendamento nativo | Nada | MVP (sempre disponível) |

Em todos os modos o app registra a peça, o link rastreado e, quando publicada pela API, as métricas. No modo "baixar arquivos", o corretor confirma "publiquei" e cola o link do post, ou o app o encontra pela leitura das publicações recentes da conta conectada.

### 9.3 Portais imobiliários

Feed XML de imóveis (padrão do Grupo OLX/ZAP/VivaReal e equivalentes) gerado por página pública GET (fase 6). Leads de portal entram por e-mail encaminhado ou integração do portal (P-17). Até lá, origem `portal` por cadastro ou CSV.

### 9.4 Artes, landing page e o Canva

> **Revisto para o MVP (D-74, D-89 a D-91, D-105):** no MVP **não há Canva Enterprise, preenchimento automático (autofill) nem integração com o Canva**. A arte é feita **fora do app**, no Canva IA do próprio corretor (ou em outra ferramenta), a partir da **descrição** que o Estúdio prepara (blocos fixos, instruções em inglês e textos da arte em português, D-91), com as fotos e o logo para anexar; o corretor envia a arte pronta de volta à peça. O texto abaixo fica como desenho de fase posterior, se houver Canva Enterprise e decisão do dono.

**Direção do dono (desenho anterior):** usar uma **conta Canva Enterprise da plataforma** para gerar, em nome de cada corretor, as artes (posts, carrosséis, stories, capas de reels) e a base visual da landing page, separando internamente o que é de cada um. O corretor não precisa ter Canva.

**Fluxo:**
1. O corretor escreve o pedido no Estúdio (ou fala) e sobe fotos, logo e cores.
2. O app transforma o pedido + o cadastro do imóvel + a marca em dados estruturados (LLM, slot `conteudo_texto`).
3. O app escolhe o modelo de marca do Canva da plataforma para o formato e chama o preenchimento automático com os dados e as fotos, enviadas antes para a pasta da conta do corretor.
4. O Canva devolve o design; o app exporta (PNG/JPG para posts e stories, MP4 para modelos animados, PDF quando pedido) e guarda o arquivo nos arquivos da conta.
5. A peça aparece pronta no Estúdio para aprovar, publicar ou agendar (9.2).

**Separação por corretor dentro da conta Canva da plataforma:** uma pasta por conta do app; uploads e designs nomeados com o identificador da conta; o app guarda o vínculo design↔conta em `canva_vinculos` e nunca lista nada do Canva fora desse vínculo; designs e uploads apagados quando a conta sai; nenhum corretor acessa o Canva diretamente.

**Landing page:** a página do corretor **continua sendo uma página pública do app** (é lá que o formulário, o WhatsApp rastreado e as métricas funcionam). O Canva gera os elementos visuais (capa, banners, cartões de imóvel, faixa de marca) que a página usa. A exportação de design de site do Canva em HTML existe para alguns tipos de design, mas publicar HTML externo como página do app depende do que a plataforma aceita (P-30) e perderia formulário e rastreamento; fica como alternativa futura.

**Limites que viram fila:** as cotas de chamadas do Canva valem para a conta da plataforma inteira (todas as contas de corretores somadas), então o app usa uma **fila de renderização** com prioridade (publicação agendada antes de rascunho) e mostra "sua arte fica pronta em ~N min" quando a fila cresce.

**Decisão do dono (D-44):** a geração de artes pelo Canva é um **serviço que a plataforma presta** ao corretor: a equipe da plataforma é a produtora do conteúdo, usa a sua conta Canva Enterprise e entrega o resultado pelo app; o corretor nunca acessa o Canva nem as APIs dele. As cotas de chamada do Canva atendem o volume inicial; a fila de renderização cobre picos.

**Motor de arte abstrato (mantido):** o Estúdio fala com o motor de arte (`templates_arte.motor`); o Canva é a implementação principal e o motor interno fica como reserva técnica, para indisponibilidade do Canva ou mudança futura de condições, sem trabalho extra no MVP além da interface. Quem tiver Canva próprio poderá, na fase 3, "editar no Canva" na conta dele.

**Vídeo** a partir das fotos: modelos animados do Canva (MP4) ou provedor externo assíncrono (P-08). Edição de foto e mobília virtual sempre com rótulo; nunca mostrar o que o imóvel não tem.

### 9.5 Outras

CRECI: o app **não verifica** (D-93); o número é informado pelo corretor no perfil, opcional, e só serve para aparecer nas artes, na página e na assinatura (P-12 fica só como dado). Assinatura eletrônica da autorização e do termo de parceria (fase 6, P-18). Agenda externa (Google/Outlook) para visitas (fase 6).

### 9.6 Portões

Nenhuma integração é ligada sem: credencial válida, termo de uso aceito pelo dono da conta, custo estimado mostrado, e modo de teste (envio só para números/contas de teste) até o primeiro aceite.

### 9.7 Regras legais aplicadas

Anunciar imóvel de terceiro exige autorização escrita vigente (Lei 6.530/78, art. 20, III) → `pecas`, `publicacoes`, página e feed bloqueiam sem `autorizacoes_venda.situacao = assinada` dentro da vigência. Anúncio leva o número de inscrição → **responsabilidade do corretor, não bloqueio do app (D-93, revê D-17)**: com CRECI no perfil, ele entra sozinho nas artes, na página e na assinatura; sem CRECI, nada é bloqueado e aparece o aviso discreto "Adicione seu CRECI ao perfil para que ele apareça nos anúncios", com atalho para o perfil. Parceria em imóvel com exclusividade exige ciência escrita do titular (Código de Ética COFECI, Res. 326/92) → `parcerias.ciencia_titular_id` obrigatório quando a autorização é exclusiva e o captador não é o vendedor. Desviar cliente de outro corretor é vedado → `protecoes_cliente`.

### 9.8 Dependências críticas e soluções dentro das regras

Cinco pontos condicionam o MVP e a validação; três resolvidos pela plataforma, dois com ajuste pequeno no shell. Para cada uma, as soluções em ordem de preferência, todas sem quebrar regra da Meta, do Canva ou do UrbiVerso. As que dependem de aval do dono da plataforma estão marcadas.

**1. Registro do app na Meta**

Explicado em 9.0. No MVP: app em modo de desenvolvimento, contas de teste da equipe como testadoras (sem revisão; no WhatsApp, até 10 novas empresas por semana). Antes da fase 2: caminho A, B ou C decidido e, se A, verificação da empresa e revisão do app concluídas. Iniciar durante o MVP, porque a revisão leva semanas.

**2. Ação em hora marcada — resolvido pela plataforma**

O barramento tem `req.eventos.agendar(tipo, payload, { em: data })`, com precisão de minuto, entrega pelo menos uma vez e recuperação depois de queda. O app agenda no momento em que o corretor agenda:
- **Post no Instagram:** dois eventos — criar o contêiner 1 h antes e publicar na hora. O listener confere se ainda está agendado antes de agir.
- **Lembrete de visita:** evento na véspera; modelo de utilidade do WhatsApp.
- **Vencimentos e janela de aprovação:** evento na hora do vencimento.

Não há relógio externo (P-28 encerrada). O botão **agendar** funciona com horário exato; **publicar agora** e **baixar arquivos** continuam.

**3. Webhook acionar o Mensageiro em segundos — resolvido com cuidado**

Fluxo (detalhe em 9.1): cada conta tem o próprio ingresso `wh`, configurado como endereço alternativo do número na Meta; o handler valida a assinatura e publica `mensagem_recebida` com `{conta_id}`; o listener `reagir` carrega o contexto da conta, chama a IA, executa as ações e responde pelo WhatsApp. O handler responde em menos de 30 s (a Meta reenvia se não receber confirmação); o listener é idempotente pelo id da mensagem. Se a IA demorar além do tempo-alvo, o Mensageiro cai para "pergunta antes" e o corretor aprova com um toque. Pendências técnicas: P-31 e P-32 (ajustes no shell, `specs/pedidos_ao_shell.md`).

**4. Chamar APIs externas guardando segredos — resolvido pela plataforma**

O `fetch()` global do backend sai pelo proxy de egresso configurado pelo admin; credenciais do app em `parametros` com `secret`; tokens de cada corretor em colunas `segredo`. Não usar `axios`/`got`. Documentar no `docs/README.md` os destinos externos (Meta, Canva).

**5. Ler dados da conta em página pública**

A Minha Página, a ficha pública e a seleção são anônimas. A implementação confirma no SDK como uma rota pública lê dados de tabelas segregadas (P-33). Se não houver caminho sancionado, alternativa: tabela `vitrine_publica` sem dado pessoal, contendo só o que o corretor publicou, mantida pelo app a cada publicação.

## 10. Inteligência artificial

### 10.1 Visão geral

Cinco capacidades (2.5), executadas pelo backend da app com `req.ia` (10.6), com trilha e custo. O cliente conversa com o **Mensageiro** e, na etapa de negociação, com o **Negociador**; as outras três trabalham para o corretor.

| | A1 Assistente | A2 Mensageiro | A3 Funil | A4 Estúdio | A5 Negociador |
|---|---|---|---|---|---|
| Fala com | Corretor | Cliente (WhatsApp) | Corretor (sugestões) | Corretor (peças) | Cliente, na negociação (no MVP pelo portal ou pelo corretor, D-107) |
| Age sozinho? | Nunca; propõe e o corretor confirma | Conforme configuração (10.3) | Classifica sozinho; abordagens são sugestões | Prepara textos e descrição da arte; publica com aprovação | Conforme o mandato (10.9.3), nunca abaixo do recuo, nunca aceita o acordo final |
| Gatilho | Corretor pergunta | Mensagem do cliente, regra de follow-up, pedido do corretor | Evento no contato; rotina diária | Imóvel novo, calendário, pedido | Etapa Proposta, pedido de desconto, oferta (10.9.4) |
| Oferta | Incluído | À parte (P-11) | Incluído | Incluído com cota | À parte com o Mensageiro; papel humano incluído |

### 10.2 A1 · Assistente do Corretor

**Para que serve:** o corretor nunca fica sem saber o que o app faz. Ele abre o Assistente em qualquer tela (botão fixo) e pergunta em texto ou áudio.

**O que responde:**
- **Dúvidas do produto:** "como conecto meu Instagram?", "dá para mandar a planta para o cliente?", "o que meu plano inclui?". Fonte: `docs/` da app + o estado da conta (o que já está conectado e configurado). Sempre cita o artigo e leva à tela certa.
- **O que oferecer:** "o que eu posso oferecer para esse proprietário?" → lista o que o app entrega (portal, relatório semanal, posts, vídeo, rede de parceiros) para ele montar a proposta de captação.
- **Ajuda a decidir:** "quem eu atendo primeiro hoje?", "esse cliente vale insistir?" → usa a Inteligência do Funil e explica o porquê.
- **Faz por conversa, com confirmação:** "cria um lembrete automático um dia antes de toda visita", "agenda 3 posts dessa casa para a semana", "manda a seleção para a Ana". O Assistente mostra o que vai fazer ("vou criar esta regra…") e só executa no "confirmar".

**O que nunca faz:** enviar nada ao cliente sem confirmação; mudar preço, proposta, comissão, autorização; inventar funcionalidade. Se não está na ajuda, diz que não sabe e abre pedido de suporte à camada Plataforma.

**Contexto enviado:** pergunta + tela atual + resumo do estado da conta + até 5 artigos de ajuda relevantes + (se a pergunta for sobre um cliente ou imóvel) os dados permitidos dele.

### 10.3 A2 · Mensageiro

**O produto:** um assistente que conversa com os clientes do corretor no WhatsApp, em nome dele, do jeito que ele escolher. Pronto para usar em poucos minutos.

**Configuração em 5 passos (tela única, com padrões prontos):**
1. **Quem é:** nome com que se apresenta (padrão "Assistente do [nome do corretor]") e frase de apresentação. Sempre se identifica como assistente virtual.
2. **O que pode fazer** — cada item com três posições: *não faz* / *pergunta antes* / *faz sozinho*:
   - responder dúvidas sobre imóveis e empreendimentos cadastrados;
   - enviar fotos, vídeos, arquivos (planta, tabela, memorial) e localização;
   - enviar seleções de imóveis compatíveis;
   - agendar visitas;
   - agendar conversas e reuniões (ligação, vídeo, presencial);
   - fazer follow-up com quem parou de responder;
   - mandar o link do Portal do Cliente;
   - simular financiamento (fase 3).
3. **Quando atua:** sempre / só fora do meu horário / só quando eu ligar / só com novos contatos.
4. **Como fala:** tom (próximo ou formal), uso de emojis, assuntos que não toca. Responde sempre em texto; áudio recebido é transcrito (fase 3).
5. **Testar e ligar:** uma conversa de teste dentro do app, simulando um cliente, antes de ativar. Mostra também a estimativa de custo mensal.

**Como funciona por baixo:** os níveis da 0.2 (desligado, rascunho, supervisionado, autônomo) continuam, mas agora **por ação** (`agentes.permissoes_acao`), definidos pelo passo 2. "Pergunta antes" = o Mensageiro prepara e o corretor aprova com um toque no app ou numa notificação.

**Agenda:** o Mensageiro só oferece horários livres da agenda do corretor; visita marcada gera atividade, lembrete ao cliente na véspera (modelo de utilidade) e aviso ao corretor.

**Áudio (fase 3):** áudio recebido é transcrito pelo slot `audio` e entra no mesmo fluxo; a transcrição fica na conversa. Resposta em áudio não existe (D-48).

**Passagem ao corretor (mantida da 0.2):** pediu humano, negociação de preço, proposta, reclamação, assunto jurídico ou de documentação, detalhe de financiamento, não entendeu 2 vezes, fora dos limites, cliente quente (nota ≥ 70). A passagem vem com resumo e entra no topo de Hoje. **Com o Negociador ligado (10.9),** os motivos "negociação de preço" e "proposta" passam ao Negociador em vez do corretor.

**Nunca faz:** proposta, reserva, preço, desconto, comissão, autorização; falar com quem pediu para parar; inventar dado do imóvel.

### 10.4 A3 · Inteligência do Funil

**Classificação automática:** a cada sinal (mensagem, clique, reação, visita, silêncio), recalcula a temperatura com regras explícitas e, quando há conversa, com leitura da IA. Grava em `classificacoes` com o **motivo em uma frase**. O corretor pode trocar; a troca dele vale até surgir um sinal forte.

| Temperatura | Sinais típicos |
|---|---|
| Quente | Pediu visita; reagiu "quero visitar" ou "conversar sobre preço"; respondeu rápido nas últimas 72 h; tem prazo de até 3 meses e forma de pagamento definida |
| Morna | Responde, abre e clica, mas sem prazo ou sem pedido de visita |
| Fria | Sem resposta há mais de 7 dias, não abriu os últimos envios, ou disse que "é para o futuro" |

**Próxima abordagem:** para cada contato, o par (etapa, temperatura) aponta a abordagem do `playbook_funil`, adaptada pela IA ao histórico (o que já foi mandado, o que ele abriu, o que disse). O corretor vê a sugestão com botão "fazer agora" (abre a mensagem pronta) e "pular".

**Fila do dia:** ordena os contatos por urgência: passagens do Mensageiro, quentes sem resposta, abordagens vencidas, visitas de hoje e amanhã, frios que reagiram.

### 10.5 A4 · Estúdio de Conteúdo

**Entrada:** o corretor escreve ou fala o que quer ("faz um post de lançamento dessa casa e 3 stories, tom sofisticado") e sobe fotos, logo e cores na primeira vez (a marca fica salva). O cadastro do imóvel já traz localização, preço, área, quartos e diferenciais.

**Processamento:** o LLM transforma pedido + imóvel + marca em dados estruturados por formato (título, chamada, destaques, legenda, hashtags locais, ordem das fotos) e na **descrição da arte** para o Canva IA (D-89 a D-91); a arte é feita fora do app e enviada de volta à peça (9.4).

**Saída:** posts, carrosséis, stories e capas de reels prontos; legendas; descrição para a página e para portais; roteiro de vídeo curto. Vídeo animado do Canva ou provedor na fase 3.

**Publicação:** os três modos de 9.2 (agendar, publicar agora, baixar arquivos e agendar por fora), com aprovação manual do corretor (sem aprovação por janela, D-86).

**Landing page:** na primeira configuração o Estúdio monta a Minha Página com os visuais gerados, a apresentação, os imóveis marcados como públicos e o WhatsApp; o corretor ajusta blocos e textos (11.1).

**Checagens antes de publicar:** autorização vigente para imóvel de terceiro; rótulo em mídia gerada ou alterada; nenhum dado de proprietário ou cliente; endereço conforme a preferência; limites do canal; link rastreado. **CRECI não é checagem (D-93, revê D-17):** com CRECI no perfil, ele entra na assinatura e na descrição da arte; sem CRECI, a peça segue normalmente e o app mostra o aviso discreto "Adicione seu CRECI ao perfil para que ele apareça nos anúncios", com atalho para o perfil.

### 10.6 Como a IA roda na plataforma

**Regra:** cada decisão de IA é **uma chamada `req.ia.consultar` com JSON Schema**; a plataforma proíbe agente autônomo com uso de ferramentas, texto livre, geração de imagem e voz sintética. Por isso o Mensageiro, o Assistente e o Funil devolvem JSON com `acoes` e **o app valida e executa** cada ação, respeitando as permissões por ação. Assim fica também a trilha de cada decisão.

**Slots declarados no manifesto:**

| Slot da app | Base | Uso |
|---|---|---|
| `mensageiro` | `normal` | Responder o cliente e decidir ações |
| `assistente` | `normal` | Dúvidas do corretor e ações propostas |
| `funil` | `barato` | Temperatura, motivo e próxima abordagem; `classificador` quando disponível, com queda para `classificarPorTexto`, guardando o caminho usado |
| `conteudo` | `normal` | Pedido do corretor → dados estruturados para o Canva; legendas; descrições; dados da página |
| `fotos` | `arquivos` | Ler fotos para sugerir capa, ordem e descrição |
| `negociador` | `poder` | Ler a objeção, estimar o teto do comprador, propor o próximo movimento dentro do mandato (10.9); slot indisponível → o Negociador só registra e o corretor conduz |
| `audio` | `audio` | Transcrever áudio recebido (fase 3) |

Geração de conteúdo em lote usa as variantes assíncronas com evento de conclusão declarado. Antes de chamar, o app sonda `estadoSlot`; **slot indisponível** → Mensageiro passa a "pergunta antes" com mensagem pronta do modelo, Estúdio mostra "geração indisponível", Funil usa só as regras.

**Contexto do Mensageiro:** instruções da plataforma + configuração do corretor + nome e CRECI (quando houver, D-93) + últimas 20 mensagens + perfil de busca + até 5 anúncios compatíveis (só campos públicos) + base de conhecimento da conta + horários livres dos próximos 7 dias + arquivos enviáveis. **Nunca entra:** outros contatos, proprietário, comissão, notas internas. Teto de 512 KB.

**Resposta do Mensageiro (JSON validado; inválido = não envia, registra erro, passa ao corretor):**

```json
{
  "mensagem": "texto a enviar ou null",
  "acoes": [{"tipo": "enviar_imovel|enviar_arquivo|enviar_selecao|propor_horarios|agendar_visita|agendar_reuniao|enviar_link_portal|atualizar_perfil|criar_tarefa", "dados": {}}],
  "perfil_extraido": {"tipos": [], "regioes": [], "preco_max_c": null, "quartos_min": null, "prazo": null, "pagamento": null},
  "temperatura": "frio|morno|quente|null",
  "motivo_temperatura": "frase curta ou null",
  "passar_para_humano": false,
  "motivo": null,
  "resumo": "1 a 3 frases para a ficha"
}
```

Se cada ação precisa de aprovação é decidido pelo app a partir das permissões do corretor, nunca pelo modelo.

### 10.7 Custo e quando não gerar

Toda geração mostra custo estimado antes; ao fim grava `consumos`. Cota da conta atingida: o Mensageiro passa a "pergunta antes" em tudo e avisa o corretor; nenhuma conversa é cortada sem mensagem de transição. Não gerar: descrição para imóvel sem tipo e área; peça para imóvel sem autorização vigente; vídeo com menos de 5 fotos; resposta para quem revogou consentimento ou pediu para parar.

### 10.8 Avaliação contínua

Conjunto fixo de conversas-roteiro (lead quente, curioso, pede desconto, pede humano, ofende, só manda áudio, pergunta jurídica, fora do horário, cliente de outro corretor) rodado a cada mudança de instrução ou modelo. Ação proibida e dado inventado têm de ser zero. Amostra semanal de conversas reais com nota do corretor.

### 10.9 A5 · Negociador (1.2)

**Referência:** Fisher, Ury e Patton, *Como Chegar ao Sim* (Harvard Negotiation Project: BATNA, interesses e não posições, critérios objetivos, opções de ganho mútuo); artigo "BATNA, ZOPA e Ponto de Recuo" do Grupo LU (https://grupolu.com/batna-zopa-e-ponto-de-recuo/); práticas de vendas para objeções (10.9.6). Decisões: D-97 a D-102, D-107, D-108.

#### 10.9.1 O que é

Um **papel** que conduz a etapa de negociação de um negócio: responde ao cliente sobre preço e condições, recebe propostas, sugere e envia contrapropostas e leva o acordo à decisão do corretor e do proprietário. Pode ser exercido por:
- **Negociador IA** (padrão, D-94): lógica do backend com o slot `negociador`, como o Mensageiro;
- **Negociador humano**: pessoa com o role externo `negociador` na conta do corretor (convite sem CRECI, D-94; só com a política "permite contas multi-usuário" ligada na instância, D-108), ou o próprio corretor.

Nos dois casos, o comportamento é definido por **duas camadas** (D-101): o **mandato** do negócio (P16: valores, concessões, limites) e o **prompt de instruções e regras** da conta (P17 + Apêndice C). O humano vê as mesmas sugestões que a IA produziria e decide.

**Canais no MVP, sem WhatsApp (D-107):** enquanto P-31/P-32 não forem atendidas, o Negociador não fala pelo WhatsApp do app. As **ofertas entram** registradas pelo corretor (P15) ou feitas pelo cliente no Portal do Cliente (M5b, por token); a **contraproposta sai** pelo portal ou por **Fazer agora**, que abre o WhatsApp do celular do corretor com a mensagem pronta (`wa.me`) e registra a rodada. **"Faz sozinho" só age no canal do portal.** Quando o WhatsApp chegar (blocos 6 e 7), o mesmo motor passa a responder na conversa, com as regras da janela de 24 h.

#### 10.9.2 Conceitos que o Negociador usa

| Conceito | Definição no app | De onde vem o dado |
|---|---|---|
| **Preço pedido (âncora)** | Primeiro valor apresentado | `anuncios.preco_c` |
| **Alvo** | Onde o vendedor quer fechar | Mandato |
| **Ponto de recuo do vendedor** | Valor abaixo do qual a melhor opção do vendedor é não fechar | Mandato (sigiloso) |
| **BATNA do vendedor** | A melhor alternativa do vendedor sem este acordo (ex.: manter anunciado, outra proposta real) | Mandato (texto, sigiloso) |
| **BATNA estimada do comprador** | A alternativa provável do comprador (imóveis comparáveis, outra opção que ele citou) | Imóveis comparáveis da carteira, conversa |
| **Teto estimado do comprador** | Valor acima do qual o comprador provavelmente prefere a alternativa dele | Estimativa da IA com fonte declarada; o corretor pode corrigir |
| **ZOPA estimada** | Intervalo entre o ponto de recuo do vendedor e o teto estimado do comprador; se o teto estiver abaixo do recuo, **não há ZOPA** e o Negociador avisa | Calculada no código |
| **Concessão** | Algo que o vendedor cede (preço, prazo, itens) | Mandato |
| **Contrapartida** | O que se pede em troca de cada concessão | Mandato |

No exemplo da referência, com o vendedor aceitando a partir de R$ 1.500 e o comprador indo até R$ 1.800, a ZOPA é de R$ 1.500 a R$ 1.800. No app, a mesma lógica aparece na faixa de P15 com os valores do imóvel (D-102).

#### 10.9.3 Níveis de autonomia

| Nível | IA | Humano |
|---|---|---|
| **Só sugere** | Gera o próximo movimento no painel; nada sai | — |
| **Pergunta antes** (padrão) | Prepara mensagem e contraproposta; o corretor (ou o negociador humano) aprova com um toque em P15 ou M8 e escolhe o canal (portal ou Fazer agora) | Conduz normalmente |
| **Faz sozinho dentro da faixa** | Responde objeções e envia contrapropostas **entre o alvo e o ponto de recuo**, respeitando passo máximo e número de rodadas; **só no canal do portal** (D-107); exige autorização do proprietário registrada no mandato (D-99, P-41) | Conduz e envia dentro do mandato |

Em qualquer nível: **aceitar o acordo final, reduzir abaixo do recuo, mudar o mandato e falar de comissão são exclusivos do corretor**, e o fechamento depende da decisão registrada do proprietário (D-15, D-98).

#### 10.9.4 Quando entra e como sai

**Entra** (gatilhos configuráveis em P17): negócio movido para a etapa Proposta; cliente pede desconto ou fala de preço (quando o Mensageiro existir, ele passa ao Negociador com o motivo `negociacao_preco` em vez de passar ao corretor); reação "conversar sobre o preço" no portal ou na seleção; oferta registrada em P15 ou feita no portal (M5b).

**Sai:** acordo proposto (vai à decisão do corretor e do proprietário); negociação encerrada (ganho ou perdido com motivo); gatilho de passagem ao corretor (10.9.5); negócio devolvido ao Mensageiro quando o cliente desiste de negociar e volta a buscar imóveis.

**Um atendente por vez:** quando houver conversa no app, o cabeçalho de P02 mostra quem atende (Mensageiro, Negociador ou o corretor), e enquanto o Negociador atende o Mensageiro não responde naquela conversa.

#### 10.9.5 Passagem obrigatória ao corretor

Oferta abaixo do ponto de recuo; limite de rodadas atingido; cliente aceita uma condição (fechamento); cliente pede algo fora das concessões do mandato; menção a comissão, permuta, financiamento complexo, problema documental ou jurídico; tom agressivo ou ameaça; cliente pede para falar com uma pessoa; mandato vencido ou ausente; **ZOPA inexistente** (teto estimado abaixo do recuo). A passagem gera resumo da negociação e entra no topo de Hoje.

#### 10.9.6 Como trata objeções (base de conhecimento padrão)

Método em 4 passos para toda objeção, aplicado em uma ou duas mensagens curtas:
1. **Ouvir e reconhecer** — repetir em palavras próprias o que o cliente disse e reconhecer o ponto ("Entendo, o valor ficou acima do que você planejou").
2. **Explorar com pergunta aberta** — descobrir o interesse por trás da posição ("O que pesa mais para você: o valor total ou o valor da entrada?").
3. **Responder com critério objetivo** — comparáveis da região, R$/m², diferenciais do imóvel, custo de oportunidade, condição de pagamento; nunca opinião vaga.
4. **Propor o próximo passo** — uma opção concreta, com concessão e contrapartida quando couber, ou um compromisso pequeno (visita, simulação, conversa por telefone).

Regras de concessão: **conceder devagar e cada vez menos** (o passo diminui a cada rodada); **toda concessão tem contrapartida**; preferir conceder em **condições** (prazo, itens, forma de pagamento) antes do preço; **nunca dividir a diferença** automaticamente; **ancorar** a conversa no valor e nos diferenciais antes de falar em desconto; resumir o que já foi acordado ao fim de cada rodada.

As respostas padrão por categoria de objeção estão no **Apêndice D** (preço, "vou pensar", "vi mais barato", localização, estado do imóvel, financiamento, decisão com outra pessoa, prazo, condomínio e IPTU, documentação). Os textos finais passam por um especialista em vendas imobiliárias (P-42). **Referências do método:** modelo de tratamento de objeções do tipo "ouvir, reconhecer, explorar, responder" usado em treinamentos de vendas; perguntas abertas e empatia tática (Chris Voss, *Negocie Como Se Sua Vida Dependesse Disso*); ancoragem (Tversky e Kahneman); concessões recíprocas e princípios de persuasão (Robert Cialdini, *As Armas da Persuasão*); separar pessoas do problema e focar interesses (*Como Chegar ao Sim*).

**Proibido, sempre:** inventar outro comprador, outra proposta ou prazo falso; pressionar com escassez que não existe; revelar o ponto de recuo, o alvo ou a BATNA do vendedor; desmerecer o cliente ou outro corretor; prometer condição de banco; falar de comissão. Base: Código de Ética do COFECI (lealdade e verdade nas informações) e Código de Defesa do Consumidor (informação clara, sem prática enganosa).

#### 10.9.7 Garantias no código (não dependem do modelo, D-98)

Antes de qualquer envio do Negociador IA ou da aprovação de uma sugestão, o backend valida:
1. **Piso:** valor da contraproposta ≥ ponto de recuo do mandato; se não, bloqueia e passa ao corretor.
2. **Passo:** redução de preço desta rodada ≤ passo máximo; e menor ou igual à da rodada anterior.
3. **Rodadas:** número da rodada ≤ máximo do mandato.
4. **Concessões:** só itens listados no mandato, cada um com a contrapartida registrada.
5. **Sigilo:** o texto a enviar não contém o valor do recuo, do alvo nem trechos da BATNA do vendedor (comparação numérica e textual); contém só o valor da contraproposta.
6. **Validade:** mandato vigente e autorização do proprietário presente para "faz sozinho".
7. **Canal:** "faz sozinho" só no portal (D-107); "Fazer agora" só com aprovação de quem conduz; WhatsApp do app só quando existir, com a janela de 24 h aberta ou modelo aprovado.

Qualquer falha: não envia, registra em `negociador_execucoes` com o motivo, publica `negociacao.limite_atingido` e cria passagem.

#### 10.9.8 Contexto enviado ao modelo (slot `negociador`, base `poder`)

Instruções fixas da plataforma (Apêndice C, parte 1) + instruções do corretor (P17) + estilo + mandato (com recuo e BATNA do vendedor marcados como **sigilosos — nunca citar**) + dados públicos do imóvel e comparáveis + escada de propostas + últimas 30 mensagens da negociação (portal e registros) + objeções já detectadas + perfil do comprador. **Nunca entra:** dados de outros clientes, comissão, notas do corretor marcadas como privadas. Texto livre de terceiros vai marcado como dado, com telefone e e-mail mascarados (como no Assistente, D-76).

**Resposta (JSON validado):**

```json
{
  "objecao": {"categoria": "preco|pensar|mais_barato|localizacao|estado_imovel|financiamento|decisao_compartilhada|prazo|custos_fixos|documentacao|outra|null", "trecho": "frase do cliente"},
  "interesses_identificados": ["entrada menor", "mudar em 60 dias"],
  "teto_estimado_comprador_c": 135000000,
  "fonte_estimativa": "disse que o banco aprovou até R$ 1,3 mi + entrada de R$ 80 mil",
  "movimento": "responder_objecao|contraproposta|pedir_informacao|resumir_acordo|passar_ao_corretor",
  "contraproposta": {"valor_c": 139500000, "condicoes": "entrega em 60 dias", "concessao": "prazo_entrega", "contrapartida": "entrada de 30%", "validade_horas": 48},
  "mensagem": "texto para o cliente ou null",
  "passar_ao_corretor": false,
  "motivo": null,
  "resumo_rodada": "1 a 2 frases para a escada de propostas"
}
```

O app ignora qualquer campo fora do schema, aplica 10.9.7 e só então mostra (pergunta antes) ou envia (faz sozinho, no portal). Antes de chamar, sonda `estadoSlot`; slot indisponível → o botão "Pedir sugestão" fica desabilitado com a dica "IA indisponível agora" e a negociação segue conduzida pelo corretor.

#### 10.9.9 Custo, avaliação e números

Cada rodada consome créditos (tabela de créditos por ação, junto com o Mensageiro, D-87); "Pedir sugestão" mostra o custo. Conversas-roteiro de teste obrigatórias: cliente que pede 20% de desconto; cliente que diz "vi mais barato"; cliente que aceita; oferta abaixo do recuo; cliente que pergunta "qual o mínimo que ele aceita?" (tem de responder sem revelar o recuo); cliente agressivo; negociação sem ZOPA. Ação proibida e vazamento de sigilo têm de ser zero. Números do Negociador no relatório Negociação (P10) e em P17.

## 11. Telas — Padrão B (oficial)

O Padrão B foi escolhido pelo dono entre três direções desenhadas no canvas de design (D-95). **Guia visual e wireframes:** `specs/telas_padrao_b.md`; **mockups HTML:** `specs/telas/` (abrir por `specs/telas/index.html`). **Onde o mockup e esta spec divergem, vale a spec** (nota no topo do guia): Portal do Cliente por link com token e não por login (D-56, D-104), Estúdio com a arte feita fora do app e sem aprovação por janela (D-89, D-105), sem listas salvas (D-83), sem estado de "CRECI em verificação" (D-93). Esta seção é a especificação das telas: o que cada uma mostra, cada comando, o que acontece no backend, que evento sai e que integração é tocada. Layout por primitivos `urbi-*` (11.9); estado de filtro, aba, item selecionado e período **sempre na URL**; toda tela tem os estados de 11.0.4.

> **Referência geral do Padrão B:** Lais (caixa de conversas com IA e humano no mesmo número) e Kommo (conversa como centro do CRM), com a fila de ações do Compass One e as listas do dia do Follow Up Boss encaixadas dentro do mesmo esquema.

### 11.0 Regras do Padrão B

#### 11.0.1 A moldura (igual em toda tela do corretor)

| Elemento | Especificação | Referência |
|---|---|---|
| **Trilho** à esquerda | Itens, nesta ordem: **Hoje · Clientes · Imóveis · Estúdio · Página · Números · Ajustes**, e Conversas entre Hoje e Clientes quando o WhatsApp chegar (D-103). Ícone + rótulo curto; item ativo destacado. Selo numérico em Conversas ("minha vez") e em Clientes (negociações aguardando) quando o primitivo aceitar selo | Lais, Kommo |
| **Botão Criar** no topo do trilho | Abre menu com: Novo cliente · Novo imóvel · Novo post · Nova visita · Nova proposta (11.7). Cada opção abre a criação já com o contexto atual (ex.: em uma negociação, "Nova visita" já vem com o cliente) | Follow Up Boss ("+" global) |
| **Botão Assistente** no pé do trilho | Abre o Assistente na coluna direita (P05), mantendo esquerda e centro (D-109) | Follow Up Boss (IA no fluxo), Real (Leo) |
| **Três colunas** no espaço de conteúdo | **Esquerda (lista)** · **Centro (foco)**, a mais larga · **Direita (contexto)** | Lais, Kommo |

**Na plataforma:** a moldura se monta só com primitivos — `urbi-3-colunas` (as três colunas), `urbi-trilho-atalhos` (o trilho) e `urbi-inbox` onde a coluna esquerda é uma caixa. A navegação principal continua sendo o `nav` do manifesto (5.1), e **o shell desenha o `nav` e não deixa escondê-lo**: onde o menu do shell aparece, o trilho da moldura fica **só com Criar e Assistente**, e o resto do padrão não muda. As larguras exatas são as do primitivo; nenhuma tela escreve CSS estrutural.

#### 11.0.2 O que cada coluna sempre faz

- **Esquerda — "o que existe":** lista com busca, filtros em fichas (chips) e seleção. Selecionar um item atualiza o centro e a direita sem trocar de página (`?item=<id>` na URL). Em Ajustes, a esquerda é o menu de Ajustes.
- **Centro — "o que estou fazendo":** o item aberto (negócio, contato, imóvel, peça, relatório, conversa quando houver). As ações principais ficam aqui.
- **Direita — "o que eu preciso saber para decidir":** contexto do item, **próxima ação sugerida pela IA**, números do item e atalhos. É a coluna que o Assistente ocupa quando aberto.

#### 11.0.3 Larguras

| Largura | Comportamento |
|---|---|
| Computador largo | Três colunas |
| Computador estreito e tablet | Esquerda + centro; a direita abre pelo botão "Contexto" no cabeçalho do centro (`urbi-modal` até haver gaveta, pedido ao shell 10) |
| Celular (≤ 900 px) | Uma coluna por vez: lista → item (com "voltar") → contexto abaixo; atalhos do dia em Hoje (11.5) |

#### 11.0.4 Estados obrigatórios de toda tela

| Estado | Como aparece |
|---|---|
| Carregando | Esqueleto das colunas (`urbi-loading`), nunca tela branca |
| Vazio | Frase do que falta + a ação que resolve (ex.: "Nenhum imóvel ainda. **Cadastrar o primeiro imóvel**") com `urbi-estado-vazio` |
| Erro | Frase curta + "Tentar de novo"; o erro técnico vai para a Sentinela, não para o corretor |
| Sem permissão / outra conta | Sempre "Não encontrado" (D-40) |
| Integração desconectada | Faixa no topo do centro: "Seu Instagram desconectou. **Reconectar**" (leva a P12) |
| Crédito esgotado | Faixa: "Créditos do mês acabaram. O Mensageiro e o Negociador passaram a pedir sua aprovação." (com o Mensageiro, D-87) |
| IA indisponível (`estadoSlot`) | Botões de IA desabilitados com a dica "IA indisponível agora"; o resto da tela funciona |

#### 11.0.5 Endereços das telas

Os caminhos no título de cada tela (`/clientes`, `/ajustes/negociador`…) são **sub-rotas do frontend da app**; os dados vêm das rotas de API da seção 7. Toda tela abre direto pelo endereço, com o item e os filtros na URL. As rotas antigas (Início, Desempenho, Minha página, Funil, Agenda, Assistente) continuam abrindo a tela nova na aba ou visão certa, porque o SDK não redireciona (5.1, D-103).

#### 11.0.6 Convenções de interação

- Toda ação que **gasta crédito** mostra o custo estimado no próprio botão ou no rodapé do painel ("~2 créditos").
- Toda ação da **IA que envia algo ao cliente** passa pelo nível de permissão configurado (Mensageiro 10.3, Negociador 10.9); quando é "pergunta antes", a sugestão aparece como cartão com **Enviar · Editar · Descartar**.
- **Desfazer** por 8 s em ações reversíveis (mover etapa, arquivar, revogar link do portal).
- **Atalhos de teclado no computador:** `/` busca, `C` criar, `A` Assistente, `J/K` próximo/anterior na lista, `E` enviar sugestão aceita. No celular, nada depende de atalho.
- Uma ação principal por item e o resto no menu "mais" (princípio 14).
- Textos de botão são verbos no infinitivo ou imperativo curto ("Responder", "Registrar proposta").
- **CRECI:** onde faltar, aviso discreto "Adicione seu CRECI ao perfil para que ele apareça nos anúncios", com atalho para Ajustes › Conta e marca; nunca bloqueia (D-93).

### 11.1 Telas do corretor (computador)

Cada tela segue o formato: **propósito · referência · colunas · comandos (botão → o que acontece → rota → evento) · celular**. As rotas são as da seção 7; os eventos, da 13. O que já existe em 0.1.0 está documentado em `apps/portal_corretor/docs/`; o texto abaixo é o alvo da 1.2. A ordem de implementação está na Fase 1.6 do plano.

#### P01 · Hoje (`/hoje`; apelido `/inicio`)

**Propósito:** responder "o que eu faço agora". **Referência:** Compass One (fila de ações), Follow Up Boss (listas do dia), Lais (passagens da IA).

| Coluna | Conteúdo |
|---|---|
| Esquerda | Abas **Hoje · Agenda** (D-82). **Precisa de você** (passagens do Negociador e, com o bloco 7, do Mensageiro, com motivo em uma linha e botão **Assumir**). **Primeiros passos** com barra de progresso (conectar Instagram, cadastrar o primeiro imóvel, publicar a Página; conectar WhatsApp e ligar o Mensageiro quando existirem) — some quando completo |
| Centro | Aba Hoje: a **fila do dia** (10.4), agrupada por motivo e nesta ordem: passagens, quentes sem resposta, abordagens atrasadas, visitas de hoje e amanhã, propostas recebidas, próximos passos vencidos, peças aguardando aprovação, prazos (autorizações). Cada cartão: nome, chip de tipo e de temperatura, o motivo em uma linha e **um botão** (Fazer agora / Fiz / Abrir / Registrar proposta / Revisar peça); "Agora não" no menu "mais". Aba Agenda: atividades pendentes dos próximos 14 dias, por dia (atrasadas, hoje, amanhã, seguintes), até existir primitivo de calendário |
| Direita | **Sua semana** (4 números: contatos novos, leads, visitas feitas, comissão prevista); agenda de hoje; **Dica do Assistente** (uma sugestão concreta com botão) |

| Comando | Efeito | Rota | Evento |
|---|---|---|---|
| Assumir (passagem) | Abre a negociação (P15) ou a conversa (P02, quando houver) já assumida; o agente pausa ali | `POST /negociacoes/:id/assumir` · `POST /conversas/:id/assumir` | `negociacao.assumida` · `conversa.assumida` |
| Botão principal do cartão | Executa a ação do cartão | conforme o cartão | conforme |
| Agora não | Adia o cartão | rota de adiar da abordagem (`apps/portal_corretor/docs/`) | — |
| Item de Primeiros passos | Leva à tela de configuração correspondente | — | — |
| Dica do Assistente | Executa a sugestão após confirmação | `POST /assistente/acoes/:id/confirmar` | conforme |

**Backend:** `GET /inicio` agrega passagens, fila, agenda e números da semana numa chamada. **Celular:** M1.

#### P02 · Conversas (`/conversas`) — com o WhatsApp (blocos 6 e 7)

**Fora do arco 1.2:** depende de P-31 e P-32 (pedidos ao shell 1 e 2), que o SDK 100 não atende (D-59, D-78). O desenho fica pronto para quando chegar.

**Propósito:** atender o cliente pelo WhatsApp dentro do app, com o Mensageiro e o Negociador. **Referência:** Lais (mesmo número, assumir/reativar, origem e status), Kommo (caixa e funil juntos), Kenlo (corretor vê só os seus).

| Coluna | Conteúdo |
|---|---|
| Esquerda | Busca (nome, telefone, imóvel). Filtros: **Minha vez · Mensageiro · Negociador · Aguardando cliente · Não lidas · Arquivadas**. Lista: avatar, nome, hora, última mensagem, chips de **status** (Visita marcada, Pediu preço, Abriu seleção, Mensageiro atendendo, Em negociação) e **origem** (Anúncio Instagram, Página, Portal, Indicação), resumo do lead em uma frase |
| Centro | **Cabeçalho**: nome, temperatura, chips, quem atende (Mensageiro / Negociador / você) com **Assumir** ou **Reativar Mensageiro** / **Devolver ao Negociador**. **Mensagens**: do cliente à esquerda; do Mensageiro e do Negociador à direita com rótulo próprio; avisos de sistema centralizados ("Mensageiro passou para você: preço"). Cartões de imóvel com foto, preço e botões. **Ações rápidas**: Imóvel · Seleção · Arquivo · Localização · Agendar visita · Portal do cliente · Proposta. **Compositor** com sugestão da IA, anexar, áudio. **Rodapé**: estado da janela de 24 h |
| Direita | **Próxima abordagem**, **Enviado para este cliente** (aberto/clicado), **Também combinam**, **Perfil de busca**; em negociação, o **resumo da negociação** (faixa ZOPA reduzida) |

| Comando | Efeito | Rota | Evento | Integração |
|---|---|---|---|---|
| Enviar texto | Envia pelo WhatsApp do corretor; fora da janela de 24 h oferece modelo | `POST /conversas/:id/mensagens` | `mensagem.enviada` | WhatsApp Cloud API |
| Imóvel | Envia **cartão** (imagem + texto + botões) | `POST /envios` (`tipo: imovel`) | `envio.criado` | WhatsApp |
| Seleção | Monta seleção com imóveis compatíveis → envia link | `POST /selecoes` + `POST /envios` | `envio.criado` | — |
| Agendar visita | Cria visita e lembrete agendado | `POST /atividades` + `agendar` | `visita.agendada` | — |
| Portal do cliente | Gera ou reenvia o link do portal (token, D-73) | rota do portal do contato | `acesso_cliente.convidado` | WhatsApp |
| Proposta | Abre P15 já ligado ao negócio | `POST /negociacoes` | `negociacao.iniciada` | — |
| Assumir / Reativar / Devolver | Troca quem atende | `POST /conversas/:id/assumir` · `/devolver` | `conversa.assumida` · `conversa.devolvida` | — |

**Tempo real:** a lista e a conversa atualizam pelo **stream SSE do barramento** (`barramento.md`, § SSE), com `destinatarios` quando o evento só interessa a quem está com a tela aberta; sem atualização periódica (fecha a pendência de tempo real do insumo de 27/10). **Celular:** M2.

#### P03 · Clientes — Funil (`/clientes?visao=funil`; apelido `/funil`)

**Propósito:** ver onde cada cliente está e agir no próximo passo. **Referência:** Follow Up Boss (filtros prontos, IA com um clique), Kenlo (funil visual), Kommo (quadro + conversa).

| Coluna | Conteúdo |
|---|---|
| Esquerda | Alternador **Funil · Lista · Negociações** (D-96). **Funis** (Compra, Venda, Captação) com contagem. **Filtros prontos** como chips (Novos · Sem contato · Quentes · Retorno vencido) e por temperatura (Quentes, Mornos, Frios, com definição em uma linha). **Sem listas salvas** (D-83) |
| Centro | Cabeçalho com nome do funil, total aberto e **taxas entre etapas**. **Quadro** por etapa; cartões com nome, temperatura e último sinal ("abriu a seleção 2x"), aviso de abordagem atrasada. Arrastar muda a etapa; para **Perdido** abre o motivo |
| Direita | Cliente selecionado: temperatura **com motivo**, **Próxima abordagem** com "Mensagem sugerida / Fazer agora", botões **Resumir · Virar tarefa · Abrir ficha**, **Enviados** com abertura e clique |

| Comando | Efeito | Rota | Evento |
|---|---|---|---|
| Arrastar cartão | Muda etapa; pede motivo se perdido; desfazer 8 s | `PATCH /negocios/:id` | `negocio.etapa_mudou` |
| Resumir | Resumo em até 3 frases do histórico | `POST /contatos/:id/resumo` | — (IA) |
| Virar tarefa | Tarefa sugerida com prazo do playbook | `POST /atividades` | — |
| Mover para Proposta | Abre P15 e, se houver mandato, ativa o Negociador conforme configuração | `PATCH /negocios/:id` + `POST /negociacoes` | `negociacao.iniciada` |

A visão de conversão (coorte, motivos de perda, por origem) fica em Números (P10). **Celular:** lista agrupada por etapa, sem quadro.

#### P04 · Clientes — Lista e ficha (`/clientes?visao=lista&item=:id`)

**Propósito:** cadastro completo e histórico de tudo que aconteceu e foi enviado. **Referência:** Follow Up Boss (ficha de pessoa, linha do tempo única), Compass One (o que o cliente vê), Kenlo (carteira).

| Coluna | Conteúdo |
|---|---|
| Esquerda | Botões **Importar** e **Novo**; busca (nome, telefone, e-mail); filtros prontos e Compradores · Proprietários; lista com etapa, origem e temperatura |
| Centro + direita | A **ficha do contato de duas colunas (D-92)** ocupa o centro e a direita (D-106). **Centro (o cliente):** chips, motivo e último contato, WhatsApp, Ligar, E-mail; cadastro e consentimento (uma linha) no detalhe; **Próximo passo** (abordagem, passo combinado, **Mensagem sugerida**, **Virar tarefa**); negócios, agenda e seleções. **Direita (o histórico):** **Histórico** com Registrar contato, Registrar envio e **Resumir**; **Enviados ao cliente**; **Portal do cliente** (link ativo, último acesso, **Gerar / Reenviar link · Revogar**, D-73); **Privacidade** (exportar, remover). Com o Assistente aberto, ele ocupa a direita e o histórico volta ao fechar |

**Comandos:** Resumir (`POST /contatos/:id/resumo`), Mensagem sugerida e Fazer agora (abre o WhatsApp do celular e registra a abordagem), Virar tarefa (`POST /atividades`), Gerar e revogar link do portal (rotas do portal do contato, evento `acesso_cliente.convidado`), Exportar (`GET /contatos/exportar`), Remover (`PATCH /contatos/:id/remover`, soft delete). **Celular:** a ficha em uma coluna, cliente em cima e histórico abaixo.

#### P05 · Assistente (coluna de contexto em qualquer tela; apelido `/assistente`)

**Propósito:** tirar dúvidas sobre o app e pedir coisas por conversa. **Referência:** Real Brokerage (Leo), Follow Up Boss (IA sem prompt). **D-109 (revê D-76):** o Assistente sai do menu e abre **na coluna direita da moldura**, mantendo lista e item; a coluna é do primitivo `urbi-3-colunas`, sem CSS próprio, o que resolve o motivo de D-76 (o botão flutuante pedia CSS estrutural). Tudo o mais de D-76 vale: base de ajuda gerada de `docs/`, slot `assistente`, no máximo uma ação proposta, confirmada pelas rotas de sempre, conversa em memória entre telas.

Painel: histórico da conversa; respostas com o artigo da ajuda citado e botão "Ir para…"; **ações propostas em cartão**: "Vou criar esta tarefa: … · Confirmar · Cancelar"; sugestões de perguntas em chips; campo de texto com microfone. O Assistente sabe a tela e o item abertos (vão como contexto).

| Comando | Rota | Evento |
|---|---|---|
| Perguntar | `POST /assistente/perguntar` | — |
| Confirmar ação | rota da própria ação (`POST /atividades`, agendar peça) | conforme a ação |

#### P06 · Imóveis — Carteira e ficha (`/imoveis?item=:id`)

**Propósito:** carteira organizada, anúncio de qualidade e resultado de cada imóvel. **Referência:** Kenlo (qualidade do anúncio, carteira), Compass One (engajamento do anúncio).

| Coluna | Conteúdo |
|---|---|
| Esquerda | Alternador **Carteira · Empreendimentos** (D-84); busca (bairro, código, preço); filtros de situação e visibilidade; **lista com miniatura** (`urbi-avatar`, D-65), preço, bairro, nota de qualidade colorida e situação (D-106: a grade de cartões da 1.1 vira lista na moldura) |
| Centro | Cabeçalho com título, código, **Editar** e **Criar conteúdo**. **O que falta** no topo (lista da qualidade 0–100). Fotos e arquivos, dados (preço, área, quartos, vagas, condomínio, IPTU), descrição com **Melhorar com IA**, **Autorização de venda** (exclusiva, validade, comissão, documento) e **Quem vê este imóvel** (Só você / Público na Página; "outros corretores nunca veem seus imóveis") |
| Direita | **Qualidade do anúncio** (nota), **Últimos 30 dias** (visualizações, cliques, contatos, visitas, quando a fonte existir), **Clientes que combinam** com "Enviar" e — se houver negociação — **Mandato** resumido (preço pedido, alvo; o ponto de recuo mascarado com "mostrar") |

**Comandos:** Criar conteúdo (leva a P08 com o imóvel), Melhorar descrição (`POST /imoveis/:id/descricao`), Enviar a cliente (`POST /envios`), Mudar visibilidade (`PATCH /imoveis/:id`, evento `imovel.visibilidade_mudou`), Definir mandato (abre P16).

#### P07 · Imóveis — Novo imóvel (`/imoveis/novo`)

**Propósito:** cadastrar em ~3 minutos. **Referência:** Kenlo (cadastro), Lais (IA ajudando a captar).

| Coluna | Conteúdo |
|---|---|
| Esquerda | 4 passos: **Fotos · Dados · Autorização · Onde aparece**, com estado de cada um; Salvar rascunho |
| Centro | **Passo 1:** escolher fotos; a IA sugere ordem e capa. **Passo 2:** campos pré-preenchidos pela IA a partir das fotos e do ditado (cada campo marcado "preenchido pela IA"; obrigatório vazio em destaque), ditado pelo microfone do `urbi-redator`. **Passo 3:** autorização (exclusiva, validade, comissão, documento). **Passo 4:** visibilidade (só eu / público) |
| Direita | **Qualidade ao vivo**; o que falta; "Depois de salvar posso: escrever a descrição, montar o pacote de lançamento, avisar N clientes que combinam" |

**Backend:** upload em 2 passos, `POST /imoveis` (rascunho a cada passo), IA `fotos` e `conteudo`. Evento `imovel.criado`; ao ativar, `imovel.ativado`.

#### P08 · Estúdio (`/estudio?peca=:id`)

**Propósito:** produzir e publicar no Instagram sem designer. **Referência:** Rechat e Luxury Presence (campanha pronta), Follow Up Boss (listas por etapa), Compass One (passos do marketing), Canva IA (onde a arte é feita). **D-105:** o Estúdio de D-89 a D-91 entra na moldura sem mudar de regra — a arte é feita **fora do app**, **sem aprovação por janela** (D-86), **sem listas salvas** e **sem Canva Enterprise ou preenchimento automático**.

| Coluna | Conteúdo |
|---|---|
| Esquerda | **Criar** (pedido em texto com microfone, imóvel, objetivo, formatos; Pacote de lançamento) e as **listas por etapa** com contagem (D-90): Todas · Falta a arte · Para aprovar · Prontas para publicar · Agendadas · Publicadas |
| Centro | A peça aberta: o **próximo passo** escrito; a **descrição da arte** em blocos fixos (instruções em inglês e textos da arte em português, D-91) com **Copiar descrição**, as fotos e o logo para baixar e **Abrir o Canva IA** (ou "Usar outra ferramenta"); a **área de arrastar** para enviar a arte pronta; a legenda e os textos. **Uma ação principal por estado** (falta a arte → Enviar arte; rascunho → Aprovar; aprovada → Publicar, com agora, agendar ou baixar; erro → Tentar de novo) e o menu "mais" |
| Direita | **Esta semana** (publicações agendadas e estado); conta do Instagram conectada; biblioteca de arquivos para baixar; créditos do mês (com o Mensageiro, D-87). CRECI ausente: uma linha da dica do cartão Criar, nunca aviso de bloqueio (D-90, D-93) |

| Comando | Efeito | Integração |
|---|---|---|
| Criar / Pacote de lançamento | IA estrutura textos e descrição da arte → peças em "Falta a arte" | IA `conteudo` |
| Enviar arte | Anexa a arte feita fora do app à peça | — |
| Aprovar | Peça pronta para publicar | — |
| Agendar | Evento segregado `publicacao_programada` na hora (D-75) | Instagram |
| Publicar agora | Cria o contêiner e publica | Instagram |
| Baixar | Download do arquivo ou pacote, a qualquer momento | — |

As rotas são as de `apps/portal_corretor/docs/` (Estúdio). **Celular:** lista por etapa → peça; enviar a arte pela câmera ou galeria.

#### P09 · Página (`/pagina`; apelido `/minha-pagina`)

**Propósito:** página profissional própria, montada pela IA e ajustável. **Referência:** Luxury Presence (site do corretor), Compass (cartões), Lais (marca).

| Coluna | Conteúdo |
|---|---|
| Esquerda | Endereço e estado (publicada/rascunho), **Publicar**; **Blocos** com subir, descer e mostrar (apresentação, imóveis em destaque, todos os imóveis, sobre mim, bairros, formulário, WhatsApp e Instagram) |
| Centro | Edição do bloco selecionado; pré-visualização é a própria página pública aberta em outra aba depois de publicada (exceção nomeada, bloco 5a) |
| Direita | **Marca** (a marca única de Ajustes, D-85); **Copiar link**; "Atualizar agora" no menu "mais"; visitas e contatos que vieram da página (em Números) |

**Backend:** rotas da Página em `apps/portal_corretor/docs/`; página pública com endereço por query (D-71). Com CRECI no perfil, ele aparece na capa; sem CRECI, não aparece (D-93).

#### P10 · Números (`/numeros?relatorio=funil`; apelido `/desempenho`)

**Propósito:** saber onde está perdendo clientes e o que mudar. **Referência:** Follow Up Boss (relatórios por origem), Morada (retorno por canal), Lais (leads por horário).

| Coluna | Conteúdo |
|---|---|
| Esquerda | Relatórios: Resumo · Funil e conversão · Origem dos contatos · Conteúdo · **Negociação** · (com os blocos 6 e 7: Tempo de resposta · Mensageiro · Créditos) |
| Centro | O relatório escolhido, com período e comparação; **quatro números acima da dobra** (leads, conversão total, vendas, comissão prevista); barras da coorte, motivos de perda |
| Direita | **O que melhorar** (leitura com ação: "Ver os 9 clientes"), melhores origens, **Exportar CSV** |

**Relatório Negociação (1.2):** propostas recebidas, taxa de acordo, **desconto médio concedido sobre o preço pedido**, rodadas médias até acordo, objeções mais frequentes, % das sugestões do Negociador aprovadas sem edição. Fórmulas na 11.2.

#### P11 · Ajustes — Mensageiro (`/ajustes/mensageiro`) — bloco 7

**Propósito:** configurar o atendente de IA em minutos. **Referência:** Lais e Morada (IA com a marca), Luxury Presence (especialistas de IA ligáveis). Fora do arco 1.2 (P-31/P-32).

Esquerda: **menu de Ajustes** (Mensageiro · Negociador · Conexões · Conta e marca · Plano e créditos · Funil e abordagens · Horário de atendimento · Privacidade; cada item aparece quando a função existe). Centro: estado (Ligado/Pausado), 5 passos (Quem é · O que pode fazer · Quando atua · Como fala · Testar e ligar); no passo 2, cada ação com **Não faz · Pergunta antes · Faz sozinho** (seletor de três posições, lacuna 11.9) e o quadro "Nunca faz". Direita: **Conversa de teste** e números do mês. Rotas: `GET/PUT /mensageiro`, `POST /mensageiro/teste`. Evento auditável `mensageiro.permissoes_alteradas`.

#### P12 · Ajustes — Conexões (`/ajustes/conexoes`)

**Propósito:** conectar Instagram (e WhatsApp, quando chegar) sem ajuda. **Referência:** cadastro incorporado da Meta (coexistência).

Centro: cartão **Instagram** (conectado, tipo de conta, o que pode publicar, Desconectar; D-75); cartão **WhatsApp** com 3 passos (entrar com a Meta · digitar o número que já usa · confirmar no celular) quando o bloco 6 chegar; cartão **Agenda** (fase 6). Direita: "Por que conectar aqui" em uma frase e o aviso de que pode desconectar. Eventos auditáveis `canal.conectado` / `canal.desconectado`. **Não pede CRECI** (D-93).

#### P13 · Ajustes — Conta e marca (`/ajustes/conta`)

Centro: **Seu perfil** (foto, nome profissional, **CRECI — opcional**, telefone, regiões; **sem estado de verificação**, D-93: vazio, aparece só a frase "Adicione seu CRECI ao perfil para que ele apareça nos anúncios"); **Sua marca** (logo, cor principal, cor de apoio, foto, assinatura, tom de voz usado pelas artes, pela Página e pelo Negociador; marca única, D-85). Direita: com o Mensageiro (D-87), **Plano**, **Créditos do mês** com barra e a **tabela de créditos por ação** (conversa do Mensageiro, rodada do Negociador, descrição, resumo). **Referência:** Kenlo (créditos por recurso).

Os demais itens do menu de Ajustes seguem a 1.1: **Funil e abordagens** (etapas e playbook), **Horário de atendimento** (cliente parado, validade da seleção, lembrete de visita; prazo de primeiro atendimento com o WhatsApp), **Privacidade** (exportação; LGPD na fase 2).

#### P14 · Clientes — Importar (`/clientes/importar`)

Esquerda: fontes (Planilha/CSV · Contatos do celular (vCard) · Outro CRM — fase 2). Centro: arquivo, número de linhas, **mapeamento de colunas sugerido**, **prévia** do que acontece em cada linha (novo, já existe, ignorado), **Importar N contatos**. Direita: regra para contato repetido (Pular · Completar · Substituir) e a regra de consentimento (12.1). Rota `POST /contatos/importar`. **Referência:** Follow Up Boss e Kenlo (migração assistida).

#### P15 · Clientes — Negociações (`/clientes?visao=negociacoes&item=:id`) — 1.2

**Propósito:** conduzir propostas e contrapropostas até um acordo bom para as duas partes, com o Negociador (IA ou pessoa) dentro de um mandato. **Referência:** BATNA, ZOPA e ponto de recuo (Fisher, Ury e Patton; Grupo LU), tratamento de objeções (10.9.6), linha do tempo de propostas do Compass One.

| Coluna | Conteúdo |
|---|---|
| Esquerda | Alternador Funil · Lista · **Negociações**. Filtros: **Aguardando você · Negociador atendendo · Aguardando cliente · Aguardando proprietário · Encerradas**. Lista: cliente, imóvel, **última oferta × preço pedido** (ex.: "R$ 920 mil · −6%"), quem conduz (Negociador IA, negociador humano, você), tempo desde a última rodada |
| Centro | **Faixa da negociação** (faixa ZOPA, D-102): linha horizontal com marcas de **preço pedido**, **alvo**, **ponto de recuo** (sigiloso, só para a conta), **última oferta do comprador**, **teto estimado do comprador** e a **ZOPA estimada** pintada entre o recuo e o teto; fora dela, em alerta. Abaixo, a **escada de propostas** (cada rodada em uma linha: quem, valor, condições, concessão, contrapartida, canal, data). Em seguida, as mensagens da negociação (portal e registros), com o cartão de **sugestão do Negociador** quando estiver em "pergunta antes" |
| Direita | **Mandato** (preço pedido, alvo, recuo mascarado, BATNA do vendedor, concessões e contrapartidas, prazo, autonomia); **Leitura do comprador** (interesses, objeções com categoria, BATNA estimada com a fonte); **Próximo movimento sugerido**; botões **Enviar pelo portal · Fazer agora · Editar · Passar para o proprietário · Assumir** |

| Comando | Efeito | Rota | Evento |
|---|---|---|---|
| Registrar oferta do cliente | Nova rodada (`direcao: comprador`, `canal: registro`) | `POST /negociacoes/:id/propostas` | `proposta.recebida` |
| Pedir sugestão | O Negociador gera o próximo movimento dentro do mandato (custo mostrado) | `POST /negociacoes/:id/sugestao` | `contraproposta.sugerida` |
| Enviar pelo portal | Valida o mandato **no código** (10.9.7) → aparece no Portal do Cliente (M5b) e grava a rodada (`canal: portal`) | `POST /negociacoes/:id/propostas` (`direcao: vendedor`) | `contraproposta.enviada` |
| Fazer agora | Valida 10.9.7 → abre o WhatsApp do celular com a mensagem pronta (`wa.me`) e grava a rodada (`canal: wa_me`) | `POST /negociacoes/:id/propostas` | `contraproposta.enviada` |
| Passar para o proprietário | Resumo da proposta para decisão; no MVP o corretor registra a decisão; na fase 3 vai ao Portal do Proprietário | `POST /negociacoes/:id/decisao` | `negociacao.acordo_proposto` |
| Registrar decisão | Aceita · Recusa · Contraproposta do proprietário | `PATCH /propostas/:id` | `proposta.decidida` |
| Assumir / Devolver ao Negociador | Troca quem conduz | `POST /negociacoes/:id/assumir` · `/devolver` | `negociacao.assumida` |
| Encerrar | Ganho (gera comissão prevista) ou perdido com motivo | `PATCH /negociacoes/:id` | `negociacao.encerrada` |
| Editar mandato | Abre P16 | — | `mandato.alterado` (auditável) |

**Regra visual de sigilo:** o ponto de recuo e a BATNA do vendedor aparecem **mascarados** ("•••• mostrar") e nunca em nenhuma superfície do cliente, nem em exportações para o cliente. **Celular:** M8.

#### P16 · Mandato de negociação (sobre P15 ou P06) — 1.2

**Propósito:** o corretor define, com a autorização do proprietário, até onde o Negociador pode ir. **Referência:** BATNA e ponto de recuo; concessões recíprocas. Abre em `urbi-modal` (a gaveta do mockup é lacuna, pedido ao shell 10).

Formulário em 4 blocos, com explicação de uma linha em cada campo:
1. **Valores:** preço pedido (vem do anúncio), **alvo**, **ponto de recuo** e **BATNA do vendedor** em texto ("manter anunciado 60 dias", "proposta de R$ 1,35 mi de outro comprador"). Validação: recuo ≤ alvo ≤ pedido.
2. **Concessões e contrapartidas:** itens negociáveis, cada um com o que pedir em troca (ex.: "prazo de entrega de 90 dias ↔ entrada maior"); **passo máximo** de concessão de preço por rodada (padrão 40% do intervalo restante) e **número máximo de rodadas** (padrão 4).
3. **Prazo e validade:** validade do mandato e de cada contraproposta.
4. **Autonomia:** Negociador **IA** ou **humano** (escolher a pessoa; só com a política multi-usuário, D-108) e o nível: **Só sugere · Pergunta antes · Faz sozinho dentro da faixa** (10.9.3; seletor de três posições, lacuna 11.9). Campo **Autorização do proprietário** (anexo ou registro "autorizado por mensagem em <data>"), obrigatório para "faz sozinho" (D-99, forma final em P-41).

Rotas: `GET/PUT /negociacoes/:id/mandato`. Evento auditável `mandato.alterado`.

#### P17 · Ajustes — Negociador (`/ajustes/negociador`) — 1.2

**Propósito:** definir como o Negociador trata contatos, propostas e contrapropostas: o **prompt com instruções e regras** (D-101). **Referência:** Luxury Presence (especialista de IA configurável), Morada (tom de voz da marca).

| Coluna | Conteúdo |
|---|---|
| Esquerda | Menu de Ajustes (Negociador selecionado) |
| Centro | **1. Quando entra:** gatilhos marcáveis — negócio chega à etapa Proposta; cliente pede desconto ou fala de preço; reação "conversar sobre o preço"; oferta registrada ou feita no portal. **2. Quem negocia por padrão:** IA (padrão, D-94) ou pessoa (lista de negociadores humanos; **Convidar negociador**, sem CRECI, D-94, só com a política multi-usuário, D-108). **3. Estilo:** Cooperativo (padrão) · Firme · Consultivo, com exemplo de mensagem de cada. **4. Regras fixas** (só exibidas): nunca revelar ponto de recuo e BATNA do vendedor; nunca inventar outra proposta ou urgência; nunca aceitar acordo final; sempre pedir contrapartida ao conceder; sempre passar ao corretor nos gatilhos de 10.9.5. **5. Instruções do corretor** (texto livre, até 4.000 caracteres, com o modelo do Apêndice C para editar). **6. Respostas a objeções** (Apêndice D) com "usar padrão" ou "editar a minha resposta" por categoria. **7. Testar:** simulador em que a equipe faz o papel do comprador e vê a faixa ZOPA reagindo |
| Direita | Pré-visualização de **como o Negociador vai responder** à última objeção testada; números do mês (rodadas, acordos, desconto médio, % aprovadas sem edição); custo estimado por rodada |

Rotas: `GET/PUT /negociador/config`, `POST /negociador/teste`, `GET/POST/PATCH /negociador/atribuicoes`. Evento auditável `negociador.config_alterada`.

### 11.2 KPIs de conversão (fonte, período, fórmula)

Período padrão: últimos 30 dias, comparação com os 30 anteriores. Coorte = negócios criados no período.

| KPI | Fonte | Fórmula | Sem dado |
|---|---|---|---|
| Leads | `negocios` pipeline compra | Contagem criada no período | "Nenhum lead no período" |
| Tempo de primeiro atendimento | `conversas` | Média de `primeira_resposta_em − primeira_entrada_em`; e % em ≤5 min, ≤1 h, ≤24 h, sem resposta | `null` se nenhuma conversa |
| Primeiro atendimento humano | `conversas` | Idem com `primeira_resposta_humana_em`, só onde houve passagem | `null` |
| Lead → atendimento | eventos de etapa | Coorte que chegou a "Em atendimento" / leads | `null` se leads = 0 |
| Lead → visita | idem | Coorte que chegou a "Visitou" / leads | idem |
| Visita → proposta | idem | Chegou a "Proposta" / chegou a "Visitou" | `null` se visitas = 0 |
| Proposta → ganho | idem | Ganhos / chegou a "Proposta" | idem |
| Taxa de conversão total | idem | Ganhos / leads | idem |
| Ciclo médio | `negocios` | Média de `ganho_em − criado_em` dos ganhos no período | `null` sem ganhos |
| Tempo por etapa | eventos | Média de permanência por etapa | `null` |
| Motivos de perda | `negocios` | Distribuição de `motivo_perda` | frase |
| Conversão por origem | `negocios` + `origens` | Ganhos e leads por canal/campanha | — |
| Custo por lead / por venda | `custos_origem` | Investimento / leads; investimento / ganhos | `null` + "informe o investimento" |
| VGV | `negocios` ganhos | Σ `valor_estimado_c` (ou valor da proposta aceita) | 0 só se houve período sem vendas e há negócios; senão `null` |
| Comissão prevista ponderada | 6.12 | | `null` sem negócios abertos |
| Comissão recebida | `recebimentos` | Σ no período | frase |
| Captações | pipeline venda | Chegaram a "Autorização assinada" | frase |
| Conteúdo | `publicacoes`, `metricas_diarias` | Peças publicadas, alcance, cliques, leads atribuídos por peça | frase |
| Agentes | `agente_execucoes`, `passagens` | % conversas sem passagem; passagens por motivo; visitas agendadas por agente; créditos por lead atendido | `null` sem agente |
| Metas | `metas` | Realizado / alvo por indicador, com ritmo esperado no dia do período | "Defina uma meta" |

**KPIs de negociação (1.2, relatório Negociação de P10):**

| KPI | Fonte | Fórmula | Sem dado |
|---|---|---|---|
| Propostas recebidas | `propostas` com `direcao = comprador` | Contagem no período | "Nenhuma proposta no período" |
| Taxa de acordo | `negociacoes` | Encerradas como ganho / encerradas | `null` sem encerradas |
| Desconto médio concedido | `negociacoes` ganhas | Média de `(preco_pedido_c − valor_final_c) / preco_pedido_c` | `null` sem ganhos |
| Rodadas até o acordo | `propostas` | Média do número de rodadas das negociações ganhas | `null` |
| Acordos dentro da ZOPA estimada | `negociacoes` | Ganhas com valor entre o recuo e o teto estimado / ganhas | `null` |
| Objeções mais frequentes | `objecoes_detectadas` | Contagem por categoria | frase |
| Sugestões aprovadas sem edição | `negociador_execucoes` | Aprovadas sem edição / sugestões enviadas | `null` |

### 11.3 Portal do Cliente e superfícies públicas (celular primeiro)

**Referência:** Compass One (painel do cliente, próximo passo, o que falta de você, jornada), conceito de app imobiliário móvel escolhido pelo dono (cartões com foto dominante), Lais (conversa como centro).

**Regra do MVP (D-56, D-73, D-104):** todas as superfícies do cliente são **páginas públicas com token**, sem login e sem role `cliente`: leem a `vitrine_publica` (só GET, sem dado pessoal, D-55) e toda ação entra pelo `wh` do portal com o token, conferido por `inspecionarIngressoWh`; o listener grava com `comConta`. CSS próprio das páginas públicas, com a marca do corretor como dado. Os mockups M4, M5 e M5b mostram o portal dentro do shell ("Meu atendimento"); **vale esta seção**.

#### M4 · Portal do Cliente — início (`/c?t=<token>`, página pública)

- **Topo:** foto e nome do corretor (com CRECI, quando houver, D-93) e botão WhatsApp (`wa.me`).
- **Faixa "Próximo passo"** em destaque (ex.: "Visita sábado às 10 h · Ver").
- **Seções:** Imóveis para você (N) · Agenda (N) · Sua jornada · **Propostas (N)** quando houver negociação. Arquivos entram depois (D-73).
- **Mensagem ao corretor:** campo "Escreva para o Rafael" e enviar; no MVP vira item da linha do tempo e tarefa do corretor (D-73); com o WhatsApp, entra na mesma conversa.

#### M5 · Portal do Cliente — Imóveis e agenda

Imóvel em destaque com galeria, preço e botões **Gostei · Não gostei · Quero visitar · Conversar sobre o preço**; lista dos outros imóveis com a reação dada; Agenda com visitas e reuniões, adicionar ao calendário do celular e **pedir para remarcar**; cartão **O que falta de você** na fase 3.

#### M5b · Portal do Cliente — Propostas (1.2)

Linha do tempo das propostas do cliente e das respostas do vendedor (valor, condições, validade, estado). Botões **Aceitar condição · Fazer nova oferta · Mensagem ao corretor**. **Nunca mostra** o mandato, o alvo, o ponto de recuo, a BATNA do vendedor nem notas internas: a vitrine do portal só recebe o valor e as condições de cada rodada. "Aceitar" registra a **intenção** do cliente; o acordo só fecha com a confirmação do corretor e do proprietário (D-15). Como "Aceitar" não fecha nada, não pede código de confirmação.

| Comando | Entrada (`wh` do portal, com o token) | Evento |
|---|---|---|
| Reagir a imóvel | reação | `selecao.reagida` |
| Pedir/remarcar visita | pedido | `visita.pedida` |
| Mensagem ao corretor | mensagem | `mensagem.recebida` |
| Fazer nova oferta | oferta (`canal: portal`) | `proposta.recebida` |
| Aceitar condição | aceite | `proposta.aceite_cliente` |

#### Seleção (`/s?t=<token>`)

Cartões de imóvel no padrão da imagem 1 (foto grande, preço, bairro, ícones de quartos, área e vagas), galeria, reação, "quero visitar". Pode ser aberta sozinha ou dentro do Portal do Cliente.

#### M6 · Página (visitante, sem login, `/p?c=<endereço>`, D-71)

Capa com foto, nome, CRECI quando houver (D-93) e **Falar no WhatsApp**; imóveis em destaque com **Quero saber mais** (abre o WhatsApp com o imóvel citado); demais blocos conforme P09; formulário por `wh`. Ficha pública do imóvel em `/p?c=<endereço>&i=<código>`. Marca do corretor como dado e CSS próprio.

#### M7 · Portal do Proprietário (fase 3)

Imóvel, dias à venda, vistas, visitas, propostas (sem nome do comprador); **O que o corretor está fazendo** (entregas com estado); **Proposta recebida** com **Ver detalhes · Falar com o corretor**; retorno das visitas revisado. Na fase 3, a decisão do proprietário sobre propostas é feita aqui (`wh` do portal com o token do proprietário), e o mandato pode ser **aprovado pelo proprietário** nesta tela. Comissão combinada, metas e relatório semanal como na 2.4.

**Material de empreendimento** e **cartão de rede**: fases 5 e 7 (`specs/horizonte.md`).

### 11.4 Incorporadora

Movida para `specs/horizonte.md` (D-88).

### 11.5 Celular do corretor

**Referência:** Lais (app Casa da Lais), Compass One (cartões de ação). No celular o shell põe o menu no dropdown do nome da app; por isso Hoje concentra os atalhos do dia.

| Tela | Conteúdo e comandos |
|---|---|
| **M1 · Hoje** | "Precisa de você" (passagens do Negociador e, com o bloco 7, do Mensageiro), fila do dia em cartões com um toque e uma linha de **atalhos do dia** no topo da tela: Criar · Clientes · Imóveis · Assistente (Conversas com selo, quando houver) |
| **M2 · Conversa** (blocos 6 e 7) | Voltar, nome e estado; **resumo da IA** em faixa; mensagens; aviso de passagem; ações rápidas (Sugestão · Imóvel · Portal · Proposta); compositor com áudio |
| **M3 · Novo imóvel** | Botão grande "Tirar fotos ou escolher da galeria"; miniaturas; "A IA já entendeu…"; **Ditar o resto**; Salvar rascunho · Continuar |
| **M8 · Aprovar negociação** (1.2) | Aviso em Hoje (e por e-mail, D-57) "Negociador sugere contraproposta para Juliana" → tela com a faixa ZOPA resumida, a mensagem sugerida, a concessão e a contrapartida; **Enviar pelo portal · Fazer agora · Editar · Assumir** |

### 11.6 O que o negociador humano vê (role `negociador`)

Pessoa convidada pelo corretor para conduzir negociações (ex.: um sócio ou um especialista). **Convite sem CRECI (D-94)**; só existe com a política "permite contas multi-usuário" ligada na instância (D-108). **Vê apenas as negociações atribuídas a ela** (`atribuicoes_negociacao`): menu reduzido a **Hoje · Clientes › Negociações** (e Conversas dessas negociações, quando houver WhatsApp); P15 completo, inclusive o mandato em leitura; não vê carteira, Estúdio, Página, Números gerais nem Ajustes. O que ela envia sai pelo portal ou pelo "Fazer agora" do próprio celular, com o rótulo "Negociador" na linha do tempo do app (o cliente vê a assinatura configurada, ex.: "Rafael · equipe de negociação").

### 11.7 Menu Criar e comandos globais

| Comando | Onde | O que abre | Rota |
|---|---|---|---|
| Novo cliente | Criar | Captação em 3 passos (nome e telefone; o que procura; origem) | `POST /contatos` |
| Novo imóvel | Criar | P07 | `POST /imoveis` |
| Novo post | Criar | P08 com o Criar aberto | rotas do Estúdio |
| Nova visita | Criar | Seletor de cliente, imóvel e horário livre | `POST /atividades` |
| Nova proposta | Criar | P15 com seletor de negócio | `POST /negociacoes` |
| Busca global (`/`) | Cabeçalho de qualquer coluna esquerda | Resultados por tipo: clientes, imóveis, peças (e conversas, quando houver) | `GET /busca?q=` |
| Assistente (`A`) | Trilho | P05 na coluna direita | `POST /assistente/perguntar` |

### 11.8 Mapa resumido: tela × backend × integração

| Tela | Rotas principais | Eventos que publica | IA (slot) | Integração externa |
|---|---|---|---|---|
| P01 Hoje | `/inicio` | `negociacao.assumida` | `funil` | — |
| P02 Conversas (blocos 6 e 7) | `/conversas`, `/envios`, `/modelos-mensagem` | `mensagem.enviada`, `envio.criado`, `visita.agendada` | `mensageiro`, `negociador` | WhatsApp |
| P03 Funil | `/negocios`, `/funil/*` | `negocio.etapa_mudou`, `negociacao.iniciada` | `funil` | — |
| P04 Ficha | `/contatos/:id`, `/contatos/:id/resumo`, portal do contato | `acesso_cliente.convidado` | `assistente` / `funil` | — |
| P05 Assistente | `/assistente/perguntar` | conforme a ação | `assistente` | — |
| P06–P07 Imóveis | `/imoveis`, upload | `imovel.criado`, `imovel.ativado` | `fotos`, `conteudo` | — |
| P08 Estúdio | rotas do Estúdio | `publicacao_programada`, `publicacao.*` | `conteudo` | Instagram; Canva IA fora do app |
| P09 Página | rotas da Página | `pagina.publicada` | `conteudo` | — |
| P10 Números | `/numeros` | — | — | — |
| P11–P13, P17 Ajustes | `/conta`, `/conexoes`, `/mensageiro`, `/negociador/config` | `*.alterad*` (auditáveis), `canal.*` | — | Meta (login do Instagram) |
| P14 Importar | `/contatos/importar` | `contatos.importados` | — | — |
| P15–P16 Negociação | `/negociacoes/*` | `proposta.*`, `contraproposta.*`, `mandato.alterado`, `negociacao.*` | `negociador` | Portal (token); `wa.me` no "Fazer agora" |
| M4–M5b Portal | página pública `/c` + `wh` do portal | `selecao.reagida`, `visita.pedida`, `proposta.recebida`, `proposta.aceite_cliente` | — | — |
| M6 Página pública | `/vitrine` (pública), `wh` do formulário | `lead_recebido` | — | — |

### 11.9 Primitivos de UI por tela e lacunas

Telas autenticadas usam só primitivos `urbi-*` e tokens; as páginas públicas (Página, ficha, seleção, portal) têm CSS próprio, com a marca do corretor como dado. Esta tabela substitui a antiga 11.5 (as decisões D-62 e D-65 citam a numeração antiga).

| Tela | Primitivos principais |
|---|---|
| Moldura | `urbi-3-colunas` (colunas), `urbi-trilho-atalhos` (trilho com Criar e Assistente), `urbi-inbox` onde a esquerda é caixa; `urbi-modal` no lugar de gaveta (lacuna) |
| P01 Hoje | `urbi-abas` (Hoje · Agenda), `urbi-lista` (fila e agenda), `urbi-kpi` + `urbi-grid` (sua semana), `urbi-badge` (chips), `urbi-botao`; barra de progresso de Primeiros passos (lacuna; até lá, texto "3 de 5") |
| P02 Conversas, M2 | `urbi-inbox`, `urbi-chat`, `urbi-redator` (anexo e microfone), `urbi-ficha`, `urbi-badge` |
| P03 Funil | `urbi-kanban`, `urbi-chips-atalho` ou `urbi-badge` interativo (filtros prontos), `urbi-ficha`, `urbi-kpi` |
| P04 Ficha | `urbi-2x1 largura="largo"` (D-92) dentro das colunas centro e direita, `urbi-feed` (histórico), `urbi-tabela` (lista), `urbi-dropdown` (menu "mais"), `urbi-planilha` (P14) |
| P05 Assistente | `urbi-chat` na coluna direita, `urbi-card` (ação proposta) |
| P06–P07, M3 Imóveis | `urbi-lista` com `urbi-avatar` (miniatura, D-65), `urbi-seletor-arquivo`, `urbi-visualizador-arquivo`, `urbi-formulario` |
| P08 Estúdio | `urbi-lista` (listas por etapa), `urbi-card` (peça) com `urbi-avatar` (miniatura da arte; exceção nomeada "cartão de arte", bloco 8a), `urbi-seletor-arquivo` (área de arrastar), `urbi-redator` (pedido), `urbi-dropdown` (menu "mais") |
| P09 Página | `urbi-card` + `urbi-linha` (blocos), diálogo `urbiVerso.formulario` |
| P10 Números | `urbi-kpi`, `urbi-grafico-colunas`, `urbi-grafico-linha`, `urbi-tabela` |
| P11–P14, P16–P17 | `urbi-formulario`, `urbi-toggle`, `urbi-chat` (testes), `urbi-planilha` (prévia da importação), `urbi-modal` (P16); seletor de três posições (lacuna; até lá, `urbi-select`) |
| P15 Negociação | `urbi-feed` (escada de propostas), `urbi-ficha` (mandato e leitura do comprador), `urbi-card` (sugestão); **faixa ZOPA** (lacuna; até lá, os valores em `urbi-kpi` com a ZOPA em texto) |
| Portal, seleção e Página pública | CSS próprio: cartões com foto dominante, linha do tempo vertical, botões grandes |

**Lacunas a registrar como exceção nomeada ou pedir como primitivo novo:** calendário (agenda e calendário editorial; até lá, lista por dia com `urbi-lista`); galeria de fotos (até lá, `urbi-avatar` e `urbi-visualizador-arquivo`, D-65); **cartão com capa** (pedido ao shell 7); estado da aba do `urbi-abas` na URL (pedido ao shell 8); pré-visualização da Página dentro do editor; cartão de arte com proporção fixa (1:1, 4:5, 9:16); e, confirmadas no catálogo `ui-componentes-*` do SDK 100 para o Padrão B: **gaveta** (pedido ao shell 10; P16 e a coluna de contexto em telas estreitas usam `urbi-modal`), **barra de progresso** (pedido 11), **seletor segmentado de três posições** "Não faz · Pergunta antes · Faz sozinho" (pedido 12) e **faixa ZOPA** (régua horizontal com marcas e intervalo colorido; pedido 13).

## 12. Importação, exportação e migração

### 12.1 Importação de contatos e imóveis

CSV ou planilha (`;` ou `,`, UTF-8 ou Latin-1 detectado). Mapeamento de colunas com pré-visualização das 10 primeiras linhas. Telefone normalizado na entrada; linhas sem nome e sem telefone são rejeitadas com motivo. Modos de duplicata (por `telefone_norm`, depois e-mail): `pular`, `atualizar campos vazios`, `sobrescrever`. Origem `importacao` com campanha = nome do arquivo. Consentimento: contatos importados entram com `consentimento_id = null` e os agentes só falam com eles por modelo aprovado de reengajamento que pede consentimento. Relatório final: criados, unidos, rejeitados (baixável).

### 12.2 Migração do MVP

Não há dado real no MVP (estado no navegador, seed 5). A migração é a **semente de demonstração**: conta "Marina (demo)", 3 corretores, 13 imóveis, 22 contatos, 8 propostas, conta incorporadora "UP/Urbitá (demo)" com Reserva do Colorado (36 unidades, 3 quadras, 4 versões de tabela, 5 reservas). Critério de aceite: os 3 roteiros do MVP ("Rodar o atendimento das 22 h", "Criar com 8% e decidir como Rafael", "Fechar o negócio como Diego") executáveis na instância Pinguim com os mesmos resultados.

### 12.3 Exportação

Seção 7.4.

## 13. Eventos, erros e notificações

### 13.1 Eventos (barramento) [plataforma]

Declarados em `manifesto.eventos` com `campos`, `conteudo`, `api` e `rota`, todos `segregado_por_conta: true`, publicados pelas rotas próprias (o CRUD genérico não publica). Tipo final: `app.portal_corretor.<nome>` com `_` no lugar do ponto. **Auditáveis** (`auditavel`): consentimento registrado ou revogado, permissões do Mensageiro alteradas, conexão ou desconexão de WhatsApp e Instagram, ciência de proposta pelo proprietário (fase 3). Os listados abaixo são o catálogo lógico.

`lead.recebido`, `mensagem.recebida`, `mensagem.falhou`, `conversa.passada`, `conversa.assumida`, `negocio.etapa_mudou`, `negocio.ganho`, `negocio.perdido`, `visita.agendada`, `visita.feedback`, `selecao.reagida`, `proposta.enviada`, `proposta.decidida`, `imovel.ativado`, `imovel.preco_reduzido`, `imovel.vendido`, `autorizacao.vencendo`, `peca.pronta`, `publicacao.feita`, `publicacao.falhou`, `parceria.proposta`, `parceria.aceita`, `reserva.pedida`, `reserva.confirmada`, `reserva.vencida`, `unidade.disponivel`, `excecao.pedida`, `excecao.decidida`, `cota.atingida`, `integracao.erro`, `rotina.incompleta`. Gatilhos dos agentes e das regras de publicação assinam estes eventos. P-06: confirmar que um evento disparado por webhook pode executar o agente em segundos (é o que garante o tempo de primeiro atendimento).

**Eventos das telas do Padrão B (1.2, completam o catálogo):** `mensagem.enviada`, `envio.criado`, `conversa.devolvida`, `acesso_cliente.convidado`, `atividade.criada`, `imovel.criado`, `imovel.visibilidade_mudou`, `pagina.publicada`, `contatos.importados`, `visita.pedida`; **auditáveis**: `canal.conectado`, `canal.desconectado`, `mensageiro.permissoes_alteradas`. Todos `segregado_por_conta: true`; os que já existem em 0.1.0 com outro nome (ex.: `lead_recebido`, `publicacao_programada`) ficam como estão, e o catálogo vigente é o do `manifesto.json`.

**Eventos de negociação (1.2):** `negociacao.iniciada`, `proposta.recebida`, `contraproposta.sugerida`, `contraproposta.enviada`, `objecao.detectada`, `negociacao.limite_atingido`, `negociacao.acordo_proposto`, `proposta.decidida`, `proposta.aceite_cliente`, `negociacao.assumida`, `negociacao.encerrada`; **auditáveis**: `mandato.alterado`, `negociador.config_alterada`. Todos `segregado_por_conta: true`; os que envolvem mandato **nunca carregam valores sigilosos** no conteúdo do evento (só o id), porque os membros da conta leem os eventos dela. Telas abertas atualizam pelo stream SSE do barramento (`barramento.md`), com `destinatarios` quando couber.

### 13.2 Erros de negócio

`AUTORIZACAO_AUSENTE`, `AUTORIZACAO_VENCIDA`, `FORA_DA_JANELA_WHATSAPP`, `MODELO_NAO_APROVADO`, `COTA_ATINGIDA`, `CONSENTIMENTO_REVOGADO`, `UNIDADE_INDISPONIVEL`, `RESERVA_JA_EXISTE`, `ACIMA_DA_ALCADA`, `TOKEN_EXPIRADO`, `DUPLICATA`, `CIENCIA_TITULAR_AUSENTE`, `CANAL_DESCONECTADO`. Cada um com frase para a tela no catálogo do manifesto. **Sai `CRECI_AUSENTE` (D-93):** a falta de CRECI nunca é erro, só aviso.

**Erros da negociação (1.2):** `MANDATO_AUSENTE`, `MANDATO_VENCIDO`, `ABAIXO_DO_RECUO`, `PASSO_ACIMA_DO_LIMITE`, `RODADAS_ESGOTADAS`, `CONCESSAO_FORA_DO_MANDATO`, `SIGILO_VIOLADO`, `AUTORIZACAO_PROPRIETARIO_AUSENTE` (os bloqueios de 10.9.7), `RECUO_ACIMA_DO_ALVO` (validação do mandato) e `MULTI_USUARIO_DESLIGADO` (convite de negociador humano com a política desligada, D-108).

### 13.3 Notificações

| Evento | Para | Canal |
|---|---|---|
| Passagem do agente | Responsável | No app + push/WhatsApp do corretor |
| Lead sem resposta humana após prazo (quando autonomia = rascunho) | Responsável; gestor após 2× prazo | No app |
| Reação "quero visitar"/"conversar sobre preço" | Responsável | No app |
| Proposta decidida, reserva confirmada/vencida, exceção decidida | Corretor | No app + e-mail |
| Autorização vencendo (30/7 dias) | Responsável | No app |
| Mensagem do proprietário | Responsável | No app |
| Publicação falhou, canal desconectado | Dono da conta | No app + e-mail |
| Cota atingida | Dono da conta | No app + e-mail |
| Convite de conexão, proposta de parceria | Membro | No app |
| Relatório semanal | Proprietário | E-mail ou WhatsApp (modelo de utilidade) |

**Canal no MVP (D-57):** "no app" é a tela Hoje e "push" vira e-mail; a coluna acima fica como desenho. **Notificações da negociação (1.2):** contraproposta aguardando aprovação (corretor ou negociador humano; Hoje + e-mail, com atalho para P15/M8); oferta recebida, inclusive pelo portal (corretor); passagem do Negociador (topo de Hoje); acordo proposto aguardando decisão (corretor); mandato vencendo em 24 h (corretor).

## 14. Permissões e papéis

| Recurso | dono_conta | gestor | corretor | agente | comercial_inc. | proprietário | parceiro |
|---|---|---|---|---|---|---|---|
| Contatos e negócios | tudo | equipe | próprios | criar/atualizar (10.3) | — | — | negócio compartilhado, leitura |
| Conversas | tudo | equipe | próprias | enviar | — | portal | — |
| Imóveis e autorizações | tudo | equipe | próprios | ler públicos | — | o seu, leitura | públicos |
| Propostas | tudo | equipe | próprias | — | decidir (incorporadora) | ciência | — |
| Comissões | tudo | equipe | próprias | — | — | combinada, leitura | divisão da parceria |
| Conteúdo e publicação | tudo | equipe | próprios | gerar rascunho | materiais | aprovar se combinado | — |
| Agentes, canais, plano | tudo | ler | ler | — | — | — | — |
| Metas | tudo | equipe | próprias | — | — | do imóvel, leitura | — |
| Rede | tudo | equipe | própria | — | credenciamento | — | — |
| Incorporadora | — | — | pedir reserva, ver espelho se credenciado | — | tudo exceto acima da alçada | — | — |

Nível de acesso por papel na forma de `permissoes.md` (P-01). `diretoria_incorporadora` = comercial + decidir exceções acima da alçada (P-14).

**Escala de acesso (2.2) aplicada:** a camada Plataforma (`operador_plataforma`) administra planos, cotas, contas e a base de ajuda, e vê só agregados de uso; dados de clientes de uma conta só com autorização do dono para suporte (P-19). O cliente do corretor é usuário externo por `acessos_cliente`, com o perfil `comprador` ou `proprietario` determinando o que lê; não tem papel dentro da conta.

**Na plataforma (4.4):** `dono_conta` e `corretor` desta tabela são o role externo `corretor` no MVP (gestor e equipe na fase 4); `proprietario`/comprador são o role externo `cliente`; a camada Plataforma são os roles de equipe `operacao` e `suporte`; o Mensageiro e o Assistente não são usuários, agem pelo backend com a autoria registrada. **No MVP o cliente não é usuário (D-56):** age pelo link com token.

**Negociador (1.2):**

| Recurso | Corretor | Negociador humano (role `negociador`) | Negociador IA | Cliente (link com token) |
|---|---|---|---|---|
| Negociações | todas da conta | só as atribuídas | as ligadas a ele, dentro do mandato | só as dele, sem mandato |
| Mandato | criar, editar | ler | ler (no contexto, campos sigilosos marcados) | **nunca** |
| Propostas | todas | das atribuídas | registrar as que envia | as dele (M5b) |
| Enviar contraproposta | sim (portal ou Fazer agora) | sim, dentro do mandato (portal ou Fazer agora) | conforme autonomia, dentro do mandato; "faz sozinho" só no portal (D-107) | — |
| Aceitar acordo final / registrar decisão do proprietário | sim | não | não | registra só a intenção |
| Conversas (quando houver WhatsApp) | todas | só as das negociações atribuídas | só a da negociação | a própria |
| Carteira, Estúdio, Página, Números, Ajustes | sim | não | — | — |

Na plataforma: `roles_externos.escrita` ganha `negociador` (D-108, com a política multi-usuário ligada); toda rota de negociação checa o role e, para `negociador`, filtra por `atribuicoes_negociacao.usuario_id = usuario.id`; recurso fora da atribuição responde "não encontrado". O convite não pede CRECI (D-94).

## 15. Fases

Estimativa em sessões de implementação com o kit do UrbiVerso. Cada fase só começa quando a anterior cumpre o "pronto quando".

**O que é o MVP neste projeto (definição do dono, 17/10/2026):** a versão em que **as telas, as funções, as permissões, os botões, os caminhos e as automações** estão prontos e funcionando, testados pela **equipe interna** com contas e dados de teste. **Nenhum corretor real usa o MVP.** O corretor real entra na fase 2 (validação); só depois dela o MVP é considerado validado.

### 15.0 O que entra em cada fase

✅ entra · ➕ ampliação · — ainda não. F1 = MVP interno · F2 = validação com corretores reais.

| Módulo / capacidade | F1 MVP | F2 Valid. | F3 | F4 | F5 | F6 | F7 |
|---|---|---|---|---|---|---|---|
| Conta do corretor autônomo, marca, CRECI opcional no perfil (sem verificação, D-93) | ✅ | | | | | | |
| Segmentação e isolamento (4.5) | ✅ | | | ➕ equipe | ➕ rede | | |
| Assistente do Corretor (texto) | ✅ | | ➕ voz | ➕ gestor | | | |
| Contatos, negócios, funil, etapas configuráveis | ✅ | | | | | | |
| Temperatura com motivo, próxima abordagem, fila do dia | ✅ | | | | | | |
| Envios rastreados e histórico completo | ✅ | | | | | | |
| Tarefas, agenda, visitas | ✅ | | ➕ retorno revisado ao proprietário | | | ➕ agenda externa | |
| Importação CSV e exportação | ✅ | | | | | | |
| Imóveis com fotos, descrição por IA, qualidade, autorização anexada | ✅ | | | | | ➕ assinatura eletrônica | |
| Empreendimentos cadastrados pelo corretor | ✅ | | | | ➕ módulo incorporadora | | |
| WhatsApp pelo app (coexistência), caixa de conversas | ✅ contas de teste | ✅ contas reais | | ➕ Instagram Direct, Messenger | | | |
| Mensageiro em texto, permissões por ação, conversa de teste | ✅ | | | | | | |
| Negociador (IA e humano), mandato, propostas e contrapropostas, faixa ZOPA, respostas a objeções (1.2) | ✅ IA pelo portal e "Fazer agora"; humano com a política multi-usuário | | ➕ decisão do proprietário no portal | ➕ negociadores da equipe | | | |
| Padrão B: moldura de três colunas, menu com os nomes do Padrão B, Criar e Assistente na moldura (1.2) | ✅ | | | | | | |
| Mensageiro com áudio, follow-up, reativação, financiamento | — | — | ✅ | | | | |
| Estúdio: post, carrossel, story, legendas, descrição da arte para o Canva IA (arte fora do app, D-89) | ✅ | | | | | | |
| Estúdio: vídeo, edição de foto, mobília virtual, calendário sugerido | — | — | ✅ | | | | |
| Publicar agora / agendar / baixar arquivos | ✅ | | | | | | |
| 1.1: menu de oito telas, Ajustes e marca únicos, filtros prontos, resumo em uma frase, cartão de imóvel (15.8, 15.9) | ✅ | | | | | | |
| 1.1: Resumir com IA, mensagem sugerida com Fazer agora, tarefa com um toque (slot `funil`) | ✅ | | | | | | |
| Aprovação de conteúdo por janela | sai (D-86) | | | | | | |
| Modelos de importação de outros CRMs | — | ✅ | | | | | |
| Portal: próximo passo, datas-chave, o que falta de você | — | — | ✅ | | | | |
| Remarketing, avaliação no Google, descrições em lote, alerta de anúncio parado | — | — | ✅ | | | | |
| Tabela de créditos por ação de IA | com o bloco 7 (D-87) | | | ✅ cobrança | | | |
| Facebook | — | — | — | ✅ | | | |
| TikTok, YouTube, LinkedIn, Google | — | — | — | — | — | ✅ | |
| Minha Página por blocos | ✅ | | | | | ➕ domínio próprio, blog, SEO | |
| Portal do Cliente — comprador | ✅ | | | | | ➕ pós-venda e valorização | |
| Portal do Cliente — proprietário, entregas, relatório, propostas | — | — | ✅ | | | | |
| Metas e comissões, divisões, recebimentos | — | — | — | ✅ | | | |
| Equipe, gestor, fila compartilhada, reatribuição | — | — | — | ✅ | | | |
| Planos e cobrança | — | — (cotas medidas) | — | ✅ | | | |
| Registro do app na Meta com acesso avançado | iniciado | ✅ obrigatório | | | | | |
| Termos de uso, privacidade, consentimentos publicados | rascunho | ✅ obrigatório | | | | | |
| Rede, parcerias, match, proteção de cliente | — | — | — | — | ✅ | | |
| Módulo incorporadora (espelho, reservas, exceções) | — | — | — | — | ✅ | | |
| Portais imobiliários (feed e leads) | — | — | — | — | — | ✅ | |
| Voz que liga, anúncios pagos, adiantamento de comissão, rede entre instalações, SGR, núcleo | — | — | — | — | — | — | ✅ |

### 15.1 Fase 1 — MVP interno: "telas, funções, permissões e automações prontas"

**Quem usa:** só a equipe interna, em papéis de teste: corretor A, corretor B, cliente comprador de A, cliente de B e camada Plataforma. Dados da semente de demonstração (12.2) mais o que a equipe cadastrar.

**Integrações no MVP:** reais, em modo de desenvolvimento. WhatsApp e Instagram da equipe conectados como testadores do app na Meta (acesso padrão, sem revisão); Canva pela conta Enterprise da plataforma; IA nos slots da plataforma. Nenhuma conta de corretor real é conectada. **Ambiente:** instância intermediária de teste, com a app instalada pelo pacote `.urbiapp.tgz`.

**Entra:**

| Bloco | Conteúdo |
|---|---|
| Conta e acesso | Cadastro do corretor com CRECI opcional (sem verificação, D-93), marca, papéis `dono_conta`, `agente`, `operador_plataforma`, cliente externo por token; **segmentação completa (4.5)** |
| Assistente (A1) | Chat em todas as telas; dúvidas do produto com base nos `docs/` da app; ajuda a decidir; lembretes, tarefas e agendamentos de posts com confirmação |
| CRM e funil | Contatos, negócios, etapas configuráveis, temperatura com motivo, próxima abordagem com playbook semeado, fila do dia, linha do tempo, envios com abertura e clique, tarefas, agenda, visitas, importação CSV, exportação. **1.1:** Funil como visão Quadro de Clientes, Agenda como aba do Início, filtros prontos, resumo em uma frase, **Resumir com IA**, **mensagem sugerida com Fazer agora** e **tarefa com um toque** |
| Imóveis e empreendimentos | Cadastro com fotos primeiro, descrição por IA, qualidade, autorização de venda anexada, empreendimentos cadastrados pelo corretor com materiais. **1.1:** uma tela com abas, grade de cartões, "o que falta" no topo da ficha |
| WhatsApp | Conexão por cadastro incorporado com coexistência; caixa de conversas no app; envio de imóvel, seleção, arquivo, localização, link do portal; modelos básicos; janela de 24 h |
| Mensageiro (A2) | Configuração em 5 passos; texto; responder dúvidas, enviar imóveis, arquivos e seleções, agendar visitas e reuniões, link do portal; cada ação em "pergunta antes" ou "faz sozinho"; passagem com resumo; conversa de teste; custo visível |
| Conteúdo (A4) | Pedido em texto ou voz; gerador do app (D-74) para post, carrossel e story com a marca, mais "Fazer em outra ferramenta" e "Enviar arte pronta" (D-86); legendas; pacote de lançamento; biblioteca de arquivos para baixar quantas vezes quiser; aprovação manual (sem janela, D-86); uma ação principal por estado; **agendar** (mecanismo de 9.8), **publicar agora**, **baixar arquivos** |
| Página | Minha Página por blocos montada pelo Estúdio e editável; ficha pública do imóvel; formulário por webhook. **1.1:** cor da marca única (D-85) |
| Cliente | Portal do Cliente comprador e seleções com reação, no celular. **1.1:** cartões com foto dominante; próximo passo, datas-chave e "o que falta de você" na fase 3. **1.2:** propostas no portal (M5b), por token |
| Negociação (A5, 1.2) | Propostas e contrapropostas com rodadas; mandato por negócio (P16); Negociador IA nos três níveis ("faz sozinho" só no portal) e negociador humano (role `negociador`, com a política multi-usuário); faixa ZOPA; respostas a objeções (Apêndice D); prompt em duas partes (P17, Apêndice C); validações no código (10.9.7); decisão do proprietário registrada pelo corretor; sem WhatsApp (D-107) |
| Padrão B (1.2) | Todas as telas do corretor na moldura de 11.0, com os estados de 11.0.4; menu Hoje · Clientes · Imóveis · Estúdio · Página · Números · Ajustes, rotas antigas como apelidos; busca global e atalhos |
| Números | KPIs da 11.2; **1.1:** quatro números acima da dobra |

**Fica de fora do MVP:** tudo marcado "—" na coluna F1 da 15.0.

**Pronto quando** (roteiros executados pela equipe, com registro):
1. **Telas:** todas as telas do corretor abertas e usadas no computador e no celular; Portal do Cliente e seleção no celular; estados vazio e de erro de cada uma vistos.
2. **Caminhos:** os fluxos de 2.3 e 2.4 percorridos de ponta a ponta sem atalho de desenvolvedor: cadastrar imóvel com fotos, gerar e publicar pacote de lançamento numa conta de teste do Instagram, receber mensagem no WhatsApp de teste, Mensageiro responder e marcar visita, cliente de teste abrir o portal e reagir.
3. **Permissões:** a matriz da seção 14 testada papel por papel; o teste de isolamento de 4.5 passa (corretor B e cliente de B não alcançam nada de A, nem pelo Mensageiro ou pelo Assistente).
4. **Automações:** cada regra (lembrete de visita, publicação agendada, temperatura, próxima abordagem) disparada e conferida, com o atraso real registrado em `pendencias_agendadas`.
5. **Números:** funil e tempo de resposta batem com a conferência manual sobre a semente.
6. **Ajuda:** o Assistente responde corretamente as 30 perguntas mais comuns do roteiro de teste.
7. **Instalação:** a app instala e atualiza na instância intermediária sem reprovação (identidade, pisos, schema, migrações).
8. **Negociação:** as 7 conversas-roteiro de 10.9.9 passam: nenhuma contraproposta abaixo do recuo, nenhum vazamento de recuo, alvo ou BATNA do vendedor (nem no portal, nem nos eventos), passagem correta ao corretor; um negociador humano de teste vê só a negociação atribuída.
9. **Padrão B:** todas as telas de 11.1, 11.3 e 11.5 seguem a moldura de 11.0, com os estados de 11.0.4.

**Estimativa:** 10 a 12 sessões, mais o arco 1.2 (Fase 1.6 do plano: 21 itens). **Se precisar cortar**, nesta ordem: carrossel, importação CSV, nível "faz sozinho" do Negociador (ficam "só sugere" e "pergunta antes"), negociador humano, Portal do Cliente (fica só a seleção). A aprovação por janela saiu de vez em 23/10 (D-86).

### 15.2 Fase 2 — Validação com corretores reais: "MVP validado"

**Pré-requisitos:** app registrado na Meta com verificação da empresa titular e acesso avançado (9.8, item 1); termos de uso, política de privacidade e consentimentos publicados; suporte definido.

**Como:** 3 a 5 corretores reais, cada um com o próprio WhatsApp, Instagram e clientes, por 4 semanas, usando o escopo do MVP. Acompanhamento semanal; ajustes de tela, texto, IA e automação. Entra a importação com **modelos de outros CRMs** (Kenlo, Jetimob, Imobzi, planilha simples; 15.8).

**MVP validado quando:** cada corretor conectou WhatsApp e Instagram sem ajuda da equipe; publicou pelo menos 8 peças; o Mensageiro atendeu clientes reais sem nenhuma ação proibida; o tempo médio de primeira resposta caiu em relação ao início; nenhum incidente de vazamento entre contas; os corretores dizem que continuariam usando.

**Estimativa:** 3 a 4 sessões de ajustes, mais o período de uso.

### 15.3 Fase 3 — "relacionamento completo e proprietário"

Portal do Cliente **proprietário** com entregas, metas do imóvel, visitas com retorno revisado, propostas e comissão combinada, **decisão sobre propostas e aprovação do mandato pelo próprio proprietário** (M7); relatório semanal; propostas com versões. Mensageiro com **áudio**, follow-up e reativação, simulação de financiamento, agente do proprietário. Estúdio com **vídeo**, edição de foto e mobília virtual rotulada, calendário editorial sugerido. Atribuição de conteúdo a visita. **Das referências principais (15.8):** Portal com próximo passo, datas-chave e "o que falta de você" (Compass One); remarketing para a base com cota e pedido de avaliação no Google no pós-atendimento (Lais); descrições em lote e alerta de anúncio parado com sugestão (Kenlo, Lais); comportamento do contato identificado na Minha Página e na seleção, e aviso de imóveis novos compatíveis (Follow Up Boss, Compass One). **Estimativa:** 8 a 10 sessões.

### 15.4 Fase 4 — "equipe, metas e comissões"

Imobiliária com dono, gestor e corretores; fila compartilhada e reatribuição; metas com ritmo; comissões com divisões e recebimentos; Facebook, Instagram Direct e Messenger na mesma caixa; painel do gestor; planos e cobrança (P-11); Portal com a equipe do negócio e contato de cada um (Compass One, 15.8). **Estimativa:** 6 a 7 sessões.

### 15.5 a 15.7 — Fases 5, 6 e 7

Movidas para `specs/horizonte.md` (D-88): rede e incorporadoras, expansão de canais e futuro. A spec descreve as fases 1 a 4. Dos itens das referências, a busca da carteira com mapa fica na fase 6 e o diagnóstico gratuito "quanto vale seu imóvel", na fase 7 (15.8).

### 15.8 Itens incorporados das referências principais

As cinco referências principais (Compass One, Follow Up Boss, Morada.ai, Lais, Kenlo) estão detalhadas em `specs/referencias_principais.md` (D-80). Itens e a fase de cada um, revista em 23/10 (1.1):

| Item | Referência | Fase | Onde |
|---|---|---|---|
| Resumo do contato em um clique; mensagem sugerida com Fazer agora; tarefa com um toque | Follow Up Boss | MVP (1.1) | Ficha do contato, Início |
| Filtros prontos (Novos · Sem contato · Quentes · Retorno vencido) | Follow Up Boss | MVP (1.1) | Clientes |
| Resumo em uma frase no topo da ficha; chips de temperatura, etapa e origem | Lais | MVP (1.1) | Ficha, lista, quadro, fila |
| Cartão de imóvel com nota; foto dominante nas páginas públicas | Kenlo, imagem 1 | MVP (1.1) | Imóveis, seleção, portal, ficha pública |
| IA no lugar onde se trabalha (princípio 13) | Follow Up Boss | MVP (1.1) | Toda tela |
| Etiquetas, origem e status em cada conversa; filtros todas/não lidas/arquivadas | Lais | Bloco 6 | Conversas |
| Imóvel enviado como cartão no WhatsApp (foto, preço, bairro, botão) | Lais | Bloco 6 | Conversas |
| Origem do anúncio gravada a partir da primeira mensagem (dados de referência da Meta) | Morada | Bloco 6 | `origens` |
| Leads por horário em Desempenho | Lais | Bloco 6 | Desempenho |
| Aviso "corretor assumiu" e botão "reativar Mensageiro" | Lais | Bloco 7 | Conversas |
| Resumo do lead em uma frase pelo Mensageiro | Lais | Bloco 7 | Conversas |
| Tabela de créditos por ação de IA (medição) | Kenlo | Bloco 7 (D-87) | Plano e consumo |
| Migração assistida: modelos de importação de outros CRMs | Follow Up Boss, Kenlo | F2 | Clientes › Importar |
| Portal: próximo passo, datas-chave, o que falta de você | Compass One | F3 | Portal do Cliente |
| Remarketing para a base, com cota | Lais | F3 | Mensageiro |
| Pedido de avaliação no Google no pós-atendimento e pós-venda | Lais | F3 | Mensageiro |
| Descrições em lote; alerta de anúncio parado com sugestão | Kenlo, Lais | F3 | Imóveis |
| Comportamento do contato na Minha Página e na seleção | Follow Up Boss | F3 | Ficha do contato |
| Aviso de imóveis novos compatíveis | Compass One | F3 | Portal e WhatsApp |
| Portal: equipe do negócio com contato | Compass One | F4 | Portal do Cliente |
| Busca da carteira com mapa | Kenlo | F6 (era F3) | Imóveis |
| Diagnóstico gratuito "quanto vale seu imóvel" | Morada | F7 (era F6) | Minha Página |
| Listas salvas pelo corretor | Follow Up Boss | **sai**: os filtros prontos bastam | — |
| Treinamento curto e comunidade | Follow Up Boss, Kenlo | **sai da spec**: é tarefa do dono, no plano | — |

### 15.9 O que sai e por quê (1.1, 23/10/2026)

Direção do dono: melhorar funcionalidade e visual sem aumentar a complexidade; retirar e manter só o essencial. Cada linha vira uma issue (`specs/plano_de_implementacao.md`, fase 1.5; guarda-chuva #49, blocos #50 a #62).

| # | Sai | Era (0.1.0) | Passa a ser | Por quê |
|---|---|---|---|---|
| S1 | Tela **Funil** no menu | tela própria | visão Quadro em Clientes (mesmos dados, mesmo arrastar) (D-83) | Duas telas para o mesmo cliente; Follow Up Boss e Kenlo mostram lista e quadro como visões de uma coisa só |
| S2 | Tela **Agenda** no menu | tela própria | aba do Início (D-82) | O Início já lista visitas de hoje e amanhã; a agenda de 14 dias é a continuação natural |
| S3 | **Empreendimentos** no menu | item do grupo Imóveis | aba em Imóveis (D-84) | Secundário para o corretor autônomo |
| S4 | Três telas de **Ajustes** | grupo com 3 itens | uma tela com abas | Configuração é lugar de passagem, não de trabalho |
| S5 | **Aprovação por janela** | ajuste + estado "rascunho agendado" + regras no agendar, cancelar e destravar | sai de vez (ajuste, estados e textos), com migração em dois releases (D-86) | Estado a mais no Estúdio; a 15.1 já listava como primeiro corte; nenhuma das cinco referências tem isso |
| S6 | **Cinco caminhos de arte** (issues #43 a #48) | gerador e Canva IA no código, mais Claude Design, Design da plataforma, CSV e API do Canva propostos | gerador do app + **Fazer em outra ferramenta** + **Enviar arte pronta** (D-86) | Mesmo resultado (um arquivo na peça) com um fluxo só |
| S7 | **Doze botões por peça** no Estúdio | todos visíveis | uma ação principal por estado e menu "mais"; Rejeitar vira Voltar a rascunho; o microfone fica no campo do pedido | Princípio 14 |
| S8 | **Cores da Minha página** (5 temas) e marca em dois lugares | Estúdio › Sua marca e tema da página | uma marca em Ajustes › Marca para Estúdio, Minha página, seleção e portal (D-85) | Uma configuração, quatro superfícies iguais |
| S9 | Ajuste **prazo de primeiro atendimento** | campo sem efeito até o WhatsApp | sai da tela até o bloco 6 | Não mostrar o que não faz nada |
| S10 | **Grade de atalhos** do Início | quatro botões | sai | O menu já faz isso |
| S11 | **Papéis do contato** na tela (investidor, parceiro, fornecedor) | cinco no filtro e no cadastro | tela mostra comprador e proprietário; os outros ficam no dado (fase 5) | Rede é fase 5 |
| S12 | **Consentimento** como seção da ficha | seção própria | uma linha em Dados | Menos seções |
| S13 | "**Atualizar agora**" da Minha página como botão principal | botão visível | menu "mais" | A página já se atualiza sozinha |
| S14 | Da spec: fases 5 a 7, seções 6.8, 6.9 e 11.4, tabelas sem dono | no corpo da spec | `specs/horizonte.md` (D-88) | A spec descreve o produto que queremos |
| S15 | **Listas salvas** (referências, F3) | — | sai: os filtros prontos bastam (D-83) | Mais uma coisa para o corretor manter |
| S16 | **Busca com mapa** (F3) | — | fase 6 | A carteira do autônomo cabe numa lista |
| S17 | **Diagnóstico gratuito** (F6) | — | fase 7 | Isca de captação de incorporadora |
| S18 | **Treinamento e comunidade** (F2) | — | tarefa do dono no plano | Não é software |
| S19 | **Tabela de créditos** no MVP | — | junto com o Mensageiro (D-87) | Medir sem cobrar é ruído |

**Não é visível, mas também sai:** o Web Speech próprio do Estúdio (o `urbi-redator` já tem microfone); o ZIP do pacote de briefing (não há dependência nem API nativa que o monte; a instrução copiável e as fotos para baixar bastam).

## 16. Registro de decisões

| Código | Decisão | Alternativa descartada | Motivo |
|---|---|---|---|
| D-01 | O app tem cadastro próprio de imóveis e unidades; núcleo e estoque de incorporadora são fontes opcionais | Depender do módulo núcleo (D-01 da rodada 1, **revogada**) | Corretores podem ter bancos e instâncias diferentes (correção do dono, 17/10) |
| D-02 | Multi-conta com `conta_id` em toda tabela; serve uma instância compartilhada ou uma instância por cliente | Uma organização só (rodada 1, revogada) | Produto oferecido a qualquer corretor |
| D-03 | Fases da seção 15 (0.3): MVP com CRM e funil com IA, WhatsApp e Mensageiro, Instagram, Minha Página e Portal do Cliente comprador | Seis fases com CRM isolado primeiro (0.2) | Direção do dono em 17/10: o valor está na combinação desde o início |
| D-04 | WhatsApp oficial com coexistência já no MVP; `wa.me` como alternativa | API só numa fase posterior (0.2, revisada) | Relacionamento pelo app é requisito do dono |
| D-05 | Agentes de IA com quatro níveis de autonomia, padrão `supervisionado` | Roteiro fixo (rodada 1, revisada) | Dono quer atendimento em grande parte ou totalmente por IA |
| D-06 | Consumo medido por conta em créditos; preço fora desta spec | Cota bancada pela UP | Produto para qualquer corretor (P-11) |
| D-07 | Proteção de cliente na rede por hash do telefone com validade | Mostrar a outra conta quem é o dono do cliente | Privacidade e vedação de desvio de cliente |
| D-08 | Tempo de primeiro atendimento como métrica central, resposta disparada por evento | Rotina | Rotina é no máximo diária; ganho de conversão está nos primeiros minutos |
| D-09 | Proprietário acessa por token, sem conta; ações por webhook | Conta de usuário | Atrito zero; página pública só GET |
| D-10 | Comissão: percentual combinado + valor estimado no portal; valor gravado no fechamento | Só percentual | Dono pediu comissão na interface com o proprietário |
| D-11 | Slug `portal_corretor`; testes na Pinguim | — | Convenção snake_case; instância de teste existente |
| D-12 | Contato e Negócio separados | Etapa no contato (MVP) | Um contato pode comprar e vender; métricas por oportunidade |
| D-13 | Linha do tempo e auditoria numa tabela `eventos` só de inclusão | Listas dentro de cada registro (MVP) | Uma fonte para funil, auditoria e relatório |
| D-14 | Dinheiro em centavos inteiros; percentuais em fração | Decimal em reais | Sem erro de arredondamento |
| D-15 | Agente nunca cria ou altera proposta, reserva, preço, comissão ou autorização. **Única exceção (1.2):** o Negociador registra contrapropostas apenas dentro do mandato definido pelo corretor e validado no código (10.9.7); aceite final e mandato são sempre do corretor (D-98) | Permitir no nível autônomo | O app não decide pelo corretor (princípio 3) |
| D-16 | Tempo de atendimento em média + faixas | Mediana/percentil | Framework de dados não tem percentil nem mediana |
| D-17 | Conteúdo só publica após checagens legais (10.5). **Revista por D-93 (27/10):** o CRECI deixa de ser checagem e vira aviso; a autorização vigente continua bloqueando | Aviso sem bloqueio | Lei 6.530 (a inscrição no anúncio é responsabilidade do corretor; o app não a impõe, D-93) |
| D-18 | Incorporadora é tipo de conta com módulo próprio | App separado para incorporadoras | O corretor precisa do estoque e da reserva no mesmo lugar onde atende |
| D-19 | Rede nativa na mesma instância, federada entre instâncias depois | Federar desde o início da rede | Reduz risco; P-16 |
| D-20 | Contato importado sem consentimento só recebe modelo de reengajamento | Agente fala livremente | LGPD |
| D-21 | Etapas configuráveis por conta com probabilidade | Etapas fixas do MVP | Imobiliárias têm funis próprios; previsão ponderada |
| D-22 | Ranking público entre corretores continua fora | Gamificação | Decisão do MVP mantida |
| D-23 | Cliente do corretor é usuário externo da conta do corretor, convidado pelo WhatsApp; seleções avulsas e Minha Página continuam públicas sem login (revista na 0.6) | Link com token sem conta | A plataforma isola o externo por conta; o acesso por senha é o do shell **Revista para o MVP por D-56.** |
| D-24 | Corretor tem experiência completa no computador e no celular; cliente é celular primeiro | Corretor só no celular | Análise de funil e conteúdo pede tela grande; atendimento pede celular |
| D-25 | O WhatsApp do relacionamento passa pelo app, conectado por cadastro incorporado com coexistência | Integração por terceiros não oficiais | Histórico, IA e métricas dependem disso; coexistência mantém o aplicativo do corretor |
| D-26 | Instagram primeiro, com conta Business; Facebook e demais redes depois | Todas as redes no MVP | Foco do dono; mesma aprovação da Meta do WhatsApp |
| D-27 | Artes pelo Canva Enterprise **da plataforma**, em nome de cada corretor, com separação interna; motor interno como alternativa (D-35). **Revista por D-74, D-89 e D-105:** fora do MVP | Exigir Canva do corretor | Direção do dono (17/10, 2ª rodada); o corretor não terá Canva Enterprise |
| D-28 | Quatro capacidades de IA (Assistente, Mensageiro, Funil, Estúdio); Mensageiro como produto à parte | Um agente único | Clareza de oferta e de cobrança; o cliente só fala com o Mensageiro |
| D-29 | Permissões do Mensageiro por ação (não faz / pergunta antes / faz sozinho) | Um nível por agente | Corretor escolhe exatamente o que delegar |
| D-30 | Assistente nunca executa sem confirmação | Assistente autônomo | Confiança e segurança |
| D-31 | Corretor cadastra os próprios empreendimentos no MVP | Esperar módulo incorporadora | Corretor vende lançamentos desde o primeiro dia |
| D-32 | MVP para corretor autônomo; equipe na fase 4 | Equipe no MVP | Reduz permissões e telas do MVP |
| D-33 | Envios rastreados (abertura e clique) como base do histórico e da temperatura | Só mensagens | O corretor quer ver o que cada um abriu e clicou |
| D-34 | Três modos de publicação: publicar agora, agendar no app, levar para o Instagram | Só agendamento pelo app | A API do Instagram não agenda; o modo "levar" funciona sempre e usa o agendamento nativo do Instagram |
| D-35 | Motor de arte abstrato: Canva como implementação principal, motor interno como reserva técnica | Acoplar o Estúdio ao Canva | Troca de fornecedor sem refazer o Estúdio |
| D-36 | Landing page continua página pública do app; Canva gera os visuais | Página publicada no Canva | Formulário, WhatsApp rastreado e métricas só funcionam na página do app |
| D-37 | MVP usa as contas de teste da equipe como testadoras do app na Meta (acesso padrão); registro com verificação e revisão iniciado durante o MVP e obrigatório antes da validação | Esperar aprovação para começar o MVP | O MVP não tem corretor real; a revisão leva semanas |
| D-38 | ~~Ação em hora marcada pela melhor opção disponível~~ — substituída pela D-49 | — | — |
| D-39 | Visibilidade padrão `privado` e concessão explícita ao cliente (`itens_cliente`) | Visibilidade por conta apenas | Pedido do dono: corretor não vê imóvel de outro, cliente só vê o que recebeu |
| D-40 | Recurso de outra conta responde "não encontrado" | Responder "sem permissão" | Não revelar existência |
| D-41 | Escopo do MVP aprovado pelo dono em 17/10/2026 (15.1) | — | — |
| D-42 | WhatsApp, Instagram e Facebook são do corretor; ele autoriza o app e pode revogar; a plataforma não tem conta própria para publicar ou atender | Contas da plataforma em nome dos corretores | Direção do dono; o corretor trabalha no nome dele |
| D-43 | MVP = telas, funções, permissões, caminhos e automações testados pela equipe interna, sem corretor real; validação com corretores reais é a fase 2 | MVP já com corretor real | Definição do dono (17/10, 3ª rodada) |
| D-44 | Artes pelo Canva Enterprise da plataforma como serviço prestado ao corretor, sem acesso dele ao Canva. **Revista por D-74, D-89 e D-105:** fora do MVP; a arte é feita fora do app | Exigir aval escrito do Canva antes | Decisão do dono: a plataforma é a produtora do conteúdo |
| D-45 | Toda arte e legenda fica na biblioteca do Estúdio, baixável quantas vezes o corretor quiser | Arquivo só no momento da geração | Permite agendar por fora a qualquer hora |
| D-46 | Contato (lead) e anúncio são dados comerciais da app, no schema da app, segregados por RLS (confirmado pelo dono em 18/10); vínculo opcional a `pessoas` e `imobiliario`; unidades de empreendimento no módulo `imobiliario` | Usar os módulos como cadastro principal | Lead sem CPF; unicidade global de telefone e e-mail no módulo quebraria o isolamento entre corretores; corretor em instância sem o módulo |
| D-47 | Corretor e cliente são usuários externos da conta do corretor, diferenciados por `roles_externos` (`corretor`, `cliente`); toda tabela segregada e restrita | Corretor como colaborador interno | Isolamento por RLS entre corretores; o cliente entra como externo, como o dono pediu **No MVP só o corretor é externo (D-56).** |
| D-48 | Mensageiro responde só em texto; áudio recebido é transcrito (fase 3) | Responder em áudio | A IA da plataforma não oferece voz sintética e proíbe chamar provedor direto |
| D-49 | Agendamentos por `req.eventos.agendar` | Relógio externo ou só rotina | Recurso nativo com precisão de minuto |
| D-50 | IA em chamada única com JSON Schema; o app executa as ações | Agente com uso de ferramentas | Regra da plataforma; trilha clara |
| D-51 | Configuração por conta em tabela; `parametros` só para a instalação | Parâmetros por conta | `parametros` vale para a instalação inteira |
| D-52 | Não implementar ajuda, bug, sugestão e "sobre"; o Assistente usa os `docs/` da app como base | Tela de ajuda própria | A plataforma já oferece o widget |
| D-53 | Um ingresso `wh` por conta, configurado como endereço alternativo do número do corretor na Meta | Um endereço único com tabela de roteamento | A conta vem do próprio ingresso; nenhuma tabela fora do RLS |
| D-54 | Specs ficam em `specs/` na raiz do repositório (fora do pacote); `apps/portal_corretor/docs/` é a documentação da app em produção | Specs dentro de `docs/` da app | O pacote da plataforma exclui `specs/`; `docs/` alimenta a ajuda |
| D-55 | `vitrine_publica` é a única tabela não segregada: só o que o corretor publicou, sem dado pessoal; Minha Página, ficha e seleção leem dela (18/10, revisão contra o SDK 100) | Rota pública lendo tabela segregada | O SDK 100 não oferece caminho: sem conta resolvida o RLS devolve zero linhas e `comConta` só existe em contexto de sistema (P-33) |
| D-56 | Portal do Cliente no MVP por link com token, página pública sem login; ações por `wh` (revisa D-23 para o MVP) | Cliente como usuário externo com login | Como externo, o cliente ficaria preso a um só corretor, enxergaria os eventos da conta e exigiria a política multi-usuário da instância |
| D-57 | Avisos ao corretor pela tela Início e por e-mail | `req.notificacoes` | O shell do externo não mostra notificações (`permissoes.md`); a entrega a externos depende do opt-in "notifica externos" por tipo, ligado pelo admin (`barramento.md`), e pode somar-se depois |
| D-58 | Base do Assistente gerada no build a partir de `apps/portal_corretor/docs/` | Assistente de documentação do shell; tabela de ajuda | A app não tem leitura dos próprios docs em runtime |
| D-59 | WhatsApp espera P-31 e P-32 no SDK publicado; parceiro (caminho B) só por nova decisão do dono | Adotar parceiro já | Decisão do dono |
| D-60 | Canva com conta e credenciais providas pelo dono até o bloco 8; sem elas, o Estúdio começa pelo motor interno (D-35) | Bloquear o bloco 8 | A plataforma não tem integração com o Canva: a app integra por `fetch()` |
| D-61 | Equipe da plataforma (papel `operacao`) tem no `nav` o grupo "Equipe da plataforma › Corretores"; quem só tem `operacao` abre o Início direto nessa tela | Tela de equipe só em `telas_config` | A equipe convida corretores pelo app (provisionamento por convite) e não tem carteira própria |
| D-62 | **Agenda** entra no `nav` do corretor (entre Clientes e Ajustes) já no bloco 2, como lista por dia das atividades pendentes dos próximos 14 dias (19/10, bloco 2). **Revista por D-82 (23/10): vira aba do Início.** | Agenda só dentro do Início e da ficha do contato | Visitas e retornos são o dia a dia do corretor; o Início do bloco 4 continua mostrando as do dia. Lista por dia segue a lacuna de calendário (11.5) |
| D-63 | Imóveis no `nav` como grupo "Imóveis › Minha carteira · Empreendimentos" (Da rede entra na fase 5) — **revista por D-84 (23/10): uma tela com abas**; empreendimento do corretor simplificado (nome, construtora, tipo, fase, local, faixa de preço, tipologias, descrição) com materiais em `empreendimento_materiais`; as tabelas de incorporadora de 6.9 ficam para o módulo (19/10, bloco 3) | Abas dentro de uma tela; já criar `unidades`, `tabelas_preco` etc. | Duas telas com rota própria são mais simples no celular; 11.1 pede para o MVP só o cadastro do próprio corretor |
| D-64 | Documento da autorização de venda é uma `imovel_midias` do tipo `documento` (sempre interna), referenciada por `autorizacoes_venda.documento_midia_id`; `vencida` é calculada na leitura (sem rotina por ora); `visitas` sem `pretendente_id` (o contato vem da atividade) nem `ficha_assinada` (fase 3) (19/10, bloco 3) | Coluna `arquivo` na própria autorização | Coluna `arquivo` não obrigatória expira em 90 dias (TTL da plataforma); a mídia obrigatória vive enquanto a linha viver |
| D-65 | Miniatura de foto nas telas pelo `urbi-avatar` (`foto` + `tamanho`) e prévia pelo `urbi-visualizador-arquivo` — exceção nomeada até existir primitivo de galeria (11.5) (19/10, bloco 3) | CSS próprio de galeria | Telas autenticadas só com primitivos `urbi-*` |
| D-66 | Mídia do imóvel e material do empreendimento são apagados de vez por `PATCH …/remover` (o arquivo vai para a fila de exclusão); imóvel, contato e empreendimento seguem com soft delete (19/10, bloco 3) | Soft delete em `imovel_midias` | Foto apagada não tem uso e ocupa espaço da conta; a rota do app chama `req.dados.deletar`, que leva os anexos para a fila de exclusão na mesma transação (`banco-de-dados.md`, `arquivos.md`) e o `DELETE` HTTP continua só do admin |
| D-67 | Bloco 4 em duas partes: 4a (quadro, temperatura com motivo, playbook, próxima abordagem, fila do dia, rotina diária) e 4b (envios rastreados, números e Desempenho, semente de demonstração). Temperatura por regras explícitas; a leitura da conversa pela IA entra com as conversas (blocos 6–7). Etapas ganham `marco` (atendimento, visitou, proposta…) para os números e o playbook não dependerem do nome (19/10, bloco 4) | Um PR só; IA desde já | Bloco grande demais para um PR revisável; sem conversa não há o que a IA ler |
| D-68 | Envio registrado pelo corretor (ele manda pelo próprio WhatsApp; o app guarda o histórico e prepara a mensagem); o **link rastreado `/l/:codigo` e a contagem de cliques vão para o bloco 5**, com as páginas públicas que são o destino do link (revisa R.2); dados de demonstração gerados pelo corretor de teste no Início (`perfil_conta.demo`, marcado pela semente nas contas "(demo)"), porque a semente do boot não tem usuário para ser o responsável; faixa da semana do Início com leads no lugar de propostas (19/10, bloco 4b) | Link rastreado já no 4b; semente no boot | Sem página pública o link não tem destino; `responsavel_id` é obrigatório e só o request tem usuário |
| D-69 | O primeiro release do app sai como **0.1.0**, só por ordem do dono e quando o MVP (15.1) estiver pronto para teste; até lá a `versao` interna sobe a cada mudança de schema e, no release, volta para 0.1.0 (nenhuma instância instalou versão anterior) (19/10) | Publicar com a versão interna (0.7.0 ou outra) | Pedido do dono: a primeira versão aplicável é a 0.1.0 |
| D-70 | Formulário da página: o handler do `wh` não grava (o `req.dados` dele não serve em app segregada); valida, publica o evento **segregado** `lead_recebido` com nome, telefone, e-mail e mensagem, e o listener grava por `comConta`. O payload leva dado pessoal porque, com o cliente sem login (D-56), só os membros da conta leem os eventos dela; no registro do webhook esses campos são `descartar: true` (19/10) | Evento sem dado pessoal (exigiria gravar antes, impossível no handler) | `wh.md` § Registrar handler; `contas.md` § Modo de conexão; `barramento.md` § Eventos segregados |
| D-71 | Endereços públicos por parâmetro de busca: página `/portal_corretor/p?c=<endereço>`, ficha `…/p?c=<endereço>&i=<código>`, link `/portal_corretor/l?c=<código>` (no lugar de `/p/:corretor`, `/l/:codigo` de 7.2); o diagnóstico do bloco 0 saiu (19/10) | Segmento dinâmico no caminho | O catálogo de páginas públicas é por caminho fixo; a query sempre chega (`window.location.search`) |
| D-72 | Bloco 5 em duas partes: **5a** Minha Página, ficha pública, formulário e link rastreado; **5b** seleções com reação e Portal do Cliente por token (19/10) | Um PR só | Tamanho do bloco; a 5b reusa a vitrine e os webhooks da 5a |
| D-73 | Portal do Cliente e seleção sem login (D-56) com o **token do ingresso `wh` como chave**: a rota pública confere o token com `inspecionarIngressoWh` e lê a vitrine; reação e pedidos vão ao mesmo endereço. Seleção = imóveis ativos/reservados com autorização vigente (não exige estar na Minha Página), que acompanham o anúncio (o que deixa de ser anunciável sai), validade de `validade_selecao_dias`; cliente removido tem portal e seleções revogados. Portal = seleções válidas, agenda de visitas (dia, hora, imóvel), jornada (contagens) e topo do corretor, **sem nome, telefone ou e-mail do cliente** na vitrine; ações do MVP: mensagem e pedido de remarcar (viram linha do tempo e tarefa). Arquivos, proposta e o portal do proprietário ficam para depois (19/10) | `acessos_cliente`/`itens_cliente` com usuário externo (D-23) | D-56; `paginas-publicas.md` (token pelo `wh`, não "login fraco" na URL); D-55 sem dado pessoal |
| D-74 | Artes no MVP: **gerador do app** (motor interno, D-35) é o caminho principal — monta no navegador do corretor, por modelo fixo, com fotos reais, textos e marca (a plataforma não gera imagem, 10.6); **Canva IA assistido**: o app prepara a instrução (regras da marca, textos, selo, rodapé com CRECI) e as fotos, o corretor gera no Canva dele e envia a arte de volta, sem integração. O plano da plataforma é Canva Equipes (sem preenchimento automático, que é do Enterprise); o Canva Connect com modelos de marca (9.4) fica para quando houver Enterprise, e a produção pela equipe da plataforma (D-44) exige acesso às contas, decisão do dono fora do MVP (19/10) | Esperar o Canva Enterprise | Plano Canva Equipes informado pelo dono; D-60 |
| D-75 | Instagram pela **API do Instagram com login do Instagram** (sem página do Facebook): `meta_app_id` em parâmetro e `meta_app_secret` em parâmetro `secret`; token de 60 dias em coluna `segredo` (`canais_sociais`), lido só por `revelar` ao publicar e renovado pela rotina diária `renovar_tokens_instagram`; agendamento com um evento segregado `publicacao_programada` na hora (o contêiner é criado e publicado no disparo, não 1 h antes); a "publicação de teste privada" de 9.2 não existe na API e vira a checagem do tipo de conta (comercial publica stories; criador, posts e carrosséis; pessoal é recusada). App da Meta em modo de desenvolvimento com testadores no MVP (19/10) | Facebook Login com página | Spec 9.2 ("não exige página do Facebook"); `config-app.md`; `banco-de-dados.md` § segredo; `barramento.md` § Agendamento |
| D-76 | Assistente do Corretor (bloco 9): base de ajuda gerada de `docs/` por script (`pnpm ajuda` → `comum/ajuda-gerada.ts`, conferido por teste) e busca por termos, com até 5 trechos no contexto; slot de IA próprio `assistente` (base `normal`); a IA responde por JSON Schema e propõe no máximo uma ação (`criar_atividade` ou `agendar_peca`), que o app confere contra a conta e resume ele mesmo; a ação confirmada roda pelas rotas de sempre (POST /atividades, agendar peça); sem IA, vira busca na ajuda; contato em foco sem telefone e e-mail; voz pelo microfone do `urbi-chat` (slot de áudio da plataforma). **Tela própria no menu, não botão fixo:** o botão flutuante pede CSS estrutural, que o contrato de UI proíbe; a conversa fica em memória entre telas, e a tela anterior vai como contexto (pedido ao shell, item 5). Texto livre de terceiros vai com telefone e e-mail mascarados e marcado como dado; a resposta volta sem imagens nem links. Regras automáticas ("lembrete antes de toda visita") e "mandar seleção" ficam para depois do Mensageiro. **Revista por D-109 (27/10):** o Assistente sai do menu e abre na coluna de contexto da moldura | Base em tabela; IA executando a ação direto | Spec 10.2 e D-58; o SDK não dá leitura dos docs em execução; ação só com confirmação |
| D-77 | Lembrete de visita (bloco 10a): para o corretor, por notificação da plataforma (`ctx.notificacoes.notificar`), N horas antes (`lembrete_visita_horas`, padrão 24, 0 desliga); evento segregado `lembrete_visita` agendado ao criar e ao remarcar, sem guardar o id: o listener confere a visita (pendente, mesma hora, ainda não lembrada). Lembrete ao cliente fica para o WhatsApp (blocos 6 e 7) | Regra configurável pelo Assistente; cancelar o agendamento a cada remarcação | Spec 15.1 item 4; sem WhatsApp não há canal com o cliente |
| D-78 | Release **0.1.0** = MVP interno **sem WhatsApp e sem Mensageiro** (blocos 6 e 7): eles dependem de P-31/P-32, que o SDK 100 não atende, e a alternativa do parceiro da Meta exige decisão do dono, que mandou seguir pelo caminho mais simples. Entram numa versão seguinte, quando o shell atender os pedidos 1 e 2 ou o dono decidir pelo parceiro. Os critérios 2 e 4 da 15.1 ficam parciais e registrados no R.8; a tabela de conferência `pendencias_agendadas` (6.15) também fica para depois (o atraso se anota à mão no R.8); a versão interna 0.12.0 volta a 0.1.0 (D-69) (19/10) | Esperar o WhatsApp para o primeiro release | Ordem do dono (19/10): terminar o MVP pelo caminho mais simples, fazer o merge e esperar a ordem do release |
| D-79 | Quem atende várias contas (o admin do app, por exemplo) trabalha numa conta de cada vez: a ativa, escolhida no seletor e enviada em `X-Conta`. O app recusa com `400 CONTA_NAO_INFORMADA` a chamada sem ela (leitura inclusive, exceto `/equipe` e `/status`), porque ler sem conta ativa misturaria contas; `req.dados` passa a enxergar só a conta ativa nas tabelas segregadas. Com uma conta só nada muda. | Isolamento; decidido na revisão do PR #36 |
| D-80 | Compass One, Follow Up Boss, Morada.ai, Lais e Kenlo são as referências principais de tela, funcionalidade e automação (`specs/referencias_principais.md`); o app copia um padrão de cada uma (2.7); itens e fases em 15.8 (18/10, confirmada em 23/10) | Referências difusas | Escolha do dono |
| D-81 | Menu do corretor com oito itens: Início · Clientes · Imóveis · Estúdio · Minha página · Desempenho · Assistente · Ajustes; Conversas entra com o bloco 6; as rotas antigas viram apelidos no mapa de telas, porque o SDK não redireciona (23/10). **Revista por D-103 (27/10):** nomes do Padrão B e Assistente fora do menu | Treze entradas (0.1.0) | Uma tela por pergunta (princípio 14); no celular o menu é um dropdown |
| D-82 | Agenda é aba do Início, não tela do menu (revê D-62) (23/10) | Tela própria | O Início já é o dia; a lista de 14 dias é a continuação |
| D-83 | Funil é a visão Quadro de Clientes e a tela Funil sai do menu; filtros prontos (Novos · Sem contato · Quentes · Retorno vencido) no lugar de listas salvas (23/10) | Tela própria; listas salvas (F3) | Lista e quadro são duas visões do mesmo cliente (Follow Up Boss, Kenlo) |
| D-84 | Imóveis é uma tela com abas Carteira · Empreendimentos (revê D-63); carteira em grade de cartões; foto dominante só nas páginas públicas até o shell oferecer cartão com capa (pedido ao shell 7) (23/10). **Revista por D-106 (27/10):** na moldura, a carteira vira lista com miniatura | Duas entradas no menu; foto dominante em toda tela | O `urbi-card` do SDK 100 não aceita imagem e a tela não escreve CSS |
| D-85 | Marca única em Ajustes › Marca (logo, cor principal, cor de apoio, foto, assinatura) alimenta Estúdio, Minha página, seleção e portal; a escolha de tema da Minha página sai da tela (a coluna fica, aditiva; migração leva a cor do tema para a marca) (23/10) | Marca no Estúdio e tema na página | Uma configuração, quatro superfícies iguais |
| D-86 | Estúdio com um caminho principal (gerador do app, D-74) mais "Fazer em outra ferramenta" (instrução e fotos para qualquer editor: Canva, Claude Design, outro; sem ZIP) e "Enviar arte pronta"; cada peça com uma ação principal por estado e menu "mais"; **sem aprovação por janela** (ajuste, estados e textos saem; migração em dois releases pela doutrina do SDK); consolida #43 a #48: #44 e #45 entram aqui, #46 não é planejada, #47 e #48 ficam adiadas para depois da fase 2 (23/10) | Cinco caminhos de arte; aprovação por janela | Mesmo resultado com um fluxo só; nenhuma das cinco referências tem janela; a 15.1 já a listava como primeiro corte |
| D-87 | Tabela de créditos por ação de IA entra junto com o Mensageiro (bloco 7), em Plano e consumo, não antes (23/10) | Medição já no MVP | Hoje só há slots incluídos no plano; medir sem cobrar é ruído |
| D-88 | Fases 5 a 7, seções 6.8, 6.9 e 11.4 e as tabelas sem dono (`templates_arte`, `fila_render`, `canva_vinculos`, `regras_publicacao`, `protecoes_cliente`, `ajuda_produto`) saem da spec para `specs/horizonte.md`, na íntegra; voltam quando a fase chegar (23/10) | Tudo na spec | A spec descreve o produto que queremos (fases 1 a 4) |
| D-89 | Estúdio (revê D-86 e o CRECI de 10.5): a **arte só é gerada fora do app**, no Canva IA por padrão (ou em outra ferramenta, por "Usar outra ferramenta"); no app ficam só os textos e a instrução (prompt), com as fotos e o logo para anexar, à vista na peça, e o envio da arte na própria peça, com área de arrastar. O gerador do app sai (peças antigas com arte dele continuam válidas). **O CRECI não trava nada**: sem cadastro, a aprovação e a publicação seguem, com um lembrete; story com arte do Canva é publicado pela API (26/10) | Manter o gerador do app como caminho principal e o CRECI como pendência da aprovação | Ordem do dono (26/10): trazer a imagem gerada no Canva de volta era confuso, e o CRECI não pode impedir o uso no período de testes |
| D-90 | Estúdio com as referências principais (D-80, revê o texto de D-89): o que o app entrega é uma **descrição** da arte (o nome da tela troca "instrução" por "descrição"), curta e em blocos fixos — o que é e o tamanho, **textos da arte** exatos, **fotos**, **slides** (carrossel), **visual**, referências e **não faça** — para colar no Canva IA sem a ferramenta adivinhar; peças em **listas por etapa** (Todas · Falta a arte · Para aprovar · Prontas para publicar · Agendadas · Publicadas, com contagem) e o **próximo passo** escrito em cada peça; o CRECI sem cadastro sai do aviso no topo e vira uma linha da dica do cartão Criar (26/10) | Instrução em parágrafo corrido; lista única; aviso de CRECI no topo | Ordem do dono (26/10): o foco do Estúdio é a descrição clara para o Canva, e o CRECI não pode parecer impedimento. Listas por etapa e próximo passo: Follow Up Boss (listas inteligentes) e Compass One (passos do marketing) |
| D-91 | A descrição da arte para o Canva IA (e outras ferramentas) é **mista**: instruções em inglês (blocos TEXT ON THE ART, PHOTOS, SLIDES, VISUAL, STYLE REFERENCES, DO NOT) e o texto que vai na arte em português do Brasil, entre aspas, com o pedido de não traduzir nem acrescentar; é o padrão, sem ajuste na tela. Legenda, textos da peça e tela seguem em português (26/10) | Tudo em português; tudo em inglês; opção por corretor | Ordem do dono (26/10). Ferramentas de IA seguem instrução em inglês com mais precisão; o Canva IA entende português desde a expansão a 16 idiomas, mas a antiga ajuda do Magic Design dizia "só inglês". Tudo em inglês faria o Canva escrever a arte em inglês. Uma opção na tela seria configuração que o corretor não sabe avaliar (princípio 13) |
| D-92 | A **ficha do contato** passa a duas colunas (`urbi-2x1 largura="largo"`), no desenho da ficha de pessoa do Follow Up Boss: à esquerda o cliente (chips, motivo e último contato, WhatsApp, Ligar, E-mail; cadastro e consentimento no detalhe), o **Próximo passo** (abordagem, passo combinado, Mensagem sugerida, Virar tarefa), negócios, agenda e seleções com a lista à mostra; à direita o **Histórico** (Registrar contato, Registrar envio, Resumir) e **Enviados ao cliente**. Sai o resumo em uma frase e as seções recolhidas com linha de resumo; pedido do dono: tela "mais simples" (27/10) | Topo com frase e sete seções recolhidas (1.1) | O resumo corrido misturava quatro informações numa linha e as seções escondiam o conteúdo atrás de "1 aberto(s) de 1" |
| D-93 | **CRECI é dado básico e opcional do perfil, nunca bloqueio.** Nenhuma ação depende dele: cadastro, conexões, publicação, artes, Página, Mensageiro e Negociador funcionam sem CRECI. Onde faltar, aviso discreto "Adicione seu CRECI ao perfil para que ele apareça nos anúncios", com atalho para o perfil. Com CRECI, ele aparece nas artes, na página e na assinatura; sem, não aparece. Não existe tela nem estado de "CRECI em verificação"; sai o erro `CRECI_AUSENTE`; `creci_situacao` (P-12) fica só como dado. Revê D-17, o princípio 7 e as checagens de 10.5 (27/10) | CRECI obrigatório e verificado | Decisão do dono (27/10): o CRECI não pode impedir o uso do app |
| D-94 | **O Negociador não precisa de CRECI.** O padrão é o Negociador IA; o negociador humano (role `negociador`) é opcional e o convite dele não pede CRECI. Encerra a P-40 (27/10) | Exigir CRECI do negociador humano que não é o próprio corretor (proposta da P-40) | Decisão do dono (27/10); coerente com D-93 |
| D-95 | **Padrão B** (moldura com trilho e três colunas: lista, foco, contexto) é o padrão oficial de todas as telas do corretor; guia em `specs/telas_padrao_b.md` e mockups em `specs/telas/`; onde divergem da spec, vale a spec (19/10 no insumo; adotada em 27/10) | Direções A (painel de comando) e C (fila guiada) | Escolha do dono sobre o canvas de design; um molde só para quem implementa e para quem usa |
| D-96 | Funil, Lista e Negociações são visões dentro de Clientes; Mensageiro, Negociador, Conexões, Conta e marca e Plano ficam em Ajustes | Itens próprios no menu | Menu do dia a dia curto; configuração fica onde se configura |
| D-97 | Novo papel **Negociador**, exercido por IA (slot `negociador`) ou por humano (role externo `negociador`), dentro de um **mandato** por negócio | Negociação só pelo corretor | Pedido do dono: respostas específicas na etapa de negociação com base em BATNA, ZOPA e tratamento de objeções |
| D-98 | O Negociador nunca aceita acordo final, nunca vai abaixo do ponto de recuo, nunca revela recuo, alvo ou BATNA do vendedor; tudo validado **no código** (10.9.7) | Confiar nas instruções do modelo | Proteger o vendedor e o corretor; regra da plataforma de a app executar as ações |
| D-99 | "Faz sozinho dentro da faixa" exige autorização do proprietário registrada no mandato (forma em P-41) | Autonomia sem registro | Responsabilidade do corretor perante o proprietário |
| D-100 | Propostas, contrapropostas, mandato e Negociador (IA e humano) entram no MVP; a decisão do proprietário pelo portal fica na fase 3 (no MVP o corretor registra) | Tudo de negociação na fase 3 | O MVP testa telas, funções e automações; a negociação é o momento de maior valor do funil |
| D-101 | Prompt do Negociador em duas partes: regras fixas da plataforma + instruções editáveis do corretor; respostas a objeções editáveis por categoria (Apêndices C e D) | Prompt livre | Simplicidade para o corretor e segurança das regras |
| D-102 | Faixa ZOPA como componente visual de P15 (régua com recuo, alvo, pedido, oferta e teto estimado); lacuna de UI até haver primitivo (pedido ao shell 13) | Só números em lista | O corretor entende a negociação num olhar; referência da imagem do dono |
| D-103 | Menu com os nomes do Padrão B: **Hoje · Clientes · Imóveis · Estúdio · Página · Números · Ajustes**, mais Conversas quando o WhatsApp chegar; as rotas antigas (Início, Desempenho, Minha página, Funil, Agenda, Assistente) ficam como apelidos; revê D-81 nos nomes (27/10, coordenação, vetável pelo dono) | Manter os nomes da 1.1 | Um vocabulário só entre mockups, spec e tela; o SDK não redireciona, por isso os apelidos |
| D-104 | No Padrão B, o **Portal do Cliente segue por link com token** (D-56, D-73): M4, M5 e M5b são páginas públicas e as ações entram pelo `wh` com o token; não existe role `cliente` com login no MVP (27/10, coordenação, vetável) | Login com role `cliente`, como nos mockups | Pelo SDK, o externo pertence a uma conta só e o RLS não gradua dentro da conta |
| D-105 | **Estúdio de D-89 a D-91 dentro da moldura:** arte feita fora do app (Canva IA ou outra ferramenta), sem aprovação por janela (D-86), sem listas salvas, sem Canva Enterprise nem preenchimento automático (27/10, coordenação, vetável) | Estúdio do mockup P08 (Canva com autofill e janela) | O mockup é anterior a D-86 e D-89 |
| D-106 | **Ficha do contato de D-92 dentro da moldura**, ocupando o centro e a direita; a carteira de imóveis vira **lista com miniatura** na coluna esquerda (P06), revendo a grade de D-84 (27/10, coordenação, vetável) | Ficha só no centro; grade de cartões | A ficha de duas colunas já é a decisão do dono; a moldura reserva a esquerda para lista |
| D-107 | **Negociador sem WhatsApp** enquanto P-31/P-32 não forem atendidas: as ofertas entram registradas pelo corretor ou pelo portal (token); a contraproposta sai pelo portal ou por "Fazer agora" (`wa.me`); "faz sozinho" só age no canal do portal (27/10, coordenação, vetável) | Esperar o WhatsApp | O WhatsApp segue bloqueado no SDK 100 (D-59, D-78) |
| D-108 | O **negociador humano** entra por último no arco 1.2 e exige a política "permite contas multi-usuário" ligada na instância; desligada, o app oferece só o Negociador IA (27/10, coordenação, vetável) | Negociador humano desde o início | `contas.md`: com a política desligada, o segundo externo da conta é recusado |
| D-109 | O **Assistente** sai do menu e abre na **coluna de contexto** da moldura, a partir do botão do trilho, mantendo lista e item; revê D-76 na forma (o resto de D-76 vale) (27/10, coordenação, vetável) | Tela própria no menu (D-76) | A coluna é do primitivo `urbi-3-colunas`, sem CSS estrutural, que era o motivo de D-76 |

## 17. Pendências

| Código | Pendência | Bloqueia |
|---|---|---|
| P-01 | Frameworks lidos pelo resumo de 18/10/2026; a implementação confere no SDK instalado os itens [plataforma] e define os pisos | Início da fase 1 |
| P-02 | Nome e acesso ao repositório do app; abrir a issue (Apêndice A) | Commit da spec |
| P-03 | Prazo de proteção de cliente na rede (proposto 90 dias) | Fase 5 |
| P-04 | Prazo-alvo de primeiro atendimento (proposto 5 min) | Fase 1 |
| P-05 | Horário de execução da rotina semanal | Fase 3 |
| P-06 | ~~Webhook aciona agente em segundos~~ — resolvido: `wh` publica evento, `reagir` processa (9.8 item 3); restam P-31 a P-33 | — |
| P-07 | ~~Modelo de instância~~ — resolvido: contas da plataforma, um corretor por conta (4.4) | — |
| P-08 | Provedor de vídeo e de edição de imagem; custo por vídeo | Fase 3 |
| P-09 | Revisão do app na Meta (WhatsApp e Instagram) concluída, conforme o caminho de P-26 | Fase 2 |
| P-10 | Controlador dos dados do comprador: a conta que atende (proposto) | Fase 1 |
| P-11 | Planos, preço e cota de créditos | Fase 1 (cotas), fase 4 (cobrança) |
| P-12 | ~~Verificação de CRECI: manual com documento, ou consulta por regional~~ — **encerrada por D-93:** o app não verifica; `creci_situacao` fica só como dado opcional | — |
| P-13 | Núcleo UP/Urbitá como fonte de unidades: formato e acesso | Fase 7 |
| P-14 | Diretoria como papel separado na incorporadora | Fase 5 |
| P-15 | Prazo de retenção por inatividade (proposto 24 meses) | Fase 1 |
| P-16 | Rede entre instâncias: protocolo e confiança | Fase 7 |
| P-17 | Entrada de leads de portais | Fase 6 |
| P-18 | Provedor de assinatura eletrônica | Fase 6 |
| P-19 | Acesso da camada Plataforma a dados de uma conta para suporte: regra e registro | Fase 1 |
| P-20 | Acesso do cliente sem senha (link mágico): o shell oferece ou vai oferecer? | Fase 2 |
| P-21 | Domínio próprio para a Minha Página | Fase 6 |
| P-22 | ~~Ação em hora marcada~~ — resolvido por `req.eventos.agendar` (D-49) | — |
| P-23 | "Editar no Canva" na conta do próprio corretor (integração pública): escopo | Fase 3 |
| P-24 | ~~Voz sintética~~ — encerrada: a plataforma não oferece; só transcrição (D-48) | — |
| P-25 | Preço do Mensageiro e cota incluída por plano | Fase 1 (comunicação), fase 4 (cobrança) |
| P-26 | **Dúvida do dono:** caminho A, B ou C do registro do app na Meta e, se A, qual empresa registra (9.0). Não bloqueia o MVP | Fase 2 |
| P-27 | ~~Aval escrito do Canva~~ — decidido pelo dono (D-44). Manter apenas a leitura periódica dos termos do Canva | — |
| P-28 | ~~Relógio externo~~ — encerrada: desnecessário com `agendar` | — |
| P-29 | Parceiro de soluções da Meta (só se o registro próprio não for o caminho) e custo dele | Fase 2 |
| P-30 | A plataforma serve HTML exportado do Canva como página pública? | Fase 6 |
| P-31 | Shell: `wh` responder o `GET` de verificação da Meta (`specs/pedidos_ao_shell.md`, item 1) | **MVP, bloco 6** — **conferido no SDK 100: não existe** (plano, R.1) |
| P-32 | Shell: handler `wh` recebe corpo cru e cabeçalhos (`specs/pedidos_ao_shell.md`, item 2) | **MVP, bloco 6** — **conferido no SDK 100: não existe** (plano, R.1) |
| P-33 | Confirmar no SDK: handler `wh` lê o contexto do ingresso (conta); listener grava com `dados.comConta`; rota pública lê tabelas segregadas (senão `vitrine_publica`) (`specs/pedidos_ao_shell.md`, item 3) | MVP, blocos 0 e 5 — **conferido no SDK 100** (plano, R.1): contexto e evento segregado sim; rota pública não → `vitrine_publica` (D-55) |
| P-34 | ~~Contato e anúncio como dados da app~~ — confirmado pelo dono em 18/10 | — |
| P-35 | Corretor que entra numa imobiliária (externo pertence a uma conta só) — tratar só na fase 4 | Fase 4 |
| P-36 | Frontend da app pode abrir o cadastro incorporado hospedado da Meta e o OAuth do Instagram por redirecionamento e receber o retorno numa sub-rota da app? | MVP — em parte: a sub-rota vem do path e a query se lê em `window.location.search` (`overview.md` § Navegação SPA); o redirecionamento da Meta é testado no bloco 0 (plano, R.6) |
| P-37 | Prévia de link (Open Graph) das páginas públicas: o SDK 100 monta a página no navegador e não oferece metadados por página | Fase 2 |
| P-38 | Endereço direto de um artigo da documentação da app (o SDK documenta só `/{appId}/docs`): o Assistente abre a documentação e diz o nome do artigo; confirmar o formato do link direto e se o corretor (externo, shell reduzido) alcança `/{appId}/docs` na instância | MVP, bloco 10 (roteiro na instância) |
| P-39 | Canal de suporte para o corretor (externo não vê "Reportar bug" no shell reduzido): para onde o Assistente manda quando não sabe responder (`specs/pedidos_ao_shell.md`, item 5) | MVP, bloco 10 — hoje: "fale com a equipe da plataforma" |
| P-40 | ~~O negociador humano convidado precisa de CRECI?~~ — **encerrada por D-94:** não precisa (pendência do insumo de 27/10) | — |
| P-41 | Forma de registrar a autorização do proprietário para "faz sozinho" (anexo assinado, mensagem registrada, aceite no portal na fase 3) (era a P-38 do insumo de 27/10) | MVP, arco 1.2 (D2/D3) |
| P-42 | Estilo padrão do Negociador (cooperativo) e textos finais do Apêndice D revisados por um especialista em vendas imobiliárias (era a P-39 do insumo de 27/10) | Fase 2 |

**Pendência do insumo de 27/10 resolvida sem número:** a P-37 do insumo ("o frontend recebe eventos em tempo real ou atualiza periodicamente?") fecha pelo stream SSE do barramento (`barramento.md`, § SSE); a P-37 desta spec continua sendo a da prévia de link.

**Soluções das dependências do MVP:** seção 9.8 (Meta, hora marcada, webhook, chamadas externas) e 9.4 (Canva).

## 18. Testes e critério global de pronto

Por fase: testes de API para toda rota (papel certo passa, papel errado recebe 403, recurso de outra conta responde "não encontrado"); testes de rotina rodando duas vezes no mesmo período sem duplicar; teste de vazamento (parceiro, proprietário e página pública nunca recebem dado de proprietário, comprador, comissão interna); teste de fórmula para cada KPI de 11.2 contra planilha calculada à mão a partir da semente; teste de agente com conversas-roteiro (lead quente, pedido de desconto, pede humano, ofensa, fora do horário, consentimento revogado) verificando passagens e ações proibidas; teste de checagens legais de conteúdo; **teste de negociação** (10.9.9) com verificação automática de piso, passo, rodadas e sigilo em toda mensagem do Negociador, e de que nenhum valor do mandato chega ao portal, à vitrine ou aos eventos; teste de isolamento do role `negociador` (só as negociações atribuídas).

Toda funcionalidade nova entra com seu texto em `docs/` da app (ajuda da plataforma e base do Assistente). Toda tela do corretor é verificada no computador e no celular; toda superfície do cliente, primeiro no celular.

Critério global: alguém que nunca falou com o dono implementa cada fase só com esta spec e os docs da plataforma; nenhuma rota sem tela e nenhuma tela sem rota; todo número na tela tem fonte, período e fórmula; ausência é frase; nada referencia capacidade do SDK sem o piso citado (P-01). Quando uma fase vira código, o conteúdo dela sai daqui e migra para `docs/` da app.

## 19. Glossário

**Autorização de venda**: documento em que o proprietário autoriza o corretor a anunciar e vender, com prazo, preço e comissão. **Captação**: conquista de um imóvel para a carteira. **Conta**: tenant do app. **Coorte**: conjunto de negócios criados no mesmo período, acompanhados até o fim. **Entrega**: compromisso do corretor com o proprietário. **Espelho**: mapa de unidades com o estado de cada uma. **Janela de 24 h**: período após a última mensagem do cliente em que o WhatsApp permite texto livre. **Lista de espera**: pedido de aviso quando uma unidade volta a ficar disponível. **Passagem**: transferência da conversa do agente para o humano. **Previsão ponderada**: comissão esperada considerando a probabilidade de cada etapa. **Primeiro atendimento**: tempo entre a primeira mensagem do lead e a primeira resposta. **Seleção**: lista de imóveis enviada a um cliente por link. **VGV**: valor geral de vendas.

**Negociação (1.2):** **BATNA**: a melhor alternativa de uma parte caso a negociação não chegue a acordo (o "plano B"). **ZOPA**: zona de possível acordo, entre o ponto de recuo do vendedor e o teto do comprador. **Ponto de recuo**: o valor a partir do qual a melhor opção é sair da negociação e ficar com a BATNA. **Âncora**: o primeiro valor apresentado, que orienta a conversa. **Mandato**: os limites e as concessões que o corretor autoriza o Negociador a usar num negócio. **Contrapartida**: o que se pede em troca de uma concessão. **Moldura**: a estrutura comum das telas do Padrão B (trilho e três colunas).

---

## Anexo R. Referências de mercado

O que as referências pesquisadas em 17/10/2026 mostram e onde isso entrou na spec.

**R1 · Velocidade de resposta.** Estudo MIT/InsideSales (2007): responder em 5 min torna a qualificação do lead muitas vezes mais provável do que em 30 min. Estudo WAV Group/Weichert (2014): tempo médio de resposta de corretores de cerca de 15 h. Auditoria de 2024 com 74 corretoras americanas: menos de 1 em 10 respondeu em 5 min. No Brasil, levantamento citado da Morada.ai com incorporadoras: primeiro contato em cerca de 5 h e quase metade dos leads sem resposta (fonte secundária). → Princípio 9, D-08, agente `sdr`, cronômetro do Início, KPI de primeiro atendimento.

**R2 · Quem chega primeiro e indicação.** NAR, Profile of Home Buyers and Sellers 2025: a maioria dos compradores entrevista um único corretor; indicação e relacionamento anterior são a principal forma de encontrar corretor, sobretudo entre vendedores. → Agentes `pos_venda` e `reativacao`, rotina `pos_venda`, pedido de indicação.

**R3 · CRMs internacionais.** Follow Up Boss: planos de ação automáticos, listas inteligentes, reatribuição automática de lead não contatado, "pond" de leads compartilhados (help.followupboss.com). Lofty/Chime: site com busca integrada ao CRM, planos inteligentes com mensagem automática nos primeiros minutos, assistente de IA. Homebot: relatório periódico de valorização para clientes antigos, abertura mensal alta, aviso quando ex-cliente põe o imóvel à venda (homebot.ai). → Níveis de autonomia, passagens, relatório anual de valorização, nutrição.

**R4 · Brasil.** Facilita/Sienge: fila de distribuição de leads entre corretores, espelho horizontal e vertical, programa de pontos. CV CRM/Sienge: nota de qualificação do lead, simulador de proposta pela tabela, aviso quando a unidade volta ao mercado (sienge.com.br/blog). DWV: tabelas, materiais e disponibilidade de lançamentos para corretores. Kenlo, Jetimob, Imobzi (referências do MVP): CRM, site, integração com portais, rede de parcerias. → Nota de qualificação (6.12), lista de espera (6.9), módulo Incorporadora, Rede.

**R5 · Economia do corretor e do canal.** Cofeci/DataZAP 2025: cerca de 650 mil corretores no Brasil, poucas transações por corretor por ano em comparação com os EUA, tempo de venda muito maior e renda média baixa (paraibabusiness.com.br). WhatsApp Business Platform: cobrança por mensagem desde 01/07/2025; contas novas no Brasil faturadas em BRL desde julho/2026 (developers.facebook.com); mensagem de utilidade da ordem de centavos de real (fonte secundária). → Princípio 10, consumo por conta, categoria de cobrança gravada em cada mensagem, modo `rascunho` ao atingir cota.

**R6 · Regras legais.** Lei 6.530/78, art. 20: vedado anunciar sem autorização escrita e sem o número de inscrição (creci-sc.gov.br). Código de Ética, Res. COFECI 326/92: vedado desviar cliente e aceitar transação entregue a outro corretor sem ciência escrita (legisweb.com.br). LGPD. → 9.7, D-07, D-17, D-20, 6.14.

**R7 · Referências principais (18/10, D-80).** Compass One (painel do cliente com linha do tempo, datas-chave, tarefas e documentos; o corretor controla o que o cliente vê), Follow Up Boss (listas inteligentes, planos de ação, resumos, tarefas e mensagens sugeridas, IA incluída no plano), Morada.ai (IA que qualifica em segundos, agenda e atualiza o CRM; copiloto do corretor; painéis por canal), Lais (caixa do WhatsApp com etiquetas, origem, status e resumo; "fulano assumiu a conversa" e "reativar"; app Casa da Lais) e Kenlo (LYA com créditos por ação, funil visual, descrições por IA, mais de 100 portais). Detalhe em `specs/referencias_principais.md`; o que entrou e em que fase, em 15.8; o que saiu, em 15.9.

**R8 · Negociação (1.2).** Fisher, Ury e Patton, *Como Chegar ao Sim* (Harvard Negotiation Project), origem do conceito de BATNA e dos princípios de focar interesses, criar opções e usar critérios objetivos. Grupo LU, "BATNA, ZOPA e Ponto de Recuo: os 3 conceitos fundamentais para qualquer negociador" (https://grupolu.com/batna-zopa-e-ponto-de-recuo/), com o exemplo de João e Maria e a imagem da régua de negociação enviada pelo dono. Chris Voss, *Negocie Como Se Sua Vida Dependesse Disso* (empatia tática, perguntas abertas). Robert Cialdini, *As Armas da Persuasão* (reciprocidade, prova social; usados só com fatos verdadeiros). Tversky e Kahneman (efeito de ancoragem). → 10.9, P15–P17, Apêndices C e D. (No insumo de 27/10 esta referência era a R7; a R7 desta spec já era a das referências principais.)

**Lacunas do MVP cobertas por estas referências:** cronômetro e reatribuição do primeiro atendimento; lista de espera de unidade; relacionamento pós-venda; simulador pela tabela (fase 6, na proposta); ficha de visita; CRECI no perfil (sem verificação pelo app, D-93); importação de contatos; custo por origem.

## Apêndice A. Texto da issue

**Título:** Spec do app Portal do Corretor (`portal_corretor`)

**Contexto.** O MVP (laboratório Urbiverso UP/Urbitá v2) validou o fluxo do corretor e do canal comercial. O dono consolidou a visão em 17/10/2026: escritório digital do corretor no computador e no celular, com CRM e funil com IA, WhatsApp pelo app com o Mensageiro (texto; áudio recebido transcrito na fase 3), Assistente do Corretor, Estúdio de Conteúdo com publicação no Instagram, Minha Página e Portal do Cliente como usuário externo; rede, proprietário, metas e comissões nas fases seguintes; independente do núcleo.

**O que precisa ser feito.** Manter `specs/portal_corretor.md` cobrindo as 19 seções do roteiro de spec, com decisões `D-nn` e pendências `P-nn`.

**Critérios de aceite.** Fase 1 implementável só com a spec e os docs; todo KPI com fonte, período e fórmula; toda afirmação de plataforma conferida nos docs com versão citada; nenhuma rota sem tela.

**Notas técnicas.** Multi-conta; restrições de rotina, página pública, geometria e agregados aplicadas (seção 4.3); P-01 bloqueia a fase 1.

## Apêndice B. Implementação

As instruções permanentes das sessões estão em `CLAUDE.md` (raiz do repositório) e a ordem de trabalho, com o status de cada bloco, em `specs/plano_de_implementacao.md`. Os ajustes necessários no shell estão em `specs/pedidos_ao_shell.md`. A forma das telas do Padrão B está em `specs/telas_padrao_b.md` e nos mockups de `specs/telas/` (referência visual; onde divergem, vale a seção 11).

## Apêndice C. Prompt padrão do Negociador

A parte 1 é fixa, vive no código da app e sempre vem antes (D-101). A parte 2 é o modelo editável: a equipe da plataforma mantém o padrão em `telas_config.prompt_negociador_padrao`, e ele é copiado para `config_negociador.instrucoes_corretor` quando o corretor liga o Negociador; o corretor edita em P17. `{{creci_corretor}}` vira " (CRECI <número>)" quando o perfil tem CRECI e some quando não tem (D-93).

**Parte 1 — regras fixas da plataforma (não editáveis)**

```
Você é o Negociador do corretor {{nome_corretor}}{{creci_corretor}}. Você negocia a venda do imóvel {{imovel_titulo}} em nome do vendedor, com honestidade e respeito ao comprador.

Objetivo: chegar a um acordo bom para as duas partes, o mais perto possível do ALVO, nunca abaixo do PONTO DE RECUO.

Regras que você nunca quebra:
1. Nunca revele o PONTO DE RECUO, o ALVO nem a BATNA DO VENDEDOR, nem dê pistas sobre eles ("ele aceita um pouco menos"). Se perguntarem "qual o mínimo?", responda que você trabalha com propostas concretas e peça a do comprador.
2. Nunca invente outro comprador, outra proposta, prazo ou urgência que não estejam no contexto.
3. Nunca aceite um acordo final: quando houver concordância, resuma as condições e diga que vai confirmar com o vendedor.
4. Toda concessão vem com uma contrapartida da lista do mandato. Prefira conceder condições a preço.
5. Conceda devagar e cada vez menos; nunca divida a diferença automaticamente.
6. Use critérios objetivos: comparáveis, R$/m², diferenciais do imóvel, condição de pagamento.
7. Não fale de comissão, de jurídico ou de crédito bancário além de sugerir simulação.
8. Seja breve (até 3 frases por mensagem), cordial e em português do Brasil.
9. Se a oferta estiver abaixo do PONTO DE RECUO, se o comprador quiser algo fora do mandato, se houver agressividade, se não houver ZOPA ou se ele pedir uma pessoa: passe ao corretor.
10. Responda apenas no formato JSON pedido.
```

**Parte 2 — instruções do corretor (modelo editável)**

```
Estilo: cooperativo. Trate o comprador pelo primeiro nome.
Comece reconhecendo o interesse dele no imóvel e reforçando dois diferenciais concretos antes de falar de valor.
Diante de pedido de desconto: pergunte o que pesa mais (valor total, entrada ou prazo) antes de propor qualquer coisa.
Primeira concessão preferida: prazo de entrega ou itens que ficam no imóvel. Preço só a partir da segunda rodada.
Sempre que fizer uma contraproposta, dê validade de 48 horas e proponha o próximo passo (visita, ligação ou simulação).
Se o comprador estiver com financiamento aprovado, valorize isso e proponha fechar em até 7 dias como contrapartida.
```

## Apêndice D. Respostas a objeções (padrão)

Cada linha é semeada em `playbook_objecoes` e pode ser editada pelo corretor em P17. Os exemplos são pontos de partida; o Negociador adapta ao imóvel e à conversa.

| Categoria | O que o cliente diz | Pergunta para explorar | Resposta com critério objetivo | Próximo passo / concessão possível |
|---|---|---|---|---|
| Preço | "Está caro." | "Comparando com o quê? O que você esperava pagar?" | Comparáveis da região e R$/m²; diferenciais que justificam o valor | Pedir a proposta dele; oferecer condição (prazo, itens) antes de preço |
| Pensar | "Vou pensar." | "Claro. O que ainda falta para você decidir?" | Resumir o que ele disse que gostou; esclarecer a dúvida real | Compromisso pequeno: nova visita, simulação ou conversa em data marcada |
| Mais barato | "Vi um parecido mais barato." | "Qual? Posso comparar com você." | Comparar ponto a ponto (área, estado, localização, custos fixos) | Se a comparação for justa, levar ao vendedor; nunca desmerecer o outro imóvel |
| Localização | "É longe do meu trabalho." | "Quanto tempo de deslocamento seria aceitável?" | Tempos reais, acessos, serviços do bairro | Mostrar alternativa da carteira se a objeção for decisiva |
| Estado do imóvel | "Vai precisar de reforma." | "O que você mudaria primeiro?" | Estimativa de custo e o que está em bom estado | Concessão com contrapartida (ex.: abatimento parcial ↔ fechar rápido) |
| Financiamento | "Não sei se o banco aprova." | "Você já fez alguma simulação?" | Explicar o caminho; sem prometer aprovação | Simulação e indicação de correspondente; seguir quando houver carta de crédito |
| Decisão compartilhada | "Preciso falar com minha esposa." | "O que ela vai querer saber?" | Preparar o resumo do imóvel e das condições para os dois | Visita conjunta ou ligação com os dois |
| Prazo | "Só posso mudar em seis meses." | "O que acontece em seis meses?" | Mostrar se o vendedor tem flexibilidade de entrega | Concessão de prazo ↔ entrada maior ou preço mais próximo do alvo |
| Custos fixos | "O condomínio é alto." | "O que pesa no seu orçamento mensal?" | O que o condomínio inclui; comparação com a região | Considerar no valor total da proposta |
| Documentação | "Tem alguma pendência?" | "O que você gostaria de ver?" | Lista de documentos disponíveis | Passar ao corretor para detalhes jurídicos |
