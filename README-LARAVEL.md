# 🎱 Sistema de Gerenciamento de Bingo - Laravel Edition

## 🆕 Nova Versão Laravel com MySQL

Esta é a versão Laravel do Sistema de Bingo, oferecendo:
- ✅ **Backend PHP** puro (sem dependências do Composer para funcionalidade básica)
- ✅ **MySQL** como banco de dados
- ✅ **Auto-instalador** web completo
- ✅ **100% compatível** com o frontend React existente
- ✅ **Fácil deploy** com Docker
- ✅ **Menor overhead** comparado ao Node.js

## 🚀 Instalação Rápida (Laravel + MySQL)

### Opção 1: Docker (Recomendado)

```bash
# Clone o repositório
git clone https://github.com/josemaeldon/bingopgm.git
cd bingopgm

# Copie o arquivo de ambiente
cp .env.laravel .env

# Inicie os serviços
docker-compose -f docker-compose.laravel.yml up -d
```

Pronto! Acesse:
- **Frontend**: http://localhost
- **API**: http://localhost:3001
- **Setup**: http://localhost/setup

### Opção 2: Instalação Manual

#### Requisitos
- PHP 8.3+
- MySQL 8.0+
- Apache com mod_rewrite ou Nginx
- Extensão PDO MySQL

#### Passos

1. **Clone o repositório**
```bash
git clone https://github.com/josemaeldon/bingopgm.git
cd bingopgm
```

2. **Configure o MySQL**
```bash
mysql -u root -p
CREATE DATABASE bingo;
CREATE USER 'bingo_user'@'localhost' IDENTIFIED BY 'senha_segura';
GRANT ALL PRIVILEGES ON bingo.* TO 'bingo_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

3. **Configure o Apache/Nginx**

Para Apache:
```bash
cd laravel-api
sudo ln -s $(pwd) /var/www/html/bingo-api
sudo a2enmod rewrite
sudo systemctl restart apache2
```

Para Nginx, adicione a configuração (veja `laravel-api/README.md`)

4. **Configure permissões**
```bash
cd laravel-api
mkdir -p config
chmod 755 config
chown -R www-data:www-data .
```

5. **Acesse o instalador**
Navegue para: `http://localhost/bingo-api/setup`

## 🏗 Arquitetura Laravel

```
bingopgm/
├── laravel-api/                    # Backend Laravel-style PHP
│   ├── index.php                  # Ponto de entrada
│   ├── bootstrap.php              # Bootstrap e autoloader
│   ├── .htaccess                  # Regras Apache
│   ├── app/
│   │   ├── Application.php        # Classe principal
│   │   ├── Http/Controllers/      # Controladores API
│   │   │   ├── AuthController.php
│   │   │   ├── SorteiosController.php
│   │   │   ├── CartelasController.php
│   │   │   ├── VendedoresController.php
│   │   │   ├── VendasController.php
│   │   │   └── ...
│   │   └── Services/
│   │       ├── Database.php       # Serviço de banco
│   │       └── AuthService.php    # Autenticação JWT
│   ├── config/
│   │   └── database.php           # Configuração do banco
│   ├── Dockerfile                 # Configuração Docker
│   └── README.md                  # Documentação detalhada
├── src/                           # Frontend React (inalterado)
├── database/
│   └── init-mysql.sql            # Script de inicialização MySQL
├── docker-compose.laravel.yml     # Docker Compose Laravel
└── .env.laravel                   # Variáveis de ambiente
```

## 🛠 Tecnologias (Versão Laravel)

| Camada | Tecnologia |
|--------|------------|
| **Frontend** | React, TypeScript, Vite, Tailwind CSS, shadcn/ui |
| **Backend** | PHP 8.3+ (Laravel-style) |
| **Banco de Dados** | MySQL 8.0+ |
| **Autenticação** | JWT (implementação nativa PHP) |
| **Servidor Web** | Apache com mod_rewrite ou Nginx |
| **Infraestrutura** | Docker, Docker Compose |

## ✨ Funcionalidades

Todas as funcionalidades do sistema original são mantidas:

- ✅ **Autenticação JWT**: Login seguro com tokens
- ✅ **Auto-instalador**: Configure o banco via interface web
- ✅ **Gerenciamento de Sorteios**: CRUD completo
- ✅ **Gestão de Cartelas**: Geração e controle automático
- ✅ **Vendedores**: Cadastro e gerenciamento
- ✅ **Vendas e Pagamentos**: Sistema completo de vendas
- ✅ **Atribuições**: Distribuição de cartelas
- ✅ **Multi-usuário**: Isolamento por usuário
- ✅ **Relatórios**: Exportação e estatísticas

## 🔧 Configuração

### Variáveis de Ambiente

Edite o arquivo `.env`:

```env
# MySQL
MYSQL_ROOT_PASSWORD=senha_root
MYSQL_DATABASE=bingo
MYSQL_USER=bingo_user
MYSQL_PASSWORD=senha_segura
MYSQL_PORT=3306

# API
API_PORT=3001

# Frontend
FRONTEND_PORT=80
VITE_API_BASE_URL=http://localhost:3001
```

### Configuração do Banco de Dados

Após a primeira execução, a configuração é salva em `laravel-api/config/database.php`:

```php
<?php
return [
    'type' => 'mysql',
    'host' => 'localhost',
    'port' => 3306,
    'database' => 'bingo',
    'user' => 'bingo_user',
    'password' => 'senha_segura',
];
```

## 🌐 Auto-Instalador

O sistema inclui um instalador web em `/setup` que:

1. **Testa a conexão** com o MySQL
2. **Salva a configuração** automaticamente
3. **Inicializa o banco** de dados (tabelas, índices, etc.)
4. **Cria o usuário admin** inicial
5. **Redireciona para login** após conclusão

Nenhuma intervenção manual no banco de dados é necessária!

## 📡 API Endpoints

Todos os endpoints seguem o padrão:

```http
POST /api
Content-Type: application/json
Authorization: Bearer <token> (quando necessário)

{
  "action": "nomeAcao",
  "data": { ...dados... }
}
```

### Principais Ações

#### Configuração do Banco
- `checkDbConfig` - Verifica se o banco está configurado
- `testDbConnection` - Testa conexão com o banco
- `saveDbConfig` - Salva configuração do banco
- `initializeDatabase` - Inicializa tabelas e estrutura

#### Autenticação
- `checkFirstAccess` - Verifica primeiro acesso
- `setupAdmin` - Cria admin inicial
- `login` - Login de usuário
- `getUsers`, `createUser`, `updateUser`, `deleteUser` - Gestão de usuários

#### Sorteios
- `getSorteios`, `createSorteio`, `updateSorteio`, `deleteSorteio`

#### Cartelas
- `getCartelas`, `updateCartela`, `gerarCartelas`

#### Vendedores
- `getVendedores`, `createVendedor`, `updateVendedor`, `deleteVendedor`

#### Vendas
- `getVendas`, `createVenda`, `updateVenda`, `deleteVenda`, `addPagamento`

Veja a documentação completa em `laravel-api/README.md`.

## 🐳 Docker

### Serviços Incluídos

| Serviço | Porta | Descrição |
|---------|-------|-----------|
| **frontend** | 80 | Frontend React |
| **api** | 3001 | Backend Laravel PHP |
| **mysql** | 3306 | Banco de dados MySQL |

### Comandos Úteis

```bash
# Iniciar serviços
docker-compose -f docker-compose.laravel.yml up -d

# Ver logs
docker-compose -f docker-compose.laravel.yml logs -f

# Parar serviços
docker-compose -f docker-compose.laravel.yml down

# Parar e remover volumes (limpar dados)
docker-compose -f docker-compose.laravel.yml down -v

# Reconstruir imagens
docker-compose -f docker-compose.laravel.yml build --no-cache
```

### Acessar Containers

```bash
# API (PHP)
docker exec -it bingo-laravel-api bash

# MySQL
docker exec -it bingo-mysql mysql -u root -p

# Frontend
docker exec -it bingo-frontend sh
```

## 💾 Backup e Restauração

### Backup do Banco de Dados

```bash
# Com Docker
docker exec bingo-mysql mysqldump -u root -p bingo > backup_$(date +%Y%m%d).sql

# Sem Docker
mysqldump -u bingo_user -p bingo > backup_$(date +%Y%m%d).sql
```

### Restauração

```bash
# Com Docker
docker exec -i bingo-mysql mysql -u root -p bingo < backup.sql

# Sem Docker
mysql -u bingo_user -p bingo < backup.sql
```

## 🔒 Segurança

### Recomendações para Produção

1. **Mude o JWT Secret**
   - Edite `laravel-api/app/Services/AuthService.php`
   - Substitua `JWT_SECRET` por um valor aleatório longo

2. **Use HTTPS**
   - Configure certificado SSL
   - Force redirecionamento HTTP → HTTPS

3. **Senhas Fortes**
   - Use senhas complexas para MySQL
   - Altere senhas padrão imediatamente

4. **Permissões de Arquivo**
   - Diretórios: 755
   - Arquivos: 644
   - Config: protegido do acesso web

5. **Firewall**
   - Bloqueie acesso direto à porta MySQL (3306)
   - Permita apenas 80/443

## 🐛 Troubleshooting

### Erro 502 Bad Gateway

**Causa**: API não está rodando

**Solução**:
```bash
docker-compose -f docker-compose.laravel.yml logs api
docker-compose -f docker-compose.laravel.yml restart api
```

### Erro de Conexão com MySQL

**Causa**: MySQL não acessível ou credenciais incorretas

**Solução**:
```bash
# Verifique se MySQL está rodando
docker-compose -f docker-compose.laravel.yml ps mysql

# Teste conexão
docker exec bingo-mysql mysql -u root -p -e "SELECT 1"

# Verifique configuração em laravel-api/config/database.php
```

### Página em Branco ou Erro 500

**Causa**: Erro PHP ou permissões

**Solução**:
```bash
# Ver logs do Apache
docker exec bingo-laravel-api tail -f /var/log/apache2/error.log

# Verificar permissões
docker exec bingo-laravel-api ls -la /var/www/html/config
```

### Auto-Instalador Não Aparece

**Causa**: Banco já está configurado

**Solução**:
```bash
# Remover configuração para reiniciar setup
docker exec bingo-laravel-api rm /var/www/html/config/database.php
```

## 📚 Documentação Adicional

- **API Completa**: [`laravel-api/README.md`](laravel-api/README.md)
- **Docker Setup**: [`docker-compose.laravel.yml`](docker-compose.laravel.yml)
- **Banco de Dados**: [`database/init-mysql.sql`](database/init-mysql.sql)

## 🔄 Migrando do Node.js

Se você está vindo da versão Node.js:

1. **Backup dos dados**:
```bash
# PostgreSQL
pg_dump -U postgres bingo > backup.sql

# Converter para MySQL (pode precisar ajustes manuais)
```

2. **Use o novo docker-compose**:
```bash
docker-compose -f docker-compose.laravel.yml up -d
```

3. **Importe dados** (após converter para MySQL se necessário)

4. **Teste todas as funcionalidades**

## 🤝 Suporte

Para problemas ou dúvidas:

1. Verifique a seção de Troubleshooting
2. Consulte os logs dos containers
3. Revise a documentação em `laravel-api/README.md`

## 📄 Licença

Proprietary - Todos os direitos reservados
