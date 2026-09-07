---
name: api-design
description: API design best practices for REST, tRPC, and GraphQL. Use when creating endpoints, defining Zod schemas, data contracts, or handling HTTP responses.
---

# API Design & Contract Standards

Diretrizes para arquitetura de APIs robustas, tipadas e escaláveis.

## 1. Validação de Schemas (Zod / Typebox)
- Valide todas as entradas no limite da aplicação (*API boundary*) antes de qualquer lógica de negócio.
- Utilize validação estrita com Zod (`z.object({ ... }).strict()`) para rejeitar propriedades inesperadas.
- Mensagens de erro devem ser claras, indicando exatamente o campo e a regra violada.

## 2. Padrões RESTful
- **Recursos Plurais:** `/api/v1/users`, `/api/v1/orders/{id}/items`.
- **Verbos Corretos:**
  - `GET`: Somente leitura, idempotente, seguro.
  - `POST`: Criação de recursos, processamento não-idempotente.
  - `PUT`: Substituição completa do recurso (idempotente).
  - `PATCH`: Atualização parcial de campos específicos.
  - `DELETE`: Remoção de recurso (idempotente).
- **Status Codes Apropriados:**
  - `200 OK`, `201 Created`, `204 No Content`.
  - `400 Bad Request` (validação), `401 Unauthorized` (sem auth), `403 Forbidden` (sem permissão), `404 Not Found`.
  - `409 Conflict` (duplicação de chave), `422 Unprocessable Entity`.
  - `500 Internal Server Error` (nunca vaze stack trace ao cliente).

## 3. Padrões tRPC
- Separe routers por domínio (`routers/auth.ts`, `routers/projects.ts`).
- Use procedures protegidas com middlewares de autenticação/autorização reutilizáveis.
- Retorne apenas os dados estritamente necessários para o cliente (evite expor modelos de banco completos com colunas sensíveis).
