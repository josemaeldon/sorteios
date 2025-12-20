-- Create restrictive RLS policies for all tables
-- Since this app uses custom auth via edge function (not Supabase Auth),
-- we block all direct access via Supabase client. The edge function
-- connects directly to Postgres and bypasses RLS.

-- usuarios: block all access (sensitive credentials)
CREATE POLICY "Block all direct access to usuarios"
ON public.usuarios
FOR ALL
USING (false)
WITH CHECK (false);

-- sorteios: block all access
CREATE POLICY "Block all direct access to sorteios"
ON public.sorteios
FOR ALL
USING (false)
WITH CHECK (false);

-- vendedores: block all access (contains PII)
CREATE POLICY "Block all direct access to vendedores"
ON public.vendedores
FOR ALL
USING (false)
WITH CHECK (false);

-- cartelas: block all access
CREATE POLICY "Block all direct access to cartelas"
ON public.cartelas
FOR ALL
USING (false)
WITH CHECK (false);

-- atribuicoes: block all access
CREATE POLICY "Block all direct access to atribuicoes"
ON public.atribuicoes
FOR ALL
USING (false)
WITH CHECK (false);

-- atribuicao_cartelas: block all access
CREATE POLICY "Block all direct access to atribuicao_cartelas"
ON public.atribuicao_cartelas
FOR ALL
USING (false)
WITH CHECK (false);

-- vendas: block all access
CREATE POLICY "Block all direct access to vendas"
ON public.vendas
FOR ALL
USING (false)
WITH CHECK (false);

-- pagamentos: block all access (financial data)
CREATE POLICY "Block all direct access to pagamentos"
ON public.pagamentos
FOR ALL
USING (false)
WITH CHECK (false);