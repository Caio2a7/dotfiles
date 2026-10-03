---
name: security-checklist
description: Checklist rápido e enxuto de verificação de segurança sincronizado com a skill canônica 'security-audit'.
---

# Checklist Rápido de Segurança

Checklist de validação pré-commit e pré-merge. Para diretrizes detalhadas de conformidade, consulte a skill canônica `security-audit`.

## Verificação Rápida
1. **Segredos & Credenciais:** Zero hardcoded API keys, tokens ou senhas; `.env` ignorado no `.gitignore`.
2. **Sanitização & Validação:** Inputs externos validados estritamente via schemas (Zod/Yup); payloads delimitados.
3. **Injeções & Execução:** Queries 100% parametrizadas/ORM; proibido `eval()`, `exec()` e interpolação em shell.
4. **XSS & Frontend:** Sanitização com `DOMPurify`; proibido HTML dinâmico não escapado.
5. **Headers & Transporte:** CSP restritivo, HSTS, `X-Frame-Options` e `X-Content-Type-Options: nosniff`.
6. **Controle de Acesso:** Verificação explícita de permissões e prevenção de IDOR/BOLA (`userId: currentUser.id`).
7. **Dependências (SCA):** Zero vulnerabilidades críticas/altas no relatório de auditoria (`npm audit`, `pip-audit`).

> ℹ️ **Referência Completa:** Para análise aprofundada, requisitos OWASP e regras estruturais, invoque a skill `security-audit`.
