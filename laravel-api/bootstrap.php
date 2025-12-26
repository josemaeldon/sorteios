<?php
/**
 * Bootstrap file - Loads configuration and sets up autoloading
 */

// Configuration
define('BASE_PATH', __DIR__);
define('CONFIG_PATH', BASE_PATH . '/config');
define('APP_PATH', BASE_PATH . '/app');

// Simple PSR-4 autoloader
spl_autoload_register(function ($class) {
    $prefix = 'App\\';
    $base_dir = APP_PATH . '/';
    
    $len = strlen($prefix);
    if (strncmp($prefix, $class, $len) !== 0) {
        return;
    }
    
    $relative_class = substr($class, $len);
    $file = $base_dir . str_replace('\\', '/', $relative_class) . '.php';
    
    if (file_exists($file)) {
        require $file;
    }
});

// Load configuration
$configFile = CONFIG_PATH . '/database.php';
if (file_exists($configFile)) {
    $GLOBALS['db_config'] = include $configFile;
} else {
    $GLOBALS['db_config'] = null;
}
