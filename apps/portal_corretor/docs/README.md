---
titulo: Portal do Corretor
descricao: Escritório digital do corretor de imóveis — o que já existe nesta versão.
---

# Portal do Corretor

O Portal do Corretor será o escritório digital do corretor de imóveis: clientes e funil com IA,
WhatsApp pelo app, conteúdo para o Instagram, página própria e um portal simples para cada cliente.

## O que existe nesta versão (0.1.0)

Só o esqueleto. Ao abrir o app aparece a mensagem **"Portal do Corretor em construção"** com o
número da versão — sinal de que a instalação deu certo e de que a tela conversa com o servidor do
app. Se aparecer **"Não foi possível falar com o servidor do app"**, recarregue a página; se
continuar, avise pelo botão de ajuda.

### Página de diagnóstico (temporária)

Esta versão traz duas peças só para a equipe conferir a instalação; ambas saem quando as telas de
verdade chegarem:

- **Página pública** em `/portal_corretor/p` (sem login). Abra também `/portal_corretor/p/teste` e
  `/portal_corretor/p?c=teste`: a página mostra o endereço com que abriu e o que a rota pública
  `/api/pub/portal_corretor/diagnostico` respondeu. Não mostra dado nenhum.
- **Linha "Endereço desta tela"** na tela do app: abra `/portal_corretor/retorno?code=teste` para
  ver se o app recebe a sub-rota e os parâmetros (usado mais tarde no retorno das conexões com a
  Meta).

Ainda não há cadastros, permissões próprias, páginas públicas, integrações nem uso de IA. Cada
funcionalidade passa a constar aqui na versão em que chegar.

## Serviços externos

Nenhum nesta versão.
