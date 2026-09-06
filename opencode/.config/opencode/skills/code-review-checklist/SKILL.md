---
name: code-review-checklist
description: Senior code review checklist covering correctness, performance, maintainability, and test coverage
---

## Checklist de Code Review Sênior

### 1. Correção Funcional & Lógica
- [ ] O código resolve o problema proposto sem introduzir efeitos colaterais?
- [ ] Casos de borda (valores nulos, coleções vazias, estouros) são tratados explicitamente?

### 2. Design & Arquitetura
- [ ] Responsabilidade única mantida (SRP)?
- [ ] Código legível e autodocumentado (nomes de variáveis e funções expressivos)?
- [ ] Acoplamento adequado e coesão elevada?

### 3. Performance & Recursos
- [ ] Inexistência de loops O(n^2) ou consultas N+1 evitáveis.
- [ ] Recursos como conexões de rede, arquivos e streams são fechados apropriadamente.

### 4. Testes & Qualidade
- [ ] Testes cobrem os cenários felizes e casos de falha/exceção.
- [ ] Testes determinísticos (sem dependência de estado global aleatório).
