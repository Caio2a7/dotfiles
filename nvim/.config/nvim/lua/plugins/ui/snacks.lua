local clipboard = {
  files = {},
  mode = nil,
}

return {
  "folke/snacks.nvim",
  priority = 1000,
  lazy = false,
  dependencies = { "neopywal" },
  keys = {
    {
      "<C-g>",
      function()
        Snacks.lazygit()
      end,
      desc = "Lazygit",
    },
    {
      "<C-b>",
      function()
        Snacks.picker.buffers()
      end,
      mode = { "n", "i", "v" },
      desc = "Buffers",
    },
  },
  opts = {
    dashboard = {
      enabled = false, 
    },
    lazygit = {
      configure = true,
      win = {
        style = "float",
        border = "rounded",
        width = 0.9,
        height = 0.9,
      },
    },
    explorer = {
      replace_netrw = false,
    },
    picker = {
      actions = {
        focus_list_top = function(picker)
          picker:focus("list")
          vim.schedule(function()
            vim.cmd("normal! gg")
          end)
        end,
        focus_input = function(picker)
          picker:focus("input")
          vim.cmd("startinsert")
        end,
        open_background = function(picker, item)
          if item then
            local win_id = picker.main
            if win_id and vim.api.nvim_win_is_valid(win_id) then
              vim.api.nvim_win_call(win_id, function()
                vim.cmd("edit " .. vim.fn.fnameescape(item.file))
              end)
            end
          end
        end,
        set_copy = function(picker, item)
          local items = picker:selected()
          if #items == 0 and item then
            items = { item }
          end
          if #items > 0 then
            clipboard.files = {}
            local count = 0
            for _, i in ipairs(items) do
              if i and i.file then
                table.insert(clipboard.files, i.file)
                count = count + 1
              end
            end
            if count > 0 then
              clipboard.mode = "copy"
              Snacks.notify.info("Copiado(s) " .. count .. " item(ns).\n(Vá ao destino e aperte 'p')")
            end
          end
        end,
        toggle_move = function(picker, item)
          if clipboard.files and #clipboard.files > 0 and clipboard.mode == "move" then
            picker.opts.actions.execute_paste(picker, item)
          else
            local items = picker:selected()
            if #items == 0 and item then
              items = { item }
            end
            if #items > 0 then
              clipboard.files = {}
              local count = 0
              for _, i in ipairs(items) do
                if i and i.file then
                  table.insert(clipboard.files, i.file)
                  count = count + 1
                end
              end
              if count > 0 then
                clipboard.mode = "move"
                Snacks.notify.info("Recortado(s) " .. count .. " item(ns).\n(Vá ao destino e aperte 'm' ou 'p')")
              end
            end
          end
        end,
        execute_paste = function(picker, item)
          if not clipboard.files or #clipboard.files == 0 or not clipboard.mode then
            Snacks.notify.warn("Nada na área de transferência. Use 'c' ou 'm' primeiro.")
            return
          end
          if not item then
            return
          end
          local dest_dir = item.file
          if vim.fn.isdirectory(item.file) == 0 then
            dest_dir = vim.fn.fnamemodify(item.file, ":h")
          end
          local count_success = 0
          local total = #clipboard.files
          for _, src in ipairs(clipboard.files) do
            local filename = vim.fn.fnamemodify(src, ":t")
            local dest_path = dest_dir .. "/" .. filename
            if src ~= dest_path then
              if clipboard.mode == "copy" then
                local cmd = string.format("cp -r %s %s", vim.fn.shellescape(src), vim.fn.shellescape(dest_path))
                local result = vim.fn.system(cmd)
                if vim.v.shell_error == 0 then
                  count_success = count_success + 1
                else
                  Snacks.notify.error("Erro ao copiar " .. filename .. ": " .. result)
                end
              elseif clipboard.mode == "move" then
                local success = vim.loop.fs_rename(src, dest_path)
                if success then
                  count_success = count_success + 1
                else
                  Snacks.notify.error("Erro ao mover " .. filename)
                end
              end
            end
          end
          if count_success > 0 then
            Snacks.notify.info(count_success .. " de " .. total .. " arquivo(s) processado(s).")
            if clipboard.mode == "move" then
              clipboard.files = {}
              clipboard.mode = nil
            end
            picker:find()
          end
        end,
        system_open = function(picker, item)
          if item then
            vim.ui.open(item.file)
          end
        end,
        copy_path_clip = function(picker, item)
          if item then
            vim.fn.setreg("+", item.file)
            Snacks.notify.info("Path copiado: " .. item.file)
          end
        end,
      },
      sources = {
        explorer = {
          hidden = true,
          ignored = true,
          exclude = { "node_modules", ".git" },
          layout = { preset = "default", preview = false },
          win = {
            input = {
              keys = {
                ["h"] = { "focus_list_top", mode = { "n" } },
              },
            },
            list = {
              keys = {
                ["s"] = { "focus_input", mode = { "n" } },
                ["h"] = { "focus_list_top", mode = { "n" } },
                ["<Tab>"] = { "confirm", mode = { "n" } },
                ["<S-Tab>"] = { "toggle_select", mode = { "n" } },
                ["<CR>"] = { "open_background", mode = { "n", "i" } },
                ["<Esc>"] = { "close", mode = { "n", "i" } },
                ["q"] = { "close", mode = { "n", "i" } },
                ["a"] = { "explorer_add", mode = { "n", "i" } },
                ["r"] = { "explorer_rename", mode = { "n", "i" } },
                ["c"] = { "set_copy", mode = { "n", "i" } },
                ["m"] = { "toggle_move", mode = { "n", "i" } },
                ["p"] = { "execute_paste", mode = { "n", "i" } },
                ["x"] = { "system_open", mode = { "n", "i" } },
                ["i"] = { "inspect", mode = { "n", "i" } },
                ["y"] = { "copy_path_clip", mode = { "n", "i" } },
              },
            },
          },
        },
      },
    },
  },
}
