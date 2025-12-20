# Bingo System - Selfhosted (PostgreSQL Only)

Versão simplificada que funciona apenas com **PostgreSQL + Node.js**, sem necessidade de Supabase.

## Requisitos

- Docker e Docker Compose
- PostgreSQL (incluído no docker-compose)

## Configuração Rápida

1. **Copiar variáveis de ambiente:**
```bash
cp .env.selfhosted .env
```

2. **Editar `.env`:**
```env
# PostgreSQL
POSTGRES_USER=bingo
POSTGRES_PASSWORD=sua_senha_segura
POSTGRES_DB=bingo

# JWT (mude em produção!)
JWT_SECRET=sua_chave_jwt_super_secreta

# Autenticação Básica HTTP (opcional)
BASIC_AUTH_USER=admin
BASIC_AUTH_PASS=senha123

# Porta da aplicação
APP_PORT=80
```

3. **Iniciar:**
```bash
docker-compose -f docker-compose.postgres-only.yml up -d
```

4. **Acessar:** http://localhost

## Arquitetura

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Frontend  │────▶│   Backend   │────▶│  PostgreSQL │
│   (Nginx)   │     │  (Node.js)  │     │             │
│   :80       │     │   :3001     │     │   :5432     │
└─────────────┘     └─────────────┘     └─────────────┘
```

## Autenticação

### Autenticação Básica HTTP (Opcional)
Se configurar `BASIC_AUTH_USER` e `BASIC_AUTH_PASS`, todas as requisições à API precisarão incluir essas credenciais.

### Login do Sistema
No primeiro acesso, você criará o usuário administrador. Depois, faça login com email/senha.

## Comparação de Modos

| Recurso | PostgreSQL Only | Supabase/Cloud |
|---------|-----------------|----------------|
| Banco de dados | ✅ PostgreSQL | ✅ Supabase |
| Autenticação | ✅ JWT próprio | ✅ Supabase Auth |
| Storage | ❌ | ✅ Supabase Storage |
| Realtime | ❌ | ✅ Supabase Realtime |
| Edge Functions | ❌ | ✅ |
| Complexidade | Simples | Média |

## Comandos Úteis

```bash
# Ver logs
docker-compose -f docker-compose.postgres-only.yml logs -f

# Reiniciar
docker-compose -f docker-compose.postgres-only.yml restart

# Parar
docker-compose -f docker-compose.postgres-only.yml down

# Limpar tudo (incluindo dados)
docker-compose -f docker-compose.postgres-only.yml down -v
```
