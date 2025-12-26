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

### Deploy com Backend + PostgreSQL Externo

Se você já tem um PostgreSQL rodando em outra stack na mesma rede Docker:

1. **Configure as variáveis de ambiente:**
   - Copie o arquivo `.env.swarm-backend` para `.env`
   - Edite o arquivo `.env` com suas credenciais do PostgreSQL

2. **Use o arquivo correto:**
   ```bash
   # Para Portainer
   Use o arquivo: deploy/portainer-stack-backend-postgres.yml
   
   # Para Docker Swarm
   Use o arquivo: deploy/docker-compose.swarm.yml
   ```

3. **Variáveis importantes:**
   ```yaml
   DB_HOST: postgres          # Nome do serviço PostgreSQL na rede
   DB_PORT: 5432              # Porta do PostgreSQL
   DB_NAME: bingo             # Nome do banco de dados
   DB_USER: postgres          # Usuário do banco
   DB_PASSWORD: sua_senha     # Senha do banco
   ```

4. **Inicialização do banco de dados:**
   - Na primeira execução, acesse o frontend
   - O sistema detectará que o banco não está inicializado
   - Clique em "Inicializar Banco de Dados"
   - O sistema criará automaticamente todas as tabelas necessárias

**IMPORTANTE**: O backend deve estar na mesma rede Docker que o PostgreSQL. No exemplo fornecido, ambos estão na rede `luzianet`.

### Deploy com Portainer

1. Acesse o Portainer
2. Vá em "Stacks"
3. Clique em "Add Stack"
4. Faça upload do arquivo `.yml` desejado:
   - `portainer-stack-backend-postgres.yml` - Para backend + PostgreSQL externo
   - `portainer-stack.yml` - Para stack completa
   - `portainer-stack-traefik.yml` - Para stack com Traefik
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

### Variáveis para Backend com PostgreSQL Externo

Quando o backend precisa conectar a um PostgreSQL em outra stack:

```yaml
environment:
  - DB_TYPE=postgres           # ou mysql
  - DB_HOST=postgres           # Nome do serviço PostgreSQL
  - DB_PORT=5432              # Porta do PostgreSQL
  - DB_NAME=bingo             # Nome do banco de dados
  - DB_USER=postgres          # Usuário do banco
  - DB_PASSWORD=senha         # Senha do banco
  - JWT_SECRET=token_seguro   # Secret para JWT
  - PORT=3001                 # Porta do backend (opcional)
```

📚 **Guia completo:** [docs/GUIA-POSTGRES-EXTERNO.md](../docs/GUIA-POSTGRES-EXTERNO.md)

## Requisitos

- Docker 20.10+
- Docker Compose 2.0+
- 2GB RAM mínimo
- 10GB disco disponível

## Portas Padrão

- Frontend: `80` (dentro do container nginx)
- Backend API: `3001`
- PostgreSQL: `5432`
- Traefik Dashboard: `8080`

## Arquitetura da Comunicação

### Modo PostgreSQL-Only (Recomendado para Deploy Simplificado)

```
Browser → Nginx (port 80) → /api → Backend (port 3001) → PostgreSQL (port 5432)
          └─→ / → Static Files (SPA)
```

- O Nginx serve os arquivos estáticos do frontend e faz proxy das requisições `/api` para o backend
- `VITE_API_BASE_URL` pode ser deixado vazio para usar o proxy interno
- O backend se conecta diretamente ao PostgreSQL usando variáveis de ambiente `DB_*`

### Modo Backend Separado com PostgreSQL Externo (Docker Swarm)

```
Browser → Frontend (port 80) → Backend (port 3001) → PostgreSQL Externo (port 5432)
```

- Frontend e Backend são serviços separados expostos via Traefik
- Frontend faz requisições diretas ao backend via HTTPS
- Backend se conecta ao PostgreSQL que está em outra stack na mesma rede Docker
- **Importante**: Configure as variáveis `DB_*` no backend para apontar ao PostgreSQL

### Notas Importantes

1. **Proxy API**: O nginx.conf inclui configuração de proxy para `/api` que encaminha requisições para o backend
2. **Variáveis de Ambiente**: O backend usa `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
3. **VITE_API_BASE_URL**: Deixe vazio ou não defina para usar o proxy interno do nginx
4. **PostgreSQL Externo**: Se o PostgreSQL está em outra stack na mesma rede, use o nome do serviço como `DB_HOST`

## Suporte

Para mais informações sobre deploy:
- [README principal](../README.md)
- [Guia Self-hosted](../docs/README-SELFHOSTED.md)
- [Guia Traefik](../docs/README-TRAEFIK.md)
