#!/bin/sh
set -e

# =====================================================
# BINGO SYSTEM - Docker Entrypoint
# Injeta variáveis de ambiente em runtime
# =====================================================

echo "============================================="
echo "BINGO SYSTEM - Inicializando..."
echo "============================================="

# Verificar variáveis obrigatórias
if [ -z "$VITE_SUPABASE_URL" ]; then
  echo "ERRO: VITE_SUPABASE_URL não definida!"
  exit 1
fi

if [ -z "$VITE_SUPABASE_ANON_KEY" ]; then
  echo "ERRO: VITE_SUPABASE_ANON_KEY não definida!"
  exit 1
fi

echo "Configuração detectada:"
echo "  - SUPABASE_URL: $VITE_SUPABASE_URL"
echo "  - PROJECT_ID: ${VITE_SUPABASE_PROJECT_ID:-local}"

echo ""
echo "Injetando variáveis de ambiente..."

# Replace placeholder values in JS files
find /usr/share/nginx/html -type f -name "*.js" -exec sed -i \
  -e "s|__VITE_SUPABASE_URL__|${VITE_SUPABASE_URL}|g" \
  -e "s|__VITE_SUPABASE_ANON_KEY__|${VITE_SUPABASE_ANON_KEY}|g" \
  -e "s|__VITE_SUPABASE_PUBLISHABLE_KEY__|${VITE_SUPABASE_ANON_KEY}|g" \
  -e "s|__VITE_SUPABASE_PROJECT_ID__|${VITE_SUPABASE_PROJECT_ID:-local}|g" \
  {} \;

echo "Variáveis injetadas com sucesso!"
echo ""
echo "============================================="
echo "Iniciando Nginx..."
echo "============================================="

# Start nginx
exec nginx -g 'daemon off;'
