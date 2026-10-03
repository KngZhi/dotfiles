return {
  {
    'MeanderingProgrammer/render-markdown.nvim',
    dependencies = { 'nvim-treesitter/nvim-treesitter' },
    ft = { 'markdown' },
    cmd = { 'RenderMarkdown', 'MarkdownPreview' },
    opts = {
      render_modes = {},
      overrides = {
        preview = {
          render_modes = true,
          anti_conceal = { enabled = false },
          win_options = { concealcursor = { rendered = 'nvic' } },
        },
      },
    },
    config = function(_, opts)
      require('render-markdown').setup(opts)
      vim.api.nvim_create_user_command('MarkdownPreview', function()
        require('render-markdown').preview()
      end, { desc = 'Toggle Markdown preview to the right of the source' })
    end,
  },
}
