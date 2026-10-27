# CLAUDE.md — Portal do Corretor

Instruções permanentes para toda sessão de implementação neste repositório. Leia este arquivo inteiro no início de cada sessão.

## O que é

App `portal_corretor` da plataforma **UrbiVerso**: escritório digital do corretor de imóveis (CRM e funil com IA, WhatsApp pelo app com o Mensageiro, Estúdio de conteúdo para Instagram com Canva, Minha Página, Portal do Cliente, Assistente do Corretor). Corretor, clientes e negociadores humanos são usuários externos da conta do corretor; **nenhum corretor vê nada de outro corretor**. Todas as telas seguem o **Padrão B** (spec 11.0: trilho de ícones + três colunas lista, foco e contexto).

## Mapa do repositório

```
CLAUDE.md                          este arquivo
apps/portal_corretor/              a app (manifesto, schema, backend, frontend, comum, migracoes, docs)
specs/portal_corretor.md           a spec: O QUE construir (fonte de verdade de produto)
specs/plano_de_implementacao.md    a ordem: blocos, status, registro de sessões
specs/pedidos_ao_shell.md          ajustes necessários no shell do UrbiVerso
specs/telas_padrao_b.md            guia visual do Padrão B: moldura, componentes, wireframe de cada tela, dados de exemplo
specs/telas/                       mockups HTML estáticos de cada tela (abrir index.html no navegador; só referência visual)
specs/stack_funcional.md           intenção de produto sem amarras de plataforma (consulta)
specs/referencias_principais.md    as 5 referências principais: o que copiar de cada uma (consulta de tela e comportamento)
specs/referencias.md               catálogo amplo de produtos de mercado (consulta)
specs/urbiverso-frameworks-resumo.md  resumo dos frameworks da plataforma (consulta)
```

## Ordem de autoridade

1. **Contrato da plataforma:** docs do `@urbiverso/sdk` instalado (bundle publicado, nunca o `main` do monorepo).
2. **Produto:** `specs/portal_corretor.md`.
3. **Ordem e status:** `specs/plano_de_implementacao.md`.
4. **Forma das telas:** `specs/telas_padrao_b.md` e os mockups em `specs/telas/` (referência visual; o comportamento está na spec 11).
5. Consulta: resumo dos frameworks, referências principais, stack funcional, catálogo de referências.

Se a spec pedir algo que o SDK não permite, **não contorne**: registre o conflito no plano, proponha alternativa e pergunte ao dono.

## Como trabalhar em cada sessão

1. Abra `specs/plano_de_implementacao.md`, pegue o **primeiro bloco não concluído** da fase atual e leia na spec as seções que ele cita.
2. Trabalhe numa branch do bloco. Um PR por bloco (ou por parte de bloco, se for grande), com doc e código juntos.
3. Ao terminar: testes passando, `apps/portal_corretor/docs/` atualizado com o que passou a existir, status do bloco atualizado no plano e uma linha no registro de sessões.
4. PR com `Closes #<issue>` quando houver issue. Se a skill `revisar-pr-apps` estiver disponível nesta sessão, rode-a no PR antes de pedir o merge. **Merge só com autorização expressa do dono na conversa.**
5. Termine a sessão dizendo o que ficou pronto, o que ficou pendente e qual é o próximo bloco.

## Regras que não se quebram

- **Isolamento:** toda tabela com `segregada_por_conta: true` e `acesso_externo: "restrito"`. Nenhuma tabela fora do RLS. Acesso só por rotas próprias, checando role (`corretor`, `cliente`, `operacao`, `suporte`) e escopando por `usuario.id`. Recurso de outra conta responde "não encontrado". O teste de isolamento (spec 4.5) roda em todo PR.
- **Cliente** vê só o que está em `itens_cliente` com o `usuario.id` dele.
- **Negociador:** nenhuma contraproposta sai sem passar pelas validações de código da spec 10.9.7 (piso, passo, rodadas, concessões, sigilo, validade, janela). O ponto de recuo, o alvo e a BATNA do vendedor nunca chegam a rota, evento, exportação ou tela do cliente. Aceite final é sempre do corretor.
- **Negociador humano** (role `negociador`) vê só as negociações em `atribuicoes_negociacao` com o `usuario.id` dele.
- **Sem SQL cru**, sem pool, sem importar código do shell ou de outra app.
- **UI só com primitivos `urbi-*` e tokens**, na moldura do Padrão B (spec 11.0); lacunas como exceção nomeada no mesmo PR (spec 11.9). Páginas públicas têm CSS próprio.
- **IA só por `req.ia.consultar` com JSON Schema**; o app valida e executa as ações; sonda `estadoSlot` e degrada quando o slot não estiver disponível.
- **Hora marcada por `req.eventos.agendar`**; listeners e rotinas idempotentes.
- **Chamadas externas com `fetch()`**; segredos em colunas `segredo` e `parametros` `secret`.
- **Soft delete** por `PATCH …/remover`; `DELETE` só admin.
- Permissão nunca por `usuario.tipo`, `natureza` ou "veio por token".
- Não implementar login, ajuda, bug, sugestão, "sobre", temas, branding da instância: são da plataforma.
- Nenhum corretor real no MVP; integrações com contas de teste da equipe.
- Subir `versao` do manifesto quando mudar schema, migração ou pisos.

## Quando parar e perguntar ao dono

- Algum item de `specs/pedidos_ao_shell.md` não pode ser resolvido no SDK atual.
- A spec e o SDK divergem.
- Uma decisão nova muda escopo, custo ou o que o corretor ou o cliente vê.
- Antes de qualquer merge.

## Specs e docs

A spec descreve o que **ainda não existe**. Quando um bloco vira código, o comportamento passa a ser documentado em `apps/portal_corretor/docs/` e a spec ganha só a marca "implementado" no plano. Decisões novas entram na spec como `D-nn`; dúvidas como `P-nn`.
