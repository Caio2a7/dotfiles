return {
  {
    "stevearc/oil.nvim",
    lazy = false,
    dependencies = { "nvim-tree/nvim-web-devicons" },
    keys = {
      { "<C-o>", "<CMD>Oil<CR>", desc = "Open Parent Directory (Oil)" },
    },
    config = function()
      local oil = require("oil")
      local external_extensions = {
        ["png"] = true, ["jpg"] = true, ["jpeg"] = true, ["gif"] = true, ["webp"] = true, ["svg"] = true, ["ico"] = true,
        ["pdf"] = true, ["epub"] = true, ["docx"] = true, ["xlsx"] = true, ["pptx"] = true,
        ["mp4"] = true, ["mkv"] = true, ["avi"] = true, ["mov"] = true, ["mp3"] = true, ["wav"] = true,
        ["zip"] = true, ["rar"] = true, ["7z"] = true,
      }

      oil.setup({
        default_file_explorer = false,
        -- Ativamos para evitar erros de parser em edições simples
        skip_confirm_for_simple_edits = true, 
        columns = {
          "permissions",
          "size",
          "mtime",
          "icon",
        },
        keymaps = {
          ["<CR>"] = {
            callback = function()
              local entry = oil.get_cursor_entry()
              local dir = oil.get_current_dir()
              if not entry or not dir or entry.type == "directory" then
                require("oil.actions").select.callback()
                return
              end
              local name = entry.name
              local ext = name:match("^.+%.(.+)$")
              if ext and external_extensions[ext:lower()] then
                local path = dir .. name
                local cmd = vim.fn.has("mac") == 1 and "open" or (vim.fn.has("win32") == 1 and "start" or "xdg-open")
                vim.fn.jobstart({ cmd, path }, { detach = true })
              else
                require("oil.actions").select.callback()
              end
            end,
          },
          ["<C-c>"] = "actions.close",
          ["<C-r>"] = "actions.refresh",
          ["-"] = "actions.parent",
          ["<BS>"] = "actions.parent",
        },
      })

      -- Cores para o Oil
      vim.api.nvim_set_hl(0, "OilDelete", { fg = "#FF0000", bold = true })
      vim.api.nvim_set_hl(0, "OilMove", { fg = "#FF8C00", bold = true })
      vim.api.nvim_set_hl(0, "OilCreate", { fg = "#00FF00", bold = true })

      -- NOVA LÓGICA: Interceptar a janela de confirmação de forma segura
      vim.api.nvim_create_autocmd("BufWinEnter", {
        pattern = "*",
        callback = function()
          -- Verifica se o buffer atual é a janela de confirmação do Oil
          if vim.bo.filetype == "oil_preview" or vim.api.nvim_buf_get_name(0):match("oil_preview") then
            local lines = vim.api.nvim_buf_get_lines(0, 0, -1, false)
            local has_delete = false
            
            for _, line in ipairs(lines) do
              -- No Oil, deleções são marcadas com " / " (de -> para) onde o destino é vazio ou explicitamente DELETE
              if line:lower():match("delete") or line:match("^%s*%-") then
                has_delete = true
                break
              end
            end

            if not has_delete then
              -- Usa schedule para não travar o processo de renderização do buffer
              vim.schedule(function()
                if vim.api.nvim_get_current_buf() == vim.api.nvim_get_current_buf() then
                  vim.api.nvim_feedkeys("y", "t", true)
                end
              end)
            end
          end
        end,
      })

      -- Fix para manter cursor no nome
      vim.api.nvim_create_autocmd("CursorMoved", {
        pattern = "oil://*",
        callback = function()
          local cursor = vim.api.nvim_win_get_cursor(0)
          local line = vim.api.nvim_get_current_line()
          local entry = oil.get_cursor_entry()
          if entry and entry.name then
            local name_start_col = string.find(line, entry.name, 1, true)
            if name_start_col then
              local target_col = name_start_col - 1
              if cursor[2] < target_col then
                vim.api.nvim_win_set_cursor(0, { cursor[1], target_col })
              end
            end
          end
        end,
      })
    end,
  },
}
