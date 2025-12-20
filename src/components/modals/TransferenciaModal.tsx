import React, { useState, useEffect } from 'react';
import { useBingo } from '@/contexts/BingoContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowRightLeft, Save, AlertCircle } from 'lucide-react';
import { formatarNumeroCartela } from '@/lib/utils/formatters';
import { Atribuicao } from '@/types/bingo';

interface TransferenciaModalProps {
  isOpen: boolean;
  onClose: () => void;
  atribuicaoOrigem: Atribuicao | null;
  cartelaNumero: number | null;
}

const TransferenciaModal: React.FC<TransferenciaModalProps> = ({ 
  isOpen, 
  onClose, 
  atribuicaoOrigem, 
  cartelaNumero 
}) => {
  const { vendedores, atribuicoes, transferirCartela } = useBingo();
  const { toast } = useToast();
  
  const [vendedorDestinoId, setVendedorDestinoId] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Filter active sellers excluding the origin seller
  const vendedoresDisponiveis = vendedores.filter(v => 
    v.ativo && v.id !== atribuicaoOrigem?.vendedor_id
  );

  useEffect(() => {
    if (isOpen) {
      setVendedorDestinoId('');
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!atribuicaoOrigem || !cartelaNumero || !vendedorDestinoId) {
      toast({
        title: "Erro",
        description: "Selecione um vendedor de destino.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    try {
      await transferirCartela(
        atribuicaoOrigem.id,
        cartelaNumero,
        vendedorDestinoId
      );

      const vendedorDestino = vendedores.find(v => v.id === vendedorDestinoId);
      
      toast({
        title: "Cartela transferida",
        description: `A cartela ${formatarNumeroCartela(cartelaNumero)} foi transferida para ${vendedorDestino?.nome}.`
      });

      onClose();
    } catch (error: any) {
      toast({
        title: "Erro ao transferir",
        description: error.message || "Não foi possível transferir a cartela.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Check if destination seller already has an attribution
  const atribuicaoDestino = atribuicoes.find(a => a.vendedor_id === vendedorDestinoId);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5" />
            Transferir Cartela
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Origin info */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <p className="text-sm text-muted-foreground">Cartela a transferir:</p>
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 bg-primary text-primary-foreground rounded-full font-bold">
                {cartelaNumero ? formatarNumeroCartela(cartelaNumero) : '-'}
              </span>
              <span className="text-muted-foreground">→</span>
              <span className="text-sm">
                De: <strong>{atribuicaoOrigem?.vendedor_nome}</strong>
              </span>
            </div>
          </div>

          {/* Destination seller */}
          <div className="space-y-2">
            <Label>Transferir para *</Label>
            <Select value={vendedorDestinoId} onValueChange={setVendedorDestinoId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o vendedor de destino" />
              </SelectTrigger>
              <SelectContent>
                {vendedoresDisponiveis.map(v => {
                  const atribuicao = atribuicoes.find(a => a.vendedor_id === v.id);
                  return (
                    <SelectItem key={v.id} value={v.id}>
                      {v.nome} {atribuicao && `(${atribuicao.cartelas.length} cartelas)`}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {vendedoresDisponiveis.length === 0 && (
              <p className="text-sm text-warning">Nenhum outro vendedor ativo disponível</p>
            )}
          </div>

          {/* Info message */}
          {vendedorDestinoId && (
            <div className="bg-info/10 border border-info/30 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-info mt-0.5" />
              <div>
                <p className="text-sm text-foreground">
                  {atribuicaoDestino 
                    ? `A cartela será adicionada à atribuição existente de ${vendedores.find(v => v.id === vendedorDestinoId)?.nome}.`
                    : `Uma nova atribuição será criada para ${vendedores.find(v => v.id === vendedorDestinoId)?.nome}.`
                  }
                </p>
              </div>
            </div>
          )}

          <div className="flex gap-4 pt-4">
            <Button 
              type="submit" 
              className="flex-1 gap-2" 
              disabled={!vendedorDestinoId || isLoading}
            >
              <ArrowRightLeft className="w-4 h-4" />
              {isLoading ? 'Transferindo...' : 'Transferir Cartela'}
            </Button>
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default TransferenciaModal;
