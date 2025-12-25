# Guia de Testes - Sistema de Bingo

## Testes de Conexão ao Banco de Dados

Este guia descreve como testar o novo sistema de conexão que suporta PostgreSQL e MySQL.

## Pré-requisitos

### Para PostgreSQL
```bash
# Ubuntu/Debian
sudo apt-get install postgresql postgresql-contrib

# Criar banco de dados
sudo -u postgres psql
CREATE DATABASE bingo;
CREATE USER bingo_user WITH PASSWORD 'senha123';
GRANT ALL PRIVILEGES ON DATABASE bingo TO bingo_user;
\q
```

### Para MySQL
```bash
# Ubuntu/Debian
sudo apt-get install mysql-server

# Criar banco de dados
mysql -u root -p
CREATE DATABASE bingo;
CREATE USER 'bingo_user'@'localhost' IDENTIFIED BY 'senha123';
GRANT ALL PRIVILEGES ON bingo.* TO 'bingo_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

## Iniciando o Sistema

### 1. Backend
```bash
cd backend
npm install
npm start
```

Verifique a saída:
```
Bingo Backend API running on port 3001
Basic Auth: DISABLED
```

### 2. Frontend
```bash
# Em outro terminal
npm install
npm run dev
```

Acesse: `http://localhost:5173`

## Testes do Setup Wizard

### Teste 1: Configuração PostgreSQL

1. **Acesse** `http://localhost:5173/setup`
2. **Selecione** "PostgreSQL"
3. **Preencha**:
   - Host: `localhost`
   - Porta: `5432`
   - Banco de dados: `bingo`
   - Usuário: `bingo_user`
   - Senha: `senha123`
4. **Clique** "Testar Conexão"
   - ✅ Deve exibir: "Conexão estabelecida com sucesso!"
5. **Clique** "Continuar"
   - ✅ Deve inicializar o banco de dados
6. **Crie** o usuário administrador:
   - Nome: `Admin`
   - Email: `admin@bingo.com`
   - Senha: `admin123`
   - Nome do Sistema: `Sorteios`
7. **Clique** "Criar Administrador e Iniciar"
   - ✅ Deve redirecionar para login

### Teste 2: Configuração MySQL

1. **Limpe** o banco de dados:
   ```bash
   mysql -u bingo_user -p bingo
   DROP DATABASE bingo;
   CREATE DATABASE bingo;
   EXIT;
   ```
2. **Delete** o arquivo de configuração:
   ```bash
   rm backend/db-config.json
   ```
3. **Reinicie** o backend
4. **Acesse** `http://localhost:5173/setup`
5. **Selecione** "MySQL"
6. **Preencha**:
   - Host: `localhost`
   - Porta: `3306`
   - Banco de dados: `bingo`
   - Usuário: `bingo_user`
   - Senha: `senha123`
7. **Repita** passos 4-7 do Teste 1

## Testes de Funcionalidades

### Teste 3: Login

1. **Acesse** `http://localhost:5173/auth`
2. **Login**:
   - Email: `admin@bingo.com`
   - Senha: `admin123`
3. ✅ Deve acessar o dashboard

### Teste 4: Criar Sorteio

1. **Dashboard** → "Novo Sorteio"
2. **Preencha**:
   - Nome: `Sorteio de Natal`
   - Data: `25/12/2024`
   - Prêmios: `1º: TV, 2º: Geladeira`
   - Valor: `10.00`
   - Quantidade: `100`
3. **Salvar**
4. ✅ Deve aparecer na lista

### Teste 5: Criar Vendedor

1. **Sorteio** → "Vendedores"
2. **Novo Vendedor**:
   - Nome: `João Silva`
   - Telefone: `(11) 99999-9999`
   - Email: `joao@email.com`
3. **Salvar**
4. ✅ Deve aparecer na lista

### Teste 6: Atribuir Cartelas

1. **Sorteio** → "Atribuições"
2. **Nova Atribuição**:
   - Vendedor: `João Silva`
   - Cartelas: `1-10`
3. **Salvar**
4. ✅ Deve criar atribuição

### Teste 7: Registrar Venda

1. **Sorteio** → "Vendas"
2. **Nova Venda**:
   - Vendedor: `João Silva`
   - Cliente: `Maria Santos`
   - Telefone: `(11) 88888-8888`
   - Cartelas: `1, 2, 3`
   - Valor Total: `30.00`
   - Pagamento: Dinheiro
3. **Salvar**
4. ✅ Deve registrar venda

### Teste 8: Sortear Números

1. **Sorteio** → "Sortear"
2. **Configurar**:
   - Início: `1`
   - Fim: `75`
3. **Sortear Número**
4. ✅ Deve sortear e exibir número

## Testes de Verificação do Banco

### PostgreSQL

```bash
psql -U bingo_user -d bingo -c "SELECT table_name FROM information_schema.tables WHERE table_schema='public';"
```

Deve listar as tabelas:
- usuarios
- sorteios
- vendedores
- cartelas
- atribuicoes
- atribuicao_cartelas
- vendas
- pagamentos
- sorteio_historico
- rodadas_sorteio

### MySQL

```bash
mysql -u bingo_user -p bingo -e "SHOW TABLES;"
```

Deve listar as mesmas tabelas.

## Verificação de Dados

### Verificar Usuários

**PostgreSQL:**
```sql
psql -U bingo_user -d bingo -c "SELECT id, nome, email, role FROM usuarios;"
```

**MySQL:**
```sql
mysql -u bingo_user -p bingo -e "SELECT id, nome, email, role FROM usuarios;"
```

### Verificar Sorteios

**PostgreSQL:**
```sql
psql -U bingo_user -d bingo -c "SELECT id, nome, premio FROM sorteios;"
```

**MySQL:**
```sql
mysql -u bingo_user -p bingo -e "SELECT id, nome, premio FROM sorteios;"
```

## Testes de Conversão

### Teste 9: Conversão PostgreSQL → MySQL

1. **Backup PostgreSQL**:
   ```bash
   pg_dump -U bingo_user bingo > backup_postgres.sql
   ```

2. **Extrair dados** (não estrutura):
   ```bash
   pg_dump -U bingo_user --data-only bingo > data_only.sql
   ```

3. **Configurar MySQL**:
   - Delete `backend/db-config.json`
   - Reinicie backend
   - Configure MySQL no Setup

4. **Importar dados** (ajuste conforme necessário)

### Teste 10: Conversão MySQL → PostgreSQL

Similar ao teste anterior, mas invertido.

## Testes de Desempenho

### Teste 11: Criar Muitas Cartelas

1. **Criar sorteio** com 10.000 cartelas
2. ✅ Deve criar em lotes de 500
3. **Verificar**:
   ```sql
   SELECT COUNT(*) FROM cartelas WHERE sorteio_id='<id>';
   ```

### Teste 12: Múltiplas Vendas

1. **Criar** 100 vendas rapidamente
2. ✅ Sistema deve responder adequadamente
3. **Verificar** integridade dos dados

## Testes de Segurança

### Teste 13: SQL Injection

1. **Tentar** login com:
   - Email: `admin' OR '1'='1`
   - Senha: `qualquer`
2. ✅ Deve falhar (não autenticar)

### Teste 14: JWT Expirado

1. **Login** normalmente
2. **Esperar** 24 horas (ou modificar JWT_EXPIRY_HOURS para 1 minuto)
3. **Tentar** acessar recurso
4. ✅ Deve retornar erro 401

## Checklist de Testes

### Setup
- [ ] PostgreSQL: Teste de conexão funciona
- [ ] PostgreSQL: Inicialização do banco funciona
- [ ] PostgreSQL: Criação de admin funciona
- [ ] MySQL: Teste de conexão funciona
- [ ] MySQL: Inicialização do banco funciona
- [ ] MySQL: Criação de admin funciona

### Funcionalidades Básicas
- [ ] Login funciona
- [ ] Criar sorteio funciona
- [ ] Criar vendedor funciona
- [ ] Atribuir cartelas funciona
- [ ] Registrar venda funciona
- [ ] Sortear números funciona

### Funcionalidades Avançadas
- [ ] Rodadas funcionam
- [ ] Relatórios funcionam
- [ ] Exportar PDF funciona
- [ ] Exportar Excel funciona
- [ ] Upload de avatar funciona (base64)
- [ ] Atualizar perfil funciona

### Segurança
- [ ] SQL injection bloqueado
- [ ] JWT expira corretamente
- [ ] Senha não aparece em respostas
- [ ] Rotas protegidas exigem autenticação

## Problemas Conhecidos

### "The string did not match the expected pattern"
- **Causa**: Credenciais incorretas ou banco não acessível
- **Solução**: Verificar host, porta, usuário e senha

### Erro de Conexão Recusada
- **Causa**: Banco de dados não está rodando
- **Solução**: Iniciar PostgreSQL ou MySQL

### Tabelas Não Criadas
- **Causa**: Permissões insuficientes
- **Solução**: Garantir que usuário tem GRANT ALL PRIVILEGES

## Relatando Problemas

Ao encontrar problemas, inclua:
1. Tipo de banco de dados (PostgreSQL ou MySQL)
2. Versão do banco de dados
3. Logs do backend
4. Logs do navegador (console)
5. Passos para reproduzir
6. Comportamento esperado vs observado
