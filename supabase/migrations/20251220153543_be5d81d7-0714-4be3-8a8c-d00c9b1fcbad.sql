-- Add premios column as JSONB array and migrate existing data
ALTER TABLE public.sorteios ADD COLUMN IF NOT EXISTS premios JSONB DEFAULT '[]'::jsonb;

-- Migrate existing premio data to premios array
UPDATE public.sorteios 
SET premios = CASE 
  WHEN premio IS NOT NULL AND premio != '' THEN jsonb_build_array(premio)
  ELSE '[]'::jsonb
END
WHERE premios = '[]'::jsonb OR premios IS NULL;