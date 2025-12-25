#!/bin/bash

# =====================================================
# SCRIPT DE INSTALAÇÃO AUTOMATIZADA
# Sistema de Bingo - Self-Hosted
# 
# Uso: curl -sSL https://raw.githubusercontent.com/josemaeldon/bingo-system/main/install.sh | bash
# Ou:  wget -qO- https://raw.githubusercontent.com/josemaeldon/bingo-system/main/install.sh | bash
# =====================================================

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configurações padrão
INSTALL_DIR="${INSTALL_DIR:-$HOME/bingo-system}"
DOCKER_IMAGE="josemaeldon/bingo-system:selfhosted"
GITHUB_RAW_URL="https://raw.githubusercontent.com/josemaeldon/bingo-system/main"

# Função para imprimir banner
print_banner() {
    echo -e "${CYAN}"
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║                                                           ║"
    echo "║     🎱  SISTEMA DE BINGO - INSTALAÇÃO AUTOMATIZADA  🎱    ║"
    echo "║                                                           ║"
    echo "║                    Versão Self-Hosted                     ║"
    echo "║                                                           ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# Função para imprimir mensagens
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
}

log_step() {
    echo -e "\n${PURPLE}==>${NC} ${CYAN}$1${NC}"
}

# Verificar se está rodando como root
check_root() {
    if [ "$EUID" -eq 0 ]; then
        log_warning "Executando como root. Recomendado executar como usuário normal."
    fi
}

# Verificar requisitos
check_requirements() {
    log_step "Verificando requisitos..."
    
    local missing_deps=()
    
    # Verificar Docker
    if ! command -v docker &> /dev/null; then
        missing_deps+=("docker")
    else
        log_success "Docker encontrado: $(docker --version)"
    fi
    
    # Verificar Docker Compose
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        missing_deps+=("docker-compose")
    else
        if docker compose version &> /dev/null; then
            log_success "Docker Compose encontrado: $(docker compose version --short)"
        else
            log_success "Docker Compose encontrado: $(docker-compose --version)"
        fi
    fi
    
    # Verificar curl ou wget
    if ! command -v curl &> /dev/null && ! command -v wget &> /dev/null; then
        missing_deps+=("curl")
    fi
    
    # Se houver dependências faltando
    if [ ${#missing_deps[@]} -gt 0 ]; then
        log_error "Dependências não encontradas: ${missing_deps[*]}"
        echo ""
        echo "Instale as dependências com:"
        echo ""
        echo "  # Ubuntu/Debian:"
        echo "  curl -fsSL https://get.docker.com | sh"
        echo "  sudo usermod -aG docker \$USER"
        echo ""
        echo "  # Depois, faça logout e login novamente"
        echo ""
        exit 1
    fi
    
    # Verificar se Docker está rodando
    if ! docker info &> /dev/null; then
        log_error "Docker não está rodando ou usuário não tem permissão."
        echo ""
        echo "Tente:"
        echo "  sudo systemctl start docker"
        echo "  sudo usermod -aG docker \$USER"
        echo "  # Faça logout e login novamente"
        echo ""
        exit 1
    fi
    
    log_success "Todos os requisitos atendidos!"
}

# Criar diretório de instalação
create_install_dir() {
    log_step "Criando diretório de instalação..."
    
    if [ -d "$INSTALL_DIR" ]; then
        log_warning "Diretório $INSTALL_DIR já existe."
        read -p "Deseja sobrescrever? (s/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Ss]$ ]]; then
            log_info "Instalação cancelada."
            exit 0
        fi
        rm -rf "$INSTALL_DIR"
    fi
    
    mkdir -p "$INSTALL_DIR"
    mkdir -p "$INSTALL_DIR/volumes/db/init"
    cd "$INSTALL_DIR"
    
    log_success "Diretório criado: $INSTALL_DIR"
}

# Baixar arquivos necessários
download_files() {
    log_step "Baixando arquivos de configuração..."
    
    local files=(
        "docker-compose.supabase-selfhosted.yml"
        "kong.yml"
        "init-db.sql"
        ".env.selfhosted"
    )
    
    for file in "${files[@]}"; do
        log_info "Baixando $file..."
        if command -v curl &> /dev/null; then
            curl -sSL "$GITHUB_RAW_URL/$file" -o "$file"
        else
            wget -q "$GITHUB_RAW_URL/$file" -O "$file"
        fi
        log_success "$file baixado"
    done
    
    # Renomear .env
    mv .env.selfhosted .env
    
    log_success "Todos os arquivos baixados!"
}

# Gerar senhas seguras
generate_secrets() {
    log_step "Gerando senhas seguras..."
    
    # Gerar senha do PostgreSQL
    POSTGRES_PASSWORD=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 32)
    
    # Gerar JWT Secret
    JWT_SECRET=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 48)
    
    log_success "Senhas geradas com sucesso!"
}

# Configurar variáveis de ambiente
configure_env() {
    log_step "Configurando variáveis de ambiente..."
    
    # Detectar IP/hostname
    if command -v hostname &> /dev/null; then
        SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")
    else
        SERVER_IP="localhost"
    fi
    
    # Perguntar ao usuário
    echo ""
    read -p "Digite o IP ou domínio do servidor [$SERVER_IP]: " USER_IP
    SERVER_IP="${USER_IP:-$SERVER_IP}"
    
    read -p "Porta da aplicação [80]: " APP_PORT
    APP_PORT="${APP_PORT:-80}"
    
    read -p "Porta do Supabase Studio [3001]: " STUDIO_PORT
    STUDIO_PORT="${STUDIO_PORT:-3001}"
    
    # Atualizar .env
    sed -i "s|POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$POSTGRES_PASSWORD|g" .env
    sed -i "s|JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|g" .env
    sed -i "s|API_EXTERNAL_URL=.*|API_EXTERNAL_URL=http://$SERVER_IP:8000|g" .env
    sed -i "s|SITE_URL=.*|SITE_URL=http://$SERVER_IP:$APP_PORT|g" .env
    
    # Atualizar portas no docker-compose se necessário
    if [ "$APP_PORT" != "80" ]; then
        sed -i "s|\"80:80\"|\"$APP_PORT:80\"|g" docker-compose.supabase-selfhosted.yml
    fi
    
    if [ "$STUDIO_PORT" != "3001" ]; then
        sed -i "s|\"3001:3000\"|\"$STUDIO_PORT:3000\"|g" docker-compose.supabase-selfhosted.yml
    fi
    
    log_success "Configurações aplicadas!"
}

# Pull das imagens
pull_images() {
    log_step "Baixando imagens Docker..."
    
    docker pull $DOCKER_IMAGE
    
    log_success "Imagem principal baixada!"
    log_info "As demais imagens serão baixadas ao iniciar..."
}

# Iniciar containers
start_containers() {
    log_step "Iniciando containers..."
    
    if docker compose version &> /dev/null; then
        docker compose -f docker-compose.supabase-selfhosted.yml up -d
    else
        docker-compose -f docker-compose.supabase-selfhosted.yml up -d
    fi
    
    log_success "Containers iniciados!"
}

# Aguardar serviços ficarem prontos
wait_for_services() {
    log_step "Aguardando serviços ficarem prontos..."
    
    local max_attempts=60
    local attempt=1
    
    echo -n "Aguardando PostgreSQL"
    while [ $attempt -le $max_attempts ]; do
        if docker exec supabase-postgres pg_isready -U postgres &> /dev/null; then
            echo -e " ${GREEN}OK${NC}"
            break
        fi
        echo -n "."
        sleep 2
        ((attempt++))
    done
    
    if [ $attempt -gt $max_attempts ]; then
        echo -e " ${RED}TIMEOUT${NC}"
        log_warning "PostgreSQL demorou para iniciar. Verifique os logs."
    fi
    
    # Aguardar mais um pouco para os outros serviços
    echo -n "Aguardando demais serviços"
    for i in {1..15}; do
        echo -n "."
        sleep 2
    done
    echo -e " ${GREEN}OK${NC}"
    
    log_success "Serviços prontos!"
}

# Criar arquivo de gerenciamento
create_management_script() {
    log_step "Criando script de gerenciamento..."
    
    cat > bingo.sh << 'SCRIPT'
#!/bin/bash

# Script de gerenciamento do Sistema de Bingo

COMPOSE_FILE="docker-compose.supabase-selfhosted.yml"

case "$1" in
    start)
        echo "Iniciando Sistema de Bingo..."
        docker compose -f $COMPOSE_FILE up -d 2>/dev/null || docker-compose -f $COMPOSE_FILE up -d
        ;;
    stop)
        echo "Parando Sistema de Bingo..."
        docker compose -f $COMPOSE_FILE down 2>/dev/null || docker-compose -f $COMPOSE_FILE down
        ;;
    restart)
        echo "Reiniciando Sistema de Bingo..."
        docker compose -f $COMPOSE_FILE restart 2>/dev/null || docker-compose -f $COMPOSE_FILE restart
        ;;
    logs)
        docker compose -f $COMPOSE_FILE logs -f ${2:-} 2>/dev/null || docker-compose -f $COMPOSE_FILE logs -f ${2:-}
        ;;
    status)
        docker compose -f $COMPOSE_FILE ps 2>/dev/null || docker-compose -f $COMPOSE_FILE ps
        ;;
    update)
        echo "Atualizando imagens..."
        docker pull josemaeldon/bingo-system:selfhosted
        docker compose -f $COMPOSE_FILE up -d 2>/dev/null || docker-compose -f $COMPOSE_FILE up -d
        ;;
    backup)
        BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql"
        echo "Criando backup: $BACKUP_FILE"
        docker exec supabase-postgres pg_dump -U postgres postgres > "$BACKUP_FILE"
        echo "Backup criado: $BACKUP_FILE"
        ;;
    restore)
        if [ -z "$2" ]; then
            echo "Uso: $0 restore <arquivo.sql>"
            exit 1
        fi
        echo "Restaurando backup: $2"
        docker exec -i supabase-postgres psql -U postgres postgres < "$2"
        echo "Backup restaurado!"
        ;;
    *)
        echo "Sistema de Bingo - Comandos disponíveis:"
        echo ""
        echo "  ./bingo.sh start    - Iniciar todos os serviços"
        echo "  ./bingo.sh stop     - Parar todos os serviços"
        echo "  ./bingo.sh restart  - Reiniciar todos os serviços"
        echo "  ./bingo.sh logs     - Ver logs (use: logs app, logs postgres, etc)"
        echo "  ./bingo.sh status   - Ver status dos containers"
        echo "  ./bingo.sh update   - Atualizar para última versão"
        echo "  ./bingo.sh backup   - Criar backup do banco de dados"
        echo "  ./bingo.sh restore <arquivo.sql> - Restaurar backup"
        echo ""
        ;;
esac
SCRIPT

    chmod +x bingo.sh
    
    log_success "Script de gerenciamento criado: ./bingo.sh"
}

# Imprimir informações finais
print_final_info() {
    # Obter IP do servidor
    if command -v hostname &> /dev/null; then
        SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")
    else
        SERVER_IP="localhost"
    fi
    
    # Ler porta do .env ou usar padrão
    APP_PORT=$(grep -oP '(?<=SITE_URL=http://[^:]+:)\d+' .env 2>/dev/null || echo "80")
    [ -z "$APP_PORT" ] && APP_PORT="80"
    
    echo ""
    echo -e "${GREEN}"
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║                                                           ║"
    echo "║     ✅  INSTALAÇÃO CONCLUÍDA COM SUCESSO!  ✅             ║"
    echo "║                                                           ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo ""
    echo -e "${CYAN}📍 Acessos:${NC}"
    echo ""
    echo -e "   ${GREEN}Sistema de Bingo:${NC}  http://$SERVER_IP:$APP_PORT"
    echo -e "   ${GREEN}Supabase Studio:${NC}   http://$SERVER_IP:3001"
    echo -e "   ${GREEN}API Supabase:${NC}      http://$SERVER_IP:8000"
    echo ""
    echo -e "${CYAN}👤 Usuário Admin Padrão:${NC}"
    echo ""
    echo -e "   ${YELLOW}Email:${NC}  admin@bingo.local"
    echo -e "   ${YELLOW}Senha:${NC}  admin123"
    echo ""
    echo -e "${RED}⚠️  IMPORTANTE: Altere a senha após o primeiro login!${NC}"
    echo ""
    echo -e "${CYAN}📁 Diretório de instalação:${NC} $INSTALL_DIR"
    echo ""
    echo -e "${CYAN}🛠️  Comandos úteis:${NC}"
    echo ""
    echo "   cd $INSTALL_DIR"
    echo "   ./bingo.sh start    # Iniciar"
    echo "   ./bingo.sh stop     # Parar"
    echo "   ./bingo.sh logs     # Ver logs"
    echo "   ./bingo.sh backup   # Fazer backup"
    echo "   ./bingo.sh update   # Atualizar"
    echo ""
    echo -e "${CYAN}📝 Senhas geradas (salve em local seguro):${NC}"
    echo ""
    echo -e "   ${YELLOW}PostgreSQL:${NC} $POSTGRES_PASSWORD"
    echo -e "   ${YELLOW}JWT Secret:${NC} $JWT_SECRET"
    echo ""
    echo -e "${PURPLE}Obrigado por usar o Sistema de Bingo! 🎱${NC}"
    echo ""
}

# Função principal
main() {
    print_banner
    check_root
    check_requirements
    create_install_dir
    download_files
    generate_secrets
    configure_env
    pull_images
    start_containers
    wait_for_services
    create_management_script
    print_final_info
}

# Executar
main "$@"
