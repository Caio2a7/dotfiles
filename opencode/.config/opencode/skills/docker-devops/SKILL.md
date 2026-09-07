---
name: docker-devops
description: Containerization, multi-stage Dockerfiles, Docker Compose, and CI/CD automation. Use when creating containers, configuring compose files, or debugging build pipelines.
---

# Docker & DevOps Engineering Guidelines

Padrões de engenharia para empacotamento em containers e automação de pipelines CI/CD.

## 1. Multi-Stage Dockerfiles Otimizados
- **Separação de Estágios:**
  - Estágio 1 (`deps`): Instalação de dependências e caches.
  - Estágio 2 (`builder`): Compilação de assets, TypeScript para JavaScript, binários.
  - Estágio 3 (`runner`): Imagem final mínima (Alpine ou Distroless) contendo apenas o binário compilado e dependências de produção.
- **Otimização de Cache:**
  - Copie arquivos de manifesto (`package.json`, `pnpm-lock.yaml`, `Cargo.toml`, `requirements.txt`) e instale dependências ANTES de copiar o restante do código-fonte.
- **Segurança:**
  - Nunca execute o container como `root`. Crie e use um usuário sem privilégios (`USER node` ou `USER nonroot`).
  - Nunca inclua `.env`, arquivos de chave privada ou secrets na imagem (adicione sempre ao `.dockerignore`).

## 2. Docker Compose para Desenvolvimento Local
- Mantenha serviços de apoio (PostgreSQL, Redis, RabbitMQ) em `docker-compose.yml` com persistência em volumes nomeados.
- Configure `healthcheck` em serviços dependentes para evitar que a aplicação inicie antes do banco estar pronto.

## 3. Pipelines de CI/CD
- Testes e linters devem rodar em paralelo no estágio de validação da PR.
- Falhas de lint ou teste devem interromper a pipeline imediatamente (*fail fast*).
