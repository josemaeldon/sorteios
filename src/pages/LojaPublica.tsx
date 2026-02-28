import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Loader2, ShoppingCart, Ticket, CheckCircle, XCircle, Download, ChevronDown, ChevronUp, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { callApi } from '@/lib/apiClient';
import { BingoCardGrid, CanvasLayout, BINGO_COLS, exportBingoCardsPDF, BuyerData, BUYER_ELEMENT_LABELS } from '@/lib/utils/bingoCardUtils';
import { LojaCartela } from '@/types/bingo';

const CART_MAX_ITEMS = 20;

/** Returns the set of buyer element types present in the layout */
function detectBuyerFields(layoutData: string): Set<string> {
  try {
    const layout: CanvasLayout = JSON.parse(layoutData);
    return new Set(layout.elements.map(e => e.type).filter(t => t.startsWith('buyer_')));
  } catch {
    return new Set();
  }
}

// ─── Bingo card renderer for the public page ─────────────────────────────────
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
const LojaPublica: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const [searchParams] = useSearchParams();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [owner, setOwner] = useState<{ nome: string; titulo_sistema: string } | null>(null);
  const [cartelas, setCartelas] = useState<LojaCartela[]>([]);

  // Payment confirmation state
  const paymentSuccess = searchParams.get('payment') === 'success';
  const sessionId = searchParams.get('session_id');
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

  // Derived cart data
  const cartItems = React.useMemo(
    () => cartelas.filter(c => cartIds.has(c.id)),
    [cartelas, cartIds]
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

  const loadLoja = useCallback(async () => {
    if (!userId) return;
    try {
      const result = await callApi('getLojaPublica', { user_id: userId });
      setOwner(result.owner);
      setCartelas(result.cartelas || []);
    } catch (err: any) {
      setError(err.message || 'Loja não encontrada.');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // Load store
  useEffect(() => {
    loadLoja();
  }, [loadLoja]);

  // Confirm payment after Stripe redirect
  useEffect(() => {
    if (!paymentSuccess || !sessionId) return;
    setConfirmingPayment(true);
    if (checkoutType === 'multi') {
      callApi('confirmStripeCheckoutMultiCartela', { session_id: sessionId })
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
      callApi('confirmStripeCheckoutCartela', { session_id: sessionId })
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
  }, [paymentSuccess, sessionId, checkoutType, loadLoja]);

  const handleDownloadCartela = async () => {
    if (!purchasedCardData) return;
    setIsDownloading(true);
    try {
      const card: BingoCardGrid = JSON.parse(purchasedCardData.cardData);
      const layout: CanvasLayout = JSON.parse(purchasedCardData.layoutData);
      await exportBingoCardsPDF([card], layout, `cartela-${purchasedCardData.numeroCartela}`, purchasedCardData.buyerData);
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
      await exportBingoCardsPDF(cards, layout, `cartelas-${nums}`, purchasedMultiData.buyerData);
    } catch (err) {
      console.error('Download error:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleBuy = (cartela: LojaCartela) => {
    setCheckoutError(null);
    setCompradorNome('');
    setCompradorEmail('');
    setCompradorEndereco('');
    setCompradorCidade('');
    setCompradorTelefone('');
    setBuyingCartela(cartela);
  };

  const handleToggleCart = (cartela: LojaCartela) => {
    setCartIds(prev => {
      const next = new Set(prev);
      if (next.has(cartela.id)) {
        next.delete(cartela.id);
      } else {
        if (next.size >= CART_MAX_ITEMS) return prev; // limit reached
        next.add(cartela.id);
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
      const result = await callApi('createStripeCheckoutCartela', {
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
      const result = await callApi('createStripeCheckoutMultiCartela', {
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
        ) : cartelas.length === 0 ? (
          <div className="text-center py-16">
            <Ticket className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-xl font-semibold text-gray-600">Nenhuma cartela disponível</p>
            <p className="text-gray-400 mt-2">Volte em breve para ver novas cartelas.</p>
          </div>
        ) : (
          <>
            <p className="text-center text-gray-600 mb-2 text-lg">
              {cartelas.length} {cartelas.length === 1 ? 'cartela disponível' : 'cartelas disponíveis'}
            </p>
            <p className="text-center text-gray-400 mb-6 text-sm">
              Clique no número da cartela para ver os 25 números. Use o ícone <ShoppingCart className="w-3 h-3 inline" /> para adicionar várias ao carrinho.
            </p>
            <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {cartelas.map((c) => (
                <CartelaCard
                  key={c.id}
                  cartela={c}
                  onBuy={handleBuy}
                  inCart={cartIds.has(c.id)}
                  onToggleCart={handleToggleCart}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Floating cart bar */}
      {cartIds.size > 0 && (
        <div className="fixed bottom-6 inset-x-0 flex justify-center z-30 px-4">
          <div className="bg-blue-900 text-white rounded-full shadow-xl px-6 py-3 flex items-center gap-4 max-w-lg w-full sm:w-auto">
            <ShoppingCart className="w-5 h-5 flex-shrink-0" />
            <span className="font-semibold flex-1 sm:flex-none">
              {cartIds.size} {cartIds.size === 1 ? 'cartela' : 'cartelas'} — R$ {cartTotal.toFixed(2).replace('.', ',')}
            </span>
            <Button
              className="bg-white text-blue-900 hover:bg-blue-50 rounded-full h-8 px-4 text-sm font-bold flex-shrink-0"
              onClick={() => {
                setCartCompradorNome('');
                setCartCompradorEmail('');
                setCartCompradorEndereco('');
                setCartCompradorCidade('');
                setCartCompradorTelefone('');
                setCartCheckoutError(null);
                setShowCartModal(true);
              }}
            >
              Finalizar Compra
            </Button>
            <button
              className="text-white/70 hover:text-white flex-shrink-0"
              onClick={() => setCartIds(new Set())}
              title="Limpar carrinho"
            >
              <X className="w-4 h-4" />
            </button>
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
                  <span className="font-medium">Cartela {String(c.numero_cartela).padStart(3, '0')}</span>
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
    </div>
  );
};

export default LojaPublica;
