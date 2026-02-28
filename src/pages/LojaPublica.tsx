import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Loader2, ShoppingCart, Ticket, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { callApi } from '@/lib/apiClient';
import { BingoCardGrid, BINGO_COLS } from '@/lib/utils/bingoCardUtils';
import { LojaCartela } from '@/types/bingo';

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
}> = ({ cartela, onBuy }) => {
  const cardData: BingoCardGrid | null = React.useMemo(() => {
    try { return JSON.parse(cartela.card_data); } catch { return null; }
  }, [cartela.card_data]);

  const firstGrid = cardData?.grids?.[0] ?? null;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col">
      <div className="bg-gradient-to-r from-blue-900 to-blue-700 px-4 py-2 text-center">
        <p className="text-white font-bold text-lg tracking-wide">
          Cartela {String(cartela.numero_cartela).padStart(3, '0')}
        </p>
      </div>
      <div className="p-3 flex-1">
        {firstGrid ? (
          <BingoGridPublic grid={firstGrid} />
        ) : (
          <div className="h-32 flex items-center justify-center text-gray-400 text-sm">
            Grade indisponível
          </div>
        )}
      </div>
      <div className="px-4 pb-4 flex items-center justify-between gap-3">
        <p className="text-green-600 font-bold text-xl">
          {Number(cartela.preco) > 0
            ? `R$ ${Number(cartela.preco).toFixed(2).replace('.', ',')}`
            : 'Grátis'}
        </p>
        <Button onClick={() => onBuy(cartela)} className="gap-2 flex-shrink-0">
          <ShoppingCart className="w-4 h-4" />
          Comprar
        </Button>
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
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const [paymentResult, setPaymentResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Buy modal state
  const [buyingCartela, setBuyingCartela] = useState<LojaCartela | null>(null);
  const [compradorNome, setCompradorNome] = useState('');
  const [compradorEmail, setCompradorEmail] = useState('');
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

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
    callApi('confirmStripeCheckoutCartela', { session_id: sessionId })
      .then((result) => {
        if (result.success) {
          setPaymentResult({ ok: true, message: `Cartela ${String(result.numero_cartela).padStart(3, '0')} comprada com sucesso! Obrigado${result.comprador_nome ? `, ${result.comprador_nome}` : ''}!` });
          // Reload to remove sold card from list
          loadLoja();
        } else {
          setPaymentResult({ ok: false, message: result.error || 'Não foi possível confirmar o pagamento.' });
        }
      })
      .catch((err) => {
        setPaymentResult({ ok: false, message: err.message || 'Erro ao confirmar pagamento.' });
      })
      .finally(() => setConfirmingPayment(false));
  }, [paymentSuccess, sessionId, loadLoja]);

  const handleBuy = (cartela: LojaCartela) => {
    setCheckoutError(null);
    setCompradorNome('');
    setCompradorEmail('');
    setBuyingCartela(cartela);
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

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Payment success/error banner */}
        {confirmingPayment && (
          <div className="mb-6 flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl text-blue-700">
            <Loader2 className="w-5 h-5 animate-spin flex-shrink-0" />
            Confirmando seu pagamento…
          </div>
        )}
        {paymentResult && (
          <div className={`mb-6 flex items-center gap-3 p-4 rounded-xl border ${paymentResult.ok ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
            {paymentResult.ok
              ? <CheckCircle className="w-5 h-5 flex-shrink-0" />
              : <XCircle className="w-5 h-5 flex-shrink-0" />}
            <span className="font-medium">{paymentResult.message}</span>
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
            <p className="text-center text-gray-600 mb-6 text-lg">
              {cartelas.length} {cartelas.length === 1 ? 'cartela disponível' : 'cartelas disponíveis'}
            </p>
            <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {cartelas.map((c) => (
                <CartelaCard key={c.id} cartela={c} onBuy={handleBuy} />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Buy modal */}
      <Dialog open={!!buyingCartela} onOpenChange={(open) => { if (!open) setBuyingCartela(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              Comprar Cartela {buyingCartela && String(buyingCartela.numero_cartela).padStart(3, '0')}
            </DialogTitle>
          </DialogHeader>
          {buyingCartela && (
            <div className="space-y-4">
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
    </div>
  );
};

export default LojaPublica;
