-- =====================================================
-- SCRIPT DE INICIALIZAÇÃO - POSTGRESQL
-- Sistema de Bingo
-- =====================================================

-- Criar extensões necessárias (apenas PostgreSQL)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- TABELAS
-- =====================================================

-- Tabela de usuários (para autenticação custom)
CREATE TABLE IF NOT EXISTS usuarios (
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
CREATE TABLE IF NOT EXISTS sorteios (
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
CREATE TABLE IF NOT EXISTS vendedores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sorteio_id UUID NOT NULL REFERENCES sorteios(id) ON DELETE CASCADE,
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
CREATE TABLE IF NOT EXISTS cartelas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sorteio_id UUID NOT NULL REFERENCES sorteios(id) ON DELETE CASCADE,
    vendedor_id UUID REFERENCES vendedores(id) ON DELETE SET NULL,
    numero INTEGER NOT NULL,
    status TEXT DEFAULT 'disponivel',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Tabela de atribuições
CREATE TABLE IF NOT EXISTS atribuicoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sorteio_id UUID NOT NULL REFERENCES sorteios(id) ON DELETE CASCADE,
    vendedor_id UUID NOT NULL REFERENCES vendedores(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Tabela de cartelas atribuídas
CREATE TABLE IF NOT EXISTS atribuicao_cartelas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    atribuicao_id UUID NOT NULL REFERENCES atribuicoes(id) ON DELETE CASCADE,
    numero_cartela INTEGER NOT NULL,
    status TEXT DEFAULT 'ativa',
    data_atribuicao TIMESTAMP WITH TIME ZONE DEFAULT now(),
    data_devolucao TIMESTAMP WITH TIME ZONE,
    venda_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Tabela de vendas
CREATE TABLE IF NOT EXISTS vendas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sorteio_id UUID NOT NULL REFERENCES sorteios(id) ON DELETE CASCADE,
    vendedor_id UUID REFERENCES vendedores(id) ON DELETE SET NULL,
    cliente_nome TEXT,
    cliente_telefone TEXT,
    numeros_cartelas TEXT NOT NULL,
    valor_total NUMERIC NOT NULL,
    valor_pago NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'pendente',
    data_venda TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Tabela de pagamentos
CREATE TABLE IF NOT EXISTS pagamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venda_id UUID NOT NULL REFERENCES vendas(id) ON DELETE CASCADE,
    forma_pagamento TEXT NOT NULL,
    valor NUMERIC NOT NULL,
    observacao TEXT,
    data_pagamento TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Tabela de histórico de sorteio
CREATE TABLE IF NOT EXISTS sorteio_historico (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sorteio_id UUID REFERENCES sorteios(id) ON DELETE CASCADE,
    rodada_id UUID,
    numero_sorteado INTEGER NOT NULL,
    range_start INTEGER,
    range_end INTEGER,
    ordem INTEGER NOT NULL,
    registro TEXT,
    data_sorteio TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Tabela de rodadas de sorteio
CREATE TABLE IF NOT EXISTS rodadas_sorteio (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sorteio_id UUID NOT NULL REFERENCES sorteios(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    range_start INTEGER NOT NULL,
    range_end INTEGER NOT NULL,
    status TEXT DEFAULT 'ativo',
    data_inicio TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- =====================================================
-- ÍNDICES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_sorteios_user_id ON sorteios(user_id);
CREATE INDEX IF NOT EXISTS idx_vendedores_sorteio_id ON vendedores(sorteio_id);
CREATE INDEX IF NOT EXISTS idx_cartelas_sorteio_id ON cartelas(sorteio_id);
CREATE INDEX IF NOT EXISTS idx_cartelas_vendedor_id ON cartelas(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_atribuicoes_sorteio_id ON atribuicoes(sorteio_id);
CREATE INDEX IF NOT EXISTS idx_atribuicoes_vendedor_id ON atribuicoes(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_atribuicao_cartelas_atribuicao_id ON atribuicao_cartelas(atribuicao_id);
CREATE INDEX IF NOT EXISTS idx_vendas_sorteio_id ON vendas(sorteio_id);
CREATE INDEX IF NOT EXISTS idx_vendas_vendedor_id ON vendas(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_venda_id ON pagamentos(venda_id);
CREATE INDEX IF NOT EXISTS idx_sorteio_historico_sorteio_id ON sorteio_historico(sorteio_id);
CREATE INDEX IF NOT EXISTS idx_sorteio_historico_rodada_id ON sorteio_historico(rodada_id);
CREATE INDEX IF NOT EXISTS idx_rodadas_sorteio_sorteio_id ON rodadas_sorteio(sorteio_id);
