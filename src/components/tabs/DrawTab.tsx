import React, { useState, useEffect, useRef } from 'react';
import { useBingo } from '@/contexts/BingoContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shuffle, RotateCcw, Play, Settings, Maximize, Minimize, ZoomIn, ZoomOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { callApi } from '@/lib/apiClient';
import { useToast } from '@/hooks/use-toast';

// Animation constants
const ANIMATION_CYCLES = 20;
const ANIMATION_INTERVAL_MS = 100;
const FULLSCREEN_FONT_SIZE_DEFAULT = 300; // Default font size in pixels for fullscreen display

const DrawTab: React.FC = () => {
  const { sorteioAtivo } = useBingo();
  const { toast } = useToast();
  const [currentNumber, setCurrentNumber] = useState<number | null>(null);
  const [drawnNumbers, setDrawnNumbers] = useState<number[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [rangeStart, setRangeStart] = useState<number>(1);
  const [rangeEnd, setRangeEnd] = useState<number>(75);
  const [isConfigured, setIsConfigured] = useState(false);
  const [availableNumbers, setAvailableNumbers] = useState<number[]>([]);
  const [fontSize, setFontSize] = useState<number>(300);
  const [fullscreenFontSize, setFullscreenFontSize] = useState<number>(FULLSCREEN_FONT_SIZE_DEFAULT);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [registro, setRegistro] = useState<string>('');
  const animationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fullscreenRef = useRef<HTMLDivElement>(null);
  const saveRegistroTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load draw history when sorteio changes
  useEffect(() => {
    if (sorteioAtivo) {
      loadDrawHistory();
    } else {
      // Reset state when no sorteio is active
      setCurrentNumber(null);
      setDrawnNumbers([]);
      setIsConfigured(false);
      setAvailableNumbers([]);
      setRegistro('');
    }
  }, [sorteioAtivo?.id]);

  const loadDrawHistory = async () => {
    if (!sorteioAtivo) return;
    
    try {
      setIsLoadingHistory(true);
      const result = await callApi('getSorteioHistorico', { sorteio_id: sorteioAtivo.id });
      
      if (result.data && result.data.length > 0) {
        // Sort by ordem to ensure correct order
        const sortedHistory = result.data.sort((a: any, b: any) => a.ordem - b.ordem);
        
        // Extract the drawn numbers
        const numbers = sortedHistory.map((item: any) => item.numero_sorteado);
        
        // Get range configuration from the first item
        const firstItem = sortedHistory[0];
        const start = firstItem.range_start;
        const end = firstItem.range_end;
        const loadedRegistro = firstItem.registro ?? '';
        
        // Generate available numbers
        const allNumbers: number[] = [];
        for (let i = start; i <= end; i++) {
          allNumbers.push(i);
        }
        
        setDrawnNumbers(numbers);
        setRangeStart(start);
        setRangeEnd(end);
        setAvailableNumbers(allNumbers);
        setIsConfigured(true);
        setRegistro(loadedRegistro);
        
        // Set current number to the last drawn number
        if (numbers.length > 0) {
          setCurrentNumber(numbers[numbers.length - 1]);
        }
      }
    } catch (error: any) {
      console.error('Error loading draw history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const saveDrawnNumber = async (numero: number, ordem: number) => {
    if (!sorteioAtivo) return;
    
    try {
      await callApi('saveSorteioNumero', {
        sorteio_id: sorteioAtivo.id,
        numero_sorteado: numero,
        range_start: rangeStart,
        range_end: rangeEnd,
        ordem: ordem,
        registro: registro
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

  const saveRegistro = async (newRegistro: string) => {
    if (!sorteioAtivo) return;
    
    try {
      await callApi('updateSorteioRegistro', {
        sorteio_id: sorteioAtivo.id,
        registro: newRegistro
      });
    } catch (error: any) {
      console.error('Error saving registro:', error);
      toast({
        title: "Erro ao salvar registro",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const clearDrawHistory = async () => {
    if (!sorteioAtivo) return;
    
    try {
      await callApi('clearSorteioHistorico', { sorteio_id: sorteioAtivo.id });
    } catch (error: any) {
      console.error('Error clearing draw history:', error);
      toast({
        title: "Erro ao limpar histórico",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (animationIntervalRef.current) {
        clearInterval(animationIntervalRef.current);
      }
      if (saveRegistroTimeoutRef.current) {
        clearTimeout(saveRegistroTimeoutRef.current);
      }
    };
  }, []);

  // Auto-save registro with debounce
  useEffect(() => {
    if (!isConfigured || !sorteioAtivo) return;
    
    // Clear existing timeout
    if (saveRegistroTimeoutRef.current) {
      clearTimeout(saveRegistroTimeoutRef.current);
    }
    
    // Only save if registro has meaningful content (not just whitespace)
    // This prevents unnecessary API calls when the field is empty or being cleared
    if (registro.trim() === '') return;
    
    // Set new timeout to save after 1 second of no typing
    saveRegistroTimeoutRef.current = setTimeout(() => {
      saveRegistro(registro);
    }, 1000);
    
    return () => {
      if (saveRegistroTimeoutRef.current) {
        clearTimeout(saveRegistroTimeoutRef.current);
      }
    };
  }, [registro, isConfigured, sorteioAtivo]);

  // Fullscreen handlers
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

  if (!sorteioAtivo) {
    return (
      <div className="text-center py-12">
        <Shuffle className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold text-foreground mb-2">Sortear</h2>
        <p className="text-muted-foreground">Selecione um sorteio para iniciar</p>
      </div>
    );
  }

  if (isLoadingHistory) {
    return (
      <div className="text-center py-12">
        <Shuffle className="w-16 h-16 mx-auto text-muted-foreground mb-4 animate-pulse" />
        <h2 className="text-2xl font-bold text-foreground mb-2">Carregando...</h2>
        <p className="text-muted-foreground">Carregando histórico do sorteio</p>
      </div>
    );
  }

  const startDraw = async () => {
    if (rangeStart >= rangeEnd || isNaN(rangeStart) || isNaN(rangeEnd)) {
      return;
    }

    // Clear previous history for this sorteio when starting a new draw session
    // This ensures a fresh start with the new configuration
    await clearDrawHistory();

    // Generate number range
    const numbers: number[] = [];
    for (let i = rangeStart; i <= rangeEnd; i++) {
      numbers.push(i);
    }
    
    setAvailableNumbers(numbers);
    setIsConfigured(true);
    setDrawnNumbers([]);
    setCurrentNumber(null);
    
    // Note: The registro will be saved to the database automatically:
    // 1. When any number is drawn (via saveDrawnNumber)
    // 2. When the user edits the field (via the auto-save effect with 1s debounce)
  };

  const drawNumber = () => {
    if (availableNumbers.length === 0) {
      return;
    }

    const remainingNumbers = availableNumbers.filter(n => !drawnNumbers.includes(n));
    
    if (remainingNumbers.length === 0) {
      return;
    }

    setIsDrawing(true);

    // Animation effect
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
        
        // Update local state
        const newDrawnNumbers = [...drawnNumbers, finalNumber];
        setDrawnNumbers(newDrawnNumbers);
        setIsDrawing(false);
        
        // Save to database
        saveDrawnNumber(finalNumber, newDrawnNumbers.length);
      }
    }, ANIMATION_INTERVAL_MS);
    
    animationIntervalRef.current = interval;
  };

  const resetDraw = async () => {
    // Clear history from database
    await clearDrawHistory();
    
    setCurrentNumber(null);
    setDrawnNumbers([]);
    setIsDrawing(false);
    setIsConfigured(false);
    setAvailableNumbers([]);
    setRegistro('');
  };

  const reconfigure = () => {
    setIsConfigured(false);
    setCurrentNumber(null);
    setDrawnNumbers([]);
    setIsDrawing(false);
  };

  const remainingNumbers = availableNumbers.filter(n => !drawnNumbers.includes(n));

  // Configuration screen
  if (!isConfigured) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Sortear: {sorteioAtivo.nome}</h2>
          <p className="text-muted-foreground mt-1">Configure a faixa de números para o sorteio</p>
        </div>

        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Configurar Faixa de Números
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="registro-config">Registro do Sorteio</Label>
              <Input
                id="registro-config"
                value={registro}
                onChange={(e) => setRegistro(e.target.value)}
                placeholder="Ex: Sorteio 001, Rodada 1, etc..."
                className="text-lg"
              />
              <p className="text-xs text-muted-foreground">
                Digite um nome para identificar este sorteio no histórico
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rangeStart">Número Inicial</Label>
                <Input
                  id="rangeStart"
                  type="number"
                  value={rangeStart}
                  onChange={(e) => {
                    const val = e.target.value === '' ? 1 : parseInt(e.target.value);
                    setRangeStart(isNaN(val) ? 1 : val);
                  }}
                  min={1}
                  className="text-lg"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rangeEnd">Número Final</Label>
                <Input
                  id="rangeEnd"
                  type="number"
                  value={rangeEnd}
                  onChange={(e) => {
                    const val = e.target.value === '' ? 75 : parseInt(e.target.value);
                    setRangeEnd(isNaN(val) ? 75 : val);
                  }}
                  min={isNaN(rangeStart) ? 2 : rangeStart + 1}
                  className="text-lg"
                />
              </div>
            </div>

            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm text-muted-foreground">
                Total de números no sorteio: <span className="font-bold text-foreground text-lg">{rangeEnd - rangeStart + 1}</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Os números serão sorteados de {rangeStart} até {rangeEnd} sem repetir
              </p>
            </div>

            <Button
              onClick={startDraw}
              disabled={rangeStart >= rangeEnd || isNaN(rangeStart) || isNaN(rangeEnd)}
              size="lg"
              className="w-full gap-2"
            >
              <Play className="w-5 h-5" />
              Iniciar Sorteio
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Drawing screen
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex-1">
          <h2 className="text-3xl font-bold text-foreground">Sortear: {sorteioAtivo.nome}</h2>
          <p className="text-muted-foreground mt-1">
            Faixa: {rangeStart} a {rangeEnd} | Sorteados: {drawnNumbers.length} | Restantes: {remainingNumbers.length}
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
            onClick={reconfigure}
            disabled={isDrawing}
            variant="outline"
            size="lg"
            className="gap-2"
          >
            <Settings className="w-5 h-5" />
            Configurar
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

      {/* Draw Registration Field */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex-1 space-y-2">
              <Label htmlFor="registro">Registro do Sorteio</Label>
              <Input
                id="registro"
                value={registro}
                onChange={(e) => setRegistro(e.target.value)}
                placeholder="Ex: Sorteio 001, Rodada 1, etc..."
                className="text-lg"
              />
              <p className="text-xs text-muted-foreground">
                {registro.trim() ? 'Alterações salvas automaticamente após 1 segundo' : 'Digite para atualizar o registro deste sorteio'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6">
        {/* Current Number Display with Fullscreen */}
        <div ref={fullscreenRef} className={cn(isFullscreen && "bg-background p-8 min-h-screen flex flex-col")}>
          <Card className="border-2 flex-1 flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between flex-shrink-0">
              <CardTitle>Número Sorteado</CardTitle>
              <div className="flex gap-2">
                {isFullscreen && (
                  <>
                    <Button
                      onClick={decreaseFontSize}
                      variant="outline"
                      size="icon"
                      title="Diminuir tamanho"
                    >
                      <ZoomOut className="w-4 h-4" />
                    </Button>
                    <Button
                      onClick={increaseFontSize}
                      variant="outline"
                      size="icon"
                      title="Aumentar tamanho"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </Button>
                  </>
                )}
                {!isFullscreen && (
                  <>
                    <Button
                      onClick={decreaseFontSize}
                      variant="outline"
                      size="icon"
                      title="Diminuir tamanho"
                    >
                      <ZoomOut className="w-4 h-4" />
                    </Button>
                    <Button
                      onClick={increaseFontSize}
                      variant="outline"
                      size="icon"
                      title="Aumentar tamanho"
                    >
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
                      isDrawing ? "animate-pulse text-primary" : "text-primary"
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
              
              {/* Fullscreen controls */}
              {isFullscreen && (
                <div className="mt-8 space-y-6 flex-shrink-0">
                  {/* Draw button in fullscreen */}
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
                  
                  {/* Drawn numbers in fullscreen */}
                  {drawnNumbers.length > 0 && (
                    <div className="bg-card rounded-lg p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-2xl font-bold">Números Sorteados</h3>
                        <span className="text-lg text-muted-foreground">
                          {drawnNumbers.length} / {availableNumbers.length}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-3 max-h-[200px] overflow-y-auto">
                        {drawnNumbers.map((num, index) => (
                          <div
                            key={index}
                            className={cn(
                              "flex items-center justify-center w-20 h-20 rounded-lg font-bold text-2xl border-2",
                              index === drawnNumbers.length - 1
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
              )}
            </CardContent>
          </Card>
        </div>

        {/* Drawn Numbers History - Compact Grid (only show when not fullscreen) */}
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
                {drawnNumbers.map((num, index) => (
                  <div
                    key={index}
                    className={cn(
                      "flex items-center justify-center w-16 h-16 rounded-lg font-bold text-xl border-2 transition-transform",
                      index === drawnNumbers.length - 1
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

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total de Números
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{availableNumbers.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Números na faixa ({rangeStart} a {rangeEnd})</p>
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
  );
};

export default DrawTab;
