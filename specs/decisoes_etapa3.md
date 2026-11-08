# Decisões do dono para a etapa 3

Respostas às decisões levantadas no diagnóstico. Registre cada item na spec como uma nova decisão `D-nn` (na sequência das existentes) e ajuste as seções afetadas.

## 1. Moldura
Aceita a moldura do shell: barra e cabeçalho do shell, com o botão **Criar** no cabeçalho, e margem de 24 px. A app não desenha trilho próprio. **Colunas: 360 px fixos · flexível · 340 px fixos.** O botão **Assistente** fica no fim do cabeçalho da coluna esquerda de toda tela. As referências foram regeneradas nessa moldura (`specs/layout/` versão 2, só a área da app, 1289 px de largura em viewport de 1440). Não pedir modo de página cheia ao shell agora; pode virar pedido futuro, sem bloquear nada.

## 2. Primitivos
Aceitos os tamanhos da plataforma: **botão 34 px, campo 36 px, raio de cartão 12 px, peso máximo 700**. As referências versão 2 já usam esses valores.

## 3. P02 como piloto sem WhatsApp
Opção 2: criar agora o schema de **conversas e mensagens** da spec 6.5, alimentado pelas mensagens do Portal do Cliente (M4) e pelos envios e ações do corretor ("Fazer agora", envio de imóvel, seleção, arquivo, localização, link do portal). O canal WhatsApp, a janela de 24 h e os modelos ficam para o bloco 6. Enquanto isso, P02 mostra no topo do centro a faixa "WhatsApp ainda não conectado · Ajustes › Conexões". Subir a `versao` do manifesto.

## 4. P04
Vale o PNG: o histórico (linha do tempo) é uma **aba do centro**, como a app já faz. Ajustar o texto da spec 11.1 P04 onde divergir. PNG e JSON não mudam.

## 5. Eventos
Bloco próprio e curto **logo depois do piloto e antes do grupo 2**: declarar no manifesto todos os eventos do catálogo da spec 13.1 com `segregado_por_conta: true` e a marca de auditável onde a spec indica. O piloto já declara e publica os eventos que usa: `mensagem.recebida`, `mensagem.enviada`, `envio.criado`, `conversa.assumida`, `conversa.devolvida`.

## 6. Decisões antigas que contradizem os PNG
**A referência é o alvo.** Ficam superadas as decisões antigas que a contradizem:
- Estúdio com prévias das peças e créditos do mês;
- Página com blocos arrastáveis (setas para subir e descer podem existir como alternativa acessível);
- Mandato em gaveta lateral (se o shell só oferecer modal, usar o modal maior possível e registrar);
- faixa ZOPA com régua (exceção nomeada);
- Conexões mostra os 3 passos do WhatsApp com o estado "indisponível até o bloco 6".

Diferença só por limite real da plataforma, registrada no PR.

## 7. Contraproposta própria do corretor
Sim. O corretor pode enviar a própria contraproposta, sem depender de sugestão da IA:
- botão **Nova contraproposta** em P15;
- **Editar** no cartão de sugestão (P15 e M8);
- pelo celular (M2/M8);
- pelo portal do cliente (M5b) no MVP, e pelo WhatsApp quando o bloco 6 existir.

Valem as mesmas validações da spec 10.9.7 (sigilo, passo, rodadas, validade). **Abaixo do ponto de recuo:** para o **corretor**, aviso com confirmação explícita e registro auditável (ele é o dono do mandato); para **negociador humano e IA**, bloqueio.

## Ambiente
- **Conta "(demo)" na homologação:** autorizada a criação pela API, com um usuário externo corretor (e um segundo corretor para o teste de isolamento).
- **Reinício da app:** se você tiver a alçada `sistema`, faça; se não, diga exatamente o caminho no Admin para o dono fazer.
- **Instagram (pendência 30):** não é necessário no grupo 1; fica para o grupo de Estúdio e Conexões.
- **Release:** conferir no 0.1.45 se estiver instalado; senão o 0.1.44 serve para o piloto.
- **Captura:** seguir com o token atual.

## Referências aprovadas
O dono **aprova as referências versão 2 de todas as telas** (`specs/layout/png/*.png` e `*.layout.json`), o que atende à regra do `CLAUDE.md` para os grupos seguintes.

## Grupo 1 (fechado)
**Moldura + P02 Conversas completa (opção 2).**

Moldura:
- menu pelo shell;
- cabeçalho de coluna com o Assistente;
- colunas 360 · flexível · 340;
- estados da spec 11.0.4.

P02 Conversas: todos os comandos da tabela da spec 11.1 P02 que não dependem do WhatsApp, funcionando com o novo schema.

Pronto quando: conferência visual sem diferença estrutural, teste de isolamento passando e PR com as duas capturas e a tabela de diferenças.
