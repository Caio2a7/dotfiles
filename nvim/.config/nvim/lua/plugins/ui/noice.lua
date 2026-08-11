return {
  "folke/noice.nvim",
  opts = {
    cmdline = {
      view = "cmdline_acima",
      format = {
        cmdline = { icon = ">", lang = "" }, -- lang vazia desativa o treesitter no comando
      },
    },
    views = {
      cmdline_acima = {
        backend = "popup",
        relative = "editor",
        position = {
          row = -1,
          col = 0,
        },
        size = {
          width = "100%",
          height = "auto",
        },
        border = {
          style = "none",
          padding = { 0, 2 },
        },
        win_options = {
          winhighlight = "Normal:Normal",
        },
      },
    },
  },
}
