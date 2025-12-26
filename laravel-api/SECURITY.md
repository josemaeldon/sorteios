# Considerações de Segurança - Laravel API

## 📋 Visão Geral

Este documento descreve as considerações de segurança da implementação Laravel do Sistema de Bingo e fornece orientações para uso em produção.

## ⚠️ Configurações Importantes para Produção

### 1. JWT Secret (CRÍTICO)

**Localização**: `laravel-api/app/Services/AuthService.php`

**Problema**: O JWT secret está hardcoded no código.

**Solução para Produção**:
```php
// Substitua a constante por uma variável de ambiente
private const JWT_SECRET = 'bingo_jwt_secret_2024_secure'; // MUDAR!

// Recomendação: Use um valor aleatório de 32+ caracteres
// Exemplo: gere com: openssl rand -base64 32
```

**Como Gerar um Secret Seguro**:
```bash
# No Linux/Mac
openssl rand -base64 32

# Ou em PHP
php -r "echo bin2hex(random_bytes(32));"
```

### 2. CORS (Cross-Origin Resource Sharing)

**Localização**: `laravel-api/index.php`

**Problema Atual**: Permite qualquer origem (`*`)

**Código Atual**:
```php
header('Access-Control-Allow-Origin: *');
```

**Solução para Produção**:
```php
// Substitua * pelo domínio específico
header('Access-Control-Allow-Origin: https://seudominio.com');

// Ou, se múltiplos domínios são necessários:
$allowed_origins = ['https://seudominio.com', 'https://app.seudominio.com'];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowed_origins)) {
    header("Access-Control-Allow-Origin: $origin");
}
```

### 3. Hashing de Senhas

**Localização**: `laravel-api/app/Services/AuthService.php`

**Método Atual**: SHA256 com salt fixo

**Motivo**: Compatibilidade com a versão Node.js existente

**Código Atual**:
```php
public function hashPassword($password)
{
    return hash('sha256', $password . 'bingo_salt_2024');
}
```

**Considerações**:
- ✅ **Compatível** com senhas do backend Node.js
- ⚠️ **Menos seguro** que bcrypt/Argon2
- 📝 **Para novos projetos**: use `password_hash()` do PHP

**Alternativa Segura** (para novos projetos sem compatibilidade):
```php
public function hashPassword($password)
{
    return password_hash($password, PASSWORD_ARGON2ID);
}

public function verifyPassword($password, $hash)
{
    return password_verify($password, $hash);
}
```

## 🔒 Checklist de Segurança para Produção

### Configuração de Servidor

- [ ] **HTTPS Obrigatório**
  - Configure certificado SSL (Let's Encrypt recomendado)
  - Force redirecionamento HTTP → HTTPS
  ```apache
  RewriteEngine On
  RewriteCond %{HTTPS} off
  RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
  ```

- [ ] **Headers de Segurança**
  ```apache
  Header always set X-Frame-Options "SAMEORIGIN"
  Header always set X-Content-Type-Options "nosniff"
  Header always set X-XSS-Protection "1; mode=block"
  Header always set Referrer-Policy "strict-origin-when-cross-origin"
  ```

- [ ] **Proteção do Diretório Config**
  - O arquivo `config/database.php` não deve ser acessível via web
  - Já protegido pelo `.htaccess`, mas verifique
  ```apache
  <Directory "/var/www/html/laravel-api/config">
      Require all denied
  </Directory>
  ```

### Banco de Dados

- [ ] **Senhas Fortes**
  - Use senhas complexas para o usuário MySQL
  - Mínimo 16 caracteres, alfanuméricos + símbolos
  ```bash
  # Gerar senha segura
  openssl rand -base64 24
  ```

- [ ] **Usuário com Privilégios Mínimos**
  ```sql
  -- NÃO use root em produção
  CREATE USER 'bingo_user'@'localhost' IDENTIFIED BY 'senha_forte';
  GRANT SELECT, INSERT, UPDATE, DELETE ON bingo.* TO 'bingo_user'@'localhost';
  FLUSH PRIVILEGES;
  ```

- [ ] **Acesso Restrito ao MySQL**
  - Bloqueie porta 3306 no firewall
  - Permita apenas conexões locais ou de IPs específicos
  ```bash
  # UFW (Ubuntu)
  sudo ufw deny 3306
  ```

### Aplicação PHP

- [ ] **Desabilitar Erros em Produção**
  ```php
  // index.php
  error_reporting(0);
  ini_set('display_errors', 0);
  ini_set('log_errors', 1);
  ini_set('error_log', '/var/log/php-errors.log');
  ```

- [ ] **Permissões de Arquivo**
  ```bash
  # Diretórios
  find laravel-api -type d -exec chmod 755 {} \;
  
  # Arquivos
  find laravel-api -type f -exec chmod 644 {} \;
  
  # Config (mais restritivo)
  chmod 750 laravel-api/config
  chmod 640 laravel-api/config/database.php
  ```

- [ ] **Dono dos Arquivos**
  ```bash
  chown -R www-data:www-data laravel-api
  ```

### Rate Limiting

Adicione rate limiting para prevenir abuso:

**Opção 1: Usando Nginx**
```nginx
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;

location /api {
    limit_req zone=api_limit burst=20 nodelay;
    # ... resto da configuração
}
```

**Opção 2: Usando PHP**
```php
// Adicionar em index.php
session_start();
$max_requests = 60; // requests
$time_window = 60; // segundos

if (!isset($_SESSION['request_count'])) {
    $_SESSION['request_count'] = 0;
    $_SESSION['window_start'] = time();
}

if (time() - $_SESSION['window_start'] > $time_window) {
    $_SESSION['request_count'] = 0;
    $_SESSION['window_start'] = time();
}

$_SESSION['request_count']++;

if ($_SESSION['request_count'] > $max_requests) {
    http_response_code(429);
    echo json_encode(['error' => 'Too many requests']);
    exit;
}
```

## 🛡️ Proteções Implementadas

### ✅ O Que Já Está Protegido

1. **Autenticação JWT**
   - Tokens expiram em 24 horas
   - Verificação de assinatura
   - Verificação de expiração

2. **Autorização por Role**
   - Ações públicas: login, setup, checkDbConfig
   - Ações autenticadas: maioria das operações
   - Ações admin: gestão de usuários

3. **Prepared Statements**
   - Todas as queries usam PDO com prepared statements
   - Proteção contra SQL injection

4. **Validação de Input** (básica)
   - Verificação de ações válidas
   - Verificação de dados obrigatórios

5. **Proteção de Arquivos**
   - `.htaccess` protege diretório config
   - `.gitignore` exclui arquivos sensíveis

## 🔐 Melhores Práticas

### Desenvolvimento

1. **Nunca Commite Secrets**
   - Senhas
   - JWT secrets
   - Chaves de API
   - Arquivos de configuração com credenciais

2. **Use Variáveis de Ambiente** (recomendação futura)
   ```php
   // Em vez de:
   private const JWT_SECRET = 'hardcoded_secret';
   
   // Use:
   private $jwt_secret;
   public function __construct() {
       $this->jwt_secret = $_ENV['JWT_SECRET'] ?? 'default_dev_secret';
   }
   ```

3. **Logs Seguros**
   - Não logue senhas ou tokens
   - Use nível apropriado (error, warning, info, debug)
   - Proteja arquivos de log

### Deployment

1. **Checklist Pré-Deploy**
   - [ ] JWT secret alterado
   - [ ] CORS configurado para domínio específico
   - [ ] HTTPS configurado
   - [ ] Senhas fortes no MySQL
   - [ ] Firewall configurado
   - [ ] Permissões de arquivo verificadas
   - [ ] Error display desabilitado

2. **Backup Regular**
   ```bash
   # Diário
   mysqldump -u user -p bingo > backup_$(date +%Y%m%d).sql
   
   # Automatize com cron
   0 2 * * * /path/to/backup-script.sh
   ```

3. **Monitoramento**
   - Configure alertas para tentativas de acesso falhas
   - Monitore uso de recursos
   - Revise logs regularmente

## 🚨 Incidentes de Segurança

### Em Caso de Comprometimento

1. **Ação Imediata**
   - Mude JWT_SECRET imediatamente (invalida todos os tokens)
   - Mude senhas do banco de dados
   - Revise logs para identificar o problema
   - Notifique usuários se necessário

2. **Análise**
   - Identifique o vetor de ataque
   - Determine escopo do comprometimento
   - Documente o incidente

3. **Remediação**
   - Corrija a vulnerabilidade
   - Implemente controles adicionais
   - Teste a solução
   - Deploy em produção

## 📚 Recursos Adicionais

### Ferramentas de Segurança

- **OWASP ZAP**: Scanner de vulnerabilidades web
- **SQLMap**: Teste de SQL injection
- **Burp Suite**: Suite completa de testes de segurança

### Leitura Recomendada

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [PHP Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/PHP_Configuration_Cheat_Sheet.html)
- [MySQL Security Best Practices](https://dev.mysql.com/doc/refman/8.0/en/security-guidelines.html)

## 📝 Notas Finais

Este sistema foi desenvolvido com foco em:
1. **Compatibilidade** com o backend Node.js existente
2. **Facilidade de uso** e instalação
3. **Segurança razoável** para desenvolvimento

Para ambientes de **produção**, é **ESSENCIAL** implementar todas as recomendações deste documento.

### Responsabilidade

A segurança é uma responsabilidade compartilhada:
- **Desenvolvedores**: Código seguro, boas práticas
- **DevOps**: Infraestrutura segura, monitoramento
- **Usuários**: Senhas fortes, bom uso

---

**Última Atualização**: 2025-12-26
**Versão**: 1.0.0
**Severidade das Issues**: Documentadas e com soluções fornecidas
