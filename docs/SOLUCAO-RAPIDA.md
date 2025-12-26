# 🚀 SOLUÇÃO RÁPIDA: Conectar Backend ao PostgreSQL Externo

## Seu Problema
Você tem o Bingo System rodando em Docker Swarm com frontend e backend separados, mas o backend não consegue conectar ao PostgreSQL que está em outra stack na mesma rede.

## ✅ Solução em 3 Passos

### Passo 1: Identifique o Nome do Serviço PostgreSQL

No seu PostgreSQL, veja qual é o nome do serviço. Exemplos comuns:
- `postgres`
- `supabase-db`
- `postgresql`
- `supabase-postgres`

```bash
# Veja os containers na rede luzianet
docker network inspect luzianet | grep Name
```

### Passo 2: Adicione as Variáveis no Backend

No seu arquivo de stack do Portainer ou docker-compose, adicione estas variáveis no serviço `bingo_backend`:

```yaml
bingo_backend:
  image: josemaeldon/bingo-system:backend-main
  environment:
    # ⚠️ ALTERE ESTAS VARIÁVEIS COM SEUS DADOS
    - DB_TYPE=postgres
    - DB_HOST=postgres              # ← Nome do seu serviço PostgreSQL
    - DB_PORT=5432
    - DB_NAME=bingo                 # ← Nome do seu banco
    - DB_USER=postgres              # ← Seu usuário
    - DB_PASSWORD=CHANGE_THIS_PASSWORD  # ← ⚠️ Sua senha real! Não deixe este valor!
    - JWT_SECRET=mude_este_token_por_favor
    - PORT=3001
  deploy:
    mode: replicated
    replicas: 1
    placement:
      constraints:
        - node.role == manager
    labels:
      - "traefik.enable=true"
      - "traefik.docker.network=luzianet"
      - "traefik.http.routers.bingo_backend.rule=Host(`api.bingo.santaluzia.org`)"
      - "traefik.http.routers.bingo_backend.entrypoints=websecure"
      - "traefik.http.routers.bingo_backend.tls.certresolver=letsencryptresolver"
      - "traefik.http.services.bingo_backend.loadbalancer.server.port=3001"
  networks:
    - luzianet
```

### Passo 3: Atualize a Stack

```bash
# Se estiver usando docker stack deploy
docker stack deploy -c seu-arquivo.yml bingo

# Ou atualize pelo Portainer:
# 1. Vá em Stacks
# 2. Clique na sua stack
# 3. Clique em "Editor"
# 4. Adicione as variáveis
# 5. Clique em "Update the stack"
```

## 🔍 Verificação

Depois de atualizar, verifique se está funcionando:

```bash
# 1. Veja os logs do backend
docker service logs bingo_bingo_backend --tail 50

# 2. Teste o health endpoint
curl https://api.bingo.santaluzia.org/health

# 3. Verifique se conectou ao banco
# Deve aparecer: "Database adapter initialized for postgres"
```

## ❓ Ainda com Problemas?

### Erro: "Connection refused"
- ✅ Verifique se o PostgreSQL está rodando: `docker ps | grep postgres`
- ✅ Confirme se estão na mesma rede: `docker network inspect luzianet`
- ✅ Teste o nome do serviço: `docker exec -it <backend-container> ping postgres`

### Erro: "Authentication failed"
- ✅ Confirme usuário e senha do PostgreSQL
- ✅ Verifique se o banco `bingo` existe
- ✅ Teste conectar manualmente: `docker exec -it <postgres-container> psql -U postgres`

### Banco não inicializa
- ✅ Acesse o frontend
- ✅ Clique em "Inicializar Banco de Dados"
- ✅ O sistema criará as tabelas automaticamente

## 📚 Documentação Completa

Para mais detalhes, troubleshooting e exemplos:
- 📖 [Guia Completo PostgreSQL Externo](GUIA-POSTGRES-EXTERNO.md)
- 📄 [Arquivo de Exemplo Completo](../deploy/portainer-stack-backend-postgres.yml)
- 📋 [Variáveis de Ambiente](../.env.swarm-backend)

## 🔐 Segurança

⚠️ **IMPORTANTE**:
1. **Altere o `JWT_SECRET`** para um valor único e seguro
2. **Use senha forte** no PostgreSQL
3. **Não commite senhas** no git
4. Configure **firewall** para proteger a porta 5432

## 💡 Dica Extra

Se você quer usar um arquivo `.env` ao invés de colocar as variáveis no YAML:

```bash
# 1. Copie o arquivo de exemplo
cp .env.swarm-backend .env

# 2. Edite com suas credenciais
nano .env

# 3. No docker-compose, use:
env_file:
  - .env
```
