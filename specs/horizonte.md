# Horizonte — o que fica fora da spec por ora

> Texto movido de `specs/portal_corretor.md` em 23/10/2026 (D-88), na íntegra e sem edição, para a spec descrever o produto que queremos construir (fases 1 a 4). Nada aqui foi descartado: volta para a spec quando a fase chegar. As referências cruzadas (seções, D-nn, P-nn) são as da spec.

## 6.8 e 6.9 — Rede e Incorporadora (modelo de dados)

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


## 6.2 — `protecoes_cliente` (rede)

**`protecoes_cliente`** — registro de "cliente apresentado" para disputas na rede: `contato_hash` (hash do telefone normalizado, nunca o telefone), `conta_id`, `membro_id`, `imovel_id` (opcional), `valido_ate`. Só a existência e a validade são consultáveis por outra conta, nunca o dono (P-03).


## 6.7 — `regras_publicacao` (publicação automática)

**`regras_publicacao`** — publicação automática: `gatilho` (`imovel_ativado`/`preco_reduzido`/`imovel_vendido`/`visita_aberta`/`calendario`), `tipos_peca`, `canais`, `aprovacao` (`manual`/`automatica`), `ativo`. É o que "divulga automaticamente".


## 6.15 — `templates_arte` (modelos de arte por motor; substituído pelo gerador do app, D-74)

**`templates_arte`** — modelos do Estúdio de Conteúdo.

| Coluna | Tipo | Obr. | Observação |
|---|---|---|---|
| formato | enum `post_1x1`/`post_4x5`/`carrossel`/`story_9x16`/`reels_9x16`/`capa` | sim | |
| objetivo | enum (6.7) | sim | Novo imóvel, baixou o preço, vendido… |
| camadas | json | sim | Foto principal, preço, bairro, área, quartos, logo, foto e CRECI do corretor, selo, chamada |
| motor | enum `interno`/`provedor`/`canva` | sim | D-27 |
| ref_externa | texto | não | Id do template no provedor |
| ativo | booleano | sim | |


## 6.15 — `ajuda_produto` (substituída pela base gerada no build, D-58/D-76)

**`ajuda_produto`** — opcional: índice da documentação da app (`docs/`) usado pelo Assistente para citar a fonte e levar à tela certa; o conteúdo em si é o de `docs/`, o mesmo do widget de ajuda da plataforma (D-52).


## 6.15 — `canva_vinculos` e `fila_render` (integração Canva por API, D-74)

**`canva_vinculos`** — separação por conta dentro da conta Canva da plataforma: `conta_id`, `pasta_canva_id`, `tipo` (`upload`/`design`), `id_canva`, `peca_id`, `criado_em`, `apagado_em`. O app só opera ids presentes aqui para a conta em questão.

**`fila_render`**: `conta_id`, `peca_id`, `motor`, `prioridade` (`agendada`/`aprovada`/`rascunho`), `estado` (`na_fila`/`processando`/`pronta`/`erro`), `tentativas`, `erro`, `pronta_em`.


## 11.4 — Telas da Incorporadora

### 11.4 Incorporadora

Herdado do MVP: Painel (disponíveis, reservas ativas, vencendo hoje, exceções pendentes, vendas do mês), Empreendimentos (dados, materiais por classificação, tabela versionada), Espelho (SVG esquemático por quadra/torre, cor por estado, clique abre unidade com preço da tabela vigente), Reservas (fila, confirmar, vencer), Corretores (credenciamento, autorização de anúncio), Exceções (alçada, decisão). Simulador de proposta na unidade: entrada, parcelas e valor da parcela calculados pela tabela vigente e pelos limites do empreendimento; fora dos limites, a proposta já nasce marcada para exceção. O corretor credenciado vê Espelho e Reservas em "Imóveis › De incorporadoras" e pede reserva e lista de espera dali.


## 15.5 a 15.7 — Fases 5, 6 e 7

### 15.5 Fase 5 — "rede e incorporadoras"

Conexões, grupos, perfil público, compartilhamento de imóvel e de necessidade de comprador, match, parcerias com termo e divisão, proteção de cliente; módulo Incorporadora completo. **Estimativa:** 6 a 7 sessões.

### 15.6 Fase 6 — "expansão de canais"

TikTok, YouTube Shorts, LinkedIn, Google; portais (feed e leads); assinatura eletrônica; agenda externa; domínio próprio, blog e SEO; Portal do Comprador pós-venda. **Estimativa:** 6 a 8 sessões.

### 15.7 Fase 7 — "futuro"

Agente de voz que liga; anúncios pagos; adiantamento de comissão e crédito; rede entre instalações e SGR do COFECI; leitura opcional do núcleo UP/Urbitá; app nativo se o shell não atender.
