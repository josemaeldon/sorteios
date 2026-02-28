import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Plan } from '@/types/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Ticket, Loader2, LogOut, CheckCircle } from 'lucide-react';

const Planos: React.FC = () => {
  const navigate = useNavigate();
  const { getPublicPlanos, logout, user } = useAuth();
  const [planos, setPlanos] = useState<Plan[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // If user already has access, redirect to home
    if (user?.role === 'admin' || user?.gratuidade_vitalicia || user?.plano_id) {
      navigate('/', { replace: true });
      return;
    }
    const load = async () => {
      const data = await getPublicPlanos();
      setPlanos(data);
      setIsLoading(false);
    };
    load();
  }, [user, navigate, getPublicPlanos]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <div className="gradient-primary p-4 rounded-2xl">
              <Ticket className="h-10 w-10 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-2xl font-bold">Assinatura de Plano Necessária</h1>
          <p className="text-muted-foreground">
            Olá, <strong>{user?.nome}</strong>! Para utilizar o sistema, você precisa ter um plano ativo.<br />
            Entre em contato com o administrador para assinar um dos planos disponíveis abaixo.
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : planos.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Nenhum plano disponível no momento. Entre em contato com o administrador.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {planos.map((plano) => (
              <Card key={plano.id} className="border-2">
                <CardHeader>
                  <CardTitle className="text-lg">{plano.nome}</CardTitle>
                  {plano.descricao && (
                    <CardDescription>{plano.descricao}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-2xl font-bold text-primary">
                    {(() => {
                      const valor = Number(plano.valor);
                      return valor > 0 ? `R$ ${valor.toFixed(2).replace('.', ',')}` : 'Gratuito';
                    })()}
                  </p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>Acesso completo ao sistema</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="text-center">
          <Button variant="outline" onClick={logout}>
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Planos;
