// Ajustes numa tela só (D-81, spec 11.1): as abas e o endereço de cada uma. Puro, sem DOM: o
// frontend monta a tela e os testes conferem os apelidos.

export const ABAS_AJUSTES = [
  { id: 'conta', label: 'Conta', icone: 'fa-solid fa-id-badge' },
  { id: 'marca', label: 'Marca', icone: 'fa-solid fa-palette' },
  { id: 'conexoes', label: 'Conexões', icone: 'fa-solid fa-plug' },
  { id: 'funil', label: 'Funil e abordagens', icone: 'fa-solid fa-filter' },
  { id: 'atendimento', label: 'Atendimento', icone: 'fa-solid fa-clock' },
] as const;

export type AbaAjustes = (typeof ABAS_AJUSTES)[number]['id'];

const IDS = new Set<string>(ABAS_AJUSTES.map((a) => a.id));
export const ehAbaAjustes = (id: string | null | undefined): id is AbaAjustes => !!id && IDS.has(id);

/**
 * Aba que um endereço abre. O SDK não redireciona, então os endereços antigos continuam vivos como
 * apelidos: `/conta` abre Conta, `/ajustes/<aba>` abre a aba (e `/ajustes/conexoes` segue sendo o
 * retorno do Instagram cadastrado na Meta). Em `/ajustes`, vale `?aba=`; sem ela, Conta.
 */
export function abaDoEndereco(sub: string, busca = ''): AbaAjustes | null {
  if (sub === '/conta') return 'conta';
  const m = sub.match(/^\/ajustes(?:\/([a-z_]+))?$/);
  if (!m) return null;
  if (m[1]) return ehAbaAjustes(m[1]) ? m[1] : null;
  const aba = new URLSearchParams(busca).get('aba');
  return ehAbaAjustes(aba) ? aba : 'conta';
}
