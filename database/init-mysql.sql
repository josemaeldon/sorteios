-- =====================================================
-- SCRIPT DE INICIALIZAÇÃO - MYSQL
-- Sistema de Bingo
-- =====================================================

-- =====================================================
-- TABELAS
-- =====================================================

-- Tabela de usuários (para autenticação custom)
CREATE TABLE IF NOT EXISTS usuarios (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    nome TEXT NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    senha_hash TEXT NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    ativo BOOLEAN NOT NULL DEFAULT true,
    avatar_url TEXT,
    titulo_sistema VARCHAR(255) DEFAULT 'Sorteios',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP
);

-- Tabela de sorteios
CREATE TABLE IF NOT EXISTS sorteios (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id CHAR(36) NOT NULL,
    nome TEXT NOT NULL,
    premio TEXT,
    premios JSON,
    data_sorteio DATE,
    valor_cartela DECIMAL(10, 2),
    quantidade_cartelas INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'ativo',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_sorteios_user_id (user_id)
);

-- Tabela de vendedores
CREATE TABLE IF NOT EXISTS vendedores (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    sorteio_id CHAR(36) NOT NULL,
    nome TEXT NOT NULL,
    telefone VARCHAR(50),
    email VARCHAR(255),
    cpf VARCHAR(20),
    endereco TEXT,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (sorteio_id) REFERENCES sorteios(id) ON DELETE CASCADE,
    INDEX idx_vendedores_sorteio_id (sorteio_id)
);

-- Tabela de cartelas
CREATE TABLE IF NOT EXISTS cartelas (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    sorteio_id CHAR(36) NOT NULL,
    vendedor_id CHAR(36),
    numero INTEGER NOT NULL,
    status VARCHAR(50) DEFAULT 'disponivel',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (sorteio_id) REFERENCES sorteios(id) ON DELETE CASCADE,
    FOREIGN KEY (vendedor_id) REFERENCES vendedores(id) ON DELETE SET NULL,
    INDEX idx_cartelas_sorteio_id (sorteio_id),
    INDEX idx_cartelas_vendedor_id (vendedor_id)
);

-- Tabela de atribuições
CREATE TABLE IF NOT EXISTS atribuicoes (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    sorteio_id CHAR(36) NOT NULL,
    vendedor_id CHAR(36) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (sorteio_id) REFERENCES sorteios(id) ON DELETE CASCADE,
    FOREIGN KEY (vendedor_id) REFERENCES vendedores(id) ON DELETE CASCADE,
    INDEX idx_atribuicoes_sorteio_id (sorteio_id),
    INDEX idx_atribuicoes_vendedor_id (vendedor_id)
);

-- Tabela de cartelas atribuídas
CREATE TABLE IF NOT EXISTS atribuicao_cartelas (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    atribuicao_id CHAR(36) NOT NULL,
    numero_cartela INTEGER NOT NULL,
    status VARCHAR(50) DEFAULT 'ativa',
    data_atribuicao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    data_devolucao TIMESTAMP NULL,
    venda_id CHAR(36),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (atribuicao_id) REFERENCES atribuicoes(id) ON DELETE CASCADE,
    INDEX idx_atribuicao_cartelas_atribuicao_id (atribuicao_id)
);

-- Tabela de vendas
CREATE TABLE IF NOT EXISTS vendas (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    sorteio_id CHAR(36) NOT NULL,
    vendedor_id CHAR(36),
    cliente_nome TEXT,
    cliente_telefone VARCHAR(50),
    numeros_cartelas TEXT NOT NULL,
    valor_total DECIMAL(10, 2) NOT NULL,
    valor_pago DECIMAL(10, 2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'pendente',
    data_venda TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (sorteio_id) REFERENCES sorteios(id) ON DELETE CASCADE,
    FOREIGN KEY (vendedor_id) REFERENCES vendedores(id) ON DELETE SET NULL,
    INDEX idx_vendas_sorteio_id (sorteio_id),
    INDEX idx_vendas_vendedor_id (vendedor_id)
);

-- Tabela de pagamentos
CREATE TABLE IF NOT EXISTS pagamentos (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    venda_id CHAR(36) NOT NULL,
    forma_pagamento VARCHAR(100) NOT NULL,
    valor DECIMAL(10, 2) NOT NULL,
    observacao TEXT,
    data_pagamento TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY (venda_id) REFERENCES vendas(id) ON DELETE CASCADE,
    INDEX idx_pagamentos_venda_id (venda_id)
);

-- Tabela de histórico de sorteio
CREATE TABLE IF NOT EXISTS sorteio_historico (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    sorteio_id CHAR(36),
    rodada_id CHAR(36),
    numero_sorteado INTEGER NOT NULL,
    range_start INTEGER,
    range_end INTEGER,
    ordem INTEGER NOT NULL,
    registro TEXT,
    data_sorteio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY (sorteio_id) REFERENCES sorteios(id) ON DELETE CASCADE,
    INDEX idx_sorteio_historico_sorteio_id (sorteio_id),
    INDEX idx_sorteio_historico_rodada_id (rodada_id)
);

-- Tabela de rodadas de sorteio
CREATE TABLE IF NOT EXISTS rodadas_sorteio (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    sorteio_id CHAR(36) NOT NULL,
    nome TEXT NOT NULL,
    range_start INTEGER NOT NULL,
    range_end INTEGER NOT NULL,
    status VARCHAR(50) DEFAULT 'ativo',
    data_inicio TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (sorteio_id) REFERENCES sorteios(id) ON DELETE CASCADE,
    INDEX idx_rodadas_sorteio_sorteio_id (sorteio_id)
);
