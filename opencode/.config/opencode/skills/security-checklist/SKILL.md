---
name: security-checklist
description: Security verification checklist covering secrets, sanitization, injection, and dependency risks
---

## Checklist de Segurança em Código
1. **Segredos**: Nenhuma chave API, token OAuth ou senha hardcoded.
2. **Sanitização de Inputs**: Validar todos os campos externos via Zod, Yup ou schemas equivalentes.
3. **Injections**: Usar queries parametrizadas em banco de dados; proibir `eval()` ou substituições de string no shell.
4. **Vulnerabilidades de Deps**: Verificar relatórios de `npm audit` ou `pip-audit`.
