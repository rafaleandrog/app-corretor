---
titulo: Portal do Corretor
descricao: Escritório digital do corretor de imóveis — o que já existe nesta versão.
---

# Portal do Corretor

App do corretor de imóveis. Nesta versão existe só o esqueleto descrito abaixo.

## O que existe nesta versão (0.1.0)

Só o esqueleto. Ao abrir o app aparece a mensagem **"Portal do Corretor em construção"** com o
número da versão — sinal de que a instalação deu certo e de que a tela conversa com o servidor do
app. Se aparecer **"Não foi possível falar com o servidor do app"**, recarregue a página; se
continuar, avise pelo botão de ajuda.

### Página de diagnóstico (temporária)

Esta versão traz duas peças só para a equipe conferir a instalação; ambas saem quando as telas de
verdade chegarem:

- **Página pública** em `/portal_corretor/p` (sem login): mostra o endereço com que abriu e o que a
  rota pública `/api/pub/portal_corretor/diagnostico` respondeu. Não mostra dado nenhum. A equipe
  também tenta `/portal_corretor/p/teste` e `/portal_corretor/p?c=teste` — é uma **verificação**:
  a plataforma não garante que esses endereços abram a mesma página, e o resultado decide o formato
  do endereço público do corretor.
- **Linha "Endereço desta tela"** na tela do app: ao abrir `/portal_corretor/retorno?code=teste`,
  ela mostra `/retorno?code=teste` (usado mais tarde no retorno das conexões com a Meta).

Fora a página de diagnóstico, ainda não há cadastros, permissões próprias, páginas públicas, integrações nem uso de IA. Cada
funcionalidade passa a constar aqui na versão em que chegar.

## Serviços externos

Nenhum nesta versão.
