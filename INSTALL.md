# Sistema de Bingo - Instalação e Configuração

## Visão Geral

Sistema completo de gerenciamento de bingo com suporte para PostgreSQL e MySQL. O sistema possui instalação automática e configuração guiada na primeira execução.

## Requisitos

### Backend
- Node.js 14 ou superior
- PostgreSQL 12+ **OU** MySQL 8.0+

### Frontend
- Node.js 14 ou superior
- npm ou yarn

## Instalação Rápida

### 1. Clone o Repositório

```bash
git clone https://github.com/josemaeldon/bingopgm.git
cd bingopgm
```

### 2. Instale as Dependências

#### Backend
```bash
cd backend
npm install
```

#### Frontend
```bash
cd ..
npm install
```

### 3. Configure o Banco de Dados

Você pode escolher entre PostgreSQL ou MySQL. O sistema criará automaticamente todas as tabelas necessárias.

#### Opção A: PostgreSQL

**Instalação do PostgreSQL:**
- **Ubuntu/Debian:** `sudo apt-get install postgresql postgresql-contrib`
- **macOS:** `brew install postgresql`
- **Windows:** Baixe do site oficial: https://www.postgresql.org/download/windows/

**Crie o banco de dados:**
```bash
sudo -u postgres psql
CREATE DATABASE bingo;
CREATE USER bingo_user WITH PASSWORD 'sua_senha';
GRANT ALL PRIVILEGES ON DATABASE bingo TO bingo_user;
\q
```

#### Opção B: MySQL

**Instalação do MySQL:**
- **Ubuntu/Debian:** `sudo apt-get install mysql-server`
- **macOS:** `brew install mysql`
- **Windows:** Baixe do site oficial: https://dev.mysql.com/downloads/mysql/

**Crie o banco de dados:**
```bash
mysql -u root -p
CREATE DATABASE bingo;
CREATE USER 'bingo_user'@'localhost' IDENTIFIED BY 'sua_senha';
GRANT ALL PRIVILEGES ON bingo.* TO 'bingo_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### 4. Inicie o Sistema

#### Modo Desenvolvimento

**Terminal 1 - Backend:**
```bash
cd backend
npm start
```

**Terminal 2 - Frontend:**
```bash
npm run dev
```

#### Modo Produção

**Build do Frontend:**
```bash
npm run build
```

**Inicie o Backend:**
```bash
cd backend
npm start
```

Sirva os arquivos estáticos do diretório `dist/` com um servidor web (nginx, Apache, etc.).

### 5. Configuração Inicial

1. Acesse `http://localhost:5173` (desenvolvimento) ou seu domínio (produção)
2. O sistema detectará que é o primeiro acesso e mostrará a tela de configuração
3. **Escolha o tipo de banco de dados**: PostgreSQL ou MySQL
4. **Configure a conexão:**
   - **PostgreSQL:**
     - Host: `localhost`
     - Porta: `5432`
     - Banco de dados: `bingo`
     - Usuário: `bingo_user`
     - Senha: sua senha
   - **MySQL:**
     - Host: `localhost`
     - Porta: `3306`
     - Banco de dados: `bingo`
     - Usuário: `bingo_user`
     - Senha: sua senha
5. Clique em "Testar Conexão" para verificar
6. Clique em "Continuar" para inicializar o banco de dados
7. Crie o usuário administrador com:
   - Nome completo
   - Email
   - Senha (mínimo 6 caracteres)
   - Nome do sistema (opcional, padrão: "Sorteios")

## Configurações Avançadas

### Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto para configurações personalizadas:

```env
# Backend API Configuration
VITE_API_BASE_URL=http://localhost:3001

# Optional: Basic Authentication for API
VITE_BASIC_AUTH_USER=
VITE_BASIC_AUTH_PASS=
```

### Configuração do Backend

O arquivo `backend/db-config.json` é criado automaticamente durante a configuração inicial. Você pode editá-lo manualmente se necessário:

```json
{
  "type": "postgres",
  "host": "localhost",
  "port": 5432,
  "database": "bingo",
  "user": "bingo_user",
  "password": "sua_senha"
}
```

### Portas

- **Frontend (desenvolvimento):** 5173
- **Backend:** 3001

Para alterar a porta do backend, use a variável de ambiente `PORT`:

```bash
PORT=8080 npm start
```

## Recursos do Sistema

### Gestão de Sorteios
- Criação e gerenciamento de sorteios
- Definição de prêmios múltiplos
- Controle de cartelas
- Histórico de números sorteados

### Gestão de Vendedores
- Cadastro de vendedores
- Atribuição de cartelas
- Controle de vendas por vendedor
- Transferência de cartelas entre vendedores

### Gestão de Vendas
- Registro de vendas
- Controle de pagamentos parciais
- Múltiplas formas de pagamento
- Relatórios de vendas

### Sistema de Rodadas
- Criação de rodadas com intervalos personalizados
- Sorteio de números por rodada
- Histórico separado por rodada

### Administração
- Gestão de usuários
- Controle de permissões (Admin/Usuário)
- Personalização do nome do sistema
- Gerenciamento de avatares

## Segurança

- Autenticação via JWT
- Senhas armazenadas com hash SHA-256
- Proteção contra SQL injection
- Validação de dados no cliente e servidor
- Suporte a autenticação básica HTTP (opcional)

## Suporte a Bancos de Dados

### PostgreSQL
- **Vantagens:** 
  - Mais recursos avançados (JSONB, extensões)
  - Melhor para consultas complexas
  - Suporte nativo a UUID
- **Recomendado para:** Instalações com muitos dados e consultas complexas

### MySQL
- **Vantagens:**
  - Mais simples de instalar e configurar
  - Amplamente disponível em hospedagens compartilhadas
  - Boa performance para operações básicas
- **Recomendado para:** Instalações mais simples e hospedagens compartilhadas

## Migrando entre Bancos de Dados

Para migrar de um banco para outro:

1. Exporte seus dados do banco atual
2. Delete o arquivo `backend/db-config.json`
3. Reinicie o sistema e configure o novo banco
4. Importe seus dados

## Solução de Problemas

### Erro 405: "Method Not Allowed" nas Requisições API

Este erro ocorre quando o nginx não consegue rotear as requisições `/api` para o backend.

**Sintomas:**
- Mensagem no console: "Failed to load resource: the server responded with a status of 405"
- Erro: "Failed to check database config"
- Frontend não consegue comunicar com o backend

**Solução:**
1. **Para deploy com Docker Compose (postgres-only):**
   - Certifique-se de que está usando a versão mais recente do `nginx.conf` que inclui o proxy para `/api`
   - Deixe `VITE_API_BASE_URL` vazio ou não defina para usar o proxy interno
   - Reconstrua as imagens: `docker compose build --no-cache`

2. **Para deploy com domínios separados (Traefik):**
   - Configure `VITE_API_BASE_URL` com a URL completa do backend (ex: `https://api.bingo.exemplo.com`)
   - Não use o proxy interno do nginx neste caso

3. **Para desenvolvimento local:**
   - Use `VITE_API_BASE_URL=http://localhost:3001` no arquivo `.env`
   - Inicie backend e frontend em terminais separados

### Erro: "The string did not match the expected pattern"

Este erro geralmente ocorre quando:
- As credenciais do banco estão incorretas
- O banco de dados não está em execução
- A porta está bloqueada por firewall

**Solução:**
1. Verifique se o banco de dados está rodando
2. Teste a conexão manualmente
3. Verifique as credenciais
4. Certifique-se de que a porta está acessível

### Erro de Conexão ao Backend

**Solução:**
1. Verifique se o backend está rodando (`npm start` no diretório `backend/`)
2. Verifique se a porta 3001 está disponível
3. Confirme que `VITE_API_BASE_URL` está configurado corretamente

### Banco de Dados Não Inicializa

**Solução:**
1. Verifique os logs do backend
2. Certifique-se de que o usuário do banco tem permissões adequadas
3. Verifique se o banco de dados existe
4. Para PostgreSQL, certifique-se de que as extensões estão disponíveis

## Atualizações

Para atualizar o sistema:

```bash
git pull origin main
cd backend && npm install
cd .. && npm install
npm run build
```

Reinicie os serviços.

## Backup

### Backup do Banco de Dados

**PostgreSQL:**
```bash
pg_dump -U bingo_user bingo > backup_bingo_$(date +%Y%m%d).sql
```

**MySQL:**
```bash
mysqldump -u bingo_user -p bingo > backup_bingo_$(date +%Y%m%d).sql
```

### Restauração

**PostgreSQL:**
```bash
psql -U bingo_user bingo < backup_bingo_20231225.sql
```

**MySQL:**
```bash
mysql -u bingo_user -p bingo < backup_bingo_20231225.sql
```

### Backup de Configuração

Faça backup do arquivo `backend/db-config.json`.

## Suporte

Para reportar problemas ou sugerir melhorias, abra uma issue no GitHub:
https://github.com/josemaeldon/bingopgm/issues

## Licença

[Especifique a licença do projeto]

## Contribuindo

Contribuições são bem-vindas! Por favor:
1. Faça um fork do projeto
2. Crie uma branch para sua feature
3. Commit suas mudanças
4. Push para a branch
5. Abra um Pull Request
