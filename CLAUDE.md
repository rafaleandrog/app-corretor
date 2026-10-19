# CLAUDE.md — Portal do Corretor

**Regras da plataforma:** leia o [`KIT.md`](./KIT.md) por completo antes de mexer em qualquer coisa. Ele é escrito pelo kit urbiverso e vale acima deste arquivo em regra de plataforma.

@./KIT.md

Instruções permanentes para toda sessão de implementação neste repositório. Leia este arquivo inteiro no início de cada sessão.

## O que é

App `portal_corretor` da plataforma **UrbiVerso**: escritório digital do corretor de imóveis (CRM e funil com IA, WhatsApp pelo app com o Mensageiro, Estúdio de conteúdo para Instagram com Canva, Minha Página, Portal do Cliente, Assistente do Corretor). Corretor e clientes são usuários externos da conta do corretor; **nenhum corretor vê nada de outro corretor**.

## Mapa do repositório

```
CLAUDE.md                          este arquivo
apps/portal_corretor/              a app (manifesto, schema, backend, frontend, comum, migracoes, docs)
specs/portal_corretor.md           a spec: O QUE construir (fonte de verdade de produto)
specs/plano_de_implementacao.md    a ordem: blocos, status, registro de sessões
specs/pedidos_ao_shell.md          ajustes necessários no shell do UrbiVerso
specs/stack_funcional.md           intenção de produto sem amarras de plataforma (consulta)
specs/referencias.md               produtos de mercado para referência (consulta)
specs/urbiverso-frameworks-resumo.md  resumo dos frameworks da plataforma (consulta)
```

## Ordem de autoridade

1. **Contrato da plataforma:** docs do `@urbiverso/sdk` instalado (bundle publicado, nunca o `main` do monorepo).
2. **Produto:** `specs/portal_corretor.md`.
3. **Ordem e status:** `specs/plano_de_implementacao.md`.
4. Consulta: resumo dos frameworks, stack funcional, referências.

Se a spec pedir algo que o SDK não permite, **não contorne**: registre o conflito no plano, proponha alternativa e pergunte ao dono.

## Como trabalhar em cada sessão

1. Abra `specs/plano_de_implementacao.md`, pegue o **primeiro bloco não concluído** da fase atual e leia na spec as seções que ele cita.
2. Trabalhe numa branch do bloco. Um PR por bloco (ou por parte de bloco, se for grande), com doc e código juntos.
3. Ao terminar: testes passando, `apps/portal_corretor/docs/` atualizado com o que passou a existir, status do bloco atualizado no plano e uma linha no registro de sessões.
4. PR com `Closes #<issue>` quando houver issue. **Merge só com autorização expressa do dono na conversa.**
5. Termine a sessão dizendo o que ficou pronto, o que ficou pendente e qual é o próximo bloco.

## Armadilhas já encontradas

- **Mudou algo em `apps/portal_corretor/docs/`?** Rode `pnpm ajuda` na pasta da app e commite `comum/ajuda-gerada.ts`; sem isso o teste da base de ajuda derruba o CI.
- **Reiniciar a branch depois de um merge:** `git fetch origin main` antes de `git checkout -B <branch> origin/main`, senão a branch nasce sem o PR anterior.
- **Telas chamam o app por `chamarApi`/`chamarFetch`** (`frontend/apoio.ts`), nunca por `urbiVerso.api`/`fetch` direto: é isso que manda a conta ativa em `X-Conta` para quem atende várias contas (um teste confere).
- **Rotas leem e gravam só por `req.dados`:** com várias contas ele vem restrito à conta ativa nas tabelas segregadas (`backend/escopo.ts`; tabela não segregada, como `vitrine_publica`, passa sem escopo). Verbos sem escopo possível (`travessia`, `*Varios`, `criarOuAtualizar`, `sqlDeclarado`) falham alto com várias contas; não crie outro caminho de leitura.

## Regras que não se quebram

- **Isolamento:** toda tabela com `segregada_por_conta: true` e `acesso_externo: "restrito"`. Nenhuma tabela fora do RLS, com uma exceção decidida pelo dono: `vitrine_publica` (D-55), só com o que o corretor publicou e sem dado pessoal. Acesso só por rotas próprias, checando role (`corretor`, `cliente`, `operacao`, `suporte`) e escopando por `usuario.id`. Recurso de outra conta responde "não encontrado". O teste de isolamento (spec 4.5) roda em todo PR.
- **Cliente** vê só o que está em `itens_cliente` com o `usuario.id` dele.
- **Sem SQL cru**, sem pool, sem importar código do shell ou de outra app.
- **UI só com primitivos `urbi-*` e tokens**; lacunas como exceção nomeada no mesmo PR (spec 11.5). Páginas públicas têm CSS próprio.
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
