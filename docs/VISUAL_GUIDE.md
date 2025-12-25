# Visual Guide - New Features

## 1. Rodadas Tab (New!)

### Navigation Bar
```
┌─────────────────────────────────────────────────────────────┐
│ Sorteios │ Dashboard │ [Rodadas] │ Sortear │ Vendedores │..│
└─────────────────────────────────────────────────────────────┘
                          ↑ NEW!
```

### Rodadas List View
```
┌─────────────────────────────────────────────────────────────┐
│ 🎲 Rodadas - Bingo de Natal                  [+ Nova Rodada]│
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────┐  ┌──────────────────┐  ┌─────────────┐│
│  │ Rodada 1         │  │ Rodada 2         │  │ Rodada 3    ││
│  │ 🟢 Ativo         │  │ 🟢 Ativo         │  │ ✅ Concluído ││
│  │                  │  │                  │  │             ││
│  │ Faixa: 1 - 75    │  │ Faixa: 1 - 100   │  │ Faixa: 1-50 ││
│  │ Total: 75        │  │ Total: 100       │  │ Total: 50   ││
│  │ Sorteados: 23    │  │ Sorteados: 0     │  │ Sorteados:50││
│  │                  │  │                  │  │             ││
│  │ [▶ Sortear] [✏] │  │ [▶ Sortear] [✏] │  │ [▶] [✏] [🗑]││
│  │           [🗑]   │  │           [🗑]   │  │             ││
│  └──────────────────┘  └──────────────────┘  └─────────────┘│
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Create/Edit Rodada Modal
```
┌─────────────────────────────────────────┐
│ 🎲 Nova Rodada                    [X]   │
├─────────────────────────────────────────┤
│                                         │
│ Nome da Rodada *                        │
│ ┌─────────────────────────────────────┐ │
│ │ Rodada da Manhã                     │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ Número Inicial *    Número Final *      │
│ ┌──────────────┐    ┌──────────────┐   │
│ │      1       │    │     75       │   │
│ └──────────────┘    └──────────────┘   │
│                                         │
│ Status *                                │
│ ┌─────────────────────────────────────┐ │
│ │ Ativo              ▼                │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ Total de números: 75                    │
│                                         │
│  [Criar]          [Cancelar]            │
└─────────────────────────────────────────┘
```

## 2. Sortear Tab (Updated!)

### Before (Old)
```
┌─────────────────────────────────────────┐
│ Sortear: Bingo de Natal                 │
│ Configure a faixa de números...         │
│                                         │
│ [Configuration form always shown]       │
└─────────────────────────────────────────┘
```

### After (New - With Rodada Selected)
```
┌─────────────────────────────────────────────────────────────┐
│ [← Voltar]                                                   │
│ Rodada da Manhã                                             │
│ Faixa: 1 a 75 | Sorteados: 23 | Restantes: 52              │
│                                [Sortear] [Reiniciar]         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│              ┌────────────────────┐                          │
│              │                    │                          │
│              │                    │                          │
│              │        42          │  ← Current Number       │
│              │                    │                          │
│              │                    │                          │
│              └────────────────────┘                          │
│                                                              │
│  Números Sorteados:                                          │
│  [12] [7] [34] [19] [42*] ...                               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### After (New - No Rodada Selected)
```
┌─────────────────────────────────────────┐
│ 🎲 Nenhuma rodada selecionada           │
│                                         │
│ Selecione uma rodada na aba "Rodadas"  │
│ para começar a sortear                  │
│                                         │
│      [← Ir para Rodadas]                │
└─────────────────────────────────────────┘
```

## 3. Vendas Tab - Payment Methods Display

### Before (Old)
```
┌─────────────────────────────────────────────────────────────┐
│ Data      │ Cliente │ Vendedor │ Cartelas │ Valor │ Pago   │
├─────────────────────────────────────────────────────────────┤
│ 25/12/24  │ João    │ Maria    │ 1,2,3    │ R$30  │ R$30   │
│                                                     └────┘   │
│                                            Only total shown  │
└─────────────────────────────────────────────────────────────┘
```

### After (New - Multiple Payments)
```
┌─────────────────────────────────────────────────────────────┐
│ Data      │ Cliente │ Vendedor │ Cartelas │ Valor │ Pago   │
├─────────────────────────────────────────────────────────────┤
│ 25/12/24  │ João    │ Maria    │ 1,2,3    │ R$30  │        │
│                                                     dinheiro:│
│                                                     R$20,00  │
│                                                     pix:     │
│                                                     R$10,00  │
│                                                     ───────  │
│                                                     Total:   │
│                                                     R$30,00  │
└─────────────────────────────────────────────────────────────┘
```

### After (New - Single Payment - Backward Compatible)
```
┌─────────────────────────────────────────────────────────────┐
│ Data      │ Cliente │ Vendedor │ Cartelas │ Valor │ Pago   │
├─────────────────────────────────────────────────────────────┤
│ 25/12/24  │ Ana     │ Pedro    │ 4,5      │ R$20  │ R$20   │
│                                                     └────┘   │
│                                            Works as before   │
└─────────────────────────────────────────────────────────────┘
```

## 4. User Workflow Diagram

### Creating and Using Rodadas
```
Start
  │
  ├─→ [Sorteios Tab] Select a sorteio
  │
  ├─→ [Rodadas Tab] Click "Nova Rodada"
  │
  ├─→ Fill in:
  │   • Name: "Rodada 1"
  │   • Range: 1-75
  │   • Status: Ativo
  │
  ├─→ Click "Criar"
  │
  ├─→ Rodada appears in list
  │
  ├─→ Click "Sortear" button on rodada
  │
  ├─→ [Sortear Tab] Opens with rodada loaded
  │
  ├─→ Click "Sortear" to draw numbers
  │
  ├─→ Numbers saved to rodada history
  │
  ├─→ Click "Voltar" to manage other rodadas
  │
  └─→ Can edit/delete rodadas anytime
```

### Multiple Payment Methods
```
Start
  │
  ├─→ [Vendas Tab] Click "Nova Venda"
  │
  ├─→ Fill in customer and cartela details
  │
  ├─→ In Pagamentos section:
  │   • Select "dinheiro", enter R$50
  │   • Click "Adicionar"
  │   • Select "pix", enter R$30
  │
  ├─→ Total shows R$80
  │
  ├─→ Click "Registrar"
  │
  └─→ In sales table, both methods visible:
      dinheiro: R$50,00
      pix: R$30,00
      Total: R$80,00
```

## 5. Database Structure

### New Table: rodadas_sorteio
```
┌────────────────┬──────────────┬─────────────┐
│ id (UUID)      │ sorteio_id   │ nome        │
├────────────────┼──────────────┼─────────────┤
│ abc-123...     │ xyz-789...   │ Rodada 1    │
│ def-456...     │ xyz-789...   │ Rodada 2    │
└────────────────┴──────────────┴─────────────┘

┌───────────────┬─────────────┬─────────────┬─────────────┐
│ range_start   │ range_end   │ status      │ created_at  │
├───────────────┼─────────────┼─────────────┼─────────────┤
│ 1             │ 75          │ ativo       │ 2024-12-25  │
│ 1             │ 100         │ ativo       │ 2024-12-25  │
└───────────────┴─────────────┴─────────────┴─────────────┘
```

### Updated Table: sorteio_historico
```
┌────────────────┬──────────────┬──────────────┬───────────────────┐
│ id (UUID)      │ sorteio_id   │ rodada_id ✨ │ numero_sorteado  │
├────────────────┼──────────────┼──────────────┼───────────────────┤
│ 111-222...     │ xyz-789...   │ abc-123...   │ 42               │
│ 333-444...     │ xyz-789...   │ abc-123...   │ 7                │
│ 555-666...     │ xyz-789...   │ def-456...   │ 89               │
└────────────────┴──────────────┴──────────────┴───────────────────┘
                                   ↑ NEW COLUMN!
```

## 6. API Endpoints

### New Endpoints (7)
```
POST   /api/rodadas              - Create rodada
GET    /api/rodadas/:sorteio_id  - List rodadas
PUT    /api/rodadas/:id          - Update rodada
DELETE /api/rodadas/:id          - Delete rodada
GET    /api/rodadas/:id/historico - Get rodada history
POST   /api/rodadas/:id/numero   - Save drawn number
DELETE /api/rodadas/:id/historico - Clear rodada history
```

## Summary of Changes

✅ **1 New Tab**: Rodadas - Complete round management
✅ **1 Updated Tab**: Sortear - Now works with selected rodada
✅ **1 Updated Tab**: Vendas - Shows payment breakdown
✅ **1 New Table**: rodadas_sorteio
✅ **1 Updated Table**: sorteio_historico (+ rodada_id)
✅ **7 New API Endpoints**: Full CRUD for rodadas
✅ **100% Backward Compatible**: Old data still works

## Color Legend
🟢 Ativo (Active)
✅ Concluído (Completed)
🔴 Cancelado (Canceled)
✨ New Feature
✏ Edit
🗑 Delete
▶ Play/Start
🎲 Dice/Bingo Icon
