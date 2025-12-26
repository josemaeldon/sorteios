# Guia: Conectando o Backend a um PostgreSQL Externo no Docker Swarm

## Problema

Você tem uma stack Docker Swarm com o frontend e backend do Bingo System, mas o backend não consegue conectar ao PostgreSQL que está rodando em outra stack na mesma rede Docker.

## Solução

O backend do Bingo System suporta conexão a bancos de dados externos através de variáveis de ambiente. Você precisa adicionar essas variáveis no serviço `bingo_backend`.

## Passo a Passo

### 1. Identifique as Informações do PostgreSQL

Você precisa saber:
- **Nome do serviço**: O nome do container/serviço PostgreSQL na rede Docker (ex: `postgres`, `supabase-db`, `postgresql`)
- **Porta**: Geralmente `5432`
- **Nome do banco de dados**: Ex: `bingo`, `postgres`
- **Usuário**: Ex: `postgres`
- **Senha**: A senha configurada no PostgreSQL

### 2. Configure o Serviço Backend

Adicione as seguintes variáveis de ambiente no serviço `bingo_backend` do seu docker-compose ou Portainer stack:

```yaml
bingo_backend:
  image: josemaeldon/bingo-system:backend-main
  environment:
    # Tipo do banco de dados
    - DB_TYPE=postgres
    
    # Host do PostgreSQL (nome do serviço na rede Docker)
    - DB_HOST=postgres
    
    # Porta do PostgreSQL
    - DB_PORT=5432
    
    # Nome do banco de dados
    - DB_NAME=bingo
    
    # Usuário do PostgreSQL
    - DB_USER=postgres
    
    # Senha do PostgreSQL (SUBSTITUA PELA SUA SENHA REAL!)
    - DB_PASSWORD=sua_senha_aqui
    
    # Opcional: Secret JWT (recomendado alterar)
    - JWT_SECRET=bingo_jwt_secret_2024_secure_change_me
```

### 3. Exemplo Completo de Stack

Veja o arquivo `deploy/portainer-stack-backend-postgres.yml` para um exemplo completo.

Ou copie o conteúdo abaixo:

```yaml
version: "3.8"

services:
  bingo_app:
    image: josemaeldon/bingo-system:app-main
    environment:
      - VITE_API_BASE_URL=https://api.bingo.santaluzia.org
      - VITE_BASIC_AUTH_USER=
      - VITE_BASIC_AUTH_PASS=
    deploy:
      mode: replicated
      replicas: 1
      placement:
        constraints:
          - node.role == manager
      resources:
        limits:
          cpus: "0.5"
          memory: 256M
      labels:
        - "traefik.enable=true"
        - "traefik.docker.network=luzianet"
        - "traefik.http.routers.bingo_app.rule=Host(`bingo.santaluzia.org`)"
        - "traefik.http.routers.bingo_app.entrypoints=websecure"
        - "traefik.http.routers.bingo_app.tls.certresolver=letsencryptresolver"
        - "traefik.http.services.bingo_app.loadbalancer.server.port=80"
    networks:
      - luzianet

  bingo_backend:
    image: josemaeldon/bingo-system:backend-main
    environment:
      - DB_TYPE=postgres
      - DB_HOST=postgres              # ALTERE para o nome do seu serviço PostgreSQL
      - DB_PORT=5432
      - DB_NAME=bingo                 # ALTERE para o nome do seu banco
      - DB_USER=postgres              # ALTERE para o usuário do seu banco
      - DB_PASSWORD=CHANGE_THIS_PASSWORD  # ⚠️ ALTERE para a senha do seu banco!
      - PORT=3001
      - JWT_SECRET=bingo_jwt_secret_2024_secure_change_me
      - BASIC_AUTH_USER=
      - BASIC_AUTH_PASS=
    deploy:
      mode: replicated
      replicas: 1
      placement:
        constraints:
          - node.role == manager
      resources:
        limits:
          cpus: "0.5"
          memory: 256M
      labels:
        - "traefik.enable=true"
        - "traefik.docker.network=luzianet"
        - "traefik.http.routers.bingo_backend.rule=Host(`api.bingo.santaluzia.org`)"
        - "traefik.http.routers.bingo_backend.entrypoints=websecure"
        - "traefik.http.routers.bingo_backend.tls.certresolver=letsencryptresolver"
        - "traefik.http.services.bingo_backend.loadbalancer.server.port=3001"
    networks:
      - luzianet

networks:
  luzianet:
    external: true
```

### 4. Verifique a Rede Docker

Certifique-se de que o PostgreSQL e o backend estão na mesma rede:

```bash
# Liste as redes Docker
docker network ls

# Inspecione a rede luzianet para ver os containers conectados
docker network inspect luzianet

# Alternativamente, veja todos os containers com suas redes
docker ps --format "table {{.Names}}\t{{.Networks}}"
```

### 5. Deploy da Stack

#### No Portainer:
1. Acesse Portainer → Stacks
2. Clique em "Add Stack"
3. Cole o conteúdo do YAML acima
4. **IMPORTANTE**: Edite as variáveis `DB_*` com suas credenciais reais
5. Clique em "Deploy the stack"

#### Via CLI:
```bash
# Edite o arquivo com suas credenciais
vim deploy/portainer-stack-backend-postgres.yml

# Deploy da stack
docker stack deploy -c deploy/portainer-stack-backend-postgres.yml bingo
```

### 6. Inicialização do Banco de Dados

Na primeira execução, o banco de dados precisa ser inicializado:

1. Acesse o frontend: `https://bingo.santaluzia.org`
2. O sistema detectará que o banco não está configurado
3. **Teste a conexão**: Clique em "Testar Conexão" (os dados já estão configurados)
4. **Inicialize o banco**: Clique em "Inicializar Banco de Dados"
5. O sistema criará automaticamente todas as tabelas necessárias
6. Crie o usuário administrador

### 7. Verificação

Verifique se o backend está funcionando:

```bash
# Teste o endpoint de health do backend
curl https://api.bingo.santaluzia.org/health

# Verifique os logs do backend
docker service logs bingo_bingo_backend -f
```

## Troubleshooting

### Backend não consegue conectar ao PostgreSQL

**Erro**: `ECONNREFUSED` ou `Connection refused`

**Soluções**:
1. Verifique se o PostgreSQL está rodando: `docker ps | grep postgres`
2. Confirme que ambos estão na mesma rede: `docker network inspect luzianet`
3. Teste a conexão manualmente:
   ```bash
   # Entre no container do backend
   docker exec -it $(docker ps -q -f name=bingo_backend) sh
   
   # Teste a conexão (instale o cliente se necessário)
   nc -zv postgres 5432
   ```

### Erro: "The string did not match the expected pattern"

**Causa**: Credenciais incorretas ou banco de dados não existe

**Soluções**:
1. Verifique se o banco de dados existe no PostgreSQL
2. Confirme que as credenciais estão corretas
3. Teste a conexão diretamente no PostgreSQL:
   ```bash
   docker exec -it <postgres-container> psql -U postgres -d bingo
   ```

### Backend não inicializa

**Causa**: Variáveis de ambiente não configuradas

**Soluções**:
1. Verifique se todas as variáveis `DB_*` estão definidas
2. Veja os logs do backend: `docker service logs bingo_bingo_backend`
3. Certifique-se de que não há espaços ou caracteres especiais nas variáveis

### Tabelas não são criadas automaticamente

**Causa**: Banco de dados já existe mas está vazio

**Soluções**:
1. Acesse o frontend e vá para a configuração inicial
2. Clique em "Inicializar Banco de Dados"
3. Ou execute o script SQL manualmente:
   ```bash
   docker exec -i <postgres-container> psql -U postgres -d bingo < database/init-postgres.sql
   ```

## Variáveis de Ambiente Disponíveis

### Obrigatórias
- `DB_TYPE`: Tipo do banco (`postgres` ou `mysql`)
- `DB_HOST`: Host do banco de dados
- `DB_PORT`: Porta do banco de dados
- `DB_NAME`: Nome do banco de dados
- `DB_USER`: Usuário do banco
- `DB_PASSWORD`: Senha do banco

### Opcionais
- `PORT`: Porta do servidor backend (padrão: 3001)
- `JWT_SECRET`: Secret para tokens JWT (recomendado alterar)
- `BASIC_AUTH_USER`: Usuário para autenticação básica HTTP
- `BASIC_AUTH_PASS`: Senha para autenticação básica HTTP

## Arquivos de Referência

- `deploy/portainer-stack-backend-postgres.yml` - Stack completa com backend e PostgreSQL externo
- `deploy/docker-compose.swarm.yml` - Docker Compose para Swarm com exemplos
- `.env.swarm-backend` - Exemplo de arquivo de variáveis de ambiente
- `backend/server.js` - Código do backend (linhas 48-72 mostram como as variáveis são usadas)

## Segurança

⚠️ **IMPORTANTE**:
1. **NUNCA** commite senhas no código ou arquivos de configuração
2. Use secrets do Docker Swarm para senhas em produção
3. Altere o `JWT_SECRET` para um valor único e seguro
4. Use senhas fortes para o PostgreSQL
5. Configure firewall para proteger a porta 5432 do PostgreSQL

## Suporte

Para mais informações:
- [README principal](../README.md)
- [Guia de Instalação](../INSTALL.md)
- [Deploy README](../deploy/README.md)
- [Issues no GitHub](https://github.com/josemaeldon/bingopgm/issues)
