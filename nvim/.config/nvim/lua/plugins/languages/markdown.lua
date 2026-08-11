return {
  "MeanderingProgrammer/render-markdown.nvim",
  opts = {
    heading = {
      enabled = true,
      sign = true,
      icons = { "󰲡 ", "󰲣 ", "󰲥 ", "󰲧 ", "󰲩 ", "󰲫 " },
      background = { enabled = true },
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
      checked = { icon = "󰱒 ", highlight = "RenderMarkdownDone" },
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

    local function force_colors()
      local h_style = { fg = "#FFFFFF", bg = "#000000", bold = true, underline = false, nocombine = true }
      for i = 1, 6 do
        vim.api.nvim_set_hl(0, "RenderMarkdownH" .. i, h_style)
        vim.api.nvim_set_hl(0, "RenderMarkdownH" .. i .. "Bg", {  fg = "#FFFFFF", bg = "#000000", underline = false, nocombine = true })
      end

      local cb_text = { fg = "#ffffff", bg = "NONE", underline = false, strikethrough = false, bold = false, nocombine = true }
      vim.api.nvim_set_hl(0, "RenderMarkdownTodo", cb_text)
      vim.api.nvim_set_hl(0, "RenderMarkdownDone", cb_text)
      vim.api.nvim_set_hl(0, "@markup.list.checked.markdown",   cb_text)
      vim.api.nvim_set_hl(0, "@markup.list.unchecked.markdown", cb_text)
      vim.api.nvim_set_hl(0, "@markup.strikethrough", { strikethrough = false, nocombine = true })

      vim.api.nvim_set_hl(0, "RenderMarkdownError",   { fg = "#ff5555", bg = "#1a0a0a", bold = true, nocombine = true })
      vim.api.nvim_set_hl(0, "RenderMarkdownWarn",    { fg = "#ffb86c", bg = "#1a1a0a", bold = true, nocombine = true })
      vim.api.nvim_set_hl(0, "RenderMarkdownSuccess", { fg = "#50fa7b", bg = "#0a1a0a", bold = true, nocombine = true })
      vim.api.nvim_set_hl(0, "RenderMarkdownTip",     { fg = "#5936A2", bg = "#0a1a0a", bold = true, nocombine = true })
      vim.api.nvim_set_hl(0, "RenderMarkdownCaution", { fg = "#A42E05", bg = "#0a1a0a", bold = true, nocombine = true })
      vim.api.nvim_set_hl(0, "RenderMarkdownInfo",    { fg = "#8be9fd", bg = "#0a0a1a", bold = true, nocombine = true })
    end

    vim.schedule(force_colors)

    vim.api.nvim_create_autocmd({ "ColorScheme", "BufWinEnter", "BufEnter", "FileType" }, {
      pattern = { "*.md", "markdown" },
      callback = function()
        vim.schedule(force_colors)
      end,
    })
  end,
}
