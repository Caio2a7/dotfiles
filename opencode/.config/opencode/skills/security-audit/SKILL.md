---
name: security-audit
description: Auditoria completa e checklist de segurança de código: segredos, sanitização de inputs, injeções SQL/Command, XSS, headers de segurança, autenticação/autorização e dependências vulneráveis (CVEs).
---

# Auditoria Completa de Segurança de Código

Checklist exaustivo para inspeção estática, code review e validação de segurança em aplicações e pipelines.

---

## 1. Gestão de Segredos & Credenciais
- [ ] **Zero Hardcoded Secrets**: Nenhuma API Key, token OAuth, chave privada ou senha presente em código-fonte, commits ou fixtures.
- [ ] **Variáveis de Ambiente**: Segredos injetados unicamente via `process.env` ou cofres de segredos (ex: Vault, Doppler).
- [ ] **Isolamento de Arquivos Locais**: Arquivos `.env`, `.env.local` e credenciais listados no `.gitignore` e fora do versionamento.
- [ ] **Proteção de Pré-Commit**: Hooks ou linters de varredura ativa de segredos configurados (ex: Gitleaks, detect-secrets).

---

## 2. Sanitização de Inputs & Validação de Schemas
- [ ] **Validação Estrita de Entrada**: Todos os payloads externos (body, query params, headers, cookies) validados via schemas estritos (Zod, Yup, Pydantic, etc.).
- [ ] **Restrição de Tamanho e Formato**: Limites de tamanho de payload configurados para mitigar DoS por exaustão de memória.
- [ ] **Tipagem Segura**: Tipos primitivos forçados no ponto de entrada antes de qualquer processamento negocial.

---

## 3. Prevenção de Injeções (SQL, NoSQL & Command)
- [ ] **SQL / NoSQL Injection**:
  - Uso obrigatório de queries parametrizadas, prepared statements ou ORMs seguros (Prisma, Drizzle, SQLAlchemy).
  - Proibida interpolação ou concatenação direta de strings em comandos raw de banco de dados.
- [ ] **Command Injection**:
  - Proibido o uso de `eval()`, `exec()`, `Function()` ou chamadas de shell abertas (`child_process.exec`, `os.system`).
  - Execução de processos externos estritamente via lista de argumentos fechada (`execFile(['cmd', 'arg'])`).

---

## 4. XSS & Sanitização de Renderização (UI / Templates)
- [ ] **Escape Contextual**: Sanitização de qualquer HTML inserido dinamicamente com biblioteca auditada (`DOMPurify` ou sanitizers nativos).
- [ ] **Renderização Segura no Frontend**: Proibido `dangerouslySetInnerHTML` ou `v-html` com dados não sanitizados ou de terceiros.
- [ ] **Links Seguros**: Atributos `rel="noopener noreferrer"` obrigatórios em tags `<a target="_blank">`.

---

## 5. Headers de Segurança HTTP
- [ ] **Content-Security-Policy (CSP)**: Diretiva restritiva de scripts e mídias (`default-src 'self'`).
- [ ] **Proteção contra Clickjacking**: `X-Frame-Options: DENY` ou `frame-ancestors 'none'`.
- [ ] **MIME-Type Sniffing**: `X-Content-Type-Options: nosniff`.
- [ ] **Transporte Seguro (HSTS)**: `Strict-Transport-Security: max-age=31536000; includeSubDomains`.
- [ ] **Referrer Policy & Permissions**: `Referrer-Policy: strict-origin-when-cross-origin`.

---

## 6. Autenticação & Autorização (Prevenção de IDOR/BOLA)
- [ ] **Controle de Acesso em Nível de Objeto (BOLA/IDOR)**: Toda consulta ou mutação valida explicitamente se o recurso pertence ao usuário autenticado:
  - `where: { id: resourceId, userId: currentUser.id }`
- [ ] **Validação de Sessão e JWT**: Tokens validados com algoritmo assimétrico ou assinatura forte, expiração curta (`exp`) e emissor confiável.
- [ ] **Proteção de Rotas**: Endpoints protegidos por middleware de autenticação e validação de permissões (RBAC/ABAC).

---

## 7. Dependências de Terceiros & CVEs (SCA)
- [ ] **Auditoria de Vulnerabilidades**: Execução periódica de scanners de dependências:
  - Node.js: `npm audit` ou `pnpm audit`.
  - Python: `pip-audit` ou `safety check`.
  - Rust: `cargo audit`.
- [ ] **Remediação de CVEs**: Atualização obrigatória de pacotes afetados para versões estáveis com patches de correção.
