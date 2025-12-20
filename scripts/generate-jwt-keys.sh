#!/bin/bash

# =====================================================
# BINGO SYSTEM - Gerador de Chaves JWT
# =====================================================

set -e

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}"
echo "============================================="
echo "  BINGO SYSTEM - Gerador de Chaves JWT"
echo "============================================="
echo -e "${NC}"

# Verificar se jq está instalado
if ! command -v openssl &> /dev/null; then
  echo "ERRO: openssl não encontrado. Instale-o primeiro."
  exit 1
fi

# JWT Secret
if [ -z "$JWT_SECRET" ]; then
  JWT_SECRET=$(openssl rand -hex 32)
fi

echo -e "${YELLOW}JWT_SECRET:${NC}"
echo "$JWT_SECRET"
echo ""

# Função para gerar JWT
generate_jwt() {
  local role=$1
  local secret=$2
  
  # Header
  local header='{"alg":"HS256","typ":"JWT"}'
  local header_base64=$(echo -n "$header" | openssl base64 -e | tr -d '=' | tr '/+' '_-' | tr -d '\n')
  
  # Payload
  local iat=$(date +%s)
  local exp=$((iat + 315360000)) # 10 anos
  local payload="{\"role\":\"$role\",\"iss\":\"supabase\",\"iat\":$iat,\"exp\":$exp}"
  local payload_base64=$(echo -n "$payload" | openssl base64 -e | tr -d '=' | tr '/+' '_-' | tr -d '\n')
  
  # Signature
  local signature=$(echo -n "${header_base64}.${payload_base64}" | openssl dgst -sha256 -hmac "$secret" -binary | openssl base64 -e | tr -d '=' | tr '/+' '_-' | tr -d '\n')
  
  echo "${header_base64}.${payload_base64}.${signature}"
}

# Gerar ANON_KEY (role: anon)
ANON_KEY=$(generate_jwt "anon" "$JWT_SECRET")

echo -e "${YELLOW}ANON_KEY:${NC}"
echo "$ANON_KEY"
echo ""

# Gerar SERVICE_ROLE_KEY (role: service_role)
SERVICE_ROLE_KEY=$(generate_jwt "service_role" "$JWT_SECRET")

echo -e "${YELLOW}SERVICE_ROLE_KEY:${NC}"
echo "$SERVICE_ROLE_KEY"
echo ""

echo -e "${GREEN}============================================="
echo "  Chaves geradas com sucesso!"
echo "=============================================${NC}"
echo ""
echo -e "${BLUE}Para usar no deploy, exporte as variáveis:${NC}"
echo ""
echo "export JWT_SECRET='$JWT_SECRET'"
echo "export ANON_KEY='$ANON_KEY'"
echo "export SERVICE_ROLE_KEY='$SERVICE_ROLE_KEY'"
echo ""
echo -e "${YELLOW}Ou adicione no Portainer como Environment Variables:${NC}"
echo "  JWT_SECRET = $JWT_SECRET"
echo "  ANON_KEY = $ANON_KEY"
echo "  SERVICE_ROLE_KEY = $SERVICE_ROLE_KEY"
echo ""
