import React from 'react';
import { Dice5, Target } from 'lucide-react';
import { useBingo } from '@/contexts/BingoContext';

const Header: React.FC = () => {
  const { sorteioAtivo } = useBingo();

  return (
    <header className="gradient-header text-primary-foreground shadow-lg">
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
              <Dice5 className="w-8 h-8" />
              Sistema de Gerenciamento de Bingos
            </h1>
            <p className="text-primary-foreground/70 mt-1">
              Sistema completo de gestão de rifas e bingos
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-primary-foreground/70 flex items-center justify-end gap-1">
              <Target className="w-4 h-4" />
              Sorteio Selecionado
            </div>
            <div className="text-lg font-bold">
              {sorteioAtivo ? sorteioAtivo.nome : 'Nenhum sorteio selecionado'}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
