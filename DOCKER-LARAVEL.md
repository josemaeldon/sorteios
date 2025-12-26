# Docker Setup para o Sistema Bingo - Laravel API

Este documento descreve como executar o sistema Bingo completo usando Docker, incluindo a API Laravel, banco de dados MySQL e frontend React.

## Pré-requisitos

- Docker 20.10 ou superior
- Docker Compose 2.0 ou superior

## Estrutura dos Serviços

O sistema é composto por três serviços principais:

1. **MySQL Database** - Banco de dados MySQL 8.0
2. **Laravel API** - Backend PHP 8.3 com Apache
3. **Frontend** - Interface React com Vite

## Configuração Rápida

### 1. Configure as variáveis de ambiente

O arquivo `.env.laravel` já contém as configurações padrão. Você pode personalizá-las se necessário:

```bash
# Configuração do MySQL
MYSQL_ROOT_PASSWORD=bingo_root_password
MYSQL_DATABASE=bingo
MYSQL_USER=bingo_user
MYSQL_PASSWORD=bingo_password
MYSQL_PORT=3306

# Configuração da API
API_PORT=3001

# Configuração do Frontend
FRONTEND_PORT=80
VITE_API_BASE_URL=http://localhost:3001
```

### 2. Inicie os containers

```bash
# Usando o arquivo .env.laravel
docker-compose -f docker-compose.laravel.yml --env-file .env.laravel up -d
```

Ou simplesmente:

```bash
docker-compose -f docker-compose.laravel.yml up -d
```

### 3. Verifique o status

```bash
docker-compose -f docker-compose.laravel.yml ps
```

### 4. Acesse o sistema

- **Frontend**: http://localhost (porta 80)
- **API**: http://localhost:3001
- **Health Check**: http://localhost:3001/health

## Comandos Úteis

### Visualizar logs

```bash
# Todos os serviços
docker-compose -f docker-compose.laravel.yml logs -f

# Apenas a API
docker-compose -f docker-compose.laravel.yml logs -f api

# Apenas o MySQL
docker-compose -f docker-compose.laravel.yml logs -f mysql

# Apenas o Frontend
docker-compose -f docker-compose.laravel.yml logs -f frontend
```

### Reiniciar serviços

```bash
# Reiniciar todos
docker-compose -f docker-compose.laravel.yml restart

# Reiniciar apenas a API
docker-compose -f docker-compose.laravel.yml restart api
```

### Parar e remover containers

```bash
# Parar
docker-compose -f docker-compose.laravel.yml stop

# Parar e remover
docker-compose -f docker-compose.laravel.yml down

# Remover incluindo volumes (apaga os dados do banco)
docker-compose -f docker-compose.laravel.yml down -v
```

### Reconstruir imagens

```bash
# Reconstruir e reiniciar todos os serviços
docker-compose -f docker-compose.laravel.yml up -d --build

# Reconstruir apenas a API
docker-compose -f docker-compose.laravel.yml up -d --build api
```

### Acessar container

```bash
# Acessar o container da API
docker exec -it bingo-laravel-api bash

# Acessar o MySQL
docker exec -it bingo-mysql mysql -u bingo_user -p
```

## Estrutura do Projeto Laravel

```
laravel-api/
├── app/                    # Classes da aplicação
│   ├── Application.php    # Ponto de entrada da aplicação
│   ├── Http/             # Controllers
│   └── Services/         # Serviços (Database, Auth, etc)
├── config/               # Configurações
│   └── database.php      # Gerado automaticamente pelo Docker
├── bootstrap.php         # Autoloader PSR-4
├── index.php            # Entry point da API
├── Dockerfile           # Imagem Docker
└── docker-entrypoint.sh # Script de inicialização
```

## Características da Imagem Docker

A imagem Docker da API Laravel inclui:

- ✅ PHP 8.3 com Apache
- ✅ Extensões PDO e MySQL
- ✅ mod_rewrite e headers habilitados
- ✅ Configuração automática do banco de dados via variáveis de ambiente
- ✅ Wait-for-it para aguardar o MySQL estar pronto
- ✅ Health check endpoint
- ✅ Permissões corretas para www-data

## Inicialização Automática

O script `docker-entrypoint.sh` realiza as seguintes tarefas:

1. Aguarda o MySQL estar pronto (até 60 segundos)
2. Cria o diretório de configuração se não existir
3. Gera `config/database.php` a partir das variáveis de ambiente
4. Define permissões corretas
5. Inicia o Apache

## Troubleshooting

### A API não consegue conectar ao MySQL

Verifique se:
1. O MySQL está rodando: `docker-compose -f docker-compose.laravel.yml ps mysql`
2. As credenciais estão corretas no `.env.laravel`
3. Os logs do MySQL: `docker-compose -f docker-compose.laravel.yml logs mysql`

### Erro de permissão

Se houver erros de permissão, reconstrua a imagem:

```bash
docker-compose -f docker-compose.laravel.yml down
docker-compose -f docker-compose.laravel.yml up -d --build
```

### Frontend não consegue acessar a API

Verifique:
1. A variável `VITE_API_BASE_URL` está correta
2. A API está respondendo: `curl http://localhost:3001/health`
3. Não há problemas de CORS nos logs da API

### Banco de dados não persiste

Os dados são armazenados no volume `mysql_data`. Para limpar:

```bash
docker-compose -f docker-compose.laravel.yml down -v
```

E reinicie para criar um banco limpo.

## Segurança

⚠️ **IMPORTANTE para Produção**:

1. Altere todas as senhas padrão no `.env.laravel`
2. Configure CORS específico em vez de `*` no `index.php`
3. Desabilite `display_errors` em produção
4. Use HTTPS
5. Configure backups regulares do volume MySQL
6. Restrinja o acesso às portas expostas

## Suporte

Para problemas ou dúvidas, consulte:
- README.md principal do projeto
- Documentação da API em laravel-api/README.md
- Issues no GitHub
