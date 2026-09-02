return {
  "nvim-treesitter/nvim-treesitter",
  opts = {
    ensure_installed = { "markdown", "markdown_inline", "lua", "vim", "vimdoc", "mermaid" },
    auto_install = true,
    highlight = { enable = true },
    indent = { enable = true },
  },
}
