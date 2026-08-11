vim.api.nvim_create_autocmd("VimEnter", {
  callback = function()
    if vim.fn.argc() == 0 and vim.api.nvim_buf_get_name(0) == "" then
      local current_buf = vim.api.nvim_get_current_buf()
      require("oil").open()
      vim.schedule(function()
        if vim.api.nvim_buf_is_valid(current_buf) then
          vim.api.nvim_buf_delete(current_buf, { force = true })
        end
      end)
    end
  end,
})

vim.api.nvim_create_autocmd("FileType", {
  pattern = { "markdown" },
  callback = function()
    vim.opt_local.spell = false
  end,
})
