# Spec — Portal do Corretor (`portal_corretor`)

> Arquivo: `specs/portal_corretor.md`. Instruções de sessão em `CLAUDE.md`; ordem e status em `specs/plano_de_implementacao.md`; ajustes do shell em `specs/pedidos_ao_shell.md`.

## 1. Status e convenções

| Campo | Valor |
|---|---|
| Status | **1.1 — pronta para implementação.** Padrão B oficial nas telas (D-56) e novo papel **Negociador** (D-58). Escopo do MVP aprovado (D-41) e ampliado com negociação (D-61); MVP interno sem corretor real (D-43). Implementação guiada por `CLAUDE.md` e `specs/plano_de_implementacao.md` |
| Issue | A abrir no repositório do app na primeira sessão (texto no Apêndice A) |
| Slug / schema | `portal_corretor` (snake_case, vira o schema PostgreSQL) |
| Instância-alvo | Pinguim (teste). Produção: qualquer instância que instale o app (D-02) |
| Base | MVP "Portal do Corretor · laboratório Urbiverso UP/Urbitá" v2; `specs/stack_funcional.md`; `specs/referencias.md`; direção do dono em 17/10/2026 (duas rodadas) |
| Piso de shell / SDK | Proposto `shell_min: "0.56.25"`, `sdk_min: 94` (4.1); confirmar na implementação |
| Data | 19/10/2026 |

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
| **Clientes do corretor** | Comprador, proprietário | **Usuário externo** por link enviado pelo WhatsApp, sem instalar nada (D-23) | Só o que é dele: imóveis enviados, visitas, documentos, conversa, andamento; o proprietário vê o imóvel dele | Outros clientes, notas internas, comissão interna, dados do outro lado da negociação |
| **Parceiros** | Corretores de outras contas, incorporadoras | Usuário da plataforma em outra conta, ou externo | O negócio ou o imóvel compartilhado | Clientes e proprietários do outro |

### 2.3 Visão do corretor

**Onde usa:** computador para organizar, analisar o funil e montar conteúdo; celular para atender, registrar visita, aprovar peça e responder o cliente. As duas experiências são completas: nada essencial existe só em uma delas (D-24).

**O dia dele no app:**
1. Abre **Hoje** (P01): o que precisa dele agora (conversas que o Mensageiro ou o Negociador passaram, clientes quentes, visitas do dia, retornos vencidos, peças aguardando aprovação).
2. Responde e atende em **Conversas** (P02), o WhatsApp dentro do app, com o Mensageiro ajudando ou atendendo por ele.
3. Olha **Clientes › Funil** (P03): onde cada cliente está, quem esfriou, o que cada um abriu e clicou, e a **próxima abordagem** sugerida pela IA.
3a. Acompanha **Clientes › Negociações** (P15): propostas e contrapropostas conduzidas pelo Negociador (IA ou pessoa) dentro do mandato que ele definiu.
4. Cadastra imóvel ou empreendimento com fotos (P07); no **Estúdio** (P08) o app gera artes e agenda a publicação no **Instagram**.
5. Manda ao cliente, com um toque, uma **seleção**, um arquivo ou o link do **Portal do Cliente**.
6. Pergunta ao **Assistente** qualquer coisa sobre o app ("como faço para…", "o que eu posso oferecer para esse proprietário?", "configura um lembrete automático para visitas").
7. Ajusta a **Página** (P09) quando quiser.

**O que ele configura uma vez (em Ajustes):** perfil e CRECI, marca (logo, cores, foto), conexão do WhatsApp, conexão do Instagram, o Mensageiro e o Negociador (se contratar), a página.

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
| **A5 · Negociador** | Clientes do corretor na etapa de negociação | Responde objeções, recebe propostas, sugere e envia contrapropostas dentro do mandato (BATNA, ZOPA, ponto de recuo), leva o acordo à decisão; pode ser **IA ou pessoa** (10.9) | Produto à parte junto com o Mensageiro (P-11); papel humano incluído |

### 2.6 Princípios

Herdados do MVP:
1. Cada tela responde "o que eu faço agora?".
2. Celular primeiro; para o cliente, celular sempre.
3. O app nunca decide pelo corretor o que é dele decidir: preço, desconto, proposta, reserva, comissão.
4. Dado de uma pessoa nunca vaza para outra.
5. Número sem fonte não vai para a tela; ausência é frase, não zero.
6. Tudo que um agente faz é rastreável: quem, quando, por quê, quanto custou.
7. Regra legal é regra de produto: autorização escrita para anunciar, CRECI em todo anúncio, ciência do titular em parceria com exclusividade (seção 9.7).

Da plataforma (roteiro do dono): UI e API andam juntas; a app nunca escreve SQL; agente não-humano é usuário de primeira classe; o nome da pasta é o schema.

Desta spec:
8. **Independência de estoque:** cadastro próprio de imóveis e empreendimentos; núcleo e incorporadoras como fontes opcionais (D-01).
9. **Velocidade de resposta é métrica de produto.**
10. **Custo visível:** toda ação que gasta crédito mostra custo antes e depois.
11. **Menor fricção possível:** toda conexão (WhatsApp, Instagram) em até 3 passos, toda configuração com padrão pronto, todo cadastro aceitando foto e voz.
12. **O WhatsApp do relacionamento passa pelo app:** é no app que fica o histórico, a IA e as métricas (D-25).
13. **IA no lugar onde se trabalha:** a IA aparece como botão na tela certa (resumir, sugerir mensagem, criar tarefa, gerar arte), não como um chat que o corretor precisa aprender a usar; o Assistente serve para dúvidas e pedidos livres (referência: Follow Up Boss).

### 2.7 Referências visuais escolhidas pelo dono

Das imagens mostradas em 17/10, o dono escolheu três:
- **Imagem 1 — conceito de app imobiliário para celular** (projeto de comunidade no Figma, não é um produto específico): cartões de imóvel grandes com foto dominante, preço e atributos em ícones, navegação inferior, busca no topo. **Uso:** modelo da experiência do cliente no celular (seleção e Portal do Cliente) e da carteira do corretor no celular.
- **Imagens 4 e 5 — Compass One** (painel do cliente da Compass, EUA): o cliente entra num painel único conectado ao corretor, com a jornada em etapas, o que já aconteceu e o que vem, documentos e conversa, antes, durante e depois do negócio. **Uso:** modelo do Portal do Cliente (comprador e proprietário) e da linha do tempo que o cliente vê.

Os detalhes visuais (componentes, cores, espaçamento) seguem os catálogos de UI do UrbiVerso (P-01); estas referências definem estrutura e hierarquia, não estilo.

### 2.8 Mapa de referências por seção

Para cada parte do app, a referência de mercado ou de método de onde ela foi tirada. Detalhes em `specs/referencias_principais.md` e `specs/referencias.md`.

| Parte do app | Seção | Referência principal | O que foi aproveitado |
|---|---|---|---|
| Padrão de telas (trilho + três colunas) | 11.0 | Lais, Kommo | Conversa no centro, contexto ao lado, IA e humano no mesmo número |
| Hoje e fila do dia | 11.1 P01 | Compass One, Follow Up Boss | Um cartão por ação; listas do dia por regra |
| Conversas | 11.1 P02, 10.3 | Lais, Kommo, Kenlo | Assumir e reativar a IA; origem e status; corretor vê só os seus |
| Funil e listas salvas | 11.1 P03, 10.4 | Follow Up Boss, Kenlo | Quadro, listas por regra, resumo e tarefa com um clique |
| Ficha do cliente e linha do tempo | 11.1 P04 | Follow Up Boss | Histórico único de tudo que aconteceu e foi enviado |
| Assistente do Corretor | 10.2, P05 | Real Brokerage (Leo), Follow Up Boss | Assistente interno; IA sem prompt no fluxo |
| Mensageiro | 10.3, P11 | Lais, Morada | Resposta em segundos, agendamento, tom de voz da marca, passagem |
| Negociador, mandato, faixa ZOPA | 10.9, P15–P17 | Fisher, Ury e Patton (*Como Chegar ao Sim*); Grupo LU (BATNA, ZOPA e ponto de recuo); Voss; Cialdini | BATNA, ZOPA, ponto de recuo; concessões com contrapartida; tratamento de objeções |
| Imóveis e qualidade do anúncio | 11.1 P06–P07 | Kenlo | Nota de qualidade, descrição por IA, carteira |
| Estúdio e publicação | 10.5, 9.2, 9.4, P08 | Rechat, Luxury Presence, Canva | Campanha pronta ao ativar imóvel; aprovação por janela; artes por modelo |
| Minha Página | P09 | Luxury Presence | Site do corretor montado e mantido pela IA |
| Números | 11.2, P10 | Follow Up Boss, Morada, Lais | Relatórios por origem, retorno por canal, leads por horário |
| Créditos por ação | P13 | Kenlo | Créditos por recurso de IA |
| Importação | 12.1, P14 | Follow Up Boss, Kenlo | Migração assistida |
| Portal do Cliente | 11.3 | Compass One | Painel do cliente, próximo passo, jornada, o que falta de você |
| Portal do Proprietário (fase 3) | 11.3 M7 | Compass One, ShowingTime | Engajamento do anúncio; retorno de visita revisado antes de publicar |
| Conexão do WhatsApp | 9.0, 9.1, P12 | Meta (cadastro incorporado com coexistência) | Manter o número no celular |
| Rede e parcerias (fase 5) | 6.8 | Homer, Rechat (rede), Apto | Match comprador × imóvel, termo digital, comissão visível |
| Incorporadora (fase 5) | 6.9, 11.4 | CV CRM, Facilita, DWV | Espelho, reserva com fila, simulador pela tabela |
| Regras legais | 9.7, 10.9.6 | Lei 6.530/78, Código de Ética do COFECI, CDC, LGPD | Autorização, CRECI, lealdade nas informações, consentimento |

## 3. O que existe hoje e o que muda

### 3.1 Peça a peça

| Peça no MVP | Situação no MVP | Na spec |
|---|---|---|
| Início ("o que fazer agora") | Demonstrado | Mantido. Ganha cronômetro de primeiro atendimento e fila de passagens dos agentes |
| Clientes (compradores e proprietários, etapas, linha do tempo) | Demonstrado | Mantido e separado em Contato + Negócio. Funil configurável por conta |
| Captação em 3 passos | Demonstrado | Mantida |
| Imóveis da carteira, qualidade 0–100 | Demonstrado | Mantido. Qualidade passa a exigir fotos reais e CRECI |
| Página do corretor por blocos | Demonstrado | Mantida, com formulário por webhook (página pública só faz GET) |
| Seleções com reações | Demonstrado | Mantidas, reações por webhook |
| Relatório semanal ao proprietário, radar | Demonstrado / Simulado | Viram o Portal do Proprietário com entregas, metas e comissão |
| Conversas, assistente 24 h por roteiro | Simulado | WhatsApp oficial + agentes de IA com níveis de autonomia |
| Divulgação (peças, anúncio impulsionado) | Ilustrado | Estúdio de conteúdo: post, carrossel, story, vídeo, publicação automática e calendário |
| Parcerias e comissão | Demonstrado | Viram a Rede: conexões, compartilhamento automático, parcerias com divisão |
| Vitrine, tabela versionada, espelho, reservas com fila, exceções (canal UP) | Demonstrado | Módulo "Incorporadora", usado por qualquer conta do tipo incorporadora (UP/Urbitá é a primeira) |
| Habilitação de corretores, autorizações (comercial UP) | Demonstrado | Credenciamento na rede da incorporadora + verificação de CRECI |
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

Build com esbuild (frontend ESM com `@urbiverso/ui` externo; backend self-contained), empacote `portal_corretor-<versao>.urbiapp.tgz`, release pela ferramenta do SDK, instalação em Admin › Instaláveis › Apps. **Teste na instância intermediária** (não na de desenvolvimento). Pisos iniciais propostos: `sdk_min: 94`, `shell_min: "0.56.25"` (rotas pessoais, `incrementar`, `destinatarios`, `formato`/`intervalo`); a implementação ajusta ao que realmente usar.

### 4.2 Frameworks usados

| Framework | Uso no app |
|---|---|
| Dados (`schema.json`, `req.dados`) | Todas as tabelas, **todas** `segregada_por_conta: true` e `acesso_externo: "restrito"` (acesso só por rotas próprias); `soft_delete` nas de negócio; `busca_texto` em contatos e anúncios; `sql_declarado` para o funil por coorte |
| Usuários, permissões, contas | Corretor e clientes como usuários **externos** da conta do corretor, diferenciados por `roles_externos`; equipe da plataforma como usuários internos com `roles` (4.4) |
| Arquivos (coluna `arquivo`, `req.arquivos`) | Fotos, vídeos, documentos, artes; upload em 2 passos; download por rota própria com `req.arquivos.url` |
| Barramento (`req.eventos`, `reagir`) | Todos os eventos da seção 13, `segregado_por_conta: true`; **`agendar`** para tudo que tem hora marcada (publicação, lembrete, vencimento) |
| Notificações | `req.notificacoes.notificar` ao corretor (inbox e push) |
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
| `nav` até 20 itens e 2 níveis; no celular, o menu fica no dropdown do nome da app | Atalhos do dia a dia ficam na própria tela Hoje, não numa barra própria |
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
| Cliente do corretor (comprador, proprietário) | `externo` | A **mesma** conta do corretor que o convidou | role externo `cliente` (perfil comprador/proprietário em dado) |
| Negociador humano (sócio, especialista, o próprio corretor em outra pessoa) | `externo` | A conta do corretor que o convidou | role externo `negociador`: só as negociações atribuídas (11.6, 14) |
| Equipe da plataforma (operação, suporte) | interno (`colaborador`) | — | roles de equipe `operacao` e `suporte`; `suporte` com `acesso_irrestrito` só quando autorizado (P-19) |
| Admin da app | interno com nível `admin` | — | Config, Lixeira, IA, Webhooks, Rotinas |

Manifesto: `aceita_externos: true`, `permissao_padrao_externo: "escrita"`, `roles_externos.escrita: { corretor, cliente, negociador }`, `provisiona_externos.papel_externo: "corretor"` (o corretor convida os próprios clientes) e `provisiona_externos.papel: "operacao"` (a equipe convida corretores). Toda rota decide por `rolesApp` e escopa por `usuario.id`; nunca por `tipo` ou `natureza`.

**Como o cliente entra (D-23 revista):** o corretor envia pelo WhatsApp o convite da plataforma; o cliente cria o acesso no primeiro clique (e-mail e senha, conforme o shell) e passa a ver o **Portal do Cliente** como tela da app, no celular. Seleções avulsas e a Minha Página continuam como páginas públicas sem login (11.3). Se o shell vier a oferecer acesso por link mágico, o atrito some (P-20).

**Fase 4 (equipe):** imobiliária = uma conta com vários corretores; um externo pertence a uma conta só, então corretor que muda de imobiliária é tratado na fase 4 (P-35).

### 4.5 Segmentação e isolamento (regra inegociável)

Vários corretores usam o mesmo app, cada um com seus imóveis e seus clientes. **Ninguém vê o que não é seu, e o cliente só vê o que o corretor dele escolheu mostrar.**

| Camada | Como se garante |
|---|---|
| Entre corretores | **Proibição absoluta, garantida pelo banco:** cada corretor é uma conta; todas as tabelas `segregada_por_conta: true` → RLS forçado no PostgreSQL. Nenhuma rota, listener, rotina ou IA consegue ler ou gravar linha de outra conta, nem por erro de código. Nenhuma tabela da app fica fora do regime |
| Corretor × cliente na mesma conta | Toda tabela `acesso_externo: "restrito"` (sem CRUD genérico); rotas próprias: role `corretor` lê a conta, role `cliente` lê **só** o que está em `itens_cliente` com o `usuario.id` dele |
| Entre clientes do mesmo corretor | Mesmo filtro por `usuario.id` em `itens_cliente` |
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

Esboço do conteúdo. A forma exata é a do SDK instalado; a implementação escreve o `manifesto.json` a partir daqui.

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
                 "cliente": "Cliente do corretor: vê só o que recebeu",
                 "negociador": "Negociador: conduz as negociações atribuídas, dentro do mandato" }
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

Corretor, nesta ordem: **Hoje · Conversas · Clientes · Imóveis · Estúdio · Página · Números · Ajustes** (8 itens). Dentro de **Clientes**, as visões Funil · Lista · Negociações; dentro de **Ajustes**, Mensageiro · Negociador · Conexões · Conta e marca · Plano e créditos · Funil e abordagens · Horário de atendimento · Privacidade. **Criar** e **Assistente** são botões fixos do trilho (11.0.1). O shell injeta Home e Configurações. Itens das fases seguintes (Proprietários, Rede, Equipe) entram como visões dentro de Clientes ou Imóveis, não como itens novos, até o limite de clareza do trilho.

Negociador humano (role `negociador`): **Hoje · Negociações · Conversas** (só as atribuídas).

Cliente (role `cliente`): só **Meu atendimento** (Portal do Cliente).

### 5.2 Parâmetros da instalação

| Parâmetro | Tipo | Observação |
|---|---|---|
| `meta_app_id` | string | App registrado na Meta (titular em P-26) |
| `meta_app_secret` | string `secret` | Validação de assinatura dos webhooks e troca de tokens |
| `meta_config_cadastro_whatsapp` | string | Configuração do cadastro incorporado |
| `canva_client_id` / `canva_client_secret` | string / `secret` | Integração Canva da plataforma |
| `canva_pasta_raiz` | string | Pasta raiz das contas no Canva |
| `prazo_primeiro_atendimento_min` | numero | Padrão 5 |
| `cota_mensal_ia_padrao`, `cota_mensal_artes_padrao` | numero | Cotas por conta até haver planos |

Configuração **por conta** (horário de atendimento, dias para cliente parado, validade de seleção, modo de aprovação de conteúdo, autonomia do Mensageiro) fica na tabela `configuracoes_conta`, editada pelo corretor em Ajustes.

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
| creci | texto | sim para corretor | `corretores.creci` | Formato `UF-nnnnn-F/J` |
| creci_situacao | enum `nao_verificado`/`verificado`/`irregular` | sim | `corretores.habilitacao` | P-12 |
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

**`protecoes_cliente`** — registro de "cliente apresentado" para disputas na rede: `contato_hash` (hash do telefone normalizado, nunca o telefone), `conta_id`, `membro_id`, `imovel_id` (opcional), `valido_ate`. Só a existência e a validade são consultáveis por outra conta, nunca o dono (P-03).

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

**`marcas`** — kit visual por membro/conta: `cores`, `fontes`, `logotipo_id`, `assinatura` (texto com CRECI, obrigatória), `tom_de_voz`, `hashtags_padrao`. Origem: `paginas`.

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
| checagens | json | — | **derivado** | CRECI presente, autorização vigente, rótulo de IA, tamanho por canal (10.5) |
| link_rastreado | texto | sim | novo | Código curto por peça, mede cliques e leads |

**`canais_sociais`**: `rede` (`instagram`/`facebook`/`tiktok`/`youtube`/`linkedin`/`google_perfil`), `conta_externa`, `credencial_ref`, `estado`, `escopos`. 

**`publicacoes`**: `peca_id`, `canal_social_id` ou `destino` (`pagina`/`portal:<nome>`/`rede`), `agendada_para`, `publicada_em`, `id_externo`, `url_externa`, `estado` (`agendada`/`enviando`/`publicada`/`falhou`/`removida`), `erro`, `metricas` (json atualizado pela rotina diária: alcance, impressões, curtidas, comentários, salvamentos, compartilhamentos, visualizações de vídeo).

**`regras_publicacao`** — publicação automática: `gatilho` (`imovel_ativado`/`preco_reduzido`/`imovel_vendido`/`visita_aberta`/`calendario`), `tipos_peca`, `canais`, `aprovacao` (`manual`/`automatica`), `ativo`. É o que "divulga automaticamente".

### 6.8 Rede

**`conexoes`** (entre contas): `conta_a`, `conta_b`, `tipo` (`corretor`/`imobiliaria`/`incorporadora`/`fornecedor`), `estado` (`convite`/`ativa`/`recusada`/`bloqueada`), `convidada_em`, `aceita_em`.
**`grupos_rede`**: `dono_conta_id`, `nome`, `regras` (json: regiões, tipos, faixa de preço), `membros` (lista conta). Ex.: "Corretores do Grande Colorado".
**`compartilhamentos`**: `imovel_id`, `destino` (`conexao`/`grupo`/`rede_aberta`), `destino_id`, `divisao_pct_parceiro` (decimal, sobre a comissão), `mensagem`, `ativo_ate`. Só se `autorizacoes_venda.permite_parceria`.
**`parcerias`** (L `PA-nnnn`): `imovel_id`, `conta_captadora`, `conta_vendedora`, `negocio_id` (do lado vendedor), `divisao` (json `{captador: 0,5, vendedor: 0,5}`), `estado` (`proposta`/`aceita`/`recusada`/`encerrada`), `ciencia_titular_id` (arquivo; obrigatório se exclusiva — 9.7), `termo_id` (arquivo). Origem: `parcerias`.
**`perfis_rede`** (AE sim): cartão público do membro: nome, foto, CRECI, regiões, especialidades, imóveis compartilhados (contagem), avaliações de parceria (1–5, só após parceria encerrada).

### 6.9 Incorporadora (módulo; herdado do canal UP do MVP)

**`empreendimentos`** (S, AE sim por classificação): `nome`, `tipo` (`loteamento`/`vertical`/`horizontal`), `fase` (`lancamento`/`obras`/`pronto`), `cidade`, `regiao`, `descricao`, `materiais` (via `materiais`), `prazo_reserva_horas`, `alcada_desconto_pct`, `max_parcelas`, `entrada_min_pct`, `fonte_unidades` (`app`/`importacao`/`nucleo` — P-13). Origem: `empreendimentos`, `empreendimento`.
**`unidades`**: `empreendimento_id`, `codigo` (ex. `Q1-03`), `agrupador` (quadra/torre), `area_m2`, `geometria` (GeoJSON em json), `posicao_esquema` (json para o SVG), `estado` (`disponivel`/`reservada`/`vendida`/`bloqueada`), `estado_desde`. Origem: `lotes` (36 no seed, 3 quadras).
**`tabelas_preco`**: `empreendimento_id`, `versao`, `estado` (`rascunho`/`vigente`/`substituida`), `vigente_desde`, `publicada_por`. **`tabela_itens`**: `tabela_id`, `unidade_id`, `preco_c`, `condicoes` (json). Origem: `tabelas` (4 versões).
**`credenciamentos`**: `empreendimento_id`, `conta_corretor_id`, `membro_id`, `estado` (`solicitado`/`habilitado`/`suspenso`), `pode_anunciar` (booleano), `decidido_por`. Origem: habilitação e autorizações do MVP.
**`reservas`** (L `R-nnnn`): `unidade_id`, `negocio_id`, `membro_id`, `pedida_em`, `confirmada_em`, `vence_em` (= confirmada + prazo), `estado` (`pedida`/`ativa`/`vencida`/`convertida`/`cancelada`; `vencida` calculado na leitura quando `vence_em < agora`), `posicao_fila` (0 = titular). Origem: `reservas`.
**`listas_espera`**: `unidade_id` ou critério (json), `membro_id`, `contato_id`, `criada_em`, `avisado_em`. Aviso quando a unidade volta a `disponivel`.
**`excecoes`** (L `E-nnnn`): `proposta_id`, `tipo` (`desconto`/`parcelas`/`entrada`/`prazo`/`outro`), `desvio`, `justificativa`, `nivel` (`comercial`/`diretoria`, derivado da alçada), `estado` (`pendente`/`aprovada`/`recusada`), `decidido_por`, `decidido_em`.
**`materiais`** (AE conforme): `empreendimento_id`, `arquivo_id`, `classificacao` (`publico`/`corretores`/`interno`), `versao`, `substitui_id`.

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
| Qualidade do anúncio (0–100) | Fotos públicas ≥ 8 (25) + descrição ≥ 400 caracteres (15) + preço informado (15) + área e cômodos (10) + localização (10) + autorização vigente (15) + CRECI na página (10). Sem autorização vigente o anúncio não publica, independentemente da nota |
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
| tema | enum dos temas permitidos | sim | novo | Dentro do que a página pública aceita (sem tokens de tema; cores como dado) |
| blocos | json | sim | `paginas.blocos` | Ordem e conteúdo: apresentação, destaques, imóveis, empreendimentos, depoimentos, sobre, bairros atendidos, formulário, WhatsApp, Instagram |
| seo | json | não | novo | Título, descrição, imagem de compartilhamento |
| publicada_em | data-hora | não | | |
| gerada_por_ia | booleano | sim | novo | Primeira versão montada pelo Estúdio |

**`templates_arte`** — modelos do Estúdio de Conteúdo.

| Coluna | Tipo | Obr. | Observação |
|---|---|---|---|
| formato | enum `post_1x1`/`post_4x5`/`carrossel`/`story_9x16`/`reels_9x16`/`capa` | sim | |
| objetivo | enum (6.7) | sim | Novo imóvel, baixou o preço, vendido… |
| camadas | json | sim | Foto principal, preço, bairro, área, quartos, logo, foto e CRECI do corretor, selo, chamada |
| motor | enum `interno`/`provedor`/`canva` | sim | D-27 |
| ref_externa | texto | não | Id do template no provedor |
| ativo | booleano | sim | |

**`assistente_conversas`** e **`assistente_mensagens`** — o chat do corretor com o Assistente (A1): `membro_id`, `tela_origem`, `pergunta`, `resposta`, `fontes` (artigos de ajuda usados), `acao_proposta` (json), `acao_confirmada_em`, `util` (polegar), `creditos`.

**`ajuda_produto`** — opcional: índice da documentação da app (`docs/`) usado pelo Assistente para citar a fonte e levar à tela certa; o conteúdo em si é o de `docs/`, o mesmo do widget de ajuda da plataforma (D-52).

**`itens_cliente`** (AE sim por token) — concessão explícita do que cada cliente vê (4.5).

| Coluna | Tipo | Obr. | Observação |
|---|---|---|---|
| acesso_cliente_id | ref | sim | |
| tipo | enum `imovel`/`empreendimento`/`selecao`/`arquivo`/`visita`/`reuniao`/`proposta`/`relatorio`/`entrega` | sim | |
| alvo_id | uuid | sim | |
| concedido_por | ref membro ou agente | sim | |
| concedido_em, revogado_em | data-hora | sim, não | Revogar some do portal na hora |

Índice único (`acesso_cliente_id`, `tipo`, `alvo_id`). Todo envio ao cliente (`envios`) cria a concessão correspondente.

**`canva_vinculos`** — separação por conta dentro da conta Canva da plataforma: `conta_id`, `pasta_canva_id`, `tipo` (`upload`/`design`), `id_canva`, `peca_id`, `criado_em`, `apagado_em`. O app só opera ids presentes aqui para a conta em questão.

**`fila_render`**: `conta_id`, `peca_id`, `motor`, `prioridade` (`agendada`/`aprovada`/`rascunho`), `estado` (`na_fila`/`processando`/`pronta`/`erro`), `tentativas`, `erro`, `pronta_em`.

**`pendencias_agendadas`** — conferência dos agendamentos feitos com `req.eventos.agendar` (publicação, lembrete, vencimento): `tipo`, `alvo_id`, `agendamento_id`, `executar_em`, `executado_em`, `atraso_seg`. A rotina diária usa para recuperar o que falhou.

**`visibilidade`** acrescentada a `imoveis`, `empreendimentos` e `contatos`: enum `privado` (padrão) / `equipe` / `rede` / `publico`.

**Alterações em tabelas da 0.2:** `agentes` ganha `config_mensageiro` (json do assistente de configuração, 10.3), `voz` (`texto`/`texto_e_audio`), `permissoes_acao` (json: por ação, `nao`/`perguntar`/`sim`); `canais_mensagem` ganha `modo` (`coexistencia`/`api_exclusiva`), `estado_sincronizacao`, `nota_qualidade`; `canais_sociais` ganha `tipo_conta` (`business`/`creator`), `token_expira_em`; `publicacoes` ganha `container_id` e `container_expira_em` (Instagram, 9.2); `visitas` ganha `feedback_publicado_em` (revisão antes do proprietário).

### 6.16 Negociação (novo, 1.1)

**`negociacoes`** (S, L `NG-nnnn`) — uma por negócio em negociação.

| Coluna | Tipo | Obr. | Observação |
|---|---|---|---|
| negocio_id, anuncio_id, contato_id | ref | sim | |
| estado | enum `ativa`/`aguardando_cliente`/`aguardando_corretor`/`aguardando_proprietario`/`ganha`/`perdida`/`pausada` | sim | |
| conduzida_por | enum `ia`/`humano`/`corretor` | sim | |
| negociador_usuario_id | ref `shell.usuarios` | quando humano | |
| mandato_id | ref | não | Sem mandato, o Negociador só sugere |
| teto_estimado_comprador_c | inteiro | não | Última estimativa; com `fonte_estimativa` (texto) |
| batna_estimada_comprador | texto | não | |
| valor_final_c | inteiro | quando ganha | |
| motivo_perda | enum (6.2) | quando perdida | |
| rodadas | inteiro | sim | Materializado a cada proposta |

**`mandatos_negociacao`** (S; **sigiloso**: nunca vai a rota do cliente nem a exportação do cliente).

| Coluna | Tipo | Obr. | Observação |
|---|---|---|---|
| negociacao_id | ref | sim | Um vigente por negociação; versões anteriores ficam (histórico) |
| preco_pedido_c, alvo_c, recuo_c | inteiro | sim | Validação recuo ≤ alvo ≤ pedido |
| batna_vendedor | texto | não | Sigiloso |
| concessoes | json | sim | Lista `{item, limite, contrapartida}` |
| passo_max_pct | decimal | sim | Padrão 0,40 do intervalo restante |
| rodadas_max | inteiro | sim | Padrão 4 |
| validade | data | sim | |
| autonomia | enum `sugere`/`pergunta_antes`/`faz_sozinho` | sim | |
| autorizacao_proprietario | json | quando `faz_sozinho` | `{tipo: anexo|mensagem, arquivo_id, data}` |
| versao | inteiro | sim | |

**`propostas`** (6.4) ganha: `negociacao_id`, `rodada` (inteiro), `direcao` (`comprador`/`vendedor`/`proprietario`), `autor_tipo` (`cliente`/`corretor`/`negociador_ia`/`negociador_humano`/`proprietario`), `concessao` (json), `contrapartida` (json), `validade_ate` (datahora), `canal` (`whatsapp`/`portal`/`registro`). As propostas passam a existir **no MVP** (antes estavam na fase 3).

**`atribuicoes_negociacao`**: `negociacao_id`, `usuario_id` (negociador humano), `atribuida_por`, `ativa`. Define o que o role `negociador` enxerga (11.6).

**`objecoes_detectadas`** (só inclusão): `negociacao_id`, `contato_id`, `categoria` (Apêndice D), `trecho`, `detectada_por` (`ia`/`humano`), `tratada` (booleano), `em`.

**`config_negociador`** (uma por conta): `ligado`, `conduz_padrao` (`ia`/`humano`), `negociador_padrao_id`, `gatilhos` (json), `estilo` (`cooperativo`/`firme`/`consultivo`), `instrucoes_corretor` (texto, até 4.000), `assinatura_humana` (texto que o cliente vê), `versao`.

**`playbook_objecoes`**: `categoria`, `pergunta_exploracao`, `resposta_base`, `proximo_passo`, `origem` (`padrao`/`corretor`). Semeado com o Apêndice D; o corretor edita por categoria.

**`negociador_execucoes`** (só inclusão): como `agente_execucoes` (6.6), com `validacoes` (json do resultado de 10.9.7), `bloqueado_por` (texto) e `aprovada_sem_edicao` (booleano).

## 7. API

Envelope, paginação e formato de erro seguem o contrato da API do shell (P-01). Toda rota filtra por `conta_id` do usuário; rota de membro `corretor` filtra também por `responsavel_id`, exceto o que foi compartilhado. "Tela" indica onde a rota é usada (nenhuma rota sem tela).

**Tradução para a plataforma.** Rotas relativas em `backend/rotas.ts` (servidas em `/api/portal_corretor/…`); públicas em `rotasPublicas` (`/api/pub/portal_corretor/…`, só GET); webhooks em `webhooks` (`/api/wh/…`). Na tabela abaixo, "Papel mínimo" vira role (`corretor`, `cliente`, `operacao`) checado na rota. Todo `DELETE` da tabela vira `PATCH …/remover` (soft delete). Paginação limitada a 100 por página. Toda rota tem tela (11).

### 7.1 Internas

| Rota | Métodos | Papel mínimo | Devolve / faz | Tela |
|---|---|---|---|---|
| `/inicio` | GET | corretor | Passagens pendentes, primeiros atendimentos correndo, retornos do dia, visitas, prazos vencendo, entregas atrasadas | Hoje |
| `/contatos` | GET, POST | corretor | Lista com filtros (papel, etapa, temperatura, origem, parado há N dias, responsável); cria | Clientes |
| `/contatos/:id` | GET, PATCH, DELETE | corretor (dono) | Ficha com linha do tempo, negócios, conversas, seleções | Clientes › ficha |
| `/contatos/importar` | POST | corretor | CSV; modos de duplicata `pular`/`atualizar`/`criar` (12.1) | Clientes › importar |
| `/contatos/exportar` | GET | dono_conta, gestor | CSV da carteira | Ajustes › dados |
| `/negocios` | GET, POST | corretor | Lista e quadro por etapa | Clientes › funil |
| `/negocios/:id` | GET, PATCH | corretor | Inclui mudança de etapa (gera evento) e motivo de perda | Clientes › funil |
| `/funil/etapas` | GET, PUT | dono_conta | Configuração de etapas | Ajustes › funil |
| `/atividades` | GET, POST, PATCH | corretor | Agenda e tarefas | Hoje, Clientes |
| `/visitas/:id/feedback` | POST | corretor | Registra feedback e ficha | Clientes › ficha |
| `/imoveis` | GET, POST | corretor | Carteira, filtros por situação, origem, qualidade | Imóveis |
| `/imoveis/:id` | GET, PATCH, DELETE | corretor (dono) | Ficha, mídias, autorização, entregas, métricas | Imóveis › ficha |
| `/imoveis/:id/midias` | POST, PATCH, DELETE | corretor | Upload e ordem | Imóveis › mídias |
| `/autorizacoes` | GET, POST, PATCH | corretor | Autorização de venda | Imóveis › autorização |
| `/selecoes` | GET, POST | corretor, agente | Cria com token | Clientes › seleção |
| `/propostas` | GET, POST, PATCH | corretor | Versões, envio, decisão registrada | Clientes › negociações |
| `/conversas` | GET | corretor | Caixa unificada com filtros `minha vez`, `com agente`, `aguardando cliente` | Conversas |
| `/conversas/:id/mensagens` | GET, POST | corretor, agente | Envia texto, mídia, modelo | Conversas › thread |
| `/conversas/:id/assumir` | POST | corretor | Tira o agente da conversa | Conversas › thread |
| `/conversas/:id/devolver` | POST | corretor | Devolve ao agente | Conversas › thread |
| `/agentes` | GET, PUT | dono_conta | Configuração, autonomia, limites, instruções | Ajustes › agentes |
| `/agentes/:id/execucoes` | GET | dono_conta, gestor | Trilha com custo | Ajustes › agentes › trilha |
| `/base-conhecimento` | GET, POST, PATCH, DELETE | corretor | | Ajustes › agentes |
| `/canais` | GET, POST, DELETE | dono_conta | Conecta WhatsApp e redes | Ajustes › canais |
| `/modelos-mensagem` | GET, POST | dono_conta | Submete template | Ajustes › canais |
| `/pecas` | GET, POST | corretor | Lista e cria (manual ou gerar) | Estúdio |
| `/pecas/:id` | GET, PATCH, DELETE | corretor | Edita, aprova | Estúdio |
| `/pecas/:id/gerar` | POST | corretor | Dispara geração (texto, arte, vídeo) com custo estimado | Estúdio |
| `/publicacoes` | GET, POST, DELETE | corretor | Agenda, publica, remove | Estúdio |
| `/regras-publicacao` | GET, PUT | dono_conta | Divulgação automática | Ajustes › divulgação |
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
| `/comissoes` | GET, POST, PATCH | corretor | Previstas, a receber, divisões, recebimentos | Clientes › funil (fase 4) |
| `/desempenho` | GET | corretor | KPIs da seção 11.2 com período e recorte | Números |
| `/custos-origem` | GET, PUT | dono_conta | Investimento por canal/mês | Números |
| `/consumo` | GET | dono_conta | Créditos do mês por tipo | Ajustes › plano |
| `/assistente` | GET, POST | corretor | Conversa com o Assistente; ação proposta e confirmação | Assistente |
| `/assistente/acoes/:id/confirmar` | POST | corretor | Executa a ação proposta | Assistente |
| `/mensageiro` | GET, PUT | dono_conta | Configuração em 5 passos, permissões por ação | Mensageiro |
| `/mensageiro/teste` | POST | dono_conta | Conversa de teste sem enviar ao WhatsApp | Mensageiro |
| `/mensageiro/aprovacoes` | GET, POST | corretor | Ações em "pergunta antes" aguardando | Hoje, Conversas |
| `/funil/fila` | GET | corretor | Fila do dia | Hoje, Clientes › funil |
| `/contatos/:id/proxima-abordagem` | GET, POST | corretor | Sugestão e "fazer agora" | Funil |
| `/contatos/:id/temperatura` | PUT | corretor | Sobrescreve a classificação | Funil |
| `/envios` | GET, POST | corretor, agente | Envia imóvel, arquivo, seleção, link; lista com abertura e cliques | Conversas, Funil |
| `/acessos-cliente` | GET, POST, DELETE | corretor | Gera, envia e revoga link do Portal do Cliente | Clientes, Conversas |
| `/paginas` | GET, PUT, POST | corretor | Editor e publicação da Minha Página | Minha Página |
| `/templates-arte` | GET | corretor | Modelos disponíveis | Estúdio |
| `/conexoes/whatsapp` | GET, POST, DELETE | dono_conta | Início e estado do cadastro incorporado | Ajustes |
| `/conexoes/instagram` | GET, POST, DELETE | dono_conta | Login do Instagram, checagem de conta e permissão | Ajustes |
| `/empreendimentos-corretor` | GET, POST, PATCH | corretor | Empreendimentos cadastrados pelo corretor (D-31) | Imóveis |
| `/negociacoes` | GET, POST | corretor, negociador (atribuídas) | Lista com filtros de P15; cria negociação a partir de um negócio | P15 |
| `/negociacoes/:id` | GET, PATCH | corretor, negociador (atribuída) | Detalhe com faixa ZOPA, escada, leitura do comprador; encerrar | P15 |
| `/negociacoes/:id/mandato` | GET, PUT | corretor (escrita); negociador (leitura) | Mandato vigente e versões; **nunca** acessível ao role cliente | P16 |
| `/negociacoes/:id/propostas` | GET, POST | corretor, negociador | Registra oferta do comprador ou envia contraproposta (valida 10.9.7) | P15, M8 |
| `/negociacoes/:id/sugestao` | POST | corretor, negociador | Próximo movimento do Negociador IA (custo mostrado) | P15, M8 |
| `/negociacoes/:id/decisao` | POST | corretor | Leva o acordo à decisão do proprietário (MVP: registro pelo corretor) | P15 |
| `/negociacoes/:id/assumir`, `/devolver` | POST | corretor, negociador | Troca quem conduz | P15, P02 |
| `/negociador/config` | GET, PUT | corretor | Gatilhos, estilo, instruções, playbook | P17 |
| `/negociador/teste` | POST | corretor | Simulador (não envia ao WhatsApp) | P17 |
| `/negociador/atribuicoes` | GET, POST, PATCH | corretor | Convidar e atribuir negociador humano | P17, P15 |
| `/portal/propostas` | GET, POST | cliente | Propostas do próprio cliente; nova oferta | M5b |
| `/portal/propostas/:id/aceite` | POST | cliente | Registra a intenção de aceitar (não fecha) | M5b |
| `/listas-salvas` | GET, POST, PATCH | corretor | Listas do funil | P03 |
| `/busca` | GET | corretor | Busca global | todas |
| `/conta` | GET, PUT | corretor | Perfil, CRECI, marca, tom de voz | Ajustes › Conta e marca (P13) |
| `/contatos/:id/resumo` | POST | corretor | Resumo do histórico em 3 frases (IA `assistente`) | Clientes (P03, P04) |
| `/contatos/:id/exportar` | GET | corretor | Dados do cliente (LGPD) | Clientes › ficha (P04) |
| `/contatos/:id/remover` | PATCH | corretor | Soft delete | Clientes › ficha (P04) |
| `/funil/fila/:id/adiar` | POST | corretor | "Agora não": adia o cartão | Hoje (P01) |
| `/imoveis/:id/descricao` | POST | corretor | Descrição por IA | Imóveis (P06, P07) |
| `/itens-cliente` | GET, POST | corretor | Liberar item ao cliente (concessão explícita) | Clientes › ficha (P04) |
| `/itens-cliente/:id/revogar` | PATCH | corretor | Some do portal na hora | Clientes › ficha (P04) |
| `/paginas/publicar` | POST | corretor | Publica a Minha Página | Página (P09) |
| `/pecas/:id/arquivo` | GET | corretor | Download da arte ou do pacote, a qualquer momento | Estúdio (P08) |
| `/assistente/mensagens/:id` | PATCH | corretor | Útil / não útil | Assistente (P05) |
| `/propostas/:id` | PATCH | corretor | Registrar decisão do proprietário (aceita, recusa, contraproposta) | Clientes › negociações (P15) |
| `/portal/reacoes`, `/portal/visitas`, `/portal/mensagens` | POST | cliente | Ações do cliente no portal (escopo por `itens_cliente`) | Portal (M4, M5) |
| `/portal/propostas/:id/decisao` | POST | cliente (perfil proprietário) | Decisão do proprietário (fase 3) | Portal do Proprietário (M7) |
| Incorporadora: `/empreendimentos`, `/unidades`, `/tabelas`, `/credenciamentos`, `/reservas`, `/reservas/:id/confirmar`, `/excecoes`, `/excecoes/:id/decidir`, `/materiais`, `/listas-espera` | conforme | comercial_incorporadora (corretor credenciado lê e pede) | Herdado do MVP | Painel, Empreendimentos, Espelho, Reservas, Corretores, Exceções |

### 7.2 Públicas (GET, páginas públicas)

`/c/:token` (Portal do Cliente, comprador ou proprietário), `/p/:corretor` (Minha Página), `/p/:corretor/imovel/:codigo`, `/s/:token` (seleção), `/m/:empreendimento` (material público), `/l/:codigo` (link rastreado: conta o clique pelo webhook e redireciona — P-01 sobre redirecionamento a partir de página GET), `/rede/:membro` (cartão público).

### 7.3 Webhooks de entrada (wh)

| Webhook | Origem | Validação | Efeito |
|---|---|---|---|
| `formulario_lead` | Página, imóvel, material | Honeypot `site`, limite 3/min por IP-hash, consentimento obrigatório | Cria/une contato, negócio `Novo`, conversa; evento `lead.recebido` |
| `reacao_selecao` | Seleção | Token válido e não expirado | Grava reação; `quero_visitar` cria tarefa e aciona agente |
| `proprietario_acao` | Portal | Token | Mensagem, aceite de entrega, ciência de proposta, aprovação de preço/conteúdo |
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

**Direção do dono:** usar uma **conta Canva Enterprise da plataforma** para gerar, em nome de cada corretor, as artes (posts, carrosséis, stories, capas de reels) e a base visual da landing page, separando internamente o que é de cada um. O corretor não precisa ter Canva.

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

Verificação de CRECI (consulta pública por regional; não há API nacional conhecida — P-12). Assinatura eletrônica da autorização e do termo de parceria (fase 6, P-18). Agenda externa (Google/Outlook) para visitas (fase 6).

### 9.6 Portões

Nenhuma integração é ligada sem: credencial válida, termo de uso aceito pelo dono da conta, custo estimado mostrado, e modo de teste (envio só para números/contas de teste) até o primeiro aceite.

### 9.7 Regras legais aplicadas

Anunciar imóvel de terceiro exige autorização escrita vigente (Lei 6.530/78, art. 20, III) → `pecas`, `publicacoes`, página e feed bloqueiam sem `autorizacoes_venda.situacao = assinada` dentro da vigência. Anúncio leva o número de inscrição → assinatura com CRECI obrigatória em `marcas` e checada em toda peça. Parceria em imóvel com exclusividade exige ciência escrita do titular (Código de Ética COFECI, Res. 326/92) → `parcerias.ciencia_titular_id` obrigatório quando a autorização é exclusiva e o captador não é o vendedor. Desviar cliente de outro corretor é vedado → `protecoes_cliente`.

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
| Fala com | Corretor | Cliente (WhatsApp) | Corretor (sugestões) | Corretor (peças) | Cliente, na negociação |
| Age sozinho? | Nunca; propõe e o corretor confirma | Conforme configuração (10.3) | Classifica sozinho; abordagens são sugestões | Gera sozinho; publica conforme aprovação | Conforme o mandato (10.9.3), nunca abaixo do recuo, nunca aceita o acordo final |
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

**Processamento:** o LLM transforma pedido + imóvel + marca em dados estruturados por formato (título, chamada, destaques, legenda, hashtags locais, ordem das fotos); o **motor de arte** (Canva da plataforma ou interno, 9.4) preenche o modelo; o app exporta e guarda.

**Saída:** posts, carrosséis, stories e capas de reels prontos; legendas; descrição para a página e para portais; roteiro de vídeo curto. Vídeo animado do Canva ou provedor na fase 3.

**Publicação:** os três modos de 9.2 (agendar, publicar agora, baixar arquivos e agendar por fora), com aprovação manual, automática ou por janela.

**Landing page:** na primeira configuração o Estúdio monta a Minha Página com os visuais gerados, a apresentação, os imóveis marcados como públicos e o WhatsApp; o corretor ajusta blocos e textos (11.1).

**Checagens antes de publicar:** CRECI na peça ou legenda; autorização vigente para imóvel de terceiro; rótulo em mídia gerada ou alterada; nenhum dado de proprietário ou cliente; endereço conforme a preferência; limites do canal; link rastreado.

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
| `negociador` | `poder` | Ler a objeção, estimar o teto do comprador, propor o próximo movimento dentro do mandato (10.9) |
| `audio` | `audio` | Transcrever áudio recebido (fase 3) |

Geração de conteúdo em lote usa as variantes assíncronas com evento de conclusão declarado. Antes de chamar, o app sonda `estadoSlot`; **slot indisponível** → Mensageiro passa a "pergunta antes" com mensagem pronta do modelo, Estúdio mostra "geração indisponível", Funil usa só as regras.

**Contexto do Mensageiro:** instruções da plataforma + configuração do corretor + nome e CRECI + últimas 20 mensagens + perfil de busca + até 5 anúncios compatíveis (só campos públicos) + base de conhecimento da conta + horários livres dos próximos 7 dias + arquivos enviáveis. **Nunca entra:** outros contatos, proprietário, comissão, notas internas. Teto de 512 KB.

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

### 10.9 A5 · Negociador (novo)

**Referência:** Fisher, Ury e Patton, *Como Chegar ao Sim* (Harvard Negotiation Project: BATNA, interesses e não posições, critérios objetivos, opções de ganho mútuo); artigo "BATNA, ZOPA e Ponto de Recuo" do Grupo LU (https://grupolu.com/batna-zopa-e-ponto-de-recuo/); práticas de vendas para objeções (10.9.6).

#### 10.9.1 O que é

Um **papel** que conduz a etapa de negociação de um negócio: responde ao cliente sobre preço e condições, recebe propostas, sugere e envia contrapropostas e leva o acordo à decisão do corretor e do proprietário. Pode ser exercido por:
- **Negociador IA**: lógica do backend com o slot `negociador`, como o Mensageiro;
- **Negociador humano**: pessoa com o role externo `negociador` na conta do corretor, ou o próprio corretor.

Nos dois casos, o comportamento é definido por **duas camadas**: o **mandato** do negócio (P16: valores, concessões, limites) e o **prompt de instruções e regras** da conta (P17 + Apêndice C). O humano vê as mesmas sugestões que a IA produziria e decide.

#### 10.9.2 Conceitos que o Negociador usa

| Conceito | Definição no app | De onde vem o dado |
|---|---|---|
| **Preço pedido (âncora)** | Primeiro valor apresentado | `anuncios.preco_c` |
| **Alvo** | Onde o vendedor quer fechar | Mandato |
| **Ponto de recuo do vendedor** | Valor abaixo do qual a melhor opção do vendedor é não fechar | Mandato (sigiloso) |
| **BATNA do vendedor** | A melhor alternativa do vendedor sem este acordo (ex.: manter anunciado, outra proposta real) | Mandato (texto, sigiloso) |
| **BATNA estimada do comprador** | A alternativa provável do comprador (imóveis comparáveis, outra opção que ele citou) | Radar de preço, imóveis comparáveis, conversa |
| **Teto estimado do comprador** | Valor acima do qual o comprador provavelmente prefere a alternativa dele | Estimativa da IA com fonte declarada; o corretor pode corrigir |
| **ZOPA estimada** | Intervalo entre o ponto de recuo do vendedor e o teto estimado do comprador; se o teto estiver abaixo do recuo, **não há ZOPA** e o Negociador avisa | Calculada no código |
| **Concessão** | Algo que o vendedor cede (preço, prazo, itens) | Mandato |
| **Contrapartida** | O que se pede em troca de cada concessão | Mandato |

No exemplo da referência, com o vendedor aceitando a partir de R$ 1.500 e o comprador indo até R$ 1.800, a ZOPA é de R$ 1.500 a R$ 1.800. No app, a mesma lógica aparece na faixa de P15 com os valores do imóvel.

#### 10.9.3 Níveis de autonomia

| Nível | IA | Humano |
|---|---|---|
| **Só sugere** | Gera o próximo movimento no painel; nada sai | — |
| **Pergunta antes** (padrão) | Prepara mensagem e contraproposta; o corretor (ou o negociador humano) aprova com um toque em P15 ou M8 | Conduz normalmente |
| **Faz sozinho dentro da faixa** | Responde objeções e envia contrapropostas **entre o alvo e o ponto de recuo**, respeitando passo máximo e número de rodadas; exige autorização do proprietário registrada no mandato | Conduz e envia dentro do mandato |

Em qualquer nível: **aceitar o acordo final, reduzir abaixo do recuo, mudar o mandato e falar de comissão são exclusivos do corretor**, e o fechamento depende da decisão registrada do proprietário (D-15, D-58).

#### 10.9.4 Quando entra e como sai

**Entra** (gatilhos configuráveis em P17): negócio movido para a etapa Proposta; cliente pede desconto ou fala de preço (detectado pelo Mensageiro, que antes passava ao corretor com o motivo `negociacao_preco` e agora passa ao Negociador quando ele estiver ligado); reação "conversar sobre o preço" no portal ou na seleção; oferta registrada em P15 ou feita no portal (M5b).

**Sai:** acordo proposto (vai à decisão do corretor e do proprietário); negociação encerrada (ganho ou perdido com motivo); gatilho de passagem ao corretor (10.9.5); negócio devolvido ao Mensageiro quando o cliente desiste de negociar e volta a buscar imóveis.

**Uma conversa, um atendente por vez:** o cabeçalho de P02 mostra quem atende (Mensageiro, Negociador ou o corretor). Enquanto o Negociador atende, o Mensageiro não responde naquela conversa.

#### 10.9.5 Passagem obrigatória ao corretor

Oferta abaixo do ponto de recuo; limite de rodadas atingido; cliente aceita uma condição (fechamento); cliente pede algo fora das concessões do mandato; menção a comissão, permuta, financiamento complexo, problema documental ou jurídico; tom agressivo ou ameaça; cliente pede para falar com uma pessoa; mandato vencido ou ausente; **ZOPA inexistente** (teto estimado abaixo do recuo). A passagem gera resumo da negociação e entra no topo de Hoje.

#### 10.9.6 Como trata objeções (base de conhecimento padrão)

Método em 4 passos para toda objeção, aplicado em uma ou duas mensagens curtas:
1. **Ouvir e reconhecer** — repetir em palavras próprias o que o cliente disse e reconhecer o ponto ("Entendo, o valor ficou acima do que você planejou").
2. **Explorar com pergunta aberta** — descobrir o interesse por trás da posição ("O que pesa mais para você: o valor total ou o valor da entrada?").
3. **Responder com critério objetivo** — comparáveis da região, R$/m², diferenciais do imóvel, custo de oportunidade, condição de pagamento; nunca opinião vaga.
4. **Propor o próximo passo** — uma opção concreta, com concessão e contrapartida quando couber, ou um compromisso pequeno (visita, simulação, conversa por telefone).

Regras de concessão: **conceder devagar e cada vez menos** (o passo diminui a cada rodada); **toda concessão tem contrapartida**; preferir conceder em **condições** (prazo, itens, forma de pagamento) antes do preço; **nunca dividir a diferença** automaticamente; **ancorar** a conversa no valor e nos diferenciais antes de falar em desconto; resumir o que já foi acordado ao fim de cada rodada.

As respostas padrão por categoria de objeção estão no **Apêndice D** (preço, "vou pensar", "vi mais barato", localização, estado do imóvel, financiamento, decisão com outra pessoa, prazo, condomínio e IPTU, documentação). **Referências do método:** modelo de tratamento de objeções do tipo "ouvir, reconhecer, explorar, responder" usado em treinamentos de vendas; perguntas abertas e empatia tática (Chris Voss, *Negocie Como Se Sua Vida Dependesse Disso*); ancoragem (Tversky e Kahneman); concessões recíprocas e princípios de persuasão (Robert Cialdini, *As Armas da Persuasão*); separar pessoas do problema e focar interesses (*Como Chegar ao Sim*).

**Proibido, sempre:** inventar outro comprador, outra proposta ou prazo falso; pressionar com escassez que não existe; revelar o ponto de recuo, o alvo ou a BATNA do vendedor; desmerecer o cliente ou outro corretor; prometer condição de banco; falar de comissão. Base: Código de Ética do COFECI (lealdade e verdade nas informações) e Código de Defesa do Consumidor (informação clara, sem prática enganosa).

#### 10.9.7 Garantias no código (não dependem do modelo)

Antes de qualquer envio do Negociador IA ou da aprovação de uma sugestão, o backend valida:
1. **Piso:** valor da contraproposta ≥ ponto de recuo do mandato; se não, bloqueia e passa ao corretor.
2. **Passo:** redução de preço desta rodada ≤ passo máximo; e menor ou igual à da rodada anterior.
3. **Rodadas:** número da rodada ≤ máximo do mandato.
4. **Concessões:** só itens listados no mandato, cada um com a contrapartida registrada.
5. **Sigilo:** o texto a enviar não contém o valor do recuo, do alvo nem trechos da BATNA do vendedor (comparação numérica e textual); contém só o valor da contraproposta.
6. **Validade:** mandato vigente e autorização do proprietário presente para "faz sozinho".
7. **Janela do WhatsApp** aberta ou modelo aprovado.
Qualquer falha: não envia, registra em `negociador_execucoes` com o motivo, publica `negociacao.limite_atingido` e cria passagem.

#### 10.9.8 Contexto enviado ao modelo (slot `negociador`, base `poder`)

Instruções fixas da plataforma (Apêndice C, parte 1) + instruções do corretor (P17) + estilo + mandato (com recuo e BATNA do vendedor marcados como **sigilosos — nunca citar**) + dados públicos do imóvel e comparáveis + escada de propostas + últimas 30 mensagens da conversa + objeções já detectadas + perfil do comprador. **Nunca entra:** dados de outros clientes, comissão, notas do corretor marcadas como privadas.

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

O app ignora qualquer campo fora do schema, aplica 10.9.7 e só então mostra (pergunta antes) ou envia (faz sozinho).

#### 10.9.9 Custo, avaliação e números

Cada rodada consome créditos (tabela em P13); "Pedir sugestão" mostra o custo. Conversas-roteiro de teste obrigatórias: cliente que pede 20% de desconto; cliente que diz "vi mais barato"; cliente que aceita; oferta abaixo do recuo; cliente que pergunta "qual o mínimo que ele aceita?" (tem de responder sem revelar o recuo); cliente agressivo; negociação sem ZOPA. Ação proibida e vazamento de sigilo têm de ser zero. Números do Negociador no relatório Negociação (P10) e em P17.

## 11. Telas — Padrão B (oficial)

O Padrão B foi escolhido pelo dono em 18/10/2026 entre três direções desenhadas no canvas de design (D-56). **Guia visual e wireframes:** `specs/telas_padrao_b.md`; **mockups HTML:** `specs/telas/`. Esta seção é a especificação completa das telas: o que cada uma mostra, cada comando, o que acontece no backend, que evento sai e que integração é tocada. Layout por primitivos `urbi-*` (11.9); estado de filtro, aba, item selecionado e período **sempre na URL**; toda tela tem os estados de 11.0.4.

> **Referência geral do Padrão B:** Lais (caixa de conversas com IA e humano no mesmo número) e Kommo (conversa como centro do CRM), com a fila de ações do Compass One e as listas do dia do Follow Up Boss encaixadas dentro do mesmo esquema.

### 11.0 Regras do Padrão B

#### 11.0.1 A moldura (igual em toda tela do corretor)

| Elemento | Especificação | Referência |
|---|---|---|
| **Trilho de ícones** à esquerda, 88 px | Itens, nesta ordem: **Hoje · Conversas · Clientes · Imóveis · Estúdio · Página · Números · Ajustes**. Ícone + rótulo curto. Item ativo com fundo de destaque e `aria-current="page"`. Selo numérico vermelho em Conversas (conversas "minha vez") e em Clientes (negociações aguardando) | Lais, Kommo |
| **Botão Criar** no topo do trilho | Abre menu com: Novo cliente · Novo imóvel · Novo post · Nova visita · Nova proposta. Cada opção abre a tela de criação correspondente já com o contexto atual (ex.: em uma conversa, "Nova visita" já vem com o cliente) | Follow Up Boss ("+" global) |
| **Botão Assistente** no pé do trilho | Abre o painel do Assistente na coluna direita (P05), mantendo esquerda e centro | Follow Up Boss (IA no fluxo), Real (Leo) |
| **Avatar** abaixo do Assistente | Perfil, sair (do shell) | — |
| **Três colunas** no espaço de conteúdo | **Esquerda (lista)** 340–380 px · **Centro (foco)** flexível, mínimo 520 px · **Direita (contexto)** 300–360 px | Lais, Kommo |

Na plataforma, a navegação principal é o `nav` do manifesto (5.1); o trilho é a forma como as telas da app a apresentam. Se o shell já desenhar o menu lateral, o trilho vira apenas o botão Criar e o botão Assistente no topo da coluna esquerda, e o resto do padrão não muda.

#### 11.0.2 O que cada coluna sempre faz

- **Esquerda — "o que existe":** lista com busca, filtros em fichas (chips) e seleção. Selecionar um item atualiza o centro e a direita sem trocar de página (`?item=<id>` na URL).
- **Centro — "o que estou fazendo":** o item aberto (conversa, negócio, imóvel, pedido ao Estúdio, relatório). As ações principais ficam aqui.
- **Direita — "o que eu preciso saber para decidir":** contexto do item, **próxima ação sugerida pela IA**, números do item e atalhos. É a coluna que o Assistente ocupa quando aberto.

#### 11.0.3 Larguras

| Largura | Comportamento |
|---|---|
| ≥ 1280 px | Três colunas |
| 900–1279 px | Esquerda + centro; a direita vira gaveta aberta pelo botão "Contexto" no cabeçalho do centro |
| < 900 px (celular) | Uma coluna por vez: lista → item (com "voltar") → contexto em folha inferior; atalhos do dia em Hoje (11.5) |

#### 11.0.4 Estados obrigatórios de toda tela

| Estado | Como aparece |
|---|---|
| Carregando | Esqueleto das três colunas (`urbi-carregando`), nunca tela branca |
| Vazio | Frase do que falta + a ação que resolve (ex.: "Nenhum imóvel ainda. **Cadastrar o primeiro imóvel**") |
| Erro | Frase curta + "Tentar de novo"; o erro técnico vai para a Sentinela, não para o corretor |
| Sem permissão / outra conta | Sempre "Não encontrado" (D-40) |
| Integração desconectada | Faixa no topo do centro: "Seu WhatsApp desconectou. **Reconectar**" (leva a P12) |
| Crédito esgotado | Faixa: "Créditos do mês acabaram. O Mensageiro e o Negociador passaram a pedir sua aprovação." |
| IA indisponível (`estadoSlot`) | Botões de IA desabilitados com dica "IA indisponível agora"; o resto da tela funciona |

#### 11.0.5 Endereços das telas

Os caminhos no título de cada tela (`/conversas`, `/ajustes/negociador`…) são **sub-rotas do frontend da app**; os dados vêm das rotas de API da seção 7. Toda tela abre direto pelo endereço, com o item e os filtros na URL.

#### 11.0.6 Convenções de interação

- Toda ação que **gasta crédito** mostra o custo estimado no próprio botão ou no rodapé do painel ("~2 créditos").
- Toda ação da **IA que envia algo ao cliente** passa pelo nível de permissão configurado (Mensageiro 10.3, Negociador 10.9); quando é "pergunta antes", a sugestão aparece como cartão com **Enviar · Editar · Descartar**.
- **Desfazer** por 8 s em ações reversíveis (mover etapa, arquivar conversa, remover item do portal).
- **Atalhos de teclado no computador:** `/` busca, `C` criar, `A` Assistente, `J/K` próximo/anterior na lista, `E` enviar sugestão aceita. No celular, nada depende de atalho.
- Textos de botão são verbos no infinitivo ou imperativo curto ("Responder", "Registrar proposta").

### 11.1 Telas do corretor (computador)

Cada tela abaixo segue o formato: **propósito · referência · colunas · comandos (botão → o que acontece → rota → evento) · celular**. As rotas são as da seção 7; os eventos, da 13.

#### P01 · Hoje (`/`)

**Propósito:** responder "o que eu faço agora". **Referência:** Compass One (fila de ações), Follow Up Boss (listas do dia), Lais (passagens da IA).

| Coluna | Conteúdo |
|---|---|
| Esquerda | Cabeçalho com data e "Mensageiro atendeu N conversas desde ontem". **Precisa de você** (passagens do Mensageiro e do Negociador, em vermelho/âmbar, com motivo em uma linha e botão **Assumir**). **Primeiros passos** com barra de progresso (conectar WhatsApp, conectar Instagram, cadastrar o primeiro imóvel, ligar o Mensageiro, publicar a Minha Página) — some quando 5/5 |
| Centro | **Fila do dia**: cartões ordenados por urgência (10.4). Cada cartão: avatar ou ícone, chip de tipo (Visita hoje · Quente sem resposta · Proposta recebida · Aprovar peça · Retomar frio · Prazo vencendo), título, uma frase de contexto, **um botão principal** e no máximo um secundário. Rodapé "Mais N para depois" |
| Direita | **Agenda** do dia; **Sua semana** (4 números: 1ª resposta, visitas, quentes, comissão prevista); **Dica do Assistente** (uma sugestão concreta com botão) |

| Comando | Efeito | Rota | Evento |
|---|---|---|---|
| Assumir (passagem) | Abre a conversa em P02 já assumida; Mensageiro/Negociador pausam naquela conversa | `POST /conversas/:id/assumir` | `conversa.assumida` |
| Botão principal do cartão | Executa a ação do cartão (abrir conversa, registrar proposta, revisar peça…) | conforme o cartão | conforme |
| Agora não | Adia o cartão para amanhã | `POST /funil/fila/:id/adiar` | — |
| Item de Primeiros passos | Leva à tela de configuração correspondente | — | — |
| Dica do Assistente | Executa a sugestão após confirmação | `POST /assistente/acoes/:id/confirmar` | conforme |

**Backend:** `GET /inicio` agrega passagens, fila (`/funil/fila`), agenda e números da semana numa chamada. **Celular:** M1.

#### P02 · Conversas (`/conversas`)

**Propósito:** atender o cliente pelo WhatsApp dentro do app, com o Mensageiro e o Negociador. **Referência:** Lais (mesmo número, assumir/reativar, origem e status), Kommo (caixa e funil juntos), Kenlo (corretor vê só os seus).

| Coluna | Conteúdo |
|---|---|
| Esquerda | Busca (nome, telefone, imóvel). Filtros: **Minha vez · Mensageiro · Negociador · Aguardando cliente · Não lidas · Arquivadas**. Lista: avatar, nome, hora, última mensagem, chips de **status** (Visita marcada, Pediu preço, Abriu seleção, Mensageiro atendendo, Em negociação) e **origem** (Anúncio Instagram, Página, Portal, Indicação) |
| Centro | **Cabeçalho**: nome, temperatura, chips (etapa, visita, "veio do anúncio X"), quem atende (Mensageiro / Negociador / você) com **Assumir** ou **Reativar Mensageiro** / **Devolver ao Negociador**. **Mensagens**: do cliente à esquerda; do Mensageiro e do Negociador à direita com rótulo e cor próprios; suas à direita; avisos de sistema centralizados ("Mensageiro passou para você: preço"). Cartões de imóvel com foto, preço e botões "Quero visitar / Ver fotos". **Barra de ações rápidas**: Imóvel · Seleção · Arquivo · Localização · Agendar visita · Portal do cliente · Proposta. **Compositor**: sugestão da IA em botão, anexar, campo de texto, áudio, enviar. **Rodapé**: estado da janela de 24 h |
| Direita | **Próxima abordagem** (IA, com "Usar mensagem pronta"). **Enviado para este cliente** (cada envio com aberto/clicado). **Também combinam** (imóveis compatíveis com "Enviar"). **Perfil de busca** em chips. Em negociação: o **resumo da negociação** (11.1 P15, faixa ZOPA reduzida) |

| Comando | Efeito | Rota | Evento | Integração |
|---|---|---|---|---|
| Enviar texto | Envia pelo WhatsApp do corretor; bloqueado fora da janela de 24 h (oferece modelo) | `POST /conversas/:id/mensagens` | `mensagem.enviada` | WhatsApp Cloud API |
| Imóvel | Escolher imóvel → envia **cartão** (imagem + texto + botões) e cria concessão no portal | `POST /envios` (`tipo: imovel`) | `envio.criado` | WhatsApp (mensagem interativa) |
| Seleção | Monta seleção com imóveis compatíveis pré-marcados → envia link | `POST /selecoes` + `POST /envios` | `envio.criado` | — |
| Arquivo / Localização | Envia mídia ou localização | `POST /envios` | `envio.criado` | WhatsApp |
| Agendar visita | Abre horários livres → cria visita e lembrete agendado | `POST /atividades` + `agendar` | `visita.agendada` | — |
| Portal do cliente | Convida o cliente (se ainda não tem acesso) ou reenvia o link | `POST /acessos-cliente` | `acesso_cliente.convidado` | WhatsApp |
| Proposta | Abre o registro de proposta (P15) já ligado ao negócio | `POST /propostas` | `proposta.registrada` | — |
| Assumir / Reativar / Devolver | Troca quem atende | `POST /conversas/:id/assumir` · `/devolver` | `conversa.assumida` · `conversa.devolvida` | — |
| Sugestão (IA) | Insere a mensagem sugerida no campo para editar | `POST /contatos/:id/proxima-abordagem` | — | IA `mensageiro` |
| Modelo (fora da janela) | Lista modelos aprovados com variáveis preenchidas | `GET /modelos-mensagem` | — | WhatsApp |

**Tempo real:** a lista e a conversa atualizam ao receber `mensagem.recebida` (assinatura do barramento pelo frontend, se o shell oferecer; senão, atualização a cada 10 s enquanto a tela está aberta — P-37). **Celular:** M2.

#### P03 · Clientes — Funil (`/clientes?visao=funil`)

**Propósito:** ver onde cada cliente está e agir no próximo passo. **Referência:** Follow Up Boss (listas salvas, IA com um clique), Kenlo (funil visual), Kommo (quadro + conversa).

| Coluna | Conteúdo |
|---|---|
| Esquerda | Alternador **Funil · Lista · Negociações**. Seção **Funis** (Compra, Captação) com contagem. **Por temperatura** (Quentes, Mornos, Frios, com definição em uma linha). **Listas salvas** do corretor |
| Centro | Cabeçalho com nome do funil, total aberto e **taxas entre etapas** (contato→atendimento, atendimento→visita, visita→proposta, proposta→ganho). **Quadro** com colunas por etapa; cartões com avatar, nome, temperatura, último sinal ("abriu a seleção 2x"). Arrastar muda a etapa; para **Perdido** abre o motivo |
| Direita | Cliente selecionado: temperatura **com motivo**, **Próxima abordagem** com "Registrar proposta / Mensagem pronta", botões **Resumir · Criar tarefa · Abrir conversa**, **Enviado** com abertura e clique |

| Comando | Efeito | Rota | Evento |
|---|---|---|---|
| Arrastar cartão | Muda etapa; pede motivo se perdido; desfazer 8 s | `PATCH /negocios/:id` | `negocio.etapa_mudou` |
| Resumir | Resumo em 3 frases do histórico | `POST /contatos/:id/resumo` | — (IA `assistente`) |
| Criar tarefa | Tarefa sugerida com prazo do playbook | `POST /atividades` | — |
| Salvar lista | Salva os filtros atuais com nome | `POST /listas-salvas` | — |
| Mover para Proposta | Abre P15 e, se o mandato existir, ativa o Negociador conforme configuração | `PATCH /negocios/:id` | `negociacao.iniciada` |

**Celular:** lista agrupada por etapa (como B2 do canvas), sem quadro.

#### P04 · Clientes — Lista e ficha (`/clientes?visao=lista&item=:id`)

**Propósito:** cadastro completo e histórico de tudo que aconteceu e foi enviado. **Referência:** Follow Up Boss (linha do tempo única), Compass One (o que o cliente vê), Kenlo (carteira).

| Coluna | Conteúdo |
|---|---|
| Esquerda | Botões **Importar** e **Novo**; busca; filtros Todos · Compradores · Proprietários; lista com etapa, origem e temperatura |
| Centro | Cabeçalho: nome, telefone mascarado, e-mail, papel, chips; botões **Conversa** e **Resumir**. Abas: **Resumo · Linha do tempo · Enviados · Negócios · Negociação**. A linha do tempo mistura mensagens, ações do Mensageiro e do Negociador, envios, reações, visitas, propostas e mudanças de temperatura, com ícone por tipo |
| Direita | **Perfil de busca** (chips + editar); **Portal do cliente** (convite aceito, último acesso, o que ele vê, **Liberar item · Reenviar link · Revogar**); **Privacidade** (consentimento, exportar, remover) |

**Comandos novos:** Liberar item (`POST /itens-cliente`, evento `item_cliente.concedido`), Revogar (`PATCH /itens-cliente/:id/revogar`), Exportar dados do cliente (`GET /contatos/:id/exportar`), Remover (`PATCH /contatos/:id/remover`, soft delete).

#### P05 · Assistente aberto (painel em qualquer tela)

**Propósito:** tirar dúvidas sobre o app e pedir coisas por conversa. **Referência:** Real Brokerage (Leo), Follow Up Boss (IA sem prompt).

Painel na coluna direita: histórico da conversa com o Assistente; respostas com o artigo da ajuda citado e botão "Ir para…"; **ações propostas em cartão com borda roxa**: "Vou criar esta regra: … · Confirmar · Cancelar"; sugestões de perguntas em chips; campo de texto, microfone, enviar. O Assistente sabe a tela e o item abertos.

| Comando | Rota | Evento |
|---|---|---|
| Perguntar | `POST /assistente` | — |
| Confirmar ação | `POST /assistente/acoes/:id/confirmar` | conforme a ação (`automacao.criada`, `atividade.criada`, `publicacao.agendada`) |
| Útil / não útil | `PATCH /assistente/mensagens/:id` | — |

#### P06 · Imóveis — Carteira e ficha (`/imoveis?item=:id`)

**Propósito:** carteira organizada, anúncio de qualidade e resultado de cada imóvel. **Referência:** Kenlo (qualidade do anúncio, carteira), Compass One (engajamento do anúncio).

| Coluna | Conteúdo |
|---|---|
| Esquerda | Alternador **Carteira · Empreendimentos**; busca (bairro, código, preço); filtros Ativos · Rascunhos · Públicos · Privados; lista com miniatura, preço, nota de qualidade colorida, situação |
| Centro | Cabeçalho com título, código, **Editar** e **Criar conteúdo**. Galeria (capa grande + 4 + "mais N"). Dados em grade (preço, área, quartos, vagas, condomínio, IPTU). Descrição com **Melhorar com IA**. Cartões **Autorização de venda** (exclusiva?, validade, comissão, documento anexado) e **Quem vê este imóvel** (Só você / Público na Minha Página; frase "outros corretores nunca veem seus imóveis") |
| Direita | **Qualidade do anúncio** (nota + o que falta para 100), **Últimos 30 dias** (visualizações, cliques no WhatsApp, contatos, visitas), **Clientes que combinam** com "Enviar", e — se houver negociação — **Mandato** resumido (preço pedido, alvo; o ponto de recuo aparece mascarado com "mostrar") |

**Comandos:** Criar conteúdo (leva a P08 com o imóvel), Melhorar descrição (`POST /imoveis/:id/descricao`, IA `conteudo`), Enviar a cliente (`POST /envios`), Mudar visibilidade (`PATCH /imoveis/:id`, evento `imovel.visibilidade_mudou`), Definir mandato (abre P16).

#### P07 · Imóveis — Novo imóvel (`/imoveis/novo`)

**Propósito:** cadastrar em ~3 minutos. **Referência:** Kenlo (cadastro), Lais (IA ajudando a captar e atualizar anúncios).

| Coluna | Conteúdo |
|---|---|
| Esquerda | 4 passos: **Fotos · Dados · Autorização · Onde aparece**, com estado de cada um; Salvar rascunho |
| Centro | **Passo 1:** área de soltar/escolher fotos; a IA ordena (fachada, sala, cozinha, quartos, área externa) e marca a capa sugerida. **Passo 2:** campos pré-preenchidos pela IA a partir das fotos e do ditado (cada campo marcado "preenchido pela IA"; campo obrigatório vazio em destaque). Botão **Ditar por voz**. **Passo 3:** autorização (exclusiva, validade, comissão, anexar documento). **Passo 4:** visibilidade (só eu / público) |
| Direita | **Qualidade ao vivo**; lista do que falta; "Depois de salvar posso: escrever a descrição, montar o pacote de lançamento, avisar N clientes que combinam" |

**Backend:** upload em 2 passos (`webhooks_upload` / `req.arquivos`), `POST /imoveis` (rascunho a cada passo), IA `fotos` (ordem e capa) e `conteudo` (campos a partir do ditado transcrito). Evento `imovel.criado`; ao ativar, `imovel.ativado` (dispara regras de publicação).

#### P08 · Estúdio (`/estudio?pedido=:id`)

**Propósito:** produzir e publicar no Instagram sem designer. **Referência:** Rechat e Luxury Presence (campanha automática e aprovação por janela), Canva (motor de arte), Lais/Kommo (pedido por conversa).

| Coluna | Conteúdo |
|---|---|
| Esquerda | Conta do Instagram conectada; **Criar rápido** (Pacote de lançamento, Baixou o preço, Vendido, Visita aberta); **Seus pedidos** com estado |
| Centro | Conversa com o Estúdio: o pedido do corretor; a resposta com as **peças** (post 1:1, story 9:16, carrossel 4:5), a **legenda**, a linha de **checagens** (CRECI, autorização, link rastreado) e os **três modos**: **Agendar · Publicar agora · Baixar**. Pedidos de ajuste ("troca a capa") geram nova versão. Compositor com anexar fotos e microfone |
| Direita | **Esta semana** (publicações agendadas e estado); interruptor **Publicar no horário se eu não mexer** (aprovação por janela); **Biblioteca** (todos os arquivos para baixar a qualquer momento); **Créditos do mês** |

| Comando | Efeito | Rota | Evento | Integração |
|---|---|---|---|---|
| Criar rápido / Pedir | IA estrutura → fila de render → peças | `POST /pecas` + `POST /pecas/:id/gerar` | `peca.gerada` | IA `conteudo`, Canva (autofill + export) |
| Ajustar | Nova versão da peça | `POST /pecas/:id/gerar` | `peca.gerada` | Canva |
| Agendar | `agendar` contêiner (H−1) e publicação (H) | `POST /publicacoes` | `publicacao.agendada` | Instagram |
| Publicar agora | Cria contêiner e publica | `POST /publicacoes` (`agora: true`) | `publicacao.feita` | Instagram |
| Baixar | Download do arquivo ou pacote | `GET /pecas/:id/arquivo` | — | — |

#### P09 · Página (`/pagina`)

**Propósito:** página profissional própria, montada pela IA e ajustável. **Referência:** Luxury Presence (site do corretor), Compass (padrão visual de cartões), Lais (personalização da marca).

| Coluna | Conteúdo |
|---|---|
| Esquerda | Endereço e estado (publicada/rascunho), **Publicar**; **Blocos** arrastáveis com "Mostrar" (capa, imóveis em destaque, empreendimentos, sobre, bairros, depoimentos, formulário, WhatsApp e Instagram); **Refazer a página com IA** |
| Centro | Pré-visualização com alternador **Celular · Computador**; o bloco selecionado aparece com borda |
| Direita | Ajustes do bloco selecionado (ex.: imóveis automáticos ou escolhidos); **Marca** (cores, foto, logo); **Últimos 30 dias** (visitas, contatos); **Copiar link** |

**Backend:** `GET/PUT /paginas`, `POST /paginas/publicar` (evento `pagina.publicada`), rotas públicas `/p/:slug` (7.2). Visuais da capa e banners pelo Canva (9.4).

#### P10 · Números (`/numeros?relatorio=funil`)

**Propósito:** saber onde está perdendo clientes e o que mudar. **Referência:** Follow Up Boss (relatórios por origem), Morada (retorno por canal), Lais (leads por horário).

| Coluna | Conteúdo |
|---|---|
| Esquerda | Relatórios: Resumo da semana · Funil e conversão · Origem dos contatos · Tempo de resposta · Conteúdo · Mensageiro · **Negociação** · Créditos |
| Centro | O relatório escolhido, com período e comparação; ex. Funil: 4 números, barras da coorte, contatos por horário (fora do horário em roxo), motivos de perda |
| Direita | **O que melhorar** (leitura da IA com ação: "Ver os 9 clientes"), melhores origens, **Exportar CSV** |

**Relatório Negociação (novo):** propostas recebidas, taxa de acordo, **desconto médio concedido sobre o preço pedido**, rodadas médias até acordo, objeções mais frequentes, % das respostas do Negociador aprovadas sem edição. Fórmulas na 11.2.

#### P11 · Ajustes — Mensageiro (`/ajustes/mensageiro`)

**Propósito:** configurar o atendente de IA em minutos. **Referência:** Lais e Morada (IA com a marca), Luxury Presence (especialistas de IA ligáveis).

Esquerda: **menu de Ajustes** (Mensageiro · **Negociador** · Conexões · Conta e marca · Plano e créditos · Funil e abordagens · Horário de atendimento · Privacidade). Centro: estado (Ligado/Pausado), 5 passos (Quem é · O que pode fazer · Quando atua · Como fala · Testar e ligar); no passo 2, cada ação com **Não faz · Pergunta antes · Faz sozinho** e o quadro "Nunca faz". Direita: **Conversa de teste** (não envia ao WhatsApp) e números do mês. Rotas: `GET/PUT /mensageiro`, `POST /mensageiro/teste`. Evento auditável `mensageiro.permissoes_alteradas`.

#### P12 · Ajustes — Conexões (`/ajustes/conexoes`)

**Propósito:** conectar WhatsApp e Instagram sem ajuda. **Referência:** cadastro incorporado da Meta (coexistência).

Centro: cartão **WhatsApp** com 3 passos (entrar com a Meta · digitar o número que já usa · confirmar no celular lendo o código), cada um com estado; cartão **Instagram** (conectado, tipo de conta, o que pode publicar, **Testar publicação**, Desconectar); cartão **Agenda** (fase 6). Direita: "Por que conectar aqui" em uma frase, ajuda do Assistente, aviso de que pode desconectar. Rotas: `/conexoes/whatsapp`, `/conexoes/instagram` (9.1, 9.2). Eventos auditáveis `canal.conectado` / `canal.desconectado`.

#### P13 · Ajustes — Conta, marca e plano (`/ajustes/conta`)

Centro: **Seu perfil** (foto, nome profissional, CRECI com estado de verificação, WhatsApp, regiões); **Sua marca** (logo, cor principal, tom de voz usado pelas artes, pelo Mensageiro e pelo Negociador). Direita: **Plano**, **Créditos do mês** com barra e **tabela de créditos por ação** (conversa do Mensageiro, rodada do Negociador, arte, descrição, resumo), frase do que acontece quando acaba. **Referência:** Kenlo (créditos por recurso).

#### P14 · Clientes — Importar (`/clientes/importar`)

Esquerda: fontes (Planilha/CSV · Contatos do celular (vCard) · Outro CRM — fase 2). Centro: arquivo, número de linhas, **mapeamento de colunas sugerido pela IA**, **prévia** com o que acontece em cada linha (novo, já existe, ignorado), **Importar N contatos**. Direita: regra para contato repetido (Pular · Completar · Substituir) e a regra de consentimento (12.1). Rota `POST /contatos/importar`. **Referência:** Follow Up Boss e Kenlo (migração assistida).

#### P15 · Clientes — Negociações (`/clientes?visao=negociacoes&item=:id`) — novo

**Propósito:** conduzir propostas e contrapropostas até um acordo bom para as duas partes, com o Negociador (humano ou IA) dentro de um mandato. **Referência:** conceitos de BATNA, ZOPA e ponto de recuo (Fisher, Ury e Patton, *Como Chegar ao Sim*; artigo do Grupo LU), tratamento de objeções (10.9.6), linha do tempo de propostas do Compass One.

| Coluna | Conteúdo |
|---|---|
| Esquerda | Alternador Funil · Lista · **Negociações**. Filtros: **Aguardando você · Negociador atendendo · Aguardando cliente · Aguardando proprietário · Encerradas**. Lista: cliente, imóvel, **última oferta x preço pedido** (ex.: "R$ 920 mil · −6%"), quem atende (Negociador IA, negociador humano, você), tempo desde a última rodada |
| Centro | **Faixa da negociação** (a "régua" da imagem de referência): linha horizontal com marcas de **preço pedido** (âncora), **alvo**, **ponto de recuo do vendedor** (sigiloso, só para a conta), **última oferta do comprador**, **teto estimado do comprador** e a **ZOPA estimada** pintada em verde entre o recuo do vendedor e o teto estimado do comprador; vermelho fora dela. Abaixo, a **escada de propostas** (cada rodada em uma linha: quem, valor, condições, concessão dada, contrapartida pedida, data). Em seguida, a **conversa** recortada à negociação (mesmo componente de P02), com o cartão de **sugestão do Negociador** quando estiver em "pergunta antes" |
| Direita | **Mandato** (preço pedido, alvo, recuo mascarado, BATNA do vendedor, concessões permitidas e contrapartidas, prazo, autonomia); **Leitura do comprador** (interesses, objeções detectadas com categoria, BATNA estimada do comprador com a fonte — comparáveis, radar, o que ele disse); **Próximo movimento sugerido** (ex.: "Contraproposta de R$ 1.395.000 com entrega em 60 dias; peça entrada de 30% em troca"); botões **Enviar contraproposta · Editar · Passar para o proprietário · Assumir** |

| Comando | Efeito | Rota | Evento |
|---|---|---|---|
| Registrar oferta do cliente | Nova rodada (`direcao: comprador`) | `POST /negociacoes/:id/propostas` | `proposta.recebida` |
| Pedir sugestão | O Negociador gera o próximo movimento dentro do mandato | `POST /negociacoes/:id/sugestao` | `contraproposta.sugerida` |
| Enviar contraproposta | Valida o mandato **no código** (10.9.7) → envia ao cliente pelo WhatsApp e grava a rodada | `POST /negociacoes/:id/propostas` (`direcao: vendedor`) | `contraproposta.enviada` |
| Passar para o proprietário | Gera o resumo da proposta para decisão; no MVP o corretor registra a decisão; na fase 3 vai ao Portal do Proprietário | `POST /negociacoes/:id/decisao` | `negociacao.acordo_proposto` |
| Registrar decisão | Aceita · Recusa · Contraproposta do proprietário | `PATCH /propostas/:id` | `proposta.decidida` |
| Assumir / Devolver ao Negociador | Troca quem conduz | `POST /negociacoes/:id/assumir` · `/devolver` | `negociacao.assumida` |
| Encerrar | Ganho (gera comissão prevista) ou perdido com motivo | `PATCH /negociacoes/:id` | `negociacao.encerrada` |
| Editar mandato | Abre P16 | — | `mandato.alterado` (auditável) |

**Regra visual de sigilo:** o ponto de recuo e a BATNA do vendedor aparecem **mascarados** ("•••• mostrar") e nunca em nenhuma superfície do cliente, nem em exportações para o cliente.

#### P16 · Mandato de negociação (gaveta sobre P15 ou P06) — novo

**Propósito:** o corretor define, com a autorização do proprietário, até onde o Negociador pode ir. **Referência:** BATNA e ponto de recuo; concessões recíprocas (prática de negociação).

Formulário em 4 blocos, com explicação de uma linha em cada campo:
1. **Valores:** preço pedido (âncora, vem do anúncio), **alvo** (onde se quer fechar), **ponto de recuo** (abaixo disso o vendedor prefere a alternativa) e **BATNA do vendedor** em texto ("manter anunciado 60 dias", "proposta de R$ 1,35 mi de outro comprador"). Validação: recuo ≤ alvo ≤ pedido.
2. **Concessões permitidas e contrapartidas:** lista de itens negociáveis, cada um com o que pedir em troca (ex.: "aceitar prazo de entrega de 90 dias ↔ entrada maior"; "deixar móveis planejados ↔ fechar em 7 dias"); **passo máximo de concessão de preço** por rodada (padrão 40% do intervalo restante) e **número máximo de rodadas** antes de chamar o corretor (padrão 4).
3. **Prazo e validade:** validade do mandato e de cada contraproposta.
4. **Autonomia:** Negociador **IA** ou **humano** (escolher a pessoa) e o nível: **Só sugere · Pergunta antes · Faz sozinho dentro da faixa** (10.9.3). Campo **Autorização do proprietário** (anexo ou registro "autorizado por mensagem em <data>"), obrigatório para "faz sozinho".

Rotas: `GET/PUT /negociacoes/:id/mandato`. Evento auditável `mandato.alterado`.

#### P17 · Ajustes — Negociador (`/ajustes/negociador`) — novo

**Propósito:** definir como o Negociador trata contatos, propostas e contrapropostas: o **prompt com instruções e regras**. **Referência:** Luxury Presence (especialista de IA configurável), Morada (tom de voz da marca).

| Coluna | Conteúdo |
|---|---|
| Esquerda | Menu de Ajustes (Negociador selecionado) |
| Centro | **1. Quando entra:** gatilhos marcáveis — negócio chega à etapa Proposta; cliente pede desconto ou fala de preço; reação "conversar sobre o preço"; oferta registrada. **2. Quem negocia por padrão:** IA ou pessoa (lista de negociadores humanos da conta). **3. Estilo:** Cooperativo (padrão) · Firme · Consultivo, com exemplo de mensagem de cada. **4. Regras fixas** (não editáveis, só exibidas): nunca revelar ponto de recuo e BATNA do vendedor; nunca inventar outra proposta ou urgência; nunca aceitar acordo final sozinho; sempre pedir contrapartida ao conceder; sempre passar ao corretor nos gatilhos de 10.9.5. **5. Instruções do corretor** (texto livre, até 4.000 caracteres, com modelo pronto do Apêndice C para editar). **6. Respostas a objeções** (Apêndice D) com "usar padrão" ou "editar a minha resposta" por categoria. **7. Testar:** simulador onde a equipe faz o papel do comprador (mesmo componente da conversa de teste do Mensageiro) e vê a faixa ZOPA reagindo |
| Direita | Pré-visualização de **como o Negociador vai responder** à última objeção testada; números do mês (rodadas, acordos, desconto médio, % aprovadas sem edição); custo estimado por rodada |

Rotas: `GET/PUT /negociador/config`, `POST /negociador/teste`, `GET /negociador/atribuicoes`. Evento auditável `negociador.config_alterada`.

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

**KPIs de negociação (novos, relatório Negociação de P10):**

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

#### M4 · Portal do Cliente — Conversa (role `cliente`, `/portal`)

- **Topo:** "Meu atendimento" (menu do shell) e avatar.
- **Faixa "Próximo passo"** em destaque (ex.: "Visita sábado às 10 h · Ver").
- **Abas:** Conversa · Imóveis (N) · Agenda (N) · Arquivos (N) · **Propostas (N)** quando houver negociação.
- **Conversa:** mensagens do corretor, do Mensageiro e do Negociador à esquerda, com rótulo de quem fala; as do cliente à direita; cartões de imóvel com "Gostei / Quero visitar".
- **Compositor:** "Escreva para o Rafael" e enviar. O que o cliente escreve aqui entra na mesma conversa do WhatsApp do corretor.

#### M5 · Portal do Cliente — Imóveis e agenda

Imóvel em destaque com galeria, preço, chip de visita e botões **Gostei · Não gostei · Comentar**; lista dos outros imóveis com a reação dada; cartão **O que falta de você** (tarefas do cliente, fase 3); aba Agenda com visitas e reuniões, mapa, adicionar ao calendário do celular e remarcar.

#### M5b · Portal do Cliente — Propostas (novo)

Lista das propostas do cliente e respostas do vendedor em linha do tempo (valor, condições, validade, estado). Botões **Aceitar condição · Fazer nova oferta · Conversar**. **Nunca mostra** o mandato, o alvo, o ponto de recuo, a BATNA do vendedor nem notas internas. "Aceitar" registra a intenção do cliente; o acordo só fecha com a confirmação do corretor e do proprietário (D-15).

| Comando | Rota (pública por role `cliente`) | Evento |
|---|---|---|
| Reagir a imóvel | `POST /portal/reacoes` | `selecao.reagida` |
| Pedir/remarcar visita | `POST /portal/visitas` | `visita.pedida` |
| Mensagem | `POST /portal/mensagens` | `mensagem.recebida` |
| Fazer nova oferta | `POST /portal/propostas` | `proposta.recebida` |
| Aceitar condição | `POST /portal/propostas/:id/aceite` | `proposta.aceite_cliente` |

#### M6 · Minha Página (visitante, sem login, `/p/:slug`)

Capa com foto, nome, CRECI e **Falar no WhatsApp**; imóveis em destaque com **Quero saber mais** (abre o WhatsApp com o imóvel citado); demais blocos conforme P09; formulário por `wh`. Marca do corretor como dado e CSS próprio (página pública sem tokens de tema).

#### M7 · Portal do Proprietário (fase 3)

Imóvel, dias à venda, vistas, visitas, propostas; **O que o corretor está fazendo** (entregas com estado); **Proposta recebida** com **Ver detalhes · Falar com o corretor**; retorno das visitas revisado. Na fase 3, a decisão do proprietário sobre propostas é feita aqui (`POST /portal/propostas/:id/decisao`), e o mandato pode ser **aprovado pelo proprietário** nesta tela.

### 11.4 Incorporadora

Herdado do MVP: Painel (disponíveis, reservas ativas, vencendo hoje, exceções pendentes, vendas do mês), Empreendimentos (dados, materiais por classificação, tabela versionada), Espelho (SVG esquemático por quadra/torre, cor por estado, clique abre unidade com preço da tabela vigente), Reservas (fila, confirmar, vencer), Corretores (credenciamento, autorização de anúncio), Exceções (alçada, decisão). Simulador de proposta na unidade: entrada, parcelas e valor da parcela calculados pela tabela vigente e pelos limites do empreendimento; fora dos limites, a proposta já nasce marcada para exceção. O corretor credenciado vê Espelho e Reservas em "Imóveis › De incorporadoras" e pede reserva e lista de espera dali.

### 11.5 Celular do corretor

**Referência:** Lais (app Casa da Lais), Compass One (cartões de ação).

| Tela | Conteúdo e comandos |
|---|---|
| **M1 · Hoje** | "Precisa de você" (passagens do Mensageiro e do Negociador), fila do dia em cartões com um toque, barra de **atalhos do dia** no rodapé da página: Conversas (com selo) · Criar · Imóveis · Assistente |
| **M2 · Conversa** | Voltar, nome e estado; **resumo da IA** em faixa; mensagens; aviso de passagem; ações rápidas (Sugestão · Imóvel · Portal · Proposta); compositor com áudio |
| **M3 · Novo imóvel** | Botão grande "Tirar fotos ou escolher da galeria"; miniaturas; "A IA já entendeu…"; **Ditar o resto**; Salvar rascunho · Continuar |
| **M8 · Aprovar negociação** (novo) | Notificação "Negociador sugere contraproposta para Juliana" → tela com a faixa ZOPA resumida, a mensagem sugerida, a concessão e a contrapartida; **Enviar · Editar · Assumir** |

### 11.6 O que o negociador humano vê (role `negociador`)

Pessoa convidada pelo corretor para conduzir negociações (ex.: um sócio ou um especialista). **Vê apenas os negócios atribuídos a ele** (`atribuicoes_negociacao`): trilho reduzido a **Hoje · Negociações · Conversas** (só as conversas desses negócios); P15 completo, inclusive mandato; não vê carteira, Estúdio, Página, Números gerais nem Ajustes. Toda mensagem dele sai pelo WhatsApp do corretor com o rótulo "Negociador" na linha do tempo do app (o cliente vê a assinatura configurada, ex.: "Rafael · equipe de negociação").

### 11.7 Menu Criar e comandos globais

| Comando | Onde | O que abre | Rota |
|---|---|---|---|
| Novo cliente | Criar | Captação em 3 passos (nome e telefone; o que procura; origem) | `POST /contatos` |
| Novo imóvel | Criar | P07 | `POST /imoveis` |
| Novo post | Criar | P08 com "Criar rápido" | `POST /pecas` |
| Nova visita | Criar | Seletor de cliente, imóvel e horário livre | `POST /atividades` |
| Nova proposta | Criar | P15 com seletor de negócio | `POST /negociacoes` |
| Busca global (`/`) | Cabeçalho de qualquer coluna esquerda | Resultados por tipo: clientes, imóveis, conversas, peças | `GET /busca?q=` |
| Assistente (`A`) | Trilho | P05 | `POST /assistente` |

### 11.8 Mapa resumido: tela × backend × integração

| Tela | Rotas principais | Eventos que publica | IA (slot) | Integração externa |
|---|---|---|---|---|
| P01 Hoje | `/inicio`, `/funil/fila` | `conversa.assumida` | `funil` | — |
| P02 Conversas | `/conversas`, `/envios`, `/modelos-mensagem` | `mensagem.enviada`, `envio.criado`, `visita.agendada` | `mensageiro`, `negociador` | WhatsApp |
| P03 Funil | `/negocios`, `/listas-salvas` | `negocio.etapa_mudou`, `negociacao.iniciada` | `funil`, `assistente` | — |
| P04 Ficha | `/contatos/:id`, `/itens-cliente` | `item_cliente.concedido` | `assistente` | — |
| P05 Assistente | `/assistente` | conforme a ação | `assistente` | — |
| P06–P07 Imóveis | `/imoveis`, upload | `imovel.criado`, `imovel.ativado` | `fotos`, `conteudo` | — |
| P08 Estúdio | `/pecas`, `/publicacoes` | `peca.gerada`, `publicacao.*` | `conteudo` | Canva, Instagram |
| P09 Página | `/paginas` | `pagina.publicada` | `conteudo` | Canva (visuais) |
| P10 Números | `/desempenho` | — | `assistente` (leitura) | — |
| P11–P13, P17 Ajustes | `/mensageiro`, `/conexoes/*`, `/conta`, `/negociador/config` | `*.alterad*` (auditáveis), `canal.*` | — | Meta (OAuth, cadastro incorporado) |
| P14 Importar | `/contatos/importar` | `contatos.importados` | `conteudo` (mapeamento) | — |
| P15–P16 Negociação | `/negociacoes/*` | `proposta.*`, `contraproposta.*`, `mandato.alterado`, `negociacao.*` | `negociador` | WhatsApp |
| M4–M5b Portal | `/portal/*` | `selecao.reagida`, `visita.pedida`, `proposta.recebida` | — | — |
| M6 Página pública | `/api/pub/portal_corretor/pagina`, `wh` formulário | `lead.recebido` | — | — |

### 11.9 Primitivos de UI por tela e lacunas

| Tela | Primitivos principais |
|---|---|
| Moldura | trilho como lista de `urbi-botao` com ícone; colunas com `urbi-2x1`/grid; `urbi-modal` para gavetas |
| P01 Hoje | `urbi-inbox-lista`, `urbi-card`, `urbi-kpi`, `urbi-badge`, `urbi-progresso` (se existir; senão barra simples) |
| P02 Conversas, M2, M4 | `urbi-inbox`, `urbi-chat`, `urbi-redator` (anexo e microfone), `urbi-ficha` |
| P03 Funil | `urbi-kanban`, `urbi-ficha`, `urbi-kpi` |
| P04 Ficha | `urbi-abas`, `urbi-feed` (linha do tempo), `urbi-tabela`, `urbi-ficha` |
| P05 Assistente | `urbi-chat`, `urbi-card` (ação proposta) |
| P06–P07, M3 Imóveis | `urbi-card`, `urbi-seletor-arquivo`, `urbi-visualizador-arquivo`, `urbi-formulario`, `urbi-mapa` (fase 3) |
| P08 Estúdio | `urbi-chat`, `urbi-visualizador-arquivo`, `urbi-toggle`, `urbi-lista` |
| P09 Página | `urbi-lista` (blocos), `urbi-abas` (celular/computador), `urbi-formulario` |
| P10 Números | `urbi-kpi`, `urbi-grafico-colunas`, `urbi-grafico-linha`, `urbi-tabela` |
| P11–P14, P16–P17 | `urbi-formulario`, `urbi-abas`, `urbi-toggle`, `urbi-chat` (testes), `urbi-planilha` (prévia da importação) |
| P15 Negociação | `urbi-feed` (escada de propostas), `urbi-chat`, `urbi-ficha`, **faixa ZOPA** (lacuna) |

**Lacunas a registrar como exceção nomeada ou pedir como primitivo novo:** calendário (agenda e publicações; até lá, lista por dia); pré-visualização da Minha Página dentro do editor; cartão de arte com proporção fixa; **faixa ZOPA** (régua horizontal com marcas e intervalo colorido, inspirada na imagem de referência de BATNA/ZOPA); seletor de três posições "Não faz · Pergunta antes · Faz sozinho".

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

**Eventos das telas do Padrão B (1.1, completam o catálogo):** `mensagem.enviada`, `envio.criado`, `conversa.devolvida`, `acesso_cliente.convidado`, `item_cliente.concedido`, `atividade.criada`, `automacao.criada`, `imovel.criado`, `imovel.visibilidade_mudou`, `peca.gerada`, `publicacao.agendada`, `pagina.publicada`, `contatos.importados`, `visita.pedida`, `proposta.registrada`; **auditáveis**: `canal.conectado`, `canal.desconectado`, `mensageiro.permissoes_alteradas`. Todos `segregado_por_conta: true`.

**Eventos de negociação (novos):** `negociacao.iniciada`, `proposta.recebida`, `contraproposta.sugerida`, `contraproposta.enviada`, `objecao.detectada`, `negociacao.limite_atingido`, `negociacao.acordo_proposto`, `proposta.decidida`, `proposta.aceite_cliente`, `negociacao.assumida`, `negociacao.encerrada`; **auditáveis**: `mandato.alterado`, `negociador.config_alterada`. Todos `segregado_por_conta: true`; os que envolvem mandato nunca carregam valores sigilosos no conteúdo do evento (só o id).

**Notificações novas:** contraproposta aguardando aprovação (corretor ou negociador humano, inbox e push, com atalho para M8); oferta recebida (corretor); passagem do Negociador (topo de Hoje); acordo proposto aguardando decisão (corretor); mandato vencendo em 24 h (corretor).

### 13.2 Erros de negócio

`AUTORIZACAO_AUSENTE`, `AUTORIZACAO_VENCIDA`, `CRECI_AUSENTE`, `FORA_DA_JANELA_WHATSAPP`, `MODELO_NAO_APROVADO`, `COTA_ATINGIDA`, `CONSENTIMENTO_REVOGADO`, `UNIDADE_INDISPONIVEL`, `RESERVA_JA_EXISTE`, `ACIMA_DA_ALCADA`, `TOKEN_EXPIRADO`, `DUPLICATA`, `CIENCIA_TITULAR_AUSENTE`, `CANAL_DESCONECTADO`. Cada um com frase para a tela no catálogo do manifesto.

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

**Na plataforma (4.4):** `dono_conta` e `corretor` desta tabela são o role externo `corretor` no MVP (gestor e equipe na fase 4); `proprietario`/comprador são o role externo `cliente`; a camada Plataforma são os roles de equipe `operacao` e `suporte`; o Mensageiro e o Assistente não são usuários, agem pelo backend com a autoria registrada.

**Negociador (1.1):**

| Recurso | Corretor | Negociador humano (role `negociador`) | Negociador IA | Cliente |
|---|---|---|---|---|
| Negociações | todas da conta | só as atribuídas | as ligadas a ele, dentro do mandato | só as dele, sem mandato |
| Mandato | criar, editar | ler | ler (no contexto, campos sigilosos marcados) | **nunca** |
| Propostas | todas | das atribuídas | registrar as que envia | as dele |
| Enviar contraproposta | sim | sim, dentro do mandato | conforme autonomia, dentro do mandato | — |
| Aceitar acordo final / registrar decisão do proprietário | sim | não | não | registra só a intenção |
| Conversas | todas | só as das negociações atribuídas | só a da negociação | a própria |
| Carteira, Estúdio, Página, Números, Ajustes | sim | não | — | — |

Na plataforma: `roles_externos.escrita` ganha `negociador`; toda rota de negociação checa o role e, para `negociador`, filtra por `atribuicoes_negociacao.usuario_id = usuario.id`.

## 15. Fases

Estimativa em sessões de implementação com o kit do UrbiVerso. Cada fase só começa quando a anterior cumpre o "pronto quando".

**O que é o MVP neste projeto (definição do dono, 17/10/2026):** a versão em que **as telas, as funções, as permissões, os botões, os caminhos e as automações** estão prontos e funcionando, testados pela **equipe interna** com contas e dados de teste. **Nenhum corretor real usa o MVP.** O corretor real entra na fase 2 (validação); só depois dela o MVP é considerado validado.

### 15.0 O que entra em cada fase

✅ entra · ➕ ampliação · — ainda não. F1 = MVP interno · F2 = validação com corretores reais.

| Módulo / capacidade | F1 MVP | F2 Valid. | F3 | F4 | F5 | F6 | F7 |
|---|---|---|---|---|---|---|---|
| Conta do corretor autônomo, marca, CRECI manual | ✅ | | | | | | |
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
| Negociador (IA e humano), mandato, propostas e contrapropostas, faixa ZOPA, respostas a objeções | ✅ | | ➕ decisão do proprietário no portal | ➕ negociadores da equipe | | | |
| Mensageiro com áudio, follow-up, reativação, financiamento | — | — | ✅ | | | | |
| Estúdio: post, carrossel, story, legendas, motor Canva | ✅ | | | | | | |
| Estúdio: vídeo, edição de foto, mobília virtual, calendário sugerido | — | — | ✅ | | | | |
| Publicar agora / agendar / baixar arquivos | ✅ | | | | | | |
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
| Conta e acesso | Cadastro do corretor com CRECI (verificação manual), marca, papéis `dono_conta`, `agente`, `operador_plataforma`, cliente externo por token; **segmentação completa (4.5)** |
| Assistente (A1) | Chat em todas as telas; dúvidas do produto com base nos `docs/` da app; ajuda a decidir; lembretes, tarefas e agendamentos de posts com confirmação |
| CRM e funil | Contatos, negócios, etapas configuráveis, temperatura com motivo, próxima abordagem com playbook semeado, fila do dia, linha do tempo, envios com abertura e clique, tarefas, agenda, visitas, importação CSV, exportação; **resumo do contato em um clique**, **mensagem sugerida** e **tarefa sugerida com um toque** |
| Imóveis e empreendimentos | Cadastro com fotos primeiro, descrição por IA, qualidade, autorização de venda anexada, empreendimentos cadastrados pelo corretor com materiais |
| WhatsApp | Conexão por cadastro incorporado com coexistência; caixa de conversas no app com **etiquetas, origem e status** por conversa e filtros (todas, não lidas, arquivadas); envio de imóvel **como cartão com foto e botão**, seleção, arquivo, localização, link do portal; modelos básicos; janela de 24 h; **origem do anúncio** gravada a partir dos dados de referência da primeira mensagem |
| Mensageiro (A2) | Configuração em 5 passos (nome, foto e tom de voz da marca); texto; aviso "corretor assumiu" e botão **reativar Mensageiro**; responder dúvidas, enviar imóveis, arquivos e seleções, agendar visitas e reuniões, link do portal; cada ação em "pergunta antes" ou "faz sozinho"; passagem com resumo; conversa de teste; custo visível |
| Conteúdo (A4) | Pedido em texto ou voz; motor de arte Canva para post, carrossel e story com a marca; legendas; pacote de lançamento; biblioteca de arquivos para baixar quantas vezes quiser; aprovação manual e por janela; **agendar** (mecanismo de 9.8), **publicar agora**, **baixar arquivos** |
| Negociação (A5) | Propostas e contrapropostas com rodadas; mandato por negócio (P16); Negociador IA nos três níveis e negociador humano (role `negociador`); faixa ZOPA; respostas a objeções (Apêndice D); prompt em duas partes (P17, Apêndice C); validações no código (10.9.7); decisão do proprietário registrada pelo corretor |
| Página | Minha Página por blocos montada pelo Estúdio e editável; ficha pública do imóvel; formulário por webhook |
| Cliente | Portal do Cliente comprador e seleções com reação, no celular |
| Números | KPIs da 11.2, mais **leads por horário**; **tabela de créditos por ação de IA** visível em Plano e consumo (medição, sem cobrança) |

**Fica de fora do MVP:** tudo marcado "—" na coluna F1 da 15.0.

**Pronto quando** (roteiros executados pela equipe, com registro):
1. **Telas:** todas as telas do corretor abertas e usadas no computador e no celular; Portal do Cliente e seleção no celular; estados vazio e de erro de cada uma vistos.
2. **Caminhos:** os fluxos de 2.3 e 2.4 percorridos de ponta a ponta sem atalho de desenvolvedor: cadastrar imóvel com fotos, gerar e publicar pacote de lançamento numa conta de teste do Instagram, receber mensagem no WhatsApp de teste, Mensageiro responder e marcar visita, cliente de teste abrir o portal e reagir.
3. **Permissões:** a matriz da seção 14 testada papel por papel; o teste de isolamento de 4.5 passa (corretor B e cliente de B não alcançam nada de A, nem pelo Mensageiro ou pelo Assistente).
4. **Automações:** cada regra (lembrete de visita, publicação agendada, janela de aprovação, temperatura, próxima abordagem) disparada e conferida, com o atraso real registrado em `pendencias_agendadas`.
5. **Números:** funil e tempo de resposta batem com a conferência manual sobre a semente.
6. **Ajuda:** o Assistente responde corretamente as 30 perguntas mais comuns do roteiro de teste.
7. **Instalação:** a app instala e atualiza na instância intermediária sem reprovação (identidade, pisos, schema, migrações).
8. **Negociação:** as 7 conversas-roteiro de 10.9.9 passam: nenhuma contraproposta abaixo do recuo, nenhum vazamento de recuo, alvo ou BATNA do vendedor, passagem correta ao corretor; um negociador humano de teste vê só a negociação atribuída.
9. **Padrão B:** todas as telas de 11.1, 11.3 e 11.5 seguem a moldura de 11.0, com os estados de 11.0.4.

**Estimativa:** 13 a 15 sessões (10 a 12 do escopo anterior + 3 da negociação). **Se precisar cortar**, nesta ordem: aprovação por janela, carrossel, importação CSV, nível "faz sozinho" do Negociador (ficam "só sugere" e "pergunta antes"), Portal do Cliente (fica só a seleção).

### 15.2 Fase 2 — Validação com corretores reais: "MVP validado"

**Pré-requisitos:** app registrado na Meta com verificação da empresa titular e acesso avançado (9.8, item 1); termos de uso, política de privacidade e consentimentos publicados; suporte definido.

**Como:** 3 a 5 corretores reais, cada um com o próprio WhatsApp, Instagram e clientes, por 4 semanas, usando o escopo do MVP. Acompanhamento semanal; ajustes de tela, texto, IA e automação.

**MVP validado quando:** cada corretor conectou WhatsApp e Instagram sem ajuda da equipe; publicou pelo menos 8 peças; o Mensageiro atendeu clientes reais sem nenhuma ação proibida; o tempo médio de primeira resposta caiu em relação ao início; nenhum incidente de vazamento entre contas; os corretores dizem que continuariam usando.

**Estimativa:** 3 a 4 sessões de ajustes, mais o período de uso.

### 15.3 Fase 3 — "relacionamento completo e proprietário"

Portal do Cliente **proprietário** com entregas, metas do imóvel, visitas com retorno revisado, propostas e comissão combinada, **decisão sobre propostas e aprovação do mandato pelo próprio proprietário**; relatório semanal. Mensageiro com **áudio**, follow-up e reativação, simulação de financiamento, agente do proprietário. Estúdio com **vídeo**, edição de foto e mobília virtual rotulada, calendário editorial sugerido. Atribuição de conteúdo a visita. **Estimativa:** 8 a 10 sessões.

### 15.4 Fase 4 — "equipe, metas e comissões"

Imobiliária com dono, gestor e corretores; fila compartilhada e reatribuição; metas com ritmo; comissões com divisões e recebimentos; Facebook, Instagram Direct e Messenger na mesma caixa; painel do gestor; planos e cobrança (P-11). **Estimativa:** 6 a 7 sessões.

### 15.5 Fase 5 — "rede e incorporadoras"

Conexões, grupos, perfil público, compartilhamento de imóvel e de necessidade de comprador, match, parcerias com termo e divisão, proteção de cliente; módulo Incorporadora completo. **Estimativa:** 6 a 7 sessões.

### 15.6 Fase 6 — "expansão de canais"

TikTok, YouTube Shorts, LinkedIn, Google; portais (feed e leads); assinatura eletrônica; agenda externa; domínio próprio, blog e SEO; Portal do Comprador pós-venda. **Estimativa:** 6 a 8 sessões.

### 15.7 Fase 7 — "futuro"

Agente de voz que liga; anúncios pagos; adiantamento de comissão e crédito; rede entre instalações e SGR do COFECI; leitura opcional do núcleo UP/Urbitá; app nativo se o shell não atender.

### 15.8 Itens incorporados das referências principais

As cinco referências principais (Compass One, Follow Up Boss, Morada.ai, Lais, Kenlo) estão detalhadas em `specs/referencias_principais.md`. Itens novos e a fase de cada um:

| Item | Referência | Fase |
|---|---|---|
| Imóvel enviado como cartão no WhatsApp (foto, preço, bairro, botão) | Lais | MVP |
| Etiquetas, origem e status em cada conversa; filtros todas/não lidas/arquivadas | Lais | MVP |
| Aviso "corretor assumiu" e botão "reativar Mensageiro" | Lais | MVP |
| Origem do anúncio gravada a partir da primeira mensagem | Morada | MVP |
| Resumo do contato em um clique; mensagem e tarefa sugeridas | Follow Up Boss | MVP |
| Leads por horário em Números | Lais | MVP |
| Tabela de créditos por ação de IA (medição) | Kenlo | MVP |
| Migração assistida com modelos de importação de outros CRMs | Follow Up Boss, Kenlo | F2 |
| Treinamento curto e comunidade de corretores | Follow Up Boss, Kenlo | F2 |
| Listas salvas pelo corretor | Follow Up Boss | F3 |
| Comportamento do contato na Minha Página e na seleção | Follow Up Boss | F3 |
| Remarketing para a base, com cota | Lais | F3 |
| Pedido de avaliação no Google no pós-atendimento e pós-venda | Lais | F3 |
| Portal: tarefas do cliente, datas-chave, aviso de imóveis novos | Compass One | F3 |
| Descrições em lote; alerta de anúncio parado com sugestão | Kenlo, Lais | F3 |
| Busca da carteira com mapa | Kenlo | F3 |
| Portal: equipe do negócio com contato | Compass One | F4 |
| Diagnóstico gratuito "quanto vale seu imóvel" na Minha Página | Morada | F6 |

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
| D-15 | Agente nunca cria ou altera proposta, reserva, preço, comissão ou autorização. **Única exceção (1.1):** o Negociador registra contrapropostas apenas dentro do mandato definido pelo corretor e validado no código (10.9.7); aceite final e mandato são sempre do corretor (D-59) | Permitir no nível autônomo | O app não decide pelo corretor (princípio 3) |
| D-16 | Tempo de atendimento em média + faixas | Mediana/percentil | Framework de dados não tem percentil nem mediana |
| D-17 | Conteúdo só publica após checagens legais (10.5) | Aviso sem bloqueio | Lei 6.530 e CRECI obrigatório |
| D-18 | Incorporadora é tipo de conta com módulo próprio | App separado para incorporadoras | O corretor precisa do estoque e da reserva no mesmo lugar onde atende |
| D-19 | Rede nativa na mesma instância, federada entre instâncias depois | Federar desde o início da rede | Reduz risco; P-16 |
| D-20 | Contato importado sem consentimento só recebe modelo de reengajamento | Agente fala livremente | LGPD |
| D-21 | Etapas configuráveis por conta com probabilidade | Etapas fixas do MVP | Imobiliárias têm funis próprios; previsão ponderada |
| D-22 | Ranking público entre corretores continua fora | Gamificação | Decisão do MVP mantida |
| D-23 | Cliente do corretor é usuário externo da conta do corretor, convidado pelo WhatsApp; seleções avulsas e Minha Página continuam públicas sem login (revista na 0.6) | Link com token sem conta | A plataforma isola o externo por conta; o acesso por senha é o do shell |
| D-24 | Corretor tem experiência completa no computador e no celular; cliente é celular primeiro | Corretor só no celular | Análise de funil e conteúdo pede tela grande; atendimento pede celular |
| D-25 | O WhatsApp do relacionamento passa pelo app, conectado por cadastro incorporado com coexistência | Integração por terceiros não oficiais | Histórico, IA e métricas dependem disso; coexistência mantém o aplicativo do corretor |
| D-26 | Instagram primeiro, com conta Business; Facebook e demais redes depois | Todas as redes no MVP | Foco do dono; mesma aprovação da Meta do WhatsApp |
| D-27 | Artes pelo Canva Enterprise **da plataforma**, em nome de cada corretor, com separação interna; motor interno como alternativa (D-35) | Exigir Canva do corretor | Direção do dono (17/10, 2ª rodada); o corretor não terá Canva Enterprise |
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
| D-44 | Artes pelo Canva Enterprise da plataforma como serviço prestado ao corretor, sem acesso dele ao Canva | Exigir aval escrito do Canva antes | Decisão do dono: a plataforma é a produtora do conteúdo |
| D-45 | Toda arte e legenda fica na biblioteca do Estúdio, baixável quantas vezes o corretor quiser | Arquivo só no momento da geração | Permite agendar por fora a qualquer hora |
| D-46 | Contato (lead) e anúncio são dados comerciais da app, no schema da app, segregados por RLS (confirmado pelo dono em 18/10); vínculo opcional a `pessoas` e `imobiliario`; unidades de empreendimento no módulo `imobiliario` | Usar os módulos como cadastro principal | Lead sem CPF; unicidade global de telefone e e-mail no módulo quebraria o isolamento entre corretores; corretor em instância sem o módulo |
| D-47 | Corretor e cliente são usuários externos da conta do corretor, diferenciados por `roles_externos` (`corretor`, `cliente`); toda tabela segregada e restrita | Corretor como colaborador interno | Isolamento por RLS entre corretores; o cliente entra como externo, como o dono pediu |
| D-48 | Mensageiro responde só em texto; áudio recebido é transcrito (fase 3) | Responder em áudio | A IA da plataforma não oferece voz sintética e proíbe chamar provedor direto |
| D-49 | Agendamentos por `req.eventos.agendar` | Relógio externo ou só rotina | Recurso nativo com precisão de minuto |
| D-50 | IA em chamada única com JSON Schema; o app executa as ações | Agente com uso de ferramentas | Regra da plataforma; trilha clara |
| D-51 | Configuração por conta em tabela; `parametros` só para a instalação | Parâmetros por conta | `parametros` vale para a instalação inteira |
| D-52 | Não implementar ajuda, bug, sugestão e "sobre"; o Assistente usa os `docs/` da app como base | Tela de ajuda própria | A plataforma já oferece o widget |
| D-53 | Um ingresso `wh` por conta, configurado como endereço alternativo do número do corretor na Meta | Um endereço único com tabela de roteamento | A conta vem do próprio ingresso; nenhuma tabela fora do RLS |
| D-54 | Specs ficam em `specs/` na raiz do repositório (fora do pacote); `apps/portal_corretor/docs/` é a documentação da app em produção | Specs dentro de `docs/` da app | O pacote da plataforma exclui `specs/`; `docs/` alimenta a ajuda |
| D-55 | Compass One, Follow Up Boss, Morada.ai, Lais e Kenlo são as referências principais de tela, funcionalidade e automação; itens adotados em 15.8 | Referências difusas | Escolha do dono (18/10) |
| D-56 | Padrão B (trilho de ícones + três colunas: lista, foco, contexto) é o padrão oficial de todas as telas | Direções A (painel de comando) e C (fila guiada) | Escolha do dono em 18/10 sobre o canvas de design; um molde só para quem implementa e para quem usa |
| D-57 | Funil, lista e negociações são visões dentro de Clientes; Mensageiro, Negociador, Conexões, Conta e Plano ficam em Ajustes | Itens próprios no menu | Menu do dia a dia com 8 itens; configuração fica onde se configura |
| D-58 | Novo papel **Negociador**, exercido por IA (slot `negociador`) ou por humano (role externo `negociador`), dentro de um **mandato** por negócio | Negociação só pelo corretor | Pedido do dono: respostas específicas na etapa de negociação com base em BATNA, ZOPA e tratamento de objeções |
| D-59 | O Negociador nunca aceita acordo final, nunca vai abaixo do ponto de recuo, nunca revela recuo, alvo ou BATNA do vendedor; tudo validado **no código** (10.9.7) | Confiar nas instruções do modelo | Proteger o vendedor e o corretor; regra da plataforma de a app executar as ações |
| D-60 | "Faz sozinho dentro da faixa" exige autorização do proprietário registrada no mandato | Autonomia sem registro | Responsabilidade do corretor perante o proprietário |
| D-61 | Propostas, contrapropostas, mandato e Negociador (IA e humano) entram no MVP; a decisão do proprietário pelo portal fica na fase 3 (no MVP o corretor registra) | Tudo de negociação na fase 3 | O MVP testa telas, funções e automações; a negociação é o momento de maior valor do funil |
| D-62 | Prompt do Negociador em duas partes: regras fixas da plataforma + instruções editáveis do corretor; respostas a objeções editáveis por categoria | Prompt livre | Simplicidade para o corretor e segurança das regras |
| D-63 | Faixa ZOPA como componente visual de P15 (régua com recuo, alvo, pedido, oferta e teto estimado) | Só números em lista | O corretor entende a negociação num olhar; referência da imagem do dono |

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
| P-12 | Verificação de CRECI: manual com documento, ou consulta por regional | Fase 1 |
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
| P-31 | Shell: `wh` responder o `GET` de verificação da Meta (`specs/pedidos_ao_shell.md`, item 1) | **MVP, bloco 6** |
| P-32 | Shell: handler `wh` recebe corpo cru e cabeçalhos (`specs/pedidos_ao_shell.md`, item 2) | **MVP, bloco 6** |
| P-33 | Confirmar no SDK: handler `wh` lê o contexto do ingresso (conta); listener grava com `dados.comConta`; rota pública lê tabelas segregadas (senão `vitrine_publica`) (`specs/pedidos_ao_shell.md`, item 3) | MVP, blocos 0 e 5 |
| P-34 | ~~Contato e anúncio como dados da app~~ — confirmado pelo dono em 18/10 | — |
| P-35 | Corretor que entra numa imobiliária (externo pertence a uma conta só) — tratar só na fase 4 | Fase 4 |
| P-36 | Frontend da app pode abrir o cadastro incorporado hospedado da Meta e o OAuth do Instagram por redirecionamento e receber o retorno numa sub-rota da app? | MVP |
| P-37 | Frontend recebe eventos do barramento em tempo real (conversas e negociações) ou precisa atualizar periodicamente? | MVP |
| P-38 | Forma de registrar a autorização do proprietário para "faz sozinho" (anexo assinado, mensagem registrada, aceite no portal na fase 3) | MVP |
| P-39 | Estilo padrão do Negociador (cooperativo) e textos finais do Apêndice D revisados por um especialista em vendas imobiliárias | Fase 2 |
| P-40 | O negociador humano convidado precisa de CRECI? (proposta: sim, quando não for o próprio corretor) | MVP |

**Soluções das dependências do MVP:** seção 9.8 (Meta, hora marcada, webhook, chamadas externas) e 9.4 (Canva).

## 18. Testes e critério global de pronto

Por fase: testes de API para toda rota (papel certo passa, papel errado recebe 403, recurso de outra conta responde "não encontrado"); testes de rotina rodando duas vezes no mesmo período sem duplicar; teste de vazamento (parceiro, proprietário e página pública nunca recebem dado de proprietário, comprador, comissão interna); teste de fórmula para cada KPI de 11.2 contra planilha calculada à mão a partir da semente; teste de agente com conversas-roteiro (lead quente, pedido de desconto, pede humano, ofensa, fora do horário, consentimento revogado) verificando passagens e ações proibidas; teste de checagens legais de conteúdo; **teste de negociação** (10.9.9) com verificação automática de piso, passo, rodadas e sigilo em toda mensagem do Negociador.

Toda funcionalidade nova entra com seu texto em `docs/` da app (ajuda da plataforma e base do Assistente). Toda tela do corretor é verificada no computador e no celular; toda superfície do cliente, primeiro no celular.

Critério global: alguém que nunca falou com o dono implementa cada fase só com esta spec e os docs da plataforma; nenhuma rota sem tela e nenhuma tela sem rota; todo número na tela tem fonte, período e fórmula; ausência é frase; nada referencia capacidade do SDK sem o piso citado (P-01). Quando uma fase vira código, o conteúdo dela sai daqui e migra para `docs/` da app.

## 19. Glossário

**Autorização de venda**: documento em que o proprietário autoriza o corretor a anunciar e vender, com prazo, preço e comissão. **Captação**: conquista de um imóvel para a carteira. **Conta**: tenant do app. **Coorte**: conjunto de negócios criados no mesmo período, acompanhados até o fim. **Entrega**: compromisso do corretor com o proprietário. **Espelho**: mapa de unidades com o estado de cada uma. **Janela de 24 h**: período após a última mensagem do cliente em que o WhatsApp permite texto livre. **Lista de espera**: pedido de aviso quando uma unidade volta a ficar disponível. **Passagem**: transferência da conversa do agente para o humano. **Previsão ponderada**: comissão esperada considerando a probabilidade de cada etapa. **Primeiro atendimento**: tempo entre a primeira mensagem do lead e a primeira resposta. **Seleção**: lista de imóveis enviada a um cliente por link. **VGV**: valor geral de vendas.

--- **BATNA**: a melhor alternativa de uma parte caso a negociação não chegue a acordo (o "plano B"). **ZOPA**: zona de possível acordo, entre o ponto de recuo do vendedor e o teto do comprador. **Ponto de recuo**: o valor a partir do qual a melhor opção é sair da negociação e ficar com a BATNA. **Âncora**: o primeiro valor apresentado, que orienta a conversa. **Mandato**: os limites e as concessões que o corretor autoriza o Negociador a usar num negócio. **Contrapartida**: o que se pede em troca de uma concessão.

---

## Anexo R. Referências de mercado

O que as referências pesquisadas em 17/10/2026 mostram e onde isso entrou na spec.

**R1 · Velocidade de resposta.** Estudo MIT/InsideSales (2007): responder em 5 min torna a qualificação do lead muitas vezes mais provável do que em 30 min. Estudo WAV Group/Weichert (2014): tempo médio de resposta de corretores de cerca de 15 h. Auditoria de 2024 com 74 corretoras americanas: menos de 1 em 10 respondeu em 5 min. No Brasil, levantamento citado da Morada.ai com incorporadoras: primeiro contato em cerca de 5 h e quase metade dos leads sem resposta (fonte secundária). → Princípio 9, D-08, agente `sdr`, cronômetro do Início, KPI de primeiro atendimento.

**R2 · Quem chega primeiro e indicação.** NAR, Profile of Home Buyers and Sellers 2025: a maioria dos compradores entrevista um único corretor; indicação e relacionamento anterior são a principal forma de encontrar corretor, sobretudo entre vendedores. → Agentes `pos_venda` e `reativacao`, rotina `pos_venda`, pedido de indicação.

**R3 · CRMs internacionais.** Follow Up Boss: planos de ação automáticos, listas inteligentes, reatribuição automática de lead não contatado, "pond" de leads compartilhados (help.followupboss.com). Lofty/Chime: site com busca integrada ao CRM, planos inteligentes com mensagem automática nos primeiros minutos, assistente de IA. Homebot: relatório periódico de valorização para clientes antigos, abertura mensal alta, aviso quando ex-cliente põe o imóvel à venda (homebot.ai). → Níveis de autonomia, passagens, relatório anual de valorização, nutrição.

**R4 · Brasil.** Facilita/Sienge: fila de distribuição de leads entre corretores, espelho horizontal e vertical, programa de pontos. CV CRM/Sienge: nota de qualificação do lead, simulador de proposta pela tabela, aviso quando a unidade volta ao mercado (sienge.com.br/blog). DWV: tabelas, materiais e disponibilidade de lançamentos para corretores. Kenlo, Jetimob, Imobzi (referências do MVP): CRM, site, integração com portais, rede de parcerias. → Nota de qualificação (6.12), lista de espera (6.9), módulo Incorporadora, Rede.

**R5 · Economia do corretor e do canal.** Cofeci/DataZAP 2025: cerca de 650 mil corretores no Brasil, poucas transações por corretor por ano em comparação com os EUA, tempo de venda muito maior e renda média baixa (paraibabusiness.com.br). WhatsApp Business Platform: cobrança por mensagem desde 01/07/2025; contas novas no Brasil faturadas em BRL desde julho/2026 (developers.facebook.com); mensagem de utilidade da ordem de centavos de real (fonte secundária). → Princípio 10, consumo por conta, categoria de cobrança gravada em cada mensagem, modo `rascunho` ao atingir cota.

**R6 · Regras legais.** Lei 6.530/78, art. 20: vedado anunciar sem autorização escrita e sem o número de inscrição (creci-sc.gov.br). Código de Ética, Res. COFECI 326/92: vedado desviar cliente e aceitar transação entregue a outro corretor sem ciência escrita (legisweb.com.br). LGPD. → 9.7, D-07, D-17, D-20, 6.14.

**Lacunas do MVP cobertas por estas referências:** cronômetro e reatribuição do primeiro atendimento; lista de espera de unidade; relacionamento pós-venda; simulador pela tabela (fase 6, na proposta); ficha de visita; verificação de CRECI; importação de contatos; custo por origem.

**R7 · Negociação.** Fisher, Ury e Patton, *Como Chegar ao Sim* (Harvard Negotiation Project), origem do conceito de BATNA e dos princípios de focar interesses, criar opções e usar critérios objetivos. Grupo LU, "BATNA, ZOPA e Ponto de Recuo: os 3 conceitos fundamentais para qualquer negociador" (https://grupolu.com/batna-zopa-e-ponto-de-recuo/), com o exemplo de João e Maria e a imagem da régua de negociação enviada pelo dono. Chris Voss, *Negocie Como Se Sua Vida Dependesse Disso* (empatia tática, perguntas abertas). Robert Cialdini, *As Armas da Persuasão* (reciprocidade, prova social; usados só com fatos verdadeiros). Tversky e Kahneman (efeito de ancoragem). → 10.9, P15–P17, Apêndices C e D.

## Apêndice A. Texto da issue

**Título:** Spec do app Portal do Corretor (`portal_corretor`)

**Contexto.** O MVP (laboratório Urbiverso UP/Urbitá v2) validou o fluxo do corretor e do canal comercial. O dono consolidou a visão entre 17 e 19/10/2026 (inclui Padrão B de telas e o papel Negociador): escritório digital do corretor no computador e no celular, com CRM e funil com IA, WhatsApp pelo app com o Mensageiro (texto; áudio recebido transcrito na fase 3), Assistente do Corretor, Estúdio de Conteúdo com publicação no Instagram, Minha Página e Portal do Cliente como usuário externo; rede, proprietário, metas e comissões nas fases seguintes; independente do núcleo.

**O que precisa ser feito.** Implementar a fase 1 (MVP interno) conforme `specs/plano_de_implementacao.md`, mantendo `specs/portal_corretor.md` cobrindo as 19 seções do roteiro de spec, com decisões `D-nn` e pendências `P-nn`.

**Critérios de aceite.** Fase 1 implementável só com a spec e os docs; todo KPI com fonte, período e fórmula; toda afirmação de plataforma conferida nos docs com versão citada; nenhuma rota sem tela.

**Notas técnicas.** Multi-conta; restrições de rotina, página pública, geometria e agregados aplicadas (seção 4.3); P-01 bloqueia a fase 1.

## Apêndice B. Implementação

As instruções permanentes das sessões estão em `CLAUDE.md` (raiz do repositório) e a ordem de trabalho, com o status de cada bloco, em `specs/plano_de_implementacao.md`. Os ajustes necessários no shell estão em `specs/pedidos_ao_shell.md`.

## Apêndice C. Prompt padrão do Negociador

O texto abaixo é semeado em `config_negociador.instrucoes_padrao` e aparece em P17 para o corretor editar a parte 2. A parte 1 é fixa e sempre vem antes.

**Parte 1 — regras fixas da plataforma (não editáveis)**

```
Você é o Negociador do corretor {{nome_corretor}} (CRECI {{creci}}). Você negocia a venda do imóvel {{imovel_titulo}} em nome do vendedor, com honestidade e respeito ao comprador.

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
