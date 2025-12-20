export interface Sorteio {
  id: string;
  nome: string;
  data_sorteio: string;
  premio: string;
  valor_cartela: number;
  quantidade_cartelas: number;
  status: 'agendado' | 'em_andamento' | 'concluido';
  created_at?: string;
  updated_at?: string;
  vendas?: {
    cartelas_vendidas: number;
    total_arrecadado: number;
  };
}

export interface Vendedor {
  id: string;
  sorteio_id: string;
  nome: string;
  telefone?: string;
  email?: string;
  cpf?: string;
  endereco?: string;
  ativo: boolean;
  cartelas_atribuidas?: number;
  cartelas_vendidas?: number;
  valor_arrecadado?: number;
  created_at?: string;
  updated_at?: string;
}

export interface Cartela {
  numero: number;
  status: 'disponivel' | 'ativa' | 'vendida' | 'devolvida';
  vendedor_id?: string;
  vendedor_nome?: string;
}

export interface Atribuicao {
  id: string;
  sorteio_id: string;
  vendedor_id: string;
  vendedor_nome?: string;
  numero_cartela: number;
  status: 'ativa' | 'vendida' | 'devolvida';
  data_atribuicao: string;
  data_devolucao?: string;
  venda_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Venda {
  id: string;
  sorteio_id: string;
  vendedor_id: string;
  vendedor_nome?: string;
  cliente_nome: string;
  cliente_telefone?: string;
  numeros_cartelas: string;
  valor_total: number;
  valor_pago: number;
  total_pago?: number;
  forma_pagamento: 'dinheiro' | 'pix' | 'cartao' | 'transferencia';
  status: 'pendente' | 'concluida';
  data_venda: string;
  created_at?: string;
  updated_at?: string;
}

export interface Pagamento {
  id: string;
  venda_id: string;
  valor: number;
  forma_pagamento: string;
  observacao?: string;
  data_pagamento: string;
  created_at?: string;
  updated_at?: string;
}

export interface DashboardData {
  estatisticas: {
    total_arrecadado: number;
    cartelas_vendidas: number;
    total_vendas: number;
    total_vendedores: number;
  };
  ranking_vendedores: Array<{
    id: string;
    nome: string;
    cartelas_vendidas: number;
    valor_arrecadado: number;
  }>;
  ultimas_vendas: Venda[];
}

export interface FiltrosVendedores {
  busca: string;
  status: 'todos' | 'ativo' | 'inativo';
}

export interface FiltrosCartelas {
  busca: string;
  status: 'todos' | 'disponivel' | 'ativa' | 'vendida' | 'devolvida';
  vendedor: string;
}

export interface FiltrosAtribuicoes {
  busca: string;
  status: 'todos' | 'ativa' | 'vendida' | 'devolvida';
  vendedor: string;
}

export interface FiltrosVendas {
  busca: string;
  status: 'todos' | 'pendente' | 'concluida';
  vendedor: string;
  periodo: 'todos' | 'hoje' | 'semana' | 'mes';
}

export type TabType = 'sorteios' | 'dashboard' | 'vendedores' | 'cartelas' | 'atribuicoes' | 'vendas' | 'relatorios';
