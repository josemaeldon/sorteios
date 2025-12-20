-- Enum para roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Tabela de perfis (sem senha, dados seguros)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar_url TEXT,
  titulo_sistema TEXT DEFAULT 'Sorteios',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE
);

-- Tabela de roles separada (evita privilege escalation)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Habilitar RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Função security definer para verificar role (evita recursão RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Função para obter role do usuário
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

-- RLS Policies para profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies para user_roles
CREATE POLICY "Users can view their own role"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Trigger para criar perfil automaticamente após signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_count INTEGER;
BEGIN
  -- Criar perfil
  INSERT INTO public.profiles (id, nome, email, titulo_sistema)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'titulo_sistema', 'Sorteios')
  );
  
  -- Verificar se é o primeiro usuário (será admin)
  SELECT COUNT(*) INTO user_count FROM public.user_roles;
  
  IF user_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger no signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para updated_at em profiles
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Atualizar FK de sorteios para apontar para auth.users
ALTER TABLE public.sorteios DROP CONSTRAINT IF EXISTS sorteios_user_id_fkey;
ALTER TABLE public.sorteios 
  ADD CONSTRAINT sorteios_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- RLS para sorteios baseado no usuário autenticado
DROP POLICY IF EXISTS "Block all direct access to sorteios" ON public.sorteios;

CREATE POLICY "Users can view their own sorteios"
  ON public.sorteios FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sorteios"
  ON public.sorteios FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sorteios"
  ON public.sorteios FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sorteios"
  ON public.sorteios FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS para vendedores (vinculado ao sorteio do usuário)
DROP POLICY IF EXISTS "Block all direct access to vendedores" ON public.vendedores;

CREATE POLICY "Users can manage vendedores of their sorteios"
  ON public.vendedores FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sorteios s 
      WHERE s.id = vendedores.sorteio_id AND s.user_id = auth.uid()
    )
  );

-- RLS para cartelas
DROP POLICY IF EXISTS "Block all direct access to cartelas" ON public.cartelas;

CREATE POLICY "Users can manage cartelas of their sorteios"
  ON public.cartelas FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sorteios s 
      WHERE s.id = cartelas.sorteio_id AND s.user_id = auth.uid()
    )
  );

-- RLS para atribuicoes
DROP POLICY IF EXISTS "Block all direct access to atribuicoes" ON public.atribuicoes;

CREATE POLICY "Users can manage atribuicoes of their sorteios"
  ON public.atribuicoes FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sorteios s 
      WHERE s.id = atribuicoes.sorteio_id AND s.user_id = auth.uid()
    )
  );

-- RLS para atribuicao_cartelas
DROP POLICY IF EXISTS "Block all direct access to atribuicao_cartelas" ON public.atribuicao_cartelas;

CREATE POLICY "Users can manage atribuicao_cartelas of their sorteios"
  ON public.atribuicao_cartelas FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.atribuicoes a
      JOIN public.sorteios s ON s.id = a.sorteio_id
      WHERE a.id = atribuicao_cartelas.atribuicao_id AND s.user_id = auth.uid()
    )
  );

-- RLS para vendas
DROP POLICY IF EXISTS "Block all direct access to vendas" ON public.vendas;

CREATE POLICY "Users can manage vendas of their sorteios"
  ON public.vendas FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sorteios s 
      WHERE s.id = vendas.sorteio_id AND s.user_id = auth.uid()
    )
  );

-- RLS para pagamentos
DROP POLICY IF EXISTS "Block all direct access to pagamentos" ON public.pagamentos;

CREATE POLICY "Users can manage pagamentos of their vendas"
  ON public.pagamentos FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.vendas v
      JOIN public.sorteios s ON s.id = v.sorteio_id
      WHERE v.id = pagamentos.venda_id AND s.user_id = auth.uid()
    )
  );