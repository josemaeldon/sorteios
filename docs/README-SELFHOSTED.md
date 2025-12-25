# 🎱 Bingo System - Deploy Self-Hosted

Guia completo para deploy do Bingo System em Docker Swarm com Portainer.

## 📋 Pré-requisitos

- Docker Swarm inicializado
- Portainer instalado
- Traefik configurado na rede `luzianet`
- PostgreSQL externo (ou use o incluso)
- Domínio configurado com DNS

## 🚀 Deploy Rápido

### 1. Gerar Chaves JWT

```bash
chmod +x scripts/generate-jwt-keys.sh
./scripts/generate-jwt-keys.sh
```

Copie as chaves geradas:
- `JWT_SECRET`
- `ANON_KEY`
- `SERVICE_ROLE_KEY`

### 2. Inicializar Banco de Dados

Execute o script SQL no seu PostgreSQL:

```bash
psql -h SEU_HOST -U postgres -d bingo_db -f scripts/init-supabase-db.sql
```

### 3. Criar Config do Kong no Portainer

1. Acesse Portainer → Configs
2. Clique em "Add config"
3. Nome: `bingo_kong_config`
4. Conteúdo: cole o conteúdo de `kong-swarm.yml`
5. Substitua `${SUPABASE_SERVICE_KEY}` pela sua SERVICE_ROLE_KEY

### 4. Criar Volume de Storage

```bash
docker volume create bingo_storage_data
```

### 5. Deploy no Portainer

1. Acesse Portainer → Stacks
2. Clique em "Add stack"
3. Nome: `bingo`
4. Cole o conteúdo de `portainer-stack-swarm.yml`
5. Configure as Environment Variables:

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `DOMAIN` | Domínio principal | `bingo.exemplo.com` |
| `DB_HOST` | Host do PostgreSQL | `164.68.96.78` |
| `DB_PORT` | Porta do PostgreSQL | `5432` |
| `DB_NAME` | Nome do banco | `bingo_db` |
| `DB_USER` | Usuário do banco | `postgres` |
| `DB_PASS` | Senha do banco | `sua_senha` |
| `JWT_SECRET` | Chave JWT (32+ chars) | `gerado_pelo_script` |
| `ANON_KEY` | Chave anônima JWT | `gerado_pelo_script` |
| `SERVICE_ROLE_KEY` | Chave de serviço JWT | `gerado_pelo_script` |

6. Clique em "Deploy the stack"

## 🌐 URLs da Aplicação

Após o deploy:

| Serviço | URL |
|---------|-----|
| **App** | `https://bingo.seudominio.com` |
| **API** | `https://api.bingo.seudominio.com` |
| **Studio** | `https://studio.bingo.seudominio.com` |

## 📦 Build da Imagem Docker

Para criar sua própria imagem:

```bash
# Build da imagem
docker build -f Dockerfile.selfhosted -t seu-usuario/bingo-system:selfhosted .

# Push para registry
docker push seu-usuario/bingo-system:selfhosted
```

## 🔧 Arquitetura dos Serviços

```
┌─────────────────────────────────────────────────────────────┐
│                        Traefik                               │
│                    (Rede: luzianet)                         │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────┐    ┌─────────┐    ┌─────────────┐             │
│  │   App   │    │  Kong   │    │   Studio    │             │
│  │  :80    │    │  :8000  │    │    :3000    │             │
│  └─────────┘    └────┬────┘    └─────────────┘             │
│                      │                                       │
├──────────────────────┼──────────────────────────────────────┤
│                      │        (Rede: bingo-internal)        │
│  ┌───────┐  ┌───────┴───────┐  ┌──────────┐  ┌──────────┐  │
│  │ Auth  │  │     REST      │  │ Realtime │  │ Storage  │  │
│  │ :9999 │  │     :3000     │  │  :4000   │  │  :5000   │  │
│  └───┬───┘  └───────┬───────┘  └────┬─────┘  └────┬─────┘  │
│      │              │               │             │         │
│      └──────────────┴───────────────┴─────────────┘         │
│                            │                                 │
│                    ┌───────┴───────┐                        │
│                    │  PostgreSQL   │                        │
│                    │   (Externo)   │                        │
│                    └───────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

## 🔍 Troubleshooting

### Serviços não iniciam

```bash
# Ver logs do serviço
docker service logs bingo_auth
docker service logs bingo_kong

# Ver status dos serviços
docker stack services bingo
```

### Kong rejeitando conexões

1. Verifique se a config `bingo_kong_config` foi criada corretamente
2. Confirme que as variáveis JWT estão corretas
3. Verifique os logs: `docker service logs bingo_kong`

### Auth não conecta ao banco

1. Verifique as credenciais do banco
2. Confirme que o schema `auth` foi criado
3. Execute o script `init-supabase-db.sql`

### App mostra "Erro de conexão"

1. Verifique se a API está acessível: `curl https://api.seudominio.com/rest/v1/`
2. Confirme que o CORS está configurado no Kong
3. Verifique as variáveis de ambiente do App

## 📝 Variáveis de Ambiente

### Obrigatórias

| Variável | Descrição |
|----------|-----------|
| `DOMAIN` | Domínio base da aplicação |
| `DB_HOST` | Host do PostgreSQL |
| `DB_PORT` | Porta do PostgreSQL |
| `DB_NAME` | Nome do banco de dados |
| `DB_USER` | Usuário do banco |
| `DB_PASS` | Senha do banco |
| `JWT_SECRET` | Chave secreta para tokens JWT |
| `ANON_KEY` | Chave JWT para acesso anônimo |
| `SERVICE_ROLE_KEY` | Chave JWT para acesso administrativo |

### Opcionais (SMTP)

| Variável | Descrição |
|----------|-----------|
| `SMTP_HOST` | Servidor SMTP |
| `SMTP_PORT` | Porta SMTP (587) |
| `SMTP_USER` | Usuário SMTP |
| `SMTP_PASS` | Senha SMTP |

## 📄 Licença

MIT License
