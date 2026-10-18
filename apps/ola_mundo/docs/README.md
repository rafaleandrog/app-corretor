# Olá, mundo

App de exemplo que vem com o repositório. Ele chama uma rota do próprio backend e mostra o nome
de quem está logado.

Serve a três coisas:

1. **Prova o caminho completo** — empacotar, publicar release, instalar na instância — antes de
   existir qualquer app de verdade. Se ele sobe, o encanamento está certo.
2. **É o exemplo mínimo dos contratos** que toda app desta plataforma segue: rota relativa no
   backend, `urbiVerso.api()` no frontend, tag `app-<app-id>`, manifesto com `versao`.
3. **É o alvo de validação** quando alguém quer conferir que a instância e o repositório ainda
   conversam.

## O que ele tem

| Arquivo | O que faz |
|---|---|
| `backend/rotas.ts` | uma rota `GET /ola` que devolve `{ mensagem }` com o nome do usuário do contexto |
| `frontend/index.ts` | um componente Lit que chama a rota e mostra a mensagem |
| `manifesto.json` | nome, versão e descrição do app para a instância |

## Posso apagar?

Pode, depois que o seu app de verdade estiver instalado e funcionando. Apague a pasta
`apps/ola_mundo/` inteira e desinstale o app na instância em **Admin → Apps**. O workflow de
release não precisa de nada: ele recebe o appId digitado e valida contra o que existe em `apps/`.

Enquanto o seu primeiro app ainda não subiu, deixe-o onde está: quando alguma coisa parar de
funcionar, ele é a forma mais barata de descobrir se o problema é do seu código ou do caminho.

## O app de verdade nasce ao lado

Não edite este app para transformá-lo no seu. Cada app mora na sua própria pasta em `apps/`, e o
segundo entra ao lado do primeiro sem reorganizar nada.
