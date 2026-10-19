import { css } from 'lit';

// Visual fixo das páginas públicas (paginas-publicas.md): sem tokens de tema, porque o visitante é
// anônimo. A cor de destaque é dado da página do corretor, aplicada em `--acento`.
export const estiloPublico = css`
  :host {
    --acento: #0b5394;
    --texto: #1d2329;
    --suave: #5b6670;
    --linha: #e3e7eb;
    --fundo: #f6f7f9;
    display: block;
    min-height: 100vh;
    background: var(--fundo);
    color: var(--texto);
    font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    font-size: 16px;
    line-height: 1.5;
  }
  * { box-sizing: border-box; }
  a { color: var(--acento); }
  .conteudo { max-width: 960px; margin: 0 auto; padding: 0 16px 48px; }
  header.topo { background: var(--acento); color: #fff; padding: 32px 16px 28px; }
  header.topo .conteudo { padding-bottom: 0; }
  header.topo h1 { margin: 0 0 4px; font-size: 1.6rem; line-height: 1.2; }
  header.topo p { margin: 4px 0; opacity: 0.92; }
  header.topo a { color: #fff; }
  section { margin-top: 28px; }
  h2 { font-size: 1.25rem; margin: 0 0 12px; }
  .grade { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px; }
  .cartao { background: #fff; border: 1px solid var(--linha); border-radius: 12px; overflow: hidden; text-decoration: none; color: inherit; display: block; }
  .cartao img, .cartao .sem-foto { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; display: block; background: #dde3e8; }
  .cartao .corpo { padding: 12px 14px 14px; }
  .preco { font-weight: 700; font-size: 1.15rem; }
  .suave { color: var(--suave); font-size: 0.92rem; }
  .icones { display: flex; flex-wrap: wrap; gap: 4px 14px; color: var(--suave); font-size: 0.92rem; margin-top: 6px; }
  .botao { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 44px; padding: 10px 18px; border-radius: 10px;
    border: 0; background: var(--acento); color: #fff; font: inherit; font-weight: 600; text-decoration: none; cursor: pointer; }
  .botao.claro { background: #fff; color: var(--acento); }
  .botao.verde { background: #18733f; }
  .botao[disabled] { opacity: 0.6; cursor: default; }
  .acoes { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px; }
  .caixa { background: #fff; border: 1px solid var(--linha); border-radius: 12px; padding: 16px; }
  .texto { white-space: pre-line; }
  .etiquetas { display: flex; flex-wrap: wrap; gap: 8px; padding: 0; margin: 0; list-style: none; }
  .etiquetas li { background: #fff; border: 1px solid var(--linha); border-radius: 999px; padding: 4px 12px; font-size: 0.92rem; }
  form { display: grid; gap: 12px; }
  label { display: grid; gap: 4px; font-size: 0.92rem; font-weight: 600; }
  input, textarea { font: inherit; padding: 10px 12px; border: 1px solid #c4ccd3; border-radius: 8px; width: 100%; background: #fff; color: var(--texto); }
  textarea { min-height: 96px; resize: vertical; }
  label.marcar { display: flex; gap: 10px; align-items: flex-start; font-weight: 400; }
  label.marcar input { width: auto; margin-top: 4px; }
  .escondido { position: absolute; left: -10000px; width: 1px; height: 1px; overflow: hidden; }
  .aviso { padding: 12px 14px; border-radius: 10px; background: #eef6f0; color: #1d5c34; }
  .aviso.erro { background: #fbeeee; color: #8a1f1f; }
  .galeria { display: flex; gap: 8px; overflow-x: auto; scroll-snap-type: x mandatory; border-radius: 12px; }
  .galeria img { flex: 0 0 100%; max-width: 100%; aspect-ratio: 4 / 3; object-fit: cover; scroll-snap-align: start; border-radius: 12px; cursor: zoom-in; }
  .tela-cheia { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.92); display: flex; align-items: center; justify-content: center; z-index: 10; }
  .tela-cheia img { max-width: 100%; max-height: 100%; object-fit: contain; }
  .tela-cheia button { position: absolute; top: 12px; right: 12px; }
  .centro { text-align: center; padding: 64px 16px; }
  @media (min-width: 720px) {
    header.topo h1 { font-size: 2rem; }
    .galeria img { flex-basis: 70%; }
  }
`;
