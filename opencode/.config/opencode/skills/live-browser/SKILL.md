---
name: live-browser
description: Live interaction with the user's running Helium browser via CDP. Use when the user asks to interact with their open browser ('em meu navegador', 'in my browser', 'na página que estou no meu navegador', 'preencha no browser', 'clique no meu navegador').
---

# Live Browser Interaction (Helium Browser & CDP)

Esta skill permite ao agente interagir diretamente com a aba ativa do **Helium Browser** do desenvolvedor através do Chrome DevTools Protocol (CDP na porta 9222).

## ⚠️ Regra Mandatória de Confirmação Prévia:
Sempre que o usuário solicitar uma ação em seu navegador aberto:
1. **O agente NUNCA deve executar comandos no navegador sem antes perguntar a permissão explícita do usuário.**
2. Use a ferramenta `question` (ou pergunta direta) com a ação clara:
   - *"Deseja permitir que eu interaja com a aba ativa do seu Helium Browser para [descrever ação: preencher formulário / clicar no botão X]?"*
3. **Somente após o usuário responder afirmativamente (permitir), a execução está liberada.**

---

## 🔒 Comportamento por Modo do OpenCode:
- **Modo `orchestrator` e `agentic`:** Pede a confirmação específica para interagir com o navegador aberto. Com a autorização concedida, executa com autonomia e velocidade total.
- **Modo `build`:** Solicita confirmação tanto para a ação quanto para qualquer comando bash modificador, conforme as regras do modo build.
- **Modo `plan`:** **ESTRITAMENTE SOMENTE LEITURA.** No modo plan, é permitido apenas inspecionar a página (`inspect`, ler título, URL e elementos visíveis) ou tirar capturas de tela (`screenshot`). É terminantemente proibido clicar, submeter dados ou alterar o estado da página.

---

## Comandos Disponíveis via Helper CLI (`live-browser` ou `node ~/.config/opencode/scripts/live-browser.js`):

### 1. Inspecionar a Página Aberta (Somente Leitura)
Retorna título, URL e lista de elementos interativos (com seletores resilientes):
```bash
live-browser inspect
```

### 2. Capturar Screenshot da Aba Atual
```bash
live-browser screenshot --out preview.png
```

### 3. Preencher Formulário / Input
```bash
live-browser fill --selector "#email" --value "usuario@exemplo.com"
live-browser fill --selector "[name='password']" --value "senha123"
```

### 4. Clicar em Botões ou Links
```bash
live-browser click --selector "button[type='submit']"
live-browser click --selector "text='Entrar'"
```

### 5. Executar JavaScript na Página
```bash
live-browser eval --code "document.querySelector('h1').innerText"
```

---

## Requisito de Conexão com o Helium Browser:
A flag `--remote-debugging-port=9222` já está configurada no seu sistema em `~/.config/helium-browser-flags.conf`.
Se o comando retornar `disconnected`, certifique-se de que o Helium Browser foi reiniciado após a adição da flag para abrir a porta 9222.
