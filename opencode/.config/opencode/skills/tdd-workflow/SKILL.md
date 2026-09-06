---
name: tdd-workflow
description: Test-Driven Development (TDD) workflow. Use when implementing new features, bug fixes, or writing unit and integration tests (Red-Green-Refactor).
---

# Test-Driven Development (TDD) Workflow

Guia para ciclo rigoroso de desenvolvimento orientado a testes (Red -> Green -> Refactor).

## Ciclo de 3 Etapas:
1. 🔴 **RED (Teste Falhando Primeiro):**
   - Escreva o teste unitário/integração que expressa o comportamento esperado antes de escrever o código de produção.
   - Execute o teste e certifique-se de que ele falha pelo motivo correto (asserção falhando, não por erro de sintaxe).
2. 🟢 **GREEN (Código Mínimo para Passar):**
   - Escreva a quantidade mínima de código necessária para fazer o teste passar.
   - Não adicione abstrações desnecessárias ou código especulativo nesta etapa.
3. 🔵 **REFACTOR (Limpeza sem Quebras):**
   - Melhore a estrutura do código: extraia constantes, renomeie variáveis para clareza, remova duplicações (DRY).
   - Re-execute os testes para garantir 100% de estabilidade e ausência de regressões.

## Boas Práticas de Testes:
- **Isolamento:** Cada teste deve ser independente e idempotente (ordem de execução irrelevante).
- **Mocks com Parcimônia:** Moque apenas I/O externo (chamadas HTTP externas, gateways de pagamento). Nunca moque a lógica de domínio que está sendo testada.
- **Estrutura AAA:** Organize os testes claramente em *Arrange* (preparar dados), *Act* (executar ação) e *Assert* (verificar resultado).
- **Casos de Borda Obrigatórios:** Teste valores vazios, arrays vazios, nulos, off-by-one e estouro de limites.
