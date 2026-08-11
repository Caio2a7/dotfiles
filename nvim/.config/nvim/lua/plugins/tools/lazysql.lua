return {
  {
    "folke/snacks.nvim",
    opts = {},
    keys = {
      {
        "<C-S-q>",
        function()
          -- Verifica se o lazysql existe
          if vim.fn.executable("lazysql") == 0 then
            vim.notify("LazySQL não encontrado. Instale com 'yay -S lazysql'", vim.log.levels.ERROR)
            return
          end

          -- Abre no Alacritty (janela externa independente)
          vim.fn.jobstart({ "alacritty", "-e", "lazysql" }, { detach = true })
        end,
        desc = "Open LazySQL (External)",
        mode = { "n", "i", "v" }, -- Garante que funcione em todos os modos
      },
    },
  },
}
