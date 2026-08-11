vim.o.background = "dark"

vim.api.nvim_create_autocmd("LspAttach", {
  callback = function(args)
    local client = vim.lsp.get_client_by_id(args.data.client_id)
    if client then
      client.server_capabilities.semanticTokensProvider = nil
    end
  end,
})

vim.api.nvim_create_autocmd("ColorScheme", {
  pattern = "*",
  callback = function()
    local hl = function(group, opts)
      opts.force = true
      vim.api.nvim_set_hl(0, group, opts)
    end

    hl("Normal", { bg = "NONE", ctermbg = "NONE" })
    hl("NormalFloat", { bg = "NONE", ctermbg = "NONE" })
    hl("NormalNC", { bg = "NONE", ctermbg = "NONE" })
    hl("MsgArea", { bg = "NONE", ctermbg = "NONE" })
    hl("StatusLine", { bg = "NONE", ctermbg = "NONE" })
    hl("TabLine", { bg = "NONE", ctermbg = "NONE" })
    hl("TabLineFill", { bg = "NONE", ctermbg = "NONE" })
    hl("Pmenu", { bg = "NONE", ctermbg = "NONE" })
    hl("SignColumn", { bg = "NONE", ctermbg = "NONE" })
    hl("FoldColumn", { bg = "NONE", ctermbg = "NONE" })

    local rosa_suave = "#D986C8"
    local rosa_magenta_vibrante = "#E03B8B"
    local azul_tipo = "#59A6E6"
    local azul_claro_var = "#9EE5FF"
    local amarelo_func = "#D9D9A6"
    local verde_struct = "#47D1B2"
    local marrom_str = "#E69B7A"
    local limao_num = "#BCE38D"
    local branco_pont = "#E0E0E0"
    local verde_coment = "#6BA157"
    local branco_puro = "#FFFFFF"
    local cyan = "#00BAE0"
    local preto = "#000000"

    hl("@keyword.return", { fg = rosa_suave, bold = true })
    hl("@keyword.repeat", { fg = rosa_suave, bold = true })
    hl("@keyword.directive", { fg = rosa_suave, bold = true })
    hl("@keyword.import", { fg = rosa_suave, bold = true })
    hl("@keyword.directive.define", { fg = rosa_suave, bold = true })
    hl("@keyword.debug", { fg = rosa_suave, bold = true })
    hl("Debug", { fg = rosa_suave, bold = true })

    hl("@keyword.conditional", { fg = rosa_magenta_vibrante, bold = true })
    hl("@keyword.conditional.ternary", { fg = rosa_magenta_vibrante, bold = true })
    hl("@keyword.exception", { fg = rosa_magenta_vibrante, bold = true })
    hl("Conditional", { fg = rosa_magenta_vibrante, bold = true })
    hl("Label", { fg = rosa_magenta_vibrante, bold = true })

    hl("@keyword", { fg = azul_tipo, bold = true })
    hl("@keyword.function", { fg = azul_tipo, bold = true })
    hl("@keyword.storage", { fg = azul_tipo, bold = true })
    hl("@type.builtin", { fg = azul_tipo, bold = true })
    hl("@type.builtin.c", { fg = azul_tipo, bold = true })
    hl("Type", { fg = azul_tipo, bold = true })

    hl("@function", { fg = amarelo_func, bold = true })
    hl("@function.call", { fg = amarelo_func, bold = true })
    hl("@function.builtin", { fg = amarelo_func, bold = true })

    hl("@type", { fg = verde_struct, bold = true })

    hl("@variable", { fg = azul_claro_var })
    hl("@variable.member", { fg = azul_claro_var })
    hl("@variable.parameter", { fg = azul_claro_var, italic = true })
    hl("@property", { fg = azul_claro_var })
    hl("@field", { fg = azul_claro_var })

    hl("@string", { fg = marrom_str })
    hl("@number", { fg = limao_num })
    hl("@boolean", { fg = limao_num })
    hl("@punctuation", { fg = branco_pont })
    hl("@operator", { fg = branco_pont })
    hl("@comment", { fg = verde_coment, italic = true })

    hl("MatchParen", { fg = branco_puro, bg = "#555555", bold = true })
    hl("Title", { fg = branco_puro, bg = "NONE", bold = true })

    local h_full = { fg = preto, bg = cyan, bold = true, underline = false, nocombine = true }
    hl("@markup.heading.markdown", h_full)
    for i = 1, 6 do
      hl("@markup.heading." .. i .. ".markdown", h_full)
      hl("RenderMarkdownH" .. i, h_full)
      hl("RenderMarkdownH" .. i .. "Bg", { bg = cyan, underline = false, nocombine = true })
    end

    local markdown_text = { fg = branco_puro, bg = "NONE", underline = false, strikethrough = false, nocombine = true }
    hl("RenderMarkdownTodo", markdown_text)
    hl("RenderMarkdownDone", markdown_text)
    hl("@markup.list.unchecked.markdown", markdown_text)
    hl("@markup.list.checked.markdown", markdown_text)
    hl("@markup.strikethrough", { strikethrough = false, nocombine = true })

    -- FIX: @markup.quote.markdown linkava para Identifier que tem underline no aether
    hl("Identifier",             { fg = branco_puro, underline = false, nocombine = true })
    hl("@markup.quote.markdown", { fg = branco_puro, underline = false, nocombine = true })

    hl("SnacksNormal", { bg = "NONE" })
    hl("SnacksBackdrop", { bg = "NONE" })
    hl("SnacksPicker", { bg = "NONE" })
    hl("SnacksPickerBorder", { fg = azul_tipo, bg = "NONE" })
    hl("SnacksPickerList", { bg = "NONE" })
    hl("SnacksPickerInput", { bg = "NONE" })
    hl("SnacksPickerSelected", { bg = "#333333", fg = rosa_magenta_vibrante, bold = true })
    hl("SnacksPickerMatch", { fg = amarelo_func, bold = true })
    hl("SnacksPickerLabel", { fg = azul_tipo, bold = true })
    hl("SnacksPickerDir", { fg = verde_coment })
    hl("SnacksPickerPrompt", { fg = rosa_suave, bold = true })

    hl("SnacksExplorerDir", { fg = azul_tipo, bold = true })
    hl("SnacksExplorerFile", { fg = azul_claro_var })
    hl("SnacksExplorerIcon", { fg = amarelo_func })
    hl("SnacksExplorerSelected", { bg = "#333333", fg = rosa_magenta_vibrante, bold = true })
  end,
})

return {
  {
    "RedsXDD/neopywal.nvim",
    name = "neopywal",
    lazy = false,
    priority = 1000,
    opts = {
      transparent_background = true,
      default_plugins = true,
      default_fileformats = true,
    },
  },
  {
    "LazyVim/LazyVim",
    opts = { colorscheme = "neopywal" },
  },
}
