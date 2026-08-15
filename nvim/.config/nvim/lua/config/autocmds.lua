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

-- Controle de Inlay Hints (parâmetros de função/texto fantasma)
-- Desativado no modo Insert, visível apenas no modo Normal com delay ao sair do Insert
local inlay_hint_timer = nil
local INLAY_DELAY_MS = 500

local function set_inlay_hints(enable)
  if vim.lsp.inlay_hint then
    pcall(vim.lsp.inlay_hint.enable, enable)
  end
end

local inlay_group = vim.api.nvim_create_augroup("InlayHintsModeControl", { clear = true })

vim.api.nvim_create_autocmd("InsertEnter", {
  group = inlay_group,
  callback = function()
    if inlay_hint_timer then
      inlay_hint_timer:stop()
      if not inlay_hint_timer:is_closing() then
        inlay_hint_timer:close()
      end
      inlay_hint_timer = nil
    end
    set_inlay_hints(false)
  end,
})

vim.api.nvim_create_autocmd("InsertLeave", {
  group = inlay_group,
  callback = function()
    if inlay_hint_timer then
      inlay_hint_timer:stop()
      if not inlay_hint_timer:is_closing() then
        inlay_hint_timer:close()
      end
      inlay_hint_timer = nil
    end
    inlay_hint_timer = (vim.uv or vim.loop).new_timer()
    inlay_hint_timer:start(
      INLAY_DELAY_MS,
      0,
      vim.schedule_wrap(function()
        local mode = vim.api.nvim_get_mode().mode
        if mode:sub(1, 1) == "n" then
          set_inlay_hints(true)
        end
        if inlay_hint_timer then
          inlay_hint_timer:stop()
          if not inlay_hint_timer:is_closing() then
            inlay_hint_timer:close()
          end
          inlay_hint_timer = nil
        end
      end)
    )
  end,
})

