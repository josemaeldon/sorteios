# Database Migration Guide - Rodadas de Sorteio

## Overview
This migration adds support for managing multiple draw rounds (rodadas) within a sorteio (raffle/bingo).

## Migration File
`backend/migrations/add_rodadas_sorteio.sql`

## What It Does

1. **Creates `rodadas_sorteio` table** - Stores independent draw rounds that can be managed separately
   - Each round has its own name, number range, and status
   - Multiple rounds can exist for the same sorteio
   
2. **Adds `rodada_id` column to `sorteio_historico`** - Links draw history to specific rounds
   - Allows tracking which numbers were drawn in which round
   - Maintains foreign key relationship for data integrity

## How to Apply

### For PostgreSQL (Self-hosted or Docker)
```bash
psql -U <username> -d <database_name> -f backend/migrations/add_rodadas_sorteio.sql
```

### For Supabase
1. Go to the Supabase Dashboard
2. Navigate to SQL Editor
3. Copy the contents of `backend/migrations/add_rodadas_sorteio.sql`
4. Execute the SQL

### Using Docker
```bash
docker exec -i <container_name> psql -U postgres -d bingo < backend/migrations/add_rodadas_sorteio.sql
```

## Verification

After running the migration, verify with:
```sql
-- Check if table exists
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name = 'rodadas_sorteio'
);

-- Check if column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'sorteio_historico' 
AND column_name = 'rodada_id';
```

## Rollback (if needed)

To rollback this migration:
```sql
-- Remove rodada_id column from sorteio_historico
ALTER TABLE public.sorteio_historico DROP COLUMN IF EXISTS rodada_id;

-- Drop rodadas_sorteio table
DROP TABLE IF EXISTS public.rodadas_sorteio;
```

## Notes
- This migration is non-destructive - it adds new tables/columns without modifying existing data
- The `rodada_id` column in `sorteio_historico` is nullable, so existing records are not affected
- The `ON DELETE CASCADE` ensures that when a rodada is deleted, its history is also removed
