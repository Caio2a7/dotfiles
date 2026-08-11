return {
  {
    "folke/flash.nvim",
    enabled = true,
    opts = {
      modes = { char = { enabled = false } },
    },
    keys = {
      { "s", mode = { "n", "x", "o" }, false },
      { "S", mode = { "n", "x", "o" }, false },
    },
  },

  {
    "kevinhwang91/nvim-hlslens",
    event = "BufRead",
    opts = {
      calm_down = true,
      nearest_only = true,
      nearest_float_when = "always",
    },
    keys = {
      { "n", [[<Cmd>execute('normal! ' .. v:count1 .. 'n')<CR><Lua>require('hlslens').start()<CR>]] },
      { "N", [[<Cmd>execute('normal! ' .. v:count1 .. 'N')<CR><Lua>require('hlslens').start()<CR>]] },
      { "*", [[*<Lua>require('hlslens').start()<CR>]] },
      { "#", [[#<Lua>require('hlslens').start()<CR>]] },
      { "g*", [[g*<Lua>require('hlslens').start()<CR>]] },
      { "g#", [[g#<Lua>require('hlslens').start()<CR>]] },
    },
  },

  {
    "ibhagwan/fzf-lua",
    dependencies = { "nvim-tree/nvim-web-devicons" },
    opts = {},
  },

  {
    "folke/snacks.nvim",
    keys = {
      { "<C-p>", function() Snacks.picker.projects() end, desc = "Projects", mode = { "n", "i", "v" } },
    },
  },

  {
    "AstroNvim/astrocore",
    opts = function()
      local map = vim.keymap.set

      vim.opt.incsearch = true
      _G.strict_search_mode = false

      vim.schedule(function()
        map("c", "<CR>", function()
          if _G.strict_search_mode and vim.fn.getcmdtype() == "/" then
            _G.strict_search_mode = false
            return "<CR><Cmd>nohl<CR>"
          end
          return "<CR>"
        end, { expr = true })

        map("c", "<Esc>", function()
          if _G.strict_search_mode then
            _G.strict_search_mode = false
          end
          return "<Esc>"
        end, { expr = true })

        map({ "n", "i", "v" }, "<M-r>", "<cmd>FzfLua command_history<cr>", { desc = "Command History" })
        map({ "n", "i", "v" }, "<M-h>", "<cmd>FzfLua help_tags<cr>", { desc = "Help Tags" })

        map("c", "<Down>", function()
          return (vim.fn.getcmdtype() == "/" or vim.fn.getcmdtype() == "?") and "<C-g>" or "<Down>"
        end, { expr = true })
        map("c", "<Up>", function()
          return (vim.fn.getcmdtype() == "/" or vim.fn.getcmdtype() == "?") and "<C-t>" or "<Up>"
        end, { expr = true })
      end)

      local function change_all_occurrences()
        local mode = vim.fn.mode()
        local search_term = ""
        if mode == "v" or mode == "V" then
          vim.cmd('noau normal! "vy')
          local text = vim.fn.getreg("v")
          search_term = vim.fn.escape(text, "/\\.*$^~["):gsub("\n", "\\n")
        else
          search_term = vim.fn.expand("<cword>")
        end
        local bound_s = (mode == "v" or mode == "V") and "" or "\\<"
        local bound_e = (mode == "v" or mode == "V") and "" or "\\>"
        local cmd = ":%s/" .. bound_s .. search_term .. bound_e .. "//gI"
        vim.api.nvim_feedkeys(vim.api.nvim_replace_termcodes(cmd, true, false, true), "n", false)
        vim.api.nvim_feedkeys(vim.api.nvim_replace_termcodes("<Left><Left><Left><Left>", true, false, true), "n", false)
      end
      map({ "n", "v" }, "<C-j>", change_all_occurrences, { desc = "Mudar todas" })
    end,
  },
}
