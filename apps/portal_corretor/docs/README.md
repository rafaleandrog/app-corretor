---
titulo: Portal do Corretor
descricao: O escritório digital do corretor de imóveis — o que já existe nesta versão.
---

# Portal do Corretor

App do corretor de imóveis. Cada corretor tem a **própria conta**: nenhum corretor vê nada de outro,
e a garantia é do banco de dados da plataforma, não só das telas.

## O que existe nesta versão (0.2.0)

| Para quem | Tela | O que faz |
|---|---|---|
| Corretor | **Início** | Mostra o que falta para começar (nome da conta, CRECI, telefone) |
| Corretor | **Ajustes › Conta e marca** | Seus dados, os dados da conta e as regras de atendimento — ver [Conta e ajustes](conta-e-ajustes.md) |
| Equipe da plataforma | **Equipe da plataforma › Corretores** | Convida corretores e acompanha os convites — ver [Convidar corretores](convidar-corretores.md) |

Ainda não há clientes, imóveis, funil, páginas públicas, integrações nem uso de IA. Cada
funcionalidade passa a constar aqui na versão em que chegar.

## Papéis

| Papel | Quem | Onde se atribui |
|---|---|---|
| `corretor` | O corretor, usuário externo dono da conta | Configurações › Usuários, seção Externos, depois que ele aceita o convite |
| `operacao` | A equipe da plataforma que convida corretores | Configurações › Usuários, seção Equipe |

Sem o papel, a tela mostra "Esta área não está liberada para você" e diz qual papel pedir.

### Página de diagnóstico (temporária)

Duas peças existem só para a equipe conferir a instalação e saem quando as telas de verdade
chegarem:

- **Página pública** em `/portal_corretor/p` (sem login): mostra o endereço com que abriu e o que a
  rota pública `/api/pub/portal_corretor/diagnostico` respondeu. Não mostra dado nenhum. A equipe
  também tenta `/portal_corretor/p/teste` e `/portal_corretor/p?c=teste` — é uma **verificação**:
  a plataforma não garante que esses endereços abram a mesma página, e o resultado decide o formato
  do endereço público do corretor.
- **Endereço recebido**: ao abrir um endereço que o app não conhece, como
  `/portal_corretor/retorno?code=teste`, a tela "Página não encontrada" mostra
  `/retorno?code=teste` (usado mais tarde no retorno das conexões com a Meta).

## Serviços externos

Nenhum nesta versão.
