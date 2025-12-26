# Bingo System - Laravel-Style PHP API

## Overview

This is a Laravel-style PHP API backend for the Bingo System. It replaces the Node.js Express backend while maintaining 100% compatibility with the existing React frontend.

## Features

- ✅ Pure PHP 8.3+ (no Composer dependencies required for basic functionality)
- ✅ MySQL database support
- ✅ PSR-4 autoloading
- ✅ JWT authentication
- ✅ Auto-installer via web interface
- ✅ RESTful API design
- ✅ Docker support

## Requirements

- PHP 8.3 or higher
- MySQL 8.0 or higher
- Apache with mod_rewrite (or Nginx)
- PDO MySQL extension

## Installation

### Option 1: Docker (Recommended)

From the project root directory:

```bash
docker-compose -f docker-compose.laravel.yml up -d
```

This will start:
- MySQL database on port 3306
- Laravel API on port 3001
- React frontend on port 80

### Option 2: Manual Installation

1. **Configure Apache/Nginx**

For Apache, ensure `.htaccess` is working and `mod_rewrite` is enabled.

For Nginx, use this configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /path/to/laravel-api;
    index index.php;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \.php$ {
        fastcgi_pass unix:/var/run/php/php8.3-fpm.sock;
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        include fastcgi_params;
    }
}
```

2. **Create Config Directory**

```bash
mkdir -p config
chmod 755 config
```

3. **Set Permissions**

```bash
chown -R www-data:www-data .
chmod -R 755 .
```

4. **Access the Setup Page**

Navigate to `http://your-domain.com` and you'll be redirected to the setup page where you can:
- Configure MySQL database connection
- Initialize database tables
- Create admin user

## Directory Structure

```
laravel-api/
├── index.php              # Main entry point
├── bootstrap.php          # Bootstrap and autoloader
├── .htaccess             # Apache rewrite rules
├── app/
│   ├── Application.php   # Main application class
│   ├── Http/
│   │   └── Controllers/  # API controllers
│   │       ├── AuthController.php
│   │       ├── SorteiosController.php
│   │       ├── CartelasController.php
│   │       ├── VendedoresController.php
│   │       ├── VendasController.php
│   │       └── ...
│   └── Services/
│       ├── Database.php  # Database service
│       └── AuthService.php # Authentication service
├── config/
│   └── database.php      # Database config (created by installer)
└── Dockerfile            # Docker configuration
```

## API Endpoints

All endpoints follow the same pattern:

```
POST /api
Content-Type: application/json

{
  "action": "actionName",
  "data": { ...request data... }
}
```

### Authentication

Most endpoints require a JWT token in the `Authorization` header:

```
Authorization: Bearer <jwt_token>
```

### Available Actions

#### Database Configuration
- `checkDbConfig` - Check if database is configured
- `testDbConnection` - Test database connection
- `saveDbConfig` - Save database configuration
- `initializeDatabase` - Initialize database tables

#### Authentication
- `checkFirstAccess` - Check if admin user exists
- `setupAdmin` - Create first admin user
- `login` - User login
- `getUsers` - Get all users (admin only)
- `createUser` - Create user (admin only)
- `updateUser` - Update user (admin only)
- `deleteUser` - Delete user (admin only)
- `updateProfile` - Update own profile

#### Sorteios (Draws)
- `getSorteios` - Get user's draws
- `createSorteio` - Create new draw
- `updateSorteio` - Update draw
- `deleteSorteio` - Delete draw

#### Cartelas (Cards)
- `getCartelas` - Get cards for a draw
- `updateCartela` - Update single card
- `updateCartelasBatch` - Update multiple cards
- `gerarCartelas` - Generate cards

#### Vendedores (Vendors)
- `getVendedores` - Get vendors for a draw
- `createVendedor` - Create vendor
- `updateVendedor` - Update vendor
- `deleteVendedor` - Delete vendor

#### Vendas (Sales)
- `getVendas` - Get sales for a draw
- `createVenda` - Create sale
- `updateVenda` - Update sale
- `deleteVenda` - Delete sale
- `addPagamento` - Add payment to sale

#### Atribuições (Assignments)
- `getAtribuicoes` - Get card assignments
- `createAtribuicao` - Create assignment
- `deleteAtribuicao` - Delete assignment

## Configuration

### Database Configuration

After installation, the database configuration is stored in `config/database.php`:

```php
<?php
return [
    'type' => 'mysql',
    'host' => 'localhost',
    'port' => 3306,
    'database' => 'bingo',
    'user' => 'root',
    'password' => 'your_password',
];
```

### JWT Secret

The JWT secret is defined in `app/Services/AuthService.php`. For production, change this to a secure random string:

```php
private const JWT_SECRET = 'your_secure_random_string_here';
```

## Security Notes

1. **Change JWT Secret**: Update the JWT_SECRET in `AuthService.php` for production
2. **Database Credentials**: Use strong passwords for database users
3. **File Permissions**: Ensure proper file permissions (755 for directories, 644 for files)
4. **HTTPS**: Always use HTTPS in production
5. **Config Directory**: Protect the `config` directory from web access (done automatically by `.htaccess`)

## Auto-Installer

The system includes a web-based auto-installer accessible at `/setup`:

1. **Database Configuration**
   - Enter MySQL host, port, database name, user, and password
   - Test connection before saving
   - Automatically saves configuration

2. **Database Initialization**
   - Automatically runs the MySQL initialization script
   - Creates all necessary tables
   - Sets up indexes and relationships

3. **Admin User Creation**
   - Create the first admin user
   - Set name, email, and password
   - Immediately usable after creation

## Troubleshooting

### 500 Internal Server Error

- Check Apache error logs: `tail -f /var/log/apache2/error.log`
- Ensure PHP extensions are installed: `php -m | grep pdo_mysql`
- Verify file permissions

### Connection Refused

- Ensure MySQL is running: `systemctl status mysql`
- Check database credentials in `config/database.php`
- Verify firewall settings

### Setup Page Not Accessible

- Ensure `.htaccess` is working (Apache)
- Enable `mod_rewrite`: `a2enmod rewrite`
- Check Apache configuration allows `.htaccess` overrides

## Development

To add new API endpoints:

1. Create action in appropriate controller
2. Add route mapping in `Application.php`
3. Implement business logic in controller method
4. Return response using `$this->success()` or `$this->error()`

Example:

```php
// In SorteiosController.php
private function myNewAction($data)
{
    $result = $this->db->fetchAll('SELECT * FROM my_table');
    return $this->success(['data' => $result]);
}
```

## License

Proprietary - All rights reserved
