import React, { useState, useEffect } from 'react';
import { useBingo } from '@/contexts/BingoContext';
import { Atribuicao } from '@/types/bingo';
import { gerarId, formatarNumeroCartela } from '@/lib/utils/formatters';
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
import { ListTodo, Save, Eraser } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AtribuicaoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AtribuicaoModal: React.FC<AtribuicaoModalProps> = ({ isOpen, onClose }) => {
  const { sorteioAtivo, vendedores, cartelas, addAtribuicao, atualizarStatusCartela } = useBingo();
  const { toast } = useToast();
  
  const [vendedorId, setVendedorId] = useState('');
  const [cartelasSelecionadas, setCartelasSelecionadas] = useState<number[]>([]);

  const vendedoresAtivos = vendedores.filter(v => v.ativo);
  const cartelasDisponiveis = cartelas.filter(c => c.status === 'disponivel');

  useEffect(() => {
    if (isOpen) {
      setVendedorId('');
      setCartelasSelecionadas([]);
    }
  }, [isOpen]);

  const toggleCartela = (numero: number) => {
    setCartelasSelecionadas(prev => 
      prev.includes(numero) 
        ? prev.filter(n => n !== numero)
        : [...prev, numero]
    );
  };

  const limparSelecao = () => {
    setCartelasSelecionadas([]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!vendedorId) {
      toast({
        title: "Erro",
        description: "Selecione um vendedor.",
        variant: "destructive"
      });
      return;
    }

    if (cartelasSelecionadas.length === 0) {
      toast({
        title: "Erro",
        description: "Selecione pelo menos uma cartela.",
        variant: "destructive"
      });
      return;
    }

    const vendedor = vendedores.find(v => v.id === vendedorId);

    cartelasSelecionadas.forEach(numero => {
      const atribuicao: Atribuicao = {
        id: gerarId(),
        sorteio_id: sorteioAtivo!.id,
        vendedor_id: vendedorId,
        vendedor_nome: vendedor?.nome,
        numero_cartela: numero,
        status: 'ativa',
        data_atribuicao: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      addAtribuicao(atribuicao);
      atualizarStatusCartela(numero, 'ativa', vendedorId, vendedor?.nome);
    });

    toast({
      title: "Atribuição realizada",
      description: `${cartelasSelecionadas.length} cartela(s) atribuída(s) com sucesso.`
    });

    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListTodo className="w-5 h-5" />
            Nova Atribuição
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Vendedor *</Label>
            <Select value={vendedorId} onValueChange={setVendedorId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um vendedor" />
              </SelectTrigger>
              <SelectContent>
                {vendedoresAtivos.map(v => (
                  <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {vendedoresAtivos.length === 0 && (
              <p className="text-sm text-warning">Nenhum vendedor ativo cadastrado</p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label>Cartelas Disponíveis ({cartelasDisponiveis.length})</Label>
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                onClick={limparSelecao}
                className="gap-1"
              >
                <Eraser className="w-3 h-3" />
                Limpar
              </Button>
            </div>
            <div className="border border-border rounded-lg p-4 max-h-60 overflow-y-auto">
              {cartelasDisponiveis.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  Nenhuma cartela disponível para atribuição
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {cartelasDisponiveis.map(cartela => (
                    <button
                      key={cartela.numero}
                      type="button"
                      onClick={() => toggleCartela(cartela.numero)}
                      className={cn(
                        'w-12 h-12 rounded-lg font-bold text-sm transition-all duration-200 border-2',
                        cartelasSelecionadas.includes(cartela.numero)
                          ? 'bg-primary text-primary-foreground border-primary shadow-glow'
                          : 'bg-card text-muted-foreground border-border hover:border-primary/50'
                      )}
                    >
                      {formatarNumeroCartela(cartela.numero)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Preview */}
          <div className="space-y-2">
            <Label>Preview da Atribuição</Label>
            <div className="bg-muted/50 rounded-lg p-4 min-h-20">
              {cartelasSelecionadas.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">Nenhuma cartela selecionada</p>
              ) : (
                <div>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {cartelasSelecionadas.map(num => (
                      <span key={num} className="px-3 py-1 bg-primary text-primary-foreground rounded-full font-semibold text-sm">
                        {formatarNumeroCartela(num)}
                      </span>
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground text-center mt-2">
                    {cartelasSelecionadas.length} cartela(s) selecionada(s)
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <Button type="submit" className="flex-1 gap-2" disabled={!vendedorId || cartelasSelecionadas.length === 0}>
              <Save className="w-4 h-4" />
              Atribuir Cartelas
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

export default AtribuicaoModal;
