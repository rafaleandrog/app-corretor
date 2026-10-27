# Stack funcional completa — Portal do Corretor

| Campo | Valor |
|---|---|
| Versão | 1.6 — 27/10/2026 (direção do dono e frameworks do UrbiVerso incorporados; ver 1.1 e 1.2; Padrão B e Negociador do insumo de 27/10) |
| Papel deste documento | Descrever **o app inteiro como deveria funcionar**, sem amarras de plataforma: capacidades, fluxos, arquitetura de referência, componentes e fornecedores. A tradução para o UrbiVerso acontece depois, numa sessão do Claude Code com os docs (seção 16 traz o mapa e a seção 17 a instrução pronta). |
| Documentos irmãos | `specs/portal_corretor.md` (spec, vale sobre este) · `specs/referencias.md` · `CLAUDE.md` |
| Regra de leitura | Documento de **intenção de produto** e visão de futuro. Para implementar, vale a spec; onde a plataforma não comportar algo daqui, a spec já registra a alternativa como decisão. |

---

## 1. O produto em uma página

**Para quem:** qualquer corretor de imóveis no Brasil — autônomo, de equipe ou de imobiliária — e, como lado secundário, incorporadoras que vendem por corretores.

**Promessa:** o corretor faz só o que exige gente (visitar, negociar, fechar). Atender, qualificar, acompanhar, produzir conteúdo, divulgar, prestar contas ao proprietário e organizar parcerias e comissões é feito ou preparado pelo app.

**Três números que o produto persegue:**
1. **Tempo até a primeira resposta:** segundos, 24 h por dia. O mercado brasileiro responde em horas.
2. **Custo por venda:** menos gasto com portal, designer, editor de vídeo, secretária e ferramentas soltas.
3. **Taxa de conversão de lead em visita e de visita em proposta:** medida, comparada e melhorada.

### 1.1 Direção do dono (17/10/2026), que prevalece sobre o resto deste documento

- **Quatro capacidades de IA:** Assistente do Corretor (interno: dúvidas sobre tudo que o app oferece, ajuda a decidir, configura automações com confirmação); **Mensageiro** (fala com os clientes no WhatsApp, texto e áudio, agenda visitas, conversas e reuniões, envia arquivos e informações, responde sozinho quando permitido; produto à parte, talvez com custo adicional); Inteligência do Funil (temperatura com motivo, próxima abordagem por etapa); Estúdio de Conteúdo (artes e legendas para Instagram, landing page).
- **Escala de acesso:** plataforma → corretor → cliente do corretor, que entra como **usuário externo** por link enviado no WhatsApp.
- **Duas visões separadas:** corretor no computador e no celular; cliente no celular (referências: conceito de app imobiliário mobile e Compass One).
- **WhatsApp do relacionamento passa pelo app**, conectado por cadastro incorporado com **coexistência** (o corretor mantém o WhatsApp Business no celular).
- **Instagram primeiro** (conta Business para stories); demais redes depois.
- **Artes pelo Canva Enterprise da plataforma**, como serviço prestado ao corretor (a plataforma é a produtora do conteúdo; o corretor não acessa o Canva), com separação interna por conta; motor interno como reserva técnica. Landing page continua página do app, com visuais do Canva.
- **Contas do corretor:** WhatsApp, Instagram e Facebook são dele; ele autoriza o app. A plataforma só registra o software na Meta, não tem conta para publicar.
- **Três modos de publicação no Instagram:** agendar, publicar agora, baixar arquivos (quantas vezes quiser) e agendar por fora no Instagram ou no Meta Business Suite.
- **Segmentação:** corretor não vê nada de outro corretor; cliente só vê o que recebeu (spec 4.5).
- **Padrão B oficial nas telas** e novo papel **Negociador** (IA ou humano, com mandato, BATNA, ZOPA e respostas a objeções) — spec 10.9 e 11.
- **Corretor cadastra os próprios empreendimentos** desde o MVP.
- **MVP e fases:** os da spec 0.5, seção 15. O MVP é interno (telas, funções, permissões, caminhos, automações, testados pela equipe, sem corretor real); a validação com corretores reais é a fase 2.

### 1.2 O que a plataforma UrbiVerso já determina (resumo dos frameworks, 18/10/2026)

- **Stack fixa:** Node 20 + Express + TypeScript, frontend Lit com primitivos `urbi-*`, PostgreSQL com um schema por app, esbuild. As escolhas técnicas da seção 4.2 abaixo valem só como intenção; na plataforma, quem decide é o framework.
- **Multi-conta nativo:** tabelas `segregada_por_conta` com RLS; corretor e cliente como usuários externos da conta do corretor, por roles.
- **Agendamento nativo** (`req.eventos.agendar`, precisão de minuto): agendar post e lembrete sem relógio externo.
- **IA por JSON Schema** (`req.ia.consultar`), sem agente com ferramentas, sem voz sintética, sem geração de imagem: o app executa as ações que a IA decide; o Mensageiro responde em texto e transcreve áudio.
- **Webhooks só por `POST`**, anônimos, com 30 s: o handler publica evento e o listener faz o trabalho.
- **Páginas públicas só GET**, sem tema da plataforma: marca do corretor como dado.
- **Ajuda, bug e sugestão** já vêm da plataforma; o Assistente usa os `docs/` da app.
- **Pessoa e imóvel** existem como módulos; contato (lead) e anúncio ficam como dados comerciais da app, com vínculo opcional.

**Oito pilares:**

| # | Pilar | Em uma frase |
|---|---|---|
| P1 | CRM e funil | Todos os clientes, negócios, tarefas e visitas, com funil e métricas de conversão |
| P2 | Agentes de IA | Atendimento, qualificação, agendamento, nutrição, pós-venda e copiloto do corretor, com autonomia ajustável |
| P3 | WhatsApp e canais | WhatsApp oficial como canal principal, mais Instagram, página e e-mail numa caixa só |
| P4 | Conteúdo | Posts, carrosséis, stories, vídeos e textos gerados a partir do imóvel e da marca do corretor |
| P5 | Divulgação automática | Publicação programada em redes, página, portais e rede de corretores, disparada por eventos |
| P6 | Rede | Conexão com corretores e empresas, compartilhamento de imóveis e necessidades, parcerias com divisão |
| P7 | Proprietário | Portal do dono do imóvel com entregas, metas, visitas, propostas, comissão e conversa |
| P8 | Metas e comissão | Metas de atividade e resultado, comissão prevista, dividida e recebida |

Mais um módulo de nicho: **Incorporadora** (estoque, tabela, espelho, reserva, exceções), herdado do MVP.

---

## 2. Jornadas ponta a ponta

### J1 — Lead até a venda (o coração do produto)

1. Cliente clica num anúncio, post, página ou portal → cai no WhatsApp do corretor ou num formulário.
2. **Agente SDR responde em segundos**, apresenta-se como assistente do corretor, entende texto e áudio.
3. Qualifica em conversa natural: o que procura, onde, faixa de preço, forma de pagamento, prazo. Pode simular financiamento.
4. Busca imóveis compatíveis (carteira própria + rede + incorporadoras credenciadas) e manda uma **seleção** por link.
5. Cliente reage na seleção ("gostei", "não gostei", "quero visitar", "conversar sobre o preço").
6. Agente oferece horários livres e **pré-agenda a visita**; corretor confirma com um toque (ou confirma sozinho no modo autônomo).
7. Véspera: lembrete ao cliente; dia: rota e ficha de visita no celular do corretor.
8. Depois da visita: agente pede feedback ao cliente; corretor registra o dele; feedback vai ao proprietário depois de revisado.
9. Proposta: o corretor monta (ou o app sugere a partir da conversa), envia ao proprietário pelo portal, registra decisão e contraproposta.
10. Fechamento: comissão calculada e dividida (com parceiros, se houver), recebimentos registrados.
11. Pós-venda: agente parabeniza, manda valorização periódica, pede indicação, avisa o corretor se o cliente pensar em vender.

### J2 — Captação até a venda (lado do proprietário)

1. Proprietário chega (indicação, placa, post de captação, página).
2. Corretor faz a avaliação com o radar de preço; app gera a **apresentação de captação** com plano de marketing e compromissos (entregas).
3. Autorização de venda assinada digitalmente, com exclusividade, prazo, preço e comissão.
4. Fotos (do corretor ou de fotógrafo) → app trata, gera descrição, vídeo e campanha; checa autorização e CRECI; publica.
5. Proprietário recebe acesso ao **portal**: vê entregas cumpridas com prova, métricas, visitas, feedbacks e propostas.
6. Relatório semanal automático; revisão de preço combinada na data se as metas não forem atingidas.
7. Imóvel pode ser aberto à rede para parceria, se a autorização permitir.

### J3 — Conteúdo semanal sem esforço

1. Toda segunda o agente de conteúdo propõe o calendário da semana (imóveis novos, baixas de preço, vendidos, bairro, autoridade).
2. Gera as peças com a marca do corretor.
3. Corretor aprova em lote, ou deixa a **janela de aprovação** correr (publica sozinho no prazo se ninguém mexer).
4. Cada peça sai com link rastreado; o app mostra quais peças viraram lead e visita.

### J4 — Parceria

1. Corretor tem comprador e não tem o imóvel → publica a necessidade na rede (sem dados do cliente).
2. App cruza com imóveis compartilhados de outros corretores e sugere o match; o captador também é avisado.
3. Proposta de parceria com divisão; termo assinado no aceite; ciência do titular se houver exclusividade.
4. Negócio corre com os dois lados vendo só o que lhes cabe; comissão dividida no fechamento.

### J5 — Gestor de equipe

1. Vê a fila de leads e quem está atrasado; reatribui ou deixa a regra reatribuir.
2. Acompanha funil, tempo de resposta e metas por corretor (sem ranking público).
3. Recebe resumo semanal de cada um e alertas de cliente quente parado.

---

## 3. Módulos e capacidades

Legenda de prioridade: **E** essencial (sem isso não há produto), **D** diferencial (o que faz trocar de ferramenta), **F** futuro.

### 3.1 CRM e funil (P1)

| Capacidade | Prioridade | Detalhe |
|---|---|---|
| Contatos com papéis (comprador, proprietário, investidor, parceiro, fornecedor) | E | Um contato, vários papéis |
| Negócios por pipeline (compra, captação/venda, incorporadora) com etapas configuráveis e probabilidade | E | Um contato pode ter vários negócios |
| Linha do tempo única (mensagens, visitas, reações, mudanças de etapa, ações do agente) | E | Fonte para funil, auditoria e relatório |
| Tarefas, retornos, agenda, visitas com ficha | E | Ficha de visita assinada protege a comissão |
| Captação rápida em 3 passos pelo celular | E | Herdado do MVP |
| Importação de contatos (CSV, planilha, vCard do celular) e de imóveis | E | Com unificação de duplicados |
| Deduplicação por telefone normalizado e e-mail | E | |
| Listas inteligentes do dia (novos, sem contato, quentes, parados, retorno vencido) | E | Padrão Follow Up Boss |
| Nota de qualificação e temperatura | D | Calculada e explicada |
| Reatribuição automática e fila compartilhada de equipe | D | Padrão Follow Up Boss |
| Busca por voz e ditado de notas | D | "Anota: cliente quer 3 quartos no Sudoeste até 900 mil" |
| Portal do Comprador (painel do cliente comprador) | F | Padrão Compass One |

### 3.2 Agentes de IA (P2) — detalhe na seção 6

| Agente | Prioridade | Função |
|---|---|---|
| SDR (primeiro atendimento) | E | Responde, qualifica, sugere, agenda |
| Nutrição | E | Follow-ups com motivo concreto, novos imóveis compatíveis |
| Proprietário | D | Responde o dono do imóvel com dados reais, prepara relatório |
| Conteúdo | D | Calendário, legendas, descrições, roteiros |
| Reativação | D | Retoma clientes frios |
| Pós-venda | D | Valorização, datas, indicação |
| Copiloto do corretor | D | Assistente interno: "o que eu faço hoje?", "resume esse cliente", "monta a proposta", "quanto eu tenho a receber?" (padrão Leo da Real) |
| Agente de voz (ligação) | F | Liga para lead que não respondeu por mensagem, com consentimento |

### 3.3 WhatsApp e canais (P3)

| Capacidade | Prioridade |
|---|---|
| WhatsApp oficial (Cloud API) no número do corretor ou da imobiliária | E |
| Caixa unificada (WhatsApp, Instagram Direct, Messenger, página, portal do proprietário, e-mail) | E (WhatsApp) / D (demais) |
| Áudio: transcrição de entrada; resposta em texto, opcionalmente em áudio com voz sintética | D |
| Modelos aprovados (lembrete de visita, relatório, reengajamento) com controle de categoria e custo | E |
| Janela de 24 h visível; bloqueio de texto livre fora dela | E |
| Passar e devolver conversa entre agente e humano com resumo | E |
| Notas internas na conversa | E |
| Respostas rápidas e envio de imóvel, seleção, localização, documento | E |
| Link "wa.me" para quem ainda não conectou o número oficial | E |

### 3.4 Conteúdo (P4) — detalhe na seção 7

| Capacidade | Prioridade |
|---|---|
| Kit de marca do corretor (cores, fontes, logo, foto, assinatura com CRECI, tom de voz) | E |
| Descrição do imóvel para página, portal e redes, com variações | E |
| Post único, carrossel e story a partir de templates com camadas variáveis | E |
| Tratamento de foto (luz, nitidez, endireitar, céu) e ordenação automática das melhores | D |
| Vídeo vertical a partir das fotos (movimento de câmera, legenda, música, narração) | D |
| Vídeo com avatar e voz do corretor (consentido) | F |
| Virtual staging, sempre rotulado | D |
| Relatório de bairro e de mercado como peça de captação | D |
| Blog e SEO da página do corretor | F |
| Calendário editorial sugerido | D |

### 3.5 Divulgação automática (P5)

| Capacidade | Prioridade |
|---|---|
| Regras: imóvel ativado, preço reduzido, vendido, visita aberta, calendário fixo | E |
| Publicação em Instagram e Facebook | E |
| TikTok, YouTube Shorts, LinkedIn, Perfil da Empresa no Google | D |
| Página do corretor e ficha pública atualizadas sozinhas | E |
| Feed para portais (ZAP/VivaReal/OLX e outros) | D |
| Disparo para rede de corretores e grupos | D |
| Aprovação manual, automática ou por janela de tempo | E |
| Link rastreado por peça e por canal; atribuição de lead e visita | E |
| Impulsionamento pago (anúncio) | F |

### 3.6 Rede (P6)

| Capacidade | Prioridade |
|---|---|
| Perfil público do corretor com CRECI, regiões, especialidades | E |
| Conexões e grupos (por região, tipo, faixa) | E |
| Compartilhar imóvel com conexões, grupos ou rede aberta, com divisão proposta | E |
| Publicar necessidade de comprador sem dados do cliente | D |
| Match automático comprador × imóvel compartilhado | D |
| Parceria com termo digital, divisão e ciência do titular | E |
| Proteção de cliente apresentado | E |
| Avaliação de parceiros depois do negócio | D |
| Rede entre instâncias/empresas diferentes | F |
| Integração com o SGR do COFECI se abrir | F |

### 3.7 Proprietário (P7)

| Capacidade | Prioridade |
|---|---|
| Portal por link, sem senha (com opção de entrar com código por WhatsApp) | E |
| Situação do imóvel, entregas com prova, metas do período e andamento | E |
| Visitas e feedbacks revisados pelo corretor antes de publicar (padrão ShowingTime) | E |
| Propostas recebidas sem nome do comprador; ciência e resposta | E |
| Comissão combinada e valor estimado ao preço atual | E |
| Conversa com o corretor (e com o agente proprietário fora do horário) | E |
| Relatório semanal e revisão de preço combinada | E |
| Aprovar conteúdo do próprio imóvel, se combinado | D |
| Confirmar horários de visita | D |
| Documentos pendentes do proprietário (matrícula, IPTU, certidões) com checklist | D |

### 3.8 Metas e comissão (P8)

| Capacidade | Prioridade |
|---|---|
| Metas de atividade (contatos, visitas, captações, peças) e de resultado (vendas, VGV, comissão) | E |
| Ritmo esperado no dia do período ("você está 20% atrás") | E |
| Comissão prevista ponderada pelo funil | E |
| Divisões (captador, vendedor, imobiliária, parceiro, indicação) | E |
| Recebimentos e a receber, com comprovante | E |
| Recibo de comissão em PDF | D |
| Adiantamento de comissão via parceiro financeiro | F |

### 3.9 Incorporadora

Herdado do MVP: empreendimentos, unidades, tabela versionada, espelho, credenciamento de corretores, reservas com fila, lista de espera, exceções com alçada, materiais por classificação, simulador de proposta pela tabela. Acrescentar: **comissão do empreendimento visível ao corretor** (padrão Apto) e **distribuição de leads da incorporadora entre credenciados** (padrão Facilita).

---

## 4. Arquitetura de referência (agnóstica de plataforma)

```
┌──────────────────────────── Superfícies ────────────────────────────┐
│ App do corretor (PWA, celular primeiro) · Painel do gestor          │
│ Portal do proprietário · Página/ficha pública · Seleção · Cartão    │
│ de rede · Painel da incorporadora                                   │
└───────────────┬─────────────────────────────────────┬───────────────┘
                │ API (REST/JSON, autenticada)        │ Páginas públicas (leitura)
┌───────────────▼─────────────────────────────────────▼───────────────┐
│ Núcleo de domínio: CRM · Imóveis · Conteúdo · Rede · Proprietário · │
│ Metas/Comissões · Incorporadora · Contas/Permissões                 │
└───────┬───────────────┬────────────────┬───────────────┬────────────┘
        │ eventos        │                │               │
┌───────▼──────┐ ┌──────▼───────┐ ┌──────▼──────┐ ┌──────▼───────────┐
│ Barramento + │ │ Motor de     │ │ Motor de    │ │ Hub de           │
│ filas e      │ │ agentes      │ │ conteúdo    │ │ integrações      │
│ agendador    │ │ (LLM, tools, │ │ (templates, │ │ (WhatsApp, redes,│
│              │ │ memória,     │ │ render, IA  │ │ portais, assina- │
│              │ │ guardrails)  │ │ de imagem e │ │ tura, mapas,     │
│              │ │              │ │ vídeo)      │ │ CRECI, agenda)   │
└───────┬──────┘ └──────┬───────┘ └──────┬──────┘ └──────┬───────────┘
        └───────────────┴────────┬───────┴───────────────┘
┌────────────────────────────────▼────────────────────────────────────┐
│ Dados: relacional (Postgres) · geoespacial · busca textual ·        │
│ vetorial (base de conhecimento e similaridade de imóveis) ·         │
│ arquivos/mídia + CDN + transformação de imagem · eventos/analytics  │
└─────────────────────────────────────────────────────────────────────┘
Transversais: créditos e cobrança · notificações (push, e-mail, WhatsApp)
· auditoria · observabilidade · segredos · LGPD
```

### 4.1 Componentes e o que cada um precisa fazer

| Componente | Responsabilidade | Requisito-chave |
|---|---|---|
| App do corretor | Tudo do dia a dia no celular; funciona com sinal fraco | PWA instalável, push, câmera e microfone, offline de leitura da agenda e da ficha de visita |
| API | Regras de negócio, permissões, validação | Toda ação de agente passa pela mesma API que o humano (mesmas regras, mesma auditoria) |
| Barramento e filas | Eventos de domínio; tarefas assíncronas com repetição | Evento de mensagem recebida → agente em **segundos**; tarefas idempotentes; repetição com espera crescente |
| Agendador | Ações com hora marcada (lembrete de visita, publicação às 18 h, vencimento de reserva às 14:32) | Precisão de minutos; não basta rotina diária |
| Motor de agentes | Conversa, decisão e ação com ferramentas | Latência de resposta baixa; custo por conversa medido; trilha completa |
| Motor de conteúdo | Gerar e renderizar peças | Assíncrono (vídeo leva minutos); callback ao terminar |
| Hub de integrações | Credenciais, chamadas, limites, classificação de erros | Um adaptador por provedor; trocar de provedor sem mudar o domínio |
| Dados | Persistência por conta | Isolamento por conta em toda consulta |
| Mídia | Fotos e vídeos do imóvel, peças, documentos | Redimensionar e converter na entrega; URLs assinadas para documentos |
| Analytics | Eventos de uso, conversão, atribuição | Plano de eventos (seção 10) |

### 4.2 Escolhas técnicas recomendadas (se fosse construído do zero)

| Camada | Recomendação | Alternativas |
|---|---|---|
| Front | TypeScript + componentes web ou React, PWA | Flutter para app nativo depois |
| Back | TypeScript (Node) ou Python | — |
| Banco | PostgreSQL + PostGIS + pgvector | Busca com Meilisearch/Typesense se o volume pedir |
| Filas | Fila com repetição e atraso programado | Qualquer broker gerenciado |
| Mídia | Armazenamento de objetos + CDN com transformação de imagem | — |
| LLM | Modelo de linguagem com chamada de ferramentas e saída estruturada; um modelo rápido e barato para atendimento e um mais forte para conteúdo e casos difíceis | Roteamento por custo (seção 6.7) |
| Transcrição | Speech-to-text com bom português do Brasil | — |
| Voz sintética | TTS com voz pt-BR natural; clonagem só com consentimento escrito | — |
| Render de templates | Creatomate (vídeo e imagem) ou Bannerbear/Placid (imagem) por API; ou motor próprio HTML→imagem/vídeo | Começar com provedor, internalizar se o custo justificar. Canva: preenchimento automático só para usuário Canva Enterprise; usar como editor opcional |
| Vídeo generativo foto→movimento | Provedor especializado em imóvel (AutoReel, Reel Estate, BetterSpace) ou modelo genérico de vídeo | Testar os três com as mesmas 12 fotos (ver referências) |
| WhatsApp | Cloud API direta da Meta ou BSP brasileiro | Seção 8 |
| Assinatura eletrônica | ZapSign, Clicksign ou D4Sign | Validade jurídica por MP 2.200-2/Lei 14.063 |
| Mapas e endereço | ViaCEP para CEP; geocodificação; mapa base OSM/Mapbox/Google | — |

---

## 5. Modelo de dados funcional

O modelo detalhado coluna a coluna está na spec (seção 6). Aqui ficam as **entidades e o porquê**, para a tradução não perder intenção.

| Grupo | Entidades | Regra que não pode se perder |
|---|---|---|
| Conta | conta, membro, papel, perfil profissional, marca | Tudo pertence a uma conta; agente é membro |
| CRM | contato, papel do contato, negócio, etapa, atividade, visita, evento (linha do tempo), origem, custo de origem, consentimento | Contato ≠ negócio; linha do tempo só recebe inclusão |
| Imóvel | imóvel, mídia, autorização de venda, características, localização | Sem autorização vigente, não publica |
| Seleção e proposta | seleção, item, reação, proposta (versões), decisão | Seleção por link com validade |
| Conversa | canal, conversa, mensagem, modelo de mensagem, passagem | Mensagem paga guarda categoria e custo |
| Agentes | agente, configuração, execução (trilha), base de conhecimento, avaliação | Toda execução registra entrada resumida, saída, ações, custo |
| Conteúdo | peça, versão, template, publicação, regra de publicação, calendário, link rastreado | Peça só publica se passar nas checagens |
| Rede | conexão, grupo, compartilhamento, necessidade de comprador, parceria, termo, proteção de cliente, avaliação | Rede nunca vê dado de cliente ou proprietário |
| Proprietário | portal, entrega, meta do imóvel, relatório, mensagem, documento pendente | Proprietário nunca vê nome do comprador |
| Metas e comissão | meta, comissão, divisão, recebimento | Soma das divisões = 100% |
| Incorporadora | empreendimento, unidade, tabela e itens, credenciamento, reserva, fila, lista de espera, exceção, material | Proposta presa à versão da tabela |
| Métricas | agregados diários, eventos de analytics | Sem dado pessoal nos agregados |
| Consumo | crédito, consumo, plano | Custo visível antes e depois |

**Busca e similaridade:** cada imóvel tem um vetor (descrição + características + bairro) para "imóveis parecidos" e para o agente achar alternativas quando o cliente descreve o que quer em linguagem livre ("perto de escola, com quintal para cachorro").

---

## 6. Stack de agentes de IA

### 6.1 Arquitetura do agente

```
Evento (mensagem, lead, reação, rotina)
   → Roteador: qual agente, qual conta, autonomia, horário, cota
   → Montagem de contexto: instruções da plataforma + da conta + memória + dados permitidos
   → Modelo de linguagem com ferramentas
   → Validação da saída (schema) + guardrails (seção 6.5)
   → Execução das ações via API (mesmas regras do humano)
   → Resposta ao cliente (texto ou áudio)
   → Trilha + custo + métricas
   → Passagem ao humano quando um gatilho dispara
```

### 6.2 Ferramentas do agente (o que ele pode chamar)

| Ferramenta | SDR | Nutrição | Proprietário | Conteúdo | Copiloto |
|---|---|---|---|---|---|
| `buscar_imoveis(criterios)` (carteira + rede + incorporadoras) | ✓ | ✓ | — | ✓ | ✓ |
| `imoveis_parecidos(imovel_id)` | ✓ | ✓ | — | — | ✓ |
| `atualizar_perfil_busca(contato, campos)` | ✓ | ✓ | — | — | ✓ |
| `criar_selecao(contato, imoveis)` | ✓ | ✓ | — | — | ✓ |
| `horarios_livres(corretor, periodo)` | ✓ | ✓ | ✓ | — | ✓ |
| `pre_agendar_visita(contato, imovel, horario)` | ✓ | ✓ | — | — | ✓ |
| `simular_financiamento(valor, entrada, renda, prazo)` | ✓ | ✓ | — | — | ✓ |
| `consultar_base_conhecimento(pergunta)` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `dados_do_imovel(imovel_id)` (campos públicos) | ✓ | ✓ | ✓ | ✓ | ✓ |
| `relatorio_imovel(imovel_id, periodo)` | — | — | ✓ | — | ✓ |
| `criar_tarefa(...)` | ✓ | ✓ | ✓ | — | ✓ |
| `mover_etapa(negocio, ate="Visita agendada")` | ✓ | ✓ | — | — | ✓ |
| `passar_para_humano(motivo, resumo)` | ✓ | ✓ | ✓ | — | — |
| `gerar_peca(tipo, imovel, canal)` | — | — | — | ✓ | ✓ |
| `rascunho_proposta(negocio)` (nunca envia) | — | — | — | — | ✓ |
| `resumo_carteira / a_receber / metas` | — | — | — | — | ✓ |

### 6.3 Memória

- **Curta:** as últimas mensagens da conversa (20 por padrão) + resumo rolante das anteriores.
- **Longa por contato:** perfil de busca estruturado, preferências ("não quer andar alto"), objeções, histórico de imóveis vistos e reações, resumo de cada visita.
- **Conta:** instruções do corretor, base de conhecimento, exemplos aprovados de mensagens e peças (aprende o estilo do corretor pelos ajustes que ele faz).

### 6.4 Autonomia

Quatro níveis (desligado, rascunho, supervisionado, autônomo) **por agente e por tipo de ação**, não só por agente. Exemplo: SDR autônomo para responder e enviar seleção, supervisionado para agendar visita. Começa em rascunho; o app sugere subir de nível quando a taxa de aprovação sem edição passa de 90% em 50 mensagens.

### 6.5 Guardrails

| Regra | Como se garante |
|---|---|
| Apresenta-se como assistente virtual, nunca finge ser humano | Instrução fixa + checagem na primeira mensagem |
| Não inventa dado do imóvel | Só dados vindos de ferramenta; resposta citando campo inexistente é bloqueada |
| Não negocia preço, desconto, comissão, reserva, proposta | Ferramentas não existem para isso; tema detectado → passagem |
| Não fala com quem pediu para parar ou revogou consentimento | Bloqueio antes do modelo |
| Não envia fora do horário configurado (exceto resposta a cliente que escreveu) | Roteador |
| Limite de mensagens por contato por dia e de follow-ups sem resposta | Roteador |
| Não expõe dados de outros clientes, proprietário, notas internas | Contexto montado só com campos permitidos |
| Linguagem: português do Brasil, tom da conta, sem jargão jurídico | Instruções + avaliação |
| Saída estruturada inválida | Não envia; registra; passa ao humano |

### 6.6 Avaliação contínua (evals)

Conjunto fixo de conversas-roteiro (lead quente, lead curioso, pede desconto, pede humano, xinga, manda só áudio, pergunta de documentação, pergunta jurídica, fora do horário, cliente que já é de outro corretor) rodado a cada mudança de instrução ou de modelo. Métricas: acerto de passagem, ação proibida (tem de ser zero), dado inventado (zero), satisfação estimada, custo médio. Amostra semanal de conversas reais revisada pelo dono da conta com nota (polegar).

### 6.7 Custo e roteamento de modelos

- Modelo rápido e barato para conversa comum; modelo forte só para casos marcados (cliente quente, objeção complexa, conteúdo longo).
- Cache de respostas da base de conhecimento.
- Orçamento por conversa e por conta; ao estourar, cai para rascunho com aviso.
- Métrica-alvo: **custo de IA por lead atendido** e **por visita agendada**.

### 6.8 Voz

Áudio recebido → transcrição → mesmo fluxo de texto. Resposta em áudio opcional (TTS), útil para público que lê pouco (padrão Morada). Ligação por agente de voz fica para o futuro, com consentimento explícito e gravação informada.

---

## 7. Stack de conteúdo e divulgação

### 7.1 Pipeline de uma peça

```
Gatilho (imóvel ativado, preço reduzido, calendário, pedido)
 → Seleção de mídia: melhores fotos por nota de qualidade (nitidez, luz, enquadramento) e ordem lógica (fachada, sala, cozinha, quartos, área externa)
 → Tratamento opcional: luz, endireitar, céu, remoção de objetos pequenos — sempre preservando o imóvel real
 → Texto: título, legenda, hashtags, descrição longa, roteiro (LLM com marca e limites do canal)
 → Render: template com camadas (foto, preço, bairro, área, quartos, logo, foto do corretor, CRECI) em cada formato (1:1, 4:5, 9:16, 16:9)
 → Vídeo: sequência de fotos com movimento + texto em tela + música licenciada + narração opcional
 → Checagens: CRECI, autorização vigente, rótulo de IA, endereço conforme a preferência, limites do canal, link rastreado
 → Aprovação: manual / automática / janela (publica no prazo se ninguém mexer)
 → Publicação agendada por canal
 → Métricas do canal (diárias) + cliques no link + leads e visitas atribuídos
```

### 7.2 Biblioteca de formatos (lançamento)

| Formato | Canais | Gatilho típico |
|---|---|---|
| Card "novo imóvel" | Feed, story, WhatsApp Status, rede | Imóvel ativado |
| Carrossel de 6–10 fotos com destaques | Instagram, Facebook, LinkedIn | Imóvel ativado |
| Reels de 15–30 s | Instagram, TikTok, Shorts | Imóvel ativado |
| "Baixou o preço" | Feed, story, rede | Preço reduzido |
| "Vendido" (prova social) | Feed, story, página | Negócio ganho |
| Visita aberta / plantão | Story, WhatsApp | Agendado |
| Relatório do bairro | Página, LinkedIn, captação | Mensal |
| Dica / autoridade | Feed, LinkedIn | Calendário |
| Captação ("avalio seu imóvel") | Feed, anúncio | Calendário |
| Lançamento de empreendimento | Todos | Material da incorporadora |
| Descrição para portal | Portais, página | Imóvel ativado |

### 7.3 Regras de qualidade e legais

Imagem nunca mostra o que o imóvel não tem; staging e edições pesadas com rótulo "imagem ilustrativa"; música só de biblioteca licenciada; rosto de pessoa só com autorização; CRECI em toda peça; nada de preço "a partir de" enganoso; nada de dado do proprietário.

---

## 8. Mensageria

### 8.1 WhatsApp: direto na Meta ou via BSP

| Caminho | Prós | Contras |
|---|---|---|
| Cloud API direta (Meta) | Menor custo; controle total; cobrança em BRL para contas novas no Brasil | Cadastro e verificação por conta própria; suporte só da Meta |
| BSP brasileiro (Blip, Zenvia) ou internacional (Twilio, 360dialog, Gupshup) | Onboarding assistido; painel; suporte local | Taxa por mensagem ou mensalidade em cima da Meta; mais um fornecedor |

**Recomendação:** Cloud API direta com cadastro incorporado na versão atual ("número primeiro"), que dispara a **coexistência** quando o número já está no WhatsApp Business: o corretor confirma o perfil, lê um QR code e continua usando o aplicativo no celular, com as mensagens espelhadas no app. Exige o app registrado como provedor de tecnologia na Meta. BSP já aprovado como ponte até a aprovação própria.

### 8.2 Regras de custo que viram regra de produto

- Cobrança por mensagem entregue, por categoria (marketing, utilidade, autenticação). Respostas dentro da janela de atendimento de 24 h aberta pelo cliente não têm cobrança de modelo; conferir a tabela vigente da Meta antes de fechar preço.
- **Consequência:** o agente responde muito (barato) e inicia pouco (caro). Reengajamento por modelo de marketing é a ação mais cara do produto e deve ser medida e limitada por cota.
- Número do corretor com qualidade baixa (muitos bloqueios) perde limite de envio: o app acompanha a nota de qualidade do número e freia disparos.

### 8.3 Outros canais

Instagram Direct e Messenger pela mesma API da Meta (mesma caixa); e-mail transacional para relatórios e avisos; push do app para o corretor; SMS só para código de acesso se necessário.

---

## 9. Rede: como funciona por dentro

- **Identidade:** perfil de membro com CRECI verificado (manual com documento até haver fonte oficial; SGR do COFECI quando possível).
- **Visibilidade:** imóvel compartilhado mostra só campos públicos e o contato do corretor captador; necessidade de comprador mostra só critérios.
- **Match:** a cada imóvel compartilhado ou necessidade publicada, o motor calcula compatibilidade (mesma fórmula do CRM) e avisa os dois lados acima de um limite.
- **Proteção de cliente:** registro com hash do telefone e validade; quando um segundo corretor tenta registrar o mesmo cliente para o mesmo imóvel, os dois são avisados e o gestor/plataforma media. Ninguém vê o cliente do outro.
- **Termo de parceria:** gerado no aceite com divisão, imóvel, prazo e regras; assinatura eletrônica; ciência do titular quando há exclusividade.
- **Entre empresas:** mesma lógica entre contas; entre instalações diferentes, por API pública com chave de conexão (futuro).
- **Reputação:** avaliação de 1 a 5 só depois de parceria encerrada, visível no perfil.

---

## 10. Métricas e plano de eventos

### 10.1 Eventos a capturar (nome, quando, propriedades mínimas)

| Evento | Quando | Propriedades |
|---|---|---|
| `lead_criado` | Primeira mensagem ou formulário | origem, campanha, peça, imóvel |
| `primeira_resposta` | Primeira saída na conversa | segundos desde a entrada, autor (agente/humano) |
| `primeira_resposta_humana` | Primeira saída de humano | segundos |
| `qualificado` | Perfil com tipo, região e faixa | nota |
| `selecao_enviada` / `selecao_aberta` / `reacao` | | itens, reação |
| `visita_pedida` / `visita_agendada` / `visita_realizada` / `nao_compareceu` | | autor do agendamento |
| `proposta_enviada` / `proposta_decidida` | | valor, desvio |
| `negocio_ganho` / `negocio_perdido` | | valor, motivo |
| `passagem_criada` / `passagem_assumida` | | motivo, segundos até assumir |
| `peca_gerada` / `peca_aprovada` / `peca_publicada` | | tipo, canal, modo de aprovação, editada? |
| `link_clicado` | Clique no link rastreado | peça, canal |
| `pagina_vista` / `imovel_visto` | Páginas públicas | imóvel, origem |
| `parceria_proposta` / `parceria_aceita` / `parceria_fechada` | | divisão |
| `portal_proprietario_aberto` / `relatorio_lido` | | |
| `credito_consumido` | | tipo, quantidade, custo |

### 10.2 Painéis

- **Corretor:** funil da coorte, tempo de resposta, conversão por origem e por peça, metas e ritmo, a receber.
- **Gestor:** o mesmo por corretor, fila e atrasos, passagens não assumidas.
- **Agentes:** % resolvido sem humano, passagens por motivo, visitas agendadas, custo por lead e por visita, ações bloqueadas pelos guardrails.
- **Conteúdo:** peças publicadas, alcance, cliques, leads e visitas atribuídos, custo por peça.
- **Produto (interno):** ativação (conectou WhatsApp, importou contatos, publicou 1ª peça, ligou 1º agente), retenção semanal, custo de infraestrutura e de IA por conta ativa.

Fórmulas e regra de ausência de dado: spec, seção 11.2.

---

## 11. Integrações no Brasil

| Integração | Uso | Observação |
|---|---|---|
| Meta (WhatsApp Cloud, Instagram, Facebook, Messenger) | Conversa e publicação | App aprovado e revisão de permissões |
| TikTok, YouTube, LinkedIn, Google Perfil da Empresa | Publicação | Uma aprovação por plataforma |
| Portais (Grupo OLX: ZAP, VivaReal, OLX; Imovelweb; Chaves na Mão; outros) | Anúncio e leads | Feed XML de imóveis; leads por integração do portal ou e-mail |
| Redes de imobiliárias (Rede QuintoAndar, Netimóveis e afins) | Estoque e audiência | Avaliar caso a caso |
| Financiamento | Simulação na conversa e no app | Simulador próprio com regras públicas (SAC/Price, prazo, entrada); integração com correspondente bancário como fase futura |
| Assinatura eletrônica (ZapSign, Clicksign, D4Sign) | Autorização de venda, termo de parceria, ficha de visita | Webhook de assinatura concluída |
| ViaCEP e geocodificação | Endereço e mapa | |
| Agenda (Google, Outlook) | Visitas | Leitura de livre/ocupado para o agente |
| CRECI / COFECI SGR | Verificação e rede | Sem API nacional conhecida hoje |
| Pagamento (Pix, cartão) | Assinatura do plano e créditos | PSP brasileiro |
| Render e IA de mídia (Creatomate/Bannerbear, AutoReel/Reel Estate/BetterSpace, HeyGen) | Conteúdo | Assíncrono com callback |
| LLM, transcrição, TTS | Agentes e conteúdo | Roteamento por custo |

---

## 12. Requisitos não funcionais

| Tema | Requisito |
|---|---|
| Velocidade do agente | Primeira resposta em até 30 s em 95% dos casos; meta de 15 s (referência Lais) |
| Velocidade do app | Telas do dia a dia abrem em menos de 2 s no 4G |
| Disponibilidade | Atendimento por agente é crítico: alerta se a fila de mensagens passar de 1 min |
| Isolamento | Nenhuma consulta sem filtro de conta; testes automáticos de vazamento |
| LGPD | Base legal registrada (consentimento ou legítimo interesse), direito de acesso, correção, exclusão e portabilidade; registro de operações; encarregado (DPO) definido |
| Segurança | Segredos de integração cifrados e fora do código; documentos com URL assinada e expiração; 2FA para dono da conta |
| Auditoria | Toda ação (humana ou de agente) na linha do tempo, imutável |
| Custo | Custo de infraestrutura + IA + mensagens por corretor ativo medido mensalmente e abaixo da meta da seção 13 |
| Acessibilidade | Contraste, tamanho de toque, leitura por voz |
| Celular | Uso com uma mão; câmera e microfone integrados |

---

## 13. Economia unitária (modelo para validar no piloto)

**Custo variável por corretor ativo/mês** = (conversas atendidas × custo de IA por conversa) + (mensagens iniciadas pagas × preço por categoria) + (peças renderizadas × custo por render) + (vídeos × custo por vídeo) + armazenamento de mídia + infraestrutura rateada.

**Hipóteses a medir no piloto (não são números de mercado):** corretor autônomo com 40 leads/mês, 15 mensagens por conversa, 20 peças e 4 vídeos por mês. Medir no piloto: custo de IA por conversa, custo por vídeo de cada provedor (ver referências), percentual de mensagens que precisam de modelo pago.

**Referência de preço do mercado brasileiro:** CRMs com entrada entre R$ 0 e R$ 249/mês, Loft/CRM a R$ 129,90 com assistente de IA incluído; IA cobrada por consumo em parte dos concorrentes (detalhe nas referências).

**Desenho de plano sugerido:**
- **Grátis:** CRM, página, seleções, link `wa.me`, 5 peças/mês, sem agente.
- **Corretor:** WhatsApp oficial, agente SDR e nutrição com cota de conversas, 40 peças e 8 vídeos/mês, portal do proprietário, rede.
- **Equipe/imobiliária:** por usuário, gestor, fila compartilhada, metas, relatórios.
- **Créditos avulsos:** vídeo, staging, mensagens de marketing acima da cota.
- **Incorporadora:** por empreendimento ativo.

---

## 14. Roadmap funcional (alinhado à spec 0.5)

| Fase | Entrega | Por que nesta ordem |
|---|---|---|
| 1 · MVP interno | Tudo do escopo aprovado funcionando e testado pela equipe com contas de teste: Assistente; CRM e funil com IA; envios rastreados; imóveis e empreendimentos; WhatsApp pelo app; Mensageiro em texto; Estúdio com Canva e os três modos de publicação; Minha Página; Portal do Cliente comprador | Telas, permissões e automações certas antes de pôr na mão de alguém |
| 2 · Validação | 3 a 5 corretores reais por 4 semanas, com app aprovado na Meta e termos publicados | MVP validado |
| 3 | Proprietário, relatório, propostas; Mensageiro com áudio e follow-up; vídeo | Captação e retenção |
| 4 | Equipe, metas, comissões; Facebook e Direct; cobrança | Imobiliárias e monetização |
| 5 | Rede, parcerias, incorporadoras | Efeito de rede |
| 6 | Outros canais, portais, assinatura, domínio, pós-venda | Ampliação |
| 7 | Voz que liga, anúncios, adiantamento, rede entre instalações | Futuro |

## 15. Riscos e como reduzir

| Risco | Redução |
|---|---|
| Agente fala besteira e queima o corretor | Começa em rascunho; evals; guardrails; passagem fácil; trilha |
| Bloqueio ou baixa qualidade do número de WhatsApp | Limites de disparo; nota de qualidade monitorada; opt-out em toda mensagem de marketing |
| Custo de IA e vídeo sai do controle | Cotas, roteamento de modelos, custo mostrado antes |
| Rejeição de app nas redes sociais | Começar por Meta; publicação manual assistida (baixar e postar) como plano B |
| Conflito de cliente entre corretores | Proteção por hash, termo de parceria, mediação registrada |
| Regras legais (autorização, CRECI, LGPD) | Bloqueios no produto, não só avisos |
| Adoção baixa (o corretor não importa a base) | Importação em 1 minuto pelo celular; valor imediato (agente respondendo no primeiro dia) |

---

## 16. Mapa de tradução para o UrbiVerso (respondido pelo resumo dos frameworks)

| Componente da stack | Framework UrbiVerso | Situação |
|---|---|---|
| Contas, membros, papéis | Contas + `roles_externos` (`corretor`, `cliente`) + roles de equipe | Resolvido (spec 4.4) |
| Tabelas do domínio | `schema.json`, `segregada_por_conta`, `acesso_externo: restrito` | Resolvido (spec 6.0) |
| Agregados do funil | `sql_declarado` ou código | Resolvido |
| Geoespacial | `lat`/`lng` + GeoJSON em `json`; `urbi-mapa` | Resolvido |
| Busca vetorial | Não existe; `busca_texto` + pontuação em código | Resolvido |
| Barramento | `req.eventos`, `reagir` | Resolvido |
| Hora marcada | `req.eventos.agendar` | Resolvido |
| Rotinas | `rotinas` (diária/semanal/mensal, 15 min) | Resolvido |
| Agentes e LLM | `req.ia.consultar` com JSON Schema; slots | Resolvido, com a regra de o app executar as ações |
| Transcrição | slot `audio` (`transcrever`) | Resolvido (fase 3) |
| Voz sintética | Não existe | Fora (D-48) |
| Entrada de mensagens | `wh` | Resolvido, com P-31 a P-33 |
| Chamadas de saída e segredos | `fetch()` com proxy de egresso; `segredo` e `parametros secret` | Resolvido |
| Páginas públicas | `rotas_publicas` + `paginas_publicas` (GET, sem tema) | Resolvido, com P-33 |
| Mídia e documentos | Coluna `arquivo`, `req.arquivos` | Resolvido |
| E-mail | `req.email` | Resolvido |
| Parâmetros | `parametros` só da instalação; por conta em tabela | Resolvido |
| Notificações e push | `req.notificacoes` (inbox, push) | Resolvido |
| Celular | Layout adapta sozinho; menu no dropdown | Resolvido |
| Cobrança e créditos | Consumo medido na app; cobrança na fase 4 | Em aberto (P-11) |

## 17. Instrução para a sessão no Claude Code

A instrução de implementação está em `CLAUDE.md` e a ordem de trabalho em `specs/plano_de_implementacao.md`.
