#!/bin/bash

# =====================================================
# Build e Push das imagens para Docker Hub
# =====================================================

set -e

DOCKER_USER="${DOCKER_USER:-josemaeldon}"
VERSION="${VERSION:-latest}"

echo "============================================="
echo "BINGO SYSTEM - Build Docker Images"
echo "============================================="
echo "Docker User: $DOCKER_USER"
echo "Version: $VERSION"
echo ""

# Build Frontend
echo "Building Frontend..."
docker build -f Dockerfile.selfhosted -t $DOCKER_USER/bingo-system:app-$VERSION .
docker tag $DOCKER_USER/bingo-system:app-$VERSION $DOCKER_USER/bingo-system:app-latest

# Build Backend
echo "Building Backend..."
docker build -f Dockerfile.backend -t $DOCKER_USER/bingo-system:backend-$VERSION .
docker tag $DOCKER_USER/bingo-system:backend-$VERSION $DOCKER_USER/bingo-system:backend-latest

echo ""
echo "============================================="
echo "Push to Docker Hub"
echo "============================================="

# Push Frontend
echo "Pushing Frontend..."
docker push $DOCKER_USER/bingo-system:app-$VERSION
docker push $DOCKER_USER/bingo-system:app-latest

# Push Backend
echo "Pushing Backend..."
docker push $DOCKER_USER/bingo-system:backend-$VERSION
docker push $DOCKER_USER/bingo-system:backend-latest

echo ""
echo "============================================="
echo "Done!"
echo "============================================="
echo ""
echo "Images:"
echo "  - $DOCKER_USER/bingo-system:app-$VERSION"
echo "  - $DOCKER_USER/bingo-system:backend-$VERSION"
echo ""
echo "Deploy no Swarm:"
echo "  1. Criar volume: docker volume create bingo_postgres_data"
echo "  2. Criar config: docker config create bingo_init_sql init-db.sql"
echo "  3. Deploy: docker stack deploy -c portainer-stack-postgres-only.yml bingo"
