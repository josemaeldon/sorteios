# Sistema de Gerenciamento de Bingo

Sistema completo para gerenciamento de sorteios de bingo, vendedores, cartelas e vendas.

## Funcionalidades

- **Autenticação de Usuários**: Sistema de login com roles (admin/user)
- **Gerenciamento de Sorteios**: Criar, editar e gerenciar múltiplos sorteios
- **Múltiplos Prêmios**: Suporte a vários prêmios por sorteio (1º, 2º, 3º lugar, etc.)
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

## 🐳 Implantação com Docker e Portainer

Esta seção descreve como implantar o sistema usando Docker, ideal para gerenciamento via Portainer.

### Pré-requisitos

- Docker Engine 20.10+
- Docker Compose 2.0+
- Portainer (opcional, para gerenciamento visual)
- Acesso ao repositório Git

### Arquivos de Configuração Docker

#### 1. Criar `Dockerfile`

Crie o arquivo `Dockerfile` na raiz do projeto:

```dockerfile
# Stage 1: Build
FROM node:18-alpine AS builder

WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./

# Instalar dependências
RUN npm ci

# Copiar código fonte
COPY . .

# Build da aplicação
RUN npm run build

# Stage 2: Produção
FROM nginx:alpine AS production

# Copiar configuração do Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copiar arquivos buildados
COPY --from=builder /app/dist /usr/share/nginx/html

# Expor porta
EXPOSE 80

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
```

#### 2. Criar `nginx.conf`

Crie o arquivo `nginx.conf` na raiz do projeto:

```nginx
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private auth;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml application/javascript application/json;

    # Cache de arquivos estáticos
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
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
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
}
```

#### 3. Criar `docker-compose.yml`

Crie o arquivo `docker-compose.yml` na raiz do projeto:

```yaml
version: '3.8'

services:
  # Aplicação Frontend
  bingo-app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: bingo-frontend
    restart: unless-stopped
    ports:
      - "80:80"
    environment:
      - NODE_ENV=production
    networks:
      - bingo-network
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost/"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    labels:
      - "com.centurylinklabs.watchtower.enable=true"

  # PostgreSQL Database (opcional - se não usar Supabase)
  bingo-db:
    image: postgres:15-alpine
    container_name: bingo-database
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-bingo_db}
      POSTGRES_USER: ${POSTGRES_USER:-bingo_user}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-senha_segura_123}
    volumes:
      - bingo-postgres-data:/var/lib/postgresql/data
      - ./init-db.sql:/docker-entrypoint-initdb.d/init.sql:ro
    ports:
      - "5432:5432"
    networks:
      - bingo-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-bingo_user} -d ${POSTGRES_DB:-bingo_db}"]
      interval: 10s
      timeout: 5s
      retries: 5

networks:
  bingo-network:
    driver: bridge

volumes:
  bingo-postgres-data:
    driver: local
```

#### 4. Criar `.dockerignore`

Crie o arquivo `.dockerignore` na raiz do projeto:

```
node_modules
dist
.git
.gitignore
README.md
.env
.env.*
*.log
.DS_Store
.vscode
.idea
coverage
*.test.ts
*.spec.ts
```

#### 5. Criar arquivo de variáveis de ambiente `.env.docker`

```env
# PostgreSQL
POSTGRES_DB=bingo_db
POSTGRES_USER=bingo_user
POSTGRES_PASSWORD=sua_senha_segura_aqui
POSTGRES_HOST=bingo-db
POSTGRES_PORT=5432

# Supabase (se aplicável)
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sua_chave_publica
```

---

### Implantação via Portainer

#### Método 1: Stack via Docker Compose

1. **Acesse o Portainer** e faça login
2. Navegue até **Stacks** → **Add stack**
3. Escolha um nome para a stack (ex: `bingo-system`)
4. Cole o conteúdo do `docker-compose.yml` ou faça upload do arquivo
5. Em **Environment variables**, adicione as variáveis necessárias:
   - `POSTGRES_DB`: bingo_db
   - `POSTGRES_USER`: bingo_user
   - `POSTGRES_PASSWORD`: sua_senha_segura
6. Clique em **Deploy the stack**

#### Método 2: Build via Git Repository

1. No Portainer, vá para **Stacks** → **Add stack**
2. Selecione **Repository**
3. Configure:
   - **Repository URL**: URL do seu repositório Git
   - **Reference**: branch principal (main/master)
   - **Compose path**: docker-compose.yml
4. Adicione as variáveis de ambiente
5. Clique em **Deploy the stack**

#### Método 3: Container Individual (sem Compose)

1. Primeiro, faça o build da imagem localmente:
```bash
docker build -t bingo-app:latest .
```

2. No Portainer:
   - Vá para **Images** → **Build a new image**
   - Ou faça upload da imagem para um registry
   
3. Crie o container:
   - **Containers** → **Add container**
   - **Name**: bingo-frontend
   - **Image**: bingo-app:latest
   - **Port mapping**: 80 → 80
   - Configure restart policy: **Unless stopped**

---

### Comandos Docker Úteis

```bash
# Build da imagem
docker build -t bingo-app:latest .

# Executar com docker-compose
docker-compose up -d

# Ver logs
docker-compose logs -f bingo-app

# Parar containers
docker-compose down

# Rebuild sem cache
docker-compose build --no-cache

# Ver status dos containers
docker-compose ps

# Acessar shell do container
docker exec -it bingo-frontend sh

# Backup do banco de dados
docker exec bingo-database pg_dump -U bingo_user bingo_db > backup_$(date +%Y%m%d).sql

# Restaurar backup
docker exec -i bingo-database psql -U bingo_user bingo_db < backup.sql
```

---

### Publicando Imagem no Docker Hub

Para disponibilizar sua imagem Docker para deploy em qualquer servidor:

#### 1. Fazer login no Docker Hub

```bash
docker login
```

#### 2. Build e tag da imagem

```bash
# Build da imagem
docker build -t seuusuario/bingo-system:latest .

# Tag com versão específica
docker build -t seuusuario/bingo-system:1.0.0 .
```

#### 3. Push para o Docker Hub

```bash
docker push seuusuario/bingo-system:latest
docker push seuusuario/bingo-system:1.0.0
```

---

### Deploy em Docker Swarm Mode com Traefik

Para deploy em ambiente de produção com Docker Swarm, Traefik e SSL automático via Let's Encrypt:

#### docker-compose.swarm.yml

```yaml
version: "3.7"

services:
  app:
    image: seuusuario/bingo-system:latest  ## Substitua pelo seu usuário do Docker Hub
    working_dir: /usr/share/nginx/html
    deploy:
      replicas: 1
      placement:
        constraints:
          - node.role == manager
      labels:
        - "traefik.enable=true"
        - "traefik.docker.network=sua-rede"
        - "traefik.http.routers.bingo.rule=Host(`bingo.seudominio.com`)"
        - "traefik.http.routers.bingo.entrypoints=websecure"
        - "traefik.http.routers.bingo.tls=true"
        - "traefik.http.routers.bingo.tls.certresolver=letsencryptresolver"
        - "traefik.http.middlewares.redirect-to-https.redirectscheme.scheme=https"
        - "traefik.http.routers.bingo.middlewares=redirect-to-https"
        - "traefik.http.routers.bingo.service=bingo-service"
        - "traefik.http.services.bingo-service.loadbalancer.server.port=80"
      update_config:
        parallelism: 1
        delay: 10s
        failure_action: rollback
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
    networks:
      - sua-rede

networks:
  sua-rede:
    external: true
```

#### Deploy da Stack no Swarm

```bash
# Inicializar Swarm (se ainda não estiver)
docker swarm init

# Criar rede externa (se não existir)
docker network create --driver=overlay --attachable sua-rede

# Deploy da stack
docker stack deploy -c docker-compose.swarm.yml bingo

# Verificar status
docker stack services bingo

# Ver logs
docker service logs bingo_app -f

# Atualizar para nova versão
docker service update --image seuusuario/bingo-system:1.0.1 bingo_app
```

#### Exemplo Completo com Traefik já configurado

Se você já tem o Traefik rodando no seu cluster:

```yaml
version: "3.7"

services:
  app:
    image: seuusuario/bingo-system:1.0.0
    deploy:
      replicas: 2
      placement:
        constraints:
          - node.role == manager
      labels:
        - "traefik.enable=true"
        - "traefik.docker.network=luzianet"
        - "traefik.http.routers.bingo.rule=Host(`bingo.santaluzia.org`)"
        - "traefik.http.routers.bingo.entrypoints=websecure"
        - "traefik.http.routers.bingo.tls=true"
        - "traefik.http.routers.bingo.tls.certresolver=letsencryptresolver"
        - "traefik.http.middlewares.bingo-redirect.redirectscheme.scheme=https"
        - "traefik.http.routers.bingo.middlewares=bingo-redirect"
        - "traefik.http.routers.bingo.service=bingo-service"
        - "traefik.http.services.bingo-service.loadbalancer.server.port=80"
      update_config:
        parallelism: 1
        delay: 10s
      restart_policy:
        condition: on-failure
    networks:
      - luzianet

networks:
  luzianet:
    external: true
```

> **Nota:** Lembre-se de marcar o registro como "Proxied" na CloudFlare para proteção adicional.

---

### Configuração Traefik Standalone (Compose simples)

Para usar com Traefik em docker-compose tradicional (sem Swarm):

```yaml
version: '3.8'

services:
  bingo-app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: bingo-frontend
    restart: unless-stopped
    networks:
      - traefik-network
      - bingo-network
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.bingo.rule=Host(`bingo.seudominio.com`)"
      - "traefik.http.routers.bingo.entrypoints=websecure"
      - "traefik.http.routers.bingo.tls.certresolver=letsencrypt"
      - "traefik.http.services.bingo.loadbalancer.server.port=80"

networks:
  traefik-network:
    external: true
  bingo-network:
    driver: bridge
```

---

### Monitoramento e Health Checks

O container inclui health checks automáticos. Para verificar:

```bash
# Status do health check
docker inspect --format='{{.State.Health.Status}}' bingo-frontend

# Logs de health check
docker inspect --format='{{json .State.Health}}' bingo-frontend | jq
```

No Portainer, o status de saúde é exibido na lista de containers com indicadores visuais.

---

### Atualizações Automáticas com Watchtower

Para atualizações automáticas, adicione o Watchtower:

```yaml
services:
  watchtower:
    image: containrrr/watchtower
    container_name: watchtower
    restart: unless-stopped
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
      - WATCHTOWER_CLEANUP=true
      - WATCHTOWER_POLL_INTERVAL=86400
    command: --label-enable
```

---

## 🏠 Deploy 100% Self-Hosted

Para rodar o sistema completamente em sua própria infraestrutura, sem depender do Lovable Cloud:

### Arquivos Disponíveis

| Arquivo | Descrição |
|---------|-----------|
| `Dockerfile.selfhosted` | Dockerfile com suporte a variáveis de ambiente em runtime |
| `docker-compose.selfhosted.yml` | Compose simples com PostgreSQL |
| `docker-compose.supabase-selfhosted.yml` | Supabase completo auto-hospedado |
| `docker-entrypoint.sh` | Script para injeção de variáveis |
| `init-db.sql` | Script de inicialização do banco |
| `kong.yml` | Configuração do API Gateway Kong |
| `.env.selfhosted` | Template de variáveis de ambiente |

### Opção 1: Setup Simples (Apenas PostgreSQL)

Para um setup mínimo com apenas o banco de dados:

```bash
# 1. Copiar template de variáveis
cp .env.selfhosted .env

# 2. Editar variáveis (senhas, URLs, etc.)
nano .env

# 3. Build da imagem self-hosted
docker build -f Dockerfile.selfhosted -t josemaeldon/bingo-system:selfhosted .

# 4. Iniciar containers
docker-compose -f docker-compose.selfhosted.yml up -d
```

**⚠️ Nota:** Esta opção requer adaptação do código para usar PostgreSQL direto ao invés de Supabase.

### Opção 2: Supabase Self-Hosted Completo (Recomendado)

Para ter todas as funcionalidades do Supabase rodando localmente:

```bash
# 1. Copiar template de variáveis
cp .env.selfhosted .env

# 2. Gerar novos secrets (IMPORTANTE para produção!)
# Acesse: https://supabase.com/docs/guides/self-hosting/docker#generate-api-keys
# E substitua as chaves no .env

# 3. Editar variáveis
nano .env

# 4. Criar diretório para init scripts
mkdir -p volumes/db/init

# 5. Build da imagem self-hosted
docker build -f Dockerfile.selfhosted -t josemaeldon/bingo-system:selfhosted .

# 6. Iniciar Supabase + App
docker-compose -f docker-compose.supabase-selfhosted.yml up -d
```

#### Serviços Disponíveis

| Serviço | Porta | Descrição |
|---------|-------|-----------|
| **App (Frontend)** | 80 | Interface do sistema |
| **Kong (API Gateway)** | 8000 | Endpoint das APIs |
| **Studio (Dashboard)** | 3001 | Interface admin do Supabase |
| **PostgreSQL** | 5432 | Banco de dados |

#### Acessos

- **Sistema**: http://localhost
- **API Supabase**: http://localhost:8000
- **Supabase Studio**: http://localhost:3001
- **PostgreSQL**: localhost:5432

### Deploy no Portainer (Self-Hosted)

1. Acesse **Stacks** → **Add stack**
2. Nome: `bingo-selfhosted`
3. Cole o conteúdo de `docker-compose.supabase-selfhosted.yml`
4. Em **Environment variables**, adicione:
   - `POSTGRES_PASSWORD`: sua_senha_segura
   - `JWT_SECRET`: seu_jwt_secret_32chars
   - `API_EXTERNAL_URL`: http://seu-servidor:8000
   - `SITE_URL`: http://seu-servidor
5. Clique em **Deploy the stack**

### Variáveis de Ambiente Importantes

```env
# Obrigatórias
POSTGRES_PASSWORD=sua-senha-super-secreta
JWT_SECRET=seu-jwt-com-pelo-menos-32-caracteres

# URLs (ajuste para seu servidor)
API_EXTERNAL_URL=http://localhost:8000
SITE_URL=http://localhost

# Keys (gere novas para produção!)
ANON_KEY=sua_anon_key
SERVICE_ROLE_KEY=sua_service_role_key
```

### Gerando Novas Chaves JWT

Para produção, gere novas chaves:

```bash
# Gerar JWT_SECRET
openssl rand -base64 32

# Para ANON_KEY e SERVICE_ROLE_KEY, use:
# https://supabase.com/docs/guides/self-hosting/docker#generate-api-keys
```

### Configuração com Traefik (Self-Hosted + Produção)

Para deploy em produção com SSL via Traefik:

```yaml
version: "3.8"

services:
  app:
    image: josemaeldon/bingo-system:selfhosted
    environment:
      VITE_SUPABASE_URL: https://api.seudominio.com
      VITE_SUPABASE_ANON_KEY: ${ANON_KEY}
      VITE_SUPABASE_PROJECT_ID: selfhosted
    deploy:
      labels:
        - "traefik.enable=true"
        - "traefik.http.routers.bingo.rule=Host(`bingo.seudominio.com`)"
        - "traefik.http.routers.bingo.entrypoints=websecure"
        - "traefik.http.routers.bingo.tls.certresolver=letsencryptresolver"
        - "traefik.http.services.bingo-service.loadbalancer.server.port=80"
    networks:
      - luzianet
      - supabase-network

  kong:
    image: kong:2.8.1
    # ... configuração do Kong ...
    deploy:
      labels:
        - "traefik.enable=true"
        - "traefik.http.routers.supabase-api.rule=Host(`api.seudominio.com`)"
        - "traefik.http.routers.supabase-api.entrypoints=websecure"
        - "traefik.http.routers.supabase-api.tls.certresolver=letsencryptresolver"
        - "traefik.http.services.supabase-api-service.loadbalancer.server.port=8000"
    networks:
      - luzianet
      - supabase-network

networks:
  luzianet:
    external: true
  supabase-network:
    driver: overlay
```

### Backup Self-Hosted

```bash
# Backup do PostgreSQL
docker exec supabase-postgres pg_dump -U postgres postgres > backup_$(date +%Y%m%d).sql

# Backup dos volumes
docker run --rm -v supabase_postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/postgres_data.tar.gz /data
docker run --rm -v supabase_storage_data:/data -v $(pwd):/backup alpine tar czf /backup/storage_data.tar.gz /data

# Restaurar PostgreSQL
docker exec -i supabase-postgres psql -U postgres postgres < backup.sql
```

### Migração do Lovable Cloud para Self-Hosted

1. **Exportar dados do Lovable Cloud:**
   - Use a ferramenta de export do sistema ou acesse o backend

2. **Importar para Self-Hosted:**
   ```bash
   # Copiar backup para o container
   docker cp backup.sql supabase-postgres:/tmp/
   
   # Importar
   docker exec -it supabase-postgres psql -U postgres postgres -f /tmp/backup.sql
   ```

3. **Atualizar URLs:**
   - Altere `VITE_SUPABASE_URL` para apontar para seu servidor
   - Rebuild da imagem com as novas variáveis

### Usuário Admin Padrão (Self-Hosted)

Ao usar o `init-db.sql`, um usuário admin é criado automaticamente:

- **Email:** admin@bingo.local
- **Senha:** admin123

**⚠️ IMPORTANTE:** Altere a senha imediatamente após o primeiro login!

---

## Instalação em Servidor Linux (Sem Docker)

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
    avatar_url TEXT,
    titulo_sistema VARCHAR(255) DEFAULT 'Sorteios',
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
    quantidade_cartelas INTEGER DEFAULT 0,
    premio TEXT,
    premios JSONB DEFAULT '[]'::jsonb,
    status VARCHAR(50) DEFAULT 'ativo' CHECK (status IN ('ativo', 'agendado', 'em_andamento', 'concluido', 'finalizado', 'cancelado')),
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
    cpf VARCHAR(14),
    endereco TEXT,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de cartelas
CREATE TABLE cartelas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sorteio_id UUID NOT NULL REFERENCES sorteios(id) ON DELETE CASCADE,
    vendedor_id UUID REFERENCES vendedores(id) ON DELETE SET NULL,
    numero INTEGER NOT NULL,
    status VARCHAR(50) DEFAULT 'disponivel' CHECK (status IN ('disponivel', 'ativa', 'vendida', 'devolvida', 'reservada')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(sorteio_id, numero)
);

-- Tabela de atribuições
CREATE TABLE atribuicoes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sorteio_id UUID NOT NULL REFERENCES sorteios(id) ON DELETE CASCADE,
    vendedor_id UUID NOT NULL REFERENCES vendedores(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de cartelas por atribuição
CREATE TABLE atribuicao_cartelas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    atribuicao_id UUID NOT NULL REFERENCES atribuicoes(id) ON DELETE CASCADE,
    numero_cartela INTEGER NOT NULL,
    status VARCHAR(50) DEFAULT 'ativa',
    data_atribuicao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    data_devolucao TIMESTAMP WITH TIME ZONE,
    venda_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de vendas
CREATE TABLE vendas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sorteio_id UUID NOT NULL REFERENCES sorteios(id) ON DELETE CASCADE,
    vendedor_id UUID REFERENCES vendedores(id) ON DELETE SET NULL,
    cliente_nome VARCHAR(255),
    cliente_telefone VARCHAR(20),
    numeros_cartelas TEXT,
    valor_total DECIMAL(10,2) NOT NULL,
    valor_pago DECIMAL(10,2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'pendente' CHECK (status IN ('pendente', 'concluida')),
    data_venda TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de pagamentos
CREATE TABLE pagamentos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    venda_id UUID NOT NULL REFERENCES vendas(id) ON DELETE CASCADE,
    valor DECIMAL(10,2) NOT NULL,
    forma_pagamento VARCHAR(50),
    data_pagamento TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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
CREATE INDEX idx_pagamentos_venda_id ON pagamentos(venda_id);

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

# Logs do Docker (se usando Docker)
docker logs -f bingo-frontend
docker logs -f bingo-database
```

---

## Suporte

Para dúvidas ou problemas, entre em contato com o administrador do sistema.
