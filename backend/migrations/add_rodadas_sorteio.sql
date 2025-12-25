-- Migration: Add rodadas_sorteio table for managing multiple draw rounds
-- This table stores independent draw rounds that can be created, edited, and deleted

-- Create rodadas_sorteio table
CREATE TABLE IF NOT EXISTS public.rodadas_sorteio (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sorteio_id UUID NOT NULL REFERENCES public.sorteios(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    range_start INTEGER NOT NULL,
    range_end INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'ativo',
    data_inicio TIMESTAMP WITH TIME ZONE,
    data_fim TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_rodadas_sorteio_sorteio_id ON public.rodadas_sorteio(sorteio_id);

-- Add rodada_id to sorteio_historico to link history to a specific round
ALTER TABLE public.sorteio_historico 
ADD COLUMN IF NOT EXISTS rodada_id UUID REFERENCES public.rodadas_sorteio(id) ON DELETE CASCADE;

-- Create index for the new column
CREATE INDEX IF NOT EXISTS idx_sorteio_historico_rodada_id ON public.sorteio_historico(rodada_id);

-- Comments
COMMENT ON TABLE public.rodadas_sorteio IS 'Rodadas de sorteio que podem ser gerenciadas independentemente';
COMMENT ON COLUMN public.rodadas_sorteio.nome IS 'Nome da rodada (ex: Rodada 1, Rodada 2)';
COMMENT ON COLUMN public.rodadas_sorteio.range_start IS 'Início da faixa de números';
COMMENT ON COLUMN public.rodadas_sorteio.range_end IS 'Fim da faixa de números';
COMMENT ON COLUMN public.rodadas_sorteio.status IS 'Status da rodada (ativo, concluido, cancelado)';
COMMENT ON COLUMN public.sorteio_historico.rodada_id IS 'Referência à rodada de sorteio';
