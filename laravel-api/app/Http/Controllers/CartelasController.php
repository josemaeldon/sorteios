<?php

namespace App\Http\Controllers;

class CartelasController extends Controller
{
    public function handle($action, $data)
    {
        switch ($action) {
            case 'getCartelas':
                $result = $this->db->fetchAll(
                    'SELECT * FROM cartelas WHERE sorteio_id = ? ORDER BY numero',
                    [$data['sorteio_id']]
                );
                return $this->success(['data' => $result]);
                
            case 'updateCartela':
                $this->db->query(
                    'UPDATE cartelas SET status = ?, vendedor_id = ?, updated_at = NOW() WHERE sorteio_id = ? AND numero = ?',
                    [$data['status'], $data['vendedor_id'], $data['sorteio_id'], $data['numero']]
                );
                $cartela = $this->db->fetchOne(
                    'SELECT * FROM cartelas WHERE sorteio_id = ? AND numero = ?',
                    [$data['sorteio_id'], $data['numero']]
                );
                return $this->success(['data' => [$cartela]]);
                
            case 'updateCartelasBatch':
                foreach ($data['cartelas'] as $cartela) {
                    $this->db->query(
                        'UPDATE cartelas SET status = ?, vendedor_id = ?, updated_at = NOW() WHERE sorteio_id = ? AND numero = ?',
                        [$cartela['status'], $cartela['vendedor_id'], $data['sorteio_id'], $cartela['numero']]
                    );
                }
                return $this->success(['data' => [['success' => true]]]);
                
            case 'gerarCartelas':
                $this->db->query('DELETE FROM cartelas WHERE sorteio_id = ?', [$data['sorteio_id']]);
                
                $totalCartelas = (int)($data['quantidade'] ?? 0);
                $batchSize = 500;
                
                for ($batch = 0; $batch < ceil($totalCartelas / $batchSize); $batch++) {
                    $startNum = $batch * $batchSize + 1;
                    $endNum = min(($batch + 1) * $batchSize, $totalCartelas);
                    
                    $values = [];
                    $params = [];
                    
                    for ($i = $startNum; $i <= $endNum; $i++) {
                        $id = $this->uuid();
                        $values[] = "(?, ?, ?, 'disponivel', NOW())";
                        $params[] = $id;
                        $params[] = $data['sorteio_id'];
                        $params[] = $i;
                    }
                    
                    if (count($values) > 0) {
                        $this->db->query(
                            "INSERT INTO cartelas (id, sorteio_id, numero, status, created_at) VALUES " . implode(', ', $values),
                            $params
                        );
                    }
                }
                
                return $this->success(['data' => [['success' => true, 'quantidade' => $totalCartelas]]]);
                
            default:
                return $this->error("Unknown action: $action");
        }
    }
}
