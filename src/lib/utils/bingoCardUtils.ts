import jsPDF from 'jspdf';

export const BINGO_COLS = ['B', 'I', 'N', 'G', 'O'] as const;
export const A4_W_MM = 210;
export const A4_H_MM = 297;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BingoCardGrid {
  cartelaNumero: number;
  /** grid[row][col], 0 = FREE space */
  grid: number[][];
}

export interface CanvasElement {
  id: string;
  type: 'card_number' | 'bingo_grid' | 'text';
  x: number;       // mm from left
  y: number;       // mm from top
  width: number;   // mm
  height: number;  // mm
  // Common style
  fontSize?: number;          // pt
  fontWeight?: 'normal' | 'bold';
  color?: string;             // hex
  backgroundColor?: string;  // hex or 'transparent'
  borderColor?: string;
  borderWidth?: number;       // mm
  textAlign?: 'left' | 'center' | 'right';
  // card_number specific
  prefix?: string;
  // bingo_grid specific
  headerColor?: string;
  headerTextColor?: string;
  headerFontSize?: number;    // pt
  cellBgColor?: string;
  freeCellColor?: string;
  // text specific
  content?: string;
}

export interface CanvasBackground {
  color: string;
  imageData?: string;    // base64 data-URL
  imageOpacity?: number; // 0–1
}

export interface CanvasLayout {
  background: CanvasBackground;
  elements: CanvasElement[];
}

// ─── Default layout ───────────────────────────────────────────────────────────

export const DEFAULT_LAYOUT: CanvasLayout = {
  background: { color: '#ffffff', imageOpacity: 1 },
  elements: [
    {
      id: 'card_number',
      type: 'card_number',
      x: 10, y: 8, width: 190, height: 22,
      fontSize: 22, fontWeight: 'bold',
      color: '#1e3a8a', backgroundColor: 'transparent',
      textAlign: 'center', prefix: 'Cartela ',
    },
    {
      id: 'bingo_grid',
      type: 'bingo_grid',
      x: 10, y: 36, width: 190, height: 136,
      fontSize: 14, color: '#111827',
      backgroundColor: '#ffffff',
      borderColor: '#1e3a8a', borderWidth: 0.5,
      headerColor: '#1e3a8a', headerTextColor: '#ffffff', headerFontSize: 16,
      cellBgColor: '#ffffff', freeCellColor: '#fef9c3',
    },
  ],
};

// ─── Card generation ──────────────────────────────────────────────────────────

function pickRandom(min: number, max: number, count: number): number[] {
  const pool = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  const res: number[] = [];
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    res.push(pool.splice(idx, 1)[0]);
  }
  return res.sort((a, b) => a - b);
}

export function generateBingoGrid(): number[][] {
  const b = pickRandom(1, 15, 5);
  const iNums = pickRandom(16, 30, 5);
  const n4 = pickRandom(31, 45, 4);
  const g = pickRandom(46, 60, 5);
  const o = pickRandom(61, 75, 5);
  // Insert FREE (0) at centre position of N column
  const nCol = [...n4.slice(0, 2), 0, ...n4.slice(2)];
  return Array.from({ length: 5 }, (_, row) => [b[row], iNums[row], nCol[row], g[row], o[row]]);
}

export function generateAllBingoCards(quantidade: number): BingoCardGrid[] {
  const cards: BingoCardGrid[] = [];
  const seen = new Set<string>();
  for (let i = 1; i <= quantidade; i++) {
    let grid: number[][] = [];
    let key = '';
    let tries = 0;
    do {
      grid = generateBingoGrid();
      key = grid.flat().join(',');
      tries++;
    } while (seen.has(key) && tries < 500);
    seen.add(key);
    cards.push({ cartelaNumero: i, grid });
  }
  return cards;
}

// ─── PDF export ───────────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '#000000');
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [0, 0, 0];
}

function drawGridPdf(doc: jsPDF, el: CanvasElement, grid: number[][]) {
  const cw = el.width / 5;
  const hh = el.height / 6;           // header row height
  const ch = (el.height - hh) / 5;   // number cell height
  const bw = el.borderWidth ?? 0.5;

  const [bR, bG, bB] = hexToRgb(el.borderColor ?? '#1e3a8a');
  const [hR, hG, hB] = hexToRgb(el.headerColor ?? '#1e3a8a');
  const [htR, htG, htB] = hexToRgb(el.headerTextColor ?? '#ffffff');
  const [nR, nG, nB] = hexToRgb(el.color ?? '#111827');
  const [cR, cG, cB] = hexToRgb(el.cellBgColor ?? '#ffffff');
  const [fR, fG, fB] = hexToRgb(el.freeCellColor ?? '#fef9c3');

  // Header row
  for (let col = 0; col < 5; col++) {
    const cx = el.x + col * cw;
    doc.setFillColor(hR, hG, hB);
    doc.rect(cx, el.y, cw, hh, 'F');
    doc.setDrawColor(bR, bG, bB);
    doc.setLineWidth(bw);
    doc.rect(cx, el.y, cw, hh, 'S');
    doc.setTextColor(htR, htG, htB);
    doc.setFontSize(el.headerFontSize ?? 14);
    doc.setFont('helvetica', 'bold');
    doc.text(BINGO_COLS[col], cx + cw / 2, el.y + hh * 0.72, { align: 'center' });
  }

  // Number cells
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      const cx = el.x + col * cw;
      const cy = el.y + hh + row * ch;
      const num = grid[row][col];
      const free = num === 0;
      doc.setFillColor(free ? fR : cR, free ? fG : cG, free ? fB : cB);
      doc.rect(cx, cy, cw, ch, 'F');
      doc.setDrawColor(bR, bG, bB);
      doc.setLineWidth(bw);
      doc.rect(cx, cy, cw, ch, 'S');
      doc.setTextColor(nR, nG, nB);
      doc.setFontSize(el.fontSize ?? 12);
      doc.setFont('helvetica', free ? 'bold' : 'normal');
      doc.text(free ? 'FREE' : num.toString(), cx + cw / 2, cy + ch * 0.68, { align: 'center' });
    }
  }
}

export async function exportBingoCardsPDF(
  cards: BingoCardGrid[],
  layout: CanvasLayout,
  sorteioNome: string,
): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  for (let i = 0; i < cards.length; i++) {
    if (i > 0) doc.addPage();
    const card = cards[i];

    // Background colour
    doc.setFillColor(...hexToRgb(layout.background.color));
    doc.rect(0, 0, A4_W_MM, A4_H_MM, 'F');

    // Background image
    if (layout.background.imageData) {
      try {
        const fmt = layout.background.imageData.includes('image/png') ? 'PNG' : 'JPEG';
        doc.addImage(layout.background.imageData, fmt, 0, 0, A4_W_MM, A4_H_MM);
      } catch { /* ignore unsupported images */ }
    }

    // Elements
    for (const el of layout.elements) {
      if (el.type === 'card_number') {
        const num = card.cartelaNumero.toString().padStart(3, '0');
        const text = `${el.prefix ?? 'Cartela '}${num}`;
        doc.setTextColor(...hexToRgb(el.color ?? '#000000'));
        doc.setFontSize(el.fontSize ?? 18);
        doc.setFont('helvetica', el.fontWeight === 'bold' ? 'bold' : 'normal');
        const align = (el.textAlign ?? 'center') as 'left' | 'center' | 'right';
        const tx = align === 'center' ? el.x + el.width / 2
          : align === 'right' ? el.x + el.width : el.x;
        doc.text(text, tx, el.y + el.height * 0.72, { align });
      } else if (el.type === 'bingo_grid') {
        drawGridPdf(doc, el, card.grid);
      } else if (el.type === 'text') {
        doc.setTextColor(...hexToRgb(el.color ?? '#000000'));
        doc.setFontSize(el.fontSize ?? 12);
        doc.setFont('helvetica', el.fontWeight === 'bold' ? 'bold' : 'normal');
        const align = (el.textAlign ?? 'left') as 'left' | 'center' | 'right';
        const tx = align === 'center' ? el.x + el.width / 2
          : align === 'right' ? el.x + el.width : el.x;
        doc.text(el.content ?? '', tx, el.y + el.height * 0.72, { align });
      }
    }
  }

  doc.save(
    `cartelas-bingo-${sorteioNome.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`,
  );
}
