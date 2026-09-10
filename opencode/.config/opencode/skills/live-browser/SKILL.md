---
name: live-browser
description: Live interaction with the user's running Helium browser via CDP. Use when the user asks to interact with their open browser ('em meu navegador', 'in my browser', 'na página que estou no meu navegador', 'preencha no browser', 'clique no meu navegador', 'pesquise no meu browser').
---

# Live Browser Interaction (Helium Browser & CDP)

Comandos CLI atômicos e instantâneos (< 200ms) para operar a aba ativa do **Helium Browser** do desenvolvedor via Chrome DevTools Protocol na porta 9222.

## ⚠️ Regra Mandatória de Confirmação Prévia:
- Quando o usuário solicitar uma ação em seu navegador aberto, o agente **deve perguntar autorização primeiro** caso ainda não tenha autorização na sessão.
- Uma vez autorizado, o agente **deve executar comandos CLI diretos via `live-browser`** (NUNCA escreva scripts Node improvisados).

---

## ⚡ Comandos CLI Atômicos (Executam em < 200ms):

### 1. Pesquisar e Abrir Nova Aba no Navegador
Abre imediatamente uma nova aba pesquisando no Google e trazendo-a para o primeiro plano:
```bash
live-browser search "termo de pesquisa"
```

### 2. Clicar em Links ou Botões por Texto ou Seletor
Localiza o elemento clicável pelo texto ou seletor e clica instantaneamente:
```bash
live-browser click "Wikipedia"
live-browser click "button[type='submit']"
```

### 3. Pesquisar e Rolar até uma Palavra na Página (`find`)
Busca a palavra no DOM, rola a página suavemente até o elemento e destaca o trecho em amarelo com borda vermelha para o usuário:
```bash
live-browser find "Bismarck"
```

### 4. Navegar Diretamente para uma URL
```bash
live-browser goto "https://pt.wikipedia.org"
```

### 5. Inspecionar a Página Atual (Somente Leitura)
Retorna título, URL, cabeçalhos H1, inputs e links de amostra da aba ativa:
```bash
live-browser inspect
```

### 6. Capturar Screenshot da Aba Ativa
```bash
live-browser screenshot preview.png
```

---

## 🔒 Regras por Modo:
- **`orchestrator` e `agentic`:** Autorizados a navegar, pesquisar, clicar e rolar.
- **`build`:** Solicita confirmação de comandos de modificação de sistema conforme padrão.
- **`plan`:** **SOMENTE LEITURA.** Permitido apenas `inspect`, `find` e `screenshot`. Proibido `click` ou navegações que alterem o estado da página.
