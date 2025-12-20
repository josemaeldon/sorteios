#!/bin/bash

# =====================================================
# BINGO SYSTEM - Script de Deploy para Docker Swarm
# =====================================================

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "============================================="
echo "  BINGO SYSTEM - Deploy Docker Swarm"
echo "============================================="
echo -e "${NC}"

# Verificar se está rodando como root ou com sudo
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Por favor, execute como root ou com sudo${NC}"
  exit 1
fi

# Variáveis de configuração
DOMAIN="${DOMAIN:-bingo.exemplo.com}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-bingo_db}"
DB_USER="${DB_USER:-postgres}"
DB_PASS="${DB_PASS:-}"
JWT_SECRET="${JWT_SECRET:-}"
ANON_KEY="${ANON_KEY:-}"
SERVICE_ROLE_KEY="${SERVICE_ROLE_KEY:-}"

# Verificar variáveis obrigatórias
echo -e "${YELLOW}Verificando variáveis de ambiente...${NC}"

if [ -z "$DB_PASS" ]; then
  echo -e "${RED}ERRO: DB_PASS não definida!${NC}"
  echo "Export a variável: export DB_PASS='sua_senha'"
  exit 1
fi

if [ -z "$JWT_SECRET" ]; then
  echo -e "${YELLOW}JWT_SECRET não definida. Gerando automaticamente...${NC}"
  JWT_SECRET=$(openssl rand -hex 32)
  echo -e "${GREEN}JWT_SECRET gerado: ${JWT_SECRET}${NC}"
fi

if [ -z "$ANON_KEY" ] || [ -z "$SERVICE_ROLE_KEY" ]; then
  echo -e "${YELLOW}Chaves JWT não definidas. Use o script generate-jwt-keys.sh para gerá-las.${NC}"
  exit 1
fi

echo -e "${GREEN}Variáveis OK!${NC}"
echo ""

# Criar rede externa se não existir
echo -e "${BLUE}Verificando rede luzianet...${NC}"
if ! docker network inspect luzianet > /dev/null 2>&1; then
  echo -e "${YELLOW}Criando rede luzianet...${NC}"
  docker network create --driver overlay --attachable luzianet
fi
echo -e "${GREEN}Rede OK!${NC}"
echo ""

# Criar volume para storage
echo -e "${BLUE}Verificando volume bingo_storage_data...${NC}"
if ! docker volume inspect bingo_storage_data > /dev/null 2>&1; then
  echo -e "${YELLOW}Criando volume bingo_storage_data...${NC}"
  docker volume create bingo_storage_data
fi
echo -e "${GREEN}Volume OK!${NC}"
echo ""

# Criar config do Kong
echo -e "${BLUE}Criando config do Kong...${NC}"
if docker config inspect bingo_kong_config > /dev/null 2>&1; then
  echo -e "${YELLOW}Removendo config existente...${NC}"
  docker config rm bingo_kong_config
fi

# Substituir variáveis no arquivo kong
cat kong-swarm.yml | \
  sed "s|\${SUPABASE_SERVICE_KEY}|${SERVICE_ROLE_KEY}|g" | \
  docker config create bingo_kong_config -

echo -e "${GREEN}Config do Kong criada!${NC}"
echo ""

# Deploy da stack
echo -e "${BLUE}Fazendo deploy da stack...${NC}"

DOMAIN=$DOMAIN \
DB_HOST=$DB_HOST \
DB_PORT=$DB_PORT \
DB_NAME=$DB_NAME \
DB_USER=$DB_USER \
DB_PASS=$DB_PASS \
JWT_SECRET=$JWT_SECRET \
ANON_KEY=$ANON_KEY \
SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY \
docker stack deploy -c portainer-stack-swarm.yml bingo

echo ""
echo -e "${GREEN}============================================="
echo "  Deploy concluído!"
echo "=============================================${NC}"
echo ""
echo -e "${BLUE}URLs da aplicação:${NC}"
echo "  - App:     https://${DOMAIN}"
echo "  - API:     https://api.${DOMAIN}"
echo "  - Studio:  https://studio.${DOMAIN}"
echo ""
echo -e "${YELLOW}Verifique os serviços com:${NC}"
echo "  docker stack services bingo"
echo ""
echo -e "${YELLOW}Verifique os logs com:${NC}"
echo "  docker service logs bingo_app"
echo "  docker service logs bingo_kong"
echo ""
