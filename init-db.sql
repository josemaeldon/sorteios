-- =====================================================
-- SCRIPT DE INICIALIZAÇÃO DO BANCO DE DADOS
-- Sistema de Bingo - Self-Hosted
-- =====================================================

-- Criar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- ENUM TYPES
-- =====================================================
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- =====================================================
-- TABELAS
-- =====================================================

-- Tabela de perfis de usuário
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    avatar_url TEXT,
    titulo_sistema TEXT DEFAULT 'Sorteios',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Tabela de roles de usuário
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    role app_role NOT NULL DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    UNIQUE(user_id, role)
);

-- Tabela de usuários (para autenticação custom)
CREATE TABLE IF NOT EXISTS public.usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    senha_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    ativo BOOLEAN NOT NULL DEFAULT true,
    avatar_url TEXT,
    titulo_sistema TEXT DEFAULT 'Sorteios',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Tabela de sorteios
CREATE TABLE IF NOT EXISTS public.sorteios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    nome TEXT NOT NULL,
    premio TEXT,
    premios JSONB DEFAULT '[]'::jsonb,
    data_sorteio DATE,
    valor_cartela NUMERIC,
    quantidade_cartelas INTEGER DEFAULT 0,
    status TEXT DEFAULT 'ativo',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Tabela de vendedores
CREATE TABLE IF NOT EXISTS public.vendedores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sorteio_id UUID NOT NULL REFERENCES public.sorteios(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    telefone TEXT,
    email TEXT,
    cpf TEXT,
    endereco TEXT,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Tabela de cartelas
CREATE TABLE IF NOT EXISTS public.cartelas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sorteio_id UUID NOT NULL REFERENCES public.sorteios(id) ON DELETE CASCADE,
    vendedor_id UUID REFERENCES public.vendedores(id) ON DELETE SET NULL,
    numero INTEGER NOT NULL,
    status TEXT DEFAULT 'disponivel',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Tabela de atribuições
CREATE TABLE IF NOT EXISTS public.atribuicoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sorteio_id UUID NOT NULL REFERENCES public.sorteios(id) ON DELETE CASCADE,
    vendedor_id UUID NOT NULL REFERENCES public.vendedores(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Tabela de cartelas atribuídas
CREATE TABLE IF NOT EXISTS public.atribuicao_cartelas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    atribuicao_id UUID NOT NULL REFERENCES public.atribuicoes(id) ON DELETE CASCADE,
    numero_cartela INTEGER NOT NULL,
    status TEXT DEFAULT 'ativa',
    data_atribuicao TIMESTAMP WITH TIME ZONE,
    data_devolucao TIMESTAMP WITH TIME ZONE,
    venda_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Tabela de vendas
CREATE TABLE IF NOT EXISTS public.vendas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sorteio_id UUID NOT NULL REFERENCES public.sorteios(id) ON DELETE CASCADE,
    vendedor_id UUID REFERENCES public.vendedores(id) ON DELETE SET NULL,
    cliente_nome TEXT,
    cliente_telefone TEXT,
    numeros_cartelas TEXT,
    valor_total NUMERIC,
    valor_pago NUMERIC DEFAULT 0,
    data_venda TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'pendente',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Tabela de pagamentos
CREATE TABLE IF NOT EXISTS public.pagamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venda_id UUID NOT NULL REFERENCES public.vendas(id) ON DELETE CASCADE,
    valor NUMERIC,
    forma_pagamento TEXT,
    data_pagamento TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- =====================================================
-- ÍNDICES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_sorteios_user_id ON public.sorteios(user_id);
CREATE INDEX IF NOT EXISTS idx_vendedores_sorteio_id ON public.vendedores(sorteio_id);
CREATE INDEX IF NOT EXISTS idx_cartelas_sorteio_id ON public.cartelas(sorteio_id);
CREATE INDEX IF NOT EXISTS idx_vendas_sorteio_id ON public.vendas(sorteio_id);
CREATE INDEX IF NOT EXISTS idx_vendas_vendedor_id ON public.vendas(vendedor_id);

-- =====================================================
-- FUNÇÕES
-- =====================================================

-- Função para verificar role do usuário
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
        AND role = _role
    )
$$;

-- Função para obter role do usuário
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- =====================================================
-- TRIGGERS
-- =====================================================
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sorteios_updated_at
    BEFORE UPDATE ON public.sorteios
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_vendedores_updated_at
    BEFORE UPDATE ON public.vendedores
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cartelas_updated_at
    BEFORE UPDATE ON public.cartelas
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_atribuicoes_updated_at
    BEFORE UPDATE ON public.atribuicoes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_vendas_updated_at
    BEFORE UPDATE ON public.vendas
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_usuarios_updated_at
    BEFORE UPDATE ON public.usuarios
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- USUÁRIO ADMIN PADRÃO
-- Senha: admin123 (hash bcrypt)
-- =====================================================
INSERT INTO public.usuarios (id, nome, email, senha_hash, role, ativo)
VALUES (
    gen_random_uuid(),
    'Administrador',
    'admin@bingo.local',
    '$2a$10$N9qo8uLOickgx2ZMRZoMy.MQDOqKzFoXaZAKDxcj9kNxbD5e7B5I.',
    'admin',
    true
) ON CONFLICT (email) DO NOTHING;

-- Mensagem de conclusão
DO $$
BEGIN
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'Banco de dados inicializado com sucesso!';
    RAISE NOTICE 'Usuário admin padrão: admin@bingo.local / admin123';
    RAISE NOTICE '=====================================================';
END $$;
