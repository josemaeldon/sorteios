-- Create usuarios table with titulo_sistema column
CREATE TABLE IF NOT EXISTS public.usuarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL,
  nome TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  ativo BOOLEAN NOT NULL DEFAULT true,
  titulo_sistema TEXT DEFAULT 'Sorteios',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE
);

-- Create sorteios table if not exists
CREATE TABLE IF NOT EXISTS public.sorteios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  data_sorteio DATE,
  premio TEXT,
  valor_cartela DECIMAL(10,2),
  quantidade_cartelas INTEGER DEFAULT 0,
  status TEXT DEFAULT 'ativo',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE
);

-- Create vendedores table if not exists
CREATE TABLE IF NOT EXISTS public.vendedores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sorteio_id UUID NOT NULL REFERENCES sorteios(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  telefone TEXT,
  email TEXT,
  cpf TEXT,
  endereco TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE
);

-- Create cartelas table if not exists
CREATE TABLE IF NOT EXISTS public.cartelas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sorteio_id UUID NOT NULL REFERENCES sorteios(id) ON DELETE CASCADE,
  numero INTEGER NOT NULL,
  status TEXT DEFAULT 'disponivel',
  vendedor_id UUID REFERENCES vendedores(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE
);

-- Create atribuicoes table if not exists
CREATE TABLE IF NOT EXISTS public.atribuicoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sorteio_id UUID NOT NULL REFERENCES sorteios(id) ON DELETE CASCADE,
  vendedor_id UUID NOT NULL REFERENCES vendedores(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE
);

-- Create atribuicao_cartelas table if not exists
CREATE TABLE IF NOT EXISTS public.atribuicao_cartelas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  atribuicao_id UUID NOT NULL REFERENCES atribuicoes(id) ON DELETE CASCADE,
  numero_cartela INTEGER NOT NULL,
  status TEXT DEFAULT 'ativa',
  data_atribuicao TIMESTAMP WITH TIME ZONE,
  data_devolucao TIMESTAMP WITH TIME ZONE,
  venda_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create vendas table if not exists
CREATE TABLE IF NOT EXISTS public.vendas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sorteio_id UUID NOT NULL REFERENCES sorteios(id) ON DELETE CASCADE,
  vendedor_id UUID REFERENCES vendedores(id) ON DELETE SET NULL,
  cliente_nome TEXT,
  cliente_telefone TEXT,
  numeros_cartelas TEXT,
  valor_total DECIMAL(10,2),
  valor_pago DECIMAL(10,2) DEFAULT 0,
  status TEXT DEFAULT 'pendente',
  data_venda TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE
);

-- Create pagamentos table if not exists
CREATE TABLE IF NOT EXISTS public.pagamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  venda_id UUID NOT NULL REFERENCES vendas(id) ON DELETE CASCADE,
  forma_pagamento TEXT,
  valor DECIMAL(10,2),
  data_pagamento TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);