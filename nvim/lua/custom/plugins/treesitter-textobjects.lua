-- Treesitter textobjects for daf, dif, etc.
return {
  'nvim-treesitter/nvim-treesitter-textobjects',
  dependencies = { 'nvim-treesitter/nvim-treesitter' },
  event = { 'BufReadPost', 'BufNewFile' },
  config = function()
    ---@diagnostic disable-next-line: missing-fields
    require('nvim-treesitter.configs').setup {
      textobjects = {
        select = {
          enable = true,
          lookahead = true,
          keymaps = {
            ['af'] = '@function.outer',  -- daf, vaf, yaf
            ['if'] = '@function.inner',  -- dif, vif, yif
            ['ac'] = '@class.outer',     -- dac, vac, yac
            ['ic'] = '@class.inner',     -- dic, vic, yic
            ['aa'] = '@parameter.outer', -- daa, vaa, yaa
            ['ia'] = '@parameter.inner', -- dia, via, yia
          },
        },
        move = {
          enable = true,
          set_jumps = true,
          goto_next_start = {
            [']f'] = '@function.outer',
            [']c'] = '@class.outer',
          },
          goto_previous_start = {
            ['[f'] = '@function.outer',
            ['[c'] = '@class.outer',
          },
        },
      },
    }
  end,
}
