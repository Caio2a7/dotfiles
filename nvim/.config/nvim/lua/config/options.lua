vim.opt.relativenumber = false
vim.opt.spell = false
vim.o.background = "light"
vim.opt.timeoutlen = 300
vim.opt.ttimeoutlen = 0

vim.g.loaded_netrw = 1
vim.g.loaded_netrwPlugin = 1

vim.diagnostic.config({
  virtual_text = false,
  signs = true,
  underline = true,
  update_in_insert = false,
})
vim.api.nvim_create_autocmd("FileType", {
  pattern = { "markdown" },
  callback = function()
    vim.opt_local.spell = false
  end,
})
