import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, User, Loader2, Save, Camera, X, Lock, Mail, Type } from 'lucide-react';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { isSelfhostedMode } from '@/lib/apiClient';

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
  const { user, updateProfile, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPasswordFields, setShowPasswordFields] = useState(false);
  
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

    if (isSelfhostedMode()) {
      toast({
        title: "Indisponível",
        description: "Upload de avatar não está habilitado nesta instalação.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      const { supabase } = await import('@/integrations/supabase/client');
      if (!supabase) {
        throw new Error('Serviço de armazenamento não está configurado.');
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${user?.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      setFormData(prev => ({ ...prev, avatar_url: publicUrl }));

      toast({
        title: "Imagem carregada",
        description: "Clique em Salvar para confirmar as alterações.",
      });
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: "Erro ao carregar imagem",
        description: error.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
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

      <main className="container mx-auto p-6 max-w-2xl">
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
      </main>
    </div>
  );
};

export default Profile;
