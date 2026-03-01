import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Loader2, ShoppingCart, Ticket, CheckCircle, XCircle, Download, ChevronDown, ChevronUp, X, LogIn, LogOut, UserPlus, History, Eye, EyeOff, Calendar, UserCog, Trash2, Camera } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { callApi } from '@/lib/apiClient';
import { BingoCardGrid, CanvasLayout, BINGO_COLS, exportBingoCardsPDF, BuyerData, BUYER_ELEMENT_LABELS } from '@/lib/utils/bingoCardUtils';
import { LojaCartela } from '@/types/bingo';

const CART_MAX_ITEMS = 20;
const MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

const COMPRADOR_TOKEN_KEY = 'loja_comprador_token';
const COMPRADOR_INFO_KEY = 'loja_comprador_info';

/** Returns the set of buyer element types present in the layout */
function detectBuyerFields(layoutData: string): Set<string> {
  try {
    const layout: CanvasLayout = JSON.parse(layoutData);
    return new Set(layout.elements.map(e => e.type).filter(t => t.startsWith('buyer_')));
  } catch {
    return new Set();
  }
}

const BingoGridPublic: React.FC<{ grid: number[][] }> = ({ grid }) => (
  <div className="grid gap-0.5" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
    {BINGO_COLS.map((col) => (
      <div
        key={col}
        className="flex items-center justify-center text-xs font-bold rounded-sm py-1"
        style={{ background: '#1e3a8a', color: '#fff' }}
      >
        {col}
      </div>
    ))}
    {grid.flatMap((row, ri) =>
      row.map((num, ci) => (
        <div
          key={`${ri}-${ci}`}
          className="flex items-center justify-center text-xs font-semibold rounded-sm py-1 border border-gray-200 bg-white"
        >
          {num === 0 ? <span className="text-gray-400 text-[10px]">★</span> : num}
        </div>
      ))
    )}
  </div>
);

// ─── Individual card card ─────────────────────────────────────────────────────
const CartelaCard: React.FC<{
  cartela: LojaCartela;
  onBuy: (cartela: LojaCartela) => void;
  inCart: boolean;
  onToggleCart: (cartela: LojaCartela) => void;
}> = ({ cartela, onBuy, inCart, onToggleCart }) => {
  const [revealed, setRevealed] = useState(false);

  const cardData: BingoCardGrid | null = React.useMemo(() => {
    try { return JSON.parse(cartela.card_data); } catch { return null; }
  }, [cartela.card_data]);

  const firstGrid = cardData?.grids?.[0] ?? null;

  return (
    <div className={`bg-white rounded-2xl border-2 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col ${inCart ? 'border-blue-500 ring-2 ring-blue-300' : 'border-gray-200'}`}>
      {/* Header — click to reveal/hide the grid */}
      <button
        className="w-full bg-gradient-to-r from-blue-900 to-blue-700 px-4 py-3 flex items-center justify-between focus:outline-none"
        onClick={() => setRevealed(r => !r)}
        aria-expanded={revealed}
        title={revealed ? 'Ocultar números' : 'Ver números da cartela'}
      >
        <span className="text-white font-bold text-lg tracking-wide mx-auto">
          Cartela {String(cartela.numero_cartela).padStart(3, '0')}
        </span>
        {revealed
          ? <ChevronUp className="w-4 h-4 text-white/70 flex-shrink-0" />
          : <ChevronDown className="w-4 h-4 text-white/70 flex-shrink-0" />}
      </button>

      {/* Grid — shown only when revealed */}
      {revealed ? (
        <div className="p-3">
          {firstGrid ? (
            <BingoGridPublic grid={firstGrid} />
          ) : (
            <div className="h-32 flex items-center justify-center text-gray-400 text-sm">
              Grade indisponível
            </div>
          )}
        </div>
      ) : (
        <div className="py-3 flex items-center justify-center text-gray-400 text-xs gap-1">
          <ChevronDown className="w-3 h-3" />
          Clique para ver os números
        </div>
      )}

      {/* Footer */}
      <div className="px-4 pb-4 flex items-center justify-between gap-3 mt-auto">
        <p className="text-green-600 font-bold text-xl">
          {Number(cartela.preco) > 0
            ? `R$ ${Number(cartela.preco).toFixed(2).replace('.', ',')}`
            : 'Grátis'}
        </p>
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant={inCart ? 'default' : 'outline'}
            className="h-9 w-9 flex-shrink-0"
            onClick={(e) => { e.stopPropagation(); onToggleCart(cartela); }}
            title={inCart ? 'Remover do carrinho' : 'Adicionar ao carrinho'}
          >
            <ShoppingCart className="w-4 h-4" />
          </Button>
          <Button onClick={() => onBuy(cartela)} className="gap-2 flex-shrink-0">
            Comprar
          </Button>
        </div>
      </div>
    </div>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────

interface CompradorInfo {
  id: string;
  email: string;
  nome: string;
  cpf?: string;
  endereco?: string;
  cidade?: string;
  telefone?: string;
  avatar_url?: string | null;
}

interface HistoricoItem {
  id: string;
  numero_cartela: number;
  preco: number;
  status: string;
  card_data: string;
  layout_data: string;
  comprador_nome?: string;
  store_nome: string;
  store_titulo?: string;
  sorteio_nome?: string;
  data_sorteio?: string;
  updated_at: string;
}

const HistoricoDownloadButton: React.FC<{
  item: HistoricoItem;
  buyerData: BuyerData;
}> = ({ item, buyerData }) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const card: BingoCardGrid = JSON.parse(item.card_data);
      const layout: CanvasLayout = JSON.parse(item.layout_data);
      await exportBingoCardsPDF([card], layout, `cartela-${item.numero_cartela}`, buyerData);
    } catch (err) {
      console.error('Download error:', err);
    } finally {
      setIsDownloading(false);
    }
  };
  return (
    <Button size="sm" variant="outline" onClick={handleDownload} disabled={isDownloading} className="gap-1.5">
      {isDownloading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
      Baixar PDF
    </Button>
  );
};

const LojaPublica: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const [searchParams] = useSearchParams();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [owner, setOwner] = useState<{ nome: string; titulo_sistema: string } | null>(null);
  const [cartelas, setCartelas] = useState<LojaCartela[]>([]);
  const [paymentGateway, setPaymentGateway] = useState<'stripe' | 'mercado_pago'>('stripe');
  // Infinite scroll state
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [totalCartelas, setTotalCartelas] = useState(0);
  const currentPageRef = useRef(1);
  const isFetchingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  // Cart cache: keeps full LojaCartela data for items added to cart across pages
  const [cartCache, setCartCache] = useState<Map<string, LojaCartela>>(new Map());

  // Payment confirmation state
  const paymentSuccess = searchParams.get('payment') === 'success';
  const sessionId = searchParams.get('session_id');
  const mpPaymentId = searchParams.get('payment_id');
  const mpPaymentStatus = searchParams.get('status');
  const gateway = searchParams.get('gateway'); // 'mp' for Mercado Pago
  const checkoutType = searchParams.get('checkout_type'); // 'multi' for multi-cart
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const [paymentResult, setPaymentResult] = useState<{ ok: boolean; message: string } | null>(null);
  // Card data for download after single purchase
  const [purchasedCardData, setPurchasedCardData] = useState<{
    cardData: string; layoutData: string; buyerData: BuyerData; numeroCartela: number;
  } | null>(null);
  // Card data for download after multi-cart purchase
  const [purchasedMultiData, setPurchasedMultiData] = useState<{
    cartelas: Array<{ numero_cartela: number; card_data: string; layout_data: string }>;
    buyerData: BuyerData;
  } | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  // Buy modal state (single card)
  const [buyingCartela, setBuyingCartela] = useState<LojaCartela | null>(null);
  const [compradorNome, setCompradorNome] = useState('');
  const [compradorEmail, setCompradorEmail] = useState('');
  const [compradorEndereco, setCompradorEndereco] = useState('');
  const [compradorCidade, setCompradorCidade] = useState('');
  const [compradorTelefone, setCompradorTelefone] = useState('');
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // Cart state (multi-card)
  const [cartIds, setCartIds] = useState<Set<string>>(new Set());
  const [showCartModal, setShowCartModal] = useState(false);
  const [cartCompradorNome, setCartCompradorNome] = useState('');
  const [cartCompradorEmail, setCartCompradorEmail] = useState('');
  const [cartCompradorEndereco, setCartCompradorEndereco] = useState('');
  const [cartCompradorCidade, setCartCompradorCidade] = useState('');
  const [cartCompradorTelefone, setCartCompradorTelefone] = useState('');
  const [isCartCheckingOut, setIsCartCheckingOut] = useState(false);
  const [cartCheckoutError, setCartCheckoutError] = useState<string | null>(null);

  // Buyer auth state
  const [compradorInfo, setCompradorInfo] = useState<CompradorInfo | null>(null);
  const [compradorToken, setCompradorToken] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authTab, setAuthTab] = useState<'login' | 'cadastro'>('login');
  const [authNome, setAuthNome] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authCpf, setAuthCpf] = useState('');
  const [authEndereco, setAuthEndereco] = useState('');
  const [authCidade, setAuthCidade] = useState('');
  const [authTelefone, setAuthTelefone] = useState('');
  const [authSenha, setAuthSenha] = useState('');
  const [authSenhaVis, setAuthSenhaVis] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  // Password reset state
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetStep, setResetStep] = useState<'email' | 'code'>('email');
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [resetNovaSenha, setResetNovaSenha] = useState('');
  const [resetNovaSenhaVis, setResetNovaSenhaVis] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);
  const [isResetSubmitting, setIsResetSubmitting] = useState(false);
  // Purchase history state
  const [showHistoricoModal, setShowHistoricoModal] = useState(false);
  const [historico, setHistorico] = useState<HistoricoItem[]>([]);
  const [isLoadingHistorico, setIsLoadingHistorico] = useState(false);
  const [isEmailingPDF, setIsEmailingPDF] = useState(false);

  // Edit profile state
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [editNome, setEditNome] = useState('');
  const [editCpf, setEditCpf] = useState('');
  const [editEndereco, setEditEndereco] = useState('');
  const [editCidade, setEditCidade] = useState('');
  const [editTelefone, setEditTelefone] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState<string>('');
  const [editSenhaAtual, setEditSenhaAtual] = useState('');
  const [editNovaSenha, setEditNovaSenha] = useState('');
  const [editNovaSenhaVis, setEditNovaSenhaVis] = useState(false);
  const [editSenhaAtualVis, setEditSenhaAtualVis] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [editProfileError, setEditProfileError] = useState<string | null>(null);
  const [showDeleteAccountConfirm, setShowDeleteAccountConfirm] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Derived cart data — use cartCache so items from other pages are included
  const cartItems = React.useMemo(
    () => Array.from(cartIds).map(id => cartCache.get(id)).filter((c): c is LojaCartela => !!c),
    [cartCache, cartIds]
  );
  const cartTotal = React.useMemo(
    () => cartItems.reduce((sum, c) => sum + Number(c.preco), 0),
    [cartItems]
  );
  const cartBuyerFields = React.useMemo(
    () => cartItems.reduce((fields, c) => {
      if (c.layout_data) {
        detectBuyerFields(c.layout_data).forEach(f => fields.add(f));
      }
      return fields;
    }, new Set<string>()),
    [cartItems]
  );

  // Buyer fields required by the current single card's layout
  const buyerFields = React.useMemo(
    () => buyingCartela?.layout_data ? detectBuyerFields(buyingCartela.layout_data) : new Set<string>(),
    [buyingCartela]
  );

  const loadLoja = useCallback(async (page = 1) => {
    if (!userId) return;
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    if (page === 1) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }
    try {
      const result = await callApi('getLojaPublica', { user_id: userId, page });
      setOwner(result.owner);
      setCartelas(prev => page === 1 ? (result.cartelas || []) : [...prev, ...(result.cartelas || [])]);
      setTotalCartelas(result.total || 0);
      const totalPages = result.total_pages || 1;
      setHasMore(page < totalPages);
      currentPageRef.current = page;
      if (result.payment_gateway) setPaymentGateway(result.payment_gateway);
    } catch (err: any) {
      setError(err.message || 'Loja não encontrada.');
    } finally {
      isFetchingRef.current = false;
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [userId]);

  // Load store
  useEffect(() => {
    loadLoja();
  }, [loadLoja]);

  // Infinite scroll: observe sentinel element
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore) {
          loadLoja(currentPageRef.current + 1);
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadLoja]);

  // Load buyer auth from localStorage
  useEffect(() => {
    const storedToken = localStorage.getItem(COMPRADOR_TOKEN_KEY);
    const storedInfo = localStorage.getItem(COMPRADOR_INFO_KEY);
    if (storedToken && storedInfo) {
      try {
        setCompradorToken(storedToken);
        setCompradorInfo(JSON.parse(storedInfo));
      } catch (e) {
        console.warn('Failed to parse stored buyer info:', e);
      }
    }
  }, []);

  // Confirm payment after redirect (Stripe or Mercado Pago)
  useEffect(() => {
    if (!paymentSuccess) return;

    // Mercado Pago redirect: includes payment_id and status query params
    if (gateway === 'mp' && mpPaymentId && mpPaymentStatus === 'approved') {
      setConfirmingPayment(true);
      if (checkoutType === 'multi') {
        callApi('confirmMercadoPagoCheckoutMultiCartela', { payment_id: mpPaymentId, owner_user_id: userId })
          .then((result) => {
            if (result.success) {
              const count = result.cartelas?.length ?? 0;
              setPaymentResult({ ok: true, message: `${count} ${count === 1 ? 'cartela comprada' : 'cartelas compradas'} com sucesso! Obrigado${result.comprador_nome ? `, ${result.comprador_nome}` : ''}!` });
              if (result.cartelas?.length) {
                setPurchasedMultiData({
                  cartelas: result.cartelas,
                  buyerData: {
                    nome: result.comprador_nome || '',
                    endereco: result.comprador_endereco || '',
                    cidade: result.comprador_cidade || '',
                    telefone: result.comprador_telefone || '',
                  },
                });
              }
              loadLoja();
            } else {
              setPaymentResult({ ok: false, message: result.error || 'Não foi possível confirmar o pagamento.' });
            }
          })
          .catch((err) => {
            setPaymentResult({ ok: false, message: err.message || 'Erro ao confirmar pagamento.' });
          })
          .finally(() => setConfirmingPayment(false));
      } else {
        callApi('confirmMercadoPagoCheckoutCartela', { payment_id: mpPaymentId, owner_user_id: userId })
          .then((result) => {
            if (result.success) {
              setPaymentResult({ ok: true, message: `Cartela ${String(result.numero_cartela).padStart(3, '0')} comprada com sucesso! Obrigado${result.comprador_nome ? `, ${result.comprador_nome}` : ''}!` });
              if (result.card_data && result.layout_data) {
                setPurchasedCardData({
                  cardData: result.card_data,
                  layoutData: result.layout_data,
                  numeroCartela: result.numero_cartela,
                  buyerData: {
                    nome: result.comprador_nome || '',
                    endereco: result.comprador_endereco || '',
                    cidade: result.comprador_cidade || '',
                    telefone: result.comprador_telefone || '',
                  },
                });
              }
              loadLoja();
            } else {
              setPaymentResult({ ok: false, message: result.error || 'Não foi possível confirmar o pagamento.' });
            }
          })
          .catch((err) => {
            setPaymentResult({ ok: false, message: err.message || 'Erro ao confirmar pagamento.' });
          })
          .finally(() => setConfirmingPayment(false));
      }
      return;
    }

    // Stripe redirect: includes session_id query param
    if (!sessionId) return;
    setConfirmingPayment(true);
    if (checkoutType === 'multi') {
      callApi('confirmStripeCheckoutMultiCartela', { session_id: sessionId, owner_user_id: userId })
        .then((result) => {
          if (result.success) {
            const count = result.cartelas?.length ?? 0;
            setPaymentResult({ ok: true, message: `${count} ${count === 1 ? 'cartela comprada' : 'cartelas compradas'} com sucesso! Obrigado${result.comprador_nome ? `, ${result.comprador_nome}` : ''}!` });
            if (result.cartelas?.length) {
              setPurchasedMultiData({
                cartelas: result.cartelas,
                buyerData: {
                  nome: result.comprador_nome || '',
                  endereco: result.comprador_endereco || '',
                  cidade: result.comprador_cidade || '',
                  telefone: result.comprador_telefone || '',
                },
              });
            }
            loadLoja();
          } else {
            setPaymentResult({ ok: false, message: result.error || 'Não foi possível confirmar o pagamento.' });
          }
        })
        .catch((err) => {
          setPaymentResult({ ok: false, message: err.message || 'Erro ao confirmar pagamento.' });
        })
        .finally(() => setConfirmingPayment(false));
    } else {
      callApi('confirmStripeCheckoutCartela', { session_id: sessionId, owner_user_id: userId })
        .then((result) => {
          if (result.success) {
            setPaymentResult({ ok: true, message: `Cartela ${String(result.numero_cartela).padStart(3, '0')} comprada com sucesso! Obrigado${result.comprador_nome ? `, ${result.comprador_nome}` : ''}!` });
            if (result.card_data && result.layout_data) {
              setPurchasedCardData({
                cardData: result.card_data,
                layoutData: result.layout_data,
                numeroCartela: result.numero_cartela,
                buyerData: {
                  nome: result.comprador_nome || '',
                  endereco: result.comprador_endereco || '',
                  cidade: result.comprador_cidade || '',
                  telefone: result.comprador_telefone || '',
                },
              });
            }
            loadLoja();
          } else {
            setPaymentResult({ ok: false, message: result.error || 'Não foi possível confirmar o pagamento.' });
          }
        })
        .catch((err) => {
          setPaymentResult({ ok: false, message: err.message || 'Erro ao confirmar pagamento.' });
        })
        .finally(() => setConfirmingPayment(false));
    }
  }, [paymentSuccess, sessionId, mpPaymentId, mpPaymentStatus, gateway, checkoutType, loadLoja]);

  const handleDownloadCartela = async () => {
    if (!purchasedCardData) return;
    setIsDownloading(true);
    try {
      const card: BingoCardGrid = JSON.parse(purchasedCardData.cardData);
      const layout: CanvasLayout = JSON.parse(purchasedCardData.layoutData);
      const pdfBlob = await exportBingoCardsPDF([card], layout, `cartela-${purchasedCardData.numeroCartela}`, purchasedCardData.buyerData);
      // Email PDF to logged-in buyer
      const emailDest = compradorInfo?.email;
      if (emailDest && pdfBlob) {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          const commaIdx = result.indexOf(',');
          if (commaIdx !== -1) {
            handleEmailPDF(result.slice(commaIdx + 1), emailDest, purchasedCardData.buyerData.nome || '', String(purchasedCardData.numeroCartela));
          }
        };
        reader.readAsDataURL(pdfBlob);
      }
    } catch (err) {
      console.error('Download error:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadMultiCartelas = async () => {
    if (!purchasedMultiData || purchasedMultiData.cartelas.length === 0) return;
    setIsDownloading(true);
    try {
      // Use layout from first card; all cards in the same store typically share the same layout
      const layout: CanvasLayout = JSON.parse(purchasedMultiData.cartelas[0].layout_data);
      const cards: BingoCardGrid[] = purchasedMultiData.cartelas.map(c => JSON.parse(c.card_data));
      const nums = purchasedMultiData.cartelas.map(c => c.numero_cartela).join('-');
      const pdfBlob = await exportBingoCardsPDF(cards, layout, `cartelas-${nums}`, purchasedMultiData.buyerData);
      // Email PDF to logged-in buyer
      const emailDest = compradorInfo?.email;
      if (emailDest && pdfBlob) {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          const commaIdx = result.indexOf(',');
          if (commaIdx !== -1) {
            handleEmailPDF(result.slice(commaIdx + 1), emailDest, purchasedMultiData.buyerData.nome || '', nums.replace(/-/g, ', '));
          }
        };
        reader.readAsDataURL(pdfBlob);
      }
    } catch (err) {
      console.error('Download error:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleBuy = (cartela: LojaCartela) => {
    if (!compradorInfo) {
      setAuthTab('login');
      setAuthError(null);
      setShowAuthModal(true);
      return;
    }
    setCheckoutError(null);
    setCompradorNome(compradorInfo.nome || '');
    setCompradorEmail(compradorInfo.email || '');
    setCompradorEndereco(compradorInfo.endereco || '');
    setCompradorCidade(compradorInfo.cidade || '');
    setCompradorTelefone(compradorInfo.telefone || '');
    setBuyingCartela(cartela);
  };

  const handleToggleCart = (cartela: LojaCartela) => {
    setCartIds(prev => {
      const next = new Set(prev);
      if (next.has(cartela.id)) {
        next.delete(cartela.id);
        setCartCache(m => { const n = new Map(m); n.delete(cartela.id); return n; });
      } else {
        if (next.size >= CART_MAX_ITEMS) {
          // Feedback handled via the floating bar limit message; silently ignore
          return prev;
        }
        next.add(cartela.id);
        setCartCache(m => new Map(m).set(cartela.id, cartela));
      }
      return next;
    });
  };

  const handleCheckout = async () => {
    if (!buyingCartela) return;
    if (!compradorNome.trim()) {
      setCheckoutError('Informe seu nome.');
      return;
    }
    setIsCheckingOut(true);
    setCheckoutError(null);
    try {
      const action = paymentGateway === 'mercado_pago' ? 'createMercadoPagoCheckoutCartela' : 'createStripeCheckoutCartela';
      const result = await callApi(action, {
        loja_cartela_id: buyingCartela.id,
        comprador_nome: compradorNome.trim(),
        comprador_email: compradorEmail.trim() || undefined,
        comprador_endereco: compradorEndereco.trim() || undefined,
        comprador_cidade: compradorCidade.trim() || undefined,
        comprador_telefone: compradorTelefone.trim() || undefined,
        success_path: `/loja/${userId}`,
        cancel_path: `/loja/${userId}`,
      });
      if (result.url) {
        window.location.href = result.url;
      } else {
        setCheckoutError(result.error || 'Erro ao iniciar pagamento.');
      }
    } catch (err: any) {
      setCheckoutError(err.message || 'Erro ao iniciar pagamento.');
    } finally {
      setIsCheckingOut(false);
    }
  };

  const handleCartCheckout = async () => {
    if (cartItems.length === 0) return;
    if (!cartCompradorNome.trim()) {
      setCartCheckoutError('Informe seu nome.');
      return;
    }
    setIsCartCheckingOut(true);
    setCartCheckoutError(null);
    try {
      const multiAction = paymentGateway === 'mercado_pago' ? 'createMercadoPagoCheckoutMultiCartela' : 'createStripeCheckoutMultiCartela';
      const result = await callApi(multiAction, {
        loja_cartela_ids: cartItems.map(c => c.id),
        comprador_nome: cartCompradorNome.trim(),
        comprador_email: cartCompradorEmail.trim() || undefined,
        comprador_endereco: cartCompradorEndereco.trim() || undefined,
        comprador_cidade: cartCompradorCidade.trim() || undefined,
        comprador_telefone: cartCompradorTelefone.trim() || undefined,
        success_path: `/loja/${userId}?payment=success&checkout_type=multi`,
        cancel_path: `/loja/${userId}`,
      });
      if (result.url) {
        window.location.href = result.url;
      } else {
        setCartCheckoutError(result.error || 'Erro ao iniciar pagamento.');
      }
    } catch (err: any) {
      setCartCheckoutError(err.message || 'Erro ao iniciar pagamento.');
    } finally {
      setIsCartCheckingOut(false);
    }
  };

  const handleLogoutComprador = () => {
    setCompradorInfo(null);
    setCompradorToken(null);
    localStorage.removeItem(COMPRADOR_TOKEN_KEY);
    localStorage.removeItem(COMPRADOR_INFO_KEY);
  };

  const handleAuthSubmit = async () => {
    setAuthError(null);
    if (!authEmail.trim() || !authSenha.trim()) {
      setAuthError('Preencha email e senha.');
      return;
    }
    if (authTab === 'cadastro') {
      if (!authNome.trim()) { setAuthError('Informe seu nome.'); return; }
      if (!authCpf.trim()) { setAuthError('Informe seu CPF.'); return; }
      if (!authEndereco.trim()) { setAuthError('Informe seu endereço.'); return; }
      if (!authCidade.trim()) { setAuthError('Informe sua cidade.'); return; }
      if (!authTelefone.trim()) { setAuthError('Informe seu telefone.'); return; }
    }
    setIsAuthSubmitting(true);
    try {
      const action = authTab === 'login' ? 'loginComprador' : 'cadastrarComprador';
      const payload: Record<string, string> = { email: authEmail.trim(), senha: authSenha };
      if (authTab === 'cadastro') {
        payload.nome = authNome.trim();
        payload.cpf = authCpf.trim();
        payload.endereco = authEndereco.trim();
        payload.cidade = authCidade.trim();
        payload.telefone = authTelefone.trim();
      }
      const result = await callApi(action, payload);
      if (result.error) { setAuthError(result.error); return; }
      const info: CompradorInfo = result.comprador;
      setCompradorInfo(info);
      setCompradorToken(result.token);
      localStorage.setItem(COMPRADOR_TOKEN_KEY, result.token);
      localStorage.setItem(COMPRADOR_INFO_KEY, JSON.stringify(info));
      setShowAuthModal(false);
      setAuthNome(''); setAuthEmail(''); setAuthSenha('');
      setAuthCpf(''); setAuthEndereco(''); setAuthCidade(''); setAuthTelefone('');
    } catch (err: any) {
      setAuthError(err.message || 'Erro ao autenticar.');
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  const handleSolicitarRecuperacao = async () => {
    setResetError(null);
    setResetSuccess(null);
    if (!resetEmail.trim()) { setResetError('Informe seu e-mail.'); return; }
    setIsResetSubmitting(true);
    try {
      await callApi('solicitarRecuperacaoSenha', { email: resetEmail.trim() });
      setResetSuccess('Se o e-mail estiver cadastrado, você receberá o código em breve.');
      setResetStep('code');
    } catch (err: any) {
      setResetError(err.message || 'Erro ao solicitar recuperação.');
    } finally {
      setIsResetSubmitting(false);
    }
  };

  const handleResetarSenha = async () => {
    setResetError(null);
    if (!resetCode.trim() || !resetNovaSenha.trim()) { setResetError('Preencha o código e a nova senha.'); return; }
    setIsResetSubmitting(true);
    try {
      const result = await callApi('resetarSenha', { email: resetEmail.trim(), codigo: resetCode.trim(), nova_senha: resetNovaSenha });
      if (result.error) { setResetError(result.error); return; }
      setResetSuccess('Senha alterada com sucesso! Faça login com a nova senha.');
      setTimeout(() => {
        setShowResetModal(false);
        setResetStep('email');
        setResetEmail(''); setResetCode(''); setResetNovaSenha('');
        setResetError(null); setResetSuccess(null);
        setAuthTab('login');
        setShowAuthModal(true);
      }, 1500);
    } catch (err: any) {
      setResetError(err.message || 'Erro ao redefinir senha.');
    } finally {
      setIsResetSubmitting(false);
    }
  };

  const handleLoadHistorico = async () => {
    if (!compradorToken) return;
    setIsLoadingHistorico(true);
    try {
      const result = await callApi('getHistoricoComprador', { token: compradorToken });
      setHistorico(result.data || []);
    } catch (err: any) {
      setHistorico([]);
    } finally {
      setIsLoadingHistorico(false);
    }
  };

  const handleEmailPDF = async (pdfBase64: string, email: string, nome: string, numerosCartelas: string) => {
    if (!email) return;
    setIsEmailingPDF(true);
    try {
      await callApi('emailCartelasPDF', {
        email,
        nome,
        pdf_base64: pdfBase64,
        titulo_loja: owner?.titulo_sistema || owner?.nome || 'Loja de Cartelas',
        numeros_cartelas: numerosCartelas,
      });
    } catch (err) {
      console.error('Failed to email PDF:', err);
    } finally {
      setIsEmailingPDF(false);
    }
  };

  const handleOpenEditProfile = () => {
    if (!compradorInfo) return;
    setEditNome(compradorInfo.nome || '');
    setEditCpf(compradorInfo.cpf || '');
    setEditEndereco(compradorInfo.endereco || '');
    setEditCidade(compradorInfo.cidade || '');
    setEditTelefone(compradorInfo.telefone || '');
    setEditAvatarUrl(compradorInfo.avatar_url || '');
    setEditSenhaAtual('');
    setEditNovaSenha('');
    setEditProfileError(null);
    setShowDeleteAccountConfirm(false);
    setShowEditProfileModal(true);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setEditProfileError('Por favor, selecione uma imagem válida.');
      return;
    }
    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      setEditProfileError('A imagem deve ter no máximo 2MB.');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setEditAvatarUrl(reader.result as string);
      setEditProfileError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async () => {
    if (!compradorToken || !compradorInfo) return;
    if (!editNome.trim()) { setEditProfileError('O nome é obrigatório.'); return; }
    setIsSavingProfile(true);
    setEditProfileError(null);
    try {
      const payload: Record<string, string | null> = {
        token: compradorToken,
        nome: editNome.trim(),
        cpf: editCpf.trim() || null,
        endereco: editEndereco.trim() || null,
        cidade: editCidade.trim() || null,
        telefone: editTelefone.trim() || null,
        avatar_url: editAvatarUrl || null,
      };
      if (editNovaSenha) {
        payload.senha_atual = editSenhaAtual;
        payload.nova_senha = editNovaSenha;
      }
      const result = await callApi('atualizarComprador', payload);
      if (result.error) { setEditProfileError(result.error); return; }
      const updatedInfo: CompradorInfo = { ...compradorInfo, ...result.comprador };
      setCompradorInfo(updatedInfo);
      localStorage.setItem(COMPRADOR_INFO_KEY, JSON.stringify(updatedInfo));
      setShowEditProfileModal(false);
    } catch (err: any) {
      setEditProfileError(err.message || 'Erro ao salvar perfil.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!compradorToken) return;
    setIsDeletingAccount(true);
    try {
      await callApi('deletarComprador', { token: compradorToken });
      handleLogoutComprador();
      setShowEditProfileModal(false);
    } catch (err: any) {
      setEditProfileError(err.message || 'Erro ao excluir conta.');
    } finally {
      setIsDeletingAccount(false);
      setShowDeleteAccountConfirm(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-900 to-blue-700 text-white py-10 px-4 text-center shadow-lg">
        <div className="flex justify-center mb-3">
          <div className="bg-white/20 p-3 rounded-2xl">
            <Ticket className="w-10 h-10" />
          </div>
        </div>
        {owner ? (
          <>
            <h1 className="text-3xl font-bold">{owner.titulo_sistema || owner.nome}</h1>
            <p className="text-blue-200 mt-1 text-lg">Compre sua cartela de bingo online</p>
            {/* Buyer auth buttons */}
            <div className="flex justify-center gap-2 mt-4 flex-wrap">
              {compradorInfo ? (
                <>
                  {compradorInfo.avatar_url && (
                    <img
                      src={compradorInfo.avatar_url}
                      alt={compradorInfo.nome}
                      className="w-8 h-8 rounded-full object-cover border-2 border-white/50 self-center"
                    />
                  )}
                  <button
                    className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-sm font-medium rounded-full px-4 py-1.5 transition-colors"
                    onClick={() => { handleLoadHistorico(); setShowHistoricoModal(true); }}
                  >
                    <History className="w-4 h-4" />
                    Minhas Cartelas
                  </button>
                  <button
                    className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-sm font-medium rounded-full px-4 py-1.5 transition-colors"
                    onClick={handleOpenEditProfile}
                  >
                    <UserCog className="w-4 h-4" />
                    Meu Perfil
                  </button>
                  <button
                    className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white/80 hover:text-white text-sm rounded-full px-3 py-1.5 transition-colors"
                    onClick={handleLogoutComprador}
                    title={`Sair (${compradorInfo.nome})`}
                  >
                    <LogOut className="w-4 h-4" />
                    Sair
                  </button>
                </>
              ) : (
                <button
                  className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-sm font-medium rounded-full px-4 py-1.5 transition-colors"
                  onClick={() => { setAuthTab('login'); setAuthError(null); setShowAuthModal(true); }}
                >
                  <LogIn className="w-4 h-4" />
                  Entrar / Cadastrar
                </button>
              )}
            </div>
          </>
        ) : (
          <h1 className="text-3xl font-bold">Loja de Cartelas</h1>
        )}
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 pb-28">
        {/* Payment success/error banner */}
        {confirmingPayment && (
          <div className="mb-6 flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl text-blue-700">
            <Loader2 className="w-5 h-5 animate-spin flex-shrink-0" />
            Confirmando seu pagamento…
          </div>
        )}
        {paymentResult && (
          <div className={`mb-6 p-4 rounded-xl border ${paymentResult.ok ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
            <div className="flex items-center gap-3">
              {paymentResult.ok
                ? <CheckCircle className="w-5 h-5 flex-shrink-0" />
                : <XCircle className="w-5 h-5 flex-shrink-0" />}
              <span className="font-medium">{paymentResult.message}</span>
            </div>
            {paymentResult.ok && (purchasedCardData || purchasedMultiData) && (
              <div className="mt-3">
                <Button
                  onClick={purchasedMultiData ? handleDownloadMultiCartelas : handleDownloadCartela}
                  disabled={isDownloading}
                  className="gap-2 bg-green-600 hover:bg-green-700 text-white"
                >
                  {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  {purchasedMultiData
                    ? `Baixar ${purchasedMultiData.cartelas.length} cartelas (PDF)`
                    : 'Baixar minha cartela (PDF)'}
                </Button>
              </div>
            )}
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-10 h-10 animate-spin text-blue-700" />
          </div>
        ) : error ? (
          <div className="text-center py-16">
            <XCircle className="w-16 h-16 mx-auto mb-4 text-red-400" />
            <p className="text-xl font-semibold text-gray-700">Loja não encontrada</p>
            <p className="text-gray-500 mt-2">{error}</p>
          </div>
        ) : totalCartelas === 0 ? (
          <div className="text-center py-16">
            <Ticket className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-xl font-semibold text-gray-600">Nenhuma cartela disponível</p>
            <p className="text-gray-400 mt-2">Volte em breve para ver novas cartelas.</p>
          </div>
        ) : (
          <>
            <p className="text-center text-gray-600 mb-2 text-lg">
              {totalCartelas} {totalCartelas === 1 ? 'cartela disponível' : 'cartelas disponíveis'}
            </p>
            <p className="text-center text-gray-400 mb-6 text-sm">
              Clique no número da cartela para ver os 25 números. Use o ícone <ShoppingCart className="w-3 h-3 inline" /> para adicionar várias ao carrinho.
            </p>
            {/* Group cartelas by sorteio */}
            {(() => {
              const groups: { sorteio_id: string; sorteio_nome: string; data_sorteio?: string; cartelas: LojaCartela[] }[] = [];
              const groupMap = new Map<string, number>();
              for (const c of cartelas) {
                const key = c.sorteio_id || '';
                if (!groupMap.has(key)) {
                  groupMap.set(key, groups.length);
                  groups.push({ sorteio_id: key, sorteio_nome: c.sorteio_nome || 'Sorteio sem nome', data_sorteio: c.data_sorteio, cartelas: [] });
                }
                groups[groupMap.get(key)!].cartelas.push(c);
              }
              const multipleGroups = groups.length > 1;
              return groups.map((group) => (
                <div key={group.sorteio_id} className={multipleGroups ? 'mb-10' : ''}>
                  {multipleGroups && (
                    <div className="flex items-center gap-3 mb-4 pb-2 border-b-2 border-blue-100">
                      <Ticket className="w-5 h-5 text-blue-700 flex-shrink-0" />
                      <div>
                        <h2 className="text-xl font-bold text-blue-900">{group.sorteio_nome}</h2>
                        {group.data_sorteio && (
                          <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                            <Calendar className="w-3.5 h-3.5" />
                            {new Date(group.data_sorteio).toLocaleDateString('pt-BR')}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                    {group.cartelas.map((c) => (
                      <CartelaCard
                        key={c.id}
                        cartela={c}
                        onBuy={handleBuy}
                        inCart={cartIds.has(c.id)}
                        onToggleCart={handleToggleCart}
                      />
                    ))}
                  </div>
                </div>
              ));
            })()}
            {/* Infinite scroll sentinel + loading indicator */}
            <div ref={sentinelRef} className="flex justify-center mt-8">
              {isLoadingMore && (
                <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
              )}
            </div>
          </>
        )}
      </div>

      {/* Floating cart bar */}
      {cartIds.size > 0 && (
        <div className="fixed bottom-6 inset-x-0 flex justify-center z-30 px-4">
          <div className="bg-blue-900 text-white rounded-2xl shadow-xl px-6 py-3 flex flex-col items-center gap-2 max-w-lg w-full sm:w-auto sm:rounded-full sm:flex-row sm:gap-4">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <ShoppingCart className="w-5 h-5 flex-shrink-0" />
              <span className="font-semibold flex-1 sm:flex-none">
                {cartIds.size} {cartIds.size === 1 ? 'cartela' : 'cartelas'} — R$ {cartTotal.toFixed(2).replace('.', ',')}
              </span>
              {cartIds.size >= CART_MAX_ITEMS && (
                <span className="text-yellow-300 text-xs">(limite atingido)</span>
              )}
            </div>
            <div className="flex items-center gap-3 w-full sm:justify-end">
              <Button
                className="bg-white text-blue-900 hover:bg-blue-50 rounded-full h-8 px-4 text-sm font-bold flex-shrink-0"
                onClick={() => {
                  if (!compradorInfo) {
                    setAuthTab('login');
                    setAuthError(null);
                    setShowAuthModal(true);
                    return;
                  }
                  setCartCompradorNome(compradorInfo.nome || '');
                  setCartCompradorEmail(compradorInfo.email || '');
                  setCartCompradorEndereco(compradorInfo.endereco || '');
                  setCartCompradorCidade(compradorInfo.cidade || '');
                  setCartCompradorTelefone(compradorInfo.telefone || '');
                  setCartCheckoutError(null);
                  setShowCartModal(true);
                }}
              >
                Finalizar Compra
              </Button>
              <button
                className="text-white/70 hover:text-white flex-shrink-0"
                onClick={() => { setCartIds(new Set()); setCartCache(new Map()); }}
                title="Limpar carrinho"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Single buy modal */}
      <Dialog open={!!buyingCartela} onOpenChange={(open) => { if (!open) setBuyingCartela(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              Comprar Cartela {buyingCartela && String(buyingCartela.numero_cartela).padStart(3, '0')}
            </DialogTitle>
          </DialogHeader>
          {buyingCartela && (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {buyingCartela.sorteio_nome && (
                <p className="text-sm text-blue-700 font-medium text-center bg-blue-50 rounded-lg py-1.5 px-3">
                  {buyingCartela.sorteio_nome}
                </p>
              )}
              <p className="text-2xl font-bold text-green-600 text-center">
                R$ {Number(buyingCartela.preco).toFixed(2).replace('.', ',')}
              </p>
              <div className="space-y-1.5">
                <Label>Seu nome *</Label>
                <Input
                  value={compradorNome}
                  onChange={(e) => setCompradorNome(e.target.value)}
                  placeholder="Nome completo"
                />
              </div>
              <div className="space-y-1.5">
                <Label>E-mail (opcional)</Label>
                <Input
                  type="email"
                  value={compradorEmail}
                  onChange={(e) => setCompradorEmail(e.target.value)}
                  placeholder="seu@email.com"
                />
              </div>
              {buyerFields.has('buyer_address') && (
                <div className="space-y-1.5">
                  <Label>Endereço</Label>
                  <Input
                    value={compradorEndereco}
                    onChange={(e) => setCompradorEndereco(e.target.value)}
                    placeholder="Rua, número, complemento"
                  />
                </div>
              )}
              {buyerFields.has('buyer_city') && (
                <div className="space-y-1.5">
                  <Label>Cidade</Label>
                  <Input
                    value={compradorCidade}
                    onChange={(e) => setCompradorCidade(e.target.value)}
                    placeholder="Sua cidade"
                  />
                </div>
              )}
              {buyerFields.has('buyer_phone') && (
                <div className="space-y-1.5">
                  <Label>Telefone</Label>
                  <Input
                    type="tel"
                    value={compradorTelefone}
                    onChange={(e) => setCompradorTelefone(e.target.value)}
                    placeholder="(00) 00000-0000"
                  />
                </div>
              )}
              {(buyerFields.size > 0) && (
                <p className="text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded px-2 py-1.5">
                  Seus dados serão impressos na cartela para download após o pagamento.
                </p>
              )}
              {checkoutError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {checkoutError}
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setBuyingCartela(null)}>Cancelar</Button>
            <Button onClick={handleCheckout} disabled={isCheckingOut} className="gap-2">
              {isCheckingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />}
              Pagar com cartão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Multi-cart checkout modal */}
      <Dialog open={showCartModal} onOpenChange={(open) => { if (!open) setShowCartModal(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              Finalizar Compra ({cartItems.length} {cartItems.length === 1 ? 'cartela' : 'cartelas'})
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            {/* Cart summary */}
            <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 bg-gray-50">
              {cartItems.map(c => (
                <div key={c.id} className="flex justify-between items-center px-3 py-2 text-sm">
                  <div>
                    <span className="font-medium">Cartela {String(c.numero_cartela).padStart(3, '0')}</span>
                    {c.sorteio_nome && (
                      <p className="text-xs text-gray-500 mt-0.5">{c.sorteio_nome}</p>
                    )}
                  </div>
                  <span className="font-semibold text-green-600">
                    {Number(c.preco) > 0 ? `R$ ${Number(c.preco).toFixed(2).replace('.', ',')}` : 'Grátis'}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex justify-between items-center font-bold text-lg px-1">
              <span>Total</span>
              <span className="text-green-600">R$ {cartTotal.toFixed(2).replace('.', ',')}</span>
            </div>
            {/* Buyer info */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Seu nome *</Label>
                <Input
                  value={cartCompradorNome}
                  onChange={(e) => setCartCompradorNome(e.target.value)}
                  placeholder="Nome completo"
                />
              </div>
              <div className="space-y-1.5">
                <Label>E-mail (opcional)</Label>
                <Input
                  type="email"
                  value={cartCompradorEmail}
                  onChange={(e) => setCartCompradorEmail(e.target.value)}
                  placeholder="seu@email.com"
                />
              </div>
              {cartBuyerFields.has('buyer_address') && (
                <div className="space-y-1.5">
                  <Label>Endereço</Label>
                  <Input
                    value={cartCompradorEndereco}
                    onChange={(e) => setCartCompradorEndereco(e.target.value)}
                    placeholder="Rua, número, complemento"
                  />
                </div>
              )}
              {cartBuyerFields.has('buyer_city') && (
                <div className="space-y-1.5">
                  <Label>Cidade</Label>
                  <Input
                    value={cartCompradorCidade}
                    onChange={(e) => setCartCompradorCidade(e.target.value)}
                    placeholder="Sua cidade"
                  />
                </div>
              )}
              {cartBuyerFields.has('buyer_phone') && (
                <div className="space-y-1.5">
                  <Label>Telefone</Label>
                  <Input
                    type="tel"
                    value={cartCompradorTelefone}
                    onChange={(e) => setCartCompradorTelefone(e.target.value)}
                    placeholder="(00) 00000-0000"
                  />
                </div>
              )}
              {cartBuyerFields.size > 0 && (
                <p className="text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded px-2 py-1.5">
                  Seus dados serão impressos nas cartelas para download após o pagamento.
                </p>
              )}
              {cartCheckoutError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {cartCheckoutError}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCartModal(false)}>Cancelar</Button>
            <Button onClick={handleCartCheckout} disabled={isCartCheckingOut} className="gap-2">
              {isCartCheckingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />}
              Pagar com cartão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Buyer auth modal */}
      <Dialog open={showAuthModal} onOpenChange={(open) => { if (!open) setShowAuthModal(false); }}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5" />
              Acesso do Comprador
            </DialogTitle>
          </DialogHeader>
          <Tabs value={authTab} onValueChange={(v) => { setAuthTab(v as 'login' | 'cadastro'); setAuthError(null); }}>
            <TabsList className="w-full">
              <TabsTrigger value="login" className="flex-1">
                <LogIn className="w-4 h-4 mr-1.5" /> Entrar
              </TabsTrigger>
              <TabsTrigger value="cadastro" className="flex-1">
                <UserPlus className="w-4 h-4 mr-1.5" /> Cadastrar
              </TabsTrigger>
            </TabsList>
            <TabsContent value="login" className="space-y-3 pt-2">
              <div className="space-y-1.5">
                <Label>E-mail</Label>
                <Input type="email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} placeholder="seu@email.com" />
              </div>
              <div className="space-y-1.5">
                <Label>Senha</Label>
                <div className="relative">
                  <Input type={authSenhaVis ? 'text' : 'password'} value={authSenha} onChange={(e) => setAuthSenha(e.target.value)} placeholder="Sua senha" className="pr-10" />
                  <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" onClick={() => setAuthSenhaVis(v => !v)}>
                    {authSenhaVis ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="text-right">
                <button
                  type="button"
                  className="text-xs text-blue-600 hover:underline"
                  onClick={() => { setShowAuthModal(false); setResetEmail(authEmail); setResetStep('email'); setResetError(null); setResetSuccess(null); setShowResetModal(true); }}
                >
                  Esqueceu a senha?
                </button>
              </div>
            </TabsContent>
            <TabsContent value="cadastro" className="space-y-3 pt-2">
              <div className="space-y-1.5">
                <Label>Nome *</Label>
                <Input value={authNome} onChange={(e) => setAuthNome(e.target.value)} placeholder="Seu nome completo" />
              </div>
              <div className="space-y-1.5">
                <Label>CPF *</Label>
                <Input value={authCpf} onChange={(e) => setAuthCpf(e.target.value)} placeholder="000.000.000-00" />
              </div>
              <div className="space-y-1.5">
                <Label>Endereço *</Label>
                <Input value={authEndereco} onChange={(e) => setAuthEndereco(e.target.value)} placeholder="Rua, número, complemento" />
              </div>
              <div className="space-y-1.5">
                <Label>Cidade *</Label>
                <Input value={authCidade} onChange={(e) => setAuthCidade(e.target.value)} placeholder="Sua cidade" />
              </div>
              <div className="space-y-1.5">
                <Label>E-mail *</Label>
                <Input type="email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} placeholder="seu@email.com" />
              </div>
              <div className="space-y-1.5">
                <Label>Telefone *</Label>
                <Input type="tel" value={authTelefone} onChange={(e) => setAuthTelefone(e.target.value)} placeholder="(00) 00000-0000" />
              </div>
              <div className="space-y-1.5">
                <Label>Senha *</Label>
                <div className="relative">
                  <Input type={authSenhaVis ? 'text' : 'password'} value={authSenha} onChange={(e) => setAuthSenha(e.target.value)} placeholder="Mínimo 6 caracteres" className="pr-10" />
                  <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" onClick={() => setAuthSenhaVis(v => !v)}>
                    {authSenhaVis ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
          {authError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{authError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAuthModal(false)}>Cancelar</Button>
            <Button onClick={handleAuthSubmit} disabled={isAuthSubmitting} className="gap-2">
              {isAuthSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : (authTab === 'login' ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />)}
              {authTab === 'login' ? 'Entrar' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password reset modal */}
      <Dialog open={showResetModal} onOpenChange={(open) => { if (!open) { setShowResetModal(false); setResetStep('email'); setResetError(null); setResetSuccess(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LogIn className="w-5 h-5" />
              Recuperar Senha
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {resetStep === 'email' ? (
              <>
                <p className="text-sm text-gray-500">Informe o e-mail cadastrado. Você receberá um código de 6 dígitos.</p>
                <div className="space-y-1.5">
                  <Label>E-mail</Label>
                  <Input type="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} placeholder="seu@email.com" />
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-500">Digite o código enviado para <strong>{resetEmail}</strong> e escolha uma nova senha.</p>
                <div className="space-y-1.5">
                  <Label>Código de verificação</Label>
                  <Input value={resetCode} onChange={(e) => setResetCode(e.target.value)} placeholder="000000" maxLength={6} />
                </div>
                <div className="space-y-1.5">
                  <Label>Nova senha</Label>
                  <div className="relative">
                    <Input type={resetNovaSenhaVis ? 'text' : 'password'} value={resetNovaSenha} onChange={(e) => setResetNovaSenha(e.target.value)} placeholder="Mínimo 6 caracteres" className="pr-10" />
                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" onClick={() => setResetNovaSenhaVis(v => !v)}>
                      {resetNovaSenhaVis ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <button type="button" className="text-xs text-blue-600 hover:underline" onClick={() => { setResetStep('email'); setResetError(null); setResetSuccess(null); }}>
                  ← Voltar
                </button>
              </>
            )}
            {resetError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{resetError}</p>}
            {resetSuccess && <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{resetSuccess}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResetModal(false)}>Cancelar</Button>
            <Button onClick={resetStep === 'email' ? handleSolicitarRecuperacao : handleResetarSenha} disabled={isResetSubmitting} className="gap-2">
              {isResetSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {resetStep === 'email' ? 'Enviar código' : 'Redefinir senha'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Purchase history modal */}
      <Dialog open={showHistoricoModal} onOpenChange={(open) => { if (!open) setShowHistoricoModal(false); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              Minhas Cartelas — {compradorInfo?.nome}
            </DialogTitle>
          </DialogHeader>
          {isLoadingHistorico ? (
            <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-blue-700" /></div>
          ) : historico.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Ticket className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>Nenhuma cartela encontrada para o email <strong>{compradorInfo?.email}</strong>.</p>
              <p className="text-sm mt-1 text-gray-400">As cartelas aparecem aqui após o pagamento ser confirmado.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {historico.map((item) => (
                <div key={item.id} className="border border-gray-200 rounded-xl p-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-blue-900">Cartela {String(item.numero_cartela).padStart(3, '0')}</p>
                    {item.sorteio_nome && (
                      <p className="text-sm font-medium text-blue-700">{item.sorteio_nome}</p>
                    )}
                    <p className="text-sm text-gray-500">{item.store_titulo || item.store_nome}</p>
                    <p className="text-xs text-gray-400">{new Date(item.updated_at).toLocaleDateString('pt-BR')}</p>
                  </div>
                  <div className="text-right flex flex-col items-end gap-2">
                    <p className="text-green-600 font-bold">
                      {Number(item.preco) > 0 ? `R$ ${Number(item.preco).toFixed(2).replace('.', ',')}` : 'Grátis'}
                    </p>
                    <HistoricoDownloadButton item={item} buyerData={{ nome: compradorInfo?.nome || '', endereco: '', cidade: '', telefone: '' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowHistoricoModal(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit profile modal */}
      <Dialog open={showEditProfileModal} onOpenChange={(open) => { if (!open) { setShowEditProfileModal(false); setShowDeleteAccountConfirm(false); } }}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="w-5 h-5" />
              Meu Perfil
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Avatar */}
            <div className="flex flex-col items-center gap-2">
              <div className="relative">
                {editAvatarUrl ? (
                  <img src={editAvatarUrl} alt="Foto de perfil" className="w-20 h-20 rounded-full object-cover border-2 border-gray-200" />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center border-2 border-gray-200">
                    <span className="text-blue-700 font-bold text-2xl">
                      {editNome ? editNome.charAt(0).toUpperCase() : '?'}
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  className="absolute bottom-0 right-0 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-1.5 shadow"
                  onClick={() => avatarInputRef.current?.click()}
                  title="Alterar foto"
                >
                  <Camera className="w-3.5 h-3.5" />
                </button>
              </div>
              {editAvatarUrl && (
                <button
                  type="button"
                  className="text-xs text-red-500 hover:underline"
                  onClick={() => setEditAvatarUrl('')}
                >
                  Remover foto
                </button>
              )}
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>
            {/* Profile fields */}
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input value={editNome} onChange={(e) => setEditNome(e.target.value)} placeholder="Seu nome completo" />
            </div>
            <div className="space-y-1.5">
              <Label>CPF</Label>
              <Input value={editCpf} onChange={(e) => setEditCpf(e.target.value)} placeholder="000.000.000-00" />
            </div>
            <div className="space-y-1.5">
              <Label>Endereço</Label>
              <Input value={editEndereco} onChange={(e) => setEditEndereco(e.target.value)} placeholder="Rua, número, complemento" />
            </div>
            <div className="space-y-1.5">
              <Label>Cidade</Label>
              <Input value={editCidade} onChange={(e) => setEditCidade(e.target.value)} placeholder="Sua cidade" />
            </div>
            <div className="space-y-1.5">
              <Label>Telefone</Label>
              <Input type="tel" value={editTelefone} onChange={(e) => setEditTelefone(e.target.value)} placeholder="(00) 00000-0000" />
            </div>
            {/* Password change */}
            <div className="border-t border-gray-100 pt-3 space-y-2">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Alterar senha (opcional)</p>
              <div className="space-y-1.5">
                <Label>Senha atual</Label>
                <div className="relative">
                  <Input
                    type={editSenhaAtualVis ? 'text' : 'password'}
                    value={editSenhaAtual}
                    onChange={(e) => setEditSenhaAtual(e.target.value)}
                    placeholder="Senha atual"
                    className="pr-10"
                  />
                  <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" onClick={() => setEditSenhaAtualVis(v => !v)}>
                    {editSenhaAtualVis ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Nova senha</Label>
                <div className="relative">
                  <Input
                    type={editNovaSenhaVis ? 'text' : 'password'}
                    value={editNovaSenha}
                    onChange={(e) => setEditNovaSenha(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="pr-10"
                  />
                  <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" onClick={() => setEditNovaSenhaVis(v => !v)}>
                    {editNovaSenhaVis ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
            {editProfileError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{editProfileError}</p>
            )}
            {/* Delete account */}
            <div className="border-t border-gray-100 pt-3">
              {!showDeleteAccountConfirm ? (
                <button
                  type="button"
                  className="text-sm text-red-500 hover:text-red-700 flex items-center gap-1.5"
                  onClick={() => setShowDeleteAccountConfirm(true)}
                >
                  <Trash2 className="w-4 h-4" />
                  Excluir minha conta
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-red-600 font-medium">Tem certeza? Esta ação não pode ser desfeita.</p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={handleDeleteAccount}
                      disabled={isDeletingAccount}
                      className="gap-1.5"
                    >
                      {isDeletingAccount ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                      Confirmar exclusão
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setShowDeleteAccountConfirm(false)}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditProfileModal(false)}>Cancelar</Button>
            <Button onClick={handleSaveProfile} disabled={isSavingProfile} className="gap-2">
              {isSavingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LojaPublica;
