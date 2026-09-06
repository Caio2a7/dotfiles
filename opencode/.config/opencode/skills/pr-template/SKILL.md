---
name: pr-template
description: Generate pull request descriptions with context, technical changes, testing instructions, and validation checklist
---

## Template de Pull Request

```markdown
### 📝 Contexto & Motivação
Explique por que esta alteração é necessária e qual problema resolve.

### 🛠️ O que mudou
- Item 1: Breve descrição da mudança técnica.
- Item 2: Modificação em contrato/banco/interface.

### 🧪 Como testar
1. Passo 1 para reproduzir/validar a alteração.
2. Comando para rodar a suíte de testes relevante: `npm test` ou `pytest`.

### 📋 Checklist de Qualidade
- [ ] Testes unitários/integração adicionados ou atualizados e passando.
- [ ] Sem segredos, chaves ou tokens expostos no código.
- [ ] Documentação (`docs/spec.md` ou README) atualizada.
- [ ] Breaking changes sinalizados e documentados.
```
