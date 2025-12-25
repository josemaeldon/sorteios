-- Migration: Add sorteio_historico table for storing draw history
-- This table stores the history of drawn numbers for each sorteio
-- allowing persistence across page refreshes

-- Create sorteio_historico table
CREATE TABLE IF NOT EXISTS public.sorteio_historico (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sorteio_id UUID NOT NULL REFERENCES public.sorteios(id) ON DELETE CASCADE,
    numero_sorteado INTEGER NOT NULL,
    range_start INTEGER NOT NULL,
    range_end INTEGER NOT NULL,
    ordem INTEGER NOT NULL,
    data_sorteio TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_sorteio_historico_sorteio_id ON public.sorteio_historico(sorteio_id);
CREATE INDEX IF NOT EXISTS idx_sorteio_historico_ordem ON public.sorteio_historico(sorteio_id, ordem);

-- Comments
COMMENT ON TABLE public.sorteio_historico IS 'Histórico de números sorteados para cada sorteio';
COMMENT ON COLUMN public.sorteio_historico.numero_sorteado IS 'Número que foi sorteado';
COMMENT ON COLUMN public.sorteio_historico.range_start IS 'Início da faixa configurada para o sorteio';
COMMENT ON COLUMN public.sorteio_historico.range_end IS 'Fim da faixa configurada para o sorteio';
COMMENT ON COLUMN public.sorteio_historico.ordem IS 'Ordem em que o número foi sorteado (1, 2, 3...)';
