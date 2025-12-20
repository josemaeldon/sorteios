import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { 
  Sorteio, 
  Vendedor, 
  Cartela, 
  Atribuicao, 
  Venda, 
  TabType,
  FiltrosVendedores,
  FiltrosCartelas,
  FiltrosAtribuicoes,
  FiltrosVendas
} from '@/types/bingo';
import { useToast } from '@/hooks/use-toast';

interface BingoContextType {
  // State
  sorteioAtivo: Sorteio | null;
  sorteios: Sorteio[];
  vendedores: Vendedor[];
  cartelas: Cartela[];
  atribuicoes: Atribuicao[];
  vendas: Venda[];
  currentTab: TabType;
  isLoading: boolean;
  
  // Filtros
  filtrosVendedores: FiltrosVendedores;
  filtrosCartelas: FiltrosCartelas;
  filtrosAtribuicoes: FiltrosAtribuicoes;
  filtrosVendas: FiltrosVendas;
  
  // Actions
  setSorteioAtivo: (sorteio: Sorteio | null) => void;
  setSorteios: (sorteios: Sorteio[]) => void;
  setVendedores: (vendedores: Vendedor[]) => void;
  setCartelas: (cartelas: Cartela[]) => void;
  setAtribuicoes: (atribuicoes: Atribuicao[]) => void;
  setVendas: (vendas: Venda[]) => void;
  setCurrentTab: (tab: TabType) => void;
  setIsLoading: (loading: boolean) => void;
  
  // Filtros Actions
  setFiltrosVendedores: (filtros: FiltrosVendedores) => void;
  setFiltrosCartelas: (filtros: FiltrosCartelas) => void;
  setFiltrosAtribuicoes: (filtros: FiltrosAtribuicoes) => void;
  setFiltrosVendas: (filtros: FiltrosVendas) => void;
  
  // CRUD Operations
  addSorteio: (sorteio: Sorteio) => void;
  updateSorteio: (id: string, sorteio: Partial<Sorteio>) => void;
  deleteSorteio: (id: string) => void;
  
  addVendedor: (vendedor: Vendedor) => void;
  updateVendedor: (id: string, vendedor: Partial<Vendedor>) => void;
  deleteVendedor: (id: string) => void;
  
  addAtribuicao: (atribuicao: Atribuicao) => void;
  addCartelasToAtribuicao: (vendedorId: string, cartelas: number[]) => void;
  removeCartelaFromAtribuicao: (vendedorId: string, numeroCartela: number) => void;
  updateCartelaStatusInAtribuicao: (vendedorId: string, numeroCartela: number, status: 'ativa' | 'vendida' | 'devolvida') => void;
  deleteAtribuicao: (id: string) => void;
  
  addVenda: (venda: Venda) => void;
  updateVenda: (id: string, venda: Partial<Venda>) => void;
  deleteVenda: (id: string) => void;
  
  // Utilities
  gerarCartelas: (quantidade: number) => void;
  atualizarStatusCartela: (numero: number, status: Cartela['status'], vendedorId?: string, vendedorNome?: string) => void;
}

const BingoContext = createContext<BingoContextType | undefined>(undefined);

export const BingoProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { toast } = useToast();
  
  // State
  const [sorteioAtivo, setSorteioAtivo] = useState<Sorteio | null>(null);
  const [sorteios, setSorteios] = useState<Sorteio[]>([]);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [cartelas, setCartelas] = useState<Cartela[]>([]);
  const [atribuicoes, setAtribuicoes] = useState<Atribuicao[]>([]);
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [currentTab, setCurrentTab] = useState<TabType>('sorteios');
  const [isLoading, setIsLoading] = useState(false);
  
  // Filtros
  const [filtrosVendedores, setFiltrosVendedores] = useState<FiltrosVendedores>({
    busca: '',
    status: 'todos'
  });
  
  const [filtrosCartelas, setFiltrosCartelas] = useState<FiltrosCartelas>({
    busca: '',
    status: 'todos',
    vendedor: 'todos'
  });
  
  const [filtrosAtribuicoes, setFiltrosAtribuicoes] = useState<FiltrosAtribuicoes>({
    busca: '',
    status: 'todos',
    vendedor: 'todos'
  });
  
  const [filtrosVendas, setFiltrosVendas] = useState<FiltrosVendas>({
    busca: '',
    status: 'todos',
    vendedor: 'todos',
    periodo: 'todos'
  });
  
  // CRUD Sorteios
  const addSorteio = useCallback((sorteio: Sorteio) => {
    setSorteios(prev => [...prev, sorteio]);
  }, []);
  
  const updateSorteio = useCallback((id: string, updates: Partial<Sorteio>) => {
    setSorteios(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
    if (sorteioAtivo?.id === id) {
      setSorteioAtivo(prev => prev ? { ...prev, ...updates } : null);
    }
  }, [sorteioAtivo]);
  
  const deleteSorteio = useCallback((id: string) => {
    setSorteios(prev => prev.filter(s => s.id !== id));
    if (sorteioAtivo?.id === id) {
      setSorteioAtivo(null);
    }
  }, [sorteioAtivo]);
  
  // CRUD Vendedores
  const addVendedor = useCallback((vendedor: Vendedor) => {
    setVendedores(prev => [...prev, vendedor]);
  }, []);
  
  const updateVendedor = useCallback((id: string, updates: Partial<Vendedor>) => {
    setVendedores(prev => prev.map(v => v.id === id ? { ...v, ...updates } : v));
  }, []);
  
  const deleteVendedor = useCallback((id: string) => {
    setVendedores(prev => prev.filter(v => v.id !== id));
  }, []);
  
  // CRUD Atribuições
  const addAtribuicao = useCallback((atribuicao: Atribuicao) => {
    setAtribuicoes(prev => [...prev, atribuicao]);
  }, []);
  
  const addCartelasToAtribuicao = useCallback((vendedorId: string, cartelas: number[]) => {
    setAtribuicoes(prev => prev.map(a => {
      if (a.vendedor_id === vendedorId) {
        const novasCartelas = cartelas.map(num => ({
          numero: num,
          status: 'ativa' as const,
          data_atribuicao: new Date().toISOString()
        }));
        return {
          ...a,
          cartelas: [...a.cartelas, ...novasCartelas],
          updated_at: new Date().toISOString()
        };
      }
      return a;
    }));
  }, []);
  
  const removeCartelaFromAtribuicao = useCallback((vendedorId: string, numeroCartela: number) => {
    setAtribuicoes(prev => prev.map(a => {
      if (a.vendedor_id === vendedorId) {
        return {
          ...a,
          cartelas: a.cartelas.filter(c => c.numero !== numeroCartela),
          updated_at: new Date().toISOString()
        };
      }
      return a;
    }));
  }, []);
  
  const updateCartelaStatusInAtribuicao = useCallback((vendedorId: string, numeroCartela: number, status: 'ativa' | 'vendida' | 'devolvida') => {
    setAtribuicoes(prev => prev.map(a => {
      if (a.vendedor_id === vendedorId) {
        return {
          ...a,
          cartelas: a.cartelas.map(c => 
            c.numero === numeroCartela 
              ? { ...c, status, data_devolucao: status === 'devolvida' ? new Date().toISOString() : undefined }
              : c
          ),
          updated_at: new Date().toISOString()
        };
      }
      return a;
    }));
  }, []);
  
  const deleteAtribuicao = useCallback((id: string) => {
    setAtribuicoes(prev => prev.filter(a => a.id !== id));
  }, []);
  
  // CRUD Vendas
  const addVenda = useCallback((venda: Venda) => {
    setVendas(prev => [...prev, venda]);
  }, []);
  
  const updateVenda = useCallback((id: string, updates: Partial<Venda>) => {
    setVendas(prev => prev.map(v => v.id === id ? { ...v, ...updates } : v));
  }, []);
  
  const deleteVenda = useCallback((id: string) => {
    setVendas(prev => prev.filter(v => v.id !== id));
  }, []);
  
  // Utilities
  const gerarCartelas = useCallback((quantidade: number) => {
    const novasCartelas: Cartela[] = [];
    for (let i = 1; i <= quantidade; i++) {
      novasCartelas.push({
        numero: i,
        status: 'disponivel'
      });
    }
    setCartelas(novasCartelas);
  }, []);
  
  const atualizarStatusCartela = useCallback((
    numero: number, 
    status: Cartela['status'], 
    vendedorId?: string, 
    vendedorNome?: string
  ) => {
    setCartelas(prev => prev.map(c => 
      c.numero === numero 
        ? { ...c, status, vendedor_id: vendedorId, vendedor_nome: vendedorNome }
        : c
    ));
  }, []);
  
  const value: BingoContextType = {
    sorteioAtivo,
    sorteios,
    vendedores,
    cartelas,
    atribuicoes,
    vendas,
    currentTab,
    isLoading,
    filtrosVendedores,
    filtrosCartelas,
    filtrosAtribuicoes,
    filtrosVendas,
    setSorteioAtivo,
    setSorteios,
    setVendedores,
    setCartelas,
    setAtribuicoes,
    setVendas,
    setCurrentTab,
    setIsLoading,
    setFiltrosVendedores,
    setFiltrosCartelas,
    setFiltrosAtribuicoes,
    setFiltrosVendas,
    addSorteio,
    updateSorteio,
    deleteSorteio,
    addVendedor,
    updateVendedor,
    deleteVendedor,
    addAtribuicao,
    addCartelasToAtribuicao,
    removeCartelaFromAtribuicao,
    updateCartelaStatusInAtribuicao,
    deleteAtribuicao,
    addVenda,
    updateVenda,
    deleteVenda,
    gerarCartelas,
    atualizarStatusCartela
  };
  
  return (
    <BingoContext.Provider value={value}>
      {children}
    </BingoContext.Provider>
  );
};

export const useBingo = () => {
  const context = useContext(BingoContext);
  if (context === undefined) {
    throw new Error('useBingo must be used within a BingoProvider');
  }
  return context;
};
