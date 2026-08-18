return {
  -- 0. Desativar nvim-metals para eliminar warnings do Metals CLI
  {
    "scalameta/nvim-metals",
    enabled = false,
  },

  -- 1. Diagnósticos Instantâneos de Sintaxe para Java via nvim-lint + javac (30ms!)
  {
    "mfussenegger/nvim-lint",
    ft = { "java" },
    config = function()
      local lint = require("lint")

      lint.linters.javac = {
        name = "javac",
        cmd = "javac",
        args = {
          "-sourcepath",
          function()
            local filepath = vim.api.nvim_buf_get_name(0)
            local norm_path = filepath:gsub("\\", "/")
            local s, e = norm_path:find("/src/[^/]+/java")
            if e then
              return norm_path:sub(1, e)
            end
            return vim.fs.dirname(filepath)
          end,
          "-Xlint:all",
          "-d",
          "/tmp",
          "-proc:none",
        },
        stdin = false,
        stream = "stderr",
        ignore_exitcode = true,
        parser = function(output, bufnr)
          local diagnostics = {}
          local pattern = "([^:]+):(%d+):%s*(%a+):%s*(.*)"
          for _, line in ipairs(vim.split(output, "\n")) do
            local file, lnum, sev, msg = line:match(pattern)
            if file and lnum and msg then
              local severity = vim.diagnostic.severity.ERROR
              if sev:lower() == "warning" or sev:lower() == "warn" then
                severity = vim.diagnostic.severity.WARN
              end
              table.insert(diagnostics, {
                bufnr = bufnr,
                lnum = tonumber(lnum) - 1,
                col = 0,
                severity = severity,
                message = msg,
                source = "javac",
              })
            end
          end
          return diagnostics
        end,
      }

      lint.linters_by_ft.java = { "javac" }

      local lint_group = vim.api.nvim_create_augroup("JavaLint", { clear = true })
      vim.api.nvim_create_autocmd({ "BufEnter", "BufWritePost", "InsertLeave", "TextChanged" }, {
        group = lint_group,
        pattern = "*.java",
        callback = function()
          lint.try_lint("javac")
        end,
      })
    end,
  },

  -- 2. Configuracao Customizada do JDTLS (Atalhos ;j + Geradores)
  {
    "mfussenegger/nvim-jdtls",
    opts = function(_, opts)
      local function bind_java_keys(bufnr)
        local options = { buffer = bufnr, silent = true, noremap = true }

        local function capitalize(str)
          return (str:gsub("^%l", string.upper))
        end

        local function get_java_fields(b)
          b = b or vim.api.nvim_get_current_buf()
          local lines = vim.api.nvim_buf_get_lines(b, 0, -1, false)
          local fields = {}
          local class_name = "Class"

          for _, line in ipairs(lines) do
            local cname = line:match("public%s+class%s+([%w_]+)")
              or line:match("class%s+([%w_]+)")
              or line:match("public%s+record%s+([%w_]+)")
            if cname then class_name = cname end

            local clean = line:gsub("//.*$", ""):gsub("@%w+%(?.-%)?", "")
            local rest = vim.trim(clean)
              :gsub("^public%s+", "")
              :gsub("^private%s+", "")
              :gsub("^protected%s+", "")
              :gsub("^static%s+", "")
              :gsub("^final%s+", "")
              :gsub("^transient%s+", "")
              :gsub("^volatile%s+", "")
              :gsub("^static%s+", "")
              :gsub("^final%s+", "")

            local tname, fname = rest:match("^([%w_<>%[%]%?]+)%s+([%w_]+)%s*[%s=;]")
            if tname and fname then
              local reserved = {
                ["class"] = true, ["interface"] = true, ["enum"] = true, ["record"] = true,
                ["return"] = true, ["void"] = true, ["package"] = true, ["import"] = true,
                ["public"] = true, ["private"] = true, ["protected"] = true,
              }
              if not reserved[tname] and not reserved[fname] then
                table.insert(fields, { type = tname, name = fname })
              end
            end
          end
          return fields, class_name
        end

        local function generate_java_constructor()
          local b = vim.api.nvim_get_current_buf()
          local fields, class_name = get_java_fields(b)
          local cursor_line = vim.fn.line(".")

          local params = {}
          local assignments = {}
          for _, f in ipairs(fields) do
            table.insert(params, f.type .. " " .. f.name)
            table.insert(assignments, "        this." .. f.name .. " = " .. f.name .. ";")
          end

          local gen_lines = {}
          table.insert(gen_lines, "")
          table.insert(gen_lines, "    public " .. class_name .. "(" .. table.concat(params, ", ") .. ") {")
          for _, a in ipairs(assignments) do
            table.insert(gen_lines, a)
          end
          table.insert(gen_lines, "    }")

          vim.api.nvim_buf_set_lines(b, cursor_line, cursor_line, false, gen_lines)
          vim.notify("Construtor gerado para " .. class_name, vim.log.levels.INFO, { title = "Java CodeGen" })
        end

        local function generate_java_getters_setters()
          local b = vim.api.nvim_get_current_buf()
          local fields = get_java_fields(b)
          if #fields == 0 then
            vim.notify("Nenhum campo encontrado para gerar Getters/Setters", vim.log.levels.WARN, { title = "Java CodeGen" })
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

      vim.api.nvim_create_autocmd("LspAttach", {
        callback = function(args)
          local client = vim.lsp.get_client_by_id(args.data.client_id)
          if client and client.name == "jdtls" then
            bind_java_keys(args.buf)
          end
        end,
      })

      return opts
    end,
  },

  -- 3. Autocomando Universal para Package e Classe ao Criar/Abrir Arquivos Java
  {
    "nvim-lua/plenary.nvim",
    lazy = false,
    config = function()
      vim.api.nvim_create_autocmd({ "FileType", "BufReadPost", "BufEnter" }, {
        pattern = { "java", "*.java" },
        callback = function(ev)
          local bufnr = ev.buf
          if not vim.api.nvim_buf_is_valid(bufnr) then return end
          local filepath = vim.api.nvim_buf_get_name(bufnr)
          if filepath == "" or not filepath:sub(-5) == ".java" then return end

          local norm_path = filepath:gsub("\\", "/")
          local java_root_pat = "/src/[^/]+/java/"
          local s, e = norm_path:find(java_root_pat)
          if not s then s, e = norm_path:find("/java/") end

          local pkg_name = ""
          if e then
            local rel_path = norm_path:sub(e + 1)
            local dir_part = vim.fs.dirname(rel_path)
            if dir_part and dir_part ~= "." then
              pkg_name = dir_part:gsub("/", ".")
            end
          end

          local lines = vim.api.nvim_buf_get_lines(bufnr, 0, -1, false)
          local has_package = false
          local has_type_def = false

          for _, l in ipairs(lines) do
            if l:match("^%s*package%s+") then has_package = true end
            if l:match("^%s*public%s+class%s+") or l:match("^%s*class%s+")
              or l:match("^%s*public%s+interface%s+") or l:match("^%s*interface%s+")
              or l:match("^%s*public%s+enum%s+") or l:match("^%s*enum%s+")
              or l:match("^%s*public%s+record%s+") or l:match("^%s*record%s+") then
              has_type_def = true
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
    end,
  },
}
