return {
  {
    "kevalin/mermaid.nvim",
    dependencies = { "nvim-treesitter/nvim-treesitter" },
    ft = { "markdown", "rmd", "mermaid" },
    opts = {
      preview = {
        renderer = "beautiful-mermaid",
        theme = "tokyo-night",
      },
    },
    config = function(_, opts)
      require("mermaid").setup(opts)

      local ns = vim.api.nvim_create_namespace("MermaidBoxRenderer")
      local cache = {}
      local timers = {}
      local enabled = true

      -- Paleta Tokyo Night para elementos do diagrama
      local function setup_highlights()
        vim.api.nvim_set_hl(0, "MermaidBorder", { fg = "#7aa2f7", bold = false })
        vim.api.nvim_set_hl(0, "MermaidArrow",  { fg = "#bb9af7", bold = true })
        vim.api.nvim_set_hl(0, "MermaidLabel",  { fg = "#c0caf5", bold = true })
        vim.api.nvim_set_hl(0, "MermaidHeader", { fg = "#7dcfff", bold = true })
        vim.api.nvim_set_hl(0, "MermaidBar",    { fg = "#3b4261" })
      end
      setup_highlights()

      local border_chars = {
        ["┌"] = true, ["┐"] = true, ["└"] = true, ["┘"] = true,
        ["│"] = true, ["─"] = true, ["├"] = true, ["┤"] = true,
        ["┬"] = true, ["┴"] = true, ["┼"] = true,
        ["╭"] = true, ["╮"] = true, ["╰"] = true, ["╯"] = true,
      }
      local arrow_chars = {
        ["►"] = true, ["◄"] = true, ["▲"] = true, ["▼"] = true,
        ["▶"] = true, ["◀"] = true, ["→"] = true, ["←"] = true,
      }

      local function parse_box_chunks(line, pad)
        local chunks = {}
        if pad and pad > 0 then
          table.insert(chunks, { string.rep(" ", pad), "Normal" })
        end
        local cur_text = ""
        local cur_type = nil
        local uchar_pat = "[%z\1-\127\194-\244][\128-\191]*"

        for char in line:gmatch(uchar_pat) do
          local ctype = "label"
          if border_chars[char] or char == "─" then
            ctype = "border"
          elseif arrow_chars[char] then
            ctype = "arrow"
          elseif char == " " then
            ctype = "space"
          end

          if ctype == cur_type then
            cur_text = cur_text .. char
          else
            if #cur_text > 0 then
              local hl = "MermaidLabel"
              if cur_type == "border" then hl = "MermaidBorder"
              elseif cur_type == "arrow" then hl = "MermaidArrow"
              elseif cur_type == "space" then hl = "Normal" end
              table.insert(chunks, { cur_text, hl })
            end
            cur_text = char
            cur_type = ctype
          end
        end

        if #cur_text > 0 then
          local hl = "MermaidLabel"
          if cur_type == "border" then hl = "MermaidBorder"
          elseif cur_type == "arrow" then hl = "MermaidArrow"
          elseif cur_type == "space" then hl = "Normal" end
          table.insert(chunks, { cur_text, hl })
        end

        return chunks
      end

      -- Renderiza código mermaid puro via mermaid-ascii
      local function render_mermaid_ascii(content)
        if not content or content:match("^%s*$") then return nil end
        if cache[content] then return cache[content] end

        local bin = "/home/caio/.local/bin/mermaid-ascii"
        if vim.fn.executable(bin) ~= 1 then
          bin = "mermaid-ascii"
        end
        if vim.fn.executable(bin) ~= 1 then return nil end

        local output = vim.fn.system({ bin }, content)
        if vim.v.shell_error ~= 0 or not output or output:match("^%s*$") then
          return nil
        end

        local lines = vim.split(output, "\n", { trimempty = true })
        cache[content] = lines
        return lines
      end

      -- Encontra blocos ```mermaid
      local function find_mermaid_blocks(bufnr)
        local lines = vim.api.nvim_buf_get_lines(bufnr, 0, -1, false)
        local blocks = {}
        local in_block = false
        local cur_start = nil

        for i, line in ipairs(lines) do
          if not in_block and line:match("^%s*```+mermaid") then
            in_block = true
            cur_start = i
          elseif in_block and line:match("^%s*```+%s*$") then
            in_block = false
            local code_lines = {}
            for j = cur_start + 1, i - 1 do
              table.insert(code_lines, lines[j])
            end
            local code = table.concat(code_lines, "\n")
            table.insert(blocks, {
              start_line = cur_start, -- 1-indexed
              end_line = i,           -- 1-indexed
              code = code,
            })
          end
        end

        return blocks
      end

      local function get_current_mermaid_block(bufnr)
        bufnr = bufnr or vim.api.nvim_get_current_buf()
        local ft = vim.bo[bufnr].filetype
        local lines = vim.api.nvim_buf_get_lines(bufnr, 0, -1, false)

        if ft == "mermaid" then
          return {
            start_line = 1,
            end_line = #lines,
            code = table.concat(lines, "\n"),
          }
        end

        local cursor_line = vim.api.nvim_win_get_cursor(0)[1]
        local blocks = find_mermaid_blocks(bufnr)
        if #blocks == 0 then return nil end

        for _, b in ipairs(blocks) do
          if cursor_line >= b.start_line and cursor_line <= b.end_line then
            return b
          end
        end

        local best = blocks[1]
        local min_dist = math.huge
        for _, b in ipairs(blocks) do
          local dist = math.min(math.abs(cursor_line - b.start_line), math.abs(cursor_line - b.end_line))
          if dist < min_dist then
            min_dist = dist
            best = b
          end
        end
        return best
      end

      -- Renderização inline no buffer
      local function render_buffer_inline(bufnr)
        if not enabled then return end
        bufnr = bufnr or vim.api.nvim_get_current_buf()
        if not vim.api.nvim_buf_is_valid(bufnr) then return end
        local ft = vim.bo[bufnr].filetype
        if ft ~= "markdown" and ft ~= "rmd" and ft ~= "mermaid" then return end

        vim.api.nvim_buf_clear_namespace(bufnr, ns, 0, -1)

        local blocks = {}
        if ft == "mermaid" then
          local total_lines = vim.api.nvim_buf_line_count(bufnr)
          table.insert(blocks, {
            start_line = 1,
            end_line = total_lines,
            code = table.concat(vim.api.nvim_buf_get_lines(bufnr, 0, -1, false), "\n"),
          })
        else
          blocks = find_mermaid_blocks(bufnr)
        end

        for _, block in ipairs(blocks) do
          local rendered = render_mermaid_ascii(block.code)
          if rendered and #rendered > 0 then
            local max_w = 40
            for _, rl in ipairs(rendered) do
              local w = vim.fn.strdisplaywidth(rl)
              if w > max_w then max_w = w end
            end

            local virt_lines = {}
            table.insert(virt_lines, {
              { "  󰡷 Diagrama Mermaid ", "MermaidHeader" },
              { string.rep("─", math.max(10, max_w - 18)), "MermaidBar" },
            })
            for _, rline in ipairs(rendered) do
              local chunks = parse_box_chunks(rline, 2)
              table.insert(virt_lines, chunks)
            end
            table.insert(virt_lines, {
              { "  " .. string.rep("─", max_w + 4), "MermaidBar" },
            })

            local target_line = math.min(block.end_line - 1, vim.api.nvim_buf_line_count(bufnr) - 1)
            if target_line >= 0 then
              pcall(vim.api.nvim_buf_set_extmark, bufnr, ns, target_line, 0, {
                virt_lines = virt_lines,
                virt_lines_above = false,
              })
            end
          end
        end
      end

      local function debounce_render(bufnr, delay_ms)
        delay_ms = delay_ms or 200
        if timers[bufnr] then
          timers[bufnr]:stop()
          if not timers[bufnr]:is_closing() then timers[bufnr]:close() end
          timers[bufnr] = nil
        end

        local timer = vim.uv.new_timer()
        timers[bufnr] = timer
        timer:start(delay_ms, 0, vim.schedule_wrap(function()
          if vim.api.nvim_buf_is_valid(bufnr) then
            render_buffer_inline(bufnr)
          end
          if timers[bufnr] == timer then
            timer:stop()
            if not timer:is_closing() then timer:close() end
            timers[bufnr] = nil
          end
        end))
      end

      -- Modal / Janela Flutuante com o Diagrama Formatado
      local function show_mermaid_popup()
        local block = get_current_mermaid_block()
        if not block or not block.code or block.code:match("^%s*$") then
          vim.notify("Nenhum bloco Mermaid encontrado no cursor.", vim.log.levels.WARN, { title = "Mermaid" })
          return
        end

        local rendered = render_mermaid_ascii(block.code)
        if not rendered or #rendered == 0 then
          vim.notify("Não foi possível renderizar o diagrama Mermaid.", vim.log.levels.ERROR, { title = "Mermaid" })
          return
        end

        local max_width = 0
        for _, l in ipairs(rendered) do
          local len = vim.fn.strdisplaywidth(l)
          if len > max_width then max_width = len end
        end

        local width = math.min(math.max(max_width + 4, 40), vim.o.columns - 4)
        local height = math.min(#rendered + 2, vim.o.lines - 4)
        local row = math.floor((vim.o.lines - height) / 2)
        local col = math.floor((vim.o.columns - width) / 2)

        local float_buf = vim.api.nvim_create_buf(false, true)
        vim.bo[float_buf].bufhidden = "wipe"
        vim.api.nvim_buf_set_lines(float_buf, 0, -1, false, rendered)

        local float_ns = vim.api.nvim_create_namespace("MermaidPopupHl")
        for line_idx, rline in ipairs(rendered) do
          local col_start = 0
          local uchar_pat = "[%z\1-\127\194-\244][\128-\191]*"
          for char in rline:gmatch(uchar_pat) do
            local hl = "MermaidLabel"
            if border_chars[char] or char == "─" then
              hl = "MermaidBorder"
            elseif arrow_chars[char] then
              hl = "MermaidArrow"
            elseif char == " " then
              hl = "Normal"
            end
            local byte_len = #char
            vim.api.nvim_buf_set_extmark(float_buf, float_ns, line_idx - 1, col_start, {
              end_col = col_start + byte_len,
              hl_group = hl,
            })
            col_start = col_start + byte_len
          end
        end

        local float_win = vim.api.nvim_open_win(float_buf, true, {
          relative = "editor",
          width = width,
          height = height,
          row = row,
          col = col,
          style = "minimal",
          border = "rounded",
          title = " 󰡷 Diagrama Mermaid ",
          title_pos = "center",
          footer = " [q] Fechar | [y] Copiar ASCII | [b] Navegador ",
          footer_pos = "center",
        })

        local function close_win()
          if vim.api.nvim_win_is_valid(float_win) then
            vim.api.nvim_win_close(float_win, true)
          end
        end

        local opts_k = { buffer = float_buf, silent = true, nowait = true }
        vim.keymap.set("n", "q", close_win, opts_k)
        vim.keymap.set("n", "<Esc>", close_win, opts_k)
        vim.keymap.set("n", "y", function()
          vim.fn.setreg("+", table.concat(rendered, "\n"))
          vim.notify("Diagrama ASCII copiado para a área de transferência!", vim.log.levels.INFO, { title = "Mermaid" })
        end, opts_k)
        vim.keymap.set("n", "b", function()
          close_win()
          pcall(vim.cmd, "MermaidPreview")
        end, opts_k)
      end

      -- Converter bloco para ASCII inline no texto
      local function convert_block_to_ascii()
        local bufnr = vim.api.nvim_get_current_buf()
        local block = get_current_mermaid_block(bufnr)
        if not block then return end

        local rendered = render_mermaid_ascii(block.code)
        if not rendered or #rendered == 0 then return end

        local formatted_lines = { "```" }
        for _, l in ipairs(rendered) do
          table.insert(formatted_lines, l)
        end
        table.insert(formatted_lines, "```")

        vim.api.nvim_buf_set_lines(bufnr, block.start_line - 1, block.end_line, false, formatted_lines)
        vim.notify("Bloco Mermaid convertido em ASCII!", vim.log.levels.INFO, { title = "Mermaid" })
      end

      -- Comandos do usuário
      vim.api.nvim_create_user_command("MermaidPopup", show_mermaid_popup, { desc = "Exibir diagrama Mermaid em popup flutuante" })
      vim.api.nvim_create_user_command("MermaidToAscii", convert_block_to_ascii, { desc = "Converter bloco Mermaid sob o cursor para ASCII no documento" })
      vim.api.nvim_create_user_command("MermaidToggle", function()
        enabled = not enabled
        local bufnr = vim.api.nvim_get_current_buf()
        if not enabled then
          vim.api.nvim_buf_clear_namespace(bufnr, ns, 0, -1)
          vim.notify("Renderização inline de Mermaid desativada", vim.log.levels.INFO, { title = "Mermaid" })
        else
          render_buffer_inline(bufnr)
          vim.notify("Renderização inline de Mermaid ativada", vim.log.levels.INFO, { title = "Mermaid" })
        end
      end, { desc = "Alternar renderização inline de Mermaid" })

      -- Autocomandos para atualização automática dos diagramas
      local grp = vim.api.nvim_create_augroup("MermaidAutoRender", { clear = true })
      vim.api.nvim_create_autocmd({ "FileType", "BufEnter", "BufWinEnter" }, {
        group = grp,
        pattern = { "markdown", "rmd", "mermaid" },
        callback = function(ev)
          setup_highlights()
          debounce_render(ev.buf, 50)
        end,
      })

      vim.api.nvim_create_autocmd({ "TextChanged", "TextChangedI" }, {
        group = grp,
        pattern = { "*.md", "*.markdown", "*.rmd", "*.mmd", "*.mermaid" },
        callback = function(ev)
          debounce_render(ev.buf, 200)
        end,
      })

      -- Atalhos de teclado práticos
      local function bind_keys(bufnr)
        local km_opts = { buffer = bufnr, silent = true }
        vim.keymap.set("n", ";mp", show_mermaid_popup, vim.tbl_extend("force", km_opts, { desc = "Mermaid: Popup do Diagrama" }))
        vim.keymap.set("n", ";mr", function() render_buffer_inline(bufnr) end, vim.tbl_extend("force", km_opts, { desc = "Mermaid: Atualizar Render Inline" }))
        vim.keymap.set("n", ";mt", "<cmd>MermaidToggle<CR>", vim.tbl_extend("force", km_opts, { desc = "Mermaid: Alternar Render Inline" }))
        vim.keymap.set("n", ";ma", convert_block_to_ascii, vim.tbl_extend("force", km_opts, { desc = "Mermaid: Converter em ASCII" }))
        vim.keymap.set("n", ";mb", "<cmd>MermaidPreview<CR>", vim.tbl_extend("force", km_opts, { desc = "Mermaid: Live Preview no Navegador" }))

        vim.keymap.set("n", "<leader>mp", show_mermaid_popup, vim.tbl_extend("force", km_opts, { desc = "Mermaid: Popup do Diagrama" }))
        vim.keymap.set("n", "<leader>mt", "<cmd>MermaidToggle<CR>", vim.tbl_extend("force", km_opts, { desc = "Mermaid: Alternar Render Inline" }))
      end

      vim.api.nvim_create_autocmd("FileType", {
        group = grp,
        pattern = { "markdown", "rmd", "mermaid" },
        callback = function(ev)
          bind_keys(ev.buf)
        end,
      })

      local cur_buf = vim.api.nvim_get_current_buf()
      local cur_ft = vim.bo[cur_buf].filetype
      if cur_ft == "markdown" or cur_ft == "rmd" or cur_ft == "mermaid" then
        bind_keys(cur_buf)
        debounce_render(cur_buf, 50)
      end
    end,
  },
}
