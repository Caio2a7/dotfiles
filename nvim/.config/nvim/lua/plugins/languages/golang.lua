return {
  -- 1. Plugin de utilitários, atalhos ;g e autocomando de package/boilerplate para Go
  {
    "olexsmir/gopher.nvim",
    ft = { "go" },
    dependencies = {
      "nvim-lua/plenary.nvim",
      "nvim-treesitter/nvim-treesitter",
    },
    init = function()
      local group = vim.api.nvim_create_augroup("GoPackageAutoCmd", { clear = true })
      vim.api.nvim_create_autocmd({ "BufNewFile", "BufReadPost", "BufEnter", "FileType" }, {
        group = group,
        pattern = "*",
        callback = function(ev)
          local bufnr = ev.buf
          if not vim.api.nvim_buf_is_valid(bufnr) then return end
          local filepath = vim.api.nvim_buf_get_name(bufnr)
          if filepath == "" or filepath:sub(-3) ~= ".go" then return end

          local norm_path = filepath:gsub("\\", "/")
          local dir_path = vim.fs.dirname(norm_path)
          local dir_name = (dir_path and dir_path ~= ".") and vim.fs.basename(dir_path) or ""
          local filename = vim.fs.basename(norm_path)

          -- Se for main.go ou estiver dentro de cmd/..., o pacote é main
          -- Caso contrário, usa o nome exato da pasta atual (ex: status/teste.go -> package status)
          local pkg_name = dir_name
          if filename == "main.go" or dir_name:match("^cmd") or dir_name == "" or dir_name == "." then
            pkg_name = "main"
          end

          local lines = vim.api.nvim_buf_get_lines(bufnr, 0, -1, false)
          local is_empty = (#lines == 0 or (#lines == 1 and lines[1] == ""))
          if is_empty then lines = {} end

          local has_package = false
          local has_func = false

          if not is_empty then
            for _, l in ipairs(lines) do
              if l:match("^%s*package%s+") then has_package = true end
              if l:match("^%s*func%s+") or l:match("^%s*type%s+") then has_func = true end
            end
          end

          local modified = false
          if not has_package then
            table.insert(lines, 1, "package " .. pkg_name)
            table.insert(lines, 2, "")
            modified = true
          end

          if not has_func and pkg_name == "main" then
            table.insert(lines, "import (")
            table.insert(lines, "    \"fmt\"")
            table.insert(lines, ")")
            table.insert(lines, "")
            table.insert(lines, "func main() {")
            table.insert(lines, "    fmt.Println(\"Hello, World!\")")
            table.insert(lines, "}")
            modified = true
          end

          if modified then
            vim.api.nvim_buf_set_lines(bufnr, 0, -1, false, lines)
            pcall(function() vim.bo[bufnr].filetype = "go" end)
          end
        end,
      })
    end,
    config = function()
      local gopher = require("gopher")
      gopher.setup()

      local function capitalize(str)
        return (str:gsub("^%l", string.upper))
      end

      local function lowercase_first(str)
        return (str:gsub("^%u", string.lower))
      end

      -- Extrair campos de struct no arquivo Go atual
      local function get_go_struct_fields(bufnr)
        bufnr = bufnr or vim.api.nvim_get_current_buf()
        local lines = vim.api.nvim_buf_get_lines(bufnr, 0, -1, false)
        local fields = {}
        local struct_name = "Struct"

        for _, line in ipairs(lines) do
          local sname = line:match("^%s*type%s+([%w_]+)%s+struct%s*{")
          if sname then struct_name = sname end

          local fname, ftype = line:match("^%s*([%w_]+)%s+([%w_%*%[%]%./]+)")
          if fname and ftype then
            local reserved = { ["type"] = true, ["struct"] = true, ["func"] = true, ["package"] = true, ["import"] = true }
            if not reserved[fname] then
              table.insert(fields, { name = fname, type = ftype })
            end
          end
        end

        return fields, struct_name
      end

      -- ;gc -> Gerar Função Construtora (NewStructName)
      local function generate_go_constructor()
        local bufnr = vim.api.nvim_get_current_buf()
        local fields, struct_name = get_go_struct_fields(bufnr)
        local cursor_line = vim.fn.line(".")

        local params = {}
        local initializers = {}
        for _, f in ipairs(fields) do
          table.insert(params, f.name .. " " .. f.type)
          table.insert(initializers, "        " .. f.name .. ": " .. f.name .. ",")
        end

        local gen_lines = {}
        table.insert(gen_lines, "")
        table.insert(gen_lines, "func New" .. struct_name .. "(" .. table.concat(params, ", ") .. ") *" .. struct_name .. " {")
        table.insert(gen_lines, "    return &" .. struct_name .. "{")
        for _, init in ipairs(initializers) do
          table.insert(gen_lines, init)
        end
        table.insert(gen_lines, "    }")
        table.insert(gen_lines, "}")

        vim.api.nvim_buf_set_lines(bufnr, cursor_line, cursor_line, false, gen_lines)
        vim.notify("Construtor New" .. struct_name .. " gerado!", vim.log.levels.INFO, { title = "Go CodeGen" })
      end

      -- ;gg -> Gerar Getters & Setters em Linha Única
      local function generate_go_getters_setters()
        local bufnr = vim.api.nvim_get_current_buf()
        local fields, struct_name = get_go_struct_fields(bufnr)
        if #fields == 0 then
          vim.notify("Nenhum campo encontrado na struct", vim.log.levels.WARN, { title = "Go CodeGen" })
          return
        end

        local receiver = struct_name:sub(1, 1):lower()
        local cursor_line = vim.fn.line(".")
        local gen_lines = {}

        for _, f in ipairs(fields) do
          local method_name = capitalize(f.name)
          local setter_name = "Set" .. method_name

          table.insert(gen_lines, "func (" .. receiver .. " *" .. struct_name .. ") " .. method_name .. "() " .. f.type .. " { return " .. receiver .. "." .. f.name .. " }")
          table.insert(gen_lines, "func (" .. receiver .. " *" .. struct_name .. ") " .. setter_name .. "(" .. f.name .. " " .. f.type .. ") { " .. receiver .. "." .. f.name .. " = " .. f.name .. " }")
        end

        vim.api.nvim_buf_set_lines(bufnr, cursor_line, cursor_line, false, gen_lines)
        vim.notify("Getters & Setters gerados (" .. #fields .. " campos)", vim.log.levels.INFO, { title = "Go CodeGen" })
      end

      -- ;ge -> Gerar Bloco de Tratamento de Erro (if err != nil)
      local function generate_go_err_check()
        local bufnr = vim.api.nvim_get_current_buf()
        local cursor_line = vim.fn.line(".")
        local gen_lines = {
          "if err != nil {",
          "    return err",
          "}",
        }
        vim.api.nvim_buf_set_lines(bufnr, cursor_line, cursor_line, false, gen_lines)
      end

      -- ;gt -> Adicionar Tags JSON aos Campos da Struct
      local function add_go_json_tags()
        local bufnr = vim.api.nvim_get_current_buf()
        local lines = vim.api.nvim_buf_get_lines(bufnr, 0, -1, false)
        local in_struct = false
        local modified = false

        for i, line in ipairs(lines) do
          if line:match("^%s*type%s+[%w_]+%s+struct%s*{") then
            in_struct = true
          elseif in_struct and line:match("^%s*}") then
            in_struct = false
          elseif in_struct then
            local fname, ftype = line:match("^%s*([%w_]+)%s+([%w_%*%[%]%./]+)")
            if fname and ftype and not line:find("`") then
              local tag_name = lowercase_first(fname)
              lines[i] = line:gsub("(%s*)$", " `json:\"" .. tag_name .. "\"`")
              modified = true
            end
          end
        end

        if modified then
          vim.api.nvim_buf_set_lines(bufnr, 0, -1, false, lines)
          vim.notify("Tags JSON adicionadas aos campos da struct!", vim.log.levels.INFO, { title = "Go CodeGen" })
        end
      end

      -- Mapeamento de Atalhos ;g no buffer Go
      local function bind_go_keys(bufnr)
        local opts = { buffer = bufnr, silent = true, noremap = true }

        vim.keymap.set("n", ";gc", generate_go_constructor, vim.tbl_extend("force", opts, { desc = "Go: Gerar Construtor NewStruct" }))
        vim.keymap.set("n", ";gg", generate_go_getters_setters, vim.tbl_extend("force", opts, { desc = "Go: Gerar Getters & Setters" }))
        vim.keymap.set("n", ";ge", generate_go_err_check, vim.tbl_extend("force", opts, { desc = "Go: Inserir if err != nil" }))
        vim.keymap.set("n", ";gt", add_go_json_tags, vim.tbl_extend("force", opts, { desc = "Go: Adicionar Tags JSON" }))
        vim.keymap.set("n", ";gi", function()
          vim.lsp.buf.code_action({
            filter = function(a) return (a.title or ""):lower():find("organize") ~= nil or (a.kind or ""):find("imports") ~= nil end,
            apply = true,
          })
        end, vim.tbl_extend("force", opts, { desc = "Go: Organizar Imports" }))
        vim.keymap.set("n", ";ga", function() vim.lsp.buf.code_action() end, vim.tbl_extend("force", opts, { desc = "Go: Code Actions" }))
      end

      vim.api.nvim_create_autocmd("LspAttach", {
        callback = function(args)
          local client = vim.lsp.get_client_by_id(args.data.client_id)
          if client and client.name == "gopls" then
            bind_go_keys(args.buf)
          end
        end,
      })
    end,
  },
}
