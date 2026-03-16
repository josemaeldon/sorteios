import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Expand, Minimize, RotateCcw, Shuffle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const PublicDraw: React.FC = () => {
  const { toast } = useToast();
  const drawAreaRef = useRef<HTMLDivElement>(null);

  const [rangeStart, setRangeStart] = useState('1');
  const [rangeEnd, setRangeEnd] = useState('100');
  const [quantity, setQuantity] = useState('1');
  const [drawnNumbers, setDrawnNumbers] = useState<number[]>([]);
  const [currentNumber, setCurrentNumber] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const availableNumbers = useMemo(() => {
    const start = Number.parseInt(rangeStart, 10);
    const end = Number.parseInt(rangeEnd, 10);

    if (Number.isNaN(start) || Number.isNaN(end) || start > end) {
      return [];
    }

    const fullRange = Array.from({ length: end - start + 1 }, (_, index) => start + index);
    const used = new Set(drawnNumbers);
    return fullRange.filter((num) => !used.has(num));
  }, [rangeStart, rangeEnd, drawnNumbers]);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === drawAreaRef.current);
    };

    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
    };
  }, []);

  const validate = () => {
    const start = Number.parseInt(rangeStart, 10);
    const end = Number.parseInt(rangeEnd, 10);
    const totalToDraw = Number.parseInt(quantity, 10);

    if ([start, end, totalToDraw].some(Number.isNaN)) {
      toast({ title: 'Valores inválidos', description: 'Preencha apenas números inteiros.', variant: 'destructive' });
      return null;
    }

    if (start > end) {
      toast({ title: 'Faixa inválida', description: 'O início da faixa deve ser menor ou igual ao final.', variant: 'destructive' });
      return null;
    }

    if (totalToDraw < 1) {
      toast({ title: 'Quantidade inválida', description: 'Informe ao menos 1 número para sortear.', variant: 'destructive' });
      return null;
    }

    if (totalToDraw > availableNumbers.length) {
      toast({
        title: 'Sem números suficientes',
        description: `Restam apenas ${availableNumbers.length} números disponíveis nessa faixa.`,
        variant: 'destructive',
      });
      return null;
    }

    return { totalToDraw };
  };

  const handleDraw = () => {
    const data = validate();
    if (!data) return;

    const pool = [...availableNumbers];
    const selected: number[] = [];

    for (let i = 0; i < data.totalToDraw; i += 1) {
      const randomIndex = Math.floor(Math.random() * pool.length);
      const [picked] = pool.splice(randomIndex, 1);
      selected.push(picked);
    }

    setCurrentNumber(selected[selected.length - 1]);
    setDrawnNumbers((previous) => [...previous, ...selected]);
  };

  const handleReset = () => {
    setCurrentNumber(null);
    setDrawnNumbers([]);
  };

  const toggleFullscreen = async () => {
    if (!drawAreaRef.current) return;

    if (document.fullscreenElement === drawAreaRef.current) {
      await document.exitFullscreen();
      return;
    }

    await drawAreaRef.current.requestFullscreen();
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Sorteador público</h1>
            <p className="text-muted-foreground">Ferramenta independente para qualquer usuário realizar sorteios rápidos.</p>
          </div>
          <Button asChild variant="outline">
            <Link to="/auth">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar para login
            </Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Configuração do sorteio</CardTitle>
            <CardDescription>Defina faixa e quantidade de números antes de sortear.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="range-start">Faixa inicial</Label>
                <Input id="range-start" type="number" min={1} value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="range-end">Faixa final</Label>
                <Input id="range-end" type="number" min={1} value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantidade a sortear</Label>
                <Input id="quantity" type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        <div
          ref={drawAreaRef}
          className="relative rounded-xl border bg-card p-4 md:p-8"
        >
          <div className="sticky top-0 z-20 mb-6 flex flex-wrap gap-2 bg-card/95 pb-3 backdrop-blur supports-[backdrop-filter]:bg-card/75">
            <Button onClick={handleDraw} size="lg" className="min-w-32">
              <Shuffle className="mr-2 h-4 w-4" />
              Sortear
            </Button>
            <Button onClick={toggleFullscreen} variant="secondary" size="lg" className="min-w-44">
              {isFullscreen ? (
                <>
                  <Minimize className="mr-2 h-4 w-4" />
                  Sair da tela cheia
                </>
              ) : (
                <>
                  <Expand className="mr-2 h-4 w-4" />
                  Entrar em tela cheia
                </>
              )}
            </Button>
            <Button onClick={handleReset} variant="outline" size="lg">
              <RotateCcw className="mr-2 h-4 w-4" />
              Reiniciar
            </Button>
          </div>

          <div className="flex min-h-[50vh] flex-col items-center justify-center gap-6 rounded-xl border border-dashed p-4 text-center">
            <p className="text-muted-foreground">Último número sorteado</p>
            <div className="text-7xl font-extrabold leading-none md:text-9xl">{currentNumber ?? '-'}</div>
            <p className="text-sm text-muted-foreground">Números restantes: {availableNumbers.length}</p>
          </div>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Histórico</CardTitle>
              <CardDescription>Ordem dos números já sorteados nesta sessão.</CardDescription>
            </CardHeader>
            <CardContent>
              {drawnNumbers.length === 0 ? (
                <p className="text-muted-foreground">Nenhum número sorteado ainda.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {drawnNumbers.map((number, index) => (
                    <span
                      key={`${number}-${index}`}
                      className="rounded-md border bg-muted px-3 py-1 text-sm font-semibold"
                    >
                      {number}
                    </span>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PublicDraw;
