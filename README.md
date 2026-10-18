# Apps urbiverso

Este repositório recebeu o kit de apps do **urbiverso**, com tudo que uma app precisa para sair do
zero e chegar instalada na sua instância: a estrutura do projeto, um app de exemplo que funciona,
o automatismo que publica as versões e as skills que conduzem o trabalho com um agente de IA.

## O caminho, em uma linha

conversa com o agente → Pull Request → merge → **Run workflow** → instalar na instância.

## Comece por aqui

1. **Guarde o token.** Em **Settings → Secrets and variables → Actions**, crie o secret
   `URBIVERSO_PACKAGES_TOKEN` com o token `ghp_...` da conta de serviço da sua empresa. É ele que
   dá acesso ao SDK do urbiverso, que é um pacote privado. Isso é feito uma vez por repositório.
2. **Abra o Claude Code** em <https://claude.ai/code>, escolha este repositório e cadastre a
   mesma `URBIVERSO_PACKAGES_TOKEN` nas variáveis de ambiente da sessão. Isso é feito uma vez por
   pessoa.
3. **Peça o que você quer.** As skills abaixo estão disponíveis na sessão.

O passo a passo detalhado, com os links e o que responder em cada tela, está no guia
`primeiro-app.md` que veio junto da sua instância.

## O que tem aqui

| Pasta ou arquivo | O que é |
|---|---|
| `apps/ola_mundo/` | app de exemplo, semeado só em repositório sem `apps/` nem `modulos/`: cumprimenta quem está logado e prova que o caminho inteiro funciona |
| `.claude/skills/` | as skills que conduzem especificação, implementação, revisão e validação |
| `modulos/` | se o repositório também tiver módulos (opcional): um por pasta, `modulos/<slug>/` |
| `.github/workflows/release.yml` | publica uma versão de um app ou módulo, disparado à mão em **Actions** com o alvo (appId ou slug) |
| `.github/workflows/ci.yml` | a cada Pull Request, confere que nada quebrou: typecheck, build, testes e empacotamento de cada app e módulo |
| `CLAUDE.md` | as regras que o agente de IA segue neste repositório |
| `KIT.md` | qual versão do kit este repositório recebeu |

## Atualizações

Rode `npx @urbiverso/kit-apps` de novo: é o mesmo comando que trouxe o kit, e ele atualiza no
lugar. As pastas das skills do kit, o `KIT.md`, o `.claude/preparar-sessao.sh` e os workflows em
`.github/` são sobrescritos, então não os edite localmente — passo próprio de um app entra como
script `typecheck` ou `test` no `package.json` dele, que os workflows já rodam. Todo o resto é
seu — `apps/` e `modulos/` nunca são modificados nem apagados, e arquivo de fora do kit que já exista e divirja é
**relatado, não tocado**. Detalhes em `KIT.md`.

## Dúvidas

Fale com o seu contato no urbiverso.
