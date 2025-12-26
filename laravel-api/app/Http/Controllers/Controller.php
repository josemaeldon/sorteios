<?php

namespace App\Http\Controllers;

abstract class Controller
{
    protected $db;
    protected $auth;
    
    public function __construct($db, $auth = null)
    {
        $this->db = $db;
        $this->auth = $auth;
    }
    
    abstract public function handle($action, $data);
    
    protected function success($data = [], $status = 200)
    {
        return ['status' => $status, 'data' => $data];
    }
    
    protected function error($message, $status = 400)
    {
        return ['status' => $status, 'data' => ['error' => $message]];
    }
    
    protected function uuid()
    {
        return sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
            mt_rand(0, 0xffff), mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0x0fff) | 0x4000,
            mt_rand(0, 0x3fff) | 0x8000,
            mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
        );
    }
}
