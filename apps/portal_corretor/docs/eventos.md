---
titulo: Avisos e eventos
descricao: O que o app avisa pelo sininho e por e-mail, e o que fica na trilha de auditoria.
---

# Avisos e eventos

Tudo o que acontece de importante na sua conta vira um **evento** da plataforma: ele aparece no sininho,
pode chegar por e-mail ou Slack conforme as suas **Preferências de notificação**, e é o que liga as
automações (o Negociador IA, os lembretes). Cada evento carrega só os números de registro (do cliente, do
imóvel, da conversa), rótulos fechados (o tipo da atividade, o motivo da perda), datas e valores, e não o
nome, o telefone ou o texto de um cliente. Quem abre o aviso vê o resto na tela certa. Duas exceções: os
avisos que nascem na borda pública (`lead_recebido`, `reacao_recebida` e `acao_cliente_recebida`) levam o que
o visitante escreveu, porque ainda não há registro para apontar (ver o risco residual em
[Negociação e mandato](negociacao.md)); e a trilha de auditoria, abaixo, leva o **seu** nome.

Os eventos são sempre da **sua conta**: o corretor de outra conta não recebe nem vê os seus.

## O que avisa

| Quando | Evento |
|---|---|
| Alguém pede contato pela sua página ou pela ficha de um imóvel | `lead_recebido` |
| O cliente clica num link de imóvel que você mandou | `link_clicado` |
| O cliente reage a uma seleção (gostei, quero visitar, conversar sobre o preço) | `reacao_recebida`; "quero visitar" também avisa `visita_pedida` |
| O cliente escreve ou age pelo Portal do Cliente | `acao_cliente_recebida`, `mensagem_recebida` |
| Você manda uma mensagem, um imóvel, um arquivo ou o link do portal | `mensagem_enviada`, `envio_criado`, `acesso_cliente_convidado` |
| Você assume ou devolve uma conversa ao Negociador | `conversa_assumida`, `conversa_devolvida` |
| Entra uma atividade na agenda; uma visita é marcada; você registra o retorno de uma visita | `atividade_criada`, `visita_agendada`, `visita_feedback`, e o `lembrete_visita` na hora combinada |
| Uma planilha de contatos é importada | `contatos_importados` |
| Um negócio muda de etapa, é ganho ou perdido | `negocio_etapa_mudou`, `negocio_ganho`, `negocio_perdido` |
| Um imóvel entra, é anunciado, baixa de preço, muda de visibilidade ou é vendido | `imovel_criado`, `imovel_ativado`, `imovel_preco_reduzido`, `imovel_visibilidade_mudou`, `imovel_vendido` |
| Uma autorização de venda vence em até 30 dias (aviso diário, uma vez por autorização) | `autorizacao_vencendo` |
| A página é publicada | `pagina_publicada` |
| Uma peça do Estúdio fica pronta; é publicada no Instagram (pelo app ou marcada por fora); a publicação falha | `peca_pronta`, `publicacao_feita`, `publicacao_falhou`, e `publicacao_programada` na hora agendada |
| O Instagram recusa, vence ou fica fora do ar | `integracao_erro` |
| Negociações (propostas, contrapropostas, mandato, acordo, limite, objeções, assumir e devolver) | ver [Negociação e mandato](negociacao.md) |

## Trilha de auditoria

Conectar ou desconectar um canal (hoje, o Instagram) fica também na **trilha de auditoria** da
plataforma, que o administrador da instância consulta: `canal_conectado` e `canal_desconectado` guardam
quem fez (o nome de quem estava logado) e qual canal. É o único caso em que um nome vai no evento, e é o
seu, não o de um cliente.

## O que ainda não existe

Avisos do WhatsApp e do Mensageiro (mensagem que falhou, conversa passada do Mensageiro a você) chegam
com a conexão do WhatsApp; a decisão do corretor sobre uma proposta ganha aviso próprio na tela de
Negociações; parcerias, reservas e cotas são de versões futuras.
