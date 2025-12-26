<?php

namespace App\Http\Controllers;

class AuthController extends Controller
{
    public function handle($action, $data)
    {
        switch ($action) {
            case 'checkFirstAccess':
                return $this->checkFirstAccess();
            case 'setupAdmin':
                return $this->setupAdmin($data);
            case 'login':
                return $this->login($data);
            case 'getUsers':
                return $this->getUsers();
            case 'createUser':
                return $this->createUser($data);
            case 'updateUser':
                return $this->updateUser($data);
            case 'deleteUser':
                return $this->deleteUser($data);
            case 'updateProfile':
                return $this->updateProfile($data);
            default:
                return $this->error("Unknown action: $action");
        }
    }
    
    private function checkFirstAccess()
    {
        $result = $this->db->fetchOne('SELECT COUNT(*) as count FROM usuarios');
        return $this->success(['isFirstAccess' => (int)$result['count'] === 0]);
    }
    
    private function setupAdmin($data)
    {
        $existingCheck = $this->db->fetchOne('SELECT COUNT(*) as count FROM usuarios');
        if ((int)$existingCheck['count'] > 0) {
            return $this->success(['error' => 'Administrador já existe']);
        }
        
        $id = $this->uuid();
        $adminHash = $this->auth->hashPassword($data['senha']);
        
        $this->db->query(
            "INSERT INTO usuarios (id, email, senha_hash, nome, role, ativo, titulo_sistema, created_at)
             VALUES (?, ?, ?, ?, 'admin', 1, ?, NOW())",
            [$id, $data['email'], $adminHash, $data['nome'], $data['titulo_sistema'] ?? 'Sorteios']
        );
        
        $user = $this->db->fetchOne(
            'SELECT id, email, nome, role, ativo, titulo_sistema, avatar_url, created_at FROM usuarios WHERE id = ?',
            [$id]
        );
        
        return $this->success(['user' => $user]);
    }
    
    private function login($data)
    {
        $user = $this->db->fetchOne(
            'SELECT id, email, nome, role, ativo, titulo_sistema, avatar_url, senha_hash, created_at 
             FROM usuarios WHERE email = ?',
            [$data['email']]
        );
        
        if (!$user) {
            return $this->success(['error' => 'Credenciais inválidas']);
        }
        
        if (!$this->auth->verifyPassword($data['senha'], $user['senha_hash'])) {
            return $this->success(['error' => 'Credenciais inválidas']);
        }
        
        if (!$user['ativo']) {
            return $this->success(['error' => 'Usuário inativo. Contate o administrador.']);
        }
        
        $token = $this->auth->createJwt([
            'user_id' => $user['id'],
            'role' => $user['role'],
            'email' => $user['email']
        ]);
        
        unset($user['senha_hash']);
        
        return $this->success(['user' => $user, 'token' => $token]);
    }
    
    private function getUsers()
    {
        $users = $this->db->fetchAll(
            'SELECT id, email, nome, role, ativo, titulo_sistema, avatar_url, created_at, updated_at 
             FROM usuarios ORDER BY nome'
        );
        return $this->success(['users' => $users]);
    }
    
    private function createUser($data)
    {
        $id = $this->uuid();
        $passwordHash = $this->auth->hashPassword($data['senha']);
        
        $this->db->query(
            "INSERT INTO usuarios (id, email, senha_hash, nome, role, ativo, titulo_sistema, avatar_url, created_at)
             VALUES (?, ?, ?, ?, ?, 1, ?, ?, NOW())",
            [
                $id,
                $data['email'],
                $passwordHash,
                $data['nome'],
                $data['role'],
                $data['titulo_sistema'] ?? 'Sorteios',
                $data['avatar_url'] ?? null
            ]
        );
        
        $user = $this->db->fetchOne(
            'SELECT id, email, nome, role, ativo, titulo_sistema, avatar_url, created_at FROM usuarios WHERE id = ?',
            [$id]
        );
        
        return $this->success(['user' => $user]);
    }
    
    private function updateUser($data)
    {
        if (isset($data['senha']) && !empty($data['senha'])) {
            $passwordHash = $this->auth->hashPassword($data['senha']);
            $this->db->query(
                'UPDATE usuarios SET email = ?, nome = ?, role = ?, senha_hash = ?, titulo_sistema = ?, updated_at = NOW() WHERE id = ?',
                [$data['email'], $data['nome'], $data['role'], $passwordHash, $data['titulo_sistema'] ?? 'Sorteios', $data['id']]
            );
        } else {
            $this->db->query(
                'UPDATE usuarios SET email = ?, nome = ?, role = ?, titulo_sistema = ?, updated_at = NOW() WHERE id = ?',
                [$data['email'], $data['nome'], $data['role'], $data['titulo_sistema'] ?? 'Sorteios', $data['id']]
            );
        }
        
        return $this->success(['success' => true]);
    }
    
    private function deleteUser($data)
    {
        $this->db->query('DELETE FROM usuarios WHERE id = ?', [$data['id']]);
        return $this->success(['success' => true]);
    }
    
    private function updateProfile($data)
    {
        $userId = $data['authenticated_user_id'];
        
        if (isset($data['nova_senha']) && !empty($data['nova_senha'])) {
            $currentUser = $this->db->fetchOne(
                'SELECT senha_hash FROM usuarios WHERE id = ?',
                [$userId]
            );
            
            if (!$currentUser) {
                return $this->success(['error' => 'Usuário não encontrado']);
            }
            
            if (!$this->auth->verifyPassword($data['senha_atual'], $currentUser['senha_hash'])) {
                return $this->success(['error' => 'Senha atual incorreta']);
            }
            
            $newHash = $this->auth->hashPassword($data['nova_senha']);
            $this->db->query(
                'UPDATE usuarios SET nome = ?, email = ?, titulo_sistema = ?, avatar_url = ?, senha_hash = ?, updated_at = NOW() WHERE id = ?',
                [$data['nome'], $data['email'], $data['titulo_sistema'], $data['avatar_url'] ?? null, $newHash, $userId]
            );
        } else {
            $this->db->query(
                'UPDATE usuarios SET nome = ?, email = ?, titulo_sistema = ?, avatar_url = ?, updated_at = NOW() WHERE id = ?',
                [$data['nome'], $data['email'], $data['titulo_sistema'], $data['avatar_url'] ?? null, $userId]
            );
        }
        
        return $this->success(['success' => true]);
    }
}
