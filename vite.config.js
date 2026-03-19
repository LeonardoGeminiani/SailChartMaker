// vite.config.js
import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
  base: process.env.ELECTRON ? './' : '/SailChartMaker/',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        usage: resolve(__dirname, 'usage.html'), // Add secondary files here
      },
    },
  },
})