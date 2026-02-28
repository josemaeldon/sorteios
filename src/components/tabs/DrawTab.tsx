import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useBingo } from '@/contexts/BingoContext';
import { RodadaSorteio, CartelaValidada } from '@/types/bingo';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Shuffle, 
  RotateCcw, 
  Play, 
  Maximize, 
  Minimize, 
  ZoomIn, 
  ZoomOut, 
  Plus, 
  Edit, 
  Trash2, 
  CheckCircle, 
  XCircle, 
  ArrowLeft,
  Loader2,
  Trophy,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { callApi } from '@/lib/apiClient';
import { useToast } from '@/hooks/use-toast';
import { formatarData } from '@/lib/utils/formatters';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Animation constants
const ANIMATION_CYCLES = 20;
const ANIMATION_INTERVAL_MS = 100;
const FULLSCREEN_FONT_SIZE_DEFAULT = 300;
const WINNING_SCORE = 25;
const Z_INDEX_WINNER_POPUP = 9999;
const LOTE_SIZE = 50;

const DrawTab: React.FC = () => {
  const { sorteioAtivo, cartelas, cartelasValidadas, loadCartelasValidadas } = useBingo();
  const { toast } = useToast();
  
  // Rodadas state
  const [rodadas, setRodadas] = useState<RodadaSorteio[]>([]);
  const [isLoadingRodadas, setIsLoadingRodadas] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRodada, setEditingRodada] = useState<RodadaSorteio | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingRodadaId, setDeletingRodadaId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    nome: '',
    range_start: '1',
    range_end: '75',
    status: 'ativo' as 'ativo' | 'concluido' | 'cancelado'
  });
  
  // Drawing state
  const [currentNumber, setCurrentNumber] = useState<number | null>(null);
  const [drawnNumbers, setDrawnNumbers] = useState<number[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [availableNumbers, setAvailableNumbers] = useState<number[]>([]);
  const [fontSize, setFontSize] = useState<number>(300);
  const [fullscreenFontSize, setFullscreenFontSize] = useState<number>(FULLSCREEN_FONT_SIZE_DEFAULT);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedRodada, setSelectedRodada] = useState<RodadaSorteio | null>(null);
  const [showDrawing, setShowDrawing] = useState(false);
  const [justDrawn, setJustDrawn] = useState(false);
  const [vencedoras, setVencedoras] = useState<number[]>([]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [selectedCartelaModal, setSelectedCartelaModal] = useState<{ numero: number; nome?: string; grade: number[] } | null>(null);
  const [ganhadoresPop, setGanhadoresPop] = useState<{ numero: number; nome?: string; lote?: number }[]>([]);
  
  const animationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fullscreenRef = useRef<HTMLDivElement>(null);
  const ganhadoresPopShownRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (sorteioAtivo) {
      loadRodadas();
      loadCartelasValidadas();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sorteioAtivo?.id]);

  const loadRodadas = async () => {
    if (!sorteioAtivo) return;
    
    try {
      setIsLoadingRodadas(true);
      const result = await callApi('getRodadas', { sorteio_id: sorteioAtivo.id });
      
      const rodadasWithCount = await Promise.all(
        (result.data || []).map(async (rodada: RodadaSorteio) => {
          try {
            const historyResult = await callApi('getRodadaHistorico', { rodada_id: rodada.id });
            return {
              ...rodada,
              numeros_sorteados: historyResult.data?.length || 0
            };
          } catch (error) {
            return {
              ...rodada,
              numeros_sorteados: 0
            };
          }
        })
      );
      
      setRodadas(rodadasWithCount);
    } catch (error: any) {
      console.error('Error loading rodadas:', error);
      toast({
        title: "Erro ao carregar rodadas",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoadingRodadas(false);
    }
  };

  const handleNewRodada = () => {
    setEditingRodada(null);
    setFormData({
      nome: '',
      range_start: '1',
      range_end: '75',
      status: 'ativo'
    });
    setIsModalOpen(true);
  };

  const handleEditRodada = (rodada: RodadaSorteio) => {
    setEditingRodada(rodada);
    setFormData({
      nome: rodada.nome,
      range_start: rodada.range_start.toString(),
      range_end: rodada.range_end.toString(),
      status: rodada.status
    });
    setIsModalOpen(true);
  };

  const handleDeleteRodada = (id: string) => {
    setDeletingRodadaId(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deletingRodadaId) return;
    
    try {
      await callApi('deleteRodada', { id: deletingRodadaId });
      toast({
        title: "Rodada excluída",
        description: "A rodada foi excluída com sucesso."
      });
      await loadRodadas();
      
      // If the deleted rodada was selected, go back to list
      if (selectedRodada?.id === deletingRodadaId) {
        setShowDrawing(false);
        setSelectedRodada(null);
      }
    } catch (error: any) {
      toast({
        title: "Erro ao excluir rodada",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setDeleteDialogOpen(false);
      setDeletingRodadaId(null);
    }
  };

  const handleSubmitRodada = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!sorteioAtivo) return;
    
    const range_start = parseInt(formData.range_start);
    const range_end = parseInt(formData.range_end);
    
    if (isNaN(range_start) || isNaN(range_end) || range_start < 1 || range_start >= range_end) {
      toast({
        title: "Erro",
        description: "A faixa de números é inválida. O número inicial deve ser positivo e menor que o número final.",
        variant: "destructive"
      });
      return;
    }
    
    try {
      if (editingRodada) {
        await callApi('updateRodada', {
          id: editingRodada.id,
          nome: formData.nome,
          range_start,
          range_end,
          status: formData.status
        });
        toast({
          title: "Rodada atualizada",
          description: "A rodada foi atualizada com sucesso."
        });
      } else {
        await callApi('createRodada', {
          sorteio_id: sorteioAtivo.id,
          nome: formData.nome,
          range_start,
          range_end,
          status: formData.status
        });
        toast({
          title: "Rodada criada",
          description: "A rodada foi criada com sucesso."
        });
      }
      
      setIsModalOpen(false);
      await loadRodadas();
    } catch (error: any) {
      toast({
        title: "Erro ao salvar rodada",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleStartDrawing = async (rodada: RodadaSorteio) => {
    try {
      setSelectedRodada(rodada);
      setShowDrawing(true);

      // Fetch fresh validated cartelas and use them to build the number pool
      let freshValidadas: CartelaValidada[] = cartelasValidadas;
      try {
        const validadasResult = await callApi('getCartelasValidadas', { sorteio_id: sorteioAtivo!.id });
        freshValidadas = validadasResult.data || [];
      } catch (err) {
        console.error('Error fetching validated cartelas, using cached data:', err);
      }

      // Build available numbers from validated cartelas' grids only
      const validadosNums = freshValidadas.map((cv: CartelaValidada) => cv.numero);
      const validatedWithGrade = cartelas.filter(
        c => validadosNums.includes(c.numero) && c.numeros_grade && c.numeros_grade.length > 0
      );
      let poolNumbers: number[];
      if (validatedWithGrade.length > 0) {
        const allNums = new Set<number>(
          validatedWithGrade.flatMap(c => c.numeros_grade!.flatMap(grid => grid.filter(n => n !== 0)))
        );
        poolNumbers = Array.from(allNums).filter(n => n >= rodada.range_start && n <= rodada.range_end).sort((a, b) => a - b);
      } else {
        // Fallback to full range if no validated cartelas with grids found
        poolNumbers = [];
        for (let i = rodada.range_start; i <= rodada.range_end; i++) {
          poolNumbers.push(i);
        }
      }
      setAvailableNumbers(poolNumbers);
      
      // Load history for this rodada
      const historyResult = await callApi('getRodadaHistorico', { rodada_id: rodada.id });
      
      if (historyResult.data && historyResult.data.length > 0) {
        const sortedHistory = historyResult.data.sort((a: any, b: any) => a.ordem - b.ordem);
        const numbers = sortedHistory.map((item: any) => item.numero_sorteado);
        setDrawnNumbers(numbers);
        
        if (numbers.length > 0) {
          setCurrentNumber(numbers[numbers.length - 1]);
        }
      } else {
        setDrawnNumbers([]);
        setCurrentNumber(null);
      }
    } catch (error: any) {
      console.error('Error loading rodada:', error);
      toast({
        title: "Erro ao carregar rodada",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const saveDrawnNumber = async (numero: number, ordem: number) => {
    if (!selectedRodada) return;
    
    try {
      await callApi('saveRodadaNumero', {
        rodada_id: selectedRodada.id,
        numero_sorteado: numero,
        ordem: ordem
      });
    } catch (error: any) {
      console.error('Error saving drawn number:', error);
      toast({
        title: "Erro ao salvar número",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const clearDrawHistory = async () => {
    if (!selectedRodada) return;
    
    try {
      await callApi('clearRodadaHistorico', { rodada_id: selectedRodada.id });
    } catch (error: any) {
      console.error('Error clearing draw history:', error);
      toast({
        title: "Erro ao limpar histórico",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    return () => {
      if (animationIntervalRef.current) {
        clearInterval(animationIntervalRef.current);
      }
    };
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await fullscreenRef.current?.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.error('Fullscreen toggle error:', error);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const increaseFontSize = () => {
    if (isFullscreen) {
      setFullscreenFontSize(prev => Math.min(prev + 20, 600));
    } else {
      setFontSize(prev => Math.min(prev + 20, 500));
    }
  };

  const decreaseFontSize = () => {
    if (isFullscreen) {
      setFullscreenFontSize(prev => Math.max(prev - 20, 100));
    } else {
      setFontSize(prev => Math.max(prev - 20, 100));
    }
  };

  const drawNumber = () => {
    if (availableNumbers.length === 0) return;

    const remainingNumbers = availableNumbers.filter(n => !drawnNumbers.includes(n));
    
    if (remainingNumbers.length === 0) return;

    // Clear current number immediately when starting a new draw
    setCurrentNumber(null);
    setIsDrawing(true);
    setJustDrawn(false);

    let counter = 0;
    const interval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * remainingNumbers.length);
      setCurrentNumber(remainingNumbers[randomIndex]);
      counter++;

      if (counter > ANIMATION_CYCLES) {
        clearInterval(interval);
        animationIntervalRef.current = null;
        const finalIndex = Math.floor(Math.random() * remainingNumbers.length);
        const finalNumber = remainingNumbers[finalIndex];
        setCurrentNumber(finalNumber);
        
        const newDrawnNumbers = [...drawnNumbers, finalNumber];
        setDrawnNumbers(newDrawnNumbers);
        setIsDrawing(false);
        setJustDrawn(true);
        
        // Reset justDrawn after animation completes
        setTimeout(() => setJustDrawn(false), 1000);
        
        saveDrawnNumber(finalNumber, newDrawnNumbers.length);
      }
    }, ANIMATION_INTERVAL_MS);
    
    animationIntervalRef.current = interval;
  };

  const resetDraw = async () => {
    await clearDrawHistory();
    
    setCurrentNumber(null);
    setDrawnNumbers([]);
    setIsDrawing(false);
    setJustDrawn(false);
    setVencedoras([]);
    setGanhadoresPop([]);
    ganhadoresPopShownRef.current.clear();
  };

  const handleVerificarVencedor = async () => {
    if (!sorteioAtivo || drawnNumbers.length === 0) return;
    setIsVerifying(true);
    try {
      const result = await callApi('verificarVencedor', {
        sorteio_id: sorteioAtivo.id,
        numeros_sorteados: drawnNumbers,
      });
      const winners: number[] = result.data || [];
      setVencedoras(winners);
      if (winners.length === 0) {
        toast({ title: 'Nenhuma cartela completa ainda.' });
      }
    } catch (error: any) {
      toast({ title: 'Erro ao verificar vencedor', description: error.message, variant: 'destructive' });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleCartelaClick = (numero: number, nome?: string) => {
    const cartela = cartelas.find(c => c.numero === numero);
    if (!cartela || !cartela.numeros_grade || cartela.numeros_grade.length === 0) return;
    setSelectedCartelaModal({ numero, nome, grade: cartela.numeros_grade[0] });
  };

  const goBackToList = () => {
    setShowDrawing(false);
    setSelectedRodada(null);
    setCurrentNumber(null);
    setDrawnNumbers([]);
    setAvailableNumbers([]);
    setJustDrawn(false);
    setVencedoras([]);
    setGanhadoresPop([]);
    ganhadoresPopShownRef.current.clear();
    loadRodadas();
  };

  // Compute top-10 scoring cartelas: validated cartelas sorted by how many drawn numbers they contain
  const topScoringCartelas = useMemo(() => {
    if (drawnNumbers.length === 0) return [];
    const drawnSet = new Set(drawnNumbers);
    const validadosNums = new Set(cartelasValidadas.map(cv => cv.numero));
    const validatedWithGrade = cartelas.filter(
      c => validadosNums.has(c.numero) && c.numeros_grade && c.numeros_grade.length > 0
    );
    if (validatedWithGrade.length === 0) return [];

    const nomeByNumero = new Map(cartelasValidadas.map(cv => [cv.numero, cv.comprador_nome]));

    const scored = validatedWithGrade.map(c => {
      const allNums = c.numeros_grade!.flatMap(g => g.filter(n => n !== 0));
      const score = allNums.filter(n => drawnSet.has(n)).length;
      return { numero: c.numero, score, nome: nomeByNumero.get(c.numero) };
    });

    // Sort descending by score
    scored.sort((a, b) => b.score - a.score);

    // Find top-20 distinct score levels, grouping ties
    const result: { score: number; cartelas: { numero: number; nome?: string }[] }[] = [];
    for (const { numero, score, nome } of scored) {
      if (score === 0) continue;
      const existing = result.find(r => r.score === score);
      if (existing) {
        existing.cartelas.push({ numero, nome });
      } else {
        if (result.length < 20) {
          result.push({ score, cartelas: [{ numero, nome }] });
        }
      }
    }
    return result;
  }, [drawnNumbers, cartelas, cartelasValidadas]);

  useEffect(() => {
    const winnerEntry = topScoringCartelas.find(entry => entry.score >= WINNING_SCORE);
    if (winnerEntry) {
      const newWinners = winnerEntry.cartelas.filter(c => !ganhadoresPopShownRef.current.has(c.numero));
      if (newWinners.length > 0) {
        newWinners.forEach(c => ganhadoresPopShownRef.current.add(c.numero));
        setGanhadoresPop(winnerEntry.cartelas.map(c => {
          const idx = cartelasValidadas.findIndex(cv => cv.numero === c.numero);
          return { ...c, lote: idx !== -1 ? Math.floor(idx / LOTE_SIZE) + 1 : undefined };
        }));
      }
    }
  }, [topScoringCartelas]);

  if (!sorteioAtivo) {
    return (
      <div className="text-center py-12">
        <Shuffle className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold text-foreground mb-2">Sortear</h2>
        <p className="text-muted-foreground">Selecione um sorteio para iniciar</p>
      </div>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ativo':
        return <Play className="w-4 h-4" />;
      case 'concluido':
        return <CheckCircle className="w-4 h-4" />;
      case 'cancelado':
        return <XCircle className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ativo':
        return 'bg-blue-500/10 text-blue-500';
      case 'concluido':
        return 'bg-success/10 text-success';
      case 'cancelado':
        return 'bg-destructive/10 text-destructive';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  // Show drawing interface
  if (showDrawing && selectedRodada) {
    const remainingNumbers = availableNumbers.filter(n => !drawnNumbers.includes(n));

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Button
                onClick={goBackToList}
                variant="ghost"
                size="sm"
                className="gap-1"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar
              </Button>
            </div>
            <h2 className="text-3xl font-bold text-foreground">{selectedRodada.nome}</h2>
            <p className="text-muted-foreground mt-1">
              Faixa: {selectedRodada.range_start} a {selectedRodada.range_end} | Cartelas validadas: {cartelasValidadas.length} | Sorteados: {drawnNumbers.length} | Restantes: {remainingNumbers.length}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={drawNumber}
              disabled={isDrawing || remainingNumbers.length === 0}
              size="lg"
              className="gap-2"
            >
              <Shuffle className="w-5 h-5" />
              Sortear
            </Button>
            <Button
              onClick={handleVerificarVencedor}
              disabled={isDrawing || drawnNumbers.length === 0 || isVerifying}
              size="lg"
              variant="outline"
              className="gap-2"
            >
              {isVerifying ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
              Verificar Vencedor
            </Button>
            <Button
              onClick={resetDraw}
              disabled={isDrawing || drawnNumbers.length === 0}
              variant="outline"
              size="lg"
              className="gap-2"
            >
              <RotateCcw className="w-5 h-5" />
              Reiniciar
            </Button>
          </div>
        </div>

        <div className="flex gap-6 items-start">
          <div className="flex-1 min-w-0 space-y-6">
            <div className="grid grid-cols-1 gap-6">
          <div ref={fullscreenRef} className={cn(isFullscreen && "bg-background p-8 min-h-screen flex flex-col")}>
            <Card className="border-2 flex-1 flex flex-col relative z-0">
              <CardHeader className="flex flex-row items-center justify-between flex-shrink-0">
                <CardTitle>Número Sorteado</CardTitle>
                <div className="flex gap-2">
                  {isFullscreen && (
                    <>
                      <Button onClick={decreaseFontSize} variant="outline" size="icon" title="Diminuir tamanho">
                        <ZoomOut className="w-4 h-4" />
                      </Button>
                      <Button onClick={increaseFontSize} variant="outline" size="icon" title="Aumentar tamanho">
                        <ZoomIn className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                  {!isFullscreen && (
                    <>
                      <Button onClick={decreaseFontSize} variant="outline" size="icon" title="Diminuir tamanho">
                        <ZoomOut className="w-4 h-4" />
                      </Button>
                      <Button onClick={increaseFontSize} variant="outline" size="icon" title="Aumentar tamanho">
                        <ZoomIn className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                  <Button
                    onClick={toggleFullscreen}
                    variant="outline"
                    size="icon"
                    title={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
                  >
                    {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col overflow-hidden">
                <div className="flex items-center justify-center flex-1 min-h-[400px]">
                  {currentNumber !== null ? (
                    <div
                      className={cn(
                        "font-black leading-none transition-all duration-300",
                        isDrawing 
                          ? "animate-pulse text-primary" 
                          : justDrawn
                            ? "text-primary animate-bingo-globe-emerge animate-bingo-globe-shine"
                            : "text-primary"
                      )}
                      style={{ fontSize: `${isFullscreen ? fullscreenFontSize + 'px' : fontSize + 'px'}` }}
                    >
                      {currentNumber}
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground">
                      <Shuffle className="w-24 h-24 mx-auto mb-4 opacity-50" />
                      <p className="text-xl">Clique em "Sortear" para começar</p>
                    </div>
                  )}
                </div>
                
                {isFullscreen && (
                  <div className="mt-8 flex gap-6 flex-shrink-0 items-start">
                    <div className="flex-1 space-y-6">
                      <div className="flex justify-center gap-4">
                        <Button
                          onClick={drawNumber}
                          disabled={isDrawing || remainingNumbers.length === 0}
                          size="lg"
                          className="gap-2 text-xl px-12 py-8 h-auto"
                        >
                          <Shuffle className="w-8 h-8" />
                          Sortear Próximo
                        </Button>
                      </div>
                    
                      {drawnNumbers.length > 0 && (
                        <div className="bg-card rounded-lg p-6">
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="text-2xl font-bold">Números Sorteados</h3>
                            <span className="text-lg text-muted-foreground">
                              {drawnNumbers.length} / {availableNumbers.length}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-3 max-h-[200px] overflow-y-auto">
                            {[...drawnNumbers].sort((a, b) => a - b).map((num) => (
                              <div
                                key={num}
                                className={cn(
                                  "flex items-center justify-center w-20 h-20 rounded-lg font-bold text-2xl border-2 transition-all duration-300",
                                  num === currentNumber && !isDrawing
                                    ? "bg-primary text-primary-foreground border-primary scale-110"
                                    : "bg-muted text-foreground border-border"
                                )}
                              >
                                {num}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {topScoringCartelas.length > 0 && (
                      <div className="w-96 flex-shrink-0 bg-card rounded-lg p-6">
                        <h3 className="text-2xl font-bold flex items-center gap-2 mb-4">
                          <Trophy className="w-6 h-6 text-yellow-500" />
                          Top 20 Cartelas
                        </h3>
                        <div className="space-y-3">
                          {topScoringCartelas.map((entry, idx) => (
                            <div key={entry.score} className="flex items-center gap-3">
                              <span className="text-lg font-bold text-muted-foreground w-6">{idx + 1}º</span>
                              <span className="text-lg font-semibold text-primary w-20">{entry.score} pts</span>
                              <div className="flex flex-wrap gap-2">
                                {entry.cartelas.map(({ numero, nome }) => (
                                  <button
                                    key={numero}
                                    onClick={() => handleCartelaClick(numero, nome)}
                                    aria-label={`Ver números da cartela ${numero.toString().padStart(3, '0')}${nome ? ` - ${nome}` : ''}`}
                                    className="px-3 py-1 rounded bg-muted text-foreground text-sm font-mono hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer"
                                  >
                                    {numero.toString().padStart(3, '0')}{nome ? ` - ${nome}` : ''}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Winner popup overlay - visible both in fullscreen and normal mode */}
            {ganhadoresPop.length > 0 && (
              <div className="fixed inset-0 flex items-center justify-center bg-black/75" style={{ zIndex: Z_INDEX_WINNER_POPUP }}>
                <div className="bg-card rounded-2xl p-10 text-center shadow-2xl max-w-lg w-full mx-4 border-4 border-yellow-400">
                  <Trophy className="w-24 h-24 text-yellow-400 mx-auto mb-4" />
                  <h2 className="text-4xl font-black mb-2">Temos um Ganhador! 🎉</h2>
                  <p className="text-muted-foreground mb-6">Cartela(s) com todos os números sorteados</p>
                  <div className="space-y-2 mb-8">
                    {ganhadoresPop.map(({ numero, nome, lote }) => (
                      <div key={numero} className="text-2xl font-bold text-primary">
                        Cartela {numero.toString().padStart(3, '0')}{nome ? ` - ${nome}` : ''}{lote !== undefined ? ` · Lote ${lote}` : ''}
                      </div>
                    ))}
                  </div>
                  <Button onClick={() => setGanhadoresPop([])} size="lg" className="gap-2">
                    <CheckCircle className="w-5 h-5" />
                    Fechar
                  </Button>
                </div>
              </div>
            )}
          </div>

          {!isFullscreen && drawnNumbers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Números Sorteados</span>
                  <span className="text-sm font-normal text-muted-foreground">
                    {drawnNumbers.length}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {[...drawnNumbers].sort((a, b) => a - b).map((num) => (
                    <div
                      key={num}
                      className={cn(
                        "flex items-center justify-center w-16 h-16 rounded-lg font-bold text-xl border-2 transition-all duration-300",
                        num === currentNumber && !isDrawing
                          ? "bg-primary text-primary-foreground border-primary scale-110"
                          : "bg-muted text-foreground border-border"
                      )}
                    >
                      {num}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total de Números
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{availableNumbers.length}</div>
                <p className="text-xs text-muted-foreground mt-1">Números na faixa ({selectedRodada.range_start} a {selectedRodada.range_end})</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Já Sorteados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-primary">{drawnNumbers.length}</div>
                <p className="text-xs text-muted-foreground mt-1">Números já chamados</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Restantes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                  {remainingNumbers.length}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Números ainda não sorteados</p>
              </CardContent>
            </Card>
          </div>

          </div>

          {/* RIGHT SIDEBAR */}
          {(topScoringCartelas.length > 0 || vencedoras.length > 0) && (
            <div className="w-80 flex-shrink-0">
              {/* Winner results */}
              {vencedoras.length > 0 && (
                <Card className="border-2 border-success mb-4">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-success flex items-center gap-2">
                      <CheckCircle className="w-5 h-5" />
                      Cartela(s) Vencedoras
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-3">
                      {vencedoras.map((num) => (
                        <div key={num} className="px-4 py-2 rounded-lg bg-success/10 border border-success text-success font-bold text-xl">
                          Cartela {num.toString().padStart(3, '0')}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
              {topScoringCartelas.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-yellow-500" />
                    Top 20 Cartelas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {topScoringCartelas.map((entry, idx) => (
                      <div key={entry.score} className="flex items-center gap-3">
                        <span className="text-sm font-bold text-muted-foreground w-5">{idx + 1}º</span>
                        <span className="text-sm font-semibold text-primary w-16">{entry.score} pts</span>
                        <div className="flex flex-wrap gap-1">
                          {entry.cartelas.map(({ numero, nome }) => (
                            <button
                              key={numero}
                              onClick={() => handleCartelaClick(numero, nome)}
                              aria-label={`Ver números da cartela ${numero.toString().padStart(3, '0')}${nome ? ` - ${nome}` : ''}`}
                              className="px-2 py-0.5 rounded bg-muted text-foreground text-xs font-mono hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer"
                            >
                              {numero.toString().padStart(3, '0')}{nome ? ` - ${nome}` : ''}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              )}
            </div>
          )}
        </div>

      {/* Cartela numbers modal */}
      <Dialog open={selectedCartelaModal !== null} onOpenChange={() => setSelectedCartelaModal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Cartela {selectedCartelaModal?.numero.toString().padStart(3, '0')}
              {selectedCartelaModal?.nome ? ` - ${selectedCartelaModal.nome}` : ''}
            </DialogTitle>
          </DialogHeader>
          {selectedCartelaModal && (
            <div className="grid grid-cols-5 gap-2 mt-2">
              {selectedCartelaModal.grade.map((num, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex items-center justify-center w-full aspect-square rounded font-bold text-sm border-2",
                    num === 0
                      ? "bg-muted/50 text-muted-foreground border-muted"
                      : drawnNumbers.includes(num)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card text-foreground border-border"
                  )}
                >
                  {num !== 0 ? num : '★'}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
      </div>
    );
  }

  // Show rodadas list
  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex justify-between items-center">
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Shuffle className="w-6 h-6" />
          Sortear - {sorteioAtivo.nome}
        </h2>
        <Button onClick={handleNewRodada} className="gap-2">
          <Plus className="w-4 h-4" />
          Nova Rodada
        </Button>
      </div>

      {isLoadingRodadas ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Carregando rodadas...</p>
        </div>
      ) : rodadas.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-xl border border-border">
          <Shuffle className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold text-foreground mb-2">
            Nenhuma rodada encontrada
          </h3>
          <p className="text-muted-foreground mb-6">
            Crie sua primeira rodada para começar a sortear
          </p>
          <Button onClick={handleNewRodada} className="gap-2">
            <Plus className="w-4 h-4" />
            Criar Primeira Rodada
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rodadas.map((rodada) => (
            <div
              key={rodada.id}
              className="bg-card rounded-xl border border-border p-6 hover:shadow-lg transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-foreground mb-1">
                    {rodada.nome}
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className={cn('px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1', getStatusColor(rodada.status))}>
                      {getStatusIcon(rodada.status)}
                      {rodada.status === 'ativo' ? 'Ativo' : rodada.status === 'concluido' ? 'Concluído' : 'Cancelado'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Faixa:</span>
                  <span className="font-semibold text-foreground">{rodada.range_start} - {rodada.range_end}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total de números:</span>
                  <span className="font-semibold text-foreground">{rodada.range_end - rodada.range_start + 1}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Sorteados:</span>
                  <span className="font-semibold text-primary">{rodada.numeros_sorteados || 0}</span>
                </div>
                {rodada.created_at && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Criado em:</span>
                    <span className="text-foreground">{formatarData(rodada.created_at)}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => handleStartDrawing(rodada)}
                  className="flex-1 gap-2"
                  size="sm"
                >
                  <Play className="w-4 h-4" />
                  Sortear
                </Button>
                <Button
                  onClick={() => handleEditRodada(rodada)}
                  variant="outline"
                  size="sm"
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  onClick={() => handleDeleteRodada(rodada.id)}
                  variant="destructive"
                  size="sm"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shuffle className="w-5 h-5" />
              {editingRodada ? 'Editar Rodada' : 'Nova Rodada'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmitRodada} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome da Rodada *</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Ex: Rodada 1, Rodada da Noite, etc."
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="range_start">Número Inicial *</Label>
                <Input
                  id="range_start"
                  type="number"
                  value={formData.range_start}
                  onChange={(e) => setFormData({ ...formData, range_start: e.target.value })}
                  min="1"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="range_end">Número Final *</Label>
                <Input
                  id="range_end"
                  type="number"
                  value={formData.range_end}
                  onChange={(e) => setFormData({ ...formData, range_end: e.target.value })}
                  min="2"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status *</Label>
              <Select 
                value={formData.status} 
                onValueChange={(value: 'ativo' | 'concluido' | 'cancelado') => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="concluido">Concluído</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm text-muted-foreground">
                Total de números: <span className="font-bold text-foreground">
                  {(() => {
                    const start = parseInt(formData.range_start || '0');
                    const end = parseInt(formData.range_end || '0');
                    const total = end - start + 1;
                    return total > 0 ? total : 0;
                  })()}
                </span>
              </p>
            </div>

            <div className="flex gap-4 pt-4">
              <Button type="submit" className="flex-1">
                {editingRodada ? 'Salvar' : 'Criar'}
              </Button>
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="flex-1">
                Cancelar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Rodada</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta rodada? Esta ação não pode ser desfeita.
              Todo o histórico de números sorteados desta rodada será perdido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DrawTab;
