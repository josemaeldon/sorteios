import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Plan } from '@/types/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, User, Loader2, Save, Camera, X, Lock, Mail, Type, CreditCard, CheckCircle, Settings, Users } from 'lucide-react';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';

interface LojaComprador {
  nome: string;
  email: string;
  cpf?: string;
  telefone?: string;
  cidade?: string;
  endereco?: string;
  total_compras: number;
  ultima_compra: string;
}

const profileSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100),
  email: z.string().email('Email inválido').max(255),
  titulo_sistema: z.string().min(1, 'Título do sistema é obrigatório').max(100),
});

const passwordSchema = z.object({
  senha_atual: z.string().min(6, 'Senha atual é obrigatória'),
  nova_senha: z.string().min(6, 'Nova senha deve ter pelo menos 6 caracteres'),
  confirmar_senha: z.string(),
}).refine((data) => data.nova_senha === data.confirmar_senha, {
  message: "As senhas não coincidem",
  path: ["confirmar_senha"],
});

const Profile: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, updateProfile, isAuthenticated, getPublicPlanos, createStripeCheckout, refreshUser, getUserConfiguracoes, updateUserConfiguracoes, getLojaCompradores } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPasswordFields, setShowPasswordFields] = useState(false);

  // Subscription tab state
  const [planos, setPlanos] = useState<Plan[]>([]);
  const [isLoadingPlanos, setIsLoadingPlanos] = useState(false);
  const [checkoutLoadingId, setCheckoutLoadingId] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const paymentSuccess = searchParams.get('payment') === 'success';
  const defaultTab = searchParams.get('tab') === 'assinatura' ? 'assinatura'
    : searchParams.get('tab') === 'pagamentos' ? 'pagamentos'
    : searchParams.get('tab') === 'clientes' ? 'clientes'
    : 'dados';

  // Payment gateway config state
  const [gatewayConfig, setGatewayConfig] = useState<Record<string, string>>({});
  const [isLoadingGateway, setIsLoadingGateway] = useState(false);
  const [isSavingGateway, setIsSavingGateway] = useState(false);

  // Store clients state
  const [lojaCompradores, setLojaCompradores] = useState<LojaComprador[]>([]);
  const [isLoadingCompradores, setIsLoadingCompradores] = useState(false);

  // After returning from a successful Stripe payment, refresh the user so the
  // new plano_id is reflected in the local state.
  useEffect(() => {
    if (paymentSuccess) {
      refreshUser()
        .then(() => {
          toast({ title: 'Assinatura ativada', description: 'Seu plano foi ativado com sucesso!' });
        })
        .catch(() => {
          toast({ title: 'Plano ativado', description: 'Atualize a página para ver seu plano atualizado.', variant: 'destructive' });
        })
        .finally(() => {
          navigate('/profile?tab=assinatura', { replace: true });
        });
    }
  }, [paymentSuccess, refreshUser, toast, navigate]);
  
  const [formData, setFormData] = useState({
    nome: user?.nome || '',
    email: user?.email || '',
    titulo_sistema: user?.titulo_sistema || 'Sorteios',
    avatar_url: user?.avatar_url || '',
  });
  
  const [passwordData, setPasswordData] = useState({
    senha_atual: '',
    nova_senha: '',
    confirmar_senha: '',
  });

  React.useEffect(() => {
    if (!isAuthenticated) {
      navigate('/auth');
    }
  }, [isAuthenticated, navigate]);

  const loadPlanos = async () => {
    if (planos.length > 0) return;
    setIsLoadingPlanos(true);
    const data = await getPublicPlanos();
    setPlanos(data);
    setIsLoadingPlanos(false);
  };

  const loadGatewayConfig = async () => {
    setIsLoadingGateway(true);
    const cfg = await getUserConfiguracoes();
    setGatewayConfig(cfg);
    setIsLoadingGateway(false);
  };

  const handleSaveGateway = async () => {
    setIsSavingGateway(true);
    const result = await updateUserConfiguracoes(gatewayConfig);
    setIsSavingGateway(false);
    if (!result.success) {
      toast({ title: 'Erro', description: result.error || 'Erro ao salvar configurações.', variant: 'destructive' });
    }
  };

  const loadLojaCompradores = async () => {
    setIsLoadingCompradores(true);
    const data = await getLojaCompradores();
    setLojaCompradores(data);
    setIsLoadingCompradores(false);
  };

  const handleCheckout = async (plano: Plan) => {
    setCheckoutError(null);
    setCheckoutLoadingId(plano.id);
    const result = await createStripeCheckout(
      plano.id,
      '/profile?tab=assinatura&payment=success',
      '/profile?tab=assinatura',
    );
    if (result.url) {
      window.location.href = result.url;
    } else {
      setCheckoutError(result.error || 'Erro ao iniciar checkout. Tente novamente.');
      setCheckoutLoadingId(null);
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: "Erro",
        description: "Por favor, selecione uma imagem válida.",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "Erro",
        description: "A imagem deve ter no máximo 2MB.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      // Convert image to base64 for storage
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setFormData(prev => ({ ...prev, avatar_url: base64String }));
        toast({
          title: "Imagem carregada",
          description: "Clique em Salvar para confirmar as alterações.",
        });
        setIsUploading(false);
      };
      reader.onerror = () => {
        toast({
          title: "Erro ao carregar imagem",
          description: "Tente novamente.",
          variant: "destructive",
        });
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: "Erro ao carregar imagem",
        description: error.message || "Tente novamente.",
        variant: "destructive",
      });
      setIsUploading(false);
    }
  };

  const handleRemoveAvatar = () => {
    setFormData(prev => ({ ...prev, avatar_url: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    
    // Validate profile data
    try {
      profileSchema.parse(formData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            newErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(newErrors);
        return;
      }
    }
    
    // Validate password if changing
    if (showPasswordFields && (passwordData.senha_atual || passwordData.nova_senha || passwordData.confirmar_senha)) {
      try {
        passwordSchema.parse(passwordData);
      } catch (error) {
        if (error instanceof z.ZodError) {
          const newErrors: Record<string, string> = {};
          error.errors.forEach((err) => {
            if (err.path[0]) {
              newErrors[err.path[0] as string] = err.message;
            }
          });
          setErrors(newErrors);
          return;
        }
      }
    }
    
    setIsSubmitting(true);
    
    const updateData: any = {
      nome: formData.nome,
      email: formData.email,
      titulo_sistema: formData.titulo_sistema,
      avatar_url: formData.avatar_url || undefined,
    };
    
    if (showPasswordFields && passwordData.senha_atual && passwordData.nova_senha) {
      updateData.senha_atual = passwordData.senha_atual;
      updateData.nova_senha = passwordData.nova_senha;
    }
    
    const result = await updateProfile(updateData);
    setIsSubmitting(false);
    
    if (result.success) {
      toast({
        title: "Perfil atualizado",
        description: "Suas configurações foram salvas.",
      });
      setPasswordData({ senha_atual: '', nova_senha: '', confirmar_senha: '' });
      setShowPasswordFields(false);
    } else {
      setErrors({ form: result.error || 'Erro ao atualizar perfil' });
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="gradient-header text-primary-foreground py-6 px-6">
        <div className="container mx-auto">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="text-primary-foreground hover:bg-primary-foreground/10"
              onClick={() => navigate('/')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="bg-primary-foreground/20 p-2 rounded-lg">
                <User className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Meu Perfil</h1>
                <p className="text-primary-foreground/80 text-sm">Gerencie suas informações pessoais</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-6 max-w-3xl">
        <Tabs defaultValue={defaultTab}>
          <TabsList className="mb-6 flex flex-wrap h-auto gap-1">
            <TabsTrigger value="dados" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Dados Pessoais
            </TabsTrigger>
            <TabsTrigger value="assinatura" className="flex items-center gap-2" onClick={loadPlanos}>
              <CreditCard className="h-4 w-4" />
              Minha Assinatura
            </TabsTrigger>
            <TabsTrigger value="pagamentos" className="flex items-center gap-2" onClick={loadGatewayConfig}>
              <Settings className="h-4 w-4" />
              Gateway de Pagamento
            </TabsTrigger>
            <TabsTrigger value="clientes" className="flex items-center gap-2" onClick={loadLojaCompradores}>
              <Users className="h-4 w-4" />
              Clientes da Loja
            </TabsTrigger>
          </TabsList>

          {/* ========== DADOS PESSOAIS ========== */}
          <TabsContent value="dados">
        <form onSubmit={handleSubmit} className="space-y-6">
          {errors.form && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
              {errors.form}
            </div>
          )}

          {/* Avatar Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5" />
                Foto de Perfil
              </CardTitle>
              <CardDescription>Sua imagem de identificação no sistema</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="relative">
                  <Avatar className="h-28 w-28 cursor-pointer ring-4 ring-border hover:ring-primary transition-all" onClick={handleAvatarClick}>
                    <AvatarImage src={formData.avatar_url} alt={formData.nome} />
                    <AvatarFallback className="text-3xl bg-primary text-primary-foreground">
                      {formData.nome ? getInitials(formData.nome) : 'U'}
                    </AvatarFallback>
                  </Avatar>
                  
                  {isUploading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-full">
                      <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                  )}
                  
                  <button
                    type="button"
                    onClick={handleAvatarClick}
                    className="absolute bottom-0 right-0 p-2 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 transition-colors shadow-lg"
                    disabled={isUploading}
                  >
                    <Camera className="h-4 w-4" />
                  </button>
                </div>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                
                <div className="flex flex-col gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAvatarClick}
                    disabled={isUploading}
                  >
                    {isUploading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Camera className="h-4 w-4 mr-2" />
                    )}
                    Alterar foto
                  </Button>
                  
                  {formData.avatar_url && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={handleRemoveAvatar}
                      disabled={isUploading}
                      className="text-destructive hover:text-destructive"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Remover foto
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Personal Info Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Informações Pessoais
              </CardTitle>
              <CardDescription>Seus dados básicos de identificação</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome completo</Label>
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    disabled={isSubmitting}
                    placeholder="Seu nome"
                  />
                  {errors.nome && <p className="text-destructive text-sm">{errors.nome}</p>}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      disabled={isSubmitting}
                      placeholder="seu@email.com"
                      className="pl-10"
                    />
                  </div>
                  {errors.email && <p className="text-destructive text-sm">{errors.email}</p>}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* System Preferences Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Type className="h-5 w-5" />
                Preferências do Sistema
              </CardTitle>
              <CardDescription>Personalize sua experiência</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="titulo_sistema">Título do Sistema</Label>
                <Input
                  id="titulo_sistema"
                  value={formData.titulo_sistema}
                  onChange={(e) => setFormData({ ...formData, titulo_sistema: e.target.value })}
                  disabled={isSubmitting}
                  placeholder="Ex: Meus Sorteios"
                />
                <p className="text-sm text-muted-foreground">
                  Este título será exibido no cabeçalho do sistema
                </p>
                {errors.titulo_sistema && <p className="text-destructive text-sm">{errors.titulo_sistema}</p>}
              </div>
            </CardContent>
          </Card>

          {/* Password Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Segurança
              </CardTitle>
              <CardDescription>Altere sua senha de acesso</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!showPasswordFields ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowPasswordFields(true)}
                >
                  <Lock className="h-4 w-4 mr-2" />
                  Alterar senha
                </Button>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="senha_atual">Senha atual</Label>
                    <Input
                      id="senha_atual"
                      type="password"
                      value={passwordData.senha_atual}
                      onChange={(e) => setPasswordData({ ...passwordData, senha_atual: e.target.value })}
                      disabled={isSubmitting}
                      placeholder="Digite sua senha atual"
                    />
                    {errors.senha_atual && <p className="text-destructive text-sm">{errors.senha_atual}</p>}
                  </div>
                  
                  <Separator />
                  
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="nova_senha">Nova senha</Label>
                      <Input
                        id="nova_senha"
                        type="password"
                        value={passwordData.nova_senha}
                        onChange={(e) => setPasswordData({ ...passwordData, nova_senha: e.target.value })}
                        disabled={isSubmitting}
                        placeholder="Mínimo 6 caracteres"
                      />
                      {errors.nova_senha && <p className="text-destructive text-sm">{errors.nova_senha}</p>}
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="confirmar_senha">Confirmar nova senha</Label>
                      <Input
                        id="confirmar_senha"
                        type="password"
                        value={passwordData.confirmar_senha}
                        onChange={(e) => setPasswordData({ ...passwordData, confirmar_senha: e.target.value })}
                        disabled={isSubmitting}
                        placeholder="Repita a nova senha"
                      />
                      {errors.confirmar_senha && <p className="text-destructive text-sm">{errors.confirmar_senha}</p>}
                    </div>
                  </div>
                  
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setShowPasswordFields(false);
                      setPasswordData({ senha_atual: '', nova_senha: '', confirmar_senha: '' });
                      setErrors({});
                    }}
                    className="text-muted-foreground"
                  >
                    Cancelar alteração de senha
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => navigate('/')} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting || isUploading}>
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salvar alterações
            </Button>
          </div>
        </form>
          </TabsContent>

          {/* ========== MINHA ASSINATURA ========== */}
          <TabsContent value="assinatura" className="space-y-6">
            {/* Current plan status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Plano Atual
                </CardTitle>
              </CardHeader>
              <CardContent>
                {user?.gratuidade_vitalicia ? (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-sm px-3 py-1">Gratuidade Vitalícia</Badge>
                    <span className="text-muted-foreground text-sm">Acesso completo sem custo</span>
                  </div>
                ) : user?.plano_id ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <span className="font-medium">Plano ativo</span>
                    </div>
                    {user.plano_vencimento && (
                      <p className="text-sm text-muted-foreground">
                        Válido até: {new Date(user.plano_vencimento).toLocaleDateString('pt-BR')}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">Nenhum plano ativo. Assine um plano abaixo para usar o sistema.</p>
                )}
              </CardContent>
            </Card>

            {/* Plan listing */}
            <div>
              <h3 className="text-lg font-semibold mb-4">
                {user?.plano_id ? 'Alterar Plano' : 'Escolha um Plano'}
              </h3>

              {checkoutError && (
                <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
                  {checkoutError}
                </div>
              )}

              {isLoadingPlanos ? (
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
                  {planos.map((plano) => {
                    const isCurrentPlan = user?.plano_id === plano.id;
                    return (
                      <Card key={plano.id} className={`border-2 flex flex-col ${isCurrentPlan ? 'border-primary' : ''}`}>
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-lg">{plano.nome}</CardTitle>
                            {isCurrentPlan && <Badge>Atual</Badge>}
                          </div>
                          {plano.descricao && (
                            <CardDescription>{plano.descricao}</CardDescription>
                          )}
                        </CardHeader>
                        <CardContent className="space-y-3 flex flex-col flex-1 justify-between">
                          <div className="space-y-2">
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
                          </div>
                          <Button
                            className="w-full mt-2"
                            variant={isCurrentPlan ? 'outline' : 'default'}
                            onClick={() => handleCheckout(plano)}
                            disabled={checkoutLoadingId !== null || isCurrentPlan}
                          >
                            {checkoutLoadingId === plano.id ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : null}
                            {isCurrentPlan ? 'Plano atual' : Number(plano.valor) > 0 ? 'Assinar agora' : 'Ativar plano'}
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>

          {/* ========== GATEWAY DE PAGAMENTO ========== */}
          <TabsContent value="pagamentos" className="space-y-6">
            {isLoadingGateway ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      Gateway de Pagamento
                    </CardTitle>
                    <CardDescription>
                      Configure o gateway de pagamento da sua loja. As configurações são individuais e independentes de outros usuários.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="payment_gateway">Gateway ativo</Label>
                      <select
                        id="payment_gateway"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        value={gatewayConfig['payment_gateway'] || 'stripe'}
                        onChange={(e) => setGatewayConfig(prev => ({ ...prev, payment_gateway: e.target.value }))}
                      >
                        <option value="stripe">Stripe</option>
                        <option value="mercado_pago">Mercado Pago</option>
                      </select>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Stripe</CardTitle>
                    <CardDescription>Chaves da sua conta Stripe para processamento de pagamentos com cartão.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="stripe_secret_key">Chave Secreta (Live)</Label>
                      <Input
                        id="stripe_secret_key"
                        type="password"
                        value={gatewayConfig['stripe_secret_key'] || ''}
                        onChange={(e) => setGatewayConfig(prev => ({ ...prev, stripe_secret_key: e.target.value }))}
                        placeholder="sk_live_..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="stripe_webhook_secret">Webhook Secret (opcional)</Label>
                      <Input
                        id="stripe_webhook_secret"
                        type="password"
                        value={gatewayConfig['stripe_webhook_secret'] || ''}
                        onChange={(e) => setGatewayConfig(prev => ({ ...prev, stripe_webhook_secret: e.target.value }))}
                        placeholder="whsec_..."
                      />
                    </div>
                    <Separator />
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="stripe_sandbox_mode"
                        checked={gatewayConfig['stripe_sandbox_mode'] === 'true'}
                        onChange={(e) => setGatewayConfig(prev => ({ ...prev, stripe_sandbox_mode: e.target.checked ? 'true' : 'false' }))}
                        className="h-4 w-4"
                      />
                      <Label htmlFor="stripe_sandbox_mode">Modo Sandbox (testes)</Label>
                    </div>
                    {gatewayConfig['stripe_sandbox_mode'] === 'true' && (
                      <div className="space-y-2">
                        <Label htmlFor="stripe_sandbox_secret_key">Chave Secreta (Sandbox)</Label>
                        <Input
                          id="stripe_sandbox_secret_key"
                          type="password"
                          value={gatewayConfig['stripe_sandbox_secret_key'] || ''}
                          onChange={(e) => setGatewayConfig(prev => ({ ...prev, stripe_sandbox_secret_key: e.target.value }))}
                          placeholder="sk_test_..."
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Mercado Pago</CardTitle>
                    <CardDescription>Credenciais da sua conta Mercado Pago.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="mp_access_token">Access Token (Live)</Label>
                      <Input
                        id="mp_access_token"
                        type="password"
                        value={gatewayConfig['mp_access_token'] || ''}
                        onChange={(e) => setGatewayConfig(prev => ({ ...prev, mp_access_token: e.target.value }))}
                        placeholder="APP_USR-..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="mp_public_key">Public Key (Live)</Label>
                      <Input
                        id="mp_public_key"
                        value={gatewayConfig['mp_public_key'] || ''}
                        onChange={(e) => setGatewayConfig(prev => ({ ...prev, mp_public_key: e.target.value }))}
                        placeholder="APP_USR-..."
                      />
                    </div>
                    <Separator />
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="mp_sandbox_mode"
                        checked={gatewayConfig['mp_sandbox_mode'] === 'true'}
                        onChange={(e) => setGatewayConfig(prev => ({ ...prev, mp_sandbox_mode: e.target.checked ? 'true' : 'false' }))}
                        className="h-4 w-4"
                      />
                      <Label htmlFor="mp_sandbox_mode">Modo Sandbox (testes)</Label>
                    </div>
                    {gatewayConfig['mp_sandbox_mode'] === 'true' && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="mp_sandbox_access_token">Access Token (Sandbox)</Label>
                          <Input
                            id="mp_sandbox_access_token"
                            type="password"
                            value={gatewayConfig['mp_sandbox_access_token'] || ''}
                            onChange={(e) => setGatewayConfig(prev => ({ ...prev, mp_sandbox_access_token: e.target.value }))}
                            placeholder="TEST-..."
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="mp_sandbox_public_key">Public Key (Sandbox)</Label>
                          <Input
                            id="mp_sandbox_public_key"
                            value={gatewayConfig['mp_sandbox_public_key'] || ''}
                            onChange={(e) => setGatewayConfig(prev => ({ ...prev, mp_sandbox_public_key: e.target.value }))}
                            placeholder="TEST-..."
                          />
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                <div className="flex justify-end">
                  <Button onClick={handleSaveGateway} disabled={isSavingGateway}>
                    {isSavingGateway ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                    Salvar Configurações
                  </Button>
                </div>
              </>
            )}
          </TabsContent>

          {/* ========== CLIENTES DA LOJA ========== */}
          <TabsContent value="clientes" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Clientes da Minha Loja
                </CardTitle>
                <CardDescription>
                  Compradores que adquiriram cartelas na sua loja. Apenas os clientes da sua loja são exibidos.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingCompradores ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : lojaCompradores.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-6">
                    Nenhum cliente encontrado. Os clientes aparecerão aqui após realizarem compras na sua loja.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Nome</th>
                          <th className="text-left py-2 pr-4 font-medium text-muted-foreground">E-mail</th>
                          <th className="text-left py-2 pr-4 font-medium text-muted-foreground">CPF</th>
                          <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Telefone</th>
                          <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Cidade</th>
                          <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Compras</th>
                          <th className="text-left py-2 font-medium text-muted-foreground">Última Compra</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lojaCompradores.map((c, idx) => (
                          <tr key={idx} className="border-b last:border-0 hover:bg-muted/30">
                            <td className="py-2 pr-4">{c.nome || '—'}</td>
                            <td className="py-2 pr-4">{c.email || '—'}</td>
                            <td className="py-2 pr-4">{c.cpf || '—'}</td>
                            <td className="py-2 pr-4">{c.telefone || '—'}</td>
                            <td className="py-2 pr-4">{c.cidade || '—'}</td>
                            <td className="py-2 pr-4">
                              <Badge variant="secondary">{c.total_compras}</Badge>
                            </td>
                            <td className="py-2 text-muted-foreground text-xs">
                              {c.ultima_compra ? new Date(c.ultima_compra).toLocaleDateString('pt-BR') : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Profile;
