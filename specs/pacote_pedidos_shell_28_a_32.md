# Pacote para a equipe do shell: pedidos 28 a 32 do Portal do Corretor

Para quem não conhece o app: o **Portal do Corretor** (`portal_corretor`) é uma app do UrbiVerso, o escritório digital do corretor de imóveis. As telas autenticadas usam a moldura de três colunas (`urbi-3-colunas` com `urbi-hospedeiro`; `urbi-2x1` em Hoje no celular) dentro do `urbi-shell-page`. O app segue a regra 10 do `ui.md`: tela não escreve CSS. Por isso, o que segue só se resolve no primitivo ou no tema.

Texto completo de cada pedido: `specs/pedidos_ao_shell.md`, seções 28 a 32. Provas: `specs/prints/issue-176/`, `issue-180/`, `issue-190/` e `issue-192/` (cada uma com `medidas.md`, e a 176, 180 e 190 também com `medidas.json`).

**De onde vem cada afirmação** (as três fontes não se misturam):

- **[SDK]** documentado no `@urbiverso/sdk` 100.0.0 (pasta `docs/` do pacote).
- **[medido]** medido no **shell 0.56.37**, app 0.1.51, homologação, em 09/11/2026, só leitura. Não é contrato do SDK: um shell futuro pode mudar.
- **[relato]** relatado no QA de 07/11, sem registro arquivado.

## A. Resumo

| # | Pedido | Quem sente | Prioridade sugerida | Esforço (shell) |
|---|---|---|---|---|
| 28 | Coluna e cartão brancos, e texto dos primitivos a 4,5:1 | Todo usuário, no tema claro | **Média**: o app levou o texto de apoio de ~3,0 para ≥ 4,60 claro / 4,97 escuro na maioria das telas (exceções abaixo de 4,5:1 medidas na 0.1.58: Funil claro 4,24, mandato claro 4,49, Ajustes 4,47; Funil escuro 4,69), mas selos, chip ativo, avatar, KPI e estado vazio continuam abaixo | não estimado |
| 29 | Rótulo ligado ao campo, rádio, busca vazia, teclado | Quem usa leitor de tela ou teclado, e os testes automáticos | **Alta**: 13 de 21 campos medidos não têm nome e nenhum tem o nome do rótulo, e o app não consegue resolver pelo contrato | não estimado |
| 30 | Formulário que mostra o erro do servidor sem fechar | Corretor que salva um cadastro recusado | **Média**: o app tem um contorno que reabre o diálogo, mas o erro não aparece no campo que o causou | não estimado |
| 31 | `urbi-hospedeiro` impõe a estrutura; grade de KPIs equilibrada | Corretor no Funil e em Números, em janela menor que ~1377 px | **Baixa**: as duas coisas já têm contorno no app | não estimado |
| 32 | Celular: rodapé fixo e menos altura antes do conteúdo | Corretor no celular | **Média**: no celular o conteúdo começa em y 220, e a referência começa em ~67 | não estimado |

As prioridades são sugestões deste pacote. Quem decide é o dono. Nenhum pedido original estima esforço.

---

## 28. Superfície branca nas colunas e contraste do texto dos primitivos

**O que pedimos:** no tema claro, coluna e cartão brancos sem CSS da tela, e piso de 4,5:1 para o texto que os primitivos pintam, medido sobre a coluna e o cartão em que ele aparece.

**Por que:**
- **[SDK]** O único fundo de painel documentado é o do trilho em hover do `urbi-3-colunas` (`--urbi-3-colunas-trilho-fundo-hover`, `ui-componentes-layout.md`). O SDK não documenta cor nem contraste do papel `dica` nem dos primitivos medidos (`urbi-card`, `urbi-badge`, `urbi-banner`, `urbi-botao`, `urbi-kanban`); documenta só pisos de contraste de tokens (`ui.md` § Tokens), cores do `urbi-abas` (`ui-componentes-layout.md`) e, em `ui-componentes-conteudo.md`, a garantia qualitativa de que o fundo do `urbi-banner` é a cor de estado a ~10%, sem valor de contraste. Ele documenta `--cor-texto-fraco` como cor de meta, placeholder e desabilitado (`ui.md` § Tokens); o valor `rgba(13,27,42,.48)` está no SDK (`dist/tokens.css`), não em `docs/`.
- **[medido]** (`issue-176/medidas.md`) O `urbi-3-colunas` e o `urbi-hospedeiro` não pintam nada em repouso. A coluna mostra o `--cor-fundo` do `urbi-shell-page`: `#F2F4F7` no claro e `#0D1B2A` no escuro. O `urbi-card` pinta `--cor-superficie` (`rgba(13,27,42,.04)`) e sai `#E9EBEF`, mais escuro que a coluna. O guia do app pede coluna e cartão `#FFFFFF` sobre `#F4F3EF`.
- **[medido]** Texto que fica abaixo de 4,5:1 no claro (e, no modal de mandato da 0.1.58, `urbi-banner` de alerta 3,47 e `urbi-botao` "mostrar" 4,33 no claro, `urbi-botao-alternar` 4,94 no escuro, `specs/prints/conferencia-0.1.58/medidas.json`, campos `Mandato_light.piorGeral`, `Mandato_light.piorProsaQualquer` e `Mandato_dark.piorGeral`; não são pedido novo: são o mesmo contraste do item (b), registrado na conferência da 0.1.58):
  - selos de estado do `urbi-badge`: de 3,02 a 4,15 no claro e de 3,30 a 7,11 no escuro;
  - selo neutro dentro de cartão: 4,36 no claro e 4,37 no escuro (sobre a coluna dá 4,50 e 4,68);
  - `urbi-chips-atalho` ativo: 4,05;
  - iniciais do `urbi-avatar`: de 3,76 a 4,05;
  - rótulo do `urbi-kpi`: 4,47;
  - submensagem do `urbi-estado-vazio`: 3,10;
  - versão na barra do shell: 3,16;
  - "Vazio" no quadro do `urbi-kanban`: 2,97 no claro e 3,75 no escuro (na cor do token fraco; do shell, entra no item (b); números de `conferencia-0.1.58/medidas.json`);
  - `--cor-texto-sec` (papel `dica`) sobre o cartão `variante-alerta`, no Funil: 4,24 (fundo `#D8D4CE`).
- **[medido]** O papel `fraco` mede de 3,04 a 3,10 no claro (2,89 no Funil) e de 3,70 a 3,78 no escuro.
- **[medido no shell 0.56.37, app 0.1.58]** (conferência real, só leitura, `specs/prints/conferencia-0.1.58/`) Com `dica`/`secundario`, as exceções a 4,5:1 são: Funil, claro 4,24 e escuro 4,69; modal de mandato, claro 4,49 e escuro 5,10; e, em Ajustes, o `secundario` dentro do cartão de tom ("Fala como você fala…"), claro 4,47 e escuro 4,69 (a `dica` da mesma tela passa: 4,60 e 4,97). Passam: Clientes 4,74 e 5,18; ficha, Imóveis e Hoje 4,60 e 4,97. Textos do shell na cor do token fraco, que entram no item (b): versão na barra (3,16 claro, 3,80 escuro), submensagem do estado vazio (3,10, 3,78) e "Vazio" no `urbi-kanban` (2,97, 3,75).
- **[relato]** Até 07/11 a tela usava o `urbi-inbox`, que deixava a área de trabalho cinza (`div.layout` a .04 e `section.detail-pane` a .05). Sobre ele, o texto secundário da lista de Clientes ficava em ~2,9:1. O app não usa mais o `urbi-inbox`, e a remedição não o reproduz.

**O que o app faz até lá:** usa os primitivos como eles são e não põe cor nenhuma na tela (decisão D-124). Coluna e cartão ficam como o tema os pinta. O texto de apoio passou de `fraco` para `dica`/`secundario`, e um teste impede a volta do `fraco` enquanto ele medir abaixo de 4,5:1.

**Proposta mínima:**
- **(a)** Uma das duas:
  - um atributo nos primitivos de painel (`urbi-3-colunas`, `urbi-2x1`, `urbi-hospedeiro`) que pinte a coluna com uma superfície opaca (ex.: `superficie`);
  - ou um token `--cor-fundo-coluna`, que o tema claro defina branco, com o `urbi-card` claro sobre ele.
- **(b)** Piso de 4,5:1 em `contraste-temas.test.ts` para o texto dos primitivos sobre a composição real (coluna e cartão): estado do `urbi-badge` (inclusive o neutro dentro de cartão), `urbi-chips-atalho` ativo, iniciais do `urbi-avatar`, rótulo do `urbi-kpi`, submensagem do `urbi-estado-vazio`, versão na barra do topo e "Vazio" do `urbi-kanban` (os três últimos usam `--cor-texto-fraco`).
- **(c)** Piso de 4,5:1 para `--cor-texto-sec` (`dica`/`secundario`) sobre as variantes de cartão: `variante-alerta` no Funil 4,24, cartão de tom de Ajustes 4,47 e modal de mandato 4,49, todos no claro.

**O que muda para o usuário quando entregue:** a tela fica clara como a referência, com o cartão destacado da coluna, e os selos de temperatura (Quente, Morno, Frio), os chips, os avatares e os números ficam legíveis.

**Como o shell confere que ficou pronto** (todas são **sugestão de critério**; os números atuais são do tema claro, salvo onde está dito):
1. A tela consegue ter coluna e cartão brancos no claro sem CSS próprio. Hoje: coluna `#F2F4F7` e cartão `#E9EBEF`.
2. O `--cor-texto-sec` fica ≥ 4,5:1 sobre o cartão `variante-alerta` (Hoje: 4,24), o cartão de tom de Ajustes (4,47) e o modal de mandato (4,49).
3. O `urbi-badge` de estado fica ≥ 4,5:1 sobre a coluna e sobre o cartão, inclusive o `variante-alerta`, nos dois temas. Hoje: 3,02 no claro e 3,30 no escuro, os dois no cartão do Funil.
4. O `urbi-badge` neutro dentro de cartão fica ≥ 4,5:1. Hoje: 4,36 no claro e 4,37 no escuro.
5. O `urbi-chips-atalho` ativo fica ≥ 4,5:1. Hoje: 4,05.
6. As iniciais do `urbi-avatar` ficam ≥ 4,5:1. Hoje: de 3,76 a 4,05.
7. O rótulo do `urbi-kpi` fica ≥ 4,5:1. Hoje: 4,47.
8. A submensagem do `urbi-estado-vazio` fica ≥ 4,5:1. Hoje: 3,10.
9. A versão na barra do shell fica ≥ 4,5:1. Hoje: 3,16 (claro) e 3,80 (escuro).
10. O "Vazio" do `urbi-kanban` fica ≥ 4,5:1. Hoje: 2,97 no claro e 3,75 no escuro.

---

## 29. Nome acessível nos campos, rádio, busca vazia e teclado

**O que pedimos:** que o rótulo de cada campo vire o nome acessível do controle de dentro, e que existam uma escolha única com teclado e uma busca que não abre vazia.

**Por que:**
- **[SDK]** O `label` aparece assim nos primitivos:
  - `urbi-input` e `urbi-textarea`: "Rótulo acima do campo";
  - `urbi-select`: só na linha de props, sem esse texto;
  - `urbi-slider`: é o único que promete "`label` dá o nome acessível ao controle".
- **[SDK]** Só o `urbi-toggle` tem `ariaLabel`; o `urbi-input`, o `urbi-select` e o `urbi-textarea` não têm (`index.d.ts`).
- **[SDK]** Não existe rádio nem grupo de opções.
- **[SDK]** Só a `urbi-lista clicavel` promete foco e Enter/Espaço. O `urbi-card clicavel` não promete. O `urbi-badge interativo` promete, mas como botão com `aria-pressed`, não como opção de uma escolha única.
- **[medido]** (`issue-192/medidas.md` e os `*.aria.txt`, árvore do Chromium) Em cinco telas há 21 campos:
  - **13 sem nome**: todo `urbi-select`, os `urbi-input` sem placeholder e os de cor, que saem só com o valor;
  - **8 com o placeholder no lugar do nome**;
  - **0 com o rótulo**.
- **[medido]** O `label` vira texto solto antes do campo. O `urbi-checkbox` liga o rótulo direito.
- **[relato]** Nos diálogos do `urbiVerso.formulario`, o leitor de tela anuncia "caixa de texto" sem nome. O campo `busca` mostra "Nenhum resultado" com o campo vazio, e a lista cobre os botões do diálogo.
- **[observado de passagem, sem captura]** A tela de login do shell parece ter o mesmo defeito.

**O que o app faz até lá:**
- Passa o rótulo em todo campo: `label` nos 72 campos que monta e `rotulo` nos 187 campos do `formulario`. Dois testes vigiam isso.
- Os testes de navegador acham o campo pelo atributo `label`, não por `getByLabel`.
- A escolha única é feita com `urbi-card clicavel` e `role="radio"`, com foco e setas pelo próprio app (o SDK não garante isso).
- A busca global só procura a partir de 2 letras.

**Proposta mínima:**
- **(a)** O `formulario` e os primitivos de campo ligam o `rotulo`/`label` ao controle interno, com `<label for>` na mesma sombra ou `aria-label` no elemento nativo. Vale para o `urbi-input` e a família `urbi-input-*`, o `urbi-textarea`, o `urbi-select` (inclusive o `pesquisavel`), o `urbi-select-usuarios`, o `urbi-seletor-objeto` e o `urbi-editor-markdown`. O catálogo passa a dizer isso, como já diz no `urbi-slider`. O `urbi-input-hora` ganha `label`.
- **(b)** Um `urbi-opcoes`: rádio com rótulo e explicação em cada opção, e evento `{ valor }`.
- **(c)** O campo `busca` não mostra a lista vazia antes de o usuário digitar.
- **(d)** Para o teclado, uma de duas: o `urbi-opcoes` com foco, setas e Enter/Espaço; ou, no mínimo, foco e Enter/Espaço no `urbi-card clicavel` e no `urbi-badge interativo`.

**O que muda para o usuário quando entregue:** o leitor de tela diz o nome de cada campo, a escolha única funciona pelo teclado sem código do app, e a busca do diálogo não cobre os botões.

**Como o shell confere que ficou pronto** (todas são **sugestão de critério**):
1. Refeita a captura de `issue-192/` nas mesmas cinco telas, os 21 campos saem com o nome igual ao rótulo. Hoje: 0 de 21.
2. Nenhum `urbi-select` sai sem nome. Hoje: todos saem sem nome.
3. Os campos de cor saem com o rótulo, não só com o valor.
4. O campo `busca` não mostra "Nenhum resultado" com o campo vazio. Este vem do relato de 07/11, sem medida.

---

## 30. Formulário que valida no servidor sem fechar

**O que pedimos:** que o `urbiVerso.formulario` fique aberto enquanto a app grava e mostre no campo certo o erro que o servidor devolveu.

**Por que:**
- **[SDK]** O `ui-componentes-conteudo.md` diz que o erro de servidor exibido dentro do diálogo fica fora do formulário: "o formulário fecha ao confirmar; se a gravação falhar, a app avisa com `notificar`/`alertar` e pode reabrir o formulário com os valores que recebeu".
- **[relato]** No app 0.1.45, o Novo cliente perdia o nome e o e-mail depois do aviso "Não foi possível salvar".
- Quando o servidor recusa (`422` "Telefone inválido", `409` "Já existe um contato com este telefone"), o diálogo já fechou. Então o erro não aparece no campo que o causou, o diálogo fecha e reabre, e o foco volta ao primeiro campo.
- Não há medida arquivada deste pedido.

**O que o app faz até lá:**
- Um laço próprio (`formularioQueSalva`) reabre o formulário com o que foi digitado e a frase do erro no topo, até salvar ou o corretor cancelar.
- Na duplicata, o laço oferece "Abrir <nome>".
- As negociações ainda avisam e fecham.

**Proposta mínima:** `urbiVerso.formulario({ …, aoEnviar })`, com `aoEnviar(valores) => Promise<void | { erros?: Record<string, string>; mensagem?: string }>`.
- Enquanto a Promise corre, o diálogo fica aberto, com o Salvar ocupado.
- Resolvida sem erros: o diálogo fecha e resolve com os valores.
- Com `erros` (por nome de campo) ou `mensagem`: mostra cada erro no campo dele (onde já aparece o erro de `min`/`max` do `numero`) e a mensagem no topo, e continua aberto com o que foi digitado.
- Rejeitada: mostra uma mensagem genérica no topo e continua aberto.
- Opcional: uma ação secundária no diálogo, por exemplo "Abrir Ana Ribeiro" na duplicata.

**O que muda para o usuário quando entregue:** o corretor vê o erro ao lado do campo, sem o diálogo piscar e sem perder o foco.

**Como o shell confere que ficou pronto** (todas são **sugestão de critério**; o pedido não traz número medido, então elas saem do comportamento descrito):
1. Com `aoEnviar` devolvendo `{ erros: { telefone: "…" } }`, o diálogo não fecha, a frase aparece no campo telefone e o que foi digitado continua lá.
2. Com a Promise rejeitada, a mensagem genérica aparece no topo e o diálogo continua aberto.

---

## 31. Estrutura imposta pelo `urbi-hospedeiro` e grade de KPIs equilibrada

**O que pedimos:** que o `urbi-hospedeiro` faça o que o `ui.md` diz, e que o `urbi-grid` consiga quebrar em "4 ou 2 + 2".

**Por que:**
- **[SDK]** O `ui.md` § Papéis de UI diz: "quem hospeda IMPÕE a estrutura correspondente (`display`/`flex-direction`/`min-height`) no nó slotado direto" que declara papel.
- **[medido]** (`issue-180/medidas.md`) Em 1440×1000, o `pc-clientes-quadro` (componente do app, com `papel-fill`) fica `display: block` dentro do `urbi-hospedeiro`. O `urbi-stack expandir` de dentro não enche a altura: o quadro do Funil vai de y 421 a 817, e o centro vai até 984, ou seja, 167 px vazios. Em 1280×720, o quadro passa 113 px do fim do centro.
- **[medido]** O `papel-host` e o `papel-layout` não foram medidos.
- **[medido]** Os quatro KPIs pedem 596 px (4 × 140 + 3 × 12). Em 1280×720, o centro mede 531 px e a grade sai 3 + 1. Abaixo de ~1377 px de janela, ela sai 3 + 1, inclusive em 1366. Em 1440, os quatro ficam numa linha.

**O que o app faz até lá:**
- O quadro do Funil vai solto no slot `centro`, com o próprio `urbi-hospedeiro` dentro (app 0.1.55). Na prova no DOM, o quadro vai até y 968 (em 1440) e 688 (em 1280).
- Abaixo de ~1377 px, os KPIs ficam 3 + 1.

**Proposta mínima:**
- **(1)** O `urbi-hospedeiro` impõe `display`/`flex-direction` ao filho com `papel-fill`, como diz o `ui.md`.
- **(2)** O `urbi-grid` ganha uma opção de quebra equilibrada, por exemplo `colunas="4 2 1"`: entre as contagens listadas, a maior que cabe no `min`.

**O que muda para o usuário quando entregue:** o quadro do Funil ocupa a altura toda sem contorno, e os KPIs não deixam um cartão sozinho na última linha.

**Como o shell confere que ficou pronto** (todas são **sugestão de critério**):
1. Um filho com `papel-fill` dentro do `urbi-hospedeiro` sai com o `display`/`flex-direction` imposto (hoje `display: block`) e, com `expandir`, enche a altura. Hoje o quadro para em 817 de 984 px.
2. Com 4 KPIs de `min="140px"` num centro de 531 px, a grade sai 2 + 2. Hoje sai 3 + 1.

---

## 32. Moldura do celular: rodapé fixo e menos altura antes do conteúdo

**O que pedimos:** no celular, um lugar fixo no rodapé (para a barra de atalhos e para as ações da tela) e menos faixas empilhadas antes do conteúdo.

**Por que:**
- **Referência do app** (`specs/layout/`):
  - o conteúdo fica logo abaixo do cabeçalho do shell, que tem 51 px na M1;
  - em Hoje, uma barra de atalhos fixa no rodapé, com quatro botões de 87 × 37 em y 793;
  - em M3 e M8, as ações da tela fixas no rodapé, em y 794.
- **[SDK]** (`ui-componentes-layout.md`) Nenhum primitivo dá rodapé fixo no celular:
  - o `urbi-shell-page` só tem os slots `voltar`, `header-extra`, `actions` e o corpo, sem rodapé;
  - o `urbi-3-colunas` mostra as abas no celular sempre e não tem slot de rodapé;
  - no celular, o `urbi-2x1` empilha tudo, e só o `direita-rodape` fica no fim da rolagem.
- **[SDK]** O corte de 900 px aparece só em texto ("Em ≤900px", `ui.md`) e não é exportado como símbolo.
- **[medido]** (`issue-190/medidas.md`, 390 × 844) As faixas, de cima para baixo:

  | Faixa | y |
  |---|---|
  | Barra do shell | 0 a 56 |
  | Título da página com o Criar | 64 a 101 |
  | Seletor Conta (só para quem atende 2+ contas) | 113 a 167 |
  | Abas do `urbi-3-colunas` | 167 a 204 |
  | Começo do conteúdo | **220** (166 sem o seletor) |

  A referência começa em ~67. No rodapé da janela não há nada.

**O que o app faz até lá** (0.1.56):
- Hoje vai no `urbi-2x1`, sem abas e com uma rolagem só. Na prova no DOM, o conteúdo começa em y 183 com o seletor (0.1.56) e cerca de 129 sem ele (valor derivado: 183 menos a altura do seletor de Conta de 54 px, sem captura; o 183 está em `specs/prints/issue-190/prova.json`); na conferência da 0.1.58, em y 167 com o seletor.
- Em M3 e M8, as ações ficam no fim da coluna e do cartão, não fixas (D-124).
- O app escolhe entre `urbi-2x1` e `urbi-3-colunas` com um `matchMedia` próprio e o corte de 900 px copiado como número fixo. O `compatibilidade.md` (entrada v0.53.29) manda apagar esse `matchMedia` quando o shell resolver.

**Proposta mínima:**
- **(1)** Uma de duas:
  - o `urbi-shell-page` ganha um slot `rodape`, fixo no pé da janela no celular (≤ 900 px), com a altura descontada da área do corpo;
  - ou, para a barra de atalhos, o `nav` do manifesto aceita até quatro `atalhos_celular`, que o shell desenha no rodapé, com selo.
- **(2)** O `urbi-3-colunas` ganha slots `esquerda-rodape`/`centro-rodape`/`direita-rodape`, fixos no pé do painel visível também no celular, e uma prop para esconder as abas no celular quando a tela controla o `painel-ativo`.
- **(3)** No celular, o título da página e o `actions` ficam na mesma faixa do cabeçalho do shell. O Criar some do título quando a barra de atalhos o traz.

**O que muda para o usuário quando entregue:** o trabalho começa mais perto do topo, e os atalhos e os botões Salvar/Enviar ficam sempre à mão, sem rolar até o fim.

**Como o shell confere que ficou pronto** (todas são **sugestão de critério**):
1. Em 390 × 844, o conteúdo de rodapé fica fixo no pé da janela durante a rolagem, e o corpo não fica coberto por ele. Hoje não há rodapé.
2. Com as abas escondidas pela prop do item (2), o conteúdo começa sem a faixa de 37 px das abas (167 a 204). Hoje começa em y 220.
3. Com o item (3), o título e o Criar não ocupam faixa própria abaixo da barra do shell. Hoje ocupam a faixa de 64 a 101.

---

## Dependências entre os pedidos

Os pedidos **não declaram** que um depende do outro. O que há é componente em comum, que pode valer tratar junto:

- **29 e 30:** os dois mexem no `urbiVerso.formulario` (o 29 no nome acessível e na `busca`, o 30 no `aoEnviar`).
- **28 e 31:** os dois mexem no `urbi-hospedeiro`. O 28(a) pede uma superfície opaca nele (e no `urbi-3-colunas` e no `urbi-2x1`); o 31(1) pede que ele imponha a estrutura.
- **28 e 32:** os dois mexem no `urbi-3-colunas`. O 28(a) pede a superfície; o 32(2) pede os slots de rodapé e a prop para esconder as abas.
- **29(b) e 29(d):** são o mesmo primitivo, o `urbi-opcoes`.
- **Do lado do app:** o `matchMedia` próprio do app só sai depois do 32(2), a prop para esconder as abas.

## O que NÃO é pedido ao shell (o app já resolveu na etapa 5)

- **Texto de apoio:** o `fraco` virou `dica` em 21 arquivos de telas, 20 medidos (a conta demo não tem empreendimentos), 88 ocorrências (PR #213, 0.1.58), com as exceções abaixo de 4,5:1 listadas no pedido 28. Fica de fora do pedido 28 a escolha do papel; o que continua no 28 é cor do primitivo e do tema.
- **Véu cinza do `urbi-inbox`:** o app não usa mais o `urbi-inbox`. A moldura de três colunas (D-114) é anterior à etapa 5.
- **Rótulo em todo campo:** o app já passa o rótulo em todos, com dois testes que vigiam isso (PR #212, sem versão nova). O que falta no 29 é só a ligação do rótulo dentro do primitivo.
- **Formulário que perdia o que foi digitado:** o app reabre o formulário com os valores e o erro (PR #207, 0.1.53). O 30 pede o erro no campo, sem fechar.
- **Quadro do Funil sem altura e lista de Imóveis rolando de lado:** corrigidos (PR #209, 0.1.55). O 31 fica com o contrato do `urbi-hospedeiro` e com os KPIs 3 + 1.
- **Hoje no celular com abas e título da Negociação cortado:** corrigidos (PR #210, 0.1.56). O 32 fica com o rodapé fixo e com as faixas do cabeçalho.
