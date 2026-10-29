import { html, type TemplateResult } from 'lit';
import type { UrbiVersoAPI } from '@urbiverso/sdk';
import { chamarApi, formularioEnviar, juntarDataHora } from './apoio.js';
import { alternarAssistente, assistenteAberto, contatoEmFoco } from './telas/assistente.js';

declare const urbiVerso: UrbiVersoAPI;

// Menu Criar (spec 11.0.1 e 11.7): Novo cliente · Novo imóvel · Novo post · Nova visita · Nova
// proposta, no cabeçalho de toda tela do corretor. Cada opção abre a criação que já existe na tela
// dela, pedida por `?criar=<tipo>` (a tela consome o parâmetro: `pedidoDeCriar`), ou, na visita, um
// formulário próprio com o cliente em foco já escolhido. "Nova proposta" abre o registro de proposta
// em Clientes › Negociações (item D3), com o cliente em foco já escolhido.

export type OpcaoCriar = 'cliente' | 'imovel' | 'post' | 'visita' | 'proposta';

export const OPCOES_CRIAR: { id: OpcaoCriar; rotulo: string; icone: string }[] = [
  { id: 'cliente', rotulo: 'Novo cliente', icone: 'fa-solid fa-user-plus' },
  { id: 'imovel', rotulo: 'Novo imóvel', icone: 'fa-solid fa-house-chimney' },
  { id: 'post', rotulo: 'Novo post', icone: 'fa-solid fa-wand-magic-sparkles' },
  { id: 'visita', rotulo: 'Nova visita', icone: 'fa-solid fa-calendar-plus' },
  { id: 'proposta', rotulo: 'Nova proposta', icone: 'fa-solid fa-file-signature' },
];

/** Para onde cada opção leva (`null`: abre o formulário aqui mesmo). */
export function destinoDeCriar(opcao: OpcaoCriar, _sub = '', _busca = ''): string | null {
  switch (opcao) {
    case 'cliente':
      return '/clientes?criar=cliente';
    case 'imovel':
      return '/imoveis?criar=imovel';
    case 'post':
      return '/estudio?criar=post';
    case 'proposta':
      // Clientes › Negociações abre o registro (cliente e imóvel); o cliente em foco já vem escolhido.
      return '/clientes?visao=negociacoes&criar=proposta';
    case 'visita':
      return null;
  }
}

/** Busca do formulário: a primeira página da lista, com o termo digitado. */
const buscar = (rota: string, rotulo: (l: Record<string, any>) => string) => async (termo: string, signal: AbortSignal) => {
  const r = await chamarApi(`${rota}?busca=${encodeURIComponent(termo)}`, { signal });
  return (r?.dados ?? []).map((l: Record<string, any>) => ({ valor: Number(l.id), rotulo: rotulo(l) }));
};

/** Nova visita (11.7): cliente, imóvel e horário, com o cliente da ficha aberta já escolhido. */
export async function novaVisita() {
  const foco = contatoEmFoco();
  const r = await formularioEnviar(
    'Nova visita',
    [
      { nome: 'contato_id', tipo: 'busca', rotulo: 'Cliente', obrigatorio: true, valor: foco?.id ?? null, rotuloValor: foco?.nome, placeholder: 'Nome ou telefone', buscar: buscar('/contatos', (c) => c.nome) },
      { nome: 'imovel_id', tipo: 'busca', rotulo: 'Imóvel (opcional)', placeholder: 'Código, bairro ou título', buscar: buscar('/imoveis', (i) => `${i.codigo} · ${i.titulo ?? i.bairro ?? ''}`) },
      { nome: 'dia', tipo: 'data', rotulo: 'Dia', obrigatorio: true },
      { nome: 'hora', tipo: 'texto', rotulo: 'Hora', valor: '10:00' },
      { nome: 'local', tipo: 'texto', rotulo: 'Local (opcional)' },
    ],
    'POST',
    '/atividades',
    (v) => ({ tipo: 'visita', titulo: 'Visita', quando: juntarDataHora(v.dia, v.hora), local: v.local, contato_id: v.contato_id, imovel_id: v.imovel_id ?? undefined }),
  );
  if (r?.id && r.contato_id) urbiVerso.navegarSub(`/clientes/${r.contato_id}`);
}

/**
 * Vai para a sub-rota levando a query. `navegarSub` não promete preservá-la; o overview.md diz que `subRota()` deriva a
 * sub-rota do path, sem a query. Com query, monta-se a URL por `urbiVerso.href(sub)` e empilha-se com `pushState`
 * + `PopStateEvent('popstate')`: o doc diz que é isso que `navegarSub` faz e o que acorda o `escutarRota`.
 * Mesmo com o destino igual à tela atual, quem recria a tela é o `index.ts` (`visita++` no `escutarRota`), não o doc.
 */
export function irParaComQuery(destino: string) {
  const i = destino.indexOf('?');
  if (i < 0) return urbiVerso.navegarSub(destino);
  history.pushState(history.state, '', `${urbiVerso.href(destino.slice(0, i))}${destino.slice(i)}`);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function criar(opcao: OpcaoCriar) {
  const destino = destinoDeCriar(opcao, urbiVerso.subRota(), window.location.search);
  if (destino) irParaComQuery(destino);
  else void novaVisita();
}

/** O botão Criar com o menu, para o slot `actions` do `urbi-shell-page`. */
export function menuCriar(): TemplateResult {
  return html`<urbi-dropdown slot="actions" flutuante>
    <urbi-botao slot="trigger" pequeno icone="fa-solid fa-plus">Criar</urbi-botao>
    <div slot="menu">
      ${OPCOES_CRIAR.map(
        (o) => html`<urbi-dropdown-item icone=${o.icone} @urbi:dropdown-select=${() => criar(o.id)}>${o.rotulo}</urbi-dropdown-item>`,
      )}
    </div>
  </urbi-dropdown>`;
}

/** Assistente no cabeçalho das telas que ainda não têm o trilho da moldura. */
export function botaoAssistente(): TemplateResult {
  return html`<urbi-botao slot="actions" pequeno variante=${assistenteAberto() ? 'primario' : 'secundario'} icone="fa-solid fa-comments"
    @click=${() => alternarAssistente()}>Assistente</urbi-botao>`;
}
