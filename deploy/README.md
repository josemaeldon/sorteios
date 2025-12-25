# Deploy - Arquivos de Implantação

Este diretório contém todos os arquivos necessários para deploy do sistema em diferentes ambientes.

## Estrutura de Arquivos

### Docker Compose

#### Arquivos Principais
- `docker-compose.selfhosted.yml` - Deploy completo self-hosted (PostgreSQL + Backend + Frontend)
- `docker-compose.postgres-only.yml` - Apenas PostgreSQL
- `docker-compose.supabase-selfhosted.yml` - Deploy com Supabase self-hosted
- `docker-compose.swarm.yml` - Deploy em Docker Swarm

### Portainer Stacks

Arquivos para deploy via Portainer:
- `portainer-stack.yml` - Stack padrão
- `portainer-stack-postgres-only.yml` - Stack apenas com PostgreSQL
- `portainer-stack-traefik.yml` - Stack com Traefik (reverse proxy)
- `portainer-stack-swarm.yml` - Stack para Swarm

### Kong API Gateway

Configurações para Kong:
- `kong.yml` - Configuração padrão
- `kong-bingo.yml` - Configuração específica para o Bingo
- `kong-swarm.yml` - Configuração para Swarm

## Como Usar

### Deploy Local/Desenvolvimento

```bash
# Self-hosted completo
docker-compose -f deploy/docker-compose.selfhosted.yml up -d

# Apenas PostgreSQL
docker-compose -f deploy/docker-compose.postgres-only.yml up -d
```

### Deploy com Portainer

1. Acesse o Portainer
2. Vá em "Stacks"
3. Clique em "Add Stack"
4. Faça upload do arquivo `.yml` desejado
5. Configure as variáveis de ambiente
6. Clique em "Deploy"

### Deploy em Produção com Traefik

```bash
docker-compose -f deploy/portainer-stack-traefik.yml up -d
```

Consulte [docs/README-TRAEFIK.md](../docs/README-TRAEFIK.md) para mais detalhes.

### Deploy em Docker Swarm

```bash
# Inicializar Swarm (se ainda não foi feito)
docker swarm init

# Deploy da stack
docker stack deploy -c deploy/docker-compose.swarm.yml bingo
```

## Variáveis de Ambiente

Todas as configurações necessárias estão nos arquivos `.yml`. 

Principais variáveis:
- `POSTGRES_PASSWORD` - Senha do PostgreSQL
- `JWT_SECRET` - Secret para geração de tokens JWT
- `API_URL` - URL da API backend
- `DATABASE_URL` - String de conexão do banco

## Requisitos

- Docker 20.10+
- Docker Compose 2.0+
- 2GB RAM mínimo
- 10GB disco disponível

## Portas Padrão

- Frontend: `3000`
- Backend API: `3001`
- PostgreSQL: `5432`
- Traefik Dashboard: `8080`

## Suporte

Para mais informações sobre deploy:
- [README principal](../README.md)
- [Guia Self-hosted](../docs/README-SELFHOSTED.md)
- [Guia Traefik](../docs/README-TRAEFIK.md)
