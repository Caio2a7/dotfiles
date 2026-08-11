local function is_csv_buf()
  local cur_buf = vim.api.nvim_get_current_buf()
  local ft = (vim.bo[cur_buf].filetype or ""):lower()
  local fn = vim.api.nvim_buf_get_name(cur_buf):lower()
  local line = vim.api.nvim_get_current_line()
  if ft:find("csv") ~= nil or ft:find("tsv") ~= nil or fn:sub(-4) == ".csv" or fn:sub(-4) == ".tsv" then
    return true
  end
  if line:find(",") or line:find(";") or line:find("\t") then
    return true
  end
  return false
end

local function toggle_csv_cell_symbol()
  local cur_win = vim.api.nvim_get_current_win()
  local init_cursor = vim.api.nvim_win_get_cursor(cur_win)
  local cur_buf = vim.api.nvim_get_current_buf()
  local ft = (vim.bo[cur_buf].filetype or ""):lower()
  local fn = vim.api.nvim_buf_get_name(cur_buf):lower()

  local positions = {}
  local primary_r, primary_c = init_cursor[1], init_cursor[2]

  -- 1. Captura regiões do vim-visual-multi via avaliação nativa do Vimscript
  local ok_eval, vm_regions = pcall(function()
    return vim.api.nvim_eval("map(copy(b:VM_Selection.Regions), '{ \"l\": v:val.l, \"a\": v:val.a }')")
  end)

  if ok_eval and type(vm_regions) == "table" and #vm_regions > 0 then
    for _, reg in ipairs(vm_regions) do
      if type(reg) == "table" and reg.l then
        table.insert(positions, { r = tonumber(reg.l), c = tonumber(reg.a) or primary_c })
      end
    end
  end

  -- Fallback se não houver cursores de VM ativados
  if #positions == 0 then
    table.insert(positions, { r = primary_r, c = primary_c })
  end

  -- Evita processar a mesma linha duas vezes
  local processed_lines = {}

  for _, pos in ipairs(positions) do
    local r, c = pos.r, pos.c
    if not processed_lines[r] then
      processed_lines[r] = true
      local row_0 = r - 1
      local line_tbl = vim.api.nvim_buf_get_lines(cur_buf, row_0, r, false)
      local line = line_tbl[1] or ""

      if line ~= "" then
        local delim = ","
        if ft:find("tsv") or fn:sub(-4) == ".tsv" or (line:find("\t") and not line:find(",")) then
          delim = "\t"
        elseif line:find(";") and not line:find(",") then
          delim = ";"
        end

        local out, q, s = {}, false, 1
        for i = 1, #line do
          local ch = line:sub(i, i)
          if ch == '"' then
            q = not q
          elseif ch == delim and not q then
            out[#out + 1] = { s = s - 1, e = i - 1, t = line:sub(s, i - 1) }
            s = i + 1
          end
        end
        out[#out + 1] = { s = s - 1, e = #line, t = line:sub(s) }

        if #out > 0 then
          local idx = 1
          for i = 1, #out do
            local f = out[i]
            local next_s = (i < #out) and out[i + 1].s or 99999
            if c >= f.s and c < next_s then
              idx = i
              break
            end
          end

          local cell = out[idx]
          if cell then
            local t = cell.t
            local new_t
            if t:find("✅", 1, true) then
              new_t = t:gsub("%s*✅", "❎")
            elseif t:find("❎", 1, true) then
              new_t = t:gsub("%s*❎", "")
            else
              local trimmed = vim.trim(t)
              if trimmed == "" then
                new_t = "✅"
              else
                new_t = trimmed .. " ✅"
              end
            end

            out[idx].t = new_t

            local new_fields = {}
            for _, f in ipairs(out) do
              table.insert(new_fields, f.t)
            end
            local new_line = table.concat(new_fields, delim)

            vim.api.nvim_buf_set_lines(cur_buf, row_0, r, false, { new_line })
          end
        end
      end
    end
  end

  -- Atualiza o layout do vim-visual-multi se estiver ativo
  pcall(function()
    vim.cmd("call b:VM_Selection.Funcs.update()")
  end)

  pcall(vim.cmd, "doautocmd TextChanged")

  local cur_line = vim.api.nvim_buf_get_lines(cur_buf, init_cursor[1] - 1, init_cursor[1], false)[1] or ""
  local is_insert = (vim.api.nvim_get_mode().mode:sub(1, 1) == "i")
  local max_c = is_insert and #cur_line or math.max(0, #cur_line - 1)
  pcall(vim.api.nvim_win_set_cursor, cur_win, { init_cursor[1], math.min(init_cursor[2], max_c) })
  vim.schedule(function()
    local line_now = vim.api.nvim_buf_get_lines(cur_buf, init_cursor[1] - 1, init_cursor[1], false)[1] or ""
    local m_c = is_insert and #line_now or math.max(0, #line_now - 1)
    pcall(vim.api.nvim_win_set_cursor, cur_win, { init_cursor[1], math.min(init_cursor[2], m_c) })
  end)
end

local function run_toggle_csv()
  local view = vim.fn.winsaveview()
  local is_vm = vim.b.visual_multi == 1
  local is_insert = vim.fn.mode() == "i"

  if is_vm and is_insert then
    pcall(vim.cmd, "call vm#icmd#stop()")
  end

  toggle_csv_cell_symbol()

  if is_vm and is_insert then
    pcall(vim.cmd, "call vm#icmd#start()")
  elseif is_insert then
    pcall(vim.cmd, "startinsert")
  end

  pcall(vim.fn.winrestview, view)
  vim.schedule(function() pcall(vim.fn.winrestview, view) end)
end

-- Cria o comando de usuário :CsvToggle
vim.api.nvim_create_user_command("CsvToggle", run_toggle_csv, { desc = "Toggle CSV Cell Symbol" })

-- AutoComando para que o Ctrl+x seja vinculado buffer-local quando o multi-cursor inicia
vim.api.nvim_create_autocmd("User", {
  pattern = { "visual_multi_start", "visual_multi_mode" },
  callback = function()
    local buf = vim.api.nvim_get_current_buf()
    vim.keymap.set({ "n", "i", "v" }, "<C-x>", run_toggle_csv, { buffer = buf, nowait = true, silent = true })
  end,
})

return {
  {
    "AstroNvim/astrocore",
    opts = function(_, opts)
      local map = vim.keymap.set

      map("n", "<C-x>", run_toggle_csv, { desc = "Toggle CSV Cell Symbol", noremap = true, silent = true, nowait = true })
      map("i", "<C-x>", run_toggle_csv, { desc = "Toggle CSV Cell Symbol", noremap = true, silent = true, nowait = true })
      map("v", "<C-x>", run_toggle_csv, { desc = "Toggle CSV Cell Symbol", noremap = true, silent = true, nowait = true })

      opts = opts or {}
      opts.mappings = vim.tbl_deep_extend("force", opts.mappings or {}, {
        n = {
          ["<C-x>"] = { run_toggle_csv, desc = "Toggle CSV Cell Symbol" },
          ["<leader>x"] = { run_toggle_csv, desc = "Toggle CSV Cell Symbol" },
          ["<leader>cx"] = { run_toggle_csv, desc = "Toggle CSV Cell Symbol" },
        },
        i = {
          ["<C-x>"] = { run_toggle_csv, desc = "Toggle CSV Cell Symbol" },
        },
        v = {
          ["<C-x>"] = { run_toggle_csv, desc = "Toggle CSV Cell Symbol" },
        },
      })
      return opts
    end,
  },
}
