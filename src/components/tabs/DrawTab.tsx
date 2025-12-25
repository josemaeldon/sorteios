import React, { useState, useEffect, useRef } from 'react';
import { useBingo } from '@/contexts/BingoContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shuffle, RotateCcw, Play, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

// Animation constants
const ANIMATION_CYCLES = 20;
const ANIMATION_INTERVAL_MS = 100;

const DrawTab: React.FC = () => {
  const { sorteioAtivo } = useBingo();
  const [currentNumber, setCurrentNumber] = useState<number | null>(null);
  const [drawnNumbers, setDrawnNumbers] = useState<number[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [rangeStart, setRangeStart] = useState<number>(1);
  const [rangeEnd, setRangeEnd] = useState<number>(75);
  const [isConfigured, setIsConfigured] = useState(false);
  const [availableNumbers, setAvailableNumbers] = useState<number[]>([]);
  const animationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (animationIntervalRef.current) {
        clearInterval(animationIntervalRef.current);
      }
    };
  }, []);

  if (!sorteioAtivo) {
    return (
      <div className="text-center py-12">
        <Shuffle className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold text-foreground mb-2">Sorteio de Números</h2>
        <p className="text-muted-foreground">Selecione um sorteio para iniciar</p>
      </div>
    );
  }

  const startDraw = () => {
    if (rangeStart >= rangeEnd) {
      return;
    }

    // Generate number range
    const numbers: number[] = [];
    for (let i = rangeStart; i <= rangeEnd; i++) {
      numbers.push(i);
    }
    
    setAvailableNumbers(numbers);
    setIsConfigured(true);
    setDrawnNumbers([]);
    setCurrentNumber(null);
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
        setDrawnNumbers(prev => [...prev, finalNumber]);
        setIsDrawing(false);
      }
    }, ANIMATION_INTERVAL_MS);
    
    animationIntervalRef.current = interval;
  };

  const resetDraw = () => {
    setCurrentNumber(null);
    setDrawnNumbers([]);
    setIsDrawing(false);
    setIsConfigured(false);
    setAvailableNumbers([]);
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
          <h2 className="text-3xl font-bold text-foreground">Sorteio de Números: {sorteioAtivo.nome}</h2>
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rangeStart">Número Inicial</Label>
                <Input
                  id="rangeStart"
                  type="number"
                  value={rangeStart}
                  onChange={(e) => setRangeStart(parseInt(e.target.value) || 1)}
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
                  onChange={(e) => setRangeEnd(parseInt(e.target.value) || 75)}
                  min={rangeStart + 1}
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
              disabled={rangeStart >= rangeEnd}
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
        <div>
          <h2 className="text-3xl font-bold text-foreground">Sorteio: {sorteioAtivo.nome}</h2>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Current Number Display */}
        <div className="lg:col-span-2">
          <Card className="border-2">
            <CardHeader>
              <CardTitle>Número Sorteado</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center min-h-[400px]">
                {currentNumber !== null ? (
                  <div
                    className={cn(
                      "text-[200px] font-black leading-none transition-all duration-300",
                      isDrawing ? "animate-pulse text-primary" : "text-primary"
                    )}
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
            </CardContent>
          </Card>
        </div>

        {/* Drawn Numbers History */}
        <div className="lg:col-span-1">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Números Sorteados</span>
                <span className="text-sm font-normal text-muted-foreground">
                  {drawnNumbers.length}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {drawnNumbers.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Nenhum número sorteado ainda
                </p>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {drawnNumbers.map((num, index) => (
                    <div
                      key={index}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border transition-all",
                        index === drawnNumbers.length - 1
                          ? "bg-primary/10 border-primary"
                          : "bg-muted/50 border-border"
                      )}
                    >
                      <div
                        className={cn(
                          "flex items-center justify-center w-12 h-12 rounded-lg font-bold text-xl",
                          index === drawnNumbers.length - 1
                            ? "bg-primary text-primary-foreground"
                            : "bg-background text-foreground"
                        )}
                      >
                        {num}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm text-muted-foreground">
                          {index === drawnNumbers.length - 1 ? "Último sorteado" : `${index + 1}º sorteio`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
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
