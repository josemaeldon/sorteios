import React, { useState } from 'react';
import { useBingo } from '@/contexts/BingoContext';
import { Grid3X3, Search, Filter, Eraser, User, Loader2 } from 'lucide-react';
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
} from '@/components/ui/dialog';

const CartelasTab: React.FC = () => {
  const { 
    sorteioAtivo, 
    cartelas, 
    vendedores,
    filtrosCartelas, 
    setFiltrosCartelas,
    isLoading
  } = useBingo();

  const [selectedCartela, setSelectedCartela] = useState<Cartela | null>(null);

  if (!sorteioAtivo) {
    return (
      <div className="text-center py-12">
        <Grid3X3 className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold text-foreground mb-2">Cartelas</h2>
        <p className="text-muted-foreground">Selecione um sorteio para visualizar as cartelas</p>
      </div>
    );
  }

  const cartelasFiltradas = cartelas.filter(c => {
    if (filtrosCartelas.busca) {
      const numeroFormatado = formatarNumeroCartela(c.numero);
      if (numeroFormatado !== filtrosCartelas.busca) return false;
    }
    if (filtrosCartelas.status !== 'todos') {
      // Cartelas devolvidas também aparecem no filtro de disponíveis
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
    atribuida: cartelas.filter(c => c.status === 'ativa').length,
    vendida: cartelas.filter(c => c.status === 'vendida').length,
    devolvida: cartelas.filter(c => c.status === 'devolvida').length
  };

  const limparFiltros = () => {
    setFiltrosCartelas({ busca: '', status: 'todos', vendedor: 'todos' });
  };

  const getCartelaStatusClass = (status: string) => {
    switch (status) {
      case 'disponivel': return 'bg-card border-border text-muted-foreground';
      case 'ativa': return 'status-atribuida';
      case 'vendida': return 'status-vendida';
      case 'devolvida': return 'status-devolvida';
      default: return 'bg-card border-border';
    }
  };

  const getTooltip = (cartela: typeof cartelas[0]) => {
    // Busca o nome do vendedor diretamente da lista de vendedores
    const vendedor = cartela.vendedor_id 
      ? vendedores.find(v => v.id === cartela.vendedor_id)
      : null;
    const nomeVendedor = vendedor?.nome || cartela.vendedor_nome || 'N/A';
    
    switch (cartela.status) {
      case 'disponivel': return 'Disponível';
      case 'ativa': return `Atribuída: ${nomeVendedor}`;
      case 'vendida': return `Vendida: ${nomeVendedor}`;
      case 'devolvida': return `Devolvida: ${nomeVendedor}`;
      default: return '';
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Grid3X3 className="w-6 h-6" />
          Cartelas - {sorteioAtivo.nome}
        </h2>
        <p className="text-muted-foreground mt-1">
          Total de {sorteioAtivo.quantidade_cartelas} cartelas
        </p>
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
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
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
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
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
          {cartelasFiltradas.map((cartela) => {
            const hasNumbers = !!cartela.numeros_grade;
            return (
              <div
                key={cartela.numero}
                className={cn(
                  'cartela-item',
                  getCartelaStatusClass(cartela.status),
                  hasNumbers && 'cursor-pointer hover:ring-2 hover:ring-primary',
                )}
                onClick={() => hasNumbers && setSelectedCartela(cartela)}
              >
                {formatarNumeroCartela(cartela.numero)}
                <div className="cartela-tooltip">{getTooltip(cartela)}</div>
              </div>
            );
          })}
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

      {/* Modal de números da cartela */}
      <Dialog open={!!selectedCartela} onOpenChange={(open) => !open && setSelectedCartela(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Cartela {selectedCartela ? formatarNumeroCartela(selectedCartela.numero) : ''}</DialogTitle>
          </DialogHeader>
          {selectedCartela?.numeros_grade && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(5, 1fr)',
                gap: 4,
              }}
            >
              {selectedCartela.numeros_grade.map((num, i) => (
                <div
                  key={i}
                  className="flex items-center justify-center rounded border border-border text-sm font-semibold aspect-square"
                  style={{ background: num === 0 ? 'var(--muted)' : undefined }}
                >
                  {num === 0 ? '★' : num}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CartelasTab;
