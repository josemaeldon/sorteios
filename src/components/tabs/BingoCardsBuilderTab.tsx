import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  LayoutGrid, Plus, Trash2, Download, RefreshCw, ChevronLeft, ChevronRight,
  Image, Type, AlignLeft, AlignCenter, AlignRight, Bold, Loader2, FileText,
  Save, List, X, Edit2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { useBingo } from '@/contexts/BingoContext';
import {
  CanvasElement, CanvasLayout, BingoCardGrid,
  DEFAULT_LAYOUT, BINGO_COLS, A4_W_MM, A4_H_MM,
  generateAllBingoCards, exportBingoCardsPDF,
} from '@/lib/utils/bingoCardUtils';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CartelaLayout } from '@/types/bingo';

// ─── Canvas constants ─────────────────────────────────────────────────────────
/** px per mm — keeps A4 canvas at ~595×841 px (72 dpi equivalent) */
const SCALE = 595 / 210;
const CANVAS_W = Math.round(A4_W_MM * SCALE);
const CANVAS_H = Math.round(A4_H_MM * SCALE);

const mm = (v: number) => v * SCALE;   // mm → px
const px = (v: number) => v / SCALE;   // px → mm
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// ─── Drag / resize state ──────────────────────────────────────────────────────
interface DragState {
  id: string;
  startX: number; startY: number; // client px
  origX: number; origY: number;   // mm
}
interface ResizeState {
  id: string;
  handle: 'nw' | 'ne' | 'sw' | 'se';
  startX: number; startY: number;
  origX: number; origY: number; origW: number; origH: number;
}

// ─── Canvas element renderer ──────────────────────────────────────────────────
const BingoGridPreview: React.FC<{
  el: CanvasElement;
  card: BingoCardGrid | null;
  scale: number;
  numeroPremios: number;
}> = ({ el, card, scale, numeroPremios }) => {
  const showHeader = el.showHeader ?? false;
  const showFreeText = el.showFreeText ?? false;
  const cellFontPx = (el.fontSize ?? 12) * (scale / SCALE);
  const headerFontPx = (el.headerFontSize ?? 14) * (scale / SCALE);
  const bw = (el.borderWidth ?? 0.5) * scale;

  const renderGrid = (grid: number[][], premioIndex: number) => (
    <div
      key={premioIndex}
      style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gridTemplateRows: showHeader ? `1fr repeat(5, 1fr)` : 'repeat(5, 1fr)',
        overflow: 'hidden',
      }}
    >
      {/* Header row (optional) */}
      {showHeader && BINGO_COLS.map((col) => (
        <div
          key={col}
          style={{
            background: el.headerColor ?? '#1e3a8a',
            color: el.headerTextColor ?? '#ffffff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: headerFontPx,
            fontWeight: 'bold',
            border: `${bw}px solid ${el.borderColor ?? '#1e3a8a'}`,
            boxSizing: 'border-box',
          }}
        >
          {col}
        </div>
      ))}
      {/* Numbers */}
      {grid.flatMap((row, ri) =>
        row.map((num, ci) => {
          const free = num === 0;
          const bg = free
            ? (el.freeCellColor && el.freeCellColor !== 'transparent' ? el.freeCellColor : undefined)
            : (el.cellBgColor && el.cellBgColor !== 'transparent' ? el.cellBgColor : undefined);
          return (
            <div
              key={`${ri}-${ci}`}
              style={{
                background: bg,
                color: el.color ?? '#111827',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: cellFontPx,
                fontWeight: free ? 'bold' : 'normal',
                border: `${bw}px solid ${el.borderColor ?? '#1e3a8a'}`,
                boxSizing: 'border-box',
              }}
            >
              {free ? (showFreeText ? 'FREE' : '') : num}
            </div>
          );
        })
      )}
    </div>
  );

  const allGrids = card?.grids ?? Array.from({ length: numeroPremios }, () =>
    Array.from({ length: 5 }, () => Array(5).fill(0))
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', overflow: 'hidden' }}>
      {allGrids.map((grid, p) => renderGrid(grid, p))}
    </div>
  );
};

// ─── Resize handles ───────────────────────────────────────────────────────────
const HANDLE_POSITIONS: Record<string, React.CSSProperties> = {
  nw: { top: -5, left: -5, cursor: 'nw-resize' },
  ne: { top: -5, right: -5, cursor: 'ne-resize' },
  sw: { bottom: -5, left: -5, cursor: 'sw-resize' },
  se: { bottom: -5, right: -5, cursor: 'se-resize' },
};

const ResizeHandles: React.FC<{
  onPointerDown: (e: React.PointerEvent, h: ResizeState['handle']) => void;
}> = ({ onPointerDown }) => (
  <>
    {(Object.keys(HANDLE_POSITIONS) as ResizeState['handle'][]).map((h) => (
      <div
        key={h}
        style={{
          position: 'absolute',
          width: 10, height: 10,
          background: '#3b82f6',
          border: '2px solid white',
          borderRadius: 2,
          zIndex: 10,
          ...HANDLE_POSITIONS[h],
        }}
        onPointerDown={(e) => { e.stopPropagation(); onPointerDown(e, h); }}
      />
    ))}
  </>
);

// ─── Property panel helpers ───────────────────────────────────────────────────
const PropRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex flex-col gap-1">
    <Label className="text-xs text-muted-foreground">{label}</Label>
    {children}
  </div>
);

const ColorInput: React.FC<{
  value: string;
  onChange: (v: string) => void;
  label: string;
}> = ({ value, onChange, label }) => (
  <PropRow label={label}>
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value?.startsWith('#') ? value : '#000000'}
        onChange={(e) => onChange(e.target.value)}
        className="w-8 h-8 rounded cursor-pointer border border-border"
      />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 text-xs font-mono"
      />
    </div>
  </PropRow>
);

const NumberInput: React.FC<{
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number; max?: number; step?: number;
}> = ({ label, value, onChange, min = 0, max = 999, step = 1 }) => (
  <PropRow label={label}>
    <Input
      type="number"
      min={min} max={max} step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      className="h-7 text-xs"
    />
  </PropRow>
);

// ─── Main component ───────────────────────────────────────────────────────────
const BingoCardsBuilderTab: React.FC = () => {
  const {
    sorteioAtivo, cartelas, salvarNumerosCartelas,
    cartelaLayouts, loadCartelaLayouts, saveCartelaLayout, updateCartelaLayout, deleteCartelaLayout,
  } = useBingo();
  const { toast } = useToast();

  // Layout
  const [layout, setLayout] = useState<CanvasLayout>(() =>
    JSON.parse(JSON.stringify(DEFAULT_LAYOUT)),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Cards
  const [cards, setCards] = useState<BingoCardGrid[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const numeroPremios = Math.max(1, sorteioAtivo?.premios?.length ?? 1);

  // Named layout management
  const [activeLayoutId, setActiveLayoutId] = useState<string | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveLayoutName, setSaveLayoutName] = useState('');
  const [isSavingLayout, setIsSavingLayout] = useState(false);
  const [showLayoutsList, setShowLayoutsList] = useState(false);
  const [deletingLayoutId, setDeletingLayoutId] = useState<string | null>(null);

  // Drag / resize (use refs to avoid stale closure in global listeners)
  const draggingRef = useRef<DragState | null>(null);
  const resizingRef = useRef<ResizeState | null>(null);
  const layoutRef = useRef(layout);
  useEffect(() => { layoutRef.current = layout; }, [layout]);

  // Tracks whether the one-time DB restore has already run for the current sorteio
  const hasRestoredRef = useRef(false);

  // Background image input ref
  const bgInputRef = useRef<HTMLInputElement>(null);

  // ─── Derived ───────────────────────────────────────────────────────────────
  const selectedEl = layout.elements.find((e) => e.id === selectedId) ?? null;
  const previewCard = cards[previewIndex] ?? null;
  const totalCards = sorteioAtivo?.quantidade_cartelas ?? cartelas.length ?? 10;

  // ─── Restore saved cards from DB on mount ─────────────────────────────────
  useEffect(() => {
    if (hasRestoredRef.current) return;
    const saved = cartelas
      .filter(c => c.numeros_grade && c.numeros_grade.length > 0)
      .sort((a, b) => a.numero - b.numero);
    if (saved.length === 0) return;
    hasRestoredRef.current = true;
    setCards(
      saved.map(c => {
        // numeros_grade is number[][] - array of flat 25-number arrays per prize
        const grids = c.numeros_grade!.map(flat =>
          Array.from({ length: 5 }, (_, row) => flat.slice(row * 5, row * 5 + 5))
        );
        return { cartelaNumero: c.numero, grids };
      }),
    );
  }, [cartelas]);

  // ─── Layout helpers ────────────────────────────────────────────────────────
  const updateElement = useCallback((id: string, patch: Partial<CanvasElement>) => {
    setLayout((prev) => ({
      ...prev,
      elements: prev.elements.map((el) => el.id === id ? { ...el, ...patch } : el),
    }));
  }, []);

  const updateBackground = useCallback((patch: Partial<CanvasLayout['background']>) => {
    setLayout((prev) => ({ ...prev, background: { ...prev.background, ...patch } }));
  }, []);

  const addTextElement = () => {
    const id = `text_${Date.now()}`;
    const el: CanvasElement = {
      id, type: 'text',
      x: 20, y: 20, width: 170, height: 14,
      content: 'Texto personalizado',
      fontSize: 12, fontWeight: 'normal',
      color: '#111827', backgroundColor: 'transparent',
      textAlign: 'center',
    };
    setLayout((prev) => ({ ...prev, elements: [...prev.elements, el] }));
    setSelectedId(id);
  };

  const deleteElement = (id: string) => {
    if (id === 'card_number' || id === 'bingo_grid') return;
    setLayout((prev) => ({ ...prev, elements: prev.elements.filter((e) => e.id !== id) }));
    setSelectedId(null);
  };

  const resetLayout = () => {
    setLayout(JSON.parse(JSON.stringify(DEFAULT_LAYOUT)));
    setSelectedId(null);
  };

  // ─── Global pointer events (drag & resize) ─────────────────────────────────
  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      if (draggingRef.current) {
        const d = draggingRef.current;
        const dx = px(e.clientX - d.startX);
        const dy = px(e.clientY - d.startY);
        setLayout((prev) => {
          const el = prev.elements.find((el) => el.id === d.id);
          if (!el) return prev;
          return {
            ...prev,
            elements: prev.elements.map((el) =>
              el.id === d.id
                ? { ...el, x: clamp(d.origX + dx, 0, A4_W_MM - el.width), y: clamp(d.origY + dy, 0, A4_H_MM - el.height) }
                : el,
            ),
          };
        });
      } else if (resizingRef.current) {
        const r = resizingRef.current;
        const dx = px(e.clientX - r.startX);
        const dy = px(e.clientY - r.startY);
        let { origX: newX, origY: newY, origW: newW, origH: newH } = r;
        if (r.handle.includes('e')) newW = Math.max(20, r.origW + dx);
        if (r.handle.includes('w')) { newW = Math.max(20, r.origW - dx); newX = r.origX + (r.origW - newW); }
        if (r.handle.includes('s')) newH = Math.max(10, r.origH + dy);
        if (r.handle.includes('n')) { newH = Math.max(10, r.origH - dy); newY = r.origY + (r.origH - newH); }
        setLayout((prev) => ({
          ...prev,
          elements: prev.elements.map((el) =>
            el.id === r.id ? { ...el, x: newX, y: newY, width: newW, height: newH } : el,
          ),
        }));
      }
    };

    const handleUp = () => {
      draggingRef.current = null;
      resizingRef.current = null;
    };

    document.addEventListener('pointermove', handleMove);
    document.addEventListener('pointerup', handleUp);
    return () => {
      document.removeEventListener('pointermove', handleMove);
      document.removeEventListener('pointerup', handleUp);
    };
  }, []);

  // ─── Element pointer handlers ──────────────────────────────────────────────
  const handleElementPointerDown = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    const el = layoutRef.current.elements.find((el) => el.id === id);
    if (!el) return;
    draggingRef.current = { id, startX: e.clientX, startY: e.clientY, origX: el.x, origY: el.y };
    setSelectedId(id);
  };

  const handleResizePointerDown = (e: React.PointerEvent, id: string, handle: ResizeState['handle']) => {
    e.stopPropagation();
    e.preventDefault();
    const el = layoutRef.current.elements.find((el) => el.id === id);
    if (!el) return;
    resizingRef.current = {
      id, handle,
      startX: e.clientX, startY: e.clientY,
      origX: el.x, origY: el.y, origW: el.width, origH: el.height,
    };
  };

  // ─── Background image upload ───────────────────────────────────────────────
  const handleBgImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      updateBackground({ imageData: ev.target?.result as string });
    };
    reader.readAsDataURL(file);
  };

  // ─── Generate cards ────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    const count = totalCards;
    const generated = generateAllBingoCards(count, numeroPremios);
    setCards(generated);
    setPreviewIndex(0);
    // Save all prize grids to each cartela in the DB
    setIsSaving(true);
    try {
      await salvarNumerosCartelas(
        generated.map((c) => ({
          numero: c.cartelaNumero,
          // Each prize has its own independent grid; save all as number[][]
          numeros_grade: c.grids.map(g => g.flat()),
        }))
      );
      toast({ title: `${count} cartelas geradas e salvas com sucesso!` });
    } catch {
      toast({ title: `${count} cartelas geradas. Erro ao salvar no banco.`, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Export PDF ────────────────────────────────────────────────────────────
  const handleExportPDF = async () => {
    if (cards.length === 0) {
      toast({ title: 'Gere as cartelas primeiro', variant: 'destructive' });
      return;
    }
    setIsExporting(true);
    try {
      await exportBingoCardsPDF(cards, layout, sorteioAtivo?.nome ?? 'bingo');
      toast({ title: 'PDF exportado com sucesso!' });
    } catch {
      toast({ title: 'Erro ao exportar PDF', variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
  };

  // ─── Save layout handlers ──────────────────────────────────────────────────
  const handleOpenSaveDialog = () => {
    const active = cartelaLayouts.find(l => l.id === activeLayoutId);
    setSaveLayoutName(active?.nome ?? '');
    setShowSaveDialog(true);
  };

  const handleSaveLayout = async () => {
    if (!saveLayoutName.trim()) {
      toast({ title: 'Informe um nome para a cartela', variant: 'destructive' });
      return;
    }
    if (cards.length === 0) {
      toast({ title: 'Gere as cartelas primeiro', variant: 'destructive' });
      return;
    }
    setIsSavingLayout(true);
    try {
      const layoutJson = JSON.stringify(layout);
      const cardsJson = JSON.stringify(cards);
      if (activeLayoutId) {
        await updateCartelaLayout(activeLayoutId, saveLayoutName.trim(), layoutJson, cardsJson);
        toast({ title: 'Cartela atualizada!' });
      } else {
        const saved = await saveCartelaLayout(saveLayoutName.trim(), layoutJson, cardsJson);
        setActiveLayoutId(saved.id);
        toast({ title: 'Cartela salva!' });
      }
      setShowSaveDialog(false);
    } catch {
      toast({ title: 'Erro ao salvar cartela', variant: 'destructive' });
    } finally {
      setIsSavingLayout(false);
    }
  };

  const handleLoadLayout = (item: CartelaLayout) => {
    try {
      const parsedLayout: CanvasLayout = JSON.parse(item.layout_data);
      const parsedCards: BingoCardGrid[] = JSON.parse(item.cards_data);
      setLayout(parsedLayout);
      setCards(parsedCards);
      setPreviewIndex(0);
      setActiveLayoutId(item.id);
      setShowLayoutsList(false);
      toast({ title: `Cartela "${item.nome}" carregada!` });
    } catch {
      toast({ title: 'Erro ao carregar cartela', variant: 'destructive' });
    }
  };

  const handleNewLayout = () => {
    setLayout(JSON.parse(JSON.stringify(DEFAULT_LAYOUT)));
    setCards([]);
    setPreviewIndex(0);
    setActiveLayoutId(null);
    setShowLayoutsList(false);
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  if (!sorteioAtivo) {
    return (
      <div className="text-center py-16">
        <LayoutGrid className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold text-foreground mb-2">Construtor de Cartelas</h2>
        <p className="text-muted-foreground">Selecione um sorteio para construir as cartelas</p>
      </div>
    );
  }

  return (
    <>
    <div className="animate-fade-in flex flex-col gap-3 h-full">

      {/* ── Top bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <LayoutGrid className="w-6 h-6" />
            Construtor de Cartelas
          </h2>
          <p className="text-muted-foreground text-sm mt-0.5">
            {sorteioAtivo.nome} • {totalCards} cartelas
            {(() => {
              const activeLayout = activeLayoutId ? cartelaLayouts.find(l => l.id === activeLayoutId) : null;
              return activeLayout ? (
                <span className="ml-2 text-primary font-medium">— {activeLayout.nome}</span>
              ) : null;
            })()}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">Prêmios:</Label>
            <span className="text-xs font-semibold text-foreground">{numeroPremios}</span>
          </div>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => { loadCartelaLayouts(); setShowLayoutsList(true); }}>
            <List className="w-4 h-4" />
            Minhas Cartelas {cartelaLayouts.length > 0 && `(${cartelaLayouts.length})`}
          </Button>
          <Button onClick={handleGenerate} variant="outline" className="gap-2" disabled={isSaving}>
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Gerar
          </Button>
          <Button onClick={handleOpenSaveDialog} variant="outline" className="gap-2" disabled={cards.length === 0}>
            <Save className="w-4 h-4" />
            {activeLayoutId ? 'Atualizar' : 'Salvar Como...'}
          </Button>
          <Button onClick={handleExportPDF} disabled={isExporting || cards.length === 0} className="gap-2">
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Exportar PDF {cards.length > 0 && `(${cards.length})`}
          </Button>
        </div>
      </div>

      {cards.length === 0 && (
        <div className="flex items-center gap-3 p-4 bg-primary/5 border border-primary/20 rounded-xl text-sm">
          <FileText className="w-5 h-5 text-primary flex-shrink-0" />
          <span>Clique em <strong>Gerar</strong> para criar {totalCards} cartelas únicas com números de 1 a 75 e grades independentes por prêmio, depois <strong>Salvar Como...</strong> para nomear e salvar.</span>
        </div>
      )}

      {/* ── Main editor area ── */}
      <div className="flex gap-3 flex-1 min-h-0" style={{ height: 'calc(100vh - 220px)' }}>

        {/* ─ Left panel ─ */}
        <div className="w-56 flex flex-col gap-3 overflow-y-auto flex-shrink-0">

          {/* Elements */}
          <div className="bg-card border border-border rounded-xl p-3 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Elementos</p>
            <button
              onClick={() => setSelectedId('card_number')}
              className={`w-full text-left px-2 py-1.5 rounded text-sm flex items-center gap-2 transition-colors ${selectedId === 'card_number' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
            >
              <Type className="w-3.5 h-3.5" /> Número da Cartela
            </button>
            <button
              onClick={() => setSelectedId('bingo_grid')}
              className={`w-full text-left px-2 py-1.5 rounded text-sm flex items-center gap-2 transition-colors ${selectedId === 'bingo_grid' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Grade Bingo
            </button>
            {layout.elements
              .filter((e) => e.type === 'text')
              .map((e) => (
                <button
                  key={e.id}
                  onClick={() => setSelectedId(e.id)}
                  className={`w-full text-left px-2 py-1.5 rounded text-sm flex items-center gap-2 transition-colors ${selectedId === e.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                >
                  <Type className="w-3.5 h-3.5" />
                  <span className="truncate">{e.content ?? 'Texto'}</span>
                </button>
              ))}
            <Button size="sm" variant="outline" onClick={addTextElement} className="w-full gap-1 h-7 text-xs">
              <Plus className="w-3 h-3" /> Adicionar Texto
            </Button>
          </div>

          {/* Background */}
          <div className="bg-card border border-border rounded-xl p-3 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Plano de Fundo</p>
            <PropRow label="Cor de fundo">
              <input
                type="color"
                value={layout.background.color}
                onChange={(e) => updateBackground({ color: e.target.value })}
                className="w-full h-8 rounded cursor-pointer border border-border"
              />
            </PropRow>
            <PropRow label="Imagem de fundo">
              <Button size="sm" variant="outline" onClick={() => bgInputRef.current?.click()} className="w-full gap-1 h-7 text-xs">
                <Image className="w-3 h-3" />
                {layout.background.imageData ? 'Trocar imagem' : 'Carregar imagem'}
              </Button>
              {layout.background.imageData && (
                <Button size="sm" variant="ghost" onClick={() => updateBackground({ imageData: undefined })} className="w-full gap-1 h-7 text-xs text-destructive">
                  <Trash2 className="w-3 h-3" /> Remover imagem
                </Button>
              )}
            </PropRow>
            {layout.background.imageData && (
              <PropRow label={`Opacidade: ${Math.round((layout.background.imageOpacity ?? 1) * 100)}%`}>
                <Slider
                  min={0} max={100} step={1}
                  value={[Math.round((layout.background.imageOpacity ?? 1) * 100)]}
                  onValueChange={([v]) => updateBackground({ imageOpacity: v / 100 })}
                />
              </PropRow>
            )}
            <input ref={bgInputRef} type="file" accept="image/*" className="hidden" onChange={handleBgImageUpload} />
          </div>

          {/* Card preview navigator */}
          {cards.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Prévia</p>
              <div className="flex items-center justify-between gap-1">
                <Button size="icon" variant="ghost" className="h-7 w-7"
                  onClick={() => setPreviewIndex((i) => Math.max(0, i - 1))} disabled={previewIndex === 0}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-xs text-muted-foreground text-center">
                  {(previewIndex + 1).toString().padStart(3, '0')} / {cards.length.toString().padStart(3, '0')}
                </span>
                <Button size="icon" variant="ghost" className="h-7 w-7"
                  onClick={() => setPreviewIndex((i) => Math.min(cards.length - 1, i + 1))} disabled={previewIndex === cards.length - 1}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Reset */}
          <Button size="sm" variant="ghost" onClick={resetLayout} className="w-full gap-1 h-7 text-xs text-muted-foreground">
            <RefreshCw className="w-3 h-3" /> Restaurar layout padrão
          </Button>
        </div>

        {/* ─ Canvas ─ */}
        <div className="flex-1 bg-muted overflow-auto flex items-start justify-center p-6 min-w-0">
          <div
            style={{
              width: CANVAS_W,
              height: CANVAS_H,
              position: 'relative',
              flexShrink: 0,
              backgroundColor: layout.background.color,
              backgroundImage: layout.background.imageData
                ? `url(${layout.background.imageData})`
                : undefined,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
              userSelect: 'none',
            }}
            onClick={() => setSelectedId(null)}
          >
            {/* Background image opacity overlay */}
            {layout.background.imageData && layout.background.imageOpacity !== undefined && layout.background.imageOpacity < 1 && (
              <div
                style={{
                  position: 'absolute', inset: 0,
                  background: layout.background.color,
                  opacity: 1 - (layout.background.imageOpacity ?? 1),
                  pointerEvents: 'none',
                }}
              />
            )}

            {/* Canvas elements */}
            {layout.elements.map((el) => {
              const isSelected = selectedId === el.id;
              return (
                <div
                  key={el.id}
                  style={{
                    position: 'absolute',
                    left: mm(el.x),
                    top: mm(el.y),
                    width: mm(el.width),
                    height: mm(el.height),
                    cursor: 'move',
                    outline: isSelected ? '2px solid #3b82f6' : undefined,
                    outlineOffset: 1,
                    boxSizing: 'border-box',
                    overflow: 'hidden',
                    backgroundColor: el.backgroundColor && el.backgroundColor !== 'transparent'
                      ? el.backgroundColor : undefined,
                  }}
                  onPointerDown={(e) => handleElementPointerDown(e, el.id)}
                >
                  {/* Content */}
                  {el.type === 'card_number' && (
                    <div
                      style={{
                        width: '100%', height: '100%',
                        display: 'flex', alignItems: 'center',
                        justifyContent: el.textAlign === 'center' ? 'center'
                          : el.textAlign === 'right' ? 'flex-end' : 'flex-start',
                        fontSize: el.fontSize,
                        fontWeight: el.fontWeight === 'bold' ? 'bold' : 'normal',
                        color: el.color ?? '#1e3a8a',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                      }}
                    >
                      {el.prefix ?? 'Cartela '}
                      {previewCard
                        ? previewCard.cartelaNumero.toString().padStart(3, '0')
                        : '001'}
                    </div>
                  )}

                  {el.type === 'bingo_grid' && (
                    <BingoGridPreview el={el} card={previewCard} scale={SCALE} numeroPremios={numeroPremios} />
                  )}

                  {el.type === 'text' && (
                    <div
                      style={{
                        width: '100%', height: '100%',
                        display: 'flex', alignItems: 'center',
                        justifyContent: el.textAlign === 'center' ? 'center'
                          : el.textAlign === 'right' ? 'flex-end' : 'flex-start',
                        fontSize: el.fontSize,
                        fontWeight: el.fontWeight === 'bold' ? 'bold' : 'normal',
                        color: el.color ?? '#111827',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                      }}
                    >
                      {el.content}
                    </div>
                  )}

                  {/* Resize handles (only on selected) */}
                  {isSelected && (
                    <ResizeHandles
                      onPointerDown={(e, h) => handleResizePointerDown(e, el.id, h)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ─ Properties panel ─ */}
        <div className="w-64 flex flex-col gap-3 overflow-y-auto flex-shrink-0">
          {!selectedEl ? (
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Clique num elemento para editar
              </p>
              <p className="text-xs text-muted-foreground">
                Arraste elementos no canvas para reposicioná-los. Use as alças de canto para redimensionar.
              </p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl p-4 space-y-3">
              {/* Header */}
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {selectedEl.type === 'card_number' && 'Número da Cartela'}
                  {selectedEl.type === 'bingo_grid' && 'Grade Bingo'}
                  {selectedEl.type === 'text' && 'Texto'}
                </p>
                {selectedEl.type === 'text' && (
                  <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive"
                    onClick={() => deleteElement(selectedEl.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>

              {/* Position & size */}
              <div className="grid grid-cols-2 gap-2">
                <NumberInput label="X (mm)" value={Math.round(selectedEl.x * 10) / 10}
                  onChange={(v) => updateElement(selectedEl.id, { x: v })} min={0} max={A4_W_MM} step={0.5} />
                <NumberInput label="Y (mm)" value={Math.round(selectedEl.y * 10) / 10}
                  onChange={(v) => updateElement(selectedEl.id, { y: v })} min={0} max={A4_H_MM} step={0.5} />
                <NumberInput label="Largura (mm)" value={Math.round(selectedEl.width * 10) / 10}
                  onChange={(v) => updateElement(selectedEl.id, { width: Math.max(10, v) })} min={10} max={A4_W_MM} step={0.5} />
                <NumberInput label="Altura (mm)" value={Math.round(selectedEl.height * 10) / 10}
                  onChange={(v) => updateElement(selectedEl.id, { height: Math.max(5, v) })} min={5} max={A4_H_MM} step={0.5} />
              </div>

              {/* Text content (text element only) */}
              {selectedEl.type === 'text' && (
                <PropRow label="Conteúdo">
                  <Input
                    value={selectedEl.content ?? ''}
                    onChange={(e) => updateElement(selectedEl.id, { content: e.target.value })}
                    className="h-7 text-xs"
                  />
                </PropRow>
              )}

              {/* Prefix (card_number only) */}
              {selectedEl.type === 'card_number' && (
                <PropRow label="Prefixo">
                  <Input
                    value={selectedEl.prefix ?? 'Cartela '}
                    onChange={(e) => updateElement(selectedEl.id, { prefix: e.target.value })}
                    className="h-7 text-xs"
                    placeholder="ex: Cartela "
                  />
                </PropRow>
              )}

              {/* Font (card_number / text) */}
              {(selectedEl.type === 'card_number' || selectedEl.type === 'text') && (
                <>
                  <NumberInput label="Tamanho (pt)" value={selectedEl.fontSize ?? 14}
                    onChange={(v) => updateElement(selectedEl.id, { fontSize: v })} min={6} max={72} />
                  <PropRow label="Estilo">
                    <div className="flex gap-1">
                      <Button size="sm" variant={selectedEl.fontWeight === 'bold' ? 'default' : 'outline'}
                        className="h-7 w-8 p-0"
                        onClick={() => updateElement(selectedEl.id, { fontWeight: selectedEl.fontWeight === 'bold' ? 'normal' : 'bold' })}>
                        <Bold className="w-3.5 h-3.5" />
                      </Button>
                      {(['left', 'center', 'right'] as const).map((align) => {
                        const Icon = align === 'left' ? AlignLeft : align === 'center' ? AlignCenter : AlignRight;
                        return (
                          <Button key={align} size="sm"
                            variant={selectedEl.textAlign === align ? 'default' : 'outline'}
                            className="h-7 w-8 p-0"
                            onClick={() => updateElement(selectedEl.id, { textAlign: align })}>
                            <Icon className="w-3.5 h-3.5" />
                          </Button>
                        );
                      })}
                    </div>
                  </PropRow>
                  <ColorInput label="Cor do texto" value={selectedEl.color ?? '#000000'}
                    onChange={(v) => updateElement(selectedEl.id, { color: v })} />
                  <ColorInput label="Cor de fundo" value={selectedEl.backgroundColor ?? '#ffffff'}
                    onChange={(v) => updateElement(selectedEl.id, { backgroundColor: v })} />
                </>
              )}

              {/* Bingo grid properties */}
              {selectedEl.type === 'bingo_grid' && (
                <>
                  <div className="border-t border-border pt-2">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">Opções</p>
                    <div className="space-y-2">
                      <PropRow label="">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedEl.showHeader === true}
                            onChange={(e) => updateElement(selectedEl.id, { showHeader: e.target.checked })}
                            className="w-3.5 h-3.5"
                          />
                          <span className="text-xs">Mostrar cabeçalho (B I N G O)</span>
                        </label>
                      </PropRow>
                      <PropRow label="">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedEl.showFreeText === true}
                            onChange={(e) => updateElement(selectedEl.id, { showFreeText: e.target.checked })}
                            className="w-3.5 h-3.5"
                          />
                          <span className="text-xs">Mostrar texto FREE na célula central</span>
                        </label>
                      </PropRow>
                    </div>
                  </div>
                  <div className="border-t border-border pt-2">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">Cabeçalho (B I N G O)</p>
                    <div className="space-y-2">
                      <NumberInput label="Tamanho fonte (pt)" value={selectedEl.headerFontSize ?? 14}
                        onChange={(v) => updateElement(selectedEl.id, { headerFontSize: v })} min={6} max={48} />
                      <ColorInput label="Cor de fundo" value={selectedEl.headerColor ?? '#1e3a8a'}
                        onChange={(v) => updateElement(selectedEl.id, { headerColor: v })} />
                      <ColorInput label="Cor do texto" value={selectedEl.headerTextColor ?? '#ffffff'}
                        onChange={(v) => updateElement(selectedEl.id, { headerTextColor: v })} />
                    </div>
                  </div>
                  <div className="border-t border-border pt-2">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">Células de números</p>
                    <div className="space-y-2">
                      <NumberInput label="Tamanho fonte (pt)" value={selectedEl.fontSize ?? 12}
                        onChange={(v) => updateElement(selectedEl.id, { fontSize: v })} min={6} max={48} />
                      <ColorInput label="Cor dos números" value={selectedEl.color ?? '#111827'}
                        onChange={(v) => updateElement(selectedEl.id, { color: v })} />
                      <ColorInput label="Fundo da célula" value={selectedEl.cellBgColor ?? 'transparent'}
                        onChange={(v) => updateElement(selectedEl.id, { cellBgColor: v })} />
                      <ColorInput label="Célula central" value={selectedEl.freeCellColor ?? 'transparent'}
                        onChange={(v) => updateElement(selectedEl.id, { freeCellColor: v })} />
                    </div>
                  </div>
                  <div className="border-t border-border pt-2">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">Bordas</p>
                    <div className="space-y-2">
                      <ColorInput label="Cor da borda" value={selectedEl.borderColor ?? '#1e3a8a'}
                        onChange={(v) => updateElement(selectedEl.id, { borderColor: v })} />
                      <PropRow label={`Espessura: ${selectedEl.borderWidth ?? 0.5} mm`}>
                        <Slider
                          min={0} max={20} step={1}
                          value={[Math.round((selectedEl.borderWidth ?? 0.5) * 10)]}
                          onValueChange={([v]) => updateElement(selectedEl.id, { borderWidth: v / 10 })}
                        />
                      </PropRow>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>

      {/* ── Save Layout Dialog ── */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{activeLayoutId ? 'Atualizar Cartela' : 'Salvar Cartela Como...'}</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Label className="text-sm font-medium">Nome da Cartela</Label>
            <Input
              className="mt-1"
              placeholder="Ex: Cartela Natal 2025"
              value={saveLayoutName}
              onChange={(e) => setSaveLayoutName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveLayout()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)} disabled={isSavingLayout}>
              Cancelar
            </Button>
            <Button onClick={handleSaveLayout} disabled={isSavingLayout} className="gap-2">
              {isSavingLayout ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {activeLayoutId ? 'Atualizar' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Layouts List Dialog ── */}
      <Dialog open={showLayoutsList} onOpenChange={setShowLayoutsList}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <List className="w-5 h-5" />
              Cartelas de Bingo Salvas
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-96 overflow-y-auto py-1">
            {cartelaLayouts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhuma cartela salva ainda. Gere e salve uma cartela primeiro.
              </p>
            ) : (
              cartelaLayouts.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{item.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(item.created_at!).toLocaleDateString('pt-BR')}
                      {item.id === activeLayoutId && (
                        <span className="ml-2 text-primary font-medium">• Ativa</span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <Button
                      size="sm" variant="outline" className="gap-1 h-7 text-xs"
                      onClick={() => handleLoadLayout(item)}
                    >
                      <Edit2 className="w-3 h-3" /> Carregar
                    </Button>
                    <Button
                      size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                      onClick={() => setDeletingLayoutId(item.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
          <DialogFooter className="flex-row justify-between">
            <Button variant="outline" size="sm" className="gap-2" onClick={handleNewLayout}>
              <Plus className="w-4 h-4" /> Nova Cartela
            </Button>
            <Button variant="outline" onClick={() => setShowLayoutsList(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Layout Confirmation ── */}
      <AlertDialog open={!!deletingLayoutId} onOpenChange={(open) => { if (!open) setDeletingLayoutId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cartela?</AlertDialogTitle>
            <AlertDialogDescription>
              A cartela "{cartelaLayouts.find(l => l.id === deletingLayoutId)?.nome}" será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!deletingLayoutId) return;
                try {
                  await deleteCartelaLayout(deletingLayoutId);
                  if (activeLayoutId === deletingLayoutId) setActiveLayoutId(null);
                  toast({ title: 'Cartela excluída!' });
                } catch {
                  toast({ title: 'Erro ao excluir', variant: 'destructive' });
                } finally {
                  setDeletingLayoutId(null);
                }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default BingoCardsBuilderTab;
