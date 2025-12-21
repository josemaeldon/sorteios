# 🎱 Bingo System - Self-Hosted com PostgreSQL e Traefik

Documentação para implantação do Sistema de Bingo em ambiente self-hosted utilizando **PostgreSQL externo** e **Traefik** como proxy reverso.

---

## 📋 Pré-requisitos

- **Docker Swarm** inicializado
- **Traefik** configurado com rede externa
- **PostgreSQL** acessível na rede
- Domínios configurados (ex: `bingo.santaluzia.org` e `api.bingo.santaluzia.org`)
- Certificado SSL via Let's Encrypt (gerenciado pelo Traefik)

---

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                           TRAEFIK                                │
│                    (Proxy Reverso + SSL)                         │
└─────────────────────────────────────────────────────────────────┘
                    │                         │
                    ▼                         ▼
    ┌──────────────────────┐    ┌──────────────────────┐
    │    BINGO FRONTEND    │    │    BINGO BACKEND     │
    │   (bingo.domain.com) │    │ (api.bingo.domain.com)│
    │       Port 80        │    │       Port 3001      │
    └──────────────────────┘    └──────────────────────┘
                                          │
                                          ▼
                              ┌──────────────────────┐
                              │     POSTGRESQL       │
                              │      (Externo)       │
                              └──────────────────────┘
```

---

## 📁 Estrutura de Arquivos

```
/opt/stacks/bingo/
├── docker-compose.yml      # Stack principal
└── .env                    # Variáveis de ambiente (opcional)
```

---

## ⚙️ Configuração

### 1. Criar Diretório da Stack

```bash
mkdir -p /opt/stacks/bingo
cd /opt/stacks/bingo
```

### 2. Criar arquivo `docker-compose.yml`

```yaml
version: "3.8"

services:
  ## --------------------------- BINGO APP (Frontend) --------------------------- ##
  bingo_app:
    image: josemaeldon/bingo-system:app-latest
    environment:
      - VITE_API_BASE_URL=https://api.bingo.santaluzia.org
      - VITE_BASIC_AUTH_USER=${BASIC_AUTH_USER:-}
      - VITE_BASIC_AUTH_PASS=${BASIC_AUTH_PASS:-}
    deploy:
      mode: replicated
      replicas: 1
      placement:
        constraints:
          - node.role == manager
      resources:
        limits:
          cpus: "0.5"
          memory: 256M
      labels:
        - "traefik.enable=true"
        - "traefik.docker.network=luzianet"
        - "traefik.http.routers.bingo_app.rule=Host(`bingo.santaluzia.org`)"
        - "traefik.http.routers.bingo_app.entrypoints=websecure"
        - "traefik.http.routers.bingo_app.tls.certresolver=letsencryptresolver"
        - "traefik.http.routers.bingo_app.priority=1"
        - "traefik.http.services.bingo_app.loadbalancer.server.port=80"
    networks:
      - luzianet

  ## --------------------------- BINGO BACKEND (Node.js API) --------------------------- ##
  bingo_backend:
    image: josemaeldon/bingo-system:backend-latest
    environment:
      - POSTGRES_HOST=${POSTGRES_HOST:-postgres}
      - POSTGRES_PORT=${POSTGRES_PORT:-5432}
      - POSTGRES_DB=${POSTGRES_DB:-bingo_db}
      - POSTGRES_USER=${POSTGRES_USER:-postgres}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
      - JWT_SECRET=${JWT_SECRET}
      - BASIC_AUTH_USER=${BASIC_AUTH_USER:-}
      - BASIC_AUTH_PASS=${BASIC_AUTH_PASS:-}
    deploy:
      mode: replicated
      replicas: 1
      placement:
        constraints:
          - node.role == manager
      resources:
        limits:
          cpus: "0.5"
          memory: 256M
      labels:
        - "traefik.enable=true"
        - "traefik.docker.network=luzianet"
        - "traefik.http.routers.bingo_backend.rule=Host(`api.bingo.santaluzia.org`)"
        - "traefik.http.routers.bingo_backend.entrypoints=websecure"
        - "traefik.http.routers.bingo_backend.tls.certresolver=letsencryptresolver"
        - "traefik.http.routers.bingo_backend.priority=1"
        - "traefik.http.services.bingo_backend.loadbalancer.server.port=3001"
    networks:
      - luzianet

networks:
  luzianet:
    external: true
```

### 3. Criar arquivo `.env` (Opcional)

Para maior segurança, crie um arquivo `.env` com as variáveis:

```env
# Banco de Dados PostgreSQL
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=bingo_db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=sua_senha_segura_aqui

# JWT Secret (gere uma string aleatória forte)
JWT_SECRET=sua_chave_jwt_muito_segura_aqui_com_pelo_menos_32_caracteres

# Basic Auth (opcional - para proteção adicional)
BASIC_AUTH_USER=
BASIC_AUTH_PASS=
```

---

## 🔐 Variáveis de Ambiente

### Frontend (bingo_app)

| Variável | Descrição | Obrigatório |
|----------|-----------|-------------|
| `VITE_API_BASE_URL` | URL completa da API backend | ✅ Sim |
| `VITE_BASIC_AUTH_USER` | Usuário Basic Auth (se habilitado) | ❌ Não |
| `VITE_BASIC_AUTH_PASS` | Senha Basic Auth (se habilitado) | ❌ Não |

### Backend (bingo_backend)

| Variável | Descrição | Obrigatório | Padrão |
|----------|-----------|-------------|--------|
| `POSTGRES_HOST` | Host do PostgreSQL | ✅ Sim | `postgres` |
| `POSTGRES_PORT` | Porta do PostgreSQL | ❌ Não | `5432` |
| `POSTGRES_DB` | Nome do banco de dados | ✅ Sim | `bingo_db` |
| `POSTGRES_USER` | Usuário do banco | ✅ Sim | `postgres` |
| `POSTGRES_PASSWORD` | Senha do banco | ✅ Sim | - |
| `JWT_SECRET` | Chave secreta para tokens JWT | ✅ Sim | - |
| `BASIC_AUTH_USER` | Usuário Basic Auth | ❌ Não | - |
| `BASIC_AUTH_PASS` | Senha Basic Auth | ❌ Não | - |

---

## 🗄️ Configuração do PostgreSQL

### Opção A: PostgreSQL na mesma rede Docker

Se o PostgreSQL estiver rodando como container na mesma rede `luzianet`:

```yaml
# No seu docker-compose do PostgreSQL
services:
  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=bingo_db
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=sua_senha_segura
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - luzianet

volumes:
  postgres_data:

networks:
  luzianet:
    external: true
```

### Opção B: PostgreSQL Externo

Se o PostgreSQL estiver em outro servidor:

1. Configure `POSTGRES_HOST` com o IP/hostname do servidor
2. Certifique-se de que a porta 5432 está acessível
3. Verifique as regras de firewall

### Inicialização do Banco de Dados

Execute o script SQL abaixo para criar as tabelas necessárias:

```sql
-- Tabela de Usuários do Sistema
CREATE TABLE IF NOT EXISTS usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    senha_hash TEXT NOT NULL,
    nome TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    ativo BOOLEAN NOT NULL DEFAULT true,
    titulo_sistema TEXT DEFAULT 'Sorteios',
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Tabela de Sorteios
CREATE TABLE IF NOT EXISTS sorteios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    nome TEXT NOT NULL,
    data_sorteio DATE,
    premio TEXT,
    premios JSONB DEFAULT '[]',
    valor_cartela NUMERIC,
    quantidade_cartelas INTEGER DEFAULT 0,
    status TEXT DEFAULT 'ativo',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Tabela de Vendedores
CREATE TABLE IF NOT EXISTS vendedores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sorteio_id UUID NOT NULL REFERENCES sorteios(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    telefone TEXT,
    email TEXT,
    cpf TEXT,
    endereco TEXT,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Tabela de Cartelas
CREATE TABLE IF NOT EXISTS cartelas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sorteio_id UUID NOT NULL REFERENCES sorteios(id) ON DELETE CASCADE,
    numero INTEGER NOT NULL,
    status TEXT DEFAULT 'disponivel',
    vendedor_id UUID REFERENCES vendedores(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(sorteio_id, numero)
);

-- Tabela de Atribuições
CREATE TABLE IF NOT EXISTS atribuicoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sorteio_id UUID NOT NULL REFERENCES sorteios(id) ON DELETE CASCADE,
    vendedor_id UUID NOT NULL REFERENCES vendedores(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(sorteio_id, vendedor_id)
);

-- Tabela de Cartelas por Atribuição
CREATE TABLE IF NOT EXISTS atribuicao_cartelas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    atribuicao_id UUID NOT NULL REFERENCES atribuicoes(id) ON DELETE CASCADE,
    numero_cartela INTEGER NOT NULL,
    status TEXT DEFAULT 'ativa',
    data_atribuicao TIMESTAMP WITH TIME ZONE,
    data_devolucao TIMESTAMP WITH TIME ZONE,
    venda_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Vendas
CREATE TABLE IF NOT EXISTS vendas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sorteio_id UUID NOT NULL REFERENCES sorteios(id) ON DELETE CASCADE,
    vendedor_id UUID REFERENCES vendedores(id),
    cliente_nome TEXT,
    cliente_telefone TEXT,
    numeros_cartelas TEXT,
    valor_total NUMERIC,
    valor_pago NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'pendente',
    data_venda TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Tabela de Pagamentos
CREATE TABLE IF NOT EXISTS pagamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venda_id UUID NOT NULL REFERENCES vendas(id) ON DELETE CASCADE,
    valor NUMERIC,
    forma_pagamento TEXT,
    data_pagamento TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_sorteios_user_id ON sorteios(user_id);
CREATE INDEX IF NOT EXISTS idx_vendedores_sorteio_id ON vendedores(sorteio_id);
CREATE INDEX IF NOT EXISTS idx_cartelas_sorteio_id ON cartelas(sorteio_id);
CREATE INDEX IF NOT EXISTS idx_cartelas_status ON cartelas(status);
CREATE INDEX IF NOT EXISTS idx_atribuicoes_sorteio_id ON atribuicoes(sorteio_id);
CREATE INDEX IF NOT EXISTS idx_vendas_sorteio_id ON vendas(sorteio_id);
```

---

## 🚀 Deploy

### Deploy via Docker Swarm

```bash
cd /opt/stacks/bingo
docker stack deploy -c docker-compose.yml bingo
```

### Verificar Status

```bash
# Ver serviços
docker service ls | grep bingo

# Ver logs do frontend
docker service logs bingo_bingo_app -f

# Ver logs do backend
docker service logs bingo_bingo_backend -f
```

### Atualizar Imagens

```bash
# Forçar atualização das imagens
docker service update --image josemaeldon/bingo-system:app-latest bingo_bingo_app --force
docker service update --image josemaeldon/bingo-system:backend-latest bingo_bingo_backend --force
```

### Remover Stack

```bash
docker stack rm bingo
```

---

## 🌐 Configuração do Traefik

### Rede Externa

Certifique-se de que a rede `luzianet` existe:

```bash
docker network create --driver overlay --attachable luzianet
```

### Labels Traefik Explicadas

```yaml
# Habilita o Traefik para este serviço
- "traefik.enable=true"

# Especifica a rede Docker que o Traefik deve usar
- "traefik.docker.network=luzianet"

# Define a regra de roteamento por hostname
- "traefik.http.routers.bingo_app.rule=Host(`bingo.santaluzia.org`)"

# Define o entrypoint (porta 443 com SSL)
- "traefik.http.routers.bingo_app.entrypoints=websecure"

# Configura o resolver de certificados SSL
- "traefik.http.routers.bingo_app.tls.certresolver=letsencryptresolver"

# Define a porta interna do container
- "traefik.http.services.bingo_app.loadbalancer.server.port=80"
```

---

## 🔒 Segurança

### 1. Gerar JWT Secret Seguro

```bash
openssl rand -base64 32
```

### 2. Gerar Senha PostgreSQL Segura

```bash
openssl rand -hex 32
```

### 3. Basic Auth (Opcional)

Para adicionar uma camada extra de autenticação:

```yaml
environment:
  - BASIC_AUTH_USER=admin
  - BASIC_AUTH_PASS=senha_forte_aqui
```

### 4. Firewall

Certifique-se de que apenas as portas necessárias estão expostas:
- 80 (HTTP - redirect para HTTPS)
- 443 (HTTPS)
- 5432 (PostgreSQL - apenas se externo)

---

## 🔄 Primeiro Acesso

1. Acesse `https://bingo.santaluzia.org`
2. Na primeira vez, será exibida a tela de **Configuração Inicial**
3. Crie o usuário administrador
4. Faça login e comece a usar o sistema

---

## 📊 Monitoramento

### Health Check

```bash
# Verificar se a API está respondendo
curl -s https://api.bingo.santaluzia.org/health

# Verificar se o frontend está acessível
curl -s -o /dev/null -w "%{http_code}" https://bingo.santaluzia.org
```

### Logs em Tempo Real

```bash
# Todos os logs
docker service logs -f bingo_bingo_backend

# Apenas erros
docker service logs bingo_bingo_backend 2>&1 | grep -i error
```

---

## 🛠️ Troubleshooting

### Problema: Container não inicia

```bash
# Verificar status detalhado
docker service ps bingo_bingo_backend --no-trunc

# Ver logs de erro
docker service logs bingo_bingo_backend
```

### Problema: Erro de conexão com PostgreSQL

1. Verificar se o host está acessível:
```bash
docker exec -it $(docker ps -q -f name=bingo_backend) nc -zv postgres 5432
```

2. Verificar credenciais no banco:
```bash
psql -h localhost -U postgres -d bingo_db -c "SELECT 1"
```

### Problema: SSL não funciona

1. Verificar se o Traefik está configurado corretamente:
```bash
docker service logs traefik 2>&1 | grep -i acme
```

2. Verificar se o domínio aponta para o servidor correto:
```bash
nslookup bingo.santaluzia.org
```

### Problema: 502 Bad Gateway

1. Verificar se o serviço está rodando:
```bash
docker service ls | grep bingo
```

2. Verificar se a rede está correta:
```bash
docker network inspect luzianet
```

---

## 📝 Exemplos de Configuração

### Múltiplas Réplicas (Alta Disponibilidade)

```yaml
deploy:
  mode: replicated
  replicas: 3
  update_config:
    parallelism: 1
    delay: 10s
  rollback_config:
    parallelism: 1
    delay: 10s
```

### Limites de Recursos Customizados

```yaml
deploy:
  resources:
    limits:
      cpus: "1.0"
      memory: 512M
    reservations:
      cpus: "0.25"
      memory: 128M
```

---

## 📞 Suporte

Para suporte técnico ou dúvidas sobre a implantação:

- 📧 Email: suporte@exemplo.com
- 📖 Documentação: [Link para docs]
- 🐛 Issues: [Link para issues]

---

## 📄 Licença

Este projeto é distribuído sob a licença MIT.
