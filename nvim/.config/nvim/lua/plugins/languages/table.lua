return {
  {
    "mechatroner/rainbow_csv",
    lazy = false,
    init = function()
      vim.g.rbql_with_headers = 1
      vim.g.rcsv_max_columns  = 40
      vim.g.rcsv_nobind       = 1
      vim.g.rainbow_csv_no_mappings = 1
    end,
    config = function()
      vim.api.nvim_create_autocmd({ "FileType", "BufEnter" }, {
        pattern = { "csv", "tsv", "rfc_csv", "csv_semicolon", "csv_pipe", "csv_whitespace" },
        callback = function(ev)
          vim.schedule(function()
            pcall(vim.api.nvim_clear_autocmds, {
              group  = "RainbowHintGrp",
              event  = "CursorMoved",
              buffer = ev.buf,
            })
          end)
        end,
      })
    end,
  },

  {
    "hat0uma/csvview.nvim",
    lazy = false,
    config = function()
      require("csvview").setup({
        parser = { comments = { "#" }, delimiter = { default = ",", ft = { tsv = "\t" } } },
        view   = { min_column_length = 8, display_mode = "border" },
      })

      local NS          = vim.api.nvim_create_namespace("CsvRender")
      local ST          = {}
      local CELL_STATES = {}

      local PALETTE = {
        "#7e9cd8", "#98bb6c", "#c0a36e", "#957fb8",
        "#7aa89f", "#d27e99", "#d4855a", "#6a9589",
      }

      local HDR_BG   = "#120f23"
      local TABLE_BG = "#120f23"

      local NAME_COLORS = {
        ["Faculdade"] = { bg = TABLE_BG, fg = "#ff79c6" },
        ["Estudar"]   = { bg = TABLE_BG, fg = "#47d1b2" },
        ["Trabalhar"] = { bg = TABLE_BG, fg = "#ff0033" },
        ["Trabalho"]  = { bg = TABLE_BG, fg = "#ff0033" },
        ["Inglês"]    = { bg = TABLE_BG, fg = "#a3e635" },
        ["Ingles"]    = { bg = TABLE_BG, fg = "#a3e635" },
        ["Dormir"]    = { bg = TABLE_BG, fg = "#70a1ff" },
        ["Xuxis"]     = { bg = TABLE_BG, fg = "#e84393" },
        ["Busão"]     = { bg = TABLE_BG, fg = "#a0a5b5" },
        ["Busao"]     = { bg = TABLE_BG, fg = "#a0a5b5" },
        ["Leitura"]   = { bg = TABLE_BG, fg = "#0abde3" },
        ["Livre"]     = { bg = TABLE_BG, fg = "#c05cff" },
        ["Gameplay"]  = { bg = TABLE_BG, fg = "#a55eea" },
        ["Academia"]  = { bg = TABLE_BG, fg = "#ff6b6b" },
        ["Meditação"] = { bg = TABLE_BG, fg = "#b388ff" },
        ["Meditacao"] = { bg = TABLE_BG, fg = "#b388ff" },
        ["Almoço"]    = { bg = TABLE_BG, fg = "#ffe066" },
        ["Almoco"]    = { bg = TABLE_BG, fg = "#ffe066" },
        ["Janta"]     = { bg = TABLE_BG, fg = "#ffe066" },
      }

      local function find_name_match(str)
        if not str or str == "" then return nil end
        local clean = vim.trim(str):gsub('^"+', ''):gsub('"+$', ''):gsub("^'+", ''):gsub("'+$", '')
        clean = vim.trim(clean:gsub("✅", ""):gsub("❎", ""))
        if clean == "" then return nil end
        if NAME_COLORS[clean] then return clean end
        local lower = clean:lower()
        for k, _ in pairs(NAME_COLORS) do
          if k:lower() == lower then
            return k
          end
        end
        return nil
      end

      local function name_hl(name)
        return "CsvName_" .. name:gsub("[^a-zA-Z0-9]", "_")
      end

      local function setup_highlights()
        for i, fg in ipairs(PALETTE) do
          vim.api.nvim_set_hl(0, "CsvHdr" .. i, { fg = fg, bg = TABLE_BG, bold = true })
        end
        vim.api.nvim_set_hl(0, "CsvHdrLine",     { bg = TABLE_BG })
        vim.api.nvim_set_hl(0, "CsvHdrSep",      { fg = "#3a3a60", bg = TABLE_BG })
        vim.api.nvim_set_hl(0, "CsvOdd",         { bg = TABLE_BG })
        vim.api.nvim_set_hl(0, "CsvEven",        { bg = TABLE_BG })
        vim.api.nvim_set_hl(0, "CsvCell",        { fg = "#ffffff", bg = TABLE_BG })
        vim.api.nvim_set_hl(0, "CsvSep",         { fg = "#282850", bg = TABLE_BG })
        vim.api.nvim_set_hl(0, "CsvToggleGreen", { fg = "#00ff66", bg = TABLE_BG, bold = true, force = true })
        vim.api.nvim_set_hl(0, "CsvToggleRed",   { fg = "#ff0044", bg = TABLE_BG, bold = true, force = true })
        for n, conf in pairs(NAME_COLORS) do
          local bg = TABLE_BG
          local fg = type(conf) == "table" and conf.fg or "#a8abc0"
          vim.api.nvim_set_hl(0, name_hl(n), { fg = fg, bg = bg, bold = true, force = true })
        end
      end

      setup_highlights()
      vim.api.nvim_create_autocmd("ColorScheme", { callback = setup_highlights })

      local function get_delim(buf)
        local ft = vim.bo[buf].filetype
        if ft == "tsv"           then return "\t" end
        if ft == "csv_semicolon" then return ";"  end
        if ft == "csv_pipe"      then return "|"  end
        local line = vim.api.nvim_buf_get_lines(buf, 0, 1, false)[1] or ""
        if line:find(";") and not line:find(",") then return ";" end
        if line:find("\t") and not line:find(",") then return "\t" end
        if line:find("|") and not line:find(",") then return "|" end
        return ","
      end

      local function parse_fields(line, delim)
        local out, q, s = {}, false, 1
        for i = 1, #line do
          local c = line:sub(i, i)
          if c == '"' then
            q = not q
          elseif c == delim and not q then
            out[#out + 1] = { s = s - 1, e = i - 1, t = line:sub(s, i - 1) }
            s = i + 1
          end
        end
        out[#out + 1] = { s = s - 1, e = #line, t = line:sub(s) }
        return out
      end

      local function calc_widths(buf, delim)
        local w = {}
        local n = math.min(vim.api.nvim_buf_line_count(buf), 2000)
        for l = 0, n - 1 do
          local line = vim.api.nvim_buf_get_lines(buf, l, l + 1, false)[1] or ""
          for i, f in ipairs(parse_fields(line, delim)) do
            w[i] = math.max(w[i] or 0, vim.fn.strdisplaywidth(f.t))
          end
        end
        return w
      end

      local function render(buf)
        if not vim.api.nvim_buf_is_valid(buf) then return end
        vim.api.nvim_buf_clear_namespace(buf, NS, 0, -1)
        setup_highlights()

        local delim  = get_delim(buf)
        local widths = calc_widths(buf, delim)
        local n      = math.min(vim.api.nvim_buf_line_count(buf), 10000)

        for l = 0, n - 1 do
          local line   = vim.api.nvim_buf_get_lines(buf, l, l + 1, false)[1] or ""
          local is_hdr = l == 0

          vim.api.nvim_buf_set_extmark(buf, NS, l, 0, {
            line_hl_group = is_hdr and "CsvHdrLine"
              or (l % 2 == 1 and "CsvOdd" or "CsvEven"),
            priority = 1,
          })

          local fs = parse_fields(line, delim)
          for i, f in ipairs(fs) do
            local matched_name = find_name_match(f.t)
            local is_last      = i == #fs
            local txt_w        = vim.fn.strdisplaywidth(f.t)
            local pad          = math.max(0, (widths[i] or txt_w) - txt_w) + 1

            local cell_state   = not is_hdr
              and CELL_STATES[buf]
              and CELL_STATES[buf][l]
              and CELL_STATES[buf][l][i]

            local has_check = f.t:find("✅", 1, true) ~= nil
            local has_cross = f.t:find("❎", 1, true) ~= nil

            local col_hl
            if is_hdr then
              col_hl = "CsvHdr" .. ((i - 1) % #PALETTE + 1)
            elseif has_check or cell_state == "green" then
              col_hl = "CsvToggleGreen"
            elseif has_cross or cell_state == "red" then
              col_hl = "CsvToggleRed"
            elseif matched_name then
              col_hl = name_hl(matched_name)
            else
              col_hl = "CsvCell"
            end
            local sep_hl = is_hdr and "CsvHdrSep" or "CsvSep"

            if f.s < f.e then
              vim.api.nvim_buf_set_extmark(buf, NS, l, f.s, {
                end_col  = f.e,
                hl_group = col_hl,
                priority = 4096,
                hl_mode  = "combine",
              })
            end

            vim.api.nvim_buf_set_extmark(buf, NS, l, f.e, {
              virt_text     = {{ string.rep(" ", pad), col_hl }},
              virt_text_pos = "inline",
              priority      = 4097,
            })

            if not is_last then
              vim.api.nvim_buf_set_extmark(buf, NS, l, f.e, {
                end_col       = f.e + 1,
                virt_text     = {{ "│", sep_hl }},
                virt_text_pos = "overlay",
                priority      = 4098,
              })
            end
          end
        end

        ST[buf] = true
      end

      local function clear_render(buf)
        vim.api.nvim_clear_namespace(buf, NS, 0, -1)
        if vim.api.nvim_buf_is_valid(buf) then
          vim.bo[buf].syntax = "csv"
        end
        ST[buf] = false
      end
      local function toggle_symbol_in_cell(target_buf, is_ins_param)
        local was_insert = (is_ins_param == true) or (vim.api.nvim_get_mode().mode:sub(1, 1) == "i")
        local view = vim.fn.winsaveview()
        local cur_win  = vim.api.nvim_get_current_win()
        local cur_buf  = target_buf or vim.api.nvim_get_current_buf()
        local row, col = view.lnum, view.col
        local row_0    = row - 1
        local line     = vim.api.nvim_buf_get_lines(cur_buf, row_0, row, false)[1] or ""
        if line == "" then return end

        local cur_delim = get_delim(cur_buf)
        local fs = parse_fields(line, cur_delim)
        if #fs == 0 then return end

        local idx = 1
        for i = 1, #fs do
          local f = fs[i]
          local next_s = (i < #fs) and fs[i + 1].s or 99999
          if col >= f.s and col < next_s then
            idx = i
            break
          end
        end

        local cell = fs[idx]
        if not cell then
          return
        end

        local t = cell.t
        local new_t
        if t:find("✅", 1, true) then
          new_t = t:gsub("%s*✅", "❎")
        elseif t:find("❎", 1, true) then
          new_t = t:gsub("%s*❎", "")
        else
          local trimmed = vim.trim(t)
          new_t = trimmed == "" and "✅" or (trimmed .. " ✅")
        end

        fs[idx].t = new_t

        local new_fields = {}
        for _, f in ipairs(fs) do table.insert(new_fields, f.t) end
        local new_line = table.concat(new_fields, cur_delim)

        vim.api.nvim_buf_set_lines(cur_buf, row_0, row, false, { new_line })
        render(cur_buf)

        local function restore_pos()
          local line_now = vim.api.nvim_buf_get_lines(cur_buf, row_0, row, false)[1] or new_line
          local line_len = #line_now
          if was_insert then
            local target_c = math.min(col, line_len)
            pcall(vim.api.nvim_win_set_cursor, cur_win, { row, target_c })
            if target_c >= line_len then
              pcall(vim.cmd, "startinsert!")
            else
              pcall(vim.cmd, "startinsert")
            end
          else
            local target_c = math.min(col, math.max(0, line_len - 1))
            pcall(vim.api.nvim_win_set_cursor, cur_win, { row, target_c })
            pcall(vim.fn.winrestview, view)
          end
        end

        restore_pos()
        vim.schedule(restore_pos)
      end

      local function clear_all_symbols(target_buf)
        local buf = target_buf or vim.api.nvim_get_current_buf()
        local line_count = vim.api.nvim_buf_line_count(buf)
        local lines = vim.api.nvim_buf_get_lines(buf, 0, line_count, false)
        local changed = false
        for i, l in ipairs(lines) do
          local cleaned = l:gsub("%s*✅", ""):gsub("%s*❎", "")
          if cleaned ~= l then
            lines[i] = cleaned
            changed = true
          end
        end
        if changed then
          vim.api.nvim_buf_set_lines(buf, 0, line_count, false, lines)
          vim.schedule(function() render(buf) end)
        end
      end

      vim.api.nvim_create_user_command("CsvToggle", function()
        toggle_symbol_in_cell()
      end, {})

      vim.api.nvim_create_user_command("CsvClear", function()
        clear_all_symbols()
      end, {})

      local CSV_FTS = { "csv", "tsv", "rfc_csv", "csv_semicolon", "csv_pipe", "csv_whitespace" }
      local GROUP   = vim.api.nvim_create_augroup("CsvBufSettings", { clear = true })

      local function apply_csv_buf(buf)
        if not vim.api.nvim_buf_is_valid(buf) then return end
        local delim = get_delim(buf)

        vim.opt_local.wrap           = false
        vim.opt_local.number         = true
        vim.opt_local.relativenumber = false
        vim.opt_local.cursorline     = true
        vim.opt_local.cursorcolumn   = true
        vim.opt_local.scrolloff      = 3
        vim.opt_local.sidescrolloff  = 10
        vim.opt_local.textwidth      = 0
        vim.opt_local.list           = false
        vim.opt_local.signcolumn     = "no"
        vim.opt_local.conceallevel   = 2
        vim.opt_local.concealcursor = "nc"

        vim.schedule(function() render(buf) end)

        local function get_col_info()
          local row, col = unpack(vim.api.nvim_win_get_cursor(0))
          local cur_line = vim.api.nvim_buf_get_lines(buf, row - 1, row, false)[1] or ""
          local hdr_line = vim.api.nvim_buf_get_lines(buf, 0,       1,   false)[1] or ""
          local cf = parse_fields(cur_line, delim)
          local hf = parse_fields(hdr_line, delim)
          local idx = #cf
          for i, f in ipairs(cf) do
            if col >= f.s and (i == #cf or col < cf[i + 1].s) then
              idx = i; break
            end
          end
          local name = hf[idx] and vim.trim(hf[idx].t) or ("Col " .. idx)
          local val  = cf[idx] and vim.trim(cf[idx].t) or ""
          return idx, name, val
        end

        local function get_cell_at(row_0, col)
          local line = vim.api.nvim_buf_get_lines(buf, row_0, row_0 + 1, false)[1] or ""
          local cf   = parse_fields(line, delim)
          local idx  = #cf
          for i, f in ipairs(cf) do
            if col >= f.s and (i == #cf or col < cf[i + 1].s) then
              idx = i; break
            end
          end
          return idx, cf
        end

        local o = { buffer = buf, silent = true, noremap = true, nowait = true }

        local sep_pat = delim == "\t" and "\t" or vim.fn.escape(delim, "/\\")

        local function jump_next()
          if vim.fn.search(sep_pat, "W") ~= 0 then vim.cmd("normal! l") end
        end
        local function jump_prev()
          if vim.api.nvim_win_get_cursor(0)[2] > 0 then vim.cmd("normal! h") end
          if vim.fn.search(sep_pat, "bW") ~= 0 then
            vim.cmd("normal! l")
          else
            vim.cmd("normal! 0")
          end
        end
        local function jump_down()
          local r, c = unpack(vim.api.nvim_win_get_cursor(0))
          if r < vim.api.nvim_buf_line_count(0) then
            vim.api.nvim_win_set_cursor(0, { r + 1, c })
          end
        end
        local function jump_up()
          local r, c = unpack(vim.api.nvim_win_get_cursor(0))
          if r > 1 then vim.api.nvim_win_set_cursor(0, { r - 1, c }) end
        end

        local function toggle_symbol_in_cell(is_ins_param)
          local was_insert = (is_ins_param == true) or (vim.api.nvim_get_mode().mode:sub(1, 1) == "i")
          local view = vim.fn.winsaveview()
          local cur_buf  = buf or vim.api.nvim_get_current_buf()
          local row, col = view.lnum, view.col
          local row_0    = row - 1
          local idx, cf  = get_cell_at(row_0, col)

          if not cf or #cf == 0 or not cf[idx] then
            return
          end

          local cell = cf[idx]
          local t    = cell.t
          local new_t

          if t:find("✅", 1, true) then
            new_t = t:gsub("%s*✅", "❎")
          elseif t:find("❎", 1, true) then
            new_t = t:gsub("%s*❎", "")
          else
            local trimmed = vim.trim(t)
            new_t = trimmed == "" and "✅" or (trimmed .. " ✅")
          end

          cf[idx].t = new_t

          local cur_delim  = get_delim(cur_buf)
          local new_fields = {}
          for _, f in ipairs(cf) do table.insert(new_fields, f.t) end
          local new_line = table.concat(new_fields, cur_delim)

          vim.api.nvim_buf_set_lines(cur_buf, row_0, row_0 + 1, false, { new_line })
          render(cur_buf)

          local function restore_pos()
            local line_now = vim.api.nvim_buf_get_lines(cur_buf, row_0, row_0 + 1, false)[1] or new_line
            local line_len = #line_now
            if was_insert then
              local target_c = math.min(col, line_len)
              pcall(vim.api.nvim_win_set_cursor, cur_win, { row, target_c })
              if target_c >= line_len then
                pcall(vim.cmd, "startinsert!")
              else
                pcall(vim.cmd, "startinsert")
              end
            else
              local target_c = math.min(col, math.max(0, line_len - 1))
              pcall(vim.api.nvim_win_set_cursor, cur_win, { row, target_c })
              pcall(vim.fn.winrestview, view)
            end
          end

          restore_pos()
          vim.schedule(restore_pos)
        end

        local function clear_all_symbols()
          local line_count = vim.api.nvim_buf_line_count(buf)
          local lines = vim.api.nvim_buf_get_lines(buf, 0, line_count, false)
          local changed = false
          for i, l in ipairs(lines) do
            local cleaned = l:gsub("%s*✅", ""):gsub("%s*❎", "")
            if cleaned ~= l then
              lines[i] = cleaned
              changed = true
            end
          end
          if changed then
            vim.api.nvim_buf_set_lines(buf, 0, line_count, false, lines)
            if ST[buf] then render(buf) end
          end
        end

        local function vis_cell_right()
          local r, c    = unpack(vim.api.nvim_win_get_cursor(0))
          local idx, cf = get_cell_at(r - 1, c)
          local nf      = cf[idx + 1]
          if nf then vim.fn.cursor(r, nf.s + 1) end
        end
        local function vis_cell_left()
          local r, c    = unpack(vim.api.nvim_win_get_cursor(0))
          local idx, cf = get_cell_at(r - 1, c)
          local pf      = cf[idx - 1]
          if pf then vim.fn.cursor(r, pf.s + 1) end
        end
        local function vis_cell_down()
          local r, c   = unpack(vim.api.nvim_win_get_cursor(0))
          local nr     = r + 1
          if nr > vim.api.nvim_buf_line_count(0) then return end
          local idx, _ = get_cell_at(r - 1, c)
          local nline  = vim.api.nvim_buf_get_lines(buf, nr - 1, nr, false)[1] or ""
          local nf     = parse_fields(nline, delim)[idx]
          vim.fn.cursor(nr, (nf and nf.s or c) + 1)
        end
        local function vis_cell_up()
          local r, c   = unpack(vim.api.nvim_win_get_cursor(0))
          local pr     = r - 1
          if pr < 1 then return end
          local idx, _ = get_cell_at(r - 1, c)
          local pline  = vim.api.nvim_buf_get_lines(buf, pr - 1, pr, false)[1] or ""
          local pf     = parse_fields(pline, delim)[idx]
          vim.fn.cursor(pr, (pf and pf.s or c) + 1)
        end

        local o = { buffer = buf, silent = true, noremap = true, nowait = true }

        local function run_toggle(is_ins)
          return function()
            toggle_symbol_in_cell(is_ins)
          end
        end

        vim.keymap.set("n", "<Tab>",       jump_next,             o)
        vim.keymap.set("n", "<S-Tab>",     jump_prev,             o)
        vim.keymap.set("n", "<C-Right>",   jump_next,             o)
        vim.keymap.set("n", "<C-Left>",    jump_prev,             o)
        vim.keymap.set("n", "<leader>x",   run_toggle(false),     o)
        vim.keymap.set("n", "<C-x>",       run_toggle(false),     o)
        vim.keymap.set("i", "<C-x>",       run_toggle(true),      o)
        vim.keymap.set("v", "<C-x>",       run_toggle(false),     o)
        vim.keymap.set("n", "<leader>cx",  run_toggle(false),     o)
        vim.keymap.set("n", "<C-S-x>",     clear_all_symbols,     o)
        vim.keymap.set("n", "<C-X>",       clear_all_symbols,     o)

        vim.keymap.set("x", "l",       vis_cell_right, o)
        vim.keymap.set("x", "h",       vis_cell_left,  o)
        vim.keymap.set("x", "j",       vis_cell_down,  o)
        vim.keymap.set("x", "k",       vis_cell_up,    o)
        vim.keymap.set("x", "<Right>", vis_cell_right, o)
        vim.keymap.set("x", "<Left>",  vis_cell_left,  o)
        vim.keymap.set("x", "<Down>",  vis_cell_down,  o)
        vim.keymap.set("x", "<Up>",    vis_cell_up,    o)
      end

      vim.api.nvim_create_autocmd({ "FileType", "BufEnter", "BufWinEnter" }, {
        group   = GROUP,
        pattern = { "*", "*.csv", "*.tsv" },
        callback = function(ev)
          local ft = vim.bo[ev.buf].filetype
          local fn = vim.api.nvim_buf_get_name(ev.buf)
          if vim.tbl_contains(CSV_FTS, ft) or fn:match("%.csv$") or fn:match("%.tsv$") then
            apply_csv_buf(ev.buf)
          end
        end,
      })

      vim.api.nvim_create_autocmd({ "TextChanged", "BufWritePost" }, {
        group   = GROUP,
        pattern = { "*", "*.csv", "*.tsv" },
        callback = function(ev)
          local ft = vim.bo[ev.buf].filetype
          local fn = vim.api.nvim_buf_get_name(ev.buf)
          if (vim.tbl_contains(CSV_FTS, ft) or fn:match("%.csv$") or fn:match("%.tsv$")) and ST[ev.buf] then
            render(ev.buf)
          end
        end,
      })
    end,
  },

  {
    "dhruvasagar/vim-table-mode",
    cmd  = { "TableModeToggle", "TableModeEnable", "TableModeDisable", "Tableize", "TableSort", "TableModeRealign" },
    keys = {
      { "<leader>tmt", "<cmd>TableModeToggle<CR>",  mode = "n", silent = true, noremap = true },
      { "<leader>tmr", "<cmd>TableModeRealign<CR>", mode = "n", silent = true, noremap = true },
      { "<leader>tms", "<cmd>TableSort<CR>",         mode = "n", silent = true, noremap = true },
      { "<leader>tmz", "<cmd>Tableize<CR>",          mode = "n", silent = true, noremap = true },
    },
    init = function()
      vim.g.table_mode_corner          = "+"
      vim.g.table_mode_header_fillchar = "-"
      vim.g.table_mode_separator       = "|"
      vim.g.table_mode_map_prefix      = "<leader>tm"
      vim.g.table_mode_toggle_map      = "t"
      vim.g.table_mode_realign_map     = "r"
      vim.g.table_mode_sort_map        = "s"
      vim.g.table_mode_auto_align      = 1
      vim.g.table_mode_always_active   = 0
      vim.g.table_mode_verbose         = 0
    end,
  },
}
