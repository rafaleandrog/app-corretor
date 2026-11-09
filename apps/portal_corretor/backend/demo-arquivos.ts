import { deflateSync } from 'node:zlib';

// Arquivos de exemplo da semente de demonstração (#189): fotos e o documento da autorização de venda
// gerados em memória, sem depender de nada externo. A coluna `arquivo` de `imovel_midias` é
// obrigatória (não há mídia sem arquivo), então a demonstração sobe arquivos de verdade, pequenos:
// uma imagem PNG em degradê (a cor muda por ambiente) e um PDF de uma página com o texto do documento.

const TABELA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = TABELA_CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function bloco(tipo: string, dados: Buffer): Buffer {
  const tam = Buffer.alloc(4);
  tam.writeUInt32BE(dados.length);
  const corpo = Buffer.concat([Buffer.from(tipo, 'ascii'), dados]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(corpo));
  return Buffer.concat([tam, corpo, crc]);
}

type Rgb = [number, number, number];

/**
 * Foto de exemplo: PNG 480 × 320 com o céu em degradê de `topo` a `base`, uma faixa de chão e a
 * silhueta simples de uma casa (telhado e corpo), para a grade de fotos não parecer vazia.
 */
export function fotoDeExemplo(topo: Rgb, base: Rgb, casa: Rgb = [245, 245, 240]): Buffer {
  const L = 480;
  const A = 320;
  const linhas = Buffer.alloc((L * 3 + 1) * A);
  const chao = Math.round(A * 0.78);
  for (let y = 0; y < A; y++) {
    const off = y * (L * 3 + 1);
    linhas[off] = 0; // filtro "nenhum"
    const t = y / (A - 1);
    for (let x = 0; x < L; x++) {
      let cor: Rgb = [0, 1, 2].map((i) => Math.round(topo[i] + (base[i] - topo[i]) * t)) as Rgb;
      if (y >= chao) cor = [base[0] * 0.55, base[1] * 0.6, base[2] * 0.5].map(Math.round) as Rgb;
      // Corpo da casa (retângulo) e telhado (triângulo) no meio da imagem.
      const dentroCorpo = x >= 150 && x <= 330 && y >= 150 && y < chao;
      const meio = 240;
      const dentroTelhado = y >= 80 && y < 150 && Math.abs(x - meio) <= (y - 80) * (110 / 70);
      const porta = x >= 225 && x <= 255 && y >= 195 && y < chao;
      if (dentroTelhado) cor = [150, 70, 50];
      else if (porta) cor = [110, 80, 60];
      else if (dentroCorpo) cor = casa;
      const p = off + 1 + x * 3;
      linhas[p] = cor[0];
      linhas[p + 1] = cor[1];
      linhas[p + 2] = cor[2];
    }
  }
  const cab = Buffer.alloc(13);
  cab.writeUInt32BE(L, 0);
  cab.writeUInt32BE(A, 4);
  cab[8] = 8; // 8 bits por canal
  cab[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloco('IHDR', cab),
    bloco('IDAT', deflateSync(linhas)),
    bloco('IEND', Buffer.alloc(0)),
  ]);
}

/** Paleta por ambiente: o céu muda de cor para as fotos de um mesmo imóvel não serem iguais. */
export const CORES_AMBIENTE: [Rgb, Rgb][] = [
  [[120, 170, 220], [200, 225, 245]],
  [[240, 200, 150], [250, 235, 210]],
  [[170, 200, 170], [225, 240, 220]],
  [[200, 180, 220], [235, 225, 245]],
  [[150, 190, 200], [215, 235, 240]],
  [[230, 170, 160], [245, 220, 210]],
];

const pdfTexto = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7e]/g, '-').replace(/([\\()])/g, '\\$1');

/** Documento da autorização de venda (exemplo): PDF de uma página com as linhas dadas. */
export function documentoDeExemplo(linhas: string[]): Buffer {
  const texto = linhas.map((l, i) => `BT /F1 ${i === 0 ? 16 : 11} Tf 60 ${760 - i * 22} Td (${pdfTexto(l)}) Tj ET`).join('\n');
  const objetos = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(texto, 'latin1')} >>\nstream\n${texto}\nendstream`,
  ];
  let corpo = '%PDF-1.4\n';
  const posicoes: number[] = [];
  objetos.forEach((o, i) => {
    posicoes.push(Buffer.byteLength(corpo, 'latin1'));
    corpo += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(corpo, 'latin1');
  corpo += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n${posicoes.map((p) => `${String(p).padStart(10, '0')} 00000 n \n`).join('')}`;
  corpo += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(corpo, 'latin1');
}
