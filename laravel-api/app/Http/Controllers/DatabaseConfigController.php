<?php

namespace App\Http\Controllers;

class DatabaseConfigController extends Controller
{
    public function __construct($db)
    {
        parent::__construct($db, null);
    }
    
    public function handle($action, $data)
    {
        switch ($action) {
            case 'checkDbConfig':
                return $this->checkDbConfig();
            case 'testDbConnection':
                return $this->testDbConnection($data);
            case 'saveDbConfig':
                return $this->saveDbConfig($data);
            case 'initializeDatabase':
                return $this->initializeDatabase();
            default:
                return $this->error("Unknown action: $action");
        }
    }
    
    private function checkDbConfig()
    {
        $configured = $this->db->isConfigured();
        return $this->success([
            'configured' => $configured,
            'config' => $configured ? [
                'type' => 'mysql',
                'host' => $GLOBALS['db_config']['host'] ?? null,
                'port' => $GLOBALS['db_config']['port'] ?? null,
                'database' => $GLOBALS['db_config']['database'] ?? null,
                'user' => $GLOBALS['db_config']['user'] ?? null
            ] : null
        ]);
    }
    
    private function testDbConnection($data)
    {
        $config = [
            'type' => 'mysql',
            'host' => $data['host'] ?? 'localhost',
            'port' => $data['port'] ?? 3306,
            'database' => $data['database'] ?? 'bingo',
            'user' => $data['user'] ?? 'root',
            'password' => $data['password'] ?? '',
        ];
        
        $result = \App\Services\Database::testConnection($config);
        return $this->success($result);
    }
    
    private function saveDbConfig($data)
    {
        $config = [
            'type' => 'mysql',
            'host' => $data['host'] ?? 'localhost',
            'port' => (int)($data['port'] ?? 3306),
            'database' => $data['database'] ?? 'bingo',
            'user' => $data['user'] ?? 'root',
            'password' => $data['password'] ?? '',
        ];
        
        if (\App\Services\Database::saveConfig($config)) {
            // Reinitialize database connection
            $this->db->connect();
            return $this->success(['success' => true, 'message' => 'Configuração salva com sucesso!']);
        } else {
            return $this->success(['success' => false, 'error' => 'Erro ao salvar configuração']);
        }
    }
    
    private function initializeDatabase()
    {
        if (!$this->db->isConfigured()) {
            return $this->error('Banco de dados não configurado', 503);
        }
        
        try {
            // Read MySQL initialization script
            $initScriptPath = BASE_PATH . '/../database/init-mysql.sql';
            if (!file_exists($initScriptPath)) {
                throw new \Exception('Arquivo de inicialização não encontrado: ' . $initScriptPath);
            }
            
            $initScript = file_get_contents($initScriptPath);
            
            // Split into statements (simple approach)
            $statements = array_filter(
                array_map('trim', explode(';', $initScript)),
                function($stmt) {
                    return !empty($stmt) && !str_starts_with($stmt, '--') && $stmt !== '\n';
                }
            );
            
            $conn = $this->db->getConnection();
            foreach ($statements as $statement) {
                if (trim($statement)) {
                    try {
                        $conn->exec($statement);
                    } catch (\PDOException $e) {
                        error_log("Error executing statement: " . substr($statement, 0, 100) . " - " . $e->getMessage());
                        // Continue with other statements
                    }
                }
            }
            
            return $this->success(['success' => true, 'message' => 'Banco de dados inicializado com sucesso!']);
        } catch (\Exception $e) {
            error_log("Database initialization error: " . $e->getMessage());
            return $this->success([
                'success' => false,
                'error' => "Erro ao inicializar banco de dados: " . $e->getMessage()
            ]);
        }
    }
}
