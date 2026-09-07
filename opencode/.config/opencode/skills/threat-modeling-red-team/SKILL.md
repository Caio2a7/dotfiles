---
name: threat-modeling-red-team
description: Threat modeling, attack surface mapping, logic flaw discovery, and vulnerability assessment. Use when assessing security risks, analyzing attack vectors, evaluating access controls, or conducting security design reviews ('red team', 'modelagem de ameaças', 'ache brechas', 'ataque potencial', 'stride').
---

# Threat Modeling & Security Assessment (Red Team Methodology)

Guia para identificação rigorosa de superfícies de ataque, falhas de autorização e fraquezas estruturais baseado em STRIDE e OWASP WSTG.

## 1. Mapeamento de Superfície de Ataque
Para auditar uma aplicação ou módulo:
1. **Identificar Entrypoints:**
   - Rotas HTTP/REST/GraphQL/tRPC.
   - Parâmetros recebidos (body, headers, cookies, query params).
   - Filas de mensagens (RabbitMQ, Kafka, SQS) consumindo dados externos.
2. **Identificar Recursos Críticos (Assets):**
   - Dados de usuários (PII, senhas, tokens).
   - Permissões administrativas.
   - Transações financeiras e operações sensíveis.

## 2. Decomposição com o Framework STRIDE:
Para cada fluxo de dados que cruza uma fronteira de confiança:
- **Spoofing (Falsificação):** Um invasor pode se passar por outro usuário sem possuir as credenciais? O token pode ser forjado?
- **Tampering (Adulteração):** O payload da requisição pode ser alterado para modificar preços, IDs ou roles (`isAdmin: true`)?
- **Repudiation (Repúdio):** O sistema registra quem executou alterações críticas para que a ação não possa ser negada?
- **Information Disclosure (Vazamento):** Endpoints retornam objetos inteiros do banco com colunas sensíveis (`password_hash`, `api_key`)? Erros vazam stack traces?
- **Denial of Service (DoS):** Existem operações que processam listas sem limite de tamanho ou expressões regulares vulneráveis a ReDoS?
- **Elevation of Privilege (Privilégios):** Um usuário comum consegue disparar uma mutation administrativa alterando a URL ou o body (BFLA/IDOR)?

## 3. Classificação de Severidade (CVSS Qualitativo):
- 🔴 **Crítico (CVSS 9.0 - 10.0):** Execução remota de código, injeção de SQL sem autenticação, vazamento irrestrito de banco de dados, bypass total de autenticação.
- 🟠 **Alto (CVSS 7.0 - 8.9):** IDOR/BOLA expondo dados de outros clientes, quebra de autorização administrativa (BFLA), SSRF interno.
- 🟡 **Médio (CVSS 4.0 - 6.9):** XSS armazenado sob certas condições, CSRF em ações secundárias, vazamento de informações do servidor.
- 🟢 **Baixo / Informativo (CVSS 0.1 - 3.9):** Ausência de headers defensivos, mensagens de erro verbosas sem dados sensíveis.
