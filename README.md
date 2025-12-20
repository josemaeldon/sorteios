# Sistema de Gerenciamento de Bingo

Sistema completo para gerenciamento de sorteios de bingo, vendedores, cartelas e vendas.

## Funcionalidades

- **Autenticação de Usuários**: Sistema de login com roles (admin/user)
- **Gerenciamento de Sorteios**: Criar, editar e gerenciar múltiplos sorteios
- **Controle de Vendedores**: Cadastro e gestão de vendedores
- **Cartelas**: Geração automática e controle de cartelas
- **Atribuições**: Distribuição de cartelas para vendedores
- **Vendas**: Registro e acompanhamento de vendas
- **Relatórios**: Dashboard com estatísticas e exportação de dados
- **Multi-usuário**: Cada usuário gerencia seus próprios sorteios

## Tecnologias Utilizadas

- **Frontend**: React, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend**: Supabase Edge Functions
- **Banco de Dados**: PostgreSQL

---

## Instalação em Servidor Linux

### Pré-requisitos

- Ubuntu 20.04+ ou Debian 11+
- Node.js 18+ e npm
- PostgreSQL 14+
- Nginx (para produção)
- Git

### 1. Instalar Dependências do Sistema

```bash
# Atualizar pacotes
sudo apt update && sudo apt upgrade -y

# Instalar Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verificar instalação
node --version
npm --version

# Instalar Git
sudo apt install -y git

# Instalar Nginx
sudo apt install -y nginx

# Instalar PostgreSQL
sudo apt install -y postgresql postgresql-contrib
```

### 2. Configurar PostgreSQL

```bash
# Acessar PostgreSQL
sudo -u postgres psql

# Criar banco de dados e usuário
CREATE DATABASE bingo_db;
CREATE USER bingo_user WITH ENCRYPTED PASSWORD 'sua_senha_segura';
GRANT ALL PRIVILEGES ON DATABASE bingo_db TO bingo_user;
\q
```

### 3. Criar Schema do Banco de Dados

Execute o SQL abaixo no PostgreSQL:

```sql
-- Conectar ao banco
\c bingo_db

-- Extensão para UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabela de usuários do sistema
CREATE TABLE usuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    senha VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de sorteios
CREATE TABLE sorteios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    nome VARCHAR(255) NOT NULL,
    descricao TEXT,
    data_sorteio DATE,
    valor_cartela DECIMAL(10,2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'ativo' CHECK (status IN ('ativo', 'finalizado', 'cancelado')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de vendedores
CREATE TABLE vendedores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sorteio_id UUID NOT NULL REFERENCES sorteios(id) ON DELETE CASCADE,
    nome VARCHAR(255) NOT NULL,
    telefone VARCHAR(20),
    email VARCHAR(255),
    comissao DECIMAL(5,2) DEFAULT 0,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de cartelas
CREATE TABLE cartelas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sorteio_id UUID NOT NULL REFERENCES sorteios(id) ON DELETE CASCADE,
    numero INTEGER NOT NULL,
    numeros INTEGER[] NOT NULL,
    status VARCHAR(50) DEFAULT 'disponivel' CHECK (status IN ('disponivel', 'atribuida', 'vendida', 'reservada')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(sorteio_id, numero)
);

-- Tabela de atribuições
CREATE TABLE atribuicoes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sorteio_id UUID NOT NULL REFERENCES sorteios(id) ON DELETE CASCADE,
    vendedor_id UUID NOT NULL REFERENCES vendedores(id) ON DELETE CASCADE,
    data_atribuicao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de cartelas por atribuição
CREATE TABLE atribuicao_cartelas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    atribuicao_id UUID NOT NULL REFERENCES atribuicoes(id) ON DELETE CASCADE,
    cartela_id UUID NOT NULL REFERENCES cartelas(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(atribuicao_id, cartela_id)
);

-- Tabela de vendas
CREATE TABLE vendas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sorteio_id UUID NOT NULL REFERENCES sorteios(id) ON DELETE CASCADE,
    vendedor_id UUID NOT NULL REFERENCES vendedores(id) ON DELETE CASCADE,
    cartela_id UUID NOT NULL REFERENCES cartelas(id) ON DELETE CASCADE,
    comprador_nome VARCHAR(255),
    comprador_telefone VARCHAR(20),
    valor DECIMAL(10,2) NOT NULL,
    data_venda TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de pagamentos
CREATE TABLE pagamentos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vendedor_id UUID NOT NULL REFERENCES vendedores(id) ON DELETE CASCADE,
    sorteio_id UUID NOT NULL REFERENCES sorteios(id) ON DELETE CASCADE,
    valor DECIMAL(10,2) NOT NULL,
    data_pagamento TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para melhor performance
CREATE INDEX idx_sorteios_user_id ON sorteios(user_id);
CREATE INDEX idx_vendedores_sorteio_id ON vendedores(sorteio_id);
CREATE INDEX idx_cartelas_sorteio_id ON cartelas(sorteio_id);
CREATE INDEX idx_cartelas_status ON cartelas(status);
CREATE INDEX idx_atribuicoes_sorteio_id ON atribuicoes(sorteio_id);
CREATE INDEX idx_atribuicoes_vendedor_id ON atribuicoes(vendedor_id);
CREATE INDEX idx_vendas_sorteio_id ON vendas(sorteio_id);
CREATE INDEX idx_vendas_vendedor_id ON vendas(vendedor_id);
CREATE INDEX idx_pagamentos_vendedor_id ON pagamentos(vendedor_id);

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para updated_at
CREATE TRIGGER update_usuarios_updated_at BEFORE UPDATE ON usuarios FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sorteios_updated_at BEFORE UPDATE ON sorteios FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_vendedores_updated_at BEFORE UPDATE ON vendedores FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_cartelas_updated_at BEFORE UPDATE ON cartelas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_atribuicoes_updated_at BEFORE UPDATE ON atribuicoes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_vendas_updated_at BEFORE UPDATE ON vendas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pagamentos_updated_at BEFORE UPDATE ON pagamentos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### 4. Clonar e Configurar o Projeto

```bash
# Criar diretório para a aplicação
sudo mkdir -p /var/www/bingo
sudo chown $USER:$USER /var/www/bingo

# Clonar repositório
cd /var/www/bingo
git clone <URL_DO_REPOSITORIO> .

# Instalar dependências
npm install

# Criar arquivo de variáveis de ambiente
cp .env.example .env
nano .env
```

### 5. Configurar Variáveis de Ambiente

Edite o arquivo `.env`:

```env
# Supabase (se usando Lovable Cloud)
VITE_SUPABASE_URL=sua_url_supabase
VITE_SUPABASE_PUBLISHABLE_KEY=sua_chave_anon

# PostgreSQL (para conexão direta)
POSTGRES_HOST=localhost
POSTGRES_DB=bingo_db
POSTGRES_USER=bingo_user
POSTGRES_PASSWORD=sua_senha_segura
POSTGRES_PORT=5432
```

### 6. Build da Aplicação

```bash
# Gerar build de produção
npm run build

# Os arquivos serão gerados na pasta 'dist'
```

### 7. Configurar Nginx

```bash
# Criar configuração do site
sudo nano /etc/nginx/sites-available/bingo
```

Adicione a configuração:

```nginx
server {
    listen 80;
    server_name seu_dominio.com.br;
    root /var/www/bingo/dist;
    index index.html;

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    # Cache de arquivos estáticos
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA - redirecionar todas as rotas para index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Segurança
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
```

Ativar o site:

```bash
# Criar link simbólico
sudo ln -s /etc/nginx/sites-available/bingo /etc/nginx/sites-enabled/

# Remover configuração padrão
sudo rm /etc/nginx/sites-enabled/default

# Testar configuração
sudo nginx -t

# Reiniciar Nginx
sudo systemctl restart nginx
sudo systemctl enable nginx
```

### 8. Configurar SSL com Let's Encrypt (Opcional mas Recomendado)

```bash
# Instalar Certbot
sudo apt install -y certbot python3-certbot-nginx

# Gerar certificado
sudo certbot --nginx -d seu_dominio.com.br

# Renovação automática (já configurada por padrão)
sudo certbot renew --dry-run
```

### 9. Configurar Firewall

```bash
# Permitir HTTP e HTTPS
sudo ufw allow 'Nginx Full'
sudo ufw allow ssh
sudo ufw enable
```

### 10. Configurar PostgreSQL para Acesso Remoto (Opcional)

Se precisar acessar o banco remotamente:

```bash
# Editar postgresql.conf
sudo nano /etc/postgresql/14/main/postgresql.conf
# Alterar: listen_addresses = '*'

# Editar pg_hba.conf
sudo nano /etc/postgresql/14/main/pg_hba.conf
# Adicionar: host all all 0.0.0.0/0 md5

# Reiniciar PostgreSQL
sudo systemctl restart postgresql

# Liberar porta no firewall
sudo ufw allow 5432/tcp
```

---

## Primeiro Acesso

1. Acesse o sistema pelo navegador
2. Na primeira vez, será solicitado a criação do usuário administrador
3. Preencha nome, email e senha do admin
4. Após criar, faça login com as credenciais

---

## Estrutura de Usuários

- **Admin**: Pode criar, editar e excluir outros usuários
- **User**: Pode gerenciar apenas seus próprios sorteios

---

## Scripts Úteis

```bash
# Desenvolvimento
npm run dev

# Build de produção
npm run build

# Preview do build
npm run preview

# Lint
npm run lint
```

---

## Backup do Banco de Dados

```bash
# Criar backup
pg_dump -U bingo_user -h localhost bingo_db > backup_$(date +%Y%m%d).sql

# Restaurar backup
psql -U bingo_user -h localhost bingo_db < backup_20240101.sql
```

---

## Logs e Monitoramento

```bash
# Logs do Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Logs do PostgreSQL
sudo tail -f /var/log/postgresql/postgresql-14-main.log

# Status dos serviços
sudo systemctl status nginx
sudo systemctl status postgresql
```

---

## Suporte

Para dúvidas ou problemas, entre em contato com o administrador do sistema.
