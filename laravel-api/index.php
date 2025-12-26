<?php
/**
 * Bingo System - Laravel-style API
 * Main entry point for all API requests
 */

// Error reporting
error_reporting(E_ALL);
ini_set('display_errors', 1);

// CORS headers
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Basic-Auth');
header('Content-Type: application/json');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Autoloader
require_once __DIR__ . '/bootstrap.php';

// Get request data
$requestUri = $_SERVER['REQUEST_URI'];
$requestMethod = $_SERVER['REQUEST_METHOD'];

// Route handling
if ($requestMethod === 'POST' && strpos($requestUri, '/api') !== false) {
    $input = json_decode(file_get_contents('php://input'), true);
    $action = $input['action'] ?? null;
    $data = $input['data'] ?? [];
    
    if (!$action) {
        http_response_code(400);
        echo json_encode(['error' => 'Action is required']);
        exit;
    }
    
    // Handle request
    $app = new \App\Application();
    $response = $app->handle($action, $data);
    
    http_response_code($response['status'] ?? 200);
    echo json_encode($response['data'] ?? $response);
    
} elseif ($requestMethod === 'GET' && strpos($requestUri, '/health') !== false) {
    echo json_encode([
        'status' => 'ok',
        'timestamp' => date('c')
    ]);
} else {
    http_response_code(404);
    echo json_encode(['error' => 'Endpoint not found']);
}
