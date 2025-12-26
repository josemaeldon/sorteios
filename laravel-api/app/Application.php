<?php

namespace App;

class Application
{
    private $db;
    private $auth;
    
    public function __construct()
    {
        $this->db = new \App\Services\Database();
        $this->auth = new \App\Services\AuthService();
    }
    
    public function handle($action, $data)
    {
        try {
            // Check if database is configured for actions that need it
            $dbConfigActions = ['checkDbConfig', 'testDbConnection', 'saveDbConfig', 'initializeDatabase'];
            
            if (!in_array($action, $dbConfigActions) && !$this->db->isConfigured()) {
                return [
                    'status' => 503,
                    'data' => [
                        'error' => 'Banco de dados não configurado',
                        'needsDbConfig' => true
                    ]
                ];
            }
            
            // Handle database configuration actions
            if (in_array($action, $dbConfigActions)) {
                return $this->handleDbConfig($action, $data);
            }
            
            // Check authentication
            $authResult = $this->auth->checkAuth($action, $_SERVER);
            if (!$authResult['authenticated']) {
                return [
                    'status' => 401,
                    'data' => ['error' => $authResult['error']]
                ];
            }
            
            // Add authenticated user info
            if ($authResult['user']) {
                $data['authenticated_user_id'] = $authResult['user']['user_id'];
                $data['authenticated_role'] = $authResult['user']['role'];
            }
            
            // Route to appropriate controller
            return $this->route($action, $data);
            
        } catch (\Exception $e) {
            error_log("Application error: " . $e->getMessage());
            return [
                'status' => 500,
                'data' => ['error' => $e->getMessage()]
            ];
        }
    }
    
    private function handleDbConfig($action, $data)
    {
        $controller = new \App\Http\Controllers\DatabaseConfigController($this->db);
        return $controller->handle($action, $data);
    }
    
    private function route($action, $data)
    {
        // Map actions to controllers
        $routes = [
            // Auth
            'checkFirstAccess' => 'Auth',
            'setupAdmin' => 'Auth',
            'login' => 'Auth',
            'getUsers' => 'Auth',
            'createUser' => 'Auth',
            'updateUser' => 'Auth',
            'deleteUser' => 'Auth',
            'updateProfile' => 'Auth',
            
            // Sorteios
            'getSorteios' => 'Sorteios',
            'createSorteio' => 'Sorteios',
            'updateSorteio' => 'Sorteios',
            'deleteSorteio' => 'Sorteios',
            
            // Cartelas
            'getCartelas' => 'Cartelas',
            'updateCartela' => 'Cartelas',
            'updateCartelasBatch' => 'Cartelas',
            'gerarCartelas' => 'Cartelas',
            
            // Vendedores
            'getVendedores' => 'Vendedores',
            'createVendedor' => 'Vendedores',
            'updateVendedor' => 'Vendedores',
            'deleteVendedor' => 'Vendedores',
            
            // Vendas
            'getVendas' => 'Vendas',
            'createVenda' => 'Vendas',
            'updateVenda' => 'Vendas',
            'deleteVenda' => 'Vendas',
            'addPagamento' => 'Vendas',
            
            // Atribuições
            'getAtribuicoes' => 'Atribuicoes',
            'createAtribuicao' => 'Atribuicoes',
            'addCartelasToAtribuicao' => 'Atribuicoes',
            'removeCartelaFromAtribuicao' => 'Atribuicoes',
            'updateCartelaStatusInAtribuicao' => 'Atribuicoes',
            'transferirCartelas' => 'Atribuicoes',
            'deleteAtribuicao' => 'Atribuicoes',
            
            // Sorteio History
            'getSorteioHistorico' => 'SorteioHistorico',
            'saveSorteioNumero' => 'SorteioHistorico',
            'clearSorteioHistorico' => 'SorteioHistorico',
            'updateSorteioRegistro' => 'SorteioHistorico',
            
            // Rodadas
            'getRodadas' => 'Rodadas',
            'createRodada' => 'Rodadas',
            'updateRodada' => 'Rodadas',
            'deleteRodada' => 'Rodadas',
            'getRodadaHistorico' => 'Rodadas',
            'saveRodadaNumero' => 'Rodadas',
            'clearRodadaHistorico' => 'Rodadas',
        ];
        
        if (!isset($routes[$action])) {
            return [
                'status' => 400,
                'data' => ['error' => "Unknown action: $action"]
            ];
        }
        
        $controllerName = "\\App\\Http\\Controllers\\{$routes[$action]}Controller";
        $controller = new $controllerName($this->db, $this->auth);
        
        return $controller->handle($action, $data);
    }
}
