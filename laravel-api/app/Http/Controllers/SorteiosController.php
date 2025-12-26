<?php

namespace App\Http\Controllers;

class SorteiosController extends Controller
{
    public function handle($action, $data)
    {
        switch ($action) {
            case 'getSorteios':
                return $this->getSorteios($data);
            case 'createSorteio':
                return $this->createSorteio($data);
            case 'updateSorteio':
                return $this->updateSorteio($data);
            case 'deleteSorteio':
                return $this->deleteSorteio($data);
            default:
                return $this->error("Unknown action: $action");
        }
    }
    
    private function getSorteios($data)
    {
        $result = $this->db->fetchAll(
            'SELECT * FROM sorteios WHERE user_id = ? ORDER BY created_at DESC',
            [$data['authenticated_user_id']]
        );
        return $this->success(['data' => $result]);
    }
    
    private function createSorteio($data)
    {
        $id = $this->uuid();
        $premios = $data['premios'] ?? ($data['premio'] ? [$data['premio']] : []);
        $premio = $premios[0] ?? '';
        
        $this->db->query(
            "INSERT INTO sorteios (id, user_id, nome, data_sorteio, premio, premios, valor_cartela, quantidade_cartelas, status, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())",
            [
                $id,
                $data['authenticated_user_id'],
                $data['nome'],
                $data['data_sorteio'],
                $premio,
                json_encode($premios),
                $data['valor_cartela'],
                $data['quantidade_cartelas'],
                $data['status']
            ]
        );
        
        // Generate cartelas in batches
        $quantidadeCartelas = (int)($data['quantidade_cartelas'] ?? 0);
        $batchSize = 500;
        
        for ($batch = 0; $batch < ceil($quantidadeCartelas / $batchSize); $batch++) {
            $startNum = $batch * $batchSize + 1;
            $endNum = min(($batch + 1) * $batchSize, $quantidadeCartelas);
            
            $values = [];
            $params = [];
            
            for ($i = $startNum; $i <= $endNum; $i++) {
                $cartelaId = $this->uuid();
                $values[] = "(?, ?, ?, 'disponivel', NOW())";
                $params[] = $cartelaId;
                $params[] = $id;
                $params[] = $i;
            }
            
            if (count($values) > 0) {
                $this->db->query(
                    "INSERT INTO cartelas (id, sorteio_id, numero, status, created_at) VALUES " . implode(', ', $values),
                    $params
                );
            }
        }
        
        $sorteio = $this->db->fetchOne('SELECT * FROM sorteios WHERE id = ?', [$id]);
        return $this->success(['data' => [$sorteio]]);
    }
    
    private function updateSorteio($data)
    {
        $premios = $data['premios'] ?? ($data['premio'] ? [$data['premio']] : []);
        $premio = $premios[0] ?? '';
        
        $this->db->query(
            "UPDATE sorteios 
             SET nome = ?, data_sorteio = ?, premio = ?, premios = ?, valor_cartela = ?, quantidade_cartelas = ?, status = ?, updated_at = NOW()
             WHERE id = ?",
            [
                $data['nome'],
                $data['data_sorteio'],
                $premio,
                json_encode($premios),
                $data['valor_cartela'],
                $data['quantidade_cartelas'],
                $data['status'],
                $data['id']
            ]
        );
        
        $sorteio = $this->db->fetchOne('SELECT * FROM sorteios WHERE id = ?', [$data['id']]);
        return $this->success(['data' => [$sorteio]]);
    }
    
    private function deleteSorteio($data)
    {
        $this->db->query('DELETE FROM sorteios WHERE id = ?', [$data['id']]);
        return $this->success(['data' => [['success' => true]]]);
    }
}
