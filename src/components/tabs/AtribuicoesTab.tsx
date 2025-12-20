import React, { useState } from 'react';
import { useBingo } from '@/contexts/BingoContext';
import { ListTodo, Plus, Search, Filter, Eraser, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { formatarData, formatarNumeroCartela, getStatusLabel } from '@/lib/utils/formatters';
import AtribuicaoModal from '@/components/modals/AtribuicaoModal';
import { useToast } from '@/hooks/use-toast';
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

const AtribuicoesTab: React.FC = () => {
  const { 
    sorteioAtivo, 
    atribuicoes,
    vendedores,
    filtrosAtribuicoes, 
    setFiltrosAtribuicoes,
    deleteAtribuicao,
    atualizarStatusCartela
  } = useBingo();
  const { toast } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [devolvendo, setDevolvendo] = useState(false);

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
      const match = a.numero_cartela.toString().includes(busca) ||
                   (a.vendedor_nome && a.vendedor_nome.toLowerCase().includes(busca));
      if (!match) return false;
    }
    if (filtrosAtribuicoes.status !== 'todos') {
      if (a.status !== filtrosAtribuicoes.status) return false;
    }
    if (filtrosAtribuicoes.vendedor !== 'todos') {
      if (a.vendedor_id !== filtrosAtribuicoes.vendedor) return false;
    }
    return true;
  });

  const handleDevolver = (id: string, numeroCartela: number) => {
    setDeletingId(id);
    setDevolvendo(true);
    setDeleteDialogOpen(true);
  };

  const handleExcluir = (id: string) => {
    setDeletingId(id);
    setDevolvendo(false);
    setDeleteDialogOpen(true);
  };

  const confirmAction = () => {
    if (deletingId) {
      const atribuicao = atribuicoes.find(a => a.id === deletingId);
      if (atribuicao) {
        if (devolvendo) {
          // Devolver cartela - marca como devolvida
          atualizarStatusCartela(atribuicao.numero_cartela, 'devolvida');
          toast({
            title: "Cartela devolvida",
            description: `A cartela ${formatarNumeroCartela(atribuicao.numero_cartela)} foi devolvida.`
          });
        } else {
          // Excluir atribuição - volta para disponível
          atualizarStatusCartela(atribuicao.numero_cartela, 'disponivel');
          deleteAtribuicao(deletingId);
          toast({
            title: "Atribuição excluída",
            description: `A atribuição da cartela ${formatarNumeroCartela(atribuicao.numero_cartela)} foi excluída.`
          });
        }
      }
    }
    setDeleteDialogOpen(false);
    setDeletingId(null);
  };

  const limparFiltros = () => {
    setFiltrosAtribuicoes({ busca: '', status: 'todos', vendedor: 'todos' });
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
              placeholder="Número ou vendedor..."
              value={filtrosAtribuicoes.busca}
              onChange={(e) => setFiltrosAtribuicoes({ ...filtrosAtribuicoes, busca: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground flex items-center gap-1">
              <Filter className="w-4 h-4" />
              Status
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

      {/* Tabela */}
      <div className="table-container overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-muted/50">
              <th className="p-4 text-left font-semibold text-foreground">Cartela</th>
              <th className="p-4 text-left font-semibold text-foreground">Vendedor</th>
              <th className="p-4 text-left font-semibold text-foreground">Data Atribuição</th>
              <th className="p-4 text-center font-semibold text-foreground">Status</th>
              <th className="p-4 text-center font-semibold text-foreground">Ações</th>
            </tr>
          </thead>
          <tbody>
            {atribuicoesFiltradas.map((atribuicao) => (
              <tr key={atribuicao.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                <td className="p-4">
                  <span className="px-3 py-1 bg-primary/10 text-primary rounded-full font-bold">
                    {formatarNumeroCartela(atribuicao.numero_cartela)}
                  </span>
                </td>
                <td className="p-4 font-semibold text-foreground">{atribuicao.vendedor_nome || 'N/A'}</td>
                <td className="p-4 text-muted-foreground">{formatarData(atribuicao.data_atribuicao)}</td>
                <td className="p-4 text-center">
                  <span className={cn('status-badge', `status-${atribuicao.status}`)}>
                    {getStatusLabel(atribuicao.status)}
                  </span>
                </td>
                <td className="p-4">
                  <div className="flex justify-center gap-2">
                    {atribuicao.status === 'ativa' && (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => handleDevolver(atribuicao.id, atribuicao.numero_cartela)}
                        className="gap-1"
                      >
                        <RotateCcw className="w-4 h-4" />
                        Devolver
                      </Button>
                    )}
                    <Button 
                      size="sm" 
                      variant="destructive" 
                      onClick={() => handleExcluir(atribuicao.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {atribuicoesFiltradas.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-muted-foreground">
                  {atribuicoes.length === 0 ? (
                    <div>
                      <ListTodo className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p className="text-lg">Nenhuma atribuição encontrada</p>
                      <p className="text-sm mt-2">Atribua cartelas aos vendedores para começar</p>
                      <Button onClick={() => setIsModalOpen(true)} className="mt-4 gap-2">
                        <Plus className="w-4 h-4" />
                        Nova Atribuição
                      </Button>
                    </div>
                  ) : (
                    <div>
                      <Filter className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p className="text-lg">Nenhuma atribuição encontrada</p>
                      <p className="text-sm mt-2">Tente ajustar os filtros de busca</p>
                    </div>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <AtribuicaoModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {devolvendo ? 'Devolver Cartela' : 'Excluir Atribuição'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {devolvendo 
                ? 'Tem certeza que deseja devolver esta cartela? Ela será marcada como devolvida.'
                : 'Tem certeza que deseja excluir esta atribuição? A cartela voltará a ficar disponível.'
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmAction}
              className={devolvendo ? '' : 'bg-danger text-danger-foreground hover:bg-danger/90'}
            >
              {devolvendo ? 'Devolver' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AtribuicoesTab;
