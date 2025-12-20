import React from 'react';
import { useBingo } from '@/contexts/BingoContext';
import { PieChart } from 'lucide-react';

const RelatoriosTab: React.FC = () => {
  const { sorteioAtivo } = useBingo();

  if (!sorteioAtivo) {
    return (
      <div className="text-center py-12">
        <PieChart className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold text-foreground mb-2">Relatórios</h2>
        <p className="text-muted-foreground">Selecione um sorteio para gerar relatórios</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <h2 className="text-2xl font-bold text-foreground flex items-center gap-2 mb-6">
        <PieChart className="w-6 h-6" />
        Relatórios - {sorteioAtivo.nome}
      </h2>
      <div className="bg-card p-8 rounded-xl border border-border text-center">
        <PieChart className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Os relatórios detalhados estão disponíveis no Dashboard.</p>
        <p className="text-sm text-muted-foreground mt-2">Acesse a aba Dashboard para visualizar estatísticas completas.</p>
      </div>
    </div>
  );
};

export default RelatoriosTab;
