import React from 'react';
import { Dice5, Target, LogOut, Settings, User } from 'lucide-react';
import { useBingo } from '@/contexts/BingoContext';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const Header: React.FC = () => {
  const { sorteioAtivo } = useBingo();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

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
          <div className="flex items-center gap-4">
            <div className="text-right hidden md:block">
              <div className="text-sm text-primary-foreground/70 flex items-center justify-end gap-1">
                <Target className="w-4 h-4" />
                Sorteio Selecionado
              </div>
              <div className="text-lg font-bold">
                {sorteioAtivo ? sorteioAtivo.nome : 'Nenhum sorteio selecionado'}
              </div>
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="text-primary-foreground hover:bg-primary-foreground/10">
                  <User className="h-5 w-5 mr-2" />
                  <span className="hidden sm:inline">{user?.nome}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span>{user?.nome}</span>
                    <span className="text-xs text-muted-foreground">{user?.email}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {user?.role === 'admin' && (
                  <DropdownMenuItem onClick={() => navigate('/admin')}>
                    <Settings className="h-4 w-4 mr-2" />
                    Administrar Usuários
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={logout} className="text-destructive">
                  <LogOut className="h-4 w-4 mr-2" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
