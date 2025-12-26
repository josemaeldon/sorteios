<?php
namespace App\Http\Controllers;

class VendedoresController extends Controller
{
    public function handle($action, $data)
    {
        switch ($action) {
            case 'getVendedores':
                $result = $this->db->fetchAll('SELECT * FROM vendedores WHERE sorteio_id = ? ORDER BY nome', [$data['sorteio_id']]);
                return $this->success(['data' => $result]);
            case 'createVendedor':
                $id = $this->uuid();
                $this->db->query(
                    "INSERT INTO vendedores (id, sorteio_id, nome, telefone, email, cpf, endereco, ativo, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())",
                    [$id, $data['sorteio_id'], $data['nome'], $data['telefone'], $data['email'], $data['cpf'], $data['endereco'], $data['ativo']]
                );
                $vendedor = $this->db->fetchOne('SELECT * FROM vendedores WHERE id = ?', [$id]);
                return $this->success(['data' => [$vendedor]]);
            case 'updateVendedor':
                $this->db->query(
                    "UPDATE vendedores SET nome = ?, telefone = ?, email = ?, cpf = ?, endereco = ?, ativo = ?, updated_at = NOW() WHERE id = ?",
                    [$data['nome'], $data['telefone'], $data['email'], $data['cpf'], $data['endereco'], $data['ativo'], $data['id']]
                );
                $vendedor = $this->db->fetchOne('SELECT * FROM vendedores WHERE id = ?', [$data['id']]);
                return $this->success(['data' => [$vendedor]]);
            case 'deleteVendedor':
                $this->db->query('DELETE FROM vendedores WHERE id = ?', [$data['id']]);
                return $this->success(['data' => [['success' => true]]]);
            default:
                return $this->error("Unknown action: $action");
        }
    }
}
