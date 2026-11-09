# Rodada 1 · #201 · head 5c7fa53 · lentes recebidas

## T1 (opus, 75s): sem-achado.
## contratos·barramento (opus, 150s): sem-achado. Nota fora do diff: nav com 8 telas vs "sete" do CLAUDE.md (Conversas entrou, D-103: 7+Conversas=8, ok).
## L4 (opus, 90s): precisa-atencao
- B1 cliente.ts:122 POST /selecoes: registrarMensagem no fim sem try/catch → 500 depois de a seleção já existir; repetir duplica (confirmarSelecao só fecha no sucesso).
- B2 conversas.ts:670-678 Agendar visita: dois POSTs; falha no 2º mantém gaveta, repetir duplica visita+lembrete.
- O1 conversas.ts:649 horariosLivres com agenda velha; backend não recusa choque.
- O2 inicio.ts:127-140 registrar sem trava em voo (dois "Fiz" = duas abordagem.feita).
- O3 publico.ts:646 ultimo_acesso_em = hora do listener, não evento.criado_em.
## L1 (opus, 110s): precisa-atencao
- B3 comum/hoje.ts:125 dica da peça usa peca.texto (motivo) como título; título está em contato_nome (funil.ts:333).
- B4 comum/hoje.ts:124 amanha.setHours(18) no fuso do servidor (UTC→15h BRT); funil.ts:334 toLocaleDateString sem timeZone.
- O4 funil.ts:341 autorizações 30 dias vs rotina 31 (off-by-one).
- O5 comum/crm.ts:156 formatarTelefone formata 11 dígitos estrangeiro.
- O6 funil.ts:84 ultimo_sinal: página única de 1000 linhas; envio usa primeiro_clique_em.
## T4 (opus, 300s): precisa-atencao (só observações)
- O7 inicio.ts:271/funil.ts:229-236 "Agora não" grava abordagem_adiada_em mas filaDoDia não lê para visita/proposta/retorno/sem resposta → cartão continua; testado só por regex.
- O8 grupo2.test.ts:188-189 isolamento do ultimo_acesso_em passa por acidente (falta conferir que A não mudou).
- O9 Agendar visita e Seleção na P02 só por grep.
- O10 Assumir com conversa (inicio.ts:179-182) sem teste.
- O11 M1 noCelular/atalhosDoDia/filaCompacta sem teste.
## S2 (opus, 420s): precisa-atencao (observações)
- O12 imoveis.ts:258-262, pagina.ts:322-331 sem Buscar (cabeçalho próprio) — "toda tela" não sustentado. (grupos 3 e 4 consertam as telas deles: D-128)
- O13 #187 só Novo contato; Editar contato/ficha/imóvel seguem perdendo digitado → Closes #187 à frente.
- (= B3/B4) dica da peça.
- O14 funil.ts ORDEM_FILA: proposta_recebida depois de quente/abordagem/visita → dedup esconde "Responder".
- O15 inicio.ts atalhosDoDia: Conversas·Criar·Imóveis·Assistente vs spec 11.5 "Criar · Clientes · Imóveis · Assistente (Conversas com selo)".
- O16 #172/#196/#197 critérios sem prova (7 clientes em 1366×657; teste de navegador; >50 contatos).
## S1 (opus, 120s): precisa-atencao (observações)
- O17 docs/README.md:11 e ajuda-gerada "0.1.47" → 0.1.48.
- O18 docs/negociacao.md:12,123,137 aba Negociação que saiu.
- O19 docs/conta-e-ajustes.md:119-120 "botão Exportar de Clientes".
- O20 docs/clientes-e-agenda.md:132 Fazer agora ?sugerir=1 sem secao=resumo: sugestão não aparece (ABA_PADRAO linha).
- O21 docs/README.md:15 "Agora não" em todo cartão (peça/autorização não têm).

# Rodada 2 · head 06cf45e
## L4 (opus, 420s): precisa-atencao
- B7 (ponto = B2 "visita duplicada", 2ª passagem) crm.ts:676-678: registrar('atividade.criada') e reclassificar sem proteção depois da visita+confirmação → 500 → gaveta aberta → repetição duplica. VERIFICADO.
- O31 crm.ts:665 publicar cru dentro do bloco da confirmação pula registrar('abordagem.feita') e ultimo_contato_em.
- O32 conversas.ts:630 confirmarSelecao ignora conversa_id nulo e avisa "registrada na conversa".
- O33 inicio.ts:259,263 carregando por chave nunca desenhado (dropdown); trava única silencia 2º registro em outro cartão.
## L1 (opus, 71s): precisa-atencao (sem bloqueante)
- (= O32) conversas.ts:630 aviso falso com conversa_id nulo.
- (= O31) crm.ts:661-670 falha parcial dentro do try pula abordagem.feita e ultimo_contato_em.
- O34 crm.ts:656-657 confirmacao aceita em qualquer tipo; ignorada em silêncio quando só vem negocio_id; não restrita a visita (doc diz só visita).
## S2 (opus, 420s): precisa-atencao (sem bloqueante)
- O35 docs/negociacao.md:12,123,137 "cartão Negociações" vs título real "Negociação" (negociacoes.ts:826).
- O36 docs/funil.md:196-197 frase antiga supõe os dois botões da Dica juntos.
- (= O32) conversas.ts:631 aviso falso.
- O37 comum/hoje.ts:94-104 JSDoc da Dica ficou em cima de horaLocalNoFuso.
- O38 funil.ts:344-347 "mesma janela da rotina" só no fuso de SP (rotina usa SP fixo; imoveis.ts:885).
- O13 (reiterado) Closes #187 parcial → nova issue ou registro no plano.
