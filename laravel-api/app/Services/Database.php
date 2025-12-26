<?php

namespace App\Services;

class Database
{
    private $connection = null;
    private $config = null;
    
    public function __construct()
    {
        $this->config = $GLOBALS['db_config'] ?? null;
        if ($this->config) {
            $this->connect();
        }
    }
    
    public function isConfigured()
    {
        return $this->config !== null && $this->connection !== null;
    }
    
    public function connect()
    {
        if (!$this->config) {
            throw new \Exception('Database not configured');
        }
        
        try {
            $dsn = "mysql:host={$this->config['host']};port={$this->config['port']};dbname={$this->config['database']};charset=utf8mb4";
            $this->connection = new \PDO(
                $dsn,
                $this->config['user'],
                $this->config['password'],
                [
                    \PDO::ATTR_ERRMODE => \PDO::ERRMODE_EXCEPTION,
                    \PDO::ATTR_DEFAULT_FETCH_MODE => \PDO::FETCH_ASSOC,
                    \PDO::ATTR_EMULATE_PREPARES => false,
                ]
            );
        } catch (\PDOException $e) {
            throw new \Exception("Database connection failed: " . $e->getMessage());
        }
    }
    
    public function query($sql, $params = [])
    {
        if (!$this->connection) {
            throw new \Exception('Database not connected');
        }
        
        $stmt = $this->connection->prepare($sql);
        $stmt->execute($params);
        return $stmt;
    }
    
    public function fetchAll($sql, $params = [])
    {
        $stmt = $this->query($sql, $params);
        return $stmt->fetchAll();
    }
    
    public function fetchOne($sql, $params = [])
    {
        $stmt = $this->query($sql, $params);
        return $stmt->fetch();
    }
    
    public function execute($sql, $params = [])
    {
        $stmt = $this->query($sql, $params);
        return $stmt->rowCount();
    }
    
    public function lastInsertId()
    {
        return $this->connection->lastInsertId();
    }
    
    public function getConnection()
    {
        return $this->connection;
    }
    
    public function beginTransaction()
    {
        return $this->connection->beginTransaction();
    }
    
    public function commit()
    {
        return $this->connection->commit();
    }
    
    public function rollback()
    {
        return $this->connection->rollback();
    }
    
    public static function testConnection($config)
    {
        try {
            $dsn = "mysql:host={$config['host']};port={$config['port']};dbname={$config['database']};charset=utf8mb4";
            $pdo = new \PDO(
                $dsn,
                $config['user'],
                $config['password'],
                [\PDO::ATTR_ERRMODE => \PDO::ERRMODE_EXCEPTION]
            );
            $pdo->query('SELECT 1');
            return ['success' => true, 'message' => 'Conexão estabelecida com sucesso!'];
        } catch (\PDOException $e) {
            return ['success' => false, 'error' => "Erro ao conectar: " . $e->getMessage()];
        }
    }
    
    public static function saveConfig($config)
    {
        $configContent = "<?php\nreturn " . var_export($config, true) . ";\n";
        $configPath = CONFIG_PATH . '/database.php';
        
        if (file_put_contents($configPath, $configContent)) {
            $GLOBALS['db_config'] = $config;
            return true;
        }
        return false;
    }
}
