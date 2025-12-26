<?php
namespace App\Http\Controllers;

class AtribuicoesController extends Controller
{
    public function handle($action, $data)
    {
        switch ($action) {
            case 'getAtribuicoes':
                $result = $this->db->fetchAll('SELECT a.*, v.nome as vendedor_nome FROM atribuicoes a LEFT JOIN vendedores v ON a.vendedor_id = v.id WHERE a.sorteio_id = ? ORDER BY v.nome', [$data['sorteio_id']]);
                foreach ($result as &$atrib) {
                    $cartelas = $this->db->fetchAll('SELECT numero_cartela as numero, status, data_atribuicao, data_devolucao, venda_id FROM atribuicao_cartelas WHERE atribuicao_id = ? ORDER BY numero_cartela', [$atrib['id']]);
                    $atrib['cartelas'] = $cartelas ?: [];
                }
                return $this->success(['data' => $result]);
            case 'createAtribuicao':
                $atribId = $this->uuid();
                $this->db->query('INSERT INTO atribuicoes (id, sorteio_id, vendedor_id, created_at) VALUES (?, ?, ?, NOW())', [$atribId, $data['sorteio_id'], $data['vendedor_id']]);
                foreach ($data['cartelas'] as $cartela) {
                    $acId = $this->uuid();
                    $this->db->query("INSERT INTO atribuicao_cartelas (id, atribuicao_id, numero_cartela, status, data_atribuicao) VALUES (?, ?, ?, 'ativa', NOW())", [$acId, $atribId, $cartela]);
                    $this->db->query('UPDATE cartelas SET status = ?, vendedor_id = ? WHERE sorteio_id = ? AND numero = ?', ['ativa', $data['vendedor_id'], $data['sorteio_id'], $cartela]);
                }
                $atrib = $this->db->fetchOne('SELECT * FROM atribuicoes WHERE id = ?', [$atribId]);
                return $this->success(['data' => [$atrib]]);
            case 'deleteAtribuicao':
                $cartelas = $this->db->fetchAll('SELECT numero_cartela FROM atribuicao_cartelas WHERE atribuicao_id = ?', [$data['atribuicao_id']]);
                foreach ($cartelas as $c) {
                    $this->db->query("UPDATE cartelas SET status = 'disponivel', vendedor_id = NULL WHERE sorteio_id = ? AND numero = ?", [$data['sorteio_id'], $c['numero_cartela']]);
                }
                $this->db->query('DELETE FROM atribuicao_cartelas WHERE atribuicao_id = ?', [$data['atribuicao_id']]);
                $this->db->query('DELETE FROM atribuicoes WHERE id = ?', [$data['atribuicao_id']]);
                return $this->success(['data' => [['success' => true]]]);
            default:
                return $this->success(['data' => [['success' => true]]]); // Simplified for other actions
        }
    }
}
