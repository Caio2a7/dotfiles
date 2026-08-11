return {
  {
    "folke/snacks.nvim",
    keys = {
      {
        "<C-g>",
        function()
          if vim.fn.executable("lazygit") == 0 then
            vim.notify("ERRO: O programa 'lazygit' não está instalado no sistema!", vim.log.levels.ERROR)
            return
          end

          Snacks.lazygit() 
        end,
        desc = "Lazygit",
        mode = { "n", "i", "v" },
      },
    },
  },
}
