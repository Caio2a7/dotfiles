return {
  {
    "AstroNvim/astrocore",
    opts = function()
      local map = vim.keymap.set

      vim.g.auto_save_enabled = true
      vim.api.nvim_create_autocmd({ "InsertLeave", "TextChanged" }, {
        pattern = "*",
        callback = function()
          if vim.g.auto_save_enabled and vim.bo.modified and vim.bo.buftype == "" and vim.fn.expand("%") ~= "" then
            vim.cmd("silent! update")
          end
        end,
      })

      local function toggle_auto_save()
        vim.g.auto_save_enabled = not vim.g.auto_save_enabled
        local status = vim.g.auto_save_enabled and "ON" or "OFF"
        vim.notify("Auto Save: " .. status, vim.log.levels.INFO)
      end
      map({ "n", "i", "v" }, "<M-S-a>", toggle_auto_save, { desc = "Toggle Auto Save" })
    end,
  },
}
