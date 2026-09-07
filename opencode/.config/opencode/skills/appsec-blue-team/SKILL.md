---
name: appsec-blue-team
description: Defensive application security, secure configuration, OWASP hardening, and CVE remediation. Use when auditing code security, hardening APIs, fixing vulnerabilities, or applying defense-in-depth ('blue team', 'segurança defensiva', 'hardening', 'corrija vulnerabilidade').
---

# Defensive Application Security (Blue Team Playbook)

Diretrizes práticas para hardening, remediação de código e defesa em profundidade baseadas em OWASP ASVS e CIS Benchmarks.

## 1. Defesas Contra Injeções & Manipulação de Dados
- **SQL / NoSQL Injection:**
  - Utilize parâmetros nomeados ou ORMs com tipagem segura (Prisma, Drizzle, SQLAlchemy).
  - Nunca interpole strings de variáveis em queries raw (`SELECT * FROM users WHERE id = ${id}` é expressamente proibido).
- **Command Injection:**
  - Prefira APIs nativas de linguagem em vez de `child_process.exec()` ou `os.system()`.
  - Se precisar executar processos, use arrays de argumentos sem shell (`execFile(['ls', path])` em vez de `exec('ls ' + path)`).
- **Sanitização de Saída (XSS):**
  - Use bibliotecas de escape contextual (`DOMPurify` para HTML inserido dinamicamente).
  - Configure headers HTTP defensivos:
    ```http
    Content-Security-Policy: default-src 'self'; script-src 'self'; object-src 'none';
    X-Content-Type-Options: nosniff
    X-Frame-Options: DENY
    Strict-Transport-Security: max-age=31536000; includeSubDomains
    ```

## 2. Controle de Acesso & Autorização (Prevenção de IDOR/BOLA)
- Toda consulta a recursos do banco de dados DEVE incluir a cláusula de posse do usuário autenticado:
  ```typescript
  // ❌ Inseguro (IDOR):
  const order = await db.order.findUnique({ where: { id: req.params.orderId } });

  // ✅ Seguro (Proteção contra IDOR):
  const order = await db.order.findFirst({
    where: { id: req.params.orderId, userId: req.user.id }
  });
  ```

## 3. Gestão de Segredos & Variáveis de Ambiente
- Segredos devem ser injetados exclusivamente via variáveis de ambiente (`process.env.VAR`), nunca em código.
- Implemente pre-commit hooks para detectar chaves vazadas (ex: detect-secrets, gitleaks).
- Certifique-se de que arquivos `.env*` locais estão no `.gitignore`.

## 4. Auditoria de CVEs de Terceiros (SCA)
- Para Node.js: `npm audit` ou `pnpm audit`.
- Para Python: `pip-audit` ou `safety check`.
- Para Rust: `cargo audit`.
- Atualize pacotes com vulnerabilidades conhecidas para as versões estáveis que contenham o patch.
