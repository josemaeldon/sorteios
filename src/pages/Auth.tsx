import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Ticket, Loader2, ShieldCheck, LogIn } from 'lucide-react';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('Email inválido').max(255),
  senha: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres').max(100),
});

const setupSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100),
  email: z.string().email('Email inválido').max(255),
  senha: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres').max(100),
  confirmarSenha: z.string(),
}).refine((data) => data.senha === data.confirmarSenha, {
  message: "As senhas não coincidem",
  path: ["confirmarSenha"],
});

const Auth: React.FC = () => {
  const navigate = useNavigate();
  const { login, isAuthenticated, isLoading, checkFirstAccess, setupAdmin } = useAuth();
  
  const [isFirstAccess, setIsFirstAccess] = useState<boolean | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Login form
  const [loginData, setLoginData] = useState({ email: '', senha: '' });
  
  // Setup admin form
  const [setupData, setSetupData] = useState({ nome: '', email: '', senha: '', confirmarSenha: '' });

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    const checkFirst = async () => {
      const isFirst = await checkFirstAccess();
      setIsFirstAccess(isFirst);
    };
    checkFirst();
  }, [checkFirstAccess]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    
    try {
      loginSchema.parse(loginData);
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
    
    setIsSubmitting(true);
    const result = await login(loginData);
    setIsSubmitting(false);
    
    if (!result.success) {
      setErrors({ form: result.error || 'Erro ao fazer login' });
    }
  };

  const handleSetupAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    
    try {
      setupSchema.parse(setupData);
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
    
    setIsSubmitting(true);
    const result = await setupAdmin(setupData.email, setupData.senha, setupData.nome);
    setIsSubmitting(false);
    
    if (!result.success) {
      setErrors({ form: result.error || 'Erro ao criar administrador' });
    }
  };

  if (isLoading || isFirstAccess === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="gradient-primary p-4 rounded-2xl">
              <Ticket className="h-10 w-10 text-primary-foreground" />
            </div>
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">
              {isFirstAccess ? 'Configuração Inicial' : 'Bingo Manager'}
            </CardTitle>
            <CardDescription className="mt-2">
              {isFirstAccess 
                ? 'Configure o administrador do sistema' 
                : 'Entre com suas credenciais para continuar'
              }
            </CardDescription>
          </div>
        </CardHeader>
        
        <CardContent>
          {errors.form && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
              {errors.form}
            </div>
          )}
          
          {isFirstAccess ? (
            <form onSubmit={handleSetupAdmin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome</Label>
                <Input
                  id="nome"
                  type="text"
                  placeholder="Seu nome completo"
                  value={setupData.nome}
                  onChange={(e) => setSetupData({ ...setupData, nome: e.target.value })}
                  disabled={isSubmitting}
                />
                {errors.nome && <p className="text-destructive text-sm">{errors.nome}</p>}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@exemplo.com"
                  value={setupData.email}
                  onChange={(e) => setSetupData({ ...setupData, email: e.target.value })}
                  disabled={isSubmitting}
                />
                {errors.email && <p className="text-destructive text-sm">{errors.email}</p>}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="senha">Senha</Label>
                <Input
                  id="senha"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={setupData.senha}
                  onChange={(e) => setSetupData({ ...setupData, senha: e.target.value })}
                  disabled={isSubmitting}
                />
                {errors.senha && <p className="text-destructive text-sm">{errors.senha}</p>}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirmarSenha">Confirmar Senha</Label>
                <Input
                  id="confirmarSenha"
                  type="password"
                  placeholder="Repita a senha"
                  value={setupData.confirmarSenha}
                  onChange={(e) => setSetupData({ ...setupData, confirmarSenha: e.target.value })}
                  disabled={isSubmitting}
                />
                {errors.confirmarSenha && <p className="text-destructive text-sm">{errors.confirmarSenha}</p>}
              </div>
              
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <ShieldCheck className="h-4 w-4 mr-2" />
                )}
                Criar Administrador
              </Button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={loginData.email}
                  onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                  disabled={isSubmitting}
                />
                {errors.email && <p className="text-destructive text-sm">{errors.email}</p>}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="senha">Senha</Label>
                <Input
                  id="senha"
                  type="password"
                  placeholder="Sua senha"
                  value={loginData.senha}
                  onChange={(e) => setLoginData({ ...loginData, senha: e.target.value })}
                  disabled={isSubmitting}
                />
                {errors.senha && <p className="text-destructive text-sm">{errors.senha}</p>}
              </div>
              
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <LogIn className="h-4 w-4 mr-2" />
                )}
                Entrar
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
