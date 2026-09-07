---
name: security-audit
description: Checklist and best practices for auditing code security, secret leaks, and input sanitization
---

## Checklist de Auditoria de Segurança

### 1. Gestão de Segredos
- [ ] Nenhuma API Key, token OAuth ou credencial hardcoded.
- [ ] Verificação de arquivos `.env` e `.gitignore` para evitar vazamentos acidentais.

### 2. Validação de Entradas & Sanitização
- [ ] Todos os dados fornecidos pelo usuário são validados (tipos, tamanhos, formatos).
- [ ] Prevenção de SQL Injection (uso de queries parametrizadas/ORM).
- [ ] Prevenção de Command Injection (evitar `eval()`, `exec()` não higienizado).
- [ ] Prevenção de XSS em renderizações de UI.

### 3. Autenticação & Autorização
- [ ] Verificação de permissões em todas as rotas/endpoints protegidos.
- [ ] Tokens JWT ou sessões validados com expiração e assinatura correta.

### 4. Gestão de Dependências
- [ ] Auditoria de pacotes contra vulnerabilidades conhecidas (`npm audit` ou equivalente).
