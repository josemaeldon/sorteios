import { BingoProvider, useBingo } from '@/contexts/BingoContext';
import Header from '@/components/Header';
import Navigation from '@/components/Navigation';
import SorteiosTab from '@/components/tabs/SorteiosTab';
import DashboardTab from '@/components/tabs/DashboardTab';
import DrawTab from '@/components/tabs/DrawTab';
import VendedoresTab from '@/components/tabs/VendedoresTab';
import CartelasTab from '@/components/tabs/CartelasTab';
import AtribuicoesTab from '@/components/tabs/AtribuicoesTab';
import VendasTab from '@/components/tabs/VendasTab';
import RelatoriosTab from '@/components/tabs/RelatoriosTab';
import BingoCardsBuilderTab from '@/components/tabs/BingoCardsBuilderTab';
import { TabType } from '@/types/bingo';
import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

const TABS_WITHOUT_SORTEIO: TabType[] = ['sorteios'];
const VALID_TABS: TabType[] = [
  'sorteios',
  'dashboard',
  'sorteio',
  'vendedores',
  'cartelas',
  'cartelas-bingo',
  'atribuicoes',
  'vendas',
  'relatorios',
  'rodadas',
];

const isValidTab = (value: string | null): value is TabType => {
  return value !== null && VALID_TABS.includes(value as TabType);
};

const MainContent = () => {
  const { currentTab, setCurrentTab, sorteioAtivo } = useBingo();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const tabFromUrl = searchParams.get('tab');

    if (!isValidTab(tabFromUrl)) {
      if (tabFromUrl !== null) {
        const next = new URLSearchParams(searchParams);
        next.delete('tab');
        setSearchParams(next, { replace: true });
      }
      return;
    }

    const needsSorteio = !TABS_WITHOUT_SORTEIO.includes(tabFromUrl);
    if (needsSorteio && !sorteioAtivo) {
      if (currentTab !== 'sorteios') {
        setCurrentTab('sorteios');
      }
      return;
    }

    if (tabFromUrl !== currentTab) {
      setCurrentTab(tabFromUrl);
    }
  }, [searchParams, setSearchParams, sorteioAtivo, currentTab, setCurrentTab]);

  useEffect(() => {
    const currentUrlTab = searchParams.get('tab');

    // Keep default tab clean without query string.
    if (currentTab === 'sorteios') {
      if (currentUrlTab !== null) {
        const next = new URLSearchParams(searchParams);
        next.delete('tab');
        setSearchParams(next, { replace: true });
      }
      return;
    }

    if (currentUrlTab !== currentTab) {
      const next = new URLSearchParams(searchParams);
      next.set('tab', currentTab);
      setSearchParams(next, { replace: true });
    }
  }, [currentTab, searchParams, setSearchParams]);

  const renderTab = () => {
    switch (currentTab) {
      case 'sorteios': return <SorteiosTab />;
      case 'dashboard': return <DashboardTab />;
      case 'sorteio': return <DrawTab />;
      case 'vendedores': return <VendedoresTab />;
      case 'cartelas': return <CartelasTab />;
      case 'cartelas-bingo': return <BingoCardsBuilderTab />;
      case 'atribuicoes': return <AtribuicoesTab />;
      case 'vendas': return <VendasTab />;
      case 'relatorios': return <RelatoriosTab />;
      default: return <SorteiosTab />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Navigation />
      <main className="container mx-auto px-4 py-8">
        {renderTab()}
      </main>
    </div>
  );
};

const Index = () => {
  return (
    <BingoProvider>
      <MainContent />
    </BingoProvider>
  );
};

export default Index;
