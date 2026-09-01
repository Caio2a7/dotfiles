return {
  -- 0. Desativar nvim-metals para eliminar warnings do Metals CLI
  {
    "scalameta/nvim-metals",
    enabled = false,
  },

  -- 1. Keybinds customizados e Autogerador de Pacotes para Java
  {
    "mfussenegger/nvim-jdtls",
    ft = { "java" },
    init = function()
      -- Autogerador de Pacotes/Classes e Keybinds
      local group = vim.api.nvim_create_augroup("JavaCustomSetup", { clear = true })
      
      -- 1. Gerador de pacotes e classes base (mantendo a lógica original do usuário)
      vim.api.nvim_create_autocmd({ "FileType", "BufNewFile", "BufReadPost", "BufEnter" }, {
        group = group,
        pattern = "*.java",
        callback = function(ev)
          local bufnr = ev.buf
          if not vim.api.nvim_buf_is_valid(bufnr) then return end
          local filepath = vim.api.nvim_buf_get_name(bufnr)
          if filepath == "" or filepath:sub(-5) ~= ".java" then return end

          local norm_path = filepath:gsub("\\", "/")
          local s, e = norm_path:find("/src/[^/]+/java/")
          if not s then s, e = norm_path:find("/java/") end
          if not s then s, e = norm_path:find("/src/") end

          local pkg_name = ""
          if e then
            local rel_path = norm_path:sub(e + 1)
            local dir_part = vim.fs.dirname(rel_path)
            if dir_part and dir_part ~= "." then
              pkg_name = dir_part:gsub("/", ".")
            end
          end

          local lines = vim.api.nvim_buf_get_lines(bufnr, 0, -1, false)
          local is_empty = (#lines == 0 or (#lines == 1 and lines[1] == ""))
          if is_empty then lines = {} end

          local has_package = false
          local has_type_def = false

          if not is_empty then
            for _, l in ipairs(lines) do
              if l:match("^%s*package%s+") then has_package = true end
              if l:match("^%s*public%s+class%s+") or l:match("^%s*class%s+")
                or l:match("^%s*public%s+interface%s+") or l:match("^%s*interface%s+")
                or l:match("^%s*public%s+enum%s+") or l:match("^%s*enum%s+")
                or l:match("^%s*public%s+record%s+") or l:match("^%s*record%s+") then
                has_type_def = true
              end
            end
          end

          local filename = vim.fs.basename(norm_path)
          local class_name = filename:gsub("%.java$", "")

          local modified = false
          if not has_package and pkg_name ~= "" then
            table.insert(lines, 1, "package " .. pkg_name .. ";")
            table.insert(lines, 2, "")
            modified = true
          end

          if not has_type_def and class_name ~= "" then
            table.insert(lines, "public class " .. class_name .. " {")
            table.insert(lines, "    ")
            table.insert(lines, "}")
            modified = true
          end

          if modified then
            vim.api.nvim_buf_set_lines(bufnr, 0, -1, false, lines)
          end
        end,
      })

      -- 2. Bind das teclas customizadas apenas quando JDTLS conectar
      vim.api.nvim_create_autocmd("LspAttach", {
        group = group,
        callback = function(args)
          local client = vim.lsp.get_client_by_id(args.data.client_id)
          if client and client.name == "jdtls" then
            local b = args.buf
            local options = { noremap = true, silent = true, buffer = b }

            local function capitalize(str)
              return (str:gsub("^%l", string.upper))
            end

            local function generate_java_constructor()
              local ts = vim.treesitter
              local parser = ts.get_parser(b, "java")
              if not parser then return end
              local tree = parser:parse()[1]
              local root = tree:root()

              local query_str = [[
                (class_declaration
                  name: (identifier) @class_name
                  body: (class_body
                    (field_declaration
                      type: _ @field_type
                      declarator: (variable_declarator name: (identifier) @field_name)
                    )
                  )
                )
              ]]
              local query = ts.query.parse("java", query_str)
              local class_name = nil
              local fields = {}

              for id, node, _ in query:iter_captures(root, b, 0, -1) do
                local name = query.captures[id]
                local text = ts.get_node_text(node, b)
                if name == "class_name" then
                  class_name = text
                elseif name == "field_type" then
                  table.insert(fields, { type = text })
                elseif name == "field_name" then
                  fields[#fields].name = text
                end
              end

              if not class_name then
                vim.notify("Nenhuma classe encontrada.", vim.log.levels.WARN)
                return
              end

              local cursor_line = vim.fn.line(".")
              local gen_lines = {}
              table.insert(gen_lines, "    public " .. class_name .. "() {}")
              table.insert(gen_lines, "")

              if #fields > 0 then
                local args_list = {}
                local assign_list = {}
                for _, f in ipairs(fields) do
                  table.insert(args_list, f.type .. " " .. f.name)
                  table.insert(assign_list, "        this." .. f.name .. " = " .. f.name .. ";")
                end
                table.insert(gen_lines, "    public " .. class_name .. "(" .. table.concat(args_list, ", ") .. ") {")
                for _, a in ipairs(assign_list) do
                  table.insert(gen_lines, a)
                end
                table.insert(gen_lines, "    }")
              end

              vim.api.nvim_buf_set_lines(b, cursor_line, cursor_line, false, gen_lines)
              vim.notify("Construtores gerados com sucesso!", vim.log.levels.INFO, { title = "Java CodeGen" })
            end

            local function generate_java_getters_setters()
              local ts = vim.treesitter
              local parser = ts.get_parser(b, "java")
              if not parser then return end
              local tree = parser:parse()[1]
              local root = tree:root()

              local query_str = [[
                (field_declaration
                  type: _ @field_type
                  declarator: (variable_declarator name: (identifier) @field_name)
                )
              ]]
              local query = ts.query.parse("java", query_str)
              local fields = {}

              for id, node, _ in query:iter_captures(root, b, 0, -1) do
                local name = query.captures[id]
                local text = ts.get_node_text(node, b)
                if name == "field_type" then
                  table.insert(fields, { type = text })
                elseif name == "field_name" then
                  fields[#fields].name = text
                end
              end

              if #fields == 0 then
                vim.notify("Nenhum campo encontrado para gerar Getters/Setters.", vim.log.levels.WARN)
                return
              end

              local cursor_line = vim.fn.line(".")
              local gen_lines = {}

              for _, f in ipairs(fields) do
                local cap_name = capitalize(f.name)
                local getter_prefix = (f.type == "boolean" and "is" or "get")
                local getter_name = getter_prefix .. cap_name
                local setter_name = "set" .. cap_name

                table.insert(gen_lines, "    public " .. f.type .. " " .. getter_name .. "() { return " .. f.name .. "; }")
                table.insert(gen_lines, "    public void " .. setter_name .. "(" .. f.type .. " " .. f.name .. ") { this." .. f.name .. " = " .. f.name .. "; }")
              end

              vim.api.nvim_buf_set_lines(b, cursor_line, cursor_line, false, gen_lines)
              vim.notify("Getters & Setters gerados em linha única (" .. #fields .. " campos)", vim.log.levels.INFO, { title = "Java CodeGen" })
            end

            vim.keymap.set("n", ";jc", generate_java_constructor, vim.tbl_extend("force", options, { desc = "Java: Gerar Construtor" }))
            vim.keymap.set("n", ";jg", generate_java_getters_setters, vim.tbl_extend("force", options, { desc = "Java: Gerar Getters & Setters" }))
            vim.keymap.set("n", ";jt", function()
              vim.lsp.buf.code_action({ filter = function(a) return (a.title or ""):lower():find("tostring") ~= nil end })
            end, vim.tbl_extend("force", options, { desc = "Java: Gerar toString()" }))
            vim.keymap.set("n", ";je", function()
              vim.lsp.buf.code_action({ filter = function(a) return (a.title or ""):lower():find("hashcode") ~= nil end })
            end, vim.tbl_extend("force", options, { desc = "Java: Gerar hashCode & equals" }))
            vim.keymap.set("n", ";jo", function() pcall(require("jdtls").organize_imports) end, vim.tbl_extend("force", options, { desc = "Java: Organizar Imports" }))
            vim.keymap.set("n", ";jv", function() pcall(require("jdtls").extract_variable) end, vim.tbl_extend("force", options, { desc = "Java: Extrair Variável" }))
            vim.keymap.set("n", ";jm", function() pcall(require("jdtls").extract_method) end, vim.tbl_extend("force", options, { desc = "Java: Extrair Método" }))
            vim.keymap.set("n", ";ja", function() vim.lsp.buf.code_action() end, vim.tbl_extend("force", options, { desc = "Java: Code Actions" }))
            vim.keymap.set("n", ";jd", function()
              pcall(require("nvim-dap-virtual-text").setup, { enabled = true, virt_text_pos = "eol", commented = true })
              pcall(require("jdtls").setup_dap, { hotcodereplace = "auto" })
              pcall(require("jdtls.dap").setup_dap_main_class_configs)
              pcall(require("dap").continue)
            end, vim.tbl_extend("force", options, { desc = "Java: Iniciar Debug DAP" }))
          end
        end,
      })
    end
  }
}
