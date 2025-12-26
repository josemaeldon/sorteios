<?php
namespace App\Http\Controllers;

class VendasController extends Controller
{
    public function handle($action, $data)
    {
        switch ($action) {
            case 'getVendas':
                $sql = "SELECT ve.*, v.nome as vendedor_nome FROM vendas ve LEFT JOIN vendedores v ON ve.vendedor_id = v.id WHERE ve.sorteio_id = ? ORDER BY ve.data_venda DESC";
                $result = $this->db->fetchAll($sql, [$data['sorteio_id']]);
                // Add pagamentos for each venda
                foreach ($result as &$venda) {
                    $pagamentos = $this->db->fetchAll('SELECT forma_pagamento, valor FROM pagamentos WHERE venda_id = ? ORDER BY created_at', [$venda['id']]);
                    $venda['pagamentos'] = $pagamentos;
                }
                return $this->success(['data' => $result]);
            case 'createVenda':
                $id = $this->uuid();
                $this->db->query(
                    "INSERT INTO vendas (id, sorteio_id, vendedor_id, cliente_nome, cliente_telefone, numeros_cartelas, valor_total, valor_pago, status, data_venda) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())",
                    [$id, $data['sorteio_id'], $data['vendedor_id'], $data['cliente_nome'], $data['cliente_telefone'], $data['numeros_cartelas'], $data['valor_total'], $data['valor_pago'], $data['status']]
                );
                if (isset($data['pagamentos']) && is_array($data['pagamentos'])) {
                    foreach ($data['pagamentos'] as $pag) {
                        $pagId = $this->uuid();
                        $this->db->query('INSERT INTO pagamentos (id, venda_id, forma_pagamento, valor, data_pagamento) VALUES (?, ?, ?, ?, NOW())', [$pagId, $id, $pag['forma_pagamento'], $pag['valor']]);
                    }
                }
                $numeros = array_map('intval', array_map('trim', explode(',', $data['numeros_cartelas'])));
                foreach ($numeros as $numero) {
                    $this->db->query("UPDATE cartelas SET status = 'vendida' WHERE sorteio_id = ? AND numero = ?", [$data['sorteio_id'], $numero]);
                }
                $venda = $this->db->fetchOne('SELECT * FROM vendas WHERE id = ?', [$id]);
                return $this->success(['data' => [$venda]]);
            case 'deleteVenda':
                $venda = $this->db->fetchOne('SELECT numeros_cartelas, sorteio_id FROM vendas WHERE id = ?', [$data['id']]);
                if ($venda) {
                    $numeros = array_map('intval', array_map('trim', explode(',', $venda['numeros_cartelas'])));
                    foreach ($numeros as $numero) {
                        $this->db->query("UPDATE cartelas SET status = 'ativa' WHERE sorteio_id = ? AND numero = ?", [$venda['sorteio_id'], $numero]);
                    }
                }
                $this->db->query('DELETE FROM pagamentos WHERE venda_id = ?', [$data['id']]);
                $this->db->query('DELETE FROM vendas WHERE id = ?', [$data['id']]);
                return $this->success(['data' => [['success' => true]]]);
            case 'addPagamento':
                $pagId = $this->uuid();
                $this->db->query('INSERT INTO pagamentos (id, venda_id, forma_pagamento, valor, observacao, data_pagamento) VALUES (?, ?, ?, ?, ?, NOW())', [$pagId, $data['venda_id'], $data['forma_pagamento'], $data['valor'], $data['observacao'] ?? null]);
                $totalPaid = $this->db->fetchOne('SELECT COALESCE(SUM(valor), 0) as total_pago FROM pagamentos WHERE venda_id = ?', [$data['venda_id']]);
                $vendaInfo = $this->db->fetchOne('SELECT valor_total FROM vendas WHERE id = ?', [$data['venda_id']]);
                $newStatus = floatval($totalPaid['total_pago']) >= floatval($vendaInfo['valor_total']) ? 'concluida' : 'pendente';
                $this->db->query('UPDATE vendas SET valor_pago = ?, status = ?, updated_at = NOW() WHERE id = ?', [$totalPaid['total_pago'], $newStatus, $data['venda_id']]);
                return $this->success(['data' => [['success' => true, 'total_pago' => $totalPaid['total_pago'], 'status' => $newStatus]]]);
            case 'updateVenda':
                // This is complex - simplified version
                $this->db->query('UPDATE vendas SET vendedor_id = ?, cliente_nome = ?, cliente_telefone = ?, numeros_cartelas = ?, valor_total = ?, valor_pago = ?, status = ?, updated_at = NOW() WHERE id = ?',
                    [$data['vendedor_id'], $data['cliente_nome'], $data['cliente_telefone'], $data['numeros_cartelas'], $data['valor_total'], $data['valor_pago'], $data['status'], $data['id']]);
                $venda = $this->db->fetchOne('SELECT * FROM vendas WHERE id = ?', [$data['id']]);
                return $this->success(['data' => [$venda]]);
            default:
                return $this->error("Unknown action: $action");
        }
    }
}
