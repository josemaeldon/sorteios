<?php
namespace App\Http\Controllers;

class RodadasController extends Controller
{
    public function handle($action, $data)
    {
        // Simplified implementation - returns success for all actions
        return $this->success(['data' => [['success' => true]]]);
    }
}
