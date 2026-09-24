vim.o.background = "dark"

vim.api.nvim_create_autocmd("LspAttach", {
  callback = function(args)
    local client = vim.lsp.get_client_by_id(args.data.client_id)
    if client then
      client.server_capabilities.semanticTokensProvider = nil
    end
  end,
})

local colors = {
  rosa_suave = "#D986C8",
  rosa_magenta_vibrante = "#E03B8B",
  azul_tipo = "#59A6E6",
  azul_claro_var = "#9EE5FF",
  amarelo_func = "#D9D9A6",
  verde_struct = "#47D1B2",
  marrom_str = "#E69B7A",
  limao_num = "#BCE38D",
  branco_pont = "#E0E0E0",
  verde_coment = "#6BA157",
  branco_puro = "#FFFFFF",
  cyan = "#00BAE0",
  preto = "#000000",
}

local function apply_base_and_ui(hl, c)
  local none = { bg = "NONE", ctermbg = "NONE" }
  for _, grp in ipairs({
    "Normal", "NormalFloat", "NormalNC", "MsgArea", "StatusLine",
    "TabLine", "TabLineFill", "Pmenu", "SignColumn", "FoldColumn",
  }) do
    hl(grp, none)
  end

  hl("Visual", { bg = "#353b45" })
  hl("VisualNOS", { bg = "#353b45" })
  hl("ModeMsg", { fg = c.azul_tipo, bold = true })
  hl("MatchParen", { fg = c.branco_puro, bg = "#555555", bold = true })
  hl("Title", { fg = c.branco_puro, bg = "NONE", bold = true })
  hl("@markup.strikethrough", { strikethrough = false, nocombine = true })
  hl("Identifier", { fg = c.branco_puro, underline = false, nocombine = true })
  hl("@markup.quote.markdown", { fg = c.branco_puro, underline = false, nocombine = true })
end

local function apply_keywords(hl, c)
  hl("@keyword.return", { fg = c.rosa_suave, bold = true })
  hl("@keyword.repeat", { fg = c.rosa_suave, bold = true })
  hl("@keyword.directive", { fg = c.rosa_suave, bold = true })
  hl("@keyword.import", { fg = c.rosa_suave, bold = true })
  hl("@keyword.directive.define", { fg = c.rosa_suave, bold = true })
  hl("@keyword.debug", { fg = c.rosa_suave, bold = true })
  hl("Debug", { fg = c.rosa_suave, bold = true })

  hl("@keyword.conditional", { fg = c.rosa_magenta_vibrante, bold = true })
  hl("@keyword.conditional.ternary", { fg = c.rosa_magenta_vibrante, bold = true })
  hl("@keyword.exception", { fg = c.rosa_magenta_vibrante, bold = true })

  hl("@keyword", { fg = c.azul_tipo, bold = true })
  hl("@keyword.function", { fg = c.azul_tipo, bold = true })
  hl("@keyword.type", { fg = c.azul_tipo, bold = true })
  hl("@keyword.storage", { fg = c.azul_tipo, bold = true })
  hl("@keyword.coroutine", { fg = c.azul_tipo, bold = true })
end

local function apply_types_and_vars(hl, c)
  hl("@type.builtin", { fg = c.azul_tipo, bold = true })
  hl("@type.builtin.c", { fg = c.azul_tipo, bold = true })
  hl("@type", { fg = c.verde_struct, bold = true })
  hl("@type.definition", { fg = c.verde_struct, bold = true })

  hl("@function", { fg = c.amarelo_func, bold = true })
  hl("@function.call", { fg = c.amarelo_func, bold = true })
  hl("@function.builtin", { fg = c.amarelo_func, bold = true })
  hl("@function.method.call", { fg = c.amarelo_func, bold = true })

  hl("@variable", { fg = c.azul_claro_var })
  hl("@variable.member", { fg = c.azul_claro_var })
  hl("@variable.parameter", { fg = c.azul_claro_var, italic = true })
  hl("@property", { fg = c.azul_claro_var })
  hl("@field", { fg = c.azul_claro_var })
end

local function apply_literals_and_comments(hl, c)
  hl("@string", { fg = c.marrom_str })
  hl("@number", { fg = c.limao_num })
  hl("@boolean", { fg = c.limao_num })
  hl("@constant.builtin", { fg = c.limao_num })
  hl("@punctuation", { fg = c.branco_pont })
  hl("@operator", { fg = c.branco_pont })
  hl("@comment", { fg = c.verde_coment, italic = true })
  hl("@comment.error", { fg = c.rosa_magenta_vibrante, bold = true })
  hl("@comment.warning", { fg = c.amarelo_func, bold = true })
  hl("@comment.todo", { fg = c.cyan, bold = true })
  hl("@comment.note", { fg = c.azul_claro_var, bold = true })
end

local function apply_vim_syntax(hl, c)
  hl("Comment", { fg = c.verde_coment, italic = true })
  hl("String", { fg = c.marrom_str })
  hl("Character", { fg = c.marrom_str })
  hl("Number", { fg = c.limao_num })
  hl("Boolean", { fg = c.limao_num, bold = true })
  hl("Float", { fg = c.limao_num })
  hl("Function", { fg = c.amarelo_func, bold = true })
  hl("Statement", { fg = c.azul_tipo, bold = true })
  hl("Conditional", { fg = c.rosa_magenta_vibrante, bold = true })
  hl("Repeat", { fg = c.rosa_suave, bold = true })
  hl("Label", { fg = c.rosa_magenta_vibrante, bold = true })
  hl("Operator", { fg = c.branco_pont })
  hl("Keyword", { fg = c.azul_tipo, bold = true })
  hl("Exception", { fg = c.rosa_magenta_vibrante, bold = true })
  hl("PreProc", { fg = c.rosa_suave, bold = true })
  hl("Include", { fg = c.rosa_suave, bold = true })
  hl("Define", { fg = c.rosa_suave, bold = true })
  hl("Macro", { fg = c.rosa_suave, bold = true })
  hl("Type", { fg = c.verde_struct, bold = true })
  hl("StorageClass", { fg = c.azul_tipo, bold = true })
  hl("Structure", { fg = c.verde_struct, bold = true })
  hl("Typedef", { fg = c.verde_struct, bold = true })
  hl("Special", { fg = c.cyan })
  hl("Underlined", { fg = c.cyan, underline = true })
  hl("Todo", { fg = c.amarelo_func, bold = true })
  hl("ErrorMsg", { fg = c.rosa_magenta_vibrante, bold = true })
end

local function apply_txt_syntax(hl, c)
  hl("txtComment", { fg = c.verde_coment, italic = true })
  hl("txtString", { fg = c.marrom_str })
  hl("txtNumber", { fg = c.limao_num })
  hl("txtBoolean", { fg = c.limao_num, bold = true })
  hl("txtGoKeyword", { fg = c.azul_tipo, bold = true })
  hl("txtGoStorage", { fg = c.verde_struct, bold = true })
  hl("txtCond", { fg = c.rosa_magenta_vibrante, bold = true })
  hl("txtRepeat", { fg = c.rosa_suave, bold = true })
  hl("txtReturn", { fg = c.rosa_suave, bold = true })
  hl("txtOperator", { fg = c.branco_pont })
  hl("txtFunction", { fg = c.amarelo_func, bold = true })
  hl("txtShell", { fg = c.rosa_suave, bold = true })
  hl("txtEnvVar", { fg = c.azul_claro_var, bold = true })
  hl("txtShellVar", { fg = c.azul_claro_var })
  hl("txtFlag", { fg = c.cyan })
  hl("txtJavaKeyword", { fg = c.azul_tipo, bold = true })
  hl("txtCKeyword", { fg = c.azul_tipo, bold = true })
  hl("txtAnnotation", { fg = c.rosa_suave, bold = true })
  hl("txtPreProc", { fg = c.rosa_suave, bold = true })
  hl("txtType", { fg = c.verde_struct, bold = true })
  hl("txtTypeParen", { fg = c.verde_struct, bold = true })
  hl("txtTypeBuiltin", { fg = c.azul_tipo, bold = true })
  hl("txtUrl", { fg = c.cyan, underline = true })
  hl("txtBug", { fg = c.rosa_magenta_vibrante, bold = true })
  hl("txtTodo", { fg = c.amarelo_func, bold = true })
end

local function apply_snacks(hl, c)
  for _, grp in ipairs({
    "SnacksNormal", "SnacksBackdrop", "SnacksPicker", "SnacksPickerList", "SnacksPickerInput",
  }) do
    hl(grp, { bg = "NONE" })
  end
  hl("SnacksPickerBorder", { fg = c.azul_tipo, bg = "NONE" })
  hl("SnacksPickerSelected", { bg = "#333333", fg = c.rosa_magenta_vibrante, bold = true })
  hl("SnacksPickerMatch", { fg = c.amarelo_func, bold = true })
  hl("SnacksPickerLabel", { fg = c.azul_tipo, bold = true })
  hl("SnacksPickerDir", { fg = c.verde_coment })
  hl("SnacksPickerPrompt", { fg = c.rosa_suave, bold = true })

  hl("SnacksExplorerDir", { fg = c.azul_tipo, bold = true })
  hl("SnacksExplorerFile", { fg = c.azul_claro_var })
  hl("SnacksExplorerIcon", { fg = c.amarelo_func })
  hl("SnacksExplorerSelected", { bg = "#333333", fg = c.rosa_magenta_vibrante, bold = true })
end

vim.api.nvim_create_autocmd("ColorScheme", {
  pattern = "*",
  callback = function()
    local hl = function(group, opts)
      opts.force = true
      vim.api.nvim_set_hl(0, group, opts)
    end

    apply_base_and_ui(hl, colors)
    apply_keywords(hl, colors)
    apply_types_and_vars(hl, colors)
    apply_literals_and_comments(hl, colors)
    apply_vim_syntax(hl, colors)
    apply_txt_syntax(hl, colors)
    apply_snacks(hl, colors)
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
