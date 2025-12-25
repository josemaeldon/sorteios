# Documentação - Documentation

Este diretório contém toda a documentação do projeto.

## Arquivos Disponíveis

### Guias de Implementação
- `IMPLEMENTATION_COMPLETE.md` - Documentação completa da implementação
- `IMPLEMENTATION_SUMMARY.md` - Resumo da implementação
- `FEATURES_COMPLETE.md` - Lista completa de funcionalidades

### Guias de Deploy
- `README-SELFHOSTED.md` - Guia para deploy self-hosted (independente)
- `README-POSTGRES-ONLY.md` - Guia para deploy com PostgreSQL puro
- `README-TRAEFIK.md` - Guia para deploy com Traefik (reverse proxy)

### Guias Visuais
- `VISUAL_GUIDE.md` - Guia visual do sistema
- `VISUAL_SUMMARY.md` - Resumo visual das funcionalidades

### Histórico
- `CHANGELOG_FIXES.md` - Histórico de correções e melhorias

## Quick Start

Para começar rapidamente, consulte o [README.md principal](../README.md) na raiz do projeto.

### Escolha seu Método de Deploy

1. **Docker Compose (Recomendado)** - Veja o README principal
2. **Self-Hosted** - Consulte `README-SELFHOSTED.md`
3. **PostgreSQL Puro** - Consulte `README-POSTGRES-ONLY.md`
4. **Produção com Traefik** - Consulte `README-TRAEFIK.md`

## Estrutura de Documentação

```
docs/
├── README.md (este arquivo)
├── Implementation guides (IMPLEMENTATION_*.md)
├── Deployment guides (README-*.md)
├── Visual guides (VISUAL_*.md)
└── Changelog (CHANGELOG_*.md)
```

## Links Úteis

- [Documentação principal](../README.md)
- [Estrutura do banco de dados](../database/README.md)
- [Scripts de deploy](../deploy/)
- [Scripts auxiliares](../scripts/)
