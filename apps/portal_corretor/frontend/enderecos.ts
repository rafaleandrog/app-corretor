// Endereços das telas do corretor (spec 11.0.5, D-103): cada sub-rota abre uma tela, e os caminhos
// antigos continuam como apelidos, porque o SDK não redireciona. Puro, sem lit nem `urbiVerso`, para
// o teste conferir cada apelido sem montar a app. A tabela `TELAS` de `index.ts` liga a chave à tela.

export type ChaveTela =
  | 'hoje'
  | 'conversas'
  | 'clientes'
  | 'importar'
  | 'cliente'
  | 'imoveis'
  | 'imovel'
  | 'novo_imovel'
  | 'empreendimento'
  | 'estudio'
  | 'pagina'
  | 'numeros'
  | 'ajustes'
  | 'negociacoes'
  | 'corretores';

export const ENDERECOS: Record<string, ChaveTela> = {
  '/': 'hoje',
  // Apelido: a spec chama Hoje de `/hoje` (11.1 P01); a tela mora na raiz.
  '/hoje': 'hoje',
  // Apelido: a Agenda virou a aba Agenda de Hoje (D-82).
  '/agenda': 'hoje',
  // Apelido: o Assistente saiu do menu e abre na coluna de contexto (D-109); `/assistente` abre Hoje com ele aberto.
  '/assistente': 'hoje',
  // Conversas (P02, D-116): a caixa de conversas, sem WhatsApp até o bloco 6.
  '/conversas': 'conversas',
  '/clientes': 'clientes',
  // Apelido: o Funil virou a visão Funil de Clientes (D-83).
  '/funil': 'clientes',
  '/clientes/importar': 'importar',
  '/imoveis': 'imoveis',
  // Apelido: Empreendimentos virou a aba Empreendimentos de Imóveis (D-84).
  '/empreendimentos': 'imoveis',
  // Novo imóvel em 4 passos (P07, M3); `?item=<id>` retoma um rascunho e `?passo=` abre o passo.
  '/imoveis/novo': 'novo_imovel',
  '/estudio': 'estudio',
  '/pagina': 'pagina',
  // Apelido: Minha página virou Página (spec 11.1, P09).
  '/minha-pagina': 'pagina',
  '/numeros': 'numeros',
  // Apelido: Desempenho virou Números (D-103).
  '/desempenho': 'numeros',
  '/ajustes': 'ajustes',
  // Apelidos: os endereços antigos abrem Ajustes na aba certa. `/ajustes/conexoes` é também o
  // retorno do Instagram cadastrado na Meta (`?code=&state=`).
  '/conta': 'ajustes',
  '/ajustes/conta': 'ajustes',
  '/ajustes/marca': 'ajustes',
  '/ajustes/conexoes': 'ajustes',
  '/ajustes/funil': 'ajustes',
  '/ajustes/atendimento': 'ajustes',
  '/ajustes/mensageiro': 'ajustes',
  '/ajustes/negociador': 'ajustes',
  '/ajustes/privacidade': 'ajustes',
  // Clientes › Negociações sem o resto de Clientes: o menu do negociador humano (D7, spec 11.6).
  '/negociacoes': 'negociacoes',
  '/corretores': 'corretores',
};

const COM_ID: Record<string, ChaveTela> = { clientes: 'cliente', imoveis: 'imovel', empreendimentos: 'empreendimento' };

/** `/conta/` e `/conta` são a mesma tela; a raiz continua `/`. */
export const normalizar = (sub: string) => (sub.length > 1 ? sub.replace(/\/+$/, '') : sub) || '/';

/**
 * Rota exata primeiro; depois as de id numérico (`/clientes/:id`, `/imoveis/:id`, `/empreendimentos/:id`).
 * `/clientes/:id` é apelido da ficha na Lista (`fichaCanonica`): o app troca o endereço ao chegar.
 */
export function resolverEndereco(sub: string): { chave?: ChaveTela; param?: string } {
  const s = normalizar(sub);
  if (ENDERECOS[s]) return { chave: ENDERECOS[s] };
  const m = s.match(/^\/(clientes|imoveis|empreendimentos)\/(\d+)$/);
  return m ? { chave: COM_ID[m[1]], param: m[2] } : {};
}

/**
 * Contato do `?item=` de Clientes (`?item=7`, spec 11.0.2). O `item` só é contato na Lista: a chave
 * `visao` ausente ou `lista`. Em qualquer outra (`quadro`, `negociacoes` ou valor desconhecido) o `item`
 * é de outra coisa (a notificação de negociação abre `?visao=negociacoes&item=<negociacao_id>`) e nenhuma
 * ficha abre. Regra única: a tela de Clientes e `contatoDoEndereco` usam esta função.
 */
export function contatoDoItem(busca = ''): number | null {
  const q = new URLSearchParams(busca);
  const visao = q.get('visao');
  if (visao !== null && visao !== 'lista') return null;
  const item = q.get('item') ?? '';
  return /^\d+$/.test(item) ? Number(item) : null;
}

/**
 * Query depois de trocar a visão de Clientes (`para`: `lista` ou `quadro`), a partir da `busca` atual e da
 * visão `atual` que a tela mostra (já com o apelido `/funil`). Os demais parâmetros ficam. Ir à Lista só
 * mantém o `item` que já era contato na Lista (`contatoDoItem` e `atual === 'lista'`): um `item` que veio com
 * outra visão (`negociacoes`, `quadro`, desconhecida) ou que passou pelo Funil é de outra coisa e sai.
 * Clicar na visão em que já se está não desfaz a seleção. Regra única de `trocarVisao`.
 */
export function buscaDaVisao(busca: string, atual: string, para: string): string {
  const q = new URLSearchParams(busca);
  if (para === 'lista') {
    if (!(atual === 'lista' && contatoDoItem(busca) !== null)) q.delete('item');
    q.delete('visao');
  } else q.set('visao', para);
  return q.toString();
}

/**
 * Contato em foco no endereço (ficha aberta), para o Assistente e o Criar levarem o contexto: o item
 * selecionado na Lista de Clientes (`contatoDoItem`) ou o caminho antigo `/clientes/7`.
 */
export function contatoDoEndereco(sub: string, busca = ''): number | null {
  const s = normalizar(sub);
  const m = s.match(/^\/clientes\/(\d+)$/);
  if (m) return Number(m[1]);
  return s === '/clientes' ? contatoDoItem(busca) : null;
}

/**
 * Ficha do cliente pelo caminho antigo (`/clientes/7?sugerir=1`): o endereço canônico é a Lista com o
 * item selecionado (P04, `/clientes?item=7&sugerir=1`). Devolve a query nova, ou `null` se o caminho
 * não é o antigo. A visão vai para Lista, porque a ficha mora nela.
 */
export function fichaCanonica(sub: string, busca = ''): string | null {
  const m = normalizar(sub).match(/^\/clientes\/(\d+)$/);
  if (!m) return null;
  const q = new URLSearchParams(busca);
  q.delete('visao');
  q.set('item', m[1]);
  return `?${q}`;
}

/**
 * Menu do corretor com os nomes do Padrão B (D-103), na ordem de 11.0.1: é o menu da moldura. Fica
 * fora do `nav` do manifesto (D-113, #166): o menu do app no cabeçalho do shell não repete esse menu e
 * traz só Equipe da plataforma › Corretores, que não tem outro caminho (o teste confere).
 */
export const MENU: { titulo: string; rota: string; icone: string }[] = [
  { titulo: 'Hoje', rota: '/', icone: 'fa-solid fa-house' },
  { titulo: 'Conversas', rota: '/conversas', icone: 'fa-regular fa-comments' },
  { titulo: 'Clientes', rota: '/clientes', icone: 'fa-solid fa-address-book' },
  { titulo: 'Imóveis', rota: '/imoveis', icone: 'fa-solid fa-building' },
  { titulo: 'Estúdio', rota: '/estudio', icone: 'fa-solid fa-wand-magic-sparkles' },
  { titulo: 'Página', rota: '/pagina', icone: 'fa-solid fa-globe' },
  { titulo: 'Números', rota: '/numeros', icone: 'fa-solid fa-chart-line' },
  { titulo: 'Ajustes', rota: '/ajustes', icone: 'fa-solid fa-sliders' },
];

/**
 * Menu do negociador humano (papel `negociador`, D7, spec 5.1 e 11.6; D-125): só as negociações
 * atribuídas a ele. A app abre direto nelas e qualquer outra rota redireciona para lá
 * (`destinoDoNegociador`). O `nav` do manifesto não filtra por papel (pedido ao shell 25).
 */
export const MENU_NEGOCIADOR: { titulo: string; rota: string; icone: string }[] = [
  { titulo: 'Negociações', rota: '/negociacoes', icone: 'fa-solid fa-handshake' },
];

/**
 * D-125: para quem tem só o papel `negociador`, toda rota da app que não é a das Negociações vai para
 * ela. O link de uma notificação de negociação (`/clientes?visao=negociacoes&item=<id>`) chega na mesma
 * negociação (`/negociacoes?item=<id>`); o resto abre a lista. `null` = já está nas Negociações.
 */
export function destinoDoNegociador(sub: string, busca: string): string | null {
  if (sub === '/negociacoes') return null;
  const q = new URLSearchParams(busca);
  const item = Number(q.get('item'));
  const daNegociacao = (sub === '/clientes' && q.get('visao') === 'negociacoes') || sub.startsWith('/negociacoes');
  return `/negociacoes${daNegociacao && Number.isInteger(item) && item > 0 ? `?item=${item}` : ''}`;
}
