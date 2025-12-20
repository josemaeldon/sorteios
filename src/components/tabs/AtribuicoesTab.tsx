import React, { useState } from 'react';
import { useBingo } from '@/contexts/BingoContext';
import { ListTodo, Plus, Search, Filter, Eraser, Eye, Trash2, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { formatarData, formatarNumeroCartela, getStatusLabel } from '@/lib/utils/formatters';
import AtribuicaoModal from '@/components/modals/AtribuicaoModal';
import { useToast } from '@/hooks/use-toast';
import { CartelaAtribuida } from '@/types/bingo';
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

const AtribuicoesTab: React.FC = () => {
  const { 
    sorteioAtivo, 
    atribuicoes,
    vendedores,
    filtrosAtribuicoes, 
    setFiltrosAtribuicoes,
    deleteAtribuicao,
    removeCartelaFromAtribuicao,
    updateCartelaStatusInAtribuicao,
    atualizarStatusCartela
  } = useBingo();
  const { toast } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expandedAtribuicao, setExpandedAtribuicao] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingAtribuicao, setDeletingAtribuicao] = useState<{ id: string; vendedorId: string; cartela?: number } | null>(null);
  const [actionType, setActionType] = useState<'devolver' | 'excluir-cartela' | 'excluir-atribuicao'>('excluir-atribuicao');

  if (!sorteioAtivo) {
    return (
      <div className="text-center py-12">
        <ListTodo className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold text-foreground mb-2">Atribuições</h2>
        <p className="text-muted-foreground">Selecione um sorteio para gerenciar atribuições</p>
      </div>
    );
  }

  const atribuicoesFiltradas = atribuicoes.filter(a => {
    if (filtrosAtribuicoes.busca) {
      const busca = filtrosAtribuicoes.busca.toLowerCase();
      const matchVendedor = a.vendedor_nome && a.vendedor_nome.toLowerCase().includes(busca);
      const matchCartela = a.cartelas.some(c => c.numero.toString().includes(busca));
      if (!matchVendedor && !matchCartela) return false;
    }
    if (filtrosAtribuicoes.vendedor !== 'todos') {
      if (a.vendedor_id !== filtrosAtribuicoes.vendedor) return false;
    }
    if (filtrosAtribuicoes.status !== 'todos') {
      const hasCartelaWithStatus = a.cartelas.some(c => c.status === filtrosAtribuicoes.status);
      if (!hasCartelaWithStatus) return false;
    }
    return true;
  });

  const handleDevolverCartela = (atribuicaoId: string, vendedorId: string, numeroCartela: number) => {
    setDeletingAtribuicao({ id: atribuicaoId, vendedorId, cartela: numeroCartela });
    setActionType('devolver');
    setDeleteDialogOpen(true);
  };

  const handleExcluirCartela = (atribuicaoId: string, vendedorId: string, numeroCartela: number) => {
    setDeletingAtribuicao({ id: atribuicaoId, vendedorId, cartela: numeroCartela });
    setActionType('excluir-cartela');
    setDeleteDialogOpen(true);
  };

  const handleExcluirAtribuicao = (id: string, vendedorId: string) => {
    setDeletingAtribuicao({ id, vendedorId });
    setActionType('excluir-atribuicao');
    setDeleteDialogOpen(true);
  };

  const confirmAction = () => {
    if (!deletingAtribuicao) return;
    
    const atribuicao = atribuicoes.find(a => a.id === deletingAtribuicao.id);
    if (!atribuicao) return;

    if (actionType === 'devolver' && deletingAtribuicao.cartela) {
      updateCartelaStatusInAtribuicao(deletingAtribuicao.vendedorId, deletingAtribuicao.cartela, 'devolvida');
      atualizarStatusCartela(deletingAtribuicao.cartela, 'devolvida');
      toast({
        title: "Cartela devolvida",
        description: `A cartela ${formatarNumeroCartela(deletingAtribuicao.cartela)} foi devolvida.`
      });
    } else if (actionType === 'excluir-cartela' && deletingAtribuicao.cartela) {
      removeCartelaFromAtribuicao(deletingAtribuicao.vendedorId, deletingAtribuicao.cartela);
      atualizarStatusCartela(deletingAtribuicao.cartela, 'disponivel');
      toast({
        title: "Cartela removida",
        description: `A cartela ${formatarNumeroCartela(deletingAtribuicao.cartela)} foi removida da atribuição.`
      });
    } else if (actionType === 'excluir-atribuicao') {
      // Voltar todas as cartelas para disponível
      atribuicao.cartelas.forEach(c => {
        atualizarStatusCartela(c.numero, 'disponivel');
      });
      deleteAtribuicao(deletingAtribuicao.id);
      toast({
        title: "Atribuição excluída",
        description: `A atribuição de ${atribuicao.vendedor_nome} foi excluída.`
      });
    }

    setDeleteDialogOpen(false);
    setDeletingAtribuicao(null);
  };

  const limparFiltros = () => {
    setFiltrosAtribuicoes({ busca: '', status: 'todos', vendedor: 'todos' });
  };

  const toggleExpand = (id: string) => {
    setExpandedAtribuicao(prev => prev === id ? null : id);
  };

  const getStatusCounts = (cartelas: CartelaAtribuida[]) => {
    return {
      ativas: cartelas.filter(c => c.status === 'ativa').length,
      vendidas: cartelas.filter(c => c.status === 'vendida').length,
      devolvidas: cartelas.filter(c => c.status === 'devolvida').length,
    };
  };

  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <ListTodo className="w-6 h-6" />
          Atribuições - {sorteioAtivo.nome}
        </h2>
        <Button onClick={() => setIsModalOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Nova Atribuição
        </Button>
      </div>

      {/* Filtros */}
      <div className="filter-bar">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground flex items-center gap-1">
              <Search className="w-4 h-4" />
              Buscar
            </label>
            <Input
              placeholder="Vendedor ou número..."
              value={filtrosAtribuicoes.busca}
              onChange={(e) => setFiltrosAtribuicoes({ ...filtrosAtribuicoes, busca: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground flex items-center gap-1">
              <Filter className="w-4 h-4" />
              Status Cartelas
            </label>
            <Select 
              value={filtrosAtribuicoes.status} 
              onValueChange={(value: any) => setFiltrosAtribuicoes({ ...filtrosAtribuicoes, status: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="ativa">Ativas</SelectItem>
                <SelectItem value="vendida">Vendidas</SelectItem>
                <SelectItem value="devolvida">Devolvidas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground flex items-center gap-1">
              Vendedor
            </label>
            <Select 
              value={filtrosAtribuicoes.vendedor} 
              onValueChange={(value) => setFiltrosAtribuicoes({ ...filtrosAtribuicoes, vendedor: value })}
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

      {/* Lista de Atribuições */}
      <div className="space-y-4">
        {atribuicoesFiltradas.map((atribuicao) => {
          const counts = getStatusCounts(atribuicao.cartelas);
          const isExpanded = expandedAtribuicao === atribuicao.id;
          
          return (
            <Collapsible key={atribuicao.id} open={isExpanded} onOpenChange={() => toggleExpand(atribuicao.id)}>
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <CollapsibleTrigger asChild>
                  <div className="p-4 cursor-pointer hover:bg-muted/30 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                          <span className="text-primary font-bold text-lg">
                            {atribuicao.vendedor_nome?.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <h3 className="font-bold text-foreground text-lg">{atribuicao.vendedor_nome}</h3>
                          <p className="text-sm text-muted-foreground">
                            {atribuicao.cartelas.length} cartela(s) atribuída(s)
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="hidden sm:flex gap-2">
                          {counts.ativas > 0 && (
                            <span className="status-badge status-ativa">
                              {counts.ativas} ativa(s)
                            </span>
                          )}
                          {counts.vendidas > 0 && (
                            <span className="status-badge status-vendida">
                              {counts.vendidas} vendida(s)
                            </span>
                          )}
                          {counts.devolvidas > 0 && (
                            <span className="status-badge status-devolvida">
                              {counts.devolvidas} devolvida(s)
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Button 
                            size="sm" 
                            variant="destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleExcluirAtribuicao(atribuicao.id, atribuicao.vendedor_id);
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </CollapsibleTrigger>
                
                <CollapsibleContent>
                  <div className="border-t border-border p-4 bg-muted/20">
                    <div className="mb-4 flex justify-between items-center">
                      <h4 className="font-semibold text-foreground">Cartelas Atribuídas</h4>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => setIsModalOpen(true)}
                        className="gap-1"
                      >
                        <Plus className="w-4 h-4" />
                        Adicionar Cartelas
                      </Button>
                    </div>
                    
                    {atribuicao.cartelas.length === 0 ? (
                      <p className="text-center text-muted-foreground py-4">
                        Nenhuma cartela atribuída a este vendedor
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="bg-muted/50">
                              <th className="p-3 text-left font-semibold text-foreground">Cartela</th>
                              <th className="p-3 text-left font-semibold text-foreground">Data Atribuição</th>
                              <th className="p-3 text-center font-semibold text-foreground">Status</th>
                              <th className="p-3 text-center font-semibold text-foreground">Ações</th>
                            </tr>
                          </thead>
                          <tbody>
                            {atribuicao.cartelas.map((cartela) => (
                              <tr key={cartela.numero} className="border-b border-border hover:bg-muted/30 transition-colors">
                                <td className="p-3">
                                  <span className="px-3 py-1 bg-primary/10 text-primary rounded-full font-bold">
                                    {formatarNumeroCartela(cartela.numero)}
                                  </span>
                                </td>
                                <td className="p-3 text-muted-foreground">
                                  {formatarData(cartela.data_atribuicao)}
                                </td>
                                <td className="p-3 text-center">
                                  <span className={cn('status-badge', `status-${cartela.status}`)}>
                                    {getStatusLabel(cartela.status)}
                                  </span>
                                </td>
                                <td className="p-3">
                                  <div className="flex justify-center gap-2">
                                    {cartela.status === 'ativa' && (
                                      <Button 
                                        size="sm" 
                                        variant="outline" 
                                        onClick={() => handleDevolverCartela(atribuicao.id, atribuicao.vendedor_id, cartela.numero)}
                                        className="gap-1"
                                      >
                                        <RotateCcw className="w-4 h-4" />
                                        Devolver
                                      </Button>
                                    )}
                                    {cartela.status !== 'vendida' && (
                                      <Button 
                                        size="sm" 
                                        variant="destructive" 
                                        onClick={() => handleExcluirCartela(atribuicao.id, atribuicao.vendedor_id, cartela.numero)}
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })}
        
        {atribuicoesFiltradas.length === 0 && (
          <div className="text-center py-12 bg-card border border-border rounded-xl">
            {atribuicoes.length === 0 ? (
              <div>
                <ListTodo className="w-12 h-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
                <p className="text-lg text-foreground">Nenhuma atribuição encontrada</p>
                <p className="text-sm mt-2 text-muted-foreground">Atribua cartelas aos vendedores para começar</p>
                <Button onClick={() => setIsModalOpen(true)} className="mt-4 gap-2">
                  <Plus className="w-4 h-4" />
                  Nova Atribuição
                </Button>
              </div>
            ) : (
              <div>
                <Filter className="w-12 h-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
                <p className="text-lg text-foreground">Nenhuma atribuição encontrada</p>
                <p className="text-sm mt-2 text-muted-foreground">Tente ajustar os filtros de busca</p>
              </div>
            )}
          </div>
        )}
      </div>

      <AtribuicaoModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionType === 'devolver' && 'Devolver Cartela'}
              {actionType === 'excluir-cartela' && 'Remover Cartela'}
              {actionType === 'excluir-atribuicao' && 'Excluir Atribuição'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionType === 'devolver' && 'Tem certeza que deseja devolver esta cartela? Ela será marcada como devolvida.'}
              {actionType === 'excluir-cartela' && 'Tem certeza que deseja remover esta cartela da atribuição? Ela voltará a ficar disponível.'}
              {actionType === 'excluir-atribuicao' && 'Tem certeza que deseja excluir esta atribuição? Todas as cartelas voltarão a ficar disponíveis.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmAction}
              className={actionType !== 'devolver' ? 'bg-danger text-danger-foreground hover:bg-danger/90' : ''}
            >
              {actionType === 'devolver' && 'Devolver'}
              {actionType === 'excluir-cartela' && 'Remover'}
              {actionType === 'excluir-atribuicao' && 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AtribuicoesTab;