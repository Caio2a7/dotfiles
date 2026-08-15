return {
  "MeanderingProgrammer/render-markdown.nvim",
  ft = { "markdown", "norg", "rmd", "org" },
  dependencies = { "nvim-treesitter/nvim-treesitter", "nvim-tree/nvim-web-devicons" },
  opts = {
    render_modes = { "n", "c", "t" },
    anti_conceal = { enabled = false },
    heading = {
      enabled = true,
      sign = true,
      icons = { "󰲡 ", "󰲣 ", "󰲥 ", "󰲧 ", "󰲩 ", "󰲫 " },
      backgrounds = {
        "RenderMarkdownH1Bg",
        "RenderMarkdownH2Bg",
        "RenderMarkdownH3Bg",
        "RenderMarkdownH4Bg",
        "RenderMarkdownH5Bg",
        "RenderMarkdownH6Bg",
      },
    },
    code = {
      enabled = true,
      sign = true,
      style = "full",
      position = "left",
      width = "block",
      left_pad = 2,
      right_pad = 2,
    },
    dash = {
      enabled = true,
      icon = "─",
      width = "full",
    },
    bullet = {
      enabled = true,
      icons = { "●", "○", "◆", "◇" },
    },
    checkbox = {
      enabled = true,
      unchecked = { icon = "󰄱 ", highlight = "RenderMarkdownTodo" },
      checked   = { icon = "󰱒 ", highlight = "RenderMarkdownDone" },
    },
    link = {
      enabled = false,
    },
    quote = {
      enabled = true,
      icon = "▋",
    },
    callout = {
      note      = { raw = "[!NOTE]",      rendered = "󰋽 Note",      highlight = "RenderMarkdownInfo" },
      tip       = { raw = "[!TIP]",       rendered = "󰌶 Tip",       highlight = "RenderMarkdownTip" },
      important = { raw = "[!IMPORTANT]", rendered = "󰅾 Important", highlight = "RenderMarkdownWarn" },
      warning   = { raw = "[!WARNING]",   rendered = "󰀪 Warning",   highlight = "RenderMarkdownError" },
      caution   = { raw = "[!CAUTION]",   rendered = "󰳦 Caution",   highlight = "RenderMarkdownCaution" },
      done      = { raw = "[!DONE]",      rendered = "󰄬 Done",      highlight = "RenderMarkdownSuccess" },
      success   = { raw = "[!SUCCESS]",   rendered = "󰗠 Success",   highlight = "RenderMarkdownSuccess" },
    },
  },
  config = function(_, opts)
    require("render-markdown").setup(opts)

    local function setup_markdown_buf()
      vim.opt_local.conceallevel = 2
      vim.opt_local.concealcursor = "nc"
    end

    local function force_colors()
      local h_style = { fg = "#FFFFFF", bg = "#000000", bold = true, underline = false, nocombine = true }
      for i = 1, 6 do
        vim.api.nvim_set_hl(0, "RenderMarkdownH" .. i, h_style)
        vim.api.nvim_set_hl(0, "RenderMarkdownH" .. i .. "Bg", { fg = "#FFFFFF", bg = "#000000", underline = false, nocombine = true })
      end
      vim.api.nvim_set_hl(0, "RenderMarkdownTodo", { fg = "#888888", bg = "NONE", bold = false, strikethrough = false, nocombine = true, force = true })
      vim.api.nvim_set_hl(0, "RenderMarkdownDone", { fg = "#50fa7b", bg = "NONE", bold = false, strikethrough = false, nocombine = true, force = true })
      vim.api.nvim_set_hl(0, "@markup.list.checked.markdown",   { fg = "#50fa7b", bg = "NONE", strikethrough = false, nocombine = true, force = true })
      vim.api.nvim_set_hl(0, "@markup.list.unchecked.markdown", { fg = "#888888", bg = "NONE", nocombine = true, force = true })
      vim.api.nvim_set_hl(0, "@markup.strikethrough",           { strikethrough = false, nocombine = true, force = true })
      vim.api.nvim_set_hl(0, "RenderMarkdownError",   { fg = "#ff5555", bg = "#1a0a0a", bold = true, nocombine = true, force = true })
      vim.api.nvim_set_hl(0, "RenderMarkdownWarn",    { fg = "#ffb86c", bg = "#1a1a0a", bold = true, nocombine = true, force = true })
      vim.api.nvim_set_hl(0, "RenderMarkdownSuccess", { fg = "#50fa7b", bg = "#0a1a0a", bold = true, nocombine = true, force = true })
      vim.api.nvim_set_hl(0, "RenderMarkdownTip",     { fg = "#5936A2", bg = "#0a1a0a", bold = true, nocombine = true, force = true })
      vim.api.nvim_set_hl(0, "RenderMarkdownCaution", { fg = "#A42E05", bg = "#0a1a0a", bold = true, nocombine = true, force = true })
      vim.api.nvim_set_hl(0, "RenderMarkdownInfo",    { fg = "#8be9fd", bg = "#0a0a1a", bold = true, nocombine = true, force = true })
    end

    local group = vim.api.nvim_create_augroup("RenderMarkdownSetup", { clear = true })
    vim.api.nvim_create_autocmd({ "FileType", "BufEnter", "BufWinEnter" }, {
      group = group,
      pattern = { "markdown", "rmd" },
      callback = function()
        setup_markdown_buf()
        vim.schedule(force_colors)
      end,
    })

    setup_markdown_buf()
    vim.schedule(force_colors)
  end,
}
