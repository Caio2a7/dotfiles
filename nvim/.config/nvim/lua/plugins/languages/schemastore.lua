return {
  {
    "b0o/schemastore.nvim",
    lazy = true,
  },
  {
    "neovim/nvim-lspconfig",
    opts = function(_, opts)
      opts.servers = opts.servers or {}

      -- Configuração do JSON Language Server com suporte ao SchemaStore
      opts.servers.jsonls = vim.tbl_deep_extend("force", opts.servers.jsonls or {}, {
        on_new_config = function(new_config)
          new_config.settings.json = new_config.settings.json or {}
          new_config.settings.json.schemas = new_config.settings.json.schemas or {}
          vim.list_extend(new_config.settings.json.schemas, require("schemastore").json.schemas())
        end,
        settings = {
          json = {
            format = { enable = true },
            validate = { enable = true },
          },
        },
      })

      -- Configuração do YAML Language Server com suporte a Kubernetes, Docker Compose, GitHub Actions e Ansible
      opts.servers.yamlls = vim.tbl_deep_extend("force", opts.servers.yamlls or {}, {
        on_new_config = function(new_config)
          new_config.settings.yaml = new_config.settings.yaml or {}
          new_config.settings.yaml.schemas = vim.tbl_deep_extend(
            "force",
            new_config.settings.yaml.schemas or {},
            require("schemastore").yaml.schemas()
          )
        end,
        settings = {
          yaml = {
            schemaStore = {
              -- Desativa o schemaStore remoto lento nativo para usar a versão local ultra rápida do schemastore.nvim
              enable = false,
              url = "",
            },
          },
        },
      })
      return opts
    end,
  },
}
