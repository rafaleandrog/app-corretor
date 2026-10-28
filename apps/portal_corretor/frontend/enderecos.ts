// Endereços das telas do corretor (spec 11.0.5, D-103): cada sub-rota abre uma tela, e os caminhos
// antigos continuam como apelidos, porque o SDK não redireciona. Puro, sem lit nem `urbiVerso`, para
// o teste conferir cada apelido sem montar a app. A tabela `TELAS` de `index.ts` liga a chave à tela.

export type ChaveTela =
  | 'hoje'
  | 'clientes'
  | 'importar'
  | 'cliente'
  | 'imoveis'
  | 'imovel'
  | 'empreendimento'
  | 'estudio'
  | 'pagina'
  | 'numeros'
  | 'ajustes'
  | 'corretores';

export const ENDERECOS: Record<string, ChaveTela> = {
  '/': 'hoje',
  // Apelido: a Agenda virou a aba Agenda de Hoje (D-82).
  '/agenda': 'hoje',
  // Apelido: o Assistente saiu do menu e abre na coluna de contexto (D-109); `/assistente` abre Hoje com ele aberto.
  '/assistente': 'hoje',
  '/clientes': 'clientes',
  // Apelido: o Funil virou a visão Quadro de Clientes (D-83).
  '/funil': 'clientes',
  '/clientes/importar': 'importar',
  '/imoveis': 'imoveis',
  // Apelido: Empreendimentos virou a aba Empreendimentos de Imóveis (D-84).
  '/empreendimentos': 'imoveis',
  '/estudio': 'estudio',
  '/pagina': 'pagina',
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
  '/corretores': 'corretores',
};

const COM_ID: Record<string, ChaveTela> = { clientes: 'cliente', imoveis: 'imovel', empreendimentos: 'empreendimento' };

/** `/conta/` e `/conta` são a mesma tela; a raiz continua `/`. */
export const normalizar = (sub: string) => (sub.length > 1 ? sub.replace(/\/+$/, '') : sub) || '/';

/** Rota exata primeiro; depois as de id numérico (`/clientes/:id`, `/imoveis/:id`, `/empreendimentos/:id`). */
export function resolverEndereco(sub: string): { chave?: ChaveTela; param?: string } {
  const s = normalizar(sub);
  if (ENDERECOS[s]) return { chave: ENDERECOS[s] };
  const m = s.match(/^\/(clientes|imoveis|empreendimentos)\/(\d+)$/);
  return m ? { chave: COM_ID[m[1]], param: m[2] } : {};
}

/** Contato em foco no endereço (ficha aberta), para o Assistente e o Criar levarem o contexto. */
export function contatoDoEndereco(sub: string): number | null {
  const m = normalizar(sub).match(/^\/clientes\/(\d+)$/);
  return m ? Number(m[1]) : null;
}

/**
 * Menu do corretor com os nomes do Padrão B (D-103), na ordem de 11.0.1. É o mesmo do `nav` do
 * manifesto (o teste confere) e o do trilho da moldura.
 */
export const MENU: { titulo: string; rota: string; icone: string }[] = [
  { titulo: 'Hoje', rota: '/', icone: 'fa-solid fa-house' },
  { titulo: 'Clientes', rota: '/clientes', icone: 'fa-solid fa-address-book' },
  { titulo: 'Imóveis', rota: '/imoveis', icone: 'fa-solid fa-building' },
  { titulo: 'Estúdio', rota: '/estudio', icone: 'fa-solid fa-wand-magic-sparkles' },
  { titulo: 'Página', rota: '/pagina', icone: 'fa-solid fa-globe' },
  { titulo: 'Números', rota: '/numeros', icone: 'fa-solid fa-chart-line' },
  { titulo: 'Ajustes', rota: '/ajustes', icone: 'fa-solid fa-sliders' },
];
