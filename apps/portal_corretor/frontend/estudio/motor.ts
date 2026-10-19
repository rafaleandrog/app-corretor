// Gerador de artes do app (motor interno, D-35/D-74): monta a peça num canvas fora da tela, no
// navegador do corretor, a partir das fotos públicas do imóvel, dos textos aprovados e da marca.
// Não é IA: é modelo fixo por formato (a plataforma não gera imagem, spec 10.6). As cores aqui são
// dado da marca do corretor, desenhadas na imagem — não são cor de tela.
import { MAX_SLIDES, reaisCurto, SELO, TAMANHO, type Formato, type ImovelArte, type Objetivo } from '../../comum/estudio';

export interface PecaArte {
  formato: Formato;
  objetivo: Objetivo;
  titulo: string;
  chamada: string | null;
  destaques: string[];
}
export interface MarcaArte {
  nome: string;
  creci: string | null;
  cor_primaria: string;
  cor_secundaria: string;
  estilo: string;
  assinatura: string | null;
  logo_url: string | null;
}

const BRANCO = '#ffffff';
const ESCURO = 'rgba(12, 16, 20, 0.78)';

function carregar(url: string | null): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null);
  return new Promise((ok) => {
    const img = new Image();
    // Fotos e logo vêm de URL assinada da própria instância (mesma origem): o canvas não fica "sujo".
    img.crossOrigin = 'anonymous';
    img.onload = () => ok(img);
    img.onerror = () => ok(null);
    img.src = url;
  });
}

/** Desenha a imagem cobrindo a área (corta o excesso, sem distorcer). */
function cobrir(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const escala = Math.max(w / img.width, h / img.height);
  const sw = w / escala;
  const sh = h / escala;
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
}

function fonte(estilo: string, peso: number, tamanho: number) {
  const familia = estilo === 'classico' ? 'Georgia, "Times New Roman", serif' : 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  return `${estilo === 'minimalista' ? Math.min(peso, 600) : peso} ${tamanho}px ${familia}`;
}

/** Quebra o texto em linhas que cabem na largura; corta com reticências depois de `maxLinhas`. */
function linhas(ctx: CanvasRenderingContext2D, texto: string, largura: number, maxLinhas: number): string[] {
  const palavras = texto.split(/\s+/).filter(Boolean);
  const saida: string[] = [];
  let atual = '';
  for (const p of palavras) {
    const teste = atual ? `${atual} ${p}` : p;
    if (ctx.measureText(teste).width <= largura) atual = teste;
    else {
      if (atual) saida.push(atual);
      atual = p;
    }
  }
  if (atual) saida.push(atual);
  if (saida.length > maxLinhas) {
    const cortadas = saida.slice(0, maxLinhas);
    cortadas[maxLinhas - 1] = `${cortadas[maxLinhas - 1].replace(/\s+\S*$/, '')}…`;
    return cortadas;
  }
  return saida;
}

function escrever(ctx: CanvasRenderingContext2D, texto: string, x: number, y: number, largura: number, alturaLinha: number, maxLinhas: number): number {
  const ls = linhas(ctx, texto, largura, maxLinhas);
  ls.forEach((l, i) => ctx.fillText(l, x, y + i * alturaLinha));
  return y + ls.length * alturaLinha;
}

/** Retângulo de cantos arredondados; `roundRect` não existe em navegadores mais antigos. */
function retangulo(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function selo(ctx: CanvasRenderingContext2D, objetivo: Objetivo, marca: MarcaArte, x: number, y: number) {
  const texto = SELO[objetivo];
  if (!texto) return;
  ctx.font = fonte(marca.estilo, 800, 34);
  const w = ctx.measureText(texto).width + 48;
  ctx.fillStyle = marca.cor_secundaria;
  retangulo(ctx, x, y, w, 64, 32);
  ctx.fill();
  ctx.fillStyle = contraste(marca.cor_secundaria);
  ctx.textBaseline = 'middle';
  ctx.fillText(texto, x + 24, y + 33);
  ctx.textBaseline = 'alphabetic';
}

/** Branco ou quase preto, o que tiver mais contraste com a cor de fundo. */
function contraste(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 160 ? '#14181c' : BRANCO;
}

function rodape(ctx: CanvasRenderingContext2D, marca: MarcaArte, logo: HTMLImageElement | null, w: number, h: number, faixa: number) {
  ctx.fillStyle = marca.cor_primaria;
  ctx.fillRect(0, h - faixa, w, faixa);
  const cor = contraste(marca.cor_primaria);
  ctx.fillStyle = cor;
  let x = 56;
  if (logo) {
    const lh = faixa - 40;
    const lw = Math.min((logo.width / logo.height) * lh, 220);
    ctx.drawImage(logo, x, h - faixa + 20, lw, lh);
    x += lw + 28;
  }
  ctx.font = fonte(marca.estilo, 700, 36);
  ctx.fillText(marca.nome, x, h - faixa / 2 - 4);
  ctx.font = fonte(marca.estilo, 500, 26);
  ctx.fillText([marca.creci ? `CRECI ${marca.creci}` : null, marca.assinatura].filter(Boolean).join(' · '), x, h - faixa / 2 + 32);
}

function detalhes(im: ImovelArte | null, peca: PecaArte): string[] {
  if (peca.destaques.length) return peca.destaques.slice(0, 4);
  if (!im) return [];
  return [im.area_m2 ? `${im.area_m2} m²` : null, im.quartos ? `${im.quartos} quartos` : null, im.vagas ? `${im.vagas} vagas` : null].filter((x): x is string => !!x);
}

/** Chips dos destaques; com `desenhar` falso só mede (para o layout calcular a altura antes). */
function chips(ctx: CanvasRenderingContext2D, itens: string[], marca: MarcaArte, x: number, y: number, largura: number, desenhar = true) {
  if (!itens.length) return y;
  ctx.font = fonte(marca.estilo, 600, 30);
  let cx = x;
  let cy = y;
  for (const t of itens) {
    const w = ctx.measureText(t).width + 40;
    if (cx + w > x + largura) {
      cx = x;
      cy += 64;
    }
    if (desenhar) {
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      retangulo(ctx, cx, cy, w, 52, 26);
      ctx.fill();
      ctx.fillStyle = BRANCO;
      ctx.textBaseline = 'middle';
      ctx.fillText(t, cx + 20, cy + 27);
      ctx.textBaseline = 'alphabetic';
    }
    cx += w + 14;
  }
  return cy + 52;
}

/** Capa: foto inteira, faixa escura com título, preço e destaques, selo e rodapé com a marca. */
function capa(ctx: CanvasRenderingContext2D, w: number, h: number, foto: HTMLImageElement | null, logo: HTMLImageElement | null, peca: PecaArte, im: ImovelArte | null, marca: MarcaArte) {
  const faixa = 150;
  if (foto) cobrir(ctx, foto, 0, 0, w, h - faixa);
  else {
    ctx.fillStyle = marca.cor_primaria;
    ctx.fillRect(0, 0, w, h - faixa);
  }
  const story = peca.formato === 'story';
  // Layout de baixo para cima: mede o bloco de texto e o encaixa acima do rodapé (nada fica coberto).
  const tamTitulo = story ? 78 : 62;
  const lhTitulo = story ? 88 : 70;
  ctx.font = fonte(marca.estilo, 800, tamTitulo);
  const linhasTitulo = linhas(ctx, peca.titulo, w - 112, story ? 3 : 2);
  const preco = im && peca.objetivo !== 'vendido' ? reaisCurto(im.preco_c) : null;
  const local = im ? [im.bairro, im.cidade].filter(Boolean).join(', ') : '';
  const itens = detalhes(im, peca);
  const altChips = chips(ctx, itens, marca, 56, 0, w - 112, false);
  ctx.font = fonte(marca.estilo, 700, 40);
  const linhasChamada = story && peca.chamada ? linhas(ctx, peca.chamada, w - 112, 2) : [];
  const bloco = linhasTitulo.length * lhTitulo + (preco ? (story ? 80 : 66) : 0) + (local ? 54 : 0) + (altChips ? altChips + 16 : 0) + (linhasChamada.length ? 20 + linhasChamada.length * 50 : 0);
  const base = h - faixa - 48;
  let y = base - bloco + lhTitulo * 0.8;
  const altura = Math.min(bloco + 220, h - faixa);
  const grad = ctx.createLinearGradient(0, h - faixa - altura, 0, h - faixa);
  grad.addColorStop(0, 'rgba(12,16,20,0)');
  grad.addColorStop(0.35, ESCURO);
  grad.addColorStop(1, 'rgba(12,16,20,0.92)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, h - faixa - altura, w, altura);
  selo(ctx, peca.objetivo, marca, 56, story ? 120 : 56);
  ctx.fillStyle = BRANCO;
  ctx.font = fonte(marca.estilo, 800, tamTitulo);
  linhasTitulo.forEach((l, i) => ctx.fillText(l, 56, y + i * lhTitulo));
  y += linhasTitulo.length * lhTitulo - lhTitulo * 0.8;
  if (preco) {
    ctx.font = fonte(marca.estilo, 800, story ? 64 : 52);
    ctx.fillStyle = marca.cor_secundaria;
    y += story ? 64 : 52;
    ctx.fillText(preco, 56, y);
    y += story ? 16 : 14;
  }
  if (local) {
    ctx.font = fonte(marca.estilo, 500, 34);
    ctx.fillStyle = BRANCO;
    y += 44;
    ctx.fillText(local, 56, y);
    y += 10;
  }
  if (altChips) y = chips(ctx, itens, marca, 56, y + 16, w - 112);
  if (linhasChamada.length) {
    ctx.font = fonte(marca.estilo, 700, 40);
    ctx.fillStyle = BRANCO;
    linhasChamada.forEach((l, i) => ctx.fillText(l, 56, y + 60 + i * 50));
  }
  rodape(ctx, marca, logo, w, h, faixa);
}

/** Slide do carrossel: foto inteira e um destaque. */
function slideFoto(ctx: CanvasRenderingContext2D, w: number, h: number, foto: HTMLImageElement, texto: string | null, marca: MarcaArte, n: number, total: number) {
  cobrir(ctx, foto, 0, 0, w, h);
  if (texto) {
    ctx.fillStyle = ESCURO;
    ctx.fillRect(0, h - 170, w, 170);
    ctx.fillStyle = BRANCO;
    ctx.font = fonte(marca.estilo, 700, 48);
    escrever(ctx, texto, 56, h - 80, w - 220, 56, 1);
  }
  ctx.font = fonte(marca.estilo, 600, 30);
  ctx.fillStyle = BRANCO;
  ctx.fillText(`${n}/${total}`, w - 120, h - 72);
}

/** Último slide: a chamada e o contato, na cor da marca. */
function slideContato(ctx: CanvasRenderingContext2D, w: number, h: number, logo: HTMLImageElement | null, peca: PecaArte, marca: MarcaArte) {
  ctx.fillStyle = marca.cor_primaria;
  ctx.fillRect(0, 0, w, h);
  const cor = contraste(marca.cor_primaria);
  if (logo) {
    const lh = 160;
    const lw = Math.min((logo.width / logo.height) * lh, 480);
    ctx.drawImage(logo, (w - lw) / 2, 200, lw, lh);
  }
  ctx.fillStyle = cor;
  ctx.textAlign = 'center';
  ctx.font = fonte(marca.estilo, 800, 70);
  const y = escrever(ctx, peca.chamada || 'Fale comigo e agende sua visita', w / 2, h / 2 - 40, w - 160, 84, 3);
  ctx.font = fonte(marca.estilo, 700, 46);
  ctx.fillText(marca.nome, w / 2, y + 90);
  ctx.font = fonte(marca.estilo, 500, 34);
  if (marca.creci) ctx.fillText(`CRECI ${marca.creci}`, w / 2, y + 146);
  if (marca.assinatura) ctx.fillText(marca.assinatura, w / 2, y + 196);
  ctx.textAlign = 'left';
}

function paraBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((ok, falha) => canvas.toBlob((b) => (b ? ok(b) : falha(new Error('Não foi possível gerar a imagem.'))), 'image/jpeg', 0.9));
}

/**
 * Gera as imagens da peça (uma; no carrossel, até 5 slides). `fotosFalharam` conta as fotos que não
 * carregaram (URL vencida, rede): a tela avisa em vez de entregar arte sem foto calada.
 */
export async function gerarArte(peca: PecaArte, im: ImovelArte | null, fotosUrl: string[], marca: MarcaArte): Promise<{ imagens: Blob[]; fotosFalharam: number }> {
  const { largura: w, altura: h } = TAMANHO[peca.formato];
  const pedidas = fotosUrl.slice(0, MAX_SLIDES);
  const [logo, ...fotos] = await Promise.all([carregar(marca.logo_url), ...pedidas.map(carregar)]);
  const validas = fotos.filter((f): f is HTMLImageElement => !!f);
  const fotosFalharam = pedidas.length - validas.length;
  const novo = () => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  };
  if (peca.formato !== 'carrossel') {
    const c = novo();
    capa(c.getContext('2d')!, w, h, validas[0] ?? null, logo, peca, im, marca);
    return { imagens: [await paraBlob(c)], fotosFalharam };
  }
  // Carrossel: capa, até 3 fotos com destaque e o slide de contato (no máximo 5).
  const c0 = novo();
  capa(c0.getContext('2d')!, w, h, validas[0] ?? null, logo, peca, im, marca);
  const slides = [c0];
  const meio = validas.slice(1, MAX_SLIDES - 1);
  const textos = detalhes(im, peca);
  meio.forEach((foto, i) => {
    const c = novo();
    slideFoto(c.getContext('2d')!, w, h, foto, textos[i] ?? null, marca, i + 2, meio.length + 2);
    slides.push(c);
  });
  const fim = novo();
  slideContato(fim.getContext('2d')!, w, h, logo, peca, marca);
  slides.push(fim);
  return { imagens: await Promise.all(slides.map(paraBlob)), fotosFalharam };
}
