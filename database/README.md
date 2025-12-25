# Database - Banco de Dados

Este diretório contém os arquivos relacionados ao banco de dados do sistema.

## Arquivos Principais

### `init-db.sql` - Script Principal de Inicialização ✨
**Use este arquivo para inicializar o banco de dados!**

Este é o script unificado e simplificado que contém:
- Criação de todas as tabelas necessárias
- Índices para performance
- Funções auxiliares
- Triggers automáticos
- **Usuário administrador padrão**
  - Email: `admin@bingo.local`
  - Senha: `admin123`

### Como Usar

#### Usando Docker (Recomendado)
O banco de dados é criado automaticamente ao iniciar o sistema com Docker Compose.

#### Manualmente com PostgreSQL
```bash
psql -U postgres -d bingo -f database/init-db.sql
```

#### Com Auto-Instalador Web
Acesse `/setup` na primeira inicialização do sistema para configurar automaticamente.

## Outros Arquivos

- `database-complete.sql` - Versão completa com dados de exemplo (legado)
- `init-db-postgres-only.sql` - Versão específica para PostgreSQL puro (legado)

## Estrutura do Banco de Dados

### Tabelas Principais
- `usuarios` - Usuários do sistema com autenticação
- `sorteios` - Sorteios criados pelos usuários
- `rodadas_sorteio` - Rodadas de cada sorteio
- `vendedores` - Vendedores cadastrados
- `cartelas` - Cartelas de bingo
- `atribuicoes` - Atribuições de cartelas para vendedores
- `vendas` - Registro de vendas
- `sorteio_historico` - Histórico de números sorteados

### Relacionamentos
- Cada sorteio pertence a um usuário
- Sorteios têm múltiplas rodadas
- Vendedores são vinculados a sorteios específicos
- Cartelas podem ser atribuídas a vendedores
- Vendas registram transações de cartelas

## Migrações

As migrações do backend estão em `/backend/migrations/` e são aplicadas automaticamente pelo sistema.
