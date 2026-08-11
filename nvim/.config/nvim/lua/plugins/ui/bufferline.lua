return {
  {
    "akinsho/bufferline.nvim",
    enabled = false,
  },
  {
    "nvim-lualine/lualine.nvim",
    optional = true,
    opts = function(_, opts)
      local c = {
        bg = "#0a0a0f",
        bg1 = "#0f0f17",
        bg2 = "#13131e",
        bg3 = "#181825",
        inactive_bg = "#2D2E2F",
        text = "#cdd6f4",
        subtext1 = "#bac2de",
        subtext0 = "#a6adc8",
        overlay0 = "#6c7086",
        blue = "#00D4FF",
        lavender = "#b4befe",
        sapphire = "#74c7ec",
        sky = "#89dceb",
        teal = "#94e2d5",
        green = "#a6e3a1",
        yellow = "#f9e2af",
        peach = "#fab387",
        red = "#f38ba8",
        pink = "#f5c2e7",
        mauve = "#cba4f7",
        base = "#1e1e2e",
        white = "#ffffff",
      }

      local mode_color = {
        n = { fg = c.base, bg = c.blue, gui = "bold" },
        i = { fg = c.base, bg = c.green, gui = "bold" },
        v = { fg = c.base, bg = c.mauve, gui = "bold" },
        [""] = { fg = c.base, bg = c.mauve, gui = "bold" },
        V = { fg = c.base, bg = c.mauve, gui = "bold" },
        c = { fg = c.base, bg = c.peach, gui = "bold" },
        s = { fg = c.base, bg = c.teal, gui = "bold" },
        S = { fg = c.base, bg = c.teal, gui = "bold" },
        R = { fg = c.base, bg = c.red, gui = "bold" },
        r = { fg = c.base, bg = c.red, gui = "bold" },
        ["!"] = { fg = c.base, bg = c.yellow, gui = "bold" },
        t = { fg = c.base, bg = c.yellow, gui = "bold" },
      }

      local theme = {
        normal = {
          a = { fg = c.base, bg = c.blue, gui = "bold" },
          b = { fg = c.lavender, bg = c.bg2 },
          c = { fg = c.subtext0, bg = "NONE" },
        },
        insert = {
          a = { fg = c.base, bg = c.green, gui = "bold" },
          b = { fg = c.lavender, bg = c.bg2 },
          c = { fg = c.subtext0, bg = "NONE" },
        },
        visual = {
          a = { fg = c.base, bg = c.mauve, gui = "bold" },
          b = { fg = c.lavender, bg = c.bg2 },
          c = { fg = c.subtext0, bg = "NONE" },
        },
        replace = {
          a = { fg = c.base, bg = c.red, gui = "bold" },
          b = { fg = c.lavender, bg = c.bg2 },
          c = { fg = c.subtext0, bg = "NONE" },
        },
        command = {
          a = { fg = c.base, bg = c.peach, gui = "bold" },
          b = { fg = c.lavender, bg = c.bg2 },
          c = { fg = c.subtext0, bg = "NONE" },
        },
        terminal = {
          a = { fg = c.base, bg = c.yellow, gui = "bold" },
          b = { fg = c.lavender, bg = c.bg2 },
          c = { fg = c.subtext0, bg = "NONE" },
        },
        inactive = {
          a = { fg = c.overlay0, bg = "NONE" },
          b = { fg = c.overlay0, bg = "NONE" },
          c = { fg = c.overlay0, bg = "NONE" },
        },
      }

      opts.options = vim.tbl_deep_extend("force", opts.options or {}, {
        globalstatus = true,
        always_divide_middle = false,
        section_separators = { left = "", right = "" },
        component_separators = { left = "", right = "" },
        theme = theme,
        disabled_filetypes = { winbar = { "alpha", "dashboard", "neo-tree", "Trouble", "lazy", "mason", "terminal", "toggleterm" } },
      })

      vim.o.cmdheight = 2
      opts.tabline = nil

      opts.winbar = {
        lualine_c = {
          {
            "buffers",
            cond = function()
              for _, b in ipairs(vim.api.nvim_list_bufs()) do
                if vim.bo[b].buflisted then
                  local name = vim.api.nvim_buf_get_name(b)
                  local bt = vim.bo[b].buftype
                  if name ~= "" and bt ~= "terminal" and vim.fn.isdirectory(name) == 0 then
                    return true
                  end
                end
              end
              return false
            end,
            show_filename_only = true,
            show_modified_status = true,
            mode = 0,
            max_length = function()
              return vim.o.columns * 0.9
            end,
            filetype_names = {
              snacks_dashboard = " Home",
              snacks_explorer = " Files",
              ["neo-tree"] = " Tree",
            },
            symbols = {
              modified = " ●",
              alternate_file = "",
              directory = " ",
            },
            buffers_color = {
              active = { fg = c.base, bg = c.blue, gui = "bold" },
              inactive = { fg = c.subtext0, bg = c.bg3 },
            },
            separator = { left = "", right = "" },
            padding = 1,
          },
        },
      }

      opts.sections = {
        lualine_a = {
          {
            "mode",
            color = function()
              return mode_color[vim.fn.mode()] or mode_color["n"]
            end,
            fmt = function(str)
              local icons = {
                NORMAL = "󰋜 NORMAL",
                INSERT = "󰏫 INSERT",
                VISUAL = "󰈈 VISUAL",
                ["V-LINE"] = "󰈈 V-LINE",
                ["V-BLOCK"] = "󰈈 V-BLOCK",
                COMMAND = " COMMAND",
                TERMINAL = " TERMINAL",
                REPLACE = "󰄾 REPLACE",
                SELECT = "󰒅 SELECT",
              }
              return icons[str] or ("  " .. str)
            end,
            separator = { left = "", right = "" },
          },
          {
            function()
              local reg = vim.fn.reg_recording()
              if reg ~= "" then
                return "󰑋 @" .. reg
              end
              return ""
            end,
            color = { fg = c.yellow, bg = c.bg2, gui = "bold" },
            separator = { right = "" },
          },
        },
        lualine_b = {
          {
            "branch",
            icon = "",
            color = { fg = c.lavender, bg = c.bg2, gui = "bold" },
            separator = { right = "" },
          },
          {
            "diff",
            symbols = { added = " ", modified = " ", removed = " " },
            diff_color = {
              added = { fg = c.green, bg = c.bg2 },
              modified = { fg = c.yellow, bg = c.bg2 },
              removed = { fg = c.red, bg = c.bg2 },
            },
            color = { bg = c.bg2 },
            separator = { right = "" },
          },
        },
        lualine_c = {
          {
            function()
              return ""
            end,
          },
        },
        lualine_x = {
          {
            function()
              if vim.v.hlsearch == 0 then
                return ""
              end
              local ok, res = pcall(vim.fn.searchcount, { maxcount = 999, timeout = 80 })
              if not ok or not res or res.total == 0 then
                return ""
              end
              return "󰍉 " .. res.current .. "/" .. res.total
            end,
            color = { fg = c.yellow, bg = c.bg2 },
            separator = { left = "" },
          },
          {
            function()
              local get = vim.lsp.get_clients or vim.lsp.get_active_clients
              local names = {}
              for _, client in ipairs(get({ bufnr = 0 })) do
                if client.name ~= "null-ls" and client.name ~= "copilot" then
                  table.insert(names, client.name)
                end
              end
              if #names == 0 then
                return "󰅚 no lsp"
              end
              return "󰒋 " .. table.concat(names, " + ")
            end,
            color = { fg = c.sapphire, bg = c.bg2 },
            separator = { left = "" },
          },
          {
            function()
              local ok, p = pcall(require, "nvim-treesitter.parsers")
              if ok and p.has_parser() then
                return "󰙅 TS"
              end
              return ""
            end,
            color = { fg = c.teal, bg = c.bg2 },
            separator = { left = "" },
          },
          {
            function()
              local get = vim.lsp.get_clients or vim.lsp.get_active_clients
              for _, client in ipairs(get({ bufnr = 0 })) do
                if client.name == "copilot" then
                  return " AI"
                end
              end
              return ""
            end,
            color = { fg = c.mauve, bg = c.bg2, gui = "bold" },
            separator = { left = "" },
          },
          {
            "diagnostics",
            sources = { "nvim_lsp", "nvim_diagnostic" },
            sections = { "error", "warn", "info", "hint" },
            symbols = { error = " ", warn = " ", info = " ", hint = "󰌵 " },
            diagnostics_color = {
              error = { fg = c.red, bg = c.bg2 },
              warn = { fg = c.yellow, bg = c.bg2 },
              info = { fg = c.sky, bg = c.bg2 },
              hint = { fg = c.teal, bg = c.bg2 },
            },
            color = { bg = c.bg2 },
            separator = { left = "" },
          },
          {
            "filetype",
            colored = true,
            icon_only = false,
            color = { fg = c.subtext1, bg = c.bg2, gui = "bold" },
            separator = { left = "" },
          },
        },
        lualine_y = {
          {
            function()
              if vim.bo.expandtab then
                return "󱁐 " .. vim.bo.shiftwidth .. " sp"
              else
                return "󰌒 " .. vim.bo.tabstop .. " tab"
              end
            end,
            color = { fg = c.subtext0, bg = c.bg2 },
            separator = { left = "" },
          },
          {
            "encoding",
            fmt = function(str)
              return str ~= "utf-8" and str:upper() or ""
            end,
            color = { fg = c.overlay0, bg = c.bg2 },
          },
          {
            "fileformat",
            symbols = { unix = " LF", dos = " CRLF", mac = " CR" },
            color = { fg = c.overlay0, bg = c.bg2 },
          },
          {
            function()
              local file = vim.fn.expand("%:p")
              if file == "" then
                return ""
              end
              local size = vim.fn.getfsize(file)
              if size <= 0 then
                return ""
              end
              local units, i = { "B", "KB", "MB", "GB" }, 1
              while size >= 1024 and i < 4 do
                size = size / 1024
                i = i + 1
              end
              return string.format("󰙱 %.1f%s", size, units[i])
            end,
            color = { fg = c.overlay0, bg = c.bg2 },
          },
          {
            function()
              local mode = vim.fn.mode()
              if mode ~= "v" and mode ~= "V" and mode ~= "\22" then
                return ""
              end
              local vs = vim.fn.getpos("v")
              local vc = vim.fn.getpos(".")
              local lines = math.abs(vc[2] - vs[2]) + 1
              local cols = math.abs(vc[3] - vs[3]) + 1
              if lines > 1 then
                return "󰆙 " .. lines .. "L " .. cols .. "C"
              end
              return "󰆙 " .. cols .. "C"
            end,
            color = { fg = c.mauve, bg = c.bg2, gui = "bold" },
            separator = { left = "" },
          },
          {
            "progress",
            color = { fg = c.subtext1, bg = c.bg2, gui = "bold" },
            fmt = function(str)
              return "󰉸 " .. str
            end,
            separator = { left = "" },
          },
        },
        lualine_z = {
          {
            "location",
            color = { fg = c.base, bg = c.blue, gui = "bold" },
            fmt = function(str)
              return " " .. str
            end,
            separator = { left = "", right = "" },
          },
        },
      }

      opts.inactive_sections = {
        lualine_a = {},
        lualine_b = {},
        lualine_c = {
          { "filename", path = 1, color = { fg = c.overlay0, bg = "NONE" } },
        },
        lualine_x = {
          { "location", color = { fg = c.overlay0, bg = "NONE" } },
        },
        lualine_y = {},
        lualine_z = {},
      }

      vim.api.nvim_set_hl(0, "LualineBuffersActiveSeparator", { fg = c.blue, bg = "NONE" })
      vim.api.nvim_set_hl(0, "LualineBuffersInactiveSeparator", { fg = c.bg3, bg = "NONE" })

      return opts
    end,
  },
}
