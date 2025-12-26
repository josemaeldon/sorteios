<?php

namespace App\Services;

class AuthService
{
    private const JWT_SECRET = 'bingo_jwt_secret_2024_secure'; // Should be in config
    private const JWT_EXPIRY_HOURS = 24;
    private const TOKEN_KEY = 'bingo_auth_token';
    
    public function hashPassword($password)
    {
        return hash('sha256', $password . 'bingo_salt_2024');
    }
    
    public function verifyPassword($password, $hash)
    {
        return $this->hashPassword($password) === $hash;
    }
    
    public function createJwt($payload)
    {
        $header = ['alg' => 'HS256', 'typ' => 'JWT'];
        $now = time();
        $fullPayload = array_merge($payload, [
            'iat' => $now,
            'exp' => $now + (self::JWT_EXPIRY_HOURS * 60 * 60),
        ]);
        
        $headerB64 = $this->base64UrlEncode(json_encode($header));
        $payloadB64 = $this->base64UrlEncode(json_encode($fullPayload));
        $signatureInput = "$headerB64.$payloadB64";
        
        $signature = hash_hmac('sha256', $signatureInput, self::JWT_SECRET, true);
        $signatureB64 = $this->base64UrlEncode($signature);
        
        return "$headerB64.$payloadB64.$signatureB64";
    }
    
    public function verifyJwt($token)
    {
        try {
            $parts = explode('.', $token);
            if (count($parts) !== 3) {
                return null;
            }
            
            list($headerB64, $payloadB64, $signatureB64) = $parts;
            
            // Verify signature
            $signatureInput = "$headerB64.$payloadB64";
            $expectedSignature = hash_hmac('sha256', $signatureInput, self::JWT_SECRET, true);
            $expectedSignatureB64 = $this->base64UrlEncode($expectedSignature);
            
            if ($signatureB64 !== $expectedSignatureB64) {
                return null;
            }
            
            // Decode payload
            $payload = json_decode($this->base64UrlDecode($payloadB64), true);
            
            // Check expiry
            if (isset($payload['exp']) && $payload['exp'] < time()) {
                return null;
            }
            
            return [
                'user_id' => $payload['user_id'],
                'role' => $payload['role'],
                'email' => $payload['email']
            ];
        } catch (\Exception $e) {
            error_log("JWT verification error: " . $e->getMessage());
            return null;
        }
    }
    
    public function checkAuth($action, $serverVars)
    {
        $publicActions = [
            'checkFirstAccess', 'setupAdmin', 'login', 
            'checkDbConfig', 'testDbConnection', 'saveDbConfig', 'initializeDatabase'
        ];
        $adminActions = ['getUsers', 'createUser', 'updateUser', 'deleteUser'];
        
        if (in_array($action, $publicActions)) {
            return ['authenticated' => true, 'user' => null];
        }
        
        $authHeader = $serverVars['HTTP_AUTHORIZATION'] ?? '';
        if (!$authHeader || strpos($authHeader, 'Bearer ') !== 0) {
            return ['authenticated' => false, 'error' => 'Não autorizado. Faça login novamente.'];
        }
        
        $token = substr($authHeader, 7);
        $user = $this->verifyJwt($token);
        
        if (!$user) {
            return ['authenticated' => false, 'error' => 'Token inválido ou expirado.'];
        }
        
        if (in_array($action, $adminActions) && $user['role'] !== 'admin') {
            return ['authenticated' => false, 'error' => 'Acesso negado. Apenas administradores.'];
        }
        
        return ['authenticated' => true, 'user' => $user];
    }
    
    private function base64UrlEncode($data)
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }
    
    private function base64UrlDecode($data)
    {
        return base64_decode(strtr($data, '-_', '+/'));
    }
}
