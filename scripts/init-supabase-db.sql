-- =====================================================
-- BINGO SYSTEM - Inicialização do Schema Supabase
-- =====================================================
-- Este script inicializa as tabelas e funções necessárias
-- para o Supabase funcionar com um banco PostgreSQL externo
-- =====================================================

-- Criar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pgjwt";

-- =====================================================
-- Schema AUTH (para GoTrue)
-- =====================================================
CREATE SCHEMA IF NOT EXISTS auth;

-- Tabela de usuários auth
CREATE TABLE IF NOT EXISTS auth.users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  instance_id UUID,
  aud VARCHAR(255),
  role VARCHAR(255),
  email VARCHAR(255) UNIQUE,
  encrypted_password VARCHAR(255),
  email_confirmed_at TIMESTAMPTZ,
  invited_at TIMESTAMPTZ,
  confirmation_token VARCHAR(255),
  confirmation_sent_at TIMESTAMPTZ,
  recovery_token VARCHAR(255),
  recovery_sent_at TIMESTAMPTZ,
  email_change_token_new VARCHAR(255),
  email_change VARCHAR(255),
  email_change_sent_at TIMESTAMPTZ,
  last_sign_in_at TIMESTAMPTZ,
  raw_app_meta_data JSONB,
  raw_user_meta_data JSONB,
  is_super_admin BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  phone VARCHAR(255) UNIQUE,
  phone_confirmed_at TIMESTAMPTZ,
  phone_change VARCHAR(255),
  phone_change_token VARCHAR(255),
  phone_change_sent_at TIMESTAMPTZ,
  email_change_token_current VARCHAR(255),
  email_change_confirm_status SMALLINT DEFAULT 0,
  banned_until TIMESTAMPTZ,
  reauthentication_token VARCHAR(255),
  reauthentication_sent_at TIMESTAMPTZ,
  is_sso_user BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ
);

-- Tabela de refresh tokens
CREATE TABLE IF NOT EXISTS auth.refresh_tokens (
  id BIGSERIAL PRIMARY KEY,
  token VARCHAR(255) UNIQUE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  revoked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  parent VARCHAR(255),
  session_id UUID
);

-- Tabela de identities
CREATE TABLE IF NOT EXISTS auth.identities (
  id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  identity_data JSONB NOT NULL,
  provider TEXT NOT NULL,
  last_sign_in_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  email TEXT GENERATED ALWAYS AS (lower(identity_data->>'email')) STORED,
  PRIMARY KEY (provider, id)
);

-- Tabela de sessions
CREATE TABLE IF NOT EXISTS auth.sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  factor_id UUID,
  aal TEXT,
  not_after TIMESTAMPTZ,
  refreshed_at TIMESTAMP,
  user_agent TEXT,
  ip TEXT,
  tag TEXT
);

-- Tabela de audit log
CREATE TABLE IF NOT EXISTS auth.audit_log_entries (
  instance_id UUID,
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address VARCHAR(64) DEFAULT ''
);

-- Tabela de schema migrations
CREATE TABLE IF NOT EXISTS auth.schema_migrations (
  version VARCHAR(255) PRIMARY KEY
);

-- Tabela de instances
CREATE TABLE IF NOT EXISTS auth.instances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  uuid UUID,
  raw_base_config TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices importantes
CREATE INDEX IF NOT EXISTS users_instance_id_idx ON auth.users(instance_id);
CREATE INDEX IF NOT EXISTS users_email_idx ON auth.users(email);
CREATE INDEX IF NOT EXISTS refresh_tokens_token_idx ON auth.refresh_tokens(token);
CREATE INDEX IF NOT EXISTS refresh_tokens_user_id_idx ON auth.refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON auth.sessions(user_id);

-- =====================================================
-- Schema STORAGE (para Storage API)
-- =====================================================
CREATE SCHEMA IF NOT EXISTS storage;

-- Tabela de buckets
CREATE TABLE IF NOT EXISTS storage.buckets (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  owner UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  public BOOLEAN DEFAULT FALSE,
  avif_autodetection BOOLEAN DEFAULT FALSE,
  file_size_limit BIGINT,
  allowed_mime_types TEXT[]
);

-- Tabela de objects
CREATE TABLE IF NOT EXISTS storage.objects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bucket_id TEXT REFERENCES storage.buckets(id),
  name TEXT,
  owner UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB,
  path_tokens TEXT[] GENERATED ALWAYS AS (string_to_array(name, '/')) STORED,
  version TEXT,
  owner_id TEXT,
  UNIQUE(bucket_id, name)
);

-- Índices para storage
CREATE INDEX IF NOT EXISTS objects_bucket_id_idx ON storage.objects(bucket_id);
CREATE INDEX IF NOT EXISTS objects_name_idx ON storage.objects(name);
CREATE INDEX IF NOT EXISTS objects_owner_idx ON storage.objects(owner);

-- =====================================================
-- Schema REALTIME (para Realtime Server)
-- =====================================================
CREATE SCHEMA IF NOT EXISTS _realtime;

-- Tabela de tenants (CRÍTICA para o Realtime funcionar)
CREATE TABLE IF NOT EXISTS _realtime.tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT,
  external_id TEXT UNIQUE NOT NULL,
  jwt_secret TEXT,
  jwt_jwks JSONB DEFAULT NULL,
  postgres_cdc_default TEXT DEFAULT 'postgres_cdc_rls',
  max_concurrent_users INTEGER DEFAULT 200,
  max_events_per_second INTEGER DEFAULT 100,
  max_bytes_per_second INTEGER DEFAULT 100000,
  max_channels_per_client INTEGER DEFAULT 100,
  max_joins_per_second INTEGER DEFAULT 100,
  suspend BOOLEAN DEFAULT FALSE,
  enable_authorization BOOLEAN DEFAULT TRUE,
  inserted_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de extensions para os tenants
CREATE TABLE IF NOT EXISTS _realtime.extensions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL,
  settings JSONB,
  tenant_external_id TEXT REFERENCES _realtime.tenants(external_id) ON DELETE CASCADE,
  inserted_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de schema migrations do realtime
CREATE TABLE IF NOT EXISTS _realtime.schema_migrations (
  version BIGINT PRIMARY KEY,
  inserted_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para realtime
CREATE INDEX IF NOT EXISTS tenants_external_id_idx ON _realtime.tenants(external_id);
CREATE INDEX IF NOT EXISTS extensions_tenant_external_id_idx ON _realtime.extensions(tenant_external_id);

-- Inserir tenant padrão para o Bingo
-- IMPORTANTE: O external_id deve corresponder ao host usado nas requisições
INSERT INTO _realtime.tenants (
  name, 
  external_id, 
  jwt_secret,
  max_concurrent_users,
  max_events_per_second,
  max_bytes_per_second,
  max_channels_per_client,
  max_joins_per_second
) VALUES (
  'Bingo System',
  'realtime-dev.supabase.localhost',
  current_setting('app.settings.jwt_secret', true),
  200,
  100,
  100000,
  100,
  100
) ON CONFLICT (external_id) DO NOTHING;

-- Inserir também para localhost (usado nos health checks)
INSERT INTO _realtime.tenants (
  name, 
  external_id, 
  jwt_secret,
  max_concurrent_users,
  max_events_per_second,
  max_bytes_per_second,
  max_channels_per_client,
  max_joins_per_second
) VALUES (
  'Bingo System Local',
  'localhost',
  NULL,
  200,
  100,
  100000,
  100,
  100
) ON CONFLICT (external_id) DO NOTHING;

-- Extension para broadcast
INSERT INTO _realtime.extensions (type, settings, tenant_external_id)
SELECT 'broadcast', '{}', 'localhost'
WHERE NOT EXISTS (
  SELECT 1 FROM _realtime.extensions 
  WHERE type = 'broadcast' AND tenant_external_id = 'localhost'
);

-- Extension para presence
INSERT INTO _realtime.extensions (type, settings, tenant_external_id)
SELECT 'presence', '{}', 'localhost'
WHERE NOT EXISTS (
  SELECT 1 FROM _realtime.extensions 
  WHERE type = 'presence' AND tenant_external_id = 'localhost'
);

-- Extension para postgres_cdc_rls
INSERT INTO _realtime.extensions (type, settings, tenant_external_id)
SELECT 'postgres_cdc_rls', '{"region": "local", "db_host": "localhost", "db_name": "postgres", "db_port": "5432", "slot_name": "supabase_realtime_rls", "poll_interval_ms": 100, "poll_max_changes": 100, "poll_max_record_bytes": 1048576}', 'localhost'
WHERE NOT EXISTS (
  SELECT 1 FROM _realtime.extensions 
  WHERE type = 'postgres_cdc_rls' AND tenant_external_id = 'localhost'
);

-- =====================================================
-- Roles do banco de dados
-- =====================================================

-- Role anon (para requisições não autenticadas)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN NOINHERIT;
  END IF;
END
$$;

-- Role authenticated (para requisições autenticadas)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN NOINHERIT;
  END IF;
END
$$;

-- Role service_role (para operações administrativas)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
  END IF;
END
$$;

-- Role authenticator (usada pelo PostgREST)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticator') THEN
    CREATE ROLE authenticator NOINHERIT LOGIN;
  END IF;
END
$$;

-- Conceder permissões
GRANT anon TO authenticator;
GRANT authenticated TO authenticator;
GRANT service_role TO authenticator;

-- Permissões para schemas
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;

-- Permissões para tabelas no schema public
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

-- Permissões default para novas tabelas
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;

-- =====================================================
-- Função auth.uid() para RLS
-- =====================================================
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS UUID
LANGUAGE SQL
STABLE
AS $$
  SELECT NULLIF(
    current_setting('request.jwt.claims', true)::jsonb->>'sub',
    ''
  )::UUID
$$;

-- Função auth.role() para RLS
CREATE OR REPLACE FUNCTION auth.role()
RETURNS TEXT
LANGUAGE SQL
STABLE
AS $$
  SELECT NULLIF(
    current_setting('request.jwt.claims', true)::jsonb->>'role',
    ''
  )::TEXT
$$;

-- Função auth.email() para RLS
CREATE OR REPLACE FUNCTION auth.email()
RETURNS TEXT
LANGUAGE SQL
STABLE
AS $$
  SELECT NULLIF(
    current_setting('request.jwt.claims', true)::jsonb->>'email',
    ''
  )::TEXT
$$;

-- =====================================================
-- Bucket padrão para avatars
-- =====================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- Conclusão
-- =====================================================
SELECT 'Banco de dados inicializado com sucesso!' as status;
