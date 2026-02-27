import React, { useState } from 'react';
import { useBingo } from '@/contexts/BingoContext';
import { Grid3X3, Search, Filter, Eraser, User, Loader2, Edit2, Trash2, Printer, Plus, RefreshCw, Save, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { formatarNumeroCartela, getStatusLabel } from '@/lib/utils/formatters';
import { cn } from '@/lib/utils';
import { Cartela } from '@/types/bingo';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { generateBingoGrid, exportBingoCardsPDF, DEFAULT_LAYOUT, BINGO_COLS } from '@/lib/utils/bingoCardUtils';

// ─── BINGO column ranges (B I N G O) ─────────────────────────────────────────
const COL_RANGES = [
  { min: 1,  max: 15 },
  { min: 16, max: 30 },
  { min: 31, max: 45 },
  { min: 46, max: 60 },
  { min: 61, max: 75 },
] as const;

const generateRandomFlat = () => generateBingoGrid().flat();

const validateGrid = (flat: number[]): string | null => {
  if (flat.length !== 25) return 'A cartela deve ter 25 números.';
  for (let i = 0; i < 25; i++) {
    const col = i % 5;
    const { min, max } = COL_RANGES[col];
    if (!flat[i] || flat[i] < min || flat[i] > max)
      return `Coluna ${BINGO_COLS[col]}: número deve ser entre ${min} e ${max}.`;
  }
  if (new Set(flat).size !== 25) return 'Todos os 25 números devem ser únicos.';
  return null;
};

// ─── Shared grid editor ───────────────────────────────────────────────────────
const GridEditor: React.FC<{
  grid: number[];
  onChange: (i: number, v: number) => void;
}> = ({ grid, onChange }) => (
  <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
    {BINGO_COLS.map((col) => (
      <div key={col} className="flex items-center justify-center rounded bg-primary text-primary-foreground text-xs font-bold h-7">
        {col}
      </div>
    ))}
    {grid.map((num, i) => {
      const { min, max } = COL_RANGES[i % 5];
      const valid = num >= min && num <= max;
      return (
        <input
          key={i}
          type="number"
          min={min}
          max={max}
          value={num || ''}
          onChange={(e) => onChange(i, parseInt(e.target.value) || 0)}
          className={cn(
            'w-full text-center text-sm font-semibold rounded border h-8 bg-background focus:outline-none focus:ring-1',
            valid ? 'border-border focus:ring-primary' : 'border-destructive bg-destructive/10 focus:ring-destructive',
          )}
        />
      );
    })}
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────
const CartelasTab: React.FC = () => {
  const {
    sorteioAtivo,
    cartelas,
    vendedores,
    filtrosCartelas,
    setFiltrosCartelas,
    isLoading,
    salvarNumerosCartelas,
    deleteCartela,
    createCartela,
  } = useBingo();
  const { toast } = useToast();

  // ─── Cartela view / edit state ─────────────────────────────────────────────
  const [selectedCartela, setSelectedCartela] = useState<Cartela | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editGrid, setEditGrid] = useState<number[]>(Array(25).fill(0));
  const [isSaving, setIsSaving] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // ─── New-cartela modal state ───────────────────────────────────────────────
  const [showNewModal, setShowNewModal] = useState(false);
  const [newGrid, setNewGrid] = useState<number[]>(Array(25).fill(0));
  const [isSavingNew, setIsSavingNew] = useState(false);

  if (!sorteioAtivo) {
    return (
      <div className="text-center py-12">
        <Grid3X3 className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold text-foreground mb-2">Cartelas</h2>
        <p className="text-muted-foreground">Selecione um sorteio para visualizar as cartelas</p>
      </div>
    );
  }

  // ─── Filtering ─────────────────────────────────────────────────────────────
  const cartelasFiltradas = cartelas.filter(c => {
    if (filtrosCartelas.busca) {
      const numeroFormatado = formatarNumeroCartela(c.numero);
      if (numeroFormatado !== filtrosCartelas.busca) return false;
    }
    if (filtrosCartelas.status !== 'todos') {
      if (filtrosCartelas.status === 'disponivel') {
        if (c.status !== 'disponivel' && c.status !== 'devolvida') return false;
      } else {
        if (c.status !== filtrosCartelas.status) return false;
      }
    }
    if (filtrosCartelas.vendedor !== 'todos') {
      if (!c.vendedor_id || c.vendedor_id !== filtrosCartelas.vendedor) return false;
    }
    return true;
  });

  const contadores = {
    disponivel: cartelas.filter(c => c.status === 'disponivel').length,
    atribuida:  cartelas.filter(c => c.status === 'ativa').length,
    vendida:    cartelas.filter(c => c.status === 'vendida').length,
    devolvida:  cartelas.filter(c => c.status === 'devolvida').length,
  };

  const limparFiltros = () => setFiltrosCartelas({ busca: '', status: 'todos', vendedor: 'todos' });

  const getCartelaStatusClass = (status: string) => {
    switch (status) {
      case 'disponivel': return 'bg-card border-border text-muted-foreground';
      case 'ativa':      return 'status-atribuida';
      case 'vendida':    return 'status-vendida';
      case 'devolvida':  return 'status-devolvida';
      default:           return 'bg-card border-border';
    }
  };

  const getTooltip = (cartela: Cartela) => {
    const vendedor = cartela.vendedor_id ? vendedores.find(v => v.id === cartela.vendedor_id) : null;
    const nome = vendedor?.nome || cartela.vendedor_nome || 'N/A';
    switch (cartela.status) {
      case 'disponivel': return 'Disponível';
      case 'ativa':      return `Atribuída: ${nome}`;
      case 'vendida':    return `Vendida: ${nome}`;
      case 'devolvida':  return `Devolvida: ${nome}`;
      default:           return '';
    }
  };

  // ─── Edit handlers ─────────────────────────────────────────────────────────
  const openCartela = (cartela: Cartela) => {
    setSelectedCartela(cartela);
    setEditMode(false);
  };

  const openEditMode = () => {
    const current = selectedCartela?.numeros_grade;
    setEditGrid(current && current.length === 25 ? [...current] : generateRandomFlat());
    setEditMode(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedCartela) return;
    const error = validateGrid(editGrid);
    if (error) { toast({ title: 'Dados inválidos', description: error, variant: 'destructive' }); return; }
    setIsSaving(true);
    try {
      await salvarNumerosCartelas([{ numero: selectedCartela.numero, numeros_grade: editGrid }]);
      setSelectedCartela(prev => prev ? { ...prev, numeros_grade: editGrid } : null);
      setEditMode(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrint = async () => {
    if (!selectedCartela?.numeros_grade) return;
    setIsPrinting(true);
    try {
      const flat = selectedCartela.numeros_grade;
      const grid = Array.from({ length: 5 }, (_, row) => flat.slice(row * 5, row * 5 + 5));
      const numeroPremios = Math.max(1, sorteioAtivo?.premios?.length ?? 1);
      await exportBingoCardsPDF(
        [{ cartelaNumero: selectedCartela.numero, grids: Array.from({ length: numeroPremios }, () => grid) }],
        DEFAULT_LAYOUT,
        sorteioAtivo?.nome ?? 'bingo',
      );
    } catch {
      toast({ title: 'Erro ao exportar PDF', variant: 'destructive' });
    } finally {
      setIsPrinting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedCartela) return;
    setIsDeleting(true);
    try {
      await deleteCartela(selectedCartela.numero);
      setSelectedCartela(null);
      setShowDeleteConfirm(false);
    } finally {
      setIsDeleting(false);
    }
  };

  // ─── New cartela handlers ──────────────────────────────────────────────────
  const openNewModal = () => {
    setNewGrid(generateRandomFlat());
    setShowNewModal(true);
  };

  const handleCreateCartela = async () => {
    const error = validateGrid(newGrid);
    if (error) { toast({ title: 'Dados inválidos', description: error, variant: 'destructive' }); return; }
    setIsSavingNew(true);
    try {
      await createCartela(newGrid);
      setShowNewModal(false);
    } finally {
      setIsSavingNew(false);
    }
  };

  // ─── Permission helpers ────────────────────────────────────────────────────
  const canEdit   = selectedCartela?.status !== 'vendida';
  const canDelete = selectedCartela?.status === 'disponivel';

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Grid3X3 className="w-6 h-6" />
            Cartelas - {sorteioAtivo.nome}
          </h2>
          <p className="text-muted-foreground mt-1">
            {cartelas.length} cartelas
            {cartelas.length !== sorteioAtivo.quantidade_cartelas && (
              <span className="text-xs ml-1">({sorteioAtivo.quantidade_cartelas} configuradas)</span>
            )}
          </p>
        </div>
        <Button onClick={openNewModal} className="gap-2">
          <Plus className="w-4 h-4" />
          Nova Cartela
        </Button>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="stat-card">
          <div className="text-sm text-muted-foreground">Disponíveis</div>
          <div className="text-2xl font-bold text-foreground">
            {contadores.disponivel}
            {contadores.devolvida > 0 && (
              <span className="text-sm font-normal text-muted-foreground ml-1">
                (+{contadores.devolvida} devolvidas)
              </span>
            )}
          </div>
        </div>
        <div className="stat-card">
          <div className="text-sm text-muted-foreground">Atribuídas</div>
          <div className="text-2xl font-bold text-warning">{contadores.atribuida}</div>
        </div>
        <div className="stat-card">
          <div className="text-sm text-muted-foreground">Vendidas</div>
          <div className="text-2xl font-bold text-success">{contadores.vendida}</div>
        </div>
        <div className="stat-card">
          <div className="text-sm text-muted-foreground">Devolvidas</div>
          <div className="text-2xl font-bold text-danger">{contadores.devolvida}</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="filter-bar">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground flex items-center gap-1">
              <Search className="w-4 h-4" />
              Número da Cartela
            </label>
            <Input
              placeholder="Digite o número..."
              value={filtrosCartelas.busca}
              onChange={(e) => setFiltrosCartelas({ ...filtrosCartelas, busca: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground flex items-center gap-1">
              <Filter className="w-4 h-4" />
              Status
            </label>
            <Select
              value={filtrosCartelas.status}
              onValueChange={(value: any) => setFiltrosCartelas({ ...filtrosCartelas, status: value })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="disponivel">Disponíveis</SelectItem>
                <SelectItem value="ativa">Atribuídas</SelectItem>
                <SelectItem value="vendida">Vendidas</SelectItem>
                <SelectItem value="devolvida">Devolvidas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground flex items-center gap-1">
              <User className="w-4 h-4" />
              Vendedor
            </label>
            <Select
              value={filtrosCartelas.vendedor}
              onValueChange={(value) => setFiltrosCartelas({ ...filtrosCartelas, vendedor: value })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {vendedores.map(v => (
                  <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button variant="outline" onClick={limparFiltros} className="w-full gap-2">
              <Eraser className="w-4 h-4" />
              Limpar
            </Button>
          </div>
        </div>
      </div>

      {/* Legenda */}
      <div className="bg-card p-4 rounded-xl border border-border mb-6">
        <h3 className="font-semibold text-foreground mb-3">Legenda:</h3>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-card border-2 border-border" />
            <span className="text-sm text-muted-foreground">Disponível</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded status-atribuida" />
            <span className="text-sm text-muted-foreground">Atribuída</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded status-vendida" />
            <span className="text-sm text-muted-foreground">Vendida</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded status-devolvida" />
            <span className="text-sm text-muted-foreground">Devolvida</span>
          </div>
        </div>
      </div>

      {/* Grid de Cartelas */}
      <div className="bg-card p-6 rounded-xl border border-border">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Carregando cartelas...</span>
          </div>
        ) : (
          <div className="flex flex-wrap justify-start">
            {cartelasFiltradas.map((cartela) => (
              <div
                key={cartela.numero}
                className={cn(
                  'cartela-item cursor-pointer hover:ring-2 hover:ring-primary',
                  getCartelaStatusClass(cartela.status),
                )}
                onClick={() => openCartela(cartela)}
              >
                {formatarNumeroCartela(cartela.numero)}
                <div className="cartela-tooltip">{getTooltip(cartela)}</div>
              </div>
            ))}
            {cartelasFiltradas.length === 0 && (
              <div className="w-full text-center py-12">
                <Filter className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-lg text-muted-foreground">Nenhuma cartela encontrada</p>
                <p className="text-sm text-muted-foreground mt-2">Tente ajustar os filtros de busca</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Modal: View / Edit cartela ── */}
      <Dialog
        open={!!selectedCartela}
        onOpenChange={(open) => { if (!open) { setSelectedCartela(null); setEditMode(false); } }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Cartela {selectedCartela ? formatarNumeroCartela(selectedCartela.numero) : ''}</span>
              <span className={cn(
                'text-xs font-medium px-2 py-0.5 rounded-full border',
                selectedCartela?.status === 'disponivel' ? 'bg-muted text-muted-foreground border-border' :
                selectedCartela?.status === 'ativa'      ? 'status-atribuida' :
                selectedCartela?.status === 'vendida'    ? 'status-vendida' :
                'status-devolvida',
              )}>
                {getStatusLabel(selectedCartela?.status ?? '')}
              </span>
            </DialogTitle>
          </DialogHeader>

          {editMode ? (
            /* ── Edit mode ── */
            <div className="space-y-3">
              <GridEditor
                grid={editGrid}
                onChange={(i, v) => setEditGrid(prev => { const g = [...prev]; g[i] = v; return g; })}
              />
              <Button
                size="sm"
                variant="outline"
                className="w-full gap-2"
                onClick={() => setEditGrid(generateRandomFlat())}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Gerar Aleatório
              </Button>
            </div>
          ) : (
            /* ── View mode ── */
            selectedCartela?.numeros_grade ? (
              <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
                {BINGO_COLS.map((col) => (
                  <div key={col} className="flex items-center justify-center rounded bg-primary text-primary-foreground text-xs font-bold h-7">
                    {col}
                  </div>
                ))}
                {selectedCartela.numeros_grade.map((num, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-center rounded border border-border text-sm font-semibold aspect-square"
                  >
                    {num || '—'}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Esta cartela ainda não possui números definidos.
              </p>
            )
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
            {editMode ? (
              <>
                <Button variant="outline" size="sm" className="gap-2" onClick={() => setEditMode(false)} disabled={isSaving}>
                  <X className="w-3.5 h-3.5" /> Cancelar
                </Button>
                <Button size="sm" className="gap-2" onClick={handleSaveEdit} disabled={isSaving}>
                  {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Salvar
                </Button>
              </>
            ) : (
              <>
                {canDelete && (
                  <Button
                    variant="destructive"
                    size="sm"
                    className="gap-2 sm:mr-auto"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Excluir
                  </Button>
                )}
                {selectedCartela?.numeros_grade && (
                  <Button variant="outline" size="sm" className="gap-2" onClick={handlePrint} disabled={isPrinting}>
                    {isPrinting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
                    Imprimir
                  </Button>
                )}
                {canEdit && (
                  <Button size="sm" className="gap-2" onClick={openEditMode}>
                    <Edit2 className="w-3.5 h-3.5" /> Editar
                  </Button>
                )}
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation ── */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cartela?</AlertDialogTitle>
            <AlertDialogDescription>
              A cartela {selectedCartela ? formatarNumeroCartela(selectedCartela.numero) : ''} será removida permanentemente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Modal: Nova Cartela ── */}
      <Dialog open={showNewModal} onOpenChange={(open) => { if (!open) setShowNewModal(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Cartela</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <GridEditor
              grid={newGrid}
              onChange={(i, v) => setNewGrid(prev => { const g = [...prev]; g[i] = v; return g; })}
            />
            <Button
              size="sm"
              variant="outline"
              className="w-full gap-2"
              onClick={() => setNewGrid(generateRandomFlat())}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Gerar Aleatório
            </Button>
          </div>
          <DialogFooter className="pt-2">
            <Button variant="outline" size="sm" onClick={() => setShowNewModal(false)} disabled={isSavingNew}>
              Cancelar
            </Button>
            <Button size="sm" className="gap-2" onClick={handleCreateCartela} disabled={isSavingNew}>
              {isSavingNew ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Criar Cartela
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CartelasTab;
