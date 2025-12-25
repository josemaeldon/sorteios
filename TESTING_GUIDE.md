# Guia de Testes - Correções e Melhorias

Este documento descreve como testar as alterações implementadas neste PR.

## 1. Teste da Correção de Z-Index em Tela Cheia

### Como Testar
1. Inicie o sistema
2. Faça login
3. Crie um sorteio e uma rodada
4. Entre na tela de sorteio (tab "Sortear")
5. Inicie o sorteio de uma rodada
6. Clique no botão de tela cheia (ícone Maximize)
7. Durante a animação de sorteio, observe se todos os elementos estão visíveis
8. O número grande deve estar corretamente posicionado
9. Os controles (botões de zoom, botão de sortear) devem estar visíveis

### Comportamento Esperado
- ✅ O Card do número sorteado tem `z-index: 0` (classe `z-0`)
- ✅ Todos os elementos da interface ficam visíveis
- ✅ A animação de mudança de números funciona corretamente
- ✅ Não há sobreposição indevida de elementos

### Comportamento Anterior (Bug)
- ❌ O número grande poderia sobrepor elementos da animação
- ❌ Possíveis problemas de visibilidade de controles

---

## 2. Teste da Organização de Arquivos

### Como Verificar
```bash
# Verificar estrutura de pastas
ls -la docs/
ls -la database/
ls -la deploy/
ls -la scripts/

# Verificar READMEs
cat docs/README.md
cat database/README.md
cat deploy/README.md
cat scripts/README.md
```

### Estrutura Esperada
```
bingopgm/
├── docs/                      # ✅ Toda documentação
│   ├── README.md
│   ├── CHANGELOG_FIXES.md
│   ├── FEATURES_COMPLETE.md
│   ├── IMPLEMENTATION_*.md
│   ├── README-*.md
│   └── VISUAL_*.md
├── database/                  # ✅ Scripts SQL
│   ├── README.md
│   ├── init-db.sql
│   ├── init-db-postgres-only.sql
│   └── database-complete.sql
├── deploy/                    # ✅ Arquivos de deploy
│   ├── README.md
│   ├── docker-compose.*.yml
│   ├── portainer-stack*.yml
│   └── kong*.yml
├── scripts/                   # ✅ Scripts de instalação
│   ├── README.md
│   ├── install.sh
│   ├── install-swarm.sh
│   └── init-supabase-db.sql
└── README.md                  # ✅ Atualizado com nova estrutura
```

### Comportamento Esperado
- ✅ Todos os arquivos movidos para pastas apropriadas
- ✅ Cada pasta tem README.md explicativo
- ✅ README principal atualizado com nova estrutura
- ✅ Sem arquivos duplicados ou órfãos

---

## 3. Teste do Auto-Instalador Web

### Pré-requisitos
- Banco de dados PostgreSQL configurado e rodando
- Sistema iniciado (frontend + backend)
- Banco sem usuários (tabela `usuarios` vazia)

### Como Testar

#### Cenário 1: Primeira Instalação
```bash
# 1. Limpar banco de dados (se necessário)
docker exec -i bingo-postgres psql -U postgres -d bingo -c "TRUNCATE usuarios CASCADE;"

# 2. Acessar o sistema
# Abrir navegador em http://localhost:3000/setup
```

**Passos:**
1. Você será automaticamente levado para a página de setup
2. Preencha o formulário:
   - Nome: `Administrador`
   - Email: `admin@teste.com`
   - Nome do Sistema: `Bingo Test`
   - Senha: `senha123`
   - Confirmar Senha: `senha123`
3. Clique em "Criar Administrador e Iniciar"
4. Aguarde mensagem de sucesso
5. Você será redirecionado para `/auth`
6. Faça login com as credenciais criadas

**Comportamento Esperado:**
- ✅ Página de setup carrega corretamente
- ✅ Formulário valida campos obrigatórios
- ✅ Validação de senha (mínimo 6 caracteres)
- ✅ Validação de senhas coincidentes
- ✅ Usuário administrador é criado no banco
- ✅ Redirecionamento automático para login
- ✅ Login funciona com credenciais criadas

#### Cenário 2: Sistema Já Configurado
```bash
# Acessar /setup com usuários já criados
# http://localhost:3000/setup
```

**Comportamento Esperado:**
- ✅ Detecta que sistema já está configurado
- ✅ Mostra mensagem "Sistema já configurado"
- ✅ Redireciona automaticamente para `/auth`
- ✅ Não permite criar novo administrador

#### Cenário 3: Acesso Direto ao Sistema
```bash
# Acessar raiz do sistema sem estar logado
# http://localhost:3000/
```

**Comportamento Esperado:**
- ✅ Se não houver usuários: redireciona para `/setup`
- ✅ Se houver usuários: redireciona para `/auth`
- ✅ Após login: acesso normal ao sistema

### Validações Implementadas
- ✅ Validação de email formato correto
- ✅ Validação de senha mínima 6 caracteres
- ✅ Validação de senhas coincidentes
- ✅ Validação de campos obrigatórios
- ✅ Proteção contra múltiplos administradores
- ✅ Mensagens de erro claras

### Testes de Erro

#### Senhas não coincidem
1. Preencher senha: `senha123`
2. Preencher confirmar senha: `senha456`
3. Tentar submeter
4. **Esperado:** Mensagem "As senhas não coincidem"

#### Senha muito curta
1. Preencher senha: `123`
2. Confirmar senha: `123`
3. Tentar submeter
4. **Esperado:** Mensagem "A senha deve ter pelo menos 6 caracteres"

#### Email inválido
1. Preencher email: `teste`
2. Tentar submeter
3. **Esperado:** Validação HTML5 de email

---

## Testes de Integração

### 1. Fluxo Completo de Instalação
```bash
# 1. Iniciar sistema limpo
docker-compose -f deploy/docker-compose.selfhosted.yml up -d

# 2. Aguardar serviços iniciarem
sleep 10

# 3. Acessar http://localhost:3000
# 4. Seguir wizard de instalação
# 5. Criar administrador
# 6. Fazer login
# 7. Criar sorteio
# 8. Testar funcionalidades
```

### 2. Build de Produção
```bash
# Build
npm run build

# Verificar saída
ls -lh dist/

# Servir build
npm run preview
```

**Esperado:**
- ✅ Build sem erros
- ✅ Tamanho razoável dos chunks
- ✅ Aplicação funciona em produção

---

## Checklist de Testes Completos

### Correção de Z-Index
- [ ] Testado em tela cheia
- [ ] Elementos visíveis corretamente
- [ ] Animação funciona sem problemas
- [ ] Controles acessíveis

### Organização de Arquivos
- [ ] Estrutura de pastas verificada
- [ ] READMEs presentes e úteis
- [ ] Sem arquivos duplicados
- [ ] Documentação atualizada

### Auto-Instalador
- [ ] Setup de primeira instalação funciona
- [ ] Validações de formulário funcionam
- [ ] Redirecionamento correto
- [ ] Proteção contra reconfiguração
- [ ] Login com credenciais criadas
- [ ] Sistema totalmente funcional após setup

### Build e Deploy
- [ ] Build TypeScript sem erros
- [ ] Build de produção sem erros
- [ ] Aplicação inicia corretamente
- [ ] Sem warnings críticos

---

## Problemas Conhecidos

Nenhum problema conhecido até o momento. Se encontrar algum, por favor reporte.

---

## Suporte

Para dúvidas ou problemas:
1. Verifique a documentação em `/docs`
2. Consulte os READMEs de cada pasta
3. Revise os logs: `docker-compose logs -f`
4. Crie uma issue no GitHub
