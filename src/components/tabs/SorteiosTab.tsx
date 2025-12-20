import React, { useState } from 'react';
import { Plus, Dice5 } from 'lucide-react';
import { useBingo } from '@/contexts/BingoContext';
import SorteioCard from '@/components/SorteioCard';
import SorteioModal from '@/components/modals/SorteioModal';
import { Button } from '@/components/ui/button';
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

const SorteiosTab: React.FC = () => {
  const { 
    sorteios, 
    sorteioAtivo, 
    setSorteioAtivo, 
    deleteSorteio,
    setCurrentTab
  } = useBingo();
  const { toast } = useToast();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSorteioId, setEditingSorteioId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingSorteioId, setDeletingSorteioId] = useState<string | null>(null);

  const handleSelect = (id: string) => {
    const sorteio = sorteios.find(s => s.id === id);
    if (sorteio) {
      setSorteioAtivo(sorteio);
      setCurrentTab('dashboard');
      toast({
        title: "Sorteio selecionado",
        description: `Sorteio "${sorteio.nome}" foi selecionado.`
      });
    }
  };

  const handleEdit = (id: string) => {
    setEditingSorteioId(id);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    setDeletingSorteioId(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (deletingSorteioId) {
      deleteSorteio(deletingSorteioId);
      toast({
        title: "Sorteio excluído",
        description: "O sorteio foi excluído com sucesso."
      });
    }
    setDeleteDialogOpen(false);
    setDeletingSorteioId(null);
  };

  const handleNewSorteio = () => {
    setEditingSorteioId(null);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingSorteioId(null);
  };

  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex justify-between items-center">
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Dice5 className="w-6 h-6" />
          Gerenciar Sorteios
        </h2>
        <Button onClick={handleNewSorteio} className="gap-2">
          <Plus className="w-4 h-4" />
          Novo Sorteio
        </Button>
      </div>

      {sorteios.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-xl border border-border">
          <Dice5 className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold text-foreground mb-2">
            Nenhum sorteio encontrado
          </h3>
          <p className="text-muted-foreground mb-6">
            Crie seu primeiro sorteio para começar
          </p>
          <Button onClick={handleNewSorteio} className="gap-2">
            <Plus className="w-4 h-4" />
            Criar Primeiro Sorteio
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sorteios.map(sorteio => (
            <SorteioCard
              key={sorteio.id}
              sorteio={sorteio}
              isActive={sorteioAtivo?.id === sorteio.id}
              onSelect={handleSelect}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <SorteioModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        editingId={editingSorteioId}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Sorteio</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este sorteio? Esta ação não pode ser desfeita.
              Todos os vendedores, atribuições e vendas relacionados serão perdidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              className="bg-danger text-danger-foreground hover:bg-danger/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SorteiosTab;
