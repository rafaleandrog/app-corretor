import { html, nothing, svg, type SVGTemplateResult, type TemplateResult } from 'lit';

// Ícones das páginas públicas (bloco 9): SVG em linha, porque o visitante anônimo não tem a fonte
// de ícones do shell. Traço na cor do texto (`currentColor`).

type Linha = Record<string, any>;

const desenho = (corpo: SVGTemplateResult) =>
  html`<svg class="icone" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${corpo}</svg>`;

const CAMA = svg`<path d="M3 18v-7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v7M3 14h18M3 18v2M21 18v2M7 9V6h4v3"/>`;
const AREA = svg`<path d="M4 4h16v16H4zM4 9h5M15 20v-5M9 4v3M20 15h-3"/>`;
const CARRO = svg`<path d="M5 16l1.5-5a2 2 0 0 1 1.9-1.4h7.2a2 2 0 0 1 1.9 1.4L19 16M4 16h16v3H4zM7 19v1M17 19v1"/>`;

const plural = (n: number, um: string, varios: string) => `${n} ${n > 1 ? varios : um}`;

/** Quartos, área e vagas com ícone; o que o imóvel não tem não aparece. */
export function iconesImovel(i: Linha): TemplateResult | typeof nothing {
  const area = i.area_util_m2 ?? i.area_total_m2;
  const itens = [
    i.quartos ? { icone: CAMA, texto: plural(i.quartos, 'quarto', 'quartos') } : null,
    area ? { icone: AREA, texto: `${area} m²` } : null,
    i.vagas ? { icone: CARRO, texto: plural(i.vagas, 'vaga', 'vagas') } : null,
  ].filter((x): x is { icone: SVGTemplateResult; texto: string } => !!x);
  return itens.length ? html`<div class="icones">${itens.map((x) => html`<span>${desenho(x.icone)}${x.texto}</span>`)}</div>` : nothing;
}
