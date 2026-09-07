---
name: backend-engineering
description: Senior backend engineering guidelines covering OOP principles, GoF design patterns, dependency injection, Clean/Hexagonal Architecture, Java/Spring practices, and resource efficiency. Use when designing backend services, classes, domain models, or implementing enterprise business logic.
---

# Senior Backend Engineering & Object-Oriented Design

Diretrizes práticas de engenharia de software para desenvolvimento backend robusto, modular e de alto desempenho.

---

## 1. Princípios de Orientação a Objetos & Modelagem Limpa

### A. Encapsulamento & Modelo de Domínio Rico
- **Tell, Don't Ask:** Não use objetos como meras estruturas de dados passivas cheias de getters e setters (`anemic domain model`). Mova o comportamento para dentro da entidade:
  ```java
  // ❌ Anêmico / Procedural:
  if (order.getStatus().equals("PENDING") && order.getItems().size() > 0) {
      order.setStatus("PAID");
  }

  // ✅ Orientado a Objetos Rico:
  order.markAsPaid(paymentReceipt);
  ```
- **Imutabilidade com Value Objects:** Use `record` (Java) ou estruturas imutáveis para conceitos que não possuem identidade própria (ex: `Money`, `EmailAddress`, `Coordinates`, `DateRange`). Valide invariantes no construtor.

### B. Composição sobre Herança
- Evite heranças profundas (mais de 1 nível de subclasse é um anti-padrão comum).
- Favoreça interfaces pequenas e composição: injete o comportamento necessário via construtor.

---

## 2. Padrões de Projeto Essenciais (GoF Aplicado)

| Padrão | Categoria | Quando Usar |
| :--- | :--- | :--- |
| **Strategy** | Comportamental | Para substituir cadeias longas de `switch`/`if` em regras de negócio variáveis (ex: cálculo de frete, estratégias de desconto). |
| **Builder** | Criação | Para construir objetos complexos com validação de consistência e múltiplos atributos opcionais. |
| **Factory Method** | Criação | Para isolar a lógica complexa de instanciação e retornar tipos abstratos/interfaces. |
| **Adapter** | Estrutural | Para traduzir a interface de uma biblioteca externa ou API de terceiro para a interface esperada pelo seu domínio. |
| **Decorator** | Estrutural | Para adicionar responsabilidades dinâmicas (caching, logging, métricas) sem alterar a classe original. |
| **Chain of Responsibility** | Comportamental | Para pipelines de validação, filtros de segurança ou processamento sequencial de requisições. |

---

## 3. Injeção de Dependências & Arquitetura Limpa

### A. Injeção via Construtor (Constructor Injection)
- **Regra:** Sempre injete dependências via construtor com campos imutáveis (`private final`).
- **Por quê:** Garante que o objeto nunca seja instanciado em estado incompleto, facilita testes unitários sem frameworks de injeção e evita dependências ocultas.

### B. Divisão de Camadas (Clean / Hexagonal)
```text
[ Controller / Adapter HTTP ] ──► [ Use Case / Service ] ──► [ Domain Model (Entities / VOs) ]
                                          │
                                          └──► [ Repository Interface (Port) ] ◄── [ DB Implementation ]
```
- O domínio **nunca** importa bibliotecas de infraestrutura, controllers web ou anotações de serialização HTTP.

---

## 4. Boas Práticas Java & Spring Boot

- **Java Moderno:**
  - Prefira `switch` com Pattern Matching e `sealed interfaces` para representar hierarquias de estados finitos.
  - Utilize `Stream` para transformações funcionais de dados; evite streams gigantes e ilegíveis onde um laço simples for mais claro.
- **Spring Boot:**
  - Use `@Transactional(readOnly = true)` em métodos de consulta para que o ORM desative o *dirty checking*, economizando CPU e memória.
  - Trate exceções de domínio de forma centralizada (`@RestControllerAdvice`) convertendo erros em RFC 7807 (Problem Details).
  - Nunca exponha entidades de banco diretamente na API pública; utilize DTOs dedicados de entrada e saída.

---

## 5. Eficiência e Gestão de Recursos

- **Estruturas de Dados:** Escolha a coleção certa para o padrão de acesso:
  - `ArrayList` para iterações rápidas e leituras por índice.
  - `HashSet` / `HashMap` para buscas rápidas O(1) de existência e chave-valor.
  - `EnumMap` / `EnumSet` para chaves baseadas em enum (otimizados em bits na memória).
- **Evitar Desperdício em Hot Paths:**
  - Evite criar objetos temporários desnecessários dentro de loops de alta frequência.
  - Utilize StringBuilder / formatação eficiente para concatenações em lote.
  - Reutilize conexões, clientes HTTP e formatadores de data thread-safe.
