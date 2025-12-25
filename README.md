# 🎱 Sistema de Gerenciamento de Bingo

Sistema completo para gerenciamento de sorteios de bingo, vendedores, cartelas e vendas.

## 📋 Índice

- [Funcionalidades](#-funcionalidades)
- [Tecnologias](#-tecnologias)
- [Estrutura do Projeto](#-estrutura-do-projeto)
- [Instalação Rápida](#-instalação-rápida)
- [Opções de Deploy](#-opções-de-deploy)
- [Deploy com Lovable Cloud](#-deploy-com-lovable-cloud)
- [Deploy com Docker](#-deploy-com-docker)
- [Deploy Self-Hosted](#-deploy-self-hosted-100-independente)
- [Auto-Instalador Web](#-auto-instalador-web)
- [Primeiro Acesso](#-primeiro-acesso)
- [Suporte](#-suporte)

---

## ✨ Funcionalidades

- **Autenticação de Usuários**: Sistema de login com roles (admin/user)
- **Gerenciamento de Sorteios**: Criar, editar e gerenciar múltiplos sorteios
- **Múltiplos Prêmios**: Suporte a vários prêmios por sorteio (1º, 2º, 3º lugar, etc.)
- **Controle de Vendedores**: Cadastro e gestão de vendedores
- **Cartelas**: Geração automática e controle de cartelas
- **Atribuições**: Distribuição de cartelas para vendedores
- **Vendas**: Registro e acompanhamento de vendas
- **Relatórios**: Dashboard com estatísticas e exportação de dados
- **Multi-usuário**: Cada usuário gerencia seus próprios sorteios

---

## 🛠 Tecnologias

| Camada | Tecnologias |
|--------|-------------|
| **Frontend** | React, TypeScript, Vite, Tailwind CSS, shadcn/ui |
| **Backend** | Supabase Edge Functions |
| **Banco de Dados** | PostgreSQL |
| **Infraestrutura** | Docker, Nginx, Traefik |

---

## 📁 Estrutura do Projeto

```
bingopgm/
├── src/                    # Código fonte do frontend
├── backend/               # Backend Node.js
├── database/              # Scripts SQL e migrações
│   ├── README.md         # Documentação do banco
│   └── init-db.sql       # Script principal de inicialização ⭐
├── docs/                  # Documentação do projeto
│   ├── README.md
│   ├── IMPLEMENTATION_*.md
│   ├── README-*.md (guias de deploy)
│   └── VISUAL_*.md
├── deploy/               # Arquivos de deploy
│   ├── docker-compose.*.yml
│   ├── portainer-stack*.yml
│   └── kong*.yml
├── scripts/              # Scripts auxiliares
│   ├── install.sh
│   └── install-swarm.sh
└── README.md            # Este arquivo
```

**Dica:** Cada diretório tem seu próprio README.md com documentação específica!

---

## 🚀 Instalação Rápida

### Opção 1: Auto-Instalador Web (Mais Simples) ✨

1. Execute o sistema com Docker:
```bash
docker-compose -f deploy/docker-compose.selfhosted.yml up -d
```

2. Acesse: `http://localhost:3000/setup`

3. Configure o sistema através da interface web:
   - Informe os dados do banco de dados
   - Crie o usuário administrador
   - Sistema pronto para usar!

### Opção 2: Self-Hosted com Script

```bash
curl -sSL https://raw.githubusercontent.com/josemaeldon/bingopgm/main/scripts/install.sh | bash
```

### Opção 3: Docker Compose Manual

```bash
# Inicializar banco de dados
psql -U postgres -d bingo -f database/init-db.sql

# Subir serviços
docker-compose -f deploy/docker-compose.selfhosted.yml up -d
```

---

## 📦 Opções de Deploy

| Método | Dificuldade | SSL | Escalável | Uso Recomendado |
|--------|-------------|-----|-----------|-----------------|
| Lovable Cloud | ⭐ | ✅ Automático | ✅ | Desenvolvimento/Produção |
| Docker Simples | ⭐⭐ | ❌ Manual | ❌ | Testes locais |
| Self-Hosted | ⭐⭐⭐ | ❌ Manual | ✅ | Produção própria |
| Swarm + Traefik | ⭐⭐⭐⭐ | ✅ Automático | ✅ | Produção enterprise |

---

## ☁️ Deploy com Lovable Cloud

A forma mais simples de usar o sistema. O backend (banco de dados, autenticação, edge functions) é gerenciado automaticamente.

**Vantagens:**
- Zero configuração de infraestrutura
- SSL automático
- Backups automáticos
- Escalabilidade automática

**Imagem Docker:** `josemaeldon/bingo-system:latest`

---

## 🐳 Deploy com Docker

### Arquivos Disponíveis

| Arquivo | Descrição |
|---------|-----------|
| `Dockerfile` | Build padrão (usa Lovable Cloud) |
| `Dockerfile.selfhosted` | Build self-hosted (configurável) |
| `nginx.conf` | Configuração do Nginx |
| `docker-compose.swarm.yml` | Deploy em Swarm (Lovable Cloud) |
| `.dockerignore` | Arquivos ignorados no build |

### Build e Push Manual

```bash
# Login no Docker Hub
docker login

# Build da imagem padrão
docker build -t josemaeldon/bingo-system:latest .

# Build da imagem self-hosted
docker build -f Dockerfile.selfhosted -t josemaeldon/bingo-system:selfhosted .

# Push para Docker Hub
docker push josemaeldon/bingo-system:latest
docker push josemaeldon/bingo-system:selfhosted
```

### GitHub Actions (CI/CD Automático)

O projeto inclui workflow do GitHub Actions que faz build e push automático:

- **Trigger**: Push na `main` ou tags `v*`
- **Imagens geradas**:
  - `josemaeldon/bingo-system:latest` - Versão padrão
  - `josemaeldon/bingo-system:selfhosted` - Versão self-hosted

**Secrets necessários no GitHub:**
- `DOCKER_USERNAME`: Usuário do Docker Hub
- `DOCKER_PASSWORD`: Senha/Token do Docker Hub

### Deploy no Portainer

#### Via Stacks (Recomendado)

1. Acesse **Stacks** → **Add stack**
2. Nome: `bingo-system`
3. Cole o conteúdo do `docker-compose.swarm.yml`
4. Edite o domínio nas labels do Traefik
5. Clique em **Deploy the stack**

#### Via Container Individual

1. **Containers** → **Add container**
2. **Name**: `bingo-system`
3. **Image**: `josemaeldon/bingo-system:latest`
4. **Port mapping**: `80:80`
5. **Network**: Selecione a rede do Traefik
6. Clique em **Deploy the container**

---

## 🏠 Deploy Self-Hosted (100% Independente)

Para rodar o sistema completamente em sua própria infraestrutura, sem depender do Lovable Cloud.

### Arquivos Self-Hosted

| Arquivo | Descrição |
|---------|-----------|
| `Dockerfile.selfhosted` | Dockerfile com variáveis configuráveis |
| `docker-entrypoint.sh` | Script de injeção de variáveis |
| `docker-compose.selfhosted.yml` | Compose simples com PostgreSQL |
| `docker-compose.supabase-selfhosted.yml` | Supabase completo local |
| `kong.yml` | Configuração do API Gateway |
| `init-db.sql` | Script de inicialização do banco |
| `.env.selfhosted` | Template de variáveis |
| `install.sh` | Script de instalação automatizada |

### Instalação Automatizada

```bash
# Instala tudo automaticamente
curl -sSL https://raw.githubusercontent.com/josemaeldon/bingo-system/main/install.sh | bash
```

O script irá:
1. ✅ Verificar requisitos (Docker, Docker Compose)
2. ✅ Criar diretório de instalação
3. ✅ Baixar arquivos necessários
4. ✅ Gerar senhas seguras
5. ✅ Configurar IP/portas interativamente
6. ✅ Iniciar containers
7. ✅ Criar script de gerenciamento

### Instalação Manual

```bash
# 1. Clonar/baixar arquivos
git clone https://github.com/josemaeldon/bingo-system.git
cd bingo-system

# 2. Copiar template de variáveis
cp .env.selfhosted .env

# 3. Editar variáveis
nano .env

# 4. Build da imagem
docker build -f Dockerfile.selfhosted -t josemaeldon/bingo-system:selfhosted .

# 5. Iniciar containers
docker-compose -f docker-compose.supabase-selfhosted.yml up -d
```

### Serviços Disponíveis (Self-Hosted)

| Serviço | Porta | URL |
|---------|-------|-----|
| Sistema (Frontend) | 80 | http://localhost |
| Kong (API Gateway) | 8000 | http://localhost:8000 |
| Supabase Studio | 3001 | http://localhost:3001 |
| PostgreSQL | 5432 | localhost:5432 |

### Variáveis de Ambiente

```env
# Obrigatórias
POSTGRES_PASSWORD=sua-senha-super-secreta
JWT_SECRET=seu-jwt-com-pelo-menos-32-caracteres

# URLs (ajuste para seu servidor)
API_EXTERNAL_URL=http://localhost:8000
SITE_URL=http://localhost

# Keys Supabase (gere novas para produção!)
ANON_KEY=sua_anon_key
SERVICE_ROLE_KEY=sua_service_role_key
```

### Gerando Novas Chaves JWT

```bash
# Gerar JWT_SECRET
openssl rand -base64 32

# Para ANON_KEY e SERVICE_ROLE_KEY:
# https://supabase.com/docs/guides/self-hosting/docker#generate-api-keys
```

---

## 🌐 Deploy em Docker Swarm com Traefik

Para ambientes de produção com alta disponibilidade, SSL automático e escalabilidade.

### Instalação Automatizada

```bash
curl -sSL https://raw.githubusercontent.com/josemaeldon/bingo-system/main/install-swarm.sh | bash
```

O script irá:
1. ✅ Verificar/inicializar Docker Swarm
2. ✅ Solicitar domínio e email para SSL
3. ✅ Criar rede overlay
4. ✅ Configurar Traefik com Let's Encrypt
5. ✅ Gerar senhas seguras
6. ✅ Deploy de todos os serviços
7. ✅ Salvar credenciais em arquivo seguro

### URLs com SSL

| Serviço | URL |
|---------|-----|
| Sistema | https://bingo.seudominio.com |
| API Supabase | https://api.bingo.seudominio.com |
| Studio | https://studio.bingo.seudominio.com |
| Traefik | https://traefik.bingo.seudominio.com |

### Pré-requisitos

- Docker Swarm inicializado (`docker swarm init`)
- Domínio apontando para o servidor
- Portas 80 e 443 abertas

### Instalação Manual Swarm

```bash
# 1. Inicializar Swarm
docker swarm init

# 2. Criar rede
docker network create --driver=overlay --attachable traefik-public

# 3. Clonar projeto
git clone https://github.com/josemaeldon/bingo-system.git
cd bingo-system

# 4. Configurar variáveis
cp .env.selfhosted .env
nano .env

# 5. Deploy Traefik
docker stack deploy -c traefik-stack.yml traefik

# 6. Deploy Bingo
docker stack deploy -c bingo-stack.yml bingo
```

### Escalar Serviços

```bash
# Escalar frontend para 3 réplicas
docker service scale bingo_app=3

# Ou via script
./bingo.sh scale app 3
```

### Docker Compose para Swarm (Simples)

Se você já tem Traefik rodando, use o `docker-compose.swarm.yml`:

```yaml
version: "3.7"

services:
  app:
    image: josemaeldon/bingo-system:latest
    deploy:
      replicas: 1
      labels:
        - "traefik.enable=true"
        - "traefik.docker.network=luzianet"
        - "traefik.http.routers.bingo.rule=Host(`bingo.seudominio.com`)"
        - "traefik.http.routers.bingo.entrypoints=websecure"
        - "traefik.http.routers.bingo.tls.certresolver=letsencryptresolver"
        - "traefik.http.services.bingo-service.loadbalancer.server.port=80"
    networks:
      - luzianet

networks:
  luzianet:
    external: true
```

```bash
docker stack deploy -c docker-compose.swarm.yml bingo
```

---

## 🖥 Instalação Manual em Servidor Linux

Para instalação sem Docker, diretamente no sistema operacional.

### Pré-requisitos

- Ubuntu 20.04+ ou Debian 11+
- Node.js 18+ e npm
- PostgreSQL 14+
- Nginx
- Git

### 1. Instalar Dependências

```bash
# Atualizar pacotes
sudo apt update && sudo apt upgrade -y

# Instalar Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Instalar Git, Nginx e PostgreSQL
sudo apt install -y git nginx postgresql postgresql-contrib
```

### 2. Configurar PostgreSQL

```bash
sudo -u postgres psql

# No psql:
CREATE DATABASE bingo_db;
CREATE USER bingo_user WITH ENCRYPTED PASSWORD 'sua_senha_segura';
GRANT ALL PRIVILEGES ON DATABASE bingo_db TO bingo_user;
\q
```

### 3. Executar Schema do Banco

```bash
# Conectar ao banco
sudo -u postgres psql -d bingo_db

# Executar o conteúdo do init-db.sql
\i init-db.sql
\q
```

### 4. Clonar e Configurar Projeto

```bash
# Criar diretório
sudo mkdir -p /var/www/bingo
sudo chown $USER:$USER /var/www/bingo

# Clonar
cd /var/www/bingo
git clone https://github.com/josemaeldon/bingo-system.git .

# Instalar dependências
npm install

# Configurar variáveis
cp .env.selfhosted .env
nano .env
```

### 5. Build da Aplicação

```bash
npm run build
```

### 6. Configurar Nginx

```bash
sudo nano /etc/nginx/sites-available/bingo
```

```nginx
server {
    listen 80;
    server_name seu_dominio.com.br;
    root /var/www/bingo/dist;
    index index.html;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript;

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
}
```

```bash
# Ativar site
sudo ln -s /etc/nginx/sites-available/bingo /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

### 7. SSL com Let's Encrypt

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d seu_dominio.com.br
```

---

## 🛠 Gerenciamento

### Script de Gerenciamento (Self-Hosted)

Após instalação, use o script `bingo.sh`:

```bash
cd /caminho/instalacao

# Iniciar serviços
./bingo.sh start

# Parar serviços
./bingo.sh stop

# Reiniciar
./bingo.sh restart

# Ver status
./bingo.sh status

# Ver logs (app, postgres, kong, etc)
./bingo.sh logs app

# Atualizar para última versão
./bingo.sh update

# Escalar serviço (Swarm)
./bingo.sh scale app 3

# Backup do banco
./bingo.sh backup

# Restaurar backup
./bingo.sh restore backup_20240101.sql

# Verificar SSL (Swarm)
./bingo.sh ssl-status
```

### Comandos Docker Úteis

```bash
# Ver containers rodando
docker ps

# Ver logs de um container
docker logs -f bingo-app

# Acessar shell do container
docker exec -it bingo-app sh

# Ver uso de recursos
docker stats

# Limpar imagens não utilizadas
docker system prune -a
```

### Comandos Swarm

```bash
# Ver serviços da stack
docker stack services bingo

# Ver tasks de um serviço
docker service ps bingo_app

# Ver logs de um serviço
docker service logs -f bingo_app

# Atualizar imagem
docker service update --image josemaeldon/bingo-system:latest bingo_app

# Rollback
docker service rollback bingo_app
```

---

## 💾 Backup e Restauração

### Docker Compose

```bash
# Backup
docker exec bingo-postgres pg_dump -U postgres postgres > backup_$(date +%Y%m%d).sql

# Restaurar
docker exec -i bingo-postgres psql -U postgres postgres < backup.sql
```

### Docker Swarm

```bash
# Encontrar container do PostgreSQL
CONTAINER=$(docker ps -q -f name=bingo_postgres)

# Backup
docker exec $CONTAINER pg_dump -U postgres postgres > backup_$(date +%Y%m%d).sql

# Restaurar
docker exec -i $CONTAINER psql -U postgres postgres < backup.sql
```

### Backup de Volumes

```bash
# Backup do volume PostgreSQL
docker run --rm -v bingo_postgres_data:/data -v $(pwd):/backup alpine \
  tar czf /backup/postgres_data.tar.gz /data

# Backup do volume Storage
docker run --rm -v bingo_storage_data:/data -v $(pwd):/backup alpine \
  tar czf /backup/storage_data.tar.gz /data

# Restaurar volume
docker run --rm -v bingo_postgres_data:/data -v $(pwd):/backup alpine \
  tar xzf /backup/postgres_data.tar.gz -C /
```

### Instalação Manual

```bash
# Backup
pg_dump -U bingo_user -h localhost bingo_db > backup_$(date +%Y%m%d).sql

# Restaurar
psql -U bingo_user -h localhost bingo_db < backup.sql
```

---

## 📊 Monitoramento

### Health Checks

```bash
# Status do container
docker inspect --format='{{.State.Health.Status}}' bingo-app

# Detalhes do health check
docker inspect --format='{{json .State.Health}}' bingo-app | jq
```

### Logs

```bash
# Docker Compose
docker-compose logs -f

# Docker Swarm
docker service logs -f bingo_app

# Nginx (instalação manual)
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# PostgreSQL (instalação manual)
sudo tail -f /var/log/postgresql/postgresql-14-main.log
```

### Atualizações Automáticas com Watchtower

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

## 🌐 Auto-Instalador Web

O sistema inclui um instalador web automático para facilitar a configuração inicial.

### Como Usar

1. **Primeira Inicialização**
   - Ao acessar o sistema pela primeira vez sem banco configurado
   - Você será automaticamente redirecionado para `/setup`

2. **Configuração do Banco de Dados**
   - Informe o host, porta, nome do banco, usuário e senha
   - O sistema testará a conexão automaticamente

3. **Criação de Tabelas**
   - O instalador criará todas as tabelas necessárias
   - Índices e triggers serão configurados automaticamente

4. **Usuário Administrador**
   - Crie seu usuário administrador inicial
   - Defina nome, email e senha segura

5. **Pronto!**
   - Sistema configurado e pronto para uso
   - Você será redirecionado para o login

### Requisitos

- Banco de dados PostgreSQL já instalado e acessível
- Permissões para criar tabelas no banco

### Proteção

- A rota `/setup` só é acessível quando o banco não está configurado
- Após a instalação, a rota é automaticamente desabilitada
- Para reinstalar, será necessário limpar o banco de dados manualmente

---

## 🔐 Primeiro Acesso

### Credenciais Padrão (Self-Hosted)

- **Email**: `admin@bingo.local`
- **Senha**: `admin123`

⚠️ **IMPORTANTE**: Altere a senha imediatamente após o primeiro login!

### Lovable Cloud

Na primeira vez, será solicitada a criação do usuário administrador. Preencha nome, email e senha.

### Estrutura de Usuários

| Role | Permissões |
|------|------------|
| **Admin** | Criar, editar e excluir outros usuários. Acesso total. |
| **User** | Gerenciar apenas seus próprios sorteios. |

---

## 🧪 Desenvolvimento

```bash
# Instalar dependências
npm install

# Rodar em desenvolvimento
npm run dev

# Build de produção
npm run build

# Preview do build
npm run preview

# Lint
npm run lint
```

---

## 📁 Estrutura de Arquivos Docker

```
.
├── Dockerfile                          # Build padrão (Lovable Cloud)
├── Dockerfile.selfhosted               # Build self-hosted
├── docker-entrypoint.sh                # Script de entrypoint
├── nginx.conf                          # Configuração Nginx
├── .dockerignore                       # Arquivos ignorados
│
├── docker-compose.swarm.yml            # Swarm simples (Lovable Cloud)
├── docker-compose.selfhosted.yml       # Self-hosted simples
├── docker-compose.supabase-selfhosted.yml  # Supabase completo
│
├── kong.yml                            # API Gateway config
├── init-db.sql                         # Schema do banco
├── .env.selfhosted                     # Template de variáveis
│
├── install.sh                          # Instalação automatizada
├── install-swarm.sh                    # Instalação Swarm + Traefik
│
└── .github/workflows/
    └── docker-build.yml                # CI/CD automático
```

---

## ❓ Troubleshooting

### Container não inicia

```bash
# Ver logs detalhados
docker logs bingo-app

# Verificar se portas estão em uso
sudo lsof -i :80
sudo lsof -i :5432
```

### Erro de conexão com banco

```bash
# Verificar se PostgreSQL está rodando
docker exec bingo-postgres pg_isready

# Testar conexão
docker exec -it bingo-postgres psql -U postgres -c "SELECT 1"
```

### SSL não funciona (Swarm)

```bash
# Verificar logs do Traefik
docker service logs traefik_traefik

# Verificar certificado
./bingo.sh ssl-status

# Verificar arquivo acme.json
cat traefik/acme.json
```

### Permissão negada

```bash
# Adicionar usuário ao grupo docker
sudo usermod -aG docker $USER

# Fazer logout e login novamente
```

---

## 📞 Suporte

Para dúvidas ou problemas:

1. Verifique a seção de Troubleshooting acima
2. Consulte os logs do sistema
3. Entre em contato com o administrador

---

## 📄 Licença

Este projeto é de uso privado. Todos os direitos reservados.
