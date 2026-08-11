return {
  {
    "folke/snacks.nvim",
    opts = {},
    keys = {
      {
        "<C-S-c>",
        function()
          -- Verifica se o lazydocker existe
          if vim.fn.executable("lazydocker") == 0 then
            vim.notify("LazyDocker não encontrado.", vim.log.levels.ERROR)
            return
          end

          -- Comando direto para o Alacritty
          -- jobstart com detach=true é o segredo para abrir janela independente
          vim.fn.jobstart({ "alacritty", "-e", "lazydocker" }, { detach = true })
        end,
        desc = "Open LazyDocker (Alacritty)",
      },
    },
  },
}
