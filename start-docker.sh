#!/bin/bash
# Script de início rápido para o Sistema Bingo com Docker

set -e

echo "=========================================="
echo "  Sistema Bingo - Início Rápido Docker   "
echo "=========================================="
echo ""

# Verificar se Docker está instalado
if ! command -v docker &> /dev/null; then
    echo "❌ Docker não está instalado. Por favor, instale o Docker primeiro."
    exit 1
fi

# Verificar se Docker Compose está disponível
if ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose não está disponível. Por favor, instale Docker Compose."
    exit 1
fi

echo "✅ Docker encontrado: $(docker --version)"
echo "✅ Docker Compose encontrado: $(docker compose version)"
echo ""

# Verificar se o arquivo .env.laravel existe
if [ ! -f .env.laravel ]; then
    echo "⚠️  Arquivo .env.laravel não encontrado!"
    echo "   Criando arquivo .env.laravel com configurações padrão..."
    
    cat > .env.laravel << 'EOF'
# MySQL Database Configuration
MYSQL_ROOT_PASSWORD=bingo_root_password
MYSQL_DATABASE=bingo
MYSQL_USER=bingo_user
MYSQL_PASSWORD=bingo_password
MYSQL_PORT=3306

# API Configuration
API_PORT=3001

# Frontend Configuration
FRONTEND_PORT=80
VITE_API_BASE_URL=http://localhost:3001
EOF
    
    echo "✅ Arquivo .env.laravel criado!"
fi

echo ""
echo "📋 Configuração:"
echo "   - MySQL: porta 3306"
echo "   - API Laravel: http://localhost:3001"
echo "   - Frontend: http://localhost"
echo ""

# Perguntar se deseja continuar
read -p "Deseja iniciar o sistema? (s/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[SsYy]$ ]]; then
    echo "❌ Operação cancelada."
    exit 0
fi

# Parar containers existentes se houver
echo "🔄 Verificando containers existentes..."
if docker compose -f docker-compose.laravel.yml ps -q 2>/dev/null | grep -q .; then
    echo "   Parando containers existentes..."
    docker compose -f docker-compose.laravel.yml down
fi

# Construir e iniciar os containers
echo ""
echo "🔨 Construindo imagens Docker (isso pode levar alguns minutos)..."
docker compose -f docker-compose.laravel.yml build

echo ""
echo "🚀 Iniciando containers..."
docker compose -f docker-compose.laravel.yml up -d

echo ""
echo "⏳ Aguardando serviços ficarem prontos..."
sleep 5

# Verificar status
echo ""
echo "📊 Status dos containers:"
docker compose -f docker-compose.laravel.yml ps

echo ""
echo "=========================================="
echo "  ✅ Sistema iniciado com sucesso!       "
echo "=========================================="
echo ""
echo "Acesse:"
echo "  🌐 Frontend: http://localhost"
echo "  🔌 API: http://localhost:3001"
echo "  ❤️  Health Check: http://localhost:3001/health"
echo ""
echo "Para ver os logs:"
echo "  docker compose -f docker-compose.laravel.yml logs -f"
echo ""
echo "Para parar o sistema:"
echo "  docker compose -f docker-compose.laravel.yml down"
echo ""
