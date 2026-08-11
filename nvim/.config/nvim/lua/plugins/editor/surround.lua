return {
  {
    "nvim-mini/mini.surround",
    version = "*",
    lazy = false,
    config = function()
      require("mini.surround").setup({
        mappings = {
          add = "gz",            -- Adicionar surround (gziw" -> "palavra")
          delete = "ds",         -- Deletar surround   (ds"   -> palavra) [ORIGINAL]
          replace = "cs",        -- Substituir surround (cs"'  -> 'palavra') [ORIGINAL]
          find = "sf",           -- Encontrar surround à direita
          find_left = "sF",      -- Encontrar surround à esquerda
          highlight = "sh",      -- Destacar surround
          update_n_lines = "sn", -- Atualizar número de linhas
        },
      })
    end,
  },
}
