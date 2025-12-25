# Scripts - Automation Scripts

Este diretório contém scripts de automação para instalação e configuração do sistema.

## Scripts Disponíveis

### `install.sh` - Instalação Self-Hosted Simples
Script de instalação rápida para ambiente self-hosted com PostgreSQL.

**Uso:**
```bash
curl -sSL https://raw.githubusercontent.com/josemaeldon/bingopgm/main/scripts/install.sh | bash
```

**O que faz:**
- Verifica dependências (Docker, Docker Compose)
- Baixa arquivos de configuração
- Configura variáveis de ambiente
- Inicia os serviços
- Exibe instruções de acesso

### `install-swarm.sh` - Instalação para Docker Swarm
Script de instalação para ambientes de produção com Docker Swarm e Traefik.

**Uso:**
```bash
curl -sSL https://raw.githubusercontent.com/josemaeldon/bingopgm/main/scripts/install-swarm.sh | bash
```

**O que faz:**
- Verifica/inicializa Docker Swarm
- Configura rede overlay
- Deploy da stack completa
- Configura SSL com Let's Encrypt (Traefik)
- Exibe status dos serviços

### `init-supabase-db.sql` - Inicialização para Supabase
Script SQL específico para inicializar o banco de dados no Supabase.

**Uso:**
```bash
# Via Supabase Dashboard
# Cole o conteúdo deste arquivo no SQL Editor e execute

# Via CLI
supabase db execute scripts/init-supabase-db.sql
```

## Outros Scripts Úteis

### Backup do Banco de Dados
```bash
# Backup completo
docker exec bingo-postgres pg_dump -U postgres bingo > backup.sql

# Backup com compressão
docker exec bingo-postgres pg_dump -U postgres bingo | gzip > backup.sql.gz
```

### Restaurar Banco de Dados
```bash
# Restaurar de backup
docker exec -i bingo-postgres psql -U postgres bingo < backup.sql

# Restaurar de backup comprimido
gunzip -c backup.sql.gz | docker exec -i bingo-postgres psql -U postgres bingo
```

### Logs dos Serviços
```bash
# Ver logs do backend
docker logs -f bingo-backend

# Ver logs do PostgreSQL
docker logs -f bingo-postgres

# Ver todos os logs
docker-compose logs -f
```

### Restart dos Serviços
```bash
# Restart completo
docker-compose restart

# Restart apenas do backend
docker-compose restart backend

# Restart apenas do frontend
docker-compose restart frontend
```

## Estrutura de Instalação

### Self-Hosted
```
1. Verifica Docker e Docker Compose
2. Clona/baixa arquivos de configuração
3. Configura .env
4. Inicializa banco de dados
5. Inicia serviços com docker-compose
6. Sistema disponível em http://localhost:3000
```

### Docker Swarm
```
1. Inicializa Swarm (se necessário)
2. Cria redes overlay
3. Deploy da stack
4. Configura Traefik (reverse proxy)
5. Configura SSL automático
6. Sistema disponível em https://seu-dominio.com
```

## Variáveis de Ambiente

Principais variáveis que podem ser configuradas:

```bash
# Banco de Dados
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=bingo
POSTGRES_USER=postgres
POSTGRES_PASSWORD=sua_senha_segura

# Backend
JWT_SECRET=seu_jwt_secret
PORT=3001

# Frontend
VITE_API_URL=http://localhost:3001
```

## Requisitos do Sistema

### Mínimo
- 1 CPU core
- 2GB RAM
- 10GB disco
- Docker 20.10+
- Docker Compose 2.0+

### Recomendado
- 2+ CPU cores
- 4GB+ RAM
- 20GB+ disco SSD
- Docker 24.0+
- Docker Compose 2.20+

## Problemas Comuns

### Porta já em uso
```bash
# Verificar o que está usando a porta
lsof -i :3000
lsof -i :3001
lsof -i :5432

# Matar processo
kill -9 <PID>
```

### Permissões Docker
```bash
# Adicionar usuário ao grupo docker
sudo usermod -aG docker $USER

# Recarregar grupos
newgrp docker
```

### Limpar containers/volumes antigos
```bash
# Parar tudo
docker-compose down -v

# Limpar volumes órfãos
docker volume prune

# Limpar containers parados
docker container prune
```

## Suporte

Para mais informações:
- [README principal](../README.md)
- [Documentação completa](../docs/)
- [Configurações de deploy](../deploy/)
- [Banco de dados](../database/)
