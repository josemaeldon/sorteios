-- Migration: Make sorteio_id nullable in sorteio_historico
-- This allows storing history for rodadas without requiring a direct sorteio_id reference
-- Since rodadas already have a sorteio_id, we can derive it from the rodada relationship

-- Make sorteio_id nullable
ALTER TABLE public.sorteio_historico 
ALTER COLUMN sorteio_id DROP NOT NULL;

-- Add comment explaining the change
COMMENT ON COLUMN public.sorteio_historico.sorteio_id IS 'ID do sorteio (nullable quando associado via rodada_id)';
