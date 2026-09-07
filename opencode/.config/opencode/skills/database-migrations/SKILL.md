---
name: database-migrations
description: Advanced database schema design, zero-downtime migrations (Expand-and-Contract), index engineering, and transaction concurrency. Use when altering models, writing SQL migrations, designing tables, or optimizing query performance ('banco de dados', 'migração', 'modelagem de dados', 'expand and contract', 'zero downtime').
---

# Advanced Database Architecture, Schema Evolution & Concurrency

Este guia consolida as melhores práticas da engenharia de banco de dados para evolução de esquemas sem downtime (Zero-Downtime Schema Evolution), modelagem relacional rigorosa e controle de concorrência.

---

## 1. O Padrão Expand-and-Contract (Parallel Change) para Migrações Zero-Downtime
*(Baseado nos papers de Tim Wellhausen e Martin Fowler)*

Nunca execute alterações destrutivas ou renomeações diretas em produção. Divida qualquer alteração de esquema em 3 fases compatíveis com versões anteriores (*backward-compatible*):

```text
[ Fase 1: EXPAND ]        [ Fase 2: MIGRATE & TRANSITION ]       [ Fase 3: CONTRACT ]
 Adiciona nova estrutura      Dual-Writes na aplicação              Remove legado
 (nova coluna / tabela)       Backfill de dados em background       (DROP seguro sem locks)
 Aplicação V1 continua        Aplicação V2 lê do novo
 funcionando 100%             e escreve em ambos
```

### Protocolo Passo a Passo:
1. **Fase 1 (Expand - Banco):**
   - Adicione a nova coluna como `NULLABLE` ou com `DEFAULT` constante.
   - *Nunca adicione `NOT NULL` sem default em tabelas grandes (causa rewrite completo e table lock).*
   - Crie novos índices sempre com `CONCURRENTLY` (PostgreSQL):
     ```sql
     CREATE INDEX CONCURRENTLY idx_users_email_verified ON users (email) WHERE verified = true;
     ```
2. **Fase 2 (Migrate / Dual-Writes - Aplicação):**
   - Atualize a aplicação para escrever na coluna antiga E na nova coluna simultaneamente (*dual-writes*).
   - Execute um script de **Backfill em lote** (*chunked batch update*) para migrar registros antigos sem travar a replicação:
     ```sql
     -- Exemplo de backfill em lotes de 1.000 registros:
     UPDATE users SET new_column = old_column WHERE id BETWEEN 1 AND 1000 AND new_column IS NULL;
     ```
   - Alterne a leitura da aplicação para a nova coluna.
3. **Fase 3 (Contract - Limpeza):**
   - Remova o código que escrevia na coluna antiga.
   - Execute o `DROP COLUMN` ou descarte a tabela legada com segurança.

---

## 2. DDL Seguro & Gestão de Locks
Comandos DDL (`ALTER TABLE`, `ADD CONSTRAINT`) adquirem lock exclusivo (`ACCESS EXCLUSIVE`). Em tabelas de alta carga, isso enfileira transações e derruba a aplicação.
- **Configure Timeouts de DDL Obrigatoriamente:**
  ```sql
  SET lock_timeout = '2s';
  SET statement_timeout = '10s';
  ALTER TABLE orders ADD COLUMN status_v2 VARCHAR(50);
  ```
- **Foreign Keys Seguras (PostgreSQL):**
  Adicione sem validação inicial para evitar lock longo e valide em seguida:
  ```sql
  ALTER TABLE orders ADD CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id) NOT VALID;
  ALTER TABLE orders VALIDATE CONSTRAINT fk_orders_user;
  ```

---

## 3. Engenharia de Índices & Planos de Execução
- **B-Tree (Padrão):** Ótimo para igualdade (`=`) e intervalos (`<`, `>`, `BETWEEN`, `ORDER BY`). Colunas de alta cardinalidade primeiro em índices compostos.
- **GIN (Generalized Inverted Index):** Obrigatório para colunas `JSONB`, arrays e busca textual full-text (`tsvector`).
- **BRIN (Block Range Index):** Ideal para tabelas massivas append-only (logs, métricas, séries temporais) ordenadas por timestamp. Ocupa 1% do espaço de um B-Tree.
- **Índices Parciais (Partial Indexes):** Indexe apenas subconjuntos relevantes para economizar RAM e escrita:
  ```sql
  CREATE INDEX idx_orders_unprocessed ON orders (created_at) WHERE status = 'PENDING';
  ```
- **Covering Index (`INCLUDE`):** Permite *Index-Only Scan*, evitando ir ao heap da tabela:
  ```sql
  CREATE INDEX idx_users_email_include_name ON users (email) INCLUDE (full_name);
  ```

---

## 4. Concorrência, Isolamento e Bloqueios
- **Níveis de Isolamento ANSI SQL / MVCC:**
  - `Read Committed`: Padrão. Vê apenas dados commitados. Sujeito a leituras não-repetíveis.
  - `Repeatable Read`: Snapshot isolation. Garante leitura idêntica durante toda a transação. Detecta conflitos de serialização.
  - `Serializable`: Isolamento matemático estrito. Previne *Write Skew* e leituras fantasmas.
- **Bloqueio Otimista vs. Pessimista:**
  - **Otimista (Alta escalabilidade web):** Adicione coluna `version INT DEFAULT 1`. No update:
    ```sql
    UPDATE accounts SET balance = balance - 100, version = version + 1 WHERE id = 42 AND version = 1;
    -- Se afetar 0 linhas, outra transação alterou antes -> disparar retry.
    ```
  - **Pessimista (Operações críticas de baixa concorrência):**
    ```sql
    SELECT * FROM inventory WHERE product_id = 10 FOR UPDATE;
    ```
- **Prevenção de Deadlocks:** Sempre adquira locks em recursos múltiplos na mesma ordem determinística (ex: ordenar IDs antes de travar linhas).

---

## 5. Padrão Transacional de Alto Nível: Transactional Outbox Pattern
Em arquiteturas de microsserviços ou sistemas distribuídos, nunca envie eventos para mensageria (Kafka, RabbitMQ) diretamente após o commit:
- Salve a entidade de negócio E o evento na tabela `outbox` **na mesma transação atômica local**.
- Um worker em background (ou Debezium via CDC) lê da tabela `outbox` e publica no broker com garantia de *at-least-once delivery*.
