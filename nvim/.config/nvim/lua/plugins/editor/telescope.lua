return {
  {
    "nvim-telescope/telescope.nvim",
    lazy = false,
    dependencies = {
      "nvim-lua/plenary.nvim",
      "jvgrootveld/telescope-zoxide",
      "dhruvmanila/browser-bookmarks.nvim",
    },
    config = function()
      local telescope = require("telescope")
      local builtin = require("telescope.builtin")
      local actions = require("telescope.actions")
      local action_state = require("telescope.actions.state")
      local pickers = require("telescope.pickers")
      local finders = require("telescope.finders")
      local previewers = require("telescope.previewers")
      local conf = require("telescope.config").values

      local function force_close_telescope(bufnr)
        pcall(actions.close, bufnr)
        vim.cmd("stopinsert")
        pcall(vim.cmd, "close")
      end

      local function sync_open_buffers()
        vim.schedule(function()
          pcall(vim.cmd, "checktime")
          for _, b in ipairs(vim.api.nvim_list_bufs()) do
            if vim.api.nvim_buf_is_loaded(b) then
              pcall(vim.api.nvim_buf_call, b, function()
                pcall(vim.cmd, "checktime")
              end)
            end
          end
        end)
      end

      -- AutoComando com zeramento de timeoutlen para resposta em 0ms
      vim.api.nvim_create_autocmd("FileType", {
        pattern = "TelescopePrompt",
        callback = function(ev)
          local buf = ev.buf
          vim.opt_local.timeoutlen = 0
          vim.opt_local.ttimeoutlen = 0

          local close_cmd = function()
            force_close_telescope(buf)
          end

          vim.keymap.set({ "i", "n", "v", "t" }, "<Esc>", close_cmd, { buffer = buf, nowait = true, silent = true })
          vim.keymap.set({ "i", "n", "v", "t" }, "<C-c>", close_cmd, { buffer = buf, nowait = true, silent = true })
        end,
      })

      telescope.setup({
        defaults = {
          cache_picker = {
            num_pickers = 20,
            limit_entries = 1000,
          },
          prompt_prefix = "   ",
          selection_caret = " ❯ ",
          entry_prefix = "    ",
          initial_mode = "insert",
          selection_strategy = "reset",
          sorting_strategy = "ascending",
          wrap_results = true,
          layout_strategy = "horizontal",
          layout_config = {
            prompt_position = "top",
            width = 0.90,
            height = 0.90,
            horizontal = {
              preview_width = 0.55,
            },
          },
          borderchars = { "─", "│", "─", "│", "╭", "╮", "╯", "╰" },
          mappings = {
            i = {
              ["<Esc>"] = actions.close,
              ["<C-c>"] = actions.close,
              ["<C-q>"] = actions.send_to_qflist,
            },
            n = {
              ["<Esc>"] = actions.close,
              ["<C-c>"] = actions.close,
              ["<C-q>"] = actions.send_to_qflist,
            },
          },
          attach_mappings = function(prompt_bufnr, _)
            vim.keymap.set({ "i", "n" }, "<Esc>", function()
              force_close_telescope(prompt_bufnr)
            end, { buffer = prompt_bufnr, nowait = true, silent = true })
            return true
          end,
        },
        pickers = {
          find_files = {
            prompt_title = "Buscar Arquivos no Projeto",
            previewer = true,
            layout_config = { height = 0.90, width = 0.90 },
          },
          live_grep = {
            prompt_title = "Buscar String no Projeto",
            previewer = true,
            layout_config = { height = 0.90, width = 0.90 },
          },
        },
      })

      pcall(telescope.load_extension, "zoxide")
      pcall(telescope.load_extension, "bookmarks")

      local function get_target_buffer()
        local win = vim.api.nvim_get_current_win()
        local bufnr = vim.api.nvim_win_get_buf(win)
        local name = vim.api.nvim_buf_get_name(bufnr)
        local buftype = vim.bo[bufnr].buftype

        if buftype == "" and name ~= "" then
          return bufnr, win
        end

        for _, w in ipairs(vim.api.nvim_list_wins()) do
          local b = vim.api.nvim_win_get_buf(w)
          local bname = vim.api.nvim_buf_get_name(b)
          if vim.bo[b].buftype == "" and bname ~= "" then
            return b, w
          end
        end

        for _, b in ipairs(vim.api.nvim_list_bufs()) do
          if vim.api.nvim_buf_is_loaded(b) and vim.bo[b].buftype == "" and vim.api.nvim_buf_get_name(b) ~= "" then
            return b, win
          end
        end

        return bufnr, win
      end

      local function search_current_buffer()
        local bufnr, win = get_target_buffer()
        if vim.fn.mode() == "i" then
          vim.cmd("stopinsert")
        end

        local filename = vim.api.nvim_buf_get_name(bufnr)
        local display_name = (filename and filename ~= "") and vim.fn.fnamemodify(filename, ":t") or "[Sem Nome]"
        local lines = vim.api.nvim_buf_get_lines(bufnr, 0, -1, false)

        local entries = {}
        for i, line in ipairs(lines) do
          table.insert(entries, {
            lnum = i,
            text = line,
            filename = filename,
            display = string.format("%4d │ %s", i, line),
          })
        end

        local picker = pickers.new({
          prompt_title = "Buscar String no Arquivo",
          finder = finders.new_table({
            results = entries,
            entry_maker = function(entry)
              return {
                value = entry,
                display = entry.display,
                ordinal = entry.text,
                lnum = entry.lnum,
                filename = entry.filename,
                bufnr = bufnr,
              }
            end,
          }),
          previewer = conf.grep_previewer({}),
          sorter = conf.generic_sorter({}),
          layout_strategy = "horizontal",
          layout_config = {
            prompt_position = "top",
            width = 0.90,
            height = 0.90,
            horizontal = {
              preview_width = 0.55,
            },
          },
          sorting_strategy = "ascending",
          borderchars = { "─", "│", "─", "│", "╭", "╮", "╯", "╰" },
          cache_picker = { disabled = false },
          attach_mappings = function(prompt_bufnr, _)
            vim.keymap.set({ "i", "n" }, "<Esc>", function()
              force_close_telescope(prompt_bufnr)
            end, { buffer = prompt_bufnr, nowait = true, silent = true })

            actions.select_default:replace(function()
              local selection = action_state.get_selected_entry()
              force_close_telescope(prompt_bufnr)
              if selection and selection.lnum then
                pcall(vim.api.nvim_set_current_win, win)
                pcall(vim.api.nvim_win_set_cursor, win, { selection.lnum, 0 })
              end
            end)
            return true
          end,
        })

        picker:find()
      end

      local function search_and_replace_current_buffer()
        local bufnr, win = get_target_buffer()
        if vim.fn.mode() == "i" then
          vim.cmd("stopinsert")
        end

        local filename = vim.api.nvim_buf_get_name(bufnr)
        local display_name = (filename and filename ~= "") and vim.fn.fnamemodify(filename, ":t") or "[Sem Nome]"
        local lines = vim.api.nvim_buf_get_lines(bufnr, 0, -1, false)

        local entries = {}
        for i, line in ipairs(lines) do
          table.insert(entries, {
            lnum = i,
            text = line,
            filename = filename,
            display = string.format("%4d │ %s", i, line),
          })
        end

        local picker = pickers.new({
          prompt_title = "Substituir String no Arquivo",
          finder = finders.new_table({
            results = entries,
            entry_maker = function(entry)
              return {
                value = entry,
                display = entry.display,
                ordinal = entry.text,
                lnum = entry.lnum,
                filename = entry.filename,
                text = entry.text,
                bufnr = bufnr,
              }
            end,
          }),
          previewer = conf.grep_previewer({}),
          sorter = conf.generic_sorter({}),
          layout_strategy = "horizontal",
          layout_config = {
            prompt_position = "top",
            width = 0.90,
            height = 0.90,
            horizontal = {
              preview_width = 0.55,
            },
          },
          sorting_strategy = "ascending",
          borderchars = { "─", "│", "─", "│", "╭", "╮", "╯", "╰" },
          cache_picker = { disabled = false },
          attach_mappings = function(prompt_bufnr, map)
            vim.keymap.set({ "i", "n" }, "<Esc>", function()
              force_close_telescope(prompt_bufnr)
            end, { buffer = prompt_bufnr, nowait = true, silent = true })

            local function do_replace_all_buffer(current_picker)
              local search_term = current_picker._user_search_term
              local replace_term = current_picker:_get_prompt()

              force_close_telescope(prompt_bufnr)

              local count = 0
              local cur_lines = vim.api.nvim_buf_get_lines(bufnr, 0, -1, false)
              for i, line in ipairs(cur_lines) do
                if line:find(search_term, 1, true) then
                  cur_lines[i] = line:gsub(search_term, replace_term)
                  count = count + 1
                end
              end

              vim.api.nvim_buf_set_lines(bufnr, 0, -1, false, cur_lines)
              pcall(vim.api.nvim_buf_call, bufnr, function()
                pcall(vim.cmd, "write!")
              end)

              vim.notify(string.format("Substituído '%s' por '%s' em %d trechos de %s.", search_term, replace_term, count, display_name), vim.log.levels.INFO)
            end

            local all_keys = { "<C-CR>", "<C-Enter>", "<C-s>", "<M-CR>", "<M-Enter>" }
            for _, k in ipairs(all_keys) do
              map({ "i", "n" }, k, function()
                local current_picker = action_state.get_current_picker(prompt_bufnr)
                if current_picker._user_search_term then
                  do_replace_all_buffer(current_picker)
                end
              end)
            end

            actions.select_default:replace(function()
              local current_picker = action_state.get_current_picker(prompt_bufnr)

              if not current_picker._user_search_term then
                local search_term = current_picker:_get_prompt()
                if not search_term or search_term == "" then
                  vim.notify("Digite um termo de busca primeiro.", vim.log.levels.WARN)
                  return
                end

                local matched_entries = {}
                local cur_lines = vim.api.nvim_buf_get_lines(bufnr, 0, -1, false)
                for i, line in ipairs(cur_lines) do
                  if line:find(search_term, 1, true) then
                    table.insert(matched_entries, {
                      filename = filename,
                      lnum = i,
                      text = line,
                    })
                  end
                end

                if #matched_entries == 0 then
                  vim.notify("Nenhuma ocorrência encontrada para '" .. search_term .. "' em " .. display_name, vim.log.levels.WARN)
                  return
                end

                current_picker._user_search_term = search_term
                current_picker._matched_entries = matched_entries

                if current_picker.prompt_border and current_picker.prompt_border.change_title then
                  pcall(function()
                    current_picker.prompt_border:change_title("Substituir String no Arquivo")
                  end)
                end

                local diff_previewer = previewers.new_buffer_previewer({
                  title = "Prévia da Substituição",
                  define_preview = function(self, entry)
                    local lnum = entry.lnum or (entry.value and entry.value.lnum) or 1
                    local file_lines = vim.api.nvim_buf_get_lines(bufnr, 0, -1, false)
                    local start_line = math.max(1, lnum - 3)
                    local end_line = math.min(#file_lines, lnum + 3)

                    local preview_content = {}
                    for i = start_line, end_line do
                      if i == lnum then
                        local orig = file_lines[i] or ""
                        local replaced = entry.text or orig
                        table.insert(preview_content, "- " .. orig)
                        table.insert(preview_content, "+ " .. replaced)
                      else
                        table.insert(preview_content, "  " .. (file_lines[i] or ""))
                      end
                    end

                    vim.api.nvim_buf_set_lines(self.state.bufnr, 0, -1, false, preview_content)
                    vim.bo[self.state.bufnr].filetype = "diff"
                  end,
                })

                local update_results = function(replace_term)
                  local new_entries = {}
                  for idx, entry in ipairs(current_picker._matched_entries) do
                    local orig = entry.text or ""
                    local replaced = orig:gsub(search_term, replace_term)
                    local line_no = entry.lnum or 0
                    local display_str = string.format("%4d │ %s ➜ %s", line_no, orig, replaced)
                    table.insert(new_entries, {
                      value = entry,
                      idx = idx,
                      display = display_str,
                      ordinal = display_str,
                      filename = entry.filename,
                      lnum = entry.lnum,
                      col = entry.col,
                      text = replaced,
                    })
                  end

                  current_picker:refresh(finders.new_table({
                    results = new_entries,
                    entry_maker = function(e) return e end,
                  }), { reset_prompt = false })

                  current_picker.previewer = diff_previewer
                end

                current_picker._update_results = update_results
                pcall(function() current_picker:set_prompt("") end)
                update_results("")

                vim.api.nvim_buf_attach(prompt_bufnr, false, {
                  on_lines = function()
                    vim.schedule(function()
                      if not vim.api.nvim_buf_is_valid(prompt_bufnr) then return end
                      local replace_term = current_picker:_get_prompt()
                      update_results(replace_term)
                    end)
                  end,
                })
              else
                -- FASE 2 com ENTER em um TRECHO ESPECÍFICO do arquivo atual:
                local selection = action_state.get_selected_entry()
                local replace_term = current_picker:_get_prompt()
                local search_term = current_picker._user_search_term

                if selection and selection.lnum then
                  local target = selection.value or selection
                  local lnum = target.lnum

                  local buf_lines = vim.api.nvim_buf_get_lines(bufnr, lnum - 1, lnum, false)
                  if buf_lines[1] then
                    local new_line = buf_lines[1]:gsub(search_term, replace_term)
                    vim.api.nvim_buf_set_lines(bufnr, lnum - 1, lnum, false, { new_line })
                    pcall(vim.api.nvim_buf_call, bufnr, function()
                      pcall(vim.cmd, "write!")
                    end)
                  end

                  -- Remove o trecho substituído da listagem ativa
                  local remaining = {}
                  for _, item in ipairs(current_picker._matched_entries) do
                    if not (item.lnum == lnum) then
                      table.insert(remaining, item)
                    end
                  end
                  current_picker._matched_entries = remaining

                  vim.notify(string.format("Substituído no trecho linha %d.", lnum), vim.log.levels.INFO)

                  if #remaining == 0 then
                    vim.notify("Todos os trechos do arquivo foram substituídos.", vim.log.levels.INFO)
                    force_close_telescope(prompt_bufnr)
                    return
                  end

                  if current_picker._update_results then
                    current_picker._update_results(replace_term)
                  end
                else
                  do_replace_all_buffer(current_picker)
                end
              end
            end)

            return true
          end,
        })

        picker:find()
      end

      local function telescope_project_replace()
        if vim.fn.mode() == "i" then
          vim.cmd("stopinsert")
        end

        builtin.live_grep({
          prompt_title = "Substituir String no Projeto",
          attach_mappings = function(prompt_bufnr, map)
            vim.keymap.set({ "i", "n" }, "<Esc>", function()
              force_close_telescope(prompt_bufnr)
            end, { buffer = prompt_bufnr, nowait = true, silent = true })

            local function do_replace_all(current_picker)
              local search_term = current_picker._user_search_term
              local replace_term = current_picker:_get_prompt()

              force_close_telescope(prompt_bufnr)

              local cword_escaped = vim.fn.shellescape(search_term)
              local grep_cmd = "silent! grep! " .. cword_escaped
              pcall(vim.cmd, grep_cmd)

              local qf_list = vim.fn.getqflist()
              if #qf_list == 0 then
                vim.notify("Nenhuma ocorrência de '" .. search_term .. "' encontrada nos trechos.", vim.log.levels.WARN)
                return
              end

              local substitute_cmd = string.format("cfdo %%s/%s/%s/g | update", search_term, replace_term)
              local ok, err = pcall(vim.cmd, substitute_cmd)

              sync_open_buffers()

              if ok then
                vim.notify(string.format("Substituído '%s' por '%s' em %d trechos.", search_term, replace_term, #qf_list), vim.log.levels.INFO)
              else
                vim.notify("Erro ao substituir: " .. tostring(err), vim.log.levels.ERROR)
              end
            end

            -- Mapeamentos para Substituir TODOS os trechos
            local all_keys = { "<C-CR>", "<C-Enter>", "<C-s>", "<M-CR>", "<M-Enter>" }
            for _, k in ipairs(all_keys) do
              map({ "i", "n" }, k, function()
                local current_picker = action_state.get_current_picker(prompt_bufnr)
                if current_picker._user_search_term then
                  do_replace_all(current_picker)
                end
              end)
            end

            actions.select_default:replace(function()
              local current_picker = action_state.get_current_picker(prompt_bufnr)

              if not current_picker._user_search_term then
                local search_term = current_picker:_get_prompt()
                if not search_term or search_term == "" then
                  vim.notify("Digite um termo de busca primeiro.", vim.log.levels.WARN)
                  return
                end

                local rg_cmd = "rg --vimgrep --smart-case -- " .. vim.fn.shellescape(search_term)
                local lines = vim.fn.systemlist(rg_cmd)

                if vim.v.shell_error ~= 0 or #lines == 0 then
                  vim.notify("Nenhuma ocorrência encontrada nos trechos para '" .. search_term .. "'.", vim.log.levels.WARN)
                  return
                end

                local matched_entries = {}
                for _, line in ipairs(lines) do
                  local parts = vim.split(line, ":")
                  if #parts >= 4 then
                    local filename = parts[1]
                    local lnum = tonumber(parts[2]) or 1
                    local col = tonumber(parts[3]) or 1
                    local text = table.concat(parts, ":", 4)
                    table.insert(matched_entries, {
                      filename = filename,
                      lnum = lnum,
                      col = col,
                      text = text,
                    })
                  end
                end

                current_picker._user_search_term = search_term
                current_picker._matched_entries = matched_entries

                if current_picker.prompt_border and current_picker.prompt_border.change_title then
                  pcall(function()
                    current_picker.prompt_border:change_title("Substituir String no Projeto")
                  end)
                end

                local diff_previewer = previewers.new_buffer_previewer({
                  title = "Prévia da Substituição",
                  define_preview = function(self, entry)
                    local filename = entry.filename or (entry.value and entry.value.filename)
                    local lnum = entry.lnum or (entry.value and entry.value.lnum) or 1
                    if not filename or filename == "" or vim.fn.filereadable(filename) ~= 1 then return end

                    local abs_filename = vim.fn.fnamemodify(filename, ":p")
                    local file_lines = vim.fn.readfile(abs_filename)
                    local start_line = math.max(1, lnum - 3)
                    local end_line = math.min(#file_lines, lnum + 3)

                    local preview_content = {}
                    for i = start_line, end_line do
                      if i == lnum then
                        local orig = file_lines[i] or ""
                        local replaced = entry.text or orig
                        table.insert(preview_content, "- " .. orig)
                        table.insert(preview_content, "+ " .. replaced)
                      else
                        table.insert(preview_content, "  " .. (file_lines[i] or ""))
                      end
                    end

                    vim.api.nvim_buf_set_lines(self.state.bufnr, 0, -1, false, preview_content)
                    vim.bo[self.state.bufnr].filetype = "diff"
                  end,
                })

                local update_results = function(replace_term)
                  local new_entries = {}
                  for idx, entry in ipairs(current_picker._matched_entries) do
                    local orig = entry.text or ""
                    local replaced = orig:gsub(search_term, replace_term)
                    local fname = entry.filename and vim.fn.fnamemodify(entry.filename, ":t") or ""
                    local line_no = entry.lnum or 0
                    local display_str = string.format("%s:%d │ %s ➜ %s", fname, line_no, orig, replaced)
                    table.insert(new_entries, {
                      value = entry,
                      idx = idx,
                      display = display_str,
                      ordinal = display_str,
                      filename = entry.filename,
                      lnum = entry.lnum,
                      col = entry.col,
                      text = replaced,
                    })
                  end

                  current_picker:refresh(finders.new_table({
                    results = new_entries,
                    entry_maker = function(e) return e end,
                  }), { reset_prompt = false })

                  current_picker.previewer = diff_previewer
                end

                current_picker._update_results = update_results
                pcall(function() current_picker:set_prompt("") end)
                update_results("")

                vim.api.nvim_buf_attach(prompt_bufnr, false, {
                  on_lines = function()
                    vim.schedule(function()
                      if not vim.api.nvim_buf_is_valid(prompt_bufnr) then return end
                      local replace_term = current_picker:_get_prompt()
                      update_results(replace_term)
                    end)
                  end,
                })
              else
                -- FASE 2 com ENTER em um TRECHO ESPECÍFICO:
                local selection = action_state.get_selected_entry()
                local replace_term = current_picker:_get_prompt()
                local search_term = current_picker._user_search_term

                if selection and (selection.filename or (selection.value and selection.value.filename)) then
                  local target = selection.value or selection
                  local filename = target.filename
                  local lnum = target.lnum

                  if filename and lnum then
                    local abs_filename = vim.fn.fnamemodify(filename, ":p")
                    local target_buf = nil

                    for _, b in ipairs(vim.api.nvim_list_bufs()) do
                      local bname = vim.api.nvim_buf_get_name(b)
                      if bname ~= "" and vim.fn.fnamemodify(bname, ":p") == abs_filename then
                        target_buf = b
                        break
                      end
                    end

                    if target_buf and vim.api.nvim_buf_is_loaded(target_buf) then
                      local buf_lines = vim.api.nvim_buf_get_lines(target_buf, lnum - 1, lnum, false)
                      if buf_lines[1] then
                        local new_line = buf_lines[1]:gsub(search_term, replace_term)
                        vim.api.nvim_buf_set_lines(target_buf, lnum - 1, lnum, false, { new_line })
                        pcall(vim.api.nvim_buf_call, target_buf, function()
                          pcall(vim.cmd, "write!")
                        end)
                      end
                    else
                      local file_lines = vim.fn.readfile(abs_filename)
                      if file_lines[lnum] then
                        file_lines[lnum] = file_lines[lnum]:gsub(search_term, replace_term)
                        vim.fn.writefile(file_lines, abs_filename)
                      end
                    end

                    -- Remove o trecho substituído da listagem ativa
                    local remaining = {}
                    for _, item in ipairs(current_picker._matched_entries) do
                      local item_abs = vim.fn.fnamemodify(item.filename, ":p")
                      if not (item_abs == abs_filename and item.lnum == lnum) then
                        table.insert(remaining, item)
                      end
                    end
                    current_picker._matched_entries = remaining

                    vim.notify(string.format("Substituído no trecho %s:%d.", vim.fn.fnamemodify(filename, ":t"), lnum), vim.log.levels.INFO)

                    if #remaining == 0 then
                      vim.notify("Todos os trechos foram substituídos.", vim.log.levels.INFO)
                      sync_open_buffers()
                      force_close_telescope(prompt_bufnr)
                      return
                    end

                    -- Atualiza a listagem sem fechar o Telescope!
                    if current_picker._update_results then
                      current_picker._update_results(replace_term)
                    end
                  end
                else
                  -- Se não houver item selecionado, aplica em todos
                  do_replace_all(current_picker)
                end
              end
            end)

            return true
          end,
        })
      end

      local map = vim.keymap.set

      -- Ctrl+1: Buscar String no Arquivo
      for _, k in ipairs({ "<C-1>", "<C-k1>", "<C-kEnd>", "<Esc>[49;5u", "\x1b[49;5u" }) do
        map({ "n", "v", "i" }, k, search_current_buffer, { desc = "Buscar String no Arquivo" })
      end

      -- Ctrl+2: Substituir String no Arquivo
      for _, k in ipairs({ "<C-2>", "<C-k2>", "<C-kDown>", "<Esc>[50;5u", "\x1b[50;5u" }) do
        map({ "n", "v", "i" }, k, search_and_replace_current_buffer, { desc = "Substituir String no Arquivo" })
      end

      -- Ctrl+3: Buscar String no Projeto
      for _, k in ipairs({ "<C-3>", "<C-k3>", "<C-kPageDown>", "<Esc>[51;5u", "\x1b[51;5u" }) do
        map({ "n", "v", "i" }, k, function()
          if vim.fn.mode() == "i" then vim.cmd("stopinsert") end
          builtin.live_grep({ prompt_title = "Buscar String no Projeto" })
        end, { desc = "Buscar String no Projeto" })
      end

      -- Ctrl+4: Substituir String no Projeto
      for _, k in ipairs({ "<C-4>", "<C-k4>", "<C-kLeft>", "<Esc>[52;5u", "\x1b[52;5u" }) do
        map({ "n", "v", "i" }, k, telescope_project_replace, { desc = "Substituir String no Projeto" })
      end

      -- Ctrl+5: Buscar Arquivos no Projeto
      for _, k in ipairs({ "<C-5>", "<C-k5>", "<C-kOrigin>", "<C-kClear>", "<Esc>[53;5u", "\x1b[53;5u" }) do
        map({ "n", "v", "i" }, k, function()
          if vim.fn.mode() == "i" then vim.cmd("stopinsert") end
          builtin.find_files({ prompt_title = "Buscar Arquivos no Projeto", no_ignore = true, hidden = true })
        end, { desc = "Buscar Arquivos no Projeto" })
      end

      -- Ctrl+6: Renomear Arquivos no Projeto
      for _, k in ipairs({ "<C-6>", "<C-k6>", "<C-kRight>", "<Esc>[54;5u", "\x1b[54;5u" }) do
        map({ "n", "v", "i" }, k, function()
          require("config.file_rename").telescope_batch_rename()
        end, { desc = "Renomear Arquivos no Projeto" })
      end

      -- Alt+Shift+Z: Zoxide Find
      for _, k in ipairs({ "<M-S-z>", "<M-Z>", "<A-S-z>", "<A-Z>" }) do
        map({ "n", "v", "i" }, k, function()
          local cword = vim.fn.expand("<cword>")
          local default_val = (cword and cword ~= "") and cword or ""
          vim.ui.input({ prompt = "Zoxide: ", default = default_val }, function(input)
            if input and input ~= "" then
              local path = vim.fn.system("zoxide query " .. vim.fn.shellescape(input)):gsub("[\n\r]", "")
              if vim.v.shell_error ~= 0 or not path or path == "" then path = input end
              pcall(function()
                builtin.find_files({ prompt_title = "Buscar Arquivos (Zoxide)", cwd = path })
              end)
            end
          end)
        end, { desc = "Find Files via Zoxide" })
      end

      -- Alt+Shift+O: Símbolos e Funções do Arquivo (LSP Document Symbols)
      for _, k in ipairs({ "<M-S-o>", "<M-O>", "<M-o>", "<A-S-o>", "<A-O>", "<A-o>" }) do
        map({ "n", "v", "i" }, k, function()
          local bufnr = get_target_buffer()
          if vim.fn.mode() == "i" then
            vim.cmd("stopinsert")
          end
          pcall(function()
            builtin.lsp_document_symbols({
              prompt_title = "Símbolos do Arquivo",
              bufnr = bufnr,
            })
          end)
        end, { desc = "Símbolos e Funções do Arquivo" })
      end

      -- Bookmarks
      map({ "n", "v", "i" }, "<M-b>", function()
        pcall(function()
          telescope.extensions.bookmarks.bookmarks({ prompt_title = "Favoritos do Navegador" })
        end)
      end, { desc = "Browser Bookmarks" })
    end,
  },
}
