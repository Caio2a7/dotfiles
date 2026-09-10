---
name: playwright-browser
description: Web interaction, UI verification, and browser automation using Playwright CLI. Use when running E2E tests, capturing screenshots, generating test code, or verifying web pages.
---

# Playwright CLI & Web Verification Guidelines

Esta skill orienta o uso do **Playwright CLI oficial (`playwright-cli`)** para testes E2E, validação visual e automação eficiente de navegadores sem scripts ad-hoc e sem sobrecarga de MCP.

## ⚡ Regra de Ouro: Proibido Criar Scripts JS sob Demanda
O agente **NUNCA deve inventar scripts `node -e`** para navegar ou clicar.
Utilize exclusivamente os comandos atômicos oficiais da CLI do Playwright (`playwright-cli`), que executam de forma determinística e em milissegundos.

---

## 🛠️ Vocabulário Oficial do `playwright-cli`:

### 1. Navegação
```bash
# Abrir navegador com página inicial
playwright-cli open <URL>

# Navegar para uma URL específica
playwright-cli goto <URL>

# Voltar, avançar e recarregar
playwright-cli go-back
playwright-cli go-forward
playwright-cli reload
```

### 2. Interação com Elementos
```bash
# Inspecionar estrutura da página e obter IDs de referência (e1, e2, etc.)
playwright-cli snapshot

# Localizar texto na página com contexto visual imediato
playwright-cli find "<texto ou regex>"

# Clicar em um elemento por seletor, texto ou referência de snapshot
playwright-cli click "<seletor ou ref>"

# Preencher campo de texto
playwright-cli fill "<seletor ou ref>" "meu texto"

# Digitar teclas
playwright-cli type "texto a digitar"
playwright-cli press Enter
```

### 3. Conexão ao Navegador Pessoal com Extensão (Zero Flags / Zero Riscos)
Para interagir com o seu navegador pessoal (Helium/Chrome) com sessões logadas e sem flags que afetem downloads:
1. Instale a extensão oficial **Playwright Extension** no Chrome Web Store do seu navegador.
2. Execute o comando de conexão:
```bash
playwright-cli attach --extension
```

### 4. Captura Visual e Dashboards
```bash
# Captura de screenshot da página atual
playwright-cli screenshot [arquivo.png]

# Abrir o Dashboard visual / Time-Travel do Playwright
playwright-cli show
```

### 5. Execução de Suítes de Teste E2E (`npx playwright test`)
```bash
# Executa todos os testes no Chromium headless
npx playwright test --project=chromium --reporter=list

# Gravação de trace para autópsia visual em caso de falha
npx playwright test --trace on-first-retry
```

---

## 🔒 Boas Práticas:
- Use seletores acessíveis e semânticos (`text="..."`, `button[type='submit']`, `[name='...']`).
- Em testes automatizados, utilize o modo headless padrão.
- Ao finalizar automações, encerre a sessão do CLI: `playwright-cli close`.
