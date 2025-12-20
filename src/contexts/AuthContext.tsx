import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { User, AuthState, LoginCredentials, CreateUserData } from '@/types/auth';
import { callApi, getStoredToken, setStoredToken, clearStoredToken, isSelfhostedMode } from '@/lib/apiClient';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  createUser: (data: CreateUserData) => Promise<{ success: boolean; error?: string }>;
  updateUser: (id: string, data: Partial<CreateUserData>) => Promise<{ success: boolean; error?: string }>;
  deleteUser: (id: string) => Promise<{ success: boolean; error?: string }>;
  getAllUsers: () => Promise<User[]>;
  checkFirstAccess: () => Promise<boolean>;
  setupAdmin: (email: string, senha: string, nome: string, titulo_sistema: string) => Promise<{ success: boolean; error?: string }>;
  updateProfile: (data: { nome: string; email: string; titulo_sistema: string; avatar_url?: string; senha_atual?: string; nova_senha?: string }) => Promise<{ success: boolean; error?: string }>;
  getAuthToken: () => string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_KEY = 'bingo_auth_user';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const getAuthToken = useCallback(() => token, [token]);

  // Check stored auth on mount
  useEffect(() => {
    const stored = localStorage.getItem(AUTH_KEY);
    const storedToken = getStoredToken();
    if (stored && storedToken) {
      try {
        const parsed = JSON.parse(stored);
        setUser(parsed);
        setToken(storedToken);
      } catch (e) {
        localStorage.removeItem(AUTH_KEY);
        clearStoredToken();
      }
    }
    setIsLoading(false);
  }, []);

  const checkFirstAccess = useCallback(async (): Promise<boolean> => {
    try {
      const result = await callApi('checkFirstAccess');
      return result.isFirstAccess === true;
    } catch (error) {
      console.error('Error checking first access:', error);
      return true; // Assume first access if error
    }
  }, []);

  const setupAdmin = useCallback(async (email: string, senha: string, nome: string, titulo_sistema: string) => {
    try {
      const result = await callApi('setupAdmin', { email, senha, nome, titulo_sistema });
      
      if (result.user) {
        setUser(result.user);
        localStorage.setItem(AUTH_KEY, JSON.stringify(result.user));
        toast({
          title: "Administrador criado",
          description: "Você está logado como administrador.",
        });
        return { success: true };
      }
      
      return { success: false, error: result.error || 'Erro ao criar administrador' };
    } catch (error: any) {
      console.error('Setup admin error:', error);
      return { success: false, error: error.message || 'Erro ao criar administrador' };
    }
  }, [toast]);

  const login = useCallback(async (credentials: LoginCredentials) => {
    try {
      setIsLoading(true);
      const result = await callApi('login', credentials);
      
      if (result.user && result.token) {
        setUser(result.user);
        setToken(result.token);
        localStorage.setItem(AUTH_KEY, JSON.stringify(result.user));
        setStoredToken(result.token);
        toast({
          title: "Login realizado",
          description: `Bem-vindo, ${result.user.nome}!`,
        });
        return { success: true };
      }
      
      return { success: false, error: result.error || 'Credenciais inválidas' };
    } catch (error: any) {
      console.error('Login error:', error);
      return { success: false, error: error.message || 'Erro ao fazer login' };
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem(AUTH_KEY);
    clearStoredToken();
    toast({
      title: "Logout realizado",
      description: "Você foi desconectado.",
    });
  }, [toast]);

  const createUser = useCallback(async (data: CreateUserData) => {
    if (user?.role !== 'admin') {
      return { success: false, error: 'Apenas administradores podem criar usuários' };
    }

    try {
      const result = await callApi('createUser', data);
      
      if (result.user) {
        toast({
          title: "Usuário criado",
          description: `${result.user.nome} foi criado com sucesso.`,
        });
        return { success: true };
      }
      
      return { success: false, error: result.error || 'Erro ao criar usuário' };
    } catch (error: any) {
      console.error('Create user error:', error);
      return { success: false, error: error.message || 'Erro ao criar usuário' };
    }
  }, [user, toast]);

  const updateUser = useCallback(async (id: string, data: Partial<CreateUserData>) => {
    if (user?.role !== 'admin') {
      return { success: false, error: 'Apenas administradores podem editar usuários' };
    }

    try {
      const result = await callApi('updateUser', { id, ...data });
      
      if (result.success) {
        toast({
          title: "Usuário atualizado",
          description: "As alterações foram salvas.",
        });
        return { success: true };
      }
      
      return { success: false, error: result.error || 'Erro ao atualizar usuário' };
    } catch (error: any) {
      console.error('Update user error:', error);
      return { success: false, error: error.message || 'Erro ao atualizar usuário' };
    }
  }, [user, toast]);

  const deleteUser = useCallback(async (id: string) => {
    if (user?.role !== 'admin') {
      return { success: false, error: 'Apenas administradores podem excluir usuários' };
    }

    if (id === user.id) {
      return { success: false, error: 'Você não pode excluir sua própria conta' };
    }

    try {
      const result = await callApi('deleteUser', { id });
      
      if (result.success) {
        toast({
          title: "Usuário excluído",
          description: "O usuário foi removido do sistema.",
        });
        return { success: true };
      }
      
      return { success: false, error: result.error || 'Erro ao excluir usuário' };
    } catch (error: any) {
      console.error('Delete user error:', error);
      return { success: false, error: error.message || 'Erro ao excluir usuário' };
    }
  }, [user, toast]);

  const getAllUsers = useCallback(async (): Promise<User[]> => {
    if (user?.role !== 'admin') {
      return [];
    }

    try {
      const result = await callApi('getUsers');
      return result.users || [];
    } catch (error) {
      console.error('Get users error:', error);
      return [];
    }
  }, [user]);

  const updateProfile = useCallback(async (data: { nome: string; email: string; titulo_sistema: string; avatar_url?: string; senha_atual?: string; nova_senha?: string }) => {
    if (!user) {
      return { success: false, error: 'Usuário não autenticado' };
    }

    try {
      const result = await callApi('updateProfile', { 
        id: user.id, 
        nome: data.nome,
        email: data.email,
        titulo_sistema: data.titulo_sistema,
        avatar_url: data.avatar_url,
        senha_atual: data.senha_atual,
        nova_senha: data.nova_senha,
      });
      
      if (result.success) {
        const updatedUser = { 
          ...user, 
          nome: data.nome,
          email: data.email,
          titulo_sistema: data.titulo_sistema, 
          avatar_url: data.avatar_url 
        };
        setUser(updatedUser);
        localStorage.setItem(AUTH_KEY, JSON.stringify(updatedUser));
        return { success: true };
      }
      
      return { success: false, error: result.error || 'Erro ao atualizar perfil' };
    } catch (error: any) {
      console.error('Update profile error:', error);
      return { success: false, error: error.message || 'Erro ao atualizar perfil' };
    }
  }, [user]);

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user && !!token,
    login,
    logout,
    createUser,
    updateUser,
    deleteUser,
    getAllUsers,
    checkFirstAccess,
    setupAdmin,
    updateProfile,
    getAuthToken,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
