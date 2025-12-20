#!/bin/bash

# =====================================================
# SCRIPT DE INSTALAÇÃO - DOCKER SWARM + TRAEFIK
# Sistema de Bingo - Self-Hosted (Produção)
# 
# Uso: curl -sSL https://raw.githubusercontent.com/josemaeldon/bingo-system/main/install-swarm.sh | bash
# =====================================================

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configurações padrão
INSTALL_DIR="${INSTALL_DIR:-/opt/bingo-system}"
DOCKER_IMAGE="josemaeldon/bingo-system:selfhosted"
GITHUB_RAW_URL="https://raw.githubusercontent.com/josemaeldon/bingo-system/main"
STACK_NAME="bingo"
NETWORK_NAME="traefik-public"

# Variáveis que serão configuradas
DOMAIN=""
EMAIL=""
POSTGRES_PASSWORD=""
JWT_SECRET=""

print_banner() {
    echo -e "${CYAN}"
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║                                                           ║"
    echo "║   🎱  BINGO SYSTEM - DOCKER SWARM + TRAEFIK  🎱          ║"
    echo "║                                                           ║"
    echo "║              Instalação para Produção                     ║"
    echo "║           SSL Automático via Let's Encrypt                ║"
    echo "║                                                           ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[✓]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[!]${NC} $1"; }
log_error() { echo -e "${RED}[✗]${NC} $1"; }
log_step() { echo -e "\n${PURPLE}==>${NC} ${CYAN}$1${NC}"; }

# Verificar requisitos
check_requirements() {
    log_step "Verificando requisitos..."
    
    # Verificar Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker não encontrado. Instale com: curl -fsSL https://get.docker.com | sh"
        exit 1
    fi
    log_success "Docker encontrado: $(docker --version)"
    
    # Verificar se está em modo Swarm
    if ! docker info 2>/dev/null | grep -q "Swarm: active"; then
        log_warning "Docker Swarm não está ativo."
        read -p "Deseja inicializar o Swarm agora? (S/n): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Nn]$ ]]; then
            docker swarm init --advertise-addr $(hostname -I | awk '{print $1}') 2>/dev/null || docker swarm init
            log_success "Docker Swarm inicializado!"
        else
            log_error "Docker Swarm é necessário. Execute: docker swarm init"
            exit 1
        fi
    else
        log_success "Docker Swarm ativo"
    fi
    
    # Verificar se é manager
    if ! docker node ls &> /dev/null; then
        log_error "Este nó não é um manager do Swarm."
        exit 1
    fi
    log_success "Nó é manager do Swarm"
}

# Coletar informações
collect_info() {
    log_step "Configuração do domínio e SSL..."
    
    echo ""
    echo -e "${YELLOW}Para SSL automático via Let's Encrypt, você precisa:${NC}"
    echo "  1. Um domínio apontando para este servidor"
    echo "  2. Portas 80 e 443 abertas no firewall"
    echo ""
    
    # Domínio principal
    while [ -z "$DOMAIN" ]; do
        read -p "Digite o domínio para o sistema (ex: bingo.seudominio.com): " DOMAIN
        if [ -z "$DOMAIN" ]; then
            log_error "Domínio é obrigatório!"
        fi
    done
    
    # Email para Let's Encrypt
    while [ -z "$EMAIL" ]; do
        read -p "Digite seu email (para certificados SSL): " EMAIL
        if [ -z "$EMAIL" ]; then
            log_error "Email é obrigatório para Let's Encrypt!"
        fi
    done
    
    # Subdomínios
    read -p "Subdomínio para API Supabase [api.$DOMAIN]: " API_DOMAIN
    API_DOMAIN="${API_DOMAIN:-api.$DOMAIN}"
    
    read -p "Subdomínio para Supabase Studio [studio.$DOMAIN]: " STUDIO_DOMAIN
    STUDIO_DOMAIN="${STUDIO_DOMAIN:-studio.$DOMAIN}"
    
    # Confirmar
    echo ""
    echo -e "${CYAN}Configuração:${NC}"
    echo "  Sistema:  https://$DOMAIN"
    echo "  API:      https://$API_DOMAIN"
    echo "  Studio:   https://$STUDIO_DOMAIN"
    echo "  Email:    $EMAIL"
    echo ""
    read -p "Confirma? (S/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Nn]$ ]]; then
        log_info "Instalação cancelada."
        exit 0
    fi
}

# Criar diretório de instalação
create_install_dir() {
    log_step "Criando diretório de instalação..."
    
    sudo mkdir -p "$INSTALL_DIR"
    sudo chown $USER:$USER "$INSTALL_DIR"
    mkdir -p "$INSTALL_DIR/traefik"
    mkdir -p "$INSTALL_DIR/volumes/postgres"
    mkdir -p "$INSTALL_DIR/volumes/storage"
    cd "$INSTALL_DIR"
    
    log_success "Diretório criado: $INSTALL_DIR"
}

# Gerar senhas seguras
generate_secrets() {
    log_step "Gerando senhas seguras..."
    
    POSTGRES_PASSWORD=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 32)
    JWT_SECRET=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 48)
    
    # Gerar chaves JWT para Supabase
    # Nota: Em produção, gere novas chaves em https://supabase.com/docs/guides/self-hosting
    ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
    SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"
    
    log_success "Senhas geradas!"
}

# Criar rede overlay
create_network() {
    log_step "Criando rede overlay..."
    
    if docker network ls | grep -q "$NETWORK_NAME"; then
        log_info "Rede $NETWORK_NAME já existe"
    else
        docker network create --driver=overlay --attachable "$NETWORK_NAME"
        log_success "Rede $NETWORK_NAME criada"
    fi
}

# Criar arquivo de configuração do Traefik
create_traefik_config() {
    log_step "Criando configuração do Traefik..."
    
    # Arquivo de certificados (precisa existir antes de iniciar)
    touch "$INSTALL_DIR/traefik/acme.json"
    chmod 600 "$INSTALL_DIR/traefik/acme.json"
    
    # Configuração estática do Traefik
    cat > "$INSTALL_DIR/traefik/traefik.yml" << EOF
api:
  dashboard: true
  insecure: false

entryPoints:
  web:
    address: ":80"
    http:
      redirections:
        entryPoint:
          to: websecure
          scheme: https
  websecure:
    address: ":443"

providers:
  docker:
    endpoint: "unix:///var/run/docker.sock"
    swarmMode: true
    exposedByDefault: false
    network: $NETWORK_NAME

certificatesResolvers:
  letsencrypt:
    acme:
      email: $EMAIL
      storage: /etc/traefik/acme.json
      httpChallenge:
        entryPoint: web

log:
  level: INFO
  
accessLog: {}
EOF

    log_success "Configuração do Traefik criada"
}

# Baixar arquivos necessários
download_files() {
    log_step "Baixando arquivos..."
    
    curl -sSL "$GITHUB_RAW_URL/kong.yml" -o kong.yml
    curl -sSL "$GITHUB_RAW_URL/init-db.sql" -o init-db.sql
    
    log_success "Arquivos baixados"
}

# Criar stack do Traefik
create_traefik_stack() {
    log_step "Criando stack do Traefik..."
    
    cat > "$INSTALL_DIR/traefik-stack.yml" << EOF
version: "3.8"

services:
  traefik:
    image: traefik:v2.10
    command:
      - "--configFile=/etc/traefik/traefik.yml"
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./traefik/traefik.yml:/etc/traefik/traefik.yml:ro
      - ./traefik/acme.json:/etc/traefik/acme.json
    networks:
      - $NETWORK_NAME
    deploy:
      mode: replicated
      replicas: 1
      placement:
        constraints:
          - node.role == manager
      labels:
        - "traefik.enable=true"
        - "traefik.http.routers.traefik.rule=Host(\`traefik.$DOMAIN\`)"
        - "traefik.http.routers.traefik.entrypoints=websecure"
        - "traefik.http.routers.traefik.tls.certresolver=letsencrypt"
        - "traefik.http.routers.traefik.service=api@internal"
        - "traefik.http.services.traefik.loadbalancer.server.port=8080"
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3

networks:
  $NETWORK_NAME:
    external: true
EOF

    log_success "Stack do Traefik criada"
}

# Criar stack principal
create_main_stack() {
    log_step "Criando stack principal..."
    
    cat > "$INSTALL_DIR/bingo-stack.yml" << EOF
version: "3.8"

services:
  # ============================================
  # PostgreSQL Database
  # ============================================
  postgres:
    image: supabase/postgres:15.1.1.78
    command:
      - postgres
      - -c
      - config_file=/etc/postgresql/postgresql.conf
    environment:
      POSTGRES_HOST: /var/run/postgresql
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: $POSTGRES_PASSWORD
      POSTGRES_DB: postgres
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init-db.sql:/docker-entrypoint-initdb.d/init.sql:ro
    networks:
      - internal
    deploy:
      mode: replicated
      replicas: 1
      placement:
        constraints:
          - node.role == manager
      restart_policy:
        condition: on-failure

  # ============================================
  # Supabase Auth (GoTrue)
  # ============================================
  auth:
    image: supabase/gotrue:v2.143.0
    environment:
      GOTRUE_API_HOST: 0.0.0.0
      GOTRUE_API_PORT: 9999
      API_EXTERNAL_URL: https://$API_DOMAIN
      GOTRUE_DB_DRIVER: postgres
      GOTRUE_DB_DATABASE_URL: postgres://postgres:$POSTGRES_PASSWORD@postgres:5432/postgres?search_path=auth
      GOTRUE_SITE_URL: https://$DOMAIN
      GOTRUE_URI_ALLOW_LIST: "https://$DOMAIN,https://$DOMAIN/**"
      GOTRUE_DISABLE_SIGNUP: "false"
      GOTRUE_JWT_SECRET: $JWT_SECRET
      GOTRUE_JWT_EXP: 3600
      GOTRUE_JWT_DEFAULT_GROUP_NAME: authenticated
      GOTRUE_EXTERNAL_EMAIL_ENABLED: "true"
      GOTRUE_MAILER_AUTOCONFIRM: "true"
    depends_on:
      - postgres
    networks:
      - internal
    deploy:
      mode: replicated
      replicas: 1
      restart_policy:
        condition: on-failure

  # ============================================
  # Supabase REST API (PostgREST)
  # ============================================
  rest:
    image: postgrest/postgrest:v12.0.1
    environment:
      PGRST_DB_URI: postgres://postgres:$POSTGRES_PASSWORD@postgres:5432/postgres
      PGRST_DB_SCHEMAS: public,storage
      PGRST_DB_ANON_ROLE: anon
      PGRST_JWT_SECRET: $JWT_SECRET
      PGRST_DB_USE_LEGACY_GUCS: "false"
    depends_on:
      - postgres
    networks:
      - internal
    deploy:
      mode: replicated
      replicas: 1
      restart_policy:
        condition: on-failure

  # ============================================
  # Supabase Realtime
  # ============================================
  realtime:
    image: supabase/realtime:v2.28.32
    environment:
      PORT: 4000
      DB_HOST: postgres
      DB_PORT: 5432
      DB_USER: postgres
      DB_PASSWORD: $POSTGRES_PASSWORD
      DB_NAME: postgres
      DB_SSL: "false"
      JWT_SECRET: $JWT_SECRET
      REPLICATION_MODE: RLS
      REPLICATION_POLL_INTERVAL: 100
      SECURE_CHANNELS: "true"
      SLOT_NAME: supabase_realtime_rls
      TEMPORARY_SLOT: "true"
    depends_on:
      - postgres
    networks:
      - internal
    deploy:
      mode: replicated
      replicas: 1
      restart_policy:
        condition: on-failure

  # ============================================
  # Supabase Storage
  # ============================================
  storage:
    image: supabase/storage-api:v0.46.4
    environment:
      ANON_KEY: $ANON_KEY
      SERVICE_KEY: $SERVICE_ROLE_KEY
      POSTGREST_URL: http://rest:3000
      PGRST_JWT_SECRET: $JWT_SECRET
      DATABASE_URL: postgres://postgres:$POSTGRES_PASSWORD@postgres:5432/postgres
      FILE_SIZE_LIMIT: 52428800
      STORAGE_BACKEND: file
      FILE_STORAGE_BACKEND_PATH: /var/lib/storage
      TENANT_ID: stub
      REGION: stub
      GLOBAL_S3_BUCKET: stub
    volumes:
      - storage_data:/var/lib/storage
    depends_on:
      - postgres
      - rest
    networks:
      - internal
    deploy:
      mode: replicated
      replicas: 1
      restart_policy:
        condition: on-failure

  # ============================================
  # Kong API Gateway
  # ============================================
  kong:
    image: kong:2.8.1
    environment:
      KONG_DATABASE: "off"
      KONG_DECLARATIVE_CONFIG: /var/lib/kong/kong.yml
      KONG_DNS_ORDER: LAST,A,CNAME
      KONG_PLUGINS: request-transformer,cors,key-auth,acl,basic-auth
      KONG_NGINX_PROXY_PROXY_BUFFER_SIZE: 160k
      KONG_NGINX_PROXY_PROXY_BUFFERS: 64 160k
      SUPABASE_ANON_KEY: $ANON_KEY
      SUPABASE_SERVICE_KEY: $SERVICE_ROLE_KEY
    volumes:
      - ./kong.yml:/var/lib/kong/kong.yml:ro
    depends_on:
      - auth
      - rest
      - realtime
      - storage
    networks:
      - internal
      - $NETWORK_NAME
    deploy:
      mode: replicated
      replicas: 1
      labels:
        - "traefik.enable=true"
        - "traefik.docker.network=$NETWORK_NAME"
        - "traefik.http.routers.supabase-api.rule=Host(\`$API_DOMAIN\`)"
        - "traefik.http.routers.supabase-api.entrypoints=websecure"
        - "traefik.http.routers.supabase-api.tls.certresolver=letsencrypt"
        - "traefik.http.services.supabase-api.loadbalancer.server.port=8000"
      restart_policy:
        condition: on-failure

  # ============================================
  # Supabase Meta (pg-meta)
  # ============================================
  meta:
    image: supabase/postgres-meta:v0.80.0
    environment:
      PG_META_PORT: 8080
      PG_META_DB_HOST: postgres
      PG_META_DB_PORT: 5432
      PG_META_DB_NAME: postgres
      PG_META_DB_USER: postgres
      PG_META_DB_PASSWORD: $POSTGRES_PASSWORD
    depends_on:
      - postgres
    networks:
      - internal
    deploy:
      mode: replicated
      replicas: 1
      restart_policy:
        condition: on-failure

  # ============================================
  # Supabase Studio (Admin Dashboard)
  # ============================================
  studio:
    image: supabase/studio:20240101-8e4a094
    environment:
      STUDIO_PG_META_URL: http://meta:8080
      POSTGRES_PASSWORD: $POSTGRES_PASSWORD
      DEFAULT_ORGANIZATION_NAME: "Bingo System"
      DEFAULT_PROJECT_NAME: Bingo
      SUPABASE_URL: http://kong:8000
      SUPABASE_PUBLIC_URL: https://$API_DOMAIN
      SUPABASE_ANON_KEY: $ANON_KEY
      SUPABASE_SERVICE_KEY: $SERVICE_ROLE_KEY
    depends_on:
      - kong
      - meta
    networks:
      - internal
      - $NETWORK_NAME
    deploy:
      mode: replicated
      replicas: 1
      labels:
        - "traefik.enable=true"
        - "traefik.docker.network=$NETWORK_NAME"
        - "traefik.http.routers.supabase-studio.rule=Host(\`$STUDIO_DOMAIN\`)"
        - "traefik.http.routers.supabase-studio.entrypoints=websecure"
        - "traefik.http.routers.supabase-studio.tls.certresolver=letsencrypt"
        - "traefik.http.services.supabase-studio.loadbalancer.server.port=3000"
      restart_policy:
        condition: on-failure

  # ============================================
  # Bingo Frontend Application
  # ============================================
  app:
    image: $DOCKER_IMAGE
    environment:
      VITE_SUPABASE_URL: https://$API_DOMAIN
      VITE_SUPABASE_ANON_KEY: $ANON_KEY
      VITE_SUPABASE_PROJECT_ID: selfhosted
    depends_on:
      - kong
    networks:
      - internal
      - $NETWORK_NAME
    deploy:
      mode: replicated
      replicas: 2
      labels:
        - "traefik.enable=true"
        - "traefik.docker.network=$NETWORK_NAME"
        - "traefik.http.routers.bingo-app.rule=Host(\`$DOMAIN\`)"
        - "traefik.http.routers.bingo-app.entrypoints=websecure"
        - "traefik.http.routers.bingo-app.tls.certresolver=letsencrypt"
        - "traefik.http.services.bingo-app.loadbalancer.server.port=80"
      update_config:
        parallelism: 1
        delay: 10s
        failure_action: rollback
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
      resources:
        limits:
          memory: 256M
        reservations:
          memory: 128M

volumes:
  postgres_data:
    driver: local
  storage_data:
    driver: local

networks:
  internal:
    driver: overlay
  $NETWORK_NAME:
    external: true
EOF

    log_success "Stack principal criada"
}

# Criar script de gerenciamento
create_management_script() {
    log_step "Criando script de gerenciamento..."
    
    cat > "$INSTALL_DIR/bingo.sh" << 'SCRIPT'
#!/bin/bash

INSTALL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STACK_NAME="bingo"
TRAEFIK_STACK="traefik"

case "$1" in
    start)
        echo "Iniciando Traefik..."
        docker stack deploy -c "$INSTALL_DIR/traefik-stack.yml" $TRAEFIK_STACK
        sleep 5
        echo "Iniciando Sistema de Bingo..."
        docker stack deploy -c "$INSTALL_DIR/bingo-stack.yml" $STACK_NAME
        ;;
    stop)
        echo "Parando Sistema de Bingo..."
        docker stack rm $STACK_NAME
        read -p "Parar Traefik também? (s/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Ss]$ ]]; then
            docker stack rm $TRAEFIK_STACK
        fi
        ;;
    restart)
        $0 stop
        sleep 10
        $0 start
        ;;
    status)
        echo "=== Traefik ==="
        docker stack services $TRAEFIK_STACK 2>/dev/null || echo "Não está rodando"
        echo ""
        echo "=== Bingo System ==="
        docker stack services $STACK_NAME 2>/dev/null || echo "Não está rodando"
        ;;
    logs)
        SERVICE="${2:-app}"
        docker service logs -f ${STACK_NAME}_${SERVICE}
        ;;
    update)
        echo "Atualizando imagem..."
        docker pull josemaeldon/bingo-system:selfhosted
        docker service update --image josemaeldon/bingo-system:selfhosted ${STACK_NAME}_app
        ;;
    scale)
        if [ -z "$2" ] || [ -z "$3" ]; then
            echo "Uso: $0 scale <serviço> <replicas>"
            echo "Exemplo: $0 scale app 3"
            exit 1
        fi
        docker service scale ${STACK_NAME}_$2=$3
        ;;
    backup)
        BACKUP_FILE="$INSTALL_DIR/backup_$(date +%Y%m%d_%H%M%S).sql"
        echo "Criando backup: $BACKUP_FILE"
        CONTAINER=$(docker ps -q -f name=${STACK_NAME}_postgres)
        docker exec $CONTAINER pg_dump -U postgres postgres > "$BACKUP_FILE"
        echo "Backup criado: $BACKUP_FILE"
        ;;
    restore)
        if [ -z "$2" ]; then
            echo "Uso: $0 restore <arquivo.sql>"
            exit 1
        fi
        CONTAINER=$(docker ps -q -f name=${STACK_NAME}_postgres)
        docker exec -i $CONTAINER psql -U postgres postgres < "$2"
        echo "Backup restaurado!"
        ;;
    ssl-status)
        echo "Verificando certificados SSL..."
        curl -sI https://$DOMAIN 2>/dev/null | head -5
        ;;
    *)
        echo "Sistema de Bingo - Docker Swarm"
        echo ""
        echo "Comandos disponíveis:"
        echo "  ./bingo.sh start              - Iniciar todos os serviços"
        echo "  ./bingo.sh stop               - Parar todos os serviços"
        echo "  ./bingo.sh restart            - Reiniciar todos os serviços"
        echo "  ./bingo.sh status             - Ver status dos serviços"
        echo "  ./bingo.sh logs [serviço]     - Ver logs (app, postgres, kong, etc)"
        echo "  ./bingo.sh update             - Atualizar para última versão"
        echo "  ./bingo.sh scale <srv> <n>    - Escalar serviço (ex: scale app 3)"
        echo "  ./bingo.sh backup             - Criar backup do banco"
        echo "  ./bingo.sh restore <arquivo>  - Restaurar backup"
        echo "  ./bingo.sh ssl-status         - Verificar certificado SSL"
        echo ""
        ;;
esac
SCRIPT

    # Substituir variável de domínio
    sed -i "s|\$DOMAIN|$DOMAIN|g" "$INSTALL_DIR/bingo.sh"
    chmod +x "$INSTALL_DIR/bingo.sh"
    
    log_success "Script de gerenciamento criado"
}

# Deploy das stacks
deploy_stacks() {
    log_step "Fazendo deploy das stacks..."
    
    # Deploy Traefik primeiro
    log_info "Iniciando Traefik..."
    docker stack deploy -c "$INSTALL_DIR/traefik-stack.yml" traefik
    
    # Aguardar Traefik ficar pronto
    echo -n "Aguardando Traefik"
    for i in {1..30}; do
        echo -n "."
        sleep 2
    done
    echo -e " ${GREEN}OK${NC}"
    
    # Deploy stack principal
    log_info "Iniciando Sistema de Bingo..."
    docker stack deploy -c "$INSTALL_DIR/bingo-stack.yml" $STACK_NAME
    
    # Aguardar serviços
    echo -n "Aguardando serviços iniciarem"
    for i in {1..60}; do
        echo -n "."
        sleep 2
    done
    echo -e " ${GREEN}OK${NC}"
    
    log_success "Deploy concluído!"
}

# Salvar credenciais
save_credentials() {
    log_step "Salvando credenciais..."
    
    cat > "$INSTALL_DIR/credentials.txt" << EOF
=====================================================
CREDENCIAIS DO SISTEMA DE BINGO
Gerado em: $(date)
=====================================================

ACESSOS:
  Sistema:        https://$DOMAIN
  API Supabase:   https://$API_DOMAIN
  Studio:         https://$STUDIO_DOMAIN
  Traefik:        https://traefik.$DOMAIN

USUÁRIO ADMIN:
  Email:  admin@bingo.local
  Senha:  admin123

BANCO DE DADOS:
  Host:     postgres (interno)
  User:     postgres
  Password: $POSTGRES_PASSWORD
  Database: postgres

SUPABASE:
  JWT Secret:       $JWT_SECRET
  Anon Key:         $ANON_KEY
  Service Role Key: $SERVICE_ROLE_KEY

IMPORTANTE:
  - Altere a senha do admin após o primeiro login!
  - Mantenha este arquivo em local seguro!
  - Em produção, gere novas chaves JWT em:
    https://supabase.com/docs/guides/self-hosting

=====================================================
EOF

    chmod 600 "$INSTALL_DIR/credentials.txt"
    log_success "Credenciais salvas em: $INSTALL_DIR/credentials.txt"
}

# Imprimir informações finais
print_final_info() {
    echo ""
    echo -e "${GREEN}"
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║                                                           ║"
    echo "║     ✅  INSTALAÇÃO CONCLUÍDA COM SUCESSO!  ✅             ║"
    echo "║                                                           ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo ""
    echo -e "${CYAN}🌐 Acessos (com SSL):${NC}"
    echo ""
    echo -e "   ${GREEN}Sistema:${NC}    https://$DOMAIN"
    echo -e "   ${GREEN}API:${NC}        https://$API_DOMAIN"
    echo -e "   ${GREEN}Studio:${NC}     https://$STUDIO_DOMAIN"
    echo -e "   ${GREEN}Traefik:${NC}    https://traefik.$DOMAIN"
    echo ""
    echo -e "${CYAN}👤 Usuário Admin:${NC}"
    echo ""
    echo -e "   ${YELLOW}Email:${NC}  admin@bingo.local"
    echo -e "   ${YELLOW}Senha:${NC}  admin123"
    echo ""
    echo -e "${RED}⚠️  IMPORTANTE:${NC}"
    echo "   - Aguarde alguns minutos para os certificados SSL serem gerados"
    echo "   - Altere a senha do admin após o primeiro login!"
    echo ""
    echo -e "${CYAN}📁 Arquivos:${NC}"
    echo "   Instalação:   $INSTALL_DIR"
    echo "   Credenciais:  $INSTALL_DIR/credentials.txt"
    echo ""
    echo -e "${CYAN}🛠️  Comandos:${NC}"
    echo ""
    echo "   cd $INSTALL_DIR"
    echo "   ./bingo.sh status    # Ver status"
    echo "   ./bingo.sh logs app  # Ver logs"
    echo "   ./bingo.sh scale app 3  # Escalar para 3 réplicas"
    echo "   ./bingo.sh backup    # Fazer backup"
    echo ""
    echo -e "${CYAN}📊 Verificar serviços:${NC}"
    echo ""
    echo "   docker stack services bingo"
    echo "   docker stack services traefik"
    echo ""
    echo -e "${PURPLE}Obrigado por usar o Sistema de Bingo! 🎱${NC}"
    echo ""
}

# Função principal
main() {
    print_banner
    check_requirements
    collect_info
    create_install_dir
    generate_secrets
    create_network
    create_traefik_config
    download_files
    create_traefik_stack
    create_main_stack
    create_management_script
    deploy_stacks
    save_credentials
    print_final_info
}

# Executar
main "$@"
