-- =====================================================
-- BINGO SYSTEM - Database Initialization (PostgreSQL Only)
-- =====================================================

-- Extensão UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================== TABELAS ==================

-- Usuários do sistema
CREATE TABLE IF NOT EXISTS usuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    senha_hash TEXT NOT NULL,
    nome TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    ativo BOOLEAN NOT NULL DEFAULT true,
    titulo_sistema TEXT DEFAULT 'Sorteios',
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

-- Sorteios
CREATE TABLE IF NOT EXISTS sorteios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    data_sorteio DATE,
    premio TEXT,
    premios JSONB DEFAULT '[]'::jsonb,
    valor_cartela NUMERIC,
    quantidade_cartelas INTEGER DEFAULT 0,
    status TEXT DEFAULT 'ativo',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

-- Vendedores
CREATE TABLE IF NOT EXISTS vendedores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sorteio_id UUID NOT NULL REFERENCES sorteios(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    telefone TEXT,
    email TEXT,
    cpf TEXT,
    endereco TEXT,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

-- Cartelas
CREATE TABLE IF NOT EXISTS cartelas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sorteio_id UUID NOT NULL REFERENCES sorteios(id) ON DELETE CASCADE,
    numero INTEGER NOT NULL,
    status TEXT DEFAULT 'disponivel',
    vendedor_id UUID REFERENCES vendedores(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    UNIQUE(sorteio_id, numero)
);

-- Atribuições
CREATE TABLE IF NOT EXISTS atribuicoes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sorteio_id UUID NOT NULL REFERENCES sorteios(id) ON DELETE CASCADE,
    vendedor_id UUID NOT NULL REFERENCES vendedores(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    UNIQUE(sorteio_id, vendedor_id)
);

-- Atribuição de Cartelas
CREATE TABLE IF NOT EXISTS atribuicao_cartelas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    atribuicao_id UUID NOT NULL REFERENCES atribuicoes(id) ON DELETE CASCADE,
    numero_cartela INTEGER NOT NULL,
    status TEXT DEFAULT 'ativa',
    data_atribuicao TIMESTAMPTZ,
    data_devolucao TIMESTAMPTZ,
    venda_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Vendas
CREATE TABLE IF NOT EXISTS vendas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sorteio_id UUID NOT NULL REFERENCES sorteios(id) ON DELETE CASCADE,
    vendedor_id UUID REFERENCES vendedores(id) ON DELETE SET NULL,
    cliente_nome TEXT,
    cliente_telefone TEXT,
    numeros_cartelas TEXT,
    valor_total NUMERIC,
    valor_pago NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'pendente',
    data_venda TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

-- Pagamentos
CREATE TABLE IF NOT EXISTS pagamentos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    venda_id UUID NOT NULL REFERENCES vendas(id) ON DELETE CASCADE,
    forma_pagamento TEXT,
    valor NUMERIC,
    observacao TEXT,
    data_pagamento TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ================== ÍNDICES ==================
CREATE INDEX IF NOT EXISTS idx_sorteios_user_id ON sorteios(user_id);
CREATE INDEX IF NOT EXISTS idx_vendedores_sorteio_id ON vendedores(sorteio_id);
CREATE INDEX IF NOT EXISTS idx_cartelas_sorteio_id ON cartelas(sorteio_id);
CREATE INDEX IF NOT EXISTS idx_cartelas_status ON cartelas(status);
CREATE INDEX IF NOT EXISTS idx_atribuicoes_sorteio_id ON atribuicoes(sorteio_id);
CREATE INDEX IF NOT EXISTS idx_atribuicao_cartelas_atribuicao_id ON atribuicao_cartelas(atribuicao_id);
CREATE INDEX IF NOT EXISTS idx_vendas_sorteio_id ON vendas(sorteio_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_venda_id ON pagamentos(venda_id);

-- ================== CONCLUÍDO ==================
DO $$ 
BEGIN 
    RAISE NOTICE 'Bingo System database initialized successfully!';
END $$;
