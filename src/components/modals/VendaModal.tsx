import React, { useState, useEffect } from 'react';
import { useBingo } from '@/contexts/BingoContext';
import { Venda } from '@/types/bingo';
import { gerarId, formatarMoeda, formatarNumeroCartela } from '@/lib/utils/formatters';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShoppingCart, Save } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VendaModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingId: string | null;
}

const VendaModal: React.FC<VendaModalProps> = ({ isOpen, onClose, editingId }) => {
  const { sorteioAtivo, vendedores, cartelas, vendas, addVenda, updateVenda, atualizarStatusCartela } = useBingo();
  const { toast } = useToast();
  
  const [vendedorId, setVendedorId] = useState('');
  const [clienteNome, setClienteNome] = useState('');
  const [clienteTelefone, setClienteTelefone] = useState('');
  const [cartelasSelecionadas, setCartelasSelecionadas] = useState<number[]>([]);
  const [valorPago, setValorPago] = useState('0');
  const [formaPagamento, setFormaPagamento] = useState<'dinheiro' | 'pix' | 'cartao' | 'transferencia'>('dinheiro');

  const vendedoresAtivos = vendedores.filter(v => v.ativo);
  const cartelasDoVendedor = cartelas.filter(c => c.vendedor_id === vendedorId && c.status === 'ativa');
  const valorCartela = sorteioAtivo?.valor_cartela || 0;
  const valorTotal = cartelasSelecionadas.length * valorCartela;

  useEffect(() => {
    if (isOpen && editingId) {
      const venda = vendas.find(v => v.id === editingId);
      if (venda) {
        setVendedorId(venda.vendedor_id);
        setClienteNome(venda.cliente_nome);
        setClienteTelefone(venda.cliente_telefone || '');
        setCartelasSelecionadas(venda.numeros_cartelas.split(',').map(n => parseInt(n)));
        setValorPago(venda.valor_pago.toString());
        setFormaPagamento(venda.forma_pagamento);
      }
    } else if (isOpen) {
      setVendedorId('');
      setClienteNome('');
      setClienteTelefone('');
      setCartelasSelecionadas([]);
      setValorPago('0');
      setFormaPagamento('dinheiro');
    }
  }, [isOpen, editingId, vendas]);

  const toggleCartela = (numero: number) => {
    setCartelasSelecionadas(prev => 
      prev.includes(numero) ? prev.filter(n => n !== numero) : [...prev, numero]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendedorId || !clienteNome || cartelasSelecionadas.length === 0) {
      toast({ title: "Erro", description: "Preencha todos os campos obrigatórios.", variant: "destructive" });
      return;
    }

    const vendedor = vendedores.find(v => v.id === vendedorId);
    const vendaData: Venda = {
      id: editingId || gerarId(),
      sorteio_id: sorteioAtivo!.id,
      vendedor_id: vendedorId,
      vendedor_nome: vendedor?.nome,
      cliente_nome: clienteNome,
      cliente_telefone: clienteTelefone,
      numeros_cartelas: cartelasSelecionadas.join(','),
      valor_total: valorTotal,
      valor_pago: parseFloat(valorPago) || 0,
      forma_pagamento: formaPagamento,
      status: parseFloat(valorPago) >= valorTotal ? 'concluida' : 'pendente',
      data_venda: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (editingId) {
      updateVenda(editingId, vendaData);
      toast({ title: "Venda atualizada", description: "A venda foi atualizada com sucesso." });
    } else {
      addVenda(vendaData);
      cartelasSelecionadas.forEach(num => atualizarStatusCartela(num, 'vendida', vendedorId, vendedor?.nome));
      toast({ title: "Venda registrada", description: "A venda foi registrada com sucesso." });
    }
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" />
            {editingId ? 'Editar Venda' : 'Nova Venda'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Vendedor *</Label>
            <Select value={vendedorId} onValueChange={(v) => { setVendedorId(v); setCartelasSelecionadas([]); }}>
              <SelectTrigger><SelectValue placeholder="Selecione um vendedor" /></SelectTrigger>
              <SelectContent>
                {vendedoresAtivos.map(v => <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome do Cliente *</Label>
              <Input value={clienteNome} onChange={(e) => setClienteNome(e.target.value)} placeholder="Nome completo" required />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={clienteTelefone} onChange={(e) => setClienteTelefone(e.target.value)} placeholder="(00) 00000-0000" />
            </div>
          </div>
          {vendedorId && (
            <div className="space-y-2">
              <Label>Cartelas do Vendedor ({cartelasDoVendedor.length} disponíveis)</Label>
              <div className="border rounded-lg p-4 max-h-40 overflow-y-auto">
                {cartelasDoVendedor.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">Nenhuma cartela disponível</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {cartelasDoVendedor.map(c => (
                      <button key={c.numero} type="button" onClick={() => toggleCartela(c.numero)}
                        className={cn('w-12 h-12 rounded-lg font-bold text-sm border-2 transition-all',
                          cartelasSelecionadas.includes(c.numero) ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border hover:border-primary/50'
                        )}>{formatarNumeroCartela(c.numero)}</button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Valor Total</Label>
              <Input value={formatarMoeda(valorTotal)} disabled className="font-bold" />
            </div>
            <div className="space-y-2">
              <Label>Valor Pago</Label>
              <Input type="number" step="0.01" value={valorPago} onChange={(e) => setValorPago(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Pagamento</Label>
              <Select value={formaPagamento} onValueChange={(v: any) => setFormaPagamento(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="cartao">Cartão</SelectItem>
                  <SelectItem value="transferencia">Transferência</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-4 pt-4">
            <Button type="submit" className="flex-1 gap-2"><Save className="w-4 h-4" />{editingId ? 'Salvar' : 'Registrar'}</Button>
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default VendaModal;
