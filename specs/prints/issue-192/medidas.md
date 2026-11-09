# Issue #192: nome acessível dos campos, medido na homologação "pinguim" (app 0.1.51, shell 0.56.37, 09/11/2026)

Só leitura, Playwright pré-instalado, base de `scripts/conferencia-visual/capturar.mjs` (`CONTA=7`, Corretor A (demo)); toda chamada à instância que não fosse GET/HEAD era abortada no navegador (nenhuma tentada). Árvore por `page.locator('body').ariaSnapshot()` (no Filtros, a do `dialog`), 1440 × 1000. Arquivos `<tela>.aria.txt`, sem token.

| Tela (endereço) | Campos | Sem nome | Nome = placeholder | Nome = rótulo |
|---|---|---|---|---|
| Clientes (`/clientes`) | 2 | 1 (seletor Conta) | 1 (Buscar cliente → "Buscar nome ou telefone") | 0 |
| Clientes › Filtros (`urbiVerso.formulario`) | 2 | 2 (Temperatura, Origem) | 0 | 0 |
| Novo imóvel, passo 1 (`/imoveis/novo`) | 2 | 1 (Conta) | 1 (Seu código → "Em branco: IM-0001…") | 0 |
| Importar (`/clientes/importar`) | 2 | 2 (Conta, De onde vem a planilha?) | 0 | 0 |
| Ajustes › Conta e marca (`/ajustes/conta`; `/ajustes/marca` dá a mesma árvore) | 13 | 7 (Conta, Tipo de conta, CPF ou CNPJ, CRECI jurídico, Estilo das artes, Cor principal, Cor de apoio) | 6 | 0 |
| **Total** | **21** | **13** | **8** | **0** |

Contagem de Ajustes: as cores (`tipo="color"`) saem `textbox: "#0b5394"`, só com o valor, e entram como sem nome; a coluna "Sem nome" soma o seletor Conta, 2 `combobox`, 2 `textbox` sem placeholder e as 2 cores = 7 de 13; os outros 6 só têm o placeholder.

O que a árvore mostra: o `label` de `urbi-input`, `urbi-select` e `urbi-textarea` vira texto solto antes do campo (`- text: Tipo de conta` / `- combobox:`), sem ligação; o `urbi-checkbox` liga (`checkbox "O negócio chega à etapa Proposta"`, em Ajustes › Negociador, `ajustes-negociador.aria.txt`); os campos nativos da página pública com `<label>` também. A tela de login do shell tem o mesmo defeito. Todo campo montado pelo app já passa `label` (e todo campo do `formulario`, `rotulo`): o que falta é do primitivo, pedido 29 em `specs/pedidos_ao_shell.md`.

O passo 2 do Novo imóvel (Tipo, Cidade, Quartos…) não foi aberto (a captura parou nos campos do passo 1); usa os mesmos `urbi-select`/`urbi-input` com `label`. Este trabalho não muda nenhuma tela (só testes e o pedido ao shell): não há versão nova da app para conferir; a prova na instância, quando o shell ligar o rótulo, é repetir esta captura.
