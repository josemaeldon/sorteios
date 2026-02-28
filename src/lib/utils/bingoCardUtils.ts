import jsPDF from 'jspdf';

export const BINGO_COLS = ['B', 'I', 'N', 'G', 'O'] as const;
export const A4_W_MM = 210;
export const A4_H_MM = 297;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BingoCardGrid {
  cartelaNumero: number;
  /** grids[premioIndex][row][col] */
  grids: number[][][];
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
  showHeader?: boolean;       // show B I N G O header row (default false)
  showFreeText?: boolean;     // show FREE text in center cell (default false)
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
      x: 10, y: 36, width: 190, height: 248,
      fontSize: 14, color: '#111827',
      backgroundColor: 'transparent',
      borderColor: '#1e3a8a', borderWidth: 0.5,
      headerColor: '#1e3a8a', headerTextColor: '#ffffff', headerFontSize: 16,
      cellBgColor: 'transparent', freeCellColor: 'transparent',
      showHeader: false, showFreeText: false,
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
  const n = pickRandom(31, 45, 5);
  const g = pickRandom(46, 60, 5);
  const o = pickRandom(61, 75, 5);
  return Array.from({ length: 5 }, (_, row) => [b[row], iNums[row], n[row], g[row], o[row]]);
}

export function generateAllBingoCards(quantidade: number, numeroPremios: number = 1): BingoCardGrid[] {
  const premios = Math.max(1, Math.round(numeroPremios));
  const cards: BingoCardGrid[] = [];
  // Track seen grids to avoid duplicate cards
  const seenGrids = new Set<string>();
  for (let i = 1; i <= quantidade; i++) {
    // Generate ONE unique grid per card; all prizes share the same numbers
    let baseGrid: number[][] = [];
    let tries = 0;
    do {
      baseGrid = generateBingoGrid();
      tries++;
    } while (seenGrids.has(baseGrid.flat().join(',')) && tries < 500);
    seenGrids.add(baseGrid.flat().join(','));
    // Replicate the same grid for every prize (deep-copy each row so rendering
    // or game logic cannot accidentally mutate another prize's grid reference)
    const grids = Array.from({ length: premios }, () => baseGrid.map(row => [...row]));
    cards.push({ cartelaNumero: i, grids });
  }
  return cards;
}

// ─── PDF export ───────────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '#000000');
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [0, 0, 0];
}

function drawGridPdf(doc: jsPDF, el: CanvasElement, grid: number[][], offsetY: number = 0) {
  const showHeader = el.showHeader ?? false;
  const showFreeText = el.showFreeText ?? false;
  const rows = showHeader ? 6 : 5;
  const hh = showHeader ? el.height / rows : 0;
  const ch = (el.height - hh) / 5;
  const cw = el.width / 5;
  const bw = el.borderWidth ?? 0.5;
  const gridY = el.y + offsetY;

  const [bR, bG, bB] = hexToRgb(el.borderColor ?? '#1e3a8a');
  const [hR, hG, hB] = hexToRgb(el.headerColor ?? '#1e3a8a');
  const [htR, htG, htB] = hexToRgb(el.headerTextColor ?? '#ffffff');
  const [nR, nG, nB] = hexToRgb(el.color ?? '#111827');
  const cellBg = el.cellBgColor;
  const freeBg = el.freeCellColor;
  const transparent = !cellBg || cellBg === 'transparent';
  const freeTransparent = !freeBg || freeBg === 'transparent';

  // Header row (optional)
  if (showHeader) {
    for (let col = 0; col < 5; col++) {
      const cx = el.x + col * cw;
      doc.setFillColor(hR, hG, hB);
      doc.rect(cx, gridY, cw, hh, 'F');
      doc.setDrawColor(bR, bG, bB);
      doc.setLineWidth(bw);
      doc.rect(cx, gridY, cw, hh, 'S');
      doc.setTextColor(htR, htG, htB);
      doc.setFontSize(el.headerFontSize ?? 14);
      doc.setFont('helvetica', 'bold');
      doc.text(BINGO_COLS[col], cx + cw / 2, gridY + hh * 0.72, { align: 'center' });
    }
  }

  // Number cells
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      const cx = el.x + col * cw;
      const cy = gridY + hh + row * ch;
      const num = grid[row][col];
      const free = num === 0;
      if (free ? !freeTransparent : !transparent) {
        const [r, g, b] = free ? hexToRgb(freeBg!) : hexToRgb(cellBg!);
        doc.setFillColor(r, g, b);
        doc.rect(cx, cy, cw, ch, 'F');
      }
      doc.setDrawColor(bR, bG, bB);
      doc.setLineWidth(bw);
      doc.rect(cx, cy, cw, ch, 'S');
      if (!free || showFreeText) {
        doc.setTextColor(nR, nG, nB);
        doc.setFontSize(el.fontSize ?? 12);
        doc.setFont('helvetica', free ? 'bold' : 'normal');
        doc.text(free ? 'FREE' : num.toString(), cx + cw / 2, cy + ch * 0.68, { align: 'center' });
      }
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
    const numeroPremios = card.grids.length;

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
        const gridHeight = el.height / numeroPremios;
        const gridEl = { ...el, height: gridHeight };
        for (let p = 0; p < numeroPremios; p++) {
          const offsetY = p * gridHeight;
          if (numeroPremios > 1) {
            // Prize label
            doc.setTextColor(...hexToRgb(el.color ?? '#111827'));
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.text(`Prêmio ${p + 1}`, el.x, el.y + offsetY - 1);
          }
          drawGridPdf(doc, gridEl, card.grids[p], offsetY);
        }
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
