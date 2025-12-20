import React, { useState, useEffect } from 'react';
import { useBingo } from '@/contexts/BingoContext';
import { Sorteio } from '@/types/bingo';
import { gerarId } from '@/lib/utils/formatters';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Dice5, Save } from 'lucide-react';

interface SorteioModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingId: string | null;
}

const SorteioModal: React.FC<SorteioModalProps> = ({ isOpen, onClose, editingId }) => {
  const { sorteios, addSorteio, updateSorteio } = useBingo();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    nome: '',
    data_sorteio: '',
    premio: '',
    valor_cartela: '',
    quantidade_cartelas: '',
    status: 'agendado' as 'agendado' | 'em_andamento' | 'concluido'
  });

  useEffect(() => {
    if (editingId) {
      const sorteio = sorteios.find(s => s.id === editingId);
      if (sorteio) {
        setFormData({
          nome: sorteio.nome,
          data_sorteio: sorteio.data_sorteio.split('T')[0],
          premio: sorteio.premio,
          valor_cartela: sorteio.valor_cartela.toString(),
          quantidade_cartelas: sorteio.quantidade_cartelas.toString(),
          status: sorteio.status
        });
      }
    } else {
      setFormData({
        nome: '',
        data_sorteio: '',
        premio: '',
        valor_cartela: '',
        quantidade_cartelas: '',
        status: 'agendado'
      });
    }
  }, [editingId, sorteios, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nome || !formData.data_sorteio || !formData.premio || 
        !formData.valor_cartela || !formData.quantidade_cartelas) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios.",
        variant: "destructive"
      });
      return;
    }

    const sorteioData: Sorteio = {
      id: editingId || gerarId(),
      nome: formData.nome,
      data_sorteio: `${formData.data_sorteio}T20:00:00`,
      premio: formData.premio,
      valor_cartela: parseFloat(formData.valor_cartela),
      quantidade_cartelas: parseInt(formData.quantidade_cartelas),
      status: formData.status,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      vendas: {
        cartelas_vendidas: 0,
        total_arrecadado: 0
      }
    };

    if (editingId) {
      updateSorteio(editingId, sorteioData);
      toast({
        title: "Sorteio atualizado",
        description: `O sorteio "${formData.nome}" foi atualizado com sucesso.`
      });
    } else {
      addSorteio(sorteioData);
      toast({
        title: "Sorteio criado",
        description: `O sorteio "${formData.nome}" foi criado com sucesso.`
      });
    }

    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Dice5 className="w-5 h-5" />
            {editingId ? 'Editar Sorteio' : 'Novo Sorteio'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome do Sorteio *</Label>
            <Input
              id="nome"
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              placeholder="Ex: Rifa de Natal 2024"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="data_sorteio">Data do Sorteio *</Label>
              <Input
                id="data_sorteio"
                type="date"
                value={formData.data_sorteio}
                onChange={(e) => setFormData({ ...formData, data_sorteio: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status *</Label>
              <Select 
                value={formData.status} 
                onValueChange={(value: 'agendado' | 'em_andamento' | 'concluido') => 
                  setFormData({ ...formData, status: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="agendado">Agendado</SelectItem>
                  <SelectItem value="em_andamento">Em Andamento</SelectItem>
                  <SelectItem value="concluido">Concluído</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="premio">Prêmio *</Label>
            <Input
              id="premio"
              value={formData.premio}
              onChange={(e) => setFormData({ ...formData, premio: e.target.value })}
              placeholder="Ex: R$ 10.000,00 em dinheiro"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="valor_cartela">Valor da Cartela (R$) *</Label>
              <Input
                id="valor_cartela"
                type="number"
                step="0.01"
                min="0"
                value={formData.valor_cartela}
                onChange={(e) => setFormData({ ...formData, valor_cartela: e.target.value })}
                placeholder="Ex: 10.00"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quantidade_cartelas">Quantidade de Cartelas *</Label>
              <Input
                id="quantidade_cartelas"
                type="number"
                min="1"
                value={formData.quantidade_cartelas}
                onChange={(e) => setFormData({ ...formData, quantidade_cartelas: e.target.value })}
                placeholder="Ex: 1000"
                required
              />
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <Button type="submit" className="flex-1 gap-2">
              <Save className="w-4 h-4" />
              {editingId ? 'Salvar Alterações' : 'Criar Sorteio'}
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

export default SorteioModal;
