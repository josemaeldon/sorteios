import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, User, Loader2, Save, Camera, X } from 'lucide-react';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const profileSchema = z.object({
  titulo_sistema: z.string().min(1, 'Título do sistema é obrigatório').max(100),
});

const Profile: React.FC = () => {
  const navigate = useNavigate();
  const { user, updateProfile, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    titulo_sistema: user?.titulo_sistema || 'Sorteios',
    avatar_url: user?.avatar_url || '',
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

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Erro",
        description: "Por favor, selecione uma imagem válida.",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 2MB)
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
      const fileExt = file.name.split('.').pop();
      const fileName = `${user?.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
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
    
    setIsSubmitting(true);
    const result = await updateProfile({ 
      titulo_sistema: formData.titulo_sistema,
      avatar_url: formData.avatar_url || undefined,
    });
    setIsSubmitting(false);
    
    if (result.success) {
      toast({
        title: "Perfil atualizado",
        description: "Suas configurações foram salvas.",
      });
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
                <p className="text-primary-foreground/80 text-sm">Configure suas preferências</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Configurações do Sistema</CardTitle>
            <CardDescription>Personalize sua experiência no sistema</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {errors.form && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
                  {errors.form}
                </div>
              )}

              {/* Avatar Upload */}
              <div className="flex flex-col items-center gap-4">
                <div className="relative">
                  <Avatar className="h-24 w-24 cursor-pointer ring-2 ring-border hover:ring-primary transition-all" onClick={handleAvatarClick}>
                    <AvatarImage src={formData.avatar_url} alt={user?.nome} />
                    <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                      {user?.nome ? getInitials(user.nome) : 'U'}
                    </AvatarFallback>
                  </Avatar>
                  
                  {isUploading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-full">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  )}
                  
                  <button
                    type="button"
                    onClick={handleAvatarClick}
                    className="absolute bottom-0 right-0 p-1.5 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 transition-colors"
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
                
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
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
                      size="sm"
                      onClick={handleRemoveAvatar}
                      disabled={isUploading}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Remover
                    </Button>
                  )}
                </div>
              </div>
              
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

              <div className="pt-4 border-t">
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Informações da Conta</Label>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Nome:</span>
                      <p className="font-medium">{user?.nome}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Email:</span>
                      <p className="font-medium">{user?.email}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Tipo:</span>
                      <p className="font-medium">{user?.role === 'admin' ? 'Administrador' : 'Usuário'}</p>
                    </div>
                  </div>
                </div>
              </div>
              
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
                  Salvar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Profile;
