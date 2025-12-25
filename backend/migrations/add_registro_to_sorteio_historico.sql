-- Migration: Add registro field to sorteio_historico table
-- This field stores the draw registration name (e.g., "Sorteio 001")

-- Add registro column
ALTER TABLE public.sorteio_historico 
ADD COLUMN IF NOT EXISTS registro VARCHAR(255);

-- Add comment
COMMENT ON COLUMN public.sorteio_historico.registro IS 'Nome/identificador do registro do sorteio (ex: Sorteio 001)';
