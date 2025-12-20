export type UserRole = 'admin' | 'user';

export interface User {
  id: string;
  email: string;
  nome: string;
  role: UserRole;
  ativo: boolean;
  titulo_sistema: string;
  avatar_url?: string;
  created_at: string;
  updated_at?: string;
}

export interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export interface LoginCredentials {
  email: string;
  senha: string;
}

export interface CreateUserData {
  email: string;
  senha: string;
  nome: string;
  role: UserRole;
  titulo_sistema?: string;
  avatar_url?: string;
}
