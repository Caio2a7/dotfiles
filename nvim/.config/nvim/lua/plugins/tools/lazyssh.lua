return {
  -- Configuração para abrir LazySSH em uma JANELA EXTERNA do SO
  {
    "folke/snacks.nvim",
    opts = {},
    keys = {
      {
        "<C-S-s>",
        function()
          -- 1. Verifica se o lazyssh existe
          if vim.fn.executable("lazyssh") == 0 then
            vim.notify("LazySSH não encontrado. Instale com 'yay -S lazyssh'", vim.log.levels.ERROR)
            return
          end

          -- 2. Lista de terminais comuns e seus argumentos para executar comandos
          -- O script tentará usar o primeiro que encontrar instalado no sistema
          local terminals = {
            { cmd = "kitty", args = { "-e", "lazyssh" } },
            { cmd = "alacritty", args = { "-e", "lazyssh" } },
            { cmd = "wezterm", args = { "start", "lazyssh" } },
            { cmd = "ghostty", args = { "-e", "lazyssh" } },
            { cmd = "foot", args = { "lazyssh" } }, -- Wayland
            { cmd = "gnome-terminal", args = { "--", "lazyssh" } },
            { cmd = "konsole", args = { "-e", "lazyssh" } },
            { cmd = "xfce4-terminal", args = { "-e", "lazyssh" } },
            { cmd = "tilix", args = { "-e", "lazyssh" } },
            { cmd = "st", args = { "-e", "lazyssh" } },
            { cmd = "urxvt", args = { "-e", "lazyssh" } },
            { cmd = "xterm", args = { "-e", "lazyssh" } },
          }

          local launched = false

          -- 3. Tenta detectar e lançar o terminal
          for _, term in ipairs(terminals) do
            if vim.fn.executable(term.cmd) == 1 then
              -- detach = true garante que o Neovim não trave e a janela seja independente
              vim.fn.jobstart(vim.list_extend({ term.cmd }, term.args), { detach = true })
              vim.notify("Abrindo LazySSH no " .. term.cmd, vim.log.levels.INFO)
              launched = true
              break
            end
          end

          if not launched then
            vim.notify(
              "Nenhum emulador de terminal suportado foi encontrado para abrir janela externa.",
              vim.log.levels.WARN
            )
          end
        end,
        desc = "Open LazySSH (External Window)",
      },
    },
  },
}
